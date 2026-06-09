import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

type SortMode = 'alpha' | 'length' | 'numeric' | 'random';

@Component({
    selector: 'app-line-sorter',
    templateUrl: './line-sorter.component.html',
    styleUrls: ['./line-sorter.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class LinesorterComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Line Sorter — sort lines alphabetically, by length, numerically, or randomly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/line-sorter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/line-sorter')}`;

  input = '';
  output = '';
  sortMode: SortMode = 'alpha';
  reverse = false;
  removeDuplicates = false;
  removeEmpty = false;
  copied = false;
  lineCount = 0;
  outputLineCount = 0;

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  process() {
    if (!this.input.trim()) {
      this.output = '';
      this.lineCount = 0;
      this.outputLineCount = 0;
      return;
    }

    let lines = this.input.split('\n');
    this.lineCount = lines.length;

    if (this.removeEmpty) {
      lines = lines.filter(l => l.trim().length > 0);
    }

    if (this.removeDuplicates) {
      lines = [...new Set(lines)];
    }

    switch (this.sortMode) {
      case 'alpha':
        lines.sort((a, b) => a.localeCompare(b));
        break;
      case 'length':
        lines.sort((a, b) => a.length - b.length);
        break;
      case 'numeric':
        lines.sort((a, b) => {
          const na = parseFloat(a) || 0;
          const nb = parseFloat(b) || 0;
          return na - nb;
        });
        break;
      case 'random':
        for (let i = lines.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [lines[i], lines[j]] = [lines[j], lines[i]];
        }
        break;
    }

    if (this.reverse && this.sortMode !== 'random') {
      lines.reverse();
    }

    this.output = lines.join('\n');
    this.outputLineCount = lines.length;

    // Easter egg: all lines identical
    const unique = new Set(lines.filter(l => l.trim().length > 0));
    if (unique.size === 1 && lines.length > 1) {
      this.eggs.trigger('lines-clone');
    }
  }

  clearAll() {
    this.input = '';
    this.output = '';
    this.lineCount = 0;
    this.outputLineCount = 0;
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      /* fallback */
    }
  }
}
