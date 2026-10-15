/**
 * codex-accounts.component.ts — the Codex's page of The Witness Accounts
 * (Story Act II, docs/handoff/story-act-2.md).
 *
 * Kael asked for five honest accounts, one from each realm. The page opens
 * with the Banked Furnace's scene (its reward: story.ts STORY_SCENES), and
 * keeps every account whose scene has been played: the Furnace's and the
 * four realm Delves' behind the Rift Gates. An account not yet given is a
 * realm-less "still to be told", never its words. Deferred from the
 * Collection tab with the story's lazy words (EN + ES).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { StoryService } from '../shared/story/story.service';
import { STORY_I18N } from '../shared/story/story.i18n';
import { STORY_ACCOUNTS, accountsHeard, accountsOpen } from '../shared/story/story';
import type { StoryState } from '../shared/story/story-save.model';

interface AccountRow { id: string; heard: boolean }

@Component({
  selector: 'app-codex-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cx-block accts" data-codex="accounts" [attr.data-open]="open" [attr.data-heard]="heard">
      <h3 class="cx-block__title">{{ t('story.accounts.title') }}</h3>
      @if (open) {
        <p class="cx-block__sub">{{ t('story.accounts.sub', { n: heard }) }}</p>
        <ol class="accts__list">
          @for (row of rows; track row.id) {
            <li [attr.data-account]="row.id" [attr.data-heard]="row.heard">
              @if (row.heard) {
                <b>{{ t('story.account.' + row.id + '.realm') }}</b>
                <span>{{ t('story.account.' + row.id + '.text') }}</span>
              } @else {
                <span class="accts__wait">{{ t('story.accounts.waiting') }}</span>
              }
            </li>
          }
        </ol>
      } @else {
        <p class="cx-block__sub">{{ t('story.accounts.blank') }}</p>
      }
    </div>
  `,
  styles: [`
    .accts__list { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .accts__list li { display: grid; gap: 2px; padding-left: 12px; border-left: 2px solid var(--adventure-ember); }
    .accts__list b { color: var(--adventure-parchment); }
    .accts__list span { color: var(--adventure-dialogue); line-height: 1.45; }
    .accts__wait { font-style: italic; }
  `],
})
export class CodexAccountsComponent implements OnInit, OnDestroy {
  private readonly story = inject(StoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;
  open = false;
  heard = 0;
  rows: AccountRow[] = [];

  constructor() {
    this.i18n.register(STORY_I18N);
    this.read(this.story.state);
  }

  ngOnInit(): void {
    this.sub = this.story.state$.subscribe(state => { this.read(state); this.cdr.markForCheck(); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private read(state: StoryState): void {
    const heard = new Set<string>(accountsHeard(state));
    this.open = accountsOpen(state);
    this.heard = heard.size;
    this.rows = STORY_ACCOUNTS.map(id => ({ id, heard: heard.has(id) }));
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
