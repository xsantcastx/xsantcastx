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
import { eraIsCurrent, ledgerFromPriorEra, REALM_ERA } from '../save/realm-era';
import {
  ACTIVITY_KEY,
  MINING_TIERS,
  emptyActivityLedger,
  isMiningTierUnlocked,
  locationDefinition,
  miningTierFor,
  type ActivityLedger,
  type ActivityOperation,
  type CurrentWork,
  type DisciplineId,
} from './activity.model';
import { effectiveMiningRecoveryMs, miningSpeedupPct } from './mining-recovery';
import { miningLevelView } from './mining-level';
import {
  buildMineOperation,
  coerceActivityLedger,
  compareHlc,
  foragingEligibleCount,
  hasClarityElixir,
  hasEmberBeforeCraft,
  hasRiftKey,
  isEnabledMine,
  prospectingEligibleCount,
  miningEligibleCount,
  newestOperation,
  nextHlc,
  progressFromOps,
  rebuildCurrentWork,
  rollDiscovery,
} from './activity-ops';
import { FORAGING_TIERS, foragingTierFor, isForagingTierUnlocked } from './foraging.model';
import {
  buildForageOperation,
  effectiveForagingRecoveryMs,
  foragingSpeedupPct,
  isEnabledForage,
  rollForageDiscovery,
} from './foraging-ops';
import { PROSPECTING_TIERS, isProspectingTierUnlocked, prospectingTierFor } from './prospecting.model';
import {
  buildProspectOperation,
  effectiveProspectingRecoveryMs,
  isEnabledProspect,
  prospectingSpeedupPct,
  rollProspectDiscovery,
} from './prospecting-ops';

