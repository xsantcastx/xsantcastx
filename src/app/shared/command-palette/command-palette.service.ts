import { Injectable, signal } from '@angular/core';

/**
 * CommandPaletteService — tiny open/close state store for the
 * site-wide Cmd+K command palette. Kept as a dedicated service so that
 * any component (header button, "Search" CTA, etc.) can trigger the
 * palette without knowing about the overlay component's internals.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  /** Reactive open/closed signal consumed by CommandPaletteComponent. */
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }
}
