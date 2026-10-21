/**
 * grave-desk.component.ts — Sexton Aldous Wren's cleansing (role `sexton`) and the Archivist's silence (role
 * `archivist`), in the place panel. Station rule: one plain button per piece, its price on it; the why is the lead line.
 *
 * Writes through GraveGoodsService (Gold through the economy, the mark through the inventory, per character).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { itemArt } from '../rpg/material-catalog';
import type { GameItem } from '../rpg/item.model';
import { GraveGoodsService } from './grave-goods.service';
import { GRAVE_I18N } from './grave-goods.i18n';
import { cleansePrice, silencePrice, whisperStage, WHISPER_PIECES } from './grave-goods.model';

interface DeskRow { id: string; name: string; rarity: string; art: string; line: string; worn: boolean; done: boolean }

@Component({
  selector: 'app-grave-desk',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gd" [attr.data-grave-desk]="role" [attr.data-grave-rows]="rows.length">
      <p class="gd__lead">{{ t('grave.' + role + '.lead') }}</p>
      @if (!rows.length) { <p class="gd__note">{{ t('grave.' + role + '.empty') }}</p> }
      <ul class="gd__list">
        @for (r of rows; track r.id) {
          <li class="gd__row" [attr.data-grave-item]="r.id" [attr.data-rarity]="r.rarity" [class.gd__row--done]="r.done">
            <span class="gd__icon" aria-hidden="true">@if (r.art) { <img [src]="r.art" alt=""> }</span>
            <span class="gd__body"><b>{{ r.name }}</b><small>{{ r.line }}@if (r.worn) { · {{ t('grave.desk.worn') }} }</small></span>
            @if (r.done) {
              <span class="gd__done">{{ t('grave.' + role + '.done') }}</span>
            } @else {
              <button type="button" class="gd__act" [disabled]="gold < price" (click)="act(r)">{{ t('grave.' + role + '.btn', { n: price }) }}</button>
            }
          </li>
        }
      </ul>
      <p class="gd__note" role="status" aria-live="polite" data-grave-said>{{ said }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .gd { display: grid; gap: 8px; color: var(--adventure-parchment); text-shadow: 2px 2px 0 var(--obsidian-0); }
    .gd__lead, .gd__note { margin: 0; font: italic 400 14px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .gd__note:empty { display: none; }
    .gd__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .gd__row {
      display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 10px; min-height: 52px; padding: 6px 10px;
      background: var(--obsidian-2); box-shadow: 0 -2px 0 0 var(--gold-deep), 0 2px 0 0 var(--gold-deep), -2px 0 0 0 var(--gold-deep), 2px 0 0 0 var(--gold-deep);
    }
    .gd__row--done { opacity: .8; }
    .gd__icon { width: 36px; height: 36px; display: grid; place-items: center; background: var(--obsidian-0); }
    .gd__icon img { width: 32px; height: 32px; image-rendering: pixelated; }
    .gd__body { display: grid; gap: 2px; min-width: 0; }
    .gd__body b { font: 700 13px var(--font-game); letter-spacing: .04em; }
    .gd__row[data-rarity='rare'] .gd__body b { color: var(--cozy-loot-rare); }
    .gd__row[data-rarity='epic'] .gd__body b { color: var(--cozy-loot-epic); }
    .gd__row[data-rarity='legendary'] .gd__body b { color: var(--cozy-loot-legendary); }
    .gd__row[data-rarity='mythic'] .gd__body b { color: var(--cozy-loot-mythic); }
    .gd__body small { font: 400 12px/1.3 system-ui, sans-serif; opacity: .85; }
    .gd__act {
      min-height: 44px; padding: 6px 12px; border: 0; border-radius: 0; cursor: pointer;
      background: color-mix(in srgb, var(--adventure-hud-gold) 30%, var(--obsidian-2)); color: var(--adventure-parchment);
      box-shadow: 0 -2px 0 0 var(--gold-bright), 0 2px 0 0 var(--gold-bright), -2px 0 0 0 var(--gold-bright), 2px 0 0 0 var(--gold-bright);
      font: 600 12px var(--font-game); letter-spacing: .04em; white-space: nowrap;
    }
    .gd__act:disabled { opacity: .5; cursor: not-allowed; }
    .gd__act:focus-visible { outline: 2px solid var(--adventure-hud-gold); outline-offset: 2px; }
    .gd__done { font: 600 12px var(--font-game); letter-spacing: .06em; text-transform: uppercase; color: var(--adventure-hud-gold); }
  `],
})
export class GraveDeskComponent implements OnChanges, OnDestroy {
  private readonly grave = inject(GraveGoodsService);
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  /** Who stands behind the desk: Sexton Wren cleanses curses, the Archivist silences whispers. */
  @Input() role: 'sexton' | 'archivist' = 'sexton';
  /** The Keeper's level: it sets the price (a few minutes of a hunt at this level). */
  @Input() level = 1;
  rows: DeskRow[] = [];
  gold = this.economy.snapshot.gold;
  said = '';

  constructor() {
    this.i18n.register(GRAVE_I18N);
    this.subs.add(this.inventory.snapshot$.subscribe(() => { this.rows = this.build(); this.cdr.markForCheck(); }));
    this.subs.add(this.economy.snapshot$.subscribe(e => { this.gold = e.gold; this.cdr.markForCheck(); }));
  }

  /** The role arrives after construction: the rows are the Sexton's or the Archivist's. */
  ngOnChanges(): void { this.rows = this.build(); this.said = ''; }

  get price(): number { return this.role === 'sexton' ? cleansePrice(this.level) : silencePrice(this.level); }

  act(r: DeskRow): void {
    const code = this.role === 'sexton' ? this.grave.cleanse(r.id, this.level) : this.grave.silence(r.id, this.level);
    this.said = code === 'ok' ? this.t(`grave.${this.role}.said`, { name: r.name }) : code === 'gold' ? this.t('grave.desk.noGold') : '';
    this.rows = this.build();
    this.cdr.markForCheck();
  }

  private build(): DeskRow[] {
    const items: GameItem[] = this.role === 'sexton' ? this.grave.cursed() : this.grave.whispering();
    return items.map(i => ({
      id: i.id, name: i.name, rarity: i.rarity, art: itemArt(i)?.src ?? '', worn: i.equipped,
      done: this.role === 'sexton' ? !!i.curse?.cleansed : !!i.whisper?.silenced,
      line: this.role === 'sexton'
        ? this.t('grave.tip.cursed', { name: this.t(`grave.curse.${i.curse!.id}.name`) })
        : this.t('grave.tip.awakeShort', { n: whisperStage(i.whisper!) + 1, of: WHISPER_PIECES }),
    }));
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
