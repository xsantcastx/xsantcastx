// Save compaction, checked on real saves (docs/handoff/save-compaction.md).
//
//   node scripts/save-compaction-check.cjs <inventory.json> <economy.json> [deviceId]
//
// Each file is a document as the Firestore REST API returns it (`{fields: …}`) or as plain JSON (`{v: …}`). READ-ONLY:
// nothing is written anywhere. Runs the game's OWN code (TypeScript compiled into one vm module graph, the loader of
// storage-budget.test.cjs): the compaction a device runs on its next push, the packed cloud format, and the merges a
// stale device runs against it. Prints Firestore sizes before and after, and fails unless every item, every stack
// quantity and the Gold are the same — after compaction, after a pack/unpack round trip, and after merging the
// compacted save with the original in both orders.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function loader() {
  const modules = new Map();
  const context = vm.createContext({ crypto, console, performance, Date, Math, JSON, TextEncoder });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const wrapper = vm.runInContext(`(function(require,module,exports){${code}\n})`, context);
    wrapper((name) => load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : `${name}.ts`)), module, module.exports);
    return module.exports;
  }
  return (rel) => load(path.resolve(__dirname, '..', rel));
}

/** Firestore storage size of a value (firebase.google.com/docs/firestore/storage-size). */
function fsSize(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return Buffer.byteLength(v, 'utf8') + 1;
  if (Array.isArray(v)) return v.reduce((a, x) => a + fsSize(x), 0);
  let s = 0;
  for (const [k, x] of Object.entries(v)) if (x !== undefined) s += Buffer.byteLength(k, 'utf8') + 1 + fsSize(x);
  return s;
}
const docBytes = (v) => 32 + 60 + fsSize({ v, updatedAt: '2026-10-22T00:00:00.000Z' });
/** The REST JSON the owner measured with (what `curl …/documents/<path>` returns). */
function restOf(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(restOf) } : {} };
  const fields = {};
  for (const [k, x] of Object.entries(v)) if (x !== undefined) fields[k] = restOf(x);
  return { mapValue: { fields } };
}
const restBytes = (v) => JSON.stringify({ fields: { v: restOf(v), updatedAt: restOf('2026-10-22T00:00:00.000Z') } }).length;

function fromRest(x) {
  if ('mapValue' in x) { const o = {}; for (const [k, y] of Object.entries(x.mapValue.fields || {})) o[k] = fromRest(y); return o; }
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(fromRest);
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('nullValue' in x) return null;
  if ('timestampValue' in x) return x.timestampValue;
  throw new Error(`unknown REST value ${Object.keys(x)}`);
}
function readDoc(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (raw.fields) { const o = {}; for (const [k, y] of Object.entries(raw.fields)) o[k] = fromRest(y); return o.v ?? null; }
  return raw.v ?? raw;
}

