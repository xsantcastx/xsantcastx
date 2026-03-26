import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToolCard } from '../tools/tools.component';
import { ToolsDataService } from '../tools/tools-data.service';

@Component({
  selector: 'app-related-tools',
  standalone: false,
  template: `
    <section class="related-tools" *ngIf="relatedTools.length > 0">
      <div class="related-tools__header">
        <div class="related-tools__line"></div>
        <h3 class="related-tools__title">Related Tools</h3>
        <div class="related-tools__line"></div>
      </div>
      <div class="related-tools__grid">
        <a
          class="rt-card"
          *ngFor="let tool of relatedTools"
          [routerLink]="tool.route"
        >
          <div class="rt-card__icon" aria-hidden="true" [innerHTML]="getIconHtml(tool)"></div>
          <div class="rt-card__body">
            <h4 class="rt-card__name">{{ tool.title }}</h4>
            <p class="rt-card__desc">{{ tool.description }}</p>
            <div class="rt-card__tags">
              <span
                *ngFor="let tag of tool.tags | slice:0:3"
                class="rt-tag"
                [class.rt-tag--shared]="isSharedTag(tag)"
              >{{ tag }}</span>
            </div>
          </div>
          <span class="rt-card__arrow" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </a>
      </div>
      <div class="related-tools__browse">
        <a routerLink="/tools" class="related-tools__browse-link">Browse all tools &rarr;</a>
      </div>
    </section>
  `,
  styles: [`
    .related-tools {
      margin-top: 3rem;
      padding-top: 2.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .related-tools__header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .related-tools__line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 255, 204, 0.2), transparent);
    }
    .related-tools__line:last-child {
      background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.2));
    }
    .related-tools__title {
      font-family: var(--font-heading);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--primary-color);
      margin: 0;
      white-space: nowrap;
    }
    .related-tools__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .rt-card {
      display: flex;
      align-items: flex-start;
      gap: 0.9rem;
      padding: 1.1rem 1.25rem;
      border-radius: var(--radius-md);
      background: var(--surface-color);
      border: 1px solid var(--glass-border);
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .rt-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0, 255, 204, 0.03), rgba(123, 97, 255, 0.03));
      pointer-events: none;
    }
    .rt-card:hover {
      transform: translateY(-2px);
      border-color: rgba(0, 255, 204, 0.3);
      box-shadow: 0 4px 20px -8px rgba(0, 255, 204, 0.15);
    }
    .rt-card:hover .rt-card__arrow { opacity: 1; transform: translateX(2px); }
    .rt-card__icon {
      flex-shrink: 0;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(0, 255, 204, 0.06);
      border: 1px solid rgba(0, 255, 204, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-color);
    }
    .rt-card__body { flex: 1; min-width: 0; }
    .rt-card__name {
      font-family: var(--font-heading);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--text-color);
      margin: 0 0 0.3rem;
    }
    .rt-card__desc {
      font-size: 0.76rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0 0 0.6rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .rt-card__tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .rt-tag {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: rgba(0, 255, 204, 0.07);
      color: var(--primary-color);
      border: 1px solid rgba(0, 255, 204, 0.15);
    }
    .rt-tag--shared {
      background: rgba(0, 255, 204, 0.15);
      border-color: rgba(0, 255, 204, 0.35);
    }
    .rt-card__arrow {
      flex-shrink: 0;
      color: var(--primary-color);
      opacity: 0.3;
      transition: opacity 0.2s, transform 0.2s;
      margin-top: 2px;
    }
    .related-tools__browse {
      text-align: center;
      margin-top: 1.25rem;
    }
    .related-tools__browse-link {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--primary-color);
      text-decoration: none;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .related-tools__browse-link:hover { opacity: 1; }
  `]
})
export class RelatedToolsComponent implements OnInit {
  @Input() currentToolId!: string;
  relatedTools: ToolCard[] = [];
  private currentTags: Set<string> = new Set();

  constructor(
    private sanitizer: DomSanitizer,
    private toolsData: ToolsDataService
  ) {}

  ngOnInit(): void {
    const allTools = this.toolsData.getTools();
    const current = allTools.find(t => t.id === this.currentToolId);
    if (current) {
      this.currentTags = new Set(current.tags.map(t => t.toLowerCase()));
    }
    this.relatedTools = this.toolsData.getRelatedTools(this.currentToolId, 4);
  }

  getIconHtml(tool: ToolCard): SafeHtml {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${tool.icon}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  isSharedTag(tag: string): boolean {
    return this.currentTags.has(tag.toLowerCase());
  }
}
