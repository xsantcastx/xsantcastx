/**
 * td-mobs.ts — monsters, fighting and ground loot in the top-down world (owner, 2026-10-19: "dungeons and mysterious
 * places, items drops monsters like if it was tibia style").
 *
 * Tibia's rules, cozy-sized: creatures roam near where they spawned and chase the Keeper on sight; the Keeper fights by
 * targeting one (a tap on it, or the attack key for the nearest) and swings while in reach; damage floats up in numbers;
 * a kill leaves its loot ON THE GROUND (coins, materials, rolled gear glowing in its rarity colour) to walk over and
 * pick up. A spawn comes back a while after its creature falls. Falling in a fight wakes the Keeper in the square.
 *
 * The host does the bookkeeping exactly as the side view did: onKill (Hunting XP, quests), rollLoot (gear) and onLoot
 * (into the satchel). Nothing here touches a save.
 */
import type { EngineOptions, LootRow } from '../engine/engine.model';
import type { LootRarity } from '../world/world.model';
import { TILE } from './td-art';
import { rollPotionDrop } from '../../shared/potions/potions.model';
import { LOOT } from './td-fx';
import { CRIT_MULT, MANA_REGEN, MAX_MANA, SKILLS, incomingDamage, type SkillId } from './td-skills';
import { DAMAGE_COLORS, type DamageType, type Element } from '../../shared/loot/damage.model';
import { creatureHits, isKnownCreature } from '../../shared/loot/creature-families';

export interface MobDef {
  id: string;
  name: string;
  hp: number;
  /** Art px per second. */
  speed: number;
  dmg: [number, number];
  /** Seconds between its bites. */
  rate: number;
  sight: number;
  level: number;
  /** One line of the world's voice for the Bestiary (td-bestiary.ts). */
  lore?: string;
  coins: [number, number];
  drops: readonly { material: string; qty: number; chance: number }[];
  paint: (c: CanvasRenderingContext2D, frame: number) => void;
  w: number;
  h: number;
  /** Loot rank (shared/loot): a boss rolls more and better gear. Default 'normal'. */
  rank?: 'normal' | 'champion' | 'unique' | 'boss';
  /**
   * It shoots (a bone arrow, a fire bolt, a breath): within `range` art px it looses a shot every `rate` s that flies
   * straight at where its prey stood, so stepping aside dodges it; it backs off to stay `keep` px away (0: it closes in
   * and shoots as it comes). `spread` shots fan out (a breath).
   */
  ranged?: { range: number; keep: number; rate: number; dmg: [number, number]; speed: number; kind: MobShot['kind']; spread?: number };
  /** It drifts over lava and embers as if they were floor (a wraith). */
  floats?: boolean;
  /** Half there: drawn see-through, flickering. */
  ghost?: boolean;
  /** Once, when its life falls to `at` of its whole, it calls `count` of `type` to its side. */
  summon?: { type: string; count: number; at: number };
  /**
   * The type its blows and shots carry (§6). Unset: its creature family's (creature-families.ts creatureHits), or
   * physical for a creature with no profile.
   */
  hits?: DamageType;
}

/** The type a creature's blows and shots carry: its own, else its family's, else physical. */
export function mobHits(def: Pick<MobDef, 'id' | 'hits'>): DamageType {
  return def.hits ?? (isKnownCreature(def.id) ? creatureHits(def.id) : 'physical');
}

// ── The bestiary's brushes (the art pass, 2026-10-20: the creatures drawn to the new Keeper's standard) ──────────────
// Every surface is a shaded shape lit from the top-left (a highlight, the base, a shadow, the deep shadow at its foot);
// mobSheet adds the selective outline (each edge pixel a dark of the colour it borders) and, round a boss, a rim in
// its element's colour. Four frames: a walk or a hover (contact, passing, contact, passing).

/** A surface's tones: highlight, base, shadow, deep shadow. */
type Ramp = readonly [string, string, string, string];
type P2 = readonly [number, number];

/** The painter's frame: shapes are drawn grown by K from (OX, OY), so a boss is its kin's own shapes, every edge still a whole pixel. */
let K = 1, OX = 0, OY = 0;
function grown(k: number, ox: number, oy: number, draw: () => void): void {
  const was = [K, OX, OY] as const;
  K = k; OX = ox; OY = oy;
  try { draw(); } finally { [K, OX, OY] = was; }
}
const sx = (x: number) => OX + x * K, sy = (y: number) => OY + y * K;

function px(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  const x0 = Math.round(sx(x)), y0 = Math.round(sy(y));
  c.fillStyle = col; c.fillRect(x0, y0, Math.max(1, Math.round(sx(x + w)) - x0), Math.max(1, Math.round(sy(y + h)) - y0));
}
/** One pixel, never grown: a glint, a rivet, a spark. */
function dot(c: CanvasRenderingContext2D, x: number, y: number, col: string): void { c.fillStyle = col; c.fillRect(Math.round(sx(x)), Math.round(sy(y)), 1, 1); }

/** Fill the pixels of a box where `inside` holds (pixel space), lit from the top-left by the shape's own edges. */
function solid(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, r: Ramp): void {
  const h = Math.max(1, y1 - y0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    const v = (y - y0) / h;
    let col = r[1];
    if (!inside(x, y + 1)) col = r[3];
    else if (!inside(x + 1, y) || v > .64) col = r[2];
    else if ((!inside(x, y - 1) || !inside(x - 1, y)) && v < .5) col = r[0];
    c.fillStyle = col; c.fillRect(x, y, 1, 1);
  }
}
/** A shaded ellipse: a sphere's light (highlight up-left, the deep shadow down-right). */
function orb(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, r: Ramp): void {
  const X = sx(cx), Y = sy(cy), RX = Math.max(.6, rx * K), RY = Math.max(.6, ry * K);
  for (let y = Math.floor(Y - RY); y <= Math.ceil(Y + RY); y++) for (let x = Math.floor(X - RX); x <= Math.ceil(X + RX); x++) {
    const nx = (x + .5 - X) / RX, ny = (y + .5 - Y) / RY, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = -.55 * nx - .65 * ny + .45 * Math.sqrt(1 - d);
    c.fillStyle = l > .78 ? r[0] : l > .02 ? r[1] : l > -.5 ? r[2] : r[3];
    c.fillRect(x, y, 1, 1);
  }
}
/** A shaded polygon. */
function poly(c: CanvasRenderingContext2D, pts: readonly P2[], r: Ramp): void {
  const q = pts.map(([x, y]) => [sx(x), sy(y)] as const);
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  const inside = (x: number, y: number) => {
    const X = x + .5, Y = y + .5;
    let on = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [ax, ay] = q[i], [bx, by] = q[j];
      if ((ay > Y) !== (by > Y) && X < (bx - ax) * (Y - ay) / (by - ay) + ax) on = !on;
    }
    return on;
  };
  solid(c, Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys)), inside, r);
}
/** A shaded limb (a bone, a leg, a haft) from p to q, `t` art px thick, round at both ends. */
function limb(c: CanvasRenderingContext2D, p: P2, q: P2, t: number, r: Ramp): void {
  const T = Math.max(1, Math.round(t * K)), off = T % 2 ? .5 : 0;
  const ax = Math.round(sx(p[0])) + off, ay = Math.round(sy(p[1])) + off, bx = Math.round(sx(q[0])) + off, by = Math.round(sy(q[1])) + off;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, rad = T / 2 + .01;
  const inside = (x: number, y: number) => {
    const X = x + .5, Y = y + .5, u = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / L));
    return Math.hypot(X - ax - u * dx, Y - ay - u * dy) <= rad;
  };
  solid(c, Math.floor(Math.min(ax, bx) - T), Math.floor(Math.min(ay, by) - T), Math.ceil(Math.max(ax, bx) + T), Math.ceil(Math.max(ay, by) + T), inside, r);
}
/** A hard 1px line, never grown thicker (a crack, a seam, a bowstring). */
function line(c: CanvasRenderingContext2D, p: P2, q: P2, col: string): void {
  const ax = sx(p[0]), ay = sy(p[1]), bx = sx(q[0]), by = sy(q[1]), n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n), 1, 1);
}
/** Something burning: a soft halo (left out of the outline), a body, a white-hot core. */
function glow(c: CanvasRenderingContext2D, x: number, y: number, size: number, hot: Ramp): void {
  const X = Math.round(sx(x)), Y = Math.round(sy(y)), s = Math.max(1, Math.round(size * K));
  // The halo adds light (it brightens what it falls on); over nothing it is a faint haze the outline leaves alone.
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .28; c.fillStyle = hot[1];
  c.fillRect(X - 1, Y, s + 2, s); c.fillRect(X, Y - 1, s, s + 2);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = hot[1]; c.fillRect(X, Y, s, s);
  c.fillStyle = hot[0]; c.fillRect(X, Y, Math.max(1, s - 1), Math.max(1, s - 1));
}
/** A tongue of flame `h` tall from its foot (x, y), flickering by frame. */
function flame(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, hot: Ramp = EMBER): void {
  const lean = [0, 1, 0, -1][f % 4], hh = h + [0, 1, 2, 1][f % 4];
  poly(c, [[x, y], [x + w, y], [x + w * .8, y - hh * .5], [x + w / 2 + lean, y - hh], [x + w * .2, y - hh * .55]], [hot[1], hot[1], hot[2], hot[2]]);
  if (w >= 3) poly(c, [[x + w * .25, y], [x + w * .75, y], [x + w / 2 + lean * .5, y - hh * .6]], [hot[0], hot[0], hot[1], hot[1]]);
}

const OUT = '#140c1c';
/** Element palettes (docs/design/effects-spec.md): white-hot core, body, edge, (a deeper edge for the fourth tone). */
const EMBER: Ramp = ['#fff2a8', '#ffb347', '#e2552a', '#9e2e1c'];
const VIOLET: Ramp = ['#f0e0ff', '#b06bff', '#6b3aa0', '#40205e'];
const BLOOD: Ramp = ['#ffd0c0', '#ff4a3a', '#a8201a', '#601010'];

const R = {
  ash: ['#c9bdc4', '#968a93', '#6a5f6b', '#433a4b'],
  ashDk: ['#8a7e88', '#625764', '#463d4c', '#2e2636'],
  obs: ['#6e6290', '#3c3354', '#272138', '#181324'],
  obsDk: ['#463c60', '#2a2440', '#1c182c', '#120e1c'],
  rust: ['#e6aa70', '#b47144', '#7e482c', '#50301e'],
  iron: ['#c2bccc', '#7c7688', '#524c5c', '#34303c'],
  imp: ['#ffa070', '#da4b2c', '#9c2c1c', '#621a14'],
  wing: ['#c04a30', '#82301e', '#5a1e16', '#3a140e'],
  robe: ['#86707f', '#5a4755', '#3e313c', '#271e28'],
  hood: ['#6e5a68', '#463844', '#30262f', '#1e171e'],
  bone: ['#fffaf0', '#e8e1cf', '#bdb197', '#857964'],
  vbone: ['#fdf6ff', '#ddd2ea', '#a99bc0', '#73648c'],
  orc: ['#aab882', '#77855c', '#566244', '#3a422e'],
  leather: ['#9c785c', '#6a4c3a', '#483428', '#2e211b'],
  wood: ['#b07a48', '#8a5a34', '#5a3820', '#3a2414'],
  char: ['#6a4c3c', '#4a3228', '#33221c', '#211612'],
  basalt: ['#78707c', '#4e4754', '#35303a', '#231f28'],
  red: ['#cc5c3c', '#923422', '#642016', '#42140e'],
  steel: ['#8c8a9c', '#5c5a6c', '#403e4e', '#2a2834'],
  cowl: ['#7e3c30', '#542622', '#3a1a18', '#26100e'],
  wraith: ['#86729e', '#544268', '#382b4a', '#221a30'],
  ghoul: ['#c8bec2', '#988d95', '#6c626b', '#483f48'],
  drake: ['#ffa264', '#dc4e2c', '#9c2e1c', '#621c14'],
  belly: ['#fff0b0', '#ffc262', '#dc8a30', '#9e5a1c'],
  slag: ['#907a68', '#5e4c42', '#40342e', '#28201c'],
  glass: ['#c4d4f8', '#524c76', '#302b48', '#1b172a'],
  crystal: ['#ffffff', '#b8c8f0', '#7a8cc4', '#4a5890'],
  gold: ['#fff0a0', '#e8b040', '#a87420', '#6a4414'],
  sov: ['#64505c', '#3e2c34', '#2c1e26', '#1a1016'],
  membrane: ['#6a5482', '#45365a', '#2e2440', '#1c1628'],
  void: ['#2a1c30', '#140c18', '#0e0812', '#08040a'],
  // The Verdant Wilds: moss, leaf and vine, a jungle cat's pelt, petals, bark, thorn, a bat's fur, a hart's coat, temple stone.
  moss: ['#a4d47e', '#62a04a', '#3f7034', '#264a22'],
  mossDk: ['#6e9a54', '#46703a', '#2e502a', '#1c341a'],
  stalker: ['#8a9c66', '#5a6e44', '#3c4c30', '#24301e'],
  vine: ['#9ad86e', '#55a03e', '#36702c', '#1e4818'],
  vineDk: ['#5e9a48', '#36702c', '#24521e', '#163412'],
  petal: ['#ffd6ec', '#ec6eac', '#a83c74', '#6a2048'],
  bark: ['#a87e56', '#74543a', '#4e3828', '#30221a'],
  thorn: ['#d4c098', '#94784e', '#644e32', '#3e2e1e'],
  thornDk: ['#94784e', '#644e32', '#46361f', '#2c2014'],
  bat: ['#9a88a8', '#64527a', '#443856', '#2a2236'],
  hart: ['#d8b07c', '#a4764c', '#6e4c30', '#46301e'],
  hartDk: ['#a4764c', '#76522f', '#523820', '#342416'],
  rootglass: ['#f0fff8', '#9af0d0', '#4cb898', '#2a7a64'],
  temple: ['#c4cab4', '#8e9682', '#666e5c', '#444a3c'],
  templeDk: ['#8e9682', '#666e5c', '#4a5042', '#30342a'],
} satisfies Record<string, Ramp>;
/** The rootglass glow (the Verdant Wilds' element): a mint-white core, a green-blue body. */
const ROOTGLOW: Ramp = ['#eafff6', '#7affd0', '#2fb38a', '#17604e'];

/** The walk: a leg's swing (forward, under, back, under), and the body's rise as a foot passes. */
const STEP = [2, 0, -2, 0] as const;
const BOB = [0, -1, 0, -1] as const;
/** A leg pair's lift: pair A steps on frame 1, pair B on frame 3. */
const liftA = (f: number) => f === 1 ? 2 : 0, liftB = (f: number) => f === 3 ? 2 : 0;

/** Four legs (far pair darker, drawn first): hips at x `back` and `front`, on row `hip`; feet on row `ground`. */
function legs4(c: CanvasRenderingContext2D, f: number, back: number, front: number, hip: number, ground: number, t: number, far: Ramp, near: Ramp, claw: string): void {
  const s = STEP[f];
  const leg = (x: number, swing: number, lift: number, r: Ramp) => {
    const fx = x + swing, fy = ground - lift;
    limb(c, [x, hip], [x + swing * .4 - 1, (hip + fy) / 2 + 1], t + 1, r);
    limb(c, [x + swing * .4 - 1, (hip + fy) / 2 + 1], [fx, fy - 1], t, r);
    px(c, fx - 1, fy, t + 2, 1, r[3]); dot(c, fx + t, fy, claw);
  };
  leg(back + 2, -s, liftB(f), far); leg(front + 2, s, liftA(f), far);
  leg(back, s, liftA(f), near); leg(front, -s, liftB(f), near);
}

// ── The beasts ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Ash Wolf: a lean grey-ember wolf of the Emberwood, a cinder in its eye and embers caught in its ruff. */
function paintWolf(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], wag = [0, 1, 0, -1][f];
  // Tail: a brush of grey fur held out behind, its tip still smouldering.
  poly(c, [[7, 9 + b], [3, 5 + wag], [1, 4 + wag], [2, 7 + wag], [5, 11 + b]], R.ash);
  legs4(c, f, 8, 19, 13 + b, 20, 2, R.ashDk, R.ash, R.bone[2]);
  orb(c, 13, 11.5 + b, 7.5, 3.8, R.ash);
  orb(c, 19.5, 10.5 + b, 4.2, 4.6, R.ash);
  px(c, 10, 14 + b, 8, 1, R.ash[2]);
  // The ruff: a jag of lighter fur along the back and the chest.
  for (let i = 0; i < 5; i++) dot(c, 8 + i * 2.5, 8 + b - (i % 2), R.ash[0]);
  dot(c, 22, 13 + b, R.ash[0]); dot(c, 21, 14 + b, R.ash[0]);
  // Head: two pricked ears, a long tapering muzzle.
  poly(c, [[20, 6 + b], [21, 1 + b], [23, 4 + b]], R.ashDk);
  orb(c, 23.5, 7.5 + b, 3.8, 3.5, R.ash);
  poly(c, [[23, 4 + b], [24.5, 0 + b], [26, 4 + b]], R.ash);
  dot(c, 24, 3 + b, R.ash[3]);
  poly(c, [[24, 6 + b], [29.5, 8.5 + b], [29.5, 10.5 + b], [26, 11 + b], [23, 11 + b]], R.ash);
  px(c, 28, 8 + b, 2, 1, OUT); line(c, [25, 10 + b], [28, 10 + b], R.ashDk[3]);
  dot(c, 27, 11 + b, R.bone[1]);
  glow(c, 24, 6 + b, 1, EMBER);
  // Embers caught in the fur.
  if (f % 2 === 0) dot(c, 10, 9 + b, EMBER[1]); else dot(c, 14, 8 + b, EMBER[1]);
  glow(c, 1, 5 + wag, 1, EMBER);
}

