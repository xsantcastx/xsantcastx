/**
 * td-art.ts — the top-down pixel kit (docs/design/top-down.md §4).
 *
 * Every tile, building and prop is painted once, procedurally, into a small
 * canvas at ART scale (1 art px = 1 canvas px) and cached by key: one canvas
 * per kind, never per frame (play-memory). The engine blits them at an integer
 * scale with smoothing off. Warm Stardew-like palette, light from the top-left,
 * a 1px dark outline on objects and none on ground tiles. Original art only —
 * the owner's references set the bar, not the pixels.
 */
export const TILE = 16;

type Ctx = CanvasRenderingContext2D;

/** Seeded per-tile noise so a tile's speckles never shimmer between bakes. */
export function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const PAL = {
  outline: '#2a1a24',
  grass: ['#5f9e3c', '#6fb045', '#83c255', '#4d8a33'],
  dirt: ['#a8743f', '#b9844a', '#93623a', '#c79657'],
  cobble: ['#a8988a', '#bba996', '#8f8073', '#cdbca6'],
  cobbleGap: '#6e6058',
  sand: ['#e2c27e', '#ecd08f', '#d1af6b'],
  water: ['#3d7fc4', '#4b90d6', '#5aa2e2', '#336fb0'],
  ember: ['#e2552a', '#ff8a2e', '#ffd25a', '#9e2e1c'],
  wood: ['#8a5a32', '#a06a3b', '#6e4526', '#b77d48'],
  plank: ['#b98953', '#a77744', '#c99a62'],
  roofRed: ['#b5482f', '#cf5a3a', '#8f3524', '#e2714b'],
  roofSlate: ['#5c5770', '#6f6a84', '#48445a', '#857f9c'],
  roofThatch: ['#c99a46', '#dbaf55', '#a87c35', '#e8c46b'],
  plaster: ['#efdcb5', '#e2cc9f', '#f6e8c8'],
  stone: ['#9a8f86', '#b0a69c', '#7d736b', '#c3b9ae'],
  basalt: ['#4a4352', '#5a5263', '#3a3442', '#6b6276'],
  leaf: ['#3f7d34', '#4f9440', '#2f6428', '#66ad4f'],
  trunk: ['#6e4526', '#8a5a32', '#54331b'],
  flower: ['#e8506a', '#f2c94c', '#9b6ad6', '#f08a3a', '#ffffff', '#5aa2e2'],
  awning: [['#c9483a', '#f3e7cf'], ['#3f78b5', '#f3e7cf'], ['#5a9a49', '#f6edd2'], ['#8a4fb0', '#f3e7cf'], ['#d68a2e', '#fbf0d6']],
  glow: '#ffd27a',
  window: '#ffe39b',
  windowDark: '#3a3654',
} as const;

function cv(w: number, h: number): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  return el;
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void { c.fillStyle = col; c.fillRect(x, y, w, h); }
function pick<T>(list: readonly T[], r: number): T { return list[Math.floor(r * list.length) % list.length]; }

