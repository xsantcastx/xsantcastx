/**
 * feedback-sheet.component.ts — Menu → Send feedback (and the title screen's link): a short cozy form.
 *
 * Type (bug / idea / other), a note of 10–1000 characters, and optionally a downscaled JPEG of the canvas (shown before
 * it goes, 150 KB at most). The device facts ride along and are named under the form. One note a minute, kept on the
 * server by the rules and told to the player here. A guest is told, plainly, that feedback needs a signed-in Keeper
 * (why: see feedback.service.ts) — the form stays so their words are not lost while they sign in.
 *
 * The sheet scrolls inside its own box (the play view's `.win-host` caps it at the screen), so on a small phone the Send
 * button and the line under it are always reachable; the Send button also sticks to the bottom of the sheet.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { APP_VERSION } from '../../version';
import { TranslationService } from '../../translation.service';
import { FeedbackService, type FeedbackResult } from './feedback.service';
import { FEEDBACK_MAX, FEEDBACK_MIN, FEEDBACK_TYPES, cleanDevice, draftProblem, fitShot, type FeedbackDevice, type FeedbackType } from './feedback.model';
import { FEEDBACK_I18N } from './feedback.i18n';

/** What the host knows about where the player is (the lobby knows none of it). */
export interface FeedbackContext { area?: string; vocation?: string; level?: number }

