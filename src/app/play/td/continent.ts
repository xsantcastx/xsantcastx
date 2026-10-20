/**
 * continent.ts — what a continent of the top-down world is made of (docs/design/world-map.md): a hand-drawn region
 * map, the roads and the places on it, who lives where, what each region is called, and its town. TdWorld turns one
 * into ground, things and creatures; the engine holds several and sails between them.
 */
import type { StationDef } from '../world/world.model';
import type { TdMap } from './seamworks-square';

export type Region = '~' | ',' | '.' | 'f' | 'F' | 'h' | 'm' | 'v' | 'l' | 'T';
export type PlaceKind = 'ruins' | 'shrine' | 'cave' | 'caldera' | 'standing-stones' | 'harbour' | 'crypt' | 'graveyard';

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
}

export interface ContinentDef {
  id: string;
  /** One character per BLOCK×BLOCK tiles; block (ox, oy) holds tile (0, 0), the town's corner. */
  map: readonly string[];
  ox: number;
  oy: number;
  roads: readonly (readonly [number, number])[][];
  places: readonly ContinentPlace[];
  names: Readonly<Record<Region, string>>;
  mobs: Partial<Record<Region, { types: readonly string[]; chance: number }>>;
  town: () => TdMap;
  townName: string;
  /** The town's two main streets (tiles): roads near them are cobbled. */
  streets: { row: number; col: number };
  /** The town's river carried across the land (Ember Isle's square has one). */
  river: boolean;
  ways: readonly ContinentWay[];
  /** Further towns and villages (Cinderport, Ashgrove…), each stamped with its top-left corner at tile (c, r). */
  villages?: readonly ContinentVillage[];
}

export interface ContinentVillage { name: string; c: number; r: number; build: () => TdMap }
