/**
 * forge-scene.service.ts — the WebGL forge that burns behind every page.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT IT DRAWS
 * ═════════════════════════════════════════════════════════════════════════════
 * Four layers, back to front:
 *
 *   nebula   one quad, two drifting blobs of realm-coloured light
 *   dust     tiny slow motes, far back, almost subliminal — this is the depth
 *   embers   the layer the thing is about: forge sparks rising off the fire
 *   wisps    a handful of large slow travellers, each dragging a comet trail
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY EVERY PARTICLE IS COMPUTED IN THE VERTEX SHADER
 * ═════════════════════════════════════════════════════════════════════════════
 * The obvious build — a JS array of particle objects, integrated on the CPU,
 * written back into a Float32Array, `needsUpdate = true` every frame — costs
 * 500 objects' worth of arithmetic plus a 6KB bus transfer per frame, on the
 * main thread, on top of Angular. On a mid phone that is the whole frame
 * budget before a single pixel is shaded.
 *
 * So nothing here moves on the CPU. Each particle's buffers are written once,
 * at build time, and hold constants: a base position, a seed, a size, a speed.
 * Position, drift, twinkle, cursor repulsion, scroll parallax and the flame's
 * ripple are all functions of `uTime` evaluated per-vertex on the GPU. Per
 * frame the CPU writes eight uniforms and issues four draw calls. That is the
 * entire cost, and it is why the frame governor almost never has to fire.
 *
 * The same decision is what makes the trails free: a wisp is `trail` vertices
 * that share one seed and differ only by `aTrail`, which the shader turns into
 * a time offset. The tail is literally where the head was 0.4s ago, computed
 * from the same expression, with no history buffer anywhere.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY THE CANVAS IS AT z-index 0 AND NOT -1
 * ═════════════════════════════════════════════════════════════════════════════
 * Because a negative z-index layer does not paint on this site, and that is
 * measured rather than assumed — see the ATMOSPHERE block in styles.css. `body`
 * is positioned with `z-index: auto`, so it opens no stacking context; every
 * negative-z-index descendant escapes into html's context and paints at step 2
 * of CSS 2.1 Appendix E, while body paints its own fully opaque gradient later
 * at step 8 and covers all of them. `.matrix-background`, `body::before` and
 * `body::after` are all already dead paint for exactly this reason.
 *
 * `.cosmic-canvas` sits at `z-index: 0` and is visible, so this canvas does the
 * same thing, and for the same reason renders additively under
 * `mix-blend-mode: screen`: black is the identity for screen, so everything the
 * scene does not light stays exactly as it was.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * NGZONE
 * ═════════════════════════════════════════════════════════════════════════════
 * Everything after `mount()` runs outside Angular: the rAF loop, resize,
 * pointermove, scroll and the visibility handler. A 60Hz loop inside the zone
 * is 60 change-detection passes a second across the whole application, which
 * would cost more than the rendering does. Nothing in here writes state a
 * template reads, so nothing needs to come back in.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { ForgeEffectsService } from './forge-effects.service';
import type { SceneReaction } from '../celebration/celebration.model';
import {
  GOVERNOR,
  PALETTES,
  QUALITY_TIERS,
  type QualityTier,
  type ScenePalette,
  demote,
  hexToRgb,
  startingTier,
} from './forge-scene.model';

type Three = typeof import('three');

/** Camera constants. The field is built to fill whatever frustum these give. */
const FOV = 60;
const CAM_Z = 10;
const Z_NEAR = 2;
const Z_FAR = -16;

/** How long a Forge Flame ripple takes to cross the field, in seconds. */
const RIPPLE_SECONDS = 1.5;
/** Concurrent ripples the shader tracks. A fast clicker overwrites the oldest. */
const RIPPLE_SLOTS = 3;

