/**
 * td-hd-pets.ts — the nine pets and Glim for isometric B, at the HD pixel (td-hd-rig.ts poses them, td-hd-sculpt.ts
 * paints them). Chibi, like td-pet-art's: a big round head, big eyes with a white shine, a small soft body, about half
 * the Keeper's height, so a pet reads as his and never as a foe. Cozy, never dark.
 *
 * A pet's frames (td-pet-art TD_PET_FRAMES) map onto the rig's clips: walk0..3 → walk 0..3; sit0, sit1 → idle 0, 1
 * (tail one way, then the other, a look back); sleep → idle 2 (curled up); happy → idle 3 (a hop, eyes smiling).
 */
import type { Rig, V3 } from './td-hd-rig';
import { add } from './td-hd-rig';
import { mix, rampOf, type Mat } from './td-hd-sculpt';
import type { HdModel, Pose } from './td-hd-creatures';

const TAU = Math.PI * 2;
const mat = (base: string, o: { cool?: string; warm?: string; deep?: number; hi?: number } = {}, x: Partial<Mat> = {}): Mat => ({ ramp: rampOf(base, { deep: .5, hi: .5, ...o }), round: 6, gain: .95, ...x });
const glow = (r: string[]): Mat => ({ ramp: r, round: 3, gain: .4, soft: true });
const P = {
  ink: mat('#4f58a0', { cool: '#10123a', warm: '#e8ecff' }), inkDk: mat('#343b78', { cool: '#0a0c26', warm: '#c8d0ff' }),
  shade: mat('#5e4284', { cool: '#140a26', warm: '#f0e0ff' }), shadeDk: mat('#3e2c5a', { cool: '#0a0614', warm: '#d0c0f0' }),
  pink: mat('#e89aa8', { cool: '#5a2a3a', warm: '#fff0f4' }, { round: 2 }),
  rust: mat('#e8804a', { cool: '#3a1208', warm: '#fff0d0' }), iron: mat('#8c8698', { cool: '#1a1822', warm: '#ffffff' }, { shine: true, round: 3 }),
  moss: mat('#6eae52', { cool: '#0c2a0c', warm: '#f0ffd8' }, { round: 3 }), tan: mat('#e8b888', { cool: '#4a2a18', warm: '#fffaf0' }),
  newt: mat('#ec6a3a', { cool: '#3a0a08', warm: '#fff0c8' }), newtDk: mat('#b04224', { cool: '#2a0604', warm: '#ffd0b0' }),
  owl: mat('#6c7ac8', { cool: '#141a48', warm: '#f0f4ff' }), owlDk: mat('#46519a', { cool: '#0c1030', warm: '#d0d8ff' }),
  cream: mat('#f4e6c8', { cool: '#5a4a30', warm: '#ffffff' }), moth: mat('#f2ecfa', { cool: '#5a4a7a', warm: '#ffffff' }),
  wingA: mat('#a8e4ff', { cool: '#1a3a6a', warm: '#ffffff' }, { round: 1.5, gain: .7 }), wingB: mat('#ffb8e4', { cool: '#4a1a40', warm: '#ffffff' }, { round: 1.5, gain: .7 }),
  sun: glow(['#a86414', '#e8a030', '#ffc848', '#ffd860', '#ffeca0', '#fffbd0']), ray: glow(['#a8641a', '#e89a2a', '#ffc84a', '#ffdc78', '#fff4a8', '#fffbe0']),
  spirit: mat('#4cb898', { cool: '#0a3a30', warm: '#f0fff8' }), spiritDk: mat('#2a7a64', { cool: '#06221c', warm: '#c0f0e0' }),
  ember: glow(['#9e2e1c', '#e2552a', '#ff8a3a', '#ffb347', '#ffd870', '#fff2a8']),
  rootglow: glow(['#17604e', '#2fb38a', '#4cd0a0', '#7affd0', '#b0ffe8', '#eafff6']),
  violet: glow(['#5a2e8a', '#8a52c8', '#a878e8', '#c88bff', '#e0c0ff', '#f0e0ff']),
  white: mat('#f8f4ee', { cool: '#5a5060', warm: '#ffffff' }, { round: 3 }),
};
const INK = '#1a1020', SHINE = '#ffffff', CHEEK = '#ff9fb0', MOUTH = '#5a2030';

