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
};

export function eraIsCurrent(store: Pick<EraStore, 'readRaw'>): boolean {
  return store.readRaw(REALM_ERA_KEY) === String(REALM_ERA);
}

export function ledgerFromPriorEra(era: number | undefined | null): boolean {
  return (era ?? 0) < REALM_ERA;
}

export function applyRealmEra(store: EraStore): void {
  if (eraIsCurrent(store)) return;
  store.remove('godforge-inventory');
  store.remove('godforge-stats');
  store.remove('godforge-activity');
  store.writeRaw(REALM_ERA_KEY, String(REALM_ERA));
}
