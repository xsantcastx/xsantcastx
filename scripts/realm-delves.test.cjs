// The Root Deeps (the Verdant's underside) and the Prism Mines (the Luminous's):
// their generators, their broken rules as pure functions (regrowth, solid light),
// and the engine walking through each gate, living the rule and back out.
// Same loader as rift-gates.test.cjs.
//
//   node --test scripts/realm-delves.test.cjs
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
const kit = load('play/engine/realm-kit.ts');
const vgen = load('play/engine/verdant-gen.ts');
const lgen = load('play/engine/luminous-gen.ts');
const verdant = load('play/engine/verdant.ts');
const luminous = load('play/engine/luminous.ts');
const region = load('shared/delve/delve-region.model.ts');
const rift = load('shared/delve/rift-gates.model.ts');
const towns = load('play/world/towns/infernal.ts');
const vtown = load('play/world/towns/verdant-delve.ts');
const ltown = load('play/world/towns/luminous-delve.ts');
const SPEC = towns.EMBER_DELVE.terrain;
const VSPEC = vtown.VERDANT_DELVE.terrain;
const LSPEC = ltown.LUMINOUS_DELVE.terrain;
const { CELL, nodeIndex, TERRAIN_NODE_LIST } = terrainMod;
const { SECTOR } = gen;
const id = kind => TERRAIN_NODE_LIST[kind].id;
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];
const plain = value => JSON.parse(JSON.stringify(value));

/** A Delve persistence that keeps each area's sectors apart (as the save service does). */
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
function fixture(delve) {
  let state;
  const uses = [];
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot: () => true, onWorldAction: () => true, onUse: e => uses.push(e), onState: value => { state = value; }, delve });
  return { engine, uses, state: () => { engine.report(); return state; } };
}
function standOn(engine, col, floorRow, steps = 4) {
  engine.player.x = (col + .5) * CELL; engine.player.y = engine.terrain.top + floorRow * CELL; engine.player.vy = 0; engine.player.grounded = true;
  for (let n = 0; n < steps; n++) engine.update(1 / 60);
}
const kindAt = (engine, col, row) => id(engine.terrain.kind[engine.terrain.index(col, row)]);
function run(engine, seconds) { for (let n = 0; n < Math.round(seconds * 60); n++) engine.update(1 / 60); }
/** The Ember Delve's gate chamber of a realm for a seed (a stratum gate: sector-gen's lattice plans). */
function gatePlan(seed, realm) {
  const ctx = gen.sectorContext(SPEC, seed);
  return gen.latticePlans(ctx, rift.RIFT_GATES[realm].place.cell).find(p => p.kind === 'rift-gate');
}
/** Into the Ember Delve, beside a realm's gate, then through it (as the host does after attuning). */
function through(realm, seed = 424242) {
  const delve = memoryDelve(seed);
  const f = fixture(delve);
  const shaft = f.engine.places.find(station => station.id === 'delve');
  f.engine.player.x = shaft.x; f.engine.player.y = 610; f.engine.interact();
  assert.equal(f.state().areaId, 'ember-delve');
  const plan = gatePlan(seed, realm);
  f.engine.world.center(plan.col + 3);
  standOn(f.engine, plan.col + 4, plan.row + 5);
  assert.equal(kindAt(f.engine, plan.col + 3, plan.row + 4), rift.RIFT_GATES[realm].node);
  f.uses.length = 0;
  f.engine.interact();
  const use = f.uses.find(u => u.kind === 'gate');
  assert.ok(use, 'E at the gate asks the host');
  assert.equal(use.node, rift.RIFT_GATES[realm].node);
  assert.ok(f.engine.enterRealm(rift.RIFT_GATES[realm].area, { col: use.col, row: use.row }));
  return { ...f, delve, plan };
}
/** Read a generated core: (col,row) → node id, liquid. */
function core(spec, realm, seed) {
  const ctx = gen.sectorContext(spec, rift.realmSeed(seed, realm));
  const c0 = gen.generateSectorColumn(ctx, 0), c1 = gen.generateSectorColumn(ctx, 1);
  return (col, row) => id((col < 32 ? c0 : c1).kind[row * SECTOR + (col & 31)]);
}

