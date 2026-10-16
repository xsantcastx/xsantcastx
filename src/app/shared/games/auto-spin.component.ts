/**
 * <app-auto-spin> — the Auto button and its sheet (games/autoplay.ts holds the rules).
 *
 * Idle: one "Auto" button. Tapped, a small sheet opens over the controls: the
 * stop rules (bonus, a big win, a Gold floor) and the counts — tapping a count
 * starts the run at once, so auto spin is two taps. Running: a big Stop button
 * that says how many are left (always on screen while it runs); paused (the
 * tab was hidden): Resume and Stop.
 *
 *   <app-auto-spin [running]="!!auto" [left]="auto?.left ?? 0" [paused]="auto?.paused ?? false"
 *                  [disabled]="busy && !auto" (begin)="startAuto($event)" (halt)="stopAuto('user')" (resume)="resumeAuto()" />
 */
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { AUTO_COUNTS, AUTO_FLOOR_SHARES, AUTO_WIN_STOPS, DEFAULT_STOPS, type AutoStops } from './autoplay';
import { GAMES_I18N } from './games.i18n';

export interface AutoBegin { count: number; stops: AutoStops }

@Component({
  selector: 'app-auto-spin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (running()) {
      <div class="as as--running">
        @if (paused()) {
          <button type="button" class="as__btn as__btn--go" (click)="resume.emit()">{{ t('games.auto.resume') }}</button>
        }
        <button type="button" class="as__btn as__btn--stop" data-auto="stop" (click)="halt.emit()">
          {{ left() === Infinity ? t('games.auto.stopEndless') : t('games.auto.stop', { n: left() }) }}
        </button>
      </div>
    } @else {
      <button type="button" class="as__btn" data-auto="open" [disabled]="disabled()" [attr.aria-expanded]="open()"
              (click)="open.set(!open())">{{ t('games.auto.label') }}</button>
      @if (open()) {
        <div class="as__sheet" role="dialog" [attr.aria-label]="t('games.auto.title')">
          <p class="as__head">{{ t('games.auto.title') }}
            <button type="button" class="as__x" [attr.aria-label]="t('games.auto.close')" (click)="open.set(false)">×</button></p>
          <div class="as__row">
            <button type="button" class="as__chip" data-stop="bonus" [class.is-on]="stops().bonus" [attr.aria-pressed]="stops().bonus"
                    (click)="set({ bonus: !stops().bonus })">{{ t('games.auto.onBonus') }}</button>
          </div>
          <div class="as__row" role="group" [attr.aria-label]="t('games.auto.onWin')">
            <span class="as__cap">{{ t('games.auto.onWin') }}</span>
            @for (x of winStops; track x) {
              <button type="button" class="as__chip" [class.is-on]="stops().winX === x" [attr.aria-pressed]="stops().winX === x"
                      (click)="set({ winX: x })">{{ x ? '×' + x : t('games.auto.off') }}</button>
            }
          </div>
          <div class="as__row" role="group" [attr.aria-label]="t('games.auto.floor')">
            <span class="as__cap">{{ t('games.auto.floor') }}</span>
            @for (f of floors; track f) {
              <button type="button" class="as__chip" [class.is-on]="stops().floorShare === f" [attr.aria-pressed]="stops().floorShare === f"
                      (click)="set({ floorShare: f })">{{ f ? (f * 100) + '%' : t('games.auto.off') }}</button>
            }
          </div>
          <div class="as__row as__row--counts" role="group" [attr.aria-label]="t('games.auto.counts')">
            @for (n of counts; track n) {
              <button type="button" class="as__count" [attr.data-count]="n === Infinity ? 'endless' : n" (click)="go(n)">
                {{ n === Infinity ? '∞' : '×' + n }}</button>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; position: relative; }
    .as--running { display: flex; gap: var(--space-1); }
    .as__btn {
      width: 100%;
      min-width: var(--tap-min);
      min-height: var(--tap-min);
      padding: 0 var(--space-3);
      border: 0;
      border-bottom: 2px solid var(--violet-deep);
      background: color-mix(in srgb, var(--obsidian-3) 70%, transparent);
      color: var(--violet-bright);
      font: inherit;
      font-size: var(--text-sm);
      letter-spacing: .06em;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
    }
    .as__btn:disabled { opacity: .4; cursor: default; }
    .as__btn:focus-visible, .as__chip:focus-visible, .as__count:focus-visible, .as__x:focus-visible { outline: 2px solid var(--gold-bright); outline-offset: 2px; }
    .as__btn--stop { background: var(--status-danger); color: var(--ink-0); border-bottom-color: var(--obsidian-0); font-size: var(--text-base); }
    .as__btn--go { background: var(--violet); color: var(--ink-0); }
    .as__sheet {
      position: absolute;
      right: 0;
      bottom: calc(100% + var(--space-1));
      z-index: 5;
      width: min(320px, 92vw);
      display: grid;
      gap: var(--space-1);
      padding: var(--space-2);
      background: color-mix(in srgb, var(--obsidian-0) 94%, transparent);
      box-shadow: 0 0 0 2px var(--obsidian-0), 0 8px 24px color-mix(in srgb, var(--obsidian-0) 70%, transparent);
    }
    .as__head { margin: 0; display: flex; align-items: center; justify-content: space-between; color: var(--gold); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: .08em; }
    .as__x { min-width: var(--tap-min); min-height: var(--tap-min); border: 0; background: transparent; color: var(--ink-1); font: inherit; font-size: var(--text-lg); cursor: pointer; }
    .as__row { display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; }
    .as__cap { flex: 1 0 100%; color: var(--ink-2); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: .08em; }
    .as__chip, .as__count {
      min-width: var(--tap-min);
      min-height: var(--tap-min);
      padding: 0 var(--space-2);
      border: 0;
      background: var(--obsidian-2);
      color: var(--ink-1);
      font: inherit;
      font-size: var(--text-sm);
      cursor: pointer;
    }
    .as__chip.is-on { background: var(--violet-deep); color: var(--ink-0); }
    .as__row--counts { padding-top: var(--space-1); }
    .as__count { flex: 1; background: var(--gold-deep); color: var(--ink-0); font-variant-numeric: tabular-nums; }
  `],
})
export class AutoSpinComponent {
  private readonly i18n = inject(TranslationService);
  protected readonly Infinity = Infinity;

  readonly running = input(false);
  readonly left = input(0);
  readonly paused = input(false);
  readonly disabled = input(false);
  readonly begin = output<AutoBegin>();
  readonly halt = output<void>();
  readonly resume = output<void>();

  readonly counts = AUTO_COUNTS;
  readonly winStops = AUTO_WIN_STOPS;
  readonly floors = AUTO_FLOOR_SHARES;
  readonly open = signal(false);
  readonly stops = signal<AutoStops>({ ...DEFAULT_STOPS });

  constructor() { this.i18n.register(GAMES_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  set(patch: Partial<AutoStops>): void { this.stops.set({ ...this.stops(), ...patch }); }

  go(count: number): void {
    this.open.set(false);
    this.begin.emit({ count, stops: { ...this.stops() } });
  }
}
