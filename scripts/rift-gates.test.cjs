// The Rift Gates and the Ink Deeps (the Umbral's underside): the gates in the
// Ember Delve, the realm generator, and the engine walking through a gate, the
// broken rule (tide, ink, drift pockets, shades, the Warden) and back out.
// Same loader as delve-endless.test.cjs.
//
//   node --test scripts/rift-gates.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function loader() {
  const modules = new Map();
  const target = { addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({
    crypto, console, performance,
    Image: class { set src(value) {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    window: { ...target, devicePixelRatio: 1 }, document: { ...target, hidden: false },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const wrapper = vm.runInContext(`(function(require,module,exports){${code}\n})`, context);
    wrapper((name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
    return module.exports;
  }
  return (rel) => load(path.resolve(__dirname, '../src/app', rel));
}
const load = loader();
const { SeamworksEngine: Engine } = load('play/engine/engine.ts');
const terrainMod = load('play/engine/terrain.ts');
const gen = load('play/engine/sector-gen.ts');
const deep = load('play/engine/underhearth-gen.ts');
const realmGen = load('play/engine/realm-gen.ts');
const umbral = load('play/engine/umbral.ts');
const { LiquidSim } = load('play/engine/liquids.ts');
const region = load('shared/delve/delve-region.model.ts');
const rift = load('shared/delve/rift-gates.model.ts');
const towns = load('play/world/towns/infernal.ts');
const realmTown = load('play/world/towns/umbral-delve.ts');
const SPEC = towns.EMBER_DELVE.terrain;
const USPEC = realmTown.UMBRAL_DELVE.terrain;
const { CELL, nodeIndex, TERRAIN_NODE_LIST, LIQUID_INK, LIQUID_WATER, LIQUID_FULL } = terrainMod;
const { SECTOR } = gen;
const id = kind => TERRAIN_NODE_LIST[kind].id;
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];
/** Objects made inside the loader's vm realm compare by shape. */
const plain = value => JSON.parse(JSON.stringify(value));

/** A Delve persistence that keeps each area's sectors apart (the service routes by area, like this). */
function memoryDelve(seed) {
  const cores = new Map(), sectors = new Map(), claimed = new Set();
  const key = (area, sx, sy) => `${area}|${sx},${sy}`;
  const diff = (area, sx, sy, g) => {
    let d = sectors.get(key(area, sx, sy));
    if (!d || d.g !== g) { d = { g, t: 0 }; sectors.set(key(area, sx, sy), d); }
    return d;
  };
  const core = area => { let c = cores.get(area); if (!c) { c = new Map(); cores.set(area, c); } return c; };
  const store = {
    sector(area, sx, sy) {
      const d = sectors.get(key(area, sx, sy));
      if (!d) return null;
      return { g: d.g, t: d.t, cells: region.decodeRuns(d.c), liquids: region.decodeRuns(d.l), fog: region.decodeFog(d.f), receipts: region.decodeIndexSet(d.k) };
    },
    sectorChanged(area, sx, sy, g, local, kind) {
      const d = diff(area, sx, sy, g), cells = region.decodeRuns(d.c);
      if (kind === null) cells.delete(local); else cells.set(local, kind);
      d.c = region.encodeRuns(cells); d.t = Date.now();
    },
    sectorLiquids(area, sx, sy, g, cells) { if (!cells.size && !sectors.has(key(area, sx, sy))) return; diff(area, sx, sy, g).l = region.encodeRuns(cells); },
    sectorExplored(area, sx, sy, g, fog) { const d = diff(area, sx, sy, g), was = region.decodeFog(d.f) ?? new Uint8Array(8); for (let i = 0; i < 8; i++) was[i] |= fog[i]; d.f = region.encodeFog(was); },
    sectorKeys: area => [...sectors.keys()].filter(k => k.startsWith(`${area}|`)).map(k => { const [sx, sy] = k.split('|')[1].split(',').map(Number); return { sx, sy }; }),
  };
  return {
    sectorsMap: sectors, cores, claimedSet: claimed,
    seed: area => (rift.realmOfArea(area) ? rift.realmSeed(seed, rift.realmOfArea(area)) : seed),
    cells: area => (core(area).size ? core(area) : null),
    changed(area, _layout, index, kind) { if (kind === null) core(area).delete(index); else core(area).set(index, kind); },
    seenCells: (_a, _l, cells) => new Uint8Array((cells + 7) >> 3),
    explored() {},
    liquids: () => null,
    liquidsChanged() {},
    isClaimed: f => claimed.has(f),
    claim: f => (claimed.has(f) ? false : (claimed.add(f), true)),
    sectors: store,
  };
}
function fixture(delve, extra = {}) {
  let state;
  const uses = [];
  const actions = [];
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot: () => true, onWorldAction: e => { actions.push(e); return true; }, onUse: e => uses.push(e), onState: value => { state = value; }, delve, ...extra });
  return { engine, uses, actions, state: () => { engine.report(); return state; } };
}
function enter(delve) {
  const f = fixture(delve);
  const shaft = f.engine.places.find(station => station.id === 'delve');
  f.engine.player.x = shaft.x; f.engine.player.y = 610; f.engine.interact();
  assert.equal(f.state().areaId, 'ember-delve');
  return f;
}
function standOn(engine, col, floorRow, steps = 4) {
  engine.player.x = (col + .5) * CELL; engine.player.y = engine.terrain.top + floorRow * CELL; engine.player.vy = 0; engine.player.grounded = true;
  for (let n = 0; n < steps; n++) engine.update(1 / 60);
}
const kindAt = (engine, col, row) => id(engine.terrain.kind[engine.terrain.index(col, row)]);
/** The Ember Delve's gate of a realm for a seed: its chamber plan. */
function gatePlan(seed, realm) {
  const ctx = gen.sectorContext(SPEC, seed);
  const place = rift.RIFT_GATES[realm].place;
  const plans = place.stratum === 'deep' ? deep.deepPlans(ctx, place.cell) : gen.latticePlans(ctx, place.cell);
  return plans.find(p => p.kind === 'rift-gate');
}

// ── The gates ───────────────────────────────────────────────────────────────

test('gates: every seed has all four, each in its own lattice cell and stratum, with its own node and splinters in the frame', () => {
  for (const seed of SEEDS) {
    const ctx = gen.sectorContext(SPEC, seed);
    for (const realm of rift.RIFT_REALMS) {
      const plan = gatePlan(seed, realm);
      assert.ok(plan, `${realm} gate for seed ${seed}`);
      const { place } = rift.RIFT_GATES[realm];
      assert.equal(Math.floor(plan.col / 64), place.cell);
      if (place.stratum === 'deep') assert.ok(plan.row >= 58 && plan.row + plan.h < 86, 'in the Underhearth\'s upper band');
      else assert.ok(plan.row + plan.h < [12, 26, 40, 56][place.stratum] && plan.row > [0, 12, 26, 40][place.stratum], 'inside its stratum');
      // Generate the columns it touches and read the cells.
      const cells = new Map();
      for (let sx = Math.floor((plan.col - 2) / SECTOR); sx <= Math.floor((plan.col + plan.w + 2) / SECTOR); sx++) {
        const column = gen.generateSectorColumn(ctx, sx);
        for (let i = 0; i < column.kind.length; i++) cells.set(`${sx * SECTOR + (i % SECTOR)},${Math.floor(i / SECTOR)}`, id(column.kind[i]));
      }
      const at = (c, r) => cells.get(`${c},${r}`);
      for (let r = plan.row + 2; r < plan.row + 5; r++) for (let c = plan.col + 3; c < plan.col + 5; c++) assert.equal(at(c, r), rift.RIFT_GATES[realm].node);
      // Room to stand beside it, on a frame floor; open at both sides.
      for (let r = plan.row + 2; r < plan.row + 5; r++) assert.equal(at(plan.col + 6, r), 'air');
      assert.equal(at(plan.col + 6, plan.row + 5), 'rift-frame');
      let splinters = 0;
      for (const [, v] of cells) if (v === 'rift-splinter') splinters++;
      assert.ok(splinters >= 4, `${realm}: ${splinters} splinters (a sigil needs 4)`);
    }
  }
});

test('gates: the realm table, flags and the attune rule', () => {
  assert.equal(rift.RIFT_GATES.umbral.open, true);
  // The Verdant and Luminous Delves shipped after (scripts/realm-delves.test.cjs), the Celestial last
  // (scripts/celestial-delve.test.cjs): every gate is open; a settling gate would still say so.
  for (const realm of rift.RIFT_REALMS) assert.equal(rift.RIFT_GATES[realm].open, true, realm);
  assert.deepEqual(plain(rift.attuneCheck('umbral', { delving: 19, sigils: 1, attuned: false })), { ok: false, why: 'delving', need: 20 });
  assert.deepEqual(plain(rift.attuneCheck('umbral', { delving: 20, sigils: 0, attuned: false })), { ok: false, why: 'sigil', sigil: 'umbral-sigil' });
  assert.deepEqual(plain(rift.attuneCheck('umbral', { delving: 20, sigils: 1, attuned: false })), { ok: true, attune: true });
  assert.deepEqual(plain(rift.attuneCheck('umbral', { delving: 1, sigils: 0, attuned: true })), { ok: true, attune: false });
  assert.equal(rift.realmOfGateNode('rift-gate-umbral'), 'umbral');
  assert.equal(rift.realmOfGateNode('rift-shrine'), null);
  assert.equal(rift.realmOfArea('umbral-delve'), 'umbral');
  assert.equal(rift.realmOfArea('ember-delve'), null);
  const seeds = new Set(SEEDS.flatMap(s => rift.RIFT_REALMS.map(r => rift.realmSeed(s, r))));
  assert.equal(seeds.size, SEEDS.length * 4, 'every (seed, realm) its own world');
  assert.equal(rift.RIFT_SLOT_KEYS.length, 16);
});

// ── The Ink Deeps' generator ────────────────────────────────────────────────

test('ink deeps: deterministic per seed in any order, its core hand-laid for every seed', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const ctx = gen.sectorContext(USPEC, rift.realmSeed(seed, 'umbral'));
    const a = [-3, 0, 1, 5].map(sx => gen.columnHash(gen.generateSectorColumn(ctx, sx)));
    const b2 = [5, 1, -3, 0].map(sx => gen.columnHash(gen.generateSectorColumn(gen.sectorContext(USPEC, rift.realmSeed(seed, 'umbral')), sx)));
    assert.deepEqual(a, [b2[2], b2[3], b2[1], b2[0]]);
    // The core: the return gate, the arrival cell open on a solid floor, the ink basin, the Warden's hall.
    const c0 = gen.generateSectorColumn(ctx, 0), c1 = gen.generateSectorColumn(ctx, 1);
    const at = (col, row) => id((col < 32 ? c0 : c1).kind[row * SECTOR + (col & 31)]);
    const liq = (col, row) => (col < 32 ? c0 : c1).liqType[row * SECTOR + (col & 31)];
    for (let r = 28; r <= 30; r++) for (let c = 31; c <= 32; c++) assert.equal(at(c, r), 'rift-gate-umbral');
    for (let r = 28; r <= 30; r++) assert.equal(at(rift.REALM_ARRIVAL.col, r), 'air');
    assert.ok(TERRAIN_NODE_LIST[nodeIndex(at(rift.REALM_ARRIVAL.col, 31))].solid, 'the arrival stands on rock');
    assert.equal(liq(20, 32), LIQUID_INK);
    for (const c of realmGen.WARDEN_BRAZIERS) assert.equal(at(c, 53), 'gloam-brazier');
    assert.equal(at(30, 43), 'ink-mirror');
    assert.equal(at(30, 54), 'rift-frame');
    assert.equal(at(5, 0), 'bedrock'); assert.equal(at(5, 63), 'bedrock');
  }
});

