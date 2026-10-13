/**
 * rtp-sim — the return-to-player harness every game of chance is proven with.
 *
 * Runs `plays` plays of a game's pure `play(rng, bet)` on one seeded stream
 * and reports what came back as a share of what went in. Deterministic for a
 * given seed, so a Karma spec and `scripts/economy-sim.mjs` print the same
 * number for the same run.
 *
 * Pure and import-free apart from the RNG, so node loads it directly.
 */
import { seededRng } from './seeded-rng';

export interface RtpReport {
  plays: number;
  bet: number;
  wagered: number;
  /** Gold worth returned (paid Gold + prize worth, as the game's `value` says). */
  returned: number;
  /** returned / wagered. */
  rtp: number;
  /** Share of plays that returned anything. */
  hitRate: number;
  /** Largest single return, in multiples of the bet. */
  maxX: number;
  /** Counts of each tag a play reported (e.g. 'bonus', 'big'). */
  tags: Record<string, number>;
}

export interface RtpGame<O> {
  play(rng: () => number, bet: number): O;
  /** Gold worth this outcome returned. */
  value(outcome: O): number;
  /** Optional labels to count ('bonus', 'prize', …). */
  tags?(outcome: O, bet: number): readonly string[];
}

export function simulateRtp<O>(game: RtpGame<O>, plays: number, bet: number, seed = 'rtp'): RtpReport {
  const rng = seededRng(seed);
  let returned = 0;
  let hits = 0;
  let maxX = 0;
  const tags: Record<string, number> = {};
  for (let i = 0; i < plays; i++) {
    const outcome = game.play(rng, bet);
    const v = game.value(outcome);
    returned += v;
    if (v > 0) hits++;
    if (v / bet > maxX) maxX = v / bet;
    if (game.tags) for (const t of game.tags(outcome, bet)) tags[t] = (tags[t] ?? 0) + 1;
  }
  const wagered = plays * bet;
  return { plays, bet, wagered, returned, rtp: returned / wagered, hitRate: hits / plays, maxX, tags };
}

/** Win celebration tiers, in multiples of the bet. Shared by every game. */
export const WIN_TIERS = { big: 10, mega: 50, eclipse: 200 } as const;
export type WinTier = keyof typeof WIN_TIERS;

export function winTier(win: number, bet: number): WinTier | null {
  if (!(bet > 0) || !(win > 0)) return null;
  const x = win / bet;
  if (x >= WIN_TIERS.eclipse) return 'eclipse';
  if (x >= WIN_TIERS.mega) return 'mega';
  if (x >= WIN_TIERS.big) return 'big';
  return null;
}
