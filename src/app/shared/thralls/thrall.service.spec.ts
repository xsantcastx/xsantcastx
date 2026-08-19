/**
 * thrall.service.spec.ts — the shift, driven by hand.
 *
 * `pull()` takes an explicit `now` and an explicit rng precisely so this file
 * exists: a feature whose whole behaviour is a timer against a wall clock is
 * otherwise only testable by waiting, and a spec that waits five seconds to
 * check one Legendary interval is a spec nobody runs.
 *
 * The cases below are the ones where a regression is *silent*: a pull that
 * happens without paying, a Thrall that never tires, a released worker whose
 * gear can never be recovered, a blob from another device that pays out a week
 * of rest in one frame.
 */
import { TestBed } from '@angular/core/testing';

import { EconomyService } from '../economy/economy.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { XpService } from '../gamification/xp.service';
import { InventoryService } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { STRIKE_COST } from '../rune-forge/rune.model';
import type { GameItem } from '../rpg/item.model';
import { ThrallService } from './thrall.service';
import {
  MAX_THRALLS,
  MINUTE_MS,
  THRALL_KEY,
  THRALL_ROLL_COST,
  thrallTier,
} from './thrall.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** Repeats the last value, so every downstream draw is a quiet miss. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function charm(id: string, stats: GameItem['stats']): GameItem {
  return {
    id, name: `Charm ${id}`, type: 'charm', rarity: 'rare', stats,
    sellValue: 10, equipped: false, foundAt: '2026-08-01T00:00:00.000Z', soulbound: false,
  };
}

