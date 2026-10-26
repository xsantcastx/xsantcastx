/**
 * td-ashguard-fx.ts — the Ashguard's pictures (docs/design/effects-spec.md, "The Ashguard" section).
 *
 * The same rules as every effect: whole art pixels, three tones per element (core · body · edge), ground under the
 * creatures and air over them at ≤ 60% where it covers a body, nothing past a second but the states that last, and a
 * still frame under reduced motion — never no picture. Two new palettes join the kit: **brass** (the Pyre Watch's oaths:
 * the shield, the cry, the vow) and **ash** (the stride's afterimages); the blade's fire is the shipped ember.
 *
 * The engine calls three things: `drawAshGround` (the cry's ring, the watchfire's floor), `drawAshAir` (a blade's arc,
 * the brand catching, a bash, an oath, a stride, the vow's bell) and `drawAshState` (what lasts: the burning blade, the
 * oath's rim, the vow's brass corners, stun stars and taunt marks over creatures).
 */
import { mobCell } from './td-mobs';
import { FX, burst, circlePixels, drawBurst, drawRing, glowSquare, type Tones } from './td-fx';

type Ctx = CanvasRenderingContext2D;

/** The Pyre Watch's brass and the stride's ash (effects-spec rule 2). */
export const ASH_FX: Readonly<Record<'brass' | 'ash', Tones>> = {
  brass: { core: '#fff2c8', body: '#e0b25a', edge: '#8a6a2a' },
  ash: { core: '#efe6dc', body: '#a89a90', edge: '#5e5450' },
};

/** The effect kinds this file draws. */
const KINDS = new Set(['arc', 'brand', 'bash', 'oath', 'cry', 'stride', 'vow']);
export function isAshFx(kind: string): boolean { return KINDS.has(kind); }

interface FxLike { kind: string; x: number; y: number; age: number; life: number; dir: number; tx?: number; ty?: number; el?: string; r?: number; a?: number; w?: number }

/** How far round a gap is (0..π). */
function gap(a: number, b: number): number { return Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); }

/** Ground: the Watch Cry's ring of brass dashes running out to its reach. Returns whether it drew (or owns) the kind. */
export function drawAshGround(c: Ctx, e: FxLike, still: boolean): boolean {
  if (e.kind !== 'cry') return false;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), R = e.r ?? 64, tn = ASH_FX.brass;
  const k = still ? 1 : 1 - (1 - t) * (1 - t), r = Math.max(4, Math.round(8 + (R - 8) * k));
  c.globalAlpha = still ? .9 : Math.max(0, 1 - t * .7);
  drawRing(c, X, Y, r, still ? 0 : t, tn.core, tn.body, 8, 4, tn.edge);
  c.globalAlpha *= .6;
  drawRing(c, X, Y, Math.max(2, r - 4), still ? .5 : -t, tn.body, tn.edge, 10, 4);
  c.globalAlpha = 1;
  return true;
}

