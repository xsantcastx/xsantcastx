// One World, Phase 1 (docs/design/one-world.md): the Ember world's sky band
// over the Delve. The regression anchor of the whole restructure is that every
// row ≥ 0 is byte for byte what it was; the sky band above it is pinned by its
// own goldens. Same loader as delve-endless.test.cjs: the browser runtime
// compiled straight from TypeScript, one module graph.
//
//   node --test scripts/one-world.test.cjs
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
    crypto, console, performance, URLSearchParams,
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
const surface = load('play/engine/surface-gen.ts');
const blueprints = load('play/engine/blueprints.ts');
const ember = load('play/world/worlds/ember.world.ts');
const towns = load('play/world/towns/infernal.ts');
const routines = load('play/world/routines.ts');
const waystones = load('shared/waystones/waystones.model.ts');
const { CELL, nodeIndex, TERRAIN_NODE_LIST, Terrain } = terrainMod;
const { SECTOR } = gen;
const SPEC = towns.EMBER_DELVE.terrain;
const WORLD = ember.EMBER_WORLD.terrain;
const SKY = ember.EMBER_SURFACE;
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];
const FLOOR = SPEC.top;
/** Values out of the vm realm, as plain data (deepStrictEqual compares prototypes). */
const plain = value => JSON.parse(JSON.stringify(value));

