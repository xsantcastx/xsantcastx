/**
 * The Root Deeps — the Verdant realm's underside, behind the Verdant Rift Gate
 * in the Root Hollows (shared/delve/rift-gates.model.ts; the generator is
 * engine/verdant-gen.ts, the broken rule engine/verdant.ts). Lore:
 * lore-addendum.md, "The Root Deeps" (shipped — owner reviews in play).
 *
 * A hunt of the Infernal town only because that is where its door is: it has
 * no passage from any town. The Keeper steps in through the gate and back out
 * through it (or a Rift Anchor of this world). Canon: not a sixth realm, not
 * the Void (delve-and-beyond.md §1.2): the World-Root under the Verdant towns.
 *
 * A step up from the Ember Delve before it: Pickaxe III–IV wood, creatures
 * that hit harder, rewards higher on the curve, and dug rock that grows back.
 */
import { FLOOR } from '../../engine/engine.model';
import type { HuntZoneDef, ZoneDropTable } from '../world.model';

/** The flag the Graftmother sets when she falls (the same string as delve-missions.model's GRAFTMOTHER_FLAG; a spec pins them). */
export const GRAFTMOTHER_FLAG = 'graftmother-defeated';

/**
 * Bestiary (lore-addendum.md, The Root Deeps):
 *  - Graftling: "a cutting that took" — rootglass, now and then heart-amber.
 *  - The Graftmother: "joins everything that is cut" — heart-amber, rootglass, sap.
 */
export const GRAFTLING_DROPS: ZoneDropTable = {
  id: 'verdant-graftling',
  entries: [
    { id: 'coins', kind: 'coins', base: 40, spread: 12 },
    { id: 'rootglass', kind: 'material', material: 'rootglass', art: 'rootglass', label: 'Rootglass', short: 'glass', qty: 1, chance: 0.5, rarity: 'uncommon' },
    { id: 'heart-amber', kind: 'material', material: 'heart-amber', art: 'heart-amber', label: 'Heart-amber', short: 'amber', qty: 1, chance: 0.12, rarity: 'rare' },
  ],
};
export const GRAFTMOTHER_DROPS: ZoneDropTable = {
  id: 'verdant-graftmother',
  entries: [
    { id: 'coins', kind: 'coins', base: 180, spread: 40 },
    { id: 'heart-amber', kind: 'material', material: 'heart-amber', art: 'heart-amber', label: 'Heart-amber', short: 'amber', qty: 3, rarity: 'rare' },
    { id: 'rootglass', kind: 'material', material: 'rootglass', art: 'rootglass', label: 'Rootglass', short: 'glass', qty: 4, rarity: 'uncommon' },
    { id: 'sap', kind: 'material', material: 'verdant-sap', art: 'verdant-sap', label: 'Verdant Sap', short: 'sap', qty: 1, chance: 0.5, rarity: 'rare' },
  ],
};

const COLS = 64;
const ROWS = 64;
const CELL = 32;
const row = (r: number) => FLOOR + r * CELL;
const col = (c: number) => c * CELL;

export const VERDANT_DELVE: HuntZoneDef = {
  id: 'verdant-delve',
  name: 'The Root Deeps',
  background: 'bg-verdant',
  width: COLS * CELL,
  platforms: [{ x: 0, y: row(ROWS), width: COLS * CELL }],
  stations: [],
  monsters: [
    // Graftlings grow in the warrens the generator lays (verdant-gen.ts): no fixed spawns.
    { creature: 'graftling', name: 'Graftling', hp: 260, spawnXs: [], drops: GRAFTLING_DROPS },
    // The Graftmother's hall, under the Gate Hollow: she stands there until she falls, once per player.
    { creature: 'graftmother', name: 'The Graftmother', hp: 1300, spawnXs: [col(32) + 16], floorY: row(54),
      range: [col(8), col(56)], once: GRAFTMOTHER_FLAG, trait: 'graft', drops: GRAFTMOTHER_DROPS },
  ],
  drops: GRAFTLING_DROPS,
  spawnX: col(35) + 16,
  figureScale: .5,
  arrival: 'The Root Deeps. The walls are wood, and the wood is awake: what you dig, it takes back.',
  terrain: {
    seed: 0x7e_e0de,
    version: 1,
    cols: COLS,
    rows: ROWS,
    top: FLOOR,
    // The core's bands only feed the shared context; verdant-gen.ts lays every cell.
    bands: [{ to: 31, node: 'rootwood' }, { to: ROWS, node: 'heartwood' }],
    jitter: 1.5,
    endless: true,
    realm: 'verdant',
    veins: [],
    stamps: [],
    bedrock: 2,
    biomes: [
      {
        id: 'root-tangle', name: 'The Root Tangle', to: 34,
        // Style guide §5.3, the Verdant ramps: root brown, moss lift, bioluminescent sap.
        wall: ['#1e1810', '#18120c', '#0a0806'], dark: '4,6,3',
        wash: { color: '#7fd5a3', alpha: .07 },
        particles: { kind: 'spore', color: '#c8e86a', count: 14 },
        veins: [],
      },
      {
        id: 'heartwood-deep', name: 'The Heartwood Deep', to: ROWS,
        wall: ['#1a120a', '#140e08', '#060403'], dark: '5,4,2',
        wash: { color: '#e0b060', alpha: .06 },
        particles: { kind: 'mote', color: '#7fb85a', count: 10 },
        veins: [],
      },
    ],
  },
};
