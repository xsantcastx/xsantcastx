/**
 * trials.i18n.ts — the Trials station strings. Lazy (registered by
 * ArenaComponent's constructor), never in the eager translation table.
 */
export const TRIALS_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'trials.title':      { en: 'Trials', es: 'Pruebas' },
  'trials.tabs':       { en: 'Gate lists', es: 'Listas de puertas' },
  'trials.tab.open':   { en: 'Open', es: 'Abiertas' },
  'trials.tab.all':    { en: 'All gates', es: 'Todas' },
  'trials.gates':      { en: 'Gates', es: 'Puertas' },
  'trials.openLabel':  { en: '{{n}}/{{total}} open', es: '{{n}}/{{total}} abiertas' },
  'trials.hint':       { en: 'Pick a gate and play.', es: 'Elige una puerta y juega.' },
  'trials.empty':      { en: 'No gate is open yet. Find a secret in the world.', es: 'Ninguna puerta abierta. Encuentra un secreto en el mundo.' },
  'trials.chained':    { en: 'Chained', es: 'Encadenada' },
  'trials.new':        { en: 'New', es: 'Nueva' },
  'trials.best':       { en: 'Best — {{s}}', es: 'Record — {{s}}' },
  'trials.play':       { en: 'Play', es: 'Jugar' },
  'trials.blockedChain': { en: 'Chained — find its secret in the world to break it.', es: 'Encadenada — encuentra su secreto en el mundo.' },
  'trials.blockedForge': { en: 'Unchained — still in the forge.', es: 'Liberada — aun en la forja.' },
  'trials.rarity':     { en: 'Rarity', es: 'Rareza' },
  'trials.bestFact':   { en: 'Your best', es: 'Tu record' },
  'trials.none':       { en: 'None yet', es: 'Aun nada' },
  'trials.details.hint': { en: 'How gates open, your totals, the way out', es: 'Como se abren, tus totales, la salida' },
};
