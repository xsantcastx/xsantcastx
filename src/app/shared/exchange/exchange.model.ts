/**
 * exchange.model.ts — what a thing is worth, and why that number moved.
 *
 * The Grand Exchange is a market whose prices are a *pure function of the
 * clock*. There is no tick loop, no interval, nothing that has to be running
 * for a price to change. `priceAt(good, t)` answers for any `t` — an hour ago,
 * a month ago, or right now — and it answers the same thing every time it is
 * asked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A CLOCK FUNCTION AND NOT A RANDOM WALK
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build is a walk: hold a price, jitter it on a timer, push each
 * value onto a history array. It is also the build that breaks on contact with
 * a browser, in three separate ways:
 *
 *   · A walk only moves while the tab is open. Close the game on Friday, come
 *     back Monday, and the market is exactly where you left it — which is the
 *     opposite of "a living economy" and immediately reads as fake.
 *   · The history has to be *stored*, so thirty days of five-minute samples for
 *     ninety goods is ~750k points in localStorage, and the chart can only ever
 *     draw the window the player happened to be present for.
 *   · Two devices signed into one account walk independently, so the same item
 *     has two different prices and the merge has no principled winner.
 *
 * Seeded value noise over the wall clock has none of those problems. Nothing
 * about the price is persisted, so there is nothing to sync and nothing to
 * merge; the 30-day chart is synthesised on demand because the past is just as
 * computable as the present; and every device — and every reload — agrees,
 * because they all read the same clock through the same function.
 *
 * What *is* persisted is the player's own footprint on the market: see
 * `pressureMultiplier`. That is the one input the clock cannot know.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HONESTY ABOUT WHO IS ON THE OTHER SIDE
 * ─────────────────────────────────────────────────────────────────────────────
 * There are no other players here, and the copy on the page says so. The
 * counterparties are named in-world houses, and the entity/market spec's rule
 * that a surface must never "imply live demand or player activity" is why they
 * are drawn as merchant houses rather than as usernames with fake timestamps.
 * A simulated market presented as a real one is the one version of this feature
 * that would be a lie.
 *
 * Pure data and pure functions. No browser APIs — safe on the SSR path, and
 * every number below is reachable from a unit test without a fake clock.
 */
import { RUNE_TIERS, type RuneTier } from '../rune-forge/rune.model';
import { ITEM_DEFINITIONS, stickerPrice } from '../rpg/item-definition';
import { isUnique } from '../rpg/unique-items';
import { materialDisplay } from '../rpg/material-catalog';
import type { ItemRarity } from '../rpg/item.model';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

// ─────────────────────────────────────────────────────────────────────────────
// The goods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What kind of thing a line trades, which decides how it is delivered.
 *
 * `material` moves through the stack ledger (`grantStack` / `dropStack`);
 * `equipment` mints and destroys instances. They are separated here rather than
 * inferred at the call site because the two have different capacity rules and
 * getting them the wrong way round costs a player their bag.
 */
export type GoodKind = 'material' | 'equipment';

export type GoodCategory =
  | 'ore' | 'reagent' | 'essence'
  | 'weapon' | 'armour' | 'trinket';

export interface ExchangeGood {
  id: string;
  name: string;
  kind: GoodKind;
  category: GoodCategory;
  rarity: ItemRarity;
  /** The stack ledger key. Materials only. */
  stackKey?: string;
  /** The authored definition to mint. Equipment only. */
  definitionId?: string;
  /** The anchor every multiplier below is applied to. */
  basePrice: number;
  /**
   * Units of this good the market absorbs before the player's own trading
   * starts moving the price. Small for equipment, large for ore — which is
   * what makes dumping 400 Cinder Ore a market event and selling one helm not.
   */
  liquidity: number;
  /** Per-good seed. Stable across releases: it is derived from the id. */
  seed: number;
  art?: string;
}

/** A sampled price, for the chart. */
export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export type Trend = 'rising' | 'falling' | 'stable';

