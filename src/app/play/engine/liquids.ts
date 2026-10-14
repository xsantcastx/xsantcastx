/**
 * liquids.ts — water and lava in the Delve, Terraria-style and cheap. Pure: no
 * DOM, no Angular. The design is docs/world/delve-and-beyond.md §4.
 *
 * Each open cell holds a liquid type and a level 0..8 (`Terrain.liqType`,
 * `liqLevel`; 8 is a full cell, each level 2 art px). The simulation is not
 * per frame: it ticks at 10 Hz on game time, lava only every third tick (it
 * moves at 1/3 speed). Per active cell, bottom-up:
 *
 *   1. fall: as much as fits moves into the cell below, if it is open and
 *      empty or the same liquid; a different liquid there reacts;
 *   2. spread: what could not fall evens out with the left and right
 *      neighbours, moving floor((a − b) / 3) toward the lower one, the scan
 *      direction alternating each tick so nothing drifts one way;
 *   3. settle: a cell whose level has not changed for 2 ticks, with no
 *      neighbour changing either, sleeps (leaves the active set). Any change
 *      wakes its 3 × 3; a dig or a placement wakes the cells round it.
 *
 * At most TICK_BUDGET cells update per tick: a lake draining into a new tunnel
 * takes longer, never costs more. Volume is conserved except at reactions.
 * Every rule here is integer arithmetic in a fixed order, so the same terrain
 * and the same number of ticks give the same water, on any device and across
 * a paused (parked) loop: the clock is game time, which does not run while the
 * engine is parked.
 *
 * Reactions (water + lava): the smaller volume's cell sets into obsidian and
 * the other cell loses that volume. Obsidian is a made cell (`base` differs),
 * so it pays its block and nothing else: no reaction can farm XP or ore.
 * Lava reaching a wooden placed thing (torch, ladder, platform, timber
 * support, chest, camp) asks the host to char it back into the satchel; until
 * then the thing holds the lava back. Nothing is ever destroyed.
 */
import { CELL, LIQUID_FULL, LIQUID_INK, LIQUID_LAVA, LIQUID_WATER, nodeIndex, Terrain, TERRAIN_NODE_LIST } from './terrain';

/** Seconds per liquid tick (10 Hz). */
export const LIQUID_TICK = .1;
/** Lava moves on every third tick only. */
export const LAVA_EVERY = 3;
/** Ink (the Umbral's underside) moves on every second tick: half water's pace. */
export const INK_EVERY = 2;
/** Ink and water never mix: ink is heavier and sinks under it, water rests on it. */
const UNMIXED = (a: number, b: number) => (a === LIQUID_INK && b === LIQUID_WATER) || (a === LIQUID_WATER && b === LIQUID_INK);
/** Most cells one tick updates (the phone budget; spec §3.5). */
export const TICK_BUDGET = 256;
/** Unchanged ticks before a cell sleeps. */
export const SETTLE_TICKS = 2;
/** World px of liquid per level. */
export const LEVEL_PX = CELL / LIQUID_FULL;

const SOLID = Uint8Array.from(TERRAIN_NODE_LIST, node => node.solid ? 1 : 0);
/** Wooden placed things: lava chars them (back to the satchel) instead of flowing in. */
export const WOODEN_IDS: readonly string[] = ['torch', 'ladder', 'platform', 'timber-support', 'chest', 'camp'];
const WOODEN = Uint8Array.from(TERRAIN_NODE_LIST, node => WOODEN_IDS.includes(node.id) ? 1 : 0);
const OBSIDIAN = nodeIndex('obsidian');

/** What the simulation tells its host. All optional: a bare sim (tests) just flows. */
export interface LiquidEvents {
  /** May a reaction set obsidian into this cell? False (the Keeper stands there): the volumes hiss away instead. */
  canSet?(index: number): boolean;
  /** A reaction at `index`: `made` is true when obsidian was set there (the host saves the cell). */
  reacted?(index: number, made: boolean): void;
  /** Lava wants into a wooden placed thing at `index`. The host chars it (or refuses). Repeats are the host's to ignore. */
  char?(index: number): void;
}

