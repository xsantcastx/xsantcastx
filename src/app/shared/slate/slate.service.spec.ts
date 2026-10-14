/**
 * slate.service.spec.ts — the Mirror Slate changing hands through the real play
 * ledger and economy: Lune's gift once at ten plays (wherever they were
 * played), the shortcut purchase spent once, Kael's binding in one write, and a
 * play from the Slate sharing the stall's idempotency (same service, same id,
 * one debit, one count toward the gift).
 */
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { MIRROR_SLATE } from '../economy/economy-curve';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { GAMES_KEY } from '../games/play-ledger';
import { PlayLedgerService } from '../games/play-ledger.service';
import { ReelsService } from '../reels/reels.service';
import { MIRROR_SLATE_ID, MIRROR_SLATE_II_ID, SLATE_UPGRADE_INPUTS } from './slate-items.model';
import { SLATE_AWARD_ID, SLATE_UPGRADE_ID, SlateService } from './slate.service';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  read(key: string): unknown { const raw = this.bag.get(key); return raw ? JSON.parse(raw) : null; }
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** The inventory's stack-op semantics: an op id lands once; a stack is the sum of its ops. */
class FakeInventory {
  readonly ops = new Map<string, { key: string; qty: number }>();
  readonly snapshot$ = new Subject<void>();
  init(): void { /* nothing to load */ }
  stackOf(key: string): number { let n = 0; for (const op of this.ops.values()) if (op.key === key) n += op.qty; return n; }
  hasStackOp(id: string): boolean { return this.ops.has(id); }
  grantStack(id: string, key: string, qty: number): boolean { if (!this.ops.has(id)) this.ops.set(id, { key, qty }); return true; }
  consumeStacks(id: string, inputs: readonly { id: string; count: number }[]): { ok: true; replayed: boolean } {
    inputs.forEach(i => this.ops.set(`${id}:in:${i.id}`, { key: i.id, qty: -i.count }));
    return { ok: true, replayed: false };
  }
  stackCraftedFor(id: string): boolean { return this.ops.has(`${id}:out`); }
  craftStack(id: string, inputs: readonly { id: string; count: number }[], key: string, qty: number):
    { ok: true; replayed: boolean } | { ok: false; code: 'missing' } {
    if (this.stackCraftedFor(id)) return { ok: true, replayed: true };
    if (inputs.some(i => this.stackOf(i.id) < i.count)) return { ok: false, code: 'missing' };
    inputs.forEach(i => this.ops.set(`${id}:in:${i.id}`, { key: i.id, qty: -i.count }));
    this.ops.set(`${id}:out`, { key, qty });
    return { ok: true, replayed: false };
  }
}