@Component({
  selector: 'app-feedback-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="fb" role="dialog" aria-modal="false" aria-labelledby="fb-title" data-engine-ignore data-feedback [attr.data-feedback-state]="state">
      <header class="fb__head">
        <h2 id="fb-title">{{ t('feedback.title') }}</h2>
        <button type="button" class="px-x fb__done" data-feedback-close (click)="done.emit()" [attr.aria-label]="t('feedback.close')"><i aria-hidden="true">&times;</i></button>
      </header>
      @if (state === 'sent') {
        <p class="fb__ok" role="status" data-feedback-sent>{{ t('feedback.sent') }}</p>
        <button type="button" class="fb__send" data-feedback-again (click)="again()">{{ t('feedback.again') }}</button>
      } @else {
        <p class="fb__lead">{{ t('feedback.lead') }}</p>
        @if (!signedIn) { <p class="fb__warn" role="note" data-feedback-signin>{{ t('feedback.signin') }}</p> }
        <div class="fb__types" role="radiogroup" [attr.aria-label]="t('feedback.type')">
          @for (k of types; track k) {
            <button type="button" role="radio" [attr.aria-checked]="type === k" [class.on]="type === k" [attr.data-feedback-type]="k" (click)="setType(k)">{{ t('feedback.type.' + k) }}</button>
          }
        </div>
        <label class="fb__field">
          <span class="fb__name">{{ t('feedback.message') }}</span>
          <textarea data-feedback-message rows="5" [maxLength]="max" [value]="message" [attr.placeholder]="t('feedback.placeholder')" (input)="onText($event)"></textarea>
          <small class="fb__count" [class.fb__count--low]="trimmed < min" data-feedback-count>{{ t('feedback.count', { n: message.length }) }}</small>
        </label>
        @if (canShot) {
          <label class="fb__check">
            <input type="checkbox" data-feedback-shot [checked]="withShot" (change)="toggleShot($event)">
            <span>{{ t('feedback.shot') }}</span>
          </label>
          @if (withShot) {
            @if (shotUrl) {
              <img class="fb__shot" data-feedback-preview [src]="shotUrl" [alt]="t('feedback.shotAlt')">
            } @else if (shotFailed) {
              <p class="fb__warn" role="status">{{ t('feedback.shotFail') }}</p>
            }
          } @else {
            <small class="fb__hint">{{ t('feedback.shotHint') }}</small>
          }
        }
        <small class="fb__hint" data-feedback-device>{{ t('feedback.device') }}</small>
        <div class="fb__foot">
          @if (note) { <p class="fb__note" role="status" data-feedback-note>{{ note }}</p> }
          <button type="button" class="fb__send" data-feedback-send [disabled]="!signedIn || busy" (click)="send()">{{ busy ? t('feedback.sending') : t('feedback.send') }}</button>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .fb {
      display: grid; align-content: start; gap: 10px; width: 100%; box-sizing: border-box; min-height: 100%;
      padding: 8px 12px calc(12px + var(--sheet-pad-b, 0px));
      border: 0; background: none; color: var(--adventure-parchment);
    }
    .fb__head { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 44px; margin-bottom: 4px; box-shadow: var(--px-groove); }
    .fb__head h2 { margin: 0; font: 700 15px/1.1 var(--font-game); letter-spacing: .08em; text-transform: uppercase; color: var(--adventure-beacon-text); }
    .fb__lead, .fb__ok, .fb__note, .fb__warn, .fb__hint { margin: 0; font: italic 400 14px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .fb__warn { padding: 8px 10px; background: var(--obsidian-2); box-shadow: inset 0 0 0 2px var(--gold-deep); font-style: normal; }
    .fb__hint { font-size: 12px; opacity: .8; }
    .fb__ok { font-size: 16px; color: var(--adventure-parchment); }
    .fb__name { font: 600 12px var(--font-game); letter-spacing: .08em; text-transform: uppercase; }
    .fb__types { display: flex; gap: 4px; }
    .fb__types button { flex: 1; min-height: 44px; padding: 0 6px; border: 0; cursor: pointer; font: 600 12px var(--font-game); letter-spacing: .06em; text-transform: uppercase;
      color: var(--adventure-parchment); background: var(--obsidian-2); box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .fb__types button.on { color: var(--obsidian-0); background: var(--adventure-ember); }
    .fb__field { display: grid; gap: 4px; }
    .fb__field textarea { width: 100%; box-sizing: border-box; min-height: 112px; resize: vertical; padding: 8px 10px; font: 400 16px/1.35 var(--font-lore, Georgia, serif);
      color: var(--adventure-parchment); background: var(--obsidian-2); border: 0; box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .fb__field textarea:focus-visible { outline: 2px solid var(--adventure-ember); outline-offset: 1px; }
    .fb__count { justify-self: end; font: 600 11px var(--font-game); letter-spacing: .06em; opacity: .75; }
    .fb__count--low { color: var(--adventure-ember); }
    .fb__check { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; font: 600 12px var(--font-game); letter-spacing: .06em; text-transform: uppercase; }
    .fb__check input { width: 22px; height: 22px; accent-color: var(--adventure-ember); }
    .fb__shot { width: 100%; max-height: 180px; object-fit: contain; image-rendering: pixelated; background: var(--obsidian-0); box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .fb__foot { position: sticky; bottom: 0; display: grid; gap: 6px; padding-top: 6px; background: linear-gradient(to top, var(--obsidian-1, var(--obsidian-0)) 70%, transparent); }
    .fb__send { min-height: 44px; border: 0; cursor: pointer; font: 700 13px var(--font-game); letter-spacing: .08em; text-transform: uppercase;
      color: var(--obsidian-0); background: var(--adventure-ember); }
    .fb__send:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class FeedbackSheetComponent {
  private readonly svc = inject(FeedbackService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  @Output() readonly done = new EventEmitter<void>();
  /** The world's canvas, for the screenshot (none on the title screen: the option is then not offered). */
  @Input() canvas: HTMLCanvasElement | null = null;
  @Input() context: FeedbackContext = {};

  readonly types = FEEDBACK_TYPES;
  readonly min = FEEDBACK_MIN;
  readonly max = FEEDBACK_MAX;
  type: FeedbackType = 'bug';
  message = '';
  withShot = false;
  shotUrl = '';
  shotFailed = false;
  private shot = '';
  state: 'form' | 'sent' = 'form';
  busy = false;
  note = '';

  constructor() { this.i18n.register(FEEDBACK_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
  get signedIn(): boolean { return this.svc.signedIn; }
  get canShot(): boolean { return !!this.canvas; }
  get trimmed(): number { return this.message.trim().length; }

  setType(k: FeedbackType): void { this.type = k; }
  onText(e: Event): void { this.message = (e.target as HTMLTextAreaElement).value; this.note = ''; this.cdr.markForCheck(); }

  toggleShot(e: Event): void {
    this.withShot = (e.target as HTMLInputElement).checked;
    this.shot = ''; this.shotUrl = ''; this.shotFailed = false;
    if (this.withShot) this.capture();
    this.cdr.markForCheck();
  }

  /** The canvas as a small JPEG that fits the budget (a width and quality ladder), or nothing. */
  private capture(): void {
    const src = this.canvas;
    if (!src || src.width < 2) { this.shotFailed = true; return; }
    const b64 = fitShot((width, quality) => {
      const w = Math.min(width, src.width), h = Math.max(1, Math.round(src.height * w / src.width));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      if (!g) return '';
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, w, h);
      return c.toDataURL('image/jpeg', quality);
    });
    if (b64) { this.shot = b64; this.shotUrl = `data:image/jpeg;base64,${b64}`; } else this.shotFailed = true;
  }

  private device(): FeedbackDevice {
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    return cleanDevice({
      ua: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}@${Math.round(dpr * 100) / 100}`, version: APP_VERSION.version,
      area: this.context.area ?? '', vocation: this.context.vocation ?? '', level: this.context.level ?? 0,
    });
  }

  async send(): Promise<void> {
    if (this.busy) return;
    const draft = { type: this.type, message: this.message, shot: this.withShot ? this.shot : '', device: this.device() };
    if (draftProblem(draft) === 'short' || draftProblem(draft) === 'long') { this.note = this.t('feedback.short'); this.cdr.markForCheck(); return; }
    this.busy = true; this.note = ''; this.cdr.markForCheck();
    let r: FeedbackResult = 'failed';
    try { r = await this.svc.submit(draft); } finally { this.busy = false; }
    if (r === 'sent') { this.state = 'sent'; this.message = ''; this.withShot = false; this.shot = ''; this.shotUrl = ''; }
    else if (r === 'wait') this.note = this.t('feedback.wait', { n: this.svc.secsLeft() });
    else if (r === 'signin') this.note = this.t('feedback.signin');
    else if (r === 'invalid') this.note = this.t('feedback.short');
    else this.note = this.t(r === 'refused' ? 'feedback.refused' : 'feedback.failed');
    this.cdr.markForCheck();
  }

  again(): void { this.state = 'form'; this.note = ''; this.cdr.markForCheck(); }
}