/** FNV-1a over typed arrays (one byte at a time), as hex. */
function hash(...arrays) {
  let h = 0x811c9dc5;
  for (const a of arrays) for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

// ── Terrain.rowLo ───────────────────────────────────────────────────────────

test('rowLo: the grid holds rows above the ground; row 0 stays the ground line', () => {
  const t = new Terrain(128, 40, FLOOR, true, -16);
  assert.equal(t.kind.length, 128 * 56);
  for (const [col, row] of [[0, -16], [5, -1], [127, 0], [64, 39], [3, -9]]) {
    const i = t.index(col, row);
    assert.equal(t.colOf(i), col); assert.equal(t.rowOf(i), row);
    assert.ok(t.inside(col, row));
  }
  // The cell below is still index + cols (liquids, the map's way, the shaders rely on it).
  assert.equal(t.index(7, -1) + t.cols, t.index(7, 0));
  assert.ok(!t.inside(0, -17) && !t.solid(0, -17) && t.nodeAt(0, -40).id === 'air');
  assert.equal(t.rowAt(FLOOR - 1), -1);
  assert.equal(t.skyTop, FLOOR - 16 * CELL);
  // Chunk rows run from rowLo / CHUNK; every slot distinct.
  const keys = new Set();
  for (let cr = t.chunkRowLo; cr < t.chunkRows; cr++) for (let cc = 0; cc < 16; cc++) keys.add(t.chunkKey(cc, cr));
  assert.equal(keys.size, (t.chunkRows - t.chunkRowLo) * 16);
  assert.equal(t.chunkKey(0, t.chunkRowLo - 1), -1);
  // rowLo 0: exactly the old grid.
  const flat = new Terrain(120, 56, FLOOR);
  assert.equal(flat.index(10, 3), 3 * 120 + 10); assert.equal(flat.rowOf(3 * 120 + 10), 3);
  assert.throws(() => new Terrain(128, 40, FLOOR, true, -5));
});

test('blueprints: rectangular, known glyphs, every shop has a counter, doors at Keeper height', () => {
  assert.deepEqual(plain(blueprints.validateBlueprints()), []);
  for (const kind of ['shop', 'shop-wide', 'forge']) {
    const m = blueprints.blueprintMarks(kind);
    assert.ok(m.counter, `${kind} has a counter`);
    assert.ok(m.upstairs !== null, `${kind} has a keeper's room upstairs`);
    const rows = blueprints.BLUEPRINTS[kind];
    // The bottom three rows of both side walls are doorways: the street runs through.
    for (let y = rows.length - 3; y < rows.length; y++) { assert.equal(rows[y][0], 'D'); assert.equal(rows[y][rows[y].length - 1], 'D'); }
    // The room upstairs holds a Keeper (three rows between the roof and the floor).
    assert.ok(m.upstairs >= 3 + 3, `${kind}: three rows of roof, three of room`);
  }
});

// ── The regression anchor ───────────────────────────────────────────────────

test('rows ≥ 0 are byte-identical with the sky band on, five seeds', () => {
  for (const seed of SEEDS) {
    const bare = new worldMod.SectorWorld(SPEC, seed, 'ember-delve', null);
    const sky = new worldMod.SectorWorld(WORLD, seed, 'ember-delve', null);
    assert.equal(sky.rowLo, -32);
    const off = 32 * SECTOR;
    for (const sx of [-9, -5, -1, 0, 1, 2, 3, 4, 7, 12]) {
      const a = bare.column(sx).gen, b = sky.column(sx).gen;
      assert.equal(hash(b.kind.subarray(off), b.liqType.subarray(off), b.liqLevel.subarray(off), b.protect.subarray(off)),
        hash(a.kind, a.liqType, a.liqLevel, a.protect), `seed ${seed} sx ${sx}`);
      // Rows ≥ 0 only: the sky band carries its own words (the Living World's signposts).
      assert.deepEqual(plain([...b.notes].filter(([i]) => i >= off).map(([i, id]) => [i - off, id])), plain([...a.notes]));
    }
    // And through the ring, where the engine reads it.
    bare.center(60); sky.center(60);
    for (let row = 0; row < bare.t.rows; row += 3) for (let col = bare.t.colLo; col < bare.t.colHi; col += 5) {
      assert.equal(sky.t.kind[sky.t.index(col, row)], bare.t.kind[bare.t.index(col, row)]);
    }
  }
});

test('the sky band: golden hashes pin surface-gen (the settlement and the wilds)', () => {
  const got = Object.fromEntries([-13, -4, -2, 0, 1, 2, 3, 4, 7, 12, 20].map(sx => {
    const c = surface.surfaceColumn(SKY, sx);
    return [sx, hash(c.kind, c.back, c.protect, c.liqType, c.liqLevel)];
  }));
  assert.deepEqual(plain(got), SKY_GOLDEN);
});
// Bump these only with a surface change that is meant (a building moved, a blueprint redrawn): the sky band's saved
// diffs (sy < 0) are filed against the cells they were dug in, as the Delve's are.
// The wilds' columns (−13, 12, 20) moved for the Living World's trees and points of interest (living-world.ts).
// P2: the pond moved west into the Homestead (−2) with its trees; the arch at col 120 went (3); the Quarry's
// High Roads, its trees and bushes stand in sector 7.
const SKY_GOLDEN = { '-13': 'e0a386fa', '-4': '68e4adc5', '-2': '83a65694', 0: 'bf8a8c6', 1: '69e3fb1', 2: '33372215', 3: '91244b1d', 4: '68e4adc5', 7: 'bc21b1ff', 12: 'd39e0fd8', 20: 'd10f9b5d' };

test('the sky band: generation is fast (≤ 0.6 ms a column)', () => {
  const t0 = performance.now();
  const N = 300;
  for (let n = 0; n < N; n++) surface.surfaceColumn(SKY, n - 150);
  const per = (performance.now() - t0) / N;
  assert.ok(per <= .6, `${per.toFixed(3)} ms per column`);
});

// ── The settlement ──────────────────────────────────────────────────────────

/** The Ember world's ring round column `col` (any seed: the surface does not depend on it). */
function worldAt(col, seed = 424242) {
  const w = new worldMod.SectorWorld(WORLD, seed, 'ember-delve', null);
  w.center(col);
  return w;
}
/** A Keeper three cells tall can stand at `col` on the street: row 0 under them, rows −3…−1 open. */
function standable(t, col) {
  const floor = terrainMod.isOneWay(t, col, 0) || t.solid(col, 0);
  return floor && !t.solid(col, -1) && !t.solid(col, -2) && !t.solid(col, -3);
}

test('settlement: every station is reachable on foot from the town stone, along the street', () => {
  const stone = ember.EMBER_SQUARE.stone;
  for (const station of ember.EMBER_WORLD_STATIONS) {
    const col = Math.floor(station.x / CELL);
    const [a, b] = col < stone ? [col, stone] : [stone, col];
    // The ring holds 128 columns: centre it between the stone and the station.
    const t = worldAt(Math.round((a + b) / 2)).t;
    for (let c = a; c <= b; c++) assert.ok(standable(t, c), `the street at col ${c} (toward ${station.id})`);
    assert.equal(station.y, FLOOR, `${station.id} stands on the street`);
  }
  // Stations stand apart: never two within one reach of each other.
  const xs = ember.EMBER_WORLD_STATIONS.map(s => s.x).sort((p, q) => p - q);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 110, `stations ${xs[i - 1]} and ${xs[i]} are a reach apart`);
});

test('settlement: the shops are cells, protected; a swing gets the town\'s refusal', () => {
  const w = worldAt(60), t = w.t;
  const vault = ember.EMBER_BUILDINGS.find(b => b.station === 'vault');
  const roof = t.index(vault.col + 4, -10);
  assert.equal(TERRAIN_NODE_LIST[t.kind[roof]].id, 'town-roof');
  assert.equal(t.protect[roof], 1);
  assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(vault.col, -4)]].id, 'town-beam');
  assert.ok(TERRAIN_NODE_LIST[t.kind[t.index(vault.col + 2, -4)]].oneWay, 'the upper floor is floorboards');
  assert.equal(TERRAIN_NODE_LIST[nodeIndex('seam-brick')].guard.refusal, 'The town keeps its walls');
  // A blasting charge never clears a wall.
  assert.ok(!terrainMod.blastable(t, vault.col, -5, 9, () => true));
  // Back walls: brick behind the shop floor, a window upstairs.
  assert.equal(t.back[t.index(vault.col + 4, -2)], blueprints.BACK_BRICK);
  assert.ok([...Array(10).keys()].some(x => t.back[t.index(vault.col + x, -7)] === blueprints.BACK_WINDOW));
});

