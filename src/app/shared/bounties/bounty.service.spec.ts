/**
 * bounty.service.spec.ts — the Board Herald's daily bounties through the save
 * gateway: the draw per player and day, tokens counted once, claims paid once
 * (receipt first), gifts once, days counted (never a streak), and a merged copy
 * from another device landing in memory.
 */
import { TestBed } from '@angular/core/testing';
import { BountyService } from './bounty.service';
import { BOUNTIES_KEY, BountyState, coerceBounties, mergeBounties } from './bounty-save.model';
import { COMPASS_ID, FRAGMENT_EVERY, FRAGMENT_ID, dayKey, drawBounties } from './bounty.model';
import { DelveSaveService } from '../delve/delve-save.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';

class FakeDelve {
  span: { seed: number; east: number; west: number } | null = { seed: 4242, east: 3, west: 0 };
  exploredSpan() { return this.span; }
}
class FakeEconomy {
  snapshot = { perSecond: 10 };
  earned: number[] = [];
  earnGold(n: number): number { this.earned.push(n); return n; }
}
class FakeInventory {
  grants = new Map<string, { id: string; qty: number }>();
  grantStack(grantId: string, id: string, qty: number): boolean { if (!this.grants.has(grantId)) this.grants.set(grantId, { id, qty }); return true; }
  held(id: string): number { return [...this.grants.values()].filter(g => g.id === id).reduce((s, g) => s + g.qty, 0); }
}

