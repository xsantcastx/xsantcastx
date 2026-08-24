/**
 * cloud-save.model.ts — what gets synced, and how two devices are reconciled.
 *
 * The Godforge keeps its state in eighteen independent localStorage blobs, each
 * owned by the service that understands it. Cloud save deliberately does *not*
 * take that ownership away: every service keeps reading and writing localStorage
 * synchronously, exactly as it does today, and this layer copies those blobs up
 * and down. That is what keeps the site working signed-out and offline, and it
 * is why adding cloud save did not require rewriting the services that own them.
 *
 * `eclipse-progress` is the exception, and only because it already had somewhere
 * better to go: `ProgressStorageService` was built against a `ProgressAdapter`
 * interface with a Firestore implementation stubbed out, so XP rides that seam
 * (see `FirestoreAdapter` in progress-storage.service.ts) rather than this one.
 * The blobs below have no such seam, and inventing one for each would have been
 * nine rewrites to reach the same place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MERGE RULE: HIGHER WINS, NOTHING IS EVER LOST
 * ─────────────────────────────────────────────────────────────────────────────
 * Two devices are reconciled field by field, taking the larger number, the union
 * of every id set, and the later timestamp. It is deliberately generous and
 * deliberately commutative: signing in must never cost anybody progress, and
 * which device signed in first must never matter.
 *
 * Spendable balances (Gold, Eclipse Essence) are the exception. Taking the
 * larger of two balances silently refunds every purchase the poorer device made,
 * which is how cloud save used to restore Gold a second after you spent it.
 * Those fields are reconciled by replaying an idempotent operation log
 * (see mergeEconomy / economy-ops.ts). Purchases that cannot be afforded in
 * canonical order are skipped rather than minted. Concurrent offline
 * purchases have a deterministic but arbitrary winner — not chronological
 * last-write. A server-assigned sequence would be required to make the
 * winner match real-world time. Legacy blobs with no log still use the
 * conservative max/union rule. The live log is checkpointed on the
 * Firestore write once every recently-seen device has acknowledged.
 */

import { mergeEconomyLedgers } from '../economy/economy-ops';
import { mergeInventoryLedgers } from '../rpg/inventory-ops';
import { mergeActivityLedgers } from '../activity/activity-ops';
import { mergeChapterLedgers } from '../narrative/chapter-ops';
import { mergeCollectionLedgers } from '../collection/collection.model';
import { mergeCrafting as mergeCraftingState } from '../crafting/crafting.model';

// ─────────────────────────────────────────────────────────────────────────────
// The registry
// ─────────────────────────────────────────────────────────────────────────────

/** Which Firestore subcollection under `users/{uid}` a blob is filed in. */
export type SyncCollection = 'progress' | 'economy';

export interface SyncedBlob {
  /** The localStorage key the owning service reads and writes. */
  key: string;
  /** Subcollection under `users/{uid}`. */
  collection: SyncCollection;
  /** Document id within that subcollection. */
  doc: string;
  /** Human-readable, for the sync log. */
  label: string;
  /**
   * Overrides the structural merge for blobs where "higher wins" is the wrong
   * question — a first-discovery date, a bounded leaderboard, a preference.
   */
  merge?: (remote: unknown, local: unknown) => unknown;
}

/**
 * Everything synced outside of `eclipse-progress`.
 *
 * The economy gets its own subcollection because it is the one ledger with
 * spendable currency in it, and a rule that one day has to say something
 * stricter about Gold should not have to say it about the lore chapters too.
 */
