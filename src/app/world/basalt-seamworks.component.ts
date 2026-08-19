/**
 * basalt-seamworks.component.ts — /world/realms/infernal/basalt-seamworks
 *
 * The only public Mine control. Templates call the gateway; they do not
 * roll discovery, grant XP, or write inventory.
 *
 * C1 Refining lives here too: three of one ore tier become one of the next.
 * That is a pure inventory transform — no XP, no activity-ledger op, no level
 * gate — so it goes straight to InventoryService.refineStack (the sole stack
 * writer), never through the gateway. The mining flow is untouched by it.
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
import {
  REFINE_RECIPES,
  maxRefineBatches,
  refinePreview,
  type RefinePreview,
  type RefineRecipe,
} from '../shared/rpg/refine-ops';

type MinePanelState =
  | 'available'
  | 'resolving'
  | 'recovering'
  | 'capacity'
  | 'location'
  | 'persist'
  | 'unavailable';

type FloaterKind = 'ore' | 'ember' | 'refine';

/** Which figure of a refine row a 'refine' floater rises off. */
type RefineFloaterRole = 'source' | 'target';

interface Floater {
  id: number;
  kind: FloaterKind;
  text: string;
  /**
   * Which refine row owns a 'refine' floater (its recipe.from) and which of
   * that row's two figures it rises off. Keyed by row + role rather than by
   * ore id on purpose: slag-fragment is the target of one recipe and the
   * source of the next, so a stack-keyed floater would render on both rows.
   * Unset for ore/ember.
   */
  refine?: { row: string; role: RefineFloaterRole };
}

/** ×1, ×5, or everything the source stack can fund. */
type RefineChoice = 1 | 5 | 'max';

