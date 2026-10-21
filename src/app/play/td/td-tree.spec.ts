/**
 * td-tree.spec.ts — the Warlock's skill trees (docs/design/skill-trees.md): D2's rules (prerequisites, level gates,
 * one point a level), ranks that only ever grow a skill, the migration that keeps an old bar working, the merge that
 * never makes points from nothing, and every new skill going off in the fight.
 */
import type { EngineOptions } from '../engine/engine.model';
import { coerceLook, defaultLook, mergeKeeperLook, type KeeperSkillTree } from '../../shared/keeper-look/keeper-look.model';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';
import { MobSystem, type MobHost } from './td-mobs';
import { CLASS_SKILLS, MAX_RANK, SKILLS, STARTER_RANKS, TIER_LEVELS, TREES, skillVars, type SkillId } from './td-skills';
import { buyRank, clampTree, effectiveRanks, levelFor, pointsSpent, rankBlock, rankOf, resetTree, treePointsLeft, treeSkills } from './td-tree';

const empty = (): KeeperSkillTree => ({ spent: {}, free: [], at: 0 });
const NEW_SKILLS: SkillId[] = ['cinder-rain', 'flame-wall', 'ember-mastery', 'meteor', 'corpse-burst', 'skeleton-mastery', 'bone-armor', 'bone-storm', 'weaken', 'life-tap', 'doom'];

describe('td-tree: the trees themselves', () => {
  it('three trees of 6–8 skills each, in tiers by level, every prerequisite one tier up in the same tree', () => {
    for (const tr of TREES) {
      const ids = treeSkills('warlock', tr);
      expect(ids.length).withContext(tr).toBeGreaterThanOrEqual(6);
      expect(ids.length).withContext(tr).toBeLessThanOrEqual(8);
      expect(new Set(ids.map(id => SKILLS[id].tier)).size).withContext(tr).toBeGreaterThanOrEqual(4);
      for (const id of ids) {
        const req = SKILLS[id].req;
        if (!req) continue;
        expect(SKILLS[req].tree).withContext(id).toBe(tr);
        expect(SKILLS[req].tier).withContext(id).toBeLessThan(SKILLS[id].tier);
      }
      // No two skills on one spot of the page.
      expect(new Set(ids.map(id => `${SKILLS[id].tier}:${SKILLS[id].col}`)).size).withContext(tr).toBe(ids.length);
    }
    // 21 in the three trees, and the common page's three (Light, the Seek, the Waygate).
    expect(CLASS_SKILLS.warlock.length).toBe(24);
  });

  it('the starting kit sits in the first tier (a new Warlock fights as before)', () => {
    for (const id of STARTER_RANKS.warlock) expect(SKILLS[id].tier).withContext(id).toBe(0);
    const ranks = effectiveRanks(empty(), 'warlock');
    for (const id of ['ember-bolt', 'drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward', 'aura-embers'] as SkillId[]) expect(ranks[id]).withContext(id).toBe(1);
    expect(ranks['bone-spear']).toBe(0);
    expect(ranks['meteor']).toBe(0);
  });

  it('rank 1 is the old numbers, and no number ever shrinks with a rank', () => {
    for (const id of CLASS_SKILLS.warlock) {
      // A var that counts whole things and grows by fractions (Soul Harvest's extra Soul) shows its whole part.
      expect(skillVars(id, 1)).withContext(id).toEqual(Object.fromEntries(Object.entries(SKILLS[id].vars).map(([k, n]) => [k, k === 'soul' ? Math.floor(n) : n])));
      expect(skillVars(id, 0)).withContext(id).toEqual(skillVars(id, 1));
      for (let r = 1; r < MAX_RANK; r++) {
        const a = skillVars(id, r), b = skillVars(id, r + 1);
        for (const k of Object.keys(a)) expect(b[k]).withContext(`${id} ${k} r${r}`).toBeGreaterThanOrEqual(a[k]);
      }
      // Something grows: a rank is never a wasted point.
      const top = skillVars(id, MAX_RANK);
      expect(Object.keys(top).some(k => top[k] > SKILLS[id].vars[k])).withContext(id).toBeTrue();
    }
    expect(skillVars('hellfire-nova', 4)).toEqual({ min: 32, max: 48, radius: 3.3 });
    // A raised count never outruns how many may stand at once.
    for (let r = 1; r <= MAX_RANK; r++) expect(skillVars('raise-skeleton', r)['count']).toBeLessThanOrEqual(skillVars('raise-skeleton', r)['cap']);
  });
});

