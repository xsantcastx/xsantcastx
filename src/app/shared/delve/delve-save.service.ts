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
  DELVE_KEY, DelveChest, DelveSave, chestKey, claimOnce, coerceDelveSave, decodeCells, decodeSeen, encodeCells, encodeSeen, newDelveSave, rollSeed,
} from './delve-save.model';

interface LiveArea { layout: string; cells: Map<number, number>; seen?: string; bits?: Uint8Array; wet?: string; liquids?: string }

/** How long dug cells wait in memory before they are written. */
export const DEBOUNCE_MS = 1500;

@Injectable({ providedIn: 'root' })
export class DelveSaveService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private save: DelveSave | null = null;
  private hydrated = false;
  /**
   * Decoded diffs per area, the live copy `changed()` edits. Encoded on write.
   * `seen` is the explored-cells string as loaded; `bits` the decoded copy the
   * engine holds and edits once it has asked (`seenCells`).
   */
  private readonly live = new Map<string, LiveArea>();
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

  /** The map's explored cells for that layout: one bit per cell, the array the engine keeps and edits. */
  seenCells(areaId: string, layout: string, cells: number): Uint8Array | null {
    if (!this.ensure() || !Number.isInteger(cells) || cells <= 0) return null;
    const area = this.area(areaId, layout);
    if (!area.bits || area.bits.length !== (cells + 7) >> 3) area.bits = decodeSeen(area.seen, cells);
    return area.bits;
  }

  /** The engine explored more of the map (it edited the bits in place): written on the same debounce as digs. */
  explored(areaId: string, layout: string, bits: Uint8Array): void {
    if (!this.ensure()) return;
    const area = this.area(areaId, layout);
    area.bits = bits;
    this.schedule();
  }

  /** Settled liquid unlike the generated lakes, under liquid layout `wet`. */
  liquids(areaId: string, wet: string): ReadonlyMap<number, number> | null {
    if (!this.ensure()) return null;
    const area = this.live.get(areaId);
    if (!area || area.wet !== wet) return null;
    const cells = decodeCells(area.liquids);
    return cells.size ? cells : null;
  }

  /** The liquid settled (or a reaction or a bucket moved it): the whole diff, written on the same debounce as digs. */
  liquidsChanged(areaId: string, wet: string, cells: ReadonlyMap<number, number>): void {
    if (!this.ensure()) return;
    const area = this.live.get(areaId);
    if (!area) return;
    area.wet = wet;
    area.liquids = encodeCells(cells);
    this.schedule();
  }

  /**
   * Whether the player has dug (or placed) anything in this area yet, under any
   * layout. A read only: it never rolls a seed or writes a save, so asking it on
   * a first visit leaves a browser that has not entered the Delve untouched.
   */
  hasDug(areaId: string): boolean {
    if (!this.isBrowser) return false;
    if (!this.hydrated) {
      const raw = coerceDelveSave(this.store.read(DELVE_KEY));
      return !!raw?.areas?.[areaId]?.cells;
    }
    return (this.live.get(areaId)?.cells.size ?? 0) > 0;
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

  // ── Chests (contents; DelveChestService moves the stacks) ─────────────────

  /**
   * The chest record at a cell of an area, made on first ask (`create`) under
   * the area's live layout. Null on the server, or when there is none and
   * `create` is false.
   */
  chest(areaId: string, index: number, create = true): DelveChest | null {
    const save = this.ensure();
    if (!save) return null;
    const key = chestKey(areaId, index);
    const layout = this.live.get(areaId)?.layout ?? '';
    let chest = save.chests?.[key];
    if (!create) return chest && chest.layout === layout ? chest : null;
    if (!chest || chest.layout !== layout) {
      chest = { layout, born: Date.now() * 1000 + Math.floor(Math.random() * 1000), n: 0, slots: {} };
      save.chests = { ...(save.chests ?? {}), [key]: chest };
    }
    return chest;
  }

  /** Every chest record with its key, for the orphan sweep. */
  chests(): { key: string; areaId: string; index: number; chest: DelveChest }[] {
    const save = this.ensure();
    return Object.entries(save?.chests ?? {}).map(([key, chest]) => {
      const at = key.lastIndexOf(':');
      return { key, areaId: key.slice(0, at), index: parseInt(key.slice(at + 1), 36), chest };
    });
  }

  /** The layout an area is dug under right now (once the engine has asked), or null. */
  layoutOf(areaId: string): string | null { return this.live.get(areaId)?.layout ?? null; }

  /** Write a chest's new contents now (moves are rare; the satchel side already saved). */
  saveChest(): void { if (this.save) this.write(); }

  /** Forget a chest (taken back empty, or refunded). */
  dropChest(key: string): void {
    const save = this.ensure();
    if (!save?.chests?.[key]) return;
    const { [key]: _gone, ...rest } = save.chests;
    save.chests = Object.keys(rest).length ? rest : undefined;
    if (!save.chests) delete save.chests;
    this.write();
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
    for (const [id, area] of Object.entries(this.save?.areas ?? {})) this.live.set(id, { layout: area.layout, cells: decodeCells(area.cells), seen: area.seen, wet: area.wet, liquids: area.liquids });
  }

  private rehydrate(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.load();
    this.reloaded$$.next();
  }

  /** The live diff for an area; a diff dug under another layout is dropped here. */
  private area(areaId: string, layout: string): LiveArea {
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
    for (const [id, area] of this.live) {
      const seen = area.bits ? encodeSeen(area.bits) : area.seen;
      areas[id] = { layout: area.layout, cells: encodeCells(area.cells), ...(seen ? { seen } : {}), ...(area.wet ? { wet: area.wet, liquids: area.liquids ?? '' } : {}) };
    }
    save.areas = areas;
    this.store.write(DELVE_KEY, save);
  }
}
