/**
 * heights.service.ts — the only writer of `godforge-heights` (heights-save.model.ts).
 *
 * Reads once on first use, writes through the save gateway on every change and
 * is registered with LocalSaveRegistry, so a cloud merge lands in memory in the
 * same tick.
 *
 *   use(id)   RECEIPT FIRST, then pay: the find id goes into `found` and is
 *             written before a coin moves, so a reload or a second tab can never
 *             pay twice. Gold through the economy as seconds of income (rule I,
 *             economy-sim --heights), materials through idempotent stack grants
 *             keyed `height:<id>:<material>`, a summit's title into `titles`.
 *             A second use returns null (nothing is paid again).
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { HEIGHTS_KEY, HeightsState, coerceHeights, emptyHeights } from './heights-save.model';
import { heightFind, HUNT_HEIGHTS } from '../../play/world/heights';

export interface HeightUse {
  id: string;
  kind: 'cache' | 'carving' | 'lookout' | 'summit';
  gold: number;
  materials: readonly { id: string; qty: number }[];
  /** A summit: the realm whose title was earned. */
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class HeightsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private current: HeightsState = emptyHeights();
  private hydrated = false;
  private readonly found$$ = new BehaviorSubject<ReadonlySet<string>>(new Set());

  /** The find ids used, as a set (the engine draws opened caches from it). */
  readonly found$: Observable<ReadonlySet<string>> = this.found$$.asObservable();

  get state(): Readonly<HeightsState> { this.hydrate(); return this.current; }

  /** Use a find. Null when it is unknown, already used, or on the server. */
  use(id: string): HeightUse | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    const find = heightFind(id);
    if (!find || this.current.found.includes(id)) return null;
    const realm = find.kind === 'summit' ? Object.values(HUNT_HEIGHTS).find(h => h.finds.includes(find))?.realm : undefined;
    // Receipt first, on disk, before a single coin moves.
    this.save({ ...this.current, found: [...this.current.found, id], titles: realm && !this.current.titles.includes(realm) ? [...this.current.titles, realm] : this.current.titles });
    const reward = find.reward;
    const gold = reward ? this.economy.earnIncome(reward.gold, reward.goldSeconds, 'heights') : 0;
    for (const m of reward?.materials ?? []) this.inventory.grantStack(`height:${id}:${m.id}`, m.id, m.qty);
    return { id, kind: find.kind, gold, materials: reward?.materials ?? [], ...(realm ? { title: realm } : {}) };
  }

  private save(next: HeightsState): void {
    this.current = coerceHeights(next);
    if (this.isBrowser) this.store.write(HEIGHTS_KEY, this.current);
    this.found$$.next(new Set(this.current.found));
  }

  /** Publish what is saved (the host calls it once on mount). */
  refresh(): void { this.hydrate(); this.found$$.next(new Set(this.current.found)); }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceHeights(this.store.read(HEIGHTS_KEY));
    this.saves.register(HEIGHTS_KEY, { rehydrate: () => { this.current = coerceHeights(this.store.read(HEIGHTS_KEY)); this.found$$.next(new Set(this.current.found)); } });
    this.found$$.next(new Set(this.current.found));
  }
}
