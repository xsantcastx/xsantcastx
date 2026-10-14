/**
 * rarity.i18n.ts — Spanish for the rune tier labels and the Exchange category
 * labels, which live as English-only strings in the shared models
 * (`RUNE_TIERS[id].label`, `CATEGORY_LABELS`). The models keep their meaning
 * and their English; a station that wants the player's language maps the id to
 * one of these keys and registers this table (lazy, never the eager table).
 *
 *   t(rarityKey(item.rarity))   // 'tierLabel.legendary'
 *   t(categoryKey('ore'))       // 'exCat.ore'
 *
 * Checked by scripts/check-i18n-keys.js like every *.i18n.ts.
 */
export const RARITY_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'tierLabel.common':    { en: 'Common', es: 'Común' },
  'tierLabel.uncommon':  { en: 'Uncommon', es: 'Poco común' },
  'tierLabel.rare':      { en: 'Rare', es: 'Raro' },
  'tierLabel.epic':      { en: 'Epic', es: 'Épico' },
  'tierLabel.legendary': { en: 'Legendary', es: 'Legendario' },
  'tierLabel.mythic':    { en: 'Mythic', es: 'Mítico' },
  'tierLabel.singular':  { en: 'Singular', es: 'Singular' },

  'exCat.ore':     { en: 'Ore', es: 'Mineral' },
  'exCat.reagent': { en: 'Reagents', es: 'Reactivos' },
  'exCat.essence': { en: 'Essence', es: 'Esencia' },
  'exCat.weapon':  { en: 'Weapons', es: 'Armas' },
  'exCat.armour':  { en: 'Armour', es: 'Armaduras' },
  'exCat.trinket': { en: 'Trinkets', es: 'Abalorios' },
};

/** Table key for a rune tier / item rarity id. */
export function rarityKey(id: string): string { return `tierLabel.${id}`; }
/** Table key for an Exchange good category id. */
export function categoryKey(id: string): string { return `exCat.${id}`; }