/** One row as the page renders it. */
export interface MarketListing {
  good: ExchangeGood;
  itemId: string;
  itemName: string;
  rarity: ItemRarity;
  basePrice: number;
  currentPrice: number;
  /** Fractional change against 24h ago: 0.12 is +12%. */
  change24h: number;
  trend: Trend;
  supply: number;
  demand: number;
  /** A short recent window, for the row's sparkline. */
  spark: readonly PricePoint[];
  /** Event ids currently moving this line. */
  eventIds: readonly string[];
  /** True when the player's own trading is what moved it. */
  playerMoved: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing and noise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A 32-bit integer hash. Deterministic, cheap, and — the part that matters —
 * avalanching, so two adjacent hours do not produce two adjacent prices.
 */
export function hash32(a: number, b: number): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/** The same hash, mapped to [0, 1). */
export function hash01(a: number, b: number): number {
  return hash32(a, b) / 4_294_967_296;
}

/** Hermite smoothstep. Keeps the interpolated curve C¹ across bucket edges. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * One octave of value noise: hashed values on a lattice of `periodHours`,
 * smoothly interpolated. Returns [-1, 1].
 */
export function octave(seed: number, hours: number, periodHours: number): number {
  const x = hours / periodHours;
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  return a + (b - a) * f;
}

/**
 * The composite drift for a good at a moment. Returns roughly [-1, 1].
 *
 * Three octaves, because one is not a market. The 96-hour octave is the
 * multi-day swing a player notices between sessions, the 18-hour one is the
 * intraday shape, and the 3-hour one is the churn that makes a refresh worth
 * doing. The weights sum to 1 so the result stays in band.
 */
export function drift(seed: number, at: number): number {
  const hours = at / HOUR_MS;
  return (
    octave(seed, hours, 96) * 0.5 +
    octave(seed ^ 0x5bf03635, hours, 18) * 0.33 +
    octave(seed ^ 0x1b873593, hours, 3) * 0.17
  );
}

/**
 * How far the drift is allowed to carry a price, as a natural log.
 *
 * `ln(3)`, so a drift of ±1 is ×3 and ÷3. With the octave weights above, the
 * hour-to-hour move that produces lands in the 5–15% band the design asks for
 * — `exchange.model.spec.ts` measures the real distribution over a simulated
 * month rather than trusting this comment.
 */
const VOLATILITY = Math.log(3);

/** Hard floor and ceiling, as multiples of base. Nothing escapes these. */
export const PRICE_FLOOR_MULT = 0.1;
export const PRICE_CEILING_MULT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Market events
// ─────────────────────────────────────────────────────────────────────────────

/** Which lines an event touches. */
export interface EventScope {
  categories?: readonly GoodCategory[];
  rarities?: readonly ItemRarity[];
  kinds?: readonly GoodKind[];
  /** No scope at all means every line. */
  all?: boolean;
}

export interface MarketEventDefinition {
  id: string;
  name: string;
  blurb: string;
  /** Applied to price. 1.2 is +20%. */
  multiplier: number;
  durationMs: number;
  scope: EventScope;
  tone: 'boon' | 'bane' | 'crash';
}

export interface ActiveMarketEvent extends MarketEventDefinition {
  startsAt: number;
  endsAt: number;
}

/**
 * The slot an event may start in.
 *
 * Two hours, and roughly half of the slots fire, which is what makes the
 * spacing read as "every two to four hours" without a stored schedule. The
 * slot boundary is the start time, so an event's start is as computable as its
 * price effect and no clock has to have been running to know it happened.
 */
export const EVENT_SLOT_MS = 2 * HOUR_MS;
const EVENT_CHANCE = 0.55;
const EVENT_SEED = 0x00e7ecab;

export const MARKET_EVENTS: readonly MarketEventDefinition[] = [
  {
    id: 'luminous-harvest',
    name: 'Luminous Harvest',
    blurb: 'The prism seams are running bright. Reagent houses are paying over the odds.',
    multiplier: 1.15,
    durationMs: HOUR_MS,
    scope: { categories: ['reagent'] },
    tone: 'boon',
  },
  {
    id: 'umbral-drought',
    name: 'Umbral Drought',
    blurb: 'Nothing is coming out of the shadow seams. The essence houses have stopped bidding.',
    multiplier: 0.8,
    durationMs: 2 * HOUR_MS,
    scope: { categories: ['essence'] },
    tone: 'bane',
  },
  {
    id: 'eclipse-crash',
    name: 'Eclipse Market Crash',
    blurb: 'Every ledger in the hall went red at once. Everything is cheap, and nobody knows for how long.',
    multiplier: 0.9,
    durationMs: HOUR_MS / 2,
    scope: { all: true },
    tone: 'crash',
  },
  {
    id: 'forge-shortage',
    name: 'Forge Shortage',
    blurb: 'Three foundries went cold this morning. Ore is fetching whatever the buyer will stand.',
    multiplier: 1.25,
    durationMs: 90 * 60_000,
    scope: { categories: ['ore'] },
    tone: 'boon',
  },
  {
    id: 'armourers-glut',
    name: "Armourers' Glut",
    blurb: 'A caravan of plate arrived intact for once. The racks are full and the price shows it.',
    multiplier: 0.82,
    durationMs: 2 * HOUR_MS,
    scope: { categories: ['armour'] },
    tone: 'bane',
  },
  {
    id: 'relic-fever',
    name: 'Relic Fever',
    blurb: 'A collector with more Gold than judgement is in the hall. Rare and better is moving fast.',
    multiplier: 1.3,
    durationMs: HOUR_MS,
    scope: { rarities: ['rare', 'epic', 'legendary', 'mythic', 'singular'] },
    tone: 'boon',
  },
  {
    id: 'blade-levy',
    name: 'Blade Levy',
    blurb: 'The Keepers are arming. Every edged thing in the hall has a buyer waiting.',
    multiplier: 1.2,
    durationMs: 90 * 60_000,
    scope: { categories: ['weapon'] },
    tone: 'boon',
  },
  {
    id: 'quiet-hall',
    name: 'The Quiet Hall',
    blurb: 'Barely a soul at the counters. Sellers are taking what they can get.',
    multiplier: 0.88,
    durationMs: HOUR_MS,
    scope: { kinds: ['equipment'] },
    tone: 'bane',
  },
];

const EVENTS_BY_ID = new Map(MARKET_EVENTS.map(e => [e.id, e]));

export function eventById(id: string): MarketEventDefinition | undefined {
  return EVENTS_BY_ID.get(id);
}

/** True when this event touches this good. */
export function eventTouches(event: MarketEventDefinition, good: ExchangeGood): boolean {
  const s = event.scope;
  if (s.all) return true;
  if (s.categories?.includes(good.category)) return true;
  if (s.rarities?.includes(good.rarity)) return true;
  if (s.kinds?.includes(good.kind)) return true;
  return false;
}

/**
 * The event that started in a given slot, if one did.
 *
 * Exported for the spec, which walks a month of slots and asserts the spacing
 * and the mix rather than sampling a handful by eye.
 */
export function eventForSlot(slot: number): ActiveMarketEvent | null {
  if (hash01(EVENT_SEED, slot) >= EVENT_CHANCE) return null;
  const pick = MARKET_EVENTS[hash32(EVENT_SEED ^ 0x2545f491, slot) % MARKET_EVENTS.length];
  // Started somewhere *inside* the slot rather than on its edge. Pinning every
  // event to a slot boundary would mean no event could ever overlap another —
  // the longest one runs exactly one slot — so the crash could never land
  // during a boon and `eventMultiplier`'s product would only ever have one
  // term in it. It also makes the timing read as a schedule: an hour that
  // always turns over on the hour is a cron job, not a market.
  const offset = Math.floor(hash01(EVENT_SEED ^ 0x7f4a7c15, slot) * EVENT_SLOT_MS);
  const startsAt = slot * EVENT_SLOT_MS + offset;
  return { ...pick, startsAt, endsAt: startsAt + pick.durationMs };
}

/**
 * Every event running at `at`.
 *
 * Looks back two slots as well as the current one, and both are needed: an
 * event may start anywhere inside its slot and run for up to a full slot, so
 * the latest instant it can still be live is two slot-lengths after its slot
 * began. Looking back one would drop a long event from the banner halfway
 * through it.
 */
export function activeEvents(at: number): ActiveMarketEvent[] {
  const slot = Math.floor(at / EVENT_SLOT_MS);
  const out: ActiveMarketEvent[] = [];
  for (let s = slot - 2; s <= slot; s++) {
    const event = eventForSlot(s);
    if (event && at >= event.startsAt && at < event.endsAt) out.push(event);
  }
  return out;
}

/** The combined event multiplier on one good at one moment. */
export function eventMultiplier(good: ExchangeGood, at: number): number {
  let m = 1;
  for (const event of activeEvents(at)) {
    if (eventTouches(event, good)) m *= event.multiplier;
  }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player pressure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the player's own trading has done to one line.
 *
 * `net` is units, signed: positive is bought *from* the market, which takes
 * stock off the shelf and pushes the price up; negative is sold into it. It is
 * a single decaying number rather than a list of trades because the market only
 * needs to know the current imbalance, and a list would grow without bound in a
 * blob that gets synced.
 */
export interface Pressure {
  net: number;
  /** When `net` was last stamped. Decay is measured from here. */
  at: number;
}

/** How long the market takes to forget half of what the player did. */
export const PRESSURE_HALF_LIFE_MS = 6 * HOUR_MS;

/** The most the player's own trading may move a price, as a natural log. */
const PRESSURE_CAP = 0.65;

/** `net`, decayed to `now`. */
export function decayedPressure(pressure: Pressure | undefined, now: number): number {
  if (!pressure || !Number.isFinite(pressure.net) || pressure.net === 0) return 0;
  const elapsed = Math.max(0, now - pressure.at);
  return pressure.net * Math.pow(0.5, elapsed / PRESSURE_HALF_LIFE_MS);
}

/**
 * Fold a new trade into a decaying total.
 *
 * The old value is decayed to `now` *before* the new units are added, so the
 * stamp can be moved forward without the earlier trade getting a fresh
 * half-life it did not earn.
 */
export function applyPressure(
  pressure: Pressure | undefined,
  units: number,
  now: number,
): Pressure {
  return { net: decayedPressure(pressure, now) + units, at: now };
}

/**
 * The multiplier the player's own trading puts on a price.
 *
 * Scaled by the good's liquidity, so "a lot" means a different number of units
 * for ore than for a helm, and capped either side so a determined player can
 * move a market but cannot delete one.
 */
export function pressureMultiplier(
  good: ExchangeGood,
  pressure: Pressure | undefined,
  now: number,
): number {
  const net = decayedPressure(pressure, now);
  if (net === 0) return 1;
  const ratio = net / Math.max(1, good.liquidity);
  return Math.exp(Math.max(-1, Math.min(1, ratio)) * PRESSURE_CAP);
}

// ─────────────────────────────────────────────────────────────────────────────
// Price
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What one unit of `good` costs at `at`.
 *
 * Base × clock drift × active events × the player's own footprint, clamped to
 * the floor and ceiling. Whole Gold: a market that quotes fractions of a coin
 * invites rounding arguments at every call site, so the rounding happens once,
 * here.
 */
export function priceAt(good: ExchangeGood, at: number, pressure?: Pressure): number {
  const raw =
    good.basePrice *
    Math.exp(drift(good.seed, at) * VOLATILITY) *
    eventMultiplier(good, at) *
    pressureMultiplier(good, pressure, at);

  const floor = good.basePrice * PRICE_FLOOR_MULT;
  const ceiling = good.basePrice * PRICE_CEILING_MULT;
  return Math.max(1, Math.round(Math.min(ceiling, Math.max(floor, raw))));
}

/**
 * Units changing hands in the hour containing `at`.
 *
 * Hashed rather than derived from the price so the volume bars are not just the
 * price line drawn twice, and biased up when the price is moving hard, because
 * a market that is going somewhere is a market people are trading in.
 */
export function volumeAt(good: ExchangeGood, at: number): number {
  const hour = Math.floor(at / HOUR_MS);
  const base = good.liquidity * (0.25 + hash01(good.seed ^ 0x27d4eb2f, hour) * 0.75);
  const momentum = Math.abs(priceAt(good, at) - priceAt(good, at - HOUR_MS)) / Math.max(1, good.basePrice);
  return Math.max(1, Math.round(base * (1 + Math.min(2, momentum * 6))));
}

/**
 * `count` evenly spaced samples ending at `to`, spanning `spanMs`.
 *
 * The last sample is exactly `to`, so the chart's right edge is the price the
 * buy button will actually charge. Getting that wrong by one bucket is the
 * difference between a chart and a lie.
 */
export function priceHistory(
  good: ExchangeGood,
  to: number,
  spanMs: number,
  count = 48,
  pressure?: Pressure,
): PricePoint[] {
  const points: PricePoint[] = [];
  const step = spanMs / Math.max(1, count - 1);
  for (let i = 0; i < count; i++) {
    const t = to - spanMs + step * i;
    points.push({ timestamp: t, price: priceAt(good, t, pressure), volume: volumeAt(good, t) });
  }
  return points;
}

/** Trailing mean over `window` samples. Same length as the input. */
export function movingAverage(points: readonly PricePoint[], window = 6): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].price;
    if (i >= window) sum -= points[i - window].price;
    out.push(sum / Math.min(window, i + 1));
  }
  return out;
}

