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
 * Ordering is deterministic, not chronological. A hybrid logical clock only
 * guarantees per-device monotonicity after a clock moves backward. Two
 * disconnected devices have no shared time: a future-dated clock produces
 * larger HLC values and those ops sort later, even if they happened first.
 * Concurrent offline purchases therefore have a stable but arbitrary winner
 * (hlc, then deviceId, then seq, then id). A server-assigned sequence would
 * be the only real-world order; this client merge does not claim to be one.
 *
 * Credits (idle Gold, strikes, Essence) are ops too, so two devices that
 * earn independently keep both amounts.
 *
 * The log cannot grow forever (Firestore's document cap is 1 MiB). Merge
 * itself never folds — that would race an offline sibling. Compaction runs
 * only when committing the merged ledger to Firestore, and only after every
 * recently-seen device has acknowledged the current checkpoint
 * (`acknowledgeAndMaybeCompact`). Folded ops are skipped on replay via the
 * per-device `applied` watermark, so a stale offline log cannot double-apply.
 *
 * Blobs with no ops (every save from before this file) merge with the old
 * conservative max/union rule. A missing timestamp is not proof that a ledger
 * is older, so a stamped 100 Gold must not overwrite a legacy 9,999.
 */

export type EconomyOpKind =
  | 'credit-gold'
  | 'credit-essence'
  | 'spend-gold'
  | 'buy-upgrade'
  | 'buy-artifact'
  | 'buy-cosmetic'
  | 'buy-enchantment'
  | 'grant-runeword'
  | 'grant-cosmetic'
  | 'equip'
  | 'prestige';

const OP_KINDS = new Set<EconomyOpKind>([
  'credit-gold',
  'credit-essence',
  'spend-gold',
  'buy-upgrade',
  'buy-artifact',
  'buy-cosmetic',
  'buy-enchantment',
  'grant-runeword',
  'grant-cosmetic',
  'equip',
  'prestige',
]);

const AMOUNT_KINDS = new Set<EconomyOpKind>([
  'credit-gold',
  'credit-essence',
  'spend-gold',
  'buy-upgrade',
  'buy-artifact',
  'buy-cosmetic',
  'buy-enchantment',
  'prestige',
]);

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
  /**
   * Hybrid logical clock. Tie-breaks a total order; it is not a claim that
   * this op happened after every smaller HLC on another device.
   */
  hlc: number;
  /** Wall clock, informational only. Never used to decide a merge. */
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
  /**
   * Per-device max seq already folded into this snapshot. Replay skips any
   * op with seq <= applied[deviceId]. Empty until something has been compacted.
   */
  applied: Record<string, number>;
  /** Monotonic checkpoint id. Bumped only on a compacted cloud commit. */
  checkpointId: number;
  /** deviceId → last checkpoint that device has applied. */
  acks: Record<string, number>;
  /** deviceId → last wall-ms that device wrote. Stale devices stop blocking compact. */
  seenAt: Record<string, number>;
}

/** localStorage key for the stable per-browser device id. */
export const DEVICE_ID_KEY = 'godforge-device-id';

/** Fold when the live log reaches this many ops, if every recent device has acked. */
export const COMPACT_AFTER = 64;
/** Ops to keep after a checkpoint so a just-written burst is not immediately folded. */
export const COMPACT_KEEP = 16;
/** A device that has not written in this long does not block compaction. */
export const ACK_STALE_MS = 30 * 24 * 60 * 60 * 1000;

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
    applied: {},
    checkpointId: 0,
    acks: {},
    seenAt: {},
  };
}

/**
 * Compare two ops for a total, commutative order.
 *
 * This is the conflict policy for concurrent offline purchases: a stable
 * arbitrary winner, not a reconstruction of real-world time.
 */
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
    applied: { ...state.applied },
    acks: { ...state.acks },
    seenAt: { ...state.seenAt },
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
    applied: { ...state.applied },
    acks: { ...state.acks },
    seenAt: { ...state.seenAt },
  };
}

/**
 * Apply one op. Returns false when a debit cannot be afforded — the op stays
 * in the log so a later replay does not resurrect it, but ownership does not
 * change.
 */