/** A 1px dark outline round everything opaque already painted. */
function outline(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = cv(src.width + 2, src.height + 2);
  const c = out.getContext('2d')!;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c.drawImage(src, dx, dy);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = PAL.outline; c.fillRect(0, 0, out.width, out.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(src, 1, 1);
  return out;
}

// ── Ground ────────────────────────────────────────────────────────────────────

export type Ground = 'grass' | 'dirt' | 'cobble' | 'sand' | 'water' | 'ember' | 'plank' | 'flowers';

/** Paint one ground tile at (tx, ty) into `c` at (ox, oy). Variants come from the tile's own hash. */
export function paintGround(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, frame = 0): void {
  const r = (n: number) => hash(tx, ty, n);
  switch (kind) {
    case 'grass':
    case 'flowers': {
      rect(c, ox, oy, TILE, TILE, PAL.grass[0]);
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(r(i) * 15), y = Math.floor(r(i + 20) * 15);
        rect(c, ox + x, oy + y, 1, 2, pick(PAL.grass, r(i + 40)));
      }
      if (kind === 'flowers') for (let i = 0; i < 4; i++) {
        const x = 1 + Math.floor(r(i + 60) * 13), y = 1 + Math.floor(r(i + 70) * 13);
        const col = pick(PAL.flower, r(i + 80));
        rect(c, ox + x, oy + y, 2, 2, col); rect(c, ox + x, oy + y + 2, 1, 1, PAL.leaf[2]);
      }
      break;
    }
    case 'dirt': {
      rect(c, ox, oy, TILE, TILE, PAL.dirt[0]);
      for (let i = 0; i < 7; i++) rect(c, ox + Math.floor(r(i) * 15), oy + Math.floor(r(i + 9) * 15), 2, 1, pick(PAL.dirt, r(i + 30)));
      break;
    }
    case 'cobble': {
      rect(c, ox, oy, TILE, TILE, PAL.cobbleGap);
      // Two staggered rows of rounded setts per tile.
      for (let row = 0; row < 4; row++) {
        const off = (row + ty) % 2 ? 2 : 0;
        for (let col = -1; col < 4; col++) {
          const x = col * 5 + off + 1, y = row * 4 + 1;
          if (x > 15) continue;
          const shade = pick(PAL.cobble, r(row * 7 + col + 3));
          rect(c, ox + Math.max(0, x), oy + y, Math.min(4, 16 - Math.max(0, x)), 3, shade);
          rect(c, ox + Math.max(0, x), oy + y, Math.min(4, 16 - Math.max(0, x)), 1, PAL.cobble[3]);
        }
      }
      break;
    }
    case 'sand': {
      rect(c, ox, oy, TILE, TILE, PAL.sand[0]);
      for (let i = 0; i < 6; i++) rect(c, ox + Math.floor(r(i) * 15), oy + Math.floor(r(i + 5) * 15), 1, 1, pick(PAL.sand, r(i + 50)));
      break;
    }
    case 'plank': {
      for (let i = 0; i < 4; i++) {
        rect(c, ox, oy + i * 4, TILE, 4, pick(PAL.plank, r(i)));
        rect(c, ox, oy + i * 4 + 3, TILE, 1, PAL.wood[2]);
        rect(c, ox + Math.floor(r(i + 9) * 14), oy + i * 4 + 1, 1, 1, PAL.wood[2]);
      }
      break;
    }
    case 'water':
    case 'ember': {
      const ramp = kind === 'water' ? PAL.water : PAL.ember;
      rect(c, ox, oy, TILE, TILE, ramp[0]);
      if (kind === 'ember') {
        // Cooling crust floating on the flow, bright cracks between.
        for (let i = 0; i < 2; i++) {
          const x = (Math.floor(r(i + 90) * 12) + frame) % 12, y = Math.floor(r(i + 95) * 12);
          rect(c, ox + x, oy + y, 4, 3, '#5a2418'); rect(c, ox + x, oy + y, 4, 1, '#7a3220');
        }
        for (let i = 0; i < 2; i++) rect(c, ox + ((Math.floor(r(i + 60) * 15) + frame * 2) % 15), oy + Math.floor(r(i + 66) * 15), 1, 1, '#fff2a8');
      }
      // Ripples drift with the frame (the water pass re-bakes 4 frames, never per draw).
      for (let i = 0; i < 4; i++) {
        const x = (Math.floor(r(i) * 16) + frame * 2) % 14, y = Math.floor(r(i + 7) * 15);
        rect(c, ox + x, oy + y, 3, 1, ramp[2]);
      }
      rect(c, ox + ((Math.floor(r(30) * 12) + frame) % 13), oy + Math.floor(r(31) * 14), 2, 1, ramp[kind === 'water' ? 1 : 2]);
      break;
    }
  }
}

/**
 * Soft edges where grass meets another ground: a 2px fringe of the
 * neighbour drawn into this tile (a cheap stand-in for full blob autotiling,
 * enough to read as Stardew-soft at 2×).
 */
