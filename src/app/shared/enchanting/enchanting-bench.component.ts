/**
 * enchanting-bench.component.ts — the table: wells, a rune drawer, and a burner.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything authored is built at construction from pure data — the infusion
 * catalogue, the Socket Word wall with every word in its undiscovered state —
 * so the prerendered HTML is the complete page and a crawler sees the same
 * thing a player on a cold cache does. `ngOnInit` is browser-only and its whole
 * job is filling in what you own: your items, your runes, your materials, your
 * Gold and your running timers. Same shape as the crafting bench, for the same
 * reason.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE WORD WALL SHOWS EVERY WORD
 * ─────────────────────────────────────────────────────────────────────────────
 * A secret nobody can find is a dead end rather than a secret, so every word is
 * on the wall from the first visit — but undiscovered ones show their frame,
 * their socket count, their difficulty and their clue, and *not* their runes.
 * That is the same contract the Codex's Secrets wall already keeps, and it is
 * what makes "experiment" a real instruction rather than a shrug.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * Every well is a real button with a real label, every control clears 44px, the
 * result of a socket, an unsocket and a brew all announce through one
 * `aria-live` region, and the countdown updates its text rather than only its
 * bar so a screen reader can read the time left.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { artFor, type ArtEntry } from '../art/art';
import { CelebrationService } from '../celebration/celebration.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import {
  ITEM_STAT_KEYS,
  formatItemMod,
  type GameItem,
  type ItemStats,
} from '../rpg/item.model';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { RUNES, RUNE_TIERS, runeById, type Rune } from '../rune-forge/rune.model';
import { TranslationService } from '../../translation.service';
import { EnchantingGateway, type BrewReject, type SocketReject } from './enchanting.gateway';
import { InfusionService } from './infusion.service';
import {
  INFUSIONS,
  MAX_ACTIVE_INFUSIONS,
  formatRemaining,
  infusionById,
  type Infusion,
} from './infusion.model';
import {
  SOCKET_WORDS,
  matchSocketWord,
  wordTier,
  wornStats,
  type SocketWord,
} from './socket-words';
import {
  isSocketable,
  socketCountFor,
  socketEffectOf,
  socketFrameOf,
  socketStats,
  socketsOf,
  unsocketCost,
} from './socket.model';

import { RelatedPagesComponent } from '../seo/related-pages.component';
/** One socketable item in the bag or on the body, as the picker renders it. */
export interface SocketableView {
  item: GameItem;
  art: ArtEntry | null;
  count: number;
  filled: number;
  word: SocketWord | null;
  frame: 'weapon' | 'armor';
}

/** One well on the selected item. */
export interface WellView {
  index: number;
  runeId: string | null;
  rune: Rune | null;
  /** Gold to pull it. Zero when empty. */
  cost: number;
  effect: string[];
}

/** One rune the visitor holds, for the drawer. */
export interface DrawerRune {
  rune: Rune;
  held: number;
  effect: string;
}

/** One card on the word wall. */
export interface WordCard {
  word: SocketWord;
  found: boolean;
  tierColor: string;
  tierLabel: string;
}

/** One card on the infusion table. */
export interface InfusionCard {
  infusion: Infusion;
  inputs: { id: string; name: string; art: ArtEntry | null; need: number; have: number; enough: boolean }[];
  ready: boolean;
  running: boolean;
  remaining: string;
  /** 0..1 of the timer already burned. Drives the ring. */
  burned: number;
}

const SOCKET_COPY: Readonly<Record<SocketReject, string>> = {
  ssr: 'The table is not lit yet. Give it a moment.',
  missing: 'That piece is not in your bag any more.',
  'not-socketable': 'Nothing about that piece will hold a rune.',
  'bad-well': 'That well is not on this piece.',
  occupied: 'Something is already set in that well.',
  empty: 'There is nothing in that well to pull.',
  'unknown-rune': 'The Archivum has no such rune on file.',
  'no-rune': 'You do not hold that rune.',
  funds: 'Not enough Gold to pull it back out.',
  persist: 'The setting did not save. Nothing was spent — try again.',
};

