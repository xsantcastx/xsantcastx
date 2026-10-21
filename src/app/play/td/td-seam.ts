/**
 * td-seam.ts — the Seam Eater's second rising: the eclipse world boss (design-bible §3.3 "a recurring eclipse event",
 * §5.2; docs/design/loot-and-combat.md §8 and §10).
 *
 * Under an eclipse, on the surface, a tear opens at each continent's rift — its standing stones (Ember Isle's Ninefold
 * Stones, just past the square's south road, are the starter town's outskirts) — and the Seam Eater climbs out of it
 * when a Keeper comes near. It is never in a town's safe ground (the rift is checked, and it will not step onto it),
 * it leaves when the eclipse ends if no one fells it, and its first fall on Normal opens Nightmare (a later fall on
 * Nightmare opens Hell: shared/loot/difficulty.model unlockedBy). It is the top-down gate boss §8 was missing.
 *
 * The fight (td-mobs.ts runs it; the numbers are here so the specs and the Bestiary read one place):
 *  - **Void Breath** (`ul nyr sha`, "the seam, the unseen, one way"): it winds up (BOSS_TELL) and breathes a fan of
 *    void at where the Keeper stood; the stepped cone on the ground is the tell.
 *  - **Seam Rend** (`ul dra`, "the seam, from above"): rings open on the ground round the Keeper and burst after
 *    REND_TELL; step out of them.
 *  - At half its life (`ul teth`, "the seam, calling") two Eclipse-touched creatures climb out beside it, and the
 *    fight quickens: a wider breath, more rings, both sooner.
 *
 * Its level follows the Keeper's inside the band (SEAM_BAND, 20–60): a Keeper below it meets the level-20 Eater (a
 * world boss to run from, which is what Glim says); above it, the level-60 one. Pure: no DOM.
 */
import type { ContinentDef } from './continent';
import type { MobDef } from './td-mobs';
import { CREATURE_LIFE } from './td-life';

/** The creature's id (the side view's Act I warden keeps 'seam-eater'; this is its second rising). */
export const SEAM_ID = 'seam-eater-risen';
/** The level band it scales inside. */
export const SEAM_BAND = { min: 20, max: 60 } as const;
/** The Seam-Cant it speaks before each attack (design-bible §4.0: ul the seam, nyr the unseen, -sha one way, -dra from above, -teth calling). */
export const SEAM_CANT = { breath: 'ul nyr sha', rend: 'ul dra', call: 'ul teth' } as const;
/** Seconds a Rend's rings show on the ground before they burst. */
export const REND_TELL = 1;
/** A Rend ring's reach (art px) and how far round the Keeper the outer rings open. */
export const REND_R = 20;
export const REND_SPREAD = 34;
/** It wakes when the Keeper comes within this many tiles of the rift. */
export const SEAM_WAKE = 30;
/** It never chases further than this many tiles from the rift; past it, it goes back to the tear. */
export const SEAM_LEASH = 14;
/** Before half life, and after (the second phase). */
export const SEAM_PHASES = {
  one: { spread: 5, rate: 4, rings: 3, rendRate: 6 },
  two: { spread: 7, rate: 3.2, rings: 5, rendRate: 4.5 },
} as const;
/** The world boss's life over a floor boss's (td-life CREATURE_LIFE.boss): its fight is minutes, a floor boss's one or two. */
export const SEAM_LIFE = 1.25;
/** How much more life the Eater takes on from 40 to 60 (on top of its curve). */
export const SEAM_LATE = .5;
/**
 * The two Eclipse-touched creatures it calls at half life, by its level: never above it (combat-sim: a level-20 Eater
 * calling two level-28 Lantern Wisps as champions felled half the Keepers who met it) — the Cinder Wraith (12) under
 * 28, then the shade-kin of the fens.
 */
export function seamCall(level: number): string {
  return level < 28 ? 'cinder-wraith' : level < 32 ? 'lantern-wisp' : level < 40 ? 'ink-hound' : 'drowned-knight';
}