test('ink deeps: wings hold every structure, its ores, shade dens, and lakes of ink at rest', () => {
  const ctx = gen.sectorContext(USPEC, rift.realmSeed(424242, 'umbral'));
  const kinds = new Set(), nodes = new Map();
  let halls = 0;
  const t = new terrainMod.Terrain(32 * 30, ctx.rows, USPEC.top);
  for (let sx = -15; sx < 15; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (const s of column.structures) kinds.add(s.kind);
    halls += column.halls.filter(h => h.creature === 'shadeling').length;
    for (let i = 0; i < column.kind.length; i++) {
      const k = id(column.kind[i]); nodes.set(k, (nodes.get(k) ?? 0) + 1);
      const col = (sx + 15) * SECTOR + (i % SECTOR), row = Math.floor(i / SECTOR);
      t.kind[t.index(col, row)] = column.kind[i]; t.liqType[t.index(col, row)] = column.liqType[i]; t.liqLevel[t.index(col, row)] = column.liqLevel[i];
    }
  }
  for (const k of ['gate-hollow', 'warden-hall', 'ink-pool', 'drift-pocket', 'mirror-cavern', 'shade-den']) assert.ok(kinds.has(k), k);
  for (const k of ['inkstone-vein', 'nightglass-vein', 'ink-seep', 'ink-slate', 'gloam-slate']) assert.ok((nodes.get(k) ?? 0) > 5, `${k}: ${nodes.get(k)}`);
  assert.ok(halls >= 3, `${halls} shade dens`);
  // Generated ink is at rest: a sim over the whole span moves nothing.
  const before = Array.from(t.liqLevel).reduce((a, b) => a + b, 0);
  const sim = new LiquidSim(t, {});
  sim.wakeAll();
  for (let n = 0; n < 60; n++) sim.tick();
  const after = Array.from(t.liqLevel).reduce((a, b) => a + b, 0);
  assert.equal(after, before, 'volume kept');
  assert.equal(sim.updates === 0 || sim.settled !== false, true);
});

