// The Orrery Wells (the Celestial's underside, behind the last Rift Gate): its
// generator, its broken rule as pure functions (fields, rings, star-wells, the
// up-step), the no-softlock promise over generated wings, and the engine
// walking through the gate, falling into the Turning Room's pit, turning the
// ring, walking the ceiling across, a star-well and the Orrery Key, the Fallen
// Ephemeris dropped into its own well, and back out. Same loader as
// realm-delves.test.cjs.
//
//   node --test scripts/celestial-delve.test.cjs
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
const cgen = load('play/engine/celestial-gen.ts');
const cel = load('play/engine/celestial.ts');
const region = load('shared/delve/delve-region.model.ts');
const rift = load('shared/delve/rift-gates.model.ts');
const towns = load('play/world/towns/infernal.ts');
const ctown = load('play/world/towns/celestial-delve.ts');
const SPEC = towns.EMBER_DELVE.terrain;
const CSPEC = ctown.CELESTIAL_DELVE.terrain;
const { CELL, nodeIndex, TERRAIN_NODE_LIST } = terrainMod;
const { SECTOR } = gen;
const id = kind => TERRAIN_NODE_LIST[kind].id;
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];
const plain = value => JSON.parse(JSON.stringify(value));
/** The Keeper's box in a Delve (engine.ts DELVE_BOX): 90 px tall, so it covers three rows standing. */
const BODY = { halfWidth: 13, height: 90 };

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
/** The row the Keeper's feet stand on (its floor), and the row its head is under (its ceiling). */
const feetRow = engine => engine.terrain.rowAt(engine.player.y - 1);
const headRow = engine => engine.terrain.rowAt(engine.player.y - BODY.height);
function walk(engine, dir, until, max = 600) {
  engine.input.add(dir);
  for (let n = 0; n < max && !until(); n++) engine.update(1 / 60);
  engine.input.delete(dir);
}
function gatePlan(seed, realm) {
  const ctx = gen.sectorContext(SPEC, seed);
  return gen.latticePlans(ctx, rift.RIFT_GATES[realm].place.cell).find(p => p.kind === 'rift-gate');
}
/** Into the Ember Delve, beside the Celestial gate, then through it (as the host does after attuning). */
function through(seed = 424242) {
  const delve = memoryDelve(seed);
  const f = fixture(delve);
  const shaft = f.engine.places.find(station => station.id === 'delve');
  f.engine.player.x = shaft.x; f.engine.player.y = 610; f.engine.interact();
  assert.equal(f.state().areaId, 'ember-delve');
  const plan = gatePlan(seed, 'celestial');
  f.engine.world.center(plan.col + 3);
  standOn(f.engine, plan.col + 4, plan.row + 5);
  assert.equal(kindAt(f.engine, plan.col + 3, plan.row + 4), 'rift-gate-celestial');
  f.uses.length = 0;
  f.engine.interact();
  const use = f.uses.find(u => u.kind === 'gate');
  assert.ok(use, 'E at the gate asks the host');
  assert.equal(use.node, 'rift-gate-celestial');
  assert.ok(f.engine.enterRealm('celestial-delve', { col: use.col, row: use.row }));
  return { ...f, delve, plan };
}
function core(seed) {
  const ctx = gen.sectorContext(CSPEC, rift.realmSeed(seed, 'celestial'));
  const c0 = gen.generateSectorColumn(ctx, 0), c1 = gen.generateSectorColumn(ctx, 1);
  return (col, row) => id((col < 32 ? c0 : c1).kind[row * SECTOR + (col & 31)]);
}
/** A plain Terrain holding generated sector columns sx0..sx1-1 (grid column 0 = world column sx0 * SECTOR). */
function strip(seed, sx0, sx1) {
  const ctx = gen.sectorContext(CSPEC, rift.realmSeed(seed, 'celestial'));
  const rows = CSPEC.rows, t = new terrainMod.Terrain((sx1 - sx0) * SECTOR, rows, 0);
  for (let sx = sx0; sx < sx1; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (let row = 0; row < rows; row++) for (let lc = 0; lc < SECTOR; lc++) t.kind[t.index((sx - sx0) * SECTOR + lc, row)] = column.kind[row * SECTOR + lc];
  }
  return t;
}
const solid = name => TERRAIN_NODE_LIST[nodeIndex(name)].solid;

