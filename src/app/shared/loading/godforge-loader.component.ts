import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  NgZone,
  OnInit,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs/operators';

/**
 * Total wall-clock of the full first-visit sequence, in milliseconds.
 *
 * This number is duplicated in godforge-loader.component.css as the
 * `animation-duration` of every layer. The CSS is the authority on what the
 * user actually sees — see the comment block on `.gf-loader` — so if you
 * change one you must change the other.
 */
const SEQUENCE_MS = 2900;

/** Fraction of SEQUENCE_MS at which each stage begins. Mirrors the CSS keyframe stops. */
const STAGE_AT = [0, 0.11, 0.24, 0.4, 0.55, 0.72, 0.86] as const;

/**
 * Hard ceiling on the stage-6 hold. The hold only exists while JS is alive to
 * release it, but a wedged router event would otherwise pin the curtain open
 * forever, so it releases itself regardless.
 */
const HOLD_CAP_MS = 6000;

type LoaderLayer = 'x' | 'runes' | 'compass' | 'core' | 'rings';

/**
 * Per-stage opacity for each SVG layer, indexed by stage - 1.
 *
 * These are bound as inline styles, which sounds like it would fight the CSS
 * keyframes — it doesn't. A running CSS animation outranks inline styles in the
 * cascade, so while the sequence plays these values are inert and the keyframes
 * win. They become authoritative exactly when the animations are gone: under
 * `prefers-reduced-motion`, and after `forwards` hands control back. That makes
 * this table the static fallback rather than a competing animator.
 */
const LAYER_OPACITY: Record<LoaderLayer, readonly number[]> = {
  x:       [0.08, 0.30, 0.85, 1.00, 1.00, 1.00, 1.00],
  runes:   [0.06, 0.14, 0.60, 0.85, 1.00, 1.00, 1.00],
  compass: [0.05, 0.10, 0.55, 0.80, 1.00, 1.00, 1.00],
  core:    [0.05, 0.12, 0.35, 0.70, 0.95, 1.00, 1.00],
  rings:   [0.04, 0.08, 0.20, 0.65, 0.90, 1.00, 1.00]
};

/** The percentage each stage reports. Stage 7 is the only one that says 100. */
const STAGE_PROGRESS = [0, 20, 40, 60, 80, 95, 100] as const;

/** Ambient drift particles — pre-computed so SSR and the browser agree exactly. */
const DRIFT_PARTICLES = [
  { x: 12, y: 78, dx:  38, dy: -120, d: 0.0,  s: 8.5 },
  { x: 27, y: 22, dx: -46, dy:  110, d: 1.4,  s: 9.5 },
  { x: 41, y: 91, dx:  22, dy: -140, d: 0.7,  s: 7.5 },
  { x: 58, y: 14, dx:  54, dy:  126, d: 2.1,  s: 10.5 },
  { x: 69, y: 66, dx: -60, dy:  -96, d: 0.35, s: 8.0 },
  { x: 83, y: 33, dx:  30, dy:  134, d: 1.75, s: 9.0 },
  { x: 91, y: 84, dx: -34, dy: -112, d: 1.05, s: 11.0 },
  { x: 6,  y: 47, dx:  62, dy:   88, d: 2.45, s: 7.0 },
  { x: 49, y: 52, dx: -28, dy: -128, d: 0.55, s: 10.0 }
];

/**
 * Stage-4 inrush particles. Positioned on the rim and pulled toward the core;
 * `--dx`/`--dy` are the vector back to centre, so one keyframe serves all six.
 */
const INRUSH_PARTICLES = [
  { x: 8,  y: 20, d: 0.0 },
  { x: 88, y: 18, d: 0.22 },
  { x: 15, y: 82, d: 0.44 },
  { x: 92, y: 76, d: 0.11 },
  { x: 50, y: 4,  d: 0.33 },
  { x: 46, y: 96, d: 0.55 }
];