/** Seconds a palette takes to cross-fade when the realm changes. */
const PALETTE_FADE = 1.1;

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAspect;
  uniform float uCamZ;
  uniform float uTanHalfFov;
  uniform float uPointScale;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uScroll;
  uniform float uParallax;
  uniform vec3  uColorHot;
  uniform vec3  uColorCool;
  uniform float uSpeedScale;
  uniform float uOpacity;
  uniform float uZNear;
  uniform float uZFar;
  uniform float uTrailGap;
  uniform float uRippleDur;
  uniform vec4  uRipples[RIPPLE_SLOTS];
  uniform float uFlash;

  attribute vec3  aSeed;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aTrail;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // position.xy is the particle's resting place in a normalised field;
    // position.z is its depth, 0 near .. 1 far. Never changes after build.
    float depth = position.z;
    float z = mix(uZNear, uZFar, depth);

    // A trail vertex is the head, delayed. One expression, no history.
    float tOff = aTrail * uTrailGap;
    float clock = uTime - tOff;

    // Sparks rise. "fract" wraps them back to the floor of the field, and the
    // seed staggers the wrap so the layer never pulses in unison.
    float life = fract(aSeed.x + clock * aSpeed * uSpeedScale * 0.06);

    vec2 p;
    p.y = mix(-1.15, 1.15, life);
    p.x = position.x + sin(clock * (0.15 + aSeed.y * 0.25) + aSeed.z * 6.2831) * 0.05;

    // Scroll parallax. Near layers travel further, which is the whole trick.
    p.y += uScroll * uParallax * (1.25 - depth);

    // The cursor pushes, gently. Gaussian falloff so there is no hard edge to
    // the influence, and weighted by depth so the far field stays still.
    vec2 d = p - uMouse;
    float dist = length(d);
    float push = exp(-dist * dist * 9.0) * uMouseStrength * (1.2 - depth);
    p += normalize(d + vec2(0.0001)) * push * 0.14;

    // Forge Flame ripples: an expanding ring that shoves what it passes and
    // flares it hot. "flare" also feeds the colour mix below.
    float flare = 0.0;
    for (int i = 0; i < RIPPLE_SLOTS; i++) {
      vec4 r = uRipples[i];
      // Strength is signed: positive shoves the field away from the point,
      // negative drags it in. The celebration's spiral is the same ring run
      // backwards, which is one sign flip rather than a second code path.
      if (abs(r.w) < 0.001) continue;
      float age = (uTime - r.z) / uRippleDur;
      if (age < 0.0 || age > 1.0) continue;
      float band = length(p - r.xy) - age * 1.9;
      float hit = exp(-band * band * 90.0) * (1.0 - age) * r.w;
      p += normalize(p - r.xy + vec2(0.0001)) * hit * 0.22;
      // Magnitude, not signed value: a ripple that pulls should still light
      // what it passes, and a negative term here would darken it instead.
      flare += abs(hit);
    }

    // Normalised field -> world. Recomputed per vertex so a resize is a uniform
    // write and never a geometry rebuild.
    float halfH = uTanHalfFov * (uCamZ - z) * 1.18;
    vec3 world = vec3(p.x * halfH * uAspect, p.y * halfH, z);

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPointScale / max(-mv.z, 0.1);

    // Fade in off the floor, out at the ceiling, and dim with distance. The
    // distance term is doing the job THREE.Fog would, for free and without
    // giving up a raw ShaderMaterial.
    float edge = smoothstep(0.0, 0.10, life) * (1.0 - smoothstep(0.72, 1.0, life));
    float twinkle = 0.72 + 0.28 * sin(clock * (0.8 + aSeed.y * 1.6) + aSeed.z * 6.2831);
    vAlpha = uOpacity * edge * twinkle * (1.0 - aTrail * 0.16) * (1.15 - depth * 0.6);
    vColor = mix(uColorCool, uColorHot, clamp(aSeed.y * 0.8 + flare * 2.0, 0.0, 1.0));

    // The celebration whiteout, driven from 0 to 1 and back by celebrate().
    // At rest it is exactly 0 and both lines below are identities, so the
    // scene pays a multiply-add per vertex for it and nothing else.
    //
    // The colour goes to white; the alpha barely moves. That split is the
    // whole tuning. The material is additive, so an alpha boost does not
    // brighten particles — it accumulates across every particle the eye
    // integrates over and turns the entire field into an opaque white sheet
    // that bleaches the page behind it. Measured, at a boost of 2.2 the Void's
    // reveal card was unreadable for two full seconds. 0.35 gives the flare
    // without the sheet.
    vColor = mix(vColor, vec3(1.0), uFlash);
    vAlpha = min(1.0, vAlpha * (1.0 + uFlash * 0.35));
  }
