/**
 * glim-bond.spec.ts — the bond with Glim (docs/handoff/glim-bond.md).
 *
 * What must hold: the bond grows only from shared moments, each counted once
 * (no double counting, caps per kind); stages open talks, abilities and the
 * questline and never close; the questions Glim asks are remembered through
 * the gateway; two devices merge (the most of the peak, the union of moments,
 * the later answer); and the copy is honest — EN + ES for every key, no
 * guilt, no streaks, and the first lamp's name never said before the finale.
 */
import { TestBed } from '@angular/core/testing';
import {
  BLANK_PLACES, BOND_STAGES, GLIM_TALKS, MOMENT_RULES, answersFor, bondPoints, bondStage, coloured, hasAbility,
  momentsFrom, nextTalk, openTalks, questMoments, roomFor, siteMoment, stageOf, wayHome,
} from './glim-bond';
import { GLIM_BOND_I18N } from './glim-bond.i18n';
import { GLIM_KEY, GlimState, coerceGlim, emptyGlim, mergeGlim } from './glim-save.model';
import { GlimService } from './glim.service';
import { GlimVoice } from './glim-voice';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

const facts = (over: Partial<Parameters<typeof momentsFrom>[0]> = {}) => ({
  areaId: 'infernal', inscriptions: [] as string[], missionsDone: [] as string[], caught: [] as string[], deepest: -1, compass: false, ...over,
});

describe('Glim bond: moments', () => {
  it('grows from shared moments: places, carvings, missions, catches, depths, the compass', () => {
    const ids = momentsFrom(facts({
      areaId: 'ember-quarry', inscriptions: ['roots-keepers-tally'], missionsDone: ['delve-kael-seam'], caught: ['blindfin'], deepest: 2, compass: true,
    }));
    expect(ids).toEqual(jasmine.arrayContaining([
      'area:ember-quarry', 'insc:roots-keepers-tally', 'mission:delve-kael-seam', 'catch:blindfin', 'depth:0', 'depth:1', 'depth:2', 'compass:astral',
    ]));
    expect(ids).not.toContain('depth:3');
    // Before the first dig there is no depth at all.
    expect(momentsFrom(facts()).some(id => id.startsWith('depth:'))).toBeFalse();
    expect(bondPoints(ids)).toBe(3 + 3 + 4 + 2 + 5 * 3 + 4);
  });

  it('counts each moment once, however often it is seen', () => {
    const once = ['area:infernal', 'insc:a'];
    expect(bondPoints(once)).toBe(6);
    expect(roomFor(once, 'area:infernal')).toBeFalse();
    expect(roomFor(once, 'area:homestead')).toBeTrue();
  });

  it('caps every kind, so nothing can be farmed', () => {
    const sites = Array.from({ length: 200 }, (_, i) => siteMoment(`ruin@${i},12`));
    expect(bondPoints(sites)).toBe(MOMENT_RULES.site.weight * MOMENT_RULES.site.cap);
    expect(roomFor(sites.slice(0, MOMENT_RULES.site.cap), siteMoment('ruin@-9,4'))).toBeFalse();
    const backs = ['back:1', 'back:2', 'back:3', 'back:4'];
    expect(bondPoints(backs)).toBe(MOMENT_RULES.back.weight * 3);
  });

  it('turns a structure id into a valid moment, negative columns and all', () => {
    expect(siteMoment('rift-shrine@-140,33')).toBe('site:rift-shrine@-140,33');
    expect(roomFor([], siteMoment('rift-shrine@-140,33'))).toBeTrue();
    expect(roomFor([], 'BAD ID')).toBeFalse();
    expect(roomFor([], 'nonsense:x')).toBeFalse();
  });
});

