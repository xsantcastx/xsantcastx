import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type NumberBase = 2 | 8 | 10 | 16;

interface BaseOption {
  label: string;
  value: NumberBase;
  prefix: string;
  pattern: RegExp;
  placeholder: string;
}

interface QuickValue {
  label: string;
  decimal: string;
}

@Component({
    selector: 'app-base-converter',
    templateUrl: './base-converter.component.html',
    styleUrls: ['./base-converter.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class BaseConverterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Number Base Converter — Binary, Octal, Decimal, Hex with bit visualization. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/base-converter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/base-converter')}`;

  readonly bases: BaseOption[] = [
    { label: 'Binary',      value: 2,  prefix: '0b', pattern: /^[01]+$/,            placeholder: '10101010' },
    { label: 'Octal',       value: 8,  prefix: '0o', pattern: /^[0-7]+$/,           placeholder: '252' },
    { label: 'Decimal',     value: 10, prefix: '',    pattern: /^[0-9]+$/,           placeholder: '170' },
    { label: 'Hexadecimal', value: 16, prefix: '0x', pattern: /^[0-9a-fA-F]+$/,     placeholder: 'AA' },
  ];

  readonly quickValues: QuickValue[] = [
    { label: 'Max Int8',       decimal: '127' },
    { label: 'Max Uint8',      decimal: '255' },
    { label: 'Max Int16',      decimal: '32767' },
    { label: 'Max Uint16',     decimal: '65535' },
    { label: 'Max Int32',      decimal: '2147483647' },
    { label: 'Max Uint32',     decimal: '4294967295' },
    { label: 'Byte (1 KB)',    decimal: '1024' },
    { label: '1 MB',           decimal: '1048576' },
  ];

  // State
  selectedBase: NumberBase = 10;
  inputValue = '';
  hexUppercase = true;
  errorMessage = '';
  copiedField: string | null = null;

  // Conversion results
  binaryResult = '';
  octalResult = '';
  decimalResult = '';
  hexResult = '';

  // Bit visualization
  bitGroups: string[][] = [];
  bitWidth: 8 | 16 | 32 = 8;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Base selection ──────────────────────────────────────────────────

  get currentBase(): BaseOption {
    return this.bases.find(b => b.value === this.selectedBase)!;
  }

  selectBase(base: NumberBase) {
    this.selectedBase = base;
    this.errorMessage = '';
    if (this.inputValue) {
      this.convert();
    }
  }

  // ── Input handling ──────────────────────────────────────────────────

  onInput() {
    this.errorMessage = '';
    this.copiedField = null;

    if (!this.inputValue.trim()) {
      this.clearResults();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 150);
  }

  private convert() {
    const raw = this.inputValue.trim();
    if (!raw) {
      this.clearResults();
      return;
    }

    // Validate input against current base
    if (!this.currentBase.pattern.test(raw)) {
      this.errorMessage = `Invalid ${this.currentBase.label.toLowerCase()} input. Allowed characters: ${this.getAllowedChars()}`;
      this.clearResults();
      return;
    }

    try {
      // Parse to BigInt
      let value: bigint;
      switch (this.selectedBase) {
        case 2:  value = BigInt('0b' + raw); break;
        case 8:  value = BigInt('0o' + raw); break;
        case 10: value = BigInt(raw); break;
        case 16: value = BigInt('0x' + raw); break;
        default: return;
      }

      if (value < 0n) {
        this.errorMessage = 'Negative numbers are not supported.';
        this.clearResults();
        return;
      }

      // Convert to all bases
      this.binaryResult = value.toString(2);
      this.octalResult = value.toString(8);
      this.decimalResult = value.toString(10);
      this.hexResult = this.hexUppercase ? value.toString(16).toUpperCase() : value.toString(16).toLowerCase();
      this.errorMessage = '';

      // Build bit visualization
      this.buildBitVisualization(value);

      // Easter egg: 42 in decimal
      if (value === 42n) {
        this.eggs.trigger('base-meaning');
      }
    } catch {
      this.errorMessage = 'Could not parse the input value.';
      this.clearResults();
    }
  }

  // ── Bit visualization ──────────────────────────────────────────────

  private buildBitVisualization(value: bigint) {
    const binStr = value.toString(2);

    // Auto-select bit width
    if (binStr.length <= 8) {
      this.bitWidth = 8;
    } else if (binStr.length <= 16) {
      this.bitWidth = 16;
    } else {
      this.bitWidth = 32;
    }

    // Pad to bit width
    const padded = binStr.padStart(this.bitWidth, '0');

    // Split into groups of 8
    this.bitGroups = [];
    for (let i = 0; i < padded.length; i += 8) {
      this.bitGroups.push(padded.slice(i, i + 8).split(''));
    }
  }

  setBitWidth(width: 8 | 16 | 32) {
    this.bitWidth = width;
    if (this.binaryResult) {
      const padded = this.binaryResult.padStart(width, '0');
      // If the binary is longer than the width, use actual length rounded up to 8
      const actualLen = Math.max(width, Math.ceil(this.binaryResult.length / 8) * 8);
      const bits = this.binaryResult.padStart(actualLen, '0');
      this.bitGroups = [];
      for (let i = 0; i < bits.length; i += 8) {
        this.bitGroups.push(bits.slice(i, i + 8).split(''));
      }
    }
  }

  // ── Hex case toggle ────────────────────────────────────────────────

  toggleHexCase() {
    this.hexUppercase = !this.hexUppercase;
    if (this.hexResult) {
      this.hexResult = this.hexUppercase ? this.hexResult.toUpperCase() : this.hexResult.toLowerCase();
    }
  }

  // ── Quick values ───────────────────────────────────────────────────

  loadQuickValue(qv: QuickValue) {
    this.selectedBase = 10;
    this.inputValue = qv.decimal;
    this.convert();
  }

  // ── Copy ───────────────────────────────────────────────────────────

  async copyResult(value: string, field: string) {
    if (!value || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      setTimeout(() => (this.copiedField = null), 2000);
    } catch {
      this.fallbackCopy(value, field);
    }
  }

  private fallbackCopy(text: string, field: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedField = field;
    setTimeout(() => (this.copiedField = null), 2000);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  clearAll() {
    this.inputValue = '';
    this.errorMessage = '';
    this.copiedField = null;
    this.clearResults();
  }

  private clearResults() {
    this.binaryResult = '';
    this.octalResult = '';
    this.decimalResult = '';
    this.hexResult = '';
    this.bitGroups = [];
  }

  private getAllowedChars(): string {
    switch (this.selectedBase) {
      case 2:  return '0, 1';
      case 8:  return '0-7';
      case 10: return '0-9';
      case 16: return '0-9, A-F';
      default: return '';
    }
  }

  get hasResults(): boolean {
    return !!this.binaryResult || !!this.octalResult || !!this.decimalResult || !!this.hexResult;
  }

  formatBinary(bin: string): string {
    // Add spaces every 4 bits for readability
    return bin.replace(/(.{4})/g, '$1 ').trim();
  }

  formatDecimal(dec: string): string {
    // Add commas for thousands
    return dec.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  loadSample() {
    this.selectedBase = 10;
    this.inputValue = '255';
    this.convert();
  }
}
