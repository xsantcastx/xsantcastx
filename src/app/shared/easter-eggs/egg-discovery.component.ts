import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { EasterEggService, EggDiscovery } from './easter-egg.service';

@Component({
  selector: 'app-egg-discovery',
  standalone: false,
  template: `
    <div class="egg-toast" *ngIf="discovery" [class.egg-toast--visible]="visible"
         [attr.data-rarity]="discovery.egg.rarity" (click)="dismiss()">
      <div class="egg-toast__icon-wrap" [attr.data-rarity]="discovery.egg.rarity">
        <span class="egg-toast__emoji">{{ discovery.egg.icon }}</span>
      </div>
      <div class="egg-toast__body">
        <div class="egg-toast__header">
          <span class="egg-toast__badge" [attr.data-rarity]="discovery.egg.rarity">
            {{ discovery.isNew ? 'NEW DISCOVERY' : 'REDISCOVERED' }}
          </span>
          <span class="egg-toast__rarity" [attr.data-rarity]="discovery.egg.rarity">
            {{ discovery.egg.rarity | uppercase }}
          </span>
        </div>
        <p class="egg-toast__name">{{ discovery.egg.name }}</p>
        <p class="egg-toast__desc">{{ discovery.egg.description }}</p>
        <div class="egg-toast__progress">
          <div class="egg-toast__progress-bar">
            <div class="egg-toast__progress-fill" [style.width.%]="progressPercent"></div>
          </div>
          <span class="egg-toast__progress-text">{{ discovery.totalFound }}/{{ discovery.totalEggs }} found</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .egg-toast {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 99998;
      display: flex;
      gap: 0.85rem;
      padding: 1rem 1.25rem;
      background: rgba(10, 15, 30, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      max-width: 340px;
      cursor: pointer;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    }
    .egg-toast--visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }
    .egg-toast[data-rarity="common"] { border-color: rgba(0, 229, 255, 0.2); }
    .egg-toast[data-rarity="rare"] { border-color: rgba(123, 97, 255, 0.3); }
    .egg-toast[data-rarity="epic"] { border-color: rgba(255, 0, 255, 0.3); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 0, 255, 0.08); }
    .egg-toast[data-rarity="legendary"] {
      border-color: rgba(255, 215, 0, 0.35);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.1);
      animation: egg-legendary-border 3s linear infinite;
    }
    @keyframes egg-legendary-border {
      0%, 100% { border-color: rgba(255, 215, 0, 0.35); }
      33% { border-color: rgba(255, 0, 255, 0.35); }
      66% { border-color: rgba(0, 255, 204, 0.35); }
    }

    .egg-toast__icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: egg-icon-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
    }
    .egg-toast__icon-wrap[data-rarity="common"] { background: rgba(0, 229, 255, 0.1); }
    .egg-toast__icon-wrap[data-rarity="rare"] { background: rgba(123, 97, 255, 0.12); }
    .egg-toast__icon-wrap[data-rarity="epic"] { background: rgba(255, 0, 255, 0.12); }
    .egg-toast__icon-wrap[data-rarity="legendary"] { background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 0, 255, 0.15)); }
    @keyframes egg-icon-pop {
      from { transform: scale(0) rotate(-20deg); }
      to { transform: scale(1) rotate(0); }
    }

    .egg-toast__emoji { font-size: 1.4rem; }

    .egg-toast__body { flex: 1; min-width: 0; }

    .egg-toast__header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem; }

    .egg-toast__badge {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
    }
    .egg-toast__badge[data-rarity="common"] { background: rgba(0, 229, 255, 0.15); color: #00e5ff; }
    .egg-toast__badge[data-rarity="rare"] { background: rgba(123, 97, 255, 0.18); color: #7b61ff; }
    .egg-toast__badge[data-rarity="epic"] { background: rgba(255, 0, 255, 0.15); color: #ff00ff; }
    .egg-toast__badge[data-rarity="legendary"] { background: rgba(255, 215, 0, 0.15); color: #ffd700; }

    .egg-toast__rarity {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      opacity: 0.5;
    }
    .egg-toast__rarity[data-rarity="common"] { color: #00e5ff; }
    .egg-toast__rarity[data-rarity="rare"] { color: #7b61ff; }
    .egg-toast__rarity[data-rarity="epic"] { color: #ff00ff; }
    .egg-toast__rarity[data-rarity="legendary"] { color: #ffd700; }

    .egg-toast__name {
      font-family: var(--font-heading);
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 0.15rem;
    }

    .egg-toast__desc {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin: 0 0 0.5rem;
      line-height: 1.4;
    }

    .egg-toast__progress { display: flex; align-items: center; gap: 0.5rem; }

    .egg-toast__progress-bar {
      flex: 1;
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }
    .egg-toast__progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
      transition: width 0.6s ease;
    }

    .egg-toast__progress-text {
      font-size: 0.6rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    @media (max-width: 480px) {
      .egg-toast {
        left: 0.75rem;
        right: 0.75rem;
        bottom: 1rem;
        max-width: none;
      }
    }
  `]
})
export class EggDiscoveryComponent implements OnInit, OnDestroy {
  discovery: EggDiscovery | null = null;
  visible = false;
  progressPercent = 0;

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggService = inject(EasterEggService);
  private sub?: Subscription;
  private dismissTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.sub = this.eggService.discovery$.subscribe(d => {
      if (!d) return;
      this.discovery = d;
      this.progressPercent = (d.totalFound / d.totalEggs) * 100;

      clearTimeout(this.dismissTimer);
      requestAnimationFrame(() => {
        this.visible = true;
        this.dismissTimer = setTimeout(() => this.dismiss(), 6000);
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.dismissTimer);
  }

  dismiss(): void {
    this.visible = false;
    setTimeout(() => { this.discovery = null; }, 400);
  }
}
