/**
 * crafting.service.ts — the crafting ladder's ledger.
 *
 * Owns exactly three facts: how much crafting XP the player has, how many times
 * they have crafted each recipe, and — because the second answers it — which
 * recipes they have ever discovered. Everything else about a craft (materials,
 * Gold, the minted item) belongs to a service that already owns it, which is
 * why this one injects nothing but the save layer.
 *
 * Same shape as `GamblerService`: the blob is loaded lazily on first read and
 * registered with `LocalSaveRegistry` at that moment rather than in an `init()`,
 * because the moment a cached copy starts existing is the moment a cloud pull
 * needs to be able to invalidate it.
 *
 * SSR-safe: every public method is a no-op or a pure read on the server.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  CRAFTING_KEY,
  type CraftingLevelView,
  type CraftingRecipe,
  type CraftingState,
  coerceCraftingState,
  craftXpFor,
  craftingLevelFor,
  craftingLevelView,
  emptyCraftingState,
  masteryBonusFor,
} from './crafting.model';

export interface CraftingSnapshot {
  xp: number;
  level: CraftingLevelView;
  /** recipe id → lifetime crafts. */
  crafted: Readonly<Record<string, number>>;
  /** How many distinct recipes have ever come off the anvil. */
  discovered: number;
  /** How many of those have reached mastery. */
  mastered: number;
}

/** What one settled craft moved on the ladder. */
export interface CraftingProgress {
  recipe: CraftingRecipe;
  xpGained: number;
  /** True the first time this recipe is ever crafted. */
  discovered: boolean;
  /** True on the craft that crosses the mastery threshold. */
  masteredNow: boolean;
  crafted: number;
  levelBefore: number;
  levelAfter: number;
}

@Injectable({ providedIn: 'root' })
export class CraftingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private state: CraftingState = emptyCraftingState();
  private loaded = false;

  private readonly snapshot$$ = new BehaviorSubject<CraftingSnapshot>(snapshotOf(emptyCraftingState()));
  private readonly progress$$ = new Subject<CraftingProgress>();

  readonly snapshot$: Observable<CraftingSnapshot> = this.snapshot$$.asObservable();
  /** One per settled craft. Not replayed — a level-up is a moment. */
  readonly progress$: Observable<CraftingProgress> = this.progress$$.asObservable();

  get snapshot(): CraftingSnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser) return;
    this.load();
    this.publish();
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  xp(): number { return this.load().xp; }

  level(): number { return craftingLevelFor(this.load().xp); }

  levelView(): CraftingLevelView { return craftingLevelView(this.load().xp); }

  craftedCount(recipeId: string): number { return this.load().crafted[recipeId] ?? 0; }

  hasCrafted(recipeId: string): boolean { return this.craftedCount(recipeId) > 0; }

  /** The roll-grade bonus this recipe has earned. 0 until it is mastered. */
  masteryBonus(recipeId: string): number { return masteryBonusFor(this.craftedCount(recipeId)); }

  /** Whether the ladder is high enough for this recipe. */
  meetsLevel(recipe: CraftingRecipe): boolean {
    return this.level() >= (recipe.requiredLevel ?? 1);
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Record that `recipe` came off the anvil.
   *
   * Called by `CraftingGateway` after the bag has accepted the item, never
   * before: a craft that failed to persist must not advance the ladder. Returns
   * what moved, so the caller can decide what to celebrate.
   */
  recordCraft(recipe: CraftingRecipe): CraftingProgress | null {
    if (!this.isBrowser) return null;
    const state = this.load();
    const before = craftingLevelFor(state.xp);
    const previous = state.crafted[recipe.id] ?? 0;
    const crafted = previous + 1;
    const xpGained = craftXpFor(recipe);

    this.state = {
      ...state,
      xp: state.xp + xpGained,
      crafted: { ...state.crafted, [recipe.id]: crafted },
    };
    this.persist();
    this.publish();

    const progress: CraftingProgress = {
      recipe,
      xpGained,
      discovered: previous === 0,
      masteredNow: masteryBonusFor(previous) === 0 && masteryBonusFor(crafted) > 0,
      crafted,
      levelBefore: before,
      levelAfter: craftingLevelFor(this.state.xp),
    };
    this.progress$$.next(progress);
    return progress;
  }

  /** Wipe the ladder. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyCraftingState();
    this.loaded = true;
    this.store.remove(CRAFTING_KEY);
    this.publish();
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  private load(): CraftingState {
    if (this.loaded) return this.state;
    this.loaded = true;
    if (!this.isBrowser) return this.state;

    this.saves.register(CRAFTING_KEY, {
      rehydrate: () => {
        this.loaded = false;
        this.load();
        this.publish();
      },
    });

    try {
      this.state = coerceCraftingState(this.store.read(CRAFTING_KEY));
    } catch {
      this.state = emptyCraftingState();
    }
    return this.state;
  }

  private persist(): void {
    this.store.write(CRAFTING_KEY, this.state);
  }

  private publish(): void {
    this.snapshot$$.next(snapshotOf(this.load()));
  }
}

function snapshotOf(state: CraftingState): CraftingSnapshot {
  const counts = Object.values(state.crafted);
  return {
    xp: state.xp,
    level: craftingLevelView(state.xp),
    crafted: { ...state.crafted },
    discovered: counts.filter(n => n > 0).length,
    mastered: counts.filter(n => masteryBonusFor(n) > 0).length,
  };
}
