/**
 * enchanting.i18n.ts — the Enchanting Table's plain-words copy. Lazy: it ships
 * in this route's chunk and is merged by TranslationService.register(), so it
 * costs the initial bundle nothing. Checked by scripts/check-i18n-keys.js.
 */
export const ENCHANTING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'enchant.name':            { en: 'Enchanting Table', es: 'Mesa de encantamiento' },
  'enchant.purpose':         { en: 'Add runes to your gear to make it stronger.', es: 'Pon runas en tu equipo para hacerlo mas fuerte.' },
  'enchant.step.gear':       { en: 'Pick your gear', es: 'Elige tu equipo' },
  'enchant.step.rune':       { en: 'Pick a rune', es: 'Elige una runa' },
  'enchant.cta':             { en: 'Add {{rune}} to {{item}}', es: 'Poner {{rune}} en {{item}}' },
  'enchant.ctaShort':        { en: 'Add a rune', es: 'Poner una runa' },
  'enchant.runeCost':        { en: '{{name}} rune', es: 'runa {{name}}' },
  'enchant.why.noGear':      { en: 'You have no gear with rune slots yet.', es: 'Aun no tienes equipo con huecos para runas.' },
  'enchant.why.noRunes':     { en: 'You have no runes yet — get some at the Rune Forge.', es: 'Aun no tienes runas: consiguelas en la Forja de runas.' },
  'enchant.why.full':        { en: 'This gear is full. Remove a rune in Details first.', es: 'Este equipo esta lleno. Quita una runa en Detalles primero.' },
  'enchant.slotsUsed':       { en: '{{n}}/{{max}} slots', es: '{{n}}/{{max}} huecos' },
  'enchant.toForge':         { en: 'Go to the Rune Forge', es: 'Ir a la Forja de runas' },
  'enchant.added':           { en: 'Rune added!', es: '¡Runa colocada!' },
  'enchant.wordFound':       { en: 'Your runes spelled a secret word!', es: '¡Tus runas formaron una palabra secreta!' },
  'enchant.details.hint':    { en: 'Remove runes, stats, secret words, potions', es: 'Quitar runas, estadisticas, palabras, pociones' },
  'enchant.details.slots':   { en: 'Runes on this gear', es: 'Runas en este equipo' },
  'enchant.details.slotsHint': { en: 'Removing a rune gives it back and costs Gold.', es: 'Quitar una runa te la devuelve y cuesta oro.' },
  'enchant.details.remove':  { en: 'Remove {{name}}', es: 'Quitar {{name}}' },
  'enchant.details.emptySlot': { en: 'Empty slot', es: 'Hueco vacio' },
  'enchant.details.stats':   { en: 'What this gear gives you', es: 'Lo que te da este equipo' },
  'enchant.tabs':            { en: 'Enchanting', es: 'Encantamiento' },
  'enchant.tab.runes':       { en: 'Add runes', es: 'Poner runas' },
  'enchant.tab.potions':     { en: 'Potions', es: 'Pociones' },
  'enchant.skill.title':     { en: 'Secret words', es: 'Palabras secretas' },
  'enchant.skill.words':     { en: '{{n}} / {{total}} found', es: '{{n}} / {{total}} halladas' },
  'enchant.potions.title':   { en: 'Potions (temporary boosts)', es: 'Pociones (mejoras temporales)' },
  'enchant.potions.hint':    { en: 'Burn materials for a boost that lasts a while. Up to three at once.', es: 'Quema materiales para una mejora que dura un rato. Hasta tres a la vez.' },
  'enchant.potions.brew':    { en: 'Brew {{name}}', es: 'Preparar {{name}}' },
  'enchant.potions.left':    { en: '{{time}} left', es: 'Quedan {{time}}' },
  'enchant.potions.full':    { en: 'Three potions are already running.', es: 'Ya hay tres pociones activas.' },
  'enchant.potions.running': { en: 'Already running.', es: 'Ya esta activa.' },
};
