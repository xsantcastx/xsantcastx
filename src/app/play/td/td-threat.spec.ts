/**
 * td-threat.spec.ts — who a creature goes for (S5, skills-100.md §0.5): the most threat in reach; nobody on its ledger,
 * the nearest; the Ashguard's book ×2; a heal ×0.5 split over the creatures fighting the healed; a taunt the top +10%.
 * Also the allies' side of the screen (S5): a heal goes to the lowest ally, a ward and a guard mirror what the room laid,
 * Rekindle kneels where a party member fell.
 */
import type { EngineOptions } from '../engine/engine.model';
import { TILE } from './td-art';
import { MOBS, MobSystem, type Minion, type Mob, type MobHost, type RoomKin } from './td-mobs';
import { THREAT, addThreat, damageThreat, healThreat, kinKey, pickByThreat, pickKin, tauntThreat, threatMult, topThreat } from './td-threat';
import { KeeperLife } from '../world/keeper-life';
import { allyLegal, parseAllyClaim } from '../world/ally-claims';
import { CLASS_SKILLS, SKILLS, type SkillId } from './td-skills';
import { MARKS } from './td-marks';

function world(voc: 'ashguard' | 'lanternwright' | 'warlock' = 'ashguard') {
  const keeper = { x: 0, y: 0, face: 1 }, life = { hp: 5000 }, bitten: string[] = [];
  const host: MobHost = {
    options: { onKill: () => undefined } as unknown as EngineOptions,
    walkable: () => true, levelId: () => 'threat', player: () => keeper,
    hurtPlayer: n => { life.hp -= n; bitten.push(''); }, healPlayer: n => { life.hp += n; },
    swung: () => undefined, playerHp: () => life.hp, dash: (x, y) => { keeper.x = x; keeper.y = y; }, seek: () => true,
  };
  const sys = new MobSystem(host);
  sys.vocation = voc; sys.aura = null; sys.keeperMaxHp = 5000; sys.keeperLevel = 30;
  sys.mana = sys.maxMana = 99999; sys.power = 1; sys.crit = 0;
  // The room's others: their bites go out through the co-op link.
  sys.coop = { bite: to => { bitten.push(to); }, killed: () => undefined, claim: () => undefined };
  return { sys, keeper, life, bitten };
}
const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs - 1e-9; t += dt) sys.update(dt); };
function wolf(sys: MobSystem, x: number, y = 0, speed = 0): Mob {
  const m = sys.place(`w${sys.mobs.length}`, { ...MOBS['ash-wolf'], hp: 1e7, sight: 400, speed, rate: .4, dmg: [5, 5] }, x, y);
  m.hp = 1e7;
  return m;
}

describe('td-threat: the ledger', () => {
  it('the Ashguard\'s book makes threat ×2; anything else ×1', () => {
    expect(threatMult('watch-blade')).toBe(2);
    expect(threatMult('brand-throw')).toBe(2);
    expect(threatMult('ember-bolt')).toBe(1);
    expect(threatMult(null)).toBe(1);
    const m = {};
    damageThreat(m, 'a', 50, 'shield-bash'); damageThreat(m, 'b', 90, 'meteor');
    expect(pickByThreat(m, [{ id: 'a', d: 50 }, { id: 'b', d: 10 }])!.id).toBe('a');
  });
  it('nobody on the ledger: the nearest; a challenger must clear the holder by 10%', () => {
    const m = {};
    expect(pickByThreat(m, [{ id: 'a', d: 50 }, { id: 'b', d: 10 }])!.id).toBe('b');
    addThreat(m, 'a', 100); addThreat(m, 'b', 105);
    expect(pickByThreat(m, [{ id: 'a', d: 5 }, { id: 'b', d: 5 }], 'a')!.id).toBe('a');
    addThreat(m, 'b', 10);
    expect(pickByThreat(m, [{ id: 'a', d: 5 }, { id: 'b', d: 5 }], 'a')!.id).toBe('b');
  });
  it('a heal is ×0.5, split over the creatures fighting the healed; a taunt sets the taunter to the top +10%', () => {
    const a = {}, b = {}, c = {};
    addThreat(a, 'tank', 10); addThreat(b, 'tank', 10);
    healThreat([a, b, c], 'tank', 'heal', 100);
    expect((a as { threat: Map<string, number> }).threat.get('heal')).toBe(25);
    expect((c as { threat?: Map<string, number> }).threat).toBeUndefined();
    addThreat(a, 'dps', 500);
    tauntThreat(a, 'tank');
    expect(topThreat(a)).toBeCloseTo(500 * THREAT.tauntTop, 5);
    // Said again while on top it does not climb.
    tauntThreat(a, 'tank');
    expect(topThreat(a)).toBeCloseTo(500 * THREAT.tauntTop, 5);
  });
});

