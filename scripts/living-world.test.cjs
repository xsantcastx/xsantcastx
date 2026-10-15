// The Living World (docs/handoff/living-world.md): the streamed world is never empty.
// The guard: the longest stretch with nothing interesting in it must stay under the
// targets in living-world.ts LIVING_TARGET, on the surface and in every stratum, on
// several seeds. Plus the rules behind it (determinism, finds clear of structures and
// the core, mysteries per day), and the engine: packs on a budget near the Keeper,
// critters caught, a hermit's door read, a mystery touched.
//
//   node --test scripts/living-world.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const { survey } = require('./living-world-survey.cjs');

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
const living = load('play/engine/living-world.ts');
const art = load('play/engine/critter-art.ts');
const gen = load('play/engine/sector-gen.ts');
const surface = load('play/engine/surface-gen.ts');
const worldMod = load('play/engine/sector-world.ts');
const ember = load('play/world/worlds/ember.world.ts');
const { CELL, TERRAIN_NODE_LIST, nodeIndex } = load('play/engine/terrain.ts');
const { SECTOR } = gen;
const SPEC = ember.EMBER_WORLD.terrain;
const SKY = ember.EMBER_SURFACE;
const SEEDS = [1, 424242, 0x5eedde1e, 77, 0xdeadbeef];
const FLOOR = SPEC.top;
const T = living.LIVING_TARGET;
const plain = value => JSON.parse(JSON.stringify(value));

// ── The guard ───────────────────────────────────────────────────────────────

test('density guard: never more than the target between interesting things, on the surface and in every stratum', () => {
  const out = survey({ sectors: 64, seeds: SEEDS });
  assert.ok(out.living, 'living-world.ts is in the tree');
  assert.ok(out.maxGap.surface.cols <= T.surfaceGapCols, `surface: ${out.maxGap.surface.cols} cells between interesting things (target ${T.surfaceGapCols})`);
  for (const [stratum, gap] of Object.entries(out.maxGap.underground)) {
    assert.ok(gap.cols <= T.undergroundGapCols, `${stratum}: ${gap.cols} cells between finds (target ${T.undergroundGapCols})`);
  }
  assert.equal(out.emptySectorShare, 0, 'no sector column with nothing at all');
  assert.ok(out.avgPerSector.critters >= 3, `critters ${out.avgPerSector.critters} a sector`);
  assert.ok(out.avgPerSector.trees >= 1, `trees ${out.avgPerSector.trees} a sector`);
  assert.ok(out.avgPerSector.npcs > 0, 'hermits live out there');
});

test('surface rules: a tree in every wild sector, a point of interest or a stone at least every 3 sectors, a pack or a POI in each', () => {
  let lastPoi = { east: 7, west: -5 };
  for (let k = 0; k < 300; k++) for (const [side, sx] of [['east', 8 + k], ['west', -5 - k]]) {
    const plan = surface.livingPlan(SKY, sx);
    assert.ok(plan, `sx ${sx} is wild`);
    assert.ok(plan.trees.length >= T.treesPerSector, `sx ${sx}: ${plan.trees.length} trees`);
    const stone = !!surface.wildStoneAt(SKY, sx);
    if (plan.poi || stone) {
      assert.ok(Math.abs(sx - lastPoi[side]) <= T.poiGapSectors, `${side}: ${Math.abs(sx - lastPoi[side])} sectors without a point of interest before ${sx}`);
      lastPoi[side] = sx;
    } else {
      const ground = c => surface.groundAt(SKY, c);
      assert.ok(living.packFor(SKY.salt, sx, living.areaLevel(living.wildDepth(SKY, sx)), ground, false), `sx ${sx}: neither a POI nor a pack`);
    }
    // Same in, same out.
    assert.deepEqual(plain(surface.livingPlan(SKY, sx)), plain(plan));
  }
});

