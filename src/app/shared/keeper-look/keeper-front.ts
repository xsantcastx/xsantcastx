/**
 * keeper-front.ts — the chibi Keeper seen from the front and from behind, for
 * the top-down view (docs/design/top-down.md §2: four facings). The side views
 * stay KeeperPainter's; these two are painted in the same colours (its
 * `colors`), and baked once into one small sheet per Keeper: 2 facings × 8
 * frames. Never a canvas per frame (play-memory).
 *
 * The art pass (owner 2026-10-20, docs/design/ui-pass-top-heroes.md "Characters"): a 28×40 cell at the tiles' own
 * pixel density (TILE 16: the Keeper stands about 2¼ tiles), a big head (about 40% of the figure), every surface
 * two-toned with the light from the top-left, a highlight where it reads, one bright accent, the 1px dark outline,
 * and a four-frame walk (contact, passing, contact, passing).
 */
import { OUTLINE, mix, type KeeperPainter, type Palette } from './keeper-paint';
import { RARITY_TRIM, STYLE_COLORS, type GearPiece, type KeeperGear } from './keeper-gear';
import type { BodyType, EyeStyle, FaceMark, Form, HairStyle } from './keeper-look.model';
import type { KeeperGarb } from './npc-looks';
import { WARLOCK_GARB } from './vocation-look';
import type { WornLook } from './worn-look.model';
import { eyeFlicker, eyeGlow, wornParticles } from './worn-fx';
import { volumize } from './keeper-volume';

export type Facing = 'down' | 'up';
export const FRONT_W = 28;
export const FRONT_H = 40;
/** Feet: the sprite's anchor (art px from its top-left). */
export const FRONT_AX = 14;
export const FRONT_AY = 38;
/** The frame where the Keeper looks at the Slate in their hands (facing down only). */
export const PHONE_FRAME = 6;
/** The frame where the Keeper casts: staff raised high, its orb flaring (facing down). */
export const CAST_FRAME = 7;
/** 0 idle, 1 breath, 2–5 the walk (contact, passing, contact, passing), 6 the Slate, 7 the cast. */
const FRAMES = 8;

/** Centre (columns 13 | 14); the head's left column and top row; the torso's, the legs', the boots' first rows; the soles. */
const C = 14, HX = 5, HT = 4, TT = 19, LT = 28, BT = 34, FEET = 37;
/** The head's rounded rows: how far each row starts in from the 18-px-wide head. */
const HEAD_IN = [4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4];
const BOOT = '#4a3328', BOOT_LO = '#2e1f1a', BOOT_HI = '#71523f';
const WOOD = '#8a5a34', WOOD_LO = '#5a3820', WOOD_HI = '#b07a48';
const WOOD_BASE = WOOD, WOOD_LIT = WOOD_HI, WOOD_SHADE = WOOD_LO;
const STEEL = '#c3cad6', STEEL_LO = '#7d8796', STEEL_HI = '#f2f5fa';
const BONE = '#e9e4d8', BONE_LO = '#b3aa98';

const sheets = new WeakMap<KeeperPainter, HTMLCanvasElement>();
const staffSheets = new WeakMap<KeeperPainter, HTMLCanvasElement>();

type Px = (x: number, y: number, w: number, h: number, col: string) => void;

/** What a figure is, besides its colours: the body, the hair, the face, the eyes, the garb's extras. */
interface Figure { body: BodyType; form: Form; hair: HairStyle; face: FaceMark; eyes: EyeStyle; garb: KeeperGarb | null }

/** One frame's pose: the upper body's bob, each foot's lift, each arm's swing, the robe hem's sway. */
interface Pose { u: number; lLift: number; rLift: number; lArm: number; rArm: number; sway: number }
function poseOf(frame: number): Pose {
  switch (frame) {
    case 1: return { u: 1, lLift: 0, rLift: 0, lArm: 0, rArm: 0, sway: 0 };
    case 2: return { u: 0, lLift: 0, rLift: 1, lArm: -1, rArm: 1, sway: -1 };
    case 3: return { u: -1, lLift: 0, rLift: 3, lArm: 0, rArm: 0, sway: 0 };
    case 4: return { u: 0, lLift: 1, rLift: 0, lArm: 1, rArm: -1, sway: 1 };
    case 5: return { u: -1, lLift: 3, rLift: 0, lArm: 0, rArm: 0, sway: 0 };
    default: return { u: 0, lLift: 0, rLift: 0, lArm: 0, rArm: 0, sway: 0 };
  }
}

const lo = (col: string, t = .35) => mix(col, OUTLINE, t);
const hi = (col: string, t = .3) => mix(col, '#ffffff', t);

function paint(c: CanvasRenderingContext2D, p: Readonly<Palette>, fig: Figure, facing: Facing, frame: number, ox: number, staff: boolean, gear: KeeperGear | null): void {
  const P: Px = (x, y, w, h, col) => { if (w > 0 && h > 0) { c.fillStyle = col; c.fillRect(ox + x, y, w, h); } };
  /** The same, mirrored left-for-right (what the right hand holds from the front is on the left seen from behind). */
  const M: Px = (x, y, w, h, col) => P(FRONT_W - x - w, y, w, h, col);
  const front = facing === 'down';
  const phone = frame === PHONE_FRAME && front;
  const cast = frame === CAST_FRAME;
  const pose = poseOf(frame);
  const ht = HT + pose.u, tt = TT + pose.u;
  // A feminine figure (owner 2026-10-21): a pixel narrower at the shoulders, the hips flaring out under the belt.
  const fem = fig.form === 'fem';
  const bw = (fig.body === 'slight' ? 5 : fig.body === 'broad' ? 7 : 6) - (fem ? 1 : 0);
  const head = gear?.head;
  const sash = fig.garb?.sash ?? WARLOCK_GARB.sash ?? p.trim;
  const hooded = head?.kind === 'hood' || (staff && !head);
  // The hood's cloth: the Warlock's a shade off the robe (so the head reads against it), anyone else's its own piece.
  const hoodCloth: Cloth = staff ? { base: mix(p.tunic, sash, .2), hi: mix(p.tunicHi, sash, .38), lo: p.tunicLo, trim: p.trim }
    : head?.kind === 'hood' ? (({ base, hi, lo, trim }) => ({ base, hi, lo, trim }))(matOf(head)) : { base: p.tunic, hi: p.tunicHi, lo: p.tunicLo, trim: p.trim };
  const chest = gear?.chest;
  const robed = staff || chest?.kind === 'robe' || chest?.kind === 'mantle';
  const weapon = gear?.weapon;
  const held = weapon && weapon.kind !== 'staff' && weapon.kind !== 'wand' ? weapon : null;
  const holding = !phone && (!!held || staff || weapon?.kind === 'staff' || weapon?.kind === 'wand');
  const raise = cast && holding;

  // ── Legs and boots (stepping lifts a foot; under a robe only the toes peek out) ──
  if (!robed) legs(P, p, pose, front);
  else toes(P, pose);

  // ── The body ──
  if (staff) robe(P, { base: p.tunic, hi: p.tunicHi, lo: p.tunicLo, trim: p.trim }, tt, bw, pose.sway, front, sash, true, fem);
  else tunic(P, p, fig, tt, bw, front);
  if (!staff || (chest && chest.kind !== 'robe' && chest.kind !== 'mantle')) paintChest(P, gear, front, tt, bw, pose.sway, fem);
  // The quiver's tube on the back, seen from behind (over the coat, under the arms).
  if (fig.garb?.quiver && !front) quiver(P, fig.garb.quiver, tt, false);

  // ── Arms ──
  arms(P, p, tt, bw, pose, front, phone, raise, staff, holding);

  // ── The head ──
  headSkin(P, p, ht, fem);
  const cowl = head?.look?.shape === 'cowl' ? head.look : null;
  if (hooded) {
    hood(P, p, hoodCloth, ht, tt, front, staff ? sash : hoodCloth.trim);
    if (cowl) cowlFace(P, hoodCloth, cowl, ht, tt, front);
    else if (front) { if (staff) undeadFace(P, p, ht, frame, cast, fem); else face(P, p, fig, ht, frame, phone, true); }
  }
  else {
    if (front) {
      if (staff) undeadFace(P, p, ht, frame, cast, fem);
      else face(P, p, fig, ht, frame, phone, false);
    }
    hair(P, p, fig, ht, front);
    if (front && fig.face === 'beard') beard(P, p, ht);
    if (!head && fig.garb?.hat) hat(P, fig.garb.hat, fig.garb.hatColor ?? p.trim, ht, front);
  }
  if (hooded && staff) mantle(P, hoodCloth, tt, bw, front);
  // Her hair escapes the hood: two locks framing the face, falling over the mantle onto the chest.
  if (hooded && fem && front && !cowl) locks(P, p, ht, 'hood');
  paintGear(P, M, gear, front, ht, tt, bw, pose, phone, p, frame);
  // Under a helm her hair falls out below the cheek guards (in front) and as a tail under the neck guard (behind).
  if (fem && !hooded && (head?.kind === 'helm')) locks(P, p, ht, front ? 'helm' : 'helm-back');
  // Its arrows' fletchings: over the shoulder from behind, peeking past the hood's edge from the front.
  if (fig.garb?.quiver) quiver(P, fig.garb.quiver, tt, true, front);

  // ── What is held ──
  if (phone) { slate(P, p, tt); return; }
  if (!holding) return;
  const H = front ? P : M;
  const handY = raise ? tt - 5 : tt + 8 + (staff ? 1 : 0) + (front ? pose.rArm : pose.lArm);
  if (held) paintHeld(H, held, handY);
  else if (weapon?.variant === 'lamp') paintLampStaff(H, cast, handY, front);
  else paintStaff(H, cast, handY, weapon?.kind === 'wand' ? weapon : null, weapon?.look ?? null);
  // The hand closed round the grip, over the shaft.
  const g = gear?.hands ? matOf(gear.hands) : null;
  H(22, handY, 3, 2, g ? g.base : front ? p.skin : p.skinLo);
  H(22, handY + 1, 3, 1, g ? g.lo : p.skinLo);
  if (!g && front) H(22, handY, 1, 1, p.skinHi);
}

// ───────────────────────── body parts ─────────────────────────

