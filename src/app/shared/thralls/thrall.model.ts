/**
 * thrall.model.ts — the Forge Thralls, and the arithmetic that makes them a
 * cost rather than a shortcut.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A THRALL IS FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * A Thrall stands at the anvil and pulls the lever while nobody is holding it.
 * That is the whole feature, and every number below exists to stop it from
 * being strictly better than doing it yourself:
 *
 *   • **Price.** A Thrall's roll costs {@link THRALL_ROLL_MULTIPLIER}× what the
 *     Keeper's does. At the shipped `STRIKE_COST` that is a million Gold a pull.
 *     Automation is a *Gold sink*, not a Gold engine.
 *   • **Luck.** A Thrall rolls at a fraction of the Keeper's Magic Find — half
 *     of it at the bottom of the ladder. They will not find your Void for you.
 *   • **Stamina.** They tire. A Legendary at five seconds a roll burns its five
 *     hundred stamina in about twenty minutes and then rests for hours, which
 *     is what keeps the fastest tier from being an infinite Gold shredder
 *     running against an infinite Gold supply.
 *
 * The intended shape is: manual rolling is cheaper and luckier; Thralls convert
 * a Gold surplus you cannot spend fast enough into rune volume you would not
 * have sat through. A player who is *at* the anvil should always roll by hand.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY MAGIC FIND IS A SHARE AND NOT A FLAT PENALTY
 * ─────────────────────────────────────────────────────────────────────────────
 * `magicFindShare` multiplies the Keeper's *own* Magic Find rather than
 * subtracting a constant from it. A flat −50 would read as "Thralls are bad" to
 * a new player at 12% MF (it floors them at zero and the tier ladder means
 * nothing) and as "Thralls are free" to a Luck build at 400% (fifty points off
 * four hundred is noise). A share keeps the tiers legible at every point on the
 * curve: a Legendary is always nine tenths of you, whoever you are.
 *
 * Pure data and pure functions. No browser APIs — safe on an SSR path.
 */
import { GameItem, ItemStats, sumStats } from '../rpg/item.model';
import { RUNE_TIERS, STRIKE_COST } from '../rune-forge/rune.model';

/** localStorage key. One blob, owned solely by ThrallService. */
export const THRALL_KEY = 'godforge-thralls';

/**
 * What a Thrall pays for one pull, as a multiple of the Keeper's strike.
 *
 * A hundred, as briefed. Written as a multiplier of `STRIKE_COST` rather than
 * as a literal for the same reason `STRIKE_COST` is itself derived from the
 * Common tier's worth: the day the anvil is retuned, a second literal here is
 * the one that gets forgotten and the Thralls quietly become free.
 */
export const THRALL_ROLL_MULTIPLIER = 100;

/** What one Thrall pull costs right now. */
export const THRALL_ROLL_COST = STRIKE_COST * THRALL_ROLL_MULTIPLIER;

// ─────────────────────────────────────────────────────────────────────────────
// The ladder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrall rarity stops at Legendary.
 *
 * There is no Mythic or Singular Thrall, and there should not be one. Those two
 * rungs belong to the drop table — a Godstone and the Void — and a purchasable
 * worker standing on them would price the two rarest things in the game as
 * shop stock. Legendary at five seconds a pull is already the ceiling the
 * economy can carry.
 */
export type ThrallRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const THRALL_RARITY_ORDER: ThrallRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
];

export interface ThrallTierDefinition {
  id: ThrallRarity;
  label: string;
  /** Gold to recruit one out of the Market. */
  price: number;
  /** Stamina at level 1. Levelling adds {@link STAMINA_PER_LEVEL} on top. */
  baseStamina: number;
  /**
   * Fraction of the Keeper's Magic Find this tier rolls at, before levels.
   * 0.5 is "half your luck". See the file header for why this is a share.
   */
  magicFindShare: number;
  /** Milliseconds between pulls. */
  rollInterval: number;
  /** Rarity colour, lifted verbatim from `RUNE_TIERS` so the two cannot drift. */
  color: string;
  glow: string;
  /** One line for the recruitment card. */
  flavour: string;
}