describe('td-threat: creatures go for the most threat in reach (the screen\'s MobSystem; the room runs the same)', () => {
  it('a wolf turns from the nearest Keeper to the one that hurt it most', () => {
    const { sys, bitten } = world('warlock');
    const m = wolf(sys, 20, 0, 60);
    sys.others = [{ id: 'mage', x: 60, y: 0 }];
    run(sys, 1);
    expect(m.threatOn).toBe('');
    sys.applyClaim(m, 300, 'mage');
    bitten.length = 0;
    run(sys, 3);
    expect(m.threatOn).toBe('mage');
    expect(bitten.filter(b => b === 'mage').length).toBeGreaterThan(0);
  });
  it('a tank holds a creature off the healer: his blows ×2 and his Watch Cry outweigh her heals', () => {
    const { sys, bitten } = world('ashguard');
    sys.setRanks({ 'watch-blade': 5, 'watch-cry': 5 });
    const m = wolf(sys, 18);
    sys.others = [{ id: 'healer', x: -30, y: 0 }];
    sys.target = m; sys.attacking = true;
    for (let i = 0; i < 40; i++) {
      // The healer mends the tank every half second (about his blade's damage a second): heal threat ×0.5.
      healThreat(sys.mobs, '', 'healer', 15);
      run(sys, .5);
      if (i === 10) { sys.cooldowns['watch-cry'] = 0; expect(sys.useAbility('watch-cry')).toBeNull(); }
    }
    expect(m.threatOn).toBe('');
    expect(bitten.filter(b => b === 'healer').length).toBe(0);
  });
});

