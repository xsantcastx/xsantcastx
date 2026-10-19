/**
 * keeper-front.ts — the chibi Keeper seen from the front and from behind, for
 * the top-down view (docs/design/top-down.md §2: four facings). The side views
 * stay KeeperPainter's; these two are painted in the same colours (its
 * `colors`), same chibi proportions (a big round head over a small body), and
 * baked once into one small sheet per Keeper: 2 facings × 4 frames (idle,
 * idle breath, step left, step right). Never a canvas per frame (play-memory).
 */
import { OUTLINE, type KeeperPainter, type Palette } from './keeper-paint';
import { RARITY_TRIM, STYLE_COLORS, type GearPiece, type KeeperGear } from './keeper-gear';

export type Facing = 'down' | 'up';
export const FRONT_W = 20;
export const FRONT_H = 36;
/** Feet: the sprite's anchor (art px from its top-left). */
export const FRONT_AX = 10;
export const FRONT_AY = 35;
/** The frame where the Keeper looks at the Slate in their hands (facing down only). */
export const PHONE_FRAME = 4;
/** The frame where the Keeper casts: staff raised high, its orb flaring (facing down). */
export const CAST_FRAME = 5;
const FRAMES = 6;

const sheets = new WeakMap<KeeperPainter, HTMLCanvasElement>();
const staffSheets = new WeakMap<KeeperPainter, HTMLCanvasElement>();

function px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }

/** frame: 0 idle, 1 breath, 2 step (left foot forward), 3 step (right foot forward), 4 the Slate held up and looked at. */
function paint(c: CanvasRenderingContext2D, p: Readonly<Palette>, facing: Facing, frame: number, ox: number, staff = false, gear: KeeperGear | null = null): void {
  const phone = frame === PHONE_FRAME;
  const cast = frame === CAST_FRAME;
  const bob = frame === 1 ? 1 : frame === 2 || frame === 3 ? -1 : 0;
  const x = ox + 3, top = 2 + Math.max(0, bob);
  // Legs and boots (stepping lifts one foot).
  const lLift = frame === 2 ? 2 : 0, rLift = frame === 3 ? 2 : 0;
  px(c, x + 4, top + 25, 3, 6 - lLift, p.trousers); px(c, x + 7, top + 25, 3, 6 - rLift, p.trousers);
  px(c, x + 3, top + 31 - lLift, 4, 2, '#3a2a24'); px(c, x + 7, top + 31 - rLift, 4, 2, '#3a2a24');
  // Body (tunic) with a belt and trim.
  px(c, x + 2, top + 14, 10, 11, p.tunic);
  px(c, x + 2, top + 14, 10, 2, p.tunicHi);
  px(c, x + 2, top + 21, 10, 1, p.trim);
  px(c, x + 2, top + 23, 10, 2, p.tunicLo);
  if (facing === 'down') px(c, x + 6, top + 15, 2, 6, p.trim);
  if (phone && facing === 'down') {
    // Both forearms bent up to the chest, the Slate between the hands, its screen lighting the face from below.
    px(c, x, top + 15, 2, 5, p.tunicLo); px(c, x + 12, top + 15, 2, 5, p.tunicLo);
    px(c, x + 1, top + 19, 4, 2, p.tunicLo); px(c, x + 9, top + 19, 4, 2, p.tunicLo);
    px(c, x + 3, top + 18, 2, 3, p.skin); px(c, x + 9, top + 18, 2, 3, p.skin);
    px(c, x + 4, top + 16, 6, 6, '#241c2c'); px(c, x + 5, top + 17, 4, 4, '#9fe8ff'); px(c, x + 5, top + 17, 4, 1, '#e6fbff');
  } else {
    // Arms swing with the step.
    const la = frame === 3 ? 1 : 0, ra = frame === 2 ? 1 : 0;
    px(c, x, top + 15 + la, 2, 7, p.tunicLo); px(c, x + 12, top + 15 + ra, 2, 7, p.tunicLo);
    px(c, x, top + 22 + la, 2, 2, p.skin); px(c, x + 12, top + 22 + ra, 2, 2, p.skin);
  }
  // Head: a big round chibi head.
  const hx = x - 1, hy = top;
  px(c, hx + 2, hy + 1, 12, 13, p.skin);
  px(c, hx + 1, hy + 3, 14, 9, p.skin);
  if (staff) {
    // The undead Warlock (owner, 2026-10-20): a deep hood over the head, the face pale and hollow, eyes burning violet.
    const hood = p.tunic, hoodLo = p.tunicLo, hoodHi = p.tunicHi;
    if (facing === 'down') {
      px(c, hx + 1, hy - 1, 14, 5, hood); px(c, hx, hy + 2, 3, 11, hood); px(c, hx + 13, hy + 2, 3, 11, hood);
      px(c, hx + 3, hy - 1, 10, 1, hoodHi); px(c, hx + 3, hy + 3, 10, 1, hoodLo);
      px(c, hx + 4, hy + 5, 8, 1, p.skinLo);
      if (frame === 1) { px(c, hx + 4, hy + 8, 3, 1, '#b06bff'); px(c, hx + 9, hy + 8, 3, 1, '#b06bff'); }
      else { px(c, hx + 4, hy + 7, 3, 2, '#2a1a2e'); px(c, hx + 9, hy + 7, 3, 2, '#2a1a2e'); px(c, hx + 5, hy + 7, 2, 2, '#b06bff'); px(c, hx + 10, hy + 7, 2, 2, '#b06bff'); px(c, hx + 5, hy + 7, 1, 1, '#f0e0ff'); px(c, hx + 10, hy + 7, 1, 1, '#f0e0ff'); }
      // Hollow cheeks and a thin, stitched mouth.
      px(c, hx + 4, hy + 10, 1, 1, p.skinLo); px(c, hx + 11, hy + 10, 1, 1, p.skinLo);
      px(c, hx + 6, hy + 11, 4, 1, p.mouth); px(c, hx + 7, hy + 12, 1, 1, p.skinLo);
      // Bone clasp at the throat.
      px(c, x + 5, top + 14, 4, 2, p.trim);
    } else {
      px(c, hx + 1, hy - 1, 14, 14, hood); px(c, hx + 3, hy - 1, 10, 1, hoodHi); px(c, hx + 2, hy + 10, 12, 3, hoodLo);
      px(c, hx + 7, hy + 1, 2, 10, hoodLo);
    }
  } else if (facing === 'down') {
    // Hair: a dome with a fringe; sides to the ears.
    px(c, hx + 2, hy, 12, 4, p.hair); px(c, hx + 1, hy + 2, 2, 7, p.hair); px(c, hx + 13, hy + 2, 2, 7, p.hair);
    px(c, hx + 3, hy + 4, 3, 2, p.hair); px(c, hx + 9, hy + 4, 4, 2, p.hair);
    px(c, hx + 4, hy, 6, 1, p.hairHi);
    // Eyes (2×3 with a highlight), blush, a small mouth; a blink on the breath frame.
    if (frame === 1) { px(c, hx + 4, hy + 8, 3, 1, OUTLINE); px(c, hx + 9, hy + 8, 3, 1, OUTLINE); }
    else if (phone) {
      // Eyes down at the screen; a cool glow on the cheeks.
      px(c, hx + 4, hy + 8, 3, 2, p.eyeDk); px(c, hx + 9, hy + 8, 3, 2, p.eyeDk);
      px(c, hx + 5, hy + 9, 2, 1, p.eye); px(c, hx + 10, hy + 9, 2, 1, p.eye);
      px(c, hx + 3, hy + 11, 10, 1, 'rgba(159,232,255,.35)');
    }
    else {
      px(c, hx + 4, hy + 6, 3, 4, p.eyeDk); px(c, hx + 9, hy + 6, 3, 4, p.eyeDk);
      px(c, hx + 5, hy + 7, 2, 3, p.eye); px(c, hx + 10, hy + 7, 2, 3, p.eye);
      px(c, hx + 5, hy + 6, 1, 1, '#ffffff'); px(c, hx + 10, hy + 6, 1, 1, '#ffffff');
    }
    px(c, hx + 3, hy + 10, 2, 1, p.blush); px(c, hx + 11, hy + 10, 2, 1, p.blush);
    px(c, hx + 7, hy + 11, 2, 1, p.mouth);
  } else {
    // From behind: hair over the whole head, a nape line (not the Warlock: their hood is drawn above).
    px(c, hx + 2, hy, 12, 13, p.hair); px(c, hx + 1, hy + 2, 14, 9, p.hair);
    px(c, hx + 4, hy, 6, 1, p.hairHi); px(c, hx + 3, hy + 3, 2, 6, p.hairHi);
    px(c, hx + 2, hy + 11, 12, 2, p.hairLo);
  }
  if (!phone) paintGear(c, gear, facing, x, top, cast);
  const weapon = gear?.weapon;
  const held = weapon && weapon.kind !== 'staff' && weapon.kind !== 'wand' ? weapon : null;
  if (held && !phone) paintHeld(c, held, facing, x, top, cast);
  if ((staff || weapon?.kind === 'staff' || weapon?.kind === 'wand') && !held && !phone) {
    // The Warlock's staff: ashwood shaft, a violet cage round an ember orb. In the right hand; raised high to cast.
    const sx = facing === 'down' ? x + 13 : x - 1, lift = cast ? -9 : 0, by = top + 4 + lift;
    px(c, sx, by + 4, 2, 26 + (cast ? 0 : 0) - (cast ? 4 : 0), '#6e4526'); px(c, sx, by + 4, 1, 22, '#a06a3b');
    px(c, sx - 2, by, 6, 5, '#3b2140'); px(c, sx - 1, by + 1, 4, 3, cast ? '#ffd25a' : '#b06bff'); px(c, sx, by + 1, 2, 2, cast ? '#fff6c8' : '#ffb347');
    if (cast) { px(c, sx - 4, by + 2, 2, 1, '#ffd25a'); px(c, sx + 4, by + 2, 2, 1, '#ffd25a'); px(c, sx + 1, by - 3, 1, 2, '#ffd25a'); }
    // The hand on the shaft.
    px(c, sx - (facing === 'down' ? 1 : -1), top + 20 + lift, 2, 2, p.skin);
  }
}

