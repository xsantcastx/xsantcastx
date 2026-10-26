/**
 * gather-keys.ts — the stack keys the gathering loops land (shared/gathering/gathering.model.ts), copied here with no
 * imports so the satchel's pile rule (inventory-layout stackCapOf) does not pull the gathering tables into the initial
 * bundle. gathering.spec pins the two lists together.
 *
 * They pile 20 to a cell, so a satchel fills the RuneScape way: fish until the satchel is full.
 */
export const GATHER_PILE_CAP = 20;
export const GATHER_PILE_KEYS: ReadonlySet<string> = new Set([
  'ashwood-log', 'char-oak-log', 'rootglass-bough', 'cypress-log',
  'ash-perch', 'mirrorfin', 'rootling-eel', 'mire-carp', 'lampfish', 'moonbelly',
  'baked-ash-perch', 'seared-mirrorfin', 'smoked-rootling-eel', 'mire-carp-supper', 'lampfish-fry', 'moonbelly-fillet',
  'burnt-fish',
]);
