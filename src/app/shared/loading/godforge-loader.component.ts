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
 *
 * 600ms rather than the several seconds this started at. The hold's whole job
 * is to cover the gap between the sequence ending and Angular's first
 * navigation completing, which on a mid-tier phone is a few hundred
 * milliseconds; past that the honest thing is to show the user the site, ready
 * or not. See HARD_CAP_MS for the ceiling this sits under.
 */
const HOLD_CAP_MS = 600;

/**
 * Absolute ceiling on how long the curtain may cover the site, measured from
 * the component booting. Whatever else is or is not happening — a held stage 6,
 * a router event that never arrives, a timer that fired out of order — this
 * fires once and tears the loader down.
 *
 * The sequence itself is 2.9s by design and the teardown lands at 3.02s, so
 * this cannot be the 3s flat it reads as without truncating the normal cut. It
 * is that ceiling plus the hold's own budget: the common path is untouched at
 * ~3.0s, and the worst case any user can reach is ~3.6s plus the 380ms fade.
 */
const HARD_CAP_MS = SEQUENCE_MS + HOLD_CAP_MS + 120;

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

/**
 * Embers rising off the forge from stage 5. Purple and white only — the brief
 * limits the whole scene to #8B5CF6 and white, so these read as cooling sparks
 * rather than the orange a real forge would throw.
 */
const EMBERS = [
  { x: 26, d: 0.0,  s: 3.4, r: 1.6, sway:  14 },
  { x: 34, d: 0.9,  s: 4.2, r: 1.1, sway: -18 },
  { x: 43, d: 0.35, s: 3.8, r: 2.0, sway:  10 },
  { x: 50, d: 1.5,  s: 4.6, r: 1.3, sway: -12 },
  { x: 57, d: 0.6,  s: 3.2, r: 1.8, sway:  16 },
  { x: 65, d: 1.2,  s: 4.0, r: 1.2, sway: -15 },
  { x: 73, d: 0.2,  s: 4.4, r: 1.5, sway:   9 },
  { x: 19, d: 1.8,  s: 3.6, r: 1.0, sway: -10 },
  { x: 80, d: 0.75, s: 3.9, r: 1.7, sway:  13 },
  { x: 12, d: 1.1,  s: 4.8, r: 1.2, sway: -16 }
];

/**
 * The 12 rune glyph ids, in the order they are seated around the band. `i` is
 * the ignition order — each rune lights --gf-stagger after the one before it,
 * so stage 3 sweeps light around the circle rather than switching it on.
 */
const RUNE_SEATS = [
  { id: 'gfr1', a: 15,  i: 0 },  { id: 'gfr5', a: 45,  i: 1 },
  { id: 'gfr3', a: 75,  i: 2 },  { id: 'gfr7', a: 105, i: 3 },
  { id: 'gfr2', a: 135, i: 4 },  { id: 'gfr8', a: 165, i: 5 },
  { id: 'gfr4', a: 195, i: 6 },  { id: 'gfr6', a: 225, i: 7 },
  { id: 'gfr1', a: 255, i: 8 },  { id: 'gfr3', a: 285, i: 9 },
  { id: 'gfr5', a: 315, i: 10 }, { id: 'gfr7', a: 345, i: 11 }
];

/** Tick marks on the inner ring, between the runes. */
const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

/** Volumetric shafts thrown from the core once the forge is lit. */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

