/**
 * keeper-milestones.spec.ts — the level milestones (docs/design/leveling.md §3, §5): the table is complete and every
 * row gives something; the level-up summary lists exactly what a level gave; skill points; the save merge never
 * double-grants; the service pays a milestone's Gold and gear once (receipt first) and announces only real crossings.
 */
import { huntGold } from '../economy/economy-curve';
import { TestBed } from '@angular/core/testing';
import { HUD_I18N } from '../../play/world/hud.i18n';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { MILESTONE_SKILL_POINTS, skillPointsEarned } from '../keeper-look/skill-points';
import { keeperXpForLevel, levelAttributePoints } from './keeper-level';
import { KeeperLevelService, type KeeperLevelUp } from './keeper-level.service';
import {
  MILESTONES, frameFor, keeperAttributePoints, levelUpSummary, milestonesBetween, nextMilestone, passiveBonus, titlesEarned,
} from './keeper-milestones';
import { KEEPER_LEVEL_KEY, coerceKeeperMilestones, mergeKeeperMilestones, type KeeperMilestoneState } from './keeper-milestones-save.model';

describe('Keeper level milestones', () => {
  it('sits at 5…50, 75, 100, every 100 to 1,000, every 500 to 5,000 and 10,000; each gives something', () => {
    const want = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
      1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 10000];
    expect(MILESTONES.map(m => m.level)).toEqual(want);
    for (const m of MILESTONES) expect(Object.keys(m.rewards).length).withContext(`${m.level}`).toBeGreaterThan(0);
    expect(MILESTONES.filter(m => m.big).map(m => m.level)).toEqual([50, 100, 1000, 5000, 10000]);
    // Every bonus skill point sits on a milestone row (and reads off it).
    for (const at of Object.keys(MILESTONE_SKILL_POINTS)) expect(MILESTONES.find(m => m.level === Number(at))?.rewards.skillPoints).withContext(at).toBe(MILESTONE_SKILL_POINTS[Number(at)]);
  });

  it('every title, frame and passive has its words, EN and ES', () => {
    const keys = new Set<string>();
    for (const m of MILESTONES) {
      if (m.rewards.title) keys.add(`play.lvl.title.${m.rewards.title}`);
      if (m.rewards.frame) keys.add(`play.lvl.frame.${m.rewards.frame}`);
      if (m.rewards.passive) keys.add(`play.lvl.r.passive.${m.rewards.passive.stat}`);
    }
    for (const k of keys) { expect(HUD_I18N[k]?.en).withContext(k).toBeTruthy(); expect(HUD_I18N[k]?.es).withContext(k).toBeTruthy(); }
  });

  it('derived rewards follow the level: titles, the frame, passives, points', () => {
    expect(titlesEarned(4)).toEqual([]);
    expect(titlesEarned(15)).toEqual(['kindled', 'ashwalker']);
    expect(frameFor(9)).toBeNull();
    expect(frameFor(10)).toBe('copper');
    expect(frameFor(99)).toBe('silver');
    expect(frameFor(10_000)).toBe('starlit');
    expect(passiveBonus(14)).toEqual({});
    // A damage milestone is every calling's (§3.6): it rides on both families, and each calling reads its own.
    expect(passiveBonus(40)).toEqual({ spellDamage: 1, attackDamage: 1, moveSpeed: 1, critChance: 1 });
    expect(keeperAttributePoints(19)).toBe(levelAttributePoints(19));
    expect(keeperAttributePoints(20)).toBe(levelAttributePoints(20) + 5);
    expect(nextMilestone(10)?.level).toBe(15);
    expect(nextMilestone(10_000)).toBeNull();
    expect(milestonesBetween(9, 30).map(m => m.level)).toEqual([10, 15, 20, 25, 30]);
  });

  it('skill points: one a level from 2, plus the milestones\' bonus', () => {
    expect(skillPointsEarned(1)).toBe(0);
    expect(skillPointsEarned(9)).toBe(8);
    expect(skillPointsEarned(10)).toBe(9 + 1);
    expect(skillPointsEarned(50)).toBe(49 + 1 + 1 + 2);
    expect(skillPointsEarned(10_000)).toBe(9_999 + Object.values(MILESTONE_SKILL_POINTS).reduce((a, b) => a + b, 0));
  });

  it('the level-up summary: exactly what the level gave, a jump summed', () => {
    const one = levelUpSummary(11, 12);
    expect(one).toEqual(jasmine.objectContaining({ from: 11, level: 12, life: 8, mana: 6, power: 5, points: 5, skillPoints: 1, milestones: [] }));
    const at10 = levelUpSummary(9, 10);
    expect(at10.milestones.map(m => m.level)).toEqual([10]);
    expect(at10.skillPoints).toBe(2);
    const jump = levelUpSummary(18, 21);
    expect(jump.life).toBe(24);
    expect(jump.points).toBe(15 + 5);
    expect(jump.milestones.map(m => m.level)).toEqual([20]);
  });

  it('the save merge: receipts unioned (commutative), the later title wins, junk dropped', () => {
    const a = { version: 1, claimed: [5, 10], title: 'kindled', titleAt: 100 };
    const b = { version: 1, claimed: [10, 20, 'x', -3, 99999], title: 'ashwalker', titleAt: 200 };
    const ab = mergeKeeperMilestones(a, b) as KeeperMilestoneState, ba = mergeKeeperMilestones(b, a) as KeeperMilestoneState;
    expect(ab).toEqual(ba);
    expect(ab.claimed).toEqual([5, 10, 20]);
    expect(ab.title).toBe('ashwalker');
    expect(mergeKeeperMilestones(null, a)).toBe(a);
    expect(coerceKeeperMilestones({ title: 'NOT OK!', claimed: 'x' })).toEqual({ version: 1, claimed: [], title: '', titleAt: 0 });
    const blob = SYNCED_BLOBS.find(x => x.key === KEEPER_LEVEL_KEY);
    expect(blob?.merge).toBe(mergeKeeperMilestones);
  });
});

