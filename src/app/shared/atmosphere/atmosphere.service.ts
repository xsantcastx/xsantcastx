/**
 * atmosphere.service.ts — paints the current route's atmosphere onto <html>.
 *
 * Route in, five custom properties out. Nothing renders here; the wash itself is
 * five radial gradients on `body`, in front of its base gradient, reading these
 * properties (see the ATMOSPHERE block in styles.css — including why it has to
 * be body and not a layer of its own). Same trick RealmService uses for the realm
 * badge: publish to CSS and every page is reached without editing a template.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS NOT PART OF RealmService
 * ─────────────────────────────────────────────────────────────────────────────
 * RealmService answers one question — which realm is this tool in — and returns
 * null everywhere else, including on the eight place-routes that need a wash.
 * It also short-circuits when the realm has not changed, which is true of every
 * navigation between two non-tool routes. Bending it to also answer "what does
 * this page feel like" would mean removing that short-circuit and making a
 * service that 126 tool pages depend on for their badge also responsible for the
 * wallpaper. Two subscriptions to the same router stream cost nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FORGE KEEPER CASE
 * ─────────────────────────────────────────────────────────────────────────────
 * /forge-keeper's wash depends on the visitor's Aether/Nox balance, which is not
 * known at navigation time: XpService hydrates from localStorage after the route
 * has already resolved. So this service also watches `xp.snapshot$` and repaints
 * while sitting on that route. Everywhere else the snapshot is ignored, so an XP
 * award mid-session does not re-tint a page whose colour has nothing to do with
 * progression.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { TOOLS_REGISTRY } from '../../tools/tools-registry';
import { CANONICAL } from '../canonical-routes';
import { XpService } from '../gamification/xp.service';
import {
  Atmosphere,
  NO_ATMOSPHERE,
  atmosphereForAetherShare,
  atmosphereForCategory,
  atmosphereForSegment,
} from './atmosphere.model';

/** The five slot properties, in the order `.page-atmosphere` stacks them. */
const SLOT_VARS = {
  center: '--atm-center',
  top: '--atm-top',
  bottom: '--atm-bottom',
  tl: '--atm-tl',
  tr: '--atm-tr',
} as const;

@Injectable({ providedIn: 'root' })
export class PageAtmosphereService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly xp = inject(XpService);

  private started = false;
  private readonly subs = new Subscription();

  /** The route this service last resolved, so an XP change can re-ask for it. */
  private currentPath = '/';
  /** What is on <html> right now, so an identical repaint is skipped. */
  private paintedId: string | null = null;

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => this.resolve(e.urlAfterRedirects)),
    );

    // Only /forge-keeper reads this; `resolve` re-derives from the stored path,
    // so on every other route this is a no-op that ends in a skipped repaint.
    this.subs.add(this.xp.snapshot$.subscribe(() => this.resolve(this.currentPath)));

    this.resolve(this.router.url);
  }

  /** For tests and teardown — the app itself keeps this for its whole life. */
  destroy(): void {
    this.subs.unsubscribe();
    this.started = false;
  }

  /** The atmosphere a path resolves to. Pure apart from reading the XP snapshot. */
  atmosphereFor(path: string): Atmosphere {
    const clean = path.split('?')[0].split('#')[0];

    // Tool pages first: they are the only routes with more than two segments,
    // and `/tools` itself must not be mistaken for one.
    const tool = TOOLS_REGISTRY.find(t => t.route === clean);
    if (tool) return atmosphereForCategory(tool.category);

    const segment = clean.split('/').filter(Boolean)[0] ?? '';

    // Nested World remounts share the `world` prefix; keep the old place washes.
    if (clean === CANONICAL.quests) return atmosphereForSegment('quests') ?? NO_ATMOSPHERE;
    if (clean === CANONICAL.trials) return atmosphereForSegment('arena') ?? NO_ATMOSPHERE;

    // The character sheet's realm is the visitor's, not the route's.
    if (segment === CANONICAL.character.slice(1)) {
      return atmosphereForAetherShare(this.xp.snapshot.aetherShare);
    }

    return atmosphereForSegment(segment) ?? NO_ATMOSPHERE;
  }

  private resolve(path: string): void {
    this.currentPath = path;
    this.paint(this.atmosphereFor(path));
  }

  /**
   * Write the five slots onto the document root.
   *
   * Cleared slots are set to `transparent` rather than removed. Removing a
   * registered custom property snaps it back to its initial value with no
   * transition, which would make leaving a tinted page a hard cut while
   * arriving at one fades. Writing `transparent` keeps both directions animated.
   */
  private paint(atmosphere: Atmosphere): void {
    if (atmosphere.id === this.paintedId) return;
    this.paintedId = atmosphere.id;

    const root = document.documentElement;
    root.setAttribute('data-atmosphere', atmosphere.id);

    for (const [slot, cssVar] of Object.entries(SLOT_VARS)) {
      const value = atmosphere[slot as keyof typeof SLOT_VARS];
      root.style.setProperty(cssVar, value ?? 'transparent');
    }
  }
}