test('settlement: the mine head stands over the core\'s entry ledge, its ladder on the ledge', () => {
  const w = worldAt(20), t = w.t;
  assert.ok(terrainMod.isClimbable(t, 3, -1), 'the ladder reaches the ground');
  assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(3, 0)]].id, 'bedrock', 'onto the ledge (the core\'s stamp, cols 0-5)');
  const delve = ember.EMBER_WORLD_STATIONS.find(s => s.id === 'delve');
  assert.ok(Math.abs(delve.x - (3 * CELL + 16)) <= CELL, 'the mine head is the old shaft (col 3)');
});

test('settlement: the basin holds still water between its rims', () => {
  const w = worldAt(-56), t = w.t;
  for (let c = -59; c <= -56; c++) { assert.equal(t.liquidAt(c, -1), terrainMod.LIQUID_WATER); assert.equal(t.levelAt(c, -1), terrainMod.LIQUID_FULL); }
  assert.ok(t.solid(-60, -1) && t.solid(-55, -1));
});

// ── Wilds, stones, regions ──────────────────────────────────────────────────

test('wilds: hills rise only above the ground line; wild stones every eight sectors from ±12, on level ground', () => {
  for (let sx = -40; sx <= 40; sx++) {
    const stone = surface.wildStoneAt(SKY, sx);
    const want = Math.abs(sx) >= 12 && ((sx % 8) + 8) % 8 === 4;
    assert.equal(!!stone, want, `sx ${sx}`);
    if (!stone) continue;
    assert.equal(stone.id, `ember:ws:${sx}`);
    assert.ok(stone.col >= sx * SECTOR && stone.col < (sx + 1) * SECTOR);
    const g = surface.groundAt(SKY, stone.col);
    for (let d = -2; d <= 2; d++) assert.equal(surface.groundAt(SKY, stone.col + d), g, `level round ${stone.id}`);
  }
  for (let col = -2000; col < 2000; col += 7) {
    const g = surface.groundAt(SKY, col);
    assert.ok(g <= 0 && g >= -surface.HILL_MAX, `ground ${g} at ${col}`);
  }
  // The authored span is flat.
  for (let col = SKY.flat[0]; col < SKY.flat[1]; col++) assert.equal(surface.groundAt(SKY, col), 0);
  // The same stone for everyone: it hashes from the world, not the seed.
  assert.deepEqual(plain(surface.stonesIn(SKY, 10, 22).map(s => s.id)), ['ember:ws:12', 'ember:ws:20']);
});

test('regionAt: the settlement, the road, the plot, the wilds and the Delve under them all', () => {
  assert.equal(surface.regionAt(SKY, 40, -2).name, 'Basalt Seamworks');
  assert.equal(surface.regionAt(SKY, 150, -2).id, 'quarry-road');
  assert.equal(surface.regionAt(SKY, -40, -2).id, 'homestead');
  assert.equal(surface.regionAt(SKY, -40, -2).name, 'Your Homestead');
  assert.equal(surface.regionAt(SKY, 200, -2).id, 'ember-quarry');
  assert.equal(surface.regionAt(SKY, 200, -2).name, 'Ember Quarry');
  assert.equal(surface.regionAt(SKY, 900, -2).id, 'ember-wilds');
  assert.equal(surface.regionAt(SKY, -900, -2).id, 'ember-wilds');
  assert.equal(surface.regionAt(SKY, 40, 5).name, 'Ember Delve');
});

// ── Streaming ───────────────────────────────────────────────────────────────

test('streaming: the sky band rides the ring; a sky cell dug far away is saved in its sector (sy −1) and comes back', () => {
  const sectors = new Map();
  const store = {
    sector: (_a, sx, sy) => sectors.get(`${sx},${sy}`) ?? null,
    sectorChanged(_a, sx, sy, g, local, kind) {
      const key = `${sx},${sy}`, d = sectors.get(key) ?? { g, t: 1, cells: new Map(), liquids: new Map(), fog: null, receipts: new Set() };
      if (kind === null) d.cells.delete(local); else d.cells.set(local, kind);
      sectors.set(key, d);
    },
    sectorLiquids() {}, sectorExplored() {}, sectorKeys: () => [...sectors.keys()].map(k => { const [sx, sy] = k.split(',').map(Number); return { sx, sy }; }),
  };
  const persist = { seed: () => 7, cells: () => null, changed() {}, sectors: store };
  const w = new worldMod.SectorWorld(WORLD, 7, 'ember-delve', persist);
  // Far east in the wilds: a hill cell.
  const col = 20 * SECTOR + 3;
  w.center(col);
  const g = surface.groundAt(SKY, col);
  let row = g;
  if (row >= 0) { row = -1; w.t.set(col, row, nodeIndex('packed-dirt')); } else w.t.set(col, row, 0);
  w.record(w.t.index(col, row));
  assert.ok(sectors.has(`20,-1`), 'saved under the sky band\'s sector row');
  const kind = w.t.kind[w.t.index(col, row)];
  // Walk far away (the column leaves the ring and the cache), and come back.
  for (let sx = 21; sx < 60; sx++) w.center(sx * SECTOR);
  w.center(col);
  assert.equal(w.t.kind[w.t.index(col, row)], kind);
  // A sky cell's stable id round-trips.
  const id = w.cellId(col, row);
  assert.deepEqual(plain(w.cellOf(id)), { col, row });
  assert.deepEqual(plain(w.cellOf(w.cellId(-37, -20))), { col: -37, row: -20 });
  assert.deepEqual(plain(w.cellOf(w.cellId(40, 12))), { col: 40, row: 12 });
});

