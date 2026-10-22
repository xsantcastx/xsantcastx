/**
 * worn-looks.ts — every worn item → its WornLook (worn-look.model.ts), and the short ids other players receive.
 *
 * Where a look comes from, first match wins:
 *   1. `registerWornLook(id, spec)` — a look set at run time (tests; a future content pack);
 *   2. the unique's own entry (unique-items.ts `look`) — THE way to give a NEW unique its look: write it beside its lore;
 *   3. the table (worn-looks.data.ts) — every unique, boss unique and set piece that shipped before that field;
 *   4. derived — an ordinary item: its silhouette from its base type and name (a cowl, a horned helm, mail…), its tones
 *      from its own icon's materials (art/item-icons.ts, so the worn piece matches the icon), a trim in its rarity's tone
 *      from rare up and a faint glow edge from legendary up.
 *
 * A look's id is what travels in presence (`worn`, social-server.mjs): an authored look's id is the item's definition id,
 * a derived one's the definition id and the rarity (`eclipse-longblade.4`). Any client rebuilds the same look from it;
 * an id it does not know (a newer client's new unique) is skipped and that slot shows the class kit.
 *
 * Pure: no DOM. Safe on an SSR path and in specs.
 */
import { ITEM_ICONS, RAMPS, type Material } from '../art/item-icons';
import { gearLookOf } from '../rpg/item-base';
import { definitionFor } from '../rpg/item-definition';
import { handsOf } from '../rpg/item-hands';
import { uniqueById } from '../rpg/unique-items';
import {
  GEAR_RARITIES, GEAR_SLOTS, RARITY_TRIM, STYLE_COLORS, coerceRarity, coerceStyle, gearKindOf,
  type GearKind, type GearPiece, type GearRarity, type GearSlot, type KeeperGear,
} from './keeper-gear';
import {
  CHEST_SHAPES, HEAD_SHAPES, HELD_SHAPES, glowing, trimmed,
  type Tone, type WornLook, type WornLookSpec, type WornShape,
} from './worn-look.model';
import { WORN_LOOK_TABLE } from './worn-looks.data';

// ── Colour ──
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  const c = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
const isHex = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);
const isRamp = (s: string): s is Material => Object.prototype.hasOwnProperty.call(RAMPS, s);
/** A tone: a hex as is, a ramp name at `step` (0 deep … 4 highlight). */
function tone(t: Tone | undefined, step: number): string | undefined {
  if (!t) return undefined;
  if (isHex(t)) return t.toLowerCase();
  return isRamp(t) ? RAMPS[t][step].toLowerCase() : undefined;
}
/** An accent's step: the lit one, except where a ramp's real colour is its highlight (the void's pink). */
const accentStep = (m: string): number => (m === 'void' ? 4 : 3);

// ── Shapes ──
const SLOT_SHAPES: Readonly<Record<GearSlot, readonly WornShape[]>> = {
  head: HEAD_SHAPES,
  chest: CHEST_SHAPES,
  hands: ['gloves', 'gauntlets'],
  legs: ['greaves', 'belt'],
  feet: ['boots', 'greaves', 'sandals'],
  weapon: [...HELD_SHAPES, 'pickaxe', 'sickle', 'tongs'] as WornShape[],
  'off-hand': [...HELD_SHAPES, 'pickaxe', 'sickle', 'tongs'] as WornShape[],
  trinket: ['pendant', 'ring'],
  charm1: ['charm'], charm2: ['charm'], charm3: ['charm'],
};
/** Does `shape` belong in `slot`? */
export function shapeFits(slot: GearSlot, shape: string): boolean {
  return (SLOT_SHAPES[slot] as readonly string[]).includes(shape);
}

