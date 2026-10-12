/**
 * The Celestial town — Meridian Orrery, the observatory realm.
 *
 * Layout west → east: the arrival terrace (spawn), the Codex observatory, the
 * Leaderboards board, the Waystone, then the east passage out to the Orrery
 * Rings. The town itself is quiet ground: no monsters walk the terrace, so
 * the Codex and the boards are always reachable. The hunt is one passage away.
 *
 * The Rings' creature is the Ephemeris Leech, the canon Celestial creature
 * of the Eclipse Realms creature atlas ("clings to brass orbital rings and
 * consumes minute predictive errors"), which is why its hunting ground is
 * the orrery's ring walk. It renders through the Maw rig until the engine
 * grows per-creature rigs.
 */
import { FLOOR } from '../../engine/engine.model';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { HuntZoneDef, Platform, TownDef, ZoneDropTable } from '../world.model';

/**
 * What an Ephemeris Leech drops in the Orrery Rings.
 *
 * Tuned against the Infernal hunt (Rivet Maw: hp 60, 8–12 coins and one
 * certain Cinder Ore per kill):
 *  - coins 10–15: Celestial is a later stop on the road, and the Leech has a
 *    little more HP, so it pays a little more than a Maw — not enough to make
 *    the Seamworks pointless.
 *  - Celestial Alloy ×1, certain: the realm's staple (Meridian Orrery's
 *    prospecting yield) and the bulk input of every Celestial recipe
 *    (Meridian Longbow 10, Astral Glaive 12, Starplate Cuirass 3, Astral
 *    Striders 8). The certain drop mirrors the Maw's Cinder Ore.
 *  - Moonpetal Herb 25%: an uncommon Celestial herb used in 7 recipes, in
 *    small counts (2–4), so a quarter of kills keeps pace with the alloy.
 *  - Celestial Quartz 12%: rare, "grows where starlight filters through
 *    rock" — the star-fragment of this realm, and the gate on the realm's
 *    better gear (Starplate Cuirass 4, Meridian Longbow 3, Astral Glaive 6,
 *    Starfall Maul 10). At ~8 kills per quartz a Longbow's three take a
 *    couple of dozen kills: a reason to come back, not a wall.
 * All three ids are real stacks in material-catalog / artbible-items, so they
 * land in the satchel with art and feed the Crafting Bench directly.
 */
export const ORRERY_DROPS: ZoneDropTable = {
  id: 'orrery-leech',
  entries: [
    { id: 'coins', kind: 'coins', base: 10, spread: 6 },
    { id: 'alloy', kind: 'material', material: 'celestial-alloy', art: 'celestial-alloy', label: 'Celestial Alloy', short: 'alloy', qty: 1 },
    { id: 'moonpetal', kind: 'material', material: 'moonpetal-herb', art: 'moonpetal-herb', label: 'Moonpetal Herb', short: 'moonpetal', qty: 1, chance: .25 },
    { id: 'quartz', kind: 'material', material: 'celestial-quartz', art: 'celestial-quartz', label: 'Celestial Quartz', short: 'quartz', qty: 1, chance: .12 },
  ],
};

const TOWN_WIDTH = 2000;
const RINGS_WIDTH = 2700;

/** Brass ring walkways: the terrace ledges, kept clear of the stations below. */
const TERRACE_PLATFORMS: Platform[] = [
  { x: 330, y: 500, width: 170 }, { x: 1450, y: 470, width: 200 },
];
const RING_PLATFORMS: Platform[] = [
  { x: 520, y: 500, width: 200 }, { x: 980, y: 440, width: 220 }, { x: 1520, y: 500, width: 200 }, { x: 2060, y: 430, width: 200 },
];

export const ORRERY_RINGS: HuntZoneDef = {
  id: 'orrery-rings',
  name: 'Orrery Rings',
  background: 'bg-celestial',
  width: RINGS_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: RINGS_WIDTH }, ...RING_PLATFORMS],
  stations: [
    { id: 'passage', x: 110, label: 'RETURN TO THE ORRERY', kind: 'passage', to: 'celestial', arriveX: 1720, blurb: 'The ring walk back to Meridian Orrery.' },
  ],
  monsters: [{ creature: 'ephemeris-leech', name: 'Ephemeris Leech', hp: 70, spawnXs: [1250, 1650, 2050, 2450] }],
  drops: ORRERY_DROPS,
  spawnX: 240,
  safeX: 700,
  arrival: 'The Orrery Rings. Ephemeris Leeches cling to the brass; hunt them for alloy, moonpetal and quartz.',
};

export const CELESTIAL_TOWN: TownDef = {
  id: 'celestial',
  realm: 'celestial',
  name: 'Meridian Orrery',
  background: 'bg-celestial',
  width: TOWN_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: TOWN_WIDTH }, ...TERRACE_PLATFORMS],
  stations: [
    { id: 'codex', x: 620, label: 'THE CODEX', kind: 'panel', panel: 'codex', art: 'lens-of-the-archivist', width: 180, blurb: 'The observatory record: fragments, lore, secrets and the collection.' },
    { id: 'leaderboards', x: 920, label: 'LEADERBOARDS', kind: 'panel', panel: 'leaderboards', art: 'celestial-crest', width: 170, blurb: 'The ranked ladders, charted like stars.' },
    { id: 'waystone', x: 1220, label: 'WAYSTONE', kind: 'waystone', art: 'rift-portal-core', width: 130, blurb: 'Travel between the realm towns.' },
    { id: 'passage', x: 1860, label: 'EAST PASSAGE', kind: 'passage', to: 'orrery-rings', arriveX: 240, width: 120, blurb: 'The ring walk east to the Orrery Rings, where the Leeches feed.' },
  ],
  monsters: [],
  drops: ORRERY_DROPS,
  spawnX: 180,
  arrival: 'Meridian Orrery. The Codex observatory and the Leaderboards stand on the terrace; the Rings lie east.',
  hunts: [ORRERY_RINGS],
};
