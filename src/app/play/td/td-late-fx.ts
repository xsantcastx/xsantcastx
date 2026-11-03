/**
 * td-late-fx.ts — the pictures of the rows 30–50 (S9, docs/design/skills-100.md §0.6 and each row's "Anim / FX" line;
 * docs/design/effects-spec.md's rules).
 *
 * Whole art pixels, three tones per element, ground under the creatures and air over them at ≤ 60% where it covers a
 * body, a still frame under reduced motion (never no picture), and a Low path that draws the core only: one tone, a
 * third of the pieces, no drifting particles — phone-cheap (every picture here is a handful of fillRects a frame).
 *
 * The engine calls: `drawLateZones` (on the floor: a rain cloud's shadow and its streaks, a fog bank, the moth swarm,
 * the thornrain's ring, thorny ground), `drawLateGround` (a cracked quake ring, rime on the ground, a cone of flame),
 * `drawLateAir` (the moment effects: a lightning leap, a strike from the sky and its ring tell, a puff of moth dust,
 * Glim's ring, the hunter's leaf, a leap's arc) and `drawLateState` (what lasts: the leaf over the Marked, a Shock's
 * spark, a Wet foe's droplet, a revealed foe's cream corners).
 */
import { conePixels, groundRing, linePixels, sq, type Tones } from './td-fx';
import { envDetail } from './td-detail';

type Ctx = CanvasRenderingContext2D;

/** The palettes (effects-spec rule 2): lightning, rime, the lantern's moths, fog, rain, the hunter's leaf. */
export const LATE_FX: Readonly<Record<'storm' | 'rime' | 'moth' | 'fog' | 'rain' | 'leaf' | 'stone' | 'ember', Tones>> = {
  storm: { core: '#ffffff', body: '#fff2a8', edge: '#ffe36d' },
  rime: { core: '#ffffff', body: '#cfefff', edge: '#8fd8ff' },
  moth: { core: '#fffbe8', body: '#e9dcc0', edge: '#a89b84' },
  fog: { core: '#e4eaf0', body: '#c4ced8', edge: '#8a96a6' },
  rain: { core: '#e8f6ff', body: '#a8c8e8', edge: '#5a7a9a' },
  leaf: { core: '#e8f5b0', body: '#8fc25a', edge: '#4a6b2a' },
  stone: { core: '#fffbe8', body: '#f0d890', edge: '#a8874a' },
  ember: { core: '#fff2a8', body: '#ffb347', edge: '#e2552a' },
};

const WILD: Tones = { core: '#f0fff8', body: '#9af0d0', edge: '#4cb898' };
const AIR = new Set(['lc-quake', 'lc-cone', 'lc-chain', 'lc-strike', 'lc-tell', 'lc-dust', 'lc-glim', 'lc-leaf', 'lc-leap']);
const GROUND = new Set(['lc-rime']);
export function isLateFx(kind: string): boolean { return AIR.has(kind) || GROUND.has(kind); }
const low = () => envDetail() === 'low';

interface FxLike { kind: string; x: number; y: number; age: number; life: number; dir: number; r?: number; a?: number; w?: number; tx?: number; ty?: number; el?: string }
interface ZoneLike { kind: string; x: number; y: number; r: number; t: number; every?: number }
interface MobLike { x: number; y: number; hp: number; def: { h: number; w: number }; shockT?: number; wetT?: number; glimT?: number }

/** A jagged line from (x0, y0) to (x1, y1): three segments, offset a pixel or two, fresh each frame (`seed`). */
function bolt(c: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number, tones: Tones, still: boolean): void {
  const n = 3, pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < n; i++) {
    const k = i / n, j = still ? (i % 2 ? 2 : -2) : ((seed * 7 + i * 13) % 5) - 2;
    pts.push({ x: x0 + (x1 - x0) * k + j, y: y0 + (y1 - y0) * k - j });
  }
  pts.push({ x: x1, y: y1 });
  // A 2-px white-hot core with a 1-px yellow glow either side (it reads at the iso zoom and on a phone).
  for (let i = 0; i < n; i++) {
    const seg = linePixels(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    c.fillStyle = tones.edge; for (const q of seg) c.fillRect(q.x - 1, q.y - 1, 4, 3);
    c.fillStyle = tones.core; for (const q of seg) c.fillRect(q.x, q.y, 2, 1);
  }
}

