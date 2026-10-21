/**
 * hearth-shrine.component.ts — a capital's Hearth Shrine: the five Hearth Blessings, one plain button each with its
 * price (the station rule: dummy-simple; what they do sits behind the question mark).
 *
 * Bought through HearthService (Gold through the economy, the blessing through the save gateway, per character).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { HearthService } from './hearth.service';
import { COLD_HEARTH_I18N } from './cold-hearth.i18n';
import { BLESSINGS, HEARTH_GRACE_LEVEL, blessingPrice, fallCosts, type BlessingId } from './hearth-rules';
import type { HearthSave } from './hearth-save.model';

@Component({
  selector: 'app-hearth-shrine',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hs" data-hearth-shrine [attr.data-blessings]="s.blessings.length">
      <p class="hs__top">
        <span class="hs__held" data-shrine-held>{{ t('play.coldHearth.shrine.held', { n: s.blessings.length }) }}</span>
        <button type="button" class="px-help hs__help" [attr.aria-expanded]="help" [attr.aria-label]="t('play.coldHearth.shrine.help')" (click)="help = !help"><i aria-hidden="true">?</i></button>
      </p>
      @if (help) {
        <div class="hs__card" role="note">
          <p>{{ t('play.coldHearth.shrine.lead') }}</p>
          <p>{{ t('play.coldHearth.shrine.rule') }}</p>
        </div>
      }
      @if (grace) { <p class="hs__note" data-shrine-grace>{{ t('play.coldHearth.shrine.grace', { n: graceLevel }) }}</p> }
      <ul class="hs__list">
        @for (b of blessings; track b.id) {
          <li class="hs__row" [attr.data-blessing]="b.id" [class.hs__row--held]="s.blessings.includes(b.id)">
            <i class="hs__flame" [attr.data-realm]="b.realm" aria-hidden="true"></i>
            <span class="hs__body"><b>{{ t('play.coldHearth.bless.' + b.id + '.name') }}</b><small>{{ t('play.coldHearth.bless.' + b.id + '.blurb') }}</small></span>
            @if (s.blessings.includes(b.id)) {
              <span class="hs__kindled">{{ t('play.coldHearth.shrine.kindled') }}</span>
            } @else {
              <button type="button" class="hs__buy" [disabled]="grace || gold < price" (click)="buy(b.id)">{{ t('play.coldHearth.shrine.kindle', { n: price }) }}</button>
            }
          </li>
        }
      </ul>
      <p class="hs__note" role="status" aria-live="polite" data-shrine-said>{{ said }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hs { display: grid; gap: 8px; color: var(--adventure-parchment); text-shadow: 2px 2px 0 var(--obsidian-0); }
    .hs__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; min-height: 44px; }
    .hs__held { font: 600 12px var(--font-game); letter-spacing: .08em; text-transform: uppercase; color: var(--adventure-ember); }
    .hs__card { display: grid; gap: 6px; padding: 10px 12px; background: var(--obsidian-2); box-shadow: 0 -2px 0 0 var(--gold-deep), 0 2px 0 0 var(--gold-deep), -2px 0 0 0 var(--gold-deep), 2px 0 0 0 var(--gold-deep); }
    .hs__card p, .hs__note { margin: 0; font: italic 400 14px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .hs__note:empty { display: none; }
    .hs__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .hs__row {
      display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 10px; min-height: 52px; padding: 6px 10px;
      background: var(--obsidian-2); box-shadow: 0 -2px 0 0 var(--gold-deep), 0 2px 0 0 var(--gold-deep), -2px 0 0 0 var(--gold-deep), 2px 0 0 0 var(--gold-deep);
    }
    .hs__row--held { background: color-mix(in srgb, var(--adventure-hud-gold) 22%, var(--obsidian-2)); }
    .hs__body { display: grid; gap: 2px; min-width: 0; }
    .hs__body b { font: 700 13px var(--font-game); letter-spacing: .04em; }
    .hs__body small { font: 400 12px/1.3 system-ui, sans-serif; opacity: .85; }
    /* A stepped pixel flame: an ember base, a flame body, a bright tip (box-shadow pixels, never a gradient). */
    .hs__flame { width: 3px; height: 3px; margin: 0 auto; transform: translate(-9px, -10px); image-rendering: pixelated;
      box-shadow:
        3px 21px 0 var(--obsidian-0), 6px 21px 0 var(--obsidian-0), 9px 21px 0 var(--obsidian-0), 12px 21px 0 var(--obsidian-0), 15px 21px 0 var(--obsidian-0),
        3px 18px 0 var(--gold-deep), 6px 18px 0 var(--adventure-ember), 9px 18px 0 var(--adventure-ember), 12px 18px 0 var(--adventure-ember), 15px 18px 0 var(--gold-deep),
        6px 15px 0 var(--adventure-ember), 9px 15px 0 var(--adventure-hud-gold), 12px 15px 0 var(--adventure-ember),
        6px 12px 0 var(--adventure-ember), 9px 12px 0 var(--adventure-parchment), 12px 12px 0 var(--adventure-hud-gold),
        9px 9px 0 var(--adventure-hud-gold), 12px 6px 0 var(--adventure-ember), 9px 3px 0 var(--adventure-ember); }
    .hs__row:not(.hs__row--held) .hs__flame { opacity: .45; }
    .hs__buy {
      min-height: 44px; padding: 6px 12px; border: 0; border-radius: 0; cursor: pointer;
      background: color-mix(in srgb, var(--adventure-hud-gold) 30%, var(--obsidian-2)); color: var(--adventure-parchment);
      box-shadow: 0 -2px 0 0 var(--gold-bright), 0 2px 0 0 var(--gold-bright), -2px 0 0 0 var(--gold-bright), 2px 0 0 0 var(--gold-bright);
      font: 600 12px var(--font-game); letter-spacing: .04em; white-space: nowrap;
    }
    .hs__buy:disabled { opacity: .5; cursor: not-allowed; }
    .hs__buy:focus-visible, .hs__help:focus-visible { outline: 2px solid var(--adventure-hud-gold); outline-offset: 2px; }
    .hs__kindled { font: 600 12px var(--font-game); letter-spacing: .06em; text-transform: uppercase; color: var(--adventure-hud-gold); }
  `],
})
export class HearthShrineComponent implements OnDestroy {
  private readonly hearth = inject(HearthService);
  private readonly economy = inject(EconomyService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  /** The Keeper's level: it sets the price (one minute of a hunt at this level, each). */
  @Input() level = 1;
  readonly blessings = BLESSINGS;
  readonly graceLevel = HEARTH_GRACE_LEVEL;
  s: HearthSave = this.hearth.state;
  gold = this.economy.snapshot.gold;
  help = false;
  said = '';

  constructor() {
    this.i18n.register(COLD_HEARTH_I18N);
    this.subs.add(this.hearth.state$.subscribe(s => { this.s = s; this.cdr.markForCheck(); }));
    this.subs.add(this.economy.snapshot$.subscribe(e => { this.gold = e.gold; this.cdr.markForCheck(); }));
  }

  get price(): number { return blessingPrice(this.level); }
  get grace(): boolean { return !fallCosts(this.level); }

  buy(id: BlessingId): void {
    const r = this.hearth.buy(id, this.level);
    this.said = r === 'ok' ? this.t('play.coldHearth.shrine.bought', { name: this.t(`play.coldHearth.bless.${id}.name`) })
      : r === 'gold' ? this.t('play.coldHearth.shrine.noGold')
      : r === 'grace' ? this.t('play.coldHearth.shrine.grace', { n: this.graceLevel }) : '';
    this.cdr.markForCheck();
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
