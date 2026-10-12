/**
 * player-market.mode.ts — which market the Exchange renders: the simulated
 * one, the live player market, or the dev-only fake.
 *
 * Small on purpose: the simulated Exchange reads this token on every visit, so
 * it must not pull the player market (or its fake) into the Exchange chunk.
 *
 * The fake is reachable only when Angular is in dev mode (`ng serve`, the
 * development build). A production build runs with dev mode off, so
 * `?market=fake` there resolves to whatever the client flag says — never fake.
 */
import { InjectionToken, inject, isDevMode } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MarketMode, PLAYER_MARKET_CLIENT_ENABLED, resolveMarketMode } from './player-market.model';

export const PLAYER_MARKET_MODE = new InjectionToken<MarketMode>('PLAYER_MARKET_MODE', {
  providedIn: 'root',
  factory: () => {
    let search: string | null = null;
    // The server's document carries the request URL too, so SSR and the
    // browser resolve the same mode and hydration sees the same branch.
    try { search = inject(DOCUMENT).location?.search ?? null; } catch { search = null; }
    return resolveMarketMode({ clientFlag: PLAYER_MARKET_CLIENT_ENABLED, devMode: isDevMode(), search });
  },
});
