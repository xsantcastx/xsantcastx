/**
 * homestead.ts — the Keeper's Homestead as world data.
 *
 * A quiet plot off the Basalt Seamworks where every idle income source stands
 * as a building: the Treasury, the Furnace, the Forge Automatons, the Explorer
 * Camp and the Thrall Workshop. Walking past one shows what it made since you
 * were last here; walking up to one opens a tiny panel with ONE upgrade.
 *
 * Pure data, like the town files: the node harness loads this through
 * world.model, so it takes only types and the floor height.
 */
import { FLOOR } from '../engine/engine.model';
import type { HuntZoneDef, StationDef } from './world.model';
import type { HomeStationId } from '../../shared/minigames/home-forge.model';

/** Area id of the Homestead. Also the passage target from the Infernal town. */
export const HOMESTEAD_ID = 'homestead';
/** The Infernal town's gate station id (painted by the Homestead view, not the engine's arch). */
export const HOMESTEAD_GATE_ID = 'homestead';
/** Where the gate stands in the Infernal town: the open ground between the forge (930) and the crafting bench (1220). */
export const HOMESTEAD_GATE_X = 1075;

/**
 * The Forge (the big clickable heart of the plot) and the five income buildings.
 * Each is one station with the `homestead` panel; the Forge's interaction is
 * taken over by the Homestead view (a strike), the panel is only its fallback.
 */
export type HomesteadBuildingId = 'forge' | 'treasury' | 'furnace' | 'automatons' | 'camp' | 'workshop';
export const HOMESTEAD_BUILDING_IDS: readonly HomesteadBuildingId[] = ['forge', 'treasury', 'furnace', 'automatons', 'camp', 'workshop'];
/** Station id of the clickable Forge. */
export const HOMESTEAD_FORGE_STATION = 'hs-forge';

/** Station ids are prefixed so `?at=` can never collide with a town station. */
export const HOMESTEAD_STATION_PREFIX = 'hs-';
export function buildingOfStation(stationId: string | null | undefined): HomesteadBuildingId | null {
  if (!stationId?.startsWith(HOMESTEAD_STATION_PREFIX)) return null;
  const id = stationId.slice(HOMESTEAD_STATION_PREFIX.length) as HomesteadBuildingId;
  return HOMESTEAD_BUILDING_IDS.includes(id) ? id : null;
}

const WIDTH = 2900;

const building = (id: HomesteadBuildingId, x: number, label: string, width: number, blurb: string): StationDef =>
  ({ id: HOMESTEAD_STATION_PREFIX + id, x, label, kind: 'panel', panel: 'homestead', width, blurb });

export const HOMESTEAD_BUILDINGS: readonly StationDef[] = [
  building('treasury', 400, 'TREASURY', 190, 'Your Gold, piled up. Upgrade it to raise all Gold income.'),
  building('forge', 720, 'THE FORGE', 240, 'Click it to strike it. Every strike makes Gold.'),
  building('furnace', 1040, 'FURNACE', 190, 'Makes Gold every second, even while you are away.'),
  building('automatons', 1360, 'FORGE AUTOMATONS', 230, 'Hammers that strike the forge for you.'),
  building('camp', 1700, 'EXPLORER CAMP', 230, 'Your explorers leave from here and come home with loot.'),
  building('workshop', 2040, 'THRALL WORKSHOP', 230, 'Thralls pull runes at the anvil on their own.'),
];

/**
 * The crafting corner at the east end of the plot: the player's own Anvil and
 * Enchanting Circle. They open the SAME Crafting Bench / Enchanting Table panels
 * as town (so the same mini-games), but the side-scroller hosts them with the
 * HOME_FORGE context, so the station's bought tier (home-forge model) applies.
 * Not Homestead "buildings": they have no receipt and no `homestead` panel.
 */
export const HOME_ANVIL_STATION = 'hs-anvil';
export const HOME_CIRCLE_STATION = 'hs-circle';
export const HOME_FORGE_STATIONS: readonly StationDef[] = [
  { id: HOME_ANVIL_STATION, x: 2400, label: 'YOUR ANVIL', kind: 'panel', panel: 'crafting', width: 190,
    blurb: 'Your own anvil. Craft here; upgrade it for easier strikes.' },
  { id: HOME_CIRCLE_STATION, x: 2700, label: 'YOUR ENCHANTING CIRCLE', kind: 'panel', panel: 'enchanting', width: 210,
    blurb: 'Your own circle. Add runes here; upgrade it for an easier ritual.' },
];
/** Which home crafting station a station id is, or null. */
export function homeStationOf(stationId: string | null | undefined): HomeStationId | null {
  return stationId === HOME_ANVIL_STATION ? 'anvil' : stationId === HOME_CIRCLE_STATION ? 'circle' : null;
}

export const HOMESTEAD: HuntZoneDef = {
  id: HOMESTEAD_ID,
  name: 'Your Homestead',
  background: 'bg-basalt-seamworks',
  width: WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: WIDTH }],
  stations: [
    { id: 'passage', x: 130, label: 'BACK TO SEAMWORKS', kind: 'passage', to: 'infernal', arriveX: HOMESTEAD_GATE_X, width: 120, blurb: 'The road back to the Basalt Seamworks.' },
    ...HOMESTEAD_BUILDINGS,
    ...HOME_FORGE_STATIONS,
  ],
  monsters: [],
  drops: { id: 'homestead', entries: [] },
  spawnX: 270,
  arrival: 'Your Homestead. Click the Forge to strike it. Walk past a building to collect, walk up to one to upgrade it.',
};

/** The gate in the Infernal town. Appended to its stations. */
export const HOMESTEAD_GATE: StationDef = {
  id: HOMESTEAD_GATE_ID, x: HOMESTEAD_GATE_X, label: 'YOUR HOMESTEAD', kind: 'passage', to: HOMESTEAD_ID, arriveX: 270, width: 100,
  blurb: 'Your own plot: every Gold maker you own, working where you can see it.',
};
