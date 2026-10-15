// The Lost Cabinets (src/app/shared/cabinets): every cabinet stands somewhere
// real in the engine's world, a Delve cabinet is set into a cell a pickaxe can
// reach on every seed, and the engine draws, reaches and reports a shown one
// and hands E to the host. Same loader as realm-delves.test.cjs.
//
//   node --test scripts/lost-cabinets.test.cjs
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
const region = load('shared/delve/delve-region.model.ts');
const rift = load('shared/delve/rift-gates.model.ts');
const world = load('play/world/world.model.ts');
const heights = load('play/world/heights.ts');
const cab = load('shared/cabinets/cabinets.model.ts');
const ember = load('play/world/worlds/ember.world.ts');
const worldMod = load('play/engine/sector-world.ts');
const { CELL, TERRAIN_NODE_LIST } = terrainMod;
const FLOOR = 610;
const SEEDS = [1, 424242, 0x5eedde1e, 0xdeadbeef, 77];

/** Every area the engine can stand in, by id. */
function areas() {
  const out = new Map();
  for (const town of Object.values(world.TOWNS)) {
    if (!town) continue;
    out.set(town.id, town);
    for (const hunt of town.hunts ?? []) out.set(hunt.id, hunt);
  }
  return out;
}

/** A Delve persistence that keeps each area's sectors apart (as realm-delves.test.cjs). */
function memoryDelve(seed) {
  const cores = new Map(), sectors = new Map(), claimed = new Set();
  const key = (area, sx, sy) => `${area}|${sx},${sy}`;
  const core = area => { let c = cores.get(area); if (!c) { c = new Map(); cores.set(area, c); } return c; };
  const diff = (area, sx, sy, g) => { let d = sectors.get(key(area, sx, sy)); if (!d || d.g !== g) { d = { g, t: 0 }; sectors.set(key(area, sx, sy), d); } return d; };
  return {
    seed: area => (rift.realmOfArea(area) ? rift.realmSeed(seed, rift.realmOfArea(area)) : seed),
    cells: area => (core(area).size ? core(area) : null),
    changed(area, _layout, index, kind) { if (kind === null) core(area).delete(index); else core(area).set(index, kind); },
    seenCells: (_a, _l, cells) => new Uint8Array((cells + 7) >> 3),
    explored() {}, liquids: () => null, liquidsChanged() {},
    isClaimed: f => claimed.has(f), claim: f => (claimed.has(f) ? false : (claimed.add(f), true)),
    sectors: {
      sector(area, sx, sy) { const d = sectors.get(key(area, sx, sy)); return d ? { g: d.g, t: d.t, cells: region.decodeRuns(d.c), liquids: region.decodeRuns(d.l), fog: region.decodeFog(d.f), receipts: region.decodeIndexSet(d.k) } : null; },
      sectorChanged(area, sx, sy, g, local, kind) { const d = diff(area, sx, sy, g), cells = region.decodeRuns(d.c); if (kind === null) cells.delete(local); else cells.set(local, kind); d.c = region.encodeRuns(cells); },
      sectorLiquids() {}, sectorExplored() {},
      sectorKeys: area => [...sectors.keys()].filter(k => k.startsWith(`${area}|`)).map(k => { const [sx, sy] = k.split('|')[1].split(',').map(Number); return { sx, sy }; }),
    },
  };
}
function fixture(delve) {
  let state;
  const cabinets = [];
  const engine = new Engine({
    getContext: () => ({ setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 720 }),
    parentElement: { clientWidth: 1200, clientHeight: 720, getBoundingClientRect: () => ({ width: 1200, height: 720 }) },
  }, { assets: {}, onInteract() {}, onLoot: () => true, onWorldAction: () => true, onUse() {}, onCabinet: e => cabinets.push(e), onState: value => { state = value; }, delve });
  return { engine, cabinets, state: () => { engine.report(); return state; } };
}
const kindAt = (engine, col, row) => TERRAIN_NODE_LIST[engine.terrain.kind[engine.terrain.index(col, row)]];

// ── Where they stand ────────────────────────────────────────────────────────

