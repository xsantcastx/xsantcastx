/**
 * wild-life.ts — the Living World's critters, hermits and the day's mysteries, in a streamed
 * world (docs/handoff/living-world.md). The engine hands each sector column's spawns in when the
 * column loads (living-world.ts `crittersFor`, the surface plan's hermit, `mysteryAt`) and takes
 * them out when it leaves: nothing lives outside the loaded ring, nothing is saved.
 *
 * Cheap by construction: at most a few critters a column, each a cached sheet blit
 * (critter-art.ts) and a few lines of motion, updated only within a screen and a half of the
 * Keeper and drawn only on screen. Under reduced motion they sit still (no hops, no flutter).
 * Visual and interaction only: what a catch or a mystery pays is the host's (side-scroller).
 */
import { CRITTERS, type CritterId, type CritterSpawn, type HermitDef, type Mystery } from './living-world';
import { CRITTER_PIXEL, drawCritter, frameSize } from './critter-art';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { townsfolkLook } from '../../shared/keeper-look/npc-looks';
import { REALM_PALETTES } from '../world/life';

const CELL = 32;
/** Critters further than this from the Keeper (world px) are not stepped. */
const AWAKE_X = 1500, AWAKE_Y = 1000;
/** A swing catches a critter this close in front of the Keeper (world px). */
const CATCH = { ahead: 70, behind: 14, up: 90, down: 30 } as const;
/** E reaches a mystery this close (world px). A whisper speaks within WHISPER. */
const MYSTERY_REACH = 70, WHISPER = 230;
/** Each hermit's coat from the Infernal townsfolk palettes. */
const HERMIT_PALETTE: Readonly<Record<string, number>> = { 'hermit-orla': 1, 'hermit-tobb': 2, 'hermit-mira': 0 };

interface Critter {
  spawn: CritterSpawn;
  sx: number;
  x: number; y: number;
  homeX: number; homeY: number;
  vx: number; vy: number;
  facing: number;
  state: 'idle' | 'move' | 'flee' | 'gone';
  timer: number;
  /** Fades out after fleeing or being caught. */
  fade: number;
  caught: boolean;
  seed: number;
}
interface Hermit { def: HermitDef; sx: number; x: number; y: number; painter: KeeperPainter | null; facing: number }
/** A mystery placed in the world: its feet (or centre, a wisp) in world px. */
export interface PlacedMystery { m: Mystery; sx: number; x: number; y: number; homeX: number; homeY: number; found: boolean; spoke: boolean; settle: number }

export interface WildFrame {
  camera: number; cameraY: number; viewport: number; viewH: number; time: number; reduced: boolean;
  translate?: (key: string) => string;
  keeperX: number; keeperY: number;
}

export class WildLife {
  private critters: Critter[] = [];
  private hermits: Hermit[] = [];
  private mysteries: PlacedMystery[] = [];

  /** A column's critters (cells → world px with the terrain's top), its hermit and its mystery. */
  load(sx: number, top: number, spawns: readonly CritterSpawn[], hermit: { def: HermitDef; col: number; row: number } | null, mystery: PlacedMystery | null, found: (id: string) => boolean): void {
    this.unload(sx);
    let n = 0;
    for (const s of spawns) {
      const x = (s.col + .5) * CELL;
      const y = s.on === 'ground' ? top + (s.row + 1) * CELL
        : s.on === 'perch' ? top + s.row * CELL
          : s.on === 'ceiling' ? top + s.row * CELL + (frameSize(s.critter).h + 2) * CRITTER_PIXEL
            : s.on === 'water' ? top + s.row * CELL + 8
              : top + s.row * CELL + 16;
      this.critters.push({ spawn: s, sx, x, y, homeX: x, homeY: y, vx: 0, vy: 0, facing: (n++ % 2) ? 1 : -1, state: 'idle', timer: 1 + (n % 5) * .6, fade: 1, caught: false, seed: n * 1.37 + sx });
    }
    if (hermit) {
      const palettes = REALM_PALETTES.infernal, look = townsfolkLook(`wilds:${hermit.def.id}`, palettes[HERMIT_PALETTE[hermit.def.id] ?? 1], hermit.def.look);
      const painter = canPaint() ? new KeeperPainter(look.look, look.gear, look.garb) : null;
      this.hermits.push({ def: hermit.def, sx, x: (hermit.col + .5) * CELL, y: top + (hermit.row + 1) * CELL, painter, facing: -1 });
    }
    if (mystery) { mystery.found = found(mystery.m.id); this.mysteries.push(mystery); }
  }
  unload(sx: number): void {
    if (this.critters.some(c => c.sx === sx)) this.critters = this.critters.filter(c => c.sx !== sx);
    if (this.hermits.some(h => h.sx === sx)) this.hermits = this.hermits.filter(h => h.sx !== sx);
    if (this.mysteries.some(m => m.sx === sx)) this.mysteries = this.mysteries.filter(m => m.sx !== sx);
  }
  clear(): void { this.critters = []; this.hermits = []; this.mysteries = []; }
  /** How much is alive round the Keeper (the canvas's data attributes, the perf notes). */
  counts(): { critters: number; hermits: number; mysteries: number } {
    return { critters: this.critters.filter(c => c.state !== 'gone').length, hermits: this.hermits.length, mysteries: this.mysteries.filter(m => !m.found).length };
  }

