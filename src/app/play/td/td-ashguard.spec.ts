/**
 * td-ashguard.spec.ts — the second vocation (design-bible §4.4): the Ashguard's book as data (the Seam-Cant valid and
 * unique, synergies that never loop, three trees by D2's rules), the melee arithmetic (the arc, the blow, the brand,
 * crowd control on bosses, the guard, the vow), the blade and every spell in the fight, tree clamping for the new
 * class, and old saves loading as Warlocks.
 */
import type { EngineOptions } from '../engine/engine.model';
import { VOCATIONS, coerceLook, defaultLook, mergeKeeperLook, type KeeperSkillTree } from '../../shared/keeper-look/keeper-look.model';
import { gearKey } from '../../shared/keeper-look/keeper-gear';
import { ASHGUARD_KIT, vocationLook } from '../../shared/keeper-look/vocation-look';
import { ASHGUARD_SKILLS, ASH_TREES, type AshSkillId } from './td-ashguard-skills';
import { ASHGUARD_I18N } from './td-ashguard.i18n';
import { BOSS_CC, angleGap, brandedBlow, ccSecs, guardedDefense, inArc, meleeBlow, strideEnd, vowClamp, weaponSwing, FISTS } from './td-melee';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { CLASS_SKILLS, CLASS_TREES, MAX_RANK, SKILLS, STARTER_RANKS, bookTrees, defaultAura, defaultBar, fightStats, skillVars, type SkillId } from './td-skills';
import { boughtRanks, buyRank, clampTree, effectiveRanks, pointsSpent, rankBlock, rankOf, treeSkills } from './td-tree';
import { TILE } from './td-art';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';

const ROOTS = ['vael', 'osk', 'nyr', 'lum', 'hesk', 'thar', 'brann', 'ul'];
const SHAPES = ['sha', 'orum', 'dra', 'mur', 'ka', 'teth', 'vesh', 'un'];
const ASH = Object.keys(ASHGUARD_SKILLS) as AshSkillId[];
const empty = (): KeeperSkillTree => ({ spent: {}, free: [], at: 0 });

