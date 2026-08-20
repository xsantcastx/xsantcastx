/**
 * explorer-roster-panel.component.ts — the cast, as a collection wall.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED
 * ─────────────────────────────────────────────────────────────────────────────
 * This was a list of who you have. It is now a list of who *exists*, with the
 * ones you have filled in — the same shape the Collection Log uses, for the same
 * reason: a roster that only shows five hires cannot tell a player there are
 * thirteen more, so the whole acquisition ladder is invisible until they
 * accidentally trip over a rung of it.
 *
 * The locked cards are the point. A silhouette with "Grand Expedition or the
 * Abyss. She chooses the length." under it is a reason to run a Grand
 * Expedition; a roster that says nothing is a reason to keep running Scouts.
 *
 * Deliberately still does *not* own dispatch — the picker beside it already
 * knows how to arm a realm, a site and a length, and a second dispatch button
 * on a different code path would be a second set of rules about who is
 * available. This panel says who exists; `ExplorerService` says who is out.
 *
 * SSR: renders the full locked wall from the service's empty snapshot, which is
 * the correct prerender — the cast is static data, so the eighteen silhouettes
 * are real content for a crawler rather than a skeleton.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { ExplorerRosterService, RosterSnapshot } from './explorer-roster.service';
import { InventoryService, InventorySnapshot } from './inventory.service';
import { ExplorerService } from '../explorer/explorer.service';
import { RosterExplorer, explorerTier } from './explorer-roster.model';
import { GameItem, rarityColor } from './item.model';
import {
  ARCHETYPE_COUNT,
  CAPSTONE_ARCHETYPE,
  EXPLORER_ARCHETYPES,
  ExplorerArchetype,
  MARKET_HIRE_COST,
  archetypeById,
  traitOf,
} from './explorer-archetypes';
import {
  LevelProgress,
  MAX_EXPLORER_LEVEL,
  bonusChips,
  equipCapacity,
  levelProgress,
  nextMilestone,
  reachedMilestones,
  resolveExplorerBonus,
} from './explorer-progression';
import { ROSTER_REWARDS, RosterReward } from './roster-completion';
import { realmById } from '../realms/realm.model';
import { EconomyService } from '../economy/economy.service';
import { CollectionService } from '../collection/collection.service';
import { formatCompact } from '../economy/economy.model';

/**
 * One card on the wall: either somebody you have, or somebody you do not.
 *
 * Built as a single row type rather than two lists, so sorting and filtering are
 * written once and the locked cards sit in rarity order among the found ones
 * instead of in a second block underneath. A player scanning for "what is the
 * next Rare" should find it where the Rares are.
 */
interface RosterRow {
  key: string;
  archetype?: ExplorerArchetype;
  explorer?: RosterExplorer;
  found: boolean;
  /** True when they are out on a mission right now. */
  out: boolean;
  name: string;
  rarity: string;
  rarityLabel: string;
  color: string;
  glow: string;
  /** Rank in `EXPLORER_RARITY_ORDER`, for sorting. */
  rank: number;
  realmName?: string;
  realmColor?: string;
  level: number;
  progress: LevelProgress | null;
}

type SortKey = 'rarity' | 'level' | 'realm' | 'name';
type FilterKey = 'all' | 'found' | 'locked' | 'idle' | 'deployed';

@Component({
  selector: 'app-explorer-roster-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './explorer-roster-panel.component.html',
  styleUrls: ['./explorer-roster-panel.component.css'],
})
export class ExplorerRosterPanelComponent implements OnInit, OnDestroy {
  private readonly roster = inject(ExplorerRosterService);
  private readonly inventory = inject(InventoryService);
  private readonly expeditions = inject(ExplorerService);
  private readonly economy = inject(EconomyService);
  private readonly collection = inject(CollectionService);
  private readonly cdr = inject(ChangeDetectorRef);

  snap: RosterSnapshot = this.roster.snapshot;
  bag: InventorySnapshot = this.inventory.snapshot;

