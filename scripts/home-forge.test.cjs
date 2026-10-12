// Your Anvil + Your Enchanting Circle (Homestead): tiers, prices, the save, and
// the proof that no tier lets the anvil mint past today's ceiling.
// Run: node --test scripts/home-forge.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file) {
  const cache = loadTs.cache || (loadTs.cache = new Map());
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => loadTs(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
  return module.exports;
}
const src = (p) => path.resolve(__dirname, '../src/app', p);
const home = loadTs(src('shared/minigames/home-forge.model.ts'));
const anvil = loadTs(src('shared/minigames/anvil.model.ts'));
const ritual = loadTs(src('shared/minigames/ritual.model.ts'));
const TIERS = [1, 2, 3, 4];

test('tier I is today\'s anvil and ritual exactly', () => {
  const a = home.anvilTierRules(1);
  assert.deepEqual(a.zones, { ...anvil.ANVIL_ZONES });
  assert.equal(a.strikes, anvil.ANVIL_STRIKES);
  assert.equal(a.counted, anvil.ANVIL_STRIKES);
  for (let pos = 0; pos <= 1.0001; pos += 0.005) assert.equal(anvil.gradeStrike(pos, a.zones), anvil.gradeStrike(pos));
  const games = [['perfect', 'good', 'off', 'good'], ['off', 'off', 'off', 'off'], ['perfect', 'perfect', 'good', 'perfect']];
  for (const g of games) assert.equal(home.homeAnvilQuality(g, a.counted), anvil.anvilQuality(g), 'bit-identical quality');
  assert.equal(home.circleTierRules(1).window, ritual.PULSE_WINDOW);
  assert.equal(home.circleTierRules(1).rarestFirst, false);
  for (let s = 0.4; s <= 1.7; s += 0.003) assert.deepEqual(ritual.gradePulse(s, 0, ritual.PULSE_WINDOW), ritual.gradePulse(s, 0));
  for (let m = 0; m < 6; m++) assert.equal(ritual.pulseWindow(m), ritual.pulseWindow(m, ritual.PULSE_WINDOW));
});

test('each tier only helps, and stays inside what the bias proof needs', () => {
  let prev = null;
  for (const t of TIERS) {
    const a = home.anvilTierRules(t);
    assert.ok(a.zones.perfect > 0 && a.zones.perfect <= a.zones.good && a.zones.good <= 1, `tier ${t} zones ordered`);
    assert.ok(a.counted >= 1 && a.counted <= a.strikes, `tier ${t} counted <= strikes`);
    if (prev) {
      assert.ok(a.zones.perfect >= prev.zones.perfect && a.zones.good >= prev.zones.good, `tier ${t} never narrower`);
      assert.ok(a.strikes - a.counted >= prev.strikes - prev.counted, `tier ${t} never fewer spare strikes`);
    }
    prev = a;
    // Every possible game's quality is in [0, 1]; so is the exponent's input.
    const grades = ['perfect', 'good', 'off'];
    const all = (n) => n === 0 ? [[]] : all(n - 1).flatMap(g => grades.map(x => [...g, x]));
    for (const g of all(a.strikes)) {
      const q = home.homeAnvilQuality(g, a.counted);
      assert.ok(q >= 0 && q <= 1, `q=${q} in [0,1]`);
      const e = anvil.anvilExponent(q);
      assert.ok(e >= 0.8 - 1e-12 && e <= 1);
    }
    const c = home.circleTierRules(t);
    assert.ok(c.window >= ritual.PULSE_WINDOW && c.window <= ritual.PULSE_WINDOW_MAX, `tier ${t} window in range`);
    for (let m = 0; m < 10; m++) assert.ok(ritual.pulseWindow(m, c.window) <= ritual.PULSE_WINDOW_MAX);
  }
  assert.equal(home.anvilTierRules(3).strikes, anvil.ANVIL_STRIKES + 1, 'III adds a spare strike');
  assert.equal(home.circleTierRules(3).rarestFirst, true, 'III puts the rarest rune first');
  // A spare strike drops the worst one.
  assert.equal(home.homeAnvilQuality(['perfect', 'perfect', 'perfect', 'perfect', 'off'], 4), 1);
});

test('the biased roll cannot reach 1 at any tier (the ceiling proof\'s premise)', () => {
  for (const t of TIERS) {
    const a = home.anvilTierRules(t);
    const q = home.homeAnvilQuality(Array(a.strikes).fill('perfect'), a.counted);
    for (const r of [0, 0.3, 0.99, 1 - Number.EPSILON, 1, 2]) {
      const b = anvil.anvilBiasRoll(r, q);
      assert.ok(b >= 0 && b < 1, `tier ${t}: r=${r} → ${b}`);
    }
    const rng = anvil.anvilRng(() => 1 - Number.EPSILON, q);
    assert.ok(rng() < 1);
  }
});

