/**
 * gambler.component.ts — the shelf, the reveal, and the till.
 *
 * Three surfaces on one page, in the order a player uses them: buy a box, watch
 * it open, then decide what in the bag is worth keeping now that it has.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REVEAL IS A STATE MACHINE AND NOT A CSS TRANSITION
 * ─────────────────────────────────────────────────────────────────────────────
 * The item is already minted and in the bag before a single frame of animation
 * plays — `GamblerService.open` is synchronous and the save is flushed inside
 * it. So the reveal is pure theatre over a decided outcome, which is the only
 * honest way to build one: an animation that *decides* anything would mean a
 * closed tab mid-spin either loses the purchase or duplicates it.
 *
 * It runs `wager` → `charging` → `cracking` → `revealed` on an altar stage,
 * with the payload attached from the first frame, so a player who navigates
 * away mid-animation has still been paid and a player who clicks Skip sees the
 * same result the animation was walking toward. The charge beat lengthens with
 * the rarity actually rolled (see reveal-timing.ts) — never a fake near-miss.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE TILL IS HERE AND NOT IN THE BAG
 * ─────────────────────────────────────────────────────────────────────────────
 * `InventoryService.sell` has existed and been tested for releases without a
 * single caller, because the bag column that used to hold the button was
 * deleted and the note left behind said not to add it back until the market
 * spec said where selling happens. This is that answer: selling happens where
 * gambling happens, because they are the same loop — you open boxes until the
 * bag is full of things you did not want, and then you turn those back into the
 * Gold for the next box. Putting the till anywhere else breaks the loop in half.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  HostListener,
  HostBinding,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { GamblerService, type OpenedBox, type OpenFailure } from './gambler.service';
import { RollQualityComponent } from '../rpg/roll-quality.component';
import { PITY_THRESHOLD, boxOdds, rarityRank, type MysteryBox } from './mystery-box';
import { TranslationService } from '../../translation.service';
import { GAMBLER_I18N } from './gambler.i18n';
import {
  STATION_UI,
  STATION_UI_I18N,
  type JournalRow,
  type StationArt,
  type StationCost,
  type StationTab,
} from '../station-ui';
import { artFor } from '../art/art';
import {
  QUALITY_TAG_LABELS,
  formatQuality,
  gradeFor,
  qualityOf,
  qualityTagOf,
  type QualityTag,
} from '../rpg/item-quality';
import { isUnique, uniqueById } from '../rpg/unique-items';
import {
  ITEM_STAT_KEYS,
  formatItemMod,
  rarityColor,
  rarityGlow,
  type GameItem,
  type ItemRarity,
} from '../rpg/item.model';
import { CelebrationService } from '../celebration/celebration.service';
import { SpotlightService } from '../collection/spotlight.service';
import { RUNE_TIERS } from '../rune-forge/rune.model';
import { revealTiming, type RevealSpeed, type RevealTiming } from './reveal-timing';

import { RelatedPagesComponent } from '../seo/related-pages.component';
import { injectInWorldPanel } from '../in-world-panel';
type RevealPhase = 'idle' | 'wager' | 'charging' | 'cracking' | 'revealed';

/** One tile in the pull history strip. Presentation only — never persisted. */
export interface PullRecord {
  key: number;
  name: string;
  rarity: ItemRarity;
  color: string;
  glow: string;
  art: string | null;
  initials: string;
  named: boolean;
}

const HISTORY_LIMIT = 8;

/** How many boxes one "Open ×N" press may open. The reveal shows the best one. */
const OPEN_MANY_MAX = 5;

/** One picture for every box on the shelf: the boxes have no art of their own yet. */
const BOX_ART_ID = 'chest-overlay';

/**
 * The strip outlives the component on purpose: leaving for the Market and
 * coming back should not wipe the run you were on. It lives for the tab only —
 * the save is the bag, and this is just the receipt pile on the counter.
 */
