/**
 * td-seam.spec.ts — the Seam Eater, the eclipse's world boss (td-seam.ts): when and where it rises (only under an
 * eclipse, on the surface, never in a town), its two tells and its chants, the half-life change and its Eclipse-touched
 * call, the tiers its fall opens, its unique's drop gate, and the truth probe for that unique's signature.
 */
import type { EngineOptions } from '../engine/engine.model';
import { BOSS_TELL, CALL_TELL, CHANT_SECS, MOBS, MobSystem, tiered, type Mob, type MobHost } from './td-mobs';
import {
  REND_TELL, SEAM_BAND, SEAM_CANT, SEAM_ID, SEAM_LEASH, SEAM_PHASES, SEAM_WAKE, riftPlace, riftTile, seamCall, seamEaterAt,
  seamLeaves, seamLevel, seamRises, seamStats,
} from './td-seam';
import { CONTINENTS } from './td-engine';
import { TdWorld } from './td-world';
import { TILE } from './td-art';
import { DIFFICULTIES, TD_GATE_BOSS, unlockedBy } from '../../shared/loot/difficulty.model';
import { bossUniqueFor, relicTotals, rollBossUnique } from '../../shared/rpg/boss-uniques';
import { rollCreatureLoot } from '../../shared/loot/drop-tables';
import { HUD_I18N } from '../world/hud.i18n';
import { bestiaryEntries } from './td-bestiary';
import { LORE_PAGES } from '../../shared/lore/lore';
import { LORE_I18N } from '../../shared/lore/lore.i18n';

interface World { sys: MobSystem; keeper: { x: number; y: number }; life: { hp: number }; kills: { creature: string }[]; safe: (x: number, y: number) => boolean }
function world(o: { safe?: (x: number, y: number) => boolean } = {}): World {
  const keeper = { x: 0, y: 0 }, life = { hp: 1e6 }, kills: { creature: string }[] = [];
  const safe = o.safe ?? (() => false);
  const host: MobHost = {
    options: { onKill: (e: { creature: string }) => { kills.push(e); }, rollLoot: () => [] } as unknown as EngineOptions,
    walkable: () => true, levelId: () => 'surface', player: () => keeper,
    hurtPlayer: n => { life.hp -= n; }, healPlayer: () => undefined, swung: () => undefined, playerHp: () => life.hp, safeAt: safe,
  };
  const sys = new MobSystem(host);
  sys.aura = null; sys.defense = 0; sys.resists = {};
  return { sys, keeper, life, kills, safe };
}
/** The Eater at `level`, risen at (x, y), hunting (or calm: no sight). */
function eater(w: World, level = 30, x = 0, y = -60, calm = false): Mob {
  const def = seamEaterAt(MOBS[SEAM_ID], level);
  return w.sys.place(`seam:t:${level}`, calm ? { ...def, sight: 0 } : def, x, y);
}
const run = (w: World, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) w.sys.update(dt); };

