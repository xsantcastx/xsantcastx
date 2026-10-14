/**
 * The Ink Deeps — the Umbral realm's underside, behind the Umbral Rift Gate in
 * the Underhearth (shared/delve/rift-gates.model.ts; the generator is
 * engine/realm-gen.ts, the broken rule engine/umbral.ts). Lore:
 * lore-addendum.md, "The Rift Gates" (shipped — owner reviews in play).
 *
 * A hunt of the Infernal town only because that is where its door is: it has
 * no passage from any town. The Keeper steps in through the gate and back out
 * through it (or a Rift Anchor of this world). Canon: not a sixth realm, not
 * the Void (delve-and-beyond.md §1.2): the rock under the Umbral realm's towns.
 *
 * A step up from the Underhearth before it: Pickaxe IV rock, creatures that hit
 * harder, rewards higher on the curve, and the dark itself unreliable.
 */
import { FLOOR } from '../../engine/engine.model';
import type { HuntZoneDef, ZoneDropTable } from '../world.model';

/** The flag the Gloam Warden sets when it falls (the same string as delve-missions.model's GLOAM_WARDEN_FLAG; a spec pins them). */
export const GLOAM_WARDEN_FLAG = 'gloam-warden-defeated';

/**
 * Bestiary (lore-addendum.md, The Rift Gates):
 *  - Shadeling: "a shade that only moves where no light is" — what it carries
 *    out of the dark: inkstone, now and then nightglass.
 *  - The Gloam Warden: "keeps the dark that was left when the light went
 *    somewhere else" — nightglass, inkstone and the realm's ink.
 */
export const SHADELING_DROPS: ZoneDropTable = {
  id: 'umbral-shadeling',
  entries: [
    { id: 'coins', kind: 'coins', base: 36, spread: 12 },
    { id: 'inkstone', kind: 'material', material: 'inkstone', art: 'inkstone', label: 'Inkstone', short: 'ink', qty: 1, chance: 0.5, rarity: 'uncommon' },
    { id: 'nightglass', kind: 'material', material: 'nightglass', art: 'nightglass', label: 'Nightglass', short: 'glass', qty: 1, chance: 0.12, rarity: 'rare' },
  ],
};
export const GLOAM_WARDEN_DROPS: ZoneDropTable = {
  id: 'umbral-gloam-warden',
  entries: [
    { id: 'coins', kind: 'coins', base: 160, spread: 40 },
    { id: 'nightglass', kind: 'material', material: 'nightglass', art: 'nightglass', label: 'Nightglass', short: 'glass', qty: 3, rarity: 'rare' },
    { id: 'inkstone', kind: 'material', material: 'inkstone', art: 'inkstone', label: 'Inkstone', short: 'ink', qty: 4, rarity: 'uncommon' },
    { id: 'ink', kind: 'material', material: 'umbral-ink', art: 'umbral-ink', label: 'Umbral Ink', short: 'ink', qty: 1, chance: 0.5, rarity: 'rare' },
  ],
};

const COLS = 64;
const ROWS = 64;
const CELL = 32;
const row = (r: number) => FLOOR + r * CELL;
const col = (c: number) => c * CELL;

export const UMBRAL_DELVE: HuntZoneDef = {
  id: 'umbral-delve',
  name: 'The Ink Deeps',
  background: 'bg-umbral',
  width: COLS * CELL,
  platforms: [{ x: 0, y: row(ROWS), width: COLS * CELL }],
  stations: [],
  monsters: [
    // Shades rest in the dens the generator lays (realm-gen.ts): no fixed spawns.
    { creature: 'shadeling', name: 'Shadeling', hp: 240, spawnXs: [], trait: 'shade', drops: SHADELING_DROPS },
    // The Gloam Warden's hall, under the Gate Hollow: it stands there until it falls, once per player.
    { creature: 'gloam-warden', name: 'The Gloam Warden', hp: 1100, spawnXs: [col(32) + 16], floorY: row(54),
      range: [col(8), col(56)], once: GLOAM_WARDEN_FLAG, trait: 'warden', drops: GLOAM_WARDEN_DROPS },
  ],
  drops: SHADELING_DROPS,
  spawnX: col(35) + 16,
  figureScale: .5,
  arrival: 'The Ink Deeps. Your lantern barely reaches here: light is how you push the dark back.',
  terrain: {
    seed: 0x1e_c0de,
    version: 1,
    cols: COLS,
    rows: ROWS,
    top: FLOOR,
    // The core's bands only feed the shared context; realm-gen.ts lays every cell.
    bands: [{ to: 31, node: 'ink-slate' }, { to: ROWS, node: 'gloam-slate' }],
    jitter: 1.5,
    endless: true,
    realm: 'umbral',
    veins: [],
    stamps: [],
    bedrock: 2,
    biomes: [
      {
        id: 'ink-shallows', name: 'The Ink Shallows', to: 34,
        // Style guide §5.3 proposal, the Umbral ramps: ink violet-black, a cold violet lift.
        wall: ['#1a1424', '#15101e', '#08060c'], dark: '3,2,8',
        wash: { color: '#6a4adf', alpha: .08 },
        particles: { kind: 'mote', color: '#8a7ab0', count: 12 },
        gloom: .5,
        veins: [],
      },
      {
        id: 'gloam-deep', name: 'The Gloam Deep', to: ROWS,
        wall: ['#120e1a', '#0e0a16', '#040308'], dark: '2,1,6',
        wash: { color: '#a48bff', alpha: .06 },
        particles: { kind: 'ash', color: '#6a5a86', count: 10 },
        gloom: .42,
        veins: [],
      },
    ],
  },
};
