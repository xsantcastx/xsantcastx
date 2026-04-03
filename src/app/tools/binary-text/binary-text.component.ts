import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ToolMode = 'text-to-binary' | 'binary-to-text';
type Separator = 'space' | 'none' | 'dash';
type Encoding = 'ascii' | 'utf8';

interface CharBreakdown {
  char: string;
  codePoint: number;
  binary: string;
  byteCount: number;
}

@Component({
  selector: 'app-binary-text',
  templateUrl: './binary-text.component.html',
  styleUrls: ['./binary-text.component.css'],
  standalone: false
})
export class BinaryTextComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Binary to Text Converter — convert text to binary and back with character breakdown. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/binary-text')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/binary-text')}`;

  // State
  mode: ToolMode = 'text-to-binary';
  separator: Separator = 'space';
  encoding: Encoding = 'ascii';
  input = '';
  output = '';
  errorMessage = '';
  copied = false;
  bitCount = 0;
  byteCount = 0;
  charBreakdown: CharBreakdown[] = [];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode toggle ────────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  toggleMode() {
    this.mode = this.mode === 'text-to-binary' ? 'binary-to-text' : 'text-to-binary';
    // Swap input/output
    const prev = this.output;
    this.clearAll();
    if (prev) {
      this.input = prev;
      this.onInput();
    }
  }

  // ── Options ────────────────────────────────────────────────────────

  setSeparator(sep: Separator) {
    this.separator = sep;
    if (this.input) this.convert();
  }

  setEncoding(enc: Encoding) {
    this.encoding = enc;
    if (this.input) this.convert();
  }

  // ── Live conversion (debounced) ────────────────────────────────────

  onInput() {
    this.errorMessage = '';
    this.copied = false;

    if (!this.input.trim()) {
      this.clearResults();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 150);
  }

  private convert() {
    const raw = this.input;
    if (!raw.trim()) {
      this.clearResults();
      return;
    }

    try {
      if (this.mode === 'text-to-binary') {
        this.textToBinary(raw);
      } else {
        this.binaryToText(raw);
      }
      this.errorMessage = '';
    } catch (e: any) {
      this.errorMessage = e.message || 'Conversion failed.';
      this.clearResults();
    }
  }

  // ── Text -> Binary ─────────────────────────────────────────────────

  private textToBinary(text: string) {
    const breakdown: CharBreakdown[] = [];
    const binaryParts: string[] = [];

    if (this.encoding === 'ascii') {
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code > 127) {
          throw new Error(`Character "${ch}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) is outside ASCII range. Switch to UTF-8 encoding.`);
        }
        const bin = code.toString(2).padStart(8, '0');
        breakdown.push({ char: ch, codePoint: code, binary: bin, byteCount: 1 });
        binaryParts.push(bin);
      }
    } else {
      const encoder = new TextEncoder();
      for (const ch of text) {
        const bytes = encoder.encode(ch);
        const code = ch.codePointAt(0) || 0;
        const binBytes = Array.from(bytes).map(b => b.toString(2).padStart(8, '0'));
        const bin = binBytes.join(' ');
        breakdown.push({ char: ch, codePoint: code, binary: bin, byteCount: bytes.length });
        binaryParts.push(...binBytes);
      }
    }

    const sep = this.getSeparatorChar();
    this.output = binaryParts.join(sep);
    this.charBreakdown = breakdown;
    this.bitCount = binaryParts.length * 8;
    this.byteCount = binaryParts.length;
  }

  // ── Binary -> Text ─────────────────────────────────────────────────

  private binaryToText(binary: string) {
    // Normalize: strip common separators and split into 8-bit groups
    const cleaned = binary.replace(/[\s\-,|]+/g, ' ').trim();

    // Check easter egg BEFORE processing
    if (cleaned === '01101000 01101001') {
      this.eggs.trigger('binary-hi');
    }

    let groups: string[];
    if (cleaned.includes(' ')) {
      groups = cleaned.split(/\s+/);
    } else {
      // No separator — split every 8 chars
      if (cleaned.length % 8 !== 0) {
        throw new Error(`Binary string length (${cleaned.length}) is not a multiple of 8. Each character needs 8 bits.`);
      }
      groups = cleaned.match(/.{8}/g) || [];
    }

    // Validate all groups are valid binary
    for (const g of groups) {
      if (!/^[01]+$/.test(g)) {
        throw new Error(`Invalid binary value "${g}". Only 0 and 1 are allowed.`);
      }
      if (g.length !== 8) {
        throw new Error(`Binary group "${g}" has ${g.length} bits — expected 8 bits per byte.`);
      }
    }

    const breakdown: CharBreakdown[] = [];

    if (this.encoding === 'ascii') {
      let text = '';
      for (const g of groups) {
        const code = parseInt(g, 2);
        if (code > 127) {
          throw new Error(`Byte ${g} (${code}) exceeds ASCII range (0-127). Switch to UTF-8 encoding.`);
        }
        const ch = String.fromCharCode(code);
        text += ch;
        breakdown.push({ char: ch, codePoint: code, binary: g, byteCount: 1 });
      }
      this.output = text;
    } else {
      const byteArray = new Uint8Array(groups.map(g => parseInt(g, 2)));
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const text = decoder.decode(byteArray);
      // Build breakdown per decoded character
      const encoder = new TextEncoder();
      for (const ch of text) {
        const bytes = encoder.encode(ch);
        const code = ch.codePointAt(0) || 0;
        const bin = Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
        breakdown.push({ char: ch, codePoint: code, binary: bin, byteCount: bytes.length });
      }
      this.output = text;
    }

    this.charBreakdown = breakdown;
    this.bitCount = groups.length * 8;
    this.byteCount = groups.length;
  }

  // ── Copy ───────────────────────────────────────────────────────────

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

  // ── Helpers ────────────────────────────────────────────────────────

  clearAll() {
    this.input = '';
    this.clearResults();
  }

  private clearResults() {
    this.output = '';
    this.errorMessage = '';
    this.copied = false;
    this.bitCount = 0;
    this.byteCount = 0;
    this.charBreakdown = [];
  }

  private getSeparatorChar(): string {
    switch (this.separator) {
      case 'space': return ' ';
      case 'dash':  return '-';
      case 'none':  return '';
    }
  }

  get hasResults(): boolean {
    return !!this.output;
  }

  get modeLabel(): string {
    return this.mode === 'text-to-binary' ? 'Text to Binary' : 'Binary to Text';
  }

  get inputPlaceholder(): string {
    return this.mode === 'text-to-binary'
      ? 'Type your text here...'
      : 'Paste binary here (e.g. 01001000 01101001)';
  }

  loadSample() {
    if (this.mode === 'text-to-binary') {
      this.input = 'Hello, World!';
    } else {
      this.input = '01001000 01100101 01101100 01101100 01101111';
    }
    this.onInput();
  }

  trackByIndex(index: number): number {
    return index;
  }
}
