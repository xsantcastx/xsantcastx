/**
 * gathering.model.ts — the RuneScape-style gathering skills in the top-down world (canon §6.5; docs/handoff/gather.md):
 * Fishing at marked spots, Woodcutting log tiers, Firemaking campfires and Cooking meals.
 *
 * **The curve.** Every skill shares the game's one skill curve (skill.model / mining-level.ts): level L costs
 * floor(100·(L−1)^2.2) XP, 1–99, then the mastery steps past 99 (economy-sim --levels). Firemaking and Cooking are new
 * ledger disciplines on it; Fishing and Woodcutting already were.
 *
 * **The loops.** Click a spot (a ripple with a float) and the Keeper fishes until the satchel cannot take the next catch
 * or they move; a tree is felled for a log of its land's tier; a log and a tinderbox light a campfire for two minutes
 * (one in the rain) that quiets the Hush and keeps the dark-born back; raw fish cook at a campfire or a lit hearth
 * (a range: it burns less) into Hearth meals, eaten from the satchel: a slow heal over 12 s, one meal at a time.
 * Potions stay the fight's quick sip (the belt); a meal is the cheap, slow mend between fights.
 *
 * Pure data and functions. No Angular; the engine, the host, the specs and check-meaning all load it.
 */
import { BAITS, RODS, fishingPerks } from '../fishing/fishing.model';
import { biteWeather, type WeatherState } from '../weather/weather.model';

// ── Logs (Woodcutting → Firemaking) ─────────────────────────────────────────

export interface LogDef {
  id: string; name: string;
  /** The land whose trees give it (a continent id). */
  land: string;
  /** Woodcutting to fell its tree, Firemaking to light it. */
  cut: number; burn: number;
  /** XP for the felling and for the fire. */
  cutXp: number; burnXp: number;
  /** v2 price anchor (worth = anchor × ITEM_ECONOMY_SCALE; a shop pays 8% of worth). */
  anchor: number;
  lore: string;
}

/** By band (canon §6.5): Ember Isle ashwood → the Charwood's char-oak → Verdant rootglass boughs (never the Bole) → Umbral cypress. */
export const LOGS: readonly LogDef[] = [
  { id: 'ashwood-log', name: 'Ashwood Log', land: 'ember-isle', cut: 1, burn: 1, cutXp: 25, burnXp: 40, anchor: 500,
    lore: 'Grey through and through, as if it had burned once already and agreed to again.' },
  { id: 'char-oak-log', name: 'Char-oak Log', land: 'infernal-reach', cut: 15, burn: 15, cutXp: 38, burnXp: 60, anchor: 1_000,
    lore: 'Take the fallen first. The Charwood keeps count of the rest.' },
  { id: 'rootglass-bough', name: 'Rootglass Bough', land: 'verdant-wilds', cut: 30, burn: 30, cutXp: 68, burnXp: 90, anchor: 1_800,
    lore: 'A bough the wood let go of. It burns green, and the Bole does not miss it.' },
  { id: 'cypress-log', name: 'Cypress Log', land: 'umbral-marches', cut: 45, burn: 45, cutXp: 100, burnXp: 135, anchor: 2_600,
    lore: 'Moss-hung and slow to catch. Once lit, the fog keeps a respectful distance.' },
];
const LOG_BY_ID = new Map(LOGS.map(l => [l.id, l]));
export function logById(id: string): LogDef | undefined { return LOG_BY_ID.get(id); }
/** The log a tree on this land gives (Ember Isle's for anywhere unknown). */
export function logForLand(land: string): LogDef { return LOGS.find(l => l.land === land) ?? LOGS[0]; }
/** Swings to fell a tree: four, one fewer for a Woodcutting 20 levels past its gate (never under two). */
export function chopSwings(level: number, log: LogDef): number { return Math.max(2, 4 - Math.floor(Math.max(0, level - log.cut) / 20)); }

/** The tinderbox (the General Store): flint and a fire-steel. Never used up. */
export const TINDERBOX_ID = 'tinderbox';

// ── Fishing ─────────────────────────────────────────────────────────────────

export type SpotWater = 'lake' | 'sea' | 'river' | 'marsh';
export const SPOT_WATERS: readonly SpotWater[] = ['lake', 'sea', 'river', 'marsh'];

