/**
 * td-hd-art.ts — option B/C of the art-direction prototype (td-artopt.ts, docs/handoff/artopt/): the pieces in the
 * comparison scene repainted at twice the art resolution, the way the owner's references read (smooth figures, a clean
 * outline, readable faces, soft shading). Each sheet pixel is drawn half a world pixel, so a figure keeps its size in
 * the world and gets four times the pixels.
 *
 * - the Keeper as an Ashguard (front and back; walk and breath), a wine-dark watch cape, a steel half-helm, a sword;
 * - the Bone Walker (sword and round shield, ember eyes), four frames like td-mobs' sheet;
 * - the shade-kit pet (eight frames like td-pet-art's sheet, facing right);
 * - the oak (a crown of lit leaf clusters over a barked trunk, with its roof layer and ground shadow).
 *
 * Everything is sculpted (td-hd-sculpt.ts) and baked once. A decision prototype, not a rollout: other vocations,
 * creatures and trees keep the game's art.
 */
import { Sculpt, mix, rampOf, type Mat, type Pt } from './td-hd-sculpt';
import type { Sprite } from './td-art';
import { hash } from './td-art';
import { shadowSprite } from './td-flora';

/** HD sheet pixels per world pixel. */
export const HD_K = 2;

// ── Materials ──
const M = {
  skin: { ramp: rampOf('#eeb48c', { cool: '#5a2a3a', deep: .55 }), round: 7, gain: .85 } as Mat,
  hair: { ramp: rampOf('#4a2c22', { cool: '#120a14' }), round: 3, gain: 1.1 } as Mat,
  steel: { ramp: rampOf('#9aa6b8', { cool: '#1a1a34', warm: '#ffffff', hi: .6 }), shine: true, round: 5, gain: 1.25 } as Mat,
  dsteel: { ramp: rampOf('#5c6476', { cool: '#0e0e20', warm: '#e0e8ff', hi: .5 }), shine: true, round: 4, gain: 1.15 } as Mat,
  cape: { ramp: rampOf('#7c2234', { cool: '#1a0a1c', warm: '#ffb0a0', deep: .7, hi: .35 }), round: 6, gain: .9 } as Mat,
  capeIn: { ramp: rampOf('#4e1426', { cool: '#0e0612', deep: .6, hi: .25 }), round: 5, gain: .7 } as Mat,
  tunic: { ramp: rampOf('#665a6c', { cool: '#120c1e', warm: '#ffe0c0', hi: .35, deep: .55 }), round: 6, gain: .85 } as Mat,
  ember: { ramp: rampOf('#e2702e', { cool: '#5a1408', warm: '#fff0a0', deep: .5, hi: .55 }), round: 2, gain: .8 } as Mat,
  leather: { ramp: rampOf('#7a4a2c', { cool: '#1e0e10' }), round: 3, gain: 1 } as Mat,
  boot: { ramp: rampOf('#5a3424', { cool: '#120810' }), round: 4, gain: 1.05 } as Mat,
  brass: { ramp: rampOf('#d6a040', { cool: '#3a1a08', warm: '#fff8d0', hi: .6 }), shine: true, round: 2, gain: 1.2 } as Mat,
  blade: { ramp: rampOf('#c4ccd8', { cool: '#262a44', warm: '#ffffff', hi: .7 }), shine: true, round: 2, gain: 1.4 } as Mat,
  grip: { ramp: rampOf('#4a2a20', { cool: '#0e0608' }), round: 2 } as Mat,
  bone: { ramp: rampOf('#e2d8c2', { cool: '#3a3040', warm: '#fffdf4', deep: .55, hi: .55 }), round: 3, gain: 1.1 } as Mat,
  skull: { ramp: rampOf('#e6dcc6', { cool: '#3a3040', warm: '#fffdf4', deep: .55, hi: .55 }), round: 9, gain: 1.05 } as Mat,
  void: { ramp: ['#0a0610', '#140c18', '#1c1220', '#24182a', '#2c1e32', '#34243a'], round: 3, gain: .5 } as Mat,
  rag: { ramp: rampOf('#8a2a2a', { cool: '#1a0810', deep: .6, hi: .3 }), round: 3, gain: .9 } as Mat,
  wood: { ramp: rampOf('#8a5a34', { cool: '#24100c', hi: .4 }), round: 6, gain: .9 } as Mat,
  iron: { ramp: rampOf('#6a6a74', { cool: '#14121c', warm: '#f0f0ff', hi: .5 }), shine: true, round: 2, gain: 1.2 } as Mat,
  fur: { ramp: rampOf('#8264b4', { cool: '#1c1032', warm: '#ffe8ff', deep: .6, hi: .45 }), round: 6, gain: 1 } as Mat,
  furLt: { ramp: rampOf('#efe2f4', { cool: '#5a4070', warm: '#ffffff', deep: .4, hi: .5 }), round: 4, gain: .9 } as Mat,
  furDk: { ramp: rampOf('#5a4084', { cool: '#120a24', deep: .6, hi: .35 }), round: 4, gain: 1 } as Mat,
  leaf: { ramp: ['#1f4a24', '#2d6a2c', '#3f8634', '#58a33c', '#7cc24c', '#a8dc66'], round: 6, gain: 1.1 } as Mat,
  leafDeep: { ramp: ['#10261a', '#163020', '#1c3a24', '#22462a', '#2a5230', '#326036'], round: 8, gain: .6 } as Mat,
  bark: { ramp: rampOf('#7a5236', { cool: '#1c0e10', warm: '#f0d0a0', hi: .35 }), round: 6, gain: 1 } as Mat,
};

