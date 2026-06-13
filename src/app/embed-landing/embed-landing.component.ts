import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SITE_URL } from '../seo.service';
import { TOOLS_REGISTRY, getLiveTools, ToolDefinition } from '../tools/tools-registry';

@Component({
    selector: 'app-embed-landing',
    templateUrl: './embed-landing.component.html',
    styleUrls: ['./embed-landing.component.css']
})
export class EmbedLandingComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly siteUrl = SITE_URL;
  readonly tools: ToolDefinition[] = getLiveTools();

  copiedSlug = '';
  selectedTool: ToolDefinition | null = null;
  previewWidth = '100%';
  previewHeight = '600';

  get embedPreviewCode(): string {
    if (!this.selectedTool) return '';
    const heightVal = this.previewHeight.includes('%') ? this.previewHeight : this.previewHeight + 'px';
    return `<iframe
  src="${this.siteUrl}/embed/${this.selectedTool.id}?theme=dark"
  width="${this.previewWidth}"
  height="${heightVal}"
  frameborder="0"
  title="${this.selectedTool.title} — xsantcastx"
  allow="clipboard-write"
  loading="lazy"
  style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;"
></iframe>`;
  }

  selectTool(tool: ToolDefinition): void {
    this.selectedTool = tool;
  }

  copyEmbedCode(tool: ToolDefinition): void {
    if (!this.isBrowser) return;
    const code = `<iframe src="${this.siteUrl}/embed/${tool.id}?theme=dark" width="100%" height="600px" frameborder="0" title="${tool.title} — xsantcastx" allow="clipboard-write" loading="lazy" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;"></iframe>`;
    navigator.clipboard.writeText(code).then(() => {
      this.copiedSlug = tool.id;
      setTimeout(() => this.copiedSlug = '', 2000);
    });
  }
}