export class LiquidSim {
  /** Cell is in the active list (or waiting to join it). */
  private readonly listed: Uint8Array;
  /** Ticks a listed cell has gone unchanged. */
  private readonly calm: Uint8Array;
  /** The tick a cell last changed (neighbours changing count as a change). */
  private readonly stamp: Uint32Array;
  private active: number[] = [];
  private pending: number[] = [];
  private acc = 0;
  /** Ticks run so far (game time / LIQUID_TICK). */
  ticks = 0;
  /** Cells updated by the last tick (the budget's measure). */
  updates = 0;
  /** Liquid changed since the host last saved it (`markSaved`). */
  dirty = false;
  /** A reaction or a bucket happened since the last save: the host saves now, not at the next settle. */
  urgent = false;

  constructor(readonly t: Terrain, private readonly events: LiquidEvents = {}) {
    const n = t.kind.length;
    this.listed = new Uint8Array(n);
    this.calm = new Uint8Array(n);
    this.stamp = new Uint32Array(n);
  }

  /** True when nothing is flowing. */
  get settled(): boolean { return this.active.length === 0 && this.pending.length === 0; }
  /** Cells flowing right now (active or about to be). */
  get awake(): number { return this.active.length + this.pending.length; }

  /** Advance by `dt` seconds of game time: as many 10 Hz ticks as are due (at most 3 per call). Returns ticks run. */
  step(dt: number): number {
    if (!(dt > 0)) return 0;
    this.acc += dt;
    let n = 0;
    while (this.acc >= LIQUID_TICK - 1e-9 && n < 3) { this.tick(); this.acc -= LIQUID_TICK; n++; }
    if (this.acc > LIQUID_TICK * 3) this.acc = 0;
    return n;
  }

