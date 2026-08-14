/**
 * cloud-save-merge-dialog.component.ts — which save wins.
 *
 * Opens only when signing in finds two saves that each hold something the other
 * does not. That is a narrow case on purpose: a cloud save simply ahead of this
 * browser needs no dialog, because all three buttons would do the same thing.
 *
 * The bind is genuinely parked while this is open — `CloudSaveService` is
 * awaiting the answer — so there is deliberately no way to dismiss it without
 * choosing. An X in the corner would have to mean something, and every meaning
 * available ("merge anyway", "stay signed out") is worse than asking the
 * question properly. Escape picks Merge Best, which is the option that cannot
 * cost anybody anything.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CloudSaveService } from './cloud-save.service';
import { MergeConflict, MergeStrategy, SaveSummary } from './cloud-save.model';
import { OverlayStackService } from '../overlay/overlay-stack.service';

@Component({
  selector: 'app-cloud-save-merge-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (conflict) {
      <div class="csm" role="dialog" aria-modal="true" aria-labelledby="csm-title">
        <div class="csm__panel">
          <p class="csm__eyebrow"><span class="csm__pulse"></span> Two Forges</p>
          <h2 class="csm__title" id="csm-title">This device and the cloud disagree</h2>
          <p class="csm__lede">
            Both saves hold something the other does not. Choose which one the
            Forge carries forward.
          </p>

          <div class="csm__cols">
            <div class="csm__col">
              <h3 class="csm__col-head">This Device</h3>
              <dl class="csm__stats">
                <div><dt>Level</dt><dd [class.csm__win]="wins(local.level, cloudStats.level)">{{ local.level }}</dd></div>
                <div><dt>XP</dt><dd [class.csm__win]="wins(local.xp, cloudStats.xp)">{{ local.xp | number }}</dd></div>
                <div><dt>Gold</dt><dd [class.csm__win]="wins(local.gold, cloudStats.gold)">{{ local.gold | number }}</dd></div>
                <div><dt>Achievements</dt><dd [class.csm__win]="wins(local.achievements, cloudStats.achievements)">{{ local.achievements }}</dd></div>
              </dl>
            </div>

            <div class="csm__col">
              <h3 class="csm__col-head">Cloud</h3>
              <dl class="csm__stats">
                <div><dt>Level</dt><dd [class.csm__win]="wins(cloudStats.level, local.level)">{{ cloudStats.level }}</dd></div>
                <div><dt>XP</dt><dd [class.csm__win]="wins(cloudStats.xp, local.xp)">{{ cloudStats.xp | number }}</dd></div>
                <div><dt>Gold</dt><dd [class.csm__win]="wins(cloudStats.gold, local.gold)">{{ cloudStats.gold | number }}</dd></div>
                <div><dt>Achievements</dt><dd [class.csm__win]="wins(cloudStats.achievements, local.achievements)">{{ cloudStats.achievements }}</dd></div>
              </dl>
            </div>
          </div>

          <div class="csm__acts">
            <button type="button" class="csm__btn csm__btn--primary" (click)="choose('merge')">
              Merge Best
              <span class="csm__hint">keeps the higher of each, loses nothing</span>
            </button>
            <button type="button" class="csm__btn" (click)="choose('local')">
              Keep This Device
              <span class="csm__hint">overwrites the cloud save</span>
            </button>
            <button type="button" class="csm__btn" (click)="choose('cloud')">
              Load Cloud
              <span class="csm__hint">replaces what is on this device</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Fixed to the viewport, and rendered from the header — which is outside the
       routed host, so no route transform can trap it. See the note in
       cloud-save-button.component.ts about where this is mounted. */
    .csm {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 20px;
      background:
        radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0, 255, 204, 0.08), transparent 70%),
        radial-gradient(ellipse 70% 50% at 50% 100%, rgba(139, 92, 246, 0.1), transparent 70%),
        rgba(4, 2, 12, 0.86);
      animation: csmFade .25s ease both;
    }

    .csm__panel {
      width: min(560px, 100%);
      max-height: 88dvh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid rgba(139, 92, 246, 0.28);
      background:
        radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0, 255, 204, 0.06), transparent 65%),
        radial-gradient(ellipse 70% 60% at 90% 100%, rgba(139, 92, 246, 0.08), transparent 65%),
        rgba(10, 6, 26, 0.94);
      box-shadow: 0 24px 70px -20px rgba(0, 0, 0, 0.8);
      animation: csmRise .3s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .csm__eyebrow {
      display: flex; align-items: center; gap: 7px;
      margin: 0 0 8px;
      font: 600 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .12em; text-transform: uppercase; color: #4dffe0;
    }
    .csm__pulse {
      width: 6px; height: 6px; border-radius: 50%;
      background: #4dffe0; box-shadow: 0 0 10px rgba(0, 255, 204, 0.8);
      animation: csmPulse 3s ease-in-out infinite;
    }

    .csm__title {
      margin: 0 0 8px;
      font: 700 clamp(18px, 4vw, 22px)/1.25 'Orbitron', system-ui, sans-serif;
      color: #F2ECFF;
    }

    .csm__lede {
      margin: 0 0 20px;
      font-size: 14px; line-height: 1.55; color: #9fb4ae;
    }

    .csm__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .csm__col {
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      background: rgba(255, 255, 255, 0.02);
      min-width: 0;
    }

    .csm__col-head {
      margin: 0 0 10px;
      font: 600 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .06em; color: #A78BFA;
    }

    .csm__stats { margin: 0; display: grid; gap: 8px; }
    .csm__stats > div {
      display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    }
    .csm__stats dt { font-size: 12px; color: #7d918c; }
    .csm__stats dd {
      margin: 0;
      font: 700 14px/1 'Orbitron', system-ui, sans-serif;
      color: #cfe9e2;
    }
    /* The larger of the pair, so the difference is visible without arithmetic. */
    .csm__win { color: #4dffe0; text-shadow: 0 0 12px rgba(0, 255, 204, 0.45); }

    .csm__acts { display: grid; gap: 8px; }

    .csm__btn {
      display: flex; flex-direction: column; gap: 3px;
      width: 100%; min-height: 52px; padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: #cfe9e2; cursor: pointer; text-align: left;
      font: 600 13px/1.2 'Orbitron', system-ui, sans-serif; letter-spacing: .03em;
      transition: border-color .25s ease, color .25s ease, box-shadow .25s ease;
    }
    .csm__btn:hover { color: #F2ECFF; border-color: rgba(255, 255, 255, 0.3); }

    .csm__btn--primary {
      border-color: rgba(0, 255, 204, 0.35);
      background: rgba(0, 255, 204, 0.05);
      color: #4dffe0;
    }
    .csm__btn--primary:hover {
      border-color: rgba(0, 255, 204, 0.7);
      box-shadow: 0 0 28px -8px rgba(0, 255, 204, 0.6);
    }

    .csm__hint {
      font: 400 11px/1.4 system-ui, sans-serif;
      letter-spacing: 0; color: #7d918c;
    }

    @keyframes csmFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes csmRise {
      from { opacity: 0; transform: translateY(14px) scale(.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes csmPulse { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }

    @media (max-width: 480px) {
      .csm__cols { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      .csm, .csm__panel { animation: none; }
      .csm__pulse { animation: none; opacity: 1; }
    }
  `],
})
export class CloudSaveMergeDialogComponent implements OnInit, OnDestroy {
  private readonly cloud = inject(CloudSaveService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly overlays = inject(OverlayStackService);
  private sub?: Subscription;
  private overlayUnreg?: () => void;

  conflict: MergeConflict | null = null;

  get local(): SaveSummary { return this.conflict!.local; }
  /** Named `cloudStats`, not `cloud`: that name is the service on this class. */
  get cloudStats(): SaveSummary { return this.conflict!.cloud; }

  ngOnInit(): void {
    this.sub = this.cloud.conflict$.subscribe(c => {
      this.conflict = c;
      if (c) {
        if (!this.overlayUnreg) {
          this.overlayUnreg = this.overlays.push('cloud-save-merge', () => {
            if (this.conflict) this.choose('merge');
          });
        }
      } else {
        this.overlayUnreg?.();
        this.overlayUnreg = undefined;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.overlayUnreg?.();
    this.overlayUnreg = undefined;
  }

  choose(strategy: MergeStrategy): void {
    this.cloud.resolveConflict(strategy);
  }

  /** True when `a` is the larger of the pair, for the highlight. */
  wins(a: number, b: number): boolean {
    return a > b;
  }
}