test('streaming: the map paints the sky band (sky, buildings) from row0', () => {
  const w = worldAt(60);
  w.reveal(50, -3, 8);
  const map = w.map();
  assert.equal(map.row0, -32);
  const rows = w.t.rows - map.row0, data = new Uint8ClampedArray(64 * rows * 4);
  map.paint(20, 84, data);
  const px = (col, row) => { const o = ((row - map.row0) * 64 + (col - 20)) * 4; return [data[o], data[o + 1], data[o + 2]]; };
  assert.notDeepEqual(px(50, -3), [20, 10, 31], 'the explored sky is not fog');
  assert.deepEqual(px(50, -30), [20, 10, 31], 'the unexplored sky is fog');
});

// ── Routines, marks, stones ─────────────────────────────────────────────────

test('routines: counter by day, the Hearth at evening, upstairs at night; a station is never closed', () => {
  assert.equal(routines.keeperSpot(9).spot, 'counter');
  assert.equal(routines.keeperSpot(18.9).spot, 'counter');
  assert.equal(routines.keeperSpot(19.5).spot, 'walk');
  assert.equal(routines.keeperSpot(21).spot, 'hearth');
  assert.equal(routines.keeperSpot(23.5).spot, 'upstairs');
  assert.equal(routines.keeperSpot(3).spot, 'upstairs');
  assert.equal(routines.keeperSpot(5.9).spot, 'upstairs');
  assert.equal(routines.keeperSpot(6).spot, 'counter');
  // The walk to the fire eases from the counter to the hearth over the hour.
  const a = routines.keeperX(19.1, 300, 1700), b = routines.keeperX(19.9, 300, 1700);
  assert.ok(a > 300 && a < b && b < 1700);
  for (let h = 0; h < 24; h += .25) assert.ok(routines.stationOpen(h), 'stations are dummy-simple: never closed by time');
  assert.equal(routines.stationPrompt(2), 'bell');
  assert.equal(routines.stationPrompt(21), 'hearth');
  assert.equal(routines.stationPrompt(10), 'counter');
});

test('head marks: ! for an offer, ? for a turn-in (the turn-in wins), none otherwise', () => {
  assert.equal(routines.headMark({ offerReady: true, turnInReady: false }, []), '!');
  assert.equal(routines.headMark({ offerReady: true, turnInReady: false }, [{ turnInReady: true }]), '?');
  assert.equal(routines.headMark(null, [{ turnInReady: false }]), '!');
  assert.equal(routines.headMark(null, []), null);
});

test('waystones: the trunk line is lit, wild stones by hand; travel only between lit stones', () => {
  const lit = waystones.isLit({ lit: [], seen: [], marks: [] }, ember.EMBER_STONES[0]);
  assert.ok(lit, 'the town stone is always lit');
  assert.ok(!waystones.isLit({ lit: [], seen: [], marks: [] }, ember.EMBER_STONES[1]));
  assert.ok(waystones.isLit({ lit: ['ember:quarry-head'], seen: [], marks: [] }, ember.EMBER_STONES[1]));
  assert.deepEqual(plain(waystones.surveyMarks(3)), []);
  assert.deepEqual(plain(waystones.surveyMarks(4)), ['sera-chart']);
  assert.deepEqual(plain(waystones.surveyMarks(8)), ['sera-chart', 'quick-hands']);
  assert.equal(waystones.channelSeconds([]), 1.5);
  assert.equal(waystones.channelSeconds(['sera-chart', 'quick-hands']), .8);
  const merged = waystones.mergeWaystones({ lit: ['ember:ws:12'], seen: ['ember:ws:12'] }, { lit: ['ember:quarry-head'], seen: ['ember:ws:20'] });
  assert.deepEqual(plain(merged.lit), ['ember:quarry-head', 'ember:ws:12']);
  assert.deepEqual(plain(waystones.mergeWaystones(merged, merged)), plain(merged));
});

// ── The engine in the world ─────────────────────────────────────────────────

