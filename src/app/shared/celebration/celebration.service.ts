/**
 * celebration.service.ts — the screen-level payoff for a good drop.
 *
 * One entry point, `celebrate(tier, origin?)`. Everything downstream of it is
 * read out of `TIER_FX`, so tuning how loud a Legendary is means editing a
 * number in the model and nothing here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE LAYER IS APPENDED TO <body> AND NOT AUTHORED IN A COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * `router-outlet + *` carries a transform from routeFadeIn, which makes every
 * routed page a containing block. A `position: fixed` layer authored inside the
 * Rune Forge — or inside any routed component — is laid out against that page's
 * box, not against the viewport, and lands in the wrong place at the wrong size
 * whatever its z-index says. The Godforge loader, the Forge Flame and the quest
 * drawer are all siblings of <main> for exactly this reason. A service that
 * appends to <body> gets the same guarantee without needing a component, and it
 * can be called from the Rune Forge, the Flame, the Gambler and the crafting
 * bench without any of them hosting markup they do not otherwise need.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE MARKUP IS BUILT HERE AND THE CSS LIVES IN styles.css
 * ─────────────────────────────────────────────────────────────────────────────
 * These nodes are created with `document.createElement`, so they never receive
 * an `_ngcontent-*` attribute. Any rule written in a component stylesheet with
 * emulated encapsulation would be rewritten to require that attribute and would
 * silently match nothing — the failure mode that ate the hero carousel for a
 * release. Everything these nodes need is therefore top-level in styles.css,
 * under the `.gf-fx*` prefix, and none of it is nested inside a media query
 * that would leave an `animation:` shorthand pointing at a name Angular has
 * renamed out from under it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEANUP
 * ─────────────────────────────────────────────────────────────────────────────
 * Every run gets a token. A second celebration cancels the first outright —
 * removes its layer, clears its timers, drops its <html> flags — rather than
 * layering on top of it. Ten strikes in ten seconds should look like ten
 * celebrations, not like one that never ended. The root layer is removed on a
 * single timer keyed off `fx.duration`, so a thrown exception inside one effect
 * cannot leave a fixed overlay pinned over the page.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

import { RUNE_TIERS, type RuneTier } from '../rune-forge/rune.model';
import { ForgeSceneService } from '../forge-scene/forge-scene.service';
import { CelebrationAudioService } from './celebration-audio.service';
import {
  celebrates,
  fxFor,
  scaleFx,
  type FxBudget,
  type TierFx,
} from './celebration.model';

/** Where the effect radiates from, in viewport pixels. */
interface Origin { x: number; y: number }

