/**
 * delve-mission-chip.component.ts — the tracker chip: one mission, one line.
 *
 * Shows the mission that most needs you: one ready to hand in first, then the
 * first open one-off, then the standing order. One plain next-step line and,
 * when it is ready, one Claim button. Nothing else — the Quest Board has the
 * full cards.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService } from '../../translation.service';
import { DelveMissionState, NpcQuestService } from './npc-quest.service';

/** The mission the chip tracks, or null when nothing is open. */
export function trackedMission(all: readonly DelveMissionState[]): DelveMissionState | null {
  const open = all.filter(m => !m.locked && !m.claimed);
  return open.find(m => m.turnInReady)
    ?? open.find(m => !m.mission.repeatable)
    ?? open[0]
    ?? null;
}

@Component({
  selector: 'app-delve-mission-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tracked(); as m) {
      <div class="dmc" [class.dmc--ready]="m.turnInReady" role="status">
        <span class="dmc__mark" aria-hidden="true"></span>
        <p class="dmc__text">
          <span class="dmc__label">{{ t('delve.chip.label') }}</span>
          <strong class="dmc__title">{{ m.mission.title }}</strong>
          <span class="dmc__step">{{ m.nextStep }}</span>
        </p>
        @if (m.turnInReady) {
          <button type="button" class="dmc__claim" (click)="claim(m.mission.id)">{{ t('delve.chip.claim') }}</button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .dmc {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px;
      border: 1px solid var(--gf-edge-strong, rgba(255,255,255,.12));
      border-radius: 999px;
      background: var(--gf-panel, rgba(10, 6, 26, 0.85));
      color: var(--gf-ink, #ddd7ee);
    }
    .dmc--ready { border-color: var(--gf-accent, #6affe0); }
    .dmc__mark {
      flex: 0 0 auto; width: 8px; height: 8px;
      transform: rotate(45deg);
      background: var(--gf-accent-text, #6affe0);
    }
    .dmc__text { margin: 0; flex: 1 1 auto; min-width: 0; font-size: .82rem; line-height: 1.35; }
    .dmc__label {
      display: block;
      font: 700 10px/1.2 'Orbitron', system-ui, sans-serif;
      letter-spacing: .12em; text-transform: uppercase;
      color: var(--gf-dim, #9d95b5);
    }
    .dmc__title { margin-right: 6px; }
    .dmc__step { color: var(--gf-dim, #9d95b5); }
    .dmc__claim {
      flex: 0 0 auto;
      min-height: 44px; padding: 0 16px;
      border: 1px solid var(--gf-accent, #6affe0);
      border-radius: 999px;
      background: transparent; color: var(--gf-accent-text, #6affe0);
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .1em; text-transform: uppercase; cursor: pointer;
    }
    .dmc__claim:focus-visible { outline: 2px solid var(--gf-accent-text, #6affe0); outline-offset: 2px; }
  `],
})
export class DelveMissionChipComponent implements OnInit {
  private readonly npc = inject(NpcQuestService);
  private readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tracked = signal<DelveMissionState | null>(null);

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.npc.init();
    this.npc.missions$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(all => this.tracked.set(trackedMission(all)));
  }

  t(key: string): string { return this.i18n.translate(key); }

  claim(id: string): void { this.npc.claimMission(id); }
}
