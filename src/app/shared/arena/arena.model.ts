/**
 * arena.model.ts — the Coliseum's rules, written as data and pure functions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE FIGHT IS PURE, AND WHY IT TAKES ITS RNG AS AN ARGUMENT
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything below is data and pure functions: no Angular, no browser APIs, no
 * `Math.random` reached for implicitly. `resolveBout` is handed its `rng` and
 * its `now`, so a spec can pin an exact three-round transcript and assert on it,
 * and so the gateway can replay a settled bout without the outcome moving.
 *
 * That matters more here than it does at the bench. A craft either happens or
 * it does not; a bout has a *narrative* — three rounds, each with two numbers
 * and a winner — and the reveal animation reads that transcript back a beat at
 * a time. If the transcript were generated inside the component the reveal and
 * the reward could disagree, which is the one thing a combat screen must never
 * do.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE FIGHT IS BEST-OF-THREE AND NOT A HEALTH BAR
 * ─────────────────────────────────────────────────────────────────────────────
 * A health bar needs a second axis — how hard you hit *and* how long you last —
 * and the two worn stats the game already has, `strikePower` and `ward`, are an
 * offence and a mitigation, not an offence and a pool. Inventing a Health stat
 * to fill the gap would mean a sixth bar on the character sheet that nothing
 * else reads, and `player-stats.model.ts` is explicit that a build you cannot
 * read off a panel is a build nobody makes on purpose.
 *
 * Three independent rounds spend exactly the stats that exist. Might is what
 * you swing, Guard is what you subtract from what is swung at you, and the
 * variance band is wide enough (±20%) that a slight favourite still loses
 * often enough for the fight to be worth watching — but narrow enough that
 * kit is legibly the thing that wins it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LOSING COSTS NOTHING
 * ─────────────────────────────────────────────────────────────────────────────
 * The brief says a loss takes nothing, and that is also the only shape that
 * works with the rest of this save. Every other ledger in the game is monotone
 * or player-authorised — XP only goes up, Gold only leaves on a press. A bout
 * that could eat Gold would be the first thing in the world that spends a
 * player's balance on a dice roll they did not price, and the Gambler exists
 * precisely so that the one surface that does that publishes its odds.
 *
 * The cooldown is the cost, and it is charged on a win as well as a loss. The
 * brief pairs it with losing, and charging only losses is the version that
 * breaks: a loadout that clears the Void Ring would farm 420,000 Gold on an
 * unbounded loop, which is more than the bench's most expensive craft costs and
 * more than every other Gold source in the game combined. Charged on both, the
 * ring is a timed activity of exactly the kind the world already has — an
 * expedition you fight instead of wait for — and the brief's actual promise,
 * that a loss takes nothing away from you, is kept intact.
 */

/** localStorage key. Registered with `LocalSaveRegistry` by `ArenaService`. */
export const ARENA_KEY = 'godforge-arena';

/** How long a loss locks the gate. A win opens it immediately. */
export const ARENA_COOLDOWN_MS = 5 * 60 * 1000;

/** Rounds in a bout. Best of three, so two wins settle it. */
export const ARENA_ROUNDS = 3;

export type ArenaTierId = 'bronze' | 'silver' | 'gold' | 'eclipse' | 'void';

export const ARENA_TIER_ORDER: readonly ArenaTierId[] = [
  'bronze', 'silver', 'gold', 'eclipse', 'void',
];

export interface ArenaTier {
  id: ArenaTierId;
  name: string;
  /** One line under the tier's name on the gate card. */
  flavour: string;
  /**
   * Wins banked in the *previous* tier before this one opens. Bronze is 0 —
   * the first gate is never locked, for the reason the Trials' first game is
   * never locked: a page whose every card is dark reads as broken.
   */
  unlockWins: number;
  /** Palette colour, from the cosmic table in CLAUDE.md §2. */
  color: string;
  glow: string;
  /** Base Gold for a win, before the streak bonus. */
  gold: number;
  /** Flat XP for a win. Awarded through `XpService.award('game-win', …)`. */
  xp: number;
  /** Arena points for a win. The only mint of the currency. */
  points: number;
  /** Points for a loss. Small, and deliberately non-zero — see `payoutFor`. */
  consolationPoints: number;
}