/** Where the price sits against 24 hours ago. `0.12` is +12%. */
export function change24h(good: ExchangeGood, at: number, pressure?: Pressure): number {
  const then = priceAt(good, at - DAY_MS, pressure);
  if (then <= 0) return 0;
  return (priceAt(good, at, pressure) - then) / then;
}

/** Anything inside ±2% is noise, not a trend. */
export const TREND_DEADBAND = 0.02;

export function trendOf(change: number): Trend {
  if (change > TREND_DEADBAND) return 'rising';
  if (change < -TREND_DEADBAND) return 'falling';
  return 'stable';
}

/**
 * Stock on the shelf, and how many the houses are asking for.
 *
 * Both are read off the same clock as the price and move against each other,
 * because a shelf that is full while everyone is buying is the tell that the
 * numbers are decorative. Supply falls as price rises; demand does the
 * opposite. The player's own pressure is already in the price, so it reaches
 * these through it rather than being applied twice.
 */
export function supplyAt(good: ExchangeGood, at: number, pressure?: Pressure): number {
  const ratio = priceAt(good, at, pressure) / good.basePrice;
  const wobble = 0.7 + hash01(good.seed ^ 0x165667b1, Math.floor(at / HOUR_MS)) * 0.6;
  return Math.max(0, Math.round((good.liquidity * wobble) / Math.max(0.35, ratio)));
}

