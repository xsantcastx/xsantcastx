/**
 * td-hd-mob.ts — the HD creatures in the game: which clip and frame a creature shows, its frames baked lazily (only the
 * facings and clips the screen actually asks for) and trimmed, and the engine's one drawing call.
 *
 * Memory: a frame is baked the first time it is asked for, trimmed to its pixels, and kept. A creature that only ever
 * walks toward the Keeper bakes a row or two, not all 96 cells. A bake budget per drawn frame spreads the cost of a
 * new creature over a few frames (an unbaked cell shows the nearest baked one meanwhile).
 */
import { FACING_YAW, Rig } from './td-hd-rig';
import { FRAMES, HD_MODELS, rigFor, type Anim, type HdModel } from './td-hd-creatures';
import { HD_PETS, glimModel, type GlimHdMood } from './td-hd-pets';

/** A creature's model, or a pet's (`pet:<id>`). */
const modelOf = (id: string): HdModel | undefined => (id.startsWith('pet:') ? HD_PETS[id.slice(4)] : HD_MODELS[id]);

export interface HdCell { img: HTMLCanvasElement; ax: number; ay: number }

const cells = new Map<string, HdCell>();
let budget = 0, budgetAt = -1;
/** Cells baked per drawn frame before the rest wait (each is a few ms on a phone). */
const BAKES_PER_FRAME = 3;

/** Every creature with an HD model (the contact sheets). */
export const hdIds = (): string[] => Object.keys(HD_MODELS);
export function hasHdModel(id: string): boolean { return !!modelOf(id); }
export function hdModel(id: string): HdModel | undefined { return modelOf(id); }

