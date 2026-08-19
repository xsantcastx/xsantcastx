import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CollectionService } from './collection.service';
import {
  COLLECTION_KEY,
  COLLECTION_REWARDS,
  COUNTED_CATALOG,
  type CollectionLedger,
} from './collection.model';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  attached = false;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown {
    const raw = this.bag.get(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function charm(name: string, id = 'c1'): GameItem {
  return {
    id, name, type: 'charm', rarity: 'common', stats: { magicFind: 5 },
    sellValue: 10, equipped: false, foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: false, upgradeLevel: 0,
  };
}

describe('CollectionService', () => {
  let memory: MemoryGateway;
  let collection: CollectionService;
  let economy: EconomyService;
  let inventory: InventoryService;

  function build(): void {
    TestBed.configureTestingModule({
      providers: [
        CollectionService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
    inventory = TestBed.inject(InventoryService);
    inventory.init();
    collection = TestBed.inject(CollectionService);
    collection.init();
  }

  function storedLedger(): CollectionLedger {
    return JSON.parse(memory.bag.get(COLLECTION_KEY)!) as CollectionLedger;
  }

  beforeEach(() => {
    memory = new MemoryGateway();
    memory.writeRaw('godforge-realm-era', '55');
    TestBed.resetTestingModule();
    build();
  });

  describe('recording a find', () => {
    it('announces the first one and stays quiet on the second', () => {
      const seen: string[] = [];
      collection.discovery$.subscribe(d => seen.push(d.entry.id));

      const first = collection.discover('ash');
      expect(first).toBeTruthy();
      expect(first!.entry.name).toBe('Ash');
      expect(collection.countOf('ash')).toBe(1);

      const second = collection.discover('ash');
      expect(second).toBeNull();
      expect(collection.countOf('ash')).toBe(2);
      expect(seen).toEqual(['ash']);
    });

    it('adds the whole quantity a single grant landed', () => {
      collection.discover('cinder-ore', 7);
      expect(collection.countOf('cinder-ore')).toBe(7);
    });

    it('never moves the first-found date once it is set', () => {
      collection.discover('ash', 1, 1_000);
      collection.discover('ash', 1, 9_000);
      expect(storedLedger().entries['ash'].firstDiscoveredAt).toBe(1_000);
    });

    it('lets a real date fill in a record that was backfilled without one', () => {
      collection.discover('ash', 1, 0);
      expect(storedLedger().entries['ash'].firstDiscoveredAt).toBe(0);
      collection.discover('ash', 1, 4_000);
      expect(storedLedger().entries['ash'].firstDiscoveredAt).toBe(4_000);
    });

    it('ignores an id that is not in the catalogue rather than storing a ghost', () => {
      expect(collection.discover('not-a-thing')).toBeNull();
      expect(collection.has('not-a-thing')).toBe(false);
      expect(storedLedger().entries['not-a-thing']).toBeUndefined();
    });

    it('survives a reload with the same ledger', () => {
      collection.discover('ash', 3, 1_234);
      TestBed.resetTestingModule();
      build();
      expect(collection.countOf('ash')).toBe(3);
      expect(collection.completion.found).toBe(1);
    });
  });

  describe('rewards', () => {
    /** Fill the log to `percent` and let the thresholds settle. */
    function fillTo(percent: number): void {
      const need = Math.ceil((percent / 100) * COUNTED_CATALOG.length);
      for (const entry of COUNTED_CATALOG.slice(0, need)) collection.discover(entry.id);
    }

    it('pays nothing before the first threshold', () => {
      collection.discover('ash');
      expect(storedLedger().rewards).toEqual([]);
    });

    it('pays the Apprentice tier once, in Gold and in a real title', () => {
      const paid: string[] = [];
      collection.reward$.subscribe(r => paid.push(r.id));
      const goldBefore = economy.snapshot.gold;

      fillTo(25);

      expect(paid).toContain('collector-apprentice');
      expect(storedLedger().rewards).toContain('collector-apprentice');
      expect(economy.snapshot.gold).toBeGreaterThanOrEqual(goldBefore + 10_000);
      expect(economy.ownsCosmetic('title-prefix')).toBe(true);
      expect(economy.equippedIn('prefix')).toBe('apprentice-collector');
    });

    it('does not pay the same threshold twice across a reload', () => {
      fillTo(25);
      const goldAfterFirst = economy.snapshot.gold;

      TestBed.resetTestingModule();
      build();
      const paid: string[] = [];
      collection.reward$.subscribe(r => paid.push(r.id));
      collection.discover('void');

      expect(paid).toEqual([]);
      expect(economy.snapshot.gold).toBe(goldAfterFirst);
    });

    /*
     * The 50% tier mints a charm into the bag, which the wiring layer would
     * normally read back as a discovery. It cannot cross a threshold — reward
     * items are outside the denominator — but the guard is what makes that a
     * property of the code rather than of today's catalogue.
     */
    it('mints the Journeyman charm without recursing through its own settlement', () => {
      fillTo(50);
      const rewards = storedLedger().rewards;
      expect(rewards).toContain('collector-journeyman');
      expect(inventory.snapshot.items.some(i => i.definitionId === 'sealed-codex-page')).toBe(true);
      // Every threshold at or below 50 paid, and nothing above it.
      expect(rewards).not.toContain('collector-master');
    });

    it('pays every tier on the way to a complete log', () => {
      fillTo(100);
      expect(collection.completion.percent).toBe(100);
      expect(storedLedger().rewards.sort()).toEqual(COLLECTION_REWARDS.map(r => r.id).sort());
      expect(economy.equippedIn('prefix')).toBe('eclipse-archivist');
      expect(economy.equippedIn('trail')).toBe('archivist');
    });
  });

  describe('the one-time backfill', () => {
    /**
     * A brand-new log over whatever else is already in storage.
     *
     * The outer `beforeEach` has already built once, which marks the log
     * backfilled — so these have to drop the log's own blob and rebuild, which
     * is exactly the shape of the real case: a save that predates the feature.
     */
    function freshBuild(): void {
      memory.bag.delete(COLLECTION_KEY);
      TestBed.resetTestingModule();
      build();
    }

    it('credits runes off the rune ledger, dates and all', () => {
      memory.writeRaw('godforge-runes', JSON.stringify({
        version: 1,
        runes: { ash: 4, veil: 1 },
        firstFound: { ash: '2026-01-02T00:00:00.000Z', veil: '2026-03-04T00:00:00.000Z' },
        strikes: 5, goldSpent: 50_000,
      }));
      freshBuild();

      expect(collection.has('ash')).toBe(true);
      expect(collection.countOf('ash')).toBe(4);
      expect(storedLedger().entries['ash'].firstDiscoveredAt)
        .toBe(Date.parse('2026-01-02T00:00:00.000Z'));
      expect(collection.has('veil')).toBe(true);
    });

    it('credits what is in the bag, including material stacks', () => {
      expect(inventory.add(charm('Small Charm of Fortune'))).toBeTruthy();
      expect(inventory.grantStack('g1', 'cinder-ore', 12)).toBe(true);
      freshBuild();

      expect(collection.has('charm-fortune')).toBe(true);
      expect(collection.has('cinder-ore')).toBe(true);
      expect(collection.countOf('cinder-ore')).toBe(12);
    });

    it('credits Runewords and artifacts off the economy ledger', () => {
      expect(economy.grantRuneword('first-light', 'First Light')).toBe(true);
      freshBuild();
      expect(collection.has('first-light')).toBe(true);
    });

    it('runs once and then leaves the ledger alone', () => {
      memory.writeRaw('godforge-runes', JSON.stringify({
        version: 1, runes: { ash: 2 }, firstFound: { ash: '2026-01-02T00:00:00.000Z' },
      }));
      freshBuild();
      expect(collection.countOf('ash')).toBe(2);
      expect(storedLedger().backfilled).toBe(true);

      // A second hydration keeps the log's own blob, and must not credit the
      // same two runes again.
      TestBed.resetTestingModule();
      build();
      expect(collection.countOf('ash')).toBe(2);
    });

    it('treats an unreadable rune ledger as an empty one', () => {
      memory.writeRaw('godforge-runes', '{ not json');
      expect(() => freshBuild()).not.toThrow();
      expect(collection.completion.found).toBe(0);
      expect(storedLedger().backfilled).toBe(true);
    });
  });

  it('wipes to an empty log that does not try to backfill again', () => {
    collection.discover('ash');
    collection.reset();
    expect(collection.completion.found).toBe(0);
    expect(storedLedger().backfilled).toBe(true);
  });
});
