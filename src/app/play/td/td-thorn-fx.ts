/**
 * td-thorn-fx.ts — the Thornstrider's pictures (docs/design/effects-spec.md, "The Thornstrider" section).
 *
 * The same rules as every effect: whole art pixels, three tones per element (core · body · edge), ground under the
 * creatures and air over them at ≤ 60% where it covers a body, nothing past a second but what lasts (the snare, a trap,
 * a beast, a root, a bleed, Command's mark), and a still frame under reduced motion — never no picture. Three palettes
 * join the kit: **thorn** (the arrow's green tip, the bow's fletch), **wild** (the beasts' rootglass spirit light — the
 * Verdant's own, td-mobs R.rootglass) and **briar** (bark and thorn).
 *
 * The engine calls: `drawThornZones` (the snare's thorns and a hidden trap, on the floor), `drawThornGround` (a trap
 * springing, the stampede's dust, Rootwalk's moss), `drawThornAir` (the moment effects), `drawThornState` (what lasts:
 * roots at a creature's feet, a bleed, Command's mark over the sent-at foe, Pack Bond's thread to the beast),
 * `drawArrow` (one in flight) and `drawBeast` (a called beast or one of the stampede, y-sorted with the world).
 */
import { mobCell } from './td-mobs';
import { burst, drawBurst, glowSquare, groundRing, linePixels, type Tones } from './td-fx';
import { PET_H, PET_W, petFrameIndex, petSheet, type TdPetFrame } from './td-pet-art';
import { SPIRIT_BEAST } from './td-thorn';

type Ctx = CanvasRenderingContext2D;

/** The bow's green, the wild beasts' spirit light, the briar's bark (effects-spec rule 2). */
export const THORN_FX: Readonly<Record<'thorn' | 'wild' | 'briar' | 'blood', Tones>> = {
  thorn: { core: '#e8f5b0', body: '#8fc25a', edge: '#4a6b2a' },
  wild: { core: '#f0fff8', body: '#9af0d0', edge: '#4cb898' },
  briar: { core: '#c9a66b', body: '#7a5a32', edge: '#3e2a18' },
  blood: { core: '#f08070', body: '#c43a3a', edge: '#6a1a1a' },
};
const SHAFT = '#a07a4a', NOCK = '#e8dcc0', LEAF = '#6eae52', LEAF_HI = '#b4e08a', LEAF_LO = '#467a38';

const KINDS = new Set(['arrow-hit', 'bleed', 'loose', 'command', 'wild-call', 'trample', 'snare-rise', 'trap-set', 'trap-spring', 'rootwalk']);
const GROUND = new Set(['trap-spring', 'trample', 'rootwalk']);
export function isThornFx(kind: string): boolean { return KINDS.has(kind); }

interface FxLike { kind: string; x: number; y: number; age: number; life: number; dir: number; r?: number; a?: number }
interface ZoneLike { kind: string; x: number; y: number; r: number; t: number; pts?: { x: number; y: number }[] }
interface MobLike { x: number; y: number; hp: number; def: { h: number; w: number }; rootT?: number; bleedT?: number }

/** An arrow in flight: a green-tipped point, a bark shaft three pixels long, a pale nock and a green fletch behind. */
export function drawArrow(c: Ctx, x: number, y: number, vx: number, vy: number): void {
  const d = Math.hypot(vx, vy) || 1, ux = vx / d, uy = vy / d, X = Math.round(x), Y = Math.round(y);
  const at = (k: number) => ({ x: Math.round(X - ux * k), y: Math.round(Y - uy * k) });
  const dot = (k: number, col: string, w = 1) => { const q = at(k); c.fillStyle = col; c.fillRect(q.x, q.y, w, w); };
  c.globalAlpha = 1;
  // The fletch: two green pixels either side of the tail.
  const tail = at(6), nx = Math.round(-uy * 1.5), ny = Math.round(ux * 1.5);
  c.fillStyle = LEAF; c.fillRect(tail.x + nx, tail.y + ny, 1, 1); c.fillStyle = LEAF_LO; c.fillRect(tail.x - nx, tail.y - ny, 1, 1);
  // A dark line under the shaft so it reads against grass and stone alike (the outline rule).
  c.globalAlpha = .55; for (let k = 0; k <= 6; k++) { const q = at(k); c.fillStyle = '#140c1c'; c.fillRect(q.x, q.y + 1, 1, 1); }
  c.globalAlpha = 1;
  for (let k = 2; k <= 6; k++) dot(k, k === 6 ? NOCK : SHAFT);
  dot(1, THORN_FX.thorn.body); dot(0, THORN_FX.thorn.core);
}

