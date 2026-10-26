/**
 * item-drag.service.ts — one drag API for every place an item can go (docs/design/inventory-grid.md §3).
 *
 * A source (a grid piece, a worn well, later a shop shelf) calls `press()` on pointerdown with what it holds. A target
 * (a grid, a well, the belt, the world, the trade window, the stash) registers its element with `register()` (or the
 * `appDropTarget` directive) and says what it accepts and what a drop does. The service owns the gesture:
 *
 *   mouse   press + move 4 px → a drag; the ghost follows; release over a target drops. A click is not a drag: the
 *           source's own click (options card) still runs.
 *   touch   a long-press (400 ms, still) picks the thing up: it is HELD (the ghost parks by the finger and a "Holding
 *           … · Cancel" bar shows). The next tap on a target places it there; a tap anywhere else, or Cancel, puts it
 *           back. No finger-dragging, so the window still scrolls.
 *   keys    Esc puts it back.
 *
 * Optimistic: a target's `drop` writes locally (InventoryService.moveTo is one ledger write) and returns at once; a
 * server-backed drop (the ground, a trade offer) returns a promise the UI does not wait on. Pure DOM, browser-only.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import type { GameItem } from '../rpg/item.model';
import type { GridRef } from '../rpg/inventory.service';

/** What is in hand. `from` names where it came from (a grid id, `slot`, `shop`…); targets decide by it. */
export interface DragHeld {
  ref: GridRef | { kind: 'slot'; slotId: string; itemId: string } | { kind: 'shop'; offerId: string };
  from: string;
  w: number;
  h: number;
  /** Which cell of the footprint the pointer grabbed (a grid drop keeps the piece under the finger). */
  grabDx: number;
  grabDy: number;
  name: string;
  art: string;
  mark: string;
  tone: string | null;
  qty: number;
  item?: GameItem;
  stackKey?: string;
  /** The source piece's key in its grid (so the grid can dim it while it is in hand). */
  pieceKey?: string;
}

export interface DropTarget {
  accepts(held: DragHeld): boolean;
  /** The pointer is over the target (for a landing preview). */
  over?(held: DragHeld, x: number, y: number): void;
  leave?(): void;
  /** Drop it: true (or a promise of it) when it took it. A refusal puts it back. */
  drop(held: DragHeld, x: number, y: number): boolean | Promise<boolean>;
}

const LONG_PRESS_MS = 400;
const MOVE_PX = 4;
const TOUCH_SLOP_PX = 8;