/** The Lava Hound: a hound of cracked obsidian, magma showing through, a mane of flame along its back. */
function paintHound(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], wag = [0, 1, 0, -1][f];
  poly(c, [[6, 13 + b], [2, 8 + wag], [1, 10 + wag], [4, 15 + b]], R.obs);
  flame(c, 0, 9 + wag, 3, 4, f);
  legs4(c, f, 7, 21, 15 + b, 22, 2, R.obsDk, R.obs, EMBER[1]);
  orb(c, 13, 13 + b, 9, 5.5, R.obs);
  orb(c, 21, 12 + b, 5.5, 5.5, R.obs);
  // The mane: flames that lick back along the spine.
  for (let i = 0; i < 5; i++) flame(c, 6 + i * 3.4, 9 + b - (i > 2 ? 1 : 0), 3, 2 + ((i + f) % 3), f + i);
  // Cracks: magma showing through.
  line(c, [8, 12 + b], [11, 14 + b], EMBER[2]); line(c, [11, 14 + b], [13, 13 + b], EMBER[1]);
  line(c, [15, 15 + b], [18, 13 + b], EMBER[2]); dot(c, 16, 14 + b, EMBER[0]);
  line(c, [20, 9 + b], [22, 11 + b], EMBER[2]);
  // Head: heavy jaw, a mouth of fire.
  poly(c, [[23, 6 + b], [24, 2 + b], [26, 5 + b]], R.obsDk);
  orb(c, 26.5, 9 + b, 5, 4.2, R.obs);
  poly(c, [[27, 8 + b], [31, 10 + b], [31, 12 + b], [27, 12 + b]], R.obs);
  poly(c, [[26, 13 + b], [31, 13 + b], [30, 15 + b + (f % 2)], [26, 15 + b]], R.obsDk);
  px(c, 27, 12 + b, 4, 1 + (f % 2), EMBER[1]); dot(c, 28, 12 + b, EMBER[0]);
  glow(c, 28, 8 + b, 1, EMBER);
}

/** The Ash Ghoul: a hunched grey eater of the dead, quick on all fours, a rag of pyre-ash on its back, red-eyed. */
function paintGhoul(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f];
  // Far limbs.
  limb(c, [8, 13 + b], [6, 17], 2, R.ashDk); limb(c, [6, 17], [8 - s / 2, 20 - liftB(f)], 2, R.ashDk);
  limb(c, [17, 11 + b], [21 - s, 20 - liftA(f)], 2, R.ashDk);
  // Body: a bony hunch.
  orb(c, 12, 11 + b, 8, 5, R.ghoul);
  for (let i = 0; i < 4; i++) dot(c, 7 + i * 3, 6 + b + (i === 1 || i === 2 ? 0 : 1), R.ghoul[0]);
  for (let i = 0; i < 3; i++) line(c, [10 + i * 3, 12 + b], [11 + i * 3, 15 + b], R.ghoul[2]);
  // The ash shawl, tattered.
  poly(c, [[5, 8 + b], [13, 5 + b], [17, 8 + b], [15, 12 + b], [12, 10 + b], [10, 13 + b], [8, 10 + b], [5, 12 + b]], R.hood);
  // Near limbs: a bent hind leg, a long clawed arm.
  limb(c, [7, 14 + b], [4, 17], 3, R.ghoul); limb(c, [4, 17], [7 + s / 2, 20 - liftA(f)], 2, R.ghoul);
  limb(c, [16, 12 + b], [19, 16 + b], 3, R.ghoul); limb(c, [19, 16 + b], [22 + s, 20 - liftB(f)], 2, R.ghoul);
  dot(c, 23 + s, 20 - liftB(f), R.bone[1]); dot(c, 24 + s, 19 - liftB(f), R.bone[1]);
  // Head: low and forward, the jaw hanging.
  orb(c, 22, 11 + b, 4.5, 3.8, R.ghoul);
  poly(c, [[21, 13 + b], [27, 13 + b], [26, 16 + b + (f % 2)], [22, 15 + b]], R.ghoul);
  px(c, 22, 13 + b, 5, 1 + (f % 2), R.void[1]);
  dot(c, 23, 13 + b, R.bone[0]); dot(c, 25, 13 + b, R.bone[0]);
  px(c, 22, 9 + b, 5, 1, R.ghoul[3]);
  glow(c, 23, 10 + b, 1, BLOOD); glow(c, 26, 10 + b, 1, BLOOD);
  if (f === 2) dot(c, 9, 9 + b, EMBER[1]);
}

/** The Cinder Imp: a small horned ember-imp on bat wings, a spade-tailed grin with a fire in its belly. */
function paintImp(c: CanvasRenderingContext2D, f: number): void {
  const b = [1, 0, -1, 0][f], tip = [3, 8, 13, 8][f];
  // The far wing, then the tail.
  poly(c, [[10, 12 + b], [5, tip - 1], [1, tip + 2], [4, 14 + b], [9, 16 + b]], [R.wing[2], R.wing[2], R.wing[3], R.wing[3]]);
  limb(c, [9, 19 + b], [5, 21], 1, R.imp); limb(c, [5, 21], [3, 18], 1, R.imp);
  poly(c, [[1, 16], [4, 15], [3, 19]], R.imp);
  // Body and legs.
  limb(c, [10, 19 + b], [9, 22 + b], 2, R.imp); limb(c, [14, 19 + b], [15, 22 + b], 2, R.imp);
  orb(c, 12, 15.5 + b, 4.5, 5, R.imp);
  orb(c, 12.5, 16.5 + b, 2.2, 2.4, [EMBER[1], EMBER[1], EMBER[2], EMBER[2]]);
  dot(c, 12, 16 + b, EMBER[0]);
  // The near wing.
  poly(c, [[14, 12 + b], [19, tip - 1], [23, tip + 2], [20, 14 + b], [15, 16 + b]], R.wing);
  line(c, [15, 13 + b], [20, tip], R.wing[3]); line(c, [19, tip], [21, 14 + b], R.wing[2]);
  // Head: horns, yellow eyes, a grin.
  poly(c, [[7, 7 + b], [6, 1 + b], [9, 5 + b]], R.char); poly(c, [[15, 5 + b], [18, 1 + b], [17, 7 + b]], R.char);
  orb(c, 12, 8.5 + b, 5.5, 4.5, R.imp);
  glow(c, 10, 7 + b, 2, EMBER); glow(c, 14, 7 + b, 2, EMBER);
  px(c, 10, 11 + b, 5, 1, R.imp[3]); dot(c, 11, 12 + b, R.bone[0]); dot(c, 13, 12 + b, R.bone[0]);
  // Little arms, claws out.
  limb(c, [8, 14 + b], [6, 17 + b], 1, R.imp); limb(c, [16, 14 + b], [18, 16 + b], 1, R.imp);
}

/** The Rivet Maw: a rust-iron jaw on stubby legs, rivets for teeth, a forge-glow in its throat. */
function paintMaw(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], open = [3, 2, 0, 2][f];
  // Legs.
  for (const [x, l] of [[5, liftB(f)], [9, liftA(f)], [14, liftB(f)], [18, liftA(f)]] as const) {
    limb(c, [x, 13 + b], [x - (l ? 1 : 0), 18 - l / 2], 2, x === 9 || x === 18 ? R.iron : [R.iron[1], R.iron[2], R.iron[3], R.iron[3]]);
    px(c, x - 1 - (l ? 1 : 0), 18 - l / 2, 3, 1, R.iron[3]);
  }
  // Lower jaw, the mouth, the throat's glow.
  poly(c, [[2, 10 + b], [21, 10 + b + open], [21, 14 + b + open], [3, 15 + b]], R.rust);
  poly(c, [[4, 9 + b], [20, 9 + b], [20, 10 + b + open], [4, 11 + b]], R.void);
  if (open) { px(c, 7, 10 + b, 5, Math.max(1, open - 1), EMBER[2]); dot(c, 8, 10 + b, EMBER[1]); }
  for (let i = 0; i < 5; i++) dot(c, 6 + i * 3, 10 + b + Math.round(open * i / 5), R.bone[1]);
  // Upper jaw: the riveted shell.
  poly(c, [[2, 5 + b], [5, 2 + b], [18, 2 + b], [22, 5 + b], [22, 9 + b], [2, 9 + b]], R.rust);
  px(c, 2, 6 + b, 20, 1, R.rust[2]);
  for (let i = 0; i < 6; i++) { dot(c, 4 + i * 3, 4 + b, R.rust[0]); dot(c, 4 + i * 3, 5 + b, R.rust[3]); }
  for (let i = 0; i < 5; i++) { dot(c, 5 + i * 3, 9 + b, R.bone[0]); dot(c, 5 + i * 3, 8 + b, R.bone[2]); }
  // Eyes on stalks of iron.
  limb(c, [14, 3 + b], [14, 1 + b], 1, R.iron); limb(c, [19, 3 + b], [20, 1 + b], 1, R.iron);
  glow(c, 13, 0 + b, 2, EMBER); glow(c, 19, 0 + b, 2, EMBER);
}

/** The Slag Crawler: a long beetle of cooled slag plates, fire showing at every seam, iron mandibles. */
function paintCrawler(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], pinch = [2, 1, 0, 1][f];
  // Six legs, the far three darker.
  for (let i = 0; i < 3; i++) {
    const sw = (i % 2 ? -1 : 1) * STEP[f] / 2;
    limb(c, [8 + i * 7, 12], [10 + i * 7 + sw, 17 - (i % 2 ? liftA(f) : liftB(f)) / 2], 1, R.obsDk);
  }
  // The plates, back to front, the seams glowing.
  for (let i = 0; i < 4; i++) {
    const x = 5 + i * 6.5, y = 10.5 + (i % 2 ? b : 0);
    orb(c, x, y, 4.6, 4.6 - (i === 0 ? .8 : 0), R.slag);
    line(c, [x - 3, y - 2], [x + 2, y - 3], R.slag[0]);
    if (i) { line(c, [x - 5, y - 4], [x - 5, y + 3], R.slag[3]); line(c, [x - 4, y - 3], [x - 4, y + 3], EMBER[2]); dot(c, x - 4, y, EMBER[(i + f) % 2]); }
    poly(c, [[x - 2, y - 3.5], [x + .5, y - 7], [x + 2, y - 3.5]], R.basalt);
    line(c, [x - 2, y + 2], [x + 2, y + 1], EMBER[2]);
  }
  for (let i = 0; i < 3; i++) {
    const sw = (i % 2 ? 1 : -1) * STEP[f] / 2;
    limb(c, [7 + i * 7, 13], [8 + i * 7 + sw, 18 - (i % 2 ? liftB(f) : liftA(f)) / 2], 1, R.basalt);
    dot(c, 8 + i * 7 + sw, 18, R.basalt[3]);
  }
  // Head and mandibles.
  orb(c, 29, 10.5, 4.5, 4, R.obsDk);
  glow(c, 30, 8, 1, EMBER); glow(c, 32, 9, 1, EMBER);
  limb(c, [31, 12], [34, 13 - pinch], 1, R.iron); limb(c, [34, 13 - pinch], [33, 15 - pinch], 1, R.iron);
  limb(c, [30, 13], [34, 15 + pinch], 1, R.iron); dot(c, 33, 16 + pinch, R.iron[0]);
}

/** The Ember Drake: a wyvern of the Molten Fields, scales like cooling lava, a belly of banked fire. */
function paintDrake(c: CanvasRenderingContext2D, f: number): void {
  const b = [1, 0, -1, 0][f], wy = [1, 7, 15, 7][f], wx = [10, 5, 8, 5][f];
  // Tail, its tip a flame.
  limb(c, [10, 19 + b], [5, 21], 3, R.drake); limb(c, [5, 21], [2, 17], 2, R.drake);
  flame(c, 0, 17, 3, 3, f);
  // The far wing.
  poly(c, [[17, 13 + b], [wx + 4, wy - 1], [wx - 2, wy + 3], [12, 16 + b]], [R.wing[2], R.wing[2], R.wing[3], R.wing[3]]);
  // Legs.
  limb(c, [12, 21 + b], [11 - STEP[f] / 2, 27 - liftB(f)], 3, R.drake); px(c, 9 - STEP[f] / 2, 27 - liftB(f), 4, 1, R.char[2]);
  limb(c, [20, 21 + b], [21 + STEP[f] / 2, 27 - liftA(f)], 3, R.drake); px(c, 20 + STEP[f] / 2, 27 - liftA(f), 4, 1, R.char[2]);
  // Body, belly plates, spines.
  orb(c, 16, 18 + b, 8, 5.5, R.drake);
  orb(c, 17, 21 + b, 6, 2.6, R.belly);
  for (let i = 0; i < 3; i++) line(c, [14 + i * 3, 20 + b], [14 + i * 3, 23 + b], R.belly[2]);
  for (let i = 0; i < 4; i++) dot(c, 10 + i * 3, 12 + b + (i === 0 ? 1 : 0), R.drake[3]);
  // Neck and head.
  limb(c, [21, 16 + b], [27, 10 + b], 4, R.drake);
  for (let i = 0; i < 3; i++) dot(c, 22 + i * 2, 12 + b - i * 2, R.drake[3]);
  poly(c, [[26, 7 + b], [23, 3 + b], [27, 5 + b]], R.char);
  orb(c, 29, 9 + b, 4.5, 3.5, R.drake);
  poly(c, [[30, 8 + b], [36, 9 + b], [36, 11 + b], [30, 12 + b]], R.drake);
  poly(c, [[29, 12 + b], [35, 12 + b], [34, 13 + b], [29, 13 + b]], R.belly);
  dot(c, 35, 9 + b, OUT);
  glow(c, 29, 8 + b, 1, EMBER);
  if (f === 0) glow(c, 36, 11 + b, 1, EMBER);
  // The near wing: arm, fingers, membrane.
  poly(c, [[17, 13 + b], [wx + 10, wy], [wx + 14, wy + 6], [wx + 15, wy + 10], [20, 16 + b]], R.wing);
  limb(c, [17, 13 + b], [wx + 10, wy], 1, R.drake);
  line(c, [wx + 10, wy], [wx + 14, wy + 6], R.wing[3]); line(c, [wx + 10, wy], [wx + 15, wy + 10], R.wing[3]);
  dot(c, wx + 10, wy - 1, R.bone[1]);
}

// ── The undead ────────────────────────────────────────────────────────────────────────────────────────────────────