export function demandAt(good: ExchangeGood, at: number, pressure?: Pressure): number {
  const ratio = priceAt(good, at, pressure) / good.basePrice;
  const wobble = 0.7 + hash01(good.seed ^ 0x9e3779b1, Math.floor(at / HOUR_MS)) * 0.6;
  return Math.max(0, Math.round(good.liquidity * wobble * Math.min(2.5, ratio)));
}

// ─────────────────────────────────────────────────────────────────────────────
// The tax
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The house's cut on a sale, and the only Gold sink on this page.
 *
 * Charged on sales only. Taxing both sides would make a round trip cost 10%
 * and turn the market into a place you visit once; taxing the sale alone still
 * removes Gold from the economy on every disposal, which is what a sink is for.
 */
export const SALE_TAX_RATE = 0.05;

export interface Quote {
  unitPrice: number;
  quantity: number;
  gross: number;
  tax: number;
  /** Paid on a buy, received on a sale. */
  net: number;
}

export function quoteBuy(unitPrice: number, quantity: number): Quote {
  const qty = Math.max(0, Math.floor(quantity));
  const gross = unitPrice * qty;
  return { unitPrice, quantity: qty, gross, tax: 0, net: gross };
}

export function quoteSell(unitPrice: number, quantity: number): Quote {
  const qty = Math.max(0, Math.floor(quantity));
  const gross = unitPrice * qty;
  const tax = Math.ceil(gross * SALE_TAX_RATE);
  return { unitPrice, quantity: qty, gross, tax, net: Math.max(0, gross - tax) };
}

