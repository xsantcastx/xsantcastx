/**
 * equipment-panel.component.ts — C5 loadout actions.
 *
 * Closed slots inspect or receive an armed item. Unequip lives on the
 * expanded row. Charms cannot be worn. Overlays render only when a slot
 * has an approved mapping and is filled.
 */
import { optIso } from '../../play/td/td-artopt';
import { hdStill } from '../../play/td/td-hd-keeper';
import { vocationLook } from '../keeper-look/vocation-look';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectButtonComponent } from '../entity/inspect-button.component';
import { formatCompact } from '../economy/economy.model';
import { CharacterHubService } from '../character/character-hub.service';
import { KeeperLookService } from '../keeper-look/keeper-look.service';
import { KeeperPainter } from '../keeper-look/keeper-paint';
import { wornGear } from '../keeper-look/worn-gear';
import { InventoryService, InventorySnapshot } from './inventory.service';
import { MagicFindService } from './magic-find.service';
import {
  GameItem,
  ITEM_STAT_KEYS,
  ItemStats,
  ITEM_STAT_LABELS,
  formatItemMod,
  formatStatValue,
  rarityColor,
  rarityGlow,
  rarityLabel,
  sumStats,
  totalGoldFind,
  type ItemRarity,
  type SlotId,
} from './item.model';
import { deriveBuild, type BuildArchetype, type BuildIdentity } from './build-identity';
import {
  CHARM_DOLL_SLOTS,
  PAPER_DOLL_SLOTS,
  PAPER_DOLL_SRC,
  PAPER_DOLL_SRCSET,
  type PaperDollSlotManifest,
} from './paper-doll.manifest';
import { itemArt } from './material-catalog';
import { itemFitsSlot } from './item-definition';
import {
  QUALITY_TAG_LABELS,
  formatQuality,
  qualityOf,
  qualityTagOf,
  type QualityTag,
} from './item-quality';
import { wardFailReductionPct } from './item-upgrade';
import { strikeValuePct } from '../rune-forge/strike-value';

import { KeeperStatSheetComponent } from './keeper-stat-sheet.component';
import { compareStats, netDelta, type StatDeltaRow } from './stat-delta';

/**
 * Archetype copy, as literal keys so the i18n gate can see every one of them.
 * The derivation itself (build-identity.ts) is translation-free.
 */
const BUILD_COPY: Record<BuildArchetype, { name: string; desc: string }> = {
  unforged: { name: 'loadout.build.unforged.name', desc: 'loadout.build.unforged.desc' },
  vanguard: { name: 'loadout.build.vanguard.name', desc: 'loadout.build.vanguard.desc' },
  'treasure-seeker': { name: 'loadout.build.treasureSeeker.name', desc: 'loadout.build.treasureSeeker.desc' },
  forgewright: { name: 'loadout.build.forgewright.name', desc: 'loadout.build.forgewright.desc' },
  bulwark: { name: 'loadout.build.bulwark.name', desc: 'loadout.build.bulwark.desc' },
  lorekeeper: { name: 'loadout.build.lorekeeper.name', desc: 'loadout.build.lorekeeper.desc' },
  wanderer: { name: 'loadout.build.wanderer.name', desc: 'loadout.build.wanderer.desc' },
};

/** An equip in flight: where its art starts, relative to the socket it lands in. */
interface Landing {
  slotId: string;
  itemId: string;
  /** px offset of the start point from the socket centre. */
  x: number;
  y: number;
  nonce: number;
}

/** An item lifting out of a socket on its way back to the bag. */
interface Leaving {
  slotId: string;
  item: GameItem;
  nonce: number;
}

/** Fly-in 480ms + burst 520ms from 400ms; cleared a beat after both finish. */
const LANDING_MS = 1000;
const LEAVING_MS = 760;
const PULSE_MS = 760;
/**
 * More slots than this changing in one snapshot is a hydrate or a cloud merge,
 * not something the player did. Animating it would throw six items off the
 * Keeper on page load.
 */
const MAX_ANIMATED_CHANGES = 2;

/** One stat's difference between a candidate and the worn item. */
export interface StatDelta {
  key: keyof ItemStats;
  label: string;
  /** Signed. Positive is an improvement for every stat the game has. */
  delta: number;
  /** "Magic Find +2%", already signed and suffixed. */
  text: string;
  better: boolean;
}

