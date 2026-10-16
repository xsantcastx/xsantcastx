/**
 * hub-stats.component.ts — rank, wallet rates, attributes, tools. Existing ledgers only.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { XpService, type XpSnapshot } from '../gamification/xp.service';
import { EconomyService, type EconomySnapshot } from '../economy/economy.service';
import { formatCompact, formatCurrency } from '../economy/economy.model';
import { StatPanelComponent } from '../rpg/stat-panel.component';
import { ToolStatsComponent } from '../skills/tool-stats.component';
import { SkillTitlesComponent } from '../skills/skill-titles.component';
import { WornTitleService } from '../skills/worn-title.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { CraftingService } from '../crafting/crafting.service';
import { skillLevel } from '../skills/skill.model';
import { SKILL_TITLES_I18N } from '../skills/skill-titles.i18n';
import { titleFor, titleText } from '../skills/skill-titles';

@Component({
  selector: 'app-hub-stats',
  standalone: true,
  imports: [StatPanelComponent, ToolStatsComponent, SkillTitlesComponent],
  template: `
    <section class="ht" aria-labelledby="ht-title">
      <h2 id="ht-title">{{ t('hub.stats.title') }}</h2>
      <dl class="ht__dl">
        <div>
          <dt>{{ t('hub.stats.rank') }}</dt>
          <dd>{{ xp.level.title }} · {{ xp.level.level }}
            @if (wornTitle; as worn) { <span class="ht__worn">· {{ worn }}</span> }
          </dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.xp') }}</dt>
          <dd>{{ xp.xp }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.gold') }}</dt>
          <dd>{{ gold }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.essence') }}</dt>
          <dd>{{ essence }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.rate') }}</dt>
          <dd>{{ rate }}</dd>
        </div>
        <div>
          <dt>{{ t('hub.stats.affinity') }}</dt>
          <dd>{{ affinity }}</dd>
        </div>
      </dl>
      <app-stat-panel />
      <app-tool-stats />
      <app-skill-titles />
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ht h2 { margin: 0 0 0.8rem; font: 700 1.15rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .ht__dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.7rem; margin: 0 0 1.2rem; }
    .ht__dl dt { font-size: 0.72rem; letter-spacing: .08em; text-transform: uppercase; color: var(--gf-faint); }
    .ht__dl dd { margin: 0.2rem 0 0; font-weight: 600; color: var(--gf-ink); }
    .ht__worn { color: var(--gf-accent-text); }
    /* In a game window: MapleStory's stat block, label over value in a pixel card, three across; the heading is the tab. */
    :host-context(.place) .ht { display: grid; gap: 8px; }
    :host-context(.place) .ht h2 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    :host-context(.place) .ht__dl { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; margin: 0; padding: 2px; background: var(--obsidian-0); box-shadow: var(--px-cell-rim); }
    :host-context(.place) .ht__dl > div { padding: 6px 8px; background: var(--px-cell-bg); min-width: 0; }
    :host-context(.place) .ht__dl dt { font: 600 9px/1.2 Orbitron, sans-serif; letter-spacing: .08em; }
    :host-context(.place) .ht__dl dd { font: 700 13px/1.25 Orbitron, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class HubStatsComponent implements OnInit, OnDestroy {
  private readonly xpSvc = inject(XpService);
  private readonly economy = inject(EconomyService);
  private readonly i18n = inject(TranslationService);
  private readonly worn = inject(WornTitleService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly crafting = inject(CraftingService);
  private sub?: Subscription;
  /** The worn skill title (the name-tag flourish), or null. Re-derived from XP, so it can never outrun it. */
  wornTitle: string | null = null;
  xp: XpSnapshot = this.xpSvc.snapshot;
  eco: EconomySnapshot = this.economy.snapshot;

  ngOnInit(): void {
    this.i18n.register(SKILL_TITLES_I18N);
    this.xpSvc.init();
    this.economy.init();
    this.sub = this.xpSvc.snapshot$.subscribe(snap => { this.xp = snap; });
    this.sub.add(this.economy.snapshot$.subscribe(snap => { this.eco = snap; }));
    this.activity.init();
    this.crafting.init();
    this.sub.add(this.worn.worn$.subscribe(() => this.readWorn()));
    this.sub.add(this.activity.snapshot$.subscribe(() => this.readWorn()));
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  t(key: string): string { return this.i18n.translate(key); }
  private readWorn(): void {
    const skill = this.worn.worn;
    if (!skill) { this.wornTitle = null; return; }
    const level = skillLevel(this.activity.snapshot.progress, skill, skill === 'smithing' ? this.crafting.snapshot.xp : 0);
    const title = titleFor(skill, level);
    this.wornTitle = title ? titleText(title, (k, v) => this.i18n.translate(k, v)) : null;
  }
  get gold(): string { return formatCurrency(this.eco.gold); }
  get essence(): string { return formatCurrency(this.eco.essence); }
  get rate(): string { return formatCompact(this.eco.perSecond); }
  get affinity(): string {
    const aether = Math.round((this.xp.aetherShare ?? 0) * 100);
    return `${aether}% / ${100 - aether}%`;
  }
}
