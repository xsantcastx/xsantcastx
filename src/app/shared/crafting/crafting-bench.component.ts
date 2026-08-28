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
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
import { RUNE_TIERS, RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import { TranslationService } from '../../translation.service';
import { CraftingGateway, type CraftReject } from './crafting.gateway';
import { CraftingService } from './crafting.service';
import {
  CRAFTING_CATEGORIES,
  CRAFTING_RECIPES,
  MASTERY_THRESHOLD,
  MAX_CRAFTING_LEVEL,
  craftXpFor,
  craftingLevelView,
  masteryProgress,
  type CraftingCategory,
  type CraftingLevelView,
  type CraftingRecipe,
} from './crafting.model';

import { RelatedPagesComponent } from '../seo/related-pages.component';
/** One ingredient, as the anvil renders it. */
export interface SlotView {
  materialId: string;
  name: string;
  need: number;
  have: number;
  art: ArtEntry | null;
  loaded: boolean;
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
  missing: 'The anvil is short of materials.',
  funds: 'Not enough Gold to pay the bench.',
  capacity: 'Your bag has no room for what this makes.',
  mint: 'The pattern named something the catalogue does not have.',
  persist: 'The strike did not save. Nothing was spent — try again.',
};

/** Radius of the level dial, for the dash offset. */
const DIAL_R = 46;

@Component({
  selector: 'app-crafting-bench',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, FormsModule],
  templateUrl: './crafting-bench.component.html',
  styleUrls: ['./crafting-bench.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CraftingBenchComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gateway = inject(CraftingGateway);
  private readonly crafting = inject(CraftingService);
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly celebration = inject(CelebrationService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);

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
  readonly totalRecipes = CRAFTING_RECIPES.length;

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
  selected: CraftingRecipe | null = CRAFTING_RECIPES[0] ?? null;
  slots: SlotView[] = [];

  /** Material ids currently sitting on the anvil for the selected recipe. */
  private loadedIds = new Set<string>();

  /** Set while a craft with a `craftTime` is running down. */
  striking = false;
  strikeRemaining = 0;
  strikePercent = 0;

  /** The last thing that came off the anvil, and the last refusal. */
  lastCraft: { items: GameItem[]; recipe: CraftingRecipe; quality: number | null; mastered: boolean } | null = null;
  error: string | null = null;
  announce = '';

  /** Which material tile the pointer is dragging, and which slot is under it. */
  dragging: string | null = null;
  dragOver: string | null = null;

  constructor() {
    this.cards = this.buildCards();
    this.slots = this.buildSlots();
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

  t(key: string): string { return this.i18n.translate(key); }

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

  /** Every slot loaded, so the anvil can be struck. */
  get loaded(): boolean {
    return this.slots.length > 0 && this.slots.every(slot => slot.loaded);
  }

  get canLoad(): boolean {
    return this.slots.some(slot => !slot.loaded && slot.enough);
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
    return this.isBrowser && this.hydrated && !this.striking && this.loaded && !this.blocker;
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

  // ── Selection and loading ──────────────────────────────────────────────────

  select(recipe: CraftingRecipe): void {
    if (this.striking) return;
    this.selected = recipe;
    this.loadedIds.clear();
    this.error = null;
    this.lastCraft = null;
    this.slots = this.buildSlots();
    this.cdr.markForCheck();
  }

  loadSlot(slot: SlotView): void {
    if (this.striking || !slot.enough) return;
    this.loadedIds.add(slot.materialId);
    this.slots = this.buildSlots();
    this.announce = `${slot.name} on the anvil.`;
    this.cdr.markForCheck();
  }

  unloadSlot(slot: SlotView): void {
    if (this.striking) return;
    this.loadedIds.delete(slot.materialId);
    this.slots = this.buildSlots();
    this.cdr.markForCheck();
  }

  loadAll(): void {
    if (this.striking) return;
    for (const slot of this.slots) if (slot.enough) this.loadedIds.add(slot.materialId);
    this.slots = this.buildSlots();
    this.announce = 'The anvil is loaded.';
    this.cdr.markForCheck();
  }

  clearAnvil(): void {
    if (this.striking) return;
    this.loadedIds.clear();
    this.slots = this.buildSlots();
    this.cdr.markForCheck();
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────
  //
  // The tray tile is the drag source and the slot is the target. Both paths end
  // in `loadSlot`, so there is exactly one place a material gets onto the anvil.

  onDragStart(materialId: string, event: DragEvent): void {
    this.dragging = materialId;
    event.dataTransfer?.setData('text/plain', materialId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.dragging = null;
    this.dragOver = null;
    this.cdr.markForCheck();
  }

  onDragOver(slot: SlotView, event: DragEvent): void {
    // Only a matching, affordable material may be dropped; anything else keeps
    // the browser's default "no drop" cursor, which is the honest signal.
    if (this.dragging !== slot.materialId || !slot.enough) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOver !== slot.materialId) {
      this.dragOver = slot.materialId;
      this.cdr.markForCheck();
    }
  }

  onDragLeave(slot: SlotView): void {
    if (this.dragOver === slot.materialId) {
      this.dragOver = null;
      this.cdr.markForCheck();
    }
  }

  onDrop(slot: SlotView, event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.dragging;
    this.dragOver = null;
    this.dragging = null;
    if (id !== slot.materialId) {
      this.error = `${materialName(id ?? '')} does not belong in that slot.`;
      this.cdr.markForCheck();
      return;
    }
    this.loadSlot(slot);
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

  private settle(recipe: CraftingRecipe): void {
    const result = this.gateway.craft(recipe.id, newCraftId());
    if (!result.ok) {
      this.error = REJECT_COPY[result.code];
      this.announce = this.error;
      this.striking = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadedIds.clear();
    this.slots = this.buildSlots();
    this.lastCraft = {
      items: result.items,
      recipe: result.recipe,
      quality: result.quality,
      mastered: result.progress?.masteredNow === true,
    };
    const name = result.items[0]?.name ?? result.recipe.name;
    this.announce = result.progress?.masteredNow
      ? `${name} forged. This recipe is now mastered.`
      : `${name} forged.`;
    // Safe to call unconditionally — a no-op on Common and on the server, and it
    // never throws into the caller. See CelebrationService.
    this.celebration.celebrate(result.recipe.rarity);
    this.cdr.markForCheck();
  }

  dismissResult(): void {
    this.lastCraft = null;
    this.error = null;
    this.cdr.markForCheck();
  }

  // ── Building ───────────────────────────────────────────────────────────────

  private refresh(): void {
    this.cards = this.buildCards();
    this.slots = this.buildSlots();
    this.cdr.markForCheck();
  }

  private buildCards(): RecipeCard[] {
    const browser = this.isBrowser && this.hydrated;
    return CRAFTING_RECIPES.map(recipe => {
      const def = itemDefinitionById(recipe.output.itemId);
      const crafted = browser ? this.crafting.craftedCount(recipe.id) : 0;
      const ready = browser
        ? recipe.ingredients.every(row => this.inventory.stackOf(row.materialId) >= row.count)
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
      const have = browser ? this.inventory.stackOf(row.materialId) : 0;
      return {
        materialId: row.materialId,
        name: materialName(row.materialId),
        need: row.count,
        have,
        art: artFor(row.materialId),
        loaded: this.loadedIds.has(row.materialId),
        enough: have >= row.count,
      };
    });
  }
}

const STAT_LABELS: Readonly<Partial<Record<ItemStatKey, string>>> = {
  goldPerSec: 'Gold / sec',
  xpBonus: 'XP bonus',
  magicFind: 'Magic Find',
  lootBonus: 'Loot bonus',
  ward: 'Ward',
  strikePower: 'Strike power',
};

function materialName(id: string): string {
  return materialDisplay(id)?.name ?? itemDefinitionById(id)?.name ?? id;
}

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
