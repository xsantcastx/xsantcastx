/**
 * tool-mastery.service.ts — how many times this visitor has opened each tool.
 *
 * XpService already knows *whether* a tool has been used (`toolsUsed`), because
 * that is all the XP economy needs: a tool pays out once. The Codex Bestiary
 * needs the other number — how often — so this keeps a separate tally.
 *
 * Deliberately not folded into ProgressState: that blob is the XP ledger and is
 * written on every award, while this is written on every tool navigation. Two
 * keys means a corrupted usage map can never cost someone their rank.
 *
 * Counts are local-only. The Firestore `tool-usage` collection is the *global*
 * popularity counter (ToolUsageService) and answers a different question.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

export const TOOL_USAGE_KEY = 'tool-usage-counts';

/** The five rungs of the mastery ladder, lowest first. */
export type MasteryLevel = 'untouched' | 'novice' | 'adept' | 'expert' | 'master';

export interface MasteryDefinition {
  id: MasteryLevel;
  label: string;
  /** Minimum uses to hold this level. */
  min: number;
  /** Uses at which the next level begins, or null at the top. */
  next: number | null;
  /** Filled stars out of five. */
  stars: number;
  color: string;
  glow: string;
}

export const MASTERY_LEVELS: MasteryDefinition[] = [
  { id: 'untouched', label: 'Untouched', min: 0,  next: 1,    stars: 0, color: '#5a6b78', glow: 'rgba(90, 107, 120, 0.4)' },
  { id: 'novice',    label: 'Novice',    min: 1,  next: 6,    stars: 2, color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.5)' },
  { id: 'adept',     label: 'Adept',     min: 6,  next: 21,   stars: 3, color: '#A78BFA', glow: 'rgba(139, 92, 246, 0.5)' },
  { id: 'expert',    label: 'Expert',    min: 21, next: 51,   stars: 4, color: '#a48bff', glow: 'rgba(140, 110, 255, 0.6)' },
  { id: 'master',    label: 'Master',    min: 51, next: null, stars: 5, color: '#c89868', glow: 'rgba(200, 152, 104, 0.65)' },
];

export function masteryForUses(uses: number): MasteryDefinition {
  let held = MASTERY_LEVELS[0];
  for (const def of MASTERY_LEVELS) {
    if (uses >= def.min) held = def;
    else break;
  }
  return held;
}

/**
 * 0-1 progress through the current rung. Returns 1 at Master — there is nothing
 * left to fill, and an eternally-crawling bar would read as an unreachable goal.
 */
export function masteryProgress(uses: number): number {
  const level = masteryForUses(uses);
  if (level.next === null) return 1;
  const span = level.next - level.min;
  return span > 0 ? Math.min(1, Math.max(0, (uses - level.min) / span)) : 0;
}

@Injectable({ providedIn: 'root' })
export class ToolMasteryService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private counts: Record<string, number> | null = null;

  /** All counts, keyed by tool slug. Empty on the server. */
  all(): Record<string, number> {
    return { ...this.load() };
  }

  count(toolSlug: string): number {
    return this.load()[toolSlug] ?? 0;
  }

  /** Record one use. Returns the new count (0 on the server). */
  record(toolSlug: string): number {
    if (!this.isBrowser) return 0;
    const counts = this.load();
    const next = (counts[toolSlug] ?? 0) + 1;
    counts[toolSlug] = next;
    this.persist(counts);
    return next;
  }

  /**
   * Give every tool in `slugs` a count of at least one.
   *
   * Called once with `XpService.toolsUsed`, which has been recorded since the XP
   * system shipped. Without this, everyone who used the site before the Codex
   * existed would open the Bestiary to 128 Untouched cards — technically true of
   * this counter, and obviously false to the person reading it.
   */
  backfill(slugs: readonly string[]): void {
    if (!this.isBrowser || slugs.length === 0) return;
    const counts = this.load();
    let changed = false;
    for (const slug of slugs) {
      if (!counts[slug]) {
        counts[slug] = 1;
        changed = true;
      }
    }
    if (changed) this.persist(counts);
  }

  private load(): Record<string, number> {
    if (this.counts) return this.counts;
    if (!this.isBrowser) return (this.counts = {});
    // Claimed on first hydration rather than in an `init()`, because this service
    // has none — it caches lazily on first read. That is the right moment either
    // way: registered has to mean "is holding a copy", and this is where the copy
    // starts existing. Cloud save otherwise merges a tally from another device
    // and this cache serves the pre-merge counts for the life of the tab.
    this.saves.register(TOOL_USAGE_KEY, {
      rehydrate: () => {
        this.counts = null;
        // Nothing to republish: every consumer reads through `all()`/`count()`,
        // so dropping the cache is the whole of it.
        this.load();
      },
    });
    try {
      const raw = this.store.readRaw(TOOL_USAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      // Guard the shape: a hand-edited or half-written blob should degrade to an
      // empty tally, not throw inside a template binding on every card.
      this.counts = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, number>
        : {};
    } catch {
      this.counts = {};
    }
    return this.counts;
  }

  private persist(counts: Record<string, number>): void {
    this.counts = counts;
      this.store.write(TOOL_USAGE_KEY, counts);
  }
}
