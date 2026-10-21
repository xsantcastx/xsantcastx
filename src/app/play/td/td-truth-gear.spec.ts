/**
 * td-truth-gear.spec.ts — the consistency harness for gear (owner 2026-10-21: "spells and items and stats are actually
 * real consistent and working"). Companion to td-truth.spec.ts (the skills).
 *
 *   1. every item stat key: wear ONE piece carrying only that stat at the number its card prints, and the place that
 *      stat lives (fightStats for the fight's, the Gold pile, the loot roll, Hunting XP, the swing, the temper) moves
 *      by exactly that number. A key with no entry here fails: a new stat must say where it is real.
 *   2. the item sets and the boss uniques: every number their lines print is a number their data carries, and every
 *      field of their data is read by the fight (td-mobs / td-engine) or the loot roll.
 *   3. the engine re-applies a build when any worn stat it reads changes (td-engine GEAR_KEYS).
 */
import { BOSS_UNIQUES, NO_RELICS, relicTotals, type RelicSig } from '../../shared/rpg/boss-uniques';
import { ITEM_SETS, addSetBonuses, setSigIds, setSigOf } from '../../shared/rpg/set-items';
import { ITEM_STAT_KEYS, formatStatValue, gearXp, sumStats, totalGoldFind, wornGoldFind, type ItemStats } from '../../shared/rpg/item.model';
import { goldFindPile } from '../../shared/economy/economy-curve';
import { rarityChances } from '../../shared/loot/drop-tables';
import { temperFailChance } from '../../shared/rpg/item-upgrade';
import { weaponSwing } from './td-melee';
import { ELEMENTS } from '../../shared/loot/damage.model';
import { HUD_I18N } from '../world/hud.i18n';
import { GEAR_KEYS } from './td-engine';
import { RESIST_STAT, fightStats, wornCombat } from './td-skills';

/** The number a card prints for a stat (formatStatValue: "+12%", "+0.4"), back to a number. */
const printed = (key: keyof ItemStats, n: number) => Number(formatStatValue(key, n).replace(/[+%]/g, ''));
/** The fight's numbers wearing exactly these stats (one piece), at a mid level, as a Warlock. */
const fightWith = (stats: ItemStats) => fightStats(30, undefined, wornCombat({ equippedTotals: sumStats([stats]) }));
const bare = fightWith({});

/**
 * For each stat: given a piece carrying `n` of it, what moved where it lives — in the stat's own units, so it must
 * equal the card's printed number.
 */
const LIVES: Record<keyof ItemStats, (n: number) => number> = {
  life: n => fightWith({ life: n }).maxHp - bare.maxHp,
  mana: n => fightWith({ mana: n }).maxMana - bare.maxMana,
  defense: n => fightWith({ defense: n }).defense - bare.defense,
  spellDamage: n => Math.round((fightWith({ spellDamage: n }).power / bare.power - 1) * 1000) / 10,
  castSpeed: n => Math.round(fightWith({ castSpeed: n }).castSpeed * 1000) / 10,
  moveSpeed: n => Math.round((fightWith({ moveSpeed: n }).moveHaste - bare.moveHaste) * 1000) / 10,
  critChance: n => Math.round(fightWith({ critChance: n }).crit * 1000) / 10,
  lifeRegen: n => fightWith({ lifeRegen: n }).lifeRegen - bare.lifeRegen,
  manaRegen: n => Math.round((fightWith({ manaRegen: n }).regen - bare.regen) * 100) / 100,
  fireResist: n => fightWith({ fireResist: n }).resists.fire,
  coldResist: n => fightWith({ coldResist: n }).resists.cold,
  lightningResist: n => fightWith({ lightningResist: n }).resists.lightning,
  arcaneResist: n => fightWith({ arcaneResist: n }).resists.arcane,
  allResist: n => { const r = fightWith({ allResist: n }).resists; return ELEMENTS.every(el => r[el] === r.fire) ? r.fire : NaN; },
  // The finds: the Gold pile (economy-curve), the loot roll's Magic Find (drop-tables), Hunting XP (item.model gearXp).
  goldFind: n => Math.round((goldFindPile(100000, totalGoldFind(sumStats([{ goldFind: n }]))) / 100000 - 1) * 1000) / 10,
  goldPerSec: n => Math.round((goldFindPile(100000, wornGoldFind([{ goldPerSec: n }])) / 100000 - 1) * 1000) / 10,
  magicFind: n => Math.round((rarityChances(30, n, 0).uncommon / rarityChances(30, 0, 0).uncommon - 1) * 1000) / 10,
  xpBonus: n => gearXp(100000, n) / 1000,
  // Not fight stats; their card says what they do: Strike on a weapon is +3 a blow a point past the first (td-melee),
  // Ward turns 10% of a temper's fail chance aside a point (item-upgrade).
  strikePower: n => (weaponSwing({ strikePower: 1 + n }).flat - weaponSwing({ strikePower: 1 }).flat) / 3,
  ward: n => Math.round((1 - temperFailChance(.5, n) / .5) * 10 * 100) / 100,
};