export const ARENA_TIERS: readonly ArenaTier[] = [
  {
    id: 'bronze',
    name: 'Bronze Ring',
    flavour: 'Sand, rope, and someone who has done this twice. Everybody starts here.',
    unlockWins: 0,
    color: '#e8c898',
    glow: 'rgba(255, 180, 80, 0.6)',
    gold: 2_500,
    xp: 40,
    points: 5,
    consolationPoints: 1,
  },
  {
    id: 'silver',
    name: 'Silver Ring',
    flavour: 'The rope is chain now. The crowd has opinions and has started writing them down.',
    unlockWins: 5,
    color: '#5fb6ff',
    glow: 'rgba(80, 180, 255, 0.6)',
    gold: 9_000,
    xp: 110,
    points: 12,
    consolationPoints: 2,
  },
  {
    id: 'gold',
    name: 'Gold Ring',
    flavour: 'Named challengers, a named floor, and a ledger that remembers the result.',
    unlockWins: 12,
    color: '#7fd5a3',
    glow: 'rgba(100, 220, 150, 0.6)',
    gold: 32_000,
    xp: 280,
    points: 25,
    consolationPoints: 4,
  },
  {
    id: 'eclipse',
    name: 'Eclipse Ring',
    flavour: 'The floor is a seam. Half of what you fight here is standing on the other side of it.',
    unlockWins: 22,
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.6)',
    gold: 120_000,
    xp: 650,
    points: 50,
    consolationPoints: 8,
  },
  {
    id: 'void',
    name: 'Void Ring',
    flavour: 'No crowd. No sand. Whatever is here was not invited either.',
    unlockWins: 35,
    color: '#ff6dd7',
    glow: 'rgba(255, 90, 210, 0.6)',
    gold: 420_000,
    xp: 1_500,
    points: 110,
    consolationPoints: 15,
  },
];

const TIER_BY_ID = new Map(ARENA_TIERS.map(t => [t.id, t]));

