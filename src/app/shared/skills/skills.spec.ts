import { xpForLevel } from '../activity/mining-level';
import { materialDisplay } from '../rpg/material-catalog';
import { SKILLS } from './skill.model';
import { SKILL_UNLOCKS, nextUnlock, skillPerks, unlockText, unlocksFor } from './skill-unlocks';
import { titleFor, titlesBetween } from './skill-titles';
import { SKILL_TITLES_I18N } from './skill-titles.i18n';
import { lanternRadiusFor, toolTiers } from './tools';

describe('skill unlocks', () => {
  it('gives every skill something at least every 15 levels up to 99', () => {
    for (const s of SKILLS) {
      const levels = [1, ...SKILL_UNLOCKS[s.id].filter(u => u.level <= 99).map(u => u.level), 99];
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
    // Past 99 the next row is a title, and the table never runs out (stars past 300).
    const at99 = nextUnlock('mining', xpForLevel(99))!;
    expect(at99.level).toBe(100);
    expect(at99.unlocks[0].kind).toBe('title');
    const at300 = nextUnlock('mining', xpForLevel(300))!;
    expect(at300.level).toBe(325);
    expect(at300.unlocks[0].kind).toBe('title');
    expect(at300.xpNeeded).toBe(xpForLevel(325) - xpForLevel(300));
    expect(nextUnlock('mining', xpForLevel(1000))!.level).toBe(1025);
  });

  it('perks are running totals', () => {
    expect(skillPerks('mining', 1).speedPct).toBe(0);
    expect(skillPerks('mining', 40).speedPct).toBe(10);
  });
});

describe('skill titles past 99', () => {
  it('a title at 100 and every 25 levels: 8 authored (100 ... 275), then stars', () => {
    expect(titleFor('mining', 99)).toBeNull();
    expect(titleFor('mining', 100)!.key).toBe('skills.title.mining.1');
    expect(titleFor('mining', 124)!.rank).toBe(1);
    expect(titleFor('mining', 275)!.key).toBe('skills.title.mining.8');
    expect(titleFor('mining', 299)!.stars).toBe(0);
    expect(titleFor('mining', 325)!.key).toBe('skills.title.mining.8');
    expect(titleFor('mining', 325)!.stars).toBe(2);
    expect(titlesBetween('delving', 99, 151).map(t => t.level)).toEqual([100, 125, 150]);
  });

  it('every title has EN and ES words, distinct within a skill', () => {
    for (const s of SKILLS) {
      const names = new Set<string>();
      for (let rank = 1; rank <= 8; rank++) {
        const row = SKILL_TITLES_I18N[`skills.title.${s.id}.${rank}`];
        expect(row?.en).withContext(`${s.id} ${rank}`).toBeTruthy();
        expect(row?.es).withContext(`${s.id} ${rank}`).toBeTruthy();
        names.add(row.en);
      }
      expect(names.size).withContext(s.id).toBe(8);
    }
  });

  it('nothing past 99 gates anything: every row above 99 is a title', () => {
    for (const s of SKILLS) for (const u of SKILL_UNLOCKS[s.id]) {
      if (u.level > 99) expect(u.kind).withContext(`${s.id} ${u.level}`).toBe('title');
    }
  });

  it('a title row reads with its name (and stars) filled in', () => {
    const en = (key: string, vars?: Record<string, string | number>) =>
      (SKILL_TITLES_I18N[key]?.en ?? key).replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars?.[k]));
    expect(unlockText({ level: 125, kind: 'title', skill: 'mining', rank: 2 }, en)).toBe('Title: Seam-Sage');
    expect(unlockText({ level: 325, kind: 'title', skill: 'mining', rank: 10 }, en)).toBe('Title: Eclipse Hewer +2');
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