function legs(P: Px, p: Readonly<Palette>, pose: Pose, front: boolean): void {
  for (const [x, lift, lit] of [[C - 4, pose.lLift, true], [C + 1, pose.rLift, false]] as const) {
    const h = BT - LT - lift;
    P(x, LT, 3, h, p.trousers);
    P(x + 2, LT, 1, h, p.trousersLo);
    if (lit) P(x, LT, 1, h, hi(p.trousers, .12));
    else P(x + 1, LT, 1, h, mix(p.trousers, p.trousersLo, .5));
    // The boot: a lit cuff, the body, a dark sole; the toe turns out.
    const by = BT - lift, bx = lit ? x - 1 : x;
    P(bx, by, 4, 4, BOOT);
    P(bx, by, 4, 1, BOOT_HI);
    P(bx + 3, by + 1, 1, 2, BOOT_LO);
    P(bx, by + 3, 4, 1, BOOT_LO);
    if (front) P(bx + 1, by + 1, 1, 1, hi(BOOT_HI, .2));
    else P(bx, by + 2, 4, 1, BOOT_LO);
  }
}

/** Under a robe: the toes of the feet that are down peek from the hem. */
function toes(P: Px, pose: Pose): void {
  for (const [x, lift] of [[C - 5, pose.lLift], [C + 1, pose.rLift]] as const) {
    if (lift >= 2) continue;
    P(x, FEET - 1 + lift, 4, 2 - lift, '#2a1e26');
    P(x, FEET - 1 + lift, 2, 1, '#4a3a44');
  }
}

function tunic(P: Px, p: Readonly<Palette>, fig: Figure, tt: number, bw: number, front: boolean): void {
  const l = C - bw, w = bw * 2;
  // Shoulders rounded, the chest, the belt, the skirt flaring a pixel each side (two on a feminine figure: the hips).
  const fl = fig.form === 'fem' ? 2 : 1;
  P(l + 1, tt, w - 2, 1, p.tunic);
  P(l, tt + 1, w, 6, p.tunic);
  P(l - fl, tt + 7, w + fl * 2, 4, p.tunic);
  if (fl === 2) { P(l - 2, tt + 7, 1, 4, p.tunicHi); P(l + w + 1, tt + 7, 1, 4, p.tunicLo); P(l - 2, tt + 10, w + 4, 1, p.tunicLo); }
  if (fl === 2 && front) { P(C - 4, tt + 4, 3, 1, p.tunicLo); P(C + 1, tt + 4, 3, 1, p.tunicLo); }
  // Light from the top-left: the shoulders and the left edge lit, the right in shade.
  P(l + 1, tt, w - 4, 1, p.tunicHi); P(l, tt + 1, 1, 5, p.tunicHi); P(l - 1, tt + 7, 1, 2, p.tunicHi);
  P(l + w - 2, tt + 1, 2, 6, p.tunicLo); P(l + w - 1, tt + 7, 2, 4, p.tunicLo);
  // Folds below the belt, the hem in shade.
  P(C - 3, tt + 8, 1, 3, p.tunicLo); P(C + 2, tt + 8, 1, 3, p.tunicLo); P(C - 2, tt + 8, 1, 2, p.tunicHi);
  P(l - 1, tt + 10, w + 2, 1, p.tunicLo);
  // The belt and its buckle.
  P(l, tt + 6, w, 1, lo(p.trim, .45));
  if (front) {
    P(C - 1, tt + 6, 2, 1, p.trim); P(C - 1, tt + 6, 1, 1, hi(p.trim, .4));
    // A V collar trimmed in the accent, the neck in shadow, a placket of buttons.
    P(C - 2, tt, 4, 1, p.skinLo); P(C - 1, tt + 1, 2, 1, p.skinLo);
    P(C - 3, tt, 1, 1, p.trim); P(C + 2, tt, 1, 1, p.trim);
    P(C - 2, tt + 1, 1, 1, p.trim); P(C + 1, tt + 1, 1, 1, p.trim);
    P(C - 1, tt + 2, 2, 1, p.trim);
    P(C - 1, tt + 3, 1, 1, lo(p.trim, .2)); P(C - 1, tt + 5, 1, 1, lo(p.trim, .2));
  } else {
    // The back: the collar, a seam down the spine.
    P(C - 3, tt, 6, 1, lo(p.tunic, .25)); P(C, tt + 1, 1, 5, p.tunicLo);
  }
  const g = fig.garb;
  if (g?.apron) {
    const a = g.apron;
    if (front) {
      P(C - 4, tt + 2, 8, 9, a); P(C + 2, tt + 2, 2, 9, lo(a, .3)); P(C - 4, tt + 2, 8, 1, hi(a, .2));
      P(C - 4, tt, 1, 2, lo(a, .2)); P(C + 3, tt, 1, 2, lo(a, .3)); P(C - 2, tt + 6, 3, 1, lo(a, .4));
    } else P(C - bw, tt + 6, w, 1, lo(a, .3));
  }
  if (g?.sash && front) {
    // A sash from the left shoulder to the right hip.
    for (let i = 0; i < 7; i++) { const sx = l + 1 + Math.floor(i * (w - 3) / 7); P(sx, tt + i, 2, 1, g.sash); P(sx + 1, tt + i + 1, 1, 1, lo(g.sash, .3)); }
  }
  if (g?.sack && !front) { P(C + 1, tt - 1, 5, 7, g.sack); P(C + 4, tt, 2, 6, lo(g.sack, .3)); P(C + 1, tt - 1, 3, 1, hi(g.sack, .2)); }
}

interface Cloth { base: string; hi: string; lo: string; trim: string }

/** A robe to the ankles: flaring below the belt, folds, a trimmed hem that sways with the step. */
function robe(P: Px, m: Cloth, tt: number, bw: number, sway: number, front: boolean, sash: string, bone: boolean, fem = false): void {
  const end = FEET - 1;
  const sw = (y: number) => y >= end - 4 ? sway : 0;
  for (let y = tt; y < end; y++) {
    const k = y - tt;
    // A feminine figure: the waist drawn in at the sash, the hips a pixel wider below it.
    const half = k === 0 ? bw - 1 : k < 7 ? bw : bw + Math.min(2, ((k - 7) >> 1) + 1) + (fem && k < 13 ? 1 : 0);
    const s = sw(y);
    P(C - half + s, y, half * 2, 1, m.base);
    P(C - half + s, y, 1, 1, k < 7 ? m.hi : mix(m.base, m.hi, .6));
    P(C + half - 2 + s, y, 2, 1, m.lo);
  }
  P(C - bw + 1, tt, bw * 2 - 4, 1, m.hi);
  // Folds: a lit ridge, two shadowed valleys, deepening toward the hem.
  for (let y = tt + 8; y < end - 2; y++) {
    const s = sw(y);
    P(C - 5 + s, y, 1, 1, m.hi);
    P(C - 3 + s, y, 1, 1, m.lo);
    P(C + 3 + s, y, 1, 1, m.lo);
    if (y > tt + 12) P(C + 4 + s, y, 1, 1, lo(m.lo, .2));
  }
  // The hem: two rows of trim (bone on the Warlock).
  const hh = bw + 2;
  P(C - hh + sway, end - 2, hh * 2, 1, m.trim);
  P(C - hh + sway, end - 1, hh * 2, 1, lo(m.trim, .3));
  P(C + hh - 3 + sway, end - 2, 3, 1, lo(m.trim, .2));
  if (front) {
    // The front strip down the middle, clasped in bone.
    for (let y = tt + 2; y < end - 2; y++) { const s = sw(y); P(C - 1 + s, y, 1, 1, m.trim); P(C + s, y, 1, 1, lo(m.trim, .3)); }
    if (bone) for (const y of [tt + 3, tt + 10, tt + 13]) { P(C - 2, y, 4, 1, BONE); P(C + 1, y, 1, 1, BONE_LO); }
  } else P(C, tt + 1, 1, end - tt - 3, m.lo);
  if (fem && front) { P(C - 4, tt + 4, 3, 1, m.lo); P(C + 1, tt + 4, 3, 1, m.lo); }
  // The sash at the waist, its knotted ends hanging at the left hip.
  P(C - bw, tt + 6, bw * 2, 2, sash); P(C - bw, tt + 7, bw * 2, 1, lo(sash, .3)); P(C - bw, tt + 6, bw * 2 - 3, 1, hi(sash, .2));
  if (front) { P(C - 4, tt + 8, 2, 4, sash); P(C - 3, tt + 8, 1, 4, lo(sash, .3)); P(C - 4, tt + 12, 2, 1, lo(sash, .45)); }
}

function arms(P: Px, p: Readonly<Palette>, tt: number, bw: number, pose: Pose, front: boolean, phone: boolean, raise: boolean, staff: boolean, holding: boolean): void {
  const lx = C - bw - 3, rx = C + bw;
  const sleeve = p.tunic, sleeveLo = p.tunicLo, sleeveHi = p.tunicHi;
  if (phone) {
    // Both forearms bent up to the chest, the Slate between the hands.
    P(lx + 1, tt + 1, 3, 5, sleeve); P(lx + 1, tt + 1, 1, 5, sleeveHi); P(lx + 2, tt + 5, 4, 2, sleeve);
    P(rx, tt + 1, 3, 5, sleeveLo); P(rx - 2, tt + 5, 4, 2, sleeveLo);
    return;
  }
  const bell = staff ? 1 : 0;
  // The left arm (lit): a sleeve, its cuff, the hand (none when it holds the grip, seen from behind).
  const la = pose.lArm;
  P(lx + 1, tt + 1 + la, 2, 1, sleeve);
  P(lx, tt + 2 + la, 3, 6, sleeve);
  P(lx, tt + 2 + la, 1, 5, sleeveHi); P(lx + 2, tt + 3 + la, 1, 4, mix(sleeve, sleeveLo, .5));
  if (bell) { P(lx - 1, tt + 6 + la, 4, 2, sleeve); P(lx - 1, tt + 6 + la, 1, 2, sleeveHi); P(lx - 1, tt + 8 + la, 4, 1, p.trim); }
  else P(lx, tt + 7 + la, 3, 1, lo(sleeve, .2));
  if (front || !holding) { P(lx, tt + 8 + la + bell, 3, 2, p.skin); P(lx, tt + 9 + la + bell, 3, 1, p.skinLo); P(lx, tt + 8 + la + bell, 1, 1, p.skinHi); }
  // The right arm (in shade). Raised to cast, it reaches up the shaft.
  if (raise && front) {
    P(rx + 1, tt - 4, 2, 1, sleeveLo); P(rx, tt - 3, 3, 6, sleeveLo); P(rx + 2, tt - 3, 1, 6, lo(sleeveLo, .25));
    return;
  }
  const ra = pose.rArm;
  P(rx, tt + 1 + ra, 2, 1, sleeveLo);
  P(rx, tt + 2 + ra, 3, 6, sleeveLo);
  P(rx + 2, tt + 2 + ra, 1, 6, lo(sleeveLo, .25));
  if (bell) { P(rx, tt + 6 + ra, 4, 2, sleeveLo); P(rx + 3, tt + 6 + ra, 1, 2, lo(sleeveLo, .25)); P(rx, tt + 8 + ra, 4, 1, lo(p.trim, .25)); }
  else P(rx, tt + 7 + ra, 3, 1, lo(sleeveLo, .2));
  if (!front || !holding) { P(rx, tt + 8 + ra + bell, 3, 2, p.skinLo); P(rx, tt + 8 + ra + bell, 2, 1, p.skin); }
}

