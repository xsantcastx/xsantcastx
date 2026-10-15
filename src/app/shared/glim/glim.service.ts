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
import { BondStage, QuestionId, answersFor, bondStage, questMoments, roomFor } from './glim-bond';

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

  /** Step 3 of a Delve mission's ladder: stamp Glim's mark (the map shows it for GLIM_MARK_MS). */
  mark(missionId: string, at = Date.now()): void {
    this.hydrate();
    this.save({ ...this.current, lastAt: { ...this.current.lastAt, [`mark.${missionId}`]: at } });
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

  /**
   * "Quiet Glim" (the chat card's switch): no unasked lines, only its face.
   * Kept as two stamps in `lastAt` (quiet.on / quiet.off) so the later choice
   * wins a merge without a new field; `mergeGlim` already keeps the later stamp.
   */
  get quiet(): boolean {
    const at = this.state.lastAt;
    return (at['quiet.on'] ?? 0) > (at['quiet.off'] ?? 0);
  }
  setQuiet(on: boolean, at = Date.now()): void {
    this.hydrate();
    const other = this.current.lastAt[on ? 'quiet.off' : 'quiet.on'] ?? 0;
    // Strictly later than the other switch, even on a clock that went backwards.
    this.save({ ...this.current, lastAt: { ...this.current.lastAt, [on ? 'quiet.on' : 'quiet.off']: Math.max(at, other + 1) } });
  }

  // ── The bond (glim-bond.ts) ──

  /** The bond's stage now (never below the peak reached). */
  get stage(): BondStage {
    const state = this.state;
    return bondStage(state.moments, state.peak);
  }

  /**
   * File shared moments. Only new ones that still count are kept (a moment is
   * counted once, ever; each kind has a cap), and any step of "The Blank
   * Places" they complete is filed with them. Returns what was added.
   */
  addMoments(ids: Iterable<string>): string[] {
    this.hydrate();
    const moments = [...this.current.moments];
    const added: string[] = [];
    for (const id of ids) if (roomFor(moments, id)) { moments.push(id); added.push(id); }
    if (!added.length) return added;
    // The questline opens at Mapmates: its steps only file once it is open.
    if (bondStage(moments, this.current.peak).n >= 2) {
      for (const id of questMoments(moments)) if (roomFor(moments, id)) { moments.push(id); added.push(id); }
    }
    this.save({ ...this.current, moments });
    return added;
  }

  /** Raise the remembered peak stage (it never goes down). */
  reachStage(n: number): void {
    this.hydrate();
    if (n > this.current.peak) this.save({ ...this.current, peak: Math.min(5, n) });
  }

  /** What the Keeper told Glim (only a choice the question offers). */
  answer(q: QuestionId, a: string, at = Date.now()): boolean {
    this.hydrate();
    if (!answersFor(q).includes(a)) return false;
    this.save({ ...this.current, answers: { ...this.current.answers, [q]: { a, at } } });
    return true;
  }

  answerTo(q: QuestionId): string | undefined {
    return this.state.answers[q]?.a;
  }

  /** Out together now (written at most every few minutes by the caller). */
  seen(at = Date.now()): void {
    this.hydrate();
    if (at > this.current.seenAt) this.save({ ...this.current, seenAt: at });
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
