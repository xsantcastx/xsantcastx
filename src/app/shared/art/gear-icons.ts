/**
 * gear-icons.ts — every piece of gear its own pixel icon (owner, 2026-10-21: "items … they all are looking the same").
 *
 * The 16 × 16 set (item-icons.ts) gives each *definition* one icon, so ten Nullthorn Staffs were ten identical
 * pictures and a common cowl looked like a legendary one. This painter draws gear at 32 × 32 art px, in the detail
 * of the creatures and the Keeper (td-mobs.ts, keeper-front.ts): four tones lit from the upper left, a selective
 * 1-px outline (a lit step on the top-left edge, the art bible floor on the shadow side), whole pixels only.
 *
 * One picture is three things layered:
 *   - its BASE: what the thing is — a staff, a dagger, a helm, a ring… (GEAR_BASES, one painter each);
 *   - its REALM: the materials (the item's own entry in item-icons.ts where it has one, else the realm's kit);
 *   - its RARITY: ornament climbs the ladder — a trim band (uncommon), a set gem (rare), filigree and a bigger
 *     stone (epic), a soft halo in the loot colour (legendary), sparkles (mythic, singular);
 *   - and a SEED (the item's instance id): blade profile, guard, pommel, gem colour, banding, plume… so two drops
 *     of the same base rarely look alike, and one drop always looks the same.
 *
 * Pure and cached by key: an SVG of crisp rects in a data URI, identical under SSR, safe on the engine's canvas.
 * A hand-made icon can replace any of these later through the same lookup (material-catalog.ts itemArt).
 */
import type { ArtEntry } from './art-manifest.generated';
import { RAMPS, type Material } from './item-icons';

export const GEAR_BASES = [
  'sword', 'greatsword', 'dagger', 'axe', 'mace', 'hammer', 'staff', 'wand', 'spear', 'bow', 'crossbow',
  'pickaxe', 'sickle', 'shield', 'tome',
  'helm', 'hood', 'crown', 'circlet', 'plate', 'robe', 'coat', 'gloves', 'boots', 'legs', 'belt',
  'ring', 'amulet', 'trinket', 'charm', 'rune', 'potion', 'material',
] as const;
export type GearBase = typeof GEAR_BASES[number];

export const GEAR_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'] as const;

/** What the painter needs: the base, the item's realm and rarity, a seed, and (optionally) its own materials. */
export interface GearLook {
  base: GearBase;
  /** The item's style (ItemStyle): neutral, infernal, luminous, umbral, celestial, verdant, void, void-touched. */
  realm?: string;
  rarity?: string;
  /** Usually the instance id: the same seed always paints the same picture. */
  seed: string;
  /** The main material (blade, plate, cloth…), the second (haft, grip, lining) and the accent (gems, trims). */
  mat?: Material;
  sub?: Material;
  acc?: Material;
}

export const GEAR_N = 32;
const N = GEAR_N;
type Ramp = readonly string[];
interface Cell { r: Ramp; t: number }
type P2 = readonly [number, number];

const FLOOR = '#140a1f';
/** The loot colours (tokens/_cozy.css --cozy-loot-*); singular takes the void highlight. */
const GLOW: Readonly<Record<string, string>> = {
  legendary: '#ff9a3c', mythic: '#ffd25a', singular: '#ff6dd7',
};

interface Kit { metal: Material; cloth: Material; leather: Material; wood: Material; trim: Material; gems: readonly Material[] }
/** Each realm's materials (art bible §5 ramps): what a piece is made of when its own entry names nothing. */
const KITS: Readonly<Record<string, Kit>> = {
  neutral:   { metal: 'steel',    cloth: 'obsidian', leather: 'leather', wood: 'wood',     trim: 'gold',    gems: ['eclipse', 'orbit', 'ember', 'moss'] },
  infernal:  { metal: 'basalt',   cloth: 'crimson',  leather: 'leather', wood: 'wood',     trim: 'brass',   gems: ['ember', 'rose', 'sungold'] },
  luminous:  { metal: 'gold',     cloth: 'ivory',    leather: 'leather', wood: 'wood',     trim: 'sungold', gems: ['sungold', 'glow', 'dawn'] },
  umbral:    { metal: 'umbral',   cloth: 'umbral',   leather: 'iron',    wood: 'obsidian', trim: 'moon',    gems: ['amethyst', 'rose', 'eclipse'] },
  celestial: { metal: 'midnight', cloth: 'midnight', leather: 'leather', wood: 'wood',     trim: 'brass',   gems: ['orbit', 'glow', 'silver'] },
  verdant:   { metal: 'rootwood', cloth: 'moss',     leather: 'leather', wood: 'rootwood', trim: 'amber',   gems: ['bio', 'moss', 'amber'] },
  void:      { metal: 'void',     cloth: 'umbral',   leather: 'iron',    wood: 'obsidian', trim: 'eclipse', gems: ['void', 'amethyst'] },
};
const kitOf = (realm?: string): Kit => KITS[realm === 'void-touched' ? 'void' : realm ?? 'neutral'] ?? KITS['neutral'];

/** How much ornament a rarity carries: 0 (common) … 6 (singular). */
export function ornamentOf(rarity?: string): number {
  const i = (GEAR_RARITIES as readonly string[]).indexOf(rarity ?? 'common');
  return i < 0 ? 0 : i;
}

// ── The seeded hand ──────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The canvas: a 32 × 32 grid of (ramp, tone) cells ─────────────────────────

class Pic {
  readonly px: (Cell | null)[] = new Array(N * N).fill(null);
  set(x: number, y: number, r: Ramp, t: number): void {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    this.px[y * N + x] = { r, t: Math.max(0, Math.min(4, Math.round(t))) };
  }
  get(x: number, y: number): Cell | null { return x < 0 || y < 0 || x >= N || y >= N ? null : this.px[y * N + x]; }
  has(x: number, y: number): boolean { return this.get(x, y) !== null; }
  clear(x: number, y: number): void { if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = null; }
}
type Mask = (x: number, y: number) => boolean;

/** Fill a mask, lit from the top-left by its own edges, with a soft diagonal fall-off inside. */
function fill(p: Pic, m: Mask, r: Ramp, opts: { flat?: number; hi?: boolean } = {}): void {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return;
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!m(x, y)) continue;
    if (opts.flat != null) { p.set(x, y, r, opts.flat); continue; }
    const up = !m(x, y - 1), left = !m(x - 1, y), down = !m(x, y + 1), right = !m(x + 1, y);
    const d = ((x - x0) / w + (y - y0) / h) / 2;
    let t = d < .28 ? 3 : d > .7 ? 1 : 2;
    if (up || left) t = opts.hi !== false && up && left ? 4 : 3;
    else if (down && right) t = 0;
    else if (down || right) t = 1;
    p.set(x, y, r, t);
  }
}

/** A sphere's light: the highlight up-left, the deep shadow down-right. */
function orb(p: Pic, cx: number, cy: number, rx: number, ry: number, r: Ramp, lift = 0): void {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = -.55 * nx - .65 * ny + .45 * Math.sqrt(1 - d) + lift;
    p.set(x, y, r, l > .78 ? 4 : l > .28 ? 3 : l > -.22 ? 2 : l > -.62 ? 1 : 0);
  }
}

/** A gem: an orb with one white glint, set in a 1-px bezel when asked. */
function gem(p: Pic, cx: number, cy: number, rad: number, r: Ramp, bezel?: Ramp): void {
  if (bezel) orb(p, cx, cy, rad + 1, rad + 1, bezel);
  orb(p, cx, cy, rad, rad, r, .15);
  const gx = Math.floor(cx - rad * .45), gy = Math.floor(cy - rad * .5);
  if (rad >= 1.4) p.set(gx, gy, RAMPS.glass, 4);
}

/** An axis from a to b: (u along it in px, v across it, positive toward the light at the upper left). */
interface Axis { ax: number; ay: number; dx: number; dy: number; L: number }
function axis(a: P2, b: P2): Axis {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { ax: a[0], ay: a[1], dx: (b[0] - a[0]) / L, dy: (b[1] - a[1]) / L, L };
}
function loc(A: Axis, x: number, y: number): [number, number] {
  const X = x + .5 - A.ax, Y = y + .5 - A.ay;
  // The normal (dy, −dx) points up-left for a blade running to the upper right.
  return [X * A.dx + Y * A.dy, X * A.dy - Y * A.dx];
}
function at(A: Axis, u: number, v = 0): P2 { return [A.ax + A.dx * u + A.dy * v, A.ay + A.dy * u - A.dx * v]; }

/** A part laid along an axis: between u0 and u1, half-width hw(u), bent by off(u); tone(u, n) with n ∈ [−1, 1]. */
function rod(p: Pic, A: Axis, u0: number, u1: number, hw: (u: number) => number, r: Ramp,
  tone: (u: number, n: number) => number = cyl, off: (u: number) => number = () => 0): void {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [u, v] = loc(A, x, y);
    if (u < u0 || u > u1) continue;
    const h = hw(u);
    if (h <= 0) continue;
    const n = (v - off(u)) / h;
    if (n < -1 || n > 1) continue;
    const t = tone(u, n);
    if (t >= 0) p.set(x, y, r, t);
  }
}
/** A round haft's light. */
const cyl = (_u: number, n: number): number => n > .5 ? 3 : n > -.35 ? 2 : 1;
/** A bound grip: the wrap's turns read as alternating bands. */
const wrap = (u: number, n: number): number => (Math.floor(u * 1.4) % 2 === 0 ? 0 : -1) + (n > .3 ? 3 : 2);

