/**
 * hub-skills.component.ts — the Character hub's Skills tab.
 *
 * Was its own grid: three live tiles and three "Reserved" ones. Every skill is
 * now real (eight of them, one 1-99 curve, an unlock table each), so the grid
 * moved into the shared skills panel — the same component the world opens as
 * its 'skills' panel — and this tab is the Current Work tile above it. One
 * skill sheet, two hosts, so the two can never disagree.
 */
import { Component } from '@angular/core';

import { CurrentWorkTileComponent } from '../activity/current-work-tile.component';
import { SkillsPanelComponent } from '../skills/skills-panel.component';

@Component({
  selector: 'app-hub-skills',
  standalone: true,
  imports: [CurrentWorkTileComponent, SkillsPanelComponent],
  template: `
    <div class="hs">
      <app-current-work-tile></app-current-work-tile>
      <app-skills-panel></app-skills-panel>
    </div>
  `,
  styles: [`
    :host { display: block; }
    app-current-work-tile { display: block; margin-bottom: 1rem; }
  `],
})
export class HubSkillsComponent {}
