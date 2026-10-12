/**
 * <app-anvil-game> — the Smithing anvil mini-game.
 *
 *   <app-anvil-game [itemName]="recipe.name" [rarity]="recipe.rarity"
 *                   (done)="onAnvil($event)" />
 *
 * A spark sweeps a heat bar; the player presses Strike ANVIL_STRIKES times.
 * Each press is graded Perfect / Good / Off (anvil.model), with sparks, a ring
 * and a small nudge of the panel. When the last strike lands it shows the
 * quality for a beat and emits `done(quality 0..1)`. "Skip the game" emits
 * `done(null)` — the caller then crafts exactly as it did before the game.
 *
 * The game only reports a number. It spends nothing and writes nothing; the
 * bench calls the crafting gateway afterwards, so walking away mid-game costs
 * nothing.
 *
 * Perf: the sweep runs in requestAnimationFrame OUTSIDE the Angular zone and
 * writes one CSS custom property on the marker, so a 60 fps loop never runs
 * change detection. Timing is read from the clock at the moment of the press,
 * not from the last painted frame.
 *
 * Input: pointerdown (not click — a click lands on pointer-up, up to ~100 ms
 * late, which is a tenth of the bar) on the button or the bar; Enter / Space
 * on the focused button; a synthetic click (detail 0, assistive tech) too.
 *
 * Reduced motion: no shake, no flying sparks, and a slower sweep. The marker
 * still moves — it is the game — and Skip is always one press away.
 *
 * `tier` (1..4) is the player's home anvil tier, passed ONLY by a bench opened
 * from the Homestead (HOME_FORGE). Tier 1, the default, is today's game
 * exactly: ANVIL_ZONES, ANVIL_STRIKES, every strike counted. Higher tiers widen
 * the Perfect zone and add a spare strike (home-forge.model); quality stays in
 * [0, 1], so the roll bias and its ceiling proof are unchanged.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslationService } from '../../translation.service';
import {
  anvilPeriod,
  anvilVerdict,
  gradeStrike,
  markerAt,
  type StrikeGrade,
} from './anvil.model';
import { MINIGAMES_I18N } from './minigames.i18n';
import { HOME_FORGE_I18N } from './home-forge.i18n';
import { anvilTierRules, homeAnvilQuality, tierNumeral } from './home-forge.model';

/** How long the result line shows before `done` fires. */
const RESULT_HOLD_MS = 1100;
/** Sparks per strike, by grade. */
const SPARKS: Readonly<Record<StrikeGrade, number>> = { perfect: 10, good: 6, off: 2 };

@Component({
  selector: 'app-anvil-game',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./minigames.css'],
  template: `
    <section class="mg mg--anvil" [attr.data-rarity]="rarity()"
             [class.is-nudge-a]="nudge() % 2 === 1" [class.is-nudge-b]="nudge() > 0 && nudge() % 2 === 0"
             [attr.aria-label]="t('minigame.anvil.title')">
      <p class="mg__how">{{ t('minigame.anvil.how') }}</p>
      @if (tier() > 1) {
        <p class="mg__home">{{ t('homeForge.anvil.inGame', { tier: numeral() }) }}{{ spare() ? ' ' + t('homeForge.anvil.spareNote') : '' }}</p>
      }

      <div class="mg-bar" role="img" [attr.aria-label]="t('minigame.anvil.bar')" (pointerdown)="press($event)">
        <span class="mg-bar__good" [style.--w]="zones().good"></span>
        <span class="mg-bar__perfect" [style.--w]="zones().perfect"></span>
        <span #marker class="mg-bar__marker"></span>
        @for (f of flash(); track f.seq) {
          <span class="mg-bar__ring" [attr.data-grade]="f.grade" [style.--at]="f.pos">
            @for (s of f.sparks; track s) {
              <span class="mg-spark" [style.--a]="s"></span>
            }
          </span>
        }
      </div>

      <ol class="mg-pips" [attr.aria-label]="t('minigame.anvil.count', { n: grades().length, total: total() })">
        @for (i of slots(); track i) {
          <li class="mg-pip" [attr.data-grade]="grades()[i]"></li>
        }
      </ol>

      <p class="mg__grade" aria-live="polite" [attr.data-grade]="lastGrade()">
        @if (result() !== null) {
          {{ t('minigame.anvil.result', { q: resultPct(), verdict: t('minigame.anvil.' + verdict()) }) }}
        } @else if (lastGrade(); as g) {
          {{ t('minigame.grade.' + g) }}
        } @else {
          {{ t('minigame.anvil.count', { n: 1, total: total() }) }}
        }
      </p>

      <button #strikeBtn type="button" class="mg__go"
              [attr.aria-disabled]="result() !== null ? 'true' : null"
              (pointerdown)="press($event)" (keydown)="onKey($event)" (click)="onClick($event)">
        {{ t('minigame.anvil.strike') }}
      </button>
      <button type="button" class="mg__skip" (click)="skip()">{{ t('minigame.anvil.skip') }}</button>
    </section>
  `,
})
export class AnvilGameComponent implements OnDestroy {
  readonly itemName = input<string>('');
  readonly rarity = input<string | null>(null);
  /** Home anvil tier (1..4). Only the Homestead's bench passes it; 1 is today's game. */
  readonly tier = input<number>(1);
  /** Quality 0..1, or null when the player skipped the game. */
  readonly done = output<number | null>();

