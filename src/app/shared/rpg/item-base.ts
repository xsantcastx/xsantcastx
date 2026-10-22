/**
 * item-base.ts — what a piece of gear *is*: a staff, a dagger, a helm, a ring… (its base type).
 *
 * Read by two things that must agree: the gear icon painter (art/gear-icons.ts: one painter per base) and the
 * requirements (item-requirements.ts: heavy plate asks for Vitality, a staff for Spirit). The base comes from the
 * item's own entry in the pixel icon table (item-icons.ts ITEM_ICONS: the kind it was drawn as), else its slot.
 *
 * Kinds with no painter of their own (tongs, an anvil fragment, an hourglass, a compass, a lens…) return null:
 * those uniques and charms keep their hand-set 16-px icon, which says what they are better than a generic shape.
 */
import { ITEM_ICONS } from '../art/item-icons';
import type { GearBase, GearLook } from '../art/gear-icons';
import { definitionFor, type ItemDefinition } from './item-definition';
import { ALL_CHARMS, type GameItem } from './item.model';
import { DEFAULT_FAMILY, affixFamilyOf, isAffixSlot, type AffixFamily } from './item-affixes';

/** The 16-px icon kinds that have a 32-px painter, and which. */
const KIND_BASE: Readonly<Record<string, GearBase>> = {
  sword: 'sword', dagger: 'dagger', knives: 'dagger', staff: 'staff', wand: 'wand', shuttle: 'wand', polearm: 'spear',
  maul: 'hammer', hammer: 'hammer', mace: 'mace', bow: 'bow', crossbow: 'crossbow', axe: 'axe', pickaxe: 'pickaxe',
  sickle: 'sickle', helm: 'helm', hood: 'hood', crown: 'crown', cuirass: 'plate', robe: 'robe', mantle: 'coat',
  greaves: 'legs', belt: 'belt', boots: 'boots', gauntlet: 'gloves', bracer: 'gloves', shield: 'shield',
  buckler: 'shield', book: 'tome', ring: 'ring', pendant: 'amulet', coin: 'trinket',
};

/** A piece's base when its icon kind says nothing (a definition with no icon entry yet). */
const SLOT_BASE: Readonly<Record<string, GearBase>> = {
  weapon: 'sword', head: 'helm', chest: 'plate', hands: 'gloves', legs: 'legs', feet: 'boots',
  'off-hand': 'shield', trinket: 'amulet', charm1: 'charm', charm2: 'charm', charm3: 'charm',
};

type ItemRef = Partial<Pick<GameItem, 'id' | 'name' | 'type' | 'definitionId' | 'rarity'>>;

/** A minted charm carries its seed id as a prefix (`${seed.id}-${time}-${n}`); a ledger row may only carry its name. */
function charmSeedOf(item: ItemRef): { id: string } | undefined {
  for (const key of [item.definitionId, item.id]) {
    if (!key) continue;
    const seed = ALL_CHARMS.find(c => key === c.id || key.startsWith(`${c.id}-`));
    if (seed) return seed;
  }
  return item.name ? ALL_CHARMS.find(c => c.name === item.name) : undefined;
}

/** The authored definition behind an item (by definition id, by name, or its own id when it is a definition). */
export function itemDefinitionOf(item: ItemRef): ItemDefinition | undefined {
  const name = item.name ?? '', type = item.type ?? 'artifact';
  return (item.definitionId ? definitionFor({ definitionId: item.definitionId, name, type }) : undefined)
    ?? (name ? definitionFor({ name, type }) : undefined)
    ?? (item.id ? definitionFor({ definitionId: item.id, name: '', type }) : undefined);
}

function baseFor(kind: string | undefined, name: string, slot: string | undefined): GearBase | null {
  if (kind) {
    const base = KIND_BASE[kind];
    if (!base) return null;
    if (base === 'sword' && /longblade|render|great|memory/i.test(name)) return 'greatsword';
    if (base === 'robe' && /coat|wrap|hide/i.test(name)) return 'coat';
    if (base === 'coat' && /pauldron/i.test(name)) return 'plate';
    if (base === 'helm' && /oath|circlet|diadem/i.test(name)) return 'circlet';
    if (base === 'crown' && /noon|circlet/i.test(name)) return 'circlet';
    return base;
  }
  return slot ? SLOT_BASE[slot] ?? null : null;
}

/** The base type of a piece of gear or a charm; null for consumables, materials, runes and kinds with no painter. */
export function itemBase(item: ItemRef): GearBase | null {
  return gearLookOf(item)?.base ?? null;
}

/** Everything the gear painter needs for this item, or null when it should keep its own (16-px) icon. */
export function gearLookOf(item: ItemRef): GearLook | null {
  const def = itemDefinitionOf(item);
  if (def) {
    if (def.family !== 'equipment' && def.family !== 'charm') return null;
    const spec = ITEM_ICONS[def.id];
    const base = baseFor(spec?.kind, def.name, def.slot);
    if (!base) return null;
    return {
      base, realm: def.style, rarity: item.rarity ?? 'common', seed: item.id ?? def.id,
      ...(spec ? { mat: spec.mat, ...(spec.acc ? { acc: spec.acc } : {}), ...(spec.sub ? { sub: spec.sub } : {}) } : {}),
    };
  }
  if (item.type === 'charm') {
    const seed = charmSeedOf(item);
    const spec = seed ? ITEM_ICONS[seed.id] : undefined;
    const base = baseFor(spec?.kind, item.name ?? '', 'charm1');
    if (!base) return null;
    return {
      base, realm: 'neutral', rarity: item.rarity ?? 'common', seed: item.id ?? seed?.id ?? item.name ?? 'charm',
      ...(spec ? { mat: spec.mat, ...(spec.acc ? { acc: spec.acc } : {}), ...(spec.sub ? { sub: spec.sub } : {}) } : {}),
    };
  }
  return null;
}

/**
 * The family a piece of gear rolls in (item-affixes.ts §3.6: a staff, a sword, a bow, a quiver, a shield, a focus,
 * armour, a ring), from its definition — else its worn slot's default (an old row with no definition). Null for
 * anything that is not gear.
 */
export function itemAffixFamily(item: ItemRef & { slot?: string }): AffixFamily | null {
  const def = itemDefinitionOf(item);
  if (def) return affixFamilyOf(def);
  return isAffixSlot(item.slot) ? DEFAULT_FAMILY[item.slot] : null;
}
