/**
 * keeper-paint.ts — the pixel Keeper: a look (keeper-look.model.ts) and worn
 * gear (keeper-gear.ts) painted as Terraria-style layers.
 *
 * The figure lives in a 48×48 art-pixel cell, feet on the bottom edge at x 24,
 * facing right (the engine mirrors the context to face left). Each animation
 * frame of the BODY — cape, back arm + off-hand, legs, torso + armour, head,
 * face, hair, helm — is painted once into a small canvas, outlined in one dark
 * pass (the readability MapleStory and Terraria both get from an outline) and
 * cached. The FRONT arm and the held weapon are drawn live on top, so a swing is
 * smooth rather than six stiff frames: per frame that is one cached blit, one
 * weapon blit and a handful of rects.
 *
 * Draw order, back to front: cape → back arm, off-hand, back hand → back leg →
 * torso / chest armour → front leg, coat skirt, boots → belt, charms, pendant →
 * neck, head, face, hair, head gear → (live) weapon → front arm → front hand.
 *
 * Browser only (canvas). Pure inputs: the same look + gear always paint the
 * same pixels, which is what the specs and the e2e pixel diff rely on.
 */
import { EYE_COLORS, HAIR_COLORS, KeeperLook, OUTFIT_COLORS, SKIN_TONES, lookKey } from './keeper-look.model';
import {
  GearPiece, GripTransform, HoldPose, KeeperAction, KeeperGear, RARITY_TRIM, STYLE_COLORS, WEAPON_SPECS, WeaponKind,
  gearKey, gripTransform, handAt, holdPose,
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

// ── Body geometry ──
const BODY = {
  slight: { sw: 8, hw: 6, leg: 3 },
  sturdy: { sw: 10, hw: 7, leg: 3 },
  broad: { sw: 12, hw: 8, leg: 4 },
} as const;
const FOOT = 47;
const HIP = 33;
const SHOULDER = 21;
const HEAD_TOP = 8;
const HEAD = 11;
const CX = 24;

interface Leg { dx: number; lift: number }
/** One body frame: whole-figure offsets plus legs and the back arm. */
export interface BodyFrame { bob: number; lean: number; back: Leg; front: Leg; armB: number; cape: number }

export const RUN_FRAMES = 8;
export const IDLE_FRAMES = 4;

/** The body frame for an action (pure; the live arm reads the same bob/lean). */
export function bodyFrame(action: KeeperAction, frame: number): BodyFrame {
  switch (action) {
    case 'run': {
      const p = frame / RUN_FRAMES * Math.PI * 2, s = Math.sin(p), k = Math.cos(p);
      return {
        bob: Math.abs(s) > .7 ? 0 : -1, lean: 1,
        front: { dx: Math.round(3 * s), lift: Math.max(0, Math.round(2.5 * k)) },
        back: { dx: -Math.round(3 * s), lift: Math.max(0, Math.round(-2.5 * k)) },
        armB: 1.57 - .7 * s, cape: 3 + (frame & 1),
      };
    }
    case 'jump': return { bob: -1, lean: 0, front: { dx: 2, lift: 4 }, back: { dx: -1, lift: 2 }, armB: .6, cape: 2 };
    case 'fall': return { bob: 0, lean: 0, front: { dx: 3, lift: 1 }, back: { dx: -3, lift: 2 }, armB: -.4, cape: -1 };
    case 'attack': return frame === 0
      ? { bob: 0, lean: -1, front: { dx: 2, lift: 0 }, back: { dx: -2, lift: 0 }, armB: 2.2, cape: 1 }
      : { bob: 1, lean: 1, front: { dx: 4, lift: 0 }, back: { dx: -3, lift: 0 }, armB: 2.6, cape: 3 };
    case 'hurt': return { bob: 0, lean: -2, front: { dx: 1, lift: 0 }, back: { dx: -2, lift: 1 }, armB: 2.6, cape: 2 };
    case 'dodge': return { bob: 4, lean: 3, front: { dx: 4, lift: 0 }, back: { dx: -4, lift: 0 }, armB: 2.4, cape: 4 };
    case 'rest': return { bob: 5, lean: 0, front: { dx: 5, lift: 2 }, back: { dx: 4, lift: 1 }, armB: 1.2, cape: 0 };
    case 'walk': {
      // The townsfolk's stroll: the run's cycle at half the stride, upright.
      const p = frame / RUN_FRAMES * Math.PI * 2, s = Math.sin(p), k = Math.cos(p);
      return {
        bob: Math.abs(s) > .7 ? 0 : -1, lean: 0,
        front: { dx: Math.round(2 * s), lift: Math.max(0, Math.round(1.5 * k)) },
        back: { dx: -Math.round(2 * s), lift: Math.max(0, Math.round(-1.5 * k)) },
        armB: 1.6 - .35 * s, cape: 1,
      };
    }
    default: return { bob: frame >= 2 ? 1 : 0, lean: 0, front: { dx: 1, lift: 0 }, back: { dx: -1, lift: 0 }, armB: 1.7, cape: 0 };
  }
}

/** Which cached body frame a moment shows. */
export function frameIndex(action: KeeperAction, time: number, attackT: number, reduced: boolean): number {
  if (reduced) return 0;
  switch (action) {
    case 'run': return Math.floor((((time * 9) / (Math.PI * 2)) % 1 + 1) % 1 * RUN_FRAMES) % RUN_FRAMES;
    case 'idle': case 'talk': return Math.floor(time * 1.6) % IDLE_FRAMES;
    // `time` is the walker's own stride phase (radians), so feet never slide out of step with the ground.
    case 'walk': return Math.floor(((time / (Math.PI * 2)) % 1 + 1) % 1 * RUN_FRAMES) % RUN_FRAMES;
    case 'attack': return attackT < .3 ? 0 : 1;
    default: return 0;
  }
}
/** The run-cycle phase that matches a run frame (for the live arm). */
function runPhase(frame: number): number { return frame / RUN_FRAMES * Math.PI * 2; }

/** Palette of one look + gear, resolved once per painter. */
interface Palette {
  skin: string; skinLo: string; skinHi: string;
  hair: string; hairLo: string; hairHi: string;
  eye: string;
  tunic: string; tunicLo: string; tunicHi: string;
  trim: string; trousers: string; trousersLo: string;
}
function paletteOf(look: KeeperLook, garb: KeeperGarb | null): Palette {
  const skin = garb?.skin ?? SKIN_TONES[look.skin] ?? SKIN_TONES[2];
  const hair = garb?.hair ?? HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[2];
  const tunic = garb?.tunic ?? OUTFIT_COLORS[look.outfit] ?? OUTFIT_COLORS[0];
  const trim = garb?.trim ?? OUTFIT_COLORS[look.trim] ?? OUTFIT_COLORS[4];
  const trousers = garb?.trousers ?? mix(trim, '#2a2230', .45);
  return {
    skin, skinLo: dark(skin, .22), skinHi: light(skin, .25),
    hair, hairLo: dark(hair, .3), hairHi: light(hair, .28),
    eye: EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0],
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
  /** Seconds (drives idle breath and the run cycle). */
  time: number;
  /** 0..1 through the attack window. */
  attackT: number;
  /** 0..1: an additive rim flash on strike or wound. */
  rim?: number;
  reduced?: boolean;
  /** Draw the held weapon (false for other Keepers seen in the world). */
  weapon?: boolean;
}

/**
 * One Keeper's painter: the cached body frames and held sprites for a look +
 * gear. Rebuild it when either changes (`key`).
 */
export class KeeperPainter {
  readonly key: string;
  private readonly pal: Palette;
  private readonly body: typeof BODY[keyof typeof BODY];
  private readonly frames = new Map<string, HTMLCanvasElement>();
  private readonly weaponKind: WeaponKind | null;
  private weaponSprite: HTMLCanvasElement | null = null;
  private offhand: OffhandSprite | null | undefined;
  private readonly pose: HoldPose = { arm: 0, weapon: 0 };
  private readonly hand = { x: 0, y: 0 };
  private readonly grip: GripTransform = { x: 0, y: 0, rotation: 0, drawX: 0, drawY: 0 };

  constructor(readonly look: KeeperLook, readonly gear: KeeperGear | null = null, readonly garb: KeeperGarb | null = null) {
    this.key = `${lookKey(look)}#${gearKey(gear)}#${garbKey(garb)}`;
    this.pal = paletteOf(look, garb);
    this.body = BODY[look.body] ?? BODY.sturdy;
    const weapon = gear?.weapon;
    this.weaponKind = weapon && weapon.kind in WEAPON_SPECS ? weapon.kind as WeaponKind : null;
  }

  /**
   * A townsperson with nothing in the main hand carries the off-hand prop
   * (ledger, lantern, scales, cards) in FRONT, where it reads: in the back hand
   * it would hang hidden behind the body. Players keep the off-hand behind.
   */
  private get frontProp(): boolean { return !!this.garb && !this.weaponKind && !!this.gear?.['off-hand']; }

  /** The held weapon's kind, or null (bare hand). */
  get weapon(): WeaponKind | null { return this.weaponKind; }

  /**
   * Draw the Keeper with the context at its feet (already mirrored to face).
   * `scale` is world px per art pixel. Shadow/alpha set by the caller apply to
   * the body blit; the live arm and weapon are drawn without the shadow.
   */
  draw(c: Ctx, scale: number, state: PaintState): void {
    const action = state.action;
    const frame = frameIndex(action, state.time, state.attackT, !!state.reduced);
    const body = this.frame(action, frame);
    const smoothing = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    const x = -PIVOT_X * scale, y = -PIVOT_Y * scale, size = CELL * scale;
    c.drawImage(body, x, y, size, size);
    if (state.rim && state.rim > .01) {
      c.save(); c.shadowBlur = 0; c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(1, state.rim) * .45;
      c.drawImage(body, x + scale * .5, y - scale * .5, size, size);
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
    c.imageSmoothingEnabled = smoothing;
  }

  /** A still (idle, weapon in hand) filling `target`, cropped to the figure. For portraits and the paper doll. */
  still(target: HTMLCanvasElement, crop = { x: 2, y: 3, size: 44 }): void {
    const c = target.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, target.width, target.height);
    const scale = target.width / crop.size;
    c.save();
    c.translate((PIVOT_X - crop.x) * scale, (PIVOT_Y - crop.y) * scale);
    this.draw(c, scale, { action: 'idle', time: 0, attackT: 0, weapon: true, reduced: true });
    c.restore();
  }

  // ── Live: the front arm and the weapon ──
  private frontArm(c: Ctx, action: KeeperAction, frame: number, state: PaintState): void {
    const f = bodyFrame(action, frame);
    const sx = CX + 1 + f.lean, sy = SHOULDER + 2 + f.bob;
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
    }
    if (this.frontProp) {
      const off = this.gear!['off-hand']!;
      const prop = this.offhand === undefined ? (this.offhand = paintOffhand(off, matOf(off))) : this.offhand;
      if (prop) c.drawImage(prop.el, Math.round(hand.x) - prop.gx, Math.round(hand.y) - prop.gy);
    }
    const sleeve = this.sleeveColor();
    const t = this.body.leg;
    limb(c, sx, sy, hand.x, hand.y, t + 2, OUTLINE);
    limb(c, sx, sy, hand.x, hand.y, t, sleeve);
    const glove = this.gloveColor();
    px(c, Math.round(hand.x) - 2, Math.round(hand.y) - 2, 5, 5, OUTLINE);
    px(c, Math.round(hand.x) - 1, Math.round(hand.y) - 1, 3, 3, glove);
    if (kind && state.attackT > .3 && (WEAPON_SPECS[kind].swing === 'cast')) {
      // A cast: the head of the staff or wand flares in the tier's colour.
      const tip = { x: 0, y: 0 };
      const cos = Math.cos(this.pose.weapon), sin = Math.sin(this.pose.weapon);
      const reach = WEAPON_SPECS[kind].gy;
      tip.x = Math.round(hand.x + cos * reach); tip.y = Math.round(hand.y + sin * reach);
      c.globalAlpha *= .85;
      px(c, tip.x - 1, tip.y - 1, 3, 3, light(RARITY_TRIM[this.gear!.weapon!.rarity], .4));
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

  // ── Cached body frames ──
  private frame(action: KeeperAction, frame: number): HTMLCanvasElement {
    const id = `${action}:${frame}`;
    let el = this.frames.get(id);
    if (!el) {
      el = action === 'death' ? this.lying() : outlined(this.paintBody(bodyFrame(action, frame), action));
      this.frames.set(id, el);
    }
    return el;
  }
  private lying(): HTMLCanvasElement {
    const stand = this.frame('idle', 0);
    const out = canvas(CELL, CELL);
    const c = out.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.translate(44, 41); c.rotate(-Math.PI / 2);
    c.drawImage(stand, -PIVOT_X, -PIVOT_Y);
    return out;
  }

  private paintBody(f: BodyFrame, action: KeeperAction): HTMLCanvasElement {
    const el = canvas(CELL, CELL);
    const c = el.getContext('2d')!;
    const pal = this.pal, b = this.body, gear = this.gear ?? {};
    const ux = f.lean, uy = f.bob; // upper-body offset
    const hip = HIP + uy;
    const cx = CX + ux;

    // 1. Cape (a mantle) behind everything.
    if (gear.chest?.kind === 'mantle') {
      const m = matOf(gear.chest);
      const top = SHOULDER - 1 + uy, bottom = FOOT - 4 - (action === 'rest' ? 3 : 0);
      for (let y = top; y <= bottom; y++) {
        const u = (y - top) / Math.max(1, bottom - top);
        const back = Math.round(u * f.cape);
        const left = cx - b.sw / 2 - back - (u > .3 ? 1 : 0);
        px(c, left, y, b.sw - 1, 1, y === bottom ? m.trim : m.base);
        px(c, left, y, 1, 1, m.baseLo);
      }
    }

    // 1b. A sack or rope coil slung over the back shoulder.
    const garb = this.garb;
    if (garb?.sack) {
      const sx = cx - Math.floor(b.sw / 2) - 4, sy = SHOULDER - 3 + uy;
      px(c, sx, sy + 1, 6, 8, garb.sack); px(c, sx + 1, sy, 4, 1, garb.sack);
      px(c, sx, sy + 1, 1, 7, dark(garb.sack, .3)); px(c, sx + 1, sy + 1, 2, 1, light(garb.sack, .25));
      px(c, sx + 4, sy + 2, 2, 1, dark(garb.sack, .35)); // the tie
    }

    // 2. Back arm, with the off-hand item and the back hand.
    const bsx = cx - 1, bsy = SHOULDER + 2 + uy;
    const bhx = bsx + Math.cos(f.armB) * (ARM - 1), bhy = bsy + Math.sin(f.armB) * (ARM - 1);
    limb(c, bsx, bsy, bhx, bhy, b.leg, dark(this.sleeveColor(), .3));
    const off = gear['off-hand'];
    if (off && !this.frontProp) {
      const sprite = this.offhand === undefined ? (this.offhand = paintOffhand(off, matOf(off))) : this.offhand;
      if (sprite) c.drawImage(sprite.el, Math.round(bhx) - sprite.gx, Math.round(bhy) - sprite.gy);
    }
    if (!garb?.oneHand) px(c, Math.round(bhx) - 1, Math.round(bhy) - 1, 3, 3, dark(this.gloveColor(), .25));

    // 3. Back leg.
    this.leg(c, cx - 1, hip, f.back, true);

    // 4. Torso, with the chest piece.
    const chest = gear.chest;
    const cm = chest ? matOf(chest) : null;
    const cloth = chest?.kind === 'plate' ? cm!.base : chest?.kind === 'coat' || chest?.kind === 'robe' ? cm!.base : pal.tunic;
    const clothHi = chest && chest.kind !== 'mantle' ? cm!.baseHi : pal.tunicHi;
    const clothLo = chest && chest.kind !== 'mantle' ? cm!.baseLo : pal.tunicLo;
    for (let y = SHOULDER + uy; y <= hip; y++) {
      const u = (y - SHOULDER - uy) / (hip - SHOULDER - uy);
      const w = Math.round(u < .25 ? b.sw : b.sw + (b.hw - b.sw) * (u - .25) / .75);
      const left = cx - Math.floor(w / 2);
      px(c, left, y, w, 1, cloth);
      px(c, left, y, 1, 1, clothLo);
      px(c, left + w - 2, y, 1, 1, clothHi);
    }
    if (chest?.kind === 'plate') {
      px(c, cx - Math.floor(b.sw / 2) + 1, SHOULDER + 5 + uy, b.sw - 2, 1, cm!.baseLo);
      px(c, cx - Math.floor(b.sw / 2) + 1, SHOULDER + 8 + uy, b.sw - 2, 1, cm!.baseLo);
      px(c, cx + 1, SHOULDER + 2 + uy, 2, 2, cm!.trim);
      // Pauldrons: the far one darker, the near one on top.
      px(c, cx - Math.floor(b.sw / 2) - 1, SHOULDER - 1 + uy, 4, 3, cm!.baseLo);
    } else {
      // Collar and a seam in the trim colour.
      px(c, cx - 1, SHOULDER + uy, 4, 1, chest ? cm!.trim : pal.trim);
      px(c, cx + 1, SHOULDER + 1 + uy, 1, hip - SHOULDER - 2, chest ? cm!.accent : dark(pal.tunic, .15));
    }

    // 5. Front leg, then the skirt of a coat or robe over the legs.
    this.leg(c, cx + 1, hip, f.front, false);
    if (chest && (chest.kind === 'coat' || chest.kind === 'robe')) {
      const len = chest.kind === 'robe' ? FOOT - 3 - hip : 6;
      for (let i = 0; i < len; i++) {
        const w = b.hw + 1 + Math.floor(i / 3);
        const left = cx - Math.floor(w / 2) + (action === 'run' ? -Math.floor(i / 4) : 0);
        px(c, left, hip + i, w, 1, i === len - 1 ? cm!.trim : cm!.base);
        px(c, left, hip + i, 1, 1, cm!.baseLo);
      }
    }
    if (chest?.kind === 'plate') px(c, cx + Math.floor(b.sw / 2) - 3, SHOULDER - 1 + uy, 4, 3, cm!.baseHi);
    if (chest?.kind === 'mantle') {
      // The clasp across the shoulders.
      px(c, cx - Math.floor(b.sw / 2), SHOULDER - 1 + uy, b.sw, 2, matOf(chest).base);
      px(c, cx + 1, SHOULDER + uy, 2, 2, matOf(chest).trim);
    }

    // 5b. A work apron (bib to knee) and a sash, over whatever the chest wears.
    if (garb?.apron) {
      const a = garb.apron, top = SHOULDER + 3 + uy, bottom = hip + 8;
      for (let y = top; y <= bottom; y++) {
        const w = y < top + 4 ? b.sw - 4 : b.hw + 1;
        const left = cx - Math.floor(w / 2) + 1;
        px(c, left, y, w, 1, y === bottom ? dark(a, .3) : a);
        px(c, left, y, 1, 1, light(a, .2));
      }
      px(c, cx, SHOULDER + uy, 1, 3, dark(a, .2)); // the neck strap
      px(c, cx - 1, hip + 3, 4, 1, dark(a, .3)); // the pocket
    }
    if (garb?.sash) limb(c, cx - Math.floor(b.sw / 2) + 1, SHOULDER + 1 + uy, cx + Math.floor(b.sw / 2) - 1, hip - 2, 2, garb.sash);

    // 6. Belt, charms, pendant.
    const legs = gear.legs;
    const beltColor = legs?.kind === 'belt' ? matOf(legs).accent : BELT;
    px(c, cx - Math.floor(b.hw / 2) - 1, hip - 1, b.hw + 2, 2, beltColor);
    px(c, cx + 1, hip - 1, 2, 2, legs?.kind === 'belt' ? matOf(legs).trim : '#c9a45a');
    const charms = (['charm1', 'charm2', 'charm3'] as const).map(slot => gear[slot]).filter((p): p is GearPiece => !!p);
    charms.forEach((charm, i) => px(c, cx - 3 + i * 2, hip + 1, 1, 2, RARITY_TRIM[charm.rarity]));
    if (gear.trinket) {
      px(c, cx + 2, SHOULDER + uy, 1, 2, '#c9a45a');
      px(c, cx + 2, SHOULDER + 2 + uy, 2, 2, RARITY_TRIM[gear.trinket.rarity]);
    }

    // 7. Neck and head.
    const old = garb?.elder ? 1 : 0;
    const hx = cx - 5 + old, hy = HEAD_TOP + uy + old;
    px(c, cx + old, hy + HEAD, 3, 2, pal.skinLo);
    this.head(c, hx, hy);
    if (garb?.book) {
      // An open book that floats at the shoulder, its runes lit.
      const bx = cx + 8, by = SHOULDER - 7 + uy;
      px(c, bx, by + 1, 8, 4, '#efe4c4'); px(c, bx + 1, by, 3, 1, '#efe4c4'); px(c, bx + 4, by, 3, 1, '#efe4c4');
      px(c, bx + 4, by, 1, 5, '#8c7a58'); px(c, bx, by + 4, 8, 1, '#c9b98f');
      px(c, bx + 1, by + 2, 2, 1, '#5fb6ff'); px(c, bx + 5, by + 2, 2, 1, '#5fb6ff'); px(c, bx + 6, by + 1, 1, 1, '#d8ecff');
    }
    return el;
  }

  private leg(c: Ctx, x: number, hip: number, leg: Leg, back: boolean): void {
    const pal = this.pal, b = this.body, gear = this.gear ?? {};
    const greaves = gear.legs?.kind === 'greaves' ? matOf(gear.legs) : null;
    const boots = gear.feet ? matOf(gear.feet) : null;
    const ax = x + leg.dx, ay = FOOT - 2 - leg.lift;
    const color = greaves ? greaves.base : pal.trousers;
    limb(c, x, hip, ax, ay - 1, b.leg, back ? dark(color, .3) : color);
    if (greaves && !back) px(c, Math.round((x + ax) / 2) + 1, Math.round((hip + ay) / 2), 1, 2, greaves.baseHi);
    const boot = boots ? boots.base : LEATHER;
    const tall = boots ? 4 : 3;
    px(c, ax - 1, ay + 3 - tall, 4, tall, back ? dark(boot, .3) : boot);
    px(c, ax + 2, ay + 1, 1, 2, back ? dark(boot, .3) : boots ? boots.baseHi : light(LEATHER, .15));
    if (boots && !back) px(c, ax - 1, ay + 3 - tall, 4, 1, boots.trim);
  }

  private head(c: Ctx, x: number, y: number): void {
    const pal = this.pal, look = this.look, gear = this.gear ?? {};
    const head = gear.head;
    // Long hair and braids hang behind the head.
    if (look.hair === 'long' && head?.kind !== 'hood') {
      for (let r = 2; r <= 14; r++) px(c, x - 1, y + r, r > 11 ? 3 : 4, 1, r % 4 === 0 ? pal.hairLo : pal.hair);
    }
    if (look.hair === 'braid' && head?.kind !== 'hood') {
      for (let r = 5; r <= 17; r += 2) px(c, x - 1 + ((r >> 1) & 1), y + r, 2, 2, (r >> 1) & 1 ? pal.hairLo : pal.hair);
      px(c, x - 1, y + 18, 2, 1, pal.trim);
    }
    const garb = this.garb;
    if (garb?.shards) {
      // Dawn-glass rising behind the head: four shards, lit on their left edges. Never a halo.
      for (const [sx, tall] of [[-2, 6], [0, 10], [3, 12], [6, 8]] as const) {
        // Each shard: two pixels wide, tapering to a single-pixel point.
        px(c, x + sx, y + 4 - tall, 2, tall - 2, '#ffe7a0'); px(c, x + sx + 1, y + 2 - tall, 1, 2, '#fff1b0');
        px(c, x + sx, y + 4 - tall, 1, tall - 2, '#fffaf0'); px(c, x + sx + 1, y + 5 - tall + (tall >> 1), 1, 2, '#e0bc52');
      }
    }
    // Skull: an 11×11 block, corners rounded, shaded at the back and chin.
    px(c, x, y + 1, HEAD, HEAD - 2, pal.skin);
    px(c, x + 1, y, HEAD - 2, HEAD, pal.skin);
    px(c, x, y + 1, 1, HEAD - 2, pal.skinLo);
    px(c, x + 1, y + HEAD - 1, HEAD - 2, 1, pal.skinLo);
    px(c, x + HEAD, y + 6, 1, 1, pal.skin); // the nose
    px(c, x + 3, y + 5, 2, 2, pal.skinLo); // the ear
    // Eyes and brow (or, for the Hollow, a mirror where a face would be).
    const ex = x + 7, ey = y + 5;
    if (garb?.mirrorFace) {
      px(c, x + 5, y + 2, 6, 8, '#0e0912'); px(c, x + 6, y + 3, 1, 5, '#8a90b0'); px(c, x + 7, y + 3, 1, 2, '#d8dcf0');
      px(c, x + 9, y + 7, 1, 1, '#A855F7');
      if (head?.kind !== 'hood' && head?.kind !== 'helm') this.hair(c, x, y);
      if (head) this.headGear(c, x, y, head);
      return;
    }
    if (look.eyes === 'narrow') { px(c, ex, ey + 1, 1, 1, '#f4f0ea'); px(c, ex + 1, ey + 1, 1, 1, pal.eye); }
    else {
      px(c, ex, ey, 1, 2, '#f4f0ea'); px(c, ex + 1, ey, 1, 2, pal.eye);
      if (look.eyes === 'bright') px(c, ex + 1, ey, 1, 1, light(pal.eye, .6));
    }
    if (garb?.eyeGlow) px(c, ex + 1, look.eyes === 'narrow' ? ey + 1 : ey, 1, look.eyes === 'narrow' ? 1 : 2, garb.eyeGlow);
    px(c, ex, ey - 1, 2, 1, pal.hairLo);
    if (garb?.loupe) {
      const brass = '#b08a55';
      px(c, ex - 1, ey - 1, 4, 1, brass); px(c, ex - 1, ey + 2, 4, 1, brass); px(c, ex - 1, ey, 1, 2, brass); px(c, ex + 2, ey, 1, 2, '#e8c47a');
      px(c, ex + 3, ey + 2, 1, 3, brass); // the chain
    }
    if (garb?.elder) px(c, x + 7, y + 7, 2, 1, pal.skinLo);
    px(c, x + 8, y + 8, 2, 1, dark(pal.skin, .35)); // the mouth
    switch (look.face) {
      case 'freckles': px(c, x + 6, y + 7, 1, 1, pal.skinLo); px(c, x + 8, y + 7, 1, 1, pal.skinLo); px(c, x + 9, y + 6, 1, 1, pal.skinLo); break;
      case 'scar': for (let i = 0; i < 5; i++) px(c, x + 6 + i, y + 3 + i, 1, 1, mix(pal.skin, '#f2d6d6', .6)); break;
      case 'beard':
        px(c, x + 3, y + 7, 8, 3, pal.hair); px(c, x + 4, y + 10, 6, 2, pal.hair); px(c, x + 8, y + 8, 2, 1, dark(pal.skin, .35));
        px(c, x + 3, y + 5, 1, 3, pal.hair); break;
      case 'warpaint': px(c, x + 6, y + 7, 4, 1, pal.trim); px(c, x + 7, y + 3, 1, 1, pal.trim); break;
    }
    // Hair on top.
    if (head?.kind !== 'hood' && head?.kind !== 'helm') this.hair(c, x, y);
    else if (head?.kind === 'helm' && (look.hair === 'long' || look.hair === 'braid')) { /* the drape already shows below the helm */ }
    // Head gear over the hair; a town hat when there is none.
    if (head) this.headGear(c, x, y, head);
    else if (garb?.hat) this.hat(c, x, y, garb.hat, garb.hatColor ?? pal.trim);
  }

  private hat(c: Ctx, x: number, y: number, kind: 'brim' | 'cap', color: string): void {
    if (kind === 'brim') {
      px(c, x, y - 5, HEAD, 5, color); px(c, x + 1, y - 6, HEAD - 3, 1, color);
      px(c, x + 1, y - 5, HEAD - 4, 1, light(color, .25)); px(c, x, y - 2, HEAD, 1, this.pal.trim);
      px(c, x - 3, y - 1, HEAD + 6, 1, color); px(c, x - 3, y, HEAD + 6, 1, dark(color, .3));
    } else {
      px(c, x, y - 3, HEAD, 4, color); px(c, x + 1, y - 4, HEAD - 3, 1, color);
      px(c, x + 1, y - 3, HEAD - 5, 1, light(color, .25));
      px(c, x + HEAD - 2, y, 4, 1, dark(color, .25)); // the bill, forward
    }
  }

  private hair(c: Ctx, x: number, y: number): void {
    const pal = this.pal;
    const cap = () => {
      px(c, x, y - 1, HEAD, 3, pal.hair); px(c, x + 1, y - 2, HEAD - 3, 1, pal.hair);
      px(c, x, y + 2, 4, 5, pal.hair); px(c, x + 4, y + 2, 3, 1, pal.hair);
      px(c, x + 3, y - 2, 4, 1, pal.hairHi); px(c, x, y + 4, 1, 3, pal.hairLo);
    };
    switch (this.look.hair) {
      case 'cropped': cap(); break;
      case 'swept': cap(); px(c, x + 7, y + 1, 4, 2, pal.hair); px(c, x + 10, y + 3, 1, 1, pal.hair); px(c, x + 4, y - 3, 3, 1, pal.hair); px(c, x + 8, y + 1, 2, 1, pal.hairHi); break;
      case 'long': cap(); px(c, x + 7, y + 1, 3, 1, pal.hair); break;
      case 'braid': cap(); break;
      case 'topknot': cap(); px(c, x + 3, y - 5, 4, 3, pal.hair); px(c, x + 4, y - 5, 2, 1, pal.hairHi); px(c, x + 3, y - 2, 4, 1, pal.trim); break;
      case 'curls':
        px(c, x - 1, y - 2, HEAD + 1, 4, pal.hair); px(c, x - 1, y + 2, 5, 7, pal.hair);
        for (let i = 0; i < HEAD; i += 2) px(c, x - 1 + i, y - 3, 1, 1, pal.hair);
        for (let i = 3; i < 9; i += 2) px(c, x - 2, y + i, 1, 1, pal.hair);
        px(c, x + 2, y - 2, 2, 1, pal.hairHi); px(c, x + 6, y - 1, 2, 1, pal.hairHi); px(c, x + 7, y + 2, 3, 1, pal.hair);
        break;
      case 'mohawk':
        px(c, x, y, HEAD - 1, 2, mix(pal.skin, pal.hair, .3));
        px(c, x + 2, y - 3, 6, 3, pal.hair); px(c, x + 3, y - 5, 4, 2, pal.hair); px(c, x + 4, y - 5, 2, 1, pal.hairHi);
        break;
      case 'shaved': px(c, x + 1, y, HEAD - 2, 2, mix(pal.skin, pal.hair, .35)); break;
    }
  }

  private headGear(c: Ctx, x: number, y: number, head: GearPiece): void {
    const m = matOf(head);
    switch (head.kind) {
      case 'helm':
        px(c, x - 1, y - 1, HEAD + 2, 5, m.base); px(c, x, y - 2, HEAD, 1, m.base); px(c, x + 2, y - 3, HEAD - 4, 1, m.base);
        px(c, x + 2, y - 2, 5, 1, m.baseHi); px(c, x - 1, y + 3, HEAD + 2, 1, m.baseLo);
        px(c, x - 1, y + 4, 5, 5, m.base); px(c, x - 1, y + 4, 1, 5, m.baseLo); // cheek and neck guard
        px(c, x + 9, y + 4, 2, 2, m.base); // nose guard
        px(c, x + 5, y, 1, 1, m.trim); px(c, x + 2, y + 6, 1, 1, m.trim);
        if (m.bright || head.rarity === 'rare') {
          // A crest in the tier's colour, swept back.
          px(c, x + 2, y - 5, 5, 2, m.trim); px(c, x, y - 4, 3, 2, m.trim); px(c, x - 2, y - 3, 2, 2, dark(m.trim, .2));
        }
        break;
      case 'hood':
        px(c, x - 1, y - 2, HEAD + 1, 5, m.base); px(c, x - 1, y + 3, 6, 9, m.base); px(c, x - 2, y + 6, 2, 8, m.baseLo);
        px(c, x + 1, y - 3, HEAD - 4, 1, m.base); px(c, x + 2, y - 2, 4, 1, m.baseHi);
        px(c, x + 9, y - 1, 2, 4, m.trim); px(c, x - 1, y + 3, 1, 9, m.baseLo);
        break;
      case 'crown':
        px(c, x, y - 2, HEAD, 2, m.base === STYLE_COLORS.umbral[0] ? m.accent : mix('#e0bc52', m.base, .35));
        for (const k of [0, 5, 10]) px(c, x + k, y - 4, 1, 2, mix('#e0bc52', m.base, .35));
        px(c, x + 3, y - 3, 1, 1, mix('#e0bc52', m.base, .35)); px(c, x + 7, y - 3, 1, 1, mix('#e0bc52', m.base, .35));
        px(c, x + 5, y - 2, 1, 2, m.trim); px(c, x + 1, y - 2, HEAD - 2, 1, light(mix('#e0bc52', m.base, .35), .3));
        break;
      case 'circlet':
        px(c, x, y + 2, HEAD, 1, mix('#d8d0b8', m.base, .3)); px(c, x + 8, y + 1, 2, 2, m.trim); px(c, x + 8, y + 1, 1, 1, '#ffffff');
        break;
    }
  }
}

/** Shoulder-to-hand reach of the back arm (the front arm uses ARM_LENGTH from keeper-gear). */
const ARM = 8;
