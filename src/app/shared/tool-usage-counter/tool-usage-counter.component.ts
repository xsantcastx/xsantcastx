import { Component, Input, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToolUsageService } from '../tool-usage.service';

@Component({
  selector: 'app-tool-usage-counter',
  standalone: false,
  template: `
    <div class="tool-usage" *ngIf="count > 0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span class="tool-usage__count">{{ formattedCount }}</span>
      <span class="tool-usage__label">developers have used this tool</span>
    </div>
  `,
  styles: [`
    .tool-usage {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      background: rgba(0, 255, 204, 0.06);
      border: 1px solid rgba(0, 255, 204, 0.15);
      color: var(--primary-color);
      font-size: 0.78rem;
      font-weight: 500;
      margin-top: 1rem;
    }

    .tool-usage__count {
      font-family: var(--font-heading);
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .tool-usage__label {
      color: var(--text-muted);
    }

    @media (max-width: 480px) {
      .tool-usage {
        font-size: 0.72rem;
        padding: 0.4rem 0.85rem;
      }
    }
  `]
})
export class ToolUsageCounterComponent implements OnInit {
  @Input() toolSlug = '';
  count = 0;

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private usageService = inject(ToolUsageService);

  get formattedCount(): string {
    if (this.count >= 1000000) return (this.count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (this.count >= 1000) return (this.count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return this.count.toLocaleString();
  }

  async ngOnInit() {
    if (!this.isBrowser || !this.toolSlug) return;
    this.count = await this.usageService.recordUsage(this.toolSlug);
  }
}
