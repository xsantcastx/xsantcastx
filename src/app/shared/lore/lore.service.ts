/**
 * lore.service.ts — how much of a tool's story you have earned.
 *
 * Keeps one number per tool: how many times you have used it. Chapters open at
 * thresholds against that number, so the codex is a record of attention rather
 * than a reward for clicking a button labelled "unlock".
 *
 * Its own storage key, deliberately. Lore progress could have been read out of
 * the quest ledger — the wiring layer feeds both from the same use beat — but
 * then resetting the quest board would silently erase a hundred sittings' worth
 * of reading. These are different promises and they get different keys.
 *
 * SSR: `init()` and every mutation are behind `isBrowser`; the server renders
 * chapter one and nothing else, which is exactly what an unvisited crawler
 * should index.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { LoreChapter, ToolLore, loreForTool } from './lore.model';

export const LORE_KEY = 'eclipse-lore';

interface LoreState {
  version: 1;
  /** tool slug → lifetime use count. */
  uses: Record<string, number>;
  /** Chapter ids already announced, so a toast fires once per chapter, ever. */
  announced: string[];
}

function emptyState(): LoreState {
  return { version: 1, uses: {}, announced: [] };
}

/**
 * A run of prose, flagged for emphasis.
 *
 * The chapters are authored with `*asterisks*` around the emphasised phrases,
 * and the emphasis is doing real work in the writing — "Both are correct
 * *differently*" is a different sentence without it. Rather than render the
 * asterisks literally (which looked exactly as bad as it sounds) or reach for
 * `innerHTML`, the paragraph is parsed into segments here and the template
 * wraps the emphasised ones in `<em>`. No HTML is ever constructed from a
 * string, so there is no injection surface to reason about.
 */
export interface LoreSegment {
  text: string;
  em: boolean;
}

/** A chapter plus whether this visitor may read it. */
export interface ResolvedChapter extends LoreChapter {
  unlocked: boolean;
  /** Uses still needed. 0 when unlocked. */
  remaining: number;
  /** Paragraphs, already split and parsed — templates do no string work. */
  paragraphs: LoreSegment[][];
}

/** Everything the panel on a tool page needs. */
export interface LoreProgress {
  lore: ToolLore;
  chapters: ResolvedChapter[];
  uses: number;
  discovered: number;
  total: number;
}

/** Announced when a threshold is crossed, so the page can say so. */
export interface LoreUnlock {
  toolSlug: string;
  chapter: LoreChapter;
}

