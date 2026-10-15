// living-world-survey.cjs — how full is the streamed world? (docs/handoff/living-world.md)
//
// Walks N sector columns east and west of the Ember world on several seeds and
// counts, per sector column, what a Keeper meets: creatures (hall spawns and
// surface packs), flora, structures and POIs, ores of note, liquids, NPCs,
// secrets (field notes, shrines, finds) and the day's mysteries. Then the
// longest stretch with nothing interesting in it, on the surface (walking) and
// in each stratum (digging a Keeper-tall tunnel sideways).
//
//   node scripts/living-world-survey.cjs [--sectors 64] [--json]
//
// The guard test (scripts/living-world.test.cjs) imports `survey` and fails
// when a gap passes the target. Works on a tree without living-world.ts (the
// "before" numbers were taken that way).
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

/** Walking pace in a world with terrain (px/s: engine.ts, 265 × .72) and a sector's width (px): ~5.4 s a sector. */
const WALK_PX_S = 191, SECTOR_PX = 32 * 32;
/** Digging sideways, a Keeper-tall tunnel (2 cells a column) with a tier-1 pick: about a second a column. */
const DIG_S_PER_COL = 1;
const STRATA = [
  { id: 'root-hollows', rows: [0, 11] }, { id: 'basalt-caverns', rows: [12, 25] },
  { id: 'glowcap-grotto', rows: [26, 39] }, { id: 'magma-halls', rows: [40, 53] },
];
const NOTE_OF_ORE = ['slag-vein', 'heartstone-vein', 'glowcap', 'shadow-root'];

/**
 * The survey. `sectors` columns east of the authored span and west of it, per seed.
 * Returns per-seed rows and the summary (max gaps in sectors and seconds).
 */