/** N/E/S/W, in the order they ignite. */
const COMPASS = [
  { d: 'n', a: 0,   i: 0 },
  { d: 'e', a: 90,  i: 1 },
  { d: 's', a: 180, i: 2 },
  { d: 'w', a: 270, i: 3 }
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

        <!-- Depth. Three parallax star sheets so stage 1 reads as distance
             rather than as an empty black rectangle. -->
        <div class="gf-deep gf-deep--far"></div>
        <div class="gf-deep gf-deep--mid"></div>
        <div class="gf-deep gf-deep--near"></div>

        <!-- Nebula. Absent until stage 4 — the brief holds the screen to pure
             #0a0a0f until the purple activates. -->
        <div class="gf-nebula"></div>

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

        <!-- Embers off the forge, from stage 5. -->
        <div class="gf-embers">
          @for (e of embers; track $index) {
            <i class="gf-ember"
               [style.left.%]="e.x"
               [style.--pd.s]="e.d" [style.--ps.s]="e.s"
               [style.--er.px]="e.r" [style.--sway.px]="e.sway"></i>
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

              <!-- The X silhouette, referenced by the body, the bevel, the
                   inner facet and the crack clip so they can never drift. -->
              <path id="gfXPath"
                    d="M110 110 L150 110 L200 174.3 L250 110 L290 110 L220 200 L290 290 L250 290 L200 225.7 L150 290 L110 290 L180 200 Z" />

              <clipPath id="gfXClip"><use href="#gfXPath" /></clipPath>

              <!-- One compass mark: diamond, inner gem, three seed dots. -->
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

              <!-- Faceted stone for the X body: lit from the top-left, falling
                   to near-black on the underside. -->
              <linearGradient id="gfXFace" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#4c3a86" />
                <stop offset="42%" stop-color="#1d1236" />
                <stop offset="100%" stop-color="#0b0718" />
              </linearGradient>

              <!-- Volumetric shafts fade in from the core and out at the rim. -->
              <radialGradient id="gfRayFade">
                <stop offset="0%" stop-color="#fff" stop-opacity="0" />
                <stop offset="22%" stop-color="#fff" stop-opacity="0.85" />
                <stop offset="65%" stop-color="#fff" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#fff" stop-opacity="0" />
              </radialGradient>
              <mask id="gfRayMask">
                <circle cx="200" cy="200" r="280" fill="url(#gfRayFade)" />
              </mask>

              <!-- Carved stone. Displacing the band's own edges reads as chisel
                   work; a texture bitmap would not survive the scale change in
                   stage 7. Static — animating baseFrequency re-runs the noise
                   every frame and is ruinous on a phone. -->
              <filter id="gfCarve" x="-15%" y="-15%" width="130%" height="130%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035"
                              numOctaves="3" seed="11" result="t" />
                <feDisplacementMap in="SourceGraphic" in2="t" scale="3.2"
                                   xChannelSelector="R" yChannelSelector="G" />
              </filter>

              <!-- Speckle for the stone. The final feComposite is load-bearing:
                   feTurbulence fills the entire filter region, so without
                   clipping the noise back to the source the band renders as an
                   opaque grey rectangle sitting over the scene. -->
              <filter id="gfGrain" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85"
                              numOctaves="3" seed="5" result="n" />
                <feColorMatrix in="n" type="saturate" values="0" result="g" />
                <feComponentTransfer in="g" result="grain">
                  <feFuncA type="table" tableValues="0 0.55" />
                </feComponentTransfer>
                <feComposite in="grain" in2="SourceGraphic" operator="in" />
              </filter>
            </defs>

            <!-- ── Volumetric shafts (stage 5+) ───────────────────────────── -->
            <g class="gf-rays" mask="url(#gfRayMask)">
              @for (a of rays; track $index) {
                <path d="M200 200 L189 -80 L211 -80 Z"
                      [attr.transform]="'rotate(' + a + ' 200 200)'" />
              }
            </g>

            <!-- ── Layer 2: Rune Circle ────────────────────────────────── -->
            <g class="layer-runes" [style.opacity]="getLayerOpacity('runes')">
              <!-- Two nested groups, not one. The outer rotates; the inner
                   carries the carve and grain filters. Put the filter on the
                   element that is also being animated and the turbulence is
                   liable to be re-evaluated every frame of a 46s rotation;
                   split like this the filtered raster is produced once and the
                   transform is applied to the cached result. -->
              <g class="layer-runes__band">
                <g class="layer-runes__stone">
                  <circle class="gf-band" cx="200" cy="200" r="171" />
                  <circle class="gf-band__edge" cx="200" cy="200" r="186" />
                  <circle class="gf-band__edge" cx="200" cy="200" r="156" />
                </g>
                <circle class="gf-band__grain" cx="200" cy="200" r="171" />
              </g>
              <g class="layer-runes__glyphs">
                @for (r of runeSeats; track $index) {
                  <use [attr.href]="'#' + r.id" class="gf-rune"
                       [attr.style]="'--ri:' + r.i"
                       [attr.transform]="'rotate(' + r.a + ' 200 200) translate(200 29)'" />
                }
              </g>
              <g class="layer-runes__ticks">
                @for (a of ticks; track $index) {
                  <line class="gf-tick" x1="200" y1="150" x2="200" y2="156"
                        [attr.transform]="'rotate(' + a + ' 200 200)'" />
                }
              </g>
            </g>

            <!-- ── Layer 5: Inner Rings ────────────────────────────────── -->
            <g class="layer-rings" [style.opacity]="getLayerOpacity('rings')">
              <circle class="gf-ring gf-ring--1" cx="200" cy="200" r="150" />
              <circle class="gf-ring gf-ring--2" cx="200" cy="200" r="143" />
              <circle class="gf-ring gf-ring--3" cx="200" cy="200" r="64" />
              <circle class="gf-ring gf-ring--4" cx="200" cy="200" r="96" />
            </g>

            <!-- ── Layer 3: Compass Points (N → E → S → W) ─────────────── -->
            <!-- Seating and scaling are split across two elements on purpose.
                 The outer g carries the rotate/translate that seats the mark on
                 the band, as an attribute; the use inside it carries the CSS
                 transform: scale() the keyframes animate. Put both on one
                 element and the animated CSS transform replaces the attribute
                 outright, and all four marks collapse onto the viewBox origin. -->
            <g class="layer-compass" [style.opacity]="getLayerOpacity('compass')">
              @for (c of compass; track $index) {
                <g [attr.transform]="'rotate(' + c.a + ' 200 200) translate(200 29)'">
                  <use href="#gfCompass" class="gf-compass"
                       [attr.style]="'--ri:' + c.i" />
                </g>
              }
            </g>

            <!-- ── Layer 1: X Sigil ────────────────────────────────────── -->
            <g class="layer-x" [style.opacity]="getLayerOpacity('x')">
              <use href="#gfXPath" class="gf-x" />

              <!-- Bevel: the top and left edges catch light, the bottom and
                   right fall away. Two open paths rather than an offset
                   polygon, which for this silhouette is a lot of arithmetic
                   for a line nobody looks at directly. -->
              <path class="gf-x__lit"
                    d="M110 290 L180 200 L110 110 L150 110 L200 174.3 L250 110 L290 110" />
              <path class="gf-x__dim"
                    d="M290 110 L220 200 L290 290 L250 290 L200 225.7 L150 290 L110 290" />

              <!-- Inner facet. A uniform scale about the centre is not a true
                   inset for a star polygon, but at 0.9 the error is under a
                   pixel and it reads as depth. -->
              <use href="#gfXPath" class="gf-x__facet" />

              <!-- The fracture network, clipped so nothing spills past the
                   silhouette. This is the piece the reference art is built on:
                   dark stone lit from inside by what is running through it. -->
              <g class="gf-x__cracks" clip-path="url(#gfXClip)">
                <path [attr.style]="'--ri:1'" class="gf-crack gf-crack--major" d="M124 124 L152 158 L146 176 L170 196" />
                <path [attr.style]="'--ri:1'" class="gf-crack gf-crack--major" d="M276 124 L248 158 L254 176 L230 196" />
                <path [attr.style]="'--ri:1'" class="gf-crack gf-crack--major" d="M124 276 L152 242 L146 224 L170 204" />
                <path [attr.style]="'--ri:1'" class="gf-crack gf-crack--major" d="M276 276 L248 242 L254 224 L230 204" />
                <path [attr.style]="'--ri:3'" class="gf-crack" d="M152 158 L172 152 M146 176 L128 182" />
                <path [attr.style]="'--ri:3'" class="gf-crack" d="M248 158 L228 152 M254 176 L272 182" />
                <path [attr.style]="'--ri:3'" class="gf-crack" d="M152 242 L172 248 M146 224 L128 218" />
                <path [attr.style]="'--ri:3'" class="gf-crack" d="M248 242 L228 248 M254 224 L272 218" />
                <path [attr.style]="'--ri:0'" class="gf-crack gf-crack--major" d="M186 200 L200 188 L214 200 L200 212 Z" />
                <path [attr.style]="'--ri:2'" class="gf-crack" d="M200 188 L200 172 M200 212 L200 228" />
                <path [attr.style]="'--ri:2'" class="gf-crack" d="M186 200 L170 200 M214 200 L230 200" />
                <path [attr.style]="'--ri:4'" class="gf-crack gf-crack--hair" d="M138 140 L158 140 M262 140 L242 140" />
                <path [attr.style]="'--ri:4'" class="gf-crack gf-crack--hair" d="M138 260 L158 260 M262 260 L242 260" />
                <path [attr.style]="'--ri:5'" class="gf-crack gf-crack--hair" d="M160 120 L166 134 M240 120 L234 134" />
                <path [attr.style]="'--ri:5'" class="gf-crack gf-crack--hair" d="M160 280 L166 266 M240 280 L234 266" />
                <path [attr.style]="'--ri:6'" class="gf-crack gf-crack--hair" d="M132 168 L148 160 M268 168 L252 160" />
                <path [attr.style]="'--ri:6'" class="gf-crack gf-crack--hair" d="M132 232 L148 240 M268 232 L252 240" />
              </g>
            </g>

            <!-- ── Stage 5: lightning arcs ─────────────────────────────── -->
            <g class="gf-arcs">
              <path d="M200 200 L214 158 L204 150 L222 108" />
              <path d="M200 200 L242 214 L250 204 L292 222" />
              <path d="M200 200 L186 242 L196 250 L178 292" />
              <path d="M200 200 L158 186 L150 196 L108 178" />
            </g>

            <!-- ── Stage 6: shockwaves off the core ────────────────────── -->
            <g class="gf-shock">
              <circle class="gf-shock__ring gf-shock__ring--1" cx="200" cy="200" r="40" />
              <circle class="gf-shock__ring gf-shock__ring--2" cx="200" cy="200" r="40" />
              <circle class="gf-shock__ring gf-shock__ring--3" cx="200" cy="200" r="40" />
            </g>

            <!-- ── Stage 6: beams from the compass points ──────────────── -->
            <g class="gf-beams">
              <path d="M200 196 L200 -60 L200 204 Z" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(90 200 200)" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(180 200 200)" />
              <path d="M200 196 L200 -60 L200 204 Z" transform="rotate(270 200 200)" />
            </g>

            <!-- ── Layer 4: Center Core ────────────────────────────────── -->
            <g class="layer-core" [style.opacity]="getLayerOpacity('core')">
              <circle class="gf-core__bloom" cx="200" cy="200" r="52" fill="url(#gfCoreGrad)" />
              <!-- Four-point star flare, the giveaway that a light source is
                   blowing out rather than merely being bright. -->
              <g class="gf-core__star">
                <path d="M200 130 L204 196 L200 270 L196 196 Z" />
                <path d="M130 200 L196 204 L270 200 L196 196 Z" />
              </g>
              <circle class="gf-core" cx="200" cy="200" r="7" />
            </g>
          </svg>

          <!-- Stage 6 lens flare, laid across the X's crossing point. -->
          <span class="gf-flare"></span>
          <span class="gf-flare gf-flare--ghost"></span>
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
  readonly embers = EMBERS;
  readonly runeSeats = RUNE_SEATS;
  readonly ticks = TICKS;
  readonly rays = RAYS;
  readonly compass = COMPASS;

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

  /**
   * The subset of `timers` that tracks the CSS sequence — the per-stage ticks
   * and the teardown. Held separately because a hold freezes the CSS mid-play
   * and every one of these becomes wrong the moment it does; they are cancelled
   * on the way into the hold and re-armed on the way out. Everything else
   * (the hard cap, the brand measurement, node removal) is absolute and stays.
   */
  private seqTimers: ReturnType<typeof setTimeout>[] = [];

  /** finish() is reachable from four paths; it may only run once. */
  private finished = false;

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
        this.seqTimers.push(
          setTimeout(() => this.enterStage(i + 1), Math.max(0, at))
        );
      }

      this.seqTimers.push(
        setTimeout(() => this.finish(), SEQUENCE_MS - offset + 120)
      );

      // The one timer that is never cancelled and never rescheduled.
      this.timers.push(setTimeout(() => this.finish(), HARD_CAP_MS - offset));
    });

    this.aimAtBrand();

    // First completed navigation is the app's "ready" signal.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), take(1))
      .subscribe(() => this.onAppReady());
  }

  /**
   * Point the stage-7 flight at where the header brand actually is.
   *
   * The CSS carries a hand-copy of the header's geometry as the prerender
   * fallback, but a hand-copy goes stale the moment the header changes — and it
   * has: --gfnav-h moved 56 -> 60px, the row's inline padding changed, and the
   * bar compacts to 48px on scroll, each of which silently shifts the landing
   * point. Measuring the element removes the coupling entirely.
   *
   * Deliberately one measurement, not a resize observer: the flight begins at
   * 86% of the sequence and the values only need to be right by then. Reading
   * layout once, ~2.4s before it matters, costs nothing.
   */
  private aimAtBrand(): void {
    this.zone.runOutsideAngular(() => {
      this.timers.push(setTimeout(() => {
        const brand = document.querySelector('.gfnav__sigil');
        const host = document.querySelector('.gf-loader') as HTMLElement | null;
        if (!brand || !host) {
          return;
        }
        const r = brand.getBoundingClientRect();
        if (!r.width) {
          return;
        }
        host.style.setProperty('--gf-logo-x', `${r.left + r.width / 2}px`);
        host.style.setProperty('--gf-logo-y', `${r.top + r.height / 2}px`);
      }, 120));
    });
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
      //
      // Cancelling the sequence timers is what makes the hold real. `holding`
      // pauses the CSS, but the stage-7 tick and the teardown were scheduled
      // against a clock that is no longer running: left armed, the read-out
      // jumped to 100 over a frozen stage-6 scene and the teardown then
      // dismissed the curtain mid-hold, so the flash and the flight into the
      // navbar were skipped entirely and the site arrived in a cut. They are
      // re-armed against the remaining CSS time in release().
      if (next === 6 && !this.loadComplete()) {
        this.holding.set(true);
        this.clearSequenceTimers();
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

    // The pause froze the CSS at the stage-6 stop, so what it still owes is
    // measured from there, not from zero: the flash lands at STAGE_AT[6] and
    // the curtain clears at the end. Both deltas are the same on the short cut,
    // because the CSS is at 72% either way — only the JS clock differs.
    const held = STAGE_AT[5] * SEQUENCE_MS;
    const toStage7 = STAGE_AT[6] * SEQUENCE_MS - held;
    const toEnd = SEQUENCE_MS - held + 120;

    this.zone.runOutsideAngular(() => {
      this.seqTimers.push(
        setTimeout(() => this.zone.run(() => this.enterStage(7)), toStage7)
      );
      this.seqTimers.push(
        setTimeout(() => this.zone.run(() => this.finish()), toEnd)
      );
    });
  }

  private finish(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;

    this.zone.run(() => {
      this.stage.set(7);
      this.stageText.set('100');
      // Unpause on the way out. .gf-loader--hidden carries !important so it wins
      // against the paused gfCurtain either way, but leaving the subtree frozen
      // would also freeze the sigil mid-shake behind the fade.
      this.holding.set(false);
      this.dismissed.set(true);
      // Drop it out of the DOM so the compositor stops carrying a full-viewport
      // layer for the rest of the session. 400ms clears the 380ms fade.
      this.timers.push(
        setTimeout(() => this.zone.run(() => this.removed.set(true)), 400)
      );
    });
  }

  private clearSequenceTimers(): void {
    this.seqTimers.forEach(clearTimeout);
    this.seqTimers = [];
  }

  private clearTimers(): void {
    this.clearSequenceTimers();
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
