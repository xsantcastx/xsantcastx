/**
 * collection-log.component.ts — the Collection Log, as a Codex panel.
 *
 * Its own component rather than a sixth block inside `CodexComponent`, which is
 * already 700 lines over five panels: the log has its own filter set, its own
 * arithmetic and its own reward ladder, and folding it in would have made the
 * Codex the file nobody wants to open.
 *
 * SSR: the grid is built at construction from `COLLECTION_CATALOG`, which is
 * pure data, so the prerendered HTML is a complete, correct, fully-locked log —
 * every card with its real rarity, its real border and its real hint. `ngOnInit`
 * runs its hydration only in the browser and its whole job is flipping `found`
 * and filling in dates. That ordering is what makes the server's HTML and the
 * browser's first frame identical by construction rather than by luck.
 *
 * The Codex mounts this unconditionally behind `[hidden]` rather than behind an
 * `@if` on the active tab, for the same reason: `/codex` is a prerendered static
 * file and the `?tab=` query never reaches it, so a gated panel would be missing
 * from the HTML entirely — see the note above the panel in codex.component.html.
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
import { Subscription } from 'rxjs';

import { artFor, type ArtEntry } from '../art/art';
import { RUNE_TIERS, RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import type { ItemRarity } from '../rpg/item.model';
import { FIVE_REALMS, type NarrativeRealmId } from '../narrative/five-realms.narrative';
import { CollectionService } from './collection.service';
import {
  COLLECTION_CATALOG,
  COLLECTION_CATEGORIES,
  COLLECTION_REWARDS,
  COLLECTION_SORTS,
  COLLECTION_SORT_LABELS,
  COUNTED_CATALOG,
  type CollectionCard,
  type CollectionCategory,
  type CollectionCategoryDefinition,
  type CollectionFilter,
  type CollectionLedger,
  type CollectionSort,
  type CollectionStatus,
  type CompletionCount,
  buildCards,
  completionByCategory,
  completionByRarity,
  emptyCollectionLedger,
  filterCards,
  lockedGlyph,
  overallCompletion,
  recentDiscoveries,
  sortCards,
} from './collection.model';

/** One section of the grid: a category with its cards and its counts. */
interface LogSection {
  category: CollectionCategoryDefinition;
  cards: CollectionCard[];
  completion: CompletionCount;
}

interface RecentRow {
  card: CollectionCard;
  at: number;
}

/** Circumference of the completion dial, for the dash offset. r = 52. */
const DIAL_CIRCUMFERENCE = 2 * Math.PI * 52;