  /**
   * One fixed step. Returns the whisper the Keeper just walked into (once per page), or null:
   * the host says it, and Glim answers.
   */
  update(dt: number, px: number, py: number, reduced: boolean): PlacedMystery | null {
    for (const c of this.critters) {
      if (c.state === 'gone' || Math.abs(c.x - px) > AWAKE_X || Math.abs(c.y - py) > AWAKE_Y) continue;
      this.step(c, dt, px, py, reduced);
    }
    let whisper: PlacedMystery | null = null;
    for (const m of this.mysteries) {
      if (m.found) continue;
      const d = Math.hypot(m.x - px, m.y - py);
      if (m.m.kind === 'whisper' && !m.spoke && d < WHISPER) { m.spoke = true; whisper = m; }
      // A wisp drifts ahead of a Keeper who follows it, then settles (and waits to be touched).
      if (m.m.kind === 'wisp' && !reduced) {
        if (d < 260 && Math.abs(m.x - m.homeX) < 8 * CELL) { m.x += Math.sign(m.x - px || 1) * 70 * dt; m.settle = 0; }
        else m.settle += dt;
        m.y = m.homeY + Math.sin(m.settle * 2 + m.x * .01) * 10;
      }
    }
    for (const h of this.hermits) h.facing = px < h.x ? -1 : 1;
    return whisper;
  }
  private step(c: Critter, dt: number, px: number, py: number, reduced: boolean): void {
    const def = CRITTERS[c.spawn.critter];
    if (c.caught || c.state === 'flee') {
      c.fade -= dt * (c.caught ? 2.5 : .55);
      if (!reduced) { c.x += c.vx * dt; c.y += c.vy * dt; }
      if (c.fade <= 0) c.state = 'gone';
      return;
    }
    if (reduced) return;
    const dx = c.x - px, near = Math.abs(dx) < def.shy && Math.abs(c.y - py) < def.shy;
    if (near && def.shy > 0) {
      // Away from the Keeper: birds and moths take to the air, hares bolt.
      c.state = 'flee'; c.facing = dx >= 0 ? 1 : -1;
      const flier = c.spawn.critter === 'cinder-finch' || c.spawn.critter === 'dusk-moth';
      c.vx = c.facing * (flier ? 150 : 230); c.vy = flier ? -110 : 0;
      return;
    }
    c.timer -= dt;
    switch (c.spawn.critter) {
      case 'ash-hare': case 'ember-beetle': case 'glowworm': {
        if (c.spawn.on === 'ceiling') break;
        // A little patrol round home: hop, pause, turn.
        if (c.timer <= 0) {
          c.state = c.state === 'idle' ? 'move' : 'idle';
          c.timer = c.state === 'move' ? .6 + (c.seed % 1) : 1.2 + ((c.seed * 3) % 2);
          if (c.state === 'move') c.facing = Math.abs(c.x - c.homeX) > 40 ? (c.x > c.homeX ? -1 : 1) : (c.facing === 1 ? -1 : 1);
        }
        if (c.state === 'move') c.x += c.facing * (c.spawn.critter === 'ash-hare' ? 48 : c.spawn.critter === 'ember-beetle' ? 14 : 6) * dt;
        break;
      }
      case 'cinder-finch': case 'dusk-moth':
        if (c.spawn.on === 'air') { c.x = c.homeX + Math.sin(c.seed + c.timer * .9) * 26; c.y = c.homeY + Math.sin(c.seed * 2 + c.timer * 2.1) * 9; c.facing = Math.cos(c.seed + c.timer * .9) < 0 ? 1 : -1; }
        if (c.timer < -60) c.timer = 0;
        break;
      case 'leaping-fish':
        // Under the water, then a leap: an arc a cell and a bit high, every few seconds.
        if (c.timer <= 0) { c.state = c.state === 'move' ? 'idle' : 'move'; c.timer = c.state === 'move' ? .9 : 2.5 + (c.seed % 3); }
        c.y = c.state === 'move' ? c.homeY - Math.sin((1 - c.timer / .9) * Math.PI) * 44 : c.homeY;
        break;
    }
  }

