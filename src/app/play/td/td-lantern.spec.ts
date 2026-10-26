/**
 * td-lantern.spec.ts — the third vocation (design-bible §4.3): the Lanternwright's book as data (the Seam-Cant valid
 * and unique across all three classes, synergies that never loop, three trees by D2's rules), the lantern's arithmetic
 * (light on the dead, heals in whole ticks, Banish's unmaking, Last Light, the carried light and its shutters), the sky's
 * hand on the light, every spell in the fight, tree clamping for the new class, and old saves still loading.
 */
import type { EngineOptions } from '../engine/engine.model';
import { VOCATIONS, coerceLook, defaultLook, mergeKeeperLook, type KeeperSkillTree } from '../../shared/keeper-look/keeper-look.model';
import { LANTERN_KIT, LANTERN_OFFHAND, vocationLook } from '../../shared/keeper-look/vocation-look';
import { LAMP_TREES, LANTERN_SKILLS, type LampSkillId } from './td-lantern-skills';
import { LANTERN_I18N } from './td-lantern.i18n';
import { ASHGUARD_I18N } from './td-ashguard.i18n';
import { HUD_I18N } from '../world/hud.i18n';
import { BANISH_BOSS, LIGHT_BANE, VOCATION_LIGHT, carriedLight, healOverTime, lastLightClamp, lightBlow, shadowBorn, stepHeal, unmakes } from './td-lantern';
import { BOSS_CC } from './td-melee';
import { DAWN_REVEAL, MOBS, MobSystem, type MobHost } from './td-mobs';
import { CLASS_SKILLS, CLASS_TREES, MAX_RANK, SKILLS, STARTER_RANKS, bookTrees, defaultAura, defaultBar, fightStats, skillVars, type SkillId } from './td-skills';
import { boughtRanks, buyRank, clampTree, effectiveRanks, levelFor, pointsSpent, rankBlock, rankOf, treeSkills } from './td-tree';
import { skyVars, spellMult } from './td-phases';
import { TILE } from './td-art';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';

const ROOTS = ['vael', 'osk', 'nyr', 'lum', 'hesk', 'thar', 'brann', 'ul'];
const SHAPES = ['sha', 'orum', 'dra', 'mur', 'ka', 'teth', 'vesh', 'un'];
const LAMP = Object.keys(LANTERN_SKILLS) as LampSkillId[];
const empty = (): KeeperSkillTree => ({ spent: {}, free: [], at: 0 });

