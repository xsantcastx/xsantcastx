/**
 * story-scene.component.ts — one Act II scene (story.ts STORY_SCENES).
 *
 * The people of that realm speak one line at a time, each with their chibi
 * pixel portrait (keeper-look/npc-portrait.ts: the same figure that stands in
 * their town, or Glim's moth), Glim has the last word, then the one reward is
 * named with what it is for. "Take it" files the scene (StoryService.playScene:
 * receipt first, then the reward) and emits `done`. Skip jumps to the reward;
 * a host that closes the scene early also plays it, so a reward is never lost.
 *
 * Used in a card over the world in /play and inline in the Story tab (where a
 * scene already played can be seen again, without paying twice). Words: the
 * lazy story table, EN + ES.
 */
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslationService } from '../../translation.service';
import { npcPortrait } from '../keeper-look/npc-portrait';
import { StoryService } from './story.service';
import { STORY_I18N } from './story.i18n';
import { STORY_PORTRAIT, StoryReward, StoryScene, StorySpeaker, sceneById, sceneLines } from './story';
import type { StorySceneId } from './story-save.model';

interface SceneLine { speaker: StorySpeaker; key: string; portrait: string | null }

@Component({
  selector: 'app-story-scene',
  standalone: true,
  template: `
    @if (scene; as sc) {
      <section class="ss" [attr.data-story-scene]="sc.id" [attr.data-scene-step]="step" [attr.aria-labelledby]="'ss-title-' + slug">
        <p class="ss__kicker">{{ t('story.scene.kicker') }}</p>
        <h2 class="ss__title" [id]="'ss-title-' + slug">{{ t('story.beat.' + sc.id + '.title') }}</h2>
        @if (step < lines.length) {
          @if (lines[step]; as line) {
            <div class="ss__line" [attr.data-scene-speaker]="line.speaker" aria-live="polite">
              <i class="ss__face" [class.ss__face--glim]="line.speaker === 'glim'" aria-hidden="true">
                @if (line.portrait) { <img [src]="line.portrait" alt="" width="60" height="60" /> }
              </i>
              <p class="ss__say">
                <b>{{ t('story.who.' + line.speaker) }}</b>
                <span>{{ t(line.key) }}</span>
              </p>
            </div>
          }
          <div class="ss__row">
            <small class="ss__count">{{ t('story.scene.step', { n: step + 1, total: lines.length }) }}</small>
            <button type="button" class="ss__btn ss__btn--quiet" (click)="skip()">{{ t('story.scene.skip') }}</button>
            <button type="button" class="ss__btn ss__go" (click)="next()">{{ t('story.scene.next') }}</button>
          </div>
        } @else {
          <div class="ss__reward" [attr.data-scene-reward]="sc.reward.kind" aria-live="polite">
            <b class="ss__gives">{{ t(played ? 'story.scene.kept' : 'story.scene.gives') }}</b>
            <p class="ss__prize">{{ rewardName(sc.reward) }}</p>
            <p class="ss__use">{{ rewardUse(sc.reward) }}</p>
          </div>
          <div class="ss__row">
            <button type="button" class="ss__btn ss__go" (click)="finish()">{{ t('story.scene.take') }}</button>
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .ss { display: grid; gap: 12px; }
    .ss__kicker { margin: 0; color: var(--adventure-ember); font: 600 10px var(--font-game); letter-spacing: .16em; text-transform: uppercase; }
    .ss__title { margin: 0; padding-bottom: 10px; border-bottom: 2px dashed color-mix(in srgb, var(--adventure-hud-brass) 55.00%, transparent); color: var(--adventure-beacon-text); font: 600 18px/1.25 var(--font-game); }
    .ss__line { display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: start; min-height: 72px; }
    .ss__face {
      display: grid; place-items: end center; width: 64px; height: 64px; overflow: hidden;
      border: 2px solid var(--adventure-hud-brass); background: color-mix(in srgb, var(--adventure-hud-ink) 70.00%, transparent);
      box-shadow: 0 0 0 2px var(--adventure-hud-ink);
    }
    .ss__face--glim { place-items: center; border-color: var(--adventure-hud-gold); }
    .ss__face img { width: 60px; height: 60px; image-rendering: pixelated; object-fit: contain; object-position: 50% 100%; }
    .ss__say { margin: 0; display: grid; gap: 4px; }
    .ss__say b { color: var(--adventure-hud-gold); font: 600 11px var(--font-game); letter-spacing: .1em; text-transform: uppercase; }
    .ss__say span { color: var(--adventure-parchment); font-size: 15px; line-height: 1.55; }
    .ss__row { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .ss__count { margin-right: auto; color: var(--adventure-dialogue); font-size: 12px; }
    .ss__btn {
      min-height: 44px; min-width: 44px; padding: 0 18px; border: 1px solid var(--adventure-hud-brass);
      background: color-mix(in srgb, var(--adventure-hud-brass) 12.00%, transparent); color: var(--adventure-parchment);
      font: 600 12px var(--font-game); letter-spacing: .08em; cursor: pointer;
    }
    .ss__btn--quiet { border-color: transparent; background: transparent; color: var(--adventure-dialogue); }
    .ss__go { border-color: var(--adventure-ember); }
    .ss__btn:hover, .ss__btn:focus-visible { border-color: var(--adventure-hud-gold); outline: none; background: color-mix(in srgb, var(--adventure-hud-gold) 16.00%, transparent); }
    .ss__reward { padding: 12px 14px; border: 1px solid var(--adventure-hud-gold); background: color-mix(in srgb, var(--adventure-hud-gold) 10.00%, transparent); }
    .ss__gives { color: var(--adventure-ember); font: 600 10px var(--font-game); letter-spacing: .14em; text-transform: uppercase; }
    .ss__prize { margin: 4px 0 2px; color: var(--adventure-beacon-text); font: 600 16px/1.3 var(--font-game); }
    .ss__use { margin: 0; color: var(--adventure-dialogue); line-height: 1.45; }
    @media (max-width: 520px) {
      .ss__line { grid-template-columns: 48px 1fr; gap: 10px; }
      .ss__face { width: 48px; height: 48px; }
      .ss__face img { width: 44px; height: 44px; }
      .ss__say span { font-size: 14px; line-height: 1.5; }
      .ss__title { font-size: 16px; }
    }
  `],
})
export class StorySceneComponent {
  private readonly story = inject(StoryService);
  private readonly i18n = inject(TranslationService);
  @Output() readonly done = new EventEmitter<StoryReward | null>();
  scene: StoryScene | null = null;
  lines: SceneLine[] = [];
  step = 0;
  /** Played before this showing: the reward is "already yours". */
  played = false;

