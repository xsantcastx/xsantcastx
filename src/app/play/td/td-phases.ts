/**
 * td-phases.ts — the world clock as a game rule (design-bible §5.2, roadmap §10 item 4).
 *
 * The sky (shared/world-clock skyAt) already turns day → dusk → night → dawn and, every fifth day, goes black at noon
 * for an eclipse. This file says what each part of the day *does* in the top-down world:
 *
 *  | Phase        | Spawns (the wilds only)                                   | Spells                   | XP · Gold  |
 *  |--------------|-----------------------------------------------------------|--------------------------|------------|
 *  | Day          | the drawn spawns                                          | Ember +10%               | —          |
 *  | Dawn / Dusk  | 1 in 4 spawns brings a second creature                    | —                        | —          |
 *  | Night        | night tables (1 in 3 of some creatures is a night-only    | Shadow +10%, Ember −10%  | +10% · +10%|
 *  |              | one), 2 in 5 bring a second, every creature ×1.2 life ×1.1 blow |                   |            |
 *  | Eclipse      | as night, and 1 in 8 creatures is **Eclipse-touched**      | Shadow +25%, Ember −15%  | +20% · +25%|
 *
 * "Ember" is the light side (the Warlock's fire; the Lanternwright's Lamp spells join it when that vocation lands),
 * "Shadow" the dark side (curses, wards, Drain Life, Doom). Bone is the dead's own and keeps no hour.
 *
 * Towns stay safe: none of this happens in a town, a village or the clear ground round them (TdWorld.safeAt), nor to a
 * boss or an authored champion. Spawn rules hold only under the open sky (the surface); spell strength follows the
 * sky everywhere (the sky goes on above a dungeon, and the Warlock feels it).
 *
 * Pure: numbers and seeded rolls. td-mobs.ts applies them, td-engine.ts hands it the phase, the HUD shows it.
 */
import { hashSeed, seededRandom } from '../../shared/loot/champions';
import { REAL_MS_PER_WORLD_MINUTE, nextEclipse, phaseAt, type SkyPhase } from '../../shared/world-clock/world-clock.model';
import type { TreeId } from './td-skills';

export interface PhaseRules {
  /** Chance a wild spawn brings a second creature beside it. */
  extra: number;
  /** Every wild creature's life and blow. */
  hp: number;
  dmg: number;
  /** Hunting XP and the Gold pile of a kill under this sky. */
  xp: number;
  gold: number;
  /** The night tables are out (NIGHT_TABLES). */
  night: boolean;
  /** Chance a wild creature comes up Eclipse-touched (an elite variant, td-elites.ts). */
  touched: number;
  /** Spell damage by tree. */
  spell: Readonly<Record<TreeId, number>>;
}

const SPELL_NONE = { ember: 1, bone: 1, shadow: 1 } as const;
const DUSK: PhaseRules = { extra: .25, hp: 1, dmg: 1, xp: 1, gold: 1, night: false, touched: 0, spell: SPELL_NONE };

export const PHASE_RULES: Readonly<Record<SkyPhase, PhaseRules>> = {
  day: { extra: 0, hp: 1, dmg: 1, xp: 1, gold: 1, night: false, touched: 0, spell: { ember: 1.1, bone: 1, shadow: 1 } },
  dawn: DUSK,
  dusk: DUSK,
  night: { extra: .4, hp: 1.2, dmg: 1.1, xp: 1.1, gold: 1.1, night: true, touched: 0, spell: { ember: .9, bone: 1, shadow: 1.1 } },
  eclipse: { extra: .4, hp: 1.2, dmg: 1.1, xp: 1.2, gold: 1.25, night: true, touched: 1 / 8, spell: { ember: .85, bone: 1, shadow: 1.25 } },
};

/** Of the spawns of a creature with a night table, this share are the night creature instead. */
export const NIGHT_SHARE = 1 / 3;

