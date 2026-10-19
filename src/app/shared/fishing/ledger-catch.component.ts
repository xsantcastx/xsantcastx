/**
 * <app-ledger-catch> — the Lodge Warden's Ledger Catch (Skills Lodge,
 * Rootglass Canopy). For dummies: today's one fish, where it swims, and one
 * button to hand it in with what it pays. Spec: delve-and-beyond.md §5.5.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { artFor } from '../art/art';
import { FishingService, type LedgerView } from './fishing.service';
import { FISHING_I18N } from './fishing.i18n';
import { ledgerXp } from './fishing.model';

@Component({
  selector: 'app-ledger-catch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view; as v) {
      <section class="lc" aria-labelledby="lc-title">
        <div class="lc__head">
          @if (art(v.id); as a) { <img class="lc__art" [src]="a.src" alt="" width="40" height="40"> }
          <div>
            <span class="lc__kicker">{{ t('skills.lodge.kicker') }}</span>
            <h3 id="lc-title" class="lc__title">{{ t('skills.lodge.title') }}</h3>
          </div>
        </div>
        <p class="lc__line">"{{ t(v.turnIns >= 30 ? 'skills.lodge.line3' : v.done ? 'skills.lodge.line2' : 'skills.lodge.line1') }}"</p>
        <p class="lc__today">{{ t('skills.lodge.today', { name: v.name, water: t('skills.lodge.water.' + v.water) }) }}</p>
        <p class="lc__reward">{{ t('skills.lodge.reward') }} (+{{ xp(v) }} XP)</p>
        @if (v.done) {
          <p class="lc__done">{{ t('skills.lodge.done') }}</p>
        } @else {
          <button type="button" class="lc__go" [disabled]="!v.held" (click)="turnIn()">{{ t(v.held ? 'skills.lodge.turnIn' : 'skills.lodge.need') }}</button>
        }
        @if (paid) { <p class="lc__paid" role="status">{{ paid }}</p> }
        <p class="lc__count">{{ t('skills.lodge.count', { n: v.turnIns }) }}@if (v.next; as next) { · {{ t('skills.lodge.next', { name: next.name, n: next.at }) }} }</p>
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .lc { display: grid; gap: 6px; padding: 0.9rem; border: 1px solid var(--gf-edge-strong); border-radius: var(--gf-radius); background: var(--gf-panel); }
    .lc__head { display: flex; gap: 10px; align-items: center; }
    .lc__art { image-rendering: pixelated; }
    .lc__kicker { color: var(--gf-dim); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
    .lc__title { margin: 0; font: 700 1rem/1.2 var(--font-lore); color: var(--gf-ink); }
    .lc__line { margin: 0; font-style: italic; color: var(--gf-dim); font-size: 0.85rem; }
    .lc__today { margin: 0; color: var(--gf-ink); }
    .lc__reward, .lc__count { margin: 0; color: var(--gf-faint); font-size: 0.76rem; }
    .lc__done, .lc__paid { margin: 0; color: var(--gf-accent-text); }
    .lc__go {
      justify-self: start; min-height: 44px; padding: 0 16px; border: 1px solid var(--gf-accent); border-radius: var(--gf-radius-sm);
      background: none; color: var(--gf-accent-text); cursor: pointer;
      font: 700 11px/1 var(--font-game); letter-spacing: 0.1em; text-transform: uppercase;
    }
    .lc__go:disabled { opacity: .55; cursor: default; }
    .lc__go:focus-visible { outline: 2px solid var(--gf-accent-text); outline-offset: 2px; }
  `],
})
export class LedgerCatchComponent implements OnInit {
  private readonly fishing = inject(FishingService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  view: LedgerView | null = null;
  paid = '';

  constructor() { this.i18n.register(FISHING_I18N); }

  ngOnInit(): void {
    this.inventory.init();
    merge(this.inventory.snapshot$, this.fishing.save$).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.view = this.fishing.ledgerToday();
      this.cdr.markForCheck();
    });
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  art(id: string) { return artFor(id); }
  xp(v: LedgerView): number { return ledgerXp(v.water); }

  turnIn(): void {
    const result = this.fishing.turnIn();
    if (!result) return;
    this.paid = this.t('skills.lodge.paid', { gold: result.gold.toLocaleString('en-US'), xp: result.xp })
      + (result.gift ? ` ${this.t('skills.lodge.gift', { name: result.gift })}` : '');
    this.view = this.fishing.ledgerToday();
    this.cdr.markForCheck();
  }
}
