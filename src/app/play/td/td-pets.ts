/**
 * td-pets.ts — the companions in the top-down world (owner, 2026-10-20: "fix the pets, they should follow and help and
 * pick up stuff and idle cute, same for Glim — we need these to be important as well").
 *
 * THE PET (the one following, shared/pets): it walks with the Keeper on a leash (his breadcrumbs round corners, never
 * blocking a doorway — the Keeper's feet ignore it), steps out at his side after a level change, and idles cute when he
 * stands still (sits, looks round, wags, then naps). Each pet has ONE clear job in this world (TD_PET_JOB), and the
 * pet card's command still rules it (pet-roles.ts): Stay sits, Play plays, Fight makes every pet nip, Gather makes
 * every pet fetch.
 *   fetch  carries gear, potions and materials lying near the Keeper back to his feet, where his own pick-up takes
 *          them (the same path as walking over it, so the Satchel, its limits and the loot filter all apply);
 *   fight  nips the Keeper's target (the pet-roles bite / dash / chomp sizes: a few a second next to his ~38), backs
 *          off a boss's tell, and when a snap back tires it, rests behind him a moment — it never dies;
 *   mend   in a fight, a small pulse of life when he is under 70 % (PET_ACT.pulse*);
 *   light  a small light of its own in the dark.
 *
 * GLIM (glimPointer and TdGlim in td-engine): lights the dark wider than the Keeper's own, points out what is worth
 * finding nearby (a drop left lying, an ore seam, a way not yet taken) with a hop and a sparkle, flashes at a boss's
 * tell, cheers level-ups and rare drops, and has idle moods (orbit, doze, a curious dart).
 *
 * Pure: no DOM. The engine draws (td-pet-art.ts) and books (EngineOptions.onPet / onGlimCue).
 */
import { TILE } from './td-art';
import type { Drop, Mob } from './td-mobs';
import { PET_ACT, moveDamage, moveRest, nipDamage, type PetCommand, type PetMove } from '../../shared/pets/pet-roles';
import { shownUnderFilter, type LootFilter } from '../../shared/loot/loot-tiers';
import type { PetId } from '../../shared/pets/pets.model';

export type TdPetJob = 'fetch' | 'fight' | 'mend' | 'light';
/** One job each in the top-down world (from its pets.model ability and pet-roles role). */
export const TD_PET_JOB: Readonly<Record<PetId, TdPetJob>> = {
  'rivet-hatchling': 'fetch', 'moss-hedgehog': 'fetch', 'star-owlet': 'fetch',
  'ink-pup': 'fight', 'shade-kit': 'fight',
  'sunling': 'mend',
  'ember-newt': 'light', 'prism-mothkit': 'light',
};
/** Fliers hover a little over the ground (their shadow stays on it). */
export const TD_PET_FLIES: ReadonlySet<string> = new Set(['prism-mothkit', 'sunling']);

/** What the pet is doing (the HUD chip and data-pet-state). */
export type TdPetDoing = 'follow' | 'sit' | 'sleep' | 'fetch' | 'carry' | 'fight' | 'rest' | 'stay' | 'play' | 'mend';

/** Every number the companions use (art px; the Keeper walks at 74 px/s, one tile is 16). */
export const TD_PET = {
  /** Its trot, and the extra when it has fallen behind. */
  speed: 82, catchUp: 1.7,
  /** Past this from the Keeper it steps out at his side (a wall between, a long run). */
  leash: 11 * TILE,
  /** Seconds of the Keeper standing still before it sits, then naps. */
  sitAfter: 1.2, sleepAfter: 22,
  /** fetch: how far from the Keeper a drop is fetched (a fetcher, and any pet told to Gather). */
  fetchReach: 8 * TILE, gatherReach: 5 * TILE,
  /** Coins already fly to the Keeper inside this (td-mobs); only further ones are fetched. */
  coinPull: 8 * TILE,
  /** fight: a foe this close to the Keeper is worth a nip; the bite's reach. */
  engage: 7 * TILE, reach: 14,
  /** A boss winding up within this: every pet keeps behind the Keeper. */
  tellWatch: 14 * TILE,
  /** A snap back tires it; a tired pet rests this long behind the Keeper (never dies). */
  restFor: 10,
  /** Gives up on a drop it cannot reach after this long (a wall between). */
  fetchGiveUp: 4,
  /** light: its own light's radius in the dark. */
  light: 84,
} as const;

export const GLIM_TD = {
  /** Its light in the dark, wider than the Keeper's (70), and wider still with its lamp (the bond) when he holds still. */
  light: 112, lampLight: 150,
  /** It points out something worth finding within this, no more often than this (s). */
  pointReach: 13 * TILE, pointGap: 14,
  /** Seconds of the Keeper still before it orbits, then dozes. */
  orbitAfter: 3, dozeAfter: 30,
} as const;

/** The job a pet does under a command (Stay / Play do none; Fight and Gather bring every pet). */
export function tdPetJob(id: string, command: PetCommand): TdPetJob | 'stay' | 'play' {
  if (command === 'stay' || command === 'play') return command;
  if (command === 'fight') return 'fight';
  if (command === 'gather') return 'fetch';
  return (TD_PET_JOB as Record<string, TdPetJob>)[id] ?? 'fetch';
}

/** Where a following pet stands: a step behind and to the side of the Keeper. */
export function followSpot(k: { x: number; y: number; face: number }): { x: number; y: number } {
  return { x: k.x - k.face * 15, y: k.y + 4 };
}

