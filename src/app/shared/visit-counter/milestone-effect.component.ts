import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { VisitCounterService, MilestoneEvent } from './visit-counter.service';

@Component({
  selector: 'app-milestone-effect',
  standalone: false,
  template: `
    <div class="ms-overlay" *ngIf="event" [class.ms-overlay--visible]="visible" (click)="dismiss()">
      <div class="ms-particles" *ngIf="visible">
        <span *ngFor="let p of particles" class="ms-particle"
          [attr.style]="particleStyle(p)">
        </span>
      </div>

      <div class="ms-card" [class.ms-card--visible]="cardVisible" [attr.data-tier]="event.tier">
        <div class="ms-card__glow"></div>
        <div class="ms-card__inner">
          <div class="ms-card__badge" [attr.data-tier]="event.tier">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <p class="ms-card__label">{{ event.label }}</p>
          <div class="ms-card__number">
            <span class="ms-card__hash">#</span>
            <span class="ms-card__count" [attr.data-tier]="event.tier">{{ formattedCount }}</span>
          </div>
          <p class="ms-card__subtitle">You are visitor number {{ formattedCount }}</p>
          <div class="ms-card__tier" [attr.data-tier]="event.tier">
            {{ event.tier | uppercase }} MILESTONE
          </div>
          <button class="ms-card__dismiss" (click)="dismiss()">Continue</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Overlay ────────────────────────────────────────── */
    .ms-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(5, 7, 15, 0);
      pointer-events: none;
      transition: background 0.6s ease;
    }
    .ms-overlay--visible {
      background: rgba(5, 7, 15, 0.85);
      pointer-events: all;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* ── Particles ──────────────────────────────────────── */
    .ms-particles {
      position: fixed;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .ms-particle {
      position: absolute;
      width: var(--size);
      height: var(--size);
      background: var(--color);
      border-radius: 50%;
      left: 50%;
      top: 50%;
      opacity: 0;
      box-shadow: 0 0 6px var(--color), 0 0 12px var(--color);
      animation: ms-burst var(--duration) var(--delay) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    @keyframes ms-burst {
      0% {
        opacity: 1;
        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(1);
      }
      70% { opacity: 1; }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(var(--y)) scale(0.2);
      }
    }

    /* ── Card ───────────────────────────────────────────── */
    .ms-card {
      position: relative;
      opacity: 0;
      transform: scale(0.7) translateY(30px);
      transition: opacity 0.5s ease 0.3s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s;
    }
    .ms-card--visible {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    .ms-card__glow {
      position: absolute;
      inset: -40px;
      border-radius: 32px;
      opacity: 0.4;
      filter: blur(40px);
      animation: ms-glow-pulse 2s ease-in-out infinite alternate;
    }
    [data-tier="bronze"] .ms-card__glow,
    .ms-card[data-tier="bronze"] .ms-card__glow { background: radial-gradient(circle, #cd7f32, transparent 70%); }
    [data-tier="silver"] .ms-card__glow,
    .ms-card[data-tier="silver"] .ms-card__glow { background: radial-gradient(circle, #c0c0c0, transparent 70%); }
    [data-tier="gold"] .ms-card__glow,
    .ms-card[data-tier="gold"] .ms-card__glow { background: radial-gradient(circle, #ffd700, transparent 70%); }
    [data-tier="diamond"] .ms-card__glow,
    .ms-card[data-tier="diamond"] .ms-card__glow { background: radial-gradient(circle, #00ffcc, transparent 70%); }
    [data-tier="legendary"] .ms-card__glow,
    .ms-card[data-tier="legendary"] .ms-card__glow { background: radial-gradient(circle, #ff00ff, #00ffcc, transparent 70%); }

    @keyframes ms-glow-pulse {
      from { opacity: 0.3; transform: scale(0.95); }
      to { opacity: 0.6; transform: scale(1.05); }
    }

    .ms-card__inner {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding: 2.5rem 3rem;
      background: rgba(10, 15, 30, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      text-align: center;
      min-width: 300px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
    }

    /* ── Badge ──────────────────────────────────────────── */
    .ms-card__badge {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.25rem;
      animation: ms-badge-spin 0.8s ease-out 0.5s both;
    }
    .ms-card__badge[data-tier="bronze"] { background: rgba(205, 127, 50, 0.2); color: #cd7f32; border: 2px solid rgba(205, 127, 50, 0.4); }
    .ms-card__badge[data-tier="silver"] { background: rgba(192, 192, 192, 0.2); color: #e0e0e0; border: 2px solid rgba(192, 192, 192, 0.4); }
    .ms-card__badge[data-tier="gold"] { background: rgba(255, 215, 0, 0.15); color: #ffd700; border: 2px solid rgba(255, 215, 0, 0.4); }
    .ms-card__badge[data-tier="diamond"] { background: rgba(0, 255, 204, 0.12); color: #00ffcc; border: 2px solid rgba(0, 255, 204, 0.35); }
    .ms-card__badge[data-tier="legendary"] {
      background: linear-gradient(135deg, rgba(255, 0, 255, 0.15), rgba(0, 255, 204, 0.15));
      color: #ff00ff;
      border: 2px solid rgba(255, 0, 255, 0.4);
      box-shadow: 0 0 20px rgba(255, 0, 255, 0.2), 0 0 40px rgba(0, 255, 204, 0.1);
    }
    @keyframes ms-badge-spin {
      from { transform: rotateY(180deg) scale(0.5); opacity: 0; }
      to { transform: rotateY(0) scale(1); opacity: 1; }
    }

    /* ── Text ───────────────────────────────────────────── */
    .ms-card__label {
      font-family: var(--font-heading);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin: 0;
    }
    .ms-card__number {
      display: flex;
      align-items: baseline;
      gap: 0.15rem;
    }
    .ms-card__hash {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-muted);
      opacity: 0.5;
    }
    .ms-card__count {
      font-family: var(--font-heading);
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      line-height: 1;
      animation: ms-glitch-in 0.6s ease-out 0.6s both;
    }
    .ms-card__count[data-tier="bronze"] { color: #cd7f32; text-shadow: 0 0 10px rgba(205, 127, 50, 0.4); }
    .ms-card__count[data-tier="silver"] { color: #e0e0e0; text-shadow: 0 0 10px rgba(192, 192, 192, 0.4); }
    .ms-card__count[data-tier="gold"] { color: #ffd700; text-shadow: 0 0 15px rgba(255, 215, 0, 0.5); }
    .ms-card__count[data-tier="diamond"] { color: #00ffcc; text-shadow: 0 0 20px rgba(0, 255, 204, 0.5); }
    .ms-card__count[data-tier="legendary"] {
      background: linear-gradient(90deg, #ff00ff, #00ffcc, #7b61ff, #ff00ff);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: ms-glitch-in 0.6s ease-out 0.6s both, ms-rainbow 3s linear infinite;
    }
    @keyframes ms-glitch-in {
      0% { opacity: 0; transform: translateY(20px) skewX(-10deg); filter: blur(8px); }
      50% { transform: translateY(-3px) skewX(3deg); filter: blur(0); }
      100% { opacity: 1; transform: translateY(0) skewX(0); }
    }
    @keyframes ms-rainbow {
      to { background-position: 200% center; }
    }

    .ms-card__subtitle {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin: 0;
    }

    /* ── Tier Badge ─────────────────────────────────────── */
    .ms-card__tier {
      font-family: var(--font-heading);
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      padding: 0.3rem 0.9rem;
      border-radius: 999px;
      margin-top: 0.25rem;
    }
    .ms-card__tier[data-tier="bronze"] { background: rgba(205, 127, 50, 0.15); color: #cd7f32; border: 1px solid rgba(205, 127, 50, 0.3); }
    .ms-card__tier[data-tier="silver"] { background: rgba(192, 192, 192, 0.12); color: #c0c0c0; border: 1px solid rgba(192, 192, 192, 0.3); }
    .ms-card__tier[data-tier="gold"] { background: rgba(255, 215, 0, 0.12); color: #ffd700; border: 1px solid rgba(255, 215, 0, 0.3); }
    .ms-card__tier[data-tier="diamond"] { background: rgba(0, 255, 204, 0.1); color: #00ffcc; border: 1px solid rgba(0, 255, 204, 0.25); }
    .ms-card__tier[data-tier="legendary"] {
      background: linear-gradient(135deg, rgba(255, 0, 255, 0.12), rgba(0, 255, 204, 0.12));
      color: #ff00ff;
      border: 1px solid rgba(255, 0, 255, 0.3);
      box-shadow: 0 0 12px rgba(255, 0, 255, 0.15);
    }

    /* ── Dismiss Button ─────────────────────────────────── */
    .ms-card__dismiss {
      margin-top: 0.75rem;
      padding: 0.55rem 2rem;
      border-radius: var(--radius-md);
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-color);
      font-family: var(--font-body);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
    }
    .ms-card__dismiss:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    /* ── Responsive ─────────────────────────────────────── */
    @media (max-width: 480px) {
      .ms-card__inner {
        padding: 2rem 1.5rem;
        min-width: auto;
        margin: 0 1rem;
      }
      .ms-card__count { font-size: 2.2rem; }
      .ms-card__badge { width: 44px; height: 44px; }
    }
  `]
})
export class MilestoneEffectComponent implements OnInit, OnDestroy {
  event: MilestoneEvent | null = null;
  visible = false;
  cardVisible = false;
  particles: Array<{ x: string; y: string; size: number; delay: number; duration: number; color: string; angle: number }> = [];

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private visitService = inject(VisitCounterService);
  private sub?: Subscription;

