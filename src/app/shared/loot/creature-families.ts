/**
 * creature-families.ts — who every creature is in a fight (docs/design/loot-and-combat.md §4-5).
 *
 * One profile per creature key (the `artFor()` key a MonsterDef names): its
 * family (shared resists and look), its role (how it fights), its base level
 * (where it sits on the curve; drop quality and damage read it), the type its
 * blows carry, and whether it is a boss.
 *
 * A key with no profile (a creature the living-world agent places before it is
 * written here) falls back to a level-1 melee brute of the 'wild' family, so a
 * new spawn never crashes the loot or the combat math: it is simply ordinary.
 *
 * Pure data and functions; imports only pure modules.
 */
import { DIFFICULTIES, type DifficultyTier } from './difficulty.model';
import type { DamageType, Resists } from './damage.model';

/** How a creature fights. Only 'melee' has its own engine behaviour today; see the design doc's gaps. */
export type CreatureRole = 'melee' | 'ranged' | 'healer' | 'shielder' | 'summoner' | 'exploder';
export type CreatureFamily = 'maw' | 'beast' | 'ember' | 'shade' | 'graft' | 'prism' | 'orrery' | 'bone' | 'orc' | 'wild';

export interface FamilyDef {
  id: CreatureFamily;
  /** Base resists every member shares (a member may add its own). */
  resists: Resists;
  /** The type a member's blow carries unless the member says otherwise. */
  hits: DamageType;
}

export const FAMILIES: Readonly<Record<CreatureFamily, FamilyDef>> = {
  // The Seamworks' constructs: riveted, cold-forged; fire does not bite, sparks do. Steel is the tutorial's answer, so no physical resist.
  maw: { id: 'maw', resists: { fire: 25, lightning: -15 }, hits: 'physical' },
  // Canopy and court beasts: soft, honest, a little afraid of fire.
  beast: { id: 'beast', resists: { fire: -10 }, hits: 'physical' },
  // The Underhearth's banked heat: fire cannot hurt what fire is made of.
  ember: { id: 'ember', resists: { fire: 75, cold: -25 }, hits: 'fire' },
  // The Ink Deeps: dark that light finds; steel goes half through.
  shade: { id: 'shade', resists: { physical: 30, cold: 50, arcane: -30 }, hits: 'cold' },
  // The Root Deeps: grafted wood; it drinks lightning and burns.
  graft: { id: 'graft', resists: { lightning: 50, cold: 20, fire: -20 }, hits: 'physical' },
  // The Prism Mines: glass that holds light; arcane slides off, a blow cracks it.
  prism: { id: 'prism', resists: { arcane: 60, lightning: 25, physical: -10 }, hits: 'lightning' },
  // The Orrery Wells: brass and star-iron; cold-hardened, sparks race through it.
  orrery: { id: 'orrery', resists: { cold: 40, physical: 15, lightning: -20 }, hits: 'arcane' },
  // The Ashen Bastion's dead: dry bone and cinder; cold cannot chill what has no blood, fire cracks it.
  bone: { id: 'bone', resists: { cold: 40, fire: -20 }, hits: 'physical' },
  // The Cinder clans of Infernal Reach: thick-hided, raised among the embers.
  orc: { id: 'orc', resists: { fire: 20, cold: -10 }, hits: 'physical' },
  wild: { id: 'wild', resists: {}, hits: 'physical' },
};

export interface CreatureProfile {
  creature: string;
  family: CreatureFamily;
  role: CreatureRole;
  /** Level on Normal at the top of its haunt. Depth and difficulty add to it. */
  level: number;
  /** Overrides the family's blow type. */
  hits?: DamageType;
  /** Added to the family's resists. */
  resists?: Resists;
  /** A boss: never a champion, always drops, and the drop shifts up the ladder. */
  boss?: boolean;
}

const P = (creature: string, family: CreatureFamily, role: CreatureRole, level: number, extra: Partial<CreatureProfile> = {}): CreatureProfile =>
  ({ creature, family, role, level, ...extra });

