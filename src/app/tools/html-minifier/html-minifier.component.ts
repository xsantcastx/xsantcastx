import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-html-minifier',
    templateUrl: './html-minifier.component.html',
    styleUrls: ['./html-minifier.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class HtmlMinifierComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HTML Minifier & Beautifier — minify or beautify HTML instantly!')}&url=${encodeURIComponent(SITE_URL + '/tools/html-minifier')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/html-minifier')}`;

  input = '';
  output = '';
  mode: 'minify' | 'beautify' = 'minify';
  removeComments = true;
  copied = false;
  inputSize = 0;
  outputSize = 0;

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  process() {
    if (!this.input.trim()) { this.output = ''; this.inputSize = 0; this.outputSize = 0; return; }

    this.inputSize = new Blob([this.input]).size;

    // Easter egg
    if (this.input.toLowerCase().includes('<blink>')) {
      this.eggs.trigger('html-blink');
    }

    if (this.mode === 'minify') {
      this.minify();
    } else {
      this.beautify();
    }

    this.outputSize = new Blob([this.output]).size;
  }

  private minify() {
    let result = this.input;
    if (this.removeComments) {
      result = result.replace(/<!--[\s\S]*?-->/g, '');
    }
    result = result.replace(/\s+/g, ' ');
    result = result.replace(/>\s+</g, '><');
    result = result.replace(/^\s+|\s+$/g, '');
    this.output = result;
  }

  private beautify() {
    let html = this.input.replace(/>\s+</g, '>\n<');
    const lines = html.split('\n');
    let indent = 0;
    const result: string[] = [];
    const selfClosing = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i;
    const closing = /^<\//;
    const opening = /^<[a-zA-Z]/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (closing.test(trimmed)) indent = Math.max(0, indent - 1);
      result.push('  '.repeat(indent) + trimmed);
      if (opening.test(trimmed) && !selfClosing.test(trimmed) && !closing.test(trimmed) && !trimmed.endsWith('/>')) {
        indent++;
      }
    }
    this.output = result.join('\n');
  }

  get savings(): number {
    if (!this.inputSize) return 0;
    return Math.round(((this.inputSize - this.outputSize) / this.inputSize) * 100);
  }

  clearAll() { this.input = ''; this.output = ''; this.inputSize = 0; this.outputSize = 0; }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}