/** Air: the pictures that live a moment. Returns whether the kind is the Ashguard's (the engine then skips it). */
export function drawAshAir(c: Ctx, e: FxLike, still: boolean, overFoe: (x: number, y: number) => boolean): boolean {
  if (!isAshFx(e.kind)) return false;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), bt = still ? .5 : t, seed = (X * 7 + Y * 13) | 0;
  const fade = still ? 1 : Math.max(0, 1 - t);
  const dot = (x: number, y: number, col: string, a = 1, w = 1, h = 1) => {
    c.globalAlpha = overFoe(x, y) ? Math.min(.6, a * fade) : a * fade; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  if (e.kind === 'arc') {
    // The blade's crescent: it sweeps across the arc in the first 60% of its life, white-hot at the leading edge, then
    // thins away. Ember when the blade burns (or the blow is fire), brass for a plain swing.
    const tn = e.el === 'ember' ? FX.ember : ASH_FX.brass, R = Math.max(8, e.r ?? 24), w = (e.w ?? 110) * Math.PI / 180;
    const full = w >= Math.PI * 2 - .01, aim = e.a ?? 0, start = aim - w / 2;
    const k = still ? 1 : Math.min(1, t / .6), lead = start + w * k;
    for (let ring = 0; ring < 3; ring++) {
      const r = R - ring * 2, tone = ring === 0 ? tn.core : ring === 1 ? tn.body : tn.edge;
      for (const q of circlePixels(r)) {
        const qa = Math.atan2(q.y, q.x);
        if (full ? (gap(qa, aim) > Math.PI * k) : (gap(qa, aim) > w / 2 || gap(qa, start) > w * k + .02)) continue;
        if (ring === 2 && (q.x + q.y) % 2) continue;
        dot(X + q.x, Y + q.y, tone, ring === 0 ? .95 : .8);
      }
    }
    if (!full && k < 1) for (let i = 0; i < 3; i++) dot(X + Math.cos(lead) * (R - i * 3), Y + Math.sin(lead) * (R - i * 3), '#ffffff', 1, 2, 2);
  } else if (e.kind === 'brand') {
    // The brand catching: an ember burst at the blade's hand and a short column of fire up the steel.
    glowSquare(c, X, Y, 3, FX.ember, .6 * fade);
    c.globalAlpha = fade; drawBurst(c, X, Y, burst(9, bt, seed, 10, 6), FX.ember);
    for (let i = 0; i < 4; i++) dot(X - 1 + (i % 2), Y - 4 - i * 3 - Math.round(bt * 6), i % 2 ? FX.ember.core : FX.ember.body, .9, 2, 2);
  } else if (e.kind === 'bash') {
    // The shield landing: a brass flash, a burst thrown back off the struck side, three short impact lines.
    glowSquare(c, X, Y, 4, ASH_FX.brass, .55 * fade);
    c.globalAlpha = fade * .9; drawBurst(c, X, Y, burst(8, bt, seed, 9, 5), ASH_FX.brass);
    for (let i = -1; i <= 1; i++) for (let j = 0; j < 3; j++) dot(X - e.dir * (6 + j * 2 + bt * 6), Y + i * 4, ASH_FX.brass.core, .9);
  } else if (e.kind === 'oath') {
    // The oath sworn (or a blow turned aside, dir 2): a brass square rim springs out round the Keeper.
    const k = still ? 1 : 1 - (1 - t) * (1 - t), hw = Math.round(8 + 4 * k), hh = Math.round(12 + 6 * k);
    for (let x = -hw; x <= hw; x++) { if (x % 2) continue; dot(X + x, Y - hh, ASH_FX.brass.body); dot(X + x, Y + hh, ASH_FX.brass.body); }
    for (let y = -hh; y <= hh; y++) { if (y % 2) continue; dot(X - hw, Y + y, ASH_FX.brass.body); dot(X + hw, Y + y, ASH_FX.brass.body); }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) dot(X + sx * hw - (sx > 0 ? 1 : 0), Y + sy * hh - (sy > 0 ? 1 : 0), ASH_FX.brass.core, 1, 2, 2);
    if (e.dir === 2) { c.globalAlpha = fade; drawBurst(c, X + 10, Y, burst(6, bt, seed, 6, 3), ASH_FX.brass); }
  } else if (e.kind === 'stride') {
    // Ash Stride: three afterimages in ash grey along the charge, fading back to where it began, dust at the start.
    const sx = e.tx ?? X, sy = e.ty ?? Y;
    for (let i = 1; i <= 3; i++) {
      const k = i / 4, ax = Math.round(sx + (X - sx) * k), ay = Math.round(sy + (Y - sy) * k), a = (.25 + .2 * i) * (still ? .8 : 1);
      dot(ax - 3, ay - 18, ASH_FX.ash.edge, a, 6, 16); dot(ax - 2, ay - 22, ASH_FX.ash.body, a, 4, 5); dot(ax - 2, ay - 16, ASH_FX.ash.body, a, 4, 12);
      dot(ax - 1, ay - 15, ASH_FX.ash.core, a * .8, 1, 8);
    }
    c.globalAlpha = fade; drawBurst(c, sx, sy, burst(6, bt, seed, 7, 2), ASH_FX.ash);
  } else if (e.kind === 'vow') {
    // The vow: a brass bell over the Keeper's head tolls once (it swings), a ring of brass at his feet.
    const sw = still ? 0 : Math.round(Math.sin(t * Math.PI * 4) * 2 * (1 - t));
    const bx = X + sw;
    dot(bx - 1, Y - 6, ASH_FX.brass.edge, 1, 2, 1);
    dot(bx - 2, Y - 5, ASH_FX.brass.body, 1, 4, 2); dot(bx - 3, Y - 3, ASH_FX.brass.body, 1, 6, 3); dot(bx - 4, Y, ASH_FX.brass.edge, 1, 8, 1);
    dot(bx - 2, Y - 4, ASH_FX.brass.core, 1, 1, 3); dot(bx, Y + 1, ASH_FX.ash.edge, 1, 1, 1);
    if (!still && t < .6) { c.globalAlpha = 1 - t / .6; drawRing(c, X, Y + 30, Math.round(6 + 14 * t), 0, ASH_FX.brass.core, ASH_FX.brass.body, 6, 4); }
  }
  c.globalAlpha = 1;
  return true;
}