  /** The catchable critter a swing reaches (in front of the Keeper), caught: or null. */
  catchAt(px: number, py: number, facing: number): { id: string; critter: CritterId; x: number; y: number } | null {
    for (const c of this.critters) {
      if (c.state === 'gone' || c.caught || !CRITTERS[c.spawn.critter].drop) continue;
      const ahead = (c.x - px) * facing;
      if (ahead < -CATCH.behind || ahead > CATCH.ahead || c.y < py - CATCH.up || c.y > py + CATCH.down) continue;
      c.caught = true; c.vy = -40; c.vx = 0;
      return { id: c.spawn.id, critter: c.spawn.critter, x: c.x, y: c.y };
    }
    return null;
  }
  /** The mystery within E's reach (a wisp settled or not, a door), not yet found today; or null. */
  mysteryInReach(px: number, py: number): PlacedMystery | null {
    for (const m of this.mysteries) if (!m.found && m.m.kind !== 'whisper' && Math.abs(m.x - px) < MYSTERY_REACH && Math.abs(m.y - py) < MYSTERY_REACH + 30) return m;
    return null;
  }
  /** The nearest unfound mystery within `r` px (Glim brightens), or null. */
  mysteryNear(px: number, py: number, r: number): PlacedMystery | null {
    let best: PlacedMystery | null = null, bestD = r;
    for (const m of this.mysteries) { const d = Math.hypot(m.x - px, m.y - py); if (!m.found && d < bestD) { best = m; bestD = d; } }
    return best;
  }
  /** The hermit the Keeper stands beside, or null. */
  hermitNear(px: number, py: number): Hermit | null {
    for (const h of this.hermits) if (Math.abs(h.x - px) < 120 && Math.abs(h.y - py) < 80) return h;
    return null;
  }
  /** Small lights of their own: glowworms and wisps (the Delve's light pool). */
  lights(add: (x: number, y: number, radius: number, strength: number) => void, camera: number, viewport: number, time: number): void {
    for (const c of this.critters) {
      if (c.spawn.critter !== 'glowworm' || c.state === 'gone' || c.x < camera - 120 || c.x > camera + viewport + 120) continue;
      add(c.x, c.y - 6, 84 + Math.sin(time * 2 + c.seed) * 6, .42 * c.fade);
    }
    for (const m of this.mysteries) {
      if (m.found || m.x < camera - 200 || m.x > camera + viewport + 200) continue;
      if (m.m.kind === 'wisp') add(m.x, m.y, 150 + Math.sin(time * 3) * 12, .7);
      if (m.m.kind === 'door') add(m.x, m.y - 30, 90, .45);
    }
  }

