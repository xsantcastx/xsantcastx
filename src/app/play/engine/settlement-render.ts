/**
 * settlement-render.ts — a settlement's shop dressing and its Waystones
 * (One World §2.3 "make the stores nicer", §3). Render-only: nothing here
 * changes a cell.
 *
 * The buildings themselves are cells (blueprints.ts, drawn by terrain-render).
 * Over them this paints, on the world's 2 px art grid, what makes a shop read
 * as a shop from the street:
 *
 *   - an awning across the shop floor, in the realm's stripes;
 *   - a hanging sign off the east beam with the station's own pixel icon;
 *   - a window display: a shelf behind the counter with three things the
 *     station deals in (WINDOW_DISPLAY), as pixel icons;
 *   - the counter, drawn in front of the keeper (`drawFront`);
 *   - smoke from the forge's chimney; windows lit warm at night;
 *   - the square's Hearth fire and benches; the mine head's winch wheel.
 *
 * And the Waystones (§3.1): a tall pixel stone whose seams burn violet while
 * unlit and climb to gold as it is lit (the 1.2 s ritual), gold once lit.
 * Reduced motion holds every flame, wisp and seam still.
 */
import { blueprintMarks, BLUEPRINTS, type RealmPalette } from './blueprints';
import { buildingsIn, type StoneDef, type SurfaceSpec } from './surface-gen';
import type { StationDef } from '../world/world.model';

const CELL = 32;
/** World px per art px in a world. */
const P = 2;

/** Three things each station deals in, shown in its window (pixel icon keys: items, runes or plaques). */
export const WINDOW_DISPLAY: Readonly<Record<string, readonly string[]>> = {
  vault: ['cinder-ore', 'ember-residue', 'slag-fragment'],
  vendor: ['starlight-herb', 'world-root-bark', 'cinder-ore'],
  forge: ['basalt-edge', 'cinder-ore', 'ember-residue'],
  crafting: ['iron-hammer', 'world-root-bark', 'slag-fragment'],
  runes: ['rune-of-cinder', 'ember-residue', 'infernal-heartstone'],
  enchanting: ['enchantment-active', 'rune-of-cinder', 'glowcap'],
};

/** What the engine hands the dressing each frame. Mutated in place, never reallocated. */
export interface DressingFrame {
  spec: SurfaceSpec;
  /** World y of the ground line's top edge. */
  groundY: number;
  camera: number;
  viewport: number;
  time: number;
  reduced: boolean;
  /** Windows burn warm (dusk to the small hours). */
  lit: boolean;
  stations: readonly StationDef[];
  /** Draw a pixel icon (item, rune or plaque key) centred at (cx, cy), `size` world px. False until loaded. */
  icon: (key: string, cx: number, cy: number, size: number) => boolean;
  /** The station the Keeper is at (its sign brightens). */
  near: string | null;
  /** The square's Hearth fire column, and its benches. */
  hearth: number;
  benches: readonly number[];
}

/** One stone as the engine draws it. */
export interface StoneView extends StoneDef { x: number; y: number; lit: boolean; seen: boolean }

const STONE_W = 13, STONE_H = 47;

export class SettlementDressing {
  private stoneSprites = new Map<string, HTMLCanvasElement | null>();

