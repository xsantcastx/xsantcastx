/**
 * pvp-arena.component.ts — the Coliseum: five rings, one fight screen, a shop.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SSR
 * ─────────────────────────────────────────────────────────────────────────────
 * The five gate cards and the seven shop rows are built at construction from
 * `ARENA_TIERS` and `ARENA_SHOP`, which are pure data, so the prerendered HTML
 * is the whole ring — every tier's name, flavour, payout and unlock condition,
 * and every shop row's price and description — with nothing waiting on a
 * service. `ngOnInit` runs browser-only and its whole job is filling in what
 * you have: your Might and Guard, which gates are open, your points, the clock
 * on the lock. Same ordering as the bench and the Collection Log, for the same
 * reason: a crawler and a player on a cold cache should see the same page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE FIGHT IS SETTLED BEFORE IT IS SHOWN
 * ─────────────────────────────────────────────────────────────────────────────
 * The press calls `ArenaGateway.fight` immediately and gets the whole
 * transcript back — three rounds, two numbers each, and the payout — and only
 * then starts the reveal. The alternative, resolving a round at a time as the
 * animation reaches it, would put the record's authority inside a timer: a tab
 * backgrounded mid-reveal drops `setTimeout` callbacks the same way it drops
 * `requestAnimationFrame`, and a bout that banked two rounds and never settled
 * the third would leave the ledger holding half a fight.
 *
 * So the reveal is theatre over a decided result. Navigating away mid-reveal,
 * backgrounding the tab, or reloading loses the animation and nothing else —
 * the Gold, the XP and the points were banked on the press.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCESSIBILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * The reveal announces itself through an `aria-live="polite"` region that gets
 * the verdict in one sentence rather than three staggered fragments, every
 * control clears 44px, and `prefers-reduced-motion` skips straight to the
 * result instead of removing the feedback. The overlay traps nothing and closes
 * on Escape — it is a result screen, not a dialog with a decision in it.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../translation.service';
import { ArenaGateway, type BoutReject, type PurchaseReject } from '../shared/arena/arena.gateway';
import { ArenaService, type ArenaSnapshot } from '../shared/arena/arena.service';
import {
  ARENA_SHOP,
  ARENA_TIERS,
  ARENA_TIER_ORDER,
  type ArenaLoadout,
  type ArenaOpponent,
  type ArenaStock,
  type ArenaTier,
  type ArenaTierId,
  type BoutResult,
  type OddsLabel,
  arenaRankFor,
  arenaTier,
  boutOdds,
  formatCooldown,
  guardOf,
  mightOf,
  oddsLabel,
  opponentsForTier,
} from '../shared/arena/arena.model';

/** One challenger on a gate card, with the odds of beating *them*. */
interface ChallengerRow {
  npc: ArenaOpponent;
  odds: number;
  oddsLabel: OddsLabel;
}

/** One gate card. Rebuilt on every publish — it is eight numbers, not a tree. */
interface GateCard {
  tier: ArenaTier;
  unlocked: boolean;
  wins: number;
  /** Wins still needed in the tier below. Zero once open. */
  toUnlock: number;
  /**
   * Best-of-three odds against this ring's *weakest* name, 0–1.
   *
   * The easiest name rather than the hardest, because this number answers the
   * question the card is actually asked: "can I get a win here at all?" Quoting
   * the hardest name made the Bronze card read "outmatched, 0%" to every new
   * account — true of the Drakeling, false of Hollis, and a flat lie about the
   * ring, which a rank-1 player in no kit wins about half the time. Each
   * challenger below carries its own odds, so nothing is hidden by this being
   * the optimistic end.
   */
  odds: number;
  oddsLabel: OddsLabel;
  roster: ChallengerRow[];
}

interface ShopRow {
  stock: ArenaStock;
  owned: boolean;
  affordable: boolean;
  /** Null when the row can be bought. */
  blocker: PurchaseReject | null;
}

/** Which beat of the reveal is on screen. */
type Stage = 'idle' | 'compare' | 'rounds' | 'verdict';

const REJECT_COPY: Readonly<Record<BoutReject, string>> = {
  ssr: 'The sand is not raked yet. Give it a moment.',
  'unknown-tier': 'There is no such ring in this building.',
  'unknown-opponent': 'Nobody answered the call.',
  locked: 'That gate is chained. Win your way up to it.',
  cooldown: 'You are still catching your breath.',
};

