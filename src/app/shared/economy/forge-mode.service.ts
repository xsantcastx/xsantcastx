/**
 * forge-mode.service.ts — which face the Forge Flame is showing.
 *
 * Two modes, one button. Gold is the clicker the ember has always been: click,
 * earn, hold a combo. Anvil turns the same button into the Rune Forge's lever —
 * every click spends `STRIKE_COST` Gold and pulls a rune out of the table.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT GAME STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything a player *earns* goes through `GameStateGateway`, because it is
 * the record and it has to survive a device change. This is not earned. It is
 * which side of a switch is up — a display preference on a widget, with the
 * same standing as "the install prompt was dismissed" (see `pwa.service.ts`,
 * which owns its key the same way). Putting it in the save blob would mean a
 * cloud write on every flip, a merge rule for a boolean nobody has an opinion
 * about, and a phone that silently changes what the button does because a
 * desktop tab toggled it an hour ago.
 *
 * So: plain localStorage, one key, wrapped in try/catch because private mode
 * throws on write and a widget preference must never be the thing that breaks
 * a page.
 *
 * SSR: `read()` returns the default on the server, which is what the
 * prerendered page should show — the Gold face, the one every visitor starts
 * on. The browser corrects it on hydration if the stored mode differs, which is
 * a one-frame swap on a decoration and not a hydration mismatch: the attribute
 * is written after init, not during template evaluation.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

/** The two faces. */
export type ForgeMode = 'gold' | 'anvil';

/** localStorage key holding the chosen face. */
export const FORGE_MODE_KEY = 'forge-flame-mode';

/** What a visitor with no stored preference gets. */
export const DEFAULT_FORGE_MODE: ForgeMode = 'gold';

function isMode(value: unknown): value is ForgeMode {
  return value === 'gold' || value === 'anvil';
}

@Injectable({ providedIn: 'root' })
export class ForgeModeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly mode$$ = new BehaviorSubject<ForgeMode>(DEFAULT_FORGE_MODE);

  /** The live mode, replayed. Safe to subscribe before `init()`. */
  readonly mode$: Observable<ForgeMode> = this.mode$$.asObservable();

  private loaded = false;

  get mode(): ForgeMode { return this.mode$$.value; }
  get isAnvil(): boolean { return this.mode$$.value === 'anvil'; }

  /**
   * Read the stored preference. Idempotent, and a no-op on the server.
   *
   * Called from the flame's `ngOnInit` rather than at bootstrap: a visitor who
   * never sees the ember — an embed, a prerender — should not pay a storage
   * read for a preference nothing is going to render.
   */
  init(): void {
    if (!this.isBrowser || this.loaded) return;
    this.loaded = true;
    const stored = this.read();
    if (stored !== this.mode$$.value) this.mode$$.next(stored);
  }

  set(mode: ForgeMode): void {
    if (!isMode(mode) || mode === this.mode$$.value) return;
    this.mode$$.next(mode);
    this.write(mode);
  }

  /** Flip to the other face. What the switch calls. */
  toggle(): ForgeMode {
    const next: ForgeMode = this.mode$$.value === 'gold' ? 'anvil' : 'gold';
    this.set(next);
    return next;
  }

  private read(): ForgeMode {
    if (!this.isBrowser) return DEFAULT_FORGE_MODE;
    try {
      const raw = localStorage.getItem(FORGE_MODE_KEY);
      return isMode(raw) ? raw : DEFAULT_FORGE_MODE;
    } catch {
      // Storage disabled. The default is a working forge, so there is nothing
      // to recover from and nothing to tell the visitor.
      return DEFAULT_FORGE_MODE;
    }
  }

  private write(mode: ForgeMode): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(FORGE_MODE_KEY, mode); } catch { /* private mode */ }
  }
}
