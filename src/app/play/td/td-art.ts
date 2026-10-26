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
import { envDetail } from './td-detail';
import { broadleafTree, clumpRamp, paintClump, paintClumps, pineTree, shadowSprite } from './td-flora';
import { volumize } from '../../shared/keeper-look/keeper-volume';
import { paintAltar, paintBrazier, paintBrokenStatue, paintCage, paintChains, paintCobweb, paintInscription, paintRime, paintRitualCircle, paintStain } from './td-dressing';
import { RAMP, paintBarrowDoor, paintBed, paintCaveMouth, paintChimney, paintCounter, paintCryptDoor, paintForgeGate, paintLadderUp, paintMineShaft, paintRoof, paintRuinWall, paintShelf, paintShip, paintStairsDown, paintStairsUp, paintTable, paintTempleGate, paintTower } from './td-build';

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
  // The Verdant Wilds: moss floors, jungle leaves, living bark, mossy temple stone and the rootglass glow.
  moss: ['#3f6e3a', '#4c8042', '#355f33', '#5d9450'],
  jungle: ['#2f6a34', '#3f8240', '#225228', '#58a04c'],
  roofLeaf: ['#4f8a3a', '#62a046', '#3a6c2c', '#7cbc58'],
  bark: ['#6e4a30', '#8a6040', '#4e3220', '#a37a52'],
  temple: ['#8d9486', '#7e8678', '#6f7769', '#a6ad9c'],
  rootglass: ['#eafff6', '#7affd0', '#2fb38a', '#17604e'],
  window: '#ffe39b',
  windowDark: '#3a3654',
  // The Umbral Marches: bog and black water, drowned stone, gloam-violet shingles, lantern gold, hanging moss, the ink glow.
  mire: ['#3b3a2a', '#45432f', '#302f22', '#56543a'],
  blackwater: ['#121a22', '#1a2530', '#0b1016', '#2c3c4a'],
  wetstone: ['#5d646b', '#4f565d', '#40464c', '#737b83'],
  roofGloam: ['#4e4566', '#5f5578', '#3a3350', '#776c92'],
  lantern: ['#fff3c4', '#ffc65a', '#d98a2a', '#6e4220'],
  hangmoss: ['#9aa488', '#78836a', '#5a6450', '#b6bea4'],
  ink: ['#e8e0ff', '#a48bff', '#5a46a8', '#2c2258'],
  boardwalk: ['#6f5c4a', '#7d6853', '#5c4b3d', '#8c7660'],
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

export type Ground = 'grass' | 'dirt' | 'cobble' | 'sand' | 'water' | 'ember' | 'plank' | 'flowers' | 'cave' | 'rock' | 'wall' | 'rug'
  // The Verdant Wilds (maps/verdant-wilds.ts): jungle moss, mossy temple flagstones, and three grounds nobody walks on —
  // a temple's wall, the leaf-sea round the Rootglass Bole's walkways, the Bole's own living wood.
  | 'moss' | 'flagstone' | 'vinewall' | 'canopy' | 'bark'
  // The Umbral Marches (maps/umbral-marches.ts): bog underfoot, the drowned crypts' wet floor, and two nobody walks on —
  // the black water of the fens, the crypts' drowned walls.
  | 'mire' | 'wetstone' | 'blackwater' | 'drownwall'
  // …and the Marches' boardwalks: weathered planks gone grey in the damp, on stilts over the fen.
  | 'boardwalk';
