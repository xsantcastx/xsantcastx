// The endless Delve (Phase 7, horizontal first): the sector generator, the
// loaded ring, persistence of sector diffs, and everything the Delve does
// working across sector borders. Same loader as seamworks-engine.test.cjs: the
// browser runtime compiled straight from TypeScript, one module graph, so the
// engine, the world and the tests share every class.
//
//   node --test scripts/delve-endless.test.cjs
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
const worldMod = load('play/engine/sector-world.ts');
const liquidsMod = load('play/engine/liquids.ts');
const region = load('shared/delve/delve-region.model.ts');
const notes = load('shared/delve/field-notes.model.ts');
const towns = load('play/world/towns/infernal.ts');
const SPEC = towns.EMBER_DELVE.terrain;
const { CELL, nodeIndex, TERRAIN_NODE_LIST } = terrainMod;
const { SECTOR } = gen;
const AIR = 0;
/** Values out of the vm realm, as plain data (deepStrictEqual compares prototypes). */
const plain = value => JSON.parse(JSON.stringify(value));

/**
 * A DelvePersistence with the endless Delve's sector store, backed by the real
 * region encoding (every write goes through encodeRuns / encodeFog and every
 * read back through decode), the way DelveSaveService keeps them.
 */
function memoryDelve(seed) {
  const core = new Map(), coreLiquids = { wet: '', cells: new Map() };
  let seen = null;
  const sectors = new Map();
  const claimed = new Set();
  const log = [];
  const diff = (sx, sy, g) => {
    const key = `${sx},${sy}`;
    let d = sectors.get(key);
    if (!d || d.g !== g) { d = { g, t: 0 }; sectors.set(key, d); }
    return d;
  };
  const store = {
    sector(_area, sx, sy) {
      const d = sectors.get(`${sx},${sy}`);
      if (!d) return null;
      return { g: d.g, t: d.t, cells: region.decodeRuns(d.c), liquids: region.decodeRuns(d.l), fog: region.decodeFog(d.f), receipts: region.decodeIndexSet(d.k), ...(d.h ? { healed: d.h } : {}) };
    },
    sectorChanged(_area, sx, sy, g, local, kind, receipt) {
      const d = diff(sx, sy, g), cells = region.decodeRuns(d.c);
      if (kind === null) cells.delete(local); else cells.set(local, kind);
      d.c = region.encodeRuns(cells); d.t = Date.now();
      if (receipt) { const k = region.decodeIndexSet(d.k); k.add(local); d.k = region.encodeIndexSet(k); }
      log.push({ sx, sy, local, kind });
    },
    sectorLiquids(_area, sx, sy, g, cells) {
      if (!cells.size && !sectors.has(`${sx},${sy}`)) return;
      diff(sx, sy, g).l = region.encodeRuns(cells);
    },
    sectorExplored(_area, sx, sy, g, fog) {
      const d = diff(sx, sy, g), was = region.decodeFog(d.f) ?? new Uint8Array(8);
      for (let i = 0; i < 8; i++) was[i] |= fog[i];
      d.f = region.encodeFog(was);
    },
    sectorKeys: () => [...sectors.keys()].map(key => { const [sx, sy] = key.split(',').map(Number); return { sx, sy }; }),
  };
  return {
    sectorsMap: sectors, core, log,
    seed: () => seed,
    cells: () => (core.size ? core : null),
    changed(_area, _layout, index, kind) { if (kind === null) core.delete(index); else core.set(index, kind); },
    seenCells: (_a, _l, cells) => (seen ??= new Uint8Array((cells + 7) >> 3)),
    explored() {},
    liquids: (_a, wet) => (coreLiquids.wet === wet && coreLiquids.cells.size ? coreLiquids.cells : null),
    liquidsChanged(_a, wet, cells) { coreLiquids.wet = wet; coreLiquids.cells = new Map(cells); },
    isClaimed: id => claimed.has(id),
    claim: id => (claimed.has(id) ? false : (claimed.add(id), true)),
    sectors: store,
  };
}

