/**
 * arena.model.spec.ts — the fight, the ladder, and the blob that survives a
 * corrupt save.
 *
 * The invariants worth a test are the ones that cost a player something when
 * they break: a bout whose transcript disagrees with its verdict, a gate that
 * opens on the wrong wins, a payout that scales off a streak it should not, and
 * a coerce that loses a win count to one bad field.
 */
import {
  ARENA_COOLDOWN_MS,
  ARENA_OPPONENTS,
  ARENA_ROUNDS,
  ARENA_SHOP,
  ARENA_TIERS,
  ARENA_TIER_ORDER,
  MAX_STREAK_BONUS_WINS,
  arenaOpponentById,
  arenaRankFor,
  arenaTier,
  boutOdds,
  coerceArenaState,
  cooldownRemaining,
  emptyArenaState,
  formatCooldown,
  guardOf,
  mightOf,
  oddsLabel,
  opponentsForTier,
  payoutFor,
  resolveBout,
  roundOdds,
  tierUnlocked,
  type ArenaLoadout,
} from './arena.model';

/** A deterministic stream. Cycles, so a spec never runs off the end of it. */
function rolls(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const NAKED: ArenaLoadout = { rank: 1, strike: 0, ward: 0, forgePower: 0 };
const KITTED: ArenaLoadout = { rank: 30, strike: 40, ward: 12, forgePower: 20 };

describe('arena roster and tiers', () => {
  it('has five tiers in the documented order', () => {
    expect(ARENA_TIERS.map(t => t.id)).toEqual([...ARENA_TIER_ORDER]);
  });

  it('gives every tier exactly five opponents', () => {
    for (const tier of ARENA_TIER_ORDER) expect(opponentsForTier(tier).length).toBe(5);
    expect(ARENA_OPPONENTS.length).toBe(25);
  });

  it('has unique opponent ids that resolve', () => {
    const ids = new Set(ARENA_OPPONENTS.map(o => o.id));
    expect(ids.size).toBe(ARENA_OPPONENTS.length);
    for (const npc of ARENA_OPPONENTS) expect(arenaOpponentById(npc.id)).toBe(npc);
  });

  it('scales might, guard and every reward strictly upward across the tiers', () => {
    for (let i = 1; i < ARENA_TIERS.length; i++) {
      const prev = ARENA_TIERS[i - 1];
      const tier = ARENA_TIERS[i];
      expect(tier.gold).toBeGreaterThan(prev.gold);
      expect(tier.xp).toBeGreaterThan(prev.xp);
      expect(tier.points).toBeGreaterThan(prev.points);
      expect(tier.unlockWins).toBeGreaterThan(prev.unlockWins);

      const weakest = Math.min(...opponentsForTier(tier.id).map(o => o.might));
      const strongestBelow = Math.max(...opponentsForTier(prev.id).map(o => o.might));
      expect(weakest).toBeGreaterThan(strongestBelow);
    }
  });

  it('opens the first ring to everybody', () => {
    expect(ARENA_TIERS[0].unlockWins).toBe(0);
    expect(tierUnlocked(emptyArenaState(), 'bronze')).toBeTrue();
  });

  it('prices every shop row and points every equipment row at a real definition', () => {
    for (const stock of ARENA_SHOP) {
      expect(stock.cost).toBeGreaterThan(0);
      if (stock.kind === 'equipment') {
        expect(stock.definitionId).toBeTruthy();
        expect(stock.rarity).toBeTruthy();
        // A row that mints kit is one-per-account by design — see the note on
        // ARENA_SHOP for why an unlimited one would hollow out expeditions.
        expect(stock.once).withContext(stock.id).toBeTrue();
      }
    }
  });
});

describe('mightOf / guardOf', () => {
  it('gives a rank-1 player in nothing at all a floor to fight from', () => {
    expect(mightOf(NAKED)).toBeGreaterThanOrEqual(12);
    expect(guardOf(NAKED)).toBeGreaterThanOrEqual(4);
  });

  it('weights worn strike above bare rank', () => {
    const oneStrike = mightOf({ ...NAKED, strike: 1 }) - mightOf(NAKED);
    const oneRank = mightOf({ ...NAKED, rank: 2 }) - mightOf(NAKED);
    expect(oneStrike).toBeGreaterThan(oneRank);
  });

  it('ignores a negative or nonsense loadout instead of going below the floor', () => {
    expect(mightOf({ rank: 0, strike: -50, ward: -50, forgePower: -50 })).toBe(mightOf(NAKED));
    expect(guardOf({ rank: -3, strike: 0, ward: -1, forgePower: 0 })).toBe(guardOf(NAKED));
  });
});

describe('resolveBout', () => {
  const opponent = arenaOpponentById('bronze-hollis')!;

  it('runs exactly three rounds and consumes two rolls each', () => {
    const rng = jasmine.createSpy('rng').and.returnValue(0.5);
    const result = resolveBout(KITTED, opponent, rng);
    expect(result.rounds.length).toBe(ARENA_ROUNDS);
    expect(rng).toHaveBeenCalledTimes(ARENA_ROUNDS * 2);
  });

  it('agrees with its own transcript', () => {
    for (let seed = 0; seed < 12; seed++) {
      const rng = rolls((seed % 5) / 5, ((seed + 2) % 5) / 5, ((seed + 4) % 5) / 5);
      const result = resolveBout(NAKED, opponent, rng);
      expect(result.roundsWon).toBe(result.rounds.filter(r => r.playerWon).length);
      expect(result.won).toBe(result.roundsWon > ARENA_ROUNDS / 2);
    }
  });

  it('never lands a hit below one, however outmatched', () => {
    const result = resolveBout(NAKED, arenaOpponentById('void-unwritten')!, rolls(0));
    for (const round of result.rounds) {
      expect(round.playerHit).toBeGreaterThanOrEqual(1);
      expect(round.opponentHit).toBeGreaterThanOrEqual(1);
    }
    expect(result.won).toBeFalse();
  });

  it('gives a drawn round to the player', () => {
    // A loadout whose Might minus their Guard equals their Might minus ours,
    // rolled identically, is the tie the crowd is asked to settle.
    const mirror = { ...opponent, might: mightOf(NAKED), guard: guardOf(NAKED) };
    const result = resolveBout(NAKED, mirror, rolls(0.5));
    expect(result.rounds.every(r => r.playerHit === r.opponentHit)).toBeTrue();
    expect(result.won).toBeTrue();
  });

  it('is deterministic for the same stream', () => {
    const a = resolveBout(KITTED, opponent, rolls(0.1, 0.9, 0.4, 0.6, 0.2, 0.8));
    const b = resolveBout(KITTED, opponent, rolls(0.1, 0.9, 0.4, 0.6, 0.2, 0.8));
    expect(a).toEqual(b);
  });

  it('lets a strong loadout beat the ring it is meant to clear', () => {
    const result = resolveBout(KITTED, arenaOpponentById('bronze-drakeling')!, rolls(0.5));
    expect(result.won).toBeTrue();
  });
});

describe('odds', () => {
  it('reports certainty when the bands cannot overlap', () => {
    expect(roundOdds(KITTED, arenaOpponentById('bronze-hollis')!)).toBe(1);
    expect(roundOdds(NAKED, arenaOpponentById('void-unwritten')!)).toBe(0);
  });

  it('stays inside 0..1 for every pairing', () => {
    for (const npc of ARENA_OPPONENTS) {
      for (const loadout of [NAKED, KITTED, { rank: 12, strike: 6, ward: 3, forgePower: 5 }]) {
        const p = roundOdds(loadout, npc);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        expect(boutOdds(loadout, npc)).toBeGreaterThanOrEqual(0);
        expect(boutOdds(loadout, npc)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('amplifies a per-round edge over three rounds', () => {
    // Best-of-three is a sharpening function: an edge gets bigger, a deficit
    // gets worse, and a coin flip stays a coin flip.
    const npc = ARENA_OPPONENTS.find(o => roundOdds(KITTED, o) > 0.55 && roundOdds(KITTED, o) < 0.95);
    if (!npc) return;
    expect(boutOdds(KITTED, npc)).toBeGreaterThan(roundOdds(KITTED, npc));
  });

  it('labels the whole range', () => {
    expect(oddsLabel(0.99)).toBe('certain');
    expect(oddsLabel(0.7)).toBe('favoured');
    expect(oddsLabel(0.5)).toBe('even');
    expect(oddsLabel(0.2)).toBe('unlikely');
    expect(oddsLabel(0)).toBe('outmatched');
  });
});

describe('payoutFor', () => {
  const bronze = arenaTier('bronze')!;

  it('pays a loss nothing but the consolation points', () => {
    const payout = payoutFor(bronze, false, 7);
    expect(payout.gold).toBe(0);
    expect(payout.xp).toBe(0);
    expect(payout.points).toBe(bronze.consolationPoints);
    expect(payout.streakMultiplier).toBe(1);
  });

  it('pays a first win the tier rate exactly', () => {
    const payout = payoutFor(bronze, true, 0);
    expect(payout.gold).toBe(bronze.gold);
    expect(payout.xp).toBe(bronze.xp);
    expect(payout.points).toBe(bronze.points);
  });

  it('caps the streak bonus rather than compounding forever', () => {
    const atCap = payoutFor(bronze, true, MAX_STREAK_BONUS_WINS);
    const beyond = payoutFor(bronze, true, MAX_STREAK_BONUS_WINS + 500);
    expect(beyond).toEqual(atCap);
    expect(atCap.streakMultiplier).toBe(2);
  });
});

describe('tierUnlocked', () => {
  it('reads the ring below, not the lifetime total', () => {
    const state = { ...emptyArenaState(), wins: 999, tierWins: { bronze: 0 } };
    expect(tierUnlocked(state, 'silver')).toBeFalse();

    const earned = { ...emptyArenaState(), tierWins: { bronze: 5 } };
    expect(tierUnlocked(earned, 'silver')).toBeTrue();
    // Bronze wins must not reach past Silver — that is the whole point of
    // gating on the ring below.
    expect(tierUnlocked(earned, 'gold')).toBeFalse();
  });
});

describe('cooldown', () => {
  it('is open on a save that has never fought', () => {
    expect(cooldownRemaining(emptyArenaState(), 1_000_000)).toBe(0);
  });

  it('counts down and never goes negative', () => {
    const state = { ...emptyArenaState(), lastBoutAt: 1_000_000 };
    expect(cooldownRemaining(state, 1_000_000)).toBe(ARENA_COOLDOWN_MS);
    expect(cooldownRemaining(state, 1_000_000 + ARENA_COOLDOWN_MS)).toBe(0);
    expect(cooldownRemaining(state, 9_000_000)).toBe(0);
  });

  it('formats as minutes and seconds', () => {
    expect(formatCooldown(0)).toBe('ready');
    expect(formatCooldown(247_000)).toBe('4:07');
    expect(formatCooldown(60_000)).toBe('1:00');
  });
});

describe('coerceArenaState', () => {
  it('returns the empty build for anything that is not an object', () => {
    for (const junk of [null, undefined, 4, 'x', []]) {
      expect(coerceArenaState(junk).wins).toBe(0);
    }
  });

  it('keeps the good fields when one is corrupt', () => {
    const state = coerceArenaState({
      version: 1, points: 'lots', lifetimePoints: 40, wins: 12, losses: -3,
      streak: NaN, bestStreak: 9, tierWins: { bronze: 12, nowhere: 5 }, lastBoutAt: 7,
      purchases: ['arena-purse', 'arena-purse', 99], settled: ['a'],
    });
    expect(state.points).toBe(0);
    expect(state.wins).toBe(12);
    expect(state.losses).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(9);
    expect(state.tierWins).toEqual({ bronze: 12 });
    expect(state.purchases).toEqual(['arena-purse']);
  });

  it('never lets lifetime points fall below spendable points', () => {
    const state = coerceArenaState({ points: 500, lifetimePoints: 10 });
    expect(state.lifetimePoints).toBeGreaterThanOrEqual(state.points);
  });

  it('trims the settled list rather than growing it forever', () => {
    const settled = Array.from({ length: 500 }, (_, i) => `bout-${i}`);
    expect(coerceArenaState({ settled }).settled.length).toBeLessThanOrEqual(40);
  });
});

describe('arenaRankFor', () => {
  it('starts unranked and climbs monotonically', () => {
    expect(arenaRankFor(0).title).toBe('Unranked');
    let last = -1;
    for (const wins of [0, 1, 5, 12, 22, 35, 60, 1000]) {
      const rank = arenaRankFor(wins);
      expect(rank.wins).toBeGreaterThanOrEqual(last);
      last = rank.wins;
    }
    expect(arenaRankFor(1000).title).toBe('The Unwritten');
  });
});
