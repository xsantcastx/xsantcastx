/**
 * world-feel.bus.ts — "something just happened" from a panel to the world.
 *
 * The Crafting Bench lives in a panel and knows nothing about the world view
 * around it; the world view knows where the satchel is and how to make a made
 * thing visibly travel into it (docs/handoff/world-feel.md, "Catch & craft").
 * This is the wire between them: the bench says what it made, the world shows
 * it pop, fly to the Satchel and land with a chime. With no world listening
 * (the bench on its own page) nothing happens, and nothing breaks.
 */
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface CraftedFeel {
  /** The made item's id (art key) and display name. */
  itemId: string;
  name: string;
  qty: number;
  /** Resolved art URL, when the bench has one. */
  art?: string;
  rarity?: string;
}

@Injectable({ providedIn: 'root' })
export class WorldFeelBus {
  private readonly crafted$$ = new Subject<CraftedFeel>();
  readonly crafted$ = this.crafted$$.asObservable();

  crafted(event: CraftedFeel): void {
    this.crafted$$.next(event);
  }
}
