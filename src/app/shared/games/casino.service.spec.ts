/**
 * The Croupier's three steered/dropped games on the real play ledger:
 * Rune Drop (one-shot), Seam Sweeper and Eclipse Ascent (rounds). Replays
 * never pay twice, rounds resume from storage (a "reload" is a fresh
 * TestBed over the same stored blobs), and bets over the cap are refused.
 */
import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { gamesBetCap } from '../economy/economy-curve';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { GAMES_KEY } from './play-ledger';
import { PlayLedgerService } from './play-ledger.service';
import { seededRng } from './seeded-rng';
import { wholeGold } from './rtp-sim';
import { RuneDropService } from '../rune-drop/rune-drop.service';
import { playRuneDrop } from '../rune-drop/rune-drop.model';
import { SeamSweeperService } from '../seam-sweeper/seam-sweeper.service';
import { drawSeam, seamMultiplier } from '../seam-sweeper/seam-sweeper.model';
import { EclipseAscentService } from '../eclipse-ascent/eclipse-ascent.service';
import { ascentAt, drawAscent, msToReach } from '../eclipse-ascent/eclipse-ascent.model';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

interface Rig { economy: EconomyService; drop: RuneDropService; seam: SeamSweeperService; ascent: EclipseAscentService }

/** A fresh app over the stored blobs (the second call is a "reload"). */
function boot(memory: MemoryGateway): Rig {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      PlayLedgerService, EconomyService, LocalSaveRegistry, RuneDropService, SeamSweeperService, EclipseAscentService,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const rig = { economy, drop: TestBed.inject(RuneDropService), seam: TestBed.inject(SeamSweeperService), ascent: TestBed.inject(EclipseAscentService) };
  rig.drop.init();
  rig.seam.init();
  rig.ascent.init();
  return rig;
}

function pin(memory: MemoryGateway, secret: string, gold: number): void {
  memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
  memory.write(GAMES_KEY, { version: 1, secret, nonce: 0, plays: {}, totals: {} });
}

