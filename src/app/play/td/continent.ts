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
export type PlaceKind = 'ruins' | 'shrine' | 'cave' | 'caldera' | 'standing-stones' | 'harbour' | 'crypt' | 'graveyard' | 'forge' | 'temple'
  /** S10: the Storm-Struck Oak (the Greenwood's heart, monsters-abilities §6.3): a split glassy giant in a ring of stumps. */
  | 'storm-oak'
  /** S10b: the Last Siege's yard on the Bastion Road (§6.2): the old siege trench where the tower comes out of the ash. */
  | 'siege-trench'
  /** S10b: the Three Posts on the Black Meres (§6.4): the widest pool's reed islands, three old lantern posts at its edge. */
  | 'mere-posts';

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

  // ── An act's section (docs/design/world-acts.md §0, §1.2: a long land split into areas, one room area each) ──
  /** The land this area belongs to (`infernal-reach` for every Reach section); unset: the continent is its own land. */
  land?: string;
  /** The section's own name (the Atlas row, the area card's realm line): "The Cinder Steppe". */
  title?: string;
  /** What the town at (0, 0) is: a capital (its hearth has the Shrine; the default), a village, or a Waystone camp (no hearth). */
  townKind?: 'capital' | 'village' | 'camp';
  /** Ash country (the Reach's Badlands, Molten Fields and Pyre Peaks): obsidian dirt and basalt, no grass, more lava showing. */
  ash?: boolean;
  /** Chunks round the town where no pack spawns (default 3; a Waystone camp keeps 1). */
  quiet?: number;
  /** The town's own ways on (a ship from its own pier, when the town is a harbour village), at tiles of the town. */
  townWays?: readonly VillageWay[];
  /** The walked ways to the land's other sections: a road gate, a ford, a pass (td-sections.ts). Never an invisible wall. */
  seams?: readonly SectionSeam[];
  /** The section's Waystone (one a section): a stone that remembers who touched it (td-sections.ts). */
  stone?: { id: string; c: number; r: number; name: string };
  /** Things to read and things sealed (the zone bible's check), each a station on its tile. */
  marks?: readonly SectionMark[];
  /** Named hot spots (world-acts.md §2): camps, dens and champion grounds, at fixed tiles. */
  camps?: readonly SectionCamp[];
}

/**
 * A walked way to another section: the gate stands at tile (c, r) across the road, facing `dir` (the side the other
 * section lies); stepping past it crosses (the 0.4 s veil). The far side's seam `arrive` takes the Keeper 6 tiles inside.
 */
export interface SectionSeam {
  id: string;
  c: number; r: number;
  dir: 'n' | 's' | 'e' | 'w';
  /** The section (a ContinentDef id) on the other side, and the id of its seam that leads back here. */
  to: string; arrive: string;
  /** What it is, for its look and its label: a road gate, a ford, a mountain pass, a village gate. */
  kind: 'gate' | 'ford' | 'pass';
  label: string;
}
/** A thing to read (a plaque, a tally, a note) or a sealed thing (a door, a cage, a bricked arch), at tile (c, r). */
export interface SectionMark { id: string; kind: 'read' | 'sealed'; c: number; r: number; look: 'plaque' | 'sign' | 'altar' | 'door' | 'cage' | 'chest' | 'statue' | 'ruin' | 'cave' | 'kiln' | 'mound'; label: string }
/**
 * A named hot spot: a camp (its pack rises together 90 s after the last falls), a den (a guaranteed unique pack), or a
 * champion ground (elite packs 1 in 4 instead of 1 in 16). `spawns` are laid in a ring round (c, r).
 */
export interface SectionCamp { id: string; name: string; kind: 'camp' | 'den' | 'champion'; c: number; r: number; spawns: readonly string[] }

export interface ContinentVillage {
  name: string; c: number; r: number; build: () => TdMap;
  /** Ways on from the village itself (a ship from its own pier), at tile (c, r) of the village. */
  ways?: readonly VillageWay[];
}
/** A village's own way on: like a place's (ContinentWay), but standing at a tile of the village. */
export interface VillageWay { station: StationDef; c: number; r: number; to: string; arrive: string; ship?: boolean }