describe('S5: the allies on the screen', () => {
  it('Hearthlight goes to the lowest ally in reach (the Keeper among them); alone, to the Keeper', () => {
    const { sys, life } = world('lanternwright');
    sys.setRanks({ 'hearthlight': 5 });
    sys.allies = [{ id: 'a', x: TILE, y: 0, h: 20, m: 100 }, { id: 'b', x: TILE, y: 8, h: 90, m: 100 }];
    expect(sys.useAbility('hearthlight')).toBeNull();
    run(sys, 3.2);
    expect(sys.allyOut.every(c => c.k === 'heal' && c.to === 'a')).toBeTrue();
    expect(sys.allyOut.reduce((s, c) => s + c.n, 0)).toBe(Math.round(sys.v('hearthlight')['heal'] * sys.healLevel()));
    // A tap picks the other a while.
    sys.allyOut = []; sys.pickAlly('b'); sys.cooldowns['hearthlight'] = 0; sys.useAbility('hearthlight'); run(sys, 3.2);
    expect(sys.allyOut.every(c => c.to === 'b')).toBeTrue();
    // Alone: the Keeper.
    sys.allies = []; sys.allyOut = []; life.hp = 100; sys.cooldowns['hearthlight'] = 0; sys.useAbility('hearthlight'); run(sys, 3.2);
    expect(life.hp).toBeGreaterThan(100);
    expect(sys.allyOut.length).toBe(0);
  });
  it('a ward, a Banner and a bond another laid on this Keeper cut its bites as the room cuts them', () => {
    const { sys, life } = world('warlock');
    sys.allyLaid({ a: 'aura', by: 't', s: 'banner-of-the-watch', n: 20, t: 20 });
    expect(sys.allyCut(100)).toBe(80);
    sys.allyLaid({ a: 'bond', by: 't', s: 'intercept', n: 50, t: 60 });
    expect(sys.allyCut(100)).toBe(40);
    sys.allyLaid({ a: 'ward', by: 'h', s: 'lantern-ward', n: 30, t: 120 });
    const before = life.hp;
    sys.coopBite(100, 'physical', null, false, false);
    expect(before - life.hp).toBe(40 - 30);
  });
  it('Rekindle kneels by a fallen party member and asks the room to stand it up; a blow breaks the kneel', () => {
    const { sys } = world('lanternwright');
    sys.setRanks({ 'rekindle': 1 });
    expect(sys.useAbility('rekindle')).toBe('nofallen');
    sys.fallenAllies.set('m', { x: TILE, y: 0, at: Date.now() });
    expect(sys.useAbility('rekindle')).toBeNull();
    expect(sys.footing).toBe(0);
    run(sys, sys.v('rekindle')['channel'] + .1);
    expect(sys.allyOut).toEqual([{ k: 'rekindle', s: 'rekindle', to: 'm', n: sys.v('rekindle')['pct'] }]);
  });
  it('the room\'s life: an ally\'s heal within its share, a Rekindle up at its share; the wire refuses forgeries', () => {
    const L = new KeeperLife({ max: 1000, defense: 0, resists: {}, level: 30 }, 100);
    expect(L.allyHeal(200, 0)).toBe(200);
    // At most 60% of the most a second over the window, from every healer together.
    expect(L.allyHeal(5000, 10)).toBe(1000 - 300);
    L.hp = 0; L.down = true;
    expect(L.rekindle(40)).toBe(400);
    expect(L.down).toBeFalse();
    expect(parseAllyClaim({ k: 'heal', s: 'hearthlight', to: 'x', n: -1 })).toBeNull();
    expect(allyLegal({ k: 'heal', s: 'hearthlight', to: 'b', n: 10 }, { id: 'a', x: 0, y: 0, level: 5 }, { id: 'b', x: 30 * 16, y: 0, level: 5 })).toBe('far');
    expect(allyLegal({ k: 'rekindle', s: 'rekindle', to: 'b', n: 40 }, { id: 'a', x: 0, y: 0, level: 29 }, { id: 'b', x: 0, y: 0, level: 5 })).toBe('level');
  });
});

describe('S5: every ally claim the screen makes is one the room accepts', () => {
  it('each row at rank 20, with either star and every mark it allows, says only legal, well-formed claims', () => {
    const MASKS = [1 | 2 | 4 | 8 | 16, 1 | 2 | 8 | 16 | 32];
    const rows: { id: SkillId; voc: 'ashguard' | 'lanternwright' | 'warlock' | 'thornstrider' }[] = [];
    for (const voc of ['ashguard', 'lanternwright', 'warlock', 'thornstrider'] as const) for (const id of CLASS_SKILLS[voc]) if (MARKS[id]) rows.push({ id, voc });
    let seen = 0;
    for (const { id, voc } of rows) for (const mask of MASKS) {
      const { sys } = world(voc as 'ashguard');
      sys.vocation = voc;
      sys.setRanks({ [id]: 20, 'watch-blade': 20, 'aura-watchfire': 20, 'hearth-circle': 20, 'shield-oath': 20, 'raise-skeleton': 1, 'drain-life': 20 }, null, { [id]: mask });
      sys.allies = [{ id: 'a', x: TILE, y: 0, h: 10, m: 100 }, { id: 'b', x: TILE, y: 10, h: 30, m: 100 }];
      sys.fallenAllies.set('a', { x: TILE, y: 0, at: Date.now() });
      wolf(sys, 2 * TILE);
      if (SKILLS[id].kind === 'aura') sys.aura = id;
      sys.target = sys.mobs[0];
      sys.cooldowns[id] = 0;
      if (SKILLS[id].kind === 'active') sys.useAbility(id);
      run(sys, 4);
      for (const c of sys.allyOut) {
        seen++;
        const wire = parseAllyClaim(JSON.parse(JSON.stringify(c)));
        expect(wire).withContext(`${id} ${mask}: ${JSON.stringify(c)}`).not.toBeNull();
        const to = c.to ? { id: c.to, x: TILE, y: 0, level: 100 } : null;
        expect(allyLegal(wire!, { id: 'me', x: 0, y: 0, level: 100 }, to)).withContext(`${id} ${mask}: ${JSON.stringify(c)}`).toBeNull();
      }
    }
    expect(seen).toBeGreaterThan(20);
  });
});

