/**
 * hub-story.component.ts — the Character hub's Story tab: "The Keeper's Record".
 *
 * The current chapter, one next lead, and every chapter reached with the beats
 * found in it (story.ts journalView). An unreached beat never shows its title
 * or its words here — only the count says there is more to find. Text is the
 * lazy story table (EN + ES); the hub loads this tab with @defer, so none of it
 * rides the shell's initial bundle.
 */
import { Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { StoryService } from './story.service';
import { JournalView, journalView } from './story';
import { STORY_I18N } from './story.i18n';
import { GlimService } from '../glim/glim.service';
import { HubGlimBondComponent } from '../glim/hub-glim-bond.component';
import { StorySceneComponent } from './story-scene.component';
import type { StorySceneId } from './story-save.model';

@Component({
  selector: 'app-hub-story',
  standalone: true,
  imports: [HubGlimBondComponent, StorySceneComponent],
  template: `
    <section class="hs" [attr.data-story-chapter]="view.chapter" aria-labelledby="hs-title">
      <header class="hs__head">
        <p class="hs__kicker">{{ t('story.journal.kicker') }}</p>
        <h3 id="hs-title" class="hs__title">{{ t(view.title) }}</h3>
      </header>
      <!-- An Act II scene, played here: one owed (its reward lands at the end), or one seen again (it pays nothing twice). -->
      @if (playing) {
        <div class="hs__scene">
          <app-story-scene [sceneId]="playing" (done)="playing = null" />
        </div>
      }
      <div class="hs__lead" role="note">
        <b>{{ t('story.journal.lead') }}</b>
        <p data-story-lead>{{ t(view.lead) }}</p>
      </div>
      @for (chapter of view.chapters; track chapter.id) {
        <article class="hs__chapter" [class.is-now]="chapter.current" [attr.data-chapter]="chapter.id">
          <h4>
            {{ t(chapter.title) }}
            @if (chapter.total) { <small>{{ t('story.journal.found', { n: chapter.found, total: chapter.total }) }}</small> }
            @else { <small>{{ t('story.journal.coming') }}</small> }
          </h4>
          @for (line of chapter.intro; track line) { <p class="hs__intro">{{ t(line) }}</p> }
          @if (chapter.beats.length) {
            <ol class="hs__beats">
              @for (beat of chapter.beats; track beat.id) {
                <li [attr.data-beat]="beat.id" [attr.data-scene]="beat.scene">
                  <b>{{ t(beat.title) }}</b><span>{{ t(beat.text) }}</span>
                  @if (beat.scene) {
                    <button type="button" class="hs__play" [class.hs__play--new]="beat.scene === 'new'" [attr.data-play-scene]="beat.id" (click)="play(beat.id)">
                      {{ t(beat.scene === 'new' ? 'story.scene.play' : 'story.scene.replay') }}@if (beat.scene === 'new') { <small> · {{ t('story.scene.new') }}</small> }
                    </button>
                  }
                </li>
              }
            </ol>
          }
        </article>
      }
      <!-- The bond with Glim (shared/glim/glim-bond.ts), once the two of you have met. -->
      @if (glimMet) { <app-hub-glim-bond /> }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .hs { display: grid; gap: 14px; }
    .hs__kicker { margin: 0; color: var(--adventure-ember); font: 600 10px var(--font-game); letter-spacing: .16em; text-transform: uppercase; }
    .hs__title { margin: 2px 0 0; color: var(--adventure-beacon-text); font: 600 18px/1.25 var(--font-game); }
    .hs__lead { padding: 10px 12px; border: 1px solid var(--adventure-ember); background: color-mix(in srgb, var(--adventure-ember) 10.00%, transparent); }
    .hs__lead b { color: var(--adventure-hud-gold); font: 600 10px var(--font-game); letter-spacing: .12em; text-transform: uppercase; }
    .hs__lead p { margin: 4px 0 0; color: var(--adventure-parchment); line-height: 1.45; }
    .hs__chapter { padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 35.00%, transparent); }
    .hs__chapter.is-now { border-color: var(--adventure-hud-brass); }
    .hs__chapter h4 { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; margin: 0 0 8px; color: var(--adventure-beacon-text); font: 600 13px var(--font-game); }
    .hs__chapter small { color: var(--adventure-dialogue); font: 400 12px system-ui, sans-serif; }
    .hs__intro { margin: 0 0 8px; color: var(--adventure-dialogue); font-style: italic; line-height: 1.5; }
    .hs__beats { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .hs__beats li { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid var(--adventure-ember); }
    .hs__beats b { color: var(--adventure-parchment); }
    .hs__beats span { color: var(--adventure-dialogue); line-height: 1.45; }
    .hs__play {
      justify-self: start; min-height: 44px; margin-top: 4px; padding: 0 14px; border: 1px solid var(--adventure-hud-brass);
      background: transparent; color: var(--adventure-parchment); font: 600 11px var(--font-game); letter-spacing: .08em; cursor: pointer;
    }
    .hs__play--new { border-color: var(--adventure-ember); background: color-mix(in srgb, var(--adventure-ember) 14.00%, transparent); }
    .hs__play small { color: var(--adventure-hud-gold); font: inherit; }
    .hs__play:hover, .hs__play:focus-visible { border-color: var(--adventure-hud-gold); outline: none; }
    .hs__scene { padding: 14px; border: 2px solid var(--adventure-hud-brass); background: var(--adventure-hud-panel-solid); box-shadow: 0 0 0 2px var(--adventure-hud-ink), 0 0 0 4px var(--adventure-ember); }
  `],
})
export class HubStoryComponent implements OnInit, OnDestroy {
  private readonly story = inject(StoryService);
  private readonly i18n = inject(TranslationService);
  private readonly glim = inject(GlimService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private sub?: Subscription;
  view: JournalView = journalView(this.story.state);
  /** The scene playing inline, or null. */
  playing: StorySceneId | null = null;

  constructor() {
    this.i18n.register(STORY_I18N);
  }

  ngOnInit(): void {
    this.sub = this.story.state$.subscribe(state => { this.view = journalView(state); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  play(id: string): void {
    this.playing = id as StorySceneId;
    setTimeout(() => {
      const box = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.hs__scene');
      box?.scrollIntoView?.({ block: 'nearest' });
      box?.querySelector<HTMLElement>('.ss__go')?.focus({ preventScroll: true });
    });
  }

  get glimMet(): boolean { return this.glim.state.met; }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