const PURCHASE_COPY: Readonly<Record<PurchaseReject, string>> = {
  ssr: 'The stall is not open yet. Give it a moment.',
  'unknown-stock': 'The quartermaster has no such thing on the shelf.',
  wins: 'You have not won enough to be shown that one.',
  owned: 'You already took that off this shelf once.',
  points: 'Not enough arena points.',
  capacity: 'Your bag has no room for it.',
  deliver: 'The quartermaster fumbled it. Your points are back.',
};

const ODDS_COPY: Readonly<Record<OddsLabel, string>> = {
  certain: 'a formality',
  favoured: 'favoured',
  even: 'even money',
  unlikely: 'unlikely',
  outmatched: 'outmatched',
};

/** How long each beat of the reveal holds, in ms. Zero on reduced motion. */
const BEAT_COMPARE = 900;
const BEAT_ROUND = 700;

@Component({
  selector: 'app-pvp-arena',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pvp-arena.component.html',
  styleUrls: ['./pvp-arena.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PvpArenaComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly gateway = inject(ArenaGateway);
  private readonly arena = inject(ArenaService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly subs = new Subscription();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private tick: ReturnType<typeof setInterval> | null = null;

  readonly tiers = ARENA_TIERS;
  readonly shop = ARENA_SHOP;

  /**
   * The loadout a visitor with nothing has: rank 1, no kit, no points spent.
   *
   * This is what the server renders, and it is deliberately the real floor
   * rather than zeroes. `mightOf` gives a bare account a genuine number, so a
   * prerendered Bronze card can quote its genuine odds — a card that said "0%"
   * before hydration would be telling every crawler, and every visitor on a
   * slow connection, that the first ring is unwinnable.
   */
  private static readonly BARE: ArenaLoadout = { rank: 1, strike: 0, ward: 0, forgePower: 0 };

  record: ArenaSnapshot = this.arena.snapshot;
  loadout: ArenaLoadout = PvpArenaComponent.BARE;
  might = mightOf(PvpArenaComponent.BARE);
  guard = guardOf(PvpArenaComponent.BARE);

  /** Built at construction so the server renders the whole ring. */
  gates: GateCard[] = buildGates(PvpArenaComponent.BARE, emptyRecord());

  shopRows: ShopRow[] = ARENA_SHOP.map(stock => ({
    stock,
    owned: false,
    affordable: false,
    blocker: (stock.requiredWins > 0 ? 'wins' : 'points') as PurchaseReject,
  }));

  /** Milliseconds left on the lock. Ticked once a second while it is running. */
  cooldownMs = 0;

  // ── Fight screen state ─────────────────────────────────────────────────────
  stage: Stage = 'idle';
  bout: BoutResult | null = null;
  opponent: ArenaOpponent | null = null;
  /** How many rounds of the transcript are on screen. */
  revealed = 0;
  payoutGold = 0;
  payoutXp = 0;
  payoutPoints = 0;
  streakMultiplier = 1;
  unlockedTier: ArenaTier | null = null;
  /** The one-sentence verdict, read out by the live region. */
  announcement = '';
  message = '';
  fighting = false;

  t(key: string): string { return this.i18n.translate(key); }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.gateway.init();
    this.subs.add(this.arena.snapshot$.subscribe(snapshot => {
      this.record = snapshot;
      this.refresh();
      this.cdr.markForCheck();
    }));
    this.refresh();
    this.startClock();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.clearTimers();
    if (this.tick !== null) clearInterval(this.tick);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.stage !== 'idle') this.closeFight();
  }

  // ── Derived reads ──────────────────────────────────────────────────────────

  get ready(): boolean { return this.cooldownMs <= 0; }

  get cooldownLabel(): string { return formatCooldown(this.cooldownMs); }

  oddsCopy(label: OddsLabel): string { return ODDS_COPY[label]; }

  oddsPercent(odds: number): number { return Math.round(odds * 100); }

  gateFor(id: ArenaTierId): GateCard | undefined {
    return this.gates.find(gate => gate.tier.id === id);
  }

  trackTier = (_: number, gate: GateCard) => gate.tier.id;
  trackStock = (_: number, row: ShopRow) => row.stock.id;
  trackRound = (_: number, round: { index: number }) => round.index;
  trackName = (_: number, row: ChallengerRow) => row.npc.id;

  // ── The press ──────────────────────────────────────────────────────────────

  /**
   * Take a bout in `gate`, against `pick` if one was named.
   *
   * Naming a challenger is the point of the roster list being clickable: a
   * random draw from five names means three of Bronze's five are unwinnable to
   * a bare account, and a player who has just been told the odds against each
   * of them should be allowed to act on it. `Enter the ring` still draws at
   * random, for anyone who would rather not choose.
   */
  enter(gate: GateCard, pick?: ArenaOpponent): void {
    if (!this.isBrowser || this.fighting) return;

    const blocker = this.gateway.blocker(gate.tier.id);
    if (blocker) {
      this.message = REJECT_COPY[blocker];
      this.announcement = this.message;
      this.cdr.markForCheck();
      return;
    }

    this.fighting = true;
    this.message = '';
    this.clearTimers();

    // Settled first, shown second — see the header for why the transcript
    // cannot be generated a round at a time by the animation.
    const outcome = this.gateway.fight(
      gate.tier.id,
      `bout:${gate.tier.id}:${Date.now()}`,
      pick?.id,
    );
    if (!outcome.ok) {
      this.fighting = false;
      this.message = REJECT_COPY[outcome.code];
      this.announcement = this.message;
      this.cdr.markForCheck();
      return;
    }

    const result = outcome.settlement.result;
    this.bout = result;
    this.opponent = gate.roster.find(row => row.npc.id === result.opponentId)?.npc ?? null;
    this.payoutGold = outcome.goldCredited;
    this.payoutXp = outcome.payout.xp;
    this.payoutPoints = outcome.payout.points;
    this.streakMultiplier = outcome.payout.streakMultiplier;
    this.unlockedTier = outcome.settlement.unlockedTier
      ? arenaTier(outcome.settlement.unlockedTier) ?? null
      : null;
    this.revealed = 0;
    this.stage = 'compare';
    this.announcement = `Bout begun against ${this.opponent?.name ?? 'a challenger'}.`;
    this.cdr.markForCheck();

    this.playReveal(result);
  }

  /**
   * Walk the transcript out one beat at a time.
   *
   * Under `prefers-reduced-motion` every delay is zero, so the whole thing
   * lands on the same tick and the player gets the verdict immediately — a
   * static end state rather than no feedback, which is the site's hard rule.
   */
  private playReveal(result: BoutResult): void {
    const reduced = this.prefersReducedMotion();
    const compare = reduced ? 0 : BEAT_COMPARE;
    const beat = reduced ? 0 : BEAT_ROUND;

    this.after(compare, () => {
      this.stage = 'rounds';
      this.cdr.markForCheck();
    });

    result.rounds.forEach((_, index) => {
      this.after(compare + beat * (index + 1), () => {
        this.revealed = index + 1;
        this.cdr.markForCheck();
      });
    });

    this.after(compare + beat * (result.rounds.length + 1), () => {
      this.stage = 'verdict';
      this.fighting = false;
      this.announcement = this.verdictSentence(result);
      this.cdr.markForCheck();
    });
  }

  private verdictSentence(result: BoutResult): string {
    const who = this.opponent?.name ?? 'the challenger';
    const lost = result.rounds.length - result.roundsWon;
    // "1 rounds to 2" is the kind of thing only a screen reader has to sit
    // through in full, which is exactly why it is worth spelling correctly.
    const score = `${result.roundsWon} ${result.roundsWon === 1 ? 'round' : 'rounds'} to ${lost}`;
    if (!result.won) {
      return `Lost to ${who}, ${score}. Nothing taken. The gate reopens in five minutes.`;
    }
    const parts = [
      `Beat ${who}, ${score}.`,
      `${this.payoutGold.toLocaleString('en-US')} Gold,`,
      `${this.payoutXp.toLocaleString('en-US')} XP,`,
      `${this.payoutPoints} arena points.`,
    ];
    if (this.unlockedTier) parts.push(`The ${this.unlockedTier.name} is open.`);
    return parts.join(' ');
  }

  closeFight(): void {
    this.clearTimers();
    this.stage = 'idle';
    this.bout = null;
    this.opponent = null;
    this.revealed = 0;
    this.fighting = false;
    this.cdr.markForCheck();
  }

  // ── The shop ───────────────────────────────────────────────────────────────

  buy(row: ShopRow): void {
    if (!this.isBrowser) return;
    const result = this.gateway.buy(row.stock.id, `arena-buy:${row.stock.id}:${Date.now()}`);
    if (!result.ok) {
      this.message = PURCHASE_COPY[result.code];
    } else if (result.item) {
      this.message = `${result.item.name} is in your bag.`;
    } else {
      this.message = `${row.stock.name} paid out.`;
    }
    this.announcement = this.message;
    this.refresh();
    this.cdr.markForCheck();
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private refresh(): void {
    if (!this.isBrowser) return;

    const card = this.gateway.playerCard();
    this.loadout = card.loadout;
    this.might = card.might;
    this.guard = card.guard;
    this.cooldownMs = this.arena.cooldown();

    this.gates = buildGates(card.loadout, this.record);

    this.shopRows = ARENA_SHOP.map(stock => ({
      stock,
      owned: !!stock.once && this.record.purchases.includes(stock.id),
      affordable: this.record.points >= stock.cost,
      blocker: this.gateway.purchaseBlocker(stock.id),
    }));
  }

  /**
   * Tick the lock once a second, and only while it is running.
   *
   * Stopped the moment it reaches zero rather than left running: an interval
   * that survives for the whole visit to update a number that says "ready" is
   * a wakeup a second on a page a player leaves open, which is the shape of
   * background cost this site's performance budget exists to refuse.
   */
  private startClock(): void {
    if (this.tick !== null) clearInterval(this.tick);
    this.tick = setInterval(() => {
      const left = this.arena.cooldown();
      const wasRunning = this.cooldownMs > 0;
      this.cooldownMs = left;
      if (left <= 0 && this.tick !== null && !wasRunning) {
        clearInterval(this.tick);
        this.tick = null;
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  private after(delay: number, run: () => void): void {
    this.timers.push(setTimeout(run, delay));
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.length = 0;
  }

  private prefersReducedMotion(): boolean {
    if (!this.isBrowser || typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
}

/**
 * The five gate cards for one loadout against one record.
 *
 * Pure, and outside the class, so the same code builds the server's bare-account
 * ring and the browser's real one. A second copy of this that only ran in the
 * browser is how the prerendered page and the hydrated page start disagreeing.
 */
function buildGates(loadout: ArenaLoadout, record: ArenaSnapshot): GateCard[] {
  return ARENA_TIERS.map(tier => {
    const roster = opponentsForTier(tier.id).map(npc => {
      const odds = boutOdds(loadout, npc);
      return { npc, odds, oddsLabel: oddsLabel(odds) };
    });
    // The easiest name in the ring — see the note on GateCard.odds.
    const easiest = roster.reduce((a, b) => (b.odds > a.odds ? b : a), roster[0]);
    const odds = easiest ? easiest.odds : 0;
    const index = ARENA_TIER_ORDER.indexOf(tier.id);
    const below = index > 0 ? (record.tierWins[ARENA_TIER_ORDER[index - 1]] ?? 0) : 0;
    return {
      tier,
      unlocked: record.unlocked[tier.id] ?? tier.unlockWins === 0,
      wins: record.tierWins[tier.id] ?? 0,
      toUnlock: Math.max(0, tier.unlockWins - below),
      odds,
      oddsLabel: oddsLabel(odds),
      roster,
    };
  });
}

/** The record a visitor who has never fought holds. What the server renders. */
function emptyRecord(): ArenaSnapshot {
  const unlocked = {} as Record<ArenaTierId, boolean>;
  for (const tier of ARENA_TIER_ORDER) unlocked[tier] = tier === ARENA_TIER_ORDER[0];
  return {
    points: 0, lifetimePoints: 0, wins: 0, losses: 0, winRate: 0,
    streak: 0, bestStreak: 0, rank: arenaRankFor(0), tierWins: {},
    unlocked, lastBoutAt: 0, purchases: [],
  };
}

/** Re-exported for the template so it can name Might/Guard without an import. */
export { mightOf, guardOf };
