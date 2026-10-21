/**
 * game-state.gateway.ts — the one place the Godforge save is read and written.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHAT "SOURCE OF TRUTH" MEANS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * Nineteen services used to own their own `localStorage.getItem` and
 * `localStorage.setItem`, and cloud save copied those blobs up and down around
 * them. That worked, and it put the authority in the wrong place: the browser
 * was the record and the cloud was a backup of it, so every new surface that
 * wants to read a visitor's state — a leaderboard, a Grand Exchange, a guild
 * roster — would have had to ask nineteen services for their private copies.
 *
 * Now every read and every write goes through here, and when a visitor is signed
 * in Firestore is the record. Signed out, or with Firestore unreachable, this
 * degrades to exactly the localStorage-only behaviour the site has always had,
 * which is what keeps 126 tool pages working for the anonymous majority who will
 * never sign in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LOCALSTORAGE IS STILL THE THING SERVICES READ
 * ─────────────────────────────────────────────────────────────────────────────
 * `read()` is synchronous and answers from localStorage, and that is deliberate
 * rather than a shortcut. Every one of these services hydrates on first
 * injection — the header's XP bar, the currency rail and the Forge Flame all read
 * during first paint — and Firestore cannot answer synchronously: it is a network
 * round trip behind a ~450 kB SDK chunk that is deliberately kept out of the
 * initial bundle. An `await` on that path would put a network hop in front of the
 * first frame of every page, signed in or not.
 *
 * So this is a read-through cache, and the authority is asserted at a different
 * moment: {@link attach} pulls the cloud copy on sign-in and on every load,
 * reconciles it, writes the result into the cache, and pushes it into the live
 * services through `LocalSaveRegistry`. After that the cache *is* the
 * authoritative state, byte for byte, and reading it is reading the cloud.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY WRITES REACH THE CACHE FIRST AND THE CLOUD SECOND
 * ─────────────────────────────────────────────────────────────────────────────
 * The brief asked for writes to reach Firestore first and mirror to localStorage
 * after. This does the reverse, on purpose, and the brief's own next requirement
 * is the reason: cloud writes are debounced and batched, and a debounced write
 * cannot also be the first one. Beyond the contradiction, awaiting the network
 * before recording a purchase locally would mean a tab closed mid-round-trip
 * loses the purchase, and it would make `buyUpgrade()` and every one of its
 * callers async for no gain.
 *
 * The local write is therefore synchronous and unconditional — it is what makes
 * the game crash-safe and playable on a train — and the cloud write follows
 * within seconds. Authority is not about which store is written first; it is
 * about which store wins when they disagree, and that is settled in
 * {@link attach}.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A FLUSH STILL READS BEFORE IT WRITES
 * ─────────────────────────────────────────────────────────────────────────────
 * A batch that wrote this device's state blind would be last-writer-wins across
 * a visitor's devices, which is the bug the previous two releases were spent on.
 * So a flush reads the documents it is about to write, merges under the same
 * monotone rules `attach` uses, and writes the result. Only the dirty keys are
 * read — usually one or two — so the steady state costs a couple of reads and a
 * single batched write, rather than the nineteen reads and nineteen writes the
 * old per-blob push loop cost.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirestoreHandle } from '../lazy-firestore.service';
import {
  PROGRESS_KEY,
  ProgressState,
  mergeProgress,
  migrateProgress,
  withLevel,
} from '../gamification/gamification.model';
// The state registry and the merge rules live in cloud-save.model.ts and are
// imported rather than moved. It is a leaf: pure data and pure functions, no
// Angular and no services, so depending on it costs this file nothing — and the
// merge rules are the most carefully-reasoned code in the feature, with a spec
// that pins every key. Moving them to prettify the folder layout would have put
// review surface on the one part nobody should be casually re-typing.
import {
  MergeConflict,
  MergeStrategy,
  SYNCED_BLOBS,
  SyncedBlob,
  isConflict,
  mergeDeep,
  summarise,
  unwrapBlob,
  wrapBlob,
  stripUndefined,
} from '../cloud-save/cloud-save.model';
import {
  DEVICE_ID_KEY,
  acknowledgeAndMaybeCompact,
  coerceMigrated,
} from '../economy/economy-ops';
import { LocalSaveRegistry } from './local-save-registry.service';
import { DeviceLeaseService } from './device-lease.service';
import {
  RESET_COLLECTION,
  RESET_DOC,
  RESET_STAMP_KEY,
  coerceResetStamp,
  resetVerdict,
} from './save-reset';
import {
  ACTIVE_CHARACTER_KEY,
  CHARACTER_ROSTER_KEY,
  CLOUD_PENDING_KEY,
  LOCAL_CHARACTER_KEYS,
  PRIMARY_CHARACTER,
  characterDbName,
  characterDocPath,
  characterStorageKey,
  isCharacterId,
  isCharacterScoped,
  readActiveCharacter,
} from './character-scope';

/**
 * The ledger's key, for the two-number summary the merge dialog shows.
 *
 * Spelled out rather than imported from `EconomyService`: that service injects
 * this gateway, so importing it back would be a cycle — and the constant is
 * pinned by the model spec, which fails if the registry ever stops carrying it.
 */
export const ECONOMY_STATE_KEY = 'godforge-economy';

/**
 * One unit of saved state: a localStorage key and the document it belongs in.
 *
 * `enveloped` is the one field that is not simply inherited from `SyncedBlob`,
 * and it exists for a rule rather than for a shape. Every other blob is stored
 * as `{ v, updatedAt }` because `easter-eggs-found` is a bare JSON array and a
 * Firestore document has to be a map. Progression is stored flat, because
 * `firestore.rules` enforces `request.resource.data.xp >= resource.data.xp` on
 * `users/{uid}/progress/state` and that condition reads a *top-level* `xp`.
 * Wrapping it would move the field to `v.xp`, the `!('xp' in ...)` escape in the
 * rule would quietly pass every write, and the guard against a stale device
 * deleting somebody's XP would be gone without a single error to show for it.
 */
export interface StateEntry {
  key: string;
  collection: 'progress' | 'economy';
  doc: string;
  label: string;
  merge?: (remote: unknown, local: unknown) => unknown;
  enveloped: boolean;
  /**
   * Stamp the signed-in account onto a resolved payload.
   *
   * Only progression carries an identity, and it has to be the uid this device
   * is attached to rather than whichever of the two copies happened to win the
   * merge — adopting the signed-in identity is most of what attaching means.
   */
  identify?: (value: unknown, uid: string) => unknown;
  /**
   * Fields to ignore when asking "did this actually change?".
   *
   * Progression's `updatedAt` is stamped fresh by every merge, so comparing the
   * serialised forms would report a change on *every* pull — including the
   * overwhelming majority where the two copies already agree. That was
   * previously worth one gratuitous page reload per signed-in session; here it
   * would be a Firestore write and a needless rehydrate on every page load of
   * every signed-in visitor, which is a bill rather than an annoyance.
   *
   * Only the comparison ignores these. The payload that gets written keeps them.
   */
  volatile?: readonly string[];
}

/**
 * Every key the gateway owns: the eighteen satellite blobs plus progression.
 *
 * Progression is appended here rather than added to `SYNCED_BLOBS` so that the
 * model spec's pinned key list keeps meaning what it says — it asserts what the
 * *satellite* registry holds, and a nineteenth entry appearing in it would read
 * as a blob that had been forgotten and then added rather than as the one that
 * always had its own path.
 */
/**
 * This device's save as it stood just before the last sign-in merge.
 *
 * Never synced: it is a local before picture, not part of the account.
 */
export const SAVE_BACKUP_KEY = 'godforge-save-backup';

/**
 * localStorage key holding deletions that have not reached the cloud yet.
 * See `remove()` for why this is on disk rather than in memory.
 */
const PENDING_DELETE_KEY = 'godforge-pending-deletes';

/**
 * Device-local, account-wide: the uid this browser last swept EVERY character it holds for (see
 * {@link GameStateGateway.pushOtherCharacters}). Saves older than the per-character pending mark are pushed once.
 */
export const SEED_SWEEP_KEY = 'godforge-seed-sweep';

export const STATE_ENTRIES: readonly StateEntry[] = [
  ...SYNCED_BLOBS.map((b: SyncedBlob): StateEntry => ({
    key: b.key,
    collection: b.collection,
    doc: b.doc,
    label: b.label,
    merge: b.merge,
    enveloped: true,
  })),
  {
    key: PROGRESS_KEY,
    collection: 'progress',
    doc: 'state',
    label: 'progression',
    // Progression keeps its own hand-written merge rather than falling through to
    // the structural one, and the reason is a field the structural rule gets
    // quietly and permanently wrong. `mergeDeep` takes the greater of two
    // strings, which is right for the ISO instants and period keys everywhere
    // else in the save — but `createdAt` is the visitor's "first struck" date,
    // where the *earlier* value is the true one. Left to the structural rule,
    // every reconciliation would walk that date forward, and the Forge would
    // slowly forget how long somebody had been here. `mergeProgress` also
    // recomputes the denormalised rank from the merged XP, which no generic rule
    // can know to do.
    merge: (remote, local) => mergeProgress(migrateProgress(remote), migrateProgress(local)),
    identify: (value, uid) =>
      isRecord(value) ? { ...value, userId: uid } : value,
    volatile: ['updatedAt'],
    enveloped: false,
  },
];

