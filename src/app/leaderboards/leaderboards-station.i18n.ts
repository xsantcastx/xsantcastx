/**
 * leaderboards-station.i18n.ts — the Leaderboards station strings. Lazy
 * (registered by LeaderboardsComponent's constructor), never in the eager
 * translation table. The page's older `leaderboards.*` keys stay put.
 */
export const LEADERBOARDS_STATION_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'lbSt.you':        { en: 'Your rank', es: 'Tu puesto' },
  'lbSt.rankLabel':  { en: '#{{rank}} of {{total}} · {{score}}', es: '#{{rank}} de {{total}} · {{score}}' },
  'lbSt.toNext':     { en: '{{gap}} more to pass {{name}}.', es: '{{gap}} mas para superar a {{name}}.' },
  'lbSt.first':      { en: 'You are first on this ladder.', es: 'Vas primero en esta clasificacion.' },
  'lbSt.names':      { en: 'Names on this ladder', es: 'Nombres en esta clasificacion' },
  'lbSt.you.name':   { en: 'You', es: 'Tu' },
  'lbSt.climb':      { en: 'Climb this ladder', es: 'Sube en esta clasificacion' },
  'lbSt.rank':       { en: 'Rank', es: 'Puesto' },
  'lbSt.details.hint': { en: 'What each ladder counts, and who the names are', es: 'Que cuenta cada clasificacion y quienes son' },
};
