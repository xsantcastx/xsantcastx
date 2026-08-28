/**
 * gm-data.service.ts — every read and write the GM console makes about a player.
 *
 * The dashboard half of /admin (AdminDataService) reads counters nobody owns.
 * This is the other half: it reads and edits individual people's saves, which
 * makes it the only place on the site that writes to a document belonging to
 * somebody else. Three rules follow from that and are worth stating up front.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. EVERY MUTATION USES THE SAVE'S OWN MERGE MECHANISM
 * ─────────────────────────────────────────────────────────────────────────────
 * A player's save is not a document you can overwrite. It is a set of CRDT-ish
 * ledgers that every one of their devices reconciles on sign-in, and the
 * reconciliation rules are deliberately generous: `mergeEconomyLedgers` adds
 * back any Gold it cannot explain from the op log, `mergeProgress` keeps the
 * larger XP, `mergeInventoryLedgers` unions records unless a tombstone outranks
 * them. All three exist so that signing in can never cost a player progress —
 * and all three will happily undo an admin edit that was written as a plain
 * overwrite, the next time the player opens the game on a device that still
 * holds the old numbers.
 *
 * So nothing here overwrites. Each action is expressed in the vocabulary the
 * merge already understands:
 *
 *   Grant Gold      → append a `credit-gold` op. Ops are unioned by id, so it
 *                     lands exactly once on every device, forever.
 *   Zero Gold       → append a `spend-gold` op for the current balance. Replays
 *                     deterministically, the same as any purchase.
 *   Clear inventory → write `records: []` plus a tombstone per held item. The
 *                     tombstone outranks the record on every device.
 *   Full reset      → delete the documents AND bump the reset tombstone at
 *                     `users/{uid}/progress/reset`. That stamp is the one
 *                     mechanism in the save that is unconditionally
 *                     authoritative: a device whose stamp is older wipes itself.
 *
 * The one thing that cannot be expressed this way is lowering XP, and the UI
 * says so rather than pretending otherwise — see `resetStats`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. EVERY MUTATION IS LOGGED BEFORE IT IS PERFORMED
 * ─────────────────────────────────────────────────────────────────────────────
 * `log()` runs first and its failure does not abort the action, which is the
 * ordering an audit trail wants: an action that happened without a log entry is
 * a gap, and an action that was logged and then failed is a false positive. The
 * second is far easier to notice and far less dangerous than the first.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. THE CLIENT-SIDE OWNER CHECK IS NOT THE SECURITY BOUNDARY
 * ─────────────────────────────────────────────────────────────────────────────
 * `firestore.rules` is. Everything this service can do, it can do because
 * `isOwner()` in the rules allows it, and someone who edits ADMIN_EMAIL in the
 * bundle gets permission-denied on every call below rather than a working
 * console. Nothing here re-checks identity, because a check the attacker also
 * controls is decoration.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, deleteDoc, doc, getDoc, getDocs,
  limit, orderBy, query, setDoc,
} from '@angular/fire/firestore';

import {
  EconomyLedger, EconomyOp, coerceLedger, maxSeqFor, nextHlc,
} from '../shared/economy/economy-ops';
import { emptyProgress } from '../shared/gamification/gamification.model';
import { dayKey } from '../shared/quests/quest.model';
import { coerceInventoryLedger, stackQuantityOf } from '../shared/rpg/inventory-ops';
import {
  INVENTORY_ERA, INVENTORY_SCHEMA_VERSION, InventoryLedger,
} from '../shared/rpg/inventory.model';
import {
  AUDIT_COLLECTION, AuditEntry, BAN_COLLECTION, BAN_DOC, BanRecord,
  DIRECTORY_COLLECTION, FIELD_LIMITS, NOTICE_DOC, PlayerDirectoryEntry,
  SITE_CONFIG_COLLECTION, SiteNotice,
  coerceAuditEntry, coerceBan, coerceDirectoryEntry, coerceNotice,
} from '../shared/cloud-save/gm.model';

/** Flat, owner-only index of who is banned. See the rule for why it is separate. */
const BAN_INDEX_COLLECTION = 'admin-bans';