// ── The model ───────────────────────────────────────────────────────────────

test('model: the Celestial gate is open, the last of the four; its area, sigil, Delving level and stacks', () => {
  for (const realm of rift.RIFT_REALMS) assert.equal(rift.RIFT_GATES[realm].open, true, `${realm} is open`);
  const g = rift.RIFT_GATES.celestial;
  assert.equal(g.area, 'celestial-delve');
  assert.equal(rift.realmOfArea('celestial-delve'), 'celestial');
  assert.equal(g.sigil, rift.CELESTIAL_SIGIL);
  assert.deepEqual(plain(rift.attuneCheck('celestial', { delving: g.delving - 1, sigils: 1, attuned: false })), { ok: false, why: 'delving', need: 36 });
  assert.deepEqual(plain(rift.attuneCheck('celestial', { delving: 36, sigils: 0, attuned: false })), { ok: false, why: 'sigil', sigil: 'celestial-sigil' });
  assert.deepEqual(plain(rift.attuneCheck('celestial', { delving: 36, sigils: 1, attuned: false })), { ok: true, attune: true });
  assert.ok(towns.INFERNAL_TOWN.hunts.some(h => h.id === 'celestial-delve'));
  assert.equal(CSPEC.rows, 64, 'the phone budget: 64 rows, like every realm Delve');
  assert.equal(CSPEC.realm, 'celestial');
});

// ── The generator ───────────────────────────────────────────────────────────

test('orrery wells: deterministic per seed in any order; the core is hand-laid for every seed', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const ctx = () => gen.sectorContext(CSPEC, rift.realmSeed(seed, 'celestial'));
    const a = [-3, 0, 1, 5].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    const b = [5, 1, -3, 0].map(sx => gen.columnHash(gen.generateSectorColumn(ctx(), sx)));
    assert.deepEqual(a, [b[2], b[3], b[1], b[0]]);
    const at = core(seed);
    for (let r = 28; r <= 30; r++) for (let c = 31; c <= 32; c++) assert.equal(at(c, r), 'rift-gate-celestial');
    for (let r = 28; r <= 30; r++) assert.equal(at(rift.REALM_ARRIVAL.col, r), 'air', 'the arrival is plain air: the ordinary down');
    assert.ok(solid(at(rift.REALM_ARRIVAL.col, 31)), 'the arrival stands on rock');
    for (let r = 28; r <= 30; r++) assert.equal(at(kit.CORE_SEAM.col, r), 'starsteel-vein', 'the first swing finds starsteel');
    // The Turning Room: a field over the east tunnel and a pit under it, both rings blue (it falls down at first).
    const T = cgen.TURNING_ROOM;
    assert.equal(at(T.ring.col, T.ring.row), 'orrery-ring-b');
    assert.equal(at(T.pitRing.col, T.pitRing.row), 'orrery-ring-b');
    for (let c = T.pit.col; c < T.pit.col + T.pit.w; c++) for (let r = T.pit.row; r < T.pit.row + T.pit.h; r++) if (c !== T.pitRing.col || r !== T.pitRing.row) assert.equal(at(c, r), 'orrery-field', `pit ${c},${r}`);
    assert.equal(at(T.ore.col, T.ore.row), 'starsteel-vein', 'starsteel in the pit floor');
    assert.ok(solid(at(T.pit.col + T.pit.w, 31)) && solid(at(T.pit.col + T.pit.w, 33)), 'the far wall: no stepping out east');
    assert.equal(at(T.field.col + T.field.w, 29), 'air', 'past the field, the tunnel goes on in plain air');
    assert.ok(solid(at(T.field.col + T.field.w, 31)) && solid(at(T.field.col + 3, 27)), 'tunnel floor beyond, tunnel roof over');
    // The chain down the west shaft, through the hall's roof.
    for (let r = kit.CORE_SHAFT.row; r < kit.CORE_SHAFT.row + kit.CORE_SHAFT.h; r++) assert.equal(at(kit.CORE_SHAFT.col, r), 'star-chain', `chain row ${r}`);
    // The Orrery Well: all field, brass rings near its ceiling and near its floor, an unbreakable floor.
    for (const ring of cgen.HALL_RINGS) assert.equal(at(ring.col, ring.row), 'orrery-ring-a');
    assert.equal(at(30, 48), 'orrery-field');
    assert.equal(at(30, 54), 'rift-frame', 'the Ephemeris\'s floor does not break');
    assert.equal(at(5, 0), 'bedrock'); assert.equal(at(5, 63), 'bedrock');
  }
});

