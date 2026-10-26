/**
 * td-abilities.spec.ts — S6: the creatures' abilities (tells, counters, interrupts, raises), the pack auras and the
 * new elite affixes (docs/design/monsters-abilities.md), through the real MobSystem.
 */
import type { EngineOptions } from '../engine/engine.model';
import { BOSS_TELL, MOBS, MobSystem, bearerAura, samePack, type Mob, type MobHost } from './td-mobs';
import { ABILITIES, GROUND_TELL, abilitiesOf, castable, decodeStatus, encodeStatus, tierCd } from './td-abilities';
import { ABILITIES_I18N } from './td-abilities.i18n';
import { PACK_AURA_IDS, PACK_AURA_REACH, landOf, packAuraFx, packAuraLevel, packAuraPool } from './td-pack-aura';
import { AFFIX_DEFS, affixAllowed, affixCount, auraAffix, makePack, packFollowers, rollAffixes, rollElite } from './td-elites';
import { seededRandom } from '../../shared/loot/champions';
import { atZoneLevel } from './td-zones';

function world(keeper = { x: 0, y: 0 }, level = 'spec'): { sys: MobSystem; hurt: number[]; keeper: { x: number; y: number } } {
  const hurt: number[] = [];
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => level, player: () => keeper,
    hurtPlayer: n => hurt.push(n), healPlayer: () => undefined, swung: () => undefined,
    dash: (x, y) => { keeper.x = x; keeper.y = y; },
  };
  const sys = new MobSystem(host);
  sys.aura = null; sys.keeperMaxHp = 400; sys.keeperLevel = 30;
  return { sys, hurt, keeper };
}
const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
const place = (sys: MobSystem, type: string, x: number, y: number, level = MOBS[type].level): Mob => sys.place(`${type}@${x},${y}`, atZoneLevel(MOBS[type], level), x, y);

describe('td-abilities: the table', () => {
  it('every ability has its name and counter in EN and ES, and every creature it names exists', () => {
    for (const [id, list] of Object.entries(ABILITIES)) {
      expect(MOBS[id]).withContext(id).toBeDefined();
      for (const a of list) {
        for (const k of [`ab.name.${a.id}`, `ab.counter.${a.id}`]) { expect(ABILITIES_I18N[k]?.en).withContext(k).toBeTruthy(); expect(ABILITIES_I18N[k]?.es).withContext(k).toBeTruthy(); }
      }
    }
  });
  it('the telegraph rule: a ground tell is never shorter than BOSS_TELL; a big blow always has one', () => {
    for (const list of Object.values(ABILITIES)) for (const a of list) {
      if (a.ground) expect(a.tell).withContext(a.id).toBeGreaterThanOrEqual(GROUND_TELL);
      if ((a.b ?? 0) * (a.n ?? 1) >= 1.2 && a.kind !== 'passive') expect(a.ground).withContext(a.id).toBeTrue();
    }
    expect(GROUND_TELL).toBe(BOSS_TELL);
  });
  it('tiers shorten cooldowns, never tells', () => {
    expect(tierCd(10, 'normal')).toBe(10);
    expect(tierCd(10, 'nightmare')).toBeCloseTo(8.5);
    expect(tierCd(10, 'hell')).toBeCloseTo(7);
  });
  it('statuses travel the wire and come back', () => {
    const w = encodeStatus([{ s: 'stun', t: .8 }, { s: 'burn', t: 4, dps: 12 }]);
    expect(w).toBe('stun:8,burn:40/12');
    expect(decodeStatus(w)).toEqual([{ s: 'stun', t: .8, dps: 0 }, { s: 'burn', t: 4, dps: 12 }]);
    expect(decodeStatus('evil:1;drop')).toEqual([]);
  });
});