export function paintEdge(c: Ctx, kind: Ground, neighbour: Ground, side: 'n' | 's' | 'e' | 'w', tx: number, ty: number, ox: number, oy: number): void {
  if (kind === neighbour) return;
  const water = neighbour === 'water' || neighbour === 'ember';
  if (kind === 'water' || kind === 'ember') {
    // A bank lip on the water side: sand/grass overhang, then a dark shadow line.
    const lip = PAL.sand[2], shade = kind === 'water' ? PAL.water[3] : PAL.ember[3];
    if (side === 'n') { rect(c, ox, oy, TILE, 2, lip); rect(c, ox, oy + 2, TILE, 1, shade); }
    if (side === 's') { rect(c, ox, oy + 15, TILE, 1, lip); }
    if (side === 'w') { rect(c, ox, oy, 1, TILE, lip); rect(c, ox + 1, oy, 1, TILE, shade); }
    if (side === 'e') { rect(c, ox + 15, oy, 1, TILE, lip); rect(c, ox + 14, oy, 1, TILE, shade); }
    return;
  }
  if (water) return;
  if (kind === 'grass' || kind === 'flowers') {
    // Grass tufts spill over the edge into paths: drawn on the path tile instead (below).
    return;
  }
  if (neighbour === 'grass' || neighbour === 'flowers') {
    for (let i = 0; i < 16; i += 2) {
      const len = 1 + Math.floor(hash(tx * 31 + i, ty, side.charCodeAt(0)) * 3);
      const col = PAL.grass[(i >> 1) % 3];
      if (side === 'n') rect(c, ox + i, oy, 2, len, col);
      if (side === 's') rect(c, ox + i, oy + 16 - len, 2, len, col);
      if (side === 'w') rect(c, ox, oy + i, len, 2, col);
      if (side === 'e') rect(c, ox + 16 - len, oy + i, len, 2, col);
    }
  }
}

// ── Objects ───────────────────────────────────────────────────────────────────

/**
 * A sprite: the painted canvas, its foot anchor (the y-sort line and the point
 * the object stands on, in art px from the canvas top-left), and an optional
 * roof/canopy layer drawn above everything that fades when the Keeper is
 * behind or under it.
 */
export interface Sprite {
  img: HTMLCanvasElement;
  /** Anchor: art px from the image's left/top to the object's foot centre. */
  ax: number;
  ay: number;
  roof?: { img: HTMLCanvasElement; x: number; y: number };
  /** Light sources (art px from the anchor) for the night pass. */
  lights?: readonly { x: number; y: number; r: number; warm?: boolean }[];
  /** Chimney mouths (art px from the anchor) for smoke. */
  smoke?: readonly { x: number; y: number }[];
}

const cache = new Map<string, Sprite>();
function cached(key: string, make: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) { s = make(); cache.set(key, s); }
  return s;
}

export type RoofStyle = 'red' | 'slate' | 'thatch';
export type WallStyle = 'timber' | 'stone' | 'basalt';

const roofRamp = (s: RoofStyle) => (s === 'red' ? PAL.roofRed : s === 'slate' ? PAL.roofSlate : PAL.roofThatch);

/**
 * A house, `w` tiles wide and `d` tiles deep: front wall with a door and
 * windows (lit at night by the light pass), a gabled roof seen from above in
 * 3/4, a chimney. The roof is its own layer so it can fade.
 */