@Component({
  selector: 'app-equipment-panel',
  standalone: true,
  imports: [CommonModule, InspectButtonComponent, KeeperStatSheetComponent],
  templateUrl: './equipment-panel.component.html',
  styleUrls: ['./equipment-panel.component.css'],
})
export class EquipmentPanelComponent implements OnInit, OnDestroy {
  readonly inventory = inject(InventoryService);
  readonly hub = inject(CharacterHubService);
  readonly magicFind = inject(MagicFindService);
  private readonly i18n = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** `select` is doll-only. `bank` is bag-only. `full` is both, and may sync the URL. */

  /** The painted Keeper on the server; in the browser, the player's own pixel Keeper wearing this loadout. */
  dollSrc = PAPER_DOLL_SRC;
  dollSrcset: string | null = PAPER_DOLL_SRCSET;
  /** The look + gear the doll was last painted for. */
  dollKey = '';
  private readonly looks = inject(KeeperLookService);
  readonly dollSlots = PAPER_DOLL_SLOTS;
  readonly charmSlots = CHARM_DOLL_SLOTS;
  /** The wells that have somewhere to sit on the figure. */
  readonly sockets = PAPER_DOLL_SLOTS.filter(slot => !!slot.anchor && !!slot.liveSlot);

  /** What the worn loadout reads as. Re-derived on every snapshot. */
  build: BuildIdentity = deriveBuild(this.inventory.snapshot.equipped);

  landing: Landing | null = null;
  leaving: Leaving[] = [];
  pulsing = false;
  private fxNonce = 0;
  private pulseNonce = 0;
  private seenFirstSnapshot = false;
  private readonly fxTimers = new Set<ReturnType<typeof setTimeout>>();

  snap: InventorySnapshot = this.inventory.snapshot;
  ready = false;
  selectedId: string | null = null;
  selectedSlot: string | null = null;

  private sub?: Subscription;

