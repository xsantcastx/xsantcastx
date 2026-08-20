/**
 * explorer-progression.spec.ts — an explorer's own ladder.
 *
 * The `amplify` assertion is the one worth reading. A passive that works by
 * making a number *smaller* — speed — must get smaller still when it upgrades,
 * and multiplying 0.7 by 1.5 gives 1.05, which is a slower explorer handed out
 * as a reward for reaching level 10. The number still moves, so the bug ships.
 */
import {
  AFFINITY_MAGIC_FIND,
  EXPLORER_XP_SHARE,
  LEVEL_MILESTONES,
  MASTERY_LEVEL,
  MAX_EXPLORER_LEVEL,
  PASSIVE_UPGRADE_LEVEL,
  bonusChips,
  equipCapacity,
  explorerXpFor,
  levelForXp,
  levelProgress,
  neutralBonus,
  nextMilestone,
  reachedMilestones,
  resolveExplorerBonus,
  xpForLevel,
} from './explorer-progression';
import { EXPLORER_TIERS } from './explorer-roster.model';

describe('the XP curve', () => {
  it('costs nothing to be level 1 and rises from there', () => {
    expect(xpForLevel(1)).toBe(0);
    for (let n = 2; n <= MAX_EXPLORER_LEVEL; n++) {
      expect(xpForLevel(n)).toBeGreaterThan(xpForLevel(n - 1));
    }
  });

  it('accelerates, so late levels are the commitment', () => {
    const step = (n: number) => xpForLevel(n) - xpForLevel(n - 1);
    for (let n = 3; n <= MAX_EXPLORER_LEVEL; n++) {
      expect(step(n)).withContext(`level ${n}`).toBeGreaterThan(step(n - 1));
    }
  });

  it('round-trips a level through its own cost', () => {
    for (let n = 1; n <= MAX_EXPLORER_LEVEL; n++) {
      expect(levelForXp(xpForLevel(n))).toBe(n);
    }
  });

  it('caps rather than running past twenty', () => {
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_EXPLORER_LEVEL);
    expect(levelProgress(Number.MAX_SAFE_INTEGER).capped).toBeTrue();
    expect(levelProgress(Number.MAX_SAFE_INTEGER).percent).toBe(100);
  });

  it('survives a corrupt or absent XP figure rather than reporting NaN', () => {
    for (const bad of [NaN, -1, Infinity, undefined as unknown as number]) {
      expect(levelForXp(bad)).toBe(1);
      const p = levelProgress(bad);
      expect(Number.isFinite(p.percent)).toBeTrue();
      expect(p.level).toBe(1);
    }
  });

  it('reports a progress bar that fills between two levels', () => {
    const mid = Math.round((xpForLevel(4) + xpForLevel(5)) / 2);
    const p = levelProgress(mid);
    expect(p.level).toBe(4);
    expect(p.percent).toBeGreaterThan(30);
    expect(p.percent).toBeLessThan(70);
  });
});

describe('milestones', () => {
  it('is a short list, in order, inside the ladder', () => {
    for (let i = 1; i < LEVEL_MILESTONES.length; i++) {
      expect(LEVEL_MILESTONES[i].level).toBeGreaterThan(LEVEL_MILESTONES[i - 1].level);
    }
    expect(LEVEL_MILESTONES[0].level).toBeGreaterThan(1);
    expect(LEVEL_MILESTONES[LEVEL_MILESTONES.length - 1].level).toBe(MAX_EXPLORER_LEVEL);
  });

  it('reports what is passed and what is next', () => {
    expect(reachedMilestones(1).length).toBe(0);
    expect(nextMilestone(1)).toBe(LEVEL_MILESTONES[0]);
    expect(reachedMilestones(MAX_EXPLORER_LEVEL).length).toBe(LEVEL_MILESTONES.length);
    expect(nextMilestone(MAX_EXPLORER_LEVEL)).toBeNull();
  });
});

