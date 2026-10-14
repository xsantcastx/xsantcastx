/**
 * <app-slate-counter who="croupier|kael"> — the Mirror Slate where it changes
 * hands, a compact strip at the top of the keeper's own panel (the play view
 * puts it there; the stations themselves are untouched).
 *
 *  - Lune Coyne (her counter and her four tables), while the Keeper holds no
 *    Slate: how many plays are left before she hands it over, and ONE small
 *    button to buy it instead.
 *  - Kael (the Rune Forge), while the Keeper holds a tier I Slate: what the
 *    second face needs (chips, have / need), and ONE button to bind it.
 *
 * The button is never disabled: a press while short says why (the station
 * kit's rule). Once the thing is done the strip says so once, then stays out
 * of the way.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { Subscription, merge } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { PlayLedgerService } from '../games/play-ledger.service';
import { materialDisplay } from '../rpg/material-catalog';
import { CostChipComponent } from '../station-ui/cost-chip.component';
import { STATION_UI_I18N } from '../station-ui/station-ui.i18n';
import type { StationCost } from '../station-ui/station-ui.model';
import { SLATE_I18N } from './slate.i18n';
import { SlateService } from './slate.service';
import { slateUpgradeReady, type SlateOffer } from './slate.model';

@Component({
  selector: 'app-slate-counter',
  standalone: true,
  imports: [CostChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown) {
      <section class="sc" [attr.data-slate-counter]="who()" [attr.aria-label]="t(who() === 'kael' ? 'slate.kael.title' : 'slate.offer.title')">
        <i class="sc__pane" [class.sc__pane--ii]="who() === 'kael'" aria-hidden="true"></i>
        <div class="sc__body">
          @if (who() === 'croupier' && offer.tier === 0) {
            <p class="sc__line">{{ t('slate.offer.line', { n: offer.toGo }) }}</p>
            <p class="sc__what">{{ t('slate.offer.what') }}</p>
          } @else if (who() === 'kael' && tier === 1) {
            <p class="sc__line">{{ t('slate.kael.line') }}</p>
            <p class="sc__what">{{ t('slate.kael.gives') }}</p>
            <div class="sc__chips">
              @for (cost of kaelCosts; track cost.id) { <app-cost-chip [cost]="cost" [nudge]="nudge" /> }
            </div>
          }
          @if (notice) { <p class="sc__notice" role="status">{{ notice }}</p> }
        </div>
        @if (who() === 'croupier' && offer.tier === 0) {
          <button type="button" class="sc__btn" [attr.aria-disabled]="offer.affordable ? null : 'true'" (click)="buy()">{{ t('slate.offer.buy', { cost: price }) }}</button>
        } @else if (who() === 'kael' && tier === 1) {
          <button type="button" class="sc__btn sc__btn--primary" [attr.aria-disabled]="ready ? null : 'true'" (click)="bind()">{{ t('slate.kael.bind') }}</button>
        }
      </section>
    }
  `,
  styleUrls: ['./slate-counter.component.css'],
})
export class SlateCounterComponent implements OnInit, OnDestroy {
  /** Whose counter: Lune Coyne's (earn / buy) or Kael's (bind tier II). */
  readonly who = input<'croupier' | 'kael'>('croupier');

  private readonly slate = inject(SlateService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly ledger = inject(PlayLedgerService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  /** One press id per strip: a retry of the same press is a replay, never a second Slate. */
  private readonly pressId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  offer: SlateOffer = { tier: 0, played: 0, toGo: 0, price: 0, affordable: false };
  tier = 0;
  price = '';
  kaelCosts: StationCost[] = [];
  /** Every input Kael asks for is in hand. */
  ready = false;
  /** Bumped on a short press: the chips shake. */
  nudge = 0;
  notice = '';

  constructor() {
    this.i18n.register(STATION_UI_I18N);
    this.i18n.register(SLATE_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  get shown(): boolean {
    if (this.notice) return true;
    return this.who() === 'kael' ? this.tier === 1 : this.offer.tier === 0;
  }

  ngOnInit(): void {
    this.slate.init();
    this.subs.add(merge(this.economy.snapshot$, this.inventory.snapshot$, this.ledger.changed$).subscribe(() => this.read()));
    this.subs.add(this.slate.awarded$.subscribe(() => { this.notice = this.t('slate.awarded'); this.read(); }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private read(): void {
    this.offer = this.slate.offer();
    this.tier = this.offer.tier;
    this.price = this.offer.price.toLocaleString('en-US');
    this.kaelCosts = this.slate.needs().map(row => {
      const display = materialDisplay(row.id);
      return { kind: 'material' as const, id: row.id, label: display?.name ?? row.id, need: row.need, have: row.have, art: display ? { src: display.art, srcset: display.srcset } : null };
    });
    this.ready = slateUpgradeReady(stackKey => this.inventory.stackOf(stackKey));
    this.cdr.markForCheck();
  }

  buy(): void {
    if (!this.offer.affordable) {
      this.notice = this.t('slate.offer.funds');
      this.cdr.markForCheck();
      return;
    }
    const code = this.slate.buy(this.pressId);
    this.notice = code === 'ok' || code === 'replayed' || code === 'owned' ? this.t('slate.offer.bought')
      : code === 'funds' ? this.t('slate.offer.funds') : this.t('slate.offer.failed');
    this.read();
  }

  bind(): void {
    if (!this.ready) {
      this.nudge++;
      this.notice = this.t('slate.kael.short');
      this.cdr.markForCheck();
      return;
    }
    const code = this.slate.upgrade();
    this.notice = code === 'ok' || code === 'replayed' || code === 'done' ? this.t('slate.kael.done')
      : code === 'missing' ? this.t('slate.kael.short') : this.t('slate.kael.failed');
    this.read();
  }
}
