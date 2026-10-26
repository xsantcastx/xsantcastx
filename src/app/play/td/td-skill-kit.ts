/**
 * td-skill-kit.ts — how every attack looks and sounds (docs/design/skills-100.md §0.6, campaign.md S3: "an animation
 * and a sound for every attack").
 *
 * One record per skill row (all four callings and the Common page) and per basic attack: the Keeper's animation on the
 * visible-gear rig (td-keeper-anim.ts), the cast cue and the hit cue (shared/sound/combat-cues.ts, synthesised by the
 * sound director) with the row's variation in semitones, and the element its impact spark is coloured by
 * (DAMAGE_COLORS). A creature's blow reads its family's bite (biteCueOf). Pure data: the fight (td-mobs.ts) calls
 * `skillKit(id)` on each cast and each hit, and the engine plays what it is handed.
 *
 * Keyed by string, not SkillId, so a row added to the book without its kit fails the spec (td-skill-kit.spec.ts) instead
 * of the build, and the fallback below still gives it a readable cast.
 */
import type { CastCue, HitCue, BiteCue } from '../../shared/sound/combat-cues';
import { creatureProfile, type CreatureFamily } from '../../shared/loot/creature-families';
import type { DamageType } from '../../shared/loot/damage.model';

/** The Keeper's eleven animations (skills-100.md §0.6). */
export const KEEPER_ANIMS = ['cast-raise', 'cast-push', 'cast-slam', 'channel', 'swing', 'heavy', 'shield-up', 'throw', 'draw', 'whistle', 'kneel'] as const;
export type KeeperAnim = typeof KEEPER_ANIMS[number];

export interface SkillKit {
  anim: KeeperAnim;
  /** The cue on the cast (null: a basic attack's swing has only its hit, or an aura sounds nothing). */
  cast: CastCue | HitCue | null;
  /** The cue on each blow it lands (null: it lands no blow — a ward, a heal, a toggle). */
  hit: HitCue | CastCue | null;
  /** Semitones (the row's variation): up for small and quick, down for heavy. */
  pitch: number;
  /** The impact spark's colour (DAMAGE_COLORS). */
  el: DamageType;
}

const K = (anim: KeeperAnim, cast: SkillKit['cast'], hit: SkillKit['hit'], el: DamageType, pitch = 0): SkillKit => ({ anim, cast, hit, pitch, el });