describe('ThrallService', () => {
  let thralls: ThrallService;
  let economy: EconomyService;
  let inventory: InventoryService;
  let gateway: MemoryGateway;

  beforeEach(() => {
    gateway = new MemoryGateway();
    gateway.writeRaw('godforge-realm-era', '55');
    TestBed.configureTestingModule({
      providers: [
        ThrallService,
        RuneForgeService,
        InventoryService,
        EconomyService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: gateway },
        { provide: XpService, useValue: { award: () => undefined } },
        { provide: EasterEggService, useValue: { isFound: () => true, trigger: () => Promise.resolve() } },
      ],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
    inventory = TestBed.inject(InventoryService);
    thralls = TestBed.inject(ThrallService);
    thralls.init();
  });

  function fund(amount: number): void {
    economy.earnGold(amount, 'test');
  }

  /** Bind one Thrall of a tier and hand back its record. */
  function bind(rarity: Parameters<ThrallService['recruit']>[0]) {
    fund(thrallTier(rarity).price);
    expect(thralls.recruit(rarity, sequence(0.5))).toBe('ok');
    return thralls.thralls[thralls.thralls.length - 1];
  }

  // ── Recruiting ─────────────────────────────────────────────────────────────

  describe('recruiting', () => {
    it('takes the tier price and mints one worker', () => {
      fund(50_000);
      const before = economy.snapshot.gold;
      expect(thralls.recruit('common', sequence(0.5))).toBe('ok');
      expect(economy.snapshot.gold).toBe(before - 50_000);
      expect(thralls.count).toBe(1);
    });

    it('refuses without the Gold, and mints nothing', () => {
      expect(thralls.recruit('legendary')).toBe('insufficient-funds');
      expect(thralls.count).toBe(0);
    });

    it('never leaves a free worker when the spend is refused', () => {
      // One Gold short of the price is the case that would silently pass if the
      // mint happened before the debit.
      fund(thrallTier('rare').price - 1);
      expect(thralls.recruit('rare')).toBe('insufficient-funds');
      expect(thralls.count).toBe(0);
    });

    it('starts working while there is room, and idle once the slots are full', () => {
      const first = bind('common');
      expect(thralls.byId(first.id)!.status).toBe('working');

      // Five slots is the base ceiling; the sixth arrives idle rather than
      // displacing anybody or silently doing nothing.
      for (let i = 0; i < 4; i++) bind('common');
      expect(thralls.working).toBe(5);

      const sixth = bind('common');
      expect(thralls.byId(sixth.id)!.status).toBe('idle');
      expect(thralls.working).toBe(5);
    });

    it('stops at the roster ceiling', () => {
      for (let i = 0; i < MAX_THRALLS; i++) bind('common');
      fund(thrallTier('common').price);
      const before = economy.snapshot.gold;
      expect(thralls.recruit('common')).toBe('roster-full');
      // Refused before the debit, so a full roster is not also a Gold sink.
      expect(economy.snapshot.gold).toBe(before);
    });
  });

  // ── Pulling ────────────────────────────────────────────────────────────────

  describe('pulling', () => {
    it('pays a hundred strikes and banks the rune in the shared ledger', () => {
      const forge = TestBed.inject(RuneForgeService);
      const t = bind('common');
      fund(THRALL_ROLL_COST * 2);
      const gold = economy.snapshot.gold;
      const runes = forge.snapshot.strikes;

      expect(thralls.pull(t.id, 1_000, sequence(0.5))).toBe(true);
      expect(economy.snapshot.gold).toBe(gold - THRALL_ROLL_COST);
      expect(THRALL_ROLL_COST).toBe(STRIKE_COST * 100);

      // The rune landed in the forge's own ledger — the Runewords can see it.
      const held = Object.values(forge.snapshot.held).reduce((a, b) => a + b, 0);
      expect(held).toBeGreaterThan(0);
      // `grant` is not a strike: the lifetime strike counter must not move.
      expect(forge.snapshot.strikes).toBe(runes);
    });

    it('does nothing at all when the Keeper is broke', () => {
      const t = bind('common');
      const before = thralls.byId(t.id)!;
      expect(thralls.pull(t.id, 1_000, sequence(0.5))).toBe(false);
      const after = thralls.byId(t.id)!;
      // Not even the roll clock moves: stamping it would make a player who has
      // just topped up wait a full interval for a pull that never happened.
      expect(after.lastRollAt).toBe(before.lastRollAt);
      expect(after.stamina).toBe(before.stamina);
      expect(after.totalRolls).toBe(0);
    });

    it('spends stamina and counts the find against the tier', () => {
      const t = bind('common');
      fund(THRALL_ROLL_COST);
      thralls.pull(t.id, 1_000, sequence(0.5));
      const after = thralls.byId(t.id)!;
      expect(after.stamina).toBeLessThan(after.maxStamina);
      expect(after.totalRolls).toBe(1);
      expect(Object.values(after.totalFinds).reduce((a, b) => a + b, 0)).toBe(1);
    });

    it('lies down rather than pulling on an empty tank, and pays nothing', () => {
      const t = bind('common');
      fund(THRALL_ROLL_COST * 3);
      // Drain the tank without touching the anvil.
      (thralls as unknown as { blob: { thralls: { id: string; stamina: number }[] } })
        .blob.thralls.find(x => x.id === t.id)!.stamina = 0;

      const gold = economy.snapshot.gold;
      expect(thralls.pull(t.id, 5_000, sequence(0.5))).toBe(true);
      expect(thralls.byId(t.id)!.status).toBe('resting');
      expect(economy.snapshot.gold).toBe(gold);
    });

    it('leaves an idle Thrall alone', () => {
      const t = bind('common');
      thralls.setWorking(t.id, false);
      fund(THRALL_ROLL_COST);
      const gold = economy.snapshot.gold;
      expect(thralls.pull(t.id, 1_000, sequence(0.5))).toBe(false);
      expect(economy.snapshot.gold).toBe(gold);
    });

    it('records one log line per find, newest first', () => {
      const t = bind('common');
      fund(THRALL_ROLL_COST * 2);
      thralls.pull(t.id, 1_000, sequence(0.5));
      thralls.pull(t.id, 2_000, sequence(0.5));
      const log = thralls.snapshot.log;
      expect(log.length).toBe(2);
      expect(log[0].at).toBe(2_000);
      expect(log[0].thrallName).toBe(t.name);
      expect(log[0].text).toContain(t.name);
    });
  });

  // ── Assignment ─────────────────────────────────────────────────────────────

  describe('assignment', () => {
    it('refuses to seat a sixth worker on five slots', () => {
      const spare = bind('common');
      thralls.setWorking(spare.id, false);
      for (let i = 0; i < 5; i++) bind('common');
      expect(thralls.working).toBe(5);
      expect(thralls.setWorking(spare.id, true)).toBe(false);
      expect(thralls.byId(spare.id)!.status).toBe('idle');
    });

    it('sends a tired Thrall to rest rather than to the anvil', () => {
      const t = bind('common');
      thralls.setWorking(t.id, false);
      (thralls as unknown as { blob: { thralls: { id: string; stamina: number }[] } })
        .blob.thralls.find(x => x.id === t.id)!.stamina = 0;
      expect(thralls.setWorking(t.id, true)).toBe(true);
      expect(thralls.byId(t.id)!.status).toBe('resting');
    });
  });

  // ── Equipment ──────────────────────────────────────────────────────────────

  describe('equipment', () => {
    it('reads a worn charm as live Magic Find on the Thrall own roll', () => {
      const t = bind('rare');
      const held = inventory.add(charm('c1', { magicFind: 30 }))!;
      expect(thralls.equip(t.id, held.id)).toBe(true);
      // Nothing on the Keeper, so the whole number is the charm at face value.
      expect(thralls.magicFindOf(t.id)).toBe(30);
      expect(thralls.byId(t.id)!.equipment.charm).toBe(held.id);
    });

    it('puts a charm in the charm well and everything else in the weapon well', () => {
      const t = bind('rare');
      const c = inventory.add(charm('c2', { magicFind: 5 }))!;
      const w = inventory.add({
        ...charm('w1', { ward: 3 }), type: 'rune', name: 'Ash Sigil',
      })!;
      expect(thralls.equip(t.id, c.id)).toBe(true);
      expect(thralls.equip(t.id, w.id)).toBe(true);
      const worn = thralls.byId(t.id)!.equipment;
      expect(worn.charm).toBe(c.id);
      expect(worn.weapon).toBe(w.id);
      expect(thralls.wornItems(t.id).length).toBe(2);
    });

    it('swaps within a well rather than spending the other one', () => {
      const t = bind('rare');
      const first = inventory.add(charm('c3', { magicFind: 5 }))!;
      const second = inventory.add(charm('c4', { magicFind: 50 }))!;
      expect(thralls.equip(t.id, first.id)).toBe(true);
      expect(thralls.equip(t.id, second.id)).toBe(true);
      expect(thralls.byId(t.id)!.equipment.charm).toBe(second.id);
      expect(thralls.byId(t.id)!.equipment.weapon).toBeUndefined();
      // The displaced charm is back in the bag, not stranded.
      expect(inventory.itemById(first.id)!.explorerId).toBeFalsy();
    });

    it('takes an item back to the bag', () => {
      const t = bind('common');
      const c = inventory.add(charm('c5', { magicFind: 12 }))!;
      thralls.equip(t.id, c.id);
      expect(thralls.unequip(t.id, c.id)).toBe(true);
      expect(thralls.byId(t.id)!.equipment.charm).toBeUndefined();
      expect(inventory.itemById(c.id)!.explorerId).toBeFalsy();
    });

    it('returns the kit when a Thrall is released', () => {
      // The failure this guards: an item whose owner id no longer resolves is
      // filtered out of the bag by "not equipped and not on a worker" and can
      // never be recovered by any UI.
      const t = bind('common');
      const c = inventory.add(charm('c6', { magicFind: 9 }))!;
      thralls.equip(t.id, c.id);
      expect(thralls.release(t.id)).toBe(true);
      expect(thralls.byId(t.id)).toBeUndefined();
      expect(inventory.itemById(c.id)!.explorerId).toBeFalsy();
      expect(inventory.snapshot.bag.some(i => i.id === c.id)).toBe(true);
    });

    it('will not take an item the Keeper is wearing', () => {
      const t = bind('common');
      const c = inventory.add(charm('c7', { magicFind: 4 }))!;
      inventory.equip(c.id, 'charm1');
      expect(thralls.equip(t.id, c.id)).toBe(false);
    });
  });

  // ── Slots ──────────────────────────────────────────────────────────────────

  describe('the slot ladder', () => {
    it('starts at five and grows with the Market upgrade', () => {
      expect(thralls.slots).toBe(5);
      fund(50_000_000);
      expect(economy.buyUpgrade('thrall-slot')).toBe(true);
      expect(thralls.slots).toBe(6);
    });
  });

  // ── Rest ───────────────────────────────────────────────────────────────────

  describe('rest', () => {
    /**
     * A real wall-clock base, not zero.
     *
     * `settleRest` treats a falsy `lastRestAt` as "no clock yet" and credits
     * nothing, which is the right reading for a corrupt blob — a zero there
     * would otherwise pay out fifty-seven years of rest on the first beat.
     * `mintThrall` and the loader both stamp it, so zero never occurs in the
     * app, and a spec that used it would be testing the guard rather than the
     * cycle.
     */
    const T0 = 1_800_000_000_000;

    /** Reach into the blob to place a Thrall at a known point in its cycle. */
    const place = (id: string, fields: Record<string, unknown>) => {
      const blob = (thralls as unknown as { blob: { thralls: Record<string, unknown>[] } }).blob;
      Object.assign(blob.thralls.find(t => t['id'] === id)!, fields);
    };
    const settle = (now: number) =>
      (thralls as unknown as { settleRest(now: number): boolean }).settleRest(now);
    const blobOf = () =>
      (thralls as unknown as { blob: { foundToday: number; rolls: number; dayKey: string } }).blob;

    it('credits a point a minute and carries the remainder', () => {
      const t = bind('common');
      place(t.id, { stamina: 10, status: 'resting', lastRestAt: T0 });

      // 90 seconds is one whole minute plus 30s that must not be discarded —
      // discarding it is how a one-second heartbeat recovers nothing, ever.
      settle(T0 + 90_000);
      expect(thralls.byId(t.id)!.stamina).toBe(11);
      expect(thralls.byId(t.id)!.lastRestAt).toBe(T0 + MINUTE_MS);

      // The carried 30s plus another 30 buys the second point.
      settle(T0 + 120_000);
      expect(thralls.byId(t.id)!.stamina).toBe(12);
    });

    it('sends a rested Thrall back to the anvil at a fifth of its pool', () => {
      const t = bind('common');
      // A 100-stamina pool, so the resume threshold is 20.
      place(t.id, { stamina: 18, status: 'resting', lastRestAt: T0 });

      settle(T0 + 60_000);
      expect(thralls.byId(t.id)!.stamina).toBe(19);
      expect(thralls.byId(t.id)!.status).toBe('resting');

      settle(T0 + 180_000);
      expect(thralls.byId(t.id)!.stamina).toBeGreaterThanOrEqual(20);
      expect(thralls.byId(t.id)!.status).toBe('working');
    });

    it('never recovers past the pool', () => {
      const t = bind('common');
      place(t.id, { stamina: 99, status: 'working', lastRestAt: T0 });
      settle(T0 + 500 * MINUTE_MS);
      expect(thralls.byId(t.id)!.stamina).toBe(100);
    });

    it('leaves an idle Thrall out of the rest cycle entirely', () => {
      const t = bind('common');
      thralls.setWorking(t.id, false);
      place(t.id, { stamina: 5, lastRestAt: T0 });
      settle(T0 + 600_000);
      expect(thralls.byId(t.id)!.stamina).toBe(5);
      expect(thralls.byId(t.id)!.status).toBe('idle');
    });

    it('rolls the day over and resets only the daily count', () => {
      const t = bind('common');
      fund(THRALL_ROLL_COST);
      thralls.pull(t.id, T0, sequence(0.5));
      expect(blobOf().foundToday).toBe(1);

      // Three days on. `settleRest` owns the rollover, and it must not take the
      // lifetime tally down with the daily one.
      settle(Date.now() + 3 * 24 * 60 * 60 * 1_000);
      expect(blobOf().foundToday).toBe(0);
      expect(blobOf().rolls).toBe(1);
    });
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('restarts the rest clock on load rather than trusting a foreign one', () => {
      // A blob restored from the cloud carries another device's `lastRestAt`.
      // Trusting it either pays out a week of stamina in one beat or, if the
      // clock is ahead, never pays out at all.
      const t = bind('common');
      const stale = {
        version: 1,
        thralls: [{ ...t, stamina: 1, status: 'resting', lastRestAt: 0 }],
        log: [], goldSpent: 0, rolls: 0, finds: {}, dayKey: '', foundToday: 0,
      };
      gateway.write(THRALL_KEY, stale);

      const registry = TestBed.inject(LocalSaveRegistry);
      registry.rehydrate(THRALL_KEY);

      const loaded = thralls.byId(t.id)!;
      expect(loaded.lastRestAt).toBeGreaterThan(MINUTE_MS);
      expect(loaded.stamina).toBe(1);
    });

    it('repairs a blob whose derived fields disagree with the tier table', () => {
      const t = bind('common');
      gateway.write(THRALL_KEY, {
        version: 1,
        // A stored copy written before a retune: wrong pool, wrong interval,
        // stamina above the pool, and a status nothing recognises.
        thralls: [{ ...t, level: 3, maxStamina: 9_999, stamina: 9_999, rollInterval: 1, status: 'sprinting' }],
        log: [], goldSpent: 0, rolls: 0, finds: {}, dayKey: '', foundToday: 0,
      });
      TestBed.inject(LocalSaveRegistry).rehydrate(THRALL_KEY);

      const loaded = thralls.byId(t.id)!;
      expect(loaded.maxStamina).toBe(thrallTier('common').baseStamina + 2 * 5);
      expect(loaded.stamina).toBe(loaded.maxStamina);
      expect(loaded.rollInterval).toBe(thrallTier('common').rollInterval);
      expect(loaded.status).toBe('idle');
    });

    it('survives a corrupt blob without losing the tab', () => {
      gateway.writeRaw(THRALL_KEY, '{not json');
      TestBed.inject(LocalSaveRegistry).rehydrate(THRALL_KEY);
      expect(thralls.count).toBe(0);
      expect(thralls.snapshot.thralls).toEqual([]);
    });
  });
});

/**
 * The visibility gate, which is the one behaviour that cannot be seen in a
 * headless preview: an automation pane runs its page as a hidden tab, so
 * "did it pause?" and "was it never started?" look identical from outside.
 *
 * Browsers do still fire a throttled `setInterval` in a hidden tab — roughly
 * once a minute — so a shift started against a page nobody is looking at is a
 * real way to come back to an emptied ledger, not a theoretical one.
 */
describe('ThrallService — the visibility gate', () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    // Put the real accessor back, or every spec after this one in the run
    // inherits a document that lies about being on screen.
    delete (document as unknown as Record<string, unknown>)['visibilityState'];
  });

  function build(): ThrallService {
    const gateway = new MemoryGateway();
    gateway.writeRaw('godforge-realm-era', '55');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThrallService, RuneForgeService, InventoryService, EconomyService, LocalSaveRegistry,
        { provide: GameStateGateway, useValue: gateway },
        { provide: XpService, useValue: { award: () => undefined } },
        { provide: EasterEggService, useValue: { isFound: () => true, trigger: () => Promise.resolve() } },
      ],
    });
    TestBed.inject(EconomyService).init();
    return TestBed.inject(ThrallService);
  }

  const timerOf = (s: ThrallService) =>
    (s as unknown as { timer: unknown }).timer;

  it('does not start the shift in a tab that is already hidden', () => {
    visibility = 'hidden';
    const thralls = build();
    thralls.init();
    expect(timerOf(thralls)).toBeNull();
  });

  it('starts it when the tab is in front', () => {
    const thralls = build();
    thralls.init();
    expect(timerOf(thralls)).not.toBeNull();
  });

  it('stops on hide and resumes on show', () => {
    const thralls = build();
    thralls.init();

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(timerOf(thralls)).toBeNull();

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(timerOf(thralls)).not.toBeNull();

    // Leave nothing running behind this spec.
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
});
