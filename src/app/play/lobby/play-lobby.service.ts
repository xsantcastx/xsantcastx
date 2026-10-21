/**
 * play-lobby.service.ts — what /play shows: the title, the character list, the Glass for a new Keeper, or the world.
 *
 * The play shell owns the decision; the world (SideScrollerComponent) only asks to leave through
 * {@link PlayLobbyService.requestSelect} from its menu. Device-local flags, none of them save state:
 *   - `eclipse-lobby-guest` (localStorage): this browser chose "Play offline" once, so it opens on the character list.
 *   - `eclipse-lobby` = 'skip' (localStorage) or `?lobby=skip`: go straight into the world. The e2e seed sets it so
 *     every older spec still lands in the world; it is also a developer shortcut. Nothing in the game sets it.
 *   - `eclipse-enter` / `eclipse-make` (sessionStorage): set just before the reload that switches character, so the new
 *     page enters that character's world (or opens the Glass for it) without showing the list again.
 */
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type LobbyMode = 'boot' | 'title' | 'select' | 'create' | 'game';

export const LOBBY_GUEST_KEY = 'eclipse-lobby-guest';
export const LOBBY_SKIP_KEY = 'eclipse-lobby';
export const LOBBY_ENTER_KEY = 'eclipse-enter';
export const LOBBY_MAKE_KEY = 'eclipse-make';
/** sessionStorage: the Keeper a New Keeper was started from, to go back to when the Glass is left without Become. */
export const LOBBY_FROM_KEY = 'eclipse-make-from';

/** Where /play opens, from the flags above (pure, so it is specced). */
export function initialLobbyMode(input: {
  character: string;
  skip: boolean;
  enter: string | null;
  make: string | null;
  signedIn: boolean;
  guest: boolean;
}): Exclude<LobbyMode, 'boot'> {
  if (input.make === input.character) return 'create';
  if (input.enter === input.character || input.skip) return 'game';
  if (input.signedIn || input.guest) return 'select';
  return 'title';
}

@Injectable({ providedIn: 'root' })
export class PlayLobbyService {
  private readonly select$$ = new Subject<void>();
  /** The world asked to go back to the character list (the shell saves, then shows it). */
  readonly selectRequested$ = this.select$$.asObservable();
  requestSelect(): void { this.select$$.next(); }
}
