/**
 * economy-ops.ts — idempotent ledger operations, and the merge that replays them.
 *
 * A snapshot mix of last-write-wins Gold and unioned purchases cannot conserve
 * value. Two devices that spend the same 1,000 Gold pile concurrently would
 * keep both items and one device's leftover balance. The log is the unit of
 * merge instead: each mutation is an immutable op with a stable id, devices
 * carry a monotonic sequence, and two ledgers become one by unioning ops and
 * replaying them in a deterministic (hlc, deviceId, seq, id) order.
 *
 * Spends that cannot be afforded at their place in that order are skipped —
 * that is the conflict policy. First-in-order keeps the item; the other device
 * loses the purchase on the next sync rather than minting Gold.
 *
 * Blobs with no ops (every save from before this file) merge with the old
 * conservative max/union rule. A missing timestamp is not proof that a ledger
 * is older, so a stamped 100 Gold must not overwrite a legacy 9,999.
 */

export type EconomyOpKind =
  | 'spend-gold'
  | 'buy-upgrade'
  | 'buy-artifact'
  | 'buy-cosmetic'
  | 'buy-enchantment'
  | 'grant-runeword'
  | 'grant-cosmetic'
  | 'equip'
  | 'prestige';

export interface EconomyOp {
  /** `${deviceId}:${seq}` — stable, so a retry cannot debit twice. */
  id: string;
  deviceId: string;
  seq: number;
  kind: EconomyOpKind;
  /** Gold or Essence charged. Unused by grants/equip. */
  amount?: number;
  itemId?: string;
  slot?: string;
  /** Enchantment expiry, prestige shardsGranted, or a granted cosmetic variant. */
  extra?: number | string;
  /** Hybrid logical clock. Ordering uses this, never raw Date.now(). */
  hlc: number;
  /** Wall clock, informational only. */
  wall: number;
}

export interface EconomyLedger {
  version: 2;
  gold: number;
  eclipseEssence: number;
  aetherFragments: number;
  noxFragments: number;
  relicDust: number;
  totalGoldEarned: number;
  runGoldEarned: number;
  totalClicks: number;
  autoClicks: number;
  eclipseShards: number;
  shardsGranted: number;
  prestigeCount: number;
  streakDays: number;
  rpgFlatGold: number;
  upgrades: Record<string, number>;
  artifacts: string[];
  cosmetics: string[];
  runewords: string[];
  equipped: Record<string, string>;
  enchantments: { id: string; expiresAt: number }[];
  levelsPaid: number;
  streakWeeksPaid: number;
  lastIdleAt: number;
  ops: EconomyOp[];
  origin: EconomyLedger | null;
  hlc: number;
}

const OP_SOFT_CAP = 400;
const OP_KEEP = 300;

export function emptyLedger(): EconomyLedger {
  return {
    version: 2,
    gold: 0,
    eclipseEssence: 0,
    aetherFragments: 0,
    noxFragments: 0,
    relicDust: 0,
    totalGoldEarned: 0,
    runGoldEarned: 0,
    totalClicks: 0,
    autoClicks: 0,
    eclipseShards: 0,
    shardsGranted: 0,
    prestigeCount: 0,
    streakDays: 0,
    rpgFlatGold: 0,
    upgrades: {},
    artifacts: [],
    cosmetics: [],
    runewords: [],
    equipped: {},
    enchantments: [],
    levelsPaid: 1,
    streakWeeksPaid: 0,
    lastIdleAt: 0,
    ops: [],
    origin: null,
    hlc: 0,
  };
}