  /** Behind the people: awnings, displays, signs, the lit windows, smoke, the Hearth fire, the benches. */
  drawBack(c: CanvasRenderingContext2D, f: DressingFrame): void {
    const c0 = Math.floor(f.camera / CELL) - 16, c1 = Math.ceil((f.camera + f.viewport) / CELL) + 16;
    const pal = f.spec.palette;
    for (const b of buildingsIn(f.spec, c0, c1)) {
      const m = b.marks, rows = BLUEPRINTS[b.kind], x0 = b.col * CELL;
      const topY = f.groundY - rows.length * CELL;
      // Lit windows: a warm wash over the glass (the engine adds their light to the dark).
      if (f.lit) for (const w of m.windows) {
        c.fillStyle = '#ffb066'; c.globalAlpha = .55;
        c.fillRect(x0 + w.x * CELL + P * 3, topY + w.y * CELL + P * 3, CELL - P * 6, CELL - P * 6);
        c.globalAlpha = 1;
      }
      if (m.chimney) this.smoke(c, x0 + m.chimney.x * CELL + CELL, topY + m.chimney.y * CELL, f);
      if (b.kind === 'mine-head') this.winch(c, x0 + 2.5 * CELL, topY + CELL * .5, f);
      if (!m.counter || !b.station) continue;
      const floorY = f.groundY, roomFloor = m.upstairs !== null ? topY + (m.upstairs + 1) * CELL : floorY - 3 * CELL;
      // The awning: under the upper floor, across the shop, scalloped (the realm's stripes).
      this.awning(c, x0 + CELL, roomFloor, (rows[0].length - 2) * CELL, pal);
      // The window display: a shelf on the back wall behind the counter, three things on it.
      const counterX = x0 + m.counter.x * CELL + CELL / 2;
      const shelfY = floorY - CELL * 2 - P * 2;
      px(c, counterX - CELL * 1.6, shelfY, CELL * 3.2, P * 2, '#6a4a2c');
      px(c, counterX - CELL * 1.6, shelfY, CELL * 3.2, P, '#a6784a');
      const items = WINDOW_DISPLAY[b.station] ?? [];
      items.forEach((key, n) => f.icon(key, counterX + (n - 1) * CELL, shelfY - CELL / 2 + P, CELL - P * 2));
      // The sign: a board hanging off the east beam, the station's own icon on it.
      const station = f.stations.find(s => s.id === b.station);
      if (m.sign && station) this.sign(c, x0 + (m.sign.x + 1) * CELL, topY + m.sign.y * CELL + CELL / 2, station, f, f.near === station.id);
    }
    // The square: the Hearth fire (always lit) and two benches.
    const hx = f.hearth * CELL + CELL / 2;
    if (hx > f.camera - 80 && hx < f.camera + f.viewport + 80) this.hearth(c, hx, f.groundY, f);
    for (const bc of f.benches) this.bench(c, bc * CELL + CELL / 2, f.groundY);
  }

  /** In front of the keepers: each shop's counter. */
  drawFront(c: CanvasRenderingContext2D, f: DressingFrame): void {
    const c0 = Math.floor(f.camera / CELL) - 16, c1 = Math.ceil((f.camera + f.viewport) / CELL) + 16;
    for (const b of buildingsIn(f.spec, c0, c1)) {
      const m = blueprintMarks(b.kind);
      if (!m.counter || !b.station) continue;
      const cx = b.col * CELL + m.counter.x * CELL + CELL / 2, y = f.groundY, w = CELL * 2.4, h = P * 14;
      // A timber counter: a lit top board, a dark body with panel seams, a shadow line at its foot.
      px(c, cx - w / 2 - P, y - h - P * 2, w + P * 2, P * 2, '#c9a06a');
      px(c, cx - w / 2 - P, y - h - P * 2, w + P * 2, P, '#e8c896');
      px(c, cx - w / 2, y - h, w, h, '#4a3238');
      px(c, cx - w / 2, y - h, P, h, '#6a4a3c');
      for (let k = cx - w / 2 + P * 6; k < cx + w / 2 - P * 2; k += P * 8) px(c, k, y - h + P * 2, P, h - P * 4, '#2a1d22');
      px(c, cx - w / 2, y - P, w, P, '#1a1210');
    }
  }

