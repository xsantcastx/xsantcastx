/**
 * td-thorn.ts — the Thornstrider's arithmetic (design-bible §4.5), pure so the specs can hold it still.
 *
 * The bow: an arrow may **pierce** (a roll against its chance; what flies on keeps PIERCE_KEEP of its blow) and it
 * **knocks back** the foe it strikes (a boss a fifth as far, as every crowd control). A Barbed Shot leaves a **bleed**:
 * a whole number a second for its seconds; a second barb never stacks, it keeps the longer and the harder of the two.
 * A Thornroot Snare or a Bramble Trap **roots**: the creature stands where it is (it still bites what is in reach), a
 * boss a fifth as long (td-melee ccSecs).
 *
 * The pet is the core: whatever pet follows a Thornstrider fights harder — its bite grows with the Keeper's level and
 * with the class's bond (THORN_PET.bond), then with Pack Bond, Wild Heart and Command (their % added together) — and
 * bites more often. Pack Bond shares the blows: the Keeper and the beast both take its % less while the beast is near.
 * With no pet at all a spirit beast stands in (spiritLevel).
 */
import { BOSS_CC } from './td-melee';
import { PET_LEVEL_MAX } from '../../shared/pets/pet-roles';

/** The pet of a Thornstrider (one place; the sim and the specs read it). */
export const THORN_PET = {
  /** The class's own bond: every blow of the beast this much harder before any skill (+50%). */
  bond: .5,
  /** Its bite grows with the Keeper: this much a level above the first. */
  perLevel: .5,
  /** It bites this much more often (its rest × this), and on a commanded foe more often still. */
  rest: .75, commandRest: .6,
  /** How far it runs for a commanded foe (art px from the Keeper). */
  commandReach: 10 * 16,
} as const;

/** What flies on after a pierce keeps this share of the blow. */
export const PIERCE_KEEP = .8;
/** An arrow strikes at most this many foes (the first and its pierces). */
export const PIERCE_MAX = 3;

/** A Thornstrider's beast's blow: its own `raw` size, the Keeper's level, the class's bond and the skills' %. */
export function thornPetBlow(raw: number, o: { level: number; pct: number }): number {
  const base = Math.max(0, raw) + Math.max(0, Math.floor(o.level) - 1) * THORN_PET.perLevel;
  return Math.max(1, Math.round(base * (1 + THORN_PET.bond) * (1 + Math.max(0, o.pct) / 100)));
}
/** The beast's rest between blows under a Thornstrider (commanded: shorter still). */
export function thornPetRest(rest: number, commanded: boolean): number {
  return Math.round(rest * THORN_PET.rest * (commanded ? THORN_PET.commandRest : 1) * 100) / 100;
}

/** Pack Bond: a blow `n` shared out — what still lands on the one who took it (never below 1, nothing stays nothing). */
export function bondShare(n: number, guard: number): number {
  if (!(n > 0)) return 0;
  return Math.max(1, Math.round(n * (1 - Math.max(0, Math.min(90, guard)) / 100)));
}

/** Does an arrow pierce? `roll` in [0, 1). */
export function pierces(chance: number, roll: number): boolean { return roll * 100 < Math.max(0, chance); }

/** How far a blow knocks a creature back (art px): `tiles` of 16, a boss a fifth of it. */
export function knockFor(tiles: number, rank: string | undefined): number {
  const px = Math.max(0, tiles) * 16;
  return rank === 'boss' ? Math.round(px * BOSS_CC * 10) / 10 : px;
}

/** A bleed on a creature: seconds left and the whole life it loses each second. */
export interface Bleed { t: number; dps: number }
/** A second barb on a bleeding foe: never a stack — the longer of the two times, the harder of the two bleeds. */
export function addBleed(cur: Bleed | null | undefined, dps: number, secs: number): Bleed {
  const d = Math.max(0, Math.round(dps)), s = Math.max(0, secs);
  if (!cur || cur.t <= 0) return { t: s, dps: d };
  return { t: Math.max(cur.t, s), dps: Math.max(cur.dps, d) };
}
/** All a fresh bleed takes over its life (whole ticks once a second). */
export function bleedTotal(dps: number, secs: number): number { return Math.max(0, Math.round(dps)) * Math.max(0, Math.floor(secs + 1e-9)); }

/** Where the arrows of a fan leave: `n` angles (radians) round `aim`, `spreadDeg` apart, the middle one on the aim. */
export function fanAngles(aim: number, n: number, spreadDeg = 12): number[] {
  const k = Math.max(1, Math.floor(n)), step = spreadDeg * Math.PI / 180;
  return Array.from({ length: k }, (_, i) => aim + (i - (k - 1) / 2) * step);
}

/** The lanes of a stampede: `n` offsets (art px) across its line, `gap` apart, centred on it. */
export function stampedeLanes(n: number, gap = 12): number[] {
  const k = Math.max(1, Math.floor(n));
  return Array.from({ length: k }, (_, i) => (i - (k - 1) / 2) * gap);
}

/** The spirit beast that stands in when a Thornstrider has no pet: its level grows with the Keeper's (1–5). */
export function spiritLevel(keeperLevel: number): number { return Math.max(1, Math.min(PET_LEVEL_MAX, 1 + Math.floor(Math.max(0, keeperLevel) / 8))); }
/** The spirit beast's id (its pixel art in td-pet-art, its name in td-thorn.i18n). */
export const SPIRIT_BEAST = 'spirit-beast';