  ngOnInit(): void {
    // Tells the fixed NPC widget (styles.css `has-loadout`) that wells are on
    // screen, so it keeps its speech bubble folded rather than covering one.
    if (this.isBrowser) document.body.classList.add('has-loadout');
    this.inventory.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => {
      this.trackUnequips(this.snap.equipped, snap.equipped);
      this.snap = snap;
      this.build = deriveBuild(snap.equipped);
      this.paintDoll();
      if (this.selectedId && !snap.items.some(item => item.id === this.selectedId)) {
        this.selectedId = null;
      }
      if (this.hub.armedId && !snap.bag.some(item => item.id === this.hub.armedId)) {
        this.hub.arm(null);
      }
    });
    this.sub.add(this.hub.armed$.subscribe(id => {
      if (id) this.selectedId = id;
    }));
    // The equip event rather than a snapshot diff: a diff cannot tell an equip
    // from a hydrate (see `InventoryService.equipped$`). Fires for equips from
    // anywhere — this panel's picker, the Bank, a quick-equip toast — so the
    // doll animates whatever put the item on.
    this.sub.add(this.inventory.equipped$.subscribe(item => this.onEquipped(item)));
    this.sub.add(this.looks.look$.subscribe(() => this.paintDoll()));
    this.ready = this.isBrowser;
  }

  /**
   * The doll is the player's own Keeper (Make your Keeper): their look, every
   * worn slot drawn on the body. Painted once per change into a data URL.
   */
  private paintDoll(): void {
    if (!this.isBrowser) return;
    const painter = new KeeperPainter(this.looks.look, wornGear(this.snap.equipped));
    // Isometric graphics: the HD Keeper (td-hd-keeper.ts), so the doll matches the world.
    const hd = optIso(), key = hd ? `${painter.key}|hd` : painter.key;
    if (key === this.dollKey) return;
    try {
      const el = document.createElement('canvas');
      el.width = el.height = 352;
      // The HD doll wears the class's own kit under what is worn (as the world draws the Keeper).
      if (hd) { const v = vocationLook(this.looks.look.vocation, painter.gear); hdStill(new KeeperPainter(this.looks.look, v.gear, v.garb), el, 'full'); } else painter.still(el);
      this.dollSrc = el.toDataURL('image/png');
      this.dollSrcset = null;
      this.dollKey = key;
    } catch { /* no 2D canvas (an old test browser): the painted Keeper stays */ }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) document.body.classList.remove('has-loadout');
    if (this.flashTimer !== null) { clearTimeout(this.flashTimer); this.flashTimer = null; }
    for (const timer of this.fxTimers) clearTimeout(timer);
    this.fxTimers.clear();
    this.sub?.unsubscribe();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  label(item: GameItem): string { return rarityLabel(item.rarity); }
  initialsOf(item: GameItem): string { return item.name.slice(0, 2).toUpperCase(); }
  trackItem(_: number, item: GameItem): string { return item.id; }

  /** Worn Gold Find, the retired Gold/sec of older items read in (item.model totalGoldFind). */
  get goldFind(): number { return totalGoldFind(this.snap.totals); }

  hasTotals(): boolean {
    const t = this.snap.totals;
    return ITEM_STAT_KEYS.some(key => !!t[key]);
  }

  /** Worn strikePower as the Forge yield bonus it buys, whole percent, capped. 0 hides it. */
  get strikePct(): number { return strikeValuePct(this.snap.totals.strikePower); }

  /** Worn ward as the share of temper failures it turns aside, whole percent, capped. */
  get wardPct(): number { return wardFailReductionPct(this.snap.totals.ward); }

  itemInDoll(slot: PaperDollSlotManifest): GameItem | null {
    if (!slot.liveSlot) return null;
    return this.snap.equipped[slot.liveSlot] ?? null;
  }

  // ── The charm row ──────────────────────────────────────────────────────────

  /**
   * The charms currently worn, summed.
   *
   * Reported separately from `snap.totals` even though it is a subset of it —
   * the row's own header answers "what are my three charms buying me", which is
   * the question you ask while swapping one, and the loadout total answers "what
   * am I worth", which is the question you ask afterwards. Reading the second to
   * get the first means subtracting eight pieces of gear in your head.
   */
  get charmTotals(): string[] {
    const worn = this.charmSlots
      .map(slot => (slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined))
      .filter((item): item is GameItem => !!item);
    if (!worn.length) return [];

    const summed = sumStats(worn.map(item => item.stats));
    return ITEM_STAT_KEYS
      .filter(key => summed[key] !== 0)
      .map(key => formatItemMod(key, summed[key]));
  }

  /** How many charm wells are filled. Drives the row's "2/3" counter. */
  get charmsWorn(): number {
    return this.charmSlots.filter(
      slot => !!slot.liveSlot && !!this.snap.equipped[slot.liveSlot],
    ).length;
  }

  /** Every charm in the bag, for the row's empty-state copy. */
  get charmsHeld(): number {
    return this.snap.bag.filter(item => item.type === 'charm').length;
  }

  get armed(): GameItem | null {
    const id = this.selectedId ?? this.hub.armedId;
    return this.snap.bag.find(item => item.id === id) ?? null;
  }

  /**
   * Every well the picker can open, gear and charm alike.
   *
   * The two arrays are separate because they *lay out* differently — see the
   * note on `CHARM_DOLL_SLOTS` — but every lookup that answers "which well is
   * open" has to see both, or clicking a charm well selects a slot the picker
   * then cannot find and nothing opens.
   */
  private get allSlots(): readonly PaperDollSlotManifest[] {
    return [...this.dollSlots, ...this.charmSlots];
  }

  /** The manifest entry for the open slot, so the template can read its label. */
  get selectedSlotManifest(): PaperDollSlotManifest | null {
    return this.allSlots.find(row => row.slotId === this.selectedSlot) ?? null;
  }

  get expandedItem(): GameItem | null {
    const slot = this.allSlots.find(row => row.slotId === this.selectedSlot);
    return slot ? this.itemInDoll(slot) : null;
  }

  /**
   * No slot carries a body-aligned overlay yet — see paper-doll.manifest.ts for
   * why the previous ones were item masters, not doll layers. Kept so the
   * template's loop and the manifest's optional `overlay` stay honest the day
   * authored overlays exist.
   */
  get filledOverlays(): PaperDollSlotManifest[] {
    return this.dollSlots.filter(slot => slot.overlay && this.itemInDoll(slot));
  }

  /** Art for a slot or a bag tile. Resolves every catalogued id, not just one. */
  tileArt(item: GameItem): string | null {
    return itemArt(item)?.src ?? null;
  }

  tileArtSrcset(item: GameItem): string | null {
    return itemArt(item)?.srcset ?? null;
  }

  isTarget(slot: PaperDollSlotManifest): boolean {
    const item = this.armed;
    return !!item && !!slot.liveSlot && itemFitsSlot(slot.liveSlot, item);
  }

  slotAnnounce(slot: PaperDollSlotManifest): string {
    const item = this.itemInDoll(slot);
    const name = this.t(slot.labelKey);
    if (!slot.liveSlot) return this.t('loadout.slot.announce.locked', { name });
    if (!item) return this.t('loadout.slot.announce.empty', { name });
    return this.t('loadout.slot.announce.filled', { name, item: item.name });
  }

  /**
   * Hover summary for a well. The loadout had no tooltips at all — the only way
   * to see what a worn item does was to open the full Inspect dialog, which is
   * a heavy gesture for "what am I wearing".
   */
  slotTooltip(slot: PaperDollSlotManifest): string {
    const item = this.itemInDoll(slot);
    if (!item) return this.slotAnnounce(slot);
    const mods = this.modsOf(item).join(' · ');
    const level = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
    return mods ? `${item.name}${level} — ${mods}` : `${item.name}${level}`;
  }

  /** `perfect` / `flawless` / null. Drives the prismatic border in CSS. */
  qualityTag(item: GameItem | null | undefined): QualityTag {
    return item ? qualityTagOf(item) : null;
  }

  onSlotClick(slot: PaperDollSlotManifest): void {
    const armed = this.armed;
    // Keep the arm-then-place path working for anyone mid-gesture.
    if (armed && slot.liveSlot && itemFitsSlot(slot.liveSlot, armed)) {
      if (this.inventory.equip(armed.id, slot.liveSlot)) this.flash(slot.slotId);
      this.selectedId = null;
      this.hub.arm(null);
      this.selectedSlot = slot.slotId;
      return;
    }
    this.selectedSlot = this.selectedSlot === slot.slotId ? null : slot.slotId;
  }

  /**
   * Everything in the bag that fits this slot.
   *
   * Equipping used to be a two-surface gesture: find the item in the Bank tab,
   * arm it, come back to the Loadout, click the well. You had to already know
   * which of your items was a helm. Clicking the slot now answers that — the
   * slot asks the bag, instead of the player being asked to.
   */
  candidatesFor(slot: PaperDollSlotManifest): GameItem[] {
    if (!slot.liveSlot) return [];
    const live = slot.liveSlot;
    return this.snap.bag
      .filter(item => itemFitsSlot(live, item))
      .sort((a, b) => this.sortValue(b) - this.sortValue(a));
  }

  /** Best-first: what the player most likely wants is what gives the most. */
  private sortValue(item: GameItem): number {
    return ITEM_STAT_KEYS.reduce((sum, key) => sum + (item.stats[key] ?? 0), 0)
      + (item.upgradeLevel ?? 0) * 0.5;
  }

  equipFromPicker(slot: PaperDollSlotManifest, item: GameItem): void {
    if (!slot.liveSlot) return;
    if (!this.inventory.equip(item.id, slot.liveSlot)) return;
    this.flash(slot.slotId);
    this.hub.arm(null);
    this.selectedId = null;
  }

  unequipExpanded(): void {
    const worn = this.expandedItem;
    if (!worn) return;
    const slotId = this.selectedSlot;
    if (!this.inventory.unequip(worn.id)) return;
    this.flash(slotId);
    this.selectedSlot = null;
  }

  /**
   * The mod lines, each carrying its roll grade.
   *
   * `Gold/sec +4.2 (78%)` rather than `Gold/sec +4.2`, because the number alone
   * cannot be compared against anything: the bag holds items of six rarities and
   * `+4.2` is superb on one rung and dire on another. The percentage is the same
   * scale everywhere. Ungraded legacy items print the bare number — see the
   * header of item-quality.ts for why nothing is invented for them.
   */
  modsOf(item: GameItem): string[] {
    const mods: string[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value == null) continue;
      const pct = item.rollQuality?.[key];
      const grade = typeof pct === 'number' ? ` (${formatQuality(pct)})` : '';
      mods.push(`${formatItemMod(key, value)}${grade}`);
    }
    return mods;
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  /**
   * A candidate's stats, against what is already in the slot.
   *
   * The picker listed every item that fits and its mod line, which answers
   * "what does this do" and not "is this better than the one I am wearing" —
   * and the second question is the only reason anybody opens the picker. Two
   * items with `Magic Find +9%` and `Magic Find +11%` are indistinguishable at
   * a glance in a mod-line list; `+2` next to one of them is not.
   *
   * Every stat either item touches appears, so a candidate that *loses* a stat
   * the worn item had shows it as a negative rather than by omission — losing
   * `Gold/sec +4` to gain `Magic Find +2` is a real trade and the panel should
   * not hide half of it.
   */
  comparison(slot: PaperDollSlotManifest, item: GameItem): StatDelta[] {
    const worn = slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined;
    // Nothing worn: every stat is a straight gain, and the mod line beside it
    // already says so. Kept empty here so `isUpgrade` only flags a real swap;
    // the full compare view (`compareView`) is what shows the from-zero gains.
    if (!worn || worn.id === item.id) return [];
    return compareStats(item.stats, worn.stats).map(row => ({
      key: row.key,
      label: row.label,
      delta: row.delta,
      text: row.text,
      better: row.direction === 'up',
    }));
  }

  /**
   * The picker's compare view: every stat either item touches, against what is
   * worn — or against nothing, when the slot is empty — with unchanged stats
   * kept (and dimmed by the template) so the row says "this does not move
   * Ward" rather than leaving the player to wonder whether it was forgotten.
   */
  compareView(slot: PaperDollSlotManifest, item: GameItem): StatDeltaRow[] {
    if (!slot.liveSlot) return [];
    const worn = this.snap.equipped[slot.liveSlot];
    if (worn?.id === item.id) return [];
    return compareStats(item.stats, worn?.stats, { includeUnchanged: true });
  }

  /** True when a candidate is, on balance, an upgrade on what is worn. */
  isUpgrade(slot: PaperDollSlotManifest, item: GameItem): boolean {
    const worn = slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined;
    if (!worn || worn.id === item.id) return false;
    return netDelta(compareStats(item.stats, worn.stats)) > 0;
  }

  /** The item currently in a slot, for the "replacing" line in the picker. */
  wornIn(slot: PaperDollSlotManifest): GameItem | undefined {
    return slot.liveSlot ? this.snap.equipped[slot.liveSlot] : undefined;
  }

  /**
   * Everything an item is, on one line, for a native `title`.
   *
   * A native tooltip rather than a hover card: the bag is a scrolling grid of up
   * to a hundred tiles, and a hover card per tile is a hundred elements that
   * have to be positioned, escaped from `overflow: hidden`, and dismissed on
   * touch — where they would never fire at all. `title` is free, works in the
   * grid and in the picker unchanged, and is read out by screen readers.
   */
  itemTooltip(item: GameItem): string {
    const level = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
    const head = `${item.name}${level} — ${rarityLabel(item.rarity)}`;
    const mods = this.modsOf(item).join(' · ');
    const parts = [head];
    if (mods) parts.push(mods);
    const overall = qualityOf(item);
    if (overall != null) {
      const tag = qualityTagOf(item);
      const badge = tag ? ` — ${QUALITY_TAG_LABELS[tag]}` : '';
      parts.push(`Roll ${formatQuality(overall)}${badge}`);
    }
    if (item.sellValue) parts.push(`Sells for ${formatCompact(item.sellValue)}`);
    return parts.join('\n');
  }

  // ── Equip feedback ─────────────────────────────────────────────────────────

  /**
   * The slot that just changed, held briefly so the CSS can flash it.
   *
   * Equipping used to be silent: the tile vanished from the bag and an overlay
   * appeared on a doll 400px away, which on a phone is off-screen. The flash is
   * on the *slot* rather than on the item because the slot is the thing that
   * changed state and is the thing still on screen afterwards.
   */
  flashSlot: string | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  private flash(slotId: string | null | undefined): void {
    if (!slotId || !this.isBrowser) return;
    this.flashSlot = slotId;
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    // Slightly longer than the 600ms animation so the class is never pulled
    // mid-keyframe, which reads as a cut rather than a fade.
    this.flashTimer = setTimeout(() => { this.flashSlot = null; }, 700);
  }

  select(item: GameItem): void {
    this.selectedId = this.selectedId === item.id ? null : item.id;
    this.hub.arm(this.selectedId);
  }

  // ── Gear on the doll ───────────────────────────────────────────────────────

  /**
   * Rarity colour and glow as custom properties, for a socket frame, a charm
   * or a Build bar. Straight off the rune ladder via item.model, so a socket
   * can never disagree with the tile the item came from.
   */
  rarityVar(rarity: ItemRarity | null | undefined): string {
    return rarity ? rarityColor(rarity) : 'var(--gold)';
  }

  rarityGlowVar(rarity: ItemRarity | null | undefined): string {
    return rarity ? rarityGlow(rarity) : 'rgba(232, 200, 152, 0.6)';
  }

  isLanding(slot: PaperDollSlotManifest): boolean {
    return !!this.landing && this.landing.slotId === slot.slotId;
  }

  /**
   * Identity for the worn frame. Changes on every landing so Angular rebuilds
   * the element and the fly-in restarts — re-equipping the same slot twice in
   * a row would otherwise keep the class and play nothing.
   */
  socketKey(slot: PaperDollSlotManifest, worn: GameItem): string {
    const nonce = this.isLanding(slot) ? this.landing!.nonce : 0;
    return `${worn.id}:${nonce}`;
  }

  /** The landing's start offset as a CSS length, or null when nothing is landing here. */
  flyFrom(slot: PaperDollSlotManifest, axis: 'x' | 'y'): string | null {
    return this.isLanding(slot) ? `${this.landing![axis]}px` : null;
  }

  leavingFor(slot: PaperDollSlotManifest): Leaving[] {
    return this.leaving.filter(row => row.slotId === slot.slotId);
  }

  // ── Build card ─────────────────────────────────────────────────────────────

  buildName(): string { return this.t(BUILD_COPY[this.build.archetype].name); }
  buildDesc(): string { return this.t(BUILD_COPY[this.build.archetype].desc); }
  statLabel(key: keyof ItemStats): string { return ITEM_STAT_LABELS[key]; }
  statValue(key: keyof ItemStats, value: number): string { return formatStatValue(key, value); }
  /** Bars are drawn against the heaviest row, so the leader always fills. */
  barScale(share: number): number {
    const lead = this.build.contributions[0]?.share ?? 0;
    return lead > 0 ? Math.max(0.04, Math.min(1, share / lead)) : 0;
  }
  sharePct(share: number): number { return Math.round(share * 100); }

  // ── Equip / unequip motion ─────────────────────────────────────────────────

  private onEquipped(item: GameItem): void {
    if (!this.isBrowser || !item.slot || item.explorerId) return;
    const slotId: string = item.slot;
    const root = this.host.nativeElement;
    const target = root.querySelector<HTMLElement>(`[data-socket="${slotId}"]`)
      ?? root.querySelector<HTMLElement>(`[data-charm="${slotId}"]`);
    if (!target) return;

    const to = target.getBoundingClientRect();
    // The picker card the item was chosen from, if it is still on screen —
    // change detection has not run yet, so it has not been removed.
    const card = Array.from(root.querySelectorAll<HTMLElement>('[data-pick-id]'))
      .find(el => el.getAttribute('data-pick-id') === item.id);
    const from = card?.getBoundingClientRect();
    const visible = !!from && from.width > 0 && from.bottom > 0
      && from.top < (window.innerHeight || document.documentElement.clientHeight);

    const x = visible ? (from!.left + from!.width / 2) - (to.left + to.width / 2) : 0;
    // From below: the bag is always "down there" relative to the doll.
    const y = visible
      ? (from!.top + from!.height / 2) - (to.top + to.height / 2)
      : Math.max(140, to.height * 3);

    const nonce = ++this.fxNonce;
    this.landing = { slotId, itemId: item.id, x: Math.round(x), y: Math.round(y), nonce };
    this.pulsing = true;
    this.flash(slotId);
    this.later(LANDING_MS, () => { if (this.landing?.nonce === nonce) this.landing = null; });
    this.pulseNonce = nonce;
    this.later(PULSE_MS, () => { if (this.pulseNonce === nonce) this.pulsing = false; });
  }

  /**
   * Every slot whose occupant left — taken off, or displaced by a swap — lifts
   * its old art out and drops it. Derived from the snapshot because there is no
   * unequip event, and guarded against hydrates by `MAX_ANIMATED_CHANGES`.
   */
  private trackUnequips(
    before: Partial<Record<SlotId, GameItem>>,
    after: Partial<Record<SlotId, GameItem>>,
  ): void {
    if (!this.seenFirstSnapshot) { this.seenFirstSnapshot = true; return; }
    if (!this.isBrowser) return;
    const changed = this.sockets.filter(slot => {
      const live = slot.liveSlot!;
      return (before[live]?.id ?? null) !== (after[live]?.id ?? null);
    });
    if (!changed.length || changed.length > MAX_ANIMATED_CHANGES) return;
    for (const slot of changed) {
      const gone = before[slot.liveSlot!];
      if (!gone) continue;
      const nonce = ++this.fxNonce;
      this.leaving = [...this.leaving, { slotId: slot.slotId, item: gone, nonce }];
      this.later(LEAVING_MS, () => {
        this.leaving = this.leaving.filter(row => row.nonce !== nonce);
      });
    }
  }

  private later(ms: number, fn: () => void): void {
    const timer = setTimeout(() => { this.fxTimers.delete(timer); fn(); }, ms);
    this.fxTimers.add(timer);
  }

}