  @Input() set sceneId(id: StorySceneId | null) {
    const next = id ? sceneById(id) ?? null : null;
    if (next?.id === this.scene?.id) return;
    this.scene = next;
    this.step = 0;
    this.played = !!next && this.story.state.scenes.includes(next.id);
    this.lines = next ? sceneLines(next).map(l => ({ ...l, portrait: npcPortrait(STORY_PORTRAIT[l.speaker]) })) : [];
  }

  constructor() {
    this.i18n.register(STORY_I18N);
  }

  get slug(): string { return (this.scene?.id ?? '').replace('.', '-'); }

  next(): void { if (this.step < this.lines.length) this.step++; }
  skip(): void { this.step = this.lines.length; }

  /** Take it: the scene is filed (reward paid once) and the host closes it. */
  finish(): void {
    const scene = this.scene;
    if (!scene) return;
    this.done.emit(this.story.playScene(scene.id));
  }

  rewardName(r: StoryReward): string {
    if (r.kind === 'title') return this.t('story.reward.title', { name: this.t(`story.reward.name.${r.variant}`) });
    if (r.kind === 'stack') return this.t('story.reward.stack', { qty: r.qty, name: this.t(`story.reward.name.${r.item}`) });
    return this.t('story.reward.codex');
  }

  rewardUse(r: StoryReward): string {
    if (r.kind === 'title') return this.t('story.reward.title.use');
    if (r.kind === 'stack') return this.t(`story.reward.use.${r.item}`);
    return this.t('story.reward.codex.use');
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
