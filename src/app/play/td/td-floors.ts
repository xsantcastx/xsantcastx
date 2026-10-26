/**
 * td-floors.ts — the art style upgrade, stage 4 (docs/handoff/art-style.md): boards, rugs, inside walls, dungeon rock
 * faces and water, painted per pixel at the world pixel (so they run seamless across tiles) and baked into the engine's
 * chunk cache with the rest of the ground (td-ground paintRichGround). Nothing here runs per frame.
 *
 * - **Boards** (`plank`): staggered planks with grain, nails at the joints, a lit edge and a dark seam; on a pier the
 *   planks run across it between two edge beams, on a bridge along it; a shadow where a wall stands over them.
 * - **Rugs**: a woven field of diamonds, a border band where the rug ends.
 * - **Inside walls** (`wall`) and **rock** (`rock`): a face two tiles tall where floor lies south (the old face was 13 px
 *   beside a 45-px Keeper) — plaster over a panelled wainscot, a ceiling beam; rough rock in ledges, damp and dark at
 *   its foot. The blocked tiles are the same tiles: only the paint changed.
 * - **Water**: deeper away from the shore, wavelets that rock a pixel to and fro over the engine's four water frames,
 *   foam lapping at every shore, the bank's and a pier's shadow on the water, pilings with a ring of foam. A hook for
 *   fish shadows: `fishShadow()` and `openWater()`.
 */
import { SOLID_GROUND, TILE, hash, type Ground } from './td-art';

type Ctx = CanvasRenderingContext2D;
type Rgb = readonly [number, number, number];
type Nb = (dx: number, dy: number) => Ground;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbs = (r: readonly string[]) => r.map(hex);

/** Boards, darkest to lightest (the seam, the shade, the body ×3, the lit edge, the sheen). */
export const BOARD_RAMP = ['#3a2414', '#5e3a20', '#7f5230', '#946238', '#a87444', '#bb8652', '#cf9c64', '#e0b27a'] as const;
/** Water, deepest to the foam. */
export const WATER_RAMP = ['#173f72', '#1d4a82', '#24599a', '#2d68ad', '#3676bc', '#3f84c9', '#4c94d4', '#68acdf', '#a6d4f0', '#eef8ff'] as const;
const ROCK = rgbs(['#120e16', '#1a1420', '#231c2a', '#2e2636', '#3a3242', '#463d50', '#574c62', '#6b6276']);
const PLASTER = rgbs(['#8a7a62', '#b8a684', '#d4c29e', '#e6d6b2', '#f2e4c4', '#fbf1d8']);
const RUG = rgbs(['#3a120c', '#5e2218', '#7a2c1e', '#8f3524', '#a8442c', '#d68a2e', '#e8d5b0', '#f6ead0']);
const BOARD = rgbs(BOARD_RAMP), WATER = rgbs(WATER_RAMP);
const IRON = hex('#2a2630'), IRON_LIT = hex('#8a8494'), DARK = hex('#0c080e');
const EMBER = rgbs(['#9e2e1c', '#e2552a', '#ff8a2e']);

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
function noise(x: number, y: number, s: number, salt: number): number {
  const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, salt), b = hash(gx + 1, gy, salt), c = hash(gx, gy + 1, salt), d = hash(gx + 1, gy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const OWN: ReadonlySet<Ground> = new Set<Ground>(['plank', 'rug', 'wall', 'rock', 'water']);
/** Does this painter own `kind` (paintFloor paints it)? */
export const ownsFloor = (k: Ground) => OWN.has(k);
/** Does it own the edge between `kind` and `neighbour` (td-art paintEdge should leave it)? */
export function floorEdge(kind: Ground, neighbour: Ground): boolean {
  if (kind === 'rock' || kind === 'wall' || kind === 'water' || kind === 'rug') return true;
  if (kind === 'plank') return neighbour === 'water' || neighbour === 'wall' || neighbour === 'rock';
  return false;
}
const solid = (g: Ground) => SOLID_GROUND.has(g);

let scratch: ImageData | null = null;
/** Paint a board, rug, wall, rock or water tile at (ox, oy); false for any other ground. */
export function paintFloor(c: Ctx, kind: Ground, tx: number, ty: number, ox: number, oy: number, nb: Nb, frame = 0): boolean {
  if (!OWN.has(kind)) return false;
  const img = scratch && scratch.width === TILE ? scratch : (scratch = c.createImageData(TILE, TILE));
  const d = img.data, wx0 = tx * TILE, wy0 = ty * TILE;
  const put = (x: number, y: number, rgb: Rgb, dim = 0) => {
    const k = (y * TILE + x) * 4, f = 1 - dim;
    d[k] = rgb[0] * f; d[k + 1] = rgb[1] * f; d[k + 2] = rgb[2] * f; d[k + 3] = 255;
  };
  const paint = kind === 'plank' ? boardPx(nb) : kind === 'rug' ? rugPx(nb) : kind === 'wall' ? wallPx(nb, wx0) : kind === 'rock' ? rockPx(nb) : waterPx(nb, wx0, wy0, frame);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const [rgb, dim] = paint(x, y, wx0 + x, wy0 + y); put(x, y, rgb, dim); }
  c.putImageData(img, ox, oy);
  return true;
}

