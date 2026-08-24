/**
 * arena.gateway.ts — the sole writer of a bout and of an arena purchase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A GATEWAY AND NOT A METHOD ON THE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * One bout touches four ledgers that nobody owns together: the arena records
 * the result and mints points, the economy credits Gold, the XP ladder takes
 * the award, and the loadout is read off worn kit and allocated stats. The
 * architecture rule is that a feature may only write through an owning service
 * or a documented gateway; this is the documented gateway, and the ring
 * component holds no write of its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER, AND WHY IT IS THIS ORDER
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. refuse on anything knowable up front — SSR, unknown tier, locked gate,
 *      cooldown still running
 *   2. read the loadout and resolve the bout — pure, no writes
 *   3. `ArenaService.settle` — the record, the streak, the points, the lock
 *   4. `EconomyService.earnGold` and `XpService.award` — the win's payout
 *
 * Step 3 is before step 4 because step 3 is the one that must not be repeatable.
 * It carries the bout id and refuses a replay; Gold and XP are credited only on
 * the settlement that actually moved, so a double-press pays once. If the order
 * were reversed a replayed press would pay Gold before the arena refused it.
 *
 * Steps 4's two calls cannot fail the bout and are not checked: a win that
 * banked its record and missed its XP is a visible, fixable annoyance; a win
 * the arena refused to record is a lost result.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A PURCHASE DEBITS FIRST AND A CRAFT DEBITS LAST
 * ─────────────────────────────────────────────────────────────────────────────
 * The bench takes Gold *after* the item exists because its inputs — materials —
 * are already consumed by then and there is nothing to refund them with. An
 * arena purchase has no consumed input: the only thing at stake is the points,
 * so it debits first and refunds on a failed delivery, which is the Gambler's
 * order and the right one when a refund is actually possible.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { InventoryService } from '../rpg/inventory.service';
import { mintEquipment } from '../rpg/item-definition';
import type { GameItem } from '../rpg/item.model';
import { PlayerStatsService } from '../rpg/player-stats.service';
import { ArenaService, type ArenaSettlement } from './arena.service';
import {
  type ArenaLoadout,
  type ArenaPayout,
  type ArenaStock,
  type ArenaTierId,
  arenaOpponentById,
  arenaStockById,
  arenaTier,
  guardOf,
  mightOf,
  opponentsForTier,
  payoutFor,
  resolveBout,
} from './arena.model';

export type BoutReject =
  | 'ssr'
  | 'unknown-tier'
  | 'unknown-opponent'
  | 'locked'
  | 'cooldown';

export interface BoutSuccess {
  ok: true;
  settlement: ArenaSettlement;
  payout: ArenaPayout;
  /** Gold actually credited, after the economy's global multiplier. */
  goldCredited: number;
}

export type FightResult = BoutSuccess | { ok: false; code: BoutReject };

export type PurchaseReject =
  | 'ssr'
  | 'unknown-stock'
  | 'wins'
  | 'owned'
  | 'points'
  | 'capacity'
  | 'deliver';

export interface PurchaseSuccess {
  ok: true;
  stock: ArenaStock;
  /** The minted piece, for an `equipment` row. Null for every other kind. */
  item: GameItem | null;
}

export type PurchaseResult = PurchaseSuccess | { ok: false; code: PurchaseReject };

