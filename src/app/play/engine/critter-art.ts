/**
 * critter-art.ts — the Living World's critters, pixel and chibi (docs/handoff/living-world.md;
 * BRIEF "Art"): round bodies, big eyes with a white highlight, rosy cheeks, tiny feet, lit from
 * the upper left, one 1-px outline (keeper-paint OUTLINE) added round every frame by the painter,
 * colours from the Infernal ramps the wilds already wear (ember, ash, rift violet, grotto blue).
 *
 * ONE cached sheet per critter type (all its frames side by side), painted once per session; a
 * critter costs one blit a frame. Drawn at 2 world px per art px (the Delve's grid). Also the
 * day's mysteries: a door that was not there yesterday (one sheet, shut and open) and the wisp.
 */
import { OUTLINE } from '../../shared/keeper-look/keeper-paint';
import type { CritterId } from './living-world';

/** World px per art px (the Delve's and the One World figures' grid). */
export const CRITTER_PIXEL = 2;

interface CritterArt { palette: Readonly<Record<string, string>>; frames: readonly (readonly string[])[] }

const EYE = '#140c1c', WHITE = '#ffffff', CHEEK = '#ff8a9a';

/**
 * Frames per critter, facing right. `.` is clear; every other letter is a palette slot
 * (`e` eye, `w` its highlight, `c` cheek are shared). The outline is added by the painter.
 */
export const CRITTER_ART: Readonly<Record<CritterId | 'door', CritterArt>> = {
  // A cinder finch: an ember-orange puffball, a cream belly, a yellow beak. Sit, hop, two wingbeats.
  'cinder-finch': {
    palette: { b: '#c9603a', d: '#7a2a22', l: '#ffb066', u: '#ffe1b0', a: '#ffd36d', e: EYE, w: WHITE, c: CHEEK },
    frames: [
      ['....lbb...', '...lbbbbb.', '..lbbbbwb.', '.dlbbbbeaa', 'dbbuuucbb.', '.dbuuuubd.', '..ddbbdd..', '...a..a...'],
      ['.d..lbb...', '.dd.bbbbb.', '..dbbbbwb.', '.dlbbbbeaa', 'dbbuuucbb.', '.dbuuuubd.', '..ddbbdd..', '..a....a..'],
      ['dd..lbb...', '.ddlbbbbb.', '..ddbbbwb.', '..lbbbbeaa', '.bbuuucbb.', '.dbuuuubd.', '..ddbbdd..', '..........'],
      ['....lbb...', '...lbbbbb.', '..lbbbbwb.', '.dlbbbbeaa', 'ddbuuucbb.', 'dddduuubd.', '..ddbbdd..', '..........'],
    ],
  },
  // An ash hare: a round tan bun with tall ears (pink inside), a twitchy nose. Sit, and a hop.
  'ash-hare': {
    palette: { b: '#a08a6a', d: '#6e5a44', l: '#d8c4a0', p: '#ff9aa8', a: '#ff9aa8', e: EYE, w: WHITE, c: CHEEK },
    frames: [
      ['.....lb.lb..', '.....lp.lp..', '.....lb.lb..', '....lbbbbb..', '...lbbbbbwb.', '..lbbbbbbeba', '.lbbbbbbcbb.', 'dlbbbbbbbbd.', 'dbbbbbbbbd..', '.ddd..dd....'],
      ['......lb.lb.', '......lp.lp.', '.....lbbbbb.', '....lbbbbwb.', '...lbbbbbeba', '.lbbbbbbcbb.', 'dlbbbbbbbbd.', '.dbbbbbbbd..', 'dd.....dd...', '............'],
    ],
  },
  // An ember beetle: a glossy red-orange shell with gold spots, a small dark head. Two leg steps.
  'ember-beetle': {
    palette: { b: '#c4501e', d: '#6e2a1e', l: '#ff8040', s: '#ffd36d', h: '#3a1a14', e: EYE, w: WHITE },
    frames: [
      ['...lll....', '..lbsbbd..', '.lbbbbsbhh', '.bsbbbbdhw', '.dbbbsbdhe', '..dddddd..', '..h.h.h...'],
      ['...lll....', '..lbsbbd..', '.lbbbbsbhh', '.bsbbbbdhw', '.dbbbsbdhe', '..dddddd..', '...h.h.h..'],
    ],
  },
  // A dusk moth: soft rift-violet wings, a fuzzy little body, two antennae. Wings open, wings closed.
  'dusk-moth': {
    palette: { b: '#b88cff', d: '#6a5878', l: '#e8d8ff', f: '#4a3a5a', a: '#e8d8ff', e: EYE, w: WHITE },
    frames: [
      ['..a...a..', 'll.a.a.ll', 'lbb.f.bbl', 'bbbfwfbbb', 'dbbfefbbd', '.dd.f.dd.', '....f....'],
      ['..a...a..', '...a.a...', '..lbfbl..', '..bbwbb..', '..dbebd..', '...dfd...', '....f....'],
    ],
  },
  // A glowworm: a pale-blue grub with a glowing tail. Curled, and stretched.
  'glowworm': {
    palette: { b: '#86d2e6', d: '#2c5668', l: '#d0f6ff', g: '#f0ffff', e: EYE, w: WHITE },
    frames: [
      ['.........', '.gg..lbb.', 'gglbbbbwb', '.ddbbbbe.', '..dddd...'],
      ['.........', 'gg...lbb.', 'ggllbbbwb', '.dbbbbbbe', '..ddddd..'],
    ],
  },
  // A leaping fish: a round blue fish, a lighter belly, a little fin. Two bends of the leap.
  'leaping-fish': {
    palette: { b: '#7fc8ff', d: '#2c5668', l: '#d0f6ff', f: '#4a8296', e: EYE, w: WHITE },
    frames: [
      ['....ff...', 'f.lbbbb..', 'ffbbbbwb.', 'fbbllbeb.', 'f.dllbb..', '...dd....'],
      ['.....ff..', '.f.lbbbb.', '.ffbbbbwb', 'ff.bllbeb', '...dllbb.', '....dd...'],
    ],
  },
  // A door that was not there yesterday: an arched door in the rock, a violet rune on it. Shut, and open.
  'door': {
    palette: { b: '#7a5a36', d: '#3a2617', l: '#c9a06a', r: '#b88cff', g: '#e8d8ff', k: '#140a1f', s: '#fff4d0' },
    frames: [
      ['.....dddddd.....', '...ddllllbbdd...', '..dllbbbbbbbbd..', '.dlbbbbbbbbbbbd.', '.dlbbbdbbdbbbbd.', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd',
        'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbrrbbd', 'dlbbbbdbbdbrgbbd', 'dlbbbbdbbdbrrbbd', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd',
        'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd', 'dlbbbbdbbdbbbbbd', 'dddddddddddddddd'],
      ['.....dddddd.....', '...ddkkkkkkdd...', '..dkkkkkkkkkkd..', '.dkkkkkkkkkksld.', '.dkkkkkkkksssld.', 'dkkkkkkkksssssld', 'dkkkkkkkssssssld', 'dkkkkkkkssssssld',
        'dkkkkkkkksssssld', 'dkkkkkkkkksssbld', 'dkkkkkkkkkkssbld', 'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld',
        'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld', 'dkkkkkkkkkkkkbld', 'dddddddddddddddd'],
    ],
  },
};

