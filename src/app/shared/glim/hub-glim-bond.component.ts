/**
 * hub-glim-bond.component.ts — "You and Glim", in the Character hub's Story tab.
 *
 * The bond's stage and an honest track (what it grows from; it never shrinks
 * and never asks you back), the talks it has opened (new or heard, replayable),
 * what Glim remembers of your answers, the five stages with what each opens,
 * and "The Blank Places". Only reached stages show their talks by name; a
 * later stage says what kind of thing it opens and at what bond, never the
 * words. Lazy: rides the Story tab's @defer chunk.
 */
import { Component, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import { GlimService } from './glim.service';
import {
  BLANK_PLACES, BOND_STAGES, BondStage, QuestionId, bondPoints, openTalks, questStepDone,
} from './glim-bond';
import { GLIM_BOND_I18N } from './glim-bond.i18n';
import { GlimTalkComponent } from './glim-talk.component';

const QUESTIONS: readonly QuestionId[] = ['like', 'deep', 'mark'];

@Component({
  selector: 'app-hub-glim-bond',
  standalone: true,
  imports: [GlimTalkComponent],
  template: `
    <section class="gb" [attr.data-glim-bond]="stage.n" [attr.data-glim-points]="points" aria-labelledby="gb-title">
      <header class="gb__head">
        <p class="gb__kicker">{{ t('glim.bond.kicker') }}</p>
        <h3 id="gb-title" class="gb__title">{{ t('glim.bond.title') }}</h3>
      </header>
      <div class="gb__track">
        <p class="gb__stage"><b data-glim-stage-name>{{ t(stage.name) }}</b> <small>{{ t('glim.bond.stageOf', { n: stage.n, total: stages.length }) }}</small></p>
        <div class="gb__bar" role="progressbar" [attr.aria-valuemin]="stage.at" [attr.aria-valuemax]="next?.at ?? points" [attr.aria-valuenow]="points" [attr.aria-label]="t('glim.bond.title')">
          <i [style.width.%]="progress"></i>
        </div>
        <small class="gb__count">{{ next ? t('glim.bond.points', { points: points, at: next.at }) : t('glim.bond.top') }}</small>
        <p class="gb__honest">{{ t('glim.bond.honest') }}</p>
      </div>

      <div class="gb__block">
        <h4>{{ t('glim.bond.talks') }}</h4>
        <ul class="gb__talks">
          @for (row of talks; track row.talk.id) {
            <li>
              <button type="button" class="gb__talk" [class.is-open]="open === row.talk.id" [attr.data-talk]="row.talk.id" [attr.aria-expanded]="open === row.talk.id" (click)="toggle(row.talk.id)">
                <span>{{ t('glim.talk.' + row.talk.id + '.title') }}</span>
                <small [class.is-new]="!row.heard">{{ t(row.heard ? 'glim.bond.heard' : 'glim.bond.new') }}</small>
              </button>
              @if (open === row.talk.id) { <app-glim-talk class="gb__talk-body" [talkId]="row.talk.id" (done)="open = null" /> }
            </li>
          }
        </ul>
      </div>

      <div class="gb__block">
        <h4>{{ t('glim.bond.remembers') }}</h4>
        @if (remembered.length) {
          <ul class="gb__memory">
            @for (m of remembered; track m.q) { <li [attr.data-answer]="m.q + ':' + m.a"><b>{{ t('glim.bond.q.' + m.q) }}</b> {{ t('glim.bond.a.' + m.a) }}</li> }
          </ul>
        } @else { <p class="gb__muted">{{ t('glim.bond.remembers.none') }}</p> }
      </div>

      <div class="gb__block">
        <h4>{{ t('glim.bond.stages') }}</h4>
        <ol class="gb__stages">
          @for (s of stages; track s.n) {
            <li [class.is-reached]="s.n <= stage.n" [attr.data-stage]="s.n">
              <b>{{ t(s.name) }}</b>
              @if (s.n > stage.n) { <small>{{ t('glim.bond.locked', { at: s.at }) }}</small> }
              <span class="gb__opens">
                {{ t('glim.bond.opens') }}:
                @for (id of s.talks; track id; let last = $last) { {{ s.n <= stage.n ? t('glim.talk.' + id + '.title') : t('glim.bond.aTalk') }}@if (!last) {, } }
                @if (s.ability) { · {{ t('glim.bond.ability.' + s.ability) }} }
                @if (s.quest) { · {{ t('glim.bond.questOpens') }} }
              </span>
              @if (s.ability && s.n <= stage.n) { <span class="gb__muted">{{ t('glim.bond.ability.' + s.ability + '.d') }}</span> }
            </li>
          }
        </ol>
      </div>

      <div class="gb__block" data-glim-quest>
        <h4>{{ t('glim.quest.title') }}</h4>
        @if (stage.n >= 2) {
          <ol class="gb__quest">
            @for (step of quest; track step.n) {
              <li [class.is-done]="step.done" [attr.data-quest-step]="step.n">
                <b>{{ t(step.name) }}</b>
                <small>{{ step.done ? t('glim.quest.done') : step.later ? t('glim.quest.later') : '' }}</small>
                <span>{{ t(step.goal) }}</span>
              </li>
            }
          </ol>
        } @else { <p class="gb__muted">{{ t('glim.quest.closed') }}</p> }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .gb { display: grid; gap: 14px; padding: 12px 14px; border: 1px solid var(--adventure-hud-gold); }
    .gb__kicker { margin: 0; color: var(--adventure-ember); font: 600 10px var(--font-game); letter-spacing: .16em; text-transform: uppercase; }
    .gb__title { margin: 2px 0 0; color: var(--adventure-beacon-text); font: 600 18px/1.25 var(--font-game); }
    .gb__track { display: grid; gap: 6px; }
    .gb__stage { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; margin: 0; }
    .gb__stage b { color: var(--adventure-hud-gold); font: 600 14px var(--font-game); }
    .gb__stage small, .gb__count, .gb__muted { color: var(--adventure-dialogue); font-size: 12px; line-height: 1.45; }
    .gb__bar { height: 8px; border: 1px solid var(--adventure-hud-brass); background: color-mix(in srgb, var(--adventure-hud-brass) 12.00%, transparent); }
    .gb__bar i { display: block; height: 100%; background: var(--adventure-hud-gold); }
    .gb__honest { margin: 0; color: var(--adventure-dialogue); font-style: italic; line-height: 1.45; }
    .gb__block h4 { margin: 0 0 8px; color: var(--adventure-beacon-text); font: 600 13px var(--font-game); }
    .gb__talks, .gb__memory, .gb__stages, .gb__quest { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .gb__talk {
      display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px;
      border: 1px solid var(--adventure-hud-brass); background: transparent; color: var(--adventure-parchment); font: 500 14px system-ui, sans-serif; text-align: left; cursor: pointer;
    }
    .gb__talk.is-open, .gb__talk:hover, .gb__talk:focus-visible { border-color: var(--adventure-hud-gold); outline: none; }
    .gb__talk small { color: var(--adventure-dialogue); font: 600 10px var(--font-game); letter-spacing: .1em; text-transform: uppercase; }
    .gb__talk small.is-new { color: var(--adventure-hud-gold); }
    .gb__talk-body { margin-top: 8px; padding: 10px 12px; border-left: 2px solid var(--adventure-hud-gold); }
    .gb__memory li { color: var(--adventure-parchment); }
    .gb__memory b { margin-right: 6px; color: var(--adventure-dialogue); font-weight: 500; }
    .gb__stages li, .gb__quest li { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid color-mix(in srgb, var(--adventure-hud-brass) 35.00%, transparent); }
    .gb__stages li.is-reached, .gb__quest li.is-done { border-left-color: var(--adventure-hud-gold); }
    .gb__stages b, .gb__quest b { color: var(--adventure-parchment); }
    .gb__stages li:not(.is-reached) b { color: var(--adventure-dialogue); }
    .gb__opens, .gb__quest span { color: var(--adventure-dialogue); line-height: 1.45; }
    .gb__stages small, .gb__quest small { color: var(--adventure-hud-gold); font-size: 12px; }
  `],
})
export class HubGlimBondComponent {
  private readonly glim = inject(GlimService);
  private readonly i18n = inject(TranslationService);
  readonly stages = BOND_STAGES;
  /** The talk open inline (one at a time). */
  open: string | null = null;

  constructor() {
    this.i18n.register(GLIM_BOND_I18N);
  }

  get points(): number { return bondPoints(this.glim.state.moments); }
  get stage(): BondStage { return this.glim.stage; }
  get next(): BondStage | null { return BOND_STAGES.find(s => s.n === this.stage.n + 1) ?? null; }
  get progress(): number {
    const next = this.next;
    if (!next) return 100;
    return Math.max(0, Math.min(100, ((this.points - this.stage.at) / (next.at - this.stage.at)) * 100));
  }
  get talks() { return openTalks(this.stage, this.glim.state.moments); }
  get remembered(): { q: QuestionId; a: string }[] {
    const answers = this.glim.state.answers;
    return QUESTIONS.filter(q => answers[q]).map(q => ({ q, a: answers[q]!.a }));
  }
  get quest(): { n: number; name: string; goal: string; done: boolean; later: boolean }[] {
    const moments = this.glim.state.moments;
    return BLANK_PLACES.map(step => ({ ...step, done: questStepDone(step, moments), later: !step.needs.length }));
  }

  toggle(id: string): void { this.open = this.open === id ? null : id; }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
