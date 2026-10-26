/**
 * crafting-bench.component.ts — the anvil, the recipe wall, and the ladder.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR
 * ─────────────────────────────────────────────────────────────────────────────
 * The recipe wall is built at construction from `CRAFTING_RECIPES`, which is
 * pure data, so the prerendered HTML is the complete catalogue with every
 * ingredient list, every Gold price and every level gate already in it — a
 * crawler and a player on a cold cache see the same page. `ngOnInit` runs
 * browser-only and its whole job is filling in what you own: held counts, your
 * crafting level, your Gold. Same ordering as the Collection Log, for the same
 * reason.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE ANVIL HAS TO BE LOADED BEFORE IT CAN BE STRUCK
 * ─────────────────────────────────────────────────────────────────────────────
 * Owning the materials is not the same as having put them on the anvil, and the
 * two-step is the interaction: drag a material tile onto its slot, or press the
 * slot's Load button, or load the lot at once. It costs a player one press and
 * it buys three things — a legible "this is what goes in", a place for a
 * drag-and-drop affordance to mean something, and a hard stop between deciding
 * to spend two hundred thousand Gold and spending it.
 *
 * Loading is pure UI state. Nothing is reserved, nothing is written, and
 * navigating away loses only the arrangement. See the header of
 * the crafting model's header for why craftTime works the same way.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * Drag is an enhancement and never the only path: every slot carries a real
 * button, every control clears 44px, the strike announces itself through an
 * `aria-live` region, and `prefers-reduced-motion` replaces the anvil animation
 * with a static held state rather than removing the feedback.
 */
import { injectHomeForge, injectInWorldFocus, injectInWorldPanel } from '../in-world-panel';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  InjectionToken,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { artFor, type ArtEntry } from '../art/art';
import { CelebrationService } from '../celebration/celebration.service';
import { EconomyService } from '../economy/economy.service';
import { FIVE_REALMS, type NarrativeRealmId } from '../narrative/five-realms.narrative';
import { InventoryService } from '../rpg/inventory.service';
import {
  itemDefinitionById,
  statCeiling,
  type ItemDefinition,
  type ItemStatKey,
} from '../rpg/item-definition';
import { formatQuality, qualityOf } from '../rpg/item-quality';
import type { GameItem, ItemRarity } from '../rpg/item.model';
import { materialDisplay } from '../rpg/material-catalog';
import { RUNE_TIERS, RUNE_TIER_ORDER, runeById } from '../rune-forge/rune.model';
import { runeCard } from '../rune-forge/rune-cards';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import {
  STATION_UI,
  STATION_UI_I18N,
  forgeTabs,
  isAffordable,
  maxAffordable,
  type JournalRow,
  type StationCost,
  type StationReward,
  type StationTab,
} from '../station-ui';
import { CRAFTING_I18N } from './crafting.i18n';
import { TranslationService } from '../../translation.service';
import { CraftingGateway, type CraftReject } from './crafting.gateway';
import { CraftingService } from './crafting.service';
import {
  CRAFTING_CATEGORIES,
  CRAFTING_RECIPES,
  recipesAt,
  type CraftStation,
  MASTERY_THRESHOLD,
  MAX_CRAFTING_LEVEL,
  craftXpFor,
  craftingLevelView,
  masteryProgress,
  type CraftingCategory,
  type CraftingIngredient,
  type CraftingLevelView,
  type CraftingRecipe,
} from './crafting.model';

import { ForgeFloorComponent } from '../forge-floor/forge-floor.component';
import { AnvilGameComponent } from '../minigames/anvil-game.component';
import { anvilRng } from '../minigames/anvil.model';
import { MINIGAMES_I18N } from '../minigames/minigames.i18n';
import { SkillActionService, craftSkillXp } from '../skills/skill-actions.service';
import { toolCard, toolCardLines } from '../skills/tools';
import { TOOLS_I18N } from '../skills/tools.i18n';
import { ActivityProgressionGateway } from '../activity/activity-progression.gateway';
import { floorThing, type ForgeFloorEvent, type ForgeFloorThing } from '../forge-floor/forge-floor.model';
import { WorldFeelBus } from '../sound/world-feel.bus';
/** One ingredient, as the anvil renders it. */
export interface SlotView {
  materialId: string;
  name: string;
  need: number;
  have: number;
  art: ArtEntry | null;
  enough: boolean;
}

