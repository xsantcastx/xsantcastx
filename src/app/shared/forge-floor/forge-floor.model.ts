/**
 * forge-floor.model.ts — what one production event on the forge floor carries.
 *
 * The floor is a picture of work the benches have already done. It never asks a
 * service anything and never decides an outcome: a bench resolves its craft,
 * strike or brew exactly as before, and then hands the floor a `ForgeFloorEvent`
 * describing what went in and what came out. The floor animates that and
 * nothing else, so its timing can never disagree with the ledger.
 *
 * Pure data, no browser APIs, safe on the server.
 */
import { artFor, type ArtEntry } from '../art/art';
import { materialDisplay } from '../rpg/material-catalog';
import { itemDefinitionById } from '../rpg/item-definition';

/** The three stations, one per bench route. */
export type ForgeStation = 'anvil' | 'table' | 'runes';

/** Anything with a picture: a material, a rune, an item, a coin. */
export interface ForgeFloorThing {
  id: string;
  name: string;
  /** Structural — `ArtEntry` and the rune forge's `CardArt` both fit. */
  art: Pick<ArtEntry, 'src' | 'srcset'> | null;
}

export interface ForgeFloorEvent {
  /** Strictly increasing per bench, so the floor can tell a repeat from a new event. */
  seq: number;
  station: ForgeStation;
  /** What flows from the stockpile into the station. May be empty. */
  inputs: readonly ForgeFloorThing[];
  /** What pops out and flies to the bag. Null for a feed-only event (a timed craft starting). */
  output: ForgeFloorThing | null;
  /** Optional rarity colour for the burst halo. Any CSS colour. */
  glow?: string;
  /**
   * Goods arriving from outside the floor — the Material Vendor's purchases.
   * They fly in and land on the stockpile before anything else plays. An event
   * with only deliveries (no inputs, no output) never lights a station.
   */
  delivered?: readonly ForgeFloorThing[];
  /** Where the deliveries come from, in client px (e.g. the Buy button). Clamped into the floor. Default: the top edge. */
  deliveredFrom?: { x: number; y: number };
}

/** Most icons the belt carries for one event; a nine-ingredient recipe still reads as "a lot". */
export const FLOOR_MAX_INPUTS = 5;

/** A material, item or rune id, resolved to a name and its library art. */
export function floorThing(id: string, name?: string, art?: ForgeFloorThing['art']): ForgeFloorThing {
  return {
    id,
    name: name ?? materialDisplay(id)?.name ?? itemDefinitionById(id)?.name ?? id,
    art: art ?? artFor(id),
  };
}

/** Gold, as the rune forge spends it. */
export function floorGold(): ForgeFloorThing {
  return { id: 'gold', name: 'Gold', art: artFor('gold') };
}
