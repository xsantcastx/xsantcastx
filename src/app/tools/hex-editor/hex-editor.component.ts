import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

type HexMode = 'file' | 'text-to-hex' | 'hex-to-text';

interface HexRow {
  offset: string;
  bytes: { value: string; index: number }[];
  ascii: string;
}

@Component({
    selector: 'app-hex-editor',
    templateUrl: './hex-editor.component.html',
    styleUrls: ['./hex-editor.component.css'],
    imports: [FormsModule, ToolsSharedModule, DecimalPipe]
})
export class HexEditorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Mode
  mode: HexMode = 'file';

  // File state
  isDragOver = false;
  fileName = '';
  fileSize = 0;
  fileBytes: Uint8Array | null = null;

  // Text/hex conversion
  textInput = '';
  hexInput = '';
  conversionOutput = '';

  // Hex dump display
  hexRows: HexRow[] = [];
  hoveredByteIndex = -1;

  // Search
  searchPattern = '';
  searchMatches: number[] = [];
  currentMatchIndex = -1;

  // UI state
  errorMessage = '';
  copied = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode switching ──────────────────────────────────────────────────

  setMode(m: HexMode) {
    this.mode = m;
    this.clearAll();
  }

  // ── File handling ───────────────────────────────────────────────────

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
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        this.fileBytes = new Uint8Array(arrayBuffer);
        this.buildHexRows(this.fileBytes);
        this.checkMagicBytes(this.fileBytes);
      } catch {
        this.errorMessage = 'Failed to read file. It may be corrupted.';
        this.fileBytes = null;
        this.hexRows = [];
      }
    };
    reader.onerror = () => {
      this.errorMessage = 'Failed to read file.';
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Text-to-hex conversion ─────────────────────────────────────────

  onTextInput() {
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.textInput.trim()) {
        this.conversionOutput = '';
        this.hexRows = [];
        this.fileBytes = null;
        return;
      }
      const bytes = new TextEncoder().encode(this.textInput);
      this.fileBytes = bytes;
      this.fileSize = bytes.length;
      this.buildHexRows(bytes);

      // Build hex string output
      this.conversionOutput = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

      this.checkMagicBytes(bytes);
    }, 300);
  }

  // ── Hex-to-text conversion ─────────────────────────────────────────

  onHexInput() {
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.hexInput.trim()) {
        this.conversionOutput = '';
        this.hexRows = [];
        this.fileBytes = null;
        return;
      }
      try {
        const cleaned = this.hexInput.replace(/[^0-9a-fA-F]/g, '');
        if (cleaned.length % 2 !== 0) {
          this.errorMessage = 'Hex string must have an even number of characters.';
          return;
        }
        const bytes = new Uint8Array(cleaned.length / 2);
        for (let i = 0; i < cleaned.length; i += 2) {
          bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
        }
        this.fileBytes = bytes;
        this.fileSize = bytes.length;
        this.buildHexRows(bytes);
        this.conversionOutput = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } catch {
        this.errorMessage = 'Invalid hex input.';
        this.conversionOutput = '';
      }
    }, 300);
  }

  // ── Build hex dump rows (16 bytes per row) ─────────────────────────

  private buildHexRows(data: Uint8Array) {
    this.hexRows = [];
    const rowCount = Math.ceil(data.length / 16);
    for (let r = 0; r < rowCount; r++) {
      const offset = (r * 16).toString(16).padStart(8, '0').toUpperCase();
      const bytes: { value: string; index: number }[] = [];
      let ascii = '';
      for (let c = 0; c < 16; c++) {
        const idx = r * 16 + c;
        if (idx < data.length) {
          bytes.push({
            value: data[idx].toString(16).padStart(2, '0').toUpperCase(),
            index: idx
          });
          const ch = data[idx];
          ascii += (ch >= 0x20 && ch <= 0x7e) ? String.fromCharCode(ch) : '.';
        } else {
          bytes.push({ value: '  ', index: -1 });
          ascii += ' ';
        }
      }
      this.hexRows.push({ offset, bytes, ascii });
    }
  }

  // ── Easter egg: PE executable magic bytes ──────────────────────────

  private checkMagicBytes(data: Uint8Array) {
    if (data.length >= 2 && data[0] === 0x4D && data[1] === 0x5A) {
      this.eggs.trigger('hex-executable');
    }
  }

  // ── Search hex pattern ─────────────────────────────────────────────

  onSearch() {
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    if (!this.searchPattern.trim() || !this.fileBytes) return;

    const cleaned = this.searchPattern.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length < 2 || cleaned.length % 2 !== 0) {
      this.errorMessage = 'Enter a valid hex pattern (e.g. 4D 5A or 4D5A).';
      return;
    }
    this.errorMessage = '';

    const patternBytes: number[] = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      patternBytes.push(parseInt(cleaned.substring(i, i + 2), 16));
    }

    for (let i = 0; i <= this.fileBytes.length - patternBytes.length; i++) {
      let found = true;
      for (let j = 0; j < patternBytes.length; j++) {
        if (this.fileBytes[i + j] !== patternBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) this.searchMatches.push(i);
    }

    if (this.searchMatches.length > 0) {
      this.currentMatchIndex = 0;
    }
  }

  nextMatch() {
    if (this.searchMatches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchMatches.length;
  }

  prevMatch() {
    if (this.searchMatches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
  }

  isSearchMatch(byteIndex: number): boolean {
    if (this.searchMatches.length === 0 || byteIndex < 0) return false;
    const patternLen = this.searchPattern.replace(/[^0-9a-fA-F]/g, '').length / 2;
    return this.searchMatches.some(m => byteIndex >= m && byteIndex < m + patternLen);
  }

  isCurrentMatch(byteIndex: number): boolean {
    if (this.currentMatchIndex < 0 || byteIndex < 0) return false;
    const patternLen = this.searchPattern.replace(/[^0-9a-fA-F]/g, '').length / 2;
    const start = this.searchMatches[this.currentMatchIndex];
    return byteIndex >= start && byteIndex < start + patternLen;
  }

  // ── Hover ──────────────────────────────────────────────────────────

  onByteHover(index: number) {
    this.hoveredByteIndex = index;
  }

  onByteLeave() {
    this.hoveredByteIndex = -1;
  }

  // ── Actions ────────────────────────────────────────────────────────

  clearAll() {
    this.textInput = '';
    this.hexInput = '';
    this.conversionOutput = '';
    this.hexRows = [];
    this.fileBytes = null;
    this.fileName = '';
    this.fileSize = 0;
    this.errorMessage = '';
    this.searchPattern = '';
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.hoveredByteIndex = -1;
  }

  async copyHexDump() {
    if (!this.fileBytes || !this.isBrowser) return;
    const lines = this.hexRows.map(row => {
      const hexPart = row.bytes.map(b => b.value).join(' ');
      return `${row.offset}  ${hexPart}  |${row.ascii}|`;
    });
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(text);
    }
  }

  async copyConversionOutput() {
    if (!this.conversionOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.conversionOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.conversionOutput);
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
    this.mode = 'text-to-hex';
    this.textInput = 'Hello, World! This is a hex dump sample.\nLine two with special chars: @#$%^&*()';
    this.onTextInput();
  }

  // ── Helpers ────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
