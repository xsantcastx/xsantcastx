/**
 * pixel-fx.ts — the larger pixel pieces that are not items: the Gambler's
 * altar (its turning sigil, the burst when a box cracks, the halo behind a rare
 * pull) and the stone slab it stands on (one art style, pass 2).
 *
 * They were painted effect renders (`eclipse-summoning-sigil`, `crafting-burst`,
 * `enhancement-aura`) laid over a smooth CSS ellipse. Now they are drawn on a
 * 32 × 32 art-px grid — twice the item icons' 16, so at the altar's ~300 px they
 * land near the item icons' own pixel size — in the art bible's Godforge violet
 * and aged gold (style guide §5.1), crisp SVG rects in a data URI, built once.
 *
 * Pure. No DOM.
 */
import type { ArtEntry } from './art-manifest.generated';

const N = 32;
const VIOLET = ['#3a1f63', '#7b3fc4', '#a855f7', '#d9b8ff'] as const;
const GOLD = ['#5a3c1a', '#a5793a', '#e8c898', '#f8e8c8'] as const;
const OBSIDIAN = ['#140a1f', '#1e1428', '#2e2238', '#463650', '#6a5878'] as const;
const DAWN = '#fff1b0';

type Cells = Map<number, string>;
const at = (x: number, y: number) => y * N + x;

function svg(cells: Cells, w = N, h = N): string {
  const rects: string[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = cells.get(at(x, y));
      if (!c) { x++; continue; }
      let run = 1;
      while (x + run < w && cells.get(at(x + run, y)) === c) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${c}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

function entry(markup: string, w = N, h = N): ArtEntry {
  return { src: `data:image/svg+xml,${encodeURIComponent(markup)}`, srcset: '', width: w * 4, height: h * 4 };
}

/** Each cell whose centre lies between radii r0 and r1 of the grid's centre. */
function ring(cells: Cells, r0: number, r1: number, color: (angle: number, x: number, y: number) => string | null): void {
  const c = (N - 1) / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d < r0 || d >= r1) continue;
    const col = color(Math.atan2(y - c, x - c), x, y);
    if (col) cells.set(at(x, y), col);
  }
}

/** Light from the upper left: lit where the angle faces up-left, shaded down-right. */
const lit = (angle: number) => Math.cos(angle + Math.PI * 0.75);

const cache = new Map<string, ArtEntry>();
const once = (key: string, make: () => ArtEntry) => cache.get(key) ?? (cache.set(key, make()), cache.get(key)!);

/** The summoning sigil: two rings, eight cut marks between them, an eclipse at the centre. */
export function altarSigil(): ArtEntry {
  return once('sigil', () => {
    const cells: Cells = new Map();
    ring(cells, 14, 15.5, a => lit(a) > 0.35 ? VIOLET[3] : lit(a) > -0.35 ? VIOLET[2] : VIOLET[1]);
    ring(cells, 13.2, 14, () => VIOLET[0]);
    // Eight cut marks, on the ring between.
    ring(cells, 10.5, 13.2, a => {
      const k = ((a / (Math.PI / 4)) % 1 + 1) % 1;
      return k < 0.1 || k > 0.9 ? GOLD[2] : null;
    });
    ring(cells, 9.6, 10.5, a => (Math.round(a / (Math.PI / 16)) & 1) ? GOLD[1] : null);
    // The eclipse: a dark disc with a bright crescent on its lit edge.
    ring(cells, 0, 5.5, () => OBSIDIAN[1]);
    ring(cells, 5.5, 6.6, a => lit(a) > 0.2 ? DAWN : lit(a) > -0.3 ? GOLD[2] : VIOLET[1]);
    return entry(svg(cells));
  });
}

/** The crack: eight rays of alternating length from a white-hot core. No outline (art bible §4: light reads by brightness). */
export function altarBurst(): ArtEntry {
  return once('burst', () => {
    const cells: Cells = new Map();
    const c = 15.5;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, len = i % 2 ? 9 : 15;
      for (let r = 3; r <= len; r++) {
        const x = Math.round(c + Math.cos(a) * r), y = Math.round(c + Math.sin(a) * r);
        cells.set(at(x, y), r < len * 0.4 ? DAWN : r < len * 0.75 ? GOLD[2] : VIOLET[2]);
      }
    }
    ring(cells, 0, 3.2, () => DAWN);
    return entry(svg(cells));
  });
}

/** The halo behind a rare pull: a dotted ring and four sparks. */
export function altarAura(): ArtEntry {
  return once('aura', () => {
    const cells: Cells = new Map();
    ring(cells, 13.5, 14.6, a => (Math.round(a / (Math.PI / 20)) & 1) ? VIOLET[3] : null);
    ring(cells, 11, 11.8, a => (Math.round(a / (Math.PI / 12)) % 3 === 0) ? GOLD[2] : null);
    for (const [x, y] of [[15, 1], [16, 1], [15, 30], [16, 30], [1, 15], [1, 16], [30, 15], [30, 16]]) cells.set(at(x, y), DAWN);
    return entry(svg(cells));
  });
}

/** The slab the altar stands on: a 32 × 6 stone, lit along its top, in obsidian. */
export function altarSlab(): ArtEntry {
  return once('slab', () => {
    const cells: Cells = new Map();
    const rows: readonly [number, number, readonly string[]][] = [
      [5, 26, [OBSIDIAN[0]]],
      [2, 29, [OBSIDIAN[0], OBSIDIAN[4], OBSIDIAN[3]]],
      [1, 30, [OBSIDIAN[0], OBSIDIAN[3], OBSIDIAN[2]]],
      [1, 30, [OBSIDIAN[0], OBSIDIAN[2], OBSIDIAN[1]]],
      [2, 29, [OBSIDIAN[0], OBSIDIAN[1], OBSIDIAN[1]]],
      [5, 26, [OBSIDIAN[0]]],
    ];
    rows.forEach(([x0, x1, [edge, top, body]], y) => {
      for (let x = x0; x <= x1; x++) {
        const rim = x === x0 || x === x1 || y === 0 || y === rows.length - 1;
        cells.set(at(x, y), rim ? edge : (top && x < (x0 + x1) / 2 ? top : body ?? top));
      }
    });
    // A seam of violet across the face.
    for (let x = 9; x <= 22; x++) if (x % 3) cells.set(at(x, 3), VIOLET[1]);
    return entry(svg(cells, N, 6), N, 6);
  });
}
