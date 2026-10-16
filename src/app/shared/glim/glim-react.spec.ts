/**
 * glim-react.spec.ts — Glim reacting and chatting (docs/handoff/pets-and-glim-alive.md):
 * every line exists EN + ES and is short; line selection never repeats a fresh
 * variant; cooldowns, the gap, the burst cap and "Quiet Glim" keep it from
 * nagging; the chat's choices open with the bond; tips and tales rotate; the
 * catch-the-light motes keep out of the middle; the quiet switch saves and merges.
 */
import { TestBed } from '@angular/core/testing';
import {
  CHAT_STAGE, CHAT_TOPICS, GLIM_MOMENTS, GLIM_REACTIONS, GLIM_REACT_BURST, GLIM_REACT_GAP, GLIM_STORIES, GLIM_TIPS, LIGHT_GAME,
  chatTopics, emptyReactMemory, glimPowers, lightGameKey, lightGameMotes, nextStory, nextTip, react, reactKey, storyKey, tipKey,
  type ReactMemory, type TipContext,
} from './glim-react';
import { GLIM_ALIVE_I18N } from './glim-alive.i18n';
import { GLIM_FACE_PALETTE, GLIM_H, GLIM_MOODS, GLIM_W, glimFace } from './glim-art';
import { GLIM_KEY, mergeGlim, coerceGlim, type GlimState } from './glim-save.model';
import { GlimService } from './glim.service';

const at = (now: number, over: Partial<{ quiet: boolean; busy: boolean; roll: number }> = {}) => ({ now, quiet: false, busy: false, roll: 0, ...over });

describe('Glim reacts: the words', () => {
  it('has every reaction, tip, tale and chat line in EN + ES, short, never guilt or the egg', () => {
    const keys = [
      ...GLIM_MOMENTS.flatMap(m => Array.from({ length: GLIM_REACTIONS[m].lines }, (_, i) => reactKey(m, i + 1))),
      ...(Object.keys(GLIM_TIPS) as TipContext[]).flatMap(c => Array.from({ length: GLIM_TIPS[c] }, (_, i) => tipKey(c, i + 1))),
      ...Array.from({ length: GLIM_STORIES }, (_, i) => storyKey(i + 1)),
      ...CHAT_TOPICS.map(t => `glim.chat.${t}`),
      ...['all', 'most', 'some', 'none'].map(k => `glim.play.${k}`),
      ...['room', 'cabinet', 'ore', 'node', 'drop'].map(k => `glim.find.${k}`),
    ];
    for (const key of keys) {
      const row = GLIM_ALIVE_I18N[key];
      expect(row?.en).withContext(key).toBeTruthy();
      expect(row?.es).withContext(key).toBeTruthy();
      const max = key.startsWith('glim.story.') || key.startsWith('glim.tip.') ? 140 : 120;
      expect(row!.en.length).withContext(key).toBeLessThanOrEqual(max);
      expect(row!.es.length).withContext(key).toBeLessThanOrEqual(max);
      expect(`${row!.en} ${row!.es}`.toLowerCase()).withContext(key).not.toMatch(/claude|missed you|streak|te extran/);
    }
  });
  it('paints every mood inside the 12×10 moth with known colours', () => {
    for (const mood of GLIM_MOODS) for (const [x, y, k] of glimFace(mood)) {
      expect(x >= 0 && x < GLIM_W && y >= 0 && y < GLIM_H).withContext(mood).toBeTrue();
      expect(k.length).toBe(1);
      expect(k in GLIM_FACE_PALETTE || 'eoabk m'.includes(k)).withContext(`${mood} ${k}`).toBeTrue();
    }
  });
});

