/**
 * progress-storage.service.ts — where progression is persisted.
 *
 * The service talks to a `ProgressAdapter`, not to a storage API. Today the only
 * live adapter is localStorage; the Firestore adapter is a deliberate stub so
 * that Phase 2 (progress that follows a signed-in visitor across devices) is a
 * one-line provider swap rather than a rewrite of XpService.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProgressState, emptyProgress } from './gamification.model';

export const PROGRESS_KEY = 'eclipse-progress';

export interface ProgressAdapter {
  load(): ProgressState;
  save(state: ProgressState): void;
  clear(): void;
}

/** Reads and writes the whole state blob as one localStorage key. */
export class LocalStorageAdapter implements ProgressAdapter {
  constructor(private readonly key = PROGRESS_KEY) {}

  load(): ProgressState {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      // Merge over a fresh blob so a state written by an older build (missing
      // fields added since) still hydrates instead of throwing on read.
      return { ...emptyProgress(), ...parsed, version: 1 };
    } catch {
      return emptyProgress();
    }
  }

  save(state: ProgressState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      /* quota or private mode — progression is not worth breaking a page over */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * No-op adapter used during server-side rendering, where there is no visitor and
 * no storage. Keeps XpService free of `isPlatformBrowser` checks at every call.
 */
export class NullAdapter implements ProgressAdapter {
  load(): ProgressState { return emptyProgress(); }
  save(): void { /* no-op */ }
  clear(): void { /* no-op */ }
}

/**
 * Phase 2 stub. Signing in should sync progression to `users/{uid}/progress`,
 * with the local blob acting as an offline cache that reconciles on load
 * (highest lifetime XP wins, achievement id sets union). Not wired yet: the site
 * has no account system, so there is no uid to key on.
 */
export class FirestoreAdapter implements ProgressAdapter {
  load(): ProgressState { return emptyProgress(); }
  save(): void { /* Phase 2 */ }
  clear(): void { /* Phase 2 */ }
}

@Injectable({ providedIn: 'root' })
export class ProgressStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private adapter: ProgressAdapter = this.isBrowser
    ? new LocalStorageAdapter()
    : new NullAdapter();

  /** Swap the backing store. Phase 2 calls this on sign-in. */
  useAdapter(adapter: ProgressAdapter): void {
    this.adapter = adapter;
  }

  load(): ProgressState { return this.adapter.load(); }
  save(state: ProgressState): void { this.adapter.save(state); }
  clear(): void { this.adapter.clear(); }
}
