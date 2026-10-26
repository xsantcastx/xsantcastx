/**
 * td-levels.ts — every continent and every hand-drawn level of the top-down world, by id. Pure data (no canvas, no
 * engine): the engine reads it to travel, and the room-run world (play/world/room-world.ts, protocol 9) reads it to
 * simulate every area at once on the Hearth.
 */
import type { ContinentDef } from './continent';
import type { TdMapDef } from './td-level';
import { EMBER_MINE_1 } from './maps/ember-mine-1';
import { EMBER_MINE_2, EMBER_MINE_3 } from './maps/ember-mine-deep';
import { SLAGSTONE_CAVE } from './maps/slagstone-cave';
import { EMBER_INN_1, EMBER_INN_2 } from './maps/ember-inn';
import { PYRE_SPIRE_1, PYRE_SPIRE_2, PYRE_SPIRE_3 } from './maps/pyre-spire';
import { MOLTEN_DEEP_1, MOLTEN_DEEP_2, MOLTEN_DEEP_3, MOLTEN_DEEP_4, MOLTEN_DEEP_5, MOLTEN_DEEP_6 } from './maps/molten-deep';
import { FORGE_OF_FOUR_1, FORGE_OF_FOUR_2, FORGE_OF_FOUR_3 } from './maps/forge-of-four';
import { ASHEN_CRYPT_1, ASHEN_CRYPT_2 } from './maps/ashen-crypt';
import { SALTED_EMBER_0, SALTED_EMBER_1 } from './maps/cinderport';
import { WOODWARD_LODGE_1, WOODWARD_LODGE_2 } from './maps/ashgrove';
import { EMBER_ISLE_DEF } from './maps/ember-isle';
import { INFERNAL_REACH_DEF } from './maps/infernal-reach';
import { VERDANT_WILDS_DEF } from './maps/verdant-wilds';
import { ROOTGLASS_BOLE_0, ROOTGLASS_BOLE_1, ROOTGLASS_BOLE_2, ROOTGLASS_BOLE_3 } from './maps/rootglass-bole';
import { OVERGROWN_TEMPLE_1, OVERGROWN_TEMPLE_2, OVERGROWN_TEMPLE_3, OVERGROWN_TEMPLE_4, OVERGROWN_TEMPLE_5 } from './maps/overgrown-temple';
import { ROOT_HOLLOWS_1, ROOT_HOLLOWS_2, ROOT_HOLLOWS_3 } from './maps/root-hollows';
import { HERBAL_0, HERBAL_1, NETLOFT_1, NETLOFT_2 } from './maps/verdant-houses';
import { UMBRAL_MARCHES_DEF } from './maps/umbral-marches';
import { LANTERN_TOWER_0, LANTERN_TOWER_1, LANTERN_TOWER_2 } from './maps/lantern-tower';
import { DROWNED_CRYPTS_1, DROWNED_CRYPTS_2, DROWNED_CRYPTS_3 } from './maps/drowned-crypts';
import { HUSHED_BARROW_1 } from './maps/hushed-barrow';

/** Every continent, by id (ships sail between them). */
export const CONTINENTS: Readonly<Record<string, ContinentDef>> = { 'ember-isle': EMBER_ISLE_DEF, 'infernal-reach': INFERNAL_REACH_DEF, 'verdant-wilds': VERDANT_WILDS_DEF,
  'umbral-marches': UMBRAL_MARCHES_DEF };

/** Every hand-drawn level under (or over) the surface, by id. */
const DRAWN: Readonly<Record<string, TdMapDef>> = { 'ember-mine-1': EMBER_MINE_1, 'ember-mine-2': EMBER_MINE_2, 'ember-mine-3': EMBER_MINE_3, 'slagstone-cave': SLAGSTONE_CAVE, 'ember-inn-1': EMBER_INN_1, 'ember-inn-2': EMBER_INN_2,
  'pyre-spire-1': PYRE_SPIRE_1, 'pyre-spire-2': PYRE_SPIRE_2, 'pyre-spire-3': PYRE_SPIRE_3,
  'molten-deep-1': MOLTEN_DEEP_1, 'molten-deep-2': MOLTEN_DEEP_2, 'molten-deep-3': MOLTEN_DEEP_3,
  'molten-deep-4': MOLTEN_DEEP_4, 'molten-deep-5': MOLTEN_DEEP_5, 'molten-deep-6': MOLTEN_DEEP_6,
  'forge-of-four-1': FORGE_OF_FOUR_1, 'forge-of-four-2': FORGE_OF_FOUR_2, 'forge-of-four-3': FORGE_OF_FOUR_3,
  'ashen-crypt-1': ASHEN_CRYPT_1, 'ashen-crypt-2': ASHEN_CRYPT_2,
  'salted-ember-1': SALTED_EMBER_1, 'salted-ember-0': SALTED_EMBER_0, 'woodward-lodge-1': WOODWARD_LODGE_1, 'woodward-lodge-2': WOODWARD_LODGE_2,
  'rootglass-bole-0': ROOTGLASS_BOLE_0, 'rootglass-bole-1': ROOTGLASS_BOLE_1, 'rootglass-bole-2': ROOTGLASS_BOLE_2, 'rootglass-bole-3': ROOTGLASS_BOLE_3,
  'overgrown-temple-1': OVERGROWN_TEMPLE_1, 'overgrown-temple-2': OVERGROWN_TEMPLE_2, 'overgrown-temple-3': OVERGROWN_TEMPLE_3,
  'lantern-tower-0': LANTERN_TOWER_0, 'lantern-tower-1': LANTERN_TOWER_1, 'lantern-tower-2': LANTERN_TOWER_2,
  'drowned-crypts-1': DROWNED_CRYPTS_1, 'drowned-crypts-2': DROWNED_CRYPTS_2, 'drowned-crypts-3': DROWNED_CRYPTS_3,
  'overgrown-temple-4': OVERGROWN_TEMPLE_4, 'overgrown-temple-5': OVERGROWN_TEMPLE_5,
  'root-hollows-1': ROOT_HOLLOWS_1, 'root-hollows-2': ROOT_HOLLOWS_2, 'root-hollows-3': ROOT_HOLLOWS_3,
  'netloft-1': NETLOFT_1, 'netloft-2': NETLOFT_2, 'herbal-cottage-1': HERBAL_1, 'herbal-cottage-0': HERBAL_0,
  'hushed-barrow-1': HUSHED_BARROW_1 };