function fixture(delve, extra = {}) {
  let state;
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot: () => true, onWorldAction: () => true, onState: value => { state = value; }, delve, ...extra });
  return { engine, state: () => { engine.report(); return state; } };
}
function enter(delve, extra) {
  const f = fixture(delve, extra);
  const shaft = f.engine.places.find(station => station.id === 'delve');
  f.engine.player.x = shaft.x; f.engine.player.y = 610; f.engine.interact();
  assert.equal(f.state().areaId, 'ember-delve');
  assert.ok(f.engine.world, 'the endless Delve runs when the save holds sectors');
  return f;
}
/** Stand the Keeper on the surface at world column `col` and let the ring settle. */
function standAt(engine, col) {
  engine.player.x = (col + .5) * CELL; engine.player.y = SPEC.top; engine.player.vy = 0;
  for (let n = 0; n < 4; n++) engine.update(1 / 60);
}
function walk(engine, dir, seconds) {
  engine.setInput(dir > 0 ? 'right' : 'left', true);
  for (let n = 0; n < seconds * 60; n++) engine.update(1 / 60);
  engine.setInput(dir > 0 ? 'right' : 'left', false);
}
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];

// ── The generator ───────────────────────────────────────────────────────────

test('generation: the same seed gives the same sector column, byte for byte, in any order', () => {
  for (const seed of SEEDS) {
    const a = gen.sectorContext(SPEC, seed), b = gen.sectorContext(SPEC, seed);
    const order = [9, -3, 5, -1, 4, 12, -20];
    const first = new Map(order.map(sx => [sx, gen.columnHash(gen.generateSectorColumn(a, sx))]));
    for (const sx of [...order].reverse()) assert.equal(gen.columnHash(gen.generateSectorColumn(b, sx)), first.get(sx), `seed ${seed} sx ${sx}`);
  }
  // Different seeds, different rock.
  const x = gen.generateSectorColumn(gen.sectorContext(SPEC, 1), 7), y = gen.generateSectorColumn(gen.sectorContext(SPEC, 2), 7);
  assert.notEqual(gen.columnHash(x), gen.columnHash(y));
});

test('generation: golden hashes pin the generator (bump SECTOR_GV when these move)', () => {
  const ctx = gen.sectorContext(SPEC, 424242);
  // The shipped strata's rows (0-55) hash exactly as they did in Phase 7: the Underhearth (Phase 8)
  // only added rows below them, so no saved diff moved and SECTOR_GV stays 1.
  const upper = column => ({ kind: column.kind.subarray(0, SPEC.rows * SECTOR), liqType: column.liqType.subarray(0, SPEC.rows * SECTOR), liqLevel: column.liqLevel.subarray(0, SPEC.rows * SECTOR) });
  const got = Object.fromEntries([-5, -1, 4, 6, 11].map(sx => [sx, gen.columnHash(upper(gen.generateSectorColumn(ctx, sx))).toString(16)]));
  assert.equal(gen.SECTOR_GV, 1);
  assert.deepEqual(got, GOLDEN);
});
const GOLDEN = { 4: 'd8aae7e6', 6: '81c209e7', 11: '6ff05959', '-5': '8955166c', '-1': 'c108e54a' };

test('generation: the core is copied cell for cell, and sector columns 0-3 hold it unchanged', () => {
  for (const seed of SEEDS.slice(0, 3)) {
    const ctx = gen.sectorContext(SPEC, seed), core = terrainMod.generateTerrain(SPEC, seed);
    for (let sx = 0; sx < 4; sx++) {
      const column = gen.generateSectorColumn(ctx, sx);
      for (let row = 0; row < SPEC.rows; row++) for (let lc = 0; lc < SECTOR; lc++) {
        const col = sx * SECTOR + lc;
        if (col >= SPEC.cols) continue;
        const i = row * SECTOR + lc, c = core.index(col, row);
        // Phase 8: the Banked seal is cut through the fragment chamber's floor (the one way down).
        if (col >= 99 && col <= 100 && row >= 51) { assert.equal(TERRAIN_NODE_LIST[column.kind[i]].id, 'hearth-seal'); continue; }
        assert.equal(column.kind[i], core.kind[c]); assert.equal(column.liqLevel[i], core.liqLevel[c]);
        assert.equal(column.notes.get(i), core.inscriptions.get(c));
      }
    }
  }
});

test('generation: caves cross sector borders without a seam (the border is no different from inside)', () => {
  let borderSteps = 0, borderPairs = 0, innerSteps = 0, innerPairs = 0;
  for (const seed of SEEDS) {
    const ctx = gen.sectorContext(SPEC, seed);
    const cols = new Map([4, 5, 6, 7, 8, -2, -3, -4].map(sx => [sx, gen.generateSectorColumn(ctx, sx)]));
    const open = (col, row) => { const c = cols.get(Math.floor(col / SECTOR)); return c.kind[row * SECTOR + (col - c.sx * SECTOR)] === AIR; };
    for (const sx of [5, 6, 7, 8, -3, -2]) {
      for (let row = 3; row < SPEC.rows - 3; row++) {
        borderPairs++; if (open(sx * SECTOR - 1, row) !== open(sx * SECTOR, row)) borderSteps++;
        innerPairs++; if (open(sx * SECTOR + 15, row) !== open(sx * SECTOR + 16, row)) innerSteps++;
      }
    }
  }
  const border = borderSteps / borderPairs, inner = innerSteps / innerPairs;
  assert.ok(border <= inner * 1.6 + .02, `open/closed steps at borders ${border.toFixed(3)} vs inside ${inner.toFixed(3)}`);
});

