/**
 * basalt-seamworks.component.ts — /world/realms/infernal/basalt-seamworks
 *
 * The only public Mine control. Templates call the gateway; they do not
 * roll discovery, grant XP, or write inventory.
 */
import { ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ArtSceneComponent } from '../shared/art-scene/art-scene.component';
import { CurrentWorkTileComponent } from '../shared/activity/current-work-tile.component';
import {
  ActivityProgressionGateway,
  type ActivityRejectCode,
} from '../shared/activity/activity-progression.gateway';
import {
  BASALT_SEAMWORKS_ID,
  CINDER_ORE_ID,
  EMBER_DISCOVERY_CHANCE,
  EMBER_RESIDUE_ID,
  MINING_TIERS,
  isMiningTierUnlocked,
  type ActivityLedger,
  type ActivityOperation,
  type MiningTier,
} from '../shared/activity/activity.model';
import { miningLevelView } from '../shared/activity/mining-level';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import { infernalChoiceById } from '../shared/narrative/infernal-chapter';
import { CINDER_ORE_DISPLAY, EMBER_RESIDUE_DISPLAY, materialDisplay, type MaterialDisplay } from '../shared/rpg/material-catalog';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';
import { LevelUpService } from '../shared/activity/level-up.service';
import { InventoryService } from '../shared/rpg/inventory.service';

type MinePanelState =
  | 'available'
  | 'resolving'
  | 'recovering'
  | 'capacity'
  | 'location'
  | 'persist'
  | 'unavailable';

type FloaterKind = 'ore' | 'ember';

interface Floater {
  id: number;
  kind: FloaterKind;
  text: string;
}

@Component({
  selector: 'app-basalt-seamworks',
  standalone: true,
  imports: [RouterLink, ArtSceneComponent, CurrentWorkTileComponent],
  templateUrl: './basalt-seamworks.component.html',
  styleUrls: ['./basalt-seamworks.component.css'],
})
export class BasaltSeamworksComponent implements OnInit, OnDestroy {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly keeper = inject(KeeperPanelService);
  private readonly levelUp = inject(LevelUpService);
  private readonly inventory = inject(InventoryService);
  private readonly chapters = inject(ChapterGateway);
  private readonly i18n = inject(TranslationService);
  private readonly title = inject(Title);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private clock?: ReturnType<typeof setInterval>;

  readonly locationId = BASALT_SEAMWORKS_ID;
  readonly infernalHref = '/world/realms/infernal';
  readonly tiers = MINING_TIERS;
  readonly ember = EMBER_RESIDUE_DISPLAY;
  readonly chance = Number((EMBER_DISCOVERY_CHANCE * 100).toPrecision(2));

  /** Which seam is armed right now. Cinder Ore is always open, so it's the default. */
  selectedOreId: string = CINDER_ORE_ID;

  snap: ActivityLedger = this.activity.snapshot;
  now = Date.now();
  lastOp: ActivityOperation | null = null;
  lastOre = 0;
  lastEmber = 0;
  oreHeld = 0;
  emberHeld = 0;
  lastError: ActivityRejectCode | null = null;
  pendingId: string | null = null;
  busy = false;

  /**
   * The "+1 Cinder Ore" that rises off the art on a successful strike.
   *
   * A `@for` array keyed by a fresh id per grant, not a single nullable
   * field toggled by `@if`: Angular reuses a view across an `@if` block's
   * truthy-to-truthy transitions, so a field that stays "set" across two
   * consecutive strikes would never restart the CSS animation on the second
   * one. A brand-new array entry forces a brand-new DOM node every time.
   */
  floaters: Floater[] = [];
  private floaterSeq = 0;
  private floaterTimers: Array<ReturnType<typeof setTimeout>> = [];

