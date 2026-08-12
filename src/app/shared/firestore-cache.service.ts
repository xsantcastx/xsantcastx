/**
 * firestore-cache.service.ts — a read-through localStorage cache for Firestore.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Firestore bills per document returned, and almost every read this site makes
 * is for a number that nobody is watching change: how many people have opened a
 * tool, how many have found an egg, how many have visited the site at all. Those
 * are decorations. Re-fetching them on every page view — which is what the site
 * did — spends the read budget on re-deriving a value that was already correct.
 *
 * The rule this service encodes: a read whose answer is allowed to be a few
 * minutes stale should be paid for a few times an hour, not a few times a
 * minute. The TTL is where each caller states how stale it is willing to be.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY localStorage AND NOT AN IN-MEMORY MAP
 * ─────────────────────────────────────────────────────────────────────────────
 * An in-memory cache dies with the tab, and the expensive pattern here is not
 * one visitor reading the same counter twice in one session — it is the same
 * visitor opening six tool pages over an afternoon, each a fresh Angular
 * bootstrap. Only a cache that outlives the page load collapses those.
 *
 * Firestore's own SDK persistence is the obvious alternative and does not fit:
 * it caches documents for offline reads, but `getDoc` still goes to the server
 * for a fresh copy unless you ask for `getDocFromCache`, and reasoning about
 * which of the two you got is harder than owning the TTL outright.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAILURE IS A CACHE HIT
 * ─────────────────────────────────────────────────────────────────────────────
 * When the loader throws, {@link through} serves the expired entry rather than
 * propagating. A counter that is an hour stale is strictly better than a counter
 * that renders as a dash, and every consumer of this cache is displaying a
 * number whose exact value nobody can verify by eye anyway. Callers that
 * genuinely need to know a read failed pass `stale: false`.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from } from 'rxjs';

/**
 * Bumping this abandons every entry written by an older build in one move.
 *
 * Cheaper and more honest than migrating cached payloads: the entries are all
 * re-derivable from Firestore, so the correct response to a shape change is to
 * drop them, not to teach the reader every shape the site has ever written.
 */
const NAMESPACE = 'fs-cache:v1:';

/** How an entry is stored. `w` is the write time, kept for "last updated" UI. */
interface CacheEnvelope<T> {
  /** The cached payload. */
  data: T;
  /** Epoch ms after which `data` is stale. */
  expiresAt: number;
  /** Epoch ms the entry was written. */
  w: number;
}

export interface ThroughOptions {
  /**
   * Serve an expired entry when the loader throws. Default true — see the note
   * at the top. Set false when a caller must distinguish "failed" from "old".
   */
  stale?: boolean;
  /** Skip the cached value and force the loader to run. The result is cached. */
  force?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FirestoreCacheService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * De-duplicates concurrent loads of the same key within one page.
   *
   * Without it, a page that mounts three components reading the same counter on
   * a cold cache fires three identical `getDoc`s before any of them has written
   * a result — the exact cost this service exists to remove, reintroduced at a
   * smaller scale. Entries are removed as they settle, so this never grows.
   */
  private readonly inflight = new Map<string, Promise<unknown>>();

  /** Expired-entry sweep runs once per page, lazily. */
  private swept = false;

