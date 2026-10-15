/**
 * pet-sheet.component.ts — the Satchel's pet well, opened: your pets.
 *
 * Diablo II-clean: a row of wells (one per pet or egg), and one card for the
 * one you tap, with ONE plain primary action (Hatch, Name it, or Feed). The
 * rest is small and secondary: follow / rest, the trick and the hat once
 * affection opens them, and the "Found in / Helps with" lines.
 *
 * Every change goes through PetsService (the save gateway). The play view
 * listens for `feel` (the pet in the world lights up or does its trick) and
 * `changed` (who follows, its name and hat).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import { PetsService } from './pets.service';
import { PETS_I18N } from './pets.i18n';
import { HAT_AT, LOVE_MAX, PETS, PET_TREAT, TRICK_AT, dayKey, hasHat, isHatched, knowsTrick, mealsLeft, type PetDef, type PetId } from './pets.model';
import { CabinetsService } from '../cabinets/cabinets.service';
import type { PetRecord } from './pets-save.model';
import { eggPortrait, petPortrait } from './pet-art';
import { PET_COMMANDS, SECOND_AT, levelProgress, petRole, type PetCommand, type PetRoleDef } from './pet-roles';

interface WellRow { def: PetDef; rec: PetRecord; art: string; label: string }
interface FoodRow { id: string; name: string; qty: number; favourite: boolean }

@Component({
  selector: 'app-pet-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ps" role="dialog" aria-modal="false" aria-labelledby="ps-title" data-engine-ignore data-pet-sheet>
      <header class="ps__head">
        <h2 id="ps-title">{{ t('play.pet.title') }}</h2>
        <button type="button" class="ps__btn" (click)="done.emit()">{{ t('play.pet.close') }}</button>
      </header>
      @if (!wells.length) {
        <p class="ps__note">{{ t('play.pet.empty') }}</p>
      } @else {
        <div class="ps__wells" role="group" [attr.aria-label]="t('play.pet.title')">
          @for (w of wells; track w.def.id) {
            <button type="button" class="ps__well" [class.is-on]="w.def.id === picked" [attr.data-pet]="w.def.id"
                    [attr.data-egg]="isHatched(w.rec) ? null : ''" [attr.aria-pressed]="w.def.id === picked" [attr.aria-label]="w.label" (click)="pick(w.def.id)">
              <img [src]="w.art" alt="" width="40" height="40">
              @if (active === w.def.id) { <i class="ps__dot" aria-hidden="true"></i> }
            </button>
          }
        </div>
      }
      @if (card; as c) {
        <article class="ps__card" [attr.data-pet-card]="c.def.id">
          <div class="ps__art"><img [src]="c.art" alt="" width="104" height="104"></div>
          <div class="ps__copy">
            @if (!isHatched(c.rec)) {
              <h3>{{ t('play.pet.egg', { name: petName(c.def.id) }) }}</h3>
              <p class="ps__note">{{ t('play.pet.eggNote') }}</p>
              <button type="button" class="ps__primary" data-pet-hatch (click)="hatch(c.def.id)">{{ t('play.pet.hatch') }}</button>
            } @else if (!c.rec.name || renaming) {
              <h3>{{ petName(c.def.id) }}</h3>
              <label class="ps__label" for="ps-name">{{ t('play.pet.namePrompt') }}</label>
              <form class="ps__name" (submit)="$event.preventDefault(); rename(c.def.id, nameInput.value)">
                <input #nameInput id="ps-name" type="text" maxlength="16" autocomplete="off" [value]="c.rec.name" [attr.aria-label]="t('play.pet.nameLabel')" data-pet-name-input>
                <button type="submit" class="ps__primary" data-pet-name-save>{{ t('play.pet.nameSave') }}</button>
              </form>
            } @else {
              <h3 data-pet-name>{{ c.rec.name }} <small>{{ petName(c.def.id) }}</small></h3>
              <p class="ps__love" [attr.data-pet-love]="c.rec.love">
                <span>{{ t('play.pet.love', { n: c.rec.love, max: loveMax }) }}</span>
                <i aria-hidden="true"><em [style.width.%]="c.rec.love / loveMax * 100"></em></i>
              </p>
              @if (food; as f) {
                <button type="button" class="ps__primary" data-pet-feed (click)="feed(c.def.id, f.id)" [disabled]="!meals">{{ t('play.pet.feedWith', { food: f.name, n: f.qty }) }}</button>
              } @else {
                <p class="ps__note">{{ t('play.pet.noFood') }}</p>
              }
              <p class="ps__small">{{ meals ? t('play.pet.mealsLeft', { n: meals }) : t('play.pet.full', { name: c.rec.name }) }} · {{ t('play.pet.eats', { foods: eats(c.def) }) }}</p>
              <div class="ps__row">
                @if (active === c.def.id) {
                  <button type="button" class="ps__btn" data-pet-rest (click)="follow('')">{{ t('play.pet.rest') }}</button>
                } @else {
                  <button type="button" class="ps__btn" data-pet-follow (click)="follow(c.def.id)">{{ t('play.pet.follow') }}</button>
                }
                @if (knowsTrick(c.rec)) {
                  <button type="button" class="ps__btn" data-pet-trick (click)="trick(c.def.id)">{{ t('play.pet.trick') }}</button>
                }
                @if (hatOk(c.rec)) {
                  <button type="button" class="ps__btn" data-pet-hat (click)="hat(c.def.id, !c.rec.hat)">{{ c.rec.hat ? t('play.pet.hatOff') : t('play.pet.wearHat', { hat: t('play.pet.hat.' + c.def.id) }) }}</button>
                }
                <button type="button" class="ps__btn ps__btn--quiet" (click)="renaming = true">{{ t('play.pet.rename') }}</button>
              </div>
              @if (!knowsTrick(c.rec)) { <p class="ps__small">{{ t('play.pet.trickAt', { n: trickAt }) }}</p> }
              @else if (!hatOk(c.rec)) { <p class="ps__small">{{ t('play.pet.hatAt', { n: hatAt }) }}</p> }
              <!-- What it does (pet-roles.ts): its role, its move, its level, the second move. -->
              @if (roleOf(c.def.id); as r) {
                <div class="ps__role" [attr.data-pet-role]="r.role" [attr.data-pet-level]="level(c.rec.xp).level">
                  <p class="ps__love">
                    <span>{{ t('play.pet.role.' + r.role) }} · {{ level(c.rec.xp).span ? t('play.pet.levelBar', { n: level(c.rec.xp).level, into: level(c.rec.xp).into, span: level(c.rec.xp).span }) : t('play.pet.levelTop', { n: level(c.rec.xp).level }) }}</span>
                    <i aria-hidden="true"><em class="ps__xp" [style.width.%]="level(c.rec.xp).span ? level(c.rec.xp).into / level(c.rec.xp).span * 100 : 100"></em></i>
                  </p>
                  <p class="ps__small">{{ t('play.pet.move.' + r.move) }}</p>
                  <p class="ps__small">{{ level(c.rec.xp).level >= secondAt ? t('play.pet.secondHas', { what: t('play.pet.second.' + r.second) }) : t('play.pet.secondAt', { n: secondAt, what: t('play.pet.second.' + r.second) }) }}</p>
                  @if (level(c.rec.xp).level < secondAt) { <p class="ps__small">{{ t('play.pet.levelHow') }}</p> }
                </div>
              }
              @if (active === c.def.id) {
                <div class="ps__cmd" role="group" [attr.aria-label]="t('play.pet.command.title')" [attr.data-pet-command]="command">
                  <span class="ps__label">{{ t('play.pet.command.title') }}</span>
                  <div class="ps__row">
                    @for (cmd of commands; track cmd) {
                      <button type="button" class="ps__btn ps__btn--cmd" [class.is-on]="cmd === command" [attr.aria-pressed]="cmd === command" [attr.data-pet-cmd]="cmd" (click)="tell(cmd)">{{ t('play.pet.command.' + cmd) }}</button>
                    }
                  </div>
                  <p class="ps__small">{{ t('play.pet.command.note.' + command) }}</p>
                </div>
              }
            }
            @if (status) { <p class="ps__status" role="status" data-pet-status>{{ status }}</p> }
            <dl class="ps__meaning">
              <dt>{{ t('play.pet.usedFor') }}</dt><dd>{{ t('play.pet.use.' + c.def.id) }}</dd>
              <dt>{{ t('play.pet.foundIn') }}</dt><dd>{{ t('play.pet.found.' + c.def.id) }}</dd>
            </dl>
            <p class="ps__small">{{ t('play.pet.never') }}</p>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ps {
      display: grid; gap: 10px; width: min(440px, calc(100vw - 16px)); max-height: min(78vh, 640px); overflow: auto; padding: 14px 16px 12px;
      border: 1px solid var(--adventure-hud-shadow); border-left: 2px solid var(--adventure-ember); border-radius: 2px;
      background: var(--adventure-hud-panel-solid); color: var(--adventure-parchment);
      box-shadow: 0 14px 32px color-mix(in srgb, var(--adventure-hud-shadow) 53%, transparent);
    }
    .ps__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ps__head h2 { margin: 0; font: 600 16px Orbitron, sans-serif; letter-spacing: .06em; color: var(--adventure-beacon-text); }
    .ps__note, .ps__status { margin: 0; font: italic 400 15px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .ps__status { font-style: normal; color: var(--adventure-beacon-text); }
    .ps__small { margin: 0; font-size: 12px; line-height: 1.4; color: var(--adventure-dialogue); opacity: .85; }
    .ps__wells { display: flex; flex-wrap: wrap; gap: 6px; }
    .ps__well {
      position: relative; display: grid; place-items: center; width: 52px; height: 52px; padding: 4px;
      border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 30%, transparent); border-radius: 2px;
      background: var(--adventure-hud-panel-deep); cursor: pointer;
    }
    .ps__well.is-on { border-color: var(--adventure-hud-gold); box-shadow: inset 0 0 0 1px var(--adventure-hud-gold); }
    .ps__well img, .ps__art img { image-rendering: pixelated; display: block; }
    .ps__dot { position: absolute; right: 3px; top: 3px; width: 7px; height: 7px; background: var(--adventure-ember); }
    .ps__card { display: grid; grid-template-columns: 104px 1fr; gap: 12px; align-items: start; }
    .ps__art { display: grid; place-items: center; width: 104px; height: 104px; background: var(--adventure-hud-panel-deep); border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 18%, transparent); }
    .ps__copy { display: grid; gap: 8px; min-width: 0; }
    .ps__copy h3 { margin: 0; font: 600 15px Orbitron, sans-serif; letter-spacing: .04em; color: var(--adventure-beacon-text); overflow-wrap: anywhere; }
    .ps__copy h3 small { display: block; font: 400 12px system-ui, sans-serif; letter-spacing: 0; color: var(--adventure-dialogue); }
    .ps__label { font-size: 13px; color: var(--adventure-dialogue); }
    .ps__name { display: flex; gap: 6px; flex-wrap: wrap; }
    .ps__name input {
      flex: 1 1 120px; min-width: 0; min-height: 44px; padding: 0 10px; border: 1px solid var(--adventure-hud-brass); border-radius: 2px;
      background: var(--adventure-hud-panel-deep); color: var(--adventure-parchment); font: 16px system-ui, sans-serif;
    }
    .ps__love { display: grid; gap: 4px; margin: 0; font: 600 12px Orbitron, sans-serif; letter-spacing: .06em; }
    .ps__love i { display: block; height: 6px; background: var(--adventure-hud-panel-deep); border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 30%, transparent); }
    .ps__love em { display: block; height: 100%; background: var(--adventure-ember); }
    .ps__row { display: flex; flex-wrap: wrap; gap: 6px; }
    .ps__primary, .ps__btn {
      min-height: 44px; min-width: 64px; padding: 6px 12px; border-radius: 2px; cursor: pointer;
      font: 600 12px Orbitron, sans-serif; letter-spacing: .08em;
    }
    .ps__primary { border: 1px solid var(--adventure-ember); background: color-mix(in srgb, var(--adventure-ember) 26%, transparent); color: var(--adventure-parchment); }
    .ps__primary[disabled] { opacity: .5; cursor: default; }
    .ps__btn { border: 1px solid var(--adventure-hud-brass); background: color-mix(in srgb, var(--adventure-hud-brass) 12%, transparent); color: var(--adventure-parchment); }
    .ps__btn--quiet { opacity: .8; }
    .ps__btn--cmd { min-width: 52px; padding: 6px 8px; }
    .ps__btn--cmd.is-on { border-color: var(--adventure-hud-gold); box-shadow: inset 0 0 0 1px var(--adventure-hud-gold); }
    .ps__role, .ps__cmd { display: grid; gap: 4px; }
    .ps__love em.ps__xp { background: var(--adventure-hud-gold); }
    .ps__primary:focus-visible, .ps__btn:focus-visible, .ps__well:focus-visible { outline: 2px solid var(--adventure-hud-gold); outline-offset: 2px; }
    .ps__meaning { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 0; font-size: 12px; line-height: 1.4; }
    .ps__meaning dt { font-weight: 600; color: var(--adventure-beacon-text); }
    .ps__meaning dd { margin: 0; color: var(--adventure-dialogue); }
    @media (max-width: 420px) {
      .ps__card { grid-template-columns: 1fr; }
      .ps__art { width: 100%; }
    }
  `],
})
export class PetSheetComponent implements OnInit, OnDestroy {
  private readonly pets = inject(PetsService);
  private readonly inventory = inject(InventoryService);
  private readonly cabinets = inject(CabinetsService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sub = new Subscription();
  @Input() start: string | null = null;
  @Output() readonly done = new EventEmitter<void>();
  /** The pet in the world should react: a meal, its trick, a hatch. */
  @Output() readonly feel = new EventEmitter<{ id: string; kind: 'happy' | 'love' | 'trick' | 'hatch'; text?: string }>();
  /** A command from the card (Follow / Stay / Fight / Gather / Play): the world re-reads it. */
  @Output() readonly commanded = new EventEmitter<PetCommand>();
  readonly commands = PET_COMMANDS;
  readonly secondAt = SECOND_AT;
  command: PetCommand = 'follow';
  roleOf(id: string): PetRoleDef | undefined { return petRole(id); }
  level(xp: number): { level: number; into: number; span: number } { return levelProgress(xp); }
  tell(cmd: PetCommand): void {
    if (!this.pets.setCommand(cmd)) return;
    this.command = cmd;
    this.commanded.emit(cmd);
  }
  readonly loveMax = LOVE_MAX;
  readonly trickAt = TRICK_AT;
  readonly hatAt = HAT_AT;
  readonly isHatched = isHatched;
  readonly knowsTrick = knowsTrick;
  /** The hat is open: love, or the Hatbox of Small Crowns (a Lost Cabinet's). */
  hatOk(rec: Parameters<typeof hasHat>[0]): boolean { return hasHat(rec, this.cabinets.hatbox()); }
  wells: WellRow[] = [];
  picked: string | null = null;
  active = '';
  renaming = false;
  status = '';
  food: FoodRow | null = null;
  meals = 0;

  constructor() { this.i18n.register(PETS_I18N); }

  ngOnInit(): void {
    this.sub.add(this.pets.state$.subscribe(() => { this.refresh(); this.cdr.markForCheck(); }));
    this.picked = this.start && this.pets.record(this.start) ? this.start : this.picked;
    this.refresh();
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get card(): WellRow | null { return this.wells.find(w => w.def.id === this.picked) ?? null; }

  pick(id: string): void { this.picked = id; this.renaming = false; this.status = ''; this.refresh(); }

  hatch(id: string): void {
    if (!this.pets.hatch(id)) return;
    this.status = this.t('play.pet.toast.hatched', { name: this.petName(id) });
    this.feel.emit({ id, kind: 'hatch' });
  }

  rename(id: string, raw: string): void {
    const name = this.pets.name(id, raw);
    if (!name) return;
    this.renaming = false;
    this.status = '';
    this.feel.emit({ id, kind: 'happy' });
  }

  follow(id: string): void { this.pets.follow(id); }

  trick(id: string): void { this.feel.emit({ id, kind: 'trick' }); }

  hat(id: string, on: boolean): void { this.pets.wearHat(id, on, Date.now(), this.cabinets.hatbox()); }

  feed(id: string, food: string): void {
    const out = this.pets.feed(id, food, new Date(), this.cabinets.extraMeals());
    const name = this.pets.record(id)?.name || this.petName(id);
    if (!out.ok) { this.status = out.code === 'full' ? this.t('play.pet.full', { name }) : this.t('play.pet.noFood'); return; }
    const lines = [this.t(out.favourite ? 'play.pet.fedFavourite' : 'play.pet.fed', { name, n: out.gain })];
    if (out.trick) lines.push(this.t('play.pet.trickUnlocked', { name }));
    if (out.hat) lines.push(this.t('play.pet.hatUnlocked', { name, hat: this.t('play.pet.hat.' + id) }));
    this.status = lines.join(' ');
    this.feel.emit({ id, kind: out.trick ? 'trick' : 'love' });
  }

  petName(id: string): string { return this.t('play.pet.name.' + id); }

  eats(def: PetDef): string {
    return [def.favourite, ...def.likes].map((id, i) => (materialDisplay(id)?.name ?? id) + (i === 0 ? ` (${this.t('play.pet.favourite')})` : '')).join(', ');
  }

  private refresh(): void {
    const state = this.pets.state;
    this.active = state.active;
    this.command = this.pets.command;
    this.wells = PETS.filter(def => state.pets[def.id]).map(def => {
      const rec = state.pets[def.id]!;
      const art = isHatched(rec) ? petPortrait(def.id as PetId, 'idle0', rec.hat && this.hatOk(rec), 2) : eggPortrait(def.id as PetId, 0, 2);
      return { def, rec, art, label: isHatched(rec) ? rec.name || this.petName(def.id) : this.t('play.pet.egg', { name: this.petName(def.id) }) };
    });
    if (!this.picked || !state.pets[this.picked]) this.picked = this.wells[0]?.def.id ?? null;
    const card = this.card;
    if (card) {
      // The big portrait: the same frame, larger.
      card.art = isHatched(card.rec) ? petPortrait(card.def.id as PetId, 'idle0', card.rec.hat && this.hatOk(card.rec), 4) : eggPortrait(card.def.id as PetId, 1, 4);
      // Its favourite first, then the Courier's Honeycomb (every pet's treat), then what else it likes.
      const foods = [card.def.favourite, PET_TREAT, ...card.def.likes]
        .map((id, i) => ({ id, name: materialDisplay(id)?.name ?? id, qty: this.inventory.stackOf(id), favourite: i <= 1 }))
        .filter(f => f.qty > 0);
      this.food = foods[0] ?? null;
      this.meals = isHatched(card.rec) ? mealsLeft(card.rec, dayKey(new Date()), this.cabinets.extraMeals()) : 0;
    }
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
