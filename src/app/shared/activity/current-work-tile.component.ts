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
 * link per discipline. Two disciplines were a pair of ternaries; B1
 * Prospecting is the third skill the old note said would earn the table, so
 * TILE_BY_DISCIPLINE is it. `work.tile.xp` / `xpMax` / `ready` now take
 * {{skill}} / {{site}} / {{verb}} vars and the `…Foraging` twins they forced
 * are gone (skill authoring spec §11).
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
import { MERIDIAN_ORRERY_HREF } from './prospecting.model';
import { miningLevelView } from './mining-level';

type TileDiscipline = 'mining' | 'foraging' | 'prospecting';

interface TileCopy {
  /** The skill's display name — also the {{skill}} var in the XP lines. */
  labelKey: string;
  /** The site's display name — also the {{site}} var in the ready line. */
  locationKey: string;
  /** The player-facing verb — the {{verb}} var in the ready line. */
  verbKey: string;
  href: string;
  summaryKey: string;
  goKey: string;
}

/**
 * One row per live discipline. Anything not listed is not a live skill and
 * `discipline()` falls back to mining, exactly as the old ternary did.
 */
const TILE_BY_DISCIPLINE: Record<TileDiscipline, TileCopy> = {
  mining: {
    labelKey: 'work.discipline.mining',
    locationKey: 'work.location.seamworks',
    verbKey: 'work.verb.mining',
    href: BASALT_SEAMWORKS_HREF,
    summaryKey: 'work.tile.summary',
    goKey: 'work.tile.go',
  },
  foraging: {
    labelKey: 'work.discipline.foraging',
    locationKey: 'work.location.canopy',
    verbKey: 'work.verb.foraging',
    href: ROOTGLASS_CANOPY_HREF,
    summaryKey: 'work.tile.summaryForaging',
    goKey: 'work.tile.goCanopy',
  },
  prospecting: {
    labelKey: 'work.discipline.prospecting',
    locationKey: 'work.location.orrery',
    verbKey: 'work.verb.prospecting',
    href: MERIDIAN_ORRERY_HREF,
    summaryKey: 'work.tile.summaryProspecting',
    goKey: 'work.tile.goOrrery',
  },
};

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
        <p class="cwt__summary">{{ t(copy().summaryKey) }}</p>
        <a class="cwt__go" [routerLink]="goHref()">{{ t(copy().goKey) }}</a>
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

  /** Mining unless Current Work names another live discipline. */
  discipline(): TileDiscipline {
    const id = this.snap.currentWork?.disciplineId;
    return id && id in TILE_BY_DISCIPLINE ? id as TileDiscipline : 'mining';
  }

  copy(): TileCopy {
    return TILE_BY_DISCIPLINE[this.discipline()];
  }

  goHref(): string {
    return this.copy().href;
  }

  private view() {
    return miningLevelView(this.snap.progress.xpByDiscipline[this.discipline()] ?? 0);
  }

  closedLine(): string {
    const work = this.snap.currentWork;
    if (!work) return this.t('work.tile.empty');
    const copy = this.copy();
    const view = this.view();
    const next = view.next ?? view.xp;
    return this.t('work.tile.closed', {
      activity: this.t(copy.labelKey),
      location: this.t(copy.locationKey),
      level: view.level,
      xp: view.xp,
      next,
    });
  }

  xpLine(): string {
    const skill = this.t(this.copy().labelKey);
    const view = this.view();
    if (view.next == null) {
      return this.t('work.tile.xpMax', { skill, xp: view.xp, level: view.level });
    }
    return this.t('work.tile.xp', { skill, xp: view.xp, next: view.next, level: view.level });
  }

  recoveryLine(): string {
    const remain = this.activity.recoveryRemainingMs(Date.now());
    if (remain <= 0) {
      const copy = this.copy();
      return this.t('work.tile.ready', { verb: this.t(copy.verbKey), site: this.t(copy.locationKey) });
    }
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
    // any registered site is somewhere the tile can send you.
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