export const SYNCED_BLOBS: SyncedBlob[] = [
  {
    key: 'godforge-economy',
    collection: 'economy',
    doc: 'state',
    label: 'Godforge ledger',
    // Spendable balances cannot use the structural max rule. See mergeEconomy.
    merge: mergeEconomy,
  },
  {
    key: 'eclipse-quests',
    collection: 'progress',
    doc: 'quests',
    label: 'quest log',
  },
  {
    key: 'eclipse-lore',
    collection: 'progress',
    doc: 'lore',
    label: 'lore chapters',
  },
  {
    key: 'eclipse-idle',
    collection: 'progress',
    doc: 'idle',
    label: 'forge flame',
  },
  {
    key: 'tool-usage-counts',
    collection: 'progress',
    doc: 'mastery',
    label: 'progress ledger',
  },
  {
    key: 'easter-eggs-found',
    collection: 'progress',
    doc: 'eggs',
    label: 'discoveries',
  },
  {
    key: 'easter-eggs-dates',
    collection: 'progress',
    doc: 'egg-dates',
    label: 'discovery dates',
    // The only blob where the larger value is the wrong one. These are the
    // moments things were *first* found, so a later date is not a better date —
    // it is the record of the same discovery made again on a second device, and
    // keeping it would quietly rewrite somebody's history forward.
    merge: mergeEarliestDates,
  },
  {
    key: 'eclipse-arena-scores',
    collection: 'progress',
    doc: 'arena',
    label: 'arena records',
    // `{ games: { id: { best, plays, cleared } } }` — the structural rules land
    // exactly right on all three: best and plays take the higher, and `cleared`
    // is a flag that stays set once either device has beaten the game.
  },
  {
    key: 'eclipse-realm-rush-board',
    collection: 'progress',
    doc: 'realm-rush-board',
    label: 'Realm Rush board',
    merge: mergeTopRuns,
  },
  {
    key: 'godforge-pinned',
    collection: 'progress',
    doc: 'pinned',
    label: 'trophy case',
    merge: mergePreference,
  },
  {
    key: 'eclipse-combo',
    collection: 'progress',
    doc: 'combo',
    label: 'combo record',
    // `{ version, best }` — a high-water mark, so the structural max is exactly
    // right. The live run is deliberately not persisted and so never syncs:
    // a combo is a rhythm being held, and there is no honest way to store
    // "mid-run" or to hand one device a streak the other earned.
  },

  // ───────────────────────────────────────────────────────────────────────────
  // The RPG layer
  // ───────────────────────────────────────────────────────────────────────────
  // Everything below arrived after this registry was written — the RuneForge in
  // v2.47, Lore Scrolls in v2.49, the character sheet and expeditions in v2.55 —
  // and none of it was added here. The effect was not a partial sync that looked
  // partial: XP, Gold and eggs reconciled correctly, so both devices reported
  // "Synced" while a visitor's entire bag, stat build, roster, rune ledger and
  // scroll collection stayed device-local and silently diverged.
  //
  // The lesson is structural rather than a list of six oversights: the registry
  // is the *only* thing that knows a blob exists, and nothing fails when a new
  // one is missing from it. Any service that adds a localStorage key holding
  // progression has to add it here in the same change.
  {
    key: 'godforge-inventory',
    collection: 'progress',
    doc: 'inventory',
    label: 'inventory',
    merge: mergeInventory,
  },
  {
    key: 'godforge-activity',
    collection: 'progress',
    doc: 'activity',
    label: 'current work',
    merge: mergeActivity,
  },
  {
    key: 'godforge-chapter',
    collection: 'progress',
    doc: 'chapter',
    label: 'chapter positions',
    merge: mergeChapter,
  },
  {
    key: 'godforge-stats',
    collection: 'progress',
    doc: 'stats',
    label: 'character sheet',
    merge: mergeStatBuild,
  },
  {
    key: 'godforge-roster',
    collection: 'progress',
    doc: 'roster',
    label: 'explorer roster',
    merge: mergeRoster,
  },
  {
    key: 'godforge-explorers',
    collection: 'progress',
    doc: 'expeditions',
    label: 'expedition log',
    merge: mergeExpeditions,
  },
  {
    key: 'godforge-runes',
    collection: 'progress',
    doc: 'runes',
    label: 'rune ledger',
    merge: mergeRuneLedger,
  },
  {
    key: 'godforge-scrolls',
    collection: 'progress',
    doc: 'scrolls',
    label: 'lore scrolls',
    merge: mergeScrollLedger,
  },
  {
    key: 'codex-secrets',
    collection: 'progress',
    doc: 'secrets',
    label: 'codex secrets',
    // Was device-local on the grounds that a console-entered code is not
    // progression. It reads as progression to the person who found it: the
    // Codex counts these alongside the eggs, and a visitor who parted the veil
    // on a desktop and then opened the site on a phone saw the count reset.
    merge: mergeSecretLedgers,
  },
  {
    key: 'godforge-collection',
    collection: 'progress',
    doc: 'collection',
    label: 'collection log',
    // The structural rules are wrong here in both directions at once, which is
    // why this one is hand-written: `count` wants the higher of the two, and
    // `firstDiscoveredAt` wants the *lower* — it is the moment a thing was
    // first ever held, so the later of two devices' answers is the same
    // discovery made twice, and adopting it would rewrite somebody's history
    // forward. Same trap as `easter-eggs-dates`, one field down.
    merge: mergeCollection,
  },
  {
    key: 'godforge-thralls',
    collection: 'progress',
    doc: 'thralls',
    label: 'Forge Thralls',
    merge: mergeThralls,
  },
  {
    key: 'godforge-crafting',
    collection: 'progress',
    doc: 'crafting',
    label: 'crafting',
    // `{ version, xp, crafted }` — lifetime XP and a per-recipe lifetime count.
    // Every number is monotone, so the structural rule would land right on all
    // of them; the hand-written merge exists so that the day a non-counter field
    // arrives (a pinned recipe, a bench layout) it has to be an edit to a
    // function somebody reads, not a silent inheritance of "take the larger".
    merge: mergeCrafting,
  },
  {
    key: 'godforge-gambler',
    collection: 'economy',
    doc: 'gambler',
    label: 'The Gambler',
    // Filed under `economy` rather than `progress` because every number in it is
    // a consequence of spending Gold — lifetime spend, opens per box, and the
    // bad-luck counter those opens built. The structural merge is right for all
    // four: they are monotone counters, so the higher of two devices' copies is
    // the true one, and taking the higher pity count can only ever pay a
    // guarantee out sooner than one device alone had earned it.
  },
  {
    key: 'godforge-exchange',
    collection: 'economy',
    doc: 'exchange',
    label: 'Grand Exchange',
    // Filed under `economy` for the same reason as the Gambler: every number in
    // it is a consequence of moving Gold. It is the one blob where the
    // structural rule is wrong in *both* directions rather than one, which is
    // why it has a hand-written merge — see mergeExchange.
    merge: mergeExchange,
  },
  {
    key: 'eclipse-npc',
    collection: 'progress',
    doc: 'npc',
    label: 'NPC chains',
    // `{ version, claimed: string[], seen: string[] }` — and the structural
    // rules land exactly right on all three, which is why there is no hand-
    // written merge here. `version` is a number and takes the max; `claimed`
    // is a set of step receipts, and a step claimed on either device is
    // claimed, so the union is the only honest answer; `seen` is a set of
    // heard-line ids where the union simply means both devices' reading
    // history is remembered. Nothing here is spendable and nothing here is a
    // first-discovery date, so neither of the two traps that needed custom
    // rules elsewhere applies. `NpcQuestService.load()` re-clamps `seen` to
    // its cap on the way in, which is what keeps a union of two long
    // histories from growing without bound.
  },
  {
    key: 'godforge-pro',
    collection: 'progress',
    doc: 'pro',
    label: 'Pro pack',
    // Not progression — an entitlement somebody paid for, and the one blob where
    // the visible bug was the reverse of the others: buying the pack on a
    // desktop and then opening the site on a phone showed the ads again. The
    // structural rules are already right for it (a flag that has been set stays
    // set), and `grantsSettled` riding the same OR is what stops the currency
    // grant being minted a second time on the device that adopts it.
  },
];

