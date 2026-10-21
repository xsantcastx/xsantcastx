import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, inject } from '@angular/core';

/** A box on screen (viewport px): an item's cell, or the cursor as a zero-size box. */
export interface FitAnchor { left: number; top: number; right: number; bottom: number }

/**
 * Keeps a `position: fixed` card inside the window (owner's player notes 2026-10-21: "the item card runs off the
 * bottom of the window, so Equip can't be reached"). It measures the card as it really is (its height changes with
 * the item) every time it resizes, and places it:
 *
 *   side    beside the anchor (an item's cell): to its right, flipped to its left at the right edge; level with the
 *           cell's top, flipped up to end at the cell's bottom when it would run off the foot; always clamped inside.
 *   cursor  beside the pointer: below-right, flipped above / left near an edge (the hover card).
 *
 * The card's CSS caps its height to the window (it scrolls inside, its actions sticky at the foot), so clamping can
 * always succeed. Phones override left/top with their bottom-sheet rule (`!important`), so this only steers desktop.
 */
@Directive({ selector: '[appFitViewport]', standalone: true })
export class FitViewportDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input('appFitViewport') anchor: FitAnchor | null = null;
  @Input() fitMode: 'side' | 'cursor' = 'side';

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly zone = inject(NgZone);
  private observer: ResizeObserver | null = null;
  private readonly onResize = () => this.place();

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      if (typeof ResizeObserver === 'function') {
        this.observer = new ResizeObserver(() => this.place());
        this.observer.observe(this.el);
      }
      window.addEventListener('resize', this.onResize);
    });
    this.place();
  }

  ngOnChanges(): void { this.place(); }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  /** Where the card goes now (exported for the spec through `fitBox`). */
  private place(): void {
    if (typeof window === 'undefined' || !this.anchor) return;
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!w || !h) return;
    const at = fitBox(this.anchor, { w, h }, { w: window.innerWidth, h: window.innerHeight }, this.fitMode);
    this.el.style.left = `${at.x}px`;
    this.el.style.top = `${at.y}px`;
  }
}

/** The pure placement (see the directive). `margin` keeps the card off the window's very edge. */
export function fitBox(a: FitAnchor, card: { w: number; h: number }, view: { w: number; h: number }, mode: 'side' | 'cursor', margin = 8): { x: number; y: number } {
  const gapX = mode === 'side' ? 10 : 16, gapY = mode === 'side' ? 0 : 12;
  let x = a.right + gapX;
  if (x + card.w > view.w - margin) x = a.left - gapX - card.w;
  let y = mode === 'side' ? a.top - 8 : a.bottom + gapY;
  if (y + card.h > view.h - margin) y = mode === 'side' ? a.bottom + 8 - card.h : a.top - gapY - card.h;
  const clamp = (v: number, size: number, room: number) => Math.max(margin, Math.min(v, room - margin - size));
  return { x: Math.round(clamp(x, card.w, view.w)), y: Math.round(clamp(y, card.h, view.h)) };
}
