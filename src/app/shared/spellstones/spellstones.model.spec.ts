import { huntGold } from '../economy/economy-curve';
import { materialDisplay } from '../rpg/material-catalog';
import {
  BLANK_ID, BLANK_MIN_PRICE, blankPrice, coerceSpellstones, emptySpellstones, gainSoul, mergeSpellstones, parseRecipeKey, parseStoneKey, recipeKey, recipeOfDef, stoneDefId,
  rollBlankDrop, soulCap, soulForKill, stoneIcon, stoneKey, stoneRecipe, type SpellstoneSave,
} from './spellstones.model';
import { SKILLS } from '../../play/td/td-skills';
import { artFor } from '../art/art';

describe('spellstones.model', () => {
  it('Soul: one a kill near the Keeper\'s level, none for a creature more than 10 levels below; Soul Harvest adds', () => {
    expect(soulForKill(10, 10)).toBe(1);
    expect(soulForKill(10, 30)).toBe(1);
    expect(soulForKill(20, 10)).toBe(1);
    expect(soulForKill(20, 9)).toBe(0);
    expect(soulForKill(30, 5)).toBe(0);
    expect(soulForKill(10, 10, 4)).toBe(1);
    expect(soulForKill(10, 10, 5)).toBe(2);
    expect(soulForKill(10, 10, 20)).toBe(5);
  });

  it('Soul is capped: 100, +1 per 20 levels, never past 200', () => {
    expect(soulCap(1)).toBe(100);
    expect(soulCap(40)).toBe(102);
    expect(soulCap(5000)).toBe(200);
    let s = emptySpellstones();
    for (let i = 0; i < 150; i++) s = gainSoul(s, 1, soulCap(1));
    expect(s.soul).toBe(100);
    const full = s;
    expect(gainSoul(full, 3, soulCap(1))).toBe(full);
    expect(gainSoul(full, 3, soulCap(40)).soul).toBe(102);
  });

  it('the recipe: a dearer spell costs more Soul and gives fewer charges', () => {
    expect(stoneRecipe(SKILLS['hellfire-nova'].mana)).toEqual({ blanks: 1, soul: 5, charges: 4 });
    expect(stoneRecipe(SKILLS['dark-ward'].mana)).toEqual({ blanks: 1, soul: 4, charges: 5 });
    expect(stoneRecipe(SKILLS['light'].mana)).toEqual({ blanks: 1, soul: 2, charges: 10 });
    expect(stoneRecipe(SKILLS['meteor'].mana)).toEqual({ blanks: 1, soul: 7, charges: 3 });
    expect(stoneRecipe(SKILLS['life-tap'].mana)).toEqual({ blanks: 1, soul: 2, charges: 4 });
    for (const sk of Object.values(SKILLS)) {
      const r = stoneRecipe(sk.mana);
      expect(r.soul).toBeGreaterThanOrEqual(1); expect(r.soul).toBeLessThanOrEqual(12);
      expect(r.charges).toBeGreaterThanOrEqual(2); expect(r.charges).toBeLessThanOrEqual(10);
    }
  });

  it('a stone\'s recipe names its spell, rank and marks; a v1 pouch key reads as the recipe with no marks', () => {
    expect(recipeKey('hellfire-nova', 7, 5)).toBe('hellfire-nova@7#5');
    expect(parseRecipeKey('hellfire-nova@7#5')).toEqual({ skill: 'hellfire-nova', rank: 7, marks: 5 });
    expect(parseRecipeKey('hellfire-nova@7')).toEqual({ skill: 'hellfire-nova', rank: 7, marks: 0 });
    expect(parseRecipeKey('hellfire-nova@7#64')).toBeNull();
    expect(recipeOfDef(stoneDefId('light@2#1'))).toBe('light@2#1');
    expect(coerceSpellstones({ version: 1, soul: 3, pouch: { 'light@2': 4 }, slot: 'light@2', inscribed: 1, at: 5 }).slot).toBe('light@2#0');
  });

  it('stone keys carry the spell and the rank, clamped to 1–20', () => {
    expect(stoneKey('meteor', 0)).toBe('meteor@1');
    expect(stoneKey('meteor', 33)).toBe('meteor@20');
    expect(parseStoneKey('meteor@12')).toEqual({ skill: 'meteor', rank: 12 });
    expect(parseStoneKey('meteor@0')).toBeNull();
    expect(parseStoneKey('<x>@3')).toBeNull();
  });

  it('a save loads strictly and merges by the later change', () => {
    expect(coerceSpellstones(null)).toEqual(emptySpellstones());
    const s = coerceSpellstones({ soul: 9999, pouch: { 'light@2': 3, 'bad key': 4, 'meteor@3': -1 }, slot: 'nope', inscribed: 2, at: 5 });
    expect(s).toEqual({ version: 1, soul: 200, pouch: { 'light@2': 3 }, slot: null, inscribed: 2, at: 5 });
    const older = { ...emptySpellstones(), soul: 50, inscribed: 7, at: 10 }, newer = { ...emptySpellstones(), soul: 3, inscribed: 2, at: 20 };
    const m = mergeSpellstones(older, newer) as ReturnType<typeof emptySpellstones>;
    expect(m.soul).toBe(3);
    expect(m.inscribed).toBe(7);
    expect(mergeSpellstones(newer, older)).toEqual(m);
  });

  it('blanks: creatures drop them now and then, a boss two; the counter prices them on the hunt', () => {
    expect(rollBlankDrop('normal', () => 0.01)).toBe(1);
    expect(rollBlankDrop('normal', () => 0.5)).toBe(0);
    expect(rollBlankDrop('boss', () => 0.1)).toBe(2);
    expect(blankPrice(1)).toBe(Math.max(BLANK_MIN_PRICE, huntGold(1, 20)));
    expect(blankPrice(60)).toBe(huntGold(60, 20));
    expect(blankPrice(60)).toBeGreaterThan(blankPrice(10));
  });

  it('the blank and every family\'s stone have a name and a pixel icon', () => {
    expect(materialDisplay(BLANK_ID)?.name).toBe('Basalt Blank');
    for (const fam of ['ember', 'bone', 'shadow', 'common']) expect(artFor(stoneIcon(fam))).not.toBeNull();
    expect(stoneIcon('nonsense')).toBe('spellstone-common');
  });
});