/** The ground's pieces: the Thornroot Snare's line of thorns, and a trap hidden on the ground. */
export function drawThornZones(c: Ctx, zones: readonly ZoneLike[], time: number, still: boolean): void {
  for (const z of zones) {
    const fade = Math.min(1, z.t / .5);
    if (z.kind === 'snare' && z.pts) {
      // Each tile of the line: a clump of thorned roots out of torn earth, the thorns stepping between two heights.
      z.pts.forEach((q, i) => {
        const X = Math.round(q.x), Y = Math.round(q.y), f = still ? 0 : Math.floor(time * 3 + i) % 2;
        c.globalAlpha = .7 * fade; c.fillStyle = THORN_FX.briar.edge; c.fillRect(X - 6, Y - 1, 12, 3);
        c.globalAlpha = fade;
        for (const [dx, h] of [[-5, 4], [-2, 6], [1, 5], [4, 3]] as const) {
          const hh = h + (dx % 2 ? f : 0);
          c.fillStyle = THORN_FX.briar.body; c.fillRect(X + dx, Y - hh, 1, hh);
          c.fillStyle = THORN_FX.briar.core; c.fillRect(X + dx, Y - hh, 1, 1);
          c.fillStyle = THORN_FX.briar.edge; c.fillRect(X + dx + 1, Y - hh + 2, 1, 1);
        }
        c.fillStyle = LEAF; c.fillRect(X - 3, Y - 3, 2, 1); c.fillStyle = LEAF_HI; c.fillRect(X + 2, Y - 4, 1, 1);
      });
    } else if (z.kind === 'trap') {
      // A trap: a ring of bramble on the ground, its jaws of thorn closed, a faint ring of where it reaches.
      const X = Math.round(z.x), Y = Math.round(z.y), R = Math.round(z.r);
      c.globalAlpha = .35 * fade;
      for (const [i, q] of groundRing(R).entries()) if (i % 4 === 0) { c.fillStyle = THORN_FX.briar.core; c.fillRect(X + q.x, Y + q.y, 1, 1); }
      c.globalAlpha = fade;
      c.fillStyle = THORN_FX.briar.edge; c.fillRect(X - 5, Y - 2, 10, 4);
      c.fillStyle = THORN_FX.briar.body; c.fillRect(X - 4, Y - 2, 8, 3);
      for (const dx of [-4, -1, 2]) { c.fillStyle = THORN_FX.briar.core; c.fillRect(X + dx, Y - 4, 1, 2); c.fillRect(X + dx + 1, Y + 1, 1, 2); }
      c.fillStyle = LEAF; c.fillRect(X - 1, Y - 1, 2, 1);
    }
  }
  c.globalAlpha = 1;
}

/** Ground: a trap springing (its ring of thorns snapping out), the stampede's dust, Rootwalk's moss. Returns whether it drew. */
export function drawThornGround(c: Ctx, e: FxLike, still: boolean): boolean {
  if (!GROUND.has(e.kind)) return false;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), fade = still ? 1 : Math.max(0, 1 - t);
  if (e.kind === 'trap-spring') {
    const R = e.r ?? 24, k = still ? 1 : 1 - (1 - t) * (1 - t), r = Math.max(3, Math.round(4 + (R - 4) * k));
    c.globalAlpha = fade;
    for (const [i, q] of groundRing(r).entries()) {
      if (i % 3) continue;
      c.fillStyle = i % 2 ? THORN_FX.briar.core : THORN_FX.briar.body; c.fillRect(X + q.x, Y + q.y - 2, 1, 3);
    }
  } else if (e.kind === 'trample') {
    // Hoof-dust: four grey-green puffs rising and thinning behind a running beast.
    c.globalAlpha = .6 * fade;
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#8a9a7a' : '#5e6e52'; c.fillRect(X - e.dir * i * 2, Y - Math.round((still ? .5 : t) * 4) - i % 2, 2, 2); }
  } else if (e.kind === 'rootwalk') {
    // Moss filling in a footprint behind the Keeper (the forest closing behind him).
    c.globalAlpha = .8 * fade;
    c.fillStyle = LEAF_LO; c.fillRect(X - 2, Y, 4, 2); c.fillStyle = LEAF; c.fillRect(X - 1, Y, 2, 1);
    if (e.dir === 2) { c.fillStyle = LEAF_HI; for (const [dx, dy] of [[-6, -2], [5, -1], [-3, 2], [4, 3]] as const) c.fillRect(X + dx, Y + dy, 1, 1); }
  }
  c.globalAlpha = 1;
  return true;
}

