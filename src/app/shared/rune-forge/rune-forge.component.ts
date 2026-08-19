/**
 * rune-forge.component.ts — the anvil, the inventory and the recipe wall.
 *
 * Prerendered in its empty state, the way the Market and the Forge Keeper are:
 * the rune registry and the six recipes are pure data, so the server can render
 * all twenty-five cards greyed out and all six recipes locked without knowing
 * anything about the visitor. Hydration only fills in counts and affordability.
 * Nothing on the page is `@if`'d on browser-only state at the top level, so the
 * layout does not move when the ledger arrives.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  AfterViewInit,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { GameStateGateway } from '../save/game-state.gateway';
import { EconomyService } from '../economy/economy.service';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { formatCompact, formatCurrency } from '../economy/economy.model';
import { RuneForgeService, RuneFind } from './rune-forge.service';
import { LoreScrollService } from './lore-scroll.service';
import {
  RUNES,
  RUNEWORDS,
  RUNE_TIERS,
  RUNE_TIER_ORDER,
  Rune,
  RuneTier,
  RuneTierDefinition,
  Runeword,
  STRIKE_COST,
  runeById,
  tierOf,
} from './rune.model';
import { CardArt, runeCard, runewordCard } from './rune-cards';
import {
  AUTO_ROLLS,
  AUTO_STEP_MS,
  AUTO_STOP_TIER,
  BULK_FRAME_MS,
  BULK_ROLLS,
} from './rune-reel';
import {
  LIBRARY_FILTERS,
  LIBRARY_SORTS,
  filterCards,
  lockedMark,
  sortCards,
  wordsUsing,
  type LibraryCard,
  type LibraryFilter,
  type LibrarySort,
  type LibraryTab,
} from './rune-library';
import { loadSeen, markSeen, persistSeen } from './rune-unseen';
import { BatchTally, haulOf, isHeavyTier, type BatchHaul, type BatchTier, type HaulLine } from './rune-haul';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { CelebrationService } from '../celebration/celebration.service';
import { CelebrationSoundToggleComponent } from '../celebration/celebration-sound-toggle.component';
import { TranslationService } from '../../translation.service';
import { FORGE_EQUIPMENT_RECIPES, type ForgeEquipmentRecipe } from '../rpg/forge-recipes';
import { ForgeCraftGateway } from '../rpg/forge-craft.gateway';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';

/** A rune as the inventory grid needs it. */
interface RuneCell {
  rune: Rune;
  tier: RuneTierDefinition;
  held: number;
  /** Found at least once, ever. Drives whether the name is legible. */
  known: boolean;
  /**
   * The painted card, or null for Mote, Seam and Ledger — the three runes the
   * sheet does not cover, which keep the name-glyph the ladder used before the
   * art landed.
   *
   * Resolved here rather than called from the template because this is a
   * twenty-five cell grid: a lookup in the binding runs twenty-five times per
   * change-detection pass to produce a value that changes only when the rune
   * registry does, which is never at runtime.
   */
  card: CardArt | null;
}

/** A recipe as the crafting wall needs it. */
interface RecipeRow {
  word: Runeword;
  tier: RuneTierDefinition;
  /** One entry per rune in the recipe, in the order they are set. */
  slots: { rune: Rune; held: number; satisfied: boolean }[];
  crafted: boolean;
  ready: boolean;
  /** True until any rune in the recipe has been seen. Renders as "???". */
  hidden: boolean;
  /** All six words are painted, but the card is withheld while `hidden`. */
  card: CardArt | null;
}