export function applyOp(state: EconomyLedger, op: EconomyOp): boolean {
  const amount = numberOf(op.amount);
  if (AMOUNT_KINDS.has(op.kind) && amount <= 0) return false;
  switch (op.kind) {
    case 'credit-gold':
      state.gold += amount;
      state.runGoldEarned += amount;
      state.totalGoldEarned += amount;
      return true;
    case 'credit-essence':
      state.eclipseEssence += amount;
      return true;
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
  const applied = { ...origin.applied };
  for (const op of sortOps(ops)) {
    if (isApplied(applied, op)) continue;
    applyOp(state, op);
  }
  state.applied = applied;
  return state;
}

export function isApplied(applied: Record<string, number>, op: EconomyOp): boolean {
  return op.seq <= (applied[op.deviceId] ?? 0);
}

export function appliedCount(applied: Record<string, number> | undefined): number {
  if (!applied) return 0;
  let n = 0;
  for (const seq of Object.values(applied)) n += seq;
  return n;
}

export function maxSeqFor(deviceId: string, ops: readonly EconomyOp[]): number {
  let max = 0;
  for (const op of ops) {
    if (op.deviceId === deviceId && op.seq > max) max = op.seq;
  }
  return max;
}

/**
 * Fold a prefix of the log into origin and record a per-device watermark.
 *
 * Used only by {@link acknowledgeAndMaybeCompact} after every recently-seen
 * device has acked the current checkpoint. Merge itself never calls this.
 */
export function compactOps(
  origin: EconomyLedger,
  ops: EconomyOp[],
  keep = 300,
): { origin: EconomyLedger; ops: EconomyOp[] } {
  const sorted = sortOps(ops);
  if (sorted.length <= keep) return { origin, ops: sorted };
  const fold = sorted.slice(0, sorted.length - keep);
  const rest = sorted.slice(sorted.length - keep);
  const next = applyOps(origin, fold);
  const applied = { ...origin.applied };
  for (const op of fold) {
    applied[op.deviceId] = Math.max(applied[op.deviceId] ?? 0, op.seq);
  }
  next.applied = applied;
  next.ops = [];
  next.origin = null;
  return { origin: next, ops: rest };
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
  const ops = unionOps(importA.ops, importB.ops);
  const origin = pickOrigin(importA.origin, importB.origin);
  const replayed = applyOps(origin, ops);

  replayed.gold += Math.max(unexplainedGold(a, importA), unexplainedGold(b, importB));
  replayed.eclipseEssence += Math.max(
    unexplainedEssence(a, importA),
    unexplainedEssence(b, importB),
  );

  // Clicks / streak / wiring-layer copies are still snapshot-maxed.
  replayed.aetherFragments = maxOf(a.aetherFragments, b.aetherFragments);
  replayed.noxFragments = maxOf(a.noxFragments, b.noxFragments);
  replayed.relicDust = maxOf(a.relicDust, b.relicDust);
  replayed.totalGoldEarned = Math.max(
    replayed.totalGoldEarned,
    maxOf(a.totalGoldEarned, b.totalGoldEarned),
  );
  replayed.totalClicks = maxOf(a.totalClicks, b.totalClicks);
  replayed.autoClicks = maxOf(a.autoClicks, b.autoClicks);
  replayed.streakDays = maxOf(a.streakDays, b.streakDays);
  replayed.rpgFlatGold = maxOf(a.rpgFlatGold, b.rpgFlatGold);
  replayed.levelsPaid = maxOf(a.levelsPaid, b.levelsPaid);
  replayed.streakWeeksPaid = maxOf(a.streakWeeksPaid, b.streakWeeksPaid);
  replayed.lastIdleAt = maxOf(a.lastIdleAt, b.lastIdleAt);
  replayed.eclipseShards = Math.max(replayed.eclipseShards, maxOf(a.eclipseShards, b.eclipseShards));
  replayed.shardsGranted = Math.max(replayed.shardsGranted, maxOf(a.shardsGranted, b.shardsGranted));
  replayed.prestigeCount = Math.max(replayed.prestigeCount, maxOf(a.prestigeCount, b.prestigeCount));
  replayed.runGoldEarned = Math.max(replayed.runGoldEarned, 0);

  // Never fold here. The merged log stays the full union; the cloud commit
  // is what checkpoints, once every recent device has acked.
  replayed.ops = sortOps(ops);
  replayed.origin = origin;
  replayed.hlc = Math.max(a.hlc, b.hlc, ...ops.map(o => o.hlc));
  replayed.checkpointId = Math.max(a.checkpointId, b.checkpointId);
  replayed.acks = maxRecord(a.acks, b.acks);
  replayed.seenAt = maxRecord(a.seenAt, b.seenAt);
  replayed.version = 2;
  return replayed;
}

/**
 * Record that `deviceId` has applied the current checkpoint, and fold the
 * log if every recently-seen device has done the same.
 *
 * Runs only inside the Firestore transaction that writes the economy
 * document, so the checkpoint is the record, not a local guess. A device
 * that has not written for {@link ACK_STALE_MS} does not block the fold.
 */
export function acknowledgeAndMaybeCompact(
  ledger: EconomyLedger,
  deviceId: string,
  now: number,
  opts: { after?: number; keep?: number; staleMs?: number } = {},
): EconomyLedger {
  const after = opts.after ?? COMPACT_AFTER;
  const keep = opts.keep ?? COMPACT_KEEP;
  const staleMs = opts.staleMs ?? ACK_STALE_MS;
  const next = cloneLedger(ledger);
  next.acks = { ...next.acks, [deviceId]: next.checkpointId };
  next.seenAt = { ...next.seenAt, [deviceId]: now };

  if (next.ops.length < after || !next.origin) return next;

  const known = recentDevices(next, deviceId, now, staleMs);
  if (!known.every(id => (next.acks[id] ?? -1) >= next.checkpointId)) return next;

  const folded = compactOps(next.origin, next.ops, keep);
  next.origin = folded.origin;
  next.ops = folded.ops;
  next.applied = { ...folded.origin.applied };
  next.checkpointId += 1;
  next.acks = { ...next.acks, [deviceId]: next.checkpointId };
  return next;
}

function recentDevices(
  ledger: EconomyLedger,
  self: string,
  now: number,
  staleMs: number,
): string[] {
  const ids = new Set<string>([self]);
  for (const [id, at] of Object.entries(ledger.seenAt)) {
    if (now - at <= staleMs) ids.add(id);
  }
  return [...ids];
}

function maxRecord(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/**
 * Origins that have never been compacted can be max/unioned (legacy imports).
 * Once either side has a watermark, take the more-applied origin whole so
 * a folded prefix is not conservative-merged with the pre-fold gold pile
 * and then replayed again.
 */
function pickOrigin(a: EconomyLedger, b: EconomyLedger): EconomyLedger {
  const aN = appliedCount(a.applied);
  const bN = appliedCount(b.applied);
  if (aN === 0 && bN === 0) return conservativeMerge(a, b);
  return aN >= bN ? snapshotOf(a) : snapshotOf(b);
}

function asImport(blob: EconomyLedger): { origin: EconomyLedger; ops: EconomyOp[] } {
  if (blob.ops.length > 0 || appliedCount(blob.origin?.applied ?? blob.applied) > 0) {
    const origin = blob.origin ? snapshotOf(blob.origin) : stripLog(blob);
    return { origin, ops: blob.ops.map(o => ({ ...o })) };
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
    const prev = byId.get(op.id);
    if (!prev || payloadKey(op) > payloadKey(prev)) byId.set(op.id, { ...op });
  }
  return [...byId.values()];
}

/** Canonical payload for same-id conflicts. Higher string wins — commutative. */
export function payloadKey(op: EconomyOp): string {
  return JSON.stringify([
    op.kind,
    op.amount ?? null,
    op.itemId ?? null,
    op.slot ?? null,
    op.extra ?? null,
    op.hlc,
    op.wall,
  ]);
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
    applied: {},
    checkpointId: Math.max(remote.checkpointId, local.checkpointId),
    acks: maxRecord(remote.acks, local.acks),
    seenAt: maxRecord(remote.seenAt, local.seenAt),
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
    applied: asApplied(value['applied']),
    checkpointId: numberOf(value['checkpointId']),
    acks: asApplied(value['acks']),
    seenAt: asSeenAt(value['seenAt']),
  };
}

function stripLog(state: EconomyLedger): EconomyLedger {
  return snapshotOf(state);
}

export function parseOp(raw: unknown): EconomyOp | null {
  if (!isPlainObject(raw)) return null;
  const deviceId = raw['deviceId'];
  const id = raw['id'];
  const kind = raw['kind'];
  const seq = raw['seq'];
  if (typeof deviceId !== 'string' || deviceId.length === 0) return null;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof kind !== 'string' || !OP_KINDS.has(kind as EconomyOpKind)) return null;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) return null;
  if (id !== `${deviceId}:${seq}`) return null;
  const amount = raw['amount'];
  if (amount !== undefined) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  }
  if (AMOUNT_KINDS.has(kind as EconomyOpKind) && !(typeof amount === 'number' && amount > 0)) {
    return null;
  }
  const hlc = raw['hlc'];
  if (typeof hlc !== 'number' || !Number.isFinite(hlc) || hlc < 0) return null;
  return {
    id,
    deviceId,
    seq,
    kind: kind as EconomyOpKind,
    amount: typeof amount === 'number' ? amount : undefined,
    itemId: typeof raw['itemId'] === 'string' ? raw['itemId'] : undefined,
    slot: typeof raw['slot'] === 'string' ? raw['slot'] : undefined,
    extra: typeof raw['extra'] === 'string' || typeof raw['extra'] === 'number'
      ? raw['extra']
      : undefined,
    hlc,
    wall: numberOf(raw['wall']),
  };
}

function asOps(value: unknown): EconomyOp[] {
  if (!Array.isArray(value)) return [];
  const out: EconomyOp[] = [];
  for (const raw of value) {
    const op = parseOp(raw);
    if (op) out.push(op);
  }
  return out;
}

function asApplied(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [deviceId, seq] of Object.entries(value)) {
    if (!deviceId || typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) continue;
    out[deviceId] = seq;
  }
  return out;
}

function asSeenAt(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [deviceId, at] of Object.entries(value)) {
    if (!deviceId || typeof at !== 'number' || !Number.isFinite(at) || at < 0) continue;
    out[deviceId] = at;
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
