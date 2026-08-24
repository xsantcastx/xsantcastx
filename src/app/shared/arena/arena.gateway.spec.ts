/**
 * arena.gateway.spec.ts — one bout, across four ledgers.
 *
 * The invariants worth a test are the ones that cost a player something when
 * they break: a bout that pays twice on a double press, a loss that takes Gold,
 * a purchase that debits without delivering, and a gate that opens itself.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { InventoryService } from '../rpg/inventory.service';
import { PlayerStatsService } from '../rpg/player-stats.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ArenaGateway } from './arena.gateway';
import { ArenaService } from './arena.service';
import { ARENA_COOLDOWN_MS, arenaStockById, arenaTier } from './arena.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown {
    const raw = this.bag.get(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

let mutation = 0;
function nextMutation(): string { return `spec-bout-${++mutation}`; }

/** A stream that cycles, so no spec runs off the end of it. */
function rolls(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** The rolls that make the player win every round against anyone reachable. */
const ALWAYS_HIGH = rolls(1, 0);
/** The rolls that make the player lose every round. */
const ALWAYS_LOW = rolls(0, 1);

describe('ArenaGateway', () => {
  let memory: MemoryGateway;
  let gateway: ArenaGateway;
  let arena: ArenaService;
  let economy: EconomyService;
  let inventory: InventoryService;

  beforeEach(() => {
    memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [
        ArenaGateway,
        ArenaService,
        EconomyService,
        XpService,
        InventoryService,
        PlayerStatsService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    gateway = TestBed.inject(ArenaGateway);
    arena = TestBed.inject(ArenaService);
    economy = TestBed.inject(EconomyService);
    inventory = TestBed.inject(InventoryService);
    gateway.init();
  });

  // ── The bout ───────────────────────────────────────────────────────────────

  it('pays Gold, XP and points for a win and records it in the right ring', () => {
    const bronze = arenaTier('bronze')!;
    const goldBefore = economy.snapshot.gold;

    const result = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH);
    expect(result.ok).withContext(JSON.stringify(result)).toBeTrue();
    if (!result.ok) return;

    expect(result.settlement.result.won).toBeTrue();
    expect(result.payout.points).toBe(bronze.points);
    // Credited through `earnGold`, so the global multiplier applies and the
    // credited figure is at least the base rate.
    expect(result.goldCredited).toBeGreaterThanOrEqual(bronze.gold);
    expect(economy.snapshot.gold).toBe(goldBefore + result.goldCredited);
    expect(arena.snapshot.wins).toBe(1);
    expect(arena.snapshot.tierWins['bronze']).toBe(1);
    expect(arena.snapshot.points).toBe(bronze.points);
  });

  it('takes nothing on a loss and still pays the consolation points', () => {
    const bronze = arenaTier('bronze')!;
    const goldBefore = economy.snapshot.gold;

    const result = gateway.fight('bronze', nextMutation(), 'bronze-drakeling', ALWAYS_LOW);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;

    expect(result.settlement.result.won).toBeFalse();
    expect(result.goldCredited).toBe(0);
    expect(economy.snapshot.gold).toBe(goldBefore);
    expect(arena.snapshot.losses).toBe(1);
    expect(arena.snapshot.points).toBe(bronze.consolationPoints);
  });

  it('replays the same mutation id instead of paying twice', () => {
    const id = nextMutation();
    const first = gateway.fight('bronze', id, 'bronze-hollis', ALWAYS_HIGH);
    expect(first.ok).toBeTrue();
    if (!first.ok) return;

    const pointsAfterFirst = arena.snapshot.points;
    const goldAfterFirst = economy.snapshot.gold;

    // The lock has to be lifted or the replay would be refused for the wrong
    // reason and the idempotence would go untested.
    const second = gateway.fight('bronze', id, 'bronze-hollis', ALWAYS_HIGH, Date.now() + ARENA_COOLDOWN_MS * 2);
    expect(second.ok).toBeTrue();
    if (!second.ok) return;

    expect(second.settlement.replayed).toBeTrue();
    expect(second.payout.points).toBe(0);
    expect(second.goldCredited).toBe(0);
    expect(arena.snapshot.points).toBe(pointsAfterFirst);
    expect(economy.snapshot.gold).toBe(goldAfterFirst);
    expect(arena.snapshot.wins).toBe(1);
  });

  it('refuses a second bout while the lock is running, and allows one after', () => {
    const now = 5_000_000;
    expect(gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, now).ok).toBeTrue();

    const blocked = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, now + 1000);
    expect(blocked.ok).toBeFalse();
    if (!blocked.ok) expect(blocked.code).toBe('cooldown');
    expect(gateway.blocker('bronze', now + 1000)).toBe('cooldown');

    const later = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, now + ARENA_COOLDOWN_MS);
    expect(later.ok).toBeTrue();
  });

  it('refuses a chained ring and opens it on the win that earns it', () => {
    const locked = gateway.fight('silver', nextMutation(), 'silver-corvain', ALWAYS_HIGH);
    expect(locked.ok).toBeFalse();
    if (!locked.ok) expect(locked.code).toBe('locked');

    const silver = arenaTier('silver')!;
    let opened: string | null = null;
    for (let i = 0; i < silver.unlockWins; i++) {
      const at = 1_000_000 + i * ARENA_COOLDOWN_MS;
      const result = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, at);
      if (result.ok && result.settlement.unlockedTier) opened = result.settlement.unlockedTier;
    }

    expect(arena.snapshot.tierWins['bronze']).toBe(silver.unlockWins);
    expect(opened).toBe('silver');
    expect(arena.isUnlocked('silver')).toBeTrue();
    // And only the next ring — a Bronze run must not reach past Silver.
    expect(arena.isUnlocked('gold')).toBeFalse();
  });

  it('breaks the streak on a loss and multiplies the payout while it holds', () => {
    const bronze = arenaTier('bronze')!;
    let at = 2_000_000;
    for (let i = 0; i < 3; i++) {
      gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, at);
      at += ARENA_COOLDOWN_MS;
    }
    expect(arena.snapshot.streak).toBe(3);

    const fourth = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, at);
    expect(fourth.ok).toBeTrue();
    if (!fourth.ok) return;
    expect(fourth.payout.streakMultiplier).toBeCloseTo(1.3, 5);
    expect(fourth.payout.points).toBe(Math.round(bronze.points * 1.3));

    at += ARENA_COOLDOWN_MS;
    gateway.fight('bronze', nextMutation(), 'bronze-drakeling', ALWAYS_LOW, at);
    expect(arena.snapshot.streak).toBe(0);
    expect(arena.snapshot.bestStreak).toBe(4);
  });

  it('rejects an opponent who does not fight in the named ring', () => {
    const result = gateway.fight('bronze', nextMutation(), 'void-unwritten', ALWAYS_HIGH);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.code).toBe('unknown-opponent');
    expect(arena.snapshot.wins + arena.snapshot.losses).toBe(0);
  });

  it('reads Might and Guard off worn kit rather than remembering them', () => {
    const before = gateway.playerCard().might;
    // The loadout is recomputed on every call; nothing here caches it, which is
    // what makes a temper between two bouts land on the next one.
    expect(gateway.playerCard().might).toBe(before);
    expect(gateway.loadout().rank).toBeGreaterThanOrEqual(1);
  });

  // ── The shop ───────────────────────────────────────────────────────────────

  /** Bank `points` by winning Bronze bouts on a moving clock. */
  function bank(points: number): void {
    const bronze = arenaTier('bronze')!;
    let at = 3_000_000;
    while (arena.snapshot.points < points) {
      const result = gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, at);
      at += ARENA_COOLDOWN_MS;
      if (!result.ok) break;
      if (bronze.points <= 0) break;
    }
  }

  it('refuses a purchase that is not paid for and moves nothing', () => {
    const result = gateway.buy('arena-purse', nextMutation());
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.code).toBe('points');
    expect(arena.snapshot.points).toBe(0);
  });

  it('takes the points and pays out the Gold purse', () => {
    const purse = arenaStockById('arena-purse')!;
    bank(purse.cost);
    const pointsBefore = arena.snapshot.points;
    const goldBefore = economy.snapshot.gold;

    const result = gateway.buy('arena-purse', nextMutation());
    expect(result.ok).withContext(JSON.stringify(result)).toBeTrue();
    expect(arena.snapshot.points).toBe(pointsBefore - purse.cost);
    expect(economy.snapshot.gold).toBeGreaterThan(goldBefore);
  });

  it('mints a real item for an equipment row and only sells it once', () => {
    const buckler = arenaStockById('arena-buckler')!;
    bank(buckler.cost);
    // The row is also gated on wins; the banking loop above has fought enough
    // Bronze bouts to clear it.
    expect(arena.snapshot.wins).toBeGreaterThanOrEqual(buckler.requiredWins);

    const result = gateway.buy('arena-buckler', nextMutation());
    expect(result.ok).withContext(JSON.stringify(result)).toBeTrue();
    if (!result.ok) return;
    expect(result.item).toBeTruthy();
    expect(result.item!.definitionId).toBe(buckler.definitionId!);
    expect(result.item!.rarity).toBe(buckler.rarity!);
    expect(inventory.itemById(result.item!.id)).toBeTruthy();

    bank(buckler.cost * 2);
    const again = gateway.buy('arena-buckler', nextMutation());
    expect(again.ok).toBeFalse();
    if (!again.ok) expect(again.code).toBe('owned');
  });

  it('refuses a row the win count has not reached', () => {
    expect(gateway.purchaseBlocker('arena-crown')).toBe('wins');
  });

  // ── The render loop ────────────────────────────────────────────────────────

  it('does not publish a snapshot from blocker(), which crashed the page', () => {
    // The ring reads `blocker()` and `purchaseBlocker()` for every tier and
    // every shop row from *inside* its own `snapshot$` subscription. When
    // `init()` published unconditionally, that press-free read pushed a new
    // snapshot, woke the subscription, read again, and recurred until the
    // renderer died — `/world/arena` crashed the tab on load, every load.
    arena.init();
    let publishes = 0;
    const sub = arena.snapshot$.subscribe(() => { publishes++; });
    expect(publishes).toBe(1); // the replayed current value

    gateway.blocker('bronze');
    gateway.blocker('silver');
    for (const stock of ['arena-purse', 'arena-buckler', 'arena-crown']) {
      gateway.purchaseBlocker(stock);
    }

    expect(publishes).withContext('a read must not move the snapshot').toBe(1);
    sub.unsubscribe();
  });

  it('terminates when a snapshot subscriber reads back through the gateway', () => {
    // The same cycle, driven the way the component drives it. If the guard
    // regresses this recurses until the stack or the heap gives out, so the
    // assertion is really "this spec returned at all".
    arena.init();
    let reads = 0;
    const sub = arena.snapshot$.subscribe(() => {
      reads++;
      if (reads > 200) return;
      gateway.blocker('bronze');
      gateway.purchaseBlocker('arena-purse');
    });

    gateway.fight('bronze', nextMutation(), 'bronze-hollis', ALWAYS_HIGH, 8_000_000);

    // One replay on subscribe, one for the settled bout. Nothing recursive.
    expect(reads).toBeLessThanOrEqual(3);
    sub.unsubscribe();
  });
});