/** Ground nothing walks through (a wall, a mass of rock, the canopy's leaves, a tree's living wood). */
export const SOLID_GROUND: ReadonlySet<Ground> = new Set<Ground>(['rock', 'wall', 'vinewall', 'canopy', 'bark', 'blackwater', 'drownwall']);

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
      // Calm (docs/handoff/calm.md): one bloom on about half a flower bed's tiles, not four on each.
      if (kind === 'flowers') for (let i = 0; i < (r(59) < .5 ? 1 : 0); i++) {
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
    case 'cave': {
      // A dungeon floor: packed dark earth, grit and the odd pebble.
      rect(c, ox, oy, TILE, TILE, '#3b2c2a');
      for (let i = 0; i < 8; i++) rect(c, ox + Math.floor(r(i) * 15), oy + Math.floor(r(i + 9) * 15), 2, 1, i % 3 ? '#4a3833' : '#2c201f');
      if (r(77) > .8) { rect(c, ox + 6, oy + 9, 3, 2, PAL.basalt[1]); rect(c, ox + 6, oy + 9, 3, 1, PAL.basalt[3]); }
      break;
    }
    case 'rock': {
      // Solid rock seen from above: the dark top of the mass (its front face is drawn by paintEdge where floor lies south).
      rect(c, ox, oy, TILE, TILE, '#231c26');
      for (let i = 0; i < 4; i++) rect(c, ox + Math.floor(r(i) * 14), oy + Math.floor(r(i + 5) * 14), 2, 1, '#2e2532');
      break;
    }
    case 'wall': {
      // An inside wall seen from above: the dark top of the timber wall (its plaster face drawn by paintEdge).
      rect(c, ox, oy, TILE, TILE, '#3a2618');
      rect(c, ox, oy + 7, TILE, 2, '#4a3020');
      break;
    }
    case 'rug': {
      // A woven rug over the boards: a red field, a cream border, a diamond.
      rect(c, ox, oy, TILE, TILE, '#8f3524'); rect(c, ox, oy, TILE, 1, '#e8d5b0'); rect(c, ox, oy + 15, TILE, 1, '#e8d5b0');
      rect(c, ox + 6, oy + 6, 4, 4, '#d68a2e'); rect(c, ox + 7, oy + 5, 2, 6, '#d68a2e');
      break;
    }
    case 'moss': {
      // The jungle floor: deep moss, fern sprigs, and now and then a speck of rootglass spore catching the light.
      rect(c, ox, oy, TILE, TILE, PAL.moss[0]);
      for (let i = 0; i < 10; i++) rect(c, ox + Math.floor(r(i) * 15), oy + Math.floor(r(i + 20) * 15), 2, 1, pick(PAL.moss, r(i + 40)));
      if (r(61) > .72) { const x = ox + 2 + Math.floor(r(62) * 10), y = oy + 3 + Math.floor(r(63) * 9); rect(c, x, y, 1, 3, PAL.jungle[3]); rect(c, x - 1, y, 1, 1, PAL.jungle[3]); rect(c, x + 1, y + 1, 1, 1, PAL.jungle[1]); }
      if (r(64) > .93) rect(c, ox + Math.floor(r(65) * 15), oy + Math.floor(r(66) * 15), 1, 1, PAL.rootglass[1]);
      break;
    }
    case 'flagstone': {
      // Old temple flagstones, four slabs to a tile, moss in the joints.
      rect(c, ox, oy, TILE, TILE, '#4b5a4a');
      for (let q = 0; q < 4; q++) {
        const x = ox + (q % 2) * 8 + (ty % 2 && q < 2 ? 1 : 0), y = oy + Math.floor(q / 2) * 8;
        rect(c, x, y, 7, 7, pick(PAL.temple, r(q + 3)));
        rect(c, x, y, 7, 1, PAL.temple[3]); rect(c, x + 6, y + 1, 1, 6, PAL.temple[2]);
        if (r(q + 11) > .7) rect(c, x + Math.floor(r(q + 13) * 5), y + 6, 3, 1, PAL.moss[3]);
      }
      if (r(29) > .8) { rect(c, ox + 7, oy + 4, 2, 6, PAL.moss[1]); rect(c, ox + 6, oy + 7, 4, 2, PAL.moss[3]); }
      break;
    }
    case 'vinewall': {
      // A temple wall seen from above: mossy capstones (its carved face is drawn by paintEdge where floor lies south).
      rect(c, ox, oy, TILE, TILE, '#2c3a2c');
      rect(c, ox, oy + 7, TILE, 1, '#243024');
      for (let i = 0; i < 5; i++) rect(c, ox + Math.floor(r(i) * 14), oy + Math.floor(r(i + 5) * 14), 2, 2, i % 2 ? PAL.moss[2] : '#36483a');
      break;
    }
    case 'canopy': {
      // The leaf-sea round the Bole's walkways, far below the boards: deep shade, and the round tops of the crowns
      // under it, each lit on its top-left and dark on its far side, the gaps between them going down into the green.
      rect(c, ox, oy, TILE, TILE, '#12301a');
      for (let i = 0; i < 3; i++) {
        const cx = Math.floor(r(i) * 16), cy = Math.floor(r(i + 6) * 16), rad = 4 + Math.floor(r(i + 12) * 3);
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
          const px = cx + x, py = cy + y;
          if (px < 0 || py < 0 || px > 15 || py > 15 || x * x + y * y > rad * rad) continue;
          const lit = x + y < -rad * .6 ? PAL.jungle[3] : x + y > rad * .7 ? PAL.jungle[2] : hash(tx * 16 + px, ty * 16 + py, 37) > .82 ? PAL.jungle[1] : PAL.jungle[0];
          rect(c, ox + px, oy + py, 1, 1, lit);
        }
      }
      if (r(34) > .88) { const x = ox + 2 + Math.floor(r(35) * 12), y = oy + 2 + Math.floor(r(36) * 12); rect(c, x, y, 2, 2, PAL.rootglass[2]); rect(c, x, y, 1, 1, PAL.rootglass[1]); }
      break;
    }
    case 'bark': {
      // Living wood seen from above: dark, deep-furrowed bark, a lichen spot now and then.
      rect(c, ox, oy, TILE, TILE, '#2e1e14');
      for (let i = 0; i < 5; i++) { const x = ox + Math.floor(r(i) * 15), y = oy + Math.floor(r(i + 5) * 10); rect(c, x, y, 1, 4 + Math.floor(r(i + 9) * 4), PAL.bark[2]); }
      if (r(17) > .7) rect(c, ox + Math.floor(r(18) * 13), oy + Math.floor(r(19) * 13), 3, 2, PAL.moss[2]);
      break;
    }
    case 'mire': {
      // The fen underfoot: dark peat, wet sheen, a puddle of black water, a reed sprig, now and then a gloomcap's spore.
      rect(c, ox, oy, TILE, TILE, PAL.mire[0]);
      for (let i = 0; i < 9; i++) rect(c, ox + Math.floor(r(i) * 15), oy + Math.floor(r(i + 20) * 15), 2, 1, pick(PAL.mire, r(i + 40)));
      if (r(61) > .7) { const x = ox + 1 + Math.floor(r(62) * 10), y = oy + 2 + Math.floor(r(63) * 11); rect(c, x, y, 4, 2, PAL.blackwater[1]); rect(c, x + 1, y, 2, 1, PAL.blackwater[3]); }
      if (r(64) > .78) { const x = ox + 2 + Math.floor(r(65) * 12), y = oy + 4 + Math.floor(r(66) * 9); rect(c, x, y, 1, 3, PAL.hangmoss[2]); rect(c, x + 1, y + 1, 1, 2, PAL.hangmoss[1]); }
      if (r(67) > .95) rect(c, ox + Math.floor(r(68) * 15), oy + Math.floor(r(69) * 15), 1, 1, PAL.ink[1]);
      break;
    }
    case 'boardwalk': {
      // Weathered fen planks: grey-brown boards, dark gaps, a nail, a creep of moss along a seam, a lantern's drip of wax.
      for (let i = 0; i < 4; i++) {
        rect(c, ox, oy + i * 4, TILE, 4, pick(PAL.boardwalk, r(i)));
        rect(c, ox, oy + i * 4, TILE, 1, PAL.boardwalk[3]);
        rect(c, ox, oy + i * 4 + 3, TILE, 1, '#3a2e26');
        rect(c, ox + Math.floor(r(i + 9) * 14), oy + i * 4 + 1, 1, 1, '#3a2e26');
        if (r(i + 20) > .8) rect(c, ox + Math.floor(r(i + 24) * 12), oy + i * 4 + 2, 3, 1, PAL.hangmoss[2]);
      }
      // A board end now and then (the planks are laid in runs, not one length).
      if (r(30) > .5) { const x = ox + 3 + Math.floor(r(31) * 10), y = oy + Math.floor(r(32) * 4) * 4; rect(c, x, y, 1, 3, '#3a2e26'); }
      break;
    }
    case 'wetstone': {
      // The drowned crypts' floor: old slabs slick with silt, a sheen of water in the joints, a pale snail-trail of salt.
      rect(c, ox, oy, TILE, TILE, '#2e3338');
      for (let q = 0; q < 4; q++) {
        const x = ox + (q % 2) * 8 + (ty % 2 && q < 2 ? 1 : 0), y = oy + Math.floor(q / 2) * 8;
        rect(c, x, y, 7, 7, pick(PAL.wetstone, r(q + 3)));
        rect(c, x, y, 7, 1, PAL.wetstone[3]); rect(c, x + 6, y + 1, 1, 6, PAL.wetstone[2]);
        if (r(q + 11) > .66) rect(c, x + 1 + Math.floor(r(q + 13) * 4), y + 3, 3, 1, PAL.blackwater[3]);
      }
      if (r(29) > .78) { const x = ox + 3 + Math.floor(r(30) * 8); rect(c, x, oy + 6, 5, 3, PAL.blackwater[1]); rect(c, x + 1, oy + 6, 2, 1, PAL.blackwater[3]); }
      if (r(31) > .9) rect(c, ox + Math.floor(r(32) * 12), oy + Math.floor(r(33) * 14), 3, 1, '#9aa0a4');
      break;
    }
    case 'blackwater': {
      // Still black water: a faint ripple drifting with the frame, a lily pad, a lantern's gold caught on the surface.
      rect(c, ox, oy, TILE, TILE, PAL.blackwater[0]);
      for (let i = 0; i < 3; i++) {
        const x = (Math.floor(r(i) * 16) + frame) % 13, y = Math.floor(r(i + 7) * 15);
        rect(c, ox + x, oy + y, 3, 1, PAL.blackwater[1]);
      }
      if (r(40) > .88) { const x = ox + 2 + Math.floor(r(41) * 10), y = oy + 3 + Math.floor(r(42) * 9); rect(c, x, y, 4, 3, '#3e5a3a'); rect(c, x + 1, y, 2, 1, '#557a4c'); rect(c, x + 2, y + 1, 1, 1, PAL.blackwater[0]); }
      else if (r(43) > .93) rect(c, ox + ((Math.floor(r(44) * 12) + frame) % 13), oy + Math.floor(r(45) * 14), 2, 1, PAL.lantern[2]);
      break;
    }
    case 'drownwall': {
      // A drowned crypt's wall seen from above: wet slate capstones, a pale crust of salt (its face is drawn by paintEdge).
      rect(c, ox, oy, TILE, TILE, '#1f252b');
      rect(c, ox, oy + 7, TILE, 1, '#171c21');
      for (let i = 0; i < 4; i++) rect(c, ox + Math.floor(r(i) * 14), oy + Math.floor(r(i + 5) * 14), 2, 1, i % 2 ? '#2a3238' : '#3a4248');
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
  if (kind === 'wall') {
    // An inside wall: where the floor lies south, its plaster face with a timber rail and a skirting board.
    if (side === 's') {
      rect(c, ox, oy + 3, TILE, 13, '#e8d5b0'); rect(c, ox, oy + 3, TILE, 1, '#f6e8c8'); rect(c, ox, oy + 8, TILE, 1, '#a06a3b');
      rect(c, ox, oy + 14, TILE, 2, '#6e4526');
      if (hash(tx, ty, 150) > .85) { rect(c, ox + 5, oy + 5, 6, 2, '#a06a3b'); rect(c, ox + 6, oy + 4, 4, 1, '#ffd27a'); }
    } else if (side === 'n') rect(c, ox, oy, TILE, 1, '#2a1a10');
    return;
  }
  if (kind === 'rock') {
    // A wall: where open floor lies south, the rock shows its lit front face (ember-veined now and then); a dark lip elsewhere.
    if (side === 's') {
      rect(c, ox, oy + 4, TILE, 12, PAL.basalt[1]); rect(c, ox, oy + 4, TILE, 2, PAL.basalt[3]); rect(c, ox, oy + 15, TILE, 1, PAL.basalt[0]);
      for (let i = 0; i < 3; i++) rect(c, ox + Math.floor(hash(tx, ty, i + 120) * 14), oy + 7 + Math.floor(hash(tx, ty, i + 130) * 6), 2, 1, PAL.basalt[2]);
      if (hash(tx, ty, 140) > .8) rect(c, ox + 3 + Math.floor(hash(tx, ty, 141) * 9), oy + 10, 3, 2, PAL.ember[1]);
    } else if (side === 'n') rect(c, ox, oy, TILE, 1, PAL.basalt[2]);
    else if (side === 'w') rect(c, ox, oy, 1, TILE, PAL.basalt[2]);
    else rect(c, ox + 15, oy, 1, TILE, PAL.basalt[2]);
    return;
  }
  if (kind === 'vinewall') {
    // A temple wall: where floor lies south, its carved face — courses of mossy stone, vines hanging, a rootglass glyph.
    if (side === 's') {
      rect(c, ox, oy + 3, TILE, 13, PAL.temple[1]); rect(c, ox, oy + 3, TILE, 2, PAL.temple[3]); rect(c, ox, oy + 15, TILE, 1, PAL.temple[2]);
      for (let y = 6; y < 15; y += 4) { rect(c, ox, oy + y, TILE, 1, PAL.temple[2]); rect(c, ox + ((y / 4 + tx) % 2 ? 4 : 11), oy + y - 3, 1, 3, PAL.temple[2]); }
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(hash(tx, ty, i + 160) * 15), len = 3 + Math.floor(hash(tx, ty, i + 170) * 9);
        rect(c, ox + x, oy + 3, 1, len, PAL.jungle[1]); rect(c, ox + x, oy + 3 + len, 1, 1, PAL.jungle[3]);
      }
      if (hash(tx, ty, 180) > .82) { rect(c, ox + 6, oy + 8, 4, 4, '#3a4a3c'); rect(c, ox + 7, oy + 9, 2, 2, PAL.rootglass[1]); }
    } else if (side === 'n') rect(c, ox, oy, TILE, 1, '#1c261c');
    else if (side === 'w') rect(c, ox, oy, 1, TILE, '#1c261c');
    else rect(c, ox + 15, oy, 1, TILE, '#1c261c');
    return;
  }
  if (kind === 'bark') {
    // The Bole's living wood: where floor lies south, its bark face — deep grain, moss at the foot.
    if (side === 's') {
      rect(c, ox, oy + 2, TILE, 14, PAL.bark[0]);
      for (let x = 0; x < TILE; x += 3) rect(c, ox + x + (ty % 2), oy + 2, 1, 14, hash(tx * 7 + x, ty, 190) > .5 ? PAL.bark[2] : PAL.bark[3]);
      rect(c, ox, oy + 2, TILE, 1, PAL.bark[3]); rect(c, ox, oy + 14, TILE, 2, PAL.moss[1]); rect(c, ox + 3, oy + 13, 5, 1, PAL.moss[3]);
    } else rect(c, ox + (side === 'e' ? 15 : 0), oy, side === 'n' ? TILE : 1, side === 'n' ? 1 : TILE, '#2e1e14');
    return;
  }
  if (kind === 'canopy') {
    // The leaves' edge over a walkway: a fringe of lit leaves, a shadow under them.
    if (side === 's') { rect(c, ox, oy + 12, TILE, 4, '#1a3e1e'); for (let x = 0; x < TILE; x += 4) rect(c, ox + x, oy + 10 + Math.floor(hash(tx * 5 + x, ty, 200) * 3), 4, 3, PAL.jungle[1]); }
    else if (side === 'n') for (let x = 0; x < TILE; x += 4) rect(c, ox + x, oy, 3, 1 + Math.floor(hash(tx * 3 + x, ty, 201) * 2), PAL.jungle[3]);
    else rect(c, ox + (side === 'e' ? 14 : 0), oy, 2, TILE, PAL.jungle[0]);
    return;
  }
  if (kind === 'plank' && neighbour === 'canopy') {
    // A walkway's edge over the leaves: a rope rail on short posts.
    const h = side === 'n' || side === 's';
    for (let i = 0; i < TILE; i++) {
      const at = side === 'n' ? [i, 1] : side === 's' ? [i, 14] : side === 'w' ? [1, i] : [14, i];
      rect(c, ox + at[0], oy + at[1], 1, 1, i % 8 === 2 ? PAL.wood[2] : '#c9a46a');
      if (i % 8 === 2) rect(c, ox + at[0] - (h ? 0 : 1), oy + at[1] - (h ? 1 : 0), h ? 1 : 3, h ? 3 : 1, PAL.wood[2]);
    }
    rect(c, ox + (side === 'e' ? 15 : 0), oy + (side === 's' ? 15 : 0), h ? TILE : 1, h ? 1 : TILE, '#2a1a10');
    return;
  }
  if (kind === 'drownwall') {
    // A drowned crypt's wall: where floor lies south, its face — wet courses of slate, a tide-line of green slime,
    // pale salt where it dried, water running down it, and now and then an ink-violet ward cut into the stone.
    if (side === 's') {
      rect(c, ox, oy + 3, TILE, 13, PAL.wetstone[1]); rect(c, ox, oy + 3, TILE, 2, PAL.wetstone[3]);
      for (let y = 7; y < 15; y += 4) { rect(c, ox, oy + y, TILE, 1, PAL.wetstone[2]); rect(c, ox + ((y / 4 + tx) % 2 ? 3 : 10), oy + y - 3, 1, 3, PAL.wetstone[2]); }
      rect(c, ox, oy + 12, TILE, 2, '#3e5a42'); rect(c, ox, oy + 14, TILE, 2, '#2a3a2e');
      for (let i = 0; i < 2; i++) { const x = Math.floor(hash(tx, ty, i + 210) * 15), len = 3 + Math.floor(hash(tx, ty, i + 215) * 7); rect(c, ox + x, oy + 5, 1, len, PAL.blackwater[3]); }
      if (hash(tx, ty, 220) > .6) rect(c, ox + Math.floor(hash(tx, ty, 221) * 12), oy + 5, 3, 1, '#c9cdc8');
      if (hash(tx, ty, 222) > .84) { rect(c, ox + 6, oy + 6, 4, 5, '#2a2f3a'); rect(c, ox + 7, oy + 7, 2, 1, PAL.ink[1]); rect(c, ox + 7, oy + 9, 2, 1, PAL.ink[1]); rect(c, ox + 7, oy + 8, 1, 1, PAL.ink[0]); }
    } else if (side === 'n') rect(c, ox, oy, TILE, 1, '#0e1216');
    else if (side === 'w') rect(c, ox, oy, 1, TILE, '#0e1216');
    else rect(c, ox + 15, oy, 1, TILE, '#0e1216');
    return;
  }
  if (kind === 'blackwater') {
    // The fen's edge: under a boardwalk its stilts going down into the black, their reflections; under the bank a
    // muddy lip and a shadow.
    if (side === 'n' && (neighbour === 'plank' || neighbour === 'boardwalk')) {
      rect(c, ox, oy, TILE, 3, '#07090c');
      for (let x = 2 + (tx % 2) * 4; x < TILE; x += 8) { rect(c, ox + x, oy, 2, 6, PAL.wood[2]); rect(c, ox + x, oy, 1, 6, PAL.wood[0]); rect(c, ox + x, oy + 7, 2, 1, PAL.blackwater[3]); rect(c, ox + x, oy + 9, 1, 1, PAL.blackwater[3]); }
      return;
    }
    if (neighbour === 'blackwater' || SOLID_GROUND.has(neighbour)) return;
    const lip = neighbour === 'plank' || neighbour === 'boardwalk' ? '#3a2e26' : PAL.mire[3], shade = '#06080b';
    if (side === 'n') { rect(c, ox, oy, TILE, 2, lip); rect(c, ox, oy + 2, TILE, 2, shade); }
    if (side === 's') rect(c, ox, oy + 15, TILE, 1, lip);
    if (side === 'w') { rect(c, ox, oy, 1, TILE, lip); rect(c, ox + 1, oy, 1, TILE, shade); }
    if (side === 'e') { rect(c, ox + 15, oy, 1, TILE, lip); rect(c, ox + 14, oy, 1, TILE, shade); }
    return;
  }
  if ((kind === 'plank' || kind === 'boardwalk') && neighbour === 'blackwater') {
    // A boardwalk over the fen: its edge beam, dark where it overhangs the water.
    if (side === 's') { rect(c, ox, oy + 13, TILE, 2, kind === 'boardwalk' ? PAL.boardwalk[2] : PAL.wood[0]); rect(c, ox, oy + 15, TILE, 1, '#1a120c'); }
    else rect(c, ox + (side === 'e' ? 15 : 0), oy, side === 'n' ? TILE : 1, side === 'n' ? 1 : TILE, '#2a1a10');
    return;
  }
  if (SOLID_GROUND.has(neighbour)) return;
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
  if (kind === 'grass' || kind === 'flowers' || kind === 'moss') {
    // Grass tufts spill over the edge into paths: drawn on the path tile instead (below).
    return;
  }
  if (neighbour === 'grass' || neighbour === 'flowers' || neighbour === 'moss') {
    for (let i = 0; i < 16; i += 2) {
      const len = 1 + Math.floor(hash(tx * 31 + i, ty, side.charCodeAt(0)) * 3);
      const col = (neighbour === 'moss' ? PAL.moss : PAL.grass)[(i >> 1) % 3];
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
  /** A soft shadow cast on the ground (drawn in the ground pass, under everything standing): its image and offset from the anchor. */
  shadow?: { img: HTMLCanvasElement; x: number; y: number };
  /** A floor decal (a ritual circle, a stain, a cobweb): painted in the ground pass with the shadows, under everything standing. */
  floor?: { img: HTMLCanvasElement; x: number; y: number };
}

const cache = new Map<string, Sprite>();
function cached(key: string, make: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) { s = make(); if (GROWN.has(key.replace(/[-:].*$/, '')) && !NOT_GROWN.some(n => key.startsWith(n))) s = grownSprite(s); cache.set(key, s); }
  return s;
}