describe('Glim bond: stages', () => {
  it('has five named stages, rising, from "Stranger with a lantern" to "The blank page and the pen"', () => {
    expect(BOND_STAGES.length).toBe(5);
    for (let i = 1; i < BOND_STAGES.length; i++) expect(BOND_STAGES[i]!.at).toBeGreaterThan(BOND_STAGES[i - 1]!.at);
    expect(GLIM_BOND_I18N[BOND_STAGES[0]!.name]!.en).toBe('Stranger with a lantern');
    expect(GLIM_BOND_I18N[BOND_STAGES[4]!.name]!.en).toBe('The blank page and the pen');
  });

  it('every stage opens something real: a talk, and from Mapmates an ability or the questline', () => {
    for (const s of BOND_STAGES) expect(s.talks.length).withContext(`stage ${s.n}`).toBeGreaterThan(0);
    expect(BOND_STAGES.find(s => s.quest)?.n).toBe(2);
    expect(BOND_STAGES.map(s => s.ability).filter(Boolean)).toEqual(['way', 'sense', 'notice']);
    expect(hasAbility(stageOf(0), 'way')).toBeFalse();
    expect(hasAbility(stageOf(12), 'way')).toBeTrue();
    expect(hasAbility(stageOf(35), 'sense')).toBeTrue();
    expect(hasAbility(stageOf(35), 'notice')).toBeFalse();
    expect(hasAbility(stageOf(999), 'notice')).toBeTrue();
  });

  it('never closes a stage once reached (the peak holds)', () => {
    expect(bondStage([], 3).n).toBe(3);
    expect(bondStage([], 1).n).toBe(1);
  });

  it('opens talks in order; the first lamp waits for the fear', () => {
    const top = BOND_STAGES[4]!;
    expect(openTalks(stageOf(0), []).map(t => t.talk.id)).toEqual(['who']);
    expect(openTalks(top, []).map(t => t.talk.id)).toEqual(['who', 'moths', 'page', 'blanks', 'fear']);
    expect(openTalks(top, ['talk:fear']).map(t => t.talk.id)).toContain('lamp');
    expect(nextTalk(stageOf(12), ['talk:who'])?.id).toBe('moths');
    expect(nextTalk(stageOf(12), [])?.id).toBe('who');
  });
});

