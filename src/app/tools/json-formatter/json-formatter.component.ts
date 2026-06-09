import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type IndentOption = '2' | '4' | 'tab';

interface ValidationResult {
  valid: boolean;
  error: string;
  line: number | null;
  column: number | null;
}

@Component({
    selector: 'app-json-formatter',
    templateUrl: './json-formatter.component.html',
    styleUrls: ['./json-formatter.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class JsonFormatterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Formatter & Validator — format, minify, validate and repair JSON instantly. No sign-up 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools/json-formatter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-formatter')}`;

  // Input
  jsonInput = '';

  // Options
  indentSize: IndentOption = '2';
  sortKeys = false;
  repairMode = false;

  // Output state
  formattedOutput = '';
  highlightedHtml: SafeHtml = '';
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';
  errorLine: number | null = null;
  errorColumn: number | null = null;
  copied = false;
  downloaded = false;

  // Stats
  lineCount = 0;
  charCount = 0;
  inputBytes = 0;
  outputBytes = 0;

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private translationService: TranslationService
  ) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

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
    const source = this.repairMode ? this.tryRepair(this.jsonInput) : this.jsonInput;
    const result = this.validateJson(source);
    this.validationStatus = result.valid ? 'valid' : 'invalid';
    this.errorMessage = result.error;
    this.errorLine = result.line;
    this.errorColumn = result.column;

    if (result.valid) {
      try {
        const parsed = JSON.parse(source);
        const indent = this.resolveIndent();
        const pretty = JSON.stringify(this.sortKeys ? this.deepSortKeys(parsed) : parsed, null, indent);
        this.formattedOutput = pretty;
        this.lineCount = pretty.split('\n').length;
        this.outputBytes = new TextEncoder().encode(pretty).length;
        this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(pretty));
      } catch { /* ignored */ }
    } else {
      this.formattedOutput = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      this.outputBytes = 0;
    }
  }

  // ── Core actions ───────────────────────────────────────────────────────────

  format() {
    if (!this.jsonInput.trim()) return;
    const source = this.repairMode ? this.tryRepair(this.jsonInput) : this.jsonInput;
    const result = this.validateJson(source);

    if (!result.valid) {
      this.validationStatus = 'invalid';
      this.errorMessage = result.error;
      this.errorLine = result.line;
      this.errorColumn = result.column;
      return;
    }

    const parsed = JSON.parse(source);
    const indent = this.resolveIndent();
    const pretty = JSON.stringify(this.sortKeys ? this.deepSortKeys(parsed) : parsed, null, indent);
    this.formattedOutput = pretty;
    this.lineCount = pretty.split('\n').length;
    this.charCount = this.jsonInput.length;
    this.inputBytes = new TextEncoder().encode(this.jsonInput).length;
    this.outputBytes = new TextEncoder().encode(pretty).length;
    this.validationStatus = 'valid';
    this.errorMessage = '';
    this.errorLine = null;
    this.errorColumn = null;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(pretty));
  }

  minify() {
    if (!this.jsonInput.trim()) return;
    const source = this.repairMode ? this.tryRepair(this.jsonInput) : this.jsonInput;
    const result = this.validateJson(source);

    if (!result.valid) {
      this.validationStatus = 'invalid';
      this.errorMessage = result.error;
      this.errorLine = result.line;
      this.errorColumn = result.column;
      return;
    }

    const parsed = JSON.parse(source);
    const minified = JSON.stringify(this.sortKeys ? this.deepSortKeys(parsed) : parsed);
    this.formattedOutput = minified;
    this.lineCount = 1;
    this.charCount = this.jsonInput.length;
    this.inputBytes = new TextEncoder().encode(this.jsonInput).length;
    this.outputBytes = new TextEncoder().encode(minified).length;
    this.validationStatus = 'valid';
    this.errorMessage = '';
    this.errorLine = null;
    this.errorColumn = null;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(minified));
  }

  loadSample() {
    this.jsonInput = JSON.stringify({
      "name": "JSON Formatter",
      "version": "1.0.0",
      "description": "A free online tool to format, validate and repair JSON",
      "author": {
        "name": "xsantcastx",
        "url": "https://xsantcastx.com"
      },
      "features": [
        "Format & prettify",
        "Minify & compress",
        "Validate with error details",
        "Sort keys alphabetically",
        "Repair broken JSON",
        "Syntax highlighting"
      ],
      "settings": {
        "indent": 2,
        "sortKeys": false,
        "liveValidation": true
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

  onIndentChange() {
    if (this.formattedOutput && this.validationStatus === 'valid') {
      this.format();
    }
  }

  onSortKeysChange() {
    if (this.validationStatus === 'valid' && this.jsonInput.trim()) {
      this.liveValidate();
    }
  }

  // ── Clipboard & Download ───────────────────────────────────────────────────

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

  downloadOutput() {
    if (!this.formattedOutput || !this.isBrowser) return;
    const blob = new Blob([this.formattedOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    a.click();
    URL.revokeObjectURL(url);
    this.downloaded = true;
    setTimeout(() => (this.downloaded = false), 2000);
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

      // Compute line/col from character position if native msg provides it
      if (!line && posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const beforePos = input.substring(0, pos);
        const lines = beforePos.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }

      // Friendly error messages
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

  // ── Repair ─────────────────────────────────────────────────────────────────

  tryRepair(input: string): string {
    let s = input;

    // 1. Strip // line comments and /* block comments */
    s = s.replace(/\/\/[^\n]*/g, '');
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Single quotes → double quotes (keys and values)
    //    Careful: only replace outer quotes, not inner apostrophes
    s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

    // 3. Unquoted keys: { key: ... } → { "key": ... }
    s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

    // 4. Trailing commas before } or ]
    s = s.replace(/,(\s*[}\]])/g, '$1');

    // 5. Normalize undefined → null
    s = s.replace(/:\s*undefined\b/g, ': null');

    return s;
  }

  // ── Key sorting ────────────────────────────────────────────────────────────

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
          // Key
          return `<span class="jf-key">${match}</span>`;
        }
        if (/^"/.test(match)) {
          return `<span class="jf-str">${match}</span>`;
        }
        if (/^-?\d/.test(match)) {
          return `<span class="jf-num">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
          return `<span class="jf-bool">${match}</span>`;
        }
        if (match === 'null') {
          return `<span class="jf-null">${match}</span>`;
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