export function house(w: number, d: number, roof: RoofStyle, wall: WallStyle, chimney = true, seed = 0): Sprite {
  return cached(`house:${w}:${d}:${roof}:${wall}:${chimney}:${seed}`, () => {
    const W = w * TILE, wallH = 22, roofH = d * TILE + 6, H = roofH + wallH;
    const body = cv(W, H);
    const c = body.getContext('2d')!;
    // Front wall.
    const wy = roofH;
    if (wall === 'timber') {
      rect(c, 0, wy, W, wallH, PAL.plaster[0]);
      for (let x = 0; x < W; x += 12) rect(c, x, wy, 2, wallH, PAL.wood[2]);
      rect(c, 0, wy, W, 2, PAL.wood[2]); rect(c, 0, wy + wallH - 3, W, 3, PAL.wood[2]);
      rect(c, 0, wy + 10, W, 1, PAL.wood[1]);
    } else {
      const ramp = wall === 'stone' ? PAL.stone : PAL.basalt;
      rect(c, 0, wy, W, wallH, ramp[0]);
      for (let y = 0; y < wallH; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < W; x += 8) {
        rect(c, x, wy + y, 7, 3, pick(ramp, hash(x, y, seed)));
        rect(c, x, wy + y, 7, 1, ramp[3]);
      }
    }
    // Door, centred, with a step and a lamp.
    const dx = Math.floor(W / 2) - 5;
    rect(c, dx - 1, wy + 5, 12, 17, PAL.wood[2]);
    rect(c, dx, wy + 6, 10, 16, PAL.wood[0]);
    rect(c, dx + 2, wy + 8, 6, 5, PAL.wood[1]);
    rect(c, dx + 7, wy + 14, 1, 2, '#e6c35a');
    // Windows (warm light comes from the night pass via `lights`).
    const wins: { x: number; y: number; r: number; warm?: boolean }[] = [];
    for (let x = 6; x + 10 < W; x += 22) {
      if (Math.abs(x + 5 - (dx + 5)) < 12) continue;
      rect(c, x - 1, wy + 6, 12, 10, PAL.wood[2]);
      rect(c, x, wy + 7, 10, 8, PAL.windowDark);
      rect(c, x + 4, wy + 7, 1, 8, PAL.wood[2]); rect(c, x, wy + 10, 10, 1, PAL.wood[2]);
      rect(c, x + 1, wy + 8, 2, 2, '#6f6aa0');
      rect(c, x - 1, wy + 15, 12, 2, PAL.wood[1]);
      // Flower box under some windows.
      if (hash(x, seed, 9) > .4) for (let i = 0; i < 5; i++) rect(c, x + i * 2, wy + 14, 2, 2, pick(PAL.flower, hash(x + i, seed, 11)));
      wins.push({ x: x + 5 - W / 2, y: wy + 11 - H, r: 14, warm: true });
    }
    // Roof (separate layer): a 3/4 gable — the near slope big, ridge line, shingles.
    const roofImg = cv(W + 4, roofH + 4);
    const rc = roofImg.getContext('2d')!;
    const ramp = roofRamp(roof);
    rect(rc, 2, 2, W, roofH, ramp[0]);
    for (let y = 0; y < roofH; y += 4) {
      for (let x = (y / 4) % 2 ? 0 : 3; x < W; x += 6) {
        rect(rc, 2 + x, 2 + y, 5, 3, pick(ramp, hash(x, y, seed + 3)));
        rect(rc, 2 + x, 2 + y + 3, 5, 1, ramp[2]);
      }
    }
    rect(rc, 2, 2 + Math.floor(roofH * .38), W, 2, ramp[3]);
    rect(rc, 2, 2, W, 2, ramp[2]);
    rect(rc, 2, 2 + roofH - 3, W, 3, ramp[2]);
    // Chimney on the roof.
    const smoke: { x: number; y: number }[] = [];
    if (chimney) {
      const cx = Math.floor(W * (hash(w, d, seed) > .5 ? .72 : .26));
      rect(rc, cx, 0, 8, 12, PAL.stone[2]);
      rect(rc, cx, 0, 8, 3, PAL.stone[3]);
      rect(rc, cx + 1, 1, 6, 1, '#2a2430');
      smoke.push({ x: cx + 4 - W / 2 - 2, y: -H });
    }
    // Eave shadow on the wall top.
    rect(c, 0, wy, W, 3, 'rgba(0,0,0,.18)');
    const outlined = outline(body);
    const roofOut = outline(roofImg);
    return {
      img: outlined, ax: W / 2 + 1, ay: H + 1,
      roof: { img: roofOut, x: -(W / 2) - 3, y: -H - 3 },
      lights: wins, smoke,
    };
  });
}

