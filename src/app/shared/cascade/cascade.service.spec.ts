import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { GAMES_KEY, mergeGamesLedgers, type GamesLedger } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { seededRng } from '../games/seeded-rng';
import { ECLIPSE_CASCADE, ORRERY_TUMBLER, playCascade } from './cascade.model';
import { CascadeService } from './cascade.service';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('CascadeService', () => {
  let memory: MemoryGateway;

  /** A fresh app on the same save (a reload). */
  function boot(): { cascade: CascadeService; economy: EconomyService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CascadeService, PlayLedgerService, EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }],
    });
    const economy = TestBed.inject(EconomyService);
    economy.init();
    const cascade = TestBed.inject(CascadeService);
    cascade.init();
    return { cascade, economy };
  }

  function pin(secret: string, gold: number): void {
    memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
    memory.write(GAMES_KEY, { version: 1, secret, nonce: 0, plays: {}, totals: {} });
  }

  beforeEach(() => { memory = new MemoryGateway(); });

  it('a seeded cascade with a multiplier spot pays exactly its win, once, across a reload', () => {
    pin('e2e-cascade-241', 1_000);
    const expected = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-241:0'), 10);
    expect(expected.base.steps.some(s => s.wins.some(w => w.mult >= 2))).toBeTrue();
    let { cascade, economy } = boot();
    const res = cascade.spin(ECLIPSE_CASCADE.id, 'press-1', 10);
    expect(res.ok).toBeTrue();
    if (!res.ok) return;
    expect(res.record.win).toBe(expected.win);
    expect(res.record.paid).toBeTrue();
    expect(economy.snapshot.gold).toBe(1_000 - 10 + expected.win);
    // The same press again (a double tap, a retry) pays nothing.
    expect(cascade.spin(ECLIPSE_CASCADE.id, 'press-1', 10)).toEqual(jasmine.objectContaining({ ok: true, replay: true }));
    expect(economy.snapshot.gold).toBe(1_000 - 10 + expected.win);
    // Reload: the play is on record, paid, and nothing moves.
    ({ cascade, economy } = boot());
    expect(economy.snapshot.gold).toBe(1_000 - 10 + expected.win);
    const again = cascade.spin(ECLIPSE_CASCADE.id, 'press-1', 10);
    expect(again.ok && again.replay).toBeTrue();
    expect(economy.snapshot.gold).toBe(1_000 - 10 + expected.win);
    const stored = (memory.read(GAMES_KEY) as GamesLedger).plays['press-1'];
    expect(stored.win).toBe(expected.win);
    // The film is re-derived from the stored seed, and it is the same play.
    expect(cascade.replay(stored as never)?.win).toBe(expected.win);
  });

  it('a seeded bonus triggers and pays its whole round at once', () => {
    pin('e2e-cascade-402', 1_000);
    const expected = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-402:0'), 10);
    expect(expected.bonus?.kind).toBe('free');
    const { cascade, economy } = boot();
    const res = cascade.spin(ECLIPSE_CASCADE.id, 'press-bonus', 10);
    expect(res.ok && res.record.outcome.bonus?.kind).toBe('free');
    expect(economy.snapshot.gold).toBe(1_000 - 10 + expected.win);
  });

  it('refuses a bet off the ladder or over the cap, and a short purse, and moves no Gold', () => {
    pin('x', 5);
    const { cascade, economy } = boot();
    expect(cascade.spin(ECLIPSE_CASCADE.id, 'a', 15)).toEqual({ ok: false, code: 'bet' });
    expect(cascade.spin(ECLIPSE_CASCADE.id, 'b', 10)).toEqual({ ok: false, code: 'funds' });
    expect(economy.snapshot.gold).toBe(5);
  });

  it('the Orrery Tumbler is found once (merge-safe), and plays on its own ledger line', () => {
    pin('e2e-tumbler-10', 1_000);
    let { cascade } = boot();
    expect(cascade.found(ORRERY_TUMBLER.id)).toBeFalse();
    expect(cascade.find(ORRERY_TUMBLER.id)).toBeTrue();
    expect(cascade.find(ORRERY_TUMBLER.id)).toBeFalse();
    ({ cascade } = boot());
    expect(cascade.found(ORRERY_TUMBLER.id)).toBeTrue();
    const expected = playCascade(ORRERY_TUMBLER, seededRng('e2e-tumbler-10:0'), 10);
    const res = cascade.spin(ORRERY_TUMBLER.id, 'tumble-1', 10);
    expect(res.ok && res.record.win).toBe(expected.win);
    expect(TestBed.inject(PlayLedgerService).totals(ORRERY_TUMBLER.id).plays).toBe(1);
    // A cloud merge keeps a found machine found, the earlier time winning.
    const local = memory.read(GAMES_KEY) as GamesLedger;
    const merged = mergeGamesLedgers({ ...local, found: { [ORRERY_TUMBLER.id]: '2020-01-01T00:00:00.000Z' } }, local);
    expect(merged.found?.[ORRERY_TUMBLER.id]).toBe('2020-01-01T00:00:00.000Z');
    expect(mergeGamesLedgers({ version: 1, secret: '', nonce: 0, plays: {}, totals: {} }, local).found?.[ORRERY_TUMBLER.id]).toBeTruthy();
  });
});