interface Bones { bone: Ramp; eye: Ramp; rag?: Ramp }
/** A skeleton (skull, ribs, pelvis, legs, the far arm) at x offset `o`: the walker's, the archer's and the Warlock's raised. */
function skeleton(c: CanvasRenderingContext2D, f: number, o: number, k: Bones): void {
  const b = BOB[f], s = STEP[f], r = k.bone, far: Ramp = [r[1], r[2], r[3], r[3]];
  // Far leg and arm.
  limb(c, [o + 11, 27 + b], [o + 11 - s / 2, 30 + b], 2, far); limb(c, [o + 11 - s / 2, 30 + b], [o + 11 - s, 33 - liftB(f)], 2, far);
  px(c, o + 11 - s, 34 - liftB(f), 3, 1, far[2]);
  limb(c, [o + 6, 17 + b], [o + 5 + s / 2, 21 + b], 2, far); limb(c, [o + 5 + s / 2, 21 + b], [o + 6 + s / 2, 25 + b], 2, far);
  // Spine, ribs, pelvis.
  limb(c, [o + 10, 14 + b], [o + 10, 26 + b], 2, r);
  orb(c, o + 10.5, 19 + b, 4.5, 3.8, r);
  for (let i = 0; i < 3; i++) px(c, o + 7, 17 + b + i * 2, 7, 1, r[3]);
  px(c, o + 10, 16 + b, 1, 6, r[1]);
  poly(c, [[o + 7, 25 + b], [o + 14, 25 + b], [o + 13, 28 + b], [o + 8, 28 + b]], r);
  if (k.rag) poly(c, [[o + 7, 25 + b], [o + 14, 25 + b], [o + 14, 29 + b], [o + 12, 28 + b], [o + 11, 31 + b], [o + 9, 28 + b], [o + 7, 29 + b]], k.rag);
  // Near leg.
  limb(c, [o + 9, 27 + b], [o + 9 + s / 2, 30 + b], 2, r); limb(c, [o + 9 + s / 2, 30 + b], [o + 9 + s, 33 - liftA(f)], 2, r);
  px(c, o + 9 + s, 34 - liftA(f), 3, 1, r[2]);
  // The skull: big (the Keeper's proportions), a hollow stare, a lit eye.
  orb(c, o + 10.5, 8 + b, 6.2, 5.6, r);
  poly(c, [[o + 6, 11 + b], [o + 15, 11 + b], [o + 14, 15 + b], [o + 7, 15 + b]], r);
  px(c, o + 8, 13 + b, 6, 1, r[3]); for (let i = 0; i < 3; i++) dot(c, o + 8 + i * 2, 14 + b, r[3]);
  orb(c, o + 9, 9 + b, 1.8, 1.6, R.void); orb(c, o + 13, 9 + b, 1.8, 1.6, R.void);
  dot(c, o + 11, 11 + b, R.void[1]);
  glow(c, o + 9, 9 + b, 1, k.eye); glow(c, o + 13, 9 + b, 1, k.eye);
}
/** The near arm of a skeleton, out to the hand at (hx, hy). */
function boneArm(c: CanvasRenderingContext2D, f: number, o: number, hx: number, hy: number, r: Ramp): void {
  const b = BOB[f];
  limb(c, [o + 14, 16 + b], [o + 15, 20 + b], 2, r); limb(c, [o + 15, 20 + b], [hx, hy + b], 2, r);
}
/** The Bone Walker: a skeleton of the old Bastion's garrison, a rag of its colours, still marching with a slag-iron blade. */
function paintBoneWalker(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  skeleton(c, f, 0, { bone: R.bone, eye: EMBER, rag: R.red });
  limb(c, [18, 22 + b], [18, 6 + b], 2, R.iron); line(c, [18, 7 + b], [18, 20 + b], R.iron[0]);
  dot(c, 18, 5 + b, R.iron[0]); line(c, [19, 12 + b], [19, 16 + b], EMBER[2]);
  px(c, 15, 22 + b, 6, 1, R.leather[1]); px(c, 17, 23 + b, 2, 2, R.leather[2]);
  boneArm(c, f, 0, 17, 23, R.bone);
}
/** The Bone Archer: a hooded skeleton with a bow of blackened charwood, an ember-tipped arrow on the string. */
function paintBoneArcher(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  skeleton(c, f, 1, { bone: R.bone, eye: EMBER });
  // The hood over the skull and down the back.
  poly(c, [[3, 14 + b], [7, 13 + b], [8, 22 + b], [4, 21 + b]], R.cowl);
  poly(c, [[4, 10 + b], [6, 3 + b], [10, 1 + b], [15, 1 + b], [18, 4 + b], [18, 8 + b], [15, 6 + b], [9, 6 + b], [7, 14 + b], [4, 16 + b]], R.cowl);
  line(c, [9, 6 + b], [15, 6 + b], R.red[0]);
  // The bow, held forward; the arrow drawn and loosed in turn.
  const drawn = f < 2 ? 2 : 0;
  limb(c, [22, 11 + b], [24, 20 + b], 2, R.char); limb(c, [24, 20 + b], [22, 29 + b], 2, R.char);
  line(c, [22, 11 + b], [19 - drawn, 20 + b], R.bone[1]); line(c, [19 - drawn, 20 + b], [22, 29 + b], R.bone[1]);
  line(c, [13 - drawn, 20 + b], [24, 20 + b], R.wood[0]);
  dot(c, 12 - drawn, 19 + b, R.red[0]); dot(c, 12 - drawn, 21 + b, R.red[0]);
  glow(c, 24, 19 + b, 1, EMBER);
  boneArm(c, f, 1, 23, 20, R.bone);
  limb(c, [15, 17 + b], [18 - drawn, 20 + b], 2, R.bone);
}
/** A skeleton the Warlock raised: the same bones blanched violet, his colour burning in the eyes, a rune-shield and a blade. */
function paintRaised(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  orb(c, 4, 21 + b, 3.6, 4.6, R.membrane);
  line(c, [4, 18 + b], [4, 24 + b], VIOLET[1]); line(c, [2, 21 + b], [6, 21 + b], VIOLET[2]);
  skeleton(c, f, 0, { bone: R.vbone, eye: VIOLET });
  limb(c, [18, 22 + b], [18, 6 + b], 2, R.membrane); line(c, [18, 7 + b], [18, 20 + b], VIOLET[1]);
  dot(c, 18, 5 + b, VIOLET[0]); px(c, 15, 22 + b, 6, 1, R.membrane[2]);
  boneArm(c, f, 0, 17, 23, R.vbone);
  if (f % 2) dot(c, 4, 21 + b, VIOLET[0]);
}

/** The Cinder Wraith: a hooded shade of ash, an ember for a heart, bone hands reaching; no feet, it drifts. */
function paintWraith(c: CanvasRenderingContext2D, f: number): void {
  // The tatters where feet should be, waving.
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 3, len = 4 + ((i + f) % 3) * 2, sway = [0, 1, 0, -1][(i + f) % 4];
    limb(c, [x, 26], [x + sway, 26 + len], 2, R.wraith);
    dot(c, x + sway, 27 + len, EMBER[(i + f) % 3 === 0 ? 1 : 2]);
  }
  // Robe, and the far sleeve.
  limb(c, [7, 14], [3, 21], 3, [R.wraith[2], R.wraith[2], R.wraith[3], R.wraith[3]]);
  poly(c, [[6, 11], [17, 11], [20, 29], [3, 29]], R.wraith);
  line(c, [8, 14], [6, 28], R.wraith[2]); line(c, [14, 14], [16, 28], R.wraith[2]);
  // The ember heart.
  glow(c, 11, 18, 2, EMBER);
  if (f % 2) dot(c, 12, 16, EMBER[1]);
  // The hood, and nothing inside it but two coals.
  poly(c, [[6, 10], [9, 2], [13, 0], [15, 4], [19, 8], [18, 13], [6, 14]], R.wraith);
  orb(c, 13.5, 9.5, 4, 3.4, R.void);
  glow(c, 12, 9, 1, EMBER); glow(c, 15, 9, 1, EMBER);
  // The near sleeve, a bone hand reaching out.
  const r = [0, 1, 0, -1][f];
  limb(c, [16, 13], [20, 18 + r], 3, R.wraith);
  limb(c, [20, 18 + r], [22, 20 + r], 1, R.bone); limb(c, [21, 18 + r], [23, 18 + r], 1, R.bone);
  dot(c, 1, 21, R.bone[2]); dot(c, 2, 22, R.bone[2]);
}

/** The Ashbone Dragon: the Bastion's last lord, a dragon of bare bone round a heart of burning slag, violet light in its skull. */
function paintBoneDragon(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], w = [0, 4, 8, 4][f], B = R.bone, far: Ramp = [B[1], B[2], B[3], B[3]];
  // The far wing: a bat's arm of bone, three fingers, tattered membrane between.
  const S: P2 = [34, 30], W: P2 = [26, 6 + w], T1: P2 = [3, 14 + w], T2: P2 = [9, 4 + w], T3: P2 = [18, 1 + w];
  poly(c, [S, W, T3, [20, 9 + w], T2, [11, 13 + w], T1, [12, 24 + w / 2], [20, 32]], R.membrane);
  for (let i = 0; i < 3; i++) px(c, 8 + i * 5, 17 + w + i, 2, 2, R.membrane[3]);
  limb(c, S, W, 3, far); limb(c, W, T1, 2, far); limb(c, W, T2, 2, far); limb(c, W, T3, 2, far);
  // Tail: vertebrae down to a spike.
  for (let i = 0; i < 9; i++) orb(c, 26 - i * 2.8, 46 + i * 1.2 + (i > 5 ? (i - 5) : 0), 2.6 - i * .15, 2.2 - i * .12, B);
  poly(c, [[2, 56], [0, 60], [4, 57]], B);
  // Far legs.
  limb(c, [43, 44 + b], [44 - STEP[f] / 2, 52], 3, far); limb(c, [44 - STEP[f] / 2, 52], [43 - STEP[f], 60 - liftB(f)], 3, far);
  px(c, 41 - STEP[f], 61 - liftB(f), 6, 1, far[2]);
  // Spine and ribs round the slag heart.
  for (let i = 0; i < 8; i++) orb(c, 24 + i * 3, 32 + b - Math.sin(i / 7 * Math.PI) * 2, 2, 1.8, B);
  orb(c, 36, 39 + b, 8, 5.5, [EMBER[3], '#5a1a14', '#3a120e', '#240a08']);
  const hot = [1.5, 2, 2.5, 2][f];
  orb(c, 36, 39 + b, 4.2 + hot / 2, 3 + hot / 3, [EMBER[0], EMBER[1], EMBER[2], EMBER[2]]);
  glow(c, 35, 38 + b, 2, EMBER);
  for (let i = 0; i < 5; i++) { const x = 28 + i * 4; limb(c, [x, 33 + b], [x + 1, 44 + b - Math.abs(i - 2)], 2, B); }
  limb(c, [27, 45 + b], [46, 44 + b], 2, far);
  // Near legs.
  limb(c, [29, 44 + b], [27 + STEP[f] / 2, 52], 4, B); limb(c, [27 + STEP[f] / 2, 52], [28 + STEP[f], 60 - liftA(f)], 3, B);
  px(c, 26 + STEP[f], 61 - liftA(f), 7, 1, B[2]); dot(c, 33 + STEP[f], 61 - liftA(f), B[0]);
  // Neck: vertebrae climbing to the skull.
  for (let i = 0; i < 6; i++) orb(c, 46 + i * 2.6, 30 - i * 3.4 + b, 2.6, 2.4, B);
  // The skull: horned, long-snouted, violet light in the socket; the jaw drops to breathe.
  const jaw = f === 2 ? 3 : f % 2 ? 1 : 0;
  limb(c, [56, 9 + b], [49, 3 + b], 2, far); limb(c, [49, 3 + b], [46, 6 + b], 1, far);
  poly(c, [[58, 15 + b], [73, 16 + b + jaw], [73, 18 + b + jaw], [59, 19 + b]], far);
  for (let i = 0; i < 4; i++) dot(c, 62 + i * 3, 16 + b + Math.round(jaw * i / 4), B[0]);
  if (jaw > 1) { line(c, [62, 17 + b], [72, 18 + b], EMBER[1]); dot(c, 70, 18 + b, EMBER[0]); }
  orb(c, 60, 11 + b, 7, 5.5, B);
  poly(c, [[61, 9 + b], [74, 12 + b], [74, 15 + b], [60, 16 + b]], B);
  px(c, 63, 15 + b, 11, 1, B[3]); for (let i = 0; i < 4; i++) dot(c, 64 + i * 3, 16 + b, B[0]);
  dot(c, 73, 12 + b, B[3]);
  limb(c, [58, 7 + b], [52, 2 + b], 2, B); limb(c, [52, 2 + b], [49, 0 + b + 1], 1, B);
  orb(c, 60, 10 + b, 2.2, 2, R.void);
  glow(c, 60, 9 + b, 2, VIOLET);
  // Violet bone-light along the spine.
  if (f % 2 === 0) { dot(c, 30, 30 + b, VIOLET[1]); dot(c, 48, 22 + b, VIOLET[1]); } else { dot(c, 38, 29 + b, VIOLET[1]); dot(c, 51, 18 + b, VIOLET[1]); }
  // The near wing, half-raised.
  const N: P2 = [36, 31 + b], NW: P2 = [42, 12 + w / 2];
  poly(c, [N, NW, [52, 8 + w / 2], [50, 18 + w / 2], [47, 24], [44, 29]], R.membrane);
  limb(c, N, NW, 3, B); limb(c, NW, [52, 8 + w / 2], 2, B); limb(c, NW, [50, 18 + w / 2], 2, far);
  dot(c, 42, 11 + w / 2, B[0]);
}

// ── The Cinder clans ──────────────────────────────────────────────────────────────────────────────────────────────

/** An orc's legs, body and head (the axe arm and gear are the caller's): ash-green, tusked, red-eyed, in basalt plates. */
function orcBody(c: CanvasRenderingContext2D, f: number, robe: Ramp | null): void {
  const b = BOB[f], s = STEP[f];
  // Legs and boots.
  if (!robe) {
    limb(c, [16, 27 + b], [16 - s, 34 - liftB(f)], 3, [R.leather[1], R.leather[2], R.leather[3], R.leather[3]]);
    px(c, 15 - s, 34 - liftB(f), 5, 2, R.char[2]);
    limb(c, [11, 27 + b], [11 + s, 34 - liftA(f)], 3, R.leather);
    px(c, 10 + s, 34 - liftA(f), 5, 2, R.char[1]); px(c, 10 + s, 34 - liftA(f), 5, 1, R.char[0]);
  } else {
    poly(c, [[7, 19 + b], [21, 19 + b], [24, 35], [4, 35]], robe);
    line(c, [14, 22 + b], [14, 34], robe[3]);
    px(c, 4, 34, 20, 1, EMBER[2]);
    px(c, 7 + s / 2, 35, 4, 2, R.char[1]); px(c, 16 - s / 2, 35, 4, 2, R.char[2]);
  }
  // Far arm.
  limb(c, [7, 20 + b], [5, 27 + b], 3, [R.orc[1], R.orc[2], R.orc[3], R.orc[3]]);
  orb(c, 5, 28 + b, 2, 2, R.orc);
  if (!robe) {
    // Torso: bare chest under a leather harness, a belt with a bright buckle.
    orb(c, 14, 23 + b, 7.5, 5.5, R.orc);
    line(c, [8, 19 + b], [18, 27 + b], R.leather[2]); line(c, [9, 19 + b], [19, 27 + b], R.leather[1]);
    px(c, 7, 26 + b, 15, 2, R.leather[2]); px(c, 7, 26 + b, 15, 1, R.leather[1]);
    glow(c, 13, 26 + b, 2, R.gold);
  }
  // Shoulder plates.
  orb(c, 7.5, 18.5 + b, 4, 3, R.basalt); dot(c, 6, 15 + b, R.bone[1]); dot(c, 6, 16 + b, R.bone[2]);
  orb(c, 21, 18.5 + b, 4, 3, R.basalt); dot(c, 21, 15 + b, R.bone[1]); dot(c, 21, 16 + b, R.bone[2]);
  // Head: a big one, ears out, topknot, brow, tusks.
  poly(c, [[7, 8 + b], [1, 5 + b], [3, 9 + b], [7, 13 + b]], R.orc); dot(c, 4, 8 + b, R.orc[3]);
  orb(c, 14, 11 + b, 8, 7, R.orc);
  poly(c, [[9, 13 + b], [21, 13 + b], [21, 17 + b], [10, 18 + b]], R.orc);
  px(c, 10, 8 + b, 11, 1, R.orc[3]); px(c, 11, 7 + b, 9, 1, R.orc[2]);
  glow(c, 13, 9 + b, 1, EMBER); glow(c, 18, 9 + b, 1, EMBER);
  dot(c, 16, 12 + b, R.orc[3]); dot(c, 17, 12 + b, R.orc[3]);
  px(c, 12, 15 + b, 8, 1, R.orc[3]);
  limb(c, [12, 15 + b], [12, 13 + b], 1, R.bone); limb(c, [19, 15 + b], [19, 13 + b], 1, R.bone);
  if (!robe) { poly(c, [[11, 5 + b], [13, 1 + b], [16, 1 + b], [17, 5 + b]], R.char); dot(c, 14, 0 + b, R.char[1]); px(c, 12, 4 + b, 5, 1, EMBER[2]); }
}
/** The near arm round a haft at (hx, hy). */
function orcArm(c: CanvasRenderingContext2D, f: number, hx: number, hy: number): void {
  const b = BOB[f];
  limb(c, [21, 20 + b], [hx, hy + b], 3, R.orc); orb(c, hx, hy + 1 + b, 2.2, 2.2, R.orc);
}
/** A slag-iron axe with an ember edge, its haft from (x, top) to (x, bottom). */
function axe(c: CanvasRenderingContext2D, f: number, x: number, top: number, bottom: number): void {
  const b = BOB[f];
  limb(c, [x, top + b], [x, bottom + b], 2, R.wood);
  poly(c, [[x, top + 1 + b], [x + 5, top - 1 + b], [x + 7, top + 3 + b], [x + 5, top + 8 + b], [x, top + 6 + b]], R.iron);
  line(c, [x + 6, top + 1 + b], [x + 6, top + 6 + b], EMBER[f % 2 ? 1 : 2]);
}
/** A Cinder-clan Orc: ash-green, tusked, in basalt plates, with a slag-iron axe. */
function paintOrc(c: CanvasRenderingContext2D, f: number): void {
  orcBody(c, f, null);
  axe(c, f, 23, 10, 31);
  orcArm(c, f, 23, 23);
}
/** An Orc Firecaller: the clan's shaman, hooded in ember-red, a flame caught on a skull-topped staff. */
function paintFirecaller(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  orcBody(c, f, R.red);
  // The hood over the head and the shoulders.
  poly(c, [[4, 13 + b], [6, 5 + b], [11, 1 + b], [17, 1 + b], [22, 5 + b], [23, 12 + b], [20, 8 + b], [9, 7 + b], [7, 18 + b]], R.red);
  px(c, 7, 19 + b, 14, 2, R.gold[2]); dot(c, 14, 20 + b, R.gold[0]);
  // A string of small bones.
  for (let i = 0; i < 4; i++) dot(c, 10 + i * 2, 22 + b + (i % 2), R.bone[1]);
  // The staff, a skull, the flame.
  limb(c, [24, 7], [24, 37], 2, R.wood);
  orb(c, 24.5, 6, 2.6, 2.4, R.bone); dot(c, 24, 6, R.void[1]); dot(c, 26, 6, R.void[1]);
  flame(c, 22, 4, 5, 6, f);
  orcArm(c, f, 24, 22);
}
/** The Orc Warlord: a Cinder-clan chief grown huge, a horned smithing helm, a cape the colour of old embers, a great axe. */
function paintWarlord(c: CanvasRenderingContext2D, f: number): void {
  grown(1.2, 1, 4, () => {
    const b = BOB[f];
    poly(c, [[5, 17 + b], [21, 17 + b], [26, 36], [0, 37]], R.red);
    px(c, 0, 35, 26, 1, EMBER[2]); line(c, [6, 20 + b], [3, 34], R.red[2]);
    warlordBody(c, f);
    axe(c, f, 25, 6, 33);
    poly(c, [[25, 5 + b], [20, 3 + b], [19, 11 + b], [25, 9 + b]], R.iron);
    orcArm(c, f, 25, 22);
  });
}
function warlordBody(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  orcBody(c, f, null);
  // The helm: basalt, a gold band, two bone horns.
  poly(c, [[6, 9 + b], [8, 3 + b], [14, 1 + b], [20, 3 + b], [22, 8 + b], [22, 9 + b]], R.basalt);
  px(c, 6, 8 + b, 17, 1, R.gold[1]); dot(c, 14, 8 + b, R.gold[0]);
  limb(c, [7, 5 + b], [3, 2 + b], 2, R.bone); limb(c, [3, 2 + b], [3, -2 + b], 1, R.bone);
  limb(c, [21, 5 + b], [24, 1 + b], 2, R.bone); limb(c, [24, 1 + b], [23, -3 + b], 1, R.bone);
}