describe('BountyService (the Board Herald\'s daily bounties)', () => {
  let service: BountyService;
  let delve: FakeDelve;
  let economy: FakeEconomy;
  let inventory: FakeInventory;
  let now: Date;

  function boot(): BountyService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DelveSaveService, useValue: delve },
        { provide: EconomyService, useValue: economy },
        { provide: InventoryService, useValue: inventory },
      ],
    });
    const s = TestBed.inject(BountyService);
    s.now = () => now;
    return s;
  }
  /** What the gateway wrote (unwrapping its `{ v, updatedAt }` envelope when it uses one). */
  const saved = (): BountyState => {
    const parsed = JSON.parse(localStorage.getItem(BOUNTIES_KEY) ?? 'null');
    return coerceBounties(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };
  /** Finish every non-reach bounty on today's board with fresh tokens; return the board. */
  function finishAll(s: BountyService, tag: string) {
    const list = s.board();
    for (const b of list) {
      for (let n = 0; n < b.n; n++) {
        const token = `${tag}-${b.slot}-${n}`;
        if (b.kind === 'dig') s.observe({ kind: 'dig', node: b.target, row: [5, 15, 30, 45][b.stratum], token });
        if (b.kind === 'torch') s.observe({ kind: 'torch', row: [5, 15, 30, 45][b.stratum], token });
        if (b.kind === 'catch') s.observe({ kind: 'catch', liquid: b.target, col: 300, row: 30, token });
        if (b.kind === 'structure') s.observe({ kind: 'structure', structure: b.target, token });
      }
      if (b.kind === 'reach') delve.span = { ...delve.span!, east: Math.max(delve.span!.east, b.sx ?? 0), west: Math.min(delve.span!.west, b.sx ?? 0) };
    }
    return list;
  }

  beforeEach(() => {
    localStorage.removeItem(BOUNTIES_KEY);
    delve = new FakeDelve();
    economy = new FakeEconomy();
    inventory = new FakeInventory();
    now = new Date(2026, 9, 14, 10, 0, 0);
    service = boot();
  });
  afterEach(() => localStorage.removeItem(BOUNTIES_KEY));

  it('draws today\'s three once, from the player\'s seed and the day, and keeps them frozen', () => {
    const list = service.board();
    expect(list.length).toBe(3);
    expect(list.map(b => b.id)).toEqual(drawBounties({ seed: 4242, day: dayKey(now), deepest: 0, frontierEast: 3, frontierWest: 0 }).list.map(b => b.id));
    // The frontier moves: the board does not, until tomorrow.
    delve.span = { seed: 4242, east: 12, west: -5 };
    expect(service.board().map(b => b.id)).toEqual(list.map(b => b.id));
    expect(boot().board().map(b => b.id)).toEqual(list.map(b => b.id), 'a reload keeps the board');
    now = new Date(2026, 9, 15, 9, 0, 0);
    expect(service.board()[0].id.startsWith('2026-10-15')).toBeTrue();
  });

  it('counts days visited, never a streak: a missed day costs nothing', () => {
    service.board(); service.board();
    expect(saved().days).toBe(1);
    now = new Date(2026, 9, 20, 9, 0, 0); // five days away
    service.board();
    expect(saved().days).toBe(2);
    expect(saved().board!.day).toBe('2026-10-20');
  });

  it('counts a token once, and only for the bounties it fits', () => {
    service.reached(3);
    now = new Date(2026, 9, 16, 9, 0, 0);
    const list = finishAll(service, 'a');
    const dig = list.find(b => b.kind === 'dig');
    const before = JSON.stringify(saved().progress);
    if (dig) {
      // The same cell again, and a cell of another vein: nothing moves.
      service.observe({ kind: 'dig', node: dig.target, row: [5, 15, 30, 45][dig.stratum], token: 'a-1-0' });
      service.observe({ kind: 'dig', node: 'bedrock', row: 10, token: 'other' });
      expect(JSON.stringify(saved().progress)).toBe(before);
    }
    expect(service.refresh().every(v => v.ready)).toBeTrue();
  });

  it('pays a claim once: the receipt is written first, a second claim and a reload pay nothing', () => {
    const list = finishAll(service, 'b');
    const id = list[0].id;
    const paid = service.claim(id)!;
    expect(paid).not.toBeNull();
    expect(paid.gold).toBeGreaterThan(0);
    expect(economy.earned).toEqual([paid.gold]);
    expect(saved().claimed).toContain(id);
    expect(service.claim(id)).toBeNull();
    expect(boot().claim(id)).toBeNull();
    expect(economy.earned.length).toBe(1);
    // A device that had not seen the claim merges in the receipt and cannot pay it either.
    const stale = { ...saved(), claimed: [] };
    localStorage.setItem(BOUNTIES_KEY, JSON.stringify(mergeBounties(stale, saved())));
    expect(boot().claim(id)).toBeNull();
    expect(economy.earned.length).toBe(1);
  });

  it('a bounty not finished cannot be claimed', () => {
    const list = service.board();
    expect(service.claim(list[1].id)).toBeNull();
    expect(service.claim('2026-10-14:9:nope:x:1')).toBeNull();
    expect(economy.earned).toEqual([]);
  });

  it('hands over the compass with the first claim, and a fragment every seventh claim day', () => {
    let fragments = 0;
    for (let d = 0; d < 2 * FRAGMENT_EVERY; d++) {
      now = new Date(2026, 9, 1 + d, 10, 0, 0);
      const list = finishAll(service, `d${d}`);
      for (const b of list) {
        const paid = service.claim(b.id)!;
        expect(paid).withContext(b.id).not.toBeNull();
        fragments += paid.gifts.filter(g => g === FRAGMENT_ID).length;
      }
    }
    expect(inventory.held(COMPASS_ID)).toBe(1);
    expect(fragments).toBe(2);
    expect(inventory.held(FRAGMENT_ID)).toBe(2);
    expect(saved().claimDays).toBe(2 * FRAGMENT_EVERY);
    expect(saved().total).toBe(6 * FRAGMENT_EVERY);
  });

  it('only names strata reached, and the deepest stratum only grows', () => {
    for (let d = 1; d <= 20; d++) {
      now = new Date(2026, 10, d, 9, 0, 0);
      for (const b of service.board()) expect(b.stratum).withContext(b.id).toBe(0);
    }
    service.reached(2); service.reached(1);
    expect(saved().deepest).toBe(2);
  });

  it('a merged copy from another device lands in memory (LocalSaveRegistry rehydrate)', () => {
    const list = service.board();
    const theirs = { ...saved(), progress: { [list[1].id]: ['x1', 'x2'] }, total: 9 };
    localStorage.setItem(BOUNTIES_KEY, JSON.stringify(mergeBounties(theirs, saved())));
    TestBed.inject(LocalSaveRegistry).rehydrate(BOUNTIES_KEY);
    expect(service.state.total).toBe(9);
    expect(service.state.progress[list[1].id]).toEqual(['x1', 'x2']);
  });

  it('is synced with its own merge', () => {
    const entry = SYNCED_BLOBS.find(b => b.key === BOUNTIES_KEY);
    expect(entry?.doc).toBe('bounties');
    expect(entry?.merge).toBe(mergeBounties);
  });
});
