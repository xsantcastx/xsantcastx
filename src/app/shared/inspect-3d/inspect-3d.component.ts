/**
 * inspect-3d.component.ts — the item, on a pedestal, in three dimensions.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT IT IS
 * ═════════════════════════════════════════════════════════════════════════════
 * A physical card with real thickness. The front carries the artwork and the
 * name, the back carries the stat block, the edges emit the rarity's light, and
 * everything else in the scene is the tier showing off: orbiters, light rays,
 * tendrils, and — at Singular only — the card's own surface refusing to stay
 * flat. The ladder is in inspect-3d.model.ts and it is the same ladder the drop
 * toast climbs.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE IS LOADED WITH A DYNAMIC IMPORT
 * ═════════════════════════════════════════════════════════════════════════════
 * Because it reaches for three, and three is 730KB raw. `@defer` is the usual
 * answer and it is not available here: deferrable views resolve their
 * dependencies from the host component's own `imports`, and the host is
 * AppComponent, which is NgModule-declared — anything AppModule imports is
 * eager by definition. So Inspect3dOutletComponent builds this one through
 * `ViewContainerRef.createComponent` after an `import()`, which is a real
 * lazy chunk from an NgModule host.
 *
 * The background scene and this one share nothing but the library. Two scenes,
 * two contexts, two disposal paths — a single shared renderer would mean the
 * inspector could not be torn down without taking the background with it.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * NGZONE
 * ═════════════════════════════════════════════════════════════════════════════
 * The render loop and the drag handlers run outside Angular. Nothing in the
 * loop writes state a template reads: the overlay's chrome is static once open,
 * so 60 change-detection passes a second would buy exactly nothing.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';

import { TranslationService } from '../../translation.service';
import { ForgeEffectsService } from '../forge-scene/forge-effects.service';
import { type EntityPresentation } from '../entity/entity.model';
import { Inspect3dService } from './inspect-3d.service';
import { CARD, effectsFor, tierOfRarityId, type RarityEffects } from './inspect-3d.model';
import { paintFront, paintBack } from './card-face';

type Three = typeof import('three');

/** Camera. Close enough that the card fills the frame, far enough to feel 3D. */
const CAM_Z = 6.4;
const FOV = 42;

/** Drag feel: how fast the card follows the finger, and how long it coasts. */
const DRAG_SENSITIVITY = 0.0075;
const SPIN_DAMPING = 0.94;
/** Seconds of stillness before the camera takes the wheel again. */
const IDLE_BEFORE_AUTOSPIN = 1.4;

const ORBIT_VERTEX = `
  uniform float uTime;
  uniform float uPointScale;
  uniform vec3  uColor;
  uniform float uPrismatic;
  uniform float uSpin;

  attribute vec3  aSeed;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aTilt;
  attribute float aSize;

  varying vec3  vColor;
  varying float vAlpha;

  // Standard hue rotation. Only reached when uPrismatic is 1, i.e. Singular.
  vec3 hue(float h) {
    vec3 k = vec3(1.0, 2.0 / 3.0, 1.0 / 3.0);
    vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0);
    return clamp(p - 1.0, 0.0, 1.0);
  }

  void main() {
    // Every orbiter is one angle on one tilted ellipse. No integration, no
    // state: the whole field is a function of uTime, so the CPU writes one
    // uniform per frame and the GPU does the rest.
    float ang = aSeed.x * 6.2831 + uTime * aSpeed * uSpin;
    vec3 p = vec3(cos(ang) * aRadius, sin(ang) * aRadius * 0.55, sin(ang) * aRadius * 0.75);

    float c = cos(aTilt);
    float s = sin(aTilt);
    p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    p.y += sin(uTime * 0.7 + aSeed.y * 6.2831) * 0.12;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPointScale / max(-mv.z, 0.1);

    vec3 tint = mix(uColor, vec3(1.0), aSeed.y * 0.45);
    vColor = mix(tint, hue(fract(aSeed.z + uTime * 0.12)), uPrismatic);
    // Dim on the far side of the orbit so the ring reads as a ring.
    vAlpha = 0.35 + 0.65 * smoothstep(-1.0, 1.0, cos(ang));
  }
`;