const BY_KEY = new Map<string, StateEntry>(STATE_ENTRIES.map(e => [e.key, e]));
/** Every synced key, for the character-scope test (character-scope.ts). */
const STATE_KEYS: ReadonlySet<string> = new Set(STATE_ENTRIES.map(e => e.key));

/** Keys the gateway owns. Anything else is not saved state and is refused. */
export function isStateKey(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * How long a write waits for company before it goes up.
 *
 * Four seconds. The Forge Flame can be struck twice a second and idle Gold
 * settles once a second, so an unbatched write-per-change would be a document
 * write per second for the life of the tab — the thing the brief specifically
 * asked not to do. Four seconds collapses a burst of clicking into one batch
 * while still being short enough that closing the tab rarely beats it, and
 * `pagehide` covers the case where it does.
 */
const FLUSH_DEBOUNCE_MS = 4_000;

/**
 * The longest a change may sit unsent while the visitor keeps playing.
 *
 * A pure trailing debounce never fires during sustained activity, and sustained
 * activity is exactly when somebody is earning the progress they would be
 * upset to lose. Twenty seconds is the ceiling: a player clicking continuously
 * still syncs three times a minute.
 */
const FLUSH_MAX_WAIT_MS = 20_000;

/** Backoff for a flush that failed. Doubles to the cap, resets on success. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

/**
 * Floor on the gap between two full pulls inside one page load.
 *
 * A pull reads every document under the account, and returning to a tab is what
 * triggers one. A visitor alt-tabbing between a browser and an editor generates
 * that event far more often than their progress on another device actually
 * changes, so without a floor one restless afternoon would cost more reads than
 * the rest of the site spends in a day.
 *
 * A minute is the balance: long enough that flicking between windows costs
 * nothing after the first look, short enough that the case this exists for —
 * putting a phone down and turning to a desktop — is always outside the window.
 * Signing in does not wait on it at all; that path attaches, which pulls on the
 * spot.
 */
const REPULL_INTERVAL_MS = 60_000;

/** Floor between two retries of the values a full disk refused (see `spilled`). */
const SPILL_RETRY_MS = 5_000;

/** Where the save currently lives, for the sync chip and the HUD. */
export type CloudLink =
  /** Signed out. localStorage is the whole story, which is a fine way to live. */
  | 'local'
  /** Attached and pulling, or flushing. */
  | 'syncing'
  /** Attached, and everything on this device is up. */
  | 'synced'
  /** Attached but unreachable. Playing offline; the queue is holding. */
  | 'offline'
  /** Signed in and current, but another device holds the write lease. */
  | 'waiting';

export interface AttachResult {
  /** Keys whose local copy the cloud moved. Already pushed into their owners. */
  adopted: string[];
  /** True when the account had no save up there and this device seeded it. */
  seeded: boolean;
}

@Injectable({ providedIn: 'root' })
export class GameStateGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly owners = inject(LocalSaveRegistry);
  private readonly leases = inject(DeviceLeaseService);
  private readonly zone = inject(NgZone);

  // ── Characters (character-scope.ts) ─────────────────────────────────────────
  /**
   * The character this page plays, fixed at boot. Choosing another reloads the page (see character-scope.ts for why
   * it never changes mid-page). Character #1 maps every key and path to exactly what the single save used.
   */
  readonly character: string = this.isBrowser ? readActiveCharacter(safeStorage()) : PRIMARY_CHARACTER;
  /** Set by {@link retireCharacter}: this page's character is being deleted, so its writes go nowhere. */
  private retired = false;

  /** The localStorage key holding logical `key` for this page's character. */
  private sk(key: string): string {
    return isCharacterScoped(key, STATE_KEYS) ? characterStorageKey(key, this.character) : key;
  }
  /** Firestore path segments (after `users/{uid}`) of an entry's document for this page's character. */
  private docPath(entry: Pick<StateEntry, 'key' | 'collection' | 'doc'>): string[] {
    return isCharacterScoped(entry.key, STATE_KEYS)
      ? characterDocPath(this.character, entry.collection, entry.doc)
      : [entry.collection, entry.doc];
  }
  private ref(fs: FirestoreHandle, uid: string, entry: Pick<StateEntry, 'key' | 'collection' | 'doc'>) {
    return fs.api.doc(fs.db, 'users', uid, ...this.docPath(entry));
  }
  /** This character's wipe stamp document (a reset is per character; #1 keeps `progress/reset`). */
  private resetRef(fs: FirestoreHandle, uid: string) {
    return fs.api.doc(fs.db, 'users', uid, ...characterDocPath(this.character, RESET_COLLECTION, RESET_DOC));
  }

  /** An IndexedDB name for this page's character (the world's far regions). */
  scopedDbName(name: string): string {
    return characterDbName(name, this.character);
  }

  /**
   * Another character's blob on this device, parsed — for the character list (level, look, last place). Read-only:
   * nothing is ever written into a character the page is not playing.
   */
  readFor(character: string, key: string): unknown {
    if (!this.isBrowser || !isCharacterId(character)) return null;
    if (character === this.character) return this.read(key);
    try {
      const storageKey = isCharacterScoped(key, STATE_KEYS) ? characterStorageKey(key, character) : key;
      const raw = localStorage.getItem(storageKey);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Does this device hold any of `character`'s save? */
  hasLocalSave(character: string): boolean {
    if (!this.isBrowser || !isCharacterId(character)) return false;
    try {
      for (const entry of STATE_ENTRIES) {
        if (!isCharacterScoped(entry.key, STATE_KEYS)) continue;
        if (localStorage.getItem(characterStorageKey(entry.key, character)) !== null) return true;
      }
    } catch { /* private mode */ }
    return false;
  }

  /**
   * Choose the character the NEXT page load plays. Settle this one first ({@link settleForReload}), then reload: the
   * reload's pagehide flush still writes this page's memory into this page's character, which is correct.
   */
  selectCharacter(character: string): void {
    if (!this.isBrowser || !isCharacterId(character)) return;
    try { localStorage.setItem(ACTIVE_CHARACTER_KEY, character); } catch { /* private mode: stays on this one */ }
  }

  /**
   * This page's character is being deleted: from now on its writes (including the reload's pagehide flush) go
   * nowhere, and nothing more is sent to the cloud. Call before {@link deleteCharacterSave} on the active character.
   */
  retireCharacter(): void {
    this.retired = true;
    this.cancelFlush();
    this.dirty.clear();
  }

  /**
   * Delete one character's save from this device and, when attached, from the cloud. Account-wide keys are untouched.
   * Deleting the character this page plays requires {@link retireCharacter} first, or its services write it back.
   */
  async deleteCharacterSave(character: string): Promise<void> {
    if (!this.isBrowser || !isCharacterId(character)) return;
    if (character === this.character && !this.retired) this.retireCharacter();
    const keys = [...STATE_ENTRIES.map(e => e.key), ...LOCAL_CHARACTER_KEYS].filter(k => isCharacterScoped(k, STATE_KEYS));
    try {
      for (const key of keys) localStorage.removeItem(characterStorageKey(key, character));
    } catch { /* private mode */ }
    // The world's far regions live in IndexedDB (delve-save.service). A delete on an open database waits for the
    // page holding it to go, which is the reload that follows deleting the active character.
    try {
      for (const db of ['eclipse-world', 'eclipse-delve']) globalThis.indexedDB?.deleteDatabase(characterDbName(db, character));
    } catch { /* no IndexedDB */ }
    const uid = this.uid, fs = this.fs;
    if (!uid || !fs) return;
    await this.zone.runOutsideAngular(async () => {
      for (const entry of STATE_ENTRIES) {
        if (!isCharacterScoped(entry.key, STATE_KEYS)) continue;
        try {
          await fs.api.deleteDoc(fs.api.doc(fs.db, 'users', uid, ...characterDocPath(character, entry.collection, entry.doc)));
        } catch { /* offline: the roster's tombstone already hides it; the documents are orphans */ }
      }
    });
  }

  /** Set while attached to an account. Null when signed out. */
  private uid: string | null = null;
  private fs: FirestoreHandle | null = null;

  /** Keys written locally since the last successful flush. */
  private readonly dirty = new Set<string>();
  /**
   * What the cloud held for each key at the last read, serialised.
   *
   * Only used to skip a write that would change nothing. Deliberately not used
   * to skip the *read* before a write — that read is what makes concurrent
   * devices safe, and an optimisation that removed it would reintroduce
   * last-writer-wins.
   */
  private readonly lastRemote = new Map<string, string>();

  /** Epoch ms of the last full pull, so returning to a tab is throttled. */
  private lastPullAt = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the oldest currently-dirty write happened, for the max-wait cap. */
  private oldestDirtyAt = 0;
  private flushing: Promise<void> | null = null;
  private retryMs = RETRY_BASE_MS;
  /**
   * Set when the visitor overrules the structural merge. Retry, pagehide and
   * online must not silently turn Keep This Device into Merge Best.
   * Cleared once a flush lands with an empty queue, or on detach.
   */
  private overrideStrategy: MergeStrategy | null = null;
  /**
   * True from the start of attach until the merge choice is known (or attach
   * fails). `markDirty` still queues; `scheduleFlush` does not fire. That is
   * what stops a four-second upload swallowing Keep This Device, without
   * leaving the gateway unattached if the first pull is offline.
   */
  private decisionPending = false;

  private readonly link$$ = new BehaviorSubject<CloudLink>('local');
  readonly link$: Observable<CloudLink> = this.link$$.asObservable();
  get link(): CloudLink { return this.link$$.value; }

  /** True once this gateway is the cloud's local face rather than just a cache. */
  get attached(): boolean { return this.uid !== null; }

  /** How many writes are waiting to go up. Rendered by the sync chip. */
  get pending(): number { return this.dirty.size; }

  /**
   * Bumped every time local blobs are about to be read to leave this device (a
   * push, or a sign-in pull's merge). An owner that edits an op in place
   * (EconomyService's credit coalescing) may do so only while this has not
   * moved since the op was written: after it moves, a copy may be in the cloud.
   */
  get sendCount(): number { return this.sends; }
  private sends = 0;

  /**
   * Values whose localStorage write failed — the disk is full (or private
   * mode) — held here so the game keeps them. `readRaw` answers from this
   * first, the cloud queue sends them, and `retrySpilled` puts them on disk as
   * soon as there is room. Before this, a full disk made every write a silent
   * no-op, the inventory's read-back check failed, and every pickup was
   * refused ("That pickup could not be saved").
   */
  private readonly spilled = new Map<string, string>();
  private lastSpillRetryAt = 0;
  private readonly spilled$$ = new BehaviorSubject<number>(0);
  /** How many keys are held in memory only, because the disk is full. 0 = all saved on this device. */
  readonly spilled$: Observable<number> = this.spilled$$.asObservable();

  /**
   * Put `raw` on disk; on a full disk, reclaim and retry once, and failing
   * that hold it in memory. Returns true when it is on disk.
   */
  private persist(key: string, raw: string): boolean {
    if (this.trySet(key, raw)) {
      this.unspill(key);
      if (this.spilled.size > 0) this.retrySpilled();
      return true;
    }
    this.reclaim();
    if (this.trySet(key, raw)) {
      this.unspill(key);
      return true;
    }
    this.spilled.set(key, raw);
    this.spilled$$.next(this.spilled.size);
    return false;
  }

  private trySet(key: string, raw: string): boolean {
    // A character being deleted keeps nothing (see retireCharacter): report "on disk" so nothing is held either.
    if (this.retired && isCharacterScoped(key, STATE_KEYS)) return true;
    try {
      localStorage.setItem(this.sk(key), raw);
      return true;
    } catch {
      return false;
    }
  }

  private unspill(key: string): void {
    if (this.spilled.delete(key)) this.spilled$$.next(this.spilled.size);
  }

  /**
   * Free what is safe to free: the merge backup (a courtesy, see
   * snapshotBeforeMerge) and the Firestore read cache (`fs-cache:*`, refetched
   * on demand). Never progress: everything else may be the only copy.
   */
  private reclaim(): void {
    try {
      localStorage.removeItem(this.sk(SAVE_BACKUP_KEY));
      const caches: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('fs-cache:')) caches.push(key);
      }
      for (const key of caches) localStorage.removeItem(key);
    } catch { /* private mode */ }
  }

  /** Try the held values again (at most every few seconds: they can be large). */
  retrySpilled(force = false): void {
    if (this.spilled.size === 0) return;
    const now = Date.now();
    if (!force && now - this.lastSpillRetryAt < SPILL_RETRY_MS) return;
    this.lastSpillRetryAt = now;
    for (const [key, raw] of [...this.spilled]) {
      if (this.trySet(key, raw)) this.spilled.delete(key);
    }
    this.spilled$$.next(this.spilled.size);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The synchronous surface every service uses
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The parsed state for `key`, or null when there is none.
   *
   * Null and unparseable are deliberately the same answer. Every caller already
   * treats "nothing stored" as "start from the empty blob", and a blob that will
   * not parse is one the owning service is about to replace anyway — so throwing
   * here would only move a corrupt-storage failure into a template binding.
   */
  read(key: string): unknown {
    const raw = this.readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  readRaw(key: string): string | null {
    if (!this.isBrowser) return null;
    // A value whose disk write failed is still the state: the game keeps it in
    // memory (see writeRaw) and every read must see it, or a grant that
    // verifies itself by reading back would roll itself back.
    const held = this.spilled.get(key);
    if (held !== undefined) return held;
    try {
      return localStorage.getItem(this.sk(key));
    } catch {
      // Safari private mode throws on read. The game runs from memory.
      return null;
    }
  }

  /**
   * Record `value` as the state for `key`.
   *
   * Synchronous into the cache, queued for the cloud. Returns immediately, so
   * every existing caller — `buyUpgrade`, `award`, `strike` — stays synchronous.
   */
  write(key: string, value: unknown): void {
    if (!this.isBrowser) return;
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      // A cyclic or unserialisable blob is a bug in the caller, and dropping it
      // here is better than writing "undefined" over a good save.
      return;
    }
    this.writeRaw(key, raw);
  }

  /** As {@link write}, for a caller that already has the serialised form. */
  writeRaw(key: string, raw: string): void {
    if (!this.isBrowser) return;
    // Quota or private mode: the value is held in memory instead (reads see
    // it, the cloud queue below sends it), so play is never refused because
    // the disk is full. See persist() for what is tried before that.
    this.persist(key, raw);
    // Writing a key the visitor deleted is them starting it again. The queued
    // deletion has to go, or the next attach would delete what was just written.
    this.clearPendingDelete(key);
    this.markDirty(key);
    this.notePending(key);
  }

  /** Set once this page has marked its character as holding writes the cloud may not have (see CLOUD_PENDING_KEY). */
  private pendingNoted = false;

  /**
   * Mark this page's character "the cloud may not have this" on its first saved write (one localStorage write per
   * page, not per write). Cleared only once a push lands with nothing left queued, so a character written signed
   * out, behind another device's lease, or by a page that reloaded before its flush keeps the mark — and any later
   * signed-in page, whichever character it plays, pushes it ({@link pushOtherCharacters}).
   */
  private notePending(key: string): void {
    if (this.pendingNoted || this.retired || !BY_KEY.has(key) || !isCharacterScoped(key, STATE_KEYS)) return;
    this.pendingNoted = true;
    try { localStorage.setItem(this.sk(CLOUD_PENDING_KEY), '1'); } catch { /* private mode: the attach diff still pushes */ }
  }

  /** Everything this page wrote is in the cloud: lift the mark. */
  private clearPendingMark(): void {
    if (!this.attached || this.dirty.size > 0 || this.retired) return;
    this.pendingNoted = false;
    try { localStorage.removeItem(this.sk(CLOUD_PENDING_KEY)); } catch { /* private mode */ }
  }

  /**
   * Drop the state for `key` — a reset, not a sync.
   *
   * The cloud copy goes too, and immediately rather than on the debounce: a
   * visitor wiping their save and closing the tab must not find it restored from
   * the cloud on the next load, which is exactly what a queued delete would do.
   */
  remove(key: string): void {
    if (!this.isBrowser) return;
    this.unspill(key);
    try {
      localStorage.removeItem(this.sk(key));
    } catch { /* private mode */ }

    this.dirty.delete(key);
    this.lastRemote.delete(key);

    const entry = BY_KEY.get(key);
    if (!entry) return;

    // Recorded *before* the network is touched, and persisted, because the two
    // ways the cloud half fails are both silent and both leave this device in
    // the state `attach` reads as "fresh browser, adopt the cloud":
    //
    //   - not attached yet. The Firestore SDK is lazy (~450 kB kept out of the
    //     initial bundle), so on a cold mobile load `fs` is null for the first
    //     few seconds and the old code simply returned here.
    //   - offline. The `deleteDoc` rejects and the document lives on.
    //
    // Either way the wipe was real and the cloud has not heard about it, so the
    // intent is written down and `drainPendingDeletes` finishes it on the next
    // attach. Without this the deleted blob comes back on the next pull, which
    // is the bug this whole change exists to close.
    this.markPendingDelete(key);

    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return;

    this.zone.runOutsideAngular(() => {
      void fs.api
        .deleteDoc(this.ref(fs, uid, entry))
        .then(() => this.clearPendingDelete(key))
        .catch(() => {
          // The record stands and the next attach retries it.
          this.setLink('offline');
        });
    });
  }

  /**
   * Drop this device's copy of `key` and nothing else: no cloud delete, now or queued.
   *
   * For housekeeping that is about what *this browser* holds (the realm-era wipe), as opposed to a player resetting
   * their save. Routing that through {@link remove} queued a cloud delete on every browser that had never stamped the
   * era — a new phone, or a character opened here for the first time — and the first sign-in then drained it,
   * deleting the account's real activity ledger (all Hunting XP, i.e. the Keeper's level) before the merge ran. A
   * prior-era cloud copy needs no delete: the owners drop prior-era ledgers on load.
   */
  discardLocal(key: string): void {
    if (!this.isBrowser) return;
    this.unspill(key);
    try {
      localStorage.removeItem(this.sk(key));
    } catch { /* private mode */ }
    this.dirty.delete(key);
  }

  /** Forget a queued cloud delete of `key` (one a build no longer means to send). */
  cancelPendingDelete(key: string): void {
    if (!this.isBrowser) return;
    this.clearPendingDelete(key);
  }

  /**
   * Keys whose local copy has been deleted but whose cloud copy may not have.
   *
   * Persisted rather than held in memory: the case this is built for is a
   * visitor wiping a blob and closing the tab, which is exactly when an
   * in-memory set would be lost and the deletion forgotten.
   */
  private pendingDeletes(): Set<string> {
    const raw = this.readRaw(PENDING_DELETE_KEY);
    if (raw === null) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(
        Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [],
      );
    } catch {
      return new Set();
    }
  }

  private writePendingDeletes(keys: Set<string>): void {
    try {
      if (keys.size === 0) localStorage.removeItem(this.sk(PENDING_DELETE_KEY));
      else localStorage.setItem(this.sk(PENDING_DELETE_KEY), JSON.stringify([...keys]));
    } catch { /* private mode */ }
  }

  private markPendingDelete(key: string): void {
    const keys = this.pendingDeletes();
    if (keys.has(key)) return;
    keys.add(key);
    this.writePendingDeletes(keys);
  }

  private clearPendingDelete(key: string): void {
    const keys = this.pendingDeletes();
    if (!keys.delete(key)) return;
    this.writePendingDeletes(keys);
  }

  /**
   * Re-issue any deletion whose cloud half never landed, before the merge runs.
   *
   * The entry is dropped from `remote` as well as deleted, so this attach
   * reconciles against the absence the visitor asked for rather than against
   * the document that is on its way out. A key the visitor has since written
   * again is no longer pending — `writeRaw` clears it — so this cannot delete
   * live state.
   */
  private async drainPendingDeletes(
    uid: string,
    fs: FirestoreHandle,
    remote: Map<string, unknown>,
  ): Promise<void> {
    const keys = this.pendingDeletes();
    if (keys.size === 0) return;

    for (const key of keys) {
      const entry = BY_KEY.get(key);
      if (!entry) {
        this.clearPendingDelete(key);
        continue;
      }
      remote.delete(key);
      this.lastRemote.delete(key);
      try {
        await fs.api.deleteDoc(this.ref(fs, uid, entry));
        this.clearPendingDelete(key);
      } catch {
        // Still unreachable. The record stands for the next attach.
      }
    }
  }

  /**
   * Wipe every blob in the save, here and in the cloud, as one operation.
   *
   * This replaces nineteen independent `remove()` calls, and the difference is
   * not tidiness — it is the ordering, which is the whole fix. See
   * `save-reset.ts` for the failure this is shaped around.
   *
   *   1. Stamp the wipe locally. First, and before anything is destroyed, so a
   *      tab closed at any point after this still carries the intent and the
   *      next `attach()` finishes the job.
   *   2. Delete the cloud documents and publish the stamp. If this cannot be
   *      reached the local stamp survives step 1 and `reconcileReset` re-pushes
   *      it on the next attach — which is exactly the mobile case where the
   *      lazy Firestore SDK had not loaded yet and the old code silently gave up.
   *   3. Only then clear local, and rehydrate the owning services so the screen
   *      matches the disk in the same tick.
   *
   * `keepDeviceSnapshot` exists because the sign-in "before picture" is this
   * browser's undo for a *merge*, not for a wipe; a reset that left it behind
   * would leave a one-click path to restoring the save that was just deleted.
   */
  async resetAll(): Promise<void> {
    if (!this.isBrowser) return;

    const at = Date.now();
    this.writeResetStamp(at);

    // Nothing queued from before the wipe may be allowed to land after it.
    this.cancelFlush();
    this.dirty.clear();
    this.lastRemote.clear();
    this.overrideStrategy = null;
    // Every blob is going anyway, so per-key deletion records are now noise —
    // and leaving them would have the next attach re-issue deletes for keys the
    // visitor may have legitimately started again since.
    this.writePendingDeletes(new Set());

    await this.publishReset(at);

    for (const entry of STATE_ENTRIES) {
      // The character list survives a reset: resetting is about this Keeper's progress, not the account's roster.
      if (entry.key === CHARACTER_ROSTER_KEY) continue;
      this.unspill(entry.key);
      try {
        localStorage.removeItem(this.sk(entry.key));
      } catch { /* private mode */ }
    }
    try {
      localStorage.removeItem(this.sk(SAVE_BACKUP_KEY));
    } catch { /* private mode */ }

    // Same tick as the removal, for the reason LocalSaveRegistry exists: the
    // owning services are holding the pre-wipe copy in memory and would flush
    // it straight back over the empty store within the second.
    this.zone.run(() => {
      for (const entry of STATE_ENTRIES) this.owners.rehydrate(entry.key);
    });
  }

  /**
   * Push a wipe to the cloud: delete every state document, then stamp.
   *
   * The stamp is written last on purpose. It is the marker that says "the cloud
   * is wiped", and writing it before the deletes would let a second device read
   * a settled stamp while the documents it describes were still up there — which
   * would make that device skip its own wipe and adopt the survivors.
   *
   * Resolves either way. A failure here is expected and handled: the local stamp
   * outlives it and the next attach retries.
   */
  private async publishReset(at: number): Promise<void> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return;

    try {
      await this.zone.runOutsideAngular(async () => {
        for (const entry of STATE_ENTRIES) {
          if (entry.key === CHARACTER_ROSTER_KEY) continue;
          await fs.api.deleteDoc(this.ref(fs, uid, entry));
        }
        await fs.api.setDoc(
          this.resetRef(fs, uid),
          { at, deviceId: this.leases.deviceId() },
        );
      });
    } catch {
      // Offline, or the SDK is not up. The local stamp is the durable record.
      this.setLink('offline');
      this.scheduleRetry();
    }
  }

  /** This device's last wipe, or 0. */
  private readResetStamp(): number {
    const raw = this.readRaw(RESET_STAMP_KEY);
    if (raw === null) return 0;
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 ? at : 0;
  }

  private writeResetStamp(at: number): void {
    try {
      localStorage.setItem(this.sk(RESET_STAMP_KEY), String(at));
    } catch { /* private mode */ }
  }

  /**
   * Settle the two wipe stamps before a single blob is merged.
   *
   * Returns true when the caller should treat the cloud as empty for the rest of
   * this attach — either because this device's wipe has not landed yet and is
   * being re-pushed, or because another device's wipe just took effect here and
   * there is nothing left on either side to merge.
   */
  private async reconcileReset(
    uid: string,
    fs: FirestoreHandle,
    remote: Map<string, unknown>,
    cloudAt: number,
  ): Promise<boolean> {
    const localAt = this.readResetStamp();

    switch (resetVerdict(localAt, cloudAt)) {
      case 'none':
        return false;

      case 'push-local':
        // The wipe happened here and the cloud still holds the old save. Finish
        // what `resetAll` started; everything `readAll` just returned is stale
        // by definition, so it is dropped rather than merged.
        await this.publishReset(localAt);
        remote.clear();
        return true;

      case 'adopt-remote': {
        // Another device wiped the account, later than anything this one did. A
        // reset is account-wide, so this device's survivors are not "state the
        // cloud is missing" — they are the save that was deleted.
        this.writeResetStamp(cloudAt);
        this.dirty.clear();
        this.lastRemote.clear();
        for (const entry of STATE_ENTRIES) {
          if (entry.key === CHARACTER_ROSTER_KEY) continue;
          this.unspill(entry.key);
          try {
            localStorage.removeItem(this.sk(entry.key));
          } catch { /* private mode */ }
        }
        this.zone.run(() => {
          for (const entry of STATE_ENTRIES) this.owners.rehydrate(entry.key);
        });
        remote.clear();
        return true;
      }
    }
  }

  private markDirty(key: string): void {
    if (!this.attached) return;
    if (this.retired && isCharacterScoped(key, STATE_KEYS)) return;
    if (!BY_KEY.has(key)) return; // Not saved state; nothing to sync.

    if (this.dirty.size === 0) this.oldestDirtyAt = Date.now();
    this.dirty.add(key);
    this.scheduleFlush();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Session
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Make Firestore the record for this account, and adopt what it holds.
   *
   * Reads both subcollections whole rather than nineteen documents one at a
   * time. Same number of billed reads, two round trips instead of nineteen —
   * and this runs on every page load of a signed-in visitor, so the round trips
   * were the part that showed.
   *
   * Every key that moves is written to the cache and pushed straight into the
   * service holding it, in the same tick as the write. That ordering is not
   * cosmetic and is the whole subject of `LocalSaveRegistry`: the owning service
   * is holding a pre-merge copy it would otherwise flush back within the second.
   */
  async attach(
    uid: string,
    fs: FirestoreHandle,
    ask?: (conflict: MergeConflict) => Promise<MergeStrategy>,
  ): Promise<AttachResult> {
    // Attach first so an offline first pull still queues later play. Hold
    // automatic flushes until the merge choice is known — a four-second
    // upload started during the dialog is what used to swallow Keep This
    // Device / Merge Best while the header said Synced.
    this.uid = uid;
    this.fs = fs;
    this.decisionPending = true;
    this.setLink('syncing');
    this.lastPullAt = Date.now();
    this.bindLifecycle();

    // Settle every owner before reading a single blob. Most write through on
    // every mutation, but the ledger throttles to one write every five seconds
    // and progression debounces at 800ms — so without this the pull would
    // reconcile against a copy of the Gold a few seconds behind memory, and the
    // rehydrate at the far end would drop the difference.
    this.flushOwners();

    let remote: Map<string, unknown>;
    let strategy: MergeStrategy;
    try {
      const pulled = await this.readAll(uid, fs);
      remote = pulled.blobs;

      // Single-key deletions that never reached the cloud, re-issued before
      // anything is merged — the same failure as a full wipe, one blob at a time.
      await this.drainPendingDeletes(uid, fs, remote);

      // Then the account-wide wipe, still before a single blob is merged. A
      // wipe is not a conflict to be reconciled key-by-key — it decides whether
      // there is anything to reconcile at all, and asking the merge dialog
      // about a save the visitor has already deleted would be the old bug
      // wearing a dialog.
      const wiped = await this.reconcileReset(uid, fs, remote, pulled.resetAt);
      strategy = wiped ? 'merge' : await this.decideStrategy(remote, ask);
      // Idle ticks during the dialog can move memory after the first flush.
      this.flushOwners();
    } catch (err) {
      this.decisionPending = false;
      // Still this session: keep the queue and retry when the network returns.
      if (this.fs === fs && this.uid === uid) {
        this.setLink('offline');
        this.scheduleRetry();
      }
      throw err;
    }
    this.decisionPending = false;

    // signOut() answers the dialog and detaches in the same turn, without
    // awaiting this attach. If we still push, leftover drain spins forever
    // on a null Firestore handle.
    if (this.fs !== fs) return { adopted: [], seeded: false };
    if (strategy !== 'merge') this.overrideStrategy = strategy;

    // After the pull and before the push. Adopting the cloud copy is something
    // every device does — it is reading — and the lease only ever gates the
    // write half, so resolving it here keeps a passive device fully up to date
    // while still holding its own queue.
    await this.leases.begin(uid, fs);

    const adopted: string[] = [];
    const toWrite: StateEntry[] = [];
    /** Merged payloads the cloud moved, with this device's copy from before. */
    const moves: { key: string; raw: string; before: string | null }[] = [];

    this.sends += 1;
    for (const entry of STATE_ENTRIES) {
      const localRaw = this.readRaw(entry.key);
      const local = localRaw === null ? null : safeParse(localRaw);
      const cloud = remote.get(entry.key) ?? null;

      if (cloud !== null) this.lastRemote.set(entry.key, JSON.stringify(cloud));

      const merged = applyStrategy(entry, cloud, local, strategy);
      if (merged === null || merged === undefined) continue;

      const resolved = entry.identify ? entry.identify(merged, uid) : merged;
      const resolvedRaw = JSON.stringify(resolved);
      const settled = stable(entry, resolved);

      if (settled !== stable(entry, local)) {
        moves.push({ key: entry.key, raw: resolvedRaw, before: localRaw });
      }
      if (cloud === null || settled !== stable(entry, cloud)) {
        toWrite.push(entry);
      }
    }

    // Before anything of the cloud's lands on this device, keep the before
    // picture — see snapshotBeforeMerge. Only of the blobs the merge moves: a
    // copy of every blob on every attach (and every tab refocus) doubled the
    // save on disk and filled phones' localStorage.
    if (moves.length > 0) this.snapshotBeforeMerge(uid, moves);

    // Cloud state this device did not have. Cache it and hand it to its owner
    // in the same tick — see the note above.
    for (const move of moves) {
      this.adopt(move.key, move.raw);
      adopted.push(move.key);
    }

    const seeded = remote.size === 0;

    // Whatever the cloud is missing goes up now rather than on the debounce.
    // This is the moment a visitor is thinking about whether their progress is
    // safe, and "signed in" should mean "it is up there" without a wait.
    if (toWrite.length > 0) {
      for (const entry of toWrite) this.dirty.add(entry.key);
      this.oldestDirtyAt = Date.now();
      // An explicit override is the one case a write can legitimately lower a
      // number, which the monotonic XP rule will refuse. Per-document writes
      // keep that refusal from failing the other eighteen with it.
      //
      // `known` is what was just read. Without it the push would `getDoc` every
      // dirty document a moment after `readAll` returned the same content —
      // paying for the account twice on every sign-in for no new information.
      await this.pushDirty({
        batched: strategy === 'merge',
        known: remote,
        strategy,
      });
    } else {
      this.setLink('synced');
      this.clearPendingMark();
    }
    // Every OTHER character this device holds that the cloud may be missing (made or played signed out, behind the
    // lease, or a page that reloaded before its flush). Before this, a character's documents went up only from a
    // page playing it while signed in, so a Keeper made on one page and opened next on another device had a roster
    // row and nothing else (owner, 2026-10-21: the Ashguard `kzxyxtrw` had no documents at all).
    await this.pushOtherCharacters(uid, fs);
    return { adopted, seeded };
  }

  /**
   * Push the local save of every other character this device holds and the cloud may be missing. Never adopts
   * anything locally (nothing is ever written into a character the page is not playing); writes only what the cloud
   * lacks or would gain by the merge, and the ledger only when the cloud has none (its op log merges in a
   * transaction on the character's own page). Characters with the pending mark, plus — once per account per browser —
   * every character, for saves written before the mark existed.
   */
  private async pushOtherCharacters(uid: string, fs: FirestoreHandle): Promise<void> {
    if (!this.isBrowser || !this.leases.mayWrite) return;
    let ids: string[] = [];
    let sweep = false;
    try {
      sweep = localStorage.getItem(SEED_SWEEP_KEY) !== uid;
      const roster = this.read(CHARACTER_ROSTER_KEY);
      const chars = isRecord(roster) && isRecord(roster['chars']) ? roster['chars'] : {};
      const known = new Set<string>([PRIMARY_CHARACTER, ...Object.keys(chars)]);
      for (const id of known) {
        if (id === this.character || !isCharacterId(id)) continue;
        const row = chars[id];
        if (isRecord(row) && typeof row['deletedAt'] === 'number' && row['deletedAt'] > 0) continue;
        if (!this.hasLocalSave(id)) continue;
        if (sweep || localStorage.getItem(characterStorageKey(CLOUD_PENDING_KEY, id)) !== null) ids.push(id);
      }
    } catch {
      return;
    }
    let ok = true;
    for (const id of ids) {
      if (this.fs !== fs || this.uid !== uid) return;
      try {
        await this.zone.runOutsideAngular(() => this.pushCharacter(uid, fs, id));
        try { localStorage.removeItem(characterStorageKey(CLOUD_PENDING_KEY, id)); } catch { /* private mode */ }
      } catch {
        ok = false; // Offline or refused: the mark stays, the next attach tries again.
      }
    }
    if (ok && sweep) {
      try { localStorage.setItem(SEED_SWEEP_KEY, uid); } catch { /* private mode: swept again next time */ }
    }
  }

  /** One other character's local save into its own documents (see {@link pushOtherCharacters}). */
  private async pushCharacter(uid: string, fs: FirestoreHandle, id: string): Promise<void> {
    const entries = STATE_ENTRIES.filter(e => isCharacterScoped(e.key, STATE_KEYS));
    const byPath = new Map<string, StateEntry>(entries.map(e => [`${e.collection}/${e.doc}`, e]));
    const cloud = new Map<string, unknown>();
    let resetAt = 0;
    for (const collection of [...new Set(entries.map(e => e.collection))]) {
      const snap = await fs.api.getDocs(fs.api.collection(fs.db, 'users', uid, ...characterDocPath(id, collection, '').slice(0, -1)));
      snap.forEach(doc => {
        if (collection === RESET_COLLECTION && doc.id === RESET_DOC) { resetAt = coerceResetStamp(doc.data()).at; return; }
        const entry = byPath.get(`${collection}/${doc.id}`);
        if (entry) cloud.set(entry.key, entry.enveloped ? unwrapBlob(doc.data()) : doc.data());
      });
    }
    // Wiped on another device after this device's copy: the character's own page adopts the wipe; pushing would undo it.
    const localAt = Number(localStorage.getItem(characterStorageKey(RESET_STAMP_KEY, id)));
    if (resetAt > (Number.isFinite(localAt) ? localAt : 0)) return;

    const writes: { path: string[]; body: Record<string, unknown> }[] = [];
    for (const entry of entries) {
      const raw = localStorage.getItem(characterStorageKey(entry.key, id));
      const local = raw === null ? null : safeParse(raw);
      if (local === null) continue;
      const held = cloud.get(entry.key) ?? null;
      if (held !== null && entry.key === ECONOMY_STATE_KEY) continue;
      const merged = applyStrategy(entry, held, local, 'merge');
      const resolved = entry.identify ? entry.identify(merged, uid) : merged;
      if (resolved === null || resolved === undefined) continue;
      if (held !== null && stable(entry, resolved) === stable(entry, held)) continue;
      writes.push({ path: characterDocPath(id, entry.collection, entry.doc), body: envelope(entry, resolved) });
    }
    if (writes.length === 0) return;
    const batch = fs.api.writeBatch(fs.db);
    for (const w of writes) batch.set(fs.api.doc(fs.db, 'users', uid, ...w.path), w.body);
    try {
      await batch.commit();
    } catch {
      // Atomic: one refused document (the XP rule) fails them all. One at a time, so only that one is lost.
      let failure: unknown = null;
      for (const w of writes) {
        try { await fs.api.setDoc(fs.api.doc(fs.db, 'users', uid, ...w.path), w.body); } catch (err) { failure ??= err; }
      }
      if (failure) throw failure;
    }
  }

  /**
   * Push what is queued now rather than on the debounce — for a moment that must not be lost to a closed tab (a new
   * Keeper made at the Glass). A no-op while signed out or while an attach is still deciding (its own push carries
   * everything then).
   */
  async pushNow(): Promise<void> {
    if (!this.attached || this.decisionPending || this.dirty.size === 0) return;
    this.cancelFlush();
    await this.pushDirty({ batched: true });
  }

  /**
   * Everything this device held immediately before the last sign-in merge.
   *
   * Reconciling is lossless by construction — it keeps the higher of every
   * monotone counter and replays both sides' ledger operations — so this is not
   * here to undo a mistake the merge made. It is here because "combine them" is
   * a decision the game now takes on the visitor's behalf, and a decision taken
   * for somebody should be one they can walk back. It is what makes signing in
   * safe to do without asking anything first.
   *
   * Device-local and deliberately not synced: it is this browser's before
   * picture, and pushing it would make it the account's.
   */
  private snapshotBeforeMerge(uid: string, moves: readonly { key: string; before: string | null }[]): void {
    try {
      const blobs: Record<string, string> = {};
      for (const move of moves) if (move.before !== null) blobs[move.key] = move.before;
      if (Object.keys(blobs).length === 0) return;
      localStorage.setItem(this.sk(SAVE_BACKUP_KEY), JSON.stringify({
        at: new Date().toISOString(),
        uid,
        blobs,
      }));
    } catch {
      // Out of quota, or private mode. A backup is a courtesy; failing to take
      // one must never stop somebody signing in.
    }
  }

  /** The before picture, if this browser still holds one for this account. */
  deviceSnapshot(): { at: string; uid: string } | null {
    try {
      const raw = localStorage.getItem(this.sk(SAVE_BACKUP_KEY));
      if (!raw) return null;
      const held = safeParse(raw);
      if (!isRecord(held) || typeof held['at'] !== 'string' || typeof held['uid'] !== 'string') return null;
      return { at: held['at'], uid: held['uid'] };
    } catch {
      return null;
    }
  }

  /**
   * Put this device back the way it was before the last merge, and make that
   * the account's save.
   *
   * Pushed with the 'local' strategy for the same reason the visitor picked it:
   * this is the one moment a write is allowed to lower a number. Lifetime XP is
   * still floored by `preserveMonotonicXp`, because the cloud rule refuses a
   * write that lowers it and taking the rest of the save back should not fail
   * on that one field.
   */
  async restoreDeviceSnapshot(): Promise<boolean> {
    const snap = this.deviceSnapshot();
    if (!snap) return false;
    const raw = localStorage.getItem(this.sk(SAVE_BACKUP_KEY));
    const held = raw === null ? null : safeParse(raw);
    if (!isRecord(held) || !isRecord(held['blobs'])) return false;

    const blobs = held['blobs'] as Record<string, unknown>;
    for (const entry of STATE_ENTRIES) {
      const value = blobs[entry.key];
      if (typeof value !== 'string') continue;
      this.adopt(entry.key, value);
      this.dirty.add(entry.key);
    }
    if (this.dirty.size === 0) return true;
    this.oldestDirtyAt = Date.now();
    if (!this.attached) return true;
    await this.pushDirty({ batched: false, strategy: 'local' });
    return true;
  }

  /**
   * Stop being the cloud's face. The cache keeps everything, untouched.
   *
   * Signing out is not a request to forget months of progress, so nothing is
   * deleted — the visitor who signs back in finds it all where they left it,
   * and until then the site behaves exactly as it does for someone who never
   * signed in at all.
   */
  async detach(): Promise<void> {
    // One last flush while there is still somewhere to flush to.
    if (this.attached && this.dirty.size > 0) {
      try {
        await this.pushDirty({ batched: true });
      } catch {
        // Unreachable. The cache holds everything; the next sign-in re-merges.
      }
    }
    this.cancelFlush();
    this.unbindLifecycle();
    // Before the uid is cleared: releasing needs to know whose lease it is.
    this.leases.end();
    this.decisionPending = false;
    this.uid = null;
    this.fs = null;
    this.dirty.clear();
    this.lastRemote.clear();
    this.overrideStrategy = null;
    this.retryMs = RETRY_BASE_MS;
    this.setLink('local');
  }

  /**
   * Which way this pull reconciles, asking the visitor only when it has to.
   *
   * The structural rules take the higher of every number and the union of every
   * set, which is the right default precisely because it cannot lose anything.
   * But "cannot lose anything" is not the same as "is what somebody wanted": a
   * visitor who has been playing on a phone all week and then signs in on a
   * desktop holding its own half-finished save may well want one of them gone,
   * and the generous merge hands them a save that is neither.
   *
   * So the question is asked only when it is real — when each side holds
   * something the other does not. A cloud save simply ahead of this browser on
   * every number is not a conflict; all three answers would do the same thing,
   * and asking would be theatre.
   *
   * The gateway owns the data and the caller owns the question. `ask` is how the
   * header's merge dialog gets a say without this file knowing that a dialog is
   * what happens next.
   */
  private async decideStrategy(
    remote: Map<string, unknown>,
    ask?: (conflict: MergeConflict) => Promise<MergeStrategy>,
  ): Promise<MergeStrategy> {
    if (!ask || remote.size === 0) return 'merge';

    const local = summarise(this.read(PROGRESS_KEY), this.read(ECONOMY_STATE_KEY));
    const cloud = summarise(
      remote.get(PROGRESS_KEY) ?? null,
      remote.get(ECONOMY_STATE_KEY) ?? null,
    );
    if (!isConflict(local, cloud)) return 'merge';

    return ask({ local, cloud });
  }

  /**
   * Re-read the cloud and adopt anything new, mid-session.
   *
   * The honest moment for this is a tab coming back into view: it is exactly
   * when somebody has put a phone down and picked up a desktop. Throttled, and
   * never asks — a dialog opening because somebody alt-tabbed would be a
   * question they did not invite.
   */
  async resync(): Promise<AttachResult | null> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs) return null;
    if (Date.now() - this.lastPullAt < REPULL_INTERVAL_MS) return null;
    return this.attach(uid, fs);
  }

  /** Send everything queued, now. Used by sign-out and the retry button. */
  async flushNow(): Promise<void> {
    if (!this.attached) return;
    this.cancelFlush();
    await this.pushDirty({ batched: true });
  }

  /**
   * Settle everything before the page reloads itself (the "new version is
   * ready" toast). Owners flush first, synchronously, so every throttled write
   * is on disk before anything else can happen — localStorage is the part that
   * must survive. The cloud push is then given `timeoutMs` to land and is not
   * waited for past that: the queue is in the cache and the next load pushes it,
   * exactly as after a `pagehide` that the SDK could not finish.
   *
   * Nothing is rehydrated: no external write happened, so the owners' memory
   * IS the latest state, and the `pagehide` flush the reload fires writes the
   * same values again (see the pagehide note in local-save-registry.service.ts).
   */
  async settleForReload(timeoutMs = 2_500): Promise<void> {
    this.flushOwners();
    if (!this.attached || this.dirty.size === 0) return;
    this.cancelFlush();
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      this.pushDirty({ batched: true }).catch(() => { /* offline: the queue holds */ }),
      new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
    ]);
    if (timer !== null) clearTimeout(timer);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reading the cloud
  // ───────────────────────────────────────────────────────────────────────────

  /** Every stored document for this account, keyed by localStorage key. */
  private async readAll(
    uid: string,
    fs: FirestoreHandle,
  ): Promise<{ blobs: Map<string, unknown>; resetAt: number }> {
    const out = new Map<string, unknown>();
    // Picked out of the sweep below rather than fetched separately. The reason
    // that matters is in `save-reset.ts`: a dedicated read here would be a third
    // billed round trip on every page load of every signed-in visitor.
    let resetAt = 0;
    const collections = [...new Set(STATE_ENTRIES.map(e => e.collection))];

    // Character #1 reads the root collections whole, exactly as before characters existed (the account-wide
    // documents sit beside it). Any other character reads its own subcollections whole, plus the few account-wide
    // documents one by one — never another character's documents.
    const primary = this.character === PRIMARY_CHARACTER;
    const own = primary ? STATE_ENTRIES : STATE_ENTRIES.filter(e => isCharacterScoped(e.key, STATE_KEYS));
    const byPath = new Map<string, StateEntry>(
      own.map(e => [`${e.collection}/${e.doc}`, e]),
    );
    if (!primary) {
      for (const entry of STATE_ENTRIES) {
        if (isCharacterScoped(entry.key, STATE_KEYS)) continue;
        const snap = await fs.api.getDoc(this.ref(fs, uid, entry));
        if (!snap.exists()) continue;
        const data = snap.data();
        out.set(entry.key, entry.enveloped ? unwrapBlob(data) : data);
      }
    }

    for (const collection of collections) {
      const snap = await fs.api.getDocs(
        fs.api.collection(fs.db, 'users', uid, ...characterDocPath(this.character, collection, '').slice(0, -1)),
      );
      snap.forEach(doc => {
        if (collection === RESET_COLLECTION && doc.id === RESET_DOC) {
          resetAt = coerceResetStamp(doc.data()).at;
          return;
        }
        const entry = byPath.get(`${collection}/${doc.id}`);
        // A document this build does not know about is left alone rather than
        // dropped: it is either a key an older client wrote or one a newer
        // client will, and deleting other versions' state is how a rollback
        // turns into data loss.
        if (!entry) return;
        const data = doc.data();
        out.set(entry.key, entry.enveloped ? unwrapBlob(data) : data);
      });
    }
    return { blobs: out, resetAt };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Writing the cloud
  // ───────────────────────────────────────────────────────────────────────────

  private scheduleFlush(): void {
    if (this.decisionPending) return;
    if (this.flushTimer !== null) {
      // Already booked. Let it stand unless the cap is due, so a burst of
      // clicking does not keep pushing the write further out.
      if (Date.now() - this.oldestDirtyAt < FLUSH_MAX_WAIT_MS) return;
      this.cancelFlush();
      void this.pushDirty({ batched: true });
      return;
    }
    // Outside Angular: a four-second timer whose job is a network write has no
    // template work behind it, and letting zone.js own it would wake change
    // detection for the life of the tab.
    this.zone.runOutsideAngular(() => {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.pushDirty({ batched: true });
      }, FLUSH_DEBOUNCE_MS);
    });
  }

  private cancelFlush(): void {
    if (this.flushTimer === null) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  /**
   * Read the dirty documents, merge, and write the results.
   *
   * Serialised on `this.flushing` so two overlapping tabs on this device cannot
   * interleave. Concurrent *devices* are a different race: the economy document
   * is written inside a Firestore transaction that re-reads, merges, and
   * retries on contention. Other blobs stay monotone and still go through the
   * batch path.
   */
  private pushDirty(opts: {
    batched: boolean;
    known?: Map<string, unknown>;
    strategy?: MergeStrategy;
  }): Promise<void> {
    const strategy = opts.strategy ?? this.overrideStrategy ?? 'merge';
    if (this.flushing) {
      // Wait for the in-flight write, then send whatever was dirtied while it
      // ran. Returning the in-flight promise itself dropped Keep This Device
      // and Merge Best: attach queued those keys, awaited a flush that had
      // already started, and marked Synced without ever writing them.
      return this.flushing.then(() => this.drainLeftover({
        batched: opts.batched,
        strategy,
      }));
    }
    this.flushing = this.runPush({
      batched: opts.batched,
      known: opts.known,
      strategy,
    }).finally(() => { this.flushing = null; });
    return this.flushing.then(() => {
      if (this.dirty.size === 0) this.overrideStrategy = null;
      else this.scheduleFlush();
    });
  }

  private drainLeftover(opts: {
    batched: boolean;
    strategy: MergeStrategy;
  }): Promise<void> | void {
    if (!this.attached || !this.fs || this.dirty.size === 0) return;
    return this.pushDirty(opts);
  }

  private async runPush(
    { batched, known, strategy }: {
      batched: boolean;
      known?: Map<string, unknown>;
      strategy: MergeStrategy;
    },
  ): Promise<void> {
    const uid = this.uid;
    const fs = this.fs;
    if (!uid || !fs || this.dirty.size === 0) return;

    // The one gate the device lease imposes, and it is deliberately the only
    // one: a passive device reads, merges and adopts exactly as before, and
    // only the upload waits. The queue is *kept*, not dropped — the keys stay
    // dirty, `onLeaseHandover` flushes them the moment this device becomes
    // active, and until then the local cache holds everything. Nothing here can
    // lose a write; it can only postpone one.
    if (!this.leases.mayWrite) {
      this.setLink('waiting');
      return;
    }

    // Claimed up front. A write that lands while this is in flight re-dirties
    // its key and books another flush, rather than being folded into this one
    // and reported as sent before it was.
    const keys = [...this.dirty];
    this.dirty.clear();
    this.setLink('syncing');

    const writes: { entry: StateEntry; payload: unknown }[] = [];

    try {
      for (const key of keys) {
        const entry = BY_KEY.get(key);
        if (!entry) continue;

        this.sends += 1;
        const localRaw = this.readRaw(key);
        if (localRaw === null) continue;
        const local = safeParse(localRaw);
        if (local === null) continue; // Unparseable; the owner will replace it.

        if (key === ECONOMY_STATE_KEY && typeof fs.api.runTransaction === 'function') {
          await this.commitEconomyTransactional(fs, uid, entry, local, localRaw, strategy);
          continue;
        }

        // A read this push does not have to make. `attach` hands over what it
        // just read, and that map is the *whole* account — `readAll` sweeps both
        // subcollections — so a key missing from it means the document does not
        // exist rather than that it was not looked at. Re-reading to confirm an
        // absence Firestore has already reported would be paying for the account
        // twice on every sign-in. Every other caller passes no `known` and reads,
        // which is what keeps concurrent devices safe.
        let cloud: unknown;
        if (known) {
          cloud = known.get(key) ?? null;
        } else {
          const snap = await fs.api.getDoc(this.ref(fs, uid, entry));
          cloud = snap.exists()
            ? (entry.enveloped ? unwrapBlob(snap.data()) : snap.data())
            : null;
        }

        const reconciled = applyStrategy(entry, cloud, local, strategy);
        const merged = entry.identify ? entry.identify(reconciled, uid) : reconciled;
        const mergedRaw = JSON.stringify(merged);
        const settled = stable(entry, merged);

        // Nothing to say when the cloud already holds exactly this.
        if (cloud !== null && settled === stable(entry, cloud)) {
          this.lastRemote.set(key, mergedRaw);
          continue;
        }

        writes.push({ entry, payload: merged });

        // The merge pulled in something this device did not have. Take it here
        // rather than waiting for the next page load — this is the path that
        // makes a tab left open all day notice the phone's evening of Gold.
        // Skip the adopt if the cache moved during the flush: writing the
        // stale merge back would erase Gold earned while we were in flight.
        this.adoptUnlessMoved(key, localRaw, mergedRaw);
        this.lastRemote.set(key, mergedRaw);
      }

      if (writes.length > 0) {
        if (batched) await this.writeBatched(fs, uid, writes);
        else await this.writeEach(fs, uid, writes);
      }

      this.retryMs = RETRY_BASE_MS;
      this.setLink('synced');
      this.clearPendingMark();
    } catch (err) {
      // Put them back and try again later. Re-adding rather than restoring the
      // old set on purpose: anything written during the attempt is already in
      // `dirty` and must stay there.
      for (const key of keys) this.dirty.add(key);
      if (this.oldestDirtyAt === 0) this.oldestDirtyAt = Date.now();
      this.scheduleRetry();
      throw err;
    }
  }

  /**
   * Read-merge-write the Godforge ledger inside a transaction.
   *
   * Two devices that both read the same old document and then setDoc would
   * drop whichever merge finished first. The transaction re-reads, merges
   * under the op-log rule, and retries if the document moved.
   */
  private async commitEconomyTransactional(
    fs: FirestoreHandle,
    uid: string,
    entry: StateEntry,
    local: unknown,
    localRaw: string,
    strategy: MergeStrategy,
  ): Promise<void> {
    const ref = this.ref(fs, uid, entry);
    let adoptedRaw: string | null = null;
    let remoteRaw: string | null = null;

    await fs.api.runTransaction(fs.db, async (tx) => {
      const snap = await tx.get(ref);
      const cloud = snap.exists()
        ? (entry.enveloped ? unwrapBlob(snap.data()) : snap.data())
        : null;
      const reconciled = applyStrategy(entry, cloud, local, strategy);
      const identified = entry.identify ? entry.identify(reconciled, uid) : reconciled;
      // Compaction is the cloud's job: this transaction is the record, and
      // the ack frontier lives on the document. Local merge never folds.
      // Migrated as well as coerced: a keep-cloud / keep-device strategy can
      // hand back a v2 blob untouched, and v2 Gold must never be written over
      // a v3 ledger (economy rebalance §4). A no-op on a v3 ledger.
      const ledger = coerceMigrated(identified);
      const merged = ledger
        ? acknowledgeAndMaybeCompact(ledger, readDeviceId(), Date.now())
        : identified;
      const mergedRaw = JSON.stringify(merged);
      const settled = stable(entry, merged);

      if (cloud !== null && settled === stable(entry, cloud)) {
        remoteRaw = mergedRaw;
        adoptedRaw = null;
        return;
      }

      tx.set(ref, envelope(entry, merged));
      remoteRaw = mergedRaw;
      adoptedRaw = settled !== stable(entry, local) ? mergedRaw : null;
    });

    if (adoptedRaw) this.adoptUnlessMoved(entry.key, localRaw, adoptedRaw);
    if (remoteRaw) this.lastRemote.set(entry.key, remoteRaw);
  }

  /** One round trip for every dirty document. */
  private async writeBatched(
    fs: FirestoreHandle,
    uid: string,
    writes: { entry: StateEntry; payload: unknown }[],
  ): Promise<void> {
    const batch = fs.api.writeBatch(fs.db);
    for (const { entry, payload } of writes) {
      batch.set(
        this.ref(fs, uid, entry),
        envelope(entry, payload),
      );
    }
    try {
      await batch.commit();
    } catch {
      // A batch is atomic, so one refused document fails all of them — and the
      // monotonic XP rule refuses writes by design. Retrying per-document
      // isolates the refusal instead of letting it hold eighteen unrelated blobs
      // hostage until somebody notices. The batch's own error is dropped because
      // the per-document pass produces the real one: either every write lands,
      // in which case the batch was the problem and there is nothing to report,
      // or the offending document throws again and that is the error worth
      // surfacing.
      await this.writeEach(fs, uid, writes);
    }
  }

  /** A write per document, so one refusal costs only that document. */
  private async writeEach(
    fs: FirestoreHandle,
    uid: string,
    writes: { entry: StateEntry; payload: unknown }[],
  ): Promise<void> {
    let failure: unknown = null;
    for (const { entry, payload } of writes) {
      try {
        await fs.api.setDoc(
          this.ref(fs, uid, entry),
          envelope(entry, payload) as Record<string, unknown>,
        );
      } catch (err) {
        failure ??= err;
        // Keep it queued: a refused progression write means this device is
        // behind, and the next attach re-merges, which is what actually
        // resolves it.
        this.dirty.add(entry.key);
        this.lastRemote.delete(entry.key);
      }
    }
    if (failure) throw failure;
  }

  private scheduleRetry(): void {
    this.setLink('offline');
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    this.cancelFlush();
    this.zone.runOutsideAngular(() => {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.pushDirty({ batched: true }).catch(() => { /* backed off again */ });
      }, wait);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Plumbing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Adopt a merged payload only if the cache still holds the snapshot we
   * read. A write that lands during the flush (idle Gold, an award inside
   * the debounce) must not be replaced by the stale merge we just uploaded.
   * The key stays dirty so the next pass re-merges the fresher copy.
   */
  private adoptUnlessMoved(key: string, readRaw: string, mergedRaw: string): void {
    const current = this.readRaw(key);
    if (current !== readRaw) {
      this.dirty.add(key);
      if (this.oldestDirtyAt === 0) this.oldestDirtyAt = Date.now();
      this.scheduleFlush();
      return;
    }
    if (mergedRaw !== readRaw) this.adopt(key, mergedRaw);
  }

  /** Cache a resolved payload and push it into the service that owns it. */
  private adopt(key: string, raw: string): void {
    // Quota or private mode: held in memory (persist), so the owner still
    // rehydrates from the merged copy rather than keeping its stale one.
    this.persist(key, raw);
    // In the zone: rehydration republishes a BehaviorSubject from a promise
    // chain, and without a change-detection pass the new Gold would be correct
    // in memory and stale on screen — which reads as the same bug.
    this.zone.run(() => this.owners.rehydrate(key));
  }

  /**
   * Called when the lease may have moved. Drains the queue if it moved to us.
   *
   * A device that spent ten minutes passive has ten minutes of play sitting in
   * `dirty`, and the merge rules on the far side are what make sending it late
   * safe rather than destructive — this is the same reconciliation any two
   * devices would have gone through, just serialised.
   */
  private onLeaseSettled(): Promise<void> | void {
    if (!this.attached || !this.leases.mayWrite) return;
    if (this.link === 'waiting') this.setLink(this.dirty.size > 0 ? 'syncing' : 'synced');
    if (this.dirty.size === 0) return;
    return this.pushDirty({ batched: true }).catch(() => { /* retried on the timer */ });
  }

  /**
   * The banner's "Play Here": take the lease, then send what is waiting.
   *
   * Awaits the drain rather than firing it off. The visitor pressed a button
   * meaning "sync this device", and a promise that resolves before the upload
   * has happened would let the banner report success while the queue was still
   * on disk — which is the shape of the bug this whole change is about.
   */
  async claimLease(): Promise<void> {
    await this.leases.claim();
    await this.onLeaseSettled();
  }

  private flushOwners(): void {
    for (const entry of STATE_ENTRIES) this.owners.flush(entry.key);
  }

  private lifecycleBound = false;

  private readonly onHide = (): void => {
    if (document.visibilityState === 'hidden') this.onLeave();
    else {
      // Renew before re-pulling. A device coming back into view is the case the
      // lease is built around — somebody has put one device down and picked
      // this one up — and discovering the handover first means the resync that
      // follows can already push.
      void this.leases.refresh()
        .then(() => this.onLeaseSettled())
        .catch(() => { /* handled in the service */ });
      void this.resync().catch(() => { /* offline; the queue holds */ });
    }
  };

  private readonly onLeave = (): void => {
    this.flushOwners();
    this.cancelFlush();
    // Hand the save on rather than making the next device wait out the TTL.
    // Ordered after `flushOwners` so the push below still carries this
    // session's last writes — releasing does not cancel the flush, it only
    // stops this device claiming the lease again.
    this.leases.release();
    // Unawaitable by definition. The SDK's offline queue lands it more often
    // than not, and when it does not the cache still holds everything and the
    // next load pushes it.
    void this.pushDirty({ batched: true }).catch(() => { /* leaving */ });
  };

  private readonly onOnline = (): void => {
    if (this.dirty.size > 0) void this.pushDirty({ batched: true }).catch(() => { /* still down */ });
  };

  private bindLifecycle(): void {
    if (this.lifecycleBound || !this.isBrowser) return;
    this.lifecycleBound = true;
    window.addEventListener('pagehide', this.onLeave);
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onHide);
  }

  private unbindLifecycle(): void {
    if (!this.lifecycleBound || !this.isBrowser) return;
    this.lifecycleBound = false;
    window.removeEventListener('pagehide', this.onLeave);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onHide);
  }

  private setLink(next: CloudLink): void {
    if (this.link$$.value === next) return;
    this.zone.run(() => this.link$$.next(next));
  }
}

