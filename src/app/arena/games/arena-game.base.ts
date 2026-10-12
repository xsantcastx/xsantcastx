/**
 * arena-game.base.ts — the four lines every Arena game would otherwise repeat.
 *
 * Resolves the gate (is the unlocking egg found?), wires the score ledger, and
 * exposes the formatted best score for the shell's header chip. Subclasses own
 * everything else; this deliberately knows nothing about how a game is played.
 */
import { Directive, HostBinding, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { XpService } from '../../shared/gamification/xp.service';
import { ArenaScoresService, RunResult } from './arena-scores.service';
import { ArenaPlayableGame, formatScore, isPlayableGateOpen, playableById } from './arena-game.model';
import { injectInWorldPanel } from '../../shared/in-world-panel';

/**
 * How a game hosted inside the Trials gate (the in-world panel on /play) goes
 * back to the gates. Provided only by ArenaComponent's in-panel game overlay;
 * a game on its own route has no provider and links to /world/trials instead.
 */
export const ARENA_GAME_EXIT = new InjectionToken<() => void>('ARENA_GAME_EXIT');

@Directive()
export abstract class ArenaGameBase {
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly eggs = inject(EasterEggService);
  protected readonly scores = inject(ArenaScoresService);
  protected readonly xp = inject(XpService);
  /** True inside the Trials gate on /play: "Back to the Arena" closes the overlay instead of routing away. */
  @HostBinding('class.ag-in-world') protected readonly inWorld = injectInWorldPanel();
  private readonly exitGame = inject(ARENA_GAME_EXIT, { optional: true });

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
    this.best = this.scores.best(this.gameId);

    // Awaited, not fired and forgotten: `finishRun` calls `claimAchievement`,
    // which reads the ledger synchronously. A first clear banked before storage
    // resolved would be written into the empty blob and then overwritten by
    // hydration — the visitor would clear the gate and get nothing for it.
    await Promise.all([this.xp.init(), this.eggs.init()]);
    this.locked = !isPlayableGateOpen(this.game, id => this.eggs.isFound(id));
  }

  /** In-world "Back to the Arena": close the overlay, stay on /play. */
  protected leaveGame(): void {
    this.exitGame?.();
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
