/**
 * glim.spec.ts — Glim's hint ladder, its cooldowns and its merge.
 *
 * The three properties the companion must never lose:
 *   - the ladder opens one step at a time, and never for a secret;
 *   - it is never spammy (once-lines once, cooldowns, a global gap, quiet over panels);
 *   - what it remembers merges across devices without losing anything.
 */
import { SECRETS, SECRET_GROUPS } from '../../codex/codex-secrets';
import { DELVE_INSCRIPTIONS } from '../delve/delve-lore.model';
import { DELVE_MISSIONS } from '../npc/delve-missions.model';
import { NPCS } from '../npc/npc.model';
import { FIRST_GOALS_I18N } from '../../play/world/first-goals.i18n';
import { firstGoal, FirstGoalFacts, runeForgeHint } from '../../play/world/first-goals';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import {
  GLIM_GAP_MS, GLIM_HINTS, GLIM_IDLE_AFTER_MS, GLIM_LINES, GLIM_MARK_MS, GLIM_MARKS, GLIM_REFUSAL, GlimFacts, activeMark, canSay, glimHint, ladderTop, markKey, nextLine, pastBeats,
} from './glim';
import { GLIM_I18N } from './glim.i18n';
import { GLIM_KEY, GlimState, coerceGlim, emptyGlim, mergeGlim } from './glim-save.model';
import { GlimMemoryStore, GlimVoice } from './glim-voice';

/** GlimService's contract, in memory. */
class MemoryStore implements GlimMemoryStore {
  state: GlimState = emptyGlim();
  meet(at = new Date()): void { if (!this.state.met) this.state = { ...this.state, met: true, metAt: at.toISOString() }; }
  advance(subject: string, top = 3): number {
    const next = Math.min(Math.max(1, top), (this.state.ladder[subject] ?? 0) + 1);
    this.state = { ...this.state, ladder: { ...this.state.ladder, [subject]: next } };
    return next;
  }
  said(id: string, at = Date.now()): void {
    this.state = { ...this.state, said: { ...this.state.said, [id]: (this.state.said[id] ?? 0) + 1 }, lastAt: { ...this.state.lastAt, [id]: at } };
  }
}

function facts(over: Partial<GlimFacts> = {}): GlimFacts {
  return {
    now: 10_000_000, met: true, memory: { said: {}, lastAt: {} }, lastSpokeAt: 0, speaking: false, panelOpen: false,
    areaId: 'infernal', armed: false, hunted: false, goalsDone: false, delveSince: 0, dimmed: false, ...over,
  };
}

const HINT_KEYS = Object.values(GLIM_HINTS).flatMap(r => [r.nudge, r.direction]);
const ALL_HINT_KEYS = [...new Set([...HINT_KEYS, GLIM_REFUSAL, 'play.glim.hint.follow', 'play.glim.hint.here'])];

