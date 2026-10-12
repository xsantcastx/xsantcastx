/**
 * market.i18n.ts — the Market journal's own strings (the station-kit layout).
 *
 * Lazy, registered by MarketComponent's constructor, so none of it lands in the
 * eager translation table (the initial bundle is at its limit). The older
 * `market.*` keys the Details drawer still uses stay where they were.
 */
export const MARKET_J_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'marketJ.income':      { en: 'Income', es: 'Ingresos' },
  'marketJ.rateLine':    { en: '{{rate}} Gold/sec · {{owned}}/{{total}} owned', es: '{{rate}} Oro/seg · {{owned}}/{{total}} tuyos' },
  'marketJ.hint':        { en: 'Earn Gold at the forge, then buy upgrades here to earn it faster.', es: 'Gana Oro en la forja y compra mejoras aqui para ganarlo mas rapido.' },
  'marketJ.tab.ready':   { en: 'Can buy', es: 'Al alcance' },
  'marketJ.buy':         { en: 'Buy', es: 'Comprar' },
  'marketJ.renew':       { en: 'Renew', es: 'Renovar' },
  'marketJ.takeFree':    { en: 'Take it — free', es: 'Tomalo — gratis' },
  'marketJ.buyMax':      { en: 'Buy max', es: 'Comprar max' },
  'marketJ.line':        { en: 'Buy 1 {{name}}', es: 'Compra 1 {{name}}' },
  'marketJ.lineOwned':   { en: 'You own this', es: 'Ya es tuyo' },
  'marketJ.lineMaxed':   { en: 'Maxed out — nothing more to buy', es: 'Al maximo — no hay mas que comprar' },
  'marketJ.lineRoster':  { en: 'Your Thrall roster is full', es: 'Tu lista de Siervos esta llena' },
  'marketJ.youOwn':      { en: 'You own {{n}}', es: 'Tienes {{n}}' },
  'marketJ.bought':      { en: 'You bought', es: 'Compraste' },
  'marketJ.boughtN':     { en: '{{n}} times · {{rate}} Gold/sec now', es: '{{n}} veces · ahora {{rate}} Oro/seg' },
  'marketJ.boughtRate':  { en: '{{rate}} Gold/sec now', es: 'Ahora {{rate}} Oro/seg' },
  'marketJ.held':        { en: 'Owned', es: 'Tuyo' },
  'marketJ.maxed':       { en: 'Maxed', es: 'Al maximo' },
  'marketJ.detailsHint': { en: 'Search, filters, the Eclipse and where your Gold comes from', es: 'Busqueda, filtros, el Eclipse y de donde sale tu Oro' },
  'marketJ.find':        { en: 'Find something', es: 'Buscar algo' },
  'marketJ.shelf':       { en: 'About this shelf', es: 'Sobre este estante' },
};
