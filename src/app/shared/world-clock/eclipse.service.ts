/**
 * eclipse.service.ts — the only writer of `godforge-eclipse` (Sera Quill's
 * Eclipse Ledger; eclipse.model.ts, eclipse-save.model.ts).
 *
 *   witness(w)  RECEIPT FIRST: the eclipse id goes into `seen` (and every mark
 *               it reaches into `marks`) and is written before anything moves,
 *               so a reload, a retry or a second tab never pays twice. Then the
 *               observation's income, each new mark's income and its Eclipse
 *               Glass (stack grants keyed `eclipse:<mark>:glass`, idempotent).
 *               A second witness of the same eclipse returns null.
 *   catchUp()   a cloud merge that crossed a mark: pay it (its own receipt).
 *
 * Reads once on first use, writes through the save gateway, and is registered
 * with LocalSaveRegistry so a cloud merge lands in memory in the same tick.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { ECLIPSE_KEY, coerceEclipse, emptyEclipse, witnessed, type EclipseState } from './eclipse-save.model';
import { ECLIPSE_GLASS_ID, LEDGER_MARKS, OBSERVATION, marksDue, type LedgerMark } from './eclipse.model';
import type { EclipseWindow } from './world-clock.model';

export interface Witnessed {
  id: number;
  /** Observations now, this one included. */
  count: number;
  gold: number;
  /** Marks this observation reached (each paid once). */
  marks: { at: number; gold: number; glass: number }[];
}

@Injectable({ providedIn: 'root' })
export class EclipseService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private current: EclipseState = emptyEclipse();
  private hydrated = false;
  private readonly count$$ = new BehaviorSubject<number>(0);

  /** Eclipses witnessed, ever (the Slate's ledger reads it). */
  readonly count$: Observable<number> = this.count$$.asObservable();

  get state(): Readonly<EclipseState> { this.hydrate(); return this.current; }
  count(): number { this.hydrate(); return witnessed(this.current); }
  seen(id: number): boolean { this.hydrate(); return this.current.seen.includes(id); }

  /** The Keeper was in the world for this eclipse: write it down once, then pay. Null when already written (or on the server). */
  witness(w: Pick<EclipseWindow, 'id'>): Witnessed | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    if (this.current.seen.includes(w.id)) return null;
    const count = witnessed(this.current) + 1;
    const due = marksDue(count, this.current.marks);
    // Receipt first, on disk, before a single coin moves.
    this.save({ ...this.current, seen: [...this.current.seen, w.id], marks: [...this.current.marks, ...due.map(m => m.id)] });
    const gold = this.economy.earnIncome(OBSERVATION.gold, OBSERVATION.goldSeconds, 'eclipse');
    return { id: w.id, count, gold, marks: due.map(m => this.payMark(m)) };
  }

  /** Marks reached (by a merge) but never paid: pay them now, each under its own receipt. */
  catchUp(): { at: number; gold: number; glass: number }[] {
    if (!this.isBrowser) return [];
    this.hydrate();
    const due = marksDue(witnessed(this.current), this.current.marks);
    if (!due.length) return [];
    this.save({ ...this.current, marks: [...this.current.marks, ...due.map(m => m.id)] });
    return due.map(m => this.payMark(m));
  }

  private payMark(m: LedgerMark): { at: number; gold: number; glass: number } {
    const gold = this.economy.earnIncome(m.gold, m.goldSeconds, 'eclipse');
    if (m.glass > 0) this.inventory.grantStack(`${m.id}:glass`, ECLIPSE_GLASS_ID, m.glass);
    return { at: m.at, gold, glass: m.glass };
  }

  /** How many marks are paid, out of all of them. */
  marksPaid(): number { this.hydrate(); return LEDGER_MARKS.filter(m => this.current.marks.includes(m.id)).length; }

  private save(next: EclipseState): void {
    this.current = coerceEclipse(next);
    if (this.isBrowser) this.store.write(ECLIPSE_KEY, this.current);
    this.count$$.next(witnessed(this.current));
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceEclipse(this.store.read(ECLIPSE_KEY));
    this.saves.register(ECLIPSE_KEY, { rehydrate: () => { this.current = coerceEclipse(this.store.read(ECLIPSE_KEY)); this.count$$.next(witnessed(this.current)); } });
    this.count$$.next(witnessed(this.current));
  }
}
