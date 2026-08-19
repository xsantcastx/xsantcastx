/**
 * exchange.service.spec.ts — the order of operations, and what a failure costs.
 *
 * The model spec proves the arithmetic. This one proves the thing that actually
 * loses a player money: that a trade which fails halfway leaves them exactly
 * where they started, and that a trade which succeeds moved both ledgers.
 */
import { TestBed } from '@angular/core/testing';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { EXCHANGE_KEY, ExchangeService } from './exchange.service';
import { SALE_TAX_RATE, goodById, priceAt } from './exchange.model';
import { itemDefinitionById } from '../rpg/item-definition';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function configure(memory: MemoryGateway, gold: number): {
  exchange: ExchangeService;
  economy: EconomyService;
  inventory: InventoryService;
} {
  memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
  TestBed.configureTestingModule({
    providers: [
      ExchangeService,
      InventoryService,
      EconomyService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const economy = TestBed.inject(EconomyService);
  economy.init();
  const inventory = TestBed.inject(InventoryService);
  inventory.init();
  const exchange = TestBed.inject(ExchangeService);
  exchange.init();
  return { exchange, economy, inventory };
}

const ORE = 'mat:cinder-ore';

describe('ExchangeService', () => {
  let memory: MemoryGateway;
  let now: number;

  beforeEach(() => {
    TestBed.resetTestingModule();
    memory = new MemoryGateway();
    now = Date.now();
  });

  /** The price the page would have shown, at the instant a test trades. */
  function shown(goodId: string, at: number, service: ExchangeService): number {
    return service.price(goodById(goodId)!, at);
  }

  // ── Buying ────────────────────────────────────────────────────────────────

  it('debits Gold and lands the goods in the bag', () => {
    const { exchange, economy, inventory } = configure(memory, 10_000_000);
    const before = economy.snapshot.gold;
    const price = shown(ORE, now, exchange);

    const result = exchange.buy(ORE, 10, price, now);

    expect(result.ok).toBe(true);
    expect(economy.snapshot.gold).toBe(before - price * 10);
    expect(inventory.stackOf('cinder-ore')).toBe(10);
  });

  it('refuses a purchase it cannot afford, and takes nothing', () => {
    const { exchange, economy, inventory } = configure(memory, 100);
    const price = shown(ORE, now, exchange);

    const result = exchange.buy(ORE, 50, price, now);

    expect(result).toEqual({ ok: false, code: 'funds' });
    expect(economy.snapshot.gold).toBe(100);
    expect(inventory.stackOf('cinder-ore')).toBe(0);
  });

  it('refuses a quantity that is not a positive whole number', () => {
    const { exchange, economy } = configure(memory, 10_000_000);
    const price = shown(ORE, now, exchange);
    const before = economy.snapshot.gold;

    expect(exchange.buy(ORE, 0, price, now)).toEqual({ ok: false, code: 'bad-quantity' });
    expect(exchange.buy(ORE, -3, price, now)).toEqual({ ok: false, code: 'bad-quantity' });
    expect(exchange.buy(ORE, NaN, price, now)).toEqual({ ok: false, code: 'bad-quantity' });
    expect(economy.snapshot.gold).toBe(before);
  });

  it('refuses a line that is not on the board', () => {
    const { exchange } = configure(memory, 10_000_000);
    expect(exchange.buy('mat:not-a-thing', 1, 100, now)).toEqual({ ok: false, code: 'unknown-good' });
  });

  // ── The stale-quote guard ─────────────────────────────────────────────────

  it('refuses a trade whose price has moved against the quote the player read', () => {
    const { exchange, economy } = configure(memory, 10_000_000);
    const before = economy.snapshot.gold;

    // Quote a price far below the live one: a tab left open while the market ran.
    const result = exchange.buy(ORE, 1, 1, now);

    expect(result).toEqual({ ok: false, code: 'stale' });
    expect(economy.snapshot.gold).toBe(before);
  });

  it('settles at the better price when the market moved in the player’s favour', () => {
    // Refusing a *cheaper* price would be a worse surprise than granting it.
    const { exchange, economy } = configure(memory, 10_000_000);
    const live = shown(ORE, now, exchange);
    const before = economy.snapshot.gold;

    const result = exchange.buy(ORE, 1, live * 10, now);

    expect(result.ok).toBe(true);
    expect(economy.snapshot.gold).toBe(before - live);
  });

  it('rejects a quote of zero or nonsense rather than treating it as free', () => {
    const { exchange } = configure(memory, 10_000_000);
    expect(exchange.buy(ORE, 1, 0, now)).toEqual({ ok: false, code: 'stale' });
    expect(exchange.buy(ORE, 1, NaN, now)).toEqual({ ok: false, code: 'stale' });
  });

  // ── Selling ───────────────────────────────────────────────────────────────

  it('pays the market price less the house cut, and takes the goods', () => {
    const { exchange, economy, inventory } = configure(memory, 10_000_000);
    const buyPrice = shown(ORE, now, exchange);
    exchange.buy(ORE, 20, buyPrice, now);

    const goldAfterBuy = economy.snapshot.gold;
    const sellPrice = shown(ORE, now, exchange);
    const gross = sellPrice * 20;
    const tax = Math.ceil(gross * SALE_TAX_RATE);

    const result = exchange.sell(ORE, 20, sellPrice, now);

    expect(result.ok).toBe(true);
    expect(inventory.stackOf('cinder-ore')).toBe(0);
    expect(economy.snapshot.gold).toBe(goldAfterBuy + gross - tax);
    if (result.ok) expect(result.trade.tax).toBe(tax);
  });

  it('refuses to sell more than the player holds, and takes nothing', () => {
    const { exchange, economy, inventory } = configure(memory, 10_000_000);
    exchange.buy(ORE, 3, shown(ORE, now, exchange), now);
    const gold = economy.snapshot.gold;

    const result = exchange.sell(ORE, 99, shown(ORE, now, exchange), now);

    expect(result).toEqual({ ok: false, code: 'no-stock' });
    expect(inventory.stackOf('cinder-ore')).toBe(3);
    expect(economy.snapshot.gold).toBe(gold);
  });

  it('refuses to sell a line the player holds none of', () => {
    const { exchange } = configure(memory, 10_000_000);
    expect(exchange.sell(ORE, 1, shown(ORE, now, exchange), now))
      .toEqual({ ok: false, code: 'no-stock' });
  });

  // ── A round trip is a loss ────────────────────────────────────────────────

  it('costs the player the tax on a round trip — the sink is real', () => {
    const { exchange, economy } = configure(memory, 10_000_000);
    const before = economy.snapshot.gold;
    const price = shown(ORE, now, exchange);

    exchange.buy(ORE, 10, price, now);
    // Sell at the price the market now quotes, which the buy itself moved.
    exchange.sell(ORE, 10, shown(ORE, now, exchange), now);

    expect(economy.snapshot.gold).toBeLessThan(before);
  });

  // ── Pressure ──────────────────────────────────────────────────────────────

  it('lifts the line when the player buys it', () => {
    const { exchange } = configure(memory, 1_000_000_000);
    const good = goodById(ORE)!;
    const before = exchange.price(good, now);

    exchange.buy(ORE, good.liquidity, before, now);

    expect(exchange.price(good, now)).toBeGreaterThan(before);
  });

  it('drops the line when the player floods it', () => {
    const { exchange } = configure(memory, 1_000_000_000);
    const good = goodById(ORE)!;
    exchange.buy(ORE, good.liquidity, exchange.price(good, now), now);

    const peak = exchange.price(good, now);
    exchange.sell(ORE, good.liquidity, peak, now);

    expect(exchange.price(good, now)).toBeLessThan(peak);
  });

  it('lets the market forget a footprint over time', () => {
    const { exchange } = configure(memory, 1_000_000_000);
    const good = goodById(ORE)!;
    exchange.buy(ORE, good.liquidity, exchange.price(good, now), now);

    const moved = exchange.pressureFor(ORE)!;
    const later = now + 24 * 3_600_000;
    // A day out, the footprint is a sixteenth of what it was, so the price is
    // back within a whisker of what the clock alone says.
    const withFootprint = priceAt(good, later, moved);
    const clockOnly = priceAt(good, later);
    expect(Math.abs(withFootprint - clockOnly) / clockOnly).toBeLessThan(0.06);
  });

  // ── The ledger ────────────────────────────────────────────────────────────

  it('records the trade and the day’s running totals', () => {
    const { exchange } = configure(memory, 10_000_000);
    const price = shown(ORE, now, exchange);
    exchange.buy(ORE, 5, price, now);

    const snap = exchange.snapshot;
    expect(snap.trades.length).toBe(1);
    expect(snap.trades[0].side).toBe('buy');
    expect(snap.trades[0].quantity).toBe(5);
    expect(snap.spentToday).toBe(price * 5);
    expect(snap.earnedToday).toBe(0);
  });

  it('keeps the newest trade first', () => {
    const { exchange } = configure(memory, 10_000_000);
    exchange.buy(ORE, 1, shown(ORE, now, exchange), now);
    exchange.buy(ORE, 2, shown(ORE, now + 1, exchange), now + 1);
    expect(exchange.snapshot.trades[0].quantity).toBe(2);
  });

  it('resets the daily tally when the UTC day turns', () => {
    const { exchange } = configure(memory, 10_000_000_000);
    const day1 = Date.UTC(2026, 7, 19, 12, 0, 0);
    const day2 = Date.UTC(2026, 7, 20, 12, 0, 0);

    exchange.buy(ORE, 5, shown(ORE, day1, exchange), day1);
    expect(exchange.snapshot.spentToday).toBeGreaterThan(0);

    exchange.buy(ORE, 1, shown(ORE, day2, exchange), day2);
    const snap = exchange.snapshot;
    // The second day's tally counts only the second day's trade.
    expect(snap.spentToday).toBe(snap.trades[0].net);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it('persists the footprint and the ledger through the gateway', () => {
    const { exchange } = configure(memory, 10_000_000);
    exchange.buy(ORE, 4, shown(ORE, now, exchange), now);

    const raw = memory.readRaw(EXCHANGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.pressure[ORE].net).toBe(4);
    expect(parsed.trades.length).toBe(1);
  });

  it('discards a hand-edited footprint on a line that does not exist', () => {
    memory.writeRaw(EXCHANGE_KEY, JSON.stringify({
      version: 1,
      pressure: { 'mat:not-a-thing': { net: -1e9, at: Date.now() }, [ORE]: { net: 5, at: Date.now() } },
      trades: 'not an array',
      day: '', spent: 'x', earned: null, taxPaid: undefined,
    }));
    const { exchange } = configure(memory, 1_000);

    expect(exchange.pressureFor('mat:not-a-thing')).toBeUndefined();
    expect(exchange.pressureFor(ORE)!.net).toBe(5);
    expect(exchange.snapshot.trades).toEqual([]);
    expect(exchange.snapshot.spentToday).toBe(0);
  });

  it('survives a corrupt blob rather than throwing on first read', () => {
    memory.writeRaw(EXCHANGE_KEY, '{ not json at all');
    const { exchange } = configure(memory, 1_000);
    expect(exchange.snapshot.trades).toEqual([]);
  });

  it('wipes the footprint and the ledger on reset', () => {
    const { exchange } = configure(memory, 10_000_000);
    exchange.buy(ORE, 4, shown(ORE, now, exchange), now);

    exchange.reset();

    expect(exchange.snapshot.trades).toEqual([]);
    expect(exchange.pressureFor(ORE)).toBeUndefined();
    expect(memory.readRaw(EXCHANGE_KEY)).toBeNull();
  });

  // ── Holdings ──────────────────────────────────────────────────────────────

  it('counts a material stack as holdings', () => {
    const { exchange } = configure(memory, 10_000_000);
    const good = goodById(ORE)!;
    expect(exchange.holdings(good)).toBe(0);
    exchange.buy(ORE, 7, shown(ORE, now, exchange), now);
    expect(exchange.holdings(good)).toBe(7);
  });

  it('does not offer an equipped piece for sale', () => {
    const { exchange, inventory } = configure(memory, 1_000_000_000);
    const good = exchange.catalogue.find(g => g.kind === 'equipment' && g.rarity === 'uncommon')!;

    const bought = exchange.buy(good.id, 1, exchange.price(good, now), now);
    expect(bought.ok).toBe(true);
    expect(exchange.holdings(good)).toBe(1);

    const item = exchange.sellableInstances(good)[0];
    // The slot is passed explicitly. `equip(id)` with no slot infers one from
    // `item.type`, and every authored piece is type 'artifact', so it infers
    // 'head' for all of them and then refuses anything whose definition says a
    // different slot. That is a bug in `equip`, not in this trade path, and
    // fixing it is not the Exchange's business — this test only needs the piece
    // to actually be worn.
    const slot = itemDefinitionById(good.definitionId!)!.slot!;
    expect(inventory.equip(item.id, slot)).toBe(true);

    // Worn kit is not stock. The sale has to be refused, not silently take the
    // piece off the player's back.
    expect(exchange.holdings(good)).toBe(0);
    expect(exchange.sell(good.id, 1, exchange.price(good, now), now))
      .toEqual({ ok: false, code: 'no-stock' });
  });
});
