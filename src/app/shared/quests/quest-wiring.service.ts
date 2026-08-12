/**
 * quest-wiring.service.ts — turns what a visitor actually does into quest events.
 *
 * The same shape as XpWiringService, and for the same reason: the signals that
 * quests care about already exist as router events and document events, so
 * nothing needs adding to 126 tool components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT COUNTS AS "USING A TOOL"
 * ─────────────────────────────────────────────────────────────────────────────
 * There is no "output produced" signal at this layer — the tools run entirely
 * in the browser with no submit step, which is why XpWiringService pays out on
 * arrival. Quests cannot do that: "forge three shadows" has to mean three
 * pieces of work, and arriving three times is not work.
 *
 * So a *use beat* is an interaction inside the page body on a tool route —
 * typing, dragging a slider, pressing a button — coalesced to at most one per
 * six seconds per tool. Landing on the page and reading it emits nothing.
 *
 * The coalescing window is what makes the counts mean something. Without it a
 * slider drag would be four hundred shadows; with it, a burst of work is one
 * beat and a genuine second attempt is a second beat.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { QuestService } from './quest.service';
import { dayKey } from './quest.model';
import { TOOLS_REGISTRY, ToolDefinition } from '../../tools/tools-registry';
import { realmForCategory } from '../realms/realm.model';
import { LoreService } from '../lore/lore.service';

/** One interaction beat per tool per this many ms. */
const BEAT_COOLDOWN_MS = 6_000;
/** One copy counted per this many ms, so holding Cmd+C is not a quest faucet. */
const COPY_COOLDOWN_MS = 3_000;
/** Time-on-site ticks once a minute, and only while the tab is visible. */
const MINUTE_MS = 60_000;

/** Elements whose activation reads as "the visitor did something with the tool". */
const INTERACTIVE = 'input, textarea, select, button, [role="button"], [contenteditable="true"]';

/**
 * Furniture that sits inside `<main>` on a tool page but is not the tool.
 *
 * Without this, opening the lore panel counts as using the tool it describes —
 * which was caught the first time the codex was opened at nine uses and
 * immediately unlocked the chapter gated at ten. The same applies to the
 * related-tools rail, the newsletter box, the ad units and the share buttons:
 * they are all buttons, they are all inside `<main>`, and none of them are the
 * visitor doing the work the quest is asking about.
 */
const NOT_THE_TOOL = [
  'app-tool-lore',
  'app-related-tools',
  'app-newsletter-capture',
  'app-affiliate-cta',
  'app-sponsor-slot',
  'app-carbon-ad',
  'app-embed-code-generator',
  'app-tool-usage-counter',
  // Share links are anchors, which INTERACTIVE does not match today — this is
  // here so that stays true if one is ever rebuilt as a button.
  '.share-btn',
].join(', ');