/** A feminine head: the same round, a softer, narrower chin. */
const HEAD_IN_FEM = [4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5];

function headSkin(P: Px, p: Readonly<Palette>, ht: number, fem = false): void {
  (fem ? HEAD_IN_FEM : HEAD_IN).forEach((n, r) => {
    P(HX + n, ht + r, 18 - n * 2, 1, p.skin);
    // Round: the right edge in shade, the jaw underneath.
    if (r >= 2) P(HX + 18 - n - 2, ht + r, 2, 1, p.skinLo);
  });
  if (fem) { P(HX + 4, ht + 13, 11, 1, p.skinLo); P(HX + 6, ht + 14, 7, 1, p.skinLo); }
  else { P(HX + 4, ht + 13, 12, 1, p.skinLo); P(HX + 6, ht + 14, 9, 1, p.skinLo); }
  P(HX + 2, ht + 9, 1, 2, p.skinHi);
}

/** A lash flicked out at each eye's outer corner, at row `y` (the feminine face). */
function lashes(P: Px, ht: number, y: number, col: string): void {
  P(HX + 3, ht + y, 1, 1, col); P(HX + 2, ht + y - 1, 1, 1, col);
  P(HX + 14, ht + y, 1, 1, col); P(HX + 15, ht + y - 1, 1, 1, col);
}

/**
 * Her hair where headgear covers the rest: `hood`, two locks framing the face inside the opening; `helm`, locks falling
 * from under the cheek guards to the shoulders; `helm-back`, a tail below the neck guard.
 */
function locks(P: Px, p: Readonly<Palette>, ht: number, where: 'hood' | 'helm' | 'helm-back'): void {
  const at = (x: number, y: number, w: number, col = p.hair) => P(HX + x, ht + y, w, 1, col);
  if (where === 'hood') {
    // Inside the opening down the cheeks, then out over the hood's fall onto the chest, a pixel wider.
    for (let y = 8; y <= 14; y++) { at(3, y, 2); at(13, y, 2); at(3, y, 1, p.hairHi); at(14, y, 1, p.hairLo); }
    for (let y = 15; y <= 19; y++) { const k = y > 17 ? 1 : 0; at(2 + k, y, 3 - k); at(13, y, 3 - k); at(2 + k, y, 1, p.hairHi); at(15 - k, y, 1, p.hairLo); }
    at(4, 7, 3); at(11, 7, 3); at(5, 7, 1, p.hairHi);
  } else if (where === 'helm') {
    for (let y = 12; y <= 17; y++) { at(-1, y, 3); at(16, y, 3); at(-1, y, 1, p.hairHi); at(18, y, 1, p.hairLo); }
    at(0, 18, 2, p.hairLo); at(16, 18, 2, p.hairLo);
  } else {
    for (let y = 13; y <= 20; y++) { at(7, y, 4); at(7, y, 1, p.hairHi); at(10, y, 1, p.hairLo); }
    at(7, 13, 4, p.trim); at(8, 21, 2, p.hairLo);
  }
}

function face(P: Px, p: Readonly<Palette>, fig: Figure, ht: number, frame: number, phone: boolean, hooded: boolean): void {
  const eye = fig.garb?.eyeGlow ?? p.eye;
  // The fringe's shadow on the brow (under a hood, the hood's own).
  if (!hooded) P(HX + 2, ht + 7, 14, 1, p.skinLo);
  if (frame === 1) {
    // A blink.
    P(HX + 4, ht + 10, 3, 1, p.eyeDk); P(HX + 11, ht + 10, 3, 1, p.eyeDk);
  } else if (phone) {
    // Eyes down at the screen, its cool light on the cheeks.
    P(HX + 4, ht + 10, 3, 2, p.eyeDk); P(HX + 11, ht + 10, 3, 2, p.eyeDk);
    P(HX + 5, ht + 11, 2, 1, eye); P(HX + 12, ht + 11, 2, 1, eye);
    P(HX + 2, ht + 12, 14, 1, 'rgba(159,232,255,.45)');
  } else if (fig.eyes === 'narrow') {
    P(HX + 4, ht + 9, 3, 2, p.eyeDk); P(HX + 11, ht + 9, 3, 2, p.eyeDk);
    P(HX + 5, ht + 10, 2, 1, eye); P(HX + 12, ht + 10, 2, 1, eye);
    P(HX + 4, ht + 8, 3, 1, lo(p.hair, .2)); P(HX + 11, ht + 8, 3, 1, lo(p.hair, .2));
  } else {
    // Big chibi eyes: a dark rim, the iris, a white catch-light, a lit lower edge.
    for (const ex of [HX + 4, HX + 11]) {
      P(ex, ht + 8, 3, 4, p.eyeDk);
      P(ex + 1, ht + 9, 2, 3, eye);
      P(ex + 1, ht + 11, 2, 1, p.eyeHi);
      P(ex + 1, ht + 9, 1, 1, '#ffffff');
      if (fig.eyes === 'bright') P(ex + 2, ht + 10, 1, 1, '#ffffff');
    }
  }
  const fem = fig.form === 'fem';
  if (fem && !phone) lashes(P, ht, frame === 1 ? 10 : fig.eyes === 'narrow' ? 9 : 8, p.eyeDk);
  const blushW = fig.face === 'rosy' || fem ? 3 : 2, bx = hooded ? 3 : 2;
  P(HX + bx, ht + 12, blushW, 1, p.blush); P(HX + 18 - bx - blushW, ht + 12, blushW, 1, p.blush);
  // Her mouth a small rosy bow; his a plain line.
  if (fem) { P(HX + 8, ht + 12, 2, 1, mix(p.mouth, '#e0607a', .55)); P(HX + 8, ht + 13, 2, 1, mix(p.skinLo, '#e0607a', .25)); }
  else P(HX + 8, ht + 12, 2, 1, p.mouth);
  if (fig.face === 'freckles') for (const [x, y] of [[3, 11], [5, 12], [12, 12], [14, 11]]) P(HX + x, ht + y, 1, 1, p.skinLo);
  if (fig.face === 'scar') { P(HX + 13, ht + 7, 1, 1, '#b85a5a'); P(HX + 12, ht + 8, 1, 1, '#b85a5a'); P(HX + 14, ht + 12, 1, 1, '#b85a5a'); }
  if (fig.face === 'warpaint') { P(HX + 3, ht + 12, 4, 1, p.trim); P(HX + 11, ht + 12, 4, 1, p.trim); }
}

/** The undead face (owner 2026-10-20: "Warlocks should have an undead look"): grey-green, hollow-cheeked, eyes burning violet. */
function undeadFace(P: Px, p: Readonly<Palette>, ht: number, frame: number, cast: boolean, fem = false): void {
  const glow = WARLOCK_GARB.eyeGlow ?? '#b06bff', socket = '#1e1424';
  const top = ht + 8;
  for (const ex of [HX + 4, HX + 11]) {
    P(ex, top, 3, 3, socket);
    if (frame === 1) P(ex, top + 2, 3, 1, glow);
    else { P(ex + (ex < C ? 1 : 0), top + 1, 2, 2, cast ? '#e2c6ff' : glow); P(ex + 1, top + 1, 1, 1, '#f6ecff'); }
    // The glow spills onto the cheekbone.
    P(ex, top + 3, 3, 1, mix(p.skin, glow, .35));
  }
  // Sunken cheeks under a lit cheekbone, a thin stitched mouth.
  P(HX + 3, ht + 12, 2, 2, p.skinLo); P(HX + 13, ht + 12, 2, 2, lo(p.skinLo, .15));
  P(HX + 3, ht + 11, 1, 1, p.skinHi);
  P(HX + 6, ht + 13, 6, 1, '#3a2630');
  for (const x of [6, 8, 10]) P(HX + x, ht + 12, 1, 1, lo(p.skin, .3));
  P(HX + 8, ht + 11, 2, 1, p.skinLo);
  if (fem) lashes(P, ht, frame === 1 ? 10 : 8, socket);
}

/** The Warlock's deep hood: a point, a lit rim, the opening in shadow round the face. */
function hood(P: Px, p: Readonly<Palette>, m: Cloth, ht: number, tt: number, front: boolean, accent: string): void {
  const h = m.base, hLo = m.lo, hHi = m.hi, inner = mix(hLo, OUTLINE, .55), rim = mix(hHi, accent, .5);
  // Silhouette: the point, the crown, the sides falling to the shoulders.
  ([[7, 4], [4, 10], [2, 14], [1, 16]] as const).forEach(([x, w], i) => P(HX + x, ht - 2 + i, w, 1, h));
  P(HX - 1, ht + 2, 20, tt - ht - 1, h);
  P(HX, tt - 1, 18, 2, h);
  // Light: the crown's top-left, a rim down the left edge; the right in shade.
  P(HX + 5, ht - 1, 4, 1, hHi); P(HX + 3, ht, 5, 1, hHi); P(HX + 2, ht + 1, 3, 1, hHi);
  P(HX - 1, ht + 3, 1, tt - ht - 4, rim); P(HX, ht + 2, 1, 2, rim);
  P(HX + 15, ht + 1, 2, 1, hLo); P(HX + 16, ht + 2, 3, tt - ht - 1, hLo); P(HX + 18, ht + 3, 1, tt - ht - 3, lo(hLo, .3));
  if (front) {
    // The opening: rows of shadow round the face, its lip lit along the top.
    ([[5, 8], [3, 12], [2, 14], [2, 14], [2, 14], [2, 14], [2, 14], [2, 14], [3, 12], [4, 10]] as const)
      .forEach(([x, w], i) => P(HX + x, ht + 5 + i, w, 1, inner));
    P(HX + 5, ht + 4, 8, 1, rim);
    P(HX + 8, ht, 1, 4, hLo);
    // The face inside, under the hood's shade.
    ([[4, 10], [3, 12], [3, 12], [3, 12], [3, 12], [3, 12], [4, 10], [5, 8]] as const)
      .forEach(([x, w], i) => P(HX + x, ht + 7 + i, w, 1, i < 1 ? p.skinLo : p.skin));
    P(HX + 13, ht + 8, 2, 6, p.skinLo);
    P(HX + 3, ht + 8, 1, 5, mix(p.skin, inner, .35));
  } else {
    // From behind: the cloth's lit left panel and folds, a seam to the point, and the point's tail down the back.
    P(HX, ht + 2, 2, tt - ht - 3, hHi); P(HX + 2, ht + 1, 2, 3, hHi); P(HX + 2, ht + 4, 1, tt - ht - 6, mix(h, hHi, .5));
    P(HX + 5, ht + 3, 1, tt - ht - 4, hLo); P(HX + 12, ht + 3, 1, tt - ht - 4, hLo); P(HX + 13, ht + 4, 1, tt - ht - 5, mix(h, hHi, .35));
    P(HX + 8, ht - 1, 1, tt - ht, hLo); P(HX + 7, ht - 1, 1, tt - ht - 2, mix(h, hHi, .5));
    P(HX + 7, tt, 4, 3, h); P(HX + 8, tt + 3, 2, 2, h); P(HX + 10, tt, 1, 3, hLo); P(HX + 9, tt + 3, 1, 2, hLo);
  }
}