@Injectable({ providedIn: 'root' })
export class LoreService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private state: LoreState = emptyState();
  private initialised = false;

  /**
   * Scales every chapter threshold. The Codex Solarii artifact sets this to
   * 0.5; with nothing installed it is 1 and no chapter moves.
   *
   * A settable function rather than an injected EconomyService, for the same
   * reason XpService takes its multiplier the same way: the codex predates the
   * shop and has to keep working with the shop deleted.
   */
  private thresholdScale: () => number = () => 1;

  private readonly changed$$ = new BehaviorSubject<number>(0);
  private readonly unlock$$ = new Subject<LoreUnlock>();

  /** Bumps whenever a count changes, so panels can re-resolve. */
  readonly changed$: Observable<number> = this.changed$$.asObservable();
  /** Fires once per chapter, the first time it opens. */
  readonly unlock$: Observable<LoreUnlock> = this.unlock$$.asObservable();

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.state = this.load();
  }

  /** Install a threshold scale. Called once by the economy's wiring layer. */
  setThresholdScale(scale: () => number): void {
    this.thresholdScale = scale;
  }

  /**
   * What a chapter actually costs this visitor.
   *
   * Never below 1, so a discount cannot open a chapter that has not been
   * reached at all — chapter one already sits at 0 and stays there, and every
   * later chapter still needs at least one use behind it. Rounded up, so the
   * halved 45 is 23 rather than 22: the artifact is generous, not arbitrary.
   */
  private thresholdFor(unlockAt: number): number {
    if (unlockAt <= 0) return 0;
    let scale = 1;
    try {
      scale = this.thresholdScale();
    } catch {
      scale = 1;
    }
    if (!Number.isFinite(scale) || scale <= 0 || scale > 1) return unlockAt;
    return Math.max(1, Math.ceil(unlockAt * scale));
  }

  /**
   * Count one use of a tool, and announce any chapter that just opened.
   *
   * Called from QuestWiringService on the same interaction beat that feeds the
   * quest board — one signal, two ledgers — so "use" means the same thing in
   * the codex as it does on the mission board.
   */
  recordUse(slug: string): void {
    if (!this.isBrowser) return;
    this.init();

    const lore = loreForTool(slug);
    // Tools with no codex entry are not tracked at all. 116 of 126 tools have
    // none, and storing a counter for each would be a kilobyte of nothing.
    if (!lore) return;

    const before = this.state.uses[slug] ?? 0;
    const after = before + 1;
    this.state.uses[slug] = after;

    const opened = lore.chapters.filter(c => {
      const at = this.thresholdFor(c.unlockAt);
      return at > before && at <= after && !this.state.announced.includes(c.id);
    });
    for (const chapter of opened) this.state.announced.push(chapter.id);

    this.persist();
    this.changed$$.next(after);

    // Announced after persisting: a toast that fires and then fails to save
    // would fire again on the next use.
    for (const chapter of opened) {
      this.unlock$$.next({ toolSlug: slug, chapter });
    }
  }

  /** Lifetime uses of a tool. */
  usesOf(slug: string): number {
    return this.state.uses[slug] ?? 0;
  }

  /** The full picture for a tool, or null when it has no codex entry. */
  progressFor(slug: string): LoreProgress | null {
    const lore = loreForTool(slug);
    if (!lore) return null;

    const uses = this.usesOf(slug);
    const chapters = lore.chapters.map<ResolvedChapter>(c => {
      // The discounted threshold, so a locked card counts down to the number
      // this visitor actually has to reach rather than the authored one.
      const at = this.thresholdFor(c.unlockAt);
      const unlocked = uses >= at;
      return {
        ...c,
        unlockAt: at,
        unlocked,
        remaining: unlocked ? 0 : at - uses,
        paragraphs: unlocked ? splitParagraphs(c.content) : [],
      };
    });

    return {
      lore,
      chapters,
      uses,
      discovered: chapters.filter(c => c.unlocked).length,
      total: chapters.length,
    };
  }

  /** Wipe the codex. Exposed for the console alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyState();
    try { localStorage.removeItem(LORE_KEY); } catch { /* private mode */ }
    this.changed$$.next(0);
  }

  private load(): LoreState {
    try {
      const raw = localStorage.getItem(LORE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<LoreState>;
      return { ...emptyState(), ...parsed, uses: parsed.uses ?? {}, announced: parsed.announced ?? [], version: 1 };
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LORE_KEY, JSON.stringify(this.state));
    } catch {
      /* quota or private mode — reading lore is not worth breaking a tool over */
    }
  }
}

/** Blank-line-separated prose into paragraphs, each parsed into segments. */
function splitParagraphs(content: string): LoreSegment[][] {
  return content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(parseEmphasis);
}

/**
 * Split a paragraph on `*emphasised*` runs.
 *
 * Deliberately not a Markdown parser — the corpus is one authored file, and the
 * only markup in it is single-asterisk emphasis. An unpaired asterisk falls
 * through as literal text rather than swallowing the rest of the paragraph.
 */
function parseEmphasis(paragraph: string): LoreSegment[] {
  const segments: LoreSegment[] = [];
  const pattern = /\*([^*\n]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(paragraph)) !== null) {
    if (match.index > last) {
      segments.push({ text: paragraph.slice(last, match.index), em: false });
    }
    segments.push({ text: match[1], em: true });
    last = match.index + match[0].length;
  }
  if (last < paragraph.length) {
    segments.push({ text: paragraph.slice(last), em: false });
  }
  return segments.length ? segments : [{ text: paragraph, em: false }];
}
