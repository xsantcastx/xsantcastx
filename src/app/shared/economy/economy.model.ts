/**
 * economy.model.ts — the Godforge economy, as pure data.
 *
 * Everything a price, a rate or a payout is worth lives here and nowhere else,
 * for the same reason `XP_VALUES` lives in one table: an economy scattered
 * across the components that spend it cannot be read, balanced or argued with.
 *
 * No browser APIs. The Market is server-rendered in its fully-unaffordable
 * state — every card, every price, every lore quote — and hydration only fills
 * in what this visitor can actually afford.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO CURRENCIES ARE SPENDABLE. THREE ARE NOT.
 * ─────────────────────────────────────────────────────────────────────────────
 * Gold and Eclipse Essence have sources (idle time, tool work, quests, ranks)
 * and sinks (every tab of the Market). Aether Fragments, Nox Fragments and
 * Relic Dust are carried in the persisted shape so that the release which gives
 * them a source does not need a storage migration — but nothing mints them
 * today and nothing takes them, so the currency rail does not show a zero it
 * has no way to move.
 */
import { EclipseRarity } from '../rarity/rarity.model';
import { totalBonus } from '../rune-forge/rune.model';

// ─────────────────────────────────────────────────────────────────────────────
// The persisted shape
// ─────────────────────────────────────────────────────────────────────────────

/** An enchantment the visitor is currently running. */
export interface ActiveEnchantment {
  /** Enchantment id from `ENCHANTMENTS`. */
  id: string;
  /** Epoch ms when it stops applying. */
  expiresAt: number;
}

export interface PlayerEconomy {
  version: 2;
  gold: number;
  eclipseEssence: number;
  /** Reserved. No source and no sink yet — see the header note. */
  aetherFragments: number;
  noxFragments: number;
  relicDust: number;
  /**
   * Lifetime Gold minted, which never goes down — not even through an Eclipse
   * reset. Prestige is priced off this figure precisely because it survives:
   * shards are granted as the *difference* between what the all-time total is
   * worth and what has already been handed over, so resetting four times at ten
   * million pays exactly what resetting once at forty million pays. Were it
   * scored per run, the square root in `shardsFor` would make repeatedly
   * bailing out at the threshold strictly better than playing on, which is the
   * opposite of what a prestige curve is for.
   */
  totalGoldEarned: number;
  /** Gold minted since the last Eclipse. Reset to zero by `prestige()`. */
  runGoldEarned: number;
  /** Lifetime Forge Flame strikes. Drives three of the eight achievements. */
  totalClicks: number;
  /**
   * Strikes the automatons have thrown. Counted apart from `totalClicks` on
   * purpose: three of the achievements on the Codex wall are for striking the
   * Flame, and a machine bought with Gold must not be able to collect them.
   */
  autoClicks: number;
  /**
   * Eclipse Shards held. Permanent, survive every reset, and multiply
   * everything at 5% each — see `shardMultiplier`.
   */
  eclipseShards: number;
  /** Shards already handed over, so the all-time curve is only paid once. */
  shardsGranted: number;
  /** How many times the Eclipse has been reset. Shown on the profile. */
  prestigeCount: number;
  /**
   * The daily streak, mirrored out of `XpService` by the wiring layer.
   *
   * Copied rather than injected because the idle settlement is a pure function
   * of the ledger — it has to be able to price eight hours of offline time from
   * the persisted blob alone, including on the first frame after a reload,
   * before progression has finished hydrating from its async store.
   */
  streakDays: number;
  /**
   * Flat Gold/sec from the RPG layer — Forge Power points plus equipped items.
   *
   * Mirrored here by the wiring layer for exactly the reason `streakDays` is:
   * idle settlement prices offline time from this blob alone, on the first frame
   * after a reload, before `PlayerStatsService` and `InventoryService` have read
   * their own keys. A player with forty points of Forge Power and a Legendary in
   * every slot would otherwise be paid nothing for the night — the bonus would
   * appear only once the page had finished hydrating, which is both wrong and
   * the kind of wrong that looks like the item is broken.
   *
   * It is a *flat* addend, not a multiplier, so it joins the furnace and the
   * automatons on the left of the multiplier chain and is scaled by upgrades,
   * streak, shards, artifacts and Runewords like every other source of Gold.
   */
  rpgFlatGold: number;
  /** upgrade id → levels purchased. Absent means zero. */
  upgrades: Record<string, number>;
  /** Artifact ids owned. Each can only ever appear once. */
  artifacts: string[];
  /** Cosmetic ids owned. */
  cosmetics: string[];
  /**
   * Runeword ids crafted at the Rune Forge. Each can only ever appear once.
   *
   * Kept in the ledger rather than alongside the rune inventory in
   * `RuneForgeService`, for the same reason `streakDays` is copied here out of
   * `XpService`: idle settlement has to be able to price eight hours of offline
   * time from this blob alone, on the first frame after a reload, before any
   * other system has hydrated. A word worth +100% income that lived only in the
   * rune store would be silently absent from every offline payout.
   *
   * The rune *inventory* stays in the rune store. Only the finished words,
   * which is the part the rate depends on, are mirrored here.
   */
  runewords: string[];
  /** cosmetic slot → the variant currently applied, for owned cosmetics. */
  equipped: Record<string, string>;
  /** Enchantments still running. Expired entries are dropped on load. */
  enchantments: ActiveEnchantment[];
  /**
   * The highest rank already paid Essence for. Ranks are settled against this
   * counter rather than against a level-up event, because `XpService` settles
   * the daily streak (and can therefore cross a rank) during its own hydration,
   * before anything in the economy is subscribed. Seeded to 1: Wanderer is the
   * rank you arrive holding, so it is not one you are paid for reaching.
   */
  levelsPaid: number;
  /** Seven-day streak milestones already paid, for the same reason. */
  streakWeeksPaid: number;
  /**
   * Epoch ms of the last idle settlement. Idle Gold is *settled*, not ticked:
   * the minute timer is a prompt to recompute, and the amount owed is derived
   * from elapsed time. A tab that was throttled to one callback every five
   * minutes is paid for five minutes, and a timer that never fired at all is
   * still paid on the next page load.
   */
  lastIdleAt: number;
  /**
   * Idempotent mutations since `origin`. Cloud merge unions these by id and
   * replays them. Absent on every save from before the operation log existed.
   */
  ops?: import('./economy-ops').EconomyOp[];
  /**
   * Snapshot from just before the first recorded op. Replay starts here.
   * Null/absent on a legacy blob, which then merges conservatively.
   */
  origin?: import('./economy-ops').EconomyLedger | null;
  /**
   * Hybrid logical clock. New ops take max(wall, hlc + 1) so a clock moved
   * backward cannot make a fresh spend look older than its predecessor.
   */
  hlc?: number;
  /** Per-device max seq already folded into `origin`. Empty on the live blob. */
  applied?: Record<string, number>;
  /** Cloud checkpoint id. Bumped only when Firestore commits a fold. */
  checkpointId?: number;
  /** deviceId → last acknowledged checkpoint. */
  acks?: Record<string, number>;
  /** deviceId → last write time, so vanished devices stop blocking compact. */
  seenAt?: Record<string, number>;
  /** Durable Market purchase receipts. Optional on pre-C2 blobs. */
  commerceOps?: import('./commerce-ops').CommerceOperation[];
  /** Mutation keys folded at a commerce checkpoint. */
  commerceApplied?: Record<string, import('./commerce-ops').CommerceStatus>;
}

