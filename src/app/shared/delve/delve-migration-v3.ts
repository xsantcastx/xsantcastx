/**
 * delve-migration-v3.ts — v2 → v3, once, on the first load with One World on
 * (docs/design/one-world.md §4.2; the owner's call, 2026-10-15).
 *
 *   godforge-delve.claimed   copied into the world save's `claimed` (felled guardians,
 *                            fragments, `rift-attuned:*`, paid finds: progress, not terrain)
 *   godforge-delve.chests    contents come home: each stack granted back under the op id
 *                            `v3-chest:<born>:<stack>` (the satchel; a full one sends it to
 *                            the Vault), each piece of gear the chest held stowed in the Vault
 *   v2 digs, regions, slots  NOT migrated: the world moved (a settlement stands on the
 *                            surface now). The core and wings regenerate under it.
 *
 * Nothing is ever deleted ("M3"): v2's keys stay exactly as they were, so the
 * gate off is the old game. Idempotent: the grants are keyed (a replay is the
 * ledger's no-op), and the world save carries `migrated: 'v2'` once done.
 */
import { Injectable, inject } from '@angular/core';
import { InventoryService } from '../rpg/inventory.service';
import { DelveSaveService } from './delve-save.service';
import { chestHolderId, type DelveSave } from './delve-save.model';

/** What a v2 save hands to v3: its claims, and each chest's stacks and gear holder. Pure. */
export interface V2MigrationPlan {
  claimed: string[];
  chests: { born: number; holder: string; stacks: { stackKey: string; qty: number; opId: string }[] }[];
}
export function planV2Migration(v2: DelveSave | null): V2MigrationPlan {
  if (!v2) return { claimed: [], chests: [] };
  const chests = Object.values(v2.chests ?? {}).map(chest => ({
    born: chest.born,
    holder: chestHolderId(chest),
    stacks: Object.entries(chest.slots).filter(([, qty]) => qty > 0).map(([stackKey, qty]) => ({ stackKey, qty, opId: `v3-chest:${chest.born}:${stackKey}` })),
  }));
  return { claimed: [...new Set(v2.claimed)].sort(), chests };
}

export interface V2MigrationResult { claims: number; stacks: number; gear: number }

@Injectable({ providedIn: 'root' })
export class WorldMigrationService {
  private readonly delve = inject(DelveSaveService);
  private readonly inventory = inject(InventoryService);

  /** Bring v2's claims and chests across, once. Null when there is nothing to do (gate off, done, the server). */
  run(): V2MigrationResult | null {
    if (!this.delve.oneWorld || this.delve.migratedFromV2) return null;
    const plan = planV2Migration(this.delve.readV2());
    let claims = 0, stacks = 0, gear = 0;
    for (const id of plan.claimed) if (this.delve.claim(id)) claims++;
    for (const chest of plan.chests) {
      for (const s of chest.stacks) if (this.inventory.grantStack(s.opId, s.stackKey, s.qty)) stacks += s.qty;
      for (const item of this.inventory.itemsOnExplorer(chest.holder)) {
        // Into the satchel (the grid: nothing goes to the Vault by itself); no room keeps it on the "no room" strip.
        if (this.inventory.unequip(item.id)) gear++;
      }
    }
    this.delve.markMigrated();
    return { claims, stacks, gear };
  }
}