// ── The model ───────────────────────────────────────────────────────────────

test('model: the Verdant and Luminous gates are open, each with its area, sigil and Delving level', () => {
  for (const realm of ['verdant', 'luminous']) {
    const g = rift.RIFT_GATES[realm];
    assert.equal(g.open, true);
    assert.equal(rift.realmOfArea(g.area), realm);
    assert.deepEqual(plain(rift.attuneCheck(realm, { delving: g.delving - 1, sigils: 1, attuned: false })), { ok: false, why: 'delving', need: g.delving });
    assert.deepEqual(plain(rift.attuneCheck(realm, { delving: g.delving, sigils: 0, attuned: false })), { ok: false, why: 'sigil', sigil: g.sigil });
    assert.deepEqual(plain(rift.attuneCheck(realm, { delving: g.delving, sigils: 1, attuned: false })), { ok: true, attune: true });
  }
  assert.deepEqual(plain(rift.attuneCheck('celestial', { delving: 99, sigils: 9, attuned: false })), { ok: false, why: 'settling' });
  assert.equal(rift.RIFT_GATES.verdant.sigil, rift.VERDANT_SIGIL);
  assert.equal(rift.RIFT_GATES.luminous.sigil, rift.LUMINOUS_SIGIL);
});

// ── The Root Deeps' generator ───────────────────────────────────────────────

test('root deeps: deterministic per seed in any order; the core is hand-laid for every seed', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const ctx = () => gen.sectorContext(VSPEC, rift.realmSeed(seed, 'verdant'));
    const a = [-3, 0, 1, 5].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    const b = [5, 1, -3, 0].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    assert.deepEqual(a, [b[2], b[3], b[1], b[0]]);
    const at = core(VSPEC, 'verdant', seed);
    for (let r = 28; r <= 30; r++) for (let c = 31; c <= 32; c++) assert.equal(at(c, r), 'rift-gate-verdant');
    for (let r = 28; r <= 30; r++) assert.equal(at(rift.REALM_ARRIVAL.col, r), 'air');
    assert.ok(TERRAIN_NODE_LIST[nodeIndex(at(rift.REALM_ARRIVAL.col, 31))].solid, 'the arrival stands on wood');
    for (let r = 28; r <= 30; r++) assert.equal(at(kit.CORE_SEAM.col, r), 'rootglass-vein', 'the first swing finds rootglass');
    for (let r = 28; r <= 30; r++) assert.equal(at(vgen.ROOT_CHOKE.col, r), 'rootwood', 'the root choke across the east tunnel');
    for (let r = kit.CORE_SHAFT.row; r < kit.CORE_SHAFT.row + kit.CORE_SHAFT.h; r++) assert.equal(at(kit.CORE_SHAFT.col, r), 'living-vine', `vine shaft row ${r}`);
    for (const c of vgen.HEART_ROOTS) { assert.equal(at(c, 53), 'heart-root'); assert.equal(at(c, 52), 'heart-root'); }
    assert.equal(at(30, 54), 'rift-frame', 'the Graftmother\'s floor does not break');
    assert.equal(at(5, 0), 'bedrock'); assert.equal(at(5, 63), 'bedrock');
  }
});

test('root deeps: wings hold every structure, its ores, pods, vines and graftling warrens', () => {
  const ctx = gen.sectorContext(VSPEC, rift.realmSeed(424242, 'verdant'));
  const kinds = new Set(), nodes = new Map();
  let halls = 0;
  for (let sx = -15; sx < 15; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (const s of column.structures) kinds.add(s.kind);
    halls += column.halls.filter(h => h.creature === 'graftling').length;
    for (const k of column.kind) nodes.set(id(k), (nodes.get(id(k)) ?? 0) + 1);
  }
  for (const k of ['gate-hollow', 'graft-hall', 'spore-hollow', 'vine-shaft', 'graft-warren']) assert.ok(kinds.has(k), k);
  for (const k of ['rootwood', 'heartwood', 'rootglass-vein', 'heart-amber-vein', 'spore-pod', 'living-vine']) assert.ok((nodes.get(k) ?? 0) > 5, `${k}: ${nodes.get(k)}`);
  assert.ok(halls >= 3, `${halls} warrens`);
});

