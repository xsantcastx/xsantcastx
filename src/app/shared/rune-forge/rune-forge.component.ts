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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { formatCurrency } from '../economy/economy.model';
import { RuneForgeService, RuneFind } from './rune-forge.service';
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

/** A rune as the inventory grid needs it. */
interface RuneCell {
  rune: Rune;
  tier: RuneTierDefinition;
  held: number;
  /** Found at least once, ever. Drives whether the name is legible. */
  known: boolean;
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
    rune, tier: tierOf(rune.tier), held: 0, known: false,
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
  /** True while the hammer animation runs, so a second click cannot land. */
  striking = false;
  /** The rune whose lore is open in the inventory, if any. */
  inspecting: Rune | null = null;
  /** Set when a strike is refused for want of Gold. Cleared on the next strike. */
  broke = false;

  ngOnInit(): void {
    this.forge.init();
    if (!this.isBrowser) return;

    this.subs.add(this.forge.snapshot$.subscribe(snap => {
      this.cells = RUNES.map(rune => ({
        rune,
        tier: tierOf(rune.tier),
        held: snap.held[rune.id] ?? 0,
        known: (snap.held[rune.id] ?? 0) > 0 || this.forge.hasEverFound(rune.id),
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

  ngOnDestroy(): void {
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
    this.reveal = null;
    this.revealTier = null;
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
    return {
      word,
      tier: tierOf(word.tier),
      slots,
      crafted,
      ready: !crafted && slots.every(s => s.satisfied),
      hidden: !crafted && !word.runes.some(id => this.forge.hasEverFound(id)),
    };
  }
}
