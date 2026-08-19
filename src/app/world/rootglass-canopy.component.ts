/**
 * rootglass-canopy.component.ts — /world/realms/verdant/rootglass-canopy
 *
 * The only public Gather control — A2 Foraging's surface, a concrete copy of
 * basalt-seamworks.component.ts with the nouns swapped. Templates call the
 * gateway; they do not roll discovery, grant XP, or write inventory.
 *
 * Differences from the Seamworks page, all deliberate:
 *  - No ChapterGateway, no chapter note. Verdant has no chapter component and
 *    the Seamworks note is decorative anyway; nothing gates gathering.
 *  - On mount, if Current Work is set to *another* site, this page re-selects
 *    Foraging at the Canopy. This is the "choose which skill to grind"
 *    moment: the gateway rejects a gather whose Current Work is elsewhere,
 *    and a player who walked here from the Seamworks would otherwise see
 *    'location' rejects until something re-selected for them. The Seamworks
 *    page is frozen this track and still only selects when nothing is
 *    selected — A3 owns the symmetric rule.
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
import type { ActivityLedger, ActivityOperation } from '../shared/activity/activity.model';
import {
  FORAGING_TIERS,
  RIFT_KEY_CHANCE,
  RIFT_KEY_GUARANTEE_AT,
  RIFT_KEY_ID,
  ROOTGLASS_CANOPY_ID,
  STARLIGHT_HERB_ID,
  isForagingTierUnlocked,
  type ForagingTier,
} from '../shared/activity/foraging.model';
import { miningLevelView } from '../shared/activity/mining-level';
import { materialDisplay, type MaterialDisplay } from '../shared/rpg/material-catalog';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';
import { LevelUpService } from '../shared/activity/level-up.service';
import { InventoryService } from '../shared/rpg/inventory.service';

type GatherPanelState =
  | 'available'
  | 'resolving'
  | 'recovering'
  | 'capacity'
  | 'location'
  | 'persist'
  | 'unavailable';

type FloaterKind = 'herb' | 'key';

interface Floater {
  id: number;
  kind: FloaterKind;
  text: string;
}

@Component({
  selector: 'app-rootglass-canopy',
  standalone: true,
  imports: [RouterLink, ArtSceneComponent, CurrentWorkTileComponent],
  templateUrl: './rootglass-canopy.component.html',
  styleUrls: ['./rootglass-canopy.component.css'],
})
export class RootglassCanopyComponent implements OnInit, OnDestroy {
  private readonly activity = inject(ActivityProgressionGateway);
  private readonly keeper = inject(KeeperPanelService);
  private readonly levelUp = inject(LevelUpService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly title = inject(Title);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private clock?: ReturnType<typeof setInterval>;

  readonly locationId = ROOTGLASS_CANOPY_ID;
  readonly verdantHref = '/world/realms/verdant';
  readonly tiers = FORAGING_TIERS;
  /** The rare find. Named + painted via material-catalog so the bank and this page agree. */
  readonly key: MaterialDisplay = materialDisplay(RIFT_KEY_ID)!;
  readonly chance = Number((RIFT_KEY_CHANCE * 100).toPrecision(2));
  readonly guaranteeAt = RIFT_KEY_GUARANTEE_AT;

  /** Which growth is armed right now. Starlight Herb is always open, so it's the default. */
  selectedHerbId: string = STARLIGHT_HERB_ID;

  snap: ActivityLedger = this.activity.snapshot;
  now = Date.now();
  lastOp: ActivityOperation | null = null;
  lastHerb = 0;
  lastKey = 0;
  herbHeld = 0;
  keyHeld = 0;
  lastError: ActivityRejectCode | null = null;
  pendingId: string | null = null;
  busy = false;

  /**
   * The "+1 Starlight Herb" that rises off the art on a successful gather.
   * Same @for-array-keyed-by-fresh-id device as the Seamworks page: a fresh
   * DOM node per grant is what restarts the CSS animation on back-to-back
   * gathers.
   */
  floaters: Floater[] = [];
  private floaterSeq = 0;
  private floaterTimers: Array<ReturnType<typeof setTimeout>> = [];

  ngOnInit(): void {
    this.activity.init();
    this.title.setTitle(this.t('canopy.titlePage'));
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.inventory.snapshot$.subscribe(() => {
      this.refreshHeld();
      this.cdr.markForCheck();
    }));
    this.sub.add(this.i18n.currentLanguage$.subscribe(() => {
      this.title.setTitle(this.t('canopy.titlePage'));
    }));
    if (this.isBrowser) {
      if (this.activity.snapshot.currentWork?.locationId !== ROOTGLASS_CANOPY_ID) {
        this.activity.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID);
      }
      if (!this.activity.bagCanTakeOre(this.selectedHerbId)) this.keeper.show('bank');
      this.clock = setInterval(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      }, 100);
    }
  }

  /** Foraging level derived the same way hub-skills reads it: off the live XP total, not a cached field. */
  currentLevel(): number {
    return miningLevelView(this.snap.progress.xpByDiscipline.foraging ?? 0).level;
  }

  tierUnlocked(tier: ForagingTier): boolean {
    return isForagingTierUnlocked(tier, this.currentLevel());
  }

  selectTier(tier: ForagingTier): void {
    if (!this.tierUnlocked(tier) || this.selectedHerbId === tier.herbId) return;
    this.selectedHerbId = tier.herbId;
    // A stale "+1 Starlight Herb" from the old growth would misdescribe the
    // new one, so the last-gather readout clears on every tier switch.
    this.lastOp = null;
    this.lastHerb = 0;
    this.lastKey = 0;
    this.refreshHeld();
  }

  selectedTier(): ForagingTier {
    return this.tiers.find(tier => tier.herbId === this.selectedHerbId) ?? this.tiers[0];
  }

  get herb(): MaterialDisplay {
    return materialDisplay(this.selectedHerbId) ?? materialDisplay(STARLIGHT_HERB_ID)!;
  }

  tierArt(tier: ForagingTier): MaterialDisplay {
    return materialDisplay(tier.herbId) ?? materialDisplay(STARLIGHT_HERB_ID)!;
  }

  private refreshHeld(): void {
    this.herbHeld = this.inventory.stackOf(this.selectedHerbId);
    this.keyHeld = this.inventory.stackOf(RIFT_KEY_ID);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
    for (const t of this.floaterTimers) clearTimeout(t);
  }

  herbFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'herb'); }
  keyFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'key'); }

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

  /** 0 hides the line entirely — see foragingSpeedupPct's own doc comment. */
  speedupPct(): number {
    return this.activity.foragingSpeedupPct();
  }

  panelState(): GatherPanelState {
    if (this.busy) return 'resolving';
    if (this.lastError === 'persist') return 'persist';
    if (!this.activity.bagCanTakeOre(this.selectedHerbId)) return 'capacity';
    if (this.lastError === 'location' || this.lastError === 'not-selected') return 'location';
    if (this.remain() > 0) return 'recovering';
    if (!this.isBrowser) return 'unavailable';
    return 'available';
  }

  openBag(): void {
    this.keeper.show('bank');
  }

  gatherDisabled(): boolean {
    const state = this.panelState();
    return state !== 'available' && state !== 'persist';
  }

  gather(): void {
    if (this.gatherDisabled() && this.panelState() !== 'persist') return;
    if (this.snap.currentWork?.locationId !== ROOTGLASS_CANOPY_ID) {
      this.activity.selectCurrentWork('foraging', ROOTGLASS_CANOPY_ID, this.now);
    }
    const mutationId = this.pendingId ?? newMutationId();
    this.pendingId = mutationId;
    this.busy = true;
    // Captured before the gather resolves. this.snap updates synchronously
    // off the gateway's BehaviorSubject, so comparing it against the same
    // field right after resolveForage() returns is enough to catch a level
    // crossing — no separate read of the gateway is needed.
    const xpBefore = this.snap.progress.xpByDiscipline.foraging ?? 0;
    const result = this.activity.resolveForage({
      mutationId,
      locationId: ROOTGLASS_CANOPY_ID,
      herbId: this.selectedHerbId,
    });
    this.busy = false;
    if (result.ok) {
      this.lastOp = result.operation;
      this.lastHerb = grantQty(result.operation, this.selectedHerbId);
      this.lastKey = grantQty(result.operation, RIFT_KEY_ID);
      this.lastError = null;
      this.pendingId = null;
      this.refreshHeld();
      if (this.lastHerb > 0) this.spawnFloater('herb', `+${this.lastHerb}`);
      if (this.lastKey > 0) this.spawnFloater('key', `+${this.lastKey}`);
      this.levelUp.checkForaging(xpBefore, this.snap.progress.xpByDiscipline.foraging ?? 0);
      if (this.lastKey > 0 || this.keeper.isOpen) this.keeper.show('bank');
      this.cdr.markForCheck();
      return;
    }
    this.lastError = result.code;
    if (result.code === 'capacity') this.keeper.show('bank');
    if (result.code !== 'persist') this.pendingId = null;
  }

  retry(): void {
    this.gather();
  }

  refresh(): void {
    this.lastError = null;
    this.pendingId = null;
  }

  discoveryLabel(): string {
    const result = this.lastOp?.discovery.result;
    if (result === 'rift-key') return this.t('canopy.discovery.bonus');
    if (result === 'rift-key-guarantee') return this.t('canopy.discovery.guarantee');
    if (this.lastOp) return this.t('canopy.discovery.none');
    return this.t('canopy.discovery.pending', { chance: this.chance, at: this.guaranteeAt });
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
  return `forage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
