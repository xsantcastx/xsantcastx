/**
 * play-delve-fixtures.ts — build `godforge-delve` saves with the game's OWN code.
 *
 * The production build exposes no `ng` global, so a spec cannot reach the
 * services to set the Delve up. Instead the save is computed in Node by the
 * same pure modules the game runs: `generateTerrain` (the player's seed),
 * `terrainDiff` and `encodeCells` (the on-disk diff) and `terrainLayout` (the
 * key the service files it under). Nothing about the shape is guessed: a
 * fixture is "the player dug these cells and placed this camp", written the way
 * DelveSaveService would write it. The camp is the way in: from town, the
 * shaft's "Descend to your camp" puts the Keeper on the camp's cell, which is
 * how a player reaches the deep rows without a five-minute scripted dig.
 */
import {
  CELL, generateTerrain, isLoose, liquidDiff, liquidLayout, nodeIndex, terrainDiff, terrainLayout, TERRAIN_NODE_LIST, type Terrain,
} from '../src/app/play/engine/terrain';
import { EMBER_DELVE } from '../src/app/play/world/towns/infernal';
import { encodeCells } from '../src/app/shared/delve/delve-save.model';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { miningLevelView } from '../src/app/shared/activity/mining-level';
import type { Blobs } from './play-helpers';

export const DELVE_SEED = 424242;
export const SPEC = EMBER_DELVE.terrain!;
export { CELL, isLoose, nodeIndex, TERRAIN_NODE_LIST };

export class DelveFixture {
  readonly t: Terrain = generateTerrain(SPEC, DELVE_SEED);
  claimed: string[] = [];
  /** Where the camp stands (the Keeper lands on it). */
  campAt: { col: number; row: number } | null = null;

  kindAt(col: number, row: number): string { return TERRAIN_NODE_LIST[this.t.kind[this.t.index(col, row)]].id; }
  baseAt(col: number, row: number): string { return TERRAIN_NODE_LIST[this.t.base[this.t.index(col, row)]].id; }
  set(col: number, row: number, id: string): this {
    const i = this.t.index(col, row);
    if (this.t.inscriptions.has(i)) return this;
    this.t.set(col, row, nodeIndex(id));
    return this;
  }
  /** Dig a rectangle open, as a player with a pickaxe would. Carved walls are never touched. */
  carve(c0: number, c1: number, r0: number, r1: number): this {
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) this.set(col, row, 'air');
    return this;
  }
  /** Lay a floor where the rock under a corridor is open (bedrock, so nothing digs through it by accident). */
  floor(c0: number, c1: number, row: number): this {
    for (let col = c0; col <= c1; col++) if (!this.t.solid(col, row)) this.set(col, row, 'bedrock');
    return this;
  }
  /** Pour a liquid into an open cell (`level` 1-8), as if it had settled there. */
  liquid(col: number, row: number, type: 'water' | 'lava', level = 8): this {
    const i = this.t.index(col, row);
    this.t.liqType[i] = type === 'lava' ? 2 : 1; this.t.liqLevel[i] = level;
    return this;
  }
  camp(col: number, row: number): this {
    this.set(col, row, 'camp');
    this.campAt = { col, row };
    return this;
  }
  /** The Keeper's feet when standing on the camp. */
  campFeet(): { x: number; y: number } {
    const at = this.campAt!;
    return { x: (at.col + .5) * CELL, y: this.t.top + (at.row + 1) * CELL };
  }
  blobs(): Blobs {
    return {
      'godforge-delve': {
        version: 1, seed: DELVE_SEED, createdAt: 1,
        areas: { 'ember-delve': {
          layout: terrainLayout(SPEC, DELVE_SEED), cells: encodeCells(terrainDiff(this.t)),
          // Settled liquid unlike the generated lakes (only when a fixture moved some).
          ...(liquidDiff(this.t).size ? { wet: liquidLayout(SPEC, DELVE_SEED), liquids: encodeCells(liquidDiff(this.t)) } : {}),
        } },
        claimed: this.claimed,
      },
    };
  }
}

/** World x of a column's centre, and world y of a row's centre. */
export const colX = (col: number) => (col + .5) * CELL;
export const rowY = (row: number) => SPEC.top + (row + .5) * CELL;

/** The least total XP that shows `level` on the shared skill curve. */
export function xpForLevel(level: number): number {
  let lo = 0, hi = 2_000_000_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (miningLevelView(mid).level >= level) hi = mid; else lo = mid + 1;
  }
  return lo;
}

/** An activity ledger (the game's own empty ledger) with XP per discipline. Smithing is stored as `forge`. */
export function activity(xp: Partial<Record<string, number>>): Blobs {
  const ledger = emptyActivityLedger();
  ledger.progress.xpByDiscipline = { ...xp } as typeof ledger.progress.xpByDiscipline;
  return { 'godforge-activity': ledger };
}