type Mode = 'walk' | 'sit' | 'sleep' | 'happy';
interface Q { mode: Mode; f: number; ph: number; bob: number; wag: number; look: number; eyes: 'open' | 'shut' | 'smile' }
function q(p: Pose): Q {
  if (p.anim === 'walk') { const f = p.f % 4; return { mode: 'walk', f, ph: f / 4 * TAU, bob: [0, 1.5, 0, 1.5][f], wag: [0, 1, 0, -1][f], look: 0, eyes: 'open' }; }
  const f = p.f % 4;
  if (f === 2) return { mode: 'sleep', f, ph: 0, bob: 0, wag: 0, look: 0, eyes: 'shut' };
  if (f === 3) return { mode: 'happy', f, ph: 0, bob: 6, wag: 1, look: 0, eyes: 'smile' };
  return { mode: 'sit', f, ph: 0, bob: 0, wag: f ? -1 : 1, look: f ? .5 : 0, eyes: 'open' };
}

/** Big chibi eyes on a head ball (centre h, radius R): a dark oval, a white glint, the cheeks. */
function face(r: Rig, h: V3, R: number, s: Q, iris = INK, cheeks = true, spread = .42): void {
  const look = s.look * R * .25;
  for (const side of [-1, 1] as const) {
    const n: V3 = [1, side * .55 + s.look * .3, .05];
    if (!r.faces(n)) continue;
    const e = add(h, [R * .86, side * R * spread + look, R * .05]);
    if (s.eyes === 'shut') { r.line(add(e, [0, -2, 0]), add(e, [0, 2, 0]), iris, { always: true }); continue; }
    if (s.eyes === 'smile') { r.line(add(e, [0, -2, -1]), add(e, [0, 0, 1]), iris, { always: true }); r.line(add(e, [0, 0, 1]), add(e, [0, 2, -1]), iris, { always: true }); continue; }
    r.mark(e, iris, 4, 6, { always: true }); r.mark(add(e, [0, -.8, 1.6]), SHINE, 2, 2, { always: true }); r.mark(add(e, [0, .8, -1.6]), mix(iris, '#ffffff', .45), 1, 1, { always: true });
  }
  if (cheeks && s.eyes !== 'shut') for (const side of [-1, 1] as const) if (r.faces([1, side * .8, 0])) r.mark(add(h, [R * .7, side * R * .62, -R * .3]), CHEEK, 2, 1, { always: true });
}

