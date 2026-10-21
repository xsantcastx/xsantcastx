/**
 * story-save.model.ts — how far the Keeper's story has come.
 *
 * The main story (docs/world/world-and-cast.md §2) is the Prologue "The Fresh
 * Mark", Act I "The Old Seam" and, after the act break, Act II "Five
 * Witnesses". The record keeps ids only; every word of the story is static
 * data (story.ts, story.i18n.ts), the Bible's contract:
 *
 *   beats    the story moments this Keeper has reached (ids, sorted)
 *   cards    the act-boundary story cards already shown (ids, sorted)
 *   chapter  the furthest chapter reached
 *   scenes   the Act II scenes played, i.e. whose reward was paid (ids, sorted)
 *   tut      the top-down prologue's steps a save cannot show by itself (walked, opened the
 *            Spellbook, opened the Satchel): play/td/td-prologue.ts; per character, like the rest
 *   skip     the prologue was skipped on this character (an experienced player)
 *
 * Saved through the gateway as `godforge-story` (synced: progress/story).
 * Beats are monotonic (a moment, once lived, cannot be un-lived), so two
 * devices merge by the union of beats and cards and the further chapter; the
 * merge is commutative and idempotent.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge. Ids are
 * saved in players' blobs, so never rename one; add new ids instead.
 */
export const STORY_KEY = 'godforge-story';

export const STORY_CHAPTERS = ['prologue', 'act1', 'act2', 'act3'] as const;
export type StoryChapterId = (typeof STORY_CHAPTERS)[number];

/** Every beat, in the order the story tells them, with the chapter it belongs to. */
export const STORY_BEAT_CHAPTER = {
  // Prologue — The Fresh Mark (the four first goals, then the first carving read).
  'p.arrival': 'prologue',
  'p.homestead': 'prologue',
  'p.edge': 'prologue',
  'p.maw': 'prologue',
  'p.dig': 'prologue',
  'p.words': 'prologue',
  // Act I — The Old Seam (the Delve missions, the two tally carvings, the Seam Eater, the break).
  'a1.shadow': 'act1',
  'a1.tally': 'act1',
  'a1.hammer': 'act1',
  'a1.prices': 'act1',
  'a1.eater': 'act1',
  'a1.fresh': 'act1',
  'a1.dated': 'act1',
  'a1.break': 'act1',
  // Act II — Five Witnesses. The Four Who Went Down (Phase 8, the Underhearth): Kael's own record,
  // walked while the witnesses are gathered (lore-addendum.md, shipped).
  'a2.under': 'act2',
  'a2.marks': 'act2',
  'a2.furnace': 'act2',
  // Act II — Five Witnesses: the four realm Delves behind the Rift Gates, each one realm's account
  // (its guardian ended, its chain closed), the Archivist's Lost Cabinets, and the light coming up
  // (docs/handoff/story-act-2.md; lore-addendum.md "Story Act II", shipped).
  'a2.ink': 'act2',
  'a2.root': 'act2',
  'a2.prism': 'act2',
  'a2.orrery': 'act2',
  'a2.cabinets': 'act2',
  'a2.lamp': 'act2',
} as const satisfies Record<string, StoryChapterId>;
export type StoryBeatId = keyof typeof STORY_BEAT_CHAPTER;
export const STORY_BEAT_IDS = Object.keys(STORY_BEAT_CHAPTER) as StoryBeatId[];

/**
 * The beats that close a chapter and open the next: the last Prologue beat
 * opens Act I, the act break opens Act II. Each has the story card shown at
 * that boundary (same id as the chapter it opens).
 */
export const STORY_BOUNDARY: Readonly<Partial<Record<StoryBeatId, StoryChapterId>>> = {
  'p.words': 'act1',
  'a1.break': 'act2',
  'a2.lamp': 'act3',
};
export const STORY_CARD_IDS = ['act1', 'act2', 'act3'] as const;
export type StoryCardId = (typeof STORY_CARD_IDS)[number];

/**
 * The beats that play a scene (Act II): a few lines from the people in it,
 * Glim's line, and one reward. A scene id is its beat id. `scenes` in the
 * record lists the scenes played: the receipt for the reward, written before
 * anything is granted (story.service.ts playScene).
 */
