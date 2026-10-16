/**
 * station-ui.i18n.ts — the kit's own strings, kept OUT of the eager
 * translation table (the initial bundle is at its hard limit).
 *
 * Registered by every kit component's constructor through
 * `TranslationService.register()`; scripts/check-i18n-keys.js reads every
 * `*.i18n.ts`, so a key used here and declared nowhere still fails the build.
 */
export const STATION_UI_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'stationUi.need':          { en: 'Need {{n}} more {{name}}', es: 'Te faltan {{n}} de {{name}}' },
  'stationUi.prevPage':      { en: 'Previous page', es: 'Pagina anterior' },
  'stationUi.nextPage':      { en: 'Next page', es: 'Pagina siguiente' },
  'stationUi.help':          { en: 'Help', es: 'Ayuda' },
  'stationUi.helpClose':     { en: 'Close help', es: 'Cerrar ayuda' },
  'stationUi.details':       { en: 'Details', es: 'Detalles' },
  'stationUi.detailsHint':   { en: 'Lore, odds, history and extra options', es: 'Historia, probabilidades y mas opciones' },
  'stationUi.working':       { en: 'Working…', es: 'Trabajando…' },
  'stationUi.nice':          { en: 'Nice!', es: '¡Genial!' },
  'stationUi.youGot':        { en: 'You got', es: 'Conseguiste' },
  'stationUi.have':          { en: 'You have {{n}}', es: 'Tienes {{n}}' },
  'stationUi.gold':          { en: 'Gold', es: 'Oro' },
  'stationUi.level':         { en: 'Level', es: 'Nivel' },
  'stationUi.quantity':      { en: 'How many', es: 'Cuantos' },
  'stationUi.less':          { en: 'One fewer', es: 'Uno menos' },
  'stationUi.more':          { en: 'One more', es: 'Uno mas' },
  'stationUi.forgeTabs':     { en: 'Forge stations', es: 'Estaciones de la forja' },
  'stationUi.tab.crafting':  { en: 'Crafting', es: 'Fabricar' },
  'stationUi.tab.enchanting': { en: 'Enchanting', es: 'Encantar' },
  'stationUi.tab.runes':     { en: 'Runes', es: 'Runas' },
  'stationUi.requiredItems': { en: 'Required items', es: 'Objetos necesarios' },
  'stationUi.requiredTools': { en: 'Required tools', es: 'Herramientas necesarias' },
  'stationUi.additive':      { en: 'Additive', es: 'Aditivo' },
  'stationUi.essence':       { en: 'Essence', es: 'Esencia' },
};
