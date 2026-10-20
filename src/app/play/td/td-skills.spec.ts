import { defenseReduction, fightStats, levelStats, wornCombat } from './td-skills';
import { sumStats } from '../../shared/rpg/item.model';

describe('td-skills fightStats (worn gear in the fight)', () => {
  const none = { vit: 0, ene: 0, spi: 0, agi: 0 };

  it('adds nothing without gear', () => {
    const base = levelStats(5, none);
    const st = fightStats(5, none);
    expect(st.maxHp).toBe(base.maxHp);
    expect(st.maxMana).toBe(base.maxMana);
    expect(st.power).toBe(base.power);
    expect(st.castSpeed).toBe(0);
    expect(st.crit).toBe(0);
  });

  it('turns worn affixes into the fight numbers', () => {
    const base = levelStats(5, none);
    const st = fightStats(5, none, { life: 20, mana: 10, spellDamage: 50, manaRegen: 1, lifeRegen: 2, castSpeed: 10, critChance: 5, defense: 30 });
    expect(st.maxHp).toBe(base.maxHp + 20);
    expect(st.maxMana).toBe(base.maxMana + 10);
    expect(st.power).toBeCloseTo(base.power * 1.5, 6);
    expect(st.regen).toBeCloseTo(base.regen + 1, 6);
    expect(st.lifeRegen).toBe(2);
    expect(st.castSpeed).toBeCloseTo(0.1, 6);
    expect(st.crit).toBeCloseTo(0.05, 6);
    expect(st.defense).toBe(30);
  });

  it('caps the worn totals, not the rolls', () => {
    const st = fightStats(1, { vit: 0, ene: 0, spi: 0, agi: 30 }, { spellDamage: 400, castSpeed: 90, critChance: 70, moveSpeed: 35 });
    expect(st.power).toBeCloseTo(levelStats(1).power * 2.5, 6);
    expect(st.castSpeed).toBeCloseTo(0.4, 6);
    expect(st.crit).toBeCloseTo(0.4, 6);
    expect(st.moveHaste).toBeCloseTo(0.4, 6);
    expect(st.haste).toBeCloseTo(0.3, 6);
  });

  it('cuts a blow by D ÷ (D + 40 + 6 × level)', () => {
    expect(defenseReduction(0, 10)).toBe(0);
    expect(defenseReduction(100, 10)).toBeCloseTo(100 / 200, 6);
  });

  it('reads every combat key off the equipped totals', () => {
    const t = sumStats([{ life: 3, defense: 4, moveSpeed: 5 }]);
    expect(wornCombat({ equippedTotals: t })).toEqual(jasmine.objectContaining({ life: 3, defense: 4, moveSpeed: 5, mana: 0 }));
  });
});