/** Compare two ops for a total, commutative order. */
export function compareOps(a: EconomyOp, b: EconomyOp): number {
  if (a.hlc !== b.hlc) return a.hlc - b.hlc;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function sortOps(ops: EconomyOp[]): EconomyOp[] {
  return [...ops].sort(compareOps);
}

export function nextHlc(previous: number, wall: number): number {
  return Math.max(wall, previous + 1);
}

export function snapshotOf(state: EconomyLedger): EconomyLedger {
  const { ops: _ops, origin: _origin, ...rest } = state;
  return {
    ...rest,
    upgrades: { ...state.upgrades },
    artifacts: [...state.artifacts],
    cosmetics: [...state.cosmetics],
    runewords: [...state.runewords],
    equipped: { ...state.equipped },
    enchantments: state.enchantments.map(e => ({ ...e })),
    ops: [],
    origin: null,
  };
}

export function cloneLedger(state: EconomyLedger): EconomyLedger {
  return {
    ...state,
    upgrades: { ...state.upgrades },
    artifacts: [...state.artifacts],
    cosmetics: [...state.cosmetics],
    runewords: [...state.runewords],
    equipped: { ...state.equipped },
    enchantments: state.enchantments.map(e => ({ ...e })),
    ops: state.ops.map(o => ({ ...o })),
    origin: state.origin ? snapshotOf(state.origin) : null,
  };
}

/**
 * Apply one op. Returns false when a debit cannot be afforded — the op stays
 * in the log so a later replay does not resurrect it, but ownership does not
 * change.
 */
export function applyOp(state: EconomyLedger, op: EconomyOp): boolean {
  const amount = numberOf(op.amount);
  switch (op.kind) {
    case 'spend-gold':
      if (state.gold < amount) return false;
      state.gold -= amount;
      return true;
    case 'buy-upgrade': {
      if (state.gold < amount) return false;
      state.gold -= amount;
      const id = op.itemId ?? '';
      if (id) state.upgrades = { ...state.upgrades, [id]: (state.upgrades[id] ?? 0) + 1 };
      return true;
    }
    case 'buy-artifact': {
      const id = op.itemId ?? '';
      if (id && state.artifacts.includes(id)) return true;
      if (state.eclipseEssence < amount) return false;
      state.eclipseEssence -= amount;
      if (id) state.artifacts = [...state.artifacts, id];
      return true;
    }
    case 'buy-cosmetic': {
      const id = op.itemId ?? '';
      if (id && state.cosmetics.includes(id)) {
        if (op.slot && op.extra) state.equipped = { ...state.equipped, [op.slot]: String(op.extra) };
        return true;
      }
      if (state.gold < amount) return false;
      state.gold -= amount;
      if (id) state.cosmetics = [...state.cosmetics, id];
      if (op.slot && op.extra) state.equipped = { ...state.equipped, [op.slot]: String(op.extra) };
      return true;
    }
    case 'buy-enchantment': {
      if (state.eclipseEssence < amount) return false;
      state.eclipseEssence -= amount;
      const id = op.itemId ?? '';
      const expiresAt = typeof op.extra === 'number' ? op.extra : 0;
      state.enchantments = [
        ...state.enchantments.filter(e => e.id !== id),
        { id, expiresAt },
      ];
      return true;
    }
    case 'grant-runeword': {
      const id = op.itemId ?? '';
      if (id && !state.runewords.includes(id)) state.runewords = [...state.runewords, id];
      return true;
    }
    case 'grant-cosmetic': {
      const id = op.itemId ?? '';
      if (id && !state.cosmetics.includes(id)) state.cosmetics = [...state.cosmetics, id];
      if (op.slot && op.extra) state.equipped = { ...state.equipped, [op.slot]: String(op.extra) };
      return true;
    }
    case 'equip': {
      const equipped = { ...state.equipped };
      if (op.slot && op.itemId) equipped[op.slot] = op.itemId;
      else if (op.slot) delete equipped[op.slot];
      state.equipped = equipped;
      return true;
    }
    case 'prestige': {
      state.eclipseShards += amount;
      if (typeof op.extra === 'number') state.shardsGranted = op.extra;
      state.prestigeCount += 1;
      state.gold = 0;
      state.runGoldEarned = 0;
      state.upgrades = {};
      return true;
    }
    default:
      return false;
  }
}

export function applyOps(origin: EconomyLedger, ops: EconomyOp[]): EconomyLedger {
  const state = cloneLedger(origin);
  state.ops = [];
  state.origin = null;
  for (const op of sortOps(ops)) applyOp(state, op);
  return state;
}

export function maxSeqFor(deviceId: string, ops: readonly EconomyOp[]): number {
  let max = 0;
  for (const op of ops) {
    if (op.deviceId === deviceId && op.seq > max) max = op.seq;
  }
  return max;
}

export function compactOps(origin: EconomyLedger, ops: EconomyOp[]): {
  origin: EconomyLedger;
  ops: EconomyOp[];
} {
  if (ops.length <= OP_SOFT_CAP) return { origin, ops: sortOps(ops) };
  const sorted = sortOps(ops);
  const fold = sorted.slice(0, sorted.length - OP_KEEP);
  const keep = sorted.slice(sorted.length - OP_KEEP);
  return { origin: applyOps(origin, fold), ops: keep };
}

/**
 * Two ledgers into one. Commutative: merge(a, b) and merge(b, a) agree on
 * every field that the conflict policy can decide.
 */
export function mergeEconomyLedgers(remote: unknown, local: unknown): EconomyLedger {
  if (!isPlainObject(local)) return coerceLedger(remote) ?? emptyLedger();
  if (!isPlainObject(remote)) return coerceLedger(local) ?? emptyLedger();

  const a = coerceLedger(remote) ?? emptyLedger();
  const b = coerceLedger(local) ?? emptyLedger();

  const importA = asImport(a);
  const importB = asImport(b);
  const origin = conservativeMerge(importA.origin, importB.origin);
  const ops = unionOps(importA.ops, importB.ops);
  const compact = compactOps(origin, ops);
  const replayed = applyOps(compact.origin, compact.ops);

  replayed.gold += Math.max(unexplainedGold(a, importA), unexplainedGold(b, importB));
  replayed.eclipseEssence += Math.max(
    unexplainedEssence(a, importA),
    unexplainedEssence(b, importB),
  );

  // Monotone counters are not in the op log (idle, clicks, wiring-layer copies).
  replayed.aetherFragments = maxOf(a.aetherFragments, b.aetherFragments);
  replayed.noxFragments = maxOf(a.noxFragments, b.noxFragments);
  replayed.relicDust = maxOf(a.relicDust, b.relicDust);
  replayed.totalGoldEarned = maxOf(a.totalGoldEarned, b.totalGoldEarned);
  replayed.totalClicks = maxOf(a.totalClicks, b.totalClicks);
  replayed.autoClicks = maxOf(a.autoClicks, b.autoClicks);
  replayed.streakDays = maxOf(a.streakDays, b.streakDays);
  replayed.rpgFlatGold = maxOf(a.rpgFlatGold, b.rpgFlatGold);
  replayed.levelsPaid = maxOf(a.levelsPaid, b.levelsPaid);
  replayed.streakWeeksPaid = maxOf(a.streakWeeksPaid, b.streakWeeksPaid);
  replayed.lastIdleAt = maxOf(a.lastIdleAt, b.lastIdleAt);
  // Shards/prestige: take the replayed values (ops include prestige) but never
  // drop a monotone counter a legacy blob already held.
  replayed.eclipseShards = Math.max(replayed.eclipseShards, maxOf(a.eclipseShards, b.eclipseShards));
  replayed.shardsGranted = Math.max(replayed.shardsGranted, maxOf(a.shardsGranted, b.shardsGranted));
  replayed.prestigeCount = Math.max(replayed.prestigeCount, maxOf(a.prestigeCount, b.prestigeCount));
  replayed.runGoldEarned = Math.max(replayed.runGoldEarned, 0);

  replayed.ops = compact.ops;
  replayed.origin = compact.origin;
  replayed.hlc = Math.max(a.hlc, b.hlc, ...compact.ops.map(o => o.hlc));
  replayed.version = 2;
  return replayed;
}

function asImport(blob: EconomyLedger): { origin: EconomyLedger; ops: EconomyOp[] } {
  if (blob.ops.length > 0) {
    return {
      origin: blob.origin ? snapshotOf(blob.origin) : stripLog(blob),
      ops: blob.ops.map(o => ({ ...o })),
    };
  }
  return { origin: stripLog(blob), ops: [] };
}

function unexplainedGold(
  blob: EconomyLedger,
  imported: { origin: EconomyLedger; ops: EconomyOp[] },
): number {
  const own = applyOps(imported.origin, imported.ops);
  return Math.max(0, blob.gold - own.gold);
}

function unexplainedEssence(
  blob: EconomyLedger,
  imported: { origin: EconomyLedger; ops: EconomyOp[] },
): number {
  const own = applyOps(imported.origin, imported.ops);
  return Math.max(0, blob.eclipseEssence - own.eclipseEssence);
}

function unionOps(a: EconomyOp[], b: EconomyOp[]): EconomyOp[] {
  const byId = new Map<string, EconomyOp>();
  for (const op of [...a, ...b]) {
    if (!op || typeof op.id !== 'string') continue;
    if (!byId.has(op.id)) byId.set(op.id, { ...op });
  }
  return [...byId.values()];
}

/** Field-by-field max/union. Used for origins and for pre-log (legacy) blobs. */
export function conservativeMerge(remote: EconomyLedger, local: EconomyLedger): EconomyLedger {
  return {
    version: 2,
    gold: maxOf(remote.gold, local.gold),
    eclipseEssence: maxOf(remote.eclipseEssence, local.eclipseEssence),
    aetherFragments: maxOf(remote.aetherFragments, local.aetherFragments),
    noxFragments: maxOf(remote.noxFragments, local.noxFragments),
    relicDust: maxOf(remote.relicDust, local.relicDust),
    totalGoldEarned: maxOf(remote.totalGoldEarned, local.totalGoldEarned),
    runGoldEarned: maxOf(remote.runGoldEarned, local.runGoldEarned),
    totalClicks: maxOf(remote.totalClicks, local.totalClicks),
    autoClicks: maxOf(remote.autoClicks, local.autoClicks),
    eclipseShards: maxOf(remote.eclipseShards, local.eclipseShards),
    shardsGranted: maxOf(remote.shardsGranted, local.shardsGranted),
    prestigeCount: maxOf(remote.prestigeCount, local.prestigeCount),
    streakDays: maxOf(remote.streakDays, local.streakDays),
    rpgFlatGold: maxOf(remote.rpgFlatGold, local.rpgFlatGold),
    upgrades: mergeUpgradeLevels(remote.upgrades, local.upgrades),
    artifacts: unionStrings(remote.artifacts, local.artifacts),
    cosmetics: unionStrings(remote.cosmetics, local.cosmetics),
    runewords: unionStrings(remote.runewords, local.runewords),
    equipped: mergeEquipped(remote.equipped, local.equipped),
    enchantments: mergeEnchantments(remote.enchantments, local.enchantments),
    levelsPaid: maxOf(remote.levelsPaid, local.levelsPaid),
    streakWeeksPaid: maxOf(remote.streakWeeksPaid, local.streakWeeksPaid),
    lastIdleAt: maxOf(remote.lastIdleAt, local.lastIdleAt),
    ops: [],
    origin: null,
    hlc: maxOf(remote.hlc, local.hlc),
  };
}

function mergeEquipped(
  remote: Record<string, string>,
  local: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...remote };
  for (const [slot, variant] of Object.entries(local)) {
    const held = out[slot];
    if (held === undefined) out[slot] = variant;
    else out[slot] = held < variant ? held : variant;
  }
  return out;
}

