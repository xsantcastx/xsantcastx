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
import type { DeathBurst } from './td-mobs';
import { groundRing, linePixels } from './td-fx';

type Ctx = CanvasRenderingContext2D;
type At = (id: string) => { x: number; y: number } | null;
const T = 16;
const RED = { core: '#ffe0d8', body: '#ff5a4a', edge: '#7a1a14' };
const RED_HIT = { core: '#ffd0a0', body: '#ff4a1a', edge: '#c02a10' };
const EMBER = { core: '#fff2a8', body: '#ffb347', edge: '#e2552a' };
const STORM = { core: '#ffffff', body: '#8fd0ff', edge: '#3a6ad0' };
const GOLD = { core: '#fff6c8', body: '#ffd25a', edge: '#b0812a' };
/** The dark 2-px outline every party ring and line wears (it reads on rain, moss and water alike). */
const DARK = '#140c1c';
/** How high over a Keeper's feet the pips over his head sit (world px; the chibi figure's top). */
export const PARTY_HEAD = 46;

/**
 * A party boss's ring (td-party-boss PartyRingKind, the burst's `el`): `pbhit` a blow to step out of — saturated red
 * over orange, a 25% fill growing from the middle over the tell; `pbsoak` one to step into — gold, filled from the start;
 * `pbspread` the ring on each Keeper — storm blue. A 2-px dark outline on every one. Low / reduced motion: no pulse.
 */
export function drawPartyRing(c: Ctx, b: DeathBurst, time: number, still: boolean): void {
  const tn = b.el === 'pbsoak' ? GOLD : b.el === 'pbspread' ? STORM : RED_HIT, X = Math.round(b.x), Y = Math.round(b.y) - 1, R = Math.max(4, Math.round(b.r));
  const k = Math.max(0, Math.min(1, 1 - b.t / (b.delay ?? .6))), pulse = still ? 1 : .8 + .2 * Math.sin(time * 18);
  const pts = groundRing(R), ry = Math.max(1, ...pts.map(q => Math.abs(q.y)));
  // The fill: grows from the middle as the tell runs (a soak's is whole: step in).
  const f = b.el === 'pbsoak' ? 1 : Math.max(.15, k);
  c.globalAlpha = .25; c.fillStyle = tn.body;
  c.beginPath(); c.ellipse(X, Y, R * f, ry * f, 0, 0, Math.PI * 2); c.fill();
  // The 2-px dark outline, then the ring.
  c.globalAlpha = .9; c.fillStyle = DARK;
  for (const r of [R + 1, R + 2]) for (const q of groundRing(r)) c.fillRect(X + q.x, Y + q.y, 1, 1);
  c.globalAlpha = pulse;
  pts.forEach((q, i) => { c.fillStyle = i % 4 ? tn.body : tn.core; c.fillRect(X + q.x, Y + q.y, 1, 1); });
  for (const q of groundRing(R - 1)) { c.fillStyle = tn.edge; c.fillRect(X + q.x, Y + q.y, 1, 1); }
  c.globalAlpha = 1;
}
/** Over the head: a red down-arrow on the one it is fixed on; an ember brand sigil on the Branded. */
export function drawHeadPip(c: Ctx, x: number, y: number, m: 'fix' | 'brand', time: number, still: boolean): void {
  const X = Math.round(x), Y = Math.round(y) - (still ? 0 : Math.round(Math.sin(time * 4)));
  const tn = m === 'fix' ? RED_HIT : EMBER;
  c.globalAlpha = 1; c.fillStyle = DARK;
  c.fillRect(X - 5, Y - 6, 11, 5); c.fillRect(X - 3, Y - 1, 7, 2); c.fillRect(X - 1, Y + 1, 3, 2);
  c.fillStyle = tn.body;
  c.fillRect(X - 4, Y - 5, 9, 3); c.fillRect(X - 2, Y - 2, 5, 2); c.fillRect(X, Y, 1, 2);
  c.fillStyle = tn.core; c.fillRect(X - 1, Y - 5, 3, 1);
  if (m === 'brand') { c.fillStyle = DARK; c.fillRect(X, Y - 5, 1, 3); }
}

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
      c.globalAlpha = .9; c.fillStyle = DARK;
      for (const q of line) c.fillRect(q.x - 1, q.y - 1, 4, 4);
      c.globalAlpha = bad ? beat : 1;
      line.forEach((q, i) => { c.fillStyle = i % 4 === 0 ? col.core : col.body; c.fillRect(q.x, q.y, 2, 2); });
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
