/**
 * td-lantern-fx.ts — the Lanternwright's pictures (docs/design/effects-spec.md, "The Lanternwright" section).
 *
 * The same rules as every effect: whole art pixels, three tones per element (core · body · edge), ground under the
 * creatures and air over them at ≤ 60% where it covers a body, nothing past a second but what lasts (the ward, the
 * wisps, the beacon, the circle, the dawn), and a still frame under reduced motion — never no picture. Three palettes
 * join the kit: **lamp** (the shipped level-up light: cream core, the lantern's glow, a brass edge — design-bible §4.3),
 * **hearth** (the warm stones' fire) and **moth** (the kin's pale wings).
 *
 * The engine calls: `drawLampGround` (the flash's ring, a ward breaking, the dawn rising), `drawLampZones` (the Hearth
 * Circle and the disc of Dawn at Noon on the floor), `drawLampAir` (the moment effects), `drawLampState` (what lasts:
 * the ward's frame, Last Light, the wisps, the stunned and the unveiled), `drawBeacon` (y-sorted with the world) and
 * `drawKindle` (a flare in flight).
 */
import { mobCell } from './td-mobs';
import { burst, circlePixels, discRows, drawBurst, drawRing, glowSquare, groundRing, type Tones } from './td-fx';

type Ctx = CanvasRenderingContext2D;

/** The lamp-keepers' light, the hearth's fire, the kin's wings (effects-spec rule 2). */
export const LAMP_FX: Readonly<Record<'lamp' | 'hearth' | 'moth', Tones>> = {
  lamp: { core: '#fffbe8', body: '#ffd27a', edge: '#c99a3e' },
  hearth: { core: '#fff2c8', body: '#ffb347', edge: '#8a5a34' },
  moth: { core: '#fffbe8', body: '#e8dcc0', edge: '#8a6a3a' },
};
const BRASS = '#c99a3e', BRASS_LO = '#8a6a3a', POLE = '#6e4526', POLE_HI = '#a06a3b', STONE = '#a89a90', STONE_LO = '#5e5450';

const KINDS = new Set(['kindle-hit', 'lamp-flash', 'banish', 'hearthglow', 'lward', 'lward-break', 'wisp-call', 'beacon-plant', 'dawn-rise', 'shutter', 'lastlight']);
const GROUND = new Set(['lamp-flash', 'lward-break', 'dawn-rise']);
export function isLampFx(kind: string): boolean { return KINDS.has(kind); }

interface FxLike { kind: string; x: number; y: number; age: number; life: number; dir: number; r?: number }
interface ZoneLike { kind: string; x: number; y: number; r: number; t: number }