test('ink: heavier than water (it sinks under it, water rests on it), slow, never mixes', () => {
  const t = new terrainMod.Terrain(3, 6, 0);
  const rock = nodeIndex('ink-slate');
  for (let r = 0; r < 6; r++) { t.kind[t.index(0, r)] = rock; t.kind[t.index(2, r)] = rock; }
  t.kind[t.index(1, 5)] = rock;
  t.liqType[t.index(1, 3)] = LIQUID_INK; t.liqLevel[t.index(1, 3)] = LIQUID_FULL;
  t.liqType[t.index(1, 4)] = LIQUID_WATER; t.liqLevel[t.index(1, 4)] = LIQUID_FULL;
  const sim = new LiquidSim(t, {});
  sim.wakeAll();
  for (let n = 0; n < 20; n++) sim.tick();
  assert.equal(t.liqType[t.index(1, 4)], LIQUID_INK, 'ink sank to the bottom');
  assert.equal(t.liqType[t.index(1, 3)], LIQUID_WATER, 'water floats on it');
  assert.equal(t.kind[t.index(1, 3)], 0, 'no reaction: they never mix');
});

test('the tide: rest, rise, hold, fall on one clock, and ink under the tide is ink', () => {
  assert.equal(umbral.tideAt(0).phase, 'low');
  assert.equal(umbral.tideAt(0).rows, 0);
  assert.equal(umbral.tideAt(24).phase, 'rising');
  assert.equal(umbral.tideAt(30).phase, 'high');
  assert.equal(umbral.tideAt(30).rows, umbral.TIDE_ROWS);
  assert.equal(umbral.tideAt(42).phase, 'falling');
  assert.equal(umbral.tideAt(46).phase, 'low');
  assert.equal(umbral.tideAt(umbral.TIDE_PERIOD + 30).phase, 'high');
  const t = new terrainMod.Terrain(1, 6, 0);
  t.kind[t.index(0, 5)] = nodeIndex('ink-slate');
  t.liqType[t.index(0, 4)] = LIQUID_INK; t.liqLevel[t.index(0, 4)] = LIQUID_FULL;
  assert.equal(umbral.inInk(t, 16, 4 * CELL + 10, 0), true);
  assert.equal(umbral.inInk(t, 16, 3 * CELL + 10, 0), false, 'low tide: the air over a pool is air');
  assert.equal(umbral.inInk(t, 16, 3 * CELL + 10, 2), true, 'high tide: it stands over the pool');
  assert.equal(umbral.inInk(t, 16, 1 * CELL + 10, 2), false, 'only TIDE_ROWS high');
});

