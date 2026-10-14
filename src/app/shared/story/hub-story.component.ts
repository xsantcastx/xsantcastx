/**
 * hub-story.component.ts — the Character hub's Story tab: "The Keeper's Record".
 *
 * The current chapter, one next lead, and every chapter reached with the beats
 * found in it (story.ts journalView). An unreached beat never shows its title
 * or its words here — only the count says there is more to find. Text is the
 * lazy story table (EN + ES); the hub loads this tab with @defer, so none of it
 * rides the shell's initial bundle.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { StoryService } from './story.service';
import { JournalView, journalView } from './story';
import { STORY_I18N } from './story.i18n';

@Component({
  selector: 'app-hub-story',
  standalone: true,
  template: `
    <section class="hs" [attr.data-story-chapter]="view.chapter" aria-labelledby="hs-title">
      <header class="hs__head">
        <p class="hs__kicker">{{ t('story.journal.kicker') }}</p>
        <h3 id="hs-title" class="hs__title">{{ t(view.title) }}</h3>
      </header>
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
                <li [attr.data-beat]="beat.id"><b>{{ t(beat.title) }}</b><span>{{ t(beat.text) }}</span></li>
              }
            </ol>
          }
        </article>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .hs { display: grid; gap: 14px; }
    .hs__kicker { margin: 0; color: var(--adventure-ember); font: 600 10px Orbitron, sans-serif; letter-spacing: .16em; text-transform: uppercase; }
    .hs__title { margin: 2px 0 0; color: var(--adventure-beacon-text); font: 600 18px/1.25 Orbitron, sans-serif; }
    .hs__lead { padding: 10px 12px; border: 1px solid var(--adventure-ember); background: color-mix(in srgb, var(--adventure-ember) 10.00%, transparent); }
    .hs__lead b { color: var(--adventure-hud-gold); font: 600 10px Orbitron, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
    .hs__lead p { margin: 4px 0 0; color: var(--adventure-parchment); line-height: 1.45; }
    .hs__chapter { padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--adventure-hud-brass) 35.00%, transparent); }
    .hs__chapter.is-now { border-color: var(--adventure-hud-brass); }
    .hs__chapter h4 { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; margin: 0 0 8px; color: var(--adventure-beacon-text); font: 600 13px Orbitron, sans-serif; }
    .hs__chapter small { color: var(--adventure-dialogue); font: 400 12px system-ui, sans-serif; }
    .hs__intro { margin: 0 0 8px; color: var(--adventure-dialogue); font-style: italic; line-height: 1.5; }
    .hs__beats { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .hs__beats li { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid var(--adventure-ember); }
    .hs__beats b { color: var(--adventure-parchment); }
    .hs__beats span { color: var(--adventure-dialogue); line-height: 1.45; }
  `],
})
export class HubStoryComponent implements OnInit, OnDestroy {
  private readonly story = inject(StoryService);
  private readonly i18n = inject(TranslationService);
  private sub?: Subscription;
  view: JournalView = journalView(this.story.state);

  constructor() {
    this.i18n.register(STORY_I18N);
  }

  ngOnInit(): void {
    this.sub = this.story.state$.subscribe(state => { this.view = journalView(state); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