/** A DelvePersistence with a sector store in memory (the way the save keeps it, minus the encoding). */
function memoryWorld(seed = 4242) {
  const sectors = new Map(), claimed = new Set(), core = new Map();
  return {
    seed: () => seed,
    cells: () => (core.size ? core : null),
    changed(_a, _l, index, kind) { if (kind === null) core.delete(index); else core.set(index, kind); },
    isClaimed: id => claimed.has(id),
    claim: id => (claimed.has(id) ? false : (claimed.add(id), true)),
    sectors: {
      sector: (_a, sx, sy) => sectors.get(`${sx},${sy}`) ?? null,
      sectorChanged(_a, sx, sy, g, local, kind) {
        const key = `${sx},${sy}`, d = sectors.get(key) ?? { g, t: 1, cells: new Map(), liquids: new Map(), fog: null, receipts: new Set() };
        if (kind === null) d.cells.delete(local); else d.cells.set(local, kind);
        sectors.set(key, d);
      },
      sectorLiquids() {}, sectorExplored() {}, sectorKeys: () => [...sectors.keys()].map(k => { const [sx, sy] = k.split(',').map(Number); return { sx, sy }; }),
    },
  };
}
function worldEngine(extra = {}) {
  let state;
  const events = { stations: [], stones: [], interact: [] };
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, {
    assets: {}, town: ember.INFERNAL_WORLD_TOWN, delve: memoryWorld(),
    onInteract: id => events.interact.push(id), onStation: s => events.stations.push(s.id), onStone: e => events.stones.push(e),
    onLoot: () => true, onWorldAction: () => true, onState: value => { state = value; }, ...extra,
  });
  return { engine, events, state: () => { engine.report(); return state; } };
}
function steps(engine, seconds) { for (let n = 0; n < Math.round(seconds * 60); n++) engine.update(1 / 60); }

test('engine: a Keeper spawns in the Seamworks on the Ember surface (the settlement is the town)', () => {
  const { engine, state } = worldEngine();
  steps(engine, .2);
  const s = state();
  assert.equal(s.areaId, 'ember-delve');
  assert.equal(s.world, 'ember');
  assert.equal(s.region, 'basalt-seamworks');
  assert.equal(s.area, 'Basalt Seamworks', 'data-area keeps the town\'s name');
  assert.ok(Math.abs(s.x - ember.EMBER_SPAWN_X) < 4 && s.y === FLOOR, `spawned at ${s.x},${s.y}`);
  assert.ok(s.delve, 'the world is diggable');
  assert.equal(s.biome, undefined, 'no Delve biome on the street');
  assert.ok(engine.inTown);
  // The keepers stand at their counters at noon.
  engine.setWorldHour(12); steps(engine, .1);
  const kael = engine.settlementKeepers.find(k => k.id === 'kael');
  const runes = ember.EMBER_WORLD_STATIONS.find(st => st.id === 'runes');
  assert.ok(kael && Math.abs(kael.x - runes.x) < 2 && !kael.upstairs);
});

test('engine: walking the street reaches each counter; E opens its panel (the vault, the vendor, the bench)', () => {
  for (const id of ['vault', 'vendor', 'crafting']) {
    const { engine, events, state } = worldEngine();
    const station = ember.EMBER_WORLD_STATIONS.find(st => st.id === id);
    engine.player.x = ember.EMBER_SPAWN_X; engine.player.y = FLOOR;
    assert.ok(engine.moveTo(station.x));
    for (let n = 0; n < 60 * 30 && engine.moving; n++) engine.update(1 / 60);
    assert.ok(Math.abs(engine.player.x - station.x) < 12, `${id}: arrived at ${engine.player.x} (counter ${station.x})`);
    assert.equal(engine.player.y, FLOOR, `${id}: on the street`);
    assert.equal(state().nearby, id);
    engine.interact();
    assert.deepEqual(plain(events.stations), [id]);
  }
});

test('engine: a dark stone is seen, lit by holding E, travelled to and back, and the town stone recalls', () => {
  const { engine, events, state } = worldEngine();
  steps(engine, .1);
  // The Quarry Head stone, the first one lit by hand: travel needs it lit, so walk there (teleport for the test).
  const at = engine.stonePoint('ember:quarry-head');
  assert.ok(at && at.col === ember.QUARRY_HEAD_COL);
  engine.placeAtPoint(at.x + 20, at.y);
  steps(engine, .2);
  assert.ok(events.stones.some(e => e.id === 'ember:quarry-head' && e.action === 'seen'), 'discovered when it comes into view');
  assert.equal(state().nearby, 'stone');
  assert.equal(state().stone.lit, false);
  engine.interact();
  engine.setUseHeld(true);
  steps(engine, .6);
  assert.ok(state().stone.charge > .3 && state().stone.charge < 1, 'the seams climb while E is held');
  steps(engine, .8);
  engine.setUseHeld(false);
  assert.ok(events.stones.some(e => e.id === 'ember:quarry-head' && e.action === 'light'), 'lit after LIGHT_HOLD');
  engine.setStoneState(new Set(['ember:quarry-head']), new Set(['ember:quarry-head']));
  assert.equal(state().stone.lit, true);
  engine.interact();
  assert.ok(events.stones.some(e => e.action === 'open'), 'E at a lit stone opens the Travel map');
  // Travel to the town stone, then back to the Quarry Head.
  assert.ok(engine.travelToStone('ember:town'));
  assert.equal(state().region, 'basalt-seamworks');
  assert.ok(Math.abs(engine.player.x - (ember.EMBER_SQUARE.stone * CELL + 16)) < 60);
  assert.ok(engine.travelToStone('ember:quarry-head'));
  assert.equal(state().region, 'ember-quarry');
  // Far into the wilds, a wild stone's point comes from its id alone.
  const wild = engine.stonePoint('ember:ws:12');
  assert.ok(wild && wild.col >= 12 * 32 && wild.col < 13 * 32);
  assert.ok(engine.travelToStone('ember:ws:12'));
  assert.equal(state().region, 'ember-wilds');
  assert.equal(engine.stonePoint('ember:ws:13'), null, 'no stone in sector 13');
  // Recall: the town stone, from anywhere.
  assert.ok(engine.travelToStone(engine.townStone));
  assert.equal(state().region, 'basalt-seamworks');
});

