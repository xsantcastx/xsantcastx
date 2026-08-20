/**
 * roster-completion.spec.ts — what filling the cast is worth.
 */
import {
  ARCHETYPE_COUNT,
  ROSTER_REWARDS,
  earnedRewards,
  nextReward,
  rosterBonusSlots,
  rosterPayoutMultiplier,
  rosterTitle,
} from './roster-completion';

describe('the reward ladder', () => {
  it('rises, and ends on the whole cast', () => {
    for (let i = 1; i < ROSTER_REWARDS.length; i++) {
      expect(ROSTER_REWARDS[i].at).toBeGreaterThan(ROSTER_REWARDS[i - 1].at);
    }
    expect(ROSTER_REWARDS[ROSTER_REWARDS.length - 1].at).toBe(ARCHETYPE_COUNT);
  });

  it('never sets a rung past what the cast can reach', () => {
    // A rung above ARCHETYPE_COUNT is a reward nothing can ever pay out.
    for (const r of ROSTER_REWARDS) {
      expect(r.at).toBeLessThanOrEqual(ARCHETYPE_COUNT);
    }
  });

  it('gives something on every rung', () => {
    for (const r of ROSTER_REWARDS) {
      expect(r.payoutMultiplier > 1 || r.slots > 0 || !!r.title)
        .withContext(`rung ${r.at}`).toBeTrue();
    }
  });
});

describe('earning', () => {
  it('pays nothing below the first rung', () => {
    expect(earnedRewards(0).length).toBe(0);
    expect(rosterPayoutMultiplier(0)).toBe(1);
    expect(rosterBonusSlots(0)).toBe(0);
    expect(rosterTitle(0)).toBeNull();
  });

  it('never goes down as more are found', () => {
    /*
     * The property the whole "count discoveries, not headcount" decision exists
     * to protect: a reward that could be taken back would mean dismissing a
     * Common could close an expedition slot with a mission already out in it.
     */
    let mult = 0, slots = 0;
    for (let n = 0; n <= ARCHETYPE_COUNT; n++) {
      expect(rosterPayoutMultiplier(n)).toBeGreaterThanOrEqual(mult);
      expect(rosterBonusSlots(n)).toBeGreaterThanOrEqual(slots);
      mult = rosterPayoutMultiplier(n);
      slots = rosterBonusSlots(n);
    }
  });

  it('compounds the multipliers rather than taking the best', () => {
    // Taking only the largest would make the middle rungs decorative, and a
    // player who read the tooltips would notice.
    const full = rosterPayoutMultiplier(ARCHETYPE_COUNT);
    const best = Math.max(...ROSTER_REWARDS.map(r => r.payoutMultiplier));
    expect(full).toBeGreaterThan(best);
  });

  it('keeps the ceiling somewhere reasonable', () => {
    // Real without being the reason anybody plays.
    expect(rosterPayoutMultiplier(ARCHETYPE_COUNT)).toBeLessThan(1.5);
  });

  it('reports the next rung, and nothing once the cast is complete', () => {
    expect(nextReward(0)).toBe(ROSTER_REWARDS[0]);
    expect(nextReward(ARCHETYPE_COUNT)).toBeNull();
  });

  it('names the highest title earned, not the first', () => {
    expect(rosterTitle(ARCHETYPE_COUNT)).toBe('Lord of the Roster');
    expect(rosterTitle(5)).toBe('Scout Master');
  });
});
