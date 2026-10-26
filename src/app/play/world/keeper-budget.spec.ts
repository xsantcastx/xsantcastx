/**
 * keeper-budget.spec.ts — what a Keeper can really deal, read from its save (protocol 8; keeper-budget.ts), and the
 * claim gate taking that budget instead of the level's.
 */
import { CLAIM_WINDOW_MS, ClaimGate, claimDpsCap } from '../social/coop-rules';
import { keeperXpForLevel } from '../../shared/skills/keeper-level';
import { packInventory } from '../../../../functions-game/src/trade-core';
import { itemToRecord } from '../../shared/rpg/inventory-ops';
import type { GameItem } from '../../shared/rpg/item.model';
import { BUDGET_AOE, GUEST_LEVEL_CAP, MAX_GEAR_LIFT, REF_BOOST, budgetFor, guestBudget, huntingXp, keeperBudget, refDps, wornLift } from './keeper-budget';

/** A worn wand's record as inventory-ops writes it (the room reads the save with the game's own parser). */
const worn = (stats: Record<string, number>, over: Record<string, unknown> = {}) => ({
  ...itemToRecord({ id: `w${Object.keys(stats).join('')}`, name: 'Ash Wand', type: 'artifact', rarity: 'common', stats, equipped: true, slot: 'weapon', sellValue: 0, lore: '', foundAt: '2026-10-01T00:00:00.000Z', soulbound: false } as GameItem),
  revision: { hlc: 5, deviceId: 'd', sequence: 1 }, ...over,
});
const inv = (records: unknown[], tombstones: unknown[] = []) => ({ v: { version: 2, records, tombstones, stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null, era: 0 }, updatedAt: '' });

describe('keeper-budget (protocol 8: the budget from the save)', () => {
  it('reads the level from the Hunting XP on the game\'s own curve, never from what the presence says', () => {
    const activity = { v: { progress: { xpByDiscipline: { hunting: keeperXpForLevel(42) } } } };
    expect(huntingXp(activity)).toBe(keeperXpForLevel(42));
    const k = keeperBudget({ activity, look: { v: { vocation: 'warlock' } } });
    expect(k.level).toBe(42);
    expect(k.vocation).toBe('warlock');
    expect(keeperBudget({}).level).toBe(1);
  });

  it('lifts the budget for worn damage, crit and speed (capped), ignoring the bag and anything tombstoned', () => {
    expect(wornLift(inv([]))).toBe(1);
    const strong = inv([worn({ spellDamage: 100, critChance: 20, castSpeed: 50 })]);
    expect(wornLift(strong)).toBeCloseTo(2 * 1.2 * 1.5, 5);
    // The same save in the packed cloud format (save format 3) reads the same.
    expect(wornLift({ v: packInventory(strong.v as never), updatedAt: '' })).toBeCloseTo(2 * 1.2 * 1.5, 5);
    expect(wornLift(inv([worn({ attackDamage: 100 }, { location: { kind: 'bag' } })]))).toBe(1);
    expect(wornLift(inv([worn({ attackDamage: 100 })], [{ id: 'wattackDamage', revision: { hlc: 9, deviceId: 'd', sequence: 2 }, deletedAt: 1 }]))).toBe(1);
    expect(budgetFor(30, REF_BOOST * 100)).toBe(Math.round(BUDGET_AOE * refDps(30) * MAX_GEAR_LIFT));
  });

  it('beats the simulated Keeper at every level, grows with level, and a guest stays conservative', () => {
    for (const L of [1, 5, 10, 20, 30, 40, 60, 120]) {
      expect(budgetFor(L)).toBeGreaterThanOrEqual(3 * refDps(L));
      expect(budgetFor(L)).toBeGreaterThanOrEqual(claimDpsCap(L));
    }
    expect(budgetFor(60)).toBeGreaterThan(budgetFor(40));
    expect(guestBudget(999)).toBe(claimDpsCap(GUEST_LEVEL_CAP));
    expect(guestBudget(3)).toBe(claimDpsCap(3));
  });

  it('the claim gate spends the save\'s budget over its window when one is given', () => {
    const gate = new ClaimGate();
    const target = { x: 0, y: 0, hp: 1e9 };
    const r = gate.check({ d: 100000 }, { id: 'k', x: 0, y: 0, level: 999, dps: 10 }, target, 0);
    expect(r.ok && r.dmg).toBe(10 * CLAIM_WINDOW_MS / 1000);
    expect(gate.check({ d: 5 }, { id: 'k', x: 0, y: 0, level: 999, dps: 10 }, target, 1).ok).toBeFalse();
    // No budget given: the level's, as before.
    const g2 = new ClaimGate();
    const r2 = g2.check({ d: 100000 }, { id: 'k', x: 0, y: 0, level: 5 }, target, 0);
    expect(r2.ok && r2.dmg).toBe(claimDpsCap(5) * CLAIM_WINDOW_MS / 1000);
  });
});