describe('td-seam: when and where it rises', () => {
  it('only under an eclipse, on the surface, near the rift, not felled this eclipse, not already up', () => {
    const ok = { phase: 'eclipse', surface: true, slain: false, up: false, dist: 5 };
    expect(seamRises(ok)).toBeTrue();
    for (const phase of ['day', 'dawn', 'dusk', 'night']) expect(seamRises({ ...ok, phase })).withContext(phase).toBeFalse();
    expect(seamRises({ ...ok, surface: false })).toBeFalse();
    expect(seamRises({ ...ok, slain: true })).toBeFalse();
    expect(seamRises({ ...ok, up: true })).toBeFalse();
    expect(seamRises({ ...ok, dist: SEAM_WAKE })).toBeTrue();
    expect(seamRises({ ...ok, dist: SEAM_WAKE + .1 })).toBeFalse();
    // It leaves when the eclipse ends, whatever the next sky.
    expect(seamLeaves('eclipse')).toBeFalse();
    for (const phase of ['day', 'dusk', 'night', 'dawn']) expect(seamLeaves(phase)).withContext(phase).toBeTrue();
  });

  it('every continent has a rift at its standing stones, on open ground clear of every town and village', () => {
    for (const def of Object.values(CONTINENTS)) {
      const at = riftPlace(def);
      expect(at).withContext(def.id).not.toBeNull();
      const w = new TdWorld(def), t = riftTile(w, at!);
      expect(t).withContext(def.id).not.toBeNull();
      for (let dr = -3; dr <= 1; dr++) for (let dc = -3; dc <= 3; dc++) {
        expect(w.safeAt(t!.c + dc, t!.r + dr)).withContext(`${def.id} ${dc},${dr}`).toBeFalse();
        expect(w.walkable(t!.c + dc, t!.r + dr)).withContext(`${def.id} ${dc},${dr}`).toBeTrue();
      }
      expect(w.inTown(t!.c, t!.r)).toBeFalse();
    }
    // Ember Isle's is the Ninefold Stones, just past the square: the starter town's outskirts.
    expect(riftPlace(CONTINENTS['ember-isle'])?.name).toBe('The Ninefold Stones');
  });

  it('never steps onto a town\'s safe ground, and never strikes at a Keeper standing on it', () => {
    // Everything north of y = 0 is the town.
    const w = world({ safe: (_x, y) => y < 0 });
    const m = eater(w, 30, 0, 40);
    w.keeper.x = 0; w.keeper.y = -40;
    run(w, 6);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(w.sys.bursts.length).toBe(0);
    expect(m.tell).toBe(0);
    expect(w.life.hp).toBe(1e6);
  });

  it('never chases past its leash from the rift', () => {
    const w = world();
    const m = eater(w);
    // Fast and far-sighted, so without the leash it would follow him all the way.
    m.def = { ...m.def, speed: 200, sight: 9999, ranged: undefined, rend: undefined };
    w.keeper.x = 0; w.keeper.y = 0;
    // The Keeper walks away; it follows only until the leash, then turns home.
    for (let i = 0; i < 600; i++) { w.keeper.y += 1.2; w.sys.update(.02); }
    expect(Math.hypot(m.x - m.hx, m.y - m.hy)).toBeLessThanOrEqual(SEAM_LEASH * TILE + 4);
  });

  it('scales with the Keeper inside 20–60, and the Bestiary shows its level-20 self', () => {
    expect(seamLevel(1)).toBe(SEAM_BAND.min);
    expect(seamLevel(35)).toBe(35);
    expect(seamLevel(99)).toBe(SEAM_BAND.max);
    const base = MOBS[SEAM_ID], at20 = seamEaterAt(base, 20);
    expect([base.hp, base.dmg, base.ranged!.dmg, base.rend!.dmg]).toEqual([at20.hp, at20.dmg, at20.ranged!.dmg, at20.rend!.dmg]);
    expect(base.level).toBe(20);
    expect(base.rank).toBe('boss');
    expect(base.w).toBeGreaterThanOrEqual(2 * 54);   // about twice a deep boss
    let last = 0;
    for (const L of [20, 30, 40, 50, 60]) {
      const d = seamEaterAt(base, L), s = seamStats(L);
      expect(d.level).toBe(L);
      expect(d.hp).toBe(s.hp);
      expect(d.hp).toBeGreaterThan(last); last = d.hp;
      expect(d.summon?.type).toBe(seamCall(L));
    }
    // A world boss: tougher than the deep bosses near its level (the Ashbone Dragon at 25, the Ink Abbess at 50).
    expect(seamStats(25).hp).toBeGreaterThan(MOBS['bone-dragon'].hp);
    expect(seamStats(50).hp).toBeGreaterThan(MOBS['ink-abbess'].hp);
  });
});

