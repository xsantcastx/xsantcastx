/**
 * td-hd-keeper.ts — every Keeper and every townsperson in HD for the isometric angle (art direction "isometric B",
 * owner 2026-10-27; docs/handoff/hdchar/). The prototype's Ashguard (td-hd-art) proved the look; this paints any figure
 * from the same three inputs the classic painter reads (keeper-paint KeeperPainter: the look, the worn gear with the
 * class's kit standing in, the townsfolk's garb), so a worn helm, a cape, a blade or a shield layers on at every facing,
 * and the 29 named townsfolk keep their clothes.
 *
 * Six facings from four sheet rows (front, back, front turned a quarter right, back turned a quarter right; the two left
 * facings are mirrors). Frames: idle and a breath, a four-step walk, a three-frame attack (a melee swing, or a bow's
 * nock, draw and loose), a two-frame cast, a flinch, and a fall (kneel, down).
 *
 * Built with the sculptor (td-hd-sculpt): solid parts back to front, shaded round from the top left, one clean outline.
 * Each figure's sheet is baked lazily, one cell the first time it is shown, under a per-frame time budget (a cell that
 * cannot be baked yet borrows the nearest baked one), and figures are kept in a small least-recently-used cache: a
 * townsperson only ever grows its first six columns.
 */
import { Sculpt, mix, rampOf, type Mat, type Pt } from './td-hd-sculpt';
import { EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, type KeeperLook } from '../../shared/keeper-look/keeper-look.model';
import { RARITY_TRIM, STYLE_COLORS, pieceTwoHanded, type GearPiece, type KeeperGear, type WeaponKind } from '../../shared/keeper-look/keeper-gear';
import type { KeeperGarb } from '../../shared/keeper-look/npc-looks';
import { trimmed } from '../../shared/keeper-look/worn-look.model';

/** What a figure is painted from (a KeeperPainter satisfies it). */
export interface HdSource { readonly key: string; readonly look: KeeperLook; readonly gear: KeeperGear | null; readonly garb: KeeperGarb | null }

/** The sculpt's size; the cell is 2 px larger (the outline's margin). Feet at (ax, ay) in cell px. */
const SW = 96, SH = 124, CX = 48, FY = 118;
export const HD_FIG = { w: SW + 2, h: SH + 2, ax: CX + 1, ay: FY + 1 } as const;

/** Frames (sheet columns). */
export const HF = { idle: 0, breath: 1, walk: 2, wind: 6, strike: 7, follow: 8, raise: 9, release: 10, hit: 11, kneel: 12, down: 13 } as const;
const COLS_TOWN = 6, COLS_ALL = 14;
/** Rows: 0 front, 1 back, 2 front turned right (SE), 3 back turned right (NE). */
export type HdView = 0 | 1 | 2 | 3;

type Act = 'none' | 'wind' | 'strike' | 'follow' | 'raise' | 'release' | 'hit' | 'kneel' | 'down';
interface Pose { bob: number; step: number; lift: readonly [number, number]; swing: number; sway: number; breath: number; lean: number; act: Act }
const POSES: readonly Pose[] = [
  { bob: 0, step: 0, lift: [0, 0], swing: 0, sway: 0, breath: 0, lean: 0, act: 'none' },
  { bob: 0, step: 0, lift: [0, 0], swing: 0, sway: 1, breath: 1, lean: 0, act: 'none' },
  { bob: 0, step: 1, lift: [0, 2], swing: 1, sway: -1, breath: 0, lean: 0, act: 'none' },
  { bob: -2, step: 0, lift: [0, 4], swing: 0, sway: 0, breath: 0, lean: 0, act: 'none' },
  { bob: 0, step: -1, lift: [2, 0], swing: -1, sway: 1, breath: 0, lean: 0, act: 'none' },
  { bob: -2, step: 0, lift: [4, 0], swing: 0, sway: 0, breath: 0, lean: 0, act: 'none' },
  { bob: 0, step: .5, lift: [0, 0], swing: 0, sway: -1, breath: 1, lean: -2, act: 'wind' },
  { bob: 1, step: -.6, lift: [0, 0], swing: 0, sway: 2, breath: 0, lean: 3, act: 'strike' },
  { bob: 1, step: -.4, lift: [0, 0], swing: 0, sway: 1, breath: 0, lean: 2, act: 'follow' },
  { bob: -1, step: 0, lift: [0, 0], swing: 0, sway: 0, breath: 1, lean: 0, act: 'raise' },
  { bob: 0, step: .3, lift: [0, 0], swing: 0, sway: 1, breath: 0, lean: 1, act: 'release' },
  { bob: 1, step: 0, lift: [0, 0], swing: 0, sway: -2, breath: 0, lean: -3, act: 'hit' },
  { bob: 12, step: 0, lift: [0, 0], swing: 0, sway: -1, breath: 0, lean: -1, act: 'kneel' },
  { bob: 22, step: 0, lift: [0, 0], swing: 0, sway: 0, breath: 0, lean: 2, act: 'down' },
];

// ── Materials ──
const mats = new Map<string, Mat>();
type Stuff = 'cloth' | 'metal' | 'skin' | 'hair' | 'leather' | 'wood' | 'glow' | 'gem';
/** One material per colour and stuff (shared by every sculpt: the sculptor indexes materials by identity). */
function mat(hex: string, stuff: Stuff, bias = 0): Mat {
  const k = `${hex}|${stuff}|${bias}`;
  let m = mats.get(k);
  if (m) return m;
  switch (stuff) {
    case 'skin': m = { ramp: rampOf(hex, { cool: '#5a2a3a', deep: .55 }), round: 7, gain: .85 }; break;
    case 'hair': m = { ramp: rampOf(hex, { cool: '#120a14', warm: '#fff0d8', hi: .42 }), round: 3, gain: 1.1 }; break;
    case 'metal': m = { ramp: rampOf(hex, { cool: '#14142a', warm: '#ffffff', hi: .6 }), shine: true, round: 4, gain: 1.2 }; break;
    case 'leather': m = { ramp: rampOf(hex, { cool: '#1e0e10' }), round: 3, gain: 1 }; break;
    case 'wood': m = { ramp: rampOf(hex, { cool: '#24100c', hi: .4 }), round: 2, gain: .9 }; break;
    case 'glow': m = { ramp: [mix(hex, '#000000', .1), hex, mix(hex, '#ffffff', .25), mix(hex, '#ffffff', .45), mix(hex, '#ffffff', .65), mix(hex, '#ffffff', .85)], round: 2, gain: .4, soft: true }; break;
    case 'gem': m = { ramp: rampOf(hex, { cool: '#100818', warm: '#ffffff', hi: .7 }), shine: true, round: 2, gain: 1.3 }; break;
    default: m = { ramp: rampOf(hex, { cool: '#1a0a1c', warm: '#ffe0c0', hi: .35, deep: .6 }), round: 6, gain: .85 };
  }
  if (bias) m = { ...m, bias };
  mats.set(k, m);
  return m;
}
/** A worn look's three tones as a six-step ramp (its own deep, base and lit). */
function lookMat(deep: string, base: string, lit: string, stuff: Stuff): Mat {
  const k = `L${deep}${base}${lit}|${stuff}`;
  let m = mats.get(k);
  if (m) return m;
  const ramp = [mix(deep, '#120a18', .45), deep, mix(deep, base, .5), base, mix(base, lit, .55), lit];
  m = stuff === 'metal' ? { ramp, shine: true, round: 4, gain: 1.2 } : stuff === 'leather' ? { ramp, round: 3, gain: 1 } : { ramp, round: 6, gain: .85 };
  mats.set(k, m);
  return m;
}

const STEEL = '#9aa6b8', LEATHER = '#6a4028', BOOT = '#5a3424', BELT = '#3a2618', BRASS = '#d6a040', WOOD = '#7a4e2e';

/** A piece's tones: its own look's, else its fixed colour, else its realm's (metal leaning to steel so it reads lit). */
interface Tones { base: string; deep: string; lit: string; accent: string; sub: string; trim: string | null; glow: boolean; runes?: string; eyes?: string; shadow?: boolean; horns?: string; mantle?: string; seam?: string }
function tonesOf(p: GearPiece, metal: boolean): Tones {
  const L = p.look;
  if (L) return { base: L.base, deep: L.deep, lit: L.lit, accent: L.accent, sub: L.sub, trim: L.trim, glow: !!L.glow, runes: L.runes, eyes: L.eyes, shadow: L.shadow, horns: L.horns, mantle: L.mantle, seam: L.seam };
  const [sb, sa] = STYLE_COLORS[p.style];
  const base = p.color ?? (metal ? mix(sb, STEEL, .55) : sb);
  return {
    base, deep: mix(base, '#120a18', .4), lit: mix(base, '#ffffff', .35), accent: p.accent ?? sa, sub: mix(WOOD, base, .2),
    trim: trimmed(p.rarity) ? RARITY_TRIM[p.rarity] : null, glow: p.rarity === 'legendary' || p.rarity === 'mythic' || p.rarity === 'singular',
  };
}
const pieceMat = (t: Tones, p: GearPiece, stuff: Stuff): Mat => p.look ? lookMat(t.deep, t.base, t.lit, stuff) : mat(t.base, stuff);

// ── The figure, resolved once per source ──
type HeadShape = 'helm' | 'pyre' | 'open' | 'great' | 'hood' | 'cowl' | 'horned' | 'crown' | 'circlet' | 'mask';
type ChestShape = 'plate' | 'scale' | 'coat' | 'robe' | 'mantle' | 'cloak';
type Held = 'melee' | 'big' | 'pole' | 'bow' | 'cast' | 'tool';
interface Fig {
  fem: boolean; sw: number; hw: number;
  skin: Mat; skinHex: string; hair: Mat; hairHex: string; style: KeeperLook['hair']; eyes: KeeperLook['eyes']; eyeHex: string; mark: KeeperLook['face'];
  tunic: Mat; tunicHex: string; trimHex: string; trim: Mat; trousers: Mat;
  garb: KeeperGarb;
  head: { shape: HeadShape; m: Mat; dk: Mat; t: Tones } | null;
  chest: { shape: ChestShape; m: Mat; dk: Mat; t: Tones } | null;
  cape: Mat | null; capeIn: Mat | null;
  gaunt: Mat | null; wrap: Mat | null; greaves: Mat | null;
  feet: { m: Mat; shape: 'boots' | 'greaves' | 'sandals' };
  weapon: { kind: WeaponKind; blade: Mat; haft: Mat; t: Tones; variant?: GearPiece['variant']; two: boolean } | null;
  off: { kind: string; m: Mat; sub: Mat; t: Tones } | null;
  held: Held;
  glowEyes: string | null; bothEyes: boolean; undead: boolean;
}

const BUILD = { slight: { sw: 14.5, hw: 13 }, sturdy: { sw: 16.5, hw: 14 }, broad: { sw: 19, hw: 15.5 } } as const;

