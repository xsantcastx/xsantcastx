/**
 * IN_WORLD_PANEL — true when a page is rendered inside the /play side-scroller
 * as a place in the world, rather than as its own route.
 *
 * Provided only by the side-scroller's panel host (play/side-scroller.component).
 * A page reads it with `injectInWorldPanel()` and, when true, drops what only
 * makes sense full-page: the fixed full-viewport backdrop (app-art-scene, the
 * rune forge's own scene) and the oversized hero/headline — the panel already
 * carries the place's name.
 */
import { InjectionToken, inject } from '@angular/core';

export const IN_WORLD_PANEL = new InjectionToken<boolean>('IN_WORLD_PANEL');

/** Whether the current injection context is inside an in-world panel. Call in a field initializer or constructor. */
export function injectInWorldPanel(): boolean {
  return inject(IN_WORLD_PANEL, { optional: true }) ?? false;
}

/**
 * What an in-world bench opens on. 'ready': only what can be made right now,
 * even when that is nothing (a camp in the Delve: "what can I craft here?").
 * Absent: the page's own default.
 */
export const IN_WORLD_FOCUS = new InjectionToken<'ready'>('IN_WORLD_FOCUS');

export function injectInWorldFocus(): 'ready' | null {
  return inject(IN_WORLD_FOCUS, { optional: true }) ?? null;
}

/**
 * HOME_FORGE: present only when a bench was opened from the player's own
 * Homestead station (Your Anvil / Your Enchanting Circle). It reports the
 * station tiers bought there (home-forge model); the bench hands them to the
 * mini-games. Absent everywhere else (town benches, the Delve camp, the routed
 * pages), so those keep today's behaviour exactly. Read live, so an upgrade
 * bought while the panel is open applies to the next game.
 */
export interface HomeForgeContext {
  anvilTier(): number;
  circleTier(): number;
}
export const HOME_FORGE = new InjectionToken<HomeForgeContext>('HOME_FORGE');

export function injectHomeForge(): HomeForgeContext | null {
  return inject(HOME_FORGE, { optional: true }) ?? null;
}

/**
 * IN_WORLD_STATION: the station a panel was opened from (its id, its label, its keeper), for a panel one component
 * serves at many stations (the district shops, shared/shops). Absent when the panel was opened another way.
 */
export interface InWorldStation { id: string; label: string; keeper?: string }
export const IN_WORLD_STATION = new InjectionToken<InWorldStation>('IN_WORLD_STATION');

export function injectInWorldStation(): InWorldStation | null {
  return inject(IN_WORLD_STATION, { optional: true }) ?? null;
}