@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly scene = inject(ForgeSceneService);
  private readonly audio = inject(CelebrationAudioService);

  /** The one fixed layer every effect is built inside. Null between runs. */
  private layer: HTMLElement | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Bumped per run; a stale timer that wakes up compares and gives up. */
  private run = 0;
  /** An element belonging to someone else's template that we put a class on. */
  private jolted: HTMLElement | null = null;

  /**
   * Celebrate a drop.
   *
   * `origin` is the element the thing came out of — the reveal card, the box,
   * the anvil. Effects radiate from its centre when it is on screen and from the
   * centre of the viewport when it is not, which is what makes the same call
   * work from the Rune Forge's centred dialog and from the Flame's corner.
   *
   * Safe to call unconditionally: it is a no-op on the server, a no-op for
   * Common, and it never throws into the caller.
   */
  celebrate(tier: RuneTier, origin?: Element | null): void {
    if (!this.isBrowser) return;
    if (!celebrates(tier)) return;

    const fx = scaleFx(fxFor(tier), this.budget());
    if (fx.duration <= 0) return;

    const token = ++this.run;
    this.teardown();

    // Sound is not motion and does not need the frame, so it goes first — a
    // cue that waits for a rAF lands audibly late against its own flash.
    this.audio.play(fx.sound);
    this.reactScene(fx, origin);

    // The whole of the DOM work runs outside Angular. None of it is bound to
    // anything and all of it is removed again; letting it schedule change
    // detection would be a hundred pointless passes per Singular.
    this.zone.runOutsideAngular(() => {
      try {
        this.build(fx, this.originOf(origin), origin ?? null, token);
      } catch {
        // A celebration that throws must not take the drop down with it — the
        // rune is already banked and the card is already on screen.
        this.teardown();
      }
    });
  }

  /**
   * Whether this tier's name should be typed out a letter at a time.
   *
   * Asked of the service rather than read off `TIER_FX` at the call site,
   * because the answer depends on the budget: reduced motion drops the letters
   * along with everything else that moves, and a component reading the raw
   * table would have typed a Singular's name out character by character at
   * exactly the visitor who asked for less of that. One place knows about the
   * budget, and this is it.
   */
  letters(tier: RuneTier): boolean {
    if (!this.isBrowser || !celebrates(tier)) return false;
    return scaleFx(fxFor(tier), this.budget()).letters;
  }

  /** What the device and the visitor's stated preferences allow. */
  private budget(): FxBudget {
    const win = this.doc.defaultView;
    return {
      reduced: win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      narrow: (win?.innerWidth ?? 1024) < 768,
      coarse: win?.matchMedia?.('(pointer: coarse)').matches ?? false,
    };
  }

  private originOf(el?: Element | null): Origin {
    const win = this.doc.defaultView;
    const w = win?.innerWidth ?? 1024;
    const h = win?.innerHeight ?? 768;
    const centre = { x: w / 2, y: h / 2 };
    if (!el) return centre;
    const r = el.getBoundingClientRect();
    // A zero box is a hidden element; a box entirely off screen is one that
    // scrolled away. Both should radiate from the middle rather than from a
    // corner the player is not looking at.
    if (r.width === 0 && r.height === 0) return centre;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > w || y > h) return centre;
    return { x, y };
  }

  // ── Assembly ───────────────────────────────────────────────────────────────

  private build(fx: TierFx, origin: Origin, originEl: Element | null, token: number): void {
    const tier = RUNE_TIERS[fx.tier];
    const layer = this.doc.createElement('div');
    layer.className = 'gf-fx';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset['tier'] = fx.tier;
    // The colour every child reads. Set once here rather than per node so a
    // hundred shower specks are one custom-property lookup, not a hundred
    // inline style strings.
    layer.style.setProperty('--fx-color', tier.color);
    layer.style.setProperty('--fx-glow', tier.glow);
    layer.style.setProperty('--fx-x', `${origin.x}px`);
    layer.style.setProperty('--fx-y', `${origin.y}px`);
    this.doc.body.appendChild(layer);
    this.layer = layer;

    // Appended in paint order, back to front. The dark is first so every light
    // effect paints over it rather than under it — black over a gold explosion
    // is a bug, gold over black is the effect. The crack is last because it is
    // the thing a Singular is *about*; anything drawn after it would be
    // drawn over a broken screen.
    if (fx.blackout) this.blackout(layer, fx);
    if (fx.flash) this.flash(layer, fx);
    if (fx.wave) this.wave(layer, fx);
    if (fx.beams) this.beams(layer, fx);
    if (fx.particles) this.particles(layer, fx);
    if (fx.shower) this.shower(layer, fx);
    if (fx.lightning) this.lightning(layer, fx, origin);
    if (fx.crack) this.crack(layer, fx);
    if (fx.shake) this.shake(fx, originEl);
    if (fx.distort) this.distort(fx);
    if (fx.timeScale > 1) this.slowmo(fx);

    // The one guaranteed teardown. Everything above is decoration on top of it.
    this.later(() => { if (this.run === token) this.teardown(); }, fx.duration);
  }

  /**
   * The screen goes dark, holds, and lets go.
   *
   * Ordered first among the children so it sits *under* the light that follows
   * it: painting black over a gold explosion is a bug, painting gold over black
   * is the effect. `hold` is the part that does the work — a fade with no hold
   * reads as a flicker, and Singular's 500ms hold is the longest deliberate
   * nothing on the site.
   */
  private blackout(layer: HTMLElement, fx: TierFx): void {
    const { fade, hold } = fx.blackout!;
    const el = this.doc.createElement('div');
    el.className = 'gf-fx__dark';
    el.style.setProperty('--fx-in', `${fade}ms`);
    el.style.setProperty('--fx-out', `${fade}ms`);
    // The fade-out's delay, not the hold on its own: it starts once the screen
    // has finished going dark and then stayed dark for `hold`.
    el.style.setProperty('--fx-hold', `${fade + hold}ms`);
    layer.appendChild(el);
  }

  /** A vignette in the tier colour: bright at the edges, clear in the middle so
   *  the card — the thing actually being read — is never washed out. */
  private flash(layer: HTMLElement, fx: TierFx): void {
    const el = this.doc.createElement('div');
    el.className = 'gf-fx__flash';
    el.style.setProperty('--fx-dur', `${fx.flash!.duration}ms`);
    el.style.setProperty('--fx-peak', String(fx.flash!.opacity));
    el.style.setProperty('--fx-delay', `${this.payoffAt(fx)}ms`);
    layer.appendChild(el);
  }

  /** Rings off the card. Each one starts a beat behind the last, so three rings
   *  read as a wavefront rather than as a thick line. */
  private wave(layer: HTMLElement, fx: TierFx): void {
    const { rings, duration } = fx.wave!;
    const wrap = this.doc.createElement('div');
    wrap.className = 'gf-fx__waves';
    for (let i = 0; i < rings; i++) {
      const ring = this.doc.createElement('span');
      ring.className = 'gf-fx__ring';
      ring.style.setProperty('--fx-dur', `${duration}ms`);
      ring.style.setProperty('--fx-delay', `${this.payoffAt(fx) + i * 160}ms`);
      wrap.appendChild(ring);
    }
    layer.appendChild(wrap);
  }

  /**
   * Light beams out of the card, evenly spread around the circle.
   *
   * Each beam gets its own rotation and its own duration jitter. Identical
   * beams read as a printed sunburst; a few percent of variance is what makes
   * it read as light.
   */
  private beams(layer: HTMLElement, fx: TierFx): void {
    const { count, duration, prismatic } = fx.beams!;
    const wrap = this.doc.createElement('div');
    wrap.className = 'gf-fx__beams';
    if (prismatic) wrap.classList.add('gf-fx__beams--prism');
    wrap.style.setProperty('--fx-delay', `${this.payoffAt(fx)}ms`);
    for (let i = 0; i < count; i++) {
      const beam = this.doc.createElement('span');
      beam.className = 'gf-fx__beam';
      beam.style.setProperty('--fx-rot', `${(360 / count) * i + (Math.random() - 0.5) * 10}deg`);
      beam.style.setProperty('--fx-dur', `${duration * (0.85 + Math.random() * 0.3)}ms`);
      beam.style.setProperty('--fx-i', String(i));
      wrap.appendChild(beam);
    }
    layer.appendChild(wrap);
  }

  /**
   * A radial burst of specks from the card.
   *
   * Direction and distance are baked into custom properties and the animation
   * is a single translate to `--fx-dx/--fx-dy`, so sixty specks are sixty
   * composited transforms and zero layout. `Math.sqrt` on the radius keeps the
   * distribution even across the disc instead of clustering at the centre,
   * which is what a raw `Math.random() * spread` gives you.
   */
  private particles(layer: HTMLElement, fx: TierFx): void {
    const { count, spread, duration } = fx.particles!;
    const wrap = this.doc.createElement('div');
    wrap.className = 'gf-fx__burst';
    const at = this.payoffAt(fx);
    for (let i = 0; i < count; i++) {
      const p = this.doc.createElement('span');
      p.className = 'gf-fx__speck';
      const angle = Math.random() * Math.PI * 2;
      const dist = spread * (0.35 + Math.sqrt(Math.random()) * 0.65);
      p.style.setProperty('--fx-dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--fx-dy', `${Math.sin(angle) * dist}px`);
      p.style.setProperty('--fx-size', `${2 + Math.random() * 4}px`);
      p.style.setProperty('--fx-dur', `${duration * (0.6 + Math.random() * 0.55)}ms`);
      p.style.setProperty('--fx-delay', `${at + Math.random() * 140}ms`);
      wrap.appendChild(p);
    }
    layer.appendChild(wrap);
  }

  /** Motes falling from above the fold. Scattered in start time as well as in
   *  x, because forty specks released together is a curtain, not a shower. */
  private shower(layer: HTMLElement, fx: TierFx): void {
    const { count, duration } = fx.shower!;
    const wrap = this.doc.createElement('div');
    wrap.className = 'gf-fx__shower';
    const at = this.payoffAt(fx);
    for (let i = 0; i < count; i++) {
      const p = this.doc.createElement('span');
      p.className = 'gf-fx__mote';
      p.style.setProperty('--fx-left', `${Math.random() * 100}%`);
      p.style.setProperty('--fx-drift', `${(Math.random() - 0.5) * 120}px`);
      p.style.setProperty('--fx-size', `${2 + Math.random() * 5}px`);
      p.style.setProperty('--fx-dur', `${duration * (0.55 + Math.random() * 0.6)}ms`);
      p.style.setProperty('--fx-delay', `${at + Math.random() * (duration * 0.5)}ms`);
      wrap.appendChild(p);
    }
    layer.appendChild(wrap);
  }

  /**
   * Bolts cracking in from the edges toward the card.
   *
   * One <svg> holding every bolt rather than one per bolt: a single element with
   * a single filter is one offscreen buffer for the glow, where six would be
   * six. The paths are generated as jagged polylines from a random edge point
   * to the origin and animated by running `stroke-dashoffset` to zero, which is
   * the only way to draw a line on rather than fade it in.
   *
   * Dropped entirely below 768px by `scaleFx` — see the note there.
   */
  private lightning(layer: HTMLElement, fx: TierFx, origin: Origin): void {
    const win = this.doc.defaultView;
    const w = win?.innerWidth ?? 1024;
    const h = win?.innerHeight ?? 768;
    const { bolts, duration } = fx.lightning!;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = this.doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gf-fx__bolts');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const at = this.payoffAt(fx);
    for (let i = 0; i < bolts; i++) {
      const start = this.edgePoint(w, h);
      const d = this.boltPath(start, origin);
      const path = this.doc.createElementNS(NS, 'path');
      path.setAttribute('class', 'gf-fx__bolt');
      path.setAttribute('d', d);
      // The dash length has to exceed the path length or the tail never clears
      // the start point. The straight-line distance is a floor for the jagged
      // length, so tripling it is a cheap, safe upper bound — measuring with
      // getTotalLength() would force layout once per bolt.
      const span = Math.hypot(origin.x - start.x, origin.y - start.y) * 3;
      path.style.setProperty('--fx-len', String(Math.round(span)));
      path.style.setProperty('--fx-dur', `${duration * (0.6 + Math.random() * 0.5)}ms`);
      path.style.setProperty('--fx-delay', `${at + i * 90 + Math.random() * 120}ms`);
      svg.appendChild(path);
    }
    layer.appendChild(svg);
  }

  /** A point on a random edge of the viewport. */
  private edgePoint(w: number, h: number): Origin {
    switch (Math.floor(Math.random() * 4)) {
      case 0: return { x: Math.random() * w, y: -20 };
      case 1: return { x: w + 20, y: Math.random() * h };
      case 2: return { x: Math.random() * w, y: h + 20 };
      default: return { x: -20, y: Math.random() * h };
    }
  }

  /**
   * A jagged polyline from `from` to `to`.
   *
   * Six segments, each pushed off the straight line by up to 9% of the run in
   * the perpendicular direction. Perpendicular rather than axis-aligned so a
   * bolt coming in from the left zig-zags across its own path rather than
   * wobbling vertically, which is what makes it look struck instead of drawn.
   */
  private boltPath(from: Origin, to: Origin): string {
    const segs = 6;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const run = Math.hypot(dx, dy) || 1;
    const nx = -dy / run;
    const ny = dx / run;

    let d = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      // Taper the jitter to nothing at the target so every bolt actually lands
      // on the card rather than near it.
      const jitter = (Math.random() - 0.5) * run * 0.18 * (1 - t);
      const x = from.x + dx * t + nx * jitter;
      const y = from.y + dy * t + ny * jitter;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }

  /**
   * The screen breaks and the rune is inside the break. Singular only.
   *
   * Radial cracks from the origin outward, drawn the same way the bolts are.
   * Held with `forwards` for the whole run rather than faded, because the
   * conceit is that the screen is *broken* — a crack that heals in a second was
   * never a crack.
   */
  private crack(layer: HTMLElement, fx: TierFx): void {
    const win = this.doc.defaultView;
    const w = win?.innerWidth ?? 1024;
    const h = win?.innerHeight ?? 768;
    const origin = {
      x: parseFloat(layer.style.getPropertyValue('--fx-x')) || w / 2,
      y: parseFloat(layer.style.getPropertyValue('--fx-y')) || h / 2,
    };

    const NS = 'http://www.w3.org/2000/svg';
    const svg = this.doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gf-fx__crack');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    // The first fissure alone for 300ms, then the rest spread out of it. One
    // crack that becomes many is breaking glass; nine at once is a spider web
    // someone drew.
    const spokes = 9;
    const reach = Math.hypot(w, h);
    for (let i = 0; i < spokes; i++) {
      const angle = (Math.PI * 2 / spokes) * i + Math.random() * 0.35;
      const end = {
        x: origin.x + Math.cos(angle) * reach,
        y: origin.y + Math.sin(angle) * reach,
      };
      const path = this.doc.createElementNS(NS, 'path');
      path.setAttribute('class', 'gf-fx__fissure');
      path.setAttribute('d', this.boltPath(origin, end));
      path.style.setProperty('--fx-len', String(Math.round(reach * 2)));
      path.style.setProperty('--fx-dur', `${900 + Math.random() * 500}ms`);
      path.style.setProperty('--fx-delay', `${this.payoffAt(fx) + (i === 0 ? 0 : 300 + i * 55)}ms`);
      svg.appendChild(path);
    }
    layer.appendChild(svg);

    // Void energy pouring out of the break.
    const pour = this.doc.createElement('div');
    pour.className = 'gf-fx__pour';
    pour.style.setProperty('--fx-delay', `${this.payoffAt(fx) + 260}ms`);
    pour.style.setProperty('--fx-dur', `${fx.duration - this.payoffAt(fx) - 260}ms`);
    layer.appendChild(pour);
  }

  /**
   * Shake — the background and the card, never the document.
   *
   * The obvious implementation is a transform on <html>, and it is wrong here.
   * A transformed element becomes the containing block for every
   * `position: fixed` descendant, so the moment <html> carries a transform the
   * Rune Forge's own reveal dialog — `position: fixed; inset: 0` — stops being
   * measured against the viewport and starts being measured against the
   * document. Measured rather than assumed: a fixed full-viewport layer goes
   * from the viewport's height to `scrollHeight` (6,216px on the Forge) the
   * frame the transform lands, which throws the card the player is reading
   * thousands of pixels up the page for the duration of the shake. The same
   * trap the routed hosts set for every fixed overlay on this site.
   *
   * So the shake is spent where it cannot trap anything:
   *
   *   · the WebGL field, through a camera offset — no DOM involved at all;
   *   · this effect layer, which has no fixed descendants of its own;
   *   · the element the drop came out of, which is a card, not a container.
   *
   * Together those are what a screen shake actually looks like. The one thing
   * that does not move is the chrome around the edges, which is also the one
   * thing nobody is looking at during a Legendary.
   */
  private shake(fx: TierFx, origin?: Element | null): void {
    const { amplitude, duration } = fx.shake!;
    this.scene.shake(amplitude, duration);

    for (const el of [this.layer, origin]) {
      if (!(el instanceof HTMLElement)) continue;
      el.style.setProperty('--gf-shake', `${amplitude}px`);
      el.style.setProperty('--gf-shake-dur', `${duration}ms`);
      // Dropped and re-added around a forced reflow: re-adding a class that is
      // already present does not restart its animation, so back-to-back Epics
      // would have shaken once. The same trick the existing rune flare uses.
      el.classList.remove('gf-jolt');
      void el.offsetWidth;
      el.classList.add('gf-jolt');
    }

    // The layer is removed wholesale at teardown, but the origin belongs to
    // someone else's template and has to be handed back clean.
    this.jolted = origin instanceof HTMLElement ? origin : null;
    this.later(() => this.unjolt(), duration + 40);
  }

  /** Take the jolt class off an element this service does not own. */
  private unjolt(): void {
    if (!this.jolted) return;
    this.jolted.classList.remove('gf-jolt');
    this.jolted.style.removeProperty('--gf-shake');
    this.jolted.style.removeProperty('--gf-shake-dur');
    this.jolted = null;
  }

  /** A slow hue-rotate over the whole page. Reads as reality bending, and costs
   *  one filter on one element. */
  private distort(fx: TierFx): void {
    const root = this.doc.documentElement;
    root.style.setProperty('--gf-distort-dur', `${fx.duration}ms`);
    root.classList.remove('gf-distorting');
    void root.offsetWidth;
    root.classList.add('gf-distorting');
  }

  /** Raise the flag the Rune Forge's own stylesheet reads to stretch its card
   *  animations. See `timeScale` in the model for why it is a flag and not a
   *  reach into the component. */
  private slowmo(fx: TierFx): void {
    this.doc.documentElement.dataset['gfSlowmo'] = String(fx.timeScale);
  }

  /**
   * When the payoff lands, in ms from t0.
   *
   * Everything that is *light* waits out the blackout; the blackout is the only
   * thing that runs at zero. Centralised so a change to the dark hold moves the
   * lightning, the shower and the rings with it instead of leaving them firing
   * into a black screen.
   */
  private payoffAt(fx: TierFx): number {
    return fx.blackout ? fx.blackout.fade + fx.blackout.hold : 0;
  }

  /** Hand the tier to the WebGL field. A no-op when there is no GL context,
   *  which is what lets every caller call it without asking. */
  private reactScene(fx: TierFx, origin?: Element | null): void {
    if (fx.scene === 'none') return;
    const at = this.originOf(origin);
    this.scene.celebrate(fx.scene, at.x, at.y, this.payoffAt(fx));
  }

  /**
   * Drop anything still on screen.
   *
   * Called when the surface that raised the celebration goes away — a route
   * change in the middle of a Singular would otherwise leave five seconds of
   * fixed overlay pinned over whatever the player navigated to.
   */
  cancel(): void {
    if (!this.isBrowser) return;
    this.run++;
    this.teardown();
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  /**
   * Remove everything this service has put on the page.
   *
   * Idempotent, and safe to call from anywhere: the flags are removed by name
   * rather than reset to a falsy value so a repeat celebration re-triggers the
   * animation instead of being swallowed by the still-running previous one.
   */
  private teardown(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.unjolt();
    this.layer = null;
    // Swept by selector rather than by the handle this service happens to be
    // holding. Only one celebration can be running at a time by design, so
    // "every .gf-fx on the page" and "the one I built" are the same set in
    // production — but they are not in a test harness, where each TestBed
    // builds its own root injector and a component spec that strikes a Rare
    // leaves a layer no later instance has a reference to. Sweeping makes the
    // invariant — at most one celebration layer exists — true by construction
    // instead of true by everyone remembering to clean up.
    for (const stale of Array.from(this.doc.querySelectorAll('.gf-fx'))) stale.remove();
    const root = this.doc.documentElement;
    root.classList.remove('gf-distorting');
    delete root.dataset['gfSlowmo'];
  }
}