/** Every creature the world spawns today, by key. */
export const CREATURE_PROFILES: readonly CreatureProfile[] = [
  // Infernal — the Seamworks, the Ember Delve, the Underhearth.
  P('rivet-maw', 'maw', 'melee', 1),
  P('cinder-bailiff', 'maw', 'shielder', 6, { resists: { physical: 15 } }),
  P('seam-eater', 'maw', 'melee', 7),
  P('drowned-lamp', 'ember', 'summoner', 5, { boss: true, hits: 'fire', resists: { cold: 10 } }),
  P('banked-ember', 'ember', 'exploder', 8),
  P('ironwood-sentinel', 'maw', 'shielder', 9, { resists: { physical: 25 } }),
  P('banked-furnace', 'ember', 'summoner', 10, { boss: true }),
  // Infernal Reach (top-down, td-mobs.ts) — the Ashen Crypt's undead, the Cinder clans, the Molten Fields' drakes.
  P('bone-walker', 'bone', 'melee', 6),
  P('bone-archer', 'bone', 'ranged', 8),
  P('ash-ghoul', 'bone', 'melee', 9, { resists: { physical: -10 } }),
  P('cinder-wraith', 'bone', 'melee', 12, { hits: 'cold', resists: { physical: 30 } }),
  P('cinder-orc', 'orc', 'melee', 10),
  P('orc-firecaller', 'orc', 'ranged', 13, { hits: 'fire' }),
  P('orc-warlord', 'orc', 'melee', 16, { resists: { physical: 15 } }),
  P('ashsinger', 'orc', 'summoner', 14, { hits: 'fire' }),
  P('bone-priest', 'bone', 'summoner', 16),
  P('ember-drake', 'ember', 'ranged', 18),
  P('bone-dragon', 'bone', 'summoner', 25, { boss: true, hits: 'fire' }),
  // The Molten Deep's lower floors and the Forge of the Four.
  P('slag-crawler', 'ember', 'melee', 21, { resists: { physical: 15 } }),
  P('glass-sentinel', 'prism', 'ranged', 24, { hits: 'fire' }),
  P('anvil-warden', 'maw', 'summoner', 18, { boss: true, resists: { physical: 20 } }),
  P('cinder-sovereign', 'ember', 'summoner', 30, { boss: true }),
  // The Verdant Wilds (top-down, td-mobs.ts) — the Greenwood, the Deep Wilds, the Sunken Courts, the Overgrown Temple.
  P('canopy-bat', 'beast', 'melee', 15),
  P('moss-stalker', 'beast', 'melee', 17),
  P('vine-lasher', 'graft', 'melee', 21),
  P('rootglass-hart', 'beast', 'melee', 24),
  P('thorn-weaver', 'graft', 'ranged', 28),
  P('mossbound-colossus', 'graft', 'summoner', 34, { boss: true, resists: { physical: 20 } }),
  // The Verdant Wilds' deeper places — the Root Hollows, the Overgrown Temple's Drowned Vault and Rootcradle.
  P('rootgnaw', 'beast', 'melee', 19, { resists: { physical: 10 } }),
  P('sporecap', 'graft', 'ranged', 23, { hits: 'arcane' }),
  P('drowned-acolyte', 'graft', 'melee', 33, { hits: 'cold', resists: { cold: 20 } }),
  P('elder-rootwyrm', 'graft', 'summoner', 40, { boss: true, resists: { physical: 15 } }),
  // Verdant — the Canopy and the Root Deeps.
  P('rootglass-stag', 'beast', 'melee', 2),
  P('graftling', 'graft', 'healer', 12),
  P('graftmother', 'graft', 'healer', 16, { boss: true }),
  // Luminous — Heliograph Court and the Prism Mines.
  P('prism-forager', 'beast', 'melee', 3, { hits: 'lightning' }),
  P('afterimage-moth', 'prism', 'ranged', 4),
  P('prismling', 'prism', 'ranged', 13),
  P('hollow-sun', 'prism', 'ranged', 18, { boss: true, hits: 'fire' }),
  // Umbral — the Nocturne Archive and the Ink Deeps.
  P('mirror-substitute', 'shade', 'melee', 3, { resists: { physical: -20 } }),
  P('ink-lantern', 'shade', 'summoner', 4),
  P('shadeling', 'shade', 'melee', 12),
  P('gloam-warden', 'shade', 'summoner', 16, { boss: true }),
  // Celestial — the Meridian Orrery and the Orrery Wells.
  P('ephemeris-leech', 'orrery', 'melee', 3, { resists: { cold: -40 } }),
  P('anchor-warden', 'orrery', 'shielder', 14),
  P('fallen-ephemeris', 'orrery', 'summoner', 20, { boss: true }),
  // The Umbral Marches (top-down, td-mobs.ts) — the fens, the meres, the drowned ruins, the Drowned Crypts.
  P('mire-lurker', 'beast', 'melee', 25, { resists: { cold: 20 } }),
  P('lantern-wisp', 'shade', 'melee', 28, { hits: 'fire', resists: { fire: 40 } }),
  P('ink-hound', 'shade', 'melee', 32, { resists: { physical: -20 } }),
  P('drowned-knight', 'bone', 'melee', 38, { hits: 'cold', resists: { lightning: -20 } }),
  P('gloam-witch', 'shade', 'ranged', 42, { hits: 'arcane', resists: { physical: -45 } }),
  P('ink-abbess', 'shade', 'summoner', 50, { boss: true, hits: 'arcane' }),
];

