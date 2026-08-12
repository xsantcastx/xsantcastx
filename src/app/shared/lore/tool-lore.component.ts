/**
 * tool-lore.component.ts — the 📖 Lore panel at the foot of a tool page.
 *
 * Declared in ToolsSharedModule, which every tool page already imports, so
 * adding the panel to a tool is one line in its template and nothing else.
 *
 * Renders nothing at all when the tool has no codex entry. That is what makes
 * it safe to drop into any tool template — ten tools have lore today, the other
 * hundred and sixteen get an empty comment node.
 *
 * Styling is deliberately unlike the rest of the site: a serif face, a warmer
 * palette, a parchment edge. The tools are cyan and violet and precise; the
 * codex should feel like something found rather than something built.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LoreProgress, LoreService } from './lore.service';
import { realmForCategory } from '../realms/realm.model';
import { TOOLS_REGISTRY } from '../../tools/tools-registry';

@Component({
  selector: 'app-tool-lore',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (progress) {
      <section class="tl" [style.--realm]="realmColor">
        <button
          type="button"
          class="tl__toggle"
          (click)="toggle()"
          [attr.aria-expanded]="open">
          <span class="tl__book" aria-hidden="true">&#128214;</span>
          <span class="tl__heading">
            <span class="tl__name">{{ progress.lore.title }}</span>
            <span class="tl__meta">{{ progress.discovered }}/{{ progress.total }} chapters discovered</span>
          </span>
          <span class="tl__chevron" [class.tl__chevron--open]="open" aria-hidden="true">&#9662;</span>
        </button>

        <div class="tl__track" aria-hidden="true">
          <span class="tl__fill" [style.width.%]="percent"></span>
        </div>

        @if (open) {
          <div class="tl__body">
            <p class="tl__epigraph">{{ progress.lore.epigraph }}</p>

            @for (chapter of progress.chapters; track chapter.id) {
              @if (chapter.unlocked) {
                <article class="tl__chapter">
                  <h3 class="tl__chapter-title">{{ chapter.title }}</h3>
                  @for (para of chapter.paragraphs; track $index) {
                    <p class="tl__para">@for (seg of para; track $index) {@if (seg.em) {<em>{{ seg.text }}</em>} @else {{{ seg.text }}}}</p>
                  }
                </article>
              } @else {
                <article class="tl__chapter tl__chapter--locked">
                  <h3 class="tl__chapter-title">{{ lockedTitle(chapter.title) }}</h3>
                  <p class="tl__locked">
                    Use this tool {{ chapter.remaining }} more
                    {{ chapter.remaining === 1 ? 'time' : 'times' }} to reveal.
                  </p>
                </article>
              }
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    .tl {
      margin: 32px 0;
      padding: 4px 0 0;
      border-radius: 14px;
      border: 1px solid rgba(201, 168, 76, 0.22);
      background:
        radial-gradient(ellipse 70% 60% at 10% 0%, rgba(201, 168, 76, 0.05), transparent 65%),
        rgba(10, 8, 18, 0.6);
      overflow: hidden;
    }
    /* The parchment edge — a torn top rule rather than a clean border. */
    .tl::before {
      content: ''; display: block; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(201, 168, 76, 0.55) 20%, rgba(201, 168, 76, 0.2) 50%, rgba(201, 168, 76, 0.55) 80%, transparent);
    }

    .tl__toggle {
      display: flex; align-items: center; gap: 12px;
      width: 100%; min-height: 44px; padding: 14px 16px;
      border: none; background: none; cursor: pointer; text-align: left;
    }
    .tl__book { font-size: 18px; flex: none; }

    .tl__heading { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
    .tl__name {
      font: 600 15px/1.3 Georgia, 'Times New Roman', serif;
      color: #d9c27f;
    }
    .tl__meta { font-size: 12px; color: #8a8071; }

    .tl__chevron { color: #C9A84C; transition: transform .25s ease; flex: none; }
    .tl__chevron--open { transform: rotate(180deg); }

    .tl__track { height: 2px; background: rgba(201, 168, 76, 0.12); }
    .tl__fill {
      display: block; height: 100%;
      background: linear-gradient(90deg, var(--realm, #C9A84C), #C9A84C);
      transition: width .6s cubic-bezier(.22, 1, .36, 1);
    }

    .tl__body { padding: 18px 20px 26px; }

    .tl__epigraph {
      margin: 0 0 22px;
      font: italic 400 14px/1.6 Georgia, 'Times New Roman', serif;
      color: #a08d5f;
      text-align: center;
    }

    .tl__chapter { margin-bottom: 26px; }
    .tl__chapter:last-child { margin-bottom: 0; }

    .tl__chapter-title {
      margin: 0 0 10px;
      font: 600 14px/1.4 Georgia, 'Times New Roman', serif;
      letter-spacing: .04em;
      color: #C9A84C;
    }

    .tl__para {
      margin: 0 0 14px;
      font: 400 15px/1.75 Georgia, 'Times New Roman', serif;
      color: #cdc6b8;
      max-width: 68ch;
    }
    .tl__para:last-child { margin-bottom: 0; }
    /* Emphasis is frequent in this prose and italic serif on italic serif
       disappears, so it leans on colour rather than slant. */
    .tl__para em { font-style: italic; color: #e0d5b8; }

    .tl__chapter--locked .tl__chapter-title { color: #6b6353; }
    .tl__locked {
      margin: 0;
      font: italic 400 13px/1.6 Georgia, 'Times New Roman', serif;
      color: #6b6353;
    }

    /* A chapter that just opened gets one pass of gold. */
    :host(.tl-fresh) .tl { animation: tlFound 2.4s ease-out 1; }
    @keyframes tlFound {
      0%   { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0); }
      25%  { box-shadow: 0 0 34px -6px rgba(201, 168, 76, 0.6); }
      100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0); }
    }

    @media (max-width: 640px) {
      .tl__body { padding: 16px 14px 22px; }
      .tl__para { font-size: 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .tl__chevron, .tl__fill { transition: none; }
      :host(.tl-fresh) .tl { animation: none; box-shadow: 0 0 24px -8px rgba(201, 168, 76, 0.5); }
    }
  `],
})
export class ToolLoreComponent implements OnInit, OnDestroy {
  /** The registry slug of the tool this panel belongs to. */
  @Input({ required: true }) toolSlug!: string;

  open = false;
  progress: LoreProgress | null = null;
  realmColor = '#C9A84C';

  private sub?: Subscription;

  constructor(
    private readonly lore: LoreService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.lore.init();
    this.resolve();

    // The count changes while the visitor is on this very page, so the panel
    // has to follow it — a chapter that opens under you should appear.
    this.sub = this.lore.changed$.subscribe(() => {
      this.resolve();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.open = !this.open;
  }

  get percent(): number {
    if (!this.progress || this.progress.total === 0) return 0;
    return (this.progress.discovered / this.progress.total) * 100;
  }

  /** "Chapter III: The Salt" → "Chapter III: ???" */
  lockedTitle(title: string): string {
    const at = title.indexOf(':');
    return at < 0 ? '???' : `${title.slice(0, at)}: ???`;
  }

  private resolve(): void {
    this.progress = this.lore.progressFor(this.toolSlug);

    const tool = TOOLS_REGISTRY.find(t => t.id === this.toolSlug);
    // The realm is derived from the registry category, never authored in the
    // codex — see the note at the top of lore.model.ts.
    this.realmColor = tool ? realmForCategory(tool.category).color : '#C9A84C';
  }
}