/**
 * A cowl (worn-look `cowl`): its brim droops over the brow and the face inside is lost in shadow, two eye-pips burning
 * in it (their glow flickers live: drawWornFront). From behind, stitches down the centre seam.
 */
function cowlFace(P: Px, m: Cloth, L: WornLook, ht: number, tt: number, front: boolean): void {
  const shade = mix(m.lo, OUTLINE, .6), deeper = mix(m.lo, OUTLINE, .8);
  if (front) {
    // The whole opening below the brim (hood()'s own rows), so not a pixel of cheek or chin shows.
    ([[2, 14], [2, 14], [2, 14], [2, 14], [2, 14], [2, 14], [3, 12], [4, 10]] as const)
      .forEach(([x, w], i) => P(HX + x, ht + 7 + i, w, 1, i < 2 ? deeper : shade));
    // The brim: two rows of cloth over the opening's top, lit along its lip.
    P(HX + 3, ht + 5, 12, 1, m.base); P(HX + 4, ht + 6, 10, 1, m.lo); P(HX + 5, ht + 4, 8, 1, mix(m.hi, m.trim, .5));
    if (L.eyes) {
      for (const ex of [HX + 5, HX + 11]) { P(ex, ht + 10, 2, 1, L.eyes); P(ex + (ex < C ? 1 : 0), ht + 10, 1, 1, hi(L.eyes, .45)); }
    }
    if (L.seam) for (let y = ht + 4; y < tt; y += 3) P(HX - 1, y, 1, 1, L.seam);
  } else if (L.seam) for (let y = ht; y < tt; y += 2) P(HX + 8, y, 1, 1, L.seam);
}

/** The hood's mantle over the shoulders, bone-clasped at the throat. */
function mantle(P: Px, m: Cloth, tt: number, bw: number, front: boolean): void {
  const h = m.base, hHi = m.hi, hLo = m.lo;
  P(C - bw - 1, tt, bw * 2 + 2, 3, h);
  P(C - bw - 1, tt, 1, 3, hHi); P(C - bw, tt, bw, 1, hHi);
  P(C + bw - 1, tt, 2, 3, hLo); P(C - bw - 1, tt + 3, bw * 2 + 2, 1, lo(h, .35));
  if (front) {
    // A small skull clasp.
    P(C - 2, tt, 4, 1, BONE); P(C - 3, tt + 1, 6, 1, BONE); P(C - 2, tt + 2, 4, 1, BONE_LO);
    P(C - 2, tt + 1, 1, 1, OUTLINE); P(C + 1, tt + 1, 1, 1, OUTLINE); P(C - 1, tt + 2, 1, 1, OUTLINE);
    P(C + 1, tt, 1, 1, BONE_LO);
  } else P(C - 1, tt, 2, 3, lo(h, .2));
}

function hair(P: Px, p: Readonly<Palette>, fig: Figure, ht: number, front: boolean): void {
  const H = p.hair, Hl = p.hairLo, Hh = p.hairHi;
  const style = fig.hair;
  const at = (x: number, y: number, w: number, col = H) => P(HX + x, ht + y, w, 1, col);
  if (style === 'shaved' || style === 'mohawk') {
    const stub = mix(H, p.skin, .55);
    HEAD_IN.slice(0, 6).forEach((n, r) => at(n, r, 18 - n * 2, stub));
    if (!front) HEAD_IN.slice(6, 13).forEach((n, r) => at(n, r + 6, 18 - n * 2, stub));
    at(13, 2, 4, lo(stub, .2));
    if (front) { at(-1, 8, 1, p.skin); at(-1, 9, 1, p.skinLo); at(18, 8, 1, p.skinLo); at(18, 9, 1, p.skinLo); }
    if (style === 'mohawk') {
      const end = front ? 5 : 13;
      for (let y = -2; y <= end; y++) { at(7, y, 4); at(7, y, 1, Hh); at(10, y, 1, Hl); }
      at(8, -2, 2, Hh);
    }
    return;
  }
  // The cap: a tuft, the dome, wider than the head (volume).
  ([[5, 8], [3, 12], [1, 16], [0, 18], [-1, 20], [-1, 20], [-1, 20]] as const).forEach(([x, w], i) => at(x, i - 1, w));
  if (style === 'curls') for (const [x, y] of [[3, -1], [14, -1], [-1, 1], [18, 1], [-2, 4], [19, 4]]) at(x, y, 2);
  if (style === 'topknot') { at(6, -2, 6); at(6, -2, 2, Hh); at(10, -2, 2, Hl); at(7, -1, 4, p.trim); }
  // A bun on the crown, tied with the trim colour.
  if (style === 'bun') { at(6, -5, 6); at(5, -4, 8); at(5, -3, 8); at(6, -2, 6, p.trim); at(6, -5, 3, Hh); at(5, -4, 2, Hh); at(10, -4, 3, Hl); at(11, -3, 2, Hl); }
  // Pigtails: a tail tied at each side of the head, falling to the shoulders (seen from both sides).
  if (style === 'pigtails') {
    for (let y = 9; y <= 18; y++) { const k = y > 15 ? 1 : 0; at(-3 + k, y, 3 - k); at(18, y, 3 - k); at(-3 + k, y, 1, Hh); at(20 - k, y, 1, Hl); }
    at(-3, 8, 3, p.trim); at(18, 8, 3, p.trim);
  }
  if (front) {
    // The fringe: locks over the brow.
    if (style === 'swept') {
      at(-1, 6, 11); at(13, 6, 6); at(-1, 7, 7); at(16, 7, 3); at(-1, 8, 3);
      at(5, 7, 2, Hl); at(9, 6, 1, Hl);
    } else if (style === 'bob') {
      // A straight-cut fringe right across the brow.
      at(-1, 6, 20); at(-1, 7, 5); at(5, 7, 8); at(14, 7, 5); at(4, 7, 1, Hl); at(9, 7, 1, Hl); at(13, 7, 1, Hl);
    } else {
      at(-1, 6, 4); at(4, 6, 3); at(9, 6, 2); at(13, 6, 6);
      at(-1, 7, 3); at(5, 7, 1, Hl); at(9, 7, 1, Hl); at(15, 7, 4);
      if (style === 'curls') { at(2, 7, 1); at(11, 7, 2); }
    }
    // Side locks to the jaw (long: past it, onto the shoulders).
    const end = style === 'long' ? 17 : style === 'bob' ? 13 : style === 'curls' ? 12 : style === 'cropped' || style === 'pigtails' ? 10 : 11;
    for (let y = 7; y <= end; y++) {
      const wide = (style === 'long' && y > 11) || (style === 'bob' && y > 9) ? 1 : 0;
      at(-1 - wide, y, 3 + wide); at(1, y, 1, Hl);
      at(16, y, 3 + wide); at(16, y, 1, Hl); at(18 + wide, y, 1, Hl);
    }
    if (style === 'curls') for (const y of [9, 12]) { at(-2, y, 1); at(19, y, 1); }
    if (style === 'braid') for (let y = 12; y <= 23; y++) at(17, y, 2, y === 23 ? p.trim : (y >> 1) % 2 ? H : Hl);
    if (style === 'bob') { at(-2, 13, 4, Hl); at(16, 13, 4, Hl); }
    // The ponytail swings out past the right of the neck.
    if (style === 'ponytail') { for (let y = 9; y <= 17; y++) at(18 + (y > 13 ? 1 : 0), y, 2, y % 3 ? H : Hl); at(18, 8, 2, p.trim); }
  } else {
    // From behind: hair over the whole head, strands, the nape.
    for (let r = 6; r <= 12; r++) at(-1, r, 20);
    at(0, 13, 18); at(2, 14, 14);
    for (const x of [4, 9, 13]) for (let y = 8; y <= 12; y++) at(x, y, 1, Hl);
    at(2, 13, 14, mix(H, Hl, .5)); at(2, 14, 14, Hl);
    if (style === 'long') { for (let y = 15; y <= 19; y++) at(0, y, 18); at(0, 19, 18, Hl); for (let y = 15; y <= 18; y++) { at(14, y, 4, Hl); at(5, y, 1, Hl); at(10, y, 1, Hl); } }
    if (style === 'braid') for (let y = 15; y <= 25; y++) at(8, y, 2, y === 25 ? p.trim : (y >> 1) % 2 ? H : Hl);
    if (style === 'ponytail') { at(7, 11, 4, p.trim); for (let y = 12; y <= 23; y++) { const w = y > 20 ? 2 : 4; at(9 - w / 2, y, w); at(9 - w / 2, y, 1, Hh); } at(8, 24, 2, Hl); }
    if (style === 'bob') { at(-1, 13, 20); at(-1, 14, 20, Hl); for (const x of [3, 8, 12, 16]) at(x, 13, 1, Hl); }
    if (style === 'curls') for (const y of [7, 10]) { at(-2, y, 1); at(19, y, 1); }
  }
  // Volume: a shine across the crown, the right side in shade.
  at(5, -1, 4, Hh); at(3, 0, 4, Hh); at(2, 1, 2, Hh); at(9, 0, 2, Hh); at(1, 2, 1, Hh);
  at(13, 0, 3, Hl); at(15, 1, 2, Hl); at(16, 2, 2, Hl); at(17, 3, 2, Hl); at(17, 4, 2, Hl); at(17, 5, 2, Hl);
}

