/**
 * lore-scroll.service.ts — which scrolls have been found, and when.
 *
 * Same shape as `CodexSecretsService`, and for the same reason: the Codex has
 * to be able to render the scroll wall without knowing anything about the Rune
 * Forge. The forge grants; this service records; the Codex reads. A Codex that
 * injected `RuneForgeService` to list scrolls would be a page about
 * achievements depending on a gambling ledger.
 *
 * Its own storage key rather than a corner of `godforge-runes`. Runes are spent
 * — a Runeword consumes them and the count goes down. A scroll, once read, is
 * read forever. Two lifetimes in one blob is how you end up shipping a
 * migration that quietly deletes somebody's codex because it was iterating the
 * wrong half.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { LORE_SCROLLS, LoreScroll, scrollById } from './lore-scroll.model';

/** localStorage key holding the scroll ledger. */
export const SCROLLS_KEY = 'godforge-scrolls';

interface ScrollLedger {
  version: 1;
  /** scroll id → ISO timestamp of discovery. Presence is what "found" means. */
  found: Record<string, string>;
  /** Scroll ids the visitor has actually opened and read. */
  read: string[];
}

function emptyLedger(): ScrollLedger {
  return { version: 1, found: {}, read: [] };
}

@Injectable({ providedIn: 'root' })
export class LoreScrollService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private ledger: ScrollLedger = emptyLedger();
  private initialised = false;

  private readonly changed$$ = new BehaviorSubject<number>(0);
  private readonly discovered$$ = new Subject<LoreScroll>();

  /**
   * Bumps whenever the ledger moves. Replayed, so a Codex that mounts after a
   * discovery still rebuilds — `LoreService.unlock$` is a plain Subject and is
   * unusable for exactly that reason.
   */
  readonly changed$: Observable<number> = this.changed$$.asObservable();

  /** One event per newly found scroll. Not replayed — this drives a cinematic. */
  readonly discovered$: Observable<LoreScroll> = this.discovered$$.asObservable();

  /** Idempotent. Safe to call from several places on the same page. */
  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.ledger = this.load();
    this.changed$$.next(this.changed$$.value + 1);

    // `save()` writes the whole shelf from memory. Silent on purpose: this
    // replaces the found-set with the union of both devices, and pushing those
    // through `discovered$` would fire a discovery toast per scroll the other
    // device found — they are the same discoveries, not new ones.
    this.saves.register(SCROLLS_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.changed$$.next(this.changed$$.value + 1);
      },
    });
  }

  /**
   * Record a scroll as found.
   *
   * False when the id is unknown or the scroll is already held, so the caller
   * can tell a genuine discovery from a no-op without comparing counts.
   */
  grant(id: string): boolean {
    if (!this.isBrowser) return false;
    const scroll = scrollById(id);
    if (!scroll || this.isFound(id)) return false;

    this.ledger.found = { ...this.ledger.found, [id]: new Date().toISOString() };
    this.save();
    this.changed$$.next(this.changed$$.value + 1);
    this.discovered$$.next(scroll);
    return true;
  }

  isFound(id: string): boolean {
    return id in this.ledger.found;
  }

  /** ISO timestamp of discovery, or null. */
  foundAt(id: string): string | null {
    return this.ledger.found[id] ?? null;
  }

  /** The ids held, as a set — what `rollScroll` wants. */
  get foundIds(): ReadonlySet<string> {
    return new Set(Object.keys(this.ledger.found));
  }

  get foundCount(): number {
    return Object.keys(this.ledger.found).length;
  }

  get totalScrolls(): number {
    return LORE_SCROLLS.length;
  }

  /** Scrolls held, in canonical chapter order rather than discovery order. */
  get found(): LoreScroll[] {
    return LORE_SCROLLS
      .filter(s => this.isFound(s.id))
      .map(s => ({ ...s, unlockedAt: this.foundAt(s.id) ?? undefined }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Read state
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Whether the visitor has opened this scroll.
   *
   * Tracked separately from `found` because a scroll can be granted mid-strike
   * while the player is watching a rune reveal, and a codex that called that
   * "read" would lose the one dot telling them there is something new waiting.
   */
  isRead(id: string): boolean {
    return this.ledger.read.includes(id);
  }

  markRead(id: string): void {
    if (!this.isBrowser || !this.isFound(id) || this.isRead(id)) return;
    this.ledger.read = [...this.ledger.read, id];
    this.save();
    this.changed$$.next(this.changed$$.value + 1);
  }

  /** Found but not yet opened. Drives the badge on the Codex tab. */
  get unreadCount(): number {
    return Object.keys(this.ledger.found).filter(id => !this.isRead(id)).length;
  }

  /** Wipe the scroll ledger. Dev-only, mirrors the other reset methods. */
  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyLedger();
    this.store.remove(SCROLLS_KEY);
    this.changed$$.next(this.changed$$.value + 1);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): ScrollLedger {
    try {
      const raw = this.store.readRaw(SCROLLS_KEY);
      if (!raw) return emptyLedger();
      const parsed = JSON.parse(raw) as Partial<ScrollLedger>;

      // Drop anything no longer in the registry. A retired scroll left in the
      // ledger would count toward "25 of 25" while being unreachable and
      // unreadable, which is the one bug that would make the completion
      // achievement fire for a codex the visitor cannot actually open.
      const found: Record<string, string> = {};
      for (const [id, at] of Object.entries(parsed.found ?? {})) {
        if (scrollById(id)) found[id] = at;
      }

      return {
        ...emptyLedger(),
        ...parsed,
        found,
        read: (parsed.read ?? []).filter(id => id in found),
        version: 1,
      };
    } catch {
      return emptyLedger();
    }
  }

  private save(): void {
    if (!this.isBrowser) return;
      this.store.write(SCROLLS_KEY, this.ledger);
  }
}