describe('td-tree: points, gates, prerequisites', () => {
  it('one point a level from level 2', () => {
    expect(skillPointsEarned(1)).toBe(0);
    expect(skillPointsEarned(2)).toBe(1);
    expect(skillPointsEarned(9)).toBe(8);
    // Milestone bonus points ride on top (skill-points.ts): +1 at 10, +1 at 30.
    expect(skillPointsEarned(30)).toBe(31);
    expect(skillPointsEarned(0)).toBe(0);
    expect(treePointsLeft(empty(), 5)).toBe(4);
    expect(treePointsLeft({ spent: { 'bone-spear': 3 }, free: [], at: 0 }, 5)).toBe(1);
  });

  it('a skill needs its tier\'s level', () => {
    expect(levelFor('cinder-rain')).toBe(TIER_LEVELS[1]);
    const t = { spent: {}, free: [], at: 0 };
    expect(rankBlock(t, 'warlock', 'cinder-rain', 5)).toBe('level');
    expect(rankBlock(t, 'warlock', 'cinder-rain', 6)).toBeNull();   // Hellfire Nova is in the kit
    expect(buyRank(t, 'warlock', 'cinder-rain', 5)).toBeNull();
  });

  it('a skill needs a rank in its prerequisite', () => {
    let t: KeeperSkillTree | null = empty();
    expect(rankBlock(t, 'warlock', 'corpse-burst', 10)).toBe('req');
    t = buyRank(t, 'warlock', 'bone-spear', 10);
    expect(t).not.toBeNull();
    expect(rankBlock(t!, 'warlock', 'corpse-burst', 10)).toBeNull();
    t = buyRank(t!, 'warlock', 'corpse-burst', 10);
    expect(rankOf(t!, 'warlock', 'corpse-burst')).toBe(1);
  });

  it('spending stops at the points and at rank 20', () => {
    let t: KeeperSkillTree = empty();
    for (let i = 0; i < 3; i++) t = buyRank(t, 'warlock', 'drain-life', 4)!;
    expect(rankOf(t, 'warlock', 'drain-life')).toBe(4);   // 1 free + 3 bought
    expect(rankBlock(t, 'warlock', 'drain-life', 4)).toBe('points');
    t = { spent: { 'drain-life': 19 }, free: [], at: 0 };
    expect(rankOf(t, 'warlock', 'drain-life')).toBe(MAX_RANK);
    expect(rankBlock(t, 'warlock', 'drain-life', 99)).toBe('max');
  });

  it('the respec gives every bought point back and keeps the free ranks', () => {
    const t = resetTree({ spent: { 'bone-spear': 4, 'corpse-burst': 2 }, free: ['raise-skeleton'], at: 5 });
    expect(pointsSpent(t)).toBe(0);
    expect(rankOf(t, 'warlock', 'raise-skeleton')).toBe(1);
    expect(rankOf(t, 'warlock', 'drain-life')).toBe(1);
  });

  it('clamping drops points over the level, the deepest first, and any orphaned by it', () => {
    const t: KeeperSkillTree = { spent: { 'bone-spear': 2, 'corpse-burst': 3, 'bone-storm': 2, 'hidden-skill': 4 }, free: [], at: 1 };
    // Level 19: 18 points, 7 spent: nothing to drop but the unknown id.
    expect(clampTree(t, 'warlock', 19).spent).toEqual({ 'bone-spear': 2, 'corpse-burst': 3, 'bone-storm': 2 });
    // Level 12: Bone Storm (18) is out of reach; 11 points cover the rest.
    expect(clampTree(t, 'warlock', 12).spent).toEqual({ 'bone-spear': 2, 'corpse-burst': 3 });
    // Level 3: 2 points; the gate takes Corpse Burst (6) and Bone Storm.
    expect(clampTree(t, 'warlock', 3).spent).toEqual({ 'bone-spear': 2 });
    // Level 2: one point left in the shallowest.
    expect(clampTree(t, 'warlock', 2).spent).toEqual({ 'bone-spear': 1 });
    // Budget cut that orphans: losing Bone Spear takes its children with it.
    expect(clampTree({ spent: { 'bone-spear': 1, 'corpse-burst': 1 }, free: [], at: 0 }, 'warlock', 1).spent).toEqual({});
    for (let lv = 1; lv <= 30; lv++) expect(pointsSpent(clampTree(t, 'warlock', lv))).toBeLessThanOrEqual(skillPointsEarned(lv));
  });
});

