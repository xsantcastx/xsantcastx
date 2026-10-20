import { defenseReduction, fightStats, incomingDamage, levelStats, wornCombat } from './td-skills';
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

describe('td-skills incoming damage (damage types, §6)', () => {
  const none = { vit: 0, ene: 0, spi: 0, agi: 0 };

  it('cuts a physical blow by Defense only — resists never touch it', () => {
    const raw = 100, def = 60, lv = 10;
    const expected = Math.round(raw * (1 - defenseReduction(def, lv)));
    expect(incomingDamage(raw, 'physical', def, lv, { fire: 75, cold: 75, lightning: 75, arcane: 75 })).toBe(expected);
    expect(incomingDamage(raw, 'physical', 0, lv, { fire: 75 })).toBe(100);
  });

  it('cuts each element by its own resist only — Defense and the other resists never touch it', () => {
    const resists = { fire: 50, cold: 20, lightning: 0, arcane: 10 };
    expect(incomingDamage(100, 'fire', 500, 10, resists)).toBe(50);
    expect(incomingDamage(100, 'cold', 500, 10, resists)).toBe(80);
    expect(incomingDamage(100, 'lightning', 500, 10, resists)).toBe(100);
    expect(incomingDamage(100, 'arcane', 500, 10, resists)).toBe(90);
    expect(incomingDamage(100, 'fire', 0, 10, { cold: 75 })).toBe(100);
  });

  it('caps a resist at 75 and never lets a hit fall under 1', () => {
    expect(incomingDamage(100, 'fire', 0, 1, { fire: 200 })).toBe(25);
    expect(incomingDamage(1, 'cold', 0, 1, { cold: 75 })).toBe(1);
    expect(incomingDamage(0, 'fire', 0, 1, {})).toBe(0);
  });

  it('sums each element with All Resist from the worn totals, capped at 75', () => {
    const t = sumStats([{ fireResist: 30, coldResist: 10 }, { fireResist: 40, allResist: 12 }, { lightningResist: 5 }]);
    const st = fightStats(10, none, wornCombat({ equippedTotals: t }));
    expect(st.resists).toEqual({ fire: 75, cold: 22, lightning: 17, arcane: 12 });
    expect(fightStats(10, none).resists).toEqual({ fire: 0, cold: 0, lightning: 0, arcane: 0 });
  });
});