/** A worn piece's colours: its own, or its realm style's; the trim is its rarity's. */
function matOf(pc: GearPiece): { base: string; accent: string; trim: string } {
  const [b, a] = STYLE_COLORS[pc.style];
  return { base: pc.color ?? b, accent: pc.accent ?? a, trim: RARITY_TRIM[pc.rarity] };
}

/**
 * Worn gear over the front/back body (owner, 2026-10-20: "make … equipping gear visible"): the chest piece as plate,
 * a robe or a coat, greaves, boots, gauntlets, and a helm, crown or circlet (a hood is the class's own: drawn with the
 * head). Colours are the piece's realm style with its rarity trim, as in the side view.
 */
function paintGear(c: CanvasRenderingContext2D, gear: KeeperGear | null, facing: Facing, x: number, top: number, cast: boolean): void {
  if (!gear) return;
  const ch = gear.chest;
  if (ch) {
    const m = matOf(ch);
    if (ch.kind === 'plate') {
      px(c, x + 2, top + 14, 10, 9, m.base); px(c, x + 2, top + 14, 10, 2, m.trim);
      px(c, x, top + 14, 3, 3, m.base); px(c, x + 11, top + 14, 3, 3, m.base);
      if (facing === 'down') { px(c, x + 6, top + 16, 2, 6, m.accent); px(c, x + 3, top + 18, 1, 1, m.trim); px(c, x + 10, top + 18, 1, 1, m.trim); }
    } else if (ch.kind === 'robe' || ch.kind === 'mantle') {
      px(c, x + 2, top + 14, 10, 11, m.base); px(c, x + 1, top + 25, 12, 5, m.base); px(c, x + 1, top + 29, 12, 1, m.trim);
      if (facing === 'down') px(c, x + 6, top + 15, 2, 14, m.accent);
    } else {
      px(c, x + 2, top + 14, 10, 10, m.base); px(c, x + 2, top + 23, 10, 1, m.trim);
      if (facing === 'down') { px(c, x + 6, top + 15, 2, 8, m.trim); px(c, x + 4, top + 15, 1, 2, m.accent); px(c, x + 9, top + 15, 1, 2, m.accent); }
    }
  }
  if (gear.legs) { const m = matOf(gear.legs); px(c, x + 4, top + 25, 3, 5, m.base); px(c, x + 7, top + 25, 3, 5, m.base); px(c, x + 2, top + 24, 10, 1, m.trim); }
  if (gear.feet) { const m = matOf(gear.feet); px(c, x + 3, top + 30, 4, 3, m.base); px(c, x + 7, top + 30, 4, 3, m.base); px(c, x + 3, top + 30, 8, 1, m.trim); }
  if (gear.hands) { const m = matOf(gear.hands); px(c, x, top + 21, 2, 3, m.base); px(c, x + 12, top + 21 - (cast ? 0 : 0), 2, 3, m.base); }
  const hd = gear.head;
  if (hd && hd.kind !== 'hood') {
    const m = matOf(hd), hx = x - 1, hy = top;
    if (hd.kind === 'helm') {
      px(c, hx + 1, hy - 1, 14, 6, m.base); px(c, hx + 1, hy - 1, 14, 1, m.trim); px(c, hx, hy + 2, 2, 7, m.base); px(c, hx + 14, hy + 2, 2, 7, m.base);
      if (facing === 'down') px(c, hx + 7, hy + 5, 2, 4, m.base);
    } else if (hd.kind === 'crown') {
      px(c, hx + 2, hy, 12, 3, m.trim); for (const dx of [2, 6, 10]) px(c, hx + dx + 1, hy - 2, 2, 2, m.trim); px(c, hx + 7, hy + 1, 2, 1, m.accent);
    } else {
      px(c, hx + 1, hy + 3, 14, 1, m.trim); if (facing === 'down') px(c, hx + 7, hy + 3, 2, 2, m.accent);
    }
  }
  const off = gear['off-hand'];
  if (off && off.kind === 'shield') {
    const m = matOf(off), sx = facing === 'down' ? x - 3 : x + 11;
    px(c, sx, top + 15, 6, 8, m.base); px(c, sx, top + 15, 6, 1, m.trim); px(c, sx, top + 22, 6, 1, m.trim); px(c, sx + 2, top + 17, 2, 3, m.accent);
  }
}