/** The painter's coarse kind for a shape (what covers the hair, what hangs behind, what the sleeves are). */
export function kindOfShape(slot: GearSlot, shape: WornShape): GearKind {
  switch (shape) {
    case 'hood': case 'cowl': return 'hood';
    case 'horned': case 'open-helm': case 'great-helm': return 'helm';
    case 'crown': return 'crown';
    case 'circlet': case 'mask': return 'circlet';
    case 'robe': return 'robe';
    case 'cloak': return 'mantle';
    case 'plate': case 'scale': return 'plate';
    case 'leather': return 'coat';
    case 'gloves': return 'wrap';
    case 'gauntlets': return 'gauntlet';
    case 'belt': return 'belt';
    case 'greaves': return slot === 'feet' ? 'boots' : 'greaves';
    case 'boots': case 'sandals': return 'boots';
    case 'pendant': case 'ring': return 'pendant';
    case 'charm': return 'charm';
    default: return shape as GearKind;
  }
}

/** An ordinary item's silhouette, from its base type (item-base.ts) and its name's words. */
function deriveShape(slot: GearSlot, base: string | null, name: string): WornShape {
  const w = name.toLowerCase();
  switch (slot) {
    case 'head':
      if (base === 'crown' || /crown|diadem/.test(w)) return 'crown';
      if (base === 'circlet' || /circlet|oath|band|halo/.test(w)) return 'circlet';
      if (/mask|visage/.test(w)) return 'mask';
      if (/cowl/.test(w)) return 'cowl';
      if (base === 'hood' || /hood|veil/.test(w)) return 'hood';
      if (/horn|antler/.test(w)) return 'horned';
      if (/great ?helm|visor|bucket|bascinet|closed/.test(w)) return 'great-helm';
      return 'open-helm';
    case 'chest':
      if (/mail|hauberk|scale|chain|brigandine/.test(w)) return 'scale';
      if (/mantle|cloak|cape|shroud/.test(w)) return 'cloak';
      if (base === 'robe' || /robe|vestment|habit/.test(w)) return 'robe';
      if (base === 'coat' || /coat|hide|jerkin|tunic|leather|wrap/.test(w)) return 'leather';
      return 'plate';
    case 'hands': return /glove|wrap|mitt|grip|bracer|hand/.test(w) && !/gauntlet/.test(w) ? 'gloves' : 'gauntlets';
    case 'legs': return base === 'belt' || /belt|sash|girdle/.test(w) ? 'belt' : 'greaves';
    case 'feet': return /sandal/.test(w) ? 'sandals' : /sabaton|greave|plate|iron/.test(w) ? 'greaves' : 'boots';
    case 'trinket': return /ring|band|signet/.test(w) ? 'ring' : 'pendant';
    case 'charm1': case 'charm2': case 'charm3': return 'charm';
    default: {
      const kind = gearKindOf(slot, name) as string;
      return shapeFits(slot, kind) ? kind as WornShape : slot === 'weapon' ? 'sword' : 'orb';
    }
  }
}

// ── Registry ──
const EXTRA = new Map<string, WornLookSpec>();
/**
 * Give an item a worn look at run time (wins over everything). For a new unique, prefer its own `look` field in
 * unique-items.ts; this is for looks that are not part of the item data (a test, a content pack).
 */
export function registerWornLook(definitionId: string, spec: WornLookSpec): void {
  EXTRA.set(definitionId, spec);
  CACHE.clear();
}

/** Take back a run-time look (tests). */
export function forgetWornLook(definitionId: string): void {
  EXTRA.delete(definitionId);
  CACHE.clear();
}

/** The authored look for an item definition id, if it has one (registry, the unique's own field, the table). */
export function authoredLook(definitionId: string): WornLookSpec | undefined {
  return EXTRA.get(definitionId) ?? uniqueById(definitionId)?.look ?? WORN_LOOK_TABLE[definitionId];
}

const CACHE = new Map<string, WornLook | null>();

/** An item as the look reads it. */
export interface LookItem { definitionId?: string; name?: string; rarity?: string; type?: string }

/** The look an item has worn in `slot` (null: no definition behind it, so the generic layer stays). */
export function wornLookOf(item: LookItem, slot: GearSlot): WornLook | null {
  const id = item.definitionId;
  if (!id) return null;
  const authored = authoredLook(id);
  const rarity = coerceRarity(item.rarity ?? (authored ? uniqueById(id)?.rarity : undefined));
  return lookFor(id, slot, authored ? null : rarity);
}

