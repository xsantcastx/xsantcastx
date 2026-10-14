/**
 * The Luminous town — the Heliograph Court, a sunlit-stone observatory whose
 * suspended dawn prisms replay civic memory across a shallow reflecting court
 * (five-realm narrative bible, chapter 1 "The Missing Dawn").
 *
 * Layout west → east: the arrival steps (spawn), the Market under the prisms,
 * the Waystone, then the east stair down to the Reflection Channels — the
 * Court's public reflection channels, where the Prism Foragers nest in cracked
 * dawn glass (creature atlas, "Luminous creatures — Heliograph Court"). The
 * Court itself is a market town: no monsters walk it.
 *
 * Copies the shape of the Infernal town file; the types live in the world model.
 */
import { FLOOR } from '../../engine/engine.model';
import { HUNT_HEIGHTS } from '../heights';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { GatherNodeDef, HuntZoneDef, Platform, TownDef, ZoneDropTable } from '../world.model';

/**
 * What a Prism Forager spills. Every material is a real inventory stack in the
 * material catalogue, and together they are exactly the Aurumleaf Pendant
 * (crafting.model `craft-aurumleaf-pendant`: 2 Solar Resin + 4 Luminous Prism
 * + 6 Sunbloom — all three Luminous materials, the realm's cheapest recipe).
 * Dawnrender, Liquid Dawn and the Luminous armour use the same three.
 *
 * Tuning against Ember Quarry (Maw: 60 HP, 1 Cinder Ore every kill, 6 ore +
 * 1 residue makes a Basalt Edge ≈ 6–7 kills):
 *   - Forager 70 HP: 7 unarmed strikes (10) or 4 with a Basalt Edge (20) — a
 *     touch sturdier than a Maw, since this hunt pays out three materials.
 *   - Expected kills per stack the pendant needs:
 *       Luminous Prism  4 / 0.60 ≈ 6.7
 *       Sunbloom        6 / 0.75 = 8.0   (the binding one)
 *       Solar Resin     2 / 0.30 ≈ 6.7   (rare: a resin is the art bible's
 *                                          `rare` material; the others are common)
 *   - So ~8 kills feed one pendant. Three Foragers on an 8 s respawn, ~15–20 s
 *     a kill with the walking, is two to three minutes of hunting — the same
 *     order as forging the first Basalt Edge.
 *   - Coins 10 + kills%6 (Ember Quarry: 8 + kills%5): slightly richer to match
 *     the extra HP; the Pendant itself still costs its Gold at the bench.
 */
export const PRISM_CHANNEL_DROPS: ZoneDropTable = {
  id: 'reflection-channels-forager',
  entries: [
    { id: 'coins', kind: 'coins', base: 10, spread: 6 },
    { id: 'prism', kind: 'material', material: 'luminous-prism', art: 'luminous-prism', label: 'Luminous Prism', short: 'prism', qty: 1, chance: 0.6 },
    { id: 'sunbloom', kind: 'material', material: 'sunbloom', art: 'sunbloom', label: 'Sunbloom', short: 'bloom', qty: 1, chance: 0.75 },
    { id: 'resin', kind: 'material', material: 'solar-resin', art: 'solar-resin', label: 'Solar Resin', short: 'resin', qty: 1, chance: 0.3 },
  ],
};

const TOWN_WIDTH = 2600;
const HUNT_WIDTH = 2700;

/** The Court's terraces: two low ledges by the Market, one by the stair. */
const COURT_PLATFORMS: Platform[] = [
  { x: 420, y: 500, width: 200 }, { x: 1320, y: 470, width: 220 }, { x: 1900, y: 420, width: 180 },
];

/**
 * Gathering in the Channels: starlight on the stair foot for anyone, Sunbloom
 * in the cracked dawn glass (Sickle II, Foraging 6), and a Golden Oak past the
 * safe line whose resin wants an Axe III and Woodcutting 25.
 */
export const REFLECTION_CHANNEL_NODES: readonly GatherNodeDef[] = [
  { id: 'starlight-patch', x: 330, kind: 'herb', label: 'Starlight Herb patch', tools: { sickle: 1 }, hp: 1, discipline: 'foraging', xp: 2, minLevel: 1,
    yield: { materialId: 'starlight-herb', qty: 1 }, respawn: 25 },
  { id: 'sunbloom', x: 480, kind: 'herb', label: 'Sunbloom', tools: { sickle: 2 }, hp: 2, discipline: 'foraging', xp: 4, minLevel: 6,
    yield: { materialId: 'sunbloom', qty: 1 }, respawn: 30 },
  { id: 'golden-oak', x: 1000, kind: 'wood', label: 'Golden Oak', tools: { axe: 3 }, hp: 5, discipline: 'woodcutting', xp: 12, minLevel: 25,
    yield: { materialId: 'solar-resin', qty: 1, chance: .5 }, respawn: 60 },
];

export const REFLECTION_CHANNELS: HuntZoneDef = {
  id: 'reflection-channels',
  name: 'Reflection Channels',
  background: 'bg-luminous',
  width: HUNT_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: HUNT_WIDTH }],
  // The high ground (world/heights.ts): trees, shelves, ruins and the summit route.
  heights: HUNT_HEIGHTS['reflection-channels'],
  stations: [
    { id: 'passage', x: 110, label: 'RETURN TO THE COURT', kind: 'passage', to: 'luminous', arriveX: 2320, blurb: 'The stair back up to the Heliograph Court.' },
  ],
  monsters: [{ creature: 'prism-forager', name: 'Prism Forager', hp: 70, spawnXs: [1150, 1650, 2150] }, ...HUNT_HEIGHTS['reflection-channels'].perched],
  drops: PRISM_CHANNEL_DROPS,
  nodes: REFLECTION_CHANNEL_NODES,
  spawnX: 240,
  // The stair foot is quiet ground: Foragers stand down while the Keeper is west of it.
  safeX: 600,
  arrival: 'The Reflection Channels. Prism Foragers drop Luminous Prism, Sunbloom and Solar Resin. The stair home is behind you.',
};

export const LUMINOUS_TOWN: TownDef = {
  id: 'luminous',
  realm: 'luminous',
  name: 'Heliograph Court',
  background: 'bg-luminous',
  width: TOWN_WIDTH,
  platforms: [{ x: 0, y: FLOOR, width: TOWN_WIDTH }, ...COURT_PLATFORMS],
  stations: [
    { id: 'market', x: 820, label: 'THE MARKET', kind: 'panel', panel: 'market', art: 'luminous-prism', width: 190, blurb: 'Spend Gold and Essence on upgrades under the dawn prisms.' },
    { id: 'waystone', x: 1620, label: 'WAYSTONE', kind: 'waystone', art: 'rift-portal-core', width: 130, blurb: 'Travel between the realm towns.' },
    { id: 'passage', x: 2440, label: 'EAST STAIR', kind: 'passage', to: 'reflection-channels', arriveX: 240, width: 120, blurb: 'Down to the Reflection Channels, where Prism Foragers nest.' },
  ],
  monsters: [],
  drops: PRISM_CHANNEL_DROPS,
  spawnX: 200,
  arrival: 'The Heliograph Court. The Market stands under the dawn prisms; the east stair leads down to the Foragers.',
  hunts: [REFLECTION_CHANNELS],
};