@Component({
  selector: 'app-collection-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collection-log.component.html',
  styleUrls: ['./collection-log.component.css'],
})
export class CollectionLogComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly collection = inject(CollectionService);

  private subs: Subscription[] = [];

  /** Everything derived reads this and reports the locked state while false. */
  hydrated = false;

  ledger: CollectionLedger = emptyCollectionLedger();
  cards: CollectionCard[] = buildCards(emptyCollectionLedger());

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly categories = COLLECTION_CATEGORIES;
  readonly rarityOrder = RUNE_TIER_ORDER;
  readonly rarities = RUNE_TIERS;
  readonly realms = FIVE_REALMS;
  readonly sorts = COLLECTION_SORTS;
  readonly sortLabels = COLLECTION_SORT_LABELS;
  readonly rewards = COLLECTION_REWARDS;
  readonly countedTotal = COUNTED_CATALOG.length;
  readonly catalogueTotal = COLLECTION_CATALOG.length;
  readonly dialCircumference = DIAL_CIRCUMFERENCE;
  readonly lockedGlyph = lockedGlyph;

  categoryFilter: CollectionCategory | 'all' = 'all';
  rarityFilter: ItemRarity | 'all' = 'all';
  statusFilter: CollectionStatus = 'all';
  realmFilter: NarrativeRealmId | 'all' | 'unaligned' = 'all';
  sort: CollectionSort = 'catalogue';
  search = '';

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.collection.init();
    this.subs.push(this.collection.snapshot$.subscribe(snap => {
      this.hydrated = snap.hydrated;
      this.ledger = snap.ledger;
      this.cards = buildCards(snap.ledger);
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ══ Completion ═════════════════════════════════════════════════════════════

  get overall(): CompletionCount {
    return overallCompletion(this.ledger);
  }

  /** Stroke offset for the dial arc. Full circle at 0%, empty at 100%. */
  get dialOffset(): number {
    return DIAL_CIRCUMFERENCE * (1 - this.overall.percent / 100);
  }

  /**
   * The dial climbs the rarity ladder as the log fills: grey at the start,
   * through blue, violet, gold and orange, to the Singular white at 100%.
   *
   * The first version of this coloured the dial by the highest rarity band
   * *fully* completed, which is a more precise fact and a worse readout: a
   * player at 42% saw the Common grey, and so did a player at 4%, because
   * completing a whole band is rare and completing the Common band is not the
   * thing the headline number is about. Seven steps over a hundred points means
   * the colour moves about as often as the number does.
   */
  get dialColor(): string {
    const step = Math.min(
      RUNE_TIER_ORDER.length - 1,
      Math.floor((this.overall.percent / 100) * RUNE_TIER_ORDER.length),
    );
    return RUNE_TIERS[RUNE_TIER_ORDER[step]].color;
  }

  get categoryCounts(): Record<CollectionCategory, CompletionCount> {
    return completionByCategory(this.ledger);
  }

  get rarityCounts(): Record<ItemRarity, CompletionCount> {
    return completionByRarity(this.ledger);
  }

  countFor(category: CollectionCategory): CompletionCount {
    return this.categoryCounts[category];
  }

  rarityCount(rarity: ItemRarity): CompletionCount {
    return this.rarityCounts[rarity];
  }

  /** Entries in the catalogue nothing can currently grant. Named, not hidden. */
  get unobtainable(): number {
    return COLLECTION_CATALOG.filter(e => e.obtainable === false).length;
  }

  // ══ Rewards ════════════════════════════════════════════════════════════════

  rewardEarned(id: string): boolean {
    return this.ledger.rewards.includes(id);
  }

  get nextReward(): { at: number; title: string; away: number } | null {
    const percent = this.overall.percent;
    const next = COLLECTION_REWARDS.find(r => percent < r.at);
    if (!next) return null;
    // How many more entries, not how many more percent: "four away" is a thing
    // a player can act on and "9% away" is not.
    const need = Math.ceil((next.at / 100) * this.countedTotal) - this.overall.found;
    return { at: next.at, title: next.title, away: Math.max(1, need) };
  }

  // ══ Recent ═════════════════════════════════════════════════════════════════

  get recent(): RecentRow[] {
    if (!this.hydrated) return [];
    const rows = recentDiscoveries(this.ledger, 6);
    const byId = new Map(this.cards.map(c => [c.entry.id, c]));
    return rows
      .map(row => ({ card: byId.get(row.entry.id), at: row.at }))
      .filter((row): row is RecentRow => !!row.card);
  }

  // ══ The grid ═══════════════════════════════════════════════════════════════

  private get filter(): CollectionFilter {
    return {
      category: this.categoryFilter,
      rarity: this.rarityFilter,
      status: this.statusFilter,
      realm: this.realmFilter,
      query: this.search,
    };
  }

  get visible(): CollectionCard[] {
    return sortCards(filterCards(this.cards, this.filter), this.sort);
  }

  /**
   * The grid, cut into category sections.
   *
   * Sections are dropped when the filters empty them rather than rendered with
   * a zero — six empty headers under a search that matched two things is noise.
   * When a sort other than catalogue order is chosen the sections collapse into
   * one, because a "newest first" list broken into seven boxes is not sorted by
   * anything the reader can see.
   */
  get sections(): LogSection[] {
    if (this.sort !== 'catalogue') return [];
    const counts = this.categoryCounts;
    const rows = this.visible;
    return this.categories
      .map(category => ({
        category,
        cards: rows.filter(c => c.entry.category === category.id),
        completion: counts[category.id],
      }))
      .filter(section => section.cards.length > 0);
  }

  get hasActiveFilters(): boolean {
    return this.categoryFilter !== 'all'
      || this.rarityFilter !== 'all'
      || this.statusFilter !== 'all'
      || this.realmFilter !== 'all'
      || this.search.trim().length > 0;
  }

  clearFilters(): void {
    this.categoryFilter = 'all';
    this.rarityFilter = 'all';
    this.statusFilter = 'all';
    this.realmFilter = 'all';
    this.search = '';
  }

  // ══ Presentation helpers ═══════════════════════════════════════════════════

  art(card: CollectionCard): ArtEntry | null {
    return card.found ? artFor(card.entry.id) : null;
  }

  tier(rarity: ItemRarity) {
    return RUNE_TIERS[rarity];
  }

  categoryOf(id: CollectionCategory): CollectionCategoryDefinition {
    return this.categories.find(c => c.id === id) ?? this.categories[0];
  }

  realmName(id: NarrativeRealmId | undefined): string | null {
    if (!id) return null;
    return FIVE_REALMS.find(r => r.id === id)?.name ?? null;
  }

  /**
   * The date a thing was first found.
   *
   * A backfilled record has no date behind it — the log started recording the
   * day it shipped, and inventing one would be a lie in a place whose entire
   * job is being the honest record.
   */
  formatDate(at: number): string {
    if (!at) return 'found before the log was kept';
    return new Date(at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  trackCard = (_: number, card: CollectionCard) => card.entry.id;
}
