/**
 * td-zones.ts — every zone's fixed level band, Diablo II's way (owner, 2026-10-21, a player's note marked "extremely
 * important": "leveling character to the zone! has to be like d2, zones mobs are harder, each zone should not scale
 * with the player, each zone should have a level of difficulty"). docs/design/world-map.md "Zone levels" is the prose.
 *
 * The rules:
 *  - **A zone is a region of a continent, a dungeon floor, or a house.** Its key: `<continent>:<region>` for the wild
 *    (`ember-isle:F`, the Deep Emberwood), `<continent>:graveyard` for a graveyard's plot, a hand-drawn level's id for
 *    a floor (`molten-deep-4`). ZONES below is the one table; nothing else in the game writes a creature's level.
 *  - **Creatures spawn at the zone's level, never the Keeper's.** A spawn's level is picked inside its zone's band from
 *    the spawn's own key (zoneLevel: the same key gives the same level on every device, so a co-op host and its party
 *    agree), and the creature is re-made at that level (atZoneLevel): life and blow follow leveling.md's rule for a
 *    creature of that level, from its own authored numbers, so an Ash Wolf in the Charwood (10–13) is a level-11 wolf.
 *    A boss keeps its authored level (each floor's band ends at it); a world boss's level is its rift's (SEAM_LEVELS).
 *  - **Night swaps stay in the band**: the night creature takes the spawn's level, not its own. Difficulty tiers
 *    (Nightmare, Hell) multiply on top of the zone's level, as D2's do.
 *  - **XP rewards hunting at your level** (zoneXp): full XP down to XP_FALLOFF.grace levels below, then
 *    XP_FALLOFF.perLevel less a level, never under XP_FALLOFF.floor; a creature above the Keeper pays a little more.
 *
 * Pure: imports only td-life (the fight's life curve) and types.
 */
import type { MobDef } from './td-mobs';
import { lifeScale, livedHp } from './td-life';

/** One zone: its level band (inclusive) and whether it is safe ground (a town's house: no creature ever spawns). */
export interface Zone { band: readonly [number, number]; safe?: true }

/**
 * The bands, continent by continent: each continent's land grows harder away from its capital, and its dungeons go
 * deeper floor by floor (the bottom floor ends on its boss's level). Ember Isle 1–10 → the Reach 8–30 → the Verdant
 * Wilds 15–40 → the Umbral Marches 26–50, D2's acts in a row.
 */
