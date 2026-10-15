/**
 * keeper-gear.ts — worn gear as layers on the pixel Keeper: what each item reads
 * as on the body, and where a held weapon sits in the hand.
 *
 * Owner, 2026-10-14: "i equip items everything seems the same, i equip weapon
 * they are really bad equipped". Every worn slot is a layer the painter draws
 * (keeper-paint.ts): a helm over the hair, a coat over the tunic, a cloak behind
 * the body, boots, gauntlets, a pendant, charm beads. The weapon is a pixel sprite
 * of its KIND (sword, axe, pickaxe, staff, bow…), coloured by the item's realm
 * style and lit by its rarity, held at the kind's grip point and swung along the
 * kind's own arc.
 *
 * The kind comes from the item's name/definition id (the Art Bible names say what
 * a thing is: "Nullthorn Staff", "Starfall Maul", "Meridian Longbow"). There is no
 * per-item art for bodies, so the layers are generated; a commissioned layer can
 * later replace a kind without touching the rules here.
 *
 * Pure: types, tables and math only. No DOM, safe on an SSR path and in specs.
 */

export type GearSlot = 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'weapon' | 'off-hand' | 'trinket' | 'charm1' | 'charm2' | 'charm3';
export const GEAR_SLOTS: readonly GearSlot[] = ['head', 'chest', 'hands', 'legs', 'feet', 'weapon', 'off-hand', 'trinket', 'charm1', 'charm2', 'charm3'];

export type WeaponKind =
  | 'sword' | 'greatsword' | 'dagger' | 'axe' | 'pickaxe' | 'hammer' | 'mace'
  | 'staff' | 'wand' | 'bow' | 'crossbow' | 'spear' | 'halberd' | 'sickle' | 'tongs'
  /** A fishing rod: never read from an item name (a "Rod" weapon is a staff), only put in hand by held-tool.ts. */
  | 'rod';
export type OffhandKind = 'shield' | 'tome' | 'orb' | 'lantern' | 'scroll' | 'cards' | 'scales' | WeaponKind;
export type HeadKind = 'helm' | 'hood' | 'crown' | 'circlet';
export type ChestKind = 'plate' | 'coat' | 'robe' | 'mantle';
export type HandsKind = 'gauntlet' | 'wrap';
export type LegsKind = 'greaves' | 'belt';
export type FeetKind = 'boots';
export type GearKind = WeaponKind | OffhandKind | HeadKind | ChestKind | HandsKind | LegsKind | FeetKind | 'pendant' | 'charm';

export type GearStyle = 'neutral' | 'infernal' | 'celestial' | 'luminous' | 'umbral' | 'verdant' | 'void' | 'void-touched';
export type GearRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'singular';
export const GEAR_RARITIES: readonly GearRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

/** One worn piece, as the painter sees it. */
export interface GearPiece {
  slot: GearSlot;
  kind: GearKind;
  style: GearStyle;
  rarity: GearRarity;
  /**
   * A fixed cloth/metal colour instead of the realm style's (town NPCs wear
   * their own coats: npc-looks.ts). Always a hex from the realm ramps in
   * docs/art/style-guide.md §5. Players' worn items never set it.
   */
  color?: string;
  accent?: string;
}
export type KeeperGear = Partial<Record<GearSlot, GearPiece>>;

/** Realm style → [base metal/cloth, accent]. The accent is the realm's own light. */
export const STYLE_COLORS: Readonly<Record<GearStyle, readonly [string, string]>> = {
  neutral: ['#9aa3ad', '#6e5236'],
  infernal: ['#4a332c', '#ff7a2e'],
  celestial: ['#9fb8e8', '#e8f0ff'],
  luminous: ['#e0bc52', '#fff4cf'],
  umbral: ['#3b2b52', '#9a6bff'],
  verdant: ['#6b4a2b', '#5fae5a'],
  void: ['#2a1f45', '#4fe0d0'],
  'void-touched': ['#3a2f55', '#4fe0d0'],
};
/** The item tier ladder's colours (same as the loot beams, rune tiers). */
export const RARITY_TRIM: Readonly<Record<GearRarity, string>> = {
  common: '#8f8aa1', uncommon: '#9db8a8', rare: '#00d4ff', epic: '#a855f7', legendary: '#e8c898', mythic: '#f8e8c8', singular: '#ff6dd7',
};

