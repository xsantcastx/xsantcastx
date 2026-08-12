/**
 * xp-wiring.service.ts — connects the app's existing signals to the XP ledger.
 *
 * Deliberately a single subscriber rather than an XpService call scattered
 * through 126 tool components: the events that earn XP (a route change, a copy,
 * an egg discovery) already exist as observables or document events, so there is
 * nothing to add to the tools themselves.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { XpService } from './xp.service';
import { ToolMasteryService } from './tool-mastery.service';
import { energyForCategory } from './gamification.model';
import { EASTER_EGGS, EasterEggService } from '../easter-eggs/easter-egg.service';
import { TOOLS_REGISTRY } from '../../tools/tools-registry';

@Injectable({ providedIn: 'root' })
export class XpWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly xp = inject(XpService);
  private readonly eggs = inject(EasterEggService);
  private readonly mastery = inject(ToolMasteryService);

  private started = false;
  /** Routes already paid for this session — a page visit earns XP once. */
  private readonly visited = new Set<string>();
  /** Copy is rate-limited so holding Cmd+C is not an XP faucet. */
  private lastCopyAt = 0;
  private static readonly COPY_COOLDOWN_MS = 60_000;

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.xp.init();
    // Everyone who used the site before the Bestiary existed still gets credit
    // for the tools the XP ledger already knows they opened.
    this.mastery.backfill(this.xp.toolsUsed);

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.onNavigate(e.urlAfterRedirects));
    // The first navigation has usually already fired by the time AppComponent
    // calls init(), so settle the landing route explicitly.
    this.onNavigate(this.router.url);

    // Copy fires on any page and does not touch template-bound state — keep it
    // out of the zone so a copy never costs a change-detection pass.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('copy', () => this.onCopy(), { passive: true });
    });

    // An egg may override the standard award (see `EasterEgg.xp`), so read the
    // registry rather than assuming every discovery is worth the same.
    this.eggs.discovery$
      .pipe(filter(d => !!d && d.isNew))
      .subscribe(d => this.xp.award('easter-egg', {
        amount: EASTER_EGGS.find(e => e.id === d!.egg.id)?.xp,
      }));
  }

  /** Called by share buttons. Public so a component can pay out explicitly. */
  awardShare(): void {
    this.xp.award('share');
  }

  private onNavigate(url: string): void {
    let path = url.split('?')[0].split('#')[0];
    if (path.startsWith('/embed/')) return;

    // The router reports '/' before the redirect resolves and '/home' after, so
    // a single landing looked like two pages and paid out twice. Same page.
    if (path === '/' || path === '') path = '/home';

    if (!this.visited.has(path)) {
      this.visited.add(path);
      this.xp.award('page-visit');
    }

    // Landing on a tool page counts as using it — the tools run entirely in the
    // browser with no submit step, so an "output produced" signal does not exist
    // at this layer. `toolId` makes XpService pay it out exactly once, ever.
    const tool = TOOLS_REGISTRY.find(t => t.route === path);
    if (tool) {
      this.xp.award('tool-use', {
        toolId: tool.id,
        energy: energyForCategory(tool.category),
      });
      // Mastery counts every navigation, unlike XP which pays once — the
      // Bestiary is measuring habit, not discovery, so coming back to a tool is
      // the whole point. It buys nothing but a star, so there is no reason to
      // rate-limit it the way the XP faucet is rate-limited.
      this.mastery.record(tool.id);
    }
  }

  private onCopy(): void {
    const now = Date.now();
    if (now - this.lastCopyAt < XpWiringService.COPY_COOLDOWN_MS) return;
    this.lastCopyAt = now;
    this.zone.run(() => this.xp.award('copy'));
  }
}