describe('td-abilities: in the fight', () => {
  it('Glass Quake: a ring after its wind-up; standing in it hurts and stuns, then the Keeper is immune a while', () => {
    const { sys, hurt, keeper } = world({ x: 30, y: 0 });
    const g = place(sys, 'obsidian-golem', 0, 0);
    g.ab = [0];
    sys.update(.02);
    expect(g.abCast).toBe(0);
    expect(sys.bursts.some(b => b.by === g && b.tone === 'glass')).toBeTrue();
    run(sys, .9);
    expect(hurt.length).toBeGreaterThan(0);
    expect(sys.kst.stun).toBeGreaterThan(0);
    expect(sys.kst.immune).toBeGreaterThan(sys.kst.stun);
    expect(sys.held).toBeTrue();
    // Immune: a second stun inside the window does not land.
    sys.layOn('stun:8');
    expect(sys.kst.stun).toBeLessThan(.8);
    expect(keeper.x).toBe(30);
  });
  it('stepping out of the ring in its tell: nothing lands', () => {
    const { sys, hurt, keeper } = world({ x: 30, y: 0 });
    const g = place(sys, 'obsidian-golem', 0, 0);
    g.ab = [0]; g.cd = 99;
    sys.update(.02);
    keeper.x = 200;
    run(sys, 1);
    expect(hurt.length).toBe(0);
    expect(sys.kst.stun).toBe(0);
  });
  it('a stun in a cast\'s tell interrupts it: its ring is taken back and its cooldown starts at half', () => {
    const { sys, hurt } = world({ x: 30, y: 0 });
    const g = place(sys, 'obsidian-golem', 0, 0);
    g.ab = [0]; g.cd = 99;
    sys.update(.02);
    g.stun = 1;
    sys.update(.02);
    expect(g.abCast).toBeUndefined();
    expect(sys.bursts.some(b => b.by === g)).toBeFalse();
    expect(g.ab![0]).toBeCloseTo(castable('obsidian-golem')[0].cd / 2, 0);
    run(sys, 1);
    expect(hurt.length).toBe(0);
  });
  it('the Ashsinger sings a fallen orc back up at half its life; it owes nothing, and fire leaves ash nothing raises', () => {
    const { sys } = world({ x: 0, y: 0 });
    const kills: unknown[] = [];
    (sys as unknown as { host: MobHost }).host.options.onKill = e => kills.push(e);
    const orc = place(sys, 'cinder-orc', 60, 0), singer = place(sys, 'ashsinger', 80, 30);
    sys.wound(orc, orc.hp + 5);
    expect(sys.remains.length).toBe(1);
    singer.ab = [0, 9];
    run(sys, 1.2);
    const up = sys.mobs.find(m => m.def.id === 'cinder-orc');
    expect(up).toBeDefined();
    expect(up!.raised).toBeTrue();
    expect(up!.hp).toBeCloseTo(up!.def.hp * .5, -1);
    expect(singer.raisedOne).toBeTrue();
    expect(bearerAura(singer, 'surface')).toBe('fanaticism');
    const before = kills.length;
    sys.wound(up!, up!.hp + 5);
    expect(kills.length).toBe(before);
    // Its second corpse is laid to rest; a fire kill turns an orc to ash: neither rises.
    const orc2 = place(sys, 'cinder-orc', 50, 10);
    (sys as unknown as { fireBlow: boolean }).fireBlow = true;
    sys.wound(orc2, orc2.hp + 5);
    (sys as unknown as { fireBlow: boolean }).fireBlow = false;
    expect(sys.remains.every(cp => cp.ash || cp.rested)).toBeTrue();
    singer.ab = [0, 9];
    run(sys, 1.2);
    expect(sys.mobs.filter(m => m.def.id === 'cinder-orc').length).toBe(0);
  });
  it('killing the singer in its song: nothing rises', () => {
    const { sys } = world();
    const orc = place(sys, 'cinder-orc', 60, 0), singer = place(sys, 'ashsinger', 80, 30);
    sys.wound(orc, orc.hp + 5);
    singer.ab = [0, 9];
    sys.update(.02);
    expect(sys.calls.length).toBe(1);
    sys.wound(singer, singer.hp + 5);
    run(sys, 1.2);
    expect(sys.mobs.some(m => m.def.id === 'cinder-orc')).toBeFalse();
  });
  it('Ember Breath lays a burn that bites once a second', () => {
    const { sys, hurt } = world({ x: 30, y: 0 });
    const h = place(sys, 'lava-hound', 0, 0);
    h.ab = [0]; h.cd = 99;
    run(sys, 1.2);
    expect(sys.kst.burn.t).toBeGreaterThan(0);
    const n = hurt.length;
    run(sys, 2.1);
    expect(hurt.length).toBeGreaterThan(n);
  });
});

