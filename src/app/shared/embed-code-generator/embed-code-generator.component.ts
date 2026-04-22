import { Component, Input, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SITE_URL } from '../../seo.service';

@Component({
  selector: 'app-embed-code-generator',
  template: `
    <div class="ecg">
      <button class="ecg__toggle" (click)="open = !open" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        Embed this tool
      </button>
    
      @if (open) {
        <div class="ecg__panel">
          <p class="ecg__desc">Copy the code below to embed this tool on your site.</p>
          <div class="ecg__options">
            <label class="ecg__label">
              Width
              <input type="text" [(ngModel)]="width" class="ecg__input" placeholder="100%">
            </label>
            <label class="ecg__label">
              Height
              <input type="text" [(ngModel)]="height" class="ecg__input" placeholder="600">
            </label>
            <label class="ecg__label ecg__label--check">
              <input type="checkbox" [(ngModel)]="hideBranding">
              Hide branding (Pro)
            </label>
          </div>
          <div class="ecg__code-wrap">
            <pre class="ecg__code"><code>{{ embedCode }}</code></pre>
            <button class="ecg__copy" (click)="copyCode()" type="button">
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          @if (hideBranding) {
            <p class="ecg__note">
              Branding removal requires a Pro subscription.
              <a [href]="siteUrl + '/pro'" target="_blank" rel="noopener">Learn more</a>
            </p>
          }
        </div>
      }
    </div>
    `,
  styles: [`
    .ecg {
      margin-top: 16px;
    }
    .ecg__toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      color: #00d4ff;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .ecg__toggle:hover {
      background: rgba(0, 212, 255, 0.14);
      border-color: rgba(0, 212, 255, 0.35);
    }
    .ecg__panel {
      margin-top: 12px;
      padding: 16px;
      background: rgba(26, 26, 46, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
    }
    .ecg__desc {
      margin: 0 0 12px;
      color: #a0a0b0;
      font-size: 13px;
    }
    .ecg__options {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }
    .ecg__label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: #a0a0b0;
      font-size: 12px;
      font-weight: 500;
    }
    .ecg__label--check {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .ecg__input {
      width: 100px;
      padding: 6px 10px;
      background: rgba(10, 10, 10, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #f0f0f0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      outline: none;
      transition: border-color 150ms ease;
    }
    .ecg__input:focus {
      border-color: rgba(0, 212, 255, 0.4);
    }
    .ecg__code-wrap {
      position: relative;
    }
    .ecg__code {
      padding: 12px;
      background: rgba(10, 10, 10, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      color: #f0f0f0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }
    .ecg__copy {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 10px;
      background: rgba(0, 212, 255, 0.15);
      border: 1px solid rgba(0, 212, 255, 0.25);
      border-radius: 6px;
      color: #00d4ff;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .ecg__copy:hover {
      background: rgba(0, 212, 255, 0.25);
    }
    .ecg__note {
      margin: 8px 0 0;
      color: #6b6b80;
      font-size: 12px;
    }
    .ecg__note a {
      color: #7c3aed;
      text-decoration: none;
    }
    .ecg__note a:hover {
      text-decoration: underline;
    }
  `],
  standalone: false
})
export class EmbedCodeGeneratorComponent {
  @Input() toolSlug = '';
  @Input() toolName = '';

  readonly siteUrl = SITE_URL;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  open = false;
  width = '100%';
  height = '600';
  hideBranding = false;
  copied = false;

  get embedCode(): string {
    const heightVal = this.height.includes('%') ? this.height : this.height + 'px';
    const brandParam = this.hideBranding ? '&branding=false' : '';
    return `<iframe\n  src="${this.siteUrl}/embed/${this.toolSlug}?theme=dark${brandParam}"\n  width="${this.width}"\n  height="${heightVal}"\n  frameborder="0"\n  title="${this.toolName} — xsantcastx"\n  allow="clipboard-write"\n  loading="lazy"\n  style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;"\n></iframe>`;
  }

  copyCode(): void {
    if (!this.isBrowser) return;
    navigator.clipboard.writeText(this.embedCode).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }
}