function beard(P: Px, p: Readonly<Palette>, ht: number): void {
  const H = p.hair, Hl = p.hairLo;
  const at = (x: number, y: number, w: number, col = H) => P(HX + x, ht + y, w, 1, col);
  at(1, 11, 2); at(15, 11, 2);
  at(1, 12, 5); at(12, 12, 5); at(2, 13, 14); at(3, 14, 12); at(5, 15, 8);
  at(14, 12, 3, Hl); at(13, 13, 3, Hl); at(11, 14, 4, Hl); at(9, 15, 4, Hl);
  at(6, 12, 6, p.hairLo); at(8, 13, 2, p.mouth); at(3, 13, 2, p.hairHi);
}

function hat(P: Px, kind: 'brim' | 'cap', col: string, ht: number, front: boolean): void {
  const H = hi(col, .25), L = lo(col, .35);
  const at = (x: number, y: number, w: number, c = col) => P(HX + x, ht + y, w, 1, c);
  if (kind === 'brim') {
    at(4, -2, 10); at(3, -1, 12); for (let y = 0; y < 4; y++) at(3, y, 12);
    at(4, -2, 4, H); at(3, -1, 1, H); at(3, 0, 1, H); at(12, -1, 3, L); for (let y = 0; y < 4; y++) at(13, y, 2, L);
    at(3, 3, 12, lo(col, .55));
    at(-3, 4, 24); at(-3, 5, 24, L); at(-3, 4, 8, H);
  } else {
    at(3, -1, 12); at(1, 0, 16); for (let y = 1; y < 5; y++) at(0, y, 18);
    at(3, -1, 4, H); at(1, 0, 3, H); at(14, 0, 3, L); for (let y = 1; y < 5; y++) at(15, y, 3, L);
    if (front) { at(2, 5, 14, L); at(3, 6, 12, lo(col, .55)); }
  }
}

/** The Slate held up and looked at. */
function slate(P: Px, p: Readonly<Palette>, tt: number): void {
  P(C - 4, tt + 1, 8, 7, '#241c2c'); P(C - 3, tt + 2, 6, 5, '#7fd4f0'); P(C - 3, tt + 2, 6, 1, '#e6fbff');
  P(C - 2, tt + 4, 2, 1, '#e6fbff'); P(C + 1, tt + 5, 1, 1, '#ffd25a');
  P(C - 5, tt + 4, 2, 3, p.skin); P(C + 3, tt + 4, 2, 3, p.skinLo);
}

// ───────────────────────── worn gear ─────────────────────────

interface Mat { base: string; hi: string; lo: string; accent: string; trim: string }
/** A worn piece's colours: its own, or its realm style's, each two-toned; the trim is its rarity's. */
function matOf(pc: GearPiece): Mat {
  const L = pc.look;
  if (L) return { base: L.base, hi: L.lit, lo: L.deep, accent: L.accent, trim: L.trim ?? mix(L.base, L.lit, .6) };
  const [b, a] = STYLE_COLORS[pc.style];
  const base = pc.color ?? b;
  return { base, hi: hi(base, .28), lo: lo(base, .38), accent: pc.accent ?? a, trim: RARITY_TRIM[pc.rarity] };
}

/** The chest piece: plate, a robe or mantle, or a coat. */
function paintChest(P: Px, gear: KeeperGear | null, front: boolean, tt: number, bw: number, sway: number, fem = false): void {
  const ch = gear?.chest;
  if (!ch) return;
  const m = matOf(ch), l = C - bw, w = bw * 2;
  // Below the waist a feminine figure's hips sit a pixel wider each side: the faulds and the coat's skirts follow them.
  const fx = fem ? 1 : 0;
  if (ch.kind === 'robe' || ch.kind === 'mantle') {
    robe(P, { base: m.base, hi: m.hi, lo: m.lo, trim: m.trim }, tt, bw, sway, front, m.accent, false, fem);
    if (ch.kind === 'mantle') { P(l - 1, tt, w + 2, 3, m.accent); P(l - 1, tt, w + 2, 1, hi(m.accent, .25)); P(C + bw - 1, tt, 2, 3, lo(m.accent, .3)); }
  } else if (ch.kind === 'plate') {
    P(l, tt, w, 7, m.base); P(l, tt, w, 1, m.hi); P(l, tt, 2, 6, m.hi); P(l + w - 2, tt + 1, 2, 6, m.lo);
    // Faulds: banded plates over the hips, the trim at the waist.
    P(l, tt + 6, w, 1, m.trim);
    for (let i = 0; i < 3; i++) { P(l - 1 - fx, tt + 7 + i, w + 2 + fx * 2, 1, i % 2 ? m.lo : m.base); P(l - 1 - fx, tt + 7 + i, 1, 1, m.hi); }
    P(l - 1 - fx, tt + 10, w + 2 + fx * 2, 1, lo(m.trim, .3));
    if (fem && front) { P(C - 4, tt + 4, 2, 1, m.lo); P(C + 2, tt + 4, 2, 1, m.lo); }
    if (front) {
      // The chest's ridge catches the light; rivets in the trim; the realm's gem.
      P(C - 1, tt + 1, 1, 5, m.hi); P(C, tt + 1, 1, 5, m.lo);
      P(C - 1, tt, 2, 1, m.trim);
      P(l + 2, tt + 3, 1, 1, m.trim); P(l + w - 3, tt + 3, 1, 1, m.trim);
      P(C - 1, tt + 3, 2, 2, m.accent); P(C - 1, tt + 3, 1, 1, hi(m.accent, .4));
    } else P(C, tt + 1, 1, 5, m.lo);
    // Pauldrons.
    for (const [x, lit] of [[l - 3, true], [l + w - 1, false]] as const) {
      P(x + 1, tt - 1, 3, 1, m.base); P(x, tt, 4, 3, m.base);
      P(x, tt + 3, 4, 1, m.trim);
      if (lit) { P(x + 1, tt - 1, 2, 1, m.hi); P(x, tt, 1, 2, m.hi); } else P(x + 2, tt, 2, 3, m.lo);
    }
  } else {
    // A coat: open at the throat, lapels in trim, tails to the knee, buttons in the realm's accent.
    P(l, tt, w, 7, m.base); P(l - 1 - fx, tt + 7, w + 2 + fx * 2, 6, m.base);
    P(l, tt, 1, 7, m.hi); P(l - 1 - fx, tt + 7, 1, 6, m.hi); P(l + w - 2, tt, 2, 7, m.lo); P(l + w - 1 + fx, tt + 7, 2, 6, m.lo);
    P(l - 1 - fx, tt + 12, w + 2 + fx * 2, 1, m.trim);
    if (fem && front) { P(l + 1, tt + 4, 3, 1, m.lo); P(l + w - 4, tt + 4, 3, 1, m.lo); }
    P(l, tt + 6, w, 1, lo(m.base, .5));
    if (front) {
      P(C - 1, tt + 7, 2, 6, lo(m.base, .55));
      P(C - 3, tt, 1, 3, m.trim); P(C + 2, tt, 1, 3, m.trim); P(C - 2, tt + 3, 1, 1, m.trim); P(C + 1, tt + 3, 1, 1, m.trim);
      P(C - 2, tt, 4, 1, lo(m.base, .5));
      for (const y of [tt + 2, tt + 4]) P(C - 1, y, 1, 1, m.accent);
    } else P(C, tt + 7, 1, 6, m.lo);
  }
  const L = ch.look;
  if (!L) return;
  // Its look: scale rows over the chest, a stitched seam, runes down the front, a short mantle, a glow on the shoulders.
  if (L.shape === 'scale') for (let y = tt + 1; y < tt + 6; y++) for (let x = l + 1 + (y & 1); x < l + w - 1; x += 2) P(x, y, 1, 1, m.lo);
  if (L.seam) { if (front) for (let y = tt + 1; y < tt + 13; y++) P(C, y, 1, 1, L.seam); else P(C, tt + 1, 1, 12, L.seam); }
  if (L.runes && front) for (const [x, y] of [[C - 1, tt + 2], [C + 1, tt + 4], [C - 1, tt + 8], [C + 1, tt + 10]] as const) P(x, y, 1, 1, L.runes);
  if (L.mantle) {
    P(l - 1, tt, w + 2, 3, L.mantle); P(l - 1, tt, w + 2, 1, hi(L.mantle, .25)); P(l - 1, tt, 1, 3, hi(L.mantle, .15));
    P(C + bw - 1, tt, 2, 3, lo(L.mantle, .3)); P(l - 1, tt + 3, w + 2, 1, lo(L.mantle, .4));
    if (front) { P(C - 1, tt + 1, 2, 2, L.accent); P(C - 1, tt + 1, 1, 1, hi(L.accent, .4)); }
  }
  if (L.glow) P(l + 1, tt, w - 2, 1, mix(m.base, L.glow, .35));
}

