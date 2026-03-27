import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';

type ToolMode = 'encode' | 'decode';

@Component({
  selector: 'app-base64-encoder',
  templateUrl: './base64-encoder.component.html',
  styleUrls: ['./base64-encoder.component.css'],
  standalone: false
})
export class Base64EncoderComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Base64 Encoder & Decoder — encode text, files, URL-safe Base64. No sign-up 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools/base64-encoder')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/base64-encoder')}`;

  // Mode & options
  mode: ToolMode = 'encode';
  urlSafe = false;
  fileMode = false;

  // Text I/O
  textInput = '';
  output = '';

  // File mode state
  isDragOver = false;
  fileName = '';
  fileSize = 0;
  fileMimeType = '';

  // UI state
  errorMessage = '';
  copied = false;
  inputCharCount = 0;
  outputCharCount = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode / option changes ──────────────────────────────────────────────────

  setMode(m: ToolMode) {
    this.mode = m;
    this.clearAll();
  }

  onUrlSafeChange() {
    if (this.output) this.processText();
  }

  onFileModeChange() {
    this.clearAll();
  }

  // ── Live processing (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.inputCharCount = this.textInput.length;
    this.errorMessage = '';

    if (!this.textInput.trim()) {
      this.output = '';
      this.outputCharCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processText(), 300);
  }

  private processText() {
    if (this.mode === 'encode') {
      this.encodeText(this.textInput);
    } else {
      this.decodeText(this.textInput);
    }
  }

  // ── Encode ─────────────────────────────────────────────────────────────────

  private encodeText(input: string) {
    try {
      // Handle Unicode: encode to UTF-8 bytes first
      const bytes = new TextEncoder().encode(input);
      let binary = '';
      bytes.forEach(b => (binary += String.fromCharCode(b)));
      let result = btoa(binary);
      if (this.urlSafe) result = this.toUrlSafe(result);
      this.output = result;
      this.outputCharCount = result.length;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.errorMessage = 'Encoding failed — unexpected error.';
    }
  }

  // ── Decode ─────────────────────────────────────────────────────────────────

  private decodeText(input: string) {
    try {
      let b64 = input.trim();
      // Accept URL-safe chars regardless of urlSafe toggle
      b64 = this.fromUrlSafe(b64);
      // Pad if necessary
      b64 = this.padBase64(b64);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const result = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      this.output = result;
      this.outputCharCount = result.length;
      this.errorMessage = '';
    } catch {
      this.output = '';
      this.outputCharCount = 0;
      this.errorMessage = 'Invalid Base64 — input contains characters that cannot be decoded.';
    }
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
    this.output = '';

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.slice(i, i + chunk));
        }
        let result = btoa(binary);
        if (this.urlSafe) result = this.toUrlSafe(result);
        this.output = result;
        this.outputCharCount = result.length;
        this.inputCharCount = file.size;
      } catch {
        this.errorMessage = 'Failed to encode file. The file may be too large or corrupted.';
        this.output = '';
      }
    };
    reader.onerror = () => {
      this.errorMessage = 'Failed to read file.';
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.outputCharCount = 0;
    this.fileName = '';
    this.fileSize = 0;
    this.fileMimeType = '';
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
    this.fileMode = false;
    if (this.mode === 'encode') {
      this.textInput = 'Hello, World! 🌍\nThis is a Base64 encoding sample.\nSupports Unicode: café, naïve, 日本語';
    } else {
      this.textInput = 'SGVsbG8sIFdvcmxkISDwn4yNClRoaXMgaXMgYSBCYXNlNjQgZW5jb2Rpbmcgc2FtcGxlLgpTdXBwb3J0cyBVbmljb2RlOiBjYWbDqSwgbmHDr3ZlLCDml6XmnKw8U+8A==';
    }
    this.onInput();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toUrlSafe(b64: string): string {
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private fromUrlSafe(b64: string): string {
    return b64.replace(/-/g, '+').replace(/_/g, '/');
  }

  private padBase64(b64: string): string {
    const pad = b64.length % 4;
    if (pad === 0) return b64;
    return b64 + '='.repeat(4 - pad);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  get encodedSizeIncrease(): number {
    if (!this.inputCharCount || !this.outputCharCount || this.mode !== 'encode') return 0;
    return Math.round(((this.outputCharCount - this.inputCharCount) / this.inputCharCount) * 100);
  }
}