@Injectable({ providedIn: 'root' })
export class ArenaGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly arena = inject(ArenaService);
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);
  private readonly inventory = inject(InventoryService);
  private readonly stats = inject(PlayerStatsService);

  private started = false;

  /**
   * Bring up the four services one bout touches, once per gateway.
   *
   * Guarded rather than left idempotent-by-convention: `blocker()` and
   * `purchaseBlocker()` both call this, and the ring page calls those once per
   * tier and once per shop row on every publish — eleven times a render. Even
   * with each service's own init being cheap, that is forty-four no-op calls a
   * frame, and it was one of the two halves of the render loop that crashed
   * the page. See `ArenaService.init` for the other half.
   */
  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    this.arena.init();
    this.economy.init();
    this.inventory.init();
    this.stats.init();
  }

  /**
   * What the player brings to the sand right now.
   *
   * Recomputed on every call rather than cached: a temper that lands between
   * two bouts has to be felt on the next one, and there is no cheaper way to
   * guarantee that than not remembering the old answer.
   */
  loadout(): ArenaLoadout {
    if (!this.isBrowser) return { rank: 1, strike: 0, ward: 0, forgePower: 0 };
    const totals = this.inventory.equippedTotals;
    return {
      rank: this.xp.snapshot.level.level,
      strike: totals.strikePower ?? 0,
      ward: totals.ward ?? 0,
      forgePower: this.stats.snapshot.stats.forgePower ?? 0,
    };
  }

  /** Might and Guard, for the comparison screen. */
  playerCard(): { might: number; guard: number; loadout: ArenaLoadout } {
    const loadout = this.loadout();
    return { might: mightOf(loadout), guard: guardOf(loadout), loadout };
  }

  /** Everything that would stop this bout, or null when the gate is open. */
  blocker(tier: ArenaTierId, now = Date.now()): BoutReject | null {
    if (!this.isBrowser) return 'ssr';
    this.init();
    if (!arenaTier(tier)) return 'unknown-tier';
    if (!this.arena.isUnlocked(tier)) return 'locked';
    if (!this.arena.ready(now)) return 'cooldown';
    return null;
  }

  /**
   * Fight one bout.
   *
   * `opponentId` is optional; without one an opponent is drawn from the tier's
   * five off the same `rng`, which keeps the draw seedable in a spec. The draw
   * is taken *before* `resolveBout` so the six combat rolls stay in the fixed
   * order the model documents.
   */
  fight(
    tier: ArenaTierId,
    mutationId: string,
    opponentId?: string,
    rng: () => number = Math.random,
    now = Date.now(),
  ): FightResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const def = arenaTier(tier);
    if (!def) return { ok: false, code: 'unknown-tier' };
    if (!this.arena.isUnlocked(tier)) return { ok: false, code: 'locked' };
    if (!this.arena.ready(now)) return { ok: false, code: 'cooldown' };

    const roster = opponentsForTier(tier);
    const opponent = opponentId
      ? arenaOpponentById(opponentId)
      : roster[Math.min(roster.length - 1, Math.floor(rng() * roster.length))];
    if (!opponent || opponent.tier !== tier) return { ok: false, code: 'unknown-opponent' };

    const streakBefore = this.arena.snapshot.streak;
    const result = resolveBout(this.loadout(), opponent, rng);
    const payout = payoutFor(def, result.won, streakBefore);

    const settlement = this.arena.settle(result, payout.points, mutationId, now);
    if (!settlement) return { ok: false, code: 'ssr' };

    // A replay banked nothing, so it pays nothing. Reported as a success with a
    // zero payout rather than as a rejection: the press did land the first time,
    // and telling the player it failed would be a lie about their own record.
    if (settlement.replayed) {
      return {
        ok: true,
        settlement,
        payout: { gold: 0, xp: 0, points: 0, streakMultiplier: 1 },
        goldCredited: 0,
      };
    }

    let goldCredited = 0;
    if (payout.gold > 0) goldCredited = this.economy.earnGold(payout.gold, `arena:${tier}`);
    if (payout.xp > 0) this.xp.award('game-win', { amount: payout.xp, energy: 'nox' });

    return { ok: true, settlement, payout, goldCredited };
  }

  /** Everything that would stop this purchase, or null when it can be paid. */
  purchaseBlocker(stockId: string): PurchaseReject | null {
    if (!this.isBrowser) return 'ssr';
    this.init();
    const stock = arenaStockById(stockId);
    if (!stock) return 'unknown-stock';
    if (this.arena.wins() < stock.requiredWins) return 'wins';
    if (stock.once && this.arena.owns(stockId)) return 'owned';
    if (this.arena.points() < stock.cost) return 'points';
    if (stock.kind === 'material' && stock.stackKey && !this.inventory.canAcceptStackGrant(stock.stackKey)) {
      return 'capacity';
    }
    return null;
  }

  /**
   * Buy one shop row.
   *
   * `mutationId` seeds the grant id for a material stack, which is how
   * `InventoryService.grantStack` makes a repeated press a no-op rather than a
   * second stack.
   */
  buy(stockId: string, mutationId: string, rng: () => number = Math.random): PurchaseResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const stock = arenaStockById(stockId);
    if (!stock) return { ok: false, code: 'unknown-stock' };

    const blocker = this.purchaseBlocker(stockId);
    if (blocker) return { ok: false, code: blocker };

    if (!this.arena.spendPoints(stock.cost, stockId)) return { ok: false, code: 'points' };

    const item = this.deliver(stock, mutationId, rng);
    if (item === false) {
      this.arena.refundPoints(stock.cost, stockId);
      return { ok: false, code: 'deliver' };
    }

    return { ok: true, stock, item };
  }

  /**
   * Hand over what a row sells. `false` means nothing was delivered and the
   * points have to go back; `null` means delivered, with no item to show.
   */
  private deliver(stock: ArenaStock, mutationId: string, rng: () => number): GameItem | null | false {
    switch (stock.kind) {
      case 'gold':
        // Credited through `earnGold` so the global multiplier and the Flame's
        // floater both apply — a purse that bypassed the mint would be the only
        // Gold in the game that arrives without the economy noticing.
        this.economy.earnGold(stock.amount ?? 0, 'arena:shop');
        return null;
      case 'essence':
        this.economy.earnEssence(stock.amount ?? 0, 'arena:shop');
        return null;
      case 'material': {
        if (!stock.stackKey) return false;
        const granted = this.inventory.grantStack(
          `arena:${stock.id}:${mutationId}`,
          stock.stackKey,
          stock.amount ?? 0,
        );
        return granted ? null : false;
      }
      case 'equipment': {
        if (!stock.definitionId || !stock.rarity) return false;
        const minted = mintEquipment(stock.definitionId, stock.rarity, rng);
        if (!minted) return false;
        return this.inventory.add(minted) ? minted : false;
      }
      default:
        return false;
    }
  }
}
