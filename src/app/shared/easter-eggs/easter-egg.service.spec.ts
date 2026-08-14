import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { EasterEggService, EGGS_FOUND_KEY, PUBLIC_CODEX_EGGS } from './easter-egg.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { FirestoreCacheService } from '../firestore-cache.service';

describe('EasterEggService public totals', () => {
  let store: Map<string, string>;
  let eggs: EasterEggService;

  beforeEach(() => {
    store = new Map();
    TestBed.configureTestingModule({
      providers: [
        EasterEggService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (key: string) => store.get(key) ?? null,
            write: (key: string, value: unknown) => store.set(key, JSON.stringify(value)),
          },
        },
        { provide: LocalSaveRegistry, useValue: { register: () => undefined } },
        { provide: LazyFirestoreService, useValue: { get: async () => null } },
        { provide: FirestoreCacheService, useValue: {} },
      ],
    });
    eggs = TestBed.inject(EasterEggService);
  });

  it('does not let hidden tool eggs make found exceed total on a public drop', async () => {
    const legacy = [
      'json-inception',
      'b64-mirror',
      'regex-master',
      'shadow-lord',
      ...Array.from({ length: 76 }, (_, i) => `legacy-tool-${i}`),
    ];
    store.set(EGGS_FOUND_KEY, JSON.stringify(legacy));

    await eggs.init();
    await eggs.trigger('codex-archivist');

    const drop = eggs.discovery$.value;
    expect(drop).toBeTruthy();
    expect(drop!.egg.id).toBe('codex-archivist');
    expect(drop!.totalFound).toBe(eggs.foundCount);
    expect(drop!.totalEggs).toBe(eggs.totalEggs);
    expect(drop!.totalEggs).toBe(PUBLIC_CODEX_EGGS.length);
    expect(drop!.totalFound).toBeLessThanOrEqual(drop!.totalEggs);
    expect(eggs.discoveredCount).toBeGreaterThan(drop!.totalFound);
  });
});
