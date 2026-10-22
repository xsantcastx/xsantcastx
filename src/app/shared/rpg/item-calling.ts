/**
 * item-calling.ts — which Keepers a stat is for (docs/design/loot-and-combat.md §3.6; owner 2026-10-22: "all weapons
 * are giving spell damage? If im a warrior? … consistency in items").
 *
 * Two damage families, D2's way:
 *  - the **casters** (Warlock, Lanternwright) read Spell Damage, Cast Speed and +Spells;
 *  - the **fighters** (Ashguard, Thornstrider) read Martial Damage, Attack Speed and Life Steal, and a weapon's own
 *    +min–max Damage: the Ashguard from a melee weapon, the Thornstrider from a bow or crossbow. Pierce is the
 *    Thornstrider's alone. Everything else (life, Defense, resists, crit, Block, the finds) is everyone's.
 *
 * **Old rolls (the frozen-grade rule: nothing is re-rolled or rewritten).** Before §3.6 every weapon's implicit was
 * Spell Damage, helms and gloves rolled it too, and gloves rolled Cast Speed — and every class read them. A piece whose
 * family can no longer roll Spell Damage (a sword, a bow, a helm, a shield…) keeps its number as written, and that
 * number now counts **in the wearer's own family**: Spell Damage for a caster, Martial Damage for a fighter (Cast Speed
 * likewise reads as Attack Speed). The card says so on the line. Why this and not "casters only": the second would
 * strip every existing Ashguard and Thornstrider of the damage their weapon has always given — the one rule here that
 * changes no existing character's numbers. A ring or a staff (families that still roll Spell Damage) is new-rule: its
 * Spell Damage is the casters'.
 *
 * Pure: no Angular, no DOM.
 */
import type { Vocation } from '../keeper-look/keeper-look.model';
import { familyRolls, type AffixFamily } from './item-affixes';
import type { ItemStats } from './item.model';

export const VOCATIONS: readonly Vocation[] = ['warlock', 'ashguard', 'lanternwright', 'thornstrider'];
/** The casters: their spells are lifted by Spell Damage. */
export const CASTERS: readonly Vocation[] = ['warlock', 'lanternwright'];
/** The fighters: blade, bow and beast lifted by Martial Damage. */
export const FIGHTERS: readonly Vocation[] = ['ashguard', 'thornstrider'];

export function isCaster(v: Vocation | string | null | undefined): boolean {
  return v === 'warlock' || v === 'lanternwright';
}

/** The damage family a calling reads. */
export type DamageFamily = 'spell' | 'martial';
export function damageFamilyOf(v: Vocation | string | null | undefined): DamageFamily {
  return isCaster(v) ? 'spell' : 'martial';
}

/** Who a family of item is made for (the card's "Favoured by"). An empty list: every calling. */
export const FAMILY_FAVOURED: Readonly<Record<AffixFamily, readonly Vocation[]>> = {
  caster: CASTERS,
  focus: CASTERS,
  martial: ['ashguard'],
  bow: ['thornstrider'],
  quiver: ['thornstrider'],
  shield: ['ashguard'],
  armour: [],
  jewel: [],
};

/** The old-roll twins: a caster stat on a piece that can no longer roll it reads as its fighter twin for a fighter. */
export const OLD_ROLL_TWIN: Readonly<Partial<Record<keyof ItemStats, keyof ItemStats>>> = {
  spellDamage: 'attackDamage',
  castSpeed: 'attackSpeed',
};

/**
 * How a stat on a piece of this family reads for this calling:
 *  'used'   it counts;
 *  'unused' it does nothing for this calling (the card dims it: "unused by your calling");
 *  'old'    an old roll that counts as its twin for this calling (OLD_ROLL_TWIN).
 */
export type StatUse = 'used' | 'unused' | 'old';
export function statUse(key: keyof ItemStats, family: AffixFamily | null, v: Vocation | string | null | undefined): StatUse {
  const caster = isCaster(v);
  switch (key) {
    case 'spellDamage':
    case 'castSpeed':
      if (caster) return 'used';
      return !familyRolls(family, key) ? 'old' : 'unused';
    case 'skillRanks':
      return caster ? 'used' : 'unused';
    case 'attackDamage':
    case 'attackSpeed':
    case 'lifeLeech':
      return caster ? 'unused' : 'used';
    case 'minDamage':
    case 'maxDamage':
      return (v === 'ashguard' && family === 'martial') || (v === 'thornstrider' && family === 'bow') ? 'used' : 'unused';
    case 'pierceChance':
      return v === 'thornstrider' ? 'used' : 'unused';
    default:
      return 'used';
  }
}

/**
 * The old rolls a fighter's worn pieces carry, as their fighter twins (`{ attackDamage, attackSpeed }`): the Spell Damage
 * and Cast Speed on pieces whose family no longer rolls them. Each piece is read as worn (its runes and Socket Word in).
 */
export function oldRollTwins(pieces: readonly { family: AffixFamily | null; stats: ItemStats }[]): { attackDamage: number; attackSpeed: number } {
  let attackDamage = 0, attackSpeed = 0;
  for (const p of pieces) {
    if (!familyRolls(p.family, 'spellDamage')) attackDamage += Math.max(0, p.stats.spellDamage ?? 0);
    if (!familyRolls(p.family, 'castSpeed')) attackSpeed += Math.max(0, p.stats.castSpeed ?? 0);
  }
  return { attackDamage: Math.round(attackDamage * 10) / 10, attackSpeed: Math.round(attackSpeed * 10) / 10 };
}
