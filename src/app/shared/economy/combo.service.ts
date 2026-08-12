/**
 * combo.service.ts — consecutive strikes, and what they are worth.
 *
 * One job: count paid strikes, drop to zero on silence, and say when a run has
 * crossed something worth shouting about. The flame owns every pixel and every
 * sound; this owns the number.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT COUNTS PAID STRIKES RATHER THAN CLICKS
 * ─────────────────────────────────────────────────────────────────────────────
 * `EconomyService.strike()` returns null inside its 500ms cooldown, and only the
 * strikes that pay are counted here. Counting raw clicks instead would make the
 * ladder a test of how fast a mouse can be spammed — or of whether somebody has
 * an autoclicker — rather than of holding a rhythm for a long time, and the
 * whole shape of the numbers at the top assumes the two-a-second ceiling. It
 * also means the count on screen and the Gold in the ledger can never disagree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS PERSISTED, AND WHAT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The live combo is *not* persisted, deliberately. A run is a run: it lives in
 * memory, and closing the tab ends it the same way a two-second pause does.
 * Restoring a 4,000 combo on next load would make the hardest thing on the site
 * free, and there is no honest way to store "you were mid-rhythm".
 *
 * What is stored is the high-water mark, because that is a record rather than a
 * state, and it is the number somebody will want to beat. It syncs across
 * devices through cloud save, where max-wins is exactly the right merge.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import {
  COMBO_RESET_MS,
  ComboTier,
  MAX_COMBO,
  NAMELESS_AT,
  NAMELESS_EGG,
  tierCrossedAt,
  tierFor,
} from './combo.model';

export const COMBO_KEY = 'eclipse-combo';

interface ComboRecord {
  version: 1;
  /** Longest unbroken run ever. */
  best: number;
}

function emptyRecord(): ComboRecord {
  return { version: 1, best: 0 };
}

/** What the flame renders. Derived, never persisted. */
export interface ComboSnapshot {
  /** Consecutive paid strikes, capped at MAX_COMBO. Zero when no run is live. */
  count: number;
  /** The tier being held, or null below the first rung. */
  tier: ComboTier | null;
  best: number;
}

/**
 * A moment worth reacting to. Emitted once, on the strike that caused it —
 * never replayed, because a missed shout is a missed animation and re-firing one
 * on a late subscriber would be worse than silence.
 */
export interface ComboEvent {
  count: number;
  /** The rung just crossed, or null when this is the Nameless. */
  tier: ComboTier | null;
  /** True for the one-shot at 666. */
  nameless: boolean;
  /** True when this crossing banked its achievement just now. */
  firstTime: boolean;
}

@Injectable({ providedIn: 'root' })
export class ComboService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly eggs = inject(EasterEggService);

  private record: ComboRecord = emptyRecord();
  private loaded = false;

  private count = 0;
  private decay: ReturnType<typeof setTimeout> | null = null;

  private readonly snapshot$$ = new BehaviorSubject<ComboSnapshot>({ count: 0, tier: null, best: 0 });
  private readonly event$$ = new Subject<ComboEvent>();

  /** Current run, replayed to late subscribers. */
  readonly snapshot$: Observable<ComboSnapshot> = this.snapshot$$.asObservable();
  /** Fires once per crossing. Not replayed. */
  readonly event$: Observable<ComboEvent> = this.event$$.asObservable();

  get snapshot(): ComboSnapshot { return this.snapshot$$.value; }
  get best(): number { return this.load().best; }

  /**
   * Register one paid strike and return the run it belongs to.
   *
   * Called only when `EconomyService.strike()` actually paid — see the note at
   * the top. Returns the new snapshot so the flame can react in the same tick
   * without waiting for the subject.
   */
  strike(): ComboSnapshot {
    if (!this.isBrowser) return this.snapshot;

    // Capped rather than wrapped or unbounded: the display promises x9,999 is
    // the top, and a counter that kept climbing past its own ceiling would make
    // the final tier a checkpoint instead of an ending.
    this.count = Math.min(this.count + 1, MAX_COMBO);
    this.armDecay();

    const crossed = tierCrossedAt(this.count);
    if (crossed) {
      this.announce({
        count: this.count,
        tier: crossed,
        nameless: false,
        firstTime: crossed.egg ? this.claim(crossed.egg) : false,
      });
    } else if (this.count === NAMELESS_AT && !this.eggs.isFound(NAMELESS_EGG)) {
      // Once, ever. The achievement is the gate, so a second run past 666 passes
      // in silence — which is more in character for the thing than repeating.
      this.announce({
        count: this.count,
        tier: null,
        nameless: true,
        firstTime: this.claim(NAMELESS_EGG),
      });
    }

    this.remember(this.count);
    this.publish();
    return this.snapshot;
  }

  /** Drop the run. Called by the decay timer, and available for a reset. */
  break(): void {
    if (this.count === 0) return;
    this.count = 0;
    this.clearDecay();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Restart the two-second fuse.
   *
   * Outside the zone: this timer fires on every single strike and all it does is
   * set a number to zero. Letting zone.js schedule it would cost a change
   * detection pass twice a second for as long as somebody is clicking, which on
   * the page with the most animation on the site is exactly the wrong place to
   * spend it. The `break()` it eventually runs re-enters to publish.
   */
  private armDecay(): void {
    this.clearDecay();
    this.zone.runOutsideAngular(() => {
      this.decay = setTimeout(() => {
        this.decay = null;
        this.zone.run(() => this.break());
      }, COMBO_RESET_MS);
    });
  }

  private clearDecay(): void {
    if (this.decay === null) return;
    clearTimeout(this.decay);
    this.decay = null;
  }

  private announce(event: ComboEvent): void {
    this.event$$.next(event);
  }

  /** Bank an achievement. True when this was the first time. */
  private claim(eggId: string): boolean {
    const isNew = !this.eggs.isFound(eggId);
    // `trigger()` is idempotent and fires the rarity drop itself; calling it on
    // a repeat is what makes a re-earned achievement still feel acknowledged.
    void this.eggs.trigger(eggId);
    return isNew;
  }

  private remember(count: number): void {
    const record = this.load();
    if (count <= record.best) return;
    this.record = { ...record, best: count };
    this.persist();
  }

  private publish(): void {
    this.snapshot$$.next({
      count: this.count,
      tier: tierFor(this.count),
      best: this.load().best,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): ComboRecord {
    if (this.loaded) return this.record;
    this.loaded = true;
    if (!this.isBrowser) return this.record;

    try {
      const raw = localStorage.getItem(COMBO_KEY);
      if (!raw) return this.record;
      const parsed = JSON.parse(raw) as Partial<ComboRecord>;
      // Clamped on read as well as on write: a hand-edited blob should not be
      // able to put a number on the page that the ladder says is impossible.
      const best = typeof parsed.best === 'number' && Number.isFinite(parsed.best)
        ? Math.max(0, Math.min(MAX_COMBO, Math.floor(parsed.best)))
        : 0;
      this.record = { version: 1, best };
    } catch {
      this.record = emptyRecord();
    }
    return this.record;
  }

  private persist(): void {
    try {
      localStorage.setItem(COMBO_KEY, JSON.stringify(this.record));
    } catch {
      /* quota or private mode — a lost record is not worth breaking a page over */
    }
  }

  /** Wipe the record. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.break();
    this.record = emptyRecord();
    this.loaded = true;
    try { localStorage.removeItem(COMBO_KEY); } catch { /* private mode */ }
    this.publish();
  }
}
