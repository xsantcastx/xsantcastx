/**
 * settlement-life.ts — the people of a One World settlement (docs/design/one-world.md §2.5).
 *
 * The same keepers, lines and pixel figures as the towns (world/life.ts,
 * keeper-lines.ts, npc-looks.ts), at the world's scale: figures blitted at 2
 * world px per art px, the exact half of the towns' 4, so the pixels stay crisp.
 *
 *  - Each keeper stands at their building's counter (the station's x), and
 *    keeps the clock's routine (world/routines.ts): the counter by day, a walk
 *    to the Hearth fire at dusk, the fire in the evening, upstairs at night
 *    (on their room's floor, the window lit, then dark). Their position is a
 *    pure function of the hour, so nothing is simulated off screen.
 *  - A head mark rides over a keeper with something to offer (!) or to hand
 *    in (?), read by the host from the Quest Board's own states.
 *  - A few townsfolk wander the square and the east street.
 *
 * Streaming: the engine only updates and draws this while the settlement's
 * columns are within a sector of the view; out of range it does no work at all.
 * Visual only: it never writes combat, loot or economy state.
 */
import { KeeperChatter, type KeeperDef, type LifePalette, REALM_PALETTES, TOWN_KEEPERS, CHATTER_SHOW } from '../world/life';
import { EMPTY_KEEPER_CONTEXT, keeperLines, type KeeperContext } from '../world/keeper-lines';
import { keeperSpot, keeperX } from '../world/routines';
import type { AreaDef, RealmTownId, StationDef } from '../world/world.model';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { NPC_LOOKS, townsfolkLook } from '../../shared/keeper-look/npc-looks';
import type { KeeperAction } from '../../shared/keeper-look/keeper-gear';
import { blueprintMarks, BLUEPRINTS } from './blueprints';
import type { SurfaceSpec } from './surface-gen';

/** World px per art px in a world (the figures' 4, halved: an exact halving keeps pixels crisp). */
export const WORLD_FIGURE_PIXEL = 2;
const CELL = 32;
const TAG_FONT = '600 11px "Cormorant Garamond", Georgia, serif';
const TITLE_FONT = 'italic 600 9px "Cormorant Garamond", Georgia, serif';
const BUBBLE_FONT = '600 13px "Cormorant Garamond", Georgia, serif';
const BUBBLE_MAX = 210;
/** Keepers greet from this close (world px: the towns' 170 at the world's scale). */
const NEAR = 110;

/** One keeper in the settlement: their counter, their room upstairs and the fire they walk to. */
export interface SettlementKeeper {
  def: KeeperDef;
  station: StationDef;
  counterX: number;
  /** Feet y on the street, and on their room's floor upstairs. */
  streetY: number;
  roomY: number;
  hearthX: number;
  /** Where they are this frame (set by `update`). */
  x: number;
  y: number;
  facing: number;
  walking: boolean;
  upstairs: boolean;
  painter: KeeperPainter | null;
  voice: { x: number; def: { lines: readonly string[] } };
}

interface Wanderer { x: number; lo: number; hi: number; target: number; pause: number; facing: number; step: number; speed: number; painter: KeeperPainter | null; seed: number }

/** What the engine hands each frame. Mutated in place. */
export interface SettlementFrame {
  camera: number;
  viewport: number;
  time: number;
  reduced: boolean;
  translate: (key: string) => string;
}

export class SettlementLife {
  private keepers: SettlementKeeper[] = [];
  private folk: Wanderer[] = [];
  private chatter: KeeperChatter | null = null;
  private context: KeeperContext = EMPTY_KEEPER_CONTEXT;
  private marks: Readonly<Record<string, '!' | '?'>> = {};
  private hour = 12;
  private clock = 0;
  private rng = 0x5e77;
  private bubble: string[] = [];
  private bubbleKey = '';
  private bubbleWidth = 0;
  /** The settlement's span (world x), for the engine's streaming test. */
  span: [number, number] = [0, 0];

