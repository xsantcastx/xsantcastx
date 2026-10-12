import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, type Observable } from 'rxjs';

/**
 * spotlight.service.ts — "something is on stage, wait your turn".
 *
 * A reveal that owns the middle of the screen (the Gambler's altar) banks its
 * item *before* the theatre starts, so the Collection's "New discovery" card
 * fired during the charge and covered it. Interstitials that would compete for
 * the same spot check this hold and queue until it clears.
 *
 * Counted, not boolean: "Again" holds across the dismiss of one reveal and the
 * open of the next, so the queue never slips a card into that gap.
 */
@Injectable({ providedIn: 'root' })
export class SpotlightService {
  private readonly holds$ = new BehaviorSubject(0);

  /** True while any reveal holds the stage. */
  readonly held$: Observable<boolean> = this.holds$.pipe(map(n => n > 0), distinctUntilChanged());

  get held(): boolean { return this.holds$.value > 0; }

  hold(): void { this.holds$.next(this.holds$.value + 1); }

  release(): void {
    if (this.holds$.value > 0) this.holds$.next(this.holds$.value - 1);
  }
}
