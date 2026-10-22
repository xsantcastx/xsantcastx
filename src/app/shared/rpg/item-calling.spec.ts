/**
 * item-calling.spec.ts — every item belongs to its family, and every calling reads its own (docs/design/loot-and-combat.md
 * §3.6; owner 2026-10-22: "only staffs or mage items related should do [spell damage] … consistency in items").
 */
import { ITEM_DEFINITIONS, mintEquipment, rollsAffixes } from './item-definition';
import { itemAffixFamily, itemBase } from './item-base';
import { AFFIX_FAMILIES, FAMILY_RULES, affixFamilyOf, affixPoolFor, familyRolls, type AffixFamily } from './item-affixes';
import { CASTERS, FAMILY_FAVOURED, FIGHTERS, VOCATIONS, damageFamilyOf, oldRollTwins, statUse } from './item-calling';
import { BOSS_UNIQUES } from './boss-uniques';
import { CLASS_SKILLS, fightStats } from '../../play/td/td-skills';
import type { SkillId } from '../../play/td/td-skills';
import type { GearBase } from '../art/gear-icons';

/** What the icon painter's base says a weapon or off-hand is, as a family. */
const BASE_FAMILY: Partial<Record<GearBase, AffixFamily>> = {
  staff: 'caster', wand: 'caster', bow: 'bow', crossbow: 'bow', shield: 'shield',
  sword: 'martial', greatsword: 'martial', axe: 'martial', mace: 'martial', hammer: 'martial', spear: 'martial', dagger: 'martial',
};
const LEGACY = new Set(['goldFind', 'goldPerSec', 'strikePower', 'ward', 'magicFind', 'xpBonus']);
const gear = ITEM_DEFINITIONS.filter(rollsAffixes);

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('item-calling: every piece rolls in its family (§3.6)', () => {
  it('a weapon\'s or off-hand\'s family agrees with what its icon is drawn as', () => {
    for (const def of gear.filter(d => d.slot === 'weapon' || d.slot === 'off-hand')) {
      const base = itemBase({ definitionId: def.id, name: def.name, type: def.type });
      const family = affixFamilyOf(def)!;
      if (def.slot === 'off-hand') {
        // An off-hand is a shield, a quiver, or a caster's focus (an orb, a tome, a lantern, a mirror…).
        if (base === 'shield') expect(family).withContext(def.id).toBe('shield');
        else expect(['focus', 'quiver']).withContext(def.id).toContain(family);
      } else if (base && BASE_FAMILY[base]) {
        expect(family).withContext(`${def.id} (${base})`).toBe(BASE_FAMILY[base]!);
      }
    }
  });

  it('each definition\'s authored keys are keys its family rolls (no bow with Spell Damage, no staff with Attack Speed)', () => {
    for (const def of gear) {
      const family = affixFamilyOf(def);
      for (const k of def.rollKeys) if (!LEGACY.has(k)) expect(familyRolls(family, k)).withContext(`${def.id} (${family}) authors ${k}`).toBeTrue();
    }
  });

  it('a fresh mint of every definition rolls only its family\'s keys', () => {
    for (const def of gear) {
      const family = affixFamilyOf(def)!;
      for (let seed = 1; seed <= 6; seed++) {
        const item = mintEquipment(def.id, 'mythic', seeded(seed), undefined, undefined, 40)!;
        for (const k of Object.keys(item.stats)) expect(familyRolls(family, k)).withContext(`${def.id} rolled ${k}`).toBeTrue();
        expect(itemAffixFamily(item)).toBe(family);
      }
    }
  });

  it('the families\' pools: casters spell, fighters arms, wards on shields and armour, rings either', () => {
    const pool = (f: AffixFamily) => affixPoolFor({ family: f, slot: f === 'armour' ? 'hands' : null });
    for (const f of ['caster', 'focus'] as AffixFamily[]) {
      expect(pool(f)).toContain('spellDamage'); expect(pool(f)).toContain('castSpeed');
      for (const k of ['attackDamage', 'attackSpeed', 'minDamage', 'lifeLeech', 'pierceChance'] as const) expect(pool(f)).withContext(`${f} ${k}`).not.toContain(k);
    }
    for (const f of ['martial', 'bow'] as AffixFamily[]) {
      for (const k of ['attackDamage', 'attackSpeed', 'minDamage', 'critChance'] as const) expect(pool(f)).withContext(`${f} ${k}`).toContain(k);
      for (const k of ['spellDamage', 'castSpeed', 'skillRanks'] as const) expect(pool(f)).withContext(`${f} ${k}`).not.toContain(k);
    }
    expect(pool('martial')).toContain('lifeLeech');
    expect(pool('bow')).toContain('pierceChance');
    expect(pool('caster')).toContain('skillRanks');
    expect(pool('quiver')).toContain('attackDamage'); expect(pool('quiver')).toContain('pierceChance');
    expect(pool('shield')).toContain('blockChance'); expect(pool('shield')).not.toContain('spellDamage');
    expect(pool('armour')).not.toContain('spellDamage'); expect(pool('armour')).not.toContain('attackDamage');
    expect(pool('jewel')).toContain('spellDamage'); expect(pool('jewel')).toContain('attackDamage');
    expect(FAMILY_RULES.caster.implicit).toBe('spellDamage');
    expect(FAMILY_RULES.martial.implicit).toBe('minDamage');
    expect(FAMILY_RULES.bow.implicit).toBe('minDamage');
  });

  it('every family is favoured by the callings that use its headline (or by all, for armour and rings)', () => {
    for (const f of AFFIX_FAMILIES) {
      const who = FAMILY_FAVOURED[f];
      if (!who.length) continue;
      for (const v of who) expect(statUse(FAMILY_RULES[f].implicit, f, v)).withContext(`${f} → ${v}`).toBe('used');
    }
  });

  it('a boss unique\'s named skills belong to a calling its piece is for', () => {
    const owner = (id: string) => VOCATIONS.filter(v => CLASS_SKILLS[v].includes(id as SkillId));
    for (const u of BOSS_UNIQUES) {
      const family = affixFamilyOf({ id: u.id, name: u.name, slot: u.slot })!;
      const favoured = FAMILY_FAVOURED[family];
      const skills = [...Object.keys(u.sig?.ranks ?? {}), ...Object.keys(u.sig?.cdCut ?? {})].filter(s => !['light', 'seek', 'waygate'].includes(s));
      for (const s of skills) if (favoured.length) expect(owner(s).some(v => favoured.includes(v))).withContext(`${u.id} (${family}) names ${s}`).toBeTrue();
    }
  });
});