interface Chibi {
  body: Mat; dark: Mat; belly?: Mat; head: number; bodyR: V3;
  ears: 'pointed' | 'floppy' | 'none' | 'tufts'; earMat?: Mat; earIn?: Mat;
  tail: 'brush' | 'wisp' | 'long' | 'stub' | 'none'; tailTip?: Mat;
  muzzle?: number; legs?: number; iris?: string;
  dress?: (r: Rig, s: Q, h: V3, c: V3) => void;
}
/** A four-legged chibi: the trot, a sit, a curl, a hop. */
function chibi(r: Rig, p: Pose, L: Chibi): void {
  const s = q(p), R = L.head, [bf, br, bu] = L.bodyR, legL = L.legs ?? 4;
  const hop = s.mode === 'happy' ? s.bob : 0;
  if (s.mode === 'sleep') {
    // Curled: a loaf of body, the head laid on the front paws, the tail round the near side.
    const c: V3 = [-1, 0, bu * .8];
    r.egg(c, bf * 1.05, br * 1.15, bu * .8, L.body, { g: 1 });
    if (L.belly) r.egg(add(c, [bf * .5, 0, -bu * .2]), bf * .4, br * .7, bu * .4, L.belly, { g: 2, z: .3 });
    const h: V3 = [bf * .7, br * .2, R * .78];
    r.ball(h, R * .92, L.body, { g: 3, z: 1 });
    if (L.muzzle) r.egg(add(h, [R * .75, 0, -R * .2]), L.muzzle * .5, R * .4, R * .32, L.belly ?? L.body, { g: 3, z: 1 });
    ears(r, h, R * .92, L, s, true);
    face(r, h, R * .92, s, L.iris);
    if (L.tail !== 'none') r.chain([[-bf, 0, bu * .6], [-bf * .6, -br * 1.1, bu * .5], [bf * .3, -br * 1.2, bu * .45]], 3.6, 2, L.body, { g: 4, z: 1.2 });
    L.dress?.(r, s, h, c);
    return;
  }
  const sit = s.mode === 'sit', walk = s.mode === 'walk';
  const c: V3 = sit ? [-2, 0, bu + legL * .6 + 2] : [0, 0, bu + legL + s.bob * .5 + hop];
  // Legs: the trot in diagonal pairs; sitting, the haunches tucked and the front legs straight.
  for (const [ff, side, off] of [[bf * .55, -1, 0], [bf * .55, 1, Math.PI], [-bf * .55, -1, Math.PI], [-bf * .55, 1, 0]] as const) {
    const front = ff > 0, far = r.toward([0, side, 0]) < -.2, m = far ? L.dark : L.body;
    if (sit && !front) { r.egg([-bf * .25, side * br * .7, bu * .55], bf * .55, br * .45, bu * .55, m, { g: 10 + side, bias: far ? -.3 : 0 }); r.egg([bf * .15, side * br * .62, 1.6], 3.6, 2.6, 1.8, m); continue; }
    const a = walk ? s.ph + off : 0, sw = walk ? Math.sin(a) * 3.5 : 0, lift = walk ? Math.max(0, Math.cos(a)) * 2.5 : hop;
    const top: V3 = [sit ? bf * .35 : ff, side * br * .55, c[2] - bu * .5], foot: V3 = [(sit ? bf * .45 : ff) + sw, side * br * .6, lift];
    r.limb(top, foot, 3, 2.6, m, { g: 20 + (front ? 0 : 2) + (side > 0 ? 1 : 0), bias: far ? -.3 : 0 });
    r.egg(add(foot, [1.2, 0, 1]), 3.2, 2.8, 1.8, m, { g: 20 + (front ? 0 : 2) + (side > 0 ? 1 : 0), bias: far ? -.35 : 0 });
  }
  // Tail.
  const tb: V3 = add(c, [-bf * .85, 0, bu * .2]), wag = s.wag * 3;
  if (L.tail === 'brush') r.chain([tb, add(tb, [-5, wag * .5, 6]), add(tb, [-6, wag, 13]), add(tb, [-3, wag * 1.2, 18])], 4.2, 3.6, L.body, { g: 30 });
  else if (L.tail === 'wisp') r.chain([tb, add(tb, [-4, wag * .4, 7]), add(tb, [-2, wag, 14]), add(tb, [2, wag * 1.4, 18])], 2.2, 1.2, L.body, { g: 30 });
  else if (L.tail === 'long') r.chain([tb, add(tb, [-7, wag * .5, -2]), add(tb, [-14, wag * 1.2, -3]), add(tb, [-19, wag * 1.6, 0])], 3.4, 1.4, L.body, { g: 30 });
  else if (L.tail === 'stub') r.ball(add(tb, [-1, 0, 1]), 3, L.body, { g: 30 });
  if (L.tailTip && L.tail !== 'none') { const tip = L.tail === 'long' ? add(tb, [-20, wag * 1.6, 2]) : add(tb, [-3, wag * 1.2, 19]); r.ball(tip, 3, L.tailTip, { g: 31, z: .3 }); }
  // Body (sitting: upright), the pale belly.
  r.egg(c, sit ? bf * .72 : bf, br, sit ? bu * 1.2 : bu, L.body, { g: 40 });
  if (L.belly) r.egg(add(c, [sit ? bf * .5 : bf * .25, 0, -bu * (sit ? .1 : .35)]), sit ? bf * .35 : bf * .7, br * .65, bu * (sit ? .8 : .5), L.belly, { g: 41, z: .4 });
  // Head: big and round, over the chest.
  const h: V3 = sit ? add(c, [bf * .45, s.look * 2, bu + R * .72]) : add(c, [bf * .78, 0, bu * .55 + R * .62 + (walk ? [0, .8, 0, .8][s.f] : 0)]);
  r.ball(h, R, L.body, { g: 50 });
  if (L.muzzle) {
    r.egg(add(h, [R * .78, 0, -R * .28]), L.muzzle * .55, R * .42, R * .3, L.belly ?? L.body, { g: 51, z: .3 });
    if (r.faces([1, 0, 0])) r.mark(add(h, [R * .78 + L.muzzle * .5, 0, -R * .18]), INK, 2, 2, { always: true });
  }
  ears(r, h, R, L, s, false);
  face(r, h, R, s, L.iris);
  if (s.eyes === 'smile' && r.faces([1, 0, 0])) r.mark(add(h, [R * .9, 0, -R * .42]), MOUTH, 2, 1, { always: true });
  L.dress?.(r, s, h, c);
}
function ears(r: Rig, h: V3, R: number, L: Chibi, s: Q, low: boolean): void {
  for (const side of [-1, 1] as const) {
    const far = r.toward([0, side, 0]) < -.2, m = L.earMat ?? L.body;
    if (L.ears === 'pointed') {
      const b = add(h, [-R * .1, side * R * .52, R * .6]), tip = add(b, [-R * .15, side * R * .22, low ? R * .55 : R * .95]);
      r.plate([add(b, [-R * .4, -side * R * .18, -R * .1]), add(b, [R * .32, side * R * .22, -R * .1]), tip], m, { g: 60 + side, z: 1, bias: far ? -.4 : .2 });
      if (L.earIn && r.faces([1, side * .3, .3])) r.plate([add(b, [-R * .1, 0, R * .05]), add(b, [R * .14, side * R * .14, R * .05]), add(tip, [R * .06, -side * R * .06, -R * .2])], L.earIn, { z: 1.2 });
    } else if (L.ears === 'floppy') {
      const b = add(h, [-R * .05, side * R * .75, R * .35]);
      r.egg(add(b, [0, side * R * .15, -R * .45 + s.wag * side * .5]), R * .3, R * .22, R * .55, m, { g: 60 + side, z: .5, bias: far ? -.4 : -.1 });
    } else if (L.ears === 'tufts') {
      const b = add(h, [R * .05, side * R * .5, R * .75]);
      r.plate([add(b, [-R * .2, -side * R * .15, 0]), add(b, [R * .2, side * R * .1, 0]), add(b, [-R * .1, side * R * .25, R * .55])], m, { g: 60 + side, z: 1 });
    }
  }
}

