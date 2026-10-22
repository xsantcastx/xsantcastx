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
import { UNIQUE_SHARE, rarityChances, uniqueShare } from '../../shared/loot/drop-tables';
import { MF_K, mfTowardUnique } from '../../shared/loot/magic-find-curve';
import { temperFailChance } from '../../shared/rpg/item-upgrade';
import { meleeBlow, weaponSwing } from './td-melee';
import { TWO_HAND_MULT } from '../../shared/rpg/item-hands';
import { ELEMENTS } from '../../shared/loot/damage.model';
import { HUD_I18N } from '../world/hud.i18n';
import { GEAR_KEYS, MEND_PER_SEC, outOfFightMend } from './td-engine';
import type { EngineOptions } from '../engine/engine.model';
import { DIFFICULTIES, DIFFICULTY_TIERS } from '../../shared/loot/difficulty.model';
import { LOOT_I18N } from '../../shared/loot/loot.i18n';
import { GRAVE_I18N } from '../../shared/grave-goods/grave-goods.i18n';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { RESIST_STAT, fightStats, wornCombat } from './td-skills';
import { AFFIX_FAMILIES, FAMILY_RULES, affixPoolFor, familyRolls, rollAffixes, type AffixFamily } from '../../shared/rpg/item-affixes';
import { OLD_ROLL_TWIN, VOCATIONS, oldRollTwins, statUse } from '../../shared/rpg/item-calling';
import { arrowBlow, type HeldWeapon } from './td-melee';
import { BEAST_DAMAGE_SHARE } from './td-thorn';
import type { Vocation } from '../../shared/keeper-look/keeper-look.model';

/** The number a card prints for a stat (formatStatValue: "+12%", "+0.4"), back to a number. */
const printed = (key: keyof ItemStats, n: number) => Number(formatStatValue(key, n).replace(/[+%]/g, ''));
/** The fight's numbers wearing exactly these stats (one piece), at a mid level, as a Warlock. */
const fightWith = (stats: ItemStats) => fightStats(30, undefined, wornCombat({ equippedTotals: sumStats([stats]) }));
const bare = fightWith({});
/** The fight's numbers for a calling wearing exactly these stats on one piece of `family` (its old rolls read as worn). */
const fightAs = (v: Vocation, stats: ItemStats, family: AffixFamily | null = 'jewel') =>
  fightStats(30, undefined, wornCombat({ equippedTotals: sumStats([stats]), equippedOldRolls: oldRollTwins([{ family, stats }]) }), v);
/** A weapon of `family` carrying these stats, as the swing reads it (side-scroller heldSwing). */
const heldOf = (family: AffixFamily, st: ItemStats): HeldWeapon =>
  ({ ...st, hands: 1, kind: family === 'bow' ? 'bow' : family === 'caster' ? 'caster' : 'melee' });
/** What a weapon's own damage adds to the calling's basic blow at a low (u = 0) or a top (u → 1) roll. */
const ownBlow = (v: Vocation, family: AffixFamily, st: ItemStats, top: boolean) => {
  const u = () => (top ? .99999 : 0), w = weaponSwing(heldOf(family, st));
  return v === 'thornstrider' ? arrowBlow(10, 10, u, w) - 10 : v === 'ashguard' ? meleeBlow(10, 10, 100, u, w) - 10 : 0;
};

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
  // §3.6: the fighters' twins (read as an Ashguard; the Thornstrider for Pierce) and the families' own.
  attackDamage: n => Math.round((fightAs('ashguard', { attackDamage: n }).power / fightAs('ashguard', {}).power - 1) * 1000) / 10,
  attackSpeed: n => Math.round(fightAs('ashguard', { attackSpeed: n }).castSpeed * 1000) / 10,
  lifeLeech: n => Math.round(fightAs('ashguard', { lifeLeech: n }).leech * 1000) / 10,
  pierceChance: n => fightAs('thornstrider', { pierceChance: n }).pierce,
  blockChance: n => Math.round(fightAs('warlock', { blockChance: n }).block * 1000) / 10,
  skillRanks: n => fightAs('warlock', { skillRanks: n }).ranks,
  // A sword's own damage on the Ashguard's blow: the low end at a bottom roll, the high end at a top one.
  minDamage: n => ownBlow('ashguard', 'martial', { minDamage: n, maxDamage: n + 5 }, false),
  maxDamage: n => ownBlow('ashguard', 'martial', { minDamage: 0, maxDamage: n }, true),
};