type Px = (x: number, y: number, wx: number, wy: number) => readonly [Rgb, number];

/** A shadow on a floor where a solid wall stands over it (north), or beside it (west/east): the room's corners. */
function occlusion(nb: Nb): (x: number, y: number) => number {
  const n = solid(nb(0, -1)), w = solid(nb(-1, 0)), e = solid(nb(1, 0));
  return (x, y) => (n ? (y === 0 ? .45 : y === 1 ? .32 : y === 2 ? .2 : y === 3 && (x + y) % 2 ? .1 : 0) : 0) + (w && x < 2 ? (x ? .1 : .22) : 0) + (e && x > 13 ? (x === 15 ? .18 : .08) : 0);
}

/** Boards. */
function boardPx(nb: Nb): Px {
  const wet = (g: Ground) => g === 'water' || g === 'blackwater';
  const wW = wet(nb(-1, 0)), wE = wet(nb(1, 0)), wN = wet(nb(0, -1)), wS = wet(nb(0, 1));
  // A bridge across a river (water north and south, not either side) lays its planks north–south.
  const along = (wN || wS) && !wW && !wE;
  const occ = occlusion(nb);
  return (x, y, wx, wy) => {
    const u = along ? wy : wx, v = along ? wx : wy;
    const row = Math.floor(v / 4), lv = v - row * 4;
    const len = (wW || wE) && !along ? 16 : 32, off = (wW || wE) && !along ? 0 : Math.floor(hash(row, 3, 51) * 32);
    const seg = Math.floor((u + off) / len), lu = (u + off) - seg * len;
    let t = 3 + Math.floor(hash(row, seg, 52) * 3);
    if (lv === 0) t += 1; else if (lv === 3) t = 0; else if (lv === 2 && hash(u >> 1, row, 53) > .8) t -= 1;
    if (lu === 0) t = 1;
    if (hash(Math.floor(u / 3), row * 7 + seg, 54) > .82 && lv > 0 && lv < 3) t -= 1;
    let rgb: Rgb = BOARD[Math.max(0, Math.min(7, t))];
    if ((lu === 2 || lu === len - 2) && (lv === 1 || lv === 2) && lv === 1 + (seg & 1)) rgb = lu === 2 ? IRON_LIT : IRON;
    // Pier edges: an edge beam where the water is, the gap dark.
    const ax = along ? y : x;
    if (!along) {
      if (wW && x <= 1) rgb = x === 0 ? BOARD[0] : BOARD[5];
      if (wE && x >= 14) rgb = x === 15 ? BOARD[0] : BOARD[2];
      if (wS && y >= 13) rgb = y === 15 ? BOARD[0] : y === 13 ? BOARD[5] : BOARD[2];
    } else {
      if (wN && y <= 1) rgb = y === 0 ? BOARD[0] : BOARD[6];
      if (wS && y >= 14) rgb = y === 15 ? BOARD[0] : BOARD[2];
    }
    void ax;
    return [rgb, occ(x, y)];
  };
}

/** A woven rug: a field of diamonds, a border band at its edges. */
function rugPx(nb: Nb): Px {
  const out = (dx: number, dy: number) => nb(dx, dy) !== 'rug';
  const n = out(0, -1), s = out(0, 1), w = out(-1, 0), e = out(1, 0);
  const occ = occlusion(nb);
  return (x, y, wx, wy) => {
    const edge = Math.min(n ? y : 9, s ? 15 - y : 9, w ? x : 9, e ? 15 - x : 9);
    let i: number;
    if (edge === 0) i = 1;
    else if (edge === 1 || edge === 3) i = 6;
    else if (edge === 2) i = 5;
    else {
      const px8 = ((wx % 8) + 8) % 8, py8 = ((wy % 8) + 8) % 8, dd = Math.abs(px8 - 3.5) + Math.abs(py8 - 3.5);
      i = dd < 1.5 ? 5 : dd < 2.5 ? 2 : dd < 3.3 ? 4 : 3;
      if ((wx + wy) % 2 && i === 3) i = 2 + (hash(wx >> 1, wy, 61) > .5 ? 1 : 0);
    }
    // The fringe where a rug's short end lies on the boards.
    if ((n && y === 0) || (s && y === 15)) i = x % 2 ? 7 : 0;
    return [RUG[i], occ(x, y) + (x > 11 && edge > 3 ? .06 : 0)];
  };
}