// ── The Prism Mines' generator ──────────────────────────────────────────────

test('prism mines: deterministic per seed; the core\'s crossing, its sun shaft and the Hollow Sun\'s mirror for every seed', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const ctx = () => gen.sectorContext(LSPEC, rift.realmSeed(seed, 'luminous'));
    const a = [-3, 0, 1, 5].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    const b = [5, 1, -3, 0].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    assert.deepEqual(a, [b[2], b[3], b[1], b[0]]);
    const at = core(LSPEC, 'luminous', seed);
    for (let r = 28; r <= 30; r++) for (let c = 31; c <= 32; c++) assert.equal(at(c, r), 'rift-gate-luminous');
    for (let r = 28; r <= 30; r++) assert.equal(at(kit.CORE_SEAM.col, r), 'prismite-vein');
    const X = lgen.CROSSING;
    assert.equal(at(X.sun.col, X.sun.row), 'sun-prism');
    assert.equal(at(X.mirror.col, X.mirror.row), 'prism-mirror-a', 'generated turned into the rock: no bridge yet');
    for (let c = X.pit.col; c < X.pit.col + X.pit.w; c++) { assert.equal(at(c, 31), 'air'); assert.equal(at(c, 32), 'air'); assert.ok(TERRAIN_NODE_LIST[nodeIndex(at(c, 33))].solid); }
    assert.ok(TERRAIN_NODE_LIST[nodeIndex(at(X.pit.col + X.pit.w, 31))].solid, 'the far lip');
    assert.equal(at(lgen.HALL_SUN.col, lgen.HALL_SUN.row), 'sun-prism');
    for (let r = 31; r <= 43; r++) assert.equal(at(lgen.HALL_SUN.col, r), 'air', `the shaft, row ${r}`);
    assert.equal(at(lgen.HALL_MIRROR.col, lgen.HALL_MIRROR.row), 'prism-mirror-a');
    assert.equal(at(30, 54), 'rift-frame');
  }
});

test('prism mines: wings hold sunwells, shadow halls over pits, prism galleries, ores and blooms', () => {
  const ctx = gen.sectorContext(LSPEC, rift.realmSeed(424242, 'luminous'));
  const kinds = new Set(), nodes = new Map();
  let halls = 0;
  for (let sx = -15; sx < 15; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (const s of column.structures) kinds.add(s.kind);
    halls += column.halls.filter(h => h.creature === 'prismling').length;
    for (const k of column.kind) nodes.set(id(k), (nodes.get(id(k)) ?? 0) + 1);
  }
  for (const k of ['gate-hollow', 'prism-hall', 'sunwell', 'shadow-hall', 'prism-gallery']) assert.ok(kinds.has(k), k);
  for (const k of ['prism-stone', 'dawnstone', 'prismite-vein', 'dawnglass-vein', 'prism-bloom', 'sun-prism', 'umbra-pane']) assert.ok((nodes.get(k) ?? 0) > 3, `${k}: ${nodes.get(k)}`);
  assert.ok(halls >= 3, `${halls} galleries`);
});

// ── Solid light, pure ───────────────────────────────────────────────────────

