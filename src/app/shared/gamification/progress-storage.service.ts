/**
 * progress-storage.service.ts — the typed face of the progression blob.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS USED TO BE, AND WHY IT IS SMALLER NOW
 * ─────────────────────────────────────────────────────────────────────────────
 * This file used to own a `ProgressAdapter` interface with four implementations,
 * one of which — `FirestoreAdapter` — read and wrote Firestore itself, throttled
 * its own uploads, merged on the way up and kept localStorage as a cache
 * underneath. It was a good design for the problem it was given: make *this one
 * blob* portable without rewriting `XpService`.
 *
 * The problem changed. Every blob is portable now, and all of them go through
 * `GameStateGateway`, which does the same job for nineteen keys with one batched
 * write instead of nineteen throttled ones. Keeping the adapter would have meant
 * two independent pieces of code writing to Firestore on two independent
 * schedules, racing each other over the same document — and the last three
 * releases were spent on bugs caused by exactly that kind of second writer.
 *
 * So the adapters are gone and this is a thin, typed wrapper: it knows the shape
 * of `ProgressState` and nothing about storage. `XpService` is unchanged and
 * still sees the same async surface, which is what the indirection was for.
 *
 * The async signatures are kept deliberately even though the gateway answers
 * synchronously. `XpService.init()` is built around awaiting this, half a dozen
 * components await `xp.ready`, and narrowing the contract to synchronous would
 * be a wide change to buy nothing — while leaving it async keeps the door open
 * for a future that fetches a profile before first paint.
 */
import { Injectable, inject } from '@angular/core';
import { GameStateGateway } from '../save/game-state.gateway';
import {
  PROGRESS_KEY,
  ProgressState,
  emptyProgress,
  migrateProgress,
} from './gamification.model';

// Re-exported because a dozen files import it from here and the constant itself
// had to move to the model to keep this service's new dependency on the gateway
// from being a cycle. See the note on its declaration.
export { PROGRESS_KEY };

@Injectable({ providedIn: 'root' })
export class ProgressStorageService {
  private readonly gateway = inject(GameStateGateway);

  /**
   * Which backend progression is living in, for the HUD and the Forge's
   * identity block.
   *
   * Reads through to the gateway's link state rather than being tracked here:
   * one of the two would otherwise be stale, and it would be this one.
   */
  get backend(): string {
    return this.gateway.attached ? 'firestore' : 'localStorage';
  }

  /** True once a real remote backend is behind the service. */
  get isRemote(): boolean {
    return this.gateway.attached;
  }

  /**
   * The stored progression, coerced into the current shape.
   *
   * `migrateProgress` handles both the v1 blob and any field added to v2 since
   * this particular visitor last wrote, so a save written by an older build
   * hydrates rather than throwing on a field that did not exist yet.
   */
  async load(): Promise<ProgressState> {
    const stored = this.gateway.read(PROGRESS_KEY);
    return stored === null ? emptyProgress() : migrateProgress(stored);
  }

  async save(state: ProgressState): Promise<void> {
    this.saveNow(state);
  }

  /**
   * Write now. Named for the `pagehide` path it was built for, and now the only
   * write path — the gateway's local write is synchronous, so there is no longer
   * a version of this that can be lost by not being awaited.
   */
  saveNow(state: ProgressState): void {
    this.gateway.write(PROGRESS_KEY, { ...state, updatedAt: new Date().toISOString() });
  }

  async exists(): Promise<boolean> {
    return this.gateway.readRaw(PROGRESS_KEY) !== null;
  }

  /** Wipes progression here and in the cloud. `XpService.reset()` is the caller. */
  async clear(): Promise<void> {
    this.gateway.remove(PROGRESS_KEY);
  }

  /**
   * Push anything queued for the cloud, immediately.
   *
   * Sign-out is the caller: the gateway debounces its uploads, so at the one
   * moment a visitor is explicitly asking for their progress to be safe there
   * may be a few seconds of awards sitting in a timer.
   */
  async flush(): Promise<void> {
    await this.gateway.flushNow();
  }
}
