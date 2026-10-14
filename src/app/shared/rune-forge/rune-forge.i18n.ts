/**
 * rune-forge.i18n.ts — the Rune Forge's plain-words copy. Lazy: ships in this
 * route's chunk, merged by TranslationService.register(), checked by
 * scripts/check-i18n-keys.js.
 */
export const RUNE_FORGE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'forge.purpose':       { en: 'Spend Gold to strike a random rune. Rarer runes are worth more.', es: 'Gasta oro para sacar una runa al azar. Las mas raras valen mas.' },
  'forge.cta':           { en: 'Strike the forge', es: 'Golpear la forja' },
  'forge.strikeAll':     { en: 'Strike all', es: 'Golpear todo' },
  'forge.randomRune':    { en: 'A random rune', es: 'Una runa al azar' },
  'forge.strikeOne':     { en: 'Strike 1 rune', es: 'Golpear 1 runa' },
  'forge.strikeN':       { en: 'Strike {{n}} runes', es: 'Golpear {{n}} runas' },
  'forge.skill.title':   { en: 'Runes', es: 'Runas' },
  'forge.found':         { en: '{{n}} of {{total}} runes found', es: '{{n}} de {{total}} runas halladas' },
  'forge.details.hint':  { en: 'Your runes, Runewords and equipment', es: 'Tus runas, palabras runicas y equipo' },
};
