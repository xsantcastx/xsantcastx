// The localStorage budget: a year of heavy play must fit well inside a phone's
// 5 MB origin quota (docs/handoff/storage-quota.md). The owner's phone filled
// it — the economy op log grew ~260 KB an hour and nothing folded it on a
// device that never synced — and every save after that failed.
//
// The growing blobs are built with the game's OWN code (the same loader as
// delve-endless.test.cjs: TypeScript compiled into one vm module graph): the
// economy ledger through the ops, the coalescing rule and compactLocalLedger;
// the inventory through applyStackOp and compactStackOps; the Delve through
// encodeCells / encodeSeen / encodeRuns / encodeFog. Blobs that are capped by
// their own models are counted at their caps (sizes from the audit table in
// the handoff), rounded up.
//
//   node --test scripts/storage-budget.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function loader() {
  const modules = new Map();
  const context = vm.createContext({ crypto, console, performance, Date, Math, JSON });
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
const econ = load('shared/economy/economy-ops.ts');
const inv = load('shared/rpg/inventory-ops.ts');
const invModel = load('shared/rpg/inventory.model.ts');
const delve = load('shared/delve/delve-save.model.ts');
const region = load('shared/delve/delve-region.model.ts');
const usage = load('shared/save/storage-usage.ts');

const DAYS = 365;
const SESSIONS_PER_DAY = 3;
const SPENDS_PER_SESSION = 120;      // forge strikes, casino bets, upgrades: every one is an op
const PICKUPS_PER_DAY = 600;         // satchel grants
const SPENDS_OF_STACKS_PER_DAY = 250; // crafting / selling consumes
const DEVICE = 'phone-1';

/** UTF-16 bytes of one localStorage entry, as WebKit counts its quota. */
const bytes = (key, value) => usage.entryBytes(key, typeof value === 'string' ? value : JSON.stringify(value));

/**
 * The economy ledger after a year on a device that never signs in, written the
 * way EconomyService writes it: credits grow the unsent tail op until any
 * other op seals it (or the page reloads), and every persist runs
 * compactLocalLedger. `coalesce: false, fold: false` is the old behaviour.
 */
function yearOfEconomy({ coalesce, fold, persistsPerSession = 1440 }) {
  let ledger = econ.emptyLedger();
  ledger.origin = econ.snapshotOf(ledger);
  let seq = 0, hlc = 1;
  const append = (kind, amount) => {
    seq += 1; hlc += 1;
    const op = { id: `${DEVICE}:${seq}`, deviceId: DEVICE, seq, kind, amount, hlc, wall: hlc };
    econ.applyOp(ledger, op);
    ledger.ops = [...ledger.ops, op];
    return op;
  };
  for (let day = 0; day < DAYS; day++) {
    for (let s = 0; s < SESSIONS_PER_DAY; s++) {
      let tail = null; // a reload forgets the tail: the first credit of a session is a new op
      const spendEvery = Math.floor(persistsPerSession / SPENDS_PER_SESSION);
      for (let p = 0; p < persistsPerSession; p++) {
        if (coalesce && tail) { tail.amount += 50; ledger.gold += 50; ledger.totalGoldEarned += 50; }
        else tail = append('credit-gold', 50);
        if (p % spendEvery === 0) { append('spend-gold', 20); tail = null; }
        if (fold) {
          const folded = econ.compactLocalLedger(ledger, DEVICE);
          if (folded !== ledger) { ledger = folded; tail = null; } // the service forgets its tail on a fold too
        }
        if (!coalesce) tail = null;
      }
    }
  }
  return ledger;
}

/** The inventory ledger after a year of pickups and spends on one device. */
function yearOfInventory() {
  let ledger = inv.emptyInventoryLedger();
  let n = 0;
  const op = (kind, stackKey, quantity) => {
    n += 1;
    ledger = { ...ledger, stackOps: inv.applyStackOp(ledger.stackOps, { id: `${kind}:${n}`, stackKey, kind, quantity, hlc: n, deviceId: DEVICE, sequence: n }) };
    ledger = inv.compactStackOps(ledger, DEVICE);
  };
  const keys = ['dirt', 'stone', 'cinder-ore', 'ember-coal', 'umbral-ink', 'luminous-prism', 'verdant-sap', 'slag-fragment'];
  for (let day = 0; day < DAYS; day++) {
    for (let i = 0; i < PICKUPS_PER_DAY; i++) op('grant', keys[i % keys.length], 1);
    for (let i = 0; i < SPENDS_OF_STACKS_PER_DAY; i++) op('consume', keys[i % keys.length], 1);
  }
  // The bag itself: a heavy player's held gear (records are real items, not history) and a full tombstone list.
  const revision = { hlc: 1, deviceId: DEVICE, sequence: 1 };
  const records = Array.from({ length: 200 }, (_, i) => ({
    kind: 'instance', id: `item-${crypto.randomUUID()}`, definitionId: `gear-${i % 40}`, category: 'equipment',
    tags: ['gear', 'weapon'], rarity: 'rare', soulbound: false, acquiredAt: '2026-10-15T00:00:00.000Z', revision, source: 'inventory',
    name: `Ember-Forged Gear ${i}`, type: 'weapon', stats: { power: 12, goldPerSec: 3, critChance: 2 },
    rollQuality: { power: 0.71, goldPerSec: 0.42, critChance: 0.93 }, sellValue: 1200, econ: 3, location: { kind: 'bag' }, upgradeLevel: 3,
  }));
  const tombstones = Array.from({ length: invModel.INVENTORY_TOMBSTONE_MAX }, (_, i) => ({ id: `item-${crypto.randomUUID()}`, revision: { ...revision, sequence: i }, deletedAt: Date.now() }));
  return { ...ledger, records, tombstones };
}