/**
 * The five tiers, exactly as briefed.
 *
 * Colours come out of `RUNE_TIERS` rather than being written again: a Rare
 * Thrall and a Rare rune are the same violet everywhere else on the site, and
 * two ladders that disagree about what violet means is two ladders nobody can
 * read at a glance.
 */
export const THRALL_TIERS: Record<ThrallRarity, ThrallTierDefinition> = {
  common: {
    id: 'common', label: 'Common',
    price: 50_000, baseStamina: 100, magicFindShare: 0.5, rollInterval: 30_000,
    color: RUNE_TIERS.common.color, glow: RUNE_TIERS.common.glow,
    flavour: 'Bound for a debt nobody wrote down. Pulls the lever, says nothing.',
  },
  uncommon: {
    id: 'uncommon', label: 'Uncommon',
    price: 200_000, baseStamina: 150, magicFindShare: 0.6, rollInterval: 20_000,
    color: RUNE_TIERS.uncommon.color, glow: RUNE_TIERS.uncommon.glow,
    flavour: 'Has been at an anvil before. Does not flinch when it rings.',
  },
  rare: {
    id: 'rare', label: 'Rare',
    price: 1_000_000, baseStamina: 200, magicFindShare: 0.7, rollInterval: 15_000,
    color: RUNE_TIERS.rare.color, glow: RUNE_TIERS.rare.glow,
    flavour: 'Counts the strikes under their breath and has never lost the count.',
  },
  epic: {
    id: 'epic', label: 'Epic',
    price: 5_000_000, baseStamina: 300, magicFindShare: 0.8, rollInterval: 10_000,
    color: RUNE_TIERS.epic.color, glow: RUNE_TIERS.epic.glow,
    flavour: 'Was owed something by the Forge and has come to collect it slowly.',
  },
  legendary: {
    id: 'legendary', label: 'Legendary',
    price: 25_000_000, baseStamina: 500, magicFindShare: 0.9, rollInterval: 5_000,
    color: RUNE_TIERS.legendary.color, glow: RUNE_TIERS.legendary.glow,
    flavour: 'Struck the Forge before you owned it. Has not been asked to stop.',
  },
};

/**
 * Rune tier id → colour, for the activity log.
 *
 * Derived from `RUNE_TIERS` so the log line for a Mythic is the same red the
 * reveal used, and so the panel does not have to import the rune table itself
 * to draw a two-pixel border.
 */
export const RUNE_TIER_COLOURS: Record<string, string> = Object.fromEntries(
  Object.values(RUNE_TIERS).map(t => [t.id, t.color]),
);