/** The floor's pieces of S9: the cloud's shadow and rain, the fog bank, the moths, the thornrain, thorny ground. */
export function drawLateZones(c: Ctx, zones: readonly ZoneLike[], time: number, still: boolean): void {
  const lo = low();
  for (const z of zones) {
    const X = Math.round(z.x), Y = Math.round(z.y), R = Math.round(z.r), fade = Math.min(1, z.t / .5);
    if (z.kind === 'cloud') {
      // A grey disc of shadow on the ground, slanted streaks of rain inside it, a few puddle dots.
      c.globalAlpha = .4 * fade; c.fillStyle = LATE_FX.rain.edge;
      for (const [i, q] of groundRing(R).entries()) if (i % 2 === 0) c.fillRect(X + q.x, Y + q.y, 1, 1);
    } else if (z.kind === 'fog') {
      // Two stepped bands of the fog's grey, a soft-edged disc (stepped alpha, never a blur).
      const rows = lo ? 3 : 6;
      for (let j = 0; j < rows; j++) {
        const k = 1 - j / rows, rr = Math.round(R * k), drift = still ? 0 : Math.round(Math.sin(time * .6 + j) * 3);
        c.globalAlpha = (lo ? .3 : .16) * fade; c.fillStyle = j % 2 ? LATE_FX.fog.body : LATE_FX.fog.core;
        c.fillRect(X - rr + drift, Y - Math.round(rr * sq(.5)), rr * 2, Math.max(1, Math.round(rr * sq(.5) * 2)));
      }
    } else if (z.kind === 'moths') {
      // The swarm's reach on the floor: a faint cream ring (the moths themselves fly in the air pass, drawLateZoneAir).
      c.globalAlpha = .35 * fade; c.fillStyle = LATE_FX.moth.body;
      for (const [i, q] of groundRing(R).entries()) if (i % (lo ? 6 : 3) === 0) c.fillRect(X + q.x, Y + q.y, 2, 1);
    } else if (z.kind === 'thornrain') {
      // The ring it falls in: a 2-px green edge, every other step lit (the thorns fall in the air pass).
      c.globalAlpha = .75 * fade;
      for (const [i, q] of groundRing(R).entries()) if (i % (lo ? 4 : 2) === 0) { c.fillStyle = i % 4 ? LATE_FX.leaf.body : LATE_FX.leaf.core; c.fillRect(X + q.x, Y + q.y, 2, 1); }
    } else if (z.kind === 'thorny') {
      c.globalAlpha = .6 * fade;
      for (const [i, q] of groundRing(Math.max(4, R - 4)).entries()) if (i % (lo ? 9 : 5) === 0) { c.fillStyle = i % 2 ? LATE_FX.leaf.edge : LATE_FX.stone.body; c.fillRect(X + q.x, Y + q.y - 2, 1, 2); }
    }
  }
  c.globalAlpha = 1;
}

/** Ground pictures (under the creatures): a cracked ring, rime left by a lance, a cone of flame. Returns whether it drew. */
export function drawLateGround(c: Ctx, e: FxLike, still: boolean): boolean {
  if (!GROUND.has(e.kind)) return false;
  if (e.age < 0) return true;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), fade = still ? 1 : Math.max(0, 1 - t), lo = low();
  if (e.kind === 'lc-rime') {
    // Rime where the lance passed: four pale pixels on the ground, a second.
    c.globalAlpha = .8 * fade; c.fillStyle = LATE_FX.rime.body;
    c.fillRect(X - 3, Y, 2, 1); c.fillRect(X + 1, Y + 1, 2, 1);
    if (!lo) { c.fillStyle = LATE_FX.rime.core; c.fillRect(X - 1, Y - 1, 1, 1); c.fillRect(X + 3, Y, 1, 1); }
  }
  c.globalAlpha = 1;
  return true;
}

