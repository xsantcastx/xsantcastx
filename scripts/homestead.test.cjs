// Homestead: pure layout + state derivation, the world data, and the engine hook.
// Run: node --test scripts/homestead.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

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
const model = loadTs(src('play/homestead/homestead.model.ts'));
const render = loadTs(src('play/engine/homestead-render.ts'));
const homestead = loadTs(src('play/world/homestead.ts'));
const world = loadTs(src('play/world/world.model.ts'));
const economy = loadTs(src('shared/economy/economy.model.ts'));

/** A quote over a plain levels map, priced by the catalogue's own costOf. */
function quoteOf(levels, defs, caps = {}) {
  const byId = new Map(defs.map(d => [d.id, d]));
  return {
    level: id => levels[id] ?? 0,
    cost: id => economy.costOf(byId.get(id).baseCost, levels[id] ?? 0),
    maxed: id => (levels[id] ?? 0) >= (caps[id] ?? Infinity),
  };
}

test('the Homestead is reachable from the Infernal town and back, with every building a panel station', () => {
  const town = world.TOWNS.infernal;
  const gate = town.stations.find(s => s.id === homestead.HOMESTEAD_GATE_ID);
  assert.ok(gate && gate.kind === 'passage' && gate.to === homestead.HOMESTEAD_ID);
  const area = world.areaOf(town, homestead.HOMESTEAD_ID);
  assert.ok(area, 'the Homestead is one of the town areas');
  assert.equal(area.monsters.length, 0, 'quiet ground');
  assert.ok(area.stations.some(s => s.kind === 'passage' && s.to === 'infernal'), 'and a way home');
  assert.equal(town.hunts[0].id, 'ember-quarry', 'the quarry stays the first hunt');
  const ids = homestead.HOMESTEAD_BUILDINGS.map(s => homestead.buildingOfStation(s.id));
  assert.deepEqual([...ids].sort(), [...homestead.HOMESTEAD_BUILDING_IDS].sort(), 'one station per building');
  for (const s of homestead.HOMESTEAD_BUILDINGS) assert.equal(s.panel, 'homestead');
  assert.equal(homestead.buildingOfStation('forge'), null, 'a town station id never reads as a building');
  assert.equal(homestead.buildingOfStation('hs-nope'), null);
});

test('bestRung offers the most gain per Gold; a free rung wins; maxed rungs are skipped', () => {
  const rungs = economy.FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, gain: u.ratePerSecond }));
  const quote = quoteOf({}, economy.FORGE_UPGRADES);
  // forge-bellows: 0.5/5000 = 1e-4, the best ratio on a fresh ledger.
  assert.equal(model.bestRung(rungs, quote).id, 'forge-bellows');
  const free = { ...quote, cost: id => id === 'nether-furnace' ? 0 : quote.cost(id) };
  assert.equal(model.bestRung(rungs, free).id, 'nether-furnace');
  const allMaxed = { ...quote, maxed: () => true };
  assert.equal(model.bestRung(rungs, allMaxed), null);
  // Ten bellows later (5000 * 1.25^10 ≈ 46.6K for 0.5/s) the stoker is the better buy.
  assert.equal(model.bestRung(rungs, quoteOf({ 'forge-bellows': 10 }, economy.FORGE_UPGRADES)).id, 'ember-stoker');
});

test('buildingAction names the rung and its cost, and says the shortfall in plain words', () => {
  const rung = { id: 'apprentice-striker', name: 'Apprentice Striker', gain: 1 };
  const quote = quoteOf({}, economy.AUTO_CLICKERS);
  const poor = model.buildingAction(rung, quote, 100_000, 'Unlock');
  assert.equal(poor.label, 'Unlock: Apprentice Striker · 500,000 Gold');
  assert.equal(poor.affordable, false);
  assert.equal(poor.locked, 'You need 400,000 more Gold.');
  const rich = model.buildingAction(rung, quote, 600_000, 'Unlock');
  assert.equal(rich.affordable, true); assert.equal(rich.locked, ''); assert.equal(rich.upgradeId, 'apprentice-striker');
  assert.equal(model.buildingAction(null, quote, 0, 'Upgrade').upgradeId, null, 'fully built has no purchase');
  const gated = model.buildingAction(rung, quote, 1e12, 'Add', 'Recruit a Thrall at the Market first.');
  assert.equal(gated.upgradeId, null); assert.equal(gated.locked, 'Recruit a Thrall at the Market first.');
});