test('placement: sixteen cabinets, one curio each, every area real, every surface one on ground the Keeper can stand on', () => {
  assert.equal(cab.CABINETS.length, 16);
  assert.equal(new Set(cab.CABINETS.map(c => c.curio)).size, 16, 'a curio per cabinet');
  const all = areas();
  for (const c of cab.CABINETS) {
    // One World (P2): the Seamworks' and the Quarry's stand on the Ember world's surface (its cells).
    if (c.area === 'ember-delve' && !c.delve) {
      const w = new worldMod.SectorWorld(ember.EMBER_WORLD.terrain, 424242, 'ember-delve', null);
      const col = Math.floor(c.x / CELL), row = Math.round((c.y - FLOOR) / CELL);
      w.center(col);
      const t = w.t;
      assert.ok(t.solid(col, row) || terrainMod.isOneWay(t, col, row), `${c.id}: stands on a floor (${col},${row})`);
      for (let r = row - 3; r < row; r++) assert.ok(!t.solid(col, r), `${c.id}: room to stand (${col},${r})`);
      for (const s of ember.EMBER_WORLD_STATIONS) assert.ok(Math.abs(s.x - c.x) > world.STATION_REACH || Math.abs((s.y ?? FLOOR) - c.y) > 60, `${c.id}: clear of station ${s.id}`);
      continue;
    }
    const area = all.get(c.area);
    assert.ok(area, `${c.id}: area ${c.area} exists`);
    assert.ok(c.x > 0 && c.x < area.width, `${c.id}: x ${c.x} inside ${c.area} (${area.width})`);
    if (c.delve) { assert.ok(area.terrain, `${c.id}: a Delve cabinet stands in a Delve`); continue; }
    if (c.place === 'heights') {
      const h = heights.HUNT_HEIGHTS[c.area];
      const tops = [...h.ledges.map(l => ({ x: l.x, w: l.width, y: l.y })), ...h.solids.map(s => ({ x: s.x, w: s.w, y: s.y }))];
      assert.ok(tops.some(t => c.x >= t.x && c.x <= t.x + t.w && t.y === c.y), `${c.id}: on a High Road ledge at y ${c.y}`);
      assert.ok(c.y < FLOOR - 200, `${c.id}: really up high`);
    } else {
      // The floor, or one of the area's own platforms (the Seamworks' camp ledge).
      assert.ok((area.platforms ?? []).some(p => p.y === c.y && c.x >= p.x && c.x <= p.x + p.width), `${c.id}: on a platform at y ${c.y}`);
    }
    // Never on a station's spot (STATION_REACH) at floor level: standing on the cabinet is never standing at a station.
    if (c.y === FLOOR) for (const s of area.stations ?? []) assert.ok(Math.abs(s.x - c.x) > world.STATION_REACH, `${c.id}: clear of station ${s.id}`);
  }
});

test('placement: every Delve cabinet is set into a cell a pickaxe can open, inside its core, on every seed', () => {
  const byArea = new Map();
  for (const c of cab.CABINETS.filter(c => c.delve)) (byArea.get(c.area) ?? byArea.set(c.area, []).get(c.area)).push(c);
  for (const seed of SEEDS) {
    const f = fixture(memoryDelve(seed));
    // Into the Ember Delve through the Seamworks shaft.
    const shaft = f.engine.places.find(station => station.id === 'delve');
    f.engine.player.x = shaft.x; f.engine.player.y = FLOOR; f.engine.interact();
    assert.equal(f.state().areaId, 'ember-delve');
    for (const [areaId, list] of byArea) {
      if (areaId !== 'ember-delve') assert.ok(f.engine.enterRealm(areaId, { col: 60, row: 60 }), `${areaId}: entered`);
      const t = f.engine.terrain;
      for (const c of list) {
        const col = Math.floor(c.x / CELL), row = Math.round((c.y - FLOOR) / CELL) - 1;
        assert.equal(c.x, col * CELL + CELL / 2, `${c.id}: centred in its cell`);
        assert.ok(col >= 2 && col < t.cols - 2 && row >= 0 && row < t.rows - 2, `${c.id}: inside the core (${col},${row})`);
        if (f.engine.world) f.engine.world.center(col);
        const node = kindAt(f.engine, col, row);
        assert.notEqual(node.id, 'bedrock', `${c.id} seed ${seed}: not bedrock`);
        assert.ok(Number.isFinite(node.hp), `${c.id} seed ${seed}: ${node.id} can be dug`);
        // And the cell beside it, where the Keeper stands to open it.
        const side = kindAt(f.engine, col - 1, row);
        assert.ok(Number.isFinite(side.hp), `${c.id} seed ${seed}: the cell beside it (${side.id}) can be dug`);
      }
      if (areaId !== 'ember-delve') { f.engine.leaveRealm?.(); }
    }
  }
});

