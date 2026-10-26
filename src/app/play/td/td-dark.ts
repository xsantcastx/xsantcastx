/**
 * td-dark.ts — the mystery layer's rules (design-bible §5.3 "things that exist only in the dark", §5.4 the Hush,
 * roadmap §10 items 7 and 14). Pure: numbers, seeded rolls and the hand-placed data. The runtime (the shapes, the
 * footsteps, the chests, the roads, the omens) lives in td-dark-layer; the engine hands it each frame.
 *
 * The rule over everything here: **dark-born never ambush.** Nothing in this file hurts, takes, blocks or chases. The
 * shapes step back from light and never come closer than its edge; the footsteps are prints, never a body; a chest is
 * only shy; a Nightroad never vanishes under the Keeper's feet; the Hush pays a little and frightens a little.
 */
import { hashSeed, seededRandom } from '../../shared/loot/champions';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';

// ── The Hush (§5.4) ─────────────────────────────────────────────────────────────

export const HUSH_MAX = 100;
/** The player's cap (Menu → Sound: "The Hush"): full dark, quiet dark (the bell at most), or none at all. */
export type HushCap = 'full' | 'quiet' | 'off';
export const HUSH_CAPS: readonly HushCap[] = ['full', 'quiet', 'off'];
export const HUSH_CAP_VALUE: Readonly<Record<HushCap, number>> = { full: 100, quiet: 59, off: 0 };
/** The Hush wakes from this Keeper level on, and never on the starter island (the bible: off below 10 and on Ember Isle). */
export const HUSH_MIN_LEVEL = 10;
export const HUSH_QUIET_LANDS: readonly string[] = ['ember-isle'];

/** Where the Keeper stands, as the Hush reads it. */
export interface HushPlace {
  /**
   * The Keeper's own hand on how fast the Hush rises (S5, the Hush-rate hook: skill-book-stand-ins.md "New work"): a
   * multiplier from his marks — Moth Hours, the shutters closed, reads 0.5. It never touches the Hush falling.
   */
  keeper?: number;
  /** A dark level (a dungeon floor, a cellar). */
  dark: boolean;
  /** Its floor number (1 = the first floor down); 0 on the surface. */
  depth: number;
  phase: SkyPhase;
  /** A town, a village, a lit building (an inn, a house): safe and warm. */
  town: boolean;
  /** Inside a lit hearth's ring. */
  hearth: boolean;
  /** Beside a fixed light (a torch post, a lantern, a lamp): the dark keeps back. */
  lamp: boolean;
  /** The Keeper's own light is raised (the Light spell, a light relic, a lantern-pet). */
  lit: boolean;
}

/** Per-second rates. Rising is slow (minutes); falling in warmth is quick (seconds). */
export const HUSH_RATE = {
  /** A dark floor: base + per floor down (floor 1 ≈ 7 min to 30, floor 6 ≈ 2½ min). */
  floorBase: .04, floorStep: .03,
  /** The open land after dark (outside every town). */
  night: .05, eclipse: .1,
  /** Dark floors feel the sky above them too. */
  floorNight: 1.5, floorEclipse: 2,
  /** A raised light halves the rise. */
  litShare: .5,
  /** Falling: a hearth or a town, a lamp, plain daylight. */
  warm: -10, lamp: -2, day: -.5,
} as const;
/** Sudden steps: a dark-born seen stepping out of the light; a note read in the dark. */
export const HUSH_BUMP = { unveiled: 5, note: 3 } as const;

/** The floor number of a hand-drawn level ('molten-deep-4' → 4; a cellar '…-0' → 1). Not a floor: 0. */
export function floorDepth(levelId: string, dark: boolean): number {
  if (!dark || levelId === 'surface') return 0;
  const m = /-(\d+)$/.exec(levelId);
  return Math.max(1, m ? Number(m[1]) : 1);
}

/** How fast the Hush moves where the Keeper stands (per second; negative falls). */
export function hushRate(p: HushPlace): number {
  if (p.town || p.hearth) return HUSH_RATE.warm;
  if (p.lamp) return HUSH_RATE.lamp;
  let up = 0;
  if (p.dark) {
    up = HUSH_RATE.floorBase + HUSH_RATE.floorStep * Math.max(1, p.depth);
    up *= p.phase === 'eclipse' ? HUSH_RATE.floorEclipse : p.phase === 'night' ? HUSH_RATE.floorNight : 1;
  } else if (p.phase === 'eclipse') up = HUSH_RATE.eclipse;
  else if (p.phase === 'night') up = HUSH_RATE.night;
  if (up <= 0) return HUSH_RATE.day;
  const k = p.keeper !== undefined && p.keeper >= 0 ? p.keeper : 1;
  return (p.lit ? up * HUSH_RATE.litShare : up) * k;
}

