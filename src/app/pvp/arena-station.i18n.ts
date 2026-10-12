/**
 * arena-station.i18n.ts — the Arena (PvP) station strings. Lazy (registered
 * by PvpArenaComponent's constructor), never in the eager translation table.
 * The page's older `arena.*` keys stay where they are.
 */
export const ARENA_STATION_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'arenaSt.tabs':       { en: 'Arena sections', es: 'Secciones de la arena' },
  'arenaSt.tab.rings':  { en: 'Rings', es: 'Anillos' },
  'arenaSt.tab.shop':   { en: 'Shop', es: 'Tienda' },
  'arenaSt.winsTo':     { en: '{{n}} wins · {{left}} to {{rank}}', es: '{{n}} victorias · {{left}} para {{rank}}' },
  'arenaSt.top':        { en: '{{n}} wins · top rank', es: '{{n}} victorias · rango maximo' },
  'arenaSt.hint':       { en: 'Pick a ring, then challenge.', es: 'Elige un anillo y desafia.' },
  'arenaSt.hintShop':   { en: 'Spend arena points on gear and boosts.', es: 'Gasta puntos de arena en equipo y mejoras.' },
  'arenaSt.rings':      { en: 'Rings', es: 'Anillos' },
  'arenaSt.stock':      { en: 'For sale', es: 'En venta' },
  'arenaSt.odds':       { en: '{{pct}}% · {{label}}', es: '{{pct}}% · {{label}}' },
  'arenaSt.lockedSub':  { en: 'Win {{n}} below', es: 'Gana {{n}} antes' },
  'arenaSt.line':       { en: 'Best of three rounds.', es: 'Al mejor de tres asaltos.' },
  'arenaSt.challenge':  { en: 'Challenge', es: 'Desafiar' },
  'arenaSt.chained':    { en: 'Chained — win {{n}} more in the ring below.', es: 'Encadenado — gana {{n}} mas en el anillo anterior.' },
  'arenaSt.wait':       { en: 'Catching your breath — ready in {{t}}', es: 'Recuperando el aliento — listo en {{t}}' },
  'arenaSt.fighting':   { en: 'Fighting…', es: 'Peleando…' },
  'arenaSt.pick':       { en: 'Pick your challenger', es: 'Elige a tu rival' },
  'arenaSt.needWins':   { en: 'Needs {{n}} wins', es: 'Requiere {{n}} victorias' },
  'arenaSt.bagFull':    { en: 'Your bag has no room for it.', es: 'Tu bolsa no tiene espacio.' },
  'arenaSt.ptsSub':     { en: '{{n}} pts', es: '{{n}} pts' },
  'arenaSt.details.hint': { en: 'Your record, your Might and Guard, every challenger', es: 'Tu historial, tu Poder y Guardia, cada rival' },
};
