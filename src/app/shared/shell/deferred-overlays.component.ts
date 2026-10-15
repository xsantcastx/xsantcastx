import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AchievementDropComponent } from '../rarity/achievement-drop.component';
import { DiscoveryToastComponent } from '../collection/discovery-toast.component';
import { QuestDrawerComponent } from '../quests/quest-drawer.component';
import { QuestToastComponent } from '../quests/quest-toast.component';
import { LevelUpBannerComponent } from '../activity/level-up-banner.component';
import { InspectComponent } from '../entity/inspect.component';
import { ForgeFlameComponent } from '../economy/forge-flame.component';
import { KeeperPanelComponent } from '../keeper/keeper-panel.component';
import { ForgedTodayComponent } from '../social-proof/forged-today.component';
import { NpcDialogueComponent } from '../npc/npc-dialogue.component';

/**
 * The shell's overlays that sit idle until something happens: toasts, drawers,
 * the flame, the NPC portrait, Quick Inspect.
 *
 * They live behind one @defer block so the catalogue, dialogue and lore tables
 * they pull in leave the initial bundle. The chunk is prefetched immediately
 * and rendered on idle, so it is on screen a beat after first paint and nothing
 * is fetched on demand at the moment of use. Every one of these is
 * position:fixed and non-blocking, so mounting late shifts no layout.
 *
 * Angular only turns a standalone component's imports into lazy ones when the
 * host is standalone and the dependency is used inside a @defer block; that is
 * why this is a component of its own and not part of AppComponent's template
 * (AppComponent is declared in AppModule, which keeps everything eager).
 * Mounted only outside /play, exactly as the individual tags were.
 */
@Component({
  selector: 'app-deferred-overlays',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AchievementDropComponent,
    DiscoveryToastComponent,
    QuestDrawerComponent,
    QuestToastComponent,
    LevelUpBannerComponent,
    InspectComponent,
    ForgeFlameComponent,
    KeeperPanelComponent,
    ForgedTodayComponent,
    NpcDialogueComponent,
  ],
  template: `
    @defer (on idle; prefetch on immediate) {
      <app-achievement-drop></app-achievement-drop>
      <app-discovery-toast></app-discovery-toast>
      <app-quest-drawer></app-quest-drawer>
      <app-quest-toast></app-quest-toast>
      <app-level-up-banner></app-level-up-banner>
      <app-inspect></app-inspect>
      @if (showCornerFlame()) {
        <app-forge-flame></app-forge-flame>
      }
      <app-keeper-panel></app-keeper-panel>
      <app-forged-today></app-forged-today>
      <app-npc-dialogue></app-npc-dialogue>
    }
  `,
})
export class DeferredOverlaysComponent {
  readonly showCornerFlame = input(true);
}