// ── The forge-born ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The Cinder Bailiff, and the two wardens who are its kin grown huge: a hooded ember-golem in a soot robe, a caged lantern
 * for a belly, two coals under the hood; the near hand holds a ledger-hook (or the Anvil-Warden's hammer).
 */
function bailiff(c: CanvasRenderingContext2D, f: number, tool: 'hook' | 'hammer', robe: Ramp = R.robe): void {
  const b = BOB[f], s = STEP[f] / 2;
  // Feet.
  px(c, 7 - s, 30 - liftB(f) / 2, 5, 3, R.basalt[2]); px(c, 15 + s, 30 - liftA(f) / 2, 5, 3, R.basalt[1]); px(c, 15 + s, 30 - liftA(f) / 2, 5, 1, R.basalt[0]);
  // Far arm.
  limb(c, [5, 15 + b], [3, 23 + b], 4, [robe[1], robe[2], robe[3], robe[3]]);
  orb(c, 3, 24 + b, 2, 2, R.basalt);
  // Robe, a soot-stained hem.
  poly(c, [[6, 12 + b], [20, 12 + b], [23, 31], [3, 31]], robe);
  for (let i = 0; i < 5; i++) dot(c, 5 + i * 4, 30, robe[3]);
  line(c, [8, 14 + b], [6, 29], robe[2]);
  // The lantern: an iron cage, a fire that breathes.
  px(c, 8, 16 + b, 10, 9, R.iron[3]);
  orb(c, 13, 20.5 + b, 3.5 + (f % 2) * .5, 3.3, [EMBER[0], EMBER[1], EMBER[2], EMBER[2]]);
  glow(c, 12, 19 + b, 2, EMBER);
  for (let i = 0; i < 3; i++) px(c, 10 + i * 3, 16 + b, 1, 9, R.iron[1]);
  px(c, 8, 16 + b, 10, 1, R.iron[0]); px(c, 8, 24 + b, 10, 1, R.iron[2]);
  // The mantle and the hood, two coals inside.
  orb(c, 13, 13 + b, 9, 3.6, R.hood);
  poly(c, [[6, 9 + b], [9, 3 + b], [14, 1 + b], [19, 3 + b], [21, 8 + b], [20, 13 + b], [7, 13 + b]], R.hood);
  orb(c, 15, 8.5 + b, 4.2, 3.4, R.void);
  glow(c, 14, 8 + b, 1, EMBER); glow(c, 17, 8 + b, 1, EMBER);
  // The near arm and what it carries.
  if (tool === 'hook') {
    limb(c, [23, 6 + b], [23, 30 + b], 2, R.iron);
    limb(c, [23, 6 + b], [21, 3 + b], 2, R.iron); limb(c, [21, 3 + b], [19, 5 + b], 1, R.iron);
    dot(c, 22, 4 + b, R.iron[0]);
  } else {
    limb(c, [23, 8 + b], [23, 28 + b], 2, R.wood);
    poly(c, [[19, 5 + b], [27, 5 + b], [27, 11 + b], [19, 11 + b]], R.iron);
    line(c, [19, 8 + b], [27, 8 + b], R.iron[2]);
    if (f === 0) { dot(c, 27, 4 + b, EMBER[0]); dot(c, 28, 7 + b, EMBER[1]); }
  }
  limb(c, [19, 15 + b], [22, 20 + b], 4, robe);
  orb(c, 23, 20 + b, 2.2, 2.2, R.basalt);
}
function paintBailiff(c: CanvasRenderingContext2D, f: number): void { bailiff(c, f, 'hook'); }

/** The Ember Warden, the Ember Mine's keeper: a towering Bailiff crowned in slag, its lantern a furnace. */
function paintWarden(c: CanvasRenderingContext2D, f: number): void {
  grown(1.4, 2, 7, () => {
    const b = BOB[f];
    bailiff(c, f, 'hook', R.slag);
    for (let i = 0; i < 4; i++) flame(c, 5 + i * 4.5, 31, 2, 1 + ((i + f) % 2), f + i);
    // The slag crown, fire in every notch.
    poly(c, [[8, 3 + b], [20, 3 + b], [20, 0 + b], [18, 1 + b], [16, -2 + b], [14, 0 + b], [12, -2 + b], [10, 1 + b], [8, 0 + b]], R.slag);
    for (let i = 0; i < 3; i++) flame(c, 10 + i * 3, -1 + b, 2, 2 + ((i + f) % 2), f + i);
    line(c, [9, 2 + b], [19, 2 + b], EMBER[2]);
  });
}
/** The Anvil-Warden, set by the First Smith to keep the Forge of the Four: a Bailiff grown huge, an anvil for a crown, a hammer. */
function paintAnvilWarden(c: CanvasRenderingContext2D, f: number): void {
  grown(1.6, 2, 12, () => {
    const b = BOB[f];
    bailiff(c, f, 'hammer', R.steel);
    // The anvil: a face, a horn, a waist, a foot set into the hood.
    poly(c, [[9, 2 + b], [12, 1 + b], [12, -1 + b], [7, -2 + b], [5, -4 + b], [21, -4 + b], [21, -1 + b], [16, -1 + b], [16, 1 + b], [19, 2 + b]], R.iron);
    poly(c, [[21, -4 + b], [25, -3 + b], [21, -1 + b]], R.iron);
    line(c, [6, -4 + b], [21, -4 + b], R.iron[0]);
    if (f % 2 === 0) { dot(c, 24, -6 + b, EMBER[0]); dot(c, 8, -6 + b, EMBER[1]); } else { dot(c, 14, -6 + b, EMBER[1]); dot(c, 19, -7 + b, EMBER[2]); }
  });
}

/** The Obsidian Golem, and the Magma Tyrant it grows into: a slab of black glass, a magma heart, fists to the floor. */
function golem(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f] / 2;
  // Legs.
  orb(c, 11, 34 - liftB(f) / 2, 4.5, 4.5, R.obsDk); px(c, 6, 37 - liftB(f) / 2, 10, 2, R.obsDk[3]);
  orb(c, 23, 34 - liftA(f) / 2, 4.5, 4.5, R.obs); px(c, 18, 37 - liftA(f) / 2, 10, 2, R.obs[3]);
  // The far arm.
  limb(c, [6, 14 + b], [4 - s, 26 + b], 5, R.obsDk); orb(c, 4 - s, 29 + b, 3.5, 3.2, R.obsDk);
  // Torso, a glass facet catching the light, the heart in its cracks.
  poly(c, [[5, 11 + b], [29, 11 + b], [26, 31 + b], [9, 31 + b]], R.obs);
  line(c, [8, 13 + b], [12, 22 + b], R.obs[0]); line(c, [9, 13 + b], [13, 22 + b], '#8a80b4');
  line(c, [24, 14 + b], [22, 20 + b], R.obs[0]);
  orb(c, 17, 20 + b, 4.6, 4.2, R.void);
  orb(c, 17, 20 + b, 3 + (f % 2) * .5, 2.8, [EMBER[0], EMBER[1], EMBER[2], EMBER[2]]);
  glow(c, 16, 19 + b, 2, EMBER);
  line(c, [13, 22 + b], [10, 27 + b], EMBER[2]); line(c, [21, 22 + b], [24, 28 + b], EMBER[2]); line(c, [18, 16 + b], [20, 12 + b], EMBER[2]);
  // Shoulders, and the head sunk between them.
  orb(c, 6.5, 12.5 + b, 5, 4.5, R.obs); orb(c, 27.5, 12.5 + b, 5, 4.5, R.obs);
  dot(c, 5, 10 + b, '#8a80b4');
  orb(c, 17, 8 + b, 5.5, 4.6, R.obs);
  px(c, 13, 7 + b, 9, 2, R.void[1]);
  glow(c, 14, 7 + b, 1, EMBER); glow(c, 19, 7 + b, 1, EMBER);
  // The near arm.
  limb(c, [28, 14 + b], [30 + s, 26 + b], 5, R.obs); orb(c, 30 + s, 29 + b, 4, 3.6, R.obs);
  line(c, [28, 27 + b], [31, 27 + b], R.obs[3]);
}
function paintGolem(c: CanvasRenderingContext2D, f: number): void { golem(c, f); }

/** The Magma Tyrant, the Molten Deep's master: a Golem grown huge on the caldera's heat, lava running down it, crowned in fire. */
function paintTyrant(c: CanvasRenderingContext2D, f: number): void {
  grown(1.6, 2, 6, () => {
    const b = BOB[f];
    golem(c, f);
    // Lava running down the chest and the arms.
    line(c, [11, 13 + b], [12, 30 + b], EMBER[1]); line(c, [23, 13 + b], [22, 30 + b], EMBER[1]);
    for (let i = 0; i < 3; i++) dot(c, 12, 16 + b + ((i * 5 + f * 2) % 14), EMBER[0]);
    line(c, [30, 18 + b], [31, 26 + b], EMBER[2]);
    // The crown of fire.
    poly(c, [[11, 5 + b], [23, 5 + b], [22, 3 + b], [12, 3 + b]], R.gold);
    for (let i = 0; i < 4; i++) flame(c, 11.5 + i * 3, 3 + b, 2, 2 + ((i + f) % 3), f + i);
  });
}

/** The Glass Sentinel, the Glass Foundry's guard: a statue of black glass the Four cast and never broke, a melt for a heart. */
function paintSentinel(c: CanvasRenderingContext2D, f: number): void {
  const b = [0, 0, 1, 1][f], s = STEP[f] / 2;
  // Legs: columns of glass.
  poly(c, [[8, 28], [12, 28], [12 - s / 2, 40 - liftB(f) / 2], [7 - s / 2, 40 - liftB(f) / 2]], R.glass);
  poly(c, [[14, 28], [18, 28], [19 + s / 2, 40 - liftA(f) / 2], [14 + s / 2, 40 - liftA(f) / 2]], R.glass);
  // Far arm, a shard for a hand.
  limb(c, [7, 15 + b], [4, 26 - b], 3, [R.glass[1], R.glass[2], R.glass[3], R.glass[3]]);
  poly(c, [[3, 26 - b], [6, 26 - b], [4, 31 - b]], R.crystal);
  // Torso: facets, a cage round the melt.
  poly(c, [[6, 13 + b], [20, 13 + b], [19, 29], [7, 29]], R.glass);
  line(c, [7, 14 + b], [11, 28], R.glass[0]); line(c, [16, 15 + b], [18, 22], R.glass[0]);
  orb(c, 13, 20 + b, 3.5, 3.5, R.void);
  orb(c, 13, 20 + b, 2.3 + (f % 2) * .4, 2.3, [EMBER[0], EMBER[1], EMBER[2], EMBER[2]]);
  glow(c, 12, 19 + b, 1, EMBER);
  line(c, [10, 17 + b], [16, 23 + b], R.glass[2]);
  // Shoulder crystals.
  poly(c, [[4, 14 + b], [6, 7 + b], [9, 13 + b]], R.crystal); poly(c, [[17, 13 + b], [21, 6 + b], [22, 14 + b]], R.crystal);
  // The helm: angular, a slit of fire, two crystal horns.
  poly(c, [[8, 4 + b], [18, 4 + b], [19, 12 + b], [7, 12 + b]], R.glass);
  poly(c, [[8, 5 + b], [7, 0 + b], [10, 4 + b]], R.crystal); poly(c, [[16, 4 + b], [19, 0 + b], [18, 5 + b]], R.crystal);
  px(c, 10, 8 + b, 8, 1, EMBER[2]); px(c, 13, 8 + b, 3, 1, EMBER[1]); dot(c, 14, 8 + b, EMBER[0]);
  // Near arm.
  limb(c, [19, 15 + b], [22, 26 - b], 3, R.glass);
  poly(c, [[21, 26 - b], [24, 26 - b], [23, 32 - b]], R.crystal);
}

/** The Cinder Sovereign, the heart of the Molten Deep: a robed king of slag and fire, a burning crown, flame in both hands. */
function paintSovereign(c: CanvasRenderingContext2D, f: number): void {
  const b = [0, 0, 1, 1][f];
  // Robe: slag, veined with fire, a hem that burns.
  poly(c, [[22, 22 + b], [46, 22 + b], [62, 69], [6, 69]], R.sov);
  for (const [x0, x1] of [[26, 18], [34, 34], [42, 50]] as const) {
    line(c, [x0, 26 + b], [(x0 + x1) / 2 + 2, 48], EMBER[2]); line(c, [(x0 + x1) / 2 + 2, 48], [x1, 68], EMBER[2]);
  }
  // The under-robe down the front, gold-edged, a belt of slag-iron.
  poly(c, [[30, 28 + b], [38, 28 + b], [44, 69], [24, 69]], R.slag);
  line(c, [30, 28 + b], [24, 68], R.gold[2]); line(c, [38, 28 + b], [44, 68], R.gold[1]);
  for (let i = 0; i < 4; i++) dot(c, 34, 40 + ((i * 7 + f * 2) % 26), EMBER[i % 2]);
  px(c, 22, 35 + b, 24, 3, R.basalt[2]); px(c, 22, 35 + b, 24, 1, R.basalt[0]);
  glow(c, 33, 35 + b, 2, R.gold);
  for (let i = 0; i < 9; i++) flame(c, 7 + i * 6, 69, 4, 2 + ((i + f) % 3), f + i);
  // The arms, raised, a fire held in each hand.
  limb(c, [24, 26 + b], [13, 21 - b], 6, R.sov); limb(c, [44, 26 + b], [55, 21 + b], 6, R.sov);
  orb(c, 12, 19 - b, 3.2, 3, R.basalt); orb(c, 56, 19 + b, 3.2, 3, R.basalt);
  orb(c, 11, 12 - b, 4.5 + (f % 2) * .5, 4.5, [EMBER[0], EMBER[1], EMBER[2], EMBER[3]]); flame(c, 7, 10 - b, 8, 8, f);
  orb(c, 57, 12 + b, 4.5 + ((f + 1) % 2) * .5, 4.5, [EMBER[0], EMBER[1], EMBER[2], EMBER[3]]); flame(c, 53, 10 + b, 8, 8, f + 2);
  // The mantle.
  orb(c, 34, 25 + b, 15, 5.5, R.slag);
  for (let i = 0; i < 6; i++) dot(c, 22 + i * 5, 22 + b, R.slag[0]);
  // The head: a dark face, cracks of fire, coal eyes.
  orb(c, 34, 16 + b, 8, 8, R.sov);
  orb(c, 35, 17 + b, 5.5, 5, R.void);
  glow(c, 32, 15 + b, 2, EMBER); glow(c, 37, 15 + b, 2, EMBER);
  line(c, [32, 20 + b], [38, 20 + b], f % 2 ? EMBER[0] : EMBER[1]);
  // The crown, its points burning.
  poly(c, [[25, 10 + b], [43, 10 + b], [43, 6 + b], [25, 6 + b]], R.gold);
  for (let i = 0; i < 4; i++) { poly(c, [[25 + i * 5, 6 + b], [29 + i * 5, 6 + b], [27 + i * 5, 2 + b]], R.gold); flame(c, 26 + i * 5, 2 + b, 2, 2 + ((i + f) % 3), f + i); }
  dot(c, 34, 8 + b, BLOOD[1]); dot(c, 28, 8 + b, EMBER[1]); dot(c, 40, 8 + b, EMBER[1]);
}

// ── The Verdant Wilds (maps/verdant-wilds.ts, maps/overgrown-temple.ts) ──────────────────────────────────────────────