/**
 * The props that stand beside a Keeper (the art style upgrade, 2026-10-26: figures are painted 1.5× finer, keeper-paint
 * FIGURE_K): a barrel, a lamp, a bench, a sign, a station's anvil or hearth, a grave, a bush… are grown by the same 1.5
 * so they keep their size beside him, then lit round (the volume pass) and given a soft shadow on the ground. Their
 * blocked tiles are unchanged. Buildings, walls, gates, stairs, ships and trees keep their own footprint (not here).
 */
const GROWN: ReadonlySet<string> = new Set(['lamp', 'bench', 'barrel', 'crate', 'cart', 'hearth', 'signpost', 'forge', 'waystone', 'ore', 'beacon',
  'boulder', 'bush', 'torch', 'bones', 'chest', 'stump', 'stone', 'anvil', 'grave', 'root', 'pillar',
  'fern', 'lantern', 'reeds', 'gloomcap', 'great', 'fountain']);
/** Buildings that share a grown prop's first word. */
const NOT_GROWN = ['lantern-tower', 'forge-gate'];
const PROP_K = 1.5;
function grownSprite(sp: Sprite): Sprite {
  const up = (src: HTMLCanvasElement) => {
    const out = cv(Math.round(src.width * PROP_K), Math.round(src.height * PROP_K)), g = out.getContext('2d')!;
    g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, out.width, out.height);
    return volumize(out, { depth: 4, light: .24, shade: .3 });
  };
  const k = (v: number) => Math.round(v * PROP_K);
  const img = up(sp.img), sw = Math.max(8, Math.round(img.width * .78));
  return {
    img, ax: k(sp.ax), ay: k(sp.ay),
    ...(sp.roof ? { roof: { img: up(sp.roof.img), x: k(sp.roof.x), y: k(sp.roof.y) } } : {}),
    ...(sp.lights ? { lights: sp.lights.map(l => ({ ...l, x: k(l.x), y: k(l.y) })) } : {}),
    ...(sp.smoke ? { smoke: sp.smoke.map(m => ({ x: k(m.x), y: k(m.y) })) } : {}),
    shadow: sp.shadow ? { img: up(sp.shadow.img), x: k(sp.shadow.x), y: k(sp.shadow.y) } : { img: shadowSprite(sw, Math.max(4, Math.round(sw * .32))), x: -Math.round(sw / 2) + 1, y: -Math.round(sw * .2) },
  };
}

export type RoofStyle = 'red' | 'slate' | 'thatch' | 'leaf' | 'gloam';
export type WallStyle = 'timber' | 'stone' | 'basalt';

const roofRamp = (s: RoofStyle) => (s === 'red' ? PAL.roofRed : s === 'slate' ? PAL.roofSlate : s === 'leaf' ? PAL.roofLeaf : s === 'gloam' ? PAL.roofGloam : PAL.roofThatch);

/**
 * A house, `w` tiles wide and `d` tiles deep: front wall with a door and
 * windows (lit at night by the light pass), a gabled roof seen from above in
 * 3/4, a chimney. The roof is its own layer so it can fade.
 */