/** A frame's size in art px (before the outline's one-pixel ring on every side). */
export function frameSize(id: CritterId | 'door'): { w: number; h: number } {
  const f = CRITTER_ART[id].frames[0];
  return { w: Math.max(...f.map(row => row.length)), h: f.length };
}

/**
 * The colour of art pixel (x, y) of a frame, with its outline ring: the sheet's cell is
 * (w + 2) × (h + 2) and the map sits at (1, 1). '' is clear. Pure (the spec checks it).
 */
export function critterPixel(id: CritterId | 'door', frame: number, x: number, y: number): string {
  const art = CRITTER_ART[id], rows = art.frames[frame % art.frames.length];
  const at = (cx: number, cy: number) => {
    const ch = rows[cy - 1]?.[cx - 1];
    return ch && ch !== '.' ? (art.palette[ch] ?? '') : '';
  };
  const own = at(x, y);
  if (own) return own;
  return at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? OUTLINE : '';
}

const sheets = new Map<string, HTMLCanvasElement | null>();
/** Every frame of one critter, side by side, painted once. Null without a canvas (SSR, node tests). */
export function critterSheet(id: CritterId | 'door'): HTMLCanvasElement | null {
  if (sheets.has(id)) return sheets.get(id)!;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') { sheets.set(id, null); return null; }
  const { w, h } = frameSize(id), fw = w + 2, fh = h + 2, n = CRITTER_ART[id].frames.length;
  const canvas = document.createElement('canvas');
  canvas.width = fw * n; canvas.height = fh;
  const c = canvas.getContext('2d');
  if (!c) { sheets.set(id, null); return null; }
  for (let f = 0; f < n; f++) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const colour = critterPixel(id, f, x, y);
    if (!colour) continue;
    c.fillStyle = colour; c.fillRect(f * fw + x, y, 1, 1);
  }
  sheets.set(id, canvas);
  return canvas;
}

/**
 * Blit one frame with its feet (bottom centre) at (x, y), facing left or right. One drawImage.
 * `scale` is world px per art px.
 */
export function drawCritter(c: CanvasRenderingContext2D, id: CritterId | 'door', frame: number, x: number, y: number, facing: number, scale = CRITTER_PIXEL): void {
  const sheet = critterSheet(id);
  if (!sheet) return;
  const { w, h } = frameSize(id), fw = w + 2, fh = h + 2, n = CRITTER_ART[id].frames.length;
  const f = ((frame % n) + n) % n;
  const dw = fw * scale, dh = fh * scale;
  const left = Math.round(x - dw / 2), top = Math.round(y - dh);
  if (facing < 0) {
    c.save(); c.translate(left + dw, top); c.scale(-1, 1);
    c.drawImage(sheet, f * fw, 0, fw, fh, 0, 0, dw, dh);
    c.restore();
  } else c.drawImage(sheet, f * fw, 0, fw, fh, left, top, dw, dh);
}
