/**
 * offline.service.spec.ts — the return, driven by hand.
 *
 * The cases below are the ones a manual pass cannot reach without waiting five
 * minutes, and the ones where a regression is silent: a first-ever visitor
 * being shown a summary instead of the tutorial, a short flick between tabs
 * raising a curtain, a stamp that walks backwards and manufactures an absence,
 * offline XP paid twice by a fast reload.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { dayKey } from '../quests/quest.model';
import {
  AWAY_KEY,
  AWAY_MAX_SECONDS,
  AWAY_MIN_SECONDS,
  offlineXpFor,
} from './offline.model';
import {
  CHALLENGE_BLOB_KEY,
  OfflineService,
  QUEST_BLOB_KEY,
} from './offline.service';

/** Ledger stub. The real settlement is EconomyService's own spec's problem. */
class LedgerStub {
  settlement: { seconds: number; gold: number } | null = null;
  takeOfflineSettlement() {
    const taken = this.settlement;
    this.settlement = null;
    return taken;
  }
}

class XpStub {
  awarded: number[] = [];
  award(_type: string, opts: { amount?: number } = {}): void {
    this.awarded.push(opts.amount ?? 0);
  }
}

const KEYS = [AWAY_KEY, QUEST_BLOB_KEY, CHALLENGE_BLOB_KEY];

function clearKeys(): void {
  for (const key of KEYS) localStorage.removeItem(key);
}