test('surface: trees stand on the ground, crowns over trunks, POIs on a level footing; rows ≥ 0 untouched', () => {
  const TRUNK = nodeIndex('ashwood-trunk'), CROWN = nodeIndex('ashwood-crown');
  for (const sx of [9, 13, 21, -9, -30, 57]) {
    const col = surface.surfaceColumn(SKY, sx);
    const at = (c, r) => col.kind[(r - SKY.rowLo) * SECTOR + (c - sx * SECTOR)];
    for (const tree of col.plan.trees) {
      const g = surface.groundAt(SKY, tree.col);
      for (let k = 1; k <= tree.height; k++) assert.equal(at(tree.col, g - k), TRUNK, `sx ${sx}: trunk at ${tree.col},${g - k}`);
      assert.equal(at(tree.col, g - tree.height - 1), CROWN);
      assert.ok(TERRAIN_NODE_LIST[TRUNK].climb && TERRAIN_NODE_LIST[CROWN].oneWay, 'climbed like a rope, stood on like a platform');
    }
    // Every carved word is one the play view can show.
    for (const id of col.notes.values()) assert.ok(living.LIVING_NOTE_IDS.includes(id.slice('living:'.length)), id);
  }
});

// ── Underground finds ───────────────────────────────────────────────────────

test('finds: in their own column, clear of structures and the core, protected strongboxes, every kind somewhere', () => {
  const kinds = new Set();
  for (const seed of SEEDS) {
    const ctx = gen.sectorContext(SPEC, seed);
    for (const sx of [-20, -9, -5, -2, -1, 0, 3, 4, 5, 9, 14, 30, 61]) {
      const g = gen.generateSectorColumn(ctx, sx);
      if (sx >= 0 && sx <= 3) { assert.equal((g.finds ?? []).length, 0, `the core's column ${sx} has no finds`); continue; }
      for (const f of g.finds) {
        kinds.add(f.kind);
        assert.ok(f.col >= sx * SECTOR && f.col + f.w <= (sx + 1) * SECTOR, `${f.kind} inside column ${sx}`);
        assert.ok(f.row >= 3 && f.row + f.h < SPEC.rows - SPEC.bedrock, `${f.kind} inside the shipped strata`);
        for (const s of g.structures) {
          const overlap = f.col < s.col + s.w + 1 && f.col + f.w > s.col - 1 && f.row < s.row + s.h + 1 && f.row + f.h > s.row - 1;
          assert.ok(!overlap, `${f.kind} at ${f.col},${f.row} clear of ${s.kind}`);
        }
      }
      for (let i = 0; i < SECTOR * SPEC.rows; i++) {
        const id = TERRAIN_NODE_LIST[g.kind[i]].id;
        if (id === 'old-strongbox' || id === 'ember-strongbox') assert.equal(g.protect[i], 1, 'a strongbox stands through a charge');
      }
      for (const id of g.notes.values()) if (id.startsWith('living:')) assert.ok(living.LIVING_NOTE_IDS.includes(id.slice(7)), id);
    }
  }
  for (const k of ['fossil-bed', 'cellar', 'geode', 'den', 'machine', 'pool']) assert.ok(kinds.has(k), `a ${k} somewhere`);
});

test('finds: a den\'s pack grows with the area level; an elder is one tough creature', () => {
  assert.ok(living.packScale(0) === 1 && living.packScale(10) > living.packScale(2) && living.packScale(500) <= 3);
  assert.ok(living.areaLevel(20, 3) > living.areaLevel(20, 0) && living.areaLevel(20) > living.areaLevel(2));
  let elder = null;
  for (const seed of SEEDS) for (let sx = 6; sx < 80 && !elder; sx++) {
    const g = gen.generateSectorColumn(gen.sectorContext(SPEC, seed), sx);
    if (g.finds.some(f => f.kind === 'elder')) elder = g.halls.find(h => h.count === 1 && h.creature === 'cinder-bailiff');
  }
  assert.ok(elder && elder.scale >= 2.2 && elder.near, 'a Bailiff elder, far tougher, spawned near');
});

// ── Mysteries and critters ──────────────────────────────────────────────────

test('mysteries: the same day gives the same, the next day others; about one column in four; never in town', () => {
  const day = 20500;
  const a = [], b = [];
  for (let sx = -60; sx < 60; sx++) { a.push(living.mysteryAt(424242, day, sx)); b.push(living.mysteryAt(424242, day + 1, sx)); }
  assert.deepEqual(plain(a), plain(Array.from({ length: 120 }, (_, k) => living.mysteryAt(424242, day, k - 60))));
  assert.notDeepEqual(plain(a), plain(b), 'a door that was not there yesterday');
  const share = a.filter(Boolean).length / a.length;
  assert.ok(share > .12 && share < .4, `share ${share}`);
  for (let sx = 0; sx < 4; sx++) assert.equal(living.mysteryAt(424242, day, sx), null);
  for (const m of a.filter(Boolean)) assert.ok(m.id.startsWith(`${day}:`) && ['wisp', 'whisper', 'door'].includes(m.kind));
});

