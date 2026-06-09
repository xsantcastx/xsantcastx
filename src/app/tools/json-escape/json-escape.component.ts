import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type ToolMode = 'escape' | 'unescape';

@Component({
    selector: 'app-json-escape',
    templateUrl: './json-escape.component.html',
    styleUrls: ['./json-escape.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class JsonEscapeComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON String Escape & Unescape tool — escape special characters for JSON strings instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-escape')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-escape')}`;

  // Mode
  mode: ToolMode = 'escape';

  // Text I/O
  textInput = '';
  output = '';

  // UI state
  errorMessage = '';
  copied = false;
  inputCharCount = 0;
  outputCharCount = 0;
  escapedCharCount = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode changes ──────────────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  // ── Live processing (debounced 300ms) ─────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput) {
      this.output = '';
      this.outputCharCount = 0;
      this.escapedCharCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private processText() {
    // Easter egg: triple escaped newline
    if (this.textInput === '\\n\\n\\n') {
      this.eggs.trigger('json-newlines');
    }

    if (this.mode === 'escape') {
      this.escapeText(this.textInput);
    } else {
      this.unescapeText(this.textInput);
    }
  }

  // ── Escape ────────────────────────────────────────────────────────────────

  private escapeText(input: string) {
    try {
      let count = 0;
      const result = Array.from(input).map(char => {
        switch (char) {
          case '"':  count++; return '\\"';
          case '\\': count++; return '\\\\';
          case '\n': count++; return '\\n';
          case '\r': count++; return '\\r';
          case '\t': count++; return '\\t';
          case '\b': count++; return '\\b';
          case '\f': count++; return '\\f';
          default: {
            const code = char.codePointAt(0)!;
            // Escape control characters (U+0000 to U+001F) and non-BMP
            if (code < 0x20) {
              count++;
              return '\\u' + code.toString(16).padStart(4, '0');
            }
            // Escape non-ASCII characters above U+FFFF (surrogate pairs)
            if (code > 0xFFFF) {
              count++;
              const hi = Math.floor((code - 0x10000) / 0x400) + 0xD800;
              const lo = ((code - 0x10000) % 0x400) + 0xDC00;
              return '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
            }
            return char;
          }
        }
      }).join('');

      this.output = result;
      this.outputCharCount = result.length;
      this.escapedCharCount = count;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.escapedCharCount = 0;
      this.errorMessage = 'Escape failed — unexpected error processing the input.';
    }
  }

  // ── Unescape ──────────────────────────────────────────────────────────────

  private unescapeText(input: string) {
    try {
      let count = 0;
      let result = '';
      let i = 0;

      while (i < input.length) {
        if (input[i] === '\\' && i + 1 < input.length) {
          const next = input[i + 1];
          switch (next) {
            case '"':  count++; result += '"';  i += 2; continue;
            case '\\': count++; result += '\\'; i += 2; continue;
            case '/':  count++; result += '/';  i += 2; continue;
            case 'n':  count++; result += '\n'; i += 2; continue;
            case 'r':  count++; result += '\r'; i += 2; continue;
            case 't':  count++; result += '\t'; i += 2; continue;
            case 'b':  count++; result += '\b'; i += 2; continue;
            case 'f':  count++; result += '\f'; i += 2; continue;
            case 'u': {
              // Unicode escape: \uXXXX
              if (i + 5 < input.length) {
                const hex = input.substring(i + 2, i + 6);
                if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                  const codeUnit = parseInt(hex, 16);
                  // Check for surrogate pair
                  if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF && i + 11 < input.length) {
                    const nextEsc = input.substring(i + 6, i + 8);
                    if (nextEsc === '\\u') {
                      const hex2 = input.substring(i + 8, i + 12);
                      if (/^[0-9a-fA-F]{4}$/.test(hex2)) {
                        const lo = parseInt(hex2, 16);
                        if (lo >= 0xDC00 && lo <= 0xDFFF) {
                          const cp = (codeUnit - 0xD800) * 0x400 + (lo - 0xDC00) + 0x10000;
                          count++;
                          result += String.fromCodePoint(cp);
                          i += 12;
                          continue;
                        }
                      }
                    }
                  }
                  count++;
                  result += String.fromCharCode(codeUnit);
                  i += 6;
                  continue;
                }
              }
              // Invalid \u sequence, keep as-is
              result += input[i];
              i++;
              continue;
            }
            default:
              // Unknown escape, keep as-is
              result += input[i];
              i++;
              continue;
          }
        }
        result += input[i];
        i++;
      }

      this.output = result;
      this.outputCharCount = result.length;
      this.escapedCharCount = count;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.escapedCharCount = 0;
      this.errorMessage = 'Unescape failed — input contains invalid escape sequences.';
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.escapedCharCount = 0;
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

  loadSample() {
    if (this.mode === 'escape') {
      this.textInput = 'He said: "Hello, World!"\nPath: C:\\Users\\Documents\\\nTab\there\nUnicode: \u00E9\u00E0\u00FC\u00F1';
    } else {
      this.textInput = 'He said: \\"Hello, World!\\"\\nPath: C:\\\\Users\\\\Documents\\\\\\nTab\\there\\nUnicode: \\u00e9\\u00e0\\u00fc\\u00f1';
    }
    this.onInput();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get sizeChange(): number {
    if (!this.inputCharCount || !this.outputCharCount) return 0;
    return Math.round(((this.outputCharCount - this.inputCharCount) / this.inputCharCount) * 100);
  }
}
