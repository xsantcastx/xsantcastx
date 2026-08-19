/**
 * current-work-tile.component.ts — global Current Work summary.
 *
 * Closed: activity · location · level · XP. Expand: recovery, Go to the
 * site, work summary. No Inspect Current Work. No Mine / Gather control.
 *
 * Discipline-aware since A2: every line used to hard-code Mining and the
 * Seamworks, so a foraging Current Work would have read "Mining · Basalt
 * Seamworks · Elsewhere" with the mining cooldown. The tile now derives the
 * discipline from Current Work and picks copy, level, recovery and the Go
 * link per discipline. Two disciplines are still a pair of ternaries, not a
 * table — a third skill earns the table.
 */
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import { ActivityProgressionGateway } from './activity-progression.gateway';
import {
  locationDefinition,
  type ActivityLedger,
} from './activity.model';
import { ROOTGLASS_CANOPY_HREF } from './foraging.model';
import { miningLevelView } from './mining-level';

type TileDiscipline = 'mining' | 'foraging';

@Component({
  selector: 'app-current-work-tile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="cwt" [class.cwt--open]="open" [attr.data-state]="state()">
      <h2 class="cwt__hd">
        <button
          type="button"
          class="cwt__toggle"
          [attr.aria-expanded]="open"
          aria-controls="cwt-body"
          (click)="open = !open">
          <span class="cwt__label">{{ t('work.tile.label') }}</span>
          <span class="cwt__closed">{{ closedLine() }}</span>
          <span class="cwt__state">{{ stateLabel() }}</span>
        </button>
      </h2>
      <div id="cwt-body" class="cwt__body" [hidden]="!open">
        <p class="cwt__xp">{{ xpLine() }}</p>
        <p class="cwt__recovery">{{ recoveryLine() }}</p>
        <p class="cwt__summary">{{ t(discipline() === 'foraging' ? 'work.tile.summaryForaging' : 'work.tile.summary') }}</p>
        <a class="cwt__go" [routerLink]="goHref()">{{ t(discipline() === 'foraging' ? 'work.tile.goCanopy' : 'work.tile.go') }}</a>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .cwt {
      --work: #EF4444;
      border: 1px solid rgba(239, 68, 68, 0.28);
      background: rgba(10, 10, 15, 0.55);
      border-radius: 10px;
      color: #e8ecf1;
    }
    .cwt__toggle {
      width: 100%;
      min-height: 44px;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.7rem;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 0.75rem;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .cwt__toggle:focus-visible {
      outline: 2px solid var(--work);
      outline-offset: -2px;
    }
    .cwt__label {
      font: 600 0.68rem/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--work);
    }
    .cwt__closed { flex: 1 1 10rem; font-size: 0.86rem; }
    .cwt__state { font-size: 0.78rem; color: rgba(232, 236, 241, 0.62); }
    .cwt__body { padding: 0 0.75rem 0.8rem; }
    .cwt__xp, .cwt__recovery, .cwt__summary {
      margin: 0 0 0.45rem;
      font-size: 0.86rem;
      color: rgba(232, 236, 241, 0.86);
    }
    .cwt__go {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--work);
    }
    .cwt__go:focus-visible { outline: 2px solid var(--work); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .cwt, .cwt__toggle { transition: none; }
    }
  `],
})
export class CurrentWorkTileComponent implements OnInit, OnDestroy {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly i18n = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private clock?: ReturnType<typeof setInterval>;

  open = false;
  snap: ActivityLedger = this.activity.snapshot;
  now = Date.now();

  ngOnInit(): void {
    this.activity.init();
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
    if (this.isBrowser) {
      this.clock = setInterval(() => { this.now = Date.now(); }, 250);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  /** Mining unless Current Work says foraging — the two live disciplines. */
  discipline(): TileDiscipline {
    return this.snap.currentWork?.disciplineId === 'foraging' ? 'foraging' : 'mining';
  }

  goHref(): string {
    return this.discipline() === 'foraging' ? ROOTGLASS_CANOPY_HREF : BASALT_SEAMWORKS_HREF;
  }

  private view() {
    return miningLevelView(this.snap.progress.xpByDiscipline[this.discipline()] ?? 0);
  }

  closedLine(): string {
    const work = this.snap.currentWork;
    if (!work) return this.t('work.tile.empty');
    const foraging = this.discipline() === 'foraging';
    const view = this.view();
    const next = view.next ?? view.xp;
    return this.t('work.tile.closed', {
      activity: this.t(foraging ? 'work.discipline.foraging' : 'work.discipline.mining'),
      location: this.t(foraging ? 'work.location.canopy' : 'work.location.seamworks'),
      level: view.level,
      xp: view.xp,
      next,
    });
  }

  xpLine(): string {
    const foraging = this.discipline() === 'foraging';
    const view = this.view();
    if (view.next == null) {
      return this.t(foraging ? 'work.tile.xpMaxForaging' : 'work.tile.xpMax', { xp: view.xp, level: view.level });
    }
    return this.t(foraging ? 'work.tile.xpForaging' : 'work.tile.xp', { xp: view.xp, next: view.next, level: view.level });
  }

  recoveryLine(): string {
    const remain = this.activity.recoveryRemainingMs(Date.now());
    if (remain <= 0) return this.t(this.discipline() === 'foraging' ? 'work.tile.readyForaging' : 'work.tile.ready');
    // The player's actual current cooldown for the *current discipline*, not
    // the flat baseline and not the mining number: once level or gear has
    // shortened it, or Current Work is foraging, the old constant would make
    // the "of Ns" half of this line simply wrong.
    return this.t('work.tile.recovering', {
      seconds: (remain / 1000).toFixed(1),
      wait: (this.activity.currentRecoveryMs() / 1000).toFixed(1),
    });
  }

  state(): string {
    if (!this.snap.currentWork) return 'idle';
    if (this.activity.recoveryRemainingMs(this.now) > 0) return 'recovering';
    // 'away' means Current Work points at a place this build does not know —
    // any registered site (Seamworks or Canopy) is somewhere the tile can send you.
    if (!locationDefinition(this.snap.currentWork.locationId)) return 'away';
    return 'ready';
  }

  stateLabel(): string {
    const keys = {
      idle: 'work.tile.state.idle',
      recovering: 'work.tile.state.recovering',
      away: 'work.tile.state.away',
      ready: 'work.tile.state.ready',
    } as const;
    return this.t(keys[this.state() as keyof typeof keys]);
  }
}
