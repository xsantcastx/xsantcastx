import { TestBed } from '@angular/core/testing';

import { FishingService } from './fishing.service';
import { InventoryService } from '../rpg/inventory.service';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { FISHING_KEY, LEDGER_REWARD, ledgerXp } from './fishing.model';

const KEYS = [FISHING_KEY, 'godforge-inventory', 'godforge-activity', 'godforge-delve', 'eclipse-npc'];

describe('FishingService', () => {
  let fishing: FishingService;
  let inventory: InventoryService;
  let activity: ActivityProgressionGateway;

  beforeEach(() => {
    for (const key of KEYS) localStorage.removeItem(key);
    TestBed.configureTestingModule({});
    fishing = TestBed.inject(FishingService);
    inventory = TestBed.inject(InventoryService);
    activity = TestBed.inject(ActivityProgressionGateway);
    inventory.init();
    activity.init();
    fishing.now = () => new Date(2026, 9, 14, 12, 0, 0);
    // The world clock's hour is pinned too (shared/world-clock): day, so no dark-only fish bite.
    fishing.dark = () => false;
  });
  afterEach(() => { for (const key of KEYS) localStorage.removeItem(key); });

  const fishingXp = () => activity.snapshot.progress.xpByDiscipline.fishing ?? 0;

  it('lands every hooked fish, pays Fishing XP and the stack once, and fills the Catalogue', () => {
    fishing.random = () => .01; // the most common fish of the water
    const pending = fishing.hooked({ castId: 'fish:test:1', biome: 'glowcap-grotto', liquid: 'water' });
    expect(pending.water).toBe('mere');
    for (const grade of ['off'] as const) {
      const landed = fishing.land(pending, grade)!;
      expect(landed).withContext('always landed').toBeTruthy();
      expect(landed.xp).toBe(8);
      expect(landed.first).toBeTrue();
      expect(inventory.stackOf(landed.id)).toBe(landed.qty);
      expect(fishingXp()).toBe(8);
      expect(fishing.caught(landed.id)).toBe(landed.qty);
      // A replay of the same cast (a retried write) pays nothing twice.
      fishing.land(pending, grade);
      expect(fishingXp()).toBe(8);
      expect(fishing.caught(landed.id)).toBe(landed.qty);
    }
  });

  it('a better grade only adds: a Perfect reel pays more XP than an Off one, never less', () => {
    fishing.random = () => .01;
    const off = fishing.land(fishing.hooked({ castId: 'fish:a', biome: 'magma-halls', liquid: 'lava' }), 'off')!;
    const perfect = fishing.land(fishing.hooked({ castId: 'fish:b', biome: 'magma-halls', liquid: 'lava' }), 'perfect')!;
    expect(perfect.xp).toBeGreaterThan(off.xp);
    expect(fishingXp()).toBe(off.xp + perfect.xp);
  });

  it('uses the strongest bait once a catch is landed', () => {
    fishing.random = () => .5;
    inventory.grantStack('test:bait', 'ember-grub', 3);
    inventory.grantStack('test:bait2', 'glowcap', 1);
    const pending = fishing.hooked({ castId: 'fish:bait', biome: 'root-hollows', liquid: 'water' });
    expect(pending.bait).toBe('glowcap');
    fishing.land(pending, 'good');
    expect(inventory.stackOf('glowcap')).toBe(0);
    expect(inventory.stackOf('ember-grub')).toBe(3);
  });

  it('the Lodge Warden takes today\'s fish once a day and pays income, XP and the ladder\'s gift', () => {
    const today = fishing.ledgerToday();
    expect(today.done).toBeFalse();
    expect(today.held).toBeFalse();
    expect(fishing.turnIn()).withContext('nothing to hand in').toBeNull();
    inventory.grantStack('test:quest', today.id, 2);
    const paid = fishing.turnIn()!;
    expect(paid.gold).toBeGreaterThanOrEqual(LEDGER_REWARD.goldFloor);
    expect(paid.xp).toBe(ledgerXp(today.water));
    expect(fishingXp()).toBe(paid.xp);
    expect(inventory.stackOf(today.id)).toBe(1);
    expect(fishing.ledgerToday().done).toBeTrue();
    expect(fishing.turnIn()).withContext('once a day').toBeNull();
    expect(fishing.save.turnIns).toBe(1);
  });

  it('opens a crate into its stacks, once per crate', () => {
    fishing.random = () => .1;
    inventory.grantStack('test:crate', 'root-crate', 1);
    const got = fishing.openCrate('root-crate')!;
    expect(got.length).toBeGreaterThan(0);
    expect(inventory.stackOf('root-crate')).toBe(0);
    for (const row of got) expect(inventory.stackOf(row.id)).toBeGreaterThanOrEqual(row.qty);
    expect(fishing.openCrate('root-crate')).toBeNull();
  });

  it('hands the Worn Rod over once, and the rod works water only until a Seam Rod and Fishing 10', () => {
    fishing.ensureWornRod();
    expect(inventory.stackOf('worn-rod')).toBe(1);
    fishing.ensureWornRod();
    expect(inventory.stackOf('worn-rod')).toBe(1);
    expect(fishing.rod()!.liquids).toEqual(['water']);
  });
});
