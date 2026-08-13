/**
 * rune-forge.component.ts — the anvil, the inventory and the recipe wall.
 *
 * Prerendered in its empty state, the way the Market and the Forge Keeper are:
 * the rune registry and the six recipes are pure data, so the server can render
 * all twenty-five cards greyed out and all six recipes locked without knowing
 * anything about the visitor. Hydration only fills in counts and affordability.
 * Nothing on the page is `@if`'d on browser-only state at the top level, so the
 * layout does not move when the ledger arrives.
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
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { formatCurrency } from '../economy/economy.model';
import { RuneForgeService, RuneFind } from './rune-forge.service';
import { LoreScrollService } from './lore-scroll.service';
import {
  RUNES,
  RUNEWORDS,
  RUNE_TIERS,
  RUNE_TIER_ORDER,
  Rune,
  RuneTier,
  RuneTierDefinition,
  Runeword,
  STRIKE_COST,
  runeById,
  tierOf,
} from './rune.model';
import { CardArt, runeCard, runewordCard } from './rune-cards';

/** A rune as the inventory grid needs it. */
interface RuneCell {
  rune: Rune;
  tier: RuneTierDefinition;
  held: number;
  /** Found at least once, ever. Drives whether the name is legible. */
  known: boolean;
  /**
   * The painted card, or null for Mote, Seam and Ledger — the three runes the
   * sheet does not cover, which keep the name-glyph the ladder used before the
   * art landed.
   *
   * Resolved here rather than called from the template because this is a
   * twenty-five cell grid: a lookup in the binding runs twenty-five times per
   * change-detection pass to produce a value that changes only when the rune
   * registry does, which is never at runtime.
   */
  card: CardArt | null;
}

/** A recipe as the crafting wall needs it. */
interface RecipeRow {
  word: Runeword;
  tier: RuneTierDefinition;
  /** One entry per rune in the recipe, in the order they are set. */
  slots: { rune: Rune; held: number; satisfied: boolean }[];
  crafted: boolean;
  ready: boolean;
  /** True until any rune in the recipe has been seen. Renders as "???". */
  hidden: boolean;
  /** All six words are painted, but the card is withheld while `hidden`. */
  card: CardArt | null;
}

/** How long the reveal card stays up before the anvil is armed again. */
const REVEAL_GRACE_MS = 320;

/** Epic and above earn the sub-bass voice on the reveal cue. */
function isHeavy(tier: RuneTier): boolean {
  return RUNE_TIER_ORDER.indexOf(tier) >= RUNE_TIER_ORDER.indexOf('epic');
}