describe('td-ashguard: the book as data', () => {
  it('is a vocation, with three trees of four skills each plus the common page', () => {
    expect(VOCATIONS).toContain('ashguard');
    expect(CLASS_TREES.ashguard).toEqual(['brand', 'oath', 'ash']);
    expect(bookTrees('ashguard')).toEqual(['brand', 'oath', 'ash', 'common']);
    expect(bookTrees('warlock')).toEqual(['ember', 'bone', 'shadow', 'common']);
    expect(ASH.length).toBe(12);
    expect(CLASS_SKILLS.ashguard.length).toBe(14);
    for (const tr of ASH_TREES) {
      const ids = treeSkills('ashguard', tr);
      expect(ids.length).withContext(tr).toBe(4);
      for (const id of ids) {
        const req = SKILLS[id].req;
        if (!req) continue;
        expect(SKILLS[req].tree).withContext(id).toBe(tr);
        expect(SKILLS[req].tier).withContext(id).toBeLessThan(SKILLS[id].tier);
      }
      expect(new Set(ids.map(id => `${SKILLS[id].tier}:${SKILLS[id].col}`)).size).withContext(tr).toBe(ids.length);
    }
    // No Ashguard skill sits in a Warlock book, and the reverse.
    for (const id of ASH) expect(CLASS_SKILLS.warlock).not.toContain(id);
  });

  it('every spell speaks valid Seam-Cant with the iron root in it; passives speak nothing', () => {
    for (const id of ASH) {
      const sk = SKILLS[id];
      if (sk.kind === 'passive') { expect(sk.words).withContext(id).toBeUndefined(); continue; }
      expect(sk.words).withContext(id).toMatch(/^[a-z]+( [a-z]+)*$/);
      const parts = sk.words!.split(' ');
      expect(ROOTS).withContext(id).toContain(parts[0]);
      for (const w of parts) expect([...ROOTS, ...SHAPES]).withContext(`${id}: ${w}`).toContain(w);
      expect(parts).withContext(id).toContain('brann');
    }
  });

  it('no two spells in the vocation say the same words (and none borrows a Warlock\'s)', () => {
    const said = CLASS_SKILLS.ashguard.map(id => SKILLS[id].words).filter(Boolean);
    expect(new Set(said).size).toBe(said.length);
    const warlock = new Set(CLASS_SKILLS.warlock.filter(id => SKILLS[id].tree !== 'common').map(id => SKILLS[id].words).filter(Boolean));
    for (const id of ASH) if (SKILLS[id].words) expect(warlock.has(SKILLS[id].words)).withContext(id).toBeFalse();
  });

  it('synergies name another Ashguard skill, a modest %, and never loop (the graph has no cycle)', () => {
    const edges = new Map<SkillId, SkillId[]>();
    let n = 0;
    for (const id of ASH) for (const s of SKILLS[id].syn ?? []) {
      n++;
      expect(s.from).withContext(id).not.toBe(id);
      expect(CLASS_SKILLS.ashguard).withContext(id).toContain(s.from);
      expect(s.per).withContext(id).toBeGreaterThan(0);
      expect(s.per).withContext(id).toBeLessThanOrEqual(10);
      edges.set(s.from, [...(edges.get(s.from) ?? []), id]);
    }
    expect(n).toBeGreaterThanOrEqual(5);
    const state = new Map<SkillId, 1 | 2>();
    const visit = (id: SkillId): boolean => {
      if (state.get(id) === 1) return false;
      if (state.get(id) === 2) return true;
      state.set(id, 1);
      for (const to of edges.get(id) ?? []) if (!visit(to)) return false;
      state.set(id, 2);
      return true;
    };
    for (const id of ASH) expect(visit(id)).withContext(`a loop through ${id}`).toBeTrue();
  });

  it('no number shrinks with a rank, and every line and var has EN + ES words', () => {
    for (const id of ASH) {
      for (let r = 1; r < MAX_RANK; r++) {
        const a = skillVars(id, r), b = skillVars(id, r + 1);
        for (const k of Object.keys(a)) expect(b[k]).withContext(`${id}.${k}@${r}`).toBeGreaterThanOrEqual(a[k]);
      }
      for (const key of [SKILLS[id].nameKey, SKILLS[id].textKey]) {
        expect(ASHGUARD_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(ASHGUARD_I18N[key]?.es).withContext(key).toBeTruthy();
      }
      for (const v of Object.keys(SKILLS[id].vars)) expect(ASHGUARD_I18N['play.td.tree.var.' + v] ?? (['min', 'max', 'secs', 'pct', 'radius', 'reach', 'heal'].includes(v) ? { en: 'x', es: 'x' } : undefined)).withContext(v).toBeDefined();
    }
  });

  it('a new Ashguard holds the swing, four keys and the watchfire free; the bar and aura default to them', () => {
    const ranks = effectiveRanks(empty(), 'ashguard');
    for (const id of STARTER_RANKS.ashguard) expect(ranks[id]).withContext(id).toBe(1);
    expect(ranks['whirl-of-cinders']).toBe(0);
    expect(defaultBar('ashguard')).toEqual(['shield-bash', 'ember-brand', 'ash-stride', 'shield-oath']);
    expect(defaultAura('ashguard')).toBe('aura-watchfire');
    expect(Object.values(boughtRanks(empty(), 'ashguard')).every(n => n === 0)).toBeTrue();
  });
});

describe('td-ashguard: the melee arithmetic', () => {
  it('the arc: in front within reach is struck; behind, or past the reach, is not; a broad body is forgiven half its width', () => {
    const reach = 1.6 * TILE;
    expect(inArc(0, 0, 0, reach, 110, 20, 0)).toBeTrue();
    expect(inArc(0, 0, 0, reach, 110, 14, 14)).toBeTrue();       // 45° off the aim: inside a 110° arc
    expect(inArc(0, 0, 0, reach, 110, 0, 20)).toBeFalse();       // 90° off: outside
    expect(inArc(0, 0, 0, reach, 110, -20, 0)).toBeFalse();      // behind
    expect(inArc(0, 0, 0, reach, 110, 30, 0)).toBeFalse();       // past the reach
    expect(inArc(0, 0, 0, reach, 110, 30, 0, 20)).toBeTrue();    // ...unless it is broad
    expect(inArc(0, 0, 0, reach, 360, -20, 0)).toBeTrue();       // a full turn strikes all round
    expect(inArc(0, 0, Math.PI, reach, 110, -2, 1)).toBeTrue();  // standing on the Keeper's own square
    expect(angleGap(Math.PI - .1, -Math.PI + .1)).toBeCloseTo(.2, 5);
  });

  it('the blow rolls the blade\'s min..max, a % lifts or cuts it, the brand adds its %, never below 1', () => {
    expect(meleeBlow(9, 14, 100, () => 0)).toBe(9);
    expect(meleeBlow(9, 14, 100, () => .9999)).toBe(14);
    expect(meleeBlow(10, 10, 120, () => .5)).toBe(12);
    expect(meleeBlow(10, 10, 60, () => .5)).toBe(6);
    expect(meleeBlow(1, 1, 1, () => 0)).toBe(1);
    for (let i = 0; i < 200; i++) { const b = meleeBlow(9, 14); expect(b).toBeGreaterThanOrEqual(9); expect(b).toBeLessThanOrEqual(14); }
    expect(brandedBlow(10, 40)).toBe(14);
    expect(brandedBlow(10, 0)).toBe(10);
  });

  it('the weapon in hand lifts the swing: the starter edge is today\'s blow, fists a fifth lighter, a better weapon adds flat damage', () => {
    // Starter Basalt Edge (Strike 1): exactly the kit blade's numbers.
    expect(weaponSwing({ strikePower: 1 })).toEqual({ flat: 0, mult: 1 });
    expect(meleeBlow(9, 14, 100, () => 0, weaponSwing({ strikePower: 1 }))).toBe(9);
    // No weapon at all: the swing still lands, at 85%.
    expect(weaponSwing(null)).toEqual(FISTS);
    expect(meleeBlow(9, 14, 100, () => 0, FISTS)).toBe(8);
    expect(meleeBlow(9, 14, 100, () => .9999, FISTS)).toBe(12);
    // Dawnrender (Strike 1.7): +2 flat. An affixed rare with 12% Spell Damage counts 3 points: +6. Both ride % and power.
    expect(weaponSwing({ strikePower: 1.7 }).flat).toBe(2);
    expect(weaponSwing({ spellDamage: 12 }).flat).toBe(6);
    expect(meleeBlow(9, 14, 100, () => 0, weaponSwing({ spellDamage: 12 }))).toBe(15);
    expect(meleeBlow(9, 14, 120, () => 0, weaponSwing({ spellDamage: 12 }))).toBe(18);
    expect(weaponSwing({ strikePower: .4 }).flat).toBe(0);
    expect(weaponSwing({ strikePower: NaN, spellDamage: -5 }).flat).toBe(0);
  });

  it('the kit helm is the Pyre Watch\'s iron helm (its own variant, iron-coloured, ember-lit), distinct from a worn round helm', () => {
    const kit = ASHGUARD_KIT.head!;
    expect(kit.kind).toBe('helm');
    expect(kit.variant).toBe('pyre');
    expect(kit.accent).toBe('#ff7a2e');
    expect(gearKey({ head: kit })).not.toBe(gearKey({ head: { ...kit, variant: undefined } }));
  });

  it('crowd control on a boss lasts a fifth; the guard, Hold the Line and the vow', () => {
    expect(BOSS_CC).toBe(.2);
    expect(ccSecs(1.5, 'boss')).toBeCloseTo(.3, 5);
    expect(ccSecs(1.5, 'normal')).toBe(1.5);
    expect(ccSecs(1.5, undefined)).toBe(1.5);
    const hold = { below: 40, pct: 20 };
    expect(guardedDefense(10, 5, 90, 100, hold)).toBe(15);        // healthy: no lift
    expect(guardedDefense(10, 5, 30, 100, hold)).toBeCloseTo(18, 5); // low: +20%
    expect(guardedDefense(10, 0, 30, 100, null)).toBe(10);
    expect(vowClamp(50, 20)).toBe(19);
    expect(vowClamp(5, 20)).toBe(5);
    expect(vowClamp(5, 1)).toBe(0);
    expect(strideEnd(0, 0, 100, 0, 14)).toEqual({ x: 86, y: 0 });
    expect(strideEnd(0, 0, 10, 0, 14)).toEqual({ x: 0, y: 0 });
  });

  it('the body: more life, less mana and Defense of its own, against the Warlock at the same level', () => {
    for (const lv of [1, 10, 40]) {
      const w = fightStats(lv), a = fightStats(lv, undefined, {}, 'ashguard');
      expect(a.maxHp).withContext(`${lv}`).toBeGreaterThan(w.maxHp);
      expect(a.maxMana).withContext(`${lv}`).toBeLessThan(w.maxMana);
      expect(a.defense).withContext(`${lv}`).toBeGreaterThan(w.defense);
    }
    expect(fightStats(1).defense).toBe(0);
    expect(fightStats(5, undefined, { defense: 10 }, 'ashguard').defense).toBeGreaterThan(fightStats(5, undefined, { defense: 10 }).defense);
  });
});

describe('td-ashguard: the fight', () => {
  function world(hp = 100): { sys: MobSystem; hurt: number[]; healed: number[]; kills: string[]; keeper: { x: number; y: number }; life: { hp: number } } {
    const hurt: number[] = [], healed: number[] = [], kills: string[] = [], keeper = { x: 0, y: 0 }, life = { hp };
    const host: MobHost = {
      options: { onKill: (k: { creature: string }) => kills.push(k.creature) } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'spec', player: () => keeper,
      hurtPlayer: n => { hurt.push(n); life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { healed.push(n); life.hp += n; },
      swung: () => undefined, playerHp: () => life.hp, dash: (x, y) => { keeper.x = x; keeper.y = y; },
    };
    const sys = new MobSystem(host);
    sys.vocation = 'ashguard';
    sys.aura = null;
    sys.keeperMaxHp = 100;
    sys.setRanks(Object.fromEntries(CLASS_SKILLS.ashguard.map(id => [id, 5])));
    sys.mana = sys.maxMana = 999;
    return { sys, hurt, healed, kills, keeper, life };
  }
  const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
  const calm = (sys: MobSystem) => { for (const m of sys.mobs) { m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 1e9; } };

  it('a Warlock still throws the bolt from afar; an Ashguard swings only at what is in reach', () => {
    const { sys } = world();
    expect(sys.melee).toBeTrue();
    expect(sys.range).toBeCloseTo(1.6 * TILE, 5);
    sys.vocation = 'warlock';
    expect(sys.range).toBe(SKILLS['ember-bolt'].vars['range'] * TILE);
  });

  it('the swing strikes the foe in front and its neighbour in the arc, not the one behind; the hit shows', () => {
    const { sys } = world();
    sys.place('front', MOBS['bone-walker'], 18, 0);
    sys.place('side', MOBS['bone-walker'], 14, 10);
    sys.place('back', MOBS['bone-walker'], -18, 0);
    calm(sys);
    const hp0 = MOBS['bone-walker'].hp;
    sys.target = sys.mobs[0];
    sys.update(.02);
    expect(sys.swings).toBe(1);
    const [front, side, back] = ['front', 'side', 'back'].map(k => sys.mobs.find(m => m.key === k)!);
    expect(front.hp).toBeLessThan(hp0);
    expect(side.hp).toBeLessThan(hp0);
    expect(back.hp).toBe(hp0);
    // Watch Blade at rank 5: 17–26, no crit, power 1.
    const v = sys.v('watch-blade');
    expect(hp0 - front.hp).toBeGreaterThanOrEqual(v['min']);
    expect(hp0 - front.hp).toBeLessThanOrEqual(v['max']);
    expect(sys.effects.some(e => e.kind === 'arc')).toBeTrue();
    expect(sys.effects.filter(e => e.kind === 'slash').length).toBe(2);
    expect(sys.bolts.length).toBe(0);
  });

  it('a held weapon hits harder than bare hands in the fight itself', () => {
    const hit = (w: Parameters<typeof weaponSwing>[0]): number => {
      const { sys } = world();
      sys.weaponSwing = weaponSwing(w);
      sys.place('f', MOBS['bone-walker'], 18, 0);
      calm(sys); sys.target = sys.mobs[0]; sys.update(.02);
      return MOBS['bone-walker'].hp - sys.mobs[0].hp;
    };
    const v = world().sys.v('watch-blade');
    const fist = Array.from({ length: 30 }, () => hit(null)), edge = Array.from({ length: 30 }, () => hit({ strikePower: 1 })), big = Array.from({ length: 30 }, () => hit({ spellDamage: 12 }));
    expect(Math.max(...fist)).toBeLessThanOrEqual(Math.round(v['max'] * .85));
    expect(Math.min(...edge)).toBeGreaterThanOrEqual(v['min']);
    expect(Math.min(...big)).toBeGreaterThanOrEqual(v['min'] + 6);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(big)).toBeGreaterThan(mean(edge) + 4);
    expect(mean(edge)).toBeGreaterThan(mean(fist));
  });

  it('swings on its own pace until the creature falls, and the kill is told to the host', () => {
    const { sys, kills } = world();
    sys.place('wolf', MOBS['ash-wolf'], 18, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 6);
    expect(kills).toEqual(['ash-wolf']);
    expect(sys.swings).toBeGreaterThanOrEqual(2);
  });

  it('a foe out of reach is never struck', () => {
    const { sys } = world();
    sys.place('far', MOBS['bone-walker'], 60, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 1);
    expect(sys.swings).toBe(0);
    expect(sys.mobs[0].hp).toBe(MOBS['bone-walker'].hp);
  });

  for (const id of ASH.filter(i => SKILLS[i].kind === 'active')) {
    it(`${id} executes and plays out without throwing`, () => {
      const { sys } = world();
      sys.place('a', MOBS['bone-walker'], 20, 0);
      sys.place('b', MOBS['bone-walker'], 24, 8);
      sys.target = sys.mobs[0];
      expect(sys.useAbility(id)).withContext(id).toBeNull();
      expect(() => run(sys, 3)).not.toThrow();
    });
  }

  it('the Ember Brand lifts every blow and leaves the foe burning; Cinder Cleave and the Whirl strike as fire', () => {
    const { sys } = world();
    sys.place('a', MOBS['bone-walker'], 18, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    expect(sys.useAbility('ember-brand')).toBeNull();
    expect(sys.brandT).toBeGreaterThan(0);
    sys.update(.02);
    expect(sys.mobs[0].brandT).toBeGreaterThan(0);
    expect(sys.effects.find(e => e.kind === 'arc')?.el).toBe('ember');
    const { sys: s2 } = world();
    s2.place('a', MOBS['bone-walker'], 18, 0); s2.place('b', MOBS['bone-walker'], -18, 0);
    calm(s2);
    s2.useAbility('whirl-of-cinders');
    run(s2, 2.2);
    for (const m of s2.mobs) expect(m.hp).toBeLessThan(MOBS['bone-walker'].hp);
  });

  it('Shield Bash stuns (it neither moves nor bites); a boss is stunned a fifth as long', () => {
    const { sys, hurt } = world();
    sys.place('a', MOBS['bone-walker'], 16, 0);
    sys.target = sys.mobs[0];
    expect(sys.useAbility('shield-bash')).toBeNull();
    const m = sys.mobs[0], stun = sys.v('shield-bash')['stun'];
    expect(m.stun).toBeCloseTo(stun, 5);
    sys.target = null;
    const at = { x: m.x, y: m.y };
    run(sys, stun - .1);
    expect({ x: m.x, y: m.y }).toEqual(at);
    expect(hurt.length).toBe(0);
    const { sys: s2 } = world();
    s2.place('boss', MOBS['ember-warden'], 16, 0);
    s2.target = s2.mobs[0];
    s2.useAbility('shield-bash');
    expect(s2.mobs[0].stun).toBeCloseTo(stun * BOSS_CC, 2);
  });

  it('the Watch Cry turns creatures on the Keeper and he takes less; the Shield Oath turns a blow aside whole', () => {
    const { sys, hurt } = world();
    sys.place('a', MOBS['bone-walker'], 40, 0);
    expect(sys.useAbility('watch-cry')).toBeNull();
    expect(sys.mobs[0].taunt).toBeGreaterThan(0);
    expect(sys.guardT).toBeGreaterThan(0);
    expect(sys.effects.some(e => e.kind === 'cry')).toBeTrue();
    // The Shield Oath with a blow it blocks (the roll under the %): nothing lands.
    const { sys: s2, hurt: h2 } = world();
    s2.useAbility('shield-oath');
    spyOn(Math, 'random').and.returnValue(0);
    s2.place('a', { ...MOBS['bone-walker'], dmg: [20, 20], rate: .1 }, 10, 0);
    run(s2, 1.4);   // its first bite comes after a second
    expect(h2.length).toBe(0);
    expect(s2.floaters.some(f => f.text === '0')).toBeTrue();
    expect(hurt.length).toBe(0);
  });

  it('the Vow of the Last Watch keeps the last point of life, then gives back a share of what it held', () => {
    const { sys, life, healed } = world(30);
    sys.useAbility('last-watch');
    const secs = sys.v('last-watch')['secs'];
    sys.place('a', { ...MOBS['bone-walker'], dmg: [25, 25], rate: .3 }, 10, 0);
    sys.defense = 0;
    run(sys, secs - .2);
    expect(life.hp).toBe(1);
    expect(sys.vowTaken).toBeGreaterThan(29);
    const owed = Math.round(sys.vowTaken * sys.v('last-watch')['heal'] / 100);
    sys.mobs.length = 0;
    run(sys, .4);
    expect(sys.vowT).toBe(0);
    expect(healed).toContain(owed);
  });

  it('Ash Stride carries the Keeper to the foe, strikes it and knocks it back', () => {
    const { sys, keeper } = world();
    sys.place('a', MOBS['bone-walker'], 60, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    expect(sys.useAbility('ash-stride')).toBeNull();
    expect(keeper.x).toBeCloseTo(46, 0);
    expect(sys.mobs[0].x).toBeCloseTo(60 + TILE * sys.v('ash-stride')['knock'], 0);
    expect(sys.mobs[0].hp).toBeLessThan(MOBS['bone-walker'].hp);
    expect(sys.effects.some(e => e.kind === 'stride')).toBeTrue();
    // Nothing in reach: it refuses and spends nothing.
    const { sys: s2 } = world();
    const mana = s2.mana;
    expect(s2.useAbility('ash-stride')).toBe('nofoe');
    expect(s2.mana).toBe(mana);
  });

  it('Ember Blood heals on the blows he lands; the Watchfire adds Defense and life; Hold the Line lifts Defense when low', () => {
    const { sys, healed, life } = world(50);
    sys.place('a', MOBS['obsidian-golem'] ?? MOBS['bone-walker'], 18, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 3);
    expect(healed.reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
    sys.defense = 10;
    sys.aura = 'aura-watchfire';
    life.hp = 90;
    const healthy = sys.guardDefense();
    expect(healthy).toBe(10 + sys.v('aura-watchfire')['def']);
    life.hp = 20;
    expect(sys.guardDefense()).toBeCloseTo(healthy * (1 + sys.v('hold-the-line')['pct'] / 100), 5);
    const before = healed.length;
    sys.mobs.length = 0;
    run(sys, 2.1);
    expect(healed.length).toBeGreaterThan(before);
  });

  it('the Warlock never gets the Ashguard\'s passives, even with every skill at rank 1 (the specs\' null ranks)', () => {
    const { sys, healed } = world();
    sys.vocation = 'warlock';
    sys.setRanks(null);
    sys.place('a', MOBS['bone-walker'], 40, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 2);
    expect(healed.length).toBe(0);
    expect(sys.swings).toBe(0);
  });
});

describe('td-ashguard: the trees and the saves', () => {
  it('clamps an Ashguard\'s tree: another class\'s points drop, tiers and prerequisites hold, the level\'s points cap it', () => {
    const t: KeeperSkillTree = { spent: { 'bone-spear': 3, 'cinder-cleave': 2, 'whirl-of-cinders': 2, 'last-watch': 1 }, free: [], at: 0 };
    // The Vow's point goes with no rank in Ember Blood, its prerequisite.
    expect(clampTree(t, 'ashguard', 30).spent).toEqual({ 'cinder-cleave': 2, 'whirl-of-cinders': 2 });
    // Level 12: the Whirl (18) and the Vow (24) are not open yet.
    expect(clampTree(t, 'ashguard', 12).spent).toEqual({ 'cinder-cleave': 2 });
    // The Warlock reading the same tree keeps only his own.
    expect(clampTree(t, 'warlock', 30).spent).toEqual({ 'bone-spear': 3 });
    // No Vow without Ember Blood (its prerequisite), even at a level that opens it.
    expect(rankBlock(empty(), 'ashguard', 'last-watch', 30)).toBe('req');
    let tree: KeeperSkillTree | null = buyRank(empty(), 'ashguard', 'ember-blood', 30);
    expect(tree).not.toBeNull();
    tree = buyRank(tree!, 'ashguard', 'last-watch', 30);
    expect(rankOf(tree!, 'ashguard', 'last-watch')).toBe(1);
    // An orphan: the Vow's points go when Ember Blood's do.
    expect(clampTree({ spent: { 'last-watch': 2 }, free: [], at: 0 }, 'ashguard', 30).spent).toEqual({});
    for (let lv = 1; lv <= 30; lv++) expect(pointsSpent(clampTree(t, 'ashguard', lv))).toBeLessThanOrEqual(skillPointsEarned(lv));
    // The kit's free ranks are the Ashguard's own; a Warlock skill is 'class'-blocked for him.
    expect(rankBlock(empty(), 'ashguard', 'bone-spear', 30)).toBe('class');
    expect(rankOf(empty(), 'ashguard', 'shield-bash')).toBe(1);
  });

  it('old saves load as Warlocks; an Ashguard is kept; junk falls back to the Warlock', () => {
    expect(coerceLook({ made: true, name: 'Aster', bar: ['drain-life'], updatedAt: 3 }).vocation).toBe('warlock');
    expect(coerceLook(null).vocation).toBe('warlock');
    expect(coerceLook({ vocation: 'paladin' }).vocation).toBe('warlock');
    expect(coerceLook({ vocation: 'ashguard', made: true }).vocation).toBe('ashguard');
    expect(defaultLook().vocation).toBe('warlock');
    const merged = mergeKeeperLook({ vocation: 'ashguard', updatedAt: 5 }, { updatedAt: 2 }) as { vocation: string };
    expect(merged.vocation).toBe('ashguard');
    // An old Warlock's bar still works under the trees (rank 1 free in what sat there).
    const old = coerceLook({ made: true, bar: ['bone-spear'], aura: 'aura-siphon' });
    expect(effectiveRanks(old.tree, old.vocation)['bone-spear']).toBe(1);
  });

  it('the look: the Pyre Watch kit stands in where nothing is worn, and worn gear shows over it', () => {
    const bare = vocationLook('ashguard', null);
    expect(bare.garb).toBeTruthy();
    expect(bare.gear?.weapon?.kind).toBe('sword');
    expect(bare.gear?.['off-hand']?.kind).toBe('shield');
    expect(bare.gear?.head?.kind).toBe('helm');
    const worn = vocationLook('ashguard', { weapon: { slot: 'weapon', kind: 'axe', style: 'verdant', rarity: 'rare' } });
    expect(worn.gear?.weapon?.kind).toBe('axe');
    expect(worn.gear?.chest).toEqual(ASHGUARD_KIT.chest);
    expect(vocationLook('warlock', null).gear?.head?.kind).toBe('hood');
  });
});
