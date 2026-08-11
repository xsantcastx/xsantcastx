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
import { energyForCategory } from './gamification.model';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { TOOLS_REGISTRY } from '../../tools/tools-registry';

@Injectable({ providedIn: 'root' })
export class XpWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly xp = inject(XpService);
  private readonly eggs = inject(EasterEggService);

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

    this.eggs.discovery$
      .pipe(filter(d => !!d && d.isNew))
      .subscribe(() => this.xp.award('easter-egg'));
  }

  /** Called by share buttons. Public so a component can pay out explicitly. */
  awardShare(): void {
    this.xp.award('share');
  }

  private onNavigate(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    if (path.startsWith('/embed/')) return;

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
    }
  }

  private onCopy(): void {
    const now = Date.now();
    if (now - this.lastCopyAt < XpWiringService.COPY_COOLDOWN_MS) return;
    this.lastCopyAt = now;
    this.zone.run(() => this.xp.award('copy'));
  }
}