describe('td-pack-aura: pack auras', () => {
  it('the aura level rises with the zone and the tier, and the table matches §3 at zone 10 and 40', () => {
    expect(packAuraLevel(10)).toBe(3);
    expect(packAuraLevel(40)).toBe(9);
    expect(packAuraLevel(40, 'hell')).toBe(13);
    expect(packAuraFx('might', 3).blow).toBeCloseTo(1.3);
    expect(packAuraFx('might', 9).blow).toBeCloseTo(1.6);
    expect(packAuraFx('conviction', 9).resistLower).toBe(37);
    expect(packAuraFx('fanaticism', 3).rate).toBeCloseTo(1.24);
    expect(packAuraFx('cant-chorus', 9).cd).toBeCloseTo(.71);
  });
  it('the Orc Warlord blesses its kin within 4 tiles with Might, not farther; its fall ends it at once', () => {
    const { sys } = world({ x: 900, y: 900 });
    const lord = place(sys, 'orc-warlord', 0, 0), near = place(sys, 'cinder-orc', 30, 0), far = place(sys, 'cinder-orc', PACK_AURA_REACH + 30, 0), wolf = place(sys, 'ash-wolf', 20, 10);
    sys.update(.02);
    expect(lord.aura).toBe('might');
    expect(near.bless?.id).toBe('might');
    expect(far.bless).toBeNull();
    expect(wolf.bless).toBeNull();
    sys.wound(lord, lord.hp + 5);
    sys.update(.02);
    expect(near.bless).toBeNull();
  });
  it('an Aura Enchanted leader blesses its own pack only; a strip ends it a while', () => {
    const { sys } = world({ x: 900, y: 900 });
    const pack = sys.spawnPack('p1', MOBS['cinder-orc'], 0, 0, makePack('unique', ['aura-conviction', 'extra-strong'], 'Sim', 2));
    const other = place(sys, 'cinder-orc', 10, 10);
    sys.update(.02);
    expect(auraAffix(pack[0].elite!.affixes)).toBe('conviction');
    expect(pack.every(m => m.bless?.id === 'conviction')).toBeTrue();
    expect(samePack(pack[0], other)).toBeFalse();
    expect(other.bless).toBeNull();
    sys.stripAura(pack[1]);
    sys.update(.02);
    expect(pack[0].aura).toBeNull();
    expect(pack[1].bless).toBeNull();
  });
  it('Conviction lowers his resists in reach; the Gloam Witch\'s Lightless shortens his light', () => {
    const { sys } = world({ x: 10, y: 0 });
    sys.spawnPack('p1', MOBS['cinder-orc'], 0, 0, makePack('unique', ['aura-conviction'], 'Sim', 1));
    for (const m of sys.mobs) { m.def = { ...m.def, sight: 0 }; m.wait = 1e9; }
    sys.update(.02);
    expect(sys.packResist).toBe(packAuraFx('conviction', packAuraLevel(10)).resistLower);
    const w = world({ x: 10, y: 0 });
    const witch = place(w.sys, 'gloam-witch', 0, 0);
    witch.def = { ...witch.def, sight: 0 };
    w.sys.update(.02);
    expect(w.sys.lightCut).toBeGreaterThan(1);
  });
  it('the zone lists follow §3 (Holy Shock only under a storm, Conviction in the Reach from 20)', () => {
    expect(packAuraPool('ember-isle', 3)).toEqual([]);
    expect(packAuraPool('infernal-reach', 12)).not.toContain('conviction');
    expect(packAuraPool('infernal-reach', 22)).toContain('conviction');
    expect(packAuraPool('verdant-wilds', 30)).not.toContain('holy-shock');
    expect(packAuraPool('verdant-wilds', 30, { storm: true })).toContain('holy-shock');
    expect(landOf('drowned-crypts-2', 'ember-isle')).toBe('umbral-marches');
    expect(PACK_AURA_IDS.length).toBe(13);
  });
});

