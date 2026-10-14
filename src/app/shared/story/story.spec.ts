/**
 * story.spec.ts — the Keeper's story: the state machine, the merge, the journal.
 *
 * The properties the story must never lose:
 *   - a beat is reached only when the save says the thing happened, it is
 *     never un-reached, and the chapter never goes backwards;
 *   - catching up (a loaded save) is silent and files its cards as shown;
 *     only a beat reached live speaks or raises a card;
 *   - two devices merge to the union of beats and the further chapter;
 *   - the journal never shows an unreached beat, and leads never spoil.
 */
import { DELVE_INSCRIPTIONS } from '../delve/delve-lore.model';
import { DELVE_INSCRIPTION_LORE } from '../delve/delve-inscription-lore';
import { DELVE_MISSIONS } from '../npc/delve-missions.model';
import { NPCS } from '../npc/npc.model';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import { GlimMemoryStore, GlimVoice } from '../glim/glim-voice';
import { GlimState, emptyGlim } from '../glim/glim-save.model';
import { STORY_I18N } from './story.i18n';
import {
  STORY_BEATS, STORY_CARD_PARAGRAPHS, StoryFacts, advanceStory, cardShown, journalView, linesOf, nextLead, pendingCard,
} from './story';
import {
  STORY_BEAT_IDS, STORY_CARD_IDS, STORY_KEY, StoryBeatId, StoryState, coerceStory, emptyStory, mergeStory,
} from './story-save.model';

function facts(over: Partial<StoryFacts> & { missions?: string[] } = {}): StoryFacts {
  const missions = new Set(over.missions ?? []);
  return {
    met: false, bought: false, armed: false, hunted: false, dug: false,
    inscriptions: new Set(), missionDone: id => missions.has(id), wardenDown: false, ...over,
  };
}

/** Everything a Keeper does on the way to the act break, in the order a player would. */
const PROLOGUE = { met: true, bought: true, armed: true, hunted: true, dug: true };
const ALL_INSCRIPTIONS = new Set(DELVE_INSCRIPTIONS.map(i => i.id));
const EVERY_MISSION = DELVE_MISSIONS.map(m => m.id);

const en = (key: string) => STORY_I18N[key]?.en ?? '';