const mirror = (f: (dx: number, y: number) => boolean, cx = 15.5): Mask => (x, y) => f(Math.abs(x + .5 - (cx + .5)), y + .5);

// ── Outline, halo, sparkle, svg ──────────────────────────────────────────────

/** A colour pulled toward the art bible floor by k (0..1). */
function darker(hex: string, k: number): string {
  const a = parseInt(hex.slice(1), 16), f = parseInt(FLOOR.slice(1), 16);
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((f >> s) & 255) * k);
  return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}`;
}

interface Out { c: string; a: number }

/** The night-dark ramps (umbral, midnight, obsidian, iron, void, leather…) read as a blob in a dark satchel cell: one step up. */
const LIFT = new Map<Ramp, number>();
function liftOf(r: Ramp): number {
  let l = LIFT.get(r);
  if (l === undefined) {
    const n = parseInt(r[2].slice(1), 16);
    l = .299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255) < 80 ? 1 : 0;
    LIFT.set(r, l);
  }
  return l;
}

function finish(p: Pic, rarity: number, glowKey: string, rnd: () => number): Out[] {
  const out: (Out | null)[] = p.px.map(c => (c ? { c: c.r[Math.min(4, c.t + liftOf(c.r))], a: 1 } : null));
  const line = new Array(N * N).fill(false);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (p.has(x, y)) continue;
    const below = p.get(x, y + 1), right = p.get(x + 1, y), above = p.get(x, y - 1), left = p.get(x - 1, y);
    const n = below ?? right ?? above ?? left;
    if (!n) continue;
    // Selective outline: on the lit top-left side, a dark of the colour it borders; on the shadow side, the floor.
    const lit = (below || right) && !above && !left;
    out[y * N + x] = { c: lit ? darker(n.r[0], .45) : FLOOR, a: 1 };
    line[y * N + x] = true;
  }
  const glow = GLOW[glowKey];
  if (glow && rarity >= 4) {
    const reach = rarity >= 5 ? 3 : 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (out[y * N + x]) continue;
      let d = 9;
      for (let j = -reach; j <= reach; j++) for (let i = -reach; i <= reach; i++) {
        const X = x + i, Y = y + j;
        if (X < 0 || Y < 0 || X >= N || Y >= N || !line[Y * N + X]) continue;
        d = Math.min(d, Math.max(Math.abs(i), Math.abs(j)));
      }
      if (d <= reach) out[y * N + x] = { c: glow, a: d === 1 ? .42 : d === 2 ? .2 : .1 };
    }
  }
  if (rarity >= 5) {
    // Sparkles: small four-point stars in the clear corners.
    const spots: P2[] = [[4, 4], [27, 5], [5, 26], [26, 26], [16, 3], [3, 16], [28, 16]];
    let placed = 0;
    for (const [sx, sy] of spots.sort(() => rnd() - .5)) {
      if (placed >= (rarity >= 6 ? 3 : 2)) break;
      const clear = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([i, j]) => { const c = out[(sy + j) * N + sx + i]; return !c || c.a < 1; });
      if (!clear) continue;
      out[sy * N + sx] = { c: '#fffaf0', a: 1 };
      for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out[(sy + j) * N + sx + i] = { c: glow ?? '#ffd25a', a: .85 };
      placed++;
    }
  }
  return out.map(o => o ?? { c: '', a: 0 });
}

function svgOf(px: readonly Out[]): string {
  const rects: string[] = [];
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const o = px[y * N + x];
      if (!o.c) { x++; continue; }
      let run = 1;
      while (x + run < N && px[y * N + x + run].c === o.c && px[y * N + x + run].a === o.a) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${o.c}"${o.a < 1 ? ` fill-opacity="${o.a}"` : ''}/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="64" height="64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

// ── The painters ─────────────────────────────────────────────────────────────

/** Everything a painter needs: the canvas, the dice, the ornament level, the resolved ramps. */
interface Brush {
  p: Pic; r: () => number; o: number;
  /** Main material (blade, plate, cloth), second (haft, grip, lining), trim metal, and the seed's gem. */
  main: Ramp; sub: Ramp; trim: Ramp; gem: Ramp; acc: Ramp;
  kit: Kit;
  pick<T>(list: readonly T[]): T;
}

function blade(b: Brush, A: Axis, from: number, len: number, w: number, profile: number, curve: number): void {
  const { p, main } = b;
  const to = from + len;
  const hw = (u: number): number => {
    const k = (u - from) / len;
    const tip = k > .78 ? Math.max(0, 1 - (k - .78) / .22) : 1;
    const shape = profile === 1 ? 1 + .3 * Math.sin(Math.PI * Math.min(1, k * 1.15)) // leaf
      : profile === 2 ? 1 - .25 * k                                                    // tapered
      : profile === 3 ? (k < .7 ? 1.12 : 1.12)                                        // broad
      : 1;
    return Math.max(.55, w * shape * (tip < 1 ? Math.sqrt(tip) : 1)) * (k > .995 ? 0 : 1);
  };
  const off = (u: number) => curve * ((u - from) / len) ** 2;
  const fuller = b.r() < .55;
  rod(p, A, from, to, hw, main, (u, n) => {
    const k = (u - from) / len;
    if (n > .62) return 4;
    if (n > .1) return 3;
    if (fuller && Math.abs(n + .1) < .28 && k > .06 && k < .7) return 1;
    return n < -.6 ? 1 : 2;
  }, off);
  // The rune line on an epic-or-better blade, glowing in the accent.
  if (b.o >= 3) for (let u = from + 3; u < from + len * .62; u += 2) {
    const [x, y] = at(A, u, off(u) - .2);
    p.set(Math.floor(x), Math.floor(y), b.acc, b.o >= 4 ? 4 : 3);
  }
}

function guard(b: Brush, A: Axis, u: number, half: number, thick: number, wings: number): void {
  const c = at(A, u);
  const G = axis(at(A, u, half), at(A, u, -half));
  rod(b.p, G, 0, G.L, () => thick, b.o >= 1 ? b.trim : b.sub, (_u, n) => n > .3 ? 3 : n > -.4 ? 2 : 1,
    t => -wings * ((t - G.L / 2) / (G.L / 2)) ** 2);
  if (b.o >= 3) gem(b.p, c[0], c[1], 1.3, b.gem);
}

function hilt(b: Brush, A: Axis, gripTo: number, pommelR: number): void {
  rod(b.p, A, 1.5, gripTo, () => 1.35, b.sub, wrap);
  const [px, py] = at(A, 1.2);
  if (b.o >= 2) gem(b.p, px, py, pommelR, b.gem, b.trim);
  else orb(b.p, px, py, pommelR, pommelR, b.o >= 1 ? b.trim : b.main);
}

function paintSword(b: Brush, great: boolean): void {
  const A = great ? axis([3.5, 28.5], [28.5, 3.5]) : axis([5, 27], [27, 5]);
  const grip = great ? 8.5 : 6.5;
  const profile = Math.floor(b.r() * 4);
  const curve = !great && b.r() < .22 ? -2.2 : 0;
  const w = great ? 3.1 + b.r() * .5 : 2.35 + b.r() * .5;
  blade(b, A, grip + 1.2, A.L - grip - 1.6, w, profile, curve);
  hilt(b, A, grip + .6, great ? 2.4 : 2);
  guard(b, A, grip + 1, great ? 6 + b.r() : 4.6 + b.r() * 1.6, great ? 1.6 : 1.35, b.r() < .5 ? 1.4 : 0);
}

function paintDagger(b: Brush): void {
  const A = axis([7, 25], [25.5, 6.5]);
  const wavy = b.r() < .35;
  blade(b, A, 8.2, A.L - 8.4, 2.3 + b.r() * .4, b.pick([0, 2, 1]), wavy ? 0 : (b.r() < .3 ? -1.6 : 0));
  if (wavy) rod(b.p, A, 9, A.L - 3, u => .55 + .5 * Math.max(0, Math.sin(u * 1.4)), b.main, () => 3);
  hilt(b, A, 7.4, 1.9);
  guard(b, A, 7.8, 3.6 + b.r(), 1.3, b.r() < .5 ? 1 : -.8);
}

function haft(b: Brush, A: Axis, from: number, to: number, w = 1.35): void {
  rod(b.p, A, from, to, () => w, b.sub, (u, n) => {
    if (b.o >= 1 && Math.abs(u - from - 2.5) < .9) return -1; // the trim band, painted after
    return cyl(u, n);
  });
  if (b.o >= 1) rod(b.p, A, from + 1.6, from + 3.4, () => w + .25, b.trim, cyl);
  // A butt cap.
  const [x, y] = at(A, from + .6);
  orb(b.p, x, y, w + .4, w + .4, b.o >= 2 ? b.trim : b.main);
}

function paintAxe(b: Brush): void {
  const A = axis([7.5, 28], [22.5, 4.5]);
  haft(b, A, 0, A.L - .5);
  const hu = A.L - 6, span = 10.5 + b.r() * 2, flare = .55 + b.r() * .25;
  const double = b.o >= 3 ? b.r() < .6 : b.r() < .2;
  const head: Mask = (x, y) => {
    const [u, v] = loc(A, x, y);
    const du = u - hu;
    if (v < 0 && v > -span) {
      const half = 2.6 + flare * (-v - 1);
      return Math.abs(du) <= half && v >= -span + .09 * du * du;
    }
    if (double && v >= 0 && v < span * .7) {
      const half = 1.8 + flare * .8 * (v - 1);
      return Math.abs(du) <= Math.max(1.6, half) && v <= span * .7 - .1 * du * du;
    }
    return Math.abs(du) <= 2.6 && Math.abs(v) <= 2;
  };
  fill(b.p, head, b.main);
  // The edge: a bright bevel along the cutting arc.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!head(x, y)) continue;
    const [u, v] = loc(A, x, y);
    const du = u - hu;
    if (v < 0 && v < -span + 1.6 + .09 * du * du) b.p.set(x, y, b.main, 4);
  }
  const [cx, cy] = at(A, hu);
  if (b.o >= 2) gem(b.p, cx, cy, 1.3, b.gem, b.trim);
  else orb(b.p, cx, cy, 1.2, 1.2, b.o >= 1 ? b.trim : b.sub);
}

function paintPickaxe(b: Brush): void {
  const A = axis([8, 28], [21, 5]);
  haft(b, A, 0, A.L - 1);
  const hu = A.L - 3.5, reach = 10 + b.r() * 2.5, arc = 2 + b.r() * 1.6, fat = 2.1 + b.r() * .7;
  const oneSided = b.r() < .3;
  const H = axis(at(A, hu, oneSided ? 3 : reach), at(A, hu, -reach));
  rod(b.p, H, 0, H.L, u => { const k = Math.abs(u - H.L / 2) / (H.L / 2); return Math.max(.6, fat * (1 - k * k)); }, b.main,
    (_u, n) => n > .35 ? 4 : n > -.2 ? 3 : 1, u => arc * (1 - ((u - H.L / 2) / (H.L / 2)) ** 2));
  const [cx, cy] = at(A, hu);
  if (b.o >= 2) gem(b.p, cx, cy, 1.5, b.gem, b.trim);
  else orb(b.p, cx, cy, 1.7, 1.7, b.o >= 1 ? b.trim : b.sub);
}

function paintSickle(b: Brush): void {
  const A = axis([9, 28], [15, 17]);
  rod(b.p, A, 0, A.L, () => 1.5, b.sub, wrap);
  const cx = 17 + b.r() * 2, cy = 12, R = 9 + b.r() * 2, open = 1.6 + b.r() * .6, fat = 2 + b.r() * 1.2;
  const m: Mask = (x, y) => {
    const X = x + .5 - cx, Y = y + .5 - cy, d = Math.hypot(X, Y);
    const a = Math.atan2(Y, X);
    if (a > open || a < -2.9) return false;
    const thick = 1.3 + fat * Math.max(0, Math.cos((a + .5) * .8));
    return d <= R && d >= R - thick;
  };
  fill(b.p, m, b.main);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y) && !m(x - 1, y + 1)) b.p.set(x, y, b.main, 4);
  if (b.o >= 2) gem(b.p, 15.5, 17, 1.4, b.gem, b.trim);
  else orb(b.p, 15.5, 17, 1.4, 1.4, b.o >= 1 ? b.trim : b.main);
}

function paintMace(b: Brush): void {
  const A = axis([8, 28], [21, 7.5]);
  haft(b, A, 0, A.L - 3);
  const [cx, cy] = at(A, A.L - 1.5);
  const kind = Math.floor(b.r() * 3);
  const R = 5.2 + b.r() * .7;
  if (kind === 0) {
    // Flanged: six fins round the head.
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .3;
      const F = axis([cx, cy], [cx + Math.cos(a) * (R + 2.3), cy + Math.sin(a) * (R + 2.3)]);
      rod(b.p, F, 0, F.L, u => 1.4 - u * .12, b.main, (_u, n) => n > 0 ? 3 : 1);
    }
  } else if (kind === 1) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const F = axis([cx, cy], [cx + Math.cos(a) * (R + 2.8), cy + Math.sin(a) * (R + 2.8)]);
      rod(b.p, F, R - 1, F.L, u => Math.max(.5, (F.L - u) * .45), b.main, (_u, n) => n > 0 ? 4 : 2);
    }
  }
  orb(b.p, cx, cy, R, R, b.main);
  if (kind === 2) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .5;
    orb(b.p, cx + Math.cos(a) * (R - 1.5), cy + Math.sin(a) * (R - 1.5), .9, .9, b.o >= 1 ? b.trim : b.main, .4);
  }
  if (b.o >= 2) gem(b.p, cx, cy, b.o >= 3 ? 1.8 : 1.3, b.gem, b.trim);
}

function paintHammer(b: Brush): void {
  const A = axis([8, 28], [20, 6]);
  haft(b, A, 0, A.L - 1, 1.4);
  const hu = A.L - 4.5, len = 8 + b.r() * 1.5, deep = 4 + b.r() * .8;
  const spike = b.r() < .45;
  const head: Mask = (x, y) => {
    const [u, v] = loc(A, x, y);
    const du = Math.abs(u - hu);
    if (du <= deep && v <= len && v >= -len) return true;
    if (spike && v < -len && v > -len - 4 && du <= deep * (1 - (-len - v) / 4.4)) return true;
    return false;
  };
  fill(b.p, head, b.main);
  if (b.o >= 1) for (const s of [-1, 1]) {
    const v0 = s * (len - 1.6);
    rod(b.p, A, hu - deep, hu + deep, () => .6, b.trim, () => 3, () => v0);
  }
  const [cx, cy] = at(A, hu);
  if (b.o >= 2) gem(b.p, cx, cy, 1.4, b.gem, b.trim);
}

function paintStaff(b: Brush): void {
  const A = axis([7, 29], [22, 7]);
  const top = A.L - 5;
  rod(b.p, A, 0, top, u => 1.35 + .2 * Math.sin(u * .9), b.sub, (u, n) => (Math.floor(u) % 7 === 3 ? 1 : cyl(u, n)));
  if (b.o >= 1) for (const u of [3, top - 3]) rod(b.p, A, u - .9, u + .9, () => 1.8, b.trim, cyl);
  const [cx, cy] = at(A, top + 2.4);
  const head = Math.floor(b.r() * 3);
  const R = b.o >= 2 ? 3.8 + (b.o >= 3 ? .6 : 0) : 3.1;
  const stone = b.o >= 2 ? b.gem : b.main;
  if (head === 0) {
    // A claw of three prongs holding the stone.
    for (const s of [-1, 0, 1]) {
      const P = axis(at(A, top - .5, s * 1.2), at(A, top + 4.5, s * 3.6));
      rod(b.p, P, 0, P.L, () => 1, b.o >= 1 ? b.trim : b.sub, (_u, n) => n > 0 ? 3 : 1);
    }
    gem(b.p, cx, cy, R, stone);
  } else if (head === 1) {
    // A crook curling back over the stone.
    const m: Mask = (x, y) => { const d = Math.hypot(x + .5 - cx, y + .5 - cy); return d <= R + 2.3 && d >= R + .9 && loc(A, x, y)[1] < 1.5; };
    fill(b.p, m, b.sub);
    gem(b.p, cx, cy, R, stone);
  } else {
    // A long crystal shard, bound with a collar.
    const S = axis(at(A, top - 1), at(A, top + 7));
    rod(b.p, S, 0, S.L, u => Math.max(.55, 3 * Math.min(1, (S.L - u) / 4.5)), stone, (_u, n) => n > .3 ? 4 : n > -.3 ? 3 : 1);
    rod(b.p, A, top - 1.6, top + .2, () => 2.2, b.o >= 1 ? b.trim : b.sub, cyl);
  }
}

function paintWand(b: Brush): void {
  const A = axis([9, 26], [22.5, 9.5]);
  const top = A.L - 3;
  rod(b.p, A, 0, top, u => 1.15 + (top - u) * .03, b.sub, (u, n) => (b.o >= 1 && Math.floor(u) % 4 === 1 ? -1 : cyl(u, n)));
  if (b.o >= 1) rod(b.p, A, 0, top, () => 1.2, b.trim, (u, n) => (Math.floor(u) % 4 === 1 ? cyl(u, n) : -1));
  rod(b.p, A, 0, 4, () => 1.7, b.main, cyl);
  const [cx, cy] = at(A, top + 1.2);
  if (b.r() < .5) gem(b.p, cx, cy, b.o >= 2 ? 3.1 : 2.5, b.o >= 2 ? b.gem : b.acc, b.o >= 1 ? b.trim : undefined);
  else {
    const S = axis(at(A, top - 1), at(A, A.L + 2));
    rod(b.p, S, 0, S.L, u => Math.max(.5, 2.4 * Math.min(1, (S.L - u) / 3.5)), b.o >= 2 ? b.gem : b.acc, (_u, n) => n > .2 ? 4 : 2);
  }
}

function paintSpear(b: Brush): void {
  const A = axis([4.5, 29], [27.5, 4.5]);
  const sock = A.L - 9;
  rod(b.p, A, 0, sock, () => 1.2, b.sub, cyl);
  rod(b.p, A, sock - 1.5, sock + .5, () => 1.8, b.o >= 1 ? b.trim : b.main, cyl);
  blade(b, A, sock + .5, A.L - sock - .8, 2.5 + b.r() * .5, b.pick([1, 2, 0]), 0);
  if (b.r() < .4 || b.o >= 4) {
    // A halberd's axe on one side.
    const hu = sock + 2.5;
    fill(b.p, (x, y) => { const [u, v] = loc(A, x, y); return v < -.5 && v > -6 && Math.abs(u - hu) <= 1.6 + (-v) * .35 && v > -6 + .15 * (u - hu) ** 2; }, b.main);
  }
  // A tassel below the socket in the accent cloth.
  if (b.o >= 1) {
    const s0 = at(A, sock - 2, -.5);
    const T = axis(s0, [s0[0] + 1, s0[1] + 5]);
    rod(b.p, T, 0, T.L, u => .7 + u * .12, b.acc, (_u, n) => n > 0 ? 3 : 1);
  }
}

function paintBow(b: Brush): void {
  // Upright, a touch slanted: the limbs bow to the right of the string.
  const bend = 7 + b.r() * 2, recurve = b.r() < .5;
  const top: P2 = [10, 3.5], bot: P2 = [7, 28.5];
  const S = axis(top, bot);
  rod(b.p, S, 0, S.L, () => .5, RAMPS.paper, () => 3);
  const limb = (u: number) => -bend * Math.sin(Math.PI * u / S.L) + (recurve ? 1.4 * Math.exp(-((u - 1) ** 2) / 3) + 1.4 * Math.exp(-((u - S.L + 1) ** 2) / 3) : 0);
  rod(b.p, S, -.5, S.L + .5, u => 1.15 + .8 * Math.sin(Math.PI * Math.max(0, Math.min(1, u / S.L))), b.main, (_u, n) => n > .35 ? 3 : n > -.4 ? 2 : 1, limb);
  // The grip, and nocks at the tips.
  rod(b.p, S, S.L / 2 - 2.4, S.L / 2 + 2.4, () => 2.1, b.sub, wrap, limb);
  if (b.o >= 1) for (const u of [.6, S.L - .6]) { const [x, y] = at(S, u, limb(u)); orb(b.p, x, y, 1.1, 1.1, b.trim); }
  if (b.o >= 2) { const [x, y] = at(S, S.L / 2, limb(S.L / 2) - .3); gem(b.p, x, y, 1.3, b.gem, b.trim); }
  // An arrow nocked across, for the reading.
  const Ar = axis([5, 21], [24.5, 9]);
  rod(b.p, Ar, 0, Ar.L - 2, () => .5, RAMPS.wood, () => 3);
  rod(b.p, Ar, Ar.L - 3, Ar.L, u => Math.max(.5, (Ar.L - u) * .55), RAMPS.steel, (_u, n) => n > 0 ? 4 : 2);
  rod(b.p, Ar, 0, 2.5, () => 1.1, b.o >= 1 ? b.acc : RAMPS.ivory, (_u, n) => n > 0 ? 3 : 1);
}

function paintCrossbow(b: Brush): void {
  const A = axis([8, 28], [22, 7]);
  const butt = 6 + b.r() * 3;
  rod(b.p, A, 0, A.L, u => u < butt ? 2.4 : 1.5, b.sub, (u, n) => (b.o >= 1 && Math.abs(u - butt) < .6 ? -1 : n > .3 ? 3 : n > -.4 ? 2 : 1));
  if (b.o >= 1) rod(b.p, A, butt - .7, butt + .7, () => 1.9, b.trim, cyl);
  const pu = A.L - 3.5, wide = 10.5 + b.r() * 2.5, bend = 2 + b.r() * 2.2;
  const P = axis(at(A, pu, wide), at(A, pu, -wide));
  const sweep = (u: number) => -bend * (1 - ((u - P.L / 2) / (P.L / 2)) ** 2);
  rod(b.p, P, 0, P.L, u => 1.5 - .5 * Math.abs(u - P.L / 2) / (P.L / 2), b.main, (_u, n) => n > .3 ? 4 : n > -.3 ? 3 : 1, u => -sweep(u));
  const nut = at(A, pu - 5);
  for (const end of [at(P, .5, -sweep(.5)), at(P, P.L - .5, -sweep(P.L - .5))]) {
    const Sx = axis(end, nut);
    rod(b.p, Sx, 0, Sx.L, () => .45, RAMPS.paper, () => 3);
  }
  rod(b.p, A, pu - 1.2, pu + 1.2, () => 2.2, b.o >= 1 ? b.trim : b.main, cyl);
  if (b.o >= 2) { const [x, y] = at(A, 3); gem(b.p, x, y, 1.3, b.gem, b.trim); }
  rod(b.p, A, pu - 5, A.L + 1.5, () => .5, RAMPS.steel, u => (u > A.L ? 4 : 2));
}

function paintShield(b: Brush): void {
  const shape = b.pick(['heater', 'heater', 'round', 'kite']);
  const cx = 15.5;
  const body: Mask = shape === 'round'
    ? (x, y) => Math.hypot(x + .5 - 16, y + .5 - 16) <= 12.2
    : shape === 'kite'
      ? mirror((dx, y) => y >= 3 && y <= 29.5 && dx <= (y < 9 ? 7 + (y - 3) * .8 : 11.8 * Math.max(0, 1 - ((y - 9) / 21) ** 1.4)))
      : mirror((dx, y) => y >= 4 && y <= 29 && dx <= (y < 15 ? 11.5 : 11.5 * Math.sqrt(Math.max(0, 1 - ((y - 15) / 14.2) ** 2))));
  const inner: Mask = (x, y) => body(x, y) && body(x - 1, y) && body(x + 1, y) && body(x, y - 1) && body(x, y + 1)
    && body(x - 2, y) && body(x + 2, y) && body(x, y - 2) && body(x, y + 2);
  const rim = b.o >= 1 ? b.trim : b.main;
  fill(b.p, body, rim);
  const face = b.r() < .5 ? b.sub : b.acc;
  fill(b.p, inner, face);
  const motif = Math.floor(b.r() * 4);
  // The face's device: a chevron, a cross, a per-pale split, or quartered.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inner(x, y)) continue;
    const X = x + .5 - cx - .5, Y = y + .5;
    const on = motif === 0 ? Math.abs(Y - 14 - Math.abs(X) * .8) < 1.6
      : motif === 1 ? (Math.abs(X) < 1.6 || Math.abs(Y - 13) < 1.6)
        : motif === 2 ? X > 0
          : (X > 0) !== (Y > 15);
    if (on) { const c = b.p.get(x, y)!; b.p.set(x, y, motif >= 2 ? b.main : rim, motif >= 2 ? c.t : Math.min(4, c.t + 1)); }
  }
  if (shape === 'round') for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inner(x, y) && (x % 5 === 1)) b.p.set(x, y, b.p.get(x, y)!.r, 1);
  const [bx, by] = shape === 'round' ? [16, 16] : [16, 14];
  if (b.o >= 2) gem(b.p, bx, by, b.o >= 3 ? 2.4 : 1.8, b.gem, rim);
  else orb(b.p, bx, by, 2.2, 2.2, b.main);
  if (b.o >= 3) for (const [x, y] of shape === 'round' ? [[16, 6], [6, 16], [26, 16], [16, 26]] : [[8, 7], [23, 7], [16, 25]]) orb(b.p, x, y, 1, 1, b.trim, .3);
}

function paintTome(b: Brush): void {
  const cover = b.main;
  const tall = b.r() < .5;
  const x0 = tall ? 8 : 6, x1 = tall ? 24 : 25, y0 = tall ? 3 : 5, y1 = tall ? 28 : 26;
  fill(b.p, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, cover);
  for (let y = y0 + 1; y <= y1 - 1; y++) { b.p.set(x1 + 1, y, RAMPS.paper, y % 2 ? 3 : 2); b.p.set(x1 + 2, y, RAMPS.paper, 1); }
  for (let y = y0; y <= y1; y++) { b.p.set(x0, y, b.sub, 1); b.p.set(x0 + 1, y, b.sub, 2); }
  // Spine bands: two or three.
  const bands = b.r() < .5 ? [y0 + 3, y1 - 3] : [y0 + 3, Math.round((y0 + y1) / 2), y1 - 3];
  for (const y of bands) for (let x = x0; x <= x0 + 2; x++) b.p.set(x, y, b.o >= 1 ? b.trim : b.sub, 3);
  // Corners: metal caps on a better book.
  if (b.o >= 1) for (const [cx, cy, sx, sy] of [[x1, y0, -1, 1], [x1, y1, -1, -1]]) {
    for (let i = 0; i < 3; i++) { b.p.set(cx + sx * i, cy, b.trim, 3); b.p.set(cx, cy + sy * i, b.trim, 3); }
  }
  // The device on the cover: a diamond, a ring, a cross, or an eye.
  const cx = (x0 + 2 + x1) / 2 + .5, cy = (y0 + y1) / 2 + .5;
  const device = Math.floor(b.r() * 4);
  for (let y = y0 + 2; y <= y1 - 2; y++) for (let x = x0 + 3; x <= x1 - 1; x++) {
    const X = x + .5 - cx, Y = y + .5 - cy;
    const on = device === 0 ? Math.abs(Math.abs(X) + Math.abs(Y) - 5) < .6
      : device === 1 ? Math.abs(Math.hypot(X, Y) - 4.4) < .6
        : device === 2 ? (Math.abs(X) < .7 && Math.abs(Y) < 7) || (Math.abs(Y + 2) < .7 && Math.abs(X) < 4.5)
          : Math.abs(Math.hypot(X, Y * 2) - 5.2) < .8;
    if (on) b.p.set(x, y, b.o >= 1 ? b.trim : b.acc, X + Y < 0 ? 4 : 2);
  }
  if (b.o >= 2) gem(b.p, cx, cy, b.o >= 3 ? 2.4 : 1.8, b.gem);
  if (b.o >= 3) for (let x = x0 + 4; x <= x1 - 2; x++) { b.p.set(x, y0 + 1, b.trim, 3); b.p.set(x, y1 - 1, b.trim, 2); }
  const clasp = b.r() < .5 ? Math.round(cy) : Math.round(cy) + 5;
  for (let y = clasp - 2; y <= clasp + 1; y++) b.p.set(x1 + 2, y, b.o >= 1 ? b.trim : RAMPS.iron, y === clasp - 2 ? 4 : 2);
}

function paintHelm(b: Brush): void {
  const kind = b.pick(['great', 'open', 'winged']);
  const dome: Mask = mirror((dx, y) => {
    if (y < 5 || y > 26) return false;
    if (y < 15) return dx <= 10.5 * Math.sqrt(Math.max(0, 1 - ((15 - y) / 10.5) ** 2));
    return dx <= (kind === 'open' ? (y < 21 ? 10.5 : 10.5 - (y - 21) * .9) : 10.5 - (y - 15) * .18);
  });
  fill(b.p, dome, b.main);
  // The face: a visor slit (T or bar) or an open face with a nasal.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!dome(x, y)) continue;
    const dx = Math.abs(x - 15.5), Y = y;
    if (kind === 'open' ? (Y >= 16 && Y <= 25 && dx <= 6 && dx >= 1.5) : (Y >= 15 && Y <= 16 && dx <= 7) || (Y >= 17 && Y <= 23 && dx <= 1.2 && kind === 'great')) b.p.set(x, y, RAMPS.obsidian, Y === 15 || Y === 16 ? 0 : 1);
  }
  if (kind === 'great') for (let y = 9; y <= 26; y += 3) for (const x of [10, 21]) if (dome(x, y)) b.p.set(x, y, b.main, 4);
  // The comb ridge.
  for (let y = 5; y <= 14; y++) b.p.set(15, y, b.o >= 1 ? b.trim : b.main, 4), b.p.set(16, y, b.o >= 1 ? b.trim : b.main, 2);
  if (b.o >= 1) for (let x = 6; x <= 25; x++) if (dome(x, 26) || dome(x, 25)) { b.p.set(x, dome(x, 26) ? 26 : 25, b.trim, x < 16 ? 3 : 2); }
  if (kind === 'winged' || b.o >= 4) for (const s of [-1, 1]) {
    const W = axis([15.5 + s * 9, 12], [15.5 + s * 14.5, 4]);
    rod(b.p, W, 0, W.L, u => 1.8 - u * .17, b.o >= 1 ? b.trim : b.main, (_u, n) => n > 0 ? 3 : 1);
  }
  if (b.o >= 2) gem(b.p, 15.5, 11, b.o >= 3 ? 1.9 : 1.4, b.gem, b.trim);
  if (b.o >= 3 && kind !== 'winged') {
    // A plume in the accent cloth.
    const P = axis([16, 6], [24, 1.5]);
    rod(b.p, P, 0, P.L, u => 1.6 - u * .12, b.acc, (_u, n) => n > .2 ? 4 : n > -.4 ? 3 : 1, u => -.12 * u * u);
  }
}

function paintHood(b: Brush): void {
  const cloth = b.main;
  const peak = b.r() < .5, broad = .9 + b.r() * .35;
  const hood: Mask = mirror((dx, y) => {
    if (y < 4 || y > 28) return false;
    if (y < 16) return dx <= 11 * Math.sqrt(Math.max(0, 1 - ((16 - y) / 12.3) ** 2)) && !(peak && y < 8 && dx > (y - 3) * .9);
    return dx <= 11 + (y - 16) * .25 * broad * 1.6 - (broad < 1 ? 1 : 0);
  });
  fill(b.p, hood, cloth);
  const deep = 6 + b.r() * 1.3;
  const face: Mask = mirror((dx, y) => y >= 12 && y <= 26 && dx <= deep * Math.sqrt(Math.max(0, 1 - ((19 - y) / 7.3) ** 2)));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (face(x, y)) b.p.set(x, y, RAMPS.obsidian, y < 15 ? 1 : 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!face(x, y) && hood(x, y) && (face(x + 1, y) || face(x - 1, y) || face(x, y + 1))) b.p.set(x, y, b.o >= 1 ? b.trim : b.sub, x < 16 ? 3 : 2);
  if (b.o >= 2) { const ey = 19 + Math.floor(b.r() * 3); for (const x of [13, 18]) { b.p.set(x, ey, b.gem, 4); b.p.set(x, ey + 1, b.gem, 2); } }
  // The fold down the side and a seam (stitched, or a band) round the shoulders.
  for (let y = 9; y <= 27; y++) if (hood(9, y) && !face(9, y)) b.p.set(9, y, cloth, 1);
  const seam = b.r() < .5;
  for (let x = 4; x <= 27; x++) if (hood(x, 26) && !face(x, 26) && (!seam || x % 2 === 0)) b.p.set(x, 26, seam ? b.sub : cloth, seam ? 3 : 1);
  if (b.o >= 3) gem(b.p, 15.5, 28, 1.6, b.gem, b.trim);
  if (b.o >= 1) for (let x = 3; x <= 28; x++) if (hood(x, 28)) b.p.set(x, 28, b.trim, 2);
}

function paintCrown(b: Brush, circlet: boolean): void {
  const metal = b.main;
  if (circlet) {
    const sag = .08 + b.r() * .1;
    fill(b.p, mirror((dx, y) => y >= 15 + dx * sag && y <= 18.5 + dx * sag && dx <= 12.5), metal);
    // Wings, leaves or horns rising from the brow.
    const form = Math.floor(b.r() * 3);
    for (const s of [-1, 1]) {
      const W = axis([15.5 + s * 3, 15], [15.5 + s * (form === 2 ? 7 : 11), form === 2 ? 5 : 8]);
      rod(b.p, W, 0, W.L, u => (form === 1 ? Math.max(.6, 2.2 * Math.sin(Math.PI * u / W.L)) : 1.6 - u * .11), b.o >= 1 ? b.trim : metal,
        (_u, n) => n > 0 ? 3 : 1, u => s * (form === 2 ? -.1 : .06) * u * u);
    }
    gem(b.p, 15.5, 15, b.o >= 2 ? 2.4 : 1.6, b.o >= 2 ? b.gem : b.acc, b.o >= 1 ? b.trim : metal);
    return;
  }
  const points = b.o >= 3 ? b.pick([5, 7]) : b.pick([3, 5]);
  const tipH = 9 + b.r() * 4, round = b.r() < .35;
  const band: Mask = mirror((dx, y) => dx <= 11.5 && y >= 18 && y <= 25);
  const step = 23 / (points - 1);
  const tips: Mask = mirror((dx, y) => {
    if (dx > 11.5 || y < 4 || y >= 18) return false;
    const k = ((dx + 11.5) % step) / step;
    const near = Math.min(k, 1 - k) * step;
    const span = Math.min(2.8, step * .42);
    const h = 18 - tipH * (round ? Math.sqrt(Math.max(0, 1 - (near / span) ** 2)) : Math.max(0, 1 - near / span));
    return y >= h;
  });
  fill(b.p, (x, y) => band(x, y) || tips(x, y), metal);
  for (let x = 4; x <= 27; x++) { if (band(x, 19)) b.p.set(x, 19, metal, 4); if (band(x, 24)) b.p.set(x, 24, metal, 1); }
  const studs = b.r() < .5 ? 4 : 5;
  for (let i = 0; i < studs; i++) orb(b.p, 6.5 + i * (19 / (studs - 1)), 21.8, .9, .9, b.o >= 1 ? b.acc : metal, .4);
  if (b.o >= 2) for (let i = 0; i < points; i++) gem(b.p, 4.5 + i * step + .5, 18 - tipH + 1.6, i === (points - 1) / 2 ? 1.6 : 1.1, b.gem);
  if (b.o >= 3) gem(b.p, 15.5, 21.8, 1.8, b.gem, b.trim);
}

function paintPlate(b: Brush): void {
  const waist = 7 + b.r() * 1.5, chest = 10 + b.r() * 1.2;
  const skirt = b.r() < .45;
  const torso: Mask = mirror((dx, y) => y >= 7 && y <= (skirt ? 29 : 28) && dx <= (y < 12 ? chest - 1.5 + (y - 7) * .3 : y < 22 ? chest - (y - 12) * ((chest - waist) / 10) : skirt ? waist + (y - 22) * .5 : waist));
  fill(b.p, torso, b.main);
  for (let y = 6; y <= 10; y++) for (let x = 12; x <= 19; x++) if (Math.hypot(x - 15.5, y - 6) <= 4) b.p.clear(x, y);
  for (let x = 11; x <= 20; x++) { const y = 6 + Math.round(Math.sqrt(Math.max(0, 17 - (x - 15.5) ** 2))); b.p.set(x, y, b.o >= 1 ? b.trim : b.main, 4); }
  // The breast: a ridge, a cross of straps, or a round boss.
  const motif = Math.floor(b.r() * 3);
  if (motif === 0) for (let y = 11; y <= 21; y++) { b.p.set(15, y, b.main, 4); b.p.set(16, y, b.main, 1); }
  else if (motif === 1) for (let i = 0; i <= 10; i++) for (const s of [-1, 1]) b.p.set(Math.round(15.5 + s * (5 - i)), 11 + i, b.sub, s < 0 ? 3 : 2);
  else orb(b.p, 15.5, 15.5, 4, 4, b.main, .2);
  // Lames below: two or three, or a tasset skirt split in flaps.
  const lames = b.r() < .5 ? [22, 25] : [21, 23.5, 26];
  for (const y of lames) for (let x = 6; x <= 25; x++) if (torso(x, Math.round(y))) b.p.set(x, Math.round(y), b.main, x < 15 ? 1 : 0);
  if (skirt) for (let y = 23; y <= 29; y++) for (const x of [12, 19]) if (torso(x, y)) b.p.set(x, y, b.main, 0);
  // Pauldrons: round, layered, or spiked.
  const pauldron = Math.floor(b.r() * 3);
  for (const s of [-1, 1]) {
    const px = 15.5 + s * 10;
    orb(b.p, px, 10, 4.3, 3.6, b.o >= 3 ? b.trim : b.main);
    if (pauldron === 1) orb(b.p, px + s * .5, 12.5, 3.8, 2.4, b.main);
    if (pauldron === 2) { const S = axis([px, 8], [px + s * 2.5, 2.5]); rod(b.p, S, 0, S.L, u => Math.max(.5, 1.6 * (1 - u / S.L)), b.o >= 1 ? b.trim : b.main, (_u, n) => n > 0 ? 4 : 2); }
  }
  if (b.o >= 1) for (let x = 6; x <= 25; x++) for (const y of [28, 29]) if (torso(x, y) && !torso(x, y + 1)) b.p.set(x, y, b.trim, 2);
  if (b.o >= 1) for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const y = 12 + i * 2; for (let x = 4; x <= 27; x++) if (torso(x, y) && !torso(x + s, y) && s * (x - 15.5) > 0) b.p.set(x, y, b.trim, 3); }
  if (b.o >= 2) gem(b.p, 15.5, motif === 2 ? 15.5 : 16, b.o >= 3 ? 2 : 1.5, b.gem, b.trim);
  for (const [x, y] of [[9, 13], [22, 13], [10, 20], [21, 20]]) if (torso(x, y)) b.p.set(x, y, b.main, 4);
}

function paintRobe(b: Brush, coat: boolean): void {
  const cloth = b.main;
  const bell = b.r() < .5, flare = coat ? .18 + b.r() * .12 : .3 + b.r() * .2;
  const hem = Math.floor(b.r() * 3);
  const body: Mask = mirror((dx, y) => {
    if (y < 5) return false;
    const bottom = hem === 1 ? 29.5 - dx * .25 : hem === 2 ? 29.5 - (Math.round(dx) % 3 === 0 ? 1 : 0) : 29.5;
    if (y > bottom) return false;
    if (y < 9) return dx <= 5 + (y - 5) * 1.6;
    if (y < (bell ? 17 : 15)) return dx <= 11.5 + (coat ? 0 : 1) + (bell && y > 12 ? (y - 12) * .5 : 0);
    return dx <= (coat ? 8 : 7) + (y - 15) * flare;
  });
  fill(b.p, body, cloth);
  for (let y = 9; y <= 17; y++) for (const x of [3, 4, 5, 26, 27, 28]) if (body(x, y)) b.p.set(x, y, cloth, x < 16 ? 2 : 1);
  const cuffY = bell ? 17 : 15;
  for (let x = 0; x < N; x++) if (body(x, cuffY) && Math.abs(x - 15.5) > 8.5) b.p.set(x, cuffY, b.o >= 1 ? b.trim : b.sub, 3);
  // The neck: a V, or a high collar.
  const collar = b.r() < .4;
  if (collar) { for (let x = 11; x <= 20; x++) for (const y of [4, 5]) b.p.set(x, y, b.sub, y === 4 ? 3 : 2); }
  else for (let y = 5; y <= 11; y++) { const w = Math.max(0, (11 - y) * .55); for (let x = Math.round(15.5 - w); x <= Math.round(15.5 + w); x++) b.p.clear(x, y); }
  for (let y = 11; y <= 29; y++) if (body(15, y)) { b.p.set(15, y, coat ? b.sub : cloth, coat ? 2 : 1); if (coat && y % 4 === 1) b.p.set(16, y, b.trim, 4); }
  const waistY = 15 + Math.floor(b.r() * 3);
  for (let x = 6; x <= 25; x++) for (const y of [waistY, waistY + 1]) if (body(x, y)) b.p.set(x, y, coat ? RAMPS.leather : b.acc, y === waistY ? 3 : 1);
  orb(b.p, 15.5, waistY + .8, 1.4, 1.2, b.o >= 1 ? b.trim : RAMPS.brass);
  if (b.o >= 1) for (let x = 2; x <= 29; x++) for (let y = 26; y <= 30; y++) if (body(x, y) && !body(x, y + 1)) b.p.set(x, y, b.trim, 2);
  if (b.o >= 2) gem(b.p, 15.5, waistY + 6.5, 1.5, b.gem, b.trim);
  // An embroidered run of stitches, two patterns by seed.
  const dots = b.r() < .5;
  if (b.o >= 3) for (let y = waistY + 3; y <= 27; y += 2) for (const x of dots ? [10, 21] : [11, 20]) if (body(x, y)) b.p.set(x, y, b.trim, dots ? 3 : (y % 4 ? 3 : 4));
}

function paintGloves(b: Brush): void {
  const metal = b.r() < .5;
  const mat = b.main;
  const flare = .15 + b.r() * .35, long = b.r() < .4;
  const hand: Mask = (x, y) => {
    const X = x + .5, Y = y + .5;
    if (Y >= 11 && Y <= 21 && X >= 10 && X <= 22) return true;
    for (let i = 0; i < 4; i++) { const fx = 10 + i * 3; if (X >= fx && X <= fx + 3 && Y >= 4.5 + Math.abs(i - 1.3) * 1.3 && Y <= 12) return true; }
    if (X >= 6 && X <= 10.5 && Y >= 13 && Y <= 18 - (10.5 - X) * .2) return true;
    return Y >= 21 && Y <= (long ? 30 : 28) && X >= 9 - (Y - 21) * flare && X <= 23.5 + (Y - 21) * flare;
  };
  fill(b.p, hand, mat);
  for (let i = 0; i < 3; i++) for (let y = 6; y <= 11; y++) { const x = 13 + i * 3; if (hand(x, y)) b.p.set(x, y, mat, 0); }
  if (metal) for (let i = 0; i < 4; i++) { const fx = 11 + i * 3; b.p.set(fx, 12, mat, 4); b.p.set(fx + 1, 12, mat, 2); b.p.set(fx - 1 + (i ? 0 : 1), 7, mat, 3); }
  else for (let x = 11; x <= 21; x += 2) b.p.set(x, 17, b.sub, 3);
  for (let x = 10; x <= 22; x++) b.p.set(x, 14, mat, 1);
  const cuff = b.o >= 1 ? b.trim : b.sub;
  for (let y = 21; y <= 30; y++) for (let x = 3; x <= 29; x++) if (hand(x, y) && (y === 21 || y === 22 || !hand(x, y + 2))) b.p.set(x, y, cuff, y === 21 ? 4 : 2);
  if (b.o >= 2) gem(b.p, 16.5, 25.5, b.o >= 3 ? 1.8 : 1.4, b.gem, b.trim);
  else orb(b.p, 16.5, 25.5, 1.1, 1.1, mat, .3);
}

function paintBoots(b: Brush): void {
  const leather = b.main;
  const shaft = 11 + Math.floor(b.r() * 4), toe = 6 + b.r() * 2.5, pointy = b.r() < .35;
  const boot = (ox: number, oy: number): Mask => (x, y) => {
    const X = x + .5 - ox, Y = y + .5 - oy;
    if (Y >= 13 - shaft && Y <= 13 && X >= 0 && X <= 7) return true;
    const reach = 7 + Math.min(toe, (Y - 13) * 1.3) + (pointy && Y > 16 ? 1.5 : 0);
    return Y > 13 && Y <= 19 && X >= 0 && X <= reach - (pointy && Y < 17 ? 1 : 0);
  };
  const back = boot(14, 6), front = boot(6, 9);
  fill(b.p, back, leather);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (back(x, y)) { const c = b.p.get(x, y)!; b.p.set(x, y, leather, Math.max(0, c.t - 1)); }
  fill(b.p, front, leather);
  const strap = b.r() < .5;
  for (const [m, ox, oy] of [[back, 14, 6], [front, 6, 9]] as const) {
    const top = oy + 13 - shaft;
    for (let x = ox - 1; x <= ox + 8; x++) for (const y of [top, top + 1, top + 2]) if (m(x, y) || x === ox - 1 || x === ox + 8) b.p.set(x, y, b.o >= 1 ? b.trim : b.sub, y === top ? 4 : 2);
    for (let x = ox; x <= ox + 16; x++) if (m(x, oy + 19) || m(x, oy + 18)) b.p.set(x, oy + 19, RAMPS.iron, 2);
    for (let x = ox + 8; x <= ox + 15; x++) if (m(x, oy + 16)) b.p.set(x, oy + 16, b.o >= 2 ? b.trim : leather, 3);
    if (strap) for (let x = ox; x <= ox + 7; x++) b.p.set(x, oy + 9, b.sub, 2), x === ox + 5 && b.p.set(x, oy + 9, b.o >= 1 ? b.trim : RAMPS.brass, 4);
    else for (let y = top + 4; y <= oy + 12; y += 3) b.p.set(ox + 3, y, b.sub, 3);
  }
  if (b.o >= 2) gem(b.p, 9.5, 9 + 13 - shaft + 4.5, 1.2, b.gem);
  if (b.o >= 3) gem(b.p, 17.5, 6 + 13 - shaft + 4.5, 1.2, b.gem);
}

function paintLegs(b: Brush): void {
  const mat = b.main;
  const taper = .05 + b.r() * .12, gap = 1 + b.r() * .8;
  const legs: Mask = mirror((dx, y) => {
    if (y < 4 || y > 29) return false;
    if (y < 9) return dx <= 10.5;
    return dx <= 10.5 - (y - 9) * taper && dx >= gap + (y - 9) * .03;
  });
  fill(b.p, legs, mat);
  for (let x = 4; x <= 27; x++) for (const y of [4, 5, 6]) if (legs(x, y)) b.p.set(x, y, b.o >= 1 ? b.trim : b.sub, y === 4 ? 4 : 2);
  orb(b.p, 15.5, 5.5, 1.5, 1.3, b.o >= 2 ? b.gem : RAMPS.brass);
  const knee = Math.floor(b.r() * 3), stripe = b.r() < .5;
  for (const s of [-1, 1]) {
    const kx = 15.5 + s * 6;
    if (knee === 0) orb(b.p, kx, 17, 3, 2.6, b.o >= 3 ? b.trim : mat);
    else if (knee === 1) { orb(b.p, kx, 16, 3.2, 2, b.o >= 3 ? b.trim : mat); orb(b.p, kx, 18.5, 3, 1.6, mat); }
    else for (let y = 15; y <= 19; y++) for (let x = Math.round(kx - 3); x <= Math.round(kx + 2); x++) if (legs(x, y)) b.p.set(x, y, b.o >= 3 ? b.trim : mat, y === 15 ? 4 : y === 19 ? 1 : 3);
    for (let y = 21; y <= 28; y++) b.p.set(Math.round(kx) - (s > 0 ? 1 : 0), y, mat, s < 0 ? 4 : 3);
    if (stripe) for (let y = 8; y <= 28; y++) { const x = Math.round(15.5 + s * (10 - (y - 9) * taper)) - (s > 0 ? 1 : 0); if (legs(x, y)) b.p.set(x, y, b.o >= 1 ? b.trim : b.sub, 2); }
    if (b.o >= 1) for (let x = Math.round(kx - 4); x <= Math.round(kx + 4); x++) if (legs(x, 29)) b.p.set(x, 29, b.trim, 2);
  }
  if (b.o >= 2) for (const s of [-1, 1]) gem(b.p, 15.5 + s * 6, 17, 1, b.gem);
}

function paintBelt(b: Brush): void {
  const strap = b.main;
  // A belt laid in a gentle curve, its buckle in front and a pouch hung on one side.
  const S = axis([2.5, 13], [29.5, 13]);
  const sag = (u: number) => -3.2 * Math.sin(Math.PI * u / S.L);
  rod(b.p, S, 0, S.L, () => 2.6, strap, (u, n) => n > .55 ? 3 : n < -.6 ? 1 : (Math.floor(u) % 4 === 0 && b.o >= 1 ? 4 : 2), sag);
  if (b.o >= 1) for (let u = 2; u < S.L; u += 4) { const [x, y] = at(S, u, sag(u)); b.p.set(Math.floor(x), Math.floor(y), b.trim, 4); }
  // Buckle.
  const [bx, by] = at(S, S.L / 2, sag(S.L / 2));
  fill(b.p, (x, y) => Math.abs(x + .5 - bx) <= 4 && Math.abs(y + .5 - by) <= 4.2, b.o >= 1 ? b.trim : RAMPS.iron);
  fill(b.p, (x, y) => Math.abs(x + .5 - bx) <= 2 && Math.abs(y + .5 - by) <= 2.2, strap, { flat: 1 });
  if (b.o >= 2) gem(b.p, bx, by, 1.5, b.gem);
  else for (let y = Math.round(by) - 2; y <= Math.round(by) + 1; y++) b.p.set(Math.round(bx), y, RAMPS.steel, 3);
  // The pouch.
  const side = b.r() < .5 ? 8 : 23;
  fill(b.p, (x, y) => Math.abs(x + .5 - side) <= 3.6 && y + .5 >= by + 3 && y + .5 <= by + 12 - Math.abs(x + .5 - side) * .3, b.sub);
  for (let x = side - 3; x <= side + 3; x++) b.p.set(x, Math.round(by) + 5, b.sub, 4);
}

function paintRing(b: Brush): void {
  const metal = b.main;
  const cx = 16, cy = 18.5, thick = 2.4 + b.r() * 1.6, wide = 8.4 + b.r() * 1.4;
  const band: Mask = (x, y) => {
    const X = (x + .5 - cx) / wide, Y = (y + .5 - cy) / 7.5, Xi = (x + .5 - cx) / (wide - thick), Yi = (y + .5 - cy) / (7.5 - thick);
    return X * X + Y * Y <= 1 && Xi * Xi + Yi * Yi > 1;
  };
  fill(b.p, band, metal);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!band(x, y)) continue;
    const a = Math.atan2(y + .5 - cy, x + .5 - cx);
    // The torus's light: bright on the top-left of the band, dark at its inner lower edge.
    const lit = -Math.cos(a + .8);
    b.p.set(x, y, metal, lit > .55 ? 4 : lit > .1 ? 3 : lit > -.5 ? 2 : 1);
  }
  // Engraving on a plain band; a set stone from uncommon up (a small one), rare (big, with prongs).
  const notch = 2 + Math.floor(b.r() * 3);
  if (b.o === 0) for (let x = 11; x <= 20; x += notch) b.p.set(x, 26, metal, 1);
  const square = b.r() < .4;
  if (b.o >= 1 && square) {
    const R = b.o >= 2 ? 3 : 2.2;
    fill(b.p, (x, y) => Math.abs(x + .5 - cx) <= R + 1 && Math.abs(y + .5 - 11.5) <= R + 1, b.trim);
    fill(b.p, (x, y) => Math.abs(x + .5 - cx) + Math.abs(y + .5 - 11.5) * .9 <= R + .6, b.gem);
    b.p.set(Math.round(cx) - 2, 10, RAMPS.glass, 4);
  } else if (b.o >= 1) {
    const R = b.o >= 2 ? 3.4 + (b.o >= 3 ? .4 : 0) : 2.2;
    const gy = 11.5 - (R - 2.2) * .4;
    fill(b.p, (x, y) => Math.abs(x + .5 - cx) <= R * .7 && y + .5 >= gy && y + .5 <= gy + R + 2, b.o >= 3 ? b.trim : metal);
    gem(b.p, cx, gy, R, b.gem);
    if (b.o >= 2) for (const s of [-1, 1]) for (const dy of [-1, 1]) b.p.set(Math.round(cx + s * (R - .3)) - (s > 0 ? 1 : 0), Math.round(gy + dy * (R * .6)), b.trim, 4);
  }
  if (b.o >= 4) for (const s of [-1, 1]) gem(b.p, cx + s * 6.5, 16, 1.1, b.acc);
}

function paintAmulet(b: Brush): void {
  const chain = b.o >= 1 ? b.trim : b.sub;
  // The chain from the top corners to the pendant.
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = 5 + t * 22, y = 3 + Math.sin(Math.PI * t) * 10;
    if (i % 2 === 0) b.p.set(Math.round(x), Math.round(y), chain, i < 15 ? 3 : 2);
  }
  const cx = 16, cy = 20;
  const kind = Math.floor(b.r() * 3);
  const body: Mask = kind === 0 ? (x, y) => Math.hypot(x + .5 - cx, (y + .5 - cy) * 1.05) <= 7.2
    : kind === 1 ? (x, y) => { const X = Math.abs(x + .5 - cx), Y = y + .5 - cy; return Y >= -7 && Y <= 9 && X <= (Y < 0 ? 6.4 * Math.sqrt(1 - (Y / 7.2) ** 2) : 6.4 * (1 - Y / 9.2)); }
      : (x, y) => Math.abs(x + .5 - cx) + Math.abs(y + .5 - cy) * .82 <= 7.6;
  fill(b.p, body, b.main);
  const inner: Mask = (x, y) => body(x, y) && body(x - 2, y) && body(x + 2, y) && body(x, y - 2) && body(x, y + 2);
  if (b.o >= 3) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (body(x, y) && !inner(x, y)) b.p.set(x, y, b.trim, b.p.get(x, y)!.t);
  orb(b.p, cx, cy - 8, 1.2, 1.2, chain);
  gem(b.p, cx, cy, b.o >= 2 ? 3.6 : 2.6, b.o >= 2 ? b.gem : b.acc);
  if (b.o >= 4) for (const s of [-1, 1]) gem(b.p, cx + s * 4.6, cy + 3.5, 1, b.acc);
}

function paintTrinket(b: Brush): void {
  // A medallion on a ribbon: a coin-stamped disc with its device.
  const cx = 16, cy = 18;
  // The hanging loop, a ring of the trim metal.
  fill(b.p, (x, y) => { const d = Math.hypot(x + .5 - cx, y + .5 - 7.5); return d <= 2.9 && d >= 1.4; }, b.o >= 1 ? b.trim : b.main);
  orb(b.p, cx, cy, 8.3, 8.3, b.main);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    if (d <= 8.3 && d > 6.8) b.p.set(x, y, b.o >= 1 ? b.trim : b.main, b.p.get(x, y)?.t ?? 2);
  }
  const device = Math.floor(b.r() * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const X = x + .5 - cx, Y = y + .5 - cy;
    const on = device === 0 ? (Math.abs(X) < 1 && Math.abs(Y) < 4.5) || (Math.abs(Y) < 1 && Math.abs(X) < 4.5)
      : device === 1 ? Math.abs(Math.hypot(X, Y) - 3.4) < .7
        : Math.abs(Math.abs(X) - Math.abs(Y)) < .8 && Math.hypot(X, Y) < 5;
    if (on) b.p.set(x, y, b.main, X + Y < 0 ? 4 : 1);
  }
  if (b.o >= 2) gem(b.p, cx, cy, b.o >= 3 ? 2 : 1.5, b.gem);
}

function paintCharm(b: Brush): void {
  // A knotted cord, two beads, and a carved token (a fang, a stone disc, a leaf).
  const C = axis([16, 3], [16, 12]);
  rod(b.p, C, 0, C.L, () => .7, b.sub, (_u, n) => n > 0 ? 3 : 1, u => .9 * Math.sin(u * 1.2));
  for (const [x, y] of [[16, 8], [16, 12]]) orb(b.p, x, y, 1.5, 1.5, b.o >= 1 ? b.trim : b.acc);
  const kind = Math.floor(b.r() * 3);
  if (kind === 0) {
    const F = axis([16, 14], [17.5, 29]);
    rod(b.p, F, 0, F.L, u => Math.max(.5, 3.4 * (1 - u / F.L)), b.main, (_u, n) => n > .3 ? 4 : n > -.3 ? 3 : 1, u => .02 * u * u);
  } else if (kind === 1) {
    orb(b.p, 16, 21, 6.4, 6, b.main);
    for (let a = 0; a < 6; a++) b.p.set(Math.round(16 + Math.cos(a) * 3.2), Math.round(21 + Math.sin(a) * 3), b.acc, 3);
  } else {
    const L = axis([16, 14], [16, 29]);
    rod(b.p, L, 0, L.L, u => Math.max(.5, 5 * Math.sin(Math.PI * u / L.L)), b.main, (_u, n) => Math.abs(n) < .15 ? 4 : n > 0 ? 3 : 1);
  }
  if (b.o >= 2) gem(b.p, 16, 21, 1.5, b.gem);
}

function paintRune(b: Brush): void {
  fill(b.p, mirror((dx, y) => y >= 4 && y <= 28 && dx <= 8.5 - Math.max(0, 7 - y) * .8 - Math.max(0, y - 25) * .9), b.main);
  // A seeded glyph of strokes, cut and glowing.
  const strokes: [P2, P2][] = [];
  strokes.push([[16, 9], [16, 24]]);
  for (let i = 0; i < 3; i++) {
    const y0 = 9 + Math.floor(b.r() * 13), s = b.r() < .5 ? -1 : 1;
    strokes.push([[16, y0], [16 + s * (3 + Math.floor(b.r() * 3)), y0 + (b.r() < .5 ? -3 : 3)]]);
  }
  for (const [a, c] of strokes) rod(b.p, axis(a, c), 0, Math.hypot(c[0] - a[0], c[1] - a[1]), () => .6, b.gem, () => (b.o >= 2 ? 4 : 3));
}

function paintPotion(b: Brush): void {
  const liquid = b.gem;
  orb(b.p, 16, 20, 8.2, 8, RAMPS.glass);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + .5 - 16, y + .5 - 20);
    if (d <= 7 && y >= 17) b.p.set(x, y, liquid, d < 3 && y < 21 ? 4 : x > 18 ? 1 : y > 24 ? 1 : 3);
  }
  fill(b.p, (x, y) => x >= 13 && x <= 18 && y >= 6 && y <= 12, RAMPS.glass);
  fill(b.p, (x, y) => x >= 12 && x <= 19 && y >= 3 && y <= 6, RAMPS.wood);
  b.p.set(11, 16, RAMPS.glass, 4); b.p.set(11, 17, RAMPS.glass, 4); b.p.set(12, 15, RAMPS.glass, 4);
}

function paintMaterial(b: Brush): void {
  fill(b.p, (x, y) => { const X = x + .5 - 16, Y = y + .5 - 19; return X * X / 100 + Y * Y / 56 <= 1 + .12 * Math.sin(Math.atan2(Y, X) * 5); }, b.main);
  for (let i = 0; i < 3 + b.o; i++) {
    const x = 9 + Math.floor(b.r() * 14), y = 14 + Math.floor(b.r() * 9);
    const S = axis([x, y + 2], [x + (b.r() - .5) * 4, y - 3 - b.r() * 3]);
    rod(b.p, S, 0, S.L, u => Math.max(.5, 1.6 * (1 - u / S.L)), b.gem, (_u, n) => n > 0 ? 4 : 2);
  }
}

const PAINTERS: Readonly<Record<GearBase, (b: Brush) => void>> = {
  sword: b => paintSword(b, false), greatsword: b => paintSword(b, true), dagger: paintDagger, axe: paintAxe,
  mace: paintMace, hammer: paintHammer, staff: paintStaff, wand: paintWand, spear: paintSpear, bow: paintBow,
  crossbow: paintCrossbow, pickaxe: paintPickaxe, sickle: paintSickle, shield: paintShield, tome: paintTome,
  helm: paintHelm, hood: paintHood, crown: b => paintCrown(b, false), circlet: b => paintCrown(b, true),
  plate: paintPlate, robe: b => paintRobe(b, false), coat: b => paintRobe(b, true), gloves: paintGloves,
  boots: paintBoots, legs: paintLegs, belt: paintBelt, ring: paintRing, amulet: paintAmulet, trinket: paintTrinket,
  charm: paintCharm, rune: paintRune, potion: paintPotion, material: paintMaterial,
};

/** What each base is mostly made of, when the item names no material of its own. */
const MAIN_ROLE: Readonly<Partial<Record<GearBase, keyof Kit>>> = {
  hood: 'cloth', robe: 'cloth', coat: 'leather', boots: 'leather', belt: 'leather', gloves: 'leather',
  bow: 'wood', crossbow: 'wood', tome: 'cloth', charm: 'wood', material: 'metal',
};

/** The painted cells (null for clear) — what the spec reads; deterministic per look. */
export function paintGearCells(look: GearLook): readonly ({ c: string; a: number } | null)[] {
  const kit = kitOf(look.realm);
  const o = ornamentOf(look.rarity);
  const rnd = rng(hash(`${look.base}|${look.seed}`));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length) % list.length];
  const role = MAIN_ROLE[look.base] ?? 'metal';
  const main = look.mat ?? (kit[role] as Material);
  const sub = look.sub ?? (role === 'metal' ? kit.wood === main ? kit.leather : (['staff', 'wand', 'spear', 'axe', 'mace', 'hammer', 'pickaxe'].includes(look.base) ? kit.wood : kit.leather) : kit.leather);
  const acc = look.acc ?? kit.trim;
  // The seed chooses the stone: half the time the item's own accent, else one of its realm's.
  const gemMat = rnd() < .5 && look.acc ? look.acc : pick(kit.gems);
  const trim: Material = o >= 3 ? (acc === main ? 'gold' : kit.trim === main ? 'gold' : kit.trim) : (kit.trim === main ? 'brass' : kit.trim);
  const brush: Brush = {
    p: new Pic(), r: rnd, o, kit, pick,
    main: RAMPS[main], sub: RAMPS[sub === main ? (main === 'leather' ? 'wood' : 'leather') : sub], trim: RAMPS[trim],
    gem: RAMPS[gemMat], acc: RAMPS[acc],
  };
  PAINTERS[look.base](brush);
  return finish(brush.p, o, look.rarity ?? 'common', rnd).map(c => (c.c ? c : null));
}

const cache = new Map<string, ArtEntry>();
/** Cache key: everything that changes the picture. */
export function gearKey(look: GearLook): string {
  return [look.base, look.realm ?? '', look.rarity ?? '', look.seed, look.mat ?? '', look.sub ?? '', look.acc ?? ''].join('|');
}

/** The icon for a look, as a data-URI SVG (64 × 64 display, 32 × 32 art px). Cached. */
export function gearIcon(look: GearLook): ArtEntry {
  const key = gearKey(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const cells = paintGearCells(look).map(c => c ?? { c: '', a: 0 });
  const made: ArtEntry = { src: `data:image/svg+xml,${encodeURIComponent(svgOf(cells))}`, srcset: '', width: 64, height: 64 };
  if (cache.size > 2000) cache.clear();
  cache.set(key, made);
  return made;
}
