/**
 * The Verdant town — Rootglass Canopy, the rootwood lattice threaded through
 * living crystal (the same landmark as /world/verdant/rootglass-canopy).
 *
 * Layout west → east: the Waystone by the spawn, then the canopy's four
 * stations — the Sanctum (expeditions depart from here), the Quest Board, the
 * Arena gate and the Trials gate — and the east passage down into the Rootglass
 * Thicket, where the Stags walk. The town itself is safe ground: no monsters.
 *
 * Copied from the Infernal town file (the template). Pure data: art is named by its
 * `artFor()` key and resolved by the host.
 */
import { FLOOR } from '../../engine/engine.model';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { HuntZoneDef, Platform, TownDef, ZoneDropTable } from '../world.model';

/**
 * What a Rootglass Stag drops. Every material is a real stack id the Crafting
 * Bench consumes (crafting.model.ts), and all three are the Verdant column:
 *
 *   Briarvein Kris (lvl 1)        thornroot 6 · verdant-sap 3 · world-root-bark 2
 *   Thornmantle Pauldrons (lvl 1) thornroot 8 · world-root-bark 4 · verdant-sap 3
 *   Rootwall Shield / Rootbreaker Mace (lvl 2) lean on world-root-bark + thornroot
 *
 * Tuning against the Infernal hunt (Rivet Maw, 60 HP: 8 + kills%5 coins and one
 * certain Cinder Ore — ~12 Maws for a Pyreclast Wand's ore):
 *  - Coins are a touch lower (6 + kills%5, avg 8 vs 10) because a Stag also
 *    pays out up to two extra stacks; Gold per minute stays roughly level.
 *  - Thornroot is certain, one per Stag: the bulk ingredient, like Maw ore.
 *  - Verdant Sap at 50%: recipes want about half as much sap as thornroot, so
 *    the two run out together (~6 Stags for a Kris' sap and thornroot alike).
 *  - World-Root Bark at 15%: it is the Art Bible's uncommon expedition
 *    material, so the hunt is a trickle (~13 Stags for a Kris' two pieces), not
 *    a replacement for sending an explorer into the realm.
 * The Stag has 50 HP (Maw 60): skittish rather than armoured, per the atlas.
 */
export const ROOTGLASS_STAG_DROPS: ZoneDropTable = {
  id: 'rootglass-stag',
  entries: [
    { id: 'coins', kind: 'coins', base: 6, spread: 5 },
    { id: 'thornroot', kind: 'material', material: 'thornroot', art: 'thornroot', label: 'Thornroot', short: 'root', qty: 1 },
    { id: 'sap', kind: 'material', material: 'verdant-sap', art: 'verdant-sap', label: 'Verdant Sap', short: 'sap', qty: 1, chance: 0.5 },
    { id: 'bark', kind: 'material', material: 'world-root-bark', art: 'world-root-bark', label: 'World-Root Bark', short: 'bark', qty: 1, chance: 0.15 },
  ],
};

const TOWN_WIDTH = 2400;
const THICKET_WIDTH = 2700;

/** Rootwood ledges in the gaps between the stations' stalls, so no ledge hangs over a door. */
const CANOPY_PLATFORMS: Platform[] = [
  { x: 460, y: 480, width: 160 }, { x: 1120, y: 430, width: 130 }, { x: 1880, y: 470, width: 200 },
];
const THICKET_PLATFORMS: Platform[] = [
  { x: 420, y: 500, width: 200 }, { x: 1100, y: 450, width: 220 }, { x: 1560, y: 400, width: 170 }, { x: 2150, y: 480, width: 200 },
];

/** Where the passage from the Thicket sets the Keeper down in town. */
const PASSAGE_X = 2240;

export const ROOTGLASS_THICKET: HuntZoneDef = {
  id: 'rootglass-thicket',
  name: 'Rootglass Thicket',
  background: 'bg-verdant',
  width: THICKET_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: THICKET_WIDTH }, ...THICKET_PLATFORMS],
  stations: [
    { id: 'passage', x: 110, label: 'RETURN TO THE CANOPY', kind: 'passage', to: 'verdant', arriveX: PASSAGE_X - 140, blurb: 'The root path back up to Rootglass Canopy.' },
  ],
  monsters: [{ creature: 'rootglass-stag', name: 'Rootglass Stag', hp: 50, spawnXs: [1300, 1700, 2100, 2450] }],
  drops: ROOTGLASS_STAG_DROPS,
  spawnX: 240,
  // The Stags keep east of the root path, so arriving is never an ambush.
  safeX: 900,
  arrival: 'Rootglass Thicket. Hunt the Stags for thornroot, sap and bark. The root path home is behind you.',
};

export const VERDANT_TOWN: TownDef = {
  id: 'verdant',
  realm: 'verdant',
  name: 'Rootglass Canopy',
  background: 'bg-verdant',
  width: TOWN_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: TOWN_WIDTH }, ...CANOPY_PLATFORMS],
  stations: [
    { id: 'waystone', x: 380, label: 'WAYSTONE', kind: 'waystone', art: 'rift-portal-core', width: 130, blurb: 'Travel between the realm towns.' },
    { id: 'sanctum', x: 720, label: 'THE SANCTUM', kind: 'panel', panel: 'sanctum', art: 'eclipse-summoning-sigil', width: 170, blurb: 'Hold court with your Keeper and send explorers out into the realms.' },
    { id: 'quests', x: 1030, label: 'QUEST BOARD', kind: 'panel', panel: 'quests', art: 'rift-map-fragment', width: 170, blurb: 'The daily, weekly and epic orders the realms are asking of you.' },
    { id: 'arena', x: 1340, label: 'ARENA GATE', kind: 'panel', panel: 'arena', art: 'rootwall-shield', width: 170, blurb: 'Test your might and guard against the ring.' },
    { id: 'trials', x: 1650, label: 'TRIALS GATE', kind: 'panel', panel: 'trials', art: 'eclipse-banner', width: 170, blurb: 'The proving ground: gates opened by the secrets you find.' },
    { id: 'passage', x: PASSAGE_X, label: 'ROOT PATH', kind: 'passage', to: 'rootglass-thicket', arriveX: 240, width: 120, blurb: 'Down through the roots to the Rootglass Thicket.' },
  ],
  monsters: [],
  drops: ROOTGLASS_STAG_DROPS,
  spawnX: 160,
  arrival: 'Rootglass Canopy. The Sanctum, the boards and the gates stand among the roots; the Thicket lies east.',
  hunts: [ROOTGLASS_THICKET],
};
