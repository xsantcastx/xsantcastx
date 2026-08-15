import { loadSeen, markSeen, persistSeen, RUNE_SEEN_KEY } from './rune-unseen';

class Memory {
  private readonly bag = new Map<string, string>();
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
}

describe('rune unseen', () => {
  it('seeds existing finds as seen on first boot', () => {
    const store = new Memory();
    const seen = loadSeen(store, ['ash', 'ember']);
    expect(seen.has('ash')).toBe(true);
    expect(store.readRaw(RUNE_SEEN_KEY)).toContain('ash');
    expect(markSeen(seen, 'void').has('void')).toBe(true);
  });

  it('keeps an existing seen list', () => {
    const store = new Memory();
    persistSeen(store, ['ash']);
    const seen = loadSeen(store, ['ash', 'ember']);
    expect(seen.has('ember')).toBe(false);
  });
});