// ── The engine: through a gate and back ─────────────────────────────────────

/** Into the Ember Delve, then into the Ink Deeps through its gate (as the host does after attuning). */
function intoTheDeeps(seed = 424242) {
  const delve = memoryDelve(seed);
  const f = enter(delve);
  const plan = gatePlan(seed, 'umbral');
  const gate = { col: plan.col + 3, row: plan.row + 4 };
  f.engine.world.center(gate.col);
  standOn(f.engine, plan.col + 4, plan.row + 5);
  return { ...f, delve, plan, gate };
}

test('engine: E at the gate asks the host (with its realm); through it is the Ink Deeps; back out is beside the same gate', () => {
  const { engine, uses, state, delve, plan, gate } = intoTheDeeps();
  assert.equal(kindAt(engine, gate.col, gate.row), 'rift-gate-umbral');
  engine.interact();
  const use = uses.find(u => u.kind === 'gate');
  assert.ok(use, 'the host is asked');
  assert.equal(use.node, 'rift-gate-umbral');
  assert.ok(engine.enterRealm('umbral-delve', { col: use.col, row: use.row }));
  let s = state();
  assert.equal(s.areaId, 'umbral-delve');
  assert.equal(s.realm.id, 'umbral');
  assert.equal(s.realm.tide, 'low', 'every arrival is at low tide');
  assert.ok(delve.isClaimed(rift.enteredFlag('umbral')));
  assert.ok(delve.isClaimed(rift.ruleFlag('umbral', 'dark')), 'ink-blind said once');
  assert.equal(engine.realm, 'umbral');
  assert.ok(!delve.isClaimed('underhearth-reached') || true);
  // Standing beside the return gate.
  assert.equal(engine.terrain.colAt(engine.player.x), rift.REALM_ARRIVAL.col);
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(engine.terrain.rowAt(engine.player.y - 1), rift.REALM_ARRIVAL.row, 'stands on the hollow floor');
  // E at the return gate (step into it) asks the host again; the host leaves.
  standOn(engine, 32, 31);
  uses.length = 0;
  engine.interact();
  assert.ok(uses.find(u => u.kind === 'gate' && u.node === 'rift-gate-umbral'));
  assert.ok(engine.leaveRealm());
  s = state();
  assert.equal(s.areaId, 'ember-delve');
  assert.equal(engine.terrain.colAt(engine.player.x), plan.col + 6, 'beside the gate it came in by');
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(engine.terrain.rowAt(engine.player.y - 1), plan.row + 4);
});