/** Which part of a two-tall face a solid tile is: 0 the lower face (floor south), 1 the upper (face south of it), -1 a top. */
function facePart(nb: Nb, kind: Ground): number {
  if (!solid(nb(0, 1))) return 0;
  if (nb(0, 1) === kind && !solid(nb(0, 2)) && solid(nb(0, -1))) return 1;
  return -1;
}

/** An inside wall: plaster over a panelled wainscot, a ceiling beam; a dark timber top elsewhere. */
function wallPx(nb: Nb, wx0: number): Px {
  const part = facePart(nb, 'wall'), tall = part === 1 || (part === 0 && nb(0, -1) === 'wall' && solid(nb(0, -2)));
  const pic = part === 1 && hash(wx0, 7, 71) > .91;
  return (x, y, wx, wy) => {
    if (part < 0) {
      // The top of the wall: dark timber, a beam line, a lit lip where a face begins below.
      const t = y === 7 || y === 8 ? 3 : (hash(wx >> 2, wy, 72) > .7 ? 1 : 2);
      return [BOARD[Math.min(t, 2)], .35];
    }
    // The face: (fy) 0 at its top … 31 at the floor (a single-tall face is the lower 16 rows).
    const fy = part === 1 ? y : 16 + y;
    const plasterTop = tall ? 0 : 16;
    if (fy - plasterTop < 3) { const t = fy - plasterTop === 0 ? 2 : fy - plasterTop === 1 ? 4 : 1; return [BOARD[t], .1]; }
    if (fy >= 30) return [BOARD[fy === 31 ? 0 : 2], 0];
    if (fy >= 20) {
      // Wainscot: vertical panels in a frame, a chair rail at its top.
      if (fy === 20) return [BOARD[6], 0];
      if (fy === 21) return [BOARD[1], 0];
      const p = ((wx % 12) + 12) % 12;
      if (fy === 22 || fy === 29 || p === 0) return [BOARD[2], 0];
      if (p === 1 || fy === 23) return [BOARD[5], 0];
      if (p === 11 || fy === 28) return [BOARD[2], 0];
      return [BOARD[hash(wx >> 2, wy, 73) > .75 ? 3 : 4], 0];
    }
    // Plaster: a faint grain, darker under the beam.
    if (pic && x >= 4 && x <= 11 && y >= 6 && y <= 12) {
      const fr = x === 4 || x === 11 || y === 6 || y === 12;
      return [fr ? (x === 4 || y === 6 ? BOARD[6] : BOARD[1]) : y < 9 ? hex('#7fb4d8') : x < 8 ? hex('#5a9a49') : hex('#3f7838'), 0];
    }
    let t = 3 + (hash(wx, wy, 74) > .88 ? 1 : hash(wx, wy, 75) > .92 ? -1 : 0);
    const below = fy - plasterTop - 3;
    if (below < 2) t -= 1;
    return [PLASTER[t], x > 12 ? .04 : 0];
  };
}