/**
 * How long a device lease survives without a heartbeat.
 *
 * Duplicated from save/device-lease.ts rather than imported: that module pulls
 * DeviceLeaseService and its Firestore transaction machinery, and dragging all
 * of it into the /admin chunk to read one number is the wrong trade. If it ever
 * changes there, `purgeExpiredLeases` becomes slightly more or less eager —
 * which is a tuning drift, not a correctness one.
 */
const LEASE_TTL_MS = 120_000;

/** Where the wipe tombstone lives. Mirrored from save-reset.ts. */
const RESET_COLLECTION = 'progress';
const RESET_DOC = 'reset';

/**
 * The device id every op this console writes is attributed to.
 *
 * A real device id is a random per-browser UUID. This one is a constant, and
 * that is deliberate: `${deviceId}:${seq}` is the op's identity, so a fixed
 * device id plus a monotonically increasing seq gives the console a single
 * stable op sequence per account. It also makes an admin grant legible in a
 * ledger dump — an op from `gm-console` is one somebody issued by hand.
 */
const GM_DEVICE_ID = 'gm-console';

/** Everything the console shows on one player's profile. */
export interface PlayerProfile {
  uid: string;
  /** Raw `ProgressState` off `users/{uid}/progress/state`, or null if absent. */
  progress: Record<string, unknown> | null;
  /** The `EconomyLedger` unwrapped from `users/{uid}/economy/state`. */
  ledger: Record<string, unknown> | null;
  /** The `InventoryLedger` unwrapped from `users/{uid}/progress/inventory`. */
  inventory: Record<string, unknown> | null;
  /** The quest blob unwrapped from `users/{uid}/progress/quests`. */
  quests: Record<string, unknown> | null;
  /** Every progress/economy document id that exists, for the raw view. */
  documents: string[];
  ban: BanRecord | null;
}

