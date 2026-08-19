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
  REALM_COMMON_MATERIALS,
  REALM_EXCLUSIVE_MATERIALS,
  realmMaterials,
  rollMaterials,
  rollRuneAtOrAbove,
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


// ─────────────────────────────────────────────────────────────────────────────
// The deep ladder
// ─────────────────────────────────────────────────────────────────────────────

describe('the mission ladder', () => {
  it('runs from two minutes to seventy-two hours, strictly increasing', () => {
    for (let i = 1; i < MISSIONS.length; i++) {
      expect(MISSIONS[i].duration).toBeGreaterThan(MISSIONS[i - 1].duration);
    }
  });

  it('pays more Gold the longer it runs', () => {
    for (let i = 1; i < MISSIONS.length; i++) {
      expect(MISSIONS[i].goldMin).toBeGreaterThan(MISSIONS[i - 1].goldMin);
      expect(MISSIONS[i].goldMax).toBeGreaterThan(MISSIONS[i - 1].goldMax);
    }
  });

  it('charges more the deeper it goes, and only above the Scout', () => {
    expect(missionById('scout')!.cost).toBeUndefined();
    const costed = MISSIONS.filter(m => m.cost);
    for (let i = 1; i < costed.length; i++) {
      expect(costed[i].cost!).toBeGreaterThan(costed[i - 1].cost!);
    }
  });

  it('charges a fee that is a rounding error against the payout', () => {
    // The fee prices the rung; it must never *be* the rung. A dispatch that
    // could plausibly lose money is one no player takes twice, and at that
    // point the length is decoration.
    for (const m of MISSIONS) {
      if (!m.cost) continue;
      expect(m.cost).toBeLessThan(m.goldMin / 3);
    }
  });

  it('raises the rune floor instead', () => {
    expect(missionById('expedition')!.runeFloor).toBeUndefined();
    expect(missionById('deep-dive')!.runeFloor).toBe(2);
    expect(missionById('grand')!.runeFloor).toBe(2);
    expect(missionById('abyss')!.runeFloor).toBe(3);
  });

  it('gates and limits only the Abyss', () => {
    for (const m of MISSIONS) {
      if (m.id === 'abyss') continue;
      expect(m.minLevel).toBeUndefined();
      expect(m.exclusive).toBeUndefined();
    }
    expect(missionById('abyss')!.minLevel).toBe(5);
    expect(missionById('abyss')!.exclusive).toBe(true);
  });

  it('flags exactly the three lengths above the hour as deep', () => {
    expect(MISSIONS.filter(m => m.deep).map(m => m.id))
      .toEqual(['deep-dive', 'grand', 'abyss']);
  });

  it('keeps every material band the right way round', () => {
    for (const m of MISSIONS) {
      if (m.materialsMax === undefined) continue;
      expect(m.materialsMax).toBeGreaterThanOrEqual(m.materialsMin ?? 0);
    }
  });
});

describe('rollRuneAtOrAbove', () => {
  it('is the plain roll when there is no floor', () => {
    const rune = rollRuneAtOrAbove(0, 0, () => 0.999999);
    expect(rune).toBeTruthy();
  });

  it('reaches the floor rather than returning a Common', () => {
    // A real rng, because the point of the function is that it beats a table
    // where 99.7% of the mass is below the floor.
    for (let i = 0; i < 40; i++) {
      const rune = rollRuneAtOrAbove(2, 0, Math.random);
      expect(['rare', 'epic', 'legendary', 'mythic', 'singular']).toContain(rune.tier);
    }
  });

  it('terminates on an rng that can never clear the floor', () => {
    // `() => 0` always lands on the first row of the table, which is a Common.
    // Without the attempt cap this is an infinite loop; with it, the honest
    // answer is the best rune the attempts produced.
    const rune = rollRuneAtOrAbove(6, 0, () => 0);
    expect(rune).toBeTruthy();
  });
});

describe('realm freight', () => {
  it('gives every realm its own two materials', () => {
    const seen = new Map<string, string[]>();
    for (const realm of REALMS) {
      const own = REALM_EXCLUSIVE_MATERIALS[realm.id];
      expect(own.length).toBe(2);
      for (const id of own) {
        const holders = seen.get(id) ?? [];
        holders.push(realm.id);
        seen.set(id, holders);
      }
    }
    // Exclusive means exclusive: a material two realms both return is a picker
    // where those two buttons are the same button again.
    for (const [, holders] of seen) expect(holders.length).toBe(1);
  });

  it('lists the commons before the exclusives', () => {
    const all = realmMaterials('umbral');
    expect(all.slice(0, REALM_COMMON_MATERIALS.length)).toEqual([...REALM_COMMON_MATERIALS]);
    expect(all.slice(REALM_COMMON_MATERIALS.length)).toEqual([...REALM_EXCLUSIVE_MATERIALS.umbral]);
  });

  it('falls back to a real realm on an unknown id', () => {
    expect(realmMaterials('not-a-realm').length).toBe(realmMaterials('luminous').length);
  });

  it('rolls nothing when the band is zero', () => {
    expect(rollMaterials('umbral', 0, 0, () => 0.5)).toEqual({});
  });

  it('stacks a repeated material rather than listing it twice', () => {
    const haul = rollMaterials('umbral', 6, 6, () => 0.1);
    expect(Object.keys(haul).length).toBe(1);
    expect(Object.values(haul)[0]).toBe(6);
  });

  it('only ever returns materials that realm actually has', () => {
    for (const realm of REALMS) {
      const allowed = new Set(realmMaterials(realm.id));
      for (let i = 0; i < 20; i++) {
        const haul = rollMaterials(realm.id, 5, 5, Math.random);
        for (const id of Object.keys(haul)) expect(allowed.has(id)).toBe(true);
      }
    }
  });

  it('reaches the realm\'s headline material at the top of the roll', () => {
    const haul = rollMaterials('verge', 1, 1, () => 0.97);
    expect(Object.keys(haul)).toEqual([REALM_EXCLUSIVE_MATERIALS.verge[1]]);
  });
});

describe('rollReward on the deep ladder', () => {
  it('honours a guaranteed rune even when the chance roll fails', () => {
    const grand = missionById('grand')!;
    // 0.999 is above every runeChance in the table, so nothing would drop
    // without the guarantee.
    const reward = rollReward(grand, () => 0.999, { realm: 'umbral', inventorySlots: 1 });
    expect(reward.runes.length).toBe(1);
  });

  it('does not spend a slot budget it does not have', () => {
    const abyss = missionById('abyss')!;
    // Two guaranteed runes, one slot: the guarantee is capped by the slots
    // rather than added on top, so a Common explorer banks one.
    const reward = rollReward(abyss, () => 0.999, { realm: 'umbral', inventorySlots: 1 });
    expect(reward.runes.length).toBe(1);
  });

  it('carries materials home from a deep run and nothing from a Scout', () => {
    const deep = rollReward(missionById('deep-dive')!, Math.random, { realm: 'archivum' });
    expect(Object.keys(deep.materials ?? {}).length).toBeGreaterThan(0);

    const scout = rollReward(missionById('scout')!, Math.random, { realm: 'archivum' });
    expect(scout.materials).toBeUndefined();
  });
});
