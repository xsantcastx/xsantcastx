import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type InputMode = 'text' | 'file';
type TabMode = 'generate' | 'compare';

interface HashResult {
  algorithm: string;
  hash: string;
  copied: boolean;
}

@Component({
  selector: 'app-hash-generator',
  templateUrl: './hash-generator.component.html',
  styleUrls: ['./hash-generator.component.css'],
  standalone: false
})
export class HashGeneratorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Hash Generator — MD5, SHA-1, SHA-256, SHA-384, SHA-512. Client-side only, no sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/hash-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/hash-generator')}`;

  // Mode & options
  tabMode: TabMode = 'generate';
  inputMode: InputMode = 'text';
  uppercase = false;

  // Text I/O
  textInput = '';
  hashResults: HashResult[] = [];

  // File mode state
  isDragOver = false;
  fileName = '';
  fileSize = 0;
  fileMimeType = '';

  // Compare mode
  compareHash1 = '';
  compareHash2 = '';
  compareResult: 'match' | 'mismatch' | null = null;

  // UI state
  errorMessage = '';
  isHashing = false;
  inputCharCount = 0;

  readonly algorithms = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Tab / option changes ──────────────────────────────────────────────────

  setTabMode(m: TabMode) {
    this.tabMode = m;
    this.clearAll();
  }

  onInputModeChange() {
    this.clearAll();
  }

  onUppercaseChange() {
    this.hashResults = this.hashResults.map(r => ({
      ...r,
      hash: this.uppercase ? r.hash.toUpperCase() : r.hash.toLowerCase()
    }));
  }

  // ── Live processing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput.trim()) {
      this.hashResults = [];
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private async processText() {
    if (!this.isBrowser) return;
    this.isHashing = true;
    try {
      // Easter egg: hash "42"
      if (this.textInput.trim() === '42') this.eggs.trigger('hash-meaning');
      const data = new TextEncoder().encode(this.textInput);
      await this.generateAllHashes(data);
    } catch {
      this.errorMessage = 'Hashing failed — unexpected error.';
      this.hashResults = [];
    } finally {
      this.isHashing = false;
    }
  }

  // ── Hash generation ───────────────────────────────────────────────────────

  private async generateAllHashes(data: Uint8Array) {
    const results: HashResult[] = [];

    for (const algo of this.algorithms) {
      try {
        const hash = await this.computeHash(algo, data);
        results.push({
          algorithm: algo,
          hash: this.uppercase ? hash.toUpperCase() : hash.toLowerCase(),
          copied: false
        });
      } catch {
        results.push({
          algorithm: algo,
          hash: 'Unsupported in this browser',
          copied: false
        });
      }
    }

    this.hashResults = results;
    this.errorMessage = '';
  }

  private async computeHash(algo: string, data: Uint8Array): Promise<string> {
    if (algo === 'MD5') {
      return this.md5(data);
    }

    // Map display names to SubtleCrypto names
    const cryptoAlgoMap: Record<string, string> = {
      'SHA-1': 'SHA-1',
      'SHA-256': 'SHA-256',
      'SHA-384': 'SHA-384',
      'SHA-512': 'SHA-512'
    };

    const cryptoAlgo = cryptoAlgoMap[algo];
    if (!cryptoAlgo) throw new Error('Unknown algorithm');

    const hashBuffer = await crypto.subtle.digest(cryptoAlgo, new Uint8Array(data));
    return this.bufferToHex(hashBuffer);
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── MD5 implementation ────────────────────────────────────────────────────

  private md5(data: Uint8Array): string {
    const bytes = Array.from(data);
    let d0 = 0x67452301, d1 = 0xEFCDAB89, d2 = 0x98BADCFE, d3 = 0x10325476;
    const bitLen = bytes.length * 8;

    // Padding
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    // Append length in bits (little-endian, 64-bit)
    for (let i = 0; i < 8; i++) {
      bytes.push((bitLen >>> (i * 8)) & 0xff);
    }

    const S = [
      7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
      5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
      4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
      6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
    ];

    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) {
      K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    }

    for (let offset = 0; offset < bytes.length; offset += 64) {
      const M = new Uint32Array(16);
      for (let j = 0; j < 16; j++) {
        const idx = offset + j * 4;
        M[j] = bytes[idx] | (bytes[idx + 1] << 8) | (bytes[idx + 2] << 16) | (bytes[idx + 3] << 24);
      }

      let a = d0, b = d1, c = d2, d = d3;

      for (let i = 0; i < 64; i++) {
        let f: number, g: number;
        if (i < 16) {
          f = (b & c) | (~b & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | (~d & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          g = (7 * i) % 16;
        }

        f = (f + a + K[i] + M[g]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
      }

      d0 = (d0 + a) >>> 0;
      d1 = (d1 + b) >>> 0;
      d2 = (d2 + c) >>> 0;
      d3 = (d3 + d) >>> 0;
    }

    const toHex = (n: number) => {
      let hex = '';
      for (let i = 0; i < 4; i++) {
        hex += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      }
      return hex;
    };

    return toHex(d0) + toHex(d1) + toHex(d2) + toHex(d3);
  }

  // ── File mode ──────────────────────────────────────────────────────────────

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) this.processFile(file);
    input.value = '';
  }

  private processFile(file: File) {
    if (!this.isBrowser) return;
    this.fileName = file.name;
    this.fileSize = file.size;
    this.fileMimeType = file.type || 'application/octet-stream';
    this.errorMessage = '';
    this.hashResults = [];
    this.isHashing = true;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        await this.generateAllHashes(data);
        this.inputCharCount = file.size;
      } catch {
        this.errorMessage = 'Failed to hash file. The file may be too large or corrupted.';
        this.hashResults = [];
      } finally {
        this.isHashing = false;
      }
    };
    reader.onerror = () => {
      this.errorMessage = 'Failed to read file.';
      this.isHashing = false;
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Compare mode ───────────────────────────────────────────────────────────

  onCompareInput() {
    if (!this.compareHash1.trim() || !this.compareHash2.trim()) {
      this.compareResult = null;
      return;
    }
    const h1 = this.compareHash1.trim().toLowerCase();
    const h2 = this.compareHash2.trim().toLowerCase();
    this.compareResult = h1 === h2 ? 'match' : 'mismatch';
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.hashResults = [];
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.fileName = '';
    this.fileSize = 0;
    this.fileMimeType = '';
    this.compareHash1 = '';
    this.compareHash2 = '';
    this.compareResult = null;
    this.isHashing = false;
  }

  async copyHash(result: HashResult) {
    if (!result.hash || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(result.hash);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    } catch {
      this.fallbackCopy(result);
    }
  }

  private fallbackCopy(result: HashResult) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = result.hash;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    result.copied = true;
    setTimeout(() => (result.copied = false), 2000);
  }

  loadSample() {
    this.inputMode = 'text';
    this.textInput = 'Hello, World!';
    this.onInput();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  get hasResults(): boolean {
    return this.hashResults.length > 0;
  }
}
