/**
 * art-scene.component.ts — a painted location behind a route.
 *
 * The three-layer pattern the homepage and the Rune Forge both write out by
 * hand: artwork, a dark gradient for readability, then the page's own glass UI
 * on top. Those two came first and each hand-rolled it; this is the same thing
 * with the parts that were identical in both lifted out, so the four routes
 * added after them do not make six copies of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY <picture> AND NOT background-image
 * ─────────────────────────────────────────────────────────────────────────────
 * Both existing scenes record this and it is worth keeping in one place now.
 * The browser picks a <source> from `media` and `type` BEFORE it fetches
 * anything, which buys two things a CSS background cannot have without
 * `image-set()`, whose `type()` branch is exactly what older Safari lacks:
 *
 *   art direction — the phone gets a portrait crop of the room, not a landscape
 *                   frame squeezed into a tall viewport
 *   a JPEG floor  — a browser with no WebP still gets a painting
 *
 * It is still SSR-safe and still prerenders: this is markup in the template, so
 * it lands in the static HTML exactly as a stylesheet rule would.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CONTAINING-BLOCK TRAP
 * ─────────────────────────────────────────────────────────────────────────────
 * `.scene` is `fixed`, not `absolute`, because these routes scroll for several
 * viewports and an absolute layer scrolls away with them, leaving three
 * quarters of the page over bare void.
 *
 * `router-outlet + *` carries routeFadeIn with `fill: forwards`, so every
 * routed host IS a transformed ancestor and should in principle capture a fixed
 * child. Measured on /rune-forge, it does not: the animation settles on an
 * identity matrix, and an identity transform establishes no containing block.
 * That is a real dependency — if routeFadeIn ever ends on a non-identity
 * transform, every scene on the site stops being fixed. The failure is graceful
 * (`inset: 0` against the host still covers nearly the whole page) but it would
 * no longer be the still backdrop it is meant to be.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Widths every scene ships, matched to `scripts/build-scene-art.py`. */
const SMALL = 768;
const MEDIUM = 1280;
const LARGE = 1536;

let sceneSeq = 0;

@Component({
  selector: 'app-art-scene',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scene" aria-hidden="true">
      <picture class="scene__art">
        <source [attr.media]="'(max-width: ' + SMALL + 'px)'" type="image/webp"
                [attr.srcset]="dir + '-' + SMALL + '.webp'">
        <source [attr.media]="'(max-width: ' + MEDIUM + 'px)'" type="image/webp"
                [attr.srcset]="dir + '-' + MEDIUM + '.webp'">
        <source type="image/webp" [attr.srcset]="dir + '-' + LARGE + '.webp'">
        <img [src]="dir + '-' + LARGE + '.jpg'" alt=""
             width="1536" height="1024"
             [style.object-position]="focus"
             fetchpriority="high" decoding="async" draggable="false">
      </picture>
      <span class="scene__overlay"></span>
    </div>
  `,
  styles: [`
    /* The host holds nothing in flow — its only child is fixed — so it collapses
       to zero height wherever it is placed. Declared rather than left to the
       default inline, which would have it participate in line layout and add a
       stray text-node baseline to whatever it sits next to.

       (No backticks in this block, ever: it is a template literal, and one in a
       comment ends the string. The compiler then reports "failed to resolve
       styles at position 1", which points at the styles array rather than at
       the comment that broke it.) */
    :host { display: block; }

    .scene {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      /* Painted behind the art so the route is never a white flash while the
         image decodes, and so any letterboxing reads as void rather than as a
         gap. Same value the overlay ends on. */
      background-color: #0a0a0f;
      pointer-events: none;
    }

    .scene__art { display: block; width: 100%; height: 100%; }

    .scene__art img { width: 100%; height: 100%; object-fit: cover; }

    /* Layer 2. Light at the top so the ceiling and whatever hangs in it stay
       legible, heavy from the middle down where the UI actually lands, and
       solid at the bottom so the page ends without a seam. */
    .scene__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(10, 10, 15, var(--scene-top, 0.3)) 0%,
        rgba(10, 10, 15, var(--scene-mid, 0.85)) 70%,
        #0a0a0f 100%
      );
    }
  `],
})
export class ArtSceneComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);

  /**
   * Basename of the art under assets/images, without the width suffix —
   * `bg-arena` resolves bg-arena-768.webp through bg-arena-1536.jpg.
   */
  @Input({ required: true }) art!: string;

  /**
   * `object-position` for the landscape frame. The paintings are composed on a
   * subject that is rarely dead centre vertically, and `cover` on a wide
   * viewport crops top and bottom, so this is how a room keeps its floor or its
   * ceiling. Default leans slightly up, which suits a room with a lit centre.
   */
  @Input() focus = 'center 45%';

  protected readonly SMALL = SMALL;
  protected readonly MEDIUM = MEDIUM;
  protected readonly LARGE = LARGE;

  /** Marks this instance's preload links so it removes its own and no others. */
  private readonly token = `scene-${++sceneSeq}`;

  protected get dir(): string { return `assets/images/${this.art}`; }

  ngOnInit(): void {
    this.addPreloads();
    // Switches off the site's CSS atmosphere — body gradient, nebula,
    // starfield, matrix layer, pulsar, corner runes, constellation canvas — for
    // any route showing a painting. All of it was the stand-in for artwork the
    // route now has, and running both is two rooms at once.
    this.doc.body?.classList.add('gf-art-route');
  }

  ngOnDestroy(): void {
    this.doc.head?.querySelectorAll(`link[data-scene="${this.token}"]`)
      .forEach(el => el.remove());
    this.doc.body?.classList.remove('gf-art-route');
  }

  /**
   * Preload this route's frame, per breakpoint.
   *
   * Scoped to the component rather than declared in index.html: a global
   * preload would pull one route's artwork on every page of the site, which is
   * the opposite of what a preload is for. Added here so it lands in this
   * route's prerendered HTML, and removed in ngOnDestroy so a visitor who walks
   * through four rooms is not left with twelve stale hints in <head>.
   *
   * The media queries mirror the <source> elements exactly. If they ever
   * disagree the browser preloads one file and then downloads a different one,
   * which is strictly worse than not preloading at all.
   */
  private addPreloads(): void {
    const head = this.doc.head;
    if (!head) return;
    const breakpoints: ReadonlyArray<[number, string]> = [
      [SMALL, `(max-width: ${SMALL}px)`],
      [MEDIUM, `(min-width: ${SMALL + 0.02}px) and (max-width: ${MEDIUM}px)`],
      [LARGE, `(min-width: ${MEDIUM + 0.02}px)`],
    ];
    for (const [width, media] of breakpoints) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('type', 'image/webp');
      link.setAttribute('media', media);
      link.setAttribute('href', `${this.dir}-${width}.webp`);
      link.setAttribute('data-scene', this.token);
      head.appendChild(link);
    }
  }
}