  /** Which card is expanded. One at a time — the column is narrow. */
  open: string | null = null;
  /** Dismissal is two clicks on the same button, not a modal. */
  confirmingDismiss: string | null = null;

  sort: SortKey = 'rarity';
  filter: FilterKey = 'all';

  readonly total = ARCHETYPE_COUNT;
  readonly hireCost = MARKET_HIRE_COST;
  readonly hireCostLabel = formatCompact(MARKET_HIRE_COST);
  readonly maxLevel = MAX_EXPLORER_LEVEL;
  readonly rewards = ROSTER_REWARDS;
  readonly sorts: ReadonlyArray<{ key: SortKey; label: string }> = [
    { key: 'rarity', label: 'Rarity' },
    { key: 'level', label: 'Level' },
    { key: 'realm', label: 'Realm' },
    { key: 'name', label: 'Name' },
  ];
  readonly filters: ReadonlyArray<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'found', label: 'Found' },
    { key: 'locked', label: 'Missing' },
    { key: 'idle', label: 'Idle' },
    { key: 'deployed', label: 'Out' },
  ];

  /**
   * The wall, rebuilt whenever the roster or the bag moves.
   *
   * Cached in a field rather than computed in a getter because the template
   * reads it in an `@for` and every change-detection pass would otherwise walk
   * eighteen archetypes, resolve eighteen bonuses and re-sort — on a page that
   * ticks once a second while any expedition is out.
   */
  rows: RosterRow[] = [];

  private subs = new Subscription();

  ngOnInit(): void {
    this.subs.add(this.roster.snapshot$.subscribe(s => {
      this.snap = s;
      this.rebuild();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(s => {
      this.bag = s;
      this.cdr.markForCheck();
    }));
    this.roster.init();
    this.inventory.init();
    this.rebuild();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ───────────────────────────────────────────────────────────────────────────
  // The wall
  // ───────────────────────────────────────────────────────────────────────────

  private rebuild(): void {
    const byArchetype = new Map<string, RosterExplorer>();
    const nameless: RosterExplorer[] = [];
    for (const e of this.snap.explorers) {
      if (e.archetypeId) byArchetype.set(e.archetypeId, e);
      else nameless.push(e);
    }

    const rows: RosterRow[] = EXPLORER_ARCHETYPES.map(a =>
      this.rowFor(a, byArchetype.get(a.id)));

    // Generated hires appear after the cast rather than among it. They are real
    // explorers and must be fieldable and dismissable, but they are not part of
    // the collection and pretending otherwise would make the counter lie.
    for (const e of nameless) rows.push(this.rowFor(undefined, e));

    this.rows = this.applyView(rows);
  }

  private rowFor(archetype: ExplorerArchetype | undefined, explorer: RosterExplorer | undefined): RosterRow {
    const rarity = archetype?.rarity ?? explorer?.rarity ?? 'common';
    const tier = explorerTier(rarity);
    const realm = archetype?.affinity ? realmById(archetype.affinity) : undefined;
    const progress = explorer ? levelProgress(explorer.xp ?? 0) : null;

    return {
      key: archetype?.id ?? explorer?.id ?? 'unknown',
      archetype,
      explorer,
      found: !!explorer,
      out: explorer ? this.expeditions.isOut(explorer.id) : false,
      name: explorer?.name ?? archetype?.name ?? 'Unknown',
      rarity,
      rarityLabel: tier.label,
      color: tier.color,
      glow: tier.glow,
      rank: RARITY_RANK[rarity] ?? 0,
      realmName: realm?.name,
      realmColor: realm?.color,
      level: progress?.level ?? 0,
      progress,
    };
  }

  private applyView(rows: RosterRow[]): RosterRow[] {
    const filtered = rows.filter(r => {
      switch (this.filter) {
        case 'found': return r.found;
        case 'locked': return !r.found;
        case 'idle': return r.found && !r.out;
        case 'deployed': return r.out;
        default: return true;
      }
    });

    // Every comparator falls back to rarity then name, so a sort is never
    // unstable between two rows that tie — a wall that reshuffled on every tick
    // would be unusable on a page that redraws once a second.
    const byRarity = (a: RosterRow, b: RosterRow) =>
      b.rank - a.rank || a.name.localeCompare(b.name);

    return filtered.sort((a, b) => {
      switch (this.sort) {
        case 'level': return b.level - a.level || byRarity(a, b);
        case 'realm':
          return (a.realmName ?? 'zzz').localeCompare(b.realmName ?? 'zzz') || byRarity(a, b);
        case 'name': return a.name.localeCompare(b.name);
        default:
          // Found before locked inside a rarity band, so the wall reads as
          // "what you have, then what is left" at every tier.
          return b.rank - a.rank
            || Number(b.found) - Number(a.found)
            || a.name.localeCompare(b.name);
      }
    });
  }

  setSort(key: SortKey): void { this.sort = key; this.rebuild(); }
  setFilter(key: FilterKey): void { this.filter = key; this.rebuild(); }

  // ───────────────────────────────────────────────────────────────────────────
  // Card detail
  // ───────────────────────────────────────────────────────────────────────────

  /** Their trait, resolved for display. */
  traitOf(row: RosterRow) { return traitOf(row.archetype?.trait); }

  /**
   * The bonus chips on an open card.
   *
   * Resolved against their *affinity realm* rather than against wherever the
   * picker happens to be armed, so the card reads as a description of the person
   * — "what Seris is worth in Umbral" — rather than as a live readout that
   * changes when the player clicks a different realm button behind the card.
   */
  chipsFor(row: RosterRow): string[] {
    if (!row.explorer) return [];
    return bonusChips(resolveExplorerBonus(row.explorer, row.archetype?.affinity));
  }

  milestonesFor(row: RosterRow) { return reachedMilestones(row.level); }
  nextMilestoneFor(row: RosterRow) { return nextMilestone(row.level); }

  capacityOf(row: RosterRow): number {
    return row.explorer ? equipCapacity(row.explorer.rarity, row.explorer.xp ?? 0) : 0;
  }

  worn(row: RosterRow): GameItem[] {
    return row.explorer ? this.inventory.itemsOnExplorer(row.explorer.id) : [];
  }

  /**
   * What can be handed over: unequipped charms only.
   *
   * Charms are the only type offered because they are the only type whose stats
   * read the same on an explorer as on the player — a `goldPerSec` sigil worn by
   * somebody walking through Umbral would contribute nothing, and offering it
   * would be offering a slot that does nothing.
   */
  charms(): GameItem[] {
    return this.bag.bag.filter(i => i.type === 'charm');
  }

  colorOf(item: GameItem): string { return rarityColor(item.rarity); }

  /** "2× faster" reads better than "0.5", which nobody can rank at a glance. */
  speedLabel(row: RosterRow): string {
    const speed = explorerTier(row.rarity as never).speed;
    if (speed >= 1) return 'normal';
    return `${Math.round((1 / speed) * 10) / 10}× faster`;
  }

  /** Hours out, for the card's lifetime line. */
  hoursDeployed(row: RosterRow): string {
    const ms = row.explorer?.timeDeployed ?? 0;
    if (ms < 60_000) return '—';
    const hours = ms / 3_600_000;
    return hours < 1 ? `${Math.round(ms / 60_000)}m` : `${Math.round(hours * 10) / 10}h`;
  }

  bestFindLabel(row: RosterRow): string {
    const tier = row.explorer?.bestFindTier;
    return tier === undefined ? 'nothing yet' : RUNE_TIER_LABELS[tier] ?? 'unknown';
  }

  rewardEarned(reward: RosterReward): boolean {
    return this.snap.discoveredCount >= reward.at;
  }

  /** 0–100 across the whole collection, for the header bar. */
  get collectionPercent(): number {
    return Math.round((this.snap.discoveredCount / ARCHETYPE_COUNT) * 100);
  }

  trackRow(_: number, row: RosterRow): string { return row.key; }
  trackReward(_: number, r: RosterReward): number { return r.at; }
  trackItem(_: number, i: GameItem): string { return i.id; }

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  // ── The two paths that are not drops ──────────────────────────────────────

  /**
   * True when this card is somebody who can be bought rather than found.
   *
   * The recruit control lives on the locked card rather than in the Market for
   * one reason: this is where a player is standing when they decide they want
   * that specific person. A Market listing would be the same purchase two clicks
   * and a route change away from the thing that motivates it.
   */
  canRecruit(row: RosterRow): boolean {
    return !row.found
      && row.archetype?.source === 'market'
      && !this.snap.full;
  }

  affordable(): boolean {
    return this.economy.snapshot.gold >= MARKET_HIRE_COST;
  }

  /**
   * Buy one of the cast.
   *
   * The Gold is taken first and the grant is checked second, and if the grant
   * refuses the Gold is handed straight back. `grantArchetype` can refuse — the
   * roster filled up between the render and the click — and a player charged
   * 500,000 Gold for nothing would be the worst bug on this panel.
   */
  recruit(row: RosterRow): void {
    if (!row.archetype || !this.canRecruit(row) || !this.affordable()) return;
    if (!this.economy.spendGold(MARKET_HIRE_COST, `explorer:${row.archetype.id}`)) return;
    if (!this.roster.grantArchetype(row.archetype.id)) {
      this.economy.earnGold(MARKET_HIRE_COST, 'explorer-refund');
      return;
    }
    this.open = null;
  }

  /**
   * True when the Collection Log is finished and the capstone is still unclaimed.
   *
   * Checked here rather than pushed from `CollectionService`, because the Log
   * has no idea the roster exists and giving it one would put the roster on the
   * far side of an edge that currently runs the other way. Read on every
   * change-detection pass, which is one integer comparison.
   */
  capstoneReady(row: RosterRow): boolean {
    return !row.found
      && row.archetype?.source === 'capstone'
      && this.collection.snapshot.completion.percent >= 100
      && !this.snap.full;
  }

  claimCapstone(): void {
    if (this.collection.snapshot.completion.percent < 100) return;
    this.roster.grantArchetype(CAPSTONE_ARCHETYPE.id);
    this.open = null;
  }

  /** How far the Collection Log is, for the capstone card's progress line. */
  get collectionLogPercent(): number {
    return Math.round(this.collection.snapshot.completion.percent);
  }

  toggle(row: RosterRow): void {
    this.open = this.open === row.key ? null : row.key;
    this.confirmingDismiss = null;
  }

  give(row: RosterRow, item: GameItem): void {
    if (row.explorer) this.roster.equipOn(row.explorer.id, item.id);
  }

  takeBack(row: RosterRow, item: GameItem): void {
    if (row.explorer) this.roster.unequipFrom(row.explorer.id, item.id);
  }

  /**
   * First click arms, second click fires.
   *
   * The button's own label carries the confirmation, so there is no dialog to
   * position and nothing to trap focus in — and the armed state is cleared by
   * closing the card, which is the natural way out.
   *
   * Note that dismissing does *not* un-discover: the card drops back to a
   * silhouette but the collection counter and every reward it earned stand. See
   * the note at the top of `roster-completion.ts`.
   */
  dismiss(row: RosterRow): void {
    if (!row.explorer) return;
    if (this.confirmingDismiss !== row.key) {
      this.confirmingDismiss = row.key;
      return;
    }
    this.roster.dismiss(row.explorer.id);
    this.confirmingDismiss = null;
    this.open = null;
  }
}

const RARITY_RANK: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};

/**
 * Rune tier names, indexed as `RUNE_TIER_ORDER` indexes them.
 *
 * Written out rather than imported so this component does not pull the Rune
 * Forge's registry — twenty-five runes and a drop table — into a chunk that only
 * needs seven words for one line of copy.
 */
const RUNE_TIER_LABELS: readonly string[] = [
  'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Singular',
];