function figOf(src: HdSource): Fig {
  const look = src.look, garb = src.garb ?? {}, gear = src.gear ?? {};
  const skinHex = garb.skin ?? SKIN_TONES[look.skin] ?? SKIN_TONES[2];
  const hairHex = garb.hair ?? HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[2];
  const tunicHex = garb.tunic ?? OUTFIT_COLORS[look.outfit] ?? OUTFIT_COLORS[0];
  const trimHex = garb.trim ?? OUTFIT_COLORS[look.trim] ?? OUTFIT_COLORS[4];
  const trousersHex = garb.trousers ?? mix(trimHex, '#2a2230', .45);
  const b = BUILD[look.body] ?? BUILD.sturdy, fem = look.form === 'fem';
  const f: Fig = {
    fem, sw: b.sw - (fem ? 1.5 : 0), hw: b.hw + (fem ? 2 : 0),
    skin: mat(skinHex, 'skin'), skinHex, hair: mat(hairHex, 'hair'), hairHex, style: look.hair, eyes: look.eyes, eyeHex: EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0], mark: look.face,
    tunic: mat(tunicHex, 'cloth'), tunicHex, trimHex, trim: mat(trimHex, 'cloth'), trousers: mat(trousersHex, 'cloth'),
    garb, head: null, chest: null, cape: null, capeIn: null, gaunt: null, wrap: null, greaves: null,
    feet: { m: mat(BOOT, 'leather'), shape: 'boots' }, weapon: null, off: null, held: 'tool',
    glowEyes: garb.eyeGlow ?? null, bothEyes: false, undead: false,
  };
  const hd = gear.head;
  if (hd) {
    const ls = hd.look?.shape;
    let shape: HeadShape = hd.kind === 'hood' ? 'hood' : hd.kind === 'crown' ? 'crown' : hd.kind === 'circlet' ? 'circlet'
      : hd.variant === 'pyre' ? 'pyre' : hd.rarity === 'common' || hd.rarity === 'uncommon' ? 'helm' : 'open';
    if (ls === 'open-helm') shape = 'open'; else if (ls === 'great-helm') shape = 'great';
    else if (ls === 'hood' || ls === 'cowl' || ls === 'horned' || ls === 'crown' || ls === 'circlet' || ls === 'mask') shape = ls;
    const metal = shape === 'helm' || shape === 'pyre' || shape === 'open' || shape === 'great' || shape === 'horned' || shape === 'crown' || shape === 'circlet';
    const t = tonesOf(hd, metal), m = pieceMat(t, hd, metal ? 'metal' : 'cloth');
    f.head = { shape, m, dk: mat(t.deep, metal ? 'metal' : 'cloth'), t };
    if (t.eyes) { f.glowEyes = t.eyes; }
  }
  const ch = gear.chest;
  if (ch) {
    const ls = ch.look?.shape;
    let shape: ChestShape = ch.kind === 'plate' ? 'plate' : ch.kind === 'robe' ? 'robe' : ch.kind === 'mantle' ? 'mantle' : 'coat';
    if (ls === 'plate' || ls === 'scale' || ls === 'robe' || ls === 'cloak') shape = ls; else if (ls === 'leather') shape = 'coat';
    const metal = shape === 'plate' || shape === 'scale';
    const t = tonesOf(ch, metal), m = pieceMat(t, ch, metal ? 'metal' : 'cloth');
    f.chest = { shape, m, dk: mat(t.deep, metal ? 'metal' : 'cloth'), t };
    if (shape === 'cloak') { f.cape = m; f.capeIn = mat(t.deep, 'cloth', -.3); }
  }
  if (garb.cape) { f.cape = mat(garb.cape, 'cloth'); f.capeIn = mat(mix(garb.cape, '#0e0612', .45), 'cloth'); }
  const hn = gear.hands;
  if (hn) { const t = tonesOf(hn, hn.kind === 'gauntlet'); if (hn.kind === 'gauntlet' || hn.look?.shape === 'gauntlets') f.gaunt = pieceMat(t, hn, 'metal'); else f.wrap = pieceMat(t, hn, 'leather'); }
  if (gear.legs && (gear.legs.kind === 'greaves' || gear.legs.look?.shape === 'greaves')) f.greaves = pieceMat(tonesOf(gear.legs, true), gear.legs, 'metal');
  const ft = gear.feet;
  if (ft) {
    const sh = ft.look?.shape === 'greaves' ? 'greaves' : ft.look?.shape === 'sandals' ? 'sandals' : 'boots';
    const t = tonesOf(ft, sh === 'greaves');
    f.feet = { m: sh === 'greaves' ? pieceMat(t, ft, 'metal') : ft.color || ft.look ? pieceMat(t, ft, 'leather') : mat(BOOT, 'leather'), shape: sh };
  }
  // The Warlock carries his staff in every view (the classic front sheet's staff), worn or not.
  const undeadSkin = !!garb.eyeGlow && skinHex === '#a7b59a';
  const w = gear.weapon ?? (undeadSkin ? { slot: 'weapon', kind: 'staff', style: 'umbral', rarity: 'common', color: '#3a2a3e', accent: '#b06bff' } as GearPiece : undefined);
  if (w && w.kind !== 'shield') {
    const kind = w.kind as WeaponKind, t = tonesOf(w, true), tw = tonesOf(w, false);
    const blade = w.look ? lookMat(t.deep, mix(t.base, t.lit, .45), mix(t.lit, '#ffffff', .4), 'metal') : mat(mix('#c4ccd8', t.base, .3), 'metal');
    const haft = w.look ? mat(t.sub, 'wood') : mat(mix(WOOD, tw.base, .25), 'wood');
    f.weapon = { kind, blade, haft, t, variant: w.variant, two: pieceTwoHanded(w) };
  }
  const o = gear['off-hand'];
  if (o && !(f.weapon?.two && o.kind !== 'quiver')) {
    const metal = o.kind === 'shield' || o.kind === 'lantern' || o.kind === 'scales' || o.kind === 'censer';
    const t = tonesOf(o, metal);
    f.off = { kind: o.kind, m: pieceMat(t, o, metal ? 'metal' : o.kind === 'tome' || o.kind === 'scroll' || o.kind === 'cards' ? 'leather' : 'metal'), sub: mat(o.look ? t.sub : mix(WOOD, t.base, .2), 'wood'), t };
  }
  const wk = f.weapon?.kind;
  f.held = !wk ? 'tool'
    : wk === 'bow' || wk === 'crossbow' ? 'bow'
    : wk === 'staff' || wk === 'wand' ? 'cast'
    : wk === 'spear' || wk === 'halberd' || wk === 'rod' ? 'pole'
    : wk === 'greatsword' || wk === 'hammer' ? 'big'
    : wk === 'tongs' || wk === 'pickaxe' || wk === 'sickle' ? 'tool' : 'melee';
  // The undead Warlock (vocation-look WARLOCK_GARB): grey-green skin, a hood, eyes burning violet.
  f.undead = !!garb.eyeGlow && skinHex === '#a7b59a';
  f.bothEyes = !!f.head && (f.head.shape === 'hood' || f.head.shape === 'cowl' || f.head.shape === 'great' || f.head.shape === 'mask') || f.undead;
  return f;
}

// ── Geometry helpers ──
/** An ellipse's outline above the line y = cut (a helm's dome, a hair cap). */
function dome(cx: number, cy: number, rx: number, ry: number, cut: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI + i / 40 * Math.PI; pts.push([cx + Math.cos(a) * rx, Math.min(cy + Math.sin(a) * ry, cut)]); }
  const dx = rx * Math.sqrt(Math.max(0, 1 - ((cut - cy) / ry) ** 2));
  if (cut > cy) { pts.push([cx + dx, cut]); pts.push([cx - dx, cut]); } else { pts.push([cx + rx, Math.min(cut, cy)]); pts.push([cx - rx, Math.min(cut, cy)]); }
  return pts;
}
/** The elbow for a two-bone arm from shoulder `s` to hand `h` (upper arm a, forearm b), bent toward `side` and down. */
function elbow(s: Pt, h: Pt, a: number, b: number, side: number): Pt {
  const dx = h[0] - s[0], dy = h[1] - s[1], d = Math.max(1e-3, Math.hypot(dx, dy));
  if (d >= a + b - .5) return [s[0] + dx * a / (a + b), s[1] + dy * a / (a + b)];
  const x = (a * a - b * b + d * d) / (2 * d), y = Math.sqrt(Math.max(0, a * a - x * x));
  const ux = dx / d, uy = dy / d;
  // The two solutions either side of the line: take the one out to `side` (and down, when the arm hangs).
  const p1: Pt = [s[0] + ux * x - uy * y, s[1] + uy * x + ux * y], p2: Pt = [s[0] + ux * x + uy * y, s[1] + uy * x - ux * y];
  const score = (p: Pt) => (p[0] - (s[0] + h[0]) / 2) * side + (p[1] - (s[1] + h[1]) / 2) * .4;
  return score(p1) >= score(p2) ? p1 : p2;
}
const rad = (deg: number) => deg * Math.PI / 180;

// ── Hands and what they hold, per view and pose ──
interface Grip { hand: Pt; ang: number; off: Pt; behind: boolean; offUp: boolean }
/** Where the weapon hand is and which way what it holds points; where the other hand is. `side`: the weapon hand's side. */
function gripOf(f: Fig, view: HdView, q: Pose, side: number, sh: number): Grip {
  const back = view === 1 || view === 3, turned = view >= 2, b = q.bob, swing = q.swing;
  const sideW = side * (sh + 6);
  // Rest: the hand by the hip, what it holds raised up and a little out (a staff or a pole stands on the ground).
  let hand: Pt = [CX + sideW + (turned ? swing * 3 : 0) + q.lean * .5, 82 + b + (turned ? 0 : swing * 1.5)];
  let ang = f.held === 'pole' || f.held === 'cast' || f.held === 'bow' ? -90 + side * 4 : -90 + side * 12;
  let off: Pt = [CX - sideW - (turned ? swing * 3 : 0) + q.lean * .5, 82 + b - (turned ? 0 : swing * 1.5)];
  let behind = back, offUp = false;
  const a = q.act;
  if (a === 'wind' || a === 'strike' || a === 'follow') {
    if (f.held === 'bow') {
      // The bow: raised, drawn, loosed. Seen from the front it is canted so its curve reads.
      if (view === 0) { hand = [CX - 6, 64 + b]; ang = -60; off = [CX + (a === 'wind' ? 2 : 8), 66 + b]; behind = false; }
      else if (view === 2) { hand = [CX + sh + 10, 62 + b]; ang = -90; off = [CX + (a === 'strike' ? 2 : a === 'wind' ? 10 : 14), 62 + b]; behind = false; }
      else if (view === 1) { hand = [CX + 10, 56 + b]; ang = -120; off = [CX + 2, 62 + b]; offUp = true; }
      else { hand = [CX + sh + 8, 54 + b]; ang = -100; off = [CX + 8, 60 + b]; offUp = true; }
    } else {
      const S = view === 0 ? { wind: [-16, 56, -140], strike: [8, 80, 12], follow: [12, 88, 70] }
        : view === 2 ? { wind: [-10, 54, -150], strike: [20, 70, -8], follow: [16, 86, 55] }
        : view === 1 ? { wind: [18, 54, -50], strike: [-2, 50, -115], follow: [-14, 64, -170] }
        : { wind: [16, 52, -100], strike: [24, 60, -35], follow: [14, 74, 20] };
      const [hx, hy, an] = S[a];
      hand = [CX + hx, hy + b]; ang = an;
      behind = back ? true : a === 'wind';
      // Two hands on a big weapon: the other hand just below on the grip.
      if (f.weapon?.two || f.held === 'big') { const u = rad(ang); off = [hand[0] - Math.cos(u) * 6, hand[1] - Math.sin(u) * 6]; }
      else off = [CX - side * (sh + 4), 74 + b];
    }
  } else if (a === 'raise' || a === 'release') {
    // A cast: the weapon hand high (a staff upright), the other hand out with the light in it.
    const up = a === 'raise';
    hand = [CX + side * (up ? sh - 2 : sh + 2), (up ? 44 : 50) + b]; ang = up ? -90 : -90 + (view === 2 || view === 3 ? 25 : side * 20);
    off = view === 0 ? [CX - side * (up ? 6 : 14), (up ? 70 : 64) + b] : view === 2 ? [CX + sh + (up ? 4 : 12), (up ? 68 : 62) + b] : [CX - side * (sh + 6), (up ? 62 : 56) + b];
    offUp = true; behind = back;
  } else if (a === 'hit') {
    hand = [CX + side * (sh + 8), 74 + b]; ang = -90 + side * 40; off = [CX - side * (sh + 7), 72 + b]; offUp = true;
  } else if (a === 'kneel') {
    hand = [CX + side * (sh + 6), 86 + b]; ang = -90 + side * 70; off = [CX - side * (sh + 4), 84 + b];
  } else if (a === 'down') {
    hand = [CX + side * (sh + 10), 82 + b]; ang = side * 10 + 90 - side * 90; off = [CX - side * (sh + 8), 80 + b];
  }
  return { hand, ang, off, behind, offUp };
}