/** Past the leash: it should step out at the Keeper's side. */
export function pastLeash(pet: { x: number; y: number }, k: { x: number; y: number }, leash: number = TD_PET.leash): boolean {
  return !Number.isFinite(pet.x) || Math.hypot(pet.x - k.x, pet.y - k.y) > leash;
}

/** May a pet carry this drop? Gear and runes only when the loot filter shows them; potions, materials and far coins always. */
export function fetchable(g: Drop, filter: LootFilter): boolean {
  // The room's ground (protocol 7) is taken where the room sees it lie, by the Keeper himself: a pet never carries it.
  if (g.room) return false;
  if (g.item || g.rune) return shownUnderFilter(g.rarity ?? g.item?.rarity, filter);
  return g.coins > 0 || !!g.material;
}

/**
 * The drop a pet goes for: the nearest to the Keeper within `reach` that has landed, that he is not already standing
 * on, that the filter shows, and that it has not given up on. Coins inside the Keeper's own pull are left to fly.
 */
export function pickFetchTarget(k: { x: number; y: number }, drops: readonly Drop[], reach: number, filter: LootFilter, skip: ReadonlySet<string> = new Set()): Drop | null {
  let best: Drop | null = null, bd = reach;
  for (const g of drops) {
    if (g.age < .6 || skip.has(g.id) || !fetchable(g, filter)) continue;
    const d = Math.hypot(g.x - k.x, g.y - k.y);
    if (d < 26 || d > bd) continue;
    if (g.coins > 0 && d <= TD_PET.coinPull) continue;
    bd = d; best = g;
  }
  return best;
}

/** A boss winding up near the Keeper (its tell): every pet keeps behind him. */
export function bossTelling(k: { x: number; y: number }, mobs: readonly Mob[], within: number = TD_PET.tellWatch): Mob | null {
  for (const m of mobs) if (m.hp > 0 && m.tell > 0 && (m.def.rank === 'boss' || m.def.rank === 'champion') && Math.hypot(m.x - k.x, m.y - k.y) <= within) return m;
  return null;
}

/**
 * The foe a pet nips: the Keeper's own target while it is near him, else the nearest foe already at his side. Never one
 * winding up a tell, never one out past the engage range (it stays by the Keeper).
 */
export function pickNipTarget(k: { x: number; y: number }, target: Mob | null, mobs: readonly Mob[], engage: number = TD_PET.engage, near: number = 3 * TILE, sees?: (m: Mob) => boolean): Mob | null {
  const ok = (m: Mob) => m.hp > 0 && m.tell <= 0 && Math.hypot(m.x - k.x, m.y - k.y) <= engage;
  if (target && mobs.includes(target) && ok(target)) return target;
  let best: Mob | null = null, bd = near;
  for (const m of mobs) {
    if (!ok(m)) continue;
    const d = Math.hypot(m.x - k.x, m.y - k.y);
    if (d <= bd && (!sees || sees(m))) { bd = d; best = m; }
  }
  return best;
}

/** A pet's blow: its move's size (combat pets), a nip for the others told to Fight; and the rest between blows. */
export function petBlow(move: PetMove, combat: boolean, level: number): { dmg: number; rest: number } {
  if (combat && move !== 'pulse') return { dmg: moveDamage(move, level), rest: moveRest(move) };
  return { dmg: nipDamage(level), rest: PET_ACT.biteRest };
}

/** The mend's pulse: when the Keeper is under PET_ACT.pulseBelow in a fight, this much life back. 0 = not now. */
export function mendPulse(hp: number, maxHp: number, inFight: boolean): number {
  if (!inFight || maxHp <= 0 || hp <= 0 || hp >= maxHp * PET_ACT.pulseBelow) return 0;
  return Math.max(1, Math.round(maxHp * PET_ACT.pulseShare));
}

/** How the pet idles while the Keeper stands still (s): following until it sits, napping after a long while. */
export function idlePose(still: number): 'follow' | 'sit' | 'sleep' {
  return still >= TD_PET.sleepAfter ? 'sleep' : still >= TD_PET.sitAfter ? 'sit' : 'follow';
}

// ── Glim's pointer ───────────────────────────────────────────────────────────────────────────────────────────────

export type GlimSpotKind = 'drop' | 'ore' | 'way';
export interface GlimSpot { id: string; kind: GlimSpotKind; x: number; y: number }
/** How keen Glim is on each kind (a smaller weight is pointed out first at the same distance). */
const SPOT_WEIGHT: Readonly<Record<GlimSpotKind, number>> = { drop: .6, way: .9, ore: 1 };

/**
 * What Glim points out: the nearest spot (weighted: a drop left lying first, then a way not yet taken, then ore) within
 * `reach` of the Keeper that it has not pointed at before and that he is not already standing at.
 */
export function glimPointer(k: { x: number; y: number }, spots: readonly GlimSpot[], told: ReadonlySet<string>, reach: number = GLIM_TD.pointReach): GlimSpot | null {
  let best: GlimSpot | null = null, bd = Infinity;
  for (const s of spots) {
    if (told.has(s.id)) continue;
    const d = Math.hypot(s.x - k.x, s.y - k.y);
    if (d < 36 || d > reach) continue;
    const w = d * SPOT_WEIGHT[s.kind];
    if (w < bd) { bd = w; best = s; }
  }
  return best;
}

/** Glim's idle mood by the Keeper's stillness: at his shoulder, orbiting him, dozing. */
export function glimIdle(still: number): 'shoulder' | 'orbit' | 'doze' {
  return still >= GLIM_TD.dozeAfter ? 'doze' : still >= GLIM_TD.orbitAfter ? 'orbit' : 'shoulder';
}