/** Is the Hush awake at all for this Keeper here? */
export function hushAwake(level: number, continent: string): boolean {
  return level >= HUSH_MIN_LEVEL && !HUSH_QUIET_LANDS.includes(continent);
}

/** One step of the Hush: never above the cap, never below 0; asleep, it drains as in warmth. */
export function stepHush(h: number, dt: number, place: HushPlace, cap: HushCap, awake: boolean): number {
  const top = HUSH_CAP_VALUE[cap];
  const rate = awake ? hushRate(place) : HUSH_RATE.warm;
  return Math.max(0, Math.min(top, Math.min(HUSH_MAX, h + rate * Math.max(0, dt))));
}

/** A bump (a dark-born unveiled, a note read), kept under the cap. */
export function bumpHush(h: number, by: number, cap: HushCap, awake: boolean): number {
  return awake ? Math.max(0, Math.min(HUSH_CAP_VALUE[cap], h + by)) : h;
}

/** 0 still · 1 the bell (30+) · 2 the shapes lean in (60+) · 3 the edge of the world thins (90+). */
export type HushBand = 0 | 1 | 2 | 3;
export function hushBand(h: number): HushBand { return h >= 90 ? 3 : h >= 60 ? 2 : h >= 30 ? 1 : 0; }

/** What the dark pays, by band: Magic Find (percent points) and a Hunting XP multiplier. Capped at the top band. */
export const HUSH_BOONS: readonly { mf: number; xp: number }[] = [
  { mf: 0, xp: 1 }, { mf: 5, xp: 1 }, { mf: 10, xp: 1.1 }, { mf: 15, xp: 1.15 },
];
export function hushBoon(h: number): { mf: number; xp: number } { return HUSH_BOONS[hushBand(h)]; }

// ── Omens: sound and sight only ─────────────────────────────────────────────────

export type OmenKind = 'bell' | 'flicker' | 'whisper' | 'name';
/** How many whisper lines there are (dark.whisper.1 …). */
export const WHISPERS = 8;

/** The omens a band may bring (never at 0). Quiet dark tops out at band 1: the bell alone. */
export function omensOf(band: HushBand): readonly OmenKind[] {
  return band >= 3 ? ['bell', 'flicker', 'whisper', 'name'] : band === 2 ? ['bell', 'flicker', 'whisper'] : band === 1 ? ['bell'] : [];
}
/** Seconds until the next omen in a band: rarer when the dark is light, never a storm. Null: none. */
export function omenGap(band: HushBand, rnd: () => number): number | null {
  if (band === 0) return null;
  const [lo, hi] = band === 1 ? [45, 75] : band === 2 ? [22, 40] : [12, 24];
  return lo + (hi - lo) * rnd();
}
/** The next omen: its kind and which whisper line it speaks. */
export function pickOmen(band: HushBand, rnd: () => number): { kind: OmenKind; line: number } | null {
  const kinds = omensOf(band);
  if (!kinds.length) return null;
  return { kind: kinds[Math.floor(rnd() * kinds.length)], line: 1 + Math.floor(rnd() * WHISPERS) };
}

// ── Light and the dark-born (§5.3) ──────────────────────────────────────────────

/** A light on the ground: where, and its radius (art px; the hole the engine cuts in the dark). */
export interface LightSpot { x: number; y: number; r: number }
/** The share of a light's radius that is truly lit (the engine's light sprite is solid to 55%, fading out by 100%). */
export const LIT_SHARE = .72;

/** How far past the nearest light's lit edge a point lies (negative: inside the light). */
export function pastLight(x: number, y: number, lights: readonly LightSpot[]): number {
  let best = Infinity;
  for (const l of lights) best = Math.min(best, Math.hypot(x - l.x, y - l.y) - l.r * LIT_SHARE);
  return best;
}