const ORBIT_FRAGMENT = `
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * 1.3, a * 0.85);
  }
`;

const RAY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RAY_FRAGMENT = `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    // Angular streaks with a radial falloff. Volumetric light without a
    // volume — a real god-ray pass would need a second render target and a
    // blur, which is the entire frame budget for one decoration.
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float a = atan(d.y, d.x);
    float streak = pow(abs(sin(a * 9.0 + uTime * 0.35)), 8.0)
                 + pow(abs(sin(a * 5.0 - uTime * 0.22)), 12.0) * 0.7;
    float fall = smoothstep(1.0, 0.05, r);
    float core = fall * fall * fall;
    float alpha = (streak * fall * 0.35 + core * 0.4) * uStrength;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

@Component({
  selector: 'app-inspect-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="i3"
      [attr.data-tier]="tier"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="place.accessibleName">
      <div class="i3__backdrop" (click)="close()" aria-hidden="true"></div>

      <canvas #canvas class="i3__canvas" aria-hidden="true"></canvas>

      <p class="i3__sr">{{ place.accessibleName }}</p>

      <p class="i3__hint" aria-hidden="true">{{ t('inspect.3d.hint') }}</p>

      <button type="button" class="i3__close" (click)="close()" [attr.aria-label]="t('inspect.close')">
        {{ t('inspect.close') }}
      </button>
    </div>
  `,
  styles: [`
    /* z-index one band above Quick Inspect: the inspector opens over the panel
       that launched it and the panel stays put behind it. */
    .i3 {
      position: fixed;
      inset: 0;
      /* Above Quick Inspect (--z-modal) and the drop toast (--z-toast), and
         deliberately below the cookie banner, which outranks everything on
         purpose: a consent choice must stay reachable behind any overlay. */
      z-index: 1400;
      display: grid;
      place-items: center;
    }

    .i3__backdrop {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, rgba(12, 6, 26, 0.82), rgba(3, 2, 8, 0.96));
      backdrop-filter: blur(9px);
      -webkit-backdrop-filter: blur(9px);
    }

    /* Singular only. The tier that is supposed to bend the screen gets the
       backdrop breathing through a hue rotation instead of a post-processing
       pass — an EffectComposer for one rarity would double the chunk. */
    .i3[data-tier='singular'] .i3__backdrop {
      animation: i3Warp 5.5s ease-in-out infinite;
    }
    @keyframes i3Warp {
      0%, 100% { filter: hue-rotate(0deg) blur(0px); }
      50%      { filter: hue-rotate(28deg) blur(1.4px); }
    }

    .i3__canvas {
      position: relative;
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
      cursor: grab;
    }
    .i3__canvas:active { cursor: grabbing; }

    .i3__hint {
      position: absolute;
      bottom: max(1.5rem, env(safe-area-inset-bottom));
      left: 0;
      right: 0;
      margin: 0;
      text-align: center;
      font-size: 0.74rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(226, 220, 245, 0.42);
      pointer-events: none;
    }

    .i3__close {
      position: absolute;
      top: max(1rem, env(safe-area-inset-top));
      right: 1rem;
      min-width: 44px;
      min-height: 44px;
      padding: 0.4rem 0.9rem;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(10, 6, 22, 0.6);
      color: #ece7ff;
      font: inherit;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      cursor: pointer;
    }
    .i3__close:focus-visible { outline: 2px solid #ffb347; outline-offset: 3px; }

    .i3__sr {
      position: absolute;
      width: 1px; height: 1px;
      margin: -1px; padding: 0;
      overflow: hidden; clip-path: inset(50%);
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .i3[data-tier='singular'] .i3__backdrop { animation: none; }
    }
  `],
})
export class Inspect3dComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(TranslationService);
  private readonly effects = inject(ForgeEffectsService);
  private readonly inspect3d = inject(Inspect3dService);

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  /** Set by the outlet before the view initialises. Never null while mounted. */
  place!: EntityPresentation;

  get tier(): string { return tierOfRarityId(this.place?.rarity?.id); }

  private three: Three | null = null;
  private renderer: import('three').WebGLRenderer | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').PerspectiveCamera | null = null;
  private rig: import('three').Group | null = null;

  private textures: Array<import('three').Texture> = [];
  private geometries: Array<import('three').BufferGeometry> = [];
  private materials: Array<import('three').Material> = [];
  private uniformClocks: Array<{ value: number }> = [];
  private orbitMaterial: import('three').ShaderMaterial | null = null;

  private frame = 0;
  private running = false;
  private startedAt = 0;
  private teardown: Array<() => void> = [];

  /** Drag state, in the rig's own radians. */
  private spinY = 0;
  private spinX = 0;
  private velY = 0;
  private velX = 0;
  private dragging = false;
  private lastPointer: [number, number] = [0, 0];
  private lastInputAt = 0;

  private fx: RarityEffects = effectsFor('mortal', false);

  t(key: string): string { return this.i18n.translate(key); }
  close(): void { this.inspect3d.close(); }

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.effects.webglSupported()) {
      // No context, nothing to show. Quick Inspect is still open behind this,
      // so closing puts the visitor back on the 2D card rather than nowhere.
      this.close();
      return;
    }
    try {
      const THREE = this.three = await import('three');
      if (!this.canvasRef) return;            // closed while the chunk loaded
      this.build(THREE, canvas);
      this.bind(canvas);
      this.start();
    } catch {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const off of this.teardown) off();
    this.teardown = [];

    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.textures = [];
    this.geometries = [];
    this.materials = [];

    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.rig = null;
  }

  // ── build ──────────────────────────────────────────────────────────────────

  private build(THREE: Three, canvas: HTMLCanvasElement): void {
    this.fx = effectsFor(tierOfRarityId(this.place.rarity?.id), this.effects.coarsePointer);
    const rarity = this.place.rarity?.color ?? '#e8ecf1';
    const color = new THREE.Color(rarity);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !this.effects.coarsePointer,
      powerPreference: 'low-power',
    });
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
    this.camera.position.z = CAM_Z;

    // Everything that turns lives on the rig, so one rotation drives the card,
    // its halo and its tendrils together and the orbit rings stay level.
    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    // Deliberately dim. The card's faces are painted near-black on purpose —
    // they are a void with a rarity glow, not a photograph — and lighting them
    // to a comfortable exposure turns the whole thing mid-grey. The rarity's
    // own point lights carry most of the modelling; the key exists only to
    // stop the card from being flat.
    this.scene.add(new THREE.AmbientLight(0x4a4266, 0.32));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(-2.4, 3.2, 4.5);
    this.scene.add(key);
    const rim = new THREE.PointLight(color, 14 * this.fx.glow, 22);
    rim.position.set(1.8, -1.2, -3.2);
    this.scene.add(rim);
    const fill = new THREE.PointLight(color, 6 * this.fx.glow, 18);
    fill.position.set(-2.6, 1.4, 2.6);
    this.scene.add(fill);

    this.buildCard(THREE, color);
    if (this.fx.orbiters > 0) this.rig.add(this.buildOrbiters(THREE, color));
    if (this.fx.rays) this.scene.add(this.buildRays(THREE, color));
    if (this.fx.tendrils) this.rig.add(this.buildTendrils(THREE, color));

    this.resize();
  }

  private buildCard(THREE: Three, color: import('three').Color): void {
    const tex = (canvas: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
      this.textures.push(t);
      return t;
    };

    const frontTex = tex(paintFront(this.place, () => { frontTex.needsUpdate = true; }));
    const backTex = tex(paintBack(this.place, this.t('inspect.3d.stats')));

    const face = (map: import('three').Texture) => {
      const m = new THREE.MeshStandardMaterial({
        map,
        roughness: 0.62,
        metalness: 0.08,
        emissive: color,
        emissiveIntensity: 0.10 * this.fx.glow,
      });
      this.materials.push(m);
      return m;
    };

    // The edge. Constant-colour and unlit on purpose: this is the light the
    // card emits, and a shaded edge would go dark exactly when it turns away
    // from the key light, which is the moment it should be brightest.
    const edge = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.55 + 0.45 * this.fx.glow) });
    this.materials.push(edge);

    const geometry = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth);
    this.geometries.push(geometry);

    // Box material order is [+x, -x, +y, -y, +z, -z]: sides, sides, front, back.
    const card = new THREE.Mesh(geometry, [edge, edge, edge, edge, face(frontTex), face(backTex)]);

    if (this.fx.warp) this.applyWarp(card.material as import('three').Material[]);

    // The halo: the same box, grown, drawn from the inside, additive. A cheap
    // bloom that costs one extra draw instead of a post-processing pass.
    const haloGeo = new THREE.BoxGeometry(CARD.width + 0.34, CARD.height + 0.34, CARD.depth + 0.34);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.10 * this.fx.glow,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.geometries.push(haloGeo);
    this.materials.push(haloMat);

    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(1, 0.5 + 0.5 * this.fx.glow),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.geometries.push(edgesGeo);
    this.materials.push(edgesMat);

    this.rig!.add(card, new THREE.Mesh(haloGeo, haloMat), new THREE.LineSegments(edgesGeo, edgesMat));
  }

  /**
   * Singular's surface will not stay flat.
   *
   * `onBeforeCompile` rather than a bespoke material: the card still wants all
   * of MeshStandardMaterial's lighting, and reimplementing that to add eight
   * lines of displacement would be the worst trade in the file. The clock is
   * pushed into `uniformClocks` so the loop can advance every injected shader
   * without knowing which materials got one.
   */
  private applyWarp(materials: import('three').Material[]): void {
    for (const material of materials) {
      const std = material as import('three').MeshStandardMaterial;
      if (!('onBeforeCompile' in std)) continue;
      const clock = { value: 0 };
      this.uniformClocks.push(clock);
      std.onBeforeCompile = (shader) => {
        shader.uniforms['uWarp'] = clock;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'uniform float uWarp;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             transformed.z += sin(transformed.y * 2.6 + uWarp * 1.7) * 0.055
                            * cos(transformed.x * 2.1 - uWarp * 1.1);`,
          );
      };
      std.needsUpdate = true;
    }
  }

  private buildOrbiters(THREE: Three, color: import('three').Color): import('three').Points {
    const n = this.fx.orbiters;
    const position = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3);
    const radius = new Float32Array(n);
    const speed = new Float32Array(n);
    const tilt = new Float32Array(n);
    const size = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      seed[i * 3] = Math.random();
      seed[i * 3 + 1] = Math.random();
      seed[i * 3 + 2] = Math.random();
      radius[i] = 1.9 + Math.random() * 1.5;
      speed[i] = 0.25 + Math.random() * 0.6;
      tilt[i] = (Math.random() - 0.5) * 2.2;
      size[i] = 0.02 + Math.random() * 0.05;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geometry.setAttribute('aTilt', new THREE.BufferAttribute(tilt, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geometries.push(geometry);

    const material = new THREE.ShaderMaterial({
      vertexShader: ORBIT_VERTEX,
      fragmentShader: ORBIT_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPointScale: { value: 400 },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        uPrismatic: { value: this.fx.prismatic ? 1 : 0 },
        uSpin: { value: this.effects.motionless ? 0 : 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(material);
    this.orbitMaterial = material;

    const points = new THREE.Points(geometry, material);
    // Positions are computed in the shader, so three's bounding sphere is a
    // point at the origin and would cull the whole ring the moment it turned.
    points.frustumCulled = false;
    return points;
  }

  private buildRays(THREE: Three, color: import('three').Color): import('three').Mesh {
    const geometry = new THREE.PlaneGeometry(9, 9);
    const material = new THREE.ShaderMaterial({
      vertexShader: RAY_VERTEX,
      fragmentShader: RAY_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        uStrength: { value: 0.42 * this.fx.glow },
      },
      transparent: true,
      depthWrite: false,
      // depthTest stays ON, and that is the whole trick. Three draws every
      // transparent object after every opaque one regardless of renderOrder, so
      // a depth-test-free ray plane "behind" the card paints straight through
      // it and turns the artwork into fog. With the test on, the card's own
      // depth clips the rays and they only escape around its edges — which is
      // what a light source behind a solid object actually looks like.
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.geometries.push(geometry);
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -2.6;
    return mesh;
  }

  /**
   * Singular's tendrils: five tubes on random Catmull-Rom loops.
   *
   * Real geometry rather than lines because `LineBasicMaterial` ignores
   * `linewidth` on every platform that matters, so a line tendril is one pixel
   * wide and invisible against the halo.
   */
  private buildTendrils(THREE: Three, color: import('three').Color): import('three').Group {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.materials.push(material);

    // Helices, not random loops. Seven points through a Catmull-Rom with random
    // positions makes a scribble — it reads as wire someone drew, not as energy
    // climbing the card. A spiral whose radius breathes as it rises does read as
    // energy, and it is the same vertex count.
    const SEGMENTS = 26;
    const STRANDS = 4;
    for (let i = 0; i < STRANDS; i++) {
      const points: Array<import('three').Vector3> = [];
      const phase = (i / STRANDS) * Math.PI * 2;
      const turns = 1.5 + (i % 3) * 0.35;
      for (let k = 0; k <= SEGMENTS; k++) {
        const u = k / SEGMENTS;
        const a = u * Math.PI * 2 * turns + phase;
        const r = 1.45 + Math.sin(u * Math.PI * 3 + i) * 0.28;
        points.push(new THREE.Vector3(
          Math.cos(a) * r,
          -1.85 + u * 3.7,
          Math.sin(a) * r * 0.72,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(points, false);
      const geometry = new THREE.TubeGeometry(curve, 72, 0.009, 4, false);
      this.geometries.push(geometry);
      const tube = new THREE.Mesh(geometry, material);
      tube.userData['drift'] = 0.05 + i * 0.028;
      group.add(tube);
    }
    return group;
  }

  // ── loop ───────────────────────────────────────────────────────────────────

  private start(): void {
    this.startedAt = performance.now();
    this.lastInputAt = performance.now();
    this.running = true;
    if (this.effects.motionless) {
      // Static end state: one frame, at a three-quarter angle so the card still
      // reads as an object with depth rather than as a flat picture.
      this.running = false;
      this.spinY = 0.5;
      this.spinX = -0.16;
      this.render();
      return;
    }
    this.zone.runOutsideAngular(() => { this.frame = requestAnimationFrame(this.tick); });
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    if (!this.dragging) {
      this.spinY += this.velY;
      this.spinX += this.velX;
      this.velY *= SPIN_DAMPING;
      this.velX *= SPIN_DAMPING;
      // Auto-rotate only once the coast has died and the visitor has stopped.
      const idle = (performance.now() - this.lastInputAt) / 1000;
      if (idle > IDLE_BEFORE_AUTOSPIN && Math.abs(this.velY) < 0.0006) {
        this.spinY += this.fx.spin * 0.016;
      }
      // Let the card fall back level. Nobody wants to hand-correct a tilt.
      this.spinX *= 0.985;
    }
    this.render();
  };

  private render(): void {
    const { renderer, scene, camera, rig } = this;
    if (!renderer || !scene || !camera || !rig) return;
    const t = (performance.now() - this.startedAt) / 1000;

    rig.rotation.y = this.spinY;
    rig.rotation.x = Math.max(-0.7, Math.min(0.7, this.spinX));

    if (this.orbitMaterial) this.orbitMaterial.uniforms['uTime'].value = t;
    for (const clock of this.uniformClocks) clock.value = t;
    scene.traverse(obj => {
      const drift = obj.userData['drift'];
      if (typeof drift === 'number') obj.rotation.y = t * drift;
      const mat = (obj as import('three').Mesh).material as import('three').ShaderMaterial | undefined;
      if (mat && 'uniforms' in mat && mat.uniforms['uTime'] && mat !== this.orbitMaterial) {
        mat.uniforms['uTime'].value = t;
      }
    });

    renderer.render(scene, camera);
  }

  // ── input ──────────────────────────────────────────────────────────────────

  private bind(canvas: HTMLCanvasElement): void {
    this.zone.runOutsideAngular(() => {
      const on = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
        target.addEventListener(type, fn, opts);
        this.teardown.push(() => target.removeEventListener(type, fn, opts));
      };

      on(canvas, 'pointerdown', (e) => {
        const pe = e as PointerEvent;
        this.dragging = true;
        this.lastPointer = [pe.clientX, pe.clientY];
        this.lastInputAt = performance.now();
        this.velY = this.velX = 0;
        canvas.setPointerCapture(pe.pointerId);
      });

      on(canvas, 'pointermove', (e) => {
        if (!this.dragging) return;
        const pe = e as PointerEvent;
        const dx = pe.clientX - this.lastPointer[0];
        const dy = pe.clientY - this.lastPointer[1];
        this.lastPointer = [pe.clientX, pe.clientY];
        this.lastInputAt = performance.now();
        this.spinY += dx * DRAG_SENSITIVITY;
        this.spinX += dy * DRAG_SENSITIVITY;
        // Velocity carried out of the drag is what makes a flick feel physical.
        this.velY = dx * DRAG_SENSITIVITY;
        this.velX = dy * DRAG_SENSITIVITY;
      });

      const release = (e: Event) => {
        if (!this.dragging) return;
        this.dragging = false;
        this.lastInputAt = performance.now();
        const pe = e as PointerEvent;
        try { canvas.releasePointerCapture(pe.pointerId); } catch { /* already gone */ }
      };
      on(canvas, 'pointerup', release);
      on(canvas, 'pointercancel', release);

      on(window, 'resize', () => this.resize(), { passive: true });
      on(document, 'visibilitychange', () => {
        // Pause while hidden. The inspector survives a tab switch, and a
        // paused card is the same card when the visitor comes back.
        if (document.hidden) {
          this.running = false;
          if (this.frame) cancelAnimationFrame(this.frame);
          this.frame = 0;
        } else if (!this.running && !this.effects.motionless) {
          this.running = true;
          this.frame = requestAnimationFrame(this.tick);
        }
      });
    });
  }

  private resize(): void {
    const { renderer, camera } = this;
    const canvas = this.canvasRef?.nativeElement;
    if (!renderer || !camera || !canvas) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on a portrait phone so a 3.4-unit card still fits the frame.
    camera.position.z = CAM_Z * (camera.aspect < 0.8 ? 1.45 : 1);
    camera.updateProjectionMatrix();

    if (this.orbitMaterial && this.three) {
      const buffer = renderer.getDrawingBufferSize(new this.three.Vector2());
      this.orbitMaterial.uniforms['uPointScale'].value =
        buffer.y / (2 * Math.tan((FOV * Math.PI) / 360));
    }
    if (!this.running) this.render();
  }
}