// ── Each pet ──
function inkPup(r: Rig, p: Pose): void {
  chibi(r, p, { body: P.ink, dark: P.inkDk, belly: mat('#8a94d4', { cool: '#20244e', warm: '#ffffff' }), head: 12, bodyR: [11, 8, 7.5], ears: 'floppy', earMat: P.inkDk, tail: 'brush', muzzle: 8,
    dress: (rr, s, h) => { if (s.mode !== 'sleep' && rr.faces([1, 0, 0])) { const st = add(h, [7, 0, -15]); rr.mark(st, '#ffffff', 3, 1, { always: true }); rr.mark(st, '#ffffff', 1, 3, { always: true }); } } });
}
function shadeKit(r: Rig, p: Pose): void {
  chibi(r, p, { body: P.shade, dark: P.shadeDk, belly: mat('#9a78c4', { cool: '#24183a', warm: '#ffffff' }), head: 12, bodyR: [10, 7, 7], ears: 'pointed', earIn: P.pink, tail: 'wisp', tailTip: P.violet, iris: '#3a1a6a',
    dress: (rr, s, h) => { if (s.eyes === 'open') for (const side of [-1, 1] as const) if (rr.faces([1, side * .55, 0])) rr.mark(add(h, [10.3, side * 5, -.6]), '#a878e8', 1, 2, { always: true }); } });
}
function rivetHatchling(r: Rig, p: Pose): void {
  const s = q(p), hop = s.mode === 'happy' ? 5 : 0, sleep = s.mode === 'sleep';
  const u0 = (sleep ? 5 : 9) + hop + s.bob * .4, open = sleep ? 0 : s.mode === 'happy' ? 5 : s.mode === 'walk' ? [3, 4, 3, 4][s.f] : 2 + s.f;
  if (!sleep) for (const [ff, side, off] of [[6, -1, 0], [6, 1, Math.PI], [-6, -1, Math.PI], [-6, 1, 0]] as const) {
    const a = s.mode === 'walk' ? s.ph + off : 0, sw = s.mode === 'walk' ? Math.sin(a) * 2.5 : 0;
    r.limb([ff, side * 6, u0], [ff + sw, side * 7, 1.5 + hop], 2.6, 2.4, P.iron, { bias: r.toward([0, side, 0]) < 0 ? -.4 : 0 });
  }
  r.egg([0, 0, u0 + 3], 11, 9.5, 5.5, P.rust, { g: 1 });
  r.egg([3, 0, u0 + 6 + open * .3], 8, 7.5, 1.5 + open * .45, mat('#2a1820', { cool: '#08040a' }, { round: 3, gain: .5 }), { g: 2, z: 1 });
  if (open > 2) r.ball([2, 0, u0 + 6 + open * .3], 2.6, P.ember, { z: 1.4 });
  r.egg([-1, 0, u0 + 10 + open * .5], 11.5, 10, 6, P.rust, { g: 3, z: 2 });
  for (let i = -2; i <= 2; i++) { const a = i / 2 * 1.1; r.mark([1 + Math.cos(a) * 10.5, Math.sin(a) * 8.5, u0 + 6], '#fffaf0', 2, 2, { n: [Math.cos(a), Math.sin(a), 0] }); }
  for (const [x, y] of [[-4, -4], [0, 3], [-6, 3], [2, -2]]) r.mark([x, y, u0 + 16 + open * .5], '#ffd0a0', 1, 1, { n: [0, 0, 1] });
  // Big friendly eyes on the shell.
  const h: V3 = [3, 0, u0 + 12 + open * .5];
  face(r, h, 8, { ...s, eyes: sleep ? 'shut' : s.eyes }, INK, true, .5);
}
function mossHedgehog(r: Rig, p: Pose): void {
  const s = q(p), hop = s.mode === 'happy' ? 5 : 0, sleep = s.mode === 'sleep';
  const c: V3 = [-1, 0, (sleep ? 7 : 9) + hop + s.bob * .3];
  if (!sleep) for (const [ff, side, off] of [[5, -1, 0], [5, 1, Math.PI], [-5, -1, Math.PI], [-5, 1, 0]] as const) {
    const a = s.mode === 'walk' ? s.ph + off : 0;
    r.egg([ff + (s.mode === 'walk' ? Math.sin(a) * 2 : 0), side * 5.5, 1.6 + hop], 2.6, 2.2, 1.8, P.tan, { bias: r.toward([0, side, 0]) < 0 ? -.4 : 0 });
  }
  r.egg(c, 12, 10.5, sleep ? 8 : 9, P.moss, { g: 1 });
  // Quills: little moss tufts all over the dome.
  for (let i = 0; i < 22; i++) { const y = 1 - (i + .5) / 22, rad = Math.sqrt(1 - y * y), th = i * 2.4; if (y < .05) continue; const d: V3 = [Math.cos(th) * rad * 12 - 2, Math.sin(th) * rad * 10.5, y * 9]; r.limb(add(c, d), add(c, [d[0] * 1.3, d[1] * 1.25, d[2] * 1.25 + 1]), 1.8, .6, mat('#467a38', { cool: '#0c200a' }, { round: 1.5 }), { g: 2 }); }
  r.mark(add(c, [-3, 2, 10]), '#ffd0e8', 2, 2, { n: [0, 0, 1] });
  const h: V3 = add(c, [10, 0, sleep ? -3 : -1]);
  r.ball(h, 7, P.tan, { g: 3, z: 1 });
  r.egg(add(h, [6, 0, -1.5]), 3, 2.6, 2.2, P.tan, { g: 3, z: 1 });
  if (r.faces([1, 0, 0])) r.mark(add(h, [9, 0, -1]), '#ff8aa8', 2, 2, { always: true });
  face(r, h, 7, s, INK, true, .45);
}
function emberNewt(r: Rig, p: Pose): void {
  const s = q(p), hop = s.mode === 'happy' ? 4 : 0, sleep = s.mode === 'sleep', walk = s.mode === 'walk';
  const u = 5 + hop + s.bob * .3, wig = walk ? Math.sin(s.ph) * 2.5 : 0;
  for (const [ff, side, off] of [[6, -1, 0], [6, 1, Math.PI], [-6, -1, Math.PI], [-6, 1, 0]] as const) {
    const a = walk ? s.ph + off : 0;
    r.limb([ff, side * 4, u], [ff + (walk ? Math.sin(a) * 3 : 0), side * 8, hop + .8], 1.8, 1.6, P.newtDk, { bias: r.toward([0, side, 0]) < 0 ? -.4 : 0 });
  }
  const tail: V3[] = sleep ? [[-8, 0, u], [-12, -6, u - 1], [-6, -11, u - 2], [2, -12, u - 2]] : [[-8, 0, u], [-15, wig, u], [-22, wig * 1.8 + s.wag * 2, u + 1], [-27, wig * 2 + s.wag * 3, u + 3]];
  r.chain(tail, 3.6, 1.4, P.newt, { g: 1 });
  r.ball(add(tail[3], [0, 0, 2]), 2.6, P.ember, { z: 1 }); r.mark(add(tail[3], [0, 0, 3]), '#fff2a8', 1, 1, { always: true });
  r.egg([0, wig * .3, u + 2], 10, 6, 4.5, P.newt, { g: 2 });
  for (const [x, y] of [[-4, 3], [2, -3], [-1, 2], [5, 2]]) r.mark([x, y, u + 6.2], '#ffe060', 2, 2, { n: [0, 0, 1] });
  const h: V3 = [11, 0, u + 4 + (s.mode === 'sit' ? 3 : 0)];
  r.egg(h, 7.5, 7, 5.5, P.newt, { g: 3, z: 1 });
  face(r, add(h, [-1, 0, 1.5]), 7, s, INK, true, .55);
  if (r.faces([1, 0, 0]) && s.eyes !== 'shut') r.line(add(h, [7.4, -2, -2]), add(h, [7.4, 2, -2]), MOUTH, { always: true });
}
function starOwlet(r: Rig, p: Pose): void {
  const s = q(p), hop = s.mode === 'happy' ? 6 : 0, sleep = s.mode === 'sleep', walk = s.mode === 'walk';
  const bob = walk ? [0, 2, 0, 2][s.f] : 0, u0 = (sleep ? 1 : 3) + hop + bob;
  for (const side of [-1, 1] as const) {
    const lift = walk && ((s.f === 1 && side < 0) || (s.f === 3 && side > 0)) ? 2.5 : 0;
    r.limb([0, side * 4, u0 + 4], [1, side * 4, lift + hop + 1], 1.4, 1.2, P.cream);
    for (const t of [-1, 0, 1]) r.mark([3, side * 4 + t, lift + hop + .5], '#e8a040', 1, 1, { always: true });
  }
  const c: V3 = [0, 0, u0 + 14];
  r.egg(c, 10, 11, 13, P.owl, { g: 1 });
  r.egg(add(c, [6, 0, -2]), 4, 7, 8, P.cream, { g: 2, z: .5 });
  if (r.faces([1, 0, 0])) { const st = add(c, [10, 0, -1]); r.mark(st, '#ffd860', 3, 1, { always: true }); r.mark(st, '#ffd860', 1, 3, { always: true }); r.mark(st, '#fff8c0', 1, 1, { always: true }); }
  const flap = s.mode === 'happy' ? 1 : walk ? [0, .5, 0, .5][s.f] : 0;
  for (const side of [-1, 1] as const) r.egg(add(c, [-2, side * (10 + flap * 3), 1 + flap * 4]), 6, 3, 9, P.owlDk, { g: 3 + side, bias: r.toward([0, side, 0]) < 0 ? -.4 : 0, z: side * .5 });
  const h: V3 = add(c, [1, 0, sleep ? 12 : 15]);
  r.egg(h, 11, 12, 10, P.owl, { g: 6 });
  r.egg(add(h, [7, 0, -1]), 3, 9, 7, P.cream, { g: 7, z: .5 });
  if (r.faces([1, 0, -.2])) r.plate([add(h, [10.5, -1.4, -2]), add(h, [10.5, 1.4, -2]), add(h, [12, 0, -5])], mat('#e8a040', {}, { round: 1 }), { z: 1 });
  for (const side of [-1, 1] as const) r.plate([add(h, [-2, side * 6, 7]), add(h, [1, side * 9, 7]), add(h, [-2, side * 10, 14])], P.owlDk, { z: 1 });
  face(r, add(h, [0, 0, 1]), 10, s, INK, true, .45);
}
function prismMothkit(r: Rig, p: Pose): void {
  const s = q(p), sleep = s.mode === 'sleep', beat = sleep ? -.4 : Math.sin(s.ph + (s.mode === 'sit' ? s.f * 1.5 : 0)) * .9;
  const u = sleep ? 8 : 18 + (s.mode === 'walk' ? Math.sin(s.ph) * 2 : 0) + (s.mode === 'happy' ? 4 : 0);
  const c: V3 = [0, 0, u];
  for (const side of [-1, 1] as const) {
    const sh = add(c, [-1, side * 3, 4]);
    for (const [m, up, len] of [[P.wingA, 1, 20], [P.wingB, -1, 14]] as const) {
      const tip = add(sh, [-3 - (up < 0 ? 4 : 0), side * len, up * 6 + beat * 9]);
      r.plate([sh, tip, add(tip, [-6, -side * 3, -up * 4]), add(sh, [-6, side * 2, -up * 3])], m, { g: 10 + side * 2 + (up > 0 ? 0 : 1), z: -1, bias: r.toward([0, side, 0]) < 0 ? -.5 : .2 });
    }
  }
  r.egg(add(c, [-5, 0, -3]), 7, 4.5, 5, P.moth, { g: 1 });
  r.ball(add(c, [2, 0, 3]), 8, P.moth, { g: 2 });
  for (const side of [-1, 1] as const) r.chain([add(c, [6, side * 2, 9]), add(c, [7, side * 5, 15]), add(c, [5, side * 8, 17])], 1, .6, mat('#d4be96', {}, { round: 1 }), { z: 1 });
  face(r, add(c, [3, 0, 3]), 8, s, INK, true, .45);
}
function sunling(r: Rig, p: Pose): void {
  const s = q(p), sleep = s.mode === 'sleep', spin = s.f * .2 + (s.mode === 'walk' ? s.ph * .1 : 0);
  const u = sleep ? 9 : 17 + (s.mode === 'walk' ? Math.sin(s.ph) * 2 : 0) + (s.mode === 'happy' ? 4 : 0);
  const c: V3 = [0, 0, u];
  for (let i = 0; i < 10; i++) { const y = 1 - (i + .5) / 10 * 2, rad = Math.sqrt(1 - y * y), th = i * 2.4 + spin, d: V3 = [Math.cos(th) * rad, Math.sin(th) * rad, y]; r.limb(add(c, d, 8), add(c, d, sleep ? 10.5 : 13.5), 2.6, .8, P.ray, { g: 1, z: -2 }); }
  r.ball(c, 9.5, P.sun, { g: 2 });
  face(r, c, 9.5, s, MOUTH, true, .4);
  if (s.eyes !== 'shut' && r.faces([1, 0, 0])) r.line(add(c, [9, -1.5, -3.5]), add(c, [9, 1.5, -3.5]), MOUTH, { always: true });
}
function spiritBeast(r: Rig, p: Pose): void {
  chibi(r, p, { body: P.spirit, dark: P.spiritDk, belly: mat('#9af0d0', { cool: '#2a7a64', warm: '#ffffff' }), head: 11, bodyR: [13, 8, 7.5], legs: 6, ears: 'pointed', earIn: mat('#eafff6', {}, { round: 2 }), tail: 'brush', tailTip: P.rootglow, muzzle: 10, iris: '#0a3a30',
    dress: (rr, s, h) => { if (s.mode !== 'sleep') for (const [dy, dz] of [[-1.5, 4], [1.5, 3]]) rr.plate([add(h, [-2, dy, 11]), add(h, [1, dy + 1.5, 14]), add(h, [-2, dy * 2, 17 + dz * .3])], mat('#55a03e', { cool: '#08200c' }, { round: 1 }), { z: 1.5 }); } });
}

