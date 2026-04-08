import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type InputMode = 'text' | 'file';

interface HmacResult {
  algorithm: string;
  hmac: string;
  copied: boolean;
}

@Component({
  selector: 'app-hmac-generator',
  templateUrl: './hmac-generator.component.html',
  styleUrls: ['./hmac-generator.component.css'],
  standalone: false
})
export class HmacGeneratorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HMAC Generator — SHA-256, SHA-384, SHA-512. Client-side, no data leaves your browser.')}&url=${encodeURIComponent(SITE_URL + '/tools/hmac-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/hmac-generator')}`;

  // Options
  inputMode: InputMode = 'text';
  selectedAlgorithm = 'SHA-256';
  uppercase = false;

  // Text I/O
  messageInput = '';
  secretKey = '';
  hmacResults: HmacResult[] = [];

  // File mode state
  isDragOver = false;
  fileName = '';
  fileSize = 0;
  fileMimeType = '';
  private fileData: Uint8Array | null = null;

  // UI state
  errorMessage = '';
  isHashing = false;
  inputCharCount = 0;
  showSecret = false;
  secretCopied = false;

  readonly algorithms = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live processing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.inputCharCount = this.messageInput.length;
    this.errorMessage = '';

    if (!this.messageInput.trim() && !this.fileData) {
      this.hmacResults = [];
      return;
    }

    if (!this.secretKey) {
      this.hmacResults = [];
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processInput(), 300);
  }

  onSecretChange() {
    this.errorMessage = '';
    if (!this.secretKey) {
      this.hmacResults = [];
      return;
    }
    this.onInput();
  }

  onAlgorithmChange() {
    if (this.secretKey && (this.messageInput.trim() || this.fileData)) {
      this.processInput();
    }
  }

  onInputModeChange() {
    this.clearAll();
  }

  onUppercaseChange() {
    this.hmacResults = this.hmacResults.map(r => ({
      ...r,
      hmac: this.uppercase ? r.hmac.toUpperCase() : r.hmac.toLowerCase()
    }));
  }

  private async processInput() {
    if (!this.isBrowser) return;
    if (!this.secretKey) return;

    this.isHashing = true;
    try {
      let data: Uint8Array;
      if (this.inputMode === 'file' && this.fileData) {
        data = this.fileData;
      } else {
        // Easter egg: HMAC of "secret" with key "secret"
        if (this.messageInput.trim() === 'secret' && this.secretKey === 'secret') {
          this.eggs.trigger('hmac-inception');
        }
        data = new TextEncoder().encode(this.messageInput);
      }
      await this.generateAllHmacs(data);
    } catch {
      this.errorMessage = 'HMAC generation failed — unexpected error.';
      this.hmacResults = [];
    } finally {
      this.isHashing = false;
    }
  }

  // ── HMAC generation ───────────────────────────────────────────────────────

  private async generateAllHmacs(data: Uint8Array) {
    const results: HmacResult[] = [];

    for (const algo of this.algorithms) {
      try {
        const hmac = await this.computeHmac(algo, data);
        results.push({
          algorithm: algo,
          hmac: this.uppercase ? hmac.toUpperCase() : hmac.toLowerCase(),
          copied: false
        });
      } catch {
        results.push({
          algorithm: algo,
          hmac: 'Unsupported in this browser',
          copied: false
        });
      }
    }

    this.hmacResults = results;
    this.errorMessage = '';
  }

  private async computeHmac(algo: string, data: Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secretKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: algo } },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return this.bufferToHex(signature);
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
    this.hmacResults = [];

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        this.fileData = new Uint8Array(arrayBuffer);
        this.inputCharCount = file.size;
        if (this.secretKey) {
          this.isHashing = true;
          await this.generateAllHmacs(this.fileData);
          this.isHashing = false;
        }
      } catch {
        this.errorMessage = 'Failed to read file.';
        this.fileData = null;
      }
    };
    reader.onerror = () => {
      this.errorMessage = 'Failed to read file.';
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Secret key generation ──────────────────────────────────────────────────

  generateRandomKey() {
    if (!this.isBrowser) return;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    this.secretKey = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    this.onSecretChange();
  }

  toggleSecretVisibility() {
    this.showSecret = !this.showSecret;
  }

  async copySecret() {
    if (!this.secretKey || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.secretKey);
      this.secretCopied = true;
      setTimeout(() => (this.secretCopied = false), 2000);
    } catch {
      this.fallbackCopyText(this.secretKey);
      this.secretCopied = true;
      setTimeout(() => (this.secretCopied = false), 2000);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  clearAll() {
    this.messageInput = '';
    this.secretKey = '';
    this.hmacResults = [];
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.fileName = '';
    this.fileSize = 0;
    this.fileMimeType = '';
    this.fileData = null;
    this.isHashing = false;
    this.showSecret = false;
    this.secretCopied = false;
  }

  async copyHmac(result: HmacResult) {
    if (!result.hmac || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(result.hmac);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    } catch {
      this.fallbackCopy(result);
    }
  }

  private fallbackCopy(result: HmacResult) {
    if (!this.isBrowser) return;
    this.fallbackCopyText(result.hmac);
    result.copied = true;
    setTimeout(() => (result.copied = false), 2000);
  }

  private fallbackCopyText(text: string) {
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

  async copyAllResults() {
    if (!this.hmacResults.length || !this.isBrowser) return;
    const text = this.hmacResults
      .map(r => `${r.algorithm}: ${r.hmac}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.fallbackCopyText(text);
    }
  }

  loadSample() {
    this.inputMode = 'text';
    this.messageInput = 'Hello, World!';
    this.secretKey = 'my-secret-key';
    this.onInput();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  get hasResults(): boolean {
    return this.hmacResults.length > 0;
  }
}
