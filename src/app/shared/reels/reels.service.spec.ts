import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { GAMES_KEY } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { seededRng } from '../games/seeded-rng';
import { playReels } from './reels.model';
import { ReelsService } from './reels.service';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** The first nonce under `secret` whose play at `bet` hands over a prize of `kind`. */
function nonceWithPrize(secret: string, bet: number, kind: 'material' | 'rune'): number {
  for (let n = 0; n < 200_000; n++) {
    if (playReels(seededRng(`${secret}:${n}`), bet).prizes.some(p => p.kind === kind)) return n;
  }
  throw new Error('no prize found');
}

describe('ReelsService', () => {
  let memory: MemoryGateway;
  let grantStack: jasmine.Spy;
  let grant: jasmine.Spy;

  function setup(gold: number): { reels: ReelsService; economy: EconomyService } {
    memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
    grantStack = jasmine.createSpy('grantStack').and.returnValue(true);
    grant = jasmine.createSpy('grant').and.returnValue(null);
    TestBed.configureTestingModule({
      providers: [
        ReelsService, PlayLedgerService, EconomyService, LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
        { provide: InventoryService, useValue: { init: () => undefined, grantStack } },
        { provide: RuneForgeService, useValue: { init: () => undefined, grant } },
      ],
    });
    const economy = TestBed.inject(EconomyService);
    economy.init();
    const reels = TestBed.inject(ReelsService);
    reels.init();
    return { reels, economy };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    memory = new MemoryGateway();
  });

  it('hands a material prize to the satchel once, with an idempotent grant id', () => {
    const n = nonceWithPrize('mat', 50, 'material');
    memory.write(GAMES_KEY, { version: 1, secret: 'mat', nonce: n, plays: {}, totals: {} });
    const { reels } = setup(1_000);
    const res = reels.spin('spin-1', 50);
    expect(res.ok).toBeTrue();
    reels.spin('spin-1', 50);
    const materials = res.ok ? res.record.outcome.prizes.filter(p => p.kind === 'material') : [];
    expect(grantStack.calls.count()).toBe(materials.length);
    expect(grantStack.calls.argsFor(0)[0]).toBe('reels:spin-1:' + (res.ok ? res.record.outcome.prizes.findIndex(p => p.kind === 'material') : 0));
    expect(grantStack.calls.argsFor(0)[2]).toBe(1);
  });

  it('banks a rune prize in the Rune Forge ledger once', () => {
    const n = nonceWithPrize('rune', 50, 'rune');
    memory.write(GAMES_KEY, { version: 1, secret: 'rune', nonce: n, plays: {}, totals: {} });
    const { reels } = setup(1_000);
    const res = reels.spin('spin-r', 50);
    reels.spin('spin-r', 50);
    const runes = res.ok ? res.record.outcome.prizes.filter(p => p.kind === 'rune') : [];
    expect(runes.length).toBeGreaterThan(0);
    expect(grant.calls.count()).toBe(runes.length);
    expect(grant.calls.argsFor(0)[0].id).toBe(runes[0].id);
  });

  it('pays the outcome the seed decided, and a replay pays nothing', () => {
    memory.write(GAMES_KEY, { version: 1, secret: 'gold', nonce: 0, plays: {}, totals: {} });
    const { reels, economy } = setup(1_000);
    const expected = playReels(seededRng('gold:0'), 20);
    const res = reels.spin('s', 20);
    expect(res.ok && res.record.outcome).toEqual(expected);
    expect(economy.snapshot.gold).toBe(1_000 - 20 + expected.win);
    reels.spin('s', 20);
    expect(economy.snapshot.gold).toBe(1_000 - 20 + expected.win);
  });
});
