/**
 * The Prism Mines — the Luminous realm's underside, behind the Luminous Rift
 * Gate in the Glowcap Grotto (shared/delve/rift-gates.model.ts; the generator
 * is engine/luminous-gen.ts, the broken rule engine/luminous.ts). Lore:
 * lore-addendum.md, "The Prism Mines" (shipped — owner reviews in play).
 *
 * A hunt of the Infernal town only because that is where its door is: it has
 * no passage from any town. Canon: not a sixth realm, not the Void
 * (delve-and-beyond.md §1.2): the rock under the Luminous towns, where their
 * sun comes through in beams.
 *
 * A step up from the Ember Delve before it: Pickaxe III–IV rock, creatures
 * that hit harder, rewards higher on the curve, and light you can stand on.
 */
import { FLOOR } from '../../engine/engine.model';
import type { HuntZoneDef, ZoneDropTable } from '../world.model';

/** The flag the Hollow Sun sets when it falls (the same string as delve-missions.model's HOLLOW_SUN_FLAG; a spec pins them). */
export const HOLLOW_SUN_FLAG = 'hollow-sun-defeated';

/**
 * Bestiary (lore-addendum.md, The Prism Mines):
 *  - Prismling: "a little light that set" — prismite, now and then dawnglass.
 *  - The Hollow Sun: "the light that was promised and never arrived" — dawnglass, prismite, a prism.
 */
export const PRISMLING_DROPS: ZoneDropTable = {
  id: 'luminous-prismling',
  entries: [
    { id: 'coins', kind: 'coins', base: 38, spread: 12 },
    { id: 'prismite', kind: 'material', material: 'prismite', art: 'prismite', label: 'Prismite', short: 'prism', qty: 1, chance: 0.5, rarity: 'uncommon' },
    { id: 'dawnglass', kind: 'material', material: 'dawnglass', art: 'dawnglass', label: 'Dawnglass', short: 'glass', qty: 1, chance: 0.12, rarity: 'rare' },
  ],
};
export const HOLLOW_SUN_DROPS: ZoneDropTable = {
  id: 'luminous-hollow-sun',
  entries: [
    { id: 'coins', kind: 'coins', base: 170, spread: 40 },
    { id: 'dawnglass', kind: 'material', material: 'dawnglass', art: 'dawnglass', label: 'Dawnglass', short: 'glass', qty: 3, rarity: 'rare' },
    { id: 'prismite', kind: 'material', material: 'prismite', art: 'prismite', label: 'Prismite', short: 'prism', qty: 4, rarity: 'uncommon' },
    { id: 'prism', kind: 'material', material: 'luminous-prism', art: 'luminous-prism', label: 'Luminous Prism', short: 'prism', qty: 1, chance: 0.5, rarity: 'rare' },
  ],
};

const COLS = 64;
const ROWS = 64;
const CELL = 32;
const row = (r: number) => FLOOR + r * CELL;
const col = (c: number) => c * CELL;

export const LUMINOUS_DELVE: HuntZoneDef = {
  id: 'luminous-delve',
  name: 'The Prism Mines',
  background: 'bg-luminous',
  width: COLS * CELL,
  platforms: [{ x: 0, y: row(ROWS), width: COLS * CELL }],
  stations: [],
  monsters: [
    // Prismlings gather in the galleries the generator lays (luminous-gen.ts): no fixed spawns.
    { creature: 'prismling', name: 'Prismling', hp: 250, spawnXs: [], drops: PRISMLING_DROPS },
    // The Hollow Sun's hall, under the Gate Hollow: it stands there until it falls, once per player.
    { creature: 'hollow-sun', name: 'The Hollow Sun', hp: 1200, spawnXs: [col(32) + 16], floorY: row(54),
      range: [col(14), col(56)], once: HOLLOW_SUN_FLAG, trait: 'prism', drops: HOLLOW_SUN_DROPS },
  ],
  drops: PRISMLING_DROPS,
  spawnX: col(35) + 16,
  figureScale: .5,
  arrival: 'The Prism Mines. The sun comes through the rock here, and where it falls, it holds you up.',
  terrain: {
    seed: 0x1a_c0de,
    version: 1,
    cols: COLS,
    rows: ROWS,
    top: FLOOR,
    // The core's bands only feed the shared context; luminous-gen.ts lays every cell.
    bands: [{ to: 31, node: 'prism-stone' }, { to: ROWS, node: 'dawnstone' }],
    jitter: 1.5,
    endless: true,
    realm: 'luminous',
    veins: [],
    stamps: [],
    bedrock: 2,
    biomes: [
      {
        id: 'prism-galleries', name: 'The Prism Galleries', to: 34,
        // Style guide §5.3, the Luminous ramps: ivory, gold, a dawn lift.
        wall: ['#2a2418', '#221c12', '#0e0b06'], dark: '6,5,2',
        wash: { color: '#ffe9a8', alpha: .08 },
        particles: { kind: 'mote', color: '#fff1b0', count: 14 },
        veins: [],
      },
      {
        id: 'dawnglass-deep', name: 'The Dawnglass Deep', to: ROWS,
        wall: ['#221e14', '#1a160e', '#080604'], dark: '5,4,2',
        wash: { color: '#fff1b0', alpha: .06 },
        particles: { kind: 'mote', color: '#e8d8a0', count: 10 },
        veins: [],
      },
    ],
  },
};
