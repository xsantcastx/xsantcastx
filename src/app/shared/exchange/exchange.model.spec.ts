/**
 * exchange.model.spec.ts — the market's arithmetic, measured rather than eyed.
 *
 * The price engine's whole claim is that it *feels* like a market, and a
 * comment saying "roughly 5–15% an hour" is not a claim a reader can check. So
 * the volatility, the event spacing and the clamps are all asserted against a
 * simulated month of the real functions, which is the only way a later retune
 * of a constant can fail loudly instead of quietly making the board flat.
 */
import {
  DAY_MS,
  EVENT_SLOT_MS,
  EXCHANGE_CATALOGUE,
  HOUR_MS,
  MARKET_EVENTS,
  PRESSURE_HALF_LIFE_MS,
  PRICE_CEILING_MULT,
  PRICE_FLOOR_MULT,
  SALE_TAX_RATE,
  activeEvents,
  applyPressure,
  change24h,
  decayedPressure,
  eventForSlot,
  eventTouches,
  goodById,
  hash01,
  listingFor,
  movingAverage,
  octave,
  priceAt,
  priceHistory,
  pressureMultiplier,
  quoteBuy,
  quoteSell,
  seedFor,
  trendOf,
  volumeAt,
  type ExchangeGood,
} from './exchange.model';
import { UNIQUE_ITEMS, isUnique } from '../rpg/unique-items';
import { itemDefinitionById } from '../rpg/item-definition';

/** A fixed instant, so a failure is reproducible rather than "sometimes". */
const T0 = Date.UTC(2026, 7, 19, 12, 0, 0);

const ore = goodById('mat:cinder-ore')!;
const shard = goodById('mat:void-shard')!;