// ── The engine: draw, reach, report, E ──────────────────────────────────────

test('engine: a shown cabinet is reached, reported and opened with E; a hidden one is nothing', () => {
  const f = fixture(memoryDelve(1));
  // The mechanics, on the old town's camp ledge (a mark is wherever the host says it is).
  const c = { id: 'cab-seamworks', area: 'infernal', x: 790, y: 410 };
  assert.equal(f.state().areaId, 'infernal');
  // Stand beside it on its ledge, hidden: nothing to reach.
  f.engine.player.x = c.x; f.engine.player.y = c.y; f.engine.player.grounded = true;
  assert.notEqual(f.state().nearby, 'cabinet');
  // The host shows it (the Scan came close): reached and reported.
  f.engine.setCabinets([{ id: c.id, area: c.area, x: c.x, y: c.y, open: false, delve: false }]);
  const s = f.state();
  assert.equal(s.nearby, 'cabinet');
  assert.deepEqual(JSON.parse(JSON.stringify(s.cabinet)), { id: c.id, open: false });
  f.engine.interact();
  assert.deepEqual(JSON.parse(JSON.stringify(f.cabinets)), [{ areaId: 'infernal', id: c.id, open: false }]);
  // Out of reach (along the ledge, or down on the floor under it): no.
  f.engine.player.x = c.x + 200;
  assert.notEqual(f.state().nearby, 'cabinet');
  f.engine.player.x = c.x; f.engine.player.y = FLOOR;
  assert.notEqual(f.state().nearby, 'cabinet');
  // Beside a station, a shut shown cabinet wins E; an open one leaves it to the station.
  const stall = f.engine.places.find(s => s.id === 'enchanting');
  f.engine.setCabinets([{ id: c.id, area: c.area, x: stall.x - 60, y: FLOOR, open: false, delve: false }]);
  f.engine.player.x = stall.x - 10; f.engine.player.y = FLOOR;
  assert.equal(f.state().nearby, 'cabinet');
  f.engine.setCabinets([{ id: c.id, area: c.area, x: stall.x - 60, y: FLOOR, open: true, delve: false }]);
  assert.equal(f.state().nearby, 'enchanting');
  // A mark from another area is never reached here.
  f.engine.setCabinets([{ id: 'cab-court', area: 'luminous', x: c.x, y: c.y, open: false, delve: false }]);
  f.engine.player.x = c.x;
  assert.notEqual(f.state().nearby, 'cabinet');
});

test('scan: walking toward a cabinet the glass warms band by band, and shows it only up close', () => {
  const c = cab.CABINETS.find(x => x.id === 'cab-seamworks');
  const seen = [];
  // Along the Seamworks' street from the east (under the Vendor's loft it already burns), then up in the loft.
  for (let x = 3500; x >= c.x; x -= 20) {
    const r = cab.scanReading('ember-delve', { x, y: FLOOR }, new Set());
    if (seen[seen.length - 1] !== r.warmth) seen.push(r.warmth);
  }
  assert.equal(cab.scanReading('ember-delve', { x: c.x, y: c.y }, new Set()).warmth, 'burning', 'up in the loft');
  assert.deepEqual(seen, ['cold', 'cool', 'warm', 'hot', 'burning']);
  assert.equal(cab.scanReading('ember-delve', { x: c.x, y: c.y }, new Set([c.id])).id, 'cab-forge-mines', 'opened: the glass turns to the next one here');
});
