/**
 * achievement-drop.component.ts — the drop.
 *
 * Replaces the old flat egg toast. Mortal through Anomalous slide in from the
 * corner with a tier colour, a badge and a sound. Mythic and Singular take the
 * screen: a 100ms white flash, a dim overlay, a centred card with a pulsing
 * glow and a CSS particle burst.
 *
 * The cinematic path is deliberately rare — two eggs out of 140 are Mythic and
 * Singular has to be earned by being first in the realm — so the interruption
 * is a payoff rather than a nuisance.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { EasterEggService, EggDiscovery } from '../easter-eggs/easter-egg.service';
import { RarityAudioService } from './rarity-audio.service';
import {
  EclipseRarity,
  RarityDefinition,
  isSingular,
  rarityOf,
  tierForEgg,
} from './rarity.model';

interface Drop {
  icon: string;
  name: string;
  description: string;
  tier: EclipseRarity;
  def: RarityDefinition;
  found: number;
  total: number;
  isNew: boolean;
}

@Component({
  selector: 'app-achievement-drop',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (drop) {
      <!-- Cinematic tiers only: a single white frame, then a dim veil. -->
      @if (drop.def.cinematic) {
        <div class="ad-flash" [class.ad-flash--on]="flashing" aria-hidden="true"></div>
        <div class="ad-veil" [class.ad-veil--on]="visible" aria-hidden="true" (click)="dismiss()"></div>
      }

      <div
        class="ad"
        [class.ad--cine]="drop.def.cinematic"
        [class.ad--on]="visible"
        [attr.data-tier]="drop.tier"
        [style.--tier]="drop.def.color"
        [style.--tier-glow]="drop.def.glow"
        role="status"
        aria-live="polite"
        (click)="dismiss()">

        @if (drop.def.cinematic) {
          <!-- 18 shards thrown outward on custom-property angles. -->
          <div class="ad-burst" aria-hidden="true">
            @for (p of particles; track p) {
              <span class="ad-shard" [style.--a.deg]="p * 20" [style.--d]="p"></span>
            }
          </div>
        }

        <div class="ad__icon"><span>{{ drop.icon }}</span></div>

        <div class="ad__body">
          <p class="ad__tier">
            <!-- The tier sigil, not the achievement's own glyph: .ad__icon
                 already carries that, and this row is what the drop is *worth*. -->
            <img class="ad__tier-icon gf-icon" [ngClass]="'rarity-' + drop.def.id"
                 [src]="drop.def.icon" alt="" aria-hidden="true"
                 width="22" height="22" decoding="async" draggable="false">
            <span class="ad__badge">{{ drop.def.label }}</span>
            <span class="ad__kind">{{ drop.isNew ? 'Drop' : 'Rediscovered' }}</span>
          </p>
          <p class="ad__name">{{ drop.name }}</p>
          <p class="ad__desc">{{ drop.description }}</p>
          <p class="ad__flavour">{{ drop.def.flavour }}</p>
          <div class="ad__progress">
            <span class="ad__progress-track" aria-hidden="true">
              <span class="ad__progress-fill" [style.width.%]="percent"></span>
            </span>
            <span class="ad__progress-text">{{ drop.found }}/{{ drop.total }}</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Corner drop (Mortal → Anomalous) ─────────────────────────────── */
    .ad {
      /* Cleared above the Forge Flame rather than sitting on it.
         The flame is a permanent fixture in this exact corner — 64px of ember
         plus its own offset — and this card is 99998 with pointer events on, so
         for the four to seven seconds a drop is on screen it was swallowing
         every strike aimed at the ember underneath it.
         That was survivable until strikes started counting: a combo breaks after
         two seconds of silence, and every tier crossing drops an achievement, so
         the toast celebrating x10 was guaranteeing you never saw x50. The whole
         ladder above the first rung was unreachable in a single run.

         The offset is written as the flame's own geometry — its bottom clamp,
         plus its diameter, plus a gap wide enough to stay clear through this
         card's own slide-in — rather than as a round number, so the two stay in
         step if the ember is ever resized. */
      position: fixed; right: 1.25rem; z-index: var(--z-spectacle);
      bottom: calc(clamp(12px, 3vw, 26px) + 64px + 32px);
      display: flex; gap: 0.85rem; align-items: flex-start;
      width: min(340px, calc(100vw - 2.5rem));
      padding: 0.95rem 1.1rem;
      border-radius: 14px;
      border: 1px solid var(--tier);
      background:
        radial-gradient(ellipse 80% 70% at 12% 0%, color-mix(in srgb, var(--tier) 14%, transparent), transparent 70%),
        rgba(8, 5, 20, 0.95);
      box-shadow: 0 0 32px -10px var(--tier-glow), 0 18px 44px -16px rgba(0,0,0,.85);
      cursor: pointer;
      /* Slides in from the right. Safe here specifically because this card is
         already right-anchored and stacked above the flame — the travel stays
         inside its own corner instead of sweeping across the flame's hit area
         on the way in. */
      opacity: 0; transform: translateX(26px) scale(.96);
      transition: opacity .38s ease, transform .38s cubic-bezier(.34, 1.56, .64, 1);
    }
    .ad--on { opacity: 1; transform: none; }

    .ad__icon {
      display: grid; place-items: center; flex: none;
      width: 46px; height: 46px; border-radius: 50%;
      font-size: 22px;
      background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--tier) 55%, transparent) 0%, rgba(8,3,24,.92) 85%);
      box-shadow: 0 0 16px var(--tier-glow), inset 0 0 8px rgba(0,0,0,.5);
    }

    .ad__body { min-width: 0; }
    .ad__tier { display: flex; align-items: center; gap: .5rem; margin: 0 0 .3rem; }
    .ad__tier-icon { width: 22px; height: 22px; }
    .ad__badge {
      font: 700 10px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .12em; text-transform: uppercase;
      padding: 4px 8px; border-radius: 999px;
      color: var(--tier);
      border: 1px solid color-mix(in srgb, var(--tier) 55%, transparent);
      background: color-mix(in srgb, var(--tier) 12%, transparent);
    }
    .ad__kind { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #7d918c; }

    .ad__name { margin: 0 0 .2rem; font: 700 15px/1.25 'Orbitron', system-ui, sans-serif; color: #F2ECFF; }
    .ad__desc { margin: 0 0 .35rem; font-size: 12px; line-height: 1.45; color: #b9cdc7; }
    .ad__flavour { margin: 0 0 .6rem; font-size: 11px; font-style: italic; color: var(--tier); opacity: .85; }

    .ad__progress { display: flex; align-items: center; gap: .5rem; }
    .ad__progress-track { flex: 1; height: 3px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
    .ad__progress-fill { display: block; height: 100%; background: var(--tier); transition: width .8s ease; }
    .ad__progress-text { font-size: 10px; color: #7d918c; white-space: nowrap; }

    /* ── Cinematic (Mythic, Singular) ─────────────────────────────────── */
    .ad-flash {
      position: fixed; inset: 0; z-index: var(--z-spectacle); pointer-events: none;
      background: #fff; opacity: 0;
      transition: opacity .12s linear;
    }
    .ad-flash--on { opacity: 1; }

    .ad-veil {
      position: fixed; inset: 0; z-index: var(--z-spectacle);
      background: radial-gradient(ellipse at center, rgba(4,2,12,.8), rgba(0,0,0,.94));
      opacity: 0; transition: opacity .5s ease;
    }
    .ad-veil--on { opacity: 1; }

    .ad--cine {
      right: auto; bottom: auto; z-index: var(--z-spectacle);
      top: 50%; left: 50%;
      width: min(420px, calc(100vw - 2.5rem));
      flex-direction: column; align-items: center; text-align: center;
      padding: 2rem 1.75rem;
      border-width: 2px;
      transform: translate(-50%, -46%) scale(.9);
      animation: adPulse 1.9s ease-in-out infinite 0.5s;
    }
    .ad--cine.ad--on { transform: translate(-50%, -50%) scale(1); }

    @keyframes adPulse {
      0%, 100% { box-shadow: 0 0 40px -8px var(--tier-glow), 0 0 100px -30px var(--tier-glow); }
      50%      { box-shadow: 0 0 78px -4px var(--tier-glow), 0 0 170px -20px var(--tier-glow); }
    }

    .ad--cine .ad__icon { width: 78px; height: 78px; font-size: 38px; }
    .ad--cine .ad__name { font-size: 22px; }
    .ad--cine .ad__body { width: 100%; }
    .ad--cine .ad__tier { justify-content: center; }
    /* Mythic and Singular are the only cinematic tiers, and both take over the
       viewport — the sigil scales with the card so it is not a footnote. */
    .ad--cine .ad__tier-icon { width: 34px; height: 34px; }
    .ad--cine .ad__progress { justify-content: center; }

    /* Particle explosion: 18 shards on radial angles, thrown once. */
    .ad-burst { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    .ad-shard {
      position: absolute; top: 50%; left: 50%;
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--tier);
      box-shadow: 0 0 8px var(--tier-glow);
      transform: rotate(var(--a)) translateX(0);
      animation: adShard 1.15s cubic-bezier(.16, .85, .3, 1) forwards;
      animation-delay: calc(var(--d) * 14ms);
      opacity: 0;
    }
    @keyframes adShard {
      0%   { opacity: 1; transform: rotate(var(--a)) translateX(0) scale(1.4); }
      100% { opacity: 0; transform: rotate(var(--a)) translateX(230px) scale(.3); }
    }

    /* The flame moves at 768px — up to bottom: 76px and down to a 52px ember —
       so the clearance has to move with it, at its breakpoint rather than at
       this component's. Keeping the two numbers in step matters more than the
       exact gap: the failure is silent and only shows up as strikes that do not
       register while a drop is on screen. */
    @media (max-width: 768px) {
      /* Same sum with the mobile flame's numbers: 76px offset, 52px ember. */
      .ad { bottom: calc(76px + 52px + 32px); }
    }

    @media (max-width: 480px) {
      .ad { right: .75rem; }
      .ad--cine { right: auto; bottom: auto; padding: 1.5rem 1.1rem; }
      @keyframes adShard {
        0%   { opacity: 1; transform: rotate(var(--a)) translateX(0) scale(1.4); }
        100% { opacity: 0; transform: rotate(var(--a)) translateX(140px) scale(.3); }
      }
    }

    /* A white flash and a particle burst are exactly what this preference is
       for. The drop still appears and still reads — it just holds still. */
    @media (prefers-reduced-motion: reduce) {
      .ad { transition: opacity .3s ease; transform: none; }
      .ad--cine, .ad--cine.ad--on { transform: translate(-50%, -50%); animation: none; }
      .ad-flash { display: none; }
      .ad-shard { display: none; }
      .ad__progress-fill { transition: none; }
    }
  `],
})
export class AchievementDropComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly audio = inject(RarityAudioService);
  private readonly cdr = inject(ChangeDetectorRef);

  private sub?: Subscription;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private clearTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;

  drop: Drop | null = null;
  visible = false;
  flashing = false;
  readonly particles = Array.from({ length: 18 }, (_, i) => i);

  get percent(): number {
    return this.drop && this.drop.total > 0
      ? (this.drop.found / this.drop.total) * 100
      : 0;
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.sub = this.eggs.discovery$
      .pipe(filter(d => !!d))
      .subscribe(d => void this.present(d!));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clearTimers();
  }

  private async present(d: EggDiscovery): Promise<void> {
    this.clearTimers();

    let tier = tierForEgg(d.egg.id, d.egg.rarity);

    // Singular is decided by the world, not the registry: the egg service has
    // just incremented the global counter, so a count of 1 means nobody reached
    // this before you. A rediscovery can never be Singular.
    if (d.isNew) {
      try {
        if (isSingular(await this.eggs.getGlobalCount(d.egg.id))) tier = 'singular';
      } catch {
        /* offline or rules-denied — fall back to the authored tier */
      }
    }

    const def = rarityOf(tier);
    this.drop = {
      icon: d.egg.icon,
      name: d.egg.name,
      description: d.egg.description,
      tier,
      def,
      found: d.totalFound,
      total: d.totalEggs,
      isNew: d.isNew,
    };
    this.visible = false;
    this.cdr.markForCheck();

    this.audio.play(def.sound);

    if (def.cinematic) {
      // One white frame, then the card arrives underneath it as it fades.
      this.flashing = true;
      this.flashTimer = setTimeout(() => {
        this.flashing = false;
        this.cdr.markForCheck();
      }, 100);
    }

    // Next frame, so the entry transition has a start state to run from.
    requestAnimationFrame(() => {
      this.visible = true;
      this.cdr.markForCheck();
    });

    this.hideTimer = setTimeout(() => this.dismiss(), def.duration);
  }

  dismiss(): void {
    this.visible = false;
    this.cdr.markForCheck();
    this.clearTimer = setTimeout(() => {
      this.drop = null;
      this.cdr.markForCheck();
    }, 450);
  }

  private clearTimers(): void {
    [this.hideTimer, this.clearTimer, this.flashTimer].forEach(t => t && clearTimeout(t));
    this.hideTimer = this.clearTimer = this.flashTimer = undefined;
  }
}