const EYE = '#2a1a30', SHINE = '#ffffff', MOUTH = '#8a3a3a', BLUSH = '#e89090';

// ── The Keeper (Ashguard) ──
/** The sculpt's size (the canvas is 2 px larger: the outline's margin) and the feet in canvas px. */
const KW = 82, KH = 118;
export const HD_KEEPER = { w: KW + 2, h: KH + 2, ax: 42, ay: 114 } as const;

interface KPose { bob: number; step: number; lift: [number, number]; arm: number; sway: number; breath: number }
/** 0 idle, 1 breath, 2–5 the walk (contact, passing, contact, passing). */
const KPOSES: readonly KPose[] = [
  { bob: 0, step: 0, lift: [0, 0], arm: 0, sway: 0, breath: 0 },
  { bob: 0, step: 0, lift: [0, 0], arm: 0, sway: 1, breath: 1 },
  { bob: 0, step: 3, lift: [0, 2], arm: 2, sway: -1, breath: 0 },
  { bob: -2, step: 0, lift: [0, 3], arm: 0, sway: 0, breath: 0 },
  { bob: 0, step: -3, lift: [2, 0], arm: -2, sway: 1, breath: 0 },
  { bob: -2, step: 0, lift: [3, 0], arm: 0, sway: 0, breath: 0 },
];

/** An ellipse's outline above the line y = cut (a helm's dome). */
function dome(cx: number, cy: number, rx: number, ry: number, cut: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI + i / 40 * Math.PI, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; pts.push([x, Math.min(y, cut)]); }
  const yc = Math.min(cut, cy), dx = rx * Math.sqrt(Math.max(0, 1 - ((cut - cy) / ry) ** 2));
  if (cut > cy) { pts.push([cx + dx, cut]); pts.push([cx - dx, cut]); } else { pts.push([cx + rx, yc]); pts.push([cx - rx, yc]); }
  return pts;
}

