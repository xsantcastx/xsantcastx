/**
 * codex.i18n.ts — the Codex station strings. Lazy (registered by
 * CodexComponent's constructor), never in the eager translation table.
 */
export const CODEX_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'codex.title':            { en: 'Codex', es: 'Codice' },
  'codex.tabs':             { en: 'Codex sections', es: 'Secciones del codice' },
  'codex.tab.achievements': { en: 'Fragments', es: 'Fragmentos' },
  'codex.tab.collection':   { en: 'Collection', es: 'Coleccion' },
  'codex.tab.progression':  { en: 'Rank', es: 'Rango' },
  'codex.tab.scrolls':      { en: 'Lore', es: 'Saber' },
  'codex.tab.secrets':      { en: 'Secrets', es: 'Secretos' },
  'codex.tab.leaderboard':  { en: 'Ladder', es: 'Clasificacion' },
  'codex.found':            { en: 'Found', es: 'Hallado' },
  'codex.foundLabel':       { en: '{{n}}/{{total}} fragments', es: '{{n}}/{{total}} fragmentos' },
  'codex.hint':             { en: 'Play and explore to fill it. Tap one to read its clue.', es: 'Juega y explora para llenarlo. Toca uno para leer su pista.' },
  'codex.list':             { en: 'Entries', es: 'Entradas' },
  'codex.empty':            { en: 'Nothing matches. Clear the filters in Details.', es: 'Nada coincide. Quita los filtros en Detalles.' },
  'codex.hidden':           { en: 'Hidden', es: 'Oculto' },
  'codex.sealed':           { en: 'Sealed', es: 'Sellado' },
  'codex.rarity':           { en: 'Rarity', es: 'Rareza' },
  'codex.realm':            { en: 'Realm', es: 'Reino' },
  'codex.reward':           { en: 'Reward', es: 'Recompensa' },
  'codex.foundOn':          { en: 'Found', es: 'Hallado' },
  'codex.part':             { en: 'Part {{n}}', es: 'Parte {{n}}' },
  'codex.scrollSealed':     { en: 'Sealed. Fragments come off the Rune Forge anvil with a rune.', es: 'Sellado. Los fragmentos salen del yunque de la Forja de Runas.' },
  'codex.inscription':      { en: 'Delve inscription', es: 'Inscripcion del Abismo' },
  'codex.notCopied':        { en: 'Not yet copied. Somewhere in the {{place}}.', es: 'Aun sin copiar. En algun lugar de {{place}}.' },
  'codex.socketWord':       { en: 'Socket word', es: 'Palabra de engarce' },
  'codex.gateOpen':         { en: 'Unchains {{gate}} in the Trials', es: 'Libera {{gate}} en las Pruebas' },
  'codex.gateLocked':       { en: 'Holds a gate in the Trials', es: 'Guarda una puerta en las Pruebas' },
  'codex.details.hint':     { en: 'Filters, totals and what each section is', es: 'Filtros, totales y que es cada seccion' },
};
