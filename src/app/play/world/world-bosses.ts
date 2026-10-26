/**
 * world-bosses.ts — the room-run world's world bosses (Hearth protocol 9; docs/design/online.md §4d "M3"). Owner,
 * 2026-10-26: *"if it's a boss maybe like once an hour depending on which world boss it is… like Ragnarok, people find
 * these bosses for some OP items."*
 *
 * A world boss is rare: it rises on a long timer of hours (each its own `every`), somewhere in its zone (a random spot
 * in one of its regions, never in a town's safety or at a dungeon's door), the whole world hears an omen line when it
 * does, and it stays until it falls or its `stay` runs out. It is a named unique leader of an existing creature (its
 * art, its moves) with its own life, blows and pack; its fall rolls the elite's loot, `rolls` more pieces, and — at
 * `chance` — one of its own uniques, at that unique's authored rarity. Every number lives here, per boss; the room
 * (room-world.ts) only reads it. Canon: docs/world/canon.md §5.6 (world bosses).
 */
import type { EliteAffix } from '../td/td-elites';
import type { Region } from '../td/continent';

export interface WorldBossDef {
  id: string;
  /** Its name over its head (the elite's name plate) and in the omen. */
  name: string;
  /** The area it rises in: a continent's id (its surface). */
  area: string;
  /** Which of the continent's regions it walks (td-world regionAt). */
  regions: readonly Region[];
  /** The creature it is (td-mobs MOBS id): its picture, its moves, its kind. */
  base: string;
  level: number;
  /** × the life the creature would have as a unique leader at `level`; × its blows. */
  life: number;
  blows: number;
  affixes: readonly EliteAffix[];
  /** Its pack: minions of its own kind beside it. */
  followers: number;
  /** Hours between one fall (or leaving) and the next rising, [least, most]. */
  every: readonly [number, number];
  /** Hours it waits to be found before it leaves unfelled. */
  stay: number;
  /** Its own loot: `rolls` more gear rolls on its fall, and at `chance` one of `uniques` (unique-items ids). */
  loot: { rolls: number; chance: number; uniques: readonly string[] };
}

export const WORLD_BOSSES: readonly WorldBossDef[] = [
  {
    id: 'old-greymaw', name: 'Old Greymaw', area: 'ember-isle', regions: ['F', 'f'], base: 'ash-wolf', level: 12,
    life: 6, blows: 1.4, affixes: ['extra-fast', 'cursed'], followers: 3, every: [3, 5], stay: 2,
    loot: { rolls: 3, chance: .5, uniques: ['unique-cinderwake', 'unique-mourners-ledger', 'unique-quiet-cuirass'] },
  },
  {
    id: 'gharak-emberjaw', name: 'Gharak Emberjaw', area: 'infernal-reach', regions: ['h', 'F'], base: 'orc-warlord', level: 32,
    life: 6, blows: 1.35, affixes: ['extra-strong', 'fire-enchanted'], followers: 3, every: [4, 6], stay: 2,
    loot: { rolls: 4, chance: .45, uniques: ['unique-goldmouth', 'unique-ashen-covenant', 'unique-pyrograph-scroll-case'] },
  },
  {
    id: 'the-copied-hart', name: 'The Copied Hart', area: 'verdant-wilds', regions: ['J'], base: 'rootglass-hart', level: 42,
    life: 6, blows: 1.35, affixes: ['teleport', 'stone-skin'], followers: 2, every: [5, 7], stay: 2,
    loot: { rolls: 4, chance: .4, uniques: ['unique-heartwood-of-the-verge', 'unique-spore-crown', 'unique-thornroot-greaves'] },
  },
  {
    id: 'ser-wickless', name: 'Ser Wickless', area: 'umbral-marches', regions: ['x', 'Q'], base: 'drowned-knight', level: 55,
    life: 6, blows: 1.35, affixes: ['spectral-hit', 'cold-aura'], followers: 3, every: [6, 8], stay: 2,
    loot: { rolls: 5, chance: .4, uniques: ['unique-mirror-of-small-mercies', 'unique-lastwarden', 'unique-shadowloom'] },
  },
];

/** A world boss's spawn key (td-mobs `Mob.key`): its kill reads `td:surface:wb:<id>:…`, which the room's loot knows. */
export const WORLD_BOSS_KEY = (id: string): string => `wb:${id}`;
export function worldBossOfKey(key: string): WorldBossDef | null {
  const m = /(?:^|:)wb:([a-z0-9-]+)(?::|$)/.exec(key);
  return m ? WORLD_BOSSES.find(b => b.id === m[1]) ?? null : null;
}
export function worldBossesIn(area: string): WorldBossDef[] { return WORLD_BOSSES.filter(b => b.area === area); }

/** One world boss's clock, as an area keeps it across a sleep (epoch ms). */
export interface WorldBossClock {
  /** When it rises next (it is not up). */
  next: number;
  /** It is up: when it leaves unfelled, and where it stands. */
  up?: { until: number; x: number; y: number };
}

const H = 3600000;
/** When it rises next, after a fall or a leaving at `from`. */
export function nextRising(b: WorldBossDef, from: number, rng: () => number): number {
  return Math.round(from + (b.every[0] + (b.every[1] - b.every[0]) * rng()) * H);
}
/** The first clock of a boss nobody has seen yet: somewhere inside its first span, so the four never rise together. */
export function firstRising(b: WorldBossDef, now: number, rng: () => number): number {
  return Math.round(now + b.every[1] * H * rng());
}
/**
 * The clock fast-forwarded to `now` (a woken room: the hours it slept went by as if it had been awake). A rising that
 * came and went unseen while it slept is skipped (it rose, waited its `stay`, and left); a rising due now and still
 * within its stay is due at once.
 */
export function fastForward(b: WorldBossDef, c: WorldBossClock, now: number, rng: () => number): WorldBossClock {
  if (c.up && c.up.until > now) return c;
  let next = c.up ? nextRising(b, c.up.until, rng) : c.next;
  for (let i = 0; i < 1000 && next + b.stay * H <= now; i++) next = nextRising(b, next + b.stay * H, rng);
  return { next };
}

/** The omen and fall lines, by boss (LAZY i18n: world-bosses.i18n.ts). */
export const omenKey = (id: string, at: 'rise' | 'fall' | 'gone'): string => `play.worldBoss.${id}.${at}`;