  private readonly i18n = inject(TranslationService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly marker = viewChild<ElementRef<HTMLElement>>('marker');
  private readonly strikeBtn = viewChild<ElementRef<HTMLButtonElement>>('strikeBtn');

  private readonly rules = computed(() => anvilTierRules(this.tier()));
  readonly total = computed(() => this.rules().strikes);
  readonly slots = computed(() => Array.from({ length: this.rules().strikes }, (_, i) => i));
  readonly zones = computed(() => this.rules().zones);
  readonly numeral = computed(() => tierNumeral(this.tier()));
  /** A spare strike: more strikes than count, so the worst one is dropped. */
  readonly spare = computed(() => this.rules().counted < this.rules().strikes);

  readonly grades = signal<StrikeGrade[]>([]);
  readonly lastGrade = signal<StrikeGrade | null>(null);
  readonly result = signal<number | null>(null);
  readonly nudge = signal(0);
  /** The latest strike's ring + sparks: an array of one keyed by seq, so each strike re-mounts and replays. */
  readonly flash = signal<{ seq: number; grade: StrikeGrade; pos: number; sparks: number[] }[]>([]);

  private readonly reduced: boolean;
  private started = 0;
  private phase = 0;
  private raf = 0;
  private finished = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private seq = 0;

  constructor() {
    this.i18n.register(MINIGAMES_I18N);
    this.i18n.register(HOME_FORGE_I18N);
    this.reduced = this.isBrowser && typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    afterNextRender(() => {
      this.startSweep();
      // Focus (and so scroll into view) the Strike button: on a phone the game opens below the fold.
      this.strikeBtn()?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  resultPct(): number { return Math.round((this.result() ?? 0) * 100); }
  verdict(): string { return anvilVerdict(this.result() ?? 0); }

  private period(): number {
    const p = anvilPeriod(this.grades().length);
    return this.reduced ? p * 1.4 : p;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /** The marker's position right now (not at the last frame). */
  private position(): number {
    return markerAt(this.now() - this.started, this.period(), this.phase);
  }

  private startSweep(): void {
    if (!this.isBrowser) return;
    // A fresh random phase per strike, so the rhythm cannot be memorised.
    this.phase = Math.random();
    this.started = this.now();
    if (this.raf) return;
    this.zone.runOutsideAngular(() => {
      const frame = () => {
        const el = this.marker()?.nativeElement;
        if (el) el.style.setProperty('--pos', this.position().toFixed(4));
        this.raf = this.finished ? 0 : requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  press(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    this.strike();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.repeat) return;
    this.strike();
  }

  /** Assistive tech activates with a synthetic click (detail 0); a real click already struck on pointerdown. */
  onClick(event: MouseEvent): void {
    if (event.detail === 0) this.strike();
  }

  strike(): void {
    if (this.finished || this.result() !== null) return;
    const pos = this.position();
    const rules = this.rules();
    const grade = gradeStrike(pos, rules.zones);
    const grades = [...this.grades(), grade];
    this.grades.set(grades);
    this.lastGrade.set(grade);
    if (!this.reduced) this.nudge.update(n => n + 1);
    const count = this.reduced ? 0 : SPARKS[grade];
    this.flash.set([{
      seq: ++this.seq,
      grade,
      pos,
      sparks: Array.from({ length: count }, (_, i) => Math.round((360 / Math.max(1, count)) * i + this.seq * 17) % 360),
    }]);
    if (grades.length >= rules.strikes) {
      this.finished = true;
      // Tier 1: every strike counts, which is exactly anvilQuality.
      const q = homeAnvilQuality(grades, rules.counted);
      this.result.set(q);
      this.timers.push(setTimeout(() => this.done.emit(q), RESULT_HOLD_MS));
      return;
    }
    this.startSweep();
  }

  skip(): void {
    if (this.finished && this.result() !== null) return;
    this.finished = true;
    this.done.emit(null);
  }
}
