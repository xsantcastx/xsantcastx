/**
 * character.i18n.ts — the /character station strings. Lazy (registered by
 * ForgeKeeperComponent's constructor), never in the eager translation table.
 */
export const CHARACTER_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'character.title':        { en: 'Character', es: 'Personaje' },
  'character.hint':         { en: 'Tap a slot on your Keeper to equip gear.', es: 'Toca una ranura de tu Guardian para equiparte.' },
  'character.toNext':       { en: '{{n}} XP to {{rank}}', es: '{{n}} XP para {{rank}}' },
  'character.maxed':        { en: 'Top rank', es: 'Rango maximo' },
  'character.details.hint': { en: 'Purse, catalogue, cloud save and the way out', es: 'Monedero, catalogo, guardado en la nube y la salida' },
  'character.details.rank': { en: 'Rank', es: 'Rango' },
  'character.details.rate': { en: '{{n}} Gold / sec', es: '{{n}} Oro / seg' },
  'character.play':         { en: 'Enter the World', es: 'Entrar al mundo' },
  'character.catalogue':    { en: 'Catalogue', es: 'Catalogo' },
};
