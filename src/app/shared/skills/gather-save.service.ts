/**
 * gather-save.service.ts — owns `godforge-gathering`: when each hunting-ground
 * gathering node was last harvested. The format and the merge are in
 * gather-save.model.ts.
 *
 * It is the engine's `GatherPersistence` (structurally: `harvestedAt`,
 * `harvested`), handed over by the play view. A harvest takes a swing or
 * three and then rests the node for 25-75 s, so writes are rare and go
 * straight through the gateway (which batches the cloud write on its own
 * debounce); there is nothing to flush. `rehydrate()` re-reads a merged blob
 * and tells the play view, which hands the engine the new timestamps.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  GATHER_KEY, GatherSave, coerceGatherSave, emptyGatherSave, harvestedAtIn, pruneGatherSave, recordHarvestIn,
} from './gather-save.model';

@Injectable({ providedIn: 'root' })
export class GatherSaveService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private save: GatherSave = emptyGatherSave();
  private hydrated = false;
  private readonly reloaded$$ = new Subject<void>();

  /** Fires after cloud save replaced the blob: the play view hands the engine the new timestamps. */
  readonly reloaded$: Observable<void> = this.reloaded$$.asObservable();

  /** Epoch ms of a node's last harvest, or null (never, or on the server). */
  harvestedAt(areaId: string, nodeId: string): number | null {
    if (!this.hydrate()) return null;
    return harvestedAtIn(this.save, areaId, nodeId);
  }

  /** A node was harvested at `at` (epoch ms). Idempotent: the later stamp is kept. */
  harvested(areaId: string, nodeId: string, at: number): void {
    if (!this.hydrate() || !recordHarvestIn(this.save, areaId, nodeId, at)) return;
    this.store.write(GATHER_KEY, pruneGatherSave(this.save, Date.now()));
  }

  /** Read once, on first use; registering means "holding a copy". False on the server. */
  private hydrate(): boolean {
    if (!this.isBrowser) return false;
    if (!this.hydrated) {
      this.hydrated = true;
      this.save = coerceGatherSave(this.store.read(GATHER_KEY));
      this.saves.register(GATHER_KEY, {
        rehydrate: () => { this.save = coerceGatherSave(this.store.read(GATHER_KEY)); this.reloaded$$.next(); },
      });
    }
    return true;
  }
}
