/**
 * surface-body.ts — the Keeper's movement on a surface with height (hunting
 * grounds with trees, rock ledges and floating ruins; world/heights.ts).
 *
 * Pure and deterministic: a fixed step in, a body out. Areas without heights
 * keep `advanceBody` (engine.model.ts) unchanged.
 *
 *  - Jump arc: the same take-off as everywhere (−680), but holding Jump floats
 *    the apex a little and letting go early drops sooner (a short hop); the
 *    fall is a touch heavier than the rise. Coyote time and the jump buffer
 *    stay in the engine.
 *  - Solids (rock ledges, ruin blocks): walls you cannot walk through, tops you
 *    stand on, undersides you bump.
 *  - Ledge grab: rising slowly or falling past a solid's top corner while
 *    moving or facing into it, the hands catch the lip. Jump (or keep pushing
 *    in) mantles up; Down or pushing away lets go.
 *  - Climbing: a tree trunk or a vine-faced wall. Jump at one grabs it; held
 *    Jump climbs up, Down climbs down; the top of a trunk steps onto its canopy.
 *  - Wall-jump: on a trunk or vine face (or within a moment of touching a
 *    vine face in the air), a direction + Jump kicks off that way.
 *  - Down + Jump on a canopy, bridge or ruin drops through it.
 */
import type { Platform } from './engine.model';

/** A rock ledge or ruin block: solid on every side. `climb`: its faces are vined (climbable, wall-jumpable). */
export interface SurfaceSolid { x: number; y: number; w: number; h: number; climb?: boolean }
/** A climbable trunk: its centre x and the span its climber moves through (feet y from `bottom` up to `top`). */
export interface SurfaceClimb { x: number; top: number; bottom: number; /** Canopy width; 0 or absent: a snag, the climb stops at its top and holds on. */ canopy?: number }
export interface SurfaceGeo {
  /** One-way platforms (the floor included). */
  platforms: readonly Platform[];
  solids: readonly SurfaceSolid[];
  climbs: readonly SurfaceClimb[];
  width: number;
}
export interface MoveInput { dir: -1 | 0 | 1; jump: boolean; down: boolean; facing: number }
export interface SurfaceBody { x: number; y: number; vy: number; grounded: boolean }
export type MoveMode = 'free' | 'climb' | 'hang' | 'mantle';

/** The Keeper's collision box at figure scale 1 (it is ~170 px tall to the crown). */
export const SURFACE_BOX = { halfWidth: 18, height: 168 };
export const GRAVITY = 1650;
export const JUMP_SPEED = 680;
export const CLIMB_UP = 230;
export const CLIMB_DOWN = 300;
/** Feet hang this far under a ledge's top while the hands hold its lip. */
export const HANG_DROP = 150;
export const MANTLE_TIME = .24;
export const WALL_KICK = 400;
export const WALL_JUMP = 640;
const KICK_TIME = .22;
const REGRAB = .3;
const WALL_GRACE = .14;
const TERMINAL = 1150;
/** How far a trunk's grab reaches either side of its centre. */
export const TRUNK_REACH = 24;

export class SurfaceMover {
  mode: MoveMode = 'free';
  /** The trunk being climbed (index into geo.climbs), or the vine face (−1 − solid index). */
  private hold = 0;
  /** Hanging / mantling / on a vine face: the lip (edge x, top y) and the direction into the ledge (+1: the ledge is to the right). */
  private lipX = 0; private lipY = 0; private into = 0;
  private t = 0; private fromX = 0; private fromY = 0;
  private kick = 0; private kickTime = 0;
  private regrab = 0; private wallTime = 0; private wallDir = 0;
  private drop = 0; private letGo = 0;
  /** Events of the last step, for the sound/dust hooks and tests. */
  event: 'grab' | 'mantle' | 'walljump' | 'climb' | null = null;

