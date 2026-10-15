/**
 * terrain-moves.ts — parkour on cells (One World P2, docs/design/one-world.md
 * §2.6): the ledge-grab, the mantle and the wall-jump of surface-body.ts,
 * ported onto the terrain grid so they work everywhere a Keeper walks on
 * cells: the world's surface, the High Roads over the Quarry, the Delve and
 * the realm Delves ("parkour", owner).
 *
 * Pure: no DOM, no Angular; the node harness drives it (scripts/one-world.test.cjs).
 * The engine owns the body and the ordinary step (terrain.ts stepTerrainBody);
 * this module only:
 *
 *  - catches a LIP: airborne near the apex or falling, pushing into a wall, a
 *    solid cell with air above it whose top is between GRAB_LO and GRAB_HI over
 *    the feet (the hands reach just over the crown), with room to hang beside
 *    it and room to stand on it. The Keeper hangs (no gravity);
 *  - from a hang, Jump (or keep pushing in) MANTLES up onto the lip; Down or
 *    pushing away lets go;
 *  - a WALL-JUMP: touching a wall in the air (or within WALL_GRACE of it), Jump
 *    with no direction or away from it kicks off the other way; on a ladder or
 *    a ridge trunk a direction + Jump kicks off that way.
 *
 * Numbers are surface-body's, scaled to the world's Keeper (90 px to the crown
 * against 168 at town scale, take-off 520 against 680): a lip 110–188 px over
 * the feet there is 10–112 px here (the hands catch a lip a little above the
 * feet as well, so a wall a step too tall for a jump is mantled, not refused).
 */
import { boxHits, CELL, type BodyBox, type Terrain, type TerrainBody } from './terrain';

export type TerrainMoveMode = 'free' | 'hang' | 'mantle';
export interface TerrainMoveInput { dir: -1 | 0 | 1; jump: boolean; down: boolean }

/** A lip this far over the feet (px) is within the hands' reach: just above the feet up to just over the crown. */
export const GRAB_LO = 10;
export const GRAB_HI = 112;
/** The feet hang this far under the lip while the hands hold it. */
export const HANG_DROP = 80;
/** Only near the apex or falling: a body still rising faster than this flies past a lip. */
export const GRAB_VY = -260;
export const MANTLE_TIME = .24;
/** Pushing into the lip this long while hanging mantles (a held run does not need a second press). */
export const PUSH_MANTLE = .12;
/** The wall-jump: its take-off and the kick away from the wall (decaying over KICK_TIME). */
export const WALL_JUMP = 490;
export const WALL_KICK = 300;
export const KICK_TIME = .22;
/** After letting go or kicking off, the hands do not catch again for this long. */
export const REGRAB = .3;
/** A wall touched in the air can still be kicked off this long after. */
export const WALL_GRACE = .14;
/** Where the feet land beside the lip after a mantle, past the wall's face. */
const STEP_IN = 6;
const EPS = .02;

/** A lip the hands can hold: its face x (the wall's side the Keeper hangs at) and its top y. */
export interface Lip { col: number; row: number; x: number; y: number; into: -1 | 1 }

/**
 * The lip in front of a body pushing `into` a wall, or null. The body's side
 * must be at the wall's face (within 4 px). Pure.
 */
export function findLip(t: Terrain, b: TerrainBody, box: BodyBox, into: -1 | 1): Lip | null {
  const side = b.x + into * box.halfWidth;
  // A body stops up to a step short of a wall (a blocked step is not taken in part): look a few px past its side.
  const col = into > 0 ? t.colAt(side + 4.5) : t.colAt(side - 4.5);
  const face = into > 0 ? col * CELL : (col + 1) * CELL;
  if (Math.abs(side - face) > 4.5) return null;
  const yHi = b.y - GRAB_HI, yLo = b.y - GRAB_LO;
  for (let row = t.rowAt(yHi); row <= t.rowAt(yLo); row++) {
    const top = t.top + row * CELL;
    if (top < yHi || top > yLo) continue;
    if (!t.solid(col, row) || t.solid(col, row - 1)) continue;
    // Room to stand on it once mantled, and to hang beside it.
    if (boxHits(t, face + into * (box.halfWidth + STEP_IN), top, box)) continue;
    if (boxHits(t, face - into * (box.halfWidth + EPS), top + HANG_DROP, box)) continue;
    return { col, row, x: face, y: top, into };
  }
  return null;
}

/** The body would be pressed against a wall on side `dir` (a solid cell just past its side). Pure. */
export function touchingWall(t: Terrain, b: TerrainBody, box: BodyBox, dir: -1 | 1): boolean {
  return boxHits(t, b.x + dir * 4.5, b.y - 4, box) && !boxHits(t, b.x, b.y - 4, box);
}

export class TerrainMover {
  mode: TerrainMoveMode = 'free';
  /** What the last step or press did (sound, dust, tests). */
  event: 'grab' | 'mantle' | 'walljump' | null = null;
  private into: -1 | 1 = 1;
  private lipX = 0; private lipY = 0;
  private t = 0; private fromX = 0; private fromY = 0;
  private letGo = 0; private regrab = 0;
  private wallTime = 0; private wallDir = 0;
  private kick = 0; private kickTime = 0;