@Injectable({ providedIn: 'root' })
export class ItemDragService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly targets = new Map<HTMLElement, DropTarget>();
  private readonly held$$ = new BehaviorSubject<DragHeld | null>(null);
  /** What is in hand now (null: nothing). */
  readonly held$ = this.held$$.asObservable();
  get held(): DragHeld | null { return this.held$$.value; }
  /** 'drag': following a mouse; 'hold': picked up by a long-press, waiting for a tap. */
  mode: 'drag' | 'hold' | null = null;
  /** The gesture the drop being delivered came from (a target reads it inside `drop`). */
  dropMode: 'drag' | 'hold' | null = null;
  /** The last refusal or result, for a polite live line. */
  readonly said$ = new BehaviorSubject<string>('');

  private ghost: HTMLElement | null = null;
  private pending: { held: DragHeld; x: number; y: number; pointerId: number; touch: boolean; timer?: ReturnType<typeof setTimeout> } | null = null;
  private hover: { el: HTMLElement; target: DropTarget } | null = null;
  /** A click right after a drop must not also open the options card. */
  private swallowClickUntil = 0;
  private readonly onMove = (ev: PointerEvent) => this.move(ev);
  private readonly onUp = (ev: PointerEvent) => this.up(ev);
  private readonly onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && this.held) { ev.preventDefault(); this.cancel(); } };
  private readonly onTap = (ev: PointerEvent) => this.tap(ev);
  /** A source's image would start the browser's own drag (and cancel the pointer stream): never while we hold one. */
  private readonly onNativeDrag = (ev: DragEvent) => { if (this.pending || this.held) ev.preventDefault(); };
  private readonly onClickCapture = (ev: MouseEvent) => {
    if (Date.now() < this.swallowClickUntil) { ev.preventDefault(); ev.stopPropagation(); }
  };

  constructor() {
    if (!this.browser) return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.onKey, true);
      window.addEventListener('click', this.onClickCapture, true);
      window.addEventListener('dragstart', this.onNativeDrag, true);
    });
  }

  ngOnDestroy(): void {
    if (!this.browser) return;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('click', this.onClickCapture, true);
    window.removeEventListener('dragstart', this.onNativeDrag, true);
    this.teardown();
  }

  register(el: HTMLElement, target: DropTarget): () => void {
    this.targets.set(el, target);
    el.setAttribute('data-drop-target', '');
    return () => { this.targets.delete(el); if (this.hover?.el === el) this.hover = null; };
  }

  /** A source's pointerdown. Returns at once; the gesture decides later whether it became a drag. */
  press(ev: PointerEvent, held: DragHeld): void {
    if (!this.browser || ev.button > 0) return;
    if (this.held) return; // a tap while holding is a placement (handled by `tap`)
    const touch = ev.pointerType !== 'mouse';
    this.pending = { held, x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId, touch };
    if (touch) this.pending.timer = setTimeout(() => this.zone.run(() => this.pickUp('hold', ev.clientX, ev.clientY)), LONG_PRESS_MS);
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, true);
      window.addEventListener('pointerup', this.onUp, true);
      window.addEventListener('pointercancel', this.onUp, true);
    });
  }

  /** Put down whatever is in hand, back where it was. */
  cancel(): void {
    this.leaveHover();
    this.held$$.next(null);
    this.mode = null;
    this.teardown();
  }

  /** Drop what is in hand on a target element directly (a keyboard or test path; also the touch tap). */
  async dropOn(el: HTMLElement, x: number, y: number): Promise<boolean> {
    const held = this.held, target = this.targetFor(el);
    if (!held || !target || !target.target.accepts(held)) return false;
    this.dropMode = this.mode;
    this.leaveHover();
    this.held$$.next(null);
    this.mode = null;
    this.teardown();
    this.swallowClickUntil = Date.now() + 350;
    try { return await target.target.drop(held, x, y); } catch { return false; }
  }

  private pickUp(mode: 'drag' | 'hold', x: number, y: number): void {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    this.mode = mode;
    this.held$$.next(p.held);
    this.makeGhost(p.held, x, y);
    if (mode === 'hold') {
      window.removeEventListener('pointermove', this.onMove, true);
      window.removeEventListener('pointerup', this.onUp, true);
      window.removeEventListener('pointercancel', this.onUp, true);
      // The lifting finger's own click must not place it; the next tap does.
      this.swallowClickUntil = Date.now() + 600;
      setTimeout(() => this.zone.runOutsideAngular(() => window.addEventListener('pointerdown', this.onTap, true)), 0);
      try { navigator.vibrate?.(15); } catch { /* not on this device */ }
    }
  }

  private move(ev: PointerEvent): void {
    const p = this.pending;
    if (p) {
      const d = Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
      if (p.touch) { if (d > TOUCH_SLOP_PX) { clearTimeout(p.timer); this.pending = null; this.teardown(); } return; }
      if (d < MOVE_PX) return;
      this.zone.run(() => this.pickUp('drag', ev.clientX, ev.clientY));
    }
    if (this.mode !== 'drag' || !this.held) return;
    this.placeGhost(ev.clientX, ev.clientY);
    this.overAt(ev.clientX, ev.clientY);
  }

  private up(ev: PointerEvent): void {
    const p = this.pending;
    if (p) { clearTimeout(p.timer); this.pending = null; this.teardown(); return; }
    if (this.mode !== 'drag' || !this.held) return;
    const hit = this.hitAt(ev.clientX, ev.clientY);
    this.swallowClickUntil = Date.now() + 350;
    if (hit) void this.zone.run(() => this.dropOn(hit.el, ev.clientX, ev.clientY));
    else this.zone.run(() => this.cancel());
  }

  private tap(ev: PointerEvent): void {
    if (this.mode !== 'hold' || !this.held) return;
    const hit = this.hitAt(ev.clientX, ev.clientY);
    const cancelBtn = (ev.target as Element | null)?.closest?.('[data-drag-cancel]');
    ev.preventDefault();
    ev.stopPropagation();
    this.swallowClickUntil = Date.now() + 500;
    if (hit && !cancelBtn) void this.zone.run(() => this.dropOn(hit.el, ev.clientX, ev.clientY));
    else this.zone.run(() => this.cancel());
  }

  private hitAt(x: number, y: number): { el: HTMLElement; target: DropTarget } | null {
    const under = document.elementsFromPoint(x, y);
    for (const node of under) {
      if (node === this.ghost) continue;
      const el = (node as HTMLElement).closest?.('[data-drop-target]') as HTMLElement | null;
      const found = el ? this.targetFor(el) : null;
      if (found && this.held && found.target.accepts(this.held)) return found;
    }
    return null;
  }

  private targetFor(el: HTMLElement): { el: HTMLElement; target: DropTarget } | null {
    let node: HTMLElement | null = el;
    while (node) {
      const t = this.targets.get(node);
      if (t) return { el: node, target: t };
      node = node.parentElement?.closest('[data-drop-target]') ?? null;
    }
    return null;
  }

  private overAt(x: number, y: number): void {
    const hit = this.hitAt(x, y);
    if (this.hover && this.hover.el !== hit?.el) this.leaveHover();
    if (hit && this.held) { this.hover = hit; hit.el.classList.add('is-drop-over'); hit.target.over?.(this.held, x, y); }
  }

  private leaveHover(): void {
    if (!this.hover) return;
    this.hover.el.classList.remove('is-drop-over');
    this.hover.target.leave?.();
    this.hover = null;
  }

  private makeGhost(held: DragHeld, x: number, y: number): void {
    this.ghost?.remove();
    const g = document.createElement('div');
    g.className = 'item-ghost';
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('data-item-ghost', held.name);
    const cell = 34;
    Object.assign(g.style, {
      position: 'fixed', left: '0', top: '0', width: `${held.w * cell}px`, height: `${held.h * cell}px`, zIndex: '10000',
      pointerEvents: 'none', display: 'grid', placeItems: 'center', opacity: '0.85', imageRendering: 'pixelated',
      background: 'var(--cozy-well)', outline: `2px solid ${held.tone ?? 'var(--cozy-brass)'}`,
    } as Partial<CSSStyleDeclaration>);
    if (held.art) {
      const img = document.createElement('img');
      img.src = held.art; img.alt = '';
      Object.assign(img.style, { maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' });
      g.appendChild(img);
    } else {
      g.textContent = held.mark;
      Object.assign(g.style, { color: 'var(--cozy-cream)', font: '700 12px var(--font-game)' });
    }
    document.body.appendChild(g);
    this.ghost = g;
    this.grab = { dx: (held.grabDx + 0.5) * cell, dy: (held.grabDy + 0.5) * cell };
    this.placeGhost(x, y);
  }
  private grab = { dx: 17, dy: 17 };

  private placeGhost(x: number, y: number): void {
    if (!this.ghost) return;
    const lift = this.mode === 'hold' ? 44 : 0; // held by a finger: shown just above it, never under it
    this.ghost.style.transform = `translate(${Math.round(x - this.grab.dx)}px, ${Math.round(y - this.grab.dy - lift)}px)`;
  }

  private teardown(): void {
    if (!this.browser) return;
    window.removeEventListener('pointermove', this.onMove, true);
    window.removeEventListener('pointerup', this.onUp, true);
    window.removeEventListener('pointercancel', this.onUp, true);
    window.removeEventListener('pointerdown', this.onTap, true);
    if (!this.held) { this.ghost?.remove(); this.ghost = null; }
  }
}