describe('td-truth gear: one stat, one piece — the card\'s number is what moves', () => {
  it('every item stat key says where it is real', () => {
    for (const key of ITEM_STAT_KEYS) expect(LIVES[key]).withContext(key).toBeDefined();
  });
  for (const key of ITEM_STAT_KEYS) {
    it(`${key}`, () => {
      // Small enough to sit under every cap (resists 75, Spell Damage 150, Cast/Crit/Move 40, Ward's 3 points, +3 Spells).
      for (const n of key === 'ward' ? [1, 2] : key === 'goldPerSec' ? [4, 30] : key === 'skillRanks' ? [1, 2, 3] : [2, 7, 12]) {
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

describe('td-truth gear: Magic Find is a rung-by-rung curve, and the C sheet quotes it', () => {
  const lift = (tier: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'singular', mf: number) =>
    (rarityChances(30, mf, 0, true)[tier] / rarityChances(30, 0, 0, true)[tier] - 1) * 100;

  it('the "toward uniques" line on the sheet is what the roll really does: the legendary rung and the unique share lean by it', () => {
    for (const mf of [10, 40, 100, 300, 1000]) {
      const shown = mfTowardUnique(mf);
      expect(Math.abs(lift('legendary', mf) - shown)).withContext(`legendary @${mf}`).toBeLessThanOrEqual(.06);
      expect(Math.abs((uniqueShare({ magicFind: mf }) / UNIQUE_SHARE - 1) * 100 - shown)).withContext(`unique share @${mf}`).toBeLessThanOrEqual(.06);
    }
    expect(HUD_I18N['play.td.total.mfu']).toBeDefined();
    expect(mfTowardUnique(0)).toBe(0);
  });

  it('each rung leans by its own curve: linear magic, then K 600 / 500 / 250 / 150, never past K', () => {
    for (const mf of [25, 100, 300, 1000]) {
      if (mf <= 100) expect(lift('uncommon', mf)).withContext(`uncommon @${mf}`).toBeCloseTo(mf, 6); // linear until its chance caps at 0.9
      for (const tier of ['rare', 'epic', 'legendary', 'mythic', 'singular'] as const) {
        const k = MF_K[tier];
        expect(lift(tier, mf)).withContext(`${tier} @${mf}`).toBeCloseTo(mf * k / (mf + k), 6);
        expect(lift(tier, mf)).toBeLessThan(k);
      }
    }
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

describe('td-truth gear: the difficulty tiers do what their blurbs say (docs/design/loot-and-combat.md §8)', () => {
  const numbers = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  /** A creature risen on `tier`, and what one bite of `n` takes from a Keeper with no Defense. */
  function onTier(tier: keyof typeof DIFFICULTIES, n: number) {
    const keeper = { x: 0, y: 0, face: 1 }, hurt: number[] = [], kills: { hp: number }[] = [];
    const host: MobHost = {
      options: { onKill: (e: { hp: number }) => { kills.push(e); } } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'truth', player: () => keeper,
      hurtPlayer: k => { hurt.push(k); }, healPlayer: () => undefined, swung: () => undefined, playerHp: () => 1e6,
    };
    const sys = new MobSystem(host);
    sys.setTier(DIFFICULTIES[tier]); sys.defense = 0; sys.resists = {};
    const def = { ...MOBS['ash-wolf'], hp: 200, sight: 999, dmg: [n, n] as [number, number], rate: 999, speed: 0 };
    const m = sys.place('t', def, 10, 0);
    m.cd = 0; m.wait = 1e9;
    const life = m.hp;
    for (let i = 0; i < 50 && !hurt.length; i++) sys.update(.02);
    sys.smite(m);
    return { life, bite: hurt[0] ?? 0, xpHp: kills[0]?.hp ?? NaN };
  }

  for (const tier of DIFFICULTY_TIERS) {
    const d = DIFFICULTIES[tier];
    it(`${tier}: creatures rise with ×${d.hp} life and strike ×${d.damage}; XP still follows their own life`, () => {
      const r = onTier(tier, 20);
      expect(r.life).toBe(Math.round(200 * d.hp));
      expect(r.bite).toBe(Math.round(20 * d.damage));
      expect(r.xpHp).toBe(200);
    });
    it(`${tier}: the Keeper's resists lose ${d.resistPenalty} before the 75 cap`, () => {
      const at = (fire: number) => fightStats(30, undefined, wornCombat({ equippedTotals: sumStats([{ fireResist: fire }]) }), 'warlock', d.resistPenalty).resists.fire;
      expect(at(50)).toBe(Math.max(-100, Math.min(75, 50 - d.resistPenalty)));
      expect(at(200)).toBe(Math.min(75, 200 - d.resistPenalty));
    });
    it(`${tier}: its blurb (en and es) quotes only its own numbers`, () => {
      const b = LOOT_I18N['loot.tierBlurb.' + tier];
      const have = [d.hp, d.damage, d.resistPenalty, Math.round((d.itemChance - 1) * 100)];
      for (const text of [b.en, b.es]) for (const n of numbers(text)) expect(have).withContext(`${tier}: "${text}" says ${n}`).toContain(n);
      expect(numbers(b.es)).toEqual(numbers(b.en));
    });
  }
});

describe('td-truth gear: a Grave-cold drain is a real price out of the fight too', () => {
  it('the out-of-fight mend stops while a drain outweighs regeneration, as the curse card says', () => {
    expect(outOfFightMend(0, 5)).toBe(MEND_PER_SEC);
    expect(outOfFightMend(.5, 5)).toBe(MEND_PER_SEC);
    expect(outOfFightMend(-1.4, 5)).toBe(0);
    expect(outOfFightMend(0, 3)).toBe(0);
    expect(GRAVE_I18N['grave.tip.drain'].en).toContain('do not mend out of the fight');
  });
});

describe('td-truth gear: two hands — the card\'s "% harder" is what the basic attack does (shared/rpg/item-hands.ts)', () => {
  const pct = Math.round((TWO_HAND_MULT - 1) * 100);
  const sysWith = (w: HeldWeapon | null) => {
    const keeper = { x: 0, y: 0, face: 1 };
    const host: MobHost = {
      options: { onKill: () => undefined } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'truth', player: () => keeper,
      hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined, playerHp: () => 1e6,
    };
    const sys = new MobSystem(host);
    sys.weaponSwing = weaponSwing(w);
    return sys;
  };
  it('the card names the multiplier the fight uses, in both languages', () => {
    const line = HUD_I18N['play.tip.hands.twoNote'];
    expect(line.en).toContain('{{pct}}%');
    expect(line.es).toContain('{{pct}}%');
    expect(HUD_I18N['play.td.tree.power.hands'].en).toContain('{{pct}}%');
    expect(pct).toBe(20);
  });
  it('the Watch Blade\'s swing: a two-handed weapon lands it that much harder, a one-handed one not at all', () => {
    const roll = () => 0;
    expect(meleeBlow(50, 50, 100, roll, weaponSwing({ strikePower: 1, hands: 2 }))).toBe(Math.round(50 * (1 + pct / 100)));
    expect(meleeBlow(50, 50, 100, roll, weaponSwing({ strikePower: 1, hands: 1 }))).toBe(50);
  });
  it('the Thorn Shot: a two-handed bow that much harder, a crossbow plain, the kit bow (nothing worn) as the book shows', () => {
    expect(sysWith({ strikePower: 1, hands: 2 }).shotBlow(50, 50, () => 0)).toBe(Math.round(50 * (1 + pct / 100)));
    expect(sysWith({ strikePower: 1, hands: 1 }).shotBlow(50, 50, () => 0)).toBe(50);
    expect(sysWith(null).shotBlow(50, 50, () => 0)).toBe(50);
    // Strike's flat is the blade's alone; a bow's own +min–max is what rides the arrow (§3.6).
    expect(sysWith({ strikePower: 3, hands: 1 }).shotBlow(50, 50, () => 0)).toBe(50);
    expect(sysWith({ minDamage: 4, maxDamage: 9, hands: 1, kind: 'bow' } as never).shotBlow(50, 50, () => 0)).toBe(54);
  });
  it('the Ember Bolt and the Kindle: a two-handed staff lifts them that much; bare hands never weaken a spell', () => {
    expect(sysWith({ strikePower: 1, hands: 2 }).handMult).toBe(1 + pct / 100);
    expect(sysWith({ strikePower: 1, hands: 1 }).handMult).toBe(1);
    expect(sysWith(null).handMult).toBe(1);
  });
});

describe('td-truth gear: two damage families — every family\'s every key, read by the callings it is for (§3.6)', () => {
  /**
   * What `key` = n on one piece of `family` moves for calling `v`, in the card's units — through the real path
   * (wornCombat with the piece's old rolls, fightStats, the swing). `read` is the key the fight reads it as.
   */
  function moved(key: keyof ItemStats, n: number, v: Vocation, family: AffixFamily): { read: keyof ItemStats; by: number } {
    const st: ItemStats = key === 'maxDamage' ? { minDamage: 0, maxDamage: n } : key === 'minDamage' ? { minDamage: n, maxDamage: n + 5 } : { [key]: n };
    const f = fightAs(v, st, family), b = fightAs(v, {}, family);
    const pct = (x: number) => Math.round(x * 1000) / 10;
    switch (key) {
      case 'spellDamage': case 'attackDamage': return { read: f.family === 'spell' ? 'spellDamage' : 'attackDamage', by: pct(f.power / b.power - 1) };
      case 'castSpeed': case 'attackSpeed': return { read: f.family === 'spell' ? 'castSpeed' : 'attackSpeed', by: pct(f.castSpeed - b.castSpeed) };
      case 'skillRanks': return { read: key, by: f.ranks - b.ranks };
      case 'lifeLeech': return { read: key, by: pct(f.leech - b.leech) };
      case 'pierceChance': return { read: key, by: f.pierce - b.pierce };
      case 'blockChance': return { read: key, by: pct(f.block - b.block) };
      case 'critChance': return { read: key, by: pct(f.crit - b.crit) };
      case 'minDamage': return { read: key, by: ownBlow(v, family, st, false) };
      case 'maxDamage': return { read: key, by: ownBlow(v, family, st, true) };
      default: return { read: key, by: Math.abs(LIVES[key](n) - n) <= .11 ? n : NaN };
    }
  }
  const N = 7;

  for (const family of AFFIX_FAMILIES) {
    const keys = [...affixPoolFor({ family, slot: null }), ...(FAMILY_RULES[family].pool.includes('minDamage') ? ['maxDamage' as const] : [])];
    // Keys a family rolls only in one slot (boots' Move Speed, gloves' speeds) count too.
    for (const k of Object.keys(FAMILY_RULES[family].only ?? {}) as (keyof ItemStats)[]) if (!keys.includes(k as never)) keys.push(k as never);
    it(`${family}: each key moves the stat the card says for the callings it is for, and nothing for the rest`, () => {
      for (const key of keys) for (const v of VOCATIONS) {
        const n = key === 'skillRanks' ? 2 : N, use = statUse(key, family, v), m = moved(key, n, v, family);
        if (use === 'used') expect(m.by).withContext(`${family} ${key} → ${v}`).toBeCloseTo(n, 1);
        else if (use === 'unused') expect(m.by).withContext(`${family} ${key} → ${v} (unused)`).toBeCloseTo(0, 5);
        else fail(`${family} ${key} → ${v}: a new roll can never be an old one`);
      }
    });
  }

  it('the old rolls: Spell Damage on a sword counts — as Spell Damage for a caster, as Martial Damage for a fighter (no re-roll)', () => {
    const sword = { spellDamage: 12 };
    for (const v of VOCATIONS) {
      const p = fightAs(v, sword, 'martial').power / fightAs(v, {}, 'martial').power;
      expect(Math.round((p - 1) * 1000) / 10).withContext(v).toBe(12);
      expect(statUse('spellDamage', 'martial', v)).toBe(v === 'warlock' || v === 'lanternwright' ? 'used' : 'old');
    }
    // An old pair of gloves' Cast Speed is a fighter's Attack Speed the same way… on a family that can no longer roll it.
    expect(OLD_ROLL_TWIN.castSpeed).toBe('attackSpeed');
    expect(Math.round(fightAs('ashguard', { castSpeed: 9 }, 'shield').castSpeed * 1000) / 10).toBe(9);
    // …and never counts twice: a caster reads its own family only.
    expect(fightAs('warlock', { spellDamage: 12 }, 'martial').power).toBeCloseTo(fightAs('warlock', { spellDamage: 12 }, 'caster').power, 9);
  });

  it('a ring\'s Spell Damage is the casters\' alone (a new-rule family), and a new sword never rolls it', () => {
    expect(fightAs('ashguard', { spellDamage: 12 }, 'jewel').power).toBeCloseTo(fightAs('ashguard', {}, 'jewel').power, 9);
    expect(statUse('spellDamage', 'jewel', 'ashguard')).toBe('unused');
    for (const f of ['martial', 'bow', 'quiver', 'shield', 'armour'] as AffixFamily[]) {
      expect(familyRolls(f, 'spellDamage')).withContext(f).toBeFalse();
      for (let seed = 1; seed <= 40; seed++) {
        let a = seed;
        const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        const slot = f === 'martial' || f === 'bow' ? 'weapon' : f === 'armour' ? 'head' : f === 'jewel' ? 'trinket' : 'off-hand';
        expect(rollAffixes({ slot, affixFamily: f }, 'singular', 60, rng).stats.spellDamage).withContext(f).toBeUndefined();
      }
    }
  });

  it('rings and amulets roll both families (Spell and Martial Damage, both speeds), lower than a weapon\'s', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      let a = seed;
      const rng = () => { a = (a * 48271) % 2147483647; return a / 2147483647; };
      for (const k of Object.keys(rollAffixes({ slot: 'trinket' }, 'legendary', 30, rng).stats)) seen.add(k);
    }
    for (const k of ['spellDamage', 'attackDamage', 'castSpeed', 'attackSpeed', 'goldFind', 'magicFind', 'life', 'mana', 'allResist']) expect(seen).withContext(k).toContain(k);
    expect(FAMILY_RULES.jewel.scale?.spellDamage).toBeLessThan(1);
    expect(FAMILY_RULES.jewel.scale?.attackDamage).toBeLessThan(1);
  });
});

describe('td-truth gear: the Thornstrider\'s beast bites by his Martial Damage (§3.6)', () => {
  it('a worn Martial Damage lifts the bite by BEAST_DAMAGE_SHARE of it; a caster\'s beast is untouched', () => {
    const bite = (v: 'thornstrider' | 'warlock', pct: number) => {
      const keeper = { x: 0, y: 0, face: 1 };
      const host: MobHost = {
        options: { onKill: () => undefined } as unknown as EngineOptions,
        walkable: () => true, levelId: () => 'truth', player: () => keeper,
        hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined, playerHp: () => 1e6,
      };
      const sys = new MobSystem(host);
      sys.vocation = v; sys.keeperLevel = 1; sys.damagePct = pct;
      const m = sys.place('t', { ...MOBS['ash-wolf'], hp: 1e6, sight: 0, speed: 0 }, 10, 0);
      const before = m.hp;
      sys.petBite(m, 100, 1);
      return before - m.hp;
    };
    expect(bite('thornstrider', 40) / bite('thornstrider', 0)).toBeCloseTo(1 + .4 * BEAST_DAMAGE_SHARE, 2);
    expect(bite('warlock', 40)).toBe(bite('warlock', 0));
  });
});