describe('td-threat: summons (the raised are prey too — on the screen and in the room)', () => {
  it('pickKin: a summon that out-threatens takes it; one guarding the Keeper it would go for steps into its face; never another\'s holder', () => {
    const m: { threat?: Map<string, number>; threatOn?: string } = {};
    const tank = { id: 'tank', d: 30 }, near = { id: 'lock/k1', owner: 'lock', d: 10 };
    // Nobody has threat: the nearest summon steps in front.
    expect(pickKin(m, tank, [near], 6)?.id).toBe('lock/k1');
    // The tank holds it: another Keeper's skeleton beside it does not pull it off him…
    addThreat(m, 'tank', 50); m.threatOn = 'tank';
    expect(pickKin(m, tank, [near], 6)).toBeNull();
    // …until its own blows out-threaten him by 10%.
    addThreat(m, 'lock/k1', 54);
    expect(pickKin(m, tank, [near], 6)).toBeNull();
    addThreat(m, 'lock/k1', 2);
    expect(pickKin(m, tank, [near], 6)?.id).toBe('lock/k1');
    // The Warlock's own skeletons guard him: nearer than he is, they draw what goes for him.
    const lock = { id: 'lock', d: 30 }, m2 = { threat: new Map([['lock', 100]]), threatOn: 'lock' };
    expect(pickKin(m2, lock, [near], 6)?.id).toBe('lock/k1');
    expect(kinKey('', 'k3')).toBe('/k3');
  });
  it('the room: a wolf on the Keeper turns to another Keeper\'s skeleton that out-threatens it, and bites it', () => {
    const { sys } = world('warlock');
    const kin: RoomKin = { key: 'lock/k1', owner: 'lock', i: 'k1', x: 30, y: 0, hp: 400, maxHp: 400, g: 0 };
    const struck: { k: string; d: number }[] = [];
    sys.kin = [kin];
    sys.coop = { bite: () => undefined, killed: () => undefined, claim: () => undefined, kinBite: (k, _m, d) => { struck.push({ k: k.key, d }); } };
    const m = wolf(sys, 10, 0, 60);
    sys.applyClaim(m, 200, '');
    run(sys, 1);
    expect(m.threatOn).toBe('');
    // The skeleton's blows are its own threat (a claim naming it), and they clear the Keeper's.
    sys.applyClaim(m, 300, 'lock', false, '', '', 'k1');
    expect(m.threat?.get('lock/k1')).toBe(300);
    expect(m.threat?.get('lock') ?? 0).toBe(0);
    run(sys, 3);
    expect(m.threatOn).toBe('lock/k1');
    expect(struck.length).toBeGreaterThan(0);
    expect(kin.hp).toBeLessThan(400);
  });
  it('solo: a Captain\'s taunt turns a creature from the Keeper onto the Captain, which takes the bites', () => {
    const { sys, bitten } = world('warlock');
    const cap: Minion = { id: 5, x: 40, y: 0, hp: 300, maxHp: 300, dmg: [1, 1], cd: 99, t: 0, face: 1, life: Infinity, hit: 0, target: null, captain: true };
    sys.minions.push(cap);
    const m = wolf(sys, 10, 0, 60);
    sys.applyClaim(m, 500, '');
    bitten.length = 0;
    m.taunt = 3; m.tauntBy = kinKey('', 'k5');
    run(sys, 2);
    expect(cap.hp).toBeLessThan(300);
    expect(bitten.length).toBe(0);
  });
});