describe('item-calling: each calling reads its own damage family (td-skills fightStats)', () => {
  it('casters read Spell Damage and Cast Speed, fighters Martial Damage and Attack Speed — never the other', () => {
    for (const v of VOCATIONS) {
      const bare = fightStats(30, undefined, {}, v);
      const sd = fightStats(30, undefined, { spellDamage: 20, castSpeed: 10 }, v);
      const ad = fightStats(30, undefined, { attackDamage: 20, attackSpeed: 10 }, v);
      const caster = CASTERS.includes(v);
      expect(damageFamilyOf(v)).toBe(caster ? 'spell' : 'martial');
      expect(sd.power / bare.power).withContext(`${v} spell`).toBeCloseTo(caster ? 1.2 : 1, 9);
      expect(ad.power / bare.power).withContext(`${v} arms`).toBeCloseTo(caster ? 1 : 1.2, 9);
      expect(sd.castSpeed).withContext(`${v} cast`).toBeCloseTo(caster ? .1 : 0, 9);
      expect(ad.castSpeed).withContext(`${v} attack`).toBeCloseTo(caster ? 0 : .1, 9);
    }
    expect([...CASTERS, ...FIGHTERS].sort()).toEqual([...VOCATIONS].sort());
  });

  it('Life Steal is a fighter\'s, Pierce the Thornstrider\'s, +Spells a caster\'s, Block everyone\'s', () => {
    for (const v of VOCATIONS) {
      const f = fightStats(30, undefined, { lifeLeech: 5, pierceChance: 10, skillRanks: 2, blockChance: 12 }, v);
      expect(f.leech).withContext(v).toBeCloseTo(FIGHTERS.includes(v) ? .05 : 0, 9);
      expect(f.pierce).withContext(v).toBe(v === 'thornstrider' ? 10 : 0);
      expect(f.ranks).withContext(v).toBe(CASTERS.includes(v) ? 2 : 0);
      expect(f.block).withContext(v).toBeCloseTo(.12, 9);
    }
  });
});

describe('item-calling: old rolls are read, never rewritten', () => {
  it('Spell Damage / Cast Speed on a family that can no longer roll them become the fighters\' twins', () => {
    expect(oldRollTwins([{ family: 'martial', stats: { spellDamage: 18 } }])).toEqual({ attackDamage: 18, attackSpeed: 0 });
    expect(oldRollTwins([{ family: 'armour', stats: { spellDamage: 5 } }, { family: 'bow', stats: { spellDamage: 7 } }])).toEqual({ attackDamage: 12, attackSpeed: 0 });
    expect(oldRollTwins([{ family: 'shield', stats: { castSpeed: 6 } }])).toEqual({ attackDamage: 0, attackSpeed: 6 });
    // New-rule families keep their numbers for the casters.
    expect(oldRollTwins([{ family: 'jewel', stats: { spellDamage: 9, castSpeed: 4 } }, { family: 'caster', stats: { spellDamage: 20 } }])).toEqual({ attackDamage: 0, attackSpeed: 0 });
    // An unknown family (a row with no definition) is read as old.
    expect(oldRollTwins([{ family: null, stats: { spellDamage: 3 } }]).attackDamage).toBe(3);
  });

  it('the card marks an old roll for a fighter and keeps it plain for a caster', () => {
    expect(statUse('spellDamage', 'martial', 'ashguard')).toBe('old');
    expect(statUse('spellDamage', 'martial', 'warlock')).toBe('used');
    expect(statUse('spellDamage', 'jewel', 'thornstrider')).toBe('unused');
    expect(statUse('attackDamage', 'jewel', 'lanternwright')).toBe('unused');
    expect(statUse('minDamage', 'bow', 'ashguard')).toBe('unused');
    expect(statUse('minDamage', 'bow', 'thornstrider')).toBe('used');
    expect(statUse('minDamage', 'martial', 'ashguard')).toBe('used');
  });
});