test('solid light: a sun-prism shines down as a shaft; a mirror turns it into a bridge; turned back, the bridge goes', () => {
  // A 10 × 8 room: a sun in the roof at col 2, a mirror on the floor line at row 5, a pit east of it.
  const t = new terrainMod.Terrain(10, 8, 0);
  const rock = nodeIndex('prism-stone'), K = luminous.K;
  for (let c = 0; c < 10; c++) { t.kind[t.index(c, 0)] = rock; t.kind[t.index(c, 7)] = rock; }
  for (let r = 0; r < 8; r++) { t.kind[t.index(0, r)] = rock; t.kind[t.index(9, r)] = rock; }
  t.kind[t.index(2, 0)] = K.sun;
  t.kind[t.index(1, 5)] = rock;
  t.kind[t.index(2, 5)] = K.mirrorA;
  const w = { c0: 0, c1: 9, r0: 0, r1: 7 };
  const lay = () => { const lit = new Map(); luminous.traceBeams(t, w, lit); luminous.lightPanes(t, w, null, lit); luminous.applyLight(t, w, lit); return lit; };
  lay();
  for (let r = 1; r <= 4; r++) assert.equal(t.kind[t.index(2, r)], K.shaft, `shaft row ${r}`);
  for (let c = 3; c <= 8; c++) assert.equal(t.kind[t.index(c, 5)], 0, '"/" sends it west, into the rock: no bridge');
  assert.ok(TERRAIN_NODE_LIST[K.shaft].climb && TERRAIN_NODE_LIST[K.shaft].oneWay, 'a shaft is a ladder of light');
  t.kind[t.index(2, 5)] = luminous.turned(K.mirrorA);
  lay();
  for (let c = 3; c <= 8; c++) assert.equal(t.kind[t.index(c, 5)], K.bridge, `bridge col ${c}`);
  assert.ok(TERRAIN_NODE_LIST[K.bridge].oneWay && !TERRAIN_NODE_LIST[K.bridge].solid, 'a bridge is a floor you can drop through');
  t.kind[t.index(2, 5)] = K.mirrorA;
  lay();
  for (let c = 3; c <= 8; c++) assert.equal(t.kind[t.index(c, 5)], 0, 'turned back: the bridge is gone');
  // A placed block stops a beam; a liquid too.
  t.kind[t.index(2, 3)] = nodeIndex('basalt-block');
  lay();
  assert.equal(t.kind[t.index(2, 4)], 0, 'nothing below a block');
  assert.equal(luminous.unlit(K.bridge), 0); assert.equal(luminous.unlit(K.lit), K.pane);
});

test('solid light: shadow glass is a floor only under light (a placed torch, a beam, the Dawn Lens)', () => {
  const t = new terrainMod.Terrain(14, 6, 0);
  const K = luminous.K;
  for (let c = 0; c < 14; c++) t.kind[t.index(c, 4)] = K.pane;
  const w = { c0: 0, c1: 13, r0: 0, r1: 5 };
  const lay = lens => { const lit = new Map(); luminous.lightPanes(t, w, lens, lit); luminous.applyLight(t, w, lit); };
  lay(null);
  for (let c = 0; c < 14; c++) assert.equal(t.kind[t.index(c, 4)], K.pane, 'dark glass: a hole');
  assert.ok(!TERRAIN_NODE_LIST[K.pane].solid && !TERRAIN_NODE_LIST[K.pane].oneWay);
  t.kind[t.index(2, 3)] = nodeIndex('torch');
  lay(null);
  for (let c = 0; c <= 2 + luminous.PANE_LIGHT; c++) assert.equal(t.kind[t.index(c, 4)], K.lit, `lit by the torch, col ${c}`);
  assert.equal(t.kind[t.index(2 + luminous.PANE_LIGHT + 1, 4)], K.pane, 'past its reach: dark');
  assert.ok(TERRAIN_NODE_LIST[K.lit].oneWay, 'lit glass is a floor');
  t.kind[t.index(2, 3)] = 0;
  lay({ col: 11, row: 4 });
  assert.equal(t.kind[t.index(2, 4)], K.pane, 'the torch taken back: dark again');
  for (let c = 11 - luminous.LENS_CELLS; c <= 13; c++) assert.equal(t.kind[t.index(c, 4)], K.lit, `the Dawn Lens lights the glass under the Keeper, col ${c}`);
});

// ── Regrowth, pure ──────────────────────────────────────────────────────────