`;

const FRAGMENT_SHADER = `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // A point sprite drawn as maths rather than as a texture: one less asset to
    // ship, one less upload, and it stays crisp at any pixel ratio.
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.22, 0.0, d);
    float a = vAlpha * (halo * halo * 0.65 + core * 0.75);
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vColor * (0.75 + core * 0.9), a);
  }
`;

const NEBULA_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT = `
  uniform float uTime;
  uniform vec3  uColorFog;
  uniform vec3  uColorCool;
  uniform float uOpacity;
  varying vec2 vUv;

  float blob(vec2 uv, vec2 at, float r) {
    float d = length((uv - at) * vec2(1.0, 1.35));
    return exp(-d * d / r);
  }

  void main() {
    // Two slow blobs on Lissajous paths. Deliberately not noise: a noise field
    // at this size is a lot of ALU for something the eye reads as "a glow".
    vec2 a = vec2(0.32 + sin(uTime * 0.045) * 0.10, 0.62 + cos(uTime * 0.037) * 0.09);
    vec2 b = vec2(0.71 + cos(uTime * 0.031) * 0.11, 0.34 + sin(uTime * 0.051) * 0.08);
    float m = blob(vUv, a, 0.10) * 0.85 + blob(vUv, b, 0.075) * 0.65;
    vec3 c = mix(uColorFog, uColorCool, blob(vUv, b, 0.06) * 0.6);
    gl_FragColor = vec4(c * m, m * uOpacity);
  }
