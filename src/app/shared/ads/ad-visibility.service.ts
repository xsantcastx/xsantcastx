/**
 * AdVisibilityService — the single answer to "should this slot paint?".
 *
 * Three independent reasons to suppress an ad, resolved in one place so that a
 * new ad surface cannot accidentally implement two of them and forget the third:
 *
 *   1. The visitor bought the Pro Pack (ad-free is the headline feature).
 *   2. The route is one of the owner/player dashboards (see AD_FREE_ROUTES).
 *   3. The boot curtain is still up — an ad that paints underneath the splash
 *      burns an impression nobody saw, and Carbon counts it as served.
 *
 * Emits on change rather than answering once, because all three inputs move
 * during a session: Pro can be bought in another tab, the route changes without
 * a reload in an SPA, and the curtain lifts ~750ms after first paint.
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { filter, map, startWith, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { ProService } from '../pro/pro.service';
import { routeAllowsAds } from './ad-config';

/** How long the boot curtain is up. Mirrors the engine's dismiss timing. */
const BOOT_GRACE_MS = 900;

@Injectable({ providedIn: 'root' })
export class AdVisibilityService {
  private readonly isBrowser: boolean;
  private readonly booted$$ = new BehaviorSubject<boolean>(false);

  /**
   * True when an ad slot is allowed to render and request an impression.
   *
   * `shareReplay(1)` so that N ad slots on one page share one subscription to
   * the router rather than each attaching their own NavigationEnd listener.
   */
  readonly canShowAds$: Observable<boolean>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private pro: ProService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (!this.isBrowser) {
      // SSR: never render an ad into prerendered HTML. The markup would be
      // baked into the static file and served to every visitor including Pro
      // ones, and an ad script tag in prerendered output runs before hydration
      // decides whether it should have.
      this.canShowAds$ = new BehaviorSubject<boolean>(false).asObservable();
      return;
    }

    // The curtain is only in the DOM when the engine put it there; if it was
    // skipped (reduced motion) there is nothing to wait for.
    if (document.querySelector('.cosmic-boot')) {
      setTimeout(() => this.booted$$.next(true), BOOT_GRACE_MS);
    } else {
      this.booted$$.next(true);
    }

    const route$ = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => routeAllowsAds(e.urlAfterRedirects)),
      // The first NavigationEnd has usually already fired by the time an ad
      // component subscribes, so seed from the router's current URL.
      startWith(routeAllowsAds(this.router.url)),
      distinctUntilChanged(),
    );

    this.canShowAds$ = combineLatest([
      route$,
      this.pro.pro$,
      this.booted$$.asObservable(),
    ]).pipe(
      map(([routeOk, isPro, booted]) => routeOk && !isPro && booted),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