/** The Canopy Bat: a dusky bat on wings like broad jungle leaves, rootglass eyes; it roosts in the giant trees' crowns. */
function paintCanopyBat(c: CanvasRenderingContext2D, f: number): void {
  const b = [1, 0, -1, 0][f], tip = [4, 9, 14, 9][f];
  // The far wing: a leaf, veined, in shadow.
  poly(c, [[12, 11 + b], [7, tip], [1, tip + 2], [3, tip + 6], [8, 15 + b], [12, 15 + b]], R.vineDk);
  line(c, [11, 12 + b], [4, tip + 3], R.vineDk[3]);
  // Body and a pale belly; claws tucked.
  limb(c, [12, 17 + b], [12, 20 + b], 1, R.bat); limb(c, [16, 17 + b], [16, 20 + b], 1, R.bat);
  dot(c, 11, 21 + b, R.bone[2]); dot(c, 17, 21 + b, R.bone[2]);
  orb(c, 14, 13 + b, 4.5, 5, R.bat);
  orb(c, 14.5, 14.5 + b, 2.2, 2.8, [R.bat[0], R.bat[0], R.bat[1], R.bat[2]]);
  // The near wing, its veins and a lit edge.
  poly(c, [[16, 11 + b], [21, tip], [27, tip + 2], [25, tip + 6], [20, 15 + b], [16, 15 + b]], R.vine);
  line(c, [17, 12 + b], [24, tip + 2], R.vine[3]); line(c, [20, 13 + b], [22, tip + 5], R.vine[2]);
  dot(c, 22, tip + 1, R.vine[0]); dot(c, 25, tip + 3, R.vine[0]);
  // Head: tall ears, rootglass eyes, two small fangs.
  poly(c, [[10, 9 + b], [9, 2 + b], [13, 7 + b]], R.bat); poly(c, [[15, 7 + b], [19, 2 + b], [18, 9 + b]], R.bat);
  dot(c, 10, 5 + b, R.petal[2]); dot(c, 18, 5 + b, R.petal[2]);
  orb(c, 14, 9 + b, 4, 3.4, R.bat);
  glow(c, 12, 8 + b, 1, ROOTGLOW); glow(c, 15, 8 + b, 1, ROOTGLOW);
  dot(c, 13, 11 + b, R.bone[0]); dot(c, 15, 11 + b, R.bone[0]);
}

/** The Moss Stalker: a jungle cat whose pelt is moss over bark, rootglass shards at its shoulders, eyes of the same light. */
function paintMossStalker(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], sway = [0, 1, 0, -1][f];
  // The tail: long and low, a curl of fern at its tip.
  limb(c, [8, 11 + b], [4, 9 + sway], 2, R.stalker); limb(c, [4, 9 + sway], [2, 5 + sway], 1, R.stalker);
  poly(c, [[1, 5 + sway], [2, 1 + sway], [4, 5 + sway]], R.vine);
  legs4(c, f, 10, 22, 15 + b, 23, 2, R.mossDk, R.stalker, R.bone[2]);
  orb(c, 16, 12.5 + b, 8.5, 4.2, R.stalker);
  px(c, 10, 16 + b, 12, 1, R.stalker[2]);
  // Rosettes, the moss down its spine, the shards.
  for (const x of [12, 15, 18]) { dot(c, x, 12 + b, R.stalker[3]); dot(c, x + 1, 13 + b, R.stalker[3]); }
  for (let i = 0; i < 6; i++) dot(c, 10 + i * 2.2, 9 + b - (i % 2), R.moss[i % 2 ? 0 : 1]);
  poly(c, [[19, 9 + b], [20.5, 3 + b], [22, 9 + b]], R.rootglass);
  poly(c, [[16, 9 + b], [17, 5 + b], [18.5, 9 + b]], R.rootglass);
  dot(c, 20, 5 + b, ROOTGLOW[0]);
  // Head: flat and feline, ears laid back, a long jaw.
  poly(c, [[24, 8 + b], [24, 4 + b], [26.5, 7 + b]], R.stalker); poly(c, [[28, 7 + b], [30, 4 + b], [30, 8 + b]], R.mossDk);
  orb(c, 27, 11 + b, 4.6, 4, R.stalker);
  poly(c, [[28, 11 + b], [33, 12 + b], [32.5, 15 + b], [28, 15 + b]], R.stalker);
  dot(c, 32, 12 + b, OUT); line(c, [29, 14 + b], [32, 14 + b], R.stalker[3]);
  dot(c, 30, 15 + b, R.bone[0]);
  glow(c, 28, 10 + b, 1, ROOTGLOW);
}

/** The Vine Lasher: a carnivorous bloom walking on its roots, a petalled maw on a stalk, two thorned whips. */
function paintVineLasher(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f] / 2, whip = [0, 2, 4, 2][f];
  // Root feet: a tangle that shuffles.
  for (const [x, l, r] of [[9, liftB(f), R.bark], [13, liftA(f), R.bark], [18, liftB(f), R.bark], [22, liftA(f), R.bark]] as const) {
    limb(c, [x + 1, 28], [x - 1 + (l ? s : -s), 34 - l / 2], 2, r);
  }
  // The far whip, thorned.
  limb(c, [11, 21 + b], [5, 15 - whip / 2], 2, R.vineDk); limb(c, [5, 15 - whip / 2], [2, 21 - whip], 1, R.vineDk);
  dot(c, 6, 14 - whip / 2, R.thorn[0]); dot(c, 3, 18 - whip, R.thorn[0]);
  // The bulb: a swollen pod, leaves round its foot.
  poly(c, [[6, 30], [11, 25 + b], [9, 31]], R.vineDk); poly(c, [[24, 31], [20, 25 + b], [26, 29]], R.vine);
  orb(c, 15.5, 24.5 + b, 7.5, 6, R.vine);
  line(c, [11, 22 + b], [13, 28 + b], R.vine[2]); line(c, [19, 21 + b], [18, 28 + b], R.vine[2]);
  dot(c, 12, 21 + b, R.vine[0]); dot(c, 14, 20 + b, R.vine[0]);
  // The stalk, and the bloom: five petals round a maw.
  limb(c, [16, 19 + b], [18, 12 + b], 3, R.vine);
  const hx = 19, hy = 9 + b + (f % 2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + f * .05;
    orb(c, hx + Math.cos(a) * 4.5, hy + Math.sin(a) * 3.8, 2.8, 2.4, R.petal);
  }
  orb(c, hx, hy, 3.2, 2.8, R.void);
  for (const [dx, dy] of [[-2, -1], [0, -2], [2, -1], [-1, 2], [1, 2]] as const) dot(c, hx + dx, hy + dy, R.bone[0]);
  glow(c, hx, hy, 1, ROOTGLOW);
  // The near whip, raised to strike.
  limb(c, [20, 21 + b], [26, 16 - whip], 2, R.vine); limb(c, [26, 16 - whip], [28, 22 - whip * 1.5], 1, R.vine);
  dot(c, 25, 15 - whip, R.thorn[0]); dot(c, 27, 19 - whip, R.thorn[0]); dot(c, 28, 22 - whip * 1.5, R.thorn[1]);
}

/** The Rootglass Hart: the old stags of the canopy, grown huge, a moss mantle on the back, antlers of living rootglass. */
function paintRootglassHart(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], wag = [0, 1, 0, -1][f];
  poly(c, [[8, 17 + b], [4, 15 + wag], [6, 19 + b]], R.hart);
  legs4(c, f, 10, 25, 21 + b, 36, 2, R.hartDk, R.hart, R.bark[3]);
  orb(c, 17.5, 18 + b, 10, 5.5, R.hart);
  px(c, 10, 22 + b, 15, 1, R.hart[2]);
  // Dappling, and the moss mantle over the shoulders.
  for (const [x, y] of [[12, 17], [15, 19], [19, 17], [22, 19], [13, 20]] as const) dot(c, x, y + b, R.hart[0]);
  orb(c, 18, 13.5 + b, 8, 2.2, R.moss);
  for (let i = 0; i < 4; i++) dot(c, 12 + i * 4, 15 + b + (i % 2), R.moss[2]);
  // Neck and head, held high.
  poly(c, [[24, 16 + b], [27, 9 + b], [31, 10 + b], [30, 18 + b]], R.hart);
  poly(c, [[28, 8 + b], [26, 5 + b], [30, 7 + b]], R.hartDk);
  orb(c, 31, 10 + b, 3.6, 3.2, R.hart);
  poly(c, [[32, 9 + b], [37.5, 11 + b], [37.5, 13 + b], [32, 13 + b]], R.hart);
  dot(c, 37, 11 + b, OUT); dot(c, 33, 13 + b, R.hart[3]);
  glow(c, 31, 9 + b, 1, ROOTGLOW);
  // Antlers of rootglass: the far one darker, both branching, every tip alight.
  limb(c, [32, 8 + b], [35, 3 + b], 1, R.rootglass); limb(c, [34, 5 + b], [37, 4 + b], 1, R.rootglass); limb(c, [35, 3 + b], [36, 1 + b], 1, R.rootglass);
  limb(c, [30, 8 + b], [27, 3 + b], 1, R.rootglass); limb(c, [28, 5 + b], [25, 4 + b], 1, R.rootglass); limb(c, [27, 3 + b], [28, 1 + b], 1, R.rootglass);
  dot(c, 36, 1 + b, ROOTGLOW[0]); dot(c, 28, 1 + b, ROOTGLOW[0]); dot(c, 25, 4 + b, ROOTGLOW[1]); dot(c, 37, 4 + b, ROOTGLOW[1]);
}

/** The Thorn Weaver: a spider of bark and thorn, a rootglass sigil on its back; it spits thorns from its web. */
function paintThornWeaver(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  const legs = (r: Ramp, dx: number, near: boolean) => {
    for (let i = 0; i < 4; i++) {
      // Hips along the thorax; each leg arcs up to a high knee and out to a foot far from the body, a thorn at the knee.
      const hx = 18 + i * 2 + dx, sw = ((i + (near ? 1 : 0)) % 2 ? 1 : -1) * STEP[f] / 2, lift = (i + (near ? 1 : 0)) % 2 ? liftA(f) : liftB(f);
      const kx = hx + (i - 1.5) * 5 + sw / 2, ky = 3 + b + (near ? 2 : 0) + Math.abs(i - 1.5), fx = hx + (i - 1.5) * 10.5 + sw;
      limb(c, [hx, 13 + b], [kx, ky], near ? 2 : 1, r); limb(c, [kx, ky], [fx, 25 - lift], 1, r);
      dot(c, kx, ky - 1, R.thorn[0]); dot(c, fx, 25 - lift, r[3]);
    }
  };
  legs(R.thornDk, 1, false);
  // The abdomen, spinnerets and a thread back to the web.
  line(c, [2, 14 + b], [0, 20], R.bone[1]);
  orb(c, 9, 13 + b, 7.5, 6.5, R.bark);
  for (const [x, y] of [[5, 9], [9, 7], [13, 9], [6, 16]] as const) { dot(c, x, y + b, R.thorn[0]); dot(c, x, y + b - 1, R.thorn[1]); }
  line(c, [6, 12 + b], [12, 12 + b], ROOTGLOW[2]); line(c, [9, 9 + b], [9, 16 + b], ROOTGLOW[2]); glow(c, 9, 12 + b, 1, ROOTGLOW);
  // Thorax and head, a cluster of rootglass eyes, fangs.
  orb(c, 20, 13 + b, 5, 4, R.thorn);
  orb(c, 26, 13.5 + b, 3.6, 3, R.thorn);
  glow(c, 26, 11 + b, 1, ROOTGLOW); glow(c, 28, 12 + b, 1, ROOTGLOW); dot(c, 27, 10 + b, ROOTGLOW[1]);
  limb(c, [28, 15 + b], [30, 18 + b], 1, R.bone); limb(c, [26, 16 + b], [27, 19 + b], 1, R.bone);
  legs(R.thorn, 0, true);
}

/** The temple's guardian: a carved stone giant the Root grew through, a rootglass heart, a crown of roots. */
function guardian(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f] / 2;
  // Legs: stone pillars bound in roots.
  poly(c, [[11, 32], [17, 32], [17 - s, 44 - liftB(f) / 2], [10 - s, 44 - liftB(f) / 2]], R.templeDk);
  poly(c, [[21, 32], [27, 32], [28 + s, 44 - liftA(f) / 2], [21 + s, 44 - liftA(f) / 2]], R.temple);
  line(c, [21 + s, 35], [27 + s, 39], R.bark[1]); line(c, [22 + s, 40], [27 + s, 37], R.bark[2]);
  // The far arm.
  limb(c, [8, 16 + b], [5 - s, 29 + b], 5, R.templeDk); orb(c, 5 - s, 31 + b, 3.5, 3, R.templeDk);
  // The torso: a carved block, its bands, the heart in a cracked socket.
  poly(c, [[7, 13 + b], [31, 13 + b], [28, 33 + b], [10, 33 + b]], R.temple);
  line(c, [9, 18 + b], [29, 18 + b], R.temple[2]); line(c, [11, 29 + b], [27, 29 + b], R.temple[2]);
  for (let i = 0; i < 4; i++) dot(c, 12 + i * 5, 16 + b, R.temple[3]);
  orb(c, 19, 23.5 + b, 4.6, 4, R.void);
  orb(c, 19, 23.5 + b, 3 + (f % 2) * .4, 2.8, ROOTGLOW);
  glow(c, 18, 22 + b, 2, ROOTGLOW);
  line(c, [15, 26 + b], [11, 32 + b], R.bark[1]); line(c, [23, 21 + b], [27, 15 + b], R.bark[1]); line(c, [22, 26 + b], [25, 32 + b], R.bark[2]);
  // Shoulders under moss; a sapling grows from the near one.
  orb(c, 8, 14 + b, 5, 4, R.temple); orb(c, 30, 14 + b, 5, 4, R.temple);
  orb(c, 8, 11.5 + b, 5, 1.8, R.moss); orb(c, 30, 11.5 + b, 5, 1.8, R.moss);
  limb(c, [32, 11 + b], [34, 4 + b], 1, R.bark); orb(c, 34, 3 + b, 3, 2.4, R.vine); orb(c, 31.5, 5 + b, 2, 1.6, R.vine);
  // The head: a carved face, rootglass eyes, a crown of roots.
  poly(c, [[14, 3 + b], [24, 3 + b], [25, 12 + b], [13, 12 + b]], R.temple);
  px(c, 15, 6 + b, 3, 2, R.void[1]); px(c, 21, 6 + b, 3, 2, R.void[1]);
  glow(c, 16, 6 + b, 1, ROOTGLOW); glow(c, 22, 6 + b, 1, ROOTGLOW);
  line(c, [16, 10 + b], [22, 10 + b], R.temple[3]);
  for (let i = 0; i < 5; i++) limb(c, [14.5 + i * 2.3, 3 + b], [13 + i * 3, -1 + b + (i % 2)], 1, R.bark);
  // The near arm, vines hanging off it.
  limb(c, [30, 16 + b], [33 + s, 29 + b], 5, R.temple); orb(c, 33 + s, 31 + b, 4, 3.5, R.temple);
  line(c, [31, 19 + b], [31, 27 + b], R.vine[1]); dot(c, 31, 28 + b, R.vine[0]);
}
/** The Mossbound Colossus, the Overgrown Temple's keeper: the guardian grown huge, the Root's own heart set in its chest. */
function paintColossus(c: CanvasRenderingContext2D, f: number): void { grown(1.6, 2, 3, () => guardian(c, f)); }

