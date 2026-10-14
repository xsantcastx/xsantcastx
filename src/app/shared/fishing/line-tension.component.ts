/**
 * <app-line-tension> — the Fishing reel ("Line Tension", fishing-reel.ts).
 *
 *   <app-line-tension [seed]="cast.seed" [rarity]="cast.rarity" [widen]="perks" (done)="landed($event)" />
 *
 * One horizontal bar. Hold (the bar, the Hold button, Space or E) to lift the
 * catch window; let go and it falls. The fish drifts; time it spends inside
 * the window fills the ring. Once hooked a fish is always landed: `done`
 * fires with the grade, and the grade only adds (the anvil's contract).
 *
 * The mini-game kit's rules: the loop runs in requestAnimationFrame OUTSIDE
 * the Angular zone and writes CSS custom properties on the host, so 60 fps
 * never runs change detection; presses are pointerdown/up; no fixed overlay
 * (the play view positions it in its HUD band). Reduced motion: one "Reel it
 * in" button and the still quality (the Off grade). It writes nothing: the
 * play view lands the catch.
 */
import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, NgZone, OnDestroy, PLATFORM_ID,
  afterNextRender, inject, input, output, signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../../translation.service';
import { FISHING_I18N } from './fishing.i18n';
import { reelResult, reelRing, reelStart, reelStep, REEL_STILL_QUALITY, type ReelState } from './fishing-reel';
import { gradeFor, type CatchRarity, type ReelGrade } from './fishing.model';

/** How long the grade shows before `done` fires. */
const RESULT_HOLD_MS = 700;