/**
 * The look behind a look id (`definitionId`, or `definitionId.<rarity index>` for a derived look) in `slot`; null when
 * this client does not know it.
 */
export function lookById(lookId: string, slot: GearSlot): WornLook | null {
  const m = /^(.+)\.(\d)$/.exec(lookId);
  if (m) {
    const r = Number(m[2]);
    return r < GEAR_RARITIES.length && !authoredLook(m[1]) ? lookFor(m[1], slot, GEAR_RARITIES[r]) : null;
  }
  return authoredLook(lookId) ? lookFor(lookId, slot, null) : null;
}

/** `rarity` null: the authored look (its rarity is the unique's own); else the look derived at that rarity. */
function lookFor(defId: string, slot: GearSlot, rarity: GearRarity | null): WornLook | null {
  const key = `${slot}|${defId}|${rarity ?? '*'}`;
  if (CACHE.has(key)) return CACHE.get(key)!;
  const look = build(defId, slot, rarity);
  CACHE.set(key, look);
  return look;
}

function build(defId: string, slot: GearSlot, derivedRarity: GearRarity | null): WornLook | null {
  const def = definitionFor({ definitionId: defId, name: '', type: 'artifact' });
  const unique = uniqueById(defId);
  const spec = derivedRarity ? undefined : authoredLook(defId);
  if (!def && !unique && !spec) return null;
  const name = def?.name ?? unique?.name ?? defId;
  const style = coerceStyle(def?.style ?? unique?.style);
  const rarity = derivedRarity ?? coerceRarity(unique?.rarity ?? 'legendary');
  const icon = ITEM_ICONS[defId];
  const gear = gearLookOf({ definitionId: defId, name, type: def?.type ?? 'artifact', rarity });
  const shape: WornShape = spec && shapeFits(slot, spec.shape) ? spec.shape : deriveShape(slot, gear?.base ?? null, `${name} ${defId}`);

  // Tones: the authored palette, else the icon's own materials, else the realm's two colours.
  const [styleBase, styleAccent] = STYLE_COLORS[style];
  const mat = icon && isRamp(icon.mat) ? icon.mat : null;
  let deep: string, base: string, lit: string;
  const pal = spec?.pal;
  if (Array.isArray(pal) && pal.length === 3 && pal.every(isHex)) [deep, base, lit] = pal.map(h => h.toLowerCase()) as [string, string, string];
  else if (typeof pal === 'string' && isRamp(pal)) [deep, base, lit] = [RAMPS[pal][1], RAMPS[pal][2], RAMPS[pal][3]];
  else if (mat) [deep, base, lit] = [RAMPS[mat][1], RAMPS[mat][2], RAMPS[mat][3]];
  else [deep, base, lit] = [mix(styleBase, '#120a18', .32), styleBase, mix(styleBase, '#ffffff', .3)];
  const acc = icon?.acc && isRamp(icon.acc) ? icon.acc : null;
  const accent = tone(spec?.accent, spec?.accent && isRamp(spec.accent) ? accentStep(spec.accent) : 3)
    ?? (acc ? RAMPS[acc][accentStep(acc)] : styleAccent);
  const subMat = icon?.sub && isRamp(icon.sub) ? icon.sub : null;
  const sub = tone(spec?.sub, 2) ?? (subMat ? RAMPS[subMat][2] : slot === 'weapon' || slot === 'off-hand' ? RAMPS.wood[2] : deep);
  const trim = tone(spec?.trim, 3) ?? (trimmed(rarity) ? RARITY_TRIM[rarity] : null);
  const glow = glowing(rarity) ? mix(RARITY_TRIM[rarity], '#ffffff', .35) : null;

  const look: WornLook = {
    id: derivedRarity ? `${defId}.${GEAR_RARITIES.indexOf(derivedRarity)}` : defId,
    slot, shape, style, rarity,
    deep: deep.toLowerCase(), base: base.toLowerCase(), lit: lit.toLowerCase(), accent: accent.toLowerCase(), sub: sub.toLowerCase(), trim, glow,
  };
  if (spec) {
    const d = (t: Tone | undefined) => tone(t, 3);
    if (d(spec.eyes)) look.eyes = d(spec.eyes);
    if (spec.shadow) look.shadow = true;
    if (d(spec.runes)) look.runes = d(spec.runes);
    if (d(spec.horns)) look.horns = d(spec.horns);
    if (d(spec.mantle)) look.mantle = d(spec.mantle);
    if (d(spec.seam)) look.seam = d(spec.seam);
    if (spec.fx && d(spec.fx.color)) look.fx = { kind: spec.fx.kind, color: d(spec.fx.color)! };
  } else if (shape === 'horned') look.horns = mix(lit, '#e8e1cf', .5);
  if (slot === 'weapon') {
    const hands = handsOf({ definitionId: defId, name, type: def?.type ?? 'artifact' });
    if (hands) look.hands = hands;
  }
  return look;
}

