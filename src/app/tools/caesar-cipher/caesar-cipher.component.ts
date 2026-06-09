import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type CipherMode = 'encode' | 'decode';

@Component({
    selector: 'app-caesar-cipher',
    templateUrl: './caesar-cipher.component.html',
    styleUrls: ['./caesar-cipher.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class CaesarCipherComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free ROT13 & Caesar Cipher Tool — encode, decode, brute-force all 26 rotations. No sign-up needed.')}&url=${encodeURIComponent(SITE_URL + '/tools/caesar-cipher')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/caesar-cipher')}`;

  // Mode & options
  mode: CipherMode = 'encode';
  shift = 13;
  showBruteForce = false;

  // I/O
  textInput = '';
  output = '';

  // Brute force results
  bruteForceResults: { shift: number; text: string }[] = [];

  // UI state
  copied = false;
  copiedIndex: number | null = null;
  inputCharCount = 0;
  outputCharCount = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode changes ──────────────────────────────────────────────────

  setMode(m: CipherMode) {
    this.mode = m;
    if (this.textInput) this.process();
  }

  onShiftChange() {
    if (this.shift < 1) this.shift = 1;
    if (this.shift > 25) this.shift = 25;
    if (this.textInput) this.process();
  }

  setROT13() {
    this.shift = 13;
    if (this.textInput) this.process();
  }

  // ── Live processing (debounced 200ms) ─────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;

    if (!this.textInput.trim()) {
      this.output = '';
      this.outputCharCount = 0;
      this.bruteForceResults = [];
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.process(), 200);
  }

  private process() {
    const effectiveShift = this.mode === 'encode' ? this.shift : (26 - this.shift);
    this.output = this.applyCaesar(this.textInput, effectiveShift);
    this.outputCharCount = this.output.length;

    // Build brute force view
    this.bruteForceResults = [];
    for (let s = 1; s <= 25; s++) {
      this.bruteForceResults.push({
        shift: s,
        text: this.applyCaesar(this.textInput, s)
      });
    }

    // Easter egg: shift 13 + input contains "hello"
    if (this.shift === 13 && this.textInput.toLowerCase().includes('hello')) {
      this.eggs.trigger('caesar-uryyb');
    }
  }

  // ── Caesar cipher core ────────────────────────────────────────────

  private applyCaesar(text: string, shift: number): string {
    return text.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch >= 'a' && ch <= 'z' ? 97 : 65;
      return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
  }

  // ── Actions ───────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.bruteForceResults = [];
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

  async copyBruteForceItem(index: number) {
    if (!this.isBrowser) return;
    const text = this.bruteForceResults[index]?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex = index;
      setTimeout(() => (this.copiedIndex = null), 2000);
    } catch {
      this.fallbackCopy(text);
      this.copiedIndex = index;
      setTimeout(() => (this.copiedIndex = null), 2000);
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
    if (this.mode === 'encode') {
      this.textInput = 'The quick brown fox jumps over the lazy dog! Hello, World 123.';
    } else {
      this.textInput = 'Gur dhvpx oebja sbk whzcf bire gur ynml qbt! Uryyb, Jbeyq 123.';
    }
    this.onInput();
  }
}
