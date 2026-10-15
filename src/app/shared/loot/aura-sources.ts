/**
 * aura-sources.ts — what the Keeper's worn things grant in a fight: auras and
 * elemental resists (docs/design/loot-and-combat.md §6-7).
 *
 * Auras come from two places only, so each has a source the player can find:
 *  - a Socket Word with an `aura` (enchanting/socket-words.ts), at a level from
 *    the word's rarest rune;
 *  - a named unique with an `aura` (rpg/unique-items.ts), at a level from its
 *    authored rarity.
 * Tempering a source lifts it a level per three tempers (the item got better).
 *
 * Resists come from runes set into ARMOUR wells: D2's rule that the same rune
 * means one thing in a weapon and another in armour. Each rune's realm decides
 * its element (Infernal fire, Nocturne cold, the Verge's lightning, the
 * Archivum's arcane); the mythic and singular runes ward against all four.
 * Weapons keep their channel stat (socket.model.ts) and give no resist.
 */
import type { GameItem } from '../rpg/item.model';
import { uniqueById } from '../rpg/unique-items';
import { matchSocketWord, wordTier } from '../enchanting/socket-words';
import { socketFrameOf, socketedRunes } from '../enchanting/socket.model';
import { runeById, type RuneTier } from '../rune-forge/rune.model';
import { clampAuraLevel, type AuraSource } from './auras';
import { ELEMENTS, type Element, type Resists } from './damage.model';

/** Aura level by the source's tier. */
export const AURA_LEVEL_BY_TIER: Readonly<Record<RuneTier, number>> = {
  common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 7, mythic: 9, singular: 12,
};
/** Tempers per extra aura level. */
export const TEMPERS_PER_AURA_LEVEL = 3;

function temperBonus(item: GameItem): number {
  return Math.floor(Math.max(0, item.upgradeLevel ?? 0) / TEMPERS_PER_AURA_LEVEL);
}

/** The auras one worn item grants (zero, one, or two: a unique that also holds an aura word). */
export function itemAuras(item: GameItem): AuraSource[] {
  const out: AuraSource[] = [];
  const word = matchSocketWord(item);
  if (word?.aura) out.push({ aura: word.aura, level: clampAuraLevel(AURA_LEVEL_BY_TIER[wordTier(word)] + temperBonus(item)), from: word.id, name: word.name });
  const unique = uniqueById(item.definitionId);
  if (unique?.aura) out.push({ aura: unique.aura, level: clampAuraLevel(AURA_LEVEL_BY_TIER[unique.rarity] + temperBonus(item)), from: unique.id, name: unique.name });
  return out;
}

/** Every aura the Keeper's worn loadout grants (items worn by an explorer do not count). */
export function wornAuraSources(items: readonly GameItem[]): AuraSource[] {
  const out: AuraSource[] = [];
  for (const item of items) if (item.equipped && !item.explorerId) out.push(...itemAuras(item));
  return out;
}

/** Each rune's element in armour. Absent = no resist (none today; every rune is listed). */
export const RUNE_ELEMENT: Readonly<Record<string, Element | 'all'>> = {
  ash: 'fire', ember: 'fire', scorch: 'fire', forge: 'fire',
  shade: 'cold', veil: 'cold', hollow: 'cold', nox: 'cold',
  drift: 'lightning', glint: 'lightning', pulse: 'lightning', rift: 'lightning', aether: 'lightning',
  thorn: 'arcane', nexus: 'arcane', sigil: 'arcane', fracture: 'arcane', eclipse: 'arcane', codex: 'arcane',
  convergence: 'all', godstone: 'all', void: 'all',
};
/** Resist points a rune gives in armour, by tier (an 'all' rune gives half to each). */
export const RUNE_RESIST: Readonly<Record<RuneTier, number>> = {
  common: 6, uncommon: 9, rare: 12, epic: 16, legendary: 22, mythic: 30, singular: 40,
};

/** The resists one rune gives set into armour. */
export function runeResist(runeId: string): Resists {
  const rune = runeById(runeId);
  const element = RUNE_ELEMENT[runeId];
  if (!rune || !element) return {};
  const pts = RUNE_RESIST[rune.tier];
  if (element === 'all') {
    const out: Resists = {};
    for (const e of ELEMENTS) out[e] = Math.round(pts / 2);
    return out;
  }
  return { [element]: pts };
}

/** The Keeper's resists from worn armour sockets, before the difficulty penalty and the cap. */
export function wornResists(items: readonly GameItem[]): Resists {
  const out: Resists = {};
  for (const item of items) {
    if (!item.equipped || item.explorerId || socketFrameOf(item) !== 'armor') continue;
    for (const id of socketedRunes(item)) {
      const r = runeResist(id);
      for (const e of ELEMENTS) if (r[e]) out[e] = (out[e] ?? 0) + (r[e] ?? 0);
    }
  }
  return out;
}
