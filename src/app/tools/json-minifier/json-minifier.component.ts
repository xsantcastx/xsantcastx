import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

type IndentOption = '2' | '4' | 'tab';

interface ValidationResult {
  valid: boolean;
  error: string;
  line: number | null;
  column: number | null;
}

@Component({
  selector: 'app-json-minifier',
  templateUrl: './json-minifier.component.html',
  styleUrls: ['./json-minifier.component.css'],
  standalone: false
})
export class JsonMinifierComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Minifier & Compressor — minify, beautify, and optimize JSON instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-minifier')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-minifier')}`;

  // Input
  jsonInput = '';

  // Options
  indentSize: IndentOption = '2';
  sortKeys = false;
  removeNulls = false;
  removeEmptyStrings = false;

  // Output state
  formattedOutput = '';
  highlightedHtml: SafeHtml = '';
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';
  errorLine: number | null = null;
  errorColumn: number | null = null;
  copied = false;

  // Stats
  lineCount = 0;
  charCount = 0;
  inputBytes = 0;
  outputBytes = 0;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live validation (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.charCount = this.jsonInput.length;
    this.inputBytes = new TextEncoder().encode(this.jsonInput).length;

    if (!this.jsonInput.trim()) {
      this.validationStatus = 'idle';
      this.errorMessage = '';
      this.errorLine = null;
      this.errorColumn = null;
      this.formattedOutput = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.liveValidate(), 300);
  }

  private liveValidate() {
    const result = this.validateJson(this.jsonInput);
    this.validationStatus = result.valid ? 'valid' : 'invalid';
    this.errorMessage = result.error;
    this.errorLine = result.line;
    this.errorColumn = result.column;

    if (!result.valid) {
      this.formattedOutput = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      this.outputBytes = 0;
    }
  }

  // ── Core actions ───────────────────────────────────────────────────────────

  minify() {
    if (!this.jsonInput.trim()) return;
    const result = this.validateJson(this.jsonInput);

    if (!result.valid) {
      this.validationStatus = 'invalid';
      this.errorMessage = result.error;
      this.errorLine = result.line;
      this.errorColumn = result.column;
      return;
    }

    let parsed = JSON.parse(this.jsonInput);
    if (this.sortKeys) parsed = this.deepSortKeys(parsed);
    if (this.removeNulls) parsed = this.deepRemoveNulls(parsed);
    if (this.removeEmptyStrings) parsed = this.deepRemoveEmptyStrings(parsed);

    const minified = JSON.stringify(parsed);
    this.applyOutput(minified);

    // Easter egg: ultra compression (>90% savings)
    if (this.savingsPercent > 90) {
      this.eggs.trigger('json-ultra-compress');
    }
  }

  beautify() {
    if (!this.jsonInput.trim()) return;
    const result = this.validateJson(this.jsonInput);

    if (!result.valid) {
      this.validationStatus = 'invalid';
      this.errorMessage = result.error;
      this.errorLine = result.line;
      this.errorColumn = result.column;
      return;
    }

    let parsed = JSON.parse(this.jsonInput);
    if (this.sortKeys) parsed = this.deepSortKeys(parsed);
    if (this.removeNulls) parsed = this.deepRemoveNulls(parsed);
    if (this.removeEmptyStrings) parsed = this.deepRemoveEmptyStrings(parsed);

    const indent = this.resolveIndent();
    const pretty = JSON.stringify(parsed, null, indent);
    this.applyOutput(pretty);
  }

  private applyOutput(output: string) {
    this.formattedOutput = output;
    this.lineCount = output.split('\n').length;
    this.charCount = this.jsonInput.length;
    this.inputBytes = new TextEncoder().encode(this.jsonInput).length;
    this.outputBytes = new TextEncoder().encode(output).length;
    this.validationStatus = 'valid';
    this.errorMessage = '';
    this.errorLine = null;
    this.errorColumn = null;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(output));
  }

  loadSample() {
    this.jsonInput = JSON.stringify({
      "name": "JSON Minifier",
      "version": "1.0.0",
      "description": "A free online tool to minify and compress JSON",
      "author": {
        "name": "xsantcastx",
        "url": "https://xsantcastx.com"
      },
      "features": [
        "Minify & compress",
        "Beautify & format",
        "Sort keys alphabetically",
        "Remove null values",
        "Remove empty strings",
        "Size comparison"
      ],
      "settings": {
        "indent": 2,
        "sortKeys": false,
        "removeNulls": false,
        "removeEmptyStrings": false
      },
      "metadata": {
        "deprecated": null,
        "legacyName": "",
        "notes": null,
        "extra": ""
      },
      "stats": {
        "users": 0,
        "rating": 5.0,
        "free": true
      }
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.jsonInput = '';
    this.formattedOutput = '';
    this.highlightedHtml = '';
    this.validationStatus = 'idle';
    this.errorMessage = '';
    this.errorLine = null;
    this.errorColumn = null;
    this.lineCount = 0;
    this.charCount = 0;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }

  onOptionChange() {
    if (this.validationStatus === 'valid' && this.jsonInput.trim()) {
      this.liveValidate();
    }
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────

  async copyOutput() {
    if (!this.formattedOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.formattedOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.formattedOutput);
    }
  }

  private fallbackCopy(text: string) {
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

  // ── Validation ─────────────────────────────────────────────────────────────

  private validateJson(input: string): ValidationResult {
    try {
      JSON.parse(input);
      return { valid: true, error: '', line: null, column: null };
    } catch (e: any) {
      const msg: string = e?.message ?? 'Invalid JSON';
      const lineMatch = msg.match(/line (\d+)/i);
      const colMatch = msg.match(/column (\d+)/i);
      const posMatch = msg.match(/position (\d+)/i);

      let line: number | null = lineMatch ? parseInt(lineMatch[1], 10) : null;
      let col: number | null = colMatch ? parseInt(colMatch[1], 10) : null;

      if (!line && posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const beforePos = input.substring(0, pos);
        const lines = beforePos.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }

      let friendly = msg;
      if (msg.includes('Unexpected token')) {
        const token = msg.match(/Unexpected token '?(.+?)'?( in JSON)?/)?.[1] ?? '';
        friendly = `Unexpected token${token ? ` "${token}"` : ''}${line ? ` at line ${line}` : ''}${col ? `, column ${col}` : ''}`;
      } else if (msg.includes('Unexpected end')) {
        friendly = 'Unexpected end of JSON — check for missing closing brackets or quotes';
      } else if (msg.includes('Expected')) {
        friendly = msg.replace(' in JSON', '');
      }

      return { valid: false, error: friendly, line, column: col };
    }
  }

  // ── Transform helpers ─────────────────────────────────────────────────────

  private deepSortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(v => this.deepSortKeys(v));
    }
    if (value !== null && typeof value === 'object') {
      const sorted: Record<string, unknown> = {};
      Object.keys(value as Record<string, unknown>)
        .sort()
        .forEach(k => {
          sorted[k] = this.deepSortKeys((value as Record<string, unknown>)[k]);
        });
      return sorted;
    }
    return value;
  }

  private deepRemoveNulls(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(v => this.deepRemoveNulls(v));
    }
    if (value !== null && typeof value === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== null) {
          cleaned[k] = this.deepRemoveNulls(v);
        }
      }
      return cleaned;
    }
    return value;
  }

  private deepRemoveEmptyStrings(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(v => this.deepRemoveEmptyStrings(v));
    }
    if (value !== null && typeof value === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== '') {
          cleaned[k] = this.deepRemoveEmptyStrings(v);
        }
      }
      return cleaned;
    }
    return value;
  }

  // ── Syntax highlighting ────────────────────────────────────────────────────

  private highlight(json: string): string {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g,
      (match) => {
        if (match.endsWith(':')) {
          return `<span class="jm-key">${match}</span>`;
        }
        if (/^"/.test(match)) {
          return `<span class="jm-str">${match}</span>`;
        }
        if (/^-?\d/.test(match)) {
          return `<span class="jm-num">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
          return `<span class="jm-bool">${match}</span>`;
        }
        if (match === 'null') {
          return `<span class="jm-null">${match}</span>`;
        }
        return match;
      }
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveIndent(): string | number {
    if (this.indentSize === 'tab') return '\t';
    return parseInt(this.indentSize, 10);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  get savingsPercent(): number {
    if (!this.inputBytes || !this.outputBytes) return 0;
    return Math.round(((this.inputBytes - this.outputBytes) / this.inputBytes) * 100);
  }
}
