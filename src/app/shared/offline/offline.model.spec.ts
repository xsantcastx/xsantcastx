/**
 * offline.model.spec.ts — the arithmetic of an absence.
 *
 * Every case here is one where a regression would be *silent*: a clock that
 * moved backwards paying out, a week away paying for a week, a cap that stopped
 * capping, or a screen raised to announce nothing at all.
 */
import {
  AWAY_MAX_SECONDS,
  AWAY_MIN_SECONDS,
  AWAY_XP_PER_MINUTE,
  awaySecondsBetween,
  collapseFinds,
  emptyReport,
  formatAway,
  isReportWorthShowing,
  offlineXpFor,
} from './offline.model';
import {
  CHALLENGE_BLOB_KEY,
  EXPLORER_BLOB_KEY,
  QUEST_BLOB_KEY,
  THRALL_BLOB_KEY,
} from './offline.service';
import { THRALL_KEY } from '../thralls/thrall.model';
import { EXPLORER_KEY } from '../explorer/explorer.model';
import { QUEST_KEY } from '../quests/quest.service';
import { CHALLENGE_KEY } from '../challenges/challenge.model';

const HOUR = 3_600_000;

describe('offline model', () => {
  describe('awaySecondsBetween', () => {
    it('measures whole seconds', () => {
      expect(awaySecondsBetween(1_000_000, 1_000_000 + 90_500)).toBe(90);
    });

    it('clamps a long absence to the eight-hour ceiling', () => {
      const week = 7 * 24 * HOUR;
      expect(awaySecondsBetween(0, week)).toBe(AWAY_MAX_SECONDS);
    });

    it('pays nothing for a clock that moved backwards', () => {
      // An NTP correction, a manual change, a machine restored from a snapshot.
      // The failure to avoid is an absolute value, which would pay for time
      // travel, and a negative, which would poison every number downstream.
      expect(awaySecondsBetween(2_000_000, 1_000_000)).toBe(0);
    });

    it('pays nothing for a stamp written this instant', () => {
      expect(awaySecondsBetween(5_000, 5_000)).toBe(0);
    });

    it('is zero rather than NaN on a corrupt stamp', () => {
      expect(awaySecondsBetween(Number.NaN, Date.now())).toBe(0);
    });
  });

  describe('offlineXpFor', () => {
    it('pays a quarter of an XP a minute', () => {
      expect(offlineXpFor(3_600)).toBe(Math.floor(60 * AWAY_XP_PER_MINUTE));
    });

    it('tops out at the eight-hour ceiling, however long the span', () => {
      const capped = offlineXpFor(AWAY_MAX_SECONDS);
      expect(offlineXpFor(AWAY_MAX_SECONDS * 10)).toBe(capped);
      // 120 XP: the same as a perfect day of *being here* on a thirty-day
      // streak. Offline must never out-earn presence — see the model note.
      expect(capped).toBe(120);
    });

    it('floors, so a fraction of an XP is never a reward', () => {
      expect(offlineXpFor(60)).toBe(0);
      expect(offlineXpFor(AWAY_MIN_SECONDS)).toBe(1);
    });

    it('is zero for nonsense', () => {
      expect(offlineXpFor(-500)).toBe(0);
      expect(offlineXpFor(Number.NaN)).toBe(0);
    });
  });

  describe('collapseFinds', () => {
    const row = (name: string, rarity = 'common') =>
      ({ name, rarity, rarityLabel: rarity });

    it('folds repeats into one row with a count', () => {
      const rows = collapseFinds([row('Ash'), row('Ash'), row('Vex', 'rare')]);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(jasmine.objectContaining({ name: 'Ash', count: 2 }));
      expect(rows[1]).toEqual(jasmine.objectContaining({ name: 'Vex', count: 1 }));
    });

    it('keeps first-appearance order rather than sorting by rarity', () => {
      // The list reads as a night's work. Re-sorting would put the best find at
      // the top of a list the reader has been told is chronological.
      const rows = collapseFinds([row('Ash'), row('Sol', 'mythic'), row('Ash')]);
      expect(rows.map(r => r.name)).toEqual(['Ash', 'Sol']);
    });

    it('is empty for an empty night', () => {
      expect(collapseFinds([])).toEqual([]);
    });
  });

  describe('formatAway', () => {
    it('spells hours and minutes', () => {
      expect(formatAway(8 * 3600 + 23 * 60)).toBe('8h 23m');
    });

    it('drops a zero minute rather than saying "8h 0m"', () => {
      expect(formatAway(8 * 3600)).toBe('8h');
    });

    it('falls back to minutes and then to seconds', () => {
      expect(formatAway(23 * 60)).toBe('23m');
      expect(formatAway(42)).toBe('42s');
    });
  });

  describe('isReportWorthShowing', () => {
    it('refuses a report that earned nothing', () => {
      // A long absence on a brand-new save. Raising a curtain to announce zero
      // of everything is the worst version of this feature.
      expect(isReportWorthShowing(emptyReport(8 * 3600))).toBe(false);
    });

    it('accepts a board rollover on its own', () => {
      const report = emptyReport(8 * 3600);
      report.dailyQuestAvailable = true;
      expect(isReportWorthShowing(report)).toBe(true);
    });

    it('accepts any single earned line', () => {
      for (const patch of [
        { goldEarned: 1 },
        { xpEarned: 1 },
        { thrallFinds: [{ name: 'Ash', rarity: 'common', rarityLabel: 'Common', count: 1 }] },
        { expeditions: [{ mission: 'Scout', realm: 'Umbral', gold: 4, spoils: [] }] },
        { challengesReset: true },
      ]) {
        expect(isReportWorthShowing({ ...emptyReport(600), ...patch })).toBe(true);
      }
    });
  });

  /**
   * The service spells the four blob keys itself rather than importing them,
   * because a module is the chunking unit and importing either lazy model would
   * put six hundred lines of pure data into the initial bundle. This is what
   * makes that safe: a rename on either side fails here rather than silently
   * turning the summary into a screen that never has anything on it.
   */
  describe('blob keys the service reads raw', () => {
    it('match the definitions their owners export', () => {
      expect(THRALL_BLOB_KEY).toBe(THRALL_KEY);
      expect(EXPLORER_BLOB_KEY).toBe(EXPLORER_KEY);
      expect(QUEST_BLOB_KEY).toBe(QUEST_KEY);
      expect(CHALLENGE_BLOB_KEY).toBe(CHALLENGE_KEY);
    });
  });
});
