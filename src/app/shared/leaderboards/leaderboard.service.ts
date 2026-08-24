/**
 * leaderboard.service.ts — the seven numbers the boards rank you by.
 *
 * Owns no state and writes nothing. Its whole job is to ask seven services
 * that already hold the answer and hand back one record, which is what keeps
 * the boards from becoming an eighth ledger that can drift out of agreement
 * with the panels a player checks them against.
 *
 * Every read is defensive. A board is an ornament on progression, and a service
 * that has not hydrated yet — or has thrown — must cost the visitor a row of
 * zeroes, never the page.
 *
 * SSR: returns an all-zero record on the server, which is exactly what the
 * prerendered board needs. See `buildBoard` for why the row count does not
 * change between the two.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { ArenaService } from '../arena/arena.service';
import { arenaRankFor } from '../arena/arena.model';
import { CollectionService } from '../collection/collection.service';
import { CraftingService } from '../crafting/crafting.service';
import { EconomyService } from '../economy/economy.service';
import { ExplorerService } from '../explorer/explorer.service';
import { XpService } from '../gamification/xp.service';
import { InventoryService } from '../rpg/inventory.service';
import { qualityOf } from '../rpg/item-quality';
import {
  BoardView,
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
  type LeaderboardId,
  buildBoard,
} from './leaderboard.model';

/** What the visitor scores on each of the seven boards. */
export type PlayerScores = Record<LeaderboardId, number>;

export function emptyScores(): PlayerScores {
  return { xp: 0, gold: 0, collection: 0, arena: 0, quality: 0, expeditions: 0, crafting: 0 };
}

/**
 * The name on the player's row.
 *
 * "You" rather than an account name, and deliberately: the game has never asked
 * a visitor for a display name, the boards are a private ladder rather than a
 * public table, and inventing a name for the one row that is actually the
 * reader would be the only unhelpful label on the page.
 */
export const PLAYER_ROW_NAME = 'You';

function safe(read: () => number): number {
  try {
    const value = read();
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly xp = inject(XpService);
  private readonly economy = inject(EconomyService);
  private readonly collection = inject(CollectionService);
  private readonly arena = inject(ArenaService);
  private readonly inventory = inject(InventoryService);
  private readonly explorers = inject(ExplorerService);
  private readonly crafting = inject(CraftingService);

  init(): void {
    if (!this.isBrowser) return;
    // Each of these is idempotent and several are already up by the time any
    // page renders. Called anyway: /leaderboards is a lazy route a visitor can
    // land on cold, and a board of zeroes because nothing had hydrated yet
    // would read as a bug in the boards rather than in the ordering.
    try { this.economy.init(); } catch { /* an unhydrated ledger scores zero */ }
    try { this.collection.init(); } catch { /* as above */ }
    try { this.arena.init(); } catch { /* as above */ }
    try { this.inventory.init(); } catch { /* as above */ }
    try { this.explorers.init(); } catch { /* as above */ }
    try { this.crafting.init(); } catch { /* as above */ }
  }

  /** The best roll grade in the bag, 0–100. Zero with nothing rolled. */
  bestQuality(): number {
    if (!this.isBrowser) return 0;
    let best = 0;
    for (const item of this.inventory.snapshot.items) {
      const grade = qualityOf(item);
      if (typeof grade === 'number' && grade > best) best = grade;
    }
    return best * 100;
  }

  scores(): PlayerScores {
    if (!this.isBrowser) return emptyScores();
    this.init();
    return {
      xp: safe(() => this.xp.snapshot.xp),
      gold: safe(() => this.economy.snapshot.totalGoldEarned),
      collection: safe(() => this.collection.completion.percent),
      arena: safe(() => this.arena.snapshot.wins),
      quality: safe(() => this.bestQuality()),
      expeditions: safe(() => this.explorers.snapshot.missionsCompleted),
      crafting: safe(() => this.crafting.snapshot.xp),
    };
  }

  /**
   * The title beside the player's name.
   *
   * The arena rank on the Coliseum board — it is the one board where a title is
   * literally what you are ranked for — and the XP rank's lore title everywhere
   * else, which is the title the header's own XP bar already shows.
   */
  playerTitle(board: LeaderboardId): string {
    if (!this.isBrowser) return '';
    if (board === 'arena') return arenaRankFor(this.arena.snapshot.wins).title;
    try { return this.xp.snapshot.level.title; } catch { return ''; }
  }

  /** One board, built and ranked. */
  board(category: LeaderboardCategory, scores = this.scores()): BoardView {
    return buildBoard(
      category,
      scores[category.id] ?? 0,
      PLAYER_ROW_NAME,
      this.playerTitle(category.id),
    );
  }

  /** All seven, in tab order. One `scores()` read shared across them. */
  boards(): BoardView[] {
    const scores = this.scores();
    return LEADERBOARD_CATEGORIES.map(category => this.board(category, scores));
  }
}
