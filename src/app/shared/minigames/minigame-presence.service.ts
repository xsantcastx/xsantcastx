/**
 * minigame-presence.service.ts — "a station mini-game is on screen".
 *
 * The NPC bubble is a fixed bottom-left widget mounted beside the header; the
 * anvil and the rune ritual render inside a panel. At 390 px the bubble sits
 * squarely on the game's quiet Skip / Cancel link, which is the one control a
 * player must always be able to reach. The mini-games call `enter()` when they
 * mount and `leave()` when they are destroyed; the NPC widget yields (renders
 * nothing) while `active()` is true, and so does the corner Forge Flame, whose
 * centred phone layout puts its mode switch over the same link.
 *
 * A counter, not a boolean, so two games mounting/unmounting out of order can
 * never leave the bubble stuck hidden or shown. Imported by the eager NPC
 * widget, so it must stay this small — never import the minigames index here.
 */
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MinigamePresenceService {
  private readonly count = signal(0);

  /** True while at least one mini-game is mounted. */
  readonly active = computed(() => this.count() > 0);

  enter(): void { this.count.update(n => n + 1); }

  leave(): void { this.count.update(n => Math.max(0, n - 1)); }
}
