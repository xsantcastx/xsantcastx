/**
 * explorer.model.spec.ts — the expedition roll, and the realm's cut of it.
 *
 * Pure functions over pure data, so every case here pins `rng` and asserts an
 * exact number. There is no service, no storage and no clock involved: the whole
 * point of keeping the roll in the model is that it is testable this way.
 */
import {
  EXPEDITION_HISTORY_CAP,
  MISSIONS,
  REALM_EXPEDITION_PROFILES,
  emptyExplorerState,
  expeditionEta,
  formatCountdown,
  missionById,
  missionProgress,
  realmGoldBand,
  realmProfile,
  remainingMs,
  rollReward,
  type Expedition,
} from './explorer.model';
import { REALMS } from '../realms/realm.model';

const SCOUT = missionById('scout')!;

/** A mission out, with only the fields the display helpers read. */
function expedition(over: Partial<Expedition> = {}): Expedition {
  return {
    id: 'x',
    explorerId: 'e1',
    realm: 'luminous',
    mission: 'scout',
    duration: 120_000,
    startedAt: 1_000_000,
    lootBonus: 0,
    yieldMultiplier: 1,
    ...over,
  };
}

describe('realm expedition profiles', () => {
  it('covers every realm on the board', () => {
    for (const realm of REALMS) {
      expect(REALM_EXPEDITION_PROFILES[realm.id]).toBeDefined();
      expect(REALM_EXPEDITION_PROFILES[realm.id].realm).toBe(realm.id);
      expect(REALM_EXPEDITION_PROFILES[realm.id].specialty.length).toBeGreaterThan(0);
    }
  });

  it('falls back to a real profile for an id that is not a realm', () => {
    // A hand-edited save can carry anything here. Falling back to Luminous is
    // deliberate — see the note on RewardOptions.realm.
    expect(realmProfile('not-a-realm').realm).toBe('luminous');
  });

  it('keeps every multiplier inside the band the design note claims', () => {
    for (const profile of Object.values(REALM_EXPEDITION_PROFILES)) {
      expect(profile.goldMultiplier).toBeGreaterThanOrEqual(0.75);
      expect(profile.goldMultiplier).toBeLessThanOrEqual(1.25);
      expect(profile.xpMultiplier).toBeGreaterThanOrEqual(0.75);
      expect(profile.xpMultiplier).toBeLessThanOrEqual(1.25);
      // Umbral's rune rate is the one deliberate outlier, and it is still 1.5.
      expect(profile.runeChanceMultiplier).toBeLessThanOrEqual(1.5);
    }
  });

  it('makes the five realms genuinely different from each other', () => {
    // The whole reason the profiles exist: five buttons that all paid the same
    // were five buttons nobody read.
    const golds = new Set(Object.values(REALM_EXPEDITION_PROFILES).map(p => p.goldMultiplier));
    const runes = new Set(Object.values(REALM_EXPEDITION_PROFILES).map(p => p.runeChanceMultiplier));
    expect(golds.size).toBeGreaterThan(1);
    expect(runes.size).toBeGreaterThan(1);
  });
});

describe('rollReward', () => {
  it('pays the realm-adjusted Gold band', () => {
    // rng() = 0 puts the roll at the bottom of the band, so the assertion is
    // exact rather than a range.
    const luminous = rollReward(SCOUT, () => 0, { realm: 'luminous' });
    const umbral = rollReward(SCOUT, () => 0, { realm: 'umbral' });

    expect(luminous.gold).toBe(Math.round(SCOUT.goldMin * 1.15));
    expect(umbral.gold).toBe(Math.round(SCOUT.goldMin * 0.9));
    expect(luminous.gold).toBeGreaterThan(umbral.gold);
  });

  it('pays the realm-adjusted XP', () => {
    const verge = rollReward(SCOUT, () => 0, { realm: 'verge' });
    const nexus = rollReward(SCOUT, () => 0, { realm: 'nexus' });
    expect(verge.xp).toBe(Math.round(SCOUT.xp * 1.25));
    expect(nexus.xp).toBe(Math.round(SCOUT.xp * 0.95));
  });

  it('applies the realm rune multiplier to the drop gate', () => {
    // A roll that sits between the base chance and Umbral's boosted chance
    // should find a rune in Umbral and nothing in Luminous. The gate is
    // `rng() < chance`, and the same rng feeds the rune table afterwards.
    const between = SCOUT.runeChance * 1.2;
    const rng = () => between;

    expect(rollReward(SCOUT, rng, { realm: 'umbral' }).runes.length).toBe(1);
    expect(rollReward(SCOUT, rng, { realm: 'luminous' }).runes.length).toBe(0);
  });

  it('rolls once per inventory slot', () => {
    // rng() = 0 always clears the gate, so a six-slot explorer banks six.
    const reward = rollReward(SCOUT, () => 0, { realm: 'umbral', inventorySlots: 6 });
    expect(reward.runes.length).toBe(6);
    expect(reward.rune).toBe(reward.runes[0]);
  });

  it('applies Endurance on top of the realm cut', () => {
    const plain = rollReward(SCOUT, () => 0, { realm: 'luminous' });
    const boosted = rollReward(SCOUT, () => 0, { realm: 'luminous', yieldMultiplier: 2 });
    expect(boosted.gold).toBe(Math.round(SCOUT.goldMin * 1.15 * 2));
    expect(boosted.gold).toBeGreaterThan(plain.gold);
  });

  it('never pays less than the mission floor after a hostile yield multiplier', () => {
    // `yieldMultiplier` is read off a persisted record, so a hand-edited 0 or a
    // negative must not zero the payout.
    const reward = rollReward(SCOUT, () => 0, { realm: 'luminous', yieldMultiplier: -5 });
    expect(reward.gold).toBeGreaterThan(0);
  });

  it('defaults to a real realm when none is passed', () => {
    const reward = rollReward(SCOUT, () => 0);
    expect(reward.gold).toBe(Math.round(SCOUT.goldMin * 1.15));
  });
});

