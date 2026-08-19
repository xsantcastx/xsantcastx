/**
 * roll-quality.component.ts — the roll grade, as bars a player can read at a glance.
 *
 * `modsOf` already appends the percentage to each stat line, which is enough in
 * a dense bag grid. This is the other reading, for the surfaces that have room:
 * one bar per stat, filled to the grade and coloured by band, plus the overall
 * average and the Perfect/Flawless badge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A BAR AND NOT JUST THE NUMBER
 * ─────────────────────────────────────────────────────────────────────────────
 * The number answers "how good is this stat"; the bar answers "how much is left
 * on the table", which is the question that decides whether to reforge. Sitting
 * them side by side means the comparison between two items is a shape rather
 * than arithmetic, and shapes survive being looked at for a quarter of a second.
 *
 * Renders nothing at all for an ungraded item. Legacy instances carry no grade
 * and inventing a bar for them would be the UI making up a number — see the
 * header of item-quality.ts.
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  QUALITY_TAG_LABELS,
  formatQuality,
  gradeFor,
  qualityOf,
  qualityTagOf,
  type QualityTag,
} from './item-quality';
import { ITEM_STAT_KEYS, ITEM_STAT_LABELS, formatStatValue, type GameItem, type ItemStats } from './item.model';

interface QualityRow {
  key: keyof ItemStats;
  label: string;
  /** The rolled number, formatted the way the tooltip formats it. */
  value: string;
  /** 0..1. */
  pct: number;
  text: string;
  color: string;
  glow: string;
}

@Component({
  selector: 'app-roll-quality',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rq" *ngIf="rows.length" [attr.data-quality-tag]="tag">
      <p class="rq__head">
        <span class="rq__label">Roll</span>
        <span class="rq__overall" [style.color]="overallColor">{{ overallText }}</span>
        <span class="rq__tag" *ngIf="tagLabel">{{ tagLabel }}</span>
      </p>
      <ul class="rq__rows">
        <li class="rq__row" *ngFor="let row of rows">
          <span class="rq__stat">{{ row.label }}</span>
          <span class="rq__val">{{ row.value }}</span>
          <span class="rq__track">
            <span class="rq__fill"
                  [style.width.%]="row.pct * 100"
                  [style.background]="row.color"
                  [style.box-shadow]="'0 0 8px ' + row.glow"></span>
          </span>
          <span class="rq__pct" [style.color]="row.color">{{ row.text }}</span>
        </li>
      </ul>
    </div>
  `,
  styleUrls: ['./roll-quality.component.css'],
})
export class RollQualityComponent {
  rows: QualityRow[] = [];
  tag: QualityTag = null;
  tagLabel = '';
  overallText = '';
  overallColor = '';

  @Input({ required: true })
  set item(value: GameItem | null | undefined) {
    this.rows = [];
    this.tag = null;
    this.tagLabel = '';
    if (!value?.rollQuality) return;

    for (const key of ITEM_STAT_KEYS) {
      const pct = value.rollQuality[key];
      if (typeof pct !== 'number' || !Number.isFinite(pct)) continue;
      const stat = value.stats[key];
      const grade = gradeFor(pct);
      this.rows.push({
        key,
        label: ITEM_STAT_LABELS[key],
        value: stat == null ? '—' : formatStatValue(key, stat),
        pct: Math.min(1, Math.max(0, pct)),
        text: formatQuality(pct),
        color: grade.color,
        glow: grade.glow,
      });
    }
    if (!this.rows.length) return;

    const overall = qualityOf(value);
    this.overallText = overall == null ? '' : formatQuality(overall);
    this.overallColor = overall == null ? '' : gradeFor(overall).color;
    this.tag = qualityTagOf(value);
    this.tagLabel = this.tag ? QUALITY_TAG_LABELS[this.tag] : '';
  }
}