/** Paint what the weapon hand holds: its grip at `h`, pointing along `ang` (degrees, screen; −90 up). */
function weapon(s: Sculpt, f: Fig, h: Pt, ang: number, g: number, face: number): void {
  const w = f.weapon;
  if (!w) return;
  const u = rad(ang), ux = Math.cos(u), uy = Math.sin(u), nx = -uy, ny = ux;
  const P = (a: number, c: number): Pt => [h[0] + ux * a + nx * c, h[1] + uy * a + ny * c];
  const blade = (len: number, wd: number, from = 5) => {
    s.poly([P(from, wd), P(len - wd * 2.4, wd * .9), P(len, 0), P(len - wd * 2.4, -wd * .9), P(from, -wd)], w.blade, { g });
    for (let t = from + 4; t < len - wd * 3; t++) s.dot(...P(t, 0), w.blade.ramp[1]);
    for (let t = from + 3; t < len - wd * 2; t++) s.dot(...P(t, wd * .55), w.blade.ramp[5]);
  };
  const grip = (a0: number, a1: number, r = 2.2) => s.limb(P(a0, 0), P(a1, 0), r, r, w.haft, { g: g + 2 });
  const brass = mat(w.t.trim ?? BRASS, 'metal');
  const accent = w.t.accent;
  const gem = (a: number, c: number, r: number) => s.ellipse(...P(a, c), r, r, mat(accent, 'gem'), { g: g + 5 });
  switch (w.kind) {
    case 'sword': case 'dagger': case 'greatsword': {
      const big = w.kind === 'greatsword', small = w.kind === 'dagger';
      const L = big ? 62 : small ? 24 : 50, W = big ? 3.8 : small ? 2.4 : 2.9, gw = big ? 10 : small ? 4.5 : 7.5;
      blade(L, W);
      s.limb(P(4, gw), P(4, -gw), 2, 2, brass, { g: g + 1 });
      grip(-1, big ? -11 : -6);
      s.ellipse(...P(big ? -13.5 : -8.5, 0), 2.6, 2.6, brass, { g: g + 3 });
      if (w.t.runes) for (let t = 12; t < L - 12; t += 9) s.dot(...P(t, 0), w.t.runes);
      if (w.t.glow) for (let t = 8; t < L - 6; t += 3) s.dot(...P(t, -W * .8), mix(accent, '#ffffff', .4));
      return;
    }
    case 'axe': case 'pickaxe': case 'hammer': case 'mace': case 'sickle': case 'tongs': {
      const top = w.kind === 'hammer' ? 44 : w.kind === 'mace' ? 34 : w.kind === 'sickle' || w.kind === 'tongs' ? 8 : 40;
      if (w.kind === 'tongs') { s.limb(P(-4, 1.5), P(30, 2.5), 1.5, 1.2, w.blade, { g }); s.limb(P(-4, -1.5), P(30, -.5), 1.5, 1.2, w.blade, { g: g + 1 }); return; }
      grip(-8, top, w.kind === 'hammer' ? 2.2 : 1.9);
      if (w.kind === 'axe') {
        s.poly([P(top - 12, 1.5), P(top - 15, 12 * face), P(top - 6, 14 * face), P(top + 2, 11 * face), P(top - 1, 1.5)], w.blade, { g: g + 3 });
        s.poly([P(top - 9, -1.5), P(top - 7, -6 * face), P(top - 4, -1.5)], w.blade, { g: g + 4 });
      } else if (w.kind === 'pickaxe') {
        s.stroke([P(top - 2, -15), P(top + 2, -6), P(top + 2, 6), P(top - 2, 15)], 2.6, 1.4, w.blade, { g: g + 3 });
      } else if (w.kind === 'hammer') {
        s.poly([P(top - 10, -10), P(top + 1, -10), P(top + 1, 10), P(top - 10, 10)], w.blade, { g: g + 3 });
        s.limb(P(top - 5, -10.5), P(top - 5, 10.5), 1.4, 1.4, brass, { g: g + 4 });
      } else if (w.kind === 'mace') {
        s.ellipse(...P(top + 2, 0), 6.5, 6.5, w.blade, { g: g + 3 });
        for (const [a, c] of [[0, 7.5], [0, -7.5], [8.5, 0], [5, 5.5], [5, -5.5]] as const) s.ellipse(...P(top + 2 + a, c), 2, 2, w.blade, { g: g + 4 });
      } else {
        s.stroke([P(top, 0), P(top + 10, 3 * face), P(top + 18, 0), P(top + 20, -6 * face)], 2.2, 1, w.blade, { g: g + 3 });
      }
      if (w.t.trim || w.t.glow) gem(top - 4, 0, 1.6);
      return;
    }
    case 'staff': {
      grip(-32, 46, 1.9);
      if (w.variant === 'lamp') {
        // The lamp-staff: a brass crook, the lantern hung from it, lit.
        s.stroke([P(44, 0), P(52, 2 * face), P(54, 8 * face), P(50, 12 * face)], 1.8, 1.5, brass, { g: g + 3 });
        s.line(P(50, 12 * face), P(44, 12 * face), w.blade.ramp[1]);
        lantern(s, P(43, 12 * face), w.blade, accent, g + 4);
        return;
      }
      s.stroke([P(44, 4), P(52, 5), P(56, 2)], 1.6, 1.2, w.haft, { g: g + 3 });
      s.stroke([P(44, -4), P(52, -5), P(56, -2)], 1.6, 1.2, w.haft, { g: g + 3 });
      s.ellipse(...P(51, 0), 4.6, 4.6, mat(accent, 'glow'), { g: g + 4 });
      s.dot(...P(52, 1.5), '#ffffff');
      s.limb(P(43, -4), P(43, 4), 1.4, 1.4, brass, { g: g + 5 });
      return;
    }
    case 'wand': {
      s.limb(P(-3, 0), P(20, 0), 1.6, 1.2, w.haft, { g });
      s.ellipse(...P(22, 0), 2.8, 2.8, mat(accent, 'glow'), { g: g + 1 });
      return;
    }
    case 'spear': case 'halberd': case 'rod': {
      const top = w.kind === 'rod' ? 66 : 52;
      grip(-28, top, w.kind === 'rod' ? 1.2 : 1.7);
      if (w.kind === 'spear') s.poly([P(top - 2, 2.5), P(top + 6, 3.4), P(top + 15, 0), P(top + 6, -3.4), P(top - 2, -2.5)], w.blade, { g: g + 3 });
      else if (w.kind === 'halberd') {
        s.poly([P(top - 12, 1.5), P(top - 14, 11 * face), P(top - 2, 12 * face), P(top, 1.5)], w.blade, { g: g + 3 });
        s.poly([P(top - 1, 1.6), P(top + 12, 0), P(top - 1, -1.6)], w.blade, { g: g + 4 });
      } else s.limb(P(top - 2, 0), P(top + 2, 0), 1, 1, brass, { g: g + 3 });
      return;
    }
    case 'bow': case 'crossbow': {
      if (w.kind === 'crossbow') {
        s.limb(P(-6, 0), P(18, 0), 2.4, 2.2, w.haft, { g });
        s.stroke([P(12, -13), P(17, -6), P(18, 0), P(17, 6), P(12, 13)], 1.8, 1.8, w.blade, { g: g + 1 });
        s.line(P(12, -12), P(12, 12), '#e8e0d0');
        return;
      }
      // The bow: its limbs curving out toward where it faces, a taut string, the grip in the fist.
      const bend = 7 * face;
      s.stroke([P(-27, bend * .2), P(-18, bend * .9), P(-6, bend), P(0, bend * .9), P(6, bend), P(18, bend * .9), P(27, bend * .2)], 2.1, 2.1, w.haft, { g });
      s.ellipse(...P(-27.5, bend * .2), 1.7, 1.7, mat(accent, 'gem'), { g: g + 1 }); s.ellipse(...P(27.5, bend * .2), 1.7, 1.7, mat(accent, 'gem'), { g: g + 1 });
      s.line(P(-27, bend * .2), P(27, bend * .2), '#ece4d2');
      return;
    }
  }
}

/** A lantern hung at `p` (its ring): iron cage, lit glass, a little cap. */
function lantern(s: Sculpt, p: Pt, frame: Mat, light: string, g: number): void {
  const [x, y] = p;
  s.limb([x, y], [x, y + 3], .9, .9, frame, { g });
  s.poly([[x - 4, y + 3], [x + 4, y + 3], [x + 5, y + 6], [x - 5, y + 6]], frame, { g: g + 1 });
  s.rect(x - 4, y + 6, 8, 8, mat(light, 'glow'), { g: g + 2 });
  s.line([x - 4, y + 6], [x - 4, y + 13], frame.ramp[1]); s.line([x + 3, y + 6], [x + 3, y + 13], frame.ramp[1]);
  s.poly([[x - 5, y + 14], [x + 5, y + 14], [x + 4, y + 16], [x - 4, y + 16]], frame, { g: g + 3 });
  s.dot(x - 1, y + 8, '#fffbe8', 2, 3);
}

/** The off-hand thing, at the other hand `h` (a shield faces the camera, or turns with the body). */
function offhand(s: Sculpt, f: Fig, h: Pt, view: HdView, g: number, up: boolean): void {
  const o = f.off;
  if (!o) return;
  const back = view === 1 || view === 3, turned = view >= 2, [x, y] = h;
  switch (o.kind) {
    case 'shield': {
      // A heater shield on the forearm: its face (the realm's colour), a brass rim, a boss in the accent; from behind its planks and straps.
      const sx = turned ? .62 : 1, cx = x + (back ? -1 : 1) * (turned ? 0 : 2), cy = y - 4, W = 11 * sx, H = 14;
      const outline: Pt[] = [[cx - W, cy - H], [cx + W, cy - H], [cx + W, cy - H * .1], [cx + W * .55, cy + H * .65], [cx, cy + H], [cx - W * .55, cy + H * .65], [cx - W, cy - H * .1]];
      s.poly(outline, mat(o.t.trim ?? BRASS, 'metal'), { g });
      const inner = outline.map(([px, py]) => [cx + (px - cx) * .8, cy + (py - cy) * .82] as Pt);
      s.poly(inner, back ? mat(WOOD, 'wood') : o.m, { g: g + 1 });
      if (back) { s.line([cx - W * .7, cy - 4], [cx + W * .7, cy - 4], mat(LEATHER, 'leather').ramp[1]); s.line([cx - W * .7, cy + 3], [cx + W * .7, cy + 3], mat(LEATHER, 'leather').ramp[1]); }
      else {
        s.ellipse(cx, cy - 1, 3.4 * sx + .6, 3.4, mat(o.t.accent, 'gem'), { g: g + 2 });
        s.lineOn([cx, cy - H * .7], [cx, cy + H * .7], o.m.ramp[1]);
      }
      return;
    }
    case 'lantern': lantern(s, [x, y - (up ? 4 : -2)], o.m, o.t.accent, g); return;
    case 'orb': s.ellipse(x, y - 6, 5, 5, mat(o.t.accent, 'glow'), { g }); s.dot(x - 2, y - 8, '#ffffff', 2, 1); return;
    case 'tome': case 'scroll': case 'cards': {
      if (o.kind === 'scroll') { s.limb([x - 6, y - 2], [x + 6, y - 2], 2.6, 2.6, mat('#e8dcc0', 'cloth'), { g }); s.ellipse(x + 6, y - 2, 2, 2.8, o.sub, { g: g + 1 }); return; }
      if (o.kind === 'cards') { for (let i = -2; i <= 2; i++) s.poly([[x + i * 2 - 2, y - 8], [x + i * 2 + 2, y - 8], [x + i * 2.4 + 2, y], [x + i * 2.4 - 2, y]], mat(i % 2 ? '#e8e0d0' : '#c83a4a', 'cloth'), { g: g + i + 2 }); return; }
      s.poly([[x - 6, y - 10], [x + 6, y - 9], [x + 6, y + 4], [x - 6, y + 3]], o.m, { g });
      s.rect(x - 4, y - 8, 9, 2, mat('#f0e6cc', 'cloth'), { g: g + 1 });
      s.dot(x - 1, y - 4, o.t.accent, 2, 2);
      return;
    }
    case 'scales': {
      s.limb([x, y - 14], [x, y], 1, 1, o.m, { g });
      s.limb([x - 8, y - 12], [x + 8, y - 12], 1, 1, o.m, { g: g + 1 });
      s.ellipse(x - 8, y - 6, 3.5, 1.6, o.m, { g: g + 2 }); s.ellipse(x + 8, y - 6, 3.5, 1.6, o.m, { g: g + 3 });
      return;
    }
    case 'censer': case 'crucible': {
      if (o.kind === 'censer') s.line([x, y], [x, y + 6], o.m.ramp[1]);
      const cy = o.kind === 'censer' ? y + 10 : y - 3;
      s.ellipse(x, cy, 5, 4.5, o.m, { g });
      s.ellipse(x, cy - 3, 3.6, 1.6, mat(o.t.accent, 'glow'), { g: g + 1 });
      return;
    }
    case 'quiver': return;
    default: {
      // A second weapon (a dagger in the off-hand): small, point down.
      s.poly([[x - 1.8, y + 3], [x + 1.8, y + 3], [x, y + 18]], mat('#c4ccd8', 'metal'), { g });
      s.limb([x - 4, y + 2], [x + 4, y + 2], 1.4, 1.4, mat(BRASS, 'metal'), { g: g + 1 });
    }
  }
}

