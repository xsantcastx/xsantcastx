/**
 * realm-era.ts — one-shot wipe of bag, allocated stats, and mining ore.
 *
 * PR 55 recasts item rolls and temper. Old instances have no definitionId
 * and old wealth sits behind a new wall. Live clients drop those three
 * ledgers once, then stamp the era so cloud copies without it also empty.
 */
import { INVENTORY_ERA } from '../rpg/inventory.model';

export const REALM_ERA_KEY = 'godforge-realm-era';
export const REALM_ERA = INVENTORY_ERA;

type EraStore = {
  readRaw(key: string): string | null;
  writeRaw(key: string, raw: string): void;
  remove(key: string): void;
  /** Local-only removal (GameStateGateway.discardLocal). Preferred: the wipe is about this browser's copy. */
  discardLocal?(key: string): void;
  cancelPendingDelete?(key: string): void;
};

/** The three ledgers the era-55 wipe empties. */
export const ERA_WIPED_KEYS = ['godforge-inventory', 'godforge-stats', 'godforge-activity'] as const;

export function eraIsCurrent(store: Pick<EraStore, 'readRaw'>): boolean {
  return store.readRaw(REALM_ERA_KEY) === String(REALM_ERA);
}

export function ledgerFromPriorEra(era: number | undefined | null): boolean {
  return (era ?? 0) < REALM_ERA;
}

/**
 * Drop this browser's prior-era copies of the three ledgers, once per character per browser.
 *
 * LOCAL ONLY. Owner, 2026-10-21: "connected my account to another device and in the character screen it said i was
 * level 1". Every browser without the era stamp runs this — a new phone, or any character opened on a device for the
 * first time — and it used to go through `remove()`, which also queues a *cloud* delete. The first sign-in drained
 * that queue before merging, deleting the account's real activity ledger (every point of Hunting XP: the Keeper's
 * level) and stat build. A prior-era cloud copy needs no delete: every owner drops a prior-era ledger on load, and the
 * activity merge takes the higher era whole.
 *
 * The activity ledger is never removed any other way, so a delete of it still queued by an older build of this wipe
 * is cancelled on every boot rather than sent.
 */
export function applyRealmEra(store: EraStore): void {
  store.cancelPendingDelete?.('godforge-activity');
  if (eraIsCurrent(store)) return;
  for (const key of ERA_WIPED_KEYS) {
    if (store.discardLocal) store.discardLocal(key);
    else store.remove(key);
  }
  store.writeRaw(REALM_ERA_KEY, String(REALM_ERA));
}