  get formattedCount(): string {
    if (!this.event) return '';
    return this.event.count.toLocaleString();
  }

  /**
   * Returns the inline `style` attribute string for a particle. Using `[attr.style]`
   * (setAttribute) instead of `[style.--xxx]` (renderer.setProperty) avoids
   * Angular SSR's `NotYetImplemented` crash when serializing CSS custom properties.
   */
  particleStyle(p: { x: string; y: string; size: number; delay: number; duration: number; color: string; angle: number }): string {
    return `--x: ${p.x}; --y: ${p.y}; --size: ${p.size}px; --delay: ${p.delay}s; --duration: ${p.duration}s; --color: ${p.color}; --angle: ${p.angle}deg;`;
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.sub = this.visitService.milestone$.subscribe(ev => {
      if (!ev) return;
      this.event = ev;
      this.particles = this.generateParticles(ev.tier);

      // Stagger the reveal
      requestAnimationFrame(() => {
        this.visible = true;
        setTimeout(() => { this.cardVisible = true; }, 200);
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(): void {
    this.cardVisible = false;
    setTimeout(() => {
      this.visible = false;
      setTimeout(() => { this.event = null; }, 600);
    }, 300);
  }

  private generateParticles(tier: string) {
    const colors: Record<string, string[]> = {
      bronze:    ['#cd7f32', '#e8a854', '#a0622a'],
      silver:    ['#c0c0c0', '#e0e0e0', '#8a8a8a'],
      gold:      ['#ffd700', '#ffec80', '#e6b800'],
      diamond:   ['#00ffcc', '#7b61ff', '#00e5ff'],
      legendary: ['#ff00ff', '#00ffcc', '#7b61ff', '#ff6ec7', '#00e5ff'],
    };
    const palette = colors[tier] || colors['diamond'];
    const count = tier === 'legendary' ? 60 : tier === 'diamond' ? 45 : 30;

    return Array.from({ length: count }, () => ({
      x: '0px',
      y: -(120 + Math.random() * 280) + 'px',
      size: 3 + Math.random() * 6,
      delay: Math.random() * 0.4,
      duration: 0.8 + Math.random() * 1.2,
      color: palette[Math.floor(Math.random() * palette.length)],
      angle: Math.random() * 360,
    }));
  }
}