function mergeEnchantments(
  remote: { id: string; expiresAt: number }[],
  local: { id: string; expiresAt: number }[],
): { id: string; expiresAt: number }[] {
  const byId = new Map<string, { id: string; expiresAt: number }>();
  for (const e of [...remote, ...local]) {
    if (!e?.id) continue;
    const prev = byId.get(e.id);
    if (!prev || e.expiresAt > prev.expiresAt) byId.set(e.id, { ...e });
  }
  return [...byId.values()].sort((a, b) => a.id < b.id ? -1 : 1);
}

function mergeUpgradeLevels(
  remote: Record<string, number>,
  local: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, level] of Object.entries(remote)) out[id] = numberOf(level);
  for (const [id, level] of Object.entries(local)) {
    out[id] = Math.max(out[id] ?? 0, numberOf(level));
  }
  return out;
}

function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

export function coerceLedger(value: unknown): EconomyLedger | null {
  if (!isPlainObject(value)) return null;
  const base = emptyLedger();
  return {
    ...base,
    gold: numberOf(value['gold']),
    eclipseEssence: numberOf(value['eclipseEssence']),
    aetherFragments: numberOf(value['aetherFragments']),
    noxFragments: numberOf(value['noxFragments']),
    relicDust: numberOf(value['relicDust']),
    totalGoldEarned: numberOf(value['totalGoldEarned']),
    runGoldEarned: numberOf(value['runGoldEarned']),
    totalClicks: numberOf(value['totalClicks']),
    autoClicks: numberOf(value['autoClicks']),
    eclipseShards: numberOf(value['eclipseShards']),
    shardsGranted: numberOf(value['shardsGranted']),
    prestigeCount: numberOf(value['prestigeCount']),
    streakDays: numberOf(value['streakDays']),
    rpgFlatGold: numberOf(value['rpgFlatGold']),
    upgrades: isPlainObject(value['upgrades'])
      ? Object.fromEntries(Object.entries(value['upgrades']).map(([k, v]) => [k, numberOf(v)]))
      : {},
    artifacts: asStringArray(value['artifacts']),
    cosmetics: asStringArray(value['cosmetics']),
    runewords: asStringArray(value['runewords']),
    equipped: asStringMap(value['equipped']),
    enchantments: asEnchantments(value['enchantments']),
    levelsPaid: numberOf(value['levelsPaid']) || 1,
    streakWeeksPaid: numberOf(value['streakWeeksPaid']),
    lastIdleAt: numberOf(value['lastIdleAt']),
    ops: asOps(value['ops']),
    origin: value['origin'] ? coerceLedger(value['origin']) : null,
    hlc: numberOf(value['hlc']),
  };
}