@Component({
  selector: 'app-rune-forge',
  standalone: true,
  imports: [CommonModule, RouterLink, InspectButtonComponent, CelebrationSoundToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rune-forge.component.html',
  styleUrls: ['./rune-forge.component.css'],
})
export class RuneForgeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly forge = inject(RuneForgeService);
  private readonly economy = inject(EconomyService);
  private readonly audio = inject(ForgeAudioService);
  private readonly scrolls = inject(LoreScrollService);
  private readonly doc = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly store = inject(GameStateGateway);
  private readonly i18n = inject(TranslationService);
  private readonly crafts = inject(ForgeCraftGateway);
  private readonly inventory = inject(InventoryService);
  private readonly celebration = inject(CelebrationService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly subs = new Subscription();
  readonly equipmentRecipes = FORGE_EQUIPMENT_RECIPES;
  pendingCraftId: string | null = null;
  lastCraft: GameItem | null = null;
  craftError: 'missing' | 'capacity' | 'persist' | null = null;
  /**
   * Which recipe the current `lastCraft` / `craftError` belongs to. The state
   * above is component-level, so without this every recipe card renders the
   * same banner once a second craftable recipe exists.
   */
  craftRecipeId: string | null = null;
  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }


  readonly strikeCost = STRIKE_COST;
  readonly bulkRolls = BULK_ROLLS;
  /**
   * Auto-roll stops here and above. Rare is the first rung a player would be
   * annoyed to have rolled straight past.
   */
  readonly autoStopTier: RuneTier = AUTO_STOP_TIER;
  readonly tierOrder = RUNE_TIER_ORDER;
  readonly tiers = RUNE_TIERS;
  readonly totalRunes = RUNES.length;
  readonly totalWords = RUNEWORDS.length;

  /** Built once from the registry, so the server renders the full grid. */
  cells: RuneCell[] = RUNES.map(rune => ({
    rune, tier: tierOf(rune.tier), held: 0, known: false, card: runeCard(rune.id),
  }));
  recipes: RecipeRow[] = RUNEWORDS.map(word => this.blankRecipe(word));

  gold = 0;
  strikes = 0;
  goldSpent = 0;
  unique = 0;
  craftedCount = 0;
  rarest: Rune | null = null;
  collectionValue = 0;
  firstFound: Record<string, string> = {};
  cards: LibraryCard[] = [];
  seen = new Set<string>();
  tab: LibraryTab = 'runes';
  filter: LibraryFilter = 'all';
  sort: LibrarySort = 'rarity';
  query = '';
  detail: LibraryCard | null = null;
  showDock = false;
  readonly filters = LIBRARY_FILTERS;
  readonly sorts = LIBRARY_SORTS;
  readonly lockedMark = lockedMark;
  @ViewChild('rollAnchor') rollAnchor?: ElementRef<HTMLElement>;
  private dockWatch?: IntersectionObserver;

  /** The rune the anvil just produced. Null between strikes. */
  reveal: RuneFind | null = null;
  revealTier: RuneTierDefinition | null = null;
  /**
   * The painted card for the rune on show, or null for the three unpainted
   * ones. When it is set the reveal shows the card and drops its own name and
   * lore text: both are painted onto the card, and printing them underneath is
   * the same sentence twice. The name survives as the image's alt text, so what
   * a screen reader announces does not change either way.
   */
  revealCard: CardArt | null = null;
  /**
   * The run, folded as it goes.
   *
   * Not an array of every find: ALL is uncapped, so a deep purse is a run of
   * tens of thousands, and the reveal only ever shows a count, a tally, four
   * haul totals, the best find, the last find and — while the run is small
   * enough to draw them — the first `gridCap` cards. See `BatchTally`.
   */
  tally = new BatchTally<RuneFind>(RuneForgeComponent.GRID_CAP);
  landed = false;
  loreOpen = false;
  /** The scroll's prose, pre-split. Empty when the strike turned up no scroll. */
  scrollParagraphs: string[] = [];
  /**
   * Everything the last strike produced besides the rune — the minted
   * equippable, a scroll, an explorer, essence — as printable lines. The
   * service has always written these onto the find; the reveal now reads them.
   */
  haul: HaulLine[] = [];
  /** Counts across an Auto ×10 batch, for the one-line summary under the grid. */
  batchSummary: BatchHaul = { items: 0, scrolls: 0, explorers: 0, essence: 0 };
  /** True while a reveal is open. */
  striking = false;
  /**
   * Rolls made without leaving the reveal.
   *
   * The first pull of a sitting is the dramatic one; after that the player is
   * working a lever and the ceremony is in the way. The template turns this
   * into `.rf-pick--rapid`, which shortens the land and drops the sweep.
   */
  rollStreak = 0;
  /** True while a chunked bulk roll is still striking. */
  rolling = false;
  /** Strikes asked for and strikes made, for the progress line. */
  bulkTotal = 0;
  bulkDone = 0;
  /** True while auto-roll is pulling. */
  autoOn = false;
  /** Why auto-roll stopped, for the line under the buttons. Cleared on the next roll. */
  autoStopped: 'gold' | 'find' | null = null;
  /** Tier tally for a batch — "7 Common, 2 Uncommon, 1 Rare", best first. */
  batchTiers: BatchTier[] = [];
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private bulkTimer: ReturnType<typeof setTimeout> | null = null;
  /** The rune whose lore is open in the inventory, if any. */
  inspecting: Rune | null = null;
  /** Set when a strike is refused for want of Gold. Cleared on the next strike. */
  broke = false;

  /**
   * The painted forge, preloaded per breakpoint.
   *
   * Scoped to this route rather than declared in index.html: a global preload
   * would pull ~140KB of a single route's artwork on every page of the site,
   * which is the opposite of what a preload is for. Added from the component
   * so it lands in this route's prerendered HTML — the same arrangement the
   * homepage hero uses, and the reason both are removed again in ngOnDestroy.
   *
   * The media queries mirror the <picture> sources exactly. If they disagree,
   * the browser preloads one file and then downloads a different one.
   */
  private static readonly HERO_PRELOADS: ReadonlyArray<{ href: string; media: string }> = [
    { href: 'assets/images/runeforge-hero-768.webp',  media: '(max-width: 768px)' },
    { href: 'assets/images/runeforge-hero-1280.webp', media: '(min-width: 768.02px) and (max-width: 1280px)' },
    { href: 'assets/images/runeforge-hero-1536.webp', media: '(min-width: 1280.02px)' },
  ];

  private static readonly ART_ROUTE_CLASS = 'gf-art-route';

  /**
   * On <body> while a reveal is up, so the Forge Flame can stand down.
   *
   * The flame is `position: fixed; z-index: 940` with `.ff > * {
   * pointer-events: auto }`, and .rf-focus cannot simply out-rank it: the
   * routed host carries a transform from the route fade, which traps every
   * fixed descendant in that stacking context however high its z-index. So on
   * a 375px screen the flame paints over the roll buttons and takes their
   * clicks. Standing it down for the duration costs nothing — it is a shortcut
   * to the forge the player is already standing in.
   */
  private static readonly REVEAL_OPEN_CLASS = 'gf-reveal-open';

  /**
   * The turned card, so the celebration knows where on screen the rune came
   * from and can throw its rings and bolts at that point rather than at the
   * middle of the viewport.
   *
   * Read through a getter off the host rather than held in a @ViewChild because
   * the card only exists while `landed` is true, and a ViewChild queried once
   * would be stale by the second strike.
   */
  private get revealCardEl(): Element | null {
    if (!this.isBrowser) return null;
    return this.host.nativeElement.querySelector('.rf-pick__card.is-chosen');
  }

  /**
   * The rune's name split into characters for the letter-by-letter reveal.
   *
   * Precomputed on the find rather than split in the template: the binding runs
   * on every change-detection pass and the answer only changes when the rune
   * does. Empty for the tiers that do not earn the treatment, which is what the
   * template keys off.
   */
  revealLetters: string[] = [];

  ngOnInit(): void {
    this.forge.init();
    this.addHeroPreloads();
    // Switches off the site's CSS atmosphere — the body gradient, the nebula,
    // the starfield, the matrix layer, the pulsar, the corner runes and the
    // constellation canvas — for this route. All of it was the stand-in for
    // artwork this page now has, and running both is two forges at once.
    this.markArtRoute(true);
    if (!this.isBrowser) return;
    this.crafts.init();

    this.subs.add(this.forge.snapshot$.subscribe(snap => {
      this.cells = RUNES.map(rune => ({
        rune,
        tier: tierOf(rune.tier),
        held: snap.held[rune.id] ?? 0,
        known: (snap.held[rune.id] ?? 0) > 0 || this.forge.hasEverFound(rune.id),
        card: runeCard(rune.id),
      }));
      this.recipes = RUNEWORDS.map(word => this.buildRecipe(word));
      this.strikes = snap.strikes;
      this.goldSpent = snap.goldSpent;
      this.unique = snap.unique;
      this.craftedCount = snap.crafted.length;
      this.rarest = snap.rarest;
      this.collectionValue = snap.collectionValue;
      this.firstFound = snap.firstFound;
      const foundIds = Object.keys(snap.firstFound);
      if (this.seen.size === 0) this.seen = loadSeen(this.store, foundIds);
      this.cards = RUNES.map((rune, index) => {
        const known = rune.id in snap.firstFound;
        return {
          rune,
          known,
          isNew: known && !this.seen.has(rune.id),
          held: snap.held[rune.id] ?? 0,
          foundAt: snap.firstFound[rune.id] ?? null,
          index,
        };
      });
      this.cdr.markForCheck();
    }));

    this.subs.add(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
  }

  ngAfterViewInit(): void {
    this.watchDock();
  }

  heldOf(id: string): number {
    return this.inventory.stackOf(id);
  }

  inputReady(recipe: ForgeEquipmentRecipe): boolean {
    return recipe.inputs.every(input => this.heldOf(input.id) >= input.quantity);
  }

  missingLine(recipe: ForgeEquipmentRecipe): string {
    const missing = recipe.inputs
      .filter(input => this.heldOf(input.id) < input.quantity)
      .map(input => `${input.quantity} ${input.name} (${this.heldOf(input.id)})`);
    return missing.join(' · ');
  }

  craftEquipment(recipe: ForgeEquipmentRecipe): void {
    if (!recipe.craftable) return;
    const mutationId = this.pendingCraftId ?? newCraftId();
    this.pendingCraftId = mutationId;
    this.craftRecipeId = recipe.id;
    const result = this.crafts.craftBasaltEdge(mutationId);
    if (!result.ok) {
      this.craftError = result.code === 'ssr' || result.code === 'clock' ? 'persist' : result.code;
      this.lastCraft = null;
      if (result.code !== 'persist') this.pendingCraftId = null;
      this.cdr.markForCheck();
      return;
    }
    this.craftError = null;
    this.pendingCraftId = null;
    this.lastCraft = result.item;
    this.cdr.markForCheck();
  }

  retryCraft(recipe: ForgeEquipmentRecipe): void {
    this.craftEquipment(recipe);
  }

  private addHeroPreloads(): void {
    const head = this.doc.head;
    if (!head || head.querySelector('link[data-rf-hero]')) return;
    for (const p of RuneForgeComponent.HERO_PRELOADS) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('type', 'image/webp');
      link.setAttribute('media', p.media);
      link.setAttribute('href', p.href);
      link.setAttribute('data-rf-hero', '');
      head.appendChild(link);
    }
  }

  private removeHeroPreloads(): void {
    this.doc.head?.querySelectorAll('link[data-rf-hero]').forEach(el => el.remove());
  }

  private markArtRoute(add: boolean): void {
    const body = this.doc.body;
    if (!body) return;
    if (add) body.classList.add(RuneForgeComponent.ART_ROUTE_CLASS);
    else body.classList.remove(RuneForgeComponent.ART_ROUTE_CLASS);
  }

  private markRevealOpen(open: boolean): void {
    const body = this.doc.body;
    if (!body) return;
    if (open) body.classList.add(RuneForgeComponent.REVEAL_OPEN_CLASS);
    else body.classList.remove(RuneForgeComponent.REVEAL_OPEN_CLASS);
  }

  ngOnDestroy(): void {
    this.removeHeroPreloads();
    this.markArtRoute(false);
    this.markRevealOpen(false);
    this.subs.unsubscribe();
    this.dockWatch?.disconnect();
    // A bulk run or an auto-roll left pending would keep spending Gold on a
    // page the player has already left.
    this.stopRolling();
    // Navigating away mid-Mythic would otherwise leave five seconds of
    // Singular pinned over the page the player navigated to.
    this.celebration.cancel();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The anvil
  // ───────────────────────────────────────────────────────────────────────────

  get canStrike(): boolean {
    return this.isBrowser && !this.striking && this.gold >= STRIKE_COST;
  }

  get canAfford(): boolean {
    return this.gold >= STRIKE_COST;
  }

  get goldShort(): number {
    return Math.max(0, STRIKE_COST - this.gold);
  }

  get autoCost(): number {
    return STRIKE_COST * AUTO_ROLLS;
  }

  get autoShort(): number {
    return Math.max(0, this.autoCost - this.gold);
  }

  get canAuto(): boolean {
    return this.isBrowser && !this.striking && this.gold >= this.autoCost;
  }

  get batchNew(): number {
    return this.tally.newCount;
  }

  /** How many strikes the run has landed. Every `batch.length` the template
   *  used to ask for, in constant time. */
  get batchCount(): number {
    return this.tally.count;
  }

  /** The cards the grid may draw. Stops growing at `gridCap`. */
  get batchCards(): readonly RuneFind[] {
    return this.tally.cards;
  }

  /**
   * Which card reveal the landed rune earns — the tier table's `reveal` field,
   * which was authored with the ladder and consumed nowhere until now. Bound
   * as `data-reveal` on the pick so the CSS keys one treatment per rung.
   */
  get revealKind(): RuneTierDefinition['reveal'] {
    return this.revealTier?.reveal ?? 'plain';
  }

  /**
   * How many batch cards are worth drawing.
   *
   * Past this the grid becomes a wall of decoded thumbnails the player scrolls
   * through to reach the buttons, so a bigger run prints its tally and its
   * best find instead. Twelve covers ×10 with room to spare.
   */
  static readonly GRID_CAP = 12;
  readonly gridCap = RuneForgeComponent.GRID_CAP;

  /** The best find itself, for the big-run summary card. */
  get bestBatchFind(): RuneFind | null {
    return this.tally.best;
  }

  /** Where the best find sits in the drawn grid. Null outside a batch, and
   *  null once the run outgrows the grid — there is no card to mark. */
  get bestBatchIndex(): number | null {
    return this.tally.bestCardIndex;
  }

  get completePct(): number {
    return Math.round((this.unique / this.totalRunes) * 100);
  }

  get unseenCount(): number {
    return this.cards.filter(card => card.isNew).length;
  }

  get visibleCards(): LibraryCard[] {
    const filtered = filterCards(this.cards, this.filter, this.query, RUNEWORDS);
    const sorted = sortCards(filtered, this.sort);
    if (this.unique === 0) return sorted.filter(card => !card.known).slice(0, 8);
    return sorted;
  }

  get hiddenLocked(): number {
    return Math.max(0, this.totalRunes - this.visibleCards.length);
  }

  get sheet(): boolean {
    return this.isBrowser && window.matchMedia('(max-width: 768px)').matches;
  }

  /**
   * One strike.
   *
   * Deliberately not guarded on `striking`. That guard is what made a re-roll
   * a three-step gesture — dismiss the reveal, find the button, pull — and the
   * reveal has nothing left to protect: the rune is already banked by the time
   * it paints. Pulling again simply replaces what is on screen. `rolling` is
   * still a guard, because a bulk run owns the anvil until it finishes.
   */
  strike(): void {
    if (!this.isBrowser || this.rolling) return;

    this.broke = false;
    this.autoStopped = null;
    if (this.gold < STRIKE_COST) {
      this.broke = true;
      return;
    }

    const find = this.forge.strike();
    if (!find) {
      this.broke = true;
      return;
    }

    const tier = tierOf(find.rune.tier);
    this.audio.strike(tier.semitones);
    this.rollStreak += 1;
    this.striking = true;
    this.markRevealOpen(true);
    this.landed = false;
    this.loreOpen = false;
    this.tally = new BatchTally<RuneFind>(this.gridCap);
    this.batchTiers = [];
    this.reveal = find;
    this.revealTier = tier;
    this.revealCard = runeCard(find.rune.id);
    this.scrollParagraphs = find.scroll
      ? find.scroll.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
      : [];
    this.haul = haulOf(find);
    this.batchSummary = { items: 0, scrolls: 0, explorers: 0, essence: 0 };
    this.cdr.markForCheck();
    // The ledger has already written the rune. There is nothing left to decide,
    // so the reveal lands on the same tick the strike resolves.
    this.finishSpin();
  }

  /**
   * Roll `count` times without letting go of the frame.
   *
   * A strike costs 0.27ms on an empty bag and 1.18ms once the 250-row cap
   * starts evicting on every mint, measured in the built app — so a thousand
   * of them in one synchronous loop is well over a second of frozen tab on a
   * desktop, and several on a phone. The loop therefore runs on a time budget:
   * strike until BULK_FRAME_MS is spent, hand the frame back, resume. The
   * progress line and the Stop button are the point of doing it that way.
   */
  strikeMany(count = AUTO_ROLLS): void {
    if (!this.isBrowser || this.rolling) return;
    this.broke = false;
    this.autoStopped = null;
    this.stopAuto();

    const n = this.affordableRolls(count);
    if (n <= 0) {
      this.broke = true;
      this.cdr.markForCheck();
      return;
    }

    this.rolling = true;
    this.striking = true;
    this.markRevealOpen(true);
    this.landed = false;
    this.loreOpen = false;
    this.haul = [];
    this.scrollParagraphs = [];
    this.tally = new BatchTally<RuneFind>(this.gridCap);
    this.batchTiers = [];
    this.bulkTotal = n;
    this.bulkDone = 0;
    this.rollStreak += 1;
    this.cdr.markForCheck();
    this.bulkChunk();
  }

  /** Strike until this frame's budget is spent, then either finish or yield. */
  private bulkChunk(): void {
    let struck = 0;
    const started = this.now();
    while (this.bulkDone + struck < this.bulkTotal
        && this.now() - started < BULK_FRAME_MS) {
      const find = this.forge.strike();
      // Out of Gold mid-run, or the ledger refused. Bank what landed.
      if (!find) break;
      // Folded here rather than collected and concatenated after the loop.
      // `batch = batch.concat(finds)` copies the whole accumulated array once
      // per chunk, which is quadratic in the length of the run — invisible at
      // the old thousand-strike cap, and on the order of a hundred million
      // element copies once ALL is allowed to drain a deep purse.
      this.tally.add(find);
      struck++;
    }

    this.bulkDone = this.tally.count;
    const ranDry = struck === 0 || this.bulkDone >= this.bulkTotal;
    if (ranDry) {
      this.finishBulk();
      return;
    }
    this.cdr.markForCheck();
    this.bulkTimer = setTimeout(() => this.bulkChunk(), 0);
  }

  /** Land the batch: summary, tally, and the best find's sound and celebration. */
  private finishBulk(): void {
    this.bulkTimer = null;
    this.rolling = false;
    const last = this.tally.last;
    const best = this.tally.best;
    if (!last || !best) {
      this.broke = true;
      this.striking = false;
      this.markRevealOpen(false);
      this.bulkTotal = 0;
      this.cdr.markForCheck();
      return;
    }

    this.landed = true;
    this.reveal = last;
    this.revealTier = tierOf(last.rune.tier);
    this.revealCard = runeCard(last.rune.id);
    this.batchSummary = this.tally.haul();
    this.batchTiers = this.tally.tiers();
    if (best.rune.tier === 'singular') this.audio.voidRumble();
    else this.audio.runeReveal(tierOf(best.rune.tier).semitones, isHeavyTier(best.rune.tier));
    // The best thing in the run, not the last thing pulled: ten strikes that
    // ended on an Ash should still celebrate the Epic that was third.
    this.party(best.rune.tier);
    this.cdr.markForCheck();
  }

  /** Stop a bulk run where it stands. What already landed is already banked. */
  stopBulk(): void {
    if (!this.rolling) return;
    if (this.bulkTimer !== null) clearTimeout(this.bulkTimer);
    this.bulkTotal = this.bulkDone;
    this.finishBulk();
  }

  /**
   * Everything the purse can pay for, up to `count`.
   *
   * There used to be a third clamp here, `BULK_CAP`, at a thousand strikes.
   * It made ALL a lie: on a purse holding four hundred million Gold the button
   * said ALL, and spent two and a half percent of it. "Spend what I can
   * afford" is the whole contract of that button, so the cap is gone.
   *
   * What the cap was really protecting was the reveal keeping every find of
   * the run — see `BatchTally` for why that is no longer true. What is left is
   * wall-clock time, and that is handled rather than prevented: the run is
   * chunked against a frame budget so the tab never freezes, it prints a
   * progress line, and Stop banks what has landed and ends it. A long run is a
   * thing the player asked for and can call off; a frozen tab is not.
   *
   * The honest cost, measured in the built app: about 2ms per strike, so a
   * forty-thousand-strike purse is a run of minutes. Storage is only 6% of
   * that (131ms of 2,052ms across a thousand strikes) — the rest is what a
   * strike genuinely does: mint an item into a capped bag, roll a scroll,
   * record the collection, award XP and check achievements.
   */
  affordableRolls(count: number): number {
    return Math.max(0, Math.min(count, this.allRolls));
  }

  /** What the ALL button will actually roll: every strike the purse covers. */
  get allRolls(): number {
    return Math.max(0, Math.floor(this.gold / STRIKE_COST));
  }

  /**
   * The ALL button's label. Compact, because the honest number is five figures
   * on a deep purse and "×40000" does not fit the chip "×1000" was sized for.
   */
  get allRollsLabel(): string {
    return formatCompact(this.allRolls);
  }

  /**
   * Auto-roll: keep pulling until the Gold runs out or something worth
   * stopping for lands.
   *
   * Stopping on Rare is the whole point — an auto-roll that walked past the
   * find it was looking for would be a way to miss it, not a way to reach it.
   */
  toggleAuto(): void {
    if (this.autoOn) {
      this.stopAuto();
      this.cdr.markForCheck();
      return;
    }
    if (this.rolling) return;
    this.autoStopped = null;
    this.autoOn = true;
    this.autoStep();
  }

  private autoStep(): void {
    if (!this.autoOn) return;
    if (this.gold < STRIKE_COST) {
      this.autoOn = false;
      this.autoStopped = 'gold';
      this.broke = true;
      this.cdr.markForCheck();
      return;
    }

    this.strike();
    const tier = this.reveal?.rune.tier;
    if (tier && RUNE_TIER_ORDER.indexOf(tier) >= RUNE_TIER_ORDER.indexOf(AUTO_STOP_TIER)) {
      this.autoOn = false;
      this.autoStopped = 'find';
      this.cdr.markForCheck();
      return;
    }
    this.autoTimer = setTimeout(() => this.autoStep(), AUTO_STEP_MS);
  }

  private stopAuto(): void {
    this.autoOn = false;
    if (this.autoTimer !== null) clearTimeout(this.autoTimer);
    this.autoTimer = null;
  }

  private stopRolling(): void {
    this.stopAuto();
    if (this.bulkTimer !== null) clearTimeout(this.bulkTimer);
    this.bulkTimer = null;
    this.rolling = false;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  toggleLore(): void {
    if (!this.reveal?.scroll) return;
    this.loreOpen = !this.loreOpen;
    if (this.loreOpen) this.scrolls.markRead(this.reveal.scroll.id);
    this.cdr.markForCheck();
  }

  /** Close the reveal and hand the anvil back. */
  dismissFocus(): void {
    this.stopRolling();
    this.landed = false;
    this.striking = false;
    this.markRevealOpen(false);
    this.rollStreak = 0;
    this.bulkTotal = 0;
    this.bulkDone = 0;
    this.autoStopped = null;
    this.batchTiers = [];
    this.tally = new BatchTally<RuneFind>(this.gridCap);
    this.haul = [];
    this.loreOpen = false;
    this.revealLetters = [];
    // Dismissing the card takes its weather with it. A player who taps through
    // a Legendary to get back to the anvil has said they are done looking.
    this.celebration.cancel();
    this.cdr.markForCheck();
  }

  setTab(tab: LibraryTab): void {
    this.tab = tab;
    this.closeCard();
  }

  setFilter(filter: string): void {
    if (!(LIBRARY_FILTERS as readonly string[]).includes(filter)) return;
    this.filter = filter as LibraryFilter;
    this.tab = 'runes';
    this.cdr.markForCheck();
  }

  setSort(sort: string): void {
    if ((LIBRARY_SORTS as readonly string[]).includes(sort)) this.sort = sort as LibrarySort;
  }

  setQuery(value: string): void {
    this.query = value;
  }

  filterLabel(id: LibraryFilter): string {
    if (id === 'new') return `✦ ${this.t('forge.pill.new')}`;
    if (id === 'all') return this.t('forge.filter.all');
    return this.t('forge.filter.' + id);
  }

  libColor(tier: RuneTier): string {
    return LIB_COLOR[tier];
  }

  cardArt(card: LibraryCard): CardArt | null {
    return card.known ? runeCard(card.rune.id) : null;
  }

  runeCardOf(id: string): CardArt | null {
    return runeCard(id);
  }

  cardState(card: LibraryCard): string {
    if (!card.known) return this.t('forge.card.locked');
    if (card.isNew) return this.t('forge.card.new');
    if (card.held > 1) return this.t('forge.card.dup');
    return this.t('forge.card.found');
  }

  cardA11y(card: LibraryCard): string {
    if (!card.known) return this.t('forge.card.locked');
    return `${card.rune.name}, ${card.rune.tier}, ${this.cardState(card)}`;
  }

  openCard(card: LibraryCard): void {
    if (!card.known) return;
    this.detail = card;
    this.seen = markSeen(this.seen, card.rune.id);
    persistSeen(this.store, this.seen);
    this.cards = this.cards.map(row => row.rune.id === card.rune.id ? { ...row, isNew: false } : row);
    this.cdr.markForCheck();
  }

  closeCard(): void {
    this.detail = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.detail) this.closeCard();
    else if (this.landed) this.dismissFocus();
  }

  onDetailKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closeCard();
  }

  wordsFor(runeId: string): typeof RUNEWORDS[number][] {
    return wordsUsing(runeId, RUNEWORDS);
  }

  wordKnown(word: { runes: readonly string[] }): boolean {
    return word.runes.some(id => this.knownId(id));
  }

  wordProgress(word: { runes: readonly string[] }): string {
    const n = word.runes.filter(id => this.knownId(id)).length;
    return `${n} / ${word.runes.length}`;
  }

  wordFound(row: RecipeRow): number {
    return row.slots.filter(slot => this.knownId(slot.rune.id)).length;
  }

  knownId(id: string): boolean {
    return id in this.firstFound;
  }

  private watchDock(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    const el = this.rollAnchor?.nativeElement;
    if (!el) return;
    this.dockWatch = new IntersectionObserver(entries => {
      this.showDock = entries.some(entry => !entry.isIntersecting);
      this.cdr.markForCheck();
    }, { threshold: 0 });
    this.dockWatch.observe(el);
  }

  private finishSpin(): void {
    if (this.landed || !this.reveal || !this.revealTier) return;
    this.landed = true;
    const find = this.reveal;
    const tier = this.revealTier;
    if (find.rune.tier === 'singular') {
      this.audio.voidRumble();
    } else {
      this.audio.runeReveal(tier.semitones, isHeavyTier(find.rune.tier));
    }
    if (find.scroll) this.audio.scrollUnfurl();
    this.party(find.rune.tier);
    this.cdr.markForCheck();
  }

  /**
   * Hand the landed tier to the screen-level celebration.
   *
   * Deferred one frame: the card element the effects radiate from is written
   * by the same change-detection pass that sets `landed`, so measuring it now
   * would measure either nothing or the previous card's box. One frame later
   * it is on screen and `getBoundingClientRect` has something true to say.
   *
   * The letters are set here rather than in the template for the same reason
   * the cells are: a split in a binding runs on every pass to produce a value
   * that only changes when the rune does.
   */
  private party(tier: RuneTier): void {
    if (!this.isBrowser) return;
    this.revealLetters = this.celebration.letters(tier) && this.reveal
      ? [...this.reveal.rune.name]
      : [];
    requestAnimationFrame(() => {
      this.celebration.celebrate(tier, this.revealCardEl);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Inventory and crafting
  // ───────────────────────────────────────────────────────────────────────────

  craft(row: RecipeRow): void {
    if (!row.ready) return;
    if (!this.forge.craft(row.word.id)) return;
    // The word is heavier than any single rune, so it gets the heavy cue
    // regardless of which tier the recipe is filed under.
    this.audio.runeReveal(tierOf(row.word.tier).semitones, true);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Template helpers
  // ───────────────────────────────────────────────────────────────────────────

  money(n: number): string { return formatCurrency(n); }

  /** The published chance of a rune, as a readable percentage. */
  chance(rune: Rune): string {
    const pct = rune.dropRate * 100;
    // A fixed number of decimals would print "0.1%" for Void and "12.0%" for
    // Ash. Three orders of magnitude apart deserve different precision.
    if (pct >= 10) return `${pct.toFixed(0)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    if (pct >= 0.1) return `${pct.toFixed(2)}%`;
    return `${pct.toFixed(3)}%`;
  }

  cellsOf(tier: RuneTier): RuneCell[] {
    return this.cells.filter(c => c.rune.tier === tier);
  }

  trackCell = (_: number, cell: RuneCell) => cell.rune.id;
  trackRecipe = (_: number, row: RecipeRow) => row.word.id;
  trackTier = (_: number, tier: RuneTier) => tier;
  trackSlot = (i: number) => i;

  // ───────────────────────────────────────────────────────────────────────────

  private blankRecipe(word: Runeword): RecipeRow {
    return {
      word,
      tier: tierOf(word.tier),
      slots: word.runes.map(id => ({ rune: runeById(id)!, held: 0, satisfied: false })),
      crafted: false,
      ready: false,
      // Hidden until at least one of its runes has been seen, so the wall reads
      // as something to uncover rather than as a checklist handed over on
      // arrival. The names stay hidden; the shape of the recipe does not.
      hidden: true,
      // Null while hidden for the same reason the name is "???": the painted
      // card has the word's name across the top of it, so showing the art is
      // showing the answer.
      card: null,
    };
  }

  private buildRecipe(word: Runeword): RecipeRow {
    // Counted down across the slots so a recipe that wants two of a rune shows
    // the first slot satisfied and the second not, rather than both satisfied
    // off a single copy.
    const remaining = new Map<string, number>();
    const slots = word.runes.map(id => {
      const rune = runeById(id)!;
      const used = remaining.get(id) ?? 0;
      const held = this.forge.countOf(id);
      remaining.set(id, used + 1);
      return { rune, held, satisfied: held > used };
    });

    const crafted = this.forge.hasCrafted(word.id);
    const hidden = !crafted && !word.runes.some(id => this.forge.hasEverFound(id));
    return {
      word,
      tier: tierOf(word.tier),
      slots,
      crafted,
      ready: !crafted && slots.every(s => s.satisfied),
      hidden,
      card: hidden ? null : runewordCard(word.id),
    };
  }
}

const LIB_COLOR: Record<RuneTier, string> = {
  common: '#8E98A5',
  uncommon: '#4DB6AC',
  rare: '#4C8DFF',
  epic: '#A66CFF',
  legendary: '#E4A83A',
  mythic: '#E95757',
  singular: '#EDE7D8',
};

function newCraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `craft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
