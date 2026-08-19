/**
 * forge-scene.model.ts — what the WebGL forge background is made of, as data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE NUMBERS LIVE HERE AND NOT IN THE SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything in this file is pure: no `window`, no `three`, no DOM. That is the
 * point. The service that owns the renderer cannot be imported on the server
 * and cannot be unit-tested without a GL context, so every decision that can be
 * argued about — how many particles a phone gets, which colours a realm burns
 * in, when the frame governor gives up a tier — is pulled out to here where a
 * spec can hold it to account.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUDGET IS A TOTAL, NOT A PER-LAYER ALLOWANCE
 * ─────────────────────────────────────────────────────────────────────────────
 * `QUALITY_TIERS` counts every vertex the scene draws, wisp trail segments
 * included. A phone gets 200 and a desktop 500, and a tier that adds up to more
 * than its own `budget` is a bug the spec fails on — it is far too easy to add
 * "just a few more" to one layer and quietly double the draw.
 */

/** The five realms, by the name their painted sigil carries. */
export type ScenePalette =
  | 'forge'
  | 'luminous'
  | 'umbral'
  | 'celestial'
  | 'verdant'
  | 'infernal';

/** Two colours per palette: the ember core and the ember edge. */
export interface PaletteColors {
  /** Hot centre of an ember. */
  hot: string;
  /** Cooler outer embers and the majority of the field. */
  cool: string;
  /** The nebula wash behind everything. */
  fog: string;
}

/**
 * `forge` is the default and the one every non-realm route burns in: the orange
 * and gold of a working forge. The five realms take the accent their badge,
 * their sigil glow and their page wash already use (see realm.model.ts) so a
 * player walking into Umbral sees the same violet in the air as on the walls.
 */
export const PALETTES: Record<ScenePalette, PaletteColors> = {
  forge:     { hot: '#ffb347', cool: '#ff7a18', fog: '#2a1044' },
  luminous:  { hot: '#fff3b0', cool: '#e8d44d', fog: '#3a2f10' },
  umbral:    { hot: '#d8b4fe', cool: '#a855f7', fog: '#25103f' },
  celestial: { hot: '#c8f4ff', cool: '#00d4ff', fog: '#0d2a3d' },
  verdant:   { hot: '#8ff0c4', cool: '#10b981', fog: '#0d2f24' },
  infernal:  { hot: '#ffb3a0', cool: '#ef4444', fog: '#3a1010' },
};

/**
 * Route → palette, on the first two path segments.
 *
 * `/world/realms/<sigil>` is the only place a realm is the *subject* of the
 * page, so it is the only place the air changes colour. Tool pages carry a
 * realm badge but they are workbenches, not places, and re-tinting the whole
 * atmosphere for one would make the forge look like it moved.
 */
export function paletteForPath(path: string): ScenePalette {
  const clean = path.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'world' && parts[1] === 'realms' && parts[2]) {
    const named = parts[2] as ScenePalette;
    return named in PALETTES && named !== 'forge' ? named : 'forge';
  }
  return 'forge';
}

/** How much of the scene a device is allowed to draw. */
export interface QualityTier {
  id: 'high' | 'medium' | 'low';
  /** Upward-drifting forge sparks. The layer the scene is actually about. */
  embers: number;
  /** Tiny slow motes for depth. */
  dust: number;
  /** Large slow travellers. Each one draws `trail` vertices. */
  wisps: number;
  /** Vertices per wisp, head included. */
  trail: number;
  /** Every vertex the tier draws. Asserted against the sum in the spec. */
  budget: number;
  /** Renderer pixel ratio ceiling. Fill rate, not vertex count, is the phone's problem. */
  maxPixelRatio: number;
}

/**
 * Three tiers, and the device picks the top one it is allowed.
 *
 * `low` is not a device class — it is where the frame governor lands a machine
 * that could not hold its assigned tier. A 2019 phone starts at `medium` and
 * falls to `low` on its own if 30fps does not happen.
 */
export const QUALITY_TIERS: Record<QualityTier['id'], QualityTier> = {
  high:   { id: 'high',   embers: 300, dust: 160, wisps: 8, trail: 5, budget: 500, maxPixelRatio: 1.75 },
  medium: { id: 'medium', embers: 120, dust: 64,  wisps: 4, trail: 4, budget: 200, maxPixelRatio: 1.5 },
  low:    { id: 'low',    embers: 60,  dust: 32,  wisps: 2, trail: 4, budget: 100, maxPixelRatio: 1 },
};

/** Vertices a tier actually draws. Kept beside the table it has to agree with. */
export function tierVertexCount(tier: QualityTier): number {
  return tier.embers + tier.dust + tier.wisps * tier.trail;
}

/** The tier a device starts on, before the governor has an opinion. */
export function startingTier(opts: {
  coarsePointer: boolean;
  viewportWidth: number;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
}): QualityTier['id'] {
  const small = opts.coarsePointer || opts.viewportWidth < 768;
  if (small) return 'medium';
  // A desktop with two cores or 2GB is a desktop in name only.
  if ((opts.hardwareConcurrency ?? 8) <= 2) return 'medium';
  if ((opts.deviceMemoryGb ?? 8) <= 2) return 'medium';
  return 'high';
}

/**
 * The frame governor.
 *
 * Sampling is deliberately coarse — one verdict per second, and two bad seconds
 * in a row before anything moves. A single stuttering second is a route change
 * or a texture upload, not a machine that cannot hold the tier, and demoting on
 * one would mean every navigation cost the visitor a quality step they never
 * got back.
 */
export const GOVERNOR = {
  /** Sample window, ms. */
  windowMs: 1000,
  /** Below this for `strikes` consecutive windows, drop a tier. */
  minFps: 20,
  strikes: 2,
} as const;

/** Next tier down, or null at the bottom. */
export function demote(id: QualityTier['id']): QualityTier['id'] | null {
  if (id === 'high') return 'medium';
  if (id === 'medium') return 'low';
  return null;
}

/** `#rrggbb` → three floats in 0..1, for a shader uniform. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
