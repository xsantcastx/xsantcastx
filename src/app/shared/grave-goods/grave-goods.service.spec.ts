/**
 * The two services over their ledgers: SpellstoneService (Soul from kills, inscribing, a cast spending a charge, per
 * character) and GraveGoodsService (Sexton Wren's cleanse, the Archivist's silence, whispers counting kills worn).
 * The inventory and the economy are fakes that keep the real contracts (stacks, setGrave, spendGold).
 */
import { TestBed } from '@angular/core/testing';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { ACTIVE_CHARACTER_KEY } from '../save/character-scope';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { SpellstoneService } from '../spellstones/spellstone.service';
import { BLANK_ID, SPELLSTONES_KEY, blankPrice } from '../spellstones/spellstones.model';
import { GraveGoodsService } from './grave-goods.service';
import { WHISPER_STAGES, cleansePrice, curseFor, graveStats, silencePrice } from './grave-goods.model';

class FakeEconomy {
  snapshot = { gold: 0 };
  rewardLevel = 1;
  spendGold(n: number): boolean { if (n <= 0 || this.snapshot.gold < n) return false; this.snapshot.gold -= n; return true; }
}
class FakeInventory {
  stacks: Record<string, number> = {};
  ops = new Set<string>();
  items: GameItem[] = [];
  get snapshot() { return { items: this.items, bag: this.items.filter(i => !i.equipped && !i.explorerId) }; }
  init(): void { /* the real one hydrates */ }
  canPickUp(): boolean { return true; }
  add(item: GameItem): GameItem { this.items.push(item); return item; }
  addMigrated(items: GameItem[]): boolean { for (const i of items) if (!this.itemById(i.id)) this.items.push(i); return true; }
  spendCharge(id: string): boolean {
    const i = this.items.findIndex(x => x.id === id);
    if (i < 0 || !(this.items[i].charges! > 0)) return false;
    if (this.items[i].charges === 1) this.items.splice(i, 1); else this.items[i] = { ...this.items[i], charges: this.items[i].charges! - 1 };
    return true;
  }
  charges(recipe: string): number { return this.items.filter(i => i.definitionId === `spellstone:${recipe}`).reduce((n, i) => n + (i.charges ?? 0), 0); }
  stackOf(id: string): number { return this.stacks[id] ?? 0; }
  hasStackOp(id: string): boolean { return this.ops.has(id); }
  grantStack(id: string, key: string, n: number): boolean { this.ops.add(id); this.stacks[key] = (this.stacks[key] ?? 0) + n; return true; }
  consumeStacks(id: string, inputs: { id: string; count: number }[]): { ok: boolean } {
    if (inputs.some(i => this.stackOf(i.id) < i.count)) return { ok: false };
    for (const i of inputs) this.stacks[i.id] -= i.count;
    this.ops.add(id);
    return { ok: true };
  }
  itemById(id: string): GameItem | undefined { return this.items.find(i => i.id === id); }
  setGrave(id: string, patch: { curse?: GameItem['curse'] | null; whisper?: GameItem['whisper'] | null }) {
    const i = this.items.findIndex(x => x.id === id);
    if (i < 0) return { ok: false as const, code: 'missing' as const };
    const next = { ...this.items[i] };
    if (patch.curse !== undefined) { if (patch.curse) next.curse = patch.curse; else delete next.curse; }
    if (patch.whisper !== undefined) { if (patch.whisper) next.whisper = patch.whisper; else delete next.whisper; }
    this.items[i] = next;
    return { ok: true as const, item: next };
  }
}
const piece = (id: string, extra: Partial<GameItem>): GameItem => ({
  id, name: `Piece ${id}`, type: 'artifact', rarity: 'rare', stats: {}, sellValue: 10, equipped: false, foundAt: '2026-10-21T00:00:00.000Z', soulbound: false, ...extra,
});

