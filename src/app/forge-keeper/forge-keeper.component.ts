/**
 * forge-keeper.component.ts — /forge-keeper, the character sheet.
 *
 * Eight panels over one visitor: who they are, what they have done, which realm
 * has claimed them, what they own, what they are proudest of, when they showed
 * up, which tools they actually know, and where to go next.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS PAGE OWNS NO STATE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every number on it is already true somewhere else — XpService, EconomyService,
 * ToolMasteryService, QuestService, IdleService, ArenaScoresService,
 * EasterEggService and LoreService each already know their own piece. The only
 * thing stored on this page's behalf is which trophies are pinned, and that is a
 * display preference in its own key (PinnedAchievementsService).
 *
 * That matters because a profile that keeps its own copy of the totals is a
 * profile that can disagree with the rest of the site, and the first time it
 * does, the visitor believes the profile.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR
 * ─────────────────────────────────────────────────────────────────────────────
 * Same construction as the Codex, for the same reason. Every list is built at
 * construction time from pure registries, so the prerendered HTML is a complete
 * and correct *empty* Forge: the full inventory in silhouette, the whole rank
 * ladder, thirty cold calendar cells. `ngOnInit` only runs its hydration pass in
 * the browser, and everything visitor-specific is applied after an `await`, i.e.
 * in a microtask, i.e. after Angular has finished comparing this component's
 * first render against the server's HTML. No hydration mismatch, no flash.
 */
import {
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EasterEggService } from '../shared/easter-eggs/easter-egg.service';
import {
  EclipseRarity,
  RARITIES,
  RARITY_ORDER,
  RarityDefinition,
} from '../shared/rarity/rarity.model';
import { LEVELS, LevelDefinition, rankSigil } from '../shared/gamification/gamification.model';
import { XpService, XpSnapshot, localDay } from '../shared/gamification/xp.service';
import {
  MasteryDefinition,
  ToolMasteryService,
  masteryForUses,
  masteryProgress,
} from '../shared/gamification/tool-mastery.service';
import { ProgressStorageService } from '../shared/gamification/progress-storage.service';
import {
  ARTIFACTS,
  COSMETICS,
  ENCHANTMENTS,
  EconomyService,
  EconomySnapshot,
  FORGE_UPGRADES,
  HAMMER_UPGRADES,
} from '../shared/economy/economy.service';
import {
  formatCompact,
  formatCurrency,
  formatMultiplier,
  formatRate,
} from '../shared/economy/economy.model';
import { QuestService } from '../shared/quests/quest.service';
import { IdleService } from '../shared/idle/idle.service';
import { LoreService } from '../shared/lore/lore.service';
import { LORE_SLUGS, TOOL_LORE } from '../shared/lore/lore.model';
import { ArenaScoresService } from '../arena/games/arena-scores.service';
import { ARENA_PLAYABLE } from '../arena/games/arena-game.model';
import { RealmDefinition, realmForCategory } from '../shared/realms/realm.model';
import { TOOLS_REGISTRY } from '../tools/tools-registry';
import { CodexAchievement, buildAchievements } from '../codex/codex.model';
import { PIN_SLOTS, PinnedAchievementsService } from './pinned-achievements.service';

/** Which shelf of the inventory is showing. */
export type InventoryFilter = 'all' | 'upgrades' | 'artifacts' | 'cosmetics' | 'enchantments';

interface InventoryTab {
  key: InventoryFilter;
  label: string;
  icon: string;
}

/** One card in the inventory grid, owned or in silhouette. */
interface InventoryItem {
  kind: 'upgrade' | 'artifact' | 'cosmetic' | 'enchantment';
  id: string;
  name: string;
  icon: string;
  /** What it does, in the visitor's language. */
  effect: string;
  /** The line of lore or flavour under the effect. */
  flavour: string;
  owned: boolean;
  /** Levels held, for the two repeatable ladders. 0 on one-of-a-kind items. */
  level: number;
  tier: EclipseRarity;
  rarity: RarityDefinition;
  cost: number;
  currency: 'gold' | 'essence';
  /** Label of the equipped variant, for owned cosmetics. Null otherwise. */
  equipped: string | null;
  /** Epoch ms this enchantment stops applying, for the countdown. */
  expiresAt: number | null;
}

