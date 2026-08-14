import { Injectable, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { EasterEggService } from './easter-egg.service';
import { CANONICAL, canonicalizePlayerPath } from '../canonical-routes';

@Injectable({ providedIn: 'root' })
export class GlobalEggTriggersService implements OnDestroy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggService = inject(EasterEggService);
  private router = inject(Router);
  private routerSub?: Subscription;

  // Konami code tracking
  private konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  private konamiIndex = 0;
  private keyHandler?: (e: KeyboardEvent) => void;

  // Speed demon tracking — live game halls, not retired /tools/* pages.
  private hallVisits: number[] = [];
  private visitedHalls = new Set<string>();
  private static readonly HALLS = new Set<string>([
    CANONICAL.world,
    CANONICAL.character,
    CANONICAL.forge,
    CANONICAL.quests,
    CANONICAL.trials,
    '/codex',
    '/market',
    '/sanctum',
  ]);

  init(): void {
    if (!this.isBrowser) return;

    this.eggService.init();

    // ── Night Owl: using site between 2am-5am ──
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) {
      this.eggService.trigger('night-owl');
    }

    // ── Konami Code ──
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === this.konamiSequence[this.konamiIndex]) {
        this.konamiIndex++;
        if (this.konamiIndex === this.konamiSequence.length) {
          this.eggService.trigger('konami');
          this.konamiIndex = 0;
        }
      } else {
        this.konamiIndex = 0;
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // ── Speed Demon: five live halls in under 60s ──
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      const path = canonicalizePlayerPath(e.urlAfterRedirects);
      if (!GlobalEggTriggersService.HALLS.has(path) || this.visitedHalls.has(path)) return;
      this.visitedHalls.add(path);
      this.hallVisits.push(Date.now());
      const cutoff = Date.now() - 60_000;
      this.hallVisits = this.hallVisits.filter(t => t > cutoff);
      if (this.visitedHalls.size >= 5 && this.hallVisits.length >= 5) {
        this.eggService.trigger('speed-demon');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.routerSub?.unsubscribe();
  }
}