describe('SpellstoneService and GraveGoodsService', () => {
  let economy: FakeEconomy, inventory: FakeInventory;
  function boot(character?: string) {
    if (character) localStorage.setItem(ACTIVE_CHARACTER_KEY, character); else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: economy }, { provide: InventoryService, useValue: inventory }] });
    return { stones: TestBed.inject(SpellstoneService), grave: TestBed.inject(GraveGoodsService) };
  }
  beforeEach(() => { localStorage.clear(); economy = new FakeEconomy(); inventory = new FakeInventory(); });
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

  it('Soul: kills near the level add one, up to the cap; far-below kills add nothing', () => {
    const { stones } = boot();
    expect(stones.kill(10, 10)).toBe(1);
    expect(stones.kill(30, 10)).toBe(0);
    for (let i = 0; i < 200; i++) stones.kill(10, 12);
    expect(stones.state.soul).toBe(100);
    expect(stones.kill(10, 12)).toBe(0);
    expect(stones.kill(10, 12, 10)).toBe(0);
  });

  it('inscribing takes a blank from the satchel and the Soul, and the stone keeps the rank', () => {
    const { stones } = boot();
    stones.setSoulForTest(20);
    expect(stones.inscribe('hellfire-nova', 4, 25)).toBe('blank');
    inventory.grantStack('g1', BLANK_ID, 2);
    expect(stones.inscribe('hellfire-nova', 0, 25)).toBe('rank');
    expect(stones.inscribe('hellfire-nova', 4, 25)).toBe('ok');
    expect(inventory.stackOf(BLANK_ID)).toBe(1);
    expect(stones.state.soul).toBe(15);
    // A satchel stone (the grid release): spell, rank and marks in its recipe, its charges on the item.
    expect(stones.state.pouch).toEqual({});
    expect(inventory.charges('hellfire-nova@4#0')).toBe(4);
    expect(stones.state.slot).toBe('hellfire-nova@4#0');
    stones.setSoulForTest(2);
    expect(stones.inscribe('hellfire-nova', 4, 25)).toBe('soul');
    expect(inventory.stackOf(BLANK_ID)).toBe(1);
  });

  it('a cast hands the engine the stone\'s spell and rank; only a cast that went off spends a charge; one stone a second', () => {
    const { stones } = boot();
    stones.setSoulForTest(20); inventory.grantStack('g1', BLANK_ID, 1);
    stones.inscribe('dark-ward', 9, 20);
    const casts: string[] = [];
    expect(stones.use('dark-ward@9#0', 10, () => 'nofoe')).toBe('nofoe');
    expect(inventory.charges('dark-ward@9#0')).toBe(5);
    expect(stones.use('dark-ward@9#0', 10, (s, r, m) => { casts.push(`${s}@${r}#${m}`); return null; })).toBe('ok');
    expect(casts).toEqual(['dark-ward@9#0']);
    expect(inventory.charges('dark-ward@9#0')).toBe(4);
    expect(stones.use('dark-ward@9#0', 10.5, () => null)).toBe('cooldown');
    expect(stones.use('dark-ward@9#0', 11.1, () => null)).toBe('ok');
    expect(stones.use('meteor@3', 20, () => null)).toBe('none');
  });

  it('Spellstones are saved per character, and synced (progress/spellstones)', () => {
    const first = boot();
    first.stones.setSoulForTest(33);
    TestBed.resetTestingModule();
    const second = boot('k2second');
    expect(second.stones.state.soul).toBe(0);
    second.stones.setSoulForTest(7);
    expect(localStorage.getItem(`${SPELLSTONES_KEY}@k2second`)).toContain('"soul":7');
    TestBed.resetTestingModule();
    expect(boot().stones.state.soul).toBe(33);
    expect(SYNCED_BLOBS.find(b => b.key === SPELLSTONES_KEY)).toEqual(jasmine.objectContaining({ collection: 'progress', doc: 'spellstones' }));
  });

  it('blanks at the counter: priced on the hunt, Gold spent, a retried press is a replay', () => {
    const { stones } = boot();
    economy.snapshot.gold = 1_000;
    expect(stones.buyBlanks(3, 30, 'press-1')).toBe('ok');
    expect(inventory.stackOf(BLANK_ID)).toBe(3);
    expect(economy.snapshot.gold).toBe(1_000 - 3 * blankPrice(30));
    expect(stones.buyBlanks(3, 30, 'press-1')).toBe('replayed');
    economy.snapshot.gold = 0;
    expect(stones.buyBlanks(1, 30, 'press-2')).toBe('funds');
  });

  it('Sexton Wren lays a curse to rest for Gold: the cost goes, the bonus halves; never twice', () => {
    const { grave } = boot();
    inventory.items = [piece('c1', { equipped: true, curse: curseFor('hollow-ward', 20) })];
    expect(graveStats(inventory.items[0])).toEqual({ life: 55, allResist: -15 });
    expect(grave.cleanse('c1', 30)).toBe('gold');
    economy.snapshot.gold = cleansePrice(30) + 5;
    expect(grave.cleanse('c1', 30)).toBe('ok');
    expect(economy.snapshot.gold).toBe(5);
    expect(inventory.items[0].curse?.cleansed).toBeTrue();
    expect(graveStats(inventory.items[0])).toEqual({ life: 27.5 });
    expect(grave.cleanse('c1', 30)).toBe('done');
    expect(grave.cleanse('nope', 30)).toBe('missing');
  });

  it('a whisper counts kills only while worn and listening; the Archivist silences it for Gold', () => {
    const { grave } = boot();
    inventory.items = [piece('w1', { equipped: true, whisper: { id: 'first-tally', kills: WHISPER_STAGES[0] - 1 } }), piece('w2', { whisper: { id: 'margin-hand', kills: 0 } })];
    const woke = grave.kill();
    expect(woke.map(w => [w.item.id, w.stage])).toEqual([['w1', 1]]);
    expect(inventory.items[1].whisper?.kills).toBe(0);
    economy.snapshot.gold = silencePrice(10);
    expect(grave.silence('w1', 10)).toBe('ok');
    expect(economy.snapshot.gold).toBe(0);
    const k = inventory.items[0].whisper!.kills;
    expect(grave.kill()).toEqual([]);
    expect(inventory.items[0].whisper!.kills).toBe(k);
    expect(graveStats(inventory.items[0])).toEqual({ spellDamage: 2 });
  });
});
