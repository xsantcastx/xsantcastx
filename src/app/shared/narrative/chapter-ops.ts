/**
 * chapter-ops.ts — parse and merge Infernal chapter resolutions.
 *
 * Merge never unions two choices. Highest HLC wins. Same-id records
 * stay identical. Missing/malformed sides fail closed to empty.
 */
import { compareHlc, nextHlc } from '../activity/activity-ops';
import type { HlcRevision } from '../activity/activity.model';
import {
  CHAPTER_SCHEMA_VERSION,
  emptyChapterLedger,
  type ChapterLedger,
  type InfernalChapterRecord,
  type InfernalSeamChoice,
} from './chapter.model';

export function parseInfernalChoice(value: unknown): InfernalSeamChoice | null {
  return value === 'central' || value === 'distributed' ? value : null;
}

export function parseInfernalRecord(raw: unknown): InfernalChapterRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const choiceId = parseInfernalChoice(row['choiceId']);
  if (row['chapterId'] !== 'infernal' || !choiceId) return null;
  if (typeof row['completedAt'] !== 'string' || !row['completedAt']) return null;
  const revision = parseHlc(row['revision']);
  if (!revision) return null;
  return { chapterId: 'infernal', choiceId, completedAt: row['completedAt'], revision };
}

export function coerceChapterLedger(raw: unknown): ChapterLedger | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row['version'] !== CHAPTER_SCHEMA_VERSION) return null;
  const infernal = row['infernal'] == null ? null : parseInfernalRecord(row['infernal']);
  if (row['infernal'] != null && !infernal) return null;
  return { version: CHAPTER_SCHEMA_VERSION, infernal };
}

export function mergeChapterLedgers(remote: unknown, local: unknown): ChapterLedger {
  const a = coerceChapterLedger(remote) ?? emptyChapterLedger();
  const b = coerceChapterLedger(local) ?? emptyChapterLedger();
  return { version: CHAPTER_SCHEMA_VERSION, infernal: pickInfernal(a.infernal, b.infernal) };
}

export function pickInfernal(
  a: InfernalChapterRecord | null,
  b: InfernalChapterRecord | null,
): InfernalChapterRecord | null {
  if (!a) return b;
  if (!b) return a;
  return compareHlc(a.revision, b.revision) >= 0 ? a : b;
}

export function buildInfernalRecord(input: {
  choiceId: InfernalSeamChoice;
  deviceId: string;
  previous: HlcRevision | null;
  now: number;
}): InfernalChapterRecord {
  return {
    chapterId: 'infernal',
    choiceId: input.choiceId,
    completedAt: new Date(input.now).toISOString(),
    revision: nextHlc(input.previous, input.deviceId, input.now),
  };
}

function parseHlc(raw: unknown): HlcRevision | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const wallTimeMs = Number(row['wallTimeMs']);
  const logicalCounter = Number(row['logicalCounter']);
  const sequence = Number(row['sequence']);
  const deviceId = row['deviceId'];
  if (!Number.isFinite(wallTimeMs) || !Number.isFinite(logicalCounter) || !Number.isFinite(sequence)) {
    return null;
  }
  if (typeof deviceId !== 'string' || !deviceId) return null;
  return { wallTimeMs, logicalCounter, sequence, deviceId };
}