  reset(): void {
    this.mode = 'free'; this.event = null; this.letGo = 0; this.regrab = 0; this.wallTime = 0; this.kick = 0; this.kickTime = 0;
  }
  /** Hanging or mantling: the engine skips its own body step. */
  get busy(): boolean { return this.mode !== 'free'; }
  /** Still flying off a wall-jump: a ladder underneath does not catch the body. */
  get kicking(): boolean { return this.kickTime > 0; }

  /** The horizontal velocity this step, with a wall-kick's push (it fades over KICK_TIME). */
  velocity(vx: number, dt: number): number {
    if (this.kickTime <= 0) return vx;
    this.kickTime -= dt;
    const v = vx * .25 + this.kick;
    this.kick *= Math.exp(-4 * dt);
    return v;
  }

  /**
   * Jump pressed. True when the press was used here (a mantle from a hang, a
   * wall-jump, a kick off a ladder); false is "an ordinary jump" for the
   * engine's coyote/buffer path. `climbing`: the body is on a ladder or trunk.
   */
  pressJump(t: Terrain, b: TerrainBody, box: BodyBox, input: TerrainMoveInput, climbing: boolean): boolean {
    if (this.mode === 'mantle') return true;
    if (this.mode === 'hang') { if (input.dir !== -this.into) this.startMantle(b); return true; }
    if (climbing) {
      // On a ladder or a ridge trunk, a direction + Jump kicks off that way (not into a wall).
      if (input.dir && !boxHits(t, b.x + input.dir * 8, b.y - 4, box)) { this.wallJump(b, input.dir); return true; }
      return false;
    }
    if (!b.grounded && this.wallTime > 0 && input.dir !== this.wallDir) {
      const dir = (input.dir || -this.wallDir) as -1 | 1;
      if (!boxHits(t, b.x + dir * 8, b.y - 4, box)) { this.wallJump(b, dir); return true; }
    }
    return false;
  }

  /** One fixed step while hanging or mantling (the body is moved here, not by the engine). */
  hold(b: TerrainBody, box: BodyBox, input: TerrainMoveInput, dt: number): void {
    this.event = null;
    if (this.mode === 'mantle') {
      this.t += dt;
      const u = Math.min(1, this.t / MANTLE_TIME);
      // Up first, then over the lip: the hands pull the feet level with the lip, and only then do they step in
      // (on cells the corner is solid: stepping in any sooner would put the body inside it).
      const up = Math.min(1, u / .6), over = Math.max(0, (u - .6) / .4);
      b.y = this.fromY + (this.lipY - this.fromY) * (1 - (1 - up) * (1 - up));
      b.x = this.fromX + (this.lipX + this.into * (box.halfWidth + STEP_IN) - this.fromX) * over;
      b.vy = 0; b.grounded = u >= 1;
      if (u >= 1) { this.mode = 'free'; b.y = this.lipY; this.regrab = REGRAB; }
      return;
    }
    if (this.mode !== 'hang') return;
    b.vy = 0; b.grounded = false;
    if (input.down || (input.dir && input.dir === -this.into)) { this.mode = 'free'; this.regrab = REGRAB; return; }
    if (input.dir === this.into) { this.letGo += dt; if (this.letGo > PUSH_MANTLE) this.startMantle(b); }
    else this.letGo = 0;
  }

  /**
   * After the engine's free step: note a wall touched in the air, and catch a
   * lip when pushing into one near the apex or falling.
   */
  after(t: Terrain, b: TerrainBody, box: BodyBox, input: TerrainMoveInput, dt: number): void {
    this.event = null;
    this.regrab = Math.max(0, this.regrab - dt);
    this.wallTime = Math.max(0, this.wallTime - dt);
    if (b.grounded) { this.wallTime = 0; return; }
    const dir = input.dir;
    if (!dir) return;
    if (touchingWall(t, b, box, dir)) { this.wallTime = WALL_GRACE; this.wallDir = dir; }
    if (this.regrab > 0 || b.vy <= GRAB_VY || input.down) return;
    const lip = findLip(t, b, box, dir);
    if (!lip) return;
    this.mode = 'hang'; this.into = lip.into; this.lipX = lip.x; this.lipY = lip.y; this.letGo = 0;
    this.kickTime = 0; this.kick = 0;
    b.x = lip.x - lip.into * (box.halfWidth + EPS); b.y = lip.y + HANG_DROP; b.vy = 0; b.grounded = false;
    this.event = 'grab';
  }

  private startMantle(b: TerrainBody): void {
    this.mode = 'mantle'; this.t = 0; this.fromX = b.x; this.fromY = b.y; this.event = 'mantle';
  }

  private wallJump(b: TerrainBody, dir: -1 | 1): void {
    this.mode = 'free'; b.vy = -WALL_JUMP; b.grounded = false;
    this.kick = dir * WALL_KICK; this.kickTime = KICK_TIME; this.regrab = REGRAB * .5; this.wallTime = 0; this.event = 'walljump';
  }
}