export function thrallTier(rarity: ThrallRarity): ThrallTierDefinition {
  return THRALL_TIERS[rarity] ?? THRALL_TIERS.common;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ceilings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How many Thralls may be *working* at once before the Market upgrade.
 *
 * Five, as briefed. The `thrall-slot` ladder in `economy.model.ts` raises it,
 * one slot a rung, to {@link MAX_THRALL_SLOTS}.
 */
export const BASE_THRALL_SLOTS = 5;

/**
 * The hard ceiling on working Thralls, upgrade included.
 *
 * Ten. Every working Thrall is a wall-clock timer and a Gold debit, and the
 * Legendary tier fires every five seconds — twenty of them would put four
 * ledger writes a second through a service that flushes each spend to disk on
 * purpose. Ten is the number the settlement loop is measured at.
 */
export const MAX_THRALL_SLOTS = 10;

/**
 * How many Thralls may be *owned*.
 *
 * Higher than the working ceiling for the same reason the explorer roster is
 * higher than the mission slots: a roster you can only hold as many of as you
 * can field is a roster where buying a Legendary means deleting something, and
 * choosing who works today is the interesting half of the feature.
 */
export const MAX_THRALLS = 16;

// ─────────────────────────────────────────────────────────────────────────────
// Levelling
// ─────────────────────────────────────────────────────────────────────────────

export const THRALL_MAX_LEVEL = 20;

/** Max stamina added per level above the first. */
export const STAMINA_PER_LEVEL = 5;

/**
 * Magic Find share added per level above the first, as a fraction.
 *
 * Half a point a level, and the number is pinned by an invariant rather than
 * chosen: nineteen levels of growth must stay inside the ten points between two
 * tiers, or a capped Common out-rolls a fresh Uncommon and the ladder stops
 * being a ladder — buying up would be a waste of Gold and the five prices would
 * mean nothing. 19 × 0.005 = 0.095, so a capped Common reaches 0.595 and a
 * fresh Uncommon still starts above it at 0.600.
 *
 * `thrall.model.spec.ts` asserts that invariant across every adjacent pair, so
 * a later retune of either this or the tier spacing fails loudly.
 */
export const MF_SHARE_PER_LEVEL = 0.005;

/**
 * XP needed to reach `level + 1` from `level`.
 *
 * Superlinear so the tail is a commitment rather than an afternoon: level 2 is
 * 40 XP, level 20 is a little over 3,600, and the whole climb is ~26,000 — a
 * few thousand pulls, which at a million Gold each is the point.
 */
export function xpToNext(level: number): number {
  const n = Math.max(1, Math.floor(level));
  if (n >= THRALL_MAX_LEVEL) return Infinity;
  return Math.round(40 * Math.pow(n, 1.55));
}

/** Max stamina for a Thrall of this tier at this level. */
export function maxStaminaFor(rarity: ThrallRarity, level: number): number {
  const n = Math.max(1, Math.min(THRALL_MAX_LEVEL, Math.floor(level)));
  return thrallTier(rarity).baseStamina + (n - 1) * STAMINA_PER_LEVEL;
}

/** This Thrall's Magic Find share of the Keeper's, tier plus levels. */
export function magicFindShareFor(rarity: ThrallRarity, level: number): number {
  const n = Math.max(1, Math.min(THRALL_MAX_LEVEL, Math.floor(level)));
  return thrallTier(rarity).magicFindShare + (n - 1) * MF_SHARE_PER_LEVEL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Thrall's two wells.
 *
 * Two, not eight. A Thrall is not a second Keeper and giving them the paper
 * doll would mean every charm and sigil in the game has a better home than the
 * player's own sheet — the fastest build would be "wear nothing, dress the
 * staff". A weapon and a charm is enough for the two things gear is allowed to
 * do here: luck, and stamina.
 */
export interface ThrallEquipment {
  /** Item id in the weapon well. Runes, Runewords and Artifacts. */
  weapon?: string;
  /** Item id in the charm well. Charms only. */
  charm?: string;
}

export type ThrallStatus = 'working' | 'resting' | 'idle';

export interface Thrall {
  id: string;
  name: string;
  rarity: ThrallRarity;
  level: number;
  /** XP toward `level + 1`. Reset to the remainder on each level. */
  xp: number;
  stamina: number;
  /** Cached `maxStaminaFor`, so a card renders without recomputing. */
  maxStamina: number;
  /**
   * Cached `magicFindShareFor` × 100, as a percentage, for the card.
   *
   * The *live* number the anvil uses is recomputed from the Keeper's Magic
   * Find at the moment of the pull — see `thrallMagicFind`. This field is the
   * share, written as a percent, and exists so a Thrall card can print "70% of
   * your luck" without injecting three services.
   */
  magicFind: number;
  /** Milliseconds between pulls, after gear. Mirrors the tier today. */
  rollInterval: number;
  equipment: ThrallEquipment;
  status: ThrallStatus;
  totalRolls: number;
  /** Rune tier id → how many that tier has landed for this Thrall. */
  totalFinds: Record<string, number>;
  /** ISO instant they were recruited. */
  hiredAt: string;
  /** Wall-clock ms of the last pull. 0 before the first. */
  lastRollAt: number;
  /** Wall-clock ms stamina was last credited. Drives the rest tick. */
  lastRestAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamina
// ─────────────────────────────────────────────────────────────────────────────

export const MINUTE_MS = 60_000;

/** Stamina recovered per minute of rest. One, as briefed. */
export const STAMINA_PER_MINUTE = 1;

/** The cheapest and dearest a pull can cost in stamina. */
export const MIN_STAMINA_COST = 1;
export const MAX_STAMINA_COST = 3;

/**
 * The share of max stamina a resting Thrall has to reach before going back to
 * the anvil.
 *
 * A fifth. Resting to *full* is the obvious rule and it is the wrong one: a
 * Legendary recovers a point a minute, so full is over eight hours and the
 * panel would show four Thralls asleep almost all of the time. Twenty percent
 * is roughly an hour and a half for that tier, which reads as a shift rather
 * than a coma, and it makes the stamina bar a thing you watch instead of a
 * thing you check tomorrow.
 */
export const RESUME_STAMINA_SHARE = 0.2;

export function resumeStaminaFor(thrall: Pick<Thrall, 'maxStamina'>): number {
  return Math.max(MIN_STAMINA_COST, Math.ceil(thrall.maxStamina * RESUME_STAMINA_SHARE));
}

/**
 * Everything a Thrall is wearing, summed.
 *
 * `goldPerSec` and `strikePower` are deliberately *not* read anywhere on a
 * Thrall. The first would mint Gold from a worker whose entire point is
 * burning it; the second is the Keeper's own yield bonus and paying it to a
 * hundred-times-cheaper hand would undo the price. Only `magicFind`,
 * `lootBonus` and `ward` do anything here — see the two functions below.
 */
export function thrallEquipmentStats(
  thrall: Pick<Thrall, 'equipment'>,
  itemById: (id: string) => GameItem | undefined,
): Required<ItemStats> {
  const blocks: ItemStats[] = [];
  for (const id of [thrall.equipment.weapon, thrall.equipment.charm]) {
    if (!id) continue;
    const item = itemById(id);
    if (item) blocks.push(item.stats);
  }
  return sumStats(blocks);
}

/**
 * The Magic Find this Thrall actually rolls at.
 *
 * The Keeper's own total, scaled by the tier-and-level share, plus whatever
 * the Thrall is wearing at face value. `magicFind` and `lootBonus` both count
 * and are added together for the same reason they are on an explorer: from the
 * wearer's side they are the same thing, and keeping them apart would mean
 * every Magic Find charm silently does nothing the moment it changes hands.
 *
 * Worn points are *not* scaled by the share. The share is a penalty on the
 * Keeper's build — their Luck, their sheet, their charms — and taxing the gear
 * you deliberately took off your own body to hand over would make equipping a
 * Thrall strictly worse than wearing the same charm yourself twice over.
 */
export function thrallMagicFind(
  thrall: Pick<Thrall, 'rarity' | 'level' | 'equipment'>,
  keeperMagicFind: number,
  itemById: (id: string) => GameItem | undefined,
): number {
  const share = magicFindShareFor(thrall.rarity, thrall.level);
  const base = Math.max(0, keeperMagicFind) * share;
  const worn = thrallEquipmentStats(thrall, itemById);
  const total = base + worn.magicFind + worn.lootBonus;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/**
 * Fraction of a pull's stamina cost turned aside by worn Ward.
 *
 * Ward is already "mitigation" everywhere else it reads — it turns aside a
 * share of the temper fail chance — so a Thrall's fatigue is the same verb
 * applied to a different cost, rather than a seventh stat nobody has an item
 * for. Ten percent a point, capped at half: a pull can never be free, or the
 * Gold drain stops being the thing that limits automation.
 */
export const WARD_STAMINA_RELIEF = 0.1;
export const MAX_STAMINA_RELIEF = 0.5;

export function staminaReliefOf(ward: number): number {
  const w = Number.isFinite(ward) ? Math.max(0, ward) : 0;
  return Math.min(MAX_STAMINA_RELIEF, w * WARD_STAMINA_RELIEF);
}

/**
 * What one pull costs this Thrall in stamina.
 *
 * One to three before gear, rounded up after relief so the floor is always a
 * real point — a Thrall that rolls for nothing is a Thrall that never rests,
 * and the rest cycle is the only thing bounding the Gold burn.
 */
export function staminaCostFor(
  relief: number,
  rng: () => number = Math.random,
): number {
  const span = MAX_STAMINA_COST - MIN_STAMINA_COST + 1;
  const base = MIN_STAMINA_COST + Math.min(span - 1, Math.floor(rng() * span));
  return Math.max(MIN_STAMINA_COST, Math.ceil(base * (1 - staminaReliefOf(relief))));
}

/**
 * Stamina recovered across an elapsed span, and the leftover milliseconds.
 *
 * Returns the remainder rather than swallowing it so the caller can carry it
 * into the next tick: crediting `floor(elapsed / 60000)` and then stamping
 * `lastRestAt = now` throws away up to fifty-nine seconds every tick, which at
 * a one-second heartbeat is a Thrall that never recovers at all.
 */
export function recoverStamina(
  elapsedMs: number,
  current: number,
  max: number,
): { stamina: number; consumedMs: number } {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MINUTE_MS) {
    return { stamina: current, consumedMs: 0 };
  }
  const minutes = Math.floor(elapsedMs / MINUTE_MS);
  const gained = Math.min(minutes * STAMINA_PER_MINUTE, Math.max(0, max - current));
  return { stamina: Math.min(max, current + gained), consumedMs: minutes * MINUTE_MS };
}

// ─────────────────────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deliberately a different well of stems than the explorer roster's.
 *
 * An explorer is someone you hired and a Thrall is someone the Forge kept, and
 * a panel where the same name can turn up in both lists is a panel where the
 * distinction reads as a bug. 20 × 20 stems is 400 base names before the title.
 */
const NAME_FIRST = [
  'Bral', 'Cind', 'Dros', 'Emb', 'Fash', 'Grel', 'Hask', 'Ith', 'Jor', 'Kald',
  'Lum', 'Mord', 'Nis', 'Orv', 'Pyr', 'Quen', 'Rask', 'Sull', 'Terv', 'Ulm',
];

const NAME_LAST = [
  'ok', 'ath', 'ur', 'esk', 'oam', 'ig', 'ryn', 'ull', 'ax', 'oth',
  'em', 'ask', 'ir', 'ond', 'ev', 'usk', 'arn', 'ol', 'ent', 'ux',
];

/** Only Epic and Legendary earn one. A title should mean something. */
const TITLES = [
  'the Unpaid', 'Lever-Hand', 'the Ninth Shift', 'Ash-Lunged', 'the Tally',
  'Cinder-Knuckle', 'the Longer Debt', 'Bellows-Born',
];

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

export function rollThrallName(rarity: ThrallRarity, rng: () => number = Math.random): string {
  const base = `${pick(NAME_FIRST, rng)}${pick(NAME_LAST, rng)}`;
  const earnsTitle = rarity === 'epic' || rarity === 'legendary';
  return earnsTitle ? `${base} ${pick(TITLES, rng)}` : base;
}

let thrallCounter = 0;

function thrallId(now: number): string {
  thrallCounter = (thrallCounter + 1) % 1_000_000;
  return `thr-${now.toString(36)}-${thrallCounter.toString(36)}`;
}

/**
 * Mint a Thrall of a known rarity.
 *
 * `now` is injected rather than read so the mint is pure: a spec can place a
 * Thrall at a known instant and settle a known span against it, and the SSR
 * path never calls `Date.now` during a prerender.
 */
export function mintThrall(
  rarity: ThrallRarity,
  rng: () => number = Math.random,
  now: number = Date.now(),
): Thrall {
  const tier = thrallTier(rarity);
  const maxStamina = maxStaminaFor(rarity, 1);
  return {
    id: thrallId(now),
    name: rollThrallName(rarity, rng),
    rarity,
    level: 1,
    xp: 0,
    stamina: maxStamina,
    maxStamina,
    magicFind: Math.round(magicFindShareFor(rarity, 1) * 100),
    rollInterval: tier.rollInterval,
    equipment: {},
    status: 'idle',
    totalRolls: 0,
    totalFinds: {},
    hiredAt: new Date(now).toISOString(),
    lastRollAt: 0,
    lastRestAt: now,
  };
}

/**
 * Recompute the three cached fields off `rarity` and `level`.
 *
 * Called after every level-up and on every load. The alternative — deriving
 * them at each read — means a card that prints max stamina has to know the
 * level curve, and a blob written by an older build (where a tier's stamina was
 * a different number) would render its stale value forever.
 */
export function resettle(thrall: Thrall): Thrall {
  const maxStamina = maxStaminaFor(thrall.rarity, thrall.level);
  return {
    ...thrall,
    maxStamina,
    stamina: Math.min(thrall.stamina, maxStamina),
    magicFind: Math.round(magicFindShareFor(thrall.rarity, thrall.level) * 100),
    rollInterval: thrallTier(thrall.rarity).rollInterval,
  };
}

/**
 * Award XP and settle any levels it buys.
 *
 * Levels are settled in a loop rather than with a closed form because the curve
 * is superlinear and a single find can, at low level, be worth more than one
 * rung. A capped Thrall keeps its XP at zero rather than accumulating a number
 * nothing will ever spend.
 */
export function awardXp(thrall: Thrall, amount: number): Thrall {
  if (!Number.isFinite(amount) || amount <= 0) return thrall;
  if (thrall.level >= THRALL_MAX_LEVEL) return thrall;

  let level = thrall.level;
  let xp = thrall.xp + Math.floor(amount);

  while (level < THRALL_MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= THRALL_MAX_LEVEL) xp = 0;

  const settled = resettle({ ...thrall, level, xp });
  // A level grants its extra stamina immediately rather than on the next rest.
  // Levelling up and then being told to go and lie down for five minutes is the
  // reward arriving as a penalty.
  const gained = settled.maxStamina - thrall.maxStamina;
  return gained > 0 ? { ...settled, stamina: Math.min(settled.maxStamina, settled.stamina + gained) } : settled;
}

// ─────────────────────────────────────────────────────────────────────────────
// The shop
// ─────────────────────────────────────────────────────────────────────────────

export interface ThrallOffer {
  /** Market listing id. Never a Thrall's own id — this is the *tier* on sale. */
  id: string;
  rarity: ThrallRarity;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  price: number;
}

/** What a pull costs, written for a shop row. */
export function rollCostLabel(): number {
  return THRALL_ROLL_COST;
}

/**
 * The five recruitment rows, derived from the tier table.
 *
 * Derived rather than authored so a retune of `THRALL_TIERS` cannot leave the
 * Market advertising a stamina pool or an interval the anvil no longer honours
 * — the exact drift `RUNES` is built to avoid on the rune table.
 */
export const THRALL_OFFERS: ThrallOffer[] = THRALL_RARITY_ORDER.map(rarity => {
  const tier = THRALL_TIERS[rarity];
  return {
    id: `thrall-${rarity}`,
    rarity,
    name: `${tier.label} Thrall`,
    effect: `Rolls every ${Math.round(tier.rollInterval / 1000)}s · ${tier.baseStamina} stamina · ${Math.round(tier.magicFindShare * 100)}% of your luck`,
    flavour: tier.flavour,
    icon: '⛓️',
    price: tier.price,
  };
});

export function offerFor(rarity: ThrallRarity): ThrallOffer | undefined {
  return THRALL_OFFERS.find(o => o.rarity === rarity);
}

// ─────────────────────────────────────────────────────────────────────────────
// The activity log
// ─────────────────────────────────────────────────────────────────────────────

/** One line in the Thrall log. */
export interface ThrallLogEntry {
  /** Unique within the log, so a template can track by it. */
  id: string;
  thrallId: string;
  thrallName: string;
  /** Wall-clock ms. */
  at: number;
  /** Rune tier the pull landed, for the colour. */
  tier: string;
  text: string;
}

/**
 * How many log lines are kept.
 *
 * Forty. Ten Legendary Thralls produce two lines a second, so anything larger
 * is a list nobody can read and a blob that grows without bound on a document
 * that is synced to Firestore.
 */
export const THRALL_LOG_MAX = 40;