/** The Eater's level for a Keeper of `keeperLevel`: his own, held inside the band. */
export function seamLevel(keeperLevel: number): number {
  const k = Number.isFinite(keeperLevel) ? Math.round(keeperLevel) : SEAM_BAND.min;
  return Math.max(SEAM_BAND.min, Math.min(SEAM_BAND.max, k));
}

/** Its numbers at a level (the band's curve; td-mobs MOBS[SEAM_ID] is the level-20 one, for the Bestiary). */
export function seamStats(level: number): {
  hp: number; dmg: [number, number]; breath: [number, number]; rend: [number, number];
} {
  const L = seamLevel(level);
  // 1.3× the deep bosses' authored life curve (the Ashbone Dragon 2200 at 25 … the Ink Abbess 7200 at 50), risen as
  // every boss rises (td-life CREATURE_LIFE.boss) and SEAM_LIFE again: a world boss, a few minutes' fight. Past 40 it
  // climbs a further half by 60 (SEAM_LATE): the Keeper's damage outgrows a straight line, the Eater's must too.
  const late = 1 + SEAM_LATE * Math.max(0, L - 40) / 20;
  const hp = Math.round(1.3 * (200 * L - 2800) * CREATURE_LIFE.boss * SEAM_LIFE * late / 10) * 10;
  return {
    hp,
    // Its blows were 0.9L–1.3L, its breath 0.6L–0.9L and its Rend 1.0L–1.4L; at a few minutes' fight that felled half
    // the ranged Keepers at 20–30 (combat-sim), so each is a sixth softer.
    dmg: [Math.round(.75 * L), Math.round(1.1 * L)],
    breath: [Math.round(.5 * L), Math.round(.75 * L)],
    rend: [Math.round(.85 * L), Math.round(1.15 * L)],
  };
}

/** The Eater at `level`: a fresh MobDef off the base (MOBS[SEAM_ID]), every number from seamStats. */
export function seamEaterAt(base: MobDef, level: number): MobDef {
  const L = seamLevel(level), s = seamStats(L);
  return {
    ...base, level: L, hp: s.hp, dmg: s.dmg,
    ranged: { ...base.ranged!, dmg: s.breath, spread: SEAM_PHASES.one.spread, rate: SEAM_PHASES.one.rate },
    rend: { ...base.rend!, dmg: s.rend, rings: SEAM_PHASES.one.rings, rate: SEAM_PHASES.one.rendRate },
    summon: { type: seamCall(L), count: 2, at: .5, touched: true },
  };
}

/** Does the Eater rise now? Under an eclipse, on the surface, not felled this eclipse, not already up. */
export function seamRises(o: { phase: string; surface: boolean; slain: boolean; up: boolean; dist: number }): boolean {
  return o.phase === 'eclipse' && o.surface && !o.slain && !o.up && o.dist <= SEAM_WAKE;
}
/** Does a risen Eater leave (the eclipse is over)? */
export function seamLeaves(phase: string): boolean { return phase !== 'eclipse'; }

/** Each continent's rift: its standing stones (a fixed spot per continent). */
export function riftPlace(def: Pick<ContinentDef, 'places'>): { c: number; r: number; name: string } | null {
  const p = def.places.find(q => q.kind === 'standing-stones');
  return p ? { c: p.c, r: p.r, name: p.name } : null;
}

/**
 * The tile the tear opens on: the nearest open ground a few steps south of the stones (never on them), clear round
 * (the Eater is wide) and never in a town's safe ground. Null when there is none (it never rises there).
 */
export function riftTile(world: { walkable(c: number, r: number): boolean; safeAt(c: number, r: number): boolean }, at: { c: number; r: number }): { c: number; r: number } | null {
  const clear = (c: number, r: number) => {
    for (let dr = -3; dr <= 1; dr++) for (let dc = -3; dc <= 3; dc++) if (!world.walkable(c + dc, r + dr) || world.safeAt(c + dc, r + dr)) return false;
    return true;
  };
  for (let rad = 4; rad <= 16; rad++) {
    for (let k = 0; k < 32; k++) {
      const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 16;
      const c = at.c + Math.round(Math.cos(a) * rad), r = at.r + Math.round(Math.sin(a) * rad);
      if (clear(c, r)) return { c, r };
    }
  }
  return null;
}