/** Roster ceiling. Mirrors MAX_ROSTER in explorer-roster.service.ts. */
const MAX_ROSTER = 20;

/**
 * Thrall ceilings. Mirror `MAX_THRALLS` and `THRALL_LOG_MAX` in
 * `thralls/thrall.model.ts`.
 *
 * Copied rather than imported for the reason the whole file is import-light:
 * cloud save is eager and the Thrall model is a lazy chunk on two routes, so an
 * import here would pull the tier table, the name stems and the shop catalogue
 * into the initial bundle of all 126 pages to read two integers. The copies are
 * asserted against the originals in `thrall.model.spec.ts`.
 */
const MAX_THRALLS = 16;
const THRALL_LOG_MAX = 40;

/**
 * Two bags into one, keyed by item id.
 *
 * The structural rules are wrong here in a way that is worth naming, because
 * they fail quietly rather than loudly. `GameItem` carries `equipped`, `slot`
 * and `explorerId` — where the item *is* — and merging those field by field
 * takes the boolean OR of `equipped` and the greater of two `slot` strings,
 * which is how a sword worn on one device and a hammer worn on the other end up
 * both claiming the same slot and both paying stats. Identity is the right unit:
 * an item exists in exactly one place, so the local record wins whole or the
 * remote one is adopted whole, and nothing is ever half-merged.
 *
 * `InventoryService.load()` runs `dedupeSlots()` over whatever it reads, so the
 * one case this cannot avoid — the same id equipped in different slots on each
 * device — is resolved on the way in rather than defended against here.
 *
 * The cap is the reason this is not simply a union: two full bags merge to 500
 * items, and the blob is parsed on every page load. Eviction follows the
 * service's own rule — worn items are never dropped, then the most valuable are
 * kept — so a merge cannot silently destroy what a visitor is wearing.
 */
/**
 * Reconcile two Godforge ledgers without refunding spends or minting Gold.
 *
 * Delegates to the operation log in economy-ops.ts. Legacy blobs (no ops)
 * keep the conservative max/union rule.
 */
export function mergeEconomy(remote: unknown, local: unknown): unknown {
  return mergeEconomyLedgers(remote, local);
}

function mergeInventory(remote: unknown, local: unknown): unknown {
  return mergeInventoryLedgers(remote, local);
}

function mergeCollection(remote: unknown, local: unknown): unknown {
  return mergeCollectionLedgers(remote, local);
}

function mergeCrafting(remote: unknown, local: unknown): unknown {
  return mergeCraftingState(remote, local);
}

function mergeActivity(remote: unknown, local: unknown): unknown {
  return mergeActivityLedgers(remote, local);
}

function mergeChapter(remote: unknown, local: unknown): unknown {
  return mergeChapterLedgers(remote, local);
}

/**
 * Union of two object arrays by `id`, local first, with the local record kept
 * whole wherever both sides hold the same id.
 */
