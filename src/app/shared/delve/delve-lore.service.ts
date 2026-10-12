/**
 * delve-lore.service.ts — which of the Delve's carved inscriptions this player
 * has read. The seam the lore / missions work builds on (Archivist copies,
 * Codex entries); keep the public API exactly as it is:
 *
 *   recordInscription(id): boolean     true when the reading is new
 *   inscriptions(): ReadonlySet<string>
 *   inscription$: Observable<ReadonlySet<string>>   the read set, now and on every change
 *
 * The ids, their biomes and placeholder text live in delve-lore.model.ts.
 * Delving XP for a first reading is paid by the caller (the play view), so this
 * service stays a leaf any page can inject without dragging the activity
 * ledger along.
 *
 * Saved through the gateway as `godforge-delve-lore` (synced: progress/delve-lore),
 * registered with LocalSaveRegistry so a cloud merge lands in memory, never
 * clobbered by a stale copy.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { DELVE_LORE_KEY, DelveLoreState, coerceDelveLore, emptyDelveLore, recordInscriptionIn } from './delve-lore.model';

@Injectable({ providedIn: 'root' })
export class DelveLoreService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private state: DelveLoreState = emptyDelveLore();
  private hydrated = false;
  private readonly read$$ = new BehaviorSubject<ReadonlySet<string>>(new Set());

  /** The set of inscription ids read. Emits the current set on subscribe, and again on every change. */
  readonly inscription$: Observable<ReadonlySet<string>> = defer(() => { this.hydrate(); return this.read$$.asObservable(); });

  /** Record a reading. True the first time this player reads `id`; false for a repeat, an unknown id, or on the server. */
  recordInscription(id: string): boolean {
    this.hydrate();
    if (!this.isBrowser || !recordInscriptionIn(this.state, id)) return false;
    this.store.write(DELVE_LORE_KEY, this.state);
    this.publish();
    return true;
  }

  inscriptions(): ReadonlySet<string> {
    this.hydrate();
    return this.read$$.value;
  }

  /** Read once, on first use; registering means "holding a copy". Idempotent. */
  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.state = coerceDelveLore(this.store.read(DELVE_LORE_KEY));
    this.publish();
    // Writes go through on every reading, so there is nothing to flush; a merged
    // copy written by cloud save is re-read in the same tick.
    this.saves.register(DELVE_LORE_KEY, { rehydrate: () => { this.state = coerceDelveLore(this.store.read(DELVE_LORE_KEY)); this.publish(); } });
  }

  private publish(): void {
    this.read$$.next(new Set(this.state.inscriptions));
  }
}