  // ───────────────────────────────────────────────────────────────────────────
  // The main entry point
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return the cached value for `key`, or run `loader` and cache what it gives.
   *
   * `loader` is only ever called on a miss, so a caller can put its Firestore
   * read inside one of these and stop thinking about how often it runs.
   */
  async through<T>(
    key: string,
    ttlMinutes: number,
    loader: () => Promise<T>,
    options: ThroughOptions = {},
  ): Promise<T> {
    // On the server there is no localStorage and no second page load to amortise
    // a write into, so the cache is a no-op and the loader is the whole story.
    if (!this.isBrowser) return loader();

    const { stale = true, force = false } = options;
    this.sweepOnce();

    const envelope = this.envelope<T>(key);
    if (!force && envelope !== null && Date.now() < envelope.expiresAt) {
      return envelope.data;
    }

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const run = loader()
      .then(value => {
        this.set(key, value, ttlMinutes);
        return value;
      })
      .catch(err => {
        // An expired entry is still a better answer than an exception.
        if (stale && envelope !== null) return envelope.data;
        throw err;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, run);
    return run;
  }

  /**
   * {@link through} keyed by document path — the shape most callers want.
   *
   * `loader` still does the actual read, because this service deliberately does
   * not depend on the Firestore SDK: every consumer already holds a
   * `LazyFirestoreService` handle, and importing the SDK here would drag 450 kB
   * back into whatever chunk this lands in.
   */
  readDoc<T>(
    collection: string,
    docId: string,
    ttlMinutes: number,
    loader: () => Promise<T>,
    options?: ThroughOptions,
  ): Promise<T> {
    return this.through(`${collection}/${docId}`, ttlMinutes, loader, options);
  }

  /** {@link through} as an Observable, for callers already in a stream. */
  read$<T>(
    key: string,
    ttlMinutes: number,
    loader: () => Promise<T>,
    options?: ThroughOptions,
  ): Observable<T> {
    return from(this.through(key, ttlMinutes, loader, options));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Direct access
  // ───────────────────────────────────────────────────────────────────────────

  /** The cached value if it exists and is fresh, else null. */
  get<T>(key: string): T | null {
    const envelope = this.envelope<T>(key);
    if (envelope === null) return null;
    return Date.now() < envelope.expiresAt ? envelope.data : null;
  }

  /** The cached value even if expired — for optimistic paint before a refresh. */
  getStale<T>(key: string): T | null {
    return this.envelope<T>(key)?.data ?? null;
  }

  /** When `key` was last written, for "last updated" UI. Null if never. */
  writtenAt(key: string): number | null {
    return this.envelope(key)?.w ?? null;
  }

  set<T>(key: string, value: T, ttlMinutes: number): void {
    if (!this.isBrowser) return;
    const envelope: CacheEnvelope<T> = {
      data: value,
      expiresAt: Date.now() + ttlMinutes * 60_000,
      w: Date.now(),
    };

    let payload: string;
    try {
      payload = JSON.stringify(envelope);
    } catch {
      // Something non-serialisable (a Firestore Timestamp with a cycle, a class
      // instance). Not cacheable, and not worth failing the caller's read over.
      return;
    }

    try {
      localStorage.setItem(NAMESPACE + key, payload);
    } catch {
      // Quota, or private mode. Drop everything this service owns and try once
      // more: the entries are all re-derivable, and a cache that has filled up
      // and then silently stops caching is the worst of both worlds.
      this.clearAll();
      try {
        localStorage.setItem(NAMESPACE + key, payload);
      } catch {
        // Private mode. Reads still work, they just cost what they used to.
      }
    }
  }

  /** Forget one key, so the next read goes to the network. */
  bust(key: string): void {
    if (!this.isBrowser) return;
    this.inflight.delete(key);
    try {
      localStorage.removeItem(NAMESPACE + key);
    } catch { /* private mode */ }
  }

  /** Forget every key under a prefix — e.g. one collection, or one uid. */
  bustPrefix(prefix: string): void {
    if (!this.isBrowser) return;
    for (const key of this.ownKeys()) {
      if (key.slice(NAMESPACE.length).startsWith(prefix)) {
        try { localStorage.removeItem(key); } catch { /* private mode */ }
      }
    }
    for (const key of [...this.inflight.keys()]) {
      if (key.startsWith(prefix)) this.inflight.delete(key);
    }
  }

  /** Drop everything this service owns. Leaves the rest of localStorage alone. */
  clearAll(): void {
    if (!this.isBrowser) return;
    for (const key of this.ownKeys()) {
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────────────

  private envelope<T>(key: string): CacheEnvelope<T> | null {
    if (!this.isBrowser) return null;
    let raw: string | null;
    try {
      raw = localStorage.getItem(NAMESPACE + key);
    } catch {
      return null;
    }
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      // A truncated or hand-edited entry must not be able to poison a read.
      if (typeof parsed?.expiresAt !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Drop expired entries once per page load.
   *
   * Expired entries are otherwise immortal: nothing revisits a key that a
   * consumer has stopped reading, so a tool the visitor opened once would keep
   * its counter forever. This is what keeps the cache from being the thing that
   * fills the quota it then has to clear.
   */
  private sweepOnce(): void {
    if (this.swept) return;
    this.swept = true;

    const now = Date.now();
    for (const key of this.ownKeys()) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
        // An entry with no expiry is malformed; treat it as expired.
        if (typeof parsed?.expiresAt !== 'number' || now >= parsed.expiresAt) {
          localStorage.removeItem(key);
        }
      } catch {
        // Unparseable — remove it rather than leave it to fail every read.
        try { localStorage.removeItem(key); } catch { /* private mode */ }
      }
    }
  }

  /**
   * Every localStorage key this service owns.
   *
   * Snapshotted before any removal, because `localStorage.key(i)` re-indexes as
   * entries are deleted and iterating it live skips half of them.
   */
  private ownKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null && key.startsWith(NAMESPACE)) keys.push(key);
      }
    } catch {
      return [];
    }
    return keys;
  }
}

/** TTLs in minutes, stated once so the same value is not guessed twice. */
export const CACHE_TTL = {
  /** Global counters nobody watches change. */
  counters: 60,
  /** Site visit total — displayed, never acted on. */
  visits: 30,
  /** Dev-log / changelog entries. */
  changelog: 60,
  /** Admin dashboard panels, refreshable by hand. */
  admin: 5,
  /** Cloud save blobs. Short: this one is progression, not decoration. */
  cloudSave: 5,
} as const;
