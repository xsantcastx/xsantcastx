/**
 * delve-save.service.ts — owns `godforge-delve`: the player's Delve seed, the
 * cells they have dug or placed, and the once-per-player finds already paid.
 * The format and the merge are in delve-save.model.ts.
 *
 * It is the engine's `DelvePersistence` (structurally: `seed`, `cells`,
 * `changed`), handed over by the play view. Digging is fast — a held swing
 * breaks a cell every half second — so cell changes collect in memory and are
 * written through the gateway at most every DEBOUNCE_MS; the gateway then
 * batches the cloud write on its own debounce. `flush()` (registry, pagehide)
 * settles the pending write; `rehydrate()` cancels it and re-reads, so a
 * merged blob from cloud save is never overwritten by this tab's stale copy.
 *
 * The seed is rolled once, the first time a Delve is entered on a device with
 * no save, and written at once. Two devices that rolled before signing in are
 * reconciled by the merge (the earlier seed wins).
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  DELVE_KEY, DelveSave, claimOnce, coerceDelveSave, decodeCells, encodeCells, newDelveSave, rollSeed,
} from './delve-save.model';

/** How long dug cells wait in memory before they are written. */
export const DEBOUNCE_MS = 1500;

@Injectable({ providedIn: 'root' })
export class DelveSaveService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private save: DelveSave | null = null;
  private hydrated = false;
  /** Decoded diffs per area, the live copy `changed()` edits. Encoded on write. */
  private readonly live = new Map<string, { layout: string; cells: Map<number, number> }>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly reloaded$$ = new Subject<void>();

  /** Fires after cloud save replaced the blob: the play view hands the engine the new Delve. */
  readonly reloaded$: Observable<void> = this.reloaded$$.asObservable();

  // ── DelvePersistence (the engine calls these) ─────────────────────────────

  /** The player's seed, rolled and saved on first ask. Undefined on the server: the spec's seed is used. */
  seed(_areaId: string): number | undefined {
    const save = this.ensure();
    return save?.seed;
  }

  cells(areaId: string, layout: string): ReadonlyMap<number, number> | null {
    if (!this.ensure()) return null;
    const area = this.area(areaId, layout);
    return area.cells.size ? area.cells : null;
  }

  changed(areaId: string, layout: string, index: number, kind: number | null): void {
    if (!this.ensure() || !Number.isInteger(index) || index < 0) return;
    const area = this.area(areaId, layout);
    if (kind === null) area.cells.delete(index);
    else area.cells.set(index, kind);
    this.schedule();
  }

  // ── Once-per-player finds ─────────────────────────────────────────────────

  isClaimed(id: string): boolean { return !!this.ensure()?.claimed.includes(id); }

  /** Mark a once-per-player find paid, written at once. True the first time only. */
  claim(id: string): boolean {
    const save = this.ensure();
    if (!save || !claimOnce(save, id)) return false;
    this.write();
    return true;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Settle a pending write now. */
  flush(): void {
    if (!this.timer) return;
    clearTimeout(this.timer); this.timer = null;
    this.write();
  }

  private ensure(): DelveSave | null {
    if (!this.isBrowser) return null;
    if (!this.hydrated) {
      this.hydrated = true;
      this.load();
      this.saves.register(DELVE_KEY, { flush: () => this.flush(), rehydrate: () => this.rehydrate() });
    }
    if (!this.save) {
      this.save = newDelveSave(rollSeed(globalThis.crypto), Date.now());
      this.write();
    }
    return this.save;
  }

  private load(): void {
    this.save = coerceDelveSave(this.store.read(DELVE_KEY));
    this.live.clear();
    for (const [id, area] of Object.entries(this.save?.areas ?? {})) this.live.set(id, { layout: area.layout, cells: decodeCells(area.cells) });
  }

  private rehydrate(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.load();
    this.reloaded$$.next();
  }

  /** The live diff for an area; a diff dug under another layout is dropped here. */
  private area(areaId: string, layout: string): { layout: string; cells: Map<number, number> } {
    let area = this.live.get(areaId);
    if (!area || area.layout !== layout) {
      area = { layout, cells: new Map() };
      this.live.set(areaId, area);
    }
    return area;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.write(); }, DEBOUNCE_MS);
  }

  private write(): void {
    const save = this.save;
    if (!save) return;
    const areas: DelveSave['areas'] = {};
    for (const [id, area] of this.live) areas[id] = { layout: area.layout, cells: encodeCells(area.cells) };
    save.areas = areas;
    this.store.write(DELVE_KEY, save);
  }
}
