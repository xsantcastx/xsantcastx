/**
 * place-banner.component.ts — "This place is in <Town> · Enter the world".
 *
 * Shown on a standalone place page (/market, /forge/crafting, …) on the client
 * only, mounted by PlaceBannerOutletComponent from its own lazy chunk. Where the
 * page stands is read from the world's data via placeForRoute(); a route with
 * no station renders nothing. The link is a plain, keyboard-reachable anchor
 * to /play?at=<station>, labelled with the place and the town for screen
 * readers. Nothing auto-enters: a click is the only way in.
 */
import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { placeForRoute, type WorldPlace } from '../world/place-for-route';
import { placeLabelKey } from './place-directory';

@Component({
  selector: 'app-place-banner',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (place; as p) {
      <aside class="place-banner" [attr.aria-label]="t('gfnav.place.region')">
        <p class="place-banner__text">
          <span class="place-banner__mark" aria-hidden="true"></span>
          <span class="place-banner__where">{{ t('gfnav.place.in', { town: p.areaName }) }}</span>
          <span class="place-banner__realm">{{ t('gfnav.place.realm', { realm: p.realmLabel }) }}</span>
        </p>
        <a class="place-banner__cta" routerLink="/play" [queryParams]="p.queryParams"
           [attr.aria-label]="t('gfnav.place.enterLabel', { place: placeName, town: p.areaName })">
          {{ t('gfnav.place.enter') }}<span class="place-banner__arrow" aria-hidden="true"></span>
        </a>
      </aside>
    }
  `,
  styles: [`
    /* Positioned so the page's art scene cannot paint over it (an unpositioned
       block sits under the fixed backdrop on the place pages). */
    :host { display: block; position: relative; z-index: 1; padding-inline: var(--space-4); }
    .place-banner {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      max-width: 1200px;
      min-height: 50px; /* 44px control + 2px padding + 1px border, each side */
      margin: 0 auto var(--space-3);
      padding: 2px 2px 2px var(--space-4);
      border: 1px solid color-mix(in srgb, var(--gold) 30%, transparent);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--surface-panel) 82%, transparent);
      color: var(--text-body);
      font-family: var(--font-body);
      font-size: var(--text-sm);
    }
    .place-banner__text {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      flex: 1 1 auto;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
    }
    .place-banner__mark {
      flex: none;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--gold);
      box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 70%, transparent);
    }
    .place-banner__where { overflow: hidden; text-overflow: ellipsis; }
    .place-banner__realm {
      flex: none;
      color: var(--text-muted);
      font-size: var(--text-xs);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .place-banner__cta {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 44px;
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      background: var(--action-primary-bg);
      color: var(--action-primary-fg);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .place-banner__cta:hover { background: var(--action-primary-bg-hover); }
    .place-banner__cta:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }
    /* A CSS-drawn chevron: no glyph-as-icon. */
    .place-banner__arrow {
      width: 7px;
      height: 7px;
      border-top: 2px solid currentColor;
      border-right: 2px solid currentColor;
      transform: rotate(45deg);
    }
    @media (max-width: 520px) {
      .place-banner__realm { display: none; }
    }
  `],
})
export class PlaceBannerComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private langSub?: Subscription;

  place: WorldPlace | null = null;
  placeName = '';

  @Input() set route(value: string) {
    this.place = placeForRoute(value);
    const key = this.place ? placeLabelKey(this.place.panel) : null;
    this.placeName = key ? this.i18n.translate(key) : '';
  }

  ngOnInit(): void {
    // Re-render (and re-name the place) when the language flips.
    this.langSub = this.i18n.currentLanguage$.subscribe(() => {
      if (this.place) this.route = this.place.route;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.langSub?.unsubscribe(); }

  t(key: string, vars?: Record<string, string>): string {
    return this.i18n.translate(key, vars);
  }
}