@Component({
  selector: 'app-line-tension',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lt" [attr.aria-label]="t('play.fish.ui.title')" data-engine-ignore>
      <p class="lt__how">{{ reduced ? t('play.fish.ui.always') : t('play.fish.ui.how') }}</p>
      @if (!reduced) {
        <div class="lt__bar" role="img" [attr.aria-label]="t('play.fish.ui.title')"
             (pointerdown)="hold($event, true)" (pointerup)="hold($event, false)" (pointercancel)="hold($event, false)" (lostpointercapture)="hold($event, false)">
          <span class="lt__window"></span>
          <span class="lt__fish" aria-hidden="true"></span>
          <span class="lt__ring" aria-hidden="true"></span>
        </div>
      }
      <p class="lt__grade" aria-live="polite" [attr.data-grade]="grade()">
        @if (grade(); as g) { {{ t('play.fish.ui.grade.' + g) }} } @else { {{ t('play.fish.ui.always') }} }
      </p>
      @if (reduced) {
        <button type="button" class="lt__go" (click)="still()" [attr.aria-disabled]="grade() ? 'true' : null">{{ t('play.fish.ui.reel') }}</button>
      } @else {
        <button type="button" class="lt__go" [attr.aria-pressed]="holding"
                (pointerdown)="hold($event, true)" (pointerup)="hold($event, false)" (pointercancel)="hold($event, false)" (lostpointercapture)="hold($event, false)">
          {{ t('play.fish.ui.holdBtn') }} <kbd>Space</kbd>
        </button>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .lt {
      display: grid; gap: var(--space-2); padding: var(--space-3);
      border: 1px solid var(--edge-gold); border-radius: var(--radius-lg);
      background: var(--veil-panel); box-shadow: var(--shadow-inset);
    }
    .lt__how, .lt__grade { margin: 0; text-align: center; font: var(--weight-semibold) var(--text-sm)/1.3 var(--font-ui); color: var(--text-heading); }
    .lt__grade { min-height: 1.3em; color: var(--text-body); }
    .lt__grade[data-grade='perfect'] { color: var(--gold-bright); }
    .lt__grade[data-grade='good'] { color: var(--status-good); }
    .lt__bar {
      position: relative; container-type: inline-size; height: 44px;
      border-radius: var(--radius-pill); border: 1px solid var(--edge-raised);
      background: linear-gradient(90deg, var(--obsidian-2), var(--surface-well) 50%, var(--obsidian-2));
      touch-action: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .lt__window {
      position: absolute; top: 3px; bottom: 3px; left: 0;
      width: calc(var(--lt-w, .28) * 100cqw);
      transform: translateX(calc((var(--lt-win, .5) - var(--lt-w, .28) / 2) * 100cqw));
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--gold) 34%, transparent);
      box-shadow: 0 0 10px var(--gold-bright);
      will-change: transform; pointer-events: none;
    }
    .lt__fish {
      position: absolute; top: 50%; left: 0; width: 18px; height: 12px; margin: -6px 0 0 -9px;
      border-radius: 50% 40% 40% 50%; background: var(--text-heading); box-shadow: 0 0 8px var(--gold-bright);
      transform: translateX(calc(var(--lt-fish, .5) * 100cqw));
      will-change: transform; pointer-events: none;
    }
    .lt__ring {
      position: absolute; right: -6px; top: -6px; width: 22px; height: 22px; border-radius: 50%;
      background: conic-gradient(var(--gold-bright) calc(var(--lt-ring, 0) * 360deg), var(--surface-well) 0);
      border: 2px solid var(--edge-raised); pointer-events: none;
    }
    .lt__go {
      min-height: 48px; border: 1px solid var(--edge-gold); border-radius: var(--radius-lg); cursor: pointer;
      color: var(--text-on-accent); background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 45%, var(--gold-core) 100%);
      font: var(--weight-black) var(--text-md)/1 var(--font-ui); text-transform: uppercase; letter-spacing: var(--tracking-nav);
      touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .lt__go[aria-pressed='true'] { filter: brightness(1.15); }
    .lt__go:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
    .lt__go kbd { font-size: var(--text-xs); opacity: .7; }
  `],
})
export class LineTensionComponent implements OnDestroy {
  /** Fixes the fish's path (the cast's id hashed by the host). */
  readonly seed = input<number>(1);
  readonly rarity = input<CatchRarity>('common');
  /** The window's widening: the skill's perk plus the Lodge Reel (shares of the bar). */
  readonly widen = input<number>(0);
  readonly done = output<{ grade: ReelGrade; inside: number }>();

  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly reduced: boolean;
  readonly grade = signal<ReelGrade | null>(null);
  holding = false;
  private state: ReelState | null = null;
  private raf = 0;
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.i18n.register(FISHING_I18N);
    this.reduced = this.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    afterNextRender(() => {
      this.host.nativeElement.querySelector('.lt__go')?.focus({ preventScroll: true });
      if (!this.reduced) this.start();
    });
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.timer) clearTimeout(this.timer);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  hold(event: PointerEvent, down: boolean): void {
    if (down && event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    if (down) (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.holding = down;
  }

  @HostListener('window:keydown', ['$event'])
  keyDown(event: KeyboardEvent): void {
    if (event.code !== 'Space' && event.code !== 'KeyE') return;
    event.preventDefault();
    if (this.reduced) { if (!event.repeat) this.still(); return; }
    this.holding = true;
  }
  @HostListener('window:keyup', ['$event'])
  keyUp(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.code === 'KeyE') this.holding = false;
  }

  /** Reduced motion: one press lands it at the still quality (the Off grade). */
  still(): void {
    if (this.grade()) return;
    this.finish(gradeFor(REEL_STILL_QUALITY), REEL_STILL_QUALITY);
  }

  private start(): void {
    if (!this.isBrowser) return;
    this.state = reelStart(this.seed(), this.rarity(), this.widen());
    const el = this.host.nativeElement as HTMLElement;
    el.style.setProperty('--lt-w', this.state.width.toFixed(3));
    this.zone.runOutsideAngular(() => {
      const frame = (now: number) => {
        const s = this.state!;
        const dt = this.last ? Math.min(.05, (now - this.last) / 1000) : 0;
        this.last = now;
        const over = reelStep(s, dt, this.holding, this.rarity());
        el.style.setProperty('--lt-win', s.window.toFixed(4));
        el.style.setProperty('--lt-fish', s.fish.toFixed(4));
        el.style.setProperty('--lt-ring', reelRing(s).toFixed(3));
        if (over) {
          this.raf = 0;
          const result = reelResult(s);
          this.zone.run(() => this.finish(result.grade, result.inside));
          return;
        }
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  private finish(grade: ReelGrade, inside: number): void {
    this.grade.set(grade);
    this.timer = setTimeout(() => this.done.emit({ grade, inside }), RESULT_HOLD_MS);
  }
}