/**
 * How one key's two copies become one, including the XP floor the
 * `progress/state` security rule requires.
 *
 * 'local' and 'cloud' are the visitor overruling the structural rules for a
 * single sign-in, and both still fall back to whichever side exists when the
 * other does not — "keep this device" cannot be allowed to mean "delete the
 * save". The uploader used to ignore that choice and re-merge every dirty key,
 * so Keep This Device immediately became Merge Best on the way out.
 */
function applyStrategy(
  entry: StateEntry,
  cloud: unknown,
  local: unknown,
  strategy: MergeStrategy,
): unknown {
  return preserveMonotonicXp(entry, resolve(entry, cloud, local, strategy), cloud);
}

/**
 * How one key's two copies become one.
 *
 * 'local' and 'cloud' are the visitor overruling the structural rules for a
 * single sign-in, and both still fall back to whichever side exists when the
 * other does not — "keep this device" cannot be allowed to mean "delete the
 * save".
 */
function resolve(
  entry: StateEntry,
  cloud: unknown,
  local: unknown,
  strategy: MergeStrategy,
): unknown {
  if (strategy === 'local') return local ?? cloud;
  if (strategy === 'cloud') return cloud ?? local;
  if (cloud === null || cloud === undefined) return local;
  if (local === null || local === undefined) return cloud;
  return (entry.merge ?? mergeDeep)(cloud, local);
}

