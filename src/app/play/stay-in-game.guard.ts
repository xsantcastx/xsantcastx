/**
 * stay-in-game.guard.ts — nothing in the game navigates away from /play.
 *
 * The game-only shell (docs/handoff/game-only-shell.md) retired every page that
 * used to stand beside the game. Their old URLs are router redirects into the
 * world (`/forge/crafting` → `/play?at=crafting`), so a link inside a hosted
 * panel that still names one lands back in the game: the guard sees the URL
 * AFTER redirects, and a `/play…` target is allowed.
 *
 * What it refuses is everything else — a link to a URL the router does not
 * know (the 404 page) or any future page added without a place in the world.
 * Refusing keeps the player in the game with their panel open, instead of
 * dropping them onto a page with no game on it. `/admin` is the owner's
 * dashboard and is reached by typing its address, so it stays open.
 */
import type { CanDeactivateFn } from '@angular/router';

export function staysInGame(url: string): boolean {
  const path = (url || '').split(/[?#]/)[0];
  return path === '/play' || path.startsWith('/play/') || path === '/admin' || path.startsWith('/admin/');
}

export const stayInGameGuard: CanDeactivateFn<unknown> = (_component, _current, _currentState, next) =>
  staysInGame(next?.url ?? '');