function stripLog(state: EconomyLedger): EconomyLedger {
  return snapshotOf(state);
}

function asOps(value: unknown): EconomyOp[] {
  if (!Array.isArray(value)) return [];
  const out: EconomyOp[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw) || typeof raw['id'] !== 'string') continue;
    if (typeof raw['deviceId'] !== 'string') continue;
    out.push({
      id: raw['id'],
      deviceId: raw['deviceId'],
      seq: numberOf(raw['seq']),
      kind: raw['kind'] as EconomyOpKind,
      amount: raw['amount'] === undefined ? undefined : numberOf(raw['amount']),
      itemId: typeof raw['itemId'] === 'string' ? raw['itemId'] : undefined,
      slot: typeof raw['slot'] === 'string' ? raw['slot'] : undefined,
      extra: typeof raw['extra'] === 'string' || typeof raw['extra'] === 'number'
        ? raw['extra']
        : undefined,
      hlc: numberOf(raw['hlc']),
      wall: numberOf(raw['wall']),
    });
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asStringMap(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function asEnchantments(value: unknown): { id: string; expiresAt: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { id: string; expiresAt: number }[] = [];
  for (const e of value) {
    if (!isPlainObject(e) || typeof e['id'] !== 'string') continue;
    out.push({ id: e['id'], expiresAt: numberOf(e['expiresAt']) });
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function maxOf(a: number, b: number): number {
  return Math.max(a, b);
}