export const MOBS: Readonly<Record<string, MobDef>> = {
  'lava-hound': {
    id: 'lava-hound', name: 'Lava Hound', hp: 120, speed: 50, dmg: [7, 12], rate: 1.1, sight: 130, level: 10, hits: 'fire',
    lore: 'Born in a kiln that was never lit by hand, it tracks a warm boot-print for miles and sleeps in the cracks that still glow.',
    coins: [10, 30], drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintHound, w: 32, h: 24,
  },
  'obsidian-golem': {
    id: 'obsidian-golem', name: 'Obsidian Golem', hp: 260, speed: 22, dmg: [12, 20], rate: 1.7, sight: 110, level: 14,
    lore: 'The glass-cutters walked away mid-shift. Their last statue did not, and it still guards the seam it was told to hold.',
    coins: [24, 60], drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .08 }], paint: paintGolem, w: 34, h: 40,
  },
  'ember-warden': {
    id: 'ember-warden', name: 'The Ember Warden', hp: 420, speed: 24, dmg: [10, 16], rate: 1.6, sight: 140, level: 8, hits: 'fire',
    lore: 'Keeper of the flooded galleries, it banks the old forge-fire each night and bites anyone who comes to stoke it.',
    coins: [120, 220], drops: [{ material: 'infernal-heartstone', qty: 1, chance: .5 }, { material: 'ember-residue', qty: 2, chance: 1 }], paint: paintWarden, w: 40, h: 56, rank: 'boss',
  },
  'magma-tyrant': {
    id: 'magma-tyrant', name: 'The Magma Tyrant', hp: 1400, speed: 20, dmg: [18, 30], rate: 1.8, sight: 160, level: 20, hits: 'fire',
    lore: 'It was a crown once, poured too hot. Now the caldera wears it, and the caldera does not take kindly to visitors.',
    coins: [400, 700], drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintTyrant, w: 58, h: 72, rank: 'boss',
  },
  'ash-wolf': {
    id: 'ash-wolf', name: 'Ash Wolf', hp: 45, speed: 46, dmg: [3, 7], rate: 1.1, sight: 110, level: 1,
    lore: 'Grey as a cold hearth and just as quiet, it hunts the Emberwood in the hour after the last ember fades.',
    coins: [2, 9], drops: [{ material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintWolf, w: 30, h: 22,
  },
  'cinder-imp': {
    id: 'cinder-imp', name: 'Cinder Imp', hp: 80, speed: 38, dmg: [5, 9], rate: 1.2, sight: 120, level: 2, hits: 'fire',
    lore: 'A spark that grew a grudge. It throws small tempers and smaller fires, and giggles when the soot finds your collar.',
    coins: [6, 18], drops: [{ material: 'ember-residue', qty: 1, chance: .3 }], paint: paintImp, w: 24, h: 24,
  },
  'rivet-maw': {
    id: 'rivet-maw', name: 'Rivet Maw', hp: 60, speed: 34, dmg: [3, 6], rate: 1.3, sight: 96, level: 1,
    lore: 'Scrap-iron with a hunger. Somebody forgot to take the teeth out of the rivet barrel, and now they chew.',
    coins: [3, 13], drops: [{ material: 'cinder-ore', qty: 1, chance: .7 }], paint: paintMaw, w: 24, h: 20,
  },
  'cinder-bailiff': {
    id: 'cinder-bailiff', name: 'Cinder Bailiff', hp: 110, speed: 28, dmg: [6, 10], rate: 1.5, sight: 110, level: 3,
    lore: 'It still serves writs to the dead mine, and swings its ledger-hook at anyone found behind on their dues.',
    coins: [8, 24], drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .35 }], paint: paintBailiff, w: 26, h: 34,
  },
  // The undead and the Cinder clans (owner 2026-10-20: "lots of scary monsters … skeletons, dragons, orcs, undead").
  'bone-walker': {
    id: 'bone-walker', name: 'Bone Walker', hp: 80, speed: 30, dmg: [4, 8], rate: 1.4, sight: 96, level: 6,
    lore: 'It remembers walking to work, so it walks. Nobody has told it which way the work went.',
    coins: [5, 16], drops: [{ material: 'ember-residue', qty: 1, chance: .25 }], paint: paintBoneWalker, w: 22, h: 36,
  },
  'bone-archer': {
    id: 'bone-archer', name: 'Bone Archer', hp: 85, speed: 30, dmg: [3, 6], rate: 1.5, sight: 140, level: 8,
    lore: 'A bow strung with something that is not quite sinew. It only ever aims at the lantern you carry.',
    coins: [8, 20], drops: [{ material: 'world-root-bark', qty: 1, chance: .3 }], paint: paintBoneArcher, w: 26, h: 36,
    ranged: { range: 92, keep: 76, rate: 1.9, dmg: [6, 10], speed: 120, kind: 'arrow' },
  },
  'ash-ghoul': {
    id: 'ash-ghoul', name: 'Ash Ghoul', hp: 70, speed: 60, dmg: [5, 9], rate: .8, sight: 130, level: 9,
    lore: 'Quick and starved, it scrapes the ash from old pyres and wears it like a shawl against the cold it can no longer feel.',
    coins: [6, 18], drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintGhoul, w: 28, h: 22,
  },
  'cinder-wraith': {
    id: 'cinder-wraith', name: 'Cinder Wraith', hp: 150, speed: 32, dmg: [8, 13], rate: 1.4, sight: 130, level: 12,
    lore: 'A flicker of someone who stood too near the furnace door. It drifts over the slag, humming a shift-bell song.',
    coins: [14, 36], drops: [{ material: 'ember-residue', qty: 2, chance: .5 }, { material: 'infernal-heartstone', qty: 1, chance: .04 }], paint: paintWraith, w: 24, h: 36,
    floats: true, ghost: true,
  },
  'cinder-orc': {
    id: 'cinder-orc', name: 'Cinder-clan Orc', hp: 170, speed: 36, dmg: [9, 15], rate: 1.3, sight: 120, level: 10,
    lore: 'The Cinder clans trade in iron and grudges. This one has plenty of both, and would like to see yours.',
    coins: [12, 32], drops: [{ material: 'cinder-ore', qty: 1, chance: .5 }, { material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintOrc, w: 28, h: 38,
  },
  'orc-firecaller': {
    id: 'orc-firecaller', name: 'Orc Firecaller', hp: 130, speed: 30, dmg: [6, 10], rate: 1.5, sight: 150, level: 13,
    lore: 'It talks to the coals in a low voice, and the coals, against their better judgement, answer.',
    coins: [16, 40], drops: [{ material: 'ember-residue', qty: 2, chance: .6 }], paint: paintFirecaller, w: 28, h: 38,
    ranged: { range: 100, keep: 74, rate: 2.1, dmg: [10, 16], speed: 110, kind: 'fire' },
  },
  'orc-warlord': {
    id: 'orc-warlord', name: 'Orc Warlord', hp: 440, speed: 32, dmg: [15, 24], rate: 1.5, sight: 140, level: 16,
    lore: 'Scarred, crowned in a smithing helm, and followed by every drum in the Badlands. It has never once asked for directions.',
    coins: [60, 130], drops: [{ material: 'cinder-ore', qty: 3, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .15 }], paint: paintWarlord, w: 42, h: 52, rank: 'champion',
  },
  'ember-drake': {
    id: 'ember-drake', name: 'Ember Drake', hp: 320, speed: 40, dmg: [12, 18], rate: 1.4, sight: 150, level: 18,
    lore: 'It nests where the ground sighs smoke, and treats every traveller as a spark that wandered too near its kindling.',
    coins: [40, 90], drops: [{ material: 'ember-residue', qty: 2, chance: .8 }, { material: 'infernal-heartstone', qty: 1, chance: .1 }], paint: paintDrake, w: 38, h: 30,
    ranged: { range: 84, keep: 0, rate: 3, dmg: [12, 20], speed: 130, kind: 'fire' },
  },
  'bone-dragon': {
    id: 'bone-dragon', name: 'The Ashbone Dragon', hp: 2200, speed: 22, dmg: [22, 34], rate: 1.8, sight: 190, level: 25,
    lore: 'The oldest thing under the Bastion. It was a dragon once; it is now a promise the ash made, and the ash keeps its promises.',
    coins: [600, 1000], drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 3, chance: 1 }], paint: paintBoneDragon, w: 76, h: 64, rank: 'boss',
    ranged: { range: 130, keep: 0, rate: 3.4, dmg: [16, 26], speed: 120, kind: 'breath', spread: 3 },
    summon: { type: 'bone-walker', count: 2, at: .5 },
  },
  // The Molten Deep's lower floors (−4…−6) and the Forge of the Four.
  'slag-crawler': {
    id: 'slag-crawler', name: 'Slag Crawler', hp: 300, speed: 30, dmg: [14, 22], rate: 1.4, sight: 120, level: 21,
    lore: 'Half beetle, half cooling slag, it walks the rivers of the Deep and leaves a crust behind that hardens into the next floor.',
    coins: [30, 70], drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .4 }], paint: paintCrawler, w: 36, h: 20,
  },
  'glass-sentinel': {
    id: 'glass-sentinel', name: 'Glass Sentinel', hp: 340, speed: 20, dmg: [12, 18], rate: 1.8, sight: 150, level: 24,
    lore: 'Poured by the foundry\'s last shift and never told to stop, it fires molten glass at anything that is not a mould.',
    coins: [40, 90], drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .12 }], paint: paintSentinel, w: 26, h: 42,
    ranged: { range: 110, keep: 80, rate: 2.2, dmg: [12, 18], speed: 140, kind: 'fire' },
  },
  'anvil-warden': {
    id: 'anvil-warden', name: 'The Anvil-Warden', hp: 1100, speed: 22, dmg: [16, 26], rate: 1.7, sight: 150, level: 18,
    lore: 'The First Smith\'s anvil grew legs to keep its oath; it still hammers the air for a blade nobody will finish.',
    coins: [300, 550], drops: [{ material: 'infernal-heartstone', qty: 1, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintAnvilWarden, w: 48, h: 67, rank: 'boss',
    summon: { type: 'cinder-bailiff', count: 2, at: .5 },
  },
  'cinder-sovereign': {
    id: 'cinder-sovereign', name: 'The Cinder Sovereign', hp: 3200, speed: 22, dmg: [26, 40], rate: 1.7, sight: 170, level: 30,
    lore: 'The heart of the Deep wears a crown of its own sparks. It does not rule the fire — it is what the fire remembers.',
    coins: [900, 1500], drops: [{ material: 'infernal-heartstone', qty: 3, chance: 1 }, { material: 'ember-residue', qty: 4, chance: 1 }], paint: paintSovereign, w: 68, h: 72, rank: 'boss',
    ranged: { range: 130, keep: 0, rate: 3.2, dmg: [20, 32], speed: 120, kind: 'breath', spread: 5 },
    // At half its life it calls the hounds of the deep to its side.
    summon: { type: 'lava-hound', count: 2, at: .5 },
  },
  // The Verdant Wilds (levels 15–40): the Greenwood, the Deep Wilds, the Sunken Courts and the Overgrown Temple.
  'canopy-bat': {
    id: 'canopy-bat', name: 'Canopy Bat', hp: 170, speed: 54, dmg: [8, 13], rate: 1, sight: 140, level: 15,
    lore: 'It sleeps folded into the giant trees like a dead leaf, and wakes all at once when a lantern passes underneath.',
    coins: [24, 54], drops: [{ material: 'verdant-sap', qty: 1, chance: .35 }], paint: paintCanopyBat, w: 28, h: 24,
  },
  'moss-stalker': {
    id: 'moss-stalker', name: 'Moss Stalker', hp: 260, speed: 48, dmg: [12, 19], rate: 1.1, sight: 140, level: 17,
    lore: 'You will not see it in the moss. You will see the moss move, once, and that is the last thing the moss does quietly.',
    coins: [30, 66], drops: [{ material: 'thornroot', qty: 1, chance: .6 }, { material: 'world-root-bark', qty: 1, chance: .15 }], paint: paintMossStalker, w: 34, h: 24,
  },
  'vine-lasher': {
    id: 'vine-lasher', name: 'Vine Lasher', hp: 340, speed: 22, dmg: [15, 23], rate: 1.3, sight: 110, level: 21,
    lore: 'A bloom that learned to walk so it could go where the food was. It still sings to the bees, and the bees still come.',
    coins: [34, 74], drops: [{ material: 'thornroot', qty: 2, chance: .8 }, { material: 'verdant-sap', qty: 1, chance: .5 }], paint: paintVineLasher, w: 30, h: 36,
  },
  'rootglass-hart': {
    id: 'rootglass-hart', name: 'Rootglass Hart', hp: 460, speed: 44, dmg: [18, 27], rate: 1.4, sight: 150, level: 24,
    lore: 'The Rootglass Stags that live long enough stop being shy. Their antlers ring like glass when they lower their heads.',
    coins: [40, 88], drops: [{ material: 'world-root-bark', qty: 1, chance: .5 }, { material: 'verdant-sap', qty: 2, chance: .6 }], paint: paintRootglassHart, w: 40, h: 38,
  },
  'thorn-weaver': {
    id: 'thorn-weaver', name: 'Thorn Weaver', hp: 380, speed: 30, dmg: [14, 21], rate: 1.5, sight: 150, level: 28,
    lore: 'It weaves its web from thornroot and spits what it does not need. The Sunken Courts are hung with its work like old banners.',
    coins: [46, 96], drops: [{ material: 'thornroot', qty: 2, chance: 1 }, { material: 'world-root-bark', qty: 1, chance: .25 }], paint: paintThornWeaver, w: 44, h: 27,
    ranged: { range: 104, keep: 70, rate: 2, dmg: [16, 24], speed: 130, kind: 'arrow' },
  },
  'mossbound-colossus': {
    id: 'mossbound-colossus', name: 'The Mossbound Colossus', hp: 3600, speed: 20, dmg: [28, 42], rate: 1.8, sight: 170, level: 34,
    lore: 'The temple set it to keep the shrine; the Root grew in and kept the guardian. Its heart is rootglass now, and it beats slow.',
    coins: [1000, 1700], drops: [{ material: 'world-root-bark', qty: 3, chance: 1 }, { material: 'verdant-sap', qty: 4, chance: 1 }, { material: 'thornroot', qty: 4, chance: 1 }], paint: paintColossus, w: 64, h: 76, rank: 'boss',
    // At half its life it calls the temple's lashers up through the stones.
    summon: { type: 'vine-lasher', count: 2, at: .5 },
  },
};

/** The Warlock's raised skeleton (Raise Skeleton): drawn like a Bone Walker blanched violet; never a spawn. */
export const RAISED_SKELETON: MobDef = {
  id: 'raised-skeleton', name: 'Raised Skeleton', hp: 1, speed: 52, dmg: [1, 1], rate: 1.1, sight: 0, level: 1,
  coins: [0, 0], drops: [], paint: paintRaised, w: 22, h: 36,
};

const sheets = new Map<string, HTMLCanvasElement>();
/** Frames in a creature's sheet: a walk or a hover (contact, passing, contact, passing). The engine reads the count off the sheet. */
export const MOB_FRAMES = 4;
/** A boss's rim, in its element's colour (docs/design/effects-spec.md): fire for the forge-born, violet bone-light for the dragon. */
const RIM: Readonly<Record<string, string>> = {
  'ember-warden': '#ff8a2e', 'magma-tyrant': '#ff8a2e', 'anvil-warden': '#ffb347', 'cinder-sovereign': '#ff8a2e', 'bone-dragon': '#b06bff',
  'mossbound-colossus': '#7affd0',
};
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/**
 * The selective outline, in place: every empty pixel touching the sprite takes a dark of the colour it borders (lighter on
 * the lit top-left, near-black down the shadow side); a soft glow's halo is left out of it. A boss gets a second ring, its rim.
 */
function outline(img: ImageData, rim?: string): void {
  const { width: w, height: h, data: d } = img, src = new Uint8ClampedArray(d), edge = new Uint8Array(w * h);
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] >= 200;
  const out = rgb(OUT);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (filled(x, y)) continue;
    let n = 0, lit = 0;
    const sum = [0, 0, 0];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (!filled(x + dx, y + dy)) continue;
      const i = ((y + dy) * w + x + dx) * 4;
      n++; sum[0] += src[i]; sum[1] += src[i + 1]; sum[2] += src[i + 2];
      if (dx > 0 || dy > 0) lit++;
    }
    if (!n) continue;
    const t = lit * 2 >= n ? .7 : .86, i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(sum[k] / n * (1 - t) + out[k] * t);
    d[i + 3] = 255; edge[y * w + x] = 1;
  }
  if (!rim) return;
  const col = rgb(rim);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (edge[y * w + x] || filled(x, y)) continue;
    if (![[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && edge[(y + dy) * w + x + dx])) continue;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 170;
  }
}
/** A creature's frames side by side, each painted once, outlined (and a boss rimmed) in its own cell. */
export function mobSheet(def: MobDef): HTMLCanvasElement {
  let s = sheets.get(def.id);
  if (s) return s;
  s = document.createElement('canvas'); s.width = def.w * MOB_FRAMES; s.height = def.h;
  const o = s.getContext('2d')!;
  for (let f = 0; f < MOB_FRAMES; f++) {
    const cell = document.createElement('canvas'); cell.width = def.w; cell.height = def.h;
    const c = cell.getContext('2d', { willReadFrequently: true })!;
    def.paint(c, f);
    const img = c.getImageData(0, 0, def.w, def.h);
    outline(img, RIM[def.id]);
    o.putImageData(img, f * def.w, 0);
  }
  sheets.set(def.id, s);
  return s;
}

export interface MobSpawn { key: string; type: string; x: number; y: number }

export interface Mob {
  key: string;
  def: MobDef;
  x: number; y: number;
  hx: number; hy: number;
  hp: number;
  /** Ember Curse: seconds left, and the burn's tick timer. */
  cursed: number;
  burnT: number;
  face: 1 | -1;
  t: number;
  cd: number;
  hit: number;
  wander: { x: number; y: number } | null;
  wait: number;
  /** Seconds until its next shot (a ranged creature). */
  rcd: number;
  /** It has called its summons (once). */
  summoned: boolean;
  /** A boss's wind-up before its big attack (seconds left; 0 = none), and where that attack will land. */
  tell: number;
  aim: { x: number; y: number } | null;
}

/**
 * A boss's tell (docs/design/effects-spec.md, fourth pass): the seconds between the wind-up showing on the ground and
 * the breath leaving the jaws, aimed where the prey stood when it began — a step aside in that time and it misses.
 * Summons get the same: a sigil where each will stand, for CALL_TELL seconds before it climbs out.
 */
export const BOSS_TELL = .6;
export const CALL_TELL = .6;
/** Does this creature wind up before it shoots? Bosses with a ranged attack (the Ashbone Dragon, the Cinder Sovereign). */
export function windsUp(def: MobDef): boolean { return def.rank === 'boss' && !!def.ranged; }
/** A summons on its way: the sigil on the ground where it will stand, `t` seconds before it does. */
export interface Call { x: number; y: number; type: string; key: string; t: number }

/** A shot a creature looses (a bone arrow, a fire bolt, a breath): it flies straight; stepping aside dodges it. */
export interface MobShot { x: number; y: number; vx: number; vy: number; dmg: number; age: number; life: number; kind: 'arrow' | 'fire' | 'breath'; type?: DamageType }