/** Rock: a face two tiles tall in rough ledges, damp and darker at its foot, the odd ember vein; a dark mass on top. */
function rockPx(nb: Nb): Px {
  const part = facePart(nb, 'rock');
  const lipN = !solid(nb(0, -1)), lipW = !solid(nb(-1, 0)), lipE = !solid(nb(1, 0));
  return (x, y, wx, wy) => {
    if (part < 0) {
      const m = noise(wx, wy, 6, 81);
      let i = m > .62 ? 3 : m > .38 ? 2 : 1;
      if ((lipN && y === 0) || (lipW && x === 0) || (lipE && x === 15)) i = 4;
      if ((lipW && x === 1) || (lipE && x === 14)) i = 0;
      return [ROCK[i], 0];
    }
    // fy: 0 at the face's top (the lit rim) … the floor.
    const tall = part === 1 || (part === 0 && nb(0, -1) === 'rock' && solid(nb(0, -2)));
    const fy = part === 1 ? y : tall ? 16 + y : y + 16, top = tall ? 0 : 16, f = fy - top, H = 32 - top;
    if (f === 0) return [ROCK[7], 0];
    if (f === 1) return [ROCK[6], 0];
    // Ledges: a world-aligned band every 5–8 px with a lit top and a dark underside, wobbling with the rock.
    const wob = Math.floor(noise(wx, 3, 9, 82) * 6 + noise(wx, 5, 3, 89) * 2), band = ((fy + wob) % 8 + 8) % 8;
    const m = noise(wx, wy, 4, 83) * .6 + noise(wx, wy, 11, 84) * .4;
    let i = m > .6 ? 5 : m > .42 ? 4 : 3;
    if (band === 0) i = 6; else if (band === 1) i = Math.min(i, 2);
    if (hash(wx, wy, 85) > .93) i -= 1;
    // Fissures running down.
    if (hash(wx >> 1, Math.floor((fy + wob) / 8), 86) > .975 && (wx & 1) === 0 && band > 1) i = 1;
    // Darker toward the foot, the damp, a contact line at the floor.
    const foot = f / H;
    if (foot > .78 && bayer(wx, wy) < (foot - .78) * 3.5) i -= 1;
    if (fy >= 31) i = 0;
    if (x > 12) i -= bayer(wx, wy) < .3 ? 1 : 0;
    if (part === 0 && y > 6 && y < 10 && hash(wx >> 2, wy >> 3, 87) > .975) return [EMBER[(x + y) % 3], 0];
    if (part === 0 && y > 9 && y < 14 && hash(wx, wy, 88) > .985) return [hex('#9ec8e6'), 0];
    return [ROCK[Math.max(0, Math.min(7, i))], 0];
  };
}

const waterPre = new Map<string, { dist: Float32Array; pier: Float32Array; lapN: Float32Array }>();
/** The four water frames' gentle sway (px). */
const SWAY = [0, 1, 2, 1] as const;