/** The 12 rune glyph ids, in the order they are seated around the band. */
const RUNE_SEATS = [
  { id: 'gfr1', a: 15 },  { id: 'gfr5', a: 45 },  { id: 'gfr3', a: 75 },
  { id: 'gfr7', a: 105 }, { id: 'gfr2', a: 135 }, { id: 'gfr8', a: 165 },
  { id: 'gfr4', a: 195 }, { id: 'gfr6', a: 225 }, { id: 'gfr1', a: 255 },
  { id: 'gfr3', a: 285 }, { id: 'gfr5', a: 315 }, { id: 'gfr7', a: 345 }
];

@Component({
  selector: 'app-godforge-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './godforge-loader.component.css',
  template: `
    @if (!removed()) {
      <div
        class="gf-loader"
        [class.gf-loader--complete]="loadComplete()"
        [class.gf-loader--holding]="holding()"
        [class.gf-loader--hidden]="dismissed()"
        [attr.data-stage]="stage()"
        aria-hidden="true">

        <!-- Ambient drift, then the stage-4 inrush toward the core. -->
        <div class="gf-particles">
          @for (p of driftParticles; track $index) {
            <i class="gf-particle"
               [style.left.%]="p.x" [style.top.%]="p.y"
               [style.--dx.px]="p.dx" [style.--dy.px]="p.dy"
               [style.--pd.s]="p.d" [style.--ps.s]="p.s"></i>
          }
          @for (p of inrushParticles; track $index) {
            <i class="gf-particle gf-particle--in"
               [style.left.%]="p.x" [style.top.%]="p.y"
               [style.--dx.px]="(50 - p.x) * 4" [style.--dy.px]="(50 - p.y) * 3"
               [style.--pd.s]="p.d"></i>
          }
        </div>

        <div class="gf-sigil">
          <svg class="godforge-sigil" viewBox="0 0 400 400" role="img"
               aria-label="The Godforge sigil awakening">
            <defs>
              <!-- Rune glyphs. Drawn as paths rather than Unicode runic text:
                   the Runic block is absent from most system font stacks, so
                   text would render as tofu on the machines least able to
                   afford a webfont. -->
              <path id="gfr1" d="M-6-8 L-6 8 M-6-8 L6 0 L-6 3" />
              <path id="gfr2" d="M0-8 L0 8 M-5-8 L0-2 L5-8" />
              <path id="gfr3" d="M-5-8 L-5 8 M5-8 L5 8 M-5-2 L5 2" />
              <path id="gfr4" d="M-5-8 L5 8 M5-8 L-5 8" />
              <path id="gfr5" d="M-5 8 L0-8 L5 8" />
              <path id="gfr6" d="M-6-8 L-6 8 L4 8 M-6 0 L2 0" />
              <path id="gfr7" d="M0-8 L-5 0 L0 8 L5 0 Z" />
              <path id="gfr8" d="M-5-8 L-5 8 M-5-8 L5-8 M-5 0 L3 0" />

              <!-- One compass mark: diamond, inner diamond, three seed dots. -->
              <g id="gfCompass">
                <path d="M0-13 L9 0 L0 13 L-9 0 Z" />
                <path d="M0-6 L4 0 L0 6 L-4 0 Z" class="gf-compass__pip" />
                <circle cx="0" cy="22" r="2.2" class="gf-compass__dot" />
                <circle cx="-7" cy="18" r="1.5" class="gf-compass__dot" />
                <circle cx="7" cy="18" r="1.5" class="gf-compass__dot" />
              </g>

              <radialGradient id="gfCoreGrad">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="45%" stop-color="#C4B5FD" />
                <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0" />
              </radialGradient>
            </defs>

            <!-- ── Layer 2: Rune Circle ────────────────────────────────── -->
            <g class="layer-runes" [style.opacity]="getLayerOpacity('runes')">
              <g class="layer-runes__band">
                <circle class="gf-band" cx="200" cy="200" r="171" />
                <circle class="gf-band__edge" cx="200" cy="200" r="186" />
                <circle class="gf-band__edge" cx="200" cy="200" r="156" />
              </g>
              <g class="layer-runes__glyphs">
                @for (r of runeSeats; track $index) {
                  <use [attr.href]="'#' + r.id" class="gf-rune"
                       [attr.transform]="'rotate(' + r.a + ' 200 200) translate(200 29)'" />
                }
              </g>
            </g>

            <!-- ── Layer 5: Inner Rings ────────────────────────────────── -->
            <g class="layer-rings" [style.opacity]="getLayerOpacity('rings')">
              <circle class="gf-ring gf-ring--1" cx="200" cy="200" r="150" />
              <circle class="gf-ring gf-ring--2" cx="200" cy="200" r="143" />
              <circle class="gf-ring gf-ring--3" cx="200" cy="200" r="64" />
            </g>

            <!-- ── Layer 3: Compass Points (N → E → S → W) ─────────────── -->
            <!-- Seating and scaling are split across two elements on purpose.
                 The outer g carries the rotate/translate that seats the mark on
                 the band, as an attribute; the use inside it carries the CSS
                 transform: scale() the keyframes animate. Put both on one
                 element and the animated CSS transform replaces the attribute
                 outright, and all four marks collapse onto the viewBox origin. -->
            <g class="layer-compass" [style.opacity]="getLayerOpacity('compass')">
              <g transform="translate(200 29)">
                <use href="#gfCompass" class="gf-compass gf-compass--n" />
              </g>
              <g transform="rotate(90 200 200) translate(200 29)">
                <use href="#gfCompass" class="gf-compass gf-compass--e" />
              </g>
              <g transform="rotate(180 200 200) translate(200 29)">
                <use href="#gfCompass" class="gf-compass gf-compass--s" />
              </g>
              <g transform="rotate(270 200 200) translate(200 29)">
                <use href="#gfCompass" class="gf-compass gf-compass--w" />
              </g>
            </g>

            <!-- ── Layer 1: X Sigil ────────────────────────────────────── -->
            <g class="layer-x" [style.opacity]="getLayerOpacity('x')">
              <path class="gf-x" d="M110 110 L150 110 L200 174.3 L250 110 L290 110 L220 200 L290 290 L250 290 L200 225.7 L150 290 L110 290 L180 200 Z" />
              <!-- Cracks. Same silhouette, traced by stroke-dashoffset. -->
              <g class="gf-x__cracks">
                <path d="M132 128 L176 186 M168 132 L150 158 M268 128 L224 186 M232 132 L250 158" />
                <path d="M132 272 L176 214 M268 272 L224 214 M200 190 L200 210" />
              </g>
            </g>

            <!-- ── Stage 5: lightning arcs ─────────────────────────────── -->
            <g class="gf-arcs">
              <path d="M200 200 L214 158 L204 150 L222 108" />
              <path d="M200 200 L242 214 L250 204 L292 222" />
              <path d="M200 200 L186 242 L196 250 L178 292" />
              <path d="M200 200 L158 186 L150 196 L108 178" />
            </g>

            <!-- ── Stage 6: beams from the compass points ──────────────── -->
            <g class="gf-beams">
              <path d="M200 196 L200 -60 L200 204 Z" transform="translate(0 0)" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(90 200 200)" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(180 200 200)" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(270 200 200)" />
            </g>

            <!-- ── Layer 4: Center Core ────────────────────────────────── -->
            <g class="layer-core" [style.opacity]="getLayerOpacity('core')">
              <circle class="gf-core__bloom" cx="200" cy="200" r="52" fill="url(#gfCoreGrad)" />
              <circle class="gf-core" cx="200" cy="200" r="7" />
            </g>
          </svg>

          <!-- Stage 6 lens flare, laid across the X's crossing point. -->
          <span class="gf-flare"></span>
        </div>

        <div class="gf-vignette"></div>
        <div class="gf-flash"></div>
        <div class="loader-text">{{ stageText() }}</div>
      </div>
    }
  `
})
export class GodforgeLoaderComponent implements OnInit {
  readonly driftParticles = DRIFT_PARTICLES;
  readonly inrushParticles = INRUSH_PARTICLES;
  readonly runeSeats = RUNE_SEATS;

