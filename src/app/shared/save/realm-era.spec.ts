import { emptyInventoryLedger } from '../rpg/inventory-ops';
import { applyRealmEra, eraIsCurrent, ledgerFromPriorEra, REALM_ERA, REALM_ERA_KEY } from './realm-era';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
  }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('realm era 55 wipe', () => {
  it('empties bag, stats, and ore once, then ignores a second boot', () => {
    const store = new MemoryGateway();
    store.write('godforge-inventory', emptyInventoryLedger());
    store.writeRaw('godforge-stats', '{"version":1,"stats":{"luck":9}}');
    store.writeRaw('godforge-activity', '{"version":1,"operations":[{"id":"old"}]}');
    applyRealmEra(store);
    expect(store.readRaw('godforge-inventory')).toBeNull();
    expect(store.readRaw('godforge-stats')).toBeNull();
    expect(store.readRaw('godforge-activity')).toBeNull();
    expect(eraIsCurrent(store)).toBe(true);
    expect(store.readRaw(REALM_ERA_KEY)).toBe(String(REALM_ERA));

    store.writeRaw('godforge-inventory', '{"version":2,"records":[]}');
    applyRealmEra(store);
    expect(store.readRaw('godforge-inventory')).toBe('{"version":2,"records":[]}');
  });

  it('treats a missing era as prior-generation', () => {
    expect(ledgerFromPriorEra(undefined)).toBe(true);
    expect(ledgerFromPriorEra(0)).toBe(true);
    expect(ledgerFromPriorEra(REALM_ERA)).toBe(false);
  });
});