describe('Story: the beats', () => {
  it('a fresh save is in the Prologue with nothing reached', () => {
    const r = advanceStory(emptyStory(), facts(), true);
    expect(r.changed).toBeFalse();
    expect(r.state.chapter).toBe('prologue');
    expect(r.state.beats).toEqual([]);
  });

  it('the Prologue wraps the four first goals, in order, and stays the Prologue', () => {
    let s = emptyStory();
    s = advanceStory(s, facts({ met: true }), true).state;
    s = advanceStory(s, facts({ met: true, bought: true }), true).state;
    s = advanceStory(s, facts({ met: true, bought: true, armed: true, hunted: true, dug: true }), true).state;
    expect(s.beats).toEqual(['p.arrival', 'p.homestead', 'p.edge', 'p.maw', 'p.dig']);
    expect(s.chapter).toBe('prologue');
    expect(pendingCard(s)).toBeNull();
  });

  it('reading the first carving ends the Prologue: Kael speaks and the Act I card waits', () => {
    const s0 = advanceStory(emptyStory(), facts(PROLOGUE), true).state;
    const r = advanceStory(s0, facts({ ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree']) }), true);
    expect(r.reached).toEqual(['p.words']);
    expect(r.state.chapter).toBe('act1');
    expect(r.lines).toEqual([{ beat: 'p.words', speaker: 'kael', key: 'story.say.p.words.1' }]);
    expect(pendingCard(r.state)).toBe('act1');
    expect(pendingCard(cardShown(r.state, 'act1'))).toBeNull();
  });

  it('the fresh mark is the deepest carving, and Glim says it is yours, in two lines', () => {
    const s0 = advanceStory(emptyStory(), facts({ ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree']) }), false).state;
    const r = advanceStory(s0, facts({ ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree', 'magma-unsigned']) }), true);
    expect(r.reached).toEqual(['a1.fresh']);
    expect(r.lines.map(l => l.key)).toEqual(['story.say.a1.fresh.1', 'story.say.a1.fresh.2']);
    expect(r.lines.every(l => l.speaker === 'glim')).toBeTrue();
    expect(en('story.say.a1.fresh.2')).toContain('yours');
  });

  it('a fresh save reaches the act break by playing the shipped Delve chain', () => {
    let s = emptyStory();
    const steps: Partial<StoryFacts & { missions: string[] }>[] = [
      PROLOGUE,
      { ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree']) },
      { ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree', 'roots-keepers-tally']), missions: ['delve-verrin-shadow'] },
      { ...PROLOGUE, inscriptions: new Set(['roots-inverse-tree', 'roots-keepers-tally']), missions: ['delve-verrin-shadow', 'delve-kael-seam', 'delve-merchant-glowcaps'] },
      { ...PROLOGUE, inscriptions: ALL_INSCRIPTIONS, wardenDown: true, missions: ['delve-verrin-shadow', 'delve-kael-seam', 'delve-merchant-glowcaps', 'delve-archivist-words-3'] },
      { ...PROLOGUE, inscriptions: ALL_INSCRIPTIONS, wardenDown: true, missions: EVERY_MISSION },
    ];
    const cards: string[] = [];
    for (const step of steps) {
      s = advanceStory(s, facts(step), true).state;
      const card = pendingCard(s);
      if (card) { cards.push(card); s = cardShown(s, card); }
    }
    expect(s.beats).toEqual([...STORY_BEAT_IDS]);
    expect(s.chapter).toBe('act2');
    expect(cards).toEqual(['act1', 'act2']);
    expect(nextLead(s)).toBe('story.lead.chapter.act2');
  });

  it('every beat is reachable from the shipped game: real mission and inscription ids only', () => {
    const missions = new Set(DELVE_MISSIONS.map(m => m.id));
    const used = new Set<string>();
    const probe = facts({ ...PROLOGUE, inscriptions: { has: (id: string) => (used.add(id), ALL_INSCRIPTIONS.has(id)), size: 12 } as unknown as ReadonlySet<string>,
      missionDone: id => (used.add(id), true), wardenDown: true });
    for (const beat of STORY_BEATS) expect(beat.reached(probe)).withContext(beat.id).toBeTrue();
    for (const id of used) expect(missions.has(id) || ALL_INSCRIPTIONS.has(id)).withContext(id).toBeTrue();
  });

  it('catching up is silent: a loaded save files its beats and marks the cards it crossed as shown', () => {
    const r = advanceStory(emptyStory(), facts({ ...PROLOGUE, inscriptions: ALL_INSCRIPTIONS, wardenDown: true, missions: EVERY_MISSION }), false);
    expect(r.lines).toEqual([]);
    expect(r.state.chapter).toBe('act2');
    expect(pendingCard(r.state)).toBeNull();
    expect(r.state.cards).toEqual(['act1', 'act2']);
  });

  it('a card crossed live but never shown survives a reload (catching up does not swallow it)', () => {
    const live = advanceStory(advanceStory(emptyStory(), facts(PROLOGUE), true).state, facts({ ...PROLOGUE, inscriptions: new Set(['grotto-drowned-lamp']) }), true).state;
    const reloaded = advanceStory(coerceStory(JSON.parse(JSON.stringify(live))), facts({ ...PROLOGUE, inscriptions: new Set(['grotto-drowned-lamp']) }), false);
    expect(pendingCard(reloaded.state)).toBe('act1');
  });

  it('never moves backwards: facts that regress keep every beat and the chapter', () => {
    const far = advanceStory(emptyStory(), facts({ ...PROLOGUE, inscriptions: ALL_INSCRIPTIONS, missions: EVERY_MISSION, wardenDown: true }), false).state;
    const r = advanceStory(far, facts(), true);
    expect(r.changed).toBeFalse();
    expect(r.state.beats.length).toBe(STORY_BEAT_IDS.length);
    expect(r.state.chapter).toBe('act2');
  });

  it('speaks only in canon voices: Glim and four keepers, each a cast member', () => {
    const cast = new Set(NPCS.map(n => n.id));
    for (const beat of STORY_BEATS) expect(cast.has(beat.speaker)).withContext(beat.id).toBeTrue();
  });
});

describe('Story: the record and its merge', () => {
  const a: StoryState = { version: 1, chapter: 'act1', beats: ['p.arrival', 'p.words', 'a1.tally'], cards: ['act1'] };
  const b: StoryState = { version: 1, chapter: 'prologue', beats: ['p.arrival', 'p.homestead', 'p.edge'], cards: [] };

  it('is synced through cloud save with its own merge', () => {
    const entry = SYNCED_BLOBS.find(x => x.key === STORY_KEY);
    expect(entry?.collection).toBe('progress');
    expect(entry?.doc).toBe('story');
    expect(entry?.merge).toBe(mergeStory);
  });

  it('merges to the union of beats and cards and the further chapter', () => {
    const m = mergeStory(a, b) as StoryState;
    expect(m.beats).toEqual(['p.arrival', 'p.homestead', 'p.edge', 'p.words', 'a1.tally']);
    expect(m.cards).toEqual(['act1']);
    expect(m.chapter).toBe('act1');
  });

  it('is commutative and idempotent', () => {
    expect(mergeStory(a, b)).toEqual(mergeStory(b, a));
    const m = mergeStory(a, b);
    expect(mergeStory(m, m)).toEqual(m);
    expect(mergeStory(m, a)).toEqual(m);
  });

  it('keeps the further beat when only one device has it, and keeps a side that is missing', () => {
    expect(mergeStory(null, a)).toBe(a);
    expect(mergeStory(a, undefined)).toBe(a);
    const m = mergeStory({ version: 1, chapter: 'act2', beats: [...STORY_BEAT_IDS], cards: ['act1', 'act2'] }, emptyStory()) as StoryState;
    expect(m.chapter).toBe('act2');
  });

  it('drops junk ids and never lets the chapter fall behind its beats', () => {
    const c = coerceStory({ version: 9, chapter: 'act9', beats: ['a1.break', 'nope', 7, 'p.arrival', 'p.arrival'], cards: ['act1', 'act7'] });
    expect(c.beats).toEqual(['p.arrival', 'a1.break']);
    expect(c.cards).toEqual(['act1']);
    expect(c.chapter).toBe('act2');
    expect(coerceStory('junk')).toEqual(emptyStory());
    expect(coerceStory([1, 2])).toEqual(emptyStory());
  });
});

describe('Story: the journal', () => {
  /** Every word the journal would show, in English, for a state. */
  function shown(state: StoryState): string {
    const v = journalView(state);
    return [v.title, v.lead, ...v.chapters.flatMap(c => [c.title, ...c.intro, ...c.beats.flatMap(b => [b.title, b.text])])].map(en).join('\n');
  }

  it('never shows an unreached beat: not its title, not its words', () => {
    const partial: StoryState = coerceStory({ version: 1, chapter: 'act1', beats: ['p.arrival', 'p.homestead', 'p.edge', 'p.maw', 'p.dig', 'p.words', 'a1.shadow'], cards: ['act1'] });
    const text = shown(partial);
    const view = journalView(partial);
    const listed = view.chapters.flatMap(c => c.beats.map(b => b.id));
    for (const id of STORY_BEAT_IDS) {
      const reached = partial.beats.includes(id);
      expect(listed.includes(id)).withContext(id).toBe(reached);
      if (!reached) {
        expect(text).not.toContain(en(`story.beat.${id}.title`));
        expect(text).not.toContain(en(`story.beat.${id}.text`));
      }
    }
    // The fresh mark is the secret of Act I: nothing about it shows before it is found.
    expect(text).not.toContain('fresh one');
    expect(text.toLowerCase()).not.toContain('yours');
  });

  it('lists only chapters reached, newest first, with counts and the current one marked', () => {
    const v = journalView(coerceStory({ version: 1, chapter: 'prologue', beats: ['p.arrival'], cards: [] }));
    expect(v.chapters.map(c => c.id)).toEqual(['prologue']);
    expect(v.chapters[0]!.found).toBe(1);
    expect(v.chapters[0]!.total).toBe(6);
    expect(v.chapters[0]!.current).toBeTrue();
    expect(v.lead).toBe('story.lead.p.homestead');
    const after = journalView(coerceStory({ version: 1, chapter: 'act2', beats: [...STORY_BEAT_IDS], cards: [] }));
    expect(after.chapters.map(c => c.id)).toEqual(['act2', 'act1', 'prologue']);
    expect(after.chapters[0]!.total).toBe(0);
  });

  it('the next lead says where to look, never what is there', () => {
    const quotes = DELVE_INSCRIPTIONS.map(i => i.text).concat(Object.values(DELVE_INSCRIPTION_LORE).map(l => l.text));
    for (const beat of STORY_BEATS) {
      const lead = STORY_I18N[`story.lead.${beat.id}`];
      expect(lead).withContext(beat.id).toBeDefined();
      for (const q of quotes) expect(lead!.en).not.toContain(q.slice(0, 30));
    }
  });
});

describe('Story: the words', () => {
  const keys = [
    ...STORY_BEATS.flatMap(b => [...linesOf(b).map(l => l.key), `story.beat.${b.id}.title`, `story.beat.${b.id}.text`, `story.lead.${b.id}`]),
    ...STORY_CARD_IDS.flatMap(c => [`story.card.${c}.kicker`, `story.card.${c}.title`, ...Array.from({ length: STORY_CARD_PARAGRAPHS[c] }, (_, n) => `story.card.${c}.p${n + 1}`)]),
    'story.card.prologue.p1', 'story.chapter.prologue', 'story.chapter.act1', 'story.chapter.act2',
    'story.lead.chapter.prologue', 'story.lead.chapter.act1', 'story.lead.chapter.act2', 'story.card.continue',
  ];

  it('every key the story uses exists in EN and ES', () => {
    for (const key of keys) {
      expect(STORY_I18N[key]?.en).withContext(key).toBeTruthy();
      expect(STORY_I18N[key]?.es).withContext(key).toBeTruthy();
    }
  });

  it('spoken lines fit Glim\'s line (≤ 120 characters) and cards stay at three short paragraphs', () => {
    for (const beat of STORY_BEATS) for (const line of linesOf(beat)) {
      expect(STORY_I18N[line.key]!.en.length).withContext(line.key).toBeLessThanOrEqual(120);
      expect(STORY_I18N[line.key]!.es.length).withContext(line.key).toBeLessThanOrEqual(120);
    }
    for (const card of STORY_CARD_IDS) {
      expect(STORY_CARD_PARAGRAPHS[card]).toBeLessThanOrEqual(3);
      for (let n = 1; n <= STORY_CARD_PARAGRAPHS[card]; n++) expect(en(`story.card.${card}.p${n}`).length).toBeLessThanOrEqual(220);
    }
  });

  it('every beat id has words, and no table key names a beat that does not exist', () => {
    const beatKeys = Object.keys(STORY_I18N).filter(k => k.startsWith('story.beat.'));
    for (const k of beatKeys) {
      const id = k.slice('story.beat.'.length).replace(/\.(title|text)$/, '') as StoryBeatId;
      expect(STORY_BEAT_IDS.includes(id)).withContext(k).toBeTrue();
    }
  });
});

describe('Story: lines ride Glim\'s one speech line', () => {
  class Memory implements GlimMemoryStore {
    state: GlimState = { ...emptyGlim(), met: true, metAt: '2026-10-14T00:00:00.000Z', said: { meet: 1 }, lastAt: { meet: 1 } };
    meet(): void { /* met */ }
    advance(): number { return 1; }
    said(id: string, at = 0): void { this.state = { ...this.state, said: { ...this.state.said, [id]: 1 }, lastAt: { ...this.state.lastAt, [id]: at } }; }
  }
  const tick = { panelOpen: false, areaId: 'ember-delve', armed: true, hunted: true, goalsDone: true, dimmed: false };

  it('plays a beat\'s lines in order, one at a time, with the speaker named', () => {
    const voice = new GlimVoice(new Memory());
    voice.story([{ beat: 'a1.fresh', speaker: 'glim', key: 'story.say.a1.fresh.1' }, { beat: 'a1.fresh', speaker: 'glim', key: 'story.say.a1.fresh.2' }]);
    voice.tick({ ...tick, now: 1_000_000 });
    expect(voice.speech?.key).toBe('story.say.a1.fresh.1');
    expect(voice.speech?.story).toEqual({ beat: 'a1.fresh', speaker: 'glim' });
    voice.tick({ ...tick, now: 1_001_000 });
    expect(voice.speech?.key).toBe('story.say.a1.fresh.1');
    voice.dismiss();
    voice.tick({ ...tick, now: 1_002_000 });
    expect(voice.speech?.key).toBe('story.say.a1.fresh.2');
    expect(voice.storyWaiting).toBe(0);
  });

  it('keeps quiet over a panel (or a story card), and speaks once the Keeper is back', () => {
    const voice = new GlimVoice(new Memory());
    voice.story([{ beat: 'a1.hammer', speaker: 'kael', key: 'story.say.a1.hammer.1' }]);
    voice.tick({ ...tick, now: 1_000_000, panelOpen: true });
    expect(voice.speech).toBeNull();
    voice.tick({ ...tick, now: 1_000_200 });
    expect(voice.speech?.story?.speaker).toBe('kael');
  });
});
