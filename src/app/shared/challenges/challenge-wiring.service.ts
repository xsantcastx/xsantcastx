/**
 * challenge-wiring.service.ts — turns what a player actually does into
 * Contract Board progress.
 *
 * The same shape as `quest-wiring.service.ts`, and for the same reason: every
 * signal the board cares about is already published by the service that owns
 * it, so nothing here needs a new listener bolted onto a component. This file
 * is a switchboard — six subscriptions and one `record()` each — and it is
 * deliberately the only place a challenge counter is written outside the
 * service's own API.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DELIBERATELY DOES NOT SUBSCRIBE TO
 * ─────────────────────────────────────────────────────────────────────────────
 * Two sources report themselves rather than being watched from here:
 * `ExplorerService` on settlement, and `ActivityProgressionGateway` on a
 * resolved mine or forage. Both are pushes from inside the transaction that
 * already happened.
 *
 * The reason is the eager bundle. This service is injected by `AppComponent`,
 * so everything it imports is in the *initial* chunk on every page of the site
 * — including the 126 tool pages, none of which have an expedition or a seam on
 * them. Pulling the explorer and the activity gateway in here dragged both, and
 * their models, across the 1.85 MB initial-bundle budget for a feature that
 * neither page can use.
 *
 * Inverting it costs one line in each of those services and puts the count
 * inside the write that caused it, which is also strictly more accurate than
 * the alternative: the gateway has no per-action event, so watching it from
 * outside would have meant diffing its 256-op ledger and seeding the diff on
 * the first snapshot to avoid paying a returning player for their own save.
 *
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { ChallengeService } from './challenge.service';
import { tierRank } from './challenge.model';
import { ComboService } from '../economy/combo.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { canonicalizePlayerPath } from '../canonical-routes';

@Injectable({ providedIn: 'root' })
export class ChallengeWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly challenges = inject(ChallengeService);
  private readonly runeForge = inject(RuneForgeService);
  private readonly combo = inject(ComboService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);

  private started = false;
  private readonly subs = new Subscription();

  /**
   * Halls that do not count toward `hall-variety`.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS IS A DENY-LIST AND NOT A LIST OF HALLS
   * ───────────────────────────────────────────────────────────────────────────
   * The card this metric was written for said "visit 5 different tool pages",
   * and the set it matched against was built from `TOOLS_REGISTRY`. It could
   * never have read higher than zero: the 126 tool routes are retired from the
   * router, and `CANONICAL_REDIRECTS` sends every one of them to `/world`. The
   * registry is still shipped — the lore and the quest board name tools out of
   * it — so the set built fine, matched nothing, and the card sat at 0/5
   * forever on every account. Nothing throws when a counter cannot move.
   *
   * The second attempt hard-coded the sixteen halls, which fixed the count and
   * left a list that has to be edited every time a hall is added — and which
   * cannot be written correctly at all for `/world/realms/:realmId`, because
   * the segment the router wants there is not the `RealmId` the realm model
   * publishes.
   *
   * So the router is asked instead. `hallOf` below records any route that
   * actually matched a declared path, which is authoritative by construction:
   * a new hall counts the day it is routed, a bogus URL falls to the wildcard
   * and counts as nothing, and there is no second list to keep in step. This
   * set is only the handful of matched routes that are still not places a
   * player *goes*.
   */
  private readonly notAHall = new Set<string>(['/admin']);

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.challenges.init();

    // ── The anvil ────────────────────────────────────────────────────────────
    // `copies` is 2 when worn strikePower sheared a second rune off one strike,
    // so a challenge counting runes counts runes rather than button presses.
    this.subs.add(this.runeForge.find$.subscribe(find => {
      this.challenges.record('rune-forged', find.copies ?? 1);
      this.challenges.recordPeak('rune-tier', tierRank(find.rune.tier));
    }));

    this.subs.add(this.runeForge.craft$.subscribe(() => {
      this.challenges.record('runeword-crafted', 1);
    }));

    // ── The combo ────────────────────────────────────────────────────────────
    // A peak, not a tally. The snapshot publishes on every strike and on every
    // break; `recordPeak` drops anything at or below the mark already held, so
    // the break's zero and the four hundred strikes on the way up cost one
    // write between them.
    this.subs.add(this.combo.snapshot$.subscribe(snap => {
      this.challenges.recordPeak('combo-peak', snap.count);
    }));

    // ── Gold ─────────────────────────────────────────────────────────────────
    // Mints only. `gain$` also carries spends as negatives, and a challenge
    // that counted those would pay a player for buying things.
    //
    // Challenge claims themselves are excluded: paying a challenge and then
    // counting that payment toward "earn 250,000 Gold" is a board that
    // completes itself.
    this.subs.add(this.economy.gain$.subscribe(gain => {
      if (gain.currency !== 'gold' || gain.amount <= 0) return;
      if (gain.source === 'challenge') return;
      this.challenges.record('gold-earned', gain.amount);
    }));

    // Expeditions and the seams are *not* subscribed here — they report
    // themselves. See the note at the top of the file.

    // ── Kit ──────────────────────────────────────────────────────────────────
    this.subs.add(this.inventory.equipped$.subscribe(() => {
      this.challenges.record('item-equipped', 1);
    }));
    this.subs.add(this.inventory.improved$.subscribe(() => {
      this.challenges.record('item-upgraded', 1);
    }));

    // ── Halls walked ─────────────────────────────────────────────────────────
    // Counted off the router, with the distinct-member bookkeeping in the
    // service so it persists for the period — see the note on
    // `ChallengeState.daySets`. A set held in memory here would let one hall
    // count five times across five reloads.
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => this.onNavigate(e.urlAfterRedirects || e.url)),
    );
  }

  private onNavigate(url: string): void {
    const hall = this.hallOf(url);
    if (!hall) return;
    this.challenges.recordMember('hall-variety', hall);
  }

  /**
   * The hall this URL landed in, or null when it is not one.
   *
   * Null in three cases: the URL fell through to the wildcard, so it is a 404
   * and not a place; it matched something on `notAHall`; or the canonicaliser
   * folded it onto a hall the player is already standing in, which is what
   * every retired product route does and is why a visit to `/tools/anything`
   * counts as `/world` rather than as a new member.
   */
  private hallOf(url: string): string | null {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    // '**' is the not-found route. A path that only matched the wildcard is a
    // URL, not a hall, and counting it would make the card free to anyone who
    // typed nonsense into the address bar five times.
    if (!route.routeConfig || route.routeConfig.path === '**') return null;

    const path = canonicalizePlayerPath(normalisePath(url));
    return this.notAHall.has(path) ? null : path;
  }

  /** Only the specs tear this down; the app holds it for the session. */
  destroy(): void {
    this.subs.unsubscribe();
  }
}

/**
 * A route reduced to the part that identifies the page.
 *
 * Query and hash go because `/codex?utm_source=x` is the same hall arrived at
 * differently, and a trailing slash goes because the router emits both forms
 * and two members for one hall would make the card easier than it reads.
 */
function normalisePath(url: string): string {
  const path = (url || '').split('?')[0].split('#')[0];
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