test('generation: wings are hand-made-looking: caves, ore by depth, structures, and halls with creatures', () => {
  const ctx = gen.sectorContext(SPEC, 424242);
  const kinds = new Map(), structures = new Map();
  let air = 0, cells = 0, halls = 0;
  for (let sx = -30; sx <= 34; sx++) {
    if (sx >= 0 && sx < 4) continue;
    const column = gen.generateSectorColumn(ctx, sx);
    for (let i = 0; i < column.kind.length; i++) { const id = TERRAIN_NODE_LIST[column.kind[i]].id; kinds.set(id, (kinds.get(id) ?? 0) + 1); if (column.kind[i] === AIR) air++; cells++; }
    for (const s of column.structures) structures.set(s.kind, (structures.get(s.kind) ?? 0) + 1);
    halls += column.halls.length;
  }
  assert.ok(air / cells > .08 && air / cells < .35, `cave share ${(air / cells).toFixed(2)}`);
  for (const id of ['cinder-vein', 'slag-vein', 'heartstone-vein', 'ember-rock', 'glowcap', 'waycache', 'shadow-root', 'petrified-trunk']) assert.ok(kinds.get(id) > 0, `${id} appears`);
  for (const kind of ['ruin', 'waycache', 'flooded-shaft', 'maw-den', 'lake', 'lava-basin', 'bailiff-hall', 'rift-shrine']) assert.ok(structures.get(kind) > 0, `${kind} appears in 60 sector columns`);
  assert.ok(halls > 3);
  // Ore by depth: heartstone only in the Magma Halls, slag never in the Root Hollows.
  for (let sx = 5; sx < 25; sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (let i = 0; i < column.kind.length; i++) {
      const row = Math.floor(i / SECTOR), id = TERRAIN_NODE_LIST[column.kind[i]].id;
      if (id === 'heartstone-vein') assert.ok(row >= 40, `heartstone at row ${row}`);
      if (id === 'slag-vein') assert.ok(row >= 12, `slag at row ${row}`);
    }
  }
});

