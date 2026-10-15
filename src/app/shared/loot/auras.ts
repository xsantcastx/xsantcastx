/**
 * auras.ts — the nine auras and their numbers (docs/design/loot-and-combat.md §7).
 *
 * D2's paladin auras, carried by runewords (Socket Words) and a few uniques
 * instead of a class: a Keeper wearing Conviction walks with a sigil under
 * their feet and every creature inside it loses resistance. One aura at a time
 * — the strongest worn, or the one the Keeper picked on the Loot & Combat sheet.
 *
 * Levels run 1..MAX_AURA_LEVEL and come from the source (a Socket Word's rune
 * tier, a unique's rarity), never from a stat the player can farm without
 * finding the thing. Every number here is a pure function of (aura, level) so
 * the engine, the sim and the specs agree.
 *
 * Pure: imports only types.
 */
import type { DamageType } from './damage.model';

export type AuraId =
  | 'might' | 'conviction' | 'redemption'
  | 'holy-fire' | 'holy-freeze' | 'holy-shock'
  | 'fanaticism' | 'prayer' | 'vigor';
export const AURA_IDS: readonly AuraId[] = [
  'might', 'conviction', 'redemption', 'holy-fire', 'holy-freeze', 'holy-shock', 'fanaticism', 'prayer', 'vigor',
];

export const MAX_AURA_LEVEL = 20;
/** Aura reach in world px at figure scale 1 (delves scale it with the figure). */
export const AURA_RADIUS = 300;
/** Seconds between a damage aura's pulses. */
export const AURA_PULSE = 1.5;

export interface AuraDef {
  id: AuraId;
  /** Ring and particle colour (art-bible ramps / the damage colours). */
  color: string;
  /** What kind of thing it does, for the sheet and the sim. */
  kind: 'offense' | 'defense' | 'pulse';
  /** A pulse aura's damage type. */
  element?: DamageType;
  /** Whether creatures inside it are marked (the debuff pip and tint). */
  debuffs: boolean;
}

export const AURAS: Readonly<Record<AuraId, AuraDef>> = {
  might: { id: 'might', color: '#ff6a3d', kind: 'offense', debuffs: false },
  conviction: { id: 'conviction', color: '#a855f7', kind: 'offense', debuffs: true },
  redemption: { id: 'redemption', color: '#f8e8c8', kind: 'defense', debuffs: false },
  'holy-fire': { id: 'holy-fire', color: '#ff8a3d', kind: 'pulse', element: 'fire', debuffs: true },
  'holy-freeze': { id: 'holy-freeze', color: '#8fd8ff', kind: 'pulse', element: 'cold', debuffs: true },
  'holy-shock': { id: 'holy-shock', color: '#ffe36d', kind: 'pulse', element: 'lightning', debuffs: true },
  fanaticism: { id: 'fanaticism', color: '#e8c898', kind: 'offense', debuffs: false },
  prayer: { id: 'prayer', color: '#9db8a8', kind: 'defense', debuffs: false },
  vigor: { id: 'vigor', color: '#00d4ff', kind: 'defense', debuffs: false },
};

export function isAuraId(value: unknown): value is AuraId {
  return typeof value === 'string' && (AURA_IDS as readonly string[]).includes(value);
}

export function clampAuraLevel(level: number): number {
  return Math.max(1, Math.min(MAX_AURA_LEVEL, Math.floor(Number.isFinite(level) ? level : 1)));
}

/**
 * Everything an aura does at a level. Fields that do not apply are 0 (or 1 for
 * multipliers), so a consumer can apply all of them without branching.
 */
export interface AuraEffect {
  /** Multiplies the Keeper's damage (Might). */
  damage: number;
  /** Points taken off every resist of creatures in reach (Conviction). */
  resistLower: number;
  /** HP healed per corpse in reach (Redemption). */
  healPerCorpse: number;
  /** Damage of each pulse to every creature in reach (Holy *). */
  pulseDamage: number;
  /** Creatures in reach move and wind up this much slower (Holy Freeze): 0.4 = 40% slower. */
  slow: number;
  /** Divides the swing cooldown (Fanaticism). */
  attackSpeed: number;
  /** HP per second (Prayer). */
  regen: number;
  /** Multiplies walk speed (Vigor). */
  moveSpeed: number;
}

const NONE: AuraEffect = { damage: 1, resistLower: 0, healPerCorpse: 0, pulseDamage: 0, slow: 0, attackSpeed: 1, regen: 0, moveSpeed: 1 };

/**
 * The numbers. Tuned on the combat sim (economy-sim --combat): a level-1 aura
 * is felt (one more Maw felled a minute), a level-12 one is a build.
 */
export function auraEffect(id: AuraId, level: number): AuraEffect {
  const l = clampAuraLevel(level);
  switch (id) {
    case 'might': return { ...NONE, damage: 1 + (15 + 5 * (l - 1)) / 100 };
    // D2's Conviction: -21% at 1 up to -85; capped at 85 here too.
    case 'conviction': return { ...NONE, resistLower: Math.min(85, 20 + 4 * (l - 1)) };
    case 'redemption': return { ...NONE, healPerCorpse: 8 + 2 * (l - 1) };
    case 'holy-fire': return { ...NONE, pulseDamage: 5 + 3 * (l - 1) };
    case 'holy-freeze': return { ...NONE, pulseDamage: 3 + 2 * (l - 1), slow: Math.min(0.6, 0.3 + 0.015 * (l - 1)) };
    case 'holy-shock': return { ...NONE, pulseDamage: 6 + 4 * (l - 1) };
    case 'fanaticism': return { ...NONE, attackSpeed: 1 + Math.min(60, 15 + 3 * (l - 1)) / 100 };
    case 'prayer': return { ...NONE, regen: 1.5 + 0.5 * (l - 1) };
    case 'vigor': return { ...NONE, moveSpeed: 1 + Math.min(40, 12 + 2 * (l - 1)) / 100 };
  }
}

/** One aura a worn thing gives: where it came from, so the sheet can name it. */
export interface AuraSource {
  aura: AuraId;
  level: number;
  /** The Socket Word or unique id that grants it. */
  from: string;
  /** Its display name ("Brandoath"). */
  name: string;
}

/**
 * The one aura that runs: the chosen one when a worn thing grants it (at the
 * best level worn), else the strongest (highest level; ties go to the earlier
 * aura in AURA_IDS so the choice is stable). Null when nothing grants one.
 */
export function pickAura(sources: readonly AuraSource[], chosen: AuraId | null | undefined): AuraSource | null {
  if (!sources.length) return null;
  const best = (list: readonly AuraSource[]): AuraSource =>
    list.reduce((a, b) => (b.level > a.level || (b.level === a.level && AURA_IDS.indexOf(b.aura) < AURA_IDS.indexOf(a.aura)) ? b : a));
  if (chosen) {
    const mine = sources.filter(s => s.aura === chosen);
    if (mine.length) return best(mine);
  }
  return best(sources);
}

/**
 * A rough worth of an aura at a level in "extra damage per second" against a
 * pack of `targets` creatures, for the sim's balance band and the sheet's sort.
 * Not used by the engine.
 */
export function auraPower(id: AuraId, level: number, keeperDps: number, targets = 3): number {
  const e = auraEffect(id, level);
  return keeperDps * (e.damage - 1)
    + keeperDps * (e.attackSpeed - 1)
    + (e.pulseDamage / AURA_PULSE) * targets
    + keeperDps * Math.min(0.85, e.resistLower / 100) * 0.5
    + e.regen + e.healPerCorpse / 6
    + keeperDps * (e.moveSpeed - 1) * 0.25;
}