  /** Wake a cell holding liquid (it rejoins the active set). */
  wake(index: number): void {
    if (index < 0 || index >= this.listed.length || !this.t.liqLevel[index]) return;
    this.calm[index] = 0;
    if (!this.listed[index]) { this.listed[index] = 1; this.pending.push(index); }
  }
  /** Wake the 3 × 3 round a cell (a dig, a placement, a reaction). */
  wakeAround(col: number, row: number): void {
    const t = this.t;
    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= t.rows) continue;
      for (let c = col - 1; c <= col + 1; c++) if (t.inside(c, r)) this.wake(t.index(c, r));
    }
  }
  /** Wake every cell that holds liquid: after a load, so saved water finds any tunnel dug since it settled. */
  wakeAll(): void {
    const level = this.t.liqLevel;
    for (let i = 0; i < level.length; i++) if (level[i]) this.wake(i);
  }
  /**
   * The endless Delve: world columns [col0, col1) left the ring (or are about
   * to be reused). Their cells drop out of the flow; nothing about them is
   * kept here (the world saved their liquid). Then `wakeColumns` for arrivals.
   */
  forgetColumns(col0: number, col1: number): void {
    const t = this.t;
    for (let c = col0; c < col1; c++) for (let r = 0; r < t.rows; r++) {
      const i = t.index(c, r);
      this.listed[i] = 0; this.calm[i] = 0; this.stamp[i] = 0;
    }
    this.active = this.active.filter(i => this.listed[i]);
    this.pending = this.pending.filter(i => this.listed[i]);
  }
  /** Wake every liquid cell in world columns [col0, col1) (a column arrived; its edge meets new neighbours). */
  wakeColumns(col0: number, col1: number): void {
    const t = this.t;
    for (let c = col0; c < col1; c++) for (let r = 0; r < t.rows; r++) if (t.inside(c, r)) this.wake(t.index(c, r));
  }
  /** The host saved the liquid as it is now. */
  markSaved(): void { this.dirty = false; this.urgent = false; }

  /** Total level of one liquid type over the grid (the conservation check). */
  volume(type: number): number {
    let sum = 0;
    const kind = this.t.liqType, level = this.t.liqLevel;
    for (let i = 0; i < level.length; i++) if (kind[i] === type) sum += level[i];
    return sum;
  }

  /** One 10 Hz tick. */
  tick(): void {
    const t = this.t, cols = t.cols;
    this.ticks++;
    const tick = this.ticks;
    const lavaTurn = tick % LAVA_EVERY === 0, inkTurn = tick % INK_EVERY === 0;
    const dir = tick & 1 ? 1 : -1;
    // Bottom-up, and along each row in this tick's direction.
    const list = this.active;
    list.sort((a, b) => {
      const ra = (a / cols) | 0, rb = (b / cols) | 0;
      if (ra !== rb) return rb - ra;
      // World column order (a ring's slots wrap): the same water flows the same way wherever the ring sits.
      const ca = t.colOf(a), cb = t.colOf(b);
      return dir > 0 ? ca - cb : cb - ca;
    });
    const next: number[] = [];
    let updates = 0;
    for (const i of list) {
      const level = t.liqLevel[i];
      if (!level || SOLID[t.kind[i]]) { this.listed[i] = 0; this.calm[i] = 0; if (level) { t.liqLevel[i] = 0; t.liqType[i] = 0; } continue; }
      // Over budget, or lava between its turns: waits, unchanged, for a later tick.
      if (updates >= TICK_BUDGET || (t.liqType[i] === LIQUID_LAVA && !lavaTurn) || (t.liqType[i] === LIQUID_INK && !inkTurn)) { next.push(i); continue; }
      updates++;
      this.flow(i, dir);
      if (this.stamp[i] === tick) { this.calm[i] = 0; next.push(i); continue; }
      if (++this.calm[i] >= SETTLE_TICKS) { this.listed[i] = 0; this.calm[i] = 0; } else next.push(i);
    }
    for (const i of this.pending) next.push(i);
    this.pending = [];
    this.active = next;
    this.updates = updates;
  }

  /** May liquid of `type` enter cell `j`? Lava asks to char a wooden thing instead. */
  private open(j: number, type: number): boolean {
    const kind = this.t.kind[j];
    if (SOLID[kind]) return false;
    if (type === LIQUID_LAVA && WOODEN[kind]) { this.events.char?.(j); return false; }
    return true;
  }

  private set(i: number, type: number, level: number): void {
    const t = this.t;
    if (!level) type = 0;
    if (t.liqType[i] === type && t.liqLevel[i] === level) return;
    t.liqType[i] = type; t.liqLevel[i] = level;
    t.liquidRev++;
    this.dirty = true;
    const col = t.colOf(i), row = t.rowOf(i);
    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= t.rows) continue;
      for (let c = col - 1; c <= col + 1; c++) {
        if (!t.inside(c, r)) continue;
        const j = t.index(c, r);
        this.stamp[j] = this.ticks;
        this.wake(j);
      }
    }
  }

  private flow(i: number, dir: number): void {
    const t = this.t, cols = t.cols;
    const type = t.liqType[i];
    let level = t.liqLevel[i];
    const col = t.colOf(i), row = t.rowOf(i);
    // 1. Fall.
    if (row + 1 < t.rows) {
      const below = i + cols;
      if (this.open(below, type)) {
        const bt = t.liqType[below], bl = t.liqLevel[below];
        if (bl && bt !== type && UNMIXED(type, bt)) {
          // Ink sinks under water (the two trade places); water rests on ink.
          if (type === LIQUID_INK) { this.set(below, type, level); this.set(i, bt, bl); return; }
        }
        else if (bl && bt !== type) { this.react(i, below); level = t.liqLevel[i]; }
        else {
          const move = Math.min(level, LIQUID_FULL - bl);
          if (move > 0) { this.set(below, type, bl + move); level -= move; this.set(i, type, level); }
        }
      }
    }
    if (!level || t.liqType[i] !== type) return;
    // 2. Spread: this tick's side first.
    for (let s = 0; s < 2 && level > 0; s++) {
      const c = col + (s === 0 ? dir : -dir);
      // Past the loaded span is rock to the flow (a ring's edge: the world beyond is frozen).
      if (!t.inside(c, row)) continue;
      const j = t.index(c, row);
      if (!this.open(j, type)) continue;
      const nt = t.liqType[j], nl = t.liqLevel[j];
      if (nl && nt !== type && UNMIXED(type, nt)) continue;
      if (nl && nt !== type) { this.react(i, j); level = t.liqLevel[i]; continue; }
      const move = Math.floor((level - nl) / 3);
      if (move > 0) { this.set(j, type, nl + move); level -= move; this.set(i, type, level); }
    }
  }

  /**
   * Water meets lava between cells `a` and `b`: the smaller volume's cell
   * becomes obsidian (a tie: `b`, where the flow arrived) and the other loses
   * that volume. If obsidian may not go there, both volumes hiss away.
   */
  private react(a: number, b: number): void {
    const t = this.t;
    const la = t.liqLevel[a], lb = t.liqLevel[b];
    const small = Math.min(la, lb);
    const target = la < lb ? a : b, other = target === a ? b : a;
    const made = this.events.canSet?.(target) !== false;
    this.set(other, t.liqType[other], t.liqLevel[other] - small);
    this.set(target, 0, 0);
    if (made) {
      const col = t.colOf(target), row = t.rowOf(target);
      t.set(col, row, OBSIDIAN);
      this.wakeAround(col, row);
    }
    this.urgent = true;
    this.events.reacted?.(target, made);
  }

  // ── Buckets ───────────────────────────────────────────────────────────────

  /**
   * Scoop one full cell of the liquid at `index` into a bucket: a full cell's
   * worth taken from it and, if it holds less, from the same liquid joined to
   * it (nearest first, within 3 cells). Returns the liquid type scooped, or 0
   * (and nothing taken) when there is not a full cell's worth. `dry`: only check.
   */
  scoop(index: number, dry = false): number {
    const t = this.t;
    const type = t.liqLevel[index] ? t.liqType[index] : 0;
    if (!type) return 0;
    const cols = t.cols, c0 = t.colOf(index), r0 = t.rowOf(index);
    // Breadth-first over joined cells of the same liquid, deterministic order.
    const seen = new Set<number>([index]);
    const order = [index];
    for (let q = 0; q < order.length; q++) {
      const i = order[q], c = t.colOf(i), r = t.rowOf(i);
      for (const [dc, dr] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
        const nc = c + dc, nr = r + dr;
        if (!t.inside(nc, nr) || Math.abs(nc - c0) > 3 || Math.abs(nr - r0) > 3) continue;
        const j = t.index(nc, nr);
        if (seen.has(j) || !t.liqLevel[j] || t.liqType[j] !== type) continue;
        seen.add(j); order.push(j);
      }
    }
    let have = 0;
    for (const i of order) have += t.liqLevel[i];
    if (have < LIQUID_FULL) return 0;
    if (dry) return type;
    let need = LIQUID_FULL;
    // Take from the surface down (top rows first), so a scooped pool lowers evenly.
    const byHeight = [...order].sort((a, b) => ((a / cols) | 0) - ((b / cols) | 0) || t.colOf(a) - t.colOf(b));
    for (const i of byHeight) {
      if (!need) break;
      const take = Math.min(need, t.liqLevel[i]);
      this.set(i, type, t.liqLevel[i] - take);
      need -= take;
    }
    this.urgent = true;
    return type;
  }

  /**
   * Pour a full cell of `type` into open cell `index`. Into the same liquid it
   * tops the cell up and the rest goes into the cell above. Onto the other
   * liquid it reacts: that cell sets into obsidian and the rest of the pour
   * lands above. False (nothing poured) when the cell is rock, or the pour
   * would not fit.
   */
  pour(index: number, type: number, dry = false): boolean {
    const t = this.t;
    if (type !== LIQUID_WATER && type !== LIQUID_LAVA) return false;
    if (index < 0 || index >= t.kind.length || SOLID[t.kind[index]]) return false;
    if (type === LIQUID_LAVA && WOODEN[t.kind[index]]) return false;
    const cols = t.cols, col = t.colOf(index), row = t.rowOf(index);
    const above = row > 0 ? index - cols : -1;
    const roomAbove = (liquid: number) => above >= 0 && !SOLID[t.kind[above]] && !(liquid === LIQUID_LAVA && WOODEN[t.kind[above]])
      && (!t.liqLevel[above] || t.liqType[above] === liquid) ? LIQUID_FULL - t.liqLevel[above] : 0;
    const here = t.liqLevel[index], hereType = t.liqType[index];
    if (here && hereType !== type) {
      // Onto the other liquid: it sets (it can hold at most a full cell, the pour is a full cell).
      const rest = LIQUID_FULL - here;
      if (this.events.canSet?.(index) === false) return false;
      if (dry) return true;
      this.set(index, 0, 0);
      t.set(col, row, OBSIDIAN);
      this.wakeAround(col, row);
      if (rest > 0 && roomAbove(type) >= rest) this.set(above, type, t.liqLevel[above] + rest);
      this.urgent = true;
      this.events.reacted?.(index, true);
      return true;
    }
    const fit = LIQUID_FULL - here;
    const spill = LIQUID_FULL - fit;
    if (spill > 0 && roomAbove(type) < spill) return false;
    if (dry) return true;
    this.set(index, type, here + fit);
    if (spill > 0) this.set(above, type, t.liqLevel[above] + spill);
    this.urgent = true;
    return true;
  }
}

