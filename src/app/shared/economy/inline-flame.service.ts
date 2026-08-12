/**
 * inline-flame.service.ts — how the corner flame knows to stand down.
 *
 * The Forge Flame is mounted once in AppComponent and pinned to the
 * bottom-right of every page. The Forge View wants it *in* the page, at the
 * centre of the forge panel, where it is the focal point rather than a widget
 * — and two flames on one screen, both clickable, both paying into the same
 * ledger, is a bug the visitor has to reason about.
 *
 * So the inline instance announces itself here, and AppComponent hides the
 * fixed one for as long as one is mounted. A counter rather than a flag,
 * because a route change mounts the incoming component before destroying the
 * outgoing one: with a boolean, navigating from the Forge View to the Forge
 * View (a query-param change, a reload of the same route) would order itself
 * mount → unmount and leave the corner flame hidden on a page with no inline
 * flame at all.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InlineFlameService {
  private count = 0;
  private readonly active$$ = new BehaviorSubject<boolean>(false);

  /** True while at least one inline flame is on screen. */
  readonly active$: Observable<boolean> = this.active$$.asObservable();

  get active(): boolean { return this.active$$.value; }

  claim(): void {
    this.count++;
    if (this.count === 1) this.active$$.next(true);
  }

  release(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) this.active$$.next(false);
  }
}