test('regrowth: living wood grows back as itself (ore as the wood round it); fire, supports and anything placed beside hold a hole', () => {
  const N = nodeIndex;
  assert.equal(verdant.regrowsAs(N('rootwood')), N('rootwood'));
  assert.equal(verdant.regrowsAs(N('rootglass-vein')), N('rootwood'), 'ore does not come back as ore');
  assert.equal(verdant.regrowsAs(N('heart-amber-vein')), N('heartwood'));
  assert.equal(verdant.regrowsAs(N('heart-root')), N('heart-root'));
  assert.equal(verdant.regrowsAs(N('hard-rock')), -1, 'the Ember Delve\'s rock stays dug');
  assert.equal(verdant.isAlive(N('spore-pod')), true);
  assert.equal(verdant.isAlive(N('rootwood')), false);
  const t = new terrainMod.Terrain(20, 10, 0);
  assert.equal(verdant.heldOpen(t, 10, 5), null);
  t.kind[t.index(12, 5)] = N('torch');
  assert.equal(verdant.heldOpen(t, 10, 5), 'burnt', 'a torch two cells off burns the roots back');
  assert.equal(verdant.heldOpen(t, 6, 5), null, 'but not four');
  t.kind[t.index(12, 5)] = 0;
  t.kind[t.index(14, 5)] = N('timber-support');
  assert.equal(verdant.heldOpen(t, 11, 5), 'held', 'inside a support\'s reach');
  t.kind[t.index(14, 5)] = 0;
  t.kind[t.index(11, 6)] = N('ladder');
  assert.equal(verdant.heldOpen(t, 10, 5), 'held', 'anything placed right beside');
  assert.equal(verdant.regrowProgress({ at: 0 }, verdant.REGROW_DELAY / 2), .5);
  assert.equal(verdant.reaching({ at: 0 }, verdant.REGROW_DELAY - verdant.REGROW_WARN - 1), false);
  assert.equal(verdant.reaching({ at: 0 }, verdant.REGROW_DELAY - 1), true);
});

// ── The engine: the Root Deeps ──────────────────────────────────────────────

test('engine: through the Verdant gate into the Root Deeps; a dug ore grows back as wood, said once; back out beside the gate', () => {
  const { engine, delve, state, plan, uses } = through('verdant');
  let s = state();
  assert.equal(s.areaId, 'verdant-delve');
  assert.equal(s.realm.id, 'verdant');
  assert.equal(engine.realm, 'verdant');
  assert.ok(delve.isClaimed(rift.enteredFlag('verdant')));
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'roots')), 'the arrival line, once');
  run(engine, .5);
  assert.equal(engine.terrain.rowAt(engine.player.y - 1), rift.REALM_ARRIVAL.row, 'stands on the hollow floor');
  // Mine the rootglass outcrop from the west.
  engine.setTools({ pickaxe: 4, levels: { mining: 60 } });
  const seam = kit.CORE_SEAM;
  standOn(engine, seam.col - 1, 31);
  engine.facing = 1;
  let swings = 0;
  while (kindAt(engine, seam.col, 29) !== 'air' && swings++ < 80) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  assert.equal(kindAt(engine, seam.col, 29), 'air');
  s = state();
  assert.ok(s.realm.regrowing >= 1, `holes waiting: ${s.realm.regrowing}`);
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'regrow')), 'Glim says the rule the first time it applies');
  run(engine, verdant.REGROW_DELAY + 1);
  assert.equal(kindAt(engine, seam.col, 29), 'rootwood', 'the hole grew back as wood (not ore)');
  s = state();
  assert.ok(s.realm.regrown >= 1);
  assert.equal(s.realm.regrowing, 0);
  // Saved like a dig: the core diff holds the wood, so a reload shows it as it was left.
  assert.ok(delve.cores.get('verdant-delve')?.size > 0);
  // Back out through the return gate.
  standOn(engine, 32, 31);
  uses.length = 0;
  engine.interact();
  assert.ok(uses.find(u => u.kind === 'gate' && u.node === 'rift-gate-verdant'));
  assert.ok(engine.leaveRealm());
  assert.equal(state().areaId, 'ember-delve');
  assert.equal(engine.terrain.colAt(engine.player.x), plan.col + 6, 'beside the gate it came in by');
});

