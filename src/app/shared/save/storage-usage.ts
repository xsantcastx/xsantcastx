/**
 * storage-usage.ts — how full this device's localStorage is. Pure apart from
 * the one `Storage` it is handed, so the node budget test and the runtime
 * monitor measure the same way.
 *
 * Bytes are counted as browsers count them: UTF-16, two bytes per code unit,
 * key and value both (WebKit's 5 MB origin quota is measured exactly so, and
 * it is the tightest of the engines — Chromium allows 5 M code units). So the
 * quota below is the iPhone's, which is the device a heavy player hit first.
 */

/** localStorage quota per origin, in UTF-16 bytes (WebKit / mobile Safari). */
export const LOCAL_QUOTA_BYTES = 5 * 1024 * 1024;
/** Past this share of the quota the game says so, once, gently. */
export const LOCAL_PRESSURE_SHARE = 0.8;
/**
 * What a year of heavy play may cost in localStorage (the budget the node test
 * pins: scripts/storage-budget.test.cjs). 40% of the quota: the year it models
 * holds 200 pieces of gear, a full tombstone list and all 32 Delve region slots
 * dug, and comes to ~1.6 MB, so the rest of the site and the merge backup
 * still have 3 MB between them and the ceiling.
 */
export const LOCAL_BUDGET_BYTES = 2 * 1024 * 1024;

export interface StorageUsage {
  /** Total bytes (UTF-16) across every key. */
  bytes: number;
  /** Bytes per key, largest first. */
  keys: { key: string; bytes: number }[];
}

/** Bytes one entry costs. */
export function entryBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

/** Measure a Storage (or anything shaped like one). Never throws. */
export function measureStorage(store: Pick<Storage, 'length' | 'key' | 'getItem'> | null | undefined): StorageUsage {
  const keys: { key: string; bytes: number }[] = [];
  let bytes = 0;
  if (!store) return { bytes, keys };
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key === null) continue;
      const size = entryBytes(key, store.getItem(key) ?? '');
      keys.push({ key, bytes: size });
      bytes += size;
    }
  } catch { /* private mode or a revoked store: report what was read */ }
  keys.sort((a, b) => b.bytes - a.bytes);
  return { bytes, keys };
}

/** True when usage is past the gentle-notice line. */
export function underPressure(usage: Pick<StorageUsage, 'bytes'>, quota = LOCAL_QUOTA_BYTES): boolean {
  return usage.bytes >= quota * LOCAL_PRESSURE_SHARE;
}