/** Air pictures (over the creatures, ≤ 60% where they cover one). Returns whether the kind is S9's (the engine then skips it). */
export function drawLateAir(c: Ctx, e: FxLike, still: boolean, overFoe: (x: number, y: number) => boolean): boolean {
  if (!isLateFx(e.kind)) return false;
  if (GROUND.has(e.kind) || e.age < 0) return true;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), fade = still ? 1 : Math.max(0, 1 - t), lo = low();
  const a = (x: number, y: number, k = 1) => (overFoe(x, y) ? Math.min(.6, k * fade) : k * fade);
  if (e.kind === 'lc-quake') {
    // A shockwave on the ground: a low-alpha filled disc, a bright 2-px ring running out with a hot rim, and 6–8 pieces
    // thrown up (embers for Pyre Strike, dust and grit for the Watchquake and the Golem, leaves for the Elder Beast).
    // Its 3–4 frame pulse: it runs out in the first 40% of its life and fades after. Reduced motion: full size, held.
    const tn = e.el === 'ember' ? LATE_FX.ember : e.el === 'life' ? WILD : LATE_FX.stone, R = e.r ?? 24;
    const k = still ? 1 : Math.min(1, t / .4), r = Math.max(3, Math.round(R * (.25 + .75 * (1 - (1 - k) * (1 - k))))), f = still ? 1 : t < .4 ? 1 : 1 - (t - .4) / .6;
    const ring = groundRing(r);
    if (!lo) { c.globalAlpha = .3 * f; c.fillStyle = tn.body; for (let yy = -Math.round(r / 2); yy <= Math.round(r / 2); yy += 2) { const w = Math.round(Math.sqrt(Math.max(0, 1 - (2 * yy / r) ** 2)) * r); c.fillRect(X - w, Y + yy, w * 2, 1); } }
    c.globalAlpha = Math.min(1, .95 * f);
    for (const [i, q] of ring.entries()) { if (lo && i % 2) continue; c.fillStyle = i % 3 ? tn.body : tn.edge; c.fillRect(X + q.x - 1, Y + q.y - 1, 3, 2); }
    // The crack behind the wave: a second, darker ring a little inside it.
    if (!lo && r > 8) { c.fillStyle = tn.edge; for (const [i, q] of groundRing(r - 5).entries()) if (i % 2 === 0) c.fillRect(X + q.x, Y + q.y, 2, 1); }
    if (!lo) { c.fillStyle = tn.core; for (const [i, q] of ring.entries()) if (i % 3 === 0) c.fillRect(X + q.x, Y + q.y - 1, 1, 1); }
    const bits = lo ? 3 : 7;
    for (let i = 0; i < bits; i++) {
      const ang = i / bits * Math.PI * 2 + (X % 7), d = r * (.6 + (i % 3) * .15), up = Math.round((still ? .5 : Math.min(1, t * 2)) * (6 + (i % 3) * 3));
      c.globalAlpha = f; c.fillStyle = i % 2 ? tn.core : tn.body;
      c.fillRect(X + Math.round(Math.cos(ang) * d), Y + Math.round(Math.sin(ang) * d / 2) - up, 2, 2);
    }
  } else if (e.kind === 'lc-cone') {
    // Kiln Breath: the cone filled in stepped bands of flame, cream at the mouth, orange, then red at the tips, its edge
    // in the ember's dark. The bands are cut once per angle step (coneBands), drawn one fillStyle a band; the fill sits at
    // 60% (it covers bodies: effects-spec rule 3), so no per-pixel test is needed.
    const ang0 = Math.round((e.a ?? 0) / (Math.PI / 16)) * (Math.PI / 16), half = (e.w ?? 60) * Math.PI / 360, L = e.r ?? 80;
    const cone = coneBands(L, half, ang0, lo ? 3 : 5), tones = [LATE_FX.ember.core, LATE_FX.ember.body, LATE_FX.ember.body, LATE_FX.ember.edge, LATE_FX.ember.edge];
    c.globalAlpha = .6;
    cone.bands.forEach((band, b) => { c.fillStyle = tones[Math.min(tones.length - 1, Math.round(b * (tones.length - 1) / Math.max(1, cone.bands.length - 1)))]; for (let i = 0; i < band.length; i += lo ? 2 : 1) c.fillRect(X + band[i].x, Y + band[i].y - 4, 2, 2); });
    c.globalAlpha = .9; c.fillStyle = LATE_FX.ember.edge;
    for (let i = 0; i < cone.edge.length; i += lo ? 2 : 1) c.fillRect(X + cone.edge[i].x, Y + cone.edge[i].y - 4, 1, 1);
    // Embers flicking off the tips (Normal only).
    if (!lo && !still) { c.fillStyle = LATE_FX.ember.core; for (let i = 0; i < 4; i++) { const ang = ang0 + ((i * 37 + Math.floor(e.age * 40)) % 9 - 4) / 8 * half, d = L * (.9 + i * .03); c.fillRect(X + Math.round(Math.cos(ang) * d), Y + Math.round(Math.sin(ang) * d) - 7 - i, 1, 1); } }
  } else if (e.kind === 'lc-chain') {
    // A lightning leap (or Heartseeker's white line, `dir` 2; an archer's arrow, 3): a jagged 1-px line, redrawn each frame.
    const tx = Math.round(e.tx ?? X), ty = Math.round(e.ty ?? Y);
    c.globalAlpha = a(tx, ty);
    if (e.dir >= 2) { c.fillStyle = e.dir === 3 ? LATE_FX.leaf.core : '#ffffff'; for (const q of linePixels(X, Y, tx, ty)) c.fillRect(q.x, q.y, 2, 1); }
    else if (lo) { c.globalAlpha = Math.max(.6, a(tx, ty)); c.fillStyle = LATE_FX.storm.edge; for (const q of linePixels(X, Y, tx, ty)) c.fillRect(q.x, q.y, 2, 2); }
    else {
      bolt(c, X, Y, tx, ty, Math.floor(e.age * 60), LATE_FX.storm, still);
      // Chain of Lamps: lamp-lit links strung along the leap (a brass ring every few pixels).
      if (e.dir === 1) { const L = linePixels(X, Y, tx, ty); c.fillStyle = '#ffd27a'; for (let i = 3; i < L.length - 2; i += 6) { const q = L[i]; c.fillRect(q.x - 1, q.y - 1, 3, 1); c.fillRect(q.x - 1, q.y + 1, 3, 1); c.fillRect(q.x - 1, q.y, 1, 1); c.fillRect(q.x + 1, q.y, 1, 1); } }
    }
    if (!lo) { c.fillStyle = LATE_FX.storm.core; c.fillRect(tx - 1, ty - 1, 3, 1); c.fillRect(tx, ty - 2, 1, 3); }
  } else if (e.kind === 'lc-strike') {
    // A strike from the top of the screen: a three-segment vertical bolt and a scorch; the flash is a white square at
    // most a quarter strong, and not under reduced motion.
    c.globalAlpha = a(X, Y - 20);
    bolt(c, X + 4, Y - 120, X, Y, Math.floor(e.age * 50), LATE_FX.storm, still);
    if (!still && !lo && t < .15) { c.globalAlpha = .25; c.fillStyle = '#ffffff'; c.fillRect(X - 10, Y - 14, 20, 14); }
    c.globalAlpha = .6 * fade; c.fillStyle = '#2a2228'; c.fillRect(X - 3, Y, 6, 1); c.fillRect(X - 2, Y + 1, 4, 1);
  } else if (e.kind === 'lc-tell') {
    // A white ring tell on the ground where the strike will land, pulsing (still: full size).
    const R = e.r ?? 24, pulse = still ? 1 : .6 + .4 * Math.abs(Math.sin(e.age * 18));
    c.globalAlpha = .8 * pulse;
    for (const [i, q] of groundRing(R).entries()) if (i % (lo ? 4 : 2) === 0) { c.fillStyle = i % 4 ? LATE_FX.storm.body : '#ffffff'; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  } else if (e.kind === 'lc-dust') {
    // A cream-grey puff of moth dust that drifts and fades (a ring of it for Dust Storm, `dir` 2).
    const n = lo ? 5 : 12, R = e.r ?? 36, dir = e.a ?? 0;
    for (let i = 0; i < n; i++) {
      const k = (i % 4) / 4, spread = e.dir === 2 ? i / n * Math.PI * 2 : dir + ((i % 5) - 2) * .25;
      const d = (still ? .5 : Math.min(1, t * 1.5)) * R * (.4 + .6 * k), px = X + Math.round(Math.cos(spread) * d), py = Y + Math.round(Math.sin(spread) * d * sq(.5)) - Math.round((still ? .5 : t) * 4);
      c.globalAlpha = a(px, py, .8); c.fillStyle = i % 3 ? LATE_FX.moth.body : LATE_FX.moth.edge; c.fillRect(px, py, 1, 1);
    }
  } else if (e.kind === 'lc-glim') {
    // Glim's flight: a ring of cream dust flying out to the margin's edge, Glim's spark at its head.
    const R = e.r ?? 128, r = Math.round(R * (still ? 1 : Math.min(1, t * 2))), ring = groundRing(r), head = still ? 0 : Math.floor(t * ring.length * 2) % Math.max(1, ring.length);
    c.globalAlpha = .7 * fade;
    for (const [i, q] of ring.entries()) if (i % (lo ? 8 : 4) === 0) { c.fillStyle = LATE_FX.moth.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
    const g = ring[head];
    if (g) { c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.fillRect(X + g.x - 1, Y + g.y - 9, 3, 3); c.fillStyle = LATE_FX.moth.body; c.fillRect(X + g.x, Y + g.y - 8, 1, 1); }
  } else if (e.kind === 'lc-leaf') {
    c.globalAlpha = a(X, Y);
    leaf(c, X, Y, still ? 0 : e.age * 4);
  } else if (e.kind === 'lc-leap') {
    // A leap's arc: leaves (the wild's) or embers (Pyre Strike's, `dir` 2) along a rising curve between the two ends.
    const tx = e.tx ?? X, ty = e.ty ?? Y, tn = e.dir === 2 ? LATE_FX.ember : LATE_FX.leaf, n = lo ? 4 : 9;
    for (let i = 0; i <= n; i++) {
      const k = i / n, px = Math.round(X + (tx - X) * k), py = Math.round(Y + (ty - Y) * k - Math.sin(k * Math.PI) * 12) - 10;
      if (!still && k > t * 1.6) continue;
      c.globalAlpha = a(px, py, .9); c.fillStyle = i % 2 ? tn.body : tn.core; c.fillRect(px, py, 1, 1);
    }
  }
  c.globalAlpha = 1;
  return true;
}

const bandCache = new Map<string, { bands: { x: number; y: number }[][]; edge: { x: number; y: number }[] }>();
/** A cone's dither split into `n` bands by distance from its mouth (td-fx conePixels), cached per shape. */
function coneBands(L: number, half: number, a: number, n: number): { bands: { x: number; y: number }[][]; edge: { x: number; y: number }[] } {
  const key = `${L}|${half.toFixed(3)}|${a.toFixed(2)}|${n}`, hit = bandCache.get(key);
  if (hit) return hit;
  const cone = conePixels(L, half, a), bands: { x: number; y: number }[][] = Array.from({ length: n }, () => []);
  for (const q of cone.fill) bands[Math.min(n - 1, Math.floor(Math.hypot(q.x, q.y) / L * n))].push(q);
  if (bandCache.size > 48) bandCache.clear();
  const out = { bands, edge: cone.edge };
  bandCache.set(key, out);
  return out;
}

/**
 * What flies over S9's zones, upright (the air pass, anchored per piece through `at`): the Moth Swarm's moths (4–6 px,
 * pale, flickering wings; Low: three still moths), the Thornrain's falling thorns with bright tips (Low: three), and the
 * rain cloud's streaks. Reduced motion: every piece still, where it was.
 */
export function drawLateZoneAir(c: Ctx, zones: readonly ZoneLike[], time: number, still: boolean, at?: (x: number, y: number) => void): void {
  const lo = low();
  for (const z of zones) {
    const X = Math.round(z.x), Y = Math.round(z.y), R = Math.round(z.r), fade = Math.min(1, z.t / .5);
    if (z.kind === 'moths') {
      const n = Math.max(4, Math.min(17, z.every ?? 12)), shown = lo ? 3 : n;
      for (let i = 0; i < shown; i++) {
        const ang = (still || lo ? 0 : time * .9) + i / shown * Math.PI * 2, rr = R * (.7 + (i % 3) * .12);
        const mx = X + Math.round(Math.cos(ang) * rr), foot = Y + Math.round(Math.sin(ang) * rr * .5), flap = still || lo ? 0 : Math.floor(time * 12 + i) % 2;
        at?.(mx, foot);
        const my = foot - 12 - (i % 3) * 2;
        c.globalAlpha = fade;
        // Two pale wings (3×2 each) either side of a dark body: up on one frame, spread on the next.
        c.fillStyle = LATE_FX.moth.edge; c.fillRect(mx, my - 1, 1, 4);
        c.fillStyle = flap ? LATE_FX.moth.body : LATE_FX.moth.core;
        if (flap) { c.fillRect(mx - 3, my - 3, 3, 2); c.fillRect(mx + 1, my - 3, 3, 2); }
        else { c.fillRect(mx - 3, my, 3, 2); c.fillRect(mx + 1, my, 3, 2); }
        c.fillStyle = '#ffffff'; c.fillRect(mx - 2, flap ? my - 3 : my, 1, 1); c.fillRect(mx + 2, flap ? my - 3 : my, 1, 1);
      }
    } else if (z.kind === 'thornrain') {
      const n = lo ? 3 : 8;
      for (let i = 0; i < n; i++) {
        const ang = i * 2.39996, d = ((i * 37) % 10) / 10 * R, sx = X + Math.round(Math.cos(ang) * d), sy = Y + Math.round(Math.sin(ang) * d * .5);
        const f = still || lo ? .5 : ((time * 2.4 + i * .37) % 1);
        at?.(sx, sy);
        const top = sy - Math.round(30 * (1 - f)) - 4;
        c.globalAlpha = fade;
        // A thorn: a 1-px green shaft 4 long, its bright tip below, a darker fletch above.
        c.fillStyle = LATE_FX.leaf.edge; c.fillRect(sx, top - 2, 1, 2);
        c.fillStyle = LATE_FX.leaf.body; c.fillRect(sx, top, 1, 4);
        c.fillStyle = LATE_FX.leaf.core; c.fillRect(sx, top + 4, 1, 2); c.fillStyle = '#ffffff'; c.fillRect(sx, top + 5, 1, 1);
      }
    } else if (z.kind === 'cloud') {
      const n = lo ? 4 : 12;
      for (let i = 0; i < n; i++) {
        const ang = i * 2.39996, d = (i / n) * R * .9, sx = X + Math.round(Math.cos(ang) * d), sy = Y + Math.round(Math.sin(ang) * d * .5);
        const f = still || lo ? 2 : Math.floor(time * 12 + i * 3) % 6;
        at?.(sx, sy);
        c.globalAlpha = .8 * fade; c.fillStyle = i % 3 ? LATE_FX.rain.body : LATE_FX.rain.core;
        c.fillRect(sx - f, sy - 18 + f * 3, 1, 4);
      }
    }
  }
  c.globalAlpha = 1;
}

/** The hunter's leaf sigil: a green leaf of five pixels, turning slowly (`turn` in radians). */
function leaf(c: Ctx, X: number, Y: number, turn: number): void {
  const w = Math.round(Math.cos(turn) * 2);
  c.fillStyle = LATE_FX.leaf.edge; c.fillRect(X - Math.abs(w) - 1, Y, Math.abs(w) * 2 + 3, 1);
  c.fillStyle = LATE_FX.leaf.body; c.fillRect(X - Math.abs(w), Y - 1, Math.abs(w) * 2 + 1, 1); c.fillRect(X, Y - 2, 1, 1);
  c.fillStyle = LATE_FX.leaf.core; c.fillRect(X, Y - 1, 1, 1);
  c.fillStyle = LATE_FX.leaf.edge; c.fillRect(X, Y + 1, 1, 2);
}

/** What lasts on a creature: the leaf over the Marked, a Shock's spark, a Wet foe's droplet, a revealed foe's corners. */
export function drawLateState(c: Ctx, s: { mobs: readonly MobLike[]; hunted: MobLike | null }, time: number, still: boolean, at?: (x: number, y: number) => void): void {
  const lo = low();
  for (const m of s.mobs) {
    if (m.hp <= 0) continue;
    const marked = s.hunted === m, sh = (m.shockT ?? 0) > 0, wet = (m.wetT ?? 0) > 0, glim = (m.glimT ?? 0) > 0;
    if (!marked && !sh && !wet && !glim) continue;
    at?.(m.x, m.y);
    const X = Math.round(m.x), top = Math.round(m.y - m.def.h);
    c.globalAlpha = 1;
    if (marked) leaf(c, X, top - 8, still ? 0 : time * 1.5);
    if (sh) { const f = still ? 0 : Math.floor(time * 12) % 2; c.fillStyle = LATE_FX.storm.edge; c.fillRect(X + 5, top - 2 + f, 1, 2); c.fillStyle = '#ffffff'; c.fillRect(X + 6, top - 1 - f, 1, 1); }
    if (wet) { c.fillStyle = LATE_FX.rain.body; c.fillRect(X - 6, top - 1, 1, 2); c.fillStyle = LATE_FX.rain.core; c.fillRect(X - 6, top - 2, 1, 1); }
    if (glim && !lo) {
      // The revealed: four cream corners round the body (the canon tell: Glim dims beside what is false).
      const w = Math.round(m.def.w / 2) + 1, h = m.def.h + 1, y0 = Math.round(m.y) - h;
      c.fillStyle = LATE_FX.moth.core;
      for (const [dx, dy] of [[-w, 0], [w - 1, 0], [-w, h - 1], [w - 1, h - 1]] as const) c.fillRect(X + dx, y0 + dy, 1, 1);
    }
  }
  c.globalAlpha = 1;
}
