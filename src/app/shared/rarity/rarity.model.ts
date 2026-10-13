/**
 * rarity.model.ts — the six Eclipse Realms rarity tiers.
 *
 * Modelled on the Diablo 2 drop ladder, where the value of a drop is legible
 * from across the room before you have read a word of it: colour first, then
 * sound, then screen effect. Each step up the ladder earns a louder channel.
 *
 * Colours come from the Eclipse Realms Design System rarity ladder (tokens/rarity.css).
 * That ladder has seven tiers and this type has six, so the six map onto it by ladder
 * role: mortal=common, eclipsed=rare, sacred=epic, anomalous=legendary, mythic=mythic,
 * singular=singular. The ids themselves are deliberately unchanged — they are persisted
 * in saves, egg tables and market filters, so renaming them would be a data migration,
 * not a restyle.
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
    icon: 'assets/icons/rarity/mortal.webp',
    label: 'Mortal',
    weight: 0,
    color: '#8f8aa1',
    glow: 'rgba(143, 138, 161, 0.45)',
    flavour: 'A common find. The realms barely stirred.',
    sound: 'blip',
    duration: 4200,
    cinematic: false,
  },
  eclipsed: {
    id: 'eclipsed',
    icon: 'assets/icons/rarity/eclipsed.webp',
    label: 'Eclipsed',
    weight: 1,
    color: '#00d4ff',
    glow: 'rgba(0, 212, 255, 0.55)',
    flavour: 'Touched by the shadow of the broken Sun.',
    sound: 'blip',
    duration: 4600,
    cinematic: false,
  },
  sacred: {
    id: 'sacred',
    icon: 'assets/icons/rarity/sacred.webp',
    label: 'Sacred',
    weight: 2,
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    flavour: 'Consecrated in the Luminous vaults.',
    sound: 'chime',
    duration: 5400,
    cinematic: false,
  },
  anomalous: {
    id: 'anomalous',
    icon: 'assets/icons/rarity/anomalous.webp',
    label: 'Anomalous',
    weight: 3,
    color: '#e8c898',
    glow: 'rgba(232, 200, 152, 0.7)',
    flavour: 'The Archivum has no record of this.',
    sound: 'horn',
    duration: 6200,
    cinematic: false,
  },
  mythic: {
    id: 'mythic',
    icon: 'assets/icons/rarity/mythic.webp',
    label: 'Mythic',
    weight: 4,
    color: '#f8e8c8',
    glow: 'rgba(248, 232, 200, 0.85)',
    flavour: 'The Godforge opened. Briefly.',
    sound: 'impact',
    duration: 7600,
    cinematic: true,
  },
  singular: {
    id: 'singular',
    icon: 'assets/icons/rarity/singular.webp',
    label: 'Singular',
    weight: 5,
    color: '#ff6dd7',
    glow: 'rgba(255, 109, 215, 0.95)',
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
 * Singular is not assigned to any egg — it is earned, not authored (see
 * `isSingular`).
 */
export const EGG_TIERS: Record<string, EclipseRarity> = {
  // ── The combo ladder ── the only tiers on the wall priced in time held.
  // Assigned explicitly rather than left to LEGACY_MAP for two reasons: the
  // legacy scale tops out at 'legendary', which maps to Anomalous, so the two
  // Mythic rungs are unreachable through it; and the ladder's shape is the
  // point, so it should be readable in one place rather than inferred from six
  // scattered `rarity` fields.
  'combo-first-sun': 'mythic',        // x9,999 — 83 minutes without a gap
  'combo-eclipse-breaker': 'mythic',  // x5,000
  'combo-millennium-strike': 'anomalous',
  'combo-forbidden-count': 'anomalous',
  'combo-relentless': 'sacred',
  'combo-century-forge': 'sacred',
  'combo-forge-frenzy': 'eclipsed',
  'combo-rapid-strike': 'mortal',

  // ── The Rune Forge ── the drop table's own ladder, transposed onto the wall.
  // The two Mythic rungs are the two that cannot be reached by persistence
  // alone: both require the 0.05% rune, and the legacy `rarity` field on their
  // registry lines tops out at Anomalous, so without these two entries they
  // would sit alongside "held three artifacts".
  'rune-complete-set': 'mythic',
  'rune-void-voice': 'mythic',
  'rune-breath-of-void': 'mythic',
  'rune-word-scholar': 'anomalous',
  'rune-master': 'sacred',
  'rune-first-word': 'sacred',
  'rune-collector': 'eclipsed',
  'rune-first': 'mortal',

  // The two scroll rungs. The Full Codex is Mythic because it cannot be
  // completed without the Void rune — `unwritten-verse` is the only scroll on
  // the Singular shelf and nothing below the Void reaches it, so the last page
  // of the codex is gated on the rarest drop in the table.
  'scroll-full-codex': 'mythic',
  'scroll-lore-hunter': 'sacred',

  // ── Mythic ── an egg that takes real intent to reach.
  // 5,800 Essence of artifacts, which is months of ranks, weeklies and Mythic
  // drops. The legacy 'legendary' on its registry line would file it as
  // Anomalous alongside holding three, and holding all five is not the same
  // claim as holding three.
  'forge-complete-collection': 'mythic',
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