export const STORY_SCENE_IDS = ['a2.furnace', 'a2.ink', 'a2.root', 'a2.prism', 'a2.orrery', 'a2.cabinets', 'a2.lamp'] as const satisfies readonly StoryBeatId[];
export type StorySceneId = (typeof STORY_SCENE_IDS)[number];

export interface StoryState {
  version: 1;
  chapter: StoryChapterId;
  beats: StoryBeatId[];
  cards: StoryCardId[];
  /** Scenes played (their rewards paid). Absent in records from before Act II's scenes. */
  scenes: StorySceneId[];
  /** The prologue's filed steps (td-prologue PROLOGUE_FILED ids). Absent before the top-down prologue. */
  tut?: string[];
  /** The prologue was skipped. Absent (false) before the top-down prologue. */
  skip?: boolean;
}

export function emptyStory(): StoryState {
  return { version: 1, chapter: 'prologue', beats: [], cards: [], scenes: [] };
}

const isBeat = (id: unknown): id is StoryBeatId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(STORY_BEAT_CHAPTER, id);
const isCard = (id: unknown): id is StoryCardId => typeof id === 'string' && (STORY_CARD_IDS as readonly string[]).includes(id);
const isScene = (id: unknown): id is StorySceneId => typeof id === 'string' && (STORY_SCENE_IDS as readonly string[]).includes(id);
const rank = (c: StoryChapterId) => STORY_CHAPTERS.indexOf(c);
/** The prologue steps a record may file (play/td/td-prologue.ts PROLOGUE_FILED; no import: this file stays eager-safe). */
export const STORY_TUT_IDS = ['walk', 'book', 'bag'] as const;
const isTut = (id: unknown): id is string => typeof id === 'string' && (STORY_TUT_IDS as readonly string[]).includes(id);

/** The furthest of two chapters. */
export function furtherChapter(a: StoryChapterId, b: StoryChapterId): StoryChapterId {
  return rank(a) >= rank(b) ? a : b;
}

/** The chapter a set of beats has reached: the boundaries crossed, or the beats' own chapter. */
export function chapterOf(beats: readonly StoryBeatId[]): StoryChapterId {
  let out: StoryChapterId = 'prologue';
  for (const beat of beats) {
    out = furtherChapter(out, STORY_BEAT_CHAPTER[beat]);
    const opens = STORY_BOUNDARY[beat];
    if (opens) out = furtherChapter(out, opens);
  }
  return out;
}

function ids<T extends string>(raw: unknown, ok: (id: unknown) => id is T, order: readonly string[]): T[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(ok))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Anything to a valid state: unknown ids are dropped, the chapter is never behind its beats. */
export function coerceStory(raw: unknown): StoryState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyStory();
  const r = raw as Partial<Record<keyof StoryState, unknown>>;
  const beats = ids(r.beats, isBeat, STORY_BEAT_IDS);
  const cards = ids(r.cards, isCard, STORY_CARD_IDS);
  // A scene is only ever played for a beat reached; a stray id cannot pay a reward the story never offered.
  const scenes = ids(r.scenes, isScene, STORY_SCENE_IDS).filter(id => beats.includes(id));
  const stored = typeof r.chapter === 'string' && (STORY_CHAPTERS as readonly string[]).includes(r.chapter) ? r.chapter as StoryChapterId : 'prologue';
  const out: StoryState = { version: 1, chapter: furtherChapter(stored, chapterOf(beats)), beats, cards, scenes };
  // The prologue's own marks ride along only when present, so a record from before them reads back unchanged.
  const tut = ids(r.tut, isTut, STORY_TUT_IDS);
  if (tut.length) out.tut = tut;
  if (r.skip === true) out.skip = true;
  return out;
}

/** Two devices' story into one: the union of beats, cards and played scenes, the further chapter. */
export function mergeStory(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceStory(remote), l = coerceStory(local);
  return coerceStory({
    version: 1,
    chapter: furtherChapter(r.chapter, l.chapter),
    beats: [...l.beats, ...r.beats],
    cards: [...l.cards, ...r.cards],
    scenes: [...l.scenes, ...r.scenes],
    tut: [...(l.tut ?? []), ...(r.tut ?? [])],
    skip: !!(l.skip || r.skip),
  }) satisfies StoryState;
}