  /** The keepers placed (tests, the host's data attributes). */
  get placed(): readonly SettlementKeeper[] { return this.keepers; }
  get active(): boolean { return this.keepers.length > 0; }
  /** The keeper speaking now, or null. */
  get speaking(): { keeper: string; line: string } | null {
    const c = this.chatter;
    return c && c.speaker >= 0 ? { keeper: this.keepers[c.speaker].def.id, line: c.line } : null;
  }

  /** Populate the settlement of a world area, or clear the stage anywhere else. Allocates; area entry only. */
  enter(area: AreaDef, realm: RealmTownId, hearthCol: number): void {
    const surface = area.terrain?.surface;
    this.keepers = []; this.folk = []; this.chatter = null;
    if (!surface) return;
    const top = (area.terrain!.top) + surface.ground * CELL;
    const hearthX = hearthCol * CELL + CELL / 2;
    for (const def of TOWN_KEEPERS[realm] ?? []) {
      const station = area.stations.find(s => s.id === def.station);
      if (!station) continue;
      const b = surface.buildings.find(row => row.station === station.id);
      const marks = b ? blueprintMarks(b.kind) : null;
      // Upstairs: feet on the planks of the room above the shop (blueprints.ts `upstairs`).
      const roomY = b && marks?.upstairs != null ? top - (BLUEPRINTS[b.kind].length - marks.upstairs) * CELL : top;
      const npc = NPC_LOOKS[def.id];
      const painter = npc && canPaint() ? new KeeperPainter(npc.look, npc.gear, npc.garb) : null;
      const voice = { x: station.x, def: { lines: keeperLines(def.id, this.context) } };
      this.keepers.push({ def, station, counterX: station.x, streetY: station.y ?? top, roomY, hearthX, x: station.x, y: station.y ?? top, facing: -1, walking: false, upstairs: false, painter, voice });
    }
    this.chatter = new KeeperChatter(this.keepers.map(k => k.voice));
    // Townsfolk on the square and the east street: open runs of street between the buildings.
    const runs: [number, number][] = [[(hearthCol - 6) * CELL, (hearthCol + 8) * CELL], [99 * CELL, 110 * CELL]];
    const palettes = REALM_PALETTES[realm] ?? REALM_PALETTES.infernal;
    for (let i = 0; i < 3; i++) {
      const [lo, hi] = runs[i % runs.length];
      const x = lo + this.random() * (hi - lo);
      const palette: LifePalette = palettes[(i + 1) % palettes.length];
      const painter = canPaint() ? (({ look, gear, garb }) => new KeeperPainter(look, gear, garb))(townsfolkLook(`${realm}:world:${i}`, palette, i % 2 ? 'coat' : 'robe')) : null;
      this.folk.push({ x, lo, hi, target: x, pause: 1 + this.random() * 3, facing: 1, step: 0, speed: 16 + this.random() * 10, painter, seed: this.random() * 10 });
    }
    const xs = this.keepers.map(k => k.x);
    this.span = xs.length ? [Math.min(...xs, hearthX) - 400, Math.max(...xs, hearthX) + 400] : [0, 0];
  }

  /** The story beats and station deeds changed: each keeper re-reads their pool (keeper-lines.ts). */
  setContext(context: KeeperContext): void {
    this.context = context;
    this.keepers.forEach((k, i) => {
      const lines = keeperLines(k.def.id, context);
      if (lines.join() === k.voice.def.lines.join()) return;
      k.voice.def.lines = lines;
      this.chatter?.restart(i);
    });
  }
  /** Head marks by keeper id (the host reads the Quest Board). */
  setMarks(marks: Readonly<Record<string, '!' | '?'>>): void { this.marks = marks; }
  /** The world clock's hour (0–24). */
  setHour(hour: number): void { this.hour = hour; }
  /** The mark over a keeper (tests). */
  markOf(id: string): '!' | '?' | null { return this.marks[id] ?? null; }

