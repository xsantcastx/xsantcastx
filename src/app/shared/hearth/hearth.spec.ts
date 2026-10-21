/**
 * hearth.spec.ts — the Cold Hearth and the Hearth Blessings (design-bible §5.8): the purse share a fall leaves, the
 * Ember debt's math and its payoff, blessings consumed by a fall, the wake point persisting per character, and the
 * merge two devices meet on.
 */
import { TestBed } from '@angular/core/testing';
import { huntGold } from '../economy/economy-curve';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { LootService } from '../loot/loot.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { ACTIVE_CHARACTER_KEY } from '../save/character-scope';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { keeperLevelForXp, keeperLevelView, keeperXpForLevel } from '../skills/keeper-level';
import {
  BLESSINGS, BLESSING_SECONDS, DEBT_SHARE, HEARTH_GRACE_LEVEL, blessingPrice, debtCap, fallDebt, fallScale, payDebt,
} from './hearth-rules';
import { HEARTH_KEY, coerceHearth, emptyHearth, mergeHearth } from './hearth-save.model';
import { HearthService } from './hearth.service';

class FakeEconomy {
  snapshot = { gold: 0 };
  spent: { n: number; why: string }[] = [];
  spendGold(n: number, why = 'spend'): boolean {
    if (n <= 0 || this.snapshot.gold < n) return false;
    this.snapshot.gold -= n; this.spent.push({ n, why });
    return true;
  }
  earnGold(n: number): number { this.snapshot.gold += n; return n; }
}

/** XP in the middle of `level` (so a fall's debt is 10% of that level's span). */
const midXp = (level: number) => keeperXpForLevel(level) + Math.floor((keeperXpForLevel(level + 1) - keeperXpForLevel(level)) / 2);

describe('Cold Hearth rules (pure)', () => {
  it('a blessing costs one minute of a steady hunt at the Keeper\'s level; five take a fall to nothing', () => {
    for (const L of [20, 40, 100, 1000]) expect(blessingPrice(L)).toBe(huntGold(L, BLESSING_SECONDS));
    expect(blessingPrice(40)).toBeGreaterThan(blessingPrice(20));
    expect(BLESSINGS.length).toBe(5);
    expect(fallScale(0)).toBe(1);
    expect(fallScale(2)).toBeCloseTo(.6, 10);
    expect(fallScale(5)).toBe(0);
    expect(fallScale(9)).toBe(0);
  });

  it('the Ember debt is 10% of the XP the current level needs, less 20% per blessing; nothing under the grace level', () => {
    const xp = midXp(30), span = keeperLevelView(xp).span;
    expect(fallDebt(xp, 0)).toBe(Math.floor(span * DEBT_SHARE));
    expect(fallDebt(xp, 3)).toBe(Math.floor(span * DEBT_SHARE * .4));
    expect(fallDebt(xp, 5)).toBe(0);
    expect(fallDebt(midXp(HEARTH_GRACE_LEVEL - 1), 0)).toBe(0);
    expect(fallDebt(keeperXpForLevel(HEARTH_GRACE_LEVEL), 0)).toBeGreaterThan(0);
  });

  it('falls in a row stop adding debt at one level\'s worth', () => {
    const xp = midXp(25), cap = debtCap(xp);
    let debt = 0;
    for (let i = 0; i < 30; i++) debt += fallDebt(xp, 0, debt);
    expect(debt).toBe(cap);
    expect(fallDebt(xp, 0, cap)).toBe(0);
  });

  it('half of each kill pays the debt off, the rest is earned; it is paid in full, and never takes a level', () => {
    expect(payDebt(40, 100)).toEqual({ earned: 20, paid: 20, debt: 80 });
    expect(payDebt(40, 7)).toEqual({ earned: 33, paid: 7, debt: 0 });
    expect(payDebt(1, 5)).toEqual({ earned: 0, paid: 1, debt: 4 });
    expect(payDebt(40, 0)).toEqual({ earned: 40, paid: 0, debt: 0 });
    // A Keeper at 30 falls, then hunts: XP only ever grows, the level never drops, and the debt reaches zero.
    let xp = midXp(30), debt = fallDebt(xp, 0);
    const level = keeperLevelForXp(xp);
    let kills = 0;
    while (debt > 0 && kills < 10_000) {
      const r = payDebt(80, debt);
      expect(r.earned + r.paid).toBe(80);
      xp += r.earned; debt = r.debt; kills++;
      expect(keeperLevelForXp(xp)).toBeGreaterThanOrEqual(level);
    }
    expect(debt).toBe(0);
    expect(kills).toBe(Math.ceil(fallDebt(midXp(30), 0) / 40));
  });
});