test('engine: the keepers keep the clock (fire at evening, upstairs at night); the station still opens (the bell)', () => {
  const { engine, events, state } = worldEngine();
  steps(engine, .1);
  const vault = ember.EMBER_WORLD_STATIONS.find(st => st.id === 'vault');
  engine.setWorldHour(21); steps(engine, .1);
  const clerk = () => engine.settlementKeepers.find(k => k.id === 'vault-clerk');
  assert.ok(Math.abs(clerk().x - (ember.EMBER_SQUARE.hearth * CELL + 16)) < 2, 'at the Hearth');
  engine.setWorldHour(2); steps(engine, .1);
  assert.ok(clerk().upstairs && clerk().y < FLOOR - 90, 'upstairs in the room over the shop');
  engine.placeAtStation('vault');
  steps(engine, .05);
  assert.equal(state().keeperAway, 'bell');
  engine.interact();
  assert.deepEqual(plain(events.stations), ['vault'], 'never closed by time');
});

test('engine: no arches (P2): the Homestead is west along the street, the Quarry Gate east opens on the beacon', () => {
  const { engine, state, events } = worldEngine();
  steps(engine, .1);
  // The Homestead's stations stand in the world, in its region, at the world's scale.
  assert.deepEqual(plain(ember.EMBER_WORLD_STATIONS.filter(s => s.kind === 'passage').map(s => s.id)), ['delve'], 'no passage left but the mine head over the Delve');
  const forge = ember.EMBER_WORLD_STATIONS.find(s => s.id === 'hs-forge');
  assert.equal(forge.x, ember.plotX(720));
  engine.placeAtStation('hs-anvil');
  steps(engine, .1);
  assert.equal(state().areaId, 'ember-delve');
  assert.equal(state().region, 'homestead');
  assert.equal(state().area, 'Your Homestead');
  engine.interact();
  assert.deepEqual(plain(events.stations), ['hs-anvil'], 'the home anvil opens its panel');
  // The Quarry Gate: barred (a swing gets its refusal), then lifted by the beacon.
  const t = engine.terrain, bars = ember.QUARRY_GATE_BARS;
  const gx = (ember.QUARRY_GATE_COL - 1) * CELL;
  engine.placeAtPoint(gx, FLOOR); steps(engine, .2);
  for (const b of bars) assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(b.col, b.row)]].id, 'gate-bar');
  engine.setTools({ pickaxe: 3 });
  engine.hitCell(bars[0].col, bars[0].row, ['pickaxe'], false);
  assert.match(engine.message, /Barred/);
  act(engine, [[['right'], 1.5]]);
  assert.ok(engine.player.x < ember.QUARRY_GATE_COL * CELL, 'the bars stop the Keeper');
  engine.setProgress({ equipped: true, restored: true });
  steps(engine, .1);
  for (const b of bars) assert.equal(t.kind[t.index(b.col, b.row)], 0, 'lifted');
  act(engine, [[['right'], 3]]);
  assert.ok(engine.player.x > (ember.QUARRY_GATE_COL + 6) * CELL, `through the gate (${engine.player.x})`);
  assert.equal(state().region, 'ember-quarry');
  assert.equal(state().area, 'Ember Quarry');
});

test('the Quarry and the Homestead grow the Living World\'s ashwoods; its nodes stand on the Quarry\'s street', () => {
  const t = worldAt(200).t;
  assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(197, -1)]].id, 'ashwood-trunk');
  assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(197, -5)]].id, 'ashwood-crown');
  const home = worldAt(-60).t;
  assert.equal(TERRAIN_NODE_LIST[home.kind[home.index(-70, -1)]].id, 'ashwood-trunk');
  for (const n of ember.EMBER_QUARRY_WORLD_NODES) {
    const col = Math.floor(n.x / CELL);
    assert.ok(col >= ember.QUARRY_GATE_COL + 5 && col < ember.HIGH_ROADS_COL, `${n.id} between the gate and the High Roads`);
    assert.ok(standable(t, col), `${n.id} on the street`);
  }
});

// ── The High Roads in cells, and parkour (terrain-moves.ts) ────────────────

const moves = load('play/engine/terrain-moves.ts');
const BOX = { halfWidth: 13, height: 90 };