describe('Glim: the hint ladder', () => {
  it('opens one step at a time: nudge, then direction, then Show me', () => {
    const voice = new GlimVoice(new MemoryStore());
    const steps = [1, 2, 3, 4].map(() => voice.ask('goal.buy', 'play.goal.buy.town', 0));
    expect(steps.map(h => h.step)).toEqual([1, 2, 3, 3]);
    expect(steps[0]!.key).toBe(GLIM_HINTS['play.goal.buy.town']!.nudge);
    expect(steps[1]!.key).toBe(GLIM_HINTS['play.goal.buy.town']!.direction);
    expect(steps[2]!.walk).toBeTrue();
    expect(steps[0]!.walk || steps[1]!.walk).toBeFalse();
  });

  it('files progress under the goal, so a new area keeps the step', () => {
    const voice = new GlimVoice(new MemoryStore());
    voice.ask('goal.craft', 'play.goal.craft.mine', 0);
    expect(voice.ask('goal.craft', 'play.goal.craft.back', 0).step).toBe(2);
  });

  it('gives every Delve mission a step 3: Glim marks its target on the map', () => {
    for (const m of DELVE_MISSIONS) {
      expect(ladderTop(m.id)).withContext(m.id).toBe(3);
      const top = glimHint(m.id, 9);
      expect(top.step).withContext(m.id).toBe(3);
      expect(top.mark).withContext(m.id).toBeTrue();
      expect(top.walk).withContext(m.id).toBeFalse();
      expect(top.key).toBe('play.glim.hint.mark');
      expect(GLIM_MARKS[m.id]?.length).withContext(`${m.id} has a mark target`).toBeGreaterThan(0);
      // A mark is a place, never a carving's words: no mark names a secret.
      for (const target of GLIM_MARKS[m.id]!) expect(JSON.stringify(target)).not.toMatch(/nameless|void|secret/i);
    }
    expect(glimHint(DELVE_MISSIONS[0].id, 2).mark).toBeFalsy();
  });

  it('keeps a mark for half an hour, the latest one on the map, and merges it like any stamp', () => {
    const now = 50 * GLIM_MARK_MS;
    expect(activeMark({}, now)).toBeNull();
    expect(activeMark({ [markKey('delve-fracture')]: now - 1 }, now)).toBe('delve-fracture');
    expect(activeMark({ [markKey('delve-fracture')]: now - GLIM_MARK_MS }, now)).toBeNull();
    expect(activeMark({ [markKey('delve-fracture')]: now - 10, [markKey('fish-drowned-lamp-1')]: now - 5 }, now)).toBe('fish-drowned-lamp-1');
    expect(activeMark({ [markKey('not-a-mission')]: now }, now)).toBeNull();
    const a = { ...emptyGlim(), lastAt: { [markKey('delve-fracture')]: now - 10 } };
    const b = { ...emptyGlim(), lastAt: { [markKey('delve-fracture')]: now - 5 } };
    expect((mergeGlim(a, b) as GlimState).lastAt[markKey('delve-fracture')]).toBe(now - 5);
  });

  it('has a ladder for every line the goal line can show', () => {
    const goalKeys = Object.keys(FIRST_GOALS_I18N).filter(k => /^play\.goal\.(buy|craft|hunt|delve|rune)\.|^play\.goal\.away$/.test(k)
      && !/^play\.goal\.forge\./.test(k));
    for (const key of goalKeys) expect(ladderTop(key)).withContext(key).toBe(3);
    // And the ones firstGoal actually returns, across areas and states.
    const base: FirstGoalFacts = { bought: false, hunted: false, crafted: false, edge: false, armed: false, dug: false, areaId: 'infernal', ore: 0, ember: 0 };
    for (const areaId of ['infernal', 'homestead', 'ember-delve', 'ember-quarry', 'luminous']) {
      for (const over of [{}, { bought: true }, { bought: true, ore: 6, ember: 1 }, { bought: true, crafted: true, edge: true }, { bought: true, crafted: true, armed: true }, { bought: true, hunted: true }]) {
        const g = firstGoal({ ...base, ...over, areaId });
        if (g) expect(ladderTop(g.key)).withContext(`${areaId} ${g.key}`).toBeGreaterThan(0);
      }
    }
    const rune = runeForgeHint({ goalsDone: true, gold: 1e6, strikeCost: 600, seen: false, areaId: 'infernal' });
    expect(ladderTop(rune!.key)).toBe(3);
  });

  it('never ladders a secret: Codex secrets, inscriptions, the Nameless, the Void', () => {
    const secrets = [
      ...SECRETS.map(s => s.id), ...SECRET_GROUPS.map(g => g.id), ...DELVE_INSCRIPTIONS.map(i => i.id),
      'nameless', 'void', 'rune-void', 'glim', 'claude', 'constructor', '__proto__', 'toString',
    ];
    for (const id of secrets) {
      expect(ladderTop(id)).withContext(id).toBe(0);
      for (const step of [0, 1, 2, 3]) {
        const h = glimHint(id, step);
        expect(h.step).withContext(id).toBe(0);
        expect(h.key).withContext(id).toBe(GLIM_REFUSAL);
        expect(h.walk).toBeFalse();
      }
    }
  });

  it('stores nothing when it refuses', () => {
    const store = new MemoryStore();
    const voice = new GlimVoice(store);
    expect(voice.ask('secret.konami-ritual', 'konami-ritual', 0).key).toBe(GLIM_REFUSAL);
    expect(store.state.ladder).toEqual({});
  });

  it('never says a secret, a carving\'s words or its meaning, in either language', () => {
    const banned = [
      'nameless', 'konami', 'claude', 'void rune', 'ritual', 'console', 'command palette',
      ...SECRETS.map(s => s.name.toLowerCase()),
    ];
    const carvings = DELVE_INSCRIPTIONS.map(i => i.text.toLowerCase());
    for (const key of ALL_HINT_KEYS) {
      const row = GLIM_I18N[key];
      expect(row).withContext(key).toBeDefined();
      for (const text of [row!.en, row!.es].map(t => t.toLowerCase())) {
        for (const word of banned) expect(text.includes(word)).withContext(`${key}: ${word}`).toBeFalse();
        for (const c of carvings) expect(text.includes(c.slice(0, 24))).withContext(`${key} quotes a carving`).toBeFalse();
      }
    }
  });
});