test('prices come from the one config object; upgrades go one tier at a time and replay for free', () => {
  for (const station of home.HOME_STATION_IDS) {
    const prices = home.HOME_FORGE_CONFIG[station].price;
    assert.equal(prices.length, home.HOME_TIER_MAX - 1);
    for (let i = 1; i < prices.length; i++) assert.ok(prices[i] > prices[i - 1], 'each tier costs more');
    assert.equal(home.homeUpgradeCost(station, 1), 0);
    assert.equal(home.homeUpgradeCost(station, 2), prices[0]);
    let state = home.emptyHomeForge();
    const q1 = home.quoteHomeUpgrade(state, station, 0);
    assert.equal(q1.tier, 2); assert.equal(q1.affordable, false); assert.equal(q1.shortfall, prices[0]);
    assert.equal(q1.actionId, `home-forge:${station}:2`);
    assert.equal(home.quoteHomeUpgrade(state, station, prices[0]).affordable, true);
    assert.equal(home.applyHomeUpgrade(state, station, 3), null, 'no skipping a tier');
    state = home.applyHomeUpgrade(state, station, 2);
    assert.equal(state[station], 2);
    assert.equal(home.applyHomeUpgrade(state, station, 2), null, 'the same action again is a replay, not a second tier');
    state = home.applyHomeUpgrade(home.applyHomeUpgrade(state, station, 3), station, 4);
    assert.equal(state[station], 4);
    const top = home.quoteHomeUpgrade(state, station, 1e15);
    assert.equal(top.tier, null); assert.equal(top.affordable, false); assert.equal(top.actionId, null);
    assert.equal(home.applyHomeUpgrade(state, station, 5), null, 'nothing past IV');
  }
});

test('the save coerces junk to tier I and a structural max-merge is the right merge', () => {
  assert.deepEqual(home.coerceHomeForge(null), { version: 1, anvil: 1, circle: 1 });
  assert.deepEqual(home.coerceHomeForge({ anvil: 9, circle: -2 }), { version: 1, anvil: 4, circle: 1 });
  assert.deepEqual(home.coerceHomeForge({ anvil: 2.7, circle: 'x' }), { version: 1, anvil: 2, circle: 1 });
  assert.deepEqual(home.coerceHomeForge([3]), { version: 1, anvil: 1, circle: 1 });
  // Tiers never go down, so taking the larger per field (cloud-save's mergeDeep for numbers) never loses a purchase.
  const a = { version: 1, anvil: 3, circle: 1 }, b = { version: 1, anvil: 2, circle: 4 };
  const merged = { version: 1, anvil: Math.max(a.anvil, b.anvil), circle: Math.max(a.circle, b.circle) };
  assert.deepEqual(home.coerceHomeForge(merged), { version: 1, anvil: 3, circle: 4 });
  assert.equal(home.tierNumeral(1), 'I'); assert.equal(home.tierNumeral(4), 'IV'); assert.equal(home.tierNumeral(99), 'IV');
});

test('the cloud registry syncs the blob under progress/home-forge with the structural merge', () => {
  const text = fs.readFileSync(src('shared/cloud-save/cloud-save.model.ts'), 'utf8');
  const at = text.indexOf(`key: '${home.HOME_FORGE_KEY}'`);
  assert.ok(at > 0, 'registered in SYNCED_BLOBS');
  const entry = text.slice(at, text.indexOf('}', at));
  assert.match(entry, /collection: 'progress'/);
  assert.match(entry, /doc: 'home-forge'/);
  assert.doesNotMatch(entry, /merge:/, 'no hand-written merge: higher wins');
});

test('mints no stat above today\'s ceiling at any home tier, even with a perfect game and the best RNG', () => {
  const crafting = loadTs(src('shared/crafting/crafting.model.ts'));
  const defs = loadTs(src('shared/rpg/item-definition.ts'));
  const quality = loadTs(src('shared/rpg/item-quality.ts'));
  const rolled = crafting.CRAFTING_RECIPES
    .map(r => ({ r, def: defs.itemDefinitionById(r.output.itemId) }))
    .filter(x => x.def && x.def.rollKeys.length > 0);
  assert.ok(rolled.length > 0);
  let checked = 0;
  for (const t of TIERS) {
    const a = home.anvilTierRules(t);
    const q = home.homeAnvilQuality(Array(a.strikes).fill('perfect'), a.counted);
    for (const { r, def } of rolled) {
      const voidTouched = def.style === 'void' || def.style === 'void-touched';
      const rng = crafting.masteryRng(anvil.anvilRng(() => 1 - Number.EPSILON, q), crafting.MASTERY_BONUS, r.rarity, voidTouched);
      const item = defs.mintEquipment(def.id, r.rarity, rng);
      if (!item) continue;
      const { max } = quality.bandFor(r.rarity, voidTouched);
      for (const key of def.rollKeys) {
        const ceiling = defs.statCeiling(def, r.rarity, key);
        if (!ceiling) continue;
        assert.ok((item.stats[key] ?? 0) <= ceiling * max + 1, `${def.id} ${key} at tier ${t}`);
        const grade = item.rollQuality?.[key];
        if (grade != null) assert.ok(grade <= 1);
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});