describe('td-seam: the fight', () => {
  beforeEach(() => spyOn(Math, 'random').and.returnValue(.5));

  it('Void Breath: the wind-up (BOSS_TELL) with its chant, then a fan of five at where the Keeper stood', () => {
    const w = world();
    const m = eater(w, 30, 0, -100);
    m.rendCd = 99;
    m.rcd = 0;
    w.sys.update(.02);
    expect(m.tell).toBeCloseTo(BOSS_TELL, 5);
    expect(m.chantText).toBe(SEAM_CANT.breath);
    expect(m.chantT).toBeCloseTo(CHANT_SECS, 5);
    expect(w.sys.shots.length).toBe(0);
    run(w, BOSS_TELL + .02);
    expect(w.sys.shots.length).toBe(SEAM_PHASES.one.spread);
    for (const s of w.sys.shots) expect(s.type).toBe('arcane');
  });

  it('Seam Rend: three rings (one under the Keeper) with its chant; they burst after a second, and a step aside is safe', () => {
    const w = world();
    const m = eater(w, 30, 0, -100);
    m.rcd = 99; m.rendCd = 0;
    w.sys.update(.02);
    expect(w.sys.bursts.length).toBe(SEAM_PHASES.one.rings);
    expect(m.chantText).toBe(SEAM_CANT.rend);
    const under = w.sys.bursts.find(b => Math.hypot(b.x - w.keeper.x, b.y - w.keeper.y) < 1)!;
    expect(under).toBeDefined();
    expect(under.delay).toBe(REND_TELL);
    expect(under.el).toBe('shadow');
    const s = seamStats(30);
    expect(under.dmg).toBeGreaterThanOrEqual(s.rend[0]);
    expect(under.dmg).toBeLessThanOrEqual(s.rend[1]);
    // Standing still in the ring: it lands, once, as its own number (no Defense, no resist).
    const before = w.life.hp;
    run(w, REND_TELL + .04);
    expect(before - w.life.hp).toBe(under.dmg);
    // Again, the Keeper steps out in the tell: nothing lands.
    const w2 = world(), m2 = eater(w2, 30, 0, -100);
    m2.rcd = 99; m2.rendCd = 0;
    w2.sys.update(.02);
    w2.keeper.x = 400;
    run(w2, REND_TELL + .04);
    expect(w2.life.hp).toBe(1e6);
  });

  it('at half its life: the call (two Eclipse-touched shades after the sigil), and the fight quickens', () => {
    const w = world();
    const m = eater(w, 30, 0, -100, true);
    expect(m.halved).toBeFalsy();
    w.sys.wound(m, m.hp - Math.floor(m.def.hp * .5) - 1);
    expect(m.halved).toBeFalsy();
    w.sys.wound(m, 2);
    expect(m.halved).toBeTrue();
    expect(m.chantText).toBe(SEAM_CANT.call);
    expect(m.def.ranged!.spread).toBe(SEAM_PHASES.two.spread);
    expect(m.def.ranged!.rate).toBe(SEAM_PHASES.two.rate);
    expect(m.def.rend!.rings).toBe(SEAM_PHASES.two.rings);
    expect(m.def.rend!.rate).toBe(SEAM_PHASES.two.rendRate);
    expect(w.sys.calls.length).toBe(2);
    expect(w.sys.calls.every(c => c.touched && c.type === seamCall(30))).toBeTrue();
    run(w, CALL_TELL + .04);
    const touched = w.sys.mobs.filter(o => o !== m);
    expect(touched.length).toBe(2);
    for (const t of touched) {
      expect(t.def.id).toBe(seamCall(30));
      expect(t.elite?.affixes).toContain('eclipse-touched');
    }
    // Once only.
    w.sys.wound(m, 10);
    expect(w.sys.calls.length).toBe(0);
  });

  it('leaving (the eclipse ended) is not a kill: no onKill, no loot', () => {
    const w = world();
    const m = eater(w, 30, 0, -100, true);
    w.sys.banish(m);
    expect(w.sys.mobs.includes(m)).toBeFalse();
    expect(w.kills.length).toBe(0);
    expect(w.sys.drops.length).toBe(0);
  });

  it('a fall is a kill of the gate boss: onKill names it', () => {
    const w = world();
    w.sys.smite(eater(w, 30, 0, -100, true));
    expect(w.kills.map(k => k.creature)).toEqual([SEAM_ID]);
    expect(w.sys.drops.some(d => d.coins > 0)).toBeTrue();
  });
});

describe('td-seam: the gate, the tiers', () => {
  it('its first fall on Normal opens Nightmare, a fall on Nightmare opens Hell, and Hell opens nothing', () => {
    expect(TD_GATE_BOSS).toBe(SEAM_ID);
    expect(unlockedBy(SEAM_ID, 'normal')).toBe('nightmare');
    expect(unlockedBy(SEAM_ID, 'nightmare')).toBe('hell');
    expect(unlockedBy(SEAM_ID, 'hell')).toBeNull();
    // The side view's Act I warden is not the gate.
    expect(unlockedBy('seam-eater', 'normal')).toBeNull();
    expect(unlockedBy('ink-abbess', 'normal')).toBeNull();
  });

  it('on Nightmare it rises with the tier\'s life and strikes as hard as the tier says — breath and rings too', () => {
    const w = world();
    w.sys.setTier(DIFFICULTIES.nightmare);
    const m = eater(w, 30, 0, -100, true), base = seamEaterAt(MOBS[SEAM_ID], 30), t = tiered(base, DIFFICULTIES.nightmare);
    const nm = DIFFICULTIES.nightmare;
    expect(m.def.hp).toBe(Math.round(base.hp * nm.hp));
    expect(m.def.rend!.dmg).toEqual(t.rend!.dmg);
    expect(m.def.rend!.dmg[0]).toBe(Math.round(base.rend!.dmg[0] * nm.damage));
    expect(m.def.ranged!.dmg[1]).toBe(Math.round(base.ranged!.dmg[1] * nm.damage));
  });
});

