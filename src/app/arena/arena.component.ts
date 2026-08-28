import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService, PUBLIC_CODEX_EGGS } from '../shared/easter-eggs/easter-egg.service';
import { QuestService } from '../shared/quests/quest.service';
import {
  EclipseRarity,
  RarityDefinition,
  rarityOf,
  tierForEgg,
} from '../shared/rarity/rarity.model';
import { ARENA_PLAYABLE, formatScore, isPlayableGateOpen, playableById } from './games/arena-game.model';
import { ArenaScoresService } from './games/arena-scores.service';
import { RouterModule } from '@angular/router';
import { ArtSceneComponent } from '../shared/art-scene/art-scene.component';

import { RelatedPagesComponent } from '../shared/seo/related-pages.component';
export interface ArenaGame {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** The egg that opens this gate. */
  unlockEggId: string;
  unlockHint: string;
  locked: boolean;
  /**
   * Where "Enter" leads, or null for a gate that is still flavour text. The
   * distinction is drawn on the card: an unplayable gate says so rather than
   * offering a button that does nothing.
   */
  route: string | null;
  /** Formatted personal best, empty when the gate has never been finished. */
  bestLabel: string;
  /** True for a playable gate the visitor has never finished — the NEW badge. */
  isNew: boolean;
  /**
   * Derived, never authored: a game inherits the tier of the egg that unlocks
   * it. That way the ladder means one thing across the whole site — a red
   * border on an arena card and a red drop toast are the same claim.
   */
  tier: EclipseRarity;
  rarity: RarityDefinition;
}

/** The registry, before tiers and progress are resolved. */
type GameSeed = Omit<ArenaGame, 'locked' | 'tier' | 'rarity' | 'route' | 'bestLabel' | 'isNew'>;

@Component({
  selector: 'app-arena',
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.css'],
  standalone: true,
  imports: [RelatedPagesComponent, RouterModule, ArtSceneComponent]
})
export class ArenaComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly quests = inject(QuestService);

  totalEggs = PUBLIC_CODEX_EGGS.length;
  foundCount = 0;

  private readonly scores = inject(ArenaScoresService);

  /**
   * The playable gates come first. Every entry in `ARENA_PLAYABLE` leads to a
   * real game; the ones after it are still flavour, and the card says so rather
   * than offering an "Enter" that goes nowhere.
   */
  private readonly seeds: GameSeed[] = ARENA_PLAYABLE.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    icon: g.icon,
    unlockEggId: g.unlockEggId,
    unlockHint: g.unlockHint,
  }));

  /**
   * Built once in the field initialiser so the template has real tiers to
   * render during prerender — a server-rendered card shows the right border
   * colour and the locked state, and hydration only flips what the visitor has
   * actually unlocked.
   */
  games: ArenaGame[] = this.seeds.map(seed => {
    const tier = tierForEgg(
      seed.unlockEggId,
      PUBLIC_CODEX_EGGS.find(e => e.id === seed.unlockEggId)?.rarity
    );
    return {
      ...seed,
      locked: true,
      tier,
      rarity: rarityOf(tier),
      route: playableById(seed.id)?.route ?? null,
      // Filled in on hydration. The server has no ledger to read, so a
      // prerendered card shows no score and no badge rather than a wrong one.
      bestLabel: '',
      isNew: false,
    };
  });

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    this.scores.init();
    await this.eggs.init();
    void this.eggs.trigger('trials-first');
    this.foundCount = this.eggs.foundCount;

    for (const game of this.games) {
      const playable = playableById(game.id);
      game.locked = playable
        ? !isPlayableGateOpen(playable, id => this.eggs.isFound(id))
        : !this.eggs.isFound(game.unlockEggId);

      if (!playable) continue;
      const best = this.scores.best(game.id);
      game.bestLabel = best > 0 ? formatScore(playable.scoreKind, best) : '';
      // NEW means never finished a run — and only worth saying on a gate the
      // visitor can actually walk through.
      game.isNew = !game.locked && this.scores.isNew(game.id);

      // The Arena Champion quest asks for three games *played*. Now that the
      // gates lead somewhere, a cleared run is a real signal and the quest no
      // longer has to settle for counting gates that were merely unlocked.
      if (this.scores.hasCleared(game.id)) this.quests.recordArenaGame(game.id);
    }
  }

  /** Playable gates, for the count in the hero. */
  get playableCount(): number {
    return this.games.filter(g => g.route).length;
  }

  get unlockedCount(): number {
    return this.games.filter(g => !g.locked).length;
  }

  get progressPercent(): number {
    return this.totalEggs > 0 ? Math.round((this.foundCount / this.totalEggs) * 100) : 0;
  }

  /**
   * The rarest gate you have actually opened. Null until you open one — an
   * arena stat that reports your best locked card would be meaningless.
   */
  get rarestUnlocked(): ArenaGame | null {
    return this.games
      .filter(g => !g.locked)
      .reduce<ArenaGame | null>(
        (best, g) => (!best || g.rarity.weight > best.rarity.weight ? g : best),
        null
      );
  }
}