/** How long a first click stays armed before it quietly disarms itself. */
const REFINE_ARM_MS = 6000;

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

  // ── C1 Refining ──────────────────────────────────────────────────────────
  readonly recipes = REFINE_RECIPES;
  /** Held count per ore id, refreshed off every inventory snapshot. */
  heldByOre: Record<string, number> = {};
  /** Batch choice per recipe source, ×1 unless the player picked otherwise. */
  refineChoiceBy: Record<string, RefineChoice> = {};
  /** The first click of the two-step confirm; null when nothing is armed. */
  refineArmed: { from: string; preview: RefinePreview } | null = null;
  private refineArmTimer?: ReturnType<typeof setTimeout>;
  /** Kept only across a persist retry, exactly like pendingId for Mine. */
  refinePending: { id: string; from: string; batches: number } | null = null;
  refineError: { from: string; code: 'capacity' | 'persist' | 'stale' } | null = null;
  lastRefine: { from: string; to: string; consumed: number; produced: number } | null = null;

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
      // Re-select whenever Current Work points anywhere else, not only when it
      // is empty: a Keeper who walked here from the Rootglass Canopy still has
      // foraging@Canopy selected, and every Mine would be rejected with
      // 'location' while the page shows the "return here" alert. Mirrors
      // rootglass-canopy.component.ts — each site claims Current Work on entry.
      if (this.activity.snapshot.currentWork?.locationId !== BASALT_SEAMWORKS_ID) {
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
    this.disarmRefine();
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
    const held: Record<string, number> = {};
    for (const tier of this.tiers) held[tier.oreId] = this.inventory.stackOf(tier.oreId);
    this.heldByOre = held;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
    if (this.refineArmTimer) clearTimeout(this.refineArmTimer);
    for (const t of this.floaterTimers) clearTimeout(t);
  }

  oreFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'ore'); }
  emberFloaters(): Floater[] { return this.floaters.filter(f => f.kind === 'ember'); }
  /** The '−N' / '+N' floaters for one figure of one refine row — never its neighbour row's. */
  refineFloaters(recipe: RefineRecipe, role: RefineFloaterRole): Floater[] {
    return this.floaters.filter(f => f.kind === 'refine' && f.refine?.row === recipe.from && f.refine.role === role);
  }

  private spawnFloater(kind: FloaterKind, text: string, refine?: Floater['refine']): void {
    const id = ++this.floaterSeq;
    this.floaters = [...this.floaters, { id, kind, text, refine }];
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
    if (this.snap.currentWork?.locationId !== BASALT_SEAMWORKS_ID) {
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

  // ── C1 Refining ──────────────────────────────────────────────────────────

  artOf(oreId: string): MaterialDisplay {
    return materialDisplay(oreId) ?? CINDER_ORE_DISPLAY!;
  }

  heldOf(oreId: string): number {
    return this.heldByOre[oreId] ?? 0;
  }

  /**
   * The live choice for a recipe. A pick the stack can no longer fund — ×5
   * after a refine left four ore — quietly falls back to ×1, so the button
   * always describes something the player could do next.
   */
  refineChoice(recipe: RefineRecipe): RefineChoice {
    const choice = this.refineChoiceBy[recipe.from] ?? 1;
    const max = maxRefineBatches(this.heldOf(recipe.from), recipe.ratio);
    if (choice === 5 && max < 5) return 1;
    if (choice === 'max' && max < 1) return 1;
    return choice;
  }

  /**
   * The amounts on offer for one recipe: ×1, ×5, and "everything". A choice
   * the stack cannot fund is still listed, disabled, so the player sees what
   * a bigger stack would unlock — the same shape as hub-bank's dropChoices,
   * which never offers more than is held.
   */
  refineChoices(recipe: RefineRecipe): ReadonlyArray<{ key: RefineChoice; batches: number; label: string; enabled: boolean }> {
    const max = maxRefineBatches(this.heldOf(recipe.from), recipe.ratio);
    return [
      { key: 1, batches: 1, label: this.t('seamworks.refine.choice', { n: 1 }), enabled: true },
      { key: 5, batches: 5, label: this.t('seamworks.refine.choice', { n: 5 }), enabled: max >= 5 },
      { key: 'max', batches: max, label: this.t('seamworks.refine.choiceMax', { n: max }), enabled: max >= 1 },
    ];
  }

  pickRefineChoice(recipe: RefineRecipe, choice: RefineChoice): void {
    this.refineChoiceBy = { ...this.refineChoiceBy, [recipe.from]: choice };
    this.disarmRefine();
  }

  /** Whole batches the current choice asks for. "Max" of a stack under 3 asks for 1, so the reason reads "needs 3". */
  refineBatches(recipe: RefineRecipe): number {
    const choice = this.refineChoice(recipe);
    if (choice === 'max') return Math.max(1, maxRefineBatches(this.heldOf(recipe.from), recipe.ratio));
    return choice;
  }

  refinePreviewFor(recipe: RefineRecipe): RefinePreview {
    return refinePreview({ fromOreId: recipe.from, have: this.heldOf(recipe.from), batches: this.refineBatches(recipe) });
  }

  /** Why the Refine button is disabled, or null when it is live. */
  refineBlocker(recipe: RefineRecipe): 'insufficient' | 'capacity' | null {
    if (!this.refinePreviewFor(recipe).ok) return 'insufficient';
    if (!this.inventory.canAcceptStackGrant(recipe.to)) return 'capacity';
    return null;
  }

  refineDisabled(recipe: RefineRecipe): boolean {
    if (!this.isBrowser) return true;
    if (this.refineError?.from === recipe.from && this.refineError.code === 'persist') return false;
    return this.refineBlocker(recipe) !== null;
  }

  isRefineArmed(recipe: RefineRecipe): boolean {
    return this.refineArmed?.from === recipe.from;
  }

  /** First click arms, second click within REFINE_ARM_MS confirms. */
  refineClick(recipe: RefineRecipe): void {
    if (this.isRefineArmed(recipe)) {
      this.confirmRefine(recipe);
      return;
    }
    if (this.refineDisabled(recipe)) return;
    const preview = this.refinePreviewFor(recipe);
    if (!preview.ok) return;
    this.disarmRefine();
    this.refineArmed = { from: recipe.from, preview };
    this.refineArmTimer = setTimeout(() => {
      this.refineArmed = null;
      this.cdr.markForCheck();
    }, REFINE_ARM_MS);
  }

  disarmRefine(): void {
    if (this.refineArmTimer) clearTimeout(this.refineArmTimer);
    this.refineArmTimer = undefined;
    this.refineArmed = null;
  }

  private confirmRefine(recipe: RefineRecipe): void {
    const armed = this.refineArmed;
    this.disarmRefine();
    const batches = armed?.preview.batches ?? this.refineBatches(recipe);
    const pending = this.refinePending?.from === recipe.from ? this.refinePending : null;
    const id = pending?.id ?? newMutationId();
    this.refinePending = { id, from: recipe.from, batches: pending?.batches ?? batches };
    const result = this.inventory.refineStack(id, recipe.from, this.refinePending.batches);
    if (result.ok) {
      this.refinePending = null;
      this.refineError = null;
      this.lastRefine = { from: result.from, to: result.to, consumed: result.consumed, produced: result.produced };
      this.refreshHeld();
      if (!result.replayed) {
        this.spawnFloater('refine', `−${result.consumed}`, { row: recipe.from, role: 'source' });
        this.spawnFloater('refine', `+${result.produced}`, { row: recipe.from, role: 'target' });
      }
      this.cdr.markForCheck();
      return;
    }
    if (result.code === 'persist') {
      this.refineError = { from: recipe.from, code: 'persist' };
      return;
    }
    this.refinePending = null;
    if (result.code === 'capacity') {
      this.refineError = { from: recipe.from, code: 'capacity' };
      this.keeper.show('bank');
      return;
    }
    // 'insufficient' / 'bad-batches' / 'no-recipe' / 'ssr': the button was live
    // on stale counts (another tab spent the ore); refresh and say so.
    this.refreshHeld();
    this.refineError = result.code === 'ssr' ? null : { from: recipe.from, code: 'stale' };
  }

  retryRefine(recipe: RefineRecipe): void {
    this.confirmRefine(recipe);
  }

  refreshRefine(): void {
    this.refineError = null;
    this.refinePending = null;
  }

  lastRefineFor(recipe: RefineRecipe): { from: string; to: string; consumed: number; produced: number } | null {
    return this.lastRefine?.from === recipe.from ? this.lastRefine : null;
  }

  refineStatus(recipe: RefineRecipe): string {
    const from = this.artOf(recipe.from).name;
    const to = this.artOf(recipe.to).name;
    if (this.refineArmed?.from === recipe.from) {
      const p = this.refineArmed.preview;
      return this.t('seamworks.refine.status.armed', { consume: p.consume, from, produce: p.produce, to });
    }
    if (this.lastRefine?.from === recipe.from) {
      return this.t('seamworks.refine.status.done', { consume: this.lastRefine.consumed, from, produce: this.lastRefine.produced, to });
    }
    return this.t('seamworks.refine.status.ready', { n: recipe.ratio, from, to });
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