/** One recipe card on the wall. */
interface RecipeCard {
  recipe: CraftingRecipe;
  def: ItemDefinition | undefined;
  art: ArtEntry | null;
  /** Materials owned / materials needed, summed across ingredients. */
  ready: boolean;
  levelOk: boolean;
  crafted: number;
  mastered: boolean;
  known: boolean;
}

const REJECT_COPY: Readonly<Record<CraftReject, string>> = {
  ssr: 'The bench is not lit yet. Give it a moment.',
  'unknown-recipe': 'The Archivum has no such pattern on file.',
  level: 'Your hands are not steady enough for this one yet.',
  locked: 'A Delve mission teaches this pattern. Find it on the Quest Board.',
  missing: 'The anvil is short of materials.',
  funds: 'Not enough Gold to pay the bench.',
  capacity: 'Your satchel has no room for what this makes.',
  mint: 'The pattern named something the catalogue does not have.',
  persist: 'The strike did not save. Nothing was spent — try again.',
};

/** Radius of the level dial, for the dash offset. */
const DIAL_R = 46;

/** Which station a bench serves (crafting.model recipeStation). Absent: Kael's Anvil. */
export const CRAFT_STATION = new InjectionToken<CraftStation>('CRAFT_STATION');

@Component({
  selector: 'app-crafting-bench',
  standalone: true,
  imports: [ForgeFloorComponent, AnvilGameComponent, CommonModule, FormsModule, ...STATION_UI],
  templateUrl: './crafting-bench.component.html',
  styleUrls: ['./crafting-bench.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CraftingBenchComponent implements OnInit, OnDestroy {
  /** Rendered as a place inside /play: the panel carries the title, so the hero and room links stand down. */
  protected readonly inWorld = injectInWorldPanel();
  /** 'ready' at a camp in the Delve: the journal opens on what can be made now. */
  private readonly focus = injectInWorldFocus();
  /** Present only at the player's own Homestead anvil: its tier shapes the anvil game. */
  private readonly home = injectHomeForge();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gateway = inject(CraftingGateway);
  private readonly crafting = inject(CraftingService);
  private readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);
  private readonly economy = inject(EconomyService);
  private readonly celebration = inject(CelebrationService);
  /** Tells the world view (when there is one) what was made, so it can fly it to the Satchel. */
  private readonly feel = inject(WorldFeelBus);
  private readonly skills = inject(SkillActionService);
  private readonly i18n = inject(TranslationService);
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /**
   * The anvil mini-game is open for this recipe. Nothing has been spent: the
   * gateway is called only when the game reports back (see onAnvilDone).
   */
  anvilRecipe: CraftingRecipe | null = null;
  /** The anvil tier the open game plays at: 1 (today's game) unless opened from the Homestead. */
  anvilTier = 1;

  /** "Skip the anvil game" — kept for the session (module state, never saved). */
  get skipAnvil(): boolean { return skipAnvilGame; }
  set skipAnvil(value: boolean) { skipAnvilGame = !!value; }

  private subs: Subscription[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly categories = CRAFTING_CATEGORIES;
  readonly realms = FIVE_REALMS;
  readonly tiers = RUNE_TIERS;
  readonly rarityOrder = RUNE_TIER_ORDER;
  readonly maxLevel = MAX_CRAFTING_LEVEL;
  readonly masteryThreshold = MASTERY_THRESHOLD;
  readonly dialCircumference = 2 * Math.PI * DIAL_R;
  readonly dialR = DIAL_R;
  /** Which station's recipes this bench shows (crafting.model recipeStation): Kael's Anvil by default. */
  protected readonly station: CraftStation = inject(CRAFT_STATION, { optional: true }) ?? 'anvil';
  protected get recipes(): readonly CraftingRecipe[] { return recipesAt(this.station); }
  get totalRecipes(): number { return this.recipes.length; }

  // ── Filters ────────────────────────────────────────────────────────────────
  categoryFilter: CraftingCategory | 'all' = 'all';
  realmFilter: NarrativeRealmId | 'all' | 'unaligned' = 'all';
  rarityFilter: ItemRarity | 'all' = 'all';
  /** 'all' | 'ready' (everything on hand) | 'known' (crafted before). */
  statusFilter: 'all' | 'ready' | 'known' = 'all';
  search = '';

  // ── State ──────────────────────────────────────────────────────────────────
  hydrated = false;
  gold = 0;
  level: CraftingLevelView = craftingLevelView(0);
  discovered = 0;
  mastered = 0;

  cards: RecipeCard[] = [];
  selected: CraftingRecipe | null = null;
  slots: SlotView[] = [];

  /** True once the player picked a recipe themselves; until then we pick the best one for them. */
  private userPicked = false;

  // ── The big button, rebuilt on every refresh / pick ────────────────────────
  // ── The journal (tabs → list → detail) ─────────────────────────────────────
  readonly forgeTabs: StationTab[];
  /** 'ready' (what you can make now) · 'all' · a category id. */
  journalTab = 'ready';
  journalTabs: StationTab[] = [];
  journalRows: JournalRow[] = [];
  readyCount = 0;
  /** Required tools: the bench itself. Always met — shown so the page reads like every other station. */
  readonly tools: StationCost[];
  quantity = 1;
  allCount = 0;
  /** Crafts still to run from a "Craft 3" / "Craft all" press. */
  private queue = 0;
  private queueTotal = 0;
  ctaCosts: StationCost[] = [];
  ctaBlocked: string | null = null;
  ctaProgress: number | null = null;
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  reward: StationReward | null = null;
  private rewardSeq = 0;
  detailsOpen = false;

  /** Set while a craft with a `craftTime` is running down. */
  striking = false;
  strikeRemaining = 0;
  strikePercent = 0;

  /** The last thing that came off the anvil, and the last refusal. */
  lastCraft: { items: GameItem[]; recipe: CraftingRecipe; quality: number | null; mastered: boolean } | null = null;
  error: string | null = null;
  announce = '';

  /** The forge floor's latest event — set only after the ledger has answered. */
  floorEvent: ForgeFloorEvent | null = null;
  private floorSeq = 0;
  private floorStockFor: SlotView[] | null = null;
  private floorStockCache: ForgeFloorThing[] = [];

  /** The selected recipe's materials, for the floor's stockpile. Cached per slot build. */
  get floorStock(): ForgeFloorThing[] {
    if (this.floorStockFor !== this.slots) {
      this.floorStockFor = this.slots;
      this.floorStockCache = this.slots.map(slot => ({ id: slot.materialId, name: slot.name, art: slot.art }));
    }
    return this.floorStockCache;
  }

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(CRAFTING_I18N);
    this.i18n.register(TOOLS_I18N);
    this.i18n.register(MINIGAMES_I18N);
    this.forgeTabs = forgeTabs(key => this.t(key));
    this.selected = this.recipes[0] ?? null;
    this.tools = [{ kind: 'item', id: 'iron-hammer', label: this.t('crafting.tool.anvil'), need: 0, have: 0, art: artFor('iron-hammer') }];
    this.cards = this.buildCards();
    this.slots = this.buildSlots();
    // The price and the catalogue are pure data, so they are in the prerendered HTML too.
    this.journalTab = 'all';
    this.buildJournal();
    this.buildCta();
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.gateway.init();

    this.subs.push(this.inventory.snapshot$.subscribe(() => {
      this.hydrated = true;
      this.refresh();
    }));
    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.buildCta();
      this.cdr.markForCheck();
    }));
    this.subs.push(this.crafting.snapshot$.subscribe(snap => {
      this.level = snap.level;
      this.discovered = snap.discovered;
      this.mastered = snap.mastered;
      this.refresh();
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ── Copy ───────────────────────────────────────────────────────────────────

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  // ── Derived ────────────────────────────────────────────────────────────────

  get visible(): RecipeCard[] {
    const q = this.search.trim().toLowerCase();
    return this.cards.filter(card => {
      if (this.categoryFilter !== 'all' && card.recipe.category !== this.categoryFilter) return false;
      if (this.rarityFilter !== 'all' && card.recipe.rarity !== this.rarityFilter) return false;
      if (this.realmFilter === 'unaligned' && card.recipe.realm) return false;
      if (this.realmFilter !== 'all' && this.realmFilter !== 'unaligned' && card.recipe.realm !== this.realmFilter) return false;
      if (this.statusFilter === 'ready' && !(card.ready && card.levelOk)) return false;
      if (this.statusFilter === 'known' && !card.known) return false;
      if (!q) return true;
      return (
        card.recipe.name.toLowerCase().includes(q) ||
        card.recipe.blurb.toLowerCase().includes(q) ||
        card.recipe.ingredients.some(row => materialName(row.materialId).toLowerCase().includes(q))
      );
    });
  }

  get selectedCard(): RecipeCard | null {
    if (!this.selected) return null;
    return this.cards.find(card => card.recipe.id === this.selected!.id) ?? null;
  }

  get blocker(): CraftReject | null {
    if (!this.selected || !this.isBrowser || !this.hydrated) return null;
    return this.gateway.blocker(this.selected);
  }

  get blockerCopy(): string | null {
    const code = this.blocker;
    return code ? REJECT_COPY[code] : null;
  }

  get canCraft(): boolean {
    return this.isBrowser && this.hydrated && !this.striking && !this.blocker;
  }

  /** A tool recipe's card: power, pace, what it opens, the skill cap, and that it works from the satchel. */
  toolLines(recipe: { output: { itemId: string } }): string[] {
    const card = toolCard(recipe.output.itemId, this.activity.snapshot.progress);
    return card ? [...toolCardLines(card, (key, vars) => this.t(key, vars)), this.t('toolStat.fromSatchel')] : [];
  }

  /** The stat line the output can reach at this tier, for the preview. */
  previewStats(): { key: ItemStatKey; label: string; ceiling: number }[] {
    const card = this.selectedCard;
    if (!card?.def || !this.selected) return [];
    return card.def.rollKeys.map(key => ({
      key,
      label: STAT_LABELS[key] ?? key,
      ceiling: Math.round(statCeiling(card.def!, this.selected!.rarity, key) * 10) / 10,
    }));
  }

  masteryOf(recipe: CraftingRecipe) {
    return masteryProgress(this.crafting.craftedCount(recipe.id));
  }

  xpFor(recipe: CraftingRecipe): number { return craftXpFor(recipe); }

  rarityColor(rarity: ItemRarity): string { return RUNE_TIERS[rarity]?.color ?? '#8f98a8'; }
  rarityGlow(rarity: ItemRarity): string { return RUNE_TIERS[rarity]?.glow ?? 'rgba(143,152,168,0.5)'; }
  rarityLabel(rarity: ItemRarity): string { return RUNE_TIERS[rarity]?.label ?? rarity; }

  realmLabel(id: NarrativeRealmId | undefined): string {
    if (!id) return 'Unaligned';
    return FIVE_REALMS.find(realm => realm.id === id)?.name ?? id;
  }

  /** Display name for a material stack key. Never the raw id. */
  materialName(id: string): string { return materialName(id); }

  /** What the Keeper holds of one ingredient: a bag stack, or a Forge rune in the ledger. */
  private haveOf(row: CraftingIngredient): number {
    return row.rune ? this.runes.countOf(row.materialId) : this.inventory.stackOf(row.materialId);
  }

  qualityOf(item: GameItem): string {
    const q = qualityOf(item);
    return q == null ? '' : formatQuality(q);
  }

  get dialOffset(): number {
    const pct = this.level.maxed ? 100 : this.level.percent;
    return this.dialCircumference * (1 - pct / 100);
  }

  trackCard = (_: number, card: RecipeCard) => card.recipe.id;
  trackSlot = (_: number, slot: SlotView) => slot.materialId;
  trackItem = (_: number, item: GameItem) => item.id;

  // ── Selection ──────────────────────────────────────────────────────────────

  /**
   * Pick a recipe. From the recipe book in Details, bring the big button back
   * into view so the pick visibly lands somewhere.
   */
  /** A row in the journal list. */
  pickRow(id: string): void {
    const card = this.cards.find(c => c.recipe.id === id);
    if (card) this.select(card.recipe);
  }

  setJournalTab(id: string): void {
    this.userPicked = true;
    this.journalTab = id;
    this.buildJournal();
    const first = this.journalRows[0];
    if (first && !this.journalRows.some(row => row.id === this.selected?.id)) this.pickRow(first.id);
    this.cdr.markForCheck();
  }

  select(recipe: CraftingRecipe, fromBook = false): void {
    if (this.striking) return;
    // Walking away from the anvil mid-game is free: nothing was spent yet.
    this.anvilRecipe = null;
    this.userPicked = true;
    this.quantity = 1;
    this.selected = recipe;
    this.error = null;
    this.reward = null;
    this.lastCraft = null;
    this.slots = this.buildSlots();
    this.buildCta();
    this.cdr.markForCheck();
    if (fromBook && this.inWorld) this.detailsOpen = false; // picking from the book in the help card returns to the bench
    if (fromBook && this.isBrowser) {
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.host.nativeElement.querySelector('.cb-hero')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /**
   * The big button's price and "why not". Gold first — it is what players are
   * most often short of — then each material. `level` and `capacity` are not
   * money, so they become a plain sentence instead; `funds`/`missing` are the
   * chips' job. The gateway still decides on press, exactly as before.
   */
  private buildCta(): void {
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: this.gold, have: this.gold };
    const recipe = this.selected;
    if (!recipe) { this.ctaCosts = []; this.ctaBlocked = null; this.ctaProgress = null; return; }
    this.ctaCosts = this.costsOf(recipe);
    const code = this.blocker;
    this.allCount = code === 'level' || code === 'capacity' ? 0 : maxAffordable(this.ctaCosts);
    if (code === 'level') {
      const need = recipe.requiredLevel ?? 1;
      // Smithing-gated recipes climb the Smithing skill, not the bench ladder.
      const smithing = recipe.skill === 'smithing', fishing = recipe.skill === 'fishing';
      this.ctaBlocked = this.t(smithing ? 'crafting.why.smithing' : fishing ? 'crafting.why.fishing' : 'crafting.why.level', { n: need });
      const have = smithing ? this.crafting.smithingLevel() : fishing ? this.crafting.fishingLevel() : this.level.level;
      this.ctaProgress = Math.min(1, have / need);
    } else if (code === 'capacity') {
      this.ctaBlocked = this.t('crafting.why.bag');
      this.ctaProgress = null;
    } else if (code && code !== 'funds' && code !== 'missing' && code !== 'ssr') {
      this.ctaBlocked = REJECT_COPY[code];
      this.ctaProgress = null;
    } else {
      this.ctaBlocked = null;
      this.ctaProgress = null;
    }
  }

  private costsOf(recipe: CraftingRecipe): StationCost[] {
    const browser = this.isBrowser && this.hydrated;
    return [
      { kind: 'gold', label: this.t('stationUi.gold'), need: recipe.goldCost, have: this.gold },
      ...recipe.ingredients.map(row => ({
        kind: 'material' as const,
        id: row.materialId,
        label: materialName(row.materialId),
        need: row.count,
        have: browser ? this.haveOf(row) : 0,
        art: ingredientArt(row),
      })),
    ];
  }

  /**
   * The journal: tabs (Ready now · All · categories), then the rows of the
   * active tab. "Ready now" is "what can I make right now?" — recipes your
   * level, bag and purse all cover, best rarity first. It is the default tab
   * whenever it has anything in it, and its first row is the default pick.
   */
  private buildJournal(): void {
    const browser = this.isBrowser && this.hydrated;
    const order = (r: ItemRarity) => RUNE_TIER_ORDER.indexOf(r);
    const ready = browser
      ? this.cards.filter(card => card.levelOk && isAffordable(this.costsOf(card.recipe)))
        .sort((a, b) => order(b.recipe.rarity) - order(a.recipe.rarity))
      : [];
    this.readyCount = ready.length;
    this.journalTabs = [
      { id: 'ready', label: this.t('crafting.tab.ready'), badge: ready.length || null },
      { id: 'all', label: this.t('crafting.all') },
      ...this.categories.filter(cat => this.cards.some(card => card.recipe.category === cat.id)).map(cat => ({ id: cat.id, label: cat.label })),
    ];
    if (browser && !this.userPicked) this.journalTab = ready.length || this.focus === 'ready' ? 'ready' : 'all';
    const readyIds = new Set(ready.map(card => card.recipe.id));
    const cards = this.journalTab === 'ready' ? ready
      : this.journalTab === 'all' ? this.cards
      : this.cards.filter(card => card.recipe.category === this.journalTab);
    this.journalRows = cards.map(card => ({
      id: card.recipe.id,
      name: card.recipe.name,
      art: card.art,
      rarity: card.recipe.rarity,
      sub: `${this.t('stationUi.level')} ${card.recipe.requiredLevel ?? 1}`,
      locked: browser && !card.levelOk,
      ready: readyIds.has(card.recipe.id),
    }));
    if (browser && !this.userPicked && cards[0]) {
      this.selected = cards[0].recipe;
      this.slots = this.buildSlots();
    }
  }

  /** "Craft 1 Briarvein Kris" — the detail header's one line. */
  craftLine(): string {
    return this.selected ? this.t('crafting.craftN', { n: this.quantity, name: this.selected.name }) : '';
  }

  /** Whether this recipe's output has rolled stats — i.e. whether the anvil game can change anything. */
  hasRolls(recipe: CraftingRecipe | null): boolean {
    if (!recipe) return false;
    return (itemDefinitionById(recipe.output.itemId)?.rollKeys.length ?? 0) > 0;
  }

  /**
   * The primary button. One piece of equipment with the game on → the anvil
   * game; anything else (a batch, a consumable, the game skipped) → today's craft.
   */
  craftOne(n: number): void {
    const recipe = this.selected;
    if (n === 1 && recipe && !this.skipAnvil && this.hasRolls(recipe) && this.canCraft) {
      this.error = null;
      this.reward = null;
      this.lastCraft = null;
      this.anvilTier = this.home?.anvilTier() ?? 1;
      this.anvilRecipe = recipe;
      this.announce = this.t('minigame.anvil.how');
      this.cdr.markForCheck();
      return;
    }
    this.craftMany(n);
  }

  /**
   * The anvil game reported. `null` = skipped: craft exactly as before (no
   * bonus). A number = the strike quality: bias the mint's RNG within the band
   * (anvil.model) and pay Smithing XP through the skills hook.
   */
  onAnvilDone(quality: number | null): void {
    const recipe = this.anvilRecipe;
    this.anvilRecipe = null;
    if (!recipe || this.selected?.id !== recipe.id || !this.canCraft) {
      this.cdr.markForCheck();
      return;
    }
    if (quality === null) {
      this.craftMany(1);
      return;
    }
    this.queue = 0;
    this.queueTotal = 1;
    this.error = null;
    this.lastCraft = null;
    // The game was the work: settle now, with the anvil's quality, and feed the
    // floor the materials in the same event.
    this.settle(recipe, quality, false);
  }

  /** The stepper / Craft all: run the same single craft `n` times, one after another. */
  craftMany(n: number): void {
    if (!this.canCraft || n < 1) return;
    this.queueTotal = n;
    this.queue = n - 1;
    this.craft();
  }

  isReady(card: RecipeCard): boolean {
    return card.levelOk && card.ready && this.gold >= card.recipe.goldCost;
  }

  // ── The strike ─────────────────────────────────────────────────────────────

  craft(): void {
    if (!this.canCraft || !this.selected) return;
    const recipe = this.selected;
    const seconds = recipe.craftTime ?? 0;
    this.error = null;
    this.lastCraft = null;

    if (seconds <= 0) {
      this.settle(recipe);
      return;
    }

    this.striking = true;
    this.reward = null;
    // The materials ride onto the anvil now; the output follows from `settle`.
    this.emitFloor(recipe, null);
    this.strikeRemaining = seconds;
    this.strikePercent = 0;
    this.announce = `Working the anvil — ${seconds} seconds.`;
    this.cdr.markForCheck();

    const started = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - started) / 1000;
      this.strikeRemaining = Math.max(0, Math.ceil(seconds - elapsed));
      this.strikePercent = Math.min(100, Math.round((elapsed / seconds) * 100));
      this.cdr.markForCheck();
      if (elapsed >= seconds) {
        this.striking = false;
        this.settle(recipe);
        return;
      }
      this.timers.push(setTimeout(tick, 120));
    };
    this.timers.push(setTimeout(tick, 120));
  }

  /**
   * `anvilQuality` is null for every craft that did not play the anvil game
   * (Craft all, a batch, skipped, consumables): those hand the gateway its
   * default RNG and are exactly today's craft. `fedFloor` says whether a timed
   * craft already sent the materials to the floor when it started.
   */
  private settle(recipe: CraftingRecipe, anvilQuality: number | null = null, fedFloor = (recipe.craftTime ?? 0) > 0): void {
    const craftId = newCraftId();
    const result = anvilQuality === null
      ? this.gateway.craft(recipe.id, craftId)
      : this.gateway.craft(recipe.id, craftId, anvilRng(Math.random, anvilQuality));
    if (!result.ok) {
      this.queue = 0;
      this.error = REJECT_COPY[result.code];
      this.announce = this.error;
      this.striking = false;
      this.cdr.markForCheck();
      return;
    }

    this.slots = this.buildSlots();
    this.lastCraft = {
      items: result.items,
      recipe: result.recipe,
      quality: result.quality,
      mastered: result.progress?.masteredNow === true,
    };
    const name = result.items[0]?.name ?? result.recipe.name;
    const made = result.stack ? result.stack.quantity : result.items.length;
    this.announce = result.progress?.masteredNow
      ? `${name} forged. This recipe is now mastered.`
      : `${name} forged.`;
    // Safe to call unconditionally — a no-op on Common and on the server, and it
    // never throws into the caller. See CelebrationService.
    const q = result.items[0] ? this.qualityOf(result.items[0]) : '';
    // The anvil's Smithing XP, through the skills hook (idempotent per craft id).
    let smithXp = 0;
    if (anvilQuality !== null && !result.replayed) {
      const granted = this.skills.grantSmithingXp(anvilQuality, `anvil:${craftId}`);
      if (granted.ok && !granted.replayed) smithXp = craftSkillXp(anvilQuality);
    }
    this.reward = {
      seq: ++this.rewardSeq,
      kicker: result.progress?.masteredNow ? this.t('crafting.madeMastered') : this.t('crafting.made'),
      name: made > 1 ? `${name} ×${made}` : name,
      art: artFor(result.recipe.output.itemId),
      rarity: result.recipe.rarity,
      rarityLabel: this.rarityLabel(result.recipe.rarity),
      caption: [
        q ? this.t('crafting.quality', { q }) : '',
        smithXp ? this.t('minigame.anvil.xp', { n: smithXp }) : '',
        this.queueTotal > 1 ? this.t('crafting.batch', { n: this.queueTotal - this.queue, total: this.queueTotal }) : '',
      ].filter(Boolean).join(' · ') || undefined,
    };
    this.celebration.celebrate(result.recipe.rarity);
    // The world (when it is around the bench) flies the made thing into the Satchel.
    if (!result.replayed) this.feel.crafted({ itemId: result.recipe.output.itemId, name, qty: made, art: this.reward.art?.src || undefined, rarity: result.recipe.rarity });
    // A timed craft already fed the floor when it started; an instant one feeds
    // and finishes in a single event.
    const first = result.items[0];
    this.emitFloor(
      fedFloor ? null : recipe,
      first ? floorThing(result.recipe.output.itemId, first.name) : floorThing(result.recipe.output.itemId),
      this.rarityColor(result.recipe.rarity),
    );
    this.cdr.markForCheck();
    // A multi-craft: the next one, a beat later so each pop is seen. Stops by
    // itself the moment the bench says no (craft() re-checks canCraft).
    if (this.queue > 0) {
      this.queue -= 1;
      this.timers.push(setTimeout(() => {
        if (this.canCraft) this.craft();
        else this.queue = 0;
      }, 280));
    } else {
      this.queueTotal = 0;
    }
  }

  /** Hand the floor a settled (or, for a timed craft, a started) strike. */
  private emitFloor(inputsOf: CraftingRecipe | null, output: ForgeFloorThing | null, glow?: string): void {
    this.floorEvent = {
      seq: ++this.floorSeq,
      station: 'anvil',
      inputs: inputsOf ? inputsOf.ingredients.map(row => floorThing(row.materialId)) : [],
      output,
      glow,
    };
  }

  dismissResult(): void {
    this.lastCraft = null;
    this.reward = null;
    this.error = null;
    this.cdr.markForCheck();
  }

  // ── Building ───────────────────────────────────────────────────────────────

  private refresh(): void {
    this.cards = this.buildCards();
    this.buildJournal();
    this.slots = this.buildSlots();
    this.buildCta();
    this.cdr.markForCheck();
  }

  private buildCards(): RecipeCard[] {
    const browser = this.isBrowser && this.hydrated;
    return this.recipes.map(recipe => {
      const def = itemDefinitionById(recipe.output.itemId);
      const crafted = browser ? this.crafting.craftedCount(recipe.id) : 0;
      const ready = browser
        ? recipe.ingredients.every(row => this.haveOf(row) >= row.count)
        : false;
      return {
        recipe,
        def,
        art: artFor(recipe.output.itemId),
        ready,
        levelOk: !browser ? false : this.crafting.meetsLevel(recipe),
        crafted,
        mastered: crafted >= MASTERY_THRESHOLD,
        known: crafted > 0,
      };
    });
  }

  private buildSlots(): SlotView[] {
    const recipe = this.selected;
    if (!recipe) return [];
    const browser = this.isBrowser && this.hydrated;
    return recipe.ingredients.map(row => {
      const have = browser ? this.haveOf(row) : 0;
      return {
        materialId: row.materialId,
        name: materialName(row.materialId),
        need: row.count,
        have,
        art: ingredientArt(row),
        enough: have >= row.count,
      };
    });
  }
}

const STAT_LABELS: Readonly<Partial<Record<ItemStatKey, string>>> = {
  goldPerSec: 'Gold Find',
  goldFind: 'Gold Find',
  xpBonus: 'XP bonus',
  magicFind: 'Magic Find',
  ward: 'Ward',
  strikePower: 'Strike power',
};

function materialName(id: string): string {
  return materialDisplay(id)?.name ?? itemDefinitionById(id)?.name ?? (runeById(id) ? `${runeById(id)!.name} rune` : id);
}

/** A rune ingredient wears its rune card (`artFor('aether')` is the currency glyph). */
function ingredientArt(row: CraftingIngredient): ArtEntry | null {
  return row.rune ? runeCard(row.materialId) : artFor(row.materialId);
}

/** The "Skip the anvil game" toggle. Session-only UI preference; never persisted. */
let skipAnvilGame = false;

let craftCounter = 0;
/**
 * A fresh mutation id per strike.
 *
 * `craftRecipe` derives every op id and every minted item id from this, so two
 * strikes must never share one. A *failed* strike is safe to retry under a new
 * id because the gateway rolls the whole ledger back before it returns — the
 * dedupe exists for the case where the write landed and the caller never heard
 * about it, which is a reload, not a retry.
 */
function newCraftId(): string {
  craftCounter = (craftCounter + 1) % 1_000_000;
  return `craft-${Date.now().toString(36)}-${craftCounter.toString(36)}`;
}