/** What the engine knows of the fight for the lasting pictures. */
export interface AshState {
  brandT: number; blockT: number; vowT: number;
  mobs: readonly { x: number; y: number; stun?: number; taunt?: number; def: { h: number } }[];
}

/**
 * What lasts while it holds: the blade burning (embers climbing the steel at the Keeper's hand), the Shield Oath's rim
 * (a dashed brass frame round him), the Vow's brass corners, the stun stars and the taunt's "!" over creatures.
 */
export function drawAshState(c: Ctx, s: AshState, p: { x: number; y: number; face: number }, time: number, still: boolean): void {
  const X = Math.round(p.x), Y = Math.round(p.y);
  if (s.brandT > 0) {
    for (let i = 0; i < 3; i++) {
      const k = still ? i / 3 : (time * 1.6 + i / 3) % 1, hx = X + p.face * 9 + Math.round(Math.sin(time * 7 + i) * (still ? 0 : 1));
      c.globalAlpha = .9 * (1 - k); c.fillStyle = [FX.ember.core, FX.ember.body, FX.ember.edge][i];
      c.fillRect(hx, Math.round(Y - 14 - k * 14), 1 + (i === 0 ? 1 : 0), 2);
    }
  }
  if (s.blockT > 0) {
    // Dashes running round the rim, slowly.
    const off = still ? 0 : Math.floor(time * 6) % 4, hw = 11, hh = 17, cy = Y - 15;
    c.globalAlpha = .7;
    for (let x = -hw; x <= hw; x++) if ((x + off) % 4 < 2) { c.fillStyle = ASH_FX.brass.body; c.fillRect(X + x, cy - hh, 1, 1); c.fillRect(X - x, cy + hh, 1, 1); }
    for (let y = -hh; y <= hh; y++) if ((y + off) % 4 < 2) { c.fillStyle = ASH_FX.brass.edge; c.fillRect(X - hw, cy - y, 1, 1); c.fillRect(X + hw, cy + y, 1, 1); }
  }
  if (s.vowT > 0) {
    // Brass corners that stay (the bible: "the outline goes brass and stays"), brightening as the vow runs out.
    const glow = still ? 1 : .7 + .3 * Math.sin(time * 5);
    c.globalAlpha = glow; c.fillStyle = ASH_FX.brass.core;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const cx = X + sx * 9, cy = Y - 15 + sy * 15;
      c.fillRect(cx - (sx > 0 ? 2 : 0), cy, 3, 1); c.fillRect(cx, cy - (sy > 0 ? 2 : 0), 1, 3);
    }
  }
  for (const m of s.mobs) {
    const top = Math.round(m.y - mobCell(m.def).h - 6), mx = Math.round(m.x);
    if ((m.stun ?? 0) > 0) {
      // Three brass stars circling over its head (a CC pip, design-bible §4.7).
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + (still ? 0 : time * 4), sx = Math.round(mx + Math.cos(a) * 6), sy = Math.round(top + Math.sin(a) * 2);
        c.globalAlpha = .9; c.fillStyle = ASH_FX.brass.core; c.fillRect(sx, sy, 1, 1);
        c.fillStyle = ASH_FX.brass.body; c.fillRect(sx - 1, sy, 1, 1); c.fillRect(sx + 1, sy, 1, 1); c.fillRect(sx, sy - 1, 1, 1); c.fillRect(sx, sy + 1, 1, 1);
      }
    } else if ((m.taunt ?? 0) > 0) {
      // A pixel "!" in brass, edged in the hostile dark so it reads on any ground.
      c.globalAlpha = .95; c.fillStyle = '#140c1c'; c.fillRect(mx - 2, top - 7, 4, 6); c.fillRect(mx - 2, top, 4, 3);
      c.fillStyle = ASH_FX.brass.core; c.fillRect(mx - 1, top - 6, 2, 4); c.fillRect(mx - 1, top + 1, 2, 1);
    }
  }
  c.globalAlpha = 1;
}