export function house(w: number, d: number, roof: RoofStyle, wall: WallStyle, chimney = true, seed = 0): Sprite {
  return cached(`house:${w}:${d}:${roof}:${wall}:${chimney}:${seed}`, () => {
    // The art style upgrade: the front wall stands as tall as a fine-grid Keeper and a head more (40 px, was 22), its
    // door a head over him; timber, plaster, stone and basalt courses shaded from the upper left; windows framed, lit.
    const W = w * TILE, wallH = 40, roofH = d * TILE + 6, H = roofH + wallH;
    const body = cv(W, H);
    const c = body.getContext('2d')!;
    const wy = roofH;
    if (wall === 'timber') {
      // Plaster with a little grain, a timber frame: posts, a mid rail, braces, a sill beam.
      for (let y = 0; y < wallH; y++) for (let x = 0; x < W; x++) rect(c, x, wy + y, 1, 1, hash(x, y, seed + 21) > .9 ? PAL.plaster[1] : hash(x, y, seed + 22) > .96 ? PAL.plaster[2] : PAL.plaster[0]);
      for (let x = 0; x < W; x += 16) { rect(c, x, wy, 3, wallH, PAL.wood[2]); rect(c, x, wy, 1, wallH, PAL.wood[1]); }
      rect(c, 0, wy, W, 3, PAL.wood[2]); rect(c, 0, wy, W, 1, PAL.wood[1]);
      rect(c, 0, wy + 19, W, 2, PAL.wood[2]); rect(c, 0, wy + 19, W, 1, PAL.wood[1]);
      for (let x = 3; x + 13 < W; x += 32) for (let yy = 0; yy < 15; yy++) { rect(c, x + Math.round(yy * .85), wy + 21 + yy, 3, 1, PAL.wood[2]); rect(c, x + Math.round(yy * .85), wy + 21 + yy, 1, 1, PAL.wood[1]); }
      rect(c, 0, wy + wallH - 4, W, 4, PAL.wood[2]); rect(c, 0, wy + wallH - 4, W, 1, PAL.wood[1]);
    } else {
      const ramp = wall === 'stone' ? PAL.stone : PAL.basalt;
      rect(c, 0, wy, W, wallH, ramp[2]);
      for (let y = 0; y < wallH; y += 5) for (let x = (y / 5) % 2 ? -4 : 0; x < W; x += 9) {
        rect(c, x, wy + y, 8, 4, pick(ramp, hash(x, y, seed)));
        rect(c, x, wy + y, 8, 1, ramp[3]); rect(c, x + 7, wy + y, 1, 4, ramp[2]);
        if (hash(x, y, seed + 5) > .85) rect(c, x + 2, wy + y + 2, 2, 1, ramp[2]);
      }
      rect(c, 0, wy + wallH - 3, W, 3, ramp[2]);
    }
    // Door, centred: planks in a dark frame, iron straps, a ring, a stone step, a lit lintel.
    const dw = 14, dh = 31, dx = Math.floor(W / 2) - dw / 2, dyy = wy + wallH - dh - 2;
    rect(c, dx - 2, dyy - 2, dw + 4, dh + 2, PAL.wood[2]); rect(c, dx - 2, dyy - 2, dw + 4, 1, PAL.wood[3]);
    for (let i = 0; i < dw; i += 3) { rect(c, dx + i, dyy, 3, dh, i % 6 ? PAL.wood[0] : PAL.wood[1]); rect(c, dx + i, dyy, 1, dh, PAL.wood[3]); }
    rect(c, dx, dyy + 6, dw, 2, '#4a4450'); rect(c, dx, dyy + dh - 9, dw, 2, '#4a4450'); rect(c, dx, dyy + 6, dw, 1, '#7a7484');
    rect(c, dx + dw - 4, dyy + 15, 2, 3, '#e6c35a'); rect(c, dx + dw - 4, dyy + 15, 1, 1, '#fff0a8');
    rect(c, dx - 3, wy + wallH - 2, dw + 6, 2, PAL.stone[1]); rect(c, dx - 3, wy + wallH - 2, dw + 6, 1, PAL.stone[3]);
    // Windows (warm light comes from the night pass via `lights`): a frame, four panes, a sill, shutters, a flower box.
    const wins: { x: number; y: number; r: number; warm?: boolean }[] = [];
    for (let x = 6; x + 12 < W; x += 24) {
      if (Math.abs(x + 6 - (dx + dw / 2)) < 16) continue;
      const y0 = wy + 7;
      rect(c, x - 3, y0 - 1, 3, 15, PAL.awning[(seed + x) % PAL.awning.length][0]); rect(c, x + 12, y0 - 1, 3, 15, PAL.awning[(seed + x) % PAL.awning.length][0]);
      rect(c, x - 1, y0 - 1, 14, 15, PAL.wood[2]);
      rect(c, x, y0, 12, 13, PAL.windowDark);
      rect(c, x + 1, y0 + 1, 3, 3, '#6f6aa0'); rect(c, x + 7, y0 + 1, 2, 2, '#6f6aa0');
      rect(c, x + 5, y0, 2, 13, PAL.wood[2]); rect(c, x, y0 + 6, 12, 1, PAL.wood[2]);
      rect(c, x - 2, y0 + 13, 16, 2, PAL.wood[1]); rect(c, x - 2, y0 + 13, 16, 1, PAL.wood[3]);
      if (hash(x, seed, 9) > .4) for (let i = 0; i < 6; i++) { rect(c, x + i * 2, y0 + 11, 2, 2, pick(PAL.flower, hash(x + i, seed, 11))); rect(c, x + i * 2, y0 + 12, 1, 1, PAL.leaf[1]); }
      wins.push({ x: x + 6 - W / 2, y: y0 + 6 - H, r: 16, warm: true });
    }
    // Roof (separate layer): a 3/4 gable, shingles shaded per course and slope (td-build paintRoof); a stone chimney.
    const roofImg = cv(W + 4, roofH + 4);
    const rc = roofImg.getContext('2d')!;
    paintRoof(rc, 2, 2, W, roofH, roof, roofRamp(roof), seed + w * 7 + d);
    const smoke: { x: number; y: number }[] = [];
    if (chimney) {
      const cx = Math.floor(W * (hash(w, d, seed) > .5 ? .72 : .26));
      paintChimney(rc, cx, 0);
      smoke.push({ x: cx + 4 - W / 2 - 2, y: -H });
    }
    // The eave's shadow on the wall top: two steps.
    rect(c, 0, wy, W, 4, 'rgba(0,0,0,.24)'); rect(c, 0, wy + 4, W, 2, 'rgba(0,0,0,.1)');
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
    // Taller than it was (the art style upgrade): the counter stands at a fine-grid Keeper's waist, the awning over his head.
    const G = 20, W = widthTiles * TILE, H = 34 + G;
    const img = cv(W, H);
    const c = img.getContext('2d')!;
    const [a, b] = PAL.awning[palette % PAL.awning.length];
    // Posts, lit on their left.
    rect(c, 1, 10, 3, 24 + G, PAL.wood[2]); rect(c, 1, 10, 1, 24 + G, PAL.wood[3]); rect(c, W - 4, 10, 3, 24 + G, PAL.wood[2]); rect(c, W - 4, 10, 1, 24 + G, PAL.wood[1]);
    // Counter: planks with grain, a lit top board, a dark kick board.
    rect(c, 0, 22 + G, W, 12, PAL.wood[1]); rect(c, 0, 22 + G, W, 2, PAL.wood[3]); rect(c, 0, 24 + G, W, 1, PAL.plank[2]); rect(c, 0, 31 + G, W, 3, PAL.wood[2]);
    for (let x = 4; x < W - 4; x += 8) { rect(c, x, 25 + G, 1, 6, PAL.wood[2]); rect(c, x + 3, 27 + G, 2, 1, PAL.wood[0]); }
    // Goods on the counter.
    const lights: { x: number; y: number; r: number; warm?: boolean }[] = [];
    for (let x = 4; x < W - 5; x += 5) {
      const r = hash(x, seed, 3);
      if (goods === 'pots') { const col = pick(['#8a4fb0', '#e8506a', '#4b90d6', '#5a9a49', '#f2c94c'], r); rect(c, x, 17 + G, 4, 5, col); rect(c, x + 1, 15 + G, 2, 2, col); rect(c, x + 1, 17 + G, 1, 2, '#ffffff99'); }
      if (goods === 'bread') { rect(c, x, 18 + G, 5, 4, pick(['#c98a45', '#d9a35c', '#b0763a'], r)); rect(c, x + 1, 18 + G, 3, 1, '#e8c07a'); }
      if (goods === 'gems') { rect(c, x + 1, 17 + G, 3, 4, pick(['#7fd5ff', '#ff6dd7', '#a48bff', '#4dffe0'], r)); rect(c, x + 1, 17 + G, 1, 1, '#ffffff'); }
      if (goods === 'tools') { rect(c, x + 2, 13 + G, 1, 9, PAL.wood[2]); rect(c, x, 13 + G, 5, 2, '#9aa2ad'); }
      if (goods === 'books') { rect(c, x, 17 + G, 4, 5, pick(['#8f3524', '#3f78b5', '#5a9a49', '#8a4fb0'], r)); rect(c, x, 17 + G, 4, 1, '#f3e7cf'); }
      if (goods === 'fish') { rect(c, x, 19 + G, 5, 2, pick(['#9fb7c9', '#c9a26f', '#7fa3c2'], r)); rect(c, x + 4, 18 + G, 1, 4, '#9fb7c9'); }
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
  // The art style upgrade (td-flora.ts): volumetric clumped crowns and a cast shadow; six variants a kind.
  const v = ((seed % 6) + 6) % 6;
  // Environment detail Low (td-detail.ts): the old clean tree with just a soft shadow.
  if (envDetail() === 'low') return cached(`low-tree:${kind}:${v}`, () => ({ ...flatTree(kind, v), shadow: { img: shadowSprite(kind === 'pine' ? 26 : 34, 11), x: kind === 'pine' ? -10 : -14, y: -7 } }));
  return cached(`tree:${kind}:${v}`, () => kind === 'pine' ? pineTree(v) : broadleafTree(kind, v));
}
/** The flat crowns the world grew before the art style upgrade (kept for comparison galleries). */
export function flatTree(kind: 'oak' | 'pine' | 'fruit', seed = 0): Sprite {
  return cached(`flat-tree:${kind}:${seed}`, () => {
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
    // Hip-high to a fine-grid Keeper (the art style upgrade): two lit rails, posts with a pointed lit cap and a dark foot.
    const W = tiles * TILE, img = cv(W, 18);
    const c = img.getContext('2d')!;
    for (const y of [5, 11]) { rect(c, 0, y, W, 3, PAL.wood[1]); rect(c, 0, y, W, 1, PAL.wood[3]); rect(c, 0, y + 2, W, 1, PAL.wood[2]); }
    for (let x = 0; x < W; x += 8) { rect(c, x, 1, 3, 17, PAL.wood[0]); rect(c, x + 1, 0, 1, 1, PAL.wood[3]); rect(c, x, 1, 1, 16, PAL.wood[3]); rect(c, x + 2, 2, 1, 15, PAL.wood[2]); rect(c, x, 16, 3, 2, PAL.wood[2]); }
    return { img: outline(img), ax: W / 2 + 1, ay: 19 };
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

/** Kael's open forge on the square: a stone hearth with a bellows, an anvil, a glow. */
export function forgeHearth(): Sprite {
  return cached('forge', () => {
    const W = 40, H = 34, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 2, 8, 22, 24, PAL.stone[2]); rect(c, 2, 8, 22, 3, PAL.stone[3]);
    for (let y = 11; y < 30; y += 4) for (let x = (y % 8) ? 2 : 6; x < 22; x += 8) rect(c, x, y, 7, 3, PAL.stone[0]);
    rect(c, 7, 16, 12, 9, '#2a1a1c'); rect(c, 8, 19, 10, 6, PAL.ember[1]); rect(c, 10, 21, 6, 3, PAL.ember[2]);
    rect(c, 9, 0, 8, 9, PAL.stone[2]); rect(c, 9, 0, 8, 2, PAL.stone[3]);
    // Anvil.
    rect(c, 26, 20, 12, 4, '#4a4552'); rect(c, 24, 19, 6, 2, '#4a4552'); rect(c, 30, 24, 4, 6, '#3a3642'); rect(c, 27, 30, 10, 3, '#3a3642');
    rect(c, 26, 20, 12, 1, '#7a7584');
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: -8, y: -12, r: 34, warm: true }], smoke: [{ x: -7, y: -35 }] };
  });
}

/** A Waystone: a standing stone with a glowing rune band. */
export function waystone(): Sprite {
  return cached('waystone', () => {
    const W = 18, H = 36, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 1, 30, 16, 6, PAL.stone[2]); rect(c, 1, 30, 16, 1, PAL.stone[3]);
    rect(c, 4, 4, 10, 27, '#5b5770'); rect(c, 5, 2, 8, 3, '#6f6a84'); rect(c, 4, 4, 2, 27, '#6f6a84');
    for (let y = 9; y < 26; y += 4) rect(c, 7, y, 4, 2, '#8fe8ff');
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: 0, y: -18, r: 28 }] };
  });
}