  readonly stage = signal(1);
  readonly loadComplete = signal(false);
  readonly holding = signal(false);
  readonly dismissed = signal(false);
  readonly removed = signal(false);

  /**
   * Deliberately a bare number, not a stage name. The brief's design rules ban
   * text labels during the sequence; a percentage is the one exception it
   * allows, and it stays at 0.2 opacity so it reads as instrumentation.
   */
  readonly stageText = signal('0');

  private readonly isBrowser: boolean;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private router: Router,
    private zone: NgZone,
    private destroyRef: DestroyRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  ngOnInit(): void {
    // On the server the loader renders once, at stage 1, and stays there. That
    // is the point: the prerendered HTML already carries the void and the faint
    // sigil, so the curtain is painted before a single byte of JS is parsed.
    if (!this.isBrowser) {
      return;
    }

    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // "Skip straight to stage 7" — no flash, no fade, just gone.
      this.stage.set(7);
      this.stageText.set('100');
      this.loadComplete.set(true);
      this.dismissed.set(true);
      this.removed.set(true);
      return;
    }

    const short =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('gf-boot-short');

    // The CSS runs the sequence off the main thread; these timers only keep the
    // stage counter and the progress read-out in step with it, and decide
    // whether stage 6 needs to hold. Nothing the user sees depends on them
    // firing on time.
    this.zone.runOutsideAngular(() => {
      const startFrom = short ? 4 : 0;
      const offset = short ? STAGE_AT[4] * SEQUENCE_MS : 0;

      for (let i = startFrom; i < STAGE_AT.length; i++) {
        const at = STAGE_AT[i] * SEQUENCE_MS - offset;
        this.timers.push(
          setTimeout(() => this.enterStage(i + 1), Math.max(0, at))
        );
      }

      this.timers.push(
        setTimeout(() => this.finish(), SEQUENCE_MS - offset + 120)
      );
    });