const WEAPON_WORDS: readonly [RegExp, WeaponKind][] = [
  [/pick/, 'pickaxe'],
  [/crossbow/, 'crossbow'],
  [/bow\b|longbow|bow$/, 'bow'],
  [/halberd|glaive|scythe/, 'halberd'],
  [/spear|lance|pike|trident/, 'spear'],
  [/staff|stave|rod\b/, 'staff'],
  [/wand|sceptre|scepter/, 'wand'],
  [/maul|hammer|anvil/, 'hammer'],
  [/mace|club|morningstar|flail/, 'mace'],
  [/axe|hatchet|cleaver/, 'axe'],
  [/sickle/, 'sickle'],
  [/tongs/, 'tongs'],
  [/kris|dagger|knife|knives|fang|dirk|stiletto/, 'dagger'],
  [/greatsword|render|worldsplitter|requiem|claymore/, 'greatsword'],
];
const OFFHAND_WORDS: readonly [RegExp, OffhandKind][] = [
  [/shield|aegis|ward\b|lastwarden|bulwark|buckler/, 'shield'],
  [/ledger|codex|tome|book|primer|grimoire/, 'tome'],
  [/mirror|orb|lens|sphere|eye\b/, 'orb'],
  [/lantern|lamp/, 'lantern'],
  [/scroll|case|loom|map/, 'scroll'],
];

function words(text: string): string {
  return text.toLowerCase().replace(/[^a-z]+/g, ' ');
}

export function weaponKindOf(text: string): WeaponKind {
  const w = words(text);
  for (const [re, kind] of WEAPON_WORDS) if (re.test(w)) return kind;
  return 'sword';
}

/**
 * What a worn item reads as on the body. `text` is its name plus definition id
 * (both say what it is). Off-hand tools (pickaxe, axe, sickle, staff) are held.
 */
export function gearKindOf(slot: GearSlot, text: string): GearKind {
  const w = words(text);
  switch (slot) {
    case 'weapon': return weaponKindOf(text);
    case 'off-hand': {
      for (const [re, kind] of OFFHAND_WORDS) if (re.test(w)) return kind;
      for (const [re, kind] of WEAPON_WORDS) if (re.test(w)) return kind;
      return 'orb';
    }
    case 'head':
      if (/crown|diadem/.test(w)) return 'crown';
      if (/circlet|oath|band|halo/.test(w)) return 'circlet';
      if (/cowl|hood|veil|mask/.test(w)) return 'hood';
      return 'helm';
    case 'chest':
      if (/pauldron|cuirass|plate|breastplate/.test(w)) return 'plate';
      if (/mantle|cloak|cape|wrap|embrace/.test(w)) return 'mantle';
      if (/robe|vestment|habit/.test(w)) return 'robe';
      if (/coat|hide|jerkin|tunic|hauberk/.test(w)) return 'coat';
      return 'plate';
    case 'hands': return /wrap|glove|mitt/.test(w) ? 'wrap' : 'gauntlet';
    case 'legs': return /belt|sash|girdle/.test(w) ? 'belt' : 'greaves';
    case 'feet': return 'boots';
    case 'trinket': return 'pendant';
    default: return 'charm';
  }
}

export function coerceStyle(style: unknown): GearStyle {
  return typeof style === 'string' && style in STYLE_COLORS ? style as GearStyle : 'neutral';
}
export function coerceRarity(rarity: unknown): GearRarity {
  return typeof rarity === 'string' && (GEAR_RARITIES as readonly string[]).includes(rarity) ? rarity as GearRarity : 'common';
}

export function gearPiece(slot: GearSlot, text: string, style: unknown, rarity: unknown): GearPiece {
  return { slot, kind: gearKindOf(slot, text), style: coerceStyle(style), rarity: coerceRarity(rarity) };
}

/** A stable key for a gear set (the painter rebuilds its layers when it changes). */
export function gearKey(gear: KeeperGear | null | undefined): string {
  if (!gear) return '';
  return GEAR_SLOTS.map(slot => { const p = gear[slot]; return p ? `${slot}:${p.kind}:${p.style}:${p.rarity}${p.color ? `:${p.color}${p.accent ?? ''}` : ''}` : ''; }).filter(Boolean).join('|');
}

// ── Held weapons: sprite size, grip and swing ──────────────────────────────