// ─────────────────────────────────────────────────────────────────────────────
// The catalogue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Materials the hall trades, with the shape of their market.
 *
 * `base` is authored rather than read off a table, because materials have no
 * sell value anywhere else in the game — the Seamworks grants them and the
 * recipes consume them, and nothing in between ever put a number on one. These
 * are those numbers, ordered so that the things a player has hundreds of are
 * worth the least.
 */
const MATERIAL_MARKETS: Readonly<Record<string, {
  name: string; base: number; liquidity: number; category: GoodCategory; rarity: ItemRarity;
}>> = {
  'cinder-ore':          { name: 'Cinder Ore',          base: 420,    liquidity: 900, category: 'ore',     rarity: 'common' },
  'slag-fragment':       { name: 'Slag Fragment',       base: 260,    liquidity: 900, category: 'ore',     rarity: 'common' },
  'ember-residue':       { name: 'Ember Residue',       base: 1_800,  liquidity: 500, category: 'reagent', rarity: 'uncommon' },
  'thornroot':           { name: 'Thornroot',           base: 1_400,  liquidity: 500, category: 'reagent', rarity: 'common' },
  'sunbloom':            { name: 'Sunbloom',            base: 2_600,  liquidity: 400, category: 'reagent', rarity: 'uncommon' },
  'nightbloom':          { name: 'Nightbloom',          base: 2_900,  liquidity: 400, category: 'reagent', rarity: 'uncommon' },
  'starlight-herb':      { name: 'Starlight Herb',      base: 6_500,  liquidity: 250, category: 'reagent', rarity: 'rare' },
  'verdant-sap':         { name: 'Verdant Sap',         base: 4_200,  liquidity: 300, category: 'reagent', rarity: 'uncommon' },
  'umbral-ink':          { name: 'Umbral Ink',          base: 9_000,  liquidity: 200, category: 'essence', rarity: 'rare' },
  'luminous-prism':      { name: 'Luminous Prism',      base: 14_000, liquidity: 160, category: 'essence', rarity: 'rare' },
  'celestial-alloy':     { name: 'Celestial Alloy',     base: 26_000, liquidity: 120, category: 'ore',     rarity: 'epic' },
  'void-shard':          { name: 'Void Shard',          base: 60_000, liquidity: 60,  category: 'essence', rarity: 'legendary' },
  'infernal-heartstone': { name: 'Infernal Heartstone', base: 95_000, liquidity: 40,  category: 'essence', rarity: 'legendary' },
  'clarity-elixir':      { name: 'Clarity Elixir',      base: 18_000, liquidity: 90,  category: 'reagent', rarity: 'epic' },
  'rift-key':            { name: 'Rift Key',            base: 45_000, liquidity: 50,  category: 'essence', rarity: 'epic' },
};

