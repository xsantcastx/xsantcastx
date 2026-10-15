/**
 * story.ts — the Keeper's story as pure data and pure rules.
 *
 * The Prologue "The Fresh Mark" and Act I "The Old Seam" from
 * docs/world/world-and-cast.md §2, slice S2; Act II "Five Witnesses"
 * (docs/handoff/story-act-2.md), whose beats each play a SCENE: a few lines
 * from the people of that realm, Glim's line, and one reward. The story never runs on its own
 * clock: every beat is something the Keeper already does in the game (a first
 * goal, a carving read, a Delve mission claimed, the Seam Eater felled), so a
 * beat is *reached* when the save says that thing happened. This file decides:
 *
 *   - BEATS: what each moment is, which chapter it belongs to, who speaks
 *     when it happens (Glim or a keeper, through Glim's one speech line), and
 *     the lead that points at it before it is found;
 *   - ADVANCE: given this tick's facts, which beats are new. Live beats speak
 *     and may raise an act-boundary card; beats found by catching up (a save
 *     loaded with progress already in it) are filed quietly and their cards
 *     marked shown, so a veteran is not walked back through the story;
 *   - LEAD and JOURNAL: the Story tab's "next lead" and the beats found so far.
 *     An unreached beat never shows its title or text anywhere: the journal
 *     lists only what was found, and the lead says where to look, never what
 *     is there (secrets stay secrets — the same rule as Glim's hint ladder).
 *
 * Words live in story.i18n.ts (lazy, EN + ES); ids live in story-save.model.ts.
 * No Angular, no browser APIs.
 */
import {
  STORY_BEAT_CHAPTER, STORY_BEAT_IDS, STORY_BOUNDARY, STORY_CHAPTERS, STORY_SCENE_IDS, StoryBeatId, StoryCardId, StoryChapterId,
  StorySceneId, StoryState, chapterOf, coerceStory, furtherChapter,
} from './story-save.model';

/** What the save says has happened, gathered by the play view each HUD tick. */
export interface StoryFacts {
  /** Glim has landed on the Keeper's shoulder. */
  met: boolean;
  /** The four first goals (world/first-goals.ts). */
  bought: boolean;
  armed: boolean;
  hunted: boolean;
  dug: boolean;
  /** Inscription ids read in the Delve (DelveLoreService). */
  inscriptions: ReadonlySet<string>;
  /** A Delve mission claimed (or a repeatable one filled at least once). */
  missionDone: (missionId: string) => boolean;
  /** The Seam Eater, the fragment chamber's warden, has fallen (WARDEN_FLAG). */
  wardenDown: boolean;
  /** Lost Cabinets opened with the Mirror Slate's Scan (CabinetsService.count). Absent: none. */
  cabinets?: number;
}

/**
 * Who says a beat's line, or a line in a scene. Glim, a canon keeper, or (in
 * Act II's scenes only) one of the people whose realm gave its account.
 */
export type StorySpeaker = 'glim' | 'kael' | 'verrin' | 'merchant' | 'archivist'
  | 'aureth' | 'rook' | 'kesh' | 'siv' | 'lune' | 'sera' | 'hollis';

/** The pixel portrait each speaker wears (keeper-look/npc-portrait.ts ids: their town keeper, or Glim's moth). */
export const STORY_PORTRAIT: Readonly<Record<StorySpeaker, string>> = {
  glim: 'glim', kael: 'kael', verrin: 'verrin', merchant: 'merchant', archivist: 'archivist', aureth: 'aureth',
  rook: 'rook', kesh: 'lodge-warden', siv: 'steward', lune: 'croupier', sera: 'sera', hollis: 'hollis-fenn',
};

/** Lost Cabinets that make the Archivist's docket's first page (one page per four, cabinets.model ARC). */
export const STORY_CABINETS = 4;

export interface StoryBeat {
  id: StoryBeatId;
  chapter: StoryChapterId;
  reached: (f: StoryFacts) => boolean;
  /** Spoken when the beat happens live, in order (i18n keys `story.say.<id>.<n>`). 0 = silent. */
  lines: number;
  speaker: StorySpeaker;
}