/** Air: the pictures that live a moment. Returns whether the kind is the Thornstrider's (the engine then skips it). */
export function drawThornAir(c: Ctx, e: FxLike, still: boolean, overFoe: (x: number, y: number) => boolean): boolean {
  if (!isThornFx(e.kind)) return false;
  if (GROUND.has(e.kind)) return true;
  if (e.age < 0) return true;
  const t = e.age / e.life, X = Math.round(e.x), Y = Math.round(e.y), bt = still ? .5 : t, seed = (X * 7 + Y * 13) | 0;
  const fade = still ? 1 : Math.max(0, 1 - t);
  const dot = (x: number, y: number, col: string, a = 1, w = 1, h = 1) => {
    c.globalAlpha = overFoe(x, y) ? Math.min(.6, a * fade) : a * fade; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  if (e.kind === 'arrow-hit') {
    // The hit tell: splinters of shaft and a green spark thrown back along the flight, a white pixel where it bit.
    c.globalAlpha = Math.min(.6, fade); drawBurst(c, X, Y, burst(6, bt, seed, 6, 3), THORN_FX.thorn);
    const a = (e.a ?? 0) + Math.PI;
    for (let k = 1; k <= 3; k++) dot(X + Math.cos(a + (k - 2) * .5) * (2 + k * 2 * (still ? .6 : t + .3)), Y + Math.sin(a + (k - 2) * .5) * (2 + k * 2 * (still ? .6 : t + .3)), SHAFT, .9);
    dot(X, Y, '#ffffff', .9);
  } else if (e.kind === 'bleed') {
    // Drops of blood falling from the barb.
    const fall = Math.round((still ? .5 : t) * 7);
    dot(X, Y + fall, THORN_FX.blood.body, .9, 1, 2); dot(X + 2, Y + fall - 2, THORN_FX.blood.edge, .8); dot(X - 2, Y + fall + 1, THORN_FX.blood.core, .7);
  } else if (e.kind === 'loose') {
    // The bow's twang: three pale pixels of the string snapping back, a puff of green off the fletch.
    const a = e.a ?? 0, bx = -Math.cos(a), by = -Math.sin(a);
    for (let k = 0; k < 3; k++) dot(X + bx * (2 + k), Y + by * (2 + k) + (k - 1), k === 1 ? NOCK : THORN_FX.thorn.body, .8);
  } else if (e.kind === 'command') {
    // Command: a green chevron drops over the foe, points down at it and holds a moment.
    const drop = still ? 0 : Math.round(Math.max(0, .3 - t) * 12);
    for (let i = 0; i < 4; i++) { dot(X - 4 + i, Y - drop - 4 + i, LEAF_HI, 1); dot(X + 3 - i, Y - drop - 4 + i, LEAF_HI, 1); }
    dot(X - 1, Y - drop, THORN_FX.wild.core, 1, 2, 1);
  } else if (e.kind === 'wild-call') {
    // A beast called out of the green: a spiral of leaf pixels round where it steps out (a stampede's twice as wide).
    const n = 10, R = e.dir === 2 ? 16 : 9, turn = still ? 0 : t * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + i / n * Math.PI * 2, r = R * (.4 + .6 * (i / n)) * (still ? 1 : .6 + t * .6);
      dot(X + Math.cos(a) * r, Y - 6 + Math.sin(a) * r * .6, i % 3 ? LEAF : i % 2 ? LEAF_HI : THORN_FX.wild.body, .9);
    }
    if (e.dir !== -1) glowSquare(c, X, Y - 6, 3, THORN_FX.wild, .5 * fade);
  } else if (e.kind === 'snare-rise') {
    // Thorns pushing up out of the ground, two steps high.
    const h = still ? 4 : Math.min(5, Math.round(t * 12));
    for (const dx of [-3, 0, 3]) for (let y = 0; y < h; y++) dot(X + dx, Y - y, y === h - 1 ? THORN_FX.briar.core : THORN_FX.briar.body, 1);
  } else if (e.kind === 'trap-set') {
    // Leaves settling over the trap as it is hidden.
    for (let i = 0; i < 5; i++) dot(X - 6 + i * 3, Y - 6 + Math.round((still ? .5 : t) * 6) + (i % 2) * 2, i % 2 ? LEAF : LEAF_HI, .9);
  }
  c.globalAlpha = 1;
  return true;
}