/**
 * Firestore refuses a `progress/state` write that lowers XP. Keep This Device
 * can still replace every other field; the lifetime XP floor is the one number
 * a stale device is not allowed to delete.
 */
function preserveMonotonicXp(entry: StateEntry, payload: unknown, cloud: unknown): unknown {
  if (entry.key !== PROGRESS_KEY || !isRecord(payload) || !isRecord(cloud)) return payload;
  const cloudXp = typeof cloud['xp'] === 'number' && Number.isFinite(cloud['xp']) ? cloud['xp'] : 0;
  const localXp = typeof payload['xp'] === 'number' && Number.isFinite(payload['xp']) ? payload['xp'] : 0;
  if (localXp >= cloudXp) return payload;
  const current = payload as unknown as ProgressState;
  // aether + nox always sum to xp. Put the floor delta on aether so the
  // split stays a valid progression blob rather than a rank with no energy.
  return withLevel({ ...current, xp: cloudXp, aether: current.aether + (cloudXp - localXp) });
}

/** The document body for a payload — wrapped, except for progression. */
function envelope(entry: StateEntry, payload: unknown): Record<string, unknown> {
  if (entry.enveloped) return wrapBlob(payload) as unknown as Record<string, unknown>;
  return stripUndefined(payload) as Record<string, unknown>;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function readDeviceId(): string {
  try {
    return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * A payload serialised for comparison, with its volatile fields removed.
 *
 * Used only to answer "are these two the same save?". Never written — the
 * timestamps it drops are real fields that belong in the document.
 */
function stable(entry: StateEntry, value: unknown): string {
  if (!entry.volatile || !isRecord(value)) return JSON.stringify(value) ?? 'null';
  const copy: Record<string, unknown> = { ...value };
  for (const field of entry.volatile) delete copy[field];
  return JSON.stringify(copy) ?? 'null';
}