// ── The figure ──
function sculpt(f: Fig, view: HdView, fr: number): HTMLCanvasElement {
  const q = POSES[fr], s = new Sculpt(SW, SH);
  const back = view === 1 || view === 3, turned = view >= 2, front = !back;
  const a = q.act, down = a === 'down', kneel = a === 'kneel';
  const b = q.bob, br = q.breath, ln = q.lean * (turned ? 1 : .4);
  const cx = CX + ln + (turned ? 1 : 0), sw = f.sw * (turned ? .8 : 1), hw = f.hw * (turned ? .82 : 1);
  // The weapon hand: the right hand — the viewer's left from the front, the viewer's right from behind.
  const side = front ? -1 : 1;
  const hc = cx + (turned ? 2.5 : 0) + (down ? 6 : 0), hy = 38 + b + (a === 'hit' ? 1 : 0) + (down ? 4 : 0);
  const grip = gripOf(f, view, q, side, sw);
  const robe = f.chest?.shape === 'robe', coat = f.chest?.shape === 'coat', plate = f.chest?.shape === 'plate' || f.chest?.shape === 'scale';
  const sleeve = f.chest && (robe || coat || f.chest.shape === 'cloak') ? f.chest.m : f.tunic;
  const sleeveB = plate ? f.chest!.m : sleeve;
  const sway = q.sway + (turned ? -2 : 0) * (front ? 1 : -1);
  const tall = f.garb.elder ? 1 : 0;

  // ── Behind everything ──
  // Aureth's dawn-glass shards fanned behind the head (never a halo).
  if (f.garb.shards) for (const [ang, len, w, k] of [[-145, 30, 4.5, 0], [-90, 36, 5, 1], [-35, 30, 4.5, 2], [-118, 22, 3.5, 3], [-62, 22, 3.5, 4]] as const) {
    const u = rad(ang), ux = Math.cos(u), uy = Math.sin(u), nx = -uy, ny = ux, x0 = hc + ux * 12, y0 = hy - 6 + uy * 12;
    s.poly([[x0, y0], [x0 + ux * len * .45 + nx * w, y0 + uy * len * .45 + ny * w], [x0 + ux * len, y0 + uy * len], [x0 + ux * len * .45 - nx * w, y0 + uy * len * .45 - ny * w]], mat(k % 2 ? '#ffe28a' : '#fff1b0', 'gem'), { g: 1 + k });
  }
  // The cape from the front: its lining behind the legs, the outer folds either side.
  const ys = 55 + b; // the shoulder line
  if (f.cape && front && !down) {
    const hem = (kneel ? 112 : 110) + Math.min(b, 0);
    s.poly([[cx - sw, ys], [cx + sw, ys], [cx + sw + 10 + sway, hem - 4], [cx + sw - 2 + sway, hem], [cx, hem - 3], [cx - sw + 2 + sway, hem], [cx - sw - 10 + sway, hem - 4]], f.capeIn!, { g: 2 });
    s.poly([[cx - sw - 2, ys + 4], [cx - sw + 5, ys + 10], [cx - sw + 2 + sway, hem - 2], [cx - sw - 11 + sway, hem - 4]], f.cape, { g: 3 });
    if (!turned) s.poly([[cx + sw + 2, ys + 4], [cx + sw - 5, ys + 10], [cx + sw - 2 + sway, hem - 2], [cx + sw + 11 + sway, hem - 4]], f.cape, { g: 4, bias: -.4 });
    s.lineOn([cx - sw - 4 + sway * .5, ys + 20], [cx - sw - 7 + sway, hem - 6], f.cape.ramp[1]);
    s.lineOn([cx + sw + 4 + sway * .5, ys + 20], [cx + sw + 7 + sway, hem - 6], f.capeIn!.ramp[1]);
  }
  // A quiver on the back seen from the front: the fletchings over the off shoulder.
  if (f.garb.quiver && front) {
    const qx = cx - side * (sw - 4), qy = ys - 6;
    s.limb([qx, qy + 8], [qx + 5, qy - 4], 3.4, 3.2, mat(f.garb.quiver, 'leather'), { g: 5 });
    for (const [dx, dy] of [[2, -8], [5, -9], [8, -7]] as const) s.poly([[qx + dx, qy + dy], [qx + dx + 2, qy + dy - 5], [qx + dx + 3.5, qy + dy]], mat('#6eae52', 'cloth'), { g: 6 });
  }
  // A sack over the back shoulder (seen from the front: its bulge past the shoulder).
  if (f.garb.sack && front) s.ellipse(cx - side * (sw + 2), ys - 1, 7, 8, mat(f.garb.sack, 'cloth'), { g: 7 });
  // Back-hanging hair behind the head (long, braid, ponytail, pigtails, bob).
  if (front) backHair(s, f, hc, hy, turned, 8);

  // The weapon when it is behind the body (raised behind the head; everything seen from behind).
  const wf = (f.held === 'bow' || f.weapon?.variant === 'lamp') && (a === 'none' || a === 'hit') ? (turned ? 1 : side) : turned ? 1 : -side;
  const wg = 300, armW = (g: number) => arm(s, f, [cx + side * (sw + 1), ys + 4 - br], grip.hand, sleeveB, g, side, !!f.weapon || f.held === 'cast' && !!f.weapon);
  if (grip.behind && a !== 'down') { weapon(s, f, grip.hand, grip.ang, wg - 200, wf); }
  // The far arm (the off-hand's) and its thing when it hangs behind the body (turned: the off side is far).
  const offShoulder: Pt = [cx - side * (sw + 1), ys + 4 - br];
  const offFar = turned && front || (turned && back);
  if (offFar) {
    arm(s, f, offShoulder, grip.off, f.garb.oneHand ? null : sleeveB, 20, -side, false);
    if (f.off?.kind === 'shield' || !grip.offUp) offhand(s, f, grip.off, view, 26, grip.offUp);
  }
  if (back) {
    // From behind, the weapon arm and the off arm before the cape and the body.
    if (!grip.offUp) arm(s, f, offShoulder, grip.off, f.garb.oneHand ? null : sleeveB, 22, -side, false);
    if (a === 'none' || a === 'kneel' || a === 'down') armW(24);
  }

  // ── Legs ──
  legs(s, f, view, q, cx, hw, robe || !!f.garb.apron && false, 30);
  // ── The body ──
  torso(s, f, view, q, cx, sw, hw, ys, br, 60);
  if (back) {
    // The cape over the back (folds, a collar roll), or the quiver's tube.
    if (f.cape && !down) {
      const hem = 110 + Math.min(b, 0);
      s.poly([[cx - sw - 1, ys - 4], [cx + sw + 1, ys - 4], [cx + sw + 9 + sway, hem - 4], [cx + 9 + sway, hem], [cx - 9 + sway, hem], [cx - sw - 9 + sway, hem - 4]], f.cape, { g: 90 });
      for (const fx of [-9, 0, 9]) s.poly([[cx + fx - 1, ys + 10], [cx + fx + 1, ys + 10], [cx + fx * 1.4 + 2.5 + sway, hem - 3], [cx + fx * 1.4 - 2.5 + sway, hem - 3]], f.capeIn!, { g: 91 + fx });
      s.ellipse(cx, ys - 4, sw - 2, 5, f.cape, { g: 102 });
    }
    if (f.garb.quiver) {
      const qm = mat(f.garb.quiver, 'leather');
      s.limb([cx - 8, ys + 26], [cx + 8, ys - 4], 4, 3.6, qm, { g: 104 });
      for (const [dx, dy] of [[5, -9], [8, -10], [11, -7]] as const) s.poly([[cx + dx, ys + dy], [cx + dx + 2, ys + dy - 5], [cx + dx + 3.5, ys + dy]], mat('#6eae52', 'cloth'), { g: 105 });
    }
    if (f.garb.sack) s.ellipse(cx + side * 6, ys + 8, 9, 10, mat(f.garb.sack, 'cloth'), { g: 106 });
    // Shoulders over the cape: pauldrons, or a mantle.
    shoulders(s, f, cx, sw, ys, br, 110, view);
    if (grip.offUp) arm(s, f, offShoulder, grip.off, f.garb.oneHand ? null : sleeveB, 112, -side, false);
    if (!(a === 'none' || a === 'kneel' || a === 'down')) armW(114);
    if (!offFar && f.off && f.off.kind !== 'quiver') offhand(s, f, grip.off, view, 116, grip.offUp);
  } else {
    shoulders(s, f, cx, sw, ys, br, 110, view);
    // The off arm in front (square on) and what it carries.
    if (!offFar) {
      arm(s, f, offShoulder, grip.off, f.garb.oneHand ? null : sleeveB, 120, -side, false);
      offhand(s, f, grip.off, view, 126, grip.offUp);
    } else if (f.off && f.off.kind !== 'shield' && grip.offUp) offhand(s, f, grip.off, view, 126, grip.offUp);
    // The cast's light in the open hand.
    if ((a === 'raise' || a === 'release') && !f.off) castLight(s, f, grip.off, a === 'release', 128);
  }
  // A cast's light from behind sits over the hand too.
  if (back && (a === 'raise' || a === 'release') && !f.off) castLight(s, f, grip.off, a === 'release', 129);

  // ── The head ──
  head(s, f, view, q, hc, hy - tall, cx, 140);
  // ── The weapon arm in front, and the weapon ──
  if (front) {
    if (!grip.behind && a !== 'down') weapon(s, f, grip.hand, grip.ang, wg, wf);
    armW(wg + 20);
    if (a === 'strike' && f.held !== 'bow' && f.held !== 'cast' && f.weapon) smear(s, f, view, b, wg + 30);
    if (f.held === 'bow' && (a === 'wind' || a === 'strike')) arrow(s, f, grip, wg + 25);
  } else if (f.held === 'bow' && (a === 'wind' || a === 'strike')) arrow(s, f, grip, wg + 25);
  if (down && f.weapon) weapon(s, f, [cx - 22, 116], -8, wg + 40, 1);
  // The Archivist's book, open at his shoulder.
  if (f.garb.book && !down) {
    const bx = cx + (front ? 24 : -24), by = ys - 6 + Math.round(Math.sin(fr) * 1);
    s.poly([[bx - 8, by], [bx, by + 2], [bx + 8, by], [bx + 8, by - 7], [bx, by - 5], [bx - 8, by - 7]], mat('#f0e6cc', 'cloth'), { g: 400 });
    s.line([bx, by - 5], [bx, by + 2], '#8a7a58');
  }
  return s.render();
}

/** Two-bone arm from the shoulder to the hand: a sleeve, a cuff or gauntlet, the hand. `sl` null: the hand is gone. */
function arm(s: Sculpt, f: Fig, sh: Pt, hand: Pt, sl: Mat | null, g: number, side: number, holding: boolean): void {
  const e = elbow(sh, hand, 12, 12.5, side);
  s.limb(sh, e, 5.2, 4.8, sl ?? f.tunic, { g });
  if (!sl) { s.limb(e, [e[0] + (hand[0] - e[0]) * .4, e[1] + (hand[1] - e[1]) * .4], 4.6, 4.2, f.tunic, { g: g + 1 }); return; }
  const fore = f.gaunt ?? (f.chest?.shape === 'plate' ? f.chest.m : f.wrap ?? sl);
  s.limb(e, [hand[0] + (e[0] - hand[0]) * .18, hand[1] + (e[1] - hand[1]) * .18], 4.8, 4.3, fore, { g: g + 1 });
  if (f.wrap && !f.gaunt) for (let t = .3; t < .9; t += .2) { const x = e[0] + (hand[0] - e[0]) * t, y = e[1] + (hand[1] - e[1]) * t; s.lineOn([x - 4, y - 1], [x + 4, y + 1], f.wrap.ramp[1]); }
  s.ellipse(hand[0], hand[1], holding ? 4.2 : 3.9, holding ? 4 : 3.8, f.gaunt ?? f.skin, { g: g + 2 });
}

/** The light a cast gathers in the open hand. */
function castLight(s: Sculpt, f: Fig, h: Pt, big: boolean, g: number): void {
  const c = f.weapon?.t.accent ?? f.glowEyes ?? f.trimHex;
  s.ellipse(h[0], h[1] - 4, big ? 6 : 4, big ? 6 : 4, mat(c, 'glow'), { g });
  s.dot(h[0] - 1, h[1] - 6, '#ffffff', 2, 2);
}

