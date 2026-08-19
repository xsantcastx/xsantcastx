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
import { formatCurrency } from '../economy/economy.model';
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
import { AUTO_ROLLS } from './rune-reel';
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
import { batchHaul, haulOf, isHeavyTier, type BatchHaul, type HaulLine } from './rune-haul';
import { InspectButtonComponent } from '../entity/inspect-button.component';
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
  imports: [CommonModule, RouterLink, InspectButtonComponent],
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

  private flareTimer: ReturnType<typeof setTimeout> | null = null;

  readonly strikeCost = STRIKE_COST;
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
  batch: RuneFind[] = [];
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

  ngOnDestroy(): void {
    this.removeHeroPreloads();
    this.markArtRoute(false);
    this.subs.unsubscribe();
    this.dockWatch?.disconnect();
    if (this.flareTimer !== null) clearTimeout(this.flareTimer);
    // Navigating away mid-Mythic would otherwise leave the whole site under a
    // red wash until the next reload.
    if (this.isBrowser) delete document.documentElement.dataset['runeFlare'];
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
    return this.batch.filter(find => find.isNew).length;
  }

  /**
   * Which card reveal the landed rune earns — the tier table's `reveal` field,
   * which was authored with the ladder and consumed nowhere until now. Bound
   * as `data-reveal` on the pick so the CSS keys one treatment per rung.
   */
  get revealKind(): RuneTierDefinition['reveal'] {
    return this.revealTier?.reveal ?? 'plain';
  }

  /** The best find in the batch, so the grid can mark it. Null outside a batch. */
  get bestBatchIndex(): number | null {
    if (!this.batch.length) return null;
    let best = 0;
    for (let i = 1; i < this.batch.length; i++) {
      if (RUNE_TIER_ORDER.indexOf(this.batch[i].rune.tier) > RUNE_TIER_ORDER.indexOf(this.batch[best].rune.tier)) {
        best = i;
      }
    }
    return best;
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

  strike(): void {
    if (!this.isBrowser || this.striking) return;

    this.broke = false;
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
    this.striking = true;
    this.landed = false;
    this.loreOpen = false;
    this.batch = [];
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

  strikeMany(count = AUTO_ROLLS): void {
    if (!this.isBrowser || this.striking) return;
    this.broke = false;
    if (this.gold < STRIKE_COST * count) {
      this.broke = true;
      return;
    }

    const finds: RuneFind[] = [];
    for (let i = 0; i < count; i++) {
      const find = this.forge.strike();
      if (!find) break;
      finds.push(find);
    }
    if (!finds.length) {
      this.broke = true;
      return;
    }

    const last = finds[finds.length - 1];
    const best = finds.reduce((acc, find) =>
      RUNE_TIER_ORDER.indexOf(find.rune.tier) > RUNE_TIER_ORDER.indexOf(acc.rune.tier) ? find : acc, last);
    this.audio.strike(tierOf(best.rune.tier).semitones);
    this.striking = true;
    this.landed = true;
    this.loreOpen = false;
    this.batch = finds;
    this.reveal = last;
    this.revealTier = tierOf(last.rune.tier);
    this.revealCard = runeCard(last.rune.id);
    this.scrollParagraphs = [];
    this.haul = [];
    this.batchSummary = batchHaul(finds);
    if (best.rune.tier === 'singular') this.audio.voidRumble();
    else this.audio.runeReveal(tierOf(best.rune.tier).semitones, isHeavyTier(best.rune.tier));
    this.flare(best.rune.tier, tierOf(best.rune.tier).duration);
    this.cdr.markForCheck();
  }

  toggleLore(): void {
    if (!this.reveal?.scroll) return;
    this.loreOpen = !this.loreOpen;
    if (this.loreOpen) this.scrolls.markRead(this.reveal.scroll.id);
    this.cdr.markForCheck();
  }

  /** Close the reveal and hand the anvil back. */
  dismissFocus(): void {
    this.landed = false;
    this.striking = false;
    this.batch = [];
    this.haul = [];
    this.loreOpen = false;
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
    this.flare(find.rune.tier, tier.duration);
    this.cdr.markForCheck();
  }

  /**
   * Hand the top three tiers to the screen-level flare in styles.css.
   *
   * Written as a data attribute on <html> rather than as a layer inside this
   * component because a fixed layer authored here would be trapped by the
   * routed host's transform — see the note in the template and in styles.css.
   *
   * The clear is scheduled off the tier's own `duration`, and the attribute is
   * removed rather than reset to a falsy value so that two Mythics in a row
   * restart the animation instead of the second one being swallowed by the
   * still-running first.
   */
  private flare(tier: RuneTier, ms: number): void {
    if (!this.isBrowser) return;
    if (RUNE_TIER_ORDER.indexOf(tier) < RUNE_TIER_ORDER.indexOf('legendary')) return;

    const root = document.documentElement;
    if (this.flareTimer !== null) clearTimeout(this.flareTimer);
    delete root.dataset['runeFlare'];
    // Re-read a layout property so the removal and the re-add are not coalesced
    // into a no-op by the style system, which would leave a repeat find with no
    // flare at all.
    void root.offsetWidth;
    root.dataset['runeFlare'] = tier;

    this.flareTimer = setTimeout(() => {
      delete root.dataset['runeFlare'];
      this.flareTimer = null;
    }, ms);
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
