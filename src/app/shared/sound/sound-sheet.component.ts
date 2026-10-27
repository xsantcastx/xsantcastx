/**
 * sound-sheet.component.ts — Menu → Sound: three sliders and a mute.
 *
 * One plain screen (the station rule: nothing to learn). Every move is saved at
 * once through SoundService (the save gateway), so it is the same on the
 * player's other devices. Sliders are native range inputs: keyboard, screen
 * readers and a thumb all work, and each row is 44px tall on a phone. The Hush and
 * Night darkness (Full / Softer) sit here too: both are how the dark is felt.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { SoundService } from './sound.service';
import { CHAT_SETTINGS, HUSH_SETTINGS, INVITE_SETTINGS, NIGHT_SETTINGS, PRESENCE_SETTINGS, SOUND_CHANNELS, type ChatSetting, type HushSetting, type InviteSetting, type NightSetting, type PresenceSetting, type SoundChannel, type SoundSettings } from './sound-settings.model';
import { SOUND_I18N } from './sound.i18n';
import { ENV_DETAILS, envDetail, onEnvDetail, setEnvDetail, type EnvDetail } from '../../play/td/td-detail';
import { GRAPHICS, graphics, onGraphics, setGraphics, type Graphics } from '../../play/td/td-artopt';
import { WEATHER_SHOWS, WEATHER_SHOW_KEY, type WeatherShow } from '../weather/weather-show';

function readWeatherShow(): WeatherShow {
  try { const v = localStorage.getItem(WEATHER_SHOW_KEY); return (WEATHER_SHOWS as readonly string[]).includes(v ?? '') ? v as WeatherShow : 'full'; } catch { return 'full'; }
}

@Component({
  selector: 'app-sound-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ss" role="dialog" aria-modal="false" aria-labelledby="ss-title" data-engine-ignore [attr.data-sound-status]="status">
      <header class="ss__head">
        <h2 id="ss-title">{{ t('play.sound.title') }}</h2>
        <button type="button" class="px-help ss__help" [attr.aria-expanded]="help" [attr.aria-label]="t('play.sound.help')" (click)="help = !help"><i aria-hidden="true">?</i></button>
        <button type="button" class="px-x ss__done" (click)="done.emit()" [attr.aria-label]="t('play.sound.close')"><i aria-hidden="true">&times;</i></button>
      </header>
      @if (help) {
        <div class="ss__helpcard" role="note">
          <p class="ss__lead">{{ t('play.sound.lead') }}</p>
          <p class="ss__saved">{{ t('play.sound.saved') }}</p>
        </div>
      }
      @for (ch of channels; track ch) {
        <label class="ss__row" [class.ss__row--off]="s.muted">
          <span class="ss__name">{{ t('play.sound.' + ch) }}</span>
          <input type="range" min="0" max="100" step="5" [attr.data-channel]="ch" [value]="pct(ch)"
                 [attr.aria-valuetext]="pct(ch) + '%'" (input)="move(ch, $event)">
          <b class="ss__val">{{ pct(ch) }}%</b>
        </label>
      }
      <!-- The Hush (play/td/td-dark.ts): how deep the dread may run. Its omens are sound and sight only. -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.hush')">
        <span class="ss__name">{{ t('play.sound.hush') }}</span>
        <span class="ss__seg">
          @for (h of hushes; track h) {
            <button type="button" role="radio" [attr.aria-checked]="s.hush === h" [class.on]="s.hush === h" [attr.data-hush-cap]="h" (click)="setHush(h)">{{ t('play.sound.hush.' + h) }}</button>
          }
        </span>
        <small class="ss__hushline">{{ t('play.sound.hush.' + s.hush + '.line') }}</small>
      </div>
      <!-- Night darkness (play/td/td-night.ts): an accessibility choice, saved with the Hush. -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.night')">
        <span class="ss__name">{{ t('play.sound.night') }}</span>
        <span class="ss__seg">
          @for (n of nights; track n) {
            <button type="button" role="radio" [attr.aria-checked]="s.night === n" [class.on]="s.night === n" [attr.data-night-setting]="n" (click)="setNight(n)">{{ t('play.sound.night.' + n) }}</button>
          }
        </span>
        <small class="ss__hushline">{{ t('play.sound.night.' + s.night + '.line') }}</small>
      </div>
      <!-- Graphics (play/td/td-artopt.ts): Classic or the Isometric Beta, this device's choice, not synced. -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.graphics')">
        <span class="ss__name">{{ t('play.sound.graphics') }}</span>
        <span class="ss__seg">
          @for (g of graphicsAll; track g) {
            <button type="button" role="radio" [attr.aria-checked]="graphics === g" [class.on]="graphics === g" [attr.data-graphics-setting]="g" (click)="setGraphics(g)">{{ t('play.sound.graphics.' + g) }}</button>
          }
        </span>
        <small class="ss__hushline">{{ t('play.sound.graphics.' + graphics + '.line') }}</small>
      </div>
      <!-- Environment detail (play/td/td-detail.ts): this device's choice, not synced — the characters keep their look on both. -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.detail')">
        <span class="ss__name">{{ t('play.sound.detail') }}</span>
        <span class="ss__seg">
          @for (d of details; track d) {
            <button type="button" role="radio" [attr.aria-checked]="detail === d" [class.on]="detail === d" [attr.data-detail-setting]="d" (click)="setDetail(d)">{{ t('play.sound.detail.' + d) }}</button>
          }
        </span>
        <small class="ss__hushline">{{ t('play.sound.detail.' + detail + '.line') }}</small>
      </div>
      <!-- Weather v1 (shared/weather): this device's choice; the rules stay on every setting (reduced motion reads as soft). -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('weather.setting')">
        <span class="ss__name">{{ t('weather.setting') }}</span>
        <span class="ss__seg">
          @for (w of weathers; track w) {
            <button type="button" role="radio" [attr.aria-checked]="weather === w" [class.on]="weather === w" [attr.data-weather-setting]="w" (click)="setWeather(w)">{{ t('weather.setting.' + w) }}</button>
          }
        </span>
      </div>
      <!-- The Hearth chat: always connected, or ignored (no joining, no unread count). Saved with the rest. -->
      <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.chat')">
        <span class="ss__name">{{ t('play.sound.chat') }}</span>
        <span class="ss__seg">
          @for (c of chats; track c) {
            <button type="button" role="radio" [attr.aria-checked]="s.chat === c" [class.on]="s.chat === c" [attr.data-chat-setting]="c" (click)="setChat(c)">{{ t('play.sound.chat.' + c) }}</button>
          }
        </span>
        <small class="ss__hushline">{{ t('play.sound.chat.' + s.chat + '.line') }}</small>
      </div>
      <!-- Privacy at the Hearth (protocol 4): appear offline to friends; party invites from friends only. -->
      @if (s.chat === 'on') {
        <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.presence')">
          <span class="ss__name">{{ t('play.sound.presence') }}</span>
          <span class="ss__seg">
            @for (p of presences; track p) {
              <button type="button" role="radio" [attr.aria-checked]="s.presence === p" [class.on]="s.presence === p" [attr.data-presence-setting]="p" (click)="setPresence(p)">{{ t('play.sound.presence.' + p) }}</button>
            }
          </span>
          <small class="ss__hushline">{{ t('play.sound.presence.' + s.presence + '.line') }}</small>
        </div>
        <div class="ss__hush" role="radiogroup" [attr.aria-label]="t('play.sound.invites')">
          <span class="ss__name">{{ t('play.sound.invites') }}</span>
          <span class="ss__seg">
            @for (i of inviteChoices; track i) {
              <button type="button" role="radio" [attr.aria-checked]="s.invites === i" [class.on]="s.invites === i" [attr.data-invites-setting]="i" (click)="setInvites(i)">{{ t('play.sound.invites.' + i) }}</button>
            }
          </span>
          <small class="ss__hushline">{{ t('play.sound.invites.' + s.invites + '.line') }}</small>
        </div>
      }
      <label class="ss__mute">
        <input type="checkbox" [checked]="s.muted" (change)="mute($event)" data-sound-mute>
        <span>{{ t('play.sound.mute') }}</span>
      </label>
      <p class="ss__note" role="status">{{ statusLine }}</p>
      <!-- The host's own settings (the play view: Reset HUD layout, on a computer). -->
      <ng-content />
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ss {
      display: grid; align-content: start; gap: 10px; width: 100%; box-sizing: border-box; min-height: 100%;
      padding: 8px 12px calc(12px + var(--sheet-pad-b, 0px));
      border: 0; background: none; color: var(--adventure-parchment);
    }
    .ss__head h2 { flex: 1; text-transform: uppercase; text-shadow: 2px 2px 0 var(--obsidian-0); }
    .ss__helpcard { display: grid; gap: 6px; padding: 10px 12px; background: var(--obsidian-2); box-shadow: 0 -2px 0 0 var(--gold-deep), 0 2px 0 0 var(--gold-deep), -2px 0 0 0 var(--gold-deep), 2px 0 0 0 var(--gold-deep); }
    .ss__head { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 44px; margin-bottom: 4px; box-shadow: var(--px-groove); }
    .ss__head h2 { margin: 0; font: 700 16px/1.1 var(--font-pixel); letter-spacing: 0; color: var(--adventure-beacon-text); }
    .ss__lead, .ss__note, .ss__saved { margin: 0; font: italic 400 15px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); }
    .ss__saved { font-size: 13px; opacity: .75; }
    .ss__row { display: grid; grid-template-columns: 88px 1fr 44px; align-items: center; gap: 10px; min-height: 44px; }
    .ss__row--off { opacity: .5; }
    .ss__name { font: 600 13px/1.2 var(--cozy-font-read); letter-spacing: 0; }
    .ss__val { font: 600 13px var(--cozy-font-read); text-align: right; color: var(--adventure-ember); }
    .ss__row input { width: 100%; min-height: 44px; margin: 0; accent-color: var(--adventure-ember); cursor: pointer; }
    .ss__mute { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; font: 600 13px var(--cozy-font-read); letter-spacing: 0; }
    .ss__hush { display: grid; grid-template-columns: 88px 1fr; align-items: center; gap: 4px 10px; }
    .ss__seg { display: flex; gap: 4px; }
    .ss__seg button { flex: 1; min-height: 44px; padding: 0 6px; border: 0; cursor: pointer; font: 600 13px/1.15 var(--font-pixel); letter-spacing: 0;
      color: var(--adventure-parchment); background: var(--obsidian-2); box-shadow: inset 0 0 0 2px var(--gold-deep); }
    .ss__seg button.on { color: var(--obsidian-0); background: var(--adventure-ember); }
    .ss__hushline { grid-column: 2; font: 400 12px/1.35 var(--cozy-font-read); color: color-mix(in srgb, var(--cozy-cream) 82%, transparent); }
    .ss__mute input { width: 22px; height: 22px; accent-color: var(--adventure-ember); }
  `],
})
export class SoundSheetComponent implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();
  @Output() readonly done = new EventEmitter<void>();
  readonly channels = SOUND_CHANNELS;
  readonly hushes = HUSH_SETTINGS;
  readonly nights = NIGHT_SETTINGS;
  readonly chats = CHAT_SETTINGS;
  readonly details = ENV_DETAILS;
  detail: EnvDetail = envDetail();
  readonly graphicsAll = GRAPHICS;
  graphics: Graphics = graphics();
  readonly weathers = WEATHER_SHOWS;
  weather: WeatherShow = readWeatherShow();
  readonly presences = PRESENCE_SETTINGS;
  readonly inviteChoices = INVITE_SETTINGS;
  s: SoundSettings = this.sound.settings;
  status = this.sound.status;
  /** The question mark: the sentences that used to sit on screen. */
  help = false;

  constructor() {
    this.i18n.register(SOUND_I18N);
    this.subs.add(this.sound.settings$.subscribe(s => { this.s = s; this.cdr.markForCheck(); }));
    const off = onEnvDetail(d => { this.detail = d; this.cdr.markForCheck(); });
    this.subs.add(() => off());
    const offG = onGraphics(g => { this.graphics = g; this.cdr.markForCheck(); });
    this.subs.add(() => offG());
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

  setHush(h: HushSetting): void { this.sound.setHush(h); this.sound.sfx('tap'); }

  setNight(n: NightSetting): void { this.sound.setNight(n); this.sound.sfx('tap'); }

  setDetail(d: EnvDetail): void { setEnvDetail(d); this.detail = d; this.sound.sfx('tap'); }
  setGraphics(g: Graphics): void { setGraphics(g); this.graphics = g; this.sound.sfx('tap'); }
  /** Weather: full, soft or off (plain localStorage, a device preference like Environment detail; the play view reads it each second). */
  setWeather(w: WeatherShow): void { try { localStorage.setItem(WEATHER_SHOW_KEY, w); } catch { /* private mode */ } this.weather = w; this.sound.sfx('tap'); }
  setChat(c: ChatSetting): void { this.sound.setChat(c); this.sound.sfx('tap'); }

  setPresence(p: PresenceSetting): void { this.sound.setPresence(p); this.sound.sfx('tap'); }

  setInvites(i: InviteSetting): void { this.sound.setInvites(i); this.sound.sfx('tap'); }

  mute(event: Event): void {
    this.sound.setMuted((event.target as HTMLInputElement).checked);
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.translate(key, params); }

  ngOnDestroy(): void { this.subs.unsubscribe(); }
}