function unionById(remote: unknown[], local: unknown[]): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();

  for (const list of [local, remote]) {
    for (const entry of list) {
      const id = isPlainObject(entry) && typeof entry['id'] === 'string' ? entry['id'] : null;
      const key = id ?? `j:${safeStringify(entry)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}

/**
 * Two stat builds into one — the one blob where the generous merge would mint
 * something out of nothing.
 *
 * Stat points are *spent*, not accumulated: a visitor at rank 10 has a fixed
 * number of them and has chosen where they went. Taking the field-wise maximum
 * of two builds gives 5 Strength from the desktop and 5 Luck from the phone to
 * somebody who only ever earned five points, and the character sheet then reads
 * a total it was never paid for. So a build is adopted whole, and the side that
 * has settled more ranks — the one that has been played further — is the one
 * that wins. `respecs` is a lifetime tally and takes the larger, because that
 * one really is a counter.
 */
function mergeStatBuild(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  const remoteEra = numberOf(remote['era']);
  const localEra = numberOf(local['era']);
  if (remoteEra !== localEra) {
    return remoteEra > localEra ? remote : local;
  }

  const remoteRank = numberOf(remote['levelsGranted']);
  const localRank = numberOf(local['levelsGranted']);
  // Ties go to the device in the visitor's hands: two builds settled to the same
  // rank are two valid answers, and the one they can see is the one they meant.
  const winner = remoteRank > localRank ? remote : local;

  return {
    ...winner,
    version: 1,
    levelsGranted: Math.max(remoteRank, localRank),
    respecs: maxOf(remote['respecs'], local['respecs']),
  };
}

/**
 * Two rosters into one. Explorers are hired, not levelled, so identity is again
 * the unit — a merged explorer would be a half of each.
 */
function mergeRoster(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  const explorers = unionById(asArray(remote['explorers']), asArray(local['explorers']));

  return {
    ...local,
    version: 1,
    explorers: explorers.slice(0, MAX_ROSTER),
    // Once either device has minted the starter, nobody gets a second one.
    seeded: remote['seeded'] === true || local['seeded'] === true,
    found: maxOf(remote['found'], local['found']),
  };
}

/**
 * Lifetime expedition tallies merge; expeditions in flight do not.
 *
 * `active` holds running missions with a wall-clock deadline on the device that
 * started them. Unioning two devices' in-flight lists hands somebody a mission
 * they never dispatched, and one of the two copies would then pay out twice.
 * The device being used keeps its own runs; the counters underneath, which are
 * genuinely lifetime totals, take the larger.
 */
function mergeExpeditions(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  return {
    ...local,
    version: 1,
    active: asArray(local['active']),
    itemsFound: maxOf(remote['itemsFound'], local['itemsFound']),
    runesFound: maxOf(remote['runesFound'], local['runesFound']),
    scrollsFound: maxOf(remote['scrollsFound'], local['scrollsFound']),
    missionsCompleted: maxOf(remote['missionsCompleted'], local['missionsCompleted']),
    goldRecovered: maxOf(remote['goldRecovered'], local['goldRecovered']),
    // The log *does* union, unlike `active`, because every line in it is an
    // expedition that already finished and already paid — replaying it costs
    // nothing and dropping it loses a real event. Keyed on the expedition id,
    // which carries its own start timestamp, so the same landing seen from two
    // devices collapses to one line.
    history: mergeExpeditionLog(remote['history'], local['history']),
  };
}

/**
 * Two Thrall shifts into one.
 *
 * A Thrall is minted, not levelled into existence, so identity is the unit for
 * the same reason it is for an explorer: field-wise merging two copies of the
 * same worker takes the higher stamina *and* the higher level *and* the union
 * of both equipment wells, which is a Thrall wearing four items and rested on a
 * device where they have been pulling all afternoon.
 *
 * The device in the visitor's hands keeps its own roster whole. `status`,
 * `stamina` and the two `lastAt` clocks are all *live* state with a wall-clock
 * meaning on the device that wrote them, and adopting a remote copy of those
 * is how a Thrall arrives from a phone that has been shut for a week and either
 * pays out a week of rest in one beat or never rests again. The remote roster
 * contributes only the Thralls this device has never seen — which is the real
 * case worth merging: one bought in the Market on another device.
 *
 * The lifetime tallies underneath genuinely are counters and take the larger.
 * The log unions and is capped, like the expedition log, because every line in
 * it is a find that already landed and already paid.
 */
function mergeThralls(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  const thralls = unionById(asArray(remote['thralls']), asArray(local['thralls']))
    .slice(0, MAX_THRALLS);

  return {
    ...local,
    version: 1,
    thralls,
    log: mergeThrallLog(remote['log'], local['log']),
    goldSpent: maxOf(remote['goldSpent'], local['goldSpent']),
    rolls: maxOf(remote['rolls'], local['rolls']),
    finds: mergeCounts(remote['finds'], local['finds']),
    // `foundToday` belongs to `dayKey`, so the two move together or not at all.
    // Taking the larger count against the local day would credit yesterday's
    // haul from another timezone to today.
    dayKey: local['dayKey'],
    foundToday: local['dayKey'] === remote['dayKey']
      ? maxOf(remote['foundToday'], local['foundToday'])
      : numberOf(local['foundToday']),
  };
}

/** Newest-first union of two Thrall logs, deduped by id and capped. */
function mergeThrallLog(remote: unknown, local: unknown): unknown[] {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const list of [asArray(local), asArray(remote)]) {
    for (const entry of list) {
      if (!isPlainObject(entry)) continue;
      const id = typeof entry['id'] === 'string' ? entry['id'] : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(entry);
    }
  }
  rows.sort((a, b) => numberOf(b['at']) - numberOf(a['at']));
  return rows.slice(0, THRALL_LOG_MAX);
}

/** Ticker ceiling. Mirrors TRADE_LOG_LIMIT in exchange/exchange.service.ts. */
const EXCHANGE_LOG_MAX = 40;

/**
 * Half-life of a market footprint. Mirrors PRESSURE_HALF_LIFE_MS in
 * exchange/exchange.model.ts.
 *
 * Copied rather than imported for the reason the whole file is import-light:
 * cloud save is eager and the Exchange model is a lazy chunk on one route, so
 * an import here would pull the catalogue, the noise functions and the event
 * table into the initial bundle of every page to read one integer. The copy is
 * asserted against the original in `cloud-save.model.spec.ts`.
 */
const EXCHANGE_PRESSURE_HALF_LIFE_MS = 6 * 3_600_000;

/**
 * Reconcile two devices' Grand Exchange records.
 *
 * The structural rule is wrong here in both directions at once, which is rare
 * enough to be worth writing down:
 *
 *   · `pressure.net` is **signed**. It is how far the player's own trading has
 *     pushed a line off its base — positive for buying, negative for selling.
 *     Taking the larger of two copies would silently discard every sale made on
 *     the other device, so a player who dumped four hundred ore on a phone would
 *     find the price un-dented on their desktop.
 *   · `spent` and `earned` are a *daily* tally, not a high-water mark. Taking
 *     the max of two different days reports the busier day forever.
 *
 * So pressure is decayed to a common instant and **added**, because both
 * devices really did make those trades and the market really did absorb both.
 * That is also commutative, which the merge contract requires: which device
 * signed in first must not change the answer.
 *
 * Nothing here is spendable — Gold itself is reconciled by the economy ledger's
 * operation log — so a generous merge cannot mint anything. The worst a wrong
 * answer costs is a price that is off for a few hours until the decay eats it.
 */
function mergeExchange(remote: unknown, local: unknown): unknown {
  const r = isPlainObject(remote) ? remote : {};
  const l = isPlainObject(local) ? local : {};

  // ── pressure: decay both sides to the later stamp, then sum ───────────────
  const pressure: Record<string, { net: number; at: number }> = {};
  const ids = new Set<string>();
  for (const side of [r['pressure'], l['pressure']]) {
    if (isPlainObject(side)) for (const key of Object.keys(side)) ids.add(key);
  }
  for (const id of ids) {
    const a = readFootprint(r['pressure'], id);
    const b = readFootprint(l['pressure'], id);
    if (!a && !b) continue;
    if (!a) { pressure[id] = b!; continue; }
    if (!b) { pressure[id] = a; continue; }
    const at = Math.max(a.at, b.at);
    pressure[id] = { net: decayTo(a, at) + decayTo(b, at), at };
  }

  // ── the ticker: newest-first union, deduped by id ─────────────────────────
  const seen = new Set<string>();
  const trades: Record<string, unknown>[] = [];
  for (const row of [...asArray(l['trades']), ...asArray(r['trades'])]) {
    if (!isPlainObject(row)) continue;
    const id = typeof row['id'] === 'string' ? row['id'] : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    trades.push(row);
  }
  trades.sort((a, b) => numberOf(b['at']) - numberOf(a['at']));

  // ── the daily tally: sum within a day, adopt the later day outright ───────
  const rDay = typeof r['day'] === 'string' ? r['day'] : '';
  const lDay = typeof l['day'] === 'string' ? l['day'] : '';
  const day = rDay > lDay ? rDay : lDay;
  const sameDay = rDay === lDay && rDay !== '';
  const tally = (field: string) =>
    sameDay
      ? numberOf(r[field]) + numberOf(l[field])
      : numberOf((rDay === day ? r : l)[field]);

  return {
    version: 1,
    pressure,
    trades: trades.slice(0, EXCHANGE_LOG_MAX),
    day,
    spent: tally('spent'),
    earned: tally('earned'),
    taxPaid: tally('taxPaid'),
  };
}

function readFootprint(side: unknown, id: string): { net: number; at: number } | null {
  if (!isPlainObject(side)) return null;
  const row = side[id];
  if (!isPlainObject(row)) return null;
  const net = row['net'];
  const at = row['at'];
  if (typeof net !== 'number' || !Number.isFinite(net)) return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  return { net, at };
}

function decayTo(footprint: { net: number; at: number }, at: number): number {
  const elapsed = Math.max(0, at - footprint.at);
  return footprint.net * Math.pow(0.5, elapsed / EXCHANGE_PRESSURE_HALF_LIFE_MS);
}

/** Field-wise max of two `{ id: count }` maps. Used for the Thrall tallies. */
function mergeCounts(remote: unknown, local: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const side of [remote, local]) {
    if (!isPlainObject(side)) continue;
    for (const [key, value] of Object.entries(side)) {
      const n = numberOf(value);
      if (n > (out[key] ?? 0)) out[key] = n;
    }
  }
  return out;
}

/** Newest-first union of two expedition logs, deduped by id and capped. */
function mergeExpeditionLog(remote: unknown, local: unknown): unknown[] {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for (const row of [...asArray(local), ...asArray(remote)]) {
    if (!isPlainObject(row)) continue;
    const id = row['id'];
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    rows.push(row);
  }

  return rows
    .sort((a, b) => numberOrZero(b['returnedAt']) - numberOrZero(a['returnedAt']))
    .slice(0, EXPEDITION_LOG_CAP);
}

/**
 * Mirrors `EXPEDITION_HISTORY_CAP`, restated rather than imported.
 *
 * This file is the merge layer and is deliberately free of imports from the
 * feature services it merges — it runs against *blobs*, including blobs written
 * by a build whose constant said something else. A drifted number here caps a
 * merged log slightly long or short, which is invisible; an import cycle between
 * the save layer and every feature that persists is not.
 */
const EXPEDITION_LOG_CAP = 10;

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * The rune ledger. Counts take the larger; first-found dates take the earlier,
 * for the same reason the egg dates do — these are the moments a rune was
 * *first* pulled, and a later one is the same discovery made again elsewhere.
 */
function mergeRuneLedger(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  return {
    ...local,
    version: 1,
    runes: mergeDeep(remote['runes'] ?? {}, local['runes'] ?? {}),
    firstFound: mergeEarliestDates(remote['firstFound'], local['firstFound']),
    strikes: maxOf(remote['strikes'], local['strikes']),
    goldSpent: maxOf(remote['goldSpent'], local['goldSpent']),
  };
}

/** Scrolls: found-dates take the earlier, read-ids union. */
function mergeScrollLedger(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(local)) return remote ?? local;
  if (!isPlainObject(remote)) return local;

  return {
    ...local,
    version: 1,
    found: mergeEarliestDates(remote['found'], local['found']),
    read: mergeDeep(asArray(remote['read']), asArray(local['read'])),
  };
}

function maxOf(a: unknown, b: unknown): number {
  return Math.max(numberOf(a), numberOf(b));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** How many runs the Realm Rush board keeps. Mirrors BOARD_SIZE in its component. */
const BOARD_SIZE = 5;

/**
 * Two local top-five boards into one top five.
 *
 * The structural union is wrong here for a reason worth naming: these entries
 * carry no id, so it would keep every distinct run from both devices and hand
 * back a board of up to ten. A leaderboard is not a set — it is the best N, and
 * merging two of them means ranking the combined runs and taking N again.
 */
function mergeTopRuns(remote: unknown, local: unknown): unknown {
  const runs = [...asArray(local), ...asArray(remote)];
  const seen = new Set<string>();
  const unique = runs.filter(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, BOARD_SIZE);
}

/**
 * A display preference, where "merging" is the wrong verb entirely.
 *
 * The trophy case holds five pins chosen by hand, and `null` means the visitor
 * has never customised it — which the owning service keeps distinct from an
 * empty array on purpose. Unioning two devices' choices would both overflow the
 * five slots and silently un-choose whatever each device had decided. So the
 * device being used wins, and a device that has never been customised inherits
 * the other one's case rather than blanking it.
 *
 * Deliberately not commutative, unlike every other rule here. A preference is
 * the one kind of state where the answer *should* depend on where you set it.
 */
function mergePreference(remote: unknown, local: unknown): unknown {
  return local ?? remote;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function scoreOf(entry: unknown): number {
  if (isPlainObject(entry) && typeof entry['score'] === 'number') return entry['score'];
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// The structural merge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconcile two parsed blobs without knowing what either of them is.
 *
 * A hand-written merge for each blob was the obvious alternative and the wrong
 * one: nine of them would have had to be kept in step with nine state shapes
 * owned by nine other files, and the failure mode of falling behind is silent
 * data loss on a field nobody remembered to add. The structural rules below are
 * stated once and hold for any shape those services grow into.
 *
 *   number   → the larger. Counters, currencies, timestamps, tallies.
 *   string   → the greater. Every string in these blobs is an ISO instant or a
 *              YYYY-MM-DD / W-prefixed period key, where lexical order *is*
 *              chronological order. For anything else it is arbitrary but
 *              harmless — the strings that are neither are cosmetic variant ids,
 *              where both devices own both variants and either answer is valid.
 *   boolean  → either. A flag that has been set stays set.
 *   array    → union. Primitives dedupe by value; objects dedupe by identity
 *              (see `entryKey`) and are merged pairwise by these same rules.
 *   object   → the union of both key sets, values merged pairwise.
 *
 * Mismatched types keep the local value, on the grounds that a shape change is a
 * client version difference and the running client is the one that can read it.
 */
export function mergeDeep(remote: unknown, local: unknown): unknown {
  if (remote === undefined || remote === null) return local;
  if (local === undefined || local === null) return remote;

  if (typeof remote === 'number' && typeof local === 'number') {
    // NaN loses to a real number rather than poisoning the field.
    if (!Number.isFinite(remote)) return local;
    if (!Number.isFinite(local)) return remote;
    return Math.max(remote, local);
  }

  if (typeof remote === 'boolean' && typeof local === 'boolean') {
    return remote || local;
  }

  if (typeof remote === 'string' && typeof local === 'string') {
    return remote > local ? remote : local;
  }

  if (Array.isArray(remote) && Array.isArray(local)) {
    return mergeArrays(remote, local);
  }

  if (isPlainObject(remote) && isPlainObject(local)) {
    const out: Record<string, unknown> = { ...local };
    for (const [k, v] of Object.entries(remote)) {
      out[k] = k in local ? mergeDeep(v, local[k]) : v;
    }
    return out;
  }

  return local;
}

/**
 * Union of two arrays, local order first.
 *
 * Order is not meaningful in any of the synced arrays — they are id sets and
 * append-only logs — so "local first, then whatever the remote had that we did
 * not" keeps the merge stable without needing a sort key the data does not have.
 */
function mergeArrays(remote: unknown[], local: unknown[]): unknown[] {
  const out: unknown[] = [];
  const index = new Map<string, number>();

  for (const item of local) {
    const key = entryKey(item);
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push(item);
    } else {
      // Duplicate ids inside one device's own array: merge rather than drop, so
      // a blob that was already inconsistent does not lose a field on sync.
      out[at] = mergeDeep(out[at], item);
    }
  }

  for (const item of remote) {
    const key = entryKey(item);
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push(item);
    } else {
      out[at] = mergeDeep(item, out[at]);
    }
  }

  return out;
}

/**
 * The identity two array entries are considered the same under.
 *
 * The distinction that matters is between the two kinds of object array in the
 * synced blobs:
 *
 *  - Running enchantments (`{ id, expiresAt }`) are keyed by `id` alone, so two
 *    devices running the same enchantment merge to one entry holding the later
 *    expiry rather than two timers for one purchase.
 *  - Quest log receipts (`{ id, title, type, xp, at }`) carry `at`, and clearing
 *    the same daily on Monday and again on Tuesday is genuinely two completions.
 *    Keying those on `id` alone would collapse a history into a single line.
 *
 * So: `id` plus `at` when the entry timestamps itself, `id` alone when it does
 * not, and the whole value when it has no id to be known by.
 */
function entryKey(item: unknown): string {
  if (isPlainObject(item)) {
    const id = item['id'];
    if (typeof id === 'string' || typeof id === 'number') {
      const at = item['at'];
      return typeof at === 'string' ? `${id}@${at}` : `${id}`;
    }
  }
  if (item === null || typeof item !== 'object') return `p:${String(item)}`;
  try {
    return `j:${JSON.stringify(item)}`;
  } catch {
    return `j:${String(item)}`;
  }
}

/** Keys the first time each id was seen, not the most recent. */
/**
 * The codex secrets ledger: `{ [secretId]: { at, how } }`.
 *
 * Found on either device means found, so the union of the keys is right. What
 * the structural rules get wrong is the record itself — comparing two objects
 * "higher wins" is meaningless, and comparing their `at` strings would keep the
 * *later* one, which is the same secret found again on a second device rather
 * than a better record of when it was first found. Earliest `at` wins, and the
 * `how` that travels with it stays attached to the discovery it describes:
 * "walked into it" on the phone that got there first is the true story, even if
 * the desktop later summoned the same secret by keystroke.
 */
function mergeSecretLedgers(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(remote)) return local ?? {};
  if (!isPlainObject(local)) return remote;

  const out: Record<string, unknown> = { ...local };
  for (const [id, incoming] of Object.entries(remote)) {
    const held = out[id];
    if (!isPlainObject(held)) {
      out[id] = incoming;
      continue;
    }
    if (!isPlainObject(incoming)) continue;
    const heldAt = held['at'];
    const incomingAt = incoming['at'];
    if (typeof heldAt !== 'string' || (typeof incomingAt === 'string' && incomingAt < heldAt)) {
      out[id] = incoming;
    }
  }
  return out;
}

function mergeEarliestDates(remote: unknown, local: unknown): unknown {
  if (!isPlainObject(remote)) return local ?? {};
  if (!isPlainObject(local)) return remote;

  const out: Record<string, unknown> = { ...local };
  for (const [id, when] of Object.entries(remote)) {
    const held = out[id];
    if (typeof held !== 'string' || (typeof when === 'string' && when < held)) {
      out[id] = when;
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparing two saves
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What each side of the merge dialog shows.
 *
 * Three numbers, chosen because they are the three a person recognises their own
 * save by. The merge itself reconciles far more than this — every quest, every
 * discovery date, every arena record — but a dialog that listed all of it would
 * be asking somebody to audit a diff before they can press a button.
 */
export interface SaveSummary {
  level: number;
  xp: number;
  gold: number;
  achievements: number;
}

/** How a sign-in conflict was resolved. */
export type MergeStrategy =
  /** Take the higher of every number and the union of every set. The default. */
  | 'merge'
  /** This browser's save wins outright and is pushed over the cloud copy. */
  | 'local'
  /** The cloud save wins outright and replaces what is on this device. */
  | 'cloud';

/** Both sides of a conflict, for the dialog to render. */
export interface MergeConflict {
  local: SaveSummary;
  cloud: SaveSummary;
}

/**
 * Read the three headline numbers out of a progress blob and an economy blob.
 *
 * Deliberately total: every field is optional on the way in, because this runs
 * against whatever a second device happens to have written, including a blob
 * from a build that predates a field.
 */
export function summarise(progress: unknown, economy: unknown): SaveSummary {
  const p = isPlainObject(progress) ? progress : {};
  const e = isPlainObject(economy) ? economy : {};
  return {
    level: numberOf(p['level']),
    xp: numberOf(p['xp']),
    gold: numberOf(e['gold']),
    achievements: Array.isArray(p['achievements']) ? p['achievements'].length : 0,
  };
}

/** True when a save has anything in it worth protecting. */
export function hasProgress(summary: SaveSummary): boolean {
  return summary.xp > 0 || summary.achievements > 0 || summary.gold > 0;
}

/**
 * Is this side holding progress the other has never seen?
 *
 * Only monotone counters answer that. XP, rank and achievements can be earned
 * and never spent, so one side holding more of them is real evidence of play
 * the other does not have.
 *
 * Gold is deliberately not in here, and that omission is the whole point.
 * A balance goes *down* — so a device that has not yet spent what it earned
 * reads as "ahead on Gold" against a cloud save that has moved on and spent it.
 * That is not divergence, it is just an older balance, and treating it as
 * evidence made an ordinary two-device visitor fail the test on every sign-in:
 * their phone was permanently "ahead on Gold" while the cloud was ahead on XP.
 * It never settled either, because reconciling takes the higher Gold and hands
 * the stale balance straight back.
 *
 * Gold needs no protecting here regardless: `mergeEconomyLedgers` replays both
 * sides' spend and earn operations by id, so the reconciled balance is correct
 * whatever this returns.
 */
function holdsUnseenProgress(side: SaveSummary, other: SaveSummary): boolean {
  return side.xp > other.xp
    || side.achievements > other.achievements
    || side.level > other.level;
}

/**
 * Is this a conflict worth stopping for?
 *
 * Only when both sides hold progress *and* neither is a superset of the other.
 * A cloud save strictly ahead of this browser on every number has nothing to ask
 * about — merging, loading the cloud and keeping the best all produce the same
 * result, and a dialog offering three buttons that do the same thing is worse
 * than no dialog. The question is only real when each side has something the
 * other does not.
 */
export function isConflict(local: SaveSummary, cloud: SaveSummary): boolean {
  if (!hasProgress(local) || !hasProgress(cloud)) return false;
  return holdsUnseenProgress(local, cloud) && holdsUnseenProgress(cloud, local);
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a synced blob looks like as a document.
 *
 * The payload is nested under `v` rather than spread across the document,
 * because `easter-eggs-found` is a bare JSON array and Firestore documents are
 * maps — a top-level array has nowhere to go. Wrapping every blob the same way
 * costs one key and means the write path has no special case in it.
 */
export interface BlobEnvelope {
  v: unknown;
  updatedAt: string;
}

export function wrapBlob(value: unknown): BlobEnvelope {
  return { v: stripUndefined(value) ?? null, updatedAt: new Date().toISOString() };
}

/**
 * Firestore rejects `undefined` anywhere in a document. localStorage does
 * not — JSON.stringify drops those keys — so a blob that hydrates and
 * flushes locally can still fail the cloud write. Strip at the envelope
 * so every synced key is safe, not only the ledger.
 */
export function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    // Keep positions. Filtering would turn [itemA, undefined, itemC] into
    // [itemA, itemC] and silently shift equipment slots, quest steps, etc.
    // null matches JSON.stringify / localStorage and is legal in Firestore.
    return Array.from(value, entry => {
      const cleaned = stripUndefined(entry);
      return cleaned === undefined ? null : cleaned;
    });
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const cleaned = stripUndefined(entry);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/** The payload out of an envelope, tolerating a document written before it existed. */
export function unwrapBlob(data: unknown): unknown {
  if (isPlainObject(data) && 'v' in data) return data['v'];
  return data ?? null;
}
