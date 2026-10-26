/**
 * enchanting.i18n.ts — the Enchanting Table's plain-words copy. Lazy: it ships
 * in this route's chunk and is merged by TranslationService.register(), so it
 * costs the initial bundle nothing. Checked by scripts/check-i18n-keys.js.
 */
export const ENCHANTING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'enchant.name':            { en: 'Enchanting Table', es: 'Mesa de encantamiento' },
  'enchant.purpose':         { en: 'Drag a rune onto a socketed piece. The right runes in order, in a plain base, make a runeword.', es: 'Arrastra una runa sobre una pieza con engarces. Las runas correctas, en orden, en una base normal, forman una palabra runica.' },
  'enchant.step.gear':       { en: 'Pick your gear', es: 'Elige tu equipo' },
  'enchant.step.rune':       { en: 'Pick a rune', es: 'Elige una runa' },
  'enchant.cta':             { en: 'Add {{rune}} to {{item}}', es: 'Poner {{rune}} en {{item}}' },
  'enchant.ctaShort':        { en: 'Add a rune', es: 'Poner una runa' },
  'enchant.runeCost':        { en: '{{name}} rune', es: 'runa {{name}}' },
  'enchant.why.noGear':      { en: 'You have no gear with rune slots yet.', es: 'Aun no tienes equipo con huecos para runas.' },
  'enchant.why.noRunes':     { en: 'You have no runes yet. Creatures drop them: the deeper the zone, the heavier the rune.', es: 'Aun no tienes runas. Las sueltan las criaturas: cuanto mas honda la zona, mas pesada la runa.' },
  'enchant.why.full':        { en: 'Every socket in this piece is filled. Runes never come out.', es: 'Todos los engarces de esta pieza estan llenos. Las runas nunca salen.' },
  'enchant.slotsUsed':       { en: '{{n}}/{{max}} slots', es: '{{n}}/{{max}} huecos' },
  'enchant.added':           { en: 'Rune added!', es: '¡Runa colocada!' },
  'enchant.wordFound':       { en: 'Your runes spelled a runeword!', es: 'Tus runas formaron una palabra runica.' },
  'enchant.details.hint':    { en: 'Sockets, stats, runewords, potions', es: 'Engarces, estadisticas, palabras runicas, pociones' },
  'enchant.details.slots':   { en: 'Runes on this gear', es: 'Runas en este equipo' },
  'enchant.details.slotsHint': { en: 'A rune in a socket is a promise the gear has to keep: it never comes out.', es: 'Una runa engarzada es una promesa que el equipo debe cumplir: nunca sale.' },
  'enchant.details.emptySlot': { en: 'Empty slot', es: 'Hueco vacio' },
  'enchant.details.stats':   { en: 'What this gear gives you', es: 'Lo que te da este equipo' },
  'enchant.tabs':            { en: 'Enchanting', es: 'Encantamiento' },
  'enchant.tab.runes':       { en: 'Add runes', es: 'Poner runas' },
  'enchant.tab.potions':     { en: 'Potions', es: 'Pociones' },
  'enchant.skill.title':     { en: 'Runewords', es: 'Palabras runicas' },
  'enchant.skill.words':     { en: '{{n}} / {{total}} found', es: '{{n}} / {{total}} halladas' },
  'enchant.potions.title':   { en: 'Potions (temporary boosts)', es: 'Pociones (mejoras temporales)' },
  'enchant.potions.hint':    { en: 'Burn materials for a boost that lasts a while. Up to three at once.', es: 'Quema materiales para una mejora que dura un rato. Hasta tres a la vez.' },
  'enchant.potions.brew':    { en: 'Brew {{name}}', es: 'Preparar {{name}}' },
  'enchant.potions.left':    { en: '{{time}} left', es: 'Quedan {{time}}' },
  'enchant.potions.full':    { en: 'Three potions are already running.', es: 'Ya hay tres pociones activas.' },
  'enchant.potions.running': { en: 'Already running.', es: 'Ya esta activa.' },
};