export const ZONES: Readonly<Record<string, Zone>> = {
  // ── Ember Isle (1–10): the starter island ──
  'ember-isle:T': { band: [1, 2], safe: true },       // Basalt Seamworks
  'ember-isle:.': { band: [1, 2] },                   // Cinder Meadows, round the square
  'ember-isle:,': { band: [1, 2] },                   // Ember Coast
  'ember-isle:l': { band: [1, 2] },                   // Ashwater Lake
  'ember-isle:~': { band: [1, 2] },                   // the Burning Sea
  'ember-isle:f': { band: [2, 4] },                   // The Emberwood
  'ember-isle:h': { band: [3, 5] },                   // Slagstone Hills
  'ember-isle:m': { band: [3, 5] },                   // Slagstone Hills (the mountain rock)
  'ember-isle:F': { band: [4, 6] },                   // The Deep Emberwood
  'ember-isle:v': { band: [7, 10] },                  // The Ashfields, far east
  'ember-isle:graveyard': { band: [5, 6] },           // the Hushed Barrow's plot
  'ember-mine-1': { band: [2, 3] },
  'ember-mine-2': { band: [4, 6] },
  'ember-mine-3': { band: [7, 8] },                   // the Ember Warden, 8
  'slagstone-cave': { band: [3, 5] },
  'hushed-barrow-1': { band: [6, 7] },                // the Uncounted, 7
  'ember-inn-1': { band: [1, 2], safe: true },
  'ember-inn-2': { band: [1, 2], safe: true },

  // ── Infernal Reach (8–30): the volcanic mainland ──
  'infernal-reach:T': { band: [8, 10], safe: true },  // Pyrehold
  'infernal-reach:.': { band: [8, 11] },              // The Cinder Steppe, round Pyrehold
  'infernal-reach:,': { band: [8, 10] },              // The Ashen Shore
  'infernal-reach:l': { band: [8, 10] },              // Glasswater
  'infernal-reach:~': { band: [8, 10] },
  'infernal-reach:f': { band: [10, 13] },             // The Charwood
  'infernal-reach:F': { band: [13, 16] },             // The Deep Charwood
  'infernal-reach:h': { band: [15, 18] },             // The Obsidian Badlands
  'infernal-reach:v': { band: [18, 21] },             // The Molten Fields
  'infernal-reach:m': { band: [19, 22] },             // The Pyre Peaks
  'forge-of-four-1': { band: [12, 14] },
  'forge-of-four-2': { band: [14, 16] },
  'forge-of-four-3': { band: [16, 18] },              // the Anvil-Warden, 18
  'ashen-crypt-1': { band: [14, 17] },
  'ashen-crypt-2': { band: [22, 25] },                // the Ashbone Dragon, 25
  'molten-deep-1': { band: [12, 14] },
  'molten-deep-2': { band: [15, 17] },
  'molten-deep-3': { band: [18, 20] },                // the Magma Tyrant, 20
  'molten-deep-4': { band: [21, 23] },
  'molten-deep-5': { band: [24, 26] },
  'molten-deep-6': { band: [27, 30] },                // the Cinder Sovereign, 30
  'pyre-spire-1': { band: [8, 10], safe: true },
  'pyre-spire-2': { band: [8, 10], safe: true },
  'pyre-spire-3': { band: [8, 10], safe: true },
  'salted-ember-1': { band: [8, 10], safe: true },
  'salted-ember-0': { band: [8, 10], safe: true },
  'woodward-lodge-1': { band: [10, 13], safe: true },
  'woodward-lodge-2': { band: [10, 13], safe: true },

  // ── The Verdant Wilds (15–40): the jungle continent ──
  'verdant-wilds:T': { band: [15, 17], safe: true },  // Rootglass
  'verdant-wilds:.': { band: [15, 17] },              // The Fernglades, round Rootglass
  'verdant-wilds:,': { band: [15, 17] },              // The Mossy Shore
  'verdant-wilds:r': { band: [16, 18] },              // The Rootwater
  'verdant-wilds:l': { band: [16, 18] },              // The Glassmere
  'verdant-wilds:~': { band: [15, 17] },
  'verdant-wilds:j': { band: [17, 20] },              // The Greenwood
  'verdant-wilds:J': { band: [21, 25] },              // The Deep Wilds
  'verdant-wilds:u': { band: [24, 28] },              // The Sunken Courts
  'root-hollows-1': { band: [19, 21] },
  'root-hollows-2': { band: [21, 23] },
  'root-hollows-3': { band: [23, 25] },
  'overgrown-temple-1': { band: [24, 26] },
  'overgrown-temple-2': { band: [27, 29] },
  'overgrown-temple-3': { band: [30, 34] },           // the Mossbound Colossus, 34
  'overgrown-temple-4': { band: [33, 36] },
  'overgrown-temple-5': { band: [36, 40] },           // the Elder Rootwyrm, 40
  'rootglass-bole-0': { band: [15, 17], safe: true },
  'rootglass-bole-1': { band: [15, 17], safe: true },
  'rootglass-bole-2': { band: [15, 17], safe: true },
  'rootglass-bole-3': { band: [15, 17], safe: true },
  'netloft-1': { band: [15, 17], safe: true },
  'netloft-2': { band: [15, 17], safe: true },
  'herbal-cottage-1': { band: [16, 18], safe: true },
  'herbal-cottage-0': { band: [16, 18], safe: true },

  // ── The Umbral Marches (26–50): swamp and shadow ──
  'umbral-marches:T': { band: [26, 28], safe: true }, // Gloamhaven
  'umbral-marches:q': { band: [26, 29] },             // The Gloaming Fen, round Gloamhaven
  'umbral-marches:,': { band: [26, 28] },             // The Gloaming Shore
  'umbral-marches:~': { band: [26, 28] },
  'umbral-marches:k': { band: [29, 32] },             // The Black Meres
  'umbral-marches:Q': { band: [32, 36] },             // The Deep Fen
  'umbral-marches:x': { band: [37, 41] },             // The Drowned Ruins
  'drowned-crypts-1': { band: [41, 43] },
  'drowned-crypts-2': { band: [43, 46] },
  'drowned-crypts-3': { band: [46, 50] },             // the Ink Abbess, 50
  'lantern-tower-0': { band: [26, 28], safe: true },
  'lantern-tower-1': { band: [26, 28], safe: true },
  'lantern-tower-2': { band: [26, 28], safe: true },
};

/** Each continent's band, end to end (the Map's title, a ship's blurb). */
export const CONTINENT_BANDS: Readonly<Record<string, readonly [number, number]>> = {
  'ember-isle': [1, 10], 'infernal-reach': [8, 30], 'verdant-wilds': [15, 40], 'umbral-marches': [26, 50],
};

/**
 * The Seam Eater's level at each continent's rift (td-seam.ts): fixed, never the Keeper's. Ember Isle's is the
 * encounter a starter Keeper is meant to run from (Glim says so); each continent's is a wall a little past its land.
 */