test('terrain-moves: a lip within the hands\' reach is caught, mantled, let go of; a wall-jump kicks off', () => {
  // A block of rock from row 5 down, cols 6+ of a small grid, open to the west.
  const t = new Terrain(12, 12, 0);
  for (let c = 6; c < 12; c++) for (let r = 5; r < 12; r++) t.set(c, r, nodeIndex('rock'));
  const face = 6 * CELL;
  // Feet 70 px under the lip (row 5's top = 160), pushing east, falling: caught.
  const b = { x: face - BOX.halfWidth, y: 160 + 70, vy: 50, grounded: false };
  const m = new moves.TerrainMover();
  m.after(t, b, BOX, { dir: 1, jump: false, down: false }, 1 / 60);
  assert.equal(m.mode, 'hang');
  assert.equal(b.y, 160 + moves.HANG_DROP);
  // Jump mantles onto the top.
  assert.ok(m.pressJump(t, b, BOX, { dir: 0, jump: true, down: false }, false));
  for (let n = 0; n < 30; n++) m.hold(b, BOX, { dir: 0, jump: false, down: false }, 1 / 60);
  assert.equal(m.mode, 'free'); assert.equal(b.y, 160); assert.ok(b.x > face && b.grounded);
  // Too far under the lip: no grab. Down held: no grab.
  const low = { x: face - BOX.halfWidth, y: 160 + 140, vy: 50, grounded: false };
  const m2 = new moves.TerrainMover(); m2.after(t, low, BOX, { dir: 1, jump: false, down: false }, 1 / 60);
  assert.equal(m2.mode, 'free');
  const m3 = new moves.TerrainMover(); m3.after(t, { x: face - BOX.halfWidth, y: 230, vy: 50, grounded: false }, BOX, { dir: 1, jump: false, down: true }, 1 / 60);
  assert.equal(m3.mode, 'free');
  // Down lets go of a hang.
  const h = { x: face - BOX.halfWidth, y: 230, vy: 50, grounded: false }, m4 = new moves.TerrainMover();
  m4.after(t, h, BOX, { dir: 1, jump: false, down: false }, 1 / 60);
  m4.hold(h, BOX, { dir: 0, jump: false, down: true }, 1 / 60);
  assert.equal(m4.mode, 'free');
  // A wall touched in the air, Jump away: a wall-jump west.
  const w = { x: face - BOX.halfWidth, y: 330, vy: 100, grounded: false }, m5 = new moves.TerrainMover();
  m5.after(t, w, BOX, { dir: 1, jump: false, down: true }, 1 / 60);
  assert.ok(m5.pressJump(t, w, BOX, { dir: -1, jump: true, down: false }, false));
  assert.equal(m5.event, 'walljump'); assert.equal(w.vy, -moves.WALL_JUMP);
  assert.ok(m5.velocity(0, 1 / 60) < 0, 'kicked west');
});

/** After a jump at a lip: let go of everything; a hang is mantled with a fresh Jump (an already-mantled body just stands). */
function settle(engine) {
  act(engine, [[[], .05]]);
  if (engine.moves.mode === 'hang') act(engine, [[['jump'], .1]]);
  act(engine, [[[], .5]]);
}
/** Hold right until the Keeper's x passes `x` (a few seconds at most). */
function walkRight(engine, x) {
  engine.setInput('right', true);
  for (let n = 0; n < 600 && engine.player.x < x; n++) engine.update(1 / 60);
  engine.setInput('right', false);
}
/** Run an engine with held inputs: [inputs, seconds] steps. */
function act(engine, plan) {
  for (const [inputs, seconds] of plan) {
    for (const a of ['left', 'right', 'jump', 'down']) engine.setInput(a, inputs.includes(a));
    steps(engine, seconds);
  }
  for (const a of ['left', 'right', 'jump', 'down']) engine.setInput(a, false);
}