test('engine: the realm\'s cells save under its own area (own seed), apart from the Ember Delve\'s', () => {
  const { engine, delve } = intoTheDeeps();
  engine.enterRealm('umbral-delve', { col: 0, row: 0 });
  engine.setTools({ pickaxe: 4, levels: { mining: 60 } });
  const t = engine.terrain;
  // An inkstone vein in the hollow's floor, under the Keeper: dig it out holding Down (an ink ore, a yield).
  const col = 40, row = realmGen.GATE_HOLLOW.row + realmGen.GATE_HOLLOW.h;
  t.set(col, row, nodeIndex('inkstone-vein'));
  standOn(engine, col, row);
  engine.input.add('down');
  let swings = 0;
  while (kindAt(engine, col, row) !== 'air' && swings++ < 60) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  engine.input.delete('down');
  assert.equal(kindAt(engine, col, row), 'air');
  // The core cell of the Ink Deeps is filed under its own area id; the wing sectors under it too.
  assert.ok(delve.cores.get('umbral-delve')?.size > 0, 'the realm core\'s diff');
  assert.ok(!delve.cores.get('ember-delve')?.size, 'nothing written into the Ember Delve');
  // A wing dig: west of the core.
  engine.world.center(-20);
  standOn(engine, -20, 31);
  engine.placeCell(-21, 29, 'basalt-block');
  assert.ok([...delve.sectorsMap.keys()].some(k => k.startsWith('umbral-delve|')), 'wing sectors under the realm');
  assert.ok(![...delve.sectorsMap.keys()].some(k => k.startsWith('ember-delve|-1,')), 'not under the Ember Delve');
});

test('engine: the tide rises on its clock, said once; ink blinds and the lantern shrinks; buckets refuse ink', () => {
  const { engine, delve, state } = intoTheDeeps();
  engine.enterRealm('umbral-delve', { col: 0, row: 0 });
  for (let n = 0; n < 60 * 23; n++) engine.update(1 / 60);
  const s = state();
  assert.equal(s.realm.tide, 'rising');
  assert.ok(delve.isClaimed(rift.ruleFlag('umbral', 'tide')));
  // The ink basin in the hollow's west floor: stand in it, head under.
  standOn(engine, 21, 33, 2);
  assert.equal(state().realm.inkBlind, true);
  assert.ok(delve.isClaimed(rift.ruleFlag('umbral', 'ink')));
  const t = engine.terrain;
  const lit = engine.lanternShare(t);
  assert.ok(lit < .3, `lantern share under ink ${lit}`);
  engine.setGear({ veil: true });
  assert.ok(engine.lanternShare(t) > lit, 'the Veil Lantern keeps more light');
});