/** A swing's smear: a thin crisp arc of the blade's light across the strike (one frame; drawn over the body). */
function smear(s: Sculpt, f: Fig, view: HdView, b: number, g: number): void {
  const c = mix(f.weapon!.blade.ramp[5], '#ffffff', .3), m: Mat = { ramp: [c, c, c, c, c, c], round: 1, gain: 0, soft: true };
  const [x0, y0, r, a0, a1] = view === 0 ? [CX - 4, 70 + b, 30, 200, 330] : view === 2 ? [CX + 6, 66 + b, 30, 230, 360] : view === 1 ? [CX, 56 + b, 28, 300, 200] : [CX + 6, 56 + b, 28, 250, 340];
  const pts: Pt[] = [];
  const n = 10, dir = a1 > a0 ? 1 : -1;
  for (let i = 0; i <= n; i++) { const t = rad(a0 + (a1 - a0) * i / n); pts.push([x0 + Math.cos(t) * r, y0 + Math.sin(t) * r * .7]); }
  void dir;
  s.stroke(pts, .8, 2.2, m, { g });
}

/** The arrow on the string while the bow is drawn. */
function arrow(s: Sculpt, f: Fig, gp: Grip, g: number): void {
  const [hx, hy] = gp.hand, [ox, oy] = gp.off, dx = hx - ox, dy = hy - oy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const tip: Pt = [hx + ux * 10, hy + uy * 10];
  s.line([ox, oy], tip, '#8a6a3a');
  s.poly([[tip[0] + ux * 4, tip[1] + uy * 4], [tip[0] - uy * 2, tip[1] + ux * 2], [tip[0] + uy * 2, tip[1] - ux * 2]], mat('#c4ccd8', 'metal'), { g });
  s.dot(ox - ux * 2, oy - uy * 2, '#6eae52', 2, 2);
  void f;
}

function legs(s: Sculpt, f: Fig, view: HdView, q: Pose, cx: number, hw: number, _robe: boolean, g: number): void {
  const turned = view >= 2, back = view === 1 || view === 3, b = q.bob, a = q.act;
  if (a === 'down') {
    // Fallen: the legs folded out in front, the soles toward the camera.
    for (const side of [-1, 1] as const) {
      const x = cx + side * 9;
      s.limb([x, 100], [x + side * 3, 112], 6, 5.4, f.trousers, { g: g + side });
      s.ellipse(x + side * 4, 114, 6, 4, f.feet.m, { g: g + 4 + side });
    }
    return;
  }
  if (a === 'kneel') {
    // One knee down (the far one), the near foot planted.
    s.limb([cx + 7, 98], [cx + 9, 112], 6, 5, f.trousers, { g });
    s.ellipse(cx + 9, 114, 6, 3.6, f.trousers, { g: g + 1 });
    s.limb([cx - 7, 98], [cx - 12, 106], 6, 5.6, f.trousers, { g: g + 2 });
    s.limb([cx - 12, 106], [cx - 12, 114], 5.4, 5, f.greaves ?? f.trousers, { g: g + 3 });
    s.poly([[cx - 18, 110], [cx - 6, 110], [cx - 5, 118], [cx - 19, 118]], f.feet.m, { g: g + 4 });
    return;
  }
  const robeHide = f.chest?.shape === 'robe';
  for (const side of [-1, 1] as const) {
    // Turned: the stride runs across the picture; square on it is a lifted foot.
    const stride = turned ? q.step * 5 * side * (back ? -1 : 1) : q.step * side * .8;
    const lift = q.lift[side < 0 ? 0 : 1];
    const x = cx + side * (turned ? 5.5 : 7) + stride, top = 92 + b, foot = FY - lift;
    const bias = side > 0 ? -.3 : 0;
    if (!robeHide) {
      s.limb([x, top], [x + side * .4, foot - 9], 6, 5.2, f.trousers, { g: g + 10 + side, bias });
      if (f.greaves) { s.limb([x + side * .4, top + 10], [x + side * .4, foot - 9], 5.3, 5.1, f.greaves, { g: g + 14 + side, bias }); s.ellipse(x + side * .4, top + 9, 5, 3.4, f.greaves, { g: g + 16 + side }); }
    }
    // The foot: square on, a rounded toe toward the camera; turned, the toe points right; from behind, the heel.
    const toe = turned ? (back ? 3 : 5) : 0, m = f.feet.m;
    if (f.feet.shape === 'sandals') {
      s.poly([[x - 5, foot - 6], [x + 5, foot - 6], [x + 5.5 + toe, foot], [x - 5.5, foot]], f.skin, { g: g + 20 + side });
      s.lineOn([x - 5, foot - 3], [x + 5 + toe, foot - 3], mat(LEATHER, 'leather').ramp[1]);
      continue;
    }
    const cuff = f.feet.shape === 'greaves' ? 13 : 10;
    s.poly([[x - 5.5, foot - cuff], [x + 5.5, foot - cuff], [x + 6.2 + toe, foot - 3], [x + 5.5 + toe, foot], [x - 5.8, foot], [x - 6.2, foot - 3]], m, { g: g + 20 + side, bias });
    s.rect(x - 5.5, foot - cuff - 1, 11.5, 2, f.feet.shape === 'greaves' ? m : mat(LEATHER, 'leather'), { g: g + 24 + side });
    if (robeHide) s.ellipse(x + toe * .5, foot - 3, 6, 3, m, { g: g + 26 + side });
  }
}

/** The torso: tunic and belt, the chest piece over it, an apron, a sash. */
function torso(s: Sculpt, f: Fig, view: HdView, q: Pose, cx: number, sw: number, hw: number, ys: number, br: number, g: number): void {
  const b = q.bob, back = view === 1 || view === 3, turned = view >= 2, ch = f.chest, sh = ch?.shape;
  const waist = (f.fem ? sw - 3.5 : sw - 1.5), belt = 78 + b, hem = (sh === 'robe' ? 115 : sh === 'coat' ? 104 : 96) + Math.min(0, b) + (q.act === 'kneel' ? -2 : 0);
  // The tunic: shoulders rounded, the chest, the waist, the skirt flaring to the hips.
  s.poly([[cx - sw, ys + 3], [cx - sw + 4, ys - 1], [cx + sw - 4, ys - 1], [cx + sw, ys + 3], [cx + waist, belt], [cx + hw + 2, 96 + b], [cx + 6, 98 + b], [cx - 6, 98 + b], [cx - hw - 2, 96 + b], [cx - waist, belt]], f.tunic, { g });
  s.lineOn([cx - 6, belt + 4], [cx - 7, 96 + b], f.tunic.ramp[1]); s.lineOn([cx + 6, belt + 4], [cx + 7, 96 + b], f.tunic.ramp[1]);
  // The hem's trim.
  s.poly([[cx - hw - 2, 94.5 + b], [cx + hw + 2, 94.5 + b], [cx + hw + 2.3, 97 + b], [cx + 6, 99 + b], [cx - 6, 99 + b], [cx - hw - 2.3, 97 + b]], f.trim, { g: g + 1 });
  if (!back && !ch) {
    // A V collar in the trim.
    s.poly([[cx - 6, ys - 1], [cx + 6, ys - 1], [cx + (turned ? 2 : 0), ys + 8]], f.trim, { g: g + 2 });
    s.poly([[cx - 3.5, ys - 1], [cx + 3.5, ys - 1], [cx + (turned ? 2 : 0), ys + 4.5]], f.skin, { g: g + 3 });
  }
  if (ch) {
    const m = ch.m, t = ch.t;
    if (sh === 'robe' || sh === 'coat' || sh === 'cloak' && false) {
      // A robe to the ankles, or a coat to the knees: flaring, folds, a trim at the hem; a coat open over the tunic.
      const flare = sh === 'robe' ? hw + 6 : hw + 4;
      s.poly([[cx - sw - .5, ys + 3], [cx - sw + 4, ys - 1.5], [cx + sw - 4, ys - 1.5], [cx + sw + .5, ys + 3], [cx + waist + .5, belt], [cx + flare, hem], [cx - flare, hem], [cx - waist - .5, belt]], m, { g: g + 10 });
      for (const dx of [-.55, -.2, .25, .6]) s.lineOn([cx + dx * waist, belt + 4], [cx + dx * flare * 1.1, hem - 2], m.ramp[1]);
      const tr = mat(t.trim ?? t.accent, sh === 'robe' ? 'cloth' : 'metal');
      s.poly([[cx - flare, hem - 2.5], [cx + flare, hem - 2.5], [cx + flare + .3, hem], [cx - flare - .3, hem]], tr, { g: g + 11 });
      if (!back) {
        if (sh === 'coat') {
          // Open down the front: the tunic shows; lapels; brass buttons.
          s.poly([[cx - 3, ys], [cx + 3, ys], [cx + 4, belt], [cx + 6, hem], [cx - 6, hem], [cx - 4, belt]], f.tunic, { g: g + 12 });
          s.poly([[cx - 7, ys - 1], [cx - 2, ys - 1], [cx - 2, ys + 12]], m, { g: g + 13, bias: .6 }); s.poly([[cx + 7, ys - 1], [cx + 2, ys - 1], [cx + 2, ys + 12]], m, { g: g + 14, bias: -.3 });
          for (const y of [ys + 9, ys + 15]) { s.dot(cx - 5, y, t.accent, 2, 2); s.dot(cx + 4, y, t.accent, 2, 2); }
        } else {
          s.poly([[cx - 6, ys - 1], [cx + 6, ys - 1], [cx + (turned ? 2 : 0), ys + 7]], tr, { g: g + 12 });
          s.poly([[cx - 3.5, ys - 1], [cx + 3.5, ys - 1], [cx + (turned ? 2 : 0), ys + 4]], f.skin, { g: g + 13 });
          if (t.runes) for (let y = belt + 6; y < hem - 6; y += 7) s.dot(cx - 1, y, t.runes, 2, 3);
        }
      }
      if (t.seam) s.lineOn([cx + (turned ? 2 : 0), ys + 8], [cx + (turned ? 2 : 0), hem - 3], t.seam);
    } else if (sh === 'plate' || sh === 'scale') {
      // The breastplate over a gambeson; faulds over the skirt; scale rows on a scale coat.
      s.poly([[cx - sw + 2, ys - br], [cx + sw - 2, ys - br], [cx + sw - 3, ys + 11], [cx + waist - 2, belt - 3], [cx - waist + 2, belt - 3], [cx - sw + 3, ys + 11]], m, { g: g + 10 });
      if (!back) s.lineOn([cx + (turned ? 2.5 : 0), ys + 2 - br], [cx + (turned ? 2.5 : 0), belt - 4], m.ramp[2]);
      for (let i = 0; i < 2; i++) s.poly([[cx - hw - 1 + i, belt + 3 + i * 6], [cx + hw + 1 - i, belt + 3 + i * 6], [cx + hw + 1.5 - i, belt + 9 + i * 6], [cx - hw - 1.5 + i, belt + 9 + i * 6]], m, { g: g + 11 + i });
      if (sh === 'scale') for (let y = ys + 4; y < belt - 4; y += 4) for (let x = -sw + 5 + (y % 8 ? 2 : 0); x < sw - 4; x += 4) s.dot(cx + x, y, m.ramp[1], 2, 1);
      if (t.trim) s.lineOn([cx - sw + 3, ys + 1 - br], [cx + sw - 3, ys + 1 - br], t.trim);
      if (t.runes && !back) for (let y = ys + 5; y < belt - 4; y += 6) s.dot(cx - 1, y, t.runes, 2, 2);
    } else if (sh === 'cloak') {
      if (!back) { s.ellipse(cx - 6, ys + 1, 2.6, 2.6, mat(t.accent, 'gem'), { g: g + 12 }); s.ellipse(cx + 6, ys + 1, 2.6, 2.6, mat(t.accent, 'gem'), { g: g + 13 }); }
    }
  }
  // An apron, bib to knee.
  if (f.garb.apron && !back) {
    const am = mat(f.garb.apron, 'leather');
    s.poly([[cx - 7, ys + 6], [cx + 7, ys + 6], [cx + 8, belt], [cx + hw, 104 + b], [cx - hw, 104 + b], [cx - 8, belt]], am, { g: g + 20 });
    s.dot(cx - 3, ys + 14, am.ramp[1], 7, 1);
  }
  // The belt and its buckle.
  if (sh !== 'robe') {
    s.poly([[cx - waist - .5, belt - 1], [cx + waist + .5, belt - 1], [cx + waist + 1, belt + 3], [cx - waist - 1, belt + 3]], mat(BELT, 'leather'), { g: g + 25 });
    if (!back) { s.rect(cx - 2 + (turned ? 2 : 0), belt - 1, 5, 4, mat(BRASS, 'metal'), { g: g + 26 }); }
  } else {
    // A robe's sash.
    const sm = mat(f.garb.sash ?? f.trimHex, 'cloth');
    s.poly([[cx - waist, belt - 1.5], [cx + waist, belt - 1.5], [cx + waist, belt + 2.5], [cx - waist, belt + 2.5]], sm, { g: g + 25 });
    if (!back) s.poly([[cx - waist + 2, belt + 2], [cx - waist + 6, belt + 2], [cx - waist + 5, belt + 14], [cx - waist + 1, belt + 13]], sm, { g: g + 26 });
  }
  // A sash across the chest from the back shoulder to the front hip.
  if (f.garb.sash && sh !== 'robe' && !f.garb.apron) {
    const sm = mat(f.garb.sash, 'cloth'), d = back ? -1 : 1;
    s.poly([[cx + d * (sw - 4), ys], [cx + d * (sw - 10), ys - 1], [cx - d * (waist - 3), belt - 1], [cx - d * (waist - 9), belt]], sm, { g: g + 30 });
  }
}

