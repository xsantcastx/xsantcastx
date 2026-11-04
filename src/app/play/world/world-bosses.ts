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
  loot: { rolls: number; chance: number; uniques: readonly string[]; mats?: readonly { material: string; qty: number }[] };
  /**
   * S10 (monsters-abilities §6): a weather-born party boss. It rises only while its land's weather is `weather`, at its
   * landmark `at` (tiles), with its party form (td-party-boss PARTY_FORMS[form]); it leaves with the weather unfelled;
   * once felled it cannot rise again in this world for `cooldown` real hours (`every` and `stay` unused).
   */
  weather?: { land: string; region: string; state: string };
  at?: { c: number; r: number };
  form?: string;
  cooldown?: number;
  /** Its own name (a formed boss is not an elite leader: its def carries it). */
  rank?: 'boss';
  /** Where it stands, as its unique's card names it ("Found in"). */
  lair?: string;
  /** Drawn this many times its creature's size (an integer, nearest-neighbour: a world boss reads as one). */
  scale?: number;
  /** S10b: it rises only at night (the Last Siege's ashfall nights, the Fogmother's foggy ones). */
  night?: boolean;
  /** S10b: its own body (td-mobs BOSS_LOOKS: the siege tower, the Fogmother), drawn in place of its creature's. */
  look?: string;
  /**
   * S10b: it rolls this track (tiles; the Last Siege): it rises at the first point, never turns or chases, rolls a tile
   * every few seconds (its form's phase `step`), and at the last point it stops and leaves unfelled (`exit` its line).
   */
  track?: readonly { c: number; r: number }[];
  /**
   * S10b: the lantern posts round its arena (tiles; the Fogmother's three). All lit before it rises and it does not
   * rise that night (the posts stay lit until dawn); lit in the fight, each is a light it will not stand in.
   */
  posts?: readonly { c: number; r: number }[];
}

