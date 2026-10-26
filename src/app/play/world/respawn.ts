/**
 * respawn.ts — how long a fallen creature of the room-run world rests before it rises again (Hearth protocol 9;
 * docs/design/online.md §4d "M3"). Owner, 2026-10-26: *"Monsters need to respawn at random times from like 1-1 min; if
 * it's a boss maybe like once an hour."* Pure data and one function: the room's MobSystem calls `respawnSecs` on every
 * fall (MobSystem.respawnOf), drawing from the room's seeded stream, so every spawn keeps its own clock.
 *
 * A solo screen (no room) keeps td-mobs' RESPAWN (75 s, inside the ordinary band).
 */

/** Seconds, [least, most]: each fall draws uniformly between them. */
export type RestBand = readonly [number, number];

export const RESPAWN_RULES: Readonly<{ normal: RestBand; elite: RestBand; boss: RestBand }> = {
  /** An ordinary creature: about a minute, each spawn independently (60–90 s). */
  normal: [60, 90],
  /** An elite pack's leader, a champion, a unique: three to five minutes. */
  elite: [180, 300],
  /** An area boss on its floor: about an hour, ±15 %. */
  boss: [51 * 60, 69 * 60],
};

/**
 * Bosses that stand in front of the story (a harbour gate, td-harbour GATES; the Sexton's Count): a Keeper who comes for
 * one must not wait an hour behind somebody else's kill. Ten minutes or so, still a wait worth a party.
 */
export const GATE_BOSS_REST: Readonly<Record<string, RestBand>> = {
  'ember-warden': [8 * 60, 12 * 60],
  'the-uncounted': [8 * 60, 12 * 60],
  'cinder-sovereign': [8 * 60, 12 * 60],
  'elder-rootwyrm': [8 * 60, 12 * 60],
};

/** What respawnSecs reads of a creature (td-mobs Mob). */
export interface RestingMob { def: { id: string; rank?: string }; elite?: { rank: string; role: string } | undefined }

/** The band a creature's spawn rests in. */
export function restBand(m: RestingMob): RestBand {
  if (m.def.rank === 'boss') return GATE_BOSS_REST[m.def.id] ?? RESPAWN_RULES.boss;
  const elite = m.elite && m.elite.role !== 'minion' && (m.elite.rank === 'champion' || m.elite.rank === 'unique');
  if (elite || m.def.rank === 'champion' || m.def.rank === 'unique') return RESPAWN_RULES.elite;
  return RESPAWN_RULES.normal;
}

/** Seconds until this creature's spawn rises again, drawn from `rng`. */
export function respawnSecs(m: RestingMob, rng: () => number): number {
  const [lo, hi] = restBand(m);
  return lo + (hi - lo) * rng();
}
