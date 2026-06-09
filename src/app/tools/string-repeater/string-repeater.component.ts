import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type SeparatorType = 'newline' | 'comma' | 'space' | 'custom';
type SortOrder = 'none' | 'asc' | 'desc';

@Component({
    selector: 'app-string-repeater',
    templateUrl: './string-repeater.component.html',
    styleUrls: ['./string-repeater.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class StringRepeaterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Text/String Repeater & Multiplier — repeat, shuffle, sort, reverse text. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/string-repeater')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/string-repeater')}`;

  // Input
  textInput = '';
  repeatCount = 3;

  // Separator
  separatorType: SeparatorType = 'newline';
  customSeparator = '';

  // Transforms
  reverseText = false;
  shuffleChars = false;
  randomizeLines = false;
  removeDuplicates = false;
  sortOrder: SortOrder = 'none';
  trimLines = false;
  numberLines = false;

  // Wrap
  linePrefix = '';
  lineSuffix = '';

  // Output
  output = '';
  copied = false;
  inputCharCount = 0;
  outputCharCount = 0;
  outputLineCount = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live processing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;

    if (!this.textInput) {
      this.output = '';
      this.outputCharCount = 0;
      this.outputLineCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.process(), 300);
  }

  onOptionChange() {
    if (this.textInput) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.process(), 150);
    }
  }

  // ── Core processing ───────────────────────────────────────────────────────

  private process() {
    const count = Math.max(1, Math.min(10000, Math.floor(this.repeatCount)));
    const sep = this.getSeparator();

    // Build repeated lines
    let lines: string[] = [];
    for (let i = 0; i < count; i++) {
      lines.push(this.textInput);
    }

    // Apply transforms to each line
    lines = lines.map(line => {
      if (this.reverseText) {
        line = [...line].reverse().join('');
      }
      if (this.shuffleChars) {
        line = this.shuffleString(line);
      }
      return line;
    });

    // Trim lines
    if (this.trimLines) {
      lines = lines.map(l => l.trim());
    }

    // Remove duplicates
    if (this.removeDuplicates) {
      lines = [...new Set(lines)];
    }

    // Sort
    if (this.sortOrder === 'asc') {
      lines.sort((a, b) => a.localeCompare(b));
    } else if (this.sortOrder === 'desc') {
      lines.sort((a, b) => b.localeCompare(a));
    }

    // Randomize line order
    if (this.randomizeLines) {
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
    }

    // Wrap with prefix/suffix
    if (this.linePrefix || this.lineSuffix) {
      lines = lines.map(l => `${this.linePrefix}${l}${this.lineSuffix}`);
    }

    // Number lines
    if (this.numberLines) {
      const pad = String(lines.length).length;
      lines = lines.map((l, i) => `${String(i + 1).padStart(pad, ' ')}. ${l}`);
    }

    this.output = lines.join(sep);
    this.outputCharCount = this.output.length;
    this.outputLineCount = lines.length;

    // Easter egg: repeating "ha" 100+ times
    this.checkEasterEgg(count);
  }

  private checkEasterEgg(count: number) {
    const normalised = this.textInput.trim().toLowerCase();
    if (normalised === 'ha' && count >= 100) {
      this.eggs.trigger('string-laughing');
    }
  }

  private getSeparator(): string {
    switch (this.separatorType) {
      case 'newline': return '\n';
      case 'comma':   return ', ';
      case 'space':   return ' ';
      case 'custom':  return this.customSeparator;
    }
  }

  private shuffleString(str: string): string {
    const arr = [...str];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.outputLineCount = 0;
  }

  loadSample() {
    this.textInput = 'Hello, World!';
    this.repeatCount = 5;
    this.onInput();
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.output);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  setSeparator(type: SeparatorType) {
    this.separatorType = type;
    this.onOptionChange();
  }

  setSortOrder(order: SortOrder) {
    this.sortOrder = order;
    this.onOptionChange();
  }

  clampRepeatCount() {
    if (this.repeatCount < 1) this.repeatCount = 1;
    if (this.repeatCount > 10000) this.repeatCount = 10000;
    this.onOptionChange();
  }
}