@Component({
  selector: 'app-rune-forge',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rune-forge.component.html',
  styleUrls: ['./rune-forge.component.css'],
})
export class RuneForgeComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly forge = inject(RuneForgeService);
  private readonly economy = inject(EconomyService);
  private readonly audio = inject(ForgeAudioService);
  private readonly scrolls = inject(LoreScrollService);
  private readonly doc = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private flareTimer: ReturnType<typeof setTimeout> | null = null;

  readonly strikeCost = STRIKE_COST;
  readonly tierOrder = RUNE_TIER_ORDER;
  readonly tiers = RUNE_TIERS;
  readonly totalRunes = RUNES.length;
  readonly totalWords = RUNEWORDS.length;

  /** Built once from the registry, so the server renders the full grid. */
  cells: RuneCell[] = RUNES.map(rune => ({
    rune, tier: tierOf(rune.tier), held: 0, known: false, card: runeCard(rune.id),
  }));
  recipes: RecipeRow[] = RUNEWORDS.map(word => this.blankRecipe(word));

  gold = 0;
  strikes = 0;
  goldSpent = 0;
  unique = 0;
  craftedCount = 0;
  rarest: Rune | null = null;
  collectionValue = 0;

  /** The rune the anvil just produced. Null between strikes. */
  reveal: RuneFind | null = null;
  revealTier: RuneTierDefinition | null = null;
  /**
   * The painted card for the rune on show, or null for the three unpainted
   * ones. When it is set the reveal shows the card and drops its own name and
   * lore text: both are painted onto the card, and printing them underneath is
   * the same sentence twice. The name survives as the image's alt text, so what
   * a screen reader announces does not change either way.
   */
  revealCard: CardArt | null = null;
  /** The scroll's prose, pre-split. Empty when the strike turned up no scroll. */
  scrollParagraphs: string[] = [];
  /** True while the hammer animation runs, so a second click cannot land. */
  striking = false;
  /** The rune whose lore is open in the inventory, if any. */
  inspecting: Rune | null = null;
  /** Set when a strike is refused for want of Gold. Cleared on the next strike. */
  broke = false;

  /**
   * The painted forge, preloaded per breakpoint.
   *
   * Scoped to this route rather than declared in index.html: a global preload
   * would pull ~140KB of a single route's artwork on every page of the site,
   * which is the opposite of what a preload is for. Added from the component
   * so it lands in this route's prerendered HTML — the same arrangement the
   * homepage hero uses, and the reason both are removed again in ngOnDestroy.
   *
   * The media queries mirror the <picture> sources exactly. If they disagree,
   * the browser preloads one file and then downloads a different one.
   */
  private static readonly HERO_PRELOADS: ReadonlyArray<{ href: string; media: string }> = [
    { href: 'assets/images/runeforge-hero-768.webp',  media: '(max-width: 768px)' },
    { href: 'assets/images/runeforge-hero-1280.webp', media: '(min-width: 768.02px) and (max-width: 1280px)' },
    { href: 'assets/images/runeforge-hero-1536.webp', media: '(min-width: 1280.02px)' },
  ];

  private static readonly ART_ROUTE_CLASS = 'gf-art-route';

  ngOnInit(): void {
    this.forge.init();
    this.addHeroPreloads();
    // Switches off the site's CSS atmosphere — the body gradient, the nebula,
    // the starfield, the matrix layer, the pulsar, the corner runes and the
    // constellation canvas — for this route. All of it was the stand-in for
    // artwork this page now has, and running both is two forges at once.
    this.markArtRoute(true);
    if (!this.isBrowser) return;

    this.subs.add(this.forge.snapshot$.subscribe(snap => {
      this.cells = RUNES.map(rune => ({
        rune,
        tier: tierOf(rune.tier),
        held: snap.held[rune.id] ?? 0,
        known: (snap.held[rune.id] ?? 0) > 0 || this.forge.hasEverFound(rune.id),
        card: runeCard(rune.id),
      }));
      this.recipes = RUNEWORDS.map(word => this.buildRecipe(word));
      this.strikes = snap.strikes;
      this.goldSpent = snap.goldSpent;
      this.unique = snap.unique;
      this.craftedCount = snap.crafted.length;
      this.rarest = snap.rarest;
      this.collectionValue = snap.collectionValue;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.economy.snapshot$.subscribe(snap => {
      this.gold = snap.gold;
      this.cdr.markForCheck();
    }));
  }

  private addHeroPreloads(): void {
    const head = this.doc.head;
    if (!head || head.querySelector('link[data-rf-hero]')) return;
    for (const p of RuneForgeComponent.HERO_PRELOADS) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('type', 'image/webp');
      link.setAttribute('media', p.media);
      link.setAttribute('href', p.href);
      link.setAttribute('data-rf-hero', '');
      head.appendChild(link);
    }
  }

  private removeHeroPreloads(): void {
    this.doc.head?.querySelectorAll('link[data-rf-hero]').forEach(el => el.remove());
  }

  private markArtRoute(add: boolean): void {
    const body = this.doc.body;
    if (!body) return;
    if (add) body.classList.add(RuneForgeComponent.ART_ROUTE_CLASS);
    else body.classList.remove(RuneForgeComponent.ART_ROUTE_CLASS);
  }

  ngOnDestroy(): void {
    this.removeHeroPreloads();
    this.markArtRoute(false);
    this.subs.unsubscribe();
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    if (this.flareTimer !== null) clearTimeout(this.flareTimer);
    // Navigating away mid-Mythic would otherwise leave the whole site under a
    // red wash until the next reload.
    if (this.isBrowser) delete document.documentElement.dataset['runeFlare'];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The anvil
  // ───────────────────────────────────────────────────────────────────────────

  get canStrike(): boolean {
    return this.isBrowser && !this.striking && this.gold >= STRIKE_COST;
  }

  strike(): void {
    if (!this.isBrowser || this.striking) return;

    this.broke = false;
    if (this.gold < STRIKE_COST) {
      this.broke = true;
      return;
    }

    // The hammer falls first and the rune is resolved under it, so the reveal
    // lands on the impact frame rather than before the hammer has moved.
    this.striking = true;
    this.reveal = null;
    this.revealTier = null;

    const find = this.forge.strike();
    if (!find) {
      // Gold went between the check and the spend — another tab, most likely.
      this.striking = false;
      this.broke = true;
      return;
    }

    const tier = tierOf(find.rune.tier);
    this.audio.strike(tier.semitones);
    if (find.rune.tier === 'singular') {
      this.audio.voidRumble();
    } else {
      this.audio.runeReveal(tier.semitones, isHeavy(find.rune.tier));
    }

    this.reveal = find;
    this.revealTier = tier;
    this.revealCard = runeCard(find.rune.id);
    // Split once, here, rather than in a template getter that would re-split on
    // every change-detection pass for the whole time the card is up.
    this.scrollParagraphs = find.scroll
      ? find.scroll.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
      : [];
    if (find.scroll) this.audio.scrollUnfurl();
    this.flare(find.rune.tier, tier.duration);
    this.cdr.markForCheck();

    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => {
      this.striking = false;
      this.revealTimer = null;
      this.cdr.markForCheck();
    }, REVEAL_GRACE_MS);
  }

  /** Dismiss the reveal card early. The cinematic tiers are worth sitting through. */
  dismissReveal(): void {
    // Dismissing is how you finish reading, so it is also what marks the scroll
    // read — the alternative is a Codex that shows a "new" dot on a page the
    // visitor has just had open in front of them.
    if (this.reveal?.scroll) this.scrolls.markRead(this.reveal.scroll.id);
    this.reveal = null;
    this.revealTier = null;
    this.revealCard = null;
    this.scrollParagraphs = [];
    this.cdr.markForCheck();
  }

  /**
   * Hand the top three tiers to the screen-level flare in styles.css.
   *
   * Written as a data attribute on <html> rather than as a layer inside this
   * component because a fixed layer authored here would be trapped by the
   * routed host's transform — see the note in the template and in styles.css.
   *
   * The clear is scheduled off the tier's own `duration`, and the attribute is
   * removed rather than reset to a falsy value so that two Mythics in a row
   * restart the animation instead of the second one being swallowed by the
   * still-running first.
   */
  private flare(tier: RuneTier, ms: number): void {
    if (!this.isBrowser) return;
    if (RUNE_TIER_ORDER.indexOf(tier) < RUNE_TIER_ORDER.indexOf('legendary')) return;

    const root = document.documentElement;
    if (this.flareTimer !== null) clearTimeout(this.flareTimer);
    delete root.dataset['runeFlare'];
    // Re-read a layout property so the removal and the re-add are not coalesced
    // into a no-op by the style system, which would leave a repeat find with no
    // flare at all.
    void root.offsetWidth;
    root.dataset['runeFlare'] = tier;

    this.flareTimer = setTimeout(() => {
      delete root.dataset['runeFlare'];
      this.flareTimer = null;
    }, ms);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Inventory and crafting
  // ───────────────────────────────────────────────────────────────────────────

  inspect(cell: RuneCell): void {
    this.inspecting = this.inspecting?.id === cell.rune.id ? null : cell.rune;
    this.cdr.markForCheck();
  }

  craft(row: RecipeRow): void {
    if (!row.ready) return;
    if (!this.forge.craft(row.word.id)) return;
    // The word is heavier than any single rune, so it gets the heavy cue
    // regardless of which tier the recipe is filed under.
    this.audio.runeReveal(tierOf(row.word.tier).semitones, true);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Template helpers
  // ───────────────────────────────────────────────────────────────────────────

  money(n: number): string { return formatCurrency(n); }

  /** The published chance of a rune, as a readable percentage. */
  chance(rune: Rune): string {
    const pct = rune.dropRate * 100;
    // A fixed number of decimals would print "0.1%" for Void and "12.0%" for
    // Ash. Three orders of magnitude apart deserve different precision.
    if (pct >= 10) return `${pct.toFixed(0)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    if (pct >= 0.1) return `${pct.toFixed(2)}%`;
    return `${pct.toFixed(3)}%`;
  }

  cellsOf(tier: RuneTier): RuneCell[] {
    return this.cells.filter(c => c.rune.tier === tier);
  }

  trackCell = (_: number, cell: RuneCell) => cell.rune.id;
  trackRecipe = (_: number, row: RecipeRow) => row.word.id;
  trackTier = (_: number, tier: RuneTier) => tier;
  trackSlot = (i: number) => i;

  // ───────────────────────────────────────────────────────────────────────────

  private blankRecipe(word: Runeword): RecipeRow {
    return {
      word,
      tier: tierOf(word.tier),
      slots: word.runes.map(id => ({ rune: runeById(id)!, held: 0, satisfied: false })),
      crafted: false,
      ready: false,
      // Hidden until at least one of its runes has been seen, so the wall reads
      // as something to uncover rather than as a checklist handed over on
      // arrival. The names stay hidden; the shape of the recipe does not.
      hidden: true,
      // Null while hidden for the same reason the name is "???": the painted
      // card has the word's name across the top of it, so showing the art is
      // showing the answer.
      card: null,
    };
  }

  private buildRecipe(word: Runeword): RecipeRow {
    // Counted down across the slots so a recipe that wants two of a rune shows
    // the first slot satisfied and the second not, rather than both satisfied
    // off a single copy.
    const remaining = new Map<string, number>();
    const slots = word.runes.map(id => {
      const rune = runeById(id)!;
      const used = remaining.get(id) ?? 0;
      const held = this.forge.countOf(id);
      remaining.set(id, used + 1);
      return { rune, held, satisfied: held > used };
    });

    const crafted = this.forge.hasCrafted(word.id);
    const hidden = !crafted && !word.runes.some(id => this.forge.hasEverFound(id));
    return {
      word,
      tier: tierOf(word.tier),
      slots,
      crafted,
      ready: !crafted && slots.every(s => s.satisfied),
      hidden,
      card: hidden ? null : runewordCard(word.id),
    };
  }
}