export type ActivityRejectCode =
  | 'ssr'
  | 'not-selected'
  | 'location'
  | 'recovering'
  | 'clock'
  | 'capacity'
  | 'persist'
  | 'tier-locked';

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
    this.syncCraftedFlag();
    this.saves.register(ACTIVITY_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.lastHlc = this.highestHlc(this.ledger);
        this.publish();
        this.syncCraftedFlag();
      },
    });
  }

  markCraftedBasaltEdge(): boolean {
    if (!this.isBrowser) return false;
    if (this.ledger.craftedBasaltEdge) return true;
    const previous = this.ledger;
    this.ledger = { ...this.ledger, craftedBasaltEdge: true };
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  private syncCraftedFlag(): void {
    if (this.ledger.craftedBasaltEdge) return;
    if (this.inventory.hasBasaltEdge()) this.markCraftedBasaltEdge();
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

  /**
   * One curve for every discipline (mining-level.ts is skill-agnostic; only
   * its name is historical). The skill authoring spec §11 names this as one of
   * the generalisations the *third* skill is allowed to make: two private
   * twins were legible, three would have been a copy-paste tax. The per-verb
   * `resolve*` methods stay concrete — their check ordering and pity inputs
   * genuinely differ.
   */
  private levelOf(discipline: DisciplineId): number {
    return miningLevelView(this.ledger.progress.xpByDiscipline[discipline] ?? 0).level;
  }

  private currentMiningLevel(): number {
    return this.levelOf('mining');
  }

  private currentForagingLevel(): number {
    return this.levelOf('foraging');
  }

  private currentProspectingLevel(): number {
    return this.levelOf('prospecting');
  }

  /**
   * How long the seam takes to recover right now, given the current level
   * and whatever is in the weapon slot. Recomputed live rather than baked
   * into the operation at strike time: a Keeper who levels up or re-equips
   * mid-wait should see the remaining time drop immediately, the same way a
   * cooldown-reduction buff works in most games — not only affect the next
   * wait.
   */
  currentMiningRecoveryMs(): number {
    const strikePower = this.inventory.snapshot.equipped['weapon']?.stats.strikePower ?? 0;
    return effectiveMiningRecoveryMs(this.currentMiningLevel(), strikePower);
  }

  /** Whole-percent readout for the Seamworks page. 0 hides the line entirely. */
  miningSpeedupPct(): number {
    const strikePower = this.inventory.snapshot.equipped['weapon']?.stats.strikePower ?? 0;
    // The bare call resolves to the imported pure function above, not to this
    // method — a class method name isn't in scope inside its own body, only
    // `this.miningSpeedupPct` would be. Same name is deliberate symmetry with
    // currentMiningRecoveryMs()/effectiveMiningRecoveryMs() just above.
    return miningSpeedupPct(this.currentMiningLevel(), strikePower);
  }

  /**
   * A2 Foraging's cooldown. Level term only — no gathering stat exists on any
   * item, so unlike currentMiningRecoveryMs nothing in the weapon slot
   * shortens it (see foraging-ops.ts's header).
   */
  currentForagingRecoveryMs(): number {
    return effectiveForagingRecoveryMs(this.currentForagingLevel());
  }

  /** Whole-percent readout for the Canopy page. 0 hides the line entirely. */
  foragingSpeedupPct(): number {
    // Same self-name note as miningSpeedupPct above: this resolves to the
    // imported pure function, not to the method.
    return foragingSpeedupPct(this.currentForagingLevel());
  }

  /**
   * B1 Prospecting's cooldown. Level term only, same as Foraging's and for
   * the same reason — no prospecting tool stat exists on any item, and
   * borrowing the weapon's strikePower would let a sword speed up reading a
   * star chart (see prospecting-ops.ts's header).
   */
  currentProspectingRecoveryMs(): number {
    return effectiveProspectingRecoveryMs(this.currentProspectingLevel());
  }

  /** Whole-percent readout for the Orrery page. 0 hides the line entirely. */
  prospectingSpeedupPct(): number {
    // Same self-name note as miningSpeedupPct above: this resolves to the
    // imported pure function, not to the method.
    return prospectingSpeedupPct(this.currentProspectingLevel());
  }

  /**
   * The cooldown that applies to whatever Current Work is selected. Before A2
   * every caller of recoveryEndsAt silently assumed mining; the current-work
   * tile's "of Ns" readout and the two site pages all go through this so a
   * foraging Current Work never shows the mining number.
   */
  currentRecoveryMs(): number {
    const fn = RECOVERY_BY_DISCIPLINE[this.ledger.currentWork?.disciplineId ?? ''];
    return fn ? fn(this) : this.currentMiningRecoveryMs();
  }

  recoveryEndsAt(): number | null {
    const work = this.ledger.currentWork;
    if (!work) return null;
    const last = newestOperation(this.ledger.operations, work);
    if (!last) return null;
    const lastAt = Date.parse(last.resolvedAt);
    if (!Number.isFinite(lastAt)) return null;
    return lastAt + this.currentRecoveryMs();
  }

  recoveryRemainingMs(now = Date.now()): number {
    const end = this.recoveryEndsAt();
    if (end == null) return 0;
    return Math.max(0, end - now);
  }

  /** Live bag check — do not latch a capacity error after the player drops. */
  bagCanTake(definitionId = 'cinder-ore'): boolean {
    return this.inventory.canAcceptStackGrant(definitionId);
  }

  /**
   * The mining-flavoured name every existing caller uses. The spec's §11 list
   * renames it at the third skill and keeps the old name as an alias for one
   * release, because "can the bag take this ore" is what the Canopy and the
   * Orrery have both been asking about herbs and minerals.
   *
   * @deprecated Call `bagCanTake` instead. Removed one release after B1.
   */
  bagCanTakeOre(oreId = 'cinder-ore'): boolean {
    return this.bagCanTake(oreId);
  }

  resolveMine(input: {
    mutationId: string;
    locationId?: string;
    /** Which seam tier to strike. Defaults to Cinder Ore — always unlocked. */
    oreId?: string;
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

    // The client picks a seam; the gateway is the only party trusted to
    // decide whether the Keeper's level has actually opened it.
    const tier = (input.oreId ? miningTierFor(input.oreId) : undefined) ?? MINING_TIERS[0];
    if (!isMiningTierUnlocked(tier, this.currentMiningLevel())) {
      return { ok: false, code: 'tier-locked' };
    }

    const last = newestOperation(this.ledger.operations, work);
    if (last) {
      const lastAt = Date.parse(last.resolvedAt);
      if (!Number.isFinite(lastAt) || now < lastAt) return { ok: false, code: 'clock' };
      if (now < lastAt + this.currentMiningRecoveryMs()) return { ok: false, code: 'recovering' };
    }

    if (!this.inventory.canAcceptStackGrant(tier.oreId)) {
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
      oreId: tier.oreId,
      xpAmount: tier.xpPerAction,
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

  /**
   * A2 Foraging — a line-for-line sibling of resolveMine, kept concrete on
   * purpose (the brief forbids a resolveAction framework until a third skill
   * shows what the two actually share). Same reject codes, same rollback.
   */
  resolveForage(input: {
    mutationId: string;
    locationId?: string;
    /** Which growth to gather. Defaults to Starlight Herb — always unlocked. */
    herbId?: string;
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
    if (locationId !== work.locationId || !isEnabledForage(locationId, work.disciplineId)) {
      return { ok: false, code: 'location' };
    }

    // The client picks a growth; the gateway alone decides whether the
    // Keeper's foraging level has actually opened it.
    const tier = (input.herbId ? foragingTierFor(input.herbId) : undefined) ?? FORAGING_TIERS[0];
    if (!isForagingTierUnlocked(tier, this.currentForagingLevel())) {
      return { ok: false, code: 'tier-locked' };
    }

    const last = newestOperation(this.ledger.operations, work);
    if (last) {
      const lastAt = Date.parse(last.resolvedAt);
      if (!Number.isFinite(lastAt) || now < lastAt) return { ok: false, code: 'clock' };
      if (now < lastAt + this.currentForagingRecoveryMs()) return { ok: false, code: 'recovering' };
    }

    if (!this.inventory.canAcceptStackGrant(tier.herbId)) {
      return { ok: false, code: 'capacity' };
    }

    const discovery = rollForageDiscovery({
      eligibleIndex: Math.max(
        this.ledger.foragingAccepted,
        foragingEligibleCount(this.ledger.operations, locationId),
      ) + 1,
      previousRiftKey: this.ledger.riftKeyGranted || hasRiftKey(this.ledger.operations),
      roll: input.roll ?? Math.random(),
    });
    const operation = buildForageOperation({
      id: input.mutationId,
      deviceId: this.deviceId,
      previousHlc: this.lastHlc,
      now,
      locationId,
      herbId: tier.herbId,
      xpAmount: tier.xpPerAction,
      discovery,
    });

    const previous = this.ledger;
    const operations = [...this.ledger.operations, operation];
    this.ledger = {
      ...this.ledger,
      operations,
      progress: progressFromOps(operations),
      currentWork: rebuildCurrentWork(work, operations),
      riftKeyGranted: this.ledger.riftKeyGranted || operation.discovery.result !== 'none',
      foragingAccepted: Math.max(
        this.ledger.foragingAccepted,
        foragingEligibleCount(operations, locationId),
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

  /**
   * B1 Prospecting — the third line-for-line sibling. Still concrete: the
   * spec's §11 list keeps `resolve*` per-verb even at skill three, because a
   * `resolveAction(discipline, …)` would hide the reject ordering and the
   * per-skill pity inputs (Mining reads craftedBasaltEdge; these two do not).
   */
  resolveProspect(input: {
    mutationId: string;
    locationId?: string;
    /** Which cut of the rings to survey. Defaults to Celestial Alloy — always unlocked. */
    mineralId?: string;
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
    if (locationId !== work.locationId || !isEnabledProspect(locationId, work.disciplineId)) {
      return { ok: false, code: 'location' };
    }

    // The client picks a cut; the gateway alone decides whether the Keeper's
    // prospecting level has actually opened it.
    const tier = (input.mineralId ? prospectingTierFor(input.mineralId) : undefined) ?? PROSPECTING_TIERS[0];
    if (!isProspectingTierUnlocked(tier, this.currentProspectingLevel())) {
      return { ok: false, code: 'tier-locked' };
    }

    const last = newestOperation(this.ledger.operations, work);
    if (last) {
      const lastAt = Date.parse(last.resolvedAt);
      if (!Number.isFinite(lastAt) || now < lastAt) return { ok: false, code: 'clock' };
      if (now < lastAt + this.currentProspectingRecoveryMs()) return { ok: false, code: 'recovering' };
    }

    if (!this.inventory.canAcceptStackGrant(tier.mineralId)) {
      return { ok: false, code: 'capacity' };
    }

    const discovery = rollProspectDiscovery({
      eligibleIndex: Math.max(
        this.ledger.prospectingAccepted,
        prospectingEligibleCount(this.ledger.operations, locationId),
      ) + 1,
      previousClarityElixir: this.ledger.clarityElixirGranted || hasClarityElixir(this.ledger.operations),
      roll: input.roll ?? Math.random(),
    });
    const operation = buildProspectOperation({
      id: input.mutationId,
      deviceId: this.deviceId,
      previousHlc: this.lastHlc,
      now,
      locationId,
      mineralId: tier.mineralId,
      xpAmount: tier.xpPerAction,
      discovery,
    });

    const previous = this.ledger;
    const operations = [...this.ledger.operations, operation];
    this.ledger = {
      ...this.ledger,
      operations,
      progress: progressFromOps(operations),
      currentWork: rebuildCurrentWork(work, operations),
      clarityElixirGranted: this.ledger.clarityElixirGranted || operation.discovery.result !== 'none',
      prospectingAccepted: Math.max(
        this.ledger.prospectingAccepted,
        prospectingEligibleCount(operations, locationId),
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
      const loaded = coerceActivityLedger(JSON.parse(raw)) ?? emptyActivityLedger();
      if (eraIsCurrent(this.store) && ledgerFromPriorEra(loaded.era)) {
        return emptyActivityLedger();
      }
      return loaded.era === REALM_ERA ? loaded : { ...loaded, era: REALM_ERA };
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

/**
 * Which cooldown applies to which Current Work.
 *
 * Was a ternary on `disciplineId` while two skills were live; the skill
 * authoring spec §11 names this as one of the cuts the third skill makes,
 * because a third arm would have turned the ternary into a nest. The gateway
 * is still the sole owner of timing — this only routes to the method that
 * already computed it. Anything not listed (exploration, forge, hunting: not
 * live) falls through to Mining's number, exactly as the ternary did.
 */
const RECOVERY_BY_DISCIPLINE: Partial<Record<string, (gw: ActivityProgressionGateway) => number>> = {
  mining: gw => gw.currentMiningRecoveryMs(),
  foraging: gw => gw.currentForagingRecoveryMs(),
  prospecting: gw => gw.currentProspectingRecoveryMs(),
};