  /** The Waystones in view: unlit stones' seams violet, lit stones' gold; `charge` 0..1 climbs the seams to gold. */
  drawStones(c: CanvasRenderingContext2D, stones: readonly StoneView[], f: Pick<DressingFrame, 'camera' | 'viewport' | 'time' | 'reduced'>, near: string | null, charge: number): void {
    for (const s of stones) {
      if (s.x < f.camera - 60 || s.x > f.camera + f.viewport + 60) continue;
      const sprite = this.stone(s.kind === 'town' ? 'town' : 'wild');
      const w = (STONE_W + 2) * P, h = (STONE_H + 2) * P, x0 = Math.round(s.x - w / 2), y0 = s.y - h + P;
      // The plinth: two courses of dressed stone the stone stands in.
      px(c, s.x - P * 10, s.y - P * 4, P * 20, P * 4, '#3a3046');
      px(c, s.x - P * 10, s.y - P * 4, P * 20, P, '#5a4a66');
      if (sprite) {
        const smoothing = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
        c.drawImage(sprite, x0, y0 - P * 3, w, h); c.imageSmoothingEnabled = smoothing;
      } else px(c, s.x - P * 6, s.y - P * 50, P * 12, P * 46, '#3d3446');
      // The seams: violet until lit; the ritual climbs them to gold from the foot; gold once lit.
      const seams = SEAMS.length, lit = s.lit ? seams : s.id === near ? Math.round(charge * seams) : 0;
      const pulse = f.reduced ? 1 : .75 + .25 * Math.sin(f.time * 2.2 + s.col);
      for (let n = 0; n < seams; n++) {
        const [sx, sy] = SEAMS[n];
        c.globalAlpha = n < lit ? 1 : .55 + .3 * pulse;
        px(c, x0 + (sx + 1) * P, y0 - P * 3 + (sy + 1) * P, P, P * 3, n < lit ? '#ffd36d' : '#c9a0ff');
      }
      c.globalAlpha = 1;
      // The crown: a mote of light over a lit stone (gold), a faint violet one over an unlit one.
      const crownY = y0 - P * 6 + (f.reduced ? 0 : Math.round(Math.sin(f.time * 2 + s.col) * 1.5) * P);
      px(c, s.x - P, crownY, P * 2, P * 2, s.lit ? '#fff1b0' : '#b88cff');
      if (s.lit) { c.globalAlpha = .35; px(c, s.x - P * 2, crownY - P, P * 4, P * 4, '#ffd36d'); c.globalAlpha = 1; }
    }
  }

