/**
 * loot-sheet.component.ts — Menu → Loot & Combat: the loot filter, the aura,
 * the difficulty, and the Keeper's resistances.
 *
 * One plain screen (the station rule): three choices made by tapping, each
 * row 44px tall on a phone, saved at once through LootService (the save
 * gateway), so it is the same on the player's other devices.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { LootService } from './loot.service';
import { LOOT_I18N } from './loot.i18n';
import { LOOT_FILTERS, type LootFilter } from './loot-tiers';
import { AURAS, auraEffect, type AuraId, type AuraSource } from './auras';
import { DIFFICULTIES, DIFFICULTY_TIERS, type DifficultyTier } from './difficulty.model';
import { ELEMENTS, MAX_KEEPER_RESIST, keeperResist, type Element } from './damage.model';
import type { LootSave } from './loot-save.model';

interface ResistRow { id: Element; value: number }

@Component({
  selector: 'app-loot-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ls" role="dialog" aria-modal="false" aria-labelledby="ls-title" data-engine-ignore [attr.data-loot-filter]="s.filter" [attr.data-loot-tier]="s.tier">
      <header class="ls__head">
        <h2 id="ls-title">{{ t('loot.title') }}</h2>
        <button type="button" class="ls__done" (click)="done.emit()">{{ t('loot.close') }}</button>
      </header>
      <p class="ls__lead">{{ t('loot.lead') }}</p>

      <h3 class="ls__h">{{ t('loot.filter.title') }}</h3>
      <div class="ls__row" role="radiogroup" [attr.aria-label]="t('loot.filter.title')">
        @for (f of filters; track f) {
          <button type="button" role="radio" class="ls__pick" [class.ls__pick--on]="s.filter === f" [attr.aria-checked]="s.filter === f" [attr.data-filter]="f" (click)="setFilter(f)">{{ t('loot.filter.' + f) }}</button>
        }
      </div>
      <p class="ls__note">{{ t('loot.filter.note') }}</p>

      <h3 class="ls__h">{{ t('loot.aura.title') }}</h3>
      @if (!sources.length) {
        <p class="ls__note">{{ t('loot.aura.none') }}</p>
      } @else {
        <div class="ls__row ls__row--wrap" role="radiogroup" [attr.aria-label]="t('loot.aura.title')">
          <button type="button" role="radio" class="ls__pick" [class.ls__pick--on]="!s.aura" [attr.aria-checked]="!s.aura" data-aura-pick="auto" (click)="setAura(null)">{{ t('loot.aura.auto') }}</button>
          @for (src of sources; track src.from) {
            <button type="button" role="radio" class="ls__pick" [class.ls__pick--on]="s.aura === src.aura" [attr.aria-checked]="s.aura === src.aura" [attr.data-aura-pick]="src.aura"
                    [style.border-color]="color(src.aura)" (click)="setAura(src.aura)">{{ t('loot.aura.from', { aura: t('loot.aura.' + src.aura), level: src.level, name: src.name }) }}</button>
          }
        </div>
        @if (active) {
          <p class="ls__note" data-aura-active [attr.data-aura]="active.aura"><b [style.color]="color(active.aura)">{{ t('loot.aura.active', { aura: t('loot.aura.' + active.aura), level: active.level }) }}</b> · {{ fx(active) }}</p>
        }
      }

      <h3 class="ls__h">{{ t('loot.tier.title') }}</h3>
      <div class="ls__tiers" role="radiogroup" [attr.aria-label]="t('loot.tier.title')">
        @for (tier of tiers; track tier) {
          <button type="button" role="radio" class="ls__tier" [class.ls__pick--on]="s.tier === tier" [attr.aria-checked]="s.tier === tier"
                  [attr.data-tier]="tier" [disabled]="!s.unlocked.includes(tier)" (click)="setTier(tier)">
            <strong [style.color]="tierColor(tier)">{{ t('loot.tier.' + tier) }}</strong>
            <small>{{ s.unlocked.includes(tier) ? t('loot.tierBlurb.' + tier) : t('loot.tier.locked', { tier: t('loot.tier.' + previous(tier)) }) }}</small>
          </button>
        }
      </div>
      <p class="ls__note">{{ t('loot.tier.falls', { n: share }) }}</p>

      <h3 class="ls__h">{{ t('loot.resist.title') }}</h3>
      <ul class="ls__res">
        @for (r of resists; track r.id) {
          <li [attr.data-resist]="r.id"><span>{{ t('loot.resist.' + r.id) }}</span><b [class.ls__neg]="r.value < 0">{{ r.value }}</b></li>
        }
      </ul>
      <p class="ls__note">{{ t('loot.resist.note') }}</p>
      <p class="ls__saved">{{ t('loot.saved') }}</p>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ls {
      display: grid; gap: 8px; width: min(400px, calc(100vw - 32px)); max-height: calc(100dvh - 120px); overflow-y: auto; padding: 14px 16px 12px;
      border: 1px solid var(--adventure-hud-shadow); border-left: 2px solid var(--adventure-ember); border-radius: 2px;
      background: var(--adventure-hud-panel-solid); color: var(--adventure-parchment);
      box-shadow: 0 14px 32px color-mix(in srgb, var(--adventure-hud-shadow) 53%, transparent);
    }
    .ls__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ls__head h2 { margin: 0; font: 600 16px Orbitron, sans-serif; letter-spacing: .06em; color: var(--adventure-beacon-text); }
    .ls__h { margin: 6px 0 0; font: 600 12px Orbitron, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--adventure-ember); }
    .ls__lead, .ls__note, .ls__saved { margin: 0; font: italic 400 14px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .ls__saved { font-size: 13px; opacity: .75; }
    .ls__row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .ls__row--wrap { grid-template-columns: 1fr; }
    .ls__pick, .ls__tier, .ls__done {
      min-height: 44px; padding: 6px 10px; border: 1px solid var(--adventure-hud-brass); border-radius: 2px;
      background: color-mix(in srgb, var(--adventure-hud-brass) 10%, transparent); color: var(--adventure-parchment);
      font: 600 12px Orbitron, sans-serif; letter-spacing: .04em; cursor: pointer; text-align: left;
    }
    .ls__pick--on { border-color: var(--adventure-hud-gold); background: color-mix(in srgb, var(--adventure-hud-gold) 22%, transparent); }
    .ls__tiers { display: grid; gap: 6px; }
    .ls__tier { display: grid; gap: 2px; }
    .ls__tier small { font: 400 12px/1.3 system-ui, sans-serif; letter-spacing: 0; opacity: .85; }
    .ls__tier:disabled { opacity: .5; cursor: not-allowed; }
    .ls__pick:hover, .ls__pick:focus-visible, .ls__tier:focus-visible, .ls__done:focus-visible { border-color: var(--adventure-hud-gold); outline: none; }
    .ls__res { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; }
    .ls__res li { display: flex; justify-content: space-between; min-height: 28px; align-items: center; font: 600 12px Orbitron, sans-serif; }
    .ls__neg { color: var(--adventure-danger, #ff765c); }
  `],
})
export class LootSheetComponent implements OnDestroy {
  private readonly loot = inject(LootService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  @Output() readonly done = new EventEmitter<void>();
  readonly filters = LOOT_FILTERS;
  readonly tiers = DIFFICULTY_TIERS;
  s: LootSave = this.loot.state;
  sources: AuraSource[] = [];
  active: AuraSource | null = null;
  resists: ResistRow[] = [];

  constructor() {
    this.i18n.register(LOOT_I18N);
    this.refresh();
    this.subs.add(this.loot.state$.subscribe(s => { this.s = s; this.refresh(); this.cdr.markForCheck(); }));
    this.subs.add(this.inventory.snapshot$.subscribe(() => { this.refresh(); this.cdr.markForCheck(); }));
  }

  get share(): number { return Math.round(DIFFICULTIES[this.s.tier].deathShare * 100); }

  private refresh(): void {
    const items = this.inventory.snapshot.items;
    this.sources = this.loot.auraSources(items);
    this.active = this.loot.activeAura(items);
    const gear = this.loot.combatRules().resists;
    const penalty = DIFFICULTIES[this.s.tier].resistPenalty;
    this.resists = ELEMENTS.map(id => ({ id, value: Math.min(MAX_KEEPER_RESIST, keeperResist(gear[id], penalty)) }));
  }

  setFilter(f: LootFilter): void { this.loot.setFilter(f); }
  setAura(a: AuraId | null): void { this.loot.setAura(a); }
  setTier(tier: DifficultyTier): void { this.loot.setTier(tier); }
  previous(tier: DifficultyTier): DifficultyTier { return DIFFICULTY_TIERS[Math.max(0, DIFFICULTY_TIERS.indexOf(tier) - 1)]; }
  color(a: AuraId): string { return AURAS[a].color; }
  tierColor(tier: DifficultyTier): string { return DIFFICULTIES[tier].color; }

  /** The aura's effect line, with its one number. */
  fx(src: AuraSource): string {
    const e = auraEffect(src.aura, src.level);
    const n = src.aura === 'might' ? Math.round((e.damage - 1) * 100)
      : src.aura === 'conviction' ? e.resistLower
      : src.aura === 'redemption' ? e.healPerCorpse
      : src.aura === 'fanaticism' ? Math.round((e.attackSpeed - 1) * 100)
      : src.aura === 'prayer' ? e.regen
      : src.aura === 'vigor' ? Math.round((e.moveSpeed - 1) * 100)
      : e.pulseDamage;
    return this.t('loot.auraFx.' + src.aura, { n });
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