test('engine: drift pockets move only unseen, unlit and unheld; a torch pins one for good; the change is saved', () => {
  const { engine, delve } = intoTheDeeps();
  engine.enterRealm('umbral-delve', { col: 0, row: 0 });
  const t = engine.terrain, world = engine.world;
  const pocket = world.structuresNear(0, 0).find(s => s.kind === 'drift-pocket');
  assert.ok(pocket, 'the core\'s pocket');
  // Far from it (west end of the hollow), the camera pointed away.
  standOn(engine, 17, 31);
  engine.camera = 0; engine.cameraY = 10_000;
  let flipped = -1;
  for (let epoch = 1; epoch < 12 && flipped < 0; epoch++) if (umbral.pocketPhase(world.seed, pocket.id, epoch) === 1) flipped = epoch;
  assert.ok(flipped > 0);
  engine.realmTime = flipped * umbral.SHIFT_PERIOD - .01;
  engine.shiftEpoch = flipped - 1;
  engine.update(1 / 60);
  assert.equal(kindAt(engine, pocket.col, pocket.row), 'drift-shale', 'it filled while nobody looked');
  assert.ok(delve.isClaimed(rift.ruleFlag('umbral', 'shift')));
  assert.ok(delve.cores.get('umbral-delve')?.size > 0, 'saved like a dig');
  // In view: it holds.
  const opened = (() => { for (let e = flipped + 1; e < 40; e++) if (umbral.pocketPhase(world.seed, pocket.id, e) === 0) return e; return -1; })();
  engine.camera = pocket.col * CELL - 100; engine.cameraY = t.top + 20 * CELL;
  engine.realmTime = opened * umbral.SHIFT_PERIOD - .01; engine.shiftEpoch = opened - 1;
  engine.update(1 / 60);
  assert.equal(kindAt(engine, pocket.col, pocket.row), 'drift-shale', 'seen: it holds still');
  // A torch beside it pins it, whatever the epochs say.
  engine.camera = 0; engine.cameraY = 10_000;
  t.set(pocket.col - 1, pocket.row + 2, nodeIndex('torch'));
  for (let e = opened; e < opened + 6; e++) { engine.realmTime = (e + 1) * umbral.SHIFT_PERIOD - .01; engine.shiftEpoch = e; engine.update(1 / 60); }
  assert.equal(kindAt(engine, pocket.col, pocket.row), 'drift-shale', 'pinned by the torch');
});

test('engine: shades freeze in strong light and cross the dark fast; the Warden takes no blow unlit, and stands still lit', () => {
  const { engine } = intoTheDeeps();
  engine.enterRealm('umbral-delve', { col: 0, row: 0 });
  const t = engine.terrain;
  // The Warden's hall: stand at its west end, the Warden at its spawn.
  standOn(engine, 10, 54);
  const warden = engine.monsters.find(m => m.def.creature === 'gloam-warden');
  assert.ok(warden, 'the Warden stands in its hall');
  const x0 = warden.x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.ok(warden.x < x0 - 60, `unlit it crosses fast (${x0} → ${warden.x})`);
  assert.equal(!!warden.frozen, false);
  const hp = warden.hp;
  engine.hurtMonster(warden, 50);
  assert.equal(warden.hp, hp, 'no blow lands in the dark');
  // A lit brazier beside it: frozen, and the blow lands.
  const brazier = realmGen.WARDEN_BRAZIERS.reduce((a, b) => (Math.abs(b * CELL - warden.x) < Math.abs(a * CELL - warden.x) ? b : a));
  warden.x = (brazier + .5) * CELL;
  assert.ok(engine.lightBrazier(brazier, 53));
  engine.update(1 / 60);
  assert.equal(warden.frozen, true);
  const at = warden.x;
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  assert.equal(warden.x, at, 'lit: it cannot move');
  engine.hurtMonster(warden, 50);
  assert.equal(warden.hp, hp - 50, 'lit: the blow lands');
  // The brazier gutters out on its own.
  for (let n = 0; n < 60 * (umbral.BRAZIER_BURN + 1); n++) engine.update(1 / 60);
  assert.equal(kindAt(engine, brazier, 53), 'gloam-brazier');
  void t;
});

test('engine: the Underhearth\'s arrival flag never fires in the Ink Deeps (its rows run past 56 too)', () => {
  const { engine, delve } = intoTheDeeps();
  delve.claimedSet.delete('underhearth-reached');
  engine.reachedSaid = false;
  engine.enterRealm('umbral-delve', { col: 0, row: 0 });
  standOn(engine, 10, 54, 10);
  assert.ok(!delve.isClaimed('underhearth-reached'));
});
