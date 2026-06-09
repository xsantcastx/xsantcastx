import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface CaseResult {
  label: string;
  key: string;
  value: string;
  copied: boolean;
}

@Component({
    selector: 'app-case-converter',
    templateUrl: './case-converter.component.html',
    styleUrls: ['./case-converter.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class CaseConverterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Text Case Converter — uppercase, camelCase, snake_case & more. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/case-converter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/case-converter')}`;

  // Input
  textInput = '';

  // Stats
  wordCount = 0;
  charCount = 0;
  sentenceCount = 0;
  lineCount = 0;

  // Results
  results: CaseResult[] = [];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Input handling (debounced 300ms) ───────────────────────────────────────

  onInput() {
    this.charCount = this.textInput.length;

    if (!this.textInput.trim()) {
      this.clearResults();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private clearResults() {
    this.results = [];
    this.wordCount = 0;
    this.charCount = 0;
    this.sentenceCount = 0;
    this.lineCount = 0;
  }

  clearAll() {
    this.textInput = '';
    this.clearResults();
  }

  loadSample() {
    this.textInput = 'the quick brown fox jumps over the lazy dog';
    this.onInput();
  }

  removeExtraSpaces() {
    this.textInput = this.textInput.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    this.onInput();
  }

  trimText() {
    this.textInput = this.textInput
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
    this.onInput();
  }

  // ── Processing ────────────────────────────────────────────────────────────

  private processText() {
    const text = this.textInput;

    // Stats
    const trimmed = text.trim();
    this.wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
    this.charCount = text.length;
    this.sentenceCount = trimmed ? (trimmed.match(/[.!?]+\s|[.!?]+$/g) || []).length || (trimmed.length > 0 ? 1 : 0) : 0;
    this.lineCount = text.split('\n').length;

    // Easter egg: all same character repeated
    if (text.length >= 4) {
      const firstChar = text[0];
      if (text.split('').every(c => c === firstChar)) {
        this.eggs.trigger('case-monotone');
      }
    }

    // Generate all case conversions
    const words = this.extractWords(text);

    this.results = [
      { label: 'UPPERCASE',      key: 'upper',    value: text.toUpperCase(),                          copied: false },
      { label: 'lowercase',      key: 'lower',    value: text.toLowerCase(),                          copied: false },
      { label: 'Title Case',     key: 'title',    value: this.toTitleCase(text),                      copied: false },
      { label: 'Sentence case',  key: 'sentence', value: this.toSentenceCase(text),                   copied: false },
      { label: 'camelCase',      key: 'camel',    value: this.toCamelCase(words),                     copied: false },
      { label: 'PascalCase',     key: 'pascal',   value: this.toPascalCase(words),                    copied: false },
      { label: 'snake_case',     key: 'snake',    value: this.toDelimitedCase(words, '_', false),     copied: false },
      { label: 'kebab-case',     key: 'kebab',    value: this.toDelimitedCase(words, '-', false),     copied: false },
      { label: 'CONSTANT_CASE',  key: 'constant', value: this.toDelimitedCase(words, '_', true),      copied: false },
      { label: 'dot.case',       key: 'dot',      value: this.toDelimitedCase(words, '.', false),     copied: false },
      { label: 'path/case',      key: 'path',     value: this.toDelimitedCase(words, '/', false),     copied: false },
      { label: 'Train-Case',     key: 'train',    value: this.toTrainCase(words),                     copied: false },
    ];
  }

  // ── Word extraction ───────────────────────────────────────────────────────

  private extractWords(text: string): string[] {
    // Split on camelCase/PascalCase boundaries, underscores, hyphens, dots, slashes, spaces
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase boundary
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ABCDef -> ABC Def
      .replace(/[_\-./\\]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  // ── Case converters ───────────────────────────────────────────────────────

  private toTitleCase(text: string): string {
    return text.replace(/\b\w/g, c => c.toUpperCase());
  }

  private toSentenceCase(text: string): string {
    return text
      .toLowerCase()
      .replace(/(^\s*|[.!?]\s+)(\w)/g, (_, prefix, char) => prefix + char.toUpperCase());
  }

  private toCamelCase(words: string[]): string {
    if (words.length === 0) return '';
    return words[0].toLowerCase() +
      words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toPascalCase(words: string[]): string {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toDelimitedCase(words: string[], delimiter: string, upper: boolean): string {
    const mapped = words.map(w => upper ? w.toUpperCase() : w.toLowerCase());
    return mapped.join(delimiter);
  }

  private toTrainCase(words: string[]): string {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  async copyResult(result: CaseResult) {
    if (!result.value || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(result.value);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    } catch {
      this.fallbackCopy(result);
    }
  }

  private fallbackCopy(result: CaseResult) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = result.value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    result.copied = true;
    setTimeout(() => (result.copied = false), 2000);
  }
}