/** Shoulders: pauldrons on plate, a mantle, else nothing (the sleeve's top is the shoulder). */
function shoulders(s: Sculpt, f: Fig, cx: number, sw: number, ys: number, br: number, g: number, view: HdView): void {
  const ch = f.chest, turned = view >= 2;
  if (ch && (ch.shape === 'plate' || ch.shape === 'scale')) {
    for (const side of [-1, 1] as const) {
      if (turned && side > 0 && view === 2) continue;
      if (turned && side < 0 && view === 3) continue;
      s.ellipse(cx + side * sw, ys - br + 1, 8.5, 6.8, ch.m, { g: g + 1 + side, bias: side > 0 ? -.2 : .1 });
      s.ellipse(cx + side * (sw + 2), ys + 6 - br, 6.2, 4, ch.m, { g: g + 4 + side, bias: side > 0 ? -.4 : 0 });
      if (ch.t.trim) s.lineOn([cx + side * (sw - 7), ys - br - 4], [cx + side * (sw + 6), ys - br - 2], ch.t.trim);
    }
    const sd = (side: number) => s.dot(cx + side * (sw - 6), ys - br, ch.m.ramp[5]);
    sd(-1);
  }
  const mantle = ch?.t.mantle ?? (ch?.shape === 'mantle' || ch?.shape === 'cloak' ? null : null);
  if (ch?.shape === 'mantle' || ch?.shape === 'cloak' || mantle) {
    const m = mantle ? mat(mantle, 'cloth') : ch!.m;
    s.poly([[cx - sw - 3, ys + 7], [cx - sw + 2, ys - 3], [cx + sw - 2, ys - 3], [cx + sw + 3, ys + 7], [cx + sw - 2, ys + 12], [cx, ys + 14], [cx - sw + 2, ys + 12]], m, { g: g + 8 });
    s.lineOn([cx - 6, ys + 2], [cx - 8, ys + 12], m.ramp[1]); s.lineOn([cx + 6, ys + 2], [cx + 8, ys + 12], m.ramp[1]);
  }
}

/** Hair that hangs behind the head when seen from the front: drawn before the head. */
function backHair(s: Sculpt, f: Fig, hc: number, hy: number, turned: boolean, g: number): void {
  const st = f.style, m = f.hair, cov = f.head && f.head.shape !== 'circlet' && f.head.shape !== 'crown';
  if (st === 'long' || st === 'bob') {
    const low = st === 'long' ? 26 : 12;
    s.poly([[hc - 19, hy - 8], [hc + 19, hy - 8], [hc + 20, hy + low], [hc + 10, hy + low + 2], [hc - 10, hy + low + 2], [hc - 20, hy + low]], m, { g });
  } else if (st === 'pigtails') {
    for (const side of [-1, 1] as const) s.stroke([[hc + side * 17, hy - 4], [hc + side * 22, hy + 6], [hc + side * 21, hy + 18]], 5, 3.5, m, { g: g + side });
  } else if (st === 'ponytail' && !turned) {
    s.stroke([[hc + 10, hy - 10], [hc + 20, hy], [hc + 22, hy + 14]], 4.5, 3, m, { g });
  } else if (st === 'ponytail') {
    s.stroke([[hc - 12, hy - 10], [hc - 20, hy], [hc - 21, hy + 14]], 4.5, 3, m, { g });
  } else if (st === 'bun' && !cov) {
    s.ellipse(hc + (turned ? -8 : 0), hy - 18, 7, 6, m, { g });
  }
}

/** The head: neck, skull, ears, hair, the face, what is worn on it. */
function head(s: Sculpt, f: Fig, view: HdView, q: Pose, hc: number, hy: number, cx: number, g: number): void {
  const back = view === 1 || view === 3, turned = view >= 2, H = f.head, a = q.act;
  const hood = H && (H.shape === 'hood' || H.shape === 'cowl');
  const helm = H && (H.shape === 'helm' || H.shape === 'pyre' || H.shape === 'open' || H.shape === 'great' || H.shape === 'horned');
  const fc = hc + (turned ? 6 : 0);
  // Neck.
  s.rect(hc - 5, hy + 10, 11, 9, f.skin, { g, bias: -1 });
  // A hood's cloth falls round the head first (its back and sides).
  if (hood) s.poly([[hc - 21, hy - 2], [hc + 21, hy - 2], [hc + 23, hy + 18], [hc + 12, hy + 22], [hc - 12, hy + 22], [hc - 23, hy + 18]], H!.m, { g: g + 1, bias: -.2 });
  // Ears (square on both; turned, the near one only — from the front it is the viewer's left; from behind, the right).
  if (!H || !(H.shape === 'great' || hood)) {
    if (!turned) s.ellipse(hc - 17, hy + 3, 2.8, 4, f.skin, { g: g + 2, bias: .2 });
    if (!turned || back) s.ellipse(hc + 17, hy + 3, 2.8, 4, f.skin, { g: g + 3, bias: -.3 });
  }
  if (back) {
    if (turned) s.ellipse(hc + 12, hy + 4, 6, 9, f.skin, { g: g + 4, bias: -.4 });
    // The back of the head: hair, or the hood.
    if (hood) {
      const hm = H!.m, d = turned ? -3 : 0;
      s.ellipse(hc + d * .5, hy - 2, 20, 19, hm, { g: g + 5 });
      s.poly([[hc - 6 + d, hy - 17], [hc + 6 + d, hy - 17], [hc + d * 2, hy - 25]], hm, { g: g + 5 });
      s.lineOn([hc - 4 + d, hy - 16], [hc - 9 + d, hy + 16], hm.ramp[1]); s.lineOn([hc + 4 + d, hy - 16], [hc + 8 + d, hy + 17], hm.ramp[1]);
      s.lineOn([hc - 12, hy + 4], [hc - 15, hy + 18], hm.ramp[2]);
      if (H!.t.trim) s.lineOn([hc - 21, hy + 18], [hc + 21, hy + 18], H!.t.trim);
    } else {
      const shaved = f.style === 'shaved' || f.style === 'mohawk', d = turned ? -2 : 0;
      s.ellipse(hc + d, hy, 17.5 + d, 16, shaved ? f.skin : f.hair, { g: g + 5 });
      if (helm) {
        // Under a helm, from behind: its neck guard, three lames, and only the nape's curls below it.
        for (let x = -10; x <= 10; x += 5) s.ellipse(hc + d + x, hy + 11, 3.6, 3.2, f.hair, { g: g + 6 });
        s.poly([[hc - 18.5 + d, hy - 10], [hc + 18.5 + d, hy - 10], [hc + 17 + d, hy + 4], [hc + 9 + d, hy + 8], [hc - 9 + d, hy + 8], [hc - 17 + d, hy + 4]], H!.m, { g: g + 8 });
        for (const y of [hy - 4, hy + 2]) s.lineOn([hc - 17 + d, y], [hc + 17 + d, y], H!.m.ramp[1]);
      } else if (!shaved) {
        // The nape: a scalloped edge, strands from the crown.
        for (let x = -12; x <= 12; x += 6) s.ellipse(hc + d + x, hy + 12, 4.2, 3.6, f.hair, { g: g + 5 });
        for (const x of [-9, -3, 4, 10]) s.lineOn([hc + d + x * .4, hy - 14], [hc + d + x, hy + 13], f.hair.ramp[1]);
        s.lineOn([hc + d - 8, hy - 12], [hc + d - 13, hy + 2], f.hair.ramp[4]);
      }
      backHairBehind(s, f, hc, hy, g + 7, !!helm);
    }
    if (H && !hood) headgear(s, f, H, hc, hy, false, turned, g + 20);
    else if (!H && f.garb.hat) hat(s, f, hc, hy, g + 20, false);
    return;
  }
  // The skull, the face (turned: the cheek and jaw swing toward where it looks, the back of the head away).
  s.ellipse(hc, hy, 17.5, 16, f.skin, { g: g + 5 });
  if (turned) s.ellipse(hc + 5, hy + 5, 13.5, 10, f.skin, { g: g + 5 });
  if (f.fem && !turned) { s.ellipse(hc, hy + 9, 12, 7, f.skin, { g: g + 5 }); }
  const bare = !H || H.shape === 'circlet' || H.shape === 'crown';
  if (turned && bare && f.style !== 'shaved' && f.style !== 'mohawk') s.poly([[hc - 18, hy - 6], [hc - 7, hy - 14], [hc - 6, hy + 2], [hc - 10, hy + 10], [hc - 17, hy + 9]], f.hair, { g: g + 8 });
  if (turned && (!H || bare || helm)) s.ellipse(hc - 7, hy + 3, 3, 4.2, f.skin, { g: g + 9, bias: .2 });
  if (H?.shape === 'cowl' || f.garb.mirrorFace) {
    // A face lost in the cowl's shadow, or Verrin's obsidian mirror.
    s.ellipse(fc, hy + 3, 13, 12, mat(f.garb.mirrorFace ? '#1d1428' : mix(H!.t.deep, '#000000', .55), 'cloth'), { g: g + 6 });
    if (f.garb.mirrorFace) { s.line([fc - 6, hy - 4], [fc - 2, hy + 6], '#7a6a9a'); s.line([fc - 5, hy - 4], [fc - 1, hy + 6], '#a898c8'); }
  } else {
    hairCap(s, f, hc, hy, turned, g + 8, !!H && !(H.shape === 'circlet' || H.shape === 'crown'));
    face(s, f, view, a, fc, hy, H);
  }
  if (f.mark === 'beard' && !(H?.shape === 'cowl') && !f.garb.mirrorFace && H?.shape !== 'great' && H?.shape !== 'mask') {
    s.poly([[fc - 16, hy + 1], [fc - 12, hy + 12], [fc - 4, hy + 18], [fc + 4, hy + 18], [fc + 12, hy + 12], [fc + 15, hy + 1], [fc + 10, hy + 9], [fc + 4, hy + 8], [fc - 4, hy + 8], [fc - 10, hy + 9]], f.hair, { g: g + 30 });
    s.dot(fc - 2, hy + 10, mix(f.skinHex, '#5a1e2a', .6), 4, 1);
  }
  if (H) headgear(s, f, H, hc, hy, true, turned, g + 40);
  else if (f.garb.hat) hat(s, f, hc, hy, g + 40, true);
  // Eyes that glow from a cowl's or helm's shadow.
  if (H && (H.shape === 'cowl' || H.shape === 'great') && f.glowEyes) glowEyes(s, f, fc, hy + 2, true);
}

