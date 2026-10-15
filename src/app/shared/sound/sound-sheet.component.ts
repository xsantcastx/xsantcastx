/**
 * sound-sheet.component.ts — Menu → Sound: three sliders and a mute.
 *
 * One plain screen (the station rule: nothing to learn). Every move is saved at
 * once through SoundService (the save gateway), so it is the same on the
 * player's other devices. Sliders are native range inputs: keyboard, screen
 * readers and a thumb all work, and each row is 44px tall on a phone.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { SoundService } from './sound.service';
import { SOUND_CHANNELS, type SoundChannel, type SoundSettings } from './sound-settings.model';
import { SOUND_I18N } from './sound.i18n';

@Component({
  selector: 'app-sound-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ss" role="dialog" aria-modal="false" aria-labelledby="ss-title" data-engine-ignore [attr.data-sound-status]="status">
      <header class="ss__head">
        <h2 id="ss-title">{{ t('play.sound.title') }}</h2>
        <button type="button" class="ss__done" (click)="done.emit()" [attr.aria-label]="t('play.sound.close')"><i aria-hidden="true">&times;</i></button>
      </header>
      <p class="ss__lead">{{ t('play.sound.lead') }}</p>
      @for (ch of channels; track ch) {
        <label class="ss__row" [class.ss__row--off]="s.muted">
          <span class="ss__name">{{ t('play.sound.' + ch) }}</span>
          <input type="range" min="0" max="100" step="5" [attr.data-channel]="ch" [value]="pct(ch)"
                 [attr.aria-valuetext]="pct(ch) + '%'" (input)="move(ch, $event)">
          <b class="ss__val">{{ pct(ch) }}%</b>
        </label>
      }
      <label class="ss__mute">
        <input type="checkbox" [checked]="s.muted" (change)="mute($event)" data-sound-mute>
        <span>{{ t('play.sound.mute') }}</span>
      </label>
      <p class="ss__note" role="status">{{ statusLine }}</p>
      <p class="ss__saved">{{ t('play.sound.saved') }}</p>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ss {
      display: grid; align-content: start; gap: 10px; width: 100%; box-sizing: border-box; min-height: 100%;
      padding: 14px 16px calc(12px + var(--sheet-pad-b, 0px));
      border: 1px solid var(--adventure-hud-shadow); border-left: 2px solid var(--adventure-ember); border-radius: 2px;
      background: var(--adventure-hud-panel-solid); color: var(--adventure-parchment);
      box-shadow: 0 14px 32px color-mix(in srgb, var(--adventure-hud-shadow) 53%, transparent);
    }
    .ss__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ss__head h2 { margin: 0; font: 600 16px Orbitron, sans-serif; letter-spacing: .06em; color: var(--adventure-beacon-text); }
    .ss__lead, .ss__note, .ss__saved { margin: 0; font: italic 400 15px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .ss__saved { font-size: 13px; opacity: .75; }
    .ss__row { display: grid; grid-template-columns: 88px 1fr 44px; align-items: center; gap: 10px; min-height: 44px; }
    .ss__row--off { opacity: .5; }
    .ss__name { font: 600 12px Orbitron, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .ss__val { font: 600 12px Orbitron, sans-serif; text-align: right; color: var(--adventure-ember); }
    .ss__row input { width: 100%; min-height: 44px; margin: 0; accent-color: var(--adventure-ember); cursor: pointer; }
    .ss__mute { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; font: 600 12px Orbitron, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .ss__mute input { width: 22px; height: 22px; accent-color: var(--adventure-ember); }
    /* The window's one close (the same × as every in-world menu, side-scroller .win-x). */
    .ss__done {
      display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: 2px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 26%, transparent); background: none;
      color: var(--adventure-dialogue); font: 400 30px/1 var(--font-lore, Georgia, serif);
    }
    .ss__done i { font-style: normal; translate: 0 -2px; }
    .ss__done:hover, .ss__done:focus-visible { border-color: var(--adventure-hud-gold); outline: none; }
  `],
})
export class SoundSheetComponent implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  @Output() readonly done = new EventEmitter<void>();
  readonly channels = SOUND_CHANNELS;
  s: SoundSettings = this.sound.settings;
  status = this.sound.status;

  constructor() {
    this.i18n.register(SOUND_I18N);
    this.subs.add(this.sound.settings$.subscribe(s => { this.s = s; this.cdr.markForCheck(); }));
    this.subs.add(this.sound.status$.subscribe(st => { this.status = st; this.cdr.markForCheck(); }));
  }

  get statusLine(): string {
    if (this.s.muted) return this.t('play.sound.muted');
    return this.t(this.status === 'unsupported' ? 'play.sound.unsupported' : this.status === 'live' ? 'play.sound.live' : 'play.sound.waiting');
  }

  pct(ch: SoundChannel): number { return Math.round(this.s[ch] * 100); }

  move(ch: SoundChannel, event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.sound.setLevel(ch, v / 100);
    // A little tick at the new effects level, so the slider is heard as it moves.
    if (ch === 'effects') this.sound.sfx('tap');
  }

  mute(event: Event): void {
    this.sound.setMuted((event.target as HTMLInputElement).checked);
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