/** Water: depth from the shore, wavelets, lapping foam, shadows of banks and piers, pilings. */
function waterPx(nb: Nb, wx0: number, wy0: number, frame: number): Px {
  const isWet = (g: Ground) => g === 'water';
  // Land within two tiles (rects in tile-local px) for the depth and the foam.
  const land: { x0: number; y0: number; x1: number; y1: number; pier: boolean; dx: number; dy: number }[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!dx && !dy) continue;
    const g = nb(dx, dy);
    if (isWet(g) || g === 'ember' || g === 'blackwater') continue;
    land.push({ x0: dx * 16, y0: dy * 16, x1: dx * 16 + 16, y1: dy * 16 + 16, pier: g === 'plank' || g === 'boardwalk', dx, dy });
  }
  const sway = SWAY[((frame % 4) + 4) % 4];
  const pN = nb(0, -1) === 'plank', pW = nb(-1, 0) === 'plank';
  const shoreN = !isWet(nb(0, -1)) && !pN, shoreW = !isWet(nb(-1, 0)) && !pW;
  // The shore distances and the foam's noise do not change with the frame: worked out once a tile, kept for the other three.
  // (Keyed by the land round it too: another level may have water on the same tile with other shores.)
  const key = `${wx0},${wy0},${land.map(r => r.dx * 5 + r.dy + (r.pier ? 100 : 0)).join('.')}`;
  let pre = waterPre.get(key);
  if (!pre) {
    const dist = new Float32Array(TILE * TILE), pier = new Float32Array(TILE * TILE), lapN = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let dd0 = 99, pd = 99;
      for (const r of land) {
        const ddx = x < r.x0 ? r.x0 - x : x >= r.x1 ? x - r.x1 + 1 : 0, ddy = y < r.y0 ? r.y0 - y : y >= r.y1 ? y - r.y1 + 1 : 0;
        const dd = Math.hypot(ddx, ddy);
        if (r.pier) pd = Math.min(pd, dd); else dd0 = Math.min(dd0, dd);
      }
      dist[y * TILE + x] = dd0; pier[y * TILE + x] = pd; lapN[y * TILE + x] = noise(wx0 + x, wy0 + y, 5, 97) * 1.6;
    }
    pre = { dist, pier, lapN };
    waterPre.set(key, pre);
    if (waterPre.size > 1500) waterPre.delete(waterPre.keys().next().value!);
  }
  const P = pre;
  return (x, y, wx, wy) => {
    const dist = P.dist[y * TILE + x], pierD = P.pier[y * TILE + x];
    // Depth: a step lighter every band nearer the shore, dithered; slow swells of light and dark.
    const df = Math.max(2, Math.min(5.4, 5.6 - dist / 7)), depth = Math.floor(df) + (bayer(wx, wy) < df - Math.floor(df) ? 1 : 0);
    const sw = noise(wx + sway * 2, wy, 20, 91);
    let i = Math.floor(depth) + (sw > .66 && bayer(wx, wy) < (sw - .66) * 2.4 ? 1 : sw < .3 && bayer(wx, wy) < (.3 - sw) * 2.4 ? -1 : 0);
    // Wavelets: short lit crests over a dark trough, rocking a pixel to and fro with the frames.
    const cw = 13, ch = 7, cx = Math.floor((wx - sway) / cw), cy = Math.floor(wy / ch);
    for (const ox of [0, -1]) {
      const k = cx + ox, h = hash(k, cy, 92);
      if (h < .5) continue;
      const sx = k * cw + Math.floor(hash(k, cy, 93) * 6) + sway, sy = cy * ch + 2 + Math.floor(hash(k, cy, 94) * 3), len = 3 + Math.floor(hash(k, cy, 95) * 3);
      if (wx >= sx && wx < sx + len) { if (wy === sy) i = 7; else if (wy === sy + 1 && wx > sx && wx < sx + len - 1) i = Math.max(1, i - 1); }
      if (wx >= sx + 1 && wx < sx + len - 1 && wy === sy - 1 && h > .85) i = 8;
    }
    // A glint now and then, on one frame of four.
    if (dist > 5 && hash(wx, wy, 96 + frame) > .996) i = 9;
    // The bank's shadow (north and west: the light is upper left), then foam lapping at the shore.
    let dim = 0;
    if (shoreN && y < 3) dim = y === 0 ? .4 : y === 1 ? .28 : .14;
    if (shoreW && x < 2) dim = Math.max(dim, x === 0 ? .3 : .16);
    const lap = sway * .8 + P.lapN[y * TILE + x];
    const fd = dist - ((shoreN && y < 3) || (shoreW && x < 2) ? 1.5 : 0);
    if (fd < 1 + lap) i = fd < .5 + lap * .5 ? 9 : bayer(wx, wy) < .6 ? 8 : 9;
    else if (fd > 3 + lap && fd < 4.2 + lap && hash(wx >> 1, wy, 98) > .45) i = 8;
    // A pier's shadow on the water (east and south of its boards) and its pilings.
    if (pierD < 99) {
      if ((pW && x < 4) || (pN && y < 4)) dim = Math.max(dim, .34 - Math.min(x, y) * .05);
      if (pN && (((wx % 8) + 8) % 8 === 2 || ((wx % 8) + 8) % 8 === 3) && y < 4) {
        return [y < 3 ? BOARD[((wx & 1) ? 1 : 3)] : WATER[9], 0];
      }
      if (pN && y === 4 && (((wx % 8) + 8) % 8) >= 1 && (((wx % 8) + 8) % 8) <= 4) i = 9;
      if (pW && x < 2 && ((wy % 16) + 16) % 16 >= 10 && ((wy % 16) + 16) % 16 <= 12) return [x ? BOARD[2] : BOARD[4], 0];
      if (pW && x === 2 && ((wy % 16) + 16) % 16 >= 10 && ((wy % 16) + 16) % 16 <= 13) i = 9;
    }
    return [WATER[Math.max(0, Math.min(9, i))], dim];
  };
}

/** Open water (no land within a tile): where a fish shadow may swim (the hook for fishing spots; nothing swims yet). */
export function openWater(nb: Nb): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (nb(dx, dy) !== 'water') return false;
  return true;
}
const fishCache = new Map<number, HTMLCanvasElement>();
/**
 * A fish's shadow under the water, `len` px long, facing right (flip it to swim left): a dark dithered body and tail.
 * The hook for fishing spots (campaign queue #8): an engine pass may drift a few of these over `openWater` tiles.
 */
export function fishShadow(len = 9): HTMLCanvasElement {
  let el = fishCache.get(len);
  if (el) return el;
  el = document.createElement('canvas'); el.width = len + 3; el.height = 5;
  const c = el.getContext('2d')!;
  for (let x = 0; x < len; x++) {
    const h = Math.round(Math.sin((x / len) * Math.PI) * 2.2);
    for (let y = 2 - h; y <= 2 + h; y++) { c.fillStyle = `rgba(10,22,48,${(x + y) % 2 ? .42 : .3})`; c.fillRect(x + 3, y, 1, 1); }
  }
  c.fillStyle = 'rgba(10,22,48,.34)'; c.fillRect(0, 0, 1, 2); c.fillRect(0, 3, 1, 2); c.fillRect(1, 1, 2, 3);
  fishCache.set(len, el);
  return el;
}