/** The Cinder Ore seam on the square's west lane: a dark outcrop veined with ember. */
export function oreSeam(): Sprite {
  return cached('ore-seam', () => {
    const W = 30, H = 22, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 3, 8, 24, 13, PAL.basalt[0]); rect(c, 6, 4, 16, 6, PAL.basalt[1]); rect(c, 10, 1, 8, 4, PAL.basalt[3]);
    rect(c, 3, 8, 24, 2, PAL.basalt[3]); rect(c, 3, 19, 24, 2, PAL.basalt[2]);
    for (const [x, y, w] of [[7, 11, 4], [15, 7, 3], [19, 13, 5], [11, 16, 3], [22, 9, 2]] as const) { rect(c, x, y, w, 2, PAL.ember[1]); rect(c, x + 1, y, 1, 1, PAL.ember[2]); }
    return { img: outline(img), ax: 15, ay: 22 };
  });
}

/** The mine head into the Ember Delve: a timber frame over a dark shaft, a lantern on the post. */
export function mineShaft(): Sprite {
  return cached('mine-shaft', paintMineShaft);
}

/** The Eclipse Beacon at the north road's end: a stone pillar crowned with a cold brazier. */
export function beaconPillar(): Sprite {
  return cached('beacon', () => {
    const W = 20, H = 40, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 5, 12, 10, 26, PAL.stone[2]); rect(c, 5, 12, 3, 26, PAL.stone[3]);
    for (let y = 16; y < 36; y += 5) rect(c, 5, y, 10, 1, PAL.stone[0]);
    rect(c, 2, 36, 16, 4, PAL.stone[0]);
    rect(c, 2, 6, 16, 6, PAL.wood[2]); rect(c, 4, 4, 12, 3, PAL.basalt[1]); rect(c, 7, 2, 6, 2, PAL.ember[3]);
    return { img: outline(img), ax: 10, ay: 40 };
  });
}

/** A mossy boulder in the wilds (three seeds of shape). */
export function boulder(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`boulder-${v}`, () => {
    const W = 20, H = 15, img = cv(W, H);
    const c = img.getContext('2d')!;
    const w = 14 + v * 2, x0 = Math.floor((W - w) / 2);
    rect(c, x0, 5, w, 9, PAL.stone[2]); rect(c, x0 + 2, 2, w - 4, 4, PAL.stone[1]); rect(c, x0 + 3, 2, w - 8, 2, PAL.stone[3]);
    rect(c, x0, 12, w, 2, PAL.stone[0]);
    rect(c, x0 + 1, 5, 4, 2, PAL.leaf[1]); rect(c, x0 + w - 6, 3, 3, 1, PAL.leaf[3]);
    return { img: outline(volumize(img, { depth: 3 })), ax: 10, ay: 15, shadow: { img: shadowSprite(20, 7), x: -9, y: -4 } };
  });
}

/** A round bush, sometimes in berry (three seeds). */
export function bush(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`bush-${v}`, () => {
    const W = 18, H = 14, img = cv(W, H);
    const c = img.getContext('2d')!;
    paintClumps(c, [{ x: 6, y: 8, r: 4.5, tone: 0 }, { x: 12, y: 8, r: 4.5, tone: 0 }, { x: 9, y: 5, r: 4.5, tone: 1 }, { x: 9, y: 10, r: 3.5, tone: -1 }], clumpRamp(PAL.leaf), v + 3);
    if (v === 1) for (const [x, y] of [[5, 6], [10, 4], [12, 8], [7, 9]] as const) rect(c, x, y, 2, 2, PAL.flower[0]);
    if (v === 2) for (const [x, y] of [[6, 5], [11, 7]] as const) rect(c, x, y, 2, 2, PAL.flower[1]);
    return { img: outline(img), ax: 9, ay: 14, shadow: { img: shadowSprite(18, 6), x: -8, y: -4 } };
  });
}

/** A ladder up out of a dungeon floor: rails and rungs against a pale shaft of daylight. */
export function ladderUp(): Sprite {
  return cached('ladder-up', paintLadderUp);
}

/** A torch on a post, lighting the dark of a dungeon floor. */
export function torchPost(): Sprite {
  return cached('torch-post', () => {
    const W = 10, H = 24, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 4, 8, 2, 16, PAL.wood[0]); rect(c, 2, 6, 6, 3, PAL.wood[2]);
    rect(c, 3, 1, 4, 5, PAL.ember[1]); rect(c, 4, 0, 2, 3, PAL.ember[2]);
    return { img: outline(img), ax: 5, ay: 24, lights: [{ x: 0, y: -21, r: 30, warm: true }] };
  });
}

/** Old bones on a dungeon floor (a warning, a story). */
export function bones(): Sprite {
  return cached('bones', () => {
    const W = 16, H = 8, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 1, 3, 9, 2, '#e8e1cf'); rect(c, 0, 2, 2, 4, '#e8e1cf'); rect(c, 9, 2, 2, 4, '#e8e1cf');
    rect(c, 11, 2, 4, 4, '#f2ecdc'); rect(c, 12, 3, 1, 1, '#3a2a2a'); rect(c, 14, 3, 1, 1, '#3a2a2a');
    return { img: outline(img), ax: 8, ay: 8 };
  });
}

/** A banded chest, shut (what is in it is the play view's business). */
export function chest(): Sprite {
  return cached('chest', () => {
    const W = 16, H = 13, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 1, 3, 14, 10, PAL.wood[1]); rect(c, 1, 1, 14, 4, PAL.wood[3]); rect(c, 1, 5, 14, 1, PAL.wood[0]);
    rect(c, 3, 1, 2, 12, '#7a6a5a'); rect(c, 11, 1, 2, 12, '#7a6a5a'); rect(c, 7, 5, 2, 3, PAL.glow);
    return { img: outline(img), ax: 8, ay: 13 };
  });
}

/** What a felled tree leaves for a while: a stump with its rings. */
export function stump(): Sprite {
  return cached('stump', () => {
    const W = 16, H = 10, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 3, 3, 10, 6, PAL.trunk[0]); rect(c, 3, 1, 10, 4, PAL.plank[2]); rect(c, 5, 2, 6, 2, PAL.plank[0]); rect(c, 7, 2, 2, 1, PAL.wood[2]);
    rect(c, 1, 8, 4, 2, PAL.trunk[2]); rect(c, 11, 8, 4, 2, PAL.trunk[2]);
    return { img: outline(img), ax: 8, ay: 10 };
  });
}

/** A broken wall of an old building, moss in its cracks (three shapes). */
export function ruinWall(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`ruin-${v}`, () => paintRuinWall(v));
}

/** A tall standing stone, runes cut in it faintly glowing. */
export function standingStone(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`stone-${v}`, () => {
    const W = 12, H = 30 + v * 3, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 2, 2, 8, H - 2, PAL.stone[1]); rect(c, 3, 0, 6, 3, PAL.stone[3]); rect(c, 2, 2, 2, H - 2, PAL.stone[3]); rect(c, 8, 4, 2, H - 4, PAL.stone[2]);
    rect(c, 5, 8, 2, 2, PAL.glow); rect(c, 5, 14, 2, 1, PAL.glow); rect(c, 4, 19, 1, 2, PAL.glow);
    return { img: outline(img), ax: 6, ay: H, lights: [{ x: 0, y: -14, r: 16, warm: true }] };
  });
}

/** A cave mouth in a rock face: a dark arch, timber props, a lantern. */
export function caveMouth(): Sprite {
  return cached('cave-mouth', paintCaveMouth);
}

/** The Ashen Crypt's door: a basalt mausoleum front, steps going down into the dark, two violet grave-lights. */
export function cryptDoor(): Sprite {
  return cached('crypt-door', paintCryptDoor);
}
/**
 * The Forge of the Four's gate, at the foot of the Pyre Peaks: a basalt smithy front gone to ruin, four cold anvil
 * sigils over a doorway of steps going down, a brazier either side that still burns.
 */
export function forgeGate(): Sprite {
  return cached('forge-gate', paintForgeGate);
}
/** A smith's anvil on its block, a hammer left across it. */
export function anvil(): Sprite {
  return cached('anvil', () => {
    const W = 18, H = 14, img = cv(W, H);
    const c = img.getContext('2d')!;
    rect(c, 3, 9, 12, 5, PAL.wood[0]); rect(c, 3, 9, 12, 1, PAL.wood[2]);
    rect(c, 2, 2, 13, 4, '#4a4552'); rect(c, 0, 3, 4, 2, '#4a4552'); rect(c, 6, 6, 6, 3, '#3a3642'); rect(c, 2, 2, 13, 1, '#7a7584');
    rect(c, 8, 0, 8, 2, PAL.trunk[2]); rect(c, 14, 0, 3, 3, '#3a3642');
    return { img: outline(img), ax: 9, ay: H };
  });
}
/** A worn gravestone, a little askew. */
/**
 * Barrow Door 1 (the Hushed Barrow's vault; shared/sexton): one tile of an old iron-banded door in the rock, a keyhole
 * stamped with its number. Open, the doorway is dark and the door stands back against the jamb.
 */
export function barrowDoor(open: boolean): Sprite {
  return cached(`barrow-door-${open ? 1 : 0}`, () => paintBarrowDoor(open));
}

export function gravestone(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`grave-${v}`, () => {
    const W = 12, H = 15, img = cv(W, H);
    const c = img.getContext('2d')!;
    if (v === 2) { rect(c, 5, 0, 2, 13, PAL.stone[2]); rect(c, 2, 3, 8, 2, PAL.stone[2]); rect(c, 5, 0, 1, 13, PAL.stone[3]); }
    else { rect(c, 2, 2 + v, 8, 11 - v, PAL.stone[1]); rect(c, 3, 1 + v, 6, 1, PAL.stone[1]); rect(c, 2, 2 + v, 2, 11 - v, PAL.stone[3]); rect(c, 4, 5 + v, 4, 1, PAL.stone[2]); rect(c, 4, 7 + v, 4, 1, PAL.stone[2]); }
    rect(c, 0, 13, 12, 2, PAL.dirt[2]); rect(c, 1, 13, 2, 1, PAL.leaf[2]);
    return { img: outline(img), ax: 6, ay: H };
  });
}

