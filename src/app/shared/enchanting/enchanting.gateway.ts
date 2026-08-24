/**
 * enchanting.gateway.ts — the sole writer of a socket, an unsocket and a brew.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A GATEWAY
 * ─────────────────────────────────────────────────────────────────────────────
 * Same rule the crafting bench follows: a feature may only write through an
 * owning service or a documented gateway, and every one of these three actions
 * touches ledgers that nobody owns together.
 *
 *   socket   → rune ledger (spend)      + inventory (rewrite the wells)
 *   unsocket → economy (Gold)           + inventory + rune ledger (return)
 *   brew     → inventory (materials)    + infusion ledger (start the timer)
 *
 * The component holds no write of its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER, AND WHY IT IS THIS ORDER
 * ─────────────────────────────────────────────────────────────────────────────
 * Every one of the three takes the *reversible* half first and the irreversible
 * half second, so that the failure the player can actually hit leaves them with
 * their property rather than with a receipt.
 *
 * SOCKET: spend the rune, then write the wells. A rune ledger write that
 * succeeds and an inventory write that fails would eat the rune, so the
 * inventory failure path returns it — `returnRune` is the exact inverse of
 * `spendRune` and neither touches first-found dates.
 *
 * UNSOCKET: write the wells, then return the rune, then take the Gold. Gold
 * last for the reason the bench gives: affordability is checked in the
 * pre-flight and taken in the same synchronous tick with no await between, so
 * nothing can spend it in between, and in the impossible case that the debit
 * still fails the player keeps their rune. A free unsocket is a strictly better
 * bug than a charged player whose rune is still in the sword.
 *
 * BREW: consume the materials, then start the timer. Reversed, a timer that
 * started and materials that failed to consume would be a free infusion on
 * every retry. If the timer refuses after the materials are gone the gateway
 * says so and the materials are lost — which is why `blocker` checks the timer
 * side *first*, in the pre-flight, where nothing has been spent yet.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import {
  isSocketable,
  socketCountFor,
  socketsOf,
  unsocketCost,
} from './socket.model';
import { matchSocketWord, type SocketWord } from './socket-words';
import { InfusionService } from './infusion.service';
import { infusionById, type Infusion } from './infusion.model';

export type SocketReject =
  | 'ssr'
  | 'missing'          // no such item
  | 'not-socketable'   // a charm, a loose rune, a crafted Runeword
  | 'bad-well'         // well index outside the item's socket count
  | 'occupied'         // something is already in that well
  | 'empty'            // nothing in that well to pull
  | 'unknown-rune'
  | 'no-rune'          // the drawer is short
  | 'funds'
  | 'persist';

export interface SocketSuccess {
  ok: true;
  item: GameItem;
  /** The word seated by this change, if one now is. */
  word: SocketWord | null;
  /** True when this change is what seated it — the discovery beat. */
  discovered: boolean;
  /** Gold taken. Zero on a socket. */
  goldSpent: number;
}

export type SocketResult = SocketSuccess | { ok: false; code: SocketReject };

export type BrewReject =
  | 'ssr'
  | 'unknown-infusion'
  | 'running'
  | 'slots'
  | 'materials'
  | 'persist';

export interface BrewSuccess {
  ok: true;
  infusion: Infusion;
  expiresAt: number;
  replayed: boolean;
}

export type BrewResult = BrewSuccess | { ok: false; code: BrewReject };