`;

/** A colour as the shaders want it: three floats, already in 0..1. */
type Rgb = [number, number, number];

/** The three colours a palette hands the scene, resolved. */
interface SceneColors { hot: Rgb; cool: Rgb; fog: Rgb; }

/** Every colour in a palette, converted once. */
function resolve(p: { hot: string; cool: string; fog: string }): SceneColors {
  return { hot: hexToRgb(p.hot), cool: hexToRgb(p.cool), fog: hexToRgb(p.fog) };
}

/** One drawn layer and everything needed to feed and free it. */
interface Layer {
  points: import('three').Object3D;
  material: import('three').ShaderMaterial;
  geometry: import('three').BufferGeometry;
  /** Vertices the tier asked for, so the governor can shrink the draw range. */
  built: number;
}

@Injectable({ providedIn: 'root' })
export class ForgeSceneService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly effects = inject(ForgeEffectsService);

  private three: Three | null = null;
  private renderer: import('three').WebGLRenderer | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').PerspectiveCamera | null = null;
  private nebula: Layer | null = null;
  private layers: Layer[] = [];

  private canvas: HTMLCanvasElement | null = null;
  private frame = 0;
  private running = false;
  private startedAt = 0;

  private tierId: QualityTier['id'] = 'high';
  private mounting = false;

  /** Cursor and scroll, in the shader's normalised field coordinates. */
  private mouse: [number, number] = [0, -3];
  private scroll = 0;

  /** Ripples as flat vec4s: x, y, startTime, strength. */
  private ripples = new Float32Array(RIPPLE_SLOTS * 4);
  private rippleSlot = 0;
  /** Whiteout amount, 0..1, uploaded to `uFlash` every frame. */
  private flash = 0;
  /** Camera shake: peak offset in world units, and when it started. */
  private shakeAmp = 0;
  private shakeUntil = 0;
  private shakeFor = 0;
  /** Timers owned by `celebrate()`. Cleared on the next celebration and on unmount. */
  private fxTimers: ReturnType<typeof setTimeout>[] = [];
  private fxFade = 0;

  /** Palette cross-fade state. */
  private palette: ScenePalette = 'forge';
  private fadeFrom: SceneColors = resolve(PALETTES.forge);
  private fadeStartedAt = -1;

  /** Frame governor bookkeeping. */
  private windowStart = 0;
  private windowFrames = 0;
  private strikes = 0;

  private listeners: Array<() => void> = [];

  /** True once a GL context exists and the loop owns the canvas. */
  get active(): boolean { return this.renderer !== null; }

  /**
   * Attach to a canvas and start burning.
   *
   * Three is pulled in with a dynamic import so it lands in its own chunk and
   * never touches the initial bundle. A visitor who has Reduce Effects on, or
   * no WebGL, never downloads it at all.
   */
  async mount(canvas: HTMLCanvasElement, opts: { embed: boolean }): Promise<void> {
    if (!this.isBrowser || this.mounting || this.renderer) return;
    if (!this.effects.shouldRender(opts)) return;
    this.mounting = true;
    try {
      const THREE = this.three ?? (this.three = await import('three'));
      // A second mount can win the race while the chunk is in flight.
      if (this.renderer) return;
      this.canvas = canvas;
      this.build(THREE, canvas);
      this.bind();
      this.start();
      // The CSS starfield is the fallback, not a companion: two particle fields
      // on top of each other read as noise, and `.particle-layer` is a ninth
      // fixed full-viewport compositor layer that a phone should not be paying
      // for once the real scene is up.
      document.documentElement.classList.add('forge-scene-on');
    } catch {
      // A failed chunk fetch or a refused context is not an error the player
      // should ever see: the CSS background is already behind them.
      this.unmount();
    } finally {
      this.mounting = false;
    }
  }

  /** Tear the whole thing down and give the GPU its memory back. */
  unmount(): void {
    this.stop();
    this.clearFx();
    if (this.isBrowser) document.documentElement.classList.remove('forge-scene-on');
    for (const off of this.listeners) off();
    this.listeners = [];

    for (const layer of [...this.layers, this.nebula]) {
      if (!layer) continue;
      layer.geometry.dispose();
      layer.material.dispose();
      this.scene?.remove(layer.points);
    }
    this.layers = [];
    this.nebula = null;

    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;
  }

  ngOnDestroy(): void { this.unmount(); }

  /**
   * A ripple, in viewport pixels — the Forge Flame hands over the strike point.
   *
   * A no-op when the scene is not running, which is what lets the flame call it
   * unconditionally without knowing whether WebGL happened.
   */
  ripple(clientX: number, clientY: number, strength = 1): void {
    if (!this.renderer || this.effects.motionless) return;
    const i = this.rippleSlot * 4;
    this.ripples[i] = (clientX / window.innerWidth) * 2 - 1;
    this.ripples[i + 1] = -((clientY / window.innerHeight) * 2 - 1);
    this.ripples[i + 2] = this.now();
    this.ripples[i + 3] = strength;
    this.rippleSlot = (this.rippleSlot + 1) % RIPPLE_SLOTS;
    // A ripple raised while the tab was hidden must still be seen.
    if (!this.running) this.start();
  }

  /**
   * React to a drop. Called by `CelebrationService`; a no-op when the scene is
   * not running, which is what lets it be called unconditionally.
   *
   * `delayMs` is how long the celebration's blackout holds the screen — the
   * field should not be doing anything visible behind a black curtain, so the
   * reaction is scheduled to land with the light rather than with the click.
   *
   * Ripple strength is signed here: `ripple()` takes the shove, and a negative
   * value drags the field in instead. The spiral is that pull followed by a
   * hard shove, which is the whole of the Singular's particle behaviour and
   * needs no new uniform.
   */
  celebrate(reaction: SceneReaction, clientX: number, clientY: number, delayMs = 0): void {
    if (!this.renderer || this.effects.motionless || reaction === 'none') return;
    this.clearFx();

    const at = (fn: () => void, ms: number) => {
      this.fxTimers.push(setTimeout(fn, delayMs + ms));
    };

    switch (reaction) {
      case 'burst':
        at(() => this.ripple(clientX, clientY, 2.2), 0);
        break;

      case 'burst-return':
        at(() => this.ripple(clientX, clientY, 2.8), 0);
        // Back in behind it. RIPPLE_SECONDS is 1.5, so 620ms overlaps the
        // outbound ring's tail and the two read as one breath.
        at(() => this.ripple(clientX, clientY, -1.8), 620);
        break;

      case 'burst-flash':
        at(() => { this.ripple(clientX, clientY, 3.2); this.flashTo(0.3, 420); }, 0);
        at(() => this.ripple(clientX, clientY, -1.6), 700);
        break;

      case 'whiteout':
        at(() => { this.flashTo(0.8, 90); this.ripple(clientX, clientY, 3.6); }, 0);
        at(() => this.flashTo(0, 620), 140);
        at(() => this.ripple(clientX, clientY, -2.2), 760);
        break;

      case 'spiral':
        // In, hold, then out — the field falls into the rune before the screen
        // breaks and is thrown off it when it does.
        at(() => this.ripple(clientX, clientY, -3.4), 0);
        at(() => this.ripple(clientX, clientY, -2.6), 520);
        at(() => { this.flashTo(0.85, 70); this.ripple(clientX, clientY, 4.2); }, 1_150);
        at(() => this.flashTo(0, 760), 1_260);
        at(() => this.ripple(clientX, clientY, 2.4), 1_600);
        break;
    }
  }

  /**
   * Shake the camera.
   *
   * The background moves, the page does not. That distinction is the whole
   * reason this lives here instead of as a CSS transform on <html>: a
   * transformed ancestor becomes the containing block for every
   * `position: fixed` descendant, so shaking the document would re-anchor the
   * Rune Forge's own reveal dialog — `position: fixed; inset: 0` — against a
   * six-thousand-pixel-tall box and throw the card the player is reading off
   * the screen for the duration. Measured, not assumed: the same layer goes
   * from viewport height to scrollHeight the moment <html> carries a transform.
   *
   * Moving the camera reads as the same impact, costs one vector write per
   * frame, and cannot trap anything.
   *
   * `amplitude` arrives in CSS pixels and is converted to world units against
   * the visible height at the field's mid-depth, so a 6px shake is 6px of
   * apparent movement whatever the viewport is.
   */
  shake(amplitudePx: number, ms: number): void {
    if (!this.renderer || !this.camera || this.effects.motionless) return;
    const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - (Z_NEAR + Z_FAR) / 2);
    this.shakeAmp = (amplitudePx / Math.max(1, window.innerHeight)) * halfH * 2;
    this.shakeFor = ms;
    this.shakeUntil = performance.now() + ms;
    if (!this.running) this.start();
  }

  /**
   * Ramp `uFlash` to a target over `ms`.
   *
   * Its own rAF rather than a term in the render loop: the loop is shared with
   * the governor and threading a per-effect clock through it would put a branch
   * in the hot path for something that runs for two seconds a month.
   */
  private flashTo(target: number, ms: number): void {
    if (this.fxFade) cancelAnimationFrame(this.fxFade);
    const from = this.flash;
    const t0 = performance.now();
    // A stopped scene cannot animate the ramp, so give it the end state and
    // one frame. Reduced-effects visitors never reach here at all.
    if (!this.running) { this.flash = target; this.renderOnce(); return; }
    this.zone.runOutsideAngular(() => {
      const step = (): void => {
        const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
        // Ease-out: a linear whiteout reads as a fade, not as a flash.
        this.flash = from + (target - from) * (1 - Math.pow(1 - k, 3));
        if (k < 1) this.fxFade = requestAnimationFrame(step);
      };
      this.fxFade = requestAnimationFrame(step);
    });
  }

  /** Drop any celebration still in flight. Called before the next one and on
   *  unmount, so a route change mid-Singular cannot leave the field white. */
  private clearFx(): void {
    for (const t of this.fxTimers) clearTimeout(t);
    this.fxTimers = [];
    // `unmount()` runs on the server too — Angular destroys the component tree
    // at the end of every prerendered route — and there is no
    // cancelAnimationFrame there. Guarding here rather than at each call site
    // because this is the only place the id is cleared.
    if (this.isBrowser && this.fxFade) cancelAnimationFrame(this.fxFade);
    this.fxFade = 0;
    this.flash = 0;
    this.shakeAmp = 0;
    if (this.camera) { this.camera.position.x = 0; this.camera.position.y = 0; }
  }

  /** Cross-fade the field into a realm's colours. Idempotent per palette. */
  setPalette(next: ScenePalette): void {
    if (next === this.palette) return;
    this.fadeFrom = this.currentColors();
    this.palette = next;
    this.fadeStartedAt = this.now();
    if (this.effects.motionless) this.renderOnce();
  }

  // ── build ──────────────────────────────────────────────────────────────────

  private build(THREE: Three, canvas: HTMLCanvasElement): void {
    this.tierId = startingTier({
      coarsePointer: this.effects.coarsePointer,
      viewportWidth: window.innerWidth,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    });
    const tier = QUALITY_TIERS[this.tierId];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      // Point sprites have no edges to alias and the whole scene is additive
      // glow, so MSAA would buy nothing for a real cost. `low-power` asks a
      // dual-GPU laptop to stay on the integrated chip, which is the difference
      // between a warm palm and a cool one for a background.
      powerPreference: 'low-power',
      depth: false,
      stencil: false,
    });
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    this.camera.position.z = CAM_Z;

    this.nebula = this.buildNebula(THREE);
    this.scene.add(this.nebula.points);

    // Back to front. Depth testing is off, so draw order is the only ordering.
    this.layers = [
      this.buildPoints(THREE, {
        count: tier.dust,
        trail: 1,
        depth: [0.45, 1.0],
        size: [0.018, 0.05],
        speed: [0.10, 0.30],
        opacity: 0.55,
        parallax: 0.07,
        mouse: 0.25,
      }),
      this.buildPoints(THREE, {
        count: tier.embers,
        trail: 1,
        depth: [0.05, 0.75],
        size: [0.040, 0.115],
        speed: [0.45, 1.15],
        opacity: 0.95,
        parallax: 0.18,
        mouse: 1.0,
      }),
      this.buildPoints(THREE, {
        count: tier.wisps,
        trail: tier.trail,
        depth: [0.0, 0.4],
        size: [0.16, 0.28],
        speed: [0.16, 0.34],
        opacity: 0.75,
        parallax: 0.32,
        mouse: 0.7,
      }),
    ];
    for (const layer of this.layers) this.scene.add(layer.points);

    this.applyColors(this.currentColors());
    this.resize();
  }

  private buildNebula(THREE: Three): Layer {
    // Sized to overfill the frustum at the far plane, so no resize can reveal
    // an edge. One quad; the shape lives entirely in the fragment shader.
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERTEX,
      fragmentShader: NEBULA_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uColorFog: { value: new THREE.Vector3() },
        uColorCool: { value: new THREE.Vector3() },
        uOpacity: { value: 0.5 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Mesh(geometry, material);
    points.position.z = Z_FAR - 2;
    points.renderOrder = -1;
    points.frustumCulled = false;
    return { points, material, geometry, built: 1 };
  }

  private buildPoints(THREE: Three, spec: {
    count: number;
    trail: number;
    depth: [number, number];
    size: [number, number];
    speed: [number, number];
    opacity: number;
    parallax: number;
    mouse: number;
  }): Layer {
    const total = spec.count * spec.trail;
    const position = new Float32Array(total * 3);
    const seed = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const speed = new Float32Array(total);
    const trail = new Float32Array(total);

    const lerp = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

    for (let i = 0; i < spec.count; i++) {
      // One draw per particle, `trail` vertices sharing every constant. The
      // shader turns `aTrail` into a time offset, which is what makes the tail
      // land exactly where the head was.
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const z = lerp(spec.depth);
      const s0 = Math.random();
      const s1 = Math.random();
      const s2 = Math.random();
      const px = lerp(spec.size);
      const sp = lerp(spec.speed);
      for (let t = 0; t < spec.trail; t++) {
        const v = i * spec.trail + t;
        position[v * 3] = x;
        position[v * 3 + 1] = y;
        position[v * 3 + 2] = z;
        seed[v * 3] = s0;
        seed[v * 3 + 1] = s1;
        seed[v * 3 + 2] = s2;
        size[v] = px * (1 - t * 0.14);
        speed[v] = sp;
        trail[v] = t;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geometry.setAttribute('aTrail', new THREE.BufferAttribute(trail, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER.replace(/RIPPLE_SLOTS/g, String(RIPPLE_SLOTS)),
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uCamZ: { value: CAM_Z },
        uTanHalfFov: { value: Math.tan((FOV * Math.PI) / 360) },
        uPointScale: { value: 400 },
        uMouse: { value: new THREE.Vector2(0, -3) },
        uMouseStrength: { value: spec.mouse },
        uScroll: { value: 0 },
        uParallax: { value: spec.parallax },
        uColorHot: { value: new THREE.Vector3() },
        uColorCool: { value: new THREE.Vector3() },
        uSpeedScale: { value: this.effects.motionless ? 0 : 1 },
        uOpacity: { value: spec.opacity },
        uZNear: { value: Z_NEAR },
        uZFar: { value: Z_FAR },
        uTrailGap: { value: spec.trail > 1 ? 0.42 : 0 },
        uRippleDur: { value: RIPPLE_SECONDS },
        uRipples: { value: Array.from({ length: RIPPLE_SLOTS }, () => new THREE.Vector4()) },
        uFlash: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    // The field is built in normalised coordinates and projected in the vertex
    // shader, so three's bounding sphere describes a box the geometry never
    // occupies and would cull the whole layer the moment the camera moved.
    points.frustumCulled = false;
    return { points, material, geometry, built: total };
  }

  // ── the loop ───────────────────────────────────────────────────────────────

  private start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    if (!this.startedAt) this.startedAt = performance.now();
    this.windowStart = performance.now();
    this.windowFrames = 0;

    if (this.effects.motionless) {
      // A static end state, per the house rule. One frame, then stop — the
      // scene is still there, it simply is not moving.
      this.running = false;
      this.renderOnce();
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(this.tick);
    });
  }

  private stop(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);
    this.renderOnce();
    this.govern();
  };

  private renderOnce(): void {
    const { renderer, scene, camera } = this;
    if (!renderer || !scene || !camera) return;
    const t = this.now();
    const colors = this.currentColors();
    this.applyColors(colors);

    for (const layer of this.layers) {
      const u = layer.material.uniforms;
      u['uTime'].value = t;
      (u['uMouse'].value as { set: (x: number, y: number) => void }).set(this.mouse[0], this.mouse[1]);
      u['uScroll'].value = this.scroll;
      u['uFlash'].value = this.flash;
      const slots = u['uRipples'].value as Array<{ set: (x: number, y: number, z: number, w: number) => void }>;
      for (let i = 0; i < RIPPLE_SLOTS; i++) {
        slots[i].set(
          this.ripples[i * 4], this.ripples[i * 4 + 1],
          this.ripples[i * 4 + 2], this.ripples[i * 4 + 3],
        );
      }
    }
    if (this.nebula) this.nebula.material.uniforms['uTime'].value = t;

    // The shake, decaying to nothing over its own window. Random per frame
    // rather than a sine, because a periodic shake reads as a wobble; an
    // impact is broadband. Written straight onto the camera and reset to the
    // rest position the frame it expires, so nothing can leave it off-centre.
    if (this.shakeAmp > 0) {
      const left = this.shakeUntil - performance.now();
      if (left <= 0) {
        this.shakeAmp = 0;
        camera.position.x = 0;
        camera.position.y = 0;
      } else {
        const k = (left / Math.max(1, this.shakeFor)) ** 2;
        camera.position.x = (Math.random() * 2 - 1) * this.shakeAmp * k;
        camera.position.y = (Math.random() * 2 - 1) * this.shakeAmp * k;
      }
    }

    renderer.render(scene, camera);
  }

  /**
   * The frame governor: two bad seconds in a row costs a quality tier.
   *
   * Shrinking is a `setDrawRange` and nothing else — no rebuild, no
   * reallocation, no visible pop beyond the particles that stop being drawn.
   * The pixel ratio comes down at the same time, which on a phone is usually
   * the half that mattered: fill rate, not vertex count, is what a 3x display
   * runs out of first.
   */
  private govern(): void {
    this.windowFrames++;
    const now = performance.now();
    const elapsed = now - this.windowStart;
    if (elapsed < GOVERNOR.windowMs) return;

    const fps = (this.windowFrames * 1000) / elapsed;
    this.windowStart = now;
    this.windowFrames = 0;

    if (fps >= GOVERNOR.minFps) { this.strikes = 0; return; }
    if (++this.strikes < GOVERNOR.strikes) return;

    this.strikes = 0;
    const next = demote(this.tierId);
    if (!next) return;
    this.tierId = next;
    const tier = QUALITY_TIERS[next];
    const counts = [tier.dust, tier.embers, tier.wisps * tier.trail];
    this.layers.forEach((layer, i) => {
      layer.geometry.setDrawRange(0, Math.min(counts[i], layer.built));
    });
    this.renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio));
    this.resize();
  }

  // ── input, outside the zone ────────────────────────────────────────────────

  private bind(): void {
    this.zone.runOutsideAngular(() => {
      // One helper so every listener is registered and unregistered in the same
      // shape — a scene that leaks a window listener leaks the whole service.
      const on = (
        target: Window | Document,
        type: string,
        handler: (e: Event) => void,
        opts?: AddEventListenerOptions,
      ) => {
        target.addEventListener(type, handler, opts);
        this.listeners.push(() => target.removeEventListener(type, handler, opts));
      };

      on(window, 'resize', () => this.resize(), { passive: true });
      on(window, 'orientationchange', () => this.resize(), { passive: true });

      // Read-only pointer tracking: the value is consumed by the next frame's
      // uniform write, so there is nothing to throttle and nothing to schedule.
      if (!this.effects.coarsePointer) {
        on(window, 'pointermove', (e) => {
          const pe = e as PointerEvent;
          this.mouse = [
            (pe.clientX / window.innerWidth) * 2 - 1,
            -((pe.clientY / window.innerHeight) * 2 - 1),
          ];
        }, { passive: true });
        // Park the influence well off the field when the cursor leaves, rather
        // than freezing it and leaving a permanent dent in the particles.
        on(document, 'pointerleave', () => { this.mouse = [0, -3]; }, { passive: true });
      }

      on(window, 'scroll', () => {
        this.scroll = -(window.scrollY / Math.max(window.innerHeight, 1)) * 0.5;
      }, { passive: true });

      // Page Visibility: a background tab must not be drawing. Chrome already
      // throttles rAF there, but Safari does not always, and a phone with the
      // browser backgrounded is the exact case where it matters most.
      on(document, 'visibilitychange', () => {
        if (document.hidden) { this.stop(); return; }
        // Resize before restarting. A window resized while the tab was in the
        // background raises no resize event the tab can hear, and a hidden tab
        // reports an innerWidth of 0 in some engines — coming back to a 0x0
        // drawing buffer is a blank scene that never recovers on its own.
        this.resize();
        this.start();
      });

      // A lost context (GPU reset, tab restore, driver crash) is recoverable
      // only by rebuilding, and this scene is decoration: stand down instead.
      const canvas = this.canvas;
      if (canvas) {
        const onLost = (e: Event) => { e.preventDefault(); this.unmount(); };
        canvas.addEventListener('webglcontextlost', onLost);
        this.listeners.push(() => canvas.removeEventListener('webglcontextlost', onLost));
      }
    });
  }

  private resize(): void {
    const { renderer, camera } = this;
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Point size is in world units, so the pixel scale has to be re-derived
    // whenever the drawing buffer changes or a 3x phone rotates.
    const THREE = this.three;
    if (!THREE) return;
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    const pointScale = buffer.y / (2 * Math.tan((FOV * Math.PI) / 360));
    for (const layer of this.layers) {
      layer.material.uniforms['uAspect'].value = camera.aspect;
      layer.material.uniforms['uPointScale'].value = pointScale;
    }
    if (this.nebula) {
      const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - (Z_FAR - 2)) * 2.2;
      this.nebula.points.scale.set(halfH * camera.aspect, halfH, 1);
    }
    if (!this.running) this.renderOnce();
  }

  // ── colour ─────────────────────────────────────────────────────────────────

  /** Seconds since the scene started. One clock, shared by every shader. */
  private now(): number {
    return (performance.now() - (this.startedAt || performance.now())) / 1000;
  }

  /** The palette right now, mid-fade included. */
  private currentColors(): SceneColors {
    const target = resolve(PALETTES[this.palette]);
    if (this.fadeStartedAt < 0) return target;

    const k = Math.min(1, (this.now() - this.fadeStartedAt) / PALETTE_FADE);
    if (k >= 1) { this.fadeStartedAt = -1; return target; }
    const from = this.fadeFrom;
    const mix = (a: Rgb, b: Rgb): Rgb =>
      [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    return { hot: mix(from.hot, target.hot), cool: mix(from.cool, target.cool), fog: mix(from.fog, target.fog) };
  }

  private applyColors(c: SceneColors): void {
    const set = (v: unknown, rgb: Rgb) =>
      (v as { set: (x: number, y: number, z: number) => void }).set(rgb[0], rgb[1], rgb[2]);
    for (const layer of this.layers) {
      set(layer.material.uniforms['uColorHot'].value, c.hot);
      set(layer.material.uniforms['uColorCool'].value, c.cool);
    }
    if (this.nebula) {
      set(this.nebula.material.uniforms['uColorFog'].value, c.fog);
      set(this.nebula.material.uniforms['uColorCool'].value, c.cool);
    }
  }
}