/**
 * The night tables: who comes out after dark in place of a day creature (by its id, so it holds on every continent it
 * lives on). Each night creature is a thing that already lives near by — the dead walk up out of the graveyards and
 * crypts, the fen's lights drift onto the land — at a level that suits the ground it walks.
 */
export const NIGHT_TABLES: Readonly<Record<string, readonly string[]>> = {
  // Ember Isle and the Reach's woods: the graveyard's dead walk the Emberwood.
  'ash-wolf': ['bone-walker'],
  // Infernal Reach: the Ashen Crypt's dead come up into the Charwood and the Badlands.
  'lava-hound': ['ash-ghoul'],
  'cinder-orc': ['cinder-wraith'],
  'orc-firecaller': ['bone-archer'],
  // The Verdant Wilds: the Root Hollows' gnawers and the spore-caps leave the dark under the roots.
  'moss-stalker': ['rootgnaw'],
  'vine-lasher': ['sporecap'],
  // The Umbral Marches: lantern-light walks the fen; the drowned abbey's acolytes wade out.
  'mire-lurker': ['lantern-wisp'],
  'ink-hound': ['drowned-acolyte'],
};

/** How long before an eclipse the HUD warns of it (in-game minutes = real seconds). */
export const WARN_MINUTES = 30;

/** The phase a pinned hour (the engine's `?hour=`) stands for: the clock's own boundaries. */
export function phaseOfHour(h: number): SkyPhase { return phaseAt(Math.round(h * 60)); }

/** Is this a phase with any rules at all (for the HUD and the Spellbook)? */
export function rulesOf(phase: SkyPhase): PhaseRules { return PHASE_RULES[phase] ?? PHASE_RULES.day; }

/** A spawn's own rolls under a sky, all from one seed (its key, its deaths, the session salt). */
function rng(seed: string, what: string): () => number { return seededRandom(hashSeed(`phase|${what}|${seed}`)); }

/** The creature a spawn of `type` brings out under `phase`: a night creature now and then after dark, else itself. */
export function nightType(type: string, seed: string, phase: SkyPhase): string {
  const table = NIGHT_TABLES[type];
  if (!rulesOf(phase).night || !table?.length) return type;
  const r = rng(seed, 'night');
  if (r() >= NIGHT_SHARE) return type;
  return table[Math.floor(r() * table.length)];
}

/** Does this spawn bring a second creature beside it under `phase`? */
export function extraSpawn(seed: string, phase: SkyPhase): boolean { return rng(seed, 'extra')() < rulesOf(phase).extra; }

/** Is this creature Eclipse-touched (1 in 8, under an eclipse only)? */
export function rollTouched(seed: string, phase: SkyPhase): boolean { return rng(seed, 'touched')() < rulesOf(phase).touched; }

/** The seeded source for the touched creature's one extra affix. */
export function touchedRandom(seed: string): () => number { return rng(seed, 'touched-affix'); }

/** A creature under `phase`: night's life and blow (a fresh copy; never the shared MOBS record). */
export function hardened<T extends { hp: number; dmg: readonly [number, number] | [number, number] }>(def: T, phase: SkyPhase): T {
  const r = rulesOf(phase);
  if (r.hp === 1 && r.dmg === 1) return def;
  const lo = Math.max(1, Math.round(def.dmg[0] * r.dmg)), hi = Math.max(lo, Math.round(def.dmg[1] * r.dmg));
  return { ...def, hp: Math.round(def.hp * r.hp), dmg: [lo, hi] };
}

/** A spell tree's damage under `phase` (1 = as written). */
export function spellMult(tree: TreeId, phase: SkyPhase): number { return rulesOf(phase).spell[tree] ?? 1; }

/** In-game minutes until the next eclipse when it is within WARN_MINUTES (and not yet on), else null. */
export function eclipseWarning(ms: number): number | null {
  const w = nextEclipse(ms);
  if (ms >= w.startMs) return null;
  const left = Math.ceil((w.startMs - ms) / REAL_MS_PER_WORLD_MINUTE);
  return left <= WARN_MINUTES ? left : null;
}