/** Order here is the order the journal lists them and the order leads point at them. */
export const STORY_BEATS: readonly StoryBeat[] = [
  // ── Prologue — The Fresh Mark ──
  { id: 'p.arrival', chapter: 'prologue', reached: f => f.met, lines: 0, speaker: 'glim' },
  { id: 'p.homestead', chapter: 'prologue', reached: f => f.bought, lines: 0, speaker: 'glim' },
  { id: 'p.edge', chapter: 'prologue', reached: f => f.armed, lines: 0, speaker: 'glim' },
  { id: 'p.maw', chapter: 'prologue', reached: f => f.hunted, lines: 0, speaker: 'glim' },
  { id: 'p.dig', chapter: 'prologue', reached: f => f.dug, lines: 0, speaker: 'glim' },
  // The Prologue ends when the Keeper reads their first carving (any of them). Kael's
  // words ("You read it. Most people step over it.") open the Act I card, not a line.
  { id: 'p.words', chapter: 'prologue', reached: f => f.inscriptions.size > 0, lines: 0, speaker: 'kael' },
  // ── Act I — The Old Seam ──
  { id: 'a1.shadow', chapter: 'act1', reached: f => f.missionDone('delve-verrin-shadow'), lines: 1, speaker: 'verrin' },
  { id: 'a1.tally', chapter: 'act1', reached: f => f.inscriptions.has('roots-keepers-tally'), lines: 1, speaker: 'glim' },
  { id: 'a1.hammer', chapter: 'act1', reached: f => f.missionDone('delve-kael-seam'), lines: 1, speaker: 'kael' },
  { id: 'a1.prices', chapter: 'act1', reached: f => f.missionDone('delve-merchant-glowcaps'), lines: 1, speaker: 'merchant' },
  { id: 'a1.eater', chapter: 'act1', reached: f => f.wardenDown, lines: 1, speaker: 'glim' },
  // The fresh mark: the deepest carving, and the Keeper finds out it is theirs.
  { id: 'a1.fresh', chapter: 'act1', reached: f => f.inscriptions.has('magma-unsigned'), lines: 2, speaker: 'glim' },
  { id: 'a1.dated', chapter: 'act1', reached: f => f.missionDone('delve-archivist-words-3'), lines: 1, speaker: 'archivist' },
  // The act break: Kael holds the Godforge Fragment.
  { id: 'a1.break', chapter: 'act1', reached: f => f.missionDone('delve-fracture'), lines: 1, speaker: 'glim' },
  // ── Act II — Five Witnesses: The Four Who Went Down (the Underhearth, Phase 8) ──
  { id: 'a2.under', chapter: 'act2', reached: f => f.missionDone('kael-four-1'), lines: 1, speaker: 'kael' },
  { id: 'a2.marks', chapter: 'act2', reached: f => f.missionDone('kael-four-2'), lines: 1, speaker: 'kael' },
  { id: 'a2.furnace', chapter: 'act2', reached: f => f.missionDone('verrin-four-3'), lines: 1, speaker: 'kael' },
  // ── Act II — the four realm Delves behind the Rift Gates: each realm's account is given when its
  //    guardian is ended and its chain closes. Silent beats: each plays a scene instead. ──
  { id: 'a2.ink', chapter: 'act2', reached: f => f.missionDone('verrin-ink-3'), lines: 0, speaker: 'verrin' },
  { id: 'a2.root', chapter: 'act2', reached: f => f.missionDone('kesh-roots-3'), lines: 0, speaker: 'kesh' },
  { id: 'a2.prism', chapter: 'act2', reached: f => f.missionDone('aureth-prism-3'), lines: 0, speaker: 'aureth' },
  { id: 'a2.orrery', chapter: 'act2', reached: f => f.missionDone('sera-wells-3'), lines: 0, speaker: 'sera' },
  // The Archivist's docket: four Lost Cabinets opened, once Act II is open (a Slate can scan in Act I too,
  // and the record must never jump a chapter on a cabinet).
  {
    id: 'a2.cabinets', chapter: 'act2', lines: 0, speaker: 'archivist',
    reached: f => f.missionDone('delve-fracture') && (f.cabinets ?? 0) >= STORY_CABINETS,
  },
  // The act's end: all five accounts in (the Furnace's and the four realms'). The light coming up.
  {
    id: 'a2.lamp', chapter: 'act2', lines: 0, speaker: 'kael',
    reached: f => ['verrin-four-3', 'verrin-ink-3', 'kesh-roots-3', 'aureth-prism-3', 'sera-wells-3'].every(id => f.missionDone(id)),
  },
];

// ── Scenes (Act II) ──────────────────────────────────────────────────────────

/** What a scene gives, once: the receipt is the scene id in `scenes`, written first. */
export type StoryReward =
  /** A `title-prefix` cosmetic variant (economy.model COSMETICS): the word in front of your rank. */
  | { kind: 'title'; variant: string }
  /** Satchel stacks, through one idempotent grant keyed `story-scene:<id>`. */
  | { kind: 'stack'; item: string; qty: number }
  /** A Codex page: The Witness Accounts (codex-accounts.component.ts). */
  | { kind: 'codex' };