describe('Glim: its lines are never spammy', () => {
  it('writes every line and hint in English and Spanish, short enough for a phone', () => {
    const keys = [...ALL_HINT_KEYS, ...Object.values(GLIM_LINES).map(l => l.key)];
    for (const key of keys) {
      const row = GLIM_I18N[key];
      expect(row?.en.trim()).withContext(key).toBeTruthy();
      expect(row?.es.trim()).withContext(key).toBeTruthy();
      expect(row!.en.length).withContext(`${key} is too long for the toast band`).toBeLessThanOrEqual(120);
    }
  });

  it('meets first, before anything else, even mid-gap', () => {
    expect(nextLine(facts({ met: false, lastSpokeAt: 9_999_999, armed: true }))).toBe('meet');
  });

  it('keeps quiet over an open panel and while a line is up', () => {
    expect(nextLine(facts({ met: false, panelOpen: true }))).toBeNull();
    expect(nextLine(facts({ met: false, speaking: true }))).toBeNull();
  });

  it('keeps a gap between unsolicited lines', () => {
    const f = facts({ armed: true });
    expect(nextLine({ ...f, lastSpokeAt: f.now - GLIM_GAP_MS + 1 })).toBeNull();
    expect(nextLine({ ...f, lastSpokeAt: f.now - GLIM_GAP_MS })).toBe('edge');
  });

  it('says a once-line once', () => {
    expect(canSay('stop', { said: {}, lastAt: {} }, 0)).toBeTrue();
    expect(canSay('stop', { said: { stop: 1 }, lastAt: { stop: 1 } }, 1e12)).toBeFalse();
    expect(nextLine(facts({ goalsDone: true, memory: { said: { stop: 1 }, lastAt: {} } }))).toBeNull();
  });

  it('honours a cooldown', () => {
    const cd = GLIM_LINES['mirror.again'].cooldownMs!;
    const memory = { said: { mirror: 1, 'mirror.again': 1 }, lastAt: { 'mirror.again': 1_000 } };
    expect(canSay('mirror.again', memory, 1_000 + cd - 1)).toBeFalse();
    expect(canSay('mirror.again', memory, 1_000 + cd)).toBeTrue();
  });

  it('says when to stop, once the goals are done', () => {
    expect(nextLine(facts({ goalsDone: true }))).toBe('stop');
  });

  it('dims and says so beside a Mirror Substitute: the tell first, then rarely', () => {
    expect(nextLine(facts({ dimmed: true, goalsDone: true }))).toBe('mirror');
    expect(nextLine(facts({ dimmed: true, memory: { said: { mirror: 1 }, lastAt: {} } }))).toBe('mirror.again');
  });

  it('waits a while into a Delve visit before an idle line, and shares one clock across them', () => {
    const memory = { said: { delve: 1, lantern: 1 }, lastAt: {} };
    const now = 10_000_000;
    expect(nextLine(facts({ areaId: 'ember-delve', memory, delveSince: now - GLIM_IDLE_AFTER_MS + 1 }))).toBeNull();
    expect(nextLine(facts({ areaId: 'ember-delve', memory, delveSince: now - GLIM_IDLE_AFTER_MS }))).toBe('idle.dashed');
    const recent = { said: { ...memory.said, 'idle.dashed': 1 }, lastAt: { 'idle.dashed': now - 60_000 } };
    expect(nextLine(facts({ areaId: 'ember-delve', memory: recent, delveSince: 1 }))).toBeNull();
  });

  it('does not walk a veteran back through the Prologue', () => {
    const store = new MemoryStore();
    const voice = new GlimVoice(store);
    const f = { now: 5_000, panelOpen: false, areaId: 'infernal', armed: true, hunted: true, goalsDone: true, dimmed: false };
    expect(voice.tick(f)).toBe('meet');
    expect(voice.justMet).toBeTrue();
    for (const beat of pastBeats(f)) expect(store.state.said[beat]).withContext(beat).toBe(1);
    // Later, with the gap long past, nothing from the Prologue comes back.
    voice.dismiss();
    expect(voice.tick({ ...f, now: 5_000 + GLIM_GAP_MS * 10 })).toBeNull();
  });

  it('lets a hint replace a line and expires lines on time', () => {
    const voice = new GlimVoice(new MemoryStore());
    voice.tick({ now: 0, panelOpen: false, areaId: 'infernal', armed: false, hunted: false, goalsDone: false, dimmed: false });
    expect(voice.speech?.line).toBe('meet');
    voice.ask('goal.buy', 'play.goal.buy.town', 1_000);
    expect(voice.speech?.hint?.step).toBe(1);
    voice.tick({ now: 1_000_000, panelOpen: false, areaId: 'infernal', armed: false, hunted: false, goalsDone: false, dimmed: false });
    expect(voice.speech?.hint).toBeUndefined();
  });
});