test('orrery wells: wings hold orrery vaults, star-wells and warden galleries, with their ores', () => {
  const ctx = gen.sectorContext(CSPEC, rift.realmSeed(424242, 'celestial'));
  const kinds = new Set(), nodes = new Map();
  let halls = 0;
  for (let sx = -15; sx < 15; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (const s of column.structures) kinds.add(s.kind);
    halls += column.halls.filter(h => h.creature === 'anchor-warden').length;
    for (const k of column.kind) nodes.set(id(k), (nodes.get(id(k)) ?? 0) + 1);
  }
  for (const k of ['gate-hollow', 'orrery-hall', 'turning-room', 'orrery-vault', 'star-well', 'warden-gallery']) assert.ok(kinds.has(k), k);
  for (const k of ['astral-stone', 'nadir-stone', 'starsteel-vein', 'meridian-glass-vein', 'orrery-scrap', 'orrery-field', 'star-well', 'star-chain', 'orrery-ring-a', 'orrery-ring-b']) {
    assert.ok((nodes.get(k) ?? 0) > 3, `${k}: ${nodes.get(k)}`);
  }
  assert.ok(halls >= 3, `${halls} warden galleries`);
});

test('never a softlock: every generated field has rings a Keeper reaches from its floor and its ceiling; every star-well has its chain', () => {
  let fields = 0, wells = 0;
  for (const seed of SEEDS) {
    const t = strip(seed, -10, 10);
    const seen = new Set();
    for (let col = 0; col < t.cols; col++) for (let row = 0; row < t.rows; row++) {
      const k = t.kind[t.index(col, row)];
      if (cel.inField(k) && !seen.has(cel.cellKey(col, row))) {
        const f = cel.fieldAt(t, col, row);
        for (const key of f.cells) seen.add(key);
        // A field cut by the strip's edge is checked from the strip that holds it whole.
        if ([...f.cells].some(key => { const c = Math.floor(key / 256) - 0x100000; return c === 0 || c === t.cols - 1; })) continue;
        fields++;
        assert.ok(f.rings.length >= 1, `seed ${seed}: a field at ${col},${row} without a ring`);
        assert.ok(f.cells.size < cel.FIELD_MAX, 'a field is bounded');
        const bad = cel.unreachableStands(t, f, 3);
        assert.equal(bad.length, 0, `seed ${seed}: the field at ${col},${row} has ${bad.length} stands that reach no ring`);
        const states = new Set(f.rings.map(r => t.kind[t.index(r.col, r.row)]));
        assert.equal(states.size, 1, 'one field, one state');
      }
      // A star-well's run: a chain beside it from the pocket's last row down to the chamber's floor.
      if (k === cel.C.well && (row === 0 || t.kind[t.index(col, row - 1)] !== cel.C.well)) {
        let bottom = row;
        while (bottom + 1 < t.rows && t.kind[t.index(col, bottom + 1)] === cel.C.well) bottom++;
        if (col + 1 >= t.cols) continue;
        wells++;
        for (let r = row + 2; r <= bottom; r++) assert.equal(t.kind[t.index(col + 1, r)], cel.C.chain, `seed ${seed}: the chain beside the well at ${col},${r}`);
        assert.ok(t.solid(col, bottom + 1), 'the well stands on a floor');
        assert.ok(t.solid(col, row - 1), 'and ends under a roof');
      }
    }
  }
  assert.ok(fields >= 20, `${fields} fields checked`);
  assert.ok(wells >= 5, `${wells} star-wells checked`);
});