export interface StoryScene {
  id: StorySceneId;
  /** Who says each line, in order (i18n `story.scene.<id>.<n>`, from 1). Glim always has the last word. */
  lines: readonly StorySpeaker[];
  reward: StoryReward;
}

/**
 * Act II's scenes, in story order: the Furnace's account, the four realms'
 * behind the Rift Gates, the Archivist's docket, and the light coming up.
 * Two to five lines each, the people of that realm, then Glim.
 */
export const STORY_SCENES: readonly StoryScene[] = [
  { id: 'a2.furnace', lines: ['kael', 'verrin', 'kael', 'glim'], reward: { kind: 'codex' } },
  { id: 'a2.ink', lines: ['verrin', 'rook', 'verrin', 'glim'], reward: { kind: 'stack', item: 'waystone-shard', qty: 2 } },
  { id: 'a2.root', lines: ['kesh', 'siv', 'siv', 'glim'], reward: { kind: 'title', variant: 'the-ungrafted' } },
  { id: 'a2.prism', lines: ['aureth', 'lune', 'aureth', 'glim'], reward: { kind: 'title', variant: 'dawn-witness' } },
  { id: 'a2.orrery', lines: ['sera', 'archivist', 'sera', 'glim'], reward: { kind: 'stack', item: 'waystone-shard', qty: 2 } },
  { id: 'a2.cabinets', lines: ['archivist', 'hollis', 'archivist', 'glim'], reward: { kind: 'stack', item: 'courier-honeycomb', qty: 3 } },
  { id: 'a2.lamp', lines: ['kael', 'archivist', 'kael', 'glim'], reward: { kind: 'title', variant: 'witness-keeper' } },
];

/** The witness scenes whose account the Codex's page keeps, in the order of the five realms' undersides. */
export const STORY_ACCOUNTS: readonly StorySceneId[] = ['a2.furnace', 'a2.ink', 'a2.root', 'a2.prism', 'a2.orrery'];

export function sceneById(id: string): StoryScene | undefined {
  return STORY_SCENES.find(s => s.id === id);
}

/** A scene's line keys with their speakers. */
export function sceneLines(scene: StoryScene): { speaker: StorySpeaker; key: string }[] {
  return scene.lines.map((speaker, n) => ({ speaker, key: `story.scene.${scene.id}.${n + 1}` }));
}

/** Scenes whose beat is reached and which have not been played, in story order. */
export function pendingScenes(raw: StoryState): StorySceneId[] {
  const state = coerceStory(raw);
  return STORY_SCENE_IDS.filter(id => state.beats.includes(id) && !state.scenes.includes(id));
}

/** Mark a scene played (its reward's receipt). A scene whose beat is not reached cannot be played. */
export function scenePlayed(raw: StoryState, id: StorySceneId): StoryState {
  const state = coerceStory(raw);
  if (!state.beats.includes(id) || state.scenes.includes(id)) return state;
  return coerceStory({ ...state, scenes: [...state.scenes, id] });
}

/** The Codex page of accounts is open (the Furnace's scene pays it). */
export function accountsOpen(raw: StoryState): boolean {
  return coerceStory(raw).scenes.some(id => sceneById(id)?.reward.kind === 'codex');
}

/** The accounts the Codex page shows: played witness scenes only. */
export function accountsHeard(raw: StoryState): StorySceneId[] {
  const state = coerceStory(raw);
  return STORY_ACCOUNTS.filter(id => state.scenes.includes(id));
}

/** One spoken story line: what the play view hands to Glim's speech line. */
export interface StoryLine {
  beat: StoryBeatId;
  speaker: StorySpeaker;
  /** i18n key. */
  key: string;
}

export interface StoryAdvance {
  state: StoryState;
  /** Beats reached on this call, in story order. */
  reached: StoryBeatId[];
  /** Lines to say now (live only). */
  lines: StoryLine[];
  /** True when the state changed and should be saved. */
  changed: boolean;
}

/** Lines a beat speaks, in order. */
export function linesOf(beat: StoryBeat): StoryLine[] {
  return Array.from({ length: beat.lines }, (_, n) => ({ beat: beat.id, speaker: beat.speaker, key: `story.say.${beat.id}.${n + 1}` }));
}

/**
 * Move the story on with this tick's facts. `live` is false while catching up
 * (the first moments of a session): new beats are filed and the cards of any
 * boundary they cross are marked shown, but nothing speaks. Live, a crossed
 * boundary's card stays unshown (pending) until the play view shows it.
 * Never moves backwards: a beat is never removed and the chapter never drops.
 */
