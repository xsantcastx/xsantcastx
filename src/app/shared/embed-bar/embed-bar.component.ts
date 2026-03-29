import { Component } from '@angular/core';
import { SITE_URL } from '../../seo.service';

@Component({
  selector: 'app-embed-bar',
  template: `
    <div class="embed-bar">
      <a [href]="siteUrl" target="_blank" rel="noopener" class="embed-bar__link">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Powered by <strong>xsantcastx</strong>
      </a>
      <a [href]="siteUrl + '/tools'" target="_blank" rel="noopener" class="embed-bar__cta">
        Explore all tools
      </a>
    </div>
  `,
  styles: [`
    .embed-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #0e0e1a;
      border-top: 1px solid rgba(0, 212, 255, 0.15);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      color: #a0a0b0;
    }
    .embed-bar__link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #a0a0b0;
      text-decoration: none;
      transition: color 150ms ease;
    }
    .embed-bar__link:hover {
      color: #00d4ff;
    }
    .embed-bar__link strong {
      color: #f0f0f0;
      font-weight: 600;
    }
    .embed-bar__cta {
      color: #00d4ff;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 150ms ease;
    }
    .embed-bar__cta:hover {
      opacity: 0.8;
    }
  `],
  standalone: false
})
export class EmbedBarComponent {
  readonly siteUrl = SITE_URL;
}
