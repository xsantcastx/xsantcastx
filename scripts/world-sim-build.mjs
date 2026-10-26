#!/usr/bin/env node
/**
 * world-sim-build.mjs — the room-run world's code for the Hearth (protocol 7; docs/design/online.md Phase 8).
 *
 * The room simulates creatures with the game's OWN modules (src/app/play/world/room-world.ts and everything it imports:
 * td-mobs, td-world, td-zones, the drop tables, the world clock …), never a copy of their numbers. Those are TypeScript;
 * the Hearth is plain Node with no dependencies. This turns them into one ES module the image can carry:
 *
 *   node scripts/world-sim-build.mjs            # writes scripts/world-sim.generated.mjs (git-ignored; the deploy runs it)
 *   node scripts/world-sim-build.mjs --check    # builds in memory and runs one tick (CI-free sanity check)
 *
 * Each module is transpiled with the repo's own TypeScript (as combat-sim.mjs does) and wrapped in a small CommonJS
 * registry; relative imports are resolved at build time, and anything else (an npm package, Angular) fails the build —
 * the world must stay pure. `load()` does the same in memory, for the tests and a local room (no file needed).
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
/** What the room imports: the world, the protocol constants it shares with the client, a Keeper's budget from its save. */
export const ENTRIES = ['src/app/play/world/room-world.ts', 'src/app/play/social/world-protocol.ts', 'src/app/play/world/keeper-budget.ts',
  // Protocol 9: the respawn rules, the world bosses, every area's tables (the tests and /health read them).
  'src/app/play/world/respawn.ts', 'src/app/play/world/world-bosses.ts', 'src/app/play/td/td-levels.ts',
  // Protocol 10: statuses on the room's creatures, the Keeper's life, the room's XP and Gold credit.
  'src/app/play/world/room-status.ts', 'src/app/play/world/keeper-life.ts', 'src/app/play/world/room-credit.ts',
  // S5: heals, wards and the tank's guards on allies, weighed by the room; threat (creatures go for the top).
  'src/app/play/world/ally-claims.ts', 'src/app/play/td/td-threat.ts'];
/**
 * Modules exported whole under one name (protocol 8): the trade Function's own core (functions-game/src/trade-core.ts),
 * so the room settles trades and escrows ground drops with the very code the Function runs — never a copy.
 */
export const NAMED = { tradeCore: 'functions-game/src/trade-core.ts' };
export const OUT = resolve(here, 'world-sim.generated.mjs');

/** Transpile every module reachable from ENTRIES: id (repo-relative path) → { code, deps: {specifier: id} }. */
export function compile() {
  const require = createRequire(resolve(ROOT, 'package.json'));
  const ts = require('typescript');
  const mods = new Map();
  const visit = rel => {
    if (mods.has(rel)) return;
    const file = resolve(ROOT, rel);
    const out = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: true },
      fileName: file,
    }).outputText;
    const entry = { code: out, deps: {} };
    mods.set(rel, entry);
    for (const m of out.matchAll(/require\("([^"]+)"\)/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) throw new Error(`world-sim: ${rel} imports "${spec}" — the room's world must stay pure (no packages)`);
      let p = resolve(dirname(file), spec);
      if (!p.endsWith('.ts')) p = existsSync(`${p}.ts`) ? `${p}.ts` : `${p}/index.ts`;
      const id = relative(ROOT, p).split('\\').join('/');
      entry.deps[spec] = id;
      visit(id);
    }
  };
  for (const e of [...ENTRIES, ...Object.values(NAMED)]) visit(e);
  return mods;
}

/** Evaluate compiled modules in this process; returns the entries' exports merged (what the generated file exports). */
export function evaluate(mods) {
  const cache = new Map();
  const req = id => {
    if (cache.has(id)) return cache.get(id).exports;
    const m = mods.get(id);
    if (!m) throw new Error(`world-sim: missing module ${id}`);
    const module = { exports: {} };
    cache.set(id, module);
    new Function('require', 'module', 'exports', m.code)(spec => req(m.deps[spec]), module, module.exports);
    return module.exports;
  };
  return Object.assign({}, ...ENTRIES.map(req), Object.fromEntries(Object.entries(NAMED).map(([name, id]) => [name, req(id)])));
}

/** The world, compiled in memory from the sources (tests, a local room). */
export function load() { return evaluate(compile()); }

/** The generated file: the registry, the same evaluator, the entries' exports. */
export function emit(mods) {
  const names = Object.keys(evaluate(mods)).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
  const body = [...mods].map(([id, m]) => `${JSON.stringify(id)}: { deps: ${JSON.stringify(m.deps)}, run: function (require, module, exports) {\n${m.code}\n} }`).join(',\n');
  return `// GENERATED by scripts/world-sim-build.mjs from ${ENTRIES.join(', ')} — do not edit; rebuild instead.\n` +
    `// The Hearth's room-run world (protocol 7): the game's own modules, bundled for plain Node.\n` +
    `const MODS = {\n${body}\n};\n` +
    `const cache = new Map();\n` +
    `function req(id) { if (cache.has(id)) return cache.get(id).exports; const m = MODS[id]; const module = { exports: {} }; cache.set(id, module); m.run(spec => req(m.deps[spec]), module, module.exports); return module.exports; }\n` +
    `const all = Object.assign({}, ${ENTRIES.map(e => `req(${JSON.stringify(e)})`).join(', ')}, { ${Object.entries(NAMED).map(([n, id]) => `${n}: req(${JSON.stringify(id)})`).join(', ')} });\n` +
    `export const BUILT = ${JSON.stringify(new Date().toISOString())};\n` +
    names.map(n => `export const ${n} = all.${n};`).join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mods = compile();
  const sim = evaluate(mods);
  // One tick of the starting island, so a broken build never reaches the image.
  const w = new sim.RoomWorld({ area: 'ember-isle', seed: 'build', now: Date.now });
  w.keeper({ id: 'k', x: 160, y: 610, level: 5 });
  for (let i = 0; i < 4; i++) w.tick(.25);
  if (process.argv.includes('--check')) {
    console.log(`world-sim: ${mods.size} modules, ${w.mobs.mobs.length} creatures round a Keeper — ok`);
  } else {
    const text = emit(mods);
    writeFileSync(OUT, text);
    console.log(`world-sim: ${mods.size} modules → ${relative(ROOT, OUT)} (${Math.round(text.length / 1024)} KB)`);
  }
}