/** Stairs cut down into the rock (to the floor below). */
export function stairsDown(): Sprite {
  return cached('stairs-down', paintStairsDown);
}
/** Stairs going up out of a floor, lit from above. */
export function stairsUp(): Sprite {
  return cached('stairs-up', paintStairsUp);
}

/** A sailing ship at the pier: a timber hull, a mast and a cream sail with the realm's ember stripe. */
export function ship(): Sprite {
  return cached('ship', () => paintShip({ hull: RAMP.wood, sail: RAMP.cream, stripe: RAMP.ember, flag: PAL.ember[1] }));
}

/** A round tavern table with two stools and a candle. */
export function table(): Sprite {
  return cached('table', paintTable);
}
/** A bed with a quilt. */
export function bed(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`bed-${v}`, () => paintBed(v));
}
/** A bookshelf against the wall. */
export function shelf(): Sprite {
  return cached('shelf', paintShelf);
}
/** The inn's bar: a long counter with mugs and a keg. */
export function counter(): Sprite {
  return cached('counter', paintCounter);
}

/** A round basalt tower of three floors: arched windows lit on each, a door at its foot, a slate cone and an ember finial. */
export function tower(): Sprite {
  return cached('tower', paintTower);
}

// ── The Verdant Wilds (maps/verdant-wilds.ts): jungle trees, the giant trees, the Rootglass Bole, rootglass lamps, the
// Overgrown Temple's gate and its broken pillars. Same kit as the rest: painted once, outlined, light from the top-left.

/** A leaf blob: a round mass of `ramp` leaves, lit up-left, shadowed down-right. */
function leafBlob(c: Ctx, x: number, y: number, r: number, ramp: readonly string[], seed: number): void {
  // The art style upgrade: a lit leaf clump (td-flora.ts), toned by where it sits in the crown.
  paintClump(c, { x, y, r, tone: y < r * 1.2 ? 1 : 0 }, clumpRamp(ramp), seed + 7);
}
/** Hanging vines from a crown's underside, a leaf every few pixels. */
function vines(c: Ctx, x0: number, x1: number, y: number, seed: number): void {
  for (let x = x0; x < x1; x += 3) {
    if (hash(x, seed, 21) < .45) continue;
    const len = 3 + Math.floor(hash(x, seed, 22) * 9);
    rect(c, x, y, 1, len, PAL.jungle[2]);
    for (let k = 2; k < len; k += 3) rect(c, x + (k % 2 ? 1 : -1), y + k, 1, 1, PAL.jungle[1]);
  }
}
/** A trunk with buttress roots flaring at its foot. */
function buttressTrunk(c: Ctx, cx: number, top: number, foot: number, w: number, flare: number): void {
  rect(c, cx - w / 2, top, w, foot - top, PAL.bark[0]);
  rect(c, cx - w / 2, top, Math.max(2, w / 4), foot - top, PAL.bark[1]);
  rect(c, cx + w / 2 - Math.max(2, w / 4), top, Math.max(2, w / 4), foot - top, PAL.bark[2]);
  for (let y = top + 3; y < foot - 2; y += 5) rect(c, cx - w / 2 + 2 + (y % 3), y, 1, 3, PAL.bark[3]);
  // The roots: wedges to either side, a darker underside.
  for (const s of [-1, 1]) for (let i = 0; i < flare; i++) {
    const h = Math.round((flare - i) * (foot - top) * .32 / flare) + 1, x = s < 0 ? cx - w / 2 - 1 - i : cx + w / 2 + i;
    rect(c, x, foot - h, 1, h, s < 0 ? PAL.bark[1] : PAL.bark[2]);
  }
  rect(c, cx - w / 2 - flare, foot - 1, w + flare * 2, 1, PAL.bark[3]);
  rect(c, cx - w / 2 - 2, foot - 2, 4, 1, PAL.moss[3]); rect(c, cx + 2, foot - 3, 3, 1, PAL.moss[1]);
}

/** A jungle tree: a tall buttressed trunk under a broad, layered crown, vines hanging (six seeds). */
export function jungleTree(seed = 0): Sprite {
  const v = ((seed % 6) + 6) % 6;
  return cached(`jungle:${v}`, () => {
    const W = 40, H = 56, trunk = cv(W, H), c = trunk.getContext('2d')!;
    const crown = cv(W, 40), k = crown.getContext('2d')!;
    if (v === 3 || v === 4) {
      // A palm: a ringed trunk with a lean, a crown of long drooping fronds, a bunch of nuts under them.
      const lean = v === 3 ? 1 : -1;
      for (let y = 18; y < H; y++) { const x = 18 + Math.round(lean * (H - y) * .08); rect(c, x, y, 4, 1, y % 4 ? PAL.bark[0] : PAL.bark[2]); rect(c, x, y, 1, 1, PAL.bark[1]); }
      rect(c, 15, H - 2, 10, 2, PAL.bark[2]); rect(c, 14, H - 3, 3, 1, PAL.moss[1]);
      const tx0 = 20 + Math.round(lean * (H - 18) * .08), ty0 = 15;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI - .35 + i * (Math.PI + .7) / 7, len = 14 + (i % 3) * 2;
        for (let t = 2; t <= len; t++) {
          const x = Math.round(tx0 + Math.cos(a) * t), y = Math.round(ty0 + Math.sin(a) * t * .6 + t * t * .04);
          rect(k, x, y, 2, 1, i % 2 ? PAL.jungle[1] : PAL.jungle[0]);
          if (t % 2 === 0 && t < len - 1) { rect(k, x, y + 1, 1, 2, PAL.jungle[2]); rect(k, x + 1, y - 1, 1, 1, PAL.jungle[3]); }
        }
      }
      rect(k, tx0 - 3, ty0 + 1, 2, 2, '#7a5a30'); rect(k, tx0, ty0 + 2, 2, 2, '#8a6a38'); rect(k, tx0 - 2, ty0 + 3, 2, 2, '#6a4a28');
      if (v === 4) rect(k, tx0 + 3, ty0, 2, 3, PAL.rootglass[1]);
      return { img: outline(trunk), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 }, shadow: { img: shadowSprite(30, 10), x: -13, y: -6 } };
    }
    buttressTrunk(c, 20, 26, H, 6 + (v % 2) * 2, 4);
    const blobs = v < 3
      ? [[20, 22, 15], [9, 25, 9], [31, 25, 9], [14, 12, 10], [27, 13, 10], [20, 6, 7]]
      : [[20, 20, 13], [8, 24, 8], [32, 23, 8], [12, 14, 9], [28, 12, 9]];
    for (const [x, y, r] of blobs) leafBlob(k, x, y, r, PAL.jungle, v);
    vines(k, 6, 34, 30, v);
    if (v === 2 || v === 5) for (let i = 0; i < 4; i++) rect(k, 8 + Math.floor(hash(i, v, 4) * 24), 10 + Math.floor(hash(i, v, 5) * 18), 2, 2, i % 2 ? PAL.flower[2] : PAL.flower[0]);
    if (v === 1) for (let i = 0; i < 3; i++) rect(k, 10 + i * 9, 18 + (i % 2) * 6, 2, 3, PAL.rootglass[1]);
    return { img: outline(volumize(trunk, { depth: 3 })), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 }, shadow: { img: shadowSprite(40, 13), x: -17, y: -8 } };
  });
}

/** One of the giant trees of the deep jungle: a trunk three tiles wide, roots like walls, a crown that shades a clearing. */
export function giantTree(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`giant:${v}`, () => {
    const W = 96, H = 104, trunk = cv(W, H), c = trunk.getContext('2d')!;
    buttressTrunk(c, 48, 40, H, 22, 14);
    // Moss climbing the bark, a hollow, a shelf fungus.
    for (let y = 50; y < H - 6; y += 7) rect(c, 38 + (y % 4), y, 3, 4, PAL.moss[1]);
    rect(c, 50, 66, 6, 9, '#1c120c'); rect(c, 51, 65, 4, 1, '#1c120c');
    rect(c, 56, 58, 6, 2, '#d8c49a'); rect(c, 56, 60, 6, 1, '#9a8460');
    const crown = cv(W, 72), k = crown.getContext('2d')!;
    const blobs = [[48, 38, 30], [20, 44, 18], [76, 44, 18], [28, 22, 18], [68, 22, 18], [48, 14, 16], [10, 52, 10], [86, 52, 10]];
    for (const [x, y, r] of blobs) leafBlob(k, x, y, r, PAL.jungle, v + 9);
    vines(k, 8, 88, 60, v + 3);
    for (let i = 0; i < 5; i++) rect(k, 16 + Math.floor(hash(i, v, 7) * 62), 18 + Math.floor(hash(i, v, 8) * 34), 2, 2, PAL.rootglass[1]);
    return {
      img: outline(trunk), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 },
      lights: [{ x: -20, y: -60, r: 14 }, { x: 22, y: -70, r: 12 }], shadow: { img: shadowSprite(84, 24), x: -38, y: -14 },
    };
  });
}

/**
 * The Rootglass Bole, Rootglass's heart: a giant tree the town is built round, a door between its roots, lit windows
 * up its trunk where the floors go up into the canopy (maps/rootglass-bole.ts), a crown that roofs the whole plaza.
 */