describe('realmGoldBand', () => {
  it('reports the band the picker prints', () => {
    const band = realmGoldBand(SCOUT, 'luminous');
    expect(band.min).toBe(Math.round(SCOUT.goldMin * 1.15));
    expect(band.max).toBe(Math.round(SCOUT.goldMax * 1.15));
    expect(band.min).toBeLessThan(band.max);
  });

  it('matches what rollReward actually pays at both ends', () => {
    for (const realm of REALMS) {
      const band = realmGoldBand(SCOUT, realm.id);
      // 0.999999 rather than 1: rng() is exclusive of 1, and the top of the
      // band is only reachable in the limit.
      const low = rollReward(SCOUT, () => 0, { realm: realm.id }).gold;
      const high = rollReward(SCOUT, () => 0.999999, { realm: realm.id }).gold;
      expect(low).toBe(band.min);
      expect(high).toBeLessThanOrEqual(band.max);
    }
  });
});

describe('display helpers', () => {
  it('floors the remainder at zero rather than going negative', () => {
    const e = expedition();
    expect(remainingMs(e, e.startedAt)).toBe(e.duration);
    expect(remainingMs(e, e.startedAt + e.duration + 60_000)).toBe(0);
  });

  it('clamps progress to 0-1', () => {
    const e = expedition();
    expect(missionProgress(e, e.startedAt - 5_000)).toBe(0);
    expect(missionProgress(e, e.startedAt + e.duration / 2)).toBeCloseTo(0.5, 5);
    expect(missionProgress(e, e.startedAt + e.duration * 3)).toBe(1);
  });

  it('reports a zero-length mission as finished rather than as NaN', () => {
    const e = expedition({ duration: 0 });
    expect(missionProgress(e, e.startedAt)).toBe(1);
  });

  it('reports the ETA as start plus span', () => {
    const e = expedition();
    expect(expeditionEta(e)).toBe(e.startedAt + e.duration);
  });

  it('formats a countdown, growing an hours field only when needed', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(3_725_000)).toBe('1:02:05');
  });
});

describe('explorer state', () => {
  it('starts with an empty log', () => {
    expect(emptyExplorerState().history).toEqual([]);
  });

  it('caps the log at ten', () => {
    expect(EXPEDITION_HISTORY_CAP).toBe(10);
  });
});

describe('missions', () => {
  it('never makes the short run the efficient one', () => {
    // The three lengths pay the same Gold per millisecond at the top of their
    // bands, so a player who refreshes all afternoon can at best *match* one who
    // checks in twice a day — never beat them. That is the balance property
    // worth pinning: if a future retune ever made a shorter run pay a better
    // rate, the optimal play would become "sit on Scout and click", which is
    // exactly the behaviour the mechanic exists to replace.
    const rates = MISSIONS.map(m => m.goldMax / m.duration);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1] - Number.EPSILON);
    }
  });

  it('makes the long run worth more per dispatch, not just per hour', () => {
    // The other half of the same claim: the reason to pick the hour is that one
    // dispatch is worth more, so the player has to interact less, not more.
    const golds = MISSIONS.map(m => m.goldMax);
    for (let i = 1; i < golds.length; i++) {
      expect(golds[i]).toBeGreaterThan(golds[i - 1]);
    }
  });

  it('raises the rune rate with the length', () => {
    const chances = MISSIONS.map(m => m.runeChance);
    for (let i = 1; i < chances.length; i++) {
      expect(chances[i]).toBeGreaterThan(chances[i - 1]);
    }
  });
});
