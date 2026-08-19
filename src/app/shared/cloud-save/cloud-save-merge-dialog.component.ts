/**
 * cloud-save-merge-dialog.component.ts — what signing in just brought down.
 *
 * This used to be a modal that parked the sign-in until the visitor chose
 * between three saves. It asked far too often — the test behind it counted a
 * device holding Gold it had not spent yet as "progress the cloud has never
 * seen", which is true of any second device, permanently — and two of its three
 * answers deleted whichever items the other side was holding.
 *
 * Signing in reconciles on its own now. This is what is left: a notice, after
 * the fact, that says what arrived, with an undo behind it. It never blocks
 * play, Escape dismisses it, and the undo is real — the gateway keeps this
 * device's save exactly as it stood before the merge.
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
import { MergeConflict } from './cloud-save.model';
import { OverlayStackService } from '../overlay/overlay-stack.service';

@Component({
  selector: 'app-cloud-save-merge-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (merged) {
      <div class="csm" role="status" aria-live="polite">
        <div class="csm__panel">
          <p class="csm__eyebrow"><span class="csm__pulse"></span> Cloud save</p>
          <h2 class="csm__title" id="csm-title">Your saves were combined</h2>
          <p class="csm__lede">
            This device and your cloud save were reconciled — the further of
            each was kept, and nothing was thrown away.
          </p>

          <div class="csm__acts">
            <button type="button" class="csm__btn csm__btn--primary" (click)="dismiss()">
              Good
              <span class="csm__hint">carry on playing</span>
            </button>
            <button type="button" class="csm__btn" (click)="undo()" [disabled]="undoing">
              Use only this device's save
              <span class="csm__hint">puts it back the way it was before signing in</span>
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
    /* A notice, not a veil. It must never sit over the game or eat a click:
       the layer is inert and only the panel itself is interactive.

       Bottom-LEFT on purpose. The achievement toast, the Forge Flame and the
       cookie banner all pin bottom-right, and that corner has already had one
       widget silently eating another's clicks for two releases. */
    .csm {
      position: fixed;
      left: 0;
      bottom: 0;
      z-index: var(--z-toast, 60);
      padding: 16px;
      max-width: min(420px, 100vw);
      pointer-events: none;
      animation: csmFade .25s ease both;
    }
    .csm > * { pointer-events: auto; }

    .csm__panel {
      width: 100%;
      max-height: 70dvh;
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

  merged: MergeConflict | null = null;
  undoing = false;

  ngOnInit(): void {
    this.sub = this.cloud.merged$.subscribe(m => {
      this.merged = m;
      if (m) {
        // Registered with the overlay stack so Escape dismisses it like every
        // other layer — but dismissing is all Escape does, because there is
        // nothing waiting on an answer.
        this.overlayUnreg ??= this.overlays.push('cloud-save-merged', () => this.dismiss());
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

  dismiss(): void {
    this.cloud.dismissMerged();
  }

  async undo(): Promise<void> {
    this.undoing = true;
    this.cdr.markForCheck();
    try {
      await this.cloud.undoMerge();
    } finally {
      this.undoing = false;
      this.cdr.markForCheck();
    }
  }
}
