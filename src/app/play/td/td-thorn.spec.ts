/**
 * td-thorn.spec.ts — the fourth vocation (design-bible §4.5): the Thornstrider's book as data (the Seam-Cant valid and
 * unique across all four classes, synergies that never loop, three trees by D2's rules), the bow's and the beast's
 * arithmetic (pierce, knock, bleed, root, the pet's bite under the bond), the sky's twilight, every spell in the fight,
 * the pet fighting harder (and a spirit beast's art when there is none), tree clamping, and old saves still loading.
 */
import type { EngineOptions } from '../engine/engine.model';
import { VOCATIONS, coerceLook, defaultLook, mergeKeeperLook, type KeeperSkillTree } from '../../shared/keeper-look/keeper-look.model';
import { THORN_GARB, THORN_KIT, vocationLook } from '../../shared/keeper-look/vocation-look';
import { KEEPER_LOOK_I18N } from '../../shared/keeper-look/keeper-look.i18n';
import { THORN_SKILLS, THORN_TREES, type ThornSkillId } from './td-thorn-skills';
import { THORN_I18N } from './td-thorn.i18n';
import { LANTERN_I18N } from './td-lantern.i18n';
import { ASHGUARD_I18N } from './td-ashguard.i18n';
import { HUD_I18N } from '../world/hud.i18n';
import {
  PIERCE_KEEP, SPIRIT_BEAST, THORN_PET, addBleed, bleedTotal, bondShare, fanAngles, knockFor, pierces, spiritLevel, stampedeLanes, thornPetBlow, thornPetRest,
} from './td-thorn';
import { BOSS_CC, ccSecs } from './td-melee';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { CLASS_SKILLS, CLASS_TREES, GEAR_CAPS, MAX_RANK, SKILLS, STARTER_RANKS, bookTrees, defaultAura, defaultBar, fightStats, skillVars, type SkillId } from './td-skills';
import { boughtRanks, buyRank, clampTree, effectiveRanks, levelFor, pointsSpent, rankBlock, rankOf, treeSkills } from './td-tree';
import { PHASE_RULES, skyVars, spellMult } from './td-phases';
import { TILE } from './td-art';
import { hasTdPetArt } from './td-pet-art';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';
import { PET_LEVEL_MAX } from '../../shared/pets/pet-roles';

const ROOTS = ['vael', 'osk', 'nyr', 'lum', 'hesk', 'thar', 'brann', 'ul'];
const SHAPES = ['sha', 'orum', 'dra', 'mur', 'ka', 'teth', 'vesh', 'un'];
const THORN = Object.keys(THORN_SKILLS) as ThornSkillId[];
const empty = (): KeeperSkillTree => ({ spent: {}, free: [], at: 0 });

