/**
 * whereabouts.service.ts — the only writer of the synced `eclipse-whereabouts` blob (whereabouts.model.ts).
 *
 *   note(place)   the play view offers the Keeper's place (every two seconds while they moved a tile); the throttle
 *                 decides whether it goes to the gateway now (area change, a minute since the last write, the first
 *                 place of the page) or is held back.
 *   flush         registered with LocalSaveRegistry: the gateway's pagehide / tab-hidden / pre-pull owner flush writes
 *                 the held-back place, so the last steps of a session are never lost and never cost a write a frame.
 *   wakePlace()   where to wake: this device's own last place or the synced one, whichever is newer.
 *
 * The gateway does the rest: the blob is a SYNCED_BLOBS entry merged newest-wins (mergeWhereabouts), per character.
 * On the server it is inert.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GameStateGateway } from './game-state.gateway';
import { LocalSaveRegistry } from './local-save-registry.service';
import {
  WHEREABOUTS_KEY, WhereaboutsThrottle, coercePlace, coerceWhereabouts, pickWakePlace, type Place, type Whereabouts,
} from './whereabouts.model';

@Injectable({ providedIn: 'root' })
export class WhereaboutsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly throttle = new WhereaboutsThrottle();
  private registered = false;
  /** Writes made this page (for the specs and the sync log's curiosity). */
  writes = 0;

  /** The Keeper's place now. Written to the synced key when the throttle says so; otherwise held for the flush. */
  note(place: unknown, now = Date.now()): void {
    if (!this.isBrowser) return;
    const p = coercePlace(place);
    if (!p) return;
    this.register();
    if (this.throttle.offer(p, now)) this.write({ version: 1, td: p, at: now });
  }

  /** Write the held-back place, if any (the owner flush; also safe to call by hand). */
  flush(): void {
    const held = this.throttle.pending;
    if (!held) return;
    this.throttle.sent(held.place, held.at);
    this.write({ version: 1, td: held.place, at: held.at });
  }

  /** The synced place on this device's copy (the gateway's pull keeps it current). */
  synced(): Whereabouts | null {
    return this.isBrowser ? coerceWhereabouts(this.store.read(WHEREABOUTS_KEY)) : null;
  }

  /** Where to wake: this device's last place (`local`: the device blob, `tdAt` its stamp) or the synced one, the newer. */
  wakePlace(local: { td?: unknown; tdAt?: unknown } | null): Place | null {
    return pickWakePlace(local, this.isBrowser ? this.store.read(WHEREABOUTS_KEY) : null);
  }

  private write(next: Whereabouts): void {
    this.store.write(WHEREABOUTS_KEY, next);
    this.writes += 1;
  }

  /**
   * Registered as the key's owner on first use, so the gateway's owner flush (pagehide, the tab hidden, before a pull)
   * writes the held-back place. Nothing to rehydrate: the place is read fresh when needed, and a newer place adopted
   * from another device never teleports a Keeper mid-session (it is where the *next* session wakes).
   */
  private register(): void {
    if (this.registered) return;
    this.registered = true;
    this.saves.register(WHEREABOUTS_KEY, { flush: () => this.flush(), rehydrate: () => { /* read fresh on demand */ } });
  }
}
