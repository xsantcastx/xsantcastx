/**
 * <app-rune-ritual> — socketing a rune as a small ritual.
 *
 *   <app-rune-ritual [runeName]="rune.name" [runeArt]="card" [itemName]="item.name" [itemArt]="art"
 *                    (done)="onRitual($event)" (cancel)="closeRitual()" />
 *
 * Two beats, one sentence each:
 *   1. PLACE — drag the rune onto the glowing circle (or just tap it).
 *   2. PULSE — a ring of light shrinks toward the gold socket ring; tap the
 *      circle as they meet. A hit emits `done(quality 0..1)`. A miss says
 *      "almost", widens the window a little and runs the pulse again.
 *
 * The ritual spends nothing and writes nothing: the table calls the gateway
 * only after `done`, so a miss can never cost a rune, Gold or the item.
 *
 * Reduced motion: no drag, no pulse — one "Set the rune" button that emits
 * RITUAL_CONFIRM_QUALITY.
 *
 * Perf: the pulse runs in requestAnimationFrame outside the Angular zone and
 * writes one CSS custom property; a press reads the clock, not the frame.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslationService } from '../../translation.service';
import type { StationArt } from '../station-ui';
import { MINIGAMES_I18N } from './minigames.i18n';
import { RITUAL_CONFIRM_QUALITY, gradePulse, pulseAt } from './ritual.model';

type Phase = 'place' | 'pulse' | 'hit' | 'confirm';

const HIT_HOLD_MS = 900;
/** Pointer travel under this is a tap, not a drag. */
const TAP_SLOP_PX = 8;

@Component({
  selector: 'app-rune-ritual',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./minigames.css'],
  template: `
    <section class="mg mg--ritual" [attr.data-phase]="phase()" [attr.aria-label]="t('minigame.ritual.title')">
      <p class="mg__how" aria-live="polite">
        @switch (phase()) {
          @case ('place') { {{ t('minigame.ritual.place') }} }
          @case ('pulse') { {{ missed() ? t('minigame.ritual.miss') : t('minigame.ritual.pulse') }} }
          @case ('hit') { {{ t('minigame.ritual.hit') }} }
          @default { {{ t('minigame.ritual.confirm') }} }
        }
      </p>

      <div class="mg-stage">
        <button #circle type="button" class="mg-circle"
                [class.is-armed]="phase() === 'pulse'"
                [attr.aria-label]="phase() === 'pulse' ? t('minigame.ritual.circle') : t('minigame.ritual.rune', { name: runeName() })"
                [attr.aria-disabled]="phase() === 'pulse' || phase() === 'place' ? null : 'true'"
                (pointerdown)="tapCircle($event)" (keydown)="keyCircle($event)" (click)="clickCircle($event)">
          <span class="mg-circle__glyphs" aria-hidden="true"></span>
          <span class="mg-circle__socket" aria-hidden="true"></span>
          @if (phase() === 'pulse') { <span #pulse class="mg-circle__pulse" aria-hidden="true"></span> }
          @if (itemArt(); as a) {
            <img class="mg-circle__item" [src]="a.src" [attr.srcset]="a.srcset ?? null" sizes="72px" alt="" width="72" height="72" decoding="async">
          }
          @if (phase() !== 'place' && phase() !== 'confirm') {
            @if (runeArt(); as r) {
              <img class="mg-circle__rune" [src]="r.src" [attr.srcset]="r.srcset ?? null" sizes="56px" alt="" width="56" height="56" decoding="async">
            }
          }
          @if (phase() === 'hit') { <span class="mg-circle__burst" aria-hidden="true"></span> }
        </button>

        @if (phase() === 'place') {
          <button #token type="button" class="mg-token"
                  [attr.aria-label]="t('minigame.ritual.rune', { name: runeName() })"
                  (pointerdown)="grab($event)" (pointermove)="drag($event)"
                  (pointerup)="drop($event)" (pointercancel)="snapBack()" (click)="clickToken($event)">
            @if (runeArt(); as r) {
              <img [src]="r.src" [attr.srcset]="r.srcset ?? null" sizes="56px" alt="" width="56" height="56" decoding="async">
            }
            <span class="mg-token__name">{{ runeName() }}</span>
          </button>
        }
      </div>

      @if (phase() === 'confirm') {
        <button type="button" class="mg__go" (click)="confirm()">{{ t('minigame.ritual.setBtn') }}</button>
      }
      @if (phase() !== 'hit') {
        <button type="button" class="mg__skip" (click)="cancel.emit()">{{ t('minigame.ritual.cancel') }}</button>
      }
    </section>
  `,
})
export class RuneRitualComponent implements OnDestroy {
  readonly runeName = input<string>('');
  readonly runeArt = input<StationArt | null>(null);
  readonly itemName = input<string>('');
  readonly itemArt = input<StationArt | null>(null);
  /** Quality 0..1 of a successful ritual. Never emitted on a miss. */
  readonly done = output<number>();
  readonly cancel = output<void>();

  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly circle = viewChild<ElementRef<HTMLButtonElement>>('circle');
  private readonly pulse = viewChild<ElementRef<HTMLElement>>('pulse');
  private readonly token = viewChild<ElementRef<HTMLButtonElement>>('token');

