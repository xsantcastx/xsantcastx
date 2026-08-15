import {
  BANK_SEEN_KEY,
  isRareItemTier,
  isRareStack,
  loadSeen,
  markSeen,
  persistSeen,
} from './bank-unseen';

class Memory {
  private readonly bag = new Map<string, string>();
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
}

describe('bank unseen', () => {
  it('seeds existing rows as seen on first boot', () => {
    const store = new Memory();
    const seen = loadSeen(store, ['stack:cinder-ore']);
    expect(seen.has('stack:cinder-ore')).toBe(true);
    expect(store.readRaw(BANK_SEEN_KEY)).toContain('cinder-ore');
    expect(markSeen(seen, 'stack:ember-residue').has('stack:ember-residue')).toBe(true);
  });

  it('keeps an existing seen list so a later ember is NEW', () => {
    const store = new Memory();
    persistSeen(store, ['stack:cinder-ore']);
    const seen = loadSeen(store, ['stack:cinder-ore', 'stack:ember-residue']);
    expect(seen.has('stack:ember-residue')).toBe(false);
  });

  it('treats Ember Residue and rare+ items as special', () => {
    expect(isRareStack('ember-residue')).toBe(true);
    expect(isRareStack('cinder-ore')).toBe(false);
    expect(isRareItemTier('rare')).toBe(true);
    expect(isRareItemTier('common')).toBe(false);
  });
});
