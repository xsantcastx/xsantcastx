/**
 * challenge.model.spec.ts — the Contract Board's pure layer.
 *
 * Pools, the tier scale, the countdown and the progress copy. No service, no
 * storage, no clock beyond the one passed in — everything here is a pure
 * function over pure data, which is the reason the pools live in a model file
 * rather than inside the service.
 */
import {
  ALL_CHALLENGES,
  CHALLENGE_TIER_SCALE,
  DAILY_CHALLENGES,
  DAILY_CHALLENGE_SLOTS,
  DERIVED_METRICS,
  PEAK_METRICS,
  SET_METRICS,
  STREAK_BOOST_MULTIPLIER,
  STREAK_CHEST_AT,
  WEEKLY_CHALLENGES,
  WEEKLY_CHALLENGE_SLOTS,
  challengeById,
  challengeCountdown,
  challengeProgressLabel,
  formatChallengeNumber,
  pickDistinctMetrics,
  streakFlameTier,
  tierAtRank,
  tierRank,
  type Challenge,
} from './challenge.model';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { dayKey, orderDeterministic, weekKey } from '../quests/quest.model';

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'x',
    title: 'X',
    description: 'do a thing',
    flavour: 'flavour',
    cadence: 'daily',
    metric: 'rune-forged',
    target: 10,
    gold: 1_000,
    rarity: 'mortal',
    status: 'active',
    progress: 0,
    observed: 0,
    expiresAt: new Date().toISOString(),
    ...over,
  };
}

describe('challenge pools', () => {
  it('holds more than the brief\'s floor in each cadence', () => {
    expect(DAILY_CHALLENGES.length).toBeGreaterThanOrEqual(15);
    expect(WEEKLY_CHALLENGES.length).toBeGreaterThanOrEqual(10);
  });

  it('has room to draw a full board from each pool', () => {
    expect(DAILY_CHALLENGES.length).toBeGreaterThan(DAILY_CHALLENGE_SLOTS);
    expect(WEEKLY_CHALLENGES.length).toBeGreaterThan(WEEKLY_CHALLENGE_SLOTS);
  });

  it('has unique ids across both pools', () => {
    const ids = ALL_CHALLENGES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('files every entry under the cadence its pool is for', () => {
    expect(DAILY_CHALLENGES.every(c => c.cadence === 'daily')).toBe(true);
    expect(WEEKLY_CHALLENGES.every(c => c.cadence === 'weekly')).toBe(true);
  });

  it('pays and asks for a positive number on every card', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.gold).toBeGreaterThan(0);
      expect(c.target).toBeGreaterThan(0);
    }
  });

  it('pays a weekly more than the richest daily of the same metric', () => {
    // A weekly that pays less than a daily is a card nobody has a reason to
    // finish, and the pools are hand-priced so this is the only guard against
    // one drifting under the other during a retune.
    for (const weekly of WEEKLY_CHALLENGES) {
      const dailies = DAILY_CHALLENGES.filter(d => d.metric === weekly.metric);
      if (!dailies.length) continue;
      const richest = Math.max(...dailies.map(d => d.gold));
      expect(weekly.gold).toBeGreaterThan(richest);
    }
  });

  it('resolves every id it publishes', () => {
    for (const c of ALL_CHALLENGES) expect(challengeById(c.id)).toBe(c);
    expect(challengeById('not-a-challenge')).toBeUndefined();
  });

  it('sorts every metric into exactly one family', () => {
    // A metric in two families would be written by one path and read by
    // another, which is the one bug this classification exists to prevent.
    for (const c of ALL_CHALLENGES) {
      const families = [PEAK_METRICS, SET_METRICS, DERIVED_METRICS]
        .filter(set => set.has(c.metric)).length;
      expect(families).toBeLessThanOrEqual(1);
    }
  });
});

