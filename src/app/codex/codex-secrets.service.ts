/**
 * codex-secrets.service.ts — observes the secrets that are not easter eggs.
 *
 * Three signals, all of them things the site already does. Nothing here changes
 * behaviour; it only writes down that the behaviour happened.
 *
 *   ritual mode      — `body.ritual-open` is toggled by the arcane seal, the
 *                      Konami handler and `xsantcastx.reveal()`. One
 *                      MutationObserver covers all three entry points, so the
 *                      three console/easter-egg secrets that hang off ritual
 *                      mode stay correct however it was opened.
 *   command palette   — a global Cmd/Ctrl+K, matching what CommandPaletteService
 *                      binds. Watching the keystroke rather than reaching into
 *                      that service keeps this a passive observer.
 *   routes            — visits to the pages nothing links to.
 *
 * The console banner is inferred from ritual mode too: the banner is what tells
 * you `reveal()` exists, so having used it is evidence of having read it.
 *
 * Init is called from AppComponent alongside the other global services, not from
 * the Codex, so a secret found on any page is recorded when it happens rather
 * than being invisible until someone opens /codex.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SECRETS } from './codex-secrets';

export const SECRETS_KEY = 'codex-secrets';

/** How a secret came to be recorded. Shown on the card once found. */
export type SecretSource = 'ritual' | 'palette' | 'route' | 'egg';

export interface SecretRecord {
  at: string;
  how: SecretSource;
}

type SecretLedger = Record<string, SecretRecord>;

/** Human phrasing for `SecretRecord.how`. */
export const SECRET_SOURCE_LABEL: Record<SecretSource, string> = {
  ritual: 'the veil parted',
  palette: 'summoned by keystroke',
  route: 'walked into it',
  egg: 'found in a tool',
};

@Injectable({ providedIn: 'root' })
export class CodexSecretsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private started = false;
  private ledger: SecretLedger = {};
  private observer?: MutationObserver;
  private keyHandler?: (e: KeyboardEvent) => void;

  private readonly changed$$ = new BehaviorSubject<number>(0);
  /** Emits the found-count whenever the ledger grows. */
  readonly changed$: Observable<number> = this.changed$$.asObservable();

  /** Routes worth recording, resolved once from the registry. */
  private readonly watchedRoutes = new Set(
    SECRETS.map(s => s.route).filter((r): r is string => !!r)
  );

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.load();
    this.watchRitual();
    this.watchPalette();
    this.watchRoutes();
  }

  isFound(id: string): boolean {
    return !!this.ledger[id];
  }

  record(id: string): SecretRecord | null {
    return this.ledger[id] ?? null;
  }

  /** Number of ledger-tracked secrets found. Egg-backed ones are counted by the
   *  Codex against the egg registry, not here. */
  get foundCount(): number {
    return Object.keys(this.ledger).length;
  }

  /**
   * Write a secret down. First write wins — a secret's date is when you found
   * it, not the last time you happened to trip the same detector.
   */
  mark(id: string, how: SecretSource): void {
    if (!this.isBrowser || this.ledger[id]) return;
    this.ledger = { ...this.ledger, [id]: { at: new Date().toISOString(), how } };
    this.persist();
    this.changed$$.next(this.foundCount);
  }

  // ── Detectors ─────────────────────────────────────────────────────────────

  /**
   * Ritual mode. Checked once up front because the class may already be on the
   * body — the seal's inline onclick runs before Angular boots — and then
   * watched, because it can be opened at any time from three different places.
   */
  private watchRitual(): void {
    const check = () => {
      if (!document.body.classList.contains('ritual-open')) return;
      this.mark('ritual-veil', 'ritual');
      this.mark('console-reveal', 'ritual');
      this.mark('console-audio', 'ritual');
      this.mark('console-banner', 'ritual');
    };

    check();

    // Outside the zone: a class flip on <body> is not something any template
    // binds to, and running change detection on it would be pure cost.
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(check);
      this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  }

  private watchPalette(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        this.mark('command-palette', 'palette');
      }
    };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.keyHandler!, { passive: true });
    });
  }

  private watchRoutes(): void {
    const settle = (url: string) => {
      const path = url.split('?')[0].split('#')[0];
      if (!this.watchedRoutes.has(path)) return;
      for (const secret of SECRETS) {
        if (secret.route === path) this.mark(secret.id, 'route');
      }
    };

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => settle(e.urlAfterRedirects));
    settle(this.router.url);
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(SECRETS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Drop ids the registry no longer knows. `foundCount` is the number of
        // keys in here and the Codex shows it against SECRETS.length, so a
        // secret that has since been retired — /guestbook went with the
        // portfolio in the full migration — would otherwise keep counting and
        // read as "13 of 12 found" for anyone who had already tripped it.
        const known = new Set(SECRETS.map(s => s.id));
        this.ledger = Object.fromEntries(
          Object.entries(parsed as SecretLedger).filter(([id]) => known.has(id))
        );
      }
    } catch {
      this.ledger = {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(SECRETS_KEY, JSON.stringify(this.ledger));
    } catch {
      /* quota or private mode — the secret still reads as found this session */
    }
  }
}