test('the receipt: walking past collects once, batches while standing, and never invents value', () => {
  const ledger = model.emptyLedger();
  const buildings = [{ id: 'furnace', x: 1000 }, { id: 'camp', x: 1700 }];
  assert.deepEqual(model.collectable(ledger, buildings, 1000, 0, {}), [], 'nothing pending, nothing to collect');
  ledger.furnace.gold = 12.7;
  assert.deepEqual(model.collectable(ledger, buildings, 1500, 0, {}), [], 'out of reach');
  assert.deepEqual(model.collectable(ledger, buildings, 1050, 0, {}), ['furnace']);
  assert.equal(model.pendingLine(ledger.furnace), '+12 Gold since you were last here');
  assert.deepEqual(model.collectable(ledger, buildings, 1050, 1000, { furnace: 0 }), [], 'batched inside the cooldown');
  assert.deepEqual(model.collectable(ledger, buildings, 1050, model.COLLECT_COOLDOWN_MS, { furnace: 0 }), ['furnace']);
  ledger.camp.returns = 2; ledger.camp.gold = 1500;
  assert.equal(model.pendingLine(ledger.camp), '+1,500 Gold · 2 explorers home since you were last here');
});

test('splitIdleGain divides an already-credited settlement by the real breakdown lines', () => {
  const split = model.splitIdleGain(10, { idle: 3, auto: 1, rpg: 1 });
  assert.equal(split.furnace, 6); assert.equal(split.automatons, 2); assert.equal(split.treasury, 2);
  assert.equal(split.furnace + split.automatons + split.treasury, 10, 'shares sum to the amount: nothing added');
  assert.deepEqual(model.splitIdleGain(5, { idle: 0, auto: 0, rpg: 0 }), { furnace: 5, automatons: 0, treasury: 0 });
});

test('the buildings column: cheapest first, one mystery row ahead, shortfall and gain from live quotes', () => {
  const defs = [
    ...economy.FORGE_UPGRADES.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'furnace' })),
    ...economy.AUTO_CLICKERS.map(u => ({ id: u.id, name: u.name, art: u.id, baseCost: u.baseCost, building: 'automatons' })),
  ];
  const all = [...economy.FORGE_UPGRADES, ...economy.AUTO_CLICKERS];
  const quote = quoteOf({}, all);
  const fresh = model.columnRows(defs, quote, 0, 0, () => 0.5);
  assert.deepEqual(fresh.map(r => r.state), ['shown', 'mystery'], 'a new player sees one rung and one ???');
  assert.equal(fresh[0].id, 'forge-bellows'); assert.equal(fresh[0].shortfall, 5000);
  assert.equal(fresh[1].unlockAt, Math.ceil(20_000 * model.REVEAL_SHARE));
  const later = model.columnRows(defs, quoteOf({ 'forge-bellows': 2 }, all), 30_000, 60_000, () => 1);
  const shown = later.filter(r => r.state === 'shown');
  assert.ok(shown.length >= 3 && later.filter(r => r.state === 'mystery').length === 1);
  for (let i = 1; i < later.length; i++) {
    const cost = (id) => defs.find(d => d.id === id).baseCost;
    assert.ok(cost(later[i - 1].id) <= cost(later[i].id), 'cheapest first');
  }
  const bellows = later.find(r => r.id === 'forge-bellows');
  assert.equal(bellows.owned, 2); assert.equal(bellows.cost, economy.costOf(5000, 2)); assert.equal(bellows.affordable, true);
  assert.equal(model.formatPerSecond(0.5), '+0.5 Gold/s');
  assert.equal(model.formatPerSecond(1250), '+1.3K Gold/s');
});

test('layout: figures cap and centre, explorers walk from their real timestamps, reduced motion holds the forge still', () => {
  assert.equal(render.automatonSlots(0, 500).length, 0);
  assert.equal(render.automatonSlots(40, 500).length, render.MAX_FIGURES);
  const three = render.automatonSlots(3, 500);
  assert.equal(three[1].x, 500, 'centred');
  assert.equal(render.tentSlots(0, 100).length, 1, 'there is always one tent');
  assert.equal(render.tentSlots(9, 100).length, 6);
  const start = 1_000_000, dur = 100_000;
  const leaving = render.explorerWalk(start, dur, start + 10_000, 1700);
  assert.ok(leaving && leaving.facing === 1 && leaving.x > 1700);
  assert.equal(render.explorerWalk(start, dur, start + 50_000, 1700), null, 'at the site: out of sight');
  const back = render.explorerWalk(start, dur, start + 90_000, 1700);
  assert.ok(back && back.facing === -1);
  assert.equal(render.explorerWalk(start, dur, start + 200_000, 1700).x, 1700, 'home');
  assert.equal(render.vaultPiles(0), 0); assert.equal(render.vaultPiles(12_345), 4); assert.equal(render.vaultPiles(1e15), 9);
  assert.equal(render.furnaceScale(0), 0); assert.ok(render.furnaceScale(64) > render.furnaceScale(2));
  assert.equal(render.forgeSquash(100, true), 1);
  assert.ok(render.forgeSquash(110, false) < 1); assert.equal(render.forgeSquash(500, false), 1);
});