export interface WorldFishDef {
  id: string; name: string;
  /** Fishing level to catch it. */
  level: number;
  waters: readonly SpotWater[];
  /** Only by night (or under an eclipse's dark), only under an eclipse, or any hour. */
  when?: 'dark' | 'eclipse';
  xp: number;
  /** Its cooked meal. */
  cooked: string;
  anchor: number;
  /** Shadow size in art px (world-acts §4.2), and its tint. */
  shadow: readonly [number, number];
  tone: 'grey' | 'silver' | 'warm' | 'pale';
  lore: string;
}

/**
 * The world's fish (world-acts §4.2, canon names). Mirrorfin and the Rootling Eel keep their old Delve ids, so every
 * use they had stays theirs (the Lampfish Oil, the Ink Pup's favourite, Verrin's five eels).
 */
export const WORLD_FISH: readonly WorldFishDef[] = [
  { id: 'ash-perch', name: 'Ash Perch', level: 1, waters: ['lake'], xp: 10, cooked: 'baked-ash-perch', anchor: 700, shadow: [6, 3], tone: 'grey',
    lore: 'Grey as the lake it came from. It tastes faintly of the fire that warmed the water.' },
  { id: 'mirrorfin', name: 'Mirrorfin', level: 5, waters: ['sea'], xp: 20, cooked: 'seared-mirrorfin', anchor: 1_000, shadow: [8, 4], tone: 'silver',
    lore: 'Its scales are slivers of the moon mirror. In the sea it turns silver every time it turns at all.' },
  { id: 'rootling-eel', name: 'Rootling Eel', level: 10, waters: ['river'], xp: 35, cooked: 'smoked-rootling-eel', anchor: 1_600, shadow: [10, 2], tone: 'grey',
    lore: 'Swims along the roots, toward the crack, like everything else.' },
  { id: 'mire-carp', name: 'Mire Carp', level: 20, waters: ['marsh'], xp: 55, cooked: 'mire-carp-supper', anchor: 2_400, shadow: [8, 4], tone: 'grey',
    lore: 'Slow, heavy and old. The pilgrims fed the fen carp, and the carp remember who stopped.' },
  { id: 'lampfish', name: 'Lampfish', level: 25, waters: ['lake', 'marsh'], when: 'dark', xp: 70, cooked: 'lampfish-fry', anchor: 3_000, shadow: [6, 3], tone: 'warm',
    lore: 'A warm dot under black water. It is why the fen pilgrims hung their lanterns over the meres.' },
  { id: 'moonbelly', name: 'Moonbelly', level: 40, waters: ['lake', 'sea', 'river', 'marsh'], when: 'eclipse', xp: 120, cooked: 'moonbelly-fillet', anchor: 3_500, shadow: [10, 5], tone: 'pale',
    lore: 'It only rises when the Moonwake opens and the moon stands in front of the sun, and it leaves a silver wake as if it were the moon.' },
];
const FISH_BY_ID = new Map(WORLD_FISH.map(f => [f.id, f]));
export function worldFishById(id: string): WorldFishDef | undefined { return FISH_BY_ID.get(id); }

/**
 * A spot's gate: its water's first fish (the Fishing level to stand and cast), and the rod it needs. The handed-down
 * Worn Rod (rod 0.5) reaches the lakes only; the sea wants a rod from the Fishing Store (the Root Rod, rod 1); the
 * rivers and the marsh its Seam Rod (rod 2, Fishing 10).
 */
export const SPOT_GATE: Readonly<Record<SpotWater, { level: number; rod: number }>> = {
  lake: { level: 1, rod: .5 }, sea: { level: 5, rod: 1 }, river: { level: 10, rod: 2 }, marsh: { level: 20, rod: 2 },
};
/** The Worn Rod's reach (the lakes only). */
export const WORN_ROD_TIER = .5;

/** Why a cast is refused, or null: the level, no rod, a store rod wanted, a Seam Rod wanted. */
export function spotRefusal(water: SpotWater, level: number, rodTier: number): 'level' | 'rod' | 'storeRod' | 'rodTier' | null {
  const g = SPOT_GATE[water];
  if (level < g.level) return 'level';
  if (rodTier <= 0) return 'rod';
  if (rodTier < g.rod) return g.rod <= 1 ? 'storeRod' : 'rodTier';
  return null;
}