export function rootglassBole(): Sprite {
  return cached('rootglass-bole', () => {
    const W = 112, H = 128, trunk = cv(W, H), c = trunk.getContext('2d')!;
    buttressTrunk(c, 56, 30, H, 40, 18);
    // A boardwalk ring round the trunk, halfway up, on brackets.
    rect(c, 22, 66, 68, 4, PAL.plank[0]); rect(c, 22, 69, 68, 1, PAL.wood[2]);
    for (let x = 24; x < 90; x += 10) rect(c, x, 70, 2, 5, PAL.wood[2]);
    // Windows up the trunk, warm, one floor each.
    const lights: { x: number; y: number; r: number; warm?: boolean }[] = [];
    for (const [x, y] of [[44, 48], [64, 40], [50, 78], [62, 84]] as const) {
      rect(c, x - 1, y - 1, 8, 10, PAL.bark[3]); rect(c, x, y, 6, 8, PAL.window); rect(c, x + 2, y, 1, 8, PAL.bark[2]);
      lights.push({ x: x + 3 - W / 2, y: y + 4 - H, r: 12, warm: true });
    }
    // The door: an arch of roots, rootglass lanterns either side.
    rect(c, 46, 98, 20, 30, PAL.bark[3]); rect(c, 48, 96, 16, 3, PAL.bark[3]);
    rect(c, 48, 100, 16, 28, PAL.wood[0]); rect(c, 50, 98, 12, 2, PAL.wood[0]);
    rect(c, 55, 100, 1, 28, PAL.wood[2]); rect(c, 59, 113, 1, 3, '#e6c35a');
    for (const x of [38, 70]) { rect(c, x, 104, 4, 1, PAL.bark[3]); rect(c, x, 105, 4, 6, PAL.rootglass[2]); rect(c, x + 1, 106, 2, 4, PAL.rootglass[1]); lights.push({ x: x + 2 - W / 2, y: 108 - H, r: 20 }); }
    const crown = cv(W + 24, 84), k = crown.getContext('2d')!;
    const blobs = [[68, 44, 34], [30, 50, 22], [106, 50, 22], [40, 24, 22], [96, 24, 22], [68, 14, 18], [12, 60, 12], [124, 60, 12]];
    for (const [x, y, r] of blobs) leafBlob(k, x, y, r, PAL.jungle, 31);
    vines(k, 12, 124, 70, 31);
    // Rootglass growing in the crown, lit from inside: the town's name.
    for (let i = 0; i < 9; i++) { const x = 20 + Math.floor(hash(i, 3, 17) * 96), y = 14 + Math.floor(hash(i, 3, 18) * 46); rect(k, x, y, 2, 3, PAL.rootglass[1]); rect(k, x, y, 1, 1, PAL.rootglass[0]); }
    lights.push({ x: -30, y: -H + 10, r: 16 }, { x: 30, y: -H + 4, r: 16 }, { x: 0, y: -H - 10, r: 18 });
    return { img: outline(trunk), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 13, y: -H - 1 - 4 }, lights };
  });
}

/** A rootglass lamp: a curled root post, a lantern of living glass that glows mint all night. */
export function rootLamp(): Sprite {
  return cached('root-lamp', () => {
    const img = cv(12, 32), c = img.getContext('2d')!;
    rect(c, 5, 8, 2, 22, PAL.bark[1]); rect(c, 5, 8, 1, 22, PAL.bark[0]); rect(c, 3, 29, 6, 3, PAL.bark[2]);
    rect(c, 6, 4, 4, 2, PAL.bark[1]); rect(c, 9, 5, 1, 3, PAL.bark[2]);
    rect(c, 7, 8, 5, 7, PAL.rootglass[3]); rect(c, 8, 9, 3, 5, PAL.rootglass[1]); rect(c, 8, 9, 1, 1, PAL.rootglass[0]);
    rect(c, 3, 18, 2, 2, PAL.moss[1]);
    return { img: outline(img), ax: 7, ay: 33, lights: [{ x: 3, y: -22, r: 30 }] };
  });
}

/** The Overgrown Temple's gate: a stepped front of mossy stone, a dark door, a carved face with rootglass eyes. */
export function templeGate(): Sprite {
  return cached('temple-gate', paintTempleGate);
}

/** A temple pillar, broken off at the top, moss in its flutes (three heights). */
export function templePillar(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`pillar-${v}`, () => {
    const W = 14, H = 26 + v * 5, img = cv(W, H), c = img.getContext('2d')!;
    rect(c, 0, H - 4, W, 4, PAL.temple[2]); rect(c, 0, H - 4, W, 1, PAL.temple[3]);
    rect(c, 2, 4, 10, H - 8, PAL.temple[1]); rect(c, 2, 4, 2, H - 8, PAL.temple[3]); rect(c, 10, 4, 2, H - 8, PAL.temple[2]);
    for (const x of [5, 8]) rect(c, x, 6, 1, H - 12, PAL.temple[2]);
    rect(c, 2, 2, 4, 3, PAL.temple[1]); rect(c, 7, 0, 5, 5, PAL.temple[1]); rect(c, 7, 0, 5, 1, PAL.temple[3]);
    rect(c, 2, 9 + v * 2, 4, 3, PAL.moss[1]); rect(c, 8, H - 9, 3, 4, PAL.moss[3]); rect(c, 11, 6, 1, 8, PAL.jungle[1]);
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1 };
  });
}

/** A fern clump on the jungle floor (three seeds). */
export function fern(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`fern-${v}`, () => {
    const W = 20, H = 14, img = cv(W, H), c = img.getContext('2d')!;
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 3, len = 6 + ((i + v) % 3) * 2;
      for (let k = 0; k < len; k++) { rect(c, 10 + Math.round(dx * k / len), H - 1 - k, 1, 1, PAL.jungle[k < 2 ? 2 : 1]); if (k % 2) rect(c, 10 + Math.round(dx * k / len) + (dx < 0 ? -1 : 1), H - 1 - k, 1, 1, PAL.jungle[3]); }
    }
    if (v === 1) rect(c, 9, 4, 2, 2, PAL.flower[0]);
    if (v === 2) rect(c, 12, 5, 1, 2, PAL.rootglass[1]);
    return { img: outline(img), ax: 10, ay: H };
  });
}

/** A Verdant ship at its pier: the hull and mast as ever, a moss-green sail with a rootglass stripe. */
export function verdantShip(): Sprite {
  return cached('verdant-ship', () => ({ ...paintShip({ hull: RAMP.wood, sail: RAMP.moss, stripe: RAMP.rootglass, flag: PAL.rootglass[2] }), lights: [{ x: 0, y: -54, r: 10 }] }));
}

// ── The Umbral Marches (maps/umbral-marches.ts): lantern posts, the Lantern Tower, swamp cypresses hung with moss,
// reeds, gloomcaps, the gloam-sailed ship and the drowned crypts' door. Same kit: painted once, outlined, lit top-left.

/** A Marches lantern post: a crooked black-timber post, an arm, a caged lantern of warm gold that never goes out. */
export function lanternPost(): Sprite {
  return cached('lantern-post', () => {
    const img = cv(14, 34), c = img.getContext('2d')!;
    rect(c, 3, 8, 3, 23, '#2a2026'); rect(c, 3, 8, 1, 23, '#46363c'); rect(c, 1, 30, 7, 3, '#2a2026'); rect(c, 0, 31, 2, 2, PAL.mire[3]);
    // The arm, bent like a heron's neck, and a little rope.
    rect(c, 4, 6, 7, 2, '#2a2026'); rect(c, 10, 6, 1, 3, '#2a2026');
    // The cage: an iron hood, gold glass, bars, a drip of wax under it.
    rect(c, 8, 9, 6, 2, '#1c1418'); rect(c, 8, 11, 6, 7, PAL.lantern[3]); rect(c, 9, 11, 4, 6, PAL.lantern[1]); rect(c, 9, 11, 2, 2, PAL.lantern[0]);
    rect(c, 10, 11, 1, 6, PAL.lantern[2]); rect(c, 8, 18, 6, 1, '#1c1418'); rect(c, 10, 19, 2, 1, PAL.lantern[2]);
    rect(c, 2, 20, 2, 3, PAL.hangmoss[1]); rect(c, 2, 23, 1, 2, PAL.hangmoss[2]);
    return { img: outline(img), ax: 5, ay: 35, lights: [{ x: 6, y: -21, r: 34, warm: true }] };
  });
}

/**
 * Gloamhaven's Lantern Tower: a tall timber tower on stilts over the water, a gallery at each floor (it goes up two,
 * maps/lantern-tower.ts), shingles of gloam-violet, and at its top the Great Lantern that guides boats through the fog.
 */
export function lanternTower(): Sprite {
  return cached('lantern-tower', () => {
    const W = 52, H = 132, img = cv(W, H), c = img.getContext('2d')!;
    const lights: { x: number; y: number; r: number; warm?: boolean }[] = [];
    // Stilts and cross-braces at the foot, going down into the fen.
    for (const x of [6, 18, 32, 44]) { rect(c, x, 108, 3, 24, '#2a2026'); rect(c, x, 108, 1, 24, '#46363c'); }
    for (let y = 112; y < 130; y += 9) { for (let i = 0; i < 38; i++) rect(c, 7 + i, y + Math.round(i * .18), 1, 1, '#3a2c30'); }
    rect(c, 2, 104, 48, 5, PAL.wood[0]); rect(c, 2, 104, 48, 1, PAL.wood[3]); rect(c, 2, 108, 48, 1, '#1a120c');
    // The body: three storeys of dark weatherboard, narrowing a little, each with a gallery rail and lit windows.
    for (let f = 0; f < 3; f++) {
      const top = 38 + f * 22, inset = 8 - f * 2, x0 = 6 + inset - 2, w = W - 12 - (inset - 2) * 2;
      rect(c, x0, top, w, 22, '#3b2f36');
      for (let y = top + 2; y < top + 22; y += 3) rect(c, x0, y, w, 1, '#2e242a');
      rect(c, x0, top, 3, 22, '#4a3c42'); rect(c, x0 + w - 3, top, 3, 22, '#241c22');
      rect(c, x0 - 3, top + 19, w + 6, 3, PAL.wood[0]); rect(c, x0 - 3, top + 19, w + 6, 1, PAL.wood[3]);
      for (let x = x0 - 3; x < x0 + w + 3; x += 4) rect(c, x, top + 15, 1, 4, PAL.wood[2]);
      rect(c, x0 - 3, top + 15, w + 6, 1, PAL.wood[1]);
      for (const wx of f === 2 ? [x0 + 4, x0 + w - 10] : [W / 2 - 3]) {
        rect(c, wx - 1, top + 4, 8, 10, '#1c1418'); rect(c, wx, top + 5, 6, 8, PAL.window); rect(c, wx + 2, top + 5, 1, 8, '#6e4220');
        lights.push({ x: wx + 3 - W / 2, y: top + 9 - H, r: 12, warm: true });
      }
    }
    // The door at the foot, on the boardwalk, a lantern either side.
    rect(c, 19, 86, 14, 18, '#1c1418'); rect(c, 20, 87, 12, 17, PAL.wood[0]); rect(c, 25, 87, 1, 17, PAL.wood[2]); rect(c, 29, 95, 1, 2, '#e6c35a');
    for (const x of [13, 36]) { rect(c, x, 89, 4, 6, PAL.lantern[1]); rect(c, x, 88, 4, 1, '#1c1418'); rect(c, x + 1, 90, 2, 2, PAL.lantern[0]); lights.push({ x: x + 2 - W / 2, y: 92 - H, r: 16, warm: true }); }
    // The roof: a steep cone of gloam shingles, and the lantern room under its peak.
    for (let y = 0; y < 22; y++) {
      const half = Math.round(6 + 20 * (y / 22));
      rect(c, W / 2 - half, 16 + y, half * 2, 1, pick(PAL.roofGloam, hash(y, 5, 93)));
      if (y % 4 === 3) rect(c, W / 2 - half, 16 + y, half * 2, 1, PAL.roofGloam[2]);
    }
    rect(c, W / 2 - 26, 36, 52, 2, PAL.roofGloam[2]);
    // The Great Lantern: a cage of iron round a big gold glass, its light the brightest thing in the Marches.
    rect(c, W / 2 - 8, 2, 16, 15, '#1c1418'); rect(c, W / 2 - 6, 4, 12, 12, PAL.lantern[2]); rect(c, W / 2 - 5, 5, 10, 10, PAL.lantern[1]); rect(c, W / 2 - 4, 6, 5, 5, PAL.lantern[0]);
    for (const x of [-6, -1, 4]) rect(c, W / 2 + x, 4, 1, 12, '#1c1418');
    rect(c, W / 2 - 2, 0, 4, 2, '#1c1418');
    lights.push({ x: 0, y: 10 - H, r: 42, warm: true });
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1, lights };
  });
}

