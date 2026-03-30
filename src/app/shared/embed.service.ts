import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';
import { BehaviorSubject, Observable, of } from 'rxjs';

/**
 * EmbedService — central source of truth for embed mode state.
 *
 * Reads route data and query params to determine:
 * - Whether the current view is in embed/iframe mode
 * - Whether branding bar should be shown
 * - Active color theme
 *
 * Query params supported on /embed/:tool-slug routes:
 *   ?theme=dark|light  (default: dark)
 *   &branding=true|false (default: true — free tier shows branding)
 */
@Injectable({ providedIn: 'root' })
export class EmbedService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly _isEmbed = new BehaviorSubject<boolean>(false);
  private readonly _showBranding = new BehaviorSubject<boolean>(true);
  private readonly _theme = new BehaviorSubject<'dark' | 'light'>('dark');

  /** Whether the app is currently rendering an embed route */
  readonly isEmbed$: Observable<boolean> = this._isEmbed.asObservable();

  /** Whether the branding bar should display (free tier = always true) */
  readonly showBranding$: Observable<boolean> = this._showBranding.asObservable();

  /** Active embed theme */
  readonly theme$: Observable<'dark' | 'light'> = this._theme.asObservable();

  /** Synchronous getters for template use */
  get isEmbed(): boolean { return this._isEmbed.value; }
  get showBranding(): boolean { return this._showBranding.value; }
  get theme(): 'dark' | 'light' { return this._theme.value; }

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      const isEmbedRoute = e.urlAfterRedirects.startsWith('/embed/');
      this._isEmbed.next(isEmbedRoute);

      if (isEmbedRoute && this.isBrowser) {
        this.parseQueryParams(e.urlAfterRedirects);
      } else {
        // Reset defaults for non-embed routes
        this._showBranding.next(true);
        this._theme.next('dark');
      }
    });
  }

  private parseQueryParams(url: string): void {
    try {
      const searchStr = url.includes('?') ? url.split('?')[1] : '';
      const params = new URLSearchParams(searchStr);

      // branding param — default true (free tier always shows branding)
      const brandingParam = params.get('branding');
      this._showBranding.next(brandingParam !== 'false');

      // theme param — default dark
      const themeParam = params.get('theme');
      this._theme.next(themeParam === 'light' ? 'light' : 'dark');
    } catch {
      // Fallback to defaults
      this._showBranding.next(true);
      this._theme.next('dark');
    }
  }
}
