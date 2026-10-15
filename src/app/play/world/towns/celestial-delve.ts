/**
 * The Orrery Wells — the Celestial realm's underside, behind the Celestial Rift
 * Gate in the Magma Halls (shared/delve/rift-gates.model.ts; the generator is
 * engine/celestial-gen.ts, the broken rule engine/celestial.ts). Lore:
 * lore-addendum.md, "The Orrery Wells" (shipped — owner reviews in play).
 *
 * A hunt of the Infernal town only because that is where its door is: it has
 * no passage from any town. Canon: not a sixth realm, not the Void
 * (delve-and-beyond.md §1.2): the rock under the Celestial towns, where the
 * Meridian Compact measured the sky from underneath and left its rings turning.
 *
 * The last and deepest of the four: Pickaxe III–IV rock, creatures that hit
 * harder, rewards highest on the curve, and a down that is negotiable.
 */
import { FLOOR } from '../../engine/engine.model';
import type { HuntZoneDef, ZoneDropTable } from '../world.model';

/** The flag the Fallen Ephemeris sets when it falls (the same string as delve-missions.model's EPHEMERIS_FLAG; a spec pins them). */
export const EPHEMERIS_FLAG = 'fallen-ephemeris-defeated';

/**
 * Bestiary (lore-addendum.md, The Orrery Wells):
 *  - Anchor Warden: "repeats the last trajectory it was given" — starsteel, now and then meridian glass.
 *  - The Fallen Ephemeris: "the table of where every star should be" — meridian glass, starsteel, alloy.
 */
export const ANCHOR_WARDEN_DROPS: ZoneDropTable = {
  id: 'celestial-anchor-warden',
  entries: [
    { id: 'coins', kind: 'coins', base: 42, spread: 12 },
    { id: 'starsteel', kind: 'material', material: 'starsteel', art: 'starsteel', label: 'Starsteel', short: 'steel', qty: 1, chance: 0.5, rarity: 'uncommon' },
    { id: 'meridian-glass', kind: 'material', material: 'meridian-glass', art: 'meridian-glass', label: 'Meridian Glass', short: 'glass', qty: 1, chance: 0.12, rarity: 'rare' },
  ],
};
export const EPHEMERIS_DROPS: ZoneDropTable = {
  id: 'celestial-ephemeris',
  entries: [
    { id: 'coins', kind: 'coins', base: 190, spread: 40 },
    { id: 'meridian-glass', kind: 'material', material: 'meridian-glass', art: 'meridian-glass', label: 'Meridian Glass', short: 'glass', qty: 3, rarity: 'rare' },
    { id: 'starsteel', kind: 'material', material: 'starsteel', art: 'starsteel', label: 'Starsteel', short: 'steel', qty: 4, rarity: 'uncommon' },
    { id: 'alloy', kind: 'material', material: 'celestial-alloy', art: 'celestial-alloy', label: 'Celestial Alloy', short: 'alloy', qty: 1, chance: 0.5, rarity: 'rare' },
  ],
};

const COLS = 64;
const ROWS = 64;
const CELL = 32;
const row = (r: number) => FLOOR + r * CELL;
const col = (c: number) => c * CELL;

export const CELESTIAL_DELVE: HuntZoneDef = {
  id: 'celestial-delve',
  name: 'The Orrery Wells',
  background: 'bg-celestial',
  width: COLS * CELL,
  platforms: [{ x: 0, y: row(ROWS), width: COLS * CELL }],
  stations: [],
  monsters: [
    // Anchor Wardens walk the galleries the generator lays (celestial-gen.ts): no fixed spawns.
    { creature: 'anchor-warden', name: 'Anchor Warden', hp: 280, spawnXs: [], drops: ANCHOR_WARDEN_DROPS },
    // The Orrery Well, under the Gate Hollow: it rides its hall's ceiling until it falls, once per player.
    { creature: 'fallen-ephemeris', name: 'The Fallen Ephemeris', hp: 1400, spawnXs: [col(34) + 16], floorY: row(54),
      range: [col(14), col(56)], once: EPHEMERIS_FLAG, trait: 'orrery', drops: EPHEMERIS_DROPS },
  ],
  drops: ANCHOR_WARDEN_DROPS,
  spawnX: col(35) + 16,
  figureScale: .5,
  arrival: 'The Orrery Wells. Down is negotiable here: the brass rings decide it, field by field.',
  terrain: {
    seed: 0xce_1e5d,
    version: 1,
    cols: COLS,
    rows: ROWS,
    top: FLOOR,
    // The core's bands only feed the shared context; celestial-gen.ts lays every cell.
    bands: [{ to: 31, node: 'astral-stone' }, { to: ROWS, node: 'nadir-stone' }],
    jitter: 1.5,
    endless: true,
    realm: 'celestial',
    veins: [],
    stamps: [],
    bedrock: 2,
    biomes: [
      {
        id: 'brass-galleries', name: 'The Brass Galleries', to: 34,
        // delve-and-beyond.md, the Celestial palette: midnight, star silver, orbit blue, brass.
        wall: ['#121a30', '#0a1020', '#05080f'], dark: '3,6,15',
        wash: { color: '#5fb6ff', alpha: .07 },
        particles: { kind: 'mote', color: '#d8ecff', count: 14 },
        veins: [],
      },
      {
        id: 'nadir-deep', name: 'The Nadir Deep', to: ROWS,
        wall: ['#18223a', '#0a1020', '#04060c'], dark: '2,4,10',
        wash: { color: '#e8c47a', alpha: .05 },
        particles: { kind: 'mote', color: '#a8b8cc', count: 10 },
        veins: [],
      },
    ],
  },
};