function paintGear(P: Px, M: Px, gear: KeeperGear | null, front: boolean, ht: number, tt: number, bw: number, pose: Pose, phone: boolean, p: Readonly<Palette>, frame: number): void {
  if (!gear) return;
  const robed = gear.chest?.kind === 'robe' || gear.chest?.kind === 'mantle';
  if (gear.legs) {
    const m = matOf(gear.legs), L = gear.legs.look;
    if (gear.legs.kind === 'belt') { P(C - bw, tt + 6, bw * 2, 1, m.base); P(C - 1, tt + 6, 2, 1, m.trim); }
    else if (!robed) for (const [x, lift] of [[C - 4, pose.lLift], [C + 1, pose.rLift]] as const) {
      // Greaves: lit on the left, a kneecap in the trim.
      const h = BT - (LT + 2) - lift;
      P(x, LT + 2, 3, h, m.base); P(x, LT + 2, 1, h, m.hi); P(x + 2, LT + 2, 1, h, m.lo);
      P(x, LT + 2, 3, 1, m.trim);
      if (L?.runes) P(x + 1, LT + 4, 1, 1, L.runes);
    }
  }
  if (gear.feet && !robed) {
    const m = matOf(gear.feet), L = gear.feet.look;
    for (const [x, lift, lit] of [[C - 5, pose.lLift, true], [C + 1, pose.rLift, false]] as const) {
      const by = BT - lift;
      if (L?.shape === 'sandals') {
        // Reed sandals: bare feet on a thin sole, two straps.
        P(x, by, 4, 3, lit ? p.skin : p.skinLo); P(x, by + 3, 4, 1, m.lo); P(x, by + 1, 4, 1, m.base); P(x + 1, by + 2, 2, 1, L.accent);
        continue;
      }
      P(x, by, 4, 4, m.base); P(x, by, 4, 1, m.trim); P(x + 3, by + 1, 1, 3, m.lo); P(x, by + 3, 4, 1, m.lo);
      if (lit) P(x, by + 1, 1, 2, m.hi);
      // Sabatons: plate up the shin, a cuff in the trim.
      if (L?.shape === 'greaves') { P(x, by - 3, 4, 3, m.base); P(x, by - 3, 4, 1, m.trim); if (lit) P(x, by - 2, 1, 2, m.hi); else P(x + 3, by - 2, 1, 2, m.lo); }
    }
  }
  if (gear.hands && !phone) {
    // Gauntlets or wraps over the cuffs (a look's seam, runes, a gauntlet's flared cuff).
    const m = matOf(gear.hands), L = gear.hands.look;
    for (const [x, dy, lit] of [[C - bw - 3, pose.lArm, true], [C + bw, pose.rArm, false]] as const) {
      const y = tt + 7 + dy;
      P(x, y, 3, 3, m.base); P(x, y, 3, 1, m.trim); P(x + (lit ? 0 : 2), y + 1, 1, 2, lit ? m.hi : m.lo);
      if (L?.shape === 'gauntlets') { P(x - (lit ? 1 : 0), y - 1, 4, 1, L.trim ?? m.hi); }
      if (L?.seam) P(x + 1, y, 1, 3, L.seam);
      if (L?.runes) P(x + 1, y + 2, 1, 1, L.runes);
    }
  }
  const hd = gear.head;
  if (hd && hd.kind !== 'hood') paintHeadGear(P, hd, front, ht);
  if (front && gear.trinket) {
    // A pendant at the throat (a ring: a glint on the left hand).
    const m = matOf(gear.trinket), L = gear.trinket.look;
    if (L?.shape === 'ring') P(C - bw - 2, tt + 9 + pose.lArm, 1, 1, L.accent);
    else { P(C - 2, tt + 1, 1, 1, m.hi); P(C + 1, tt + 1, 1, 1, m.hi); P(C - 1, tt + 2, 2, 2, L ? m.base : m.trim); P(C - 1, tt + 2, 1, 1, L ? L.accent : hi(m.trim, .4)); }
  }
  const charms = (['charm1', 'charm2', 'charm3'] as const).map(slot => gear[slot]).filter((c): c is GearPiece => !!c);
  if (front) charms.forEach((ch, i) => P(C - 3 + i * 2, tt + 7, 1, 1, ch.look?.accent ?? RARITY_TRIM[ch.rarity]));
  const off = gear['off-hand'];
  if (off && !phone) {
    const m = matOf(off), S = front ? P : M, L = off.look;
    const y = tt + 3 + pose.lArm;
    if (off.kind === 'shield') {
      // A heater shield on the forearm (from behind we see its back: planks and a strap).
      ([[0, 8], [0, 8], [0, 8], [0, 8], [0, 8], [0, 8], [1, 6], [2, 4], [3, 2]] as const).forEach(([x, w], i) => S(1 + x, y + i, w, 1, front ? m.base : L ? L.sub : WOOD));
      if (front) {
        S(1, y, 8, 1, m.trim); S(1, y, 1, 6, m.trim); S(8, y, 1, 6, lo(m.trim, .3)); S(2, y + 1, 2, 4, m.hi); S(6, y + 1, 2, 5, m.lo);
        S(4, y + 2, 2, 4, m.accent); S(3, y + 3, 4, 1, m.accent); S(4, y + 2, 1, 1, hi(m.accent, .4));
        if (L?.runes) { S(2, y + 6, 1, 1, L.runes); S(7, y + 6, 1, 1, L.runes); S(4, y + 7, 2, 1, L.runes); }
      } else { S(3, y, 1, 7, WOOD_LO); S(6, y, 1, 6, WOOD_LO); S(1, y + 3, 8, 1, '#3a2618'); S(1, y, 8, 1, m.trim); }
    } else if (off.kind === 'lantern') {
      const frameCol = L ? L.base : '#3a2c24', glass = L ? L.accent : '#ffd27a', heart = L ? hi(L.accent, .6) : '#fff4c2';
      S(3, y + 5, 4, 1, frameCol); S(3, y + 6, 4, 4, glass); S(4, y + 7, 2, 2, heart); S(3, y + 10, 4, 1, frameCol); S(4, y + 4, 2, 1, frameCol);
      if (L) { S(3, y + 6, 1, 4, L.lit); S(6, y + 6, 1, 4, L.deep); }
    } else if (off.kind === 'censer') {
      // The censer on its chain from the hand, swinging a pixel either way with the step; its holes glow.
      const sw = [0, 0, -1, 0, 1, 0, 0, 0][frame] ?? 0;
      S(4, y + 5, 1, 3, m.lo); S(4 + sw, y + 8, 1, 2, m.lo);
      S(3 + sw, y + 10, 3, 1, m.hi); S(2 + sw, y + 11, 5, 3, m.base); S(2 + sw, y + 11, 1, 3, m.hi); S(6 + sw, y + 11, 1, 3, m.lo);
      S(3 + sw, y + 12, 1, 1, m.accent); S(5 + sw, y + 12, 1, 1, m.accent); S(4 + sw, y + 11, 1, 1, hi(m.accent, .4));
      S(3 + sw, y + 14, 3, 1, m.lo);
    } else if (off.kind === 'crucible') {
      // A black pot held at the hip, molten to the brim.
      S(1, y + 6, 7, 1, m.hi); S(1, y + 7, 7, 4, m.base); S(1, y + 7, 1, 4, m.hi); S(7, y + 7, 1, 4, m.lo); S(2, y + 11, 5, 1, m.lo);
      S(2, y + 7, 5, 1, m.accent); S(3, y + 7, 3, 1, hi(m.accent, .45)); S(4, y + 7, 1, 1, '#fff2a8');
    } else if (off.kind === 'orb') {
      S(2, y + 5, 5, 5, m.base); S(3, y + 4, 3, 1, m.base); S(3, y + 10, 3, 1, m.lo); S(3, y + 5, 2, 2, m.hi); S(5, y + 7, 2, 2, m.accent);
      if (L) S(3, y + 11, 3, 1, L.sub);
    } else if (off.kind === 'tome' || off.kind === 'scroll' || off.kind === 'cards' || off.kind === 'scales') {
      S(2, y + 4, 5, 6, m.base); S(2, y + 4, 5, 1, m.hi); S(6, y + 5, 1, 5, m.lo); S(3, y + 6, 3, 1, m.trim);
      if (L) { S(3, y + 7, 2, 2, L.accent); if (L.runes) S(4, y + 9, 1, 1, L.runes); }
    } else if (L && (off.kind === 'wand' || off.kind === 'dagger' || off.kind === 'sword')) {
      // A held off-hand rod (a shuttle, a wand): its shaft and lit head.
      S(4, y + 1, 1, 8, L.sub); S(3, y - 1, 3, 2, L.base); S(4, y - 1, 1, 1, L.accent);
    }
  }
}