/** Ground: a ring running out (the flash, a ward breaking) or the dawn's sun-ring rising. Returns whether it drew. */
export function drawLampGround(c: Ctx, e: FxLike, still: boolean): boolean {
  if (!GROUND.has(e.kind)) return false;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.kind === 'dawn-rise' ? e.y : e.y + 16), R = e.r ?? 48, tn = LAMP_FX.lamp;
  const k = still ? 1 : 1 - (1 - t) * (1 - t), r = Math.max(4, Math.round(6 + (R - 6) * k));
  c.globalAlpha = still ? .9 : Math.max(0, 1 - t * .8);
  for (const [i, q] of groundRing(r).entries()) { if (i % 2) continue; c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  c.globalAlpha *= .6;
  for (const [i, q] of groundRing(Math.max(2, r - 3)).entries()) { if (i % 3) continue; c.fillStyle = tn.edge; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  c.globalAlpha = 1;
  return true;
}

/**
 * The circles on the floor. The Hearth Circle: a faint warm floor, a ring of grey stones, a small campfire in the middle
 * whose flame steps. Dawn at Noon: the disc steps up to near-white at its core and a sun-ring of twelve pixels turns
 * round its rim (the light itself is the engine's: it opens the night over the disc).
 */
export function drawLampZones(c: Ctx, zones: readonly ZoneLike[], time: number, still: boolean): void {
  for (const z of zones) {
    const X = Math.round(z.x), Y = Math.round(z.y), R = Math.round(z.r), fade = Math.min(1, z.t / .5);
    if (z.kind === 'hearth') {
      // A warm floor, stepped (brighter toward the fire), then a ring of warm light just inside the stones.
      for (const [k, al] of [[1, .14], [.6, .14]] as const) {
        c.globalAlpha = al * fade; c.fillStyle = LAMP_FX.hearth.body;
        for (const row of discRows(Math.round(R * k))) c.fillRect(X - row.w, Y + Math.round(row.y / 2), row.w * 2 + 1, 1);
      }
      const ring = groundRing(R);
      c.globalAlpha = .55 * fade;
      for (const [i, q] of groundRing(Math.max(2, R - 3)).entries()) if (i % 2 === 0) { c.fillStyle = i % 4 ? LAMP_FX.hearth.body : LAMP_FX.hearth.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
      // The stones, round the rim (the floor seen at three quarters): a lit top, a dark foot.
      c.globalAlpha = fade;
      ring.forEach((q, i) => { if (i % 5) return; c.fillStyle = STONE_LO; c.fillRect(X + q.x - 2, Y + q.y - 1, 4, 3); c.fillStyle = STONE; c.fillRect(X + q.x - 2, Y + q.y - 1, 3, 2); c.fillStyle = '#efe6dc'; c.fillRect(X + q.x - 2, Y + q.y - 1, 1, 1); });
      // The little fire: logs, then a flame stepping between two heights.
      const f = still ? 0 : Math.floor(time * 6) % 2;
      c.fillStyle = POLE; c.fillRect(X - 4, Y - 1, 8, 2); c.fillStyle = POLE_HI; c.fillRect(X - 4, Y - 1, 3, 1);
      c.fillStyle = LAMP_FX.hearth.edge; c.fillRect(X - 3, Y - 4 - f, 6, 3 + f);
      c.fillStyle = LAMP_FX.hearth.body; c.fillRect(X - 2, Y - 6 - f, 4, 4 + f);
      c.fillStyle = LAMP_FX.hearth.core; c.fillRect(X - 1, Y - 5 - f, 2, 3);
    } else if (z.kind === 'dawn') {
      // Three stepped discs of daylight, the inner ones on top, then the turning sun-ring.
      const steps: [number, string, number][] = [[1, LAMP_FX.lamp.body, .22], [.66, LAMP_FX.lamp.core, .28], [.33, '#ffffff', .36]];
      for (const [k, col, a] of steps) {
        c.globalAlpha = a * fade; c.fillStyle = col;
        for (const row of discRows(Math.round(R * k))) c.fillRect(X - row.w, Y + Math.round(row.y / 2), row.w * 2 + 1, 1);
      }
      c.globalAlpha = fade;
      const turn = still ? 0 : time * .4;
      for (let i = 0; i < 12; i++) {
        const a = turn + i / 12 * Math.PI * 2, sx = Math.round(X + Math.cos(a) * R), sy = Math.round(Y + Math.sin(a) * R / 2);
        c.fillStyle = BRASS; c.fillRect(sx - 1, sy, 3, 1); c.fillStyle = LAMP_FX.lamp.core; c.fillRect(sx, sy - 1, 1, 3);
      }
    }
  }
  c.globalAlpha = 1;
}

/** Air: the pictures that live a moment. Returns whether the kind is the Lanternwright's (the engine then skips it). */
export function drawLampAir(c: Ctx, e: FxLike, still: boolean, overFoe: (x: number, y: number) => boolean): boolean {
  if (!isLampFx(e.kind)) return false;
  if (GROUND.has(e.kind) && e.kind !== 'lamp-flash' && e.kind !== 'lward-break') return true;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), bt = still ? .5 : t, seed = (X * 7 + Y * 13) | 0;
  const fade = still ? 1 : Math.max(0, 1 - t);
  const dot = (x: number, y: number, col: string, a = 1, w = 1, h = 1) => {
    c.globalAlpha = overFoe(x, y) ? Math.min(.6, a * fade) : a * fade; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const L = LAMP_FX.lamp;
  if (e.kind === 'kindle-hit') {
    // A flare landing: a small cream burst with a white heart (over a body: ≤ 60%).
    glowSquare(c, X, Y, 3, L, .55 * fade);
    c.globalAlpha = Math.min(.6, fade); drawBurst(c, X, Y, burst(7, bt, seed, 7, 3), L);
  } else if (e.kind === 'lamp-flash') {
    // The flash: a white-hot square at the lantern, eight rays thrown out and fading.
    const R = e.r ?? 48, k = still ? .6 : Math.min(1, t / .5);
    glowSquare(c, X, Y, Math.round(4 + 6 * (1 - t)), L, .9 * fade);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, len = Math.round(R * .6 * k);
      for (let d = 6; d < len; d += 3) dot(X + Math.cos(a) * d, Y + Math.sin(a) * d * .7, d < len / 2 ? L.core : L.body, .9 - d / Math.max(1, len) * .6, d % 6 ? 1 : 2, 1);
    }
  } else if (e.kind === 'lward-break') {
    glowSquare(c, X, Y, 6, L, .8 * fade);
    c.globalAlpha = fade; drawBurst(c, X, Y, burst(12, bt, seed, 16, 4), L);
  } else if (e.kind === 'banish') {
    // A white-hot column on the foe, three steps wide, its pixels falling up out of the ground.
    const h = 46, w = still ? 3 : t < .6 ? 3 : 2;
    for (let y = 0; y < h; y++) {
      const a = (1 - y / h) * .9;
      dot(X - w, Y - y, L.body, a * .6, 1, 1); dot(X + w, Y - y, L.body, a * .6, 1, 1);
      dot(X - w + 1, Y - y, y % 3 ? L.core : '#ffffff', a, w * 2 - 1, 1);
    }
    for (let i = 0; i < 8; i++) {
      const rise = Math.round(((still ? .5 : t) * 30 + i * 7) % 40);
      dot(X - 6 + (i * 5) % 13, Y - rise, i % 2 ? L.core : L.edge, .9);
    }
  } else if (e.kind === 'hearthglow') {
    // Hearthlight: stepped warm squares rising from the feet, a pale green cross for the mending.
    for (let i = 0; i < 4; i++) {
      const rise = Math.round(((still ? .4 : t) * 24 + i * 6) % 28);
      glowSquare(c, X - 6 + i * 4, Y - 2 - rise, 2, LAMP_FX.hearth, .7 * fade);
    }
    dot(X - 1, Y - 36, '#7fe08a', 1, 2, 6); dot(X - 3, Y - 34, '#7fe08a', 1, 6, 2); dot(X, Y - 35, '#e6ffe9', 1, 1, 1);
  } else if (e.kind === 'lward') {
    // The ward catching: a brass frame springs out round the Keeper.
    const k = still ? 1 : 1 - (1 - t) * (1 - t), hw = Math.round(7 + 4 * k), hh = Math.round(11 + 6 * k);
    for (let x = -hw; x <= hw; x += 2) { dot(X + x, Y - hh, BRASS); dot(X + x, Y + hh, BRASS); }
    for (let y = -hh; y <= hh; y += 2) { dot(X - hw, Y + y, BRASS); dot(X + hw, Y + y, BRASS); }
    glowSquare(c, X, Y - hh, 2, L, fade);
  } else if (e.kind === 'wisp-call') {
    c.globalAlpha = fade; drawBurst(c, X, Y, burst(10, bt, seed, 12, 2), LAMP_FX.moth);
    glowSquare(c, X, Y, 3, L, .8 * fade);
  } else if (e.kind === 'beacon-plant') {
    c.globalAlpha = fade; drawBurst(c, X, Y - 2, burst(8, bt, seed, 9, 4), { core: L.core, body: STONE, edge: STONE_LO });
    glowSquare(c, X, Y - 30, 3, L, .8 * fade);
  } else if (e.kind === 'shutter') {
    // The shutters swinging: two dark slats closing over the lantern (dir −1) or opening off it (dir 1).
    const k = still ? 1 : Math.min(1, t / .5), gap = e.dir < 0 ? Math.round(4 * (1 - k)) : Math.round(4 * k);
    dot(X - 3 - gap, Y - 3, '#3a2a14', 1, 3, 6); dot(X + 1 + gap, Y - 3, '#3a2a14', 1, 3, 6);
    if (e.dir > 0) glowSquare(c, X, Y, 3, L, fade);
  } else if (e.kind === 'lastlight') {
    // Last Light: a cream flare at the heart and a ring of light rising.
    glowSquare(c, X, Y, Math.round(4 + 8 * (1 - t)), L, fade);
    if (!still) drawRing(c, X, Y + 16, Math.round(8 + 18 * t), 0, L.core, L.body, 6, 4);
  }
  c.globalAlpha = 1;
  return true;
}

/** What the engine knows of the fight for the lasting pictures. */
export interface LampState {
  ward: number; lastLight: number;
  wisps: readonly { x: number; y: number }[];
  mobs: readonly { x: number; y: number; stun?: number; revealT?: number; def: { h: number } }[];
}

/**
 * What lasts while it holds: the Lantern Ward's brass frame with a lamp at each corner, Last Light's cream corners,
 * the wisps (a pale moth round a little lamp, wings beating two frames), the stunned (cream stars) and the unveiled
 * (a pale ring over the head).
 */
export function drawLampState(c: Ctx, s: LampState, p: { x: number; y: number }, time: number, still: boolean): void {
  const X = Math.round(p.x), Y = Math.round(p.y), L = LAMP_FX.lamp;
  if (s.ward > 0) {
    const hw = 11, hh = 17, cy = Y - 15, off = still ? 0 : Math.floor(time * 4) % 4;
    c.globalAlpha = .75;
    for (let x = -hw; x <= hw; x++) if ((x + off) % 4 < 2) { c.fillStyle = BRASS; c.fillRect(X + x, cy - hh, 1, 1); c.fillRect(X - x, cy + hh, 1, 1); }
    for (let y = -hh; y <= hh; y++) if ((y + off) % 4 < 2) { c.fillStyle = BRASS_LO; c.fillRect(X - hw, cy - y, 1, 1); c.fillRect(X + hw, cy + y, 1, 1); }
    c.globalAlpha = 1;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { c.fillStyle = L.body; c.fillRect(X + sx * hw - 1, cy + sy * hh - 1, 3, 3); c.fillStyle = L.core; c.fillRect(X + sx * hw, cy + sy * hh, 1, 1); }
  }
  if (s.lastLight > 0) {
    c.globalAlpha = still ? 1 : .7 + .3 * Math.sin(time * 8);
    c.fillStyle = L.core;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const cx = X + sx * 10, cy = Y - 15 + sy * 16;
      c.fillRect(cx - (sx > 0 ? 3 : 0), cy, 4, 1); c.fillRect(cx, cy - (sy > 0 ? 3 : 0), 1, 4);
    }
    c.globalAlpha = 1;
  }
  for (const w of s.wisps) {
    const wx = Math.round(w.x), wy = Math.round(w.y), flap = still ? 0 : Math.floor(time * 10) % 2;
    glowSquare(c, wx, wy, 3, L, .55);
    c.globalAlpha = .95;
    c.fillStyle = LAMP_FX.moth.body; c.fillRect(wx - 4, wy - 2 - flap, 3, 2 + flap); c.fillRect(wx + 2, wy - 2 - flap, 3, 2 + flap);
    c.fillStyle = LAMP_FX.moth.edge; c.fillRect(wx - 3, wy + 1, 2, 1); c.fillRect(wx + 2, wy + 1, 2, 1);
    c.fillStyle = L.body; c.fillRect(wx - 1, wy - 1, 2, 3); c.fillStyle = L.core; c.fillRect(wx - 1, wy - 1, 1, 1);
    c.globalAlpha = 1;
  }
  for (const m of s.mobs) {
    const top = Math.round(m.y - mobCell(m.def).h - 6), mx = Math.round(m.x);
    if ((m.stun ?? 0) > 0) {
      // Blinded: three cream stars circling the head (the CC pip, design-bible §4.7).
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + (still ? 0 : time * 4), sx = Math.round(mx + Math.cos(a) * 6), sy = Math.round(top + Math.sin(a) * 2);
        c.globalAlpha = .9; c.fillStyle = L.core; c.fillRect(sx, sy, 1, 1);
        c.fillStyle = L.body; c.fillRect(sx - 1, sy, 1, 1); c.fillRect(sx + 1, sy, 1, 1); c.fillRect(sx, sy - 1, 1, 1); c.fillRect(sx, sy + 1, 1, 1);
      }
    } else if ((m.revealT ?? 0) > 0) {
      // Unveiled: a pale dashed ring over the head.
      c.globalAlpha = .8;
      for (const [i, q] of circlePixels(4).entries()) if (i % 2 === 0) { c.fillStyle = L.core; c.fillRect(mx + q.x, top + Math.round(q.y / 2), 1, 1); }
    }
  }
  c.globalAlpha = 1;
}

