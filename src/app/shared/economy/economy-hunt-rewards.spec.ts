import { TestBed } from '@angular/core/testing';

import { EconomyService } from './economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { IDLE_INCOME, gamesBetCap, huntGold, huntRate } from './economy-curve';
import { incomeRewardBase, isRetiredIncomeUpgrade, rewardRate } from './economy.model';
import { respecCostFor } from '../rpg/player-stats.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  attached = false;
  pending = 0;
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  read(key: string): unknown { const r = this.bag.get(key); return r ? JSON.parse(r) : null; }
  remove(key: string): void { this.bag.delete(key); }
}

/**
 * The forge pays nothing by the second (IDLE_INCOME off), so every reward and price that was "N seconds of income"
 * reads the hunt at the Keeper's level instead (economy-curve huntRate, EconomyService.setHuntLevel).
 */
describe('rewards priced in the hunt', () => {
  let economy: EconomyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EconomyService, LocalSaveRegistry, { provide: GameStateGateway, useValue: new MemoryGateway() }],
    });
    economy = TestBed.inject(EconomyService);
    economy.init();
  });

  it('publishes no forge rate, and the hunt\'s rate at the Keeper\'s level as the reward rate', () => {
    expect(IDLE_INCOME).toBeFalse();
    expect(economy.snapshot.perSecond).toBe(0);
    expect(economy.snapshot.huntLevel).toBe(1);
    expect(economy.snapshot.rewardPerSecond).toBeCloseTo(huntRate(1), 9);
    economy.setHuntLevel(40);
    expect(economy.snapshot.huntLevel).toBe(40);
    expect(rewardRate(economy.snapshot)).toBeCloseTo(huntRate(40), 9);
  });

  it('pays a reward of N seconds as N seconds of the Keeper\'s hunt, the floor below that', () => {
    economy.setHuntLevel(10);
    expect(incomeRewardBase(100, 600, economy.snapshot)).toBe(huntGold(10, 600));
    expect(incomeRewardBase(100_000, 600, economy.snapshot)).toBe(100_000);
    const before = economy.snapshot.gold;
    const paid = economy.earnIncome(50, 300, 'spec');
    expect(paid).toBe(huntGold(10, 300));
    expect(economy.snapshot.gold - before).toBe(paid);
  });

  it('climbs the bet cap and the respec with the level', () => {
    expect(gamesBetCap(rewardRate(economy.snapshot))).toBe(50);
    economy.setHuntLevel(40);
    expect(gamesBetCap(rewardRate(economy.snapshot))).toBe(1_000);
    expect(respecCostFor(rewardRate(economy.snapshot))).toBe(Math.ceil(huntRate(40) * 600));
  });

  it('still reads a hand-built snapshot by its forge rate, without the Fragment\'s ×2', () => {
    expect(rewardRate({ perSecond: 10 })).toBe(10);
    expect(rewardRate({ perSecond: 10, doubled: true })).toBe(5);
    expect(rewardRate(null)).toBe(0);
  });

  it('retires the furnace and the automatons, not the rest of the ladder', () => {
    expect(isRetiredIncomeUpgrade('forge-bellows')).toBeTrue();
    expect(isRetiredIncomeUpgrade('apprentice-striker')).toBeTrue();
    expect(isRetiredIncomeUpgrade('iron-hammer')).toBeFalse();
    expect(isRetiredIncomeUpgrade('explorer-slot')).toBeFalse();
  });
});
