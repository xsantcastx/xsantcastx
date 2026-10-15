/**
 * machine-art.ts — the realm machines in the world (shared/cascade/realm-machines.model.ts):
 * the Orrery Tumbler, a Meridian surveyors' brass cabinet with a little orrery
 * on top and a 3 × 3 star screen. 16 × 26 art px on the one pixel grid (2 world
 * px per art px in the Delve), one 1-px outline (keeper-paint OUTLINE), lit from
 * the upper left, brass and star colours from the Orrery Wells' ramps.
 *
 * Two frames on ONE cached sheet (painted once per session, one blit per frame):
 * the screen's stars twinkle between them. Reduced motion holds frame 0.
 */
import { OUTLINE } from '../../shared/keeper-look/keeper-paint';

export const MACHINE_W = 16;
export const MACHINE_H = 26;
export type MachineFrame = 0 | 1;

const ROWS: readonly string[] = [
  '.....oooooo.....',
  '....oBBbbbbo....',
  '...oBo....obo...',
  '...oBo.yy.obo...',
  '...obo.yy.odo...',
  '....obbbbddo....',
  '......obdo......',
  '.oooooooooooooo.',
  'oBBBBBBbbbbbbbdo',
  'oBooooooooooobdo',
  'oBogggggggggobdo',
  'oBogcgygpgcgobdo',
  'oBogggggggggobdo',
  'oBogpgcgygpgobdo',
  'oBogggggggggobdo',
  'oBogygpgcgygobdo',
  'oBogggggggggobdo',
  'oBooooooooooobdo',
  'oBBbbbbbbbbbbbdo',
  'oBbbrrrrrrrbbbdo',
  'oBbbbbbbbbbbbddo',
  'obbbbbbbbbbbbddo',
  'oddddddddddddddo',
  '.oooooooooooooo.',
  '..okko....okko..',
  '..oooo....oooo..',
];

const PALETTE: Readonly<Record<string, string>> = {
  o: OUTLINE, B: '#f2d48a', b: '#c9a04a', d: '#7a5a22', g: '#0e1428',
  c: '#5fb6ff', y: '#f2c94c', p: '#d8b8ff', w: '#ffffff', r: '#e8c47a', k: '#3a2a14',
};
/** Frame 1: the screen's stars trade places, one flares white. */
const TWINKLE: Readonly<Record<string, string>> = { c: 'p', p: 'c', y: 'w' };

/** The colour of art pixel (x, y) in a frame, or '' (clear). Pure: the spec checks it stays in its box. */
export function machinePixel(x: number, y: number, frame: MachineFrame): string {
  if (x < 0 || y < 0 || x >= MACHINE_W || y >= MACHINE_H) return '';
  let ch = ROWS[y]?.[x] ?? '.';
  // The orrery's planet (rows 3–4) never twinkles; the screen (rows 10–16) does.
  if (frame === 1 && y >= 10 && y <= 16) ch = TWINKLE[ch] ?? ch;
  return ch === '.' ? '' : PALETTE[ch] ?? '';
}

let sheet: HTMLCanvasElement | null | undefined;
function machineSheet(): HTMLCanvasElement | null {
  if (sheet !== undefined) return sheet;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return (sheet = null);
  const canvas = document.createElement('canvas');
  const d = canvas.getContext?.('2d');
  if (!d) return (sheet = null);
  canvas.width = MACHINE_W * 2; canvas.height = MACHINE_H;
  for (const frame of [0, 1] as const) {
    for (let y = 0; y < MACHINE_H; y++) for (let x = 0; x < MACHINE_W; x++) {
      const colour = machinePixel(x, y, frame);
      if (colour) { d.fillStyle = colour; d.fillRect(frame * MACHINE_W + x, y, 1, 1); }
    }
  }
  return (sheet = canvas);
}

/** Blit one machine, its feet at (x, y), `scale` world px per art px. World space (camera applied). */
export function drawMachine(c: CanvasRenderingContext2D, x: number, y: number, frame: MachineFrame, scale: number): void {
  const art = machineSheet();
  if (!art) return;
  const smooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(art, frame * MACHINE_W, 0, MACHINE_W, MACHINE_H, Math.round(x - MACHINE_W * scale / 2), Math.round(y - MACHINE_H * scale), MACHINE_W * scale, MACHINE_H * scale);
  c.imageSmoothingEnabled = smooth;
}