// ── The rule, pure ──────────────────────────────────────────────────────────

test('the rule: a field\'s down is its rings\'; E turns every ring of the field; a star-well falls up; a field with no ring rests down', () => {
  // A 14 × 8 room: rock shell, rows 1..6 open; a field cols 2..9 rows 1..6 with rings at (2,2) and (9,5).
  const t = new terrainMod.Terrain(14, 8, 0);
  const rock = nodeIndex('astral-stone'), C = cel.C;
  for (let c = 0; c < 14; c++) { t.kind[t.index(c, 0)] = rock; t.kind[t.index(c, 7)] = rock; }
  for (let r = 0; r < 8; r++) { t.kind[t.index(0, r)] = rock; t.kind[t.index(13, r)] = rock; }
  for (let c = 2; c <= 9; c++) for (let r = 1; r <= 6; r++) t.kind[t.index(c, r)] = C.field;
  t.kind[t.index(2, 2)] = C.ringB; t.kind[t.index(9, 5)] = C.ringB;
  assert.equal(cel.downAt(t, 5, 3), 1, 'blue rings: the ordinary down');
  assert.equal(cel.downAt(t, 11, 3), 1, 'outside the field: plain air');
  const f = cel.fieldAt(t, 5, 3);
  assert.equal(f.cells.size, 8 * 6);
  assert.equal(f.rings.length, 2);
  const changed = cel.turnField(t, f);
  assert.equal(changed.length, 2, 'both rings turn together');
  assert.equal(t.kind[t.index(9, 5)], C.ringA);
  assert.equal(cel.downAt(t, 5, 3), -1, 'brass: the field falls up');
  assert.equal(cel.downAt(t, 9, 5, f), -1, 'a ring is part of its field');
  cel.turnField(t, f);
  assert.equal(cel.downAt(t, 5, 3), 1, 'turned again: back down');
  // No ring: it rests down. A star-well: always up. A chain: ordinary.
  t.kind[t.index(2, 2)] = C.field; t.kind[t.index(9, 5)] = C.field;
  assert.equal(cel.downAt(t, 5, 3), 1);
  t.kind[t.index(11, 3)] = C.well; t.kind[t.index(12, 3)] = C.chain;
  assert.equal(cel.downAt(t, 11, 3), -1);
  assert.equal(cel.downAt(t, 12, 3), 1);
  assert.ok(TERRAIN_NODE_LIST[C.chain].climb, 'a chain is climbed');
  for (const k of [C.field, C.well, C.ringA, C.ringB, C.chain]) assert.equal(TERRAIN_NODE_LIST[k].solid, false);
  assert.equal(cel.turnedRing(C.ringA), C.ringB);
  assert.equal(cel.turnedRing(C.ringB), C.ringA);
});