describe('HearthService (the Cold Hearth through the save gateway)', () => {
  let economy: FakeEconomy;

  function boot(character: string | null = null): { hearth: HearthService; loot: LootService; gateway: GameStateGateway } {
    TestBed.resetTestingModule();
    if (character) localStorage.setItem(ACTIVE_CHARACTER_KEY, character); else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
    TestBed.configureTestingModule({
      providers: [
        { provide: EconomyService, useValue: economy },
        { provide: InventoryService, useValue: { snapshot: { items: [] }, equippedMagicFind: 0 } },
        { provide: RuneForgeService, useValue: {} },
      ],
    });
    return { hearth: TestBed.inject(HearthService), loot: TestBed.inject(LootService), gateway: TestBed.inject(GameStateGateway) };
  }

  beforeEach(() => { localStorage.clear(); economy = new FakeEconomy(); });
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

  it('a fall leaves the tier\'s share of the purse where the Keeper fell, less 20% per blessing', () => {
    const { hearth, loot } = boot();
    const xp = midXp(30);
    economy.snapshot.gold = 10_000;
    const plain = hearth.fall({ area: 'td:ember-isle|surface', x: 120, y: 340 }, xp);
    expect(plain.gold).toBe(500);
    expect(economy.snapshot.gold).toBe(9_500);
    expect(loot.state.purse).toEqual(jasmine.objectContaining({ area: 'td:ember-isle|surface', x: 120, y: 340, gold: 500 }));
    // Walked back: it comes home whole.
    expect(loot.recover()).toBe(500);
    expect(economy.snapshot.gold).toBe(10_000);

    economy.snapshot.gold = 100_000;
    expect(hearth.buy('pyre', 30)).toBe('ok');
    expect(hearth.buy('root', 30)).toBe('ok');
    const gold = economy.snapshot.gold;
    const blessed = hearth.fall({ area: 'td:ember-isle|surface', x: 10, y: 20 }, xp);
    expect(blessed.gold).toBe(Math.floor(gold * .05 * .6));
    expect(blessed.blessed).toBe(2);
  });

  it('blessings are bought with Gold at the Keeper\'s price, once each, and a fall consumes them all', () => {
    const { hearth } = boot();
    const xp = midXp(40), price = blessingPrice(40);
    economy.snapshot.gold = price * 3 + 5;
    expect(hearth.buy('dawn', 40)).toBe('ok');
    expect(hearth.buy('dawn', 40)).toBe('held');
    expect(hearth.buy('gloam', 40)).toBe('ok');
    expect(hearth.buy('nope', 40)).toBe('unknown');
    expect(economy.spent.map(s => s.n)).toEqual([price, price]);
    expect(hearth.state.blessings).toEqual(['gloam', 'dawn']);
    expect(hearth.buy('pyre', 40)).toBe('ok');
    expect(hearth.buy('root', 40)).toBe('gold');
    // Under the grace level a blessing has nothing to soften: not sold.
    expect(hearth.buy('root', HEARTH_GRACE_LEVEL - 1)).toBe('grace');

    const before = hearth.state;
    const fall = hearth.fall({ area: 'td:ember-isle|surface', x: 0, y: 0 }, xp);
    expect(fall.blessed).toBe(3);
    expect(fall.debt).toBe(fallDebt(xp, 3));
    expect(hearth.state.blessings).toEqual([]);
    expect(hearth.state.ledgerAt).toBeGreaterThan(before.ledgerAt);
    expect(hearth.state.falls).toBe(1);
  });

  it('the Ember debt grows on a fall and kills pay it off, half each', () => {
    const { hearth } = boot();
    const xp = midXp(30);
    const fall = hearth.fall({ area: 'td:ember-isle|surface', x: 0, y: 0 }, xp);
    expect(fall.debt).toBe(fallDebt(xp, 0));
    expect(hearth.state.debt).toBe(fall.debt);
    const r = hearth.earn(100);
    expect(r).toEqual({ earned: 50, paid: 50 });
    expect(hearth.state.debt).toBe(fall.debt - 50);
    let guard = 0;
    while (hearth.state.debt > 0 && guard++ < 10_000) hearth.earn(100);
    expect(hearth.state.debt).toBe(0);
    expect(hearth.earn(100)).toEqual({ earned: 100, paid: 0 });
  });

  it('under the grace level a fall costs nothing: no purse, no debt, blessings kept', () => {
    const { hearth, loot } = boot();
    economy.snapshot.gold = 5_000;
    const fall = hearth.fall({ area: 'td:ember-isle|surface', x: 0, y: 0 }, midXp(5));
    expect(fall).toEqual(jasmine.objectContaining({ grace: true, gold: 0, debt: 0, blessed: 0 }));
    expect(economy.snapshot.gold).toBe(5_000);
    expect(loot.state.purse).toBeNull();
    expect(hearth.state.debt).toBe(0);
  });

  it('the wake point is the last hearth lit, and it persists per character', () => {
    const first = boot();
    expect(first.hearth.light('hearth:infernal-reach:pyrehold')).toEqual({ first: true });
    expect(first.hearth.light('hearth:ember-isle:basalt-seamworks')).toEqual({ first: true });
    expect(first.hearth.light('hearth:infernal-reach:pyrehold')).toEqual({ first: false });
    expect(first.hearth.state.wake).toBe('hearth:infernal-reach:pyrehold');
    expect(first.hearth.light('not a hearth')).toEqual({ first: false });

    // A reload of the same character: the same wake point.
    const again = boot();
    expect(again.hearth.state.wake).toBe('hearth:infernal-reach:pyrehold');
    expect(again.hearth.state.lit).toEqual(['hearth:ember-isle:basalt-seamworks', 'hearth:infernal-reach:pyrehold']);

    // A second character has its own hearths; lighting one never touches the first's.
    const second = boot('k2second');
    expect(second.hearth.state.wake).toBeNull();
    second.hearth.light('hearth:verdant-wilds:rootglass');
    expect(localStorage.getItem(`${HEARTH_KEY}@k2second`)).toContain('rootglass');
    expect(second.gateway.readFor('c1', HEARTH_KEY)).toEqual(jasmine.objectContaining({ wake: 'hearth:infernal-reach:pyrehold' }));
    const back = boot();
    expect(back.hearth.state.wake).toBe('hearth:infernal-reach:pyrehold');
  });

  it('is synced (progress/hearth) with a merge that unions hearths and keeps the later wake and ledger', () => {
    const entry = SYNCED_BLOBS.find(b => b.key === HEARTH_KEY);
    expect(entry).toEqual(jasmine.objectContaining({ collection: 'progress', doc: 'hearth' }));
    const a = { ...emptyHearth(), lit: ['hearth:a:x'], wake: 'hearth:a:x', wakeAt: 10, debt: 300, blessings: ['pyre'], ledgerAt: 50, falls: 2 };
    const b = { ...emptyHearth(), lit: ['hearth:b:y'], wake: 'hearth:b:y', wakeAt: 20, debt: 0, blessings: [], ledgerAt: 40, falls: 3 };
    const m = coerceHearth(mergeHearth(a, b));
    expect(m.lit).toEqual(['hearth:a:x', 'hearth:b:y']);
    expect(m.wake).toBe('hearth:b:y');
    expect(m.debt).toBe(300);
    expect(m.blessings).toEqual(['pyre']);
    expect(m.falls).toBe(3);
    expect(coerceHearth(mergeHearth(b, a))).toEqual(m);
    expect(coerceHearth({ lit: ['../evil', 7], wake: 'x', debt: -5, blessings: ['pyre', 'pyre', 'junk'] })).toEqual({ ...emptyHearth(), blessings: ['pyre'] });
  });
});