  /** One fixed step: routines, greetings, wanderers. */
  update(dt: number, playerX: number, playerY: number, time: number): void {
    this.clock = time;
    const { spot } = keeperSpot(this.hour);
    for (const k of this.keepers) {
      const x = keeperX(this.hour, k.counterX, k.hearthX);
      k.walking = spot === 'walk' && Math.abs(x - k.x) > .05;
      if (k.walking) k.facing = Math.sign(x - k.x) || k.facing;
      else k.facing = Math.abs(playerX - x) < 200 ? (Math.sign(playerX - x) || 1) : -1;
      k.x = x;
      k.upstairs = spot === 'upstairs';
      k.y = k.upstairs ? k.roomY : k.streetY;
      k.voice.x = Math.abs(playerY - k.y) < 60 ? x : -1e9;
    }
    this.chatter?.update(playerX, time);
    for (const p of this.folk) {
      if (p.pause > 0) { p.pause -= dt; if (p.pause <= 0) p.target = p.lo + this.random() * (p.hi - p.lo); continue; }
      const dx = p.target - p.x, move = p.speed * dt;
      if (Math.abs(dx) <= move) { p.x = p.target; p.pause = 2 + this.random() * 5; }
      else { p.x += Math.sign(dx) * move; p.facing = Math.sign(dx); p.step += dt * p.speed / 5; }
    }
  }

  /** The station a click on a keeper opens (at the counter only), or null. */
  stationAt(x: number, y: number): StationDef | null {
    for (const k of this.keepers) if (!k.upstairs && Math.abs(k.x - x) <= 16 && y <= k.y + 10 && y >= k.y - 70) return k.station;
    return null;
  }

  /** Draw the townsfolk and the keepers (name plates, head marks, the line being said). */
  draw(c: CanvasRenderingContext2D, f: SettlementFrame): void {
    for (const p of this.folk) {
      if (p.x < f.camera - 60 || p.x > f.camera + f.viewport + 60) continue;
      this.figure(c, f, p.painter, p.x, this.keepers[0]?.streetY ?? 0, p.facing, p.pause <= 0 ? 'walk' : 'idle', p.step, p.seed);
    }
    this.keepers.forEach((k, i) => {
      if (k.x < f.camera - 80 || k.x > f.camera + f.viewport + 80) return;
      const talking = this.chatter?.speaker === i;
      this.figure(c, f, k.painter, k.x, k.y, k.facing, k.walking ? 'walk' : talking ? 'talk' : 'idle', f.time * 1.6, i * 1.7);
      this.plate(c, f, k);
    });
    this.speech(c, f);
  }

