/**
 * glim-talk.component.ts — one talk with Glim (glim-bond.ts GLIM_TALKS).
 *
 * Glim tells (three short paragraphs at most), the Keeper picks one of two to
 * four replies, Glim answers that reply. When Glim asked a question, the
 * reply is remembered (GlimService.answer: through the save gateway) and
 * colours its later lines. Choosing a reply is hearing the talk to the end:
 * that files the `talk:<id>` moment once. Used inline in the Story tab and in a
 * small card in the play view.
 */
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import { GlimService } from './glim.service';
import { GlimTalk, TalkChoice, talkById } from './glim-bond';
import { GLIM_BOND_I18N } from './glim-bond.i18n';
import { GlimIconComponent } from './glim-icon.component';

@Component({
  selector: 'app-glim-talk',
  standalone: true,
  imports: [GlimIconComponent],
  template: `
    @if (talk; as tk) {
      <section class="gt" [attr.data-glim-talk]="tk.id" [attr.data-glim-talk-phase]="chosen ? 'reply' : 'tell'" [attr.aria-labelledby]="'gt-title-' + tk.id">
        <header class="gt__head">
          <app-glim-icon class="gt__icon" />
          <div>
            <p class="gt__kicker">{{ t('glim.talk.kicker') }}</p>
            <h3 class="gt__title" [id]="'gt-title-' + tk.id">{{ t('glim.talk.' + tk.id + '.title') }}</h3>
          </div>
        </header>
        @if (!chosen) {
          @for (line of tk.lines; track line) { <p class="gt__p">{{ t(line) }}</p> }
          <div class="gt__choices" role="group" [attr.aria-label]="t('glim.talk.you')">
            @for (c of tk.choices; track c.id) {
              <button type="button" class="gt__choice" [attr.data-choice]="c.id" (click)="choose(c)">{{ t(c.key) }}</button>
            }
          </div>
        } @else {
          <p class="gt__you"><b>{{ t('glim.talk.you') }}</b> {{ t(chosen.key) }}</p>
          <p class="gt__p gt__reply" data-glim-reply>{{ t(chosen.reply) }}</p>
          <button type="button" class="gt__done" (click)="done.emit()">{{ t('glim.talk.done') }}</button>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .gt { display: grid; gap: 10px; }
    .gt__head { display: flex; align-items: center; gap: 10px; }
    .gt__icon { flex: none; width: 36px; height: 30px; }
    .gt__kicker { margin: 0; color: var(--adventure-ember); font: 600 10px Orbitron, sans-serif; letter-spacing: .16em; text-transform: uppercase; }
    .gt__title { margin: 2px 0 0; color: var(--adventure-beacon-text); font: 600 16px/1.25 Orbitron, sans-serif; }
    .gt__p { margin: 0; color: var(--adventure-parchment); line-height: 1.5; }
    .gt__reply { padding-left: 10px; border-left: 2px solid var(--adventure-hud-gold); }
    .gt__you { margin: 0; color: var(--adventure-dialogue); font-style: italic; line-height: 1.45; }
    .gt__you b { margin-right: 4px; color: var(--adventure-hud-gold); font: 600 10px Orbitron, sans-serif; font-style: normal; letter-spacing: .12em; text-transform: uppercase; }
    .gt__choices { display: grid; gap: 8px; margin-top: 4px; }
    .gt__choice, .gt__done {
      min-height: 44px; padding: 8px 12px; border: 1px solid var(--adventure-hud-brass); background: color-mix(in srgb, var(--adventure-hud-brass) 12.00%, transparent);
      color: var(--adventure-parchment); font: 500 14px/1.35 system-ui, sans-serif; text-align: left; cursor: pointer;
    }
    .gt__choice:hover, .gt__choice:focus-visible, .gt__done:hover, .gt__done:focus-visible { border-color: var(--adventure-hud-gold); outline: none; background: color-mix(in srgb, var(--adventure-hud-gold) 16.00%, transparent); }
    .gt__done { justify-self: end; text-align: center; font-family: Orbitron, sans-serif; font-size: 12px; letter-spacing: .08em; }
  `],
})
export class GlimTalkComponent {
  private readonly glim = inject(GlimService);
  private readonly i18n = inject(TranslationService);
  @Output() readonly done = new EventEmitter<void>();
  talk: GlimTalk | null = null;
  chosen: TalkChoice | null = null;

  @Input() set talkId(id: string | null) {
    const next = id ? talkById(id) : null;
    if (next?.id !== this.talk?.id) this.chosen = null;
    this.talk = next;
  }

  constructor() {
    this.i18n.register(GLIM_BOND_I18N);
  }

  choose(c: TalkChoice): void {
    const talk = this.talk;
    if (!talk || this.chosen) return;
    this.chosen = c;
    if (talk.question) this.glim.answer(talk.question, c.id);
    this.glim.addMoments([`talk:${talk.id}`]);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