export interface SkyNow { dark: boolean; eclipse: boolean }

/** The fish that can bite at a spot now, for this Fishing level. */
export function fishHere(water: SpotWater, level: number, sky: SkyNow): WorldFishDef[] {
  return WORLD_FISH.filter(f => f.waters.includes(water) && f.level <= level
    && (!f.when || (f.when === 'dark' ? sky.dark : sky.eclipse)));
}

/** The fish a spot's shadows show now (any level: seeing is half of catching). */
export function shownHere(water: SpotWater, sky: SkyNow): WorldFishDef[] {
  const all = WORLD_FISH.filter(f => f.waters.includes(water) && (!f.when || (f.when === 'dark' ? sky.dark : sky.eclipse)));
  return all.length ? all : WORLD_FISH.filter(f => f.waters.includes(water) && !f.when);
}

/**
 * One catch: the water's fish the level allows, the better ones rarer (each step up the ladder about half as likely),
 * bait drawing the better ones up (×(1 + 2·power)), the night's and the eclipse's own fish favoured in their hour.
 */
export function rollWorldFish(water: SpotWater, level: number, sky: SkyNow, bait: number, rnd: () => number): WorldFishDef | null {
  const list = fishHere(water, level, sky);
  if (!list.length) return null;
  const base = Math.min(...list.map(f => f.level));
  const weight = (f: WorldFishDef) => {
    let w = f.level === base ? 1 : Math.pow(.5, 1 + (f.level - base) / 15) * (1 + 2 * Math.max(0, bait));
    if (f.when === 'dark') w *= 1.6;
    if (f.when === 'eclipse') w *= .8;
    return w;
  };
  const total = list.reduce((s, f) => s + weight(f), 0);
  let u = rnd() * total;
  for (const f of list) { u -= weight(f); if (u < 0) return f; }
  return list[list.length - 1];
}

/** Base seconds to a bite. */
export const BITE_SECS = 7;
/** A jump at the spot (the tell): the next bite comes this much sooner. */
export const JUMP_SOONER = 2;
/** Never sooner than this. */
export const BITE_MIN = 1.5;

/** How fast a rod, bait, the skill's perks and the weather make the fish bite (× speed). */
export function biteSpeed(rodBite: number, bait: number, level: number, weather: WeatherState): number {
  return rodBite * (1 + Math.max(0, bait)) * fishingPerks(level).bite * biteWeather(weather);
}
/** Seconds to the next bite: BITE_SECS / speed, spread 0.7–1.3, a jump's 2 s off, never under BITE_MIN. */
export function biteSecs(speed: number, jumped: boolean, rnd: () => number): number {
  const t = BITE_SECS / Math.max(.1, speed) * (.7 + .6 * rnd()) - (jumped ? JUMP_SOONER : 0);
  return Math.max(BITE_MIN, t);
}

/** The rods (fishing.model RODS): the best held, as the tier its Fishing level lets it work. */
export function rodTierOf(stackOf: (id: string) => number, level: number): { tier: number; bite: number; id: string | null } {
  const held = [...RODS].reverse().find(r => stackOf(r.id) > 0);
  if (!held) return { tier: 0, bite: 1, id: null };
  const works = held.level <= level ? held : [...RODS].reverse().find(r => r.level <= level && r.tier <= held.tier) ?? RODS[0];
  return { tier: works.id === 'worn-rod' ? WORN_ROD_TIER : works.tier, bite: works.bite, id: held.id };
}
/** The strongest bait held (fishing.model BAITS), or null. Bait is optional and better. */
export function baitOf(stackOf: (id: string) => number): { id: string; power: number } | null {
  const b = BAITS.find(x => stackOf(x.id) > 0);
  return b ? { id: b.id, power: b.power } : null;
}

// ── Cooking ─────────────────────────────────────────────────────────────────