describe('td-truth gear: one stat, one piece — the card\'s number is what moves', () => {
  it('every item stat key says where it is real', () => {
    for (const key of ITEM_STAT_KEYS) expect(LIVES[key]).withContext(key).toBeDefined();
  });
  for (const key of ITEM_STAT_KEYS) {
    it(`${key}`, () => {
      // Small enough to sit under every cap (resists 75, Spell Damage 150, Cast/Crit/Move 40, Ward's 3 points).
      for (const n of key === 'ward' ? [1, 2] : key === 'goldPerSec' ? [4, 30] : [2, 7, 12]) {
        const card = key === 'goldPerSec' ? printed(key, n) : n;
        expect(Math.abs(LIVES[key](n) - card)).withContext(`${key} ${n}: card ${formatStatValue(key, n)}`).toBeLessThanOrEqual(.11);
      }
    });
  }
  it('two old Gold/sec cards pay what they say together (each read as its card shows it)', () => {
    const one = printed('goldPerSec', 100);
    expect(wornGoldFind([{ goldPerSec: 100 }, { goldPerSec: 100 }])).toBeCloseTo(2 * one, 1);
  });
  it('a curse that takes resist away is a real price even with none worn (the element bites harder)', () => {
    expect(fightWith({ allResist: -15 }).resists.fire).toBe(-15);
  });
});

describe('td-truth gear: the sets and the boss uniques say what their data does', () => {
  /** Every number a line prints ("2 tiles", "+15%", "3×"), word-numbers aside. */
  const numbers = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  const flat = (o: unknown): number[] => typeof o === 'number' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : [];

  it('each boss unique\'s line (the card and the Spellbook\'s "Used for") quotes only its signature\'s numbers', () => {
    for (const u of BOSS_UNIQUES) {
      const have = flat(u.sig);
      for (const text of [u.passive.text, HUD_I18N['play.relic.sig.' + u.id]?.en ?? '']) {
        for (const n of numbers(text)) expect(have).withContext(`${u.id}: "${text}" says ${n}`).toContain(n);
      }
      expect(HUD_I18N['play.relic.sig.' + u.id]).withContext(u.id).toBeDefined();
    }
  });

  it('each set tier\'s line quotes only its own numbers', () => {
    for (const set of ITEM_SETS) for (const b of set.bonuses) {
      const text = HUD_I18N[`play.set.bonus.${set.id}.${b.at}`]?.en;
      expect(text).withContext(`${set.id}.${b.at}`).toBeDefined();
      const have = [...flat(b.stats), ...flat(b.sig), ...(b.defensePct ? [b.defensePct] : [])];
      for (const n of numbers(text)) expect(have).withContext(`${set.id}.${b.at}: "${text}" says ${n}`).toContain(n);
    }
  });

  it('every set tier reaches the fight: its stats through wornCombat, its signature through relicTotals', () => {
    for (const set of ITEM_SETS) for (const b of set.bonuses) {
      const worn = set.pieces.slice(0, b.at);
      if (b.stats) for (const [k, n] of Object.entries(b.stats) as [keyof ItemStats, number][]) {
        expect((addSetBonuses({}, worn)[k] ?? 0)).withContext(`${set.id}.${b.at} ${k}`).toBeGreaterThanOrEqual(n);
      }
      if (b.defensePct) expect(addSetBonuses({ defense: 100 }, worn).defense).withContext(`${set.id}.${b.at}`).toBe(100 + b.defensePct);
      if (b.sig) {
        const got = relicTotals(setSigIds(worn), setSigOf), sig: RelicSig = b.sig;
        for (const k of Object.keys(sig) as (keyof RelicSig)[]) expect(got[k]).withContext(`${set.id}.${b.at} ${k}`).not.toEqual(NO_RELICS[k]);
      }
    }
  });

  it('the engine re-applies the build when any stat the fight reads changes', () => {
    const read = Object.keys(wornCombat({ equippedTotals: sumStats([]) })) as (keyof ItemStats)[];
    for (const k of read) expect(GEAR_KEYS).withContext(k).toContain(k);
    // Each resist the fight reads is one of the worn keys.
    for (const el of ELEMENTS) expect(read).toContain(RESIST_STAT[el]);
  });
});