  private figure(c: CanvasRenderingContext2D, f: SettlementFrame, painter: KeeperPainter | null, x: number, y: number, facing: number,
    state: 'idle' | 'walk' | 'talk', step: number, seed: number): void {
    c.save();
    c.globalAlpha = .28; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(x, y + 1, 15, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    if (painter) {
      c.translate(Math.round(x), y); c.scale(facing < 0 ? -1 : 1, 1);
      const action: KeeperAction = state === 'walk' && !f.reduced ? 'walk' : state === 'talk' && !f.reduced ? 'talk' : 'idle';
      painter.draw(c, WORLD_FIGURE_PIXEL, { action, time: action === 'walk' ? step : f.time + seed, attackT: 0, reduced: f.reduced, weapon: true });
    } else {
      // No DOM (the node harness): a plain marker in the figure's place.
      c.fillStyle = '#3a2b2d'; c.fillRect(x - 8, y - 56, 16, 56);
    }
    c.restore();
  }

  private top(k: SettlementKeeper): number { return k.y - (k.painter ? k.painter.top * WORLD_FIGURE_PIXEL : 58) - 4; }

  /** The name plate over the head, its role title under the name, and the head mark over it. */
  private plate(c: CanvasRenderingContext2D, f: SettlementFrame, k: SettlementKeeper): void {
    const name = f.translate(k.def.nameKey), title = k.def.titleKey ? f.translate(k.def.titleKey) : '';
    const shownName = name === k.def.nameKey ? k.def.name : name, shownTitle = title === k.def.titleKey ? k.def.title ?? '' : title;
    c.save(); c.textAlign = 'center';
    c.font = TAG_FONT;
    let w = c.measureText(shownName).width;
    if (shownTitle) { c.font = TITLE_FONT; w = Math.max(w, c.measureText(shownTitle).width); }
    w = Math.min(150, w + 14);
    const h = shownTitle ? 26 : 16, y = this.top(k) - h;
    c.fillStyle = '#1a120fe6'; c.fillRect(k.x - w / 2, y, w, h);
    c.fillStyle = k.def.palette.glow; c.fillRect(k.x - w / 2, y + h - 2, w, 2);
    c.font = TAG_FONT; c.fillStyle = '#ffe1b0'; c.fillText(shownName, k.x, y + 12, 140);
    if (shownTitle) { c.font = TITLE_FONT; c.fillStyle = '#d9bf98'; c.fillText(shownTitle, k.x, y + 23, 140); }
    const mark = this.marks[k.def.id];
    if (mark) drawHeadMark(c, k.x, y - 4, mark, f.reduced ? 0 : f.time);
    c.restore();
  }

  private speech(c: CanvasRenderingContext2D, f: SettlementFrame): void {
    const chatter = this.chatter;
    if (!chatter || chatter.speaker < 0) return;
    const k = this.keepers[chatter.speaker];
    if (!k || k.x < f.camera - 120 || k.x > f.camera + f.viewport + 120) return;
    c.save(); c.font = BUBBLE_FONT; c.textAlign = 'center';
    const key = chatter.line + chatter.at;
    if (this.bubbleKey !== key) {
      this.bubbleKey = key;
      const text = f.translate(chatter.line);
      this.bubble = wrap(c, text === chatter.line ? '' : text, BUBBLE_MAX);
      this.bubbleWidth = this.bubble.reduce((w, line) => Math.max(w, c.measureText(line).width), 0) + 20;
    }
    if (!this.bubble.length) { c.restore(); return; }
    const age = this.clock - chatter.at;
    c.globalAlpha = Math.max(0, f.reduced ? 1 : Math.min(1, age * 4, (CHATTER_SHOW - age) * 3));
    const h = this.bubble.length * 16 + 8, w = this.bubbleWidth;
    const x = Math.max(f.camera + w / 2 + 6, Math.min(f.camera + f.viewport - w / 2 - 6, k.x));
    const y = this.top(k) - 26 - 14 - h;
    c.fillStyle = '#fff6ea'; c.fillRect(x - w / 2, y, w, h);
    c.beginPath(); c.moveTo(k.x - 5, y + h); c.lineTo(k.x + 5, y + h); c.lineTo(k.x, y + h + 6); c.closePath(); c.fill();
    c.fillStyle = '#2a1c16';
    for (let n = 0; n < this.bubble.length; n++) c.fillText(this.bubble[n], x, y + 16 + n * 16);
    c.restore();
  }

  private random(): number {
    let t = (this.rng = (this.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * MapleStory's head mark, as pixel art on the world's 2 px grid: a gold `!`
 * (something to offer) or a pale-blue `?` (something to hand in) in a dark
 * rim, bobbing gently (still under reduced motion).
 */
export function drawHeadMark(c: CanvasRenderingContext2D, x: number, bottom: number, mark: '!' | '?', time: number): void {
  const P = 2, bob = Math.round(Math.sin(time * 3) * 1.5) * P;
  const glyph = mark === '!'
    ? ['.oo.', '.ff.', '.ff.', '.ff.', '.ff.', '.oo.', '....', '.ff.', '.oo.']
    : ['.ooo.', 'offfo', 'oo.fo', '...fo', '..ffo', '..fo.', '..o..', '..f..', '..o..'];
  const fill = mark === '!' ? '#ffd36d' : '#9fdcff', rim = '#2a1408';
  const w = glyph[0].length * P, h = glyph.length * P, x0 = Math.round(x - w / 2), y0 = Math.round(bottom - h) + bob;
  c.fillStyle = rim; c.fillRect(x0 - P, y0 - P, w + P * 2, h + P * 2);
  for (let r = 0; r < glyph.length; r++) for (let col = 0; col < glyph[r].length; col++) {
    const g = glyph[r][col];
    if (g === '.') continue;
    c.fillStyle = g === 'f' ? fill : '#e8a83a';
    c.fillRect(x0 + col * P, y0 + r * P, P, P);
  }
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function canPaint(): boolean { return typeof document !== 'undefined' && typeof document.createElement === 'function'; }

export type { SurfaceSpec };