export interface MealDef {
  id: string; name: string;
  raw: string;
  /** Cooking level to cook it; it stops burning at `stop` (a range at `stop` − 5). */
  level: number; stop: number;
  xp: number;
  /** Life it mends over MEAL_SECS. */
  heal: number;
  anchor: number;
  lore: string;
}
export const MEALS: readonly MealDef[] = [
  { id: 'baked-ash-perch', name: 'Baked Ash Perch', raw: 'ash-perch', level: 1, stop: 30, xp: 30, heal: 40, anchor: 900,
    lore: 'Every fire you light is a small hearth, and this is the smallest supper it can make.' },
  { id: 'seared-mirrorfin', name: 'Seared Mirrorfin', raw: 'mirrorfin', level: 5, stop: 35, xp: 40, heal: 60, anchor: 1_300,
    lore: 'The silver goes out of it in the pan. Eat it before it remembers.' },
  { id: 'smoked-rootling-eel', name: 'Smoked Rootling Eel', raw: 'rootling-eel', level: 10, stop: 40, xp: 60, heal: 90, anchor: 2_100,
    lore: 'Smoked long and low, the way the Rootwater ferrymen keep it for the crossing.' },
  { id: 'mire-carp-supper', name: 'Mire Carp Supper', raw: 'mire-carp', level: 20, stop: 50, xp: 80, heal: 130, anchor: 3_100,
    lore: 'A pilgrim\'s supper. The fen says grace for you, if you wait long enough.' },
  { id: 'lampfish-fry', name: 'Lampfish Fry', raw: 'lampfish', level: 25, stop: 55, xp: 100, heal: 160, anchor: 3_900,
    lore: 'It glows a little on the plate. You hunt better on a full belly, and see better too.' },
  { id: 'moonbelly-fillet', name: 'Moonbelly Fillet', raw: 'moonbelly', level: 40, stop: 70, xp: 160, heal: 240, anchor: 4_500,
    lore: 'Cooked under a dark noon, it tastes of the morning that was due and did not come.' },
];
const MEAL_BY_ID = new Map(MEALS.map(m => [m.id, m]));
const MEAL_BY_RAW = new Map(MEALS.map(m => [m.raw, m]));
export function mealById(id: string): MealDef | undefined { return MEAL_BY_ID.get(id); }
export function mealOfRaw(raw: string): MealDef | undefined { return MEAL_BY_RAW.get(raw); }

/** What a burnt fish becomes: charred bits, a poor bait (so the waste still means something). */
export const BURNT_FISH_ID = 'burnt-fish';
/** A meal mends over this long; a new one replaces the one still going. */
export const MEAL_SECS = 12;
/** Seconds to cook one fish. */
export const COOK_SECS = 1.8;
/** Seconds the striking of a light takes. */
export const LIGHT_SECS = 1.6;
/** The most a fire's light reaches (art px) and where the Hush cannot rise (the warm ring). */
export const FIRE_LIGHT = 70;
export const FIRE_WARM = 56;

/**
 * The chance a fish burns: 55% at its own level, falling straight to nothing at its stop level; a range (a lit
 * hearth) stops it burning five levels sooner. Never below 0, never above 55%.
 */
export function burnChance(level: number, meal: MealDef, range = false): number {
  const stop = range ? meal.stop - 5 : meal.stop;
  if (level >= stop) return 0;
  const span = Math.max(1, stop - meal.level);
  return Math.max(0, Math.min(.55, .55 * (stop - level) / span));
}

/** Why a fish will not cook, or null. */
export function cookRefusal(raw: string, level: number): 'notFood' | 'level' | null {
  const m = mealOfRaw(raw);
  if (!m) return 'notFood';
  return level < m.level ? 'level' : null;
}

/** The raw fish held that the level can cook, best (highest gate) first. */
export function cookable(stackOf: (id: string) => number, level: number): MealDef[] {
  return MEALS.filter(m => stackOf(m.raw) > 0 && m.level <= level).sort((a, b) => b.level - a.level);
}

/** A meal's mend per second. */
export function mealRate(meal: MealDef): number { return meal.heal / MEAL_SECS; }

// ── Firemaking ──────────────────────────────────────────────────────────────

export function fireRefusal(log: string, level: number, tinderbox: boolean): 'notLog' | 'tinderbox' | 'level' | null {
  const l = logById(log);
  if (!l) return 'notLog';
  if (!tinderbox) return 'tinderbox';
  return level < l.burn ? 'level' : null;
}

// ── The satchel ─────────────────────────────────────────────────────────────