describe('td-elites: the new affixes', () => {
  it('every new affix has its name, colour and ES words', () => {
    for (const a of ['lightless', 'whispering', 'grave-called', 'mirrored', 'ember-hearted', 'brutal', 'multishot', 'shielded-by-kin', 'vampiric'] as const) {
      expect(AFFIX_DEFS[a]?.name).withContext(a).toBeTruthy();
      expect(ABILITIES_I18N[`elite.affix.${a}`]?.es).withContext(a).toBeTruthy();
    }
  });
  it('the combining rules hold (§4)', () => {
    expect(affixAllowed('multishot', [], { ranged: false })).toBeFalse();
    expect(affixAllowed('multishot', [], { ranged: true })).toBeTrue();
    expect(affixAllowed('ember-hearted', ['fire-enchanted'], {})).toBeFalse();
    expect(affixAllowed('grave-called', [], { bone: false, levelId: 'surface' })).toBeFalse();
    expect(affixAllowed('grave-called', [], { bone: false, levelId: 'ashen-crypt-1' })).toBeTrue();
    expect(affixAllowed('aura-lightless', ['lightless'], {})).toBeFalse();
    expect(affixAllowed('teleport', ['extra-fast'], { level: 10 })).toBeFalse();
    expect(affixAllowed('teleport', ['extra-fast'], { level: 20 })).toBeTrue();
  });
  it('more affixes in higher zones and harder tiers; the shipped counts when no band is given', () => {
    const r = seededRandom(7);
    expect(affixCount('champion', r, { level: 10 })).toBe(1);
    expect(affixCount('champion', r, { level: 20 })).toBe(2);
    expect(affixCount('champion', r, { level: 40 })).toBe(3);
    expect(affixCount('champion', r, { level: 40, tier: 'hell' })).toBe(5);
    for (let i = 0; i < 20; i++) { const n = affixCount('unique', r, { level: 40 }); expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(4); }
    expect(affixCount('champion', r)).toBe(1);
    expect(packFollowers('unique', 4, 4)).toBe(2);
    expect(packFollowers('champion', 3, 3)).toBe(3);
  });
  it('rolling with a zone\'s auras can bring Aura Enchanted, and the same seed the same pack', () => {
    let aura = 0;
    for (let i = 0; i < 400; i++) {
      const p = rollElite(`s${i}`, 1, { level: 30, auras: ['might', 'prayer'], fresh: true });
      if (p && auraAffix(p.affixes)) aura++;
    }
    expect(aura).toBeGreaterThan(0);
    expect(rollElite('same', 1, { level: 30, fresh: true })).toEqual(rollElite('same', 1, { level: 30, fresh: true }));
    expect(rollAffixes(seededRandom(3), 2)).toEqual(rollAffixes(seededRandom(3), 2));
  });
  it('Mirrored brings a copy that dies in one hit and owes nothing', () => {
    const { sys } = world({ x: 900, y: 900 });
    const out = sys.spawnPack('m1', MOBS['cinder-orc'], 0, 0, makePack('champion', ['mirrored'], null, 0));
    const copy = out.find(m => m.mirror)!;
    expect(copy).toBeDefined();
    expect(copy.hp).toBe(1);
    sys.wound(copy, 1);
    expect(sys.mobs.includes(copy)).toBeFalse();
  });
  it('abilitiesOf lists the new creatures\' raises', () => {
    expect(abilitiesOf('bone-priest').map(a => a.kind)).toEqual(['raise', 'ward']);
    expect(abilitiesOf('ashsinger')[0].raise?.keys).toContain('orc-firecaller');
  });
});
