import { materialDisplay } from '../rpg/material-catalog';
import {
  POTIONS, POTION_COOLDOWN, POTION_POUR_SECS, POTION_SHELF, bestPotion, dropTier, potionById, potionCooldownLeft, potionEffect, rollPotionDrop,
} from './potions.model';

const held = (stacks: Record<string, number>) => (id: string) => stacks[id] ?? 0;
/** A fixed sequence for rand(), repeating its last value. */
const seq = (...xs: number[]) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

describe('potions.model', () => {
  it('Q drinks the best Health potion held, R the best Mana potion held', () => {
    const bag = held({ 'minor-health-potion': 3, 'lesser-health-potion': 1, 'minor-mana-potion': 2, 'greater-mana-potion': 1 });
    expect(bestPotion('health', bag)?.id).toBe('lesser-health-potion');
    expect(bestPotion('mana', bag)?.id).toBe('greater-mana-potion');
  });

  it('a Rejuvenation stands in only when no potion of that kind is left, and an empty belt drinks nothing', () => {
    expect(bestPotion('health', held({ 'rejuvenation-potion': 1, 'minor-mana-potion': 1 }))?.id).toBe('rejuvenation-potion');
    expect(bestPotion('mana', held({ 'rejuvenation-potion': 1, 'minor-mana-potion': 1 }))?.id).toBe('minor-mana-potion');
    expect(bestPotion('health', held({}))).toBeNull();
    expect(bestPotion('health', held({ 'greater-health-potion': 0 }))).toBeNull();
  });

  it('one drink every two seconds, shared by both keys', () => {
    expect(POTION_COOLDOWN).toBe(2);
    expect(potionCooldownLeft(null, 5)).toBe(0);
    expect(potionCooldownLeft(10, 10.5)).toBeCloseTo(1.5, 5);
    expect(potionCooldownLeft(10, 12)).toBe(0);
    expect(potionCooldownLeft(10, 30)).toBe(0);
  });

  it('Health and Mana pour in over a second; a Rejuvenation restores 40% of both at once', () => {
    expect(potionEffect(potionById('minor-health-potion')!, 100, 60)).toEqual({ heal: 50, mana: 0, secs: POTION_POUR_SECS });
    expect(potionEffect(potionById('greater-health-potion')!, 300, 200)).toEqual({ heal: 220, mana: 0, secs: 1 });
    expect(potionEffect(potionById('lesser-mana-potion')!, 100, 60)).toEqual({ heal: 0, mana: 70, secs: 1 });
    expect(potionEffect(potionById('rejuvenation-potion')!, 250, 150)).toEqual({ heal: 100, mana: 60, secs: 0 });
  });

  it('each tier heals more and costs more than the one below; the Rejuvenation is never sold', () => {
    for (const kind of ['health', 'mana'] as const) {
      const row = POTIONS.filter(p => p.kind === kind).sort((a, b) => a.tier - b.tier);
      expect(row.map(p => p.tier)).toEqual([1, 2, 3]);
      for (let i = 1; i < row.length; i++) {
        expect(row[i].amount).toBeGreaterThan(row[i - 1].amount);
        expect(row[i].price).toBeGreaterThan(row[i - 1].price);
      }
    }
    expect(POTION_SHELF.some(p => p.kind === 'rejuv')).toBeFalse();
    expect(POTION_SHELF.length).toBe(6);
  });

  it('creatures drop better potions the stronger they are', () => {
    expect(dropTier(1)).toBe(1);
    expect(dropTier(8)).toBe(2);
    expect(dropTier(16)).toBe(3);
    // Drop roll, then kind (< .55 health).
    expect(rollPotionDrop(3, 'normal', seq(0.01, 0.1))?.id).toBe('minor-health-potion');
    expect(rollPotionDrop(12, 'normal', seq(0.01, 0.9, 0.9))?.id).toBe('lesser-mana-potion');
    expect(rollPotionDrop(20, 'normal', seq(0.01, 0.9, 0.1))?.id).toBe('greater-health-potion');
    // Level 10 and up: the second roll may make it a Rejuvenation; below 10 it never is.
    expect(rollPotionDrop(14, 'boss', seq(0.01, 0.1))?.id).toBe('rejuvenation-potion');
    expect(rollPotionDrop(5, 'boss', seq(0.01, 0.01))?.id).toBe('minor-health-potion');
    // Most kills drop none; a boss drops one more often than a plain creature.
    expect(rollPotionDrop(5, 'normal', seq(0.5))).toBeNull();
    expect(rollPotionDrop(5, 'boss', seq(0.5, 0.9))).not.toBeNull();
  });

  it('every potion has a name the satchel paints, a Found in, a source, a use and lore', () => {
    for (const p of POTIONS) {
      expect(materialDisplay(p.id)?.name).withContext(p.id).toBe(p.name);
      expect(materialDisplay(p.id)?.art).withContext(p.id).toBeTruthy();
      expect(p.foundIn.length).withContext(p.id).toBeGreaterThan(0);
      expect(p.sources.length).withContext(p.id).toBeGreaterThan(0);
      expect(p.uses.length).withContext(p.id).toBeGreaterThan(0);
      expect(p.lore.trim()).withContext(p.id).not.toBe('');
    }
  });
});