/** The world y of the liquid's surface in a cell holding `level`. */
export function surfaceY(t: Terrain, row: number, level: number): number {
  return t.top + (row + 1) * CELL - level * LEVEL_PX;
}

/** The liquid type at a world point (under the surface of its cell), or 0. Pure. */
export function liquidAtPoint(t: Terrain, x: number, y: number): number {
  const col = t.colAt(x), row = t.rowAt(y);
  if (row < 0 || !t.inside(col, row)) return 0;
  const i = t.index(col, row), level = t.liqLevel[i];
  return level && y >= surfaceY(t, row, level) ? t.liqType[i] : 0;
}

/**
 * How the Keeper sits in liquid, for the physics and the HUD. `body`: the
 * liquid round the body's middle or feet (it swims or wades); `head`: the
 * liquid over the head (it is holding its breath). Pure.
 */
export function immersion(t: Terrain, x: number, feetY: number, height: number): { body: number; head: number; feet: number } {
  const feet = liquidAtPoint(t, x, feetY - 2);
  const mid = liquidAtPoint(t, x, feetY - height * .45);
  const head = liquidAtPoint(t, x, feetY - height * .9);
  return { feet, body: mid || feet, head };
}

/** Swim physics per liquid: walk-speed share, gravity share, slowest sink (px/s), swim-up pace. Spec §4.1: water ×0.6. */
export const SWIM: Readonly<Record<number, { speed: number; gravity: number; terminal: number; rise: number }>> = {
  [LIQUID_WATER]: { speed: .6, gravity: .32, terminal: 150, rise: 230 },
  [LIQUID_LAVA]: { speed: .45, gravity: .4, terminal: 120, rise: 170 },
  // Ink is thick and heavy: slow to wade, slow to rise out of.
  [LIQUID_INK]: { speed: .5, gravity: .42, terminal: 140, rise: 190 },
};
