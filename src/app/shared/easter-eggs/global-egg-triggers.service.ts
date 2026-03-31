import { Injectable, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { EasterEggService } from './easter-egg.service';

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

  // Speed demon tracking
  private toolVisits: number[] = [];
  private visitedTools = new Set<string>();

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

    // ── Speed Demon: 5 tools in under 60s ──
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      if (e.urlAfterRedirects.startsWith('/tools/') && !e.urlAfterRedirects.includes('embed')) {
        const slug = e.urlAfterRedirects.replace('/tools/', '');
        if (!this.visitedTools.has(slug)) {
          this.visitedTools.add(slug);
          this.toolVisits.push(Date.now());

          // Keep only last 60 seconds of visits
          const cutoff = Date.now() - 60000;
          this.toolVisits = this.toolVisits.filter(t => t > cutoff);

          if (this.visitedTools.size >= 5 && this.toolVisits.length >= 5) {
            this.eggService.trigger('speed-demon');
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.routerSub?.unsubscribe();
  }
}