describe('exchange price engine', () => {

  // ── The catalogue ─────────────────────────────────────────────────────────

  it('carries every material market and four rarities of each sellable definition', () => {
    expect(EXCHANGE_CATALOGUE.length).toBeGreaterThan(60);
    expect(ore).toBeTruthy();
    expect(shard).toBeTruthy();
    // Soulbound things must never acquire a price here.
    expect(EXCHANGE_CATALOGUE.some(g => g.basePrice <= 0)).toBe(false);
  });

  it('never lists a named object, at any rarity', () => {
    // `ITEM_DEFINITIONS` includes `UNIQUE_DEFINITIONS`, and a unique exists at
    // exactly one authored rarity. A line for one at any other rarity would
    // mint an instance the drop pools say cannot exist — and pricing one at
    // all deletes the reason to go looking for it.
    const listed = EXCHANGE_CATALOGUE
      .filter(g => g.kind === 'equipment')
      .map(g => g.definitionId!);
    expect(listed.length).toBeGreaterThan(0);
    for (const id of listed) expect(isUnique({ definitionId: id })).toBe(false);
    for (const unique of UNIQUE_ITEMS) {
      expect(EXCHANGE_CATALOGUE.some(g => g.definitionId === unique.id)).toBe(false);
    }
  });

  it('never lists a soulbound definition', () => {
    for (const good of EXCHANGE_CATALOGUE) {
      if (good.kind !== 'equipment') continue;
      expect(itemDefinitionById(good.definitionId!)?.soulbound).not.toBe(true);
    }
  });

  it('gives every line a distinct seed, so two goods never move in lockstep', () => {
    const seeds = new Set(EXCHANGE_CATALOGUE.map(g => g.seed));
    expect(seeds.size).toBe(EXCHANGE_CATALOGUE.length);
  });

  it('derives a seed from the id and nothing else', () => {
    expect(seedFor('cinder-ore')).toBe(seedFor('cinder-ore'));
    expect(seedFor('cinder-ore')).not.toBe(seedFor('void-shard'));
  });

  // ── Determinism ───────────────────────────────────────────────────────────

  it('answers the same price for the same instant, every time', () => {
    for (let i = 0; i < 50; i++) {
      expect(priceAt(ore, T0)).toBe(priceAt(ore, T0));
    }
  });

  it('prices the past as readily as the present — the chart is not stored', () => {
    const monthAgo = T0 - 30 * DAY_MS;
    expect(priceAt(ore, monthAgo)).toBeGreaterThan(0);
    expect(priceAt(ore, monthAgo)).toBe(priceAt(ore, monthAgo));
  });

  it('is continuous across an hour boundary — no step at the lattice', () => {
    // The smoothstep is what stops the sparkline drawing a staircase. A jump of
    // more than a couple of per cent across one minute would be that bug.
    const edge = Math.ceil(T0 / HOUR_MS) * HOUR_MS;
    const before = priceAt(ore, edge - 30_000);
    const after = priceAt(ore, edge + 30_000);
    expect(Math.abs(after - before) / before).toBeLessThan(0.03);
  });

  it('keeps every octave inside [-1, 1]', () => {
    for (let h = 0; h < 2000; h += 7) {
      const v = octave(ore.seed, h, 18);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('hashes into [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = hash01(1234, i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  // ── Volatility ────────────────────────────────────────────────────────────

  it('moves a line by a readable amount each hour — not flat, not chaos', () => {
    // The design asks for 5–15% an hour. This measures what the constants
    // actually produce over a simulated month, across every line, and asserts
    // the *median* lands in a band around that. Retuning VOLATILITY or the
    // octave weights past this band should fail here rather than in review.
    const moves: number[] = [];
    for (const good of EXCHANGE_CATALOGUE) {
      for (let h = 0; h < 24 * 30; h++) {
        const a = priceAt(good, T0 - h * HOUR_MS);
        const b = priceAt(good, T0 - (h + 1) * HOUR_MS);
        moves.push(Math.abs(a - b) / Math.max(1, b));
      }
    }
    moves.sort((x, y) => x - y);
    const median = moves[Math.floor(moves.length / 2)];
    expect(median).toBeGreaterThan(0.01);
    expect(median).toBeLessThan(0.2);
  });

  it('actually swings over a month — a market that never moves is a price list', () => {
    const prices: number[] = [];
    for (let d = 0; d < 30; d++) prices.push(priceAt(shard, T0 - d * DAY_MS));
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    expect(hi / lo).toBeGreaterThan(1.4);
  });

  // ── The clamps ────────────────────────────────────────────────────────────

  it('never prints below the floor or above the ceiling, over a simulated year', () => {
    for (const good of [ore, shard]) {
      const floor = good.basePrice * PRICE_FLOOR_MULT;
      const ceiling = good.basePrice * PRICE_CEILING_MULT;
      for (let h = 0; h < 24 * 365; h += 3) {
        const p = priceAt(good, T0 - h * HOUR_MS);
        expect(p).toBeGreaterThanOrEqual(Math.min(1, floor));
        expect(p).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('holds the clamp even against a player who dumps everything they own', () => {
    // A pressure far past anything a real bag could produce still cannot push a
    // line through its floor.
    const crushed: ExchangeGood = ore;
    const p = priceAt(crushed, T0, { net: -1e6, at: T0 });
    expect(p).toBeGreaterThanOrEqual(Math.min(1, crushed.basePrice * PRICE_FLOOR_MULT));
  });

  // ── Events ────────────────────────────────────────────────────────────────

  it('starts an event in roughly half the two-hour slots', () => {
    const slots = 24 * 30 / 2; // a month of slots
    const first = Math.floor(T0 / EVENT_SLOT_MS) - slots;
    let fired = 0;
    for (let i = 0; i < slots; i++) if (eventForSlot(first + i)) fired++;
    const rate = fired / slots;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.75);
  });

  it('only reports an event while it is actually running', () => {
    const slot = Math.floor(T0 / EVENT_SLOT_MS);
    for (let i = 0; i < 400; i++) {
      const event = eventForSlot(slot - i);
      if (!event) continue;
      expect(activeEvents(event.startsAt).map(e => e.id)).toContain(event.id);
      expect(activeEvents(event.endsAt).map(e => e.id)).not.toContain(event.id);
      break;
    }
  });

  it('does not lose an event when the clock crosses into the next slot', () => {
    // Events start inside their slot, so most of them run past its end. Looking
    // back only at the current slot would drop them from the banner mid-run.
    const slot = Math.floor(T0 / EVENT_SLOT_MS);
    let spanning = 0;
    for (let i = 0; i < 400 && spanning < 5; i++) {
      const event = eventForSlot(slot - i);
      if (!event) continue;
      const slotEnd = (slot - i + 1) * EVENT_SLOT_MS;
      if (event.endsAt <= slotEnd) continue;
      const afterTheBoundary = slotEnd + 30_000;
      expect(afterTheBoundary).toBeLessThan(event.endsAt);
      expect(activeEvents(afterTheBoundary).map(e => e.id)).toContain(event.id);
      spanning++;
    }
    expect(spanning).toBeGreaterThan(0);
  });

  it('lets two events run at once, so the multiplier can compound', () => {
    // Every event pinned to a slot edge could never overlap another. This is
    // the assertion that catches a change back to that.
    const slot = Math.floor(T0 / EVENT_SLOT_MS);
    let overlaps = 0;
    for (let i = 0; i < 2000; i++) {
      const a = eventForSlot(slot - i);
      const b = eventForSlot(slot - i - 1);
      if (a && b && b.endsAt > a.startsAt) overlaps++;
    }
    expect(overlaps).toBeGreaterThan(0);
  });

  it('scopes each event to lines it should touch', () => {
    const ourFever = MARKET_EVENTS.find(e => e.id === 'relic-fever')!;
    const legendary = EXCHANGE_CATALOGUE.find(g => g.rarity === 'legendary')!;
    const common = EXCHANGE_CATALOGUE.find(g => g.rarity === 'common')!;
    expect(eventTouches(ourFever, legendary)).toBe(true);
    expect(eventTouches(ourFever, common)).toBe(false);

    const crash = MARKET_EVENTS.find(e => e.id === 'eclipse-crash')!;
    expect(EXCHANGE_CATALOGUE.every(g => eventTouches(crash, g))).toBe(true);
  });

  // ── Pressure ──────────────────────────────────────────────────────────────

  it('decays a footprint by half over one half-life', () => {
    const p = { net: 100, at: T0 };
    expect(decayedPressure(p, T0)).toBeCloseTo(100, 6);
    expect(decayedPressure(p, T0 + PRESSURE_HALF_LIFE_MS)).toBeCloseTo(50, 6);
    expect(decayedPressure(p, T0 + 2 * PRESSURE_HALF_LIFE_MS)).toBeCloseTo(25, 6);
  });

  it('decays the old footprint before folding in the new one', () => {
    // Stamping `at` forward without decaying first would hand the earlier trade
    // a fresh half-life it did not earn.
    const first = applyPressure(undefined, 100, T0);
    const later = applyPressure(first, 100, T0 + PRESSURE_HALF_LIFE_MS);
    expect(later.net).toBeCloseTo(150, 6);
    expect(later.at).toBe(T0 + PRESSURE_HALF_LIFE_MS);
  });

  it('raises the price when the player buys and lowers it when they sell', () => {
    const flat = priceAt(ore, T0);
    const bought = priceAt(ore, T0, { net: ore.liquidity, at: T0 });
    const sold = priceAt(ore, T0, { net: -ore.liquidity, at: T0 });
    expect(bought).toBeGreaterThan(flat);
    expect(sold).toBeLessThan(flat);
  });

  it('scales the footprint by liquidity — ten ore is nothing, ten Legendaries is not', () => {
    const legendary = EXCHANGE_CATALOGUE.find(g => g.kind === 'equipment' && g.rarity === 'legendary')!;
    const oreMove = pressureMultiplier(ore, { net: 10, at: T0 }, T0);
    const eqMove = pressureMultiplier(legendary, { net: 10, at: T0 }, T0);
    expect(eqMove).toBeGreaterThan(oreMove);
  });

  it('caps how far a determined player can move one line', () => {
    const extreme = pressureMultiplier(ore, { net: 1e9, at: T0 }, T0);
    expect(extreme).toBeLessThan(2.5);
    const opposite = pressureMultiplier(ore, { net: -1e9, at: T0 }, T0);
    expect(opposite).toBeGreaterThan(0.4);
  });

  it('treats a missing or zeroed footprint as no footprint at all', () => {
    expect(pressureMultiplier(ore, undefined, T0)).toBe(1);
    expect(pressureMultiplier(ore, { net: 0, at: T0 }, T0)).toBe(1);
    expect(decayedPressure(undefined, T0)).toBe(0);
  });

  // ── History and trend ─────────────────────────────────────────────────────

  it('ends the history exactly on the instant it was asked for', () => {
    // The right edge of the chart has to be the price the buy button charges.
    const points = priceHistory(ore, T0, DAY_MS, 48);
    expect(points.length).toBe(48);
    expect(points[points.length - 1].timestamp).toBe(T0);
    expect(points[points.length - 1].price).toBe(priceAt(ore, T0));
  });

  it('spans the window it was given', () => {
    const points = priceHistory(ore, T0, 7 * DAY_MS, 20);
    expect(points[0].timestamp).toBe(T0 - 7 * DAY_MS);
  });

  it('reports a trend that agrees with the 24-hour change', () => {
    for (const good of EXCHANGE_CATALOGUE.slice(0, 20)) {
      const change = change24h(good, T0);
      const trend = trendOf(change);
      if (trend === 'rising') expect(change).toBeGreaterThan(0);
      if (trend === 'falling') expect(change).toBeLessThan(0);
    }
  });

  it('calls a market with movement in both directions rather than one', () => {
    // A board where everything rises is a board nobody has to think about.
    const rows = EXCHANGE_CATALOGUE.map(g => listingFor(g, T0));
    expect(rows.some(r => r.trend === 'rising')).toBe(true);
    expect(rows.some(r => r.trend === 'falling')).toBe(true);
  });

  it('trails the mean over the window and never runs off the end', () => {
    const points = priceHistory(ore, T0, DAY_MS, 12);
    const avg = movingAverage(points, 4);
    expect(avg.length).toBe(points.length);
    expect(avg[0]).toBe(points[0].price);
    expect(avg.every(v => Number.isFinite(v))).toBe(true);
  });

  it('always quotes at least one unit of volume', () => {
    for (let h = 0; h < 200; h++) {
      expect(volumeAt(ore, T0 - h * HOUR_MS)).toBeGreaterThanOrEqual(1);
    }
  });

  it('moves supply and demand against each other', () => {
    const rows = EXCHANGE_CATALOGUE.slice(0, 30).map(g => listingFor(g, T0));
    const dear = rows.filter(r => r.currentPrice > r.basePrice * 1.2);
    // Expensive lines are the ones the shelf has run short of.
    for (const row of dear) expect(row.demand).toBeGreaterThan(row.supply);
  });

  // ── The tax ───────────────────────────────────────────────────────────────

  it('charges nothing to buy and five per cent to sell', () => {
    expect(SALE_TAX_RATE).toBe(0.05);
    expect(quoteBuy(1_000, 10)).toEqual({
      unitPrice: 1_000, quantity: 10, gross: 10_000, tax: 0, net: 10_000,
    });
    expect(quoteSell(1_000, 10)).toEqual({
      unitPrice: 1_000, quantity: 10, gross: 10_000, tax: 500, net: 9_500,
    });
  });

  it('rounds the house cut up, so the sink never leaks a fraction of a coin', () => {
    const q = quoteSell(101, 1);
    expect(q.tax).toBe(6);        // 5.05 → 6
    expect(q.net).toBe(95);
    expect(q.net + q.tax).toBe(q.gross);
  });

  it('refuses a fractional or negative quantity rather than inventing one', () => {
    expect(quoteBuy(100, 2.7).quantity).toBe(2);
    expect(quoteBuy(100, -5).quantity).toBe(0);
    expect(quoteSell(100, -5).net).toBe(0);
  });
});
