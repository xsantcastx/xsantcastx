/**
 * The Umbral town — the Nocturne Archive.
 *
 * Canon (Eclipse Realms lore docs): Umbral is secrets, reflection and hidden
 * routes; its landmark is the Nocturne Archive, an obsidian library beneath a
 * fractured moon mirror whose corridors exist only where two reflections
 * disagree. Its creature is the Mirror Substitute (creature atlas, Umbral:
 * "forms beside a redacted testimony… gives the room the answer it most wants
 * to hear"), which the Codex bestiary also places in the Nocturne Archive.
 *
 * Layout west → east: the Waystone by the spawn, the Gambler (sealed boxes,
 * things the realms will not name), the Croupier's Reels, and the Exchange (the merchant houses'
 * board), open stacks with two shelf ledges, then the passage into the
 * Unrecorded Corridors where the Substitutes are hunted. The town itself is
 * safe ground: no monsters, so no `safeX`.
 */
import { FLOOR } from '../../engine/engine.model';
// Types only: world.model imports this file for TOWNS, so a value import back would be a cycle.
import type { GatherNodeDef, HuntZoneDef, TownDef, ZoneDropTable } from '../world.model';

/**
 * What a Mirror Substitute leaves behind. Tuned against the Infernal hunt
 * (Rivet Maw: 60 hp, 8 + kills%5 coins ≈ 10, one Cinder Ore always):
 *
 *  - Substitutes are tougher (75 hp, +25%), as Umbral sits later in the realm
 *    order. Coins scale with it: 10 + kills%6 ≈ 12.5 per kill, which is the
 *    same ~0.167 coins per point of damage as the Maw — no realm is a better
 *    Gold farm, so the Waystone never becomes a coin-hopping exploit.
 *  - Materials are the three that feed the realm's own charm recipe, the
 *    Inkwell Talisman (5 Umbral Ink, 4 Nightbloom, 2 Shadowthread Silk in
 *    crafting.model.ts), weighted toward what it needs most and by rarity:
 *    ink 70% (in eight recipes, ×1–12), nightbloom 35% (two recipes),
 *    silk 12% (an Art Bible *rare*; ×1–10 across ten recipes, so scarce).
 *  - Expected materials per kill: 0.70 + 0.35 + 0.12 = 1.17 units vs the
 *    Maw's 1.0, i.e. ~0.94× the Maw's material rate per hit point — slightly
 *    leaner in count, paid back in the rarer silk. A talisman's worth of drops
 *    takes ~17 kills (silk is the bottleneck), versus a pure grind for ore.
 *  Ids key loot ids, so they must stay unique within the table.
 */
export const NOCTURNE_DROPS: ZoneDropTable = {
  id: 'nocturne-substitute',
  entries: [
    { id: 'coins', kind: 'coins', base: 10, spread: 6 },
    { id: 'ink', kind: 'material', material: 'umbral-ink', art: 'umbral-ink', label: 'Umbral Ink', short: 'ink', qty: 1, chance: 0.7 },
    { id: 'bloom', kind: 'material', material: 'nightbloom', art: 'nightbloom', label: 'Nightbloom', short: 'bloom', qty: 1, chance: 0.35 },
    { id: 'silk', kind: 'material', material: 'shadowthread-silk', art: 'shadowthread-silk', label: 'Shadowthread Silk', short: 'silk', qty: 1, chance: 0.12 },
  ],
};

const TOWN_WIDTH = 2800;
const HUNT_WIDTH = 2700;

/**
 * Gathering in the Corridors: a dusk sapling any axe fells, Nightbloom where
 * the reflections disagree (Sickle III, Foraging 14), and Shadowbark whose
 * silk wants an Axe IV and Woodcutting 45 — Umbral is a late realm.
 */
