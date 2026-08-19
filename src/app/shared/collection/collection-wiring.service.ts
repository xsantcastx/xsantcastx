/**
 * collection-wiring.service.ts — turns "a thing was obtained" into a log entry.
 *
 * The same shape as `RpgWiringService` and `EconomyWiringService`: the ledger
 * must not depend on the systems that feed it, so the feeds are subscribed here
 * and pushed in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE RUNE FORGE IS NOT SUBSCRIBED FROM HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * Runes and Runewords are the two things this service does *not* watch, and the
 * reason is bundle shape rather than design taste. This wiring runs at app
 * bootstrap on all 126 routes; `RuneForgeService` is constructed only on the
 * Forge route and inside an expedition settlement, and it pulls the scroll
 * shelf, Magic Find, the explorer roster and the easter-egg service with it.
 * Injecting it to reach `find$` would move that whole graph into the initial
 * chunk to watch a subject that cannot emit until the visitor opens the Forge.
 *
 * So `RuneForgeService.grant()` and `.craft()` call `CollectionService.discover`
 * directly — they already reach for the scroll shelf, the XP ledger and the
 * Codex from the same two methods, and the dependency runs the way it does for
 * the same reason it does there.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY ARTIFACTS ARE A DIFF AND NOT AN EVENT
 * ─────────────────────────────────────────────────────────────────────────────
 * The five Market artifacts are bought through `EconomyService.buyArtifact`,
 * which publishes a snapshot and announces nothing else. Rather than add a
 * subject to the ledger for one caller, the wiring compares the owned list
 * against what the log already has — which is also what makes a cloud merge
 * that brings an artifact in from another device count as a discovery here.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { CollectionService } from './collection.service';
import { collectionIdForItem } from './collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly collection = inject(CollectionService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);

  private started = false;
  private readonly subs: Subscription[] = [];

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    // Both are idempotent, and both have to have hydrated before the backfill
    // inside `collection.init()` can read them — a bag that has not loaded
    // reports nothing held, and the log would credit the visitor with none of it
    // and then mark itself backfilled.
    this.economy.init();
    this.inventory.init();
    this.collection.init();

    this.subs.push(this.inventory.acquired$.subscribe(item => {
      const id = collectionIdForItem(item);
      if (id) this.collection.discover(id);
    }));

    this.subs.push(this.inventory.stackGranted$.subscribe(({ stackKey, quantity }) => {
      this.collection.discover(stackKey, quantity);
    }));

    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      for (const artifactId of snap.artifacts) {
        if (!this.collection.has(artifactId)) this.collection.discover(artifactId);
      }
      // Runewords are announced by the Forge, but a word adopted from another
      // device arrives here and nowhere else. `discover` is a no-op on an id
      // the log already holds, so the double cover costs a map lookup.
      for (const wordId of snap.runewords) {
        if (!this.collection.has(wordId)) this.collection.discover(wordId);
      }
    }));
  }

  /** Only the app shell holds this, and only for the life of the tab. */
  stop(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs.length = 0;
  }
}