test('physics: falling up stands on the ceiling, walks it, steps along it, jumps off it and comes back; never past the fastest fall', () => {
  const t = new terrainMod.Terrain(20, 12, 0);
  const rock = nodeIndex('astral-stone');
  for (let c = 0; c < 20; c++) { t.kind[t.index(c, 0)] = rock; t.kind[t.index(c, 11)] = rock; }
  for (let c = 12; c < 20; c++) t.kind[t.index(c, 1)] = rock; // a one-cell step down in the ceiling from col 12
  const body = { x: 5.5 * CELL, y: 11 * CELL, vy: 0, grounded: true };
  let maxUp = 0;
  for (let n = 0; n < 120; n++) { terrainMod.stepTerrainBodyUp(body, 0, 1 / 60, t, BODY, 20 * CELL); maxUp = Math.max(maxUp, -body.vy); }
  assert.ok(body.grounded, 'standing on the ceiling');
  assert.equal(body.y - BODY.height, 1 * CELL, 'the head on the ceiling\'s underside');
  assert.ok(maxUp <= terrainMod.TERMINAL_FALL, 'never faster than any fall');
  // Walk east along the ceiling into the step: it walks "down" onto it.
  for (let n = 0; n < 120 && body.x < 13.5 * CELL; n++) terrainMod.stepTerrainBodyUp(body, 190, 1 / 60, t, BODY, 20 * CELL);
  assert.ok(body.x >= 13.5 * CELL, 'past the step');
  assert.equal(body.y - BODY.height, 2 * CELL, 'on the step\'s underside');
  // A jump pushes away from the ceiling; it comes back up.
  body.vy = 520; body.grounded = false;
  let lowest = 0;
  for (let n = 0; n < 120; n++) { terrainMod.stepTerrainBodyUp(body, 0, 1 / 60, t, BODY, 20 * CELL); lowest = Math.max(lowest, body.y); }
  assert.ok(lowest > 2 * CELL + BODY.height + 40, 'it left the ceiling');
  assert.ok(body.grounded && body.y - BODY.height === 2 * CELL, 'and landed back on it');
  // A long fall up from the floor of a tall room is capped like any fall.
  const tall = new terrainMod.Terrain(6, 64, 0);
  for (let c = 0; c < 6; c++) { tall.kind[tall.index(c, 0)] = rock; tall.kind[tall.index(c, 63)] = rock; }
  const b2 = { x: 3 * CELL, y: 63 * CELL, vy: 0, grounded: true };
  let fastest = 0;
  for (let n = 0; n < 300 && !(b2.grounded && n > 1); n++) { terrainMod.stepTerrainBodyUp(b2, 0, 1 / 60, tall, BODY, 6 * CELL); fastest = Math.max(fastest, -b2.vy); }
  assert.ok(fastest <= terrainMod.TERMINAL_FALL);
  assert.equal(b2.y - BODY.height, CELL, 'it lands on the ceiling, whole');
});

// ── The engine ──────────────────────────────────────────────────────────────

test('engine: through the Celestial gate; walk into the Turning Room and fall into its pit; turn the ring, fall up, walk the ceiling across; back out', () => {
  const { engine, delve, state, plan, uses } = through();
  let s = state();
  assert.equal(s.areaId, 'celestial-delve');
  assert.equal(s.realm.id, 'celestial');
  assert.equal(engine.realm, 'celestial');
  assert.equal(s.gravity, 1);
  assert.ok(delve.isClaimed(rift.enteredFlag('celestial')));
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'orrery')), 'the arrival line, once');
  run(engine, .5);
  assert.equal(feetRow(engine), rift.REALM_ARRIVAL.row, 'stands on the hollow floor');
  // Mine the starsteel outcrop from the west.
  engine.setTools({ pickaxe: 4, levels: { mining: 60 } });
  standOn(engine, kit.CORE_SEAM.col - 1, 31);
  engine.facing = 1;
  let swings = 0;
  while (kindAt(engine, kit.CORE_SEAM.col, 29) !== 'air' && swings++ < 80) { engine.attack(); engine.attackCooldown = 0; engine.update(1 / 60); }
  assert.equal(kindAt(engine, kit.CORE_SEAM.col, 29), 'air', 'starsteel mined');
  // Walk east into the Turning Room: the field is blue, so down is down, and the Keeper drops into the pit.
  const T = cgen.TURNING_ROOM;
  standOn(engine, T.ring.col - 2, 31);
  walk(engine, 'right', () => engine.terrain.colAt(engine.player.x) >= T.pit.col + 2);
  run(engine, .8);
  assert.equal(feetRow(engine), T.pit.row + T.pit.h - 1, 'in the pit');
  assert.equal(engine.keeperGravity, 1);
  // Walk to the pit's ring and press E: every ring of the field turns brass; the Keeper falls up.
  walk(engine, 'right', () => engine.terrain.colAt(engine.player.x) >= T.pitRing.col);
  engine.interact();
  assert.equal(kindAt(engine, T.pitRing.col, T.pitRing.row), 'orrery-ring-a');
  assert.equal(kindAt(engine, T.ring.col, T.ring.row), 'orrery-ring-a', 'the tunnel ring turned with it');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'ring')), 'Glim named the ring');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'turn')));
  assert.ok(delve.cores.get('celestial-delve')?.size > 0, 'the turned rings are saved');
  run(engine, 1);
  s = state();
  assert.equal(engine.keeperGravity, -1, 'falling up');
  assert.equal(s.gravity, -1, 'the state says so (followers hang from it)');
  assert.equal(s.realm.down, -1);
  assert.ok(s.realm.flips >= 1);
  assert.ok(engine.player.grounded, 'standing on the ceiling');
  assert.equal(headRow(engine), 28, 'the head under the tunnel roof');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'field')));
  // Walk the ceiling east out of the field: the ordinary down comes back, onto the tunnel floor beyond.
  walk(engine, 'right', () => engine.terrain.colAt(engine.player.x) >= T.field.col + T.field.w + 1);
  run(engine, .6);
  assert.equal(engine.keeperGravity, 1);
  assert.equal(feetRow(engine), 30, 'on the tunnel floor past the pit');
  assert.ok(engine.terrain.colAt(engine.player.x) > T.pit.col + T.pit.w, 'across');
  assert.ok(engine.hp > 0, 'nothing hurt');
  // And back: the field is still brass; walk west along its ceiling and out the other side.
  walk(engine, 'left', () => engine.terrain.colAt(engine.player.x) <= T.ring.col - 2);
  run(engine, .6);
  assert.equal(engine.keeperGravity, 1);
  assert.equal(feetRow(engine), 30, 'back in the tunnel west of the room');
  // Back out through the return gate.
  standOn(engine, 32, 31);
  uses.length = 0;
  engine.interact();
  assert.ok(uses.find(u => u.kind === 'gate' && u.node === 'rift-gate-celestial'));
  assert.ok(engine.leaveRealm());
  assert.equal(state().areaId, 'ember-delve');
  assert.equal(state().gravity, 1);
  assert.equal(engine.terrain.colAt(engine.player.x), plan.col + 6, 'beside the gate it came in by');
});

