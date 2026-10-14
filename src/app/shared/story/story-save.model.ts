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

export const STORY_CHAPTERS = ['prologue', 'act1', 'act2'] as const;
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
};
export const STORY_CARD_IDS = ['act1', 'act2'] as const;
export type StoryCardId = (typeof STORY_CARD_IDS)[number];

export interface StoryState {
  version: 1;
  chapter: StoryChapterId;
  beats: StoryBeatId[];
  cards: StoryCardId[];
}

export function emptyStory(): StoryState {
  return { version: 1, chapter: 'prologue', beats: [], cards: [] };
}

const isBeat = (id: unknown): id is StoryBeatId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(STORY_BEAT_CHAPTER, id);
const isCard = (id: unknown): id is StoryCardId => typeof id === 'string' && (STORY_CARD_IDS as readonly string[]).includes(id);
const rank = (c: StoryChapterId) => STORY_CHAPTERS.indexOf(c);

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
  const stored = typeof r.chapter === 'string' && (STORY_CHAPTERS as readonly string[]).includes(r.chapter) ? r.chapter as StoryChapterId : 'prologue';
  return { version: 1, chapter: furtherChapter(stored, chapterOf(beats)), beats, cards };
}

/** Two devices' story into one: the union of beats and cards, the further chapter. */
export function mergeStory(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceStory(remote), l = coerceStory(local);
  return coerceStory({
    version: 1,
    chapter: furtherChapter(r.chapter, l.chapter),
    beats: [...l.beats, ...r.beats],
    cards: [...l.cards, ...r.cards],
  }) satisfies StoryState;
}
