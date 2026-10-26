/**
 * td-dressing.ts — the dungeon set dressing the Dungeon Master asked for (docs/world/campaign.md queue #4, the zone
 * atmosphere pass; canon.md §8 zone bible: a dark tabletop dungeon, someone built it and it fell, light placed on
 * purpose, something to read on every floor). Painted at the fine figures' scale in the stage-4 kit (td-build.ts),
 * baked once. A builder places them in the atmosphere pass (td-level MapObject); nothing here is on a map yet.
 *
 * Standing props: altar, brazier (unlit, or lit: a fixed light of four tiles), cage, broken statue. Wall hangings (on a
 * wall's face tile, block nothing): chains, inscription. Floor decals (drawn in the ground pass under everything that
 * stands, Sprite.floor): cobweb (a corner), ritual circle, old dry stain (rust-brown, never red, never fresh), rime.
 */
import type { Sprite } from './td-art';
import { hash } from './td-art';
import { RAMP, blocks, cv, flame, groundShadow, outlined, plinth, px, rect } from './td-build';

const NONE = (() => { let el: HTMLCanvasElement | null = null; return () => (el ??= cv(1, 1)); })();

/** A floor decal: nothing standing (a 1-px empty image), its paint in the ground pass. */
function decal(img: HTMLCanvasElement, ax: number, ay: number): Sprite {
  return { img: NONE(), ax: 0, ay: 0, floor: { img, x: -ax, y: -ay } };
}

/** An altar: a block of old stone on a step, a dry cloth over its top hanging in folds, two cold candle stubs, a dish. */
export function paintAltar(): Sprite {
  const W = 36, H = 32, img = cv(W, H), c = img.getContext('2d')!;
  plinth(c, 0, H, W, 1, 3, RAMP.stone);
  blocks(c, 3, 12, 30, 17, RAMP.stone, 201, { bw: 10, bh: 6, cracks: .3 });
  rect(c, 3, 28, 30, 1, RAMP.stone[1]);
  // The slab on top, lit.
  rect(c, 1, 8, 34, 5, RAMP.stone[4]); rect(c, 1, 8, 34, 1, RAMP.stone[6]); rect(c, 1, 12, 34, 1, RAMP.stone[2]);
  // The cloth: a dusty wine-dark runner, its folds hanging over the front.
  const cloth = ['#3a1c22', '#54283a', '#6e3a4a', '#8a5060'];
  rect(c, 8, 8, 20, 4, cloth[2]); rect(c, 8, 8, 20, 1, cloth[3]);
  for (let x = 8; x < 28; x++) { const len = 9 + Math.round(Math.sin(x * .9) * 2) + (x % 5 === 0 ? 2 : 0), t = x % 4 === 0 ? 1 : x % 4 === 3 ? 0 : 2; rect(c, x, 12, 1, len, cloth[t]); }
  for (let x = 9; x < 28; x += 3) px(c, x, 21 + (x % 2), RAMP.cream[1]);
  // Candles, burned down and cold; a bronze dish between them.
  for (const x of [4, 30]) { rect(c, x, 3, 3, 6, RAMP.cream[2]); rect(c, x, 3, 1, 6, RAMP.cream[4]); rect(c, x + 2, 4, 1, 5, RAMP.cream[0]); px(c, x + 1, 2, '#2a2026'); rect(c, x - 1, 8, 5, 1, RAMP.cream[1]); }
  rect(c, 15, 6, 6, 2, '#8a6a3a'); rect(c, 14, 5, 8, 1, '#c9a46a'); px(c, 15, 5, '#e8d090');
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, shadow: groundShadow(W, W / 2) };
}

