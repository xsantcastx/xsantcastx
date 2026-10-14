/**
 * Strings shared by every game of chance (win banners, bet stepper). Lazy:
 * registered by the game components, never in the eager table.
 */
export const GAMES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'games.win.big': { en: 'Big win', es: 'Gran premio' },
  'games.win.mega': { en: 'Mega win', es: 'Megapremio' },
  'games.win.eclipse': { en: 'Eclipse win', es: 'Premio Eclipse' },
  'games.win.times': { en: '×{{n}} your bet', es: '×{{n}} tu apuesta' },
  'games.win.gold': { en: '+{{n}} Gold', es: '+{{n}} Oro' },
  'games.win.done': { en: 'Collect', es: 'Recoger' },
  'games.bet.label': { en: 'Bet', es: 'Apuesta' },
  'games.bet.less': { en: 'Lower the bet', es: 'Bajar la apuesta' },
  'games.bet.more': { en: 'Raise the bet', es: 'Subir la apuesta' },
  'games.bet.cap': { en: 'Highest bet now: {{n}} Gold (two minutes of your income).', es: 'Apuesta maxima ahora: {{n}} de Oro (dos minutos de tus ingresos).' },
  'games.goldOnly': { en: 'Gold only. Nothing here can be bought with money.', es: 'Solo Oro. Nada aqui se compra con dinero.' },
};
