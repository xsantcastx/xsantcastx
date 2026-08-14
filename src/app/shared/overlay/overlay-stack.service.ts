import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface OverlayStackEntry {
  id: string;
  close: () => void;
}

/**
 * LIFO owner of Escape. One capture listener on document; the top overlay
 * closes and nothing underneath hears the key. SSR-safe: no document access
 * on the server.
 */
@Injectable({ providedIn: 'root' })
export class OverlayStackService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly stack: OverlayStackEntry[] = [];
  private listener?: (event: KeyboardEvent) => void;
  private closing = false;

  constructor() {
    if (!this.isBrowser || typeof document === 'undefined') return;
    this.listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      if (this.stack.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.closeTop();
    };
    document.addEventListener('keydown', this.listener, true);
  }

  /** Push a layer. Returns an idempotent unregister that does not call close. */
  push(id: string, close: () => void): () => void {
    const entry: OverlayStackEntry = { id, close };
    this.stack.push(entry);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const i = this.stack.lastIndexOf(entry);
      if (i >= 0) this.stack.splice(i, 1);
    };
  }

  /** Close and pop the top layer. Nested calls while `close()` runs are ignored. */
  closeTop(): boolean {
    if (this.closing) return false;
    const top = this.stack.pop();
    if (!top) return false;
    this.closing = true;
    try {
      top.close();
    } finally {
      this.closing = false;
    }
    return true;
  }

  ngOnDestroy(): void {
    if (this.listener && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.listener, true);
    }
    this.listener = undefined;
    this.stack.length = 0;
    this.closing = false;
  }
}
