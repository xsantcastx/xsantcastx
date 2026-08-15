/**
 * activity-progression.gateway.ts — sole writer of Current Work and operations.
 *
 * C7: no templates, no Mine button. Tests and a later C8 panel call this.
 * An action creates one immutable operation, then applies its grant IDs once.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import { DEVICE_ID_KEY } from '../economy/economy-ops';
import { InventoryService } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  ACTIVITY_KEY,
  MINING_RECOVERY_MS,
  emptyActivityLedger,
  locationDefinition,
  type ActivityLedger,
  type ActivityOperation,
  type CurrentWork,
  type DisciplineId,
} from './activity.model';
import {
  buildMineOperation,
  coerceActivityLedger,
  compareHlc,
  hasEmberBeforeCraft,
  isEnabledMine,
  miningEligibleCount,
  newestOperation,
  nextHlc,
  progressFromOps,
  rebuildCurrentWork,
  rollDiscovery,
} from './activity-ops';

export type ActivityRejectCode =
  | 'ssr'
  | 'not-selected'
  | 'location'
  | 'recovering'
  | 'clock'
  | 'capacity'
  | 'persist';

export type ActivityResolveResult =
  | { ok: true; operation: ActivityOperation; replayed: boolean }
  | { ok: false; code: ActivityRejectCode };

@Injectable({ providedIn: 'root' })
export class ActivityProgressionGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private ledger = emptyActivityLedger();
  private deviceId = 'unknown';
  private initialised = false;
  private lastHlc: import('./activity.model').HlcRevision | null = null;

  private readonly snapshot$$ = new BehaviorSubject<ActivityLedger>(emptyActivityLedger());
  readonly snapshot$ = this.snapshot$$.asObservable();
  get snapshot(): ActivityLedger { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.inventory.init();
    this.deviceId = this.readDeviceId();
    this.ledger = this.load();
    this.lastHlc = this.highestHlc(this.ledger);
    this.publish();
    this.saves.register(ACTIVITY_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.lastHlc = this.highestHlc(this.ledger);
        this.publish();
      },
    });
  }

  selectCurrentWork(disciplineId: DisciplineId, locationId: string, now = Date.now()): CurrentWork | null {
    if (!this.isBrowser) return null;
    const place = locationDefinition(locationId);
    if (!place || !place.enabledDisciplines.includes(disciplineId)) return null;
    const startedAt = new Date(now).toISOString();
    const selectionRevision = nextHlc(this.lastHlc, this.deviceId, now);
    this.lastHlc = selectionRevision;
    const work: CurrentWork = {
      version: 2,
      disciplineId,
      locationId,
      startedAt,
      lastResolvedAt: startedAt,
      selectionRevision,
    };
    const previous = this.ledger;
    this.ledger = { ...this.ledger, currentWork: work };
    if (!this.save()) {
      this.ledger = previous;
      return null;
    }
    this.publish();
    return work;
  }

  resolveMine(input: {
    mutationId: string;
    locationId?: string;
    now?: number;
    roll?: number;
  }): ActivityResolveResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    const existing = this.ledger.operations.find(op => op.id === input.mutationId);
    if (existing) return { ok: true, operation: existing, replayed: true };

    const now = input.now ?? Date.now();
    if (!Number.isFinite(now)) return { ok: false, code: 'clock' };

    const work = this.ledger.currentWork;
    if (!work) return { ok: false, code: 'not-selected' };
    const locationId = input.locationId ?? work.locationId;
    if (locationId !== work.locationId || !isEnabledMine(locationId, work.disciplineId)) {
      return { ok: false, code: 'location' };
    }

    const last = newestOperation(this.ledger.operations, work);
    if (last) {
      const lastAt = Date.parse(last.resolvedAt);
      if (!Number.isFinite(lastAt) || now < lastAt) return { ok: false, code: 'clock' };
      if (now < lastAt + MINING_RECOVERY_MS) return { ok: false, code: 'recovering' };
    }

    if (!this.inventory.canAcceptStackGrant('cinder-ore')) {
      return { ok: false, code: 'capacity' };
    }

    const discovery = rollDiscovery({
      eligibleIndex: Math.max(
        this.ledger.miningAccepted,
        miningEligibleCount(this.ledger.operations, locationId),
      ) + 1,
      previousEmber: this.ledger.emberGranted || hasEmberBeforeCraft(this.ledger.operations),
      craftedBasaltEdge: this.ledger.craftedBasaltEdge,
      roll: input.roll ?? Math.random(),
    });
    const operation = buildMineOperation({
      id: input.mutationId,
      deviceId: this.deviceId,
      previousHlc: this.lastHlc,
      now,
      locationId,
      discovery,
    });

    const previous = this.ledger;
    const operations = [...this.ledger.operations, operation];
    this.ledger = {
      ...this.ledger,
      operations,
      progress: progressFromOps(operations),
      currentWork: rebuildCurrentWork(work, operations),
      emberGranted: this.ledger.emberGranted || operation.discovery.result !== 'none',
      miningAccepted: Math.max(
        this.ledger.miningAccepted,
        miningEligibleCount(operations, locationId),
      ),
    };
    this.lastHlc = operation.hlcRevision;

    if (!this.applyGrants(operation) || !this.save()) {
      this.ledger = previous;
      this.lastHlc = this.highestHlc(previous);
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return { ok: true, operation, replayed: false };
  }

  private applyGrants(operation: ActivityOperation): boolean {
    for (const grant of operation.inventoryGrants) {
      if (!this.inventory.grantStack(grant.id, grant.definitionId, grant.quantity)) return false;
    }
    return true;
  }

  private highestHlc(ledger: ActivityLedger) {
    let best = ledger.currentWork?.selectionRevision ?? null;
    for (const op of ledger.operations) {
      if (!best || compareHlc(op.hlcRevision, best) > 0) best = op.hlcRevision;
    }
    return best;
  }

  private load(): ActivityLedger {
    try {
      const raw = this.store.readRaw(ACTIVITY_KEY);
      if (!raw) return emptyActivityLedger();
      return coerceActivityLedger(JSON.parse(raw)) ?? emptyActivityLedger();
    } catch {
      return emptyActivityLedger();
    }
  }

  private save(): boolean {
    const raw = JSON.stringify(this.ledger);
    this.store.write(ACTIVITY_KEY, this.ledger);
    return this.store.readRaw(ACTIVITY_KEY) === raw;
  }

  private publish(): void {
    this.snapshot$$.next(this.ledger);
  }

  private readDeviceId(): string {
    try {
      return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
