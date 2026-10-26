/**
 * enchanting.gateway.ts — the Enchanting Table's writes: setting a rune and brewing a potion (infusion).
 *
 *   socket → inventory (one write: the rune's consume op and the item's new wells; InventoryService.socketRune)
 *   brew   → inventory (materials) + infusion ledger (start the timer)
 *
 * Runes never come out (canon §6.2), so there is no unsocket.
 *
 * BREW: consume the materials, then start the timer. `blocker` checks the timer side first, where nothing has been
 * spent yet.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import type { GameItem } from '../rpg/item.model';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { runeById } from '../rune-forge/rune.model';
import { firstEmptyWell, isSocketable } from './socket.model';
import { SocketingService } from './socketing.service';
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
  private readonly socketing = inject(SocketingService);

  init(): void {
    if (!this.isBrowser) return;
    this.inventory.init();
    this.runes.init();
    this.economy.init();
    this.infusions.init();
  }

  // ── Sockets ────────────────────────────────────────────────────────────────

  /**
   * Set one rune into the item's next empty well (runes never come out: canon §6.2). The table's button path; the
   * drag path is SocketingService.drop. Both are InventoryService.socketRune: one write.
   */
  socket(itemId: string, runeId: string): SocketResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();
    const item = this.inventory.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (!isSocketable(item)) return { ok: false, code: 'not-socketable' };
    const rune = runeById(runeId);
    if (!rune) return { ok: false, code: 'unknown-rune' };
    if (firstEmptyWell(item) < 0) return { ok: false, code: 'occupied' };
    if (this.runes.countOf(runeId) < 1) return { ok: false, code: 'no-rune' };
    const before = matchSocketWord(item);
    const done = this.socketing.set(itemId, rune);
    if (done.code !== 'ok' || !done.item) return { ok: false, code: done.code === 'no-rune' ? 'no-rune' : done.code === 'missing' ? 'missing' : 'persist' };
    const after = matchSocketWord(done.item);
    return { ok: true, item: done.item, word: after, discovered: !!after && after.id !== before?.id, goldSpent: 0 };
  }

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
