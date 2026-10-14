import { xpForLevel } from '../activity/mining-level';
import { materialDisplay } from '../rpg/material-catalog';
import { SKILLS } from './skill.model';
import { SKILL_UNLOCKS, nextUnlock, skillPerks, unlocksFor } from './skill-unlocks';
import { lanternRadiusFor, maxTierForLevel, toolCard, toolTiers, TOOL_SWING_SECONDS, TOOL_TIER_LEVEL } from './tools';
import { parseToolId, TOOL_DEFINITIONS } from './tool-items';
import { CRAFTING_RECIPES } from '../crafting/crafting.model';

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

describe('tool tier V (pickaxe and axe only)', () => {
  const bag = (ids: string[]) => ({ items: ids.map(definitionId => ({ definitionId })), equipped: {} });
  const at = (mining: number) => ({ version: 1 as const, xpByDiscipline: { mining: xpForLevel(mining) } });

  it('exists as a soulbound tier-5 pickaxe and axe, and nothing else', () => {
    const v = TOOL_DEFINITIONS.filter(d => d.id.endsWith('-5'));
    expect(v.map(d => d.id).sort()).toEqual(['axe-5', 'pickaxe-5']);
    expect(v.map(d => d.name).sort()).toEqual(['Axe V', 'Pickaxe V']);
    expect(v.every(d => d.soulbound)).toBeTrue();
    expect(TOOL_DEFINITIONS.length).toBe(18);
    expect(parseToolId('pickaxe-5')).toEqual({ family: 'pickaxe', tier: 5 });
    expect(parseToolId('sickle-5')).toBeNull();
    expect(parseToolId('staff-5')).toBeNull();
  });

  it('needs Smithing 60 to forge and level 60 to wield; a Mining-59 Keeper works it as IV', () => {
    expect(TOOL_TIER_LEVEL[5]).toBe(60);
    expect(maxTierForLevel(59)).toBe(4);
    expect(maxTierForLevel(60)).toBe(5);
    for (const id of ['craft-pickaxe-5', 'craft-axe-5']) {
      const r = CRAFTING_RECIPES.find(x => x.id === id)!;
      expect(r.skill).toBe('smithing');
      expect(r.requiredLevel).toBe(60);
    }
    expect(toolTiers(bag(['pickaxe-5']), at(59)).pickaxe).toBe(4);
    expect(toolTiers(bag(['pickaxe-5']), at(60)).pickaxe).toBe(5);
    expect(toolCard('pickaxe-5', at(59))!.worksAs).toBe(4);
    expect(toolCard('pickaxe-5', at(59))!.capUntil).toBe(60);
  });

  it('swings at 0.28 s at level 1, above the 0.25 s floor', () => {
    expect(TOOL_SWING_SECONDS[5]).toBe(0.28);
    expect(toolTiers(bag(['pickaxe-5'])).swing.pickaxe).toBe(0.28);
  });
});