  draw(c: CanvasRenderingContext2D, f: WildFrame): void {
    const x0 = f.camera - 80, x1 = f.camera + f.viewport + 80, y0 = f.cameraY - 80, y1 = f.cameraY + f.viewH + 80;
    for (const m of this.mysteries) {
      if (m.x < x0 || m.x > x1 || m.y < y0 - 60 || m.y > y1 + 60) continue;
      if (m.m.kind === 'door') drawCritter(c, 'door', m.found ? 1 : 0, m.x, m.y, 1);
      else if (m.m.kind === 'wisp' && !m.found) drawWisp(c, m.x, m.y, f.time, f.reduced);
      else if (m.m.kind === 'whisper' && !m.spoke && !f.reduced) drawWhisper(c, m.x, m.y, f.time);
    }
    for (const cr of this.critters) {
      if (cr.state === 'gone' || cr.x < x0 || cr.x > x1 || cr.y < y0 || cr.y > y1) continue;
      if (cr.spawn.critter === 'leaping-fish' && cr.state !== 'move' && !f.reduced) continue;
      const frame = this.frameOf(cr, f.time, f.reduced);
      if (cr.fade < 1) c.globalAlpha = Math.max(0, cr.fade);
      drawCritter(c, cr.spawn.critter, frame, cr.x, cr.y, cr.facing);
      if (cr.fade < 1) c.globalAlpha = 1;
    }
    for (const h of this.hermits) {
      if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1 + 80) continue;
      if (h.painter) {
        c.save(); c.translate(Math.round(h.x), Math.round(h.y)); if (h.facing < 0) c.scale(-1, 1);
        h.painter.draw(c, CRITTER_PIXEL, { action: 'idle', time: f.time, attackT: 0, reduced: f.reduced, weapon: false });
        c.restore();
      }
      // The name over the head, and a short hello when the Keeper is beside them.
      const tr = f.translate;
      if (tr) {
        const top = h.y - (h.painter ? h.painter.top * CRITTER_PIXEL : 58) - 6;
        c.save(); c.textAlign = 'center';
        c.font = '600 11px "Cormorant Garamond", Georgia, serif';
        const name = tr(`play.living.hermit.${h.def.id}.name`);
        c.fillStyle = '#1a120fd0'; c.fillRect(h.x - 52, top - 14, 104, 16);
        c.fillStyle = '#ffe1b0'; c.fillText(name, h.x, top - 2, 100);
        if (Math.abs(f.keeperX - h.x) < 120 && Math.abs(f.keeperY - h.y) < 80) {
          const text = tr(`play.living.hermit.${h.def.id}.hello`);
          c.font = '600 12px "Cormorant Garamond", Georgia, serif';
          const w = Math.min(220, c.measureText(text).width + 18);
          c.fillStyle = '#fff6ea'; c.fillRect(h.x - w / 2, top - 40, w, 20);
          c.fillStyle = '#2a1c16'; c.fillText(text, h.x, top - 26, w - 10);
        }
        c.restore();
      }
    }
  }
  private frameOf(c: Critter, time: number, reduced: boolean): number {
    if (reduced) return 0;
    switch (c.spawn.critter) {
      case 'cinder-finch': return c.state === 'flee' || c.spawn.on === 'air' ? 2 + (Math.floor(time * 12 + c.seed) % 2) : Math.floor(time * 1.3 + c.seed) % 5 === 0 ? 1 : 0;
      case 'dusk-moth': return Math.floor(time * 10 + c.seed) % 2;
      case 'ash-hare': return c.state === 'move' || c.state === 'flee' ? Math.floor(time * 8) % 2 : 0;
      case 'ember-beetle': return c.state === 'move' ? Math.floor(time * 6) % 2 : 0;
      case 'glowworm': return Math.floor(time * 1.5 + c.seed) % 2;
      case 'leaping-fish': return c.timer > .45 ? 0 : 1;
    }
  }
}

function canPaint(): boolean { return typeof document !== 'undefined' && typeof document.createElement === 'function'; }

/** A wisp: a soft pale-gold light that breathes, with two motes circling it (pixel squares, no blur). */
function drawWisp(c: CanvasRenderingContext2D, x: number, y: number, time: number, reduced: boolean): void {
  const p = CRITTER_PIXEL, pulse = reduced ? 0 : Math.sin(time * 3) * .5 + .5;
  c.fillStyle = '#ffe9a855'; c.fillRect(Math.round(x - 6 * p), Math.round(y - 6 * p), 12 * p, 12 * p);
  c.fillStyle = '#ffe9a8aa'; c.fillRect(Math.round(x - 4 * p), Math.round(y - 4 * p), 8 * p, 8 * p);
  c.fillStyle = '#fff4d0'; c.fillRect(Math.round(x - 2 * p), Math.round(y - 3 * p), 4 * p, 6 * p);
  c.fillStyle = '#ffffff'; c.fillRect(Math.round(x - p), Math.round(y - 2 * p + pulse * p), 2 * p, 2 * p);
  if (reduced) return;
  for (let k = 0; k < 2; k++) {
    const a = time * 2.4 + k * Math.PI;
    c.fillStyle = k ? '#b88cff' : '#ffd36d';
    c.fillRect(Math.round(x + Math.cos(a) * 9 * p), Math.round(y + Math.sin(a) * 5 * p), p, p);
  }
}
/** A whisper: three faint rune-motes drifting up where it waits. */
function drawWhisper(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const p = CRITTER_PIXEL;
  for (let k = 0; k < 3; k++) {
    const t = (time * .5 + k / 3) % 1;
    c.fillStyle = `rgba(232, 216, 255, ${(1 - t) * .55})`;
    c.fillRect(Math.round(x + Math.sin(time + k * 2) * 14), Math.round(y - 20 - t * 60), 2 * p, 2 * p);
  }
}