export const SEAM_LEVELS: Readonly<Record<string, number>> = {
  'ember-isle': 20, 'infernal-reach': 30, 'verdant-wilds': 40, 'umbral-marches': 55,
};
/** The Seam Eater's level on a continent (a continent without one: the lowest). */
export function seamLevelFor(continent: string): number { return SEAM_LEVELS[continent] ?? SEAM_LEVELS['ember-isle']; }

/** A wild region's zone key. */
export function regionZone(continent: string, region: string): string { return `${continent}:${region}`; }
/** A graveyard plot's zone key. */
export function graveyardZone(continent: string): string { return `${continent}:graveyard`; }
/** The zone behind a key; null when there is none (the sim, a showcase). */
export function zoneOf(id: string | null | undefined): Zone | null { return (id && ZONES[id]) || null; }

/** FNV-1a over the key, as 0..1: the spawn's own die, the same everywhere. */
function unit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
/** The level a spawn of `key` comes at in a zone of `band`: inside it, picked by the key alone (deterministic). */
export function zoneLevel(band: readonly [number, number], key: string): number {
  const lo = Math.max(1, Math.round(band[0])), hi = Math.max(lo, Math.round(band[1]));
  return lo + Math.min(hi - lo, Math.floor(unit(`zone|${key}`) * (hi - lo + 1)));
}

/** leveling.md's rule for a creature of level m: its authored life (30 + 12.5·m) and its blow's middle (4 + 0.7·m). */
export const CREATURE_RULE = { life: (m: number) => 30 + 12.5 * m, blow: (m: number) => 4 + .7 * m } as const;

const scalePair = (p: readonly [number, number], k: number): [number, number] => {
  const lo = Math.max(1, Math.round(p[0] * k));
  return [lo, Math.max(lo, Math.round(p[1] * k))];
};
/**
 * A creature re-made at a zone's level: leveling.md's rule for a creature of `level` (life 30 + 12.5·L, blow 4 + 0.7·L),
 * leaning as its kind leans from the rule at its own authored level (half-way, in log terms: it keeps its kind), then
 * risen as every creature rises (td-life lifeScale). Its ranged, charge and rend blows move with its blow. `def` is a MOBS entry (its life already risen at its own level).
 * A boss and the Seam Eater are themselves; the same level gives the same record back.
 */
export function atZoneLevel(def: MobDef, level: number): MobDef {
  const L = Math.max(1, Math.round(level)), L0 = def.level;
  if (!Number.isFinite(L) || L === L0 || def.rank === 'boss' || def.bound) return def;
  const tough = def.tough ?? 1;
  const authored = def.hp / lifeScale(L0, def.rank) / tough;
  // Its kind's lean (sturdier or frailer than the rule at its own level) is carried half-way in log terms: a Rivet Maw
  // stays a little sturdier than a wolf of its level, but the starter island's sturdy tutorial kinds do not wall a zone.
  const lean = (own: number, rule: number) => Math.sqrt(own / rule);
  const midBlow = (def.dmg[0] + def.dmg[1]) / 2;
  const life = CREATURE_RULE.life(L) * lean(authored, CREATURE_RULE.life(L0)) / authored;
  const blow = CREATURE_RULE.blow(L) / midBlow;
  return {
    ...def, level: L,
    hp: livedHp(authored * life * tough, L, def.rank),
    dmg: scalePair(def.dmg, blow),
    ...(def.ranged ? { ranged: { ...def.ranged, dmg: scalePair(def.ranged.dmg, blow) } } : {}),
    ...(def.charge ? { charge: { ...def.charge, dmg: scalePair(def.charge.dmg, blow) } } : {}),
    ...(def.rend ? { rend: { ...def.rend, dmg: scalePair(def.rend.dmg, blow) } } : {}),
  };
}

/** A boss's call (MobDef.summon) comes at the boss's floor: this many levels under it, never under its own kind's. */
export const CALL_UNDER = 2;
/** The level a boss's called creature comes at. */
export function callLevel(caller: Pick<MobDef, 'level' | 'rank' | 'bound'>, called: Pick<MobDef, 'level'>): number {
  return caller.rank === 'boss' && !caller.bound ? Math.max(called.level, caller.level - CALL_UNDER) : called.level;
}

/**
 * Hunting XP by the gap between the Keeper and the creature (D2): full down to `grace` levels below him, then
 * `perLevel` less a level, never under `floor`; a creature above him pays `bonusPerLevel` more a level, up to `bonusCap`.
 */