function survey({ sectors = 64, seeds = [1, 424242, 0x5eedde1e, 77, 0xdeadbeef], day = 20000 } = {}) {
  const load = loader();
  const gen = load('play/engine/sector-gen.ts');
  const surfaceGen = load('play/engine/surface-gen.ts');
  const terrain = load('play/engine/terrain.ts');
  const ember = load('play/world/worlds/ember.world.ts');
  let living = null;
  try { if (fs.existsSync(path.resolve(__dirname, '../src/app/play/engine/living-world.ts'))) living = load('play/engine/living-world.ts'); } catch { living = null; }
  const SPEC = ember.EMBER_WORLD.terrain;
  const SKY = ember.EMBER_SURFACE;
  const SECTOR = gen.SECTOR;
  const node = id => { try { return terrain.nodeIndex(id); } catch { return -1; } };
  const NOTE_ORE = new Set(NOTE_OF_ORE.map(node));
  const FLORA = new Set(['ashwood-trunk', 'ashberry-bush'].map(node).filter(n => n >= 0));
  const TREE = node('ashwood-trunk');
  const westEdge = Math.floor(SKY.flat[0] / SECTOR) - 1, eastEdge = Math.ceil(SKY.flat[1] / SECTOR);
  const columns = [];
  for (let k = 0; k < sectors; k++) { columns.push(eastEdge + k); columns.push(westEdge - k); }
  columns.sort((a, b) => a - b);
  const perSeed = [];
  for (const seed of seeds) {
    const ctx = gen.sectorContext(SPEC, seed);
    const rows = [];
    // Interesting things: [col, row-or-null (surface), label].
    const surfaceMarks = [], under = STRATA.map(() => []);
    for (const sx of columns) {
      const g = gen.generateSectorColumn(ctx, sx);
      const sky = surfaceGen.surfaceColumn(SKY, sx);
      const r = { sx, creatures: 0, packs: 0, flora: 0, trees: 0, structures: 0, pois: 0, ores: 0, liquids: 0, npcs: 0, secrets: 0, critters: 0, mysteries: 0, finds: 0 };
      // Underground (the shipped strata, rows 0..55).
      for (let i = 0; i < SECTOR * SPEC.rows; i++) {
        if (NOTE_ORE.has(g.kind[i])) r.ores++;
        if (g.liqLevel[i]) r.liquids++;
      }
      for (const s of g.structures) {
        if (s.col < sx * SECTOR || s.col >= (sx + 1) * SECTOR) continue; // count each once, in its first column
        r.structures++;
        const band = STRATA.findIndex(b => s.row + s.h > b.rows[0] && s.row <= b.rows[1]);
        if (band >= 0) under[band].push([s.col, s.kind]);
      }
      for (const h of g.halls) {
        r.creatures += h.count;
        if (h.floorRow < 0) { r.packs++; surfaceMarks.push([h.col0, `pack:${h.creature}`]); continue; }
        const band = STRATA.findIndex(b => h.floorRow - 1 >= b.rows[0] && h.floorRow - 1 <= b.rows[1]);
        if (band >= 0) under[band].push([h.col0, `den:${h.creature}`]);
      }
      for (const [i, id] of g.notes) {
        const row = Math.floor(i / SECTOR), col = sx * SECTOR + (i % SECTOR);
        if (row >= SPEC.rows) continue;
        r.secrets++;
        const band = STRATA.findIndex(b => row >= b.rows[0] && row <= b.rows[1]);
        if (band >= 0) under[band].push([col, id]);
      }
      for (const f of g.finds ?? []) {
        r.finds++;
        const band = STRATA.findIndex(b => f.row >= b.rows[0] && f.row <= b.rows[1]);
        if (band >= 0) under[band].push([f.col, `find:${f.kind}`]);
      }
      // The surface (the sky band over the wilds).
      for (let i = 0; i < sky.kind.length; i++) {
        if (FLORA.has(sky.kind[i])) r.flora++;
        if (sky.kind[i] === TREE && (i < SECTOR || sky.kind[i - SECTOR] !== TREE)) r.trees++;
        if (sky.liqLevel[i]) r.liquids++;
      }
      for (const st of surfaceGen.stonesIn(SKY, sx, sx)) { r.pois++; surfaceMarks.push([st.col, `stone:${st.id}`]); }
      for (const p of sky.pois ?? []) { r.pois++; if (p.npc) r.npcs++; surfaceMarks.push([p.col, `poi:${p.kind}`]); }
      if (living) {
        // The pack, exactly as sector-world.ts adds it to the column.
        const plan = surfaceGen.livingPlan(SKY, sx);
        const safe = !plan || (plan.poi && (plan.poi.kind === 'hermit' || plan.poi.kind === 'shrine'));
        const pack = living.wildSector(SKY, sx) ? living.packFor(SKY.salt, sx, living.areaLevel(living.wildDepth(SKY, sx)), c => surfaceGen.groundAt(SKY, c), !!safe) : null;
        if (pack) { r.packs++; r.creatures += pack.count; surfaceMarks.push([pack.col0, `pack:${pack.creature}`]); }
        // Critters at noon and at midnight (sky band over the shipped rows, as a loaded column holds them).
        const off = sky.kind.length, kind = new Uint8Array(off + g.kind.length), liq = new Uint8Array(off + g.kind.length);
        kind.set(sky.kind, 0); kind.set(g.kind, off); liq.set(sky.liqLevel, 0); liq.set(g.liqLevel, off);
        const crit = [12, 0].flatMap(hour => living.crittersFor({ sx, hour, seed, rowLo: SKY.rowLo, rows: SPEC.rows, kind, liqLevel: liq,
          ground: c => surfaceGen.groundAt(SKY, c), wild: living.wildSector(SKY, sx), plan, finds: g.finds ?? [] }));
        r.critters = crit.length / 2;
        const m = living.mysteryAt ? living.mysteryAt(seed, day, sx) : null;
        if (m) { r.mysteries++; (m.underground ? under[Math.min(3, Math.max(0, STRATA.findIndex(b => m.row >= b.rows[0] && m.row <= b.rows[1])))] : surfaceMarks).push([m.col, `mystery:${m.kind}`]); }
      }
      rows.push(r);
    }
    const gapOf = (marks) => {
      const cols = [...new Set(marks.map(m => m[0]))].sort((a, b) => a - b);
      // The authored span is full of people: a gap is only measured inside the wilds, either side.
      let max = 0;
      const sides = [cols.filter(c => c >= SKY.flat[1]), cols.filter(c => c < SKY.flat[0])];
      const bounds = [[SKY.flat[1], (eastEdge + sectors) * SECTOR], [(westEdge - sectors + 1) * SECTOR, SKY.flat[0]]];
      sides.forEach((side, k) => {
        const [lo, hi] = bounds[k];
        const pts = [lo, ...side, hi];
        for (let i = 1; i < pts.length; i++) max = Math.max(max, pts[i] - pts[i - 1]);
      });
      return max;
    };
    const surfaceGap = gapOf(surfaceMarks);
    const underGaps = under.map(gapOf);
    perSeed.push({ seed, rows, surfaceGap, underGaps, surfaceThings: surfaceMarks.length, underThings: under.map(u => u.length) });
  }
  const sum = (k) => perSeed.reduce((a, s) => a + s.rows.reduce((b, r) => b + r[k], 0), 0);
  const n = perSeed.length * columns.length;
  const avg = {};
  for (const k of ['creatures', 'packs', 'flora', 'trees', 'structures', 'pois', 'ores', 'liquids', 'npcs', 'secrets', 'critters', 'mysteries', 'finds']) avg[k] = +(sum(k) / n).toFixed(2);
  const maxSurface = Math.max(...perSeed.map(s => s.surfaceGap));
  const maxUnder = STRATA.map((_, b) => Math.max(...perSeed.map(s => s.underGaps[b])));
  const empty = perSeed.reduce((a, s) => a + s.rows.filter(r => !r.structures && !r.pois && !r.packs && !r.finds && !r.secrets && !r.creatures).length, 0);
  return {
    living: !!living, sectors: columns.length, seeds: perSeed.map(s => s.seed), avgPerSector: avg,
    emptySectorShare: +(empty / n).toFixed(2),
    maxGap: {
      surface: { cols: maxSurface, sectors: +(maxSurface / SECTOR).toFixed(2), walkSeconds: Math.round(maxSurface * 32 / WALK_PX_S) },
      underground: Object.fromEntries(STRATA.map((b, i) => [b.id, { cols: maxUnder[i], sectors: +(maxUnder[i] / SECTOR).toFixed(2), digSeconds: Math.round(maxUnder[i] * DIG_S_PER_COL) }])),
    },
    perSeed: perSeed.map(s => ({ seed: s.seed, surfaceGap: s.surfaceGap, underGaps: s.underGaps, surfaceThings: s.surfaceThings, underThings: s.underThings })),
  };
}

module.exports = { survey, WALK_PX_S, SECTOR_PX, DIG_S_PER_COL };

if (require.main === module) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--sectors');
  const out = survey({ sectors: at >= 0 ? Number(args[at + 1]) : 64 });
  if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`living-world.ts present: ${out.living}; ${out.sectors} sector columns × ${out.seeds.length} seeds`);
    console.log('average per sector column:', out.avgPerSector);
    console.log('sector columns with nothing at all (no structure, POI, pack, find, note or creature):', out.emptySectorShare);
    console.log('max gap, surface:', out.maxGap.surface);
    for (const [k, v] of Object.entries(out.maxGap.underground)) console.log(`max gap, ${k}:`, v);
  }
}
