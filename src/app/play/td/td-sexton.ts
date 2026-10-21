/**
 * td-sexton.ts — where the Sexton's Count happens in the top-down world (the chain's rules: shared/sexton). Pure
 * placement and a few pixels: the three chalk-marked stones in the Hushed Barrow, the ledger page on the barrow's
 * jetty-nook (there only in the dark), where the Row-Walker rises, and the vault's door and grave (maps/hushed-barrow).
 * The engine stands the stalls, raises the Row-Walker and paints these; the host records what the Keeper did.
 */
import { TILE } from './td-art';
import { NIGHTROADS } from './td-dark';
import { EMBER_ISLE_DEF } from './maps/ember-isle';
import { HUSHED_BARROW_1 } from './maps/hushed-barrow';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';

export const SEXTON_CONTINENT = 'ember-isle';
export const SEXTON_VAULT = HUSHED_BARROW_1.id;

/** The Hushed Barrow's centre (tiles): the island's graveyard. */
const barrow = EMBER_ISLE_DEF.places.find(p => p.kind === 'graveyard')!;
export const BARROW_AT: Readonly<{ c: number; r: number }> = { c: barrow.c, r: barrow.r };

/** The three chalk-marked stones: graves of the plot (td-world GRAVES offsets), the third the open one. */
export const SEXTON_STONES: readonly { n: 1 | 2 | 3; c: number; r: number }[] = [
  { n: 1, c: barrow.c - 4, r: barrow.r - 2 },
  { n: 2, c: barrow.c + 4, r: barrow.r + 2 },
  { n: 3, c: barrow.c + 5, r: barrow.r },
];

/** The ledger page: on the barrow's jetty-nook (td-dark NIGHTROADS 'barrow'), a corner away from the wet note. */
const nook = NIGHTROADS.find(n => n.id === 'barrow')!;
export const SEXTON_PAGE: Readonly<{ c: number; r: number }> = { c: nook.nook.c + 1, r: nook.nook.r + nook.nook.h - 1 };

/** Where the Row-Walker rises: between the plot's rows, south of the door. */
export const WALKER_AT: Readonly<{ c: number; r: number }> = { c: barrow.c, r: barrow.r + 1 };
/** Seconds before a Row-Walker that fell (and was not credited) rises again; how near the plot the Keeper must be. */
export const WALKER = { again: 20, reach: 30, name: 'Hollis the Row-Walker' } as const;

/** A tile of the vault map holding `ch` (its first), in tiles. */
function vaultTile(ch: string): { c: number; r: number } {
  const r = HUSHED_BARROW_1.rows.findIndex(row => row.includes(ch));
  return { c: HUSHED_BARROW_1.rows[r].indexOf(ch), r };
}
export const VAULT_KEYHOLE = vaultTile('k');
export const VAULT_GRAVE = vaultTile('N');
export const VAULT_UNCOUNTED = vaultTile('X');

/** The stall spot of a thing on tile (c, r) (its foot, a little in front, as the maps' stations stand). */
export function stallSpot(c: number, r: number): { x: number; y: number } { return { x: c * TILE + TILE / 2, y: r * TILE + TILE + 6 }; }

/** The page is only there in the dark: at night or under an eclipse, while the chain is at it. */
export function pageShown(step: string, phase: SkyPhase): boolean { return step === 'page' && (phase === 'night' || phase === 'eclipse'); }

/** What the Seek points at for a step (the chain's model says which; this says where). */
export type SextonSpot = { level: string | null; x: number; y: number };
export function seekSpot(step: string): { target: string; spot: SextonSpot | null } | null {
  switch (step) {
    case 'stones': return { target: 'stones', spot: { level: null, ...stallSpot(BARROW_AT.c, BARROW_AT.r) } };
    case 'page': return { target: 'nook', spot: { level: null, ...stallSpot(SEXTON_PAGE.c, SEXTON_PAGE.r) } };
    case 'key': return { target: 'walker', spot: { level: null, ...stallSpot(WALKER_AT.c, WALKER_AT.r) } };
    case 'door': return { target: 'door', spot: { level: SEXTON_VAULT, ...stallSpot(VAULT_KEYHOLE.c, VAULT_KEYHOLE.r) } };
    case 'uncounted': case 'grave': return { target: 'grave', spot: { level: SEXTON_VAULT, ...stallSpot(VAULT_GRAVE.c, VAULT_GRAVE.r) } };
    // Wren stands in the town: the engine finds him among the keepers.
    case 'return': return { target: 'wren', spot: null };
    default: return null;
  }
}

// ── Pixels ─────────────────────────────────────────────────────────────────────

const CHALK = '#f4efe2', INK = '#2a1a24', PAGE = '#e8e1cf', LINE = '#8a7f6c', GLOW = '#b8e8d8';

/** A chalk tick on a marked stone (unread: a cross; read: a tick), drawn over the stone's face. (x, y) the stone's foot. */
export function chalkMark(c: CanvasRenderingContext2D, x: number, y: number, read: boolean, time: number, still: boolean): void {
  x = Math.round(x); y = Math.round(y) - 9;
  c.fillStyle = CHALK;
  if (read) { c.fillRect(x - 2, y + 1, 1, 1); c.fillRect(x - 1, y + 2, 1, 1); c.fillRect(x, y + 1, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x + 2, y - 1, 1, 1); return; }
  for (let i = -2; i <= 2; i++) { c.fillRect(x + i, y + i, 1, 1); c.fillRect(x + i, y - i, 1, 1); }
  // Unread: a slow pale glint above it, so the marked three can be found in the rows (still: a fixed dot).
  const k = still ? 0 : Math.floor(time * 2) % 4;
  c.globalAlpha = k === 3 ? .4 : .85;
  c.fillRect(x, y - 6, 1, 1); c.fillRect(x - 1, y - 5, 3, 1); c.fillRect(x, y - 4, 1, 1);
  c.globalAlpha = 1;
}

/** The ledger page on the nook: a torn page under a pebble, its ink faintly lit (it is only there in the dark). */
export function ledgerPage(c: CanvasRenderingContext2D, x: number, y: number, alpha: number, time: number, still: boolean): void {
  x = Math.round(x); y = Math.round(y);
  c.globalAlpha = alpha * (still ? .35 : .25 + .15 * Math.sin(time * 2));
  c.fillStyle = GLOW; c.fillRect(x - 8, y - 6, 16, 9);
  c.globalAlpha = alpha;
  c.fillStyle = INK; c.fillRect(x - 6, y - 5, 12, 7);
  c.fillStyle = PAGE; c.fillRect(x - 5, y - 4, 10, 5); c.fillRect(x + 5, y - 4, 1, 2);
  c.fillStyle = LINE; for (const [dx, w] of [[-4, 6], [-4, 7], [-4, 4]] as const) c.fillRect(x + dx, y - 3 + (w === 7 ? 1 : w === 4 ? 2 : 0), w, 1);
  c.fillStyle = '#5a4a5e'; c.fillRect(x - 2, y - 6, 3, 2);
  c.globalAlpha = 1;
}