    // First completed navigation is the app's "ready" signal.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), take(1))
      .subscribe(() => this.onAppReady());
  }

  /**
   * Per-layer opacity for the current stage. See LAYER_OPACITY for why binding
   * this alongside CSS keyframes is safe rather than a fight.
   */
  getLayerOpacity(layer: LoaderLayer): number {
    const table = LAYER_OPACITY[layer];
    return table[Math.min(this.stage(), table.length) - 1];
  }

  private enterStage(next: number): void {
    this.zone.run(() => {
      this.stage.set(next);
      this.stageText.set(String(STAGE_PROGRESS[next - 1]));

      // Stage 6 is the hold point: if the app has not signalled ready by the
      // time we reach 95%, pause here rather than flashing into a site that is
      // not there yet.
      if (next === 6 && !this.loadComplete()) {
        this.holding.set(true);
        this.timers.push(setTimeout(() => this.release(), HOLD_CAP_MS));
      }
    });
  }

  private onAppReady(): void {
    this.zone.run(() => {
      this.loadComplete.set(true);
      this.release();
    });
  }

  private release(): void {
    if (!this.holding()) {
      return;
    }
    this.holding.set(false);
    // The pause froze the CSS mid-flight; once unpaused it still owes us the
    // stage-7 flash and the fade, so re-arm the teardown from here.
    this.zone.runOutsideAngular(() => {
      this.timers.push(
        setTimeout(() => this.zone.run(() => this.enterStage(7)), 120)
      );
      this.timers.push(
        setTimeout(() => this.zone.run(() => this.finish()), (1 - STAGE_AT[5]) * SEQUENCE_MS)
      );
    });
  }

  private finish(): void {
    this.zone.run(() => {
      this.stage.set(7);
      this.stageText.set('100');
      this.dismissed.set(true);
      // Drop it out of the DOM so the compositor stops carrying a full-viewport
      // layer for the rest of the session.
      this.timers.push(
        setTimeout(() => this.zone.run(() => this.removed.set(true)), 400)
      );
    });
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
