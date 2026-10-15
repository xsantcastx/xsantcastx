/**
 * keeper-paint.ts — the pixel Keeper: a look (keeper-look.model.ts) and worn
 * gear (keeper-gear.ts) painted as Terraria-crisp layers in a chibi,
 * MapleStory-cute shape.
 *
 * Owner, 2026-10-15: "make the character a bit more tender smaller like very
 * cute type style of maple story". The figure lives in a 48×48 art-pixel cell,
 * feet on the bottom edge at x 24, facing right (the engine mirrors the
 * context to face left), and is about 31 art px tall (three quarters of the
 * old 42): a big round head (15×14) over a small soft body (15 rows), so head
 * to body is about 1 : 1.1. Big eyes (2×3, a white highlight), a small mouth,
 * optional rosy cheeks, tiny hands and feet, oversized weapons.
 *
 * Each animation frame of the BODY — cape, back arm + off-hand, legs, torso +
 * armour, head, face, hair, helm — is painted once into a small canvas,
 * outlined in one dark pass and cached (a blink and the happy / surprised
 * faces are cached frames too). The FRONT arm and the held weapon are drawn
 * live on top, so a swing is smooth: per frame that is one cached blit, one
 * weapon blit and a handful of rects. A landing squash is a scale on the blit.
 *
 * Draw order, back to front: cape → back arm, off-hand, back hand → back leg →
 * torso / chest armour → front leg, coat skirt, boots → belt, charms, pendant →
 * head, face, hair, head gear → (live) weapon → front arm → front hand.
 *
 * Browser only (canvas). Pure inputs: the same look + gear + state always paint
 * the same pixels, which is what the specs and the e2e pixel diff rely on.
 */
import { EYE_COLORS, HAIR_COLORS, KeeperLook, OUTFIT_COLORS, SKIN_TONES, lookKey } from './keeper-look.model';
import {
  GearPiece, GripTransform, HoldPose, KeeperAction, KeeperGear, RARITY_TRIM, STYLE_COLORS, WEAPON_SPECS, WeaponKind,
  gearKey, gripPoint, gripTransform, handAt, holdPose,
} from './keeper-gear';
import { KeeperGarb, garbKey } from './npc-looks';

export const CELL = 48;
/** The feet: bottom edge, centre column. */
export const PIVOT_X = 24;
export const PIVOT_Y = 48;

/** The one outline every pixel figure shares (the Keeper, townsfolk, creatures). */
export const OUTLINE = '#140c1c';
const LEATHER = '#5a3a24';
const BELT = '#3a2618';

// ── Colour ──
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  const c = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
export const dark = (h: string, t = .3) => mix(h, '#120a18', t);
export const light = (h: string, t = .3) => mix(h, '#ffffff', t);

type Ctx = CanvasRenderingContext2D;
export function px(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
/** A thick pixel line (limbs). */
export function limb(c: Ctx, x0: number, y0: number, x1: number, y1: number, t: number, color: string): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const half = (t - 1) / 2;
  c.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
    c.fillRect(Math.round(x - half), Math.round(y - half), t, t);
  }
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  return el;
}
/** A 1px dark outline round everything painted on `src`. */
export function outlined(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(src.width, src.height);
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.drawImage(src, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = OUTLINE; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(src, 0, 0);
  return out;
}


// ── Body geometry (chibi, 2026-10-15) ──
const BODY = {
  slight: { sw: 8, hw: 9, leg: 2 },
  sturdy: { sw: 9, hw: 10, leg: 3 },
  broad: { sw: 11, hw: 12, leg: 3 },
} as const;
/** The bottom row of the feet. */
const FOOT = 47;
const HIP = 40;
const SHOULDER = 33;
/** The head: 15 wide, 14 tall, its top row at 19. */
const HEAD_TOP = 19;
const HW = 15;
const HH = 14;
const CX = 24;
/** Slots per row of a painter's frame sheet. */
const SHEET_COLS = 8;
/** Shoulder-to-hand reach of the back arm (the front arm uses ARM_LENGTH from keeper-gear). */
const ARM = 5;
/**
 * How far above the feet, in art px, the figure reaches with its tallest hat or
 * helm crest. Name tags, the "You" plate and speech bubbles sit above this
 * (× the world scale), so they follow the head instead of a fixed height.
 */
export const FIGURE_TOP = 37;
/** The default portrait crop: the whole chibi plus a hat and a raised weapon tip. */
export const STILL_CROP = { x: 5, y: 10, size: 38 } as const;

interface Leg { dx: number; lift: number }
/**
 * One body frame: whole-figure offsets plus legs and the back arm. `nod` moves
 * the head alone (it lags the body's bounce: squash and stretch); `cape` is how
 * far a mantle trails.
 */
export interface BodyFrame { bob: number; lean: number; nod: number; back: Leg; front: Leg; armB: number; cape: number }

export const RUN_FRAMES = 8;
export const IDLE_FRAMES = 4;

/** The body frame for an action (pure; the live arm reads the same bob/lean). */
export function bodyFrame(action: KeeperAction, frame: number): BodyFrame {
  switch (action) {
    case 'run': {
      // A bouncy trot: high on the passing frames, the head lagging a pixel behind.
      const p = frame / RUN_FRAMES * Math.PI * 2, s = Math.sin(p), k = Math.cos(p);
      const bob = -Math.round(2 * (1 - Math.abs(s)));
      return {
        bob, lean: 1, nod: bob === -2 ? 1 : 0,
        front: { dx: Math.round(2.5 * s), lift: Math.max(0, Math.round(2 * k)) },
        back: { dx: -Math.round(2.5 * s), lift: Math.max(0, Math.round(-2 * k)) },
        armB: 1.57 - .8 * s, cape: 3 + (frame & 1),
      };
    }
    case 'jump': return { bob: -1, lean: 0, nod: 1, front: { dx: 2, lift: 3 }, back: { dx: -1, lift: 2 }, armB: .5, cape: 2 };
    case 'fall': return { bob: 0, lean: 0, nod: -1, front: { dx: 2, lift: 1 }, back: { dx: -2, lift: 2 }, armB: -.5, cape: -1 };
    case 'attack': return frame === 0
      ? { bob: 0, lean: -1, nod: 0, front: { dx: 1, lift: 0 }, back: { dx: -2, lift: 0 }, armB: 2.2, cape: 1 }
      : { bob: 1, lean: 1, nod: 0, front: { dx: 3, lift: 0 }, back: { dx: -2, lift: 0 }, armB: 2.6, cape: 3 };
    case 'hurt': return { bob: 0, lean: -1, nod: -1, front: { dx: 1, lift: 0 }, back: { dx: -2, lift: 1 }, armB: 2.6, cape: 2 };
    case 'dodge': return { bob: 3, lean: 2, nod: 0, front: { dx: 3, lift: 0 }, back: { dx: -3, lift: 0 }, armB: 2.4, cape: 4 };
    case 'rest': return { bob: 4, lean: 0, nod: 0, front: { dx: 3, lift: 1 }, back: { dx: 2, lift: 1 }, armB: 1.2, cape: 0 };
    case 'walk': {
      // The townsfolk's stroll: a little hop on each step, upright.
      const p = frame / RUN_FRAMES * Math.PI * 2, s = Math.sin(p), k = Math.cos(p);
      return {
        bob: Math.abs(s) > .7 ? 0 : -1, lean: 0, nod: 0,
        front: { dx: Math.round(1.5 * s), lift: Math.max(0, Math.round(1.2 * k)) },
        back: { dx: -Math.round(1.5 * s), lift: Math.max(0, Math.round(-1.2 * k)) },
        armB: 1.6 - .4 * s, cape: 1 + ((frame >> 1) & 1),
      };
    }
    default: {
      // Idle (and talk): breathing — the body settles a pixel and the cape stirs.
      const low = frame >= 2 ? 1 : 0;
      return { bob: low, lean: 0, nod: 0, front: { dx: 1, lift: 0 }, back: { dx: -1, lift: 0 }, armB: 1.7 + low * .12, cape: frame & 1 };
    }
  }
}

/** Which cached body frame a moment shows. */
export function frameIndex(action: KeeperAction, time: number, attackT: number, reduced: boolean): number {
  if (reduced) return 0;
  switch (action) {
    case 'run': return Math.floor((((time * 9) / (Math.PI * 2)) % 1 + 1) % 1 * RUN_FRAMES) % RUN_FRAMES;
    case 'idle': case 'talk': return Math.floor(time * 2.2) % IDLE_FRAMES;
    // `time` is the walker's own stride phase (radians), so feet never slide out of step with the ground.
    case 'walk': return Math.floor(((time / (Math.PI * 2)) % 1 + 1) % 1 * RUN_FRAMES) % RUN_FRAMES;
    case 'attack': return attackT < .3 ? 0 : 1;
    default: return 0;
  }
}
/** The run-cycle phase that matches a run frame (for the live arm). */
function runPhase(frame: number): number { return frame / RUN_FRAMES * Math.PI * 2; }

/** A blink every ~3.7 s, about a seventh of a second long; `phase` keeps a crowd out of unison. */
export const BLINK_EVERY = 3.7;
export function blinking(time: number, phase: number): boolean {
  return ((time + phase) % BLINK_EVERY + BLINK_EVERY) % BLINK_EVERY < .14;
}

/** A face the painter can show: open eyes, a blink, or a flash of joy or surprise (level up, loot). */
export type KeeperFace = 'open' | 'blink' | 'happy' | 'surprised';

/** Palette of one look + gear, resolved once per painter. */
interface Palette {
  skin: string; skinLo: string; skinHi: string; blush: string; mouth: string;
  hair: string; hairLo: string; hairHi: string;
  eye: string; eyeDk: string; eyeHi: string;
  tunic: string; tunicLo: string; tunicHi: string;
  trim: string; trousers: string; trousersLo: string;
}
function paletteOf(look: KeeperLook, garb: KeeperGarb | null): Palette {
  const skin = garb?.skin ?? SKIN_TONES[look.skin] ?? SKIN_TONES[2];
  const hair = garb?.hair ?? HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[2];
  const tunic = garb?.tunic ?? OUTFIT_COLORS[look.outfit] ?? OUTFIT_COLORS[0];
  const trim = garb?.trim ?? OUTFIT_COLORS[look.trim] ?? OUTFIT_COLORS[4];
  const trousers = garb?.trousers ?? mix(trim, '#2a2230', .45);
  const eye = EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0];
  return {
    skin, skinLo: dark(skin, .2), skinHi: light(skin, .25), blush: mix(skin, '#ff6f86', .42), mouth: mix(skin, '#5a1e2a', .62),
    hair, hairLo: dark(hair, .3), hairHi: light(hair, .3),
    eye, eyeDk: mix(eye, OUTLINE, .58), eyeHi: light(eye, .45),
    tunic, tunicLo: dark(tunic, .3), tunicHi: light(tunic, .22),
    trim, trousers, trousersLo: dark(trousers, .3),
  };
}

