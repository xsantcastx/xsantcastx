/**
 * inspect.service.ts — open/close Quick Inspect and sync ?inspect=<type>:<id>.
 *
 * Back closes Inspect first by pushing a history entry on open. Close via the
 * panel replaces that entry so the source filters stay put. No mutations.
 */
import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { OverlayStackService } from '../overlay/overlay-stack.service';
import { EntityResolver } from './entity-resolver.service';
import { INSPECT_QUERY, parseEntityRef, serializeEntityRef } from './entity-ref';
import { type EntityRef, type EntityResolution } from './entity.model';

export interface InspectView {
  open: boolean;
  ref: EntityRef | null;
  resolution: EntityResolution | null;
}

const EMPTY: InspectView = { open: false, ref: null, resolution: null };

@Injectable({ providedIn: 'root' })
export class InspectService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly resolver = inject(EntityResolver);
  private readonly overlays = inject(OverlayStackService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly view$$ = new BehaviorSubject<InspectView>(EMPTY);
  readonly view$ = this.view$$.asObservable();

  private sub?: Subscription;
  private unstack?: () => void;
  private trigger: HTMLElement | null = null;
  private pushed = false;

  get view(): InspectView { return this.view$$.value; }

  start(): void {
    if (this.sub) return;
    this.applyToken(this.tokenFromUrl());
    this.sub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ).subscribe(() => this.applyToken(this.tokenFromUrl()));
  }

  private tokenFromUrl(): string | null {
    const tree = this.router.parseUrl(this.router.url);
    const raw = tree.queryParams[INSPECT_QUERY];
    return typeof raw === 'string' ? raw : null;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.unstack?.();
    this.unstack = undefined;
  }

  open(ref: EntityRef, opts?: { trigger?: EventTarget | null }): void {
    if (opts?.trigger instanceof HTMLElement) this.trigger = opts.trigger;
    else if (this.isBrowser) this.trigger = document.activeElement as HTMLElement | null;

    const token = serializeEntityRef(ref);
    this.applyToken(token);
    if (this.tokenFromUrl() === token) return;
    this.pushed = true;
    void this.router.navigate([], {
      queryParams: { [INSPECT_QUERY]: token },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  close(): void {
    if (!this.view.open && !this.tokenFromUrl()) {
      this.clearView();
      return;
    }
    if (this.pushed && this.isBrowser && window.history.length > 1) {
      this.pushed = false;
      window.history.back();
      return;
    }
    this.pushed = false;
    void this.router.navigate([], {
      queryParams: { [INSPECT_QUERY]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  retry(): void {
    const ref = this.view.ref;
    if (!ref) return;
    this.applyToken(serializeEntityRef(ref));
  }

  restoreFocus(): void {
    const el = this.trigger;
    this.trigger = null;
    if (!el || !this.isBrowser) return;
    try {
      if (document.contains(el)) el.focus();
    } catch { /* trigger may have been removed */ }
  }

  private applyToken(token: string | null): void {
    const ref = parseEntityRef(token);
    if (!ref) {
      this.clearView();
      return;
    }
    const resolution = this.resolver.resolve(ref);
    this.view$$.next({ open: true, ref, resolution });
    this.ensureStack();
  }

  private clearView(): void {
    const wasOpen = this.view.open;
    this.unstack?.();
    this.unstack = undefined;
    this.view$$.next(EMPTY);
    if (wasOpen) this.restoreFocus();
  }

  private ensureStack(): void {
    if (this.unstack) return;
    this.unstack = this.overlays.push('inspect', () => this.close());
  }
}
