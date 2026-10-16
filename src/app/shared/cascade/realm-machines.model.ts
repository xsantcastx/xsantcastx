/**
 * realm-machines.model.ts — the slot machines to discover, one per realm Delve
 * (owner 2026-10-15: "are there other slot machines to discover?";
 * docs/handoff/eclipse-cascade.md has the full specs).
 *
 * Each is a physical machine standing in its realm's Delve. Walk up and press
 * E: the first time, the games ledger notes it found (`PlayLedgerService.markFound`,
 * merge-safe: a found machine stays found) and it installs as a Mirror Slate
 * app; it is playable at the machine itself with or without a Slate.
 *
 *   Celestial — the Orrery Tumbler (BUILT): 7×7, the down turns after every
 *               tumble, a sticky orbit ladder in the round. Orrery Wells.
 *   Umbral    — the Inkwell (spec): sticky wilds that only stay in the dark.
 *   Verdant   — the Rootreel (spec): reels that grow a row with every win.
 *   Luminous  — the Prism Lines (spec): light beams that bend through mirrors as paylines.
 *
 * Placement is in cells of the realm's core (the Gate Hollow every realm
 * shares, realm-kit CORE_HOLLOW: interior rows 24..30, floor row 31, cols
 * 16..47), so a machine stands on the same floor on every seed (the core is
 * hand-laid). Pure, no imports: check-meaning and the node tests load it.
 */

export type RealmMachineStatus = 'built' | 'spec';

export interface RealmMachine {
  id: string;
  realm: 'celestial' | 'umbral' | 'verdant' | 'luminous';
  status: RealmMachineStatus;
  /** The area it stands in (play/world/towns/*-delve.ts). */
  area: string;
  /** Core cell: its column and the row of the floor its feet stand on. */
  col: number;
  floorRow: number;
  /** Its twist, one line (Details, the handoff). */
  twist: string;
  /** Found in… (Codex / check-meaning). */
  foundIn: string;
  /** What finding and playing it gives. */
  use: string;
  /** Lore (also `cascade.lore.<id>` in cascade.i18n.ts, EN + ES, for a built one). */
  lore: string;
}

export const REALM_MACHINES: readonly RealmMachine[] = [
  {
    id: 'orrery-tumbler', realm: 'celestial', status: 'built', area: 'celestial-delve', col: 21, floorRow: 31,
    twist: 'Gravity turns: after every tumble the new stars fall up, then down; a sticky orbit ladder (to ×50) in the round.',
    foundIn: 'The Orrery Wells: the Gate Hollow, west of the return gate (a Meridian surveyors\' machine)',
    use: 'Gold only: play it at the machine, and once found, anywhere on the Mirror Slate',
    lore: 'The Meridian Compact\'s surveyors built a game from the orrery\'s spare brass: seven by seven stars falling toward whichever down the rings decide.',
  },
  {
    id: 'inkwell', realm: 'umbral', status: 'spec', area: 'umbral-delve', col: 21, floorRow: 31,
    twist: 'Sticky wilds in the dark: a wild that lands on an unlit cell stays until the lamp row sweeps it.',
    foundIn: 'The Ink Deeps: the Gate Hollow (spec)',
    use: 'Gold only (spec)',
    lore: 'The Unrecorded kept a well of ink that remembered every blot; what falls into the dark stays written.',
  },
  {
    id: 'rootreel', realm: 'verdant', status: 'spec', area: 'verdant-delve', col: 21, floorRow: 31,
    twist: 'Growing reels: every win grows each reel by a row (3 → 7), ways rise from 243 to 16,807; reset each paid spin.',
    foundIn: 'The Root Deeps: the Gate Hollow (spec)',
    use: 'Gold only (spec)',
    lore: 'Kesh Arbo\'s wardens carved a counting-wheel from living rootwood; it still grows when it is pleased.',
  },
  {
    id: 'prism-lines', realm: 'luminous', status: 'spec', area: 'luminous-delve', col: 21, floorRow: 31,
    twist: 'Light-beam lines: a sun-prism fires a beam across the reels; mirror symbols bend it, and every symbol it crosses joins the line.',
    foundIn: 'The Prism Mines: the Gate Hollow (spec)',
    use: 'Gold only (spec)',
    lore: 'Aureth\'s miners bet their shift on where the light would go; Lune Coyne learned her trade there.',
  },
];

/** The machines a player can find and play now. */
export const BUILT_REALM_MACHINES: readonly RealmMachine[] = REALM_MACHINES.filter(m => m.status === 'built');

/** World feet point of a machine: cells are 32 world px; `top` is the area's terrain top (engine FLOOR). */
export function machinePoint(m: RealmMachine, top: number, cell = 32): { x: number; y: number } {
  return { x: m.col * cell + cell / 2, y: top + m.floorRow * cell };
}