/** Aim a shot from (x, y) at (tx, ty), turned `angle` radians off true (a breath fans): it flies `range` × 1.4 at most. */
export function aimShot(x: number, y: number, tx: number, ty: number, speed: number, range: number, dmg: number, kind: MobShot['kind'], angle = 0): MobShot {
  const a = Math.atan2(ty - y, tx - x) + angle;
  return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, age: 0, life: range * 1.4 / speed, kind };
}
export function stepShot(s: MobShot, dt: number): void { s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt; }
/** Does the shot strike a body whose middle is at (x, y)? */
export function shotHits(s: { x: number; y: number }, x: number, y: number, r = 8): boolean { return Math.hypot(s.x - x, s.y - y) <= r; }

/** A skeleton the Warlock raised (Raise Skeleton): it follows him, fights the nearest foe, and crumbles in time. */
export interface Minion {
  id: number;
  x: number; y: number;
  hp: number; maxHp: number;
  dmg: [number, number];
  cd: number;
  t: number;
  face: 1 | -1;
  /** Seconds before it crumbles. */
  life: number;
  hit: number;
  target: Mob | null;
}

/** A raised skeleton's life and blow: Raise Skeleton's numbers grown with the Keeper's level and spell power. */
export function raisedStats(level: number, power: number, v: Readonly<Record<string, number>>): { hp: number; dmg: [number, number] } {
  const lv = Math.max(1, Math.floor(level)), pw = Math.max(.1, power);
  const hp = Math.round(v['hp'] * (1 + .1 * (lv - 1)) * pw);
  const avg = v['dmg'] * (1 + .06 * (lv - 1)) * pw;
  return { hp, dmg: [Math.max(1, Math.round(avg * .8)), Math.max(1, Math.round(avg * 1.2))] };
}
/** Keep at most `cap` raised: the oldest crumble first. Returns the ones let go. */
export function capMinions(list: Minion[], cap: number): Minion[] {
  return list.length > cap ? list.splice(0, list.length - cap) : [];
}
/** The foe a raised skeleton goes for: the nearest within its sight that is also within the leash of the Keeper. */
export function pickMinionTarget(from: { x: number; y: number }, mobs: readonly Mob[], keeper: { x: number; y: number }, sight: number, leash: number): Mob | null {
  let best: Mob | null = null, bd = sight;
  for (const m of mobs) {
    if (m.hp <= 0 || Math.hypot(m.x - keeper.x, m.y - keeper.y) > leash) continue;
    const d = Math.hypot(m.x - from.x, m.y - from.y);
    if (d <= bd) { bd = d; best = m; }
  }
  return best;
}

/** A Bone Spear in flight: it passes through every foe in its line, striking each once. */
export interface Spear { x: number; y: number; vx: number; vy: number; age: number; life: number; hit: Mob[] }

export interface Drop {
  id: string;
  x: number; y: number;
  coins: number;
  material?: string;
  qty: number;
  item?: { definitionId: string; rarity: LootRarity; unique: boolean; level?: number };
  rune?: string;
  /** Gear and runes: the rung of the rarity ladder (the beam it stands in). */
  rarity?: LootRarity;
  label: string;
  color: string;
  age: number;
}

export interface Floater { x: number; y: number; text: string; color: string; age: number }

/** A short-lived picture in the world: a slash, a fire ring, a heal, wood chips, haste dust. */
export interface Effect {
  kind: 'slash' | 'wave' | 'heal' | 'chips' | 'dust' | 'drain' | 'curse' | 'ward' | 'bolt-hit' | 'raise' | 'spark'
    // The effects pass (docs/design/effects-spec.md): an aura's pulse at a foe's side, a crit's white-hot core,
    // the Bone Spear's release flash and the bone chips at each pierce.
    | 'pulse' | 'crit' | 'flash' | 'bone-chips';
  x: number; y: number; age: number; life: number; dir: number; tx?: number; ty?: number;
  /** A pulse's element: the aura that did the work. */
  el?: 'ember' | 'life';
}

/** A bolt in flight toward a creature. */
export interface Bolt { x: number; y: number; to: Mob; dmg: number; age: number }


/** The ladder's colours on the ground (labels, the name that floats up on pick-up): the `--cozy-loot-*` tokens via td-fx. */
export const RARITY_COLOR: Readonly<Record<LootRarity, string>> = {
  common: LOOT.common.body, uncommon: LOOT.uncommon.body, rare: LOOT.rare.body, epic: LOOT.epic.body,
  legendary: LOOT.legendary.body, mythic: LOOT.mythic.body, singular: LOOT.singular.body,
};

const REACH = 24;          // the Keeper's swing
const MOB_REACH = 18;      // a creature's bite
const RESPAWN = 75;        // seconds until a spawn comes back
const DESPAWN = 300;       // seconds a drop lies on the ground
const CORPSE_SECS = 20;    // a kill's corpse stays fresh for Raise Skeleton this long
const MINION_SIGHT = 6 * TILE;
const MINION_LEASH = 9 * TILE;
const MINION_SPEED = 52;
const SPEAR_SPEED = 280;

/** What the mob system needs from the engine. */
export interface MobHost {
  readonly options: EngineOptions;
  walkable(c: number, r: number): boolean;
  levelId(): string;
  player(): { x: number; y: number };
  hurtPlayer(n: number): void;
  healPlayer(n: number): void;
  /** Can a floating creature drift over this tile (floor, lava, embers)? Default: walkable. */
  hover?(c: number, r: number): boolean;
  /** Does a shot fly over this tile (not into a wall)? Default: walkable. */
  passable?(c: number, r: number): boolean;
  /** The Keeper swung (an attack or an ability): the host plays the swing toward `at`. */
  swung(at: { x: number; y: number } | null): void;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export class MobSystem {
  readonly mobs: Mob[] = [];
  readonly drops: Drop[] = [];
  readonly floaters: Floater[] = [];
  readonly effects: Effect[] = [];
  readonly bolts: Bolt[] = [];
  /** Creatures' shots in flight, the Keeper's Bone Spears, his raised skeletons, and the fresh dead they rise from. */
  readonly shots: MobShot[] = [];
  /** Summons on their way (a boss's call at half life): each a sigil on the ground until it climbs out. */
  readonly calls: Call[] = [];
  readonly spears: Spear[] = [];
  readonly minions: Minion[] = [];
  readonly corpses: { x: number; y: number; at: number }[] = [];
  private minionSeq = 0;
  /** Seconds each skill still cools. */
  readonly cooldowns: Partial<Record<SkillId, number>> = {};
  mana = MAX_MANA;
  /** The level's mana cap and spell power (td-skills levelStats). */
  maxMana = MAX_MANA;
  power = 1;
  /** Mana back per second, and Agility's quicker staff (td-skills levelStats). */
  regen = MANA_REGEN;
  agility = 0;
  /** Worn gear (td-skills fightStats): cast speed (fraction), crit chance (0..1), Defense, and the Keeper's level. */
  castSpeed = 0;
  crit = 0;
  defense = 0;
  keeperLevel = 1;
  /** Worn resists per element (td-skills fightStats), each already capped at 75. */
  resists: Partial<Record<Element, number>> = {};
  /** The running aura (one at a time, D2), or none. */
  aura: SkillId | null = 'aura-embers';
  /** Dark Ward: damage it still absorbs, seconds left. */
  ward = 0;
  wardT = 0;
  /** Seconds of Haste left (kept for kits that have it). */
  haste = 0;
  /** The basic attack reaches this far (art px): the staff's bolt (7 tiles). */
  readonly range = SKILLS['ember-bolt'].vars['range'] * TILE;
  private auraT = 0;
  target: Mob | null = null;
  attacking = false;
  private swing = 0;
  private kills = 0;
  private readonly deadUntil = new Map<string, number>();
  private clock = 0;

  constructor(private readonly host: MobHost) {}

  /** Bring the level's spawns to life (those not resting after a death) and drop everything of the last level. */
  enterLevel(spawns: readonly MobSpawn[]): void {
    this.mobs.length = 0; this.drops.length = 0; this.target = null;
    // Shots and the dead belong to the place they were in; the raised follow the Keeper (owner 2026-10-20: "summons
    // should last until they die or we despawn them, they shouldn't die just from travelling") — the leash below sets
    // them down at his side on the new ground.
    this.shots.length = 0; this.spears.length = 0; this.corpses.length = 0; this.calls.length = 0;
    for (const k of this.minions) { k.target = null; k.x = 1e9; k.y = 1e9; }
    this.addSpawns(spawns);
  }
  /** Spawns that came into reach (the endless surface hands them over chunk by chunk). */
  addSpawns(spawns: readonly MobSpawn[]): void {
    for (const s of spawns) {
      if (this.mobs.some(m => m.key === s.key) || (this.deadUntil.get(s.key) ?? 0) > this.clock) continue;
      const def = MOBS[s.type];
      if (!def) continue;
      this.mobs.push(this.spawnMob(s.key, def, s.x, s.y));
    }
  }
  private spawnMob(key: string, def: MobDef, x: number, y: number): Mob {
    return { key, def, x, y, hx: x, hy: y, hp: def.hp, cursed: 0, burnT: 0, face: 1, t: Math.random() * 3, cd: 1, hit: 0, wander: null, wait: Math.random() * 3, rcd: (def.ranged?.rate ?? 1) * (.5 + Math.random() * .5), summoned: false, tell: 0, aim: null };
  }
  /** Forget creatures far from the Keeper (the surface never ends; they come back when their chunk does). */
  prune(maxDist: number): void {
    const p = this.host.player();
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (Math.hypot(m.x - p.x, m.y - p.y) > maxDist && m !== this.target) this.mobs.splice(i, 1);
    }
  }

  /** The creature under a world point (a tap), if any. */
  mobAt(x: number, y: number): Mob | null {
    let best: Mob | null = null, bd = 18;
    for (const m of this.mobs) { const d = Math.hypot(m.x - x, m.y - m.def.h / 2 - y); if (d < bd) { bd = d; best = m; } }
    return best;
  }

