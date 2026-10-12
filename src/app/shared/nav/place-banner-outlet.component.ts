/**
 * place-banner-outlet.component.ts — the seam the "This place is in <Town>"
 * banner arrives through on a standalone place page (/market, /codex, …).
 *
 * The navbar is World only (Play + Character). Each other hall keeps its
 * standalone, prerendered URL for search and shared links; on the client that
 * page offers a slim banner deep-linking into the world at its station.
 *
 * Why an outlet: the banner has to read the towns' data to name the town, and
 * the towns must never ride the eager shell (the initial bundle is near its
 * budget). So this component is all the shell carries — a route check against
 * PLACE_DIRECTORY (whose spec pins it to exactly the routes that have a
 * station) and a reserved strip — and the banner itself is a dynamic import()
 * mounted with createComponent, the pattern pwa-outlet.component.ts uses.
 *
 * The strip is reserved on the server too (the class is bound off the router's
 * URL), so the banner lands in space that was already there: no layout shift.
 * Bots get the prerendered page unchanged apart from that empty strip; nobody
 * is redirected.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  HostBinding,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PLACE_DIRECTORY } from './place-directory';

const PLACE_ROUTES = new Set(PLACE_DIRECTORY.map(p => p.route));

/** The path a URL names, for matching against PLACE_ROUTES. */
export function placePath(url: string): string {
  return (url || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

export function isPlaceRoute(url: string): boolean {
  return PLACE_ROUTES.has(placePath(url));
}

interface BannerInstance { route: string; }

@Component({
  selector: 'app-place-banner-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #slot></ng-container>',
  styles: [`
    :host { display: block; }
    /* The reserved strip. Matches .place-banner's block size (50px) + margin so the
       lazy banner fills it rather than pushing the page down. */
    :host(.is-place) { min-height: calc(50px + var(--space-3, 12px)); }
  `],
})
export class PlaceBannerOutletComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  /** Static and never inside an @if, so it is resolved before ngOnInit runs. */
  @ViewChild('slot', { read: ViewContainerRef, static: true })
  private slot!: ViewContainerRef;
  private readonly cdr = inject(ChangeDetectorRef);

  @HostBinding('class.is-place') isPlace = false;

  private sub?: Subscription;
  private ref: ComponentRef<BannerInstance> | null = null;
  private loading: Promise<void> | null = null;
  private destroyed = false;

  ngOnInit(): void {
    this.apply(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.apply(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.sub?.unsubscribe();
    this.ref?.destroy();
    this.ref = null;
  }

  private apply(url: string): void {
    const path = placePath(url);
    const place = PLACE_ROUTES.has(path);
    if (place !== this.isPlace) {
      this.isPlace = place;
      this.cdr.markForCheck();
    }
    if (!this.isBrowser) return;
    if (!place) {
      this.ref?.destroy();
      this.ref = null;
      return;
    }
    if (this.ref) {
      this.ref.setInput('route', path);
      return;
    }
    if (!this.loading) this.loading = this.mount();
  }

  private async mount(): Promise<void> {
    try {
      const { PlaceBannerComponent } = await import('./place-banner.component');
      // A route change may have left the place (or torn the shell down) while
      // the chunk was in flight; mounting now would show a stale banner.
      if (this.destroyed || !this.isPlace) return;
      const ref = this.slot.createComponent<BannerInstance>(PlaceBannerComponent);
      ref.setInput('route', placePath(this.router.url));
      ref.changeDetectorRef.detectChanges();
      this.ref = ref;
    } catch {
      // Offline with the chunk uncached: the page is the page without it.
    } finally {
      this.loading = null;
      // Navigated to another place while loading: re-apply for the current URL.
      if (!this.destroyed && this.isPlace && this.ref) this.ref.setInput('route', placePath(this.router.url));
    }
  }
}