describe('td-thorn: the book as data', () => {
  it('is a vocation, with three trees and the common page; no skill crosses into another class\'s book', () => {
    expect(VOCATIONS).toContain('thornstrider');
    expect(VOCATIONS.indexOf('thornstrider')).toBe(3);
    expect(CLASS_TREES.thornstrider).toEqual(['thorn', 'wild', 'briar']);
    expect(bookTrees('thornstrider')).toEqual(['thorn', 'wild', 'briar', 'common']);
    expect(THORN.length).toBe(12);
    expect(CLASS_SKILLS.thornstrider.length).toBe(15); // + the common page: Light, the Seek, the Waygate
    // The book's rows (skills-100.md §6): Thorn 3 (Heartwood is Thorn Shot's mark), Wild 4 (Wild Heart, Pack Bond's), Briar 3.
    expect(THORN_TREES.map(tr => treeSkills('thornstrider', tr).length)).toEqual([3, 4, 3]);
    for (const tr of THORN_TREES) {
      const ids = treeSkills('thornstrider', tr);
      expect(new Set(ids.map(id => `${SKILLS[id].tier}:${SKILLS[id].col}`)).size).withContext(tr).toBe(ids.length);
    }
    for (const id of THORN) for (const v of ['warlock', 'ashguard', 'lanternwright'] as const) expect(CLASS_SKILLS[v]).withContext(`${v}: ${id}`).not.toContain(id);
    // The Stampede is the ultimate: the deepest tier, at level 24.
    expect(SKILLS['stampede'].tier).toBe(4);
    expect(levelFor('stampede')).toBe(24);
    // The asked-for spells are all there: Command, Pack Bond, the Call, the snare, Volley, Barbed Shot, a trap.
    for (const id of ['command', 'pack-bond', 'call-of-the-wilds', 'thornroot-snare', 'volley', 'barbed-shot', 'bramble-trap', 'stampede'] as const) expect(THORN).toContain(id);
    expect(SKILLS['pack-bond'].kind).toBe('aura');
  });

  it('every spell speaks valid Seam-Cant opening with the wild\'s root; passives speak nothing but the shot', () => {
    for (const id of THORN) {
      const sk = SKILLS[id];
      if (sk.kind === 'passive' && id !== 'thorn-shot') { expect(sk.words).withContext(id).toBeUndefined(); continue; }
      expect(sk.words).withContext(id).toMatch(/^[a-z]+( [a-z]+)*$/);
      const parts = sk.words!.split(' ');
      expect(parts[0]).withContext(id).toBe('thar');
      for (const w of parts) expect([...ROOTS, ...SHAPES]).withContext(`${id}: ${w}`).toContain(w);
    }
    expect(SKILLS['stampede'].words).toBe('thar ul teth');
    expect(SKILLS['call-of-the-wilds'].words).toBe('thar teth');
  });

  it('the words are unique across all four classes\' books (the common page counted once)', () => {
    const all = new Set<SkillId>([...CLASS_SKILLS.warlock, ...CLASS_SKILLS.ashguard, ...CLASS_SKILLS.lanternwright, ...CLASS_SKILLS.thornstrider]);
    const said = [...all].map(id => SKILLS[id].words).filter((w): w is string => !!w);
    const seen = new Map<string, number>();
    for (const w of said) seen.set(w, (seen.get(w) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([w]) => w)).toEqual([]);
    // Only the Thornstrider speaks `thar`.
    for (const id of all) if (!THORN.includes(id as ThornSkillId)) expect(SKILLS[id].words?.split(' ').includes('thar') ?? false).withContext(id).toBeFalse();
  });

  it('synergies name another Thornstrider skill, a modest %, and never loop (the graph has no cycle)', () => {
    const edges = new Map<SkillId, SkillId[]>();
    let n = 0;
    for (const id of THORN) for (const s of SKILLS[id].syn ?? []) {
      n++;
      expect(s.from).withContext(id).not.toBe(id);
      expect(CLASS_SKILLS.thornstrider).withContext(id).toContain(s.from);
      expect(s.per).withContext(id).toBeGreaterThan(0);
      expect(s.per).withContext(id).toBeLessThanOrEqual(10);
      edges.set(s.from, [...(edges.get(s.from) ?? []), id]);
    }
    expect(n).toBeGreaterThanOrEqual(8);
    const state = new Map<SkillId, 1 | 2>();
    const visit = (id: SkillId): boolean => {
      if (state.get(id) === 1) return false;
      if (state.get(id) === 2) return true;
      state.set(id, 1);
      for (const to of edges.get(id) ?? []) if (!visit(to)) return false;
      state.set(id, 2);
      return true;
    };
    for (const id of THORN) expect(visit(id)).withContext(`a loop through ${id}`).toBeTrue();
  });

  it('no number shrinks with a rank, and every name, line and var has EN + ES words', () => {
    const words = { ...HUD_I18N, ...ASHGUARD_I18N, ...LANTERN_I18N, ...THORN_I18N } as Record<string, { en: string; es: string } | undefined>;
    for (const id of THORN) {
      for (let r = 1; r < MAX_RANK; r++) {
        const a = skillVars(id, r), b = skillVars(id, r + 1);
        for (const k of Object.keys(a)) expect(b[k]).withContext(`${id}.${k}@${r}`).toBeGreaterThanOrEqual(a[k]);
      }
      for (const key of [SKILLS[id].nameKey, SKILLS[id].textKey]) {
        expect(THORN_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(THORN_I18N[key]?.es).withContext(key).toBeTruthy();
        for (const lang of ['en', 'es'] as const) for (const m of THORN_I18N[key][lang].matchAll(/\{\{(\w+)\}\}/g)) expect(Object.keys(SKILLS[id].vars)).withContext(`${key}.${lang}: ${m[1]}`).toContain(m[1]);
      }
      for (const v of Object.keys(SKILLS[id].vars)) expect(words['play.td.tree.var.' + (v === 'min' || v === 'max' ? 'damage' : v)]?.es).withContext(v).toBeTruthy();
    }
    for (const tr of THORN_TREES) expect(THORN_I18N['play.td.tree.' + tr]?.es).withContext(tr).toBeTruthy();
    for (const key of ['look.class.thornstrider', 'look.class.thornstrider.blurb']) {
      expect(KEEPER_LOOK_I18N[key]?.en).withContext(key).toBeTruthy();
      expect(KEEPER_LOOK_I18N[key]?.es).withContext(key).toBeTruthy();
    }
    expect(THORN_I18N['play.pet.name.' + SPIRIT_BEAST]?.es).toBeTruthy();
  });

  it('a new Thornstrider holds the shot, four keys and Pack Bond free; the bar and aura default to them', () => {
    const ranks = effectiveRanks(empty(), 'thornstrider');
    for (const id of STARTER_RANKS.thornstrider) expect(ranks[id]).withContext(id).toBe(1);
    expect(ranks['stampede']).toBe(0);
    expect(ranks['call-of-the-wilds']).toBe(0);
    expect(defaultBar('thornstrider')).toEqual(['command', 'barbed-shot', 'thornroot-snare', 'volley']);
    expect(defaultAura('thornstrider')).toBe('pack-bond');
    expect(Object.values(boughtRanks(empty(), 'thornstrider')).every(n => n === 0)).toBeTrue();
  });
});

describe('td-thorn: the arithmetic', () => {
  it('the bow: a pierce is a roll against its chance, what flies on keeps a share; the knock is a fifth on a boss', () => {
    expect(pierces(15, .1)).toBeTrue();
    expect(pierces(15, .15)).toBeFalse();
    expect(pierces(0, 0)).toBeFalse();
    expect(PIERCE_KEEP).toBeGreaterThan(.5);
    expect(PIERCE_KEEP).toBeLessThan(1);
    expect(knockFor(1, 'normal')).toBe(16);
    expect(knockFor(1, 'boss')).toBeCloseTo(16 * BOSS_CC, 5);
    expect(knockFor(-2, undefined)).toBe(0);
    const fan = fanAngles(0, 5, 10);
    expect(fan.length).toBe(5);
    expect(fan[2]).toBeCloseTo(0, 9);
    expect(fan[0]).toBeCloseTo(-fan[4], 9);
    expect(stampedeLanes(5, 12)).toEqual([-24, -12, 0, 12, 24]);
  });

  it('the bleed: whole ticks, a second barb never stacks — it keeps the longer and the harder', () => {
    expect(bleedTotal(4, 5)).toBe(20);
    expect(bleedTotal(4.4, 5.9)).toBe(20);
    expect(addBleed(null, 4, 5)).toEqual({ t: 5, dps: 4 });
    expect(addBleed({ t: 2, dps: 9 }, 4, 5)).toEqual({ t: 5, dps: 9 });
    expect(addBleed({ t: 8, dps: 3 }, 6, 5)).toEqual({ t: 8, dps: 6 });
    expect(addBleed({ t: 0, dps: 50 }, 4, 5)).toEqual({ t: 5, dps: 4 });
  });

  it('the root: a creature\'s full seconds, a boss a fifth of them', () => {
    const v = skillVars('thornroot-snare', 1);
    expect(ccSecs(v['root'], 'normal')).toBe(v['root']);
    expect(ccSecs(v['root'], 'boss')).toBeCloseTo(v['root'] * BOSS_CC, 2);
  });

  it('the beast: a Thornstrider\'s pet bites with the bond, grows with his level and every Wild %, and bites more often', () => {
    expect(thornPetBlow(4, { level: 1, pct: 0 })).toBe(Math.round(4 * (1 + THORN_PET.bond)));
    expect(thornPetBlow(4, { level: 1, pct: 0 })).toBeGreaterThan(4);
    expect(thornPetBlow(4, { level: 21, pct: 0 })).toBeGreaterThan(thornPetBlow(4, { level: 1, pct: 0 }));
    expect(thornPetBlow(4, { level: 10, pct: 60 })).toBeGreaterThan(thornPetBlow(4, { level: 10, pct: 0 }));
    expect(thornPetBlow(0, { level: 1, pct: 0 })).toBe(1);
    expect(thornPetRest(1.6, false)).toBeLessThan(1.6);
    expect(thornPetRest(1.6, true)).toBeLessThan(thornPetRest(1.6, false));
    // Pack Bond shares a blow: less lands, never nothing.
    expect(bondShare(100, 10)).toBe(90);
    expect(bondShare(1, 50)).toBe(1);
    expect(bondShare(0, 10)).toBe(0);
    expect(bondShare(100, 400)).toBe(10);
  });

  it('the spirit beast: its own pixel art, a level that grows with the Keeper\'s, never past a pet\'s', () => {
    expect(hasTdPetArt(SPIRIT_BEAST)).toBeTrue();
    expect(spiritLevel(1)).toBe(1);
    expect(spiritLevel(16)).toBe(3);
    expect(spiritLevel(500)).toBe(PET_LEVEL_MAX);
  });

  it('the body: balanced life and mana, lighter feet — and still under the move-speed cap with everything worn', () => {
    for (const lv of [1, 10, 40]) {
      const w = fightStats(lv), t = fightStats(lv, undefined, {}, 'thornstrider');
      expect(t.maxHp).withContext(`${lv}`).toBeGreaterThanOrEqual(w.maxHp);
      expect(t.maxHp).withContext(`${lv}`).toBeLessThan(w.maxHp * 1.1);
      expect(t.maxMana).withContext(`${lv}`).toBeLessThanOrEqual(w.maxMana);
      expect(t.maxMana).withContext(`${lv}`).toBeGreaterThan(w.maxMana * .9);
      expect(t.moveHaste).withContext(`${lv}`).toBeGreaterThan(w.moveHaste);
      expect(t.moveHaste - w.moveHaste).toBeLessThanOrEqual(.1);
      // The level's own pace is the same for every class (the speed cap's other half).
      expect(t.levelPace).toBe(w.levelPace);
    }
    const capped = fightStats(40, { vit: 0, ene: 0, spi: 0, agi: 30 }, { moveSpeed: 40 }, 'thornstrider');
    expect(capped.moveHaste).toBe(GEAR_CAPS.moveSpeed / 100);
  });

  it('the sky: the bow and the beast hunt at twilight (+15%), neutral otherwise; the briar keeps no hour', () => {
    for (const tr of ['thorn', 'wild'] as const) {
      expect(spellMult(tr, 'dawn')).withContext(tr).toBe(1.15);
      expect(spellMult(tr, 'dusk')).withContext(tr).toBe(1.15);
      for (const p of ['day', 'night', 'eclipse'] as const) expect(spellMult(tr, p)).withContext(`${tr} ${p}`).toBe(1);
    }
    for (const p of ['day', 'dawn', 'dusk', 'night', 'eclipse'] as const) expect(spellMult('briar', p)).withContext(p).toBe(1);
    // Twilight moves no other class's tree.
    for (const tr of ['ember', 'shadow', 'brand', 'ash', 'lamp', 'hearth', 'moth'] as const) expect(PHASE_RULES.dusk.spell[tr]).withContext(tr).toBe(1);
    expect(skyVars('wild')).toContain('pct');
    expect(skyVars('thorn')).toEqual(['min', 'max', 'dps']);
  });
});

describe('td-thorn: the fight', () => {
  function world(hp = 200): { sys: MobSystem; hurt: number[]; kills: string[]; keeper: { x: number; y: number; face: number }; life: { hp: number } } {
    const hurt: number[] = [], kills: string[] = [], keeper = { x: 0, y: 0, face: 1 }, life = { hp };
    const host: MobHost = {
      options: { onKill: (k: { creature: string }) => kills.push(k.creature) } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'spec', player: () => keeper,
      hurtPlayer: n => { hurt.push(n); life.hp = Math.max(0, life.hp - n); }, healPlayer: n => { life.hp += n; },
      swung: () => undefined, playerHp: () => life.hp,
    };
    const sys = new MobSystem(host);
    sys.vocation = 'thornstrider';
    sys.aura = null;
    sys.keeperMaxHp = 200;
    sys.setRanks(Object.fromEntries(CLASS_SKILLS.thornstrider.map(id => [id, 5])));
    sys.mana = sys.maxMana = 999;
    return { sys, hurt, kills, keeper, life };
  }
  const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
  const calm = (sys: MobSystem) => { for (const m of sys.mobs) { m.def = { ...m.def, sight: 0, dmg: [0, 0] }; m.wait = 1e9; } };
  const tough = (sys: MobSystem, hp = 5000) => { for (const m of sys.mobs) { m.def = { ...m.def, hp }; m.hp = hp; } };

  it('Thorn Shot: an arrow at a foe in its long reach — further than the Lanternwright\'s flare, never past it', () => {
    const { sys } = world();
    expect(sys.thorn).toBeTrue();
    expect(sys.range).toBeCloseTo(6 * TILE, 5);
    expect(sys.range).toBeGreaterThan(SKILLS['kindle'].vars['range'] * TILE);
    sys.place('far', MOBS['ash-wolf'], 7 * TILE, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 1);
    expect(sys.loosed).toBe(0);
    sys.mobs[0].x = 5 * TILE;
    run(sys, .2);
    expect(sys.loosed).toBeGreaterThan(0);
    expect(sys.arrows.length + (MOBS['ash-wolf'].hp - sys.mobs[0].hp > 0 ? 1 : 0)).toBeGreaterThan(0);
  });

  it('an arrow knocks its foe back along its flight, and kills, and tells the host', () => {
    const { sys, kills } = world();
    sys.place('wolf', MOBS['ash-wolf'], 3 * TILE, 0);
    calm(sys);
    tough(sys);
    sys.target = sys.mobs[0];
    const x0 = sys.mobs[0].x;
    run(sys, .6);
    expect(sys.mobs[0].x).toBeGreaterThan(x0);
    tough(sys, 30);
    run(sys, 8);
    expect(kills).toEqual(['ash-wolf']);
  });

  it('a pierce carries the arrow through to the next foe in its line', () => {
    const { sys } = world();
    // Both on the arrow's own line: it leaves the bow 20 px up, and strikes a creature at its middle.
    const y = MOBS['ash-wolf'].h / 2 - 20;
    sys.place('a', MOBS['ash-wolf'], 2 * TILE, y);
    sys.place('b', MOBS['ash-wolf'], 4 * TILE, y);
    calm(sys);
    tough(sys);
    const spy = spyOn(Math, 'random').and.returnValue(0);
    sys.target = sys.mobs[0];
    run(sys, .5);
    spy.and.callThrough();
    expect(sys.mobs[0].hp).toBeLessThan(5000);
    expect(sys.mobs[1].hp).toBeLessThan(5000);
  });

  it('Barbed Shot: the foe bleeds whole numbers a second for its seconds', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 2 * TILE, 0);
    calm(sys);
    tough(sys);
    sys.target = sys.mobs[0];
    sys.attacking = false;
    expect(sys.useAbility('barbed-shot')).toBeNull();
    run(sys, .3);
    const m = sys.mobs[0], v = sys.v('barbed-shot');
    expect(m.bleedT ?? 0).toBeGreaterThan(v['secs'] - 1);
    expect(m.bleedDps).toBe(v['dps']);
    sys.target = null;
    const before = m.hp;
    run(sys, 2.05);
    // Two ticks of the bleed (the power is 1, no crits).
    expect(before - m.hp).toBe(v['dps'] * 2);
  });

  it('Thornroot Snare: a creature crossing the line is rooted (it stands), a boss a fifth as long', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 3 * TILE, 0);
    tough(sys);
    sys.target = sys.mobs[0];
    expect(sys.useAbility('thornroot-snare')).toBeNull();
    run(sys, .1);
    const m = sys.mobs[0], v = sys.v('thornroot-snare');
    expect(m.rootT ?? 0).toBeGreaterThan(v['root'] - .2);
    const x = m.x, y = m.y;
    run(sys, .5);
    expect(Math.hypot(m.x - x, m.y - y)).toBeLessThan(.01);
    // Held once: the snare does not hold it again when the root runs out.
    run(sys, v['root']);
    expect(m.rootT ?? 0).toBe(0);
    const { sys: s2 } = world();
    s2.place('boss', MOBS['bone-dragon'] ?? MOBS['ash-wolf'], 3 * TILE, 0);
    s2.target = s2.mobs[0];
    s2.useAbility('thornroot-snare');
    run(s2, .05);
    if (s2.mobs[0].def.rank === 'boss') expect(s2.mobs[0].rootT ?? 0).toBeLessThanOrEqual(v['root'] * BOSS_CC + .01);
  });

  it('Bramble Trap: two at most; the first creature on it springs it, struck and rooted', () => {
    const { sys } = world();
    for (let i = 0; i < 3; i++) { sys.cooldowns['bramble-trap'] = 0; expect(sys.useAbility('bramble-trap')).toBeNull(); }
    expect(sys.zones.filter(z => z.kind === 'trap').length).toBe(2);
    sys.place('a', MOBS['ash-wolf'], 0, 2);
    calm(sys);
    tough(sys);
    run(sys, .1);
    expect(sys.zones.filter(z => z.kind === 'trap').length).toBe(0);
    expect(sys.mobs[0].hp).toBeLessThan(5000);
    expect(sys.mobs[0].rootT ?? 0).toBeGreaterThan(0);
  });

  it('the pet fights harder for a Thornstrider: the bite grows, Pack Bond and Command lift it further', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 20, 0);
    calm(sys);
    tough(sys);
    const m = sys.mobs[0], bite = (n: number) => { const h = m.hp; sys.petBite(m, n, 1); return h - m.hp; };
    sys.keeperLevel = 10;
    const plain = bite(4);
    sys.vocation = 'warlock';
    expect(bite(4)).toBe(4);
    sys.vocation = 'thornstrider';
    expect(plain).toBeGreaterThan(4);
    // Pack Bond: the aura runs and the beast is near.
    sys.aura = 'pack-bond';
    sys.beast = { x: 10, y: 0 };
    expect(sys.bonded).toBeTrue();
    const bonded = bite(4);
    expect(bonded).toBeGreaterThan(plain);
    sys.beast = { x: 40 * TILE, y: 0 };
    expect(sys.bonded).toBeFalse();
    sys.beast = { x: 10, y: 0 };
    // Command: on the commanded foe it bites harder still.
    sys.target = m;
    expect(sys.useAbility('command')).toBeNull();
    expect(sys.commanded).toBe(m);
    expect(sys.commands).toBe(1);
    expect(bite(4)).toBeGreaterThan(bonded);
    run(sys, sys.v('command')['secs'] + .2);
    expect(sys.commanded).toBeNull();
  });

  it('Pack Bond shares the blows the Keeper takes while the beast is near', () => {
    const { sys, hurt } = world();
    sys.place('a', MOBS['ash-wolf'], 6, 0);
    const m = sys.mobs[0];
    m.def = { ...m.def, dmg: [40, 40], sight: 999 };
    m.cd = 0;
    run(sys, .05);
    const plain = hurt[hurt.length - 1];
    expect(plain).toBe(40);
    sys.aura = 'pack-bond';
    sys.beast = { x: 4, y: 0 };
    m.cd = 0;
    run(sys, .05);
    expect(hurt[hurt.length - 1]).toBe(bondShare(40, sys.v('pack-bond')['guard']));
    expect(hurt[hurt.length - 1]).toBeLessThan(plain);
  });

  it('Call of the Wilds: a second beast hunts beside the Keeper and is gone when its time runs out', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 3 * TILE, 0);
    calm(sys);
    tough(sys);
    sys.attacking = false;
    expect(sys.useAbility('call-of-the-wilds')).toBeNull();
    expect(sys.beasts.filter(b => b.kind === 'called').length).toBe(1);
    run(sys, 4);
    expect(sys.mobs[0].hp).toBeLessThan(5000);
    // A second call sends the first back: one at a time.
    sys.cooldowns['call-of-the-wilds'] = 0;
    sys.useAbility('call-of-the-wilds');
    expect(sys.beasts.filter(b => b.kind === 'called').length).toBe(1);
    run(sys, sys.v('call-of-the-wilds')['secs'] + .5);
    expect(sys.beasts.length).toBe(0);
  });

  it('the Stampede: spectral beasts charge through, striking each foe once and knocking it back, then are gone', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 3 * TILE, 0);
    calm(sys);
    tough(sys);
    sys.target = sys.mobs[0];
    sys.attacking = false;
    const x0 = sys.mobs[0].x;
    expect(sys.useAbility('stampede')).toBeNull();
    expect(sys.beasts.filter(b => b.kind === 'stampede').length).toBe(Math.floor(sys.v('stampede')['count']));
    run(sys, 3);
    expect(sys.beasts.length).toBe(0);
    const lost = 5000 - sys.mobs[0].hp, v = sys.v('stampede');
    expect(lost).toBeGreaterThanOrEqual(v['min']);
    expect(sys.mobs[0].x).toBeGreaterThan(x0 + 4);
  });

  it('Volley: a fan of arrows, each striking the first foe in its own line', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 3 * TILE, 0);
    calm(sys);
    tough(sys);
    sys.target = sys.mobs[0];
    sys.attacking = false;
    const before = sys.loosed;
    expect(sys.useAbility('volley')).toBeNull();
    expect(sys.loosed - before).toBe(Math.floor(sys.v('volley')['count']));
    run(sys, 1);
    expect(sys.mobs[0].hp).toBeLessThan(5000);
  });

  it('Rootwalk: creatures lose the Keeper\'s track while it lasts (one at his very side still bites)', () => {
    const { sys } = world();
    sys.place('a', MOBS['ash-wolf'], 5 * TILE, 0);
    const m = sys.mobs[0];
    m.def = { ...m.def, sight: 999 };
    expect(sys.useAbility('rootwalk')).toBeNull();
    expect(sys.rootwalkT).toBeGreaterThan(0);
    const d0 = Math.hypot(m.x, m.y);
    run(sys, 1);
    expect(Math.hypot(m.x, m.y)).toBeGreaterThanOrEqual(d0 - 45);
    run(sys, sys.v('rootwalk')['secs']);
    expect(sys.rootwalkT).toBe(0);
  });

  for (const id of THORN.filter(i => SKILLS[i].kind === 'active')) {
    it(`${id} executes and plays out without throwing`, () => {
      const { sys } = world();
      sys.place('a', MOBS['bone-walker'], 40, 0);
      sys.place('b', MOBS['ash-wolf'], 44, 8);
      sys.target = sys.mobs[0];
      expect(sys.useAbility(id)).withContext(id).toBeNull();
      expect(() => run(sys, 3)).not.toThrow();
    });
  }

  it('at twilight the bow and the beasts hit harder, by the sky\'s own numbers', () => {
    const { sys } = world();
    const base = skillVars('thorn-shot', 5)['max'], cmd = skillVars('command', 5)['pct'];
    expect(sys.v('thorn-shot')['max']).toBe(base);
    sys.setPhase('dusk', true);
    expect(sys.v('thorn-shot')['max']).toBe(Math.round(base * 1.15));
    expect(sys.v('command')['pct']).toBe(Math.round(cmd * 1.15));
    expect(sys.v('thornroot-snare')['min']).toBe(skillVars('thornroot-snare', 5)['min']);
    sys.setPhase('night', true);
    expect(sys.v('thorn-shot')['max']).toBe(base);
  });

  it('the other classes never loose arrows, never bond, and their pets bite as before', () => {
    const { sys } = world();
    sys.vocation = 'warlock';
    sys.setRanks(null);
    sys.aura = 'pack-bond';
    sys.beast = { x: 2, y: 0 };
    expect(sys.bonded).toBeFalse();
    sys.place('a', MOBS['ash-wolf'], 40, 0);
    calm(sys);
    sys.target = sys.mobs[0];
    run(sys, 2);
    expect(sys.loosed).toBe(0);
    expect(sys.arrows.length).toBe(0);
  });
});