/** The Unrecorded: a shape at the edge of the light. */
export interface Shape {
  x: number; y: number;
  /** 0 unseen … SHAPE.alpha fully there. */
  alpha: number;
  /** Seconds it has stood; it leaves by itself after `life`. */
  age: number; life: number;
  /** 'stand' at the edge, 'back' stepping off from an approaching light, 'gone' unveiled and leaving. */
  state: 'stand' | 'back' | 'gone';
  seed: number;
}
export const SHAPE = {
  /** It stands this far past the lit edge (closer when the Hush is deep). */
  gap: 26, gapDeep: 12,
  /** It steps back when a light comes within this of it; it leaves when the light falls on it. */
  wary: 14,
  /** Stepping back, unveiled-and-leaving (px/s), and fades (alpha/s). */
  back: 22, flee: 46, fadeIn: .6, fadeOut: 2.2,
  alpha: .78, life: [9, 16] as const,
  /** At most this many at once (effects-spec budget: a mystery, not a crowd). */
  max: 2,
} as const;

/** Where a new shape stands: on the ring just past the lit edge round the Keeper's light, at an angle. */
export function shapeSpot(cx: number, cy: number, r: number, angle: number, deep: boolean): { x: number; y: number } {
  const d = r * LIT_SHARE + (deep ? SHAPE.gapDeep : SHAPE.gap);
  return { x: cx + Math.cos(angle) * d, y: cy + Math.sin(angle) * d * .8 };
}

/**
 * One step of a shape. It never moves toward anything: it stands, steps straight back from a light coming close,
 * and leaves (fading) the moment light falls on it. Returns 'unveiled' on the frame light first falls on it.
 */
export function stepShape(s: Shape, lights: readonly LightSpot[], dt: number): 'unveiled' | null {
  s.age += dt;
  let near: LightSpot | null = null, past = Infinity;
  for (const l of lights) { const p = Math.hypot(s.x - l.x, s.y - l.y) - l.r * LIT_SHARE; if (p < past) { past = p; near = l; } }
  let told: 'unveiled' | null = null;
  if (s.state !== 'gone' && past < 0) { s.state = 'gone'; told = 'unveiled'; }
  else if (s.state !== 'gone') s.state = past < SHAPE.wary ? 'back' : 'stand';
  if (near && s.state !== 'stand') {
    const dx = s.x - near.x, dy = s.y - near.y, d = Math.hypot(dx, dy) || 1, v = s.state === 'gone' ? SHAPE.flee : SHAPE.back;
    s.x += dx / d * v * dt; s.y += dy / d * v * dt;
  }
  const leaving = s.state === 'gone' || s.age >= s.life;
  s.alpha = leaving ? Math.max(0, s.alpha - SHAPE.fadeOut * dt) : Math.min(SHAPE.alpha, s.alpha + SHAPE.fadeIn * dt);
  return told;
}
/** A shape that has faded away after leaving. */
export function shapeDone(s: Shape): boolean { return (s.state === 'gone' || s.age >= s.life) && s.alpha <= 0; }

/** Shapes come where it is dark enough: a dark floor, or the open land after dark (never in a town's safety). */
export function darkBornHere(dark: boolean, phase: SkyPhase, safe: boolean): boolean {
  return !safe && (dark || phase === 'night' || phase === 'eclipse');
}
/** Seconds between shapes, by band: rare at first, more often as the Hush deepens (still never more than SHAPE.max). */
export function shapeGap(band: HushBand, rnd: () => number): number {
  const [lo, hi] = band >= 2 ? [8, 16] : band === 1 ? [14, 26] : [20, 40];
  return lo + (hi - lo) * rnd();
}

/** Hollow Footsteps: prints behind the Keeper, just past his light. A spell of them, now and then, while he walks. */
export const STEPS = { every: .55, life: 4.5, max: 12, spell: [5, 9] as const, gap: [25, 50] as const } as const;
/** The breadcrumb (oldest last-walked first) the next print falls on: the newest one already past the Keeper's light. */
export function printSpot(trail: readonly { x: number; y: number }[], kx: number, ky: number, reach: number): { x: number; y: number } | null {
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i];
    if (Math.hypot(p.x - kx, p.y - ky) > reach * LIT_SHARE + 8) return p;
  }
  return null;
}

// ── Shade-bound chests ──────────────────────────────────────────────────────────

/** A chest that is only there while the light on it is low; opening one in light fails. Hand-placed, tiles. */
export interface ShadeChestDef { id: string; level: string; c: number; r: number }
export const SHADE_CHESTS: readonly ShadeChestDef[] = [
  { id: 'galleries', level: 'ember-mine-2', c: 21, r: 4 },
  { id: 'bone-hall', level: 'ashen-crypt-2', c: 9, r: 10 },
  { id: 'smithies', level: 'forge-of-four-2', c: 42, r: 12 },
  { id: 'sporewell', level: 'root-hollows-2', c: 41, r: 18 },
  { id: 'cloister', level: 'drowned-crypts-2', c: 1, r: 13 },
];
/** What lights a chest's spot: the Keeper's raised light, a lantern-pet out, a fixed light near it. */
export interface ChestLight { raised: number; petLight: boolean; fixed: boolean }
/** Shown only when the light is low: the Keeper's bare light and Glim's are low; anything raised hides it. */
export function shadeChestShown(l: ChestLight): boolean { return l.raised <= 0 && !l.petLight && !l.fixed; }
/** A chest's Gold: three of the floor's piles, never a fortune. */
export const CHEST_GOLD_PILES = 3;