  reset(): void {
    this.mode = 'free'; this.kick = 0; this.kickTime = 0; this.regrab = 0; this.wallTime = 0; this.drop = 0; this.letGo = 0; this.event = null;
  }
  get climbing(): boolean { return this.mode === 'climb'; }
  get busy(): boolean { return this.mode !== 'free'; }

  /**
   * Jump pressed. Returns true when the press was used here (a wall-jump, a
   * grab, a mantle, a drop-through); false means "an ordinary jump" for the
   * engine's coyote/buffer path.
   */
  pressJump(b: SurfaceBody, input: MoveInput, geo: SurfaceGeo): boolean {
    if (this.mode === 'mantle') return true;
    if (this.mode === 'hang') { if (input.dir !== -this.into) this.startMantle(b); return true; }
    if (this.mode === 'climb') {
      // A direction + Jump kicks off (never into a vine face); Jump alone climbs (held, see step).
      if (input.dir && (this.hold >= 0 || input.dir === -this.into)) this.wallJump(b, input.dir);
      return true;
    }
    if (input.down && b.grounded && this.onOneWay(b, geo)) { this.drop = .25; b.grounded = false; return true; }
    if (!b.grounded && this.wallTime > 0 && input.dir !== this.wallDir) {
      this.wallJump(b, (input.dir || -this.wallDir) as -1 | 1); return true;
    }
    if (this.regrab <= 0 && this.grabClimb(b, geo)) return true;
    return false;
  }

  /** The ordinary take-off (the engine calls it from its coyote/buffer path). */
  jump(b: SurfaceBody): void { b.vy = -JUMP_SPEED; b.grounded = false; this.mode = 'free'; }

  step(b: SurfaceBody, input: MoveInput, velocityX: number, dt: number, geo: SurfaceGeo): void {
    this.event = null;
    this.regrab = Math.max(0, this.regrab - dt); this.wallTime = Math.max(0, this.wallTime - dt);
    this.drop = Math.max(0, this.drop - dt);
    if (this.mode === 'mantle') {
      this.t += dt;
      const u = Math.min(1, this.t / MANTLE_TIME);
      // Up first, then over the lip: the hands pull, then the feet step in.
      const up = Math.min(1, u / .6), over = Math.max(0, (u - .4) / .6);
      b.y = this.fromY + (this.lipY - this.fromY) * (1 - (1 - up) * (1 - up));
      b.x = this.fromX + (this.lipX + this.into * (SURFACE_BOX.halfWidth + 10) - this.fromX) * over;
      b.vy = 0; b.grounded = u >= 1;
      if (u >= 1) { this.mode = 'free'; b.y = this.lipY; }
      return;
    }
    if (this.mode === 'hang') {
      b.vy = 0; b.grounded = false;
      if (input.down || (input.dir && input.dir === -this.into)) { this.mode = 'free'; this.regrab = REGRAB; return; }
      if (input.dir === this.into) { this.letGo += dt; if (this.letGo > .12) this.startMantle(b); }
      else this.letGo = 0;
      return;
    }
    if (this.mode === 'climb') { this.stepClimb(b, input, dt, geo); return; }

    // Free: horizontal (input plus a decaying wall-kick), then vertical.
    if (this.kickTime > 0) { this.kickTime -= dt; velocityX = velocityX * .25 + this.kick; this.kick *= Math.exp(-4 * dt); }
    const x0 = b.x;
    b.x = Math.max(30, Math.min(geo.width - 30, b.x + velocityX * dt));
    this.resolveX(b, x0, geo);
    let g = GRAVITY;
    if (b.vy < 0 && !input.jump) g *= 2.1;               // let go early: a shorter hop
    else if (Math.abs(b.vy) < 150 && input.jump) g *= .55; // held: a floaty apex
    else if (b.vy > 0) g *= 1.12;                          // fall a little heavier than the rise
    const y0 = b.y;
    b.vy = Math.min(TERMINAL, b.vy + g * dt);
    b.y += b.vy * dt;
    b.grounded = false;
    this.resolveY(b, y0, geo);
    if (!b.grounded) {
      if (this.regrab <= 0 && b.vy > -220 && this.tryLedge(b, input, geo)) return;
      if (input.jump && b.vy >= 0 && this.regrab <= 0) this.grabClimb(b, geo);
    }
  }

