/**
 * glim-chat.component.ts — tap Glim, and it listens (shared/glim/glim-react.ts).
 *
 * A small card beside Glim, not over the middle of the world: its face, its
 * last answer, and a few plain choices the bond has opened (What's around
 * here? / Show me the nearest find / Any tips? / Tell me a story / Let's play),
 * plus the Quiet switch. The play view answers each choice (it knows the world);
 * this card only shows and asks. Every button is 44 px or more.
 */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import { GlimIconComponent } from './glim-icon.component';
import { GLIM_ALIVE_I18N } from './glim-alive.i18n';
import type { ChatTopic } from './glim-react';
import type { GlimMood } from './glim-art';

@Component({
  selector: 'app-glim-chat',
  standalone: true,
  imports: [GlimIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="gc" role="dialog" aria-modal="false" aria-labelledby="gc-title" data-engine-ignore data-glim-chat>
      <header class="gc__head">
        <app-glim-icon class="gc__face" [mood]="mood" />
        <h2 id="gc-title">{{ t('glim.chat.title') }}</h2>
        <button type="button" class="px-x gc__close" (click)="done.emit()" [attr.aria-label]="t('glim.chat.close')"><i aria-hidden="true">&times;</i></button>
      </header>
      @if (reply) { <p class="gc__reply" role="status" aria-live="polite" data-glim-reply>{{ reply }}</p> }
      <div class="gc__choices" role="group" [attr.aria-label]="t('glim.chat.tap')">
        @for (topic of topics; track topic) {
          <button type="button" class="gc__choice" [attr.data-glim-ask]="topic" (click)="ask.emit(topic)">{{ t('glim.chat.' + topic) }}</button>
        }
      </div>
      @if (topics.length < 5) { <p class="gc__small">{{ t('glim.chat.more') }}</p> }
      <div class="gc__foot">
        <button type="button" class="gc__quiet" data-glim-quiet [attr.aria-pressed]="quiet" (click)="setQuiet.emit(!quiet)">
          {{ quiet ? t('glim.chat.quietOff') : t('glim.chat.quietOn') }}
        </button>
        @if (quiet) { <span class="gc__small">{{ t('glim.chat.quietNote') }}</span> }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .gc {
      display: grid; gap: 8px; width: 100%; box-sizing: border-box; padding: 10px 12px;
      border: 0; background: none; color: var(--adventure-parchment); text-shadow: 2px 2px 0 var(--obsidian-0);
    }
    .gc__head { display: flex; align-items: center; gap: 8px; min-height: 44px; margin-bottom: 4px; box-shadow: var(--px-groove); }
    .gc__head h2 { flex: 1; margin: 0; text-transform: uppercase; font: 700 15px/1.1 var(--font-game); letter-spacing: .08em; color: var(--adventure-beacon-text); }
    .gc__face { width: 36px; height: 30px; }
    .gc__reply { margin: 0; padding: 8px 10px; font: italic 400 15px/1.35 var(--font-lore, Georgia, serif); color: var(--adventure-dialogue); background: var(--px-cell-bg); box-shadow: var(--px-cell-rim); }
    /* MapleStory's NPC chat: the choices are a grid of pixel buttons, two across, so all of them show at once. */
    .gc__choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 2px; }
    .gc__choice, .gc__quiet {
      min-height: 44px; padding: 6px 12px; border-radius: 0; cursor: pointer; text-align: left;
      font: 600 12px var(--font-game); letter-spacing: .06em; color: var(--adventure-parchment);
      border: 0; background: var(--obsidian-2); box-shadow: var(--px-btn-rim);
    }
    .gc__choice:active, .gc__quiet:active { translate: 0 2px; }
    .gc__foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px; }
    .gc__small { margin: 0; font-size: 12px; line-height: 1.4; color: var(--adventure-dialogue); opacity: .85; }
    .gc__choice:focus-visible, .gc__quiet:focus-visible { outline: 2px solid var(--adventure-hud-gold); outline-offset: 2px; }
  `],
})
export class GlimChatComponent {
  private readonly i18n = inject(TranslationService);
  /** The choices the bond has opened (glim-react.ts chatTopics). */
  @Input() topics: readonly ChatTopic[] = [];
  /** Glim's last answer, already in the player's words. */
  @Input() reply = '';
  @Input() quiet = false;
  @Input() mood: GlimMood = 'calm';
  @Output() readonly ask = new EventEmitter<ChatTopic>();
  @Output() readonly setQuiet = new EventEmitter<boolean>();
  @Output() readonly done = new EventEmitter<void>();

  constructor() { this.i18n.register(GLIM_ALIVE_I18N); }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }
}