describe('Croupier games on the play ledger', () => {
  let memory: MemoryGateway;
  beforeEach(() => { memory = new MemoryGateway(); });

  describe('Rune Drop', () => {
    it('pays the seeded bin once; a replay pays nothing', () => {
      pin(memory, 'rd', 1_000);
      const { drop, economy } = boot(memory);
      const expected = playRuneDrop(seededRng('rd:0'), 20, 'high', 10);
      const res = drop.drop('d1', 20, 'high', 10);
      expect(res.ok && res.record.outcome).toEqual(expected);
      expect(economy.snapshot.gold).toBe(1_000 - 20 + expected.win);
      expect(drop.drop('d1', 20, 'high', 10).ok).toBeTrue();
      expect(economy.snapshot.gold).toBe(1_000 - 20 + expected.win);
      // and after a reload
      const again = boot(memory);
      again.drop.drop('d1', 20, 'high', 10);
      expect(again.economy.snapshot.gold).toBe(1_000 - 20 + expected.win);
    });

    it('refuses a bet over the cap and a board off the table, charging nothing', () => {
      pin(memory, 'rd', 1_000_000);
      const { drop, economy } = boot(memory);
      // The cap reads the hunt at the Keeper's level and the purse (economy-model rewardRate).
      const over = gamesBetCap(economy.snapshot.rewardPerSecond ?? 0, economy.snapshot.gold) * 10;
      expect(drop.drop('d2', over, 'low', 8)).toEqual({ ok: false, code: 'bet' });
      expect(drop.drop('d3', 10, 'low', 20)).toEqual({ ok: false, code: 'bet' });
      expect(economy.snapshot.gold).toBe(1_000_000);
    });
  });

  describe('Seam Sweeper', () => {
    it('resumes the same seam after a reload, never re-rolls, and pays the cash-out once', () => {
      pin(memory, 'ss', 1_000);
      const layout = drawSeam(seededRng('ss:0'), 3);
      const safe = Array.from({ length: 25 }, (_, i) => i).filter(c => !layout.layout.includes(c));
      let rig = boot(memory);
      const res = rig.seam.start('s1', 50, 3);
      expect(res.ok).toBeTrue();
      expect(rig.economy.snapshot.gold).toBe(950);
      expect(res.ok && res.record.outcome).toEqual(layout);
      rig.seam.dig('s1', safe[0]);
      // reload mid-round
      rig = boot(memory);
      const open = rig.seam.current();
      expect(open?.id).toBe('s1');
      expect(open?.outcome).toEqual(layout);
      expect(open?.state?.dug).toEqual([safe[0]]);
      expect(rig.seam.start('s2', 50, 3)).toEqual({ ok: false, code: 'bet' });
      rig.seam.dig('s1', safe[1]);
      const done = rig.seam.cashOut('s1');
      const win = wholeGold(50 * seamMultiplier(3, 2), layout.u);
      expect(done?.win).toBe(win);
      expect(rig.economy.snapshot.gold).toBe(950 + win);
      expect(rig.seam.cashOut('s1')).toBeNull();
      rig = boot(memory);
      expect(rig.seam.current()).toBeNull();
      expect(rig.seam.cashOut('s1')).toBeNull();
      expect(rig.seam.dig('s1', safe[2])).toBeNull();
      expect(rig.economy.snapshot.gold).toBe(950 + win);
    });

    it('a collapse closes the round lost; cashing out before any ore is refused', () => {
      pin(memory, 'sc', 1_000);
      const layout = drawSeam(seededRng('sc:0'), 5);
      const rig = boot(memory);
      rig.seam.start('c1', 50, 5);
      expect(rig.seam.cashOut('c1')).toBeNull();
      const lost = rig.seam.dig('c1', layout.layout[0]);
      expect(lost?.open).toBeUndefined();
      expect(lost?.paid).toBeTrue();
      expect(lost?.win).toBe(0);
      expect(lost?.state?.hit).toBe(layout.layout[0]);
      expect(rig.economy.snapshot.gold).toBe(950);
    });

    it('finding every ore cashes out by itself', () => {
      pin(memory, 'sa', 1_000);
      const layout = drawSeam(seededRng('sa:0'), 24);
      const rig = boot(memory);
      rig.seam.start('a1', 10, 24);
      const ore = Array.from({ length: 25 }, (_, i) => i).find(c => !layout.layout.includes(c))!;
      const done = rig.seam.dig('a1', ore);
      expect(done?.paid).toBeTrue();
      expect(done?.win).toBe(wholeGold(10 * seamMultiplier(24, 1), layout.u));
    });
  });

  describe('Eclipse Ascent', () => {
    /** The first nonce under `secret` whose break point is at least `x`. */
    function nonceHolding(secret: string, x: number): number {
      for (let n = 0; n < 10_000; n++) if (drawAscent(seededRng(`${secret}:${n}`)).crash >= x) return n;
      throw new Error('none');
    }

    it('cash-out math: pays bet × the multiplier seen, once; never above the clock', () => {
      const n = nonceHolding('ea', 300);
      memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold: 1_000 }));
      memory.write(GAMES_KEY, { version: 1, secret: 'ea', nonce: n, plays: {}, totals: {} });
      const o = drawAscent(seededRng(`ea:${n}`));
      const rig = boot(memory);
      let now = 1_000_000;
      rig.ascent.now = () => now;
      rig.ascent.launch('e1', 50, 0);
      now += msToReach(200) + 1;
      // Claiming ×2.80 while the clock says ×2.00 pays ×2.00.
      const done = rig.ascent.cashOut('e1', 280);
      expect(done?.state?.cashedAt).toBe(ascentAt(now - 1_000_000));
      expect(done?.win).toBe(wholeGold((50 * done!.state!.cashedAt!) / 100, o.u));
      const gold = rig.economy.snapshot.gold;
      expect(rig.ascent.cashOut('e1', 200)?.paid).toBeTrue();
      expect(rig.economy.snapshot.gold).toBe(gold);
    });

    it('a reload resumes on the clock: an auto target reached while away pays, once', () => {
      const n = nonceHolding('eb', 150);
      memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold: 1_000 }));
      memory.write(GAMES_KEY, { version: 1, secret: 'eb', nonce: n, plays: {}, totals: {} });
      const o = drawAscent(seededRng(`eb:${n}`));
      let now = 5_000_000;
      let rig = boot(memory);
      rig.ascent.now = () => now;
      rig.ascent.launch('e2', 50, 150);
      expect(rig.ascent.current()?.id).toBe('e2');
      now += 60_000;
      rig = boot(memory);
      rig.ascent.now = () => now;
      const done = rig.ascent.settle('e2');
      expect(done?.state?.cashedAt).toBe(150);
      expect(done?.win).toBe(wholeGold((50 * 150) / 100, o.u));
      expect(rig.economy.snapshot.gold).toBe(950 + done!.win);
      rig = boot(memory);
      rig.ascent.now = () => now;
      rig.ascent.settle('e2');
      expect(rig.economy.snapshot.gold).toBe(950 + done!.win);
    });

    it('past the break with no cash-out the round closes lost', () => {
      memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold: 1_000 }));
      memory.write(GAMES_KEY, { version: 1, secret: 'ec', nonce: 0, plays: {}, totals: {} });
      const o = drawAscent(seededRng('ec:0'));
      const rig = boot(memory);
      let now = 0;
      rig.ascent.now = () => now;
      rig.ascent.launch('e3', 10, 0);
      now = msToReach(o.crash) + 2_000;
      const done = rig.ascent.settle('e3');
      expect(done?.win).toBe(0);
      expect(done?.paid).toBeTrue();
      // A stale claim after the break cannot pay more than the clock a quarter second ago.
      expect(rig.ascent.cashOut('e3', 101)?.win).toBe(0);
      expect(rig.economy.snapshot.gold).toBe(990);
    });
  });
});
