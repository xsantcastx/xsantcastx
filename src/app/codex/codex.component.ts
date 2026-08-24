/**
 * codex.component.ts — /codex, the record of everything there is to find.
 *
 * Six panels over one set of state: the achievement wall, the Collection Log,
 * the progression path, the lore scrolls, the secrets guide, and a leaderboard
 * that does not exist yet and says so.
 *
 * SSR: every list is built at construction from pure registries, so the
 * prerendered HTML is a complete, correct, fully-locked Codex — 140 real cards
 * with real tiers and real borders. `ngOnInit` runs only in the browser and its
 * whole job is flipping `unlocked` and filling in counts. That ordering is what
 * keeps the page useful to a crawler and free of a hydration flash.
 *
 * The tab is mirrored into `?tab=` so a deep link lands on the right panel,
 * using replaceState rather than a router navigation — a tab is not a page,
 * and it should not cost a back-button press to undo. `?tab=bestiary` is kept
 * alive as an alias for the Collection Log: it used to 404 into Achievements,
 * and a bestiary is what the log turned out to be.
 */
import {
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import {
  EclipseRarity,
  RARITIES,
  RARITY_ORDER,
  RarityDefinition,
  rarityOf,
} from '../shared/rarity/rarity.model';
import { RuneTier } from '../shared/rune-forge/rune.model';
import {
  LORE_CHAPTERS,
  LORE_SCROLLS,
  LoreChapterDefinition,
  LoreScroll,
  scrollsOfChapter,
} from '../shared/rune-forge/lore-scroll.model';
import { LoreScrollService } from '../shared/rune-forge/lore-scroll.service';
import { LEVELS, LevelDefinition, rankSigil } from '../shared/gamification/gamification.model';
import { XpService, XpSnapshot, localDay } from '../shared/gamification/xp.service';
import {
  CODEX_CATEGORIES,
  CodexAchievement,
  CodexCategory,
  CodexCategoryId,
  CodexSort,
  CodexStatus,
  SORT_LABELS,
  buildAchievements,
} from './codex.model';
import {
  SECRETS,
  SECRET_GROUPS,
  SecretDefinition,
  SecretGroup,
} from './codex-secrets';
import {
  CodexSecretsService,
  SECRET_SOURCE_LABEL,
  SecretRecord,
} from './codex-secrets.service';
import { CollectionLogComponent } from '../shared/collection/collection-log.component';
import { InventoryService } from '../shared/rpg/inventory.service';
import { SOCKET_WORDS, matchSocketWord, wordTier } from '../shared/enchanting/socket-words';
import { RUNE_TIERS, runeById } from '../shared/rune-forge/rune.model';

export type CodexTab = 'achievements' | 'collection' | 'progression' | 'scrolls' | 'secrets' | 'leaderboard';

interface TabDefinition {
  key: CodexTab;
  label: string;
  icon: string;
  hint: string;
}

/** A section of the wall: one category with its achievements and its counts. */
interface AchievementSection {
  category: CodexCategory;
  items: CodexAchievement[];
  found: number;
}

/** One day cell in the streak calendar. */
interface CalendarDay {
  date: string;
  label: string;
  xp: number;
  /** 0-4 heat step. 0 is an empty day. */
  heat: number;
  isToday: boolean;
}

/** A rank on the progression path. */
interface PathNode {
  level: LevelDefinition;
  state: 'held' | 'current' | 'locked';
}

/** One secret card. */
interface SecretCard {
  def: SecretDefinition;
  group: SecretGroup;
  rarity: RarityDefinition;
  found: boolean;
  at: string | null;
  how: string | null;
}

const CALENDAR_DAYS = 30;

/** Streak lengths that are worth naming as a next target. */
const STREAK_MILESTONES = [3, 7, 12, 30, 100];

/**
 * The level-1 nothing-yet snapshot.
 *
 * The component starts from this rather than from `XpService.snapshot`, even in
 * the browser: XpWiringService has already hydrated the ledger by the time a
 * routed component is constructed, so reading the live value here would render
 * a different first frame than the server did and trip Angular's hydration
 * check. Every visitor-specific value is applied after the `await` in
 * `hydrate()`, which lands in a microtask once hydration has finished.
 */
const ZERO_SNAPSHOT: XpSnapshot = {
  xp: 0,
  level: LEVELS[0],
  next: LEVELS[1] ?? null,
  progress: 0,
  toNext: LEVELS[1] ? LEVELS[1].minXp : 0,
  aether: 0,
  nox: 0,
  aetherShare: 0.5,
  streak: 0,
  bestStreak: 0,
  toolsUsed: 0,
};

/** One scroll on the wall. */
interface ScrollCard {
  scroll: LoreScroll;
  found: boolean;
  /** Found but never opened. Drives the dot. */
  unread: boolean;
  at: string | null;
  /** The tier badge, borrowed from the achievement ladder so the wall matches. */
  rarity: RarityDefinition;
  paragraphs: string[];
}

/** One chapter's shelf. */
interface ScrollShelf {
  chapter: LoreChapterDefinition;
  cards: ScrollCard[];
  found: number;
}

/**
 * A scroll's rune tier, as a rarity on the Codex's own ladder.
 *
 * The two scales exist for different reasons and neither is going away: rune
 * tiers name a drop rate, Eclipse rarities name how loud a discovery is. This
 * is the one place they have to meet, so it is stated once here rather than
 * being re-derived at three call sites that would eventually disagree.
 */
const SCROLL_TIER_TO_RARITY: Record<RuneTier, EclipseRarity> = {
  common: 'mortal',
  uncommon: 'eclipsed',
  rare: 'sacred',
  epic: 'anomalous',
  legendary: 'anomalous',
  mythic: 'mythic',
  singular: 'singular',
};

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CollectionLogComponent],
  templateUrl: './codex.component.html',
  styleUrls: ['./codex.component.css'],
})
export class CodexComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly xp = inject(XpService);
  private readonly secretsService = inject(CodexSecretsService);
  private readonly inventory = inject(InventoryService);
  private readonly scrollsService = inject(LoreScrollService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private subs: Subscription[] = [];

  /**
   * False until the post-hydration pass has run. Every derived list consults it
   * and reports the empty/locked state while it is false, which is what makes
   * the server's HTML and the browser's first frame identical by construction
   * rather than by luck.
   */
  private hydrated = false;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  readonly tabs: TabDefinition[] = [
    { key: 'achievements', label: 'Achievements', icon: '✦', hint: 'every fragment, found and unfound' },
    { key: 'collection',   label: 'Collection',   icon: '⬡', hint: 'every thing there is to hold' },
    { key: 'progression',  label: 'Progression',  icon: '◆', hint: 'rank, energy and the streak' },
    { key: 'scrolls',      label: 'Lore',         icon: '📜', hint: 'the codex, one fragment at a time' },
    { key: 'secrets',      label: 'Secrets',      icon: '✧', hint: 'the hidden content, clued not spoiled' },
    { key: 'leaderboard',  label: 'Leaderboard',  icon: '◇', hint: 'when the Eclipse aligns' },
  ];
  activeTab: CodexTab = 'achievements';

  // ── Achievements ──────────────────────────────────────────────────────────
  readonly categories = CODEX_CATEGORIES;
  readonly rarityOrder = RARITY_ORDER;
  readonly rarities = RARITIES;
  readonly sortLabels = SORT_LABELS;

  achievements: CodexAchievement[] = buildAchievements();

  categoryFilter: CodexCategoryId | 'all' = 'all';
  rarityFilter: EclipseRarity | 'all' = 'all';
  statusFilter: CodexStatus = 'all';
  sort: CodexSort = 'rarity';
  search = '';

  // ── Progression ───────────────────────────────────────────────────────────
  snap: XpSnapshot = ZERO_SNAPSHOT;
  readonly levels = LEVELS;
  /** Exposed for the rank orb and the ten path nodes. */
  readonly rankSigil = rankSigil;
  calendar: CalendarDay[] = [];

  // ── Secrets ───────────────────────────────────────────────────────────────
  readonly secretGroups = SECRET_GROUPS;
  secrets: SecretCard[] = this.buildSecrets();

  // ══ Lifecycle ═════════════════════════════════════════════════════════════

  // ── Socket Words ──────────────────────────────────────────────────────────
  /**
   * The Socket Word wall, on the Secrets tab where it belongs.
   *
   * Authored at construction so the prerendered HTML lists all fifteen in their
   * undiscovered state — frame, well count, difficulty and clue, never the
   * sequence. `hydrate` flips the ones the visitor's own gear is currently
   * spelling, which is what "discovered" means for a Socket Word: it is not an
   * achievement you keep, it is a thing your kit is saying right now.
   */
  socketWords: {
    id: string;
    name: string;
    found: boolean;
    frame: string;
    wells: string;
    tier: string;
    color: string;
    runes: string;
    effect: string;
    lore: string;
    clue: string;
  }[] = this.buildSocketWords(new Set());

  get foundWords(): number { return this.socketWords.filter(w => w.found).length; }
  get totalWords(): number { return this.socketWords.length; }

  private buildSocketWords(found: ReadonlySet<string>) {
    return SOCKET_WORDS.map(word => {
      const tier = wordTier(word);
      return {
        id: word.id,
        name: found.has(word.id) ? word.name : '???',
        found: found.has(word.id),
        frame: word.frame === 'weapon' ? 'Weapon only'
          : word.frame === 'armor' ? 'Armour only'
          : 'Any piece',
        wells: word.runes.length === 1 ? '1 well' : `${word.runes.length} wells`,
        tier: RUNE_TIERS[tier].label,
        color: RUNE_TIERS[tier].color,
        runes: word.runes.map(id => runeById(id)?.name ?? id).join(' \u00b7 '),
        effect: word.effect,
        lore: word.lore,
        clue: word.clue,
      };
    });
  }

  /** Every word seated in something the visitor owns right now. */
  private seatedWordIds(): Set<string> {
    const ids = new Set<string>();
    for (const item of this.inventory.snapshot.items) {
      const word = matchSocketWord(item);
      if (word) ids.add(word.id);
    }
    return ids;
  }

  ngOnInit(): void {
    this.readTabFromUrl();
    if (!this.isBrowser) return;
    void this.hydrate();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Fill in everything that depends on this visitor.
   *
   * Awarding The Archivist is deliberately last: it fires a drop toast and 25
   * XP, and doing that before the wall is populated would show a card unlocking
   * on a page that still reads 0/140.
   */
  private async hydrate(): Promise<void> {
    // The await matters beyond loading eggs: everything after it runs in a
    // microtask, i.e. after Angular has finished comparing this component's
    // first render against the server's HTML.
    await this.eggs.init();
    // The calendar and the snapshot below are one-shot reads of the ledger, so
    // they have to wait for storage rather than rendering an empty year.
    await this.xp.init();
    this.hydrated = true;

    this.achievements = this.achievements.map(a => ({
      ...a,
      unlocked: this.eggs.isFound(a.id),
      unlockedAt: this.eggs.foundAt(a.id),
    }));

    this.calendar = this.buildCalendar(this.xp.history);
    this.secrets = this.buildSecrets();
    this.snap = this.xp.snapshot;

    this.scrollsService.init();
    this.scrollShelves = this.buildScrolls();

    // The bag has to be hydrated before the wall can be read off it, and
    // `init()` is idempotent — every other consumer calls it the same way.
    this.inventory.init();
    this.socketWords = this.buildSocketWords(this.seatedWordIds());
    this.subs.push(this.inventory.snapshot$.subscribe(() => {
      this.socketWords = this.buildSocketWords(this.seatedWordIds());
    }));

    this.subs.push(this.xp.snapshot$.subscribe(s => (this.snap = s)));
    this.subs.push(this.secretsService.changed$.subscribe(() => (this.secrets = this.buildSecrets())));
    // `changed$` is a BehaviorSubject, so this also covers the case where a
    // scroll was granted before this page was ever opened — which is the normal
    // case, since scrolls are found at the anvil and read here.
    this.subs.push(this.scrollsService.changed$.subscribe(() => (this.scrollShelves = this.buildScrolls())));

    // The page itself is an achievement. Triggering unconditionally is safe —
    // EasterEggService only pays out and only toasts on the first discovery.
    // Last, so the card is already on the wall when the drop points at it.
    void this.eggs.trigger('codex-archivist');
    this.achievements = this.achievements.map(a =>
      a.id === 'codex-archivist' && !a.unlocked
        ? { ...a, unlocked: true, unlockedAt: this.eggs.foundAt(a.id) }
        : a);
  }

  // ══ Tabs ══════════════════════════════════════════════════════════════════

  selectTab(tab: CodexTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (!this.isBrowser) return;
    // replaceState, not navigate: a tab is a view of one page, and it should not
    // cost a back-button press to undo.
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
    history.replaceState(history.state, '', this.router.serializeUrl(tree));
  }

  private readTabFromUrl(): void {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    if (!requested) return;
    // `?tab=bestiary` was a real link before the tab it named was withdrawn.
    // The Collection Log is what that tab became, so the alias resolves rather
    // than silently landing on Achievements.
    const key = requested === 'bestiary' ? 'collection' : requested;
    if (this.tabs.some(t => t.key === key)) {
      this.activeTab = key as CodexTab;
    }
  }

  // ══ Achievements ══════════════════════════════════════════════════════════

  get totalAchievements(): number { return this.achievements.length; }

  get foundAchievements(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  get achievementPercent(): number {
    return this.totalAchievements > 0
      ? (this.foundAchievements / this.totalAchievements) * 100
      : 0;
  }

  /** Total XP banked from discoveries, for the wall header. */
  get earnedXp(): number {
    return this.achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.xp, 0);
  }

  /**
   * Colour of the completion bar: the mean tier of what has been found, rounded
   * down to a real rung. An empty wall reads Mortal rather than colourless,
   * which is the honest starting position rather than a null state.
   */
  get progressRarity(): RarityDefinition {
    const found = this.achievements.filter(a => a.unlocked);
    if (found.length === 0) return RARITIES.mortal;
    const mean = found.reduce((sum, a) => sum + a.rarity.weight, 0) / found.length;
    return RARITIES[RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, Math.floor(mean))]];
  }

  /** The rarest thing on the wall that has actually been found. */
  get rarestFound(): CodexAchievement | null {
    return this.achievements
      .filter(a => a.unlocked)
      .reduce<CodexAchievement | null>(
        (best, a) => (!best || a.rarity.weight > best.rarity.weight ? a : best),
        null
      );
  }

  /** How many of each tier exist, and how many are found. Drives the rarity chips. */
  tierCount(tier: EclipseRarity): { found: number; total: number } {
    const of = this.achievements.filter(a => a.tier === tier);
    return { found: of.filter(a => a.unlocked).length, total: of.length };
  }

  categoryCount(id: CodexCategoryId): { found: number; total: number } {
    const of = this.achievements.filter(a => a.category.id === id);
    return { found: of.filter(a => a.unlocked).length, total: of.length };
  }

  private matchesFilters(a: CodexAchievement): boolean {
    if (this.categoryFilter !== 'all' && a.category.id !== this.categoryFilter) return false;
    if (this.rarityFilter !== 'all' && a.tier !== this.rarityFilter) return false;
    if (this.statusFilter === 'locked' && a.unlocked) return false;
    if (this.statusFilter === 'unlocked' && !a.unlocked) return false;

    const q = this.search.trim().toLowerCase();
    if (!q) return true;
    // A locked card shows "???" and its hint, so searching its real name would
    // let the search box spoil the wall. Locked cards match on hint text only.
    return a.unlocked
      ? `${a.name} ${a.description} ${a.toolTitle ?? ''}`.toLowerCase().includes(q)
      : a.hint.toLowerCase().includes(q);
  }

  private sorted(items: CodexAchievement[]): CodexAchievement[] {
    const by = [...items];
    switch (this.sort) {
      case 'rarity':
        // Rarest first, then found-before-locked so the trophies lead.
        return by.sort((a, b) =>
          b.rarity.weight - a.rarity.weight ||
          Number(b.unlocked) - Number(a.unlocked) ||
          a.name.localeCompare(b.name));
      case 'recent':
        // Undated finds (from before dates were recorded) sort after dated ones
        // but ahead of everything still locked — they were found, just not timed.
        return by.sort((a, b) => {
          if (a.unlocked !== b.unlocked) return Number(b.unlocked) - Number(a.unlocked);
          if (a.unlockedAt && b.unlockedAt) return b.unlockedAt.localeCompare(a.unlockedAt);
          if (a.unlockedAt) return -1;
          if (b.unlockedAt) return 1;
          return a.name.localeCompare(b.name);
        });
      case 'alpha':
        return by.sort((a, b) => a.name.localeCompare(b.name));
      case 'category':
        return by.sort((a, b) =>
          this.categories.findIndex(c => c.id === a.category.id) -
          this.categories.findIndex(c => c.id === b.category.id) ||
          b.rarity.weight - a.rarity.weight ||
          a.name.localeCompare(b.name));
    }
  }

  /**
   * The wall, grouped into sections. Sorting by category collapses to one
   * section per category; every other sort renders a single flat section, since
   * grouping and sorting by different keys would produce sections whose internal
   * order contradicts their headings.
   */
  get sections(): AchievementSection[] {
    const visible = this.sorted(this.achievements.filter(a => this.matchesFilters(a)));

    if (this.sort !== 'category') {
      if (visible.length === 0) return [];
      return [{
        category: {
          id: 'global',
          label: this.filterSummary,
          icon: '✦',
          color: '#A78BFA',
          glow: 'rgba(139, 92, 246, 0.6)',
          blurb: '',
        },
        items: visible,
        found: visible.filter(a => a.unlocked).length,
      }];
    }

    return this.categories
      .map(category => {
        const items = visible.filter(a => a.category.id === category.id);
        return { category, items, found: items.filter(a => a.unlocked).length };
      })
      .filter(section => section.items.length > 0);
  }

  /** Heading for the flat (non-category) view — says what is being shown. */
  get filterSummary(): string {
    const bits: string[] = [];
    if (this.rarityFilter !== 'all') bits.push(RARITIES[this.rarityFilter].label);
    if (this.categoryFilter !== 'all') {
      bits.push(this.categories.find(c => c.id === this.categoryFilter)?.label ?? '');
    }
    if (this.statusFilter !== 'all') bits.push(this.statusFilter === 'locked' ? 'Undiscovered' : 'Discovered');
    return bits.length ? bits.join(' · ') : 'All Fragments';
  }

  get hasActiveFilters(): boolean {
    return this.categoryFilter !== 'all'
      || this.rarityFilter !== 'all'
      || this.statusFilter !== 'all'
      || this.search.trim().length > 0;
  }

  clearFilters(): void {
    this.categoryFilter = 'all';
    this.rarityFilter = 'all';
    this.statusFilter = 'all';
    this.search = '';
  }

  /** Jump to a category from anywhere — used by the section headers. */
  focusCategory(id: CodexCategoryId): void {
    this.categoryFilter = this.categoryFilter === id ? 'all' : id;
  }

  // ── Lore Scrolls ──────────────────────────────────────────────────────────

  /**
   * The scroll wall, one shelf per chapter.
   *
   * Built from the registry rather than from what has been found, so the server
   * renders all five chapters with all twenty-five fragments sealed and the
   * layout does not move when the ledger arrives — same contract every other
   * builder on this page keeps via `hydrated`.
   */
  private buildScrolls(): ScrollShelf[] {
    return LORE_CHAPTERS.map(chapter => {
      const cards: ScrollCard[] = scrollsOfChapter(chapter.id).map(scroll => {
        const found = this.hydrated && this.scrollsService.isFound(scroll.id);
        return {
          scroll,
          found,
          unread: found && !this.scrollsService.isRead(scroll.id),
          at: found ? this.scrollsService.foundAt(scroll.id) : null,
          rarity: rarityOf(SCROLL_TIER_TO_RARITY[scroll.rarity]),
          // Split here, not in the template: a getter would re-split twenty-five
          // scrolls on every change-detection pass of an always-rendered panel.
          paragraphs: found ? scroll.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [],
        };
      });
      return { chapter, cards, found: cards.filter(c => c.found).length };
    });
  }

  /**
   * Built at construction, not in `hydrate()`.
   *
   * `buildScrolls()` gates every card on `hydrated`, which is false here, so
   * this produces the fully-sealed wall — which is exactly what the server
   * should render and exactly what the browser's first frame must match. An
   * empty array here would prerender an empty panel and then pop five shelves
   * in after hydration.
   */
  scrollShelves: ScrollShelf[] = this.buildScrolls();

  /** The scroll currently open on the wall, by id. Only one at a time. */
  openScroll: string | null = null;

  toggleScroll(card: ScrollCard): void {
    if (!card.found) return;
    this.openScroll = this.openScroll === card.scroll.id ? null : card.scroll.id;
    if (this.openScroll) {
      this.scrollsService.markRead(card.scroll.id);
      // `markRead` pushes `changed$`, which rebuilds the shelves — but the
      // rebuild replaces `card`, so the flag is cleared from the new object
      // rather than this one. Nothing else to do here.
    }
  }

  get scrollsFound(): number {
    return this.hydrated ? this.scrollsService.foundCount : 0;
  }

  get scrollsTotal(): number {
    return LORE_SCROLLS.length;
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'before the Codex opened';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? 'before the Codex opened'
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ══ Progression ═══════════════════════════════════════════════════════════

  /** The ten ranks, newest at the top, with the current position marked. */
  get path(): PathNode[] {
    const held = this.snap.level.level;
    return [...this.levels]
      .sort((a, b) => b.level - a.level)
      .map(level => ({
        level,
        state: level.level === held ? 'current' : level.level < held ? 'held' : 'locked',
      }));
  }

  get aetherPercent(): number { return Math.round(this.snap.aetherShare * 100); }
  get noxPercent(): number { return 100 - this.aetherPercent; }

  /** True when neither realm has meaningfully claimed this visitor. */
  get isBalanced(): boolean {
    return this.aetherPercent >= 45 && this.aetherPercent <= 55;
  }

  /** Faction flavour, or the balance badge's subtitle when neither side leads. */
  get affinityFlavour(): string {
    if (this.snap.xp === 0) return 'Neither realm has heard of you yet. Walk the world and one of them will.';
    if (this.isBalanced) return 'You walk both realms and answer to neither. That is the rarest allegiance there is.';
    return this.aetherPercent > 55
      ? 'The Light burns bright in you, Solari.'
      : 'The Shadow knows your name, Nocturne.';
  }

  /** The next streak length worth aiming at, or null past the last milestone. */
  get nextStreakMilestone(): number | null {
    return STREAK_MILESTONES.find(m => m > this.snap.streak) ?? null;
  }

  get streakDaysToGo(): number {
    const next = this.nextStreakMilestone;
    return next ? next - this.snap.streak : 0;
  }

  /** Total XP across the rendered calendar window. */
  get calendarXp(): number {
    return this.calendar.reduce((sum, d) => sum + d.xp, 0);
  }

  get activeDays(): number {
    return this.calendar.filter(d => d.xp > 0).length;
  }

  /**
   * The last thirty days, oldest first.
   *
   * Heat is bucketed against a fixed scale rather than the window's own maximum:
   * a relative scale would repaint the whole calendar every time one big day
   * landed, so a quiet week would look identical to a busy one.
   */
  private buildCalendar(history: Record<string, number>): CalendarDay[] {
    const today = localDay();
    const days: CalendarDay[] = [];

    for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = localDay(d);
      const xp = history[date] ?? 0;
      days.push({
        date,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        xp,
        heat: xp === 0 ? 0 : xp < 50 ? 1 : xp < 150 ? 2 : xp < 400 ? 3 : 4,
        isToday: date === today,
      });
    }
    return days;
  }

  // ══ Secrets ═══════════════════════════════════════════════════════════════

  private buildSecrets(): SecretCard[] {
    return SECRETS.map(def => {
      const group = SECRET_GROUPS.find(g => g.id === def.group) ?? SECRET_GROUPS[0];
      const rarity = RARITIES[def.tier];

      let found = false;
      let record: SecretRecord | null = null;

      if (def.eggId) {
        found = this.hydrated && this.eggs.isFound(def.eggId);
        const at = found ? this.eggs.foundAt(def.eggId) : null;
        record = at ? { at, how: 'egg' } : null;
      } else if (def.detector || def.route) {
        record = this.hydrated ? this.secretsService.record(def.id) : null;
        found = !!record;
      }

      return {
        def,
        group,
        rarity,
        found,
        at: record?.at ?? null,
        how: record ? SECRET_SOURCE_LABEL[record.how] : found ? SECRET_SOURCE_LABEL.egg : null,
      };
    });
  }

  get foundSecrets(): number { return this.secrets.filter(s => s.found).length; }
  get totalSecrets(): number { return this.secrets.length; }

  secretsInGroup(id: string): SecretCard[] {
    return this.secrets.filter(s => s.group.id === id);
  }

  groupFound(id: string): number {
    return this.secretsInGroup(id).filter(s => s.found).length;
  }

  /** Mythic and Singular secrets get the extra lore line under their clue. */
  isDeepSecret(card: SecretCard): boolean {
    return card.def.tier === 'mythic' || card.def.tier === 'singular';
  }

  // ══ Leaderboard ═══════════════════════════════════════════════════════════

  /**
   * Rows for the leaderboard mock-up. Deliberately not real people and labelled
   * as a preview in the template — inventing a global ranking on a page whose
   * whole premise is an honest record would undercut everything above it.
   */
  readonly leaderboardPreview = [
    { rank: 1, name: 'Eclipse Lord', xp: 12_480, fragments: 140, tag: 'Convergent' },
    { rank: 2, name: 'Godforge Keeper', xp: 8_910, fragments: 122, tag: 'Nocturne' },
    { rank: 3, name: 'Neon Architect', xp: 6_204, fragments: 97,  tag: 'Solari' },
    { rank: 4, name: 'Shadow Weaver', xp: 4_015, fragments: 73,  tag: 'Nocturne' },
    { rank: 5, name: 'Realm Walker',  xp: 2_338, fragments: 51,  tag: 'Solari' },
  ];

  /** The affinity tag this visitor would carry on a leaderboard row. */
  get affinityTag(): string {
    if (this.isBalanced && this.snap.xp > 0) return 'Convergent';
    return this.aetherPercent > 55 ? 'Solari' : this.aetherPercent < 45 ? 'Nocturne' : 'Unaligned';
  }
}
