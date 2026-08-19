/**
 * forge-effects.service.ts — the one place that answers "may we run WebGL?".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOUR GATES, ONE ANSWER
 * ─────────────────────────────────────────────────────────────────────────────
 * The 3D background is the single most expensive thing on the site, so four
 * separate things are allowed to switch it off, and they are deliberately
 * collapsed into one boolean rather than being re-checked at each call site:
 *
 *   1. the server            — there is no canvas during prerender
 *   2. the visitor's choice  — the Reduce Effects toggle, persisted
 *   3. embed mode            — an iframed tool never gets a cinematic backdrop
 *   4. WebGL itself          — no context, no scene, fall back to the CSS one
 *
 * `prefers-reduced-motion` is deliberately NOT one of them. Per the house rule,
 * a reduced-motion visitor gets a *static end state*, not nothing: the scene
 * still renders, once, with every animation clock frozen. That is a nicer thing
 * to look at than the flat wash, and it is genuinely free — one frame, then the
 * loop stops. `motionless` carries that signal separately.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE CAPABILITY PROBE IS CACHED
 * ─────────────────────────────────────────────────────────────────────────────
 * Creating a throwaway WebGL context to ask whether WebGL exists costs a real
 * GPU allocation, and browsers cap the number of live contexts (16 on most
 * builds) — losing one to a probe on every subscription is how the scene ends
 * up unable to create the context it actually wants.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

/** localStorage key. Owned here; nothing else may write it. */
const PREF_KEY = 'gf-reduce-effects';

@Injectable({ providedIn: 'root' })
export class ForgeEffectsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly reduced$$ = new BehaviorSubject<boolean>(this.readPref());
  /** True when the visitor has asked for the cheap background. */
  readonly reduced$: Observable<boolean> = this.reduced$$.asObservable();

  private webglProbe: boolean | null = null;

  get reduced(): boolean { return this.reduced$$.value; }

  /**
   * Whether the WebGL scene should mount at all.
   *
   * Embed mode is passed in rather than injected: EmbedService reads the URL,
   * and a service this low in the graph having an opinion about routing is how
   * a circular dependency starts.
   */
  shouldRender(opts: { embed: boolean }): boolean {
    if (!this.isBrowser) return false;
    if (opts.embed) return false;
    if (this.reduced) return false;
    return this.webglSupported();
  }

  /** True when every clock in the scene must stay at zero. */
  get motionless(): boolean {
    if (!this.isBrowser) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  /** True on phones and anything else without a fine pointer. */
  get coarsePointer(): boolean {
    if (!this.isBrowser) return false;
    try {
      return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch {
      return false;
    }
  }

  setReduced(value: boolean): void {
    if (value === this.reduced) return;
    this.reduced$$.next(value);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(PREF_KEY, value ? '1' : '0');
    } catch {
      /* private mode — the choice holds for this session and no longer */
    }
  }

  toggle(): void { this.setReduced(!this.reduced); }

  /**
   * One probe per page load, cached both ways.
   *
   * The context is explicitly released via WEBGL_lose_context: without it the
   * probe holds a live context for as long as the canvas is reachable, and the
   * scene's own context creation is the thing that pays for it.
   */
  webglSupported(): boolean {
    if (!this.isBrowser) return false;
    if (this.webglProbe !== null) return this.webglProbe;
    this.webglProbe = false;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (gl) {
        this.webglProbe = true;
        const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
        lose?.loseContext();
      }
    } catch {
      this.webglProbe = false;
    }
    return this.webglProbe;
  }

  /**
   * Read once, at construction.
   *
   * Guarded on `typeof localStorage` rather than on `isBrowser`: this runs from
   * a field initialiser, which TypeScript orders before the constructor body
   * but which Angular still evaluates inside the injection context, so the
   * `isBrowser` field above is already assigned — but a Node prerender has no
   * `localStorage` binding at all, and the typeof check is the only form that
   * does not throw a ReferenceError there.
   */
  private readPref(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(PREF_KEY) === '1';
    } catch {
      return false;
    }
  }
}