test('engine: a star-well falls up to its roof; its chain climbs back down; the Orrery Key sinks you out and turns a field from anywhere', () => {
  const { engine, delve } = through();
  const t = engine.terrain, C = cel.C;
  // A star-well laid in the Gate Hollow (rows 24..30 open, the roof row 23): col 20 the well, col 21 its chain.
  for (let r = 24; r <= 30; r++) { t.set(20, r, C.well); t.set(21, r, C.chain); }
  standOn(engine, 19, 31);
  walk(engine, 'right', () => engine.terrain.colAt(engine.player.x) >= 20, 60);
  run(engine, 1.2);
  assert.equal(engine.keeperGravity, -1);
  assert.equal(headRow(engine), 24, 'up against the hollow\'s roof');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'well')));
  // The Orrery Key and Down held: it sinks back to the floor, gently.
  engine.setGear({ key: true });
  engine.input.add('down');
  let fastest = 0;
  for (let n = 0; n < 180; n++) { engine.update(1 / 60); fastest = Math.max(fastest, engine.player.vy); }
  engine.input.delete('down');
  assert.equal(feetRow(engine), 30, 'sank to the floor');
  assert.ok(fastest <= cel.KEY_SINK + 1, `sank gently (${fastest} px/s)`);
  // Without the key: up again; step onto the chain and it holds, whatever down is doing; climb it down.
  engine.setGear({ key: false });
  run(engine, 1);
  assert.equal(engine.keeperGravity, -1);
  walk(engine, 'right', () => engine.terrain.colAt(engine.player.x) >= 21, 60);
  run(engine, .3);
  assert.ok(engine.climbing, 'on the chain');
  engine.input.add('down');
  run(engine, 1.5);
  engine.input.delete('down');
  assert.equal(feetRow(engine), 30, 'climbed down to the floor');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'chain')));
  // The key turns the Turning Room's field from the middle of the pit, nowhere near a ring.
  const T = cgen.TURNING_ROOM;
  engine.setGear({ key: true });
  standOn(engine, T.pit.col + 2, T.pit.row + T.pit.h, 8);
  assert.equal(kindAt(engine, T.ring.col, T.ring.row), 'orrery-ring-b');
  engine.interact();
  assert.equal(kindAt(engine, T.ring.col, T.ring.row), 'orrery-ring-a', 'turned from where the Keeper stands');
  run(engine, 1);
  assert.equal(engine.keeperGravity, -1);
});