/** Head gear that is not a hood: helms (open, horned, great), a crown, a circlet, a mask. */
function paintHeadGear(P: Px, hd: GearPiece, front: boolean, ht: number): void {
  const m = matOf(hd), L = hd.look;
  const at = (x: number, y: number, w: number, col: string) => P(HX + x, ht + y, w, 1, col);
  const shape = L ? L.shape : hd.kind === 'helm' ? (hd.variant === 'pyre' ? 'great-helm' : 'open-helm') : hd.kind;
  if (shape === 'great-helm') {
    // A closed helm (the Pyre Watch's iron): a combed dome, a lit rim, a dark visor slit over the eyes and a nasal guard.
    const slit = '#150f14', glow = m.accent, eyes = L?.eyes ?? glow;
    ([[4, 10], [2, 14], [0, 18], [-1, 20], [-1, 20], [-1, 20], [-1, 20]] as const).forEach(([x, w], i) => at(x, i - 2, w, m.base));
    at(4, -2, 5, m.hi); at(2, -1, 3, m.hi); at(0, 0, 2, m.hi); at(-1, 1, 1, m.hi);
    for (let y = -1; y < 5; y++) at(15, y, 3, m.lo);
    // The comb: a raised ridge front to back over the crown, lit on its left.
    for (let y = -3; y < 4; y++) { at(7, y, 1, m.hi); at(8, y, 2, y === -3 ? m.hi : m.base); at(10, y, 1, m.lo); }
    // The lit rim and the brow plate under it.
    at(-1, 3, 20, glow); at(-1, 3, 4, hi(glow, .4)); at(14, 3, 5, lo(glow, .35));
    at(-1, 4, 20, lo(m.base, .3)); at(0, 5, 18, m.base); at(16, 5, 2, m.lo);
    // The visor slit, eyes (or an ember) catching in it either side of the nasal.
    if (front) { at(2, 6, 14, slit); at(4, 6, 2, eyes); at(12, 6, 2, eyes); }
    // Cheek guards with a rivet, the nasal (front); the neck guard (back).
    for (let y = 5; y < 12; y++) { at(-1, y, 3, m.base); at(16, y, 3, m.lo); }
    at(-1, 5, 1, m.hi); at(0, 10, 1, glow); at(17, 10, 1, glow);
    if (front) { for (let y = 5; y < 11; y++) { at(8, y, 2, y === 5 ? m.trim : m.hi); at(9, y, 1, m.base); } at(8, 10, 2, lo(m.base, .3)); }
    else {
      for (let y = 5; y < 13; y++) at(-1, y, 20, y === 12 ? m.trim : y % 3 ? m.base : m.lo);
      at(1, 6, 16, lo(m.base, .5)); at(8, 8, 2, glow);
    }
  } else if (shape === 'open-helm' || shape === 'horned') {
    ([[4, 10], [2, 14], [0, 18], [-1, 20], [-1, 20], [-1, 20], [-1, 20]] as const).forEach(([x, w], i) => at(x, i - 2, w, m.base));
    at(4, -2, 5, m.hi); at(2, -1, 3, m.hi); at(0, 0, 2, m.hi); at(-1, 1, 1, m.hi);
    for (let y = -1; y < 5; y++) at(15, y, 3, m.lo);
    at(-1, 4, 20, m.trim);
    // Cheek guards and a nasal (front); the neck guard (back).
    for (let y = 5; y < 12; y++) { at(-1, y, 3, m.base); at(16, y, 3, m.lo); }
    at(-1, 5, 1, m.hi);
    if (front) { for (let y = 5; y < 10; y++) at(8, y, 2, y === 5 ? m.trim : m.base); at(8, 6, 1, m.hi); }
    else for (let y = 5; y < 13; y++) at(-1, y, 20, y === 12 ? m.trim : y % 3 ? m.base : m.lo);
    if (shape === 'open-helm') { at(7, -3, 4, m.accent); at(7, -3, 2, hi(m.accent, .35)); }
  } else if (shape === 'crown') {
    const gold = L ? m.base : m.trim, gHi = L ? m.hi : hi(m.trim, .35), gLo = L ? m.lo : lo(m.trim, .3);
    for (const x of [2, 8, 14]) { at(x, -2, 2, gold); at(x, -1, 2, gold); }
    at(1, 0, 16, gold); at(1, 1, 16, gold); at(1, 2, 16, gLo);
    at(1, 0, 6, gHi); at(2, -2, 1, L ? gHi : hi(m.trim, .45));
    if (L) for (const x of [2, 8, 14]) at(x + 1, -2, 1, m.accent);
    if (front) { at(8, 1, 2, m.accent); at(8, 1, 1, hi(m.accent, .5)); at(4, 1, 1, m.accent); at(13, 1, 1, m.accent); }
  } else if (shape === 'mask') {
    // A face plate over the face (the fringe still shows above it): eye holes, a lit brow, a mouth slit; a strap behind.
    if (front) {
      ([[3, 12], [2, 14], [2, 14], [2, 14], [3, 12], [4, 10], [6, 6]] as const).forEach(([x, w], i) => at(x, 8 + i, w, m.base));
      at(3, 8, 12, m.hi); at(8, 9, 2, m.hi); at(14, 9, 2, m.lo); at(15, 10, 1, m.lo);
      const eye = L?.eyes ?? OUTLINE;
      at(4, 10, 3, eye); at(11, 10, 3, eye); at(7, 13, 4, m.lo);
      if (L?.trim) at(2, 8, 14, L.trim);
    } else at(-1, 9, 20, m.lo);
  } else {
    at(-1, 5, 20, m.trim); at(-1, 5, 6, hi(m.trim, .3)); at(14, 5, 5, lo(m.trim, .3));
    if (front) { at(8, 5, 2, m.accent); at(8, 6, 2, lo(m.accent, .3)); at(8, 5, 1, hi(m.accent, .5)); }
    if (L) { at(-1, 5, 20, m.base); at(-1, 5, 6, m.hi); at(14, 5, 5, m.lo); if (front) { at(8, 5, 2, m.accent); at(8, 5, 1, hi(m.accent, .5)); } }
  }
  if (!L) return;
  if (L.horns || shape === 'horned') {
    // Horns from the temples, curling out and up; the far side's in shade.
    const hn = L.horns ?? m.hi;
    for (const [x, y, w] of [[-1, 0, 1], [-2, -1, 2], [-3, -2, 2], [-3, -3, 1]] as const) { at(x, y, w, hn); at(17 - x - w + 1, y, w, lo(hn, .25)); }
    at(-2, -1, 1, hi(hn, .3));
  }
  if (L.runes) {
    if (shape === 'crown') { at(5, 1, 1, L.runes); at(12, 1, 1, L.runes); }
    else if (shape === 'circlet') { at(3, 5, 1, L.runes); at(14, 5, 1, L.runes); }
    else if (shape !== 'mask') { at(3, 1, 1, L.runes); at(6, 0, 1, L.runes); at(11, 0, 1, L.runes); at(14, 1, 1, L.runes); }
  }
  if (L.glow && shape !== 'mask' && shape !== 'circlet') at(4, shape === 'crown' ? 0 : -2, 10, mix(m.base, L.glow, .35));
}

/**
 * The Thornstrider's quiver. From behind: a leather tube slung from the right shoulder (the viewer's right) toward the
 * left hip, its mouth at the shoulder. `fletch`: the arrows standing out of it — from behind, three green fletchings over
 * the shoulder beside the hood; from the front, the tips of two peeking past the hood's edge on the far shoulder.
 */
function quiver(P: Px, q: string, tt: number, fletch: boolean, front = false): void {
  if (!fletch) {
    for (let i = 0; i < 10; i++) { const x = C + 5 - Math.floor(i / 2); P(x, tt - 2 + i, 3, 1, q); P(x, tt - 2 + i, 1, 1, hi(q, .2)); P(x + 2, tt - 2 + i, 1, 1, lo(q, .35)); }
    P(C + 4, tt - 2, 4, 1, lo(q, .45)); P(C + 1, tt + 7, 3, 1, lo(q, .4));
    return;
  }
  if (front) {
    // The far shoulder (the viewer's left): two fletchings and a shaft, outside the hood.
    P(2, tt - 6, 1, 5, '#a07a4a'); P(1, tt - 8, 2, 2, '#6eae52'); P(1, tt - 8, 1, 1, '#b4e08a');
    P(3, tt - 5, 1, 4, '#a07a4a'); P(3, tt - 7, 2, 2, '#467a38');
    return;
  }
  for (const [dx, h, col] of [[0, 4, '#6eae52'], [2, 6, '#b4e08a'], [4, 3, '#467a38']] as const) {
    const x = C + 6 + dx;
    P(x, tt - 2 - h, 1, h, '#a07a4a');
    P(x, tt - 4 - h, 2, 2, col); P(x + 1, tt - 4 - h, 1, 1, lo(col, .25));
  }
  P(C + 8, tt - 9, 1, 1, '#e8dcc0');
}

// ───────────────────────── held things ─────────────────────────

/** A weapon that is not a staff, held upright in the right hand (front) or the left (back). `hy`: the hand's row. */
function paintHeld(P: Px, w: GearPiece, hy: number): void {
  const m = matOf(w), x = 23, L = w.look;
  // Its own look: the blade or head in its tones, the haft in its second material (else steel and ash).
  const STEEL_ = L ? mix(L.base, L.lit, .5) : STEEL, STEEL_HI_ = L ? hi(L.lit, .4) : STEEL_HI, STEEL_LO_ = L ? L.deep : STEEL_LO;
  const WOOD_ = L ? L.sub : WOOD, WOOD_HI_ = L ? hi(L.sub, .25) : WOOD_HI, WOOD_LO_ = L ? lo(L.sub, .3) : WOOD_LO, BONE_ = L ? hi(L.lit, .5) : BONE;
  switch (w.kind) {
    case 'axe': case 'pickaxe': case 'hammer': case 'mace': case 'sickle': case 'tongs': {
      P(x, hy - 11, 2, 16, WOOD_); P(x, hy - 11, 1, 16, WOOD_HI_); P(x, hy + 4, 2, 1, WOOD_LO_);
      if (w.kind === 'axe' || w.kind === 'sickle') {
        P(x + 2, hy - 12, 2, 6, STEEL_); P(x + 3, hy - 12, 1, 6, STEEL_HI_); P(x + 2, hy - 11, 1, 4, STEEL_LO_);
        P(x - 1, hy - 11, 1, 3, STEEL_LO_); P(x, hy - 9, 2, 1, m.trim);
      } else if (w.kind === 'pickaxe') {
        P(x - 3, hy - 11, 7, 2, STEEL_); P(x - 3, hy - 11, 7, 1, STEEL_HI_); P(x - 4, hy - 9, 1, 1, STEEL_LO_); P(x + 3, hy - 9, 1, 1, STEEL_LO_); P(x, hy - 11, 2, 1, m.trim);
      } else if (w.kind === 'tongs') {
        P(x - 1, hy - 12, 1, 3, STEEL_LO_); P(x + 2, hy - 12, 1, 3, STEEL_LO_);
      } else {
        const head = w.kind === 'mace' ? m.base : STEEL_;
        P(x - 2, hy - 13, 6, 5, head); P(x - 2, hy - 13, 6, 1, hi(head, .35)); P(x - 2, hy - 12, 1, 3, hi(head, .25)); P(x + 2, hy - 12, 2, 4, lo(head, .3));
        P(x - 2, hy - 9, 6, 1, m.trim);
        if (w.kind === 'mace') { P(x - 3, hy - 11, 1, 1, STEEL_HI_); P(x, hy - 14, 2, 1, STEEL_HI_); }
      }
      break;
    }
    case 'spear': case 'halberd': {
      const top = Math.max(1, hy - 22);
      P(x, top + 4, 2, hy + 10 - top - 4, WOOD_); P(x, top + 4, 1, hy + 10 - top - 4, WOOD_HI_);
      P(x, top, 2, 4, STEEL_); P(x, top, 1, 4, STEEL_HI_); P(x - 1, top + 2, 4, 2, STEEL_); P(x + 2, top + 2, 1, 2, STEEL_LO_);
      P(x, top + 4, 2, 1, m.trim);
      if (w.kind === 'halberd') { P(x + 2, top + 5, 2, 4, STEEL_); P(x + 3, top + 5, 1, 4, STEEL_HI_); P(x - 2, top + 6, 2, 1, STEEL_LO_); }
      break;
    }
    case 'bow': case 'crossbow': {
      if (w.kind === 'crossbow') {
        P(x - 3, hy - 6, 7, 1, WOOD_); P(x - 3, hy - 6, 3, 1, WOOD_HI_); P(x, hy - 7, 2, 10, WOOD_LO_); P(x, hy - 7, 1, 10, WOOD_);
        P(x - 3, hy - 5, 7, 1, BONE_); P(x, hy - 8, 2, 1, m.trim);
      } else {
        // The limbs bow out to the right; the string runs straight down the left.
        P(x + 1, hy - 11, 1, 2, WOOD_); P(x + 2, hy - 9, 1, 8, WOOD_HI_); P(x + 3, hy - 9, 1, 8, WOOD_LO_);
        P(x + 2, hy + 1, 1, 3, WOOD_); P(x + 1, hy + 4, 1, 2, WOOD_LO_);
        P(x, hy - 11, 1, 17, BONE_);
        P(x + 2, hy - 1, 2, 2, m.trim);
      }
      break;
    }
    default: {
      // A blade: steel with a lit edge, its tier's trim at the guard and pommel.
      const len = w.kind === 'dagger' ? 6 : w.kind === 'greatsword' ? 17 : 13, bwid = w.kind === 'greatsword' ? 3 : 2;
      const top = Math.max(2, hy - 1 - len);
      P(x, top, bwid, hy - 1 - top, STEEL_); P(x, top, 1, hy - 1 - top, STEEL_HI_); P(x + bwid - 1, top + 1, 1, hy - 2 - top, STEEL_LO_);
      P(x, top - 1, 1, 1, STEEL_HI_);
      P(x - 2, hy - 1, bwid + 4, 1, m.trim); P(x - 2, hy - 1, 2, 1, hi(m.trim, .35));
      P(x, hy + 2, 2, 1, WOOD_); P(x, hy + 3, 2, 1, m.accent);
      if (L?.runes) for (let ry = top + 2; ry < hy - 2; ry += 4) P(x + (bwid > 2 ? 1 : 0), ry, 1, 1, L.runes);
    }
  }
  if (L?.runes && w.kind !== 'sword' && w.kind !== 'greatsword' && w.kind !== 'dagger') P(x, hy - 6, 1, 1, L.runes);
}