/** A market stall: a striped awning over a counter of goods, string lights along its front. */
export function stall(widthTiles: number, palette: number, goods: 'pots' | 'bread' | 'gems' | 'tools' | 'books' | 'fish', seed = 0): Sprite {
  return cached(`stall:${widthTiles}:${palette}:${goods}:${seed}`, () => {
    const W = widthTiles * TILE, H = 34;
    const img = cv(W, H);
    const c = img.getContext('2d')!;
    const [a, b] = PAL.awning[palette % PAL.awning.length];
    // Posts.
    rect(c, 1, 10, 2, 24, PAL.wood[2]); rect(c, W - 3, 10, 2, 24, PAL.wood[2]);
    // Counter.
    rect(c, 0, 22, W, 12, PAL.wood[1]); rect(c, 0, 22, W, 2, PAL.wood[3]); rect(c, 0, 31, W, 3, PAL.wood[2]);
    for (let x = 4; x < W - 4; x += 8) rect(c, x, 25, 1, 6, PAL.wood[2]);
    // Goods on the counter.
    const lights: { x: number; y: number; r: number; warm?: boolean }[] = [];
    for (let x = 4; x < W - 5; x += 5) {
      const r = hash(x, seed, 3);
      if (goods === 'pots') { const col = pick(['#8a4fb0', '#e8506a', '#4b90d6', '#5a9a49', '#f2c94c'], r); rect(c, x, 17, 4, 5, col); rect(c, x + 1, 15, 2, 2, col); rect(c, x + 1, 17, 1, 2, '#ffffff99'); }
      if (goods === 'bread') { rect(c, x, 18, 5, 4, pick(['#c98a45', '#d9a35c', '#b0763a'], r)); rect(c, x + 1, 18, 3, 1, '#e8c07a'); }
      if (goods === 'gems') { rect(c, x + 1, 17, 3, 4, pick(['#7fd5ff', '#ff6dd7', '#a48bff', '#4dffe0'], r)); rect(c, x + 1, 17, 1, 1, '#ffffff'); }
      if (goods === 'tools') { rect(c, x + 2, 13, 1, 9, PAL.wood[2]); rect(c, x, 13, 5, 2, '#9aa2ad'); }
      if (goods === 'books') { rect(c, x, 17, 4, 5, pick(['#8f3524', '#3f78b5', '#5a9a49', '#8a4fb0'], r)); rect(c, x, 17, 4, 1, '#f3e7cf'); }
      if (goods === 'fish') { rect(c, x, 19, 5, 2, pick(['#9fb7c9', '#c9a26f', '#7fa3c2'], r)); rect(c, x + 4, 18, 1, 4, '#9fb7c9'); }
    }
    // Awning: scalloped stripes.
    for (let x = 0; x < W; x += 4) {
      const col = (x / 4) % 2 ? b : a;
      rect(c, x, 2, 4, 9, col);
      rect(c, x + 1, 11, 2, 1, col);
    }
    rect(c, 0, 2, W, 1, '#00000033');
    // String lights along the awning's lip.
    for (let x = 2; x < W; x += 5) {
      rect(c, x, 12 + (x % 2), 1, 1, '#3a2a20');
      rect(c, x, 13 + (x % 2), 2, 2, PAL.glow);
      lights.push({ x: x + 1 - W / 2, y: 14 - H, r: 6, warm: true });
    }
    const out = outline(img);
    return { img: out, ax: W / 2 + 1, ay: H + 1, lights };
  });
}

/** A round tree: trunk on the ground, a fat canopy as its own fading layer. */
export function tree(kind: 'oak' | 'pine' | 'fruit', seed = 0): Sprite {
  return cached(`tree:${kind}:${seed}`, () => {
    const W = 34, H = 46;
    const trunk = cv(W, H);
    const c = trunk.getContext('2d')!;
    rect(c, 14, 30, 6, 16, PAL.trunk[0]); rect(c, 14, 30, 2, 16, PAL.trunk[1]); rect(c, 12, 43, 10, 3, PAL.trunk[2]);
    const crown = cv(W, 36);
    const k = crown.getContext('2d')!;
    const ramp = PAL.leaf;
    if (kind === 'pine') {
      for (let t = 0; t < 4; t++) {
        const y = 4 + t * 7, half = 5 + t * 3;
        for (let row = 0; row < 8; row++) rect(k, 17 - Math.round(half * row / 8), y + row, Math.round(half * row / 8) * 2 + 1, 1, row < 2 ? ramp[3] : t % 2 ? ramp[0] : ramp[1]);
      }
    } else {
      const blobs = [[17, 18, 15], [9, 21, 9], [25, 21, 9], [13, 11, 9], [22, 11, 9]];
      for (const [x, y, r] of blobs) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r) continue;
        const shade = yy < -r / 3 && xx < r / 3 ? ramp[3] : yy > r / 2 ? ramp[2] : hash(x + xx, y + yy, seed) > .8 ? ramp[1] : ramp[0];
        rect(k, x + xx, y + yy, 1, 1, shade);
      }
      if (kind === 'fruit') for (let i = 0; i < 7; i++) rect(k, 6 + Math.floor(hash(i, seed, 2) * 22), 8 + Math.floor(hash(i, seed, 3) * 20), 2, 2, '#d8433a');
    }
    const t = outline(trunk), cr = outline(crown);
    return { img: t, ax: W / 2 + 1, ay: H + 1, roof: { img: cr, x: -(W / 2) - 1, y: -H - 1 + 2 } };
  });
}