/** Bake one cell: pose, sculpt, trim. */
export function bakeHdCell(id: string, row: number, anim: Anim, f: number): HdCell | null {
  const m = modelOf(id);
  if (!m) return null;
  const p = { anim, f };
  const r = rigFor(m, FACING_YAW[row] ?? 0, p);
  m.build(r, p);
  return trim(r.render(), r.ox, r.oy);
}
/** Trim a sculpt to its pixels (the sculpt's canvas has a 1 px outline margin: the feet sit at ox + 1, oy + 1). */
function trim(cv: HTMLCanvasElement, ox: number, oy: number): HdCell {
  const g = cv.getContext('2d', { willReadFrequently: true })!, img = g.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (img[(y * cv.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { img: out, ax: ox + 1 - x0, ay: oy + 1 - y0 };
}

/** A creature's cell, baked on demand (within this frame's budget; else the nearest baked one, else baked anyway). */
export function hdCell(id: string, row: number, anim: Anim, f: number, frameNo: number): HdCell | null {
  const key = `${id}|${row}|${anim}|${f}`;
  const got = cells.get(key);
  if (got) return got;
  if (budgetAt !== frameNo) { budgetAt = frameNo; budget = BAKES_PER_FRAME; }
  if (budget <= 0) {
    for (let k = 0; k < FRAMES; k++) { const c = cells.get(`${id}|${row}|${anim}|${k}`) ?? cells.get(`${id}|${row}|idle|${k}`); if (c) return c; }
  }
  budget--;
  const c = bakeHdCell(id, row, anim, f);
  if (c) cells.set(key, c);
  return c;
}
/** How many cells are baked, and their pixels (the phone memory check). */
export function hdStats(): { cells: number; px: number; kinds: number } {
  let px = 0; const kinds = new Set<string>();
  for (const [k, c] of cells) { px += c.img.width * c.img.height; kinds.add(k.split('|')[0]); }
  return { cells: cells.size, px, kinds: kinds.size };
}

// ── Which clip a creature shows ──
export interface HdMobLike { x: number; y: number; t: number; cd: number; rcd: number; tell: number; def: { rate: number; ranged?: { rate: number } } }
const seen = new WeakMap<object, { x: number; y: number; still: number; at: number }>();
/** Seconds the strike's clip lasts after a blow or a shot. */
export const STRIKE_SECS = .42;
/** The clip and frame for a creature now: a wind-up while it tells, the strike just after a blow, walking or idling. */
export function hdClip(m: HdMobLike, now: number): { anim: Anim; f: number } {
  let s = seen.get(m);
  if (!s) { s = { x: m.x, y: m.y, still: 1, at: now }; seen.set(m, s); }
  const dt = Math.max(0, Math.min(.25, now - s.at)); s.at = now;
  const moved = Math.hypot(m.x - s.x, m.y - s.y) > .05;
  s.still = moved ? 0 : s.still + dt; s.x = m.x; s.y = m.y;
  if (m.tell > 0) return { anim: 'attack', f: 0 };
  const since = m.def.rate - m.cd, shot = m.def.ranged ? m.def.ranged.rate - m.rcd : 99;
  const a = Math.min(since >= 0 ? since : 99, shot >= 0 ? shot : 99);
  if (a < STRIKE_SECS) return { anim: 'attack', f: Math.min(FRAMES - 1, 1 + Math.floor(a / STRIKE_SECS * 3)) };
  // About to bite (its blow comes round and it stands at its prey): the wind-up.
  if (m.cd > 0 && m.cd < .2 && s.still > .1) return { anim: 'attack', f: 0 };
  if (s.still < .15) return { anim: 'walk', f: Math.floor(m.t * 7) % FRAMES };
  return { anim: 'idle', f: Math.floor(m.t * 2.2) % FRAMES };
}
/** The death clip's frame `age` seconds after the fall; past it, the last frame (the corpse). */
export const DEATH_SECS = .55;
export function hdDeathFrame(age: number): number { return Math.min(FRAMES - 1, Math.floor(Math.max(0, age) / DEATH_SECS * FRAMES)); }

/**
 * A contact sheet (automated browsers, the art review): every HD creature × its six facings, one clip's frames each,
 * on a grass check, at `k` screen px a sheet px. Returns a PNG data URL.
 */
export function hdGallery(ids: readonly string[] = Object.keys(HD_MODELS), anims: readonly Anim[] = ['idle', 'walk', 'attack', 'death'], k = 2, frames: readonly number[] = [0, 1, 2, 3]): string {
  const rows: HdCell[][] = [];
  for (const id of ids) for (let row = 0; row < 6; row++) { const line: HdCell[] = []; for (const a of anims) for (const f of frames) { const c = bakeHdCell(id, row, a, f % FRAMES); if (c) line.push(c); } rows.push(line); }
  const all = rows.flat(), cw = Math.max(...all.map(c => c.img.width)) + 8, chh = Math.max(...all.map(c => c.ay)) + 10, cb = Math.max(...all.map(c => c.img.height - c.ay)) + 4;
  const ch = chh + cb, cols = Math.max(...rows.map(l => l.length));
  const out = document.createElement('canvas'); out.width = cols * cw * k; out.height = rows.length * ch * k;
  const g = out.getContext('2d')!; g.imageSmoothingEnabled = false;
  rows.forEach((line, j) => line.forEach((c, i) => {
    g.fillStyle = (i + j) % 2 ? '#4a7a3a' : '#457236'; g.fillRect(i * cw * k, j * ch * k, cw * k, ch * k);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse((i * cw + cw / 2) * k, (j * ch + chh) * k, 14 * k, 5 * k, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(c.img, (i * cw + cw / 2 - c.ax) * k, (j * ch + chh - c.ay) * k, c.img.width * k, c.img.height * k);
  }));
  return out.toDataURL('image/png');
}

const glims = new Map<string, HdCell>();
/** Glim at the HD pixel (td-hd-pets glimModel): a wingbeat (up, mid, down) with a mood's face, facing the viewer. */
export function hdGlim(frame: 'up' | 'mid' | 'down', mood: GlimHdMood): HdCell {
  const key = `${frame}|${mood}`;
  let c = glims.get(key);
  if (c) return c;
  const r = new Rig(64, 50, 32, 40, 0);
  glimModel(r, frame === 'up' ? 0 : frame === 'mid' ? 1 : 2, mood);
  c = trim(r.render(), r.ox, r.oy);
  glims.set(key, c);
  return c;
}