test('critters: deterministic, day and night differ, glowworms hang from rock, fish only over water', () => {
  const world = new worldMod.SectorWorld(SPEC, 424242, 'ember-delve', null);
  world.center(16 * SECTOR);
  const column = world.column(15);
  const o = hour => ({ sx: 15, hour, seed: 424242, rowLo: world.rowLo, rows: SPEC.rows, kind: column.kind, liqLevel: column.liqLevel,
    ground: c => surface.groundAt(SKY, c), wild: true, plan: column.gen.living, finds: column.gen.finds });
  const noon = living.crittersFor(o(12)), night = living.crittersFor(o(0));
  assert.deepEqual(plain(living.crittersFor(o(12))), plain(noon));
  assert.ok(noon.some(c => c.critter === 'cinder-finch' || c.critter === 'ash-hare' || c.critter === 'ember-beetle'), 'day critters');
  assert.ok(!noon.some(c => c.critter === 'dusk-moth') && !night.some(c => c.critter === 'cinder-finch'), 'moths by night, finches by day');
  const at = (c, r) => (r - world.rowLo) * SECTOR + (c - 15 * SECTOR);
  for (const c of [...noon, ...night]) {
    if (c.on === 'ceiling') assert.ok(TERRAIN_NODE_LIST[column.kind[at(c.col, c.row - 1)]].solid, 'a glowworm hangs from rock');
    if (c.on === 'water') assert.ok(column.liqLevel[at(c.col, c.row)] > 0, 'a fish leaps from water');
    assert.ok(living.CRITTERS[c.critter], c.critter);
  }
});

test('critter art: every frame painted, inside its sheet cell, with the one outline', () => {
  for (const id of [...living.CRITTER_IDS, 'door']) {
    const { w, h } = art.frameSize(id);
    const frames = art.CRITTER_ART[id].frames;
    assert.ok(frames.length >= 2, `${id}: at least two frames`);
    for (let f = 0; f < frames.length; f++) {
      assert.ok(frames[f].every(row => row.length <= w) && frames[f].length === h, `${id} frame ${f}: one size`);
      let painted = 0, outline = 0;
      for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
        const c = art.critterPixel(id, f, x, y);
        if (c) painted++;
        if (c === '#140c1c') outline++;
      }
      assert.ok(painted > 10 && outline > 4, `${id} frame ${f}: ${painted} px, ${outline} outline`);
      for (const ch of frames[f].join('')) if (ch !== '.') assert.ok(art.CRITTER_ART[id].palette[ch], `${id}: slot ${ch}`);
    }
  }
});

// ── The engine ──────────────────────────────────────────────────────────────

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
  const events = { discover: [], catches: [] };
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, {
    assets: {}, town: ember.INFERNAL_WORLD_TOWN, delve: memoryWorld(),
    onDiscover: e => events.discover.push(e), onCatch: e => events.catches.push(e),
    onLoot: () => true, onWorldAction: () => true, onState: () => {}, ...extra,
  });
  return { engine, events };
}
function steps(engine, seconds) { for (let n = 0; n < Math.round(seconds * 60); n++) engine.update(1 / 60); }
const groundY = col => FLOOR + surface.groundAt(SKY, col) * CELL;

