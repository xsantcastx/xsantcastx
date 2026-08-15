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
  EMBER_DISCOVERY_CHANCE,
  MINING_RECOVERY_MS,
  type ActivityLedger,
  type ActivityOperation,
} from '../shared/activity/activity.model';
import { ChapterGateway } from '../shared/narrative/chapter.gateway';
import { infernalChoiceById } from '../shared/narrative/infernal-chapter';
import { CINDER_ORE_DISPLAY, EMBER_RESIDUE_DISPLAY } from '../shared/rpg/material-catalog';
import { KeeperPanelService } from '../shared/keeper/keeper-panel.service';
import { InventoryService } from '../shared/rpg/inventory.service';

type MinePanelState =
  | 'available'
  | 'resolving'
  | 'recovering'
  | 'capacity'
  | 'location'
  | 'persist'
  | 'unavailable';

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
  readonly ore = CINDER_ORE_DISPLAY;
  readonly ember = EMBER_RESIDUE_DISPLAY;
  readonly recoveryMs = MINING_RECOVERY_MS;
  readonly chance = Math.round(EMBER_DISCOVERY_CHANCE * 100);

  snap: ActivityLedger = this.activity.snapshot;
  now = Date.now();
  lastOp: ActivityOperation | null = null;
  lastError: ActivityRejectCode | null = null;
  pendingId: string | null = null;
  busy = false;

  ngOnInit(): void {
    this.activity.init();
    this.chapters.init();
    this.title.setTitle(this.t('seamworks.titlePage'));
    this.sub = this.activity.snapshot$.subscribe(snap => { this.snap = snap; });
    this.sub.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    this.sub.add(this.i18n.currentLanguage$.subscribe(() => {
      this.title.setTitle(this.t('seamworks.titlePage'));
    }));
    if (this.isBrowser) {
      if (!this.activity.snapshot.currentWork) {
        this.activity.selectCurrentWork('mining', BASALT_SEAMWORKS_ID);
      }
      if (!this.activity.bagCanTakeOre()) this.keeper.show('bank');
      this.clock = setInterval(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
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

  panelState(): MinePanelState {
    if (this.busy) return 'resolving';
    if (this.lastError === 'persist') return 'persist';
    if (!this.activity.bagCanTakeOre()) return 'capacity';
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
    const result = this.activity.resolveMine({
      mutationId,
      locationId: BASALT_SEAMWORKS_ID,
    });
    this.busy = false;
    if (result.ok) {
      this.lastOp = result.operation;
      this.lastError = null;
      this.pendingId = null;
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

function newMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