export const WORLD_BOSSES: readonly WorldBossDef[] = [
  {
    id: 'old-greymaw', name: 'Old Greymaw', area: 'ember-isle', regions: ['F', 'f'], base: 'ash-wolf', level: 12,
    life: 6, blows: 1.4, affixes: ['extra-fast', 'cursed'], followers: 3, every: [3, 5], stay: 2,
    loot: { rolls: 3, chance: .5, uniques: ['unique-cinderwake', 'unique-mourners-ledger', 'unique-quiet-cuirass'] },
  },
  {
    id: 'gharak-emberjaw', name: 'Gharak Emberjaw', area: 'infernal-reach-badlands', regions: ['h'], base: 'orc-warlord', level: 32,
    life: 6, blows: 1.35, affixes: ['extra-strong', 'fire-enchanted'], followers: 3, every: [4, 6], stay: 2,
    loot: { rolls: 4, chance: .45, uniques: ['unique-goldmouth', 'unique-ashen-covenant', 'unique-pyrograph-scroll-case'] },
  },
  {
    id: 'the-copied-hart', name: 'The Copied Hart', area: 'verdant-wilds-deep-wilds', regions: ['J'], base: 'rootglass-hart', level: 42,
    life: 6, blows: 1.35, affixes: ['teleport', 'stone-skin'], followers: 2, every: [5, 7], stay: 2,
    loot: { rolls: 4, chance: .4, uniques: ['unique-heartwood-of-the-verge', 'unique-spore-crown', 'unique-thornroot-greaves'] },
  },
  {
    // S10, §6.3: the oldest Rootglass Hart, struck under the Storm-Struck Oak by the first thunderstorm after the Lock.
    // It rises with a Greenwood thunderstorm at the Oak (wilds-sections STORM_OAK_AT, 'storm-oak'), a party boss of four.
    id: 'antlered-storm', name: 'The Antlered Storm', area: 'verdant-wilds-greenwood', regions: ['j'], base: 'rootglass-hart', level: 42,
    life: 125, blows: 4.2, affixes: [], followers: 0, every: [2, 2], stay: 0.1,
    loot: { rolls: 3, chance: .1, uniques: ['unique-crown-of-the-antlered-storm'], mats: [{ material: 'verdant-sap', qty: 4 }, { material: 'world-root-bark', qty: 3 }] },
    weather: { land: 'verdant-wilds', region: 'j', state: 'storm' }, at: { c: -10, r: -112 }, form: 'antlered-storm', cooldown: 2, rank: 'boss', scale: 3, lair: 'the Storm-Struck Oak, the Greenwood (thunderstorms)',
  },
  {
    // S10b, §6.2: the Ashen Bastion's siege tower, still rolling toward the Cinder clans' camps one turn of the wheel a
    // night; it comes out in an ashfall at night and rolls up the Bastion Road (the Pyre Peaks) toward the Bastion's ruin.
    id: 'last-siege', name: 'The Last Siege', area: 'infernal-reach-pyre-peaks', regions: ['h'], base: 'bone-walker', level: 32,
    life: 150, blows: 3.8, affixes: [], followers: 0, every: [3, 3], stay: 0.1,
    loot: { rolls: 3, chance: .1, uniques: ['unique-wall-that-kept-walking'], mats: [{ material: 'cinder-ore', qty: 4 }, { material: 'infernal-heartstone', qty: 2 }] },
    weather: { land: 'infernal-reach', region: 'h', state: 'ashfall' }, night: true, at: { c: 110, r: 40 }, form: 'last-siege', cooldown: 3, rank: 'boss', scale: 3, look: 'last-siege',
    track: [{ c: 110, r: 40 }, { c: 70, r: 30 }, { c: 40, r: -10 }, { c: 30, r: -40 }, { c: 0, r: -60 }, { c: -8, r: -80 }],
    lair: 'the Bastion Road, the Pyre Peaks (ashfall nights)',
  },
  {
    // S10b, §6.4: what the fog keeps of everyone it ever hid, risen on the Black Meres where three lantern posts went out.
    id: 'fogmother', name: 'The Fogmother', area: 'umbral-marches-meres', regions: ['k'], base: 'drowned-knight', level: 54,
    life: 80, blows: 3.6, affixes: [], followers: 0, every: [4, 4], stay: 0.1,
    loot: { rolls: 3, chance: .1, uniques: ['unique-psalm-heard-through-water'], mats: [{ material: 'umbral-ink', qty: 5 }, { material: 'nightglass', qty: 3 }, { material: 'inkstone', qty: 2 }] },
    weather: { land: 'umbral-marches', region: 'k', state: 'fog' }, night: true, at: { c: 96, r: -52 }, form: 'fogmother', cooldown: 4, rank: 'boss', scale: 3, look: 'fogmother',
    posts: [{ c: 96, r: -62 }, { c: 105, r: -47 }, { c: 87, r: -47 }],
    lair: 'the Black Meres, the Umbral Marches (foggy nights)',
  },
  {
    id: 'ser-wickless', name: 'Ser Wickless', area: 'umbral-marches-ruins', regions: ['x', 'Q'], base: 'drowned-knight', level: 55,
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
export const omenKey = (id: string, at: 'rise' | 'fall' | 'gone' | 'kept' | 'home'): string => `play.worldBoss.${id}.${at}`;

/**
 * A formed world boss's own creature (S10): its base at its level, its life and blows its own, a boss (CC a fifth as
 * long, the boss plate), its gap-closer handed to its party form (Lowered Antlers is the form's, so it never strikes twice).
 */
export function formedBossDef<D extends { id: string; name: string; hp: number; dmg: readonly [number, number] | [number, number]; rank?: string; charge?: unknown }>(b: WorldBossDef, atLevel: D): D {
  return { ...atLevel, name: b.name, rank: 'boss', hp: Math.round(atLevel.hp * b.life), dmg: [Math.round(atLevel.dmg[0] * b.blows), Math.round(atLevel.dmg[1] * b.blows)], charge: undefined, bound: { leash: 14 }, ...(b.loot.mats ? { drops: b.loot.mats.map(m => ({ ...m, chance: 1 })) } : {}) } as D;
}

/** How many times its creature's size a creature with this spawn key is drawn (a scaled world boss's; else 1). */
export function worldBossScale(key: string): number {
  if (!key.startsWith('wb:')) return 1;
  return worldBossOfKey(key)?.scale ?? 1;
}