describe('SlateService (the Mirror Slate)', () => {
  let memory: MemoryGateway;
  let inventory: FakeInventory;

  function setup(gold: number, plays: Record<string, number> = {}): { slate: SlateService; reels: ReelsService; economy: EconomyService; ledger: PlayLedgerService } {
    memory.writeRaw(ECONOMY_KEY, JSON.stringify({ gold }));
    const totals = Object.fromEntries(Object.entries(plays).map(([g, n]) => [g, { plays: n, wagered: n * 10, paid: 0 }]));
    memory.write(GAMES_KEY, { version: 1, secret: 'slate', nonce: 0, plays: {}, totals });
    TestBed.configureTestingModule({
      providers: [
        SlateService, ReelsService, PlayLedgerService, EconomyService, LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
        { provide: InventoryService, useValue: inventory },
        { provide: RuneForgeService, useValue: { init: () => undefined, grant: () => null } },
      ],
    });
    const economy = TestBed.inject(EconomyService);
    economy.init();
    const ledger = TestBed.inject(PlayLedgerService);
    const reels = TestBed.inject(ReelsService);
    reels.init();
    const slate = TestBed.inject(SlateService);
    slate.init();
    return { slate, reels, economy, ledger };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    memory = new MemoryGateway();
    inventory = new FakeInventory();
  });

  it('is handed over by Lune on the tenth play across her tables, once', () => {
    const { slate, reels } = setup(1_000, { 'rune-drop': 5, 'seam-sweeper': 3, 'eclipse-ascent': 1 });
    expect(slate.tier()).toBe(0);
    expect(slate.offer().toGo).toBe(1);
    let told = 0;
    slate.awarded$.subscribe(() => told++);
    expect(reels.spin('tenth', 10).ok).toBeTrue();
    expect(slate.tier()).toBe(1);
    expect(inventory.stackOf(MIRROR_SLATE_ID)).toBe(1);
    expect(told).toBe(1);
    // More plays, a replayed play, a second check: no second Slate.
    reels.spin('tenth', 10);
    reels.spin('eleventh', 10);
    expect(slate.checkAward()).toBeFalse();
    expect(inventory.stackOf(MIRROR_SLATE_ID)).toBe(1);
    expect(told).toBe(1);
  });

  it('never gives the gift twice, even to a Keeper who let the pane go', () => {
    const { slate } = setup(1_000, { reels: 12 });
    expect(slate.tier()).toBe(1);
    expect(inventory.hasStackOp(SLATE_AWARD_ID)).toBeTrue();
    inventory.ops.set('drop', { key: MIRROR_SLATE_ID, qty: -1 });
    expect(slate.tier()).toBe(0);
    expect(slate.checkAward()).toBeFalse();
    expect(slate.tier()).toBe(0);
  });

  it('counts a play from the Slate and the same play at the stall once: one debit, one step toward the gift', () => {
    const { slate, reels, economy, ledger } = setup(1_000, { reels: 8 });
    // The Slate embeds the stall's own component, which plays through the same service and ledger.
    const atStall = reels.spin('press-1', 10);
    const onSlate = reels.spin('press-1', 10);
    expect(atStall.ok && onSlate.ok).toBeTrue();
    if (!atStall.ok || !onSlate.ok) return;
    expect(onSlate.replay).toBeTrue();
    expect(ledger.totals('reels').plays).toBe(9);
    expect(economy.snapshot.gold).toBe(1_000 - 10 + atStall.record.win);
    expect(slate.tier()).toBe(0);
    expect(slate.played()).toBe(9);
  });

  it('sells the Slate once for its price; a retried press is a replay, a second press is refused', () => {
    const poor = setup(MIRROR_SLATE.price - 1);
    expect(poor.slate.buy('a')).toBe('funds');
    expect(poor.slate.tier()).toBe(0);

    TestBed.resetTestingModule();
    memory = new MemoryGateway();
    inventory = new FakeInventory();
    const { slate, economy } = setup(MIRROR_SLATE.price + 100);
    expect(slate.buy('b')).toBe('ok');
    expect(slate.tier()).toBe(1);
    expect(economy.snapshot.gold).toBe(100);
    expect(slate.buy('b')).toBe('replayed');
    expect(slate.buy('c')).toBe('owned');
    expect(economy.snapshot.gold).toBe(100);
    expect(inventory.stackOf(MIRROR_SLATE_ID)).toBe(1);
  });

  it('lets Kael bind tier II from a tier I pane and the Delve materials, in one write, once', () => {
    const { slate } = setup(0);
    expect(slate.upgrade()).toBe('no-slate');
    inventory.grantStack('t:slate', MIRROR_SLATE_ID, 1);
    expect(slate.upgrade()).toBe('missing');
    expect(slate.tier()).toBe(1);
    for (const input of SLATE_UPGRADE_INPUTS.slice(1)) inventory.grantStack(`t:${input.id}`, input.id, input.count + 1);
    expect(slate.upgrade()).toBe('ok');
    expect(slate.tier()).toBe(2);
    expect(inventory.stackOf(MIRROR_SLATE_ID)).toBe(0);
    expect(inventory.stackOf(MIRROR_SLATE_II_ID)).toBe(1);
    for (const input of SLATE_UPGRADE_INPUTS.slice(1)) expect(inventory.stackOf(input.id)).withContext(input.id).toBe(1);
    expect(slate.upgrade()).toBe('replayed');
    expect(inventory.stackCraftedFor(SLATE_UPGRADE_ID)).toBeTrue();
    expect(inventory.stackOf(MIRROR_SLATE_II_ID)).toBe(1);
  });
});
