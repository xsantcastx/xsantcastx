/**
 * td-phases.spec.ts — the world clock as a rule (roadmap §10 item 4): the phase math, the night spawn tables, the
 * Eclipse-touched roll, and that none of it reaches a town's safety.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type MobHost, type MobSpawn } from './td-mobs';
import {
  NIGHT_SHARE, NIGHT_TABLES, PHASE_RULES, WARN_MINUTES, eclipseWarning, extraSpawn, hardened, nightType, phaseOfHour,
  rollTouched, spellMult, touchedRandom,
} from './td-phases';
import { AFFIX_DEFS, ELITE_AFFIXES, isTouched, lootRank, makePack, touchPack } from './td-elites';
import { ECLIPSE, isEclipseDay, msAt } from '../../shared/world-clock/world-clock.model';
import { creatureHaunts } from './td-bestiary';

function world(opts: { safe?: (x: number, y: number) => boolean } = {}): MobSystem {
  const host: MobHost = {
    options: {} as EngineOptions,
    walkable: () => true,
    levelId: () => 'surface',
    player: () => ({ x: 1e6, y: 1e6 }),
    hurtPlayer: () => undefined,
    healPlayer: () => undefined,
    swung: () => undefined,
    ...(opts.safe ? { safeAt: opts.safe } : {}),
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}
const spawns = (type: string, n: number, x0 = 0): MobSpawn[] => Array.from({ length: n }, (_, i) => ({ key: `w:${i},0`, type, x: x0 + i * 40, y: 0 }));

describe('td-phases: the phase math', () => {
  it('reads a pinned hour as the clock\'s own phase', () => {
    expect(phaseOfHour(12)).toBe('day');
    expect(phaseOfHour(6)).toBe('dawn');
    expect(phaseOfHour(19)).toBe('dusk');
    expect(phaseOfHour(22)).toBe('night');
    expect(phaseOfHour(3)).toBe('night');
  });

  it('turns spell strength by the sky: Ember by day, Shadow after dark and most under an eclipse; Bone keeps no hour', () => {
    expect(spellMult('ember', 'day')).toBeCloseTo(1.1);
    expect(spellMult('shadow', 'day')).toBe(1);
    expect(spellMult('shadow', 'dusk')).toBe(1);
    expect(spellMult('shadow', 'night')).toBeCloseTo(1.1);
    expect(spellMult('ember', 'night')).toBeCloseTo(.9);
    expect(spellMult('shadow', 'eclipse')).toBeCloseTo(1.25);
    expect(spellMult('ember', 'eclipse')).toBeCloseTo(.85);
    for (const p of ['day', 'dawn', 'dusk', 'night', 'eclipse'] as const) expect(spellMult('bone', p)).toBe(1);
  });

  it('pays more after dark, most under an eclipse; the day is as drawn', () => {
    expect(PHASE_RULES.day).toEqual(jasmine.objectContaining({ extra: 0, hp: 1, dmg: 1, xp: 1, gold: 1, night: false, touched: 0 }));
    expect(PHASE_RULES.night.xp).toBeGreaterThan(1);
    expect(PHASE_RULES.eclipse.xp).toBeGreaterThan(PHASE_RULES.night.xp);
    expect(PHASE_RULES.eclipse.gold).toBeGreaterThan(PHASE_RULES.night.gold);
    expect(PHASE_RULES.eclipse.touched).toBeCloseTo(1 / 8);
    expect(PHASE_RULES.dusk.extra).toBeGreaterThan(0);
  });

  it('hardens a creature at night on a copy, never the shared record', () => {
    const wolf = MOBS['ash-wolf'], hp = wolf.hp, dmg = [...wolf.dmg];
    const night = hardened(wolf, 'night');
    expect(night).not.toBe(wolf);
    expect(night.hp).toBe(Math.round(hp * 1.2));
    expect(night.dmg[1]).toBeGreaterThanOrEqual(dmg[1]);
    expect(wolf.hp).toBe(hp);
    expect(wolf.dmg).toEqual(dmg as [number, number]);
    expect(hardened(wolf, 'day')).toBe(wolf);
  });

  it('warns of an eclipse within the last half hour before it, and not once it is on', () => {
    let d = 0; while (!isEclipseDay(d)) d++;
    expect(eclipseWarning(msAt(d, ECLIPSE.start - 20))).toBe(20);
    expect(eclipseWarning(msAt(d, ECLIPSE.start - WARN_MINUTES))).toBe(WARN_MINUTES);
    expect(eclipseWarning(msAt(d, ECLIPSE.start - WARN_MINUTES - 5))).toBeNull();
    expect(eclipseWarning(msAt(d, ECLIPSE.start + 30))).toBeNull();
  });
});

describe('td-phases: the night spawn tables', () => {
  it('only swaps after dark, about one in three, and only into its own night creatures', () => {
    expect(nightType('ash-wolf', 'seed', 'day')).toBe('ash-wolf');
    expect(nightType('ash-wolf', 'seed', 'dusk')).toBe('ash-wolf');
    let swapped = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const got = nightType('mire-lurker', `s${i}`, 'night');
      if (got !== 'mire-lurker') { swapped++; expect(NIGHT_TABLES['mire-lurker']).toContain(got); }
      expect(nightType('mire-lurker', `s${i}`, 'night')).toBe(got);   // deterministic per seed
    }
    expect(swapped / N).toBeGreaterThan(NIGHT_SHARE - .03);
    expect(swapped / N).toBeLessThan(NIGHT_SHARE + .03);
    // A creature with no night table stays itself.
    for (let i = 0; i < 200; i++) expect(nightType('rivet-maw', `s${i}`, 'eclipse')).toBe('rivet-maw');
  });

  it('every night creature exists, is no boss, and suits the ground its day creature walks (within 6 levels)', () => {
    for (const [day, nights] of Object.entries(NIGHT_TABLES)) {
      expect(MOBS[day]).withContext(day).toBeDefined();
      for (const n of nights) {
        expect(MOBS[n]).withContext(n).toBeDefined();
        expect(MOBS[n].rank ?? 'normal').toBe('normal');
        expect(Math.abs(MOBS[n].level - MOBS[day].level)).withContext(`${day} → ${n}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('shows the night creatures in the Bestiary where they walk after dark', () => {
    expect(creatureHaunts().get('bone-walker')).toContain('The Emberwood, Ember Isle (at night)');
  });

  it('brings more creatures after dusk: extras roll at the phase\'s rate', () => {
    let n = 0;
    for (let i = 0; i < 4000; i++) if (extraSpawn(`x${i}`, 'night')) n++;
    expect(n / 4000).toBeCloseTo(PHASE_RULES.night.extra, 1);
    for (let i = 0; i < 400; i++) expect(extraSpawn(`x${i}`, 'day')).toBeFalse();
  });

  it('MobSystem: night in the open wilds swaps, hardens and adds; the day and a roof change nothing', () => {
    const day = world();
    day.addSpawns(spawns('ash-wolf', 60));
    expect(day.mobs.length).toBe(60);
    expect(day.mobs.every(m => m.def.id === 'ash-wolf' && m.hp === MOBS['ash-wolf'].hp)).toBeTrue();

    const night = world();
    night.setPhase('night', true);
    night.addSpawns(spawns('ash-wolf', 60));
    const walkers = night.mobs.filter(m => m.def.id === 'bone-walker').length;
    expect(walkers).toBeGreaterThan(5);
    expect(night.mobs.length).toBeGreaterThan(60);                      // the extras
    expect(night.mobs.every(m => m.hp === Math.round(MOBS[m.def.id].hp * PHASE_RULES.night.hp))).toBeTrue();

    const below = world();
    below.setPhase('night', false);                                     // a dungeon floor: no sky overhead
    below.addSpawns(spawns('ash-wolf', 60));
    expect(below.mobs.length).toBe(60);
    expect(below.mobs.every(m => m.def.id === 'ash-wolf')).toBeTrue();
  });

  it('towns stay safe: no night creature, no extra, no hardening in a safe square', () => {
    const sys = world({ safe: () => true });
    sys.setPhase('eclipse', true);
    sys.elites = true;
    sys.addSpawns(spawns('ash-wolf', 80));
    expect(sys.mobs.length).toBe(80);
    expect(sys.mobs.every(m => m.def.id === 'ash-wolf' && m.hp === MOBS['ash-wolf'].hp && !m.elite)).toBeTrue();
  });

  it('a boss keeps its own spawn under any sky', () => {
    const sys = world();
    sys.setPhase('eclipse', true);
    sys.elites = true;
    sys.addSpawns(spawns('magma-tyrant', 40));
    expect(sys.mobs.length).toBe(40);
    expect(sys.mobs.every(m => m.def.id === 'magma-tyrant' && !m.elite && m.hp === MOBS['magma-tyrant'].hp)).toBeTrue();
  });
});

describe('td-phases: the Eclipse-touched roll', () => {
  it('comes up about one in eight under an eclipse, never otherwise', () => {
    let n = 0;
    const N = 16000;
    for (let i = 0; i < N; i++) if (rollTouched(`t${i}`, 'eclipse')) n++;
    expect(n / N).toBeGreaterThan(1 / 8 - .015);
    expect(n / N).toBeLessThan(1 / 8 + .015);
    for (let i = 0; i < 500; i++) { expect(rollTouched(`t${i}`, 'night')).toBeFalse(); expect(rollTouched(`t${i}`, 'day')).toBeFalse(); }
  });

  it('makes a lone creature a champion with the affix and one more, and a pack\'s leader touched', () => {
    for (let i = 0; i < 200; i++) {
      const p = touchPack(null, touchedRandom(`s${i}`));
      expect(p.rank).toBe('champion');
      expect(p.followers).toBe(0);
      expect(p.affixes[0]).toBe('eclipse-touched');
      expect(p.affixes.length).toBe(2);
      expect(ELITE_AFFIXES).toContain(p.affixes[1]);
    }
    const pack = touchPack(makePack('unique', ['cursed'], 'Duskclaw the Unlit', 2), touchedRandom('u'));
    expect(pack.affixes).toEqual(['eclipse-touched', 'cursed']);
    expect(touchPack(pack, touchedRandom('u')).affixes).toEqual(['eclipse-touched', 'cursed']);
    // It never comes up in the ordinary affix roll.
    expect(ELITE_AFFIXES).not.toContain('eclipse-touched');
    expect(AFFIX_DEFS['eclipse-touched'].damage).toBeGreaterThan(1);
  });

  it('climbs one ladder step on drops (a champion drops as a unique), never to a boss; minions stay ordinary', () => {
    expect(lootRank({ rank: 'champion', role: 'leader', affixes: ['eclipse-touched', 'extra-fast'] })).toBe('unique');
    expect(lootRank({ rank: 'unique', role: 'leader', affixes: ['eclipse-touched'] })).toBe('unique');
    expect(lootRank({ rank: 'champion', role: 'leader', affixes: ['extra-fast'] })).toBe('champion');
    expect(lootRank({ rank: 'unique', role: 'minion', affixes: [] })).toBe('normal');
  });

  it('MobSystem: about one creature in eight is touched under an eclipse in the open wilds', () => {
    const sys = world();
    sys.setPhase('eclipse', true);
    sys.elites = true;
    sys.keeperLevel = 1;
    sys.addSpawns(spawns('rivet-maw', 800));
    const leaders = sys.mobs.filter(m => m.elite && m.elite.role !== 'minion');
    const touched = leaders.filter(m => isTouched(m.elite));
    expect(touched.length).toBeGreaterThan(800 / 8 * .7);
    expect(touched.length).toBeLessThan(800 / 8 * 1.4);
    for (const m of touched) { expect(m.def.rank).toBe('unique'); expect(m.def.hp).toBeGreaterThan(MOBS['rivet-maw'].hp); }
  });

  it('turns the Ashguard\'s pages by the sky: Brand keeps Ember\'s hours, Ash gains a little after dark, Oath keeps none', () => {
    for (const p of ['day', 'dawn', 'dusk', 'night', 'eclipse'] as const) {
      expect(spellMult('brand', p)).toBe(spellMult('ember', p));
      expect(spellMult('oath', p)).toBe(1);
    }
    expect(spellMult('ash', 'day')).toBe(1);
    expect(spellMult('ash', 'dusk')).toBe(1);
    expect(spellMult('ash', 'night')).toBeCloseTo(1.05);
    expect(spellMult('ash', 'eclipse')).toBeCloseTo(1.1);
  });

  it('the Watch Blade\'s numbers follow Brand\'s hour through the fight', () => {
    const sys = world(), blade = () => sys.v('watch-blade')['min'];
    sys.vocation = 'ashguard';
    sys.setRanks({ 'watch-blade': 10 });
    sys.setPhase('dusk', true);
    const dusk = blade();
    sys.setPhase('day', true);
    expect(blade()).toBe(Math.round(dusk * 1.1));
    sys.setPhase('night', true);
    expect(blade()).toBe(Math.round(dusk * .9));
  });

  it('turns the Warlock\'s spells by the sky through the fight\'s own numbers', () => {
    const sys = world();
    const dayMin = sys.v('drain-life')['min'];
    sys.setPhase('eclipse', true);
    expect(sys.v('drain-life')['min']).toBe(Math.round(dayMin * 1.25));
    expect(sys.v('bone-spear')['min']).toBe(world().v('bone-spear')['min']);
    sys.setPhase('day', true);
    expect(sys.v('drain-life')['min']).toBe(dayMin);
  });
});