/** Gear materials: realm base, realm accent, tier trim. */
interface Mat { base: string; baseLo: string; baseHi: string; accent: string; trim: string; blade: string; bladeHi: string; bladeLo: string; wood: string; woodLo: string; bright: boolean }
function matOf(piece: GearPiece): Mat {
  const [styleBase, styleAccent] = STYLE_COLORS[piece.style];
  const base = piece.color ?? styleBase, accent = piece.accent ?? styleAccent;
  const blade = mix('#d3d9e4', base, .3);
  const wood = mix('#6e4a2c', base, .25);
  return {
    base, baseLo: dark(base, .32), baseHi: light(base, .3), accent, trim: RARITY_TRIM[piece.rarity],
    blade, bladeHi: light(blade, .55), bladeLo: dark(blade, .3), wood, woodLo: dark(wood, .3),
    bright: piece.rarity === 'epic' || piece.rarity === 'legendary' || piece.rarity === 'mythic' || piece.rarity === 'singular',
  };
}

// ── Held items, painted pointing up ──

/** Paint a weapon/tool sprite (tip at the top) into its own canvas, outlined. */
export function paintWeapon(kind: WeaponKind, m: Mat): HTMLCanvasElement {
  const spec = WEAPON_SPECS[kind];
  const raw = canvas(spec.w + 2, spec.h + 2);
  const c = raw.getContext('2d')!;
  c.translate(1, 1);
  const p = (x: number, y: number, w: number, h: number, col: string) => px(c, x, y, w, h, col);
  switch (kind) {
    case 'sword':
      p(2, 1, 3, 12, m.blade); p(3, 1, 1, 12, m.bladeHi); p(4, 2, 1, 11, m.bladeLo); p(3, 0, 1, 1, m.bladeHi);
      p(0, 13, 7, 1, m.trim); p(0, 13, 1, 1, m.accent); p(6, 13, 1, 1, m.accent);
      p(3, 14, 1, 4, m.wood); p(2, 14, 1, 4, m.woodLo); p(2, 18, 3, 1, m.trim);
      break;
    case 'greatsword':
      p(3, 1, 3, 12, m.blade); p(2, 12, 5, 5, m.blade); p(4, 1, 1, 16, m.bladeHi); p(5, 2, 1, 15, m.bladeLo); p(4, 0, 1, 1, m.bladeHi);
      p(0, 17, 9, 1, m.trim); p(0, 16, 1, 1, m.trim); p(8, 16, 1, 1, m.trim); p(4, 17, 1, 1, m.accent);
      p(4, 18, 1, 5, m.wood); p(3, 18, 1, 5, m.woodLo); p(3, 23, 3, 1, m.trim);
      break;
    case 'dagger':
      p(1, 1, 3, 5, m.blade); p(2, 0, 1, 6, m.bladeHi); p(3, 2, 1, 4, m.bladeLo);
      p(0, 6, 5, 1, m.trim); p(2, 7, 1, 2, m.wood); p(2, 9, 1, 1, m.trim);
      break;
    case 'axe':
      p(2, 1, 1, 17, m.wood); p(1, 2, 1, 15, m.woodLo);
      p(3, 1, 1, 7, m.base); p(4, 2, 2, 5, m.blade); p(6, 1, 1, 7, m.bladeHi); p(7, 2, 1, 5, m.bladeHi);
      p(0, 3, 1, 2, m.bladeLo); p(2, 0, 1, 1, m.trim); p(1, 16, 2, 1, m.trim);
      break;
    case 'pickaxe':
      p(6, 2, 1, 15, m.wood); p(5, 3, 1, 13, m.woodLo);
      p(3, 1, 7, 1, m.bladeHi); p(1, 2, 11, 1, m.blade); p(0, 3, 2, 1, m.bladeLo); p(11, 3, 2, 1, m.bladeLo);
      p(5, 1, 3, 3, m.base); p(6, 2, 1, 1, m.trim);
      break;
    case 'hammer':
      p(4, 5, 1, 13, m.wood); p(3, 6, 1, 11, m.woodLo);
      p(0, 0, 9, 6, m.base); p(0, 0, 9, 1, m.baseHi); p(0, 5, 9, 1, m.baseLo); p(0, 3, 9, 1, m.trim); p(8, 1, 1, 4, m.baseHi);
      break;
    case 'mace':
      p(3, 5, 1, 10, m.wood); p(2, 6, 1, 8, m.woodLo);
      p(1, 1, 5, 5, m.base); p(2, 2, 2, 2, m.baseHi); p(3, 0, 1, 1, m.accent); p(0, 3, 1, 1, m.accent); p(6, 3, 1, 1, m.accent); p(3, 6, 1, 1, m.trim);
      break;
    case 'staff':
      p(2, 4, 2, 23, m.wood); p(2, 4, 1, 23, m.woodLo); p(2, 12, 2, 1, m.trim); p(2, 20, 2, 1, m.trim);
      p(0, 2, 1, 3, m.base); p(5, 2, 1, 3, m.base);
      p(1, 0, 4, 4, m.trim); p(2, 1, 1, 1, '#ffffff'); p(3, 2, 2, 2, m.accent);
      break;
    case 'wand':
      p(2, 3, 1, 9, m.wood); p(1, 3, 3, 1, m.base);
      p(1, 0, 3, 3, m.trim); p(2, 0, 1, 1, '#ffffff'); p(3, 2, 1, 1, m.accent);
      break;
    case 'bow':
      for (let r = 0; r < 21; r++) {
        const x = 1 + Math.round(4 * (1 - ((r - 10) / 10) ** 2));
        p(x, r, 1, 1, r % 5 === 0 ? m.trim : m.wood); p(x + 1, r, 1, 1, m.woodLo);
      }
      p(1, 1, 1, 19, mix('#e8e0d0', m.accent, .2));
      p(5, 9, 2, 3, m.base);
      break;
    case 'crossbow':
      p(6, 2, 2, 12, m.wood); p(6, 2, 1, 12, m.woodLo);
      p(1, 3, 11, 1, m.base); p(0, 4, 2, 1, m.baseLo); p(11, 4, 2, 1, m.baseLo); p(3, 2, 7, 1, m.baseHi);
      p(1, 5, 11, 1, mix('#e8e0d0', m.accent, .2));
      p(6, 0, 1, 2, m.bladeHi); p(5, 8, 1, 2, m.trim);
      break;
    case 'spear':
      p(2, 6, 1, 23, m.wood); p(1, 7, 1, 21, m.woodLo);
      p(2, 0, 1, 1, m.bladeHi); p(1, 1, 3, 4, m.blade); p(2, 1, 1, 4, m.bladeHi); p(2, 5, 1, 1, m.bladeLo);
      p(1, 6, 3, 1, m.trim);
      break;
    case 'halberd':
      p(4, 3, 1, 26, m.wood); p(3, 4, 1, 24, m.woodLo);
      p(4, 0, 1, 3, m.bladeHi);
      p(5, 3, 1, 7, m.base); p(6, 3, 2, 6, m.blade); p(8, 2, 1, 8, m.bladeHi);
      p(2, 5, 2, 1, m.bladeLo); p(1, 6, 1, 1, m.bladeLo); p(4, 10, 1, 1, m.trim);
      break;
    case 'sickle':
      p(1, 7, 1, 6, m.wood); p(0, 8, 1, 4, m.woodLo); p(1, 6, 2, 1, m.trim);
      for (const [x, y] of [[2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [5, 0], [4, 0]] as const) { p(x, y, 2, 1, m.blade); }
      p(6, 1, 1, 1, m.bladeHi);
      break;
    case 'tongs':
      p(1, 0, 1, 10, m.base); p(4, 0, 1, 10, m.base); p(1, 0, 1, 2, m.baseHi); p(4, 0, 1, 2, m.baseHi);
      p(2, 9, 2, 2, m.trim); p(2, 11, 1, 4, m.baseLo); p(3, 11, 1, 4, m.base);
      break;
    case 'rod':
      // A cork-wrapped butt, a reel at the hand, a pole thinning to a pale tip, one line guide.
      p(1, 17, 2, 11, m.wood); p(1, 17, 1, 11, m.woodLo); p(1, 27, 2, 1, m.trim); p(1, 16, 2, 1, m.trim);
      p(2, 2, 1, 14, m.wood); p(2, 0, 1, 2, m.bladeHi); p(3, 9, 1, 1, m.accent);
      p(3, 20, 2, 2, m.base); p(3, 20, 1, 1, m.baseHi);
      break;
  }
  if (m.bright) {
    // Epic and above: the tip catches the realm's light.
    c.globalAlpha = .9; p(spec.gx, 0, 1, 1, light(m.accent, .4)); c.globalAlpha = 1;
  }
  return outlined(raw);
}

type OffhandSprite = { el: HTMLCanvasElement; gx: number; gy: number };
function paintOffhand(piece: GearPiece, m: Mat): OffhandSprite {
  const kind = piece.kind;
  if (kind in WEAPON_SPECS) {
    const spec = WEAPON_SPECS[kind as WeaponKind];
    return { el: paintWeapon(kind as WeaponKind, m), gx: spec.gx + 1, gy: spec.gy + 1 };
  }
  const sizes: Record<string, [number, number, number, number]> = {
    shield: [9, 11, 4, 5], tome: [7, 8, 3, 4], orb: [6, 7, 3, 6], lantern: [5, 8, 2, 0], scroll: [4, 10, 2, 5],
    cards: [6, 7, 2, 6], scales: [9, 9, 4, 8],
  };
  const [w, h, gx, gy] = sizes[kind] ?? sizes['orb'];
  const raw = canvas(w + 2, h + 2);
  const c = raw.getContext('2d')!;
  c.translate(1, 1);
  const p = (x: number, y: number, ww: number, hh: number, col: string) => px(c, x, y, ww, hh, col);
  switch (kind) {
    case 'shield':
      p(0, 0, 9, 9, m.accent); p(1, 9, 7, 1, m.accent); p(3, 10, 3, 1, m.accent);
      p(1, 1, 7, 8, m.base); p(2, 9, 5, 1, m.base); p(1, 1, 7, 1, m.baseHi); p(7, 2, 1, 6, m.baseLo);
      p(3, 3, 3, 3, m.trim); p(4, 4, 1, 1, '#ffffff');
      break;
    case 'tome':
      p(0, 0, 7, 8, m.base); p(0, 0, 1, 8, m.baseLo); p(6, 1, 1, 6, '#efe6d0'); p(1, 0, 5, 1, m.baseHi);
      p(2, 2, 3, 3, m.accent); p(5, 3, 2, 2, m.trim);
      break;
    case 'lantern':
      p(1, 0, 3, 1, m.base); p(0, 1, 5, 1, m.base); p(0, 2, 5, 5, m.baseLo); p(1, 2, 3, 5, light(m.accent, .35)); p(2, 3, 1, 3, '#ffffff'); p(0, 7, 5, 1, m.base);
      break;
    case 'scroll':
      p(0, 0, 4, 2, m.trim); p(0, 8, 4, 2, m.trim); p(0, 2, 4, 6, m.base); p(1, 2, 1, 6, m.baseHi); p(3, 2, 1, 6, m.baseLo);
      break;
    case 'cards':
      // A fanned hand of three, the faces lit in the realm's colour.
      p(0, 2, 3, 5, m.base); p(1, 1, 3, 5, m.baseHi); p(3, 0, 3, 5, m.accent); p(4, 1, 1, 2, '#ffffff'); p(2, 5, 2, 2, m.baseLo);
      break;
    case 'scales':
      // A brass balance: beam, post, chains and two pans.
      p(4, 0, 1, 9, m.base); p(0, 1, 9, 1, m.baseHi); p(4, 0, 1, 1, m.trim);
      p(1, 2, 1, 3, m.baseLo); p(7, 2, 1, 3, m.baseLo); p(0, 5, 3, 1, m.base); p(6, 5, 3, 1, m.base);
      break;
    default: // orb / mirror
      p(1, 0, 4, 6, m.trim); p(0, 1, 6, 4, m.trim); p(1, 1, 2, 2, '#ffffff'); p(3, 3, 2, 2, m.accent); p(2, 6, 2, 1, m.base);
  }
  return { el: outlined(raw), gx: gx + 1, gy: gy + 1 };
}

export interface PaintState {
  action: KeeperAction;
  /** Seconds (drives idle breath, blinks and the run cycle). */
  time: number;
  /** 0..1 through the attack window. */
  attackT: number;
  /** 0..1: an additive rim flash on strike or wound. */
  rim?: number;
  reduced?: boolean;
  /** Draw the held weapon (false for other Keepers seen in the world). */
  weapon?: boolean;
  /** -1..1: a squash on landing (positive: wider and shorter) or a stretch on take-off (negative). */
  squash?: number;
  /** A flash of feeling (level up, loot); otherwise the eyes are open and blink now and then. */
  face?: 'happy' | 'surprised';
}

/**
 * One Keeper's painter: the cached body frames and held sprites for a look +
 * gear. Rebuild it when either changes (`key`).
 */
export class KeeperPainter {
  readonly key: string;
  private readonly pal: Palette;
  private readonly body: typeof BODY[keyof typeof BODY];
  /**
   * Every body frame this Keeper has shown, baked into ONE sheet canvas
   * (SHEET_COLS slots of CELL per row; it grows by whole rows, copying itself,
   * so a painter always holds one sheet however many poses, blinks and faces
   * it meets). `slots` maps a frame id to its slot. e2e/play-memory counts
   * live canvases: a canvas per pose made the crowd's count climb.
   */
  private sheet: HTMLCanvasElement | null = null;
  private readonly slots = new Map<string, number>();
  private readonly weaponKind: WeaponKind | null;
  private weaponSprite: HTMLCanvasElement | null = null;
  private offhand: OffhandSprite | null | undefined;
  private readonly pose: HoldPose = { arm: 0, weapon: 0 };
  private readonly hand = { x: 0, y: 0 };
  private readonly grip: GripTransform = { x: 0, y: 0, rotation: 0, drawX: 0, drawY: 0 };
  /** Where the held weapon's tip was last drawn, in art px from the feet pivot (null: nothing held, or not drawn yet). */
  private readonly tipAt = { x: 0, y: 0 };
  private tipDrawn = false;
  /** Offsets this Keeper's blink so a crowd never blinks in unison. */
  private readonly blinkPhase: number;

  constructor(readonly look: KeeperLook, readonly gear: KeeperGear | null = null, readonly garb: KeeperGarb | null = null) {
    this.key = `${lookKey(look)}#${gearKey(gear)}#${garbKey(garb)}`;
    this.pal = paletteOf(look, garb);
    this.body = BODY[look.body] ?? BODY.sturdy;
    const weapon = gear?.weapon;
    this.weaponKind = weapon && weapon.kind in WEAPON_SPECS ? weapon.kind as WeaponKind : null;
    let hash = 0;
    for (let i = 0; i < this.key.length; i++) hash = (hash * 31 + this.key.charCodeAt(i)) >>> 0;
    this.blinkPhase = (hash % 997) / 997 * BLINK_EVERY;
  }

  /**
   * A townsperson with nothing in the main hand carries the off-hand prop
   * (ledger, lantern, scales, cards) in FRONT, where it reads: in the back hand
   * it would hang hidden behind the body. Players keep the off-hand behind.
   */
  private get frontProp(): boolean { return !!this.garb && !this.weaponKind && !!this.gear?.['off-hand']; }

  /**
   * The held weapon's tip in the last drawn frame, in art px from the feet
   * pivot (multiply by the draw scale; x points the way the Keeper faces), or
   * null. The engine hangs the fishing line from the rod's tip with it.
   */
  weaponTip(): { x: number; y: number } | null { return this.tipDrawn ? this.tipAt : null; }

  /** The held weapon's kind, or null (bare hand). */
  get weapon(): WeaponKind | null { return this.weaponKind; }

  /**
   * How far above the feet (art px) this Keeper reaches: the hair dome, plus a
   * hat, a helm (and its crest), a hood, a crown, a topknot or Aureth's shards.
   * Name tags, the "You" plate and speech bubbles sit just over it.
   */
  get top(): number {
    const head = this.gear?.head, garb = this.garb, hair = this.look.hair;
    let rise = 2;
    if (head?.kind === 'helm') rise = head.rarity === 'common' || head.rarity === 'uncommon' ? 4 : 7;
    else if (head?.kind === 'hood') rise = 4;
    else if (head?.kind === 'crown') rise = 5;
    else if (garb?.hat) rise = garb.hat === 'brim' ? 8 : 5;
    if (head?.kind !== 'helm' && head?.kind !== 'hood' && !garb?.hat) {
      if (hair === 'topknot') rise = Math.max(rise, 6);
      else if (hair === 'mohawk') rise = Math.max(rise, 5);
      else if (hair === 'curls') rise = Math.max(rise, 4);
    }
    if (garb?.shards) rise = Math.max(rise, 10);
    // +1: the outline row above the topmost painted pixel.
    return Math.min(FIGURE_TOP + 4, PIVOT_Y - HEAD_TOP + rise + 1 - (garb?.elder ? 1 : 0));
  }

  /** The face a moment shows: a flash of feeling first, then a blink now and then. */
  faceAt(state: PaintState): KeeperFace {
    if (state.face) return state.face;
    if (state.reduced) return 'open';
    const a = state.action;
    return (a === 'idle' || a === 'talk' || a === 'walk' || a === 'run') && blinking(state.time, this.blinkPhase) ? 'blink' : 'open';
  }

  /**
   * Draw the Keeper with the context at its feet (already mirrored to face).
   * `scale` is world px per art pixel. Shadow/alpha set by the caller apply to
   * the body blit; the live arm and weapon are drawn without the shadow.
   */
  draw(c: Ctx, scale: number, state: PaintState): void {
    const action = state.action;
    const frame = frameIndex(action, state.time, state.attackT, !!state.reduced);
    const slot = this.frame(action, frame, action === 'death' ? 'open' : this.faceAt(state));
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const squash = state.reduced ? 0 : Math.max(-1, Math.min(1, state.squash ?? 0));
    const squashed = Math.abs(squash) > .02;
    if (squashed) { c.save(); c.scale(1 + squash * .16, 1 - squash * .16); }
    const x = -PIVOT_X * scale, y = -PIVOT_Y * scale, size = CELL * scale;
    this.blit(c, slot, x, y, size);
    if (state.rim && state.rim > .01) {
      c.save(); c.shadowBlur = 0; c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(1, state.rim) * .45;
      this.blit(c, slot, x + scale * .5, y - scale * .5, size);
      c.restore();
    }
    if (action !== 'death') {
      const blur = c.shadowBlur;
      c.shadowBlur = 0;
      c.save();
      c.translate(x, y); c.scale(scale, scale);
      this.frontArm(c, action, frame, state);
      c.restore();
      c.shadowBlur = blur;
    }
    if (squashed) c.restore();
    c.imageSmoothingEnabled = smoothing;
  }

  /**
   * A still (idle, weapon in hand) filling `target`, cropped to the figure. For
   * portraits and the paper doll. The scale snaps to whole device pixels per art
   * pixel when it can (crisp), and the crop is centred in the target.
   */
  still(target: HTMLCanvasElement, crop: { x: number; y: number; size: number } = STILL_CROP): void {
    const c = target.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, target.width, target.height);
    const fit = Math.min(target.width, target.height) / crop.size;
    const scale = fit >= 2 ? Math.floor(fit) : fit;
    const ox = (target.width - crop.size * scale) / 2, oy = (target.height - crop.size * scale) / 2;
    c.save();
    c.translate(Math.round(ox + (PIVOT_X - crop.x) * scale), Math.round(oy + (PIVOT_Y - crop.y) * scale));
    this.draw(c, scale, { action: 'idle', time: 0, attackT: 0, weapon: true, reduced: true });
    c.restore();
  }

  // ── Live: the front arm and the weapon ──
  private frontArm(c: Ctx, action: KeeperAction, frame: number, state: PaintState): void {
    const f = bodyFrame(action, frame);
    const sx = CX + 2 + f.lean, sy = SHOULDER + 2 + f.bob;
    const kind = state.weapon !== false ? this.weaponKind : null;
    const phase = action === 'run' || action === 'walk' ? runPhase(frame) : action === 'talk' ? state.time * 4 : 0;
    holdPose(kind, action, phase, state.attackT, this.pose);
    const hand = handAt(sx, sy, this.pose.arm, this.hand);
    if (kind) {
      const sprite = this.weaponSprite ??= paintWeapon(kind, matOf(this.gear!.weapon!));
      const spec = WEAPON_SPECS[kind];
      gripTransform(Math.round(hand.x) + .5, Math.round(hand.y) + .5, this.pose.weapon, spec, this.grip);
      c.save();
      c.translate(this.grip.x, this.grip.y); c.rotate(this.grip.rotation);
      c.drawImage(sprite, this.grip.drawX - 1, this.grip.drawY - 1);
      c.restore();
      gripPoint(this.grip, spec.gx, 0, this.tipAt);
      this.tipAt.x -= PIVOT_X; this.tipAt.y -= PIVOT_Y;
      this.tipDrawn = true;
    } else this.tipDrawn = false;
    if (this.frontProp) {
      const off = this.gear!['off-hand']!;
      const prop = this.offhand === undefined ? (this.offhand = paintOffhand(off, matOf(off))) : this.offhand;
      if (prop) c.drawImage(prop.el, Math.round(hand.x) - prop.gx, Math.round(hand.y) - prop.gy);
    }
    const sleeve = this.sleeveColor();
    const t = this.body.leg;
    limb(c, sx, sy, hand.x, hand.y, t + 2, OUTLINE);
    limb(c, sx, sy, hand.x, hand.y, t, sleeve);
    // A tiny round mitten of a hand.
    const hx = Math.round(hand.x), hy = Math.round(hand.y);
    px(c, hx - 1, hy - 2, 3, 5, OUTLINE); px(c, hx - 2, hy - 1, 5, 3, OUTLINE);
    px(c, hx - 1, hy - 1, 3, 3, this.gloveColor());
    px(c, hx - 1, hy - 1, 1, 1, light(this.gloveColor(), .2));
    if (kind && state.attackT > .3 && (WEAPON_SPECS[kind].swing === 'cast')) {
      // A cast: the head of the staff or wand flares in the tier's colour.
      const cos = Math.cos(this.pose.weapon), sin = Math.sin(this.pose.weapon);
      const reach = WEAPON_SPECS[kind].gy;
      const tx = Math.round(hand.x + cos * reach), ty = Math.round(hand.y + sin * reach);
      c.globalAlpha *= .85;
      px(c, tx - 1, ty - 1, 3, 3, light(RARITY_TRIM[this.gear!.weapon!.rarity], .4));
    }
  }

  private sleeveColor(): string {
    const chest = this.gear?.chest;
    if (chest && chest.kind === 'plate') return matOf(chest).base;
    if (chest && (chest.kind === 'coat' || chest.kind === 'robe')) return mix(matOf(chest).base, this.pal.tunic, .2);
    return this.pal.tunic;
  }
  private gloveColor(): string {
    const hands = this.gear?.hands;
    if (!hands) return this.pal.skin;
    const m = matOf(hands);
    return hands.kind === 'wrap' ? m.accent : m.base;
  }

  // ── Cached body frames: one sheet per painter ──
  /** The sheet slot holding a frame, painting it on first sight. Idle and talk share bodies. */
  private frame(action: KeeperAction, frame: number, face: KeeperFace): number {
    const pose = action === 'talk' ? 'idle' : action;
    const id = `${pose}:${frame}:${face}`;
    let slot = this.slots.get(id);
    if (slot === undefined) {
      const art = pose === 'death' ? this.lying() : outlined(this.paintBody(bodyFrame(pose, frame), pose, face));
      slot = this.slots.size;
      const sheet = this.room(slot + 1);
      sheet.getContext('2d')!.drawImage(art, (slot % SHEET_COLS) * CELL, Math.floor(slot / SHEET_COLS) * CELL);
      this.slots.set(id, slot);
    }
    return slot;
  }
  /** The sheet, grown (by doubling its rows, copied across) until it holds `count` slots. */
  private room(count: number): HTMLCanvasElement {
    const rows = Math.ceil(count / SHEET_COLS);
    const have = this.sheet ? this.sheet.height / CELL : 0;
    if (this.sheet && rows <= have) return this.sheet;
    const next = canvas(SHEET_COLS * CELL, Math.max(2, have * 2, rows) * CELL);
    if (this.sheet) next.getContext('2d')!.drawImage(this.sheet, 0, 0);
    this.sheet = next;
    return next;
  }
  private blit(c: Ctx, slot: number, x: number, y: number, size: number): void {
    c.drawImage(this.sheet!, (slot % SHEET_COLS) * CELL, Math.floor(slot / SHEET_COLS) * CELL, CELL, CELL, x, y, size, size);
  }
  private lying(): HTMLCanvasElement {
    const stand = this.frame('idle', 0, 'blink');
    const out = canvas(CELL, CELL);
    const c = out.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    // Feet to the right, the back on the floor (the figure's back edge lands on the bottom row).
    c.translate(44, 37); c.rotate(-Math.PI / 2);
    this.blit(c, stand, -PIVOT_X, -PIVOT_Y, CELL);
    return out;
  }

  private paintBody(f: BodyFrame, action: KeeperAction, face: KeeperFace): HTMLCanvasElement {
    const el = canvas(CELL, CELL);
    const c = el.getContext('2d')!;
    const pal = this.pal, b = this.body, gear = this.gear ?? {};
    const ux = f.lean, uy = f.bob; // upper-body offset
    const hip = HIP + uy;
    const cx = CX + ux;
    const half = Math.floor(b.sw / 2);

    // 1. Cape (a mantle) behind everything, trailing with the motion and scalloped at the hem.
    if (gear.chest?.kind === 'mantle') {
      const m = matOf(gear.chest);
      const top = SHOULDER - 1 + uy, bottom = FOOT - 1 - (action === 'rest' ? 3 : 0);
      for (let y = top; y <= bottom; y++) {
        const u = (y - top) / Math.max(1, bottom - top);
        const back = Math.round(u * f.cape);
        const w = b.sw + Math.round(u * 2);
        const left = cx - half - 1 - back;
        const hem = y === bottom;
        px(c, left, y, w, 1, hem ? m.trim : m.base);
        px(c, left, y, 1, 1, m.baseLo);
        if (hem) for (let i = 1; i < w; i += 3) px(c, left + i, y, 1, 1, m.base); // the scallops
      }
    }

    // 1b. A sack or rope coil slung over the back shoulder.
    const garb = this.garb;
    if (garb?.sack) {
      const sx = cx - half - 4, sy = SHOULDER - 2 + uy;
      px(c, sx, sy + 1, 5, 7, garb.sack); px(c, sx + 1, sy, 3, 1, garb.sack); px(c, sx + 1, sy + 8, 3, 1, garb.sack);
      px(c, sx, sy + 1, 1, 6, dark(garb.sack, .3)); px(c, sx + 1, sy + 1, 2, 1, light(garb.sack, .25));
      px(c, sx + 3, sy + 2, 2, 1, dark(garb.sack, .35)); // the tie
    }

    // 2. Back arm, with the off-hand item and the back hand.
    const bsx = cx - 2, bsy = SHOULDER + 2 + uy;
    const bhx = bsx + Math.cos(f.armB) * ARM, bhy = bsy + Math.sin(f.armB) * ARM;
    limb(c, bsx, bsy, bhx, bhy, b.leg, dark(this.sleeveColor(), .3));
    const off = gear['off-hand'];
    if (off && !this.frontProp) {
      const sprite = this.offhand === undefined ? (this.offhand = paintOffhand(off, matOf(off))) : this.offhand;
      if (sprite) c.drawImage(sprite.el, Math.round(bhx) - sprite.gx, Math.round(bhy) - sprite.gy);
    }
    if (!garb?.oneHand) px(c, Math.round(bhx) - 1, Math.round(bhy) - 1, 2, 2, dark(this.gloveColor(), .25));

    // 3. Back leg.
    this.leg(c, cx - 2, hip, f.back, true);

    // 4. Torso: a small soft bell, rounded at the shoulders, with the chest piece.
    const chest = gear.chest;
    const cm = chest ? matOf(chest) : null;
    const cloth = chest?.kind === 'plate' ? cm!.base : chest?.kind === 'coat' || chest?.kind === 'robe' ? cm!.base : pal.tunic;
    const clothHi = chest && chest.kind !== 'mantle' ? cm!.baseHi : pal.tunicHi;
    const clothLo = chest && chest.kind !== 'mantle' ? cm!.baseLo : pal.tunicLo;
    const top = SHOULDER + uy;
    for (let y = top; y <= hip; y++) {
      const u = (y - top) / Math.max(1, hip - top);
      const w = Math.round(b.sw + (b.hw - b.sw) * u) - (y === top ? 2 : 0);
      const left = cx - Math.floor(w / 2);
      px(c, left, y, w, 1, cloth);
      px(c, left, y, 1, 1, clothLo);
      if (y > top) px(c, left + w - 2, y, 1, 1, clothHi);
    }
    if (chest?.kind === 'plate') {
      px(c, cx - half + 1, top + 4, b.sw - 2, 1, cm!.baseLo);
      px(c, cx + 1, top + 2, 2, 2, cm!.trim);
      // Pauldrons: little round caps, the far one darker, the near one on top.
      px(c, cx - half - 1, top - 1, 3, 3, cm!.baseLo); px(c, cx - half, top - 2, 2, 1, cm!.baseLo);
    } else {
      // Collar and a seam in the trim colour.
      px(c, cx - 1, top, 4, 1, chest ? cm!.trim : pal.trim);
      px(c, cx + 1, top + 1, 1, hip - top - 2, chest ? cm!.accent : dark(pal.tunic, .15));
    }

    // 5. Front leg, then the skirt of a coat or robe over the legs.
    this.leg(c, cx + 1, hip, f.front, false);
    if (chest && (chest.kind === 'coat' || chest.kind === 'robe')) {
      const len = chest.kind === 'robe' ? FOOT - 2 - hip : 3;
      for (let i = 0; i < len; i++) {
        const w = b.hw + 1 + Math.floor(i / 2);
        const left = cx - Math.floor(w / 2) + (action === 'run' ? -Math.floor(i / 3) : 0);
        px(c, left, hip + i, w, 1, i === len - 1 ? cm!.trim : cm!.base);
        px(c, left, hip + i, 1, 1, cm!.baseLo);
      }
    }
    if (chest?.kind === 'plate') { px(c, cx + half - 2, top - 1, 3, 3, cm!.baseHi); px(c, cx + half - 1, top - 2, 2, 1, cm!.baseHi); }
    if (chest?.kind === 'mantle') {
      // The clasp across the shoulders.
      px(c, cx - half, top - 1, b.sw, 2, matOf(chest).base);
      px(c, cx + 1, top, 2, 2, matOf(chest).trim);
    }

    // 5b. A work apron (bib to knee) and a sash, over whatever the chest wears.
    if (garb?.apron) {
      const a = garb.apron, atop = top + 1, bottom = hip + 4;
      for (let y = atop; y <= bottom; y++) {
        const w = y < atop + 3 ? b.sw - 3 : b.hw - 1;
        const left = cx - Math.floor(w / 2) + 1;
        px(c, left, y, w, 1, y === bottom ? dark(a, .3) : a);
        px(c, left, y, 1, 1, light(a, .2));
      }
      px(c, cx, hip + 1, 3, 1, dark(a, .3)); // the pocket
    }
    if (garb?.sash) limb(c, cx - half + 1, top + 1, cx + half - 1, hip - 1, 2, garb.sash);

    // 6. Belt, charms, pendant.
    const legs = gear.legs;
    const beltColor = legs?.kind === 'belt' ? matOf(legs).accent : BELT;
    const hw = b.hw;
    px(c, cx - Math.floor(hw / 2), hip - 1, hw, 2, beltColor);
    px(c, cx + 1, hip - 1, 2, 2, legs?.kind === 'belt' ? matOf(legs).trim : '#c9a45a');
    const charms = (['charm1', 'charm2', 'charm3'] as const).map(slot => gear[slot]).filter((p): p is GearPiece => !!p);
    charms.forEach((charm, i) => px(c, cx - 3 + i * 2, hip + 1, 1, 2, RARITY_TRIM[charm.rarity]));
    if (gear.trinket) {
      px(c, cx + 2, top + 1, 1, 1, '#c9a45a');
      px(c, cx + 2, top + 2, 2, 2, RARITY_TRIM[gear.trinket.rarity]);
    }

    // 7. The big head (the elder's sits a pixel forward and lower).
    const old = garb?.elder ? 1 : 0;
    const hx = cx - 7 + old, hy = HEAD_TOP + uy + f.nod + old;
    this.head(c, hx, hy, face);
    if (garb?.book) {
      // An open book that floats beside the head, its runes lit.
      const bx = hx + HW + 1, by = hy + 2;
      px(c, bx, by + 1, 8, 4, '#efe4c4'); px(c, bx + 1, by, 3, 1, '#efe4c4'); px(c, bx + 4, by, 3, 1, '#efe4c4');
      px(c, bx + 4, by, 1, 5, '#8c7a58'); px(c, bx, by + 4, 8, 1, '#c9b98f');
      px(c, bx + 1, by + 2, 2, 1, '#5fb6ff'); px(c, bx + 5, by + 2, 2, 1, '#5fb6ff'); px(c, bx + 6, by + 1, 1, 1, '#d8ecff');
    }
    return el;
  }

  /** A short leg and a tiny rounded foot; `ay` is the sole's row. */
  private leg(c: Ctx, x: number, hip: number, leg: Leg, back: boolean): void {
    const pal = this.pal, b = this.body, gear = this.gear ?? {};
    const greaves = gear.legs?.kind === 'greaves' ? matOf(gear.legs) : null;
    const boots = gear.feet ? matOf(gear.feet) : null;
    const ax = x + leg.dx, ay = FOOT - leg.lift;
    const color = greaves ? greaves.base : pal.trousers;
    limb(c, x, hip, ax, ay - 2, b.leg, back ? dark(color, .3) : color);
    if (greaves && !back) px(c, Math.round((x + ax) / 2) + 1, Math.round((hip + ay) / 2) - 1, 1, 2, greaves.baseHi);
    const boot = back ? dark(boots ? boots.base : LEATHER, .3) : boots ? boots.base : LEATHER;
    px(c, ax - 1, ay - 1, 4, 2, boot); px(c, ax + 3, ay, 1, 1, boot);
    if (boots) {
      px(c, ax - 1, ay - 2, 4, 1, back ? boot : boots.trim);
      if (!back) px(c, ax + 1, ay - 1, 2, 1, boots.baseHi);
    } else if (!back) px(c, ax + 1, ay - 1, 2, 1, light(LEATHER, .15));
  }

  private head(c: Ctx, x: number, y: number, face: KeeperFace): void {
    const pal = this.pal, look = this.look, gear = this.gear ?? {};
    const head = gear.head;
    const garb = this.garb;
    // Long hair and braids hang behind the head, down the back.
    if (look.hair === 'long' && head?.kind !== 'hood') {
      for (let r = 4; r <= 18; r++) px(c, x - 1, y + r, r > 15 ? 4 : 6, 1, r % 4 === 0 ? pal.hairLo : pal.hair);
    }
    if (look.hair === 'braid' && head?.kind !== 'hood') {
      for (let r = 8; r <= 19; r += 2) px(c, x - 1 + ((r >> 1) & 1), y + r, 2, 2, (r >> 1) & 1 ? pal.hairLo : pal.hair);
      px(c, x - 1, y + 21, 2, 1, pal.trim);
    }
    if (garb?.shards) {
      // Dawn-glass rising behind the head: four shards, lit on their left edges. Never a halo.
      for (const [sx, tall] of [[-1, 7], [2, 11], [6, 13], [10, 9]] as const) {
        px(c, x + sx, y + 3 - tall, 2, tall - 2, '#ffe7a0'); px(c, x + sx + 1, y + 1 - tall, 1, 2, '#fff1b0');
        px(c, x + sx, y + 3 - tall, 1, tall - 2, '#fffaf0'); px(c, x + sx + 1, y + 4 - tall + (tall >> 1), 1, 2, '#e0bc52');
      }
    }
    // The skull: a soft 15×14 round, shaded at the back and under the chin.
    for (let r = 0; r < HH; r++) {
      const inset = r === 0 ? 4 : r === 1 ? 2 : r === 2 || r === HH - 2 ? 1 : r === HH - 1 ? 3 : 0;
      px(c, x + inset, y + r, HW - inset * 2, 1, pal.skin);
    }
    px(c, x, y + 3, 1, HH - 6, pal.skinLo);
    px(c, x + 3, y + HH - 1, HW - 6, 1, pal.skinLo); px(c, x + 1, y + HH - 2, 2, 1, pal.skinLo);
    px(c, x + 3, y + 7, 2, 3, pal.skinLo); px(c, x + 4, y + 8, 1, 1, pal.skin); // the ear
    // Eyes and the rest of the face (or, for the Hollow, a mirror where a face would be).
    if (garb?.mirrorFace) {
      px(c, x + 6, y + 3, 8, 10, '#0e0912'); px(c, x + 5, y + 4, 10, 8, '#0e0912');
      px(c, x + 7, y + 4, 1, 7, '#8a90b0'); px(c, x + 8, y + 4, 1, 3, '#d8dcf0');
      px(c, x + 12, y + 10, 1, 1, '#A855F7');
      if (head?.kind !== 'hood' && head?.kind !== 'helm') this.hair(c, x, y);
      if (head) this.headGear(c, x, y, head);
      return;
    }
    if (look.face === 'scar') for (let i = 0; i < 6; i++) px(c, x + 13 - i, y + 4 + i, 1, 1, mix(pal.skin, '#f2d6d6', .6));
    const ey = y + 6;
    this.eye(c, x + 7, ey, face, false);
    this.eye(c, x + 11, ey, face, true);
    if (garb?.eyeGlow && face !== 'blink') {
      // One eye burns (Kael's forge eye): the front eye is the ember, a spark at its corner.
      px(c, x + 11, ey + 1, 2, 2, garb.eyeGlow); px(c, x + 11, ey + 1, 1, 1, '#ffffff'); px(c, x + 13, ey, 1, 1, garb.eyeGlow);
    }
    if (garb?.loupe) {
      const brass = '#b08a55';
      px(c, x + 10, ey - 1, 4, 1, brass); px(c, x + 10, ey + 3, 4, 1, brass); px(c, x + 10, ey, 1, 3, brass); px(c, x + 13, ey, 1, 3, '#e8c47a');
      px(c, x + 13, ey + 4, 1, 3, brass); // the chain
    }
    if (garb?.elder) { px(c, x + 11, ey + 3, 2, 1, pal.skinLo); px(c, x + 7, ey + 3, 2, 1, pal.skinLo); }
    if (look.face === 'rosy' || look.face === 'freckles') {
      px(c, x + 5, y + 10, 2, 1, pal.blush); px(c, x + 12, y + 10, 2, 1, pal.blush);
    }
    // The mouth: small; open in joy, a round "o" in surprise.
    if (face === 'happy') { px(c, x + 10, y + 11, 3, 1, pal.mouth); px(c, x + 11, y + 12, 1, 1, '#e86a7a'); }
    else if (face === 'surprised') px(c, x + 10, y + 11, 2, 2, pal.mouth);
    else px(c, x + 10, y + 11, 2, 1, pal.mouth);
    switch (look.face) {
      case 'freckles': px(c, x + 6, y + 9, 1, 1, pal.skinLo); px(c, x + 8, y + 10, 1, 1, pal.skinLo); px(c, x + 13, y + 9, 1, 1, pal.skinLo); break;
      case 'beard': {
        const h = pal.hair;
        px(c, x + 3, y + 9, 12, 3, h); px(c, x + 4, y + 12, 10, 2, h); px(c, x + 6, y + 14, 6, 1, h);
        px(c, x + 3, y + 6, 2, 3, h); px(c, x + 5, y + 9, 3, 1, pal.hairHi); px(c, x + 3, y + 11, 1, 2, pal.hairLo);
        px(c, x + 10, y + 10, 2, 1, dark(h, .45)); // the mouth in the beard
        break;
      }
      case 'warpaint': px(c, x + 10, y + 9, 4, 1, pal.trim); px(c, x + 6, y + 9, 2, 1, pal.trim); break;
    }
    // Hair on top, unless a hood or helm covers it.
    if (head?.kind !== 'hood' && head?.kind !== 'helm') this.hair(c, x, y);
    // Head gear over the hair; a town hat when there is none.
    if (head) this.headGear(c, x, y, head);
    else if (garb?.hat) this.hat(c, x, y, garb.hat, garb.hatColor ?? pal.trim);
  }

  /** One big eye (2×3) at (ex, ey), with a white highlight; `front` is the nearer eye. */
  private eye(c: Ctx, ex: number, ey: number, face: KeeperFace, front: boolean): void {
    const pal = this.pal, dk = pal.eyeDk;
    switch (face) {
      case 'blink': px(c, ex, ey + 2, 2, 1, dk); return;
      case 'happy': px(c, ex, ey + 2, 1, 1, dk); px(c, ex + 1, ey + 1, 1, 1, dk); px(c, ex + 2, ey + 2, 1, 1, dk); return;
      case 'surprised':
        px(c, ex, ey - 1, 2, 4, dk); px(c, ex + 1, ey + 1, 1, 2, pal.eye); px(c, ex, ey - 1, 1, 1, '#ffffff'); return;
    }
    if (this.look.eyes === 'narrow') {
      // Calm half-lidded eyes: the lid, then the iris under it.
      px(c, ex, ey + 1, 2, 1, dk); px(c, ex, ey + 2, 2, 1, pal.eye); px(c, ex + 1, ey + 2, 1, 1, pal.eyeHi);
      return;
    }
    px(c, ex, ey, 2, 3, dk);
    px(c, ex + 1, ey + 1, 1, 2, pal.eye); px(c, ex, ey + 2, 1, 1, pal.eye);
    px(c, ex, ey, 1, 1, '#ffffff');
    if (this.look.eyes === 'bright') {
      px(c, ex + 1, ey + 2, 1, 1, pal.eyeHi);
      if (front) px(c, ex + 2, ey, 1, 1, dk); // a lash
    }
  }

  private hat(c: Ctx, x: number, y: number, kind: 'brim' | 'cap', color: string): void {
    if (kind === 'brim') {
      px(c, x + 1, y - 7, HW - 2, 6, color); px(c, x + 2, y - 8, HW - 5, 1, color);
      px(c, x + 2, y - 7, HW - 6, 1, light(color, .25)); px(c, x + 1, y - 3, HW - 2, 1, this.pal.trim);
      px(c, x - 3, y - 2, HW + 6, 1, color); px(c, x - 3, y - 1, HW + 6, 1, dark(color, .3));
    } else {
      px(c, x, y - 4, HW, 5, color); px(c, x + 2, y - 5, HW - 5, 1, color);
      px(c, x + 2, y - 4, HW - 7, 1, light(color, .25)); px(c, x + 6, y - 5, 2, 1, this.pal.trim);
      px(c, x + HW - 3, y, 6, 1, dark(color, .25)); // the bill, forward
    }
  }

  private hair(c: Ctx, x: number, y: number): void {
    const pal = this.pal;
    /** The base cap: a round dome, a fringe over the brow, a back hang to row `back`. */
    const cap = (back: number) => {
      px(c, x + 4, y - 2, HW - 8, 1, pal.hair); px(c, x + 2, y - 1, HW - 4, 1, pal.hair);
      px(c, x + 1, y, HW - 2, 1, pal.hair); px(c, x, y + 1, HW, 4, pal.hair);
      px(c, x, y + 5, 5, back - 5, pal.hair);
      px(c, x + 6, y + 5, 2, 1, pal.hair); px(c, x + 10, y + 5, 1, 1, pal.hair); px(c, x + 13, y + 5, 2, 2, pal.hair);
      px(c, x + 4, y - 1, 4, 1, pal.hairHi); px(c, x + 2, y, 2, 1, pal.hairHi); px(c, x + 9, y, 2, 1, pal.hairHi);
      px(c, x, y + 2, 1, back - 2, pal.hairLo);
    };
    switch (this.look.hair) {
      case 'cropped': cap(8); break;
      case 'swept':
        cap(9); px(c, x + 7, y + 5, 5, 1, pal.hair); px(c, x + 12, y - 2, 3, 2, pal.hair); px(c, x + 14, y, 2, 2, pal.hair);
        px(c, x + 9, y - 2, 3, 1, pal.hairHi);
        break;
      case 'long': cap(11); break;
      case 'braid': cap(9); break;
      case 'topknot':
        cap(9); px(c, x + 5, y - 5, 5, 3, pal.hair); px(c, x + 6, y - 6, 3, 1, pal.hair); px(c, x + 6, y - 5, 2, 1, pal.hairHi);
        px(c, x + 5, y - 2, 5, 1, pal.trim);
        break;
      case 'curls':
        px(c, x - 1, y - 2, HW + 2, 6, pal.hair); px(c, x + 1, y - 3, HW - 2, 1, pal.hair);
        for (let i = 1; i < HW; i += 3) px(c, x + i, y - 4, 2, 1, pal.hair);
        px(c, x - 1, y + 4, 6, 7, pal.hair);
        for (let i = 5; i < 11; i += 2) px(c, x - 2, y + i, 1, 1, pal.hair);
        px(c, x + 6, y + 4, 2, 2, pal.hair); px(c, x + 10, y + 4, 2, 1, pal.hair); px(c, x + 13, y + 4, 2, 3, pal.hair);
        px(c, x + 2, y - 2, 2, 1, pal.hairHi); px(c, x + 7, y - 3, 2, 1, pal.hairHi); px(c, x + 4, y - 1, 1, 1, pal.hairHi);
        px(c, x - 1, y + 2, 1, 8, pal.hairLo);
        break;
      case 'mohawk':
        px(c, x + 1, y, HW - 2, 3, mix(pal.skin, pal.hair, .3));
        px(c, x + 4, y - 3, 6, 4, pal.hair); px(c, x + 5, y - 5, 4, 2, pal.hair); px(c, x + 6, y - 5, 2, 1, pal.hairHi);
        break;
      case 'shaved': px(c, x + 2, y, HW - 4, 2, mix(pal.skin, pal.hair, .35)); px(c, x + 1, y + 1, 1, 3, mix(pal.skin, pal.hair, .35)); break;
    }
  }

  private headGear(c: Ctx, x: number, y: number, head: GearPiece): void {
    const m = matOf(head);
    switch (head.kind) {
      case 'helm':
        // A round cap of a helm on the big head: the eyes stay clear under the brim.
        px(c, x + 3, y - 4, HW - 6, 1, m.base); px(c, x + 1, y - 3, HW - 2, 1, m.base); px(c, x, y - 2, HW, 1, m.base);
        px(c, x - 1, y - 1, HW + 2, 5, m.base);
        px(c, x + 3, y - 3, 6, 1, m.baseHi); px(c, x + 1, y - 2, 2, 2, m.baseHi);
        px(c, x - 1, y + 4, HW + 2, 2, m.baseLo);
        for (const k of [2, 7, 12]) px(c, x + k, y + 4, 1, 1, m.trim);
        px(c, x - 1, y + 6, 5, 6, m.base); px(c, x - 1, y + 6, 1, 6, m.baseLo); // the cheek and neck guard
        if (m.bright || head.rarity === 'rare') {
          // A crest in the tier's colour, swept back.
          px(c, x + 3, y - 7, 7, 3, m.trim); px(c, x + 1, y - 6, 3, 2, m.trim); px(c, x - 1, y - 5, 2, 2, dark(m.trim, .2));
          px(c, x + 4, y - 7, 4, 1, light(m.trim, .3));
        }
        break;
      case 'hood':
        // A soft pointed hood: crown, a little tip at the back, a drape and a lip round the face.
        px(c, x + 1, y - 4, HW - 3, 1, m.base); px(c, x - 1, y - 3, HW + 2, 8, m.base);
        px(c, x - 2, y - 2, 1, 2, m.base); px(c, x - 3, y - 1, 1, 1, m.base);
        px(c, x - 2, y + 5, 7, 10, m.base); px(c, x - 2, y + 5, 1, 10, m.baseLo);
        px(c, x + 13, y + 5, 3, 6, m.base); px(c, x + 15, y + 5, 1, 6, m.baseLo);
        px(c, x + 2, y - 3, 5, 1, m.baseHi);
        px(c, x + 5, y + 4, 9, 1, m.trim); px(c, x + 12, y + 5, 1, 6, m.trim);
        break;
      case 'crown': {
        const gold = mix('#e0bc52', m.base, .35);
        px(c, x + 1, y - 3, HW - 2, 3, m.base === STYLE_COLORS.umbral[0] ? m.accent : gold);
        for (const k of [1, 7, 13]) px(c, x + k, y - 5, 1, 2, gold);
        px(c, x + 4, y - 4, 1, 1, gold); px(c, x + 10, y - 4, 1, 1, gold);
        px(c, x + 7, y - 2, 1, 2, m.trim); px(c, x + 2, y - 3, HW - 4, 1, light(gold, .3));
        break;
      }
      case 'circlet':
        px(c, x, y + 4, HW, 1, mix('#d8d0b8', m.base, .3)); px(c, x + 11, y + 3, 2, 2, m.trim); px(c, x + 11, y + 3, 1, 1, '#ffffff');
        break;
    }
  }
}