  update(dt: number): void {
    this.clock += dt;
    const p = this.host.player();
    this.swing = Math.max(0, this.swing - dt);
    // The Keeper's attack: the target, or with the key held the nearest creature in reach.
    if (this.target && (this.target.hp <= 0 || !this.mobs.includes(this.target))) this.target = null;
    let foe = this.target;
    if (!foe && this.attacking) {
      let bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; foe = m; } }
    }
    // The Warlock's staff: an ember bolt flies to the foe in range (Tibia's auto-attack, at a distance).
    const bolt = SKILLS['ember-bolt'];
    if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
      this.swing = bolt.cd / (1 + this.agility) / (1 + this.castSpeed);
      this.bolts.push({ x: p.x, y: p.y - 22, to: foe, dmg: rnd(bolt.vars['min'], bolt.vars['max']), age: 0 });
      this.host.swung(foe);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i], tx = b.to.x, ty = b.to.y - b.to.def.h / 2;
      b.age += dt;
      const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy), step = 190 * dt;
      if (!this.mobs.includes(b.to) || b.age > 2) { this.bolts.splice(i, 1); continue; }
      if (len <= step + 2) {
        this.bolts.splice(i, 1);
        this.effects.push({ kind: 'bolt-hit', x: tx, y: ty, age: 0, life: .3, dir: 1 });
        this.hitFoe(b.to, b.dmg, '#ffd25a');
      } else { b.x += dx / len * step; b.y += dy / len * step; }
    }
    // The aura (D2): it works on everything near, every second, while it is chosen.
    this.auraT -= dt;
    const auraTick = this.auraT <= 0;
    if (auraTick) this.auraT = 1;
    for (const m of [...this.mobs]) {
      if (m.cursed > 0) {
        m.cursed -= dt; m.burnT -= dt;
        if (m.burnT <= 0) { m.burnT = 1; this.hitFoe(m, SKILLS['ember-curse'].vars['dps'], '#ff9a4a'); if (m.hp <= 0) continue; }
      }
      if (auraTick && this.aura === 'aura-embers' && Math.hypot(m.x - p.x, m.y - p.y) <= SKILLS['aura-embers'].vars['radius'] * TILE) {
        this.effects.push({ kind: 'pulse', el: 'ember', x: m.x, y: m.y, age: 0, life: .2, dir: 1 });
        this.hitFoe(m, SKILLS['aura-embers'].vars['dps'], '#ff8a2e');
      }
    }
    for (const m of [...this.mobs]) {
      m.t += dt; m.cd -= dt; m.rcd -= dt; m.hit = Math.max(0, m.hit - dt);
      // A boss in its wind-up stands its ground; when the tell runs out the attack leaves for where it aimed.
      if (m.tell > 0) {
        m.tell -= dt;
        if (m.tell <= 0) { m.tell = 0; if (m.aim) this.loose(m, m.aim.x, m.aim.y); m.aim = null; }
        else continue;
      }
      // Its prey: the Keeper, or one of his raised skeletons standing closer.
      let prey: Minion | null = null, d = Math.hypot(p.x - m.x, p.y - m.y);
      for (const k of this.minions) { const dk = Math.hypot(k.x - m.x, k.y - m.y); if (dk < d) { d = dk; prey = k; } }
      const px0 = prey ? prey.x : p.x, py0 = prey ? prey.y : p.y;
      const hunting = d < m.def.sight, shoot = m.def.ranged;
      let tx: number | null = null, ty: number | null = null, stop = 2;
      if (hunting) {
        m.wander = null;
        if (shoot && shoot.keep > 0 && d < shoot.keep - 8) { tx = m.x + (m.x - px0); ty = m.y + (m.y - py0); stop = 0; }   // back off
        else if (!(shoot && shoot.keep > 0 && d <= shoot.range)) { tx = px0; ty = py0; stop = MOB_REACH - 4; }
        if (Math.abs(px0 - m.x) > 2) m.face = px0 < m.x ? -1 : 1;
        // A shot at where the prey stands now: a step aside and it flies by. A boss winds up first (BOSS_TELL):
        // it aims now and looses when the tell runs out, so the ground warning is where the breath goes.
        if (shoot && d <= shoot.range && m.rcd <= 0 && m.tell <= 0) {
          m.rcd = shoot.rate;
          if (windsUp(m.def)) { m.tell = BOSS_TELL; m.aim = { x: px0, y: py0 - 12 }; }
          else this.loose(m, px0, py0 - 12);
        }
      } else {
        // Roam near home: a short stroll, a pause, another.
        if (!m.wander) {
          m.wait -= dt;
          if (m.wait <= 0) { m.wander = { x: m.hx + rnd(-40, 40), y: m.hy + rnd(-30, 30) }; m.wait = 1.5 + Math.random() * 3; }
        }
        if (m.wander) { tx = m.wander.x; ty = m.wander.y; if (Math.hypot(tx - m.x, ty - m.y) < 3) m.wander = null; }
      }
      if (tx !== null && ty !== null) {
        const dx = tx - m.x, dy = ty - m.y, len = Math.hypot(dx, dy);
        if (len > stop) {
          const step = Math.min(len, m.def.speed * dt), vx = dx / len * step, vy = dy / len * step;
          if (this.free(m.x + vx, m.y, m.def.floats)) m.x += vx; else m.wander = null;
          if (this.free(m.x, m.y + vy, m.def.floats)) m.y += vy; else m.wander = null;
          if (!hunting && Math.abs(vx) > .05) m.face = vx < 0 ? -1 : 1;
        }
      }
      // A bite when its prey is in reach.
      if (d <= MOB_REACH && m.cd <= 0) {
        m.cd = m.def.rate;
        let n = rnd(m.def.dmg[0], m.def.dmg[1]);
        // A cursed foe bites weaker.
        if (m.cursed > 0) n = Math.max(1, Math.round(n * (1 - SKILLS['ember-curse'].vars['weaken'] / 100)));
        if (prey) this.hurtMinion(prey, n); else this.biteKeeper(n, mobHits(m.def));
      }
    }
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const k = this.calls[i];
      k.t -= dt;
      if (k.t > 0) continue;
      this.calls.splice(i, 1);
      if (MOBS[k.type]) this.mobs.push(this.spawnMob(k.key, MOBS[k.type], k.x, k.y));
      this.effects.push({ kind: 'spark', x: k.x, y: k.y - 6, age: 0, life: .3, dir: 1 });
    }
    this.updateShots(dt);
    this.updateMinions(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.clock - this.corpses[i].at > CORPSE_SECS) this.corpses.splice(i, 1);
    // Walk over loot to pick it up.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const g = this.drops[i];
      g.age += dt;
      if (g.age > DESPAWN) { this.drops.splice(i, 1); continue; }
      // Coins come to the Keeper (a Warlock kills from afar); gear and materials wait to be walked to.
      if (g.coins > 0 && g.age > .6) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
        if (d < 8 * TILE && d > 1) { const v = Math.min(d, (90 + g.age * 60) * dt); g.x += dx / d * v; g.y += dy / d * v; }
      }
      if (Math.hypot(g.x - p.x, g.y - p.y) < 22 && g.age > .4) this.pick(g, i);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.age += dt; f.y -= 14 * dt; if (f.age > 1) this.floaters.splice(i, 1); }
    for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; e.age += dt; if (e.age > e.life) this.effects.splice(i, 1); }
    for (const k of Object.keys(this.cooldowns) as SkillId[]) this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);
    this.mana = Math.min(this.maxMana, this.mana + this.regen * dt);
    if (this.wardT > 0) { this.wardT -= dt; if (this.wardT <= 0) this.ward = 0; }
    if (this.haste > 0) {
      this.haste = Math.max(0, this.haste - dt);
      if (Math.random() < dt * 8) this.effects.push({ kind: 'dust', x: p.x + rnd(-4, 4), y: p.y, age: 0, life: .4, dir: 1 });
    }
  }

  private hitFoe(foe: Mob, raw: number, color: string): void {
    const crit = this.crit > 0 && Math.random() < this.crit;
    const dmg = Math.round(raw * this.power * (crit ? CRIT_MULT : 1));
    if (this.aura === 'aura-siphon') {
      this.host.healPlayer(SKILLS['aura-siphon'].vars['heal']);
      this.effects.push({ kind: 'pulse', el: 'life', x: foe.x, y: foe.y, age: 0, life: .2, dir: 1 });
    }
    if (crit) this.effects.push({ kind: 'crit', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .15, dir: 1 });
    this.hurtMob(foe, dmg, color, crit);
  }
  /** Damage dealt to a creature (by the Keeper's spells or his raised): the number floats, a boss may call help, it may fall. */
  private hurtMob(foe: Mob, dmg: number, color: string, crit = false): void {
    if (foe.hp <= 0) return;
    foe.hp -= dmg; foe.hit = .18;
    this.float(foe.x, foe.y - foe.def.h, crit ? `${dmg}!` : `${dmg}`, color);
    if (foe.hp <= 0) { this.kill(foe); return; }
    const call = foe.def.summon;
    if (call && !foe.summoned && foe.hp <= foe.def.hp * call.at && MOBS[call.type]) {
      foe.summoned = true;
      for (let i = 0; i < call.count; i++) {
        const side = i % 2 ? -1 : 1, x = foe.x + side * (foe.def.w / 2 + 10), y = foe.y + 6;
        const at = this.free(x, y) ? { x, y } : { x: foe.x, y: foe.y };
        // A sigil first, where it will stand (CALL_TELL); it climbs out when the sigil runs out (update).
        this.calls.push({ x: at.x, y: at.y, type: call.type, key: `${foe.key}:call${i}:${Math.round(this.clock * 10)}`, t: CALL_TELL });
      }
    }
  }
  /**
   * A blow or a shot landing on the Keeper (§6): worn Defense turns a share of a physical one aside, a worn resist
   * of an element's; the Dark Ward drinks what it can. The number floats in the type's colour (physical stays red).
   */
  private biteKeeper(raw: number, type: DamageType = 'physical'): void {
    const p = this.host.player();
    let n = incomingDamage(raw, type, this.defense, this.keeperLevel, this.resists);
    if (this.ward > 0) { const soak = Math.min(this.ward, n); this.ward -= soak; n -= soak; this.float(p.x + 8, p.y - 30, `-${soak}`, '#c8a8ff'); }
    if (n > 0) { this.host.hurtPlayer(n); this.float(p.x, p.y - 34, `${n}`, type === 'physical' ? '#ff5a4a' : DAMAGE_COLORS[type]); }
  }
  private hurtMinion(k: Minion, n: number): void {
    k.hp -= n; k.hit = .18;
    this.float(k.x, k.y - 26, `${n}`, '#c8a8ff');
  }

  /** A creature's shot (or a breath's fan of them) at (tx, ty). */
  private loose(m: Mob, tx: number, ty: number): void {
    const shoot = m.def.ranged;
    if (!shoot) return;
    const n = shoot.spread ?? 1;
    for (let i = 0; i < n; i++) {
      let dmg = rnd(shoot.dmg[0], shoot.dmg[1]);
      if (m.cursed > 0) dmg = Math.max(1, Math.round(dmg * (1 - SKILLS['ember-curse'].vars['weaken'] / 100)));
      this.shots.push({ ...aimShot(m.x + m.face * m.def.w * .3, m.y - m.def.h * .55, tx, ty, shoot.speed, shoot.range, dmg, shoot.kind, (i - (n - 1) / 2) * .22), type: mobHits(m.def) });
    }
  }

  /** Creatures' shots and the Keeper's spears in flight. */
  private updateShots(dt: number): void {
    const p = this.host.player();
    const flies = (x: number, y: number) => { const c = Math.floor(x / TILE), r = Math.floor((y + 12) / TILE); return this.host.passable ? this.host.passable(c, r) : this.host.walkable(c, r); };
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      stepShot(s, dt);
      if (s.age > s.life || !flies(s.x, s.y)) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); continue; }
      if (shotHits(s, p.x, p.y - 12, s.kind === 'breath' ? 10 : 7)) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .3, dir: 1 }); this.biteKeeper(s.dmg, s.type ?? 'physical'); continue; }
      const k = this.minions.find(mn => shotHits(s, mn.x, mn.y - 10, 7));
      if (k) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); this.hurtMinion(k, s.dmg); }
    }
    const v = SKILLS['bone-spear'].vars;
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
      for (const m of [...this.mobs]) {
        if (s.hit.includes(m) || !shotHits(s, m.x, m.y - m.def.h / 2, Math.max(9, m.def.w / 3))) continue;
        s.hit.push(m);
        this.effects.push({ kind: 'bone-chips', x: s.x, y: s.y, age: 0, life: .35, dir: s.vx < 0 ? -1 : 1 });
        this.hitFoe(m, rnd(v['min'], v['max']), '#e9dcff');
      }
      if (s.age > s.life || !flies(s.x, s.y)) this.spears.splice(i, 1);
    }
  }

  /**
   * A pet's nip (td-pets.ts): a small blow on a creature, never on the Keeper. Not the Keeper's spell power or crits:
   * a pet's bite is its own size. `killed` when the creature fell to it.
   */
  petBite(foe: Mob, dmg: number, dir: number): { landed: boolean; killed: boolean } {
    if (foe.hp <= 0 || !this.mobs.includes(foe)) return { landed: false, killed: false };
    this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .18, dir });
    this.hurtMob(foe, Math.max(1, Math.round(dmg)), '#ffd98a');
    return { landed: true, killed: foe.hp <= 0 };
  }
  /** E2E only (td-engine's `?petfetch=1` under webdriver): a material lying at (x, y), as if a creature dropped it. */
  layDrop(id: string, x: number, y: number, material: string, qty: number, label: string): void {
    this.drops.push({ id, x, y, coins: 0, material, qty, label, color: RARITY_COLOR.common, age: 1 });
  }
  /** Let the raised go (the HUD's Release): they crumble where they stand. Returns how many went. */
  releaseMinions(): number {
    const n = this.minions.length;
    for (const k of this.minions) for (let j = 0; j < 3; j++) this.effects.push({ kind: 'dust', x: k.x + rnd(-5, 5), y: k.y, age: 0, life: .5, dir: 1 });
    this.minions.length = 0;
    return n;
  }
  /** The raised: keep near the Keeper, fight the nearest foe, crumble only when killed or released (no timer). */
  private updateMinions(dt: number): void {
    const p = this.host.player();
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const k = this.minions[i];
      k.t += dt; k.cd -= dt; k.hit = Math.max(0, k.hit - dt);
      if (k.hp <= 0) {
        this.minions.splice(i, 1);
        for (let j = 0; j < 3; j++) this.effects.push({ kind: 'dust', x: k.x + rnd(-5, 5), y: k.y, age: 0, life: .5, dir: 1 });
        continue;
      }
      // Left far behind (a wall between, a long run): it steps out of the ground at the Keeper's side again.
      if (Math.hypot(k.x - p.x, k.y - p.y) > MINION_LEASH * 1.6) { k.x = p.x + (k.id % 2 ? -14 : 14); k.y = p.y + 2; if (!this.free(k.x, k.y)) { k.x = p.x; k.y = p.y; } k.target = null; }
      const t = k.target;
      if (!t || t.hp <= 0 || !this.mobs.includes(t) || Math.hypot(t.x - p.x, t.y - p.y) > MINION_LEASH) k.target = pickMinionTarget(k, this.mobs, p, MINION_SIGHT, MINION_LEASH);
      const foe = k.target;
      const tx = foe ? foe.x : p.x + (k.id % 2 ? -16 : 16), ty = foe ? foe.y : p.y + 4, stop = foe ? MOB_REACH - 4 : 6;
      const dx = tx - k.x, dy = ty - k.y, len = Math.hypot(dx, dy);
      if (len > stop) {
        const step = Math.min(len - stop, MINION_SPEED * dt), vx = dx / len * step, vy = dy / len * step;
        if (this.free(k.x + vx, k.y)) k.x += vx;
        if (this.free(k.x, k.y + vy)) k.y += vy;
      }
      if (Math.abs(dx) > 2) k.face = dx < 0 ? -1 : 1;
      // Its blow only ever lands on a creature: the Keeper is never its foe.
      if (foe && Math.hypot(foe.x - k.x, foe.y - k.y) <= MOB_REACH && k.cd <= 0) {
        k.cd = RAISED_SKELETON.rate;
        this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .2, dir: k.face });
        this.hurtMob(foe, rnd(k.dmg[0], k.dmg[1]), '#c88bff');
      }
    }
  }

  /** Use a skill from the bar. Returns why not (for the host to say), or null when it went off. */
  useAbility(id: SkillId): 'cooldown' | 'nofoe' | 'mana' | null {
    const sk = SKILLS[id];
    if (!sk || sk.kind !== 'active') return null;
    if ((this.cooldowns[id] ?? 0) > 0) return 'cooldown';
    if (this.mana < sk.mana) return 'mana';
    const p = this.host.player();
    const foeInRange = (): Mob | null => {
      if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= this.range) return this.target;
      let best: Mob | null = null, bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= bd) { bd = d; best = m; } }
      return best;
    };
    const v = sk.vars;
    if (id === 'drain-life') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const dmg = rnd(v['min'], v['max']);
      this.effects.push({ kind: 'drain', x: foe.x, y: foe.y - foe.def.h / 2, tx: p.x, ty: p.y - 20, age: 0, life: .65, dir: 1 });
      this.hitFoe(foe, dmg, '#ff7a6a');
      const heal = Math.round(dmg * v['heal'] / 100);
      this.host.healPlayer(heal); this.float(p.x, p.y - 36, `+${heal}`, '#7fe08a');
      this.host.swung(foe);
    } else if (id === 'ember-curse') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      foe.cursed = v['secs']; foe.burnT = 1;
      this.effects.push({ kind: 'curse', x: foe.x, y: foe.y - foe.def.h - 4, age: 0, life: .6, dir: 1 });
      this.host.swung(foe);
    } else if (id === 'hellfire-nova') {
      for (const m of [...this.mobs]) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE) this.hitFoe(m, rnd(v['min'], v['max']), '#ff9a4a');
      // The ring runs out for half a second, the scorch fades over the next half (on the ground, at the feet).
      this.effects.push({ kind: 'wave', x: p.x, y: p.y, age: 0, life: 1, dir: 1 });
      this.host.swung(null);
    } else if (id === 'bone-spear') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const sx = p.x, sy = p.y - 16, a = Math.atan2(foe.y - foe.def.h / 2 - sy, foe.x - sx);
      this.effects.push({ kind: 'flash', x: sx, y: sy, age: 0, life: .15, dir: 1 });
      this.spears.push({ x: sx, y: sy, vx: Math.cos(a) * SPEAR_SPEED, vy: Math.sin(a) * SPEAR_SPEED, age: 0, life: v['range'] * TILE / SPEAR_SPEED, hit: [] });
      this.host.swung(foe);
    } else if (id === 'raise-skeleton') {
      // From the fresh dead nearest the Keeper first; with none, out of the ground at his side.
      const fresh = this.corpses
        .filter(cp => this.clock - cp.at <= CORPSE_SECS && Math.hypot(cp.x - p.x, cp.y - p.y) <= v['reach'] * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const st = raisedStats(this.keeperLevel, this.power, v);
      for (let i = 0; i < v['count']; i++) {
        const cp = fresh[i];
        let at = cp ? { x: cp.x, y: cp.y } : { x: p.x + (i % 2 ? -16 : 16), y: p.y + 2 };
        if (cp) this.corpses.splice(this.corpses.indexOf(cp), 1);
        else if (!this.free(at.x, at.y)) at = { x: p.x, y: p.y };
        this.minions.push({ id: this.minionSeq++, x: at.x, y: at.y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, cd: .6, t: 0, face: 1, life: Infinity, hit: 0, target: null });
        this.effects.push({ kind: 'raise', x: at.x, y: at.y, age: 0, life: .8, dir: 1 });
      }
      capMinions(this.minions, v['max']);
      this.host.swung(null);
    } else if (id === 'dark-ward') {
      this.ward = v['absorb']; this.wardT = v['secs'];
      this.effects.push({ kind: 'ward', x: p.x, y: p.y - 14, age: 0, life: .6, dir: 1 });
      this.host.swung(null);
    }
    this.mana -= sk.mana;
    this.cooldowns[id] = sk.cd / (1 + this.castSpeed);
    return null;
  }

  /** Wood chips flying off a struck tree (the host's chopping). */
  chips(x: number, y: number): void { this.effects.push({ kind: 'chips', x, y, age: 0, life: .45, dir: Math.random() < .5 ? -1 : 1 }); }

  private free(x: number, y: number, floats = false): boolean {
    const ok = floats && this.host.hover ? (c: number, r: number) => this.host.hover!(c, r) : (c: number, r: number) => this.host.walkable(c, r);
    for (const [ox, oy] of [[-4, -3], [4, -3], [-4, -1], [4, -1]]) if (!ok(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
    return true;
  }

  private float(x: number, y: number, text: string, color: string): void { this.floaters.push({ x, y, text, color, age: 0 }); }

  private kill(m: Mob): void {
    this.mobs.splice(this.mobs.indexOf(m), 1);
    // Soul Harvest (passive): every kill gives back mana.
    this.mana = Math.min(this.maxMana, this.mana + SKILLS['soul-harvest'].vars['mana']);
    if (this.target === m) this.target = null;
    this.deadUntil.set(m.key, this.clock + RESPAWN);
    // Fresh dead, for Raise Skeleton.
    this.corpses.push({ x: m.x, y: m.y, at: this.clock });
    if (this.corpses.length > 12) this.corpses.shift();
    const id = `td:${this.host.levelId()}:${m.key}:${Date.now().toString(36)}:${this.kills++}`;
    const areaId = this.host.levelId() === 'surface' ? 'ember-quarry' : 'ember-delve';
    this.host.options.onKill?.({ id, areaId, creature: m.def.id, name: m.def.name, hp: m.def.hp });
    // The ground loot: a coin pile with the creature's materials, and whatever gear the host rolls for the kill.
    const spot = (i: number) => ({ x: m.x + (i % 3 - 1) * 6, y: m.y + Math.floor(i / 3) * 5 });
    let n = 0;
    const coins = rnd(m.def.coins[0], m.def.coins[1]);
    for (const d of m.def.drops) {
      if (Math.random() >= d.chance) continue;
      this.drops.push({ id: `${id}:m${n}`, ...spot(n++), coins: 0, material: d.material, qty: d.qty, label: d.material.replace(/-/g, ' '), color: RARITY_COLOR.common, age: 0 });
    }
    // Now and then a potion (shared/potions): better ones from stronger creatures, a Rejuvenation rarely from the deep.
    const potion = rollPotionDrop(m.def.level, m.def.rank ?? 'normal', Math.random);
    if (potion) this.drops.push({ id: `${id}:p`, ...spot(n++), coins: 0, material: potion.id, qty: 1, label: potion.name, color: RARITY_COLOR.common, age: 0 });
    this.drops.push({ id: `${id}:c`, ...spot(n++), coins, qty: 0, label: `${coins} Gold`, color: '#ffd25a', age: 0 });
    let rows: readonly LootRow[] = [];
    try { rows = this.host.options.rollLoot?.({ creature: m.def.id, level: m.def.level, rank: m.def.rank ?? 'normal', killKey: id }) ?? []; } catch { rows = []; }
    rows.forEach((row, i) => {
      const color = RARITY_COLOR[row.rarity] ?? RARITY_COLOR.common;
      if (row.kind === 'item') this.drops.push({ id: `${id}:g${i}`, ...spot(n++), coins: 0, qty: 0, item: { definitionId: row.definitionId, rarity: row.rarity, unique: !!row.unique, level: row.level ?? m.def.level }, rarity: row.rarity, label: row.label, color, age: 0 });
      else this.drops.push({ id: `${id}:r${i}`, ...spot(n++), coins: 0, qty: 0, rune: row.rune, rarity: row.rarity, label: row.label, color, age: 0 });
    });
  }

  private pick(g: Drop, i: number): void {
    const ok = this.host.options.onLoot?.({
      id: g.id, coins: g.coins, ore: g.material ? g.qty : 0, ...(g.material ? { material: g.material } : {}),
      ...(g.item ? { item: g.item } : {}), ...(g.rune ? { rune: g.rune } : {}),
    });
    if (ok === false) return;   // the satchel is full: it stays on the ground
    this.drops.splice(i, 1);
    this.float(g.x, g.y - 10, g.label, g.color);
  }
}

/**
 * The bestiary's brushes and outline, for the companions' own sprites (td-pet-art.ts): the pets are painted to the
 * same standard as the creatures, with the same light and the same selective outline.
 */
export const TD_BRUSH = { px, dot, orb, poly, limb, line, glow, outline } as const;
export type TdRamp = Ramp;
