/**
 * sanctum.i18n.ts — the Sanctum station strings. Lazy (registered by
 * ForgeViewComponent's constructor), never in the eager translation table.
 */
export const SANCTUM_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'sanctum.title':          { en: 'Sanctum', es: 'Santuario' },
  'sanctum.tabs':           { en: 'Sanctum sections', es: 'Secciones del santuario' },
  'sanctum.tab.send':       { en: 'Send', es: 'Enviar' },
  'sanctum.tab.works':      { en: 'Works', es: 'Obras' },
  'sanctum.tab.forge':      { en: 'Forge', es: 'Forja' },
  'sanctum.tab.cast':       { en: 'Cast', es: 'Elenco' },
  'sanctum.explorers':      { en: 'Explorers', es: 'Exploradores' },
  'sanctum.hint':           { en: 'Pick a place, then send an explorer.', es: 'Elige un lugar y envia a un explorador.' },
  'sanctum.strip.out':      { en: '{{n}} out · next home in {{t}}', es: '{{n}} fuera · el proximo vuelve en {{t}}' },
  'sanctum.strip.arriving': { en: '{{n}} out · one arriving now', es: '{{n}} fuera · uno llega ya' },
  'sanctum.strip.free':     { en: '{{n}} of {{total}} free', es: '{{n}} de {{total}} libres' },
  'sanctum.realms':         { en: 'Realms', es: 'Reinos' },
  'sanctum.places':         { en: 'Places in this realm', es: 'Lugares de este reino' },
  'sanctum.siteSub':        { en: '{{time}} · {{cost}}', es: '{{time}} · {{cost}}' },
  'sanctum.sendLine':       { en: 'Send {{who}} to {{site}}', es: 'Enviar a {{who}} a {{site}}' },
  'sanctum.length':         { en: 'How long', es: 'Cuanto tiempo' },
  'sanctum.shorter':        { en: 'Shorter trip', es: 'Viaje mas corto' },
  'sanctum.longer':         { en: 'Longer trip', es: 'Viaje mas largo' },
  'sanctum.send':           { en: 'Send explorer', es: 'Enviar explorador' },
  'sanctum.allOut':         { en: 'Every explorer is out. They come home on their own.', es: 'Todos los exploradores estan fuera. Vuelven solos.' },
  'sanctum.details.hint':   { en: 'Income, trip lengths, quests, the log', es: 'Ingresos, viajes, misiones, el registro' },
};
