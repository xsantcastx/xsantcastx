/**
 * golden-spark.service.ts — the Golden Spark (economy v3, spec §3).
 *
 * Replaces the Forge View's wandering trader with one clock every surface
 * shares: while a surface that can show a spark is open (the Forge View, the
 * Homestead) and the tab is visible, a spark is offered every 5-10 minutes and
 * waits 13 seconds to be caught. The kind is rolled when it appears, so the
 * offer can say what it is:
 *
 *   85% Windfall — max(60 s of income, min(15% of the bank, 900 s of income)) + 25
 *   15% Forge Frenzy — ×5 income (furnaces, automatons, strikes) for 60 s
 *
 * The reward is credited by `EconomyService.grantGoldenSpark`, the only mint.
 * This service owns the timing and nothing else; it never touches storage.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { EconomyService } from './economy.service';
import { GOLDEN_SPARK, goldenSparkWindfall } from './economy-curve';

export type GoldenSparkKind = 'windfall' | 'frenzy';

export interface GoldenSparkOffer {
  id: number;
  kind: GoldenSparkKind;
  /** Epoch ms it stops being catchable. */
  expiresAt: number;
}

export interface GoldenSparkCatch {
  kind: GoldenSparkKind;
  /** Gold credited (0 for a Frenzy, which pays as income). */
  gold: number;
}

/** Pure: which kind a roll in [0, 1) lands on. */
export function rollGoldenSparkKind(roll: number): GoldenSparkKind {
  return roll < GOLDEN_SPARK.frenzyChance ? 'frenzy' : 'windfall';
}

/** Pure: ms until the next spark, for a roll in [0, 1). */
export function goldenSparkGapMs(roll: number): number {
  const r = Math.min(1, Math.max(0, roll));
  return Math.round((GOLDEN_SPARK.minGapS + r * (GOLDEN_SPARK.maxGapS - GOLDEN_SPARK.minGapS)) * 1000);
}

@Injectable({ providedIn: 'root' })
export class GoldenSparkService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly economy = inject(EconomyService);

  private readonly offer$$ = new BehaviorSubject<GoldenSparkOffer | null>(null);
  private readonly caught$$ = new Subject<GoldenSparkCatch>();
  /** The spark on offer right now, or null. */
  readonly offer$: Observable<GoldenSparkOffer | null> = this.offer$$.asObservable();
  /** One per caught spark, after the reward is credited. */
  readonly caught$: Observable<GoldenSparkCatch> = this.caught$$.asObservable();

  private users = 0;
  private seq = 0;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  get offer(): GoldenSparkOffer | null { return this.offer$$.value; }

  /**
   * A surface that can show a spark is open. Ref-counted; returns the release.
   * The clock only runs while at least one surface holds it.
   */
  attach(): () => void {
    if (!this.isBrowser) return () => undefined;
    this.economy.init();
    if (this.users++ === 0) this.schedule();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.users > 0) return;
      this.clearTimers();
      this.offer$$.next(null);
    };
  }

  /** What a Windfall caught now would pay. For the offer's copy. */
  previewWindfall(): number {
    const snap = this.economy.snapshot;
    return goldenSparkWindfall(snap.perSecond, snap.gold);
  }

  /** Catch the spark on offer. Null when there is none (or it just expired). */
  catch(): GoldenSparkCatch | null {
    const offer = this.offer$$.value;
    if (!offer || Date.now() > offer.expiresAt) return null;
    this.offer$$.next(null);
    if (this.expiryTimer !== null) { clearTimeout(this.expiryTimer); this.expiryTimer = null; }
    const gold = this.economy.grantGoldenSpark(offer.kind);
    const caught: GoldenSparkCatch = { kind: offer.kind, gold };
    this.caught$$.next(caught);
    this.schedule();
    return caught;
  }

  ngOnDestroy(): void { this.clearTimers(); }

  private schedule(): void {
    if (!this.isBrowser || this.users === 0) return;
    if (this.nextTimer !== null) clearTimeout(this.nextTimer);
    this.zone.runOutsideAngular(() => {
      this.nextTimer = setTimeout(() => {
        this.nextTimer = null;
        // Only while visible: a spark nobody can see is not offered, and the
        // clock starts over rather than queueing one for the return.
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          this.schedule();
          return;
        }
        this.zone.run(() => this.appear());
      }, goldenSparkGapMs(Math.random()));
    });
  }

  private appear(): void {
    if (this.users === 0) return;
    const offer: GoldenSparkOffer = {
      id: ++this.seq,
      kind: rollGoldenSparkKind(Math.random()),
      expiresAt: Date.now() + GOLDEN_SPARK.catchS * 1000,
    };
    this.offer$$.next(offer);
    this.zone.runOutsideAngular(() => {
      this.expiryTimer = setTimeout(() => {
        this.expiryTimer = null;
        this.zone.run(() => {
          if (this.offer$$.value?.id === offer.id) this.offer$$.next(null);
          this.schedule();
        });
      }, GOLDEN_SPARK.catchS * 1000);
    });
  }

  private clearTimers(): void {
    if (this.nextTimer !== null) { clearTimeout(this.nextTimer); this.nextTimer = null; }
    if (this.expiryTimer !== null) { clearTimeout(this.expiryTimer); this.expiryTimer = null; }
  }
}