test('engine: the Fallen Ephemeris rides its hall\'s ceiling untouchable; a ring drops it into its well; struck, it rises and turns the hall back; it falls for good', () => {
  const { engine, delve, state } = through();
  const t = engine.terrain, H = kit.CORE_HALL;
  const boss = engine.monsters.find(m => m.def.creature === 'fallen-ephemeris');
  assert.ok(boss, 'it is in its hall');
  // The hall's rings start brass: placed on the floor, the Keeper falls up to the hall's ceiling.
  standOn(engine, 20, H.row + H.h);
  run(engine, 1.5);
  assert.equal(engine.keeperGravity, -1);
  assert.equal(headRow(engine), H.row, 'on the hall\'s ceiling');
  assert.ok(delve.isClaimed(rift.ruleFlag('celestial', 'ephemeris')));
  assert.equal(state().realm.ephemeris, 'orbit');
  assert.ok(boss.lift > 150, `in orbit near the ceiling (lift ${boss.lift})`);
  const hp = boss.hp;
  engine.hurtMonster(boss, 80);
  assert.equal(boss.hp, hp, 'in orbit: no blow lands');
  // Walk the ceiling to the first ring and turn it: the hall falls down, the Keeper with it, the Ephemeris into its well.
  const ring = cgen.HALL_RINGS[0];
  walk(engine, 'left', () => engine.terrain.colAt(engine.player.x) <= ring.col);
  engine.interact();
  for (const r of cgen.HALL_RINGS) assert.equal(kindAt(engine, r.col, r.row), 'orrery-ring-b', `ring ${r.col},${r.row} turned`);
  run(engine, 1.5);
  assert.equal(engine.keeperGravity, 1);
  assert.equal(feetRow(engine), H.row + H.h - 1, 'on the hall\'s floor, whole');
  assert.equal(state().realm.ephemeris, 'fallen');
  assert.equal(boss.lift, 0);
  engine.hurtMonster(boss, 80);
  assert.equal(boss.hp, hp - 80, 'fallen: the blow lands');
  const at = boss.x;
  run(engine, 2);
  assert.equal(boss.x, at, 'fallen: it does not move');
  // It gathers itself (the rings flash first), then rises: the hall falls up again and two Anchor Wardens come.
  engine.player.x = boss.x + 10 * CELL;
  for (let n = 0; n < 60 * 12 && state().realm.ephemeris === 'fallen'; n++) engine.update(1 / 60);
  assert.equal(state().realm.ephemeris, 'gather', 'a warning before it turns the hall');
  assert.equal(kindAt(engine, ring.col, ring.row), 'orrery-ring-b', 'the warning comes first: the hall has not turned yet');
  const wardens = engine.monsters.filter(m => m.def.creature === 'anchor-warden').length;
  run(engine, cel.GATHER_TELL + .2);
  for (const r of cgen.HALL_RINGS) assert.equal(kindAt(engine, r.col, r.row), 'orrery-ring-a', 'it turned the hall back up');
  assert.ok(engine.monsters.filter(m => m.def.creature === 'anchor-warden').length >= wardens + 2, 'two Anchor Wardens');
  run(engine, 1.5);
  assert.equal(engine.keeperGravity, -1, 'the Keeper fell up with the hall');
  assert.equal(state().realm.ephemeris, 'orbit');
  // Bring it down again and end it.
  walk(engine, 'left', () => engine.terrain.colAt(engine.player.x) <= ring.col);
  engine.interact();
  run(engine, 1.5);
  assert.equal(state().realm.ephemeris, 'fallen');
  engine.hurtMonster(boss, boss.hp);
  assert.ok(delve.isClaimed(ctown.EPHEMERIS_FLAG), 'it falls for good');
  void t;
});