@Injectable({ providedIn: 'root' })
export class QuestWiringService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly quests = inject(QuestService);
  private readonly lore = inject(LoreService);

  private started = false;

  /** The tool page currently open, or null everywhere else. */
  private currentTool: ToolDefinition | null = null;
  /** tool id → last beat timestamp. */
  private readonly lastBeat = new Map<string, number>();
  private lastCopyAt = 0;

  /**
   * Recent distinct beats, for the speed-run condition. In memory only — a
   * five-minute sprint that spans a reload is not a sprint anyone watched.
   */
  private recent: Array<{ tool: string; at: number }> = [];
  /** Speed-run targets already banked today, so one sprint pays once… */
  private speedBanked = new Set<string>();
  /** …and the day it was banked on, so a tab open past midnight can sprint again. */
  private speedBankedOn = '';

  private minuteTimer: ReturnType<typeof setInterval> | null = null;

  private readonly beat$$ = new Subject<ToolDefinition>();
  /**
   * One event per use beat, carrying the tool it happened on.
   *
   * Published so the Godforge economy can pay Gold for tool work without
   * building a second interaction listener with its own idea of what counts.
   * The cooldown, the `<main>` check and the furniture exclusions above are
   * exactly the rules the economy wants, and there is no version of this where
   * the two lists are maintained separately and stay in agreement.
   *
   * Not replayed: a beat is a moment, and a late subscriber missed it.
   */
  readonly beat$: Observable<ToolDefinition> = this.beat$$.asObservable();

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.quests.init();
    this.lore.init();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.onNavigate(e.urlAfterRedirects));
    // The first navigation has usually already fired by the time AppComponent
    // calls init(), so settle the landing route explicitly.
    this.onNavigate(this.router.url);

    // None of these listeners touch template-bound state directly — they call
    // into QuestService, which re-enters the zone through its own subscribers —
    // so keep them out of the zone and off the change-detection path entirely.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('input', e => this.onInteract(e), { capture: true, passive: true });
      document.addEventListener('click', e => this.onInteract(e), { capture: true, passive: true });
      document.addEventListener('copy', () => this.onCopy(), { passive: true });

      this.minuteTimer = setInterval(() => this.onMinute(), MINUTE_MS);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private onNavigate(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    if (path.startsWith('/embed/')) {
      this.currentTool = null;
      return;
    }

    // The router reports '/' before the redirect resolves and '/home' after, so
    // without this a single landing looks like two different places.
    const normalised = path === '/' || path === '' ? '/home' : path;
    this.quests.addToSet('pages', normalised);

    this.currentTool = TOOLS_REGISTRY.find(t => t.route === normalised) ?? null;
  }

  /**
   * An interaction inside the page body. Ignored off a tool route, ignored
   * outside `<main>` (so the header, footer and quest drawer never count as
   * forging), ignored on the furniture under the tool, and ignored inside the
   * cooldown.
   */
  private onInteract(event: Event): void {
    const tool = this.currentTool;
    if (!tool) return;

    const target = event.target as HTMLElement | null;
    if (!target?.closest) return;
    if (!target.closest('main')) return;
    if (!target.closest(INTERACTIVE)) return;
    if (target.closest(NOT_THE_TOOL)) return;

    const now = Date.now();
    const last = this.lastBeat.get(tool.id) ?? 0;
    if (now - last < BEAT_COOLDOWN_MS) return;
    this.lastBeat.set(tool.id, now);

    this.zone.run(() => this.recordUse(tool, now));
  }

  /** Fan one beat out across every bucket a quest could be reading. */
  private recordUse(tool: ToolDefinition, now: number): void {
    const realm = realmForCategory(tool.category);
    const window = this.windowFor(new Date(now));

    // Same beat, second ledger. The codex counts uses of the ten tools that
    // have lore; it ignores the other hundred and sixteen.
    this.lore.recordUse(tool.id);

    // Tallies — "use this tool N times".
    this.quests.tally(`use:${tool.id}`);
    this.quests.tally(`use:cat:${tool.category}`);
    this.quests.tally(`use:realm:${realm.id}`);
    this.quests.tally('use:*');
    if (window) {
      this.quests.tally(`use:*|${window}`);
      this.quests.tally(`use:${tool.id}|${window}`);
    }

    // Sets — "use N *different* tools".
    this.quests.addToSet('var:*', tool.id);
    this.quests.addToSet(`var:cat:${tool.category}`, tool.id);
    this.quests.addToSet(`var:realm:${realm.id}`, tool.id);
    this.quests.addToSet('realms', realm.id);

    this.checkSpeedRun(tool.id, now);

    // Announced last, after every ledger this service owns has been written —
    // a subscriber that throws must not be able to cost the visitor their
    // quest progress.
    this.beat$$.next(tool);
  }

  /**
   * Speed-run: three distinct tools inside five minutes.
   *
   * Checked against the authored targets rather than a hardcoded 3×5 so that
   * changing the quest in quest.model.ts changes the check too.
   */
  private checkSpeedRun(toolId: string, now: number): void {
    const today = dayKey(new Date(now));
    if (this.speedBankedOn !== today) {
      this.speedBankedOn = today;
      this.speedBanked = new Set();
    }

    this.recent = this.recent.filter(r => r.tool !== toolId);
    this.recent.push({ tool: toolId, at: now });

    for (const quest of this.quests.board.daily) {
      const c = quest.condition;
      if (c.type !== 'speed-run') continue;

      const key = `speed:${c.count}x${c.withinMinutes ?? 5}`;
      if (this.speedBanked.has(key)) continue;

      const cutoff = now - (c.withinMinutes ?? 5) * MINUTE_MS;
      const distinct = new Set(this.recent.filter(r => r.at >= cutoff).map(r => r.tool));
      if (distinct.size >= c.count) {
        this.speedBanked.add(key);
        this.quests.tally(key);
      }
    }

    // Keep the window bounded regardless of which quests are on the board.
    const oldest = now - 30 * MINUTE_MS;
    this.recent = this.recent.filter(r => r.at >= oldest);
  }

  private onCopy(): void {
    const now = Date.now();
    if (now - this.lastCopyAt < COPY_COOLDOWN_MS) return;
    this.lastCopyAt = now;
    this.zone.run(() => this.quests.tally('copy'));
  }

  /** One minute of *visible* time. A backgrounded tab is not a vigil. */
  private onMinute(): void {
    if (document.visibilityState !== 'visible') return;
    this.zone.run(() => this.quests.tally('minutes'));
  }

  /** Which slice of the day it is locally, or null in ordinary working hours. */
  private windowFor(d: Date): 'night' | 'dawn' | null {
    const h = d.getHours();
    if (h >= 22 || h < 4) return 'night';
    if (h >= 4 && h < 7) return 'dawn';
    return null;
  }
}