/** A weapon that is not a staff, held upright in the right hand (front) or the left (back). */
function paintHeld(c: CanvasRenderingContext2D, w: GearPiece, facing: Facing, x: number, top: number, cast: boolean): void {
  const m = matOf(w), sx = facing === 'down' ? x + 13 : x - 1, lift = cast ? -6 : 0, y = top + 8 + lift;
  const steel = '#d3d9e4', wood = '#6e4a2c';
  switch (w.kind) {
    case 'axe': case 'pickaxe': case 'hammer': case 'mace':
      px(c, sx, y + 2, 2, 14, wood); px(c, sx - 2, y, 6, 4, w.kind === 'mace' || w.kind === 'hammer' ? m.base : steel); px(c, sx - 2, y, 6, 1, m.trim); break;
    case 'spear': case 'halberd':
      px(c, sx, y - 4, 2, 22, wood); px(c, sx - 1, y - 7, 4, 4, steel); break;
    case 'bow': case 'crossbow':
      px(c, sx - 1, y, 1, 14, wood); px(c, sx, y - 1, 1, 2, wood); px(c, sx, y + 13, 1, 2, wood); px(c, sx + 1, y, 1, 14, '#e9e4d8'); break;
    default:
      // A blade: a long sword, a dagger, a greatsword — steel with its tier's trim at the guard.
      px(c, sx, y - (w.kind === 'dagger' ? -4 : 2), 2, w.kind === 'dagger' ? 8 : w.kind === 'greatsword' ? 16 : 13, steel);
      px(c, sx, y - (w.kind === 'dagger' ? -4 : 2), 1, w.kind === 'dagger' ? 8 : 12, '#ffffff');
      px(c, sx - 2, y + 11, 6, 2, m.trim); px(c, sx, y + 13, 2, 3, wood);
  }
}

/** The 1px dark outline round what is painted (the game's outline rule). */
function outline(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(src, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = OUTLINE; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(src, 0, 0);
  return out;
}

/** One sheet per Keeper: row 0 = facing down, row 1 = facing up; 5 frames each (the 5th: the Slate in hand). */
export function frontSheet(painter: KeeperPainter, staff = false): HTMLCanvasElement {
  const cache = staff ? staffSheets : sheets;
  let sheet = cache.get(painter);
  if (sheet) return sheet;
  const raw = document.createElement('canvas');
  raw.width = FRONT_W * FRAMES; raw.height = FRONT_H * 2;
  const c = raw.getContext('2d')!;
  (['down', 'up'] as const).forEach((facing, row) => {
    for (let f = 0; f < FRAMES; f++) {
      c.save(); c.translate(0, row * FRONT_H);
      paint(c, painter.colors, facing, f, f * FRONT_W, staff, painter.gear);
      c.restore();
    }
  });
  sheet = outline(raw);
  cache.set(painter, sheet);
  return sheet;
}

/** Which frame a moment shows: walking alternates the steps, standing breathes. */
export function frontFrame(time: number, moving: boolean): number {
  if (moving) return Math.floor(time * 8) % 2 ? 3 : 2;
  return Math.floor(time * 1.4) % 4 === 3 ? 1 : 0;
}