export function emptyEconomy(): PlayerEconomy {
  return {
    version: 2,
    gold: 0,
    eclipseEssence: 0,
    aetherFragments: 0,
    noxFragments: 0,
    relicDust: 0,
    totalGoldEarned: 0,
    runGoldEarned: 0,
    totalClicks: 0,
    autoClicks: 0,
    eclipseShards: 0,
    shardsGranted: 0,
    prestigeCount: 0,
    streakDays: 0,
    rpgFlatGold: 0,
    upgrades: {},
    artifacts: [],
    cosmetics: [],
    runewords: [],
    equipped: {},
    enchantments: [],
    levelsPaid: 1,
    streakWeeksPaid: 0,
    lastIdleAt: 0,
    ops: [],
    origin: null,
    hlc: 0,
    applied: {},
    checkpointId: 0,
    acks: {},
    seenAt: {},
    commerceOps: [],
    commerceApplied: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gold per *second* with nothing bought. The floor the whole curve sits on.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE UNIT IS THE SECOND
 * ─────────────────────────────────────────────────────────────────────────────
 * The forge used to be priced per minute and settled per minute, and the number
 * it produced was therefore invisible: a rate you can only observe by waiting
 * sixty seconds for it to move once is a rate nobody believes in. Pricing the
 * whole ladder per second makes the headline figure something that changes
 * while you are looking at it, which is the entire point of an idle economy —
 * and it is the reason the Gold/sec readout sits in the header rather than
 * being buried on the Market.
 *
 * The prices did not change with the unit, so every existing ledger is worth
 * sixty times more per unit of time than it was. That is deliberate. The old
 * curve topped out at 40 Gold a minute, which took an hour to buy anything on
 * the second half of the shop; the new one has to reach ten million to unlock
 * the last tier, and it could not get there on the old rates inside a year.
 */
export const BASE_IDLE_PER_SECOND = 0.1;
/** Gold per strike of the Forge Flame, before hammers. */
export const BASE_GOLD_PER_CLICK = 1;
/** Gold for one interaction beat on a tool page. */
export const GOLD_PER_TOOL_ACTION = 5;
/** Bonus Gold on every hundredth strike. */
export const CENTURY_BONUS_GOLD = 10;

/** Essence for reaching a new rank. */
export const ESSENCE_PER_LEVEL = 5;
/** Essence for a weekly quest claimed. */
export const ESSENCE_PER_WEEKLY = 10;
/** Essence for a Mythic (or rarer) achievement. */
export const ESSENCE_PER_MYTHIC = 50;
/** Essence each time the daily streak crosses a seven-day multiple. */
export const ESSENCE_PER_STREAK_WEEK = 25;

/**
 * Gold for a claimed quest, derived from the XP it already pays rather than
 * authored a second time — 30 quests, 8 weeklies and 5 epics would otherwise
 * each need a Gold value maintained alongside their XP value, and the two would
 * drift the first time a quest was rebalanced.
 *
 * A daily at 15-25 XP lands at the 10 floor; a weekly at 100-150 XP lands
 * between 33 and 50; an epic at 300+ is capped at 50. Which is the 10-50 band
 * the economy was specified with, without a second table to keep honest.
 */
export function goldForQuestXp(xp: number): number {
  return Math.max(10, Math.min(50, Math.round(xp / 3)));
}

/** Every purchase multiplies the next one by this. The Cookie Clicker curve. */
export const PRICE_SCALE = 1.15;

/**
 * What the next level of a repeatable item costs, given how many are owned.
 * Rounded up so a price never drifts below its own base through floating point.
 */
export function costOf(baseCost: number, owned: number): number {
  return Math.ceil(baseCost * Math.pow(PRICE_SCALE, owned));
}

// ─────────────────────────────────────────────────────────────────────────────
// Forge upgrades — idle income
// ─────────────────────────────────────────────────────────────────────────────

export interface ForgeUpgrade {
  id: string;
  name: string;
  /** What it does, in one line, in the visitor's language. */
  effect: string;
  /** One line of Eclipse Realms flavour under the effect. */
  flavour: string;
  icon: string;
  baseCost: number;
  /** Gold per second added per level owned. */
  ratePerSecond: number;
}

/**
 * Ten rungs, each roughly 4× the price and 2.5× the rate of the one under it.
 *
 * The top four are new and they are where the shop stops being a shop and
 * starts being a ladder: the Realm Conduit is the first thing you cannot buy in
 * one sitting, and The First Sun is a ten-million-Gold purchase that only
 * exists to be the thing an Eclipse reset is aimed at.
 */
export const FORGE_UPGRADES: ForgeUpgrade[] = [
  {
    id: 'forge-bellows',
    name: 'Forge Bellows',
    effect: '+0.5 Gold/sec',
    flavour: 'Air is the cheapest thing a forge is hungry for.',
    icon: '🜂',
    baseCost: 50,
    ratePerSecond: 0.5,
  },
  {
    id: 'ember-stoker',
    name: 'Ember Stoker',
    effect: '+1 Gold/sec',
    flavour: 'Someone has to turn the coals while you are away.',
    icon: '🔥',
    baseCost: 200,
    ratePerSecond: 1,
  },
  {
    id: 'nether-furnace',
    name: 'Nether Furnace',
    effect: '+2 Gold/sec',
    flavour: 'Umbral heat. It burns colder and it burns longer.',
    icon: '🌑',
    baseCost: 500,
    ratePerSecond: 2,
  },
  {
    id: 'eclipse-core',
    name: 'Eclipse Core',
    effect: '+5 Gold/sec',
    flavour: 'A shard of the moment the Sun broke, still cooling.',
    icon: '🌘',
    baseCost: 2_000,
    ratePerSecond: 5,
  },
  {
    id: 'godforge-heart',
    name: 'Godforge Heart',
    effect: '+10 Gold/sec',
    flavour: 'The forge no longer needs you to want anything.',
    icon: '💠',
    baseCost: 10_000,
    ratePerSecond: 10,
  },
  {
    id: 'realm-conduit',
    name: 'Realm Conduit',
    effect: '+25 Gold/sec',
    flavour: 'Both realms are pouring into the same crucible now. Neither was asked.',
    icon: '🌀',
    baseCost: 50_000,
    ratePerSecond: 25,
  },
  {
    id: 'aether-siphon',
    name: 'Aether Siphon',
    effect: '+50 Gold/sec',
    flavour: 'The light does not notice it is being taken. That is the design.',
    icon: '🌬️',
    baseCost: 200_000,
    ratePerSecond: 50,
  },
  {
    id: 'nox-harvester',
    name: 'Nox Harvester',
    effect: '+100 Gold/sec',
    flavour: 'It reaps a field nobody planted, and the field keeps coming back.',
    icon: '🌾',
    baseCost: 500_000,
    ratePerSecond: 100,
  },
  {
    id: 'eclipse-reactor',
    name: 'Eclipse Reactor',
    effect: '+250 Gold/sec',
    flavour: 'The Archivum filed the schematics under things that should not hold.',
    icon: '☢️',
    baseCost: 2_000_000,
    ratePerSecond: 250,
  },
  {
    id: 'the-first-sun',
    name: 'The First Sun',
    effect: '+1,000 Gold/sec',
    flavour: 'You did not rebuild it. You only got close enough to warm your hands.',
    icon: '☀️',
    baseCost: 10_000_000,
    ratePerSecond: 1_000,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hammer upgrades — click power
// ─────────────────────────────────────────────────────────────────────────────

/** Visual effects a hammer unlocks on the Flame. Highest owned tier wins. */
export type HammerEffect = 'none' | 'spark' | 'shadow' | 'quake';

export interface HammerUpgrade {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  baseCost: number;
  /** Gold added per strike, per level owned. */
  goldPerClick: number;
  /** What it does to the Flame. Cosmetic, and cumulative by tier. */
  visual: HammerEffect;
}

export const HAMMER_UPGRADES: HammerUpgrade[] = [
  {
    id: 'iron-hammer',
    name: 'Iron Hammer',
    effect: '+2 per strike',
    flavour: 'Honest metal. It will outlast three of its owners.',
    icon: '🔨',
    baseCost: 100,
    goldPerClick: 2,
    visual: 'none',
  },
  {
    id: 'obsidian-mallet',
    name: 'Obsidian Mallet',
    effect: '+5 per strike',
    flavour: 'Cut from the glass the first eclipse left behind.',
    icon: '⚒️',
    baseCost: 500,
    goldPerClick: 5,
    visual: 'none',
  },
  {
    id: 'aether-striker',
    name: 'Aether Striker',
    effect: '+10 per strike, and sparks',
    flavour: 'Light does not need to be swung hard to land.',
    icon: '⚡',
    baseCost: 2_000,
    goldPerClick: 10,
    visual: 'spark',
  },
  {
    id: 'nox-crusher',
    name: 'Nox Crusher',
    effect: '+20 per strike, and a shadow trail',
    flavour: 'It arrives slightly before you decide to swing it.',
    icon: '🕳️',
    baseCost: 5_000,
    goldPerClick: 20,
    visual: 'shadow',
  },
  {
    id: 'eclipse-hammer',
    name: 'Eclipse Hammer',
    effect: '+50 per strike, and the realm flinches',
    flavour: 'Held by four Convergents. Three of them are still standing.',
    icon: '🌗',
    baseCost: 20_000,
    goldPerClick: 50,
    visual: 'quake',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Multiplier upgrades — a percentage on everything the forge makes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bought once each, and they *add* rather than compound: holding all four is
 * +185%, not ×2.06. Additive is the reading that keeps the shop legible — a
 * card that says "+25%" has to mean a quarter more Gold than you had a moment
 * ago, and under compounding it would mean something different depending on
 * what else you happened to own.
 */
export interface MultiplierUpgrade {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  baseCost: number;
  /** Added to the multiplier. 0.25 is "+25% to everything the forge makes". */
  bonus: number;
}

export const MULTIPLIER_UPGRADES: MultiplierUpgrade[] = [
  {
    id: 'forge-efficiency-i',
    name: 'Forge Efficiency I',
    effect: 'All Gold income +10%',
    flavour: 'You stopped losing heat out of the back of it.',
    icon: '📐',
    baseCost: 1_000,
    bonus: 0.1,
  },
  {
    id: 'forge-efficiency-ii',
    name: 'Forge Efficiency II',
    effect: 'All Gold income +25%',
    flavour: 'The bellows and the coals finally agree on a rhythm.',
    icon: '⚙️',
    baseCost: 10_000,
    bonus: 0.25,
  },
  {
    id: 'forge-efficiency-iii',
    name: 'Forge Efficiency III',
    effect: 'All Gold income +50%',
    flavour: 'Nothing here is wasted any more, including you.',
    icon: '🔱',
    baseCost: 100_000,
    bonus: 0.5,
  },
  {
    id: 'forge-mastery',
    name: 'Forge Mastery',
    effect: 'All Gold income +100% — everything doubles',
    flavour: 'The forge stopped being a thing you operate some time ago.',
    icon: '👑',
    baseCost: 1_000_000,
    bonus: 1,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Automatons — hands that strike the Flame for you
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An automaton is priced as a click rate, and it pays whatever a click is worth
 * at the instant it lands — so every Hammer bought makes every automaton owned
 * better, which is the cross-ladder pull the shop did not have before.
 *
 * They are *income*, not input. Nothing here reaches `EconomyService.strike()`:
 * that method carries a 500ms cooldown, drives the combo ladder, and counts
 * toward three achievements on the Codex wall for striking the Flame yourself.
 * An Eclipse Automaton at twenty a second would hold a x1,000 combo forever and
 * collect all three overnight while the tab sat behind a text editor. So the
 * automatons are folded into the per-second rate, and the Flame is told to
 * *look* struck once a second — see `autoStrike$`.
 */
export interface AutoClicker {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  baseCost: number;
  /** Strikes per second added per level owned. */
  clicksPerSecond: number;
}

export const AUTO_CLICKERS: AutoClicker[] = [
  {
    id: 'apprentice-striker',
    name: 'Apprentice Striker',
    effect: '+1 strike/sec',
    flavour: 'Paid in room, board and the chance to hold the hammer.',
    icon: '🧑‍🏭',
    baseCost: 5_000,
    clicksPerSecond: 1,
  },
  {
    id: 'forge-golem',
    name: 'Forge Golem',
    effect: '+5 strikes/sec',
    flavour: 'It has one instruction and has never once misread it.',
    icon: '🗿',
    baseCost: 50_000,
    clicksPerSecond: 5,
  },
  {
    id: 'eclipse-automaton',
    name: 'Eclipse Automaton',
    effect: '+20 strikes/sec',
    flavour: 'Twenty arms, no shoulders, and a sound the Archivum will not transcribe.',
    icon: '🤖',
    baseCost: 500_000,
    clicksPerSecond: 20,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Expeditions — explorer slots for the Forge View
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hiring an explorer is a Gold-ladder purchase like any other, which is why it
 * lives here rather than in the explorer's own blob.
 *
 * The alternative was a second spend path owned by ExplorerService, and that is
 * how a shop ends up with two ideas about what the visitor has paid for: the
 * Market prices every other purchase through `costOf` and the 15% escalator,
 * and a slot bought somewhere else would be the one item on the site whose
 * price nobody could look up. Buying through `upgrades` also means slots ride
 * the cloud save, the reset and the prestige rules for free.
 *
 * It contributes nothing to `goldPerSecond` — an expedition pays on return, not
 * per second — so it is deliberately absent from every rate function below.
 */
export interface ExpeditionUpgrade {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  baseCost: number;
  /** Explorers added per level owned. */
  explorers: number;
}

export const EXPEDITION_UPGRADES: ExpeditionUpgrade[] = [
  {
    id: 'explorer-slot',
    name: 'Hire an Explorer',
    effect: '+1 explorer out at once',
    flavour: 'They ask for a lamp, a week of rations, and no supervision whatsoever.',
    icon: '🧭',
    baseCost: 2_500,
    explorers: 1,
  },
];

/** Every Gold ladder as one list. Used for the "how many do you own" counts. */
export type AnyUpgrade =
  | ForgeUpgrade | HammerUpgrade | MultiplierUpgrade | AutoClicker | ExpeditionUpgrade;

export const ALL_UPGRADES: AnyUpgrade[] = [
  ...FORGE_UPGRADES,
  ...HAMMER_UPGRADES,
  ...MULTIPLIER_UPGRADES,
  ...AUTO_CLICKERS,
  ...EXPEDITION_UPGRADES,
];

/**
 * Ids that may only ever be bought once. Everything else repeats, getting 15%
 * dearer each time.
 */
const SINGLE_PURCHASE = new Set(MULTIPLIER_UPGRADES.map(m => m.id));

export function isSinglePurchase(id: string): boolean {
  return SINGLE_PURCHASE.has(id);
}

/**
 * Ladders that repeat but not forever.
 *
 * Only expeditions need this today: five explorers is one per realm, and a
 * sixth could only ever duplicate a realm already covered. Kept as a map rather
 * than a field on `ExpeditionUpgrade` so the next capped ladder does not need a
 * second mechanism, and absent means unbounded — which is the correct default
 * for the four ladders that are meant to be climbed indefinitely.
 */
const LEVEL_CAPS: Record<string, number> = {
  // MAX_EXPLORER_SLOTS (5) minus the one every visitor starts with.
  'explorer-slot': 4,
};

/** The most levels of an upgrade anyone may hold, or Infinity. */
export function levelCap(id: string): number {
  if (isSinglePurchase(id)) return 1;
  return LEVEL_CAPS[id] ?? Infinity;
}

/** The definition behind any Gold-ladder id, or undefined. */
export function upgradeById(id: string): AnyUpgrade | undefined {
  return ALL_UPGRADES.find(u => u.id === id);
}

const HAMMER_VISUAL_RANK: Record<HammerEffect, number> = {
  none: 0, spark: 1, shadow: 2, quake: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Enchantments — timed XP boosts, bought with Essence
// ─────────────────────────────────────────────────────────────────────────────

export interface Enchantment {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  /** Cost in Eclipse Essence. */
  cost: number;
  /** XP multiplier while it runs. 1.1 is "+10% XP". */
  multiplier: number;
  /** How long it runs, in hours. */
  hours: number;
}

export const ENCHANTMENTS: Enchantment[] = [
  {
    id: 'seekers-lens',
    name: "Seeker's Lens",
    effect: '+10% XP for 24h',
    flavour: 'You notice slightly more than you did yesterday.',
    icon: '🔍',
    cost: 5,
    multiplier: 1.1,
    hours: 24,
  },
  {
    id: 'scholars-mark',
    name: "Scholar's Mark",
    effect: '+25% XP for 24h',
    flavour: 'The Archivum has started writing your name down.',
    icon: '📖',
    cost: 15,
    multiplier: 1.25,
    hours: 24,
  },
  {
    id: 'convergents-blessing',
    name: "Convergent's Blessing",
    effect: '+50% XP for 24h',
    flavour: 'Both realms lean in at once. It is not comfortable.',
    icon: '🕯️',
    cost: 50,
    multiplier: 1.5,
    hours: 24,
  },
  {
    id: 'eclipse-aura',
    name: 'Eclipse Aura',
    effect: '2× all XP for 24h',
    flavour: 'For one day the broken Sun is on your side of the sky.',
    icon: '🌒',
    cost: 100,
    multiplier: 2,
    hours: 24,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Artifacts — permanent, one-of-each, bought with Essence
// ─────────────────────────────────────────────────────────────────────────────

export interface Artifact {
  id: string;
  name: string;
  effect: string;
  /** A line of the codex, in the codex's own voice. Set in a serif quote. */
  lore: string;
  icon: string;
  cost: number;
  tier: EclipseRarity;
}

export const ARTIFACTS: Artifact[] = [
  {
    id: 'obsidian-heart',
    name: 'Obsidian Heart',
    effect: 'The forge keeps earning while the tab is hidden.',
    lore: 'It was cut from a furnace that had been cold for six hundred years and was still warm in the centre. The Archivum stopped asking why.',
    icon: '🖤',
    cost: 100,
    tier: 'sacred',
  },
  {
    id: 'mirrorblade-kael',
    name: 'Mirrorblade of Kael',
    effect: 'Whichever energy you have less of pays double XP.',
    lore: 'Kael carried it into the Verge to cut the two realms apart and came back having only made them symmetrical. He counted it a failure. Nobody else does.',
    icon: '🗡️',
    cost: 200,
    tier: 'sacred',
  },
  {
    id: 'relic-third-dawn',
    name: 'Relic of the Third Dawn',
    effect: 'Quest rewards are doubled, permanently.',
    lore: 'Two dawns were promised and two dawns came. The third was not promised to anyone, which is why it is still owed.',
    icon: '🌅',
    cost: 500,
    tier: 'anomalous',
  },
  {
    id: 'codex-solarii',
    name: 'Codex Solarii',
    effect: 'Lore chapters open at half the usual number of uses.',
    lore: 'The Solarii wrote everything twice: once for the reader they had, and once for the reader who would arrive already knowing. This is the second copy.',
    icon: '📜',
    cost: 1_000,
    tier: 'anomalous',
  },
  {
    id: 'fragment-first-sun',
    name: 'Fragment of the First Sun',
    effect: 'Everything doubles. Gold, strikes, idle, XP.',
    lore: 'There is one. It has been in the hands of four people and none of them wrote down what it was like, which the Archivum regards as the single greatest failure in its record.',
    icon: '☀️',
    cost: 5_000,
    tier: 'mythic',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cosmetics — bought with Gold, applied as attributes on <html>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A cosmetic occupies a *slot*, and a slot holds one variant at a time. Buying
 * the cosmetic buys the whole slot; the variants inside it are then free to
 * switch between, because charging twice for a colour the visitor already owns
 * is the kind of thing that makes a shop feel like a toll booth.
 */
export interface CosmeticVariant {
  id: string;
  label: string;
  /** Swatch colour on the picker. */
  color: string;
}

export interface Cosmetic {
  id: string;
  name: string;
  effect: string;
  flavour: string;
  icon: string;
  cost: number;
  /** The `data-cos-<slot>` attribute written on <html> when equipped. */
  slot: string;
  variants: CosmeticVariant[];
}

export const COSMETICS: Cosmetic[] = [
  {
    id: 'cursor-trail',
    name: 'Cursor Trail',
    effect: 'Recolours the trail behind your cursor.',
    flavour: 'Everyone leaves something. Choose what.',
    icon: '✨',
    cost: 500,
    slot: 'trail',
    variants: [
      { id: 'aether', label: 'Aether sparkles', color: '#A78BFA' },
      { id: 'nox', label: 'Nox shadows', color: '#7b61ff' },
      { id: 'eclipse', label: 'Eclipse fire', color: '#E8752A' },
    ],
  },
  {
    id: 'title-prefix',
    name: 'Title Prefix',
    effect: 'A word before your rank, everywhere it is shown.',
    flavour: 'The realms have never agreed on what to call you. Decide for them.',
    icon: '🏷️',
    cost: 1_000,
    slot: 'prefix',
    variants: [
      { id: 'relentless', label: 'The Relentless', color: '#E8752A' },
      { id: 'shadowborn', label: 'Shadowborn', color: '#8B2252' },
      { id: 'unbroken', label: 'The Unbroken', color: '#C9A84C' },
      { id: 'ashwalker', label: 'Ashwalker', color: '#9fb4ae' },
      // Pro Pack exclusive — granted by ProService, not purchasable with Gold.
      { id: 'pro', label: 'Pro', color: '#F5C451' },
    ],
  },
  {
    id: 'theme-variant',
    name: 'Theme Variant',
    effect: 'Tints the whole site toward one realm.',
    flavour: 'You have been standing in someone else\'s light this entire time.',
    icon: '🎨',
    cost: 2_000,
    slot: 'theme',
    variants: [
      { id: 'luminous', label: 'Luminous', color: '#E8D44D' },
      { id: 'umbral', label: 'Umbral', color: '#8B2252' },
      { id: 'verge', label: 'Verge', color: '#00d4ff' },
      { id: 'nexus', label: 'Nexus', color: '#10B981' },
    ],
  },
  {
    id: 'xp-bar-skin',
    name: 'XP Bar Skin',
    effect: 'Reworks the progression bar in the header.',
    flavour: 'The measure of you, in a frame you picked.',
    icon: '📊',
    cost: 5_000,
    slot: 'xpbar',
    variants: [
      { id: 'ornate', label: 'Ornate', color: '#C9A84C' },
      { id: 'molten', label: 'Molten', color: '#E8752A' },
      { id: 'void', label: 'Void', color: '#7b61ff' },
      // Pro Pack exclusive — granted by ProService, not purchasable with Gold.
      { id: 'golden', label: 'Golden', color: '#F5C451' },
    ],
  },
  {
    id: 'achievement-frame',
    name: 'Achievement Frame',
    effect: 'Borders every card in the Codex.',
    flavour: 'A wall is a wall. A framed wall is a record.',
    icon: '🖼️',
    cost: 10_000,
    slot: 'frame',
    variants: [
      { id: 'golden', label: 'Golden', color: '#C9A84C' },
      { id: 'obsidian', label: 'Obsidian', color: '#2a2438' },
      { id: 'prismatic', label: 'Prismatic', color: '#ff6dd7' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived numbers
// ─────────────────────────────────────────────────────────────────────────────

const FORGE_BY_ID = new Map(FORGE_UPGRADES.map(u => [u.id, u]));
const HAMMER_BY_ID = new Map(HAMMER_UPGRADES.map(u => [u.id, u]));
const MULTIPLIER_BY_ID = new Map(MULTIPLIER_UPGRADES.map(u => [u.id, u]));
const AUTO_BY_ID = new Map(AUTO_CLICKERS.map(u => [u.id, u]));

/** Total levels owned across every upgrade ladder. */
export function totalUpgradeLevels(e: PlayerEconomy): number {
  return Object.values(e.upgrades).reduce((a, b) => a + b, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prestige — the Eclipse reset
// ─────────────────────────────────────────────────────────────────────────────

/** What one Eclipse Shard adds to everything, forever. */
export const SHARD_BONUS = 0.05;

/** All-time Gold that opens the reset on its own. */
export const PRESTIGE_GOLD_THRESHOLD = 10_000_000;
/** The rank that opens it instead, for a visitor who got there another way. */
export const PRESTIGE_LEVEL_THRESHOLD = 10;

/**
 * What an all-time Gold total is worth in shards.
 *
 * A square root, so the tenth reset is not ten times the first: ten million
 * pays 10 shards, forty million pays 20, a billion pays 100. Combined with
 * `shardsGranted` — which is never reset — this makes one long run and several
 * short ones worth exactly the same, and leaves the curve flat enough that
 * there is always another shard visible without it ever being close.
 */
export function shardsFor(totalGoldEarned: number): number {
  if (totalGoldEarned <= 0) return 0;
  return Math.floor(Math.sqrt(totalGoldEarned / 100_000));
}

/** Shards the next Eclipse would hand over. Zero means it is not worth taking. */
export function pendingShards(e: PlayerEconomy): number {
  return Math.max(0, shardsFor(e.totalGoldEarned) - e.shardsGranted);
}

/** Whether the reset is open at all. `level` is the current rank. */
export function canPrestige(e: PlayerEconomy, level: number): boolean {
  const reached = e.totalGoldEarned >= PRESTIGE_GOLD_THRESHOLD
    || level >= PRESTIGE_LEVEL_THRESHOLD;
  return reached && pendingShards(e) >= 1;
}

/** The permanent multiplier the shards are paying. 7 shards is ×1.35. */
export function shardMultiplier(e: PlayerEconomy): number {
  return 1 + e.eclipseShards * SHARD_BONUS;
}

// ─────────────────────────────────────────────────────────────────────────────
// The multipliers on the way to a rate
// ─────────────────────────────────────────────────────────────────────────────

/** The Forge Efficiency line, summed. Holding all four is ×2.85. */
export function upgradeMultiplier(e: PlayerEconomy): number {
  let bonus = 0;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = MULTIPLIER_BY_ID.get(id);
    if (up && level > 0) bonus += up.bonus;
  }
  return 1 + bonus;
}

/**
 * What a daily streak is worth: 1% a day, capped at fifty days.
 *
 * Flat per day rather than per week, so the reward for coming back tomorrow is
 * always visible tomorrow — a bonus that only moves every seventh day spends
 * six days looking like it does not exist. The cap is there because the streak
 * is already worth a great deal in XP, and an uncapped line would eventually
 * dwarf every purchase in the shop.
 */
export function streakMultiplier(streakDays: number): number {
  return 1 + Math.min(Math.max(streakDays, 0), 50) * 0.01;
}

/** Strikes a second the automatons are throwing. */
export function autoClicksPerSecond(e: PlayerEconomy): number {
  let rate = 0;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = AUTO_BY_ID.get(id);
    if (up) rate += up.clicksPerSecond * level;
  }
  return rate;
}

/**
 * The "+100% to everything" artifact, as a plain multiplier. Applied to Gold
 * earned, click power and idle rate here, and to XP in the wiring layer, which
 * is the only place XP passes through.
 */
export function globalMultiplier(e: PlayerEconomy): number {
  return e.artifacts.includes('fragment-first-sun') ? 2 : 1;
}

/**
 * Every crafted Runeword's income bonus, as a plain multiplier.
 *
 * The bonuses are summed before the 1 is added rather than multiplied together,
 * so First Light (+25%) and Godforge Mastery (+100%) pay ×2.25 and not ×2.5.
 * That is what the copy on each card claims, and a shop whose arithmetic
 * disagrees with its own card text is a shop nobody can plan a purchase in.
 */
export function runewordMultiplier(e: PlayerEconomy): number {
  return 1 + totalBonus(e.runewords).income;
}

/**
 * Every line of the Gold rate, kept apart so the Market can show its working.
 *
 * The two *sources* are summed and then every *multiplier* is applied to the
 * sum, which is the only arrangement that makes the shop's own copy true: a
 * card that reads "+50% to all Gold income" has to raise the automatons as well
 * as the furnaces, or the word "all" is a lie.
 */
export interface GoldBreakdown {
  /** Per second from the forge ladder, including the base floor. */
  idle: number;
  /** Per second from the automatons, at what a strike is currently worth. */
  auto: number;
  /** The Forge Efficiency line. */
  upgrades: number;
  /** The daily streak. */
  streak: number;
  /** Eclipse Shards. */
  shards: number;
  /** The Fragment of the First Sun, which is ×2 or nothing. */
  artifact: number;
  /** Every Runeword crafted at the Rune Forge, summed. ×1 when none are. */
  runeword: number;
  /** Forge Power points and equipped items, flat. Zero with nothing invested. */
  rpg: number;
  /** Every line above, resolved. */
  total: number;
}

export function goldBreakdown(e: PlayerEconomy): GoldBreakdown {
  let idle = BASE_IDLE_PER_SECOND;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = FORGE_BY_ID.get(id);
    if (up) idle += up.ratePerSecond * level;
  }

  // A hand-edited blob can put anything in here, and a NaN would propagate
  // through `total` into the ticker and the offline payout. Clamped at the one
  // place the value enters the arithmetic.
  const rpg = Number.isFinite(e.rpgFlatGold) ? Math.max(0, e.rpgFlatGold) : 0;

  // Automatons pay whatever a strike is worth right now — at the *bare* rate,
  // because the shared multipliers are applied once below to the sum of both
  // sources. Using `goldPerClick` here would apply all four of them twice.
  const auto = autoClicksPerSecond(e) * baseGoldPerClick(e);

  const upgrades = upgradeMultiplier(e);
  const streak = streakMultiplier(e.streakDays);
  const shards = shardMultiplier(e);
  const artifact = globalMultiplier(e);
  const runeword = runewordMultiplier(e);

  return {
    idle,
    auto,
    upgrades,
    streak,
    shards,
    artifact,
    runeword,
    rpg,
    total: (idle + auto + rpg) * upgrades * streak * shards * artifact * runeword,
  };
}

/** Gold per second, everything applied. The headline number. */
export function goldPerSecond(e: PlayerEconomy): number {
  return goldBreakdown(e).total;
}

/** The same rate per minute, for anything that still speaks in minutes. */
export function goldPerMinute(e: PlayerEconomy): number {
  return goldPerSecond(e) * 60;
}

/**
 * What one strike is worth before any of the shared multipliers.
 *
 * Split out because the automatons are priced in strikes: the breakdown needs
 * the bare figure so it can add the automaton line to the furnace line and
 * multiply the sum exactly once.
 */
export function baseGoldPerClick(e: PlayerEconomy): number {
  let gold = BASE_GOLD_PER_CLICK;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = HAMMER_BY_ID.get(id);
    if (up) gold += up.goldPerClick * level;
  }
  return gold;
}

/**
 * Gold per strike of the Flame with everything applied — hammers, the Forge
 * Efficiency line, the streak, the shards and the Fragment.
 *
 * All four of the shared multipliers reach the hammer ladder, not just idle
 * income, because all four are sold as applying to everything and a player who
 * bought Forge Mastery for a million Gold is entitled to see their strike
 * double along with their furnaces.
 */
export function goldPerClick(e: PlayerEconomy): number {
  const scaled = baseGoldPerClick(e)
    * upgradeMultiplier(e)
    * streakMultiplier(e.streakDays)
    * shardMultiplier(e)
    * globalMultiplier(e)
    * runewordMultiplier(e);
  // Never round a paying strike down to nothing.
  return Math.max(1, Math.round(scaled));
}

/** The loudest visual any owned hammer grants. */
export function hammerVisual(e: PlayerEconomy): HammerEffect {
  let best: HammerEffect = 'none';
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = HAMMER_BY_ID.get(id);
    if (up && level > 0 && HAMMER_VISUAL_RANK[up.visual] > HAMMER_VISUAL_RANK[best]) {
      best = up.visual;
    }
  }
  return best;
}

/**
 * How elaborate the Flame is drawn, 0-5, from what has been bought.
 *
 * Deliberately reads *both* ladders. The Flame is the visitor's whole picture
 * of the forge, and a forge that earns 40 Gold a minute while looking exactly
 * like a forge that earns 1 is the flattest possible reward for the money.
 */
export function flameTier(e: PlayerEconomy): number {
  const levels = totalUpgradeLevels(e);
  if (levels >= 40) return 5;
  if (levels >= 24) return 4;
  if (levels >= 14) return 3;
  if (levels >= 7) return 2;
  if (levels >= 2) return 1;
  return 0;
}

/** The strongest enchantment running at `now`, or null. */
export function activeEnchantment(e: PlayerEconomy, now: number): { def: Enchantment; expiresAt: number } | null {
  let best: { def: Enchantment; expiresAt: number } | null = null;
  for (const active of e.enchantments) {
    if (active.expiresAt <= now) continue;
    const def = ENCHANTMENTS.find(x => x.id === active.id);
    if (!def) continue;
    if (!best || def.multiplier > best.def.multiplier) {
      best = { def, expiresAt: active.expiresAt };
    }
  }
  return best;
}

/**
 * The XP multiplier for one award.
 *
 * Enchantments do not stack with each other — running two at once takes the
 * stronger, because two 24-hour timers that add up to 2.75× is a shop that
 * rewards buying the cheap one five times over buying the expensive one once.
 * They *do* stack with the artifacts, which are permanent and cost Essence in
 * the thousands.
 */
export function xpMultiplier(
  e: PlayerEconomy,
  now: number,
  ctx: { questReward?: boolean; weakerEnergy?: boolean } = {},
): number {
  let mult = activeEnchantment(e, now)?.def.multiplier ?? 1;
  if (ctx.questReward && e.artifacts.includes('relic-third-dawn')) mult *= 2;
  if (ctx.weakerEnergy && e.artifacts.includes('mirrorblade-kael')) mult *= 2;
  // The Convergent's Will and Godforge Mastery both pay XP. Summed with each
  // other, then applied once — see `runewordMultiplier`.
  return mult * globalMultiplier(e) * (1 + totalBonus(e.runewords).xp);
}

/**
 * The Runeword multiplier on Gold paid out by a claimed quest.
 *
 * Separate from `runewordMultiplier` because Shadow Step pays quest Gold and
 * nothing else, so folding it into the income line would quietly raise the idle
 * rate of anyone holding it.
 */
export function runewordQuestMultiplier(e: PlayerEconomy): number {
  return 1 + totalBonus(e.runewords).questGold;
}

/** How many uses a lore chapter should cost, given the Codex Solarii. */
export function loreThresholdScale(e: PlayerEconomy): number {
  return e.artifacts.includes('codex-solarii') ? 0.5 : 1;
}

/** Idle keeps running with the tab hidden only once the Heart is held. */
export function earnsWhileHidden(e: PlayerEconomy): boolean {
  return e.artifacts.includes('obsidian-heart');
}

/** 1,247 rather than 1247. Gold is a number people are meant to feel. */
export function formatCurrency(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** "+3" — one decimal only when the fraction is actually there. */
export function formatRate(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 2.5 → "2.5", 1,200 → "1.2K", 3,400,000 → "3.4M".
 *
 * The whole point of the per-second unit is a headline number that stays
 * readable, and by the fourth forge tier the honest figure is five digits wide.
 * A chip in the header that grows sideways once a minute shoves the rest of the
 * row along with it, so past a thousand the rate is abbreviated and the exact
 * value moves to the accessible label and the Market's breakdown.
 *
 * Deliberately not `Intl.NumberFormat({notation: 'compact'})`: that renders
 * "1.2K" in en-US and "1,2 mil" in es, and this string is baked into
 * server-rendered HTML that both locales share.
 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return trimZero(n / 1_000_000_000_000) + 'T';
  if (abs >= 1_000_000_000) return trimZero(n / 1_000_000_000) + 'B';
  if (abs >= 1_000_000) return trimZero(n / 1_000_000) + 'M';
  if (abs >= 1_000) return trimZero(n / 1_000) + 'K';
  if (abs >= 100) return String(Math.round(n));
  return trimZero(n);
}

/** "1.0" reads as a rounding artefact where "1" reads as a number. */
function trimZero(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** "×1.35". The multiplier lines on the breakdown all render through this. */
export function formatMultiplier(n: number): string {
  return '×' + n.toFixed(2);
}
