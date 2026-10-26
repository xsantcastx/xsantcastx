/**
 * controls-sheet.component.ts — Menu → Controls & keys: every action with its key(s).
 *
 * Click a key, press the one you want, and it is rebound (shared/keys/keymap.service). A key that belongs to another
 * action shows the clash and offers Swap or Take it (clear the other). Reset puts the defaults back. Esc is the Menu's
 * and cannot be rebound. Phones have no keys, so the list is read-only there. Every change is saved at once through
 * the settings blob, so it follows the Keeper across devices.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import { KEY_ACTIONS, KEY_GROUPS, MAX_KEYS, codeLabel, isBindable } from '../../shared/keys/keymap.model';
import { KeymapService } from '../../shared/keys/keymap.service';
import { KEYS_I18N } from '../../shared/keys/keys.i18n';

interface Capture { action: string; slot: number }
interface Clash { action: string; slot: number; code: string; other: string }

@Component({
  selector: 'app-controls-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ks" role="dialog" aria-modal="false" aria-labelledby="ks-title" data-engine-ignore data-controls>
      <header class="ks__head">
        <h2 id="ks-title">{{ t('keys.title') }}</h2>
        <button type="button" class="px-x ks__done" data-controls-close (click)="done.emit()" [attr.aria-label]="t('keys.close')"><i aria-hidden="true">&times;</i></button>
      </header>
      <p class="ks__lead">{{ readOnly ? t('keys.touch') : t('keys.lead') }}</p>
      @if (clash; as c) {
        <div class="ks__clash" role="alertdialog" aria-labelledby="ks-clash" data-key-clash>
          <p id="ks-clash"><b>{{ t('keys.clash', { key: label(c.code), other: name(c.other) }) }}</b> <small>{{ t('keys.clashSwap', { other: name(c.other) }) }}</small></p>
          <span class="ks__clashbtns">
            <button type="button" data-clash="swap" (click)="resolve('swap')">{{ t('keys.swap') }}</button>
            <button type="button" data-clash="clear" (click)="resolve('clear')">{{ t('keys.takeIt') }}</button>
            <button type="button" data-clash="cancel" (click)="clash = null">{{ t('keys.cancel') }}</button>
          </span>
        </div>
      }
      <div class="ks__row ks__row--fixed">
        <span class="ks__name">{{ t('keys.escape') }}</span>
        <span class="ks__keys"><kbd class="kc kc--fixed">Esc</kbd><small>{{ t('keys.fixed') }}</small></span>
      </div>
      <div class="ks__row ks__row--fixed" data-action="labels">
        <span class="ks__name">{{ t('keys.labels') }}</span>
        <span class="ks__keys"><kbd class="kc kc--fixed">Alt</kbd><small>{{ t('keys.hold') }}</small></span>
      </div>
      @for (g of groups; track g) {
        <h3 class="ks__group">{{ t('keys.group.' + g) }}</h3>
        @for (a of actionsOf(g); track a.id) {
          <div class="ks__row" [attr.data-action]="a.id">
            <span class="ks__name">{{ name(a.id) }}</span>
            <span class="ks__keys">
              @for (code of codes(a.id); track code; let i = $index) {
                @if (readOnly) { <kbd class="kc">{{ label(code) }}</kbd> }
                @else {
                  <button type="button" class="kc kc--btn" [class.is-capture]="isCapture(a.id, i)" [attr.data-slot]="i" (click)="begin(a.id, i)"
                          [attr.aria-label]="t('keys.rowAria', { name: name(a.id), keys: label(code) })">{{ isCapture(a.id, i) ? t('keys.press') : label(code) }}</button>
                  <button type="button" class="kc-x" [attr.aria-label]="t('keys.clear') + ' ' + label(code)" (click)="clear(a.id, i)"><i aria-hidden="true">&times;</i></button>
                }
              }
              @if (!readOnly && codes(a.id).length < max) {
                <button type="button" class="kc kc--btn kc--add" [class.is-capture]="isCapture(a.id, codes(a.id).length)" [attr.data-slot]="codes(a.id).length" (click)="begin(a.id, codes(a.id).length)"
                        [attr.aria-label]="t('keys.rowAria', { name: name(a.id), keys: t('keys.unbound') })">{{ isCapture(a.id, codes(a.id).length) ? t('keys.press') : (codes(a.id).length ? '+' : t('keys.unbound')) }}</button>
              }
            </span>
          </div>
        }
      }
      <footer class="ks__foot">
        @if (!readOnly) { <button type="button" class="ks__reset" data-controls-reset (click)="reset()">{{ t('keys.reset') }}</button> }
        <small class="ks__saved">{{ t('keys.saved') }}</small>
        <button type="button" class="ks__reset ks__close" data-controls-close-foot (click)="done.emit()">{{ t('keys.close') }}</button>
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ks { display: grid; align-content: start; gap: 6px; width: 100%; box-sizing: border-box; padding: 8px 12px calc(14px + var(--sheet-pad-b, 0px)); color: var(--adventure-parchment); }
    .ks__head { display: flex; align-items: center; justify-content: space-between; min-height: 44px; box-shadow: var(--px-groove); }
    .ks__head h2 { margin: 0; flex: 1; font: 700 15px/1.1 var(--font-game); letter-spacing: .08em; text-transform: uppercase; color: var(--adventure-beacon-text); text-shadow: 2px 2px 0 var(--obsidian-0); }
    .ks__lead, .ks__saved { margin: 0; font: italic 400 14px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .ks__saved { font-size: 12px; opacity: .75; }
    .ks__group { margin: 10px 0 0; font: 700 11px var(--font-game); letter-spacing: .12em; text-transform: uppercase; color: var(--adventure-ember); }
    .ks__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 44px; padding: 0 6px; background: var(--obsidian-2); box-shadow: inset 0 0 0 1px var(--gold-deep); }
    .ks__row--fixed { opacity: .8; }
    .ks__name { font: 600 13px var(--font-game); letter-spacing: .04em; }
    .ks__keys { display: flex; align-items: center; gap: 4px; justify-content: flex-end; flex-wrap: wrap; }
    .ks__keys small { font: italic 400 12px var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .kc { display: inline-grid; place-items: center; min-width: 34px; min-height: 34px; padding: 0 8px; box-sizing: border-box; border: 0; font: 700 12px var(--font-pixel, var(--font-game)); color: var(--cozy-wood-0, #2a1a10);
      background: var(--cozy-cream, #efe2c0); box-shadow: inset 0 -3px 0 0 rgba(0,0,0,.25), 0 0 0 2px var(--cozy-wood-0, #2a1a10); white-space: nowrap; }
    .kc--btn { cursor: pointer; min-height: 44px; }
    .kc--btn:hover, .kc--btn:focus-visible { background: var(--cozy-brass-hi, #f0cf7a); outline: none; }
    .kc--add { color: var(--adventure-dialogue); background: transparent; box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .kc--fixed { opacity: .9; }
    .kc.is-capture { background: var(--adventure-ember); color: var(--obsidian-0); animation: ksBlink 1s steps(2) infinite; }
    @media (prefers-reduced-motion: reduce) { .kc.is-capture { animation: none; } }
    @keyframes ksBlink { 50% { filter: brightness(1.25); } }
    .kc-x { width: 26px; height: 44px; margin-left: -2px; border: 0; background: none; color: var(--adventure-dialogue); cursor: pointer; font: 700 16px var(--font-game); }
    .kc-x:hover, .kc-x:focus-visible { color: var(--adventure-ember); }
    .ks__clash { display: grid; gap: 8px; padding: 10px 12px; background: var(--obsidian-2); box-shadow: 0 0 0 2px var(--adventure-ember); }
    .ks__clash p { margin: 0; font: 400 14px/1.35 var(--font-lore, Georgia, serif); }
    .ks__clash small { display: block; opacity: .8; }
    .ks__clashbtns { display: flex; flex-wrap: wrap; gap: 6px; }
    .ks__clashbtns button, .ks__reset { min-height: 44px; padding: 0 12px; border: 0; cursor: pointer; font: 600 12px var(--font-game); letter-spacing: .06em; text-transform: uppercase; color: var(--adventure-parchment); background: var(--obsidian-2); box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .ks__clashbtns button:hover, .ks__reset:hover { background: var(--adventure-ember); color: var(--obsidian-0); }
    .ks__close { margin-left: auto; }
    .ks__foot { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  `],
})
export class ControlsSheetComponent implements OnDestroy {
  private readonly keymap = inject(KeymapService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  /** Phones: no keys to press, so the list only shows them. */
  @Input() readOnly = false;
  @Output() readonly done = new EventEmitter<void>();
  @Output() readonly changed = new EventEmitter<void>();
  readonly groups = KEY_GROUPS;
  readonly max = MAX_KEYS;
  capture: Capture | null = null;
  clash: Clash | null = null;
  private listener: ((e: KeyboardEvent) => void) | null = null;

  constructor() { this.i18n.register(KEYS_I18N); }

  actionsOf(g: string) { return KEY_ACTIONS.filter(a => a.group === g); }
  codes(id: string): readonly string[] { return this.keymap.codes(id); }
  label(code: string): string { return codeLabel(code); }
  name(id: string): string { return this.t('keys.action.' + id); }
  isCapture(id: string, slot: number): boolean { return this.capture?.action === id && this.capture.slot === slot; }

  /** Click a key: the next key pressed becomes the binding (while listening, nothing else in the game hears keys). */
  begin(action: string, slot: number): void {
    if (this.readOnly) return;
    this.stop(); this.clash = null;
    this.capture = { action, slot };
    this.listener = (e: KeyboardEvent) => {
      // Everything pressed while listening belongs to this row alone.
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') { this.stop(); this.cdr.markForCheck(); return; }
      if (!isBindable(e.code)) return;
      this.apply(e.code);
      this.cdr.markForCheck();
    };
    window.addEventListener('keydown', this.listener, true);
    this.cdr.markForCheck();
  }
  private apply(code: string): void {
    const cap = this.capture; if (!cap) return;
    this.stop();
    const other = this.keymap.set(cap.action, cap.slot, code);
    if (other) this.clash = { ...cap, code, other }; else this.changed.emit();
  }
  resolve(how: 'swap' | 'clear'): void {
    const c = this.clash; if (!c) return;
    this.clash = null;
    this.keymap.set(c.action, c.slot, c.code, how);
    this.changed.emit();
  }
  clear(action: string, slot: number): void { this.stop(); this.keymap.clear(action, slot); this.changed.emit(); }
  reset(): void { this.stop(); this.clash = null; this.keymap.reset(); this.changed.emit(); }
  private stop(): void {
    if (this.listener) window.removeEventListener('keydown', this.listener, true);
    this.listener = null; this.capture = null;
  }
  ngOnDestroy(): void { this.stop(); }
  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }
}