export const XP_FALLOFF = { grace: 5, perLevel: .05, floor: .1, bonusPerLevel: .02, bonusCap: .1 } as const;
export function zoneXp(keeperLevel: number, creatureLevel: number): number {
  const k = Number.isFinite(keeperLevel) ? Math.max(1, Math.floor(keeperLevel)) : 1;
  const m = Number.isFinite(creatureLevel) ? Math.max(1, Math.floor(creatureLevel)) : k;
  const below = k - m;
  if (below > XP_FALLOFF.grace) return Math.max(XP_FALLOFF.floor, 1 - XP_FALLOFF.perLevel * (below - XP_FALLOFF.grace));
  if (below < 0) return 1 + Math.min(XP_FALLOFF.bonusCap, XP_FALLOFF.bonusPerLevel * -below);
  return 1;
}

/** A zone this many levels or more above the Keeper (its band's low end) is "Dangerous for your level". */
export const DANGER_GAP = 5;
export function zoneDanger(band: readonly [number, number] | null | undefined, keeperLevel: number): boolean {
  return !!band && band[0] - Math.max(1, Math.floor(keeperLevel || 1)) >= DANGER_GAP;
}

// ── The level gap (owner 2026-10-21: "we need to make monsters hard … If I'm level 20 vs a 40 I should get one-shot") ──
/**
 * D2's and Tibia's gap, on top of the fixed zone levels, one way only: a creature ABOVE the Keeper hits harder and is
 * harder to hurt; a creature below him is never softer than its zone made it (XP falloff answers farming low zones).
 *  - its blows: ×(1 + hurtPerLevel·gap) to `steepFrom` levels, then ×steepRate more each level past it;
 *  - its step: ×(1 + pacePerLevel·gap), at most +paceCap (a Keeper cannot walk away from it for ever);
 *  - his blows on it: −dealtPerLevel a level to `steepFrom`, then ×dealtSteep a level (never under dealtFloor), and a
 *    miss chance of missPerLevel a level, missSteep a level past `steepFrom` (D2's to-hit by level), at most missCap.
 * Co-op: each Keeper reads the gap against his own level (the bite lands through his own MobSystem, his blows are
 * reduced before they are claimed).
 */
export const LEVEL_GAP = {
  hurtPerLevel: .3, steepFrom: 10, steepRate: 1.2,
  dealtPerLevel: .075, dealtSteep: .85, dealtFloor: .05,
  missPerLevel: .075, missSteep: .02, missCap: .8,
  pacePerLevel: .03, paceCap: .6,
} as const;
/** Levels the creature stands above the Keeper (0 when it is at or below him). */
export function levelGap(keeperLevel: number, creatureLevel: number): number {
  const k = Number.isFinite(keeperLevel) ? Math.max(1, Math.floor(keeperLevel)) : 1;
  const m = Number.isFinite(creatureLevel) ? Math.floor(creatureLevel) : k;
  return Math.max(0, m - k);
}
const G = LEVEL_GAP;
/** What a creature `gap` levels above the Keeper does to him, × its blow. */
export function gapHurt(gap: number): number {
  const g = Math.max(0, gap || 0);
  if (g <= G.steepFrom) return 1 + G.hurtPerLevel * g;
  return (1 + G.hurtPerLevel * G.steepFrom) * Math.pow(G.steepRate, g - G.steepFrom);
}
/** What the Keeper's blows do to a creature `gap` levels above him, × his blow (when it lands). */
export function gapDealt(gap: number): number {
  const g = Math.max(0, gap || 0), near = 1 - G.dealtPerLevel * Math.min(g, G.steepFrom);
  return Math.max(G.dealtFloor, near * Math.pow(G.dealtSteep, Math.max(0, g - G.steepFrom)));
}
/** The chance a Keeper's blow misses a creature `gap` levels above him. */
export function gapMiss(gap: number): number {
  const g = Math.max(0, gap || 0);
  return Math.min(G.missCap, G.missPerLevel * Math.min(g, G.steepFrom) + G.missSteep * Math.max(0, g - G.steepFrom));
}
/** A creature `gap` levels above the Keeper moves this much quicker (it cannot be walked away from for ever). */
export function gapPace(gap: number): number { return 1 + Math.min(G.paceCap, G.pacePerLevel * Math.max(0, gap || 0)); }

/** A creature's name-plate colour by its level against the Keeper's (Tibia): trivial, even, +3, +6, +10 (a skull). */
export type GapTone = 'trivial' | 'even' | 'tough' | 'hard' | 'deadly';
export const GAP_TONES: Readonly<Record<GapTone, string>> = {
  trivial: '#9a948a', even: '#f2e6d0', tough: '#f0d060', hard: '#f09040', deadly: '#e8483a',
};
export function gapTone(keeperLevel: number, creatureLevel: number): GapTone {
  const d = Math.floor(creatureLevel) - Math.max(1, Math.floor(keeperLevel || 1));
  return d >= 10 ? 'deadly' : d >= 6 ? 'hard' : d >= 3 ? 'tough' : d < -XP_FALLOFF.grace ? 'trivial' : 'even';
}