test('engine: a torch beside the hole burns the roots back; a billhook cuts clean; it never grows on the Keeper', () => {
  const { engine, delve } = through('verdant');
  engine.setTools({ pickaxe: 4, levels: { mining: 60 } });
  const t = engine.terrain, C = vgen.ROOT_CHOKE;
  // The root choke: dig its west column, a torch two cells west of it.
  standOn(engine, C.col - 1, 31);
  engine.facing = 1;
  let swings = 0;
  while (kindAt(engine, C.col, 29) !== 'air' && swings++ < 80) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  t.set(C.col - 2, 30, nodeIndex('torch'));
  standOn(engine, C.col - 4, 31);
  run(engine, verdant.REGROW_DELAY + 1);
  assert.equal(kindAt(engine, C.col, 29), 'air', 'burnt back: the hole stays');
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'burn')));
  // The billhook: the next column, cut clean.
  engine.setGear({ shears: true });
  standOn(engine, C.col, 31);
  swings = 0;
  while (kindAt(engine, C.col + 1, 29) !== 'air' && swings++ < 80) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  assert.equal(kindAt(engine, C.col + 1, 29), 'air');
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'cut')));
  engine.setGear({ shears: false });
  standOn(engine, C.col - 6, 31);
  run(engine, verdant.REGROW_DELAY + 1);
  assert.equal(kindAt(engine, C.col + 1, 29), 'air', 'cut clean: it does not grow back');
  // Dig the last column and stand in the hole: it waits for the Keeper to step out.
  standOn(engine, C.col + 1, 31);
  swings = 0;
  while (kindAt(engine, C.col + 2, 29) !== 'air' && swings++ < 80) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  standOn(engine, C.col + 2, 31);
  run(engine, verdant.REGROW_DELAY + 2);
  assert.equal(kindAt(engine, C.col + 2, 29), 'air', 'never grows on the Keeper');
  standOn(engine, C.col + 5, 31);
  run(engine, 1.5);
  assert.equal(kindAt(engine, C.col + 2, 29), 'rootwood', 'it closes once the Keeper steps out');
});

test('engine: a spore pod bursts underfoot and stings, and grows back; the Graftmother is held by her heart-roots', () => {
  const { engine, delve, state } = through('verdant');
  const t = engine.terrain;
  // The pods in the west tunnel's floor (verdant-gen.ts: cols 4 and 6, row 30).
  assert.equal(kindAt(engine, 4, 30), 'spore-pod');
  run(engine, 1.6); // past the arrival's grace
  const hp = engine.hp;
  standOn(engine, 4, 30, 2);
  assert.equal(kindAt(engine, 4, 30), 'air', 'it burst');
  assert.equal(engine.hp, hp - verdant.SPORE_STING);
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'spore')));
  assert.ok(!delve.cores.get('verdant-delve')?.has(t.index(4, 30)), 'a living part is never saved as gone');
  standOn(engine, 8, 31);
  run(engine, verdant.REGROW_DELAY + 1);
  assert.equal(kindAt(engine, 4, 30), 'spore-pod', 'it grew back');
  // The Graftmother's hall: down the vine shaft.
  standOn(engine, 20, 54);
  const boss = engine.monsters.find(m => m.def.creature === 'graftmother');
  assert.ok(boss, 'she stands in her hall');
  run(engine, .5);
  assert.equal(state().realm.heartRoots, vgen.HEART_ROOTS.length * 2);
  assert.ok(delve.isClaimed(rift.ruleFlag('verdant', 'graft')));
  const before = boss.hp;
  engine.hurtMonster(boss, 100);
  assert.equal(boss.hp, before - Math.round(100 * verdant.GRAFT_SHARE), 'a quarter of the blow while rooted');
  run(engine, 1);
  assert.ok(boss.hp > before - 25, 'she heals while rooted');
  // Cut every heart-root, burn each stump (a torch beside it).
  for (const c of vgen.HEART_ROOTS) { t.set(c, 53, 0); t.set(c, 52, 0); engine.recordCell(t, t.index(c, 53)); engine.recordCell(t, t.index(c, 52)); t.set(c + 1, 53, nodeIndex('torch')); }
  run(engine, .5);
  assert.equal(state().realm.heartRoots, 0);
  const hp2 = boss.hp;
  engine.hurtMonster(boss, 100);
  assert.equal(boss.hp, hp2 - 100, 'unrooted: the whole blow');
  run(engine, verdant.REGROW_DELAY + 1);
  for (const c of vgen.HEART_ROOTS) assert.equal(kindAt(engine, c, 53), 'air', 'burnt stumps stay cut');
});

// ── The engine: the Prism Mines ─────────────────────────────────────────────

