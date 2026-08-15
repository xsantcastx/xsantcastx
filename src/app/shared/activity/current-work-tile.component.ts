/**
 * current-work-tile.component.ts — global Current Work summary.
 *
 * Closed: activity · location · level · XP. Expand: recovery, Go to
 * Seamworks, work summary. No Inspect Current Work. No Mine control.
 */
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { BASALT_SEAMWORKS_HREF } from '../narrative/chapter.model';
import { ActivityProgressionGateway } from './activity-progression.gateway';
import {
  BASALT_SEAMWORKS_ID,
  MINING_RECOVERY_MS,
  type ActivityLedger,
} from './activity.model';
import { miningLevelView } from './mining-level';

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
        <p class="cwt__summary">{{ t('work.tile.summary') }}</p>
        <a class="cwt__go" [routerLink]="seamworksHref">{{ t('work.tile.go') }}</a>
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

  readonly seamworksHref = BASALT_SEAMWORKS_HREF;
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

  closedLine(): string {
    const work = this.snap.currentWork;
    if (!work) return this.t('work.tile.empty');
    const view = miningLevelView(this.snap.progress.xpByDiscipline.mining ?? 0);
    const next = view.next ?? view.xp;
    return this.t('work.tile.closed', {
      activity: this.t('work.discipline.mining'),
      location: this.t('work.location.seamworks'),
      level: view.level,
      xp: view.xp,
      next,
    });
  }

  xpLine(): string {
    const view = miningLevelView(this.snap.progress.xpByDiscipline.mining ?? 0);
    if (view.next == null) return this.t('work.tile.xpMax', { xp: view.xp, level: view.level });
    return this.t('work.tile.xp', { xp: view.xp, next: view.next, level: view.level });
  }

  recoveryLine(): string {
    const remain = this.activity.recoveryRemainingMs(Date.now());
    if (remain <= 0) return this.t('work.tile.ready');
    return this.t('work.tile.recovering', {
      seconds: (remain / 1000).toFixed(1),
      wait: (MINING_RECOVERY_MS / 1000).toFixed(1),
    });
  }

  state(): string {
    if (!this.snap.currentWork) return 'idle';
    if (this.activity.recoveryRemainingMs(this.now) > 0) return 'recovering';
    if (this.snap.currentWork.locationId !== BASALT_SEAMWORKS_ID) return 'away';
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
