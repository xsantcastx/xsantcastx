/**
 * rarity.model.ts — the six Eclipse Realms rarity tiers.
 *
 * Modelled on the Diablo 2 drop ladder, where the value of a drop is legible
 * from across the room before you have read a word of it: colour first, then
 * sound, then screen effect. Each step up the ladder earns a louder channel.
 *
 * The tier list mirrors the drop rates in the Eclipse Realms economy doc —
 * Mortal 80%, Eclipsed 15%, Sacred 4%, Anomalous 0.9%, Mythic 0.09%, Singular
 * one-of-a-kind — which is why the egg distribution below is bottom-heavy.
 */

export type EclipseRarity =
  | 'mortal'
  | 'eclipsed'
  | 'sacred'
  | 'anomalous'
  | 'mythic'
  | 'singular';

export interface RarityDefinition {
  id: EclipseRarity;
  /** Shown on the drop badge. */
  label: string;
  /** Ladder position, 0-5. Higher is rarer. */
  weight: number;
  /** Primary colour — border, badge and glow all derive from it. */
  color: string;
  /** Halo colour, already alpha'd for box-shadow use. */
  glow: string;
  /** Flavour line under the achievement name. */
  flavour: string;
  /** Which audio cue fires. 'none' stays silent. */
  sound: 'blip' | 'chime' | 'horn' | 'impact' | 'prism' | 'none';
  /** Milliseconds the drop stays on screen. Rarer drops linger. */
  duration: number;
  /** Takes over the viewport: flash, dim overlay, centred card, particles. */
  cinematic: boolean;
  /** Tier sigil under assets/icons/rarity. */
  icon: string;
}

export const RARITIES: Record<EclipseRarity, RarityDefinition> = {
  mortal: {
    id: 'mortal',
    icon: 'assets/icons/rarity/mortal.png',
    label: 'Mortal',
    weight: 0,
    color: '#e8ecf1',
    glow: 'rgba(232, 236, 241, 0.45)',
    flavour: 'A common find. The realms barely stirred.',
    sound: 'blip',
    duration: 4200,
    cinematic: false,
  },
  eclipsed: {
    id: 'eclipsed',
    icon: 'assets/icons/rarity/eclipsed.png',
    label: 'Eclipsed',
    weight: 1,
    color: '#5fb6ff',
    glow: 'rgba(80, 180, 255, 0.55)',
    flavour: 'Touched by the shadow of the broken Sun.',
    sound: 'blip',
    duration: 4600,
    cinematic: false,
  },
  sacred: {
    id: 'sacred',
    icon: 'assets/icons/rarity/sacred.png',
    label: 'Sacred',
    weight: 2,
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.7)',
    flavour: 'Consecrated in the Luminous vaults.',
    sound: 'chime',
    duration: 5400,
    cinematic: false,
  },
  anomalous: {
    id: 'anomalous',
    icon: 'assets/icons/rarity/anomalous.png',
    label: 'Anomalous',
    weight: 3,
    color: '#C9A84C',
    glow: 'rgba(255, 190, 90, 0.75)',
    flavour: 'The Archivum has no record of this.',
    sound: 'horn',
    duration: 6200,
    cinematic: false,
  },
  mythic: {
    id: 'mythic',
    icon: 'assets/icons/rarity/mythic.png',
    label: 'Mythic',
    weight: 4,
    color: '#ff2d4d',
    glow: 'rgba(255, 45, 77, 0.85)',
    flavour: 'The Godforge opened. Briefly.',
    sound: 'impact',
    duration: 7600,
    cinematic: true,
  },
  singular: {
    id: 'singular',
    icon: 'assets/icons/rarity/singular.png',
    label: 'Singular',
    weight: 5,
    color: '#ff6dd7',
    glow: 'rgba(255, 109, 215, 0.9)',
    flavour: 'First in the realm. No one has stood here before.',
    sound: 'prism',
    duration: 9000,
    cinematic: true,
  },
};

export const RARITY_ORDER: EclipseRarity[] = [
  'mortal', 'eclipsed', 'sacred', 'anomalous', 'mythic', 'singular',
];

/**
 * The easter egg registry predates this system and still carries the original
 * four-step scale. Rather than rewrite 140 registry lines (and lose the diff
 * history on each), the legacy value is the default and the tier list below is
 * the exception list.
 */
const LEGACY_MAP: Record<string, EclipseRarity> = {
  common: 'mortal',
  rare: 'eclipsed',
  epic: 'sacred',
  legendary: 'anomalous',
};

/**
 * Explicit tiers, keyed by egg id. Everything absent falls back to LEGACY_MAP.
 *
 * The shape of the ladder: 43 Mortal, 79 Eclipsed, 10 Sacred, 5 Anomalous and
 * 2 Mythic across the 139 registered eggs. Singular is not assigned to any egg
 * — it is earned, not authored (see `isSingular`).
 */
export const EGG_TIERS: Record<string, EclipseRarity> = {
  // ── Mythic ── three eggs that take real intent to reach.
  'hash-miner': 'mythic',          // a digest with four leading zeros
  'regex-ouroboros': 'mythic',     // a regex that matches its own source
  // 5,800 Essence of artifacts, which is months of ranks, weeklies and Mythic
  // drops. The legacy 'legendary' on its registry line would file it as
  // Anomalous alongside holding three, and holding all five is not the same
  // claim as holding three.
  'forge-complete-collection': 'mythic',

  // ── Anomalous ── outcomes you cannot really aim at.
  'uuid-lucky': 'anomalous',       // a UUID beginning 000
  'img-pixel-pincher': 'anomalous',// an image compressed below 1 KB
  'svg-complex-path': 'anomalous', // a path with 50+ commands
  'heading-perfect': 'anomalous',  // all six heading levels, zero errors
  'json-tree-forest': 'anomalous', // a tree of 1000+ nodes

  // ── Sacred ── deliberate, but reachable in one sitting.
  'regex-master': 'sacred',
  'email-santa': 'sacred',
  'api-teapot': 'sacred',
  'url-rickroll': 'sacred',
  'case-monotone': 'sacred',
  'json-abyss': 'sacred',
  'grid-matrix': 'sacred',
  'anim-seizure': 'sacred',
  'filter-chaos': 'sacred',
  'palette-monochrome': 'sacred',

  // ── Demoted from the legacy 'epic' bucket ── these are a single deliberate
  // input away, which is Eclipsed work, not Sacred.
  'svg-code': 'eclipsed',
  'ph-pixel': 'eclipsed',
  'resize-pixel': 'eclipsed',
  'button-forbidden': 'eclipsed',
  'color-badass': 'eclipsed',
  'responsive-pixel': 'eclipsed',
};

/** The tier for an egg: explicit assignment first, legacy scale second. */
export function tierForEgg(id: string, legacyRarity?: string): EclipseRarity {
  return EGG_TIERS[id] ?? LEGACY_MAP[legacyRarity ?? ''] ?? 'mortal';
}

export function rarityOf(tier: EclipseRarity): RarityDefinition {
  return RARITIES[tier] ?? RARITIES.mortal;
}

/**
 * Singular is not a property of the achievement, it is a property of the moment.
 * The egg service already increments a global Firestore counter on discovery, so
 * a post-write count of exactly 1 means nobody in the realm reached it first.
 */
export function isSingular(globalCount: number): boolean {
  return globalCount === 1;
}
