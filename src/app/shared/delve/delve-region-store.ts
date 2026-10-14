/**
 * delve-region-store.ts — where this device keeps every region of its endless
 * Delve (docs/world/delve-and-beyond.md §3.4). The 16 most recently changed
 * regions also ride in the cloud slots (delve-save.service.ts); this store is
 * the device's whole copy, slots or not.
 *
 * IndexedDB first: localStorage's ~5 MB per origin is shared by every save
 * blob, and a long explorer could fill it. When IndexedDB is not there (some
 * private modes, old WebViews, a blocked open, SSR) it falls back to one
 * localStorage key written through the gateway (device-only, never synced),
 * capped at LOCAL_CAP characters: past that the oldest regions that are not in
 * a slot are let go, and `degraded` says so (the honest "not all saved" case).
 *
 * Every call resolves; nothing here throws into the game.
 */
import { coerceRegion, regionKey, type DelveRegion } from './delve-region.model';

/** localStorage fallback key (device-only: not in SYNCED_BLOBS). */
export const DELVE_FAR_KEY = 'godforge-delve-far';
const DB_NAME = 'eclipse-delve';
const STORE = 'regions';
/** Most characters the localStorage fallback holds (about 1.5 MB of UTF-16). */
export const LOCAL_CAP = 750_000;

/** The gateway's synchronous surface (the store reads and writes its fallback key through it). */
export interface RawStore { readRaw(key: string): string | null; writeRaw(key: string, raw: string): void }

export interface RegionStore {
  /** Which backing answered: IndexedDB, the localStorage fallback, or memory only. */
  readonly kind: 'idb' | 'local' | 'memory';
  /** True once the fallback had to drop regions to stay under its cap. */
  readonly degraded: boolean;
  load(): Promise<DelveRegion[]>;
  /** Store these regions (replacing the same seed and place). `keep`: keys never dropped by the fallback's cap. */
  put(regions: readonly DelveRegion[], keep?: ReadonlySet<string>): Promise<void>;
}

const idKey = (region: Pick<DelveRegion, 'seed' | 'rx' | 'ry'>) => `${region.seed >>> 0}:${regionKey(region.rx, region.ry)}`;

/** The localStorage fallback: one JSON map through the gateway. */
export class LocalRegionStore implements RegionStore {
  readonly kind: 'local' | 'memory';
  degraded = false;
  private memory = new Map<string, DelveRegion>();
  constructor(private readonly raw: RawStore | null) { this.kind = raw ? 'local' : 'memory'; }
  load(): Promise<DelveRegion[]> {
    if (this.raw) {
      try {
        const text = this.raw.readRaw(DELVE_FAR_KEY);
        const parsed: unknown = text ? JSON.parse(text) : null;
        if (parsed && typeof parsed === 'object') {
          for (const value of Object.values(parsed as Record<string, unknown>)) {
            const region = coerceRegion(value);
            if (region) this.memory.set(idKey(region), region);
          }
        }
      } catch { /* unreadable: start empty */ }
    }
    return Promise.resolve([...this.memory.values()]);
  }
  put(regions: readonly DelveRegion[], keep: ReadonlySet<string> = new Set()): Promise<void> {
    for (const region of regions) this.memory.set(idKey(region), region);
    if (!this.raw) return Promise.resolve();
    let text = JSON.stringify(Object.fromEntries(this.memory));
    // Over the cap: the oldest regions not held by a slot go first.
    while (text.length > LOCAL_CAP) {
      const drop = [...this.memory.entries()].filter(([, r]) => !keep.has(regionKey(r.rx, r.ry))).sort((a, b) => a[1].t - b[1].t)[0];
      if (!drop) break;
      this.memory.delete(drop[0]);
      this.degraded = true;
      text = JSON.stringify(Object.fromEntries(this.memory));
    }
    try { this.raw.writeRaw(DELVE_FAR_KEY, text); } catch { this.degraded = true; }
    return Promise.resolve();
  }
}

/** IndexedDB: one object store, one record per region, keyed `seed:rx_ry`. */
export class IdbRegionStore implements RegionStore {
  readonly kind = 'idb' as const;
  readonly degraded = false;
  private constructor(private readonly db: IDBDatabase) {}
  /** Open the database, or null when IndexedDB is missing or refuses (the caller falls back). */
  static open(factory: IDBFactory | undefined | null, timeoutMs = 3000): Promise<IdbRegionStore | null> {
    return new Promise(resolve => {
      if (!factory) { resolve(null); return; }
      let done = false;
      const finish = (value: IdbRegionStore | null) => { if (!done) { done = true; resolve(value); } };
      const timer = setTimeout(() => finish(null), timeoutMs);
      try {
        const request = factory.open(DB_NAME, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
        request.onsuccess = () => { clearTimeout(timer); finish(new IdbRegionStore(request.result)); };
        request.onerror = () => { clearTimeout(timer); finish(null); };
        request.onblocked = () => { clearTimeout(timer); finish(null); };
      } catch { clearTimeout(timer); finish(null); }
    });
  }
  load(): Promise<DelveRegion[]> {
    return new Promise(resolve => {
      try {
        const request = this.db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        request.onsuccess = () => resolve((request.result as unknown[]).map(coerceRegion).filter((r): r is DelveRegion => !!r));
        request.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }
  put(regions: readonly DelveRegion[]): Promise<void> {
    if (!regions.length) return Promise.resolve();
    return new Promise(resolve => {
      try {
        const tx = this.db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
        for (const region of regions) store.put(region, idKey(region));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
  }
}

/** IndexedDB if it opens, else the localStorage fallback (or memory, with no gateway). */
export async function openRegionStore(raw: RawStore | null, factory: IDBFactory | undefined | null = globalThis.indexedDB): Promise<RegionStore> {
  const idb = await IdbRegionStore.open(factory);
  return idb ?? new LocalRegionStore(raw);
}