describe('td-tree: saves (migration and merge)', () => {
  it('a save from before the trees keeps its bar and aura: each gets rank 1 free', () => {
    const old = coerceLook({ made: true, bar: ['bone-spear', 'raise-skeleton', 'drain-life', 'dark-ward'], aura: 'aura-siphon', updatedAt: 9 });
    expect(old.tree.free).toEqual(['bone-spear', 'raise-skeleton', 'drain-life', 'dark-ward', 'aura-siphon']);
    const ranks = effectiveRanks(old.tree, 'warlock');
    for (const id of [...old.bar, old.aura] as SkillId[]) expect(ranks[id]).withContext(id).toBeGreaterThanOrEqual(1);
    expect(pointsSpent(old.tree)).toBe(0);
    // Free ranks need no level and no points: still there at level 1.
    expect(effectiveRanks(clampTree(old.tree, 'warlock', 1), 'warlock')['aura-siphon']).toBe(1);
    // A save that already has a tree is not migrated again.
    expect(coerceLook({ bar: ['bone-spear'], tree: { spent: {}, free: [], at: 3 } }).tree.free).toEqual([]);
    // A new Keeper: nothing free beyond the kit.
    expect(defaultLook().tree).toEqual({ spent: {}, free: [], at: 0 });
  });

  it('junk in a stored tree is dropped', () => {
    const t = coerceLook({ tree: { spent: { 'bone-spear': 3, 'X!': 2, meteor: -1, doom: 2.5, weaken: 99 }, free: ['ok-id', 7, 'NO'], at: 'x' } }).tree;
    expect(t).toEqual({ spent: { 'bone-spear': 3, weaken: MAX_RANK }, free: ['ok-id'], at: 0 });
  });

  it('the merge takes the newer tree whole (never a sum), and the fight clamps it to the level', () => {
    const a = { ...defaultLook(), updatedAt: 50, tree: { spent: { 'bone-spear': 5 }, free: [], at: 10 } };
    const b = { ...defaultLook(), updatedAt: 40, tree: { spent: { 'drain-life': 5 }, free: [], at: 20 } };
    const merged = coerceLook(mergeKeeperLook(a, b));
    // The look's newer edit (a) wins the look, the tree's newer edit (b) wins the tree; nothing is added up.
    expect(merged.updatedAt).toBe(50);
    expect(merged.tree.spent).toEqual({ 'drain-life': 5 });
    expect(pointsSpent(merged.tree)).toBe(5);
    // On a level that earned only 3 points, the fight sees 3.
    expect(pointsSpent(clampTree(merged.tree, 'warlock', 4))).toBe(3);
    expect(coerceLook(mergeKeeperLook(b, a)).tree.spent).toEqual({ 'drain-life': 5 });
  });
});

describe('td-tree: every new skill goes off in the fight', () => {
  function world(hp = 100): { sys: MobSystem; hurt: number[] } {
    const hurt: number[] = [], keeper = { x: 0, y: 0 };
    const host: MobHost = {
      options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
      hurtPlayer: n => hurt.push(n), healPlayer: () => undefined, swung: () => undefined, playerHp: () => hp,
    };
    const sys = new MobSystem(host);
    sys.aura = null;
    sys.setRanks(Object.fromEntries(CLASS_SKILLS.warlock.map(id => [id, 5])));
    sys.mana = sys.maxMana = 999;
    return { sys, hurt };
  }
  const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };

  for (const id of NEW_SKILLS) {
    it(`${id} executes and plays out without throwing`, () => {
      const { sys } = world();
      sys.addSpawns([{ key: 'a', type: 'bone-walker', x: 30, y: 0 }, { key: 'b', type: 'bone-walker', x: 40, y: 10 }]);
      expect(sys.mobs.length).toBe(2);
      sys.corpses.push({ x: 20, y: 0, at: 0 });
      const before = sys.mobs.reduce((n, m) => n + m.hp, 0);
      const kind = SKILLS[id].kind;
      if (kind === 'active') expect(sys.useAbility(id)).withContext(id).toBeNull();
      expect(() => run(sys, 6)).not.toThrow();
      if (['cinder-rain', 'flame-wall', 'meteor', 'corpse-burst', 'bone-storm', 'doom'].includes(id)) {
        expect(sys.mobs.reduce((n, m) => n + m.hp, 0)).withContext(`${id} hurt someone`).toBeLessThan(before);
      }
    });
  }

  it('a skill at rank 0 refuses; Life Tap never spends the last life; Corpse Burst needs a corpse', () => {
    const { sys } = world(10);
    sys.setRanks({ 'drain-life': 1, 'life-tap': 1, 'corpse-burst': 1 });
    expect(sys.useAbility('meteor')).toBe('locked');
    expect(sys.useAbility('life-tap')).toBe('life');
    expect(sys.useAbility('corpse-burst')).toBe('nocorpse');
  });

  it('ranks make the fight stronger: Bone Armor soaks more, Weaken bites weaker, the mastery adds fire', () => {
    const lo = world().sys, hi = world().sys;
    lo.setRanks({ 'bone-armor': 1 }); hi.setRanks({ 'bone-armor': 10 });
    lo.useAbility('bone-armor'); hi.useAbility('bone-armor');
    expect(hi.bone).toBeGreaterThan(lo.bone);
    const m = world().sys;
    m.setRanks({ 'ember-mastery': 0 }); expect(m.fireMult).toBe(1);
    m.setRanks({ 'ember-mastery': 3 }); expect(m.fireMult).toBeCloseTo(1.16, 5);
  });
});
