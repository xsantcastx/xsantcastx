import { Directive, inject, OnInit, OnDestroy } from '@angular/core';
import { AnalyticsService } from './analytics.service';

@Directive({
  selector: '[appScrollTracking]',
  standalone: false
})
export class ScrollTrackingDirective implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private scrollHandler?: () => void;
  private trackedMilestones = new Set<number>();

  ngOnInit(): void {
    this.setupScrollTracking();
  }

  ngOnDestroy(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private setupScrollTracking(): void {
    let lastKnownScrollPosition = 0;
    let ticking = false;

    this.scrollHandler = () => {
      lastKnownScrollPosition = window.scrollY;
      
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateScrollDepth(lastKnownScrollPosition);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  private updateScrollDepth(scrollPosition: number): void {
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = Math.min(100, Math.round((scrollPosition / documentHeight) * 100));

    // Track milestones: 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    
    for (const milestone of milestones) {
      if (scrollPercentage >= milestone && !this.trackedMilestones.has(milestone)) {
        this.trackedMilestones.add(milestone);
        this.analyticsService.trackScrollDepth(milestone);
      }
    }
  }
}