/** One cell of the thirty-day heatmap. */
interface ForgeDay {
  date: string;
  /** "Aug 12" — the tooltip and the mobile axis label. */
  label: string;
  /** Weekday initial, for the column header on desktop. */
  weekday: string;
  xp: number;
  /** 0-4. Dark, ember, flame, gold, white-hot. */
  heat: number;
  isToday: boolean;
}

/** One row of the tool mastery board. */
interface MasteryRow {
  id: string;
  title: string;
  icon: string;
  route: string;
  realm: RealmDefinition;
  uses: number;
  mastery: MasteryDefinition;
  progress: number;
  stars: boolean[];
}

/** A point on the rank sigil. */
interface SigilPoint {
  x: number;
  y: number;
}

/** One tile in the stats grid. */
interface StatTile {
  label: string;
  value: string;
  /** The unit or qualifier under the number. */
  note: string;
  icon: string;
  /** Tints the tile. Drawn from the brand palette only. */
  color: string;
}

/** The last thirty days. Matches the Codex calendar so the two never disagree. */
const CALENDAR_DAYS = 30;

/** Streak lengths worth naming as the next target, and what reaching one is called. */
const STREAK_MILESTONES: Array<{ days: number; name: string }> = [
  { days: 3,   name: 'Kindled' },
  { days: 7,   name: 'Weeklong Vigil' },
  { days: 12,  name: 'Full Bellows' },
  { days: 30,  name: 'Monthlong Burn' },
  { days: 100, name: 'The Unbroken' },
];

/** How many tools the mastery board shows before deferring to the Bestiary. */
const MASTERY_ROWS = 5;

/**
 * Chapters across the whole corpus — the denominator on the Lore stat.
 *
 * A property of the authored lore rather than of any visitor, so it is computed
 * once at module load and the server renders the same denominator the browser
 * will. `LoreService` can only answer per-tool and only in the browser.
 */
const LORE_CHAPTER_TOTAL = TOOL_LORE.reduce((sum, l) => sum + l.chapters.length, 0);

/**
 * The level-1 nothing-yet snapshot.
 *
 * Read instead of `XpService.snapshot` for the first render even in the browser:
 * XpWiringService has already hydrated the ledger by the time a routed component
 * is constructed, so reading the live value here would render a different first
 * frame than the server did and trip Angular's hydration check. Everything
 * visitor-specific lands after the `await` in `hydrate()`.
 */