export function lamp(): Sprite {
  return cached('lamp', () => {
    const img = cv(8, 30);
    const c = img.getContext('2d')!;
    rect(c, 3, 8, 2, 20, '#2f2a33'); rect(c, 1, 27, 6, 3, '#2f2a33');
    rect(c, 1, 2, 6, 7, '#2f2a33'); rect(c, 2, 3, 4, 5, PAL.glow); rect(c, 0, 1, 8, 2, '#2f2a33');
    return { img: outline(img), ax: 5, ay: 31, lights: [{ x: 0, y: -26, r: 34, warm: true }] };
  });
}

export function bench(): Sprite {
  return cached('bench', () => {
    const img = cv(22, 12);
    const c = img.getContext('2d')!;
    rect(c, 0, 0, 22, 3, PAL.wood[1]); rect(c, 0, 4, 22, 3, PAL.wood[3]); rect(c, 0, 4, 22, 1, PAL.wood[1]);
    rect(c, 2, 7, 2, 5, PAL.wood[2]); rect(c, 18, 7, 2, 5, PAL.wood[2]);
    return { img: outline(img), ax: 12, ay: 13 };
  });
}

export function barrel(): Sprite {
  return cached('barrel', () => {
    const img = cv(10, 13);
    const c = img.getContext('2d')!;
    rect(c, 1, 0, 8, 13, PAL.wood[1]); rect(c, 0, 2, 10, 9, PAL.wood[0]);
    rect(c, 0, 3, 10, 1, '#6b6670'); rect(c, 0, 9, 10, 1, '#6b6670'); rect(c, 2, 0, 6, 2, PAL.wood[3]);
    return { img: outline(img), ax: 6, ay: 14 };
  });
}

export function crate(): Sprite {
  return cached('crate', () => {
    const img = cv(12, 12);
    const c = img.getContext('2d')!;
    rect(c, 0, 0, 12, 12, PAL.wood[3]); rect(c, 0, 0, 12, 2, PAL.plank[2]);
    rect(c, 0, 0, 1, 12, PAL.wood[2]); rect(c, 11, 0, 1, 12, PAL.wood[2]); rect(c, 0, 11, 12, 1, PAL.wood[2]);
    for (let i = 1; i < 11; i++) rect(c, i, i, 1, 1, PAL.wood[2]);
    return { img: outline(img), ax: 7, ay: 13 };
  });
}

export function flowerbed(w = 2, seed = 0): Sprite {
  return cached(`flowerbed:${w}:${seed}`, () => {
    const W = w * TILE, img = cv(W, 10);
    const c = img.getContext('2d')!;
    rect(c, 0, 4, W, 6, PAL.wood[2]); rect(c, 1, 3, W - 2, 3, PAL.dirt[2]);
    for (let x = 2; x < W - 2; x += 3) {
      rect(c, x, 2, 1, 3, PAL.leaf[0]);
      rect(c, x - 1, 0, 3, 2, pick(PAL.flower, hash(x, seed, 7)));
    }
    return { img: outline(img), ax: W / 2 + 1, ay: 11 };
  });
}