function keeperFront(q: KPose): HTMLCanvasElement {
  const s = new Sculpt(KW, KH), b = q.bob, cx = 41, br = q.breath, sw = q.sway;
  // The cape behind everything: flares from the shoulders to just over the boots, swaying.
  s.poly([[cx - 17, 50 + b], [cx + 17, 50 + b], [cx + 27 + sw, 106 + b], [cx + 15 + sw, 110 + b], [cx, 107 + b], [cx - 15 + sw, 110 + b], [cx - 27 + sw, 106 + b]], M.capeIn, { g: 1 });
  // Its outer folds either side of the legs (lit on the left).
  s.poly([[cx - 19, 54 + b], [cx - 12, 60 + b], [cx - 15 + sw, 108 + b], [cx - 28 + sw, 106 + b]], M.cape, { g: 2 });
  s.poly([[cx + 19, 54 + b], [cx + 12, 60 + b], [cx + 15 + sw, 108 + b], [cx + 28 + sw, 106 + b]], M.cape, { g: 3, bias: -.4 });
  s.line([cx - 21 + sw * .5, 70 + b], [cx - 24 + sw, 104 + b], M.cape.ramp[1]);
  s.line([cx + 21 + sw * .5, 70 + b], [cx + 24 + sw, 104 + b], M.cape.ramp[1]);
  // Legs: dark steel greaves, leather boots.
  const leg = (side: -1 | 1, lift: number, step: number) => {
    const x = cx + side * 7 + step * side * .3, top = 86 + b, foot = 113 - lift;
    s.limb([x, top], [x + side * .5, foot - 9], 5.8, 5, M.tunic, { g: 10 + side, bias: side > 0 ? -.3 : 0 });
    s.limb([x + side * .5, top + 9], [x + side * .5, foot - 9], 5.2, 5, M.dsteel, { g: 20 + side, bias: side > 0 ? -.3 : 0 });
    s.ellipse(x + side * .5, top + 8, 5, 3.4, M.dsteel, { g: 25 + side });
    s.poly([[x - 5.5 + side * .5, foot - 10], [x + 5.5 + side * .5, foot - 10], [x + 6.5 + side, foot], [x - 6 + side * .3, foot]], M.boot, { g: 30 + side, bias: side > 0 ? -.3 : 0 });
    s.rect(x - 5.5 + side * .5, foot - 11, 12, 2, M.leather, { g: 35 + side });
  };
  leg(-1, q.lift[0], q.step); leg(1, q.lift[1], -q.step);
  // The skirt of the tunic over the thighs, an ember hem.
  s.poly([[cx - 16, 73 + b], [cx + 16, 73 + b], [cx + 18, 90 + b], [cx + 7, 92 + b], [cx, 89 + b], [cx - 7, 92 + b], [cx - 18, 90 + b]], M.tunic, { g: 40 });
  s.line([cx - 7, 78 + b], [cx - 7, 90 + b], M.tunic.ramp[1]); s.line([cx + 7, 78 + b], [cx + 7, 90 + b], M.tunic.ramp[1]);
  s.poly([[cx - 18, 89 + b], [cx - 7, 91 + b], [cx, 88 + b], [cx + 7, 91 + b], [cx + 18, 89 + b], [cx + 18.5, 91.5 + b], [cx + 7, 94 + b], [cx, 91 + b], [cx - 7, 94 + b], [cx - 18.5, 91.5 + b]], M.ember, { g: 41 });
  // The far (left-hand, viewer's right) arm, relaxed, swinging against the step.
  const ax2 = cx + 19, ay2 = 55 + b;
  s.limb([ax2, ay2], [ax2 + 3, ay2 + 13 - q.arm], 5.2, 4.6, M.tunic, { g: 50 });
  s.limb([ax2 + 3, ay2 + 12 - q.arm], [ax2 + 3, ay2 + 22 - q.arm * 1.5], 4.8, 4.4, M.dsteel, { g: 51 });
  s.ellipse(ax2 + 3, ay2 + 25 - q.arm * 1.5, 4, 3.8, M.skin, { g: 52 });
  // The torso: a gambeson, a steel breastplate over it, the belt.
  s.poly([[cx - 17, 51 + b], [cx + 17, 51 + b], [cx + 17, 75 + b], [cx - 17, 75 + b]], M.tunic, { g: 60 });
  s.poly([[cx - 15, 52 + b - br], [cx + 15, 52 + b - br], [cx + 14, 66 + b], [cx + 9, 73 + b], [cx - 9, 73 + b], [cx - 14, 66 + b]], M.steel, { g: 61 });
  s.line([cx, 55 + b - br], [cx, 71 + b], M.steel.ramp[2]);
  s.rect(cx - 17, 72 + b, 34, 4, M.leather, { g: 62 });
  // Pauldrons, layered plates.
  for (const side of [-1, 1] as const) {
    s.ellipse(cx + side * 17, 54 + b - br, 8.5, 6.8, M.steel, { g: 70 + side, bias: side > 0 ? -.2 : .1 });
    s.ellipse(cx + side * 19, 60 + b - br, 6.2, 4, M.steel, { g: 72 + side, bias: side > 0 ? -.4 : 0 });
  }
  // The sword arm (right hand, viewer's left), the hand out from the hip, the blade raised and angled out.
  const hx = cx - 23, hy = 76 + b + q.arm * .5;
  s.limb([cx - 19, 57 + b], [cx - 22, 67 + b], 5.2, 4.8, M.tunic, { g: 80 });
  s.limb([cx - 22, 66 + b], [hx + 1, hy - 3], 4.8, 4.4, M.dsteel, { g: 81 });
  // The blade first (the hand closes over the grip): from the guard up and out to the point.
  const tip: Pt = [hx - 12, hy - 54];
  const dir = [tip[0] - hx, tip[1] - hy], dl = Math.hypot(dir[0], dir[1]), ux = dir[0] / dl, uy = dir[1] / dl, nx = -uy, ny = ux;
  const g0: Pt = [hx + ux * 5, hy + uy * 5];
  s.poly([[g0[0] + nx * 2.8, g0[1] + ny * 2.8], [tip[0] + nx * 2.4 - ux * 6, tip[1] + ny * 2.4 - uy * 6], tip, [tip[0] - nx * 2.4 - ux * 6, tip[1] - ny * 2.4 - uy * 6], [g0[0] - nx * 2.8, g0[1] - ny * 2.8]], M.blade, { g: 90 });
  for (let t = 9; t < dl - 11; t++) s.dot(hx + ux * t, hy + uy * t, mix(M.blade.ramp[1], M.blade.ramp[2], .5));
  for (let t = 8; t < dl - 6; t++) s.dot(hx + ux * t + nx * 1.7, hy + uy * t + ny * 1.7, M.blade.ramp[5]);
  s.limb([hx + nx * 7.5 + ux * 4, hy + ny * 7.5 + uy * 4], [hx - nx * 7.5 + ux * 4, hy - ny * 7.5 + uy * 4], 2, 2, M.brass, { g: 91 });
  s.limb([hx - ux * 1, hy - uy * 1], [hx - ux * 6, hy - uy * 6], 2.2, 2.2, M.grip, { g: 92 });
  s.ellipse(hx - ux * 8.5, hy - uy * 8.5, 2.6, 2.6, M.brass, { g: 93 });
  s.ellipse(hx, hy, 4.2, 4, M.skin, { g: 94 });
  // The neck and the head (big: about a third of the figure, the references' proportion).
  s.rect(cx - 5, 44 + b, 11, 9, M.skin, { g: 100, bias: -1 });
  s.ellipse(cx, 33 + b, 17.5, 16, M.skin, { g: 101 });
  s.ellipse(cx - 17, 36 + b, 2.8, 4, M.skin, { g: 102, bias: .2 }); s.ellipse(cx + 17, 36 + b, 2.8, 4, M.skin, { g: 103, bias: -.3 });
  // Hair: dark curls at the temples under the helm.
  for (const [x, y, r] of [[-16, 27, 4.6], [-17, 33, 3.6], [16, 27, 4.6], [17, 33, 3.6], [-12, 25, 4], [12, 25, 4], [-6, 25, 3.4], [6, 25, 3.4]] as const) s.ellipse(cx + x, y + b, r, r, M.hair, { g: 110 + x });
  // The half-helm: a steel dome, a darker rim with an ember band, a short wine plume.
  s.poly(dome(cx, 21 + b, 19, 14.5, 23 + b), M.steel, { g: 120 });
  s.poly([[cx - 19.5, 18 + b], [cx + 19.5, 18 + b], [cx + 19, 23 + b], [cx - 19, 23 + b]], M.dsteel, { g: 121 });
  s.rect(cx - 18, 19 + b, 36, 2, M.ember, { g: 122 });
  s.limb([cx, 8 + b], [cx, 18 + b], 1.8, 1.8, M.dsteel, { g: 123 });
  s.stroke([[cx + 1, 8 + b], [cx + 7, 3 + b], [cx + 13, 2 + b], [cx + 19 - sw, 7 + b]], 3.8, 1.8, M.cape, { g: 124 });
  // The face: brows, big eyes with a glint, a nose shade, a small mouth, a little blush.
  const ey = 35 + b;
  for (const side of [-1, 1] as const) {
    const ex = cx + side * 7;
    s.dot(ex - 3, ey - 6, '#3a2220', 6, 1); s.dot(ex - 3 + (side > 0 ? 5 : 0), ey - 7, '#3a2220');
    s.dot(ex - 2, ey - 3, EYE, 5, 8); s.dot(ex - 3, ey - 2, EYE, 1, 6); s.dot(ex + 3, ey - 2, EYE, 1, 6);
    s.dot(ex - 1, ey, '#6a4a2a', 3, 4); s.dot(ex, ey + 2, '#a8784a', 2, 1);
    s.dot(ex - 1, ey - 2, SHINE, 2, 2); s.dot(ex + 1, ey + 3, '#e8d8c8');
    s.dot(ex - 2 + side * 2, ey + 8, BLUSH, 3, 1);
  }
  s.dot(cx, ey + 4, mix(M.skin.ramp[2], M.skin.ramp[1], .5), 1, 2);
  s.dot(cx - 2, ey + 9, MOUTH, 4, 1); s.dot(cx - 1, ey + 10, '#b85a5a', 2, 1);
  s.dot(cx - 2, 73 + b, M.brass.ramp[5], 4, 2); s.dot(cx - 1, 73 + b, M.brass.ramp[2], 2, 1);
  s.dot(cx - 10, 56 + b - br, M.steel.ramp[5]); s.dot(cx + 10, 56 + b - br, M.steel.ramp[3]);
  return s.render();
}