const ZERO_XP: XpSnapshot = {
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

/** Matching zero ledger, for the same reason. */
const ZERO_ECONOMY: EconomySnapshot = {
  gold: 0,
  essence: 0,
  totalGoldEarned: 0,
  runGoldEarned: 0,
  totalClicks: 0,
  autoClicks: 0,
  perSecond: 0,
  perMinute: 0,
  breakdown: { idle: 0, auto: 0, upgrades: 1, streak: 1, shards: 1, artifact: 1, total: 0 },
  autoPerSecond: 0,
  perClick: 0,
  shards: 0,
  shardMult: 1,
  prestigeCount: 0,
  pendingShards: 0,
  prestigeReady: false,
  streakDays: 0,
  flameTier: 0,
  hammerVisual: 'none',
  upgradeLevels: 0,
  artifacts: [],
  cosmetics: [],
  equipped: {},
  enchantment: null,
  doubled: false,
};

/**
 * The rarity a Gold-priced item wears.
 *
 * Only artifacts carry an authored tier. Painting the other three shelves one
 * flat colour would throw away the one thing the ladder already encodes — a
 * 50-Gold pair of Bellows and a 10,000-Gold Achievement Frame are not the same
 * kind of possession — so the price band stands in for a tier nobody authored.
 */
function tierForGold(cost: number): EclipseRarity {
  if (cost >= 10_000) return 'mythic';
  if (cost >= 2_000) return 'anomalous';
  if (cost >= 500) return 'sacred';
  if (cost >= 100) return 'eclipsed';
  return 'mortal';
}

/** The same idea on the Essence scale, which runs two orders of magnitude lower. */
function tierForEssence(cost: number): EclipseRarity {
  if (cost >= 1_000) return 'mythic';
  if (cost >= 200) return 'anomalous';
  if (cost >= 50) return 'sacred';
  if (cost >= 10) return 'eclipsed';
  return 'mortal';
}

@Component({
  selector: 'app-forge-keeper',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './forge-keeper.component.html',
  styleUrls: ['./forge-keeper.component.css'],
})
export class ForgeKeeperComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly xp = inject(XpService);
  private readonly economy = inject(EconomyService);
  private readonly masteryService = inject(ToolMasteryService);
  private readonly quests = inject(QuestService);
  private readonly idle = inject(IdleService);
  private readonly lore = inject(LoreService);
  private readonly arena = inject(ArenaScoresService);
  private readonly eggs = inject(EasterEggService);
  private readonly pins = inject(PinnedAchievementsService);
  private readonly storage = inject(ProgressStorageService);

  private subs: Subscription[] = [];

  /**
   * False until the post-hydration pass has run. Every derived getter consults
   * it and reports the empty state while it is false, which makes the server's
   * HTML and the browser's first frame identical by construction rather than by
   * luck.
   */
  private hydrated = false;

  // ── Identity ──────────────────────────────────────────────────────────────
  snap: XpSnapshot = ZERO_XP;
  wallet: EconomySnapshot = ZERO_ECONOMY;
  /** ISO instant progression was minted, or null before hydration. */
  memberSince: string | null = null;
  /** Lifetime visible time in the Forge, in ms. */
  forgeMs = 0;

  // ── Stats ─────────────────────────────────────────────────────────────────
  questsCompleted = 0;
  arenaPlays = 0;
  loreFound = 0;
  /** Tools at Expert or above — the same definition the Codex Bestiary uses. */
  toolsMastered = 0;
  readonly loreTotal = LORE_CHAPTER_TOTAL;
  /** Exposed for the rank sigil painted into the identity crest. */
  readonly rankSigil = rankSigil;

  // ── Achievements ──────────────────────────────────────────────────────────
  /** The whole wall, locked. Hydration flips what this visitor has found. */
  achievements: CodexAchievement[] = buildAchievements();
  /** Explicit pins, or null while the auto picker is in charge. */
  private chosenPins: string[] | null = null;
  /** True while the pin picker is open. */
  picking = false;
  readonly pinSlots = PIN_SLOTS;

  // ── Inventory ─────────────────────────────────────────────────────────────
  readonly inventoryTabs: InventoryTab[] = [
    { key: 'all',          label: 'All',          icon: '❖' },
    { key: 'upgrades',     label: 'Upgrades',     icon: '⚒' },
    { key: 'artifacts',    label: 'Artifacts',    icon: '💠' },
    { key: 'cosmetics',    label: 'Cosmetics',    icon: '✨' },
    { key: 'enchantments', label: 'Enchantments', icon: '🕯️' },
  ];
  inventoryFilter: InventoryFilter = 'all';
  inventory: InventoryItem[] = this.buildInventory(ZERO_ECONOMY);

  // ── Calendar & mastery ────────────────────────────────────────────────────
  calendar: ForgeDay[] = this.buildCalendarShell();
  mastery: MasteryRow[] = [];

  // ── Rank ladder ───────────────────────────────────────────────────────────
  readonly levels = LEVELS;

  /**
   * Ticks the enchantment countdown and the time-in-Forge readout.
   *
   * One second, and only while the page is open. The alternative — binding
   * straight to `Date.now()` in the template — would recompute on every change
   * detection pass the whole app runs, which on a page with a live XP bar in the
   * header is considerably more than once a second.
   */
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Re-read on each tick so the countdown is not a template-side `Date.now()`. */
  now = 0;

  // ══ Lifecycle ═════════════════════════════════════════════════════════════

  ngOnInit(): void {
    if (!this.isBrowser) return;
    void this.hydrate();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.ticker !== null) clearInterval(this.ticker);
  }

  /**
   * Fill in everything that depends on this visitor.
   *
   * Awarding Self-Aware is deliberately last: it fires a drop toast and 25 XP,
   * and doing that before the sheet is populated would show a card unlocking on
   * a profile that still reads level 1 with nothing owned.
   */
  private async hydrate(): Promise<void> {
    // The await matters beyond loading eggs: everything after it runs in a
    // microtask, i.e. after Angular has finished hydrating this component.
    await this.eggs.init();
    // A one-shot synchronous read of the ledger has to wait for storage, or it
    // reads the empty blob and never looks again.
    await this.xp.init();

    this.economy.init();
    this.quests.init();
    this.lore.init();
    this.arena.init();

    this.hydrated = true;
    this.now = Date.now();

    this.snap = this.xp.snapshot;
    this.wallet = this.economy.snapshot;
    this.memberSince = this.xp.createdAt;
    this.forgeMs = this.idle.snapshot.lifetimeMs;

    this.achievements = this.achievements.map(a => ({
      ...a,
      unlocked: this.eggs.isFound(a.id),
      unlockedAt: this.eggs.foundAt(a.id),
    }));
    this.chosenPins = this.pins.load();

    const counts = this.masteryService.all();
    this.inventory = this.buildInventory(this.wallet);
    this.calendar = this.buildCalendar(this.xp.history);
    this.mastery = this.buildMastery(counts);
    this.toolsMastered = Object.values(counts).filter(uses => masteryForUses(uses).stars >= 4).length;
    this.questsCompleted = this.quests.board.totalCompleted;
    this.arenaPlays = ARENA_PLAYABLE.reduce((sum, g) => sum + this.arena.record(g.id).plays, 0);
    this.loreFound = LORE_SLUGS.reduce((sum, slug) => sum + (this.lore.progressFor(slug)?.discovered ?? 0), 0);

    // The ledgers stay live: the Forge Flame is fixed to the corner of every
    // page including this one, so Gold and strikes can move while the sheet is
    // on screen and the sheet should follow.
    this.subs.push(this.xp.snapshot$.subscribe(s => {
      this.snap = s;
      this.calendar = this.buildCalendar(this.xp.history);
    }));
    this.subs.push(this.economy.snapshot$.subscribe(e => {
      this.wallet = e;
      this.inventory = this.buildInventory(e);
    }));
    this.subs.push(this.idle.snapshot$.subscribe(i => (this.forgeMs = i.lifetimeMs)));
    this.subs.push(this.quests.board$.subscribe(b => (this.questsCompleted = b.totalCompleted)));

    this.ticker = setInterval(() => (this.now = Date.now()), 1000);

    // The sheet itself is an achievement. Triggering unconditionally is safe —
    // EasterEggService only pays out and only toasts on the first discovery.
    void this.eggs.trigger('forge-self-aware');
    this.achievements = this.achievements.map(a =>
      a.id === 'forge-self-aware' && !a.unlocked
        ? { ...a, unlocked: true, unlockedAt: this.eggs.foundAt(a.id) }
        : a);
  }

  // ══ Identity ══════════════════════════════════════════════════════════════

  /** "FORGEHAND · Level 3", with the cosmetic title prefix if one is equipped. */
  get rankTitle(): string {
    return this.snap.level.title.toUpperCase();
  }

  /**
   * The word the Title Prefix cosmetic puts in front of the rank, or null.
   *
   * Read off the equipped variant rather than off ownership: buying the slot
   * and then clearing it is a deliberate choice to wear nothing, and the sheet
   * has to honour it.
   */
  get titlePrefix(): string | null {
    const variant = this.wallet.equipped['prefix'];
    if (!variant) return null;
    const def = COSMETICS.find(c => c.slot === 'prefix');
    return def?.variants.find(v => v.id === variant)?.label ?? null;
  }

  /** Lifetime XP still needed for the next rank, formatted. */
  get toNextLabel(): string {
    return this.snap.next
      ? `${formatCurrency(this.snap.xp)} / ${formatCurrency(this.snap.next.minXp)} XP`
      : `${formatCurrency(this.snap.xp)} XP — the ladder ends here`;
  }

  get xpPercent(): number {
    return Math.round(this.snap.progress * 100);
  }

  /**
   * Whether progression is following a signed-in identity.
   *
   * False today and honestly so — `ProgressStorageService` is on the
   * localStorage adapter and the Firestore one is an inert Phase 2 stub. The
   * sheet says which of the two it is rather than showing a sign-in button
   * that would lead nowhere.
   */
  get isCloudSaved(): boolean {
    return this.hydrated && this.storage.isRemote;
  }

  /** First eight characters of the local id. Enough to recognise, too short to be one. */
  get shortId(): string {
    return this.hydrated ? this.xp.userId.slice(0, 8) : '········';
  }

  /** "12 Aug 2026", or null before hydration. */
  get memberSinceLabel(): string | null {
    if (!this.memberSince) return null;
    const d = new Date(this.memberSince);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** "4h 12m", or "18m", or "under a minute". */
  get forgeTimeLabel(): string {
    const minutes = Math.floor(this.forgeMs / 60_000);
    if (minutes < 1) return 'under a minute';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${minutes}m`;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }

  // ══ The rank sigil ════════════════════════════════════════════════════════
  //
  // Drawn rather than typed. A glyph per rank would have been ten characters
  // from the exotic end of Unicode, which is ten chances for a system font to
  // render a tofu box on the one element the page is built around. The sigil is
  // inline SVG whose point count *is* the rank: level 3 is a triangle, level 10
  // is a decagram. It cannot drift out of step with the number beside it,
  // because it is the same number.

  /** Evenly spaced points on a circle, one per level held. */
  get sigilPoints(): SigilPoint[] {
    const n = this.snap.level.level;
    const r = 66;
    return Array.from({ length: n }, (_, i) => {
      // Start at twelve o'clock so every rank is symmetrical about the vertical.
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        x: Math.round((100 + Math.cos(angle) * r) * 100) / 100,
        y: Math.round((100 + Math.sin(angle) * r) * 100) / 100,
      };
    });
  }

  /**
   * The star polygon joining those points.
   *
   * Stepped by `floor(n/2)` rather than 1, which turns the outline from a plain
   * polygon into a star for every rank above four — the difference between a
   * badge and a sigil. Ranks 1-3 have no valid step and fall back to the hull.
   */
  get sigilPolygon(): string {
    const pts = this.sigilPoints;
    const n = pts.length;
    if (n < 3) return '';
    const step = n < 5 ? 1 : Math.floor(n / 2);
    // A step sharing a factor with n would close early and leave points
    // unvisited; walking n vertices and stepping modulo n keeps every rank a
    // single closed figure.
    const path: SigilPoint[] = [];
    for (let i = 0, at = 0; i < n; i++, at = (at + step) % n) path.push(pts[at]);
    return path.map(p => `${p.x},${p.y}`).join(' ');
  }

  /** The realm colour the sigil and the identity card border wear. */
  get affinityColor(): string {
    if (this.isBalanced) return '#A78BFA';
    return this.aetherPercent > 55 ? '#E8D44D' : '#8B2252';
  }

  get affinityGlow(): string {
    if (this.isBalanced) return 'rgba(167, 139, 250, 0.6)';
    return this.aetherPercent > 55 ? 'rgba(232, 212, 77, 0.6)' : 'rgba(139, 34, 82, 0.75)';
  }

  // ══ Stats ═════════════════════════════════════════════════════════════════

  get achievementsFound(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  get achievementsTotal(): number {
    return this.achievements.length;
  }

  /** The forge's live rate, compact past a thousand. */
  get perSecond(): string { return formatCompact(this.wallet.perSecond); }
  get autoRate(): string { return formatRate(this.wallet.autoPerSecond); }
  /** "×1.35". What the shards are paying, everywhere they are shown. */
  get shardMult(): string { return formatMultiplier(this.wallet.shardMult); }

  /** The twelve tiles, in reading order. */
  get stats(): StatTile[] {
    return [
      { label: 'Total XP',      value: formatCurrency(this.snap.xp),           note: 'earned all time',   icon: '✦', color: '#A78BFA' },
      { label: 'Tools Mastered', value: String(this.toolsMastered),            note: 'Expert or above',   icon: '❖', color: '#a48bff' },
      { label: 'Achievements',  value: `${this.achievementsFound}/${this.achievementsTotal}`, note: 'fragments found', icon: '🏆', color: '#C9A84C' },
      { label: 'Quests',        value: formatCurrency(this.questsCompleted),    note: 'completed',         icon: '⚔️', color: '#ff6dd7' },
      { label: 'Flame Strikes', value: formatCurrency(this.wallet.totalClicks), note: 'on the anvil',      icon: '🔨', color: '#E8752A' },
      { label: 'Gold Earned',   value: formatCurrency(this.wallet.totalGoldEarned), note: 'all time',      icon: '🪙', color: '#ffd97a' },
      { label: 'Gold / Second', value: formatCompact(this.wallet.perSecond),    note: 'while you read',    icon: '⏱️', color: '#7fd5a3' },
      { label: 'Eclipse Shards', value: formatCurrency(this.wallet.shards),     note: this.wallet.shards > 0 ? `${this.shardMult} forever` : 'no Eclipse taken', icon: '🌑', color: '#c48bff' },
      { label: 'Current Streak', value: String(this.snap.streak),               note: this.snap.streak === 1 ? 'day' : 'days', icon: '🔥', color: '#ff8a4c' },
      { label: 'Best Streak',   value: String(this.snap.bestStreak),            note: this.snap.bestStreak === 1 ? 'day' : 'days', icon: '🔥', color: '#ffb26b' },
      { label: 'Arena Runs',    value: formatCurrency(this.arenaPlays),         note: 'gates entered',     icon: '🏟️', color: '#5fb6ff' },
      { label: 'Lore Chapters', value: `${this.loreFound}/${this.loreTotal}`,   note: 'discovered',        icon: '📜', color: '#7fd5a3' },
    ];
  }

  // ══ Realm affinity ════════════════════════════════════════════════════════

  get aetherPercent(): number { return Math.round(this.snap.aetherShare * 100); }
  get noxPercent(): number { return 100 - this.aetherPercent; }

  /** True when neither realm has meaningfully claimed this visitor. */
  get isBalanced(): boolean {
    return this.aetherPercent >= 45 && this.aetherPercent <= 55;
  }

  /** The badge over the disc. Matches the Codex's wording so the two agree. */
  get affinityVerdict(): { icon: string; art?: boolean; title: string; line: string } {
    if (this.snap.xp === 0) {
      return {
        icon: '◌',
        title: 'Unclaimed',
        line: 'Neither realm has heard of you yet. Use a tool and one of them will.',
      };
    }
    if (this.isBalanced) {
      return {
        icon: '⚖️',
        title: 'True Convergent',
        line: 'You walk between realms and answer to neither. That is the rarest allegiance there is.',
      };
    }
    // Solari and Nocturne are the two realms with painted sigils; Unclaimed and
    // True Convergent are states rather than realms and keep their glyph.
    return this.aetherPercent > 55
      ? { icon: 'assets/icons/realms/luminous.png', art: true, title: 'Solari',
          line: 'The Light burns bright in you, Solari.' }
      : { icon: 'assets/icons/realms/umbral.png', art: true, title: 'Nocturne',
          line: 'The Shadow knows your name, Nocturne.' };
  }

  /**
   * Where the two eyes sit on the affinity disc.
   *
   * The disc is a conic gradient, so the arcs are exact without any path maths;
   * the eyes just need the angular midpoint of each arc, which is the only thing
   * a gradient cannot place for itself.
   */
  get aetherEyeAngle(): number { return (this.aetherPercent / 100) * 180; }
  get noxEyeAngle(): number { return this.aetherPercent * 3.6 + (this.noxPercent / 100) * 180; }

  /**
   * Which realm this visitor's tool use actually leans on, by uses rather than
   * by XP. Not the same question as the energy split: XP pays once per tool,
   * so a hundred visits to one Umbral tool moves this and does not move that.
   */
  get dominantRealm(): { realm: RealmDefinition; uses: number } | null {
    if (!this.hydrated) return null;
    const counts = this.masteryService.all();
    const byRealm = new Map<string, { realm: RealmDefinition; uses: number }>();

    for (const tool of TOOLS_REGISTRY) {
      const uses = counts[tool.id] ?? 0;
      if (uses <= 0) continue;
      const realm = realmForCategory(tool.category);
      const row = byRealm.get(realm.id) ?? { realm, uses: 0 };
      row.uses += uses;
      byRealm.set(realm.id, row);
    }

    return [...byRealm.values()].sort((a, b) => b.uses - a.uses)[0] ?? null;
  }

  // ══ Inventory ═════════════════════════════════════════════════════════════

  /**
   * Every purchasable thing in the Godforge, owned or not.
   *
   * Built from the catalogs rather than from what is owned, so the grid is a
   * complete shelf with the unbought items in silhouette — which is the whole
   * point of an inventory screen in a game, and which also means the server can
   * prerender it in full.
   */
  private buildInventory(e: EconomySnapshot): InventoryItem[] {
    const items: InventoryItem[] = [];

    for (const up of [...FORGE_UPGRADES, ...HAMMER_UPGRADES]) {
      // `levelOf` reads the live ledger, which is empty on the server and before
      // hydration — the same zero the snapshot reports.
      const level = this.hydrated ? this.economy.levelOf(up.id) : 0;
      const tier = tierForGold(up.baseCost);
      items.push({
        kind: 'upgrade',
        id: up.id,
        name: up.name,
        icon: up.icon,
        effect: up.effect,
        flavour: up.flavour,
        owned: level > 0,
        level,
        tier,
        rarity: RARITIES[tier],
        cost: up.baseCost,
        currency: 'gold',
        equipped: null,
        expiresAt: null,
      });
    }

    for (const art of ARTIFACTS) {
      items.push({
        kind: 'artifact',
        id: art.id,
        name: art.name,
        icon: art.icon,
        effect: art.effect,
        flavour: art.lore,
        owned: e.artifacts.includes(art.id),
        level: 0,
        tier: art.tier,
        rarity: RARITIES[art.tier],
        cost: art.cost,
        currency: 'essence',
        equipped: null,
        expiresAt: null,
      });
    }

    for (const cos of COSMETICS) {
      const owned = e.cosmetics.includes(cos.id);
      const variant = owned ? e.equipped[cos.slot] : undefined;
      const tier = tierForGold(cos.cost);
      items.push({
        kind: 'cosmetic',
        id: cos.id,
        name: cos.name,
        icon: cos.icon,
        effect: cos.effect,
        flavour: cos.flavour,
        owned,
        level: 0,
        tier,
        rarity: RARITIES[tier],
        cost: cos.cost,
        currency: 'gold',
        equipped: variant
          ? cos.variants.find(v => v.id === variant)?.label ?? null
          : null,
        expiresAt: null,
      });
    }

    for (const ench of ENCHANTMENTS) {
      // Only the strongest running enchantment is published on the snapshot,
      // which is the one that is actually applying — see `xpMultiplier`. A
      // weaker one still ticking is not doing anything, so the shelf does not
      // claim it is.
      const running = e.enchantment?.def.id === ench.id ? e.enchantment : null;
      const tier = tierForEssence(ench.cost);
      items.push({
        kind: 'enchantment',
        id: ench.id,
        name: ench.name,
        icon: ench.icon,
        effect: ench.effect,
        flavour: ench.flavour,
        owned: !!running,
        level: 0,
        tier,
        rarity: RARITIES[tier],
        cost: ench.cost,
        currency: 'essence',
        equipped: null,
        expiresAt: running?.expiresAt ?? null,
      });
    }

    return items;
  }

  get visibleInventory(): InventoryItem[] {
    if (this.inventoryFilter === 'all') return this.inventory;
    const kind = this.inventoryFilter.slice(0, -1) as InventoryItem['kind'];
    return this.inventory.filter(i => i.kind === kind);
  }

  /** Owned-of-total for one shelf, for the tab badge. */
  tabCount(key: InventoryFilter): { owned: number; total: number } {
    const of = key === 'all'
      ? this.inventory
      : this.inventory.filter(i => i.kind === key.slice(0, -1));
    return { owned: of.filter(i => i.owned).length, total: of.length };
  }

  selectInventory(key: InventoryFilter): void {
    this.inventoryFilter = key;
  }

  /** "3h 12m left" on a running enchantment, or null when it is not running. */
  timeLeft(item: InventoryItem): string | null {
    if (item.expiresAt === null) return null;
    const ms = item.expiresAt - this.now;
    if (ms <= 0) return null;
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m ${seconds}s left`;
    return `${seconds}s left`;
  }

  // ══ Achievement showcase ══════════════════════════════════════════════════

  /** Everything found, rarest first — the pool the picker draws from. */
  get unlockedAchievements(): CodexAchievement[] {
    return this.achievements
      .filter(a => a.unlocked)
      .sort((a, b) =>
        b.rarity.weight - a.rarity.weight ||
        (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '') ||
        a.name.localeCompare(b.name));
  }

  /**
   * The case. An explicit pin list when one has been saved, otherwise the
   * rarest things on the wall.
   *
   * Chosen ids are resolved against the live wall rather than trusted, so a pin
   * pointing at an egg that has since been retired quietly drops out instead of
   * rendering an empty slot.
   */
  get pinned(): CodexAchievement[] {
    if (this.chosenPins === null) return this.unlockedAchievements.slice(0, this.pinSlots);
    const byId = new Map(this.achievements.map(a => [a.id, a]));
    return this.chosenPins
      .map(id => byId.get(id))
      .filter((a): a is CodexAchievement => !!a && a.unlocked)
      .slice(0, this.pinSlots);
  }

  /** Empty slots to draw after the filled ones, so the case is always five wide. */
  get emptySlots(): number[] {
    return Array.from({ length: Math.max(0, this.pinSlots - this.pinned.length) }, (_, i) => i);
  }

  get isCustomised(): boolean {
    return this.chosenPins !== null;
  }

  togglePicker(): void {
    this.picking = !this.picking;
  }

  isPinned(id: string): boolean {
    return this.pinned.some(a => a.id === id);
  }

  /**
   * Pin or unpin one achievement.
   *
   * The first click on an auto-filled case adopts what is currently showing as
   * the starting selection rather than beginning from nothing — otherwise
   * clicking one trophy would silently clear the other four.
   */
  togglePin(id: string): void {
    const current = this.chosenPins ?? this.pinned.map(a => a.id);
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : current.length >= this.pinSlots ? current : [...current, id];

    this.chosenPins = next;
    this.pins.save(next);
  }

  /** Hand the case back to the auto picker. */
  resetPins(): void {
    this.chosenPins = null;
    this.pins.reset();
  }

  /** True when the case is full and this one is not in it. */
  pinDisabled(id: string): boolean {
    return !this.isPinned(id) && this.pinned.length >= this.pinSlots;
  }

  // ══ Streak calendar ═══════════════════════════════════════════════════════

  /** Thirty cold cells with real dates. What the server renders. */
  private buildCalendarShell(): ForgeDay[] {
    return this.buildCalendar({});
  }

  /**
   * The last thirty days, oldest first.
   *
   * Heat is bucketed against a fixed scale rather than the window's own maximum,
   * for the reason the Codex calendar states: a relative scale repaints the
   * whole month every time one big day lands, so a quiet week looks identical to
   * a busy one. The thresholds are the Codex's, so the two calendars agree.
   */
  private buildCalendar(history: Record<string, number>): ForgeDay[] {
    const today = localDay();
    const days: ForgeDay[] = [];

    for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = localDay(d);
      const xp = history[date] ?? 0;
      days.push({
        date,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        weekday: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        xp,
        heat: xp === 0 ? 0 : xp < 50 ? 1 : xp < 150 ? 2 : xp < 400 ? 3 : 4,
        isToday: date === today,
      });
    }
    return days;
  }

  get calendarXp(): number {
    return this.calendar.reduce((sum, d) => sum + d.xp, 0);
  }

  get activeDays(): number {
    return this.calendar.filter(d => d.xp > 0).length;
  }

  get hottestDay(): ForgeDay | null {
    return this.calendar.reduce<ForgeDay | null>(
      (best, d) => (d.xp > 0 && (!best || d.xp > best.xp) ? d : best),
      null);
  }

  /** The next streak length worth aiming at, or null past the last one. */
  get nextMilestone(): { days: number; name: string } | null {
    return STREAK_MILESTONES.find(m => m.days > this.snap.streak) ?? null;
  }

  get milestoneDaysToGo(): number {
    const next = this.nextMilestone;
    return next ? next.days - this.snap.streak : 0;
  }

  // ══ Tool mastery ══════════════════════════════════════════════════════════

  /** The five most-used tools. Untouched tools never appear. */
  private buildMastery(counts: Record<string, number>): MasteryRow[] {
    return TOOLS_REGISTRY
      .map(tool => ({ tool, uses: counts[tool.id] ?? 0 }))
      .filter(row => row.uses > 0)
      .sort((a, b) => b.uses - a.uses || a.tool.title.localeCompare(b.tool.title))
      .slice(0, MASTERY_ROWS)
      .map(({ tool, uses }) => {
        const mastery = masteryForUses(uses);
        return {
          id: tool.id,
          title: tool.title,
          icon: tool.textIcon,
          route: tool.route,
          realm: realmForCategory(tool.category),
          uses,
          mastery,
          progress: masteryProgress(uses),
          stars: Array.from({ length: 5 }, (_, i) => i < mastery.stars),
        };
      });
  }

  // ══ Template helpers ══════════════════════════════════════════════════════

  readonly rarityOrder = RARITY_ORDER;

  /** Live tools in the registry — the number the empty mastery board points at. */
  readonly toolCount = TOOLS_REGISTRY.filter(t => t.status === 'live').length;

  formatDate(iso: string | null): string {
    if (!iso) return 'before the Forge kept time';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? 'before the Forge kept time'
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  money(n: number): string {
    return formatCurrency(n);
  }

  /** `trackBy` for every list on the page — they are all keyed by a stable id. */
  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  trackByDate(_index: number, day: ForgeDay): string {
    return day.date;
  }
}