export const CORRIDOR_NODES: readonly GatherNodeDef[] = [
  { id: 'dusk-sapling', x: 360, kind: 'wood', label: 'Dusk World-Root sapling', tools: { axe: 1 }, hp: 3, discipline: 'woodcutting', xp: 4, minLevel: 1,
    yield: { materialId: 'world-root-bark', qty: 1, chance: .6 }, respawn: 35 },
  { id: 'nightbloom', x: 540, kind: 'herb', label: 'Nightbloom', tools: { sickle: 3 }, hp: 3, discipline: 'foraging', xp: 8, minLevel: 14,
    yield: { materialId: 'nightbloom', qty: 1 }, respawn: 40 },
  { id: 'shadowbark', x: 880, kind: 'wood', label: 'Shadowbark tree', tools: { axe: 4 }, hp: 6, discipline: 'woodcutting', xp: 20, minLevel: 45,
    yield: { materialId: 'shadowthread-silk', qty: 1, chance: .5 }, respawn: 75 },
];

export const UNRECORDED_CORRIDORS: HuntZoneDef = {
  id: 'unrecorded-corridors',
  name: 'Unrecorded Corridors',
  background: 'bg-umbral',
  width: HUNT_WIDTH,
  platforms: [
    { x: 0, y: FLOOR, width: HUNT_WIDTH },
    { x: 620, y: 500, width: 200 }, { x: 1020, y: 430, width: 180 },
    { x: 1460, y: 505, width: 220 }, { x: 1900, y: 430, width: 180 }, { x: 2280, y: 500, width: 200 },
  ],
  stations: [
    { id: 'passage', x: 110, label: 'RETURN TO THE ARCHIVE', kind: 'passage', to: 'umbral', arriveX: 2480, blurb: 'The way back to the Nocturne Archive.' },
  ],
  monsters: [{ creature: 'mirror-substitute', name: 'Mirror Substitute', hp: 75, spawnXs: [1250, 1650, 2050] }],
  drops: NOCTURNE_DROPS,
  nodes: CORRIDOR_NODES,
  spawnX: 240,
  arrival: 'Unrecorded Corridors. The Substitutes wear whoever walks in; break them for ink, bloom and silk. The way back is behind you.',
};

export const UMBRAL_TOWN: TownDef = {
  id: 'umbral',
  realm: 'umbral',
  name: 'Nocturne Archive',
  background: 'bg-umbral',
  width: TOWN_WIDTH,
  platforms: [
    { x: 0, y: FLOOR, width: TOWN_WIDTH },
    // Shelf ledges in the open stacks, clear of every station.
    { x: 1420, y: 500, width: 220 }, { x: 1820, y: 420, width: 200 },
  ],
  stations: [
    { id: 'waystone', x: 360, label: 'WAYSTONE', kind: 'waystone', art: 'rift-portal-core', width: 130, blurb: 'Travel between the realm towns.' },
    { id: 'gambler', x: 760, label: 'THE GAMBLER', kind: 'panel', panel: 'gambler', art: 'eclipse-summoning-sigil', width: 170, blurb: 'Open sealed boxes and sell what the realms hand back.' },
    // Run by the Croupier, who stands between it and the Gambler (life.ts).
    { id: 'reels', x: 975, label: 'THE REELS', kind: 'panel', panel: 'reels', art: 'eclipse', width: 110, blurb: 'Spin three reels for Gold; three Eclipses open the Eclipse Round.' },
    { id: 'exchange', x: 1140, label: 'THE EXCHANGE', kind: 'panel', panel: 'exchange', art: 'gold', width: 170, blurb: 'Trade what you carry with the merchant houses.' },
    { id: 'passage', x: 2640, label: 'UNRECORDED CORRIDORS', kind: 'passage', to: 'unrecorded-corridors', arriveX: 240, width: 120, blurb: 'Where two reflections disagree, a corridor opens.' },
  ],
  monsters: [],
  drops: NOCTURNE_DROPS,
  spawnX: 160,
  arrival: 'Back in the Nocturne Archive. The stacks are quiet; the mirrors are not.',
  hunts: [UNRECORDED_CORRIDORS],
};
