/**
 * tool-stats.component.ts — the Keeper Stats "Tools" block: per family, the
 * tier it works as, its power and its swing pace, plus the one rule players
 * miss ("Tools work from your satchel — no need to equip.").
 *
 * Reads the inventory and the activity ledger; writes nothing.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslationService } from '../../translation.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { InventoryService } from '../rpg/inventory.service';
import { isChestHolder } from '../delve/delve-save.model';
import { TOOLS_I18N } from './tools.i18n';
import { formatSwing, toolStatus, type ToolFamilyStatus } from './tools';
import { TOOL_NUMERALS } from './tool-items';

interface ToolRow { family: string; label: string; lines: string[]; }

@Component({
  selector: 'app-tool-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tst" aria-labelledby="tst-title">
      <h3 id="tst-title" class="tst__head">{{ t('toolStat.title') }}</h3>
      <p class="tst__rule">{{ t('toolStat.fromSatchel') }}</p>
      <dl class="tst__list">
        @for (row of rows; track row.family) {
          <div class="tst__row" [attr.data-family]="row.family">
            <dt>{{ row.label }}</dt>
            @for (line of row.lines; track $index) { <dd>{{ line }}</dd> }
          </div>
        }
      </dl>
    </section>
  `,
  styles: [`
    :host { display: block; margin-top: 1.2rem; }
    .tst__head { margin: 0 0 .3rem; font: 700 1rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .tst__rule { margin: 0 0 .7rem; color: var(--gf-faint); font-size: .85rem; }
    .tst__list { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .7rem; margin: 0; }
    .tst__row dt { font-weight: 600; color: var(--gf-ink); }
    .tst__row dd { margin: .15rem 0 0; font-size: .85rem; color: var(--gf-faint); }
  `],
})
export class ToolStatsComponent implements OnInit {
  private readonly inventory = inject(InventoryService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  rows: ToolRow[] = [];

  constructor() { this.i18n.register(TOOLS_I18N); }

  ngOnInit(): void {
    this.inventory.init();
    this.activity.init();
    this.build();
    this.inventory.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.build());
    this.activity.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.build());
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  private build(): void {
    const snap = this.inventory.snapshot;
    // A tool stored in a Delve chest is not in hand (the same rule /play uses).
    const held = { ...snap, items: snap.items.filter(item => !isChestHolder(item.explorerId)) };
    this.rows = toolStatus(held, this.activity.snapshot.progress).map(status => this.row(status));
    this.cdr.markForCheck();
  }

  private row(s: ToolFamilyStatus): ToolRow {
    const family = this.t(`toolStat.family.${s.family}`);
    if (!s.tier) return { family: s.family, label: family, lines: [this.t('toolStat.none')] };
    const skill = this.t(`toolStat.skill.${s.skill}`);
    const lines = [
      this.t('toolStat.power', { skill, n: s.power }),
      this.t(s.starter ? 'toolStat.swingStarter' : 'toolStat.swing', { s: formatSwing(s.swing) }),
    ];
    if (s.capUntil) lines.push(this.t('toolStat.worksAs', { tier: TOOL_NUMERALS[s.tier], skill, level: s.capUntil }));
    if (s.starter) lines.push(this.t('toolStat.starterHint'));
    return { family: s.family, label: this.t('toolStat.row', { name: family, tier: TOOL_NUMERALS[s.tier] }), lines };
  }
}