// ── Glim: the cartographer's moth (glim-art.ts) — pale dawn-glass wings edged violet, the map inked on them, an amber body ──
export type GlimHdMood = 'calm' | 'happy' | 'gasp' | 'worry' | 'sleepy' | 'curious';
const GLIM = { wing: mat('#efe9f7', { cool: '#6a5a8a', warm: '#ffffff' }, { round: 1.5, gain: .7 }), edge: mat('#9a6be0', { cool: '#2a1460' }, { round: 1 }), body: mat('#f4b942', { cool: '#5a2a08', warm: '#fff8e0' }, { round: 4 }) };
/** Glim at a wingbeat (0 up, 1 mid, 2 down) with a mood's face. Body frame: facing the camera. */
export function glimModel(r: Rig, beat: number, mood: GlimHdMood): void {
  const c: V3 = [0, 0, 10], b = [.9, 0, -.8][beat] ?? 0;
  for (const side of [-1, 1] as const) {
    // A broad rounded forewing and a smaller hindwing, both dawn-glass edged in violet, a map line across each.
    const sh = add(c, [-1, side * 2, 2]), lift = b * 6;
    const fore: V3[] = [sh, add(sh, [-1, side * 5, 5 + lift * .6]), add(sh, [-1, side * 10, 7 + lift]), add(sh, [-1, side * 13, 4 + lift * .8]), add(sh, [-1, side * 12, 0 + lift * .4]), add(sh, [-1, side * 7, -1])];
    const hind: V3[] = [add(sh, [-1, side, -2]), add(sh, [-1, side * 8, -2 + lift * .2]), add(sh, [-1, side * 9, -6 + lift * .1]), add(sh, [-1, side * 5, -9]), add(sh, [-1, side * 1.5, -6])];
    r.plate(hind, GLIM.wing, { g: 12 + side, z: -1.2 });
    r.plate(fore, GLIM.wing, { g: 10 + side, z: -1 });
    for (let i = 1; i < fore.length; i++) r.line(fore[i], fore[(i + 1) % fore.length], '#9a6be0', { always: true });
    r.line(add(sh, [-1, side * 3, 2]), add(sh, [-1, side * 10, 4 + lift * .8]), '#a89cc8', { always: true });
    r.mark(add(sh, [-1, side * 9, 3 + lift * .7]), '#fffbea', 1, 1, { always: true });
  }
  r.egg(add(c, [0, 0, -3]), 2.8, 2.8, 4.2, GLIM.body, { g: 1 });
  r.ball(add(c, [0, 0, 2]), 4.6, GLIM.body, { g: 2 });
  for (const side of [-1, 1] as const) r.chain([add(c, [1, side * 1.5, 5]), add(c, [1, side * 3.5, 9])], .8, .6, mat('#ffd98a', {}, { round: 1 }), { z: 1 });
  const h = add(c, [0, 0, 2]);
  const at = (dy: number, dz: number): V3 => add(h, [4, dy, dz]);
  switch (mood) {
    case 'happy': for (const s of [-1, 1]) { r.line(at(s * 1.6 - .8, 0), at(s * 1.6, 1), '#3a1a08', { always: true }); r.line(at(s * 1.6, 1), at(s * 1.6 + .8, 0), '#3a1a08', { always: true }); } break;
    case 'gasp': for (const s of [-1, 1]) r.mark(at(s * 1.6, .5), '#fffbea', 1, 2, { always: true }); r.mark(at(0, -2), '#5a2030', 2, 1, { always: true }); break;
    case 'worry': case 'sleepy': for (const s of [-1, 1]) r.mark(at(s * 1.6, 0), mood === 'worry' ? '#8a5a2a' : '#3a1a08', 2, 1, { always: true }); break;
    case 'curious': r.mark(at(-1.6, 1), '#fffbea', 1, 1, { always: true }); r.mark(at(1.6, 0), '#fffbea', 1, 1, { always: true }); break;
    default: for (const s of [-1, 1]) r.mark(at(s * 1.8, .5), '#fffbea', 2, 2, { always: true });
  }
}

const PET_BOX: [number, number, number, number] = [110, 90, 55, 74];
/** The pets as HD models (ids are td-pets ids, prefixed `pet:` in the cell cache). */
export const HD_PETS: Record<string, HdModel> = {
  'ink-pup': { box: PET_BOX, build: inkPup },
  'shade-kit': { box: PET_BOX, build: shadeKit },
  'rivet-hatchling': { box: PET_BOX, build: rivetHatchling },
  'moss-hedgehog': { box: PET_BOX, build: mossHedgehog },
  'ember-newt': { box: PET_BOX, build: emberNewt },
  'star-owlet': { box: PET_BOX, build: starOwlet },
  'prism-mothkit': { box: PET_BOX, build: prismMothkit, floats: true },
  'sunling': { box: PET_BOX, build: sunling, floats: true },
  'spirit-beast': { box: PET_BOX, build: spiritBeast },
};
/** A pet frame name → the rig's clip. */
export function petClip(frame: string): Pose {
  if (frame.startsWith('walk')) return { anim: 'walk', f: Number(frame[4]) || 0 };
  return { anim: 'idle', f: frame === 'sit1' ? 1 : frame === 'sleep' ? 2 : frame === 'happy' ? 3 : 0 };
}