/** A Beacon on its pole (y-sorted with the world): a dark post, a brass cap, a lantern that breathes. */
export function drawBeacon(c: Ctx, b: { x: number; y: number; t: number }, time: number, still: boolean): void {
  const X = Math.round(b.x), Y = Math.round(b.y), L = LAMP_FX.lamp, glow = still ? 1 : .8 + .2 * Math.sin(time * 5);
  c.globalAlpha = Math.min(1, b.t / .4);
  c.fillStyle = STONE_LO; c.fillRect(X - 4, Y - 1, 8, 2);
  c.fillStyle = POLE; c.fillRect(X - 1, Y - 26, 2, 26); c.fillStyle = POLE_HI; c.fillRect(X - 1, Y - 26, 1, 26);
  c.fillStyle = BRASS_LO; c.fillRect(X - 3, Y - 36, 6, 1); c.fillRect(X - 3, Y - 27, 6, 1); c.fillRect(X - 1, Y - 37, 2, 1);
  c.fillStyle = BRASS; c.fillRect(X - 3, Y - 35, 1, 8); c.fillRect(X + 2, Y - 35, 1, 8);
  c.globalAlpha *= glow;
  c.fillStyle = L.body; c.fillRect(X - 2, Y - 35, 4, 8); c.fillStyle = L.core; c.fillRect(X - 1, Y - 34, 2, 5); c.fillStyle = '#ffffff'; c.fillRect(X - 1, Y - 33, 1, 2);
  c.globalAlpha = 1;
}

/** A flare in flight (Kindle, a wisp's or a beacon's mote): a cream mote with a brass tail, stepped. */
export function drawKindle(c: Ctx, x: number, y: number, ux: number, uy: number): void {
  const X = Math.round(x), Y = Math.round(y), L = LAMP_FX.lamp;
  const trail: [string, number][] = [[L.body, .85], [L.edge, .55], [BRASS_LO, .3]];
  trail.forEach(([col, a], i) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(Math.round(X - ux * (i + 1) * 3), Math.round(Y - uy * (i + 1) * 3), 2, 2); });
  c.globalAlpha = 1;
  glowSquare(c, X, Y, 3, L, .7);
  c.fillStyle = L.body; c.fillRect(X - 1, Y - 1, 3, 3); c.fillStyle = '#ffffff'; c.fillRect(X, Y, 1, 1);
}
