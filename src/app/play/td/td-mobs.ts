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
import { DIFFICULTIES, type DifficultyDef } from '../../shared/loot/difficulty.model';
import type { EngineOptions, LootRow } from '../engine/engine.model';
import type { LootRarity } from '../world/world.model';
import { TILE } from './td-art';
import { volumizeData } from '../../shared/keeper-look/keeper-volume';
import { rollPotionDrop } from '../../shared/potions/potions.model';
import { BLANK_ID, BLANK_NAME, rollBlankDrop } from '../../shared/spellstones/spellstones.model';
import { rollHuntGold } from '../../shared/economy/economy-curve';
import { LOOT } from './td-fx';
import { CRIT_MULT, FIRE_SKILLS, MANA_REGEN, MAX_MANA, MAX_RANK, SKILLS, castCd, castRank, castVars, incomingDamage, manaCost, type SkillId } from './td-skills';
import { markFlag, markRiders, type MarkFlag, type MarkFx, type MarkStatus } from './td-marks';
import { NO_RELICS, type RelicTotals } from '../../shared/rpg/boss-uniques';
import { AURA_PULSE, auraEffect, type AuraEffect, type AuraId } from '../../shared/loot/auras';
import { creatureProfile } from '../../shared/loot/creature-families';
import { DAMAGE_COLORS, type DamageType, type Element } from '../../shared/loot/damage.model';
import { creatureHits, isKnownCreature } from '../../shared/loot/creature-families';
import { AFFIX_DEFS, TD_RANK_HP, BRUTAL, EMBER_HEART, GRAVE_CALL, KIN_SHIELD, LIGHTLESS_R, MIRROR_SHARE, MULTISHOT, VAMPIRIC, WHISPER_HUSH, auraAffix, COLD_AURA_R, COLD_SLOW, CURSE_HURT, CURSE_RESIST, CURSE_SECONDS, FIRE_BURST, MANA_BURN, SPECTRAL, TELEPORT, eliteEligible, eliteStats, floorEliteRows, guaranteeMagic, lootRank, rollElite, touchPack, type ElitePack, type EliteTag } from './td-elites';
import { extraSpawn, hardened, nightType, rollTouched, rulesOf, skyVars, spellMult, touchedRandom } from './td-phases';
import type { SkyPhase } from '../../shared/world-clock/world-clock.model';
import type { Vocation } from '../../shared/keeper-look/keeper-look.model';
import { ASHGUARD_SKILLS } from './td-ashguard-skills';
import { LANTERN_SKILLS } from './td-lantern-skills';
import { BANISH_BOSS, carriedLight, healOverTime, inDisc, lastLightClamp, lightBlow, shadowBorn, stepHeal, unmakes, type HealOverTime } from './td-lantern';
import { NO_WEAPON_BONUS, arrowBlow, brandedBlow, ccSecs, guardedDefense, inArc, meleeBlow, strideEnd, vowClamp, type WeaponSwing } from './td-melee';
import { THORN_SKILLS } from './td-thorn-skills';
import { livedHp, lifeScale } from './td-life';
import { SEAM_ID, seamStats } from './td-seam';
import { atZoneLevel, callLevel, gapDealt, gapHurt, gapMiss, gapPace, levelGap, zoneXp } from './td-zones';
import { CORPSE_REACH, corpseSeed, layCorpse, weatherCorpses, type Corpse } from './td-corpse';
import { WET } from '../../shared/weather/weather.model';
import { BEAST_DAMAGE_SHARE, PIERCE_KEEP, PIERCE_MAX, THORN_PET, addBleed, bondShare, fanAngles, knockFor, pierces, stampedeLanes, thornPetBlow } from './td-thorn';
import { KEEPER_ELBOW, TdSight, fanSpot, formationSpot, separate, type Body } from './td-sight';
import { ROAM, Stand, newRoam, stepRoam, type RoamState } from './td-roam';
import { BLEED_MOVING, abilitiesOf, FL_AB0, FL_AB1, FL_AURA_OFF, FL_HIDDEN, FL_WARDED, KEEPER_CC_IMMUNE, KEEPER_ROOT_MAX, KEEP_WALKING, SPORE_WEAKEN, T as ATILE, TRUE_LIGHT_CUT, castable, decodeStatus, encodeStatus, tierCd, type AbilityDef, type KeeperStatus, type StatusLay, type TellTone } from './td-abilities';
import { PACK_AURA_REACH, PACK_PULSE, PACK_PULSE_TYPE, PACK_STRIP_SECS, fixedAura, halvedBy, landOf, packAuraFx, packAuraLevel, packAuraPool, type PackAuraFx, type PackAuraId } from './td-pack-aura';

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
  /** The Seam-Cant a boss speaks as it winds up (design-bible §4.0): a readable tell in words beside the ground cone. */
  chant?: string;
  /**
   * A tank: its fight life is `tough` × its authored `hp` (on top of td-life lifeScale), while its Hunting XP stays on the
   * authored `hp` — which follows leveling.md's rule (30 + 12.5 × level). The Umbral Marches' heavy creatures (2026-10-21).
   */
  tough?: number;
  /** It drifts over lava and embers as if they were floor (a wraith). */
  floats?: boolean;
  /** Half there: drawn see-through, flickering. */
  ghost?: boolean;
  /** Once, when its life falls to `at` of its whole, it calls `count` of `type` to its side (Eclipse-touched, if `touched`). */
  summon?: { type: string; count: number; at: number; touched?: boolean };
  /**
   * A ground attack (the Seam Eater's Rend, td-seam.ts): every `rate` s while it hunts, `rings` circles of `r` art px
   * open on the ground (one under its prey, the rest `spread` px round it); after `tell` s each bursts for `dmg`. It
   * speaks its own `chant` as the rings open.
   */
  rend?: { rate: number; rings: number; r: number; spread: number; tell: number; dmg: [number, number]; chant: string };
  /** At half its life (with its call) the fight quickens: the breath's fan and cadence, the rend's rings and cadence. */
  half?: { spread: number; rate: number; rings: number; rendRate: number; chant: string };
  /**
   * A gap-closer (owner 2026-10-21: "a ranged Keeper who walks backwards forever should get caught"): when its prey
   * stands `min` art px off or more, every `rate` s it winds up (BOSS_TELL, a lane on the ground toward where the prey
   * will be at his pace — CHARGE_LEAD), then crosses to that spot at `speed` px/s and strikes it for `dmg` — a step aside in the tell and it lands
   * on nothing. `kind` is how it looks: a charge (it runs), a leap (it jumps), a slam (it throws itself down). A boss
   * with words speaks its own `chant` as it winds up.
   */
  charge?: { min: number; rate: number; dmg: [number, number]; speed: number; kind: 'charge' | 'leap' | 'slam'; chant?: string };
  /** A world boss: it never sets foot on a town's safe ground nor strikes into it, and past `leash` tiles from where it rose it goes back. */
  bound?: { leash: number };
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
  // Composes with the frame it is drawn in (the sheet's own MOB_K growth round a boss's).
  OX = OX + ox * K; OY = OY + oy * K; K = K * k;
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
  // The ribcage: dark gaps between the ribs, each rib catching the light at its left end, the sternum down the middle.
  for (let i = 0; i < 3; i++) { px(c, o + 7, 17 + b + i * 2, 7, 1, r[3]); dot(c, o + 7, 16 + b + i * 2, r[0]); dot(c, o + 13, 16 + b + i * 2, r[2]); }
  px(c, o + 10, 16 + b, 1, 6, r[1]); dot(c, o + 10, 16 + b, r[0]);
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
  // Cheekbones under the sockets, a lit brow over them.
  dot(c, o + 7, 11 + b, r[2]); dot(c, o + 15, 11 + b, r[3]); px(c, o + 8, 6 + b, 3, 1, r[0]);
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
  garrisonSword(c, b, R.iron, EMBER[2]);
  boneArm(c, f, 0, 17, 23, R.bone);
  roundShield(c, b, R.wood, R.iron);
}
/**
 * A garrison sword held upright (the art style upgrade, 2026-10-26): a two-pixel blade lit down its left edge, a point,
 * a crossguard, a leather grip and a pommel; `fleck` a pixel of the slag still glowing in the steel.
 */
function garrisonSword(c: CanvasRenderingContext2D, b: number, steel: Ramp, fleck?: string): void {
  limb(c, [18, 20 + b], [18, 6 + b], 2, steel);
  line(c, [18, 6 + b], [18, 19 + b], steel[0]);
  dot(c, 18, 4 + b, steel[1]); dot(c, 18, 5 + b, steel[0]);
  if (fleck) line(c, [19, 12 + b], [19, 15 + b], fleck);
  px(c, 15, 21 + b, 7, 1, steel[1]); dot(c, 15, 21 + b, steel[0]); dot(c, 21, 21 + b, steel[2]);
  px(c, 17, 22 + b, 2, 2, R.leather[1]); dot(c, 17, 22 + b, R.leather[0]);
  dot(c, 18, 24 + b, steel[0]);
}
/** A round wooden shield on the far arm: planks, an iron rim, a boss in the middle catching the light. */
function roundShield(c: CanvasRenderingContext2D, b: number, wood: Ramp, iron: Ramp, mark?: string): void {
  orb(c, 4.5, 22 + b, 4.6, 5, iron);
  orb(c, 4.5, 22 + b, 3.6, 4, wood);
  line(c, [3, 18.5 + b], [3, 25.5 + b], wood[3]); line(c, [6, 18.5 + b], [6, 25.5 + b], wood[3]);
  if (mark) { line(c, [4.5, 19 + b], [4.5, 25 + b], mark); line(c, [2, 22 + b], [7, 22 + b], mark); }
  orb(c, 4.5, 22 + b, 1.4, 1.4, iron); dot(c, 4, 21 + b, iron[0]);
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
/** The lamp-cold glow the Uncounted carries (the Hushed Barrow's own light: a sexton's lantern, burning wrong). */
const GRAVELIGHT: Ramp = ['#f4fff8', '#b8e8d8', '#6aa898', '#3a6a60'];
/**
 * The Uncounted (the Hushed Barrow's vault; shared/sexton, the Sexton's Count): the forty-first of forty graves. A tall
 * skeleton in a sexton's grey hood, a tally mark cut on its brow, a lantern held low that gives no warmth.
 */
function paintUncounted(c: CanvasRenderingContext2D, f: number): void {
  grown(1.35, 2, 9, () => {
    const b = BOB[f];
    skeleton(c, f, 1, { bone: R.bone, eye: GRAVELIGHT });
    // The hood, down over the shoulders and the back.
    poly(c, [[3, 14 + b], [7, 13 + b], [8, 24 + b], [4, 23 + b]], R.hood);
    poly(c, [[4, 10 + b], [6, 3 + b], [10, 1 + b], [15, 1 + b], [18, 4 + b], [18, 8 + b], [15, 6 + b], [9, 6 + b], [7, 14 + b], [4, 16 + b]], R.hood);
    // One tally mark on the brow, scratched into the bone.
    line(c, [12, 4 + b], [13, 7 + b], R.void[0]);
    // The lantern, held low on its ring, swinging a little as it walks.
    const sw = [0, 1, 0, -1][f];
    line(c, [21, 19 + b], [21 + sw, 23 + b], R.iron[1]);
    px(c, 19 + sw, 23 + b, 5, 6, R.iron[2]); px(c, 20 + sw, 24 + b, 3, 4, GRAVELIGHT[1]);
    glow(c, 21 + sw, 26 + b, 1, GRAVELIGHT);
    boneArm(c, f, 1, 21, 19, R.bone);
  });
}
/** A skeleton the Warlock raised: the same bones blanched violet, his colour burning in the eyes, a rune-shield and a blade. */
function paintRaised(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f];
  skeleton(c, f, 0, { bone: R.vbone, eye: VIOLET });
  garrisonSword(c, b, R.membrane, VIOLET[1]);
  boneArm(c, f, 0, 17, 23, R.vbone);
  // His rune-shield: the round shield in the dusk wood, a violet rune cut across it, glowing on the beat.
  roundShield(c, b, R.membrane, R.vbone, f % 2 ? VIOLET[0] : VIOLET[1]);
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

// ── The Umbral Marches (maps/umbral-marches.ts, maps/drowned-crypts.ts) ──────────────────────────────────────────────

/** The Marches' own tones: bog mud, reed, ink, drowned iron gone green, kelp, a witch's gloam wool, drowned skin, wisp-light. */
const U = {
  mud: ['#8e845a', '#625a3a', '#423c28', '#2a261a'],
  mudDk: ['#625a3a', '#443e28', '#2e2a1c', '#1c1a12'],
  reed: ['#b4c070', '#76844a', '#4e5a30', '#30381e'],
  ink: ['#6e5e94', '#3c305c', '#261e3e', '#140e26'],
  inkDk: ['#463a66', '#2a2244', '#1a142e', '#0c0818'],
  verdigris: ['#9ccab0', '#5e927a', '#3e6654', '#264034'],
  kelp: ['#7a9450', '#506a34', '#344a22', '#1e2e14'],
  gloam: ['#a092ba', '#6e608a', '#4a3e62', '#2e2640'],
  gloamDk: ['#6e608a', '#4a3e62', '#322a44', '#201a2c'],
  skin: ['#d4d4bc', '#a2a48c', '#747662', '#4c4e40'],
  wisp: ['#fffbe0', '#ffe68a', '#e0b050', '#8a6a2a'],
} satisfies Record<string, Ramp>;
/** Lantern-gold, the light the Marches keep; and ink-violet, the dark that answers it (the Marches' element). */
const LANTERN: Ramp = ['#fff6d0', '#ffc65a', '#d98a2a', '#7a4a1a'];
const INKGLOW: Ramp = ['#f0e8ff', '#b49cff', '#6e54c8', '#3a2a78'];

/** The Mire Lurker: a squat bog-toad the size of a boat, reeds growing out of its back, a lantern-lure on a stalk. */
function paintMireLurker(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], sway = [0, 1, 0, -1][f];
  legs4(c, f, 8, 23, 18 + b, 26, 2, U.mudDk, U.mud, R.bone[2]);
  // The body: wide, flat, warty, a paler belly.
  orb(c, 16, 16 + b, 11.5, 6.5, U.mud);
  px(c, 8, 21 + b, 16, 1, U.mud[2]);
  orb(c, 16, 19.5 + b, 7, 2, [U.skin[1], U.skin[2], U.skin[3], U.skin[3]]);
  for (const [x, y] of [[9, 14], [13, 12], [18, 13], [11, 17], [21, 16], [15, 15]] as const) { dot(c, x, y + b, U.mud[0]); dot(c, x + 1, y + b + 1, U.mud[3]); }
  // Reeds out of its back, a cattail or two, a drip of black water.
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 3.4, top = 4 + (i % 2) * 2 + b, lean = (i - 1.5) * .8 + sway * .5;
    limb(c, [x, 12 + b], [x + lean, top], 1, U.reed);
    if (i % 2 === 0) px(c, x + lean - .5, top - 2, 2, 3, R.bark[2]);
  }
  dot(c, 6, 19 + b, U.ink[1]);
  // The head: a wide frog's skull, a long lipless mouth, small yellow eyes on top.
  orb(c, 27, 15.5 + b, 6.5, 5, U.mud);
  line(c, [22, 18 + b], [33, 17 + b], U.mudDk[3]); line(c, [23, 19 + b], [32, 18 + b], U.mud[2]);
  for (const x of [25, 28, 31]) dot(c, x, 18 + b, R.bone[0]);
  orb(c, 25.5, 11 + b, 2.6, 2.2, U.mud); orb(c, 30, 11.5 + b, 2.2, 1.8, U.mudDk);
  px(c, 25, 10 + b, 2, 1, LANTERN[1]); dot(c, 26, 10 + b, OUT); dot(c, 30, 11 + b, LANTERN[2]);
  // The lure: a stalk off its brow, arching forward, and on it a little lantern of its own light.
  limb(c, [28, 10 + b], [31, 4 + b], 1, U.mudDk); limb(c, [31, 4 + b], [34, 5 + b + sway], 1, U.mudDk);
  glow(c, 33, 6 + b + sway, 2, LANTERN);
}

/** The Lantern Wisp: a lost lantern's flame that kept going without it — a tongue of gold, a ring of its old cage, a trail of smoke. */
function paintLanternWisp(c: CanvasRenderingContext2D, f: number): void {
  const b = [0, -1, -2, -1][f], sway = [0, 1, 0, -1][f];
  // The trail: three thin wisps of warm smoke, wavering, thinning out below it.
  for (const [x, dx, len] of [[8, -1, 9], [11, 0, 12], [14, 1, 8]] as const) {
    for (let i = 0; i < len; i++) {
      const wx = x + Math.round(Math.sin((i + f * 2 + x) / 2.4) * 1.2) + Math.round(dx * i / 4);
      dot(c, wx, 18 + b + i, i < len / 2 ? U.wisp[2] : U.wisp[3]);
    }
  }
  // The flame: a teardrop pointing up, its tip flickering; a hotter heart inside it.
  poly(c, [[11 + sway, 0 + b + 1], [14, 4 + b], [17, 10 + b], [16, 15 + b], [11, 19 + b], [6, 15 + b], [5, 10 + b], [8, 4 + b]], U.wisp);
  poly(c, [[11, 5 + b], [14, 10 + b], [13, 15 + b], [9, 15 + b], [8, 10 + b]], [LANTERN[0], LANTERN[0], U.wisp[1], U.wisp[1]]);
  glow(c, 10, 9 + b, 2, LANTERN);
  // Tongues licking off its sides.
  dot(c, 4, 9 + b - sway, U.wisp[1]); dot(c, 18, 8 + b + sway, U.wisp[1]); dot(c, 3, 7 + b - sway, U.wisp[2]);
  // What is left of its cage: the iron ring it hung from, one bent bar.
  px(c, 9, 18 + b, 5, 1, '#2a2026'); line(c, [6, 15 + b], [5, 9 + b], '#3a2c30');
  // Two dark eyes, wide and curious.
  px(c, 9, 11 + b, 1, 2, OUT); px(c, 13, 11 + b, 1, 2, OUT);
}

/** The Ink Hound: a hound poured out of the Ink Deeps, dripping as it runs, violet eyes, a tail of smoke. */
function paintInkHound(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], wag = [0, 1, 0, -1][f];
  // The tail: smoke, coming apart.
  for (let i = 0; i < 4; i++) orb(c, 6 - i * 1.6, 11 + b - i * 1.2 + wag * (i / 3), 2 - i * .35, 1.8 - i * .3, U.inkDk);
  legs4(c, f, 8, 21, 15 + b, 23, 2, U.inkDk, U.ink, INKGLOW[2]);
  orb(c, 14, 13 + b, 9, 5.2, U.ink);
  orb(c, 21, 12 + b, 5.5, 5.4, U.ink);
  // The ink running off it: drips under the belly and a sheen along the spine.
  for (const [x, l] of [[9, 2], [13, 3], [17, 2]] as const) { px(c, x, 17 + b, 1, l + (f % 2), U.ink[1]); dot(c, x, 18 + b + l + (f % 2), INKGLOW[2]); }
  line(c, [8, 9 + b], [20, 8 + b], U.ink[0]);
  for (let i = 0; i < 4; i++) dot(c, 9 + i * 3, 8 + b + (i % 2), INKGLOW[2]);
  // Head: long, low, ears flat back, a violet mouth.
  poly(c, [[23, 6 + b], [24, 1 + b], [26, 5 + b]], U.inkDk);
  orb(c, 26.5, 9 + b, 5, 4.2, U.ink);
  poly(c, [[27, 8 + b], [32, 10 + b], [32, 12 + b], [27, 12 + b]], U.ink);
  poly(c, [[26, 13 + b], [31, 13 + b], [30, 15 + b + (f % 2)], [26, 15 + b]], U.inkDk);
  px(c, 27, 12 + b, 4, 1 + (f % 2), INKGLOW[1]); dot(c, 29, 13 + b, R.bone[0]);
  glow(c, 28, 8 + b, 1, INKGLOW);
}

/** The Drowned Knight: one of Gloamhaven's old guard, still in the armour the mire took, kelp for a plume, a rusted greatsword. */
function paintDrownedKnight(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f] / 2, iron: Ramp = U.verdigris, far: Ramp = [iron[1], iron[2], iron[3], iron[3]];
  // Legs in greaves, the far one darker.
  limb(c, [11, 27 + b], [11 - s, 37 - liftB(f) / 2], 3, far); px(c, 9 - s, 37 - liftB(f) / 2, 5, 2, iron[3]);
  limb(c, [16, 27 + b], [16 + s, 37 - liftA(f) / 2], 3, iron); px(c, 15 + s, 37 - liftA(f) / 2, 5, 2, iron[2]); px(c, 15 + s, 37 - liftA(f) / 2, 5, 1, iron[1]);
  // The far arm.
  limb(c, [8, 16 + b], [6, 25 + b], 3, far); orb(c, 6, 26 + b, 2, 1.8, far);
  // The breastplate, barnacled; a drowned tabard over it, torn; kelp caught everywhere.
  poly(c, [[7, 14 + b], [21, 14 + b], [20, 27 + b], [8, 27 + b]], iron);
  line(c, [14, 15 + b], [14, 26 + b], iron[2]);
  poly(c, [[10, 19 + b], [18, 19 + b], [18, 31 + b], [16, 29 + b], [14, 32 + b], [12, 29 + b], [10, 31 + b]], U.gloamDk);
  dot(c, 14, 23 + b, LANTERN[2]); dot(c, 13, 22 + b, LANTERN[1]);
  for (const [x, y] of [[8, 15], [20, 17], [9, 25], [19, 24], [11, 16]] as const) dot(c, x, y + b, R.bone[1]);
  for (const [x, y, l] of [[9, 16, 6], [19, 15, 8], [16, 27, 5]] as const) { line(c, [x, y + b], [x + 1, y + l + b], U.kelp[1]); dot(c, x + 1, y + l + 1 + b, U.kelp[0]); }
  // The pauldrons.
  orb(c, 7.5, 15 + b, 3.4, 2.6, iron); orb(c, 20.5, 15 + b, 3.4, 2.6, iron);
  // The great helm: a slit, and in it the ink-light where a face was; a plume of kelp hanging back.
  poly(c, [[9, 4 + b], [19, 4 + b], [20, 13 + b], [8, 13 + b]], iron);
  px(c, 9, 4 + b, 11, 1, iron[0]);
  px(c, 10, 8 + b, 9, 2, OUT); glow(c, 12, 8 + b, 1, INKGLOW); glow(c, 16, 8 + b, 1, INKGLOW);
  line(c, [14, 10 + b], [14, 12 + b], iron[2]);
  limb(c, [12, 3 + b], [7, 5 + b], 2, U.kelp); limb(c, [7, 5 + b], [5, 10 + b + (f % 2)], 1, U.kelp);
  // The greatsword, held up: a rusted blade, a cross-guard, water running off its point.
  limb(c, [24, 23 + b], [25, 1 + b], 2, R.steel); line(c, [25, 3 + b], [25, 21 + b], R.steel[0]);
  for (const y of [6, 11, 17]) dot(c, 24, y + b, R.rust[2]);
  px(c, 21, 22 + b, 8, 2, R.iron[2]); px(c, 21, 22 + b, 8, 1, R.iron[0]);
  limb(c, [24, 25 + b], [24, 28 + b], 2, R.leather);
  // The near arm, its gauntlet on the grip.
  limb(c, [20, 16 + b], [23, 23 + b], 3, iron); orb(c, 24, 24 + b, 2.2, 2, iron);
}

/** The Gloam Witch: a fen-crone under a hat like a drowned bell, a lantern on her staff burning ink instead of oil. */
function paintGloamWitch(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], sw = [0, 1, 0, -1][f];
  // The robe: a bell of gloam wool, its hem in tatters that drag in the mud.
  poly(c, [[6, 15 + b], [17, 15 + b], [21, 35], [2, 35]], U.gloam);
  line(c, [8, 17 + b], [5, 33], U.gloam[2]); line(c, [13, 17 + b], [14, 33], U.gloam[2]);
  for (let i = 0; i < 6; i++) { const x = 3 + i * 3; px(c, x, 35, 2, 1 + ((i + f) % 2), U.gloamDk[2]); }
  px(c, 2, 36, 19, 1, U.mudDk[2]);
  // A shawl of hanging moss, charms on it.
  poly(c, [[5, 14 + b], [18, 14 + b], [16, 21 + b], [7, 21 + b]], [U.kelp[0], U.kelp[1], U.kelp[2], U.kelp[3]]);
  for (const x of [7, 10, 13, 16]) line(c, [x, 20 + b], [x, 22 + b + ((x + f) % 2)], U.kelp[2]);
  dot(c, 9, 18 + b, R.bone[0]); dot(c, 14, 19 + b, INKGLOW[1]);
  // The far hand, crooked, beckoning.
  limb(c, [6, 17 + b], [3, 22 + b - sw], 2, U.gloamDk); limb(c, [3, 22 + b - sw], [1, 20 + b - sw], 1, U.skin);
  // The face: pale, long-nosed, two ink-lit eyes under the brim.
  orb(c, 12, 11 + b, 4.2, 3.8, U.skin);
  poly(c, [[15, 11 + b], [18, 13 + b], [15, 13 + b]], U.skin);
  dot(c, 11, 10 + b, INKGLOW[1]); dot(c, 14, 10 + b, INKGLOW[1]); dot(c, 11, 11 + b, INKGLOW[3]);
  line(c, [10, 14 + b], [14, 14 + b], U.skin[3]);
  // The hat: a wide drooping brim, a crooked crown, a moth on its band.
  poly(c, [[3, 8 + b], [21, 8 + b], [21, 10 + b], [3, 10 + b]], U.gloamDk); px(c, 2, 9 + b, 2, 1, U.gloamDk[2]); px(c, 20, 9 + b, 2, 1, U.gloamDk[2]);
  poly(c, [[6, 8 + b], [16, 8 + b], [13, 3 + b], [10, 0 + b + 1], [9, 4 + b]], U.gloamDk);
  px(c, 7, 7 + b, 9, 1, LANTERN[2]); dot(c, 12, 6 + b, U.wisp[0]);
  // The staff, and its lantern burning ink.
  limb(c, [21, 9 + b], [21, 36], 2, R.wood);
  limb(c, [21, 9 + b], [23, 7 + b], 1, R.wood);
  px(c, 22, 8 + b, 4, 1, '#2a2026'); px(c, 22, 9 + b, 4, 5, '#2a2026');
  glow(c, 23, 10 + b, 2, INKGLOW);
  // The near hand on the staff.
  limb(c, [16, 17 + b], [20, 21 + b], 2, U.gloam); orb(c, 21, 21 + b, 1.6, 1.6, U.skin);
}

/** The Ink Abbess, who keeps the Drowned Crypts: the abbey's last abbess, drowned at her prayers, her robes running ink. */
function abbess(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], sw = [0, 2, 0, -2][f];
  // No feet: ink pooling under her, running off in tongues.
  orb(c, 17, 37, 14, 1.8, U.inkDk);
  for (let i = 0; i < 6; i++) { const x = 6 + i * 4.4, len = 1 + ((i + f) % 3); limb(c, [x, 34], [x + ((i + f) % 2 ? 1 : -1), 34 + len], 2, U.inkDk); dot(c, x, 35 + len, INKGLOW[2]); }
  // The robe: narrow at the shoulders, flaring to the floor, deep ink; violet trim down its front, a drowned bell at her girdle.
  poly(c, [[12, 13 + b], [22, 13 + b], [25, 20 + b], [30, 35], [4, 35], [9, 20 + b]], U.ink);
  line(c, [15, 16 + b], [12, 34], INKGLOW[2]); line(c, [19, 16 + b], [22, 34], INKGLOW[2]);
  line(c, [10, 24 + b], [7, 34], U.ink[2]); line(c, [24, 24 + b], [27, 34], U.ink[2]);
  px(c, 4, 34, 27, 1, INKGLOW[3]);
  px(c, 11, 21 + b, 12, 1, LANTERN[2]);
  orb(c, 17, 24 + b, 1.8, 2, R.gold); dot(c, 17, 26 + b, OUT);
  // Ink running from her sleeves.
  dot(c, 6, 18 + b, U.ink[1]); dot(c, 6, 20 + b, INKGLOW[2]);
  // The far arm raised in prayer, a rosary of drowned pearls hanging from it.
  limb(c, [12, 15 + b], [6, 10 + b - sw / 2], 3, U.inkDk); orb(c, 5.5, 9 + b - sw / 2, 1.8, 1.8, U.skin);
  for (let i = 0; i < 5; i++) dot(c, 5 + (i % 2), 11 + b - sw / 2 + i * 2, R.bone[0]);
  // The veil: a tall grey hood falling to her shoulders; inside it, the dark and two ink-lights.
  poly(c, [[10, 17 + b], [12, 6 + b], [17, 2 + b], [22, 6 + b], [24, 17 + b]], U.skin);
  line(c, [17, 3 + b], [17, 5 + b], U.skin[0]);
  orb(c, 17, 10 + b, 3.6, 3.8, R.void);
  glow(c, 15, 9 + b, 1, INKGLOW); glow(c, 18, 9 + b, 1, INKGLOW);
  line(c, [11, 16 + b], [23, 16 + b], U.skin[2]);
  // A circlet of three candles, the abbey's last lights, burning gold over the veil.
  px(c, 13, 4 + b, 9, 1, R.gold[2]);
  for (const x of [13, 17, 21]) { px(c, x, 1 + b, 1, 3, '#e8e1cf'); dot(c, x, b, LANTERN[1]); }
  // The near arm, swinging the great black censer-lantern on its chain.
  limb(c, [22, 15 + b], [27, 21 + b], 3, U.ink);
  line(c, [28, 21 + b], [29 + sw, 25 + b], '#2a2026');
  px(c, 26 + sw, 25 + b, 7, 2, '#2a2026'); px(c, 26 + sw, 27 + b, 7, 6, '#1c1418'); px(c, 27 + sw, 28 + b, 5, 4, INKGLOW[2]);
  glow(c, 28 + sw, 29 + b, 2, INKGLOW); dot(c, 29 + sw, 34 + b, INKGLOW[1]);
}
/** The Ink Abbess as she is fought: her figure grown huge. */
function paintInkAbbess(c: CanvasRenderingContext2D, f: number): void { grown(1.7, 2, 3, () => abbess(c, f)); }

// ── The Seam Eater's second rising (td-seam.ts): a tear in the world under an eclipse ─────────────────────────────────
/** Its tones: the corona's pale light, the void, the throat's violet glow, the bone thread its edges are stitched with. */
const SEAM_TONES = {
  corona: ['#ffffff', '#f0e0ff', '#c8a8ff', '#8a6ac8'] as Ramp,
  void: ['#2a1c3a', '#140c1c', '#0c0612', '#060308'] as Ramp,
  throat: ['#f0e0ff', '#b06bff', '#6b3aa0', '#2a1440'] as Ramp,
  thread: R.bone as Ramp,
};
/**
 * A dark sun with its corona burning round it, torn top to bottom by a maw: the lips of the tear stitched shut with bone
 * thread that has given way, teeth along both lips, a violet throat; void drips to the ground under it. Drawn on a
 * 56×50 grid, grown ×2 (twice a deep boss's size). Frames: the maw breathes open and the corona's rays turn.
 */
function seamEater(c: CanvasRenderingContext2D, f: number): void {
  const T = SEAM_TONES, open = [0, 1, 2, 1][f], turn = f * Math.PI / 12, cx = 28, cy = 24;
  // The tear's shadow pooled on the ground, and the void running down into it.
  orb(c, cx, 47, 20, 2.4, T.void);
  for (let i = 0; i < 6; i++) { const x = 16 + i * 4.8, sway = ((i + f) % 3) - 1; limb(c, [x, 36], [x + sway, 46 - (i % 2)], i % 2 ? 2 : 3, T.void); }
  // The corona: rays turning frame by frame, then the pale ring, the violet rim, the dark disc.
  for (let i = 0; i < 12; i++) {
    const a = turn + i * Math.PI / 6, l = i % 2 ? 3 : 5;
    limb(c, [cx + Math.cos(a) * 17, cy + Math.sin(a) * 17], [cx + Math.cos(a) * (18 + l), cy + Math.sin(a) * (18 + l)], i % 2 ? 1 : 2, i % 3 ? T.corona : VIOLET);
  }
  orb(c, cx, cy, 19, 19, T.corona);
  orb(c, cx, cy, 17, 17, VIOLET);
  orb(c, cx, cy, 15.5, 15.5, T.void);
  // Eyes in the dark either side of the tear, blinking in turn.
  for (const [ex, ey, k] of [[18, 15, 0], [38, 17, 1], [17, 31, 2], [39, 30, 3]] as const) if ((f + k) % 4 !== 3) glow(c, ex, ey, 1, T.throat);
  // The tear: a lens from above the disc to the ground, its lips a little further apart each frame.
  const w = 5 + open, hw = (y: number) => w * Math.pow(Math.max(0, Math.sin(Math.PI * (y - 1) / 45)), .7);
  poly(c, [[cx, 1], [cx + w * .6, 9], [cx + w, 23], [cx + w * .6, 37], [cx, 46], [cx - w * .6, 37], [cx - w, 23], [cx - w * .6, 9]], T.throat);
  poly(c, [[cx, 6], [cx + w * .4, 14], [cx + w * .55, 23], [cx + w * .4, 32], [cx, 41], [cx - w * .4, 32], [cx - w * .55, 23], [cx - w * .4, 14]], T.void);
  glow(c, cx - 1, 22, 2, T.throat);
  // Teeth along both lips, pointing in.
  for (let y = 9; y <= 37; y += 4) {
    const h = Math.round(hw(y));
    px(c, cx - h, y, 2, 1, T.thread[1]); dot(c, cx - h + 2, y, T.thread[0]);
    px(c, cx + h - 1, y + 2, 2, 1, T.thread[1]); dot(c, cx + h - 2, y + 2, T.thread[0]);
  }
  // The stitches: bone thread crossing each lip, the ones that held and the ones the maw has torn.
  for (let y = 7; y <= 40; y += 5) {
    const h = Math.round(hw(y)), torn = (y + f) % 3 === 0;
    line(c, [cx - h - 3, y - 1], [cx - h + 1, y + 1], T.thread[torn ? 2 : 1]);
    line(c, [cx + h + 3, y - 1], [cx + h - 1, y + 1], T.thread[torn ? 2 : 1]);
    if (!torn) { dot(c, cx - h - 3, y - 1, T.thread[0]); dot(c, cx + h + 3, y - 1, T.thread[0]); }
  }
}
function paintSeamEater(c: CanvasRenderingContext2D, f: number): void { grown(2, 0, 0, () => seamEater(c, f)); }
// ── The Verdant Wilds' deeper places (maps/root-hollows.ts, maps/overgrown-temple.ts −4…−5) ───────────────────────────

/** Their own tones: dark bark, a grub's pale hide and its chitin, a mushroom's cap and stem, a drowned priest's robe and water. */
const RV = {
  barkDk: ['#7a5a3e', '#523c2a', '#38281c', '#221812'],
  grub: ['#f6eed6', '#d8c8a2', '#aa946c', '#705e42'],
  chitin: ['#9c7c5a', '#6a4e36', '#4a3424', '#2e2016'],
  cap: ['#e29aa8', '#a85068', '#723048', '#46192c'],
  stem: ['#f2e8ce', '#cfc09a', '#9c8c6a', '#685c44'],
  gill: ['#5a3a4e', '#3e2636', '#2a1a26', '#180e16'],
  robe: ['#6e8c6a', '#4a6648', '#334833', '#1e2c20'],
  drown: ['#9ac4c8', '#5e8a90', '#3e6066', '#243a40'],
  iron: ['#a8a2b0', '#6c6678', '#4a4654', '#2e2a36'],
} satisfies Record<string, Ramp>;

/** The Rootgnaw: a grub as long as a cart, plated in bark it chewed off the roots, rootglass glowing through its flanks. */
function paintRootgnaw(c: CanvasRenderingContext2D, f: number): void {
  const ph = f * Math.PI / 2;
  // Six segments heave in a wave from tail to head (it inches along the tunnel).
  const seg = (i: number) => ({ x: 5 + i * 4.4, y: 14 - Math.max(0, Math.sin(ph - i * .9)) * 2, r: 3.2 + Math.sin((i + 1) / 7 * Math.PI) * 2.4 });
  // Stub legs under the front half, stepping by turns.
  for (let i = 2; i < 6; i++) { const s = seg(i), sw = (i + f) % 2 ? 1 : -1; limb(c, [s.x, s.y + 2], [s.x + sw, 20], 1, RV.chitin); dot(c, s.x + sw, 20, RV.chitin[3]); }
  for (let i = 0; i < 6; i++) { const s = seg(i); orb(c, s.x, s.y, s.r, s.r * .88, RV.grub); }
  // Bark plates down its back, a crease between each, a rootglass spot on every other flank.
  for (let i = 0; i < 6; i++) {
    const s = seg(i);
    orb(c, s.x - .3, s.y - s.r * .42, s.r * .86, s.r * .46, RV.chitin);
    dot(c, s.x - s.r * .5, s.y - s.r * .5, RV.chitin[0]);
    if (i) line(c, [s.x - 2.2, s.y - s.r * .6], [s.x - 2.2, s.y + s.r * .6], RV.grub[2]);
    if (i % 2) glow(c, s.x, s.y + 1.5, 1, ROOTGLOW);
  }
  // The head: a blunt chitin dome, two rootglass eyes, mandibles that open and close on the root.
  const open = [1, 2, 1, 0][f], hy = seg(5).y - .5;
  orb(c, 32, hy, 3.8, 3.4, RV.chitin);
  dot(c, 31, hy - 2, RV.chitin[0]); dot(c, 32, hy - 2, RV.chitin[0]);
  glow(c, 33, hy - 1, 1, ROOTGLOW);
  limb(c, [34, hy - 1], [37, hy - 2 - open], 1, R.bone); dot(c, 37, hy - 1 - open, R.bone[3]);
  limb(c, [34, hy + 1.5], [37, hy + 2.5 + open], 1, R.bone); dot(c, 37, hy + 1.5 + open, R.bone[3]);
  // A crumb of chewed root falling from the jaws.
  if (f % 2) dot(c, 36, hy + 5, R.bark[1]);
}

/** A spore's tones: a pale core, a sallow green body. */
const SPORE: Ramp = ['#f6ffe0', '#d4f08a', '#8ab84a', '#4e7428'];
/** The Sporecap: a mushroom the height of a child, walking on its roots; it coughs spores at what it wants to grow on. */
function paintSporecap(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f] / 2;
  // Root feet, shuffling.
  for (const [x, l] of [[9, liftB(f)], [12, liftA(f)], [16, liftB(f)], [19, liftA(f)]] as const) {
    limb(c, [x + .5, 29], [x + (l ? s : -s), 34 - l / 2], 2, R.bark); dot(c, x + (l ? s : -s) + 1, 35 - l / 2, R.bark[3]);
  }
  // Stub arms, then the stem: a pale trunk, ringed, a frill under the cap.
  limb(c, [11, 21 + b], [6, 25 + b], 2, RV.stem); limb(c, [18, 21 + b], [23, 24 + b - (f === 2 ? 2 : 0)], 2, RV.stem);
  poly(c, [[9.5, 30], [19.5, 30], [18, 16 + b], [11, 16 + b]], RV.stem);
  line(c, [11, 24 + b], [18, 24 + b], RV.stem[2]); line(c, [10.5, 27 + b], [19, 27 + b], RV.stem[2]);
  poly(c, [[10, 17 + b], [19, 17 + b], [20, 20 + b], [9, 20 + b]], [RV.stem[0], RV.stem[1], RV.stem[2], RV.stem[3]]);
  // Two hollows in the stem for eyes, rootglass light deep in them.
  px(c, 12, 21 + b, 2, 2, RV.gill[2]); px(c, 16, 21 + b, 2, 2, RV.gill[2]);
  glow(c, 12, 21 + b, 1, ROOTGLOW); glow(c, 16, 21 + b, 1, ROOTGLOW);
  // The gills under the cap, faintly lit.
  orb(c, 14.5, 15.5 + b, 11.5, 2.6, RV.gill);
  for (let i = 0; i < 6; i++) dot(c, 6 + i * 3.4, 16 + b, ROOTGLOW[3]);
  // The cap: broad, a dusky rose, pale spots, its rim curled down.
  orb(c, 14.5, 10 + b, 13, 7.2, RV.cap);
  for (const [x, y, r] of [[8, 9, 1.6], [14, 6, 2], [20, 9, 1.4], [11, 13, 1.1], [18, 13, 1.2], [24, 12, 1]] as const) orb(c, x, y + b, r, r * .8, RV.stem);
  // A cough of spores: a little cloud lifting off the cap on the breath frame.
  if (f === 2) for (const [x, y] of [[6, 2], [9, 1], [13, 0], [18, 1], [22, 2], [11, 3]] as const) dot(c, x, y + b, SPORE[f % 2 ? 0 : 1]);
  else if (f === 3) for (const [x, y] of [[5, 1], [12, 0], [21, 0]] as const) dot(c, x, y + b, SPORE[2]);
}

/** The Drowned Acolyte: a temple priest who drowned keeping the Vault, kept since by the moss; a rootglass lantern in its hand. */
function paintAcolyte(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], sway = [0, 1, 0, -1][f], drip = [0, 1, 2, 3][f];
  // The far arm, the sleeve heavy with water.
  limb(c, [8, 16 + b], [5, 26 + b], 2, RV.drown);
  // The robe: a bell from the shoulders, its hem in tatters that sway.
  poly(c, [[8.5, 12 + b], [17.5, 12 + b], [21.5 + sway, 35], [4.5 + sway, 35]], RV.robe);
  for (let i = 0; i < 5; i++) px(c, 6 + i * 3.4 + sway, 34 + (i % 2), 1, 2, RV.robe[3]);
  // Water still running out of it: dark streaks, and a drop falling from the hem.
  line(c, [10, 17 + b], [8 + sway, 33], RV.drown[2]); line(c, [16, 17 + b], [18 + sway, 33], RV.drown[1]);
  dot(c, 13, 19 + b, RV.drown[0]);
  dot(c, 7 + sway, 36 + (drip > 1 ? 1 : 0), RV.drown[drip % 2 ? 0 : 1]);
  // A mantle of moss over the shoulders, a sprig of fern growing from it.
  orb(c, 13, 13 + b, 6, 2, R.moss);
  limb(c, [9, 12 + b], [7, 8 + b], 1, R.vine); dot(c, 6, 7 + b, R.vine[0]);
  // The hood: deep, its mouth black, two pale points of light inside.
  orb(c, 13, 8 + b, 5, 5.4, RV.robe);
  orb(c, 14, 9.2 + b, 3, 3.2, R.void);
  dot(c, 13, 9 + b, RV.drown[0]); dot(c, 15, 9 + b, RV.drown[0]);
  px(c, 10, 4 + b, 6, 1, RV.robe[0]);
  // The near arm holds a rootglass lantern out on a chain.
  limb(c, [17, 15 + b], [21, 21 + b], 2, RV.robe); orb(c, 21, 21.5 + b, 1.5, 1.4, RV.drown);
  line(c, [21, 22 + b], [22 + sway, 26 + b], RV.iron[1]);
  px(c, 20 + sway, 26 + b, 4, 1, RV.iron[0]); px(c, 20 + sway, 31 + b, 4, 1, RV.iron[2]);
  px(c, 20 + sway, 27 + b, 1, 4, RV.iron[1]); px(c, 23 + sway, 27 + b, 1, 4, RV.iron[2]);
  px(c, 21 + sway, 27 + b, 2, 4, ROOTGLOW[1]);
  glow(c, 21 + sway, 28 + b, 1, ROOTGLOW);
}

/** A point along a polyline (t in 0..1, by segment), for a body laid along a path. */
function along(pts: readonly P2[], t: number): P2 {
  const n = pts.length - 1, u = Math.min(n - 1e-6, Math.max(0, t) * n), i = Math.floor(u), k = u - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

/**
 * The Elder Rootwyrm: the first thing the Root grew, under the temple before there was a temple — a wyrm of living bark
 * coiled round the cradle, moss along its back, thorns down its spine, a crown of rootglass antlers; it breathes a
 * spray of rootglass splinters. Its body lies along a path: a far loop in shadow, the near coil, the neck reared up.
 */
function rootwyrm(c: CanvasRenderingContext2D, f: number): void {
  const ph = f * Math.PI / 2, b = BOB[f];
  const ripple = (i: number) => Math.sin(ph + i * .8) * .9;
  // The far loop, behind everything, in shadow.
  const FAR: P2[] = [[46, 50], [36, 40], [22, 36], [10, 42], [8, 50]];
  for (let i = 0; i < 12; i++) {
    const [x, y] = along(FAR, i / 11), r = 4.8 - Math.abs(i - 5.5) * .12;
    orb(c, x, y + ripple(i), r, r * .84, RV.barkDk);
    if (i % 2 === 0) poly(c, [[x - 1.5, y - r + 1 + ripple(i)], [x - .5, y - r - 3 + ripple(i)], [x + 1, y - r + 1 + ripple(i)]], R.thornDk);
  }
  // The near coil, from the tail's tip on the left to the base of the neck.
  const COIL: P2[] = [[3, 59], [14, 61], [28, 60], [42, 57], [52, 51]];
  const n = 15;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), [x, y] = along(COIL, t), r = 2.2 + t * 5.6, w = ripple(i + 3);
    orb(c, x, y + w, r * 1.1, r * .86, R.bark);
    // Moss along the top of every segment; a thorn on every other one; a rootglass seam glowing underneath.
    if (r > 2.5) orb(c, x - .3, y - r * .52 + w, r * .78, r * .3, R.moss);
    if (i % 2 && r > 3) poly(c, [[x - 1.5, y - r * .8 + w], [x - .5, y - r - 3.5 + w], [x + 1.2, y - r * .8 + w]], R.thorn);
    if (i % 3 === 1 && r > 3) dot(c, x, y + r * .7 + w, ROOTGLOW[1]);
  }
  // A belly seam of rootglass where the coil meets the neck, breathing with the light.
  glow(c, 47, 56 + ripple(13), f % 2 ? 2 : 1, ROOTGLOW);
  // The neck, reared up from the coil to the head.
  const NECK: P2[] = [[52, 51], [56, 40], [58, 30], [62, 22]];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, [x, y] = along(NECK, t), r = 6.6 - t * 2.2, sw = Math.sin(ph + t * 2) * .7;
    orb(c, x + sw, y + b * t, r, r * .8, R.bark);
    orb(c, x + sw - 1.2, y + b * t, r * .5, r * .55, R.moss);
    if (i % 2 === 0) poly(c, [[x + sw - r + .5, y + b * t - 1], [x + sw - r - 3, y + b * t - 2.5], [x + sw - r + .5, y + b * t + 1.5]], R.thorn);
    if (i % 2) dot(c, x + sw + r * .6, y + b * t + 1, ROOTGLOW[2]);
  }
  // Hanging vines off the neck, swaying.
  limb(c, [55, 42 + b], [53 + ripple(2), 48], 1, R.vine); dot(c, 53 + ripple(2), 49, R.vine[0]);
  limb(c, [59, 32 + b], [61 + ripple(5), 38 + b], 1, R.vineDk);
  // The head: a long bark skull, a jaw that drops to breathe, thorn teeth, a moss beard.
  const jaw = [0, 1, 4, 1][f], hy = 16 + b;
  poly(c, [[66, hy + 3], [82, hy + 4 + jaw], [82, hy + 6 + jaw], [65, hy + 7]], RV.barkDk);
  for (let i = 0; i < 4; i++) dot(c, 70 + i * 3, hy + 4 + Math.round(jaw * (i + 1) / 4), R.thorn[0]);
  if (jaw > 1) { line(c, [68, hy + 3], [81, hy + 3 + jaw / 2], ROOTGLOW[1]); glow(c, 72, hy + 3, 2, ROOTGLOW); dot(c, 80, hy + 3, ROOTGLOW[0]); }
  orb(c, 65, hy - 2, 7, 5.6, R.bark);
  poly(c, [[67, hy - 5], [83, hy - 1], [83, hy + 3], [66, hy + 3]], R.bark);
  px(c, 70, hy + 2, 13, 1, R.bark[3]);
  for (let i = 0; i < 4; i++) dot(c, 71 + i * 3, hy + 3, R.thorn[0]);
  dot(c, 82, hy - 1, R.bark[3]); dot(c, 80, hy - 2, R.bark[0]);
  orb(c, 64, hy + 5, 2.6, 2, R.moss); limb(c, [64, hy + 6], [63, hy + 10], 1, R.moss); dot(c, 63, hy + 11, R.moss[0]);
  // A rootglass eye in a dark socket, and moss on the brow.
  orb(c, 67, hy - 3, 2.2, 1.9, R.void);
  glow(c, 67, hy - 4, 2, ROOTGLOW);
  orb(c, 63, hy - 6.5, 4.5, 1.6, R.moss);
  // The crown: antlers of living rootglass, branching back off the skull, every tip alight in turn.
  limb(c, [62, hy - 6], [57, hy - 13], 1, R.rootglass); limb(c, [59, hy - 10], [54, hy - 11], 1, R.rootglass); limb(c, [57, hy - 13], [56, hy - 16], 1, R.rootglass);
  limb(c, [65, hy - 7], [63, hy - 14], 1, R.rootglass); limb(c, [64, hy - 11], [68, hy - 15], 1, R.rootglass);
  const lit = f % 2 ? ROOTGLOW[0] : ROOTGLOW[1], dim = f % 2 ? ROOTGLOW[1] : ROOTGLOW[0];
  dot(c, 54, hy - 11, lit); dot(c, 56, hy - 16, dim); dot(c, 63, hy - 14, lit); dot(c, 68, hy - 15, dim);
}
/** The Elder Rootwyrm as the world draws it: its shapes grown a quarter again, set down a little so the crown has room. */
function paintRootwyrm(c: CanvasRenderingContext2D, f: number): void { grown(1.25, 0, 4, () => rootwyrm(c, f)); }

/** Every creature as written, with its authored life (MOBS below is what rises: td-life lifeScale). */
// ── Slice 6: the Ashsinger and the Bone Priest (docs/design/monsters-abilities.md §2.6–2.7) ──────────────────────────

/**
 * The Ashsinger (26×36): the Cinder clans' shaman, smaller and leaner than the Firecaller. Bare-headed, ash-streaked,
 * mouth open mid-verse; an ash-grey cloak, an ember-rope sash, a drum at the hip, a bone-and-ash fetish pole in the far
 * hand and a cinder lifted on the raised near hand. It sings the fallen back up, so its mouth works on the passing frames.
 */
function paintAshsinger(c: CanvasRenderingContext2D, f: number): void {
  const b = BOB[f], s = STEP[f], farOrc: Ramp = [R.orc[1], R.orc[2], R.orc[3], R.orc[3]];
  // Boots under the hem.
  px(c, 7 + s / 2, 34, 5, 2, R.char[1]); px(c, 7 + s / 2, 34, 5, 1, R.char[0]);
  px(c, 14 - s / 2, 34, 5, 2, R.char[2]);
  // The far arm, round a fetish pole: a bone cross-piece, a small skull, ash tufts hung from the bar.
  limb(c, [6, 20 + b], [3, 25 + b], 2, farOrc); orb(c, 3, 26 + b, 1.6, 1.6, R.orc);
  limb(c, [3, 27 + b], [3, 12 + b], 1, R.wood);
  px(c, 0, 14 + b, 7, 1, R.bone[1]); dot(c, 0, 14 + b, R.bone[0]);
  orb(c, 3.5, 11.5 + b, 2.2, 2, R.bone); dot(c, 2, 11 + b, R.void[1]); dot(c, 4, 11 + b, R.void[1]);
  dot(c, 1, 15 + b + (f % 2), R.ash[0]); dot(c, 5, 15 + b + (1 - f % 2), R.ash[1]); dot(c, 1, 16 + b + (f % 2), R.bone[2]);
  // The cloak: ash-grey, a ragged hem edged in ember, a slit up the front showing the dark inside.
  poly(c, [[8, 18 + b], [18, 18 + b], [21, 35], [5, 35]], R.ashDk);
  poly(c, [[9, 19 + b], [17, 19 + b], [19, 34], [7, 34]], R.ash);
  poly(c, [[12, 27 + b], [14, 27 + b], [15, 34], [11, 34]], R.ashDk);
  px(c, 5, 34, 16, 1, EMBER[2]); for (let i = 0; i < 4; i++) dot(c, 6 + i * 4 + (f % 2), 34, EMBER[1]);
  dot(c, 7, 33, R.ashDk[3]); dot(c, 10, 33, R.ashDk[3]); dot(c, 16, 33, R.ashDk[3]); dot(c, 18, 33, R.ashDk[3]);
  // The drum at the hip: a hide head, a dark wooden barrel, bone-pale lacing in a zigzag.
  px(c, 6, 27 + b, 7, 4, R.char[1]); px(c, 6, 27 + b, 7, 1, R.char[0]); px(c, 6, 30 + b, 7, 1, R.char[3]);
  orb(c, 9.5, 27 + b, 3.6, 1.6, R.bone);
  for (let i = 0; i < 3; i++) { dot(c, 7 + i * 2, 28 + b, R.bone[2]); dot(c, 8 + i * 2, 29 + b, R.bone[2]); }
  // Shoulders, and the ember-rope sash across the chest, a cinder caught in each knot.
  orb(c, 13, 20 + b, 6, 3, R.ashDk);
  line(c, [9, 19 + b], [17, 27 + b], EMBER[3]); line(c, [10, 19 + b], [18, 27 + b], EMBER[2]);
  for (const [x, y] of [[11, 21], [14, 24], [17, 26]]) dot(c, x, y + b, EMBER[f % 2 ? 0 : 1]);
  // The head: bare, a small ear-flick up, ash war-streaks, tusks, a verse in the mouth.
  poly(c, [[7, 9 + b], [4, 5 + b], [5, 10 + b], [7, 12 + b]], R.orc);
  poly(c, [[19, 9 + b], [22, 5 + b], [21, 10 + b], [19, 12 + b]], farOrc);
  orb(c, 13, 10 + b, 6.4, 6.6, R.orc);
  px(c, 9, 7 + b, 3, 1, R.orc[3]); px(c, 14, 7 + b, 3, 1, R.orc[3]);
  glow(c, 9, 8 + b, 1.4, EMBER); glow(c, 15, 8 + b, 1.4, EMBER);
  px(c, 8, 11 + b, 1, 3, R.ash[0]); px(c, 18, 11 + b, 1, 3, R.ash[0]); dot(c, 9, 14 + b, R.ash[1]); dot(c, 17, 14 + b, R.ash[1]);
  const wide = f % 2 ? 2 : 1;
  px(c, 11, 13 + b, 4, wide + 1, R.void[1]); dot(c, 12, 12 + b + wide, EMBER[2]);
  dot(c, 10, 13 + b, R.bone[0]); dot(c, 16, 13 + b, R.bone[0]);
  // A topknot bound with bone, a feather of ash.
  poly(c, [[11, 5 + b], [12, 2 + b], [14, 2 + b], [15, 5 + b]], R.char); dot(c, 12, 4 + b, R.bone[1]); dot(c, 14, 4 + b, R.bone[1]); dot(c, 13, 1 + b, R.ash[0]);
  // The near arm raised to the song: a cinder lifted on the hand, sparks climbing away.
  limb(c, [18, 19 + b], [22, 15 + b], 2, R.orc); limb(c, [22, 15 + b], [22, 11 + b], 2, R.orc);
  orb(c, 22, 10 + b, 1.8, 1.8, R.orc);
  glow(c, 21, 6 + b, 2, EMBER);
  dot(c, 20 + (f % 3), 3 + b - (f % 2), EMBER[1]); dot(c, 24 - (f % 2), 5 + b - f % 3, EMBER[2]); dot(c, 19, 4 + b + (f >> 1), R.ash[0]);
}

/**
 * The Bone Priest (24×38): the Ashen Bastion's chaplain. A tidy, bleached skeleton in a tattered dusk-violet cope and
 * mitre, a pale stole fringed in old gold, grave-light eyes, and a censer swung on a chain that breathes the same cold
 * light. No gore: it is the one thing in the Crypt that is still neat.
 */
function paintBonePriest(c: CanvasRenderingContext2D, f: number): void {
  grown(1, 0, 3, () => {
    const b = BOB[f], o = 2, sw = [0, 1, 0, -1][f];
    skeleton(c, f, o, { bone: R.bone, eye: GRAVELIGHT });
    // The cope: a dusk-violet drape from each shoulder, torn into points at the hem; the ribs show down the middle.
    poly(c, [[o + 4, 14 + b], [o + 8, 13 + b], [o + 8, 26 + b], [o + 6, 29 + b], [o + 5, 26 + b], [o + 3, 30 + b], [o + 2, 24 + b]], R.wraith);
    poly(c, [[o + 13, 13 + b], [o + 17, 14 + b], [o + 19, 24 + b], [o + 18, 29 + b], [o + 16, 26 + b], [o + 15, 30 + b], [o + 13, 25 + b]], R.wraith);
    line(c, [o + 4, 15 + b], [o + 3, 24 + b], R.wraith[0]);
    // The collar, round the neck under the jaw, a gold edge.
    poly(c, [[o + 5, 14 + b], [o + 16, 14 + b], [o + 15, 17 + b], [o + 6, 17 + b]], R.wraith);
    line(c, [o + 6, 14 + b], [o + 15, 14 + b], R.gold[1]);
    // The stole: a pale strip down the front to the knee, gold fringe, a ragged tail.
    poly(c, [[o + 9, 15 + b], [o + 12, 15 + b], [o + 12, 28 + b], [o + 11, 30 + b], [o + 10, 28 + b], [o + 9, 29 + b]], R.bone);
    line(c, [o + 10, 17 + b], [o + 10, 27 + b], R.bone[0]);
    px(c, o + 9, 20 + b, 3, 1, R.gold[1]); px(c, o + 9, 24 + b, 3, 1, R.gold[1]);
    dot(c, o + 10, 30 + b, R.gold[1]); dot(c, o + 9, 29 + b, R.gold[2]);
    // The mitre: a short cap of the cope's cloth on the skull, a gold band.
    poly(c, [[o + 6, 5 + b], [o + 7.5, 1 + b], [o + 10.5, -2 + b], [o + 13.5, 1 + b], [o + 15, 5 + b]], R.wraith);
    px(c, o + 6, 4 + b, 9, 1, R.gold[1]); dot(c, o + 10, -1 + b, R.gold[0]); dot(c, o + 10, 1 + b, R.gold[1]);
    // The near arm, down to the hand; the censer swung on its chain, gravelight leaking up as smoke.
    boneArm(c, f, o, o + 17, 24, R.bone);
    const hx = o + 17, hy = 25 + b;
    line(c, [hx, hy], [hx + 1 + sw, hy + 4], R.iron[0]);
    orb(c, hx + 1 + sw, hy + 6, 2.3, 2, R.iron); px(c, hx + sw - 1, hy + 4, 5, 1, R.iron[1]); dot(c, hx + 1 + sw, hy + 3, R.iron[0]);
    glow(c, hx + sw, hy + 6, 1, GRAVELIGHT);
    dot(c, hx + 1 + sw, hy + 1 - (f % 2), GRAVELIGHT[1]);
    dot(c, hx + 3 - (f >> 1), hy - (f % 3), GRAVELIGHT[2]);
  });
}
export const S6_PAINTERS = { 'ashsinger': paintAshsinger, 'bone-priest': paintBonePriest } as const;

const AUTHORED: Readonly<Record<string, MobDef>> = {
  'lava-hound': {
    id: 'lava-hound', name: 'Lava Hound', hp: 120, speed: 50, dmg: [7, 12], rate: 1.1, sight: 130, level: 10, hits: 'fire',
    lore: 'Born in a kiln that was never lit by hand, it tracks a warm boot-print for miles and sleeps in the cracks that still glow.',
    drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintHound, w: 32, h: 24,
  },
  'obsidian-golem': {
    id: 'obsidian-golem', name: 'Obsidian Golem', hp: 260, speed: 22, dmg: [12, 20], rate: 1.7, sight: 110, level: 14,
    lore: 'The glass-cutters walked away mid-shift. Their last statue did not, and it still guards the seam it was told to hold.',
    drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .08 }], paint: paintGolem, w: 34, h: 40,
  },
  'ember-warden': {
    id: 'ember-warden', name: 'The Ember Warden', hp: 420, speed: 24, dmg: [10, 16], rate: 1.6, sight: 140, level: 8, hits: 'fire',
    lore: 'Keeper of the flooded galleries, it banks the old forge-fire each night and bites anyone who comes to stoke it.',
    drops: [{ material: 'infernal-heartstone', qty: 1, chance: .5 }, { material: 'ember-residue', qty: 2, chance: 1 }], paint: paintWarden, w: 40, h: 56, rank: 'boss',
    charge: { min: 28, rate: 6, dmg: [14, 22], speed: 210, kind: 'leap' },
  },
  'magma-tyrant': {
    id: 'magma-tyrant', name: 'The Magma Tyrant', hp: 1400, speed: 20, dmg: [18, 30], rate: 1.8, sight: 160, level: 20, hits: 'fire',
    lore: 'It was a crown once, poured too hot. Now the caldera wears it, and the caldera does not take kindly to visitors.',
    drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintTyrant, w: 58, h: 72, rank: 'boss',
    charge: { min: 28, rate: 6, dmg: [25, 40], speed: 220, kind: 'charge' },
  },
  'ash-wolf': {
    id: 'ash-wolf', name: 'Ash Wolf', hp: 45, speed: 46, dmg: [3, 7], rate: 1.1, sight: 110, level: 1,
    lore: 'Grey as a cold hearth and just as quiet, it hunts the Emberwood in the hour after the last ember fades.',
    drops: [{ material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintWolf, w: 30, h: 22,
  },
  'cinder-imp': {
    id: 'cinder-imp', name: 'Cinder Imp', hp: 65, speed: 38, dmg: [4, 7], rate: 1.2, sight: 120, level: 2, hits: 'fire',
    lore: 'A spark that grew a grudge. It throws small tempers and smaller fires, and giggles when the soot finds your collar.',
    drops: [{ material: 'ember-residue', qty: 1, chance: .3 }], paint: paintImp, w: 24, h: 24,
  },
  'rivet-maw': {
    id: 'rivet-maw', name: 'Rivet Maw', hp: 60, speed: 34, dmg: [3, 6], rate: 1.3, sight: 96, level: 1,
    lore: 'Scrap-iron with a hunger. Somebody forgot to take the teeth out of the rivet barrel, and now they chew.',
    drops: [{ material: 'cinder-ore', qty: 1, chance: .7 }], paint: paintMaw, w: 24, h: 20,
  },
  'cinder-bailiff': {
    id: 'cinder-bailiff', name: 'Cinder Bailiff', hp: 110, speed: 28, dmg: [6, 10], rate: 1.5, sight: 110, level: 3,
    lore: 'It still serves writs to the dead mine, and swings its ledger-hook at anyone found behind on their dues.',
    drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .35 }], paint: paintBailiff, w: 26, h: 34,
  },
  // The undead and the Cinder clans (owner 2026-10-20: "lots of scary monsters … skeletons, dragons, orcs, undead").
  'bone-walker': {
    id: 'bone-walker', name: 'Bone Walker', hp: 80, speed: 30, dmg: [4, 8], rate: 1.4, sight: 96, level: 6,
    lore: 'It remembers walking to work, so it walks. Nobody has told it which way the work went.',
    drops: [{ material: 'ember-residue', qty: 1, chance: .25 }], paint: paintBoneWalker, w: 22, h: 36,
  },
  // The Hushed Barrow's vault, behind Barrow Door 1 (maps/hushed-barrow.ts; shared/sexton, the Sexton's Count).
  'the-uncounted': {
    id: 'the-uncounted', name: 'The Uncounted', hp: 360, speed: 26, dmg: [7, 12], rate: 1.5, sight: 120, level: 7,
    lore: 'The forty-first of forty graves. It does not fight like it hates you. It fights like it wants to be counted.',
    drops: [{ material: 'ember-residue', qty: 2, chance: 1 }, { material: 'world-root-bark', qty: 2, chance: .5 }], paint: paintUncounted, w: 34, h: 54, rank: 'boss',
    // Its gap-closer: the forty dead lurch at once along a line (osk mur: the dead, a line).
    charge: { min: 28, rate: 6, dmg: [10, 17], speed: 200, kind: 'charge', chant: 'osk mur' },
    chant: 'osk teth', ghost: true, summon: { type: 'bone-walker', count: 2, at: .5 },
  },
  // S6 (§2.6): the Bastion's chaplain, still calling the roll in the Ashen Crypt.
  'bone-priest': {
    id: 'bone-priest', name: 'Bone Priest', hp: 150, speed: 26, dmg: [6, 10], rate: 1.6, sight: 150, level: 16,
    lore: 'The Bastion\'s chaplain swore to keep the watch mustered. He still calls the roll, and the roll still answers.',
    drops: [{ material: 'ember-residue', qty: 1, chance: .5 }, { material: 'world-root-bark', qty: 1, chance: .3 }], paint: paintBonePriest, w: 24, h: 38,
    ranged: { range: 100, keep: 80, rate: 2.4, dmg: [7, 11], speed: 105, kind: 'ink' },
  },
  'bone-archer': {
    id: 'bone-archer', name: 'Bone Archer', hp: 85, speed: 30, dmg: [3, 6], rate: 1.5, sight: 140, level: 8,
    lore: 'A bow strung with something that is not quite sinew. It only ever aims at the lantern you carry.',
    drops: [{ material: 'world-root-bark', qty: 1, chance: .3 }], paint: paintBoneArcher, w: 26, h: 36,
    ranged: { range: 92, keep: 76, rate: 1.9, dmg: [6, 10], speed: 120, kind: 'arrow' },
  },
  'ash-ghoul': {
    id: 'ash-ghoul', name: 'Ash Ghoul', hp: 70, speed: 60, dmg: [5, 9], rate: .8, sight: 130, level: 9,
    lore: 'Quick and starved, it scrapes the ash from old pyres and wears it like a shawl against the cold it can no longer feel.',
    drops: [{ material: 'ember-residue', qty: 1, chance: .35 }], paint: paintGhoul, w: 28, h: 22,
  },
  'cinder-wraith': {
    id: 'cinder-wraith', name: 'Cinder Wraith', hp: 150, speed: 32, dmg: [8, 13], rate: 1.4, sight: 130, level: 12,
    lore: 'A flicker of someone who stood too near the furnace door. It drifts over the slag, humming a shift-bell song.',
    drops: [{ material: 'ember-residue', qty: 2, chance: .5 }, { material: 'infernal-heartstone', qty: 1, chance: .04 }], paint: paintWraith, w: 24, h: 36,
    floats: true, ghost: true,
  },
  'cinder-orc': {
    id: 'cinder-orc', name: 'Cinder-clan Orc', hp: 170, speed: 36, dmg: [9, 15], rate: 1.3, sight: 120, level: 10,
    lore: 'The Cinder clans trade in iron and grudges. This one has plenty of both, and would like to see yours.',
    drops: [{ material: 'cinder-ore', qty: 1, chance: .5 }, { material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintOrc, w: 28, h: 38,
  },
  'orc-firecaller': {
    id: 'orc-firecaller', name: 'Orc Firecaller', hp: 130, speed: 30, dmg: [6, 10], rate: 1.5, sight: 150, level: 13,
    lore: 'It talks to the coals in a low voice, and the coals, against their better judgement, answer.',
    drops: [{ material: 'ember-residue', qty: 2, chance: .6 }], paint: paintFirecaller, w: 28, h: 38,
    ranged: { range: 100, keep: 74, rate: 2.1, dmg: [10, 16], speed: 110, kind: 'fire' },
  },
  'orc-warlord': {
    id: 'orc-warlord', name: 'Orc Warlord', hp: 440, speed: 32, dmg: [15, 24], rate: 1.5, sight: 140, level: 16,
    lore: 'Scarred, crowned in a smithing helm, and followed by every drum in the Badlands. It has never once asked for directions.',
    drops: [{ material: 'cinder-ore', qty: 3, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .15 }], paint: paintWarlord, w: 42, h: 52, rank: 'champion',
  },
  // S6 (monsters-abilities.md §2.7): the clans' shaman, D2's Fallen Shaman — the reason to dive the back line.
  'ashsinger': {
    id: 'ashsinger', name: 'Ashsinger', hp: 104, speed: 30, dmg: [4, 6], rate: 1.6, sight: 150, level: 14, hits: 'fire',
    lore: 'The clans bury no one. The Ashsinger sings them back up instead, and charges the family for the verse.',
    drops: [{ material: 'ember-residue', qty: 2, chance: .6 }, { material: 'world-root-bark', qty: 1, chance: .2 }], paint: paintAshsinger, w: 26, h: 36,
    ranged: { range: 96, keep: 80, rate: 2.6, dmg: [5, 8], speed: 110, kind: 'fire' },
  },
  'ember-drake': {
    id: 'ember-drake', name: 'Ember Drake', hp: 320, speed: 40, dmg: [12, 18], rate: 1.4, sight: 150, level: 18,
    lore: 'It nests where the ground sighs smoke, and treats every traveller as a spark that wandered too near its kindling.',
    drops: [{ material: 'ember-residue', qty: 2, chance: .8 }, { material: 'infernal-heartstone', qty: 1, chance: .1 }], paint: paintDrake, w: 38, h: 30,
    ranged: { range: 84, keep: 0, rate: 3, dmg: [12, 20], speed: 130, kind: 'fire' },
  },
  'bone-dragon': {
    id: 'bone-dragon', name: 'The Ashbone Dragon', hp: 2200, speed: 22, dmg: [22, 34], rate: 1.8, sight: 190, level: 25,
    lore: 'The oldest thing under the Bastion. It was a dragon once; it is now a promise the ash made, and the ash keeps its promises.',
    drops: [{ material: 'infernal-heartstone', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 3, chance: 1 }], paint: paintBoneDragon, w: 76, h: 64, rank: 'boss', chant: 'osk vael sha',
    ranged: { range: 130, keep: 0, rate: 3.4, dmg: [16, 26], speed: 120, kind: 'breath', spread: 3 },
    summon: { type: 'bone-walker', count: 2, at: .5 },
  },
  // The Molten Deep's lower floors (−4…−6) and the Forge of the Four.
  'slag-crawler': {
    id: 'slag-crawler', name: 'Slag Crawler', hp: 300, speed: 30, dmg: [14, 22], rate: 1.4, sight: 120, level: 21,
    lore: 'Half beetle, half cooling slag, it walks the rivers of the Deep and leaves a crust behind that hardens into the next floor.',
    drops: [{ material: 'cinder-ore', qty: 2, chance: 1 }, { material: 'ember-residue', qty: 1, chance: .4 }], paint: paintCrawler, w: 36, h: 20,
  },
  'glass-sentinel': {
    id: 'glass-sentinel', name: 'Glass Sentinel', hp: 340, speed: 20, dmg: [12, 18], rate: 1.8, sight: 150, level: 24,
    lore: 'Poured by the foundry\'s last shift and never told to stop, it fires molten glass at anything that is not a mould.',
    drops: [{ material: 'cinder-ore', qty: 1, chance: 1 }, { material: 'infernal-heartstone', qty: 1, chance: .12 }], paint: paintSentinel, w: 26, h: 42,
    ranged: { range: 110, keep: 80, rate: 2.2, dmg: [12, 18], speed: 140, kind: 'fire' },
  },
  'anvil-warden': {
    id: 'anvil-warden', name: 'The Anvil-Warden', hp: 1100, speed: 22, dmg: [16, 26], rate: 1.7, sight: 150, level: 18,
    lore: 'The First Smith\'s anvil grew legs to keep its oath; it still hammers the air for a blade nobody will finish.',
    drops: [{ material: 'infernal-heartstone', qty: 1, chance: 1 }, { material: 'cinder-ore', qty: 4, chance: 1 }], paint: paintAnvilWarden, w: 48, h: 67, rank: 'boss',
    charge: { min: 28, rate: 6, dmg: [22, 36], speed: 200, kind: 'slam' },
    summon: { type: 'cinder-bailiff', count: 2, at: .5 },
  },
  'cinder-sovereign': {
    id: 'cinder-sovereign', name: 'The Cinder Sovereign', hp: 3200, speed: 22, dmg: [26, 40], rate: 1.7, sight: 170, level: 30,
    lore: 'The heart of the Deep wears a crown of its own sparks. It does not rule the fire — it is what the fire remembers.',
    drops: [{ material: 'infernal-heartstone', qty: 3, chance: 1 }, { material: 'ember-residue', qty: 4, chance: 1 }], paint: paintSovereign, w: 68, h: 72, rank: 'boss', chant: 'vael ul dra',
    ranged: { range: 130, keep: 0, rate: 3.2, dmg: [20, 32], speed: 120, kind: 'breath', spread: 5 },
    // At half its life it calls the hounds of the deep to its side.
    summon: { type: 'lava-hound', count: 2, at: .5 },
  },
  // The Verdant Wilds (levels 15–40): the Greenwood, the Deep Wilds, the Sunken Courts and the Overgrown Temple.
  'canopy-bat': {
    id: 'canopy-bat', name: 'Canopy Bat', hp: 170, speed: 54, dmg: [8, 13], rate: 1, sight: 140, level: 15,
    lore: 'It sleeps folded into the giant trees like a dead leaf, and wakes all at once when a lantern passes underneath.',
    drops: [{ material: 'verdant-sap', qty: 1, chance: .35 }], paint: paintCanopyBat, w: 28, h: 24,
  },
  'moss-stalker': {
    id: 'moss-stalker', name: 'Moss Stalker', hp: 260, speed: 48, dmg: [12, 19], rate: 1.1, sight: 140, level: 17,
    lore: 'You will not see it in the moss. You will see the moss move, once, and that is the last thing the moss does quietly.',
    drops: [{ material: 'thornroot', qty: 1, chance: .6 }, { material: 'world-root-bark', qty: 1, chance: .15 }], paint: paintMossStalker, w: 34, h: 24,
  },
  'vine-lasher': {
    id: 'vine-lasher', name: 'Vine Lasher', hp: 340, speed: 22, dmg: [15, 23], rate: 1.3, sight: 110, level: 21,
    lore: 'A bloom that learned to walk so it could go where the food was. It still sings to the bees, and the bees still come.',
    drops: [{ material: 'thornroot', qty: 2, chance: .8 }, { material: 'verdant-sap', qty: 1, chance: .5 }], paint: paintVineLasher, w: 30, h: 36,
  },
  'rootglass-hart': {
    id: 'rootglass-hart', name: 'Rootglass Hart', hp: 460, speed: 44, dmg: [18, 27], rate: 1.4, sight: 150, level: 24,
    lore: 'The Rootglass Stags that live long enough stop being shy. Their antlers ring like glass when they lower their heads.',
    drops: [{ material: 'world-root-bark', qty: 1, chance: .5 }, { material: 'verdant-sap', qty: 2, chance: .6 }], paint: paintRootglassHart, w: 40, h: 38,
    // Lowered Antlers (S6 §2.2): the shipped gap-closer, given to the hart (1.8B across 5 tiles).
    charge: { min: 40, rate: 8, dmg: [32, 49], speed: 220, kind: 'charge' },
  },
  'thorn-weaver': {
    id: 'thorn-weaver', name: 'Thorn Weaver', hp: 380, speed: 30, dmg: [14, 21], rate: 1.5, sight: 150, level: 28,
    lore: 'It weaves its web from thornroot and spits what it does not need. The Sunken Courts are hung with its work like old banners.',
    drops: [{ material: 'thornroot', qty: 2, chance: 1 }, { material: 'world-root-bark', qty: 1, chance: .25 }], paint: paintThornWeaver, w: 44, h: 27,
    ranged: { range: 104, keep: 70, rate: 2, dmg: [16, 24], speed: 130, kind: 'arrow' },
  },
  'mossbound-colossus': {
    id: 'mossbound-colossus', name: 'The Mossbound Colossus', hp: 3600, speed: 20, dmg: [28, 42], rate: 1.8, sight: 170, level: 34,
    lore: 'The temple set it to keep the shrine; the Root grew in and kept the guardian. Its heart is rootglass now, and it beats slow.',
    drops: [{ material: 'world-root-bark', qty: 3, chance: 1 }, { material: 'verdant-sap', qty: 4, chance: 1 }, { material: 'thornroot', qty: 4, chance: 1 }], paint: paintColossus, w: 64, h: 76, rank: 'boss',
    charge: { min: 28, rate: 6, dmg: [38, 58], speed: 190, kind: 'slam' },
    // At half its life it calls the temple's lashers up through the stones.
    summon: { type: 'vine-lasher', count: 2, at: .5 },
  },
  // The Umbral Marches (levels 25–50): the fens, the deep fen, the meres, the drowned ruins, the Drowned Crypts.
  'mire-lurker': {
    id: 'mire-lurker', name: 'Mire Lurker', hp: 345, tough: 620 / 345, speed: 26, dmg: [20, 30], rate: 1.4, sight: 120, level: 25,
    lore: 'Fen folk hang their lanterns high for a reason. The low ones, the ones that bob a little, belong to something that is very patient.',
    drops: [{ material: 'nightbloom', qty: 1, chance: .5 }, { material: 'umbral-ink', qty: 1, chance: .2 }], paint: paintMireLurker, w: 36, h: 28,
  },
  'lantern-wisp': {
    id: 'lantern-wisp', name: 'Lantern Wisp', hp: 380, tough: 480 / 380, speed: 46, dmg: [18, 26], rate: 1.1, sight: 150, level: 28,
    lore: 'A lantern dropped in the mire goes out. Most of them. This one kept the flame and lost the lantern, and it is looking for someone to carry it home.',
    drops: [{ material: 'umbral-ink', qty: 1, chance: .35 }, { material: 'nightglass', qty: 1, chance: .12 }], paint: paintLanternWisp, w: 22, h: 30,
    floats: true, ghost: true, hits: 'fire',
  },
  'ink-hound': {
    id: 'ink-hound', name: 'Ink Hound', hp: 430, tough: 760 / 430, speed: 56, dmg: [24, 35], rate: 1.1, sight: 160, level: 32,
    lore: 'Poured, not born, out of the Ink Deeps. It leaves pawprints that never dry, and it can follow its own trail back down in the dark.',
    drops: [{ material: 'umbral-ink', qty: 2, chance: .7 }, { material: 'inkstone', qty: 1, chance: .2 }], paint: paintInkHound, w: 34, h: 24,
  },
  'drowned-knight': {
    id: 'drowned-knight', name: 'Drowned Knight', hp: 505, tough: 1200 / 505, speed: 28, dmg: [32, 46], rate: 1.6, sight: 140, level: 38,
    lore: 'Gloamhaven\'s old guard marched into the fen the night the abbey went under. They are still on watch. Nobody has told them to stand down.',
    drops: [{ material: 'inkstone', qty: 1, chance: .5 }, { material: 'nightglass', qty: 1, chance: .25 }], paint: paintDrownedKnight, w: 30, h: 40,
  },
  'gloam-witch': {
    id: 'gloam-witch', name: 'Gloam Witch', hp: 555, tough: 900 / 555, speed: 30, dmg: [24, 34], rate: 1.5, sight: 170, level: 42,
    lore: 'She sells cures in Lanternfen on market days and curses in the fen on the others. Her lantern burns ink, and what it shows you is true.',
    drops: [{ material: 'nightbloom', qty: 2, chance: .8 }, { material: 'umbral-ink', qty: 2, chance: .6 }, { material: 'nightglass', qty: 1, chance: .2 }], paint: paintGloamWitch, w: 26, h: 38,
    ranged: { range: 120, keep: 80, rate: 2, dmg: [26, 38], speed: 120, kind: 'ink' },
  },
  'ink-abbess': {
    id: 'ink-abbess', name: 'The Ink Abbess', hp: 7200, speed: 20, dmg: [44, 62], rate: 1.8, sight: 190, level: 50,
    lore: 'The abbess would not leave her prayers when the water came. She is praying still, and the ink in her lantern is everything the abbey ever wrote down.',
    drops: [{ material: 'umbral-sigil', qty: 1, chance: 1 }, { material: 'inkstone', qty: 3, chance: 1 }, { material: 'umbral-ink', qty: 5, chance: 1 }, { material: 'nightglass', qty: 2, chance: 1 }], paint: paintInkAbbess, w: 66, h: 72, rank: 'boss', chant: 'nyr orum',
    // Her great attack: a wave of ink from the censer, three wide, after a tell on the floor. At half her life the hounds come.
    ranged: { range: 140, keep: 0, rate: 3.6, dmg: [34, 50], speed: 110, kind: 'ink', spread: 3 },
    summon: { type: 'ink-hound', count: 2, at: .5 },
  },
  // The Verdant Wilds' deeper places: the Root Hollows (−1…−3), the Overgrown Temple's Drowned Vault and Rootcradle (−4, −5).
  'rootgnaw': {
    id: 'rootgnaw', name: 'Rootgnaw', hp: 300, speed: 26, dmg: [13, 20], rate: 1.3, sight: 120, level: 19,
    lore: 'It eats the roots of trees that are already dead, and the tunnels it leaves are the Root Hollows. It has not decided yet whether you are a root.',
    drops: [{ material: 'world-root-bark', qty: 1, chance: .45 }, { material: 'thornroot', qty: 1, chance: .3 }], paint: paintRootgnaw, w: 38, h: 22,
  },
  'sporecap': {
    id: 'sporecap', name: 'Sporecap', hp: 360, speed: 22, dmg: [14, 21], rate: 1.4, sight: 130, level: 23,
    lore: 'A mushroom that grew in the dark until it could walk. It coughs its spores at anything warm, because warm things are where mushrooms grow best.',
    drops: [{ material: 'verdant-sap', qty: 1, chance: .6 }, { material: 'thornroot', qty: 1, chance: .25 }], paint: paintSporecap, w: 28, h: 36,
    ranged: { range: 96, keep: 56, rate: 2.4, dmg: [14, 21], speed: 90, kind: 'spore' },
  },
  'drowned-acolyte': {
    id: 'drowned-acolyte', name: 'Drowned Acolyte', hp: 445, tough: 560 / 445, speed: 24, dmg: [20, 30], rate: 1.5, sight: 140, level: 33,
    lore: 'The priests who stayed to keep the Vault when the springs rose. The moss kept them in turn. They still carry the lamps, and still do not let anyone past.',
    drops: [{ material: 'verdant-sap', qty: 2, chance: .7 }, { material: 'world-root-bark', qty: 1, chance: .3 }], paint: paintAcolyte, w: 26, h: 38,
  },
  'elder-rootwyrm': {
    id: 'elder-rootwyrm', name: 'The Elder Rootwyrm', hp: 5200, speed: 20, dmg: [32, 48], rate: 1.8, sight: 180, level: 40,
    lore: 'The first thing the Root grew, coiled in the dark before the temple was raised over it. The priests called it the Cradle; it never answered to anything.',
    drops: [{ material: 'world-root-bark', qty: 4, chance: 1 }, { material: 'verdant-sap', qty: 5, chance: 1 }, { material: 'thornroot', qty: 5, chance: 1 }], paint: paintRootwyrm, w: 106, h: 88, rank: 'boss', chant: 'thar orum',
    // It winds up (BOSS_TELL) and breathes a fan of rootglass splinters; at half its life the drowned priests come down to it.
    ranged: { range: 140, keep: 0, rate: 3.2, dmg: [24, 36], speed: 120, kind: 'shard', spread: 5 },
    summon: { type: 'drowned-acolyte', count: 2, at: .5 },
  },
  // The eclipse's world boss (td-seam.ts): it rises at a continent's rift under an eclipse, at that rift's fixed level
  // (td-zones SEAM_LEVELS, seamEaterAt). This is its level-20 self, Ember Isle's, as the Bestiary shows it.
  'seam-eater-risen': {
    id: 'seam-eater-risen', name: 'The Seam Eater', hp: seamStats(20).hp, speed: 18, dmg: [15, 22], rate: 1.8, sight: 170, level: 20,
    lore: 'They sank it in the slag under the Seamworks and posted thanks. Under an eclipse the seam it ate opens again, and it climbs out of the tear with the dark still on it.',
    drops: [{ material: 'eclipse-glass', qty: 2, chance: 1 }, { material: 'nightglass', qty: 2, chance: 1 }, { material: 'umbral-sigil', qty: 1, chance: .5 }], paint: paintSeamEater, w: 112, h: 100, rank: 'boss', chant: 'ul nyr sha', hits: 'arcane',
    // Void Breath: a fan of void after the cone on the ground. Seam Rend: rings round the Keeper that burst after a
    // second. At half its life two Eclipse-touched shades climb out and both attacks quicken.
    ranged: { range: 140, keep: 0, rate: 4, dmg: [10, 15], speed: 115, kind: 'ink', spread: 5 },
    rend: { rate: 6, rings: 3, r: 20, spread: 34, tell: 1, dmg: [17, 23], chant: 'ul dra' },
    half: { spread: 7, rate: 3.2, rings: 5, rendRate: 4.5, chant: 'ul teth' },
    summon: { type: 'cinder-wraith', count: 2, at: .5, touched: true },
    bound: { leash: 14 },
  },
};
/**
 * Every creature as it rises (docs/design/loot-and-combat.md §13): its authored life × td-life lifeScale — an
 * ordinary creature ×1 at level 1 climbing to ×3 by level 6, a boss ×22 — so a Keeper at level takes a few seconds over
 * a creature and a minute or two over a boss (scripts/combat-sim.mjs holds the bands). The Seam Eater's life is its
 * own curve (td-seam seamStats, the same boss factor in it). Hunting XP still follows the authored life (kill).
 */
export const MOBS: Readonly<Record<string, MobDef>> = Object.fromEntries(Object.entries(AUTHORED)
  .map(([key, def]) => [key, key === SEAM_ID ? def : { ...def, hp: livedHp(def.hp * (def.tough ?? 1), def.level, def.rank) }]));

/** The Warlock's raised skeleton (Raise Skeleton): drawn like a Bone Walker blanched violet; never a spawn. */
export const RAISED_SKELETON: MobDef = {
  id: 'raised-skeleton', name: 'Raised Skeleton', hp: 1, speed: 52, dmg: [1, 1], rate: 1.1, sight: 0, level: 1,
  drops: [], paint: paintRaised, w: 22, h: 36,
};

const sheets = new Map<string, HTMLCanvasElement>();
/** Frames in a creature's sheet: a walk or a hover (contact, passing, contact, passing). The engine reads the count off the sheet. */
export const MOB_FRAMES = 4;
/** A boss's rim, in its element's colour (docs/design/effects-spec.md): fire for the forge-born, violet bone-light for the dragon. */
const RIM: Readonly<Record<string, string>> = {
  'ember-warden': '#ff8a2e', 'magma-tyrant': '#ff8a2e', 'anvil-warden': '#ffb347', 'cinder-sovereign': '#ff8a2e', 'bone-dragon': '#b06bff',
  'mossbound-colossus': '#7affd0', 'ink-abbess': '#a48bff', 'elder-rootwyrm': '#7affd0', 'the-uncounted': '#b8e8d8',
  'seam-eater-risen': '#f0e0ff',
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
    // Darker than it was (the art style upgrade: the references' heavier outline), still a dark of what it borders.
    const t = lit * 2 >= n ? .84 : .94, i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(sum[k] / n * (1 - t) + out[k] * t);
    d[i + 3] = 255; edge[y * w + x] = 1;
  }
  // A second pixel of outline on the shaded lower right, where the body turns from the light.
  for (let y = h - 1; y > 0; y--) for (let x = w - 1; x > 0; x--) {
    const k = y * w + x;
    if (filled(x, y) || edge[k] || !edge[k - w - 1] || !(filled(x - 1, y - 2) || filled(x - 2, y - 1) || filled(x - 2, y - 2))) continue;
    const i = k * 4;
    d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = 255; edge[k] = 1;
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
/**
 * How much finer than their art grid creatures are painted (the art style upgrade, 2026-10-26): the Keeper stands on the
 * fine grid (keeper-paint FIGURE_K), so a creature's shapes are grown by the same 1.5 — a boss's by less, it is big
 * already. Only the picture grows: a creature's `w`/`h` (its reach, its hit box, where blows land) are unchanged.
 */
export function mobK(def: { w?: number }): number { const w = def.w ?? 0; return w >= 60 ? 1.15 : w >= 40 ? 1.3 : 1.5; }
/** A creature's cell in its sheet (fine-grid px): its art box grown by mobK, rounded up. */
export function mobCell(def: { w?: number; h: number }): { w: number; h: number } { const k = mobK(def); return { w: Math.ceil((def.w ?? 0) * k), h: Math.ceil(def.h * k) }; }
export function mobSheet(def: MobDef): HTMLCanvasElement {
  let s = sheets.get(def.id);
  if (s) return s;
  const { w, h } = mobCell(def), k = mobK(def);
  s = document.createElement('canvas'); s.width = w * MOB_FRAMES; s.height = h;
  const o = s.getContext('2d')!;
  for (let f = 0; f < MOB_FRAMES; f++) {
    const cell = document.createElement('canvas'); cell.width = w; cell.height = h;
    const c = cell.getContext('2d', { willReadFrequently: true })!;
    grown(k, 0, 0, () => def.paint(c, f));
    const img = c.getImageData(0, 0, w, h);
    // The volume pass (keeper-volume.ts), gentle: the creatures are already lit shape by shape; this rounds the whole.
    volumizeData(img.data, w, h, { light: .28, shade: .36, depth: 5, alphaMin: 200 });
    outline(img, RIM[def.id]);
    o.putImageData(img, f * w, 0);
  }
  sheets.set(def.id, s);
  return s;
}

/** A spawn: its own key, its kind, where it stands, and its zone's level for it (td-zones zoneLevel; unset: its kind's own). */
export interface MobSpawn { key: string; type: string; x: number; y: number; level?: number }

export interface Mob {
  key: string;
  def: MobDef;
  /**
   * A personal (phased) creature: raised by this screen for this Keeper alone (a quest's foe, the Sexton's Row-Walker),
   * never the room's and never on the wire. On a member it is still simulated, wounded and felled here, so a quest
   * step the room cannot see stays playable online (docs/design/online.md §4d, "Personal creatures").
   */
  personal?: boolean;
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
  /** Weaken (Shadow tree): seconds left and how much weaker it bites (%). */
  weak?: number;
  weakPct?: number;
  /** Doom (Shadow tree): seconds until it bursts, and the burst it carries. */
  doom?: number;
  doomHit?: { min: number; max: number; r: number };
  /** Seconds its chant still hangs over its head (a boss winding up, CHANT_SECS), and the words (its def's chant when unset). */
  chantT?: number;
  chantText?: string;
  /** A ground attack's cooldown (MobDef.rend), and whether its half-life change has come (MobDef.half). */
  rendCd?: number;
  halved?: boolean;
  /** A gap-closer (MobDef.charge): its cooldown, whether the tell running is one, and the crossing under way. */
  chargeCd?: number;
  charging?: boolean;
  dash?: { x: number; y: number; t: number } | null;
  /** A member of an elite pack (td-elites.ts): its rank, role, affixes and a unique leader's name. */
  elite?: EliteTag;
  /** What it takes of every hit (Stone Skin < 1). */
  take?: number;
  /** Teleport: seconds until it may blink again, the wind-up left, and where it lands. */
  blinkCd?: number;
  blinkT?: number;
  blinkTo?: { x: number; y: number } | null;
  /** The Crown of the Banked Coal: seconds it still smoulders, and the tick timer. */
  singeT?: number;
  singeTick?: number;
  /** The Abbess's Censer: seconds its ink stain lasts (it takes more from every hit meanwhile). */
  inkT?: number;
  /** The Ashguard (td-ashguard-skills): stunned by a Shield Bash, taunted by a Watch Cry (seconds left). */
  stun?: number;
  taunt?: number;
  /** The Ember Brand's burn on it: seconds left, the tick timer, the burn still owed and the ticks left to pay it (so the whole burn the card names lands). */
  brandT?: number;
  brandTick?: number;
  brandDps?: number;
  brandTicks?: number;
  /** The Lanternwright's Dawn at Noon: seconds it stays unveiled (it takes more from every hit meanwhile). */
  revealT?: number;
  /** The Thornstrider (td-thorn-skills): rooted by a snare or a trap (seconds left: it stands, it still bites). */
  rootT?: number;
  /** A Barbed Shot's bleed: seconds left, the tick timer, the whole life it loses each tick. */
  bleedT?: number;
  bleedTick?: number;
  bleedDps?: number;
  /**
   * Shared creatures (protocol 4, td-coop.ts): its short id on the wire; who of the party fought it ('' = this
   * Keeper; a member's room id for a claim that landed or a bite it took); a boss's life before the party's +60% each
   * (coopBossLife) and how many it was scaled for.
   */
  nid?: string;
  coopBy?: Set<string>;
  coopBase?: number;
  coopN?: number;
  /**
   * Sight (td-sight.ts): whether it saw its prey at its last look, and the seconds it keeps chasing where it last saw
   * it after losing sight (CHASE_MEMORY) — a creature behind a wall neither starts a hunt nor strikes.
   */
  saw?: boolean;
  chaseT?: number;
  /**
   * The Skill Book's marks on it (td-marks riders and rules): a burn's seconds, its tick and its whole life a tick; a
   * chill, a blind, a hush, a fear (seconds left); a Sunder's stacks and their seconds; an elite affix a mark stripped
   * (and when it comes back).
   */
  scorchT?: number;
  scorchTick?: number;
  scorchDps?: number;
  chillT?: number;
  blindT?: number;
  hushT?: number;
  fearT?: number;
  sunderN?: number;
  sunderT?: number;
  stripped?: { affix: string; t: number } | null;
  /** A shared creature (a room's or a host's): the skill whose blow this Keeper last landed on it, for its fall's marks. */
  lastSrc?: SkillId | null;
  // ── S6 (td-abilities, td-pack-aura, the new affixes) ──
  /** Each castable ability's cooldown (seconds left), by its index in castable(). */
  ab?: number[];
  /** The ability whose tell is running (its index), with `tell` and `aim`. */
  abCast?: number;
  /** Underground (a burrow): seconds left (not drawn, not struck). */
  hidden?: number;
  /** A Bone Ward on it: absorb left, seconds left. */
  ward?: number; wardT?: number;
  /** Moss Mending on it: seconds left and the share of its life a second. */
  mendT?: number; mendPct?: number;
  /** Pack Howl on it: seconds of +speed left. */
  howlT?: number;
  /** Its next bite lays these (Will-o'-the-Fen). */
  emberBite?: readonly StatusLay[];
  /** Raised by a singer, or a Mirrored copy: no loot, no XP, never raised again. */
  raised?: boolean;
  mirror?: boolean;
  /** Its trail's next mark (a passive trail), and where it last laid one. */
  trailT?: number; trailAt?: { x: number; y: number };
  /** The pack aura it carries (a bearer) and the one blessing it now (at its level, from whom). */
  aura?: PackAuraId | null;
  bless?: { id: PackAuraId; L: number; by: Mob; fx: PackAuraFx } | null;
  /** Stripped (Unmaking, Strip, Banish): seconds before its pack aura comes back. */
  auraOffT?: number;
  /** A pulse aura's next pulse. */
  pulseT?: number;
  /** Brutal: its blows since the last heavy one. */
  blows?: number;
  /** The Ashsinger has raised one (its Fanaticism wakes). */
  raisedOne?: boolean;
  /** Grave-called: its call is spent. */
  graveCalled?: boolean;
  // ── Protocol 10 (the room's statuses; play/world/room-status.ts) ──
  /** Taunted by this Keeper (the room's id): it turns on that one. Feared away from this spot. */
  tauntBy?: string;
  fearFrom?: { x: number; y: number };
  /** A slow laid on it (Firebreak, a Hearth Circle's ground, as the room carries them): seconds left and the share. */
  slowT?: number;
  slowPct?: number;
  /** Whose burn and whose bleed it carries (the room: each tick is that Keeper's blow, charged to its budget). */
  scorchBy?: string;
  bleedBy?: string;
}

/** S6: a creature's ability state on the wire (CoopMobState.fl's high bits; td-coop and room-world stateOf). */
export function abilityFlags(m: Mob): number {
  return (m.tell > 0 && m.abCast === 0 ? FL_AB0 : 0) | (m.tell > 0 && m.abCast === 1 ? FL_AB1 : 0) | ((m.hidden ?? 0) > 0 ? FL_HIDDEN : 0) | ((m.ward ?? 0) > 0 ? FL_WARDED : 0) | ((m.auraOffT ?? 0) > 0 ? FL_AURA_OFF : 0);
}
/** A member reads them back (td-coop mirror): the ability telling, underground, warded, its aura stripped. */
export function mirrorAbilityFlags(m: Mob, fl: number): void {
  const ab = m.tell > 0 ? (fl & FL_AB0 ? 0 : fl & FL_AB1 ? 1 : undefined) : undefined;
  m.abCast = ab;
  if (ab !== undefined) { const a = castable(m.def.id)[ab]; if (a?.words) { m.chantT = Math.max(m.chantT ?? 0, .3); m.chantText = a.words; } }
  m.hidden = fl & FL_HIDDEN ? 1 : 0;
  m.ward = fl & FL_WARDED ? 1 : 0;
  m.auraOffT = fl & FL_AURA_OFF ? 1 : 0;
}
/** A patch of hostile ground on the wire (CoopEvent 'field'). */
export function fieldEvent(h: Hazard): { k: 'field'; x: number; y: number; r: number; t: number; tn: string; st?: string } {
  return { k: 'field', x: Math.round(h.x), y: Math.round(h.y), r: Math.max(1, Math.min(200, Math.round(h.r))), t: Math.max(0, Math.min(30, Math.round(h.t * 10) / 10)), tn: h.tone, ...(h.st ? { st: h.st } : {}) };
}
/**
 * The life a pack's heal is a share of (Prayer, Moss Mending, Redemption): an elite's ordinary self, not its rank's
 * many lives (tuned on combat-sim: a unique leader at ×9 mending 2.8% of all of it a second never fell).
 */
export function healBase(m: Mob): number { return m.elite && m.elite.role !== 'minion' ? m.def.hp / TD_RANK_HP[m.elite.rank] : m.def.hp; }
/** A pack's root key: a leader's key, its followers' `<key>~<gen>e<i>`. */
export function packRoot(key: string): string { const i = key.indexOf('~'); return i < 0 ? key : key.slice(0, i); }
/** The aura a creature carries now: its fixed one, else an Aura Enchanted leader's (td-elites auraAffix). */
export function bearerAura(m: Mob, levelId: string): PackAuraId | null {
  if ((m.auraOffT ?? 0) > 0 || m.hp <= 0) return null;
  const fixed = fixedAura(m.def.id, levelId, !!m.raisedOne);
  if (fixed) return fixed;
  return m.elite && m.elite.role === 'leader' ? auraAffix(m.elite.affixes) : null;
}
/** Is `m` of `bearer`'s own pack (its elite pack, or for a fixed bearer with none, its family round it)? */
export function samePack(bearer: Mob, m: Mob): boolean {
  if (m === bearer) return true;
  if (bearer.elite) return !!m.elite && packRoot(m.key) === packRoot(bearer.key);
  return !m.elite && creatureProfile(m.def.id).family === creatureProfile(bearer.def.id).family;
}

/**
 * A construct (the Hammer of the First Watch hits these harder): the riveted and the glass — the maw and prism
 * families (creature-families.ts: the Seamworks' maws, the bailiffs, the Anvil-Warden, the Glass Sentinel) and the
 * golems.
 */
export function isConstruct(creature: string): boolean {
  if (/golem/.test(creature)) return true;
  const f = creatureProfile(creature).family;
  return f === 'maw' || f === 'prism';
}

/** Fire Enchanted's last word: a burst of fire where it fell, `t` seconds after (the ground shows the ring meanwhile). */
export interface DeathBurst {
  x: number; y: number; t: number; r: number; dmg: number;
  /** A boss's ground warning (the Seam Eater's Rend): its whole tell (FIRE_BURST.delay when unset), its tone and type. */
  delay?: number; el?: 'ember' | 'shadow' | TellTone | 'raise'; type?: DamageType;
  /** The level of the creature it came from (td-zones level gap); unset: none. */
  lv?: number;
  /**
   * S6 (td-abilities): a creature's ability ring — who cast it (an interrupt takes it back; a pull leans toward it),
   * the statuses it lays on a Keeper it catches (td-abilities encodeStatus), a pull (+) or push (−) in tiles, the ground
   * it leaves (fire ground, a web, a cloud), its tell's tones; `fx`: a picture only (a raise's sigil), it strikes nothing.
   */
  by?: Mob; st?: string; pull?: number; tone?: TellTone; fx?: boolean;
  after?: { r: number; t: number; dps: number; st?: KeeperStatus; tone: TellTone };
}

/** S6: a lasting patch of hostile ground (fire ground, crust, an ink trail, a web, a spore cloud). */
export interface Hazard { x: number; y: number; r: number; t: number; life: number; dps: number; st?: KeeperStatus; tone: TellTone; tick: number; lv?: number; type?: DamageType; by?: Mob }

/**
 * A boss's tell (docs/design/effects-spec.md, fourth pass): the seconds between the wind-up showing on the ground and
 * the breath leaving the jaws, aimed where the prey stood when it began — a step aside in that time and it misses.
 * Summons get the same: a sigil where each will stand, for CALL_TELL seconds before it climbs out.
 */
export const BOSS_TELL = .6;
export const CALL_TELL = .6;
/** How long a spoken line (the Keeper's spell words, a boss's chant) hangs in the air. */
export const CHANT_SECS = 1.2;
/** Does this creature wind up before it shoots? Bosses with a ranged attack (the Ashbone Dragon, the Cinder Sovereign). */
export function windsUp(def: MobDef): boolean { return def.rank === 'boss' && !!def.ranged; }
/** A summons on its way: the sigil on the ground where it will stand, `t` seconds before it does. */
export interface Call { x: number; y: number; type: string; key: string; t: number; touched?: boolean; /** Called up by a personal creature (Mob.personal): it is personal too. */ personal?: boolean; /** The level it comes at (td-zones callLevel). */ level?: number; /** S6 raise: who sings it up (an interrupt takes it back), the corpse it rises from, the share of life it rises with. */ by?: Mob; corpse?: string; pct?: number }

/** A shot a creature looses (a bone arrow, a fire bolt, a breath): it flies straight; stepping aside dodges it. */
export interface MobShot extends Lofted { x: number; y: number; vx: number; vy: number; dmg: number; age: number; life: number; kind: 'arrow' | 'fire' | 'breath' | 'ink' | 'shard' | 'spore'; type?: DamageType; /** Its shooter's level (td-zones level gap). */ lv?: number; /** An elite's affixes riding the shot (Mana Burn, Cursed). */ burn?: boolean; curse?: boolean; /** S6: statuses it lays (td-abilities encodeStatus). */ st?: string }

/**
 * A shot's height over the ground it flies above (art px): `lift` where it left the hand, `land` where it was aimed,
 * `reach` the ground between. Its ground track — what a wall stops (td-sight) — is its picture's y plus the height at
 * how far it has flown. Unset: 12 px all the way (a creature's shot at a Keeper's chest).
 */
export interface Lofted { lift?: number; land?: number; reach?: number }
/** The ground under a lofted shot at (x, y), `flown` art px from where it left. */
export function groundY(s: Lofted, y: number, flown: number): number {
  const a = s.lift ?? 12, b = s.land ?? a, k = s.reach && s.reach > 0 ? Math.min(1, flown / s.reach) : 1;
  return y + a + (b - a) * k;
}

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
  /** td-roam: its stroll while the Keeper stands still. */
  roam?: RoamState;
  /** The Ashbone Phylactery: its first blow (a breath of fire) is spent. */
  breathed?: boolean;
  /** Captain of the Dead (a mark): the one raised twice as strong, and seconds to its next taunt. */
  captain?: boolean;
  tauntCd?: number;
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
/**
 * The foe a raised skeleton goes for: the nearest within its sight that is also within the leash of the Keeper — and,
 * given `sees`, one it can see (td-sight: never one behind a wall).
 */
export function pickMinionTarget(from: { x: number; y: number }, mobs: readonly Mob[], keeper: { x: number; y: number }, sight: number, leash: number, sees?: (m: Mob) => boolean): Mob | null {
  let best: Mob | null = null, bd = sight;
  for (const m of mobs) {
    if (m.hp <= 0 || Math.hypot(m.x - keeper.x, m.y - keeper.y) > leash) continue;
    const d = Math.hypot(m.x - from.x, m.y - from.y);
    if (d <= bd && (!sees || sees(m))) { bd = d; best = m; }
  }
  return best;
}

/** A Bone Spear in flight: it passes through every foe in its line, striking each once. */
export interface Spear extends Lofted {
  x: number; y: number; vx: number; vy: number; age: number; life: number; hit: Mob[]; dmg?: [number, number];
  /** The skill that loosed it (the marks read it: Bone Spear's, Bone Storm's, a Corpse Burst's shards). */
  src?: SkillId;
  /** Return of the Bone (a mark): this share of a blow when it has flown its length and comes back (once). */
  back?: number;
}

/**
 * A spell left on the ground (the trees' new fire): Cinder Rain falling on a circle, a Flame Wall burning along a line,
 * a Meteor on its way down. `t` is the seconds it still lasts (a meteor's: until it lands).
 */
export interface Zone {
  kind: 'rain' | 'wall' | 'meteor' | 'whirl'
    // The Lanternwright (td-lantern-skills): a Hearth Circle on the ground, a disc of Dawn at Noon.
    | 'hearth' | 'dawn'
    // The Thornstrider (td-thorn-skills): a Thornroot Snare's line of thorns, a Bramble Trap hidden on the ground.
    | 'snare' | 'trap'
    // A mark's burning ground (td-marks `field`): fire a second, at a share of the hit that laid it.
    | 'field';
  x: number; y: number;
  /** Radius (art px): the rain's circle, the meteor's blast; a wall's reach either side of its line. */
  r: number;
  t: number;
  tick: number;
  min: number; max: number;
  /** A wall's line, one point a tile. */
  pts?: { x: number; y: number }[];
  /** A Thornroot Snare's catch: each creature it has rooted (it holds each once). */
  caught?: Mob[];
  /** The skill that laid it, when its kind does not say (a mark's burning ground: Scorched Earth, Burning Crater). */
  src?: SkillId;
  /** A meteor's fragment (Splitting Stone) does not split again, nor leave a second crater. */
  frag?: boolean;
  /** Seconds to the snare's next grasp (Grasping, a mark). */
  regrasp?: number;
}

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
  /** The corpse it lies beside (td-corpse.ts): the corpse window lists the drops that carry its id. */
  corpse?: string;
  /**
   * The room's ground (protocol 7, play/social/world-protocol.ts): the room rolled it and owns it. Never taken by
   * walking over it alone — a pick asks the room (onRoomTake), which hands it to the first Keeper allowed to have it.
   * `hold`: seconds before this Keeper may take it (another Keeper's kill, still theirs); `wait`: after a refusal.
   */
  room?: { hold: number; wait: number };
}

export interface Floater { x: number; y: number; text: string; color: string; age: number }

/** A short-lived picture in the world: a slash, a fire ring, a heal, wood chips, haste dust. */
export interface Effect {
  kind: 'slash' | 'wave' | 'heal' | 'chips' | 'dust' | 'drain' | 'curse' | 'ward' | 'bolt-hit' | 'raise' | 'spark'
    // The effects pass (docs/design/effects-spec.md): an aura's pulse at a foe's side, a crit's white-hot core,
    // the Bone Spear's release flash and the bone chips at each pierce.
    | 'pulse' | 'crit' | 'flash' | 'bone-chips'
    // A level gained (docs/design/leveling.md §4): the light pillar on the Keeper; `dir` 2 for a big milestone.
    | 'pillar'
    // The trees (docs/design/skill-trees.md): a falling cinder, a flame tongue of a wall, a meteor coming down.
    | 'cinder' | 'flame' | 'meteor'
    // The Ashguard (td-ashguard-fx.ts): a blade's arc, the brand catching, a bash, an oath, a cry, a stride, a vow.
    | 'arc' | 'brand' | 'bash' | 'oath' | 'cry' | 'stride' | 'vow'
    // The Lanternwright (td-lantern-fx.ts): a flare landing, the flash, Banish's column, a heal's glow, the ward's frame
    // and its break, a wisp called, a beacon planted, the dawn rising, the shutters, Last Light.
    | 'kindle-hit' | 'lamp-flash' | 'banish' | 'hearthglow' | 'lward' | 'lward-break' | 'wisp-call' | 'beacon-plant' | 'dawn-rise' | 'shutter' | 'lastlight'
    // The Thornstrider (td-thorn-fx.ts): an arrow striking, a barb's blood, the bow's twang, Command's mark, a beast
    // called, the stampede's dust, thorns breaking the ground, a trap set and sprung, Rootwalk's moss.
    | 'arrow-hit' | 'bleed' | 'loose' | 'command' | 'wild-call' | 'trample' | 'snare-rise' | 'trap-set' | 'trap-spring' | 'rootwalk'
    // Sight (td-sight.ts): a shot breaking on a wall — a puff of grit in the shot's own colour (`el`).
    | 'puff';
  x: number; y: number; age: number; life: number; dir: number; tx?: number; ty?: number;
  /** A pulse's or a wave's element: the aura or spell that did the work (a wave is ember unless it says). */
  el?: 'ember' | 'life' | 'shadow' | 'bone' | 'brass' | 'lamp';
  /** A blade's arc: where it aims (radians) and how wide it sweeps (degrees). */
  a?: number;
  w?: number;
  /** A wave's radius (art px); the Nova's own when absent. */
  r?: number;
}

/** A bolt in flight toward a creature. */
export interface Bolt { x: number; y: number; to: Mob; dmg: number; age: number; lamp?: boolean; /** Its height over its ground track (art px; 22, the staff's tip, when unset): a wall stops the track. */ lift?: number; /** The skill that sent it (Ember Bolt, Kindle, a wisp's or a beacon's mote), and a mark's heal on landing (Kindling Light, % of the hit). */ src?: SkillId; heal?: number }

/** A lamp-wisp at the Lanternwright's shoulder (td-lantern-skills): seconds left, its next mote, where it circles. */
export interface Wisp { x: number; y: number; t: number; cd: number; a: number; /** Lantern Swarm (a mark): this wisp's motes at this share. Wisp Ward: it still holds a shot off. */ k?: number; ward?: boolean }
/** A Beacon on its pole: where it stands, seconds left, its next mote. */
export interface Beacon { x: number; y: number; t: number; cd: number }

/**
 * A Thornstrider's arrow in flight (td-thorn-skills): it seeks its foe until the first strike, then flies straight on;
 * every foe in its line it strikes once — the first always, each further one only on a pierce. `barb`: a Barbed Shot's
 * bleed rides on it.
 */
export interface Arrow extends Lofted {
  x: number; y: number; vx: number; vy: number; age: number; life: number; dmg: number;
  to: Mob | null; hit: Mob[]; pierce: number; knock: number; barb?: { dps: number; secs: number };
  /** The skill that loosed it; a mark's sure crit (Hunter's Rhythm, Leaf-Shadow); the most foes it may strike (a Volley's Pierce). */
  src?: SkillId; crit?: boolean; most?: number;
}
/**
 * A beast of the wild (td-thorn-skills): one answering the Call of the Wilds (it hunts by the Keeper, `t` seconds), or
 * one of a Stampede (it charges along its line, striking each foe once, and is gone at the line's end).
 */
export interface WildBeast {
  kind: 'called' | 'stampede';
  x: number; y: number; t: number; cd: number; face: 1 | -1; age: number;
  dmg: [number, number];
  target: Mob | null;
  /** td-roam: its stroll while the Keeper stands still. */
  roam?: RoamState;
  /** A stampede's run: its step a second, how far it still goes, the foes it has trampled, its knock (px). */
  vx?: number; vy?: number; left?: number; hit?: Mob[]; knock?: number;
}


/** The ladder's colours on the ground (labels, the name that floats up on pick-up): the `--cozy-loot-*` tokens via td-fx. */
export const RARITY_COLOR: Readonly<Record<LootRarity, string>> = {
  common: LOOT.common.body, uncommon: LOOT.uncommon.body, rare: LOOT.rare.body, epic: LOOT.epic.body,
  legendary: LOOT.legendary.body, mythic: LOOT.mythic.body, singular: LOOT.singular.body,
};

const REACH = 24;          // the Keeper's swing
/** A Thornstrider's arrow's flight (art px a second), a stampede's run, a called beast's trot and its bite's rest. */
const ARROW_SPEED = 300;
const STAMPEDE_SPEED = 230;
const BEAST_SPEED = 92;
const BEAST_REST = 1.1;
/** Dawn at Noon: % more every hit lands for on a creature the daylight has unveiled. */
export const DAWN_REVEAL = 15;
const MOB_REACH = 18;      // a creature's bite
/** A gap-closer's blow lands on what stands this close to where it comes down (art px). */
export const CHARGE_HIT = 22;
/** How far ahead of a moving Keeper a gap-closer aims, at most (art px). */
export const CHARGE_LEAD = 72;
const RESPAWN = 75;        // seconds until a spawn comes back
const DESPAWN = 300;       // seconds a drop lies on the ground
const CORPSE_SECS = 20;
/** How near the Keeper a worn aura reaches (art px): 4 tiles, the skill auras' size (the Loot sheet says "near you"). */
export const ITEM_AURA_REACH = 4 * TILE;    // a kill's corpse stays fresh for Raise Skeleton this long
const MINION_SIGHT = 6 * TILE;
const MINION_LEASH = 9 * TILE;
const MINION_SPEED = 52;
const SPEAR_SPEED = 280;
/** Seconds a creature keeps after its prey once a wall has hidden it (td-sight): it goes where it last saw it. */
export const CHASE_MEMORY = 3;
/** How much nearer than he is a raised skeleton counts for a creature choosing its prey (art px): they fight in its face. */
const MINION_DRAW = 6;
/** The soft push between creatures (art px a second): a pack stays a pack, not one sprite. */
const CROWD_PUSH = 30;
/** …and between the Keeper's raised and called (they are lighter on their feet). */
const KIN_PUSH = 70;

/** What the mob system needs from the engine. */
export interface MobHost {
  readonly options: EngineOptions;
  walkable(c: number, r: number): boolean;
  levelId(): string;
  player(): { x: number; y: number; face?: number };
  hurtPlayer(n: number): void;
  /**
   * Protocol 10: the room keeps this Keeper's life (td-engine's LifeMirror). A room's blow is cut by the room as `cut`;
   * `land` runs the screen's own (its wards and blocks): the host claims the difference.
   */
  lifeBite?(cut: number, land: () => void): void;
  healPlayer(n: number): void;
  /** Can a floating creature drift over this tile (floor, lava, embers)? Default: walkable. */
  hover?(c: number, r: number): boolean;
  /** Does a shot fly over this tile (not into a wall)? Default: walkable. */
  passable?(c: number, r: number): boolean;
  /**
   * Is this tile solid to sight and to shots (td-sight.ts): a wall, rock, a stall, a tree, a shut door — not the low
   * water a shot flies over? Default: not passable (or, without that, not walkable).
   */
  sight?(c: number, r: number): boolean;
  /** The Keeper's life now (Life Tap will not spend the last of it). */
  playerHp?(): number;
  /** The Keeper swung (an attack or an ability): the host plays the swing toward `at`. */
  swung(at: { x: number; y: number } | null): void;
  /** Is (x, y) a town or a safe square (no elite pack ever spawns there)? Default: nowhere is. */
  safeAt?(x: number, y: number): boolean;
  /**
   * Lumvesh, the Seek (design-bible §5.5): the host finds what to point at and shows the arrow for `secs` seconds.
   * False when there is nothing to seek (the spell is not spent). Absent: nothing can be sought.
   */
  seek?(secs: number): boolean;
  /** The Waygate (td-waygate.ts): the host opens a town portal standing `secs` where the Keeper is; why not, or null. */
  waygate?(secs: number): 'waytown' | 'wayboss' | 'wayseam' | null;
  /** Ash Stride: carry the Keeper toward (x, y), stopping at the last open step. Absent: he stays where he is. */
  dash?(x: number, y: number): void;
  /** A line on the message strip (an i18n key): the lantern shuttered or opened, Last Light catching a fall. */
  say?(key: string): void;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
/** An ability ring's tone as a wave's element (td-engine's ground waves know five). */
function waveEl(el: string | undefined): NonNullable<Effect['el']> {
  switch (el) {
    case 'shadow': case 'ink': return 'shadow';
    case 'frost': case 'water': return 'shadow';
    case 'life': case 'moss': return 'life';
    case 'bone': case 'glass': case 'dust': case 'parchment': return 'bone';
    default: return 'ember';
  }
}
/** A creature's passive abilities that ride its bite (Scrape's bleed). */
const ABIL_PASSIVE = (id: string) => abilitiesOf(id).filter(a => a.kind === 'passive' && a.st);
const ABIL_PASSIVE_ID = (id: string, ab: string) => abilitiesOf(id).some(a => a.id === ab);
/** A point's distance from a segment (Through the Ranks: what stood on the charge's path). */
function segDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
/** The numbers an echo's free cast carries at its share (td-marks `echo`): damage, heal, absorb. */
const ECHO_VARS = ['min', 'max', 'dps', 'heal', 'absorb'] as const;
/** How much a Chill slows a creature's feet and its blows (skills-100.md §0.4: −30%). */
export const CHILL_SLOW = .3;
/** The share of a Blinded creature's blows and shots that go astray (§0.4). */
export const BLIND_MISS = .5;
/** Captain of the Dead's taunt reaches this many tiles (skill-book-stand-ins.md). */
export const CAPTAIN_REACH = 4;
/** Under this pace (art px a second) the Keeper counts as standing still (Kept Fire, a mark). */
const STILL_PACE = 6;

/** A creature as it rises on a difficulty tier: life × `hp`, its blow and its shot × `damage` (Normal: itself). */
export function tiered(def: MobDef, t: Pick<DifficultyDef, 'hp' | 'damage'>): MobDef {
  if (t.hp === 1 && t.damage === 1) return def;
  const k = (r: readonly [number, number]): [number, number] => [Math.max(1, Math.round(r[0] * t.damage)), Math.max(1, Math.round(r[1] * t.damage))];
  return {
    ...def, hp: Math.max(1, Math.round(def.hp * t.hp)), dmg: def.dmg[1] > 0 ? k(def.dmg) : def.dmg,
    ...(def.ranged ? { ranged: { ...def.ranged, dmg: k(def.ranged.dmg) } } : {}),
    ...(def.rend ? { rend: { ...def.rend, dmg: k(def.rend.dmg) } } : {}),
    ...(def.charge ? { charge: { ...def.charge, dmg: k(def.charge.dmg) } } : {}),
  };
}

/** The Gold pile a creature leaves (economy-curve HUNT_GOLD): its level and rank, ± the spread. */
export function goldDropFor(def: Pick<MobDef, 'level' | 'rank'>, rng: () => number = Math.random): number {
  return rollHuntGold(def.level, def.rank ?? 'normal', rng);
}

/**
 * Shared creatures (protocol 4; td-coop.ts owns the wire). On the host the mob system tells the link when a creature
 * strikes another member and when one falls; on a member (`replica`) every blow it lands on a host's creature becomes
 * a claim instead of damage.
 */
export interface CoopLink {
  /** `st` (S6): statuses the blow lays (td-abilities encodeStatus), and a pull/push toward its caster. */
  bite(to: string, from: Mob | null, dmg: number, type: DamageType, burn: boolean, curse: boolean, st?: string): void;
  killed(m: Mob, by: string[]): void;
  claim(m: Mob, dmg: number, crit: boolean, color: string): void;
  /** Protocol 10: a status this Keeper laid on a shared creature that the timers do not show (a pull, a strip). */
  laid?(m: Mob, kind: 'pull' | 'strip', secs: number, src: SkillId | null, tiles?: number): void;
}
/** Another member of the party in the host's area, as prey (where the room last said it stands). */
export interface CoopKeeper { id: string; x: number; y: number }

export class MobSystem {
  readonly mobs: Mob[] = [];
  // ── Shared creatures (protocol 4) ──
  /** The co-op link (td-coop.ts): set while this Keeper hosts or shares an area; null alone. */
  coop: CoopLink | null = null;
  /** A member under a host: the creatures are the host's (no AI, no bites here; blows become claims). */
  replica = false;
  /** On the host: the party's other Keepers in this area; the creatures hunt them as they hunt this one. */
  others: readonly CoopKeeper[] = [];
  /** The host is in a menu (its world keeps running for the others): its creatures neither hunt nor strike it. */
  selfAway = false;
  /**
   * The room-run world (protocol 7, play/world/room-world.ts): the room has no Keeper of its own, so a kill it never
   * fought itself still rolls its loot here — once, for everyone (the room owns that ground).
   */
  roomLoot = false;
  /**
   * Protocol 10: the room ticks the burns and bleeds on its creatures (room-status.ts) — a member's screen shows them
   * but claims no tick of its own. `dotGate` (the room): each tick, charged to the Keeper's claim budget.
   */
  roomTicks = false;
  dotGate: ((from: string, dmg: number) => number) | null = null;
  /** The skill cast last (a status the timers show is claimed from it when it can lay it: statusSkill). */
  lastCast: SkillId | null = null;
  /** Whose blow is landing now (applyClaim: a member's id; '' for this Keeper's own). */
  private claimFrom = '';
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
  /** What the fallen leave behind (td-corpse.ts): rotting where they lay, at most CORPSE_CAP. */
  readonly remains: Corpse[] = [];
  private remainsSeq = 0;
  /** Spells lying on the ground (Cinder Rain, Flame Wall, a Meteor coming down). */
  readonly zones: Zone[] = [];
  /** The Lanternwright's kin: the wisps at his shoulder (they follow him anywhere) and a beacon on its pole (its place's). */
  readonly wisps: Wisp[] = [];
  readonly beacons: Beacon[] = [];
  /** The Thornstrider's arrows in flight, and the beasts of the wild running with him (called, or a stampede). */
  readonly arrows: Arrow[] = [];
  readonly beasts: WildBeast[] = [];
  private minionSeq = 0;
  /**
   * The ranks the trees give (docs/design/skill-trees.md); null = every skill at rank 1 (the specs, and the moments
   * before the HUD hands the trees in). A skill at rank 0 does nothing: an active refuses, an aura and a passive rest.
   */
  private ranks: Partial<Record<SkillId, number>> | null = null;
  private readonly varsAt = new Map<SkillId, Record<string, number>>();
  /** The points bought in each skill (td-tree boughtRanks): the synergies read these (design-bible §4.1); null = none. */
  private bought: Partial<Record<SkillId, number>> | null = null;
  /** The Skill Book's marks a row holds (td-tree effectiveMarks: a 6-bit mask a row); null = none (the specs' default). */
  private marks: Partial<Record<SkillId, number>> | null = null;
  setRanks(ranks: Partial<Record<SkillId, number>> | null, bought: Partial<Record<SkillId, number>> | null = null, marks: Partial<Record<SkillId, number>> | null = null): void {
    this.ranks = ranks ? { ...ranks } : null; this.bought = bought ? { ...bought } : null; this.marks = marks ? { ...marks } : null; this.varsAt.clear();
  }
  /** A row's marks now. A Spellstone going off carries ITS OWN marks (recorded when it was cut, S2), never the book's. */
  markMask(id: SkillId): number { return this.stone?.id === id ? this.stone.marks : this.marks?.[id] ?? 0; }
  /** A named mark rule a row holds, with its numbers (td-marks), or null — only while the row holds a rank. */
  mk(id: SkillId, f: MarkFlag): Extract<MarkFx, { k: 'flag' }> | null {
    const m = this.markMask(id);
    return m && this.rank(id) > 0 ? markFlag(id, m, f) : null;
  }
  /** A skill's mana cost now (its marks' % in: td-skills manaCost). */
  manaOf(id: SkillId): number { return manaCost(id, this.markMask(id)); }
  /**
   * A cast's echo (td-marks `echo`: Twin Nova, Twin Impact, Rolling Volley…): the share every damage and heal number
   * carries while a free second cast runs (1 = a cast of its own). `src`: the skill whose hit is landing now (its
   * marks' riders and rules read it); `killSrc`: the one whose blow felled the creature now falling.
   */
  private echoK = 1;
  private src: SkillId | null = null;
  private killSrc: SkillId | null = null;
  /** Echoes waiting: the skill, seconds to go, the share they cast at, and how many more after this one. */
  private readonly echoes: { id: SkillId; t: number; k: number; left: number; gap: number }[] = [];
  /** A skill's rank: the tree's, plus what worn boss uniques add to a skill already learnt (never past MAX_RANK). */
  rank(id: SkillId): number {
    // A Spellstone going off (useStone): the spell at the stone's own rank, whatever the trees hold.
    if (this.stone?.id === id) return this.stone.rank;
    return castRank(id, this.ranks ? Math.max(0, this.ranks[id] ?? 0) : 1, this.relics, this.gearRanks);
  }
  /** A caster's worn +Spells (td-skills fightStats ranks): every learnt spell casts that many ranks higher. */
  private gearRanksN = 0;
  get gearRanks(): number { return this.gearRanksN; }
  set gearRanks(n: number) { const k = Math.max(0, Math.floor(n) || 0); if (k !== this.gearRanksN) { this.gearRanksN = k; this.varsAt.clear(); } }
  /**
   * The worn boss uniques' signatures (shared/rpg/boss-uniques.ts relicTotals; the host hands them in): extra ranks,
   * a shorter Meteor, harder hits on constructs, more skeletons, more fire, ink, smoulder, more spears, more light.
   */
  relics: RelicTotals = NO_RELICS;
  setRelics(r: RelicTotals): void { this.relics = r; this.varsAt.clear(); }
  /** Hits the Keeper has landed (hitFoe), for a worn unique's echo ("every third hit lands harder"). */
  private hitCount = 0;
  /** Seconds until a worn unique's mercy can spare the Keeper again (0: ready). */
  mercyT = 0;
  /**
   * The difficulty tier (shared/loot/difficulty.model; the host hands it in): every creature that rises from now on
   * has its life × `hp` and its blows and shots × `damage` (an elite's own numbers first, then the tier's). The resist
   * penalty is the Keeper's side (td-skills fightStats). Normal: × 1.
   */
  tier: Pick<DifficultyDef, 'id' | 'hp' | 'damage'> = DIFFICULTIES.normal;
  setTier(t: Pick<DifficultyDef, 'id' | 'hp' | 'damage'>): void { this.tier = t; }
  /**
   * The aura a worn Socket Word or named unique grants (shared/loot/auras; the Loot sheet picks which one runs), as
   * the top-down fight carries it out: Might lifts every hit; Conviction strips resistance off foes near the Keeper
   * (they have none to spare, so each point is a point more damage, D2's negative resist); Redemption heals on a death
   * near him; the Holy auras pulse every AURA_PULSE seconds on everything near (Freeze slows it too); Fanaticism
   * quickens the basic attack; Prayer heals each second; Vigor quickens the feet (td-engine walkSpeed).
   */
  itemAura: { id: AuraId; level: number; fx: AuraEffect } | null = null;
  setItemAura(a: { id: AuraId; level: number } | null): void { this.itemAura = a ? { id: a.id, level: a.level, fx: auraEffect(a.id, a.level) } : null; }
  private itemAuraT = 0;
  private prayerOwed = 0;
  /** Fanaticism's quicker basic attack (1 without it). */
  get fanaticism(): number { return this.itemAura?.fx.attackSpeed ?? 1; }
  /** Is a creature inside the worn aura's reach? */
  private inItemAura(m: { x: number; y: number }): boolean { const p = this.host.player(); return !!this.itemAura && Math.hypot(m.x - p.x, m.y - p.y) <= ITEM_AURA_REACH; }
  /** A spell's cooldown now (before cast speed): its own, less what a boss unique cuts from it. */
  cdOf(id: SkillId): number { return castCd(id, this.relics, this.markMask(id)); }
  /** The Light spell: seconds it still burns, and how many tiles it adds to the Keeper's light. */
  lightT = 0;
  lightTiles = 0;
  /**
   * Tiles the Keeper's own light reaches past its usual: the Light spell while it burns, the worn uniques', and the
   * Lanternwright's lantern and its aura unless the shutters are closed (td-lantern carriedLight).
   */
  get lightBonus(): number {
    const aura = this.lamp && this.aura === 'lantern-aura' && this.rank('lantern-aura') > 0 ? this.v('lantern-aura')['light'] : 0;
    const tiles = carriedLight({ vocation: this.vocation, shuttered: this.shuttered, aura, spell: this.lightT > 0 ? this.lightTiles : 0, relics: this.relics.light });
    // Kept Ember (a mark): shuttered, his light never falls under its tiles.
    const ke = this.lamp && this.shuttered ? this.mk('shutter-lantern', 'keptLight') : null;
    return ke ? Math.max(tiles, ke.n ?? 0) : tiles;
  }
  /** A skill's numbers at its rank. */
  v(id: SkillId): Record<string, number> {
    let got = this.varsAt.get(id);
    if (!got) {
      // The card's numbers exactly (td-skills castVars: rank, synergies, what worn gear adds), then the sky's hand.
      got = castVars(id, this.rank(id), this.bought, this.relics, this.markMask(id));
      // The sky's hand on the spell (td-phases.ts): Shadow stronger after dark and under an eclipse, Ember by day.
      const k = spellMult(SKILLS[id].tree, this.phase);
      if (k !== 1) {
        got = { ...got };
        // Damage (and the Hearth's heal) by the sky's hand: whole blows stay whole, a rate keeps a tenth.
        for (const key of skyVars(SKILLS[id].tree)) if (key in got) got[key] = key === 'dps' || key === 'heal' || key === 'regen' ? Math.round(got[key] * k * 10) / 10 : Math.max(1, Math.round(got[key] * k));
      }
      this.varsAt.set(id, got);
    }
    // An echo's free cast: every damage and heal number at its share (never cached).
    if (this.echoK !== 1) {
      const out = { ...got };
      for (const key of ECHO_VARS) if (key in out) out[key] = Math.max(1, Math.round(out[key] * this.echoK));
      return out;
    }
    return got;
  }
  /**
   * The world clock as a rule (td-phases.ts): the sky's phase, and whether the Keeper stands under it (the surface) —
   * spell strength follows the sky everywhere, the spawn rules only in the open wilds.
   */
  phase: SkyPhase = 'day';
  /** The Hush's boon (td-dark.ts hushBoon): Magic Find points on the loot roll and a Hunting XP multiplier. */
  darkBoon: { mf: number; xp: number } = { mf: 0, xp: 1 };
  open = false;
  setPhase(phase: SkyPhase, open: boolean): void {
    if (phase !== this.phase) this.varsAt.clear();
    this.phase = phase; this.open = open;
  }
  /** The spawn rules in force here and now (the open wilds only; day's under a roof). */
  private get wildRules() { return rulesOf(this.open ? this.phase : 'day'); }
  /**
   * Weather v1 (shared/weather): rain falls on the open land where the Keeper stands (td-engine sets it). A chill laid on a
   * creature standing in it freezes it a moment (the Wet rule; bosses take Wet in full).
   */
  weatherWet = false;
  /** Ember Mastery: what fire's damage is multiplied by. */
  get fireMult(): number {
    // Hearth-Heat (the Aura of Embers' mark): while the aura runs, all his fire burns hotter.
    const hh = this.aura === 'aura-embers' ? this.mk('aura-embers', 'fireUp') : null;
    // Wet: fire dealt by the Wet burns 15% lower (the Ashguard's Ember Brand, the Warlock's embers in the rain).
    const wet = this.kst.wet > 0 ? WET.fireDealt : 1;
    return (this.rank('ember-mastery') > 0 ? 1 + this.v('ember-mastery')['pct'] / 100 : 1) * (1 + this.relics.fire / 100) * (hh ? 1 + (hh.n ?? 0) / 100 : 1) * wet;
  }
  /**
   * The marks' quicker feet (a share of pace; td-engine walkSpeed multiplies by 1 + this): Walking Whirl while the whirl
   * turns, Dark Step while the lantern is shuttered, Waymark by a beacon.
   */
  get markPace(): number {
    if (!this.marks) return 0;
    let k = 0;
    const p = this.host.player();
    const wh = this.mk('whirl-of-cinders', 'whirlHaste');
    if (wh && this.zones.some(z => z.kind === 'whirl')) k += (wh.n ?? 0) / 100;
    const ds = this.lamp && this.shuttered ? this.mk('shutter-lantern', 'shutSpeed') : null;
    if (ds) k += (ds.n ?? 0) / 100;
    const hart = this.calledKind === 'hart' && this.beasts.some(b => b.kind === 'called') ? this.mk('call-of-the-wilds', 'wolfBearHart') : null;
    if (hart) k += (hart.s ?? 0) / 100;
    const wm = this.mk('beacon', 'poleSpeed');
    if (wm && this.beacons.some(b => Math.hypot(b.x - p.x, b.y - p.y) <= (wm.m ?? 0) * TILE)) k += (wm.n ?? 0) / 100;
    return k;
  }
  /** The running aura's ring (art px). */
  get auraRadius(): number { return Math.round((this.aura ? this.v(this.aura)['radius'] ?? 3 : this.v('aura-embers')['radius']) * TILE); }
  /** How much weaker a creature bites (%): the Ember Curse's and Weaken's, the stronger of the two. */
  private weakOf(m: Mob): number {
    // The Lantern Aura: within its reach every bite is weaker (design-bible §4.3: "your light is a place").
    const p = this.host.player(), lit = this.lamp && this.aura === 'lantern-aura' && this.rank('lantern-aura') > 0
      && Math.hypot(m.x - p.x, m.y - p.y) <= this.v('lantern-aura')['radius'] * TILE ? this.v('lantern-aura')['weaken'] : 0;
    // Hold Them (Command's mark): the commanded foe bites weaker while the beast is on it.
    const held = this.thorn && m === this.commanded ? this.mk('command', 'commandWeaken')?.n ?? 0 : 0;
    return Math.max(m.cursed > 0 ? this.v('ember-curse')['weaken'] : 0, (m.weak ?? 0) > 0 ? m.weakPct ?? 0 : 0, lit, held);
  }
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
  /** §3.6 (td-skills fightStats): a fighter's Life Steal share, worn Pierce points (the Thornstrider's), worn Block, and the worn damage % his beast bites by. */
  leech = 0;
  gearPierce = 0;
  gearBlock = 0;
  damagePct = 0;
  defense = 0;
  keeperLevel = 1;
  /** The Keeper's level pace as a factor (1 → 1.6): the raised walk at the Keeper's pace, as the pets do. */
  pace = 1;
  /** Worn resists per element (td-skills fightStats), each already capped at 75. */
  resists: Partial<Record<Element, number>> = {};
  /** The running aura (one at a time, D2), or none. */
  aura: SkillId | null = 'aura-embers';
  /** Dark Ward: damage it still absorbs, seconds left. */
  ward = 0;
  wardT = 0;
  /** Bone Armor: damage it still absorbs (before the ward), seconds left. */
  bone = 0;
  boneT = 0;
  /** Seconds of Haste left (kept for kits that have it). */
  haste = 0;
  /**
   * The Keeper's class (td-ashguard-skills): the Warlock throws the staff's bolt from afar, the Ashguard swings his
   * blade in an arc in front of him. The class's passives and its swing only ever run for that class.
   */
  vocation: Vocation = 'warlock';
  get melee(): boolean { return this.vocation === 'ashguard'; }
  /** The Lanternwright (td-lantern-skills): the lantern's flare at short range, the healing, the light, the kin. */
  get lamp(): boolean { return this.vocation === 'lanternwright'; }
  /** The basic attack reaches this far (art px): the staff's bolt (7 tiles), the Watch Blade's reach, or Kindle's 4 tiles. */
  get range(): number {
    if (this.melee) return this.v('watch-blade')['reach'] * TILE;
    if (this.lamp) return this.v('kindle')['range'] * TILE;
    if (this.thorn) return this.v('thorn-shot')['range'] * TILE;
    // The Warlock's staff: the Ember Bolt's reach (Long Ember, a mark, lengthens it).
    return this.v('ember-bolt')['range'] * TILE;
  }
  /** The Thornstrider (td-thorn-skills): the bow, the beast at his side, the briar on the ground. */
  get thorn(): boolean { return this.vocation === 'thornstrider'; }
  /** Arrows loosed so far (the specs and the e2e count them). */
  loosed = 0;
  /** Command: the foe the beast is sent at, the seconds it stays sent, and how many times it was sent (the engine rouses a tired beast on each new one). */
  commandFoe: Mob | null = null;
  commandT = 0;
  commands = 0;
  /** Where the Keeper's beast stands (the engine hands it in each frame; null: none). Pack Bond reads it. */
  beast: { x: number; y: number } | null = null;
  /** Rootwalk: seconds left, and how much faster the Keeper walks meanwhile (%). */
  rootwalkT = 0;
  rootwalkPct = 0;
  /** The lantern's shutters: closed, its light (and the aura's) is gone and the Light spell is put out (td-lantern). */
  shuttered = false;
  /** Kindle's flares thrown so far (the specs and the e2e count them). */
  flares = 0;
  /** Hearthlight's heal, paid a tick a second. */
  private hot: HealOverTime | null = null;
  /** The Lantern Ward: what it can still drink, and seconds left. */
  lampWard = 0;
  lampWardT = 0;
  /** Last Light: seconds of untouchable left, and seconds until it can catch a fall again. */
  lastLightT = 0;
  lastLightCd = 0;
  private hearthOwed = 0;
  /** The Keeper's most life (the host hands it in with the build): Hold the Line reads his share of it. */
  keeperMaxHp = 100;
  /** Swings of the blade so far (the specs and the e2e count them). */
  swings = 0;
  /** The Ember Brand: seconds the blade still burns. */
  brandT = 0;
  /** The Shield Oath: seconds left and the % of blows it blocks. */
  blockT = 0;
  blockPct = 0;
  /** The Watch Cry's guard: seconds left and the % less every blow lands for. */
  guardT = 0;
  guardPct = 0;
  /** The Vow of the Last Watch: seconds left, and the damage it has held off so far (a share comes back as life). */
  vowT = 0;
  vowTaken = 0;
  /** Fractions of life the Watchfire and Ember Blood owe, paid out whole. */
  private regenOwed = 0;
  private bloodOwed = 0;
  private leechOwed = 0;
  private auraT = 0;
  target: Mob | null = null;
  attacking = false;
  private swing = 0;
  private kills = 0;
  private readonly deadUntil = new Map<string, number>();
  private clock = 0;
  /** Seconds this system has run (the corpses' clock). */
  get age(): number { return this.clock; }
  /**
   * How long a fallen spawn rests before it rises again (seconds). Unset: RESPAWN, as every screen has always had it.
   * The room-run world sets its own (world/respawn.ts: ordinary creatures 60–90 s each, elites longer, a boss about an
   * hour), drawing from its seeded stream.
   */
  respawnOf: ((m: Mob) => number) | null = null;
  /** Time passes with nobody here (a room-run area nobody stands in): the fallen rest on, nothing moves. */
  idle(dt: number): void { if (dt > 0) this.clock += dt; }
  /**
   * Elite packs (td-elites.ts): off until the host turns them on (the engine does; the specs choose), so a fixed spawn
   * list stays exactly itself. `eliteSalt` varies the rolls between sessions; `fallen` counts each spawn's deaths, so a
   * pack re-rolls only once it has been killed.
   */
  elites = false;
  eliteSalt = '';
  /**
   * The level gap and the XP falloff (td-zones.ts LEVEL_GAP, zoneXp): off until the host turns them on (the engine and
   * the combat sim do; a spec chooses), so a spec's creature fights exactly by its numbers against the default Keeper.
   */
  levelGap = false;
  private readonly fallen = new Map<string, number>();
  /** Fire Enchanted bursts on their way, the Cursed mark on the Keeper (seconds), the Cold Aura's slow on his step (0..1). */
  readonly bursts: DeathBurst[] = [];
  curseT = 0;
  chill = 0;

  constructor(private readonly host: MobHost) {}

  // ── Sight (td-sight.ts; owner 2026-10-21: "we shouldn't be able to shoot or dmg them like that") ──
  /** Sight on the tile grid: what stops a ray, a shot, a blow — the host's solid tiles, cached a moment at a time. */
  readonly sight = new TdSight((c, r) => this.host.sight ? this.host.sight(c, r) : this.host.passable ? !this.host.passable(c, r) : !this.host.walkable(c, r));
  /** Can the Keeper see this creature (or point)? No sight: no target, no blow, no spell on it. */
  sees(m: { x: number; y: number }): boolean { const p = this.host.player(); return this.sight.sees(p.x, p.y, m.x, m.y); }
  /** Does something centred at (x, y) reach this creature: open ground under the centre and a clear line to its feet. */
  private reaches(x: number, y: number, m: { x: number; y: number }): boolean { return !this.sight.wallAt(x, y - 1) && this.sight.sees(x, y, m.x, m.y); }
  /**
   * A shot's ground track from (x0, g0) to (x1, g1): the first point of it inside a wall, or null (looked at every 6 px, so
   * nothing quick slips through a tile). The track is read a pixel above the ground, as `reaches` reads feet: a Keeper
   * whose feet rest on a tile seam (y a hair past 400) must not have every flare break on the wall row below him.
   */
  private wallOn(x0: number, g0: number, x1: number, g1: number): { x: number; y: number; k: number } | null {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, g1 - g0) / 6));
    for (let i = 1; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, y = g0 + (g1 - g0) * k; if (this.sight.wallAt(x, y - 1)) return { x, y, k }; }
    return null;
  }
  /** A shot breaking on a wall: a puff of grit at (x, y) (its picture's height), in the shot's colour. */
  private puff(x: number, y: number, el: NonNullable<Effect['el']>): void { this.effects.push({ kind: 'puff', x, y, age: 0, life: .35, dir: 1, el }); }
  /** Shots stopped by a wall so far (the specs and the e2e count them). */
  walled = 0;

  /** Bring the level's spawns to life (those not resting after a death) and drop everything of the last level. */
  enterLevel(spawns: readonly MobSpawn[]): void {
    this.mobs.length = 0; this.drops.length = 0; this.target = null;
    // Shots and the dead belong to the place they were in; the raised follow the Keeper (owner 2026-10-20: "summons
    // should last until they die or we despawn them, they shouldn't die just from travelling") — the leash below sets
    // them down at his side on the new ground.
    this.shots.length = 0; this.spears.length = 0; this.corpses.length = 0; this.remains.length = 0; this.calls.length = 0; this.zones.length = 0; this.bursts.length = 0;
    this.beacons.length = 0; this.arrows.length = 0;
    for (const k of this.minions) { k.target = null; k.x = 1e9; k.y = 1e9; }
    // A called beast follows the Keeper through any door (the leash sets it down at his side); a stampede stays behind.
    for (let i = this.beasts.length - 1; i >= 0; i--) { const b = this.beasts[i]; if (b.kind === 'stampede') this.beasts.splice(i, 1); else { b.target = null; b.x = 1e9; b.y = 1e9; } }
    this.commandFoe = null; this.commandT = 0;
    this.addSpawns(spawns);
  }
  /** Spawns that came into reach (the endless surface hands them over chunk by chunk). */
  addSpawns(spawns: readonly MobSpawn[]): void {
    for (const s of spawns) {
      const base = MOBS[s.type];
      if (!base) continue;
      // The sky's rules (td-phases.ts), in the open wilds only: never in a town's safety, never a boss or champion.
      const phase = this.open ? this.phase : 'day', seed = `${this.eliteSalt}|${this.host.levelId()}|${s.key}|${this.fallen.get(s.key) ?? 0}`;
      const wild = phase !== 'day' && (base.rank ?? 'normal') === 'normal' && !this.host.safeAt?.(s.x, s.y);
      const type = wild ? nightType(s.type, seed, phase) : s.type;
      this.spawnOne({ ...s, type }, wild ? phase : 'day', seed);
      // More of them after dusk: a second creature beside the first, on its own key (it falls and returns on its own).
      if (wild && extraSpawn(seed, phase)) {
        const x = s.x + 14, y = s.y + 8;
        if (this.free(x, y) && !this.host.safeAt?.(x, y)) this.spawnOne({ key: `${s.key}~n`, type, x, y }, phase, `${seed}~n`);
      }
    }
  }
  /** One spawn under a sky: night-hardened, maybe Eclipse-touched, maybe an elite pack. */
  private spawnOne(s: MobSpawn, phase: SkyPhase, seed: string): void {
    if (this.mobs.some(m => m.key === s.key) || (this.deadUntil.get(s.key) ?? 0) > this.clock) return;
    const type = MOBS[s.type];
    if (!type) return;
    // Its zone's level (td-zones.ts), never the Keeper's: a night creature takes the spawn's level too, so it stays in the band.
    const def = hardened(s.level ? atZoneLevel(type, s.level) : type, phase);
    let pack = this.elites ? this.eliteFor(s, def) : null;
    if (this.elites && phase !== 'day' && (def.rank ?? 'normal') === 'normal' && rollTouched(seed, phase)) pack = touchPack(pack, touchedRandom(seed));
    if (pack) this.spawnPack(s.key, def, s.x, s.y, pack);
    else this.mobs.push(this.spawnMob(s.key, def, s.x, s.y));
  }
  /** Does this spawn come up as an elite pack (td-elites.ts)? Never in a safe square, only where its level suits. */
  private eliteFor(s: MobSpawn, def: MobDef): ElitePack | null {
    if (!eliteEligible({ level: def.level, rank: def.rank, safe: !!this.host.safeAt?.(s.x, s.y) })) return null;
    // S6 (§4): more affixes in higher zones, the new ones in the pool, Aura Enchanted from the zone's list.
    const lid = this.host.levelId(), land = landOf(lid, this.land);
    return rollElite(`${this.eliteSalt}|${lid}|${s.key}|${this.fallen.get(s.key) ?? 0}`, undefined, {
      level: def.level, ranged: !!def.ranged, bone: creatureProfile(def.id).family === 'bone', levelId: lid, tier: this.tier.id, fresh: true,
      auras: packAuraPool(land, def.level, { levelId: lid, storm: this.storm }),
    });
  }
  /**
   * Bring a pack to life round (x, y): the leader on the spawn itself (key `key`), its champions or minions beside it.
   * Each member's numbers are its own MobDef copy (eliteStats), so every other path (bars, Gold, loot, XP) reads them.
   */
  spawnPack(key: string, def: MobDef, x: number, y: number, pack: ElitePack): Mob[] {
    const out: Mob[] = [];
    const gen = this.fallen.get(key) ?? 0;
    const make = (k: string, role: EliteTag['role'], px: number, py: number): void => {
      if (this.mobs.some(m => m.key === k)) return;
      const tag: EliteTag = { rank: pack.rank, role, affixes: role === 'minion' ? [] : [...pack.affixes], name: role === 'leader' ? pack.name : null };
      const st = eliteStats({ hp: def.hp, dmg: def.dmg, speed: def.speed, rate: def.rate, hits: def.hits }, tag);
      const rank = lootRank(tag);
      const own: MobDef = { ...def, hp: st.hp, dmg: st.dmg, speed: st.speed, rate: st.rate, rank, ...(st.hits ? { hits: st.hits } : {}) };
      const m = this.spawnMob(k, own, px, py);
      m.elite = tag; m.take = st.take;
      if (tag.affixes.includes('teleport')) { m.blinkCd = TELEPORT.cd * .5; m.blinkT = 0; m.blinkTo = null; }
      this.mobs.push(m); out.push(m);
      // Mirrored (S6): a copy at its side that dies in one hit and bites for half (Glim dims beside it: the canon tell).
      if (tag.affixes.includes('mirrored') && role !== 'minion') {
        const cx = px + 14, cy = py + 4, at = this.free(cx, cy) ? { x: cx, y: cy } : { x: px - 14, y: py };
        const half: MobDef = { ...own, hp: 1, dmg: [Math.max(1, Math.round(own.dmg[0] * MIRROR_SHARE)), Math.max(1, Math.round(own.dmg[1] * MIRROR_SHARE))], drops: [] };
        const cp = this.spawnMob(`${k}~m`, half, at.x, at.y);
        cp.hp = 1; cp.mirror = true; cp.def = { ...cp.def, hp: 1 };
        this.mobs.push(cp); out.push(cp);
      }
    };
    make(key, 'leader', x, y);
    for (let i = 0; i < pack.followers; i++) {
      // Behind the leader (south of it), a body-width apart either side, so its name plate stands clear of them.
      const reach = Math.max(22, Math.round(def.w * .95)), row = Math.floor(i / 2) + 1, side = i % 2 ? -1 : 1;
      const rx = x + side * Math.round(reach * (i === 2 ? 0 : .5 + .5 * row)), ry = y + 16 * row + (i === 2 ? 12 : 0);
      const at = this.free(rx, ry) ? { x: rx, y: ry } : { x: x + (i % 2 ? -6 : 6), y };
      make(`${key}~${gen}e${i}`, pack.rank === 'champion' ? 'champion' : 'minion', at.x, at.y);
    }
    return out;
  }
  /** One ordinary creature, placed on purpose (the phase specs' showcase). */
  place(key: string, def: MobDef, x: number, y: number): Mob { const m = this.spawnMob(key, def, x, y); this.mobs.push(m); return m; }
  private spawnMob(key: string, def: MobDef, x: number, y: number): Mob {
    def = tiered(def, this.tier);
    return { key, def, x, y, hx: x, hy: y, hp: def.hp, cursed: 0, burnT: 0, face: 1, t: Math.random() * 3, cd: 1, hit: 0, wander: null, wait: Math.random() * 3, rcd: (def.ranged?.rate ?? 1) * (.5 + Math.random() * .5), summoned: false, tell: 0, aim: null, ...(def.rend ? { rendCd: def.rend.rate * .5 } : {}), ...(def.charge ? { chargeCd: def.charge.rate * .5 } : {}) };
  }
  /** Forget creatures far from the Keeper (the surface never ends; they come back when their chunk does). */
  prune(maxDist: number): void {
    const p = this.host.player();
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      // A world boss (bound to its rift) stays until it leaves or falls; the host owns it.
      // On the host, a creature near another member of the party stays too (it is theirs to fight).
      const far = Math.hypot(m.x - p.x, m.y - p.y) > maxDist && this.others.every(o => Math.hypot(m.x - o.x, m.y - o.y) > maxDist);
      if (far && m !== this.target && !m.def.bound) this.mobs.splice(i, 1);
    }
  }

  /** The creature under a world point (a tap), if any. */
  mobAt(x: number, y: number): Mob | null {
    let best: Mob | null = null, bd = 18;
    for (const m of this.mobs) { const d = Math.hypot(m.x - x, m.y - m.def.h / 2 - y); if (d < bd) { bd = d; best = m; } }
    return best;
  }

  /** The Keeper's pace a moment ago (art px/s, smoothed): a gap-closer leads him by it. */
  private readonly pv = { x: 0, y: 0, lx: NaN, ly: NaN };
  /** Where the Keeper stands (td-roam): the raised and the called roam while he is calm; `heelT` is a call keeping them at heel. */
  private readonly stand = new Stand();
  private heelT = 0;
  /** The Keeper calls his raised and called back to his side (the pet card's Follow / Fight). */
  callBack(): void { this.heelT = ROAM.heelFor; }
  /** Called back right now (the pet in the engine reads it). */
  get heeling(): boolean { return this.heelT > 0; }
  update(dt: number): void {
    this.clock += dt;
    this.sight.tick(dt, this.host.levelId());
    const p = this.host.player();
    this.holding.clear(); this.heading.clear();
    if (dt > 0 && Number.isFinite(this.pv.lx)) {
      const k = Math.min(1, dt * 6);
      this.pv.x += ((p.x - this.pv.lx) / dt - this.pv.x) * k; this.pv.y += ((p.y - this.pv.ly) / dt - this.pv.y) * k;
    }
    this.pv.lx = p.x; this.pv.ly = p.y;
    this.stand.update(p, dt, Math.hypot(this.pv.x, this.pv.y) > STILL_PACE);
    this.heelT = Math.max(0, this.heelT - dt);
    this.swing = Math.max(0, this.swing - dt);
    // The Keeper's attack: the target, or with the key held the nearest creature in reach.
    if (this.target && (this.target.hp <= 0 || !this.mobs.includes(this.target))) this.target = null;
    // Away in a menu (a host keeping the shared creatures alive): no swing of its own.
    // Stunned or frozen (a creature's ability, S6): his hands rest too.
    let foe = this.selfAway || this.dazed ? null : this.target;
    if (!foe && this.attacking && !this.selfAway && !this.dazed) {
      let bd = this.range;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd && this.sees(m)) { bd = d; foe = m; } }
    }
    // Behind a wall the target stays chosen, but nothing flies at it (the host walks the Keeper round to see it).
    if (foe && !this.sees(foe)) foe = null;
    // The Ashguard's blade: a swing in an arc toward the foe, striking whatever stands in it.
    if (this.melee) {
      if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range + foe.def.w / 4) this.swingBlade(foe);
      foe = null;
    }
    // The Lanternwright's lantern: a flare of light flies to the foe in its shorter reach (Kindle).
    if (this.lamp) {
      if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
        const kv = this.v('kindle');
        this.swing = SKILLS['kindle'].cd / (1 + this.agility) / (1 + this.castSpeed) / this.fanaticism;
        this.flares++;
        // Kindling Light (a mark): every few flares heal the Keeper a share of what they strike for.
        const nh = this.mk('kindle', 'nthHeal');
        this.bolts.push({ x: p.x + (p.face ?? 1) * 9, y: p.y - 34, to: foe, dmg: rnd(kv['min'], kv['max']) * this.handMult, age: 0, lamp: true, lift: 34, src: 'kindle', ...(nh && this.flares % (nh.m ?? 1) === 0 ? { heal: nh.n ?? 0 } : {}) });
        this.host.swung(foe);
      }
      foe = null;
    }
    // The Thornstrider's bow: an arrow at the foe in its long reach (Thorn Shot); it may pierce, it knocks back.
    if (this.thorn) {
      if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
        const tv = this.v('thorn-shot');
        this.swing = SKILLS['thorn-shot'].cd / (1 + this.agility) / (1 + this.castSpeed) / this.fanaticism;
        // Hunter's Rhythm (a mark): every few shots a sure crit; Leaf-Shadow: the first shot after a Rootwalk.
        this.thornShots++;
        const nc = this.mk('thorn-shot', 'nthCrit'), leaf = this.leafReady;
        this.leafReady = false;
        this.looseArrow(foe, this.shotBlow(tv['min'], tv['max']), { src: 'thorn-shot', crit: leaf || (!!nc && this.thornShots % (nc.m ?? 1) === 0) });
        this.host.swung(foe);
      }
      foe = null;
    }
    // The Warlock's staff: an ember bolt flies to the foe in range (Tibia's auto-attack, at a distance).
    const bolt = SKILLS['ember-bolt'];
    if (foe && this.swing <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.range) {
      this.swing = bolt.cd / (1 + this.agility) / (1 + this.castSpeed) / this.fanaticism;
      const bv = this.v('ember-bolt');
      this.bolts.push({ x: p.x, y: p.y - 22, to: foe, dmg: rnd(bv['min'], bv['max']) * this.fireMult * this.handMult, age: 0, lift: 22, src: 'ember-bolt' });
      this.host.swung(foe);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i], tx = b.to.x, ty = b.to.y - b.to.def.h / 2;
      b.age += dt;
      const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy), step = (b.lamp ? 230 : 190) * dt;
      if (!this.mobs.includes(b.to) || b.age > 2) { this.bolts.splice(i, 1); continue; }
      // Its ground track (its picture's y plus its height, which sinks to the foe's middle as it closes): a wall on it
      // and the bolt breaks there, harmless.
      const lift = b.lift ?? 22, land = b.to.def.h / 2, k = len > 0 ? Math.min(1, step / len) : 1, lift2 = lift + (land - lift) * k;
      const nx = len <= step + 2 ? tx : b.x + dx / len * step, ny = len <= step + 2 ? ty : b.y + dy / len * step;
      const wall = this.wallOn(b.x, b.y + lift, nx, ny + lift2);
      if (wall) {
        this.bolts.splice(i, 1); this.walled++;
        this.puff(wall.x, wall.y - (lift + (lift2 - lift) * wall.k), b.lamp ? 'lamp' : 'ember');
        continue;
      }
      b.lift = lift2;
      if (len <= step + 2) {
        this.bolts.splice(i, 1);
        if (b.lamp) {
          // A flare of light: the dead and the dark-born take it half again (td-lantern LIGHT_BANE).
          this.effects.push({ kind: 'kindle-hit', x: tx, y: ty, age: 0, life: .3, dir: 1 });
          const got = this.hitFoe(b.to, lightBlow(b.dmg, b.to.def.id), '#fff2a8', b.src ?? 'kindle');
          if (b.heal) this.healOwed(got * b.heal / 100);
          // Healing Wisps (a mark): each mote that lands heals the Keeper a share of his life.
          if (b.src === 'lamp-wisp' && got > 0) { const mh = this.mk('lamp-wisp', 'moteHeal'); if (mh) this.healOwed(this.keeperMaxHp * (mh.n ?? 0) / 100); }
          continue;
        }
        this.effects.push({ kind: 'bolt-hit', x: tx, y: ty, age: 0, life: .3, dir: 1 });
        this.hitFoe(b.to, b.dmg, '#ffd25a', 'ember-bolt');
        // The Crown of the Banked Coal: the bolt leaves its foe smouldering.
        if (this.relics.singe && b.to.hp > 0) { b.to.singeT = this.relics.singe.secs; b.to.singeTick = b.to.singeTick && b.to.singeTick > 0 ? b.to.singeTick : 1; }
      } else { b.x += dx / len * step; b.y += dy / len * step; }
    }
    // The aura (D2): it works on everything near, every second, while it is chosen.
    this.auraT -= dt;
    const auraTick = this.auraT <= 0;
    if (auraTick) this.auraT = 1;
    for (const m of [...this.mobs]) {
      if (m.cursed > 0) {
        m.cursed -= dt; m.burnT -= dt;
        // A whole second's burn each tick; when the curse runs out between ticks, the part of a second it still held
        // burns too, so "{{dps}} a second for {{secs}} seconds" is all of it (9.6 s is 9.6 seconds' burn, not 9).
        const part = m.burnT <= 0 ? 1 : m.cursed <= 0 ? 1 - m.burnT : 0;
        if (part > 0) { m.burnT = 1; this.hitFoe(m, this.v('ember-curse')['dps'] * this.fireMult * part, '#ff9a4a'); if (m.hp <= 0) continue; }
      }
      if ((m.brandT ?? 0) > 0) {
        m.brandT = (m.brandT ?? 0) - dt; m.brandTick = (m.brandTick ?? 1) - dt;
        if (m.brandTick <= 0) {
          m.brandTick = 1;
          this.effects.push({ kind: 'flame', x: m.x + rnd(-3, 3), y: m.y - 2, age: 0, life: .4, dir: 1 });
          const left = Math.max(1, m.brandTicks ?? 1), pay = left <= 1 ? m.brandDps ?? 0 : Math.round((m.brandDps ?? 0) / left);
          m.brandDps = (m.brandDps ?? 0) - pay; m.brandTicks = left - 1;
          if (pay > 0) this.hitFoe(m, pay * this.fireMult, '#ff9a4a');
          if (m.hp <= 0) continue;
        }
      }
      if ((m.bleedT ?? 0) > 0) {
        // A Barbed Shot's bleed: a whole number a second, a drop of blood falling.
        m.bleedT = (m.bleedT ?? 0) - dt; m.bleedTick = (m.bleedTick ?? 1) - dt;
        if (m.bleedTick <= 0) {
          m.bleedTick = 1;
          this.effects.push({ kind: 'bleed', x: m.x + rnd(-3, 3), y: m.y - m.def.h / 2, age: 0, life: .45, dir: 1 });
          // Protocol 10: the room ticks it (a member only shows it); in the room, the tick is its Keeper's blow.
          if (!(this.replica && this.roomTicks && !m.personal)) this.dotTick(m, m.bleedDps ?? 0, '#d0504a', m.bleedBy);
          if (m.hp <= 0) continue;
        }
      }
      if ((m.scorchT ?? 0) > 0) {
        // A mark's burn (Kindling, Smouldering, Caught Alight…): its share of the hit, once a second, for its seconds.
        m.scorchT = (m.scorchT ?? 0) - dt; m.scorchTick = (m.scorchTick ?? 1) - dt;
        if (m.scorchTick <= 0) {
          m.scorchTick = 1;
          this.effects.push({ kind: 'flame', x: m.x + rnd(-3, 3), y: m.y - 2, age: 0, life: .4, dir: 1 });
          if (!(this.replica && this.roomTicks && !m.personal)) this.dotTick(m, m.scorchDps ?? 0, '#ff9a4a', m.scorchBy, null);
          if (m.hp <= 0) continue;
        }
      }
      if ((m.chillT ?? 0) > 0) m.chillT = Math.max(0, (m.chillT ?? 0) - dt);
      if ((m.blindT ?? 0) > 0) m.blindT = Math.max(0, (m.blindT ?? 0) - dt);
      if ((m.hushT ?? 0) > 0) m.hushT = Math.max(0, (m.hushT ?? 0) - dt);
      if ((m.fearT ?? 0) > 0) m.fearT = Math.max(0, (m.fearT ?? 0) - dt);
      if ((m.slowT ?? 0) > 0) m.slowT = Math.max(0, (m.slowT ?? 0) - dt);
      if ((m.sunderT ?? 0) > 0) { m.sunderT = Math.max(0, (m.sunderT ?? 0) - dt); if (m.sunderT <= 0) m.sunderN = 0; }
      // Unmaking / Banish the Bearer: the stripped affix comes back when its seconds run out.
      if (m.stripped) { m.stripped.t -= dt; if (m.stripped.t <= 0) { if (m.elite && !m.elite.affixes.includes(m.stripped.affix as never)) m.elite.affixes.push(m.stripped.affix as never); m.stripped = null; } }
      if ((m.weak ?? 0) > 0) m.weak = Math.max(0, (m.weak ?? 0) - dt);
      if ((m.inkT ?? 0) > 0) m.inkT = Math.max(0, (m.inkT ?? 0) - dt);
      if ((m.singeT ?? 0) > 0 && this.relics.singe) {
        m.singeT = (m.singeT ?? 0) - dt; m.singeTick = (m.singeTick ?? 1) - dt;
        if (m.singeTick <= 0) {
          m.singeTick = 1;
          this.effects.push({ kind: 'flame', x: m.x + rnd(-3, 3), y: m.y - 2, age: 0, life: .4, dir: 1 });
          this.hitFoe(m, this.relics.singe.dps * this.fireMult, '#ff9a4a');
          if (m.hp <= 0) continue;
        }
      }
      if ((m.doom ?? 0) > 0) {
        m.doom = (m.doom ?? 0) - dt;
        if (m.doom <= 0) { m.doom = 0; this.doomBurst(m); if (m.hp <= 0) continue; }
      }
      if (auraTick && this.aura === 'aura-embers' && this.rank('aura-embers') > 0 && Math.hypot(m.x - p.x, m.y - p.y) <= this.v('aura-embers')['radius'] * TILE && this.sees(m)) {
        this.effects.push({ kind: 'pulse', el: 'ember', x: m.x, y: m.y, age: 0, life: .2, dir: 1 });
        this.hitFoe(m, this.v('aura-embers')['dps'] * this.fireMult, '#ff8a2e', 'aura-embers');
      }
    }
    // The Watchfire (the Ashguard's aura): life back every second while it runs.
    if (auraTick && this.melee && this.aura === 'aura-watchfire' && this.rank('aura-watchfire') > 0) {
      // Banked Fire (a mark): twice the life while his own runs low.
      const bf = this.mk('aura-watchfire', 'lowDouble');
      this.regenOwed += this.v('aura-watchfire')['regen'] * (bf && this.lifeShare() < (bf.n ?? 0) / 100 ? 2 : 1);
      const whole = Math.floor(this.regenOwed);
      if (whole > 0) { this.regenOwed -= whole; this.host.healPlayer(whole); }
    }
    this.tickItemAura(dt);
    if (this.lamp) this.tickLamp(dt);
    this.updateArrows(dt);
    if (this.thorn || this.beasts.length) this.tickThorn(dt);
    this.updateZones(dt);
    // S6: his statuses, the pack auras, the hostile ground.
    this.tickKeeper(dt);
    this.tickPackAuras(dt);
    this.tickHazards(dt);
    this.curseT = Math.max(0, this.curseT - dt);
    // The Cold Aura: within its reach the Keeper's step is slowed (the engine reads `chill`).
    this.chill = this.mobs.some(m => m.elite?.affixes.includes('cold-aura') && Math.hypot(m.x - p.x, m.y - p.y) <= COLD_AURA_R && this.sees(m)) ? COLD_SLOW : 0;
    // S6: a chill an ability laid on him, and Holy Freeze's reach.
    this.chill = Math.max(this.chill, this.kst.chill > 0 ? CHILL_SLOW : 0, this.packSlow);
    // Mend the Mind (the Hearth Circle's mark): inside the circle no cold takes hold of him.
    if (this.chill > 0 && this.inCircle && this.mk('hearth-circle', 'noChill')) this.chill = 0;
    this.tickEchoes(dt);
    if (this.markShieldT > 0) { this.markShieldT -= dt; if (this.markShieldT <= 0) { this.markShieldT = 0; this.markShield = 0; } }
    if (this.strideFreeT > 0) this.strideFreeT = Math.max(0, this.strideFreeT - dt);
    for (const m of [...this.mobs]) {
      // A Chill (a mark's): its blows and shots come slower too.
      const slow = (m.chillT ?? 0) > 0 ? 1 - CHILL_SLOW : 1;
      // Fanaticism (a pack aura): its bites come quicker.
      m.t += dt; m.cd -= dt * slow * (m.bless?.fx.rate ?? 1); m.rcd -= dt * slow; m.hit = Math.max(0, m.hit - dt);
      // A member under a host: the host moves, aims and bites with it (td-coop.ts places it each frame) — bar a
      // personal creature, which is this screen's alone.
      if (this.replica && !m.personal) continue;
      this.tickMobS6(m, dt);
      // Stunned (a Shield Bash): it stands where it is, does nothing, and its blow waits — and a cast in its tell is cancelled.
      if ((m.stun ?? 0) > 0) { if (m.abCast !== undefined) this.interruptCast(m); m.stun = Math.max(0, (m.stun ?? 0) - dt); m.cd = Math.max(m.cd, .2); continue; }
      // Teleport: a short wind-up where it stands, then it is at its prey's side.
      if (m.blinkT !== undefined && m.blinkT > 0) {
        m.blinkT -= dt;
        if (m.blinkT > 0) continue;
        m.blinkT = 0;
        if (m.blinkTo) { this.effects.push({ kind: 'spark', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .3, dir: 1 }); m.x = m.blinkTo.x; m.y = m.blinkTo.y; m.hx = m.x; m.hy = m.y; m.blinkTo = null; m.cd = Math.max(m.cd, .5); this.effects.push({ kind: 'spark', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .3, dir: 1 }); }
      }
      if (m.blinkCd !== undefined) m.blinkCd -= dt;
      if (m.chantT) m.chantT = Math.max(0, m.chantT - dt);
      if (m.rendCd !== undefined) m.rendCd -= dt;
      if (m.chargeCd !== undefined) m.chargeCd -= dt;
      // A gap-closer under way: it crosses to the spot it aimed at and strikes there (MobDef.charge).
      if (m.dash) { this.stepDash(m, dt); continue; }
      // A boss in its wind-up stands its ground; when the tell runs out the attack leaves for where it aimed.
      if (m.tell > 0) {
        m.tell -= dt;
        if (m.tell <= 0) {
          m.tell = 0;
          if (m.abCast !== undefined) this.releaseAbility(m);
          else if (m.charging && m.aim && m.def.charge) { const to = { x: m.aim.x, y: m.aim.y + 12 }; m.dash = { ...to, t: Math.hypot(to.x - m.x, to.y - m.y) / m.def.charge.speed + .15 }; }
          else if (m.aim) this.loose(m, m.aim.x, m.aim.y);
          m.aim = null; m.charging = false;
        } else continue;
      }
      // Rooted (a Thornroot Snare, a Bramble Trap): it stands where it is; it still bites what is in reach.
      const rooted = (m.rootT ?? 0) > 0;
      if (rooted) m.rootT = Math.max(0, (m.rootT ?? 0) - dt);
      // Its prey: the Keeper, or one of his raised skeletons standing closer — unless a Watch Cry has called it to him.
      const taunted = (m.taunt ?? 0) > 0;
      if (taunted) m.taunt = Math.max(0, (m.taunt ?? 0) - dt);
      // Only prey it can see (td-sight): a wall between and it neither picks it nor strikes it. Past this frame's ray
      // budget it keeps what it saw last.
      const dKeeper = this.selfAway ? Infinity : Math.hypot(p.x - m.x, p.y - m.y), look = Math.max(m.def.sight, MOB_REACH * 2);
      const spots = (x: number, y: number, dd: number) => dd <= look && this.sight.sees(m.x, m.y, x, y, m.saw ?? false);
      let prey: Minion | null = null, d = Infinity, seen = false;
      if (dKeeper < Infinity && (taunted ? this.sight.sees(m.x, m.y, p.x, p.y, m.saw ?? false) : spots(p.x, p.y, dKeeper))) { d = dKeeper; seen = true; }
      // The raised stand in its face: one a step farther than the Keeper still draws it (MINION_DRAW).
      if (!taunted) for (const k of this.minions) { const dk = Math.hypot(k.x - m.x, k.y - m.y); if (dk - MINION_DRAW < d && spots(k.x, k.y, dk)) { d = dk; prey = k; seen = true; } }
      // Shared creatures: another member of the party standing nearer is its prey (the host decides; the bite travels).
      let other: CoopKeeper | null = null;
      // Protocol 10: taunted by a Keeper of the room — it turns on that one, wherever the others stand.
      const by = taunted && m.tauntBy ? this.others.find(o => o.id === m.tauntBy) ?? null : null;
      if (by) { const dk = Math.hypot(by.x - m.x, by.y - m.y); if (this.sight.sees(m.x, m.y, by.x, by.y, m.saw ?? false)) { d = dk; other = by; prey = null; seen = true; } }
      if (!taunted) for (const o of this.others) { const dk = Math.hypot(o.x - m.x, o.y - m.y); if (dk < d && spots(o.x, o.y, dk)) { d = dk; other = o; prey = null; seen = true; } }
      // Nothing in sight: it keeps after the Keeper a while (CHASE_MEMORY), toward where he is, and strikes nothing.
      if (!seen) d = dKeeper;
      m.saw = seen;
      m.chaseT = seen ? CHASE_MEMORY : Math.max(0, (m.chaseT ?? 0) - dt);
      const px0 = other ? other.x : prey ? prey.x : p.x, py0 = other ? other.y : prey ? prey.y : p.y;
      // Rootwalk: the forest closes behind the Keeper — a creature loses his track unless he is at its very side.
      const lost = this.rootwalkT > 0 && !prey && !other && d > MOB_REACH * 2;
      // A world boss (bound): never past its leash from the rift, never after prey standing on a town's safe ground.
      const bound = m.def.bound, held = !!bound && (Math.hypot(m.x - m.hx, m.y - m.hy) > bound.leash * TILE || !!this.host.safeAt?.(px0, py0));
      // The Lanternwright's shutters (marks): Quiet Hands shortens how far a creature notices him; in Moth Hours the
      // dark-born leave him be until he strikes them.
      const notice = m.def.sight - this.shutterQuiet(m);
      const hunting = !lost && !held && ((taunted && (!m.tauntBy || !!other)) || (d < notice && (seen || (m.chaseT ?? 0) > 0))), shoot = this.hushed(m) ? undefined : m.def.ranged;
      if (hunting && seen && m.blinkCd !== undefined && m.blinkCd <= 0 && d > TELEPORT.min) {
        // Where it will land: a step short of its prey, on its own side; never into a wall.
        const k = 1 - 14 / Math.max(1, d), bx = m.x + (px0 - m.x) * k, by = m.y + (py0 - m.y) * k;
        m.blinkCd = TELEPORT.cd;
        if (this.free(bx, by, m.def.floats)) { m.blinkTo = { x: bx, y: by }; m.blinkT = TELEPORT.tell; continue; }
      }
      let tx: number | null = null, ty: number | null = null, stop = 2;
      if (hunting) {
        m.wander = null;
        if (shoot && shoot.keep > 0 && d < shoot.keep - 8) { tx = m.x + (m.x - px0); ty = m.y + (m.y - py0); stop = 0; }   // back off
        else if (!(shoot && shoot.keep > 0 && d <= shoot.range)) { tx = px0; ty = py0; stop = MOB_REACH - 4; }
        if (Math.abs(px0 - m.x) > 2) m.face = px0 < m.x ? -1 : 1;
        // A shot at where the prey stands now: a step aside and it flies by. A boss winds up first (BOSS_TELL):
        // it aims now and looses when the tell runs out, so the ground warning is where the breath goes.
        if (shoot && seen && d <= shoot.range && m.rcd <= 0 && m.tell <= 0 && !this.shrouded(d)) {
          m.rcd = shoot.rate;
          if (windsUp(m.def)) { m.tell = BOSS_TELL; m.aim = { x: px0, y: py0 - 12 }; if (m.def.chant) { m.chantT = CHANT_SECS; m.chantText = m.def.chant; } }
          else this.loose(m, px0, py0 - 12);
        }
        // A ground attack (the Seam Eater's Rend): rings open round its prey, never in the same breath as a wind-up.
        if (m.def.rend && !this.hushed(m) && seen && m.tell <= 0 && (m.rendCd ?? 0) <= 0 && d <= m.def.sight) { m.rendCd = m.def.rend.rate; this.rendAt(m, px0, py0); }
        // A gap-closer: prey that keeps its distance is crossed to (the tell first, so a step aside still saves it).
        const ch = this.hushed(m) ? undefined : m.def.charge;
        if (ch && seen && m.tell <= 0 && (m.chargeCd ?? 0) <= 0 && d >= ch.min && d <= m.def.sight) {
          // It leads a Keeper on the move (where he will be when it lands, at his pace now, at most CHARGE_LEAD px):
          // walking straight away is caught; a step aside in the tell is not.
          const lead = prey ? 0 : BOSS_TELL + d / ch.speed, lx = this.pv.x * lead, ly = this.pv.y * lead, ll = Math.hypot(lx, ly), cut = ll > CHARGE_LEAD ? CHARGE_LEAD / ll : 1;
          m.chargeCd = ch.rate; m.tell = BOSS_TELL; m.charging = true; m.aim = { x: px0 + lx * cut, y: py0 + ly * cut - 12 };
          if (ch.chant) { m.chantT = CHANT_SECS; m.chantText = ch.chant; }
          continue;
        }
        // S6 (td-abilities): its own abilities — a tell, then the blow; it stands while the tell runs.
        if (seen && m.tell <= 0 && !this.hushed(m) && this.tryAbility(m, px0, py0, d)) continue;
      } else {
        // Roam near home: a short stroll, a pause, another.
        if (!m.wander) {
          m.wait -= dt;
          if (m.wait <= 0) { m.wander = { x: m.hx + rnd(-40, 40), y: m.hy + rnd(-30, 30) }; m.wait = 1.5 + Math.random() * 3; }
        }
        if (m.wander) { tx = m.wander.x; ty = m.wander.y; if (Math.hypot(tx - m.x, ty - m.y) < 3) m.wander = null; }
      }
      // Feared (Fear of Fire, Fearsome): it runs from the Keeper and strikes nothing.
      const afraid = (m.fearT ?? 0) > 0;
      if (afraid) { const f = m.fearFrom ?? p; tx = m.x + (m.x - f.x); ty = m.y + (m.y - f.y); stop = 0; }
      if (tx !== null && ty !== null && !rooted) {
        const dx = tx - m.x, dy = ty - m.y, len = Math.hypot(dx, dy);
        if (len > stop) {
          const step = Math.min(len, m.def.speed * this.paceOf(m) * dt), vx = dx / len * step, vy = dy / len * step;
          if (hunting) this.heading.set(m, { x: dx / len, y: dy / len });
          if (this.canStep(m, m.x + vx, m.y)) m.x += vx; else m.wander = null;
          if (this.canStep(m, m.x, m.y + vy)) m.y += vy; else m.wander = null;
          if (!hunting && Math.abs(vx) > .05) m.face = vx < 0 ? -1 : 1;
        }
      }
      if (seen && (d <= MOB_REACH || (shoot && d <= shoot.range))) this.holding.add(m);
      // A bite when its prey is in reach — and in sight (no bite through a wall's corner).
      if (seen && !afraid && d <= MOB_REACH && m.cd <= 0) {
        m.cd = m.def.rate;
        // Brutal (an affix): every third blow is a heavy one, after a red arc on the ground in front of it.
        if (m.elite?.affixes.includes('brutal') && (m.blows = (m.blows ?? 0) + 1) % BRUTAL.every === 0) { m.abCast = -1; m.tell = BRUTAL.tell; m.aim = { x: px0, y: py0 - 12 }; continue; }
        // Blinded (Afterimage): half its blows go astray (Blessed Aim steadies them).
        if ((m.blindT ?? 0) > 0 && Math.random() < BLIND_MISS * (1 - (m.bless?.fx.aim ?? 0))) { this.float(m.x, m.y - m.def.h, 'miss', '#9a948a'); continue; }
        // Might (a pack aura) lifts its blow.
        let n = Math.round(rnd(m.def.dmg[0], m.def.dmg[1]) * (m.bless?.fx.blow ?? 1));
        // A cursed foe bites weaker.
        const weak = this.weakOf(m);
        if (weak > 0) n = Math.max(1, Math.round(n * (1 - weak / 100)));
        if (other) {
          const ax = m.elite?.affixes ?? [];
          (m.coopBy ??= new Set()).add(other.id);
          this.coop?.bite(other.id, m, n, this.blowType(m), ax.includes('mana-burn'), ax.includes('cursed'), this.biteRiders(m, n, false) || undefined);
        } else if (prey) { this.hurtMinion(prey, n); this.biteRiders(m, n, false); }
        else { this.biteKeeper(n, this.blowType(m), m); this.layOn(this.biteRiders(m, n, true), m); this.eliteBlow(m); this.struckBy(m); }
      }
    }
    // A pack stays a pack, not one sprite: creatures standing on each other ease apart (never into a wall).
    if (!this.replica) this.spreadMobs(dt);
    // Fire Enchanted's last word: the burst leaves when its ring has shown its reach.
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t -= dt;
      if (b.t > 0) continue;
      this.bursts.splice(i, 1);
      // S6: a raise's sigil or a mending ring is a picture only; an ability ring wears its tone.
      if (b.fx) { this.effects.push({ kind: b.el === 'life' ? 'heal' : 'raise', x: b.x, y: b.y, age: 0, life: .5, dir: 1 }); if (b.el === 'raise' && this.replica) this.raiseSeen(b.x, b.y); continue; }
      this.effects.push({ kind: 'wave', el: waveEl(b.el), r: b.r, x: b.x, y: b.y, age: 0, life: .5, dir: 1 });
      // A member under a host only sees the burst: the host decides who it caught (a bite, below, on the host's side).
      if (this.replica) continue;
      // The ground it leaves (fire ground, a web, a spore cloud).
      if (b.after) this.layHazard({ x: b.x, y: b.y, r: b.after.r, t: b.after.t, dps: b.after.dps, ...(b.after.st ? { st: b.after.st } : {}), tone: b.after.tone, ...(b.lv ? { lv: b.lv } : {}), type: b.type ?? 'fire', ...(b.by ? { by: b.by } : {}) });
      // Only what it can reach from its centre: a ring by a wall does not burst into the room behind it.
      if (b.tone) { for (const k of this.keepersIn(b.x, b.y, b.r)) this.strikeKeeper(k, b.dmg, b.type ?? 'fire', b.by ?? null, b.st ?? '', b.lv); continue; }
      if (!this.selfAway && Math.hypot(p.x - b.x, p.y - b.y) <= b.r && this.reaches(b.x, b.y, p)) this.biteKeeper(b.dmg, b.type ?? 'fire', undefined, b.lv);
      for (const o of this.others) if (Math.hypot(o.x - b.x, o.y - b.y) <= b.r && this.reaches(b.x, b.y, o)) this.coop?.bite(o.id, null, b.dmg, b.type ?? 'fire', false, false);
    }
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const k = this.calls[i];
      k.t -= dt;
      if (k.t > 0) continue;
      this.calls.splice(i, 1);
      // S6: a raise — the singer must still stand, the corpse still lie; it rises at its share of life, owing nothing.
      if (k.corpse) {
        const ci = this.remains.findIndex(cp => cp.id === k.corpse);
        if ((k.by && !this.mobs.includes(k.by)) || ci < 0 || !MOBS[k.type]) continue;
        const cp = this.remains[ci];
        this.remains.splice(ci, 1);
        const rd = atZoneLevel(MOBS[k.type], k.level ?? (cp.def as MobDef).level ?? MOBS[k.type].level), rm = this.spawnMob(k.key, rd, k.x, k.y);
        rm.hp = Math.max(1, Math.round(rm.def.hp * (k.pct ?? .5))); rm.raised = true; rm.face = cp.face; if (k.personal) rm.personal = true;
        this.mobs.push(rm);
        if (k.by) k.by.raisedOne = true;
        this.effects.push({ kind: 'raise', x: k.x, y: k.y, age: 0, life: .5, dir: 1 });
        continue;
      }
      // Eclipse-touched summons (the Seam Eater's call) climb out as lone touched champions (td-elites touchPack).
      if (MOBS[k.type]) { const cd = k.level ? atZoneLevel(MOBS[k.type], k.level) : MOBS[k.type]; const up = k.touched ? this.spawnPack(k.key, cd, k.x, k.y, touchPack(null, touchedRandom(k.key))) : [this.spawnMob(k.key, cd, k.x, k.y)]; if (!k.touched) this.mobs.push(up[0]); if (k.personal) for (const u of up) u.personal = true; }
      this.effects.push({ kind: 'spark', x: k.x, y: k.y - 6, age: 0, life: .3, dir: 1 });
    }
    this.updateShots(dt);
    this.updateMinions(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.clock - this.corpses[i].at > CORPSE_SECS) this.corpses.splice(i, 1);
    weatherCorpses(this.remains, this.clock);
    // Walk over loot to pick it up.
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const g = this.drops[i];
      g.age += dt;
      // The room's ground (protocol 7) lies as long as the room says; it is taken only when this Keeper may have it.
      if (g.room) {
        g.room.hold = Math.max(0, g.room.hold - dt); g.room.wait = Math.max(0, g.room.wait - dt);
        if (g.room.hold > 0 || g.room.wait > 0) continue;
      } else if (g.age > DESPAWN) { this.drops.splice(i, 1); continue; }
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
    if (this.mercyT > 0) this.mercyT = Math.max(0, this.mercyT - dt);
    if (this.melee) this.tickOaths(dt);
    if (this.boneT > 0) { this.boneT -= dt; if (this.boneT <= 0) this.bone = 0; }
    if (this.lightT > 0) this.lightT = Math.max(0, this.lightT - dt);
    if (this.haste > 0) {
      this.haste = Math.max(0, this.haste - dt);
      if (Math.random() < dt * 8) this.effects.push({ kind: 'dust', x: p.x + rnd(-4, 4), y: p.y, age: 0, life: .4, dir: 1 });
    }
  }

  // ── S6: creature abilities, pack auras and the new affixes (docs/design/monsters-abilities.md) ───────────────────
  /** The land this area belongs to (the engine and the room hand it in): the zone's aura list reads it. */
  land = '';
  /** A thunderstorm over the area (Holy Shock joins the Wilds' list). */
  storm = false;
  /** Lasting hostile ground: fire ground, crust, an ink trail, a web, a spore cloud (a member draws the host's). */
  readonly hazards: Hazard[] = [];
  /** Hush owed to the engine's dark layer (Whispering blows): it drains it each frame. */
  hushOwed = 0;
  /**
   * The Keeper's own statuses from creatures' abilities (seconds left): stunned and frozen (he stands, he does
   * nothing), rooted (he stands), chilled, blinded (half his blows go astray), wet, weakened, his light cut; a burn
   * and a bleed (whole damage a second); and the immunity a Stun or a Freeze leaves (§1.8).
   */
  readonly kst = { stun: 0, freeze: 0, root: 0, chill: 0, blind: 0, wet: 0, weak: 0, dark: 0, immune: 0, burn: { t: 0, dps: 0, tick: 1 }, bleed: { t: 0, dps: 0, tick: 1 } };
  /** He cannot step (stunned, frozen, rooted): the engine and the sim read it. */
  get held(): boolean { return this.kst.stun > 0 || this.kst.freeze > 0 || this.kst.root > 0; }
  /** He cannot act (stunned, frozen). */
  get dazed(): boolean { return this.kst.stun > 0 || this.kst.freeze > 0; }
  /** Pack auras on him now (§3): every resist lower (Conviction), his step slower (Holy Freeze), his light shorter (Lightless, True Light; tiles). */
  packResist = 0;
  packSlow = 0;
  lightCut = 0;
  /** Abilities cast so far, by id (the specs and the sim's tally read it). */
  readonly casts = new Map<string, number>();

  /** One creature's blow (B, §1): its own roll, Might-lifted, weakened by a curse. */
  private blowB(m: Mob): number {
    let n = rnd(m.def.dmg[0], m.def.dmg[1]) * (m.bless?.fx.blow ?? 1);
    const weak = this.weakOf(m);
    if (weak > 0) n *= 1 - weak / 100;
    return Math.max(1, n);
  }
  /** Every Keeper inside a ring at (x, y): this one (unless away) and the party's others; only what the centre reaches. */
  private keepersIn(x: number, y: number, r: number): { self: boolean; id: string; x: number; y: number }[] {
    const out: { self: boolean; id: string; x: number; y: number }[] = [], p = this.host.player();
    if (!this.selfAway && Math.hypot(p.x - x, p.y - y) <= r && this.reaches(x, y, p)) out.push({ self: true, id: '', x: p.x, y: p.y });
    for (const o of this.others) if (Math.hypot(o.x - x, o.y - y) <= r && this.reaches(x, y, o)) out.push({ self: false, id: o.id, x: o.x, y: o.y });
    return out;
  }
  /** An ability's statuses at its caster's blow (a burn's damage a second in B), as the wire carries them. */
  private statusOf(list: readonly StatusLay[] | undefined, B: number, pull = 0): string {
    const out: { s: KeeperStatus; t: number; dps?: number }[] = (list ?? []).map(x => ({ s: x.s, t: x.t, ...(x.b ? { dps: x.b * B } : {}) }));
    if (pull) out.push({ s: pull > 0 ? 'pull' : 'push', t: Math.abs(pull) });
    return encodeStatus(out);
  }
  /** An ability lands on one Keeper: its damage through his defenses, its statuses, a pull toward (or a push from) `from`. */
  private strikeKeeper(k: { self: boolean; id: string }, raw: number, type: DamageType, from: Mob | null, st: string, lv?: number): void {
    if (k.self) {
      if (raw > 0) this.biteKeeper(raw, type, from ?? undefined, lv ?? from?.def.level);
      this.layOn(st, from);
      if (from && this.coop && !this.replica) (from.coopBy ??= new Set()).add('');
      return;
    }
    if (raw > 0 || st) this.coop?.bite(k.id, from, Math.max(1, raw), type, false, false, st || undefined);
  }
  /** Statuses arrive on this Keeper (an ability of a creature here, or the room's bite): the CC rules hold (§1.8). */
  layOn(st: string | undefined, from?: { x: number; y: number } | null): void {
    if (!st) return;
    const k = this.kst, p = this.host.player();
    for (const x of decodeStatus(st)) {
      switch (x.s) {
        case 'stun': case 'freeze':
          if (k.immune > 0) break;
          k[x.s] = Math.max(k[x.s], x.t); k.immune = x.t + KEEPER_CC_IMMUNE;
          this.effects.push({ kind: 'spark', x: p.x, y: p.y - 40, age: 0, life: .4, dir: 1 });
          break;
        case 'frost':
          // Gloam Blizzard: a Wet Keeper freezes on the first pulse; a dry one is only chilled.
          if (k.wet > 0 && k.immune <= 0) { k.freeze = Math.max(k.freeze, 1); k.immune = 1 + KEEPER_CC_IMMUNE; } else k.chill = Math.max(k.chill, x.t);
          break;
        case 'root': k.root = Math.max(k.root, Math.min(KEEPER_ROOT_MAX, x.t)); break;
        case 'chill': case 'blind': case 'wet': case 'weak': case 'dark': k[x.s] = Math.max(k[x.s], x.t); break;
        case 'burn': case 'bleed': { const d = k[x.s]; if (d.t <= 0) d.tick = 1; d.t = Math.max(d.t, x.t); d.dps = Math.max(d.t > 0 ? d.dps : 0, x.dps); break; }
        case 'pull': case 'push': {
          if (!from || !this.host.dash) break;
          const dx = from.x - p.x, dy = from.y - p.y, len = Math.hypot(dx, dy) || 1;
          const go = x.s === 'pull' ? Math.min(x.t * TILE, Math.max(0, len - 14)) : -x.t * TILE;
          if (go) this.host.dash(p.x + dx / len * go, p.y + dy / len * go);
          break;
        }
      }
    }
  }
  /** His statuses run down; a burn and a bleed bite once a second (a bleed twice as hard while he moves). */
  private tickKeeper(dt: number): void {
    const k = this.kst;
    for (const s of ['stun', 'freeze', 'root', 'chill', 'blind', 'wet', 'weak', 'dark', 'immune'] as const) if (k[s] > 0) k[s] = Math.max(0, k[s] - dt);
    if (this.selfAway) return;
    const moving = Math.hypot(this.pv.x, this.pv.y) > STILL_PACE;
    for (const [s, type] of [['burn', 'fire'], ['bleed', 'physical']] as const) {
      const d = k[s];
      if (d.t <= 0) continue;
      d.t -= dt; d.tick -= dt;
      if (d.tick <= 0 || d.t <= 0) {
        d.tick = 1;
        const n = Math.round(d.dps * (s === 'bleed' && moving ? BLEED_MOVING : 1));
        if (n > 0) { this.biteKeeper(n, type); this.effects.push({ kind: s === 'burn' ? 'flame' : 'bleed', x: this.host.player().x, y: this.host.player().y - 10, age: 0, life: .4, dir: 1 }); }
      }
      if (d.t <= 0) d.dps = 0;
    }
  }

  /**
   * The pack auras (§3), every frame and on every screen: who carries one, who it blesses (its own pack within 4
   * tiles), and what it does to this Keeper standing in its reach (Conviction, Holy Freeze, Lightless; his own aura of
   * the opposite kind halves it). The simulating side also pulses Holy Fire and Holy Shock and mends with Prayer.
   */
  private tickPackAuras(dt: number): void {
    const lid = this.host.levelId(), p = this.host.player(), here = !this.selfAway;
    this.packResist = 0; this.packSlow = 0;
    let dark = this.kst.dark > 0 ? TRUE_LIGHT_CUT : 0;
    const bearers: Mob[] = [];
    for (const m of this.mobs) {
      m.bless = null;
      if (!this.replica && (m.auraOffT ?? 0) > 0) m.auraOffT = Math.max(0, (m.auraOffT ?? 0) - dt);
      m.aura = bearerAura(m, lid);
      if (m.aura) bearers.push(m);
      // The Lightless affix: its own body snuffs the light near it.
      if (here && m.elite?.affixes.includes('lightless') && Math.hypot(m.x - p.x, m.y - p.y) <= LIGHTLESS_R) dark = Math.max(dark, packAuraFx('lightless', packAuraLevel(m.def.level, this.tier.id)).dark * (halvedBy(this.aura, 'lightless') ? .5 : 1));
    }
    for (const b of bearers) {
      const id = b.aura!, L = packAuraLevel(b.def.level, this.tier.id), fx = packAuraFx(id, L);
      for (const m of this.mobs) if (!m.bless && samePack(b, m) && Math.hypot(m.x - b.x, m.y - b.y) <= PACK_AURA_REACH) m.bless = { id, L, by: b, fx };
      if (here && Math.hypot(b.x - p.x, b.y - p.y) <= PACK_AURA_REACH) {
        const half = halvedBy(this.aura, id) ? .5 : 1;
        if (fx.resistLower) this.packResist = Math.max(this.packResist, fx.resistLower * half);
        if (fx.slow) this.packSlow = Math.max(this.packSlow, fx.slow * half);
        if (fx.dark) dark = Math.max(dark, fx.dark * half);
      }
      if (this.replica) continue;
      const type = PACK_PULSE_TYPE[id];
      if (type) {
        b.pulseT = (b.pulseT ?? PACK_PULSE) - dt;
        if (b.pulseT <= 0) {
          b.pulseT = PACK_PULSE;
          const B = (b.def.dmg[0] + b.def.dmg[1]) / 2, hit = this.keepersIn(b.x, b.y, PACK_AURA_REACH);
          if (hit.length) this.effects.push({ kind: 'wave', el: type === 'fire' ? 'ember' : 'brass', r: PACK_AURA_REACH, x: b.x, y: b.y, age: 0, life: .5, dir: 1 });
          for (const k of hit) {
            // (A Wet Keeper's lightning is taken deeper in biteKeeper, the one Wet rule.)
            const raw = B * (fx.pulse[0] + Math.random() * (fx.pulse[1] - fx.pulse[0]));
            this.strikeKeeper(k, raw, type, b, '');
          }
        }
      }
    }
    if (!this.replica) for (const m of this.mobs) if (m.bless?.fx.regen && m.hp < m.def.hp) m.hp = Math.min(m.def.hp, m.hp + healBase(m) * m.bless.fx.regen * dt);
    this.lightCut = dark;
  }

  /** A creature's own S6 clocks each frame (simulating side): underground, a ward, a mending, a howl, its trail. */
  private tickMobS6(m: Mob, dt: number): void {
    if ((m.hidden ?? 0) > 0) m.hidden = Math.max(0, (m.hidden ?? 0) - dt);
    if ((m.wardT ?? 0) > 0) { m.wardT = Math.max(0, (m.wardT ?? 0) - dt); if (m.wardT <= 0) m.ward = 0; }
    if ((m.howlT ?? 0) > 0) m.howlT = Math.max(0, (m.howlT ?? 0) - dt);
    if ((m.mendT ?? 0) > 0) { m.mendT = Math.max(0, (m.mendT ?? 0) - dt); m.hp = Math.min(m.def.hp, m.hp + healBase(m) * (m.mendPct ?? 0) * dt); }
    if (m.ab) for (let i = 0; i < m.ab.length; i++) if (m.ab[i] > 0) m.ab[i] = Math.max(0, m.ab[i] - dt);
    // A trail (Crust, Ink Trail): a patch where it walked, every so often while it moves.
    const trail = castable(m.def.id).find(a => a.kind === 'trail');
    if (trail?.after) {
      m.trailT = (m.trailT ?? 0) - dt;
      const at = m.trailAt, moved = !at || Math.hypot(m.x - at.x, m.y - at.y) > 7;
      if (m.trailT <= 0 && moved) {
        m.trailT = trail.cd; m.trailAt = { x: m.x, y: m.y };
        this.layHazard({ x: m.x, y: m.y, r: trail.after.r * ATILE, t: trail.after.t, dps: 0, ...(trail.after.st ? { st: trail.after.st } : {}), tone: trail.tone, by: m });
      }
    }
  }
  /** Lasting hostile ground (capped: the oldest give way). */
  private layHazard(h: Omit<Hazard, 'life' | 'tick'>): void {
    this.hazards.push({ ...h, life: h.t, tick: .5 });
    if (this.hazards.length > 48) this.hazards.splice(0, this.hazards.length - 48);
  }
  /** Hostile ground runs down; fire ground burns who stands in it (simulating side), and every patch lays its status on this Keeper. */
  private tickHazards(dt: number): void {
    const p = this.host.player();
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt; h.tick -= dt;
      if (h.t <= 0) { this.hazards.splice(i, 1); continue; }
      // Any fire on a web or a spore cloud clears it (the web burns; the cloud bursts, design-bible §4.7).
      if (h.tick > 0) continue;
      h.tick = .5;
      // His own status inside it, on any screen (a member draws the host's patches and feels them here).
      if (h.st && !this.selfAway && Math.hypot(p.x - h.x, p.y - h.y) <= h.r) this.layOn(encodeStatus([{ s: h.st, t: .7 }]));
      if (this.replica || !(h.dps > 0)) continue;
      for (const k of this.keepersIn(h.x, h.y, h.r)) this.strikeKeeper(k, h.dps * .5, h.type ?? 'fire', null, '', h.lv);
    }
  }
  /** The Keeper's fire clears a web or a spore cloud it touches (the counters "burn it"). */
  private burnHazards(x: number, y: number, r: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) { const h = this.hazards[i]; if ((h.tone === 'moss' || h.tone === 'life') && Math.hypot(h.x - x, h.y - y) <= h.r + r) this.hazards.splice(i, 1); }
  }

  /**
   * Try one of a hunting creature's abilities (the first ready one whose reach its prey is in): it begins its tell and
   * the creature stands while the tell runs (true), or it acts at once and goes on (a flee, a passive: false).
   */
  private tryAbility(m: Mob, px: number, py: number, d: number): boolean {
    const list = castable(m.def.id);
    if (!list.length) return false;
    m.ab ??= list.map(a => a.cd * (.4 + Math.random() * .4));
    const lid = this.host.levelId();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if ((m.ab[i] ?? 0) > 0 || a.kind === 'trail') continue;
      if (a.only && !a.only.some(o => lid.startsWith(o))) continue;
      if (d > a.reach * ATILE + 4) continue;
      const cd = tierCd(a.cd, this.tier.id) * (m.bless?.fx.cd ?? 1);
      if (a.kind === 'flee') { m.ab[i] = cd; m.fearT = Math.min(3, 6 * ATILE / Math.max(20, m.def.speed)); this.counted(a); return false; }
      if (!this.ready(m, a)) continue;
      m.ab[i] = cd;
      this.counted(a);
      if (a.words) { m.chantT = CHANT_SECS; m.chantText = a.words; }
      if (Math.abs(px - m.x) > 2) m.face = px < m.x ? -1 : 1;
      m.abCast = i; m.tell = Math.max(a.tell, .3); m.aim = { x: px, y: py - 12 };
      this.beginAbility(m, a, px, py);
      return true;
    }
    return false;
  }
  private counted(a: AbilityDef): void { this.casts.set(a.id, (this.casts.get(a.id) ?? 0) + 1); }
  /** Whether it has something to cast on (a corpse to raise, a kin to ward, mend or howl with). */
  private ready(m: Mob, a: AbilityDef): boolean {
    if (a.kind === 'raise') return this.raisable(m, a).length > 0;
    if (a.kind === 'ward') return !!this.kinOf(m, (a.r ?? 5) * ATILE).find(k => k !== m && !(k.ward ?? 0) && k.hp < k.def.hp);
    if (a.kind === 'mend') return this.kinOf(m, (a.r ?? 4) * ATILE).some(k => k.hp < k.def.hp * .85);
    if (a.kind === 'howl') return this.kinOf(m, (a.r ?? 6) * ATILE).some(k => k !== m && k.def.id === m.def.id);
    return true;
  }
  /** Its kin near it: the same family, not hidden. */
  private kinOf(m: Mob, r: number): Mob[] {
    const fam = creatureProfile(m.def.id).family;
    // Never a boss (a mending priest does not keep a floor's boss alive: its party form will, §5).
    return this.mobs.filter(k => k.hp > 0 && k.def.rank !== 'boss' && !k.def.bound && Math.hypot(k.x - m.x, k.y - m.y) <= r && creatureProfile(k.def.id).family === fam);
  }
  /** The corpses a raiser may bring back: its own keys, fresh enough, not ash, not laid to rest, not already called. */
  private raisable(m: Mob, a: AbilityDef): Corpse[] {
    const r = a.raise!, called = new Set(this.calls.map(k => k.corpse).filter(Boolean));
    return this.remains.filter(cp => r.keys.includes(cp.kind.id) && !cp.ash && !cp.rested && !called.has(cp.id) && this.clock - cp.born < 130 && Math.hypot(cp.x - m.x, cp.y - m.y) <= r.from * ATILE)
      .sort((p, q) => Math.hypot(p.x - m.x, p.y - m.y) - Math.hypot(q.x - m.x, q.y - m.y)).slice(0, r.most);
  }
  /** The tell begins: rings on the ground (they strike for themselves), a sigil over each corpse, a ward chosen. */
  private beginAbility(m: Mob, a: AbilityDef, px: number, py: number): void {
    const B = this.blowB(m), type: DamageType = a.el ?? this.blowType(m), lv = m.def.level, r = (a.r ?? 1) * ATILE;
    const st = this.statusOf(a.st, B, a.pull ?? 0);
    const after = a.after ? { r: a.after.r * ATILE, t: a.after.t, dps: a.after.b * B, ...(a.after.st ? { st: a.after.st } : {}), tone: a.tone } : undefined;
    const ring = (x: number, y: number, t: number, dmg: number, extra: Partial<DeathBurst> = {}) =>
      this.bursts.push({ x, y, t, delay: t, r, dmg: Math.round(dmg), lv, type, el: a.tone, tone: a.tone, by: m, ...(st ? { st } : {}), ...(after ? { after } : {}), ...extra } as DeathBurst);
    switch (a.kind) {
      case 'smash': ring(m.x, m.y, a.tell, B * (a.b ?? 1)); break;
      case 'burrow': m.hidden = a.tell + .15; ring(px, py, a.tell, B * (a.b ?? 1)); break;
      case 'field': ring(px, py, a.tell, 0); break;
      case 'drop': {
        const n = a.n ?? 1;
        if (a.over) {
          // A blizzard: its pulses fall on the same ring, one after another; Gloam Blizzard freezes the Wet.
          for (let i = 0; i < n; i++) ring(px, py, a.tell + i * a.over / n, B * (a.b ?? 1), a.id === 'gloam-blizzard' ? { st: 'frost:20' } : {});
        } else for (let i = 0; i < n; i++) {
          const ox = n > 1 ? (i - (n - 1) / 2) * 22 : 0, oy = n > 1 ? (i % 2 ? 8 : -8) : 0;
          ring(px + ox, py + oy, a.tell, B * (a.b ?? 1));
        }
        break;
      }
      case 'cracks': {
        const n = a.n ?? 3, dx = px - m.x, dy = py - m.y, len = Math.max(1, Math.hypot(dx, dy)), step = Math.max(18, len / n);
        for (let i = 0; i < n; i++) { const k = Math.min(len + 10, step * (i + 1)); ring(m.x + dx / len * k, m.y + dy / len * k, a.tell + i * (a.over ?? .2), B * (a.b ?? 1)); }
        break;
      }
      case 'raise':
        for (const [i, cp] of this.raisable(m, a).entries()) {
          this.calls.push({ x: cp.x, y: cp.y, type: cp.kind.id, key: `${m.key}:raise${i}:${Math.round(this.clock * 10)}`, t: a.tell, level: m.def.level, by: m, corpse: cp.id, pct: a.raise!.pct, ...(m.personal ? { personal: true } : {}) });
          this.bursts.push({ x: cp.x, y: cp.y, t: a.tell, delay: a.tell, r: 11, dmg: 0, el: 'raise', tone: a.tone, by: m, fx: true });
        }
        break;
      case 'mend': {
        const kin = this.kinOf(m, (a.r ?? 4) * ATILE).sort((p, q) => p.hp / p.def.hp - q.hp / q.def.hp)[0];
        if (kin) this.bursts.push({ x: kin.x, y: kin.y, t: a.tell, delay: a.tell, r: 12, dmg: 0, el: 'life', tone: 'life', by: m, fx: true });
        break;
      }
      default: break;
    }
  }
  /** The tell ran out: the line strikes, the cone breathes, the fan looses, the ward lands, the bat shrieks. */
  private releaseAbility(m: Mob): void {
    const i = m.abCast!, a = castable(m.def.id)[i];
    m.abCast = undefined;
    if (i === -1 && m.aim) {
      // Brutal's heavy blow: whoever still stands where the red arc pointed.
      const ax = m.aim.x, ay = m.aim.y + 12, B = this.blowB(m) * BRUTAL.share;
      this.effects.push({ kind: 'slash', x: ax, y: ay - 10, age: 0, life: .25, dir: m.face });
      for (const k of this.keepersIn(ax, ay, MOB_REACH + 8)) this.strikeKeeper(k, B, this.blowType(m), m, '');
      return;
    }
    if (!a) return;
    const aim = m.aim ?? { x: m.x + m.face * 20, y: m.y - 12 }, ax = aim.x, ay = aim.y + 12;
    const B = this.blowB(m), type: DamageType = a.el ?? this.blowType(m), st = this.statusOf(a.st, B, a.pull ?? 0);
    switch (a.kind) {
      case 'spit': case 'fan': case 'wave': {
        const n = a.kind === 'spit' ? 1 : a.n ?? 3, step = (a.spread ?? 15) * Math.PI / 180, speed = a.kind === 'wave' ? 130 : 150;
        const kind: MobShot['kind'] = a.kind === 'wave' ? 'breath' : type === 'fire' ? 'fire' : 'arrow';
        const sx = m.x + m.face * m.def.w * .3, lift = m.def.h * .55, range = (a.r ?? a.reach) * ATILE;
        for (let k = 0; k < n; k++) {
          const s = aimShot(sx, m.y - lift, ax, ay - 12, speed * (m.bless?.fx.shotSpeed ?? 1), range / 1.4, Math.round(B * (a.b ?? 1)), kind, (k - (n - 1) / 2) * step);
          this.shots.push({ ...s, lift, land: 12, reach: Math.hypot(ax - sx, ay - m.y), type, lv: m.def.level, ...(st ? { st } : {}) });
        }
        break;
      }
      case 'line': {
        const dx = ax - m.x, dy = ay - m.y, len = Math.max(1, Math.hypot(dx, dy)), far = (a.reach + .5) * ATILE;
        const ex = m.x + dx / len * far, ey = m.y + dy / len * far, half = (a.r ?? .6) * ATILE;
        this.effects.push({ kind: 'slash', x: (m.x + ex) / 2, y: (m.y + ey) / 2 - 6, age: 0, life: .25, dir: m.face });
        const p = this.host.player();
        const targets = [...(!this.selfAway ? [{ self: true, id: '', x: p.x, y: p.y }] : []), ...this.others.map(o => ({ self: false, id: o.id, x: o.x, y: o.y }))];
        for (const k of targets) if (segDist(m.x, m.y, ex, ey, k.x, k.y) <= half && this.sight.sees(m.x, m.y, k.x, k.y)) this.strikeKeeper(k, B * (a.b ?? 0), type, m, st);
        break;
      }
      case 'burrow': {
        // It rises where the stir was (the ring has struck already).
        // A body-width to the side of the stir it broke (never inside the Keeper it came up under).
        const rx = ax + (m.x <= ax ? -1 : 1) * Math.max(10, m.def.w * .4);
        if (this.free(rx, ay, m.def.floats)) { m.x = rx; m.y = ay; } else if (this.free(ax, ay + 10, m.def.floats)) { m.x = ax; m.y = ay + 10; }
        m.hidden = 0;
        for (let k = 0; k < 4; k++) this.effects.push({ kind: 'dust', x: m.x + rnd(-6, 6), y: m.y, age: 0, life: .5, dir: 1 });
        break;
      }
      case 'ward': {
        const kin = this.kinOf(m, (a.r ?? 5) * ATILE).filter(k => k !== m && !(k.ward ?? 0)).sort((p, q) => p.hp / p.def.hp - q.hp / q.def.hp)[0];
        if (kin) { kin.ward = Math.round(B * (a.amt ?? 3)); kin.wardT = a.secs ?? 6; this.effects.push({ kind: 'ward', x: kin.x, y: kin.y - kin.def.h / 2, age: 0, life: .5, dir: 1 }); }
        break;
      }
      case 'mend':
        for (const k of this.kinOf(m, (a.r ?? 4) * ATILE)) { k.mendT = a.secs ?? 3; k.mendPct = a.amt ?? .06; this.effects.push({ kind: 'heal', x: k.x, y: k.y - k.def.h / 2, age: 0, life: .5, dir: 1 }); }
        break;
      case 'howl':
        for (const k of this.kinOf(m, (a.r ?? 6) * ATILE)) if (k.def.id === m.def.id) k.howlT = a.secs ?? 4;
        this.effects.push({ kind: 'cry', x: m.x, y: m.y, r: (a.r ?? 6) * ATILE, age: 0, life: .4, dir: 1 });
        break;
      case 'shriek':
        this.effects.push({ kind: 'cry', x: m.x, y: m.y, r: (a.r ?? 2) * ATILE, age: 0, life: .4, dir: 1 });
        for (const k of this.keepersIn(m.x, m.y, (a.r ?? 2) * ATILE)) this.strikeKeeper(k, 0, type, m, st);
        break;
      case 'blink': {
        const dx = ax - m.x, dy = ay - m.y, len = Math.max(1, Math.hypot(dx, dy)), go = Math.min((a.r ?? 3) * ATILE, Math.max(0, len - 16));
        const bx = m.x + dx / len * go, by = m.y + dy / len * go;
        if (this.free(bx, by, m.def.floats)) { this.effects.push({ kind: 'spark', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .3, dir: 1 }); m.x = bx; m.y = by; }
        m.emberBite = a.st;
        break;
      }
      default: break;
    }
  }
  /** A Stun, a Freeze or a Hush in a cast's tell (§1.2): it is cancelled, its rings and sigils taken back, its cooldown at half. */
  private interruptCast(m: Mob): void {
    const i = m.abCast;
    if (i === undefined) return;
    const a = castable(m.def.id)[i];
    m.abCast = undefined; m.tell = 0; m.aim = null; m.hidden = 0;
    if (a && m.ab) m.ab[i] = tierCd(a.cd, this.tier.id) * .5;
    for (let k = this.bursts.length - 1; k >= 0; k--) if (this.bursts[k].by === m) this.bursts.splice(k, 1);
    for (let k = this.calls.length - 1; k >= 0; k--) if (this.calls[k].by === m) this.calls.splice(k, 1);
    this.float(m.x, m.y - m.def.h - 6, '!', '#f3e7cf');
  }
  /** A blow lands from `m`: what it lays (Scrape's bleed, Will-o'-the-Fen's burn), heals (Vampiric), wakes (Whispering). */
  private biteRiders(m: Mob, n: number, self: boolean): string {
    const lays: { s: KeeperStatus; t: number; dps?: number }[] = [];
    const B = (m.def.dmg[0] + m.def.dmg[1]) / 2;
    for (const a of ABIL_PASSIVE(m.def.id)) for (const x of a.st ?? []) lays.push({ s: x.s, t: x.t, ...(x.b ? { dps: x.b * B } : {}) });
    if (m.emberBite) { for (const x of m.emberBite) lays.push({ s: x.s, t: x.t, ...(x.b ? { dps: x.b * B } : {}) }); m.emberBite = undefined; }
    const ax = m.elite?.affixes;
    if (ax?.includes('vampiric')) m.hp = Math.min(m.def.hp, m.hp + n * VAMPIRIC);
    if (self && ax?.includes('whispering')) this.hushOwed += WHISPER_HUSH;
    return lays.length ? encodeStatus(lays) : '';
  }
  /** A member: the host's hostile ground, to draw and to feel (its statuses land here; its damage is the host's). */
  fieldSeen(e: { x: number; y: number; r: number; t: number; tn: string; st?: string }): void {
    const st = e.st && /^(stun|root|chill|freeze|blind|wet|weak|dark)$/.test(e.st) ? e.st as KeeperStatus : undefined;
    this.layHazard({ x: e.x, y: e.y, r: e.r, t: e.t, dps: 0, ...(st ? { st } : {}), tone: e.tn as TellTone });
  }
  /** Test hooks only (the S6 shots): it lies down dead where it stands — a corpse, no loot, no XP. */
  fxLayDead(m: Mob): void {
    const i = this.mobs.indexOf(m);
    if (i >= 0) this.mobs.splice(i, 1);
    this.leaveCorpse(m);
  }
  /** Test hooks only (the S6 shots, `?fxs6=`): a creature begins one of its abilities at (x, y) now, as if it had chosen to. */
  fxCast(m: Mob, i: number, x: number, y: number): boolean {
    const a = castable(m.def.id)[i];
    if (!a || !this.ready(m, a)) return false;
    if (a.words) { m.chantT = CHANT_SECS; m.chantText = a.words; }
    m.face = x < m.x ? -1 : 1;
    m.abCast = i; m.tell = Math.max(a.tell, .3); m.aim = { x, y: y - 12 };
    (m.ab ??= castable(m.def.id).map(() => 0))[i] = a.cd;
    this.beginAbility(m, a, x, y);
    return true;
  }
  /** A member saw the room raise one: the corpse there is up and walking (its own copy goes). */
  raiseSeen(x: number, y: number): void {
    let bi = -1, bd = 12;
    this.remains.forEach((cp, i) => { const d = Math.hypot(cp.x - x, cp.y - y); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) this.remains.splice(bi, 1);
  }
  /** A pack aura's strip (Unmaking, Strip, Banish the Bearer): its aura ends a while (§3, bosses 1/5). */
  stripAura(m: Mob): void {
    const bearer = m.aura ? m : m.bless?.by;
    if (!bearer) return;
    bearer.auraOffT = ccSecs(PACK_STRIP_SECS, bearer.def.rank);
    this.effects.push({ kind: 'pulse', el: 'shadow', x: bearer.x, y: bearer.y, age: 0, life: .5, dir: 1 });
  }

  /** A gap-closer crossing (MobDef.charge): on to its spot, then the blow lands on whatever stands there. */
  private stepDash(m: Mob, dt: number): void {
    const ch = m.def.charge, to = m.dash!;
    to.t -= dt;
    const dx = to.x - m.x, dy = to.y - m.y, len = Math.hypot(dx, dy), step = (ch?.speed ?? 200) * dt;
    if (len > step && to.t > 0) {
      const nx = m.x + dx / len * step, ny = m.y + dy / len * step;
      if (this.canStep(m, nx, ny)) { m.x = nx; m.y = ny; if (Math.abs(dx) > 1) m.face = dx < 0 ? -1 : 1; return; }
    } else if (len <= step) { m.x = to.x; m.y = to.y; }
    m.dash = null; m.cd = Math.max(m.cd, .6);
    if (!ch) return;
    this.effects.push({ kind: 'wave', el: 'ember', r: Math.round(CHARGE_HIT * 1.2), x: m.x, y: m.y, age: 0, life: .45, dir: 1 });
    const p = this.host.player();
    let n = rnd(ch.dmg[0], ch.dmg[1]);
    const weak = this.weakOf(m);
    if (weak > 0) n = Math.max(1, Math.round(n * (1 - weak / 100)));
    if (Math.hypot(p.x - m.x, p.y - m.y) <= CHARGE_HIT && this.sight.sees(m.x, m.y, p.x, p.y)) { this.biteKeeper(n, this.blowType(m), m); this.eliteBlow(m); }
    for (const k of this.minions) if (Math.hypot(k.x - m.x, k.y - m.y) <= CHARGE_HIT && this.sight.sees(m.x, m.y, k.x, k.y)) this.hurtMinion(k, n);
  }

  /** Returns the life the blow took (after spell power, a crit and a Stone Skin), 0 on a foe already down. */
  private hitFoe(foe: Mob, raw: number, color: string, src: SkillId | null = this.src): number {
    // The Skill Book's marks: what makes this hit land harder (td-marks; markHitMult says each).
    if (foe.hp > 0) raw *= this.markHitMult(foe, src);
    // A worn unique's echo (unique-items.ts strike-double): every n-th hit the Keeper lands, each piece on its own beat.
    if (this.relics.echo.length && foe.hp > 0) {
      this.hitCount++;
      for (const e of this.relics.echo) if (this.hitCount % e.every === 0) raw *= 1 + e.pct / 100;
    }
    // Worn boss uniques: the Hammer bites constructs harder; the Censer's ink makes a stained foe take more, and stains.
    if (this.relics.construct > 0 && isConstruct(foe.def.id)) raw *= 1 + this.relics.construct / 100;
    // The Seamstitch Grips (the Seam Eater's): every hit harder while the sky is dark (night, or an eclipse's noon).
    if (this.relics.umbra > 0 && (this.phase === 'night' || this.phase === 'eclipse')) raw *= 1 + this.relics.umbra / 100;
    const ink = this.relics.ink;
    if (ink) {
      if ((foe.inkT ?? 0) > 0) raw *= 1 + ink.pct / 100;
      else this.effects.push({ kind: 'pulse', el: 'shadow', x: foe.x, y: foe.y, age: 0, life: .25, dir: 1 });
      foe.inkT = ink.secs;
    }
    // Unveiled by Dawn at Noon: it takes more from every hit while the daylight holds it.
    if ((foe.revealT ?? 0) > 0) raw *= 1 + DAWN_REVEAL / 100;
    // The worn aura: Might lifts every hit; Conviction's lost resistance is that much more damage on a foe near.
    if (this.itemAura) { raw *= this.itemAura.fx.damage; if (this.itemAura.fx.resistLower > 0 && this.inItemAura(foe)) raw *= 1 + this.itemAura.fx.resistLower / 100; }
    // S6: blinded, half his own blows go astray; weakened (a spore cloud), they land softer.
    if (this.claimFrom === '' && this.kst.blind > 0 && Math.random() < .5) { this.float(foe.x, foe.y - foe.def.h, 'miss', '#9a948a'); return 0; }
    if (this.kst.weak > 0) raw *= 1 - SPORE_WEAKEN;
    // His fire turns what it fells to ash (nothing raises it) and clears a web or a cloud it touches.
    this.fireBlow = !!src && FIRE_SKILLS.has(src);
    if (this.fireBlow) this.burnHazards(foe.x, foe.y, 8);
    const crit = this.forceCrit || (this.crit > 0 && Math.random() < this.crit);
    const dmg = Math.round(raw * this.power * (crit ? CRIT_MULT : 1));
    if (this.aura === 'aura-siphon' && this.rank('aura-siphon') > 0) {
      // Vampire's Patience (a mark): twice as much while the Keeper's life runs low.
      const low = this.mk('aura-siphon', 'lowDouble'), heal = this.v('aura-siphon')['heal'] * (low && this.lifeShare() < (low.n ?? 0) / 100 ? 2 : 1);
      this.host.healPlayer(heal);
      // Siphon Kin: the raised mend a share of it too. Mana Siphon: a little mana with it.
      const kin = this.mk('aura-siphon', 'kinHeal');
      if (kin) this.healKin(heal * (kin.n ?? 0) / 100);
      const mana = this.mk('aura-siphon', 'manaHit');
      if (mana) this.mana = Math.min(this.maxMana, this.mana + (mana.n ?? 0));
      this.effects.push({ kind: 'pulse', el: 'life', x: foe.x, y: foe.y, age: 0, life: .2, dir: 1 });
    }
    if (crit) this.effects.push({ kind: 'crit', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .15, dir: 1 });
    // Ember Blood (the Ashguard's passive): a share of every blow he lands comes back as life.
    // Life Steal (worn, a fighter's: rpg/item-calling.ts): a share of every blow he lands comes back as life.
    if (this.leech > 0 && foe.hp > 0) {
      this.leechOwed += Math.min(dmg, foe.hp) * this.leech;
      const whole = Math.floor(this.leechOwed);
      if (whole > 0) { this.leechOwed -= whole; this.host.healPlayer(whole); }
    }
    if (this.melee && this.rank('ember-blood') > 0 && foe.hp > 0) {
      this.bloodOwed += Math.min(dmg, foe.hp) * this.v('ember-blood')['pct'] / 100;
      const whole = Math.floor(this.bloodOwed);
      if (whole > 0) { this.bloodOwed -= whole; this.host.healPlayer(whole); }
    }
    const was = foe.hp > 0;
    // A shared creature falls on the room's word (coopFell), not here: remember whose blow this Keeper landed last.
    if (this.replica) foe.lastSrc = src;
    this.killSrc = src;
    const dealt = this.hurtMob(foe, dmg, color, crit);
    this.killSrc = null; this.fireBlow = false;
    if (was && dealt > 0 && src) this.markHit(foe, src, raw, dealt);
    return dealt;
  }
  /** The blow landing now is fire (a fire skill, a member's fire claim): its fall leaves ash. */
  private fireBlow = false;
  /** A sure crit on the next hit (a mark's: Hunter's Rhythm, Leaf-Shadow) while it is set. */
  private forceCrit = false;
  /** The Keeper's life as a share of his most (1 when the host cannot say). */
  private lifeShare(): number { const hp = this.host.playerHp?.(); return hp === undefined || !(this.keeperMaxHp > 0) ? 1 : hp / this.keeperMaxHp; }
  /** Mend the raised a little (Share the Cup, Siphon Kin): each one, never past its most. */
  private healKin(n: number): void {
    const k = Math.round(n);
    if (k <= 0) return;
    for (const m of this.minions) if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + k);
  }
  /** Does a creature carry a status now (the marks' `vsStatus` / `vuln` read it)? */
  private hasStatus(m: Mob, st: MarkStatus): boolean {
    switch (st) {
      case 'burn': return (m.scorchT ?? 0) > 0 || m.cursed > 0 || (m.brandT ?? 0) > 0 || (m.singeT ?? 0) > 0;
      case 'bleed': return (m.bleedT ?? 0) > 0;
      case 'chill': return (m.chillT ?? 0) > 0;
      case 'stun': return (m.stun ?? 0) > 0;
      case 'root': return (m.rootT ?? 0) > 0;
      case 'blind': return (m.blindT ?? 0) > 0;
      case 'hush': return (m.hushT ?? 0) > 0;
      case 'taunt': return (m.taunt ?? 0) > 0;
      case 'fear': return (m.fearT ?? 0) > 0;
      case 'weaken': return (m.weak ?? 0) > 0;
    }
  }
  /**
   * What the Skill Book's marks add to one hit (td-marks): the row's own `vsStatus` (Dry Season, Sure Footing,
   * Mark-Seeker), every row's `vuln` (Brittle, Festering), a Sunder's stacks, Searching Light on the dead, the Lantern
   * Aura's bane, the commanded foe, the Vow's wrath.
   */
  private markHitMult(foe: Mob, src: SkillId | null): number {
    if (!this.marks) return 1;
    let k = 1;
    if (src) {
      const vs = this.mk(src, 'vsStatus');
      if (vs?.st && this.hasStatus(foe, vs.st)) k *= 1 + (vs.n ?? 0) / 100;
      const bane = this.mk(src, 'bane');
      if (bane && shadowBorn(foe.def.id)) k *= 1 + (bane.n ?? 0) / 100;
    }
    for (const id of ['weaken', 'barbed-shot'] as const) {
      const vu = this.mk(id, 'vuln');
      if (vu?.st && this.hasStatus(foe, vu.st)) k *= 1 + (vu.n ?? 0) / 100;
    }
    const sunder = this.mk('cinder-cleave', 'sunder');
    if (sunder && (foe.sunderT ?? 0) > 0) k *= 1 + (sunder.n ?? 0) * (foe.sunderN ?? 0) / 100;
    if (this.lamp && this.aura === 'lantern-aura' && shadowBorn(foe.def.id)) {
      const ba = this.mk('lantern-aura', 'baneAura'), p = this.host.player();
      if (ba && Math.hypot(foe.x - p.x, foe.y - p.y) <= this.v('lantern-aura')['radius'] * TILE) k *= 1 + (ba.n ?? 0) / 100;
    }
    const cmd = this.mk('command', 'vsCommanded');
    if (cmd && foe === this.commanded) k *= 1 + (cmd.n ?? 0) / 100;
    const wrath = this.mk('last-watch', 'wrath');
    if (wrath && this.vowT > 0) k *= 1 + (wrath.n ?? 0) / 100;
    return k;
  }
  /**
   * The marks a hit of `src` carries once it has landed (`raw`: the blow before spell power; `dealt`: what it took):
   * its riders (td-marks `rider`), a ward from the blow (absorbHit), life back (healHit, the Vow for Two), a Sunder's
   * stack, a jump to the next foe.
   */
  private markHit(foe: Mob, src: SkillId, raw: number, dealt: number): void {
    if (!this.marks) return;
    this.ride(src, foe, raw);
    const ab = this.mk(src, 'absorbHit');
    if (ab) { this.markShield = Math.min(ab.m ?? 0, this.markShield + (ab.n ?? 0)); this.markShieldT = ab.s ?? 0; }
    const hh = this.mk(src, 'healHit');
    if (hh) this.healOwed((dealt * (hh.n ?? 0)) / 100);
    const vl = this.mk('last-watch', 'vowLeech');
    if (vl && this.vowT > 0) this.healOwed((dealt * (vl.n ?? 0)) / 100);
    // Wild Blood: while Pack Bond runs, the beasts' bites heal the Keeper.
    const wb = this.mk('pack-bond', 'biteHeal');
    if (wb && this.aura === 'pack-bond' && (src === 'call-of-the-wilds' || src === 'stampede')) this.healOwed((dealt * (wb.n ?? 0)) / 100);
    if (src === 'cinder-cleave' && this.mk(src, 'sunder')) { const s = this.mk(src, 'sunder')!; foe.sunderN = Math.min(s.m ?? 1, (foe.sunderN ?? 0) + 1); foe.sunderT = s.s ?? 0; }
    const j = this.mk(src, 'jump');
    if (j && !this.jumping && Math.random() * 100 < (j.c ?? 100)) {
      const p = this.host.player(), reach = (j.s ?? 0) * TILE;
      const next = this.mobs.filter(m => m !== foe && m.hp > 0 && Math.hypot(m.x - foe.x, m.y - foe.y) <= reach && this.sight.sees(foe.x, foe.y, m.x, m.y))
        .sort((a, b) => Math.hypot(a.x - foe.x, a.y - foe.y) - Math.hypot(b.x - foe.x, b.y - foe.y)).slice(0, j.m ?? 1);
      this.jumping = true;
      try {
        for (const m of next) {
          this.effects.push({ kind: 'drain', x: foe.x, y: foe.y - foe.def.h / 2, tx: m.x, ty: m.y - m.def.h / 2, age: 0, life: .3, dir: 1 });
          this.hitFoe(m, raw * (j.n ?? 0) / 100, '#ffd25a', null);
        }
      } finally { this.jumping = false; }
      void p;
    }
  }
  private jumping = false;
  /** A mark's ward from its blows (Cinder Ward, Iron Lesson; Grave Thirst's overflow): it drinks a blow before the Bone Armor. */
  markShield = 0;
  markShieldT = 0;
  /** Life owed by the marks' small heals (whole points paid, the rest carried). */
  private markHealOwed = 0;
  private healOwed(n: number): void {
    if (!(n > 0)) return;
    this.markHealOwed += n;
    const whole = Math.floor(this.markHealOwed);
    if (whole > 0) { this.markHealOwed -= whole; this.host.healPlayer(whole); }
  }
  /**
   * Lay a row's rider statuses on a creature (td-marks `rider`): a burn or a bleed at its share of `raw` a second, a
   * chill, a stun, a root, a blind, a hush, a taunt, a fear — a boss's crowd-control a fifth as long (td-melee ccSecs).
   */
  private ride(src: SkillId, m: Mob, raw: number): void {
    const mask = this.markMask(src);
    if (!mask || m.hp <= 0) return;
    for (const r of markRiders(src, mask)) {
      if (r.chance !== undefined && Math.random() * 100 >= r.chance) continue;
      this.applyStatus(m, r.st, r.secs, r.pct !== undefined ? raw * r.pct / 100 : 0);
    }
  }
  private applyStatus(m: Mob, st: MarkStatus, secs: number, dps = 0): void {
    const cc = ccSecs(secs, m.def.rank);
    switch (st) {
      case 'burn':
        if (dps > 0) {
          const live = (m.scorchT ?? 0) > 0;
          m.scorchDps = Math.max(live ? m.scorchDps ?? 0 : 0, Math.round(dps * 10) / 10);
          m.scorchT = Math.max(live ? m.scorchT ?? 0 : 0, secs);
          m.scorchTick = live && (m.scorchTick ?? 0) > 0 ? m.scorchTick : 1;
        }
        break;
      case 'bleed': {
        const b = addBleed((m.bleedT ?? 0) > 0 ? { t: m.bleedT ?? 0, dps: m.bleedDps ?? 0 } : null, dps, secs);
        m.bleedT = b.t; m.bleedDps = b.dps; m.bleedTick = (m.bleedTick ?? 0) > 0 ? m.bleedTick : 1;
        break;
      }
      // A chill on a creature standing in the rain freezes it a moment (Wet), then chills it as ever.
      case 'chill': if (this.weatherWet) m.stun = Math.max(m.stun ?? 0, ccSecs(1, m.def.rank)); m.chillT = Math.max(m.chillT ?? 0, cc); break;
      case 'stun': m.stun = Math.max(m.stun ?? 0, cc); break;
      case 'root': m.rootT = Math.max(m.rootT ?? 0, cc); break;
      case 'blind': m.blindT = Math.max(m.blindT ?? 0, cc); break;
      case 'hush':
        m.hushT = Math.max(m.hushT ?? 0, cc);
        // An interrupt: a boss's wind-up in progress is cancelled (skills-100.md §0.4).
        if (m.abCast !== undefined) this.interruptCast(m);
        if (m.tell > 0) { m.tell = 0; m.aim = null; m.charging = false; }
        break;
      case 'taunt': m.taunt = Math.max(m.taunt ?? 0, cc); break;
      case 'fear': m.fearT = Math.max(m.fearT ?? 0, cc); break;
      case 'weaken': break;
    }
  }
  /**
   * A burn's or a bleed's tick. In the room (protocol 10) it is the blow of the Keeper who laid it (who fought it),
   * charged to that Keeper's claim budget (`dotGate`); on a screen, this Keeper's own as before.
   */
  private dotTick(m: Mob, dps: number, color: string, by: string | undefined, src?: SkillId | null): void {
    if (!by || !this.dotGate) { if (src === undefined) this.hitFoe(m, dps, color); else this.hitFoe(m, dps, color, src); return; }
    const n = this.dotGate(by, dps);
    if (!(n >= 1)) return;
    const was = this.claimFrom;
    this.claimFrom = by;
    try { this.hurtMob(m, n, color); } finally { this.claimFrom = was; }
  }
  /**
   * Protocol 10 (the room, play/world/room-status.ts): a Keeper's status on one of its creatures, already judged legal
   * and bounded — laid through the same rules as on a screen (applyStatus: a boss a fifth as long, a hush or a stun in
   * a tell cancels the cast), with whose it is: a taunt turns it on that Keeper, a fear sends it away from it.
   */
  roomStatus(m: Mob, kind: string, secs: number, o: { by: string; at: { x: number; y: number }; dps?: number; pct?: number; tiles?: number }): boolean {
    if (!this.mobs.includes(m) || m.hp <= 0) return false;
    switch (kind) {
      case 'stun': case 'root': case 'chill': case 'blind': case 'hush': case 'taunt': case 'fear':
        this.applyStatus(m, kind, secs);
        if (kind === 'taunt') m.tauntBy = o.by;
        if (kind === 'fear') m.fearFrom = { x: o.at.x, y: o.at.y };
        // A stun lands in a cast's tell: the cast is cancelled (the screen's rule: update() does it a frame later).
        if (kind === 'stun' && m.abCast !== undefined && m.tell > 0) this.interruptCast(m);
        return true;
      case 'slow':
        m.slowT = Math.max(m.slowT ?? 0, ccSecs(secs, m.def.rank)); m.slowPct = Math.max((m.slowT ?? 0) > 0 ? m.slowPct ?? 0 : 0, o.pct ?? 0);
        return true;
      case 'burn': case 'bleed':
        if (!((o.dps ?? 0) > 0)) return false;
        this.applyStatus(m, kind, secs, o.dps ?? 0);
        if (kind === 'burn') m.scorchBy = o.by; else m.bleedBy = o.by;
        return true;
      case 'strip':
        if (!m.elite && !m.aura && !m.bless) return false;
        this.strip(m, secs);
        return true;
      case 'pull': {
        const d = Math.hypot(m.x - o.at.x, m.y - o.at.y);
        if (d < 12 || m.def.rank === 'boss') return false;
        this.knock(m, (o.at.x - m.x) / d, (o.at.y - m.y) / d, Math.min(d - 10, (o.tiles ?? 0) * TILE));
        m.hx = m.x; m.hy = m.y;
        return true;
      }
    }
    return false;
  }
  /**
   * Protocol 10: the skill (and mark) a status this Keeper laid came from, for its claim — the skill being cast, else
   * the last one cast, else any it holds that can lay it (statusSources: the room checks the pair against the data).
   */
  statusSkill(sources: readonly { s: SkillId; m?: string }[]): { s: SkillId; m?: string } | null {
    const holds = (x: { s: SkillId; m?: string }) => this.rank(x.s) > 0 && (!x.m || (this.markMask(x.s) & ({ a1: 1, a2: 2, a3: 4, b1: 8, b2: 16, b3: 32 } as Record<string, number>)[x.m]) !== 0);
    for (const want of [this.src, this.lastCast]) {
      if (!want) continue;
      const hit = sources.find(x => x.s === want && holds(x)) ?? sources.find(x => x.s === want);
      if (hit) return hit;
    }
    return sources.find(holds) ?? null;
  }
  /**
   * Protocol 10: how much this Keeper's own ground slows a creature now (Firebreak's fire, a Hearth Circle), 0..1 —
   * on a room's creature it is claimed as a slow (the room carries it to every screen).
   */
  slowShare(m: Mob): number {
    let pace = this.firebreak(m);
    for (const z of this.zones) if (z.kind === 'hearth' && inDisc(m.x, m.y, z.x, z.y, z.r)) { pace *= 1 - z.max / 100; break; }
    return Math.max(0, Math.min(.9, 1 - pace));
  }
  /** A small line over a creature (the room refused a blow: out of sight, too far, blocked). */
  cue(m: Mob, text: string, color = '#c9c2b0'): void { this.float(m.x, m.y - m.def.h - 10, text, color); }
  /** Test hooks only (the chain's e2e): fell a creature at once, through the real kill (onKill, its Gold and loot). */
  smite(m: Mob): void { this.hurtMob(m, Math.max(1, m.hp), '#ffffff', false, true); }
  /** Test hooks only (the seam specs): one blow of `n` on a creature, through the real path (its call, its half-life change, its fall). */
  wound(m: Mob, n: number): number { return this.hurtMob(m, Math.max(1, Math.round(n)), '#ffffff', false, true); }
  /** Damage dealt to a creature (by the Keeper's spells or his raised): the number floats, a boss may call help, it may fall. */
  private hurtMob(foe: Mob, dmg: number, color: string, crit = false, exact = false): number {
    if (foe.hp <= 0) return 0;
    // Underground (a burrow, S6): nothing reaches it until it rises.
    if ((foe.hidden ?? 0) > 0 && !exact) return 0;
    // The level gap (td-zones LEVEL_GAP): a creature above the Keeper is missed more and hurt less (D2's to-hit by level).
    // `exact`: a test hook's blow (smite, wound) lands as written.
    // A member's claim landing on the host was already cut by that member's own gap (td-coop: claimFrom).
    const gap = this.levelGap && !exact && this.claimFrom === '' ? levelGap(this.keeperLevel, foe.def.level) : 0;
    if (gap > 0) {
      if (Math.random() < gapMiss(gap)) { foe.hit = .1; this.float(foe.x, foe.y - foe.def.h, 'miss', '#9a948a'); return 0; }
      // Rounded by chance, so a small tick keeps its share on average (a 2 at ×0.3 is a 1 three times in five, else 0).
      const cut = dmg * gapDealt(gap);
      dmg = Math.floor(cut) + (Math.random() < cut % 1 ? 1 : 0);
      if (dmg <= 0) { foe.hit = .1; return 0; }
    }
    // A member under a host: the blow is shown here and claimed from the host, which decides (td-coop.ts, ClaimGate).
    // A personal creature is not the host's: its blows land here, as alone.
    if (this.replica && !foe.personal) {
      const n = Math.max(1, Math.round(dmg));
      foe.hit = .18;
      this.float(foe.x, foe.y - foe.def.h, crit ? `${n}!` : `${n}`, color);
      this.coop?.claim(foe, n, crit, color);
      return n;
    }
    // Who fought it (a shared creature's kill pays those who did in full): this Keeper, or the member whose claim this is.
    if (this.coop) (foe.coopBy ??= new Set()).add(this.claimFrom);
    // Stone Skin turns part of every hit aside.
    if (foe.take !== undefined && foe.take < 1) dmg = Math.max(1, Math.round(dmg * foe.take));
    // S6: Shielded by Kin (a follower near: half), a Bone Ward drinking first, Thorns returning a melee blow.
    if (foe.elite?.affixes.includes('shielded-by-kin') && this.mobs.some(k => k !== foe && samePack(foe, k) && Math.hypot(k.x - foe.x, k.y - foe.y) <= KIN_SHIELD.r)) dmg = Math.max(1, Math.round(dmg * KIN_SHIELD.take));
    if ((foe.ward ?? 0) > 0) { const soak = Math.min(foe.ward ?? 0, dmg); foe.ward = (foe.ward ?? 0) - soak; dmg -= soak; this.float(foe.x - 8, foe.y - foe.def.h - 4, `-${soak}`, '#e8e1cf'); if (dmg <= 0) { foe.hit = .1; return 0; } }
    if (foe.bless?.fx.thorns) this.thornsBack(foe, dmg);
    foe.hp -= dmg; foe.hit = .18;
    this.float(foe.x, foe.y - foe.def.h, crit ? `${dmg}!` : `${dmg}`, color);
    if (foe.hp <= 0) { this.kill(foe); return dmg; }
    // Grave-called (an affix): at half its life it calls two Bone Walkers up out of the ground.
    if (foe.elite?.affixes.includes('grave-called') && !foe.graveCalled && foe.hp <= foe.def.hp * GRAVE_CALL.at && MOBS['bone-walker']) {
      foe.graveCalled = true;
      for (let i = 0; i < GRAVE_CALL.count; i++) {
        const side = i % 2 ? -1 : 1, x = foe.x + side * (foe.def.w / 2 + 12), y = foe.y + 8, at = this.free(x, y) ? { x, y } : { x: foe.x, y: foe.y };
        this.calls.push({ x: at.x, y: at.y, type: 'bone-walker', key: `${foe.key}:grave${i}:${Math.round(this.clock * 10)}`, t: CALL_TELL, level: Math.max(1, foe.def.level - GRAVE_CALL.under), ...(foe.personal ? { personal: true } : {}) });
      }
    }
    const call = foe.def.summon;
    if (call && !foe.summoned && foe.hp <= foe.def.hp * call.at && MOBS[call.type]) {
      foe.summoned = true;
      for (let i = 0; i < call.count; i++) {
        const side = i % 2 ? -1 : 1, x = foe.x + side * (foe.def.w / 2 + 10), y = foe.y + 6;
        const at = this.free(x, y) ? { x, y } : { x: foe.x, y: foe.y };
        // A sigil first, where it will stand (CALL_TELL); it climbs out when the sigil runs out (update).
        this.calls.push({ x: at.x, y: at.y, type: call.type, key: `${foe.key}:call${i}:${Math.round(this.clock * 10)}`, t: CALL_TELL, level: callLevel(foe.def, MOBS[call.type]), ...(call.touched ? { touched: true } : {}), ...(foe.personal ? { personal: true } : {}) });
      }
    }
    // The half-life change (MobDef.half): a wider, quicker breath, more rings, sooner; its call spoken.
    const half = foe.def.half;
    if (half && !foe.halved && foe.hp <= foe.def.hp * .5) {
      foe.halved = true;
      foe.def = {
        ...foe.def,
        ...(foe.def.ranged ? { ranged: { ...foe.def.ranged, spread: half.spread, rate: half.rate } } : {}),
        ...(foe.def.rend ? { rend: { ...foe.def.rend, rings: half.rings, rate: half.rendRate } } : {}),
      };
      foe.chantT = CHANT_SECS; foe.chantText = half.chant;
      this.effects.push({ kind: 'wave', el: 'shadow', r: Math.round(foe.def.w * .6), x: foe.x, y: foe.y, age: 0, life: .6, dir: 1 });
    }
    return dmg;
  }
  /** Thorns (a pack aura): a share of a melee blow comes back on the striker standing at its side (at most its own blow). */
  private thornsBack(foe: Mob, dmg: number): void {
    const fx = foe.bless!.fx, back = Math.min(foe.def.dmg[1], dmg * fx.thorns);
    if (!(back >= 1)) return;
    const near = 36;
    if (this.claimFrom) { const o = this.others.find(k => k.id === this.claimFrom); if (o && Math.hypot(o.x - foe.x, o.y - foe.y) <= near) this.coop?.bite(o.id, foe, back, 'physical', false, false); return; }
    const p = this.host.player();
    if (!this.selfAway && Math.hypot(p.x - foe.x, p.y - foe.y) <= near) { this.biteKeeper(back, 'physical'); this.effects.push({ kind: 'bone-chips', x: p.x, y: p.y - 16, age: 0, life: .3, dir: 1 }); }
  }
  /**
   * A blow or a shot landing on the Keeper (§6): worn Defense turns a share of a physical one aside, a worn resist
   * of an element's; the Dark Ward drinks what it can. The number floats in the type's colour (physical stays red).
   */
  private biteKeeper(raw: number, type: DamageType = 'physical', from?: Mob, lv?: number): void {
    const p = this.host.player();
    // The level gap (td-zones LEVEL_GAP): a creature above the Keeper's level strikes far harder; never softer below it.
    const atk = lv ?? from?.def.level;
    if (this.levelGap && atk !== undefined && raw > 0) raw *= gapHurt(levelGap(this.keeperLevel, atk));
    // Taking its blows is fighting it too (a shared kill pays the one who held it off).
    if (from && this.coop && !this.replica) (from.coopBy ??= new Set()).add('');
    // A worn unique's thorns (unique-items.ts ward-mirror): a creature striking in melee takes a share of its blow back.
    if (from && from.hp > 0 && this.relics.thorns > 0 && raw > 0) this.hurtMob(from, Math.max(1, Math.round(raw * this.relics.thorns / 100)), '#e0b25a');
    // Cursed (an elite's mark): every resist lower and every blow a little harder while it lasts.
    const cursed = this.curseT > 0;
    // The marks' resists (Ember Shield, Kindled, Shield of Light, Fur and Leaf) while their aura runs; a pack's
    // Conviction (S6) takes its points off every one while he stands in its reach.
    const res = this.markResist(), conv = this.packResist;
    const resists = cursed || res.fire || res.all || conv ? Object.fromEntries(Object.entries(this.resists).map(([k, v]) => [k, (v ?? 0) - (cursed ? CURSE_RESIST : 0) - conv + res.all + (k === 'fire' ? res.fire : 0)])) as Partial<Record<Element, number>> : this.resists;
    // Hearth Bond (Hearthlight's mark): more Defense a while after the heal.
    const def = (this.melee ? this.guardDefense() : this.defense) * (this.defBuffT > 0 ? 1 + this.defBuffPct / 100 : 1);
    let n = incomingDamage(cursed ? raw * (1 + CURSE_HURT) : raw, type, def, atk ?? this.keeperLevel, resists);
    // Wet (shared/weather): lightning bites deeper, fire burns lower, and a cold hit freezes the Keeper a moment.
    if (this.kst.wet > 0 && n > 0) {
      if (type === 'lightning') n = Math.round(n * WET.lightningTaken);
      else if (type === 'fire') n = Math.max(1, Math.round(n * WET.fireTaken));
      else if (type === 'cold' && this.kst.immune <= 0) { this.kst.freeze = Math.max(this.kst.freeze, 1); this.kst.immune = 1 + KEEPER_CC_IMMUNE; }
    }
    // A worn shield's Block (§3.6): the blow is turned aside whole.
    if (n > 0 && this.gearBlock > 0 && Math.random() < this.gearBlock) {
      this.effects.push({ kind: 'oath', x: p.x, y: p.y - 16, age: 0, life: .3, dir: 2 });
      this.float(p.x, p.y - 34, '0', '#e0b25a');
      this.blocked(from);
      return;
    }
    // (Defense is read against the attacker's level, D2's way: worn armour holds better in a zone below the Keeper.)
    if (this.melee && n > 0) {
      // The Shield Oath turns a share of blows aside whole; the Watch Cry's guard takes a share off the rest.
      if (this.blockT > 0 && Math.random() < this.blockPct / 100) {
        this.effects.push({ kind: 'oath', x: p.x, y: p.y - 16, age: 0, life: .3, dir: 2 });
        this.float(p.x, p.y - 34, '0', '#e0b25a');
        this.blocked(from, true);
        return;
      }
      if (this.guardT > 0) n = Math.max(1, Math.round(n * (1 - this.guardPct / 100)));
    }
    // The marks' damage cuts: Shared Hurt (bonded), Rootwalk Party (while it runs), Warded Ground (in the circle).
    if (n > 0) n = this.markGuard(n);
    // A mark's ward (Cinder Ward, Iron Lesson, Grave Thirst) drinks first.
    if (this.markShield > 0 && n > 0) { const soak = Math.min(this.markShield, n); this.markShield -= soak; n -= soak; this.float(p.x - 12, p.y - 26, `-${soak}`, '#ffd25a'); }
    if (this.bone > 0 && n > 0) {
      const soak = Math.min(this.bone, n); this.bone -= soak; n -= soak; this.float(p.x - 8, p.y - 30, `-${soak}`, '#e8e1cf');
      // Splinter Back (a mark): what the bones drink comes back on the striker. Ossuary Coat: breaking, they rise.
      const th = this.mk('bone-armor', 'thorns');
      if (th && from && from.hp > 0) this.hurtMob(from, Math.max(1, Math.round(soak * (th.n ?? 0) / 100)), '#e9dcff');
      if (this.bone <= 0) this.boneBroke();
    }
    if (this.ward > 0 && n > 0) {
      const soak = Math.min(this.ward, n); this.ward -= soak; n -= soak; this.float(p.x + 8, p.y - 30, `-${soak}`, '#c8a8ff');
      // Ward the Fellowship (a mark): the Dark Ward bursts outward as it breaks.
      if (this.ward <= 0) this.wardBurst('dark-ward', this.wardMax);
    }
    // The Vow of the Last Watch: whatever comes, the Keeper keeps his last point of life; what it held off is counted.
    if (this.vowT > 0 && n > 0) { this.vowTaken += n; n = vowClamp(n, this.host.playerHp?.() ?? Infinity); }
    if (this.lamp && n > 0) n = this.lampGuard(n);
    // Pack Bond: the Keeper and his beast share the blows while it is near.
    if (this.thorn && n > 0 && this.bonded) n = bondShare(n, this.v('pack-bond')['guard']);
    // A worn unique's mercy (unique-items.ts temper-mercy): a blow that would fell him leaves him one point of life, once
    // every so many seconds.
    const life = this.host.playerHp?.() ?? Infinity;
    if (n > 0 && this.relics.mercy > 0 && this.mercyT <= 0 && n >= life && life > 1) {
      n = life - 1; this.mercyT = this.relics.mercy;
      this.effects.push({ kind: 'oath', x: p.x, y: p.y - 16, age: 0, life: .5, dir: 2 });
    }
    if (n > 0) { this.host.hurtPlayer(n); this.float(p.x, p.y - 34, `${n}`, type === 'physical' ? '#ff5a4a' : DAMAGE_COLORS[type]); }
  }
  /** Hearth Bond (a mark): seconds of more Defense left, and how much more (%). */
  defBuffT = 0;
  defBuffPct = 0;
  /** The marks' resists while their aura runs: fire alone, and every element. */
  private markResist(): { fire: number; all: number } {
    let fire = 0, all = 0;
    const add = (id: SkillId) => { const r = this.aura === id ? this.mk(id, 'resist') : null; if (r) { if (r.el === 'fire') fire += r.n ?? 0; else all += r.n ?? 0; } };
    add('aura-embers'); add('aura-watchfire'); add('lantern-aura'); add('pack-bond');
    return { fire, all };
  }
  /** The marks' cuts on a blow: Shared Hurt while bonded, Rootwalk Party while it runs, Warded Ground in the circle. */
  private markGuard(n: number): number {
    let k = 1;
    const sh = this.bonded ? this.mk('pack-bond', 'sharedHurt') : null;
    if (sh) k *= 1 - (sh.n ?? 0) / 100;
    const wg = this.rootwalkT > 0 ? this.mk('rootwalk', 'walkGuard') : null;
    if (wg) k *= 1 - (wg.n ?? 0) / 100;
    const zg = this.mk('hearth-circle', 'zoneGuard');
    if (zg && this.inCircle) k *= 1 - (zg.n ?? 0) / 100;
    return k === 1 ? n : Math.max(1, Math.round(n * k));
  }
  /** Is the Keeper inside his own Hearth Circle now? */
  private get inCircle(): boolean { const p = this.host.player(); return this.zones.some(z => z.kind === 'hearth' && inDisc(p.x, p.y, z.x, z.y, z.r)); }
  /**
   * A blow turned aside whole: the Shield Oath's marks (`oath`: Counterblow strikes back, The Shield Remembers heals,
   * Oathbound gives mana) and the Ember Brand's (Shield-Brand burns the striker), on any block.
   */
  private blocked(from: Mob | undefined, oath = false): void {
    if (from && from.hp > 0 && this.brandT > 0 && this.mk('ember-brand', 'blockBrand')) { from.brandT = 3; from.brandTick = 1; from.brandDps = this.v('ember-brand')['burn']; from.brandTicks = 3; }
    if (!oath) return;
    const co = this.mk('shield-oath', 'counter');
    if (co && from && from.hp > 0) this.hitFoe(from, meleeBlow(this.v('watch-blade')['min'], this.v('watch-blade')['max'], co.n ?? 0, Math.random, this.weaponSwing), '#efe6dc', null);
    const bh = this.mk('shield-oath', 'blockHeal');
    if (bh) this.healOwed(this.keeperMaxHp * (bh.n ?? 0) / 100);
    const bm = this.mk('shield-oath', 'blockMana');
    if (bm) this.mana = Math.min(this.maxMana, this.mana + (bm.n ?? 0));
  }
  /** The Bone Armor broke under a blow: Ossuary Coat (a mark) raises skeletons out of the pieces. */
  private boneBroke(): void {
    const oc = this.mk('bone-armor', 'breakRaise');
    if (!oc || this.rank('raise-skeleton') < 1) return;
    const p = this.host.player(), v = this.v('raise-skeleton'), st = this.raisedNow(v);
    for (let i = 0; i < (oc.n ?? 0); i++) {
      const at = this.slotOpen(formationSpot(this.minions.length, p, this.formFace()));
      this.minions.push({ id: this.minionSeq++, x: at.x, y: at.y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, cd: .6, t: 0, face: 1, life: Infinity, hit: 0, target: null });
      this.effects.push({ kind: 'raise', x: at.x, y: at.y, age: 0, life: .8, dir: 1 });
    }
    capMinions(this.minions, v['cap']);
  }
  /** A ward broke under a blow: its mark's burst (Ward the Fellowship, Self-Ward Too) strikes what stands near, a share of the whole ward. */
  private wardBurst(id: SkillId, whole: number): void {
    const wb = this.mk(id, 'breakBurst');
    if (!wb || !(whole > 0)) return;
    const p = this.host.player(), r = (wb.m ?? 0) * TILE, n = whole * (wb.n ?? 0) / 100 / Math.max(.1, this.power);
    for (const m of [...this.mobs]) if (Math.hypot(m.x - p.x, m.y - p.y) <= r && this.sees(m)) this.hitFoe(m, n, '#c8a8ff', null);
    this.effects.push({ kind: 'wave', el: 'shadow', x: p.x, y: p.y, age: 0, life: .5, dir: 1, r: Math.round(r) });
  }
  /** The Defense a blow meets on the Ashguard: his own, the Watchfire's, Hold the Line's lift when his life runs low. */
  guardDefense(): number {
    const aura = this.aura === 'aura-watchfire' && this.rank('aura-watchfire') > 0 ? this.v('aura-watchfire')['def'] : 0;
    const hold = this.rank('hold-the-line') > 0 ? { below: this.v('hold-the-line')['below'], pct: this.v('hold-the-line')['pct'] } : null;
    return guardedDefense(this.defense, aura, this.host.playerHp?.() ?? this.keeperMaxHp, this.keeperMaxHp, hold);
  }
  private hurtMinion(k: Minion, n: number): void {
    // Shared Bones (Bone Armor's mark): while the armour holds, the raised take less.
    const kg = this.bone > 0 ? this.mk('bone-armor', 'kinGuard') : null;
    if (kg) n = Math.max(1, Math.round(n * (1 - (kg.n ?? 0) / 100)));
    k.hp -= n; k.hit = .18;
    this.float(k.x, k.y - 26, `${n}`, '#c8a8ff');
  }

  /** A creature's shot (or a breath's fan of them) at (tx, ty). */
  private loose(m: Mob, tx: number, ty: number): void {
    const shoot = m.def.ranged;
    if (!shoot) return;
    // Multishot (an affix): three shots, 15° apart, each a share of one. Blessed Aim: they fly faster.
    const multi = (shoot.spread ?? 1) === 1 && !!m.elite?.affixes.includes('multishot');
    const n = multi ? MULTISHOT.n : shoot.spread ?? 1, turn = multi ? MULTISHOT.deg * Math.PI / 180 : .22, speed = shoot.speed * (m.bless?.fx.shotSpeed ?? 1);
    for (let i = 0; i < n; i++) {
      let dmg = Math.round(rnd(shoot.dmg[0], shoot.dmg[1]) * (multi ? MULTISHOT.share : 1) * (m.bless?.fx.blow ?? 1));
      const weak = this.weakOf(m);
      if (weak > 0) dmg = Math.max(1, Math.round(dmg * (1 - weak / 100)));
      const ax = m.elite?.affixes ?? [];
      // Its ground track (td-sight): from the creature's feet to the prey's, so a wall between stops it.
      const sx = m.x + m.face * m.def.w * .3, lift = m.def.h * .55, reach = Math.hypot(tx - sx, ty + 12 - m.y);
      this.shots.push({ ...aimShot(sx, m.y - lift, tx, ty, speed, shoot.range, dmg, shoot.kind, (i - (n - 1) / 2) * turn), lift, land: 12, reach, type: this.blowType(m), lv: m.def.level, ...(ax.includes('mana-burn') ? { burn: true } : {}), ...(ax.includes('cursed') ? { curse: true } : {}) });
    }
  }

  /** Creatures' shots and the Keeper's spears in flight. */
  private updateShots(dt: number): void {
    const p = this.host.player();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], sp = Math.hypot(s.vx, s.vy), x0 = s.x, g0 = groundY(s, s.y, s.age * sp);
      stepShot(s, dt);
      // A wall on its ground track: it breaks there (a puff of grit), whatever stands behind.
      const wall = this.wallOn(x0, g0, s.x, groundY(s, s.y, s.age * sp));
      if (wall) { this.shots.splice(i, 1); this.walled++; this.puff(wall.x, s.y + (wall.y - groundY(s, s.y, s.age * sp)), s.kind === 'ink' || s.kind === 'spore' ? 'shadow' : 'ember'); continue; }
      if (s.age > s.life) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); continue; }
      // A member under a host only sees the host's shots fly: the host decides what they hit.
      if (this.replica) continue;
      const reach = s.kind === 'breath' || s.kind === 'shard' ? 10 : 7;
      if (!this.selfAway && shotHits(s, p.x, p.y - 12, reach)) {
        this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .3, dir: 1 });
        // Wisp Ward (Lamp-Wisp's mark): a wisp at his shoulder takes the shot instead, once each.
        const ward = this.mk('lamp-wisp', 'wispWard') ? this.wisps.find(w => w.ward) : undefined;
        if (ward) { ward.ward = false; this.effects.push({ kind: 'kindle-hit', x: ward.x, y: ward.y, age: 0, life: .3, dir: 1 }); continue; }
        this.biteKeeper(s.dmg, s.type ?? 'physical', undefined, s.lv); this.shotAffixes(s); this.layOn(s.st); continue;
      }
      const o = this.others.find(k => shotHits(s, k.x, k.y - 12, reach));
      if (o) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .3, dir: 1 }); this.coop?.bite(o.id, null, s.dmg, s.type ?? 'physical', !!s.burn, !!s.curse, s.st); continue; }
      const k = this.minions.find(mn => shotHits(s, mn.x, mn.y - 10, 7));
      if (k) { this.shots.splice(i, 1); this.effects.push({ kind: 'spark', x: s.x, y: s.y, age: 0, life: .25, dir: 1 }); this.hurtMinion(k, s.dmg); }
    }
    const v = this.v('bone-spear');
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i], sp = Math.hypot(s.vx, s.vy), x0 = s.x, g0 = groundY(s, s.y, s.age * sp);
      s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
      // A wall stops a spear where it stands (it strikes nothing past it).
      const wall = this.wallOn(x0, g0, s.x, groundY(s, s.y, s.age * sp));
      if (wall) { this.spears.splice(i, 1); this.walled++; this.puff(wall.x, s.y + (wall.y - groundY(s, s.y, s.age * sp)), 'bone'); continue; }
      for (const m of [...this.mobs]) {
        if (s.hit.includes(m) || !shotHits(s, m.x, m.y - m.def.h / 2, Math.max(9, m.def.w / 3))) continue;
        s.hit.push(m);
        this.effects.push({ kind: 'bone-chips', x: s.x, y: s.y, age: 0, life: .35, dir: s.vx < 0 ? -1 : 1 });
        // Pierce (Bone Storm's mark): each foe a spear has already passed through makes it strike the next harder.
        const ps = s.src === 'bone-storm' ? this.mk('bone-storm', 'pierceStack') : null;
        const lift = ps ? 1 + Math.min(ps.m ?? 0, (ps.n ?? 0) * (s.hit.length - 1)) / 100 : 1;
        this.hitFoe(m, (s.dmg ? rnd(s.dmg[0], s.dmg[1]) : rnd(v['min'], v['max'])) * lift, '#e9dcff', s.src ?? 'bone-spear');
      }
      if (s.age > s.life) {
        this.spears.splice(i, 1);
        // Return of the Bone (a mark): the spear turns at its length and flies back, striking again at its share.
        if (s.back && s.dmg) this.spears.push({ x: s.x, y: s.y, vx: -s.vx, vy: -s.vy, age: 0, life: s.life, hit: [], dmg: [Math.max(1, Math.round(s.dmg[0] * s.back)), Math.max(1, Math.round(s.dmg[1] * s.back))], lift: s.lift, src: s.src });
      }
    }
  }

  /**
   * A pet's nip (td-pets.ts): a small blow on a creature, never on the Keeper. Not the Keeper's spell power or crits:
   * a pet's bite is its own size. `killed` when the creature fell to it.
   */
  petBite(foe: Mob, dmg: number, dir: number, from?: { x: number; y: number }): { landed: boolean; killed: boolean } {
    if (foe.hp <= 0 || !this.mobs.includes(foe)) return { landed: false, killed: false };
    // Never through a wall (td-sight): `from`, where the pet stands.
    if (from && !this.sight.sees(from.x, from.y, foe.x, foe.y)) return { landed: false, killed: false };
    this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .18, dir });
    // A Thornstrider's beast is one of the pack: its bite grows with him and with every Wild skill he holds.
    if (this.thorn) dmg = thornPetBlow(dmg, { level: this.keeperLevel, pct: this.beastPct(foe === this.commandFoe && this.commandT > 0) }) * (1 + this.damagePct * BEAST_DAMAGE_SHARE / 100);
    const dealt = this.hurtMob(foe, Math.max(1, Math.round(dmg)), this.thorn ? '#9af0d0' : '#ffd98a');
    if (this.thorn && foe.hp > 0) {
      // Hamstring (Command's mark): the commanded foe's bites chill it. Wild Blood (Pack Bond's): the bite heals him.
      if (foe === this.commanded) this.ride('command', foe, 0);
    }
    const wb = this.thorn && this.aura === 'pack-bond' ? this.mk('pack-bond', 'biteHeal') : null;
    if (wb && dealt > 0) this.healOwed(dealt * (wb.n ?? 0) / 100);
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
  /**
   * The raised: keep near the Keeper, fight the nearest foe they can see, crumble only when killed or released (no
   * timer). Idle, each takes its slot of the formation behind and round him (td-sight formationSpot); fighting, the
   * ones on one foe fan out round it (fanSpot); the soft push after (spreadKin) keeps any two a body apart.
   */
  private updateMinions(dt: number): void {
    const p = this.host.player();
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const k = this.minions[i];
      if (k.hp > 0) continue;
      this.minions.splice(i, 1);
      for (let j = 0; j < 3; j++) this.effects.push({ kind: 'dust', x: k.x + rnd(-5, 5), y: k.y, age: 0, life: .5, dir: 1 });
      // Ember Bones (a mark): a skeleton that crumbles bursts into fire round where it stood.
      const cr = this.mk('raise-skeleton', 'crumble');
      if (cr) {
        const r = (cr.m ?? 0) * TILE, n = k.maxHp * (cr.n ?? 0) / 100 / Math.max(.1, this.power);
        for (const m of [...this.mobs]) if (Math.hypot(m.x - k.x, m.y - k.y) <= r && this.reaches(k.x, k.y, m)) this.hitFoe(m, n * this.fireMult, '#ff9a4a', null);
        this.effects.push({ kind: 'wave', x: k.x, y: k.y, age: 0, life: .5, dir: 1, r: Math.round(r) });
      }
    }
    const face = this.formFace(), fans = this.fanCounts();
    this.minions.forEach((k, slot) => {
      k.t += dt; k.cd -= dt; k.hit = Math.max(0, k.hit - dt);
      // Captain of the Dead (a mark): every few seconds it taunts what stands near it.
      const cap = k.captain ? this.mk('raise-skeleton', 'captain') : null;
      if (cap) {
        k.tauntCd = (k.tauntCd ?? 0) - dt;
        if (k.tauntCd <= 0) {
          k.tauntCd = cap.m ?? 6;
          for (const m of this.mobs) if (Math.hypot(m.x - k.x, m.y - k.y) <= CAPTAIN_REACH * TILE) this.applyStatus(m, 'taunt', cap.s ?? 1.5);
          this.effects.push({ kind: 'cry', x: k.x, y: k.y, r: CAPTAIN_REACH * TILE, age: 0, life: .4, dir: 1 });
        }
      }
      // Left far behind (a wall between, a long run): it steps out of the ground at the Keeper's side again.
      if (Math.hypot(k.x - p.x, k.y - p.y) > MINION_LEASH * 1.6) { const at = this.slotOpen(formationSpot(slot, p, face)); k.x = at.x; k.y = at.y; k.target = null; }
      const t = k.target;
      if (!t || t.hp <= 0 || !this.mobs.includes(t) || Math.hypot(t.x - p.x, t.y - p.y) > MINION_LEASH || !this.sight.sees(k.x, k.y, t.x, t.y, true)) k.target = pickMinionTarget(k, this.mobs, p, MINION_SIGHT, MINION_LEASH, m => this.sight.sees(k.x, k.y, m.x, m.y, false));
      // td-roam: hunting the foe it sees, else roaming near the Keeper while he stands, else the formation.
      const rm = this.roamOf(k, k.target, dt);
      const foe = rm.mode === 'hunt' ? k.target : null, reach = foe ? MOB_REACH + foe.def.w / 4 : 0;
      if (!foe) k.target = null;
      const spot = foe ? this.fanFor(k, foe, fans) : rm.idle ? k : rm.goal ?? formationSpot(slot, p, face), stop = foe ? 2 : 3;
      const dx = spot.x - k.x, dy = spot.y - k.y, len = Math.hypot(dx, dy);
      if (len > stop) {
        const step = Math.min(len - stop, MINION_SPEED * this.pace * (foe ? 1 : rm.mode === 'roam' ? rm.pace : len > 40 ? 1.6 : 1) * dt), vx = dx / len * step, vy = dy / len * step;
        if (this.free(k.x + vx, k.y)) k.x += vx;
        if (this.free(k.x, k.y + vy)) k.y += vy;
      }
      if (foe) k.face = foe.x < k.x ? -1 : 1; else if (Math.abs(dx) > 2) k.face = dx < 0 ? -1 : 1;
      // Its blow only ever lands on a creature it can see: the Keeper is never its foe, a wall never lets it through.
      if (foe && Math.hypot(foe.x - k.x, foe.y - k.y) <= reach + 2 && k.cd <= 0 && this.sight.sees(k.x, k.y, foe.x, foe.y)) {
        k.cd = RAISED_SKELETON.rate;
        this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .2, dir: k.face });
        // The Ashbone Phylactery: each skeleton's first blow is a breath of fire.
        const breath = this.relics.breath > 0 && !k.breathed;
        if (breath) { k.breathed = true; for (let j = 0; j < 3; j++) this.effects.push({ kind: 'flame', x: (k.x + foe.x) / 2 + (j - 1) * 4, y: (k.y + foe.y) / 2, age: 0, life: .45, dir: 1 }); }
        const blow = rnd(k.dmg[0], k.dmg[1]);
        this.hurtMob(foe, Math.round(blow * (breath ? this.relics.breath : 1)), breath ? '#ff9a4a' : '#c88bff');
        // Ash-Bone (Raise Skeleton's mark): the blow sets what it struck burning.
        if (foe.hp > 0) this.ride('raise-skeleton', foe, blow / Math.max(.1, this.power));
      }
    });
    this.spreadKin(dt);
  }

  /** td-roam: what a companion does this frame (hunt `foe`, stroll, run back, or travel in the formation). */
  private roamOf(c: { x: number; y: number; roam?: RoamState }, foe: Mob | null, dt: number): ReturnType<typeof stepRoam> {
    return stepRoam(c.roam ??= newRoam(), {
      me: c, keeper: this.host.player(), stand: this.stand, dt, foe, called: this.heelT > 0,
      free: (x, y) => this.free(x, y), sees: (ax, ay, bx, by) => this.sight.sees(ax, ay, bx, by, false), rng: Math.random,
    });
  }

  // ── The crowd (td-sight.ts) ──
  /** Which way the Keeper is going, held while he stands (his formation is behind his walk, not his last swing). */
  private kinFace: 1 | -1 = 1;
  private formFace(): 1 | -1 {
    if (Math.abs(this.pv.x) > 12) this.kinFace = this.pv.x < 0 ? -1 : 1;
    return this.kinFace;
  }
  /** A formation slot on open ground: the slot, else halfway to the Keeper, else his own feet. */
  private slotOpen(at: { x: number; y: number }): { x: number; y: number } {
    if (this.free(at.x, at.y)) return at;
    const p = this.host.player(), half = { x: (at.x + p.x) / 2, y: (at.y + p.y) / 2 };
    return this.free(half.x, half.y) ? half : { x: p.x, y: p.y };
  }
  /** How many of the Keeper's raised and called fight each foe (they share its arc). */
  private fanCounts(): Map<Mob, (Minion | WildBeast)[]> {
    const out = new Map<Mob, (Minion | WildBeast)[]>();
    const add = (k: Minion | WildBeast) => { if (k.target && k.target.hp > 0) { const l = out.get(k.target); if (l) l.push(k); else out.set(k.target, [k]); } };
    for (const k of this.minions) add(k);
    for (const b of this.beasts) if (b.kind === 'called') add(b);
    return out;
  }
  /** Where one of the kin stands to fight its foe: its place on the arc round it on the Keeper's side (or straight at it, when that place is rock). */
  private fanFor(k: Minion | WildBeast, foe: Mob, fans: Map<Mob, (Minion | WildBeast)[]>): { x: number; y: number } {
    const all = fans.get(foe) ?? [k], j = Math.max(0, all.indexOf(k));
    const at = fanSpot(j, all.length, foe, this.host.player(), MOB_REACH - 3 + foe.def.w / 6);
    return this.free(at.x, at.y) && this.sight.sees(at.x, at.y, foe.x, foe.y, true) ? at : { x: foe.x - (foe.x > k.x ? 1 : -1) * (MOB_REACH - 4 + foe.def.w / 4), y: foe.y + 1 };
  }
  /** The soft push among the Keeper's raised and his called beast, clear of him and of his pet. */
  private spreadKin(dt: number): void {
    const kin: Body[] = [...this.minions, ...this.beasts.filter(b => b.kind === 'called')];
    if (!kin.length) return;
    const p = this.host.player();
    kin.push({ x: p.x, y: p.y, fixed: true, r: KEEPER_ELBOW });
    if (this.beast) kin.push({ x: this.beast.x, y: this.beast.y, fixed: true });
    separate(kin, (x, y) => this.free(x, y), KIN_PUSH * dt);
  }
  /** The creatures standing at their prey this frame (in reach, in sight): they hold their ground while the rest find room round them. */
  private readonly holding = new Set<Mob>();
  /** Which way each hunting creature stepped this frame (its push gives way sideways, never back). */
  private readonly heading = new Map<Mob, { x: number; y: number }>();
  /** The soft push among creatures: a body's room is near a third of its width; the held (at their prey, rooted, stunned, mid-attack) and a boss do not give way. */
  private spreadMobs(dt: number): void {
    if (this.mobs.length < 2) return;
    const bodies: (Body & { m: Mob })[] = this.mobs.map(m => ({
      m, x: m.x, y: m.y, r: Math.max(7, Math.min(11, m.def.w * .3)), held: this.holding.has(m),
      fixed: m.def.rank === 'boss' || !!m.def.bound || !!m.dash || (m.blinkT ?? 0) > 0 || m.tell > 0 || (m.rootT ?? 0) > 0 || (m.stun ?? 0) > 0,
    }));
    separate(bodies, (x, y) => this.free(x, y), CROWD_PUSH * dt);
    for (const b of bodies) {
      let dx = b.x - b.m.x, dy = b.y - b.m.y;
      if (!dx && !dy) continue;
      // A creature on the hunt gives way to the side, never back: the push never slows its run at its prey.
      const h = this.heading.get(b.m);
      if (h) { const along = dx * h.x + dy * h.y; if (along < 0) { dx -= along * h.x; dy -= along * h.y; } }
      if (this.canStep(b.m, b.m.x + dx, b.m.y + dy)) { b.m.x += dx; b.m.y += dy; }
    }
  }

  /** The worn aura each frame: the Holy pulses on everything near, Prayer's life back each second. */
  private tickItemAura(dt: number): void {
    const a = this.itemAura;
    if (!a) return;
    if (a.fx.regen > 0) {
      this.prayerOwed += a.fx.regen * dt;
      const whole = Math.floor(this.prayerOwed);
      if (whole > 0) { this.prayerOwed -= whole; this.host.healPlayer(whole); }
    }
    if (!(a.fx.pulseDamage > 0)) return;
    this.itemAuraT -= dt;
    if (this.itemAuraT > 0) return;
    this.itemAuraT = AURA_PULSE;
    const p = this.host.player(), el = a.id === 'holy-fire' ? 'ember' as const : a.id === 'holy-freeze' ? 'life' as const : 'lamp' as const;
    this.effects.push({ kind: 'wave', el, x: p.x, y: p.y, age: 0, life: .5, dir: 1, r: ITEM_AURA_REACH });
    // The card's number exactly ("{{n}} fire damage every 1.5 s"): not the Keeper's spell power, not a crit.
    for (const m of [...this.mobs]) if (this.inItemAura(m) && this.sees(m)) this.hurtMob(m, a.fx.pulseDamage, a.id === 'holy-freeze' ? '#8fd8ff' : a.id === 'holy-shock' ? '#ffe36d' : '#ff8a3d');
  }

  /** The Spellstone going off now (useStone), or null. */
  private stone: { id: SkillId; rank: number; marks: number } | null = null;
  /**
   * A Spellstone (shared/spellstones): the spell at the stone's rank, with no mana and no cooldown of its own — the
   * spell's own cooldown and the Keeper's mana are left exactly as they were. Returns why not, or null when it went off.
   */
  useStone(id: SkillId, rank: number, marks = 0): ReturnType<MobSystem['useAbility']> {
    const sk = SKILLS[id];
    if (!sk || sk.kind !== 'active') return 'locked';
    const mana = this.mana, cd = this.cooldowns[id];
    const m = Number.isInteger(marks) && marks > 0 && marks < 64 ? marks : 0;
    this.stone = { id, rank: Math.max(1, Math.min(MAX_RANK, Math.floor(rank) || 1)), marks: m };
    this.varsAt.delete(id); this.cooldowns[id] = 0; this.mana = mana + Math.max(sk.mana, manaCost(id, m));
    let why: ReturnType<MobSystem['useAbility']>;
    try { why = this.useAbility(id); } finally {
      this.stone = null; this.varsAt.delete(id); this.mana = mana;
      if (cd === undefined) delete this.cooldowns[id]; else this.cooldowns[id] = cd;
    }
    return why;
  }

  /** Use a skill from the bar. Returns why not (for the host to say), or null when it went off. */
  useAbility(id: SkillId): 'cooldown' | 'nofoe' | 'mana' | 'locked' | 'nocorpse' | 'life' | 'noseek' | 'waytown' | 'wayboss' | 'wayseam' | null {
    const sk = SKILLS[id];
    if (!sk || sk.kind !== 'active') return null;
    if (this.rank(id) < 1) return 'locked';
    // Double Stride (Ash Stride's mark): a second charge soon after the first is free.
    const free = id === 'ash-stride' && this.strideFreeT > 0;
    if (!free && (this.cooldowns[id] ?? 0) > 0) return 'cooldown';
    const cost = free ? 0 : this.manaOf(id);
    if (this.mana < cost) return 'mana';
    const why = this.castBody(id);
    if (why) return why;
    this.mana -= cost;
    if (free) { this.strideFreeT = 0; return null; }
    // Swift Shutter (a mark): the shutters toggle with no cooldown.
    this.cooldowns[id] = id === 'shutter-lantern' && this.mk(id, 'freeToggle') ? 0 : this.cdOf(id) / (1 + this.castSpeed);
    // The marks that follow a cast: an echo (Twin Nova, Twin Impact, Return Charge…), Double Stride's free window.
    const echo = this.mk(id, 'echo');
    if (echo) this.echoes.push({ id, t: echo.s ?? 0, k: (echo.n ?? 100) / 100, left: Math.max(0, (echo.m ?? 1) - 1), gap: echo.s ?? 0 });
    const again = this.mk(id, 'again');
    if (again) this.strideFreeT = again.s ?? 0;
    return null;
  }
  /** Double Stride's window: seconds a free second Ash Stride stays open. */
  strideFreeT = 0;
  /** The echoes' clock: each goes off when its seconds run out, a free cast at its share (no mana, no cooldown). */
  private tickEchoes(dt: number): void {
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const e = this.echoes[i];
      e.t -= dt;
      if (e.t > 0) continue;
      if (e.left > 0) { e.left--; e.t = e.gap; } else this.echoes.splice(i, 1);
      this.freeCast(e.id, e.k);
    }
  }
  /** A free cast of a skill at a share of its numbers (an echo, Flare Open): no mana, no cooldown, its refusals ignored. */
  private freeCast(id: SkillId, k: number): void {
    if (this.rank(id) < 1 && id !== 'blinding-flash') return;
    const was = this.echoK;
    this.echoK = k;
    try { this.castBody(id); } finally { this.echoK = was; }
  }
  /**
   * What a skill does when it goes off: the effect alone (useAbility checks and pays; an echo pays nothing). Every hit
   * it lands now is its own (`src`), so its marks' riders and rules ride on them.
   */
  private castBody(id: SkillId): ReturnType<MobSystem['useAbility']> {
    const was = this.src;
    this.src = id; this.lastCast = id;
    try { return this.castOnce(id); } finally { this.src = was; }
  }
  private castOnce(id: SkillId): ReturnType<MobSystem['useAbility']> {
    const p = this.host.player();
    // The foe a spell goes at: the target when it is in range and in sight, else the nearest one in sight (td-sight).
    // Long Reach (Drain Life's mark) lengthens it for that spell alone.
    const reach = this.range + (this.mk(id, 'reach')?.n ?? 0) * TILE;
    const foeInRange = (): Mob | null => {
      if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= reach && this.sees(this.target)) return this.target;
      let best: Mob | null = null, bd = reach;
      for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= bd && this.sees(m)) { bd = d; best = m; } }
      return best;
    };
    const v = this.v(id);
    if (id === 'drain-life') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      this.effects.push({ kind: 'drain', x: foe.x, y: foe.y - foe.def.h / 2, tx: p.x, ty: p.y - 20, age: 0, life: .65, dir: 1 });
      // "Heals you for {{heal}}% of it": of the life it really pulled (spell power, a crit and all), not of the bare roll.
      const pulled = this.hitFoe(foe, rnd(v['min'], v['max']), '#ff7a6a');
      const heal = Math.round(pulled * v['heal'] / 100);
      // Grave Thirst (a mark): what the heal would pour past full life becomes a ward, up to its most.
      const thirst = this.mk(id, 'overheal'), hp = this.host.playerHp?.();
      if (thirst && hp !== undefined && hp + heal > this.keeperMaxHp) {
        this.markShield = Math.min(thirst.n ?? 0, this.markShield + (hp + heal - this.keeperMaxHp)); this.markShieldT = Math.max(this.markShieldT, 10);
      }
      this.host.healPlayer(heal); this.float(p.x, p.y - 36, `+${heal}`, '#7fe08a');
      // Share the Cup: the raised drink of it too.
      const cup = this.mk(id, 'kinHeal');
      if (cup) this.healKin(heal * (cup.n ?? 0) / 100);
      this.host.swung(foe);
    } else if (id === 'ember-curse') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      // Hex Ring (a mark): every foe near the target takes the curse too.
      const ring = this.mk(id, 'hexRing');
      const cursed = ring ? this.mobs.filter(m => m === foe || (Math.hypot(m.x - foe.x, m.y - foe.y) <= (ring.n ?? 0) * TILE && this.sight.sees(foe.x, foe.y, m.x, m.y))) : [foe];
      for (const m of cursed) {
        m.cursed = v['secs']; m.burnT = 1;
        this.ride(id, m, 0);
        this.effects.push({ kind: 'curse', x: m.x, y: m.y - m.def.h - 4, age: 0, life: .6, dir: 1 });
      }
      this.host.swung(foe);
    } else if (id === 'hellfire-nova') {
      // Only what the Keeper can see: a nova by a wall does not burn the room behind it.
      for (const m of [...this.mobs]) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE && this.sees(m)) this.hitFoe(m, rnd(v['min'], v['max']) * this.fireMult, '#ff9a4a');
      // The ring runs out for half a second, the scorch fades over the next half (on the ground, at the feet).
      this.effects.push({ kind: 'wave', x: p.x, y: p.y, age: 0, life: 1, dir: 1, r: Math.round(v['radius'] * TILE) });
      this.layField(id, p.x, p.y, v);
      this.host.swung(null);
    } else if (id === 'bone-spear') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const sx = p.x, sy = p.y - 16, a = Math.atan2(foe.y - foe.def.h / 2 - sy, foe.x - sx);
      this.effects.push({ kind: 'flash', x: sx, y: sy, age: 0, life: .15, dir: 1 });
      // Twin Spear (a mark): two spears, a few degrees apart. Return of the Bone: each comes back once at its share.
      const twin = this.mk(id, 'twin'), back = this.mk(id, 'return');
      const angles = twin ? [a - (twin.n ?? 0) * Math.PI / 360, a + (twin.n ?? 0) * Math.PI / 360] : [a];
      for (const t of angles) this.spears.push({ x: sx, y: sy, vx: Math.cos(t) * SPEAR_SPEED, vy: Math.sin(t) * SPEAR_SPEED, age: 0, life: v['range'] * TILE / SPEAR_SPEED, hit: [], dmg: [v['min'], v['max']], lift: 16, land: foe.def.h / 2, reach: Math.hypot(foe.x - sx, foe.y - p.y), src: id, ...(back ? { back: (back.n ?? 0) / 100 } : {}) });
      this.host.swung(foe);
    } else if (id === 'raise-skeleton') {
      // From the fresh dead nearest the Keeper first; with none, out of the ground at his side.
      const fresh = this.corpses
        .filter(cp => this.clock - cp.at <= CORPSE_SECS && Math.hypot(cp.x - p.x, cp.y - p.y) <= v['reach'] * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const st = this.raisedNow(v);
      // Captain of the Dead (a mark): the first of each raising stands and strikes twice as hard.
      const captain = this.mk(id, 'captain');
      for (let i = 0; i < v['count']; i++) {
        const cp = fresh[i];
        // Out of the ground at its own place in the formation (td-sight), never on another's.
        const at = cp ? { x: cp.x, y: cp.y } : this.slotOpen(formationSpot(this.minions.length, p, this.formFace()));
        if (cp) this.corpses.splice(this.corpses.indexOf(cp), 1);
        const k = captain && i === 0 ? captain.n ?? 1 : 1, hp = Math.round(st.hp * k);
        this.minions.push({ id: this.minionSeq++, x: at.x, y: at.y, hp, maxHp: hp, dmg: [Math.round(st.dmg[0] * k), Math.round(st.dmg[1] * k)], cd: .6, t: 0, face: 1, life: Infinity, hit: 0, target: null, ...(k > 1 ? { captain: true } : {}) });
        this.effects.push({ kind: 'raise', x: at.x, y: at.y, age: 0, life: .8, dir: 1 });
      }
      capMinions(this.minions, v['cap']);
      this.host.swung(null);
    } else if (id === 'dark-ward') {
      this.ward = v['absorb']; this.wardT = v['secs']; this.wardMax = v['absorb'];
      this.effects.push({ kind: 'ward', x: p.x, y: p.y - 14, age: 0, life: .6, dir: 1 });
      // Life Tap (Dark Ward's mark now): the casting turns a share of life into mana, never the last of it.
      if (this.rank('life-tap') > 0 && this.echoK === 1) {
        const tap = this.v('life-tap'), hp = this.host.playerHp?.() ?? Infinity, take = Math.round(this.keeperMaxHp * tap['life'] / 100);
        if (take > 0 && hp > take) {
          this.host.hurtPlayer(take);
          this.mana = Math.min(this.maxMana, this.mana + tap['mana']);
          this.float(p.x - 6, p.y - 36, `-${take}`, '#ff5a4a');
          this.float(p.x + 6, p.y - 30, `+${tap['mana']}`, '#7fb8ff');
          this.effects.push({ kind: 'drain', x: p.x - 10, y: p.y - 30, tx: p.x + 10, ty: p.y - 18, age: 0, life: .5, dir: 1 });
        }
      }
      this.host.swung(null);
    } else if (id === 'light') {
      // Light (design-bible §4.6): the Keeper's own light reaches further while it burns; spoken again it starts over.
      this.lightT = v['secs']; this.lightTiles = v['radius'];
      // Light is light: spoken by a Lanternwright it opens the lantern's shutters too.
      this.shuttered = false;
      this.effects.push({ kind: 'pillar', x: p.x, y: p.y, age: 0, life: .9, dir: 1 });
    } else if (id === 'seek') {
      // Lumvesh (design-bible §5.5): the host finds what to point at; nothing to seek spends nothing.
      if (!this.host.seek?.(v['secs'])) return 'noseek';
    } else if (id === 'waygate') {
      // A town portal (td-waygate.ts): the host knows the hearths, the towns and the fights; a refusal spends nothing.
      const why = this.host.waygate ? this.host.waygate(v['secs']) : 'waytown';
      if (why) return why;
    } else {
      const why = this.useTreeSkill(id, v, foeInRange);
      if (why) return why;
    }
    return null;
  }
  /** Raised skeletons' numbers now: their rank's (raisedStats), with Skeleton Mastery (its mark) on top. */
  private raisedNow(v: Record<string, number>): { hp: number; dmg: [number, number] } {
    const st = raisedStats(this.keeperLevel, this.power, v);
    if (this.rank('skeleton-mastery') > 0) {
      const k = 1 + this.v('skeleton-mastery')['pct'] / 100;
      st.hp = Math.round(st.hp * k); st.dmg = [Math.max(1, Math.round(st.dmg[0] * k)), Math.max(1, Math.round(st.dmg[1] * k))];
    }
    return st;
  }
  /** A mark's burning ground (`field`: Scorched Earth, Burning Crater) where a skill's blast was: its share of the hit a second. */
  private layField(id: SkillId, x: number, y: number, v: Record<string, number>): void {
    const f = this.mk(id, 'field');
    if (!f) return;
    const dps = Math.max(1, Math.round((v['min'] + v['max']) / 2 * (f.n ?? 0) / 100));
    this.zones.push({ kind: 'field', x, y, r: (f.m ?? 1) * TILE, t: f.s ?? 0, tick: 1, min: dps, max: dps, src: id });
  }
  /** The Dark Ward's whole absorb when it was laid (Ward the Fellowship's burst reads it). */
  private wardMax = 0;

  /**
   * The trees' new skills (docs/design/skill-trees.md). Each is small and self-contained: it reads its numbers at its
   * rank, leaves its picture with the td-fx kit, and says why not (no foe, no corpse, too little life) like the rest.
   */
  private useTreeSkill(id: SkillId, v: Record<string, number>, foeInRange: () => Mob | null): 'nofoe' | 'nocorpse' | 'life' | null {
    const p = this.host.player();
    if (id in ASHGUARD_SKILLS) return this.useAshSkill(id, v);
    if (id in LANTERN_SKILLS) return this.useLampSkill(id, v);
    if (id in THORN_SKILLS) return this.useThornSkill(id, v, foeInRange);
    if (id === 'cinder-rain') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      this.zones.push({ kind: 'rain', x: foe.x, y: foe.y, r: v['radius'] * TILE, t: v['secs'], tick: 0, min: v['min'], max: v['max'] });
      this.host.swung(foe);
    } else if (id === 'flame-wall') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      // Ring of Fire (a mark): a ring round the target instead of a line. Twin Walls: a second line square to the
      // first, the two at their share.
      const ring = this.mk(id, 'ring'), cross = this.mk(id, 'cross'), k = cross ? (cross.n ?? 100) / 100 : 1;
      const lines = ring ? [this.ringPts(foe.x, foe.y, (ring.n ?? 2) * TILE)] : [0, ...(cross ? [Math.PI / 2] : [])].map(turn => {
        // Across the way from the Keeper to the foe, through the foe: whatever walks it burns.
        const a = Math.atan2(foe.y - p.y, foe.x - p.x) + Math.PI / 2 + turn, n = Math.max(2, Math.round(v['length'])), pts: { x: number; y: number }[] = [];
        // Not in a wall (td-sight): a flame on rock burns nothing, and each tongue burns only what it can reach.
        for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * TILE, q = { x: foe.x + Math.cos(a) * o, y: foe.y + Math.sin(a) * o }; if (!this.sight.wallAt(q.x, q.y - 1)) pts.push(q); }
        return pts;
      });
      for (const pts of lines) this.zones.push({ kind: 'wall', x: foe.x, y: foe.y, r: TILE * .7, t: v['secs'], tick: 0, min: v['dps'] * k, max: v['dps'] * k, pts });
      this.host.swung(foe);
    } else if (id === 'meteor') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      this.zones.push({ kind: 'meteor', x: foe.x, y: foe.y, r: v['radius'] * TILE, t: v['delay'], tick: 0, min: v['min'], max: v['max'] });
      this.effects.push({ kind: 'meteor', x: foe.x, y: foe.y, age: 0, life: v['delay'], dir: 1 });
      this.host.swung(foe);
    } else if (id === 'corpse-burst') {
      const cp = this.corpses
        .filter(c => this.clock - c.at <= CORPSE_SECS && Math.hypot(c.x - p.x, c.y - p.y) <= v['reach'] * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!cp) return 'nocorpse';
      // Chain of Graves (a mark): the burst sets off the next fresh corpse near it, and that one the next.
      const chain = this.mk(id, 'chain');
      let at: { x: number; y: number; at: number } | undefined = cp;
      for (let n = 0; at && n <= (chain?.m ?? 0); n++) {
        const here: { x: number; y: number; at: number } = at;
        this.corpses.splice(this.corpses.indexOf(here), 1);
        this.burstCorpse(here, v);
        at = chain ? this.corpses.filter(c => this.clock - c.at <= CORPSE_SECS && Math.hypot(c.x - here.x, c.y - here.y) <= (chain.s ?? 0) * TILE)
          .sort((a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y))[0] : undefined;
      }
      this.host.swung(null);
    } else if (id === 'bone-storm') {
      // A fan of spears at the foe; with none in reach (or Full Circle, a mark), a ring of them all round.
      const foe = foeInRange(), n = Math.max(1, v['count']), sx = p.x, sy = p.y - 16, ring = !foe || !!this.mk(id, 'ringFan');
      const base = foe ? Math.atan2(foe.y - foe.def.h / 2 - sy, foe.x - sx) : 0;
      for (let i = 0; i < n; i++) {
        const a = ring ? base + i / n * Math.PI * 2 : base + (i - (n - 1) / 2) * .22;
        this.spears.push({ x: sx, y: sy, vx: Math.cos(a) * SPEAR_SPEED, vy: Math.sin(a) * SPEAR_SPEED, age: 0, life: v['range'] * TILE / SPEAR_SPEED, hit: [], dmg: [v['min'], v['max']], lift: 16, src: id, ...(foe && !ring ? { land: foe.def.h / 2, reach: Math.hypot(foe.x - sx, foe.y - p.y) } : {}) });
      }
      this.effects.push({ kind: 'flash', x: sx, y: sy, age: 0, life: .2, dir: 1 });
      this.host.swung(foe);
    } else if (id === 'bone-armor') {
      this.bone = v['absorb']; this.boneT = v['secs'];
      for (let i = 0; i < 4; i++) this.effects.push({ kind: 'bone-chips', x: p.x + (i % 2 ? -9 : 9), y: p.y - 10 - (i < 2 ? 8 : 0), age: 0, life: .4, dir: i % 2 ? -1 : 1 });
      this.host.swung(null);
    } else if (id === 'weaken') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      for (const m of this.mobs) if (Math.hypot(m.x - foe.x, m.y - foe.y) <= v['radius'] * TILE && this.sight.sees(foe.x, foe.y, m.x, m.y)) {
        m.weak = v['secs']; m.weakPct = v['weaken'];
        // Withering (a mark): the weakened are Chilled too.
        this.ride(id, m, 0);
        this.effects.push({ kind: 'curse', x: m.x, y: m.y - m.def.h - 4, age: 0, life: .6, dir: 1 });
      }
      this.effects.push({ kind: 'wave', el: 'shadow', x: foe.x, y: foe.y, age: 0, life: .6, dir: 1, r: Math.round(v['radius'] * TILE) });
      this.host.swung(foe);
    } else if (id === 'doom') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      foe.doom = v['secs']; foe.doomHit = { min: v['min'], max: v['max'], r: v['radius'] * TILE };
      this.effects.push({ kind: 'curse', x: foe.x, y: foe.y - foe.def.h - 4, age: 0, life: .8, dir: 1 });
      // Doomed Together (a mark): the nearest other foe is doomed with it.
      const two = this.mk(id, 'doomTwo');
      if (two) {
        const o = this.mobs.filter(m => m !== foe && !(m.doom ?? 0) && Math.hypot(m.x - foe.x, m.y - foe.y) <= (two.s ?? 0) * TILE).sort((a, b) => Math.hypot(a.x - foe.x, a.y - foe.y) - Math.hypot(b.x - foe.x, b.y - foe.y))[0];
        if (o) { o.doom = v['secs']; o.doomHit = { ...foe.doomHit }; this.effects.push({ kind: 'curse', x: o.x, y: o.y - o.def.h - 4, age: 0, life: .8, dir: 1 }); }
      }
      this.host.swung(foe);
    }
    return null;
  }
  /** One corpse bursts (Corpse Burst), and Bone Shards (a mark) fly out of it. */
  private burstCorpse(cp: { x: number; y: number }, v: Record<string, number>): void {
    for (const m of [...this.mobs]) if (Math.hypot(m.x - cp.x, m.y - cp.y) <= v['radius'] * TILE && this.reaches(cp.x, cp.y, m)) this.hitFoe(m, rnd(v['min'], v['max']), '#e9dcff');
    this.effects.push({ kind: 'flash', x: cp.x, y: cp.y - 6, age: 0, life: .2, dir: 1 });
    this.effects.push({ kind: 'wave', el: 'bone', x: cp.x, y: cp.y, age: 0, life: .6, dir: 1, r: Math.round(v['radius'] * TILE) });
    for (let i = 0; i < 4; i++) this.effects.push({ kind: 'bone-chips', x: cp.x + (i % 2 ? -8 : 8), y: cp.y - 4 - (i < 2 ? 6 : 0), age: 0, life: .4, dir: i % 2 ? -1 : 1 });
    const sh = this.mk('corpse-burst', 'shards');
    if (sh) {
      const n = sh.m ?? 0, k = (sh.n ?? 0) / 100;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + Math.PI / 4;
        this.spears.push({ x: cp.x, y: cp.y - 6, vx: Math.cos(a) * SPEAR_SPEED, vy: Math.sin(a) * SPEAR_SPEED, age: 0, life: (sh.s ?? 0) * TILE / SPEAR_SPEED, hit: [], dmg: [Math.max(1, Math.round(v['min'] * k)), Math.max(1, Math.round(v['max'] * k))], lift: 6, src: 'corpse-burst' });
      }
    }
  }
  /** Points round a ring (Ring of Fire, Ring of Thorns): one a tile of its rim, none in rock. */
  private ringPts(x: number, y: number, r: number): { x: number; y: number }[] {
    const n = Math.max(6, Math.round(Math.PI * 2 * r / TILE)), out: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, q = { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }; if (!this.sight.wallAt(q.x, q.y - 1)) out.push(q); }
    return out;
  }

  // ── The Ashguard (td-ashguard-skills.ts, design-bible §4.4) ──

  /** The weapon in hand as the swing sees it (td-melee weaponSwing; the host hands it in). The starter edge's swing until the host says what is held (setWeapon: null is bare hands). */
  weaponSwing: WeaponSwing = NO_WEAPON_BONUS;
  /**
   * A two-handed weapon's lift on the casters' basic attack (the Ember Bolt, the Kindle): its multiplier when it is
   * more than 1 (shared/rpg/item-hands.ts). Bare hands never weaken a spell: the bolt is the staff's, not the fist's.
   */
  get handMult(): number { return this.weaponSwing.mult > 1 ? this.weaponSwing.mult : 1; }
  /**
   * The Thorn Shot's arrow: its roll times the weapon's hands (a two-handed bow ×TWO_HAND_MULT, a crossbow ×1). The
   * weapon's Spell Damage already lifts every arrow through spell power; its flat is the blade's alone. With nothing
   * worn the kit's hunting bow looses it exactly as the book shows (bare hands are not a bow's).
   */
  shotBlow(min: number, max: number, roll: () => number = Math.random): number {
    return arrowBlow(min, max, roll, this.weaponSwing, this.handMult);
  }

  /** The basic attack: one swing of the Watch Blade in an arc toward the foe (the Ember Brand lights it while it burns). */
  private swingBlade(foe: Mob): void {
    const p = this.host.player(), v = this.v('watch-blade');
    // Guard's Rhythm (a mark): a quicker swing.
    this.swing = SKILLS['watch-blade'].cd / (1 + this.agility) / (1 + this.castSpeed) / this.fanaticism / (1 + (this.mk('watch-blade', 'speed')?.n ?? 0) / 100);
    this.swings++;
    // Fifth Strike (a mark): every fifth swing is a heavy blow that stuns what it strikes.
    const nth = this.mk('watch-blade', 'nth'), heavy = !!nth && this.swings % (nth.m ?? 1) === 0;
    const struck = this.strike(Math.atan2(foe.y - p.y, foe.x - p.x), v['reach'] * TILE, v['arc'], heavy ? nth!.n ?? 100 : 100, false, foe, 'watch-blade', heavy ? nth!.s ?? 0 : 0);
    void struck;
    this.host.swung(foe);
  }
  /**
   * A blade's blow on everything in an arc (a swing, a cleave, a turn of the whirl). `fire`: the whole blow is fire.
   * The Ember Brand, while it burns, lifts each blow by its % and sets its burn. `must` is struck even at the arc's
   * very edge (the creature the Keeper aimed at). Returns how many it struck.
   */
  private strike(aim: number, reach: number, arc: number, pct: number, fire: boolean, must: Mob | null, src: SkillId | null = this.src, stun = 0): number {
    const p = this.host.player(), blade = this.v('watch-blade');
    const brand = this.brandT > 0 && this.rank('ember-brand') > 0 ? this.v('ember-brand') : null;
    const lit = fire || !!brand;
    this.effects.push({ kind: 'arc', x: p.x, y: p.y - 8, a: aim, w: arc, r: Math.round(reach), el: lit ? 'ember' : 'brass', age: 0, life: arc >= 360 ? .3 : .24, dir: 1 });
    let n = 0;
    for (const m of [...this.mobs]) {
      if (m !== must && !inArc(p.x, p.y, aim, reach, arc, m.x, m.y, m.def.w / 2)) continue;
      // Never through a wall (td-sight): the blade strikes only what the Keeper can see.
      if (!this.sees(m)) continue;
      let blow = meleeBlow(blade['min'], blade['max'], pct, Math.random, this.weaponSwing);
      if (brand) blow = brandedBlow(blow, brand['pct']);
      if (lit) blow *= this.fireMult;
      this.effects.push({ kind: 'slash', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .2, dir: m.x < p.x ? -1 : 1 });
      this.hitFoe(m, blow, lit ? '#ffb347' : '#f3e7cf', src);
      if (brand && m.hp > 0) { m.brandT = 3; m.brandTick = 1; m.brandDps = brand['burn']; m.brandTicks = 3; }
      if (stun > 0 && m.hp > 0) this.applyStatus(m, 'stun', stun);
      n++;
    }
    return n;
  }
  /** Seconds to the Taunting Vow's next call. */
  private vowTauntT = 0;
  /** Pull of the Fire, Call to the Gate (marks): every foe within `radius` tiles drawn its tiles toward the Keeper. */
  private pullIn(id: SkillId, radius: number): void {
    const pl = this.mk(id, 'pull');
    if (!pl) return;
    const p = this.host.player(), r = (pl.m || radius) * TILE;
    for (const m of this.mobs) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > r || d < 12 || !this.sees(m) || m.def.rank === 'boss') continue;
      this.knock(m, (p.x - m.x) / d, (p.y - m.y) / d, Math.min(d - 10, (pl.n ?? 0) * TILE));
      if (this.replica) this.coop?.laid?.(m, 'pull', 0, id, pl.n ?? 0);
    }
  }
  /** The nearest creature within `reach` art px of the Keeper (the target first, when it is in reach). */
  private foeWithin(reach: number): Mob | null {
    const p = this.host.player();
    if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= reach + this.target.def.w / 4 && this.sees(this.target)) return this.target;
    let best: Mob | null = null, bd = Infinity;
    for (const m of this.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y) - m.def.w / 4; if (d <= reach && d < bd && this.sees(m)) { bd = d; best = m; } }
    return best;
  }
  /** The Ashguard's spells. Each reads its numbers at its rank and leaves its picture (td-ashguard-fx). */
  private useAshSkill(id: SkillId, v: Record<string, number>): 'nofoe' | null {
    const p = this.host.player(), reach = Math.max(this.range, 1.8 * TILE);
    if (id === 'ember-brand') {
      this.brandT = v['secs'];
      this.effects.push({ kind: 'brand', x: p.x, y: p.y - 14, age: 0, life: .45, dir: 1 });
      this.host.swung(null);
    } else if (id === 'cinder-cleave') {
      const foe = this.foeWithin(v['reach'] * TILE);
      if (!foe) return 'nofoe';
      this.strike(Math.atan2(foe.y - p.y, foe.x - p.x), v['reach'] * TILE, v['arc'], v['pct'], true, foe);
      this.host.swung(foe);
    } else if (id === 'whirl-of-cinders') {
      // Two seconds of turning: a full ring of the blade every half second, round the Keeper wherever he walks.
      this.zones.push({ kind: 'whirl', x: p.x, y: p.y, r: v['radius'] * TILE, t: v['hits'] * .5, tick: 0, min: v['pct'], max: v['hits'] });
      // Pull of the Fire (a mark): what stands near is drawn in to the blade.
      this.pullIn(id, v['radius']);
      this.host.swung(null);
    } else if (id === 'shield-bash') {
      // Shield Rush (a mark): a short dash to a foe a little further off, then the bash.
      const rush = this.mk(id, 'rush');
      const foe = this.foeWithin(reach + (rush?.n ?? 0) * TILE);
      if (!foe) return 'nofoe';
      if (rush && Math.hypot(foe.x - p.x, foe.y - p.y) > reach) { const to = strideEnd(p.x, p.y, foe.x, foe.y, 14); this.host.dash?.(to.x, to.y); }
      const at = this.host.player();
      this.effects.push({ kind: 'bash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .35, dir: foe.x < at.x ? -1 : 1 });
      // Wide Bash (a mark): every foe in an arc takes it, not only the one aimed at.
      const wide = this.mk(id, 'wideBash'), aim = Math.atan2(foe.y - at.y, foe.x - at.x);
      const hit = wide ? this.mobs.filter(m => m === foe || (inArc(at.x, at.y, aim, (wide.m ?? 1) * TILE, wide.n ?? 90, m.x, m.y, m.def.w / 2) && this.sees(m))) : [foe];
      for (const m of hit) {
        this.hitFoe(m, rnd(v['min'], v['max']), '#e0b25a');
        if (m.hp <= 0) continue;
        m.stun = ccSecs(v['stun'], m.def.rank);
        // Concussion (a mark): the stunned stay Hushed a while after.
        const co = this.mk(id, 'concuss');
        if (co) m.hushT = Math.max(m.hushT ?? 0, m.stun + (co.s ?? 0));
      }
      // Grave-Stamp (a mark): the shock knocks the foes beside the struck one off their feet.
      const gs = this.mk(id, 'stampStun');
      if (gs) for (const m of this.mobs) if (!hit.includes(m) && Math.hypot(m.x - foe.x, m.y - foe.y) <= (gs.n ?? 0) * TILE) this.applyStatus(m, 'stun', gs.s ?? 0);
      this.host.swung(foe);
    } else if (id === 'shield-oath') {
      this.blockT = v['secs']; this.blockPct = v['block'];
      this.effects.push({ kind: 'oath', x: p.x, y: p.y - 16, age: 0, life: .45, dir: 1 });
      this.host.swung(null);
    } else if (id === 'watch-cry') {
      // Every creature within the cry turns on the Keeper (the pet and the raised are spared), and he braces.
      // Fearsome (a mark): a lesser creature (not a boss, below the Keeper's level) flees instead of turning on him.
      const fear = this.mk(id, 'fearsome');
      for (const m of this.mobs) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE && this.sees(m)) {
        if (fear && m.def.rank !== 'boss' && m.def.level < this.keeperLevel) this.applyStatus(m, 'fear', fear.s ?? 0);
        else m.taunt = ccSecs(v['secs'], m.def.rank);
      }
      // Call to the Gate (a mark): the taunted are drawn a step toward him.
      this.pullIn(id, v['radius']);
      this.guardT = v['secs']; this.guardPct = v['guard'];
      this.effects.push({ kind: 'cry', x: p.x, y: p.y, r: Math.round(v['radius'] * TILE), age: 0, life: .6, dir: 1 });
    } else if (id === 'ash-stride') {
      const foe = this.foeWithin(v['reach'] * TILE + this.range);
      if (!foe) return 'nofoe';
      const from = { x: p.x, y: p.y }, to = strideEnd(p.x, p.y, foe.x, foe.y, 14);
      this.host.dash?.(to.x, to.y);
      const at = this.host.player();
      this.effects.push({ kind: 'stride', x: at.x, y: at.y, tx: from.x, ty: from.y, age: 0, life: .4, dir: foe.x < from.x ? -1 : 1 });
      this.hitFoe(foe, meleeBlow(this.v('watch-blade')['min'], this.v('watch-blade')['max'], v['pct'], Math.random, this.weaponSwing), '#efe6dc');
      // Through the Ranks (a mark): every foe on the charge's path takes the blow too.
      if (this.mk(id, 'through')) for (const m of [...this.mobs]) if (m !== foe && m.hp > 0 && segDist(from.x, from.y, at.x, at.y, m.x, m.y) <= TILE * .8) this.hitFoe(m, meleeBlow(this.v('watch-blade')['min'], this.v('watch-blade')['max'], v['pct'], Math.random, this.weaponSwing), '#efe6dc');
      // The knock: a tile back along the charge, if the ground behind it is open (never for a boss).
      if (foe.hp > 0 && foe.def.rank !== 'boss') {
        const d = Math.hypot(foe.x - at.x, foe.y - at.y) || 1, k = v['knock'] * TILE / d, kx = foe.x + (foe.x - at.x) * k, ky = foe.y + (foe.y - at.y) * k;
        if (this.free(kx, ky, foe.def.floats)) { foe.x = kx; foe.y = ky; }
      }
      this.host.swung(foe);
    } else if (id === 'last-watch') {
      this.vowT = v['secs']; this.vowTaken = 0; this.vowTauntT = 0;
      this.effects.push({ kind: 'vow', x: p.x, y: p.y - 30, age: 0, life: .8, dir: 1 });
      this.host.swung(null);
    }
    return null;
  }
  /** The Ashguard's timers: the brand, the oath, the guard, the vow (when the vow ends, a share of what it held comes back). */
  private tickOaths(dt: number): void {
    // Kept Fire (a mark): while he stands his ground, the brand stays lit.
    if (this.rank('ember-brand') > 0 && this.mk('ember-brand', 'keptFire') && Math.hypot(this.pv.x, this.pv.y) < STILL_PACE) this.brandT = Math.max(this.brandT, .5);
    // Taunting Vow (a mark): while the vow holds, every few seconds what stands near turns on him.
    const tv = this.vowT > 0 ? this.mk('last-watch', 'vowTaunt') : null;
    if (tv) {
      this.vowTauntT -= dt;
      if (this.vowTauntT <= 0) {
        this.vowTauntT = tv.s ?? 1;
        const p = this.host.player();
        for (const m of this.mobs) if (Math.hypot(m.x - p.x, m.y - p.y) <= (tv.n ?? 0) * TILE && this.sees(m)) m.taunt = Math.max(m.taunt ?? 0, ccSecs(tv.s ?? 1, m.def.rank));
        this.effects.push({ kind: 'cry', x: p.x, y: p.y, r: Math.round((tv.n ?? 0) * TILE), age: 0, life: .4, dir: 1 });
      }
    }
    if (this.brandT > 0) this.brandT = Math.max(0, this.brandT - dt);
    if (this.blockT > 0) this.blockT = Math.max(0, this.blockT - dt);
    if (this.guardT > 0) this.guardT = Math.max(0, this.guardT - dt);
    if (this.vowT > 0) {
      this.vowT -= dt;
      if (this.vowT <= 0) {
        this.vowT = 0;
        const heal = Math.round(this.vowTaken * this.v('last-watch')['heal'] / 100), p = this.host.player();
        this.vowTaken = 0;
        if (heal > 0) { this.host.healPlayer(heal); this.float(p.x, p.y - 36, `+${heal}`, '#7fe08a'); }
        this.effects.push({ kind: 'heal', x: p.x, y: p.y, age: 0, life: .7, dir: 1 });
      }
    }
  }

  // ── The Lanternwright (td-lantern-skills.ts, design-bible §4.3) ──

  /**
   * Hushed (a mark's interrupt: Lay to Rest, Concussion, Hushing Barb…, or inside No Shadow's dawn): no shots, no ground
   * attack, no charge.
   */
  private hushed(m: Mob): boolean {
    return (m.hushT ?? 0) > 0;
  }
  /** Night Shroud (Dark Ward's mark): while the ward holds, nothing farther than its tiles can aim at the Keeper. */
  private shrouded(d: number): boolean {
    const sh = this.ward > 0 ? this.mk('dark-ward', 'shroud') : null;
    return !!sh && d > (sh.n ?? 0) * TILE;
  }
  /** How much nearer a creature must come to notice a shuttered Lanternwright (art px; Infinity: it leaves him be). */
  private shutterQuiet(m: Mob): number {
    if (!this.lamp || !this.shuttered) return 0;
    if (this.mk('shutter-lantern', 'mothHours') && shadowBorn(m.def.id) && m.hp >= m.def.hp) return Infinity;
    return (this.mk('shutter-lantern', 'quietSight')?.n ?? 0) * TILE;
  }
  /** A creature's blow has landed on the Keeper: Flareback (the Aura of Embers' mark) sets it burning. */
  private struckBy(m: Mob): void {
    const fb = this.aura === 'aura-embers' ? this.mk('aura-embers', 'struck') : null;
    if (fb && m.hp > 0) this.applyStatus(m, 'burn', fb.s ?? 0, this.v('aura-embers')['dps'] * this.fireMult);
  }
  /** A creature's pace: a Hearth Circle's ground slows whatever walks in it. */
  private paceOf(m: Mob): number {
    // S6: Pack Howl, and a pack's Vigor or Fanaticism.
    const s6 = ((m.howlT ?? 0) > 0 ? 1.2 : 1) * (m.bless?.fx.walk ?? 1);
    return this.groundPace(m) * ((m.chillT ?? 0) > 0 ? 1 - CHILL_SLOW : 1) * this.firebreak(m) * s6 * ((m.slowT ?? 0) > 0 ? 1 - Math.min(.9, (m.slowPct ?? 0) / 100) : 1);
  }
  /** Firebreak (Flame Wall's mark): a creature in the fire walks slower. */
  private firebreak(m: Mob): number {
    const fb = this.mk('flame-wall', 'slowZone');
    if (!fb) return 1;
    return this.zones.some(z => z.kind === 'wall' && z.pts?.some(q => Math.hypot(m.x - q.x, m.y - q.y) <= z.r)) ? 1 - (fb.n ?? 0) / 100 : 1;
  }
  private groundPace(m: Mob): number {
    // The level gap (td-zones gapPace): a creature above the Keeper's level is quicker on its feet.
    const gap = this.levelGap ? gapPace(levelGap(this.keeperLevel, m.def.level)) : 1;
    // Holy Freeze (a worn aura) slows whatever walks near the Keeper.
    const frozen = this.itemAura && this.itemAura.fx.slow > 0 && this.inItemAura(m) ? 1 - this.itemAura.fx.slow : 1;
    for (const z of this.zones) if (z.kind === 'hearth' && inDisc(m.x, m.y, z.x, z.y, z.r)) return (1 - z.max / 100) * frozen * gap;
    return frozen * gap;
  }
  /** Is the Keeper standing in his own Hearth Circle (the Hush cannot rise there)? */
  get inHearth(): boolean {
    const p = this.host.player();
    if (this.zones.some(z => z.kind === 'hearth' && inDisc(p.x, p.y, z.x, z.y, z.r))) return true;
    // The marks that count as a hearth (`hearth`): the Watchfire running (Hearth of the Watch), within three tiles of a
    // beacon (Hush-Light), while a Rootwalk runs (Mossfoot).
    if (this.aura === 'aura-watchfire' && this.mk('aura-watchfire', 'hearth')) return true;
    const hl = this.mk('beacon', 'hearthNear');
    if (hl && this.beacons.some(b => Math.hypot(b.x - p.x, b.y - p.y) <= (hl.n ?? 0) * TILE)) return true;
    // No Shadow (Dawn at Noon's mark): while the dawn holds.
    if (this.mk('dawn-at-noon', 'hearth') && this.zones.some(z => z.kind === 'dawn')) return true;
    return this.rootwalkT > 0 && !!this.mk('rootwalk', 'hearth');
  }
  /** The discs of Dawn at Noon now burning (the engine paints the daylight and the dark layer unveils inside them). */
  get dawns(): readonly { x: number; y: number; r: number; t: number }[] { return this.zones.filter(z => z.kind === 'dawn'); }
  /** The Lantern Ward drinks a blow first; Last Light holds the fatal one to the last point and is untouchable a while. */
  private lampGuard(n: number): number {
    const p = this.host.player();
    if (this.lastLightT > 0) return 0;
    if (this.lampWard > 0) {
      const soak = Math.min(this.lampWard, n);
      this.lampWard -= soak; n -= soak;
      this.float(p.x + 8, p.y - 30, `-${soak}`, '#fff2a8');
      if (this.lampWard <= 0) this.breakLampWard();
    }
    if (n > 0 && this.rank('last-light') > 0 && this.lastLightCd <= 0) {
      const held = lastLightClamp(n, this.host.playerHp?.() ?? Infinity);
      if (held.caught) {
        const v = this.v('last-light');
        this.lastLightT = v['secs']; this.lastLightCd = v['every'];
        this.effects.push({ kind: 'lastlight', x: p.x, y: p.y - 16, age: 0, life: .9, dir: 1 });
        this.host.say?.('lamp.lastlight');
        n = held.n;
      }
    }
    return n;
  }
  /** The ward breaks: it flashes, and every creature near is blinded (stunned) a while — a boss a fifth as long. */
  private breakLampWard(): void {
    const p = this.host.player(), v = this.v('lantern-ward');
    this.lampWard = 0; this.lampWardT = 0;
    // Shatter-Light (a mark): the breaking heals a share of what it held. Self-Ward Too: it bursts as it breaks.
    const sl = this.mk('lantern-ward', 'breakHeal');
    if (sl) this.healOwed(v['absorb'] * (sl.n ?? 0) / 100);
    this.wardBurst('lantern-ward', v['absorb']);
    this.effects.push({ kind: 'lward-break', x: p.x, y: p.y - 16, r: Math.round(v['radius'] * TILE), age: 0, life: .5, dir: 1 });
    for (const m of this.mobs) if (Math.hypot(m.x - p.x, m.y - p.y) <= v['radius'] * TILE && this.sees(m)) m.stun = Math.max(m.stun ?? 0, ccSecs(v['stun'], m.def.rank));
  }
  /** The nearest creature within `reach` art px of a point and in sight of it (the target first when it is in reach of the Keeper). */
  private foeNear(x: number, y: number, reach: number): Mob | null {
    const p = this.host.player();
    if (this.target && x === p.x && y === p.y && Math.hypot(this.target.x - x, this.target.y - y) <= reach && this.sight.sees(x, y, this.target.x, this.target.y)) return this.target;
    let best: Mob | null = null, bd = reach;
    for (const m of this.mobs) { const d = Math.hypot(m.x - x, m.y - y); if (d <= bd && this.sight.sees(x, y, m.x, m.y)) { bd = d; best = m; } }
    return best;
  }
  /** The Lanternwright's spells. Each reads its numbers at its rank and leaves its picture (td-lantern-fx). */
  private useLampSkill(id: SkillId, v: Record<string, number>): 'nofoe' | null {
    const p = this.host.player();
    if (id === 'blinding-flash') {
      // Everything near takes the light; the dead and the dark-born stand stunned (bosses a fifth as long).
      for (const m of [...this.mobs]) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > v['radius'] * TILE || !this.sees(m)) continue;
        this.hitFoe(m, lightBlow(rnd(v['min'], v['max']), m.def.id), '#fff2a8');
        if (m.hp > 0 && shadowBorn(m.def.id)) m.stun = Math.max(m.stun ?? 0, ccSecs(v['stun'], m.def.rank));
      }
      this.effects.push({ kind: 'lamp-flash', x: p.x, y: p.y - 16, r: Math.round(v['radius'] * TILE), age: 0, life: .5, dir: 1 });
      this.host.swung(null);
    } else if (id === 'shutter-lantern') {
      // The shutters: shut, the lantern and its aura give no light and the Light spell goes out; open, they come back.
      this.shuttered = !this.shuttered;
      if (this.shuttered) this.lightT = 0;
      this.effects.push({ kind: 'shutter', x: p.x + (p.face ?? 1) * 9, y: p.y - 36, age: 0, life: .5, dir: this.shuttered ? -1 : 1 });
      this.host.say?.(this.shuttered ? 'lamp.shut' : 'lamp.open');
      // Flare Open (a mark): the shutters thrown open flash as a Blinding Flash at its share.
      const fo = !this.shuttered ? this.mk(id, 'flareOpen') : null;
      if (fo && this.echoK === 1) this.freeCast('blinding-flash', (fo.n ?? 0) / 100);
    } else if (id === 'banish') {
      const foe = this.foeNear(p.x, p.y, v['reach'] * TILE);
      if (!foe) return 'nofoe';
      const boss = foe.def.rank === 'boss' && shadowBorn(foe.def.id);
      this.effects.push({ kind: 'banish', x: foe.x, y: foe.y, age: 0, life: .5, dir: 1 });
      this.hitFoe(foe, lightBlow(rnd(v['min'], v['max']), foe.def.id) * (boss ? BANISH_BOSS : 1), '#ffffff');
      // What is left of one of the dead, low enough, is unmade outright.
      // Banish the Bearer (a mark): an elite's first affix is undone a while.
      const bb = this.mk(id, 'strip');
      if (bb && foe.hp > 0) this.strip(foe, bb.s ?? 0);
      if (foe.hp > 0 && unmakes(foe.def.id, foe.def.rank, foe.hp, foe.def.hp, v['below'])) {
        this.float(foe.x, foe.y - foe.def.h - 8, `${foe.hp}!`, '#ffffff');
        foe.hp = 0; this.killSrc = id; this.kill(foe); this.killSrc = null;
        // Lay Them All (a mark): the unmaking hushes everything near it.
        const la = this.mk(id, 'unmakeHush');
        if (la) for (const m of this.mobs) if (Math.hypot(m.x - foe.x, m.y - foe.y) <= (la.n ?? 0) * TILE) this.applyStatus(m, 'hush', la.s ?? 0);
      }
      this.host.swung(foe);
    } else if (id === 'dawn-at-noon') {
      this.zones.push({ kind: 'dawn', x: p.x, y: p.y, r: v['radius'] * TILE, t: v['secs'], tick: 0, min: v['dps'], max: v['dps'] });
      this.effects.push({ kind: 'dawn-rise', x: p.x, y: p.y, r: Math.round(v['radius'] * TILE), age: 0, life: .9, dir: 1 });
      this.host.swung(null);
    } else if (id === 'hearthlight') {
      // Quick Mend (a mark): a share of it lands at once, the rest over its seconds. Hearth Bond: more Defense a while.
      const qm = this.mk(id, 'quickMend'), now = qm ? Math.round(v['heal'] * (qm.n ?? 0) / 100) : 0;
      if (now > 0) { this.host.healPlayer(now); this.float(p.x, p.y - 36, `+${now}`, '#7fe08a'); }
      this.hot = healOverTime(v['heal'] - now, v['secs']);
      const hb = this.mk(id, 'defBuff');
      if (hb) { this.defBuffT = hb.s ?? 0; this.defBuffPct = hb.n ?? 0; }
      this.effects.push({ kind: 'hearthglow', x: p.x, y: p.y, age: 0, life: .9, dir: 1 });
      this.host.swung(null);
    } else if (id === 'hearth-circle') {
      // One circle at a time: a new one is laid where the Keeper stands now.
      for (let i = this.zones.length - 1; i >= 0; i--) if (this.zones[i].kind === 'hearth') this.zones.splice(i, 1);
      this.zones.push({ kind: 'hearth', x: p.x, y: p.y, r: v['radius'] * TILE, t: v['secs'], tick: 0, min: v['heal'], max: v['slow'] });
      this.host.swung(null);
    } else if (id === 'lantern-ward') {
      this.lampWard = v['absorb']; this.lampWardT = v['secs'];
      this.effects.push({ kind: 'lward', x: p.x, y: p.y - 16, age: 0, life: .5, dir: 1 });
      this.host.swung(null);
    } else if (id === 'lamp-wisp') {
      // The wisps answer in a flock of `count` (the old ones go back to the dark).
      this.wisps.length = 0;
      // Spread evenly round his shoulders (a third wisp no longer circles inside the first). Lantern Swarm (a mark):
      // more of them, each at its share; Wisp Ward: each holds one shot off.
      const sw = this.mk(id, 'swarm'), extra = sw?.m ?? 0, n = Math.max(1, v['count']) + extra, ward = !!this.mk(id, 'wispWard');
      for (let i = 0; i < n; i++) this.wisps.push({ x: p.x, y: p.y - 26, t: v['secs'], cd: .4 + i * .3, a: i * Math.PI * 2 / n, ...(i >= n - extra ? { k: (sw?.n ?? 100) / 100 } : {}), ...(ward ? { ward: true } : {}) });
      this.effects.push({ kind: 'wisp-call', x: p.x, y: p.y - 26, age: 0, life: .6, dir: 1 });
      this.host.swung(null);
    } else if (id === 'beacon') {
      // Two Beacons (a mark): more may stand; the oldest goes when a new one is planted past that.
      const most = this.mk(id, 'twoBeacons')?.n ?? 1;
      while (this.beacons.length >= most) this.beacons.shift();
      this.beacons.push({ x: p.x + (p.face ?? 1) * 14, y: p.y + 2, t: v['secs'], cd: .5 });
      this.effects.push({ kind: 'beacon-plant', x: p.x + (p.face ?? 1) * 14, y: p.y + 2, age: 0, life: .6, dir: 1 });
      this.host.swung(null);
    }
    return null;
  }
  /** The Lanternwright's timers each frame: the heal's ticks, the ward, Last Light, the wisps' and the beacon's motes. */
  private tickLamp(dt: number): void {
    const p = this.host.player();
    if (this.defBuffT > 0) this.defBuffT = Math.max(0, this.defBuffT - dt);
    // Warm Light (the Lantern Aura's mark), Warm Pole (the Beacon's): life back a second while they hold.
    const wl = this.aura === 'lantern-aura' ? this.mk('lantern-aura', 'regen') : null;
    if (wl) this.healOwed(this.keeperMaxHp * (wl.n ?? 0) / 100 * dt);
    const wp = this.mk('beacon', 'poleRegen');
    if (wp && this.beacons.some(b => Math.hypot(b.x - p.x, b.y - p.y) <= (wp.m ?? 0) * TILE)) this.healOwed(this.keeperMaxHp * (wp.n ?? 0) / 100 * dt);
    if (this.hot) {
      const paid = stepHeal(this.hot, dt);
      if (paid > 0) { this.host.healPlayer(paid); this.float(p.x, p.y - 36, `+${paid}`, '#7fe08a'); }
      if (this.hot.left <= 0) this.hot = null;
    }
    if (this.lampWardT > 0) { this.lampWardT -= dt; if (this.lampWardT <= 0) { this.lampWardT = 0; this.lampWard = 0; } }
    if (this.lastLightT > 0) this.lastLightT = Math.max(0, this.lastLightT - dt);
    if (this.lastLightCd > 0) this.lastLightCd = Math.max(0, this.lastLightCd - dt);
    // Moth-Kin: the kin's motes strike harder.
    const kin = this.rank('moth-kin') > 0 ? 1 + this.v('moth-kin')['pct'] / 100 : 1;
    const wv = this.v('lamp-wisp');
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      w.t -= dt; w.cd -= dt; w.a += dt * 2.4;
      if (w.t <= 0) { this.wisps.splice(i, 1); continue; }
      // It circles the Keeper's shoulders, a little behind his lantern.
      w.x = p.x + Math.cos(w.a) * 14; w.y = p.y - 28 + Math.sin(w.a) * 5;
      if (w.cd > 0) continue;
      const foe = this.foeNear(p.x, p.y, wv['range'] * TILE);
      if (!foe) continue;
      w.cd = 1;
      this.bolts.push({ x: w.x, y: w.y, to: foe, dmg: rnd(wv['min'], wv['max']) * kin * (w.k ?? 1), age: 0, lamp: true, lift: p.y - w.y, src: 'lamp-wisp' });
    }
    const bv = this.v('beacon');
    for (let i = this.beacons.length - 1; i >= 0; i--) {
      const b = this.beacons[i];
      b.t -= dt; b.cd -= dt;
      if (b.t <= 0) { this.beacons.splice(i, 1); continue; }
      if (b.cd > 0) continue;
      const foe = this.foeNear(b.x, b.y, bv['range'] * TILE);
      if (!foe) continue;
      b.cd = 1;
      this.bolts.push({ x: b.x, y: b.y - 30, to: foe, dmg: rnd(bv['min'], bv['max']) * kin, age: 0, lamp: true, lift: 30, src: 'beacon' });
    }
    for (const m of this.mobs) if ((m.revealT ?? 0) > 0) m.revealT = Math.max(0, (m.revealT ?? 0) - dt);
  }

  // ── The Thornstrider (td-thorn-skills.ts, design-bible §4.5) ──

  /** Wolf, Bear or Hart: calls made (the turn), and the kind of the beast called last (null: none, or not the mark). */
  private calls3 = 0;
  calledKind: 'wolf' | 'bear' | 'hart' | null = null;
  /** Thorn Shots loosed (Hunter's Rhythm counts them), and Leaf-Shadow's sure crit waiting. */
  private thornShots = 0;
  private leafReady = false;
  /** Pack Bond holds: the aura runs and the Keeper's beast stands within its reach. */
  get bonded(): boolean {
    if (!this.thorn || this.aura !== 'pack-bond' || this.rank('pack-bond') <= 0 || !this.beast) return false;
    const p = this.host.player();
    return Math.hypot(this.beast.x - p.x, this.beast.y - p.y) <= this.v('pack-bond')['radius'] * TILE;
  }
  /** How much harder the beasts strike (%): Pack Bond while bonded, Wild Heart, and Command on the commanded foe. */
  beastPct(commanded: boolean): number {
    return (this.bonded ? this.v('pack-bond')['pct'] : 0) + (this.rank('wild-heart') > 0 ? this.v('wild-heart')['pct'] : 0)
      + (commanded && this.commandT > 0 ? this.v('command')['pct'] : 0);
  }
  /** The commanded foe while Command holds (null: none, or it fell). */
  get commanded(): Mob | null {
    const f = this.commandFoe;
    return this.commandT > 0 && f && f.hp > 0 && this.mobs.includes(f) ? f : null;
  }
  /**
   * Loose an arrow at `foe`: it seeks it (or, given `angle`, flies straight that way, a Volley's), carrying the
   * Heartwood's lift and its pierce, the Thorn Shot's knock and a Barbed Shot's bleed.
   */
  private looseArrow(foe: Mob, dmg: number, o: { angle?: number; barb?: { dps: number; secs: number }; pierce?: number; src?: SkillId; crit?: boolean; most?: number } = {}): void {
    const p = this.host.player(), face = p.face ?? 1, sx = p.x + face * 7, sy = p.y - 20;
    const tv = this.v('thorn-shot'), hw = this.rank('heartwood') > 0 ? this.v('heartwood') : null;
    const aim = o.angle ?? Math.atan2(foe.y - foe.def.h / 2 - sy, foe.x - sx);
    this.arrows.push({
      // Its ground track (td-sight): from the bow, 20 px up, down to the foe's middle.
      lift: 20, land: foe.def.h / 2, reach: Math.hypot(foe.x - sx, foe.y - p.y),
      x: sx, y: sy, vx: Math.cos(aim) * ARROW_SPEED, vy: Math.sin(aim) * ARROW_SPEED, age: 0, life: (this.range + 2 * TILE) / ARROW_SPEED,
      dmg: dmg * (1 + (hw?.['pct'] ?? 0) / 100), to: o.angle === undefined ? foe : null, hit: [],
      pierce: o.pierce ?? tv['pierce'] + (hw?.['pierce'] ?? 0) + this.gearPierce, knock: tv['knock'], ...(o.barb ? { barb: o.barb } : {}),
      src: o.src ?? this.src ?? 'thorn-shot', ...(o.crit ? { crit: true } : {}), ...(o.most ? { most: o.most } : {}),
    });
    this.loosed++;
    this.effects.push({ kind: 'loose', x: sx, y: sy, age: 0, life: .2, dir: face, a: aim });
  }
  /** Knock a creature back along (ux, uy) by `px`, stopping at the last open step (never a rooted one). */
  private knock(m: Mob, ux: number, uy: number, px: number): void {
    // A rooted creature is held fast: the roots do not let it be knocked off its ground.
    if (!(px > 0) || (m.rootT ?? 0) > 0) return;
    const n = Math.max(1, Math.ceil(px / 2)), step = px / n;
    for (let i = 0; i < n; i++) {
      const nx = m.x + ux * step, ny = m.y + uy * step;
      if (!this.free(nx, ny, m.def.floats)) break;
      m.x = nx; m.y = ny;
    }
  }
  /** The arrows in flight: each seeks its foe until it strikes, then flies on straight; a pierce carries it further. */
  private updateArrows(dt: number): void {
    if (!this.arrows.length) return;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.age += dt;
      if (a.to && (a.to.hp <= 0 || !this.mobs.includes(a.to))) a.to = null;
      if (a.to) {
        const dx = a.to.x - a.x, dy = a.to.y - a.to.def.h / 2 - a.y, d = Math.hypot(dx, dy);
        if (d > 1) { a.vx = dx / d * ARROW_SPEED; a.vy = dy / d * ARROW_SPEED; }
      }
      const x0 = a.x, g0 = groundY(a, a.y, (a.age - dt) * ARROW_SPEED);
      a.x += a.vx * dt; a.y += a.vy * dt;
      // A wall on its ground track: it breaks there (td-sight), whatever stands behind.
      const wall = this.wallOn(x0, g0, a.x, groundY(a, a.y, a.age * ARROW_SPEED));
      if (wall) { this.arrows.splice(i, 1); this.walled++; this.puff(wall.x, a.y + (wall.y - groundY(a, a.y, a.age * ARROW_SPEED)), 'life'); continue; }
      if (a.age > a.life) { this.arrows.splice(i, 1); continue; }
      const ux = a.vx / ARROW_SPEED, uy = a.vy / ARROW_SPEED;
      for (const m of [...this.mobs]) {
        if (a.hit.includes(m) || Math.hypot(m.x - a.x, m.y - m.def.h / 2 - a.y) > Math.max(7, m.def.w / 3)) continue;
        a.hit.push(m);
        this.effects.push({ kind: 'arrow-hit', x: a.x, y: a.y, age: 0, life: .3, dir: ux < 0 ? -1 : 1, a: Math.atan2(uy, ux) });
        this.forceCrit = !!a.crit;
        try { this.hitFoe(m, a.dmg, '#d8f0a8', a.src ?? 'thorn-shot'); } finally { this.forceCrit = false; }
        if (a.barb && m.hp > 0) {
          const b = addBleed((m.bleedT ?? 0) > 0 ? { t: m.bleedT ?? 0, dps: m.bleedDps ?? 0 } : null, a.barb.dps, a.barb.secs);
          m.bleedT = b.t; m.bleedDps = b.dps; m.bleedTick = (m.bleedTick ?? 0) > 0 ? m.bleedTick : 1;
          this.effects.push({ kind: 'bleed', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .45, dir: 1 });
        }
        if (m.hp > 0) this.knock(m, ux, uy, knockFor(a.knock, m.def.rank));
        // Through and on to the next foe in its line, a little spent — or it stays in this one.
        if (a.hit.length < (a.most ?? PIERCE_MAX) && pierces(a.pierce, Math.random())) { a.to = null; a.dmg *= PIERCE_KEEP; continue; }
        this.arrows.splice(i, 1);
        break;
      }
    }
  }
  /** The Thornstrider's timers each frame: Command, Rootwalk, the called beast's hunt and the stampede's run. */
  private tickThorn(dt: number): void {
    const p = this.host.player();
    if (this.commandT > 0) { this.commandT = Math.max(0, this.commandT - dt); if (!this.commanded) { this.commandT = 0; this.commandFoe = null; } }
    if (this.rootwalkT > 0) {
      this.rootwalkT = Math.max(0, this.rootwalkT - dt);
      if (Math.random() < dt * 7) this.effects.push({ kind: 'rootwalk', x: p.x + rnd(-4, 4), y: p.y + 1, age: 0, life: .9, dir: 1 });
    }
    const k = 1 + this.beastPct(false) / 100, face = this.formFace(), fans = this.fanCounts();
    let slot = this.minions.length;
    for (let i = this.beasts.length - 1; i >= 0; i--) {
      const b = this.beasts[i];
      b.age += dt; b.cd -= dt;
      if (b.kind === 'stampede') {
        if (b.age < 0) continue;
        const vx = b.vx ?? 0, vy = b.vy ?? 0, sp = Math.hypot(vx, vy) || 1;
        // A wall ends the run where it stands (td-sight): the herd does not trample the room behind it.
        if (this.sight.wallAt(b.x + vx * dt, b.y + vy * dt - 1)) { this.beasts.splice(i, 1); this.puff(b.x, b.y - 8, 'life'); this.effects.push({ kind: 'trample', x: b.x, y: b.y, age: 0, life: .5, dir: b.face }); continue; }
        b.x += vx * dt; b.y += vy * dt; b.left = (b.left ?? 0) - sp * dt;
        if (Math.random() < dt * 9) this.effects.push({ kind: 'trample', x: b.x - vx / sp * 6, y: b.y, age: 0, life: .5, dir: b.face });
        for (const m of [...this.mobs]) {
          if (b.hit?.includes(m) || Math.hypot(m.x - b.x, m.y - b.y) > 10 + m.def.w / 4 || !this.sight.sees(b.x, b.y, m.x, m.y)) continue;
          (b.hit ??= []).push(m);
          this.hitFoe(m, rnd(b.dmg[0], b.dmg[1]) * k, '#9af0d0', 'stampede');
          if (m.hp > 0) this.knock(m, vx / sp, vy / sp, m.def.rank === 'boss' ? (b.knock ?? 0) * .2 : b.knock ?? 0);
        }
        if ((b.left ?? 0) <= 0) { this.beasts.splice(i, 1); this.effects.push({ kind: 'trample', x: b.x, y: b.y, age: 0, life: .5, dir: b.face }); }
        continue;
      }
      b.t -= dt;
      if (b.t <= 0) { this.beasts.splice(i, 1); this.effects.push({ kind: 'wild-call', x: b.x, y: b.y, age: 0, life: .5, dir: -1 }); continue; }
      // Its place in the Keeper's formation, after the raised (td-sight formationSpot).
      const home = formationSpot(slot++, p, face);
      // Left far behind: it steps out of the green at the Keeper's side again.
      if (Math.hypot(b.x - p.x, b.y - p.y) > MINION_LEASH * 1.6) { const at = this.slotOpen(home); b.x = at.x; b.y = at.y; b.target = null; }
      const sent = this.commanded;
      if (sent) b.target = sent;
      else if (!b.target || b.target.hp <= 0 || !this.mobs.includes(b.target) || Math.hypot(b.target.x - p.x, b.target.y - p.y) > MINION_LEASH || !this.sight.sees(b.x, b.y, b.target.x, b.target.y, true)) b.target = pickMinionTarget(b, this.mobs, p, MINION_SIGHT, MINION_LEASH, m => this.sight.sees(b.x, b.y, m.x, m.y, false));
      // td-roam: a Command sends it in; else it hunts, strolls near the Keeper while he stands, or keeps to the formation.
      const rm = sent ? null : this.roamOf(b, b.target, dt);
      if (rm && rm.mode !== 'hunt') b.target = null;
      const foe = b.target;
      const reach = foe ? MOB_REACH + foe.def.w / 4 : 0;
      const { x: tx, y: ty } = foe ? this.fanFor(b, foe, fans) : rm?.idle ? b : rm?.goal ?? home;
      const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy);
      if (len > 2) {
        const quick = (this.calledKind === 'hart' ? 1 + (this.mk('call-of-the-wilds', 'wolfBearHart')?.s ?? 0) / 100 : 1) * (!foe && rm?.mode === 'roam' ? rm.pace : 1);
        const step = Math.min(len, BEAST_SPEED * this.pace * quick * dt), mx = dx / len * step, my = dy / len * step;
        if (this.free(b.x + mx, b.y)) b.x += mx;
        if (this.free(b.x, b.y + my)) b.y += my;
      }
      if (foe) b.face = foe.x < b.x ? -1 : 1; else if (Math.abs(dx) > 2) b.face = dx < 0 ? -1 : 1;
      if (foe && Math.hypot(foe.x - b.x, foe.y - b.y) <= reach + 2 && b.cd <= 0 && this.sight.sees(b.x, b.y, foe.x, foe.y)) {
        b.cd = sent === foe ? BEAST_REST * THORN_PET.commandRest : BEAST_REST;
        this.effects.push({ kind: 'slash', x: foe.x, y: foe.y - foe.def.h / 2, age: 0, life: .18, dir: b.face });
        this.hitFoe(foe, rnd(b.dmg[0], b.dmg[1]) * (1 + this.beastPct(sent === foe) / 100), '#9af0d0', 'call-of-the-wilds');
        if (this.calledKind === 'wolf' && foe.hp > 0) { const w = this.mk('call-of-the-wilds', 'wolfBearHart'); if (w) this.applyStatus(foe, 'chill', w.n ?? 1); }
        // Hamstring (Command's mark): the commanded foe's bites from the beasts chill it.
        if (sent === foe && foe.hp > 0) this.ride('command', foe, 0);
      }
    }
  }
  /** The Thornstrider's spells. Each reads its numbers at its rank and leaves its picture (td-thorn-fx). */
  private useThornSkill(id: SkillId, v: Record<string, number>, foeInRange: () => Mob | null): 'nofoe' | null {
    const p = this.host.player(), face: 1 | -1 = (p.face ?? 1) < 0 ? -1 : 1;
    if (id === 'barbed-shot') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      this.looseArrow(foe, arrowBlow(v['min'], v['max'], Math.random, this.weaponSwing), { barb: { dps: v['dps'], secs: v['secs'] } });
      // Twin Barb (a mark): a second arrow on its heels, at its share.
      const tb = this.mk(id, 'twinArrow');
      if (tb) this.looseArrow(foe, arrowBlow(v['min'], v['max'], Math.random, this.weaponSwing) * (tb.n ?? 0) / 100, { barb: { dps: v['dps'], secs: v['secs'] } });
      this.host.swung(foe);
    } else if (id === 'volley') {
      const foe = foeInRange();
      if (!foe) return 'nofoe';
      const aim = Math.atan2(foe.y - foe.def.h / 2 - (p.y - 20), foe.x - (p.x + face * 7));
      // A volley's arrows fly where they are aimed: each strikes the first foe in its own line, none of them pierce —
      // unless Pierce (a mark) carries each through one more. Ring Volley: all round him.
      const pi = this.mk(id, 'pierce'), ring = this.mk(id, 'ringFan'), n = Math.max(1, v['count']);
      const angles = ring ? Array.from({ length: n }, (_, i) => aim + i / n * Math.PI * 2) : fanAngles(aim, n, 11);
      for (const a of angles) this.looseArrow(foe, arrowBlow(v['min'], v['max'], Math.random, this.weaponSwing), { angle: a, pierce: pi ? 100 : 0, ...(pi ? { most: 1 + (pi.n ?? 1) } : {}) });
      this.host.swung(foe);
    } else if (id === 'command') {
      const reach = Math.max(this.range, THORN_PET.commandReach);
      const foe = this.target && this.target.hp > 0 && Math.hypot(this.target.x - p.x, this.target.y - p.y) <= reach && this.sees(this.target) ? this.target : foeInRange();
      if (!foe) return 'nofoe';
      this.commandFoe = foe; this.commandT = v['secs']; this.commands++;
      for (const b of this.beasts) if (b.kind === 'called') b.target = foe;
      this.effects.push({ kind: 'command', x: foe.x, y: foe.y - foe.def.h - 4, age: 0, life: .8, dir: 1 });
      this.host.swung(foe);
    } else if (id === 'call-of-the-wilds') {
      // One called beast at a time: a new call sends the old one back into the green. Two Called (a mark): two of
      // them, each at its share.
      for (let i = this.beasts.length - 1; i >= 0; i--) if (this.beasts[i].kind === 'called') this.beasts.splice(i, 1);
      // Wolf, Bear or Hart (a mark): each call brings the next of the three — a wolf whose bites Chill, a bear that bites
      // harder, a hart that quickens the Keeper's feet (and its own).
      const wbh = this.mk(id, 'wolfBearHart'), kind = wbh ? (['wolf', 'bear', 'hart'] as const)[this.calls3++ % 3] : undefined;
      this.calledKind = kind ?? null;
      const two = this.mk(id, 'twoCalled'), k = (two ? (two.n ?? 100) / 100 : 1) * (kind === 'bear' ? 1 + (wbh?.m ?? 0) / 100 : 1);
      for (let j = 0; j < (two ? 2 : 1); j++) {
        let x = p.x - face * 18, y = p.y + 4 + j * 12;
        if (!this.free(x, y)) { x = p.x; y = p.y; }
        this.beasts.push({ kind: 'called', x, y, t: v['secs'], cd: .4 + j * .3, face, age: 0, dmg: [Math.max(1, Math.round(v['min'] * k)), Math.max(1, Math.round(v['max'] * k))], target: this.commanded });
        this.effects.push({ kind: 'wild-call', x, y, age: 0, life: .7, dir: 1 });
      }
      this.host.swung(null);
    } else if (id === 'stampede') {
      const foe = foeInRange();
      const aim = foe ? Math.atan2(foe.y - p.y, foe.x - p.x) : face < 0 ? Math.PI : 0, ux = Math.cos(aim), uy = Math.sin(aim);
      // They come from behind the Keeper, lane by lane across the line, a step apart, and run past him.
      const sx = p.x - ux * 2 * TILE, sy = p.y - uy * 2 * TILE;
      stampedeLanes(v['count'], 13).forEach((off, i) => {
        this.beasts.push({
          kind: 'stampede', x: sx - uy * off - ux * (i % 2) * 8, y: sy + ux * off - uy * (i % 2) * 8, t: 99, cd: 0, face: ux < 0 ? -1 : 1, age: -i * .06,
          dmg: [v['min'], v['max']], target: null, vx: ux * STAMPEDE_SPEED, vy: uy * STAMPEDE_SPEED, left: (v['length'] + 2) * TILE, hit: [], knock: v['knock'] * TILE,
        });
      });
      this.effects.push({ kind: 'wild-call', x: sx, y: sy, age: 0, life: .7, dir: 2 });
      // The Herd Remembers (a mark): each beast in the charge mends him a little.
      const hr = this.mk(id, 'herdHeal');
      if (hr && this.echoK === 1) this.healOwed(this.keeperMaxHp * (hr.n ?? 0) / 100 * Math.max(1, v['count']));
      this.host.swung(foe);
    } else if (id === 'thornroot-snare') {
      const foe = foeInRange();
      const cx = foe ? foe.x : p.x + face * 2 * TILE, cy = foe ? foe.y : p.y;
      // Across the foe's way to the Keeper: the line stands square to it, one thorn-clump a tile. Ring of Thorns (a
      // mark): a ring round the foe instead.
      const a = Math.atan2(cy - p.y, cx - p.x) + Math.PI / 2, n = Math.max(2, Math.round(v['length'])), ring = this.mk(id, 'ring');
      let pts: { x: number; y: number }[] = [];
      if (ring) pts = this.ringPts(cx, cy, (ring.n ?? 2) * TILE);
      else for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * TILE, q = { x: cx + Math.cos(a) * o, y: cy + Math.sin(a) * o }; if (!this.sight.wallAt(q.x, q.y - 1)) pts.push(q); }
      this.zones.push({ kind: 'snare', x: cx, y: cy, r: TILE * .8, t: v['secs'], tick: 0, min: v['min'], max: v['max'], pts, caught: [] });
      pts.forEach((q, i) => this.effects.push({ kind: 'snare-rise', x: q.x, y: q.y, age: -i * .05, life: .5, dir: 1 }));
      this.host.swung(foe);
    } else if (id === 'bramble-trap') {
      // Two at most (Three Traps, a mark: three): one more lifts the oldest.
      const most = this.mk(id, 'traps')?.n ?? 2, traps = this.zones.filter(z => z.kind === 'trap');
      if (traps.length >= most) this.zones.splice(this.zones.indexOf(traps[0]), 1);
      // Throw Trap (a mark): it lands under a foe within its tiles, else at his feet.
      const th = this.mk(id, 'throwTrap'), foe = th ? this.foeNear(p.x, p.y, (th.n ?? 0) * TILE) : null, tx = foe ? foe.x : p.x, ty = foe ? foe.y : p.y + 2;
      this.zones.push({ kind: 'trap', x: tx, y: ty, r: v['radius'] * TILE, t: v['secs'], tick: 0, min: v['min'], max: v['max'] });
      this.effects.push({ kind: 'trap-set', x: tx, y: ty, age: 0, life: .5, dir: 1 });
      this.host.swung(null);
    } else if (id === 'rootwalk') {
      this.rootwalkT = v['secs']; this.rootwalkPct = v['pct'];
      // Leaf-Shadow (a mark): the next Thorn Shot is a sure crit.
      if (this.mk(id, 'leafCrit')) this.leafReady = true;
      this.effects.push({ kind: 'rootwalk', x: p.x, y: p.y + 1, age: 0, life: .9, dir: 2 });
      this.host.swung(null);
    }
    return null;
  }

  /** An elite's first affix taken away for a while (Unmaking, Banish the Bearer: marks); it comes back after. */
  private strip(m: Mob, secs: number): void {
    // S6: a pack aura ends a while too (Unmaking, Strip, Banish the Bearer; §3).
    if (secs > 0) this.stripAura(m);
    const ax = m.elite?.affixes;
    if (this.replica && secs > 0) this.coop?.laid?.(m, 'strip', secs, this.src);
    if (!ax?.length || m.stripped || !(secs > 0)) return;
    m.stripped = { affix: ax[0], t: ccSecs(secs, m.def.rank) };
    ax.splice(0, 1);
    this.effects.push({ kind: 'pulse', el: 'shadow', x: m.x, y: m.y, age: 0, life: .4, dir: 1 });
  }
  /**
   * The marks a fall sets off (td-marks): the felling skill's mana (Soulfire, Ash to Ash), Grave Purse's life while the
   * siphon runs, a cursed foe's mana (Mark of Ash), and what it carried passing on — the curse (Spreading), the brand's
   * burn (Brand Spreads), the bleed (Spreading Barbs), and a Doom that bursts anyway (Hour of Doom).
   */
  private markKill(m: Mob, src: SkillId | null): void {
    if (!this.marks) return;
    const kill = src ? this.mk(src, 'kill') : null;
    if (kill) this.mana = Math.min(this.maxMana, this.mana + (kill.n ?? 0));
    const purse = this.aura === 'aura-siphon' ? this.mk('aura-siphon', 'killHeal') : null;
    if (purse) this.healOwed(this.keeperMaxHp * (purse.n ?? 0) / 100);
    const near = (reach: number, n: number) => this.mobs.filter(o => o.hp > 0 && Math.hypot(o.x - m.x, o.y - m.y) <= reach * TILE && this.sight.sees(m.x, m.y, o.x, o.y))
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y)).slice(0, n);
    if (m.cursed > 0) {
      const ash = this.mk('ember-curse', 'cursedKill');
      if (ash) this.mana = Math.min(this.maxMana, this.mana + (ash.n ?? 0));
      const sp = this.mk('ember-curse', 'spread');
      if (sp) for (const o of near(sp.s ?? 0, 1)) { o.cursed = Math.max(o.cursed, m.cursed); o.burnT = 1; this.effects.push({ kind: 'curse', x: o.x, y: o.y - o.def.h - 4, age: 0, life: .6, dir: 1 }); }
    }
    if ((m.brandT ?? 0) > 0) {
      const bs = this.mk('ember-brand', 'brandSpread');
      if (bs) for (const o of near(bs.s ?? 0, 1)) { o.brandT = 3; o.brandTick = 1; o.brandDps = this.v('ember-brand')['burn']; o.brandTicks = 3; }
    }
    if ((m.bleedT ?? 0) > 0) {
      const bl = this.mk('barbed-shot', 'bleedSpread');
      if (bl) for (const o of near(bl.s ?? 0, bl.m ?? 1)) this.applyStatus(o, 'bleed', m.bleedT ?? 0, m.bleedDps ?? 0);
    }
    if ((m.doom ?? 0) > 0) {
      const hd = this.mk('doom', 'doomOnDeath');
      if (hd) { m.doom = 0; this.doomBurst(m, (hd.n ?? 100) / 100); }
    }
  }
  /** Doom runs out: the foe bursts, and so does everything near it. */
  private doomBurst(m: Mob, k = 1): void {
    const hit = m.doomHit;
    if (!hit) return;
    const at = { x: m.x, y: m.y };
    for (const o of [...this.mobs]) if (Math.hypot(o.x - at.x, o.y - at.y) <= hit.r && (o === m || this.reaches(at.x, at.y, o))) this.hitFoe(o, rnd(hit.min, hit.max) * k, '#c88bff', 'doom');
    // Unmaking (a mark): the burst strips the doomed creature's first elite affix for a while.
    const un = this.mk('doom', 'strip');
    if (un) this.strip(m, un.s ?? 0);
    this.effects.push({ kind: 'wave', el: 'shadow', x: at.x, y: at.y, age: 0, life: .7, dir: 1, r: Math.round(hit.r) });
    this.effects.push({ kind: 'flash', x: at.x, y: at.y - 8, age: 0, life: .2, dir: 1 });
  }

  /** Spells on the ground: the rain falls, the wall burns, the meteor lands. */
  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt; z.tick -= dt;
      if (z.kind === 'meteor') {
        if (z.t > 0) continue;
        this.zones.splice(i, 1);
        for (const m of [...this.mobs]) if (Math.hypot(m.x - z.x, m.y - z.y) <= z.r && this.reaches(z.x, z.y, m)) this.hitFoe(m, rnd(z.min, z.max) * this.fireMult, '#ff9a4a', 'meteor');
        this.effects.push({ kind: 'wave', x: z.x, y: z.y, age: 0, life: 1, dir: 1, r: Math.round(z.r) });
        this.effects.push({ kind: 'bolt-hit', x: z.x, y: z.y - 6, age: 0, life: .4, dir: 1 });
        if (!z.frag) {
          // Burning Crater (a mark): the ground it struck burns. Splitting Stone: fragments land round its edge.
          this.layField('meteor', z.x, z.y, { min: z.min, max: z.max });
          const sp = this.mk('meteor', 'split');
          if (sp) {
            const n = sp.m ?? 0, k = (sp.n ?? 0) / 100;
            for (let j = 0; j < n; j++) {
              const a = j / n * Math.PI * 2;
              this.zones.push({ kind: 'meteor', x: z.x + Math.cos(a) * z.r, y: z.y + Math.sin(a) * z.r, r: TILE, t: .25, tick: 0, min: Math.max(1, Math.round(z.min * k)), max: Math.max(1, Math.round(z.max * k)), frag: true });
            }
          }
        }
        continue;
      }
      if (z.kind === 'field') {
        // A mark's burning ground: once a second, every foe on it burns.
        if (z.t <= 0) { this.zones.splice(i, 1); continue; }
        if (Math.random() < dt * 8) this.effects.push({ kind: 'flame', x: z.x + rnd(-Math.round(z.r), Math.round(z.r)) * .7, y: z.y + rnd(-Math.round(z.r), Math.round(z.r)) * .5, age: 0, life: .4, dir: 1 });
        if (z.tick <= 0) {
          z.tick = 1;
          for (const m of [...this.mobs]) if (Math.hypot(m.x - z.x, m.y - z.y) <= z.r && this.reaches(z.x, z.y, m)) this.hitFoe(m, z.min * this.fireMult, '#ff8a2e', null);
        }
        continue;
      }
      if (z.kind === 'whirl') {
        // The whirl turns with the Keeper: a full ring of the blade each half second while it lasts.
        const p = this.host.player();
        z.x = p.x; z.y = p.y;
        // `max` counts the turns still to come.
        if (z.tick <= 0 && z.max > 0) { z.tick = .5; z.max--; this.strike(0, z.r, 360, z.min, true, null, 'whirl-of-cinders'); }
        if (z.max <= 0) this.zones.splice(i, 1);
        continue;
      }
      if (z.t <= 0) { this.zones.splice(i, 1); continue; }
      if (z.kind === 'hearth') {
        // The Hearth Circle: the Keeper inside mends `min` life a second (paid whole, the rest carried).
        const p = this.host.player();
        // Moving Hearth (a mark): the circle walks with him.
        if (this.mk('hearth-circle', 'followSelf')) { z.x = p.x; z.y = p.y; }
        if (inDisc(p.x, p.y, z.x, z.y, z.r)) {
          this.hearthOwed += z.min * dt;
          const whole = Math.floor(this.hearthOwed);
          if (whole > 0) { this.hearthOwed -= whole; this.host.healPlayer(whole); }
        }
        continue;
      }
      if (z.kind === 'snare' && z.pts) {
        // The Thornroot Snare: whatever crosses the line is struck once and rooted (a boss a fifth as long).
        const v = this.v('thornroot-snare');
        for (const m of [...this.mobs]) {
          if (z.caught?.includes(m) || !z.pts.some(q => Math.hypot(m.x - q.x, m.y - q.y) <= z.r && this.reaches(q.x, q.y, m))) continue;
          (z.caught ??= []).push(m);
          m.rootT = Math.max(m.rootT ?? 0, ccSecs(v['root'], m.def.rank));
          this.effects.push({ kind: 'snare-rise', x: m.x, y: m.y, age: 0, life: .5, dir: 1 });
          this.hitFoe(m, rnd(z.min, z.max), '#c9a66b', 'thornroot-snare');
        }
        // Grasping (a mark): every few seconds the thorns take hold of what stands in them again.
        const gr = this.mk('thornroot-snare', 'regrasp');
        if (gr) {
          z.regrasp = (z.regrasp ?? gr.s ?? 0) - dt;
          if (z.regrasp <= 0) {
            z.regrasp = gr.s ?? 0;
            for (const m of z.caught ?? []) if (m.hp > 0 && z.pts.some(q => Math.hypot(m.x - q.x, m.y - q.y) <= z.r)) { m.rootT = Math.max(m.rootT ?? 0, ccSecs(v['root'], m.def.rank)); this.effects.push({ kind: 'snare-rise', x: m.x, y: m.y, age: 0, life: .5, dir: 1 }); }
          }
        }
        continue;
      }
      if (z.kind === 'trap') {
        // A Bramble Trap: the first creature to step on it springs it on everything near.
        const v = this.v('bramble-trap');
        if (!this.mobs.some(m => Math.hypot(m.x - z.x, m.y - z.y) <= 10 + m.def.w / 4 && this.reaches(z.x, z.y, m))) continue;
        this.zones.splice(i, 1);
        this.effects.push({ kind: 'trap-spring', x: z.x, y: z.y, r: z.r, age: 0, life: .6, dir: 1 });
        for (const m of [...this.mobs]) if (Math.hypot(m.x - z.x, m.y - z.y) <= z.r && this.reaches(z.x, z.y, m)) {
          m.rootT = Math.max(m.rootT ?? 0, ccSecs(v['root'], m.def.rank));
          this.hitFoe(m, rnd(z.min, z.max), '#c9a66b', 'bramble-trap');
        }
        continue;
      }
      if (z.kind === 'dawn') {
        // Moving Sun (a mark): the disc walks with the Keeper. Healing Sun: inside it he mends.
        const pk = this.host.player();
        if (this.mk('dawn-at-noon', 'followSelf')) { z.x = pk.x; z.y = pk.y; }
        const hs = this.mk('dawn-at-noon', 'zoneRegen');
        if (hs && inDisc(pk.x, pk.y, z.x, z.y, z.r)) this.healOwed(this.keeperMaxHp * (hs.n ?? 0) / 100 * dt);
        // Dawn at Noon: twice a second the dead and the dark-born inside burn; everything inside is unveiled.
        for (const m of this.mobs) if (inDisc(m.x, m.y, z.x, z.y, z.r) && this.reaches(z.x, z.y, m)) m.revealT = Math.max(m.revealT ?? 0, .6);
        if (z.tick <= 0) {
          z.tick = .5;
          for (const m of [...this.mobs]) if (inDisc(m.x, m.y, z.x, z.y, z.r) && shadowBorn(m.def.id) && this.reaches(z.x, z.y, m)) {
            this.effects.push({ kind: 'kindle-hit', x: m.x, y: m.y - m.def.h / 2, age: 0, life: .3, dir: 1 });
            this.hitFoe(m, z.min / 2, '#fff2a8', 'dawn-at-noon');
          }
        }
        continue;
      }
      if (z.kind === 'rain') {
        // Firestorm (a mark): the cloud drifts after the nearest foe.
        const fs = this.mk('cinder-rain', 'followFoe');
        if (fs) {
          const near = this.mobs.reduce<Mob | null>((b, m) => (!b || Math.hypot(m.x - z.x, m.y - z.y) < Math.hypot(b.x - z.x, b.y - z.y) ? m : b), null);
          if (near) { const dx = near.x - z.x, dy = near.y - z.y, d = Math.hypot(dx, dy), step = Math.min(d, (fs.n ?? 0) * TILE * dt); if (d > 1) { z.x += dx / d * step; z.y += dy / d * step; } }
        }
        // Falling cinders all over the circle; twice a second each foe under it is struck.
        if (Math.random() < dt * 14) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r, x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
          this.effects.push({ kind: 'cinder', x, y, age: 0, life: .3, dir: 1 });
          this.effects.push({ kind: 'bolt-hit', x, y, age: -.3, life: .3, dir: 1 });
        }
        if (z.tick <= 0) {
          z.tick = .5;
          for (const m of [...this.mobs]) if (Math.hypot(m.x - z.x, m.y - z.y) <= z.r && this.reaches(z.x, z.y, m)) this.hitFoe(m, rnd(z.min, z.max) * this.fireMult, '#ff9a4a', 'cinder-rain');
        }
      } else if (z.kind === 'wall' && z.pts) {
        if (Math.random() < dt * 18) { const q = z.pts[Math.floor(Math.random() * z.pts.length)]; this.effects.push({ kind: 'flame', x: q.x + rnd(-4, 4), y: q.y, age: 0, life: .5, dir: 1 }); }
        if (z.tick <= 0) {
          z.tick = 1;
          for (const m of [...this.mobs]) if (z.pts.some(q => Math.hypot(m.x - q.x, m.y - q.y) <= z.r && this.reaches(q.x, q.y, m))) this.hitFoe(m, z.min * this.fireMult, '#ff8a2e', 'flame-wall');
        }
      }
    }
  }

  /** Wood chips flying off a struck tree (the host's chopping). */
  chips(x: number, y: number): void { this.effects.push({ kind: 'chips', x, y, age: 0, life: .45, dir: Math.random() < .5 ? -1 : 1 }); }

  /** Can this creature step to (x, y)? Open ground, and for a world boss (bound) never a town's safe ground. */
  private canStep(m: Mob, x: number, y: number): boolean {
    return this.free(x, y, m.def.floats) && !(m.def.bound && this.host.safeAt?.(x, y));
  }
  /** A ground attack (MobDef.rend): one ring under (x, y), the rest round it; each bursts when its tell runs out. */
  private rendAt(m: Mob, x: number, y: number): void {
    const rend = m.def.rend;
    if (!rend) return;
    const weak = this.weakOf(m), type = mobHits(m.def), turn = m.t;
    for (let i = 0; i < rend.rings; i++) {
      const a = turn + (i - 1) / Math.max(1, rend.rings - 1) * Math.PI * 2, r = i ? rend.spread : 0;
      let dmg = rnd(rend.dmg[0], rend.dmg[1]);
      if (weak > 0) dmg = Math.max(1, Math.round(dmg * (1 - weak / 100)));
      this.bursts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * .6, t: rend.tell, r: rend.r, dmg, delay: rend.tell, el: 'shadow', type, lv: m.def.level });
    }
    m.chantT = CHANT_SECS; m.chantText = rend.chant;
  }
  /** A creature leaves the world without falling (the Seam Eater when the eclipse ends): no kill, no loot, no respawn wait. */
  banish(m: Mob): void {
    const i = this.mobs.indexOf(m);
    if (i < 0) return;
    this.mobs.splice(i, 1);
    if (this.target === m) this.target = null;
    for (let j = 0; j < 10; j++) this.effects.push({ kind: 'dust', x: m.x + rnd(-m.def.w / 3, m.def.w / 3), y: m.y - rnd(0, Math.round(m.def.h / 2)), age: 0, life: .7, dir: 1 });
    this.effects.push({ kind: 'wave', el: 'shadow', r: Math.round(m.def.w * .6), x: m.x, y: m.y, age: 0, life: .6, dir: 1 });
  }
  /** Test hooks only (td-engine `?fxseam=1`): a boss begins an attack at the Keeper now, as if it had chosen to. */
  provoke(m: Mob, kind: 'breath' | 'rend'): void {
    const p = this.host.player();
    if (kind === 'rend') { this.rendAt(m, p.x, p.y); m.rendCd = m.def.rend?.rate ?? 0; return; }
    if (!m.def.ranged) return;
    m.face = p.x < m.x ? -1 : 1;
    m.rcd = m.def.ranged.rate; m.tell = BOSS_TELL; m.aim = { x: p.x, y: p.y - 12 };
    if (m.def.chant) { m.chantT = CHANT_SECS; m.chantText = m.def.chant; }
  }

  private free(x: number, y: number, floats = false): boolean {
    const ok = floats && this.host.hover ? (c: number, r: number) => this.host.hover!(c, r) : (c: number, r: number) => this.host.walkable(c, r);
    for (const [ox, oy] of [[-4, -3], [4, -3], [-4, -1], [4, -1]]) if (!ok(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
    return true;
  }

  private float(x: number, y: number, text: string, color: string): void { this.floaters.push({ x, y, text, color, age: 0 }); }

  /** The type a creature's blow carries now: a Spectral Hit picks a new element each blow. */
  private blowType(m: Mob): DamageType {
    if (m.elite?.affixes.includes('spectral-hit')) return SPECTRAL[Math.floor(Math.random() * SPECTRAL.length)];
    return mobHits(m.def);
  }
  /** What an elite's blow does beyond its damage: Mana Burn drains, Cursed marks. */
  private eliteBlow(m: Mob): void {
    const ax = m.elite?.affixes;
    if (!ax?.length) return;
    this.shotAffixes({ burn: ax.includes('mana-burn'), curse: ax.includes('cursed') });
  }
  private shotAffixes(s: { burn?: boolean; curse?: boolean }): void {
    const p = this.host.player();
    if (s.burn && this.mana > 0) { const took = Math.min(this.mana, MANA_BURN); this.mana -= took; this.float(p.x - 10, p.y - 40, `-${Math.round(took)}`, AFFIX_DEFS['mana-burn'].color); }
    if (s.curse) { if (this.curseT <= 0) this.float(p.x + 10, p.y - 40, AFFIX_DEFS.cursed.name, AFFIX_DEFS.cursed.color); this.curseT = CURSE_SECONDS; }
  }

  private kill(m: Mob): void {
    this.mobs.splice(this.mobs.indexOf(m), 1);
    this.markKill(m, this.killSrc);
    if (m.elite?.role === 'leader' || !m.elite) this.fallen.set(m.key, (this.fallen.get(m.key) ?? 0) + 1);
    // Fire Enchanted: it bursts where it fell, after its ring has shown the reach.
    if (m.elite?.affixes.includes('fire-enchanted')) this.bursts.push({ x: m.x, y: m.y, t: FIRE_BURST.delay, r: FIRE_BURST.r, dmg: Math.round(m.def.dmg[1] * FIRE_BURST.share), lv: m.def.level });
    // Ember-hearted (S6): a bigger burst, later, its ring on the ground first.
    if (m.elite?.affixes.includes('ember-hearted')) this.bursts.push({ x: m.x, y: m.y, t: EMBER_HEART.delay, delay: EMBER_HEART.delay, r: EMBER_HEART.r, dmg: Math.round(m.def.dmg[1] * EMBER_HEART.share), lv: m.def.level, type: 'fire', el: 'ember', tone: 'ember' });
    // Redemption (a pack aura, S6): a fall in its reach heals the rest of the pack, and lays this one to rest.
    const redeem = m.bless?.id === 'redemption' && m.bless.by !== m && m.bless.by.hp > 0 ? m.bless.fx.redeem : 0;
    if (redeem > 0) for (const k of this.mobs) if (k.bless?.by === m.bless!.by) { k.hp = Math.min(k.def.hp, k.hp + healBase(k) * redeem); this.effects.push({ kind: 'heal', x: k.x, y: k.y - k.def.h / 2, age: 0, life: .5, dir: 1 }); }
    // Redemption (a worn aura): a creature that falls near the Keeper heals him.
    if (this.itemAura && this.itemAura.fx.healPerCorpse > 0 && this.inItemAura(m)) this.host.healPlayer(this.itemAura.fx.healPerCorpse);
    // Soul Harvest (passive): every kill gives back mana.
    if (this.rank('soul-harvest') > 0) this.mana = Math.min(this.maxMana, this.mana + this.v('soul-harvest')['mana']);
    // A worn unique (unique-items.ts reforge-memory): every kill gives back mana.
    if (this.relics.manaKill > 0) this.mana = Math.min(this.maxMana, this.mana + this.relics.manaKill);
    if (this.target === m) this.target = null;
    this.deadUntil.set(m.key, this.clock + (this.respawnOf?.(m) ?? RESPAWN));
    // Fresh dead, for Raise Skeleton.
    this.corpses.push({ x: m.x, y: m.y, at: this.clock });
    if (this.corpses.length > 12) this.corpses.shift();
    // Shared creatures: the party hears who fought it; the host, if it never did, takes only the party share.
    const by = m.coopBy ? [...m.coopBy].filter(i => i) : [];
    const fought = !this.coop || !m.coopBy || m.coopBy.has('');
    if (this.coop) this.coop.killed(m, by);
    // S6: fire leaves ash (nothing raises it); Redemption lays it to rest; a raised one or a mirror never rises twice.
    const cp = m.mirror ? null : this.leaveCorpse(m);
    if (cp && (this.fireBlow || (m.scorchT ?? 0) > 0 || (m.brandT ?? 0) > 0 || (m.singeT ?? 0) > 0)) cp.ash = true;
    if (cp && (redeem > 0 || m.raised)) cp.rested = true;
    // Keep Walking (the Bone Walker): one in four stand up once more, unless burnt or broken.
    if (cp && !cp.ash && !cp.rested && ABIL_PASSIVE_ID(m.def.id, 'keep-walking') && Math.random() < KEEP_WALKING.chance) {
      this.calls.push({ x: m.x, y: m.y, type: m.def.id, key: `${m.key}~kw${Math.round(this.clock * 10)}`, t: KEEP_WALKING.after, level: m.def.level, corpse: cp.id, pct: KEEP_WALKING.pct, ...(m.personal ? { personal: true } : {}) });
    }
    // The raised and the mirrored owe nothing: no XP, no loot (the singer's verse is not a second kill).
    if (m.raised || m.mirror) return;
    this.spoils(m, fought || this.roomLoot ? 'own' : 'share', undefined, cp?.id ?? '');
  }
  /**
   * What a fall pays this Keeper (onKill: Hunting XP, the Bestiary, the tasks) and leaves on the ground (Gold, materials,
   * gear: personal loot). `own`: a kill of its own; `coop`: a shared creature it fought, felled on the host (never
   * announced again to the party); `share`: it was there but did not fight (the party share, no loot).
   */
  private spoils(m: Mob, mode: 'own' | 'coop' | 'share', baseHp = m.coopBase ?? m.def.hp, corpseId = '', loot = true, room = ''): void {
    const id = `td:${this.host.levelId()}:${m.key}:${Date.now().toString(36)}:${this.kills++}`;
    const areaId = this.host.levelId() === 'surface' ? 'ember-quarry' : 'ember-delve';
    // Night and the eclipse pay a little more (td-phases.ts): Hunting XP and the Gold pile, in the open wilds.
    const sky = this.wildRules;
    // The Hush pays too (td-dark.ts): a little more XP the deeper it runs, capped.
    // A worn unique (unique-items.ts xp-echo): more Hunting XP from every kill.
    // The zone's level against the Keeper's (td-zones zoneXp, D2): full XP at his level, less far below it, a little more above.
    const xpK = sky.xp * this.darkBoon.xp * (1 + this.relics.xp / 100) * (this.levelGap ? zoneXp(this.keeperLevel, m.def.level) : 1);
    // XP follows the creature's own authored life: not the tier's multiple of it (the tier pays in drops, its blurb says
    // so), nor td-life's (the life a creature rises with is the fight's), nor a shared boss's party scaling (baseHp).
    this.host.options.onKill?.({ id, areaId, creature: m.def.id, name: m.def.name, hp: Math.round(baseHp / this.tier.hp / lifeScale(m.def.level, m.def.rank) / (m.def.tough ?? 1)), ...(xpK !== 1 ? { xp: xpK } : {}), ...(mode === 'coop' ? { coop: true } : {}), ...(mode === 'share' ? { share: true } : {}), ...(room ? { room } : {}) });
    // A room-run world's kill (protocol 7): the room rolled the loot once, for everyone; nothing is rolled here.
    if (mode === 'share' || !loot) return;
    const firstDrop = this.drops.length;
    // The ground loot: a Gold pile with the creature's materials, and whatever gear the host rolls for the kill.
    // The pile is Diablo II's: it follows the creature's level and rank, ± 40 % (economy-curve HUNT_GOLD).
    const spot = (i: number) => ({ x: m.x + (i % 3 - 1) * 6, y: m.y + Math.floor(i / 3) * 5 });
    let n = 0;
    // A worn unique (unique-items.ts gold-surge): a bigger pile (Gold Find lifts it again at pickup).
    const coins = Math.max(1, Math.round(goldDropFor(m.def) * sky.gold * (1 + this.relics.gold / 100)));
    for (const d of m.def.drops) {
      if (Math.random() >= d.chance) continue;
      this.drops.push({ id: `${id}:m${n}`, ...spot(n++), coins: 0, material: d.material, qty: d.qty, label: d.material.replace(/-/g, ' '), color: RARITY_COLOR.common, age: 0 });
    }
    // Now and then a potion (shared/potions): better ones from stronger creatures, a Rejuvenation rarely from the deep.
    const potion = rollPotionDrop(m.def.level, m.def.rank ?? 'normal', Math.random);
    if (potion) this.drops.push({ id: `${id}:p`, ...spot(n++), coins: 0, material: potion.id, qty: 1, label: potion.name, color: RARITY_COLOR.common, age: 0 });
    // Now and then a Basalt Blank (shared/spellstones): the stone a Spellstone is cut from.
    const blanks = rollBlankDrop(m.def.rank ?? 'normal', Math.random);
    if (blanks) this.drops.push({ id: `${id}:b`, ...spot(n++), coins: 0, material: BLANK_ID, qty: blanks, label: BLANK_NAME, color: RARITY_COLOR.common, age: 0 });
    this.drops.push({ id: `${id}:c`, ...spot(n++), coins, qty: 0, label: `${coins} Gold`, color: '#ffd25a', age: 0 });
    let rows: readonly LootRow[] = [];
    const rank = m.def.rank ?? 'normal';
    const roll = (k: string): readonly LootRow[] => { try { return this.host.options.rollLoot?.({ creature: m.def.id, level: m.def.level, rank, killKey: k, ...(this.darkBoon.mf + this.relics.mf ? { mf: this.darkBoon.mf + this.relics.mf } : {}), ...(this.relics.named ? { named: this.relics.named } : {}) }) ?? []; } catch { return []; } };
    rows = roll(id);
    // Elites (td-elites.ts): their gear never drops common, and a unique leader always leaves a magic-or-better piece.
    if (m.elite) {
      rows = floorEliteRows(rows, rank);
      if (m.elite.rank === 'unique' && m.elite.role === 'leader') { let k = 0; rows = guaranteeMagic(rows, () => roll(`${id}:x${k++}`)); }
    }
    rows.forEach((row, i) => {
      const color = RARITY_COLOR[row.rarity] ?? RARITY_COLOR.common;
      if (row.kind === 'item') this.drops.push({ id: `${id}:g${i}`, ...spot(n++), coins: 0, qty: 0, item: { definitionId: row.definitionId, rarity: row.rarity, unique: !!row.unique, level: row.level ?? m.def.level }, rarity: row.rarity, label: row.label, color, age: 0 });
      else this.drops.push({ id: `${id}:r${i}`, ...spot(n++), coins: 0, qty: 0, rune: row.rune, rarity: row.rarity, label: row.label, color, age: 0 });
    });
    // All of it lies beside the corpse, and the corpse window lists it.
    if (corpseId) for (let i = firstDrop; i < this.drops.length; i++) this.drops[i].corpse = corpseId;
  }

  // ── Shared creatures (protocol 4; td-coop.ts) ──
  /** A creature as the host sent it, not tiered again (its numbers are the host's). */
  replicaMob(key: string, def: MobDef, x: number, y: number): Mob {
    return { key, def, x, y, hx: x, hy: y, hp: def.hp, cursed: 0, burnT: 0, face: 1, t: Math.random() * 3, cd: 1, hit: 0, wander: null, wait: Math.random() * 3, rcd: (def.ranged?.rate ?? 1) * (.5 + Math.random() * .5), summoned: false, tell: 0, aim: null, ...(def.rend ? { rendCd: def.rend.rate * .5 } : {}) };
  }
  /** The host: a member's claim that passed the gate lands through the creature's own path (Stone Skin, its call, its half-life change, its fall). */
  applyClaim(m: Mob, dmg: number, from: string, crit = false, el = ''): number {
    if (!this.mobs.includes(m) || m.hp <= 0) return 0;
    this.claimFrom = from; this.fireBlow = el === 'fire';
    if (this.fireBlow) this.burnHazards(m.x, m.y, 8);
    try { return this.hurtMob(m, Math.max(1, Math.round(dmg)), '#a8e6c4', crit); } finally { this.claimFrom = ''; this.fireBlow = false; }
  }
  /** A member: the host says a creature struck this Keeper. It lands through this Keeper's own defenses, resists and wards. */
  coopBite(dmg: number, type: DamageType, from: Mob | null, burn: boolean, curse: boolean, st?: string): void {
    // A status-only blow (an ability's chill, a shriek) carries one point: it lands as the status alone.
    if (!(st && dmg <= 1)) {
      const life = this.host.lifeBite;
      if (life) {
        // Protocol 10: what the room cut (keeper-life.ts: the gap, then the base guard the screen declared).
        const atk = from?.def.level;
        const raw = atk !== undefined && this.levelGap ? dmg * gapHurt(levelGap(this.keeperLevel, atk)) : dmg;
        life.call(this.host, incomingDamage(raw, type, this.defense, atk ?? this.keeperLevel, this.resists), () => this.biteKeeper(dmg, type, from ?? undefined));
      } else this.biteKeeper(dmg, type, from ?? undefined);
    }
    this.layOn(st, from);
    if (burn || curse) this.shotAffixes({ burn, curse });
  }
  /**
   * A member: the host's creature fell. It leaves the world here (a corpse, its spawn resting), and when this Keeper
   * fought it, its own spoils: full Hunting XP and personal loot (`baseHp`: its own life, before any party scaling).
   */
  coopFell(m: Mob, full: boolean, baseHp: number, loot = true, room = ''): string {
    const i = this.mobs.indexOf(m);
    if (i >= 0) this.mobs.splice(i, 1);
    if (this.target === m) this.target = null;
    this.deadUntil.set(m.key, this.clock + RESPAWN);
    this.fallen.set(m.key, (this.fallen.get(m.key) ?? 0) + 1);
    this.corpses.push({ x: m.x, y: m.y, at: this.clock });
    if (this.corpses.length > 12) this.corpses.shift();
    const corpseId = this.leaveCorpse(m).id;
    if (!full) return corpseId;
    // The Skill Book's marks a fall sets off (Soulfire, Spreading, Hour of Doom…), as for a creature of its own.
    this.markKill(m, m.lastSrc ?? null);
    if (this.rank('soul-harvest') > 0) this.mana = Math.min(this.maxMana, this.mana + this.v('soul-harvest')['mana']);
    if (this.relics.manaKill > 0) this.mana = Math.min(this.maxMana, this.mana + this.relics.manaKill);
    this.spoils(m, 'coop', baseHp, corpseId, loot, room);
    return corpseId;
  }
  /** The host: a boss's life for `present` Keepers of the party here (keeping its wounded share). */
  scaleBoss(m: Mob, max: number, present: number): void {
    if (m.coopN === present && m.def.hp === max) return;
    m.coopBase ??= m.def.hp;
    const old = m.def.hp;
    m.def = { ...m.def, hp: max };
    m.hp = old > 0 ? Math.max(m.hp > 0 ? 1 : 0, Math.min(max, Math.round(m.hp / old * max))) : max;
    m.coopN = present;
  }
  /** The half-life change (MobDef.half), as the host saw it come: a member mirrors it so an adopted boss fights on in kind. */
  halve(m: Mob): void {
    const half = m.def.half;
    if (!half || m.halved) return;
    m.halved = true;
    m.def = {
      ...m.def,
      ...(m.def.ranged ? { ranged: { ...m.def.ranged, spread: half.spread, rate: half.rate } } : {}),
      ...(m.def.rend ? { rend: { ...m.def.rend, rings: half.rings, rate: half.rendRate } } : {}),
    };
  }
  /** Is a spawn resting after a fall (a new host must not raise it again at once)? */
  resting(key: string): boolean { return (this.deadUntil.get(key) ?? 0) > this.clock; }
  /** The spawns resting now, with the seconds each has left (the room-run world keeps them across a sleep). */
  restingList(): [string, number][] {
    const out: [string, number][] = [];
    for (const [k, t] of this.deadUntil) if (t > this.clock) out.push([k, Math.round((t - this.clock) * 10) / 10]);
    return out;
  }
  /** Rest a spawn `secs` more (a woken room-run world: its spawns fallen before the sleep stay down their time). */
  rest(key: string, secs: number): void { if (secs > 0) this.deadUntil.set(key, Math.max(this.deadUntil.get(key) ?? 0, this.clock + secs)); }

  // ── Corpses (td-corpse.ts) ──
  /** Lay the fallen creature where it fell. Every Keeper of a party sees the host's kill, so each lays the same corpse. */
  private leaveCorpse(m: Mob): Corpse {
    const c: Corpse = {
      id: `corpse:${this.remainsSeq++}`, x: m.x, y: m.y,
      kind: { id: m.def.id, name: m.def.name, w: m.def.w, h: m.def.h, ...(m.def.ghost ? { ghost: true } : {}) },
      def: m.def, face: m.face, born: this.clock, boss: m.def.rank === 'boss',
      seed: corpseSeed(`${m.key}:${this.remainsSeq}`),
    };
    layCorpse(this.remains, c);
    return c;
  }
  /** The loot still lying beside a corpse (this Keeper's own: loot is personal). */
  corpseLoot(id: string): Drop[] { return this.drops.filter(d => d.corpse === id); }
  /** The corpse under a point in the world (its flattened body, a little generous for a thumb), nearest first. */
  corpseAt(wx: number, wy: number): Corpse | null {
    let best: Corpse | null = null, bd = Infinity;
    for (const c of this.remains) {
      const hh = Math.max(6, Math.round(c.kind.h * .38)) + 6;
      if (Math.abs(wx - c.x) > c.kind.w / 2 + 6 || wy < c.y - hh - 2 || wy > c.y + 8) continue;
      const d = Math.hypot(wx - c.x, wy - c.y + hh / 2);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  /** The nearest corpse within the Keeper's reach that still has loot in it (E opens it). */
  corpseNear(x: number, y: number, reach = CORPSE_REACH): Corpse | null {
    let best: Corpse | null = null, bd = reach;
    for (const c of this.remains) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= bd && this.drops.some(g => g.corpse === c.id)) { bd = d; best = c; }
    }
    return best;
  }
  /** Take one piece of a corpse's loot into the satchel; false when the satchel is full (it stays). */
  takeDrop(dropId: string): boolean {
    const i = this.drops.findIndex(g => g.id === dropId);
    if (i < 0) return false;
    const before = this.drops.length;
    this.pick(this.drops[i], i);
    return this.drops.length < before;
  }

  private pick(g: Drop, i: number): void {
    if (g.room) {
      // The room's ground (protocol 7): it leaves this screen at once (optimistic), the room is asked, and the HUD
      // grants it when the room says yes — or puts it back (restoreRoomDrop) when someone else was first.
      if (g.room.hold > 0 || g.room.wait > 0 || !this.host.options.onRoomTake) return;
      this.drops.splice(i, 1);
      this.float(g.x, g.y - 10, g.coins > 0 ? `+${g.coins} Gold` : g.label, g.color);
      this.host.options.onRoomTake(g);
      return;
    }
    const ok = this.host.options.onLoot?.({
      id: g.id, coins: g.coins, ore: g.material ? g.qty : 0, ...(g.material ? { material: g.material } : {}),
      ...(g.item ? { item: g.item } : {}), ...(g.rune ? { rune: g.rune } : {}),
    });
    if (ok === false) return;   // the satchel is full: it stays on the ground
    this.drops.splice(i, 1);
    // Gold says what it added to the purse ("+38 Gold"); everything else says its name.
    this.float(g.x, g.y - 10, g.coins > 0 ? `+${g.coins} Gold` : g.label, g.color);
  }
}

/**
 * The bestiary's brushes and outline, for the companions' own sprites (td-pet-art.ts): the pets are painted to the
 * same standard as the creatures, with the same light and the same selective outline.
 */
export const TD_BRUSH = { px, dot, orb, poly, limb, line, glow, outline, grown } as const;
export type TdRamp = Ramp;
