/**
 * inspect-3d.service.ts — open and close the 3D item inspector.
 *
 * Deliberately tiny and eagerly loaded: it holds a presentation and a boolean,
 * and nothing else. Everything expensive — the overlay, the scene, three itself
 * — hangs off the outlet component, which builds it on first open and throws it
 * away on close.
 *
 * It takes a resolved `EntityPresentation` rather than an `EntityRef` because
 * every caller already has one: Quick Inspect resolved it to draw the 2D panel,
 * and re-resolving would mean this service depending on EntityResolver for no
 * new information.
 */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { OverlayStackService } from '../overlay/overlay-stack.service';
import { type EntityPresentation } from '../entity/entity.model';

@Injectable({ providedIn: 'root' })
export class Inspect3dService {
  private readonly overlays = inject(OverlayStackService);

  private readonly subject$$ = new BehaviorSubject<EntityPresentation | null>(null);
  /** The item on the pedestal, or null when the inspector is closed. */
  readonly subject$: Observable<EntityPresentation | null> = this.subject$$.asObservable();

  private unstack?: () => void;
  private trigger: HTMLElement | null = null;

  get subject(): EntityPresentation | null { return this.subject$$.value; }
  get isOpen(): boolean { return this.subject$$.value !== null; }

  open(presentation: EntityPresentation, opts?: { trigger?: EventTarget | null }): void {
    this.trigger = opts?.trigger instanceof HTMLElement ? opts.trigger : null;
    this.subject$$.next(presentation);
    // Topmost-Escape is the overlay stack's job, not a keydown handler of our
    // own: the inspector opens *over* Quick Inspect, and one Escape must close
    // the inspector and leave the panel behind it standing.
    this.unstack ??= this.overlays.push('inspect-3d', () => this.close());
  }

  close(): void {
    if (!this.isOpen) return;
    this.unstack?.();
    this.unstack = undefined;
    this.subject$$.next(null);

    const el = this.trigger;
    this.trigger = null;
    if (!el) return;
    try {
      if (document.contains(el)) el.focus();
    } catch { /* the trigger may have been removed while the overlay was up */ }
  }
}
