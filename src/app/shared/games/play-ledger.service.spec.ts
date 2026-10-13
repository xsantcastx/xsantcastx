import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { GAMES_KEY, type GamesLedger } from './play-ledger';
import { PlayLedgerService, type ChanceGame } from './play-ledger.service';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** Pays the draw × 10 × bet in Gold, and counts how often its prizes are handed over. */
function coinGame(): ChanceGame<{ x: number; win: number }> & { paid: string[] } {
  const paid: string[] = [];
  return {
    id: 'coin',
    paid,
    resolve: (rng, bet) => { const x = rng(); return { x, win: Math.floor(x * 10) * bet }; },
    winOf: o => o.win,
    pay: (_o, id) => { paid.push(id); },
  };
}

function setup(memory: MemoryGateway, gold: number): { ledger: PlayLedgerService; economy: EconomyService } {
  memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
  TestBed.configureTestingModule({
    providers: [PlayLedgerService, EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const ledger = TestBed.inject(PlayLedgerService);
  ledger.init();
  return { ledger, economy };
}

describe('PlayLedgerService', () => {
  let memory: MemoryGateway;
  beforeEach(() => {
    TestBed.resetTestingModule();
    memory = new MemoryGateway();
  });

  it('debits the bet, pays the stored outcome and records it with its seed', () => {
    const { ledger, economy } = setup(memory, 1_000);
    const game = coinGame();
    const res = ledger.play(game, 'm1', 10);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.replay).toBeFalse();
    expect(res.record.paid).toBeTrue();
    expect(res.record.seed).toMatch(/^[0-9a-f]{32}:0$/);
    expect(economy.snapshot.gold).toBe(1_000 - 10 + res.record.win);
    expect(game.paid).toEqual(['m1']);
    const stored = JSON.parse(memory.readRaw(GAMES_KEY)!) as GamesLedger;
    expect(stored.plays['m1'].outcome).toEqual(res.record.outcome);
    expect(stored.nonce).toBe(1);
  });

  it('is idempotent: the same mutation id never re-rolls and never pays twice', () => {
    const { ledger, economy } = setup(memory, 1_000);
    const game = coinGame();
    const first = ledger.play(game, 'm1', 10);
    const after = economy.snapshot.gold;
    const again = ledger.play(game, 'm1', 10);
    expect(again.ok && again.replay).toBeTrue();
    if (!first.ok || !again.ok) return;
    expect(again.record.outcome).toEqual(first.record.outcome);
    expect(economy.snapshot.gold).toBe(after);
    expect(game.paid).toEqual(['m1']);
    expect(ledger.totals('coin').plays).toBe(1);
  });

  it('survives a reload: a fresh service reading the same save does not re-pay', () => {
    const { ledger, economy } = setup(memory, 1_000);
    const game = coinGame();
    ledger.play(game, 'm1', 10);
    const after = economy.snapshot.gold;
    TestBed.resetTestingModule();
    const reloaded = setup(new MemoryGatewayFrom(memory), after);
    const again = reloaded.ledger.play(game, 'm1', 10);
    expect(again.ok && again.replay).toBeTrue();
    expect(reloaded.economy.snapshot.gold).toBe(after);
    expect(game.paid).toEqual(['m1']);
  });

  it('settles a play stored unpaid exactly once', () => {
    const game = coinGame();
    const blob: GamesLedger = {
      version: 1, secret: 'k', nonce: 1, totals: {},
      plays: { pending: { game: 'coin', bet: 10, seed: 'k:0', seq: 0, at: '', win: 50, outcome: { x: 0.5, win: 50 }, paid: false } },
    };
    memory.write(GAMES_KEY, blob);
    const again = setup(memory, 1_000);
    again.ledger.play(game, 'pending', 10);
    again.ledger.play(game, 'pending', 10);
    expect(again.economy.snapshot.gold).toBe(1_050);
    expect(game.paid).toEqual(['pending']);
  });

  it('draws the next seed from secret:nonce, so a pinned save replays a known outcome', () => {
    memory.write(GAMES_KEY, { version: 1, secret: 'pinned', nonce: 7, plays: {}, totals: {} });
    const a = setup(memory, 1_000).ledger.play(coinGame(), 'x', 10);
    TestBed.resetTestingModule();
    const other = new MemoryGateway();
    other.write(GAMES_KEY, { version: 1, secret: 'pinned', nonce: 7, plays: {}, totals: {} });
    const b = setup(other, 1_000).ledger.play(coinGame(), 'y', 10);
    expect(a.ok && b.ok).toBeTrue();
    if (!a.ok || !b.ok) return;
    expect(a.record.seed).toBe('pinned:7');
    expect(b.record.outcome).toEqual(a.record.outcome);
  });

  it('refuses a bet it cannot afford or over the cap, and charges nothing', () => {
    const { ledger, economy } = setup(memory, 5);
    const game = coinGame();
    const poor = ledger.play(game, 'm1', 10);
    expect(poor.ok ? null : poor.code).toBe('funds');
    const over = ledger.play(game, 'm2', 1_000);
    expect(over.ok ? null : over.code).toBe('bet');
    const odd = ledger.play(game, 'm3', 15);
    expect(odd.ok ? null : odd.code).toBe('bet');
    expect(economy.snapshot.gold).toBe(5);
    expect(game.paid).toEqual([]);
    expect(ledger.record('m1')).toBeNull();
  });
});

/** A second gateway over the same stored bytes: what a reload sees. */
class MemoryGatewayFrom extends MemoryGateway {
  constructor(from: MemoryGateway) {
    super();
    for (const [k, v] of from.bag) this.bag.set(k, v);
  }
}