function keeperBack(q: KPose): HTMLCanvasElement {
  const s = new Sculpt(KW, KH), b = q.bob, cx = 41, sw = q.sway;
  const leg = (side: -1 | 1, lift: number, step: number) => {
    const x = cx + side * 7 + step * side * .3, top = 86 + b, foot = 113 - lift;
    s.limb([x, top + 8], [x + side * .5, foot - 9], 5.2, 5, M.dsteel, { g: 20 + side, bias: side > 0 ? -.3 : 0 });
    s.poly([[x - 5.5 + side * .5, foot - 10], [x + 5.5 + side * .5, foot - 10], [x + 6 + side, foot], [x - 6 + side * .3, foot]], M.boot, { g: 30 + side });
  };
  leg(-1, q.lift[0], q.step); leg(1, q.lift[1], -q.step);
  s.limb([cx - 19, 57 + b], [cx - 22, 75 + b], 5.2, 4.4, M.dsteel, { g: 40 });
  s.ellipse(cx - 22, 78 + b, 4, 3.8, M.skin, { g: 41 });
  s.limb([cx + 19, 57 + b], [cx + 23, 75 + b], 5.2, 4.4, M.dsteel, { g: 42, bias: -.3 });
  s.ellipse(cx + 23, 78 + b, 4, 3.8, M.skin, { g: 43 });
  s.poly([[cx + 24, 76 + b], [cx + 26.5, 76 + b], [cx + 37, 26 + b], [cx + 34.5, 25 + b]], M.blade, { g: 44 });
  s.poly([[cx - 18, 48 + b], [cx + 18, 48 + b], [cx + 26 + sw, 106 + b], [cx + 9 + sw, 110 + b], [cx - 9 + sw, 110 + b], [cx - 26 + sw, 106 + b]], M.cape, { g: 50 });
  for (const fx of [-9, 0, 9]) s.poly([[cx + fx - 1, 62 + b], [cx + fx + 1, 62 + b], [cx + fx * 1.4 + 2.5 + sw, 107 + b], [cx + fx * 1.4 - 2.5 + sw, 107 + b]], M.capeIn, { g: 51 + fx });
  for (const side of [-1, 1] as const) s.ellipse(cx + side * 17, 53 + b, 8.5, 6.8, M.steel, { g: 60 + side });
  s.ellipse(cx, 49 + b, 15, 5.5, M.cape, { g: 62 });
  s.ellipse(cx, 33 + b, 17.5, 16, M.hair, { g: 70 });
  for (const [x, y] of [[-12, 41], [-4, 44], [4, 44], [12, 41]] as const) s.ellipse(cx + x, y + b, 4.6, 4, M.hair, { g: 71 + x });
  s.poly(dome(cx, 21 + b, 19, 14.5, 24 + b), M.steel, { g: 80 });
  s.poly([[cx - 19.5, 18 + b], [cx + 19.5, 18 + b], [cx + 19, 24 + b], [cx - 19, 24 + b]], M.dsteel, { g: 81 });
  s.rect(cx - 18, 20 + b, 36, 2, M.ember, { g: 82 });
  s.stroke([[cx - 1, 8 + b], [cx - 7, 3 + b], [cx - 13, 2 + b], [cx - 19 + sw, 7 + b]], 3.8, 1.8, M.cape, { g: 83 });
  return s.render();
}

