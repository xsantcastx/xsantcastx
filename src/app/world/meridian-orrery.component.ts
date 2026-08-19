/**
 * meridian-orrery.component.ts — /world/realms/celestial/meridian-orrery
 *
 * The only public Survey control — B1 Prospecting's surface, a concrete copy
 * of rootglass-canopy.component.ts with the nouns swapped. The skill authoring
 * spec §11 is explicit that site pages stay concrete even at the third skill:
 * a shared "gathering page" would have to parameterise the scene, the accent,
 * the floaters, every line of copy and all seven screen-reader states — a
 * template framework for three users. Templates call the gateway; they do not
 * roll discovery, grant XP, or write inventory.
 *
 * Like the Canopy and (since d0e3ced) the Seamworks, this page claims Current
 * Work on entry whenever it points somewhere else, not only when it is empty:
 * with three sites, "null" and "elsewhere" are very different, and a Keeper
 * who walked here from either other site would otherwise see nothing but
 * 'location' rejects.
 *
 * No ChapterGateway and no chapter note: Celestial has no chapter component,
 * and nothing gates surveying.
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
  CELESTIAL_ALLOY_ID,
  CLARITY_ELIXIR_CHANCE,
  CLARITY_ELIXIR_GUARANTEE_AT,
  CLARITY_ELIXIR_ID,
  MERIDIAN_ORRERY_ID,
  PROSPECTING_TIERS,
  isProspectingTierUnlocked,
  type ProspectingTier,
} from '../shared/activity/prospecting.model';
import { miningLevelView } from '../shared/activity/mining-level';
import { materialDisplay, type MaterialDisplay } from '../shared/rpg/material-catalog';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';
import { LevelUpService } from '../shared/activity/level-up.service';
import { InventoryService } from '../shared/rpg/inventory.service';

type ProspectPanelState =
  | 'available'
  | 'resolving'
  | 'recovering'
  | 'capacity'
  | 'location'
  | 'persist'
  | 'unavailable';

type FloaterKind = 'mineral' | 'elixir';

interface Floater {
  id: number;
  kind: FloaterKind;
  text: string;
}

@Component({
  selector: 'app-meridian-orrery',
  standalone: true,
  imports: [RouterLink, ArtSceneComponent, CurrentWorkTileComponent],
  templateUrl: './meridian-orrery.component.html',
  styleUrls: ['./meridian-orrery.component.css'],
})
export class MeridianOrreryComponent implements OnInit, OnDestroy {
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

  readonly locationId = MERIDIAN_ORRERY_ID;
  readonly celestialHref = '/world/realms/celestial';
  readonly tiers = PROSPECTING_TIERS;
  /** The rare find. Named + painted via material-catalog so the bank and this page agree. */
  readonly elixir: MaterialDisplay = materialDisplay(CLARITY_ELIXIR_ID)!;
  readonly chance = Number((CLARITY_ELIXIR_CHANCE * 100).toPrecision(2));
  readonly guaranteeAt = CLARITY_ELIXIR_GUARANTEE_AT;

  /** Which cut is armed right now. Celestial Alloy is always open, so it's the default. */
  selectedMineralId: string = CELESTIAL_ALLOY_ID;

  snap: ActivityLedger = this.activity.snapshot;
  now = Date.now();
  lastOp: ActivityOperation | null = null;
  lastMineral = 0;
  lastElixir = 0;
  mineralHeld = 0;
  elixirHeld = 0;
  lastError: ActivityRejectCode | null = null;
  pendingId: string | null = null;
  busy = false;

  /**
   * The "+1" that rises off the art on a successful survey. Same
   * @for-array-keyed-by-fresh-id device as the other two site pages: a fresh
   * DOM node per grant is what restarts the CSS animation on back-to-back
   * surveys — a single @if field animates exactly once.
   */
  floaters: Floater[] = [];
  private floaterSeq = 0;
  private floaterTimers: Array<ReturnType<typeof setTimeout>> = [];

  ngOnInit(): void {
    this.activity.init();
    this.title.setTitle(this.t('orrery.titlePage'));
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.inventory.snapshot$.subscribe(() => {
      this.refreshHeld();
      this.cdr.markForCheck();
    }));
    this.sub.add(this.i18n.currentLanguage$.subscribe(() => {
      this.title.setTitle(this.t('orrery.titlePage'));
    }));
    if (this.isBrowser) {
      if (this.activity.snapshot.currentWork?.locationId !== MERIDIAN_ORRERY_ID) {
        this.activity.selectCurrentWork('prospecting', MERIDIAN_ORRERY_ID);
      }
      if (!this.activity.bagCanTake(this.selectedMineralId)) this.keeper.show('bank');
      this.clock = setInterval(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      }, 100);
    }
  }

  /** Prospecting level derived off the live XP total, not a cached field. */
  currentLevel(): number {
    return miningLevelView(this.snap.progress.xpByDiscipline.prospecting ?? 0).level;
  }

  tierUnlocked(tier: ProspectingTier): boolean {
    return isProspectingTierUnlocked(tier, this.currentLevel());
  }

  selectTier(tier: ProspectingTier): void {
    if (!this.tierUnlocked(tier) || this.selectedMineralId === tier.mineralId) return;
    this.selectedMineralId = tier.mineralId;
    // A stale "+1 Celestial Alloy" from the old cut would misdescribe the new
    // one, so the last-survey readout clears on every tier switch.
    this.lastOp = null;
    this.lastMineral = 0;
    this.lastElixir = 0;
    this.refreshHeld();
  }

  selectedTier(): ProspectingTier {
    return this.tiers.find(tier => tier.mineralId === this.selectedMineralId) ?? this.tiers[0];
  }

  get mineral(): MaterialDisplay {
    return materialDisplay(this.selectedMineralId) ?? materialDisplay(CELESTIAL_ALLOY_ID)!;
  }

  tierArt(tier: ProspectingTier): MaterialDisplay {
    return materialDisplay(tier.mineralId) ?? materialDisplay(CELESTIAL_ALLOY_ID)!;
  }

  private refreshHeld(): void {
    this.mineralHeld = this.inventory.stackOf(this.selectedMineralId);
    this.elixirHeld = this.inventory.stackOf(CLARITY_ELIXIR_ID);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
    for (const t of this.floaterTimers) clearTimeout(t);
  }

  mineralFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'mineral'); }
  elixirFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'elixir'); }

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

  /** 0 hides the line entirely — see prospectingSpeedupPct's own doc comment. */
  speedupPct(): number {
    return this.activity.prospectingSpeedupPct();
  }

  panelState(): ProspectPanelState {
    if (this.busy) return 'resolving';
    if (this.lastError === 'persist') return 'persist';
    if (!this.activity.bagCanTake(this.selectedMineralId)) return 'capacity';
    if (this.lastError === 'location' || this.lastError === 'not-selected') return 'location';
    if (this.remain() > 0) return 'recovering';
    if (!this.isBrowser) return 'unavailable';
    return 'available';
  }

  openBag(): void {
    this.keeper.show('bank');
  }

  prospectDisabled(): boolean {
    const state = this.panelState();
    return state !== 'available' && state !== 'persist';
  }

  prospect(): void {
    if (this.prospectDisabled() && this.panelState() !== 'persist') return;
    if (this.snap.currentWork?.locationId !== MERIDIAN_ORRERY_ID) {
      this.activity.selectCurrentWork('prospecting', MERIDIAN_ORRERY_ID, this.now);
    }
    const mutationId = this.pendingId ?? newMutationId();
    this.pendingId = mutationId;
    this.busy = true;
    // Captured before the survey resolves. this.snap updates synchronously off
    // the gateway's BehaviorSubject, so comparing it against the same field
    // right after resolveProspect() returns is enough to catch a level
    // crossing — and it can only ever fire for XP earned in this session.
    const xpBefore = this.snap.progress.xpByDiscipline.prospecting ?? 0;
    const result = this.activity.resolveProspect({
      mutationId,
      locationId: MERIDIAN_ORRERY_ID,
      mineralId: this.selectedMineralId,
    });
    this.busy = false;
    if (result.ok) {
      this.lastOp = result.operation;
      this.lastMineral = grantQty(result.operation, this.selectedMineralId);
      this.lastElixir = grantQty(result.operation, CLARITY_ELIXIR_ID);
      this.lastError = null;
      this.pendingId = null;
      this.refreshHeld();
      if (this.lastMineral > 0) this.spawnFloater('mineral', `+${this.lastMineral}`);
      if (this.lastElixir > 0) this.spawnFloater('elixir', `+${this.lastElixir}`);
      this.levelUp.checkProspecting(xpBefore, this.snap.progress.xpByDiscipline.prospecting ?? 0);
      if (this.lastElixir > 0 || this.keeper.isOpen) this.keeper.show('bank');
      this.cdr.markForCheck();
      return;
    }
    this.lastError = result.code;
    if (result.code === 'capacity') this.keeper.show('bank');
    if (result.code !== 'persist') this.pendingId = null;
  }

  retry(): void {
    this.prospect();
  }

  refresh(): void {
    this.lastError = null;
    this.pendingId = null;
  }

  discoveryLabel(): string {
    const result = this.lastOp?.discovery.result;
    if (result === 'clarity-elixir') return this.t('orrery.discovery.bonus');
    if (result === 'clarity-elixir-guarantee') return this.t('orrery.discovery.guarantee');
    if (this.lastOp) return this.t('orrery.discovery.none');
    return this.t('orrery.discovery.pending', { chance: this.chance, at: this.guaranteeAt });
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
  return `prospect-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