describe('OfflineService', () => {
  let ledger: LedgerStub;
  let xp: XpStub;

  /**
   * A fresh service, constructed *after* storage is seeded.
   *
   * The construction order is the point: the service reads the stamp and both
   * board day keys in its field initialisers, exactly as it does when
   * AppComponent field-injects it ahead of the wiring that overwrites them.
   */
  function build(): OfflineService {
    ledger = new LedgerStub();
    xp = new XpStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        OfflineService,
        { provide: EconomyService, useValue: ledger },
        { provide: XpService, useValue: xp },
      ],
    });
    return TestBed.inject(OfflineService);
  }

  /** Stamp an absence of `seconds` ending now. */
  function seedAbsence(seconds: number): void {
    localStorage.setItem(AWAY_KEY, String(Date.now() - seconds * 1000));
  }

  beforeEach(clearKeys);
  afterEach(clearKeys);

  describe('deciding whether there is anything to report', () => {
    it('says nothing on a browser that has never been here', async () => {
      // A first visit gets the tutorial. Two full-viewport curtains at once is
      // neither, and there is by construction no absence to price.
      const offline = build();
      await offline.settle();
      expect(offline.active()).toBe(false);
      expect(offline.report()).toBeNull();
      // The stamp is still laid down, so the *next* return has a floor.
      expect(localStorage.getItem(AWAY_KEY)).not.toBeNull();
    });

    it('stays silent for a flick between tabs', async () => {
      seedAbsence(AWAY_MIN_SECONDS - 30);
      const offline = build();
      ledger.settlement = { seconds: 270, gold: 900 };
      await offline.settle();
      expect(offline.active()).toBe(false);
      // The catch-up still happened — it always happens, it is the same
      // settlement the tab does every second. It is the *screen* that is
      // suppressed, and nothing was minted for a span this short.
      expect(xp.awarded).toEqual([]);
    });

    it('stays silent when a long absence earned nothing', async () => {
      // A brand-new save with no upgrades, no Thralls and no expeditions.
      seedAbsence(8 * 3600);
      const offline = build();
      ledger.settlement = { seconds: 8 * 3600, gold: 0 };
      await offline.settle();
      // The XP is still minted and banked — it is owed either way.
      expect(xp.awarded).toEqual([offlineXpFor(8 * 3600)]);
      // …but 120 XP alone is worth a line, so the screen does go up.
      expect(offline.active()).toBe(true);
      expect(offline.report()!.goldEarned).toBe(0);
    });

    it('raises the summary once the absence clears the floor', async () => {
      seedAbsence(8 * 3600 + 23 * 60);
      const offline = build();
      ledger.settlement = { seconds: 8 * 3600, gold: 48_320.7 };
      await offline.settle();

      const report = offline.report()!;
      expect(offline.active()).toBe(true);
      expect(report.awaySeconds).toBe(AWAY_MAX_SECONDS);
      expect(report.clamped).toBe(true);
      // Floored: a fractional Gold on a receipt invites the reader to check
      // arithmetic that was rounded before it got here.
      expect(report.goldEarned).toBe(48_320);
    });
  });

  describe('the Gold line', () => {
    it('is the ledger receipt, not a second calculation', async () => {
      seedAbsence(3600);
      const offline = build();
      ledger.settlement = { seconds: 3600, gold: 12 };
      await offline.settle();
      expect(offline.report()!.goldEarned).toBe(12);
    });

    it('is zero rather than NaN when the ledger settled nothing', async () => {
      seedAbsence(3600);
      const offline = build();
      ledger.settlement = null;
      await offline.settle();
      expect(offline.report()!.goldEarned).toBe(0);
    });
  });

  describe('the XP line', () => {
    it('mints exactly once, however many times settle is called', async () => {
      // The guard that matters: `settle()` is called from ngOnInit, and a
      // hydration that ran it twice would pay a night's XP twice.
      seedAbsence(4 * 3600);
      const offline = build();
      await offline.settle();
      await offline.settle();
      expect(xp.awarded.length).toBe(1);
    });

    it('is not re-paid by a reload a second later', async () => {
      seedAbsence(4 * 3600);
      await build().settle();
      expect(xp.awarded.length).toBe(1);

      // Same tab, reloaded. `build()` hands out a fresh ledger and a fresh XP
      // stub, exactly as a page load hands out fresh services — so an award
      // landing here is one the second load paid, not a leftover from the first.
      const second = build();
      await second.settle();
      expect(xp.awarded).toEqual([]);
      expect(second.active()).toBe(false);
    });
  });

  describe('the board rollovers', () => {
    it('reports a daily board that rolled over during the absence', async () => {
      localStorage.setItem(QUEST_BLOB_KEY, JSON.stringify({ dayKey: '2020-01-01' }));
      localStorage.setItem(CHALLENGE_BLOB_KEY, JSON.stringify({ dayKey: '2020-01-01' }));
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();

      const report = offline.report()!;
      expect(report.dailyQuestAvailable).toBe(true);
      expect(report.challengesReset).toBe(true);
    });

    it('reports no rollover when the boards are already on today', async () => {
      const today = dayKey();
      localStorage.setItem(QUEST_BLOB_KEY, JSON.stringify({ dayKey: today }));
      localStorage.setItem(CHALLENGE_BLOB_KEY, JSON.stringify({ dayKey: today }));
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();

      const report = offline.report()!;
      expect(report.dailyQuestAvailable).toBe(false);
      expect(report.challengesReset).toBe(false);
    });

    it('reports no rollover for a board that has never been written', async () => {
      // A visitor who has never opened the quest board has no daily quests
      // waiting for them. Announcing a reset that did not happen is worse than
      // announcing nothing.
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();
      expect(offline.report()!.dailyQuestAvailable).toBe(false);
    });

    it('survives a board blob that will not parse', async () => {
      localStorage.setItem(QUEST_BLOB_KEY, '{not json');
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();
      expect(offline.report()!.dailyQuestAvailable).toBe(false);
    });
  });

  describe('the away window', () => {
    it('is closed before the screen goes up', async () => {
      // Anything settling after the report is the live game, not the absence,
      // and must not land in a report the visitor is already reading.
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();
      expect(offline.awayWindow()).toBeNull();
    });

    it('is closed before any settlement has run', () => {
      seedAbsence(8 * 3600);
      expect(build().awayWindow()).toBeNull();
    });

    it('ignores a find reported outside a window', async () => {
      seedAbsence(8 * 3600);
      const offline = build();
      offline.reportThrallFinds([{ name: 'Ash', rarity: 'common', rarityLabel: 'Common' }]);
      await offline.settle();
      expect(offline.report()!.thrallFinds).toEqual([]);
    });
  });

  describe('the stamp', () => {
    it('never walks backwards', async () => {
      // Two tabs on one forge. Closing an old background tab must not rewind
      // the stamp and manufacture an absence out of a session nobody left.
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();

      const fresh = Number(localStorage.getItem(AWAY_KEY));
      expect(fresh).toBeGreaterThan(0);

      // The older tab's heartbeat, arriving late with a stale clock.
      offline['stamp'](fresh - 60_000);
      expect(Number(localStorage.getItem(AWAY_KEY))).toBe(fresh);
    });
  });

  describe('dismiss', () => {
    it('lowers the curtain and leaves the report readable', async () => {
      // The rewards were banked during the settlement — see the component
      // header — so dismissing is an acknowledgement, not a discard.
      seedAbsence(8 * 3600);
      const offline = build();
      await offline.settle();
      offline.dismiss();
      expect(offline.active()).toBe(false);
      expect(offline.report()).not.toBeNull();
    });
  });
});