/** Aggregate figures for the console's overview cards. */
export interface EconomySnapshotView {
  totalGold: number;
  totalXp: number;
  players: number;
  activeToday: number;
  newThisWeek: number;
  /** Top ten by Gold held, richest first. */
  richest: PlayerDirectoryEntry[];
  /** Top ten by most recent activity. */
  mostActive: PlayerDirectoryEntry[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A ledger being edited in place.
 *
 * `EconomyLedger` types `ops` as a plain array already; this alias exists so the
 * mutation callbacks read as "this one is being written to" at the call site,
 * where every other ledger in this file is read-only.
 */
type MutableLedger = EconomyLedger & { ops: EconomyOp[] };

@Injectable()
export class GmDataService {
  private readonly firestore = inject(Firestore);

  /** Set by the component once auth resolves, so audit entries name an author. */
  actorUid = '';
  actorEmail = '';

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Every known player.
   *
   * Deliberately unpaginated at the Firestore level and paginated in the
   * component instead. The directory row is ~200 bytes and the console is
   * opened by one person; a cursor-paged query would add a composite index and
   * a page-token dance to save reads that only become material at a player
   * count this site is nowhere near. When it is, the fix is `limit()` here and
   * `startAfter()` on the sort key — not a rewrite.
   */
  async players(): Promise<PlayerDirectoryEntry[]> {
    const snap = await getDocs(collection(this.firestore, DIRECTORY_COLLECTION));
    const rows: PlayerDirectoryEntry[] = [];
    snap.forEach(d => rows.push(coerceDirectoryEntry(d.id, d.data())));
    return rows.sort((a, b) => b.lastActive - a.lastActive);
  }

  /**
   * The uids currently under a ban.
   *
   * One collection scan over a collection that holds only banned accounts —
   * normally empty, so normally one billed read and often zero. This is the
   * entire reason the flat index exists; see the rule in firestore.rules.
   */
  async bannedUids(): Promise<Map<string, BanRecord>> {
    const out = new Map<string, BanRecord>();
    const snap = await getDocs(collection(this.firestore, BAN_INDEX_COLLECTION));
    snap.forEach(d => {
      const record = coerceBan(d.data());
      if (record?.banned) out.set(d.id, record);
    });
    return out;
  }

  /** Roll the directory up into the numbers the overview and economy tabs show. */
  summarise(rows: PlayerDirectoryEntry[], now: number): EconomySnapshotView {
    const dayAgo = now - DAY_MS;
    const weekAgo = now - 7 * DAY_MS;
    return {
      totalGold: rows.reduce((sum, r) => sum + r.gold, 0),
      totalXp: rows.reduce((sum, r) => sum + r.totalXp, 0),
      players: rows.length,
      activeToday: rows.filter(r => r.lastActive >= dayAgo).length,
      newThisWeek: rows.filter(r => r.createdAt >= weekAgo).length,
      richest: [...rows].sort((a, b) => b.gold - a.gold).slice(0, 10),
      mostActive: [...rows].sort((a, b) => b.lastActive - a.lastActive).slice(0, 10),
    };
  }

  /**
   * Everything about one player, read live.
   *
   * Two `getDocs` — one per save subcollection — rather than eight `getDoc`s,
   * which is the same billed reads and a quarter of the round trips. It is also
   * exactly what the game client does on every sign-in, so if this returns
   * something the profile cannot render, the client would have had the same
   * problem.
   *
   * The directory row is never consulted here. It is a denormalised cache
   * written by the player's own browser, and the moment somebody is looking at
   * a specific account is the moment to stop trusting it.
   */
  async profile(uid: string): Promise<PlayerProfile> {
    const [progressSnap, economySnap, banSnap] = await Promise.all([
      getDocs(collection(this.firestore, 'users', uid, 'progress')),
      getDocs(collection(this.firestore, 'users', uid, 'economy')),
      getDoc(doc(this.firestore, 'users', uid, BAN_COLLECTION, BAN_DOC)),
    ]);

    const progressDocs = new Map<string, Record<string, unknown>>();
    progressSnap.forEach(d => progressDocs.set(d.id, d.data() as Record<string, unknown>));
    const economyDocs = new Map<string, Record<string, unknown>>();
    economySnap.forEach(d => economyDocs.set(d.id, d.data() as Record<string, unknown>));

    return {
      uid,
      // Progression is the one document stored flat rather than enveloped —
      // firestore.rules reads a top-level `xp` off it. Everything else is
      // `{ v, updatedAt }`. See StateEntry.enveloped in game-state.gateway.ts.
      progress: progressDocs.get('state') ?? null,
      ledger: unwrap(economyDocs.get('state')),
      inventory: unwrap(progressDocs.get('inventory')),
      quests: unwrap(progressDocs.get('quests')),
      documents: [
        ...[...progressDocs.keys()].map(k => `progress/${k}`),
        ...[...economyDocs.keys()].map(k => `economy/${k}`),
      ].sort(),
      ban: banSnap.exists() ? coerceBan(banSnap.data()) : null,
    };
  }

  /** The audit trail, newest first. */
  async auditLog(max = 100): Promise<AuditEntry[]> {
    const snap = await getDocs(query(
      collection(this.firestore, AUDIT_COLLECTION),
      orderBy('at', 'desc'),
      limit(max),
    ));
    const rows: AuditEntry[] = [];
    snap.forEach(d => rows.push(coerceAuditEntry(d.id, d.data())));
    return rows;
  }

  async notice(): Promise<SiteNotice | null> {
    const snap = await getDoc(doc(this.firestore, SITE_CONFIG_COLLECTION, NOTICE_DOC));
    return snap.exists() ? coerceNotice(snap.data()) : null;
  }

  // ── The audit trail ──────────────────────────────────────────────────────

  /**
   * Record an action. Called before the action, never after.
   *
   * Its own failure is swallowed on purpose: a console that refuses to ban
   * somebody because the log write failed is a console that stops working at
   * the worst possible moment. The trade is explicit — a lost log line is
   * preferable to a blocked moderation action, and the actions themselves are
   * all visible in the data they change.
   */
  async log(action: string, target: { uid: string; name: string }, detail: string): Promise<void> {
    try {
      const entry: AuditEntry = {
        action,
        targetUid: target.uid || '—',
        targetName: target.name || '—',
        actorUid: this.actorUid,
        actorEmail: this.actorEmail,
        detail: detail.slice(0, FIELD_LIMITS.auditDetail),
        at: Date.now(),
      };
      // An id built from the clock plus a random suffix rather than addDoc():
      // the rule pins the writable keys with hasOnly(), and a document id that
      // sorts by time makes the collection readable in the Firebase console
      // without an index. The suffix is there because two actions in the same
      // millisecond are possible when a batch action loops.
      const id = `${entry.at}-${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(this.firestore, AUDIT_COLLECTION, id), entry);
    } catch (err) {
      console.warn('[GmData] audit write failed; the action still ran:', err);
    }
  }

  // ── Bans ─────────────────────────────────────────────────────────────────

  /**
   * Ban an account.
   *
   * Enforcement copy first, index second. A failure between the two leaves the
   * player banned but missing from the console's status column, which is the
   * safe direction: the sanction holds and the console under-reports it. The
   * reverse ordering would produce a table that claims a ban nothing is
   * enforcing.
   */
  async ban(uid: string, name: string, reason: string): Promise<void> {
    const record: BanRecord = {
      banned: true,
      reason: reason.slice(0, FIELD_LIMITS.banReason),
      bannedAt: Date.now(),
      bannedBy: this.actorUid,
    };
    await this.log('ban', { uid, name }, `reason: ${record.reason || '(none given)'}`);
    await setDoc(doc(this.firestore, 'users', uid, BAN_COLLECTION, BAN_DOC), record);
    await setDoc(doc(this.firestore, BAN_INDEX_COLLECTION, uid), record);
  }

  /**
   * Lift a ban.
   *
   * The enforcement document is set to `banned: false` rather than deleted, so
   * the account keeps a record that it was once actioned — `isBanned()` reads
   * the field, not the document's existence, so a lifted ban and an absent one
   * are identical to the rules and different to a person reading the profile.
   *
   * The index row *is* deleted, because that collection's entire job is "who is
   * banned right now" and a false row in it would be answering a different
   * question.
   */
  async unban(uid: string, name: string): Promise<void> {
    await this.log('unban', { uid, name }, 'ban lifted');
    await setDoc(doc(this.firestore, 'users', uid, BAN_COLLECTION, BAN_DOC), {
      banned: false,
      reason: '',
      bannedAt: Date.now(),
      bannedBy: this.actorUid,
    } satisfies BanRecord);
    await deleteDoc(doc(this.firestore, BAN_INDEX_COLLECTION, uid));
  }

  // ── Economy edits ────────────────────────────────────────────────────────

  /**
   * Add Gold to an account.
   *
   * Appends a `credit-gold` op rather than raising the `gold` field, and this is
   * the difference between a grant that sticks and one that evaporates. Ops are
   * unioned by `${deviceId}:${seq}` and replayed on every device, so the grant
   * lands exactly once everywhere and survives every future merge. Raising the
   * field instead would be seen by `unexplainedGold()` as a balance the log
   * cannot account for — which it does forgive, but only until the next device
   * pushes a ledger that explains its own Gold, at which point the grant is
   * simply gone.
   *
   * Returns the new balance so the caller can show it without a second read.
   */
  async grantGold(uid: string, name: string, amount: number): Promise<number> {
    return this.mutateLedger(uid, name, 'grant-gold', `+${amount} Gold`, ledger => {
      const op = this.buildOp(ledger, 'credit-gold', amount);
      ledger.ops = [...ledger.ops, op];
      // The snapshot fields are moved in step with the op so the console and
      // the player's next page load agree before any replay has happened. The
      // replay produces the same numbers; this just avoids a window where they
      // disagree.
      ledger.gold += amount;
      ledger.runGoldEarned += amount;
      ledger.totalGoldEarned += amount;
      ledger.hlc = op.hlc;
      return ledger.gold;
    });
  }

  /**
   * Take an account's Gold to zero.
   *
   * A `spend-gold` op for the whole balance, for the same reason `grantGold`
   * uses `credit-gold`: it is the vocabulary the merge speaks. Writing `gold: 0`
   * would be undone by any device holding a fatter ledger, because the
   * unexplained-Gold term in `mergeEconomyLedgers` is `max(0, …)` — it can add
   * Gold back but never take it away.
   *
   * The op replays as "subtract this much if you can afford it", so a device
   * that earned more Gold since the console read the ledger keeps the
   * difference. That is the correct behaviour for a spend and the honest limit
   * of this action: it zeroes the balance the console was looking at.
   */
  async zeroGold(uid: string, name: string): Promise<number> {
    return this.mutateLedger(uid, name, 'zero-gold', 'Gold set to 0', ledger => {
      const amount = Math.max(0, Math.floor(ledger.gold));
      if (amount > 0) {
        const op = this.buildOp(ledger, 'spend-gold', amount);
        ledger.ops = [...ledger.ops, op];
        ledger.gold -= amount;
        ledger.hlc = op.hlc;
      }
      return ledger.gold;
    });
  }

  /**
   * Read the ledger, apply a pure mutation, write it back enveloped.
   *
   * Not a Firestore transaction, and that is a considered choice rather than an
   * oversight: the loser of a race here is an admin edit landing on a ledger the
   * player's device has since moved, and the op log is designed to absorb
   * exactly that — the op is unioned in on the next merge regardless of which
   * snapshot it was appended to. A transaction would add a retry loop to
   * protect a field the merge does not read.
   */
  private async mutateLedger(
    uid: string,
    name: string,
    action: string,
    detail: string,
    mutate: (ledger: MutableLedger) => number,
  ): Promise<number> {
    await this.log(action, { uid, name }, detail);
    const ref = doc(this.firestore, 'users', uid, 'economy', 'state');
    const snap = await getDoc(ref);
    const ledger = coerceLedger(unwrap(snap.data() as Record<string, unknown> | undefined));
    if (!ledger) {
      throw new Error('This account has no economy ledger yet — they have not signed in and played.');
    }
    const balance = mutate(ledger as MutableLedger);
    await setDoc(ref, { v: ledger, updatedAt: new Date().toISOString() });
    return balance;
  }

  /** Build the next op in this console's own sequence for an account. */
  private buildOp(ledger: MutableLedger, kind: 'credit-gold' | 'spend-gold', amount: number) {
    const wall = Date.now();
    // The watermark matters as well as the log: once a checkpoint folds this
    // console's ops into `origin`, they leave `ops` but `applied[gm-console]`
    // remembers how far the sequence got. Reusing a seq below that watermark
    // would produce an op every device silently skips as already-applied.
    const seq = Math.max(
      maxSeqFor(GM_DEVICE_ID, ledger.ops),
      ledger.applied?.[GM_DEVICE_ID] ?? 0,
    ) + 1;
    return {
      id: `${GM_DEVICE_ID}:${seq}`,
      deviceId: GM_DEVICE_ID,
      seq,
      kind,
      amount,
      hlc: nextHlc(ledger.hlc, wall),
      wall,
    };
  }

  // ── Resets ───────────────────────────────────────────────────────────────

  /**
   * Reset progression and Gold: XP, level and rank to zero, balance to zero.
   * Inventory, quests and everything else are left alone.
   *
   * ── THE LIMIT, STATED RATHER THAN HIDDEN ────────────────────────────────
   * The Gold half is device-proof: it is a `spend-gold` op and it replays
   * everywhere. The XP half is not, and cannot be made so without changing the
   * save format.
   *
   * `mergeProgress` keeps the *larger* XP of two copies, deliberately, because
   * that rule is what stops a stale phone from deleting a week of progress. It
   * has no way to tell an admin reset apart from a stale phone — both are "a
   * copy with less XP than the other one". So a player who is signed in on a
   * device that still holds the old total will push it back on their next merge.
   *
   * Against an account that has stopped playing this works. Against a live
   * cheater it does not, and Full Reset is the action that does — it goes
   * through the wipe tombstone, which is the one mechanism in the save that
   * every device obeys unconditionally. The console says as much at the point
   * of use; see the confirmation copy in gm-panel.component.html.
   */
  async resetStats(uid: string, name: string): Promise<void> {
    await this.log('reset-stats', { uid, name }, 'XP, level and Gold reset to zero');

    const ref = doc(this.firestore, 'users', uid, 'progress', 'state');
    const snap = await getDoc(ref);
    const previous = (snap.data() ?? {}) as Record<string, unknown>;
    const fresh = emptyProgress();

    await setDoc(ref, {
      ...fresh,
      // The identity and the join date survive a stats reset. `userId` has to
      // be the account's uid or the next attach re-stamps it anyway, and
      // `createdAt` is the day this person first struck the Flame — resetting
      // their numbers is not a claim that they arrived today.
      userId: uid,
      createdAt: typeof previous['createdAt'] === 'string' ? previous['createdAt'] : fresh.createdAt,
      updatedAt: new Date().toISOString(),
    });

    // Best-effort: an account can have progression without ever having built a
    // ledger, and failing the whole reset over the missing half would leave the
    // XP reset applied and the action reported as failed.
    try {
      await this.zeroGold(uid, name);
    } catch { /* no ledger to zero — nothing to do */ }
  }

  /**
   * Clear every item an account owns.
   *
   * Three things have to be written together, and leaving any one out produces a
   * clear that looks like it worked and is undone on the player's next sync:
   *
   *   `records: []`     — necessary, and on its own a no-op. `mergeInventoryLedgers`
   *                       unions records from both sides, so a device holding the
   *                       old bag simply hands it all back.
   *   one tombstone     — per record, at a revision that outranks the record's.
   *     per record        This is what the merge actually obeys: a record whose
   *                       tombstone compares `>=` is dropped on every device.
   *   a `consume` op    — per non-empty material stack. Stack quantities are
   *     per stack         derived by summing the op log, not stored, so
   *                       tombstoning the row without zeroing the log leaves the
   *                       next grant recreating the stack at its old total.
   *
   * And `era` must be stamped. A ledger written without it parses as era 0, and
   * `mergeInventoryLedgers` short-circuits on an era mismatch by discarding the
   * lower side wholesale — so an unstamped admin write does not lose a field, it
   * loses the entire document.
   *
   * Returns how many records were removed, for the confirmation line.
   */
  async resetInventory(uid: string, name: string): Promise<number> {
    await this.log('reset-inventory', { uid, name }, 'all items cleared');

    const ref = doc(this.firestore, 'users', uid, 'progress', 'inventory');
    const snap = await getDoc(ref);
    const ledger = coerceInventoryLedger(unwrap(snap.data() as Record<string, unknown> | undefined));
    if (!ledger || ledger.records.length === 0) return 0;

    const now = Date.now();
    // The hybrid logical clock can legitimately be ahead of the wall clock after
    // a burst of writes, so the next stamp is `max(now, hlc + 1)` rather than
    // `now` — mirroring nextHlc(). A tombstone at a *lower* hlc than the record
    // it is meant to kill does nothing at all.
    const base = Math.max(now, ledger.hlc + 1);

    const tombstones = ledger.records.map((row, i) => ({
      id: row.id,
      revision: {
        hlc: base + i,
        deviceId: GM_DEVICE_ID,
        sequence: row.revision.sequence + 1,
      },
      // Never 0: tombstones are capped at 256 and evicted oldest-first by this
      // field, so a zero stamp would make these the first to be thrown away.
      deletedAt: now,
    }));

    const zeroing = ledger.records.flatMap((row, i) => {
      if (row.kind !== 'stack') return [];
      const held = stackQuantityOf(ledger, row.stackKey);
      if (held <= 0) return [];
      return [{
        // Stable id, so a retry after a half-failed write cannot consume twice.
        id: `gm:clear:${now}:${row.stackKey}`,
        stackKey: row.stackKey,
        kind: 'consume' as const,
        quantity: held,
        hlc: base + i,
        deviceId: GM_DEVICE_ID,
        sequence: 1,
      }];
    });

    const next: InventoryLedger = {
      ...ledger,
      version: INVENTORY_SCHEMA_VERSION,
      records: [],
      tombstones: [...ledger.tombstones, ...tombstones],
      stackOps: [...ledger.stackOps, ...zeroing],
      hlc: base + ledger.records.length,
      era: INVENTORY_ERA,
      legacyBackup: null,
    };

    await setDoc(ref, { v: next, updatedAt: new Date().toISOString() });
    return tombstones.length;
  }

  /**
   * Wipe an account back to a fresh start, on every device it is signed in on.
   *
   * Two steps, and the order is the whole correctness argument:
   *
   *   1. Delete every save document. This is what a new sign-in would find.
   *   2. Bump the wipe tombstone at `users/{uid}/progress/reset`.
   *
   * Step 2 is what makes it stick. `GameStateGateway.attach()` compares that
   * stamp against the device's own `godforge-reset-at`; a cloud stamp that is
   * newer returns the `adopt-remote` verdict, and the device deletes its local
   * copy of every state key and rehydrates the owning services from defaults.
   * Without it, step 1 alone is undone the moment a device with a live local
   * save signs in — it would look to the merge exactly like a fresh browser
   * meeting an empty account, and it would helpfully push everything back up.
   *
   * The tombstone is deleted last, never first: it has to outlive the documents
   * it marks, which is why `resetAll()` in the gateway does not treat it as a
   * state entry.
   */
  async fullReset(uid: string, name: string): Promise<void> {
    await this.log('full-reset', { uid, name }, 'entire save wiped, tombstone bumped');

    const [progressSnap, economySnap] = await Promise.all([
      getDocs(collection(this.firestore, 'users', uid, 'progress')),
      getDocs(collection(this.firestore, 'users', uid, 'economy')),
    ]);

    const deletions: Promise<void>[] = [];
    progressSnap.forEach(d => {
      // Never delete the tombstone in the same sweep that creates it.
      if (d.id === RESET_DOC) return;
      deletions.push(deleteDoc(doc(this.firestore, 'users', uid, 'progress', d.id)));
    });
    economySnap.forEach(d => {
      deletions.push(deleteDoc(doc(this.firestore, 'users', uid, 'economy', d.id)));
    });
    await Promise.all(deletions);

    await setDoc(doc(this.firestore, 'users', uid, RESET_COLLECTION, RESET_DOC), {
      at: Date.now(),
      deviceId: GM_DEVICE_ID,
    });

    // The directory row is the console's own index, not part of the save. It is
    // dropped so a wiped account stops claiming last week's Gold in the table;
    // the player's next sign-in writes a fresh row.
    try {
      await deleteDoc(doc(this.firestore, DIRECTORY_COLLECTION, uid));
    } catch { /* the row may already be gone */ }
  }

  // ── Bulk server actions ──────────────────────────────────────────────────

  /**
   * Clear today's daily-quest claim receipts for every known player.
   *
   * The quest board is not stored — it is recomputed deterministically from a
   * day key, and what is persisted is a bag of counters plus receipts of the
   * form `questId@2026-08-12`. So "reset the dailies" is precisely "drop the
   * receipts whose period is today", which lets everyone claim again without
   * touching their counters, their log, or their weeklies and epics.
   *
   * This is O(players) reads and writes and the UI says so before running it.
   * There is no server-side batch to do it in — a Cloud Function would be the
   * right home if this ever stops being an emergency lever. Failures on one
   * player are swallowed so that a single unreadable save cannot strand the
   * sweep halfway with no way to tell how far it got.
   */
  async resetDailyQuests(players: readonly PlayerDirectoryEntry[]): Promise<number> {
    await this.log(
      'reset-daily-quests',
      { uid: '—', name: 'all players' },
      `swept ${players.length} accounts`,
    );

    // The receipt suffix is the local day of whoever wrote it. The console uses
    // its own local day, which is the same choice the client makes — a player in
    // another timezone whose day has already turned keeps a receipt this sweep
    // does not match, and gets their reset when their own day rolls over.
    const today = dayKey();
    let touched = 0;

    for (const player of players) {
      try {
        const ref = doc(this.firestore, 'users', player.uid, 'progress', 'quests');
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const state = unwrap(snap.data() as Record<string, unknown>);
        const claimed = state?.['claimed'];
        if (!Array.isArray(claimed)) continue;
        const kept = claimed.filter(r => typeof r === 'string' && !r.endsWith(`@${today}`));
        if (kept.length === claimed.length) continue;
        await setDoc(ref, {
          v: { ...state, claimed: kept },
          updatedAt: new Date().toISOString(),
        });
        touched++;
      } catch {
        // One unreadable save must not end the sweep.
      }
    }
    return touched;
  }

  /**
   * Delete every device-write lease whose heartbeat has stopped.
   *
   * A lease is how two devices on one account decide which of them may write.
   * It is refreshed on a heartbeat and released on tab close, but a hard kill
   * leaves one behind — and the other device then sits read-only until the TTL
   * expires on its own. This is the lever for not waiting.
   *
   * The TTL is duplicated from device-lease.ts rather than imported, because
   * importing that module would pull `DeviceLeaseService` and its Firestore
   * transaction machinery into the /admin chunk to read one number.
   */
  async purgeExpiredLeases(players: readonly PlayerDirectoryEntry[]): Promise<number> {
    await this.log(
      'purge-leases',
      { uid: '—', name: 'all players' },
      `checked ${players.length} accounts`,
    );

    const cutoff = Date.now() - LEASE_TTL_MS;
    let purged = 0;

    for (const player of players) {
      try {
        const ref = doc(this.firestore, 'users', player.uid, BAN_COLLECTION, 'device-lease');
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const beat = snap.data()?.['heartbeatAt'];
        // A lease with no readable heartbeat is stale by definition — nothing is
        // refreshing it, so leaving it would be leaving a lock nobody holds.
        if (typeof beat === 'number' && beat >= cutoff) continue;
        await deleteDoc(ref);
        purged++;
      } catch {
        // As above: one failure must not end the sweep.
      }
    }
    return purged;
  }

  // ── Site notice ──────────────────────────────────────────────────────────

  async setNotice(next: Omit<SiteNotice, 'updatedAt'>): Promise<void> {
    const payload: SiteNotice = { ...next, updatedAt: Date.now() };
    await this.log(
      'site-notice',
      { uid: '—', name: 'all players' },
      payload.maintenance
        ? `maintenance on: ${payload.maintenanceNote || '(default text)'}`
        : payload.message
          ? `broadcast: ${payload.message}`
          : 'notice cleared',
    );
    await setDoc(doc(this.firestore, SITE_CONFIG_COLLECTION, NOTICE_DOC), payload);
  }
}

/**
 * Unwrap an enveloped blob.
 *
 * Every synced document except progression is stored as `{ v, updatedAt }` —
 * see the note on `StateEntry.enveloped`. Returns null rather than the envelope
 * when `v` is missing, so a caller never renders `{ v: … }` by accident.
 */
function unwrap(raw: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const inner = raw['v'];
  if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return null;
}
