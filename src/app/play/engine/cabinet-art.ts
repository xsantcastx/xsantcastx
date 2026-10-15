/**
 * cabinet-art.ts — the Lost Cabinets in the world (shared/cabinets): a little
 * chibi curio cabinet, 12 × 16 art px, on the one pixel grid (4 world px per
 * art px on the surface, 2 in the Delve), one 1-px outline (keeper-paint
 * OUTLINE), lit from the upper left, colours from the art-bible ramps the
 * high roads already use (courier wood and brass, the Archive's ruin violet
 * for its moon-mirror latch).
 *
 * Three frames on ONE cached sheet (painted once per session, one blit per
 * cabinet per frame): shut, shut with the latch glinting (it has shown itself
 * in the Slate's glass), and open (the door swung back, the shelves empty).
 */
import { OUTLINE } from '../../shared/keeper-look/keeper-paint';

export const CABINET_W = 12;
export const CABINET_H = 16;
export type CabinetFrame = 0 | 1 | 2;

const WOOD = { lit: '#c9a46a', mid: '#7a5a36', dark: '#5a3c1a' };
const BRASS = { mid: '#a5793a', lit: '#e8c898', shine: '#f8e8c8' };
const GLASS = { body: '#463650', shine: '#d9b8ff', deep: '#1e1428' };
const LATCH = { dim: '#6a5878', lit: '#a855f7', glint: '#d9b8ff' };
const CURIO = { gold: '#e8c898', mint: '#7fd5a3' };

/** The colour of art pixel (x, y) in a frame, or '' (clear). Pure: the spec checks it stays inside its box. */
export function cabinetPixel(x: number, y: number, frame: CabinetFrame): string {
  const open = frame === 2, glint = frame === 1;
  if (x < 0 || y < 0 || x >= CABINET_W || y >= CABINET_H) return '';
  // A rounded brass crest on top.
  if (y === 0) return x >= 3 && x <= 8 ? OUTLINE : '';
  if (y === 1) return x === 2 || x === 9 ? OUTLINE : x > 2 && x < 9 ? (x === 5 || x === 6 ? BRASS.shine : BRASS.lit) : '';
  if (y === 2) return x === 1 || x === 10 ? OUTLINE : x > 1 && x < 10 ? WOOD.lit : '';
  // Two tiny feet.
  if (y === 15) return x === 1 || x === 2 || x === 9 || x === 10 ? OUTLINE : '';
  if (y === 14) return x === 1 || x === 2 || x === 9 || x === 10 ? WOOD.dark : x === 0 || (x >= 3 && x <= 8) || x === 11 ? OUTLINE : '';
  // The body: lit left side, dark right side, a dark base.
  if (x === 0 || x === 11) return OUTLINE;
  if (y === 13) return WOOD.dark;
  if (x === 1) return WOOD.lit;
  if (x === 10) return WOOD.dark;
  // The door frame, and the moon-mirror latch on its right post.
  const frameX = x === 2 || x === 9, frameY = y === 3 || y === 12;
  if (x === 9 && (y === 7 || y === 8)) return open ? LATCH.dim : glint ? LATCH.glint : LATCH.lit;
  if (frameX || frameY) return open && x === 2 ? GLASS.body : WOOD.mid;
  // Inside the glass: one brass shelf, a curio on each shelf (or nothing, open).
  if (y === 8) return BRASS.mid;
  if (open) return x === 3 ? GLASS.body : GLASS.deep;
  if ((y === 6 || y === 7) && (x === 4 || x === 5)) return y === 6 && x === 4 ? BRASS.shine : CURIO.gold;
  if ((y === 10 || y === 11) && (x === 6 || x === 7)) return y === 10 && x === 6 ? '#c4ffe0' : CURIO.mint;
  if (x - 3 === y - 4 && y < 7) return GLASS.shine;
  if (glint && x === 8 && y === 4) return '#ffffff';
  return GLASS.body;
}

let sheet: HTMLCanvasElement | null | undefined;
/** The three frames side by side, painted once. Null without a canvas (SSR, node tests). */
function cabinetSheet(): HTMLCanvasElement | null {
  if (sheet !== undefined) return sheet;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return (sheet = null);
  const canvas = document.createElement('canvas');
  const d = canvas.getContext?.('2d');
  if (!d) return (sheet = null);
  canvas.width = CABINET_W * 3; canvas.height = CABINET_H;
  for (const frame of [0, 1, 2] as const) {
    for (let y = 0; y < CABINET_H; y++) for (let x = 0; x < CABINET_W; x++) {
      const colour = cabinetPixel(x, y, frame);
      if (colour) { d.fillStyle = colour; d.fillRect(frame * CABINET_W + x, y, 1, 1); }
    }
  }
  return (sheet = canvas);
}

/** Blit one cabinet, its feet at (x, y), `scale` world px per art px. World space (camera applied). */
export function drawCabinet(c: CanvasRenderingContext2D, x: number, y: number, frame: CabinetFrame, scale: number): void {
  const art = cabinetSheet();
  if (!art) return;
  const smooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(art, frame * CABINET_W, 0, CABINET_W, CABINET_H, Math.round(x - CABINET_W * scale / 2), Math.round(y - CABINET_H * scale), CABINET_W * scale, CABINET_H * scale);
  c.imageSmoothingEnabled = smooth;
}