test('engine: a wild pack waits until the Keeper is near, wears the night\'s creature by night, scales, and keeps the budget', () => {
  for (const hour of [12, 0]) {
    const { engine } = worldEngine();
    engine.setWorldHour(hour);
    steps(engine, .1);
    // The first wild column with a pack, far enough out to have a level.
    let sx = 14, pack = null;
    for (; sx < 80 && !pack; sx++) {
      const plan = surface.livingPlan(SKY, sx);
      const safe = plan.poi && (plan.poi.kind === 'hermit' || plan.poi.kind === 'shrine');
      pack = living.packFor(SKY.salt, sx, living.areaLevel(living.wildDepth(SKY, sx)), c => surface.groundAt(SKY, c), !!safe);
    }
    assert.ok(pack, 'a pack out there');
    const x = (pack.col0 + pack.col1) / 2 * CELL;
    // Arrive a few screens short of it: the column is loaded, the pack not yet awake.
    engine.placeAtPoint(x - 2400, groundY(Math.floor((x - 2400) / CELL)));
    steps(engine, .5);
    const inPack = () => engine.monsters.filter(m => m.def.range && m.def.range[0] === pack.col0 * CELL + 40);
    assert.equal(inPack().length, 0, 'asleep while far');
    engine.placeAtPoint(x - 300, groundY(Math.floor((x - 300) / CELL)));
    steps(engine, .6);
    const up = inPack();
    assert.equal(up.length, pack.count, 'awake when near');
    const creature = hour === 0 ? 'cinder-bailiff' : 'rivet-maw';
    assert.ok(up.every(m => m.def.creature === creature), `${creature} at ${hour}h`);
    const base = ember.EMBER_WORLD.monsters.find(m => m.creature === creature && !m.once && !m.summoned);
    assert.ok(up[0].maxHp >= base.hp, 'scaled to its area level');
    assert.ok(engine.monsters.filter(m => m.sx !== undefined && m.hp > 0).length <= living.WILD_BUDGET + 3, 'the wild budget');
    engine.destroy();
  }
});

test('engine: critters come with their column, a swing catches a beetle, a hermit\'s door is read, the day\'s mystery is touched', () => {
  // A hermit somewhere east.
  let hermitSx = null;
  for (let sx = 8; sx < 200 && hermitSx === null; sx++) if (surface.livingPlan(SKY, sx)?.poi?.kind === 'hermit') hermitSx = sx;
  assert.ok(hermitSx !== null, 'a hermit in the first 200 sectors');
  const poi = surface.livingPlan(SKY, hermitSx).poi;
  const { engine, events } = worldEngine();
  engine.setWorldHour(12);
  steps(engine, .1);
  // The lean-to stands on a level footing: the span's highest ground.
  let base = 0;
  for (let k = 0; k < poi.w; k++) base = Math.min(base, surface.groundAt(SKY, poi.col + k));
  const footY = FLOOR + base * CELL;
  engine.placeAtPoint(poi.npcCol * CELL + 16, footY);
  steps(engine, .4);
  assert.ok(engine.wildCounts().critters > 0, 'critters round the Keeper');
  assert.ok(engine.wildCounts().hermits >= 1, 'the hermit stands at home');
  // Read the door: the sign two cells east of the hermit.
  engine.placeAtPoint((poi.col + 5) * CELL + 16, footY);
  steps(engine, .2);
  engine.interact();
  assert.ok(events.discover.some(e => e.kind === 'inscription' && e.id === `living:${poi.note}`), `read ${poi.note}`);
  // A beetle: stand beside one, face it, swing.
  const beetle = engine.wild.critters.find(c => c.spawn.critter === 'ember-beetle');
  assert.ok(beetle, 'a beetle somewhere in the ring (the wilds by day, the Basalt and Magma floors)');
  engine.facing = 1;
  beetle.x = engine.player.x + 30; beetle.y = engine.player.y;
  engine.attack();
  assert.ok(events.catches.some(e => e.critter === 'ember-beetle'), 'caught');
  assert.equal(engine.wild.catchAt(engine.player.x, engine.player.y, 1), null, 'once caught, it is gone');
  engine.destroy();
});

test('engine: a door that was not there yesterday opens with E and pays once (the host is told)', () => {
  // Find a day and a column whose mystery is a door, and the engine's clock on that day.
  let found = null;
  for (let day = 20500; day < 20600 && !found; day++) for (let sx = 6; sx < 40 && !found; sx++) {
    const m = living.mysteryAt(4242, day, sx);
    if (m && m.kind === 'door') found = { day, sx, m };
  }
  assert.ok(found);
  const { engine, events } = worldEngine({ now: () => found.day * 86_400_000 + 3600_000 });
  steps(engine, .1);
  engine.placeAtPoint(found.m.col * CELL, groundY(found.m.col));
  steps(engine, .2);
  const placed = engine.wild.mysteries.find(p => p.m.id === found.m.id);
  assert.ok(placed, 'the door is set in its column');
  engine.placeAtPoint(placed.x, placed.y);
  steps(engine, .05);
  engine.interact();
  assert.ok(events.discover.some(e => e.kind === 'mystery' && e.id === found.m.id), 'the host hears of it');
  assert.ok(engine.wild.mysteries.find(p => p.m.id === found.m.id).found, 'it stays open');
  engine.destroy();
});