describe('Glim bond: the questline', () => {
  it('has the six steps of "The Blank Places", read from shared moments', () => {
    expect(BLANK_PLACES.map(s => s.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(questMoments(['area:infernal', 'area:ember-quarry'])).toEqual([]);
    expect(questMoments(['area:infernal', 'area:ember-quarry', 'depth:0'])).toEqual(['quest:1']);
    expect(questMoments(['area:infernal', 'area:ember-quarry', 'depth:0', 'quest:1'])).toEqual([]);
    expect(questMoments(['compass:astral'])).toEqual(['quest:4']);
  });

  it('never completes step 6 before the threshold exists', () => {
    const everything = [...BLANK_PLACES.flatMap(s => s.needs)];
    expect(questMoments(everything)).not.toContain('quest:6');
  });
});

describe('Glim bond: talks and lines', () => {
  const keys = (): string[] => GLIM_TALKS.flatMap(t => [`glim.talk.${t.id}.title`, ...t.lines, ...t.choices.flatMap(c => [c.key, c.reply])]);

  it('every talk, choice and reply has EN and ES', () => {
    for (const key of keys()) {
      expect(GLIM_BOND_I18N[key]?.en).withContext(key).toBeTruthy();
      expect(GLIM_BOND_I18N[key]?.es).withContext(key).toBeTruthy();
    }
    for (const s of BOND_STAGES) expect(GLIM_BOND_I18N[s.name]?.es).withContext(s.name).toBeTruthy();
    for (const n of [2, 3, 4, 5]) expect(GLIM_BOND_I18N[`glim.line.stage.${n}`]).withContext(`stage ${n}`).toBeTruthy();
    for (const n of [1, 2, 3, 4, 5]) expect(GLIM_BOND_I18N[`glim.line.quest.${n}`]).withContext(`quest ${n}`).toBeTruthy();
  });

  it('each talk tells three paragraphs at most and offers two to four replies; spoken lines stay short', () => {
    for (const t of GLIM_TALKS) {
      expect(t.lines.length).toBeLessThanOrEqual(3);
      expect(t.choices.length).toBeGreaterThanOrEqual(2);
      expect(t.choices.length).toBeLessThanOrEqual(4);
    }
    for (const [key, v] of Object.entries(GLIM_BOND_I18N)) {
      if (key.startsWith('glim.line.')) expect(v.en.length).withContext(key).toBeLessThanOrEqual(120);
    }
  });

  it('every answer-coloured line exists for every answer', () => {
    for (const [base, q] of [['glim.line.back', 'deep'], ['glim.line.sense', 'like'], ['glim.line.notice', 'mark']] as const) {
      for (const a of answersFor(q)) expect(GLIM_BOND_I18N[coloured(base, a, answersFor(q))]).withContext(`${base}.${a}`).toBeTruthy();
      expect(coloured(base, undefined, answersFor(q))).toBe(base);
      expect(coloured(base, 'junk', answersFor(q))).toBe(base);
    }
  });

  it('is honest: no guilt, no streaks, and the first lamp is never named before the finale', () => {
    const all = Object.values(GLIM_BOND_I18N).flatMap(v => [v.en.toLowerCase(), v.es.toLowerCase()]);
    for (const text of all) {
      expect(text).not.toContain('claude');
      expect(text).not.toContain('missed you');
      expect(text).not.toContain('streak');
      expect(text).not.toContain('racha');
      expect(text).not.toContain('te echamos de menos');
    }
  });

  it('knows the way home: which way, how far, how far up', () => {
    expect(wayHome({ col: 200, row: 30 }, [100, 400])).toEqual({ dir: 'west', cols: 100, rows: 30 });
    expect(wayHome({ col: 101, row: 4 }, [100])).toEqual({ dir: 'here', cols: 1, rows: 4 });
    expect(wayHome({ col: 0, row: 0 }, [])).toBeNull();
  });
});

describe('Glim bond: what it remembers merges', () => {
  it('keeps the highest peak, the union of moments and the later answer, both ways round', () => {
    const a: GlimState = { ...emptyGlim(), met: true, metAt: 'x', moments: ['area:infernal', 'talk:who'], answers: { like: { a: 'ore', at: 100 } }, peak: 2, seenAt: 50 };
    const b: GlimState = { ...emptyGlim(), met: true, metAt: 'x', moments: ['area:homestead', 'talk:who'], answers: { like: { a: 'carvings', at: 200 }, deep: { a: 'deep', at: 10 } }, peak: 3, seenAt: 70 };
    const m = mergeGlim(a, b) as GlimState;
    expect(m.peak).toBe(3);
    expect(m.seenAt).toBe(70);
    expect([...m.moments].sort()).toEqual(['area:homestead', 'area:infernal', 'talk:who']);
    expect(m.answers['like']).toEqual({ a: 'carvings', at: 200 });
    expect(m.answers['deep']).toEqual({ a: 'deep', at: 10 });
    expect(mergeGlim(b, a)).toEqual(m);
    expect(mergeGlim(m, m)).toEqual(coerceGlim(m));
  });

  it('never double-counts a moment both devices saw, and keeps each kind to its cap', () => {
    const many = (from: number) => Array.from({ length: 40 }, (_, i) => siteMoment(`ruin@${from + i},1`));
    const a: GlimState = { ...emptyGlim(), moments: many(0) };
    const b: GlimState = { ...emptyGlim(), moments: many(20) };
    const m = mergeGlim(a, b) as GlimState;
    expect(m.moments.length).toBe(MOMENT_RULES.site.cap);
    expect(bondPoints(m.moments)).toBe(MOMENT_RULES.site.cap);
  });

  it('drops junk: bad ids, unknown kinds, answers with no stamp', () => {
    const junk = coerceGlim({ moments: ['area:ok', 'BAD', 'zzz:1', 7], answers: { like: { a: 'ore' }, deep: { a: 'deep', at: 5 }, 'BAD Q': { a: 'x', at: 1 } }, peak: 99, seenAt: -4 });
    expect(junk.moments).toEqual(['area:ok']);
    expect(Object.keys(junk.answers)).toEqual(['deep']);
    expect(junk.peak).toBe(5);
    expect(junk.seenAt).toBe(0);
    // An old save (before the bond) is a valid empty bond.
    const old = coerceGlim({ version: 1, met: true, metAt: 'x', ladder: {}, said: {}, lastAt: {} });
    expect(old.moments).toEqual([]);
    expect(old.peak).toBe(1);
  });
});

describe('GlimService: the bond through the gateway', () => {
  let service: GlimService;
  const boot = (): GlimService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(GlimService);
  };
  beforeEach(() => { localStorage.removeItem(GLIM_KEY); service = boot(); });
  afterEach(() => localStorage.removeItem(GLIM_KEY));

  it('adds only new moments, files a quest step once the questline is open, and survives a reload', () => {
    expect(service.addMoments(['area:infernal', 'area:infernal'])).toEqual(['area:infernal']);
    expect(service.addMoments(['area:infernal'])).toEqual([]);
    // Legend's needs, but still a stranger (3 + 3 + 5 = 11): no quest step yet.
    expect(service.addMoments(['area:ember-quarry', 'depth:0'])).toEqual(['area:ember-quarry', 'depth:0']);
    expect(service.stage.n).toBe(1);
    // One more place: Mapmates, and Legend is filed with it.
    expect(service.addMoments(['area:homestead'])).toEqual(['area:homestead', 'quest:1']);
    expect(service.stage.n).toBe(2);
    const reloaded = boot();
    expect(reloaded.state.moments).toContain('quest:1');
    expect(reloaded.stage.n).toBe(2);
  });

  it('remembers an answer, only one the question offers, and the later answer wins', () => {
    expect(service.answer('like', 'carvings', 10)).toBeTrue();
    expect(service.answer('like', 'gold', 20)).toBeFalse();
    expect(service.answerTo('like')).toBe('carvings');
    service.answer('like', 'way', 30);
    expect(boot().answerTo('like')).toBe('way');
  });

  it('keeps the peak and the last time out together, only ever rising', () => {
    service.reachStage(3);
    service.reachStage(2);
    service.seen(500);
    service.seen(100);
    const again = boot();
    expect(again.state.peak).toBe(3);
    expect(again.state.seenAt).toBe(500);
  });

  it('a cloud merge lands in memory (the registry rehydrates it)', () => {
    service.addMoments(['area:infernal']);
    const merged = mergeGlim({ ...emptyGlim(), moments: ['insc:roots-keepers-tally'] }, JSON.parse(localStorage.getItem(GLIM_KEY)!));
    localStorage.setItem(GLIM_KEY, JSON.stringify(merged));
    expect(TestBed.inject(LocalSaveRegistry).rehydrate(GLIM_KEY)).toBeTrue();
    expect(service.state.moments).toEqual(jasmine.arrayContaining(['area:infernal', 'insc:roots-keepers-tally']));
  });
});

describe('GlimVoice: bond lines', () => {
  const store = () => ({ state: { ...emptyGlim(), met: true }, meet() { /* met */ }, advance: () => 1, said() { /* noted */ } });
  const tick = { panelOpen: false, areaId: 'infernal', armed: true, hunted: true, goalsDone: true, dimmed: false };

  it('says a bond line with its talk on a quiet tick, never over a panel, one of a kind at a time', () => {
    const memory = store();
    memory.state.said = { meet: 1, edge: 1, maws: 1, homestead: 1, delve: 1, lantern: 1, stop: 1 };
    const voice = new GlimVoice(memory);
    voice.bond({ id: 'stage.2', key: 'glim.line.stage.2', talk: 'moths' });
    voice.bond({ id: 'stage.2', key: 'glim.line.stage.2', talk: 'moths' });
    expect(voice.bondWaiting).toBe(1);
    voice.tick({ ...tick, now: 1_000, panelOpen: true });
    expect(voice.speech).toBeNull();
    voice.tick({ ...tick, now: 2_000 });
    expect(voice.speech?.bond).toEqual({ id: 'stage.2', talk: 'moths' });
    expect(voice.speech?.key).toBe('glim.line.stage.2');
  });

  it('keeps the unsolicited gap between bond lines', () => {
    const memory = store();
    memory.state.said = { meet: 1, edge: 1, maws: 1, homestead: 1, delve: 1, lantern: 1, stop: 1 };
    const voice = new GlimVoice(memory);
    voice.bond({ id: 'a', key: 'glim.line.back' });
    voice.bond({ id: 'b', key: 'glim.line.quest.1' });
    voice.tick({ ...tick, now: 10_000 });
    voice.dismiss();
    voice.tick({ ...tick, now: 12_000 });
    expect(voice.speech).toBeNull();
    voice.tick({ ...tick, now: 40_000 });
    expect(voice.speech?.bond?.id).toBe('b');
  });
});