  private stone(kind: 'town' | 'wild'): HTMLCanvasElement | null {
    if (this.stoneSprites.has(kind)) return this.stoneSprites.get(kind) ?? null;
    let el: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      el = document.createElement('canvas');
      el.width = STONE_W + 2; el.height = STONE_H + 2;
      const s = el.getContext('2d');
      if (s) {
        s.translate(1, 1);
        // A tapered standing stone, lit on its west edge (light from the upper left), its east edge in shadow.
        const body = kind === 'town' ? '#4a3e58' : '#3d3446', lit = kind === 'town' ? '#8a7a9a' : '#7d6a86';
        for (let y = 0; y < STONE_H; y++) {
          const half = y < 4 ? 1.5 + y : Math.min(6.5, 4.5 + (y - 4) * .045);
          const l = Math.round(6.5 - half), r = Math.round(6.5 + half);
          s.fillStyle = '#1a1020'; s.fillRect(l - 1, y, r - l + 2, 1);
          s.fillStyle = body; s.fillRect(l, y, r - l, 1);
          s.fillStyle = lit; s.fillRect(l, y, 2, 1);
          s.fillStyle = '#2a2236'; s.fillRect(r - 1, y, 1, 1);
        }
        s.fillStyle = '#1a1020'; s.fillRect(0, STONE_H - 1, STONE_W, 1);
      } else el = null;
    }
    this.stoneSprites.set(kind, el);
    return el;
  }

  private awning(c: CanvasRenderingContext2D, x: number, y: number, w: number, pal: RealmPalette): void {
    const [a, b, trim] = pal.awning, stripe = P * 8;
    px(c, x, y, w, P, trim);
    for (let k = 0, n = 0; k < w; k += stripe, n++) {
      const sw = Math.min(stripe, w - k);
      px(c, x + k, y + P, sw, P * 5, n % 2 ? b : a);
      // The scallop: the stripe's foot rounds off one art pixel at each corner.
      px(c, x + k + P, y + P * 6, sw - P * 2, P, n % 2 ? b : a);
    }
    px(c, x, y + P * 6, w, P, '#1a1020'); c.globalAlpha = .4; px(c, x, y + P * 7, w, P * 2, '#000000'); c.globalAlpha = 1;
  }

  private sign(c: CanvasRenderingContext2D, x: number, y: number, station: StationDef, f: DressingFrame, near: boolean): void {
    // A wrought bracket off the beam, two chains, a board with a rim; the station's icon on it.
    px(c, x - P * 2, y - P * 2, P * 16, P, '#2a2236');
    px(c, x + P * 2, y - P, P, P * 3, '#7a6a5a'); px(c, x + P * 11, y - P, P, P * 3, '#7a6a5a');
    const bx = x, by = y + P * 2, bw = P * 14, bh = P * 14;
    px(c, bx - P, by - P, bw + P * 2, bh + P * 2, '#1a1020');
    px(c, bx, by, bw, bh, near ? '#7a5638' : '#5a3e28');
    px(c, bx, by, bw, P, near ? '#ffe0a8' : '#a6784a');
    if (!f.icon(station.art ?? station.panel ?? station.id, bx + bw / 2, by + bh / 2, P * 12)) px(c, bx + P * 5, by + P * 5, P * 4, P * 4, '#c2a26a');
  }

  private smoke(c: CanvasRenderingContext2D, x: number, y: number, f: DressingFrame): void {
    for (let n = 0; n < 5; n++) {
      const age = f.reduced ? n / 5 : ((f.time * .35 + n / 5) % 1);
      const sx = x - CELL * .5 + Math.round(Math.sin(age * 5 + n) * 3) * P, sy = y - age * CELL * 3;
      const size = Math.round(2 + age * 4) * P;
      c.globalAlpha = (1 - age) * .45;
      px(c, Math.round(sx / P) * P - size / 2, Math.round(sy / P) * P, size, size, '#8a7a7e');
    }
    c.globalAlpha = 1;
  }

  private winch(c: CanvasRenderingContext2D, x: number, y: number, f: DressingFrame): void {
    // The headframe's sheave: a spoked wheel on the top beam, turning slowly.
    const turn = f.reduced ? 0 : Math.floor(f.time * 2) % 2;
    px(c, x - P * 6, y - P * 6, P * 12, P * 12, '#1a1020');
    px(c, x - P * 5, y - P * 5, P * 10, P * 10, '#6a4a2c');
    px(c, x - P * 3, y - P * 3, P * 6, P * 6, '#1a1020');
    if (turn) { px(c, x - P * 5, y - P / 2, P * 10, P, '#a6784a'); px(c, x - P / 2, y - P * 5, P, P * 10, '#a6784a'); }
    else { for (let k = -4; k <= 4; k += 2) px(c, x + k * P, y + k * P, P, P, '#a6784a'); }
  }

  private hearth(c: CanvasRenderingContext2D, x: number, y: number, f: DressingFrame): void {
    // A ring of stones, two crossed logs, flames in three tongues (an art pixel apart), embers.
    for (let k = -4; k <= 4; k += 2) px(c, x + k * P * 2 - P * 2, y - P * 3, P * 4, P * 3, k % 4 ? '#5a4a66' : '#3a3046');
    px(c, x - P * 9, y - P * 6, P * 18, P * 2, '#6a4a2c'); px(c, x - P * 7, y - P * 7, P * 14, P, '#a6784a');
    const flick = f.reduced ? 0 : Math.floor(f.time * 8) % 3;
    const tongues = [[-4, 9 + (flick === 0 ? 2 : 0)], [0, 13 + (flick === 1 ? 2 : 0)], [4, 9 + (flick === 2 ? 2 : 0)]];
    for (const [dx, h] of tongues) {
      px(c, x + dx * P - P * 2, y - P * 6 - h * P, P * 4, h * P, '#ff7a3a');
      px(c, x + dx * P - P, y - P * 6 - (h - 2) * P, P * 2, (h - 2) * P, '#ffc45c');
      px(c, x + dx * P - P / 2, y - P * 6 - (h - 4) * P, P, (h - 4) * P, '#fff1b0');
    }
  }

  private bench(c: CanvasRenderingContext2D, x: number, y: number): void {
    px(c, x - P * 12, y - P * 9, P * 24, P * 2, '#a6784a');
    px(c, x - P * 12, y - P * 7, P * 24, P, '#4a3220');
    px(c, x - P * 10, y - P * 7, P * 2, P * 7, '#4a3220'); px(c, x + P * 8, y - P * 7, P * 2, P * 7, '#4a3220');
  }
}

/** The seams on a stone's face, foot to crown (art px, sprite-local): the ritual climbs them in order. */
const SEAMS: readonly (readonly [number, number])[] = [[5, 40], [6, 37], [5, 34], [6, 31], [7, 28], [6, 25], [5, 22], [6, 19], [7, 16], [6, 13], [6, 10]];

function px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