/** A brazier: an iron bowl on three legs. Unlit, cold ash; lit, a living flame and a fixed light (four tiles). */
export function paintBrazier(lit: boolean): Sprite {
  const W = 22, H = lit ? 40 : 30, img = cv(W, H), c = img.getContext('2d')!, top = H - 30;
  // Legs, splayed, lit on the left.
  for (const [x0, x1] of [[5, 2], [11, 11], [17, 20]] as const) for (let y = 0; y < 16; y++) { const x = Math.round(x0 + (x1 - x0) * y / 15); px(c, x, top + 14 + y, y < 2 ? RAMP.iron[4] : RAMP.iron[2]); px(c, x + 1, top + 14 + y, RAMP.iron[1]); }
  rect(c, 4, top + 22, 14, 1, RAMP.iron[2]);
  // The bowl: rim lit, body shaded round, rivets.
  for (let y = 0; y < 7; y++) { const half = Math.round(10 - y * .9); for (let x = -half; x < half; x++) { const u = (x + half) / (half * 2); px(c, 11 + x, top + 8 + y, u < .25 ? RAMP.iron[4] : u < .6 ? RAMP.iron[3] : RAMP.iron[2]); } }
  rect(c, 1, top + 7, 20, 2, RAMP.iron[4]); rect(c, 1, top + 7, 20, 1, RAMP.iron[5]);
  for (let x = 4; x < 19; x += 4) px(c, x, top + 11, RAMP.iron[5]);
  if (lit) {
    // Coals glowing in the bowl, a tall flame over them, sparks.
    for (let x = 3; x < 19; x++) px(c, x, top + 6, x % 3 ? RAMP.ember[1] : RAMP.ember[3]);
    rect(c, 4, top + 5, 14, 1, RAMP.ember[2]);
    flame(c, 11, top + 6, 15, RAMP.ember, 1); flame(c, 7, top + 6, 8, RAMP.ember, 2); flame(c, 15, top + 6, 9, RAMP.ember, 3);
    for (const [x, y] of [[5, 2], [16, 4], [10, 0]] as const) px(c, x, y, RAMP.ember[4]);
  } else {
    // Cold: grey ash heaped in the bowl, a charred stick end.
    for (let x = 3; x < 19; x++) { const h = Math.round(Math.sin(((x - 3) / 15) * Math.PI) * 2); rect(c, x, top + 7 - h, 1, h + 1, hash(x, 1, 211) > .5 ? '#6b6670' : '#8a8590'); }
    rect(c, 12, top + 3, 5, 1, '#2a2026'); px(c, 16, top + 2, '#3a3036');
  }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, shadow: groundShadow(W, W / 2), ...(lit ? { lights: [{ x: 0, y: -24, r: 64, warm: true }] } : {}) };
}

/** A hanging cage of iron: a ring and chain, a domed hood, bars shaded round, a floor plate, old bones inside. */
export function paintCage(): Sprite {
  const W = 26, H = 48, img = cv(W, H), c = img.getContext('2d')!;
  // The chain up to the dark and the ring.
  for (let y = 0; y < 8; y++) px(c, 13, y, y % 2 ? RAMP.iron[4] : RAMP.iron[2]);
  rect(c, 11, 8, 5, 2, RAMP.iron[3]); px(c, 11, 8, RAMP.iron[5]);
  // The hood: a dome.
  for (let y = 0; y < 6; y++) { const half = Math.round(4 + y * 1.6); rect(c, 13 - half, 10 + y, half * 2 + 1, 1, y < 2 ? RAMP.iron[4] : RAMP.iron[2]); px(c, 13 - half, 10 + y, RAMP.iron[5]); }
  // The plate and its base ring.
  rect(c, 2, 40, 23, 4, RAMP.iron[3]); rect(c, 2, 40, 23, 1, RAMP.iron[5]); rect(c, 2, 43, 23, 1, RAMP.iron[1]);
  // Bones in the dark inside.
  rect(c, 6, 37, 14, 3, '#1a1418'); rect(c, 7, 37, 7, 1, '#d8d0bc'); rect(c, 15, 35, 4, 3, '#e8e1cf'); px(c, 16, 36, '#3a2a2a'); px(c, 18, 36, '#3a2a2a'); rect(c, 9, 38, 5, 1, '#8a8270');
  // The bars, front ones lit on the left, the back ones dim through the gaps.
  for (let i = 0; i < 6; i++) { const x = 4 + i * 4; rect(c, x + 1, 16, 1, 24, RAMP.iron[1]); }
  for (let i = 0; i < 6; i++) { const x = 3 + i * 4, t = i < 2 ? 5 : i < 4 ? 4 : 3; rect(c, x, 16, 1, 24, RAMP.iron[t]); rect(c, x + 1, 16, 1, 24, RAMP.iron[2]); }
  for (const y of [16, 28, 39]) { rect(c, 2, y, 23, 1, RAMP.iron[3]); rect(c, 2, y, 6, 1, RAMP.iron[5]); }
  // The door: a hinge and a hanging lock.
  rect(c, 17, 30, 3, 4, RAMP.iron[3]); px(c, 18, 32, '#0a0608'); rect(c, 17, 29, 3, 1, RAMP.iron[5]);
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, shadow: groundShadow(W, W / 2) };
}

