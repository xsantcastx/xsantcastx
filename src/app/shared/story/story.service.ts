/**
 * story.service.ts — the Keeper's story record, through the save gateway.
 *
 * The only writer of `godforge-story` (story-save.model.ts). Read once on
 * first use, written through on every change, registered with
 * LocalSaveRegistry so a cloud merge lands in memory in the same tick instead
 * of being clobbered by a stale copy. On the server it is a read-only empty
 * state. The rules (which beat, which card, which lead) are pure, in story.ts.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, defer } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { STORY_KEY, StoryCardId, StorySceneId, StoryState, coerceStory, emptyStory } from './story-save.model';
import { StoryFacts, StoryLine, StoryReward, advanceStory, cardShown, pendingCard, pendingScenes, sceneById, scenePlayed } from './story';

@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private current: StoryState = emptyStory();
  private hydrated = false;
  private readonly state$$ = new BehaviorSubject<StoryState>(emptyStory());

  /** The record, now and on every change. */
  readonly state$: Observable<StoryState> = defer(() => { this.hydrate(); return this.state$$.asObservable(); });

  get state(): Readonly<StoryState> {
    this.hydrate();
    return this.current;
  }

  /**
   * Move the story on with this tick's facts (story.ts advanceStory). Returns
   * the lines to say now: empty while catching up (`live` false) or when
   * nothing new happened.
   */
  advance(facts: StoryFacts, live: boolean): StoryLine[] {
    this.hydrate();
    if (!this.isBrowser) return [];
    const result = advanceStory(this.current, facts, live);
    if (result.changed) this.save(result.state);
    return result.lines;
  }

  /** The act-boundary card waiting to be shown, or null. */
  pendingCard(): StoryCardId | null {
    return pendingCard(this.state);
  }

  /** The card was shown (read or skipped): it never comes back on its own. */
  cardShown(card: StoryCardId): void {
    this.hydrate();
    const next = cardShown(this.current, card);
    if (next !== this.current) this.save(next);
  }

  /** Act II scenes reached and not yet played, in story order. */
  pendingScenes(): StorySceneId[] {
    return pendingScenes(this.state);
  }

  /**
   * The scene was played (to its end, or skipped): RECEIPT FIRST, then the
   * reward. The scene id goes into `scenes` and is written before anything
   * moves, so a reload or a second tab can never pay twice; the stack grant is
   * itself idempotent on `story-scene:<id>`. Returns the reward paid now, or
   * null (already played, or its beat not reached).
   */
  playScene(id: StorySceneId): StoryReward | null {
    this.hydrate();
    if (!this.isBrowser) return null;
    const scene = sceneById(id);
    if (!scene || this.current.scenes.includes(id)) return null;
    const next = scenePlayed(this.current, id);
    if (!next.scenes.includes(id)) return null;
    this.save(next);
    const reward = scene.reward;
    if (reward.kind === 'title') this.economy.grantCosmetic('title-prefix', reward.variant);
    else if (reward.kind === 'stack') this.inventory.grantStack(`story-scene:${id}`, reward.item, reward.qty);
    return reward;
  }

  private save(next: StoryState): void {
    this.current = next;
    this.state$$.next(next);
    if (this.isBrowser) this.store.write(STORY_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceStory(this.store.read(STORY_KEY));
    this.state$$.next(this.current);
    this.saves.register(STORY_KEY, { rehydrate: () => { this.current = coerceStory(this.store.read(STORY_KEY)); this.state$$.next(this.current); } });
  }
}
