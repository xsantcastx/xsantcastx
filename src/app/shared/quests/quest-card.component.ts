/**
 * quest-card.component.ts — one quest, rendered.
 *
 * Used unchanged by the drawer and by /quests, so a quest looks the same
 * wherever it is read. The card takes its border and glow from the quest's
 * rarity tier and its accent from the quest's realm, which means the two
 * systems the site already has — the drop ladder and the five realms — are the
 * only vocabulary a visitor has to learn.
 *
 * Presentational: it renders a Quest and emits a claim. It never reads or
 * writes QuestService, so the same card can be dropped anywhere.
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { Quest } from './quest.model';
import { RARITIES } from '../rarity/rarity.model';
import { REALMS } from '../realms/realm.model';

@Component({
  selector: 'app-quest-card',
  standalone: true,
  imports: [CommonModule, InspectButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (quest) {
      <article
        class="qc"
        [class.qc--done]="quest.status === 'completed'"
        [class.qc--claimed]="quest.claimed"
        [attr.data-tier]="quest.rarity"
        [style.--tier]="tierColor"
        [style.--tier-glow]="tierGlow"
        [style.--realm]="realmColor">

        <header class="qc__head">
          <h3 class="qc__title">{{ quest.title }}</h3>
          @if (quest.claimed) {
            <span class="qc__seal" aria-label="Claimed">&#10003;</span>
          }
        </header>

        <p class="qc__lore">{{ quest.loreText }}</p>

        <p class="qc__desc">{{ quest.description }}</p>

        <div class="qc__track" role="progressbar"
             [attr.aria-valuenow]="quest.progress"
             aria-valuemin="0" aria-valuemax="100"
             [attr.aria-label]="quest.title + ' progress'">
          <span class="qc__fill" [style.width.%]="quest.progress"></span>
        </div>

        <footer class="qc__foot">
          <app-inspect-button type="quest" [id]="quest.id"></app-inspect-button>
          <span class="qc__count">{{ quest.observed }}/{{ quest.condition.count }}</span>

          @if (quest.status === 'completed' && !quest.claimed) {
            <button type="button" class="qc__claim" (click)="claim.emit(quest.id)">
              Claim {{ rewardLabel }}
            </button>
          } @else {
            <span class="qc__reward" [class.qc__reward--spent]="quest.claimed">{{ rewardLabel }}</span>
          }
        </footer>

        @if (quest.claimed && quest.rewards.loreFragment) {
          <p class="qc__fragment">{{ quest.rewards.loreFragment }}</p>
        }
      </article>
    }
  `,
  styles: [`
    .qc {
      position: relative;
      display: flex; flex-direction: column; gap: 8px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--tier) 40%, transparent);
      background:
        radial-gradient(ellipse 80% 60% at 0% 0%, color-mix(in srgb, var(--realm) 9%, transparent), transparent 70%),
        rgba(8, 5, 22, 0.72);
      box-shadow: 0 0 24px -14px var(--tier-glow);
      transition: border-color .3s ease, box-shadow .3s ease, transform .3s ease;
    }
    /* The tier stripe. Reads as rarity from across the room, before any text. */
    .qc::before {
      content: ''; position: absolute; left: 0; top: 12px; bottom: 12px;
      width: 2px; border-radius: 2px;
      background: linear-gradient(180deg, var(--tier), transparent);
    }

    .qc--done { border-color: var(--tier); box-shadow: 0 0 30px -10px var(--tier-glow); }
    .qc--claimed { opacity: .62; }

    .qc__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .qc__title {
      margin: 0;
      font: 600 14px/1.3 'Orbitron', system-ui, sans-serif;
      color: var(--realm);
      letter-spacing: .02em;
    }
    .qc__seal { color: var(--tier); font-size: 14px; flex: none; }

    .qc__lore {
      margin: 0;
      font: italic 400 12px/1.55 Georgia, 'Times New Roman', serif;
      color: #9aa8bd;
    }
    .qc__desc { margin: 0; font-size: 12px; color: #c6d4d0; }

    .qc__track {
      height: 5px; border-radius: 999px; overflow: hidden;
      background: rgba(255, 255, 255, 0.08);
    }
    .qc__fill {
      display: block; height: 100%;
      background: linear-gradient(90deg, var(--realm), var(--tier));
      transition: width .6s cubic-bezier(.22, 1, .36, 1);
    }

    .qc__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .qc__count {
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      color: #8fa09b;
    }
    .qc__reward { font-size: 12px; color: var(--tier); }
    .qc__reward--spent { color: #6d817c; text-decoration: line-through; }

    .qc__claim {
      min-height: 44px; padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid var(--tier);
      background: color-mix(in srgb, var(--tier) 14%, transparent);
      color: #F2ECFF;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      cursor: pointer;
      animation: qcReady 2.4s ease-in-out infinite;
    }
    .qc__claim:hover { background: color-mix(in srgb, var(--tier) 26%, transparent); }
    @keyframes qcReady {
      0%, 100% { box-shadow: 0 0 0 0 var(--tier-glow); }
      50%      { box-shadow: 0 0 18px -2px var(--tier-glow); }
    }

    .qc__fragment {
      margin: 2px 0 0;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font: italic 400 11px/1.6 Georgia, 'Times New Roman', serif;
      color: #b9a76a;
    }

    @media (prefers-reduced-motion: reduce) {
      .qc, .qc__fill { transition: none; }
      .qc__claim { animation: none; box-shadow: 0 0 14px -4px var(--tier-glow); }
    }
  `],
})
export class QuestCardComponent {
  @Input({ required: true }) quest!: Quest;
  @Output() claim = new EventEmitter<string>();

  get tierColor(): string {
    return RARITIES[this.quest.rarity]?.color ?? RARITIES.mortal.color;
  }

  get tierGlow(): string {
    return RARITIES[this.quest.rarity]?.glow ?? RARITIES.mortal.glow;
  }

  /** A quest with no realm is a Wanderer quest — it takes the brand cyan. */
  get realmColor(): string {
    const realm = REALMS.find(r => r.id === this.quest.realm);
    return realm?.color ?? '#A78BFA';
  }

  get rewardLabel(): string {
    const { xp, energy } = this.quest.rewards;
    if (energy === 'aether') return `+${xp} Aether`;
    if (energy === 'nox') return `+${xp} Nox`;
    return `+${xp} XP`;
  }
}