describe('td-lantern: the book as data', () => {
  it('is a vocation, with three trees and the common page; no skill crosses into another class\'s book', () => {
    expect(VOCATIONS).toContain('lanternwright');
    expect(CLASS_TREES.lanternwright).toEqual(['lamp', 'hearth', 'moth']);
    expect(bookTrees('lanternwright')).toEqual(['lamp', 'hearth', 'moth', 'common']);
    expect(LAMP.length).toBe(13);
    expect(CLASS_SKILLS.lanternwright.length).toBe(16); // + the common page: Light, the Seek, the Waygate
    // The book's rows (skills-100.md §6): Lamp 6, Hearth 3 (Last Light is Lantern Ward's mark), Moth 2 (Moth-Kin, Lamp-Wisp's).
    expect(LAMP_TREES.map(tr => treeSkills('lanternwright', tr).length)).toEqual([6, 3, 2]);
    for (const id of LAMP) {
      expect(CLASS_SKILLS.warlock).not.toContain(id);
      expect(CLASS_SKILLS.ashguard).not.toContain(id);
    }
    // Dawn at Noon is the ultimate: the deepest tier, the Small Eclipse's answer.
    expect(SKILLS['dawn-at-noon'].tier).toBe(4);
    expect(levelFor('dawn-at-noon')).toBe(24);
    // The shutters are there from the first step (a shy chest can come before the first level).
    expect(levelFor('shutter-lantern')).toBe(1);
  });

  it('every spell speaks valid Seam-Cant with the light or the hearth root; passives speak nothing but the flare', () => {
    for (const id of LAMP) {
      const sk = SKILLS[id];
      if (sk.kind === 'passive' && id !== 'kindle') { expect(sk.words).withContext(id).toBeUndefined(); continue; }
      expect(sk.words).withContext(id).toMatch(/^[a-z]+( [a-z]+)*$/);
      const parts = sk.words!.split(' ');
      expect(ROOTS).withContext(id).toContain(parts[0]);
      for (const w of parts) expect([...ROOTS, ...SHAPES]).withContext(`${id}: ${w}`).toContain(w);
      expect(parts.includes('lum') || parts.includes('hesk')).withContext(id).toBeTrue();
    }
    expect(SKILLS['dawn-at-noon'].words).toBe('lum ul orum');
  });

  it('the words are unique across all three classes\' books (the common page counted once)', () => {
    const all = new Set<SkillId>([...CLASS_SKILLS.warlock, ...CLASS_SKILLS.ashguard, ...CLASS_SKILLS.lanternwright]);
    const said = [...all].map(id => SKILLS[id].words).filter((w): w is string => !!w);
    const seen = new Map<string, number>();
    for (const w of said) seen.set(w, (seen.get(w) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([w]) => w)).toEqual([]);
  });

  it('synergies name another Lanternwright skill, a modest %, and never loop (the graph has no cycle)', () => {
    const edges = new Map<SkillId, SkillId[]>();
    let n = 0;
    for (const id of LAMP) for (const s of SKILLS[id].syn ?? []) {
      n++;
      expect(s.from).withContext(id).not.toBe(id);
      expect(CLASS_SKILLS.lanternwright).withContext(id).toContain(s.from);
      expect(s.per).withContext(id).toBeGreaterThan(0);
      expect(s.per).withContext(id).toBeLessThanOrEqual(10);
      edges.set(s.from, [...(edges.get(s.from) ?? []), id]);
    }
    expect(n).toBeGreaterThanOrEqual(6);
    const state = new Map<SkillId, 1 | 2>();
    const visit = (id: SkillId): boolean => {
      if (state.get(id) === 1) return false;
      if (state.get(id) === 2) return true;
      state.set(id, 1);
      for (const to of edges.get(id) ?? []) if (!visit(to)) return false;
      state.set(id, 2);
      return true;
    };
    for (const id of LAMP) expect(visit(id)).withContext(`a loop through ${id}`).toBeTrue();
  });

  it('no number shrinks with a rank, and every name, line and var has EN + ES words', () => {
    const words = { ...HUD_I18N, ...ASHGUARD_I18N, ...LANTERN_I18N } as Record<string, { en: string; es: string } | undefined>;
    for (const id of LAMP) {
      for (let r = 1; r < MAX_RANK; r++) {
        const a = skillVars(id, r), b = skillVars(id, r + 1);
        for (const k of Object.keys(a)) expect(b[k]).withContext(`${id}.${k}@${r}`).toBeGreaterThanOrEqual(a[k]);
      }
      for (const key of [SKILLS[id].nameKey, SKILLS[id].textKey]) {
        expect(LANTERN_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(LANTERN_I18N[key]?.es).withContext(key).toBeTruthy();
        // Every {{var}} the line quotes is a var the skill has.
        for (const m of LANTERN_I18N[key].en.matchAll(/\{\{(\w+)\}\}/g)) expect(Object.keys(SKILLS[id].vars)).withContext(`${key}: ${m[1]}`).toContain(m[1]);
      }
      // A min/max pair reads as one "Damage" row on the card.
      for (const v of Object.keys(SKILLS[id].vars)) expect(words['play.td.tree.var.' + (v === 'min' || v === 'max' ? 'damage' : v)]?.es).withContext(v).toBeTruthy();
    }
    for (const tr of LAMP_TREES) expect(LANTERN_I18N['play.td.tree.' + tr]?.es).withContext(tr).toBeTruthy();
  });

  it('a new Lanternwright holds the flare, four keys and the lantern\'s aura free; the bar and aura default to them', () => {
    const ranks = effectiveRanks(empty(), 'lanternwright');
    for (const id of STARTER_RANKS.lanternwright) expect(ranks[id]).withContext(id).toBe(1);
    expect(ranks['dawn-at-noon']).toBe(0);
    expect(defaultBar('lanternwright')).toEqual(['hearthlight', 'blinding-flash', 'lamp-wisp', 'shutter-lantern']);
    expect(defaultAura('lanternwright')).toBe('lantern-aura');
    expect(Object.values(boughtRanks(empty(), 'lanternwright')).every(n => n === 0)).toBeTrue();
  });
});

describe('td-lantern: the arithmetic', () => {
  it('light finds the dead and the dark-born: half again on them, as written on anything else', () => {
    for (const id of ['bone-walker', 'bone-archer', 'ash-ghoul', 'cinder-wraith', 'lantern-wisp', 'drowned-acolyte', 'bone-dragon']) expect(shadowBorn(id)).withContext(id).toBeTrue();
    for (const id of ['ash-wolf', 'lava-hound', 'cinder-orc', 'moss-stalker']) expect(shadowBorn(id)).withContext(id).toBeFalse();
    expect(LIGHT_BANE).toBe(1.5);
    expect(lightBlow(10, 'bone-walker')).toBe(15);
    expect(lightBlow(10, 'ash-wolf')).toBe(10);
  });

  it('a heal over time pays whole ticks once a second and exactly its total, however it divides', () => {
    for (const [total, secs] of [[30, 3], [31, 3], [7, 3], [100, 6], [5, 1]] as const) {
      const h = healOverTime(total, secs);
      let paid = 0, ticks = 0;
      for (let t = 0; t < secs + 1; t += .05) { const n = stepHeal(h, .05); if (n > 0) ticks++; paid += n; }
      expect(paid).withContext(`${total}/${secs}`).toBe(total);
      expect(ticks).withContext(`${total}/${secs}`).toBeLessThanOrEqual(secs);
      expect(h.left).toBe(0);
    }
    expect(stepHeal(healOverTime(30, 3), .5)).toBe(0);
  });

  it('Banish unmakes the low dead (never a boss, never the living); Last Light holds the fatal blow', () => {
    expect(unmakes('bone-walker', 'normal', 20, 100, 25)).toBeTrue();
    expect(unmakes('bone-walker', 'normal', 30, 100, 25)).toBeFalse();
    expect(unmakes('ash-wolf', 'normal', 5, 100, 25)).toBeFalse();
    expect(unmakes('bone-dragon', 'boss', 5, 2200, 25)).toBeFalse();
    expect(BANISH_BOSS).toBeGreaterThan(1);
    expect(lastLightClamp(10, 50)).toEqual({ n: 10, caught: false });
    expect(lastLightClamp(50, 50)).toEqual({ n: 49, caught: true });
    expect(lastLightClamp(500, 20)).toEqual({ n: 19, caught: true });
  });

  it('the lantern is a light the Keeper carries; shut, only a worn unique\'s light is left', () => {
    expect(VOCATION_LIGHT.lanternwright).toBeGreaterThan(VOCATION_LIGHT.warlock);
    expect(VOCATION_LIGHT.ashguard).toBe(0);
    expect(carriedLight({ vocation: 'lanternwright', shuttered: false, aura: 2, spell: 0, relics: 0 })).toBe(4);
    expect(carriedLight({ vocation: 'lanternwright', shuttered: true, aura: 2, spell: 0, relics: 0 })).toBe(0);
    expect(carriedLight({ vocation: 'lanternwright', shuttered: true, aura: 2, spell: 0, relics: 1 })).toBe(1);
    expect(carriedLight({ vocation: 'warlock', shuttered: false, aura: 0, spell: 3, relics: 0 })).toBe(3);
  });

  it('the body: a little less life and a deep well of mana, against the Warlock at the same level', () => {
    for (const lv of [1, 10, 40]) {
      const w = fightStats(lv), l = fightStats(lv, undefined, {}, 'lanternwright');
      expect(l.maxHp).withContext(`${lv}`).toBeLessThan(w.maxHp);
      expect(l.maxHp).withContext(`${lv}`).toBeGreaterThan(w.maxHp * .8);
      expect(l.maxMana).withContext(`${lv}`).toBeGreaterThan(w.maxMana * 1.3);
      expect(l.defense).toBe(w.defense);
    }
  });

  it('the sky: the light is strongest when it is darkest; the Hearth\'s heal follows, mildly', () => {
    for (const tr of LAMP_TREES) {
      expect(spellMult(tr, 'night')).withContext(tr).toBeGreaterThan(spellMult(tr, 'day'));
      expect(spellMult(tr, 'eclipse')).withContext(tr).toBeGreaterThan(spellMult(tr, 'night'));
    }
    expect(spellMult('lamp', 'day')).toBeLessThan(1);
    expect(spellMult('lamp', 'eclipse')).toBeGreaterThan(spellMult('ember', 'eclipse'));
    expect(skyVars('hearth')).toEqual(['heal']);
    expect(skyVars('lamp')).toContain('min');
  });
});

describe('td-lantern: the fight', () => {
  function world(hp = 100): { sys: MobSystem; hurt: number[]; healed: number[]; kills: string[]; keeper: { x: number; y: number; face: number }; life: { hp: number }; said: string[] } {
    const hurt: number[] = [], healed: number[] = [], kills: string[] = [], keeper = { x: 0, y: 0, face: 1 }, life = { hp }, said: string[] = [];
    const host: MobHost = {
      options: { onKill: (k: { creature: string }) => kills.push(k.creature) } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'spec', player: () => keeper,
      hurtPlayer: n => { hurt.push(n); life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { healed.push(n); life.hp += n; },
      swung: () => undefined, playerHp: () => life.hp, say: k => said.push(k),
    };
    const sys = new MobSystem(host);
    sys.vocation = 'lanternwright';
    sys.aura = null;
    sys.keeperMaxHp = 100;
    sys.setRanks(Object.fromEntries(CLASS_SKILLS.lanternwright.map(id => [id, 5])));
    sys.mana = sys.maxMana = 999;
    return { sys, hurt, healed, kills, keeper, life, said };
  }
  const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
  const calm = (sys: MobSystem) => { for (const m of sys.mobs) { m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 1e9; } };

  it('Kindle: a flare at a foe within its short reach, never past it; the Warlock keeps his bolt\'s 7 tiles', () => {
    const { sys } = world();
    expect(sys.lamp).toBeTrue();
    expect(sys.range).toBeCloseTo(4 * TILE, 5);
    sys.place('far', MOBS['bone-walker'], 6 * TILE, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 1);
    expect(sys.flares).toBe(0);
    sys.mobs[0].x = 3 * TILE;
    run(sys, .5);
    expect(sys.flares).toBeGreaterThan(0);
    expect(sys.bolts.some(b => b.lamp) || sys.mobs[0].hp < MOBS['bone-walker'].hp).toBeTrue();
    sys.vocation = 'warlock';
    expect(sys.range).toBe(SKILLS['ember-bolt'].vars['range'] * TILE);
  });

  it('a flare lands half again on the dead: its blow is within the bane\'s band', () => {
    const { sys } = world();
    sys.place('a', MOBS['bone-walker'], 30, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, .6);
    const kv = sys.v('kindle'), lost = MOBS['bone-walker'].hp - sys.mobs[0].hp;
    expect(lost).toBeGreaterThanOrEqual(Math.round(kv['min'] * LIGHT_BANE));
    expect(lost).toBeLessThanOrEqual(Math.round(kv['max'] * LIGHT_BANE) * 2);
  });

  it('kills with the flare and tells the host', () => {
    const { sys, kills } = world();
    sys.place('wolf', MOBS['ash-wolf'], 30, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 12);
    expect(kills).toEqual(['ash-wolf']);
  });

  for (const id of LAMP.filter(i => SKILLS[i].kind === 'active')) {
    it(`${id} executes and plays out without throwing`, () => {
      const { sys } = world();
      sys.place('a', MOBS['bone-walker'], 20, 0);
      sys.place('b', MOBS['ash-wolf'], 24, 8);
      sys.target = sys.mobs[0];
      expect(sys.useAbility(id)).withContext(id).toBeNull();
      expect(() => run(sys, 3)).not.toThrow();
    });
  }

  it('Hearthlight mends exactly its heal over its seconds, in whole ticks', () => {
    const { sys, healed } = world(20);
    expect(sys.useAbility('hearthlight')).toBeNull();
    const v = sys.v('hearthlight');
    run(sys, v['secs'] + .3);
    expect(healed.reduce((a, n) => a + n, 0)).toBe(v['heal']);
    expect(healed.length).toBe(v['secs']);
  });

  it('the Hearth Circle mends the Keeper standing in it, slows a creature in it, and not past its edge', () => {
    const { sys, healed, keeper } = world(20);
    expect(sys.useAbility('hearth-circle')).toBeNull();
    expect(sys.inHearth).toBeTrue();
    run(sys, 2.02);
    const v = sys.v('hearth-circle');
    expect(healed.reduce((a, n) => a + n, 0)).toBeGreaterThanOrEqual(Math.floor(v['heal'] * 2) - 1);
    // A creature walking to him inside the ring goes slower than one outside it.
    const pace = (inside: boolean): number => {
      const w = world(); w.sys.useAbility('hearth-circle');
      if (!inside) w.sys.zones.length = 0;
      const m = w.sys.place('m', { ...MOBS['ash-wolf'], dmg: [0, 0] }, 40, 0);
      run(w.sys, .3);
      return 40 - m.x;
    };
    expect(pace(true)).toBeLessThan(pace(false));
    keeper.x = 400;
    expect(sys.inHearth).toBeFalse();
    const before = healed.length;
    run(sys, 2);
    expect(healed.length).toBe(before);
  });

  it('the Blinding Flash stuns the dead (a boss a fifth as long) and only hurts the living', () => {
    const { sys } = world();
    sys.place('dead', MOBS['bone-walker'], 20, 0);
    // A sturdy wolf: the Flash (34–51 at its starting rank since the balance pass) can fell a plain one, and a fallen
    // wolf leaves the list — the old 45-life wolf made this spec fail about one run in three.
    sys.place('wolf', { ...MOBS['ash-wolf'], hp: 500 }, -20, 0);
    expect(sys.useAbility('blinding-flash')).toBeNull();
    const [dead, wolf] = sys.mobs;
    expect(dead.stun).toBeCloseTo(sys.v('blinding-flash')['stun'], 5);
    expect(wolf.stun ?? 0).toBe(0);
    expect(dead.hp).toBeLessThan(MOBS['bone-walker'].hp);
    expect(wolf.hp).toBeLessThan(500);
    const { sys: s2 } = world();
    s2.place('boss', MOBS['bone-dragon'], 20, 0);
    s2.useAbility('blinding-flash');
    expect(s2.mobs[0].stun).toBeCloseTo(s2.v('blinding-flash')['stun'] * BOSS_CC, 2);
  });

  it('Banish unmakes one of the dead left low, but only wounds the living', () => {
    const { sys, kills } = world();
    const dead = sys.place('dead', MOBS['bone-walker'], 20, 0);
    dead.hp = Math.round(MOBS['bone-walker'].hp * .5);
    sys.target = dead;
    spyOn(Math, 'random').and.returnValue(.5);
    expect(sys.useAbility('banish')).toBeNull();
    expect(kills).toContain('bone-walker');
    const { sys: s2, kills: k2 } = world();
    const wolf = s2.place('wolf', { ...MOBS['ash-wolf'], hp: 1000 }, 20, 0);
    s2.target = wolf;
    s2.useAbility('banish');
    expect(k2).toEqual([]);
    expect(wolf.hp).toBeLessThan(1000);
    // Out of reach: it refuses and spends nothing.
    const { sys: s3 } = world();
    s3.place('far', MOBS['bone-walker'], 20 * TILE, 0);
    const mana = s3.mana;
    expect(s3.useAbility('banish')).toBe('nofoe');
    expect(s3.mana).toBe(mana);
  });

  it('Dawn at Noon burns the dead inside it, spares the living its fire, and unveils everything inside', () => {
    const { sys } = world();
    const dead = sys.place('dead', MOBS['bone-walker'], 30, 0), wolf = sys.place('wolf', MOBS['ash-wolf'], -30, 0);
    const out = sys.place('out', MOBS['bone-walker'], 20 * TILE, 0);
    calm(sys);
    sys.target = null;
    expect(sys.useAbility('dawn-at-noon')).toBeNull();
    expect(sys.dawns.length).toBe(1);
    run(sys, 1.1);
    expect(dead.hp).toBeLessThan(MOBS['bone-walker'].hp);
    expect(wolf.hp).toBe(MOBS['ash-wolf'].hp);
    expect(out.hp).toBe(MOBS['bone-walker'].hp);
    expect(wolf.revealT).toBeGreaterThan(0);
    expect(DAWN_REVEAL).toBe(15);
    run(sys, sys.v('dawn-at-noon')['secs']);
    expect(sys.dawns.length).toBe(0);
  });

  it('the Lantern Ward drinks blows; when it breaks it blinds everything near', () => {
    const { sys, hurt } = world();
    sys.useAbility('lantern-ward');
    const absorb = sys.v('lantern-ward')['absorb'];
    expect(sys.lampWard).toBe(absorb);
    sys.defense = 0;
    sys.place('a', { ...MOBS['bone-walker'], dmg: [20, 20], rate: .3 }, 10, 0);
    run(sys, 1.2);
    expect(hurt.reduce((a, n) => a + n, 0)).toBeLessThan(20 * 4);
    run(sys, 3);
    expect(sys.lampWard).toBe(0);
    expect(sys.effects.some(e => e.kind === 'lward-break') || (sys.mobs[0].stun ?? 0) > 0 || hurt.length > 0).toBeTrue();
  });

  it('Last Light holds a fatal blow at 1 life once, untouchable a moment, then waits its long while', () => {
    const { sys, life, said } = world(30);
    sys.defense = 0;
    sys.place('a', { ...MOBS['bone-walker'], dmg: [100, 100], rate: .4 }, 10, 0);
    run(sys, 1.5);
    expect(life.hp).toBe(1);
    expect(said).toContain('lamp.lastlight');
    expect(sys.lastLightCd).toBeGreaterThan(500);
    run(sys, sys.v('last-light')['secs'] + 1);
    expect(life.hp).toBe(0);
  });

  it('the shutters: the lantern\'s light and its aura\'s go, the Light spell goes out; the Light spell opens them', () => {
    const { sys, said } = world();
    sys.aura = 'lantern-aura';
    const open = sys.lightBonus;
    expect(open).toBeCloseTo(VOCATION_LIGHT.lanternwright + sys.v('lantern-aura')['light'], 5);
    sys.useAbility('light');
    expect(sys.lightBonus).toBeGreaterThan(open);
    expect(sys.useAbility('shutter-lantern')).toBeNull();
    expect(sys.shuttered).toBeTrue();
    expect(sys.lightBonus).toBe(0);
    expect(said).toContain('lamp.shut');
    run(sys, 1.1);
    sys.cooldowns['light'] = 0;
    expect(sys.useAbility('light')).toBeNull();
    expect(sys.shuttered).toBeFalse();
    expect(sys.lightBonus).toBeGreaterThan(open);
    // A Warlock carries no lantern: his light is the spell's alone.
    sys.vocation = 'warlock';
    sys.lightT = 0;
    expect(sys.lightBonus).toBe(0);
  });

  it('the Lantern Aura makes the creatures in its reach bite weaker', () => {
    const bite = (aura: boolean): number => {
      const w = world(1000); w.sys.defense = 0;
      w.sys.aura = aura ? 'lantern-aura' : null;
      w.sys.place('a', { ...MOBS['ash-wolf'], dmg: [40, 40], rate: .3 }, 10, 0);
      run(w.sys, 1.2);
      return w.hurt[0];
    };
    expect(bite(true)).toBeLessThan(bite(false));
  });

  it('the wisps and the beacon throw their motes at what comes near; Moth-Kin makes them bite harder', () => {
    const { sys } = world();
    sys.useAbility('lamp-wisp');
    sys.useAbility('beacon');
    expect(sys.wisps.length).toBe(1);
    expect(sys.beacons.length).toBe(1);
    sys.place('a', MOBS['bone-walker'], 40, 0);
    calm(sys);
    run(sys, 1.5);
    expect(sys.mobs[0].hp).toBeLessThan(MOBS['bone-walker'].hp);
    run(sys, sys.v('lamp-wisp')['secs'] + 1);
    expect(sys.wisps.length).toBe(0);
    expect(sys.beacons.length).toBe(0);
  });

  it('at night the Lamp hits harder and the Hearth mends more, by the sky\'s own numbers', () => {
    const { sys } = world();
    const base = { flash: skillVars('blinding-flash', 5)['max'], heal: skillVars('hearthlight', 5)['heal'] };
    expect(sys.v('blinding-flash')['max']).toBe(Math.round(base.flash * spellMult('lamp', 'day')));
    expect(sys.v('hearthlight')['heal']).toBe(base.heal);
    sys.setPhase('eclipse', true);
    expect(sys.v('blinding-flash')['max']).toBe(Math.round(base.flash * spellMult('lamp', 'eclipse')));
    expect(sys.v('blinding-flash')['max']).toBeGreaterThan(base.flash);
    expect(sys.v('hearthlight')['heal']).toBeCloseTo(base.heal * spellMult('hearth', 'eclipse'), 1);
  });

  it('the Warlock and the Ashguard never get the Lanternwright\'s lantern, flares or wards', () => {
    const { sys, healed } = world();
    sys.vocation = 'warlock';
    sys.setRanks(null);
    sys.place('a', MOBS['bone-walker'], 40, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 2);
    expect(sys.flares).toBe(0);
    expect(healed.length).toBe(0);
    sys.vocation = 'ashguard';
    expect(sys.lightBonus).toBe(0);
  });
});

describe('td-lantern: the trees and the saves', () => {
  it('clamps a Lanternwright\'s tree: another class\'s points drop, tiers and prerequisites hold, the level\'s points cap it', () => {
    const t: KeeperSkillTree = { spent: { 'bone-spear': 3, 'watch-blade': 2, 'banish': 2, 'dawn-at-noon': 1, 'hearth-circle': 2 }, free: [], at: 0 };
    expect(clampTree(t, 'lanternwright', 30).spent).toEqual({ 'banish': 2, 'dawn-at-noon': 1, 'hearth-circle': 2 });
    // Level 10: Banish (12) and Dawn (24) are not open yet.
    expect(clampTree(t, 'lanternwright', 10).spent).toEqual({ 'hearth-circle': 2 });
    expect(clampTree(t, 'warlock', 30).spent).toEqual({ 'bone-spear': 3 });
    expect(clampTree(t, 'ashguard', 30).spent).toEqual({ 'watch-blade': 2 });
    // The book's rule: a rank anywhere above it on its page opens a row (the kit's Kindle is free), so Dawn opens at its level.
    expect(rankBlock(empty(), 'lanternwright', 'dawn-at-noon', 30)).toBeNull();
    expect(rankBlock(empty(), 'lanternwright', 'moth-kin', 30)).toBe('folded');
    const tree = buyRank(empty(), 'lanternwright', 'dawn-at-noon', 30);
    expect(rankOf(tree!, 'lanternwright', 'dawn-at-noon')).toBe(1);
    expect(clampTree({ spent: { 'dawn-at-noon': 2, 'last-light': 3 }, free: [], at: 0 }, 'lanternwright', 30).spent).toEqual({ 'dawn-at-noon': 2 });
    for (let lv = 1; lv <= 30; lv++) expect(pointsSpent(clampTree(t, 'lanternwright', lv))).toBeLessThanOrEqual(skillPointsEarned(lv));
    expect(rankBlock(empty(), 'lanternwright', 'bone-spear', 30)).toBe('class');
    expect(rankOf(empty(), 'lanternwright', 'shutter-lantern')).toBe(1);
  });

  it('old saves still load: no calling is a Warlock, an Ashguard stays one, a Lanternwright is kept', () => {
    expect(coerceLook({ made: true, name: 'Aster', bar: ['drain-life'], updatedAt: 3 }).vocation).toBe('warlock');
    expect(coerceLook({ vocation: 'ashguard', made: true }).vocation).toBe('ashguard');
    expect(coerceLook({ vocation: 'lanternwright', made: true }).vocation).toBe('lanternwright');
    expect(coerceLook({ vocation: 'lamplighter' }).vocation).toBe('warlock');
    expect(defaultLook().vocation).toBe('warlock');
    const merged = mergeKeeperLook({ vocation: 'lanternwright', updatedAt: 5 }, { updatedAt: 2 }) as { vocation: string };
    expect(merged.vocation).toBe('lanternwright');
    const old = coerceLook({ made: true, bar: ['bone-spear'], aura: 'aura-siphon' });
    expect(effectiveRanks(old.tree, old.vocation)['bone-spear']).toBe(1);
  });

  it('the look: the lamp-keeper\'s kit stands in; a worn staff carries the lantern, any other weapon hands it to the off-hand', () => {
    const bare = vocationLook('lanternwright', null);
    expect(bare.garb).toBeTruthy();
    expect(bare.gear?.head?.kind).toBe('hood');
    expect(bare.gear?.chest?.kind).toBe('coat');
    expect(bare.gear?.weapon?.kind).toBe('staff');
    expect(bare.gear?.weapon?.variant).toBe('lamp');
    expect(bare.gear?.['off-hand']).toBeUndefined();
    const sword = vocationLook('lanternwright', { weapon: { slot: 'weapon', kind: 'sword', style: 'infernal', rarity: 'rare' } });
    expect(sword.gear?.weapon?.kind).toBe('sword');
    expect(sword.gear?.['off-hand']).toEqual(LANTERN_OFFHAND);
    const staff = vocationLook('lanternwright', { weapon: { slot: 'weapon', kind: 'staff', style: 'umbral', rarity: 'epic' } });
    expect(staff.gear?.weapon?.variant).toBe('lamp');
    expect(staff.gear?.weapon?.style).toBe('umbral');
    expect(staff.gear?.chest).toEqual(LANTERN_KIT.chest);
  });
});
