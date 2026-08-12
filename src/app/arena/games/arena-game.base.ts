/**
 * arena-game.base.ts — the four lines every Arena game would otherwise repeat.
 *
 * Resolves the gate (is the unlocking egg found?), wires the score ledger, and
 * exposes the formatted best score for the shell's header chip. Subclasses own
 * everything else; this deliberately knows nothing about how a game is played.
 */
import { Directive, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { XpService } from '../../shared/gamification/xp.service';
import { ArenaScoresService, RunResult } from './arena-scores.service';
import { ArenaPlayableGame, formatScore, playableById } from './arena-game.model';

@Directive()
export abstract class ArenaGameBase {
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly eggs = inject(EasterEggService);
  protected readonly scores = inject(ArenaScoresService);
  protected readonly xp = inject(XpService);

  /** The registry entry for this game. Set by the subclass. */
  abstract readonly gameId: string;

  game!: ArenaPlayableGame;

  /**
   * Starts locked so the prerendered HTML shows the gate. Hydration is what
   * opens it — the server has no way to know what this visitor has found, and
   * rendering an open gate that snaps shut a moment later would be a lie in the
   * more annoying direction.
   */
  locked = true;
  best = 0;

  get bestLabel(): string {
    return this.best > 0 ? formatScore(this.game.scoreKind, this.best) : '';
  }

  /** Call from `ngOnInit`. Safe on the server, where it does nothing. */
  protected async resolveGate(): Promise<void> {
    this.game = playableById(this.gameId)!;
    if (!this.isBrowser) return;

    this.scores.init();
    this.xp.init();
    this.best = this.scores.best(this.gameId);

    await this.eggs.init();
    this.locked = !this.eggs.isFound(this.game.unlockEggId);
  }

  /**
   * Bank a finished run. Returns what it earned, for the end card.
   * `xpOverride` may only reduce the first-clear payout (see the ledger).
   */
  protected finishRun(score: number, won: boolean, xpOverride?: number): RunResult {
    const result = this.scores.submit(this.gameId, score, won, xpOverride);
    this.best = this.scores.best(this.gameId);
    return result;
  }
}
