/**
 * continent.ts — what a continent of the top-down world is made of (docs/design/world-map.md): a hand-drawn region
 * map, the roads and the places on it, who lives where, what each region is called, and its town. TdWorld turns one
 * into ground, things and creatures; the engine holds several and sails between them.
 */
import type { StationDef } from '../world/world.model';
import type { TdMap } from './seamworks-square';
import type { Ground } from './td-art';

export type Region = '~' | ',' | '.' | 'f' | 'F' | 'h' | 'm' | 'v' | 'l' | 'T'
  // The Verdant Wilds (maps/verdant-wilds.ts): jungle, deep jungle, a river, temple ruins.
  | 'j' | 'J' | 'r' | 'u'
  // The Umbral Marches (maps/umbral-marches.ts): the fen, the deep fen, black-water meres, the drowned ruins.
  | 'q' | 'Q' | 'k' | 'x';
export type PlaceKind = 'ruins' | 'shrine' | 'cave' | 'caldera' | 'standing-stones' | 'harbour' | 'crypt' | 'graveyard' | 'forge' | 'temple';

export interface ContinentPlace { kind: PlaceKind; c: number; r: number; name: string }
/** A way on from a place: a cave mouth into a hand-drawn level, a ship to another continent. */
export interface ContinentWay {
  place: PlaceKind;
  station: StationDef;
  /** A hand-drawn level's id, or another continent's id (a ship). */
  to: string;
  /** The station to arrive in front of there. */
  arrive: string;
  ship?: boolean;
  /** Tiles along the pier from the usual boarding spot (a second ship at the same harbour). */
  along?: number;
  /** Where the way in stands, in tiles from the place's centre (default: the centre; the Hushed Barrow's is its door). */
  at?: readonly [number, number];
}

/**
 * A hot spot (owner, 2026-10-26: "more combat zones, like hot spots"): in a chunk of `region`, at `chance`, a lair —
 * bones round a cleared ring — with `count` of `types` close round it (each its own spawn, falling and rising on its own).
 * `count` stays ≤ 5: at the room's ~75 s rest a lair of five feeds one Keeper the sims' 240 kills an hour, no more
 * (combat-sim TRAVEL; scripts/social-m3.test.mjs checks it).
 */
export interface ContinentHotspot { region: Region; chance: number; types: readonly string[]; count: number }

export interface ContinentDef {
  id: string;
  /** One character per BLOCK×BLOCK tiles; block (ox, oy) holds tile (0, 0), the town's corner. */
  map: readonly string[];
  ox: number;
  oy: number;
  roads: readonly (readonly [number, number])[][];
  places: readonly ContinentPlace[];
  /** What each region is called (a region the continent does not use needs no name). */
  names: Readonly<Partial<Record<Region, string>>>;
  mobs: Partial<Record<Region, { types: readonly string[]; chance: number }>>;
  /** Lairs: denser packs round a feature, per region (td-world makeChunk). */
  hotspots?: readonly ContinentHotspot[];
  town: () => TdMap;
  townName: string;
  /** The town's two main streets (tiles): roads near them are cobbled. */
  streets: { row: number; col: number };
  /** The town's river carried across the land (Ember Isle's square has one). */
  river: boolean;
  /** Road ground near the town's streets and far out (default cobble, then dirt). */
  roadGround?: { near: Ground; far: Ground };
  ways: readonly ContinentWay[];
  /** Mist drifting over the land (td-engine drawFog): 0 none … 1 thick. The Umbral Marches' fog. */
  fog?: number;
  /** Further towns and villages (Cinderport, Ashgrove…), each stamped with its top-left corner at tile (c, r). */
  villages?: readonly ContinentVillage[];
}

export interface ContinentVillage {
  name: string; c: number; r: number; build: () => TdMap;
  /** Ways on from the village itself (a ship from its own pier), at tile (c, r) of the village. */
  ways?: readonly VillageWay[];
}
/** A village's own way on: like a place's (ContinentWay), but standing at a tile of the village. */
export interface VillageWay { station: StationDef; c: number; r: number; to: string; arrive: string; ship?: boolean }
