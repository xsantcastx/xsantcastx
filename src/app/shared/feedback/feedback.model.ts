/**
 * feedback.model.ts — "Send feedback" (owner's backlog 2026-10-21): what a submission is, how long its parts may be, and
 * the client-side rate limit. The same limits are written into firestore.rules (`player-feedback`), which is the check
 * that counts; these keep an honest player from ever meeting it.
 *
 * A submission is a short note (bug / idea / other), an optional downscaled JPEG of the canvas, and the device facts that
 * make a bug findable (browser, window, version, area, class and level). It goes into Firestore as a document created by
 * the signed-in player; nobody can read it back from the client — only the owner's GM console can.
 */
export const FEEDBACK_COLLECTION = 'player-feedback';
/** One doc per player holding the time of their last submission: the rules' rate limit reads it (one a minute). */
export const FEEDBACK_LIMIT_COLLECTION = 'player-feedback-limits';

export const FEEDBACK_TYPES = ['bug', 'idea', 'other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 1000;
/** The screenshot, as a JPEG: at most this many bytes (150 KB) — base64 of it is at most the rules' 200 KB. */
export const SHOT_MAX_BYTES = 150 * 1024;
/** The base64 text the rules accept (200 KiB). */
export const SHOT_MAX_B64 = 200 * 1024;
/** The screenshot is scaled down to fit within this many pixels across. */
export const SHOT_MAX_WIDTH = 720;
/** Seconds between two submissions from one player. */
export const FEEDBACK_GAP_SECS = 60;

/** Device facts sent with the note. Each part is short and typed, so the rules can bound it. */
export interface FeedbackDevice {
  ua: string;
  viewport: string;
  version: string;
  area: string;
  vocation: string;
  level: number;
}

export interface FeedbackDraft {
  type: FeedbackType;
  message: string;
  /** Raw base64 of a JPEG, or '' for none. */
  shot: string;
  device: FeedbackDevice;
}

export interface FeedbackDoc {
  uid: string;
  type: FeedbackType;
  message: string;
  device: FeedbackDevice;
  status: 'open';
  at: unknown;
  /** Present only with a screenshot. */
  shot?: string;
}

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Why a draft cannot be sent yet, or null when it can. */
export function draftProblem(d: Pick<FeedbackDraft, 'type' | 'message' | 'shot'>): 'type' | 'short' | 'long' | 'shot' | null {
  if (!FEEDBACK_TYPES.includes(d.type)) return 'type';
  const n = d.message.trim().length;
  if (n < FEEDBACK_MIN) return 'short';
  if (n > FEEDBACK_MAX) return 'long';
  if (d.shot.length > SHOT_MAX_B64) return 'shot';
  return null;
}

/** The device facts, each bounded the way the rules bound it. */
export function cleanDevice(d: Partial<FeedbackDevice>): FeedbackDevice {
  return {
    ua: clip(d.ua, 300), viewport: clip(d.viewport, 40), version: clip(d.version, 20), area: clip(d.area, 60), vocation: clip(d.vocation, 20),
    level: Math.max(0, Math.min(999, Math.floor(Number(d.level) || 0))),
  };
}

/** The document to create. `at` is the server's time (the rules require exactly it). */
export function buildFeedbackDoc(uid: string, d: FeedbackDraft, at: unknown): FeedbackDoc {
  return {
    uid, type: d.type, message: d.message.trim(), device: cleanDevice(d.device), status: 'open', at,
    ...(d.shot ? { shot: d.shot } : {}),
  };
}

/** Seconds a player must still wait before sending again, from the time they last sent (0 when free). */
export function waitSecs(lastMs: number, nowMs: number): number {
  if (!Number.isFinite(lastMs) || lastMs <= 0) return 0;
  return Math.max(0, Math.ceil((lastMs + FEEDBACK_GAP_SECS * 1000 - nowMs) / 1000));
}

/** Base64 length of `bytes` bytes. */
export const b64Length = (bytes: number): number => 4 * Math.ceil(bytes / 3);

/**
 * Pick a JPEG quality / width pair that fits the byte budget: tries each step down until `encode` returns a data URL
 * whose bytes fit, else null. `encode(width, quality)` is the canvas's, injected so the ladder can be specced.
 */
export function fitShot(encode: (width: number, quality: number) => string, startWidth = SHOT_MAX_WIDTH): string | null {
  for (const [scale, q] of [[1, .72], [1, .55], [.8, .5], [.64, .45], [.5, .4]] as const) {
    const url = encode(Math.max(160, Math.round(startWidth * scale)), q);
    const b64 = url.slice(url.indexOf(',') + 1);
    if (b64 && Math.floor(b64.length * 3 / 4) <= SHOT_MAX_BYTES) return b64;
  }
  return null;
}