/** Everything the gathering loops land: they pile 20 to a cell (a satchel fills, RuneScape's way). */
export const GATHER_PILE = 20;
export const GATHER_KEYS: ReadonlySet<string> = new Set([
  ...LOGS.map(l => l.id), ...WORLD_FISH.map(f => f.id), ...MEALS.map(m => m.id), BURNT_FISH_ID,
]);

/** A gathered thing's worth (v3 Gold) for the shops' buyback, or 0 when it is not one of these. */
export function gatherAnchor(id: string): number {
  return logById(id)?.anchor ?? worldFishById(id)?.anchor ?? mealById(id)?.anchor ?? (id === BURNT_FISH_ID ? 50 : 0);
}

// ── Meaning (check:meaning; docs/world/canon.md §6.5) ───────────────────────

export interface GatherMeaning { id: string; name: string; sources: readonly string[]; uses: readonly string[]; lore: string }
export const GATHER_MEANING: readonly GatherMeaning[] = [
  ...LOGS.map(l => ({ id: l.id, name: l.name, lore: l.lore,
    sources: [`Woodcutting ${l.cut}: any tree on ${landName(l.land)} (td-engine chop)${l.id === 'rootglass-bough' ? ', a fallen bough, never the Rootglass Bole itself' : ''}`],
    uses: [`Firemaking ${l.burn}: a campfire, with a tinderbox (the satchel card's Light)`, 'the Woodcutting Store buys it'] })),
  ...WORLD_FISH.map(f => ({ id: f.id, name: f.name, lore: f.lore,
    sources: [`Fishing ${f.level}: ${f.waters.join(', ')} spots${f.when === 'dark' ? ' by night' : f.when === 'eclipse' ? ' under an eclipse' : ''}`],
    uses: [`Cooking ${mealOfRaw(f.id)?.level ?? 1}: ${mealOfRaw(f.id)?.name ?? ''} at a campfire or a lit hearth`, 'the Fishing Store buys it'] })),
  ...MEALS.map(m => ({ id: m.id, name: m.name, lore: m.lore,
    sources: [`Cooking ${m.level}: ${worldFishById(m.raw)?.name ?? m.raw} at a campfire or a lit hearth`],
    uses: [`eaten from the satchel: mends ${m.heal} life over ${MEAL_SECS} s`] })),
  { id: BURNT_FISH_ID, name: 'Burnt Fish', lore: 'Charred past eating. The small fish do not mind; they come up to see what fell.',
    sources: ['Cooking: a fish that burns'], uses: ['fishing bait (the weakest)'] },
  { id: TINDERBOX_ID, name: 'Tinderbox', lore: 'Every fire you light is a small hearth. The dark minds its manners round one.',
    sources: ['the General Store'], uses: ['Firemaking: strikes a light on a log (never used up)'] },
];

function landName(land: string): string {
  return land === 'ember-isle' ? 'Ember Isle' : land === 'infernal-reach' ? 'Infernal Reach' : land === 'verdant-wilds' ? 'the Verdant Wilds' : 'the Umbral Marches';
}

// ── The engine ↔ host words (td-engine onGather) ────────────────────────────

/**
 * What the world asks the host. `start` asks before a loop begins (a refusal says why and nothing starts); each later
 * step lands one thing through the skill pipeline, keyed by `mutationId`, and `ok: false` ends the loop (the satchel is
 * full, nothing left to cook, a save failed) with the reason in `text`.
 */
export type GatherEvent =
  | { kind: 'fish'; phase: 'start' | 'bite'; water: SpotWater; spot: string; mutationId: string; weather: WeatherState }
  | { kind: 'chop'; phase: 'start' | 'fell'; land: string; mutationId: string }
  | { kind: 'fire'; phase: 'lit'; log: string; mutationId: string }
  | { kind: 'cook'; phase: 'start' | 'one'; range: boolean; mutationId: string };

export interface GatherAnswer {
  ok: boolean;
  /** The line to show (a refusal, or what landed). */
  text?: string;
  /** What rose over the Keeper ("+1 Ash Perch"). */
  label?: string;
  /** Fishing: the bite speed (rod × bait × perks × weather). */
  speed?: number;
  /** Woodcutting: swings to fell. */
  swings?: number;
  /** Cooking: it burned. */
  burnt?: boolean;
  /** The stack key that landed in the satchel (the HUD pulses the satchel for it). */
  got?: string;
}