test('the scene: paints only its own stations, the Forge interaction strikes, other buildings fall through to the panel', () => {
  const scene = new render.HomesteadScene();
  let strikes = 0;
  scene.onStrike = () => { strikes++; };
  assert.equal(scene.paints('homestead', 'hs-furnace'), true);
  assert.equal(scene.paints('homestead', 'passage'), false, 'the return arch is the engine\'s');
  assert.equal(scene.paints('infernal', homestead.HOMESTEAD_GATE_ID), true, 'the gate is painted in town');
  assert.equal(scene.paints('infernal', 'forge'), false);
  assert.equal(scene.interact('homestead', homestead.HOMESTEAD_FORGE_STATION), true); assert.equal(strikes, 1);
  assert.equal(scene.interact('homestead', 'hs-furnace'), false, 'no onBuilding → the engine opens the panel');
  assert.equal(scene.interact('infernal', homestead.HOMESTEAD_FORGE_STATION), false);
  scene.addPending('furnace', { gold: 3 });
  assert.equal(scene.pending('furnace').gold, 3);
});

test('Your Anvil and Your Enchanting Circle: plot stations that open the real benches, painted by the view', () => {
  const area = world.areaOf(world.TOWNS.infernal, homestead.HOMESTEAD_ID);
  const anvil = area.stations.find(s => s.id === homestead.HOME_ANVIL_STATION);
  const circle = area.stations.find(s => s.id === homestead.HOME_CIRCLE_STATION);
  assert.ok(anvil && anvil.kind === 'panel' && anvil.panel === 'crafting', 'the anvil opens the Crafting Bench');
  assert.ok(circle && circle.kind === 'panel' && circle.panel === 'enchanting', 'the circle opens the Enchanting Table');
  assert.equal(homestead.homeStationOf(anvil.id), 'anvil');
  assert.equal(homestead.homeStationOf(circle.id), 'circle');
  assert.equal(homestead.homeStationOf('crafting'), null, 'a town bench is never a home station');
  assert.equal(homestead.buildingOfStation(anvil.id), null, 'not a receipt building');
  for (const s of [anvil, circle]) assert.ok(s.x + (s.width ?? 120) / 2 <= area.width, `${s.id} inside the plot`);
  assert.ok(render.FENCE_END >= circle.x && render.FENCE_END <= area.width, 'the fence reaches the corner');
  const scene = new render.HomesteadScene();
  assert.equal(scene.paints('homestead', anvil.id), true);
  assert.equal(scene.paints('homestead', circle.id), true);
  assert.equal(scene.paints('infernal', anvil.id), false);
  assert.equal(scene.interact('homestead', anvil.id), false, 'the engine opens the panel');
  assert.equal(scene.interact('homestead', circle.id), false);
  // Visible upgrades: the anvil grows and glows, the circle's runes brighten, every tier.
  for (let t = 2; t <= 4; t++) {
    assert.ok(render.anvilLook(t).scale > render.anvilLook(t - 1).scale);
    assert.ok(render.anvilLook(t).glow > render.anvilLook(t - 1).glow);
    assert.ok(render.circleLook(t).bright > render.circleLook(t - 1).bright);
    assert.ok(render.circleLook(t).runes > render.circleLook(t - 1).runes && render.circleLook(t).runes <= 10);
  }
  assert.equal(render.anvilLook(1).glow, 0, 'tier I is a plain anvil');
  assert.equal(render.emptyModel().homeForge.anvil, 1);
});

// ── The engine seam ──────────────────────────────────────────────────────────
function loadEngine() {
  const modules = new Map();
  const target = () => ({ addEventListener() {}, removeEventListener() {} });
  const context = vm.createContext({
    crypto, console, performance,
    Image: class { set src(value) {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    window: { ...target(), devicePixelRatio: 1 }, document: { ...target(), hidden: false },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)((name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
    return module.exports;
  }
  return load(src('play/engine/engine.ts')).SeamworksEngine;
}

test('engine hook: draw every frame, painted stations skip their body, interaction is handed to the view', () => {
  const Engine = loadEngine();
  const opened = [];
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onStation: s => opened.push(s.id), onState() {} });
  const calls = { draw: [], paints: 0, interact: [] };
  engine.setHomesteadView({
    draw: (c, f) => calls.draw.push(f.areaId),
    paints: () => { calls.paints++; return true; },
    interact: (area, id) => { calls.interact.push(`${area}/${id}`); return id === 'hs-forge'; },
  });
  const noop = () => {};
  engine.context = new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) },
    { get: (t, k) => k in t ? t[k] : noop, set: () => true });
  engine.render();
  assert.deepEqual(calls.draw, ['infernal']);
  engine.goToStation(homestead.HOMESTEAD_GATE_ID, true);
  assert.equal(engine.areaDef.id, 'homestead', 'the gate is a plain passage');
  engine.render();
  assert.equal(calls.draw.at(-1), 'homestead');
  assert.ok(calls.paints > 0);
  engine.goToStation('hs-forge', true);
  assert.deepEqual(opened, [], 'the Forge strike is the view\'s, no panel');
  engine.goToStation('hs-camp', true);
  assert.deepEqual(opened, ['hs-camp'], 'other buildings open their panel');
  engine.setHomesteadView(null);
  engine.render();
  engine.destroy();
});
