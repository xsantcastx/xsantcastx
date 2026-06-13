import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface EncodingResult {
  label: string;
  key: string;
  value: string;
  copied: boolean;
}

interface CharBreakdown {
  char: string;
  codePoint: number;
  utf8Hex: string;
  utf8Bytes: number[];
  ascii: string;
  latin1: string;
  urlEncoded: string;
  htmlEntity: string;
  unicodeEscape: string;
  hexEscape: string;
  octalEscape: string;
  decimalEntity: string;
}

@Component({
    selector: 'app-encoding-converter',
    templateUrl: './encoding-converter.component.html',
    styleUrls: ['./encoding-converter.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class EncodingConverterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  textInput = '';
  encodings: EncodingResult[] = [];
  charTable: CharBreakdown[] = [];
  byteView: string = '';
  inputCharCount = 0;
  totalBytes = 0;
  showCharTable = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // -- Live processing (debounced 300ms) --

  onInput() {
    this.inputCharCount = this.textInput.length;

    if (!this.textInput) {
      this.clearAll();
      return;
    }

    // Easter egg: input contains only whitespace
    if (this.textInput.length > 0 && !this.textInput.trim()) {
      this.eggs.trigger('encoding-invisible');
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processAll(), 300);
  }

  private processAll() {
    const input = this.textInput;
    this.encodings = this.buildEncodings(input);
    this.charTable = this.buildCharTable(input);
    this.byteView = this.buildByteView(input);

    const utf8Bytes = new TextEncoder().encode(input);
    this.totalBytes = utf8Bytes.length;
  }

  // -- Encoding conversions --

  private buildEncodings(input: string): EncodingResult[] {
    return [
      { label: 'UTF-8 (hex bytes)',     key: 'utf8',      value: this.toUtf8Hex(input),        copied: false },
      { label: 'ASCII',                 key: 'ascii',     value: this.toAscii(input),           copied: false },
      { label: 'Latin-1 (ISO 8859-1)',  key: 'latin1',    value: this.toLatin1(input),          copied: false },
      { label: 'URL Encoding',          key: 'url',       value: this.toUrlEncoding(input),     copied: false },
      { label: 'HTML Entities',         key: 'html',      value: this.toHtmlEntities(input),    copied: false },
      { label: 'Unicode Escapes',       key: 'unicode',   value: this.toUnicodeEscapes(input),  copied: false },
      { label: 'Hex Escapes',           key: 'hex',       value: this.toHexEscapes(input),      copied: false },
      { label: 'Octal Escapes',         key: 'octal',     value: this.toOctalEscapes(input),    copied: false },
      { label: 'Decimal Entities',      key: 'decimal',   value: this.toDecimalEntities(input), copied: false },
    ];
  }

  private toUtf8Hex(input: string): string {
    const bytes = new TextEncoder().encode(input);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }

  private toAscii(input: string): string {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      return cp <= 127 ? cp.toString() : '?';
    }).join(' ');
  }

  private toLatin1(input: string): string {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      return cp <= 255 ? cp.toString(16).padStart(2, '0').toUpperCase() : '??';
    }).join(' ');
  }

  private toUrlEncoding(input: string): string {
    try {
      return encodeURIComponent(input);
    } catch {
      return '[encoding error]';
    }
  }

  private toHtmlEntities(input: string): string {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      if (cp === 38) return '&amp;';
      if (cp === 60) return '&lt;';
      if (cp === 62) return '&gt;';
      if (cp === 34) return '&quot;';
      if (cp === 39) return '&#39;';
      if (cp > 127) return `&#${cp};`;
      return ch;
    }).join('');
  }

  private toUnicodeEscapes(input: string): string {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      if (cp > 0xFFFF) {
        return `\\u{${cp.toString(16).toUpperCase()}}`;
      }
      return `\\u${cp.toString(16).padStart(4, '0').toUpperCase()}`;
    }).join('');
  }

  private toHexEscapes(input: string): string {
    const bytes = new TextEncoder().encode(input);
    return Array.from(bytes).map(b => `\\x${b.toString(16).padStart(2, '0').toUpperCase()}`).join('');
  }

  private toOctalEscapes(input: string): string {
    const bytes = new TextEncoder().encode(input);
    return Array.from(bytes).map(b => `\\${b.toString(8).padStart(3, '0')}`).join('');
  }

  private toDecimalEntities(input: string): string {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      return `&#${cp};`;
    }).join('');
  }

  // -- Byte-level view --

  private buildByteView(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, '0').toUpperCase();
      const hexPart = Array.from(chunk).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      const asciiPart = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      lines.push(`${offset}  ${hexPart.padEnd(48)}  |${asciiPart}|`);
    }
    return lines.join('\n');
  }

  // -- Character table --

  private buildCharTable(input: string): CharBreakdown[] {
    return Array.from(input).map(ch => {
      const cp = ch.codePointAt(0)!;
      const utf8Bytes = Array.from(new TextEncoder().encode(ch));
      return {
        char: ch,
        codePoint: cp,
        utf8Hex: utf8Bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
        utf8Bytes,
        ascii: cp <= 127 ? cp.toString() : 'N/A',
        latin1: cp <= 255 ? cp.toString(16).padStart(2, '0').toUpperCase() : 'N/A',
        urlEncoded: encodeURIComponent(ch),
        htmlEntity: cp > 127 ? `&#${cp};` : ch,
        unicodeEscape: cp > 0xFFFF ? `\\u{${cp.toString(16).toUpperCase()}}` : `\\u${cp.toString(16).padStart(4, '0').toUpperCase()}`,
        hexEscape: utf8Bytes.map(b => `\\x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(''),
        octalEscape: utf8Bytes.map(b => `\\${b.toString(8).padStart(3, '0')}`).join(''),
        decimalEntity: `&#${cp};`,
      };
    });
  }

  // -- Actions --

  clearAll() {
    this.textInput = '';
    this.encodings = [];
    this.charTable = [];
    this.byteView = '';
    this.inputCharCount = 0;
    this.totalBytes = 0;
  }

  loadSample() {
    this.textInput = 'Hello, World! \u00e9\u00f1\u00fc \u4f60\u597d \ud83c\udf0d';
    this.onInput();
  }

  toggleCharTable() {
    this.showCharTable = !this.showCharTable;
  }

  async copyEncoding(enc: EncodingResult) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(enc.value);
      enc.copied = true;
      setTimeout(() => (enc.copied = false), 2000);
    } catch {
      this.fallbackCopy(enc.value);
      enc.copied = true;
      setTimeout(() => (enc.copied = false), 2000);
    }
  }

  async copyByteView() {
    if (!this.isBrowser || !this.byteView) return;
    try {
      await navigator.clipboard.writeText(this.byteView);
    } catch {
      this.fallbackCopy(this.byteView);
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
  }
}