/** The Delve after a year: ~30 k cells changed (ten times the owner's dig count today). */
function yearOfDelve() {
  const blobs = {};
  const areas = {};
  for (const area of ['ember-delve', 'umbral-delve', 'luminous-delve', 'celestial-delve', 'verdant-delve']) {
    const cells = new Map();
    for (let i = 0; i < 3000; i++) cells.set((i * 7919) % 6720, 1 + (i % 5));
    const bits = new Uint8Array(840).fill(255);
    areas[area] = { layout: `120x56:v2:${area}`, cells: delve.encodeCells(cells), seen: delve.encodeSeen(bits) };
  }
  blobs['godforge-delve'] = { version: 2, seed: 2894011733, createdAt: Date.now(), areas, claimed: Array.from({ length: 60 }, (_, i) => `find-${i}`) };
  // 32 synced region slots (16 Ember, 4 per realm): 15 k changed cells spread across them, every sector explored.
  const slotKeys = [...region.REGION_SLOT_KEYS, ...['umbral', 'luminous', 'celestial', 'verdant'].flatMap(r => [0, 1, 2, 3].map(n => `godforge-rift-${r}-r${n}`))];
  for (const key of slotKeys) {
    const sectors = {};
    for (let s = 0; s < 64; s++) {
      const changed = new Map();
      if (s < 16) for (let i = 0; i < 30; i++) changed.set((i * 37 + s) % 1024, 1 + (i % 4));
      sectors[`${s % 8},${Math.floor(s / 8)}`] = { g: 1, t: Date.now(), ...(changed.size ? { c: region.encodeRuns(changed) } : {}), f: region.encodeFog(new Uint8Array(8).fill(255)) };
    }
    blobs[key] = { v: 1, seed: 2894011733, rx: 0, ry: 0, t: Date.now(), sectors };
  }
  return blobs;
}

/** Blobs capped by their own models, at their caps (bytes of JSON, rounded up from the audit). */
const CAPPED_CHARS = {
  'godforge-activity': 125_000, 'godforge-games': 40_000, 'godforge-glim': 15_000, 'godforge-thralls': 20_000,
  'godforge-explorers': 10_000, 'godforge-roster': 10_000, 'eclipse-quests': 10_000, 'godforge-challenges': 10_000,
  'eclipse-npc': 10_000, 'godforge-collection': 20_000, 'eclipse-progress': 10_000, 'godforge-exchange': 8_000,
  'godforge-bounties': 5_000, 'godforge-heights': 6_000, 'godforge-gathering': 10_000, 'godforge-pets': 3_000,
  'godforge-cabinets': 3_000, 'godforge-story': 2_000, 'godforge-arena': 3_000, 'other (≈25 small blobs)': 25_000,
};

test('the economy log stays bounded on a device that never syncs', () => {
  const now = yearOfEconomy({ coalesce: true, fold: true });
  const size = bytes('godforge-economy', now);
  assert.ok(now.ops.length < econ.LOCAL_COMPACT_AFTER, `ops ${now.ops.length}`);
  assert.ok(size < 100 * 1024, `economy ${size} B`);
});

test('before the fix, the same year overflowed the whole quota from the economy alone', () => {
  // A tenth of the year is enough to show it (the full year is ~1.5 M ops).
  const days = 36;
  const ops = days * SESSIONS_PER_DAY * (1440 + SPENDS_PER_SESSION);
  const perOp = bytes('', JSON.stringify({ id: `${crypto.randomUUID()}:12345`, deviceId: crypto.randomUUID(), seq: 12345, kind: 'credit-gold', amount: 50, hlc: 1760000000000, wall: 1760000000000 })) + 2;
  assert.ok(ops * perOp > usage.LOCAL_QUOTA_BYTES, `${ops} ops × ${perOp} B`);
});

test('the inventory stack history stays bounded per device', () => {
  const ledger = yearOfInventory();
  assert.ok(ledger.stackOps.length <= invModel.INVENTORY_STACK_OPS_MAX);
  assert.ok((ledger.stackFolds?.[0]?.ids.length ?? 0) <= invModel.INVENTORY_FOLD_ID_MEMORY);
});

test('a year of heavy play fits the localStorage budget', () => {
  const rows = [];
  rows.push(['godforge-economy', bytes('godforge-economy', yearOfEconomy({ coalesce: true, fold: true }))]);
  rows.push(['godforge-inventory', bytes('godforge-inventory', yearOfInventory())]);
  for (const [key, blob] of Object.entries(yearOfDelve())) rows.push([key, bytes(key, blob)]);
  for (const [key, chars] of Object.entries(CAPPED_CHARS)) rows.push([key, chars * 2]);
  const total = rows.reduce((n, [, b]) => n + b, 0);
  if (process.env.STORAGE_TABLE) {
    for (const [key, b] of rows.sort((a, b) => b[1] - a[1])) console.log(`${(b / 1024).toFixed(1).padStart(8)} KB  ${key}`);
    console.log(`${(total / 1024).toFixed(1).padStart(8)} KB  TOTAL (budget ${usage.LOCAL_BUDGET_BYTES / 1024} KB)`);
  }
  assert.ok(total <= usage.LOCAL_BUDGET_BYTES, `total ${(total / 1024).toFixed(0)} KB over the ${usage.LOCAL_BUDGET_BYTES / 1024} KB budget`);
});