export const SKILL_KIT: Readonly<Record<string, SkillKit>> = {
  // ── Warlock · Ember ──
  'ember-bolt': K('cast-push', null, 'fire-hit', 'fire', 3),
  'hellfire-nova': K('cast-slam', 'fire-cast', 'fire-hit', 'fire', -3),
  'aura-embers': K('cast-raise', null, 'fire-hit', 'fire', 5),
  'cinder-rain': K('cast-raise', 'fire-cast', 'fire-hit', 'fire', 2),
  'flame-wall': K('cast-slam', 'fire-cast', 'fire-hit', 'fire', -1),
  'ember-mastery': K('cast-push', null, 'fire-hit', 'fire'),
  'meteor': K('cast-raise', 'ultimate', 'fire-hit', 'fire', -5),
  // ── Warlock · Bone ──
  'bone-spear': K('cast-push', 'bone-cast', 'bone-hit', 'arcane', 2),
  'raise-skeleton': K('cast-slam', 'bone-cast', 'bone-hit', 'arcane', -2),
  'soul-harvest': K('cast-raise', null, 'bone-hit', 'arcane'),
  'corpse-burst': K('cast-push', 'bone-cast', 'bone-hit', 'arcane', -3),
  'skeleton-mastery': K('cast-slam', null, 'bone-hit', 'arcane'),
  'bone-armor': K('cast-raise', 'bone-cast', null, 'arcane', 4),
  'bone-storm': K('cast-push', 'bone-cast', 'bone-hit', 'arcane', 0),
  // ── Warlock · Shadow ──
  'drain-life': K('channel', 'shadow-cast', 'bone-hit', 'arcane', 0),
  'ember-curse': K('cast-push', 'shadow-cast', 'fire-hit', 'fire', -2),
  'dark-ward': K('cast-raise', 'ward', null, 'arcane', -3),
  'aura-siphon': K('cast-raise', null, null, 'arcane'),
  'weaken': K('cast-push', 'shadow-cast', null, 'arcane', 2),
  'life-tap': K('cast-raise', 'shadow-cast', null, 'arcane'),
  'doom': K('cast-push', 'shadow-cast', 'fire-hit', 'arcane', -4),
  // ── Common page ──
  'light': K('cast-raise', 'light-cast', null, 'arcane', 4),
  'seek': K('cast-raise', 'wind', null, 'arcane', 3),
  'waygate': K('cast-slam', 'ward', null, 'arcane', -5),
  // ── Ashguard · Brand ──
  'watch-blade': K('swing', null, 'blade', 'physical', 0),
  'ember-brand': K('cast-raise', 'fire-cast', 'fire-hit', 'fire', 3),
  'cinder-cleave': K('heavy', 'fire-cast', 'blade', 'fire', -2),
  'whirl-of-cinders': K('swing', 'wind', 'blade', 'fire', -1),
  'brand-throw': K('throw', 'wind', 'blade', 'fire', 2),
  // ── Ashguard · Oath ──
  'shield-bash': K('shield-up', 'shield', 'shield', 'physical', -2),
  'shield-oath': K('shield-up', 'shield', null, 'physical', -4),
  'watch-cry': K('whistle', 'shield', null, 'physical', -7),
  'hold-the-line': K('shield-up', null, null, 'physical'),
  'banner-of-the-watch': K('cast-raise', 'shield', null, 'physical', -5),
  'intercept': K('shield-up', 'shield', null, 'physical', 0),
  'hold-the-gate': K('shield-up', 'shield', 'shield', 'physical', -9),
  // ── Ashguard · Ash ──
  'ash-stride': K('heavy', 'wind', 'blade', 'physical', -3),
  'aura-watchfire': K('cast-raise', null, null, 'fire'),
  'ember-blood': K('cast-raise', null, null, 'fire'),
  'last-watch': K('kneel', 'ultimate', null, 'physical', -2),
  'cinder-skin': K('cast-raise', 'fire-cast', null, 'fire', 4),
  'second-wind': K('kneel', 'heal', null, 'physical', -5),
  // ── Lanternwright · Lamp ──
  'kindle': K('cast-push', null, 'light-hit', 'arcane', 0),
  'blinding-flash': K('cast-raise', 'light-cast', 'light-hit', 'arcane', 2),
  'lantern-aura': K('cast-raise', null, null, 'arcane'),
  'shutter-lantern': K('cast-raise', 'ward', null, 'arcane', 7),
  'banish': K('cast-push', 'light-cast', 'light-hit', 'arcane', -3),
  'dawn-at-noon': K('cast-slam', 'ultimate', 'light-hit', 'arcane', 0),
  // ── Lanternwright · Hearth ──
  'hearthlight': K('cast-raise', 'heal', null, 'arcane', 0),
  'hearth-circle': K('cast-slam', 'heal', null, 'arcane', -5),
  'lantern-ward': K('cast-raise', 'ward', null, 'arcane', 0),
  'last-light': K('kneel', 'revive', null, 'arcane'),
  'cleanse': K('cast-raise', 'light-hit', null, 'arcane', 5),
  'rekindle': K('kneel', 'revive', null, 'arcane', 0),
  'hearthsong': K('channel', 'heal', null, 'arcane', 2),
  // ── Lanternwright · Moth ──
  'lamp-wisp': K('cast-raise', 'light-cast', 'light-hit', 'arcane', 5),
  'moth-kin': K('cast-raise', null, 'light-hit', 'arcane'),
  'beacon': K('cast-slam', 'light-cast', 'light-hit', 'arcane', -2),
  // ── Thornstrider · Thorn ──
  'thorn-shot': K('draw', null, 'arrow', 'physical', 0),
  'barbed-shot': K('draw', 'arrow', 'arrow', 'physical', -2),
  'volley': K('draw', 'arrow', 'arrow', 'physical', 3),
  'heartwood': K('draw', null, 'arrow', 'physical'),
  // ── Thornstrider · Wild ──
  'command': K('whistle', 'beast', 'beast', 'physical', 0),
  'pack-bond': K('whistle', null, null, 'physical'),
  'call-of-the-wilds': K('whistle', 'beast', 'beast', 'physical', -4),
  'wild-heart': K('whistle', null, null, 'physical'),
  'stampede': K('whistle', 'ultimate', 'beast', 'physical', -6),
  // ── Thornstrider · Briar & Sky ──
  'thornroot-snare': K('cast-slam', 'wind', 'arrow', 'physical', -3),
  'bramble-trap': K('throw', 'wind', 'arrow', 'physical', 2),
  'rootwalk': K('cast-raise', 'wind', null, 'physical', -2),
};

/** A row's kit; a row without one still casts with a readable raise and a soft chime (the spec flags it). */
export function skillKit(id: string): SkillKit {
  return SKILL_KIT[id] ?? K('cast-raise', 'light-cast', null, 'arcane');
}

/** A creature family's blow on a Keeper (skills-100.md / campaign.md S3: maw clank, beast snarl, bone rattle, orc grunt, shade hiss). */
export const FAMILY_BITE: Readonly<Record<CreatureFamily, BiteCue>> = {
  maw: 'bite-maw', prism: 'bite-maw', orrery: 'bite-maw', graft: 'bite-maw',
  beast: 'bite-beast', wild: 'bite-beast', ember: 'bite-beast',
  bone: 'bite-bone',
  orc: 'bite-orc',
  shade: 'bite-shade',
};
/** The bite a creature's blow sounds (its family's). */
export function biteCueOf(creature: string): BiteCue {
  return FAMILY_BITE[creatureProfile(creature).family] ?? 'bite-beast';
}
/** Pitch by size: a big creature bites low, a small one high (semitones, from its height in px). */
export function bitePitch(h: number): number {
  return Math.max(-8, Math.min(5, Math.round((26 - h) / 4)));
}
