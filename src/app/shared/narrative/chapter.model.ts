/**
 * chapter.model.ts — C8 Infernal resolution record.
 *
 * One historical position per chapter. Never unions two choices.
 * Standing, Witness Rune inventory grants, and later chapters stay out.
 */
import type { HlcRevision } from '../activity/activity.model';

export const CHAPTER_KEY = 'godforge-chapter';
export const CHAPTER_SCHEMA_VERSION = 1 as const;

export type InfernalSeamChoice = 'central' | 'distributed';

export interface InfernalChapterRecord {
  chapterId: 'infernal';
  choiceId: InfernalSeamChoice;
  completedAt: string;
  revision: HlcRevision;
}

export interface ChapterLedger {
  version: 1;
  infernal: InfernalChapterRecord | null;
}

export const BASALT_SEAMWORKS_HREF = '/world/realms/infernal/basalt-seamworks';

export function emptyChapterLedger(): ChapterLedger {
  return { version: CHAPTER_SCHEMA_VERSION, infernal: null };
}