  private stepClimb(b: SurfaceBody, input: MoveInput, dt: number, geo: SurfaceGeo): void {
    b.vy = 0; b.grounded = false;
    const trunk = this.hold >= 0 ? geo.climbs[this.hold] : null;
    const face = this.hold < 0 ? geo.solids[-1 - this.hold] : null;
    const top = trunk ? trunk.top : face!.y + HANG_DROP, bottom = trunk ? trunk.bottom : face!.y + face!.h;
    // A direction held on its own lets go after a beat (a tap is not a fall).
    if (input.dir && !input.jump && (this.hold >= 0 || input.dir === -this.into)) { this.letGo += dt; if (this.letGo > .2) { this.mode = 'free'; this.regrab = REGRAB; b.x += input.dir * 4; return; } }
    else this.letGo = 0;
    const climb = input.down ? CLIMB_DOWN : input.jump ? -CLIMB_UP : 0;
    if (climb) this.event = 'climb';
    b.y += climb * dt;
    if (b.y <= top) {
      b.y = top;
      if (trunk?.canopy) { this.mode = 'free'; b.grounded = true; this.regrab = REGRAB; }   // onto the canopy
      else if (trunk) { /* a snag: hold on at the top */ }
      else { this.lipX = this.into > 0 ? face!.x : face!.x + face!.w; this.lipY = face!.y; this.startMantle(b); }
    }
    if (b.y >= bottom) { b.y = bottom; this.mode = 'free'; b.grounded = true; this.regrab = REGRAB; }
  }

  private startMantle(b: SurfaceBody): void {
    this.mode = 'mantle'; this.t = 0; this.fromX = b.x; this.fromY = b.y; this.event = 'mantle';
  }

  private wallJump(b: SurfaceBody, dir: -1 | 1): void {
    this.mode = 'free'; b.vy = -WALL_JUMP; b.grounded = false;
    this.kick = dir * WALL_KICK; this.kickTime = KICK_TIME; this.regrab = REGRAB; this.wallTime = 0; this.event = 'walljump';
    b.x += dir * 6;
  }

  /** Jump at a trunk (or a vine face beside the body): take hold. */
  private grabClimb(b: SurfaceBody, geo: SurfaceGeo): boolean {
    for (let i = 0; i < geo.climbs.length; i++) {
      const c = geo.climbs[i];
      if (Math.abs(b.x - c.x) <= TRUNK_REACH && b.y > c.top + 4 && b.y <= c.bottom + 2) {
        this.mode = 'climb'; this.hold = i; b.x = c.x; b.vy = 0; b.grounded = false; this.letGo = 0; this.event = 'grab';
        return true;
      }
    }
    const hw = SURFACE_BOX.halfWidth;
    for (let i = 0; i < geo.solids.length; i++) {
      const s = geo.solids[i];
      if (!s.climb || b.y <= s.y + 20 || b.y - SURFACE_BOX.height >= s.y + s.h) continue;
      const left = Math.abs(b.x + hw - s.x) <= 3, right = Math.abs(b.x - hw - (s.x + s.w)) <= 3;
      if (!left && !right) continue;
      this.mode = 'climb'; this.hold = -1 - i; this.into = left ? 1 : -1; b.vy = 0; b.grounded = false; this.letGo = 0; this.event = 'grab';
      return true;
    }
    return false;
  }