/** From behind: what hangs below the head (a long fall, a braid, a tail, pigtails, a bun, a topknot, a crest). */
function backHairBehind(s: Sculpt, f: Fig, hc: number, hy: number, g: number, helm: boolean): void {
  const st = f.style, m = f.hair;
  if (st === 'long') {
    s.poly([[hc - 17.5, hy + 2], [hc + 17.5, hy + 2], [hc + 15, hy + 24], [hc + 10, hy + 31], [hc + 3, hy + 29], [hc - 3, hy + 32], [hc - 10, hy + 29], [hc - 15, hy + 24]], m, { g });
    for (const x of [-11, -5, 1, 7, 12]) s.lineOn([hc + x * .7, hy + 4], [hc + x, hy + 29], m.ramp[1]);
    s.lineOn([hc - 13, hy + 4], [hc - 12, hy + 22], m.ramp[4]);
  } else if (st === 'bob') {
    s.poly([[hc - 18.5, hy], [hc + 18.5, hy], [hc + 18, hy + 13], [hc + 9, hy + 15], [hc - 9, hy + 15], [hc - 18, hy + 13]], m, { g });
    for (const x of [-10, -3, 4, 11]) s.lineOn([hc + x * .6, hy + 2], [hc + x, hy + 14], m.ramp[1]);
  }
  else if (st === 'braid') { for (let i = 0; i < 6; i++) s.ellipse(hc + (i % 2 ? 1 : -1), hy + 14 + i * 4.2, 3.6 - i * .2, 3, m, { g: g + 1 + i }); }
  else if (st === 'ponytail') s.stroke([[hc, hy + 4], [hc + 1, hy + 18], [hc - 1, hy + 28]], 4.6, 2.8, m, { g });
  else if (st === 'pigtails') for (const side of [-1, 1] as const) s.stroke([[hc + side * 15, hy + 2], [hc + side * 20, hy + 12], [hc + side * 19, hy + 22]], 4.6, 3.2, m, { g: g + side });
  else if (st === 'curls') for (const [x, y] of [[-12, 12], [-4, 15], [4, 15], [12, 12]] as const) s.ellipse(hc + x, hy + y, 4.6, 4, m, { g: g + x });
  if (helm) return;
  if (st === 'bun') s.ellipse(hc, hy - 6, 7.5, 6.5, m, { g: g + 10 });
  if (st === 'topknot') { s.ellipse(hc, hy - 18, 6, 5.5, m, { g: g + 10 }); s.rect(hc - 3, hy - 14, 7, 2, mat(f.trimHex, 'cloth'), { g: g + 11 }); }
  if (st === 'mohawk') s.poly([[hc - 3, hy - 20], [hc + 3, hy - 20], [hc + 4, hy + 10], [hc - 4, hy + 10]], m, { g: g + 10 });
}

/** The hair over the top of the head from the front: a cap with a fringe, in its style. Under a helm or hood only the locks show. */
function hairCap(s: Sculpt, f: Fig, hc: number, hy: number, turned: boolean, g: number, covered: boolean): void {
  const st = f.style, m = f.hair, tx = turned ? 2 : 0;
  if (covered) {
    // Locks escaping under the brim.
    if (st !== 'shaved' && st !== 'mohawk' && st !== 'cropped') for (const side of [-1, 1] as const) s.stroke([[hc + side * 15 + tx, hy - 6], [hc + side * 16.5 + tx, hy + 2], [hc + side * 15.5, hy + (st === 'long' || st === 'bob' ? 14 : 6)]], 3.4, 2.2, m, { g: g + side });
    return;
  }
  if (st === 'shaved') { s.poly(dome(hc, hy - 1, 17.8, 16.4, hy - 9), mat(mix(f.hairHex, f.skinHex, .55), 'hair'), { g }); return; }
  if (st === 'mohawk') { s.poly([[hc - 3.5 + tx, hy - 25], [hc + 3.5 + tx, hy - 25], [hc + 4.5 + tx, hy - 8], [hc - 4.5 + tx, hy - 8]], m, { g }); s.poly(dome(hc, hy - 1, 17.8, 16.4, hy - 11), mat(mix(f.hairHex, f.skinHex, .65), 'hair'), { g: g + 1 }); return; }
  const cut = st === 'cropped' ? hy - 9 : hy - 6;
  s.poly(dome(hc, hy - 1, 19, 17.5, cut), m, { g });
  // Sideburns / temples.
  for (const side of [-1, 1] as const) s.ellipse(hc + side * 16.5, hy - 2, 3.2, 6, m, { g });
  if (st === 'swept') s.poly([[hc - 17 + tx, cut - 2], [hc + 12 + tx, cut - 4], [hc + 4 + tx, cut + 5], [hc - 10 + tx, cut + 3]], m, { g: g + 2 });
  else if (st === 'curls') for (const [x, y, r] of [[-16, -6, 4.6], [-17, 0, 3.6], [16, -6, 4.6], [17, 0, 3.6], [-11, -8, 4], [11, -8, 4], [-4, -8, 3.4], [4, -8, 3.4], [0, -16, 5], [-9, -15, 5], [9, -15, 5]] as const) s.ellipse(hc + x + tx, hy + y, r, r, m, { g: g + 3 + x });
  else if (st === 'cropped') for (let x = -12; x <= 12; x += 4) s.poly([[hc + x - 2 + tx, cut], [hc + x + 2 + tx, cut], [hc + x + tx, cut + 3]], m, { g: g + 2 });
  else for (let x = -13; x <= 13; x += 6.5) s.ellipse(hc + x + tx, cut + 1, 4, 3.4, m, { g: g + 2 });
  if (st === 'long' || st === 'bob') for (const side of [-1, 1] as const) s.poly([[hc + side * 13, hy - 6], [hc + side * 19.5, hy - 4], [hc + side * 20, hy + (st === 'long' ? 20 : 12)], [hc + side * 14, hy + (st === 'long' ? 18 : 11)]], m, { g: g + 4 + side });
  if (st === 'braid') { for (let i = 0; i < 6; i++) s.ellipse(hc + 16 - i * .5, hy + 6 + i * 4, 3.4 - i * .2, 2.8, m, { g: g + 10 + i }); s.rect(hc + 13, hy + 28, 6, 2, mat(f.trimHex, 'cloth'), { g: g + 17 }); }
  if (st === 'topknot') { s.ellipse(hc + tx, hy - 20, 6, 5.5, m, { g: g + 10 }); s.rect(hc - 3 + tx, hy - 16, 7, 2, mat(f.trimHex, 'cloth'), { g: g + 11 }); }
  if (st === 'bun') s.ellipse(hc + tx - 1, hy - 19, 6.5, 5.5, m, { g: g + 10 });
  if (st === 'pigtails') for (const side of [-1, 1] as const) s.rect(hc + side * 17 - 2, hy - 3, 5, 2.5, mat(f.trimHex, 'cloth'), { g: g + 12 + side });
  // A shine across the crown.
  s.line([hc - 10 + tx, hy - 13], [hc - 3 + tx, hy - 15], m.ramp[5]);
}

/** Eyes that glow: two pips (or one, Kael's) with a hot heart. */
function glowEyes(s: Sculpt, f: Fig, fc: number, ey: number, both: boolean): void {
  const c = f.glowEyes!;
  for (const side of [-1, 1] as const) {
    if (!both && side > 0) continue;
    const ex = fc + side * 6.5;
    s.dot(ex - 2, ey - 1, mix(c, '#000000', .3), 4, 3); s.dot(ex - 1, ey - 1, c, 3, 2); s.dot(ex, ey - 1, mix(c, '#ffffff', .6), 1, 1);
  }
}

/** The face: brows, big eyes with a glint, a nose shade, a mouth, a blush; the face mark; a moment's expression. */
function face(s: Sculpt, f: Fig, view: HdView, a: Act, fc: number, hy: number, H: Fig['head']): void {
  const turned = view >= 2, ey = hy + 2, brow = f.garb.elder ? '#d8d0c4' : mix(f.hairHex, '#2a1a20', .4);
  const EYE = '#2a1a30', SHINE = '#ffffff';
  if (H?.shape === 'great') {
    // A closed helm: the visor slit, dark.
    s.dot(fc - 13, ey - 2, '#120a14', 26, 3);
    return;
  }
  const skinHex = f.skinHex;
  const glow = f.glowEyes && (f.bothEyes || f.undead) ? 2 : f.glowEyes ? 1 : 0;
  for (const side of [-1, 1] as const) {
    const far = turned && side > 0, ex = fc + side * (far ? 6 : 7), w = far ? 3 : 5;
    // Brows.
    s.dot(ex - 3, ey - 6, brow, far ? 4 : 6, 1); if (!far) s.dot(ex - 3 + (side > 0 ? 5 : 0), ey - 7, brow);
    if (a === 'hit') { s.line([ex - 2, ey - 2], [ex + 2, ey], EYE); s.line([ex - 2, ey + 2], [ex + 2, ey], EYE); continue; }
    if (a === 'kneel' || a === 'down') { s.dot(ex - 2, ey + 1, EYE, w, 1); continue; }
    if (glow === 2 || (glow === 1 && side < 0)) {
      const c = f.glowEyes!;
      s.dot(ex - 2, ey - 2, mix(c, '#000000', .35), w, 6); s.dot(ex - 1, ey - 1, c, Math.max(1, w - 2), 4); s.dot(ex - 1, ey - 1, mix(c, '#ffffff', .65), 1, 2);
      continue;
    }
    const tall = f.eyes === 'narrow' ? 5 : 8, top = ey - (f.eyes === 'narrow' ? 1 : 3);
    s.dot(ex - 2, top, EYE, w, tall);
    if (!far) { s.dot(ex - 3, top + 1, EYE, 1, tall - 2); s.dot(ex + 3, top + 1, EYE, 1, tall - 2); }
    // The iris in the eye colour, a glint.
    s.dot(ex - 1, top + 3, f.eyeHex, far ? 2 : 3, tall - 4); s.dot(ex, top + tall - 2, mix(f.eyeHex, '#ffffff', .45), 1, 1);
    s.dot(ex - 1, top + 1, SHINE, f.eyes === 'bright' ? 2 : 2, f.eyes === 'bright' ? 3 : 2);
    if (f.fem) { s.dot(ex - 3 + (side > 0 ? 4 : 0), top - 1, EYE, 2, 1); }
    if (f.garb.elder) s.dot(ex - 2, top + tall + 1, mix(skinHex, '#5a2a3a', .35), w, 1);
    // Cheeks.
    const blush = f.mark === 'rosy' ? mix(skinHex, '#ff4f6a', .55) : mix(skinHex, '#ff6f86', .4);
    if (!far || f.mark === 'rosy') s.dot(ex - 2 + side * 2, ey + 8, blush, f.mark === 'rosy' ? 4 : 3, f.mark === 'rosy' ? 2 : 1);
  }
  if (f.garb.loupe) { s.ellipse(fc + 7, ey + 1, 4.5, 4.5, mat(BRASS, 'metal'), { g: 900 }); s.ellipse(fc + 7, ey + 1, 2.6, 2.6, mat('#a8c8e8', 'gem'), { g: 901 }); }
  // Nose, mouth.
  s.dot(fc + (turned ? 2 : 0), ey + 4, mix(f.skin.ramp[2], f.skin.ramp[1], .5), 1, 2);
  if (turned) s.dot(fc + 3, ey + 5, f.skin.ramp[1], 1, 1);
  const mouth = mix(skinHex, '#5a1e2a', .62);
  if (a === 'hit' || a === 'strike') { s.dot(fc - 1, ey + 9, mouth, 3, 2); }
  else if (f.fem) { s.dot(fc - 2, ey + 9, mix(skinHex, '#c0405a', .5), 4, 1); s.dot(fc - 1, ey + 10, mix(skinHex, '#d06070', .45), 2, 1); }
  else { s.dot(fc - 2, ey + 9, mouth, 4, 1); s.dot(fc - 1, ey + 10, mix(skinHex, '#b85a5a', .4), 2, 1); }
  // Marks.
  if (f.mark === 'freckles') for (const [x, y] of [[-9, 6], [-7, 7], [-10, 8], [8, 6], [10, 7], [7, 8]] as const) s.dot(fc + x, ey + y, mix(skinHex, '#8a4a2a', .5));
  if (f.mark === 'scar') s.line([fc - 10, ey - 8], [fc - 5, ey + 6], mix(skinHex, '#b04050', .55));
  if (f.mark === 'warpaint') for (const side of [-1, 1] as const) { s.dot(fc + side * 7 - 3, ey + 5, mix(f.trimHex, '#c02a2a', .4), 6, 1); s.dot(fc + side * 7 - 2, ey + 7, mix(f.trimHex, '#c02a2a', .4), 4, 1); }
  // The undead: sunken cheeks under a lit cheekbone, a stitched mouth.
  if (f.undead) { s.dot(fc - 11, ey + 6, f.skin.ramp[1], 2, 3); s.dot(fc + 10, ey + 6, f.skin.ramp[1], 2, 3); for (let x = -2; x <= 2; x += 2) s.dot(fc + x, ey + 8, f.skin.ramp[0], 1, 3); }
}

/** A hat (townsfolk): a wide brim, or a cap with a peak. */
function hat(s: Sculpt, f: Fig, hc: number, hy: number, g: number, front: boolean): void {
  const m = mat(f.garb.hatColor ?? '#4a4030', 'cloth');
  if (f.garb.hat === 'brim') {
    s.ellipse(hc, hy - 9, 27, 6, m, { g });
    s.poly(dome(hc, hy - 10, 14, 14, hy - 9), m, { g: g + 1 });
    s.rect(hc - 13, hy - 13, 26, 3, mat(f.trimHex, 'cloth'), { g: g + 2 });
  } else {
    s.poly(dome(hc, hy - 4, 18.5, 15, hy - 6), m, { g });
    if (front) s.ellipse(hc - 6, hy - 6, 13, 3.6, m, { g: g + 1, bias: .4 });
    else s.rect(hc - 18, hy - 7, 36, 2, mat(mix(f.garb.hatColor ?? '#4a4030', '#000000', .3), 'cloth'), { g: g + 1 });
  }
}