let keeperSheet: HTMLCanvasElement | null = null;
/** The Keeper's HD sheet: row 0 facing the camera, row 1 facing away; six frames (KPOSES). */
export function hdKeeperSheet(): HTMLCanvasElement {
  if (keeperSheet) return keeperSheet;
  const W = HD_KEEPER.w, H = HD_KEEPER.h, el = document.createElement('canvas');
  el.width = W * KPOSES.length; el.height = H * 2;
  const g = el.getContext('2d')!;
  KPOSES.forEach((q, i) => { g.drawImage(keeperFront(q), i * W, 0); g.drawImage(keeperBack(q), i * W, H); });
  return (keeperSheet = el);
}
/** The frame for a time: breath now and then standing, the four-step walk moving. */
export function hdKeeperFrame(time: number, moving: boolean): number {
  if (moving) return 2 + Math.floor(time * 9) % 4;
  return Math.floor(time * 1.4) % 4 === 3 ? 1 : 0;
}

// ── The Bone Walker ──
const SW = 64, SH = 106;
export const HD_SKEL = { w: SW + 2, h: SH + 2 } as const;
const SBOB = [0, -2, 0, -2], SSTEP = [3, 0, -3, 0];

function skeletonFrame(f: number): HTMLCanvasElement {
  const s = new Sculpt(SW, SH), b = SBOB[f], st = SSTEP[f], cx = 30;
  // The round shield on the far arm (viewer's left), planks and an iron rim, behind the body.
  const shx = cx - 18, shy = 66 + b;
  // The far leg, darker.
  s.limb([cx - 5.5, 78 + b], [cx - 5.5 - st * .5, 90 + b], 3.4, 3, M.bone, { g: 1, bias: -.8 });
  s.limb([cx - 5.5 - st * .5, 90 + b], [cx - 5.5 - st, 101 - (f === 2 ? 2 : 0)], 3, 2.8, M.bone, { g: 2, bias: -.8 });
  s.ellipse(cx - 6.5 - st, 103 - (f === 2 ? 2 : 0), 4.8, 2.6, M.bone, { g: 3, bias: -.8 });
  // The spine and pelvis.
  s.limb([cx, 46 + b], [cx, 78 + b], 3.2, 3.2, M.bone, { g: 10 });
  s.poly([[cx - 9, 74 + b], [cx + 9, 74 + b], [cx + 7, 82 + b], [cx + 2, 80 + b], [cx - 2, 80 + b], [cx - 7, 82 + b]], M.bone, { g: 11 });
  // The red rag at the hips, torn.
  s.poly([[cx - 10, 75 + b], [cx + 10, 75 + b], [cx + 10, 82 + b], [cx + 6, 80 + b], [cx + 4, 86 + b], [cx + 1, 81 + b], [cx - 3, 85 + b], [cx - 5, 80 + b], [cx - 10, 83 + b]], M.rag, { g: 12 });
  // The ribcage: four ribs either side of the sternum, dark between.
  s.ellipse(cx, 59 + b, 13, 11, M.void, { g: 20 });
  for (let i = 0; i < 4; i++) {
    const y = 51 + i * 4.6 + b, w = 13 - i * 1.3;
    s.stroke([[cx - 1, y], [cx - w * .7, y + 1], [cx - w, y + 3.2]], 2.1, 1.7, M.bone, { g: 21 + i });
    s.stroke([[cx + 1, y], [cx + w * .7, y + 1], [cx + w, y + 3.2]], 2.1, 1.7, M.bone, { g: 31 + i, bias: -.3 });
  }
  s.limb([cx, 50 + b], [cx, 68 + b], 2.4, 2, M.bone, { g: 40 });
  // Collarbones.
  s.limb([cx - 14, 48 + b], [cx + 14, 48 + b], 2.4, 2.4, M.bone, { g: 41 });
  // The near leg.
  s.limb([cx + 5.5, 78 + b], [cx + 5.5 + st * .5, 90 + b], 3.4, 3, M.bone, { g: 50 });
  s.ellipse(cx + 5.5 + st * .5, 90 + b, 3.8, 3.2, M.bone, { g: 51 });
  s.limb([cx + 5.5 + st * .5, 90 + b], [cx + 5.5 + st, 101], 3, 2.8, M.bone, { g: 52 });
  s.ellipse(cx + 6.5 + st, 103, 5, 2.7, M.bone, { g: 53 });
  // The far arm holding the shield (the shield in front of it).
  s.limb([cx - 14, 49 + b], [cx - 16, 60 + b], 2.9, 2.6, M.bone, { g: 60, bias: -.4 });
  s.ellipse(shx, shy, 12.5, 13.5, M.iron, { g: 61 });
  s.ellipse(shx, shy, 10.5, 11.5, M.wood, { g: 62 });
  for (const dx of [-4.5, 0, 4.5]) s.line([shx + dx, shy - 9 + Math.abs(dx) * .3], [shx + dx, shy + 9 - Math.abs(dx) * .3], M.wood.ramp[1]);
  s.ellipse(shx, shy, 3.8, 3.8, M.iron, { g: 63 });
  // The sword arm (viewer's right): upper arm, forearm, hand on the grip, the blade upright.
  const hx = cx + 18, hy = 70 + b;
  s.limb([cx + 14, 49 + b], [cx + 16, 60 + b], 2.9, 2.6, M.bone, { g: 70 });
  s.ellipse(cx + 16, 60 + b, 3.4, 3.1, M.bone, { g: 71 });
  s.limb([cx + 16, 60 + b], [hx, hy - 2], 2.7, 2.4, M.bone, { g: 72 });
  s.poly([[hx - 2.8, hy - 6], [hx + 2.8, hy - 6], [hx + 2.6, hy - 48], [hx, hy - 54], [hx - 2.6, hy - 48]], M.iron, { g: 73 });
  s.line([hx, hy - 8], [hx, hy - 44], M.iron.ramp[1]);
  s.line([hx - 1, hy - 9], [hx - 1, hy - 43], M.iron.ramp[5]);
  s.dot(hx + 1, hy - 26, '#ff9a4a'); s.dot(hx + 1, hy - 25, '#c8502a');
  s.limb([hx - 6, hy - 6], [hx + 6, hy - 6], 1.6, 1.6, M.iron, { g: 74 });
  s.limb([hx, hy - 5], [hx, hy + 2], 1.7, 1.7, M.grip, { g: 75 });
  s.ellipse(hx, hy - 2, 3.8, 3.5, M.bone, { g: 76 });
  s.ellipse(hx, hy + 4, 1.8, 1.8, M.iron, { g: 77 });
  // The skull: big and round, a jaw, deep sockets with ember eyes.
  s.ellipse(cx, 24 + b, 17, 16, M.skull, { g: 80 });
  s.poly([[cx - 10, 33 + b], [cx + 10, 33 + b], [cx + 9, 44 + b], [cx - 9, 44 + b]], M.skull, { g: 80 });
  s.rect(cx - 7, 40 + b, 14, 1, M.void, { g: 81 });
  for (let i = 0; i < 5; i++) s.dot(cx - 6 + i * 3, 39 + b, M.skull.ramp[1], 1, 4);
  for (const side of [-1, 1] as const) {
    s.ellipse(cx + side * 6.5, 27 + b, 5.2, 4.8, M.void, { g: 82 + side });
    s.dot(cx + side * 6.5 - 1, 27 + b, '#ffb040', 3, 3); s.dot(cx + side * 6.5 - 1, 27 + b, '#fff0b0');
    s.dot(cx + side * 6 - 2, 30 + b, '#a03a1a', 1, 1);
  }
  s.poly([[cx - 1.5, 33 + b], [cx + 1.5, 33 + b], [cx, 36 + b]], M.void, { g: 85 });
  s.dot(cx - 10, 17 + b, M.skull.ramp[5], 3, 1); s.dot(cx - 11, 18 + b, M.skull.ramp[5]);
  return s.render();
}

