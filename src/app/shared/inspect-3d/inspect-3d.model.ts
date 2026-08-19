/**
 * inspect-3d.model.ts — how loud each rarity tier gets in the 3D inspector.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LADDER IS THE POINT
 * ─────────────────────────────────────────────────────────────────────────────
 * rarity.model.ts already establishes that a drop's value has to be legible
 * from across the room before a word of it is read — colour first, then sound,
 * then screen effect. The 3D card is the next channel up that ladder, and it
 * has to obey the same rule: a Mortal is a card with a rim light, a Singular
 * warps the air around it, and every rung between earns exactly one more thing.
 *
 * Six tiers, not seven. The Eclipse ladder is Mortal, Eclipsed, Sacred,
 * Anomalous, Mythic, Singular (see rarity.model.ts) and this table is keyed on
 * it directly rather than on a private list that would drift the moment a tier
 * was renamed.
 *
 * Pure data. No browser APIs, no three — importable from a spec.
 */
import { type EclipseRarity } from '../rarity/rarity.model';

export interface RarityEffects {
  /** Particles orbiting the card. Halved on a coarse-pointer device. */
  orbiters: number;
  /** Multiplier on the edge emission and the halo shell. */
  glow: number;
  /** Volumetric light rays behind the card. */
  rays: boolean;
  /** Energy tendrils writhing around it. Singular only. */
  tendrils: boolean;
  /** The card's own surface bends. Singular only. */
  warp: boolean;
  /** Orbit colour cycles through the spectrum instead of holding the tier hue. */
  prismatic: boolean;
  /** Radians per second the camera drifts around the card when nobody is dragging. */
  spin: number;
}

export const RARITY_EFFECTS: Record<EclipseRarity, RarityEffects> = {
  mortal:    { orbiters: 0,   glow: 0.35, rays: false, tendrils: false, warp: false, prismatic: false, spin: 0.16 },
  eclipsed:  { orbiters: 24,  glow: 0.55, rays: false, tendrils: false, warp: false, prismatic: false, spin: 0.18 },
  sacred:    { orbiters: 48,  glow: 0.75, rays: false, tendrils: false, warp: false, prismatic: false, spin: 0.20 },
  anomalous: { orbiters: 80,  glow: 0.95, rays: true,  tendrils: false, warp: false, prismatic: false, spin: 0.22 },
  mythic:    { orbiters: 130, glow: 1.15, rays: true,  tendrils: false, warp: false, prismatic: false, spin: 0.26 },
  singular:  { orbiters: 190, glow: 1.45, rays: true,  tendrils: true,  warp: true,  prismatic: true,  spin: 0.30 },
};

/** The tier's effects, scaled for the device. */
export function effectsFor(tier: EclipseRarity, coarsePointer: boolean): RarityEffects {
  const base = RARITY_EFFECTS[tier] ?? RARITY_EFFECTS.mortal;
  if (!coarsePointer) return base;
  return { ...base, orbiters: Math.round(base.orbiters / 2) };
}

/**
 * The tier an EntityPresentation is showing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO LADDERS, AND THIS IS WHERE THEY MEET
 * ─────────────────────────────────────────────────────────────────────────────
 * `EntityRarity.id` is a plain string on the presentation contract because the
 * resolver fills it from more than one table, and the two are not the same
 * ladder. Achievements, quests and artifacts carry the six-rung Eclipse scale
 * (rarity.model.ts). Runes, runewords and every item carry the seven-rung forge
 * scale — `ItemRarity` is literally `RuneTier` — which starts at Common and
 * passes through Legendary before reaching the two rungs the two ladders share.
 *
 * Without this map every item in the game inspects as Mortal: `legendary` is
 * not an EclipseRarity, so the lookup misses and the card gets no orbiters, no
 * rays, and the quietest glow on the ladder — for the second-rarest drop in the
 * forge. Uncommon and Rare are the pair that gets merged, because seven rungs
 * do not fit in six and those two are the least distinguishable step in the
 * forge ladder.
 *
 * Anything genuinely unrecognised still falls to Mortal rather than throwing.
 * An unknown rarity should render a plain card, not a broken one.
 */
const FORGE_LADDER: Record<string, EclipseRarity> = {
  common: 'mortal',
  uncommon: 'eclipsed',
  rare: 'eclipsed',
  epic: 'sacred',
  legendary: 'anomalous',
};

export function tierOfRarityId(id: string | undefined): EclipseRarity {
  const known: EclipseRarity[] = ['mortal', 'eclipsed', 'sacred', 'anomalous', 'mythic', 'singular'];
  const direct = known.find(t => t === id);
  return direct ?? FORGE_LADDER[id ?? ''] ?? 'mortal';
}

/** Card proportions, in world units and in texture pixels. Same aspect ratio. */
export const CARD = {
  width: 2.4,
  height: 3.4,
  /** A physical card is about 2mm thick against 60mm of width. This is that. */
  depth: 0.09,
  /* Sized so the texture is not the limiting factor at 1:1.

     The card fills roughly 70% of a 900px-tall viewport, which is ~1250 device
     pixels on a 2x display. A texture shorter than that is being magnified, and
     magnified text on a flat plane reads as blurry no matter how crisp the
     Canvas 2D draw was. */
  texWidth: 832,
  texHeight: 1178,
} as const;