  ngOnInit(): void {
    this.activity.init();
    this.chapters.init();
    this.title.setTitle(this.t('seamworks.titlePage'));
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.inventory.snapshot$.subscribe(() => {
      this.refreshHeld();
      this.cdr.markForCheck();
    }));
    this.sub.add(this.i18n.currentLanguage$.subscribe(() => {
      this.title.setTitle(this.t('seamworks.titlePage'));
    }));
    if (this.isBrowser) {
      if (!this.activity.snapshot.currentWork) {
        this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID);
      }
      if (!this.activity.bagCanTakeOre(this.selectedOreId)) this.keeper.show('bank');
      this.clock = setInterval(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      }, 100);
    }
  }

  /** Mining level derived the same way hub-skills.component reads it: off the live XP total, not a cached field. */
  currentLevel(): number {
    return miningLevelView(this.snap.progress.xpByDiscipline.mining ?? 0).level;
  }

  tierUnlocked(tier: MiningTier): boolean {
    return isMiningTierUnlocked(tier, this.currentLevel());
  }

  selectTier(tier: MiningTier): void {
    if (!this.tierUnlocked(tier) || this.selectedOreId === tier.oreId) return;
    this.selectedOreId = tier.oreId;
    // A stale "+1 Cinder Ore" result from the old seam would misdescribe the
    // new one, so the last-strike readout clears on every tier switch.
    this.lastOp = null;
    this.lastOre = 0;
    this.lastEmber = 0;
    this.refreshHeld();
  }

  selectedTier(): MiningTier {
    return this.tiers.find(tier => tier.oreId === this.selectedOreId) ?? this.tiers[0];
  }

  get ore(): MaterialDisplay {
    return materialDisplay(this.selectedOreId) ?? CINDER_ORE_DISPLAY!;
  }

  tierArt(tier: MiningTier): MaterialDisplay {
    return materialDisplay(tier.oreId) ?? CINDER_ORE_DISPLAY!;
  }

  private refreshHeld(): void {
    this.oreHeld = this.inventory.stackOf(this.selectedOreId);
    this.emberHeld = this.inventory.stackOf(EMBER_RESIDUE_ID);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
    for (const t of this.floaterTimers) clearTimeout(t);
  }

  oreFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'ore'); }
  emberFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'ember'); }

  private spawnFloater(kind: FloaterKind, text: string): void {
    const id = ++this.floaterSeq;
    this.floaters = [...this.floaters, { id, kind, text }];
    this.floaterTimers.push(setTimeout(() => {
      this.floaters = this.floaters.filter(f => f.id !== id);
      this.cdr.markForCheck();
    }, 900));
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  remain(): number {
    return this.activity.recoveryRemainingMs(Date.now());
  }

  remainLabel(): string {
    return (this.remain() / 1000).toFixed(1);
  }

  /** 0 hides the line entirely — see miningSpeedupPct's own doc comment. */
  speedupPct(): number {
    return this.activity.miningSpeedupPct();
  }

  panelState(): MinePanelState {
    if (this.busy) return 'resolving';
    if (this.lastError === 'persist') return 'persist';
    if (!this.activity.bagCanTakeOre(this.selectedOreId)) return 'capacity';
    if (this.lastError === 'location' || this.lastError === 'not-selected') return 'location';
    if (this.remain() > 0) return 'recovering';
    if (!this.isBrowser) return 'unavailable';
    return 'available';
  }

  openBag(): void {
    this.keeper.show('bank');
  }

  mineDisabled(): boolean {
    const state = this.panelState();
    return state !== 'available' && state !== 'persist';
  }

  mine(): void {
    if (this.mineDisabled() && this.panelState() !== 'persist') return;
    if (!this.snap.currentWork) {
      this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID, this.now);
    }
    const mutationId = this.pendingId ?? newMutationId();
    this.pendingId = mutationId;
    this.busy = true;
    // Captured before the strike resolves. this.snap updates synchronously
    // off the gateway's BehaviorSubject, so comparing it against the same
    // field right after resolveMine() returns is enough to catch a crossing —
    // no separate read of the gateway is needed.
    const xpBefore = this.snap.progress.xpByDiscipline.mining ?? 0;
    const result = this.activity.resolveMine({
      mutationId,
      locationId: BASALT_SEAMWORKS_ID,
      oreId: this.selectedOreId,
    });
    this.busy = false;
    if (result.ok) {
      this.lastOp = result.operation;
      this.lastOre = grantQty(result.operation, this.selectedOreId);
      this.lastEmber = grantQty(result.operation, EMBER_RESIDUE_ID);
      this.lastError = null;
      this.pendingId = null;
      this.refreshHeld();
      if (this.lastOre > 0) this.spawnFloater('ore', `+${this.lastOre}`);
      if (this.lastEmber > 0) this.spawnFloater('ember', `+${this.lastEmber}`);
      this.levelUp.checkMining(xpBefore, this.snap.progress.xpByDiscipline.mining ?? 0);
      if (this.lastEmber > 0 || this.keeper.isOpen) this.keeper.show('bank');
      this.cdr.markForCheck();
      return;
    }
    this.lastError = result.code;
    if (result.code === 'capacity') this.keeper.show('bank');
    if (result.code !== 'persist') this.pendingId = null;
  }

  retry(): void {
    this.mine();
  }

  refresh(): void {
    this.lastError = null;
    this.pendingId = null;
  }

  discoveryLabel(): string {
    const result = this.lastOp?.discovery.result;
    if (result === 'ember-residue') return this.t('seamworks.discovery.bonus');
    if (result === 'first-craft-guarantee') return this.t('seamworks.discovery.guarantee');
    if (this.lastOp) return this.t('seamworks.discovery.none');
    return this.t('seamworks.discovery.pending', { chance: this.chance });
  }

  chapterNote(): string {
    const pick = infernalChoiceById(this.chapters.infernal()?.choiceId ?? null);
    if (!pick) return this.t('seamworks.chapter.missing');
    return this.t('seamworks.chapter.resolved', { choice: this.t(pick.titleKey) });
  }
}

function grantQty(op: ActivityOperation, definitionId: string): number {
  return op.inventoryGrants
    .filter(grant => grant.definitionId === definitionId)
    .reduce((sum, grant) => sum + grant.quantity, 0);
}

function newMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
