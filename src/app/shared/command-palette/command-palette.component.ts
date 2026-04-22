import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ToolsDataService } from '../../tools/tools-data.service';
import { ToolCard } from '../../tools/tools.component';
import { CommandPaletteService } from './command-palette.service';

interface ScoredResult {
  tool: ToolCard;
  score: number;
}

/**
 * CommandPaletteComponent — site-wide Cmd+K (Ctrl+K on Windows/Linux)
 * search overlay. Mounted once at the app root so it's available from
 * any route. Features:
 *   - Fuzzy search over tools (title + description + tags + category)
 *   - Keyboard navigation (↑ / ↓, Home, End)
 *   - Enter to open the highlighted tool (Router navigation)
 *   - Esc / backdrop click to close
 *   - Focus trap + scroll lock while open
 *   - SSR-safe (no DOM access outside isPlatformBrowser guard)
 *   - Accessible: role="dialog", aria-modal, labeled combobox + listbox
 */
@Component({
  selector: 'app-command-palette',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (palette.isOpen()) {
      <div
        class="cp-backdrop"
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        >
        <div class="cp-panel" (click)="$event.stopPropagation()">
          <div class="cp-header">
            <svg
              class="cp-search-icon"
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              >
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              #searchInput
              type="text"
              class="cp-input"
              id="cp-title"
              [(ngModel)]="query"
              (ngModelChange)="onQueryChange()"
              (keydown)="onKeydown($event)"
              placeholder="Search tools — try 'json', 'regex', 'color'…"
              aria-label="Search all tools"
              aria-controls="cp-listbox"
            [attr.aria-activedescendant]="
              results.length > 0 ? 'cp-item-' + activeIndex : null
            "
              autocomplete="off"
              spellcheck="false"
              />
            <kbd class="cp-kbd cp-kbd--esc" aria-hidden="true">Esc</kbd>
          </div>
          <div class="cp-results-wrap">
            @if (results.length > 0) {
              <ul
                id="cp-listbox"
                class="cp-list"
                role="listbox"
                #listEl
                >
                @for (r of results; track trackById(i, r); let i = $index) {
                  <li
                    [id]="'cp-item-' + i"
                    class="cp-item"
                    [class.cp-item--active]="i === activeIndex"
                    role="option"
                    [attr.aria-selected]="i === activeIndex"
                    (mouseenter)="activeIndex = i"
                    (click)="selectResult(r.tool)"
                    >
                    <div class="cp-item__icon" [innerHTML]="iconFor(r.tool)"></div>
                    <div class="cp-item__body">
                      <div class="cp-item__title">{{ r.tool.title }}</div>
                      <div class="cp-item__desc">{{ r.tool.description }}</div>
                    </div>
                    <div class="cp-item__meta">
                      <span class="cp-item__cat">{{ r.tool.category }}</span>
                    </div>
                  </li>
                }
              </ul>
            }
            @if (results.length === 0) {
              <div class="cp-empty">
                <div class="cp-empty__glyph">⌘K</div>
                <div class="cp-empty__title">No tools match "{{ query }}"</div>
                <div class="cp-empty__hint">
                  Try a broader term like <em>json</em>, <em>regex</em>, or
                  <em>color</em>.
                </div>
              </div>
            }
          </div>
          <div class="cp-footer">
            <div class="cp-footer__hints">
              <span><kbd class="cp-kbd">↑</kbd><kbd class="cp-kbd">↓</kbd> navigate</span>
              <span><kbd class="cp-kbd">↵</kbd> open</span>
              <span><kbd class="cp-kbd">esc</kbd> close</span>
            </div>
            <div class="cp-footer__brand">xsantcastx · {{ totalCount }} tools</div>
          </div>
        </div>
      </div>
    }
    `,
  styles: [
    `
      .cp-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 7, 14, 0.72);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9500;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: clamp(3rem, 12vh, 8rem) 1rem 1rem;
        animation: cpFadeIn 140ms ease-out;
      }
      .cp-panel {
        width: 100%;
        max-width: 640px;
        background: var(--surface-strong, rgba(18, 26, 52, 0.95));
        border: 1px solid var(--glass-border-strong, rgba(0, 255, 204, 0.25));
        border-radius: var(--radius-lg, 20px);
        box-shadow: var(--shadow-strong, 0 26px 80px -30px rgba(0, 0, 0, 0.85)),
          0 0 0 1px rgba(0, 255, 204, 0.05);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: min(560px, 70vh);
        color: var(--text-color, #f6fbff);
        font-family: var(--font-body, 'Inter', system-ui, sans-serif);
        animation: cpSlideIn 180ms cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      .cp-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.95rem 1.1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.18);
      }
      .cp-search-icon {
        color: var(--primary-color, #00ffcc);
        flex-shrink: 0;
        opacity: 0.85;
      }
      .cp-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-color, #f6fbff);
        font-size: 1rem;
        font-family: inherit;
        padding: 0.25rem 0;
        caret-color: var(--primary-color, #00ffcc);
      }
      .cp-input::placeholder {
        color: var(--text-muted, rgba(214, 221, 235, 0.55));
      }
      .cp-kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.6rem;
        height: 1.4rem;
        padding: 0 0.4rem;
        font-family: var(--font-heading, 'Orbitron', sans-serif);
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted, rgba(214, 221, 235, 0.76));
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
      }
      .cp-kbd--esc {
        flex-shrink: 0;
      }
      .cp-results-wrap {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 255, 204, 0.3) transparent;
      }
      .cp-results-wrap::-webkit-scrollbar {
        width: 8px;
      }
      .cp-results-wrap::-webkit-scrollbar-thumb {
        background: rgba(0, 255, 204, 0.25);
        border-radius: 4px;
      }
      .cp-list {
        list-style: none;
        margin: 0;
        padding: 0.5rem;
      }
      .cp-item {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 0.7rem 0.85rem;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 120ms ease, transform 120ms ease;
        border: 1px solid transparent;
      }
      .cp-item--active {
        background: linear-gradient(
          135deg,
          rgba(0, 255, 204, 0.12),
          rgba(123, 97, 255, 0.08)
        );
        border-color: rgba(0, 255, 204, 0.3);
        transform: translateX(2px);
      }
      .cp-item__icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(0, 255, 204, 0.07);
        border: 1px solid rgba(0, 255, 204, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary-color, #00ffcc);
      }
      .cp-item__body {
        flex: 1;
        min-width: 0;
      }
      .cp-item__title {
        font-family: var(--font-heading, 'Orbitron', sans-serif);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--text-color, #f6fbff);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-item__desc {
        font-size: 0.74rem;
        color: var(--text-muted, rgba(214, 221, 235, 0.76));
        margin-top: 0.15rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-item__meta {
        flex-shrink: 0;
      }
      .cp-item__cat {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: rgba(123, 97, 255, 0.12);
        color: var(--secondary-color, #7b61ff);
        border: 1px solid rgba(123, 97, 255, 0.3);
      }
      .cp-empty {
        padding: 2.5rem 1rem 2.75rem;
        text-align: center;
        color: var(--text-muted, rgba(214, 221, 235, 0.76));
      }
      .cp-empty__glyph {
        font-family: var(--font-heading, 'Orbitron', sans-serif);
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary-color, #00ffcc);
        opacity: 0.4;
        margin-bottom: 0.5rem;
      }
      .cp-empty__title {
        font-size: 0.9rem;
        color: var(--text-color, #f6fbff);
        margin-bottom: 0.25rem;
      }
      .cp-empty__hint {
        font-size: 0.78rem;
      }
      .cp-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.6rem 0.9rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.2);
        font-size: 0.7rem;
        color: var(--text-muted, rgba(214, 221, 235, 0.6));
      }
      .cp-footer__hints {
        display: flex;
        gap: 0.9rem;
        flex-wrap: wrap;
      }
      .cp-footer__hints span {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .cp-footer__brand {
        font-family: var(--font-heading, 'Orbitron', sans-serif);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      @keyframes cpFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes cpSlideIn {
        from {
          opacity: 0;
          transform: translateY(-8px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cp-backdrop,
        .cp-panel {
          animation: none;
        }
        .cp-item {
          transition: none;
        }
      }
      @media (max-width: 600px) {
        .cp-backdrop {
          padding: 3rem 0.6rem 0.6rem;
        }
        .cp-panel {
          max-height: 85vh;
        }
        .cp-footer__hints span:not(:first-child):not(:last-child) {
          display: none;
        }
        .cp-item__desc {
          display: none;
        }
        .cp-item__meta {
          display: none;
        }
      }
    `,
  ],
})
export class CommandPaletteComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('listEl') listEl?: ElementRef<HTMLUListElement>;

  readonly palette = inject(CommandPaletteService);
  private readonly toolsData = inject(ToolsDataService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  query = '';
  activeIndex = 0;
  private allTools: ToolCard[] = [];
  results: ScoredResult[] = [];
  totalCount = 0;

  private routerSub?: Subscription;
  private prevOverflow: string | null = null;

  constructor() {
    // React to open/close state changes
    effect(() => {
      const open = this.palette.isOpen();
      if (!this.isBrowser) return;
      if (open) {
        this.onOpen();
      } else {
        this.onClose();
      }
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.allTools = this.toolsData
      .getTools()
      .filter(t => t.status === 'live' && t.route && t.route.length > 0);
    this.totalCount = this.allTools.length;
    this.computeResults();

    if (this.isBrowser) {
      // Close palette on route change so navigating feels snappy
      this.routerSub = this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          if (this.palette.isOpen()) this.palette.close();
        });
    }
  }

  ngAfterViewInit(): void {
    // nothing — focus handled in onOpen() via effect
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.restoreBodyScroll();
  }

  /** Global Cmd+K / Ctrl+K listener (works from any route). */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;

    // Cmd/Ctrl+K toggles the palette from anywhere
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopPropagation();
      this.palette.toggle();
      return;
    }

    // Forward Escape to close only when palette is open
    if (event.key === 'Escape' && this.palette.isOpen()) {
      event.preventDefault();
      this.palette.close();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.results.length) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.results.length;
        this.scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex =
          (this.activeIndex - 1 + this.results.length) % this.results.length;
        this.scrollActiveIntoView();
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex = 0;
        this.scrollActiveIntoView();
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex = this.results.length - 1;
        this.scrollActiveIntoView();
        break;
      case 'Enter': {
        event.preventDefault();
        const target = this.results[this.activeIndex]?.tool;
        if (target) this.selectResult(target);
        break;
      }
    }
  }

  onQueryChange(): void {
    this.activeIndex = 0;
    this.computeResults();
  }

  onBackdropClick(_event: MouseEvent): void {
    this.palette.close();
  }

  selectResult(tool: ToolCard): void {
    if (!tool.route) return;
    this.palette.close();
    // Queue navigation on next tick so the close animation can start
    void this.router.navigateByUrl(tool.route);
  }

  iconFor(tool: ToolCard): string {
    // Simple inline SVG wrapper — trusted static data from the registry
    const inner = tool.icon || '<circle cx="12" cy="12" r="3"></circle>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  trackById = (_i: number, r: ScoredResult): string => r.tool.id;

  // ---------- Private helpers ----------

  private computeResults(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      // Show a curated "quick access" list of the first N tools
      this.results = this.allTools.slice(0, 20).map(tool => ({ tool, score: 0 }));
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const scored: ScoredResult[] = [];

    for (const tool of this.allTools) {
      const haystack = (
        tool.title +
        ' ' +
        tool.description +
        ' ' +
        tool.category +
        ' ' +
        tool.tags.join(' ')
      ).toLowerCase();

      let score = 0;
      let matchedAll = true;

      for (const term of terms) {
        if (!haystack.includes(term)) {
          matchedAll = false;
          break;
        }
        // Title hits weigh more than description/tag hits
        if (tool.title.toLowerCase().includes(term)) score += 10;
        if (tool.title.toLowerCase().startsWith(term)) score += 8;
        if (tool.tags.some(t => t.toLowerCase() === term)) score += 6;
        if (tool.category.toLowerCase().includes(term)) score += 3;
        if (tool.description.toLowerCase().includes(term)) score += 2;
      }

      if (matchedAll) scored.push({ tool, score });
    }

    scored.sort((a, b) => b.score - a.score || a.tool.title.localeCompare(b.tool.title));
    this.results = scored.slice(0, 50);
    if (this.activeIndex >= this.results.length) this.activeIndex = 0;
  }

  private onOpen(): void {
    if (!this.isBrowser) return;
    // Reset search state every open so the palette feels fresh
    this.query = '';
    this.activeIndex = 0;
    this.computeResults();
    this.lockBodyScroll();

    // Focus input after the overlay renders
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
      this.searchInput?.nativeElement?.select();
    }, 30);
  }

  private onClose(): void {
    this.restoreBodyScroll();
  }

  private lockBodyScroll(): void {
    if (!this.isBrowser) return;
    const body = document.body;
    if (this.prevOverflow === null) {
      this.prevOverflow = body.style.overflow;
    }
    body.style.overflow = 'hidden';
  }

  private restoreBodyScroll(): void {
    if (!this.isBrowser) return;
    if (this.prevOverflow !== null) {
      document.body.style.overflow = this.prevOverflow;
      this.prevOverflow = null;
    }
  }

  private scrollActiveIntoView(): void {
    if (!this.isBrowser) return;
    setTimeout(() => {
      const ul = this.listEl?.nativeElement;
      if (!ul) return;
      const active = ul.querySelector<HTMLElement>(
        `#cp-item-${this.activeIndex}`,
      );
      active?.scrollIntoView({ block: 'nearest' });
    });
  }
}
