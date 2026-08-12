/**
 * pinned-achievements.service.ts — which trophies the Convergent puts on show.
 *
 * The whole store is one nullable array, and the null is load-bearing:
 *
 *  - `null` (no key) means **auto**. The showcase fills itself with whatever is
 *    rarest on the wall right now, so a visitor who has never opened the picker
 *    still sees their best work — and a Mythic found tomorrow promotes itself
 *    into the case without anyone touching a setting.
 *  - an array means **chosen**. From then on the case shows exactly that, even
 *    if something rarer turns up, because the point of pinning is that it is a
 *    statement rather than a ranking.
 *
 * Storing an empty array to mean auto would collapse those two into one and
 * make "I deliberately want nothing pinned" unrepresentable.
 *
 * Its own key, deliberately. This is a display preference, not progression: it
 * must never be able to cost someone an achievement, and wiping progression
 * must not be blocked on reconciling a decoration.
 *
 * SSR: reads are guarded and return null on the server, so the prerendered
 * showcase is the empty case — which is what a crawler should see.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const PINNED_KEY = 'godforge-pinned';

/** How many trophies fit in the case. The spec's upper bound. */
export const PIN_SLOTS = 5;

@Injectable({ providedIn: 'root' })
export class PinnedAchievementsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Cached across reads; `undefined` means "not read yet", null means auto. */
  private cache: string[] | null | undefined;

  /**
   * The chosen pins, or null when the visitor has never customised the case.
   * Callers treat null as "pick the rarest for me".
   */
  load(): string[] | null {
    if (this.cache !== undefined) return this.cache;
    if (!this.isBrowser) return (this.cache = null);

    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (raw === null) return (this.cache = null);
      const parsed = JSON.parse(raw);
      // A hand-edited or half-written blob degrades to auto rather than
      // throwing inside a template binding on a page that is mostly bindings.
      this.cache = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string').slice(0, PIN_SLOTS)
        : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  /** Fix the case to exactly these ids. Anything past the slot count is dropped. */
  save(ids: readonly string[]): void {
    if (!this.isBrowser) return;
    const trimmed = [...new Set(ids)].slice(0, PIN_SLOTS);
    this.cache = trimmed;
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota or private mode — a display preference is not worth breaking a page over */
    }
  }

  /** Hand the case back to the auto picker. */
  reset(): void {
    if (!this.isBrowser) return;
    this.cache = null;
    try {
      localStorage.removeItem(PINNED_KEY);
    } catch {
      /* ignore */
    }
  }

  /** True once the visitor has taken the case over from the auto picker. */
  get isCustomised(): boolean {
    return this.load() !== null;
  }
}