describe('td-seam: its unique', () => {
  const grips = bossUniqueFor(SEAM_ID)!;

  it('drops from the Seam Eater alone, 1 in 8, and only from a real kill roll at boss rank', () => {
    expect(grips.id).toBe('unique-seamstitch-grips');
    expect(grips.oneIn).toBe(8);
    expect(rollBossUnique(SEAM_ID, () => 1 / 8 - 1e-9)).toBe(grips);
    expect(rollBossUnique(SEAM_ID, () => 1 / 8)).toBeNull();
    // Not from the Act I warden of the same name, nor from any other boss.
    expect(rollBossUnique('seam-eater', () => 0)).toBeNull();
    expect(rollBossUnique('ink-abbess', () => 0)?.id).not.toBe(grips.id);
    // Through the loot roll: at boss rank it can come; a champion roll never draws it.
    const zero = () => 0;
    const boss = rollCreatureLoot({ creature: SEAM_ID, level: 30, tier: 'normal', magicFind: 0, rank: 'boss' }, zero);
    expect(boss.some(r => r.kind === 'item' && r.definitionId === grips.id)).toBeTrue();
    const champ = rollCreatureLoot({ creature: SEAM_ID, level: 30, tier: 'normal', magicFind: 0, rank: 'champion' }, zero);
    expect(champ.some(r => r.kind === 'item' && r.definitionId === grips.id)).toBeFalse();
  });

  it('truth probe: worn, every hit lands 20% harder at night and under an eclipse, and not by day', () => {
    expect(grips.sig).toEqual({ umbra: 20 });
    const measure = (phase: 'day' | 'night' | 'eclipse', wear: boolean): number => {
      const w = world();
      w.sys.crit = 0; w.sys.power = 1;
      if (wear) w.sys.setRelics(relicTotals([grips.id]));
      w.sys.setPhase(phase, true);
      const m = w.sys.place('dummy', { ...MOBS['ash-wolf'], hp: 1e7, sight: 0 }, 40, 0);
      return (w.sys as unknown as { hitFoe(m: Mob, raw: number, c: string): number }).hitFoe(m, 100, '#fff');
    };
    expect(measure('day', false)).toBe(100);
    expect(measure('day', true)).toBe(100);
    expect(measure('night', true) / measure('night', false)).toBeCloseTo(1 + grips.sig.umbra! / 100, 5);
    expect(measure('eclipse', true) / measure('eclipse', false)).toBeCloseTo(1.2, 5);
    // The card and its Spellbook line say exactly that number.
    for (const text of [grips.passive.text, HUD_I18N['play.relic.sig.' + grips.id].en, HUD_I18N['play.relic.sig.' + grips.id].es]) expect(text).toContain('20%');
  });
});

describe('td-seam: the Bestiary and the Lore', () => {
  it('a Bestiary card: a boss, its unique, and every rift as where it is met', () => {
    const e = bestiaryEntries({})!.find(x => x.id === SEAM_ID)!;
    expect(e.name).toBe('The Seam Eater');
    expect(e.rank).toBe('boss');
    expect(e.relic?.id).toBe('unique-seamstitch-grips');
    expect(e.haunts).toContain('The Ninefold Stones, Ember Isle (under an eclipse)');
    expect(e.haunts.length).toBe(Object.keys(CONTINENTS).length);
    expect(e.lore.length).toBeGreaterThan(40);
  });

  it('a Lore page tying it to the eclipse and the Wanewalkers, EN and ES', () => {
    const page = LORE_PAGES.find(p => p.id === 'seam-eater')!;
    expect(page).toBeDefined();
    for (const k of [page.kicker, page.title, ...page.body]) {
      expect(LORE_I18N[k]?.en.length).withContext(k).toBeGreaterThan(5);
      expect(LORE_I18N[k]?.es.length).withContext(k).toBeGreaterThan(5);
    }
    const text = page.body.map(k => LORE_I18N[k].en).join(' ');
    expect(text).toContain('Wanewalkers');
    expect(text).toMatch(/eclipse|sun goes out/);
    expect(text).toContain('Nightmare');
  });
});
