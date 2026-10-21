/**
 * td-relics.spec.ts — the boss uniques' signatures in the top-down fight (shared/rpg/boss-uniques.ts → td-mobs relics):
 * each one does what its card says, and the Bestiary names each boss's own.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, isConstruct, type Mob, type MobHost } from './td-mobs';
import { SKILLS } from './td-skills';
import { BOSS_UNIQUES, NO_RELICS, relicTotals } from '../../shared/rpg/boss-uniques';
import { bestiaryEntries, creatureHaunts } from './td-bestiary';

function world(): { sys: MobSystem; keeper: { x: number; y: number } } {
  const keeper = { x: 0, y: 0 };
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  sys.mana = sys.maxMana = 999;
  return { sys, keeper };
}
const wear = (sys: MobSystem, ...ids: string[]) => sys.setRelics(relicTotals(ids));
const mobAt = (sys: MobSystem, type: string, x: number, y: number, key = `${type}@${x},${y}`): Mob => {
  sys.addSpawns([{ key, type, x, y }]);
  return sys.mobs.find(m => m.key === key)!;
};
const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };

describe('td-relics: the signatures the fight applies', () => {
  beforeEach(() => spyOn(Math, 'random').and.returnValue(0));

  it("Warden's Last Ember: +2 light, and Ember Bolt one rank up (only once learnt)", () => {
    const { sys } = world();
    sys.setRanks({ 'ember-bolt': 3 });
    expect(sys.lightBonus).toBe(0);
    wear(sys, 'unique-wardens-last-ember');
    expect(sys.lightBonus).toBe(2);
    expect(sys.rank('ember-bolt')).toBe(4);
    const four = world().sys;
    four.setRanks({ 'ember-bolt': 4 });
    expect(sys.v('ember-bolt')).toEqual(four.v('ember-bolt'));
    sys.setRanks({ 'ember-bolt': 0 });
    expect(sys.rank('ember-bolt')).toBe(0);
    sys.setRanks({ 'ember-bolt': 20 });
    expect(sys.rank('ember-bolt')).toBe(20);
  });

  it("Tyrant's Crucible: Meteor cools 2 seconds sooner", () => {
    const plain = world().sys, worn = world().sys;
    wear(worn, 'unique-tyrants-crucible');
    for (const s of [plain, worn]) { s.setRanks({ meteor: 1 }); mobAt(s, 'bone-walker', 30, 0); expect(s.useAbility('meteor')).toBeNull(); }
    expect(plain.cooldowns['meteor']).toBeCloseTo(SKILLS['meteor'].cd, 5);
    expect(worn.cooldowns['meteor']).toBeCloseTo(SKILLS['meteor'].cd - 2, 5);
    expect(worn.cdOf('meteor')).toBe(SKILLS['meteor'].cd - 2);
  });

  it('Hammer of the First Watch: Nova +2 ranks, and 20% harder on constructs only', () => {
    expect(isConstruct('anvil-warden')).toBeTrue();
    expect(isConstruct('cinder-bailiff')).toBeTrue();
    expect(isConstruct('obsidian-golem')).toBeTrue();
    expect(isConstruct('bone-walker')).toBeFalse();
    const hit = (relic: boolean, type: string): number => {
      const { sys } = world();
      sys.setRanks({ 'drain-life': 1 });
      if (relic) wear(sys, 'unique-hammer-first-watch');
      const m = mobAt(sys, type, 20, 0), before = m.hp;
      sys.useAbility('drain-life');
      return before - m.hp;
    };
    expect(hit(true, 'obsidian-golem')).toBe(Math.round(hit(false, 'obsidian-golem') * 1.2));
    expect(hit(true, 'bone-walker')).toBe(hit(false, 'bone-walker'));
    const { sys } = world();
    sys.setRanks({ 'hellfire-nova': 1 });
    wear(sys, 'unique-hammer-first-watch');
    expect(sys.rank('hellfire-nova')).toBe(3);
  });

  it('Ashbone Phylactery: one more skeleton at once, and each first blow is a breath of fire (3×)', () => {
    const plain = world().sys, worn = world().sys;
    wear(worn, 'unique-ashbone-phylactery');
    const max = SKILLS['raise-skeleton'].vars['cap'];
    for (const s of [plain, worn]) { s.setRanks({ 'raise-skeleton': 1 }); for (let i = 0; i < 3; i++) { s.cooldowns['raise-skeleton'] = 0; s.useAbility('raise-skeleton'); } }
    expect(plain.minions.length).toBe(max);
    expect(worn.minions.length).toBe(max + 1);
    // A lone skeleton by a creature: the first blow is three times the next.
    const { sys } = world();
    wear(sys, 'unique-ashbone-phylactery');
    sys.minions.push({ id: 1, x: 0, y: 0, hp: 99, maxHp: 99, dmg: [10, 10], cd: 0, t: 0, face: 1, life: Infinity, hit: 0, target: null });
    const m = mobAt(sys, 'obsidian-golem', 10, 0);
    m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 999;
    const hp0 = m.hp;
    run(sys, .05);
    expect(hp0 - m.hp).toBe(30);
    expect(sys.minions[0].breathed).toBeTrue();
    const hp1 = m.hp;
    run(sys, 1.5);
    expect(hp1 - m.hp).toBe(10);
  });

  it('Crown of the Banked Coal: +15% fire, and the bolt leaves its foe smouldering', () => {
    const { sys } = world();
    sys.setRanks({ 'ember-bolt': 1 });
    expect(sys.fireMult).toBe(1);
    wear(sys, 'unique-crown-banked-coal');
    expect(sys.fireMult).toBeCloseTo(1.15, 5);
    sys.setRanks({ 'ember-bolt': 1, 'ember-mastery': 3 });
    expect(sys.fireMult).toBeCloseTo(1.16 * 1.15, 5);
    sys.setRanks({ 'ember-bolt': 1 });
    const m = mobAt(sys, 'obsidian-golem', 30, 0);
    m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 999;
    sys.target = m;
    run(sys, .5);
    expect(m.singeT).toBeGreaterThan(0);
    // Without it, no smoulder.
    const plain = world().sys;
    plain.setRanks({ 'ember-bolt': 1 });
    const n = mobAt(plain, 'obsidian-golem', 30, 0);
    n.def = { ...n.def, sight: 0, dmg: [0, 0] }; n.wait = 999;
    plain.target = n;
    run(plain, .5);
    expect(n.singeT ?? 0).toBe(0);
  });

  it('Splinterbow of the Rootcradle: two more spears in a Bone Storm, and a Bone Spear 3 tiles further', () => {
    const plain = world().sys, worn = world().sys;
    wear(worn, 'unique-splinterbow-rootcradle');
    for (const s of [plain, worn]) { s.setRanks({ 'bone-storm': 1, 'bone-spear': 1 }); s.useAbility('bone-storm'); }
    expect(worn.spears.length).toBe(plain.spears.length + 2);
    const a = world().sys, b = world().sys;
    wear(b, 'unique-splinterbow-rootcradle');
    for (const s of [a, b]) { s.setRanks({ 'bone-spear': 1 }); mobAt(s, 'bone-walker', 40, 0); s.useAbility('bone-spear'); }
    const range = SKILLS['bone-spear'].vars['range'];
    expect(b.spears[0].life / a.spears[0].life).toBeCloseTo((range + 3) / range, 5);
  });

  it("The Abbess's Censer: a hit stains, and a stained foe takes 10% more from the next", () => {
    const { sys } = world();
    wear(sys, 'unique-abbess-censer');
    sys.setRanks({ 'drain-life': 1 });
    const m = mobAt(sys, 'obsidian-golem', 20, 0);
    let hp = m.hp;
    sys.useAbility('drain-life');
    const first = hp - m.hp;
    expect(m.inkT).toBe(3);
    sys.cooldowns['drain-life'] = 0;
    hp = m.hp;
    sys.useAbility('drain-life');
    expect(hp - m.hp).toBe(Math.round(first * 1.1));
    // The stain fades.
    m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 999;
    run(sys, 3.2);
    expect(m.inkT).toBe(0);
  });

  it('none worn: the fight is exactly as before', () => {
    const { sys } = world();
    expect(sys.relics).toBe(NO_RELICS);
    expect(sys.lightBonus).toBe(0);
    expect(sys.cdOf('meteor')).toBe(SKILLS['meteor'].cd);
  });
});

describe('td-relics: the Bestiary keeps each boss\'s own', () => {
  it('every boss card names its unique and the odds; no other creature has one', () => {
    const entries = bestiaryEntries({});
    for (const e of entries) {
      const u = BOSS_UNIQUES.find(x => x.boss === e.id);
      if (u) expect(e.relic).withContext(e.id).toEqual({ id: u.id, name: u.name, oneIn: u.oneIn });
      else expect(e.relic).withContext(e.id).toBeNull();
    }
    for (const u of BOSS_UNIQUES) expect(MOBS[u.boss]?.rank).withContext(u.boss).toBe('boss');
  });

  it('the card\'s "Found in" is where the Bestiary says the boss lives', () => {
    const haunts = creatureHaunts();
    for (const u of BOSS_UNIQUES) expect((haunts.get(u.boss) ?? []).some(h => h.startsWith(u.lair))).withContext(`${u.id}: ${u.lair} in ${haunts.get(u.boss)}`).toBeTrue();
  });
});
