/**
 * td-synergy.spec.ts — the Seam-Cant and D2's synergies (docs/design/design-bible.md §4.0, §4.1): every spell has its
 * words built from the cant's roots and shapes; a synergy reads only the points bought in another skill, so zero
 * points give zero bonus, a fresh Warlock is unchanged, the bonus is capped, and a pair that feeds each other can't loop.
 */
import type { KeeperSkillTree } from '../../shared/keeper-look/keeper-look.model';
import { MAX_RANK, SKILLS, STARTER_RANKS, SYN_CAP, skillVars, synergies, type SkillId } from './td-skills';
import { boughtRanks, clampTree, effectiveRanks } from './td-tree';

const ROOTS = ['vael', 'osk', 'nyr', 'lum', 'hesk', 'thar', 'brann', 'ul'];
const SHAPES = ['sha', 'orum', 'dra', 'mur', 'ka', 'teth', 'vesh', 'un'];
const ALL = Object.keys(SKILLS) as SkillId[];

describe('td-skills: the Seam-Cant', () => {
  it('every active and aura speaks; each word is a root or a shape, and it opens with a root', () => {
    for (const id of ALL) {
      const sk = SKILLS[id];
      if (sk.kind === 'passive' && id !== 'ember-bolt') { expect(sk.words).withContext(id).toBeUndefined(); continue; }
      expect(sk.words).withContext(id).toMatch(/^[a-z]+( [a-z]+)*$/);
      const parts = sk.words!.split(' ');
      expect(ROOTS).withContext(id).toContain(parts[0]);
      for (const w of parts) expect([...ROOTS, ...SHAPES]).withContext(`${id}: ${w}`).toContain(w);
    }
    expect(SKILLS['hellfire-nova'].words).toBe('vael orum');
  });
  it('no two spells say the same thing', () => {
    const said = ALL.map(id => SKILLS[id].words).filter(Boolean);
    expect(new Set(said).size).toBe(said.length);
  });
});

describe('td-skills: synergies', () => {
  it('every synergy names another class skill, a modest per-rank %, never itself', () => {
    let n = 0;
    for (const id of ALL) for (const s of SKILLS[id].syn ?? []) {
      n++;
      expect(s.from).withContext(id).not.toBe(id);
      expect(SKILLS[s.from]).withContext(id).toBeDefined();
      expect(s.per).withContext(id).toBeGreaterThan(0);
      expect(s.per).withContext(id).toBeLessThanOrEqual(10);
    }
    expect(n).toBeGreaterThanOrEqual(15);
  });

  it('zero bought ranks give zero bonus: the numbers are exactly the plain rank numbers', () => {
    const none = Object.fromEntries(ALL.map(id => [id, 0])) as Record<SkillId, number>;
    for (const id of ALL) for (const r of [1, 5, MAX_RANK]) {
      expect(skillVars(id, r, none)).withContext(`${id}@${r}`).toEqual(skillVars(id, r));
      expect(skillVars(id, r, null)).withContext(`${id}@${r}`).toEqual(skillVars(id, r));
      for (const s of synergies(id, none)) expect(s.pct).withContext(id).toBe(0);
    }
  });

  it('a fresh Warlock (only the kit\'s free ranks) gets no synergy at all', () => {
    const tree: KeeperSkillTree = { spent: {}, free: [], at: 0 };
    const bought = boughtRanks(tree, 'warlock'), ranks = effectiveRanks(tree, 'warlock');
    for (const id of STARTER_RANKS.warlock) {
      expect(ranks[id]).withContext(id).toBe(1);
      expect(bought[id]).withContext(id).toBe(0);
      expect(skillVars(id, 1, bought)).withContext(id).toEqual(skillVars(id, 1));
    }
  });

  it('each bought rank in the source adds its % (Nova from Aura of Embers: +5% a rank)', () => {
    const base = skillVars('hellfire-nova', 1);
    expect(skillVars('hellfire-nova', 1, { 'aura-embers': 4 })).toEqual({ min: Math.round(base['min'] * 1.2), max: Math.round(base['max'] * 1.2), radius: base['radius'] });
    // A half rounds up, as the card shows it: 30 × 1.15 = 34.5 → 35.
    expect(skillVars('hellfire-nova', 1, { 'aura-embers': 3 })).toEqual({ min: 23, max: 35, radius: 3 });
    expect(synergies('hellfire-nova', { 'aura-embers': 4 })).toEqual([{ from: 'aura-embers', per: 5, what: 'dmg', ranks: 4, pct: 20 }]);
    // Ember Curse burns: its damage synergy lifts dps, not the weakening.
    const curse = skillVars('ember-curse', 1, { weaken: 2 });
    expect(curse['dps']).toBe(6);   // 5 × 1.10 = 5.5, whole
    expect(curse['weaken']).toBe(SKILLS['ember-curse'].vars['weaken']);
    // Two sources add up (Doom from Weaken and Ember Curse).
    expect(synergies('doom', { weaken: 3, 'ember-curse': 2 }).reduce((a, s) => a + s.pct, 0)).toBe(18 + 8);
  });

  it('the bonus is capped at +100% on a var however many points sit in the sources', () => {
    const maxed = Object.fromEntries(ALL.map(id => [id, MAX_RANK])) as Record<SkillId, number>;
    for (const id of ALL) {
      const plain = skillVars(id, 1), boosted = skillVars(id, 1, maxed);
      for (const k of Object.keys(plain)) {
        expect(boosted[k]).withContext(`${id}.${k}`).toBeGreaterThanOrEqual(plain[k]);
        expect(boosted[k]).withContext(`${id}.${k}`).toBeLessThanOrEqual(Math.ceil(plain[k] * (1 + SYN_CAP / 100)) + .1);
      }
    }
    // Meteor's two sources at 20 each would be +200%: it stops at double.
    expect(skillVars('meteor', 1, maxed)['min']).toBe(SKILLS.meteor.vars['min'] * 2);
  });

  it('can\'t loop: a mutual pair reads each other\'s points, never each other\'s bonus', () => {
    // Hellfire Nova ← Aura of Embers and Aura of Embers ← Hellfire Nova: points in Nova's own source don't change
    // Aura's numbers except through Nova's points, and raising Nova's synergy changes nothing about Aura's.
    const a = skillVars('aura-embers', 1, { 'hellfire-nova': 5 });
    const b = skillVars('aura-embers', 1, { 'hellfire-nova': 5, 'aura-embers': 20 });
    expect(b).toEqual(a);
    // A skill named as its own source would count nothing.
    expect(synergies('aura-embers', { 'aura-embers': 20 }).every(s => s.from !== 'aura-embers' || s.pct === 0)).toBeTrue();
    // Same inputs, same outputs, however often it is asked (no hidden state).
    expect(skillVars('aura-embers', 1, { 'hellfire-nova': 5 })).toEqual(a);
  });

  it('only points the clamped tree keeps count: a level too low to hold them gives nothing', () => {
    const tree: KeeperSkillTree = { spent: { 'aura-embers': 8 }, free: [], at: 0 };
    expect(boughtRanks(clampTree(tree, 'warlock', 30), 'warlock')['aura-embers']).toBe(8);
    expect(boughtRanks(clampTree(tree, 'warlock', 1), 'warlock')['aura-embers']).toBe(0);
    // A non-kit skill: its first point is a bought point.
    expect(boughtRanks(clampTree({ spent: { 'bone-storm': 1, 'corpse-burst': 1, 'bone-spear': 1 }, free: [], at: 0 }, 'warlock', 30), 'warlock')['bone-storm']).toBe(1);
  });
});