describe('td-thorn: the trees and the saves', () => {
  it('clamps a Thornstrider\'s tree: another class\'s points drop, tiers and prerequisites hold, the level\'s points cap it', () => {
    const t: KeeperSkillTree = { spent: { 'bone-spear': 3, 'banish': 2, 'call-of-the-wilds': 2, 'stampede': 1, 'bramble-trap': 2 }, free: [], at: 0 };
    expect(clampTree(t, 'thornstrider', 30).spent).toEqual({ 'call-of-the-wilds': 2, 'stampede': 1, 'bramble-trap': 2 });
    // Level 5: the Call (6) and the trap (6) are not open yet, nor the Stampede (24).
    expect(clampTree(t, 'thornstrider', 5).spent).toEqual({});
    expect(clampTree(t, 'lanternwright', 30).spent).toEqual({ 'banish': 2 });
    // The book's rule: the kit's free Command is a rank above it, so the Stampede opens at its level.
    expect(rankBlock(empty(), 'thornstrider', 'stampede', 30)).toBeNull();
    expect(rankBlock(empty(), 'thornstrider', 'wild-heart', 30)).toBe('folded');
    const tree = buyRank(empty(), 'thornstrider', 'stampede', 30);
    expect(rankOf(tree!, 'thornstrider', 'stampede')).toBe(1);
    expect(clampTree({ spent: { 'stampede': 2, heartwood: 4 }, free: [], at: 0 }, 'thornstrider', 30).spent).toEqual({ 'stampede': 2 });
    for (let lv = 1; lv <= 30; lv++) expect(pointsSpent(clampTree(t, 'thornstrider', lv))).toBeLessThanOrEqual(skillPointsEarned(lv));
    expect(rankBlock(empty(), 'thornstrider', 'banish', 30)).toBe('class');
    expect(rankBlock(empty(), 'lanternwright', 'stampede', 30)).toBe('class');
  });

  it('old saves still load: no calling is a Warlock, the other three stay theirs, a Thornstrider is kept', () => {
    expect(coerceLook({ made: true, name: 'Aster', bar: ['drain-life'], updatedAt: 3 }).vocation).toBe('warlock');
    for (const v of ['ashguard', 'lanternwright', 'thornstrider'] as const) expect(coerceLook({ vocation: v, made: true }).vocation).toBe(v);
    expect(coerceLook({ vocation: 'ranger' }).vocation).toBe('warlock');
    expect(defaultLook().vocation).toBe('warlock');
    const merged = mergeKeeperLook({ vocation: 'thornstrider', updatedAt: 5 }, { updatedAt: 2 }) as { vocation: string };
    expect(merged.vocation).toBe('thornstrider');
    const old = coerceLook({ made: true, bar: ['bone-spear'], aura: 'aura-siphon' });
    expect(effectiveRanks(old.tree, old.vocation)['bone-spear']).toBe(1);
    expect(effectiveRanks(old.tree, old.vocation)['thorn-shot'] ?? 0).toBe(0);
  });

  it('the look: the ranger\'s kit stands in (a hood, a coat, a bow) with the quiver on the back; worn gear wins', () => {
    const bare = vocationLook('thornstrider', null);
    expect(bare.garb).toEqual(THORN_GARB);
    expect(bare.garb?.quiver).toBeTruthy();
    expect(bare.gear?.head?.kind).toBe('hood');
    expect(bare.gear?.chest?.kind).toBe('coat');
    expect(bare.gear?.weapon?.kind).toBe('bow');
    expect(bare.gear?.['off-hand']).toBeUndefined();
    const sword = vocationLook('thornstrider', { weapon: { slot: 'weapon', kind: 'sword', style: 'infernal', rarity: 'rare' } });
    expect(sword.gear?.weapon?.kind).toBe('sword');
    expect(sword.garb?.quiver).toBeTruthy();
    expect(sword.gear?.chest).toEqual(THORN_KIT.chest);
  });
});
