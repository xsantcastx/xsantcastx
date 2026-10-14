/**
 * glim.service.ts — Glim's memory, through the save gateway.
 *
 * The state is three growing maps (glim-save.model.ts). This service is the
 * only writer: read once on first use, write through on every change,
 * registered with LocalSaveRegistry so a cloud merge lands in memory in the
 * same tick instead of being clobbered by a stale copy. On the server it is a
 * read-only empty state.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { GLIM_KEY, GLIM_LADDER_TOP, GlimState, coerceGlim, emptyGlim } from './glim-save.model';

@Injectable({ providedIn: 'root' })
export class GlimService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private current: GlimState = emptyGlim();
  private hydrated = false;

  get state(): Readonly<GlimState> {
    this.hydrate();
    return this.current;
  }

  /** The Prologue meeting. Idempotent; the first stamp is kept. */
  meet(at = new Date()): void {
    this.hydrate();
    if (this.current.met) return;
    this.save({ ...this.current, met: true, metAt: at.toISOString() });
  }

  /** The ladder step opened for a subject (0 = none yet). */
  step(subject: string): number {
    return this.state.ladder[subject] ?? 0;
  }

  /** Open the next ladder step for a subject (capped at `top`, ≤ 3) and return it. */
  advance(subject: string, top = GLIM_LADDER_TOP): number {
    this.hydrate();
    const next = Math.min(Math.max(1, top), (this.current.ladder[subject] ?? 0) + 1);
    if (next !== this.current.ladder[subject]) this.save({ ...this.current, ladder: { ...this.current.ladder, [subject]: next } });
    return next;
  }

  /** Record that a line was said now (count + stamp). */
  said(lineId: string, at = Date.now()): void {
    this.hydrate();
    this.save({
      ...this.current,
      said: { ...this.current.said, [lineId]: (this.current.said[lineId] ?? 0) + 1 },
      lastAt: { ...this.current.lastAt, [lineId]: at },
    });
  }

  private save(next: GlimState): void {
    this.current = next;
    if (this.isBrowser) this.store.write(GLIM_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceGlim(this.store.read(GLIM_KEY));
    this.saves.register(GLIM_KEY, { rehydrate: () => { this.current = coerceGlim(this.store.read(GLIM_KEY)); } });
  }
}