class FakeEconomy {
  snapshot = { perSecond: 0 };
  earned: { n: number; source: string }[] = [];
  earnGold(n: number, source: string): number { this.earned.push({ n, source }); return n; }
}
class FakeInventory {
  items = new Map<string, GameItem>();
  itemById(id: string) { return this.items.get(id); }
  add(item: GameItem) { this.items.set(item.id, item); return item; }
}

describe('KeeperLevelService (the fanfare and the one-time pay)', () => {
  let economy: FakeEconomy;
  let inventory: FakeInventory;
  const boot = (): KeeperLevelService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: EconomyService, useValue: economy }, { provide: InventoryService, useValue: inventory }] });
    return TestBed.inject(KeeperLevelService);
  };
  const saved = (): KeeperMilestoneState => {
    const parsed = JSON.parse(localStorage.getItem(KEEPER_LEVEL_KEY) ?? 'null');
    return coerceKeeperMilestones(parsed && typeof parsed === 'object' && 'v' in parsed && 'updatedAt' in parsed ? parsed.v : parsed);
  };
  beforeEach(() => { localStorage.removeItem(KEEPER_LEVEL_KEY); economy = new FakeEconomy(); inventory = new FakeInventory(); });
  afterEach(() => localStorage.removeItem(KEEPER_LEVEL_KEY));

  it('announces only a crossing, with the milestone and what it paid; the receipt is saved and never pays twice', () => {
    const service = boot();
    const heard: KeeperLevelUp[] = [];
    service.events$.subscribe(e => heard.push(e));
    expect(service.check(keeperXpForLevel(4), keeperXpForLevel(4) + 1)).toBeNull();
    const ev = service.check(keeperXpForLevel(5) - 1, keeperXpForLevel(5));
    expect(ev?.level).toBe(5);
    expect(ev?.milestones.map(m => m.level)).toEqual([5]);
    expect(ev?.paid).toEqual([{ level: 5, gold: jasmine.any(Number) as unknown as number, gear: null }]);
    expect(heard.length).toBe(1);
    expect(saved().claimed).toEqual([5]);
    expect(economy.earned.length).toBe(1);
    // A second device's copy (merged in), or the same crossing again: nothing more.
    expect(service.claimDue(5)).toEqual([]);
    expect(boot().claimDue(9)).toEqual([]);
    expect(economy.earned.length).toBe(1);
  });

  it('pays a backlog once (an old save past 50): Gold for 5/20/40/50 and three gear pieces under fixed ids', () => {
    const paid = boot().claimDue(55);
    expect(paid.map(p => p.level)).toEqual([5, 10, 20, 30, 40, 50]);
    expect([...inventory.items.keys()].sort()).toEqual(['keeper-milestone-10', 'keeper-milestone-30', 'keeper-milestone-50']);
    expect(economy.earned.map(e => e.source)).toEqual(['keeper:level-5', 'keeper:level-20', 'keeper:level-40', 'keeper:level-50']);
    // Fixed sums now the forge pays nothing by the second: N minutes of a hunt at the milestone's level.
    expect(economy.earned.map(e => e.n)).toEqual([huntGold(5, 180), huntGold(20, 600), huntGold(40, 900), huntGold(50, 1800)]);
    expect(economy.earned[0].n).toBe(206);
    expect(saved().claimed).toEqual([5, 10, 20, 30, 40, 50]);
    expect(boot().claimDue(55)).toEqual([]);
    expect(economy.earned.length).toBe(4);
  });

  it('wears only an earned title', () => {
    const service = boot();
    expect(service.setTitle('hundredfold', 60)).toBeFalse();
    expect(service.setTitle('eclipsekeeper', 60)).toBeTrue();
    expect(saved().title).toBe('eclipsekeeper');
    expect(service.setTitle('', 60)).toBeTrue();
    expect(saved().title).toBe('');
  });
});