@Injectable({ providedIn: 'root' })
export class EnchantingGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly runes = inject(RuneForgeService);
  private readonly economy = inject(EconomyService);
  private readonly infusions = inject(InfusionService);

  init(): void {
    if (!this.isBrowser) return;
    this.inventory.init();
    this.runes.init();
    this.economy.init();
    this.infusions.init();
  }

  // ── Sockets ────────────────────────────────────────────────────────────────

  /**
   * Set one rune into one well.
   *
   * The rune leaves the drawer and lives in the item until it is pulled. It is
   * not destroyed — `unsocket` gives it back — so a player who sets a Mythic
   * into the wrong sword has an expensive mistake rather than a permanent one.
   */
  socket(itemId: string, well: number, runeId: string): SocketResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const item = this.inventory.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (!isSocketable(item)) return { ok: false, code: 'not-socketable' };
    if (!Number.isInteger(well) || well < 0 || well >= socketCountFor(item)) {
      return { ok: false, code: 'bad-well' };
    }
    if (!runeById(runeId)) return { ok: false, code: 'unknown-rune' };

    const wells = socketsOf(item);
    if (wells[well] !== null) return { ok: false, code: 'occupied' };
    if (this.runes.countOf(runeId) < 1) return { ok: false, code: 'no-rune' };

    const before = matchSocketWord(item);
    if (!this.runes.spendRune(runeId)) return { ok: false, code: 'no-rune' };

    wells[well] = runeId;
    const written = this.inventory.setSockets(itemId, wells);
    if (!written.ok) {
      // The one rollback that matters: the drawer has already given the rune
      // up. Putting it back is exact — `returnRune` adds one to the count and
      // touches nothing else.
      this.runes.returnRune(runeId);
      return { ok: false, code: written.code === 'missing' ? 'missing' : 'persist' };
    }

    const after = matchSocketWord(written.item);
    return {
      ok: true,
      item: written.item,
      word: after,
      discovered: !!after && after.id !== before?.id,
      goldSpent: 0,
    };
  }

  /** Gold to pull whatever is in that well. Zero when the well is empty. */
  unsocketPrice(item: GameItem, well: number): number {
    const runeId = socketsOf(item)[well];
    return runeId ? unsocketCost(runeId) : 0;
  }

  /**
   * Pull one rune back out. Costs Gold; the rune returns to the drawer.
   *
   * Any Socket Word the item was carrying stops paying the moment the well
   * empties, which is the whole tension of the feature: a word is not a thing
   * you own, it is a thing your gear is currently spelling.
   */
  unsocket(itemId: string, well: number): SocketResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const item = this.inventory.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (!isSocketable(item)) return { ok: false, code: 'not-socketable' };
    if (!Number.isInteger(well) || well < 0 || well >= socketCountFor(item)) {
      return { ok: false, code: 'bad-well' };
    }

    const wells = socketsOf(item);
    const runeId = wells[well];
    if (!runeId) return { ok: false, code: 'empty' };

    const cost = unsocketCost(runeId);
    if (this.economy.snapshot.gold < cost) return { ok: false, code: 'funds' };

    wells[well] = null;
    const written = this.inventory.setSockets(itemId, wells);
    if (!written.ok) {
      return { ok: false, code: written.code === 'missing' ? 'missing' : 'persist' };
    }
    this.runes.returnRune(runeId);
    // Last, and in the same tick as the check above — see the header.
    const paid = cost === 0 || this.economy.spendGold(cost, 'unsocket');

    return {
      ok: true,
      item: written.item,
      word: matchSocketWord(written.item),
      discovered: false,
      goldSpent: paid ? cost : 0,
    };
  }

  // ── Infusions ──────────────────────────────────────────────────────────────

  /** What this infusion is still short of, for the card's material row. */
  missing(id: string): { id: string; need: number; have: number }[] {
    const def = infusionById(id);
    if (!def) return [];
    return this.inventory.missingInputs(
      def.inputs.map(row => ({ id: row.materialId, count: row.count })),
    );
  }

  /**
   * Everything that would stop this brew, in the order the bench reports it.
   * Null when the table is ready.
   *
   * Timer reasons come before material reasons deliberately: "you already have
   * this running" is the more useful thing to read, and it is the check that
   * has to happen before anything is spent.
   */
  brewBlocker(id: string, now = Date.now()): BrewReject | null {
    if (!this.isBrowser) return 'ssr';
    this.init();
    const timer = this.infusions.blocker(id, now);
    if (timer === 'unknown') return 'unknown-infusion';
    if (timer) return timer;
    if (this.missing(id).length) return 'materials';
    return null;
  }

  /**
   * Burn the materials, start the timer.
   *
   * `mutationId` makes the material half replay-safe, so a double-click or a
   * retry after a dropped response burns exactly one set. The timer half is
   * idempotent on its own: `start` refuses an infusion that is already running,
   * which is exactly what a replay looks like from its side.
   */
  brew(id: string, mutationId: string, now = Date.now()): BrewResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const def = infusionById(id);
    if (!def) return { ok: false, code: 'unknown-infusion' };

    const blocked = this.brewBlocker(id, now);
    if (blocked) {
      // A replay lands here as `running`, because the first call started the
      // timer. Report it as the success it was rather than as a refusal — the
      // materials are gone and the infusion is live, which is what was asked
      // for.
      if (blocked === 'running') {
        const remaining = this.infusions.remaining(id, now);
        if (remaining > 0) {
          return { ok: true, infusion: def, expiresAt: now + remaining, replayed: true };
        }
      }
      return { ok: false, code: blocked };
    }

    const taken = this.inventory.consumeStacks(
      mutationId,
      def.inputs.map(row => ({ id: row.materialId, count: row.count })),
    );
    if (!taken.ok) {
      return { ok: false, code: taken.code === 'missing' ? 'materials' : 'persist' };
    }

    const started = this.infusions.start(id, now);
    if (!started) {
      // Only reachable if the ledger changed between the pre-flight and here,
      // which one synchronous tick does not allow. Reported rather than
      // swallowed so a future async step cannot make it silent.
      return { ok: false, code: 'persist' };
    }
    return { ok: true, infusion: def, expiresAt: started.expiresAt, replayed: taken.replayed };
  }
}