/** Chains on a wall: two runs from ring bolts, shaded links, a manacle at each end. Hung on a wall's face, blocking nothing. */
export function paintChains(): Sprite {
  const W = 16, H = 30, img = cv(W, H), c = img.getContext('2d')!;
  for (const [x0, len, sway] of [[3, 20, 2], [11, 15, -2]] as const) {
    rect(c, x0 - 1, 1, 3, 3, RAMP.iron[2]); px(c, x0 - 1, 1, RAMP.iron[5]); px(c, x0, 2, '#0a0608');
    for (let i = 0; i < len; i++) {
      const x = x0 + Math.round(Math.sin((i / len) * Math.PI) * sway), y = 4 + i;
      if (i % 3 === 0) { px(c, x - 1, y, RAMP.iron[4]); px(c, x + 1, y, RAMP.iron[2]); } else px(c, x, y, i % 3 === 1 ? RAMP.iron[5] : RAMP.iron[3]);
    }
    const ex = x0 + Math.round(Math.sin(Math.PI) * sway), ey = 4 + len;
    rect(c, ex - 2, ey, 5, 3, RAMP.iron[3]); rect(c, ex - 2, ey, 5, 1, RAMP.iron[5]); px(c, ex, ey + 1, '#0a0608');
  }
  // Rust where the wall wept under them.
  for (const [x, y] of [[3, 5], [4, 8], [11, 6]] as const) px(c, x + 1, y, '#6e3a22');
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1 };
}

/** A broken statue on its pedestal: legs and a torso to the chest, the break jagged, the head fallen at its foot. */
export function paintBrokenStatue(): Sprite {
  const W = 30, H = 50, img = cv(W, H), c = img.getContext('2d')!;
  const s = RAMP.stone;
  // The pedestal: courses, a lit top, a worn inscription band.
  blocks(c, 3, 34, 24, 14, s, 221, { bw: 8, bh: 5, cracks: .3 });
  rect(c, 1, 32, 28, 3, s[4]); rect(c, 1, 32, 28, 1, s[6]); rect(c, 1, 34, 28, 1, s[2]);
  for (let x = 7; x < 23; x += 3) px(c, x, 40, s[1]);
  // The figure: robed legs, a hand at its side, the torso broken off at the chest.
  for (let y = 10; y < 32; y++) {
    const half = Math.round(5 + (y - 10) * .2);
    for (let x = -half; x <= half; x++) { const u = (x + half) / (half * 2); px(c, 15 + x, y, u < .25 ? s[5] : u < .55 ? s[4] : u < .8 ? s[3] : s[2]); }
    if (y > 14 && y % 4 === 0) { px(c, 13, y, s[3]); px(c, 17, y, s[2]); }
  }
  rect(c, 8, 16, 3, 9, s[4]); rect(c, 8, 16, 1, 9, s[6]); rect(c, 8, 25, 3, 2, s[3]);
  // The break: a jagged lit top, a crack running down.
  for (let x = 9; x < 22; x++) { const d = Math.floor(hash(x, 2, 222) * 4); c.clearRect(x, 10, 1, d); px(c, x, 10 + d, s[6]); }
  for (let y = 13; y < 30; y++) px(c, 16 + Math.round(Math.sin(y * .7)), y, s[1]);
  // The head on the ground at its foot, and chips of stone.
  rect(c, 20, 44, 8, 6, s[4]); rect(c, 21, 43, 6, 1, s[5]); rect(c, 20, 44, 2, 5, s[6]); rect(c, 26, 45, 2, 5, s[2]);
  px(c, 22, 46, s[1]); px(c, 25, 46, s[1]); rect(c, 23, 48, 2, 1, s[2]);
  for (const [x, y] of [[2, 47], [5, 48], [10, 47]] as const) { rect(c, x, y, 2, 2, s[3]); px(c, x, y, s[5]); }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1, shadow: groundShadow(W, W / 2) };
}

/** A readable inscription set in a wall's face: a carved stone plaque, lines of Cant glyphs, dust in the cuts. */
export function paintInscription(): Sprite {
  const W = 16, H = 22, img = cv(W, H), c = img.getContext('2d')!;
  const s = RAMP.stone;
  rect(c, 0, 0, W, H, s[3]); rect(c, 0, 0, W, 1, s[6]); rect(c, 0, 0, 1, H, s[5]); rect(c, W - 1, 0, 1, H, s[1]); rect(c, 0, H - 1, W, 1, s[1]);
  rect(c, 2, 2, W - 4, H - 4, s[4]); rect(c, 2, 2, W - 4, 1, s[2]);
  for (let row = 0; row < 4; row++) {
    for (let x = 3; x < W - 3;) {
      const w = 1 + Math.floor(hash(x, row, 231) * 3);
      if (hash(x, row, 232) > .2) { rect(c, x, 5 + row * 4, w, 2, s[1]); px(c, x, 7 + row * 4, s[6]); if (hash(x, row, 233) > .6) px(c, x, 4 + row * 4, s[1]); }
      x += w + 1;
    }
  }
  return { img: outlined(img), ax: W / 2 + 1, ay: H + 1 };
}

