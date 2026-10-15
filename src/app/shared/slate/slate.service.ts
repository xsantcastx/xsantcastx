/**
 * SlateService — who holds the Mirror Slate, and the three ways it changes hands
 * (docs/handoff/mirror-slate.md). Every write goes through a gateway that
 * already owns the thing:
 *
 *  - award   Lune Coyne hands it over once ten plays are on the games ledger
 *            across her four tables: InventoryService.grantStack under the one
 *            fixed id `slate:award`, so it can only ever happen once (a replay,
 *            a reload or a cloud merge of the same op is a no-op). Checked on
 *            every ledger change while the play view is up.
 *  - buy     the shortcut: the pane is granted under `slate:buy:<press id>`,
 *            then the Gold is spent in the same tick (the crafting gateway's
 *            order: a crash in between is a free Slate, never a charged
 *            player). A retry of the same press is a replay; a Keeper who holds
 *            one is refused.
 *  - upgrade Kael's binding: InventoryService.craftStack consumes the tier I
 *            pane and the Delve materials and grants the tier II pane in ONE
 *            ledger write, keyed `slate:tier2`.
 *
 * The tier is read off the satchel (slateTier), so there is no Slate blob.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';

import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import { PlayLedgerService } from '../games/play-ledger.service';
import { MIRROR_SLATE } from '../economy/economy-curve';
import { MIRROR_SLATE_ID, MIRROR_SLATE_II_ID, SLATE_UPGRADE_INPUTS } from './slate-items.model';
import {
  SlateNeed, SlateOffer, SlateTier, slateAwardDue, slateOffer, slateTier, slateUpgradeNeeds, tablesPlayed,
} from './slate.model';

/** The one grant id Lune's gift ever uses. */
export const SLATE_AWARD_ID = 'slate:award';
/** The one craft id Kael's binding ever uses. */
export const SLATE_UPGRADE_ID = 'slate:tier2';

/** The phone apps the play view opens for the Slate (they are places of their own). */
export type SlateLaunch = 'pets' | 'codex';

export type SlateBuyCode = 'ok' | 'replayed' | 'owned' | 'funds' | 'failed' | 'ssr';
export type SlateUpgradeCode = 'ok' | 'replayed' | 'no-slate' | 'done' | 'missing' | 'failed' | 'ssr';

@Injectable({ providedIn: 'root' })
export class SlateService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly awarded$$ = new Subject<void>();
  /** Fires the moment Lune hands the Slate over (the play view says so). */
  readonly awarded$: Observable<void> = this.awarded$$.asObservable();
  private readonly launch$$ = new Subject<SlateLaunch>();
  /**
   * The phone face's app icons that live outside the glass (the Pets well, the
   * Codex): the Slate asks, the play view folds it and opens the place.
   */
  readonly launch$: Observable<SlateLaunch> = this.launch$$.asObservable();
  launch(app: SlateLaunch): void { this.launch$$.next(app); }
  private watching = false;

  /** Start watching the tables (idempotent). The play view calls it once. */
  init(): void {
    if (!this.browser || this.watching) return;
    this.watching = true;
    this.inventory.init();
    this.ledger.init();
    this.ledger.changed$.subscribe(() => this.checkAward());
  }

  private readonly qty = (stackKey: string): number => this.inventory.stackOf(stackKey);

  tier(): SlateTier { return slateTier(this.qty); }

  /** Plays at Lune's four tables, on any device the ledger has merged in. */
  played(): number { return tablesPlayed(game => this.ledger.totals(game).plays); }

  offer(): SlateOffer { return slateOffer(this.tier(), this.played(), this.economy.snapshot.gold); }

  needs(): SlateNeed[] { return slateUpgradeNeeds(this.qty); }

  /** Lune's gift, once, when it is due. True when it was handed over just now. */
  checkAward(): boolean {
    if (!this.browser) return false;
    if (!slateAwardDue(this.tier(), this.played())) return false;
    // Handed over once ever: a Keeper who already had the gift and let the pane go buys the next one.
    if (this.inventory.hasStackOp(SLATE_AWARD_ID)) return false;
    if (!this.inventory.grantStack(SLATE_AWARD_ID, MIRROR_SLATE_ID, 1)) return false;
    this.awarded$$.next();
    return true;
  }

  /** Buy the Slate from Lune. `pressId` names the press: a retry of the same press is a replay. */
  buy(pressId: string): SlateBuyCode {
    if (!this.browser) return 'ssr';
    const grantId = `slate:buy:${pressId}`;
    if (this.inventory.hasStackOp(grantId)) return 'replayed';
    if (this.tier() > 0) return 'owned';
    const price = MIRROR_SLATE.price;
    if (this.economy.snapshot.gold < price) return 'funds';
    if (!this.inventory.grantStack(grantId, MIRROR_SLATE_ID, 1)) return 'failed';
    if (!this.economy.spendGold(price, grantId)) {
      // Unreachable (affordability was checked this tick): take the pane back rather than give it away.
      this.inventory.consumeStacks(`${grantId}:undo`, [{ id: MIRROR_SLATE_ID, count: 1 }]);
      return 'failed';
    }
    return 'ok';
  }

  /** Kael binds tier II. Replay-safe on its one id. */
  upgrade(): SlateUpgradeCode {
    if (!this.browser) return 'ssr';
    if (this.inventory.stackCraftedFor(SLATE_UPGRADE_ID)) return 'replayed';
    const tier = this.tier();
    if (tier >= 2) return 'done';
    if (tier < 1) return 'no-slate';
    const res = this.inventory.craftStack(SLATE_UPGRADE_ID, SLATE_UPGRADE_INPUTS, MIRROR_SLATE_II_ID, 1);
    if (res.ok) return res.replayed ? 'replayed' : 'ok';
    return res.code === 'missing' ? 'missing' : 'failed';
  }
}