export type SwingStyle = 'slash' | 'thrust' | 'draw' | 'cast';

/**
 * A weapon sprite is painted pointing UP (tip at the top, row 0). `w`×`h` in
 * pixels; the hand closes at (`gx`, `gy`). `idle` is the canvas angle of the
 * tip at rest (0 = forward, -PI/2 = straight up), `idleArm` the arm's.
 */
export interface WeaponSpec {
  w: number; h: number; gx: number; gy: number;
  idle: number; idleArm: number; swing: SwingStyle;
}
export const WEAPON_SPECS: Readonly<Record<WeaponKind, WeaponSpec>> = {
  sword: { w: 7, h: 19, gx: 3, gy: 16, idle: -1.05, idleArm: 1.15, swing: 'slash' },
  greatsword: { w: 9, h: 24, gx: 4, gy: 20, idle: -1.2, idleArm: 1.05, swing: 'slash' },
  dagger: { w: 5, h: 10, gx: 2, gy: 8, idle: -.55, idleArm: 1.2, swing: 'thrust' },
  axe: { w: 8, h: 18, gx: 2, gy: 15, idle: -1.15, idleArm: 1.15, swing: 'slash' },
  pickaxe: { w: 13, h: 17, gx: 6, gy: 14, idle: -1.15, idleArm: 1.15, swing: 'slash' },
  hammer: { w: 9, h: 18, gx: 4, gy: 15, idle: -1.2, idleArm: 1.1, swing: 'slash' },
  mace: { w: 7, h: 15, gx: 3, gy: 13, idle: -1.1, idleArm: 1.15, swing: 'slash' },
  staff: { w: 6, h: 27, gx: 2, gy: 17, idle: -1.5, idleArm: .85, swing: 'cast' },
  wand: { w: 5, h: 12, gx: 2, gy: 10, idle: -.9, idleArm: .9, swing: 'cast' },
  bow: { w: 7, h: 21, gx: 2, gy: 10, idle: -1.57, idleArm: .55, swing: 'draw' },
  crossbow: { w: 13, h: 14, gx: 6, gy: 11, idle: -.35, idleArm: .45, swing: 'draw' },
  spear: { w: 5, h: 29, gx: 2, gy: 19, idle: -1.35, idleArm: .9, swing: 'thrust' },
  halberd: { w: 9, h: 29, gx: 4, gy: 19, idle: -1.35, idleArm: .9, swing: 'slash' },
  sickle: { w: 8, h: 13, gx: 1, gy: 11, idle: -.9, idleArm: 1.15, swing: 'slash' },
  tongs: { w: 6, h: 15, gx: 2, gy: 13, idle: -.8, idleArm: 1.15, swing: 'slash' },
  // Held out over the water, tip forward and up, so the line falls from it.
  rod: { w: 5, h: 28, gx: 1, gy: 23, idle: -.62, idleArm: .75, swing: 'cast' },
};

/** How far the hand sits from the shoulder (pixels). */
export const ARM_LENGTH = 6;
/** The arm's angle with no weapon in hand (hanging, a touch forward). */
export const EMPTY_ARM = 1.45;

/** `walk` and `talk` are the town folk's (npc-looks.ts); the engine's own Keeper never shows them. */
export type KeeperAction = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'hurt' | 'dodge' | 'rest' | 'death' | 'walk' | 'talk';
export function keeperAction(shown: string | undefined, fallen = false): KeeperAction {
  if (fallen) return 'death';
  switch (shown) {
    case 'run': case 'jump': case 'fall': case 'attack': case 'hurt': case 'dodge': case 'rest': return shown;
    default: return 'idle';
  }
}

const ease = (u: number): number => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export interface HoldPose {
  /** Canvas angle of the arm, shoulder → hand. */
  arm: number;
  /** Canvas angle of the weapon, grip → tip. */
  weapon: number;
}

/**
 * The front arm and the weapon for this moment. `phase` is the run cycle in
 * radians, `attackT` the 0..1 progress through the attack window (wind-up to
 * 0.3, strike after: the same split the engine's hit timing uses).
 */