/** The square's heart: a forge-fed brazier fountain (Seamworks' answer to a town fountain). */
export function brazierFountain(): Sprite {
  return cached('fountain', () => {
    const W = 48, H = 44, img = cv(W, H);
    const c = img.getContext('2d')!;
    // Basin (an ellipse of stone with water inside).
    for (let y = 0; y < 16; y++) for (let x = 0; x < 48; x++) {
      const nx = (x - 23.5) / 24, ny = (y - 7.5) / 8;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      rect(c, x, 26 + y, 1, 1, d > .62 ? (y < 8 ? PAL.stone[3] : PAL.stone[2]) : (d > .5 ? PAL.water[3] : hash(x, y, 4) > .85 ? PAL.water[2] : PAL.water[0]));
    }
    // Pillar and the ember bowl.
    rect(c, 20, 10, 8, 20, PAL.stone[0]); rect(c, 20, 10, 2, 20, PAL.stone[3]);
    rect(c, 14, 6, 20, 5, PAL.basalt[1]); rect(c, 14, 6, 20, 1, PAL.basalt[3]);
    for (let i = 0; i < 9; i++) rect(c, 16 + i * 2, 2 + (i % 3), 2, 4 - (i % 3), pick(PAL.ember, hash(i, 1, 5)));
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: 0, y: -40, r: 48, warm: true }, { x: 0, y: -12, r: 26 }] };
  });
}

export function cart(): Sprite {
  return cached('cart', () => {
    const img = cv(30, 20);
    const c = img.getContext('2d')!;
    rect(c, 2, 4, 26, 9, PAL.wood[1]); rect(c, 2, 4, 26, 2, PAL.wood[3]);
    for (let i = 0; i < 5; i++) rect(c, 4 + i * 5, 0, 5, 5, pick(['#e0702f', '#f39a3c', '#c98a45'], hash(i, 3, 3)));
    for (const x of [6, 22]) { rect(c, x - 3, 12, 7, 7, '#3a2a20'); rect(c, x - 2, 13, 5, 5, PAL.wood[0]); rect(c, x, 15, 1, 1, '#3a2a20'); }
    rect(c, 28, 8, 2, 2, PAL.wood[2]);
    return { img: outline(img), ax: 16, ay: 21 };
  });
}

/** A short run of fence along x (tiles). */
export function fence(tiles: number): Sprite {
  return cached(`fence:${tiles}`, () => {
    const W = tiles * TILE, img = cv(W, 12);
    const c = img.getContext('2d')!;
    rect(c, 0, 3, W, 2, PAL.wood[1]); rect(c, 0, 7, W, 2, PAL.wood[1]);
    for (let x = 0; x < W; x += 8) { rect(c, x, 0, 3, 12, PAL.wood[0]); rect(c, x, 0, 3, 1, PAL.wood[3]); }
    return { img: outline(img), ax: W / 2 + 1, ay: 13 };
  });
}

/** The Hearth's open fire on the square: logs and a living flame (the engine animates the flame). */
export function hearthFire(): Sprite {
  return cached('hearth', () => {
    const img = cv(20, 12);
    const c = img.getContext('2d')!;
    for (let i = 0; i < 8; i++) rect(c, 2 + i * 2, 6 + (i % 2), 3, 3, PAL.stone[i % 2 ? 2 : 0]);
    rect(c, 4, 6, 12, 2, PAL.wood[2]); rect(c, 6, 4, 8, 2, PAL.wood[0]);
    return { img: outline(img), ax: 11, ay: 13, lights: [{ x: 0, y: -10, r: 44, warm: true }] };
  });
}

/** A small wooden signpost with a hanging pixel plaque (used for station names). */
export function signpost(): Sprite {
  return cached('signpost', () => {
    const img = cv(14, 20);
    const c = img.getContext('2d')!;
    rect(c, 6, 4, 2, 16, PAL.wood[2]);
    rect(c, 0, 2, 14, 7, PAL.wood[3]); rect(c, 0, 2, 14, 1, PAL.plank[2]);
    rect(c, 2, 4, 10, 1, PAL.wood[2]); rect(c, 2, 6, 7, 1, PAL.wood[2]);
    return { img: outline(img), ax: 8, ay: 21 };
  });
}