/**
 * Each dungeon floor's lair (td-level TdMapDef.lair; owner 2026-10-26: "more combat zones, like hot spots"): its own
 * creatures, gathered round its lair feature, as the zone bible (canon §8) says who lairs where. Five at most (a lair of
 * five at the room's ~75 s rest feeds one Keeper the sims' 240 kills an hour); boss floors keep a light one.
 */
export const FLOOR_LAIRS: Readonly<Record<string, NonNullable<TdMapDef['lair']>>> = {
  // Ember Mine: the Maws round the bones where the last crew stopped; the Bailiffs still serving their writs.
  'ember-mine-1': { types: ['rivet-maw'], count: 4 },
  'ember-mine-2': { types: ['cinder-bailiff', 'rivet-maw'], count: 4 },
  'ember-mine-3': { types: ['cinder-imp'], count: 3 },
  // Slagstone Cave: "a nest room of Maws round the ore vein".
  'slagstone-cave': { types: ['rivet-maw', 'rivet-maw', 'cinder-imp'], count: 5 },
  // The Molten Deep: hound bones round the pools, the golems and glass at their posts.
  'molten-deep-1': { types: ['lava-hound'], count: 5 },
  'molten-deep-2': { types: ['obsidian-golem', 'lava-hound'], count: 4 },
  'molten-deep-3': { types: ['lava-hound'], count: 3 },
  'molten-deep-4': { types: ['slag-crawler', 'ember-drake'], count: 4 },
  'molten-deep-5': { types: ['glass-sentinel', 'slag-crawler'], count: 4 },
  'molten-deep-6': { types: ['lava-hound'], count: 3 },
  // The Forge of the Four: Bailiffs and Golems keep the halls.
  'forge-of-four-1': { types: ['cinder-bailiff', 'cinder-imp'], count: 4 },
  'forge-of-four-2': { types: ['obsidian-golem', 'cinder-bailiff'], count: 4 },
  'forge-of-four-3': { types: ['cinder-bailiff'], count: 3 },
  // The Ashen Crypt: the garrison still standing its watch.
  // The Bone Priest (S6, monsters-abilities §2.6): one a floor, calling the roll.
  'ashen-crypt-1': { types: ['bone-walker', 'bone-archer', 'ash-ghoul', 'bone-priest'], count: 5 },
  'ashen-crypt-2': { types: ['bone-walker', 'bone-priest', 'bone-walker'], count: 3 },
  // The Overgrown Temple: the lashers in the pews, the weavers below, the hollow choir at the bottom.
  'overgrown-temple-1': { types: ['vine-lasher', 'moss-stalker'], count: 4 },
  'overgrown-temple-2': { types: ['thorn-weaver', 'vine-lasher'], count: 4 },
  'overgrown-temple-3': { types: ['thorn-weaver'], count: 3 },
  'overgrown-temple-4': { types: ['drowned-acolyte', 'vine-lasher'], count: 3 },
  'overgrown-temple-5': { types: ['drowned-acolyte'], count: 3 },
  // The Root Hollows: Rootgnaws chewing it wider, Sporecaps in the dark they leave.
  'root-hollows-1': { types: ['rootgnaw', 'sporecap'], count: 4 },
  'root-hollows-2': { types: ['rootgnaw', 'sporecap'], count: 4 },
  'root-hollows-3': { types: ['rootgnaw', 'sporecap'], count: 4 },
  // The Drowned Crypts: the guard that marched down, still at its posts.
  'drowned-crypts-1': { types: ['mire-lurker', 'drowned-knight'], count: 4 },
  'drowned-crypts-2': { types: ['ink-hound', 'drowned-knight'], count: 4 },
  // The Acolytes who keep the watch mustered (S6: Call the Watch and Prayer in the Drowned Crypts).
  'drowned-crypts-3': { types: ['drowned-knight', 'drowned-acolyte', 'drowned-knight'], count: 3 },
};

/** Every hand-drawn level under (or over) the surface, by id (its lair woven in). */
export const LEVELS: Readonly<Record<string, TdMapDef>> = Object.fromEntries(Object.entries(DRAWN)
  .map(([id, def]) => [id, FLOOR_LAIRS[id] ? { ...def, lair: FLOOR_LAIRS[id] } : def]));
