/**
 * arena-scores.service.ts — the Arena's own ledger.
 *
 * Two things are remembered per game: the best run and whether the visitor has
 * ever played it (which is what drives the NEW badge on the card). Kept in its
 * own localStorage key rather than inside `ProgressState`, because a high score
 * is Arena furniture, not progression — wiping one should not wipe the other.
 *
 * XP is not stored here. Every award goes through `XpService.award()` so the
 * economy stays auditable in one place; this service only decides *whether* a
 * run has earned one.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { XpService } from '../../shared/gamification/xp.service';
import { GameStateGateway } from '../../shared/save/game-state.gateway';
import { LocalSaveRegistry } from '../../shared/save/local-save-registry.service';
import { REPEAT_WIN_XP, playableById } from './arena-game.model';

export const ARENA_SCORES_KEY = 'eclipse-arena-scores';

export interface ArenaRecord {
  /** Highest score ever posted. Every game normalises so higher is better. */
  best: number;
  /** Completed runs, win or lose. Zero means the NEW badge still shows. */
  plays: number;
  /** True once the game has been beaten at least once. */
  cleared: boolean;
}

interface ArenaLedger {
  version: 1;
  games: Record<string, ArenaRecord>;
}

function emptyRecord(): ArenaRecord {
  return { best: 0, plays: 0, cleared: false };
}

/** What a finished run earned, so the game can show the right end card. */
export interface RunResult {
  score: number;
  /** True when this run beat the stored best. */
  isBest: boolean;
  previousBest: number;
  /** XP actually awarded — 0 when the run did not qualify. */
  xpAwarded: number;
  /** True when this was the first ever clear, which pays the full reward. */
  firstClear: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArenaScoresService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly xp = inject(XpService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private ledger: ArenaLedger = { version: 1, games: {} };
  private loaded = false;

  /**
   * Read the ledger once per session. Idempotent, so every game can call it in
   * `ngOnInit` without coordinating who runs first. On the server it leaves the
   * empty ledger in place, which renders as "no score yet" — the honest state
   * for a visitor the server has never met.
   */
  init(): void {
    if (!this.isBrowser || this.loaded) return;
    this.loaded = true;
    this.read();

    // `persist()` writes the whole ledger from memory, so a best score set on
    // another device would be dropped by the next run finished on this one. The
    // structural merge takes the higher `best` and `plays` and ORs `cleared`, so
    // re-reading can only ever raise a number here.
    this.saves.register(ARENA_SCORES_KEY, { rehydrate: () => this.read() });
  }

  /** Replace the ledger from storage. Hydration, and cloud save's rehydrate. */
  private read(): void {
    try {
      const raw = this.store.readRaw(ARENA_SCORES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ArenaLedger>;
      if (parsed && typeof parsed === 'object' && parsed.games) {
        this.ledger = { version: 1, games: parsed.games };
      }
    } catch {
      /* corrupt or unavailable storage — an empty ledger is a fine fallback */
    }
  }

  record(gameId: string): ArenaRecord {
    return this.ledger.games[gameId] ?? emptyRecord();
  }

  best(gameId: string): number {
    return this.record(gameId).best;
  }

  /** True when the visitor has never finished a run — drives the NEW badge. */
  isNew(gameId: string): boolean {
    return this.record(gameId).plays === 0;
  }

  hasCleared(gameId: string): boolean {
    return this.record(gameId).cleared;
  }

  /**
   * Bank a finished run and pay whatever it earned.
   *
   * The economy: the first clear pays the game's full reward, once, banked as
   * an achievement id so a page reload cannot re-collect it. After that only a
   * run that beats your own best pays, and only `REPEAT_WIN_XP` — enough that
   * chasing a personal best is worth something, small enough that grinding an
   * easy game is not a strategy. A loss updates the play count and the score
   * board but never pays.
   *
   * `xpOverride` lets a game charge for its own run — Shadow Cipher bills
   * hints against the first-clear reward. It can only ever lower the payout;
   * a game cannot mint more XP than its registry entry promises.
   */
  submit(gameId: string, score: number, won: boolean, xpOverride?: number): RunResult {
    const previousBest = this.best(gameId);
    const result: RunResult = {
      score,
      isBest: score > previousBest,
      previousBest,
      xpAwarded: 0,
      firstClear: false,
    };

    if (!this.isBrowser) return result;

    const current = this.record(gameId);
    const next: ArenaRecord = {
      best: Math.max(previousBest, score),
      plays: current.plays + 1,
      cleared: current.cleared || won,
    };
    this.ledger.games[gameId] = next;
    this.persist();

    if (!won) return result;

    const game = playableById(gameId);
    if (!game) return result;

    // `claimAchievement` returns false when the id is already banked, which is
    // exactly the first-clear test — no separate flag to keep in sync.
    const firstClear = this.xp.claimAchievement(`arena-clear-${gameId}`);
    if (firstClear) {
      const payout = Math.max(0, Math.min(game.xpReward, xpOverride ?? game.xpReward));
      if (payout > 0) this.xp.award('game-win', { amount: payout, energy: game.energy });
      result.firstClear = true;
      result.xpAwarded = payout;
    } else if (result.isBest) {
      this.xp.award('game-win', { amount: REPEAT_WIN_XP, energy: game.energy });
      result.xpAwarded = REPEAT_WIN_XP;
    }

    return result;
  }

  private persist(): void {
      this.store.write(ARENA_SCORES_KEY, this.ledger);
  }
}