  readonly phase = signal<Phase>('place');
  readonly missed = signal(false);
  private misses = 0;
  private started = 0;
  private raf = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private dragFrom: { x: number; y: number; id: number } | null = null;
  private dragged = false;

  constructor() {
    this.i18n.register(MINIGAMES_I18N);
    const reduced = this.isBrowser && typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) this.phase.set('confirm');
    afterNextRender(() => {
      const first = this.phase() === 'place' ? this.token()?.nativeElement : null;
      first?.focus({ preventScroll: true });
    });
  }

  ngOnDestroy(): void {
    this.stopPulse();
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  // ── Beat 1: place ──────────────────────────────────────────────────────────

  grab(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.dragFrom = { x: event.clientX, y: event.clientY, id: event.pointerId };
    this.dragged = false;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  drag(event: PointerEvent): void {
    const from = this.dragFrom;
    if (!from || from.id !== event.pointerId) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!this.dragged && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
    this.dragged = true;
    const el = this.token()?.nativeElement;
    if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  drop(event: PointerEvent): void {
    const from = this.dragFrom;
    this.dragFrom = null;
    if (!from || from.id !== event.pointerId) return;
    if (!this.dragged) { this.place(); return; }
    const rect = this.circle()?.nativeElement.getBoundingClientRect();
    const inside = !!rect && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside) this.place();
    else this.snapBack();
  }

  snapBack(): void {
    this.dragFrom = null;
    const el = this.token()?.nativeElement;
    if (el) el.style.transform = '';
  }

  /** Keyboard / assistive tech: a click with no pointer travel places the rune. */
  clickToken(event: MouseEvent): void {
    if (event.detail === 0 && this.phase() === 'place') this.place();
  }

  private place(): void {
    if (this.phase() !== 'place') return;
    this.phase.set('pulse');
    this.startPulse();
    // The circle is the next target; move focus so Enter / Space works straight away.
    this.timers.push(setTimeout(() => this.circle()?.nativeElement.focus({ preventScroll: true }), 0));
  }

  // ── Beat 2: pulse ──────────────────────────────────────────────────────────

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private startPulse(): void {
    if (!this.isBrowser) return;
    this.started = this.now();
    if (this.raf) return;
    this.zone.runOutsideAngular(() => {
      const frame = () => {
        const el = this.pulse()?.nativeElement;
        if (el) el.style.setProperty('--s', pulseAt(this.now() - this.started).toFixed(4));
        this.raf = this.phase() === 'pulse' ? requestAnimationFrame(frame) : 0;
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  private stopPulse(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Tapping the circle itself also places the rune — the biggest target wins. */
  tapCircle(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.activateCircle(event);
  }

  keyCircle(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.repeat) { event.preventDefault(); return; }
    this.activateCircle(event);
  }

  clickCircle(event: MouseEvent): void {
    if (event.detail === 0) this.activateCircle(event);
  }

  private activateCircle(event: Event): void {
    const phase = this.phase();
    if (phase === 'place') { event.preventDefault(); this.place(); return; }
    if (phase !== 'pulse') return;
    event.preventDefault();
    this.attempt();
  }

  private attempt(): void {
    const scale = pulseAt(this.now() - this.started);
    const graded = gradePulse(scale, this.misses);
    if (!graded.hit) {
      this.misses += 1;
      this.missed.set(true);
      // Start the sweep again from the rim so the next try is a full one.
      this.started = this.now();
      return;
    }
    this.phase.set('hit');
    this.stopPulse();
    const q = graded.quality;
    this.timers.push(setTimeout(() => this.done.emit(q), HIT_HOLD_MS));
  }

  confirm(): void {
    if (this.phase() !== 'confirm') return;
    this.phase.set('hit');
    this.done.emit(RITUAL_CONFIRM_QUALITY);
  }
}