/** The Warlock's staff: ashwood, bands of bone, a violet cage round an ember orb — raised and flaring to cast. */
function paintStaff(P: Px, cast: boolean, hy: number, wand: GearPiece | null, look: WornLook | null = null): void {
  // A worn staff or wand in its own look: its cage in its tones, its orb its accent, its shaft its haft.
  const x = 23, cage = look ? look.deep : '#3b2140', cageHi = look ? look.lit : '#8a55c8';
  const orb = look ? look.accent : '#8a3fd0', core = look ? hi(look.accent, .45) : '#ff9a3a', spark = look ? hi(look.accent, .75) : '#ffe08a';
  const WOOD = look ? look.sub : WOOD_BASE, WOOD_HI = look ? hi(look.sub, .25) : WOOD_LIT, WOOD_LO = look ? lo(look.sub, .3) : WOOD_SHADE;
  const y0 = wand ? hy - 10 : cast ? 2 : 5;
  const bottom = wand ? hy + 4 : cast ? FEET - 4 : FEET;
  // The shaft: lit on the left.
  P(x, y0 + 7, 2, bottom - y0 - 7, WOOD); P(x, y0 + 7, 1, bottom - y0 - 7, WOOD_HI); P(x + 1, y0 + 7, 1, bottom - y0 - 7, WOOD_LO);
  if (!wand) {
    for (const y of [y0 + 11, y0 + 21]) { P(x, y, 2, 2, BONE); P(x + 1, y, 1, 2, BONE_LO); }
    P(x, y0 + 16, 1, 1, WOOD_LO); P(x, bottom - 2, 2, 2, '#5a5560');
  }
  // The cage: two prongs, a cap, a bone collar.
  P(x - 1, y0 + 1, 1, 5, cage); P(x + 2, y0 + 1, 1, 5, cage); P(x - 1, y0 + 1, 1, 4, cageHi);
  P(x, y0, 2, 1, cage); P(x, y0, 1, 1, cageHi);
  P(x - 1, y0 + 6, 4, 1, BONE); P(x + 2, y0 + 6, 1, 1, BONE_LO);
  // The orb: an ember in a violet haze; white-hot when casting.
  P(x, y0 + 1, 2, 5, cast ? '#ffd25a' : orb);
  P(x, y0 + 2, 2, 3, cast ? '#fff1b8' : core);
  P(x, y0 + 2, 1, 1, cast ? '#ffffff' : spark);
  if (look?.runes && !wand) for (const y of [y0 + 13, y0 + 18]) P(x, y, 1, 1, look.runes);
  if (cast) for (const [dx, dy] of [[-3, 3], [-2, 1], [3, 0], [3, 4], [-3, 6], [1, -1]] as const) P(x + dx, y0 + dy, 1, 1, dy % 2 ? '#ffd25a' : '#e2c6ff');
}

/**
 * The Lanternwright's lamp-staff: a dark pole banded in brass with a lantern set on its head — a brass ring and cap, cream
 * glass with a white heart between brass posts, a brass base. Raised to cast, the lantern flares and throws eight
 * sparks. From behind, the glass is the lantern's back: a dimmer glow through the frame.
 */
function paintLampStaff(P: Px, cast: boolean, hy: number, front: boolean): void {
  const x = 23, brass = '#c99a3e', brassLo = '#8a6a3a', glass = '#ffd27a', heart = '#fffbe8';
  const y0 = cast ? 1 : 3, bottom = cast ? FEET - 4 : FEET;
  // The pole, lit on the left, two brass bands, an iron foot.
  P(x, y0 + 9, 2, bottom - y0 - 9, WOOD); P(x, y0 + 9, 1, bottom - y0 - 9, WOOD_HI); P(x + 1, y0 + 9, 1, bottom - y0 - 9, WOOD_LO);
  for (const y of [y0 + 16, y0 + 24]) { P(x, y, 2, 1, brass); P(x + 1, y, 1, 1, brassLo); }
  P(x, bottom - 2, 2, 2, '#5a5560');
  // The lantern on the pole's head: ring, cap, two posts round the glass, the base.
  const lx = x - 2;
  P(lx + 2, y0 - 1, 2, 1, brassLo);
  P(lx + 1, y0, 4, 1, brass); P(lx + 1, y0, 1, 1, '#e0b25a');
  P(lx, y0 + 1, 1, 6, brass); P(lx + 5, y0 + 1, 1, 6, brassLo);
  P(lx + 1, y0 + 1, 4, 6, cast ? heart : front ? glass : mix(glass, brassLo, .35));
  P(lx + 2, y0 + 2, 2, 4, cast ? '#ffffff' : front ? heart : glass);
  if (front) P(lx + 2, y0 + 2, 1, 1, '#ffffff');
  P(lx, y0 + 7, 6, 1, brass); P(lx + 1, y0 + 8, 4, 1, brassLo);
  if (cast) for (const [dx, dy] of [[-2, 1], [-1, -2], [6, -1], [7, 3], [-2, 6], [3, -3], [7, 7], [-1, 9]] as const) P(lx + dx, y0 + dy, 1, 1, dy % 2 ? glass : heart);
}

// ───────────────────────── the sheet ─────────────────────────

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

/** One sheet per Keeper: row 0 = facing down, row 1 = facing up; FRAMES cells each (PHONE_FRAME, CAST_FRAME). */
export function frontSheet(painter: KeeperPainter, staff = false): HTMLCanvasElement {
  const cache = staff ? staffSheets : sheets;
  let sheet = cache.get(painter);
  if (sheet) return sheet;
  const raw = document.createElement('canvas');
  raw.width = FRONT_W * FRAMES; raw.height = FRONT_H * 2;
  const c = raw.getContext('2d')!;
  const look = painter.look;
  const fig: Figure = { body: look?.body ?? 'sturdy', form: look?.form ?? 'masc', hair: look?.hair ?? 'cropped', face: look?.face ?? 'none', eyes: look?.eyes ?? 'round', garb: painter.garb ?? null };
  (['down', 'up'] as const).forEach((facing, row) => {
    for (let f = 0; f < FRAMES; f++) {
      c.save(); c.translate(0, row * FRONT_H);
      // Each cell clipped inside a 1px margin: its outline never reaches a neighbour.
      c.beginPath(); c.rect(f * FRONT_W + 1, 1, FRONT_W - 2, FRONT_H - 2); c.clip();
      paint(c, painter.colors, fig, facing, f, f * FRONT_W, staff, painter.gear);
      c.restore();
    }
  });
  // The volume pass (keeper-volume.ts): the figure lit round from the upper left.
  sheet = volumize(outline(raw));
  cache.set(painter, sheet);
  return sheet;
}

/** Which frame a moment shows: walking runs the four-step cycle, standing breathes. */
export function frontFrame(time: number, moving: boolean): number {
  if (moving) return 2 + Math.floor(time * 9) % 4;
  return Math.floor(time * 1.4) % 4 === 3 ? 1 : 0;
}

/**
 * The live part of a Keeper's worn looks over a front/back sheet frame (worn-fx.ts): glowing eyes flickering in a cowl,
 * a mask or a great helm's slit (facing the camera only), and each piece's few particles — embers off a crown, a censer's
 * smoke, motes, a mist wisp. (x0, y0) is where the frame's top-left was drawn, in the same pixels; `frame` the frame shown.
 */
export function drawWornFront(c: CanvasRenderingContext2D, painter: KeeperPainter, facing: Facing, frame: number, x0: number, y0: number, time: number, still: boolean): void {
  const gear = painter.gear;
  if (!gear) return;
  let any = false;
  for (const k in gear) { const L = gear[k as keyof KeeperGear]?.look; if (L && (L.fx || L.eyes)) { any = true; break; } }
  if (!any) return;
  const front = facing === 'down', pose = poseOf(frame), ht = HT + pose.u, tt = TT + pose.u;
  const head = gear.head?.look;
  if (front && head?.eyes) {
    const a = eyeFlicker(time, still, painter.key);
    // Where each shape's eyes are (keeper-front's own rows): the cowl's pips, the great helm's slit, the mask's holes.
    const spots = head.shape === 'cowl' ? [[5, 10, 2], [11, 10, 2]] : head.shape === 'great-helm' ? [[4, 6, 2], [12, 6, 2]] : head.shape === 'mask' ? [[4, 10, 3], [11, 10, 3]] : [];
    for (const [ex, ey, ew] of spots) eyeGlow(c, x0 + HX + ex, y0 + ht + ey, ew, 1, head.eyes, a);
  }
  const mx = (x: number, w: number) => (front ? x : FRONT_W - x - w);
  for (const slot of ['head', 'chest', 'hands', 'weapon', 'off-hand', 'trinket'] as const) {
    const L = gear[slot]?.look;
    if (!L?.fx) continue;
    let ox = C, oy = ht - 2, w = 14;
    if (slot === 'head' && (L.shape === 'cowl' || L.shape === 'hood')) { oy = ht + 4; w = 16; }
    else if (slot === 'chest') { oy = tt + 2; w = 12; }
    else if (slot === 'trinket') { oy = tt + 3; w = 2; }
    else if (slot === 'hands') { ox = mx(23, 1); oy = tt + 8; w = 3; }
    else if (slot === 'weapon') { ox = mx(23, 1); oy = gear.weapon!.kind === 'staff' ? 6 : tt - 4; w = 2; }
    else if (slot === 'off-hand') {
      const sw = gear['off-hand']!.kind === 'censer' ? [0, 0, -1, 0, 1, 0, 0, 0][frame] ?? 0 : 0;
      ox = mx(4 + sw, 1); oy = tt + 3 + pose.lArm + (gear['off-hand']!.kind === 'censer' ? 10 : 6); w = 4;
    }
    wornParticles(c, L.fx.kind, L.fx.color, x0 + ox, y0 + oy, w, time, still, painter.key + slot);
  }
}