describe('Glim reacts: the rules', () => {
  it('says a line and pulls a face; a second of the same moment rests; the variant changes', () => {
    let mem = emptyReactMemory();
    const a = react('dodge', mem, at(1000));
    expect(a.key).toBe(reactKey('dodge', 1));
    expect(a.mood).toBe('gasp');
    mem = a.memory;
    const b = react('dodge', mem, at(1000 + 5_000));
    expect(b.key).toBeNull();
    expect(b.mood).toBe('gasp');
    const c = react('dodge', mem, at(1000 + GLIM_REACTIONS.dodge.rest * 1000 + 1));
    expect(c.key).not.toBe(a.key);
  });
  it('keeps the gap between unasked lines, but an urgent moment speaks', () => {
    const first = react('place', emptyReactMemory(), at(10_000));
    expect(first.key).toBeTruthy();
    expect(react('rare', first.memory, at(10_000 + GLIM_REACT_GAP - 1)).key).toBeNull();
    expect(react('legendary', first.memory, at(10_000 + 1)).key).toBeTruthy();
    expect(react('rare', first.memory, at(10_000 + GLIM_REACT_GAP)).key).toBeTruthy();
  });
  it('never more than the burst cap in the window, urgent or not', () => {
    let mem: ReactMemory = emptyReactMemory();
    let said = 0;
    for (let i = 0; i < 20; i++) { const r = react('legendary', mem, at(1000 + i * 100)); mem = r.memory; if (r.key) said++; }
    expect(said).toBe(GLIM_REACT_BURST);
  });
  it('quiet or busy: a face, no words, and nothing remembered as said', () => {
    for (const over of [{ quiet: true }, { busy: true }]) {
      const r = react('levelUp', emptyReactMemory(), at(5, over));
      expect(r.key).toBeNull();
      expect(r.mood).toBe('happy');
      expect(r.memory.recent).toEqual([]);
    }
  });
  it('does not repeat a variant while a fresh one waits', () => {
    let mem = emptyReactMemory();
    const seen: string[] = [];
    for (let i = 0; i < GLIM_REACTIONS.legendary.lines; i++) { const r = react('legendary', mem, at(1000 + i * 70_000, { roll: .99 })); mem = r.memory; seen.push(r.key!); }
    expect(new Set(seen).size).toBe(GLIM_REACTIONS.legendary.lines);
  });
});

describe('Glim chat', () => {
  it('opens its choices with the bond, and its powers too', () => {
    expect(chatTopics({ n: 1 })).toEqual(CHAT_TOPICS.filter(t => CHAT_STAGE[t] <= 1));
    expect(chatTopics({ n: 5 })).toEqual([...CHAT_TOPICS]);
    expect(chatTopics({ n: 1 })).not.toContain('find');
    expect(glimPowers({ n: 1 })).toEqual({ lamp: false, missed: false });
    expect(glimPowers({ n: 3 })).toEqual({ lamp: true, missed: true });
  });
  it('rotates tips and tells the tale told least', () => {
    const heard: string[] = [];
    for (let i = 0; i < GLIM_TIPS.delve; i++) heard.push(nextTip('delve', heard));
    expect(new Set(heard).size).toBe(GLIM_TIPS.delve);
    expect(nextTip('delve', heard)).toBe(tipKey('delve', 1));
    expect(nextStory({})).toBe(1);
    expect(nextStory({ 'story.1': 2, 'story.2': 1 })).toBe(3);
  });
  it('places the light motes in the outer band only, and scores them', () => {
    for (let round = 1; round < 40; round++) {
      const motes = lightGameMotes(round);
      expect(motes.length).toBe(LIGHT_GAME.motes);
      for (const m of motes) expect(m.x < .25 || m.x > .75).withContext(`${round}`).toBeTrue();
    }
    expect(lightGameKey(5)).toBe('glim.play.all');
    expect(lightGameKey(3)).toBe('glim.play.most');
    expect(lightGameKey(1)).toBe('glim.play.some');
    expect(lightGameKey(0)).toBe('glim.play.none');
  });
});

describe('Quiet Glim (through the gateway)', () => {
  let service: GlimService;
  const boot = () => { TestBed.resetTestingModule(); TestBed.configureTestingModule({}); return TestBed.inject(GlimService); };
  beforeEach(() => { localStorage.removeItem(GLIM_KEY); service = boot(); });
  afterEach(() => localStorage.removeItem(GLIM_KEY));

  it('saves the switch, survives a reload, and the later choice wins a merge', () => {
    expect(service.quiet).toBeFalse();
    service.setQuiet(true, 1000);
    expect(service.quiet).toBeTrue();
    service = boot();
    expect(service.quiet).toBeTrue();
    service.setQuiet(false, 500);
    expect(service.quiet).toBeFalse();
    const a = coerceGlim({ lastAt: { 'quiet.on': 5000 } }), b = coerceGlim({ lastAt: { 'quiet.off': 7000 } });
    const ab = mergeGlim(a, b) as GlimState;
    expect((ab.lastAt['quiet.on'] ?? 0) > (ab.lastAt['quiet.off'] ?? 0)).toBeFalse();
    expect(mergeGlim(b, a)).toEqual(ab);
  });
});