test('engine: through the Luminous gate; the sun shines down as a ladder; turning the crossing\'s mirror lays a bridge you walk over', () => {
  const { engine, delve, state, plan, uses } = through('luminous');
  let s = state();
  assert.equal(s.areaId, 'luminous-delve');
  assert.equal(s.realm.id, 'luminous');
  assert.ok(delve.isClaimed(rift.ruleFlag('luminous', 'light')));
  run(engine, .3);
  const X = lgen.CROSSING;
  for (let r = X.sun.row + 1; r < X.mirror.row; r++) assert.equal(kindAt(engine, X.sun.col, r), 'light-shaft', `a ladder of light, row ${r}`);
  for (let r = 28; r <= 50; r++) assert.equal(kindAt(engine, lgen.HALL_SUN.col, r), 'light-shaft', `the west sun down the shaft, row ${r}`);
  for (let c = X.pit.col; c < X.pit.col + X.pit.w; c++) assert.equal(kindAt(engine, c, 31), 'air', 'no bridge yet');
  s = state();
  assert.ok(s.realm.beams >= 2 && s.realm.bridges > 10, `${s.realm.beams} beams, ${s.realm.bridges} cells of light`);
  // Stand on the lip and press E: the mirror under the feet turns.
  standOn(engine, X.mirror.col - 1, 31);
  engine.interact();
  assert.equal(kindAt(engine, X.mirror.col, X.mirror.row), 'prism-mirror-b');
  for (let c = X.pit.col; c < X.pit.col + X.pit.w; c++) assert.equal(kindAt(engine, c, 31), 'light-bridge', `bridge col ${c}`);
  assert.ok(delve.isClaimed(rift.ruleFlag('luminous', 'mirror')));
  assert.ok(delve.cores.get('luminous-delve')?.size > 0, 'the turned mirror is saved');
  assert.ok(![...(delve.cores.get('luminous-delve') ?? new Map()).values()].some(k => id(k) === 'light-bridge'), 'light is never saved');
  // Walk east across the pit on the light.
  engine.input.add('right');
  for (let n = 0; n < 240 && engine.terrain.colAt(engine.player.x) < X.pit.col + X.pit.w + 1; n++) engine.update(1 / 60);
  engine.input.delete('right');
  assert.ok(engine.terrain.colAt(engine.player.x) >= X.pit.col + X.pit.w, 'across');
  assert.equal(engine.terrain.rowAt(engine.player.y - 1), 30, 'never fell into the pit');
  assert.ok(delve.isClaimed(rift.ruleFlag('luminous', 'bridge')));
  // Back out through the gate.
  standOn(engine, 32, 31);
  uses.length = 0;
  engine.interact();
  assert.ok(uses.find(u => u.kind === 'gate' && u.node === 'rift-gate-luminous'));
  assert.ok(engine.leaveRealm());
  assert.equal(engine.terrain.colAt(engine.player.x), plan.col + 6);
});

test('engine: the Hollow Sun takes no blow while free; caught in the beam it stands still and the blow lands; its flare turns the mirror', () => {
  const { engine, delve } = through('luminous');
  const M = lgen.HALL_MIRROR;
  standOn(engine, 22, 54);
  const boss = engine.monsters.find(m => m.def.creature === 'hollow-sun');
  assert.ok(boss);
  run(engine, .3);
  assert.equal(!!boss.frozen, false, 'the beam goes west: free');
  const hp = boss.hp;
  engine.hurtMonster(boss, 60);
  assert.equal(boss.hp, hp, 'blows pass through it');
  assert.ok(delve.isClaimed(rift.ruleFlag('luminous', 'prism')));
  // Turn the hall's mirror: the beam crosses the hall at row 51.
  standOn(engine, M.col, 54);
  engine.interact();
  assert.equal(kindAt(engine, M.col, M.row), 'prism-mirror-b');
  boss.x = (M.col + 12.5) * CELL;
  run(engine, .3);
  assert.equal(boss.frozen, true, 'caught');
  const at = boss.x;
  run(engine, 1);
  assert.equal(boss.x, at, 'caught: it cannot move');
  engine.hurtMonster(boss, 60);
  assert.equal(boss.hp, hp - 60, 'caught: the blow lands');
  // The flare turns the mirror the wrong way, and the beam lets it go.
  engine.flareIn = .01;
  run(engine, .5);
  assert.equal(kindAt(engine, M.col, M.row), 'prism-mirror-a');
  assert.equal(!!boss.frozen, false);
});