function main() {
  const [invFile, ecoFile, deviceArg] = process.argv.slice(2);
  if (!invFile) { console.error('usage: node scripts/save-compaction-check.cjs <inventory.json> [economy.json] [deviceId]'); process.exit(2); }
  const load = loader();
  const inv = load('src/app/shared/rpg/inventory-ops.ts');
  const eco = load('src/app/shared/economy/economy-ops.ts');
  const core = load('functions-game/src/trade-core.ts');
  const now = Date.now();
  const fail = [];
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

  // ── Inventory ──
  const stored = readDoc(invFile);
  if (stored) {
    const before = inv.coerceInventoryLedger(stored);
    const device = deviceArg || [...new Set(before.records.map(r => r.revision.deviceId))].find(d => d.length > 20) || 'proof-device';
    const after = inv.compactInventoryLedger(before, device, now, { checkSize: true });
    const packed = inv.packInventory(JSON.parse(JSON.stringify(after)));
    const back = inv.coerceInventoryLedger(JSON.parse(JSON.stringify(packed)));
    const keys = new Set();
    for (const l of [before, after]) {
      for (const r of l.records) if (r.kind === 'stack') keys.add(r.stackKey);
      for (const o of l.stackOps) keys.add(o.stackKey);
      for (const f of l.stackFolds ?? []) for (const k of Object.keys(f.net)) keys.add(k);
    }
    const view = (l) => ({
      items: l.records.map(r => JSON.stringify([r.id, r.kind, r.definitionId, r.location, r.kind === 'instance' ? [r.stats, r.rollQuality, r.sellValue, r.upgradeLevel, r.sockets] : r.stackKey])).sort(),
      stacks: [...keys].sort().map(k => `${k}=${inv.stackQuantityOf(l, k)}`),
      sales: [l.goldFromSales, l.sold],
    });
    const ref = JSON.stringify(view(before));
    const check = (label, l) => {
      const got = view(l);
      if (JSON.stringify(got) === ref) return;
      const want = view(before);
      const diff = ['items', 'stacks'].flatMap(k => got[k].filter(x => !want[k].includes(x)).map(x => `+${x}`).concat(want[k].filter(x => !got[k].includes(x)).map(x => `-${x}`)));
      fail.push(`inventory: ${label} differs ${diff.slice(0, 6).join(' ')}`);
    };
    check('compacted', after);
    check('packed → unpacked', back);
    check('merge(original, compacted)', inv.mergeInventoryLedgers(stored, packed));
    check('merge(compacted, original)', inv.mergeInventoryLedgers(packed, stored));
    check('merge(compacted, compacted)', inv.mergeInventoryLedgers(packed, packed));
    // The round trip is exact on the raw ledger too, not just on what the views compare.
    const plain = JSON.stringify(JSON.parse(JSON.stringify(after)), Object.keys).length;
    if (!sameJson(inv.unpackInventory(packed), JSON.parse(JSON.stringify(after)))) fail.push('inventory: unpack(pack(x)) !== x');
    void plain;
    const v = view(before);
    console.log(`inventory  ${invFile}`);
    console.log(`  Firestore ${kb(docBytes(stored))} → ${kb(docBytes(packed))}   REST JSON ${kb(restBytes(stored))} → ${kb(restBytes(packed))}`);
    console.log(`  records ${before.records.length} → ${back.records.length}, tombstones ${before.tombstones.length} → ${back.tombstones.length} (floor ${back.tombFloor ?? 0}), stack ops ${before.stackOps.length} → ${back.stackOps.length}, folds ${(before.stackFolds ?? []).length} → ${(back.stackFolds ?? []).length}`);
    console.log(`  ${v.items.length} records, ${v.stacks.length} stack quantities, sales ${v.sales.join('/')}: identical after compaction, round trip and both merges`);
    const parts = (l) => Object.fromEntries(Object.entries(inv.packInventory(JSON.parse(JSON.stringify(l)))).map(([k, x]) => [k, fsSize(x)]).filter(([, n]) => n > 500));
    console.log('  packed parts (Firestore bytes):', JSON.stringify(parts(after)));
    // The server reads it, writes it back packed.
    const read = core.readInventory({ v: packed }, 'x');
    if (!core.isPackedInventory(core.inventoryEnvelope(read, now).v)) fail.push('trade-core: packed read not written back packed');
  }

  // ── Economy ──
  const ecoStored = ecoFile ? readDoc(ecoFile) : null;
  if (ecoStored) {
    const before = eco.coerceMigrated(ecoStored);
    const device = deviceArg || Object.entries(before.seenAt).sort((a, b) => b[1] - a[1])[0]?.[0] || 'proof-device';
    const after = eco.acknowledgeAndMaybeCompact(before, device, now);
    const gold = (l) => eco.applyOps(l.origin ?? l, l.ops).state;
    const view = (l) => { const s = gold(l); return canon([s.gold, s.eclipseEssence, s.upgrades, s.artifacts, s.cosmetics, s.runewords, l.gold, l.eclipseEssence, core.replayGold(JSON.parse(JSON.stringify(l)))]); };
    const ref = view(before);
    const check = (label, l) => { if (view(l) !== ref) fail.push(`economy: ${label} differs: ${view(l)} vs ${ref}`); };
    check('compacted', after);
    const m1 = eco.mergeEconomyLedgers(ecoStored, JSON.parse(JSON.stringify(after)));
    const m2 = eco.mergeEconomyLedgers(JSON.parse(JSON.stringify(after)), ecoStored);
    check('merge(original, compacted)', m1);
    check('merge(compacted, original)', m2);
    console.log(`economy    ${ecoFile}`);
    console.log(`  Firestore ${kb(docBytes(ecoStored))} → ${kb(docBytes(after))}   REST JSON ${kb(restBytes(ecoStored))} → ${kb(restBytes(after))}`);
    console.log(`  ops ${before.ops.length} → ${after.ops.length}, commerce receipts ${before.commerceOps.length} → ${after.commerceOps.length}, folded keys ${Object.keys(before.commerceApplied).length} → ${Object.keys(after.commerceApplied).length}, checkpoint ${before.checkpointId} → ${after.checkpointId}`);
    console.log(`  Gold ${gold(before).gold} (purse ${before.gold}), Essence ${gold(before).eclipseEssence}: identical after compaction and both merges`);
  }

  if (fail.length) { console.error(`FAIL\n  ${fail.join('\n  ')}`); process.exit(1); }
  console.log('ok');
}


/** JSON with sorted keys and undefined-valued keys dropped: equality that ignores key order. */
function canon(x) {
  const norm = (y) => Array.isArray(y) ? y.map(norm) : y && typeof y === 'object'
    ? Object.fromEntries(Object.keys(y).filter(k => y[k] !== undefined).sort().map(k => [k, norm(y[k])])) : y;
  return JSON.stringify(norm(x));
}
const sameJson = (a, b) => canon(a) === canon(b);

main();