export function advanceStory(current: StoryState, facts: StoryFacts, live: boolean): StoryAdvance {
  const state = coerceStory(current);
  const have = new Set(state.beats);
  const reached = STORY_BEATS.filter(b => !have.has(b.id) && b.reached(facts)).map(b => b.id);
  if (!reached.length) return { state, reached, lines: [], changed: false };
  const beats = STORY_BEAT_IDS.filter(id => have.has(id) || reached.includes(id));
  const cards = new Set(state.cards);
  if (!live) for (const id of reached) { const card = STORY_BOUNDARY[id]; if (card) cards.add(card as StoryCardId); }
  const next = coerceStory({ version: 1, chapter: furtherChapter(state.chapter, chapterOf(beats)), beats, cards: [...cards], scenes: state.scenes });
  const lines = live ? reached.flatMap(id => linesOf(STORY_BEATS.find(b => b.id === id)!)) : [];
  return { state: next, reached, lines, changed: true };
}

/** The act-boundary card waiting to be shown (its boundary crossed, not yet shown), or null. */
export function pendingCard(state: StoryState): StoryCardId | null {
  for (const beat of state.beats) {
    const card = STORY_BOUNDARY[beat] as StoryCardId | undefined;
    if (card && !state.cards.includes(card)) return card;
  }
  return null;
}

/** Mark a card shown. */
export function cardShown(state: StoryState, card: StoryCardId): StoryState {
  return state.cards.includes(card) ? state : coerceStory({ ...state, cards: [...state.cards, card] });
}

/** Paragraphs on each card (i18n `story.card.<id>.p<n>`), its kicker and title. */
export const STORY_CARD_PARAGRAPHS: Readonly<Record<StoryCardId, number>> = { act1: 3, act2: 3, act3: 3 };

/**
 * The Story tab's "next lead": the first beat of the current chapter not yet
 * reached (i18n `story.lead.<beat>`), or the chapter's own lead when every beat
 * in it is found (Act II's: Kael is waiting for five witnesses).
 */
export function nextLead(state: StoryState): string {
  const have = new Set(state.beats);
  const open = STORY_BEATS.find(b => b.chapter === state.chapter && !have.has(b.id));
  return open ? `story.lead.${open.id}` : `story.lead.chapter.${state.chapter}`;
}

export interface JournalBeat {
  id: StoryBeatId;
  /** i18n keys. */
  title: string;
  text: string;
  /** Its scene: 'new' (not played yet), 'played', or null (a beat without one). */
  scene: 'new' | 'played' | null;
}

export interface JournalChapter {
  id: StoryChapterId;
  title: string;
  /** The chapter's opening words (the card that opened it, or the Prologue card). */
  intro: string[];
  /** Only the beats found. */
  beats: JournalBeat[];
  found: number;
  /** Beats this chapter has (0 for a chapter still to be written). */
  total: number;
  current: boolean;
}

export interface JournalView {
  chapter: StoryChapterId;
  /** i18n key of the chapter title on top. */
  title: string;
  lead: string;
  /** Reached chapters only, newest first. */
  chapters: JournalChapter[];
}

/** The Story tab. Only reached chapters, only found beats: an unreached beat leaves no trace but a count. */
export function journalView(raw: StoryState): JournalView {
  const state = coerceStory(raw);
  const have = new Set(state.beats);
  const upTo = STORY_CHAPTERS.indexOf(state.chapter);
  const chapters = STORY_CHAPTERS.slice(0, upTo + 1).map((id): JournalChapter => {
    const all = STORY_BEATS.filter(b => b.chapter === id);
    const found = all.filter(b => have.has(b.id));
    const intro = id === 'prologue'
      ? ['story.card.prologue.p1']
      : Array.from({ length: STORY_CARD_PARAGRAPHS[id as StoryCardId] }, (_, n) => `story.card.${id}.p${n + 1}`);
    return {
      id, title: `story.chapter.${id}`, intro,
      beats: found.map(b => ({
        id: b.id, title: `story.beat.${b.id}.title`, text: `story.beat.${b.id}.text`,
        scene: sceneById(b.id) ? (state.scenes.includes(b.id as StorySceneId) ? 'played' as const : 'new' as const) : null,
      })),
      found: found.length, total: all.length, current: id === state.chapter,
    };
  }).reverse();
  return { chapter: state.chapter, title: `story.chapter.${state.chapter}`, lead: nextLead(state), chapters };
}

/** Every beat's chapter, for tests and the handoff. */
export { STORY_BEAT_CHAPTER };