const BREW_COPY: Readonly<Record<BrewReject, string>> = {
  ssr: 'The burner is not lit yet. Give it a moment.',
  'unknown-infusion': 'The Archivum has no such infusion on file.',
  running: 'That one is already running. Let it finish.',
  slots: 'Three is all the table will hold at once.',
  materials: 'You are short of what it burns.',
  persist: 'The brew did not save. Nothing was spent — try again.',
};

@Component({
  selector: 'app-enchanting-bench',
  standalone: true,
  imports: [RelatedPagesComponent, CommonModule, FormsModule],
  templateUrl: './enchanting-bench.component.html',
  styleUrls: ['./enchanting-bench.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnchantingBenchComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gateway = inject(EnchantingGateway);
  private readonly inventory = inject(InventoryService);
  private readonly runeForge = inject(RuneForgeService);
  private readonly economy = inject(EconomyService);
  private readonly infusions = inject(InfusionService);
  private readonly celebration = inject(CelebrationService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);

  private subs: Subscription[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly maxActive = MAX_ACTIVE_INFUSIONS;
  readonly totalWords = SOCKET_WORDS.length;
  readonly tiers = RUNE_TIERS;

  // ── State ──────────────────────────────────────────────────────────────────
  hydrated = false;
  gold = 0;

  /** Everything in the bag or worn that has at least one well. */
  socketables: SocketableView[] = [];
  selected: GameItem | null = null;
  wells: WellView[] = [];
  drawer: DrawerRune[] = [];

  /** Which well the player is filling, or null when the drawer is closed. */
  activeWell: number | null = null;

  words: WordCard[] = [];
  infusionCards: InfusionCard[] = [];

  /** Percentage points running on each channel. */
  live = { gold: 0, xp: 0, magicFind: 0 };
  freeSlots = MAX_ACTIVE_INFUSIONS;

  error: string | null = null;
  announce = '';
  /** The word a socket just seated, for the celebration banner. */
  revealed: SocketWord | null = null;

  constructor() {
    // Authored, pure, and therefore in the prerendered HTML. Ownership is
    // layered on in `ngOnInit`.
    this.words = this.buildWords(new Set());
    this.infusionCards = this.buildInfusions(Date.now());
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.gateway.init();

    this.subs.push(this.inventory.snapshot$.subscribe(() => {
      this.hydrated = true;
      this.refresh();
    }));
    this.subs.push(this.runeForge.snapshot$.subscribe(() => this.refresh()));
    this.subs.push(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.cdr.markForCheck();
    }));
    this.subs.push(this.infusions.snapshot$.subscribe(() => this.refresh()));
    this.subs.push(this.infusions.lapsed$.subscribe(def => {
      this.announce = `${def.name} has run out.`;
      this.cdr.markForCheck();
    }));

    // One second, for the countdown text only. The ledger keeps its own clock —
    // see `InfusionService.retime` — so this is purely the numbers on screen and
    // it stops the moment nothing is running.
    this.ticker = setInterval(() => {
      if (!this.infusionCards.some(card => card.running)) return;
      this.infusionCards = this.buildInfusions(Date.now());
      this.cdr.markForCheck();
    }, 1000);

    this.refresh();
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) sub.unsubscribe();
    this.subs = [];
    if (this.ticker) clearInterval(this.ticker);
  }

  t(key: string): string { return this.i18n.translate(key); }

  // ── Building ───────────────────────────────────────────────────────────────

  private refresh(): void {
    const now = Date.now();
    const snap = this.inventory.snapshot;

    this.socketables = snap.items
      .filter(item => isSocketable(item))
      .map(item => {
        const frame = socketFrameOf(item);
        return {
          item,
          art: artFor(item.definitionId ?? item.id),
          count: socketCountFor(item),
          filled: socketsOf(item).filter(id => id !== null).length,
          word: matchSocketWord(item),
          frame: frame === 'weapon' ? 'weapon' as const : 'armor' as const,
        };
      })
      // Worn first, then most wells, then most recently found — the piece you
      // are actually wearing is the one you came here to change.
      .sort((a, b) =>
        Number(b.item.equipped) - Number(a.item.equipped)
        || b.count - a.count
        || b.item.foundAt.localeCompare(a.item.foundAt));

    // Keep the selection pointed at the live copy of the same item: every
    // socket rewrites the record, and holding the pre-write object would leave
    // the wells rendering the state before the change that just happened.
    const keep = this.selected
      ? this.socketables.find(row => row.item.id === this.selected!.id)?.item ?? null
      : null;
    this.selected = keep ?? this.socketables[0]?.item ?? null;
    this.wells = this.buildWells(this.selected);

    const held = this.runeForge.snapshot.held;
    this.drawer = RUNES
      .filter(rune => (held[rune.id] ?? 0) > 0)
      .map(rune => ({
        rune,
        held: held[rune.id] ?? 0,
        effect: describeStats(socketEffectOf(rune.id)).join(', ') || '—',
      }));

    this.words = this.buildWords(this.discoveredWordIds());
    this.infusionCards = this.buildInfusions(now);

    const infusion = this.infusions.snapshot;
    this.live = { gold: infusion.gold, xp: infusion.xp, magicFind: infusion.magicFind };
    this.freeSlots = infusion.free;
    this.gold = this.economy.snapshot.gold;
    this.cdr.markForCheck();
  }

  /**
   * Which words the visitor has seated at least once.
   *
   * Read off what they are *currently* holding rather than off a found-set of
   * its own, which is deliberate: a Socket Word is not an achievement, it is a
   * thing your gear is spelling right now, and a wall that kept saying "found"
   * about a word whose runes you sold would be describing a sword you do not
   * have. The Codex's Secrets wall is where a permanent record would belong.
   */
  private discoveredWordIds(): Set<string> {
    const ids = new Set<string>();
    for (const row of this.socketables) {
      if (row.word) ids.add(row.word.id);
    }
    return ids;
  }

  private buildWells(item: GameItem | null): WellView[] {
    if (!item) return [];
    return socketsOf(item).map((runeId, index) => ({
      index,
      runeId,
      rune: runeId ? runeById(runeId) ?? null : null,
      cost: runeId ? unsocketCost(runeId) : 0,
      effect: runeId ? describeStats(socketEffectOf(runeId)) : [],
    }));
  }

  private buildWords(found: ReadonlySet<string>): WordCard[] {
    return SOCKET_WORDS.map(word => {
      const tier = wordTier(word);
      return {
        word,
        found: found.has(word.id),
        tierColor: RUNE_TIERS[tier].color,
        tierLabel: RUNE_TIERS[tier].label,
      };
    });
  }

  private buildInfusions(now: number): InfusionCard[] {
    return INFUSIONS.map(infusion => {
      const inputs = infusion.inputs.map(row => {
        const have = this.isBrowser ? this.inventory.stackOf(row.materialId) : 0;
        const display = materialDisplay(row.materialId);
        return {
          id: row.materialId,
          name: display?.name ?? row.materialId,
          art: artFor(row.materialId),
          need: row.count,
          have,
          enough: have >= row.count,
        };
      });
      const left = this.isBrowser ? this.infusions.remaining(infusion.id, now) : 0;
      const span = infusion.minutes * 60_000;
      return {
        infusion,
        inputs,
        ready: inputs.every(row => row.enough),
        running: left > 0,
        remaining: formatRemaining(left),
        burned: left > 0 ? Math.min(1, Math.max(0, 1 - left / span)) : 0,
      };
    });
  }

  // ── Reads the template needs ───────────────────────────────────────────────

  select(item: GameItem): void {
    this.selected = item;
    this.activeWell = null;
    this.error = null;
    this.wells = this.buildWells(item);
    this.cdr.markForCheck();
  }

  openDrawer(well: number): void {
    this.activeWell = this.activeWell === well ? null : well;
    this.error = null;
    this.cdr.markForCheck();
  }

  /** The word seated in the selected item right now, or null. */
  get selectedWord(): SocketWord | null {
    return this.selected ? matchSocketWord(this.selected) : null;
  }

  /** Base roll → runes → word, as three printable columns. */
  get selectedBase(): string[] {
    return this.selected ? describeStats(this.selected.stats) : [];
  }

  get selectedRunes(): string[] {
    return this.selected ? describeStats(socketStats(this.selected)) : [];
  }

  get selectedTotal(): string[] {
    return this.selected ? describeStats(wornStats(this.selected)) : [];
  }

  trackWell = (_: number, well: WellView) => well.index;
  trackRune = (_: number, row: DrawerRune) => row.rune.id;
  trackWord = (_: number, card: WordCard) => card.word.id;
  trackInfusion = (_: number, card: InfusionCard) => card.infusion.id;
  trackItem = (_: number, row: SocketableView) => row.item.id;

  /** `Ash · Ember · Glint` — only ever printed for a discovered word. */
  runeNames(word: SocketWord): string {
    return word.runes.map(id => runeById(id)?.name ?? id).join(' · ');
  }

  wellLabel(word: SocketWord): string {
    return word.runes.length === 1 ? '1 well' : `${word.runes.length} wells`;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setRune(runeId: string): void {
    if (!this.selected || this.activeWell === null) return;
    const result = this.gateway.socket(this.selected.id, this.activeWell, runeId);
    if (!result.ok) {
      this.error = SOCKET_COPY[result.code];
      this.cdr.markForCheck();
      return;
    }
    this.error = null;
    this.activeWell = null;
    const rune = runeById(runeId);
    this.announce = result.discovered && result.word
      ? `${result.word.name} — the runes have spelled something.`
      : `${rune?.name ?? 'The rune'} is set.`;
    if (result.discovered && result.word) {
      this.revealed = result.word;
      // Scaled to the rarest rune the word demands, which is the same scale the
      // Forge celebrates a find on. A word seating for the first time is the
      // loudest thing that happens at this table, and the Godforge Seal should
      // not land as quietly as Cinderling.
      this.celebration.celebrate(wordTier(result.word));
    }
    this.refresh();
  }

  pull(well: WellView): void {
    if (!this.selected || !well.runeId) return;
    const result = this.gateway.unsocket(this.selected.id, well.index);
    if (!result.ok) {
      this.error = SOCKET_COPY[result.code];
      this.cdr.markForCheck();
      return;
    }
    this.error = null;
    this.revealed = null;
    const rune = runeById(well.runeId);
    this.announce = `${rune?.name ?? 'The rune'} is back in the drawer.`;
    this.refresh();
  }

  brew(card: InfusionCard): void {
    const blocked = this.gateway.brewBlocker(card.infusion.id);
    if (blocked) {
      this.error = BREW_COPY[blocked];
      this.cdr.markForCheck();
      return;
    }
    // A fresh id per press: the material half is replay-safe on it, so a double
    // click inside one press cannot burn two sets, and two deliberate brews an
    // hour apart are two different mutations.
    const mutationId = `infuse:${card.infusion.id}:${Date.now()}`;
    const result = this.gateway.brew(card.infusion.id, mutationId);
    if (!result.ok) {
      this.error = BREW_COPY[result.code];
      this.cdr.markForCheck();
      return;
    }
    this.error = null;
    this.announce = `${result.infusion.name} is running — ${result.infusion.effect}.`;
    this.celebration.celebrate('uncommon');
    this.refresh();
  }

  dismissError(): void {
    this.error = null;
    this.cdr.markForCheck();
  }

  dismissReveal(): void {
    this.revealed = null;
    this.cdr.markForCheck();
  }

  /** What an infusion is short of, for the card's disabled reason. */
  brewLabel(card: InfusionCard): string {
    if (card.running) return this.t('enchant.infusion.running');
    if (!card.ready) return this.t('enchant.infusion.short');
    if (this.freeSlots <= 0) return this.t('enchant.infusion.full');
    return this.t('enchant.infusion.brew');
  }

  canBrew(card: InfusionCard): boolean {
    return this.hydrated && card.ready && !card.running && this.freeSlots > 0;
  }

  nameOf(id: string): string {
    return infusionById(id)?.name ?? id;
  }
}

/** `Gold/sec +12`, `Magic Find +6%` — the stat lines a block prints. */
function describeStats(stats: ItemStats): string[] {
  return ITEM_STAT_KEYS
    .filter(key => (stats[key] ?? 0) !== 0)
    .map(key => formatItemMod(key, stats[key] as number));
}