/** Which rarities of authored equipment the hall carries. */
const EQUIPMENT_RARITIES: readonly ItemRarity[] = ['uncommon', 'rare', 'epic', 'legendary'];

/**
 * Equipment liquidity, per rarity.
 *
 * A Legendary is a market of four, so selling two moves it hard. That is the
 * intended feel: dumping ore is a trade, dumping Legendaries is an event.
 */
const EQUIPMENT_LIQUIDITY: Readonly<Record<string, number>> = {
  uncommon: 30, rare: 14, epic: 6, legendary: 3, mythic: 2, singular: 1, common: 60,
};

function categoryForSlot(slot: string | undefined): GoodCategory {
  if (slot === 'weapon' || slot === 'off-hand') return 'weapon';
  if (slot === 'trinket' || slot === undefined) return 'trinket';
  return 'armour';
}

/** A stable seed from a string. Same id, same market, forever. */
export function seedFor(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

function buildCatalogue(): ExchangeGood[] {
  const goods: ExchangeGood[] = [];

  for (const [id, market] of Object.entries(MATERIAL_MARKETS)) {
    goods.push({
      id: `mat:${id}`,
      name: market.name,
      kind: 'material',
      category: market.category,
      rarity: market.rarity,
      stackKey: id,
      basePrice: market.base,
      liquidity: market.liquidity,
      seed: seedFor(id),
      art: materialDisplay(id)?.art,
    });
  }

  for (const def of ITEM_DEFINITIONS) {
    // Soulbound things have no price anywhere else in the game and must not
    // acquire one here — a market that quotes an artifact is a market that
    // implies it can be sold.
    if (def.soulbound) continue;

    // Named objects are excluded outright, not merely at the wrong rarity.
    //
    // `ITEM_DEFINITIONS` is the ordinary catalogue *plus* `UNIQUE_DEFINITIONS`,
    // and a unique exists at exactly one authored rarity — that is what the
    // drop pools filter on. Listing them here would put an "Epic Tally of
    // Hands" on the board at a rarity the item is not authored at, and buying
    // it would mint an instance the rest of the game says cannot exist.
    //
    // Listing them only at their authored rarity would be sound arithmetic and
    // still the wrong feature: a unique is the thing you get for looking, and
    // a shelf price deletes the reason to look. They are found, not bought.
    if (isUnique({ definitionId: def.id })) continue;

    for (const rarity of EQUIPMENT_RARITIES) {
      const id = `eq:${def.id}:${rarity}`;
      goods.push({
        id,
        name: `${RUNE_TIERS[rarity as RuneTier].label} ${def.name}`,
        kind: 'equipment',
        category: categoryForSlot(def.slot),
        rarity,
        definitionId: def.id,
        basePrice: Math.max(500, Math.round(stickerPrice(def, rarity))),
        liquidity: EQUIPMENT_LIQUIDITY[rarity] ?? 10,
        seed: seedFor(id),
      });
    }
  }

  return goods;
}

export const EXCHANGE_CATALOGUE: readonly ExchangeGood[] = buildCatalogue();

const GOODS_BY_ID = new Map(EXCHANGE_CATALOGUE.map(g => [g.id, g]));

export function goodById(id: string): ExchangeGood | undefined {
  return GOODS_BY_ID.get(id);
}

export const GOOD_CATEGORIES: readonly GoodCategory[] =
  ['ore', 'reagent', 'essence', 'weapon', 'armour', 'trinket'];

export const CATEGORY_LABELS: Readonly<Record<GoodCategory, string>> = {
  ore: 'Ore', reagent: 'Reagents', essence: 'Essence',
  weapon: 'Weapons', armour: 'Armour', trinket: 'Trinkets',
};

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

/** Build the row the page renders for one good. */
export function listingFor(
  good: ExchangeGood,
  at: number,
  pressure?: Pressure,
): MarketListing {
  const change = change24h(good, at, pressure);
  return {
    good,
    itemId: good.id,
    itemName: good.name,
    rarity: good.rarity,
    basePrice: good.basePrice,
    currentPrice: priceAt(good, at, pressure),
    change24h: change,
    trend: trendOf(change),
    supply: supplyAt(good, at, pressure),
    demand: demandAt(good, at, pressure),
    spark: priceHistory(good, at, 12 * HOUR_MS, 24, pressure),
    eventIds: activeEvents(at).filter(e => eventTouches(e, good)).map(e => e.id),
    playerMoved: Math.abs(decayedPressure(pressure, at)) >= 1,
  };
}