const BY_ID = new Map(CREATURE_PROFILES.map(p => [p.creature, p]));

/** A creature's profile; an unknown key is an ordinary level-1 brute. */
export function creatureProfile(creature: string): CreatureProfile {
  return BY_ID.get(creature) ?? { creature, family: 'wild', role: 'melee', level: 1 };
}

export function isKnownCreature(creature: string): boolean {
  return BY_ID.has(creature);
}

/** Delve rows per extra level below the surface (deeper is harder and richer). */
export const ROWS_PER_LEVEL = 40;
/** Levels a creature can gain from depth alone (the realm Delves' halls are already authored deep). */
export const MAX_DEPTH_LEVELS = 12;

/**
 * A creature's level where it stands: its base, plus depth (one per
 * ROWS_PER_LEVEL rows, capped), plus the difficulty's offset.
 */
export function monsterLevel(creature: string, depthRows = 0, tier: DifficultyTier = 'normal'): number {
  const depth = Math.max(0, Math.min(MAX_DEPTH_LEVELS, Math.floor(Math.max(0, depthRows) / ROWS_PER_LEVEL)));
  return creatureProfile(creature).level + depth + DIFFICULTIES[tier].level;
}

/** The creature's resists on a tier: family + own + the tier's bonus on every non-negative entry that exists. */
export function creatureResists(creature: string, tier: DifficultyTier = 'normal'): Resists {
  const p = creatureProfile(creature);
  const fam = FAMILIES[p.family];
  const out: Resists = { ...fam.resists };
  for (const [k, v] of Object.entries(p.resists ?? {}) as [DamageType, number][]) out[k] = (out[k] ?? 0) + v;
  const bonus = DIFFICULTIES[tier].creatureResist;
  if (bonus) for (const k of Object.keys(out) as DamageType[]) if ((out[k] ?? 0) > 0) out[k] = (out[k] ?? 0) + bonus;
  return out;
}

/** The type a creature's blow carries. */
export function creatureHits(creature: string): DamageType {
  const p = creatureProfile(creature);
  return p.hits ?? FAMILIES[p.family].hits;
}

/** A creature's blow at `level` before mods, tier and resists: 12 at level 1, +12% per level. */
export const BASE_BLOW = 12;
export const BLOW_PER_LEVEL = 0.12;
export function creatureBlow(level: number): number {
  return Math.round(BASE_BLOW * (1 + BLOW_PER_LEVEL * Math.max(0, level - 1)));
}

/**
 * HP multiplier from levels gained beyond the creature's authored level (depth,
 * difficulty offset excluded: the tier's own hp multiplier covers that). The
 * authored HP already prices the base level in.
 */
export const HP_PER_EXTRA_LEVEL = 0.08;
/** Never more than this from area/depth levels alone: a far pack is a fight, not a wall (difficulty multiplies on top). */
export const MAX_AREA_HP_SCALE = 3;
export function depthHpScale(extraLevels: number): number {
  return Math.min(MAX_AREA_HP_SCALE, 1 + HP_PER_EXTRA_LEVEL * Math.max(0, extraLevels));
}
