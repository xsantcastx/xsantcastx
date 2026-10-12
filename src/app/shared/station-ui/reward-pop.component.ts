/**
 * <app-reward-pop> — the "you got it!" card that pops in the station after an
 * action: item art on a rarity-coloured burst, the name, one line of why it
 * matters, and a button to put it away.
 *
 *   <app-reward-pop [reward]="reward" (dismissed)="reward = null" />
 *
 *   reward: StationReward = { seq: ++n, name: 'Briarvein Kris', art: artFor(id),
 *                             rarity: 'rare', rarityLabel: 'Rare', caption: 'Quality 87%' }
 *
 * In-flow, not a fixed overlay: it renders where it is placed (top of the
 * station's hero), so it works inside the /play in-world panel (`contain:
 * layout`) and under the routed host's transform without any z-index games.
 * The SCREEN-level payoff (rings, flash, sound) stays CelebrationService's job:
 * call `celebration.celebrate(tier)` alongside setting the reward — don't
 * rebuild it here.
 *
 * Colour comes from the global `[data-rarity]` rules in tokens/rarity.css
 * (`--rarity`, `--rarity-glow`). `seq` must change per reward so the same item
 * twice still replays the burst.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { STATION_UI_I18N } from './station-ui.i18n';
import type { StationArt } from './station-ui.model';

export interface StationReward {
  /** Bump per reward; replays the burst for a repeat of the same item. */
  seq: number;
  name: string;
  art?: StationArt | null;
  /** A RuneTier / ItemRarity id: common … singular. Drives the burst colour. */
  rarity?: string;
  rarityLabel?: string;
  /** One short line: "Quality 87%", "+12 Gold/sec", "Recipe mastered!". */
  caption?: string;
  /** Optional kicker override (default "You got"). */
  kicker?: string;
}

@Component({
  selector: 'app-reward-pop',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (r of shown(); track r.seq) {
      <div class="rp" [attr.data-rarity]="r.rarity || 'common'" role="status" aria-live="polite">
        <div class="rp__stage" aria-hidden="true">
          <span class="rp__burst"></span>
          <span class="rp__ring"></span>
          @if (r.art; as a) {
            <img class="rp__art" [src]="a.src" [attr.srcset]="a.srcset || null" sizes="112px"
                 alt="" width="112" height="112" decoding="async" draggable="false">
          } @else {
            <span class="rp__glyph">{{ r.name.slice(0, 1) }}</span>
          }
        </div>
        <div class="rp__copy">
          <p class="rp__kicker">{{ r.kicker || t('stationUi.youGot') }}</p>
          <p class="rp__name">{{ r.name }}</p>
          @if (r.rarityLabel) { <p class="rp__tier">{{ r.rarityLabel }}</p> }
          @if (r.caption) { <p class="rp__caption">{{ r.caption }}</p> }
          <button type="button" class="rp__ok" (click)="dismissed.emit()">{{ t('stationUi.nice') }}</button>
        </div>
      </div>
    }
  `,
  styleUrls: ['./station-tokens.css', './reward-pop.component.css'],
})
export class RewardPopComponent {
  private readonly i18n = inject(TranslationService);

  readonly reward = input<StationReward | null>(null);
  readonly dismissed = output<void>();

  readonly shown = computed(() => {
    const r = this.reward();
    return r ? [r] : [];
  });

  constructor() { this.i18n.register(STATION_UI_I18N); }

  t(key: string): string { return this.i18n.translate(key); }
}