describe('Glim: what it remembers merges', () => {
  const a: GlimState = { version: 1, met: true, metAt: '2026-10-14T10:00:00.000Z', ladder: { 'goal.buy': 2, 'goal.craft': 1 }, said: { meet: 1, edge: 1 }, lastAt: { meet: 100, edge: 200 } };
  const b: GlimState = { version: 1, met: true, metAt: '2026-10-13T09:00:00.000Z', ladder: { 'goal.buy': 3 }, said: { meet: 1, stop: 1 }, lastAt: { meet: 50, stop: 900 } };

  it('keeps the earlier meeting, the further step, the higher count and the later stamp', () => {
    const m = mergeGlim(a, b) as GlimState;
    expect(m.met).toBeTrue();
    expect(m.metAt).toBe('2026-10-13T09:00:00.000Z');
    expect(m.ladder).toEqual({ 'goal.buy': 3, 'goal.craft': 1 });
    expect(m.said).toEqual({ meet: 1, edge: 1, stop: 1 });
    expect(m.lastAt).toEqual({ meet: 100, edge: 200, stop: 900 });
  });

  it('is commutative and idempotent', () => {
    expect(mergeGlim(a, b)).toEqual(mergeGlim(b, a));
    expect(mergeGlim(a, a)).toEqual(coerceGlim(a));
  });

  it('never un-meets', () => {
    expect((mergeGlim(emptyGlim(), a) as GlimState).met).toBeTrue();
    expect(mergeGlim(null, a)).toBe(a);
    expect(mergeGlim(a, undefined)).toBe(a);
  });

  it('drops junk and caps the ladder at 3', () => {
    const junk = coerceGlim({ met: 'yes', ladder: { 'goal.buy': 99, 'BAD ID': 1, x: -2 }, said: { meet: 'x' }, lastAt: [] });
    expect(junk.met).toBeFalse();
    expect(junk.ladder).toEqual({ 'goal.buy': 3 });
    expect(junk.said).toEqual({});
    expect(junk.lastAt).toEqual({});
  });

  it('is a synced blob with its own merge', () => {
    const blob = SYNCED_BLOBS.find(b => b.key === GLIM_KEY);
    expect(blob?.merge).toBe(mergeGlim);
  });
});

describe('Glim: in the cast', () => {
  it('is the one companion, Luminous gold, on no page', () => {
    const glim = NPCS.find(n => n.id === 'glim');
    expect(glim?.companion).toBeTruthy();
    expect(glim?.paths).toEqual([]);
    expect(glim?.epithet).toBe('the Margin-Light');
  });
});