// ── Nightroads ──────────────────────────────────────────────────────────────────

/** A plank way over water that is only there at night or under an eclipse, to a nook with a note. Tiles. */
export interface NightroadDef {
  id: string;
  continent: string;
  /** The planks, shore to nook (each over water by day). */
  road: readonly (readonly [number, number])[];
  /** The nook: a small square of old stone in the water. */
  nook: { c: number; r: number; w: number; h: number };
  /** The note's tile, on the nook. */
  note: readonly [number, number];
}
const line = (c0: number, r: number, c1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let c = c0; c0 <= c1 ? c <= c1 : c >= c1; c += c0 <= c1 ? 1 : -1) for (const dr of [0, 1]) out.push([c, r + dr]);
  return out;
};
export const NIGHTROADS: readonly NightroadDef[] = [
  // Ashwater Lake, north of the square: from the east shore over the water to a stone left in the lake.
  { id: 'ashwater', continent: 'ember-isle', road: line(32, -4, 29), nook: { c: 26, r: -4, w: 3, h: 3 }, note: [27, -3] },
  // Off the Hushed Barrow's coast: the dead's own jetty, out over the Burning Sea.
  { id: 'barrow', continent: 'ember-isle', road: line(-64, -28, -69), nook: { c: -74, r: -29, w: 5, h: 4 }, note: [-72, -28] },
  // Below the Ember Shrine: steps into the sea that only the night remembers.
  { id: 'shrine', continent: 'ember-isle', road: line(-70, 44, -74), nook: { c: -79, r: 43, w: 5, h: 4 }, note: [-77, 44] },
];

/** Open: night or an eclipse — or the Keeper still standing on it or on its nook (it never vanishes underfoot). */
export function nightroadOpen(phase: SkyPhase, standingOn: boolean): boolean {
  return phase === 'night' || phase === 'eclipse' || standingOn;
}
/** Its planks' opacity, eased toward open/closed (reduced motion: at once). Dusk shows a faint trace of it. */
export function nightroadFade(now: number, open: boolean, phase: SkyPhase, dt: number, still: boolean): number {
  const target = open ? 1 : phase === 'dusk' ? .12 : 0;
  if (still) return target;
  const step = dt / 2.5;
  return now < target ? Math.min(target, now + step) : Math.max(target, now - step);
}

const roadKeys = new Map<string, Set<number>>();
const key = (c: number, r: number) => (c + 0x8000) * 0x10000 + (r + 0x8000);
/** Every plank tile on a continent (a Set of packed keys, built once). */
function roadsOf(continent: string): Set<number> {
  let s = roadKeys.get(continent);
  if (!s) { s = new Set(); for (const n of NIGHTROADS) if (n.continent === continent) for (const [c, r] of n.road) s.add(key(c, r)); roadKeys.set(continent, s); }
  return s;
}
export function onNightroad(continent: string, c: number, r: number): boolean { return roadsOf(continent).has(key(c, r)); }
/** The Nightroad (by its road or nook) under a tile, if any. */
export function nightroadAt(continent: string, c: number, r: number): NightroadDef | null {
  for (const n of NIGHTROADS) {
    if (n.continent !== continent) continue;
    if (c >= n.nook.c && c < n.nook.c + n.nook.w && r >= n.nook.r && r < n.nook.r + n.nook.h) return n;
    if (n.road.some(([a, b]) => a === c && b === r)) return n;
  }
  return null;
}
/** A nook tile (old stone in the water, there by day too — only the road is not). */
export function onNook(continent: string, c: number, r: number): boolean {
  for (const n of NIGHTROADS) if (n.continent === continent && c >= n.nook.c && c < n.nook.c + n.nook.w && r >= n.nook.r && r < n.nook.r + n.nook.h) return true;
  return false;
}

/** A session's seeded source for the dark's own rolls. */
export function darkRandom(salt: string): () => number { return seededRandom(hashSeed(`dark|${salt}`)); }