/** A look as the painter's worn piece. */
export function pieceOfLook(look: WornLook): GearPiece {
  const piece: GearPiece = { slot: look.slot, kind: kindOfShape(look.slot, look.shape), style: look.style, rarity: look.rarity, look };
  if (look.slot === 'weapon' && look.hands) piece.hands = look.hands;
  return piece;
}

// ── Presence: the worn looks in a short string (social-server.mjs `worn`) ──

/** One character per slot. */
const SLOT_CODE: Readonly<Record<GearSlot, string>> = {
  head: 'h', chest: 'c', hands: 'g', legs: 'l', feet: 'f', weapon: 'w', 'off-hand': 'o', trinket: 't', charm1: '1', charm2: '2', charm3: '3',
};
const CODE_SLOT = new Map<string, GearSlot>(Object.entries(SLOT_CODE).map(([s, c]) => [c, s as GearSlot]));
/** The order slots are packed in: what reads furthest first, so a long string loses only charms. */
const PACK_ORDER: readonly GearSlot[] = ['head', 'chest', 'weapon', 'off-hand', 'hands', 'feet', 'legs', 'trinket', 'charm1', 'charm2', 'charm3'];
/** The room's limit on `worn` (scripts/social-server.mjs WORN). */
export const WORN_MAX = 240;
export const WORN_RE = /^[a-z0-9.,-]{0,240}$/;

const wire = (id: string): string => (id.startsWith('unique-') ? `u.${id.slice(7)}` : id);
const unwire = (s: string): string => (s.startsWith('u.') ? `unique-${s.slice(2)}` : s);

/** The worn looks of a gear set as `h<id>,c<id>,…` (only plain lowercase ids; whole entries dropped past WORN_MAX). */
export function packWorn(gear: KeeperGear | null | undefined): string {
  if (!gear) return '';
  let out = '';
  for (const slot of PACK_ORDER) {
    const id = gear[slot]?.look?.id;
    if (!id || !/^[a-z0-9.-]{1,64}$/.test(id)) continue;
    const entry = `${SLOT_CODE[slot]}${wire(id)}`;
    const next = out ? `${out},${entry}` : entry;
    if (next.length > WORN_MAX) continue;
    out = next;
  }
  return out;
}

/** A packed `worn` back to gear (only the looks this client knows); null when there is nothing. */
export function unpackWorn(packed: unknown): KeeperGear | null {
  if (typeof packed !== 'string' || !packed || !WORN_RE.test(packed)) return null;
  const gear: KeeperGear = {};
  for (const entry of packed.split(',')) {
    const slot = CODE_SLOT.get(entry.charAt(0));
    if (!slot || gear[slot]) continue;
    const look = lookById(unwire(entry.slice(1)), slot);
    if (look) gear[slot] = pieceOfLook(look);
  }
  return GEAR_SLOTS.some(s => gear[s]) ? gear : null;
}