/** A cobweb strung across a room's corner (`corner` the wall corner it hangs from): silk radials and sagging arcs. */
export function paintCobweb(corner: 'nw' | 'ne' = 'nw'): Sprite {
  const S = 18, img = cv(S, S), c = img.getContext('2d')!;
  const silk = (x: number, y: number, a: number) => { c.fillStyle = `rgba(226,222,236,${a})`; c.fillRect(corner === 'nw' ? x : S - 1 - x, y, 1, 1); };
  for (let k = 0; k < 5; k++) { const a = (k / 4) * Math.PI / 2; for (let r = 0; r < S; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r); if (x < S && y < S) silk(x, y, r < 4 ? .7 : .45); } }
  for (const R of [5, 9, 13]) for (let i = 0; i <= R * 2; i++) { const a = (i / (R * 2)) * Math.PI / 2, sag = Math.sin(a * 2) * R * .12; const x = Math.round(Math.cos(a) * (R - sag)), y = Math.round(Math.sin(a) * (R - sag)); silk(x, y, .5); }
  silk(6, 7, .9); silk(7, 7, .9);
  return decal(img, corner === 'nw' ? 0 : S, 0);
}

/** A ritual circle chalked (or salted) on the floor in 3/4: two rings, runes between them, a five-point star, worn in places. */
export function paintRitualCircle(): Sprite {
  const W = 48, H = 30, img = cv(W, H), c = img.getContext('2d')!;
  const chalk = (x: number, y: number, a = .7) => { if (hash(x, y, 241) < .14) return; c.fillStyle = `rgba(232,228,214,${a})`; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const cx = W / 2, cy = H / 2;
  for (const [rx, ry] of [[22, 13], [18, 10.5]] as const) for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; chalk(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, x = cx + Math.cos(a) * 20, y = cy + Math.sin(a) * 11.8; chalk(x, y - 1, .8); chalk(x, y, .8); if (k % 2) chalk(x + 1, y, .8); else chalk(x - 1, y - 1, .8); }
  const pts = [0, 2, 4, 1, 3, 0].map(k => { const a = -Math.PI / 2 + (k / 5) * Math.PI * 2; return [cx + Math.cos(a) * 17, cy + Math.sin(a) * 9.6]; });
  for (let i = 0; i < 5; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let t = 0; t <= n; t++) chalk(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n, .5); }
  return decal(img, W / 2, H / 2 + 4);
}

/** An old dry stain on the floor: rust-brown, cracked and faded at its edges (never red, never fresh). */
export function paintStain(): Sprite {
  const W = 24, H = 13, img = cv(W, H), c = img.getContext('2d')!;
  const tone = ['rgba(74,46,30,.62)', 'rgba(94,60,38,.5)', 'rgba(110,74,48,.32)'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - 11) / 11, (y - 6) / 5.5) + (hash(x >> 1, y >> 1, 251) - .5) * .5;
    if (d > 1) continue;
    if (d > .78 && (x + y) % 2) continue;
    const t = d < .45 ? 0 : d < .78 ? 1 : 2;
    c.fillStyle = tone[t]; c.fillRect(x, y, 1, 1);
  }
  // Cracks where it dried; a splash or two beside it, as old.
  for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(40,24,16,.5)'; c.fillRect(6 + i * 2, 5 + (i % 2), 1, 1); }
  c.fillStyle = tone[1]; c.fillRect(2, 2, 1, 1); c.fillRect(21, 10, 2, 1);
  return decal(img, W / 2, H / 2 + 2);
}

/** Rime: frost crusted on the floor, pale crystals in feathers, a glint. */
export function paintRime(): Sprite {
  const W = 28, H = 15, img = cv(W, H), c = img.getContext('2d')!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - 13.5) / 13.5, (y - 7) / 7) + (hash(x >> 1, y, 261) - .5) * .6;
    if (d > 1) continue;
    const a = d < .4 ? .55 : d < .7 ? .38 : (x + y) % 2 ? .22 : 0;
    if (!a) continue;
    c.fillStyle = `rgba(214,236,250,${a})`; c.fillRect(x, y, 1, 1);
  }
  // Feathered crystals: short diagonal strokes, lit tips.
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(hash(i, 1, 262) * 21), y = 2 + Math.floor(hash(i, 2, 262) * 10);
    for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(240,250,255,.8)'; c.fillRect(x + k, y - k, 1, 1); c.fillRect(x - k, y - k, 1, 1); }
  }
  c.fillStyle = '#ffffff'; c.fillRect(9, 4, 1, 1); c.fillRect(18, 8, 1, 1);
  return decal(img, W / 2, H / 2 + 2);
}
