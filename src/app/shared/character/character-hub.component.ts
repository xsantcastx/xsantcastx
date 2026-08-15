/**
 * character-hub.component.ts — Loadout / Bank / Skills / Stats / Records.
 *
 * Shared by /character and the keeper drawer. Equip lives only on Loadout.
 */
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EquipmentPanelComponent } from '../rpg/equipment-panel.component';
import { CharacterHubService, HUB_TABS, type HubTab } from './character-hub.service';
import { HubBankComponent } from './hub-bank.component';
import { HubSkillsComponent } from './hub-skills.component';
import { HubStatsComponent } from './hub-stats.component';

@Component({
  selector: 'app-character-hub',
  standalone: true,
  imports: [
    EquipmentPanelComponent,
    HubBankComponent,
    HubSkillsComponent,
    HubStatsComponent,
  ],
  templateUrl: './character-hub.component.html',
  styleUrls: ['./character-hub.component.css'],
})
export class CharacterHubComponent implements OnInit, OnDestroy {
  private readonly hub = inject(CharacterHubService);
  private readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private sub?: Subscription;

  @Input() variant: 'page' | 'drawer' = 'page';
  readonly tabs = HUB_TABS;
  tab: HubTab = this.hub.tab;

  ngOnInit(): void {
    this.sub = this.hub.tab$.subscribe(tab => { this.tab = tab; });
    this.sub.add(this.route.queryParamMap.subscribe(params => {
      const fromQuery = this.hub.parseTab(params.get('tab'));
      const next = fromQuery ?? (params.get('item') ? 'bank' as const : null);
      if (next && next !== this.hub.tab) this.hub.setTab(next);
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  t(key: string): string {
    return this.i18n.translate(key);
  }

  select(tab: HubTab): void {
    this.hub.setTab(tab);
    if (this.variant === 'page') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }
}