test('generation: a structure straddling a sector border is stamped by both halves the same', () => {
  let checked = 0;
  for (const seed of SEEDS) {
    const ctx = gen.sectorContext(SPEC, seed);
    for (let cell = 2; cell < 30 && checked < 6; cell++) {
      for (const plan of gen.latticePlans(ctx, cell)) {
        const border = (Math.floor(plan.col / SECTOR) + 1) * SECTOR;
        if (plan.col + plan.w <= border || plan.kind === 'rift-shrine') continue;
        const left = gen.generateSectorColumn(ctx, border / SECTOR - 1), right = gen.generateSectorColumn(ctx, border / SECTOR);
        // The interior row just under its top is open on both sides of the border.
        const row = plan.row + 1;
        assert.equal(TERRAIN_NODE_LIST[left.kind[row * SECTOR + SECTOR - 1]].solid, false, `${plan.kind} open west of ${border}`);
        assert.equal(TERRAIN_NODE_LIST[right.kind[row * SECTOR]].solid, false, `${plan.kind} open east of ${border}`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 3, `checked ${checked}`);
});

test('generation: every generated lake and lava basin is at rest (nothing flows on load)', () => {
  for (const seed of SEEDS) {
    const world = new worldMod.SectorWorld(SPEC, seed, 'ember-delve', null);
    for (const at of [300, 700, -400, 1500]) {
      world.center(at);
      const sim = new liquidsMod.LiquidSim(world.t);
      const volume = [sim.volume(1), sim.volume(2)];
      sim.wakeAll();
      for (let n = 0; n < 40; n++) sim.tick();
      assert.deepEqual([sim.volume(1), sim.volume(2)], volume, `seed ${seed} at ${at}: nothing reacts`);
      assert.equal(sim.dirty, false, `seed ${seed} at ${at}: nothing moved`);
    }
  }
});

test('generation: a sector column takes well under the phone budget', () => {
  const ctx = gen.sectorContext(SPEC, 99);
  for (let sx = 40; sx < 50; sx++) gen.generateSectorColumn(ctx, sx); // warm the JIT
  const start = performance.now();
  for (let sx = 50; sx < 110; sx++) gen.generateSectorColumn(ctx, sx);
  const each = (performance.now() - start) / 60;
  // Phase 8: a column runs down through the Underhearth (rows 0-119, almost four sectors); the budget is per sector (spec §3.5).
  const sectors = ctx.rows / SECTOR;
  assert.ok(each / sectors < 2, `${each.toFixed(2)} ms per column (${sectors.toFixed(2)} sectors) in node`);
});

// ── The loaded ring and streaming ──────────────────────────────────────────

test('streaming: walking east three sectors moves the ring a column at a time, the next one already generated', () => {
  const delve = memoryDelve(424242);
  const { engine, state } = enter(delve);
  const world = engine.world;
  standAt(engine, 100);
  const shift = world.shift.bind(world);
  let shifts = 0, cold = 0, worst = 0;
  world.shift = dir => {
    const arriving = dir > 0 ? world.loSector + 4 : world.loSector - 1;
    if (!world.cached(arriving)) cold++;
    const t0 = performance.now(); shift(dir); worst = Math.max(worst, performance.now() - t0); shifts++;
  };
  // Teleporting along the surface a few cells per step is a walk without the dirt in the way.
  for (let col = 100; col <= 100 + 3 * SECTOR + 8; col++) {
    engine.player.x = (col + .5) * CELL; engine.player.y = SPEC.top;
    for (let n = 0; n < 6; n++) engine.update(1 / 60);
    const t = engine.terrain;
    assert.ok(col - t.colLo >= worldMod.EDGE_MARGIN - 1 && t.colHi - col >= worldMod.EDGE_MARGIN - 1, `col ${col} inside [${t.colLo}, ${t.colHi})`);
    assert.equal(t.colHi - t.colLo, worldMod.RING_COLS);
  }
  assert.ok(shifts >= 3, `${shifts} shifts`);
  assert.equal(cold, 0, 'the arriving column was prefetched every time');
  assert.ok(worst < 12, `worst shift ${worst.toFixed(2)} ms`);
  assert.ok(Math.floor(state().x / CELL) >= 196);
  engine.destroy();
});

test('streaming: walking for real (input, physics) crosses sector borders on the surface', () => {
  const { engine } = enter(memoryDelve(77));
  standAt(engine, 110);
  walk(engine, 1, 12);
  assert.ok(engine.player.x / CELL > 150, `walked to ${(engine.player.x / CELL).toFixed(1)}`);
  assert.ok(engine.world.shifts >= 1);
  walk(engine, -1, 30);
  assert.ok(engine.player.x / CELL < 40, 'and back west, past the core');
  engine.destroy();
});

test('cells: dig and place across a sector border; both sectors save; a reload and a cache eviction keep them', () => {
  const delve = memoryDelve(5150);
  const first = enter(delve);
  const engine = first.engine;
  engine.setTools({ pickaxe: 5, axe: 5, sickle: 5, blade: 5, staff: 3 });
  standAt(engine, 158);
  const t = engine.terrain;
  // Make the two cells under the border plain dirt (generated), then dig them from beside them.
  for (const col of [159, 160]) { t.set(col, 1, nodeIndex('dirt')); t.base[t.index(col, 1)] = nodeIndex('dirt'); }
  t.set(159, 0, AIR); t.set(160, 0, AIR); engine.recordCell(t, t.index(159, 0)); engine.recordCell(t, t.index(160, 0));
  assert.ok(engine.placeCell(160, 0, 'packed-dirt'));
  const s4 = delve.sectors.sector('ember-delve', 4, 0), s5 = delve.sectors.sector('ember-delve', 5, 0);
  assert.equal(s4.cells.get(31), AIR, 'col 159 is the last column of sector 4');
  assert.equal(s5.cells.get(0), nodeIndex('packed-dirt'), 'col 160 is the first column of sector 5');
  // Walk far away (the columns leave the ring and the cache), then come back.
  standAt(engine, 158 + 40);
  for (let col = 200; col < 900; col += 8) standAt(engine, col);
  standAt(engine, 158);
  assert.equal(engine.terrain.nodeAt(159, 0).id, 'air');
  assert.equal(engine.terrain.nodeAt(160, 0).id, 'packed-dirt');
  engine.destroy();
  // A reload: a new engine from the same save.
  const again = enter(delve);
  standAt(again.engine, 158);
  assert.equal(again.engine.terrain.nodeAt(159, 0).id, 'air');
  assert.equal(again.engine.terrain.nodeAt(160, 0).id, 'packed-dirt');
  again.engine.destroy();
});

test('cells: west of the core works the same (negative columns), and the core keeps its v1 diff', () => {
  const delve = memoryDelve(31);
  const { engine } = enter(delve);
  standAt(engine, -40);
  const t = engine.terrain;
  assert.ok(t.colLo < -40);
  t.set(-33, 0, AIR); engine.recordCell(t, t.index(-33, 0));
  t.set(5, 3, AIR); engine.recordCell(t, t.index(5, 3));
  const { sx, sy, local } = worldMod.SectorWorld.local(-33, 0);
  assert.deepEqual([sx, sy, local], [-2, 0, 31]);
  assert.equal(delve.sectors.sector('ember-delve', -2, 0).cells.get(31), AIR);
  assert.equal(delve.core.get(3 * SPEC.cols + 5), AIR, 'a core cell lands in the core diff at its v1 index');
  engine.destroy();
});

test('liquids: water flows across a sector border, settles, saves per sector, and comes back on reload', () => {
  const delve = memoryDelve(8080);
  const { engine } = enter(delve);
  standAt(engine, 190);
  const t = engine.terrain, row = 20;
  // A channel through the border at col 192, on a bedrock floor.
  for (let col = 184; col <= 200; col++) {
    for (const r of [row - 1, row]) { t.set(col, r, AIR); engine.recordCell(t, t.index(col, r)); }
    t.set(col, row + 1, nodeIndex('bedrock')); engine.recordCell(t, t.index(col, row + 1));
  }
  for (const r of [row - 2]) for (let col = 184; col <= 200; col++) { t.set(col, r, nodeIndex('bedrock')); engine.recordCell(t, t.index(col, r)); }
  t.set(183, row, nodeIndex('bedrock')); t.set(183, row - 1, nodeIndex('bedrock')); t.set(201, row, nodeIndex('bedrock')); t.set(201, row - 1, nodeIndex('bedrock'));
  for (const col of [187, 188, 189, 190, 191]) { const i = t.index(col, row); t.liqType[i] = 1; t.liqLevel[i] = 8; }
  engine.liquid.wakeAll();
  const volume = engine.liquid.volume(1);
  for (let n = 0; n < 60 * 20; n++) engine.update(1 / 60);
  let east = 0;
  for (let col = 192; col <= 200; col++) east += t.liqLevel[t.index(col, row)];
  assert.ok(east > 0, 'water reached past the border');
  assert.equal(engine.liquid.volume(1), volume, 'no water lost at the border');
  assert.ok(engine.liquid.settled, 'it settled');
  const saved = delve.sectors.sector('ember-delve', 6, 0);
  assert.ok(saved && saved.liquids.size > 0, 'sector 6 holds its share of the water');
  engine.destroy();
  const again = enter(delve);
  standAt(again.engine, 190);
  let back = 0;
  for (let col = 184; col <= 200; col++) back += again.engine.terrain.liqLevel[again.engine.terrain.index(col, row)];
  assert.equal(back, volume, 'every level of it after a reload');
  again.engine.destroy();
});

test('liquids: a column leaving the ring forgets its flow, and arrives again where it was', () => {
  const { engine } = enter(memoryDelve(12));
  standAt(engine, 300);
  const world = engine.world, sim = engine.liquid;
  world.center(300);
  for (let n = 0; n < 30; n++) engine.update(1 / 60);
  const before = sim.awake;
  standAt(engine, 900);
  standAt(engine, 300);
  assert.ok(sim.awake <= before + 4096);
  for (let n = 0; n < 60; n++) engine.update(1 / 60);
  engine.destroy();
});

test('fog: the map fills in across sectors, saves 4x4 blocks per sector, and the full map lists them after a reload', () => {
  const delve = memoryDelve(2024);
  const { engine } = enter(delve);
  for (let col = 100; col <= 230; col += 2) standAt(engine, col);
  for (const sx of [4, 5, 6]) {
    const s = delve.sectors.sector('ember-delve', sx, 0);
    assert.ok(s?.fog && s.fog.some(b => b), `sector ${sx} has explored blocks`);
  }
  engine.destroy();
  const again = enter(delve);
  const source = again.engine.mapSource();
  assert.ok(source.world, 'the map is the world map');
  for (const sx of [0, 4, 5, 6]) assert.ok(source.world.sectors.includes(sx), `sector column ${sx} listed`);
  // Painting a far explored column builds it from the save and shows explored (non-fog) cells.
  const data = new Uint8ClampedArray(SECTOR * SPEC.rows * 4);
  source.world.paint(6 * SECTOR, 7 * SECTOR, data);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] !== 20 || data[i + 1] !== 10 || data[i + 2] !== 31) lit++;
  assert.ok(lit > 20, `${lit} explored map pixels in sector column 6`);
  again.engine.destroy();
});

test('placed things: a camp east of the core is found from town; descend lands beside it with the ring loaded', () => {
  const delve = memoryDelve(66);
  const { engine } = enter(delve);
  standAt(engine, 250);
  const t = engine.terrain;
  t.set(252, 0, AIR); engine.recordCell(t, t.index(252, 0));
  assert.ok(engine.placeCell(252, 0, 'camp'));
  engine.returnToCamp();
  for (let col = 0; col < 3; col++) engine.update(1 / 60);
  assert.equal(engine.hasDelveCamp(), true);
  assert.equal(engine.descendToCamp(), true);
  assert.equal(Math.floor(engine.player.x / CELL), 252);
  assert.ok(engine.terrain.inside(252, 0));
  // A second camp is refused anywhere: the first is found across the world.
  standAt(engine, 600);
  const t2 = engine.terrain;
  t2.set(600, 0, AIR);
  assert.equal(engine.placeProblem(t2, 600, 0, terrainMod.TERRAIN_NODES.camp, terrainMod.placeableById('camp'))?.key, 'play.delve.single');
  engine.destroy();
});

test('placed things: a wing chest is filed by a stable cell id that survives the ring moving', () => {
  const delve = memoryDelve(9);
  const { engine } = enter(delve);
  const world = engine.world;
  for (const [col, row] of [[0, 0], [119, 55], [120, 3], [-1, 7], [-700, 40], [5000, 12]]) {
    const id = world.cellId(col, row);
    assert.deepEqual({ ...world.cellOf(id) }, { col, row });
    if (col >= 0 && col < 120) assert.equal(id, row * 120 + col, 'core ids are the v1 index');
  }
  standAt(engine, 300);
  const t = engine.terrain;
  t.set(301, 0, AIR);
  assert.ok(engine.placeCell(301, 0, 'chest'));
  const id = world.cellId(301, 0);
  assert.equal(engine.nodeIdAt('ember-delve', id), 'chest');
  standAt(engine, 2000);
  standAt(engine, 300);
  assert.equal(engine.nodeIdAt('ember-delve', id), 'chest');
  engine.destroy();
});

test('supports and charges reach across a sector border', () => {
  const delve = memoryDelve(4040);
  const { engine } = enter(delve);
  engine.setTools({ pickaxe: 3, staff: 2 });
  standAt(engine, 160);
  const t = engine.terrain;
  t.set(158, 45, nodeIndex('timber-support'));
  assert.ok(terrainMod.supportNear(t, 161, 45), 'a support at 158 holds 161 (3 cells, another sector)');
  // A charge on the border clears rock on both sides, each into its own sector's diff.
  for (let col = 157; col <= 163; col++) for (let row = 28; row <= 32; row++) { t.set(col, row, nodeIndex('rock')); t.base[t.index(col, row)] = nodeIndex('rock'); }
  t.set(160, 30, nodeIndex('blast-charge'));
  const cleared = engine.detonate(t.index(160, 30));
  assert.ok(cleared >= 8, `${cleared} cleared`);
  assert.equal(t.nodeAt(158, 30).id, 'air'); assert.equal(t.nodeAt(162, 30).id, 'air');
  assert.ok(delve.sectors.sector('ember-delve', 4, 0).cells.get(30 * 32 + 30) === AIR);
  assert.ok(delve.sectors.sector('ember-delve', 5, 0).cells.get(30 * 32 + 2) === AIR);
  engine.destroy();
});

test('structures: a waycache pays once and leaves a receipt; a field note reads as its note; a shrine shows the map', () => {
  const seed = 424242, ctx = gen.sectorContext(SPEC, seed);
  let cache = null, shrine = null, note = null;
  for (let sx = 4; sx < 80 && !(cache && shrine && note); sx++) {
    const column = gen.generateSectorColumn(ctx, sx);
    for (let i = 0; i < column.kind.length; i++) {
      const at = { col: sx * SECTOR + (i % SECTOR), row: Math.floor(i / SECTOR) };
      if (!cache && TERRAIN_NODE_LIST[column.kind[i]].id === 'waycache') cache = at;
      if (!shrine && TERRAIN_NODE_LIST[column.kind[i]].id === 'rift-shrine') shrine = at;
    }
    for (const [i, id] of column.notes) if (!note && id.startsWith('field:')) note = { col: sx * SECTOR + (i % SECTOR), row: Math.floor(i / SECTOR), id };
  }
  assert.ok(cache && shrine && note, 'a waycache, a shrine and a field note within 76 sector columns');
  const actions = [], discoveries = [];
  const delve = memoryDelve(seed);
  const { engine } = enter(delve, { onWorldAction: e => { actions.push(e); return true; }, onDiscover: e => discoveries.push(e) });
  engine.setTools({ pickaxe: 3, axe: 3, sickle: 3, blade: 3 });
  standAt(engine, cache.col);
  const t = engine.terrain;
  engine.hitCell(cache.col, cache.row, terrainMod.SWING_TOOLS, true);
  engine.hitCell(cache.col, cache.row, terrainMod.SWING_TOOLS, true);
  assert.equal(t.nodeAt(cache.col, cache.row).id, 'air');
  const paid = actions.find(a => a.materialId === 'torch');
  assert.ok(paid && paid.qty === 3, 'three torches');
  const { sx, sy, local } = worldMod.SectorWorld.local(cache.col, cache.row);
  assert.ok(delve.sectors.sector('ember-delve', sx, sy).receipts.has(local), 'the dug cache is a receipt');
  // Field note.
  standAt(engine, note.col);
  engine.readInscription(engine.terrain.index(note.col, note.row));
  assert.equal(discoveries.at(-1).id, note.id);
  assert.ok(notes.fieldNoteFor(note.id), 'the carved id names a known note');
  // Shrine.
  standAt(engine, shrine.col);
  engine.useCell(engine.terrain.index(shrine.col, shrine.row));
  assert.equal(discoveries.at(-1).kind, 'shrine');
  const fogged = engine.world.sectorBlocks(Math.floor((shrine.col + 20) / SECTOR), Math.floor(shrine.row / SECTOR));
  assert.ok(fogged.some(b => b), 'the map shows the tunnels round the shrine');
  engine.destroy();
});

test('creatures: a hall spawns its creatures when its column loads, and they leave with it', () => {
  const ctx = gen.sectorContext(SPEC, 424242);
  let hall = null;
  for (let sx = 4; sx < 60 && !hall; sx++) { const c = gen.generateSectorColumn(ctx, sx); if (c.halls.length) hall = { sx, ...c.halls[0] }; }
  assert.ok(hall);
  const { engine } = enter(memoryDelve(424242));
  standAt(engine, hall.col0 + 4);
  const living = engine.monsters.filter(m => m.sx === hall.sx && m.def.creature === hall.creature && m.def.floorY === SPEC.top + hall.floorRow * CELL);
  assert.equal(living.length, hall.count);
  assert.ok(living.every(m => m.def.floorY === SPEC.top + hall.floorRow * CELL && m.x >= hall.col0 * CELL && m.x <= hall.col1 * CELL));
  assert.ok(engine.monsters.length <= 16, 'the creature cap holds');
  standAt(engine, hall.col0 + 400);
  assert.equal(engine.monsters.filter(m => m.sx === hall.sx).length, 0);
  engine.destroy();
});

// ── Save v2 (pure) ─────────────────────────────────────────────────────────

test('save v2: runs round-trip, are compact, and a worst-case region document stays far under the 1 MiB budget', () => {
  const tunnel = new Map();
  for (let i = 100; i < 130; i++) tunnel.set(i, 0);
  const encoded = region.encodeRuns(tunnel);
  assert.ok(encoded.length <= 8, `a 30-cell tunnel is ${encoded.length} chars`);
  assert.deepEqual(plain([...region.decodeRuns(encoded)]), plain([...tunnel]));
  const random = terrainMod.seededRandom(3), worst = new Map();
  for (let i = 0; i < 1024; i++) worst.set(i, Math.floor(random() * 60));
  assert.deepEqual(plain([...region.decodeRuns(region.encodeRuns(worst))]), plain([...worst]));
  const sectors = {};
  for (let sx = 0; sx < 8; sx++) for (let sy = 0; sy < 8; sy++) sectors[`${sx},${sy}`] = { g: 1, t: 1, c: region.encodeRuns(worst), l: region.encodeRuns(worst), f: 'ffffffffffffffff', k: region.encodeRuns(worst) };
  const doc = JSON.stringify({ v: 1, seed: 1, rx: 0, ry: 0, t: 1, sectors });
  assert.ok(doc.length < 1024 * 1024, `${doc.length} bytes`);
  if (process.env.DELVE_SIZES) console.log(`worst-case region doc: ${doc.length} bytes`);
  assert.equal(region.decodeRuns('!!!!').size, 0, 'junk decodes to nothing');
});

test('save v2: two devices merge per sector; fog ORs; a slot holding two regions keeps the later', () => {
  const a = { v: 1, seed: 5, rx: 1, ry: 0, t: 10, sectors: { '8,0': { g: 1, t: 10, c: region.encodeRuns(new Map([[1, 0], [2, 0]])), f: 'ff00000000000000' } } };
  const b = { v: 1, seed: 5, rx: 1, ry: 0, t: 20, sectors: { '8,0': { g: 1, t: 20, c: region.encodeRuns(new Map([[2, 9], [3, 0]])), f: '00ff000000000000' }, '9,0': { g: 1, t: 20 } } };
  const merged = region.mergeRegionSlots(b, a);
  const cells = region.decodeRuns(merged.sectors['8,0'].c);
  assert.deepEqual(plain([...cells].sort((x, y) => x[0] - y[0])), [[1, 0], [2, 0], [3, 0]], 'union, local wins cell 2');
  assert.equal(merged.sectors['8,0'].f, 'ffff000000000000');
  assert.ok(merged.sectors['9,0']);
  const other = { ...b, rx: 9, t: 30, sectors: {} };
  assert.equal(region.mergeRegionSlots(other, a).rx, 9, 'the later region keeps the slot');
  assert.equal(region.mergeRegionSlots(null, a).rx, 1);
});

test('regrowth: far, unheld, 14-day-old tunnels grow back; receipts, placed things and anchors keep a sector', () => {
  const day = 24 * 60 * 60 * 1000, now = 100 * day;
  const placed = k => !!TERRAIN_NODE_LIST[k].placeable;
  const old = { g: 1, t: now - 15 * day, c: region.encodeRuns(new Map([[5, 0], [6, 0], [7, 0]])), k: region.encodeIndexSet(new Set([7])), f: '0f00000000000000' };
  const opts = { coreSectors: 4, placed, anchors: [] };
  assert.equal(region.shouldRegrow(20, 0, old, now, opts), true);
  assert.equal(region.shouldRegrow(2, 0, old, now, opts), false, 'never the core');
  assert.equal(region.shouldRegrow(20, 0, { ...old, t: now - 13 * day }, now, opts), false, 'not before 14 days');
  assert.equal(region.shouldRegrow(20, 0, old, now, { ...opts, anchors: [{ sx: 23, sy: 0 }] }), false, 'within 4 sectors of a camp or chest');
  assert.equal(region.shouldRegrow(20, 0, old, now, { ...opts, anchors: [{ sx: 25, sy: 0 }] }), true);
  const torch = { ...old, c: region.encodeRuns(new Map([[5, nodeIndex('torch')]])) };
  assert.equal(region.shouldRegrow(20, 0, torch, now, opts), false, 'a sector holding a torch is held');
  const grown = region.regrow(old, now);
  assert.deepEqual(plain([...region.decodeRuns(grown.c)]), [[7, 0]], 'only the receipt stays dug');
  assert.equal(grown.f, old.f, 'the map remembers');
  assert.equal(grown.h, now);
  // A device that changed it after the regrowth keeps its change; one that changed it before does not.
  const before = { g: 1, t: now - 15 * day, c: region.encodeRuns(new Map([[9, 0]])) };
  assert.deepEqual(plain([...region.decodeRuns(region.mergeSector(before, grown).c)]), [[7, 0]]);
  const after = { g: 1, t: now + day, c: region.encodeRuns(new Map([[9, 0]])) };
  assert.deepEqual(plain([...region.decodeRuns(region.mergeSector(after, grown).c)].sort((x, y) => x[0] - y[0])), [[7, 0], [9, 0]]);
  // And the engine loads a regrown sector as fresh rock, saying so once.
  const delve = memoryDelve(424242);
  delve.sectorsMap.set('20,0', { g: 1, t: 0, h: now });
  const { engine, state } = enter(delve);
  standAt(engine, 20 * SECTOR + 10);
  assert.equal(state().messageKey, 'play.delve.regrown');
  assert.equal(delve.isClaimed('delve-regrowth-seen'), true, 'remembered per player');
  engine.say('play.delve.placed', 'Torch placed.', { item: 'torch' });
  standAt(engine, 21 * SECTOR + 10); standAt(engine, 20 * SECTOR + 10);
  assert.equal(state().messageKey, 'play.delve.placed', 'said only once');
  engine.destroy();
});
