/**
 * td-corpse-art.ts — the painter for td-corpse.ts. A corpse is its creature's own sprite, flattened and darkened, with a
 * few pixels of blood (or ash, for what never bled); rotting, it goes greyer and the flies come; last it is a small
 * heap of bones. Each stage of each kind is painted once and cached.
 */
import { mobCell, mobSheet, type MobDef } from './td-mobs';
import { leavesAsh, type Corpse, type CorpseStage } from './td-corpse';

type Stage = Exclude<CorpseStage, 'gone'>;

const cache = new Map<string, HTMLCanvasElement>();

/** A small seeded stream (the same scatter every time the same corpse is painted). */
function rng(seed: number): () => number {
  let h = seed >>> 0;
  return () => { h = (h + 0x6D2B79F5) >>> 0; let t = Math.imul(h ^ (h >>> 15), h | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BLOOD = ['#7a1a26', '#a8283a', '#5a1220'];
const DRIED = ['#4a1018', '#3a0e16', '#5c1c20'];
const ASH = ['#9a909a', '#6c6470', '#3a343c'];
const BONE = ['#efe3c4', '#c8b88e', '#8a7a5e'];
const OUT = '#2a1a24';

/** A corpse's cell: its creature's width plus a margin for the scatter, and the flattened body's height plus a pool. */
export function corpseSize(c: Pick<Corpse, 'kind'>): { w: number; h: number; body: number } {
  const body = Math.max(6, Math.round(c.kind.h * .38));
  return { w: c.kind.w + 8, h: body + 5, body };
}

/** The painted corpse for this stage (made once per kind and stage). */
export function corpseSprite(c: Corpse, stage: Stage): HTMLCanvasElement {
  const key = `${c.kind.id}:${stage}`;
  const have = cache.get(key);
  if (have) return have;
  const { w, h, body } = corpseSize(c);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const rand = rng(c.seed ^ stage.length * 7919);
  const ash = leavesAsh(c.kind.id, c.kind.ghost);
  if (stage === 'bones') paintBones(g, w, h, c.kind.w, rand);
  else paintBody(g, c, stage, w, h, body, ash, rand);
  cache.set(key, cv);
  return cv;
}

function paintBody(g: CanvasRenderingContext2D, c: Corpse, stage: Stage, w: number, h: number, body: number, ash: boolean, rand: () => number): void {
  const x0 = Math.floor((w - c.kind.w) / 2), y0 = h - body - 2;
  // The pool under it (blood, dried; or a smear of ash).
  const pool = ash ? ASH : stage === 'fresh' ? BLOOD : DRIED;
  g.globalAlpha = ash ? .55 : stage === 'fresh' ? .8 : .7;
  g.fillStyle = pool[2];
  g.fillRect(x0 + 1, h - 3, c.kind.w - 2, 2);
  g.fillStyle = pool[1];
  g.fillRect(x0 + 3, h - 4, Math.max(3, c.kind.w - 8), 2);
  g.globalAlpha = 1;
  // The creature's own first frame, flattened to lie on the ground.
  { const cell = mobCell(c.def as MobDef); g.drawImage(mobSheet(c.def as MobDef), 0, 0, cell.w, cell.h, x0, y0, c.kind.w, body); }
  // Darkened: a dead colour over it (rotting: greyer and greener still).
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = stage === 'fresh' ? .36 : .52;
  g.fillStyle = stage === 'fresh' ? '#2a1620' : '#2e3a2c';
  g.fillRect(0, 0, w, h);
  if (stage === 'rotting') { g.globalAlpha = .3; g.fillStyle = '#120a10'; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // A few pixels of blood or ash on and about the body.
  const n = stage === 'fresh' ? 6 : 4;
  for (let i = 0; i < n; i++) {
    g.fillStyle = ash ? ASH[i % 3] : (stage === 'fresh' ? BLOOD : DRIED)[i % 3];
    g.fillRect(x0 + Math.floor(rand() * c.kind.w), y0 + Math.floor(rand() * (body + 2)), 1 + (rand() < .3 ? 1 : 0), 1);
  }
  if (stage === 'rotting') {
    // Bones showing through the dead flesh: a rib or two, pale.
    g.fillStyle = BONE[1];
    for (let i = 0; i < 3; i++) g.fillRect(x0 + 3 + Math.floor(rand() * (c.kind.w - 7)), y0 + 1 + Math.floor(rand() * (body - 2)), 2, 1);
  }
}

function paintBones(g: CanvasRenderingContext2D, w: number, h: number, kw: number, rand: () => number): void {
  const base = h - 3, left = Math.floor((w - kw) / 2);
  const dot = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const bone = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      dot(x, y + 1, OUT); dot(x, y, i === 0 || i === n ? BONE[0] : BONE[1]);
    }
  };
  // A shadow of dust under the heap.
  g.globalAlpha = .4; g.fillStyle = OUT; g.fillRect(left + 2, base + 1, kw - 4, 2); g.globalAlpha = 1;
  // The ribs (more for the bigger), a spine along them, and a few long bones across.
  const ribs = Math.max(2, Math.min(5, Math.round(kw / 8)));
  const sx = left + Math.round(kw * .32), len = Math.max(6, Math.round(kw * .5));
  bone(sx, base - 1, sx + len, base - 1);
  for (let i = 0; i < ribs; i++) {
    const rx = sx + 2 + Math.round(i * (len - 3) / Math.max(1, ribs - 1));
    bone(rx, base - 1, rx + 1, base - 4 - (i % 2));
  }
  bone(left + 1, base, left + 1 + Math.round(kw * .4), base - 1 - Math.floor(rand() * 2));
  bone(left + Math.round(kw * .55), base, left + kw - 2, base - 2);
  // The skull: a pale block with two dark sockets, at one end.
  const kx = left + Math.round(kw * .12), ky = base - 5;
  g.fillStyle = OUT; g.fillRect(kx - 1, ky - 1, 6, 6);
  g.fillStyle = BONE[0]; g.fillRect(kx, ky, 4, 3);
  g.fillStyle = BONE[1]; g.fillRect(kx, ky + 3, 4, 1);
  g.fillStyle = OUT; dot(kx + 1, ky + 1, OUT); dot(kx + 3, ky + 1, OUT);
  // Scattered bits.
  for (let i = 0; i < 3; i++) dot(left + 2 + rand() * (kw - 4), base - rand() * 2, BONE[i % 3]);
}

/** Where the flies hang over a rotting corpse at `t` seconds: a few pixels, each on its own loop (none under reduced motion). */
export function flyDots(c: Corpse, t: number, n = 3): { x: number; y: number; wing: boolean }[] {
  const out: { x: number; y: number; wing: boolean }[] = [];
  const { w, body } = corpseSize(c);
  for (let i = 0; i < n; i++) {
    const ph = (c.seed % 97) / 15 + i * 2.1;
    out.push({
      x: Math.round(c.x + Math.sin(t * 2.6 + ph) * (w * .3) + Math.sin(t * 5.1 + ph * 2) * 2),
      y: Math.round(c.y - body - 1 + Math.cos(t * 3.4 + ph) * 3),
      wing: Math.floor(t * 18 + i) % 2 === 0,
    });
  }
  return out;
}