/** What is worn on the head. `front`: seen from the front. */
function headgear(s: Sculpt, f: Fig, H: NonNullable<Fig['head']>, hc: number, hy: number, front: boolean, turned: boolean, g: number): void {
  const m = H.m, t = H.t, tx = turned ? (front ? 1.5 : -1.5) : 0;
  const rim = mat(t.trim ?? t.accent, 'metal');
  switch (H.shape) {
    case 'helm': case 'pyre': case 'open': case 'horned': {
      // The dome, a darker rim with a lit band, a plume (the Pyre Watch), cheek guards and a nasal (an open helm).
      s.poly(dome(hc + tx, hy - 12, 19, 14.5, hy - 10), m, { g });
      s.poly([[hc - 19.5 + tx, hy - 15], [hc + 19.5 + tx, hy - 15], [hc + 19 + tx, hy - 9], [hc - 19 + tx, hy - 9]], H.dk, { g: g + 1 });
      s.rect(hc - 18 + tx, hy - 14, 36, 2, mat(t.accent, H.shape === 'pyre' ? 'glow' : 'metal'), { g: g + 2 });
      if (H.shape === 'open' || H.shape === 'pyre') {
        if (front) { s.limb([hc + tx * 2, hy - 10], [hc + tx * 2, hy + 1], 1.6, 1.4, H.dk, { g: g + 3 }); }
        for (const side of [-1, 1] as const) { if (turned && front && side > 0) continue; s.poly([[hc + side * 19, hy - 10], [hc + side * 15, hy - 10], [hc + side * 15.5, hy + 6], [hc + side * 19.5, hy + 4]], m, { g: g + 4 + side }); }
      }
      if (H.shape === 'pyre') {
        s.limb([hc + tx, hy - 25], [hc + tx, hy - 15], 1.8, 1.8, H.dk, { g: g + 6 });
        const d = front ? 1 : -1;
        s.stroke([[hc + tx + d, hy - 25], [hc + tx + d * 7, hy - 30], [hc + tx + d * 13, hy - 31], [hc + tx + d * 19, hy - 26]], 3.8, 1.8, mat('#7c2234', 'cloth'), { g: g + 7 });
      }
      if (H.shape === 'horned' || t.horns) {
        const hm = mat(t.horns ?? '#e2d8c2', 'cloth');
        for (const side of [-1, 1] as const) s.stroke([[hc + side * 15, hy - 16], [hc + side * 23, hy - 22], [hc + side * 25, hy - 32], [hc + side * 21, hy - 38]], 3.6, 1, hm, { g: g + 10 + side });
      }
      if (t.runes) for (let x = -12; x <= 12; x += 8) s.dot(hc + x + tx, hy - 20, t.runes, 2, 2);
      return;
    }
    case 'great': {
      s.poly([[hc - 19 + tx, hy - 22], [hc + 19 + tx, hy - 22], [hc + 20 + tx, hy + 12], [hc + 12, hy + 17], [hc - 12, hy + 17], [hc - 20 + tx, hy + 12]], m, { g });
      s.poly(dome(hc + tx, hy - 14, 19, 12, hy - 20), m, { g: g + 1 });
      if (front) {
        const fc = hc + (turned ? 6 : 0);
        s.dot(fc - 13, hy, '#120a14', 26, 3);
        s.limb([fc, hy + 4], [fc, hy + 14], 1.4, 1.4, H.dk, { g: g + 2 });
        for (let y = hy + 6; y < hy + 15; y += 3) { s.dot(fc - 6, y, '#120a14', 2, 1); s.dot(fc + 5, y, '#120a14', 2, 1); }
      }
      s.rect(hc - 19 + tx, hy - 9, 38, 2, rim, { g: g + 3 });
      if (t.horns) for (const side of [-1, 1] as const) s.stroke([[hc + side * 16, hy - 18], [hc + side * 24, hy - 24], [hc + side * 25, hy - 34]], 3.6, 1, mat(t.horns, 'cloth'), { g: g + 10 + side });
      return;
    }
    case 'hood': case 'cowl': {
      // The hood's crown and its brim framing the face, a point at the back, a trim on the edge.
      const deep = H.shape === 'cowl';
      s.poly(dome(hc + tx, hy - 1, 21.5, 20.5, hy + (deep ? 2 : -4)), m, { g });
      if (front) {
        // The brim round the face (the face shows inside it).
        for (const side of [-1, 1] as const) s.poly([[hc + side * 21.5 + tx, hy - 4], [hc + side * (deep ? 12 : 16) + tx * 2, hy - 4], [hc + side * (deep ? 13 : 16) + tx * 2, hy + 12], [hc + side * 20 + tx, hy + 18]], m, { g: g + 1 + side, bias: side > 0 ? -.3 : .1 });
        if (t.trim) s.lineOn([hc - 15 + tx, hy - 5], [hc + 15 + tx, hy - 5], t.trim);
        if (t.seam) s.lineOn([hc + tx, hy - 20], [hc + tx, hy - 7], t.seam);
      } else s.poly([[hc - 4, hy - 20], [hc + 4, hy - 20], [hc + (turned ? -6 : 0), hy - 28]], m, { g: g + 3 });
      if (t.horns) for (const side of [-1, 1] as const) s.stroke([[hc + side * 14, hy - 16], [hc + side * 22, hy - 24], [hc + side * 22, hy - 32]], 3.4, 1, mat(t.horns, 'cloth'), { g: g + 10 + side });
      if (t.mantle) s.ellipse(hc, hy + 20, 22, 6, mat(t.mantle, 'cloth'), { g: g + 12 });
      return;
    }
    case 'crown': {
      s.poly([[hc - 17 + tx, hy - 10], [hc + 17 + tx, hy - 10], [hc + 17 + tx, hy - 15], [hc + 12 + tx, hy - 22], [hc + 7 + tx, hy - 16], [hc + tx, hy - 24], [hc - 7 + tx, hy - 16], [hc - 12 + tx, hy - 22], [hc - 17 + tx, hy - 15]], m, { g });
      if (front) for (const x of [-10, 0, 10]) s.ellipse(hc + x + tx, hy - 13, 1.8, 1.8, mat(t.accent, 'gem'), { g: g + 2 });
      return;
    }
    case 'circlet': {
      s.poly([[hc - 17.5 + tx, hy - 10], [hc + 17.5 + tx, hy - 10], [hc + 17.5 + tx, hy - 7.5], [hc - 17.5 + tx, hy - 7.5]], m, { g });
      if (front) s.ellipse(hc + (turned ? 6 : 0), hy - 9, 2.4, 2.4, mat(t.accent, 'gem'), { g: g + 1 });
      return;
    }
    case 'mask': {
      if (front) {
        const fc = hc + (turned ? 6 : 0);
        s.poly([[fc - 15, hy - 6], [fc + 15, hy - 6], [fc + 13, hy + 10], [fc, hy + 15], [fc - 13, hy + 10]], m, { g });
        for (const side of [-1, 1] as const) s.dot(fc + side * 6.5 - 2, hy, f.glowEyes ?? '#120a14', 4, 3);
      } else s.rect(hc - 17, hy - 2, 34, 3, H.dk, { g });
      return;
    }
  }
}

// ── The sheet ──
/** One figure: its sheet (baked a cell at a time), which cells are ready. */
export class HdFigure {
  /** One strip per view, made the first time that view is shown (a townsperson standing still only ever makes one or two). */
  private readonly rows: (HTMLCanvasElement | null)[] = [null, null, null, null];
  private readonly cols = [0, 0, 0, 0];
  private readonly ready = new Uint8Array(4 * COLS_ALL);
  private readonly fig: Fig;
  constructor(readonly key: string, src: HdSource) { this.fig = figOf(src); }
  /** The memory this figure's strips hold (bytes). */
  get bytes(): number { let n = 0; for (const r of this.rows) if (r) n += r.width * r.height * 4; return n; }
  private ensure(view: HdView, fr: number): HTMLCanvasElement {
    const want = fr < COLS_TOWN ? COLS_TOWN : COLS_ALL, have = this.rows[view];
    if (have && this.cols[view] >= want) return have;
    const el = document.createElement('canvas');
    el.width = HD_FIG.w * want; el.height = HD_FIG.h;
    if (have) el.getContext('2d')!.drawImage(have, 0, 0);
    this.rows[view] = el; this.cols[view] = want;
    return el;
  }
  /** Bake the cell now (no budget). */
  bake(view: HdView, fr: number): void {
    const i = view * COLS_ALL + fr;
    if (this.ready[i]) return;
    const row = this.ensure(view, fr), t0 = now();
    row.getContext('2d')!.drawImage(sculpt(this.fig, view, fr), fr * HD_FIG.w, 0);
    this.ready[i] = 1;
    spent += now() - t0;
  }
  has(view: HdView, fr: number): boolean { return !!this.ready[view * COLS_ALL + fr]; }
  /** The cell to show for (view, frame): baked now if the frame's budget allows, else the nearest one ready. */
  cell(view: HdView, fr: number): { img: HTMLCanvasElement; sx: number } {
    let v = view, f = fr;
    if (!this.has(v, f)) {
      if (budget()) this.bake(v, f);
      else if (this.has(v, 0)) f = 0;
      else { const k = this.ready.findIndex(x => x === 1); if (k >= 0) { v = Math.floor(k / COLS_ALL) as HdView; f = k % COLS_ALL; } else this.bake(v, f); }
    }
    return { img: this.rows[v]!, sx: f * HD_FIG.w };
  }
  /** Draw with the feet at (x, y), `k` world px per sheet px (½ in the world), mirrored when `flip`. */
  draw(c: CanvasRenderingContext2D, x: number, y: number, k: number, view: HdView, fr: number, flip: boolean): void {
    const { img, sx } = this.cell(view, fr), W = HD_FIG.w, H = HD_FIG.h;
    if (flip) {
      c.save(); c.translate(x, y); c.scale(-1, 1);
      c.drawImage(img, sx, 0, W, H, -HD_FIG.ax * k, -HD_FIG.ay * k, W * k, H * k);
      c.restore();
      return;
    }
    c.drawImage(img, sx, 0, W, H, x - HD_FIG.ax * k, y - HD_FIG.ay * k, W * k, H * k);
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** The bake budget: at most ~6 ms of sculpting in any 16 ms window (a crowd appearing spreads over a few frames). */
let windowAt = 0, spent = 0;
function budget(): boolean { const t = now(); if (t - windowAt > 16) { windowAt = t; spent = 0; } return spent < 6; }

/** Figures by source key, least recently used last out (a town square's crowd and the party fit; the rest re-bake). */
const figures = new Map<string, HdFigure>();
const KEEP = 28;
export function hdFigure(src: HdSource): HdFigure {
  let f = figures.get(src.key);
  if (f) { figures.delete(src.key); figures.set(src.key, f); return f; }
  f = new HdFigure(src.key, src);
  figures.set(src.key, f);
  while (figures.size > KEEP) figures.delete(figures.keys().next().value!);
  return f;
}
/** Every cached figure's sheet memory, bytes (the phone budget check). */
export function hdFigureBytes(): number { let n = 0; for (const f of figures.values()) n += f.bytes; return n; }

/** The frame for a moment: breath now and then standing, the four-step walk moving. */
export function hdWalkFrame(time: number, moving: boolean): number {
  if (moving) return HF.walk + Math.floor(time * 9) % 4;
  return Math.floor(time * 1.4) % 4 === 3 ? HF.breath : HF.idle;
}
/** The attack's frame through its window (t 0 → 1): wind, strike, follow. */
export const hdAttackFrame = (t: number): number => t < .3 ? HF.wind : t < .65 ? HF.strike : HF.follow;
/** The cast's frame through its window. */
export const hdCastFrame = (t: number): number => t < .45 ? HF.raise : HF.release;
/** Does this figure cast rather than swing (a staff, a wand, the Warlock's bare hand)? */
export function hdCasts(src: HdSource): boolean { const k = src.gear?.weapon?.kind; return k === 'staff' || k === 'wand' || (!k && !!src.garb?.eyeGlow); }
