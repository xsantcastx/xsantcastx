/**
 * td-party-fx.ts — how a party boss's marks look on the floor (S10; td-party-boss.ts PartyMark). Drawn in the ground
 * pass (drawGroundFx), so the same pixels lie on the isometric floor as on the flat one. Every mark is a few hundred
 * pixels at most (phone-cheap); under reduced motion or Low detail nothing pulses (the mark still shows, steady).
 *
 *  - **fix**: a red stepped ring under the Keeper the boss is fixed on (the threat's pip, on the floor where a phone
 *    reads it), with two chevrons that point at it;
 *  - **brand**: an ember sigil ring under the Branded, its ticks lit for the seconds left;
 *  - **tether**: a dotted line feet to feet — calm while the pair keeps 2–6 tiles, flashing red when too far or too near;
 *  - **cast**: a ring round the boss that fills as it channels (the bar; stun, freeze or hush it before it closes);
 *  - **eye**: the storm's eye, a faint white ring round the arena once phase 3 begins;
 *  - **sunder**: one pip a stack beside the stacked Keeper.
 */
import { MECH, type PartyMark } from './td-party-boss';
import { groundRing, linePixels } from './td-fx';

type Ctx = CanvasRenderingContext2D;
type At = (id: string) => { x: number; y: number } | null;
const T = 16;
const RED = { core: '#ffe0d8', body: '#ff5a4a', edge: '#7a1a14' };
const EMBER = { core: '#fff2a8', body: '#ffb347', edge: '#e2552a' };
const STORM = { core: '#ffffff', body: '#cfe8ff', edge: '#5f86d8' };

function ring(c: Ctx, x: number, y: number, r: number, col: string, every = 1, alpha = 1): void {
  c.globalAlpha = alpha; c.fillStyle = col;
  groundRing(r).forEach((q, i) => { if (i % every === 0) c.fillRect(x + q.x, y + q.y, 1, 1); });
}

/** Draw every mark this screen knows (`fx` from MobSystem.partyFx). `at` finds a Keeper's feet by id ('' this one's). */
export function drawPartyMarks(c: Ctx, fx: readonly (PartyMark & { left: number })[], at: At, time: number, still: boolean): void {
  if (!fx.length) return;
  const beat = still ? 1 : Math.floor(time * 6) % 2 ? 1 : .65;
  c.save();
  for (const f of fx) {
    if (f.m === 'fix' && f.a !== undefined) {
      const p = at(f.a); if (!p) continue;
      const X = Math.round(p.x), Y = Math.round(p.y);
      ring(c, X, Y + 1, 9, RED.edge, 1, .9);
      ring(c, X, Y, 9, RED.body, 2, .9 * beat);
      // Two chevrons either side, pointing in.
      c.globalAlpha = .95; c.fillStyle = RED.body;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.fillRect(X + s * (13 - k), Y - k, 1, 1); c.fillRect(X + s * (13 - k), Y + k, 1, 1); }
    } else if (f.m === 'brand' && f.a !== undefined) {
      const p = at(f.a); if (!p) continue;
      const X = Math.round(p.x), Y = Math.round(p.y), lit = Math.ceil(Math.max(0, f.left) / MECH.brandSecs * 8);
      ring(c, X, Y, 12, EMBER.edge, 1, .8);
      c.globalAlpha = .95 * beat;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, tx = Math.round(X + Math.cos(a) * 12), ty = Math.round(Y + Math.sin(a) * 6);
        c.fillStyle = k < lit ? EMBER.core : EMBER.edge; c.fillRect(tx - 1, ty - 1, 2, 2);
      }
    } else if (f.m === 'tether' && f.a !== undefined && f.b !== undefined) {
      const a = at(f.a), b = at(f.b); if (!a || !b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y) / T, bad = d > MECH.tetherFar - .5 || d < MECH.tetherNear;
      const col = bad ? RED : STORM, line = linePixels(Math.round(a.x), Math.round(a.y - 2), Math.round(b.x), Math.round(b.y - 2));
      c.globalAlpha = bad ? beat : .85;
      line.forEach((q, i) => { if (i % 3 === 2) return; c.fillStyle = i % 3 ? col.body : col.core; c.fillRect(q.x, q.y, 1, 1); });
    } else if (f.m === 'cast' && f.x !== undefined && f.y !== undefined) {
      // The bar: a ring round the boss filling clockwise as the channel runs.
      const X = Math.round(f.x), Y = Math.round(f.y), pts = groundRing(18), done = 1 - Math.max(0, f.left) / Math.max(.1, f.t);
      c.globalAlpha = .9;
      pts.forEach((q, i) => { c.fillStyle = i / pts.length < done ? EMBER.core : EMBER.edge; c.fillRect(X + q.x, Y + q.y, 1, 1); });
    } else if (f.m === 'eye' && f.x !== undefined && f.y !== undefined) {
      ring(c, Math.round(f.x), Math.round(f.y), 10 * T, STORM.body, 3, .35 * beat);
    } else if (f.m === 'sunder' && f.a !== undefined && (f.n ?? 0) > 0) {
      const p = at(f.a); if (!p) continue;
      c.globalAlpha = .95; c.fillStyle = RED.body;
      for (let k = 0; k < (f.n ?? 0); k++) c.fillRect(Math.round(p.x) - 6 + k * 3, Math.round(p.y) + 5, 2, 2);
    }
  }
  c.restore();
}
