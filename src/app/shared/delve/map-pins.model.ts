/**
 * map-pins.model.ts — the Keeper's own pins on the Delve map (map v2,
 * docs/world/delve-and-beyond.md §6.1; docs/handoff/bounties-map-v2.md).
 *
 * A pin is chosen by ICON (a pick, a fish, a chest, danger, a star, a door, a
 * camp, a question), so it reads in every language; it may also carry a short
 * name the Keeper types (default: the icon's own word). Up to MAX_PINS. Pins
 * live in the region of the cell they mark (delve-region.model.ts `p`), so they
 * ride the same IndexedDB store and the same 16 cloud slots as the digs there.
 *
 * No imports: the region model (eager, via cloud-save) reads these constants.
 */
export const PIN_ICONS = ['pick', 'fish', 'chest', 'danger', 'star', 'door', 'camp', 'question'] as const;
export type PinIcon = (typeof PIN_ICONS)[number];
/** Pins a Keeper can hold at once (spec §6.1: up to 12). */
export const MAX_PINS = 12;
/** A pin's name, at most this long. */
export const PIN_NAME_MAX = 24;

export interface MapPin {
  id: string;
  /** World cell: column (negative west of the core) and row. */
  col: number;
  row: number;
  icon: string;
  /** '' = the icon's own word. */
  name: string;
  /** Last edit, epoch ms. */
  t: number;
}

/** Pin colours: the art bible's map palette (style guide §5), one per icon. */
export const PIN_COLORS: Readonly<Record<PinIcon, string>> = {
  pick: '#ffb36b', fish: '#7fd6ff', chest: '#d9a35a', danger: '#ff6b6b', star: '#ffe48a', door: '#c8b4ff', camp: '#ff9b4f', question: '#e6e0f5',
};
/** Glim's temporary mark (a hint ladder's step 3): its lamplight. */
export const GLIM_MARK_COLOR = '#ffd36d';

/** A name as stored: printable, trimmed, at most PIN_NAME_MAX characters. */
export function cleanPinName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, PIN_NAME_MAX);
}

/** A fresh pin id: 8 base-36 characters. */
export function newPinId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 8; i++) id += Math.floor(random() * 36).toString(36);
  return id;
}
