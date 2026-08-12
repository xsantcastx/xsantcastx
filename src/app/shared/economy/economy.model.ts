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
  version: 1;
  gold: number;
  eclipseEssence: number;
  /** Reserved. No source and no sink yet — see the header note. */
  aetherFragments: number;
  noxFragments: number;
  relicDust: number;
  /** Lifetime Gold minted, which never goes down. Drives the Market's ledger. */
  totalGoldEarned: number;
  /** Lifetime Forge Flame strikes. Drives three of the eight achievements. */
  totalClicks: number;
  /** upgrade id → levels purchased. Absent means zero. */
  upgrades: Record<string, number>;
  /** Artifact ids owned. Each can only ever appear once. */
  artifacts: string[];
  /** Cosmetic ids owned. */
  cosmetics: string[];
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
}

export function emptyEconomy(): PlayerEconomy {
  return {
    version: 1,
    gold: 0,
    eclipseEssence: 0,
    aetherFragments: 0,
    noxFragments: 0,
    relicDust: 0,
    totalGoldEarned: 0,
    totalClicks: 0,
    upgrades: {},
    artifacts: [],
    cosmetics: [],
    equipped: {},
    enchantments: [],
    levelsPaid: 1,
    streakWeeksPaid: 0,
    lastIdleAt: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payouts
// ─────────────────────────────────────────────────────────────────────────────

/** Gold per minute with nothing bought. The floor the whole curve sits on. */
export const BASE_IDLE_PER_MINUTE = 1;
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
  /** Gold per minute added per level owned. */
  ratePerMinute: number;
}

export const FORGE_UPGRADES: ForgeUpgrade[] = [
  {
    id: 'forge-bellows',
    name: 'Forge Bellows',
    effect: '+0.5 Gold/min',
    flavour: 'Air is the cheapest thing a forge is hungry for.',
    icon: '🜂',
    baseCost: 50,
    ratePerMinute: 0.5,
  },
  {
    id: 'ember-stoker',
    name: 'Ember Stoker',
    effect: '+1 Gold/min',
    flavour: 'Someone has to turn the coals while you are away.',
    icon: '🔥',
    baseCost: 200,
    ratePerMinute: 1,
  },
  {
    id: 'nether-furnace',
    name: 'Nether Furnace',
    effect: '+2 Gold/min',
    flavour: 'Umbral heat. It burns colder and it burns longer.',
    icon: '🌑',
    baseCost: 500,
    ratePerMinute: 2,
  },
  {
    id: 'eclipse-core',
    name: 'Eclipse Core',
    effect: '+5 Gold/min',
    flavour: 'A shard of the moment the Sun broke, still cooling.',
    icon: '🌘',
    baseCost: 2_000,
    ratePerMinute: 5,
  },
  {
    id: 'godforge-heart',
    name: 'Godforge Heart',
    effect: '+10 Gold/min',
    flavour: 'The forge no longer needs you to want anything.',
    icon: '💠',
    baseCost: 10_000,
    ratePerMinute: 10,
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

/** Both ladders as one list, for the "how many upgrades do you own" counts. */
export const ALL_UPGRADES: Array<ForgeUpgrade | HammerUpgrade> = [
  ...FORGE_UPGRADES,
  ...HAMMER_UPGRADES,
];

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
      { id: 'aether', label: 'Aether sparkles', color: '#4dffe0' },
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

/** Total levels owned across both upgrade ladders. */
export function totalUpgradeLevels(e: PlayerEconomy): number {
  return Object.values(e.upgrades).reduce((a, b) => a + b, 0);
}

/**
 * The "+100% to everything" artifact, as a plain multiplier. Applied to Gold
 * earned, click power and idle rate here, and to XP in the wiring layer, which
 * is the only place XP passes through.
 */
export function globalMultiplier(e: PlayerEconomy): number {
  return e.artifacts.includes('fragment-first-sun') ? 2 : 1;
}

/** Gold per minute from idle, all upgrades and artifacts applied. */
export function goldPerMinute(e: PlayerEconomy): number {
  let rate = BASE_IDLE_PER_MINUTE;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = FORGE_BY_ID.get(id);
    if (up) rate += up.ratePerMinute * level;
  }
  return rate * globalMultiplier(e);
}

/** Gold per strike of the Flame, all hammers and artifacts applied. */
export function goldPerClick(e: PlayerEconomy): number {
  let gold = BASE_GOLD_PER_CLICK;
  for (const [id, level] of Object.entries(e.upgrades)) {
    const up = HAMMER_BY_ID.get(id);
    if (up) gold += up.goldPerClick * level;
  }
  return Math.round(gold * globalMultiplier(e));
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
  return mult * globalMultiplier(e);
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

/** "+3/min" — one decimal only when the fraction is actually there. */
export function formatRate(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
