/**
 * The station UI kit. Import ONLY from lazily-loaded components (routed pages,
 * in-world panels) — never from the header, the app shell or anything eager:
 * the initial bundle is at its hard limit. See README.md in this folder.
 */
import { ActionButtonComponent } from './action-button.component';
import { CostChipComponent } from './cost-chip.component';
import { DetailsDrawerComponent } from './details-drawer.component';
import { RewardPopComponent } from './reward-pop.component';
import { StationShellComponent } from './station-shell.component';
import { StationTabsComponent } from './station-tabs.component';
import { SkillStripComponent } from './skill-strip.component';
import { StationJournalComponent } from './station-journal.component';
import { JournalListComponent } from './journal-list.component';
import { DetailHeadComponent } from './detail-head.component';
import { RequirementGridComponent } from './requirement-grid.component';

export {
  ActionButtonComponent, CostChipComponent, DetailsDrawerComponent, RewardPopComponent, StationShellComponent,
  StationTabsComponent, SkillStripComponent, StationJournalComponent, JournalListComponent,
  DetailHeadComponent, RequirementGridComponent,
};
export type { StationReward } from './reward-pop.component';
export type { StationTab } from './station-tabs.component';
export type { JournalRow } from './journal-list.component';
export { forgeTabs, type ForgeTabId } from './forge-tabs';
export * from './station-ui.model';
export { STATION_UI_I18N } from './station-ui.i18n';

/** Drop into a standalone component's `imports`. */
export const STATION_UI = [
  StationShellComponent,
  ActionButtonComponent,
  CostChipComponent,
  RewardPopComponent,
  DetailsDrawerComponent,
  StationTabsComponent,
  SkillStripComponent,
  StationJournalComponent,
  JournalListComponent,
  DetailHeadComponent,
  RequirementGridComponent,
] as const;