describe('the deterministic draw', () => {
  /** A year of daily keys, so the properties below are asserted on every board. */
  const YEAR: string[] = (() => {
    const keys: string[] = [];
    const d = new Date(2026, 0, 1);
    for (let i = 0; i < 365; i++) {
      keys.push(dayKey(d));
      d.setDate(d.getDate() + 1);
    }
    return keys;
  })();

  it('hands every visitor the same board on the same day', () => {
    const a = pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, '2026-08-19');
    const b = pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, '2026-08-19');
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  it('fills the board on every day of the year', () => {
    for (const key of YEAR) {
      expect(pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, key).length)
        .toBe(DAILY_CHALLENGE_SLOTS);
      expect(pickDistinctMetrics(WEEKLY_CHALLENGES, WEEKLY_CHALLENGE_SLOTS, key).length)
        .toBe(WEEKLY_CHALLENGE_SLOTS);
    }
  });

  it('draws distinct cards', () => {
    for (const key of YEAR) {
      const drawn = pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, key);
      expect(new Set(drawn.map(c => c.id)).size).toBe(DAILY_CHALLENGE_SLOTS);
    }
  });

  it('never asks for the same thing twice on one board', () => {
    // The regression this exists for: the plain pick drew "reach a combo of
    // x100" and "reach a combo of x250" onto the same day, which is a
    // three-slot board with two real objectives on it.
    for (const key of YEAR) {
      const daily = pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, key);
      expect(new Set(daily.map(c => c.metric)).size).toBe(daily.length);

      const weekly = pickDistinctMetrics(WEEKLY_CHALLENGES, WEEKLY_CHALLENGE_SLOTS, key);
      expect(new Set(weekly.map(c => c.metric)).size).toBe(weekly.length);
    }
  });

  it('rotates the board rather than showing one card every day', () => {
    const appearances = new Map<string, number>();
    for (const key of YEAR) {
      for (const c of pickDistinctMetrics(DAILY_CHALLENGES, DAILY_CHALLENGE_SLOTS, key)) {
        appearances.set(c.id, (appearances.get(c.id) ?? 0) + 1);
      }
    }
    // Three slots over eighteen cards is a sixth of the year each if it were
    // perfectly even. The distinctness filter biases it, so this only pins the
    // failure that would matter: a card that is on the board every single day,
    // or one that never appears at all.
    for (const def of DAILY_CHALLENGES) {
      const seen = appearances.get(def.id) ?? 0;
      expect(seen).toBeGreaterThan(0);
      expect(seen).toBeLessThan(YEAR.length);
    }
  });

  it('walks the whole pool in one permutation', () => {
    const ordered = orderDeterministic(DAILY_CHALLENGES, '2026-08-19');
    expect(ordered.length).toBe(DAILY_CHALLENGES.length);
    expect(new Set(ordered).size).toBe(DAILY_CHALLENGES.length);
  });

  it('shares the quest board\'s clocks', () => {
    // Not a tautology: the whole reason the challenge model imports these
    // rather than defining its own is that a challenge rolling at a different
    // midnight than a quest is unreproducible in the wild.
    const at = new Date(2026, 7, 19, 13, 0, 0);
    expect(dayKey(at)).toBe('2026-08-19');
    expect(weekKey(at)).toBe('W2026-08-17');
  });
});

describe('the tier scale', () => {
  it('is the rune ladder, in the rune ladder\'s order', () => {
    expect([...CHALLENGE_TIER_SCALE]).toEqual([...RUNE_TIER_ORDER]);
  });

  it('round-trips a tier through its rank', () => {
    for (const tier of RUNE_TIER_ORDER) {
      expect(tierAtRank(tierRank(tier))).toBe(tier);
    }
  });

  it('reads an unknown tier as the floor rather than as -1', () => {
    expect(tierRank('not-a-tier')).toBe(0);
  });

  it('clamps a rank past either end of the ladder', () => {
    expect(tierAtRank(-4)).toBe('common');
    expect(tierAtRank(99)).toBe('singular');
  });
});

describe('the streak flame', () => {
  it('is cold before the first sweep', () => {
    expect(streakFlameTier(0)).toBe('cold');
  });

  it('lights on day one and burns at the chest', () => {
    expect(streakFlameTier(1)).toBe('lit');
    expect(streakFlameTier(STREAK_CHEST_AT - 1)).toBe('lit');
    expect(streakFlameTier(STREAK_CHEST_AT)).toBe('burning');
    expect(streakFlameTier(30)).toBe('eternal');
  });

  it('doubles rather than adding', () => {
    // The reward is a multiplier on purpose — see the note in the model.
    expect(STREAK_BOOST_MULTIPLIER).toBeGreaterThan(1);
  });
});

describe('the countdown', () => {
  it('always shows hours', () => {
    const now = Date.parse('2026-08-19T09:00:00Z');
    const at = new Date(now + (2 * 3600 + 3 * 60 + 4) * 1000).toISOString();
    expect(challengeCountdown(at, now)).toBe('02:03:04');
  });

  it('floors at zero rather than counting backwards', () => {
    const now = Date.parse('2026-08-19T09:00:00Z');
    expect(challengeCountdown(new Date(now - 60_000).toISOString(), now)).toBe('00:00:00');
  });

  it('degrades to a dash on an unparseable instant', () => {
    expect(challengeCountdown('not a date')).toBe('—');
  });
});

describe('the progress line', () => {
  it('counts plainly for a counted metric', () => {
    expect(challengeProgressLabel(challenge({ observed: 7, target: 10 }))).toBe('7 / 10');
  });

  it('groups a large target', () => {
    expect(challengeProgressLabel(challenge({ observed: 0, target: 2_000_000 })))
      .toBe('0 / 2,000,000');
  });

  it('speaks in tiers for a tier goal', () => {
    const c = challenge({ metric: 'rune-tier', observed: 1, target: 2 });
    expect(challengeProgressLabel(c)).toBe('uncommon / rare');
  });

  it('says nothing yet rather than "common" at zero', () => {
    // Rank 0 is a real tier, so a naive read would claim the player has already
    // found a Common when they have found nothing at all.
    const c = challenge({ metric: 'rune-tier', observed: 0, target: 2 });
    expect(challengeProgressLabel(c)).toBe('nothing yet / rare');
  });

  it('marks a combo goal as a multiplier', () => {
    const c = challenge({ metric: 'combo-peak', observed: 60, target: 100 });
    expect(challengeProgressLabel(c)).toBe('x60 / x100');
  });
});

describe('number formatting', () => {
  it('groups thousands', () => {
    expect(formatChallengeNumber(1_234_567)).toBe('1,234,567');
  });

  it('degrades a non-number to zero rather than to NaN on the page', () => {
    expect(formatChallengeNumber(Number.NaN)).toBe('0');
  });
});
