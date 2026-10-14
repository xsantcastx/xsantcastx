/**
 * ledger.i18n.ts — "The Ledger" stats block on /character. Lazy: registered by
 * ForgeKeeperComponent's constructor. Gold / oro per docs/handoff/ux-consistency.md.
 */
export const LEDGER_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'keeperLedger.title':          { en: 'The Ledger', es: 'El Libro de cuentas' },
  'keeperLedger.note':           { en: 'every number the realm has counted since you arrived', es: 'cada cifra que el reino ha contado desde que llegaste' },
  'keeperLedger.totalXp':        { en: 'Total XP', es: 'XP total' },
  'keeperLedger.totalXp.note':   { en: 'earned all time', es: 'ganados en total' },
  'keeperLedger.loadout':        { en: 'Loadout', es: 'Equipo' },
  'keeperLedger.loadout.note':   { en: 'slots filled', es: 'ranuras ocupadas' },
  'keeperLedger.achievements':   { en: 'Achievements', es: 'Logros' },
  'keeperLedger.achievements.note': { en: 'fragments found', es: 'fragmentos hallados' },
  'keeperLedger.quests':         { en: 'Quests', es: 'Misiones' },
  'keeperLedger.quests.note':    { en: 'completed', es: 'completadas' },
  'keeperLedger.strikes':        { en: 'Flame Strikes', es: 'Golpes de llama' },
  'keeperLedger.strikes.note':   { en: 'on the anvil', es: 'en el yunque' },
  'keeperLedger.goldEarned':     { en: 'Gold Earned', es: 'Oro ganado' },
  'keeperLedger.goldEarned.note': { en: 'all time', es: 'en total' },
  'keeperLedger.goldRate':       { en: 'Gold / Second', es: 'Oro / segundo' },
  'keeperLedger.goldRate.note':  { en: 'while you read', es: 'mientras lees' },
  'keeperLedger.shards':         { en: 'Eclipse Shards', es: 'Fragmentos de Eclipse' },
  'keeperLedger.shards.forever': { en: '{{mult}} forever', es: '{{mult}} para siempre' },
  'keeperLedger.shards.none':    { en: 'no Eclipse taken', es: 'ningún Eclipse tomado' },
  'keeperLedger.streak':         { en: 'Current Streak', es: 'Racha actual' },
  'keeperLedger.bestStreak':     { en: 'Best Streak', es: 'Mejor racha' },
  'keeperLedger.day':            { en: 'day', es: 'día' },
  'keeperLedger.days':           { en: 'days', es: 'días' },
  'keeperLedger.arena':          { en: 'Arena Runs', es: 'Partidas de arena' },
  'keeperLedger.arena.note':     { en: 'gates entered', es: 'puertas cruzadas' },
};