  private tryLedge(b: SurfaceBody, input: MoveInput, geo: SurfaceGeo): boolean {
    const hw = SURFACE_BOX.halfWidth, into = input.dir || 0;
    for (const s of geo.solids) {
      // Hands reach about 150 px above the feet: the lip must sit between the chest and just over the crown.
      const lipAbove = b.y - s.y;
      if (lipAbove < HANG_DROP - 40 || lipAbove > HANG_DROP + 38) continue;
      // +1: the ledge is to the right of the Keeper (who pushes or faces right into it).
      let dir = 0;
      if (Math.abs(b.x + hw - s.x) <= 4 && into >= 0 && (into > 0 || input.facing > 0)) dir = 1;
      else if (Math.abs(b.x - hw - (s.x + s.w)) <= 4 && into <= 0 && (into < 0 || input.facing < 0)) dir = -1;
      if (!dir) continue;
      const lip = dir > 0 ? s.x : s.x + s.w;
      // Room to stand on top.
      if (this.blocked(lip + dir * (hw + 10), s.y, geo)) continue;
      this.mode = 'hang'; this.into = dir; this.lipX = lip; this.lipY = s.y; this.letGo = 0;
      b.x = lip - dir * hw; b.y = s.y + HANG_DROP; b.vy = 0; this.event = 'grab';
      return true;
    }
    return false;
  }

  /** A body standing at (x, feet y) would overlap a solid. */
  private blocked(x: number, y: number, geo: SurfaceGeo): boolean {
    const hw = SURFACE_BOX.halfWidth, h = SURFACE_BOX.height;
    for (const s of geo.solids) if (x + hw > s.x && x - hw < s.x + s.w && y > s.y && y - h < s.y + s.h) return true;
    return false;
  }

  private resolveX(b: SurfaceBody, x0: number, geo: SurfaceGeo): void {
    const hw = SURFACE_BOX.halfWidth, h = SURFACE_BOX.height;
    for (const s of geo.solids) {
      if (!(b.y > s.y + .5 && b.y - h < s.y + s.h)) continue;
      if (!(b.x + hw > s.x && b.x - hw < s.x + s.w)) continue;
      if (x0 + hw <= s.x + .5) { b.x = s.x - hw; this.touchWall(s, 1); }
      else if (x0 - hw >= s.x + s.w - .5) { b.x = s.x + s.w + hw; this.touchWall(s, -1); }
    }
  }
  private touchWall(s: SurfaceSolid, dir: number): void {
    if (s.climb) { this.wallTime = WALL_GRACE; this.wallDir = dir; }
  }

  private resolveY(b: SurfaceBody, y0: number, geo: SurfaceGeo): void {
    const hw = SURFACE_BOX.halfWidth, h = SURFACE_BOX.height;
    for (const s of geo.solids) {
      if (!(b.x + hw > s.x && b.x - hw < s.x + s.w)) continue;
      if (b.vy >= 0 && y0 <= s.y + .5 && b.y >= s.y) { b.y = s.y; b.vy = 0; b.grounded = true; }
      else if (b.vy < 0 && y0 - h >= s.y + s.h - .5 && b.y - h < s.y + s.h) { b.y = s.y + s.h + h; b.vy = 0; }
    }
    if (this.drop > 0) {
      // Dropping through: only the floor (the widest, lowest platform) still catches.
      const floor = geo.platforms[0];
      if (floor && b.vy >= 0 && y0 <= floor.y && b.y >= floor.y) { b.y = floor.y; b.vy = 0; b.grounded = true; }
      return;
    }
    for (const p of geo.platforms) {
      if (b.vy >= 0 && y0 <= p.y && b.y >= p.y && b.x + 16 > p.x && b.x - 16 < p.x + p.width) { b.y = p.y; b.vy = 0; b.grounded = true; }
    }
  }

  private onOneWay(b: SurfaceBody, geo: SurfaceGeo): boolean {
    for (let i = 1; i < geo.platforms.length; i++) {
      const p = geo.platforms[i];
      if (Math.abs(b.y - p.y) < 1 && b.x + 16 > p.x && b.x - 16 < p.x + p.width) return true;
    }
    return false;
  }
}
