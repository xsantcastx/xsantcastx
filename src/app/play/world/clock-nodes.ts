/**
 * clock-nodes.ts — the things in the hunting grounds that keep an hour of the
 * world clock (shared/world-clock; docs/handoff/world-clock.md):
 *
 *  - Moonwake Bloom: a herb that opens only in the dark (night, or under an
 *    eclipse). By day it stands as a shut bud saying so. Sickle I, Foraging 1:
 *    anyone can cut it, the hour is the only gate.
 *  - Eclipse Glass outcrop: only there while an eclipse is on. Pickaxe I,
 *    Mining 1.
 *  - The Ink Lantern drifts the Unrecorded Corridors in the dark; the Afterimage
 *    Moth rises in the Reflection Channels under an eclipse and drops Eclipse
 *    Glass. Both were in the Bestiary and never in the world until the clock.
 *
 * Pure data. Each town file spreads its own into its hunting ground.
 */
import type { GatherNodeDef, MonsterDef, ZoneDropTable } from './world.model';
import { ECLIPSE_GLASS_ID, MOONWAKE_BLOOM_ID } from '../../shared/world-clock/eclipse.model';

/** A Moonwake Bloom at `x` (node id `moonwake`). */
export function moonwakeNode(x: number): GatherNodeDef {
  return {
    id: 'moonwake', x, kind: 'herb', label: 'Moonwake Bloom', tools: { sickle: 1 }, hp: 1, discipline: 'foraging', xp: 3, minLevel: 1,
    yield: { materialId: MOONWAKE_BLOOM_ID, qty: 1 }, respawn: 40, when: 'dark',
  };
}

/** An Eclipse Glass outcrop at `x` (node id `eclipse-glass`). */
export function eclipseGlassNode(x: number): GatherNodeDef {
  return {
    id: 'eclipse-glass', x, kind: 'ore', label: 'Eclipse Glass outcrop', tools: { pickaxe: 1 }, hp: 3, discipline: 'mining', xp: 6, minLevel: 1,
    yield: { materialId: ECLIPSE_GLASS_ID, qty: 1 }, respawn: 45, when: 'eclipse',
  };
}

/** The Ink Lantern: out in the Unrecorded Corridors by dark. Drops what the corridor's table drops. */
export const INK_LANTERN: MonsterDef = { creature: 'ink-lantern', name: 'Ink Lantern', hp: 55, spawnXs: [1450, 1850], when: 'dark' };

/** What an Afterimage Moth leaves: coins, and the eclipse's own glass. */
export const AFTERIMAGE_DROPS: ZoneDropTable = {
  id: 'reflection-channels-afterimage',
  entries: [
    { id: 'coins', kind: 'coins', base: 12, spread: 6 },
    { id: 'eclipse-glass', kind: 'material', material: ECLIPSE_GLASS_ID, art: ECLIPSE_GLASS_ID, label: 'Eclipse Glass', short: 'glass', qty: 1, chance: .8 },
  ],
};

/** The Afterimage Moth: rises in the Reflection Channels only under an eclipse (a rare spawn: one). */
export const AFTERIMAGE_MOTH: MonsterDef = { creature: 'afterimage-moth', name: 'Afterimage Moth', hp: 65, spawnXs: [1400], when: 'eclipse', drops: AFTERIMAGE_DROPS };