/** A swamp cypress: knees of root round a flared foot, a ragged crown, grey moss hanging off every bough (six seeds). */
export function swampTree(seed = 0): Sprite {
  const v = ((seed % 6) + 6) % 6;
  return cached(`swamp-tree:${v}`, () => {
    const W = 40, H = 54, trunk = cv(W, H), c = trunk.getContext('2d')!;
    const dead = v === 4 || v === 5, lean = v % 2 ? 1 : -1;
    // The trunk, flared at its foot, leaning a little; cypress knees poking out of the mire round it.
    for (let y = 18; y < H; y++) {
      const w = 4 + Math.max(0, Math.round((y - 38) * .5)), x = 20 - w / 2 + Math.round(lean * (H - y) * .06);
      rect(c, x, y, w, 1, '#4a3a34'); rect(c, x, y, 1, 1, '#66544a'); rect(c, x + w - 1, y, 1, 1, '#2c221e');
    }
    for (const [x, h] of [[8, 4], [12, 3], [29, 3], [33, 5]] as const) { rect(c, x, H - h, 2, h, '#4a3a34'); rect(c, x, H - h, 1, 1, '#66544a'); }
    rect(c, 11, H - 2, 18, 2, '#2c221e');
    const crown = cv(W, 42), k = crown.getContext('2d')!;
    // Boughs, bare on a dead one.
    for (const [x0, y0, x1, y1] of [[20, 30, 6, 20], [20, 26, 34, 16], [20, 22, 14, 8], [21, 22, 28, 6]] as const) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) rect(k, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 2, 1, '#3e302c');
    }
    if (!dead) {
      // Drooping, sparse clumps of grey-green needles (td-flora's lit clumps in the swamp's own ramp).
      const ramp = clumpRamp(['#41513e', '#4e5f48', '#33402f', '#62745a']);
      paintClumps(k, [[20, 16, 9], [10, 20, 6], [30, 18, 6], [14, 9, 6], [26, 8, 6], [20, 24, 6]].map(([x, y, r], i) => ({ x, y, r, tone: i > 2 ? 1 : i === 5 ? -1 : 0 })), ramp, v + 70);
    }
    // The hanging moss: long grey strands from the boughs, swaying nowhere.
    for (let x = 4; x < 36; x += 2) {
      if (hash(x, v, 31) < .4) continue;
      const y0 = 12 + Math.floor(hash(x, v, 32) * 14), len = 5 + Math.floor(hash(x, v, 33) * (dead ? 10 : 14));
      rect(k, x, y0, 1, len, PAL.hangmoss[1]); rect(k, x, y0, 1, 2, PAL.hangmoss[3]); rect(k, x, y0 + len - 1, 1, 1, PAL.hangmoss[2]);
    }
    if (v === 2) { rect(k, 25, 24, 2, 2, PAL.ink[1]); rect(k, 25, 24, 1, 1, PAL.ink[0]); }
    return { img: outline(volumize(trunk, { depth: 3 })), ax: W / 2 + 1, ay: H + 1, roof: { img: outline(crown), x: -(W / 2) - 1, y: -H - 1 + 2 }, shadow: { img: shadowSprite(34, 11), x: -15, y: -7 }, ...(v === 2 ? { lights: [{ x: 5, y: -28, r: 12 }] } : {}) };
  });
}

/** Reeds and cattails at the water's edge (three seeds). */
export function reeds(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`reeds-${v}`, () => {
    const W = 18, H = 20, img = cv(W, H), c = img.getContext('2d')!;
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 2 + (i % 2), h = 9 + ((i * 5 + v * 3) % 8), lean = ((i + v) % 3) - 1;
      for (let y = 0; y < h; y++) rect(c, x + Math.round(lean * y / h * 2), H - 1 - y, 1, 1, y < 3 ? '#3e4a30' : i % 2 ? '#6e7c4a' : '#58663c');
      if ((i + v) % 3 === 0) { rect(c, x + lean * 2 - 1 + 1, H - h - 2, 2, 4, '#5a3a24'); rect(c, x + lean * 2 + 1, H - h - 2, 1, 1, '#7a5034'); }
    }
    return { img: outline(img), ax: 9, ay: H };
  });
}

/** Gloomcaps: a cluster of pale mushrooms that glow ink-violet in the dark (three seeds). */
export function gloomcap(seed = 0): Sprite {
  const v = ((seed % 3) + 3) % 3;
  return cached(`gloomcap-${v}`, () => {
    const W = 16, H = 12, img = cv(W, H), c = img.getContext('2d')!;
    for (const [x, h, w] of ([[3, 6, 5], [9, 8, 6], [6, 4, 4], [12, 5, 3]] as const).slice(0, 2 + v)) {
      rect(c, x + Math.floor(w / 2) - 1, H - h + 2, 2, h - 2, '#d8d0e0');
      rect(c, x, H - h, w, 3, PAL.ink[2]); rect(c, x + 1, H - h - 1, w - 2, 1, PAL.ink[2]); rect(c, x + 1, H - h, w - 2, 1, PAL.ink[1]);
      rect(c, x + 1, H - h - 1, 1, 1, PAL.ink[0]);
    }
    return { img: outline(img), ax: 8, ay: H, lights: [{ x: 0, y: -6, r: 12 }] };
  });
}

/** The Marches' ship at its pier: a black hull, a gloam-violet sail with a lantern-gold stripe, a lantern at its bow. */
export function umbralShip(): Sprite {
  return cached('umbral-ship', () => ({ ...paintShip({ hull: ['#140e12', '#1c1418', '#241a1e', '#2e2228', '#3a2c30', '#4a3a40', '#5a464c'], sail: [PAL.roofGloam[2], '#4a4262', PAL.roofGloam[1], PAL.roofGloam[3]], stripe: RAMP.lantern, flag: PAL.ink[1], lantern: true, studs: PAL.lantern[2] }), lights: [{ x: -26, y: -26, r: 18, warm: true }] }));
}

/** The Great Lantern at the top of Gloamhaven's tower: an iron cage as tall as a man round a glass of gold, on a plinth. */
export function greatLantern(): Sprite {
  return cached('great-lantern', () => {
    const W = 40, H = 46, img = cv(W, H), c = img.getContext('2d')!;
    // The plinth: three steps of dark timber bound in iron.
    rect(c, 2, 38, 36, 8, '#3b2f36'); rect(c, 2, 38, 36, 1, '#5a464c'); rect(c, 6, 34, 28, 4, '#2e242a'); rect(c, 6, 34, 28, 1, '#4a3c42');
    for (const x of [4, 19, 34]) rect(c, x, 39, 2, 6, '#1c1418');
    // The glass, lit from inside: a hot core, gold body, amber at its edges.
    rect(c, 9, 8, 22, 26, PAL.lantern[3]); rect(c, 10, 9, 20, 24, PAL.lantern[2]); rect(c, 12, 11, 16, 20, PAL.lantern[1]); rect(c, 14, 13, 9, 11, PAL.lantern[0]);
    // The cage: a hood, a ring, bars, a finial.
    rect(c, 7, 4, 26, 4, '#1c1418'); rect(c, 10, 1, 20, 3, '#2a2026'); rect(c, 18, 0, 4, 1, '#2a2026');
    for (const x of [8, 14, 20, 26, 31]) rect(c, x, 8, 1, 26, '#1c1418');
    rect(c, 7, 20, 26, 1, '#1c1418'); rect(c, 7, 33, 26, 1, '#1c1418');
    rect(c, 9, 5, 22, 1, '#4a3c42');
    return { img: outline(img), ax: W / 2 + 1, ay: H + 1, lights: [{ x: 0, y: -26, r: 44, warm: true }] };
  });
}

// ── Dungeon set dressing (campaign.md queue #4, the atmosphere pass; td-dressing.ts). Builders place them; none is on a map yet.

/** A stone altar under a dry cloth, two cold candles. */
export function altar(): Sprite { return cached('altar', paintAltar); }
/** An iron brazier: unlit (cold ash; a Keeper may light it) or lit (a fixed light, four tiles). */
export function brazier(lit = false): Sprite { return cached(`brazier-${lit ? 1 : 0}`, () => paintBrazier(lit)); }
/** A hanging iron cage, old bones inside. */
export function cage(): Sprite { return cached('cage', paintCage); }
/** Chains hung on a wall's face (blocks nothing). */
export function chains(): Sprite { return cached('chains', paintChains); }
/** A broken statue on its pedestal, the head fallen at its foot. */
export function brokenStatue(): Sprite { return cached('statue-broken', paintBrokenStatue); }
/** A readable inscription set in a wall's face (the station and its i18n line are the builder's). */
export function inscription(): Sprite { return cached('inscription', paintInscription); }
/** A cobweb across a room's corner (floor decal). */
export function cobweb(corner: 'nw' | 'ne' = 'nw'): Sprite { return cached(`cobweb-${corner}`, () => paintCobweb(corner)); }
/** A chalk or salt ritual circle (floor decal). */
export function ritualCircle(): Sprite { return cached('circle', paintRitualCircle); }
/** An old dry stain, rust-brown (floor decal; never red, never fresh). */
export function oldStain(): Sprite { return cached('stain', paintStain); }
/** Frost crusted on the floor (floor decal). */
export function rime(): Sprite { return cached('rime', paintRime); }
/** A sealed Barrow door (Barrow Doors 2–5, canon §8.1: a Tibia door with no key yet): chained, padlocked, its number stamped. */
export function sealedDoor(n = 2): Sprite { return cached(`sealed-door-${n}`, () => paintBarrowDoor(false, n, true)); }