let skelSheet: HTMLCanvasElement | null = null;
/** The Bone Walker's HD sheet: four frames (td-mobs' MOB_FRAMES), facing right like the game's. */
export function hdSkeletonSheet(): HTMLCanvasElement {
  if (skelSheet) return skelSheet;
  const el = document.createElement('canvas'); el.width = HD_SKEL.w * 4; el.height = HD_SKEL.h;
  const g = el.getContext('2d')!;
  for (let f = 0; f < 4; f++) g.drawImage(skeletonFrame(f), f * HD_SKEL.w, 0);
  return (skelSheet = el);
}

// ── The shade-kit (pet) ──
const PWD = 70, PHT = 58;
export const HD_PET = { w: PWD + 2, h: PHT + 2 } as const;
type PetFrame = 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'sit0' | 'sit1' | 'sleep' | 'happy';
const PET_ORDER: readonly PetFrame[] = ['walk0', 'walk1', 'walk2', 'walk3', 'sit0', 'sit1', 'sleep', 'happy'];

function petFrame(f: PetFrame): HTMLCanvasElement {
  const s = new Sculpt(PWD, PHT);
  if (f === 'sleep') {
    s.stroke([[12, 50], [8, 44], [14, 38], [24, 40]], 6, 3, M.fur, { g: 1 });
    s.ellipse(30, 46, 17, 9, M.fur, { g: 2 });
    s.ellipse(44, 44, 11, 9.5, M.fur, { g: 3 });
    s.poly([[38, 38], [40, 27], [46, 36]], M.fur, { g: 4 }); s.poly([[46, 36], [52, 28], [53, 39]], M.fur, { g: 5 });
    s.ellipse(44, 49, 6, 4, M.furLt, { g: 6 });
    s.dot(39, 44, EYE, 4, 1); s.dot(47, 44, EYE, 4, 1);
    s.dot(13, 37, '#e8c8ff', 2, 2);
    return s.render();
  }
  const sit = f === 'sit0' || f === 'sit1', walk = f.startsWith('walk'), wi = walk ? Number(f[4]) : 0;
  const bob = f === 'happy' ? -5 : walk && wi % 2 ? -2 : 0, wag = f === 'sit1' || wi === 1 ? 3 : f === 'happy' ? -2 : 0;
  // The tail: a big smoky brush curling up behind, a pale tip.
  s.stroke([[18, 42 + bob], [8, 38 + bob], [5 + wag, 26 + bob], [10 + wag, 16 + bob]], 6.5, 4.5, M.fur, { g: 1 });
  s.ellipse(11 + wag, 14 + bob, 4.5, 4, M.furLt, { g: 2 });
  // Far legs.
  const legs = (bias: number, g: number, dx: number) => {
    if (sit) { s.ellipse(22 + dx, 52, 6, 4, M.furDk, { g, bias }); return; }
    const a = walk ? [3, 0, -3, 0][wi] : 0;
    s.limb([20 + dx, 44 + bob], [20 + dx - a, 55], 3.2, 2.6, M.furDk, { g, bias }); s.limb([40 + dx, 44 + bob], [40 + dx + a, 55], 3.2, 2.6, M.furDk, { g: g + 1, bias });
  };
  legs(-.6, 10, 3);
  // The body: sitting tall, or long and low.
  if (sit) { s.ellipse(28, 42, 12, 12, M.fur, { g: 20 }); s.ellipse(36, 44, 6.5, 9, M.furLt, { g: 21 }); }
  else { s.ellipse(30, 42 + bob, 16, 9.5, M.fur, { g: 20 }); s.ellipse(40, 45 + bob, 7, 6, M.furLt, { g: 21 }); }
  legs(0, 30, 0);
  // The head: big and round, a short pointed muzzle, two tall ears with pink insides.
  const hx = sit ? 40 : 46, hy = (sit ? 22 : 26) + bob;
  s.poly([[hx - 9, hy - 6], [hx - 8, hy - 21], [hx - 1, hy - 9]], M.fur, { g: 40 });
  s.poly([[hx - 7, hy - 8], [hx - 7, hy - 17], [hx - 3, hy - 9]], M.furLt, { g: 41, bias: -.6 });
  s.ellipse(hx, hy, 12, 10.5, M.fur, { g: 42 });
  s.poly([[hx + 2, hy - 9], [hx + 9, hy - 22], [hx + 11, hy - 6]], M.fur, { g: 43, bias: -.2 });
  s.poly([[hx + 4, hy - 9], [hx + 9, hy - 18], [hx + 9, hy - 8]], M.furLt, { g: 44, bias: -.6 });
  s.ellipse(hx + 9, hy + 4, 7, 4.6, M.furLt, { g: 45 });
  s.ellipse(hx + 15, hy + 3, 1.8, 1.6, M.void, { g: 46 });
  // Eyes: big, a violet glow, two glints; shut and smiling when happy.
  if (f === 'happy') { s.line([hx - 3, hy - 1], [hx - 1, hy - 3], EYE); s.line([hx - 1, hy - 3], [hx + 1, hy - 1], EYE); s.line([hx + 5, hy - 1], [hx + 7, hy - 3], EYE); s.line([hx + 7, hy - 3], [hx + 9, hy - 1], EYE); }
  else {
    const look = f === 'sit1' ? -1 : 0;
    for (const ex of [hx - 2 + look, hx + 6 + look]) {
      s.dot(ex - 1, hy - 4, EYE, 4, 6); s.dot(ex, hy - 2, '#8a52e0', 2, 3); s.dot(ex, hy - 3, '#c8a0ff', 1, 1);
      s.dot(ex - 1, hy - 4, SHINE, 1, 2); s.dot(ex + 1, hy + 1, '#e8d8ff');
    }
  }
  s.dot(hx - 4, hy + 4, BLUSH, 3, 1); s.dot(hx + 8, hy + 3, BLUSH, 2, 1);
  if (f === 'happy') s.dot(hx + 10, hy + 6, MOUTH, 3, 1);
  return s.render();
}

