import { xpForLevel } from '../activity/mining-level';
import { materialDisplay } from '../rpg/material-catalog';
import { SKILLS } from './skill.model';
import { SKILL_UNLOCKS, nextUnlock, skillPerks, unlocksFor } from './skill-unlocks';
import { lanternRadiusFor, toolTiers } from './tools';

describe('skill unlocks', () => {
  it('gives every skill something at least every 15 levels up to 99', () => {
    for (const s of SKILLS) {
      const levels = [1, ...SKILL_UNLOCKS[s.id].map(u => u.level), 99];
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1]).withContext(s.id).toBeLessThanOrEqual(15);
      }
    }
  });

  it('names only real materials for nodes', () => {
    for (const s of SKILLS) for (const u of SKILL_UNLOCKS[s.id]) {
      if (u.kind === 'node') expect(materialDisplay(u.materialId)?.name).withContext(u.materialId).toBeTruthy();
    }
  });

  it('unlocksFor returns everything at or below the level', () => {
    expect(unlocksFor('mining', 10).some(u => u.kind === 'tool' && u.tier === 2)).toBe(true);
    expect(unlocksFor('mining', 9).some(u => u.kind === 'tool' && u.tier === 2)).toBe(false);
  });

  it('nextUnlock points at the next row and the XP still needed', () => {
    const n = nextUnlock('mining', 0)!;
    expect(n.level).toBe(8);
    expect(n.xpNeeded).toBe(xpForLevel(8));
    expect(nextUnlock('mining', xpForLevel(99))).toBeNull();
  });

  it('perks are running totals', () => {
    expect(skillPerks('mining', 1).speedPct).toBe(0);
    expect(skillPerks('mining', 40).speedPct).toBe(10);
  });
});

describe('toolTiers', () => {
  const inv = (ids: string[], weaponRarity?: 'rare') => ({
    items: ids.map(definitionId => ({ definitionId })),
    equipped: weaponRarity ? { weapon: { rarity: weaponRarity } } : {},
  });

  it('takes the best owned tier per family; 0 when none', () => {
    const t = toolTiers(inv(['pickaxe-1', 'pickaxe-3', 'axe-2']));
    expect(t).toEqual({
      pickaxe: 3, axe: 2, sickle: 0, staff: 0, blade: 0, lanternRadius: 7,
      swing: { pickaxe: 0.35, axe: 0.40, sickle: 0.52, staff: 0.52 },
      toolSwing: { pickaxe: 0.35, axe: 0.40, sickle: 0.52, staff: 0.52 },
      power: { pickaxe: 1, axe: 1, sickle: 1, staff: 1 },
    });
  });

  it('a starter tool works as tier I at the slowest pace; a forged one is faster', () => {
    expect(toolTiers(inv(['starter-pickaxe'])).pickaxe).toBe(1);
    expect(toolTiers(inv(['starter-pickaxe'])).swing.pickaxe).toBe(0.52);
    expect(toolTiers(inv(['starter-pickaxe', 'pickaxe-1'])).swing.pickaxe).toBe(0.46);
  });

  it('caps by the wielding skill when progress is given', () => {
    const progress = { version: 1 as const, xpByDiscipline: { mining: xpForLevel(12), exploration: xpForLevel(20) } };
    const t = toolTiers(inv(['pickaxe-4'], 'rare'), progress);
    expect(t.pickaxe).toBe(2);
    expect(t.blade).toBe(2);
    expect(t.lanternRadius).toBe(lanternRadiusFor(20));
  });

  it('lantern grows 7 -> 16 tiles (7 tiles = the engine default reach)', () => {
    expect(lanternRadiusFor(1)).toBe(7);
    expect(lanternRadiusFor(99)).toBe(16);
  });
});
