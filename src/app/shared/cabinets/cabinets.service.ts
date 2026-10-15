/**
 * cabinets.service.ts — the only writer of `godforge-cabinets`
 * (cabinets-save.model.ts), and the Scan's session state (whether the glass is
 * held up, and what it reads).
 *
 * Reads once on first use, writes through the save gateway on every change and
 * is registered with LocalSaveRegistry, so a cloud merge lands in memory in the
 * same tick.
 *
 *   open(id)  RECEIPT FIRST, then grant: the cabinet id goes into `opened` and
 *             is written before anything moves, so a reload or a second tab can
 *             never pay twice. The curio and the extras through idempotent
 *             stack grants keyed `cabinet:<id>:<item>`, the Gold through the
 *             economy as seconds of income (rule I, economy-sim --cabinets).
 *             The sixteenth cabinet also pays the set's final reward, under
 *             its own receipt (`cabinets:final`). A second open returns null.
 *
 * The Scan itself is not saved: holding the glass up is a moment, not a
 * setting. The play view reads the glass (cabinets.model scanReading) and
 * publishes the reading here for the Slate's Scan face.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { CABINETS_KEY, CabinetsState, coerceCabinets, emptyCabinets } from './cabinets-save.model';
import {
  CABINETS, CRUMBS_MEALS, CURATOR_LOUPE_ID, FINAL_REWARD, PET_HATBOX_ID, SET_BONUSES, cabinetDef, hasBonus,
  type ScanReading, type SetBonusId,
} from './cabinets.model';

export interface CabinetOpen {
  id: string;
  curio: string;
  extras: readonly { id: string; qty: number }[];
  gold: number;
  /** The harder cabinet this one's clue tunes the glass to. */
  clueFor?: string;
  /** How many are open now, and a set bonus reached by this one. */
  opened: number;
  bonus?: SetBonusId;
  /** The set's final reward, paid by the sixteenth. */
  final?: { gold: number; item: string };
}

@Injectable({ providedIn: 'root' })
export class CabinetsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private current: CabinetsState = emptyCabinets();
  private hydrated = false;
  private readonly opened$$ = new BehaviorSubject<ReadonlySet<string>>(new Set());
  private readonly scanning$$ = new BehaviorSubject<boolean>(false);
  private readonly reading$$ = new BehaviorSubject<ScanReading>({ warmth: 'none', id: null, distance: Infinity });

  /** The cabinet ids opened (the engine draws them open; the Codex lists them). */
  readonly opened$: Observable<ReadonlySet<string>> = this.opened$$.asObservable();
  /** The glass is held up (the play view pulses it while you walk). */
  readonly scanning$: Observable<boolean> = this.scanning$$.asObservable();
  /** What the glass reads right now (the play view publishes it). */
  readonly reading$: Observable<ScanReading> = this.reading$$.asObservable();

  get state(): Readonly<CabinetsState> { this.hydrate(); return this.current; }
  get scanning(): boolean { return this.scanning$$.value; }
  get reading(): ScanReading { return this.reading$$.value; }
  openedSet(): ReadonlySet<string> { this.hydrate(); return this.opened$$.value; }
  count(): number { this.hydrate(); return this.current.opened.filter(id => !!cabinetDef(id)).length; }
  bonus(id: SetBonusId): boolean { return hasBonus(this.count(), id); }
  /** Pocketful of Crumbs: the extra meals a day every pet may take. */
  extraMeals(): number { return this.bonus('crumbs') ? CRUMBS_MEALS : 0; }
  /** The Hatbox of Small Crowns is carried: every pet may wear its hat now. */
  hatbox(): boolean { return this.isBrowser && this.inventory.stackOf(PET_HATBOX_ID) > 0; }
  /** The Curator's Loupe is carried: the Scan warms to untouched rift shrines too. */
  loupe(): boolean { return this.isBrowser && this.inventory.stackOf(CURATOR_LOUPE_ID) > 0; }

  /** Hold the glass up, or put it away. */
  setScanning(on: boolean): void {
    if (this.scanning$$.value === on) return;
    this.scanning$$.next(on);
    if (!on) this.reading$$.next({ warmth: 'none', id: null, distance: Infinity });
  }
  /** The play view's latest reading (published only when it changes band or target). */
  setReading(r: ScanReading): void {
    const was = this.reading$$.value;
    if (was.warmth === r.warmth && was.id === r.id) return;
    this.reading$$.next(r);
  }

  /** Open a cabinet. Null when it is unknown, already open, or on the server. */
  open(id: string): CabinetOpen | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    const def = cabinetDef(id);
    if (!def || this.current.opened.includes(id)) return null;
    const before = this.count();
    // Receipt first, on disk, before a single thing moves.
    this.save({ ...this.current, opened: [...this.current.opened, id] });
    const opened = this.count();
    this.inventory.grantStack(`cabinet:${id}:${def.curio}`, def.curio, 1);
    for (const e of def.extras) this.inventory.grantStack(`cabinet:${id}:${e.id}`, e.id, e.qty);
    const gold = this.economy.earnIncome(def.gold, def.goldSeconds, 'cabinets');
    const bonus = SET_BONUSES.find(b => before < b.at && opened >= b.at)?.id;
    const out: CabinetOpen = { id, curio: def.curio, extras: def.extras, gold, opened, ...(def.clueFor ? { clueFor: def.clueFor } : {}), ...(bonus ? { bonus } : {}) };
    const final = this.payFinal();
    return final ? { ...out, final } : out;
  }

  /** The Archivist's reward, once, when every cabinet is open (also catches a merge that completed the set). */
  payFinal(): { gold: number; item: string } | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    if (this.count() < CABINETS.length || this.current.rewards.includes(FINAL_REWARD.id)) return null;
    this.save({ ...this.current, rewards: [...this.current.rewards, FINAL_REWARD.id] });
    this.inventory.grantStack(`${FINAL_REWARD.id}:${FINAL_REWARD.item}`, FINAL_REWARD.item, 1);
    const gold = this.economy.earnIncome(FINAL_REWARD.gold, FINAL_REWARD.goldSeconds, 'cabinets');
    return { gold, item: FINAL_REWARD.item };
  }

  /** Publish what is saved (the host calls it once on mount). */
  refresh(): void { this.hydrate(); this.opened$$.next(new Set(this.current.opened)); }

  private save(next: CabinetsState): void {
    this.current = coerceCabinets(next);
    if (this.isBrowser) this.store.write(CABINETS_KEY, this.current);
    this.opened$$.next(new Set(this.current.opened));
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceCabinets(this.store.read(CABINETS_KEY));
    this.saves.register(CABINETS_KEY, { rehydrate: () => { this.current = coerceCabinets(this.store.read(CABINETS_KEY)); this.opened$$.next(new Set(this.current.opened)); } });
    this.opened$$.next(new Set(this.current.opened));
  }
}