let petHd: HTMLCanvasElement | null = null;
/** The shade-kit's HD sheet: td-pet-art's eight frames in order, facing right. */
export function hdPetSheet(): HTMLCanvasElement {
  if (petHd) return petHd;
  const el = document.createElement('canvas'); el.width = HD_PET.w * PET_ORDER.length; el.height = HD_PET.h;
  const g = el.getContext('2d')!;
  PET_ORDER.forEach((f, i) => g.drawImage(petFrame(f), i * HD_PET.w, 0));
  return (petHd = el);
}
export const hdPetFrameIndex = (f: string): number => Math.max(0, PET_ORDER.indexOf(f as PetFrame));
export const HD_PET_ID = 'shade-kit';

// ── The oak ──
/**
 * The HD oak: a crown of round leaf clusters (each lit as its own small ball, a dark contour where one sits in front
 * of the next, the whole dome darker to its lower right) over a dark heart; a barked trunk with a root flare. Same
 * world size as td-flora's broadleaf (46 × 54 with the crown as its roof layer), so it drops into the same places.
 */
export function hdOak(seed: number): Sprite {
  const v = ((seed % 6) + 6) % 6;
  // World 46 × 54 → HD 92 × 108; sculpts are 2 px smaller (the outline margin).
  const W = 90, CH = 74, H = 106;
  const crown = new Sculpt(W, CH);
  const cx = W / 2, cy = 37, rx = 43, ry = 34;
  crown.ellipse(cx, cy + 2, rx - 4, ry - 4, M.leafDeep, { g: 1 });
  type C = { x: number; y: number; r: number };
  const cl: C[] = [];
  const step = 12.5;
  for (let row = 0; row * step * .82 <= ry * 2 + 4; row++) {
    const y = cy - ry + 6 + row * step * .82;
    for (let col = -5; col <= 5; col++) {
      const x = cx + col * step + (row % 2 ? step / 2 : 0) + (hash(row, col, v + 61) - .5) * 4;
      const yy = y + (hash(row, col, v + 62) - .5) * 3;
      const nx = (x - cx) / (rx - 6), ny = (yy - cy) / (ry - 6), d = nx * nx + ny * ny;
      if (d > 1.05 || (d > .8 && hash(row, col, v + 63) < .3)) continue;
      cl.push({ x, y: yy, r: 9 + hash(row, col, v + 64) * 2.4 });
    }
  }
  cl.sort((a, b) => a.y - b.y || a.x - b.x);
  cl.forEach((c, i) => {
    const nx = (c.x - cx) / rx, ny = (c.y - cy) / ry, l = -.6 * nx - .75 * ny;
    // A lumpy rim: the cluster plus three small leaf lobes.
    const g = 10 + i, bias = l > .55 ? .9 : l > -.2 ? .35 : l > -.6 ? -.25 : -.75;
    crown.ellipse(c.x, c.y, c.r, c.r * .92, M.leaf, { g, bias });
    for (let k = 0; k < 3; k++) {
      const a = hash(i, k, v + 70) * Math.PI * 2;
      crown.ellipse(c.x + Math.cos(a) * c.r * .78, c.y + Math.sin(a) * c.r * .7, c.r * .42, c.r * .38, M.leaf, { g, bias });
    }
  });
  // Leaf glints on the upper-left clusters.
  for (let i = 0; i < 26; i++) {
    const x = Math.round(cx - rx + hash(i, 1, v + 80) * rx * 1.6), y = Math.round(cy - ry + hash(i, 2, v + 80) * ry * 1.2);
    if (crown.solid(x, y) && (x - cx) / rx + (y - cy) / ry < -.35) crown.dot(x, y, '#b6e078');
  }
  const crownCv = crown.render();
  const body = new Sculpt(W, H);
  const tx = cx + (v % 2 ? 1 : 0), tw = 7 + (v % 2);
  body.poly([[tx - tw, 56], [tx + tw, 56], [tx + tw + 1, H - 6], [tx - tw - 1, H - 6]], M.bark, { g: 1 });
  body.poly([[tx - tw - 1, H - 14], [tx - tw - 9, H - 2], [tx - tw + 3, H - 4]], M.bark, { g: 2 });
  body.poly([[tx + tw + 1, H - 14], [tx + tw + 9, H - 2], [tx + tw - 3, H - 4]], M.bark, { g: 3, bias: -.4 });
  body.ellipse(tx, H - 5, tw + 2, 3, M.bark, { g: 4, bias: -.3 });
  for (let i = 0; i < 6; i++) { const x = tx - tw + 2 + Math.floor(hash(i, v, 90) * (tw * 2 - 3)), y = 62 + Math.floor(hash(i, v, 91) * 26); body.line([x, y], [x, y + 5 + Math.floor(hash(i, v, 92) * 6)], M.bark.ramp[1]); }
  body.dot(tx - tw + 2, 70, M.bark.ramp[5], 1, 8);
  // The crown's shade across the top of the trunk.
  body.rect(tx - tw, 56, tw * 2, 6, { ramp: rampOf('#3a2416', { cool: '#0c0608' }), round: 2, gain: .4 } as Mat, { g: 5 });
  const bodyCv = body.render();
  const sp = { img: bodyCv, ax: (W + 2) / 2, ay: H + 2, roof: { img: crownCv, x: -(W + 2) / 2, y: -(H + 2) + 4 }, k: HD_K } as Sprite & { k: number };
  // The roof's offset is in world px (the engine's convention): HD values halve.
  sp.roof = { img: crownCv, x: sp.roof!.x / HD_K, y: sp.roof!.y / HD_K };
  sp.shadow = { img: shadowSprite(44, 14), x: -19, y: -9 };
  return sp;
}