describe('resolveExplorerBonus', () => {
  it('is neutral for an explorer with no archetype and no XP', () => {
    // The migration contract, restated for the person: a generated hire off an
    // old save must pay exactly what they paid before this file existed.
    expect(resolveExplorerBonus({ rarity: 'common' }, 'umbral')).toEqual(neutralBonus());
  });

  it('applies the trait', () => {
    // Ren Sixgate is Brave: 15% faster, and a slightly worse rune rate for it.
    const b = resolveExplorerBonus({ rarity: 'uncommon', archetypeId: 'ren-sixgate' }, 'luminous');
    expect(b.speed).toBeLessThan(1);
    expect(b.rune).toBeLessThan(1);
  });

  it('pays the affinity only in their own realm', () => {
    const home = resolveExplorerBonus({ rarity: 'rare', archetypeId: 'seris-lowlantern' }, 'umbral');
    const away = resolveExplorerBonus({ rarity: 'rare', archetypeId: 'seris-lowlantern' }, 'luminous');
    expect(home.magicFind - away.magicFind).toBe(AFFINITY_MAGIC_FIND);
    expect(home.rune).toBeGreaterThan(away.rune);
  });

  it('pays a realm-scoped passive only in that realm', () => {
    // Callum doubles Nexus materials and does nothing for anywhere else.
    const home = resolveExplorerBonus({ rarity: 'uncommon', archetypeId: 'callum-drossvane' }, 'nexus');
    const away = resolveExplorerBonus({ rarity: 'uncommon', archetypeId: 'callum-drossvane' }, 'verge');
    expect(home.materials).toBeGreaterThan(away.materials);
  });

  it('strengthens a passive at level ten without reversing its direction', () => {
    /*
     * The bug this exists for. Veyra's passive is `speed: 0.7` — 30% faster. The
     * naive upgrade multiplies by 1.5 and produces 1.05, which is *slower* than
     * a level-1 Veyra. `amplify` moves it further from 1 instead, to 0.55.
     */
    const xpAt = (level: number) => xpForLevel(level);
    const before = resolveExplorerBonus(
      { rarity: 'epic', archetypeId: 'veyra-sunder', xp: xpAt(PASSIVE_UPGRADE_LEVEL - 1) }, 'nexus');
    const after = resolveExplorerBonus(
      { rarity: 'epic', archetypeId: 'veyra-sunder', xp: xpAt(PASSIVE_UPGRADE_LEVEL) }, 'nexus');
    expect(after.speed).toBeLessThan(before.speed);
    expect(after.speed).toBeLessThan(1);
  });

  it('strengthens an upward passive upward', () => {
    const before = resolveExplorerBonus(
      { rarity: 'legendary', archetypeId: 'hadrian-lastlight', xp: xpForLevel(PASSIVE_UPGRADE_LEVEL - 1) }, 'luminous');
    const after = resolveExplorerBonus(
      { rarity: 'legendary', archetypeId: 'hadrian-lastlight', xp: xpForLevel(PASSIVE_UPGRADE_LEVEL) }, 'luminous');
    expect(after.gold).toBeGreaterThan(before.gold);
  });

  it('raises a rune floor by whole tiers only', () => {
    // A floor of 1.5 is not a tier, and `rollRuneAtOrAbove` would index the
    // table with it.
    for (const level of [1, PASSIVE_UPGRADE_LEVEL, MAX_EXPLORER_LEVEL]) {
      const b = resolveExplorerBonus(
        { rarity: 'mythic', archetypeId: 'ashen-sovereign', xp: xpForLevel(level) }, 'nexus');
      expect(Number.isInteger(b.runeFloor)).withContext(`level ${level}`).toBeTrue();
    }
  });

  it('grants the level-5 hand and the level-20 mastery', () => {
    const four = resolveExplorerBonus({ rarity: 'common', xp: xpForLevel(4) }, 'luminous');
    const five = resolveExplorerBonus({ rarity: 'common', xp: xpForLevel(5) }, 'luminous');
    expect(five.extraSlots).toBe(four.extraSlots + 1);

    const capped = resolveExplorerBonus({ rarity: 'common', xp: xpForLevel(MASTERY_LEVEL) }, 'luminous');
    expect(capped.gold).toBeGreaterThan(1);
    expect(capped.speed).toBeLessThan(1);
    expect(capped.magicFind).toBeGreaterThan(0);
  });
});

describe('equipment capacity', () => {
  it('is the tier alone below level fifteen', () => {
    for (const tier of Object.values(EXPLORER_TIERS)) {
      expect(equipCapacity(tier.id, xpForLevel(14))).toBe(tier.maxEquipSlots);
    }
  });

  it('adds the strap at fifteen', () => {
    for (const tier of Object.values(EXPLORER_TIERS)) {
      expect(equipCapacity(tier.id, xpForLevel(15))).toBe(tier.maxEquipSlots + 1);
    }
  });
});

describe('explorer XP', () => {
  it('is a share of the mission, never zero', () => {
    expect(explorerXpFor(600, neutralBonus())).toBe(Math.round(600 * EXPLORER_XP_SHARE));
    // A one-XP mission must still bank something, or a Scout would never level
    // anyone at all.
    expect(explorerXpFor(1, neutralBonus())).toBeGreaterThanOrEqual(1);
  });

  it('scales with the explorer’s own XP bonus', () => {
    const scholar = { ...neutralBonus(), xp: 1.5 };
    expect(explorerXpFor(600, scholar)).toBeGreaterThan(explorerXpFor(600, neutralBonus()));
  });
});

describe('bonusChips', () => {
  it('says nothing about a neutral explorer', () => {
    expect(bonusChips(neutralBonus())).toEqual([]);
  });

  it('reads a speed bonus as faster rather than as a negative percentage', () => {
    const chips = bonusChips({ ...neutralBonus(), speed: 0.8 });
    expect(chips.some(c => c.includes('faster'))).toBeTrue();
    expect(chips.some(c => c.includes('-'))).toBeFalse();
  });
});