test('the High Roads: every piece of the route is climbed on cells, and each find stands on its top', () => {
  const { engine, state } = worldEngine();
  steps(engine, .1);
  engine.setProgress({ equipped: true, restored: true });
  const R = blueprints.HIGH_ROADS, C = ember.HIGH_ROADS_COL;
  const top = up => FLOOR - up * CELL;
  const at = (col, feet) => { engine.placeAtPoint(col * CELL, feet); steps(engine, .1); };
  // 1. The shelf: from the street, run at its west face and jump: the hands catch, Jump mantles.
  at(C + R.shelf.dx - 1.5, FLOOR);
  act(engine, [[['right', 'jump'], .45]]); settle(engine);
  assert.equal(engine.player.y, top(R.shelf.top), `on the shelf (${engine.player.x},${engine.player.y})`);
  // 2. The tree: Up at the trunk climbs to the canopy.
  at(C + R.tree.dx + .5, FLOOR);
  act(engine, [[['jump'], 3.5], [[], .3]]);
  assert.equal(engine.player.y, top(R.tree.top), `in the canopy (${engine.player.x},${engine.player.y})`);
  // The canopy, the ruin, the bridge and the mesa are one walk.
  act(engine, [[['right'], 2.6]]);
  assert.equal(engine.player.y, top(R.mesa.top), `walked onto the mesa (${engine.player.x},${engine.player.y})`);
  // 3. The snag: climb it, kick east off it, the hands catch the block's lip, then mantle.
  at(C + R.snag.dx + .5, FLOOR);
  act(engine, [[['jump'], 4.5]]);
  act(engine, [[['right', 'jump'], .05], [['right'], .5]]); settle(engine);
  assert.equal(engine.player.y, top(R.block.top), `on the block (${engine.player.x},${engine.player.y})`);
  // 4. The slab, then the spire: walk to the edge, jump into the face, catch, mantle.
  walkRight(engine, (C + R.block.dx + R.block.w) * CELL - 4);
  act(engine, [[['right', 'jump'], .4]]); settle(engine);
  assert.equal(engine.player.y, top(R.slab.top), `on the slab (${engine.player.x},${engine.player.y})`);
  walkRight(engine, (C + R.slab.dx + R.slab.w) * CELL - 4);
  act(engine, [[['right', 'jump'], .3]]); settle(engine);
  assert.equal(engine.player.y, top(R.spire.top), `on the spire (${engine.player.x},${engine.player.y})`);
  assert.ok(R.spire.top >= 22, 'the summit is about 22 rows up');
  // Every find stands on a solid or one-way top, never inside a cell.
  const t = engine.terrain;
  for (const f of ember.EMBER_HIGH_ROADS.finds) {
    const col = Math.floor(f.x / CELL), row = t.rowAt(f.y);
    assert.ok(t.solid(col, row) || terrainMod.isOneWay(t, col, row), `${f.id} stands on something`);
    assert.ok(!t.solid(col, row - 1), `${f.id} is open above`);
  }
  // The summit find is in reach on the spire top.
  const summit = ember.EMBER_HIGH_ROADS.finds.find(f => f.kind === 'summit');
  engine.placeAtPoint(summit.x, summit.y); steps(engine, .1);
  assert.equal(state().height?.id, 'ember-quarry:summit');
});

test('parkour in the Delve: a pit four cells deep is climbed out with a grab and a mantle', () => {
  const { engine } = worldEngine();
  steps(engine, .1);
  const t = engine.terrain;
  // A pit two wide, four rows deep, at cols 20-21 (rows 0..3), a rock floor under it.
  for (let r = 0; r <= 3; r++) for (const c of [20, 21]) t.set(c, r, 0);
  t.set(20, 4, nodeIndex('rock')); t.set(21, 4, nodeIndex('rock'));
  for (let r = 0; r <= 4; r++) { t.set(19, r, nodeIndex('rock')); t.set(22, r, nodeIndex('rock')); }
  engine.placeAtPoint(20.5 * CELL, FLOOR + 4 * CELL); steps(engine, .2);
  assert.equal(engine.player.y, FLOOR + 4 * CELL);
  act(engine, [[['left', 'jump'], .45]]); settle(engine);
  assert.ok(engine.player.y <= FLOOR, `out of the pit (${engine.player.x},${engine.player.y})`);
});

test('parkour never leaves the Keeper inside a solid cell (4000 random frames on the High Roads)', () => {
  const { engine } = worldEngine();
  steps(engine, .1);
  engine.setProgress({ equipped: true, restored: true });
  engine.placeAtPoint((ember.HIGH_ROADS_COL + 20) * CELL, FLOOR); steps(engine, .1);
  let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
  const t = engine.terrain;
  for (let n = 0; n < 4000; n++) {
    if (n % 12 === 0) for (const a of ['left', 'right', 'jump', 'down']) engine.setInput(a, rnd() < (a === 'down' ? .1 : .4));
    engine.update(1 / 60);
    assert.ok(!terrainMod.boxHits(t, engine.player.x, engine.player.y, BOX), `inside a solid at frame ${n} (${engine.player.x}, ${engine.player.y})`);
  }
});

test('engine: the town\'s walls refuse a swing and a placed block; the street\'s dirt digs', () => {
  const { engine, state } = worldEngine();
  steps(engine, .1);
  const vault = ember.EMBER_BUILDINGS.find(b => b.station === 'vault');
  const t = engine.terrain;
  engine.setTools({ pickaxe: 3, axe: 3 });
  engine.player.x = (vault.col + .5) * CELL; engine.player.y = FLOOR;
  engine.hitCell(vault.col, -4, ['pickaxe', 'axe'], false);
  assert.equal(TERRAIN_NODE_LIST[t.kind[t.index(vault.col, -4)]].id, 'town-beam', 'the beam stands');
  assert.match(engine.message, /The town keeps its walls/);
  assert.equal(engine.placeCell(vault.col + 3, -1, 'packed-dirt'), false, 'no block inside a shop');
  // The street itself is the Delve's dirt: it digs (the world is diggable).
  const col = 18;
  engine.player.x = (col + .5) * CELL;
  engine.hitCell(col, 0, ['pickaxe'], false); engine.hitCell(col, 0, ['pickaxe'], false); engine.hitCell(col, 0, ['pickaxe'], false);
  assert.equal(t.kind[t.index(col, 0)], 0);
  assert.equal(state().areaId, 'ember-delve');
});