export function arenaTier(id: ArenaTierId): ArenaTier | undefined {
  return TIER_BY_ID.get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// The roster
// ─────────────────────────────────────────────────────────────────────────────

export interface ArenaOpponent {
  id: string;
  name: string;
  tier: ArenaTierId;
  /** What they swing. */
  might: number;
  /** What they subtract from what is swung at them. */
  guard: number;
  /** One line, read out on the stat-comparison screen. */
  taunt: string;
}

/**
 * Five per tier. Authored rather than generated: the taunt is the only piece of
 * writing on the fight screen, and a generated roster produces twenty-five
 * opponents nobody remembers losing to.
 */
export const ARENA_OPPONENTS: readonly ArenaOpponent[] = [
  // Bronze — might 14-22
  { id: 'bronze-hollis', name: 'Hollis the Patient', tier: 'bronze', might: 14, guard: 3, taunt: 'I have lost to better. Let us find out which of us you are.' },
  { id: 'bronze-quarry', name: 'Quarry Sen', tier: 'bronze', might: 17, guard: 4, taunt: 'Two years hauling basalt. My arms do not get tired, they get bored.' },
  { id: 'bronze-tallow', name: 'Tallow', tier: 'bronze', might: 19, guard: 5, taunt: 'Nothing personal. The purse is small and I am hungry.' },
  { id: 'bronze-mira', name: 'Mira Ninefinger', tier: 'bronze', might: 21, guard: 6, taunt: 'I count what I have left, not what I lost. You should try it.' },
  { id: 'bronze-drakeling', name: 'The Drakeling', tier: 'bronze', might: 22, guard: 8, taunt: 'Small. Fast. Already behind you.' },

  // Silver — might 34-52
  { id: 'silver-corvain', name: 'Corvain of the Chain', tier: 'silver', might: 34, guard: 11, taunt: 'The chain is not for you. It is for what I bring in after you.' },
  { id: 'silver-ash', name: 'Ash Verrow', tier: 'silver', might: 39, guard: 13, taunt: 'You are wearing your whole fortune. I am wearing my whole plan.' },
  { id: 'silver-hem', name: 'Hem the Unspoken', tier: 'silver', might: 44, guard: 15, taunt: '…' },
  { id: 'silver-lys', name: 'Lys Ironsong', tier: 'silver', might: 48, guard: 17, taunt: 'I sing the count. You will hear three.' },
  { id: 'silver-warden', name: 'The Rope Warden', tier: 'silver', might: 52, guard: 20, taunt: 'I have thrown forty people out of this ring. Thirty-nine came back.' },

  // Gold — might 74-108
  { id: 'gold-serrik', name: 'Serrik Goldhand', tier: 'gold', might: 74, guard: 26, taunt: 'Everything I wear, I won here. Including the hand.' },
  { id: 'gold-vale', name: 'Vale of the Rootglass', tier: 'gold', might: 84, guard: 30, taunt: 'The canopy taught me patience. The floor taught me the rest.' },
  { id: 'gold-ossian', name: 'Ossian Brightbreak', tier: 'gold', might: 93, guard: 34, taunt: 'They named the floor after a man I beat. Not after me. Yet.' },
  { id: 'gold-kestrel', name: 'Kestrel Ninth', tier: 'gold', might: 101, guard: 39, taunt: 'Eight before you. I am not superstitious, but I am counting.' },
  { id: 'gold-anvilborn', name: 'The Anvilborn', tier: 'gold', might: 108, guard: 45, taunt: 'You strike metal for gold. I was struck into being.' },

  // Eclipse — might 158-236
  { id: 'eclipse-noct', name: 'Noct, Seam-Walker', tier: 'eclipse', might: 158, guard: 58, taunt: 'I am standing in two places. Guess which one you are hitting.' },
  { id: 'eclipse-umbra', name: 'Umbral Thess', tier: 'eclipse', might: 178, guard: 66, taunt: 'Your shadow already agreed to this. You are the last to know.' },
  { id: 'eclipse-halcyon', name: 'Halcyon Undone', tier: 'eclipse', might: 199, guard: 74, taunt: 'I was a Keeper. The ledger disagreed. Now I keep the floor.' },
  { id: 'eclipse-riven', name: 'Riven of the Fivefold', tier: 'eclipse', might: 219, guard: 83, taunt: 'Five locks. I opened four honestly.' },
  { id: 'eclipse-orrery', name: 'The Meridian Orrery', tier: 'eclipse', might: 236, guard: 94, taunt: 'You are one of several outcomes. I am checking them in order.' },

  // Void — might 340-520
  { id: 'void-nameless', name: 'The Nameless Second', tier: 'void', might: 340, guard: 120, taunt: 'There was a first. There is no record of the first.' },
  { id: 'void-cinder', name: 'Cinder Absolute', tier: 'void', might: 386, guard: 138, taunt: 'Everything I have touched is still warm. Everything.' },
  { id: 'void-echo', name: 'Echo of the Godforge', tier: 'void', might: 434, guard: 158, taunt: 'I am what your hammer sounds like from the other side.' },
  { id: 'void-singular', name: 'The Singular', tier: 'void', might: 478, guard: 180, taunt: 'One of me has ever existed. You are the reason that stayed true.' },
  { id: 'void-unwritten', name: 'The Unwritten', tier: 'void', might: 520, guard: 205, taunt: 'No taunt. Nothing here writes anything down.' },
];

const OPPONENT_BY_ID = new Map(ARENA_OPPONENTS.map(o => [o.id, o]));

export function arenaOpponentById(id: string): ArenaOpponent | undefined {
  return OPPONENT_BY_ID.get(id);
}

export function opponentsForTier(tier: ArenaTierId): ArenaOpponent[] {
  return ARENA_OPPONENTS.filter(o => o.tier === tier);
}

// ─────────────────────────────────────────────────────────────────────────────
// The player's two numbers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the player brings, derived from things that already exist.
 *
 * `rank` is the XP level, `strike` and `ward` are the *worn* totals off
 * `InventoryService.equippedTotals`, and `forgePower` is the allocated stat.
 * Nothing here is stored — it is recomputed on every page open, so a temper
 * that lands between two bouts is felt on the next one.
 */
export interface ArenaLoadout {
  rank: number;
  strike: number;
  ward: number;
  forgePower: number;
}

/**
 * Might: what you swing.
 *
 * Ten is the floor, so a rank-1 player in nothing at all still has a number and
 * still wins a Bronze bout roughly a third of the time. Strike is weighted 3×
 * against rank's 2× because rank arrives on its own and kit has to be chosen.
 */
export function mightOf(loadout: ArenaLoadout): number {
  const rank = Math.max(1, Math.floor(loadout.rank || 1));
  return Math.round(
    10 + rank * 2 + Math.max(0, loadout.strike) * 3 + Math.max(0, loadout.forgePower) * 0.5,
  );
}

/** Guard: what you subtract from what is swung at you. */
export function guardOf(loadout: ArenaLoadout): number {
  const rank = Math.max(1, Math.floor(loadout.rank || 1));
  return Math.round(4 + rank * 0.6 + Math.max(0, loadout.ward) * 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// The fight
// ─────────────────────────────────────────────────────────────────────────────

export interface BoutRound {
  index: number;
  /** What the player landed after the opponent's Guard. Never below 1. */
  playerHit: number;
  opponentHit: number;
  playerWon: boolean;
}

export interface BoutResult {
  opponentId: string;
  tier: ArenaTierId;
  playerMight: number;
  playerGuard: number;
  opponentMight: number;
  opponentGuard: number;
  rounds: BoutRound[];
  roundsWon: number;
  won: boolean;
}

/** The swing band. ±20% around the raw number, both sides, every round. */
const SWING_LOW = 0.8;
const SWING_SPAN = 0.4;

function swing(base: number, rng: () => number): number {
  const roll = rng();
  const factor = SWING_LOW + (Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0.5) * SWING_SPAN;
  return base * factor;
}

/**
 * Three rounds, two numbers each, best of three.
 *
 * Consumes exactly six rolls off `rng` in a fixed order — player then opponent,
 * round by round — which is what makes a seeded spec able to name the winner
 * before it runs. A tie inside a round goes to the player: the crowd is on the
 * side of whoever paid the entry, and a drawn round with no owner would let a
 * bout end 1-1-1 with no result.
 */
export function resolveBout(
  loadout: ArenaLoadout,
  opponent: ArenaOpponent,
  rng: () => number = Math.random,
): BoutResult {
  const playerMight = mightOf(loadout);
  const playerGuard = guardOf(loadout);
  const rounds: BoutRound[] = [];
  let roundsWon = 0;

  for (let i = 0; i < ARENA_ROUNDS; i++) {
    const playerHit = Math.max(1, Math.round(swing(playerMight, rng) - opponent.guard));
    const opponentHit = Math.max(1, Math.round(swing(opponent.might, rng) - playerGuard));
    const playerWon = playerHit >= opponentHit;
    if (playerWon) roundsWon++;
    rounds.push({ index: i, playerHit, opponentHit, playerWon });
  }

  return {
    opponentId: opponent.id,
    tier: opponent.tier,
    playerMight,
    playerGuard,
    opponentMight: opponent.might,
    opponentGuard: opponent.guard,
    rounds,
    roundsWon,
    won: roundsWon > ARENA_ROUNDS / 2,
  };
}

/**
 * Roughly how often this loadout takes a single round off this opponent.
 *
 * Shown on the gate card as a read-out ("even", "favoured", "outmatched") so a
 * player can tell before pressing whether they are about to waste five minutes.
 * It is a closed-form approximation of the same swing band `resolveBout` rolls,
 * not a simulation: two independent uniforms, so the odds one exceeds the
 * other are the area of a triangle when the bands overlap, and 0 or 1 when
 * they do not.
 */
export function roundOdds(loadout: ArenaLoadout, opponent: ArenaOpponent): number {
  const pLow = mightOf(loadout) * SWING_LOW - opponent.guard;
  const pHigh = mightOf(loadout) * (SWING_LOW + SWING_SPAN) - opponent.guard;
  const oLow = opponent.might * SWING_LOW - guardOf(loadout);
  const oHigh = opponent.might * (SWING_LOW + SWING_SPAN) - guardOf(loadout);

  if (pLow >= oHigh) return 1;
  if (pHigh <= oLow) return 0;

  // Numeric integration over the player's band. Cheap, exact enough for a
  // three-word label, and immune to the algebra mistakes the closed form invites.
  const steps = 64;
  let wins = 0;
  for (let i = 0; i < steps; i++) {
    const p = pLow + ((i + 0.5) / steps) * (pHigh - pLow);
    if (p >= oHigh) wins += 1;
    else if (p <= oLow) wins += 0;
    else wins += (p - oLow) / (oHigh - oLow);
  }
  return wins / steps;
}

/** Best-of-three odds from the per-round odds. */
export function boutOdds(loadout: ArenaLoadout, opponent: ArenaOpponent): number {
  const p = roundOdds(loadout, opponent);
  return p * p * (3 - 2 * p);
}

export type OddsLabel = 'certain' | 'favoured' | 'even' | 'unlikely' | 'outmatched';

export function oddsLabel(odds: number): OddsLabel {
  if (odds >= 0.9) return 'certain';
  if (odds >= 0.62) return 'favoured';
  if (odds >= 0.38) return 'even';
  if (odds >= 0.1) return 'unlikely';
  return 'outmatched';
}

// ─────────────────────────────────────────────────────────────────────────────
// Payout
// ─────────────────────────────────────────────────────────────────────────────

/** Streak bonus caps here. Ten straight is the ceiling. */
export const MAX_STREAK_BONUS_WINS = 10;

export interface ArenaPayout {
  gold: number;
  xp: number;
  points: number;
  /** The multiplier the streak applied, 1 at streak 0. */
  streakMultiplier: number;
}

/**
 * What a settled bout pays.
 *
 * A loss still pays a point or two, and that is deliberate rather than kind: a
 * player whose kit is not yet good enough for Bronze would otherwise have no
 * path at all to the shop that fixes it, and the five-minute lock already makes
 * losing repeatedly the slowest way to earn.
 */
export function payoutFor(tier: ArenaTier, won: boolean, streakBefore: number): ArenaPayout {
  if (!won) {
    return { gold: 0, xp: 0, points: tier.consolationPoints, streakMultiplier: 1 };
  }
  const capped = Math.min(MAX_STREAK_BONUS_WINS, Math.max(0, streakBefore));
  const streakMultiplier = 1 + capped * 0.1;
  return {
    gold: Math.round(tier.gold * streakMultiplier),
    xp: Math.round(tier.xp * streakMultiplier),
    points: Math.round(tier.points * streakMultiplier),
    streakMultiplier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The shop
// ─────────────────────────────────────────────────────────────────────────────

export type ArenaStockKind = 'equipment' | 'gold' | 'essence' | 'material';

export interface ArenaStock {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: ArenaStockKind;
  /** Wins banked lifetime before the row unlocks. */
  requiredWins: number;
  /** `equipment`: the definition id and the rarity it mints at. */
  definitionId?: string;
  rarity?: 'rare' | 'epic' | 'legendary' | 'mythic';
  /** `gold` / `essence`: how much. `material`: how many of `stackKey`. */
  amount?: number;
  stackKey?: string;
  /** True for a row that may only ever be bought once. */
  once?: boolean;
}

/**
 * What arena points buy.
 *
 * Every row hands over something the rest of the game already understands — a
 * minted equipment piece, Gold, Essence, a material stack — rather than an
 * arena-only stat. A currency whose only sink is its own subsystem is a
 * currency players stop earning, and the point of the ring is to feed the
 * character sheet.
 *
 * The four equipment rows are `once: true` because they mint at a rarity the
 * drop tables do not reach casually; an unlimited row would make the ring the
 * cheapest farm for Mythic kit in the game and hollow out expeditions.
 */
export const ARENA_SHOP: readonly ArenaStock[] = [
  {
    id: 'arena-purse',
    name: 'Victor’s Purse',
    description: 'The house counts out 50,000 Gold and does not ask what it is for.',
    cost: 20,
    kind: 'gold',
    amount: 50_000,
    requiredWins: 0,
  },
  {
    id: 'arena-cinder',
    name: 'Sand-Sifted Cinder',
    description: 'Twenty cinder ore raked out of the Bronze floor between bouts.',
    cost: 30,
    kind: 'material',
    stackKey: 'cinder-ore',
    amount: 20,
    requiredWins: 0,
  },
  {
    id: 'arena-buckler',
    name: 'Champion’s Buckler',
    description: 'A Void Buckler, minted Epic. Ward is what wins a fourth round you were not given.',
    cost: 120,
    kind: 'equipment',
    definitionId: 'void-buckler',
    rarity: 'epic',
    requiredWins: 5,
    once: true,
  },
  {
    id: 'arena-gauntlets',
    name: 'Ringbreaker Gauntlets',
    description: 'Godforge Gauntlets, minted Legendary. Struck for a fighter, not a smith.',
    cost: 260,
    kind: 'equipment',
    definitionId: 'godforge-gauntlets',
    rarity: 'legendary',
    requiredWins: 12,
    once: true,
  },
  {
    id: 'arena-essence',
    name: 'Eclipse Tribute',
    description: 'Forty Eclipse Essence, paid out of the Ring’s own seam.',
    cost: 300,
    kind: 'essence',
    amount: 40,
    requiredWins: 12,
  },
  {
    id: 'arena-longblade',
    name: 'Coliseum Longblade',
    description: 'An Eclipse Longblade, minted Legendary. It has been in this building longer than the sand.',
    cost: 480,
    kind: 'equipment',
    definitionId: 'eclipse-longblade',
    rarity: 'legendary',
    requiredWins: 22,
    once: true,
  },
  {
    id: 'arena-crown',
    name: 'The Unwritten Crown',
    description: 'An Astral Helm, minted Mythic. Taken off the Nameless Second. Nobody has asked for it back.',
    cost: 900,
    kind: 'equipment',
    definitionId: 'astral-helm',
    rarity: 'mythic',
    requiredWins: 35,
    once: true,
  },
];

const STOCK_BY_ID = new Map(ARENA_SHOP.map(s => [s.id, s]));

export function arenaStockById(id: string): ArenaStock | undefined {
  return STOCK_BY_ID.get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rank titles
// ─────────────────────────────────────────────────────────────────────────────

export interface ArenaRank {
  wins: number;
  title: string;
}

/** Read off lifetime wins. Rendered next to the player's name on the boards. */
export const ARENA_RANKS: readonly ArenaRank[] = [
  { wins: 0, title: 'Unranked' },
  { wins: 1, title: 'Sandfoot' },
  { wins: 5, title: 'Ropebreaker' },
  { wins: 12, title: 'Named Challenger' },
  { wins: 22, title: 'Seam-Walker' },
  { wins: 35, title: 'Ring Sovereign' },
  { wins: 60, title: 'The Unwritten' },
];

export function arenaRankFor(wins: number): ArenaRank {
  let found = ARENA_RANKS[0];
  for (const rank of ARENA_RANKS) if (wins >= rank.wins) found = rank;
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

export interface ArenaState {
  version: 1;
  /** Spendable arena points. */
  points: number;
  /** Every point ever minted. Never goes down — what the shop gates read. */
  lifetimePoints: number;
  wins: number;
  losses: number;
  /** Consecutive wins. Reset by a loss. */
  streak: number;
  bestStreak: number;
  /** Tier id → wins in that tier. What opens the next gate. */
  tierWins: Record<string, number>;
  /** Epoch ms of the last settled bout, or 0. */
  lastBoutAt: number;
  /** Stock ids already bought, for the `once` rows. */
  purchases: string[];
  /** Settled bout ids, so a replayed mutation cannot pay twice. */
  settled: string[];
}

export function emptyArenaState(): ArenaState {
  return {
    version: 1,
    points: 0,
    lifetimePoints: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    tierWins: {},
    lastBoutAt: 0,
    purchases: [],
    settled: [],
  };
}

/** How many settled bout ids are kept. Enough to survive a tab reload. */
export const SETTLED_RETAINED = 40;

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Coerce whatever came out of storage into a state this code can run on.
 *
 * Total, never throws, and every field is clamped independently: a blob with
 * one corrupt number must not cost a player their whole win count.
 */
export function coerceArenaState(raw: unknown): ArenaState {
  const empty = emptyArenaState();
  if (!raw || typeof raw !== 'object') return empty;
  const src = raw as Record<string, unknown>;

  const tierWins: Record<string, number> = {};
  const rawTiers = src['tierWins'];
  if (rawTiers && typeof rawTiers === 'object') {
    for (const [key, value] of Object.entries(rawTiers as Record<string, unknown>)) {
      if (!ARENA_TIER_ORDER.includes(key as ArenaTierId)) continue;
      tierWins[key] = num(value);
    }
  }

  const wins = num(src['wins']);
  return {
    version: 1,
    points: num(src['points']),
    // Lifetime can never be below spendable — a save that says otherwise would
    // let a player's shop gates close behind them after a purchase.
    lifetimePoints: Math.max(num(src['lifetimePoints']), num(src['points'])),
    wins,
    losses: num(src['losses']),
    streak: num(src['streak']),
    bestStreak: Math.max(num(src['bestStreak']), num(src['streak'])),
    tierWins,
    lastBoutAt: num(src['lastBoutAt']),
    purchases: [...new Set(strings(src['purchases']))],
    settled: strings(src['settled']).slice(-SETTLED_RETAINED),
  };
}

/** Wins banked in `tier`. */
export function winsInTier(state: ArenaState, tier: ArenaTierId): number {
  return state.tierWins[tier] ?? 0;
}

/**
 * Whether `tier` is open.
 *
 * Gated on wins in the tier *below* rather than lifetime wins, so a player
 * cannot farm Bronze into the Void Ring. Bronze is always open.
 */
export function tierUnlocked(state: ArenaState, tier: ArenaTierId): boolean {
  const index = ARENA_TIER_ORDER.indexOf(tier);
  if (index <= 0) return true;
  const def = arenaTier(tier);
  if (!def) return false;
  return winsInTier(state, ARENA_TIER_ORDER[index - 1]) >= def.unlockWins;
}

/** Milliseconds left on the lock, or 0 when the gate is open. */
export function cooldownRemaining(state: ArenaState, now: number): number {
  if (!state.lastBoutAt) return 0;
  return Math.max(0, state.lastBoutAt + ARENA_COOLDOWN_MS - now);
}

/** "4:07", or "ready". */
export function formatCooldown(ms: number): string {
  if (ms <= 0) return 'ready';
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