/**
 * What lasts: thorned roots round a rooted creature's feet, a blood drop by a bleeding one, Command's chevron over the
 * sent-at foe, and Pack Bond's thread — a dotted line of green light from the Keeper to his beast while the bond holds.
 */
export function drawThornState(c: Ctx, st: { mobs: readonly MobLike[]; commanded: MobLike | null; bond: { x: number; y: number } | null; keeper: { x: number; y: number } }, time: number, still: boolean): void {
  for (const m of st.mobs) {
    const X = Math.round(m.x), Y = Math.round(m.y);
    if ((m.rootT ?? 0) > 0) {
      const w = Math.max(5, Math.round(mobCell(m.def).w / 3));
      for (let i = -w; i <= w; i += 3) {
        const h = 2 + ((i + w) % 2);
        c.fillStyle = THORN_FX.briar.body; c.fillRect(X + i, Y - h, 1, h);
        c.fillStyle = THORN_FX.briar.core; c.fillRect(X + i, Y - h, 1, 1);
      }
      c.fillStyle = LEAF_LO; c.fillRect(X - w, Y, w * 2, 1);
    }
    if ((m.bleedT ?? 0) > 0) {
      const k = still ? 0 : Math.floor(time * 3) % 3;
      c.fillStyle = THORN_FX.blood.body; c.fillRect(X + Math.round(mobCell(m.def).w / 4), Y - Math.round(mobCell(m.def).h * .6) + k, 1, 2);
      c.fillStyle = THORN_FX.blood.edge; c.fillRect(X + Math.round(mobCell(m.def).w / 4), Y - Math.round(mobCell(m.def).h * .6) + k + 2, 1, 1);
    }
  }
  const f = st.commanded;
  if (f) {
    const X = Math.round(f.x), Y = Math.round(f.y - mobCell(f.def).h - 6), bob = still ? 0 : Math.round(Math.sin(time * 6));
    for (let i = 0; i < 3; i++) { c.fillStyle = i ? LEAF : LEAF_HI; c.fillRect(X - 3 + i, Y + bob + i, 1, 1); c.fillRect(X + 3 - i, Y + bob + i, 1, 1); }
    c.fillStyle = THORN_FX.wild.core; c.fillRect(X, Y + bob + 3, 1, 1);
  }
  const b = st.bond;
  if (b) {
    // Every third pixel of the line, turning slowly along it (still: fixed), at half strength.
    const pts = linePixels(st.keeper.x, st.keeper.y - 6, b.x, b.y - 6), shift = still ? 0 : Math.floor(time * 8);
    c.globalAlpha = .45;
    pts.forEach((q, i) => { if ((i + shift) % 4) return; c.fillStyle = (i + shift) % 8 ? THORN_FX.wild.body : THORN_FX.wild.core; c.fillRect(q.x, q.y, 1, 1); });
    c.globalAlpha = 1;
  }
}

/** A beast of the wild (a called beast, one of a stampede): the spirit beast's sheet, half-seen, a mint glow beneath. */
export function drawBeast(c: Ctx, b: { x: number; y: number; face: number; age: number; kind: 'called' | 'stampede' }, time: number, still: boolean): void {
  const sheet = petSheet(SPIRIT_BEAST);
  if (!sheet || b.age < 0) return;
  const X = Math.round(b.x), Y = Math.round(b.y), run = b.kind === 'stampede';
  const frame: TdPetFrame = still ? 'walk0' : (`walk${Math.floor((time + b.x * .01) * (run ? 14 : 9)) % 4}` as TdPetFrame);
  c.globalAlpha = .35; c.fillStyle = THORN_FX.wild.edge;
  c.fillRect(X - 6, Y - 1, 12, 2);
  c.globalAlpha = run ? .62 : .78;
  c.save();
  c.translate(X, Y - PET_H + 1);
  if (b.face < 0) c.scale(-1, 1);
  c.drawImage(sheet, petFrameIndex(frame) * PET_W, 0, PET_W, PET_H, -PET_W / 2, 0, PET_W, PET_H);
  c.restore();
  c.globalAlpha = 1;
}