let sessionHistory: PullRecord[] = [];
let sessionFast = false;
let pullSeq = 0;

/** Stage art, all through the manifest. Missing keys simply render nothing. */
const STAGE_ART = {
  sigil: 'eclipse-summoning-sigil',
  flame: 'violet-forge-flame',
  portal: 'rift-portal-core',
  burst: 'crafting-burst',
  aura: 'enhancement-aura',
  coin: 'gold',
} as const;

interface OddsRow {
  rarity: ItemRarity;
  label: string;
  color: string;
  /** Already rounded for display; the raw chance is not shown. */
  text: string;
}

interface SellRow {
  item: GameItem;
  selected: boolean;
}


@Component({
  selector: 'app-gambler',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, RouterLink, RollQualityComponent, ...STATION_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gambler.component.html',
  styleUrls: ['./gambler.component.css'],
})
export class GamblerComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gambler = inject(GamblerService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly celebration = inject(CelebrationService);
  private readonly spotlight = inject(SpotlightService);
  /** Whether this component currently holds the spotlight (see `holdSpotlight`). */
  private onStage = false;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  /**
   * Hosted as the Gambler in the Nocturne Archive (/play). The hero, the
   * Market link and the related links drop out, and the reveal fills the
   * PANEL instead of the screen: the panel is `contain: layout`, which makes
   * it the containing block of the fixed `.gb-reveal`, so `inset: 0` lands on
   * the panel's box and the altar is sized against it (see `.gb-reveal--in-world`).
   */
  protected readonly inWorld = injectInWorldPanel();
  private readonly subs = new Subscription();
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly boxes = this.gambler.boxes;

  gold = 0;
  spent = 0;
  uniquesFound = 0;

  /** The box mid-animation, and how far through it is. */
  phase: RevealPhase = 'idle';

  /** The global routeFadeIn leaves an identity transform on every routed host,
   *  which makes it the containing block for the fixed reveal overlay: the
   *  overlay then spans the whole page and the altar lands below the fold.
   *  While a reveal is up, the host drops that animation (see :host CSS). */
  @HostBinding('class.gb-host--revealing') get revealing(): boolean { return this.phase !== 'idle'; }
  active: MysteryBox | null = null;
  result: OpenedBox | null = null;
  error: string | null = null;
  /** Timing for the reveal in flight; drives the CSS custom properties. */
  timing: RevealTiming | null = null;
  /** Reduced motion: no beats, just a fade onto the result. */
  still = false;

  /** Repeat-gamble mode: every rarity gets the same short reveal. */
  fast = sessionFast;
  history: PullRecord[] = sessionHistory;

  readonly stage = {
    sigil: artFor(STAGE_ART.sigil),
    flame: artFor(STAGE_ART.flame),
    portal: artFor(STAGE_ART.portal),
    burst: artFor(STAGE_ART.burst),
    aura: artFor(STAGE_ART.aura),
    coin: artFor(STAGE_ART.coin),
  };

  /** The till. Rebuilt whenever the bag changes. */
  sellRows: SellRow[] = [];
  sellOpen = false;

  // ── The journal (station kit) ─────────────────────────────────────────────
  hydrated = false;
  detailsOpen = false;
  tab: 'boxes' | 'sell' = 'boxes';
  tabs: StationTab[] = [];
  boxRows: JournalRow[] = [];
  selectedBox: MysteryBox | null = this.gambler.boxes[0] ?? null;
  private userPickedBox = false;
  selectedOdds: OddsRow[] = [];
  boxCosts: StationCost[] = [];
  openBlocked: string | null = null;
  openAllCount = 0;
  luckProgress = 0;
  luckLabel = '';
  walletGold: StationCost = { kind: 'gold', label: 'Gold', need: 0, have: 0 };
  readonly boxArt: StationArt | null = artFor(BOX_ART_ID);
  /** How many other boxes an "Open ×N" press opened alongside the one revealed. */
  extraPulls = 0;

  sellJournal: JournalRow[] = [];
  selectedSell: SellRow | null = null;
  selectedSellId: string | null = null;
  sellArt: StationArt | null = null;
  /** Ids the "Sell junk" button would sell: graded rolls under 50%. */
  junkIds: string[] = [];
  /** "Sell junk" is two presses: the first arms it, the second sells. */
  junkArmed = false;
  notice: string | null = null;
  announce = '';
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly i18n = inject(TranslationService);

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(GAMBLER_I18N);
    this.buildJournal();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.economy.init();
    this.inventory.init();
    this.gambler.init();

    this.hydrated = true;
    this.subs.add(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.buildJournal();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.gambler.snapshot$.subscribe(snap => {
      this.spent = snap.spent;
      this.uniquesFound = snap.uniques;
      this.buildJournal();
      this.cdr.markForCheck();
    }));
    this.subs.add(this.inventory.snapshot$.subscribe(() => {
      this.rebuildTill();
      this.buildJournal();
      this.cdr.markForCheck();
    }));
    this.rebuildTill();
    this.buildJournal();
  }

  // ── The journal ────────────────────────────────────────────────────────────

  /**
   * Rebuild every array the kit renders. Called on Gold, bag and pity changes
   * and on every pick, never from the template — the kit's inputs are signals,
   * and a getter handing it a new array each pass would recompute it each pass.
   */
  private buildJournal(): void {
    const boxes = this.gambler.boxes;
    if (!this.userPickedBox && this.hydrated) {
      // Default to the dearest box the player can pay for: the one they came for.
      const affordable = boxes.filter(b => this.affordable(b));
      this.selectedBox = affordable[affordable.length - 1] ?? boxes[0] ?? null;
    }
    this.boxRows = boxes.map(box => ({
      id: box.id,
      name: box.name,
      art: this.boxArt,
      rarity: box.maxRarity,
      sub: `${this.compact(box.cost)} ${this.t('stationUi.gold')}`,
      locked: this.hydrated && !this.affordable(box),
      ready: this.hydrated && this.affordable(box),
    }));

    const box = this.selectedBox;
    this.selectedOdds = box ? this.oddsFor(box) : [];
    this.boxCosts = box ? [{ kind: 'gold', label: this.t('stationUi.gold'), need: box.cost, have: this.gold }] : [];
    this.walletGold = { kind: 'gold', label: this.t('stationUi.gold'), need: this.gold, have: this.gold };
    const bagFull = this.hydrated && !this.inventory.canAcceptInstance();
    this.openBlocked = bagFull ? this.t('gambler.why.satchelFull') : null;
    const many = box && !bagFull ? Math.min(OPEN_MANY_MAX, Math.floor(this.gold / box.cost)) : 0;
    this.openAllCount = many >= 2 ? many : 0;

    if (box && this.hydrated) {
      const left = this.pityLeft(box);
      const armed = this.guaranteed(box);
      this.luckProgress = armed ? 1 : Math.max(0, Math.min(1, (PITY_THRESHOLD - left) / PITY_THRESHOLD));
      // Bad luck protection as a bar: the full sentence is in Details.
      this.luckLabel = armed ? this.t('gambler.luck.next') : this.t('gambler.luck.left', { n: left });
    } else {
      this.luckProgress = 0;
      this.luckLabel = '';
    }

    this.tabs = [
      { id: 'boxes', label: this.t('gambler.tab.boxes') },
      { id: 'sell', label: this.t('gambler.tab.sell'), badge: this.sellRows.length || null },
    ];

    this.sellJournal = this.sellRows.map(row => ({
      id: row.item.id,
      name: row.item.upgradeLevel ? `${row.item.name} +${row.item.upgradeLevel}` : row.item.name,
      art: artFor(row.item.definitionId),
      rarity: row.item.rarity,
      sub: `${this.qualityText(row.item)} · ${this.compact(row.item.sellValue)} ${this.t('stationUi.gold')}`,
    }));
    const current = this.selectedSell;
    this.selectedSell = (current && this.sellRows.find(r => r.item.id === current.item.id)) || this.sellRows[0] || null;
    this.sellArt = this.selectedSell ? artFor(this.selectedSell.item.definitionId) : null;
    this.selectedSellId = this.selectedSell ? this.selectedSell.item.id : null;
    this.junkIds = this.sellRows
      .filter(row => {
        const q = qualityOf(row.item);
        return q != null && q < 0.5 && !qualityTagOf(row.item);
      })
      .map(row => row.item.id);
    if (!this.junkIds.length) this.junkArmed = false;
  }

  setTab(id: string): void {
    this.tab = id === 'sell' ? 'sell' : 'boxes';
    this.junkArmed = false;
    this.buildJournal();
    this.cdr.markForCheck();
  }

  pickBox(id: string): void {
    const box = this.gambler.boxes.find(b => b.id === id);
    if (!box) return;
    this.userPickedBox = true;
    this.selectedBox = box;
    this.error = null;
    this.buildJournal();
    this.cdr.markForCheck();
  }

  pickSell(id: string): void {
    this.selectedSell = this.sellRows.find(r => r.item.id === id) ?? null;
    this.buildJournal();
    this.cdr.markForCheck();
  }

  /** Sell the one item in the detail. Same call the till makes, with one id. */
  sellSelected(): void {
    const row = this.selectedSell;
    if (!row) return;
    const gold = row.item.sellValue;
    const sold = this.inventory.sellMany([row.item.id]);
    if (sold > 0) this.say(this.t('gambler.sold.one', { name: row.item.name, n: this.compact(gold) }));
    this.selectedSell = null;
    this.rebuildTill();
    this.buildJournal();
    this.cdr.markForCheck();
  }

  /** "Sell junk": the first press arms it, the second sells every roll under 50%. */
  sellJunk(): void {
    if (!this.junkIds.length) return;
    if (!this.junkArmed) {
      this.junkArmed = true;
      this.announce = this.t('gambler.pressAgain', { n: this.junkIds.length });
      this.cdr.markForCheck();
      return;
    }
    const ids = [...this.junkIds];
    const gold = this.sellRows.filter(r => ids.includes(r.item.id)).reduce((sum, r) => sum + r.item.sellValue, 0);
    const sold = this.inventory.sellMany(ids);
    this.junkArmed = false;
    if (sold > 0) this.say(this.t('gambler.sold.many', { n: sold, gold: this.compact(gold) }));
    this.rebuildTill();
    this.buildJournal();
    this.cdr.markForCheck();
  }

  private say(text: string): void {
    this.notice = text;
    this.announce = text;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
      this.cdr.markForCheck();
    }, 5_000);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearTimers();
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.holdSpotlight(false);
  }

  /** Hold the spotlight for exactly as long as a reveal is up, so the
   *  Collection's "New discovery" card waits instead of covering the charge. */
  private holdSpotlight(on: boolean): void {
    if (on === this.onStage) return;
    this.onStage = on;
    if (on) this.spotlight.hold(); else this.spotlight.release();
  }

  // ── The shelf ──────────────────────────────────────────────────────────────

  oddsFor(box: MysteryBox): OddsRow[] {
    return boxOdds(box).map(row => ({
      rarity: row.rarity,
      label: RUNE_TIERS[row.rarity].label,
      color: rarityColor(row.rarity),
      // Sub-1% chances round to "<1%" rather than to "0%", which would read as
      // "this box cannot pay a Singular" — the exact opposite of the truth.
      text: row.chance < 0.01 ? '<1%' : `${Math.round(row.chance * 100)}%`,
    }));
  }

  affordable(box: MysteryBox): boolean { return this.gold >= box.cost; }
  openedCount(box: MysteryBox): number { return this.gambler.openedCount(box.id); }
  pityLeft(box: MysteryBox): number { return this.gambler.pityLeft(box.id); }
  guaranteed(box: MysteryBox): boolean { return this.gambler.guaranteed(box.id); }

  // ── The open ───────────────────────────────────────────────────────────────

  open(box: MysteryBox): void {
    this.openMany(box, 1);
  }

  /**
   * Open `count` of the same box: `GamblerService.open` called that many times,
   * exactly as one press calls it once. Stops at the first refusal (Gold, bag),
   * keeping whatever already landed. Every pull goes on the strip; the altar
   * reveals the rarest of them and says how many others came with it.
   */
  openMany(box: MysteryBox, count: number): void {
    if (!this.isBrowser || this.phase !== 'idle') return;

    // Held before the open: the item is banked inside it, and the discovery it
    // triggers is emitted synchronously from there.
    this.holdSpotlight(true);

    // The outcome is decided, charged and saved here — before any theatre.
    const pulls: OpenedBox[] = [];
    let failure: OpenFailure | null = null;
    for (let i = 0; i < Math.max(1, count); i++) {
      const outcome = this.gambler.open(box.id);
      if (!outcome.ok) { failure = outcome.code; break; }
      pulls.push(outcome.result);
      this.record(outcome.result);
    }
    if (!pulls.length) {
      this.holdSpotlight(false);
      this.error = this.failureText(failure ?? 'funds', box);
      this.cdr.markForCheck();
      return;
    }
    const rank = (p: OpenedBox) => rarityRank(p.item.rarity) * 2 + (p.unique ? 1 : 0);
    const best = pulls.reduce((top, p) => (rank(p) > rank(top) ? p : top));

    // The payload is attached before the first frame — see the header.
    this.error = null;
    this.active = box;
    this.result = best;
    this.extraPulls = pulls.length - 1;

    this.still = this.reducedMotion();
    const timing = revealTiming(best.item.rarity, this.speed());
    this.timing = timing;

    if (timing.wagerMs + timing.chargeMs + timing.crackMs === 0) {
      this.land();
      return;
    }

    this.phase = timing.wagerMs > 0 ? 'wager' : 'charging';
    this.cdr.markForCheck();

    const at = (ms: number, phase: RevealPhase, from: RevealPhase) => {
      this.timers.push(setTimeout(() => {
        if (this.phase !== from) return;
        if (phase === 'revealed') { this.land(); return; }
        this.phase = phase;
        this.cdr.markForCheck();
      }, ms));
    };
    if (timing.wagerMs > 0) at(timing.wagerMs, 'charging', 'wager');
    at(timing.wagerMs + timing.chargeMs, 'cracking', 'charging');
    at(timing.wagerMs + timing.chargeMs + timing.crackMs, 'revealed', 'cracking');
  }

  /** Jump to the result. Same outcome, no waiting. */
  skip(): void {
    if (this.phase === 'idle' || this.phase === 'revealed' || !this.result) return;
    this.clearTimers();
    this.land();
  }

  toggleFast(): void {
    this.fast = !this.fast;
    sessionFast = this.fast;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event?: Event): void {
    if (this.phase === 'idle') return;
    // The reveal used the key. Claim it, so a host listening further up (the
    // in-world panel closes on an unclaimed Escape at window) does not also
    // shut the whole place mid-reveal.
    event?.preventDefault();
    if (this.phase === 'revealed') this.dismiss();
    else this.skip();
  }

  private speed(): RevealSpeed {
    if (this.still) return 'instant';
    return this.fast ? 'fast' : 'normal';
  }

  private reducedMotion(): boolean {
    try {
      return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private record(opened: OpenedBox): void {
    const item = opened.item;
    const entry: PullRecord = {
      key: ++pullSeq,
      name: item.name,
      rarity: item.rarity,
      color: rarityColor(item.rarity),
      glow: rarityGlow(item.rarity),
      art: this.artSrc(item),
      initials: this.initials(item),
      named: !!opened.unique,
    };
    sessionHistory = [entry, ...sessionHistory].slice(0, HISTORY_LIMIT);
    this.history = sessionHistory;
  }

  /**
   * Show the item and celebrate it.
   *
   * One place rather than two, because the reveal is reached both by waiting
   * and by skipping and a player who skips has not asked for a quieter drop —
   * they have asked for a faster one.
   *
   * The rarity ladder is the rune ladder (`ItemRarity = RuneTier`), so an
   * Epic out of a box gets exactly what an Epic off the anvil gets.
   */
  private land(): void {
    this.phase = 'revealed';
    this.cdr.markForCheck();
    const rarity = this.result?.item.rarity;
    if (!rarity) return;
    // Next frame: the item card is written by the pass above, so measuring it
    // now would measure the box that is being replaced.
    requestAnimationFrame(() => {
      if (this.phase !== 'revealed') return;
      this.celebration.celebrate(rarity, this.host.nativeElement.querySelector('.gb-reveal__item'));
    });
  }

  dismiss(): void {
    this.clearTimers();
    this.phase = 'idle';
    this.active = null;
    this.result = null;
    this.extraPulls = 0;
    this.timing = null;
    this.celebration.cancel();
    this.holdSpotlight(false);
    this.cdr.markForCheck();
  }

  /** Buy the same box again straight from the reveal. */
  again(): void {
    const box = this.active;
    // Bridge the gap between this reveal's dismiss and the next one's open, or
    // a queued discovery would start in it and land on the new charge.
    this.spotlight.hold();
    this.dismiss();
    if (box) this.open(box);
    this.spotlight.release();
  }

  private failureText(code: OpenFailure, box: MysteryBox): string {
    switch (code) {
      case 'funds':
        return this.t('gambler.err.funds', { name: box.name, n: this.compact(box.cost) });
      case 'bag-full':
        return this.t('gambler.err.full');
      case 'catalogue':
      case 'mint':
        return this.t('gambler.err.empty');
      default:
        return this.t('gambler.err.closed');
    }
  }

  // ── The reveal ─────────────────────────────────────────────────────────────

  get revealedItem(): GameItem | null { return this.result?.item ?? null; }

  get revealTag(): QualityTag { return this.result?.tag ?? null; }

  get revealTagLabel(): string {
    const tag = this.result?.tag;
    return tag ? QUALITY_TAG_LABELS[tag] : '';
  }

  get revealQuality(): string {
    const q = this.result?.quality;
    return q == null ? '' : formatQuality(q);
  }

  get revealQualityColor(): string {
    const q = this.result?.quality;
    return q == null ? '' : gradeFor(q).color;
  }

  get revealColor(): string {
    return this.result ? rarityColor(this.result.item.rarity) : '#4dffe0';
  }

  get revealGlow(): string {
    return this.result ? rarityGlow(this.result.item.rarity) : 'rgba(0,255,204,0.6)';
  }

  /** Rank 0..6 on the ladder; higher ranks get the louder stage dressing. */
  get revealRank(): number {
    return this.result ? rarityRank(this.result.item.rarity) : 0;
  }

  get revealPhaseMs(): string {
    const t = this.timing;
    if (!t) return '0ms';
    if (this.phase === 'wager') return `${t.wagerMs}ms`;
    if (this.phase === 'charging') return `${t.chargeMs}ms`;
    if (this.phase === 'cracking') return `${t.crackMs}ms`;
    return '0ms';
  }

  get revealRarityLabel(): string {
    return this.result ? RUNE_TIERS[this.result.item.rarity].label : '';
  }

  /** The named object's passive line, when the box paid one out. */
  get revealPassive(): string {
    return this.result?.unique?.passive.text ?? '';
  }

  artSrc(item: GameItem | null): string | null {
    return item ? artFor(item.definitionId)?.src ?? null : null;
  }

  initials(item: GameItem | null): string {
    if (!item) return '';
    return item.name.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  // ── The till ───────────────────────────────────────────────────────────────

  private rebuildTill(): void {
    const kept = new Set(this.sellRows.filter(r => r.selected).map(r => r.item.id));
    // `snapshot.bag` is already everything unequipped, newest first — the
    // service keeps `items` private on purpose, and the bag is the half the till
    // is allowed to touch anyway.
    this.sellRows = this.inventory.snapshot.bag
      .filter(item => !item.explorerId && this.inventory.canSell(item))
      // Worst first: the whole point of the till is clearing out what the boxes
      // left behind, and the things worth clearing are at the bottom.
      .sort((a, b) => a.sellValue - b.sellValue)
      .map(item => ({ item, selected: kept.has(item.id) }));
  }

  toggleTill(): void {
    this.sellOpen = !this.sellOpen;
    this.cdr.markForCheck();
  }

  toggleRow(row: SellRow): void {
    row.selected = !row.selected;
    this.cdr.markForCheck();
  }

  get selectedRows(): SellRow[] { return this.sellRows.filter(r => r.selected); }
  get selectedCount(): number { return this.selectedRows.length; }
  get selectedGold(): number {
    return this.selectedRows.reduce((sum, r) => sum + r.item.sellValue, 0);
  }

  /** Select everything the boxes are most likely to have produced as filler. */
  selectPoor(): void {
    for (const row of this.sellRows) {
      const q = qualityOf(row.item);
      // Ungraded items are never auto-selected: they predate the grade, so the
      // player has no percentage to have judged them by and a bulk button must
      // not make that call for them.
      row.selected = q != null && q < 0.5 && !qualityTagOf(row.item);
    }
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    for (const row of this.sellRows) row.selected = false;
    this.cdr.markForCheck();
  }

  confirmSell(): void {
    const ids = this.selectedRows.map(r => r.item.id);
    if (!ids.length) return;
    this.inventory.sellMany(ids);
    this.rebuildTill();
    this.cdr.markForCheck();
  }

  // ── Shared formatting ──────────────────────────────────────────────────────

  compact(n: number): string {
    if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
    if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
    if (n >= 1_000) return `${trim(n / 1_000)}K`;
    return String(Math.round(n));
  }

  mods(item: GameItem): string[] {
    const out: string[] = [];
    for (const key of ITEM_STAT_KEYS) {
      const value = item.stats[key];
      if (value == null) continue;
      const pct = item.rollQuality?.[key];
      out.push(`${formatItemMod(key, value)}${typeof pct === 'number' ? ` (${formatQuality(pct)})` : ''}`);
    }
    return out;
  }

  rarityColor(rarity: ItemRarity): string { return rarityColor(rarity); }
  rarityLabel(rarity: ItemRarity): string { return RUNE_TIERS[rarity].label; }
  tagOf(item: GameItem): QualityTag { return qualityTagOf(item); }
  named(item: GameItem): boolean { return isUnique(item); }
  passiveOf(item: GameItem): string {
    return uniqueById(item.definitionId)?.passive.text ?? '';
  }

  qualityText(item: GameItem): string {
    const q = qualityOf(item);
    return q == null ? '—' : formatQuality(q);
  }

  qualityColor(item: GameItem): string {
    const q = qualityOf(item);
    return q == null ? 'rgba(232,236,241,0.4)' : gradeFor(q).color;
  }

  trackBox = (_: number, box: MysteryBox) => box.id;
  trackRow = (_: number, row: SellRow) => row.item.id;
  trackOdds = (_: number, row: OddsRow) => row.rarity;
  trackPull = (_: number, pull: PullRecord) => pull.key;

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}

function trim(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}