export function holdPose(kind: WeaponKind | null, action: KeeperAction, phase: number, attackT: number, out: HoldPose): HoldPose {
  const spec = kind ? WEAPON_SPECS[kind] : null;
  const idleArm = spec ? spec.idleArm : EMPTY_ARM;
  const idle = spec ? spec.idle : EMPTY_ARM;
  switch (action) {
    case 'run': {
      const s = Math.sin(phase);
      out.arm = idleArm + .4 * s; out.weapon = idle + .25 * s; break;
    }
    case 'walk': {
      const s = Math.sin(phase);
      out.arm = idleArm + .22 * s; out.weapon = idle + .12 * s; break;
    }
    case 'talk': {
      // A speaking hand: raised a little and turning with the words (`phase` is time).
      const s = Math.sin(phase);
      out.arm = idleArm - .55 + .22 * s; out.weapon = idle - .2 + .1 * s; break;
    }
    case 'jump': out.arm = idleArm - 1.1; out.weapon = idle - .3; break;
    case 'fall': out.arm = idleArm - 1.6; out.weapon = idle - .45; break;
    case 'hurt': out.arm = 2.35; out.weapon = idle + .9; break;
    case 'dodge': out.arm = 2.0; out.weapon = idle + .7; break;
    case 'death': out.arm = 1.57; out.weapon = 1.57; break;
    case 'attack': attackPose(spec, idleArm, idle, attackT, out); break;
    default: out.arm = idleArm; out.weapon = idle;
  }
  if (!spec) out.weapon = out.arm;
  return out;
}

function attackPose(spec: WeaponSpec | null, idleArm: number, idle: number, t: number, out: HoldPose): void {
  const wind = t < .3, u = wind ? ease(t / .3) : ease(Math.min(1, (t - .3) / .55));
  switch (spec?.swing ?? 'slash') {
    case 'thrust':
      if (wind) { out.arm = lerp(idleArm, 2.3, u); out.weapon = lerp(idle, -.15, u); }
      else { out.arm = lerp(2.3, .05, u); out.weapon = lerp(-.15, 0, u); }
      return;
    case 'draw':
      if (wind) { out.arm = lerp(idleArm, .05, u); out.weapon = lerp(idle, spec!.idle === -1.57 ? -1.57 : -.05, u); }
      else { const kick = Math.sin(u * Math.PI) * .18; out.arm = .05 - kick; out.weapon = (spec!.idle === -1.57 ? -1.57 : -.05) - kick; }
      return;
    case 'cast':
      if (wind) { out.arm = lerp(idleArm, -1.9, u); out.weapon = lerp(idle, -2.1, u); }
      else { out.arm = lerp(-1.9, .15, u); out.weapon = lerp(-2.1, -.7, u); }
      return;
    default:
      // Over the top: up and back on the wind-up, then down through the front.
      if (wind) { out.arm = lerp(idleArm, -2.05, u); out.weapon = lerp(idle, -2.6, u); }
      else { out.arm = lerp(-2.05, 1.3, u); out.weapon = lerp(-2.6, 1.25, u); }
  }
}

/** Where the hand is: `ARM_LENGTH` along the arm from the shoulder. */
export function handAt(shoulderX: number, shoulderY: number, arm: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = shoulderX + Math.cos(arm) * ARM_LENGTH;
  out.y = shoulderY + Math.sin(arm) * ARM_LENGTH;
  return out;
}

export interface GripTransform {
  /** Translate to (x, y), rotate by `rotation`, then draw the sprite at (drawX, drawY). */
  x: number; y: number; rotation: number; drawX: number; drawY: number;
}
/**
 * Put a weapon's grip on the hand (handX, handY) with its tip along `angle`.
 * The sprite points up, so the turn is angle + PI/2. Pure.
 */
export function gripTransform(handX: number, handY: number, angle: number, spec: Pick<WeaponSpec, 'gx' | 'gy'>, out: GripTransform): GripTransform {
  out.x = handX; out.y = handY;
  out.rotation = angle + Math.PI / 2;
  out.drawX = -spec.gx - .5; out.drawY = -spec.gy - .5;
  return out;
}
/** Where sprite pixel (u, v) (its centre) lands under a GripTransform. For tests and tip effects. */
export function gripPoint(t: GripTransform, u: number, v: number, out: { x: number; y: number }): { x: number; y: number } {
  const lx = t.drawX + u + .5, ly = t.drawY + v + .5;
  const cos = Math.cos(t.rotation), sin = Math.sin(t.rotation);
  out.x = t.x + cos * lx - sin * ly;
  out.y = t.y + sin * lx + cos * ly;
  return out;
}
