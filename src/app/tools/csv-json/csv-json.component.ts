import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type Direction = 'csv-to-json' | 'json-to-csv';
type OutputFormat = 'objects' | 'arrays' | 'nested';
type DelimiterOption = ',' | ';' | '\t' | '|';

interface PreviewRow {
  [key: string]: string;
}

@Component({
  selector: 'app-csv-json',
  templateUrl: './csv-json.component.html',
  styleUrls: ['./csv-json.component.css'],
  standalone: false
})
export class CsvJsonComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSV to JSON Converter — bidirectional, handles quoted fields, drag & drop. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/csv-json')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/csv-json')}`;

  // Direction & options
  direction: Direction = 'csv-to-json';
  delimiter: DelimiterOption = ',';
  quoteChar = '"';
  firstRowHeaders = true;
  outputFormat: OutputFormat = 'objects';

  // I/O
  input = '';
  output = '';
  inputCharCount = 0;

  // Preview
  previewHeaders: string[] = [];
  previewRows: PreviewRow[] = [];

  // File
  isDragOver = false;
  fileName = '';

  // UI state
  errorMessage = '';
  isProcessing = false;
  copied = false;

  readonly delimiterOptions: { value: DelimiterOption; label: string }[] = [
    { value: ',', label: 'Comma (,)' },
    { value: ';', label: 'Semicolon (;)' },
    { value: '\t', label: 'Tab (\\t)' },
    { value: '|', label: 'Pipe (|)' }
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Direction toggle ─────────────────────────────────────────────────────

  setDirection(d: Direction) {
    this.direction = d;
    this.clearAll();
  }

  onOptionChange() {
    if (this.input.trim()) {
      this.scheduleProcess();
    }
  }

  setQuoteChar(type: 'double' | 'single') {
    this.quoteChar = type === 'double' ? '"' : "'";
    this.onOptionChange();
  }

  // ── Live processing (debounced 300ms) ─────────────────────────────────────

  onInput() {
    this.inputCharCount = this.input.length;
    this.errorMessage = '';

    if (!this.input.trim()) {
      this.output = '';
      this.previewHeaders = [];
      this.previewRows = [];
      return;
    }

    this.scheduleProcess();
  }

  private scheduleProcess() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.process(), 300);
  }

  private process() {
    if (!this.isBrowser) return;
    this.isProcessing = true;
    this.errorMessage = '';

    try {
      if (this.direction === 'csv-to-json') {
        this.csvToJson();
      } else {
        this.jsonToCsv();
      }
    } catch (e: any) {
      this.errorMessage = e?.message || 'Conversion failed.';
      this.output = '';
      this.previewHeaders = [];
      this.previewRows = [];
    } finally {
      this.isProcessing = false;
    }
  }

  // ── CSV to JSON ──────────────────────────────────────────────────────────

  private csvToJson() {
    const rows = this.parseCsv(this.input);

    if (rows.length === 0) {
      this.errorMessage = 'No data found in CSV input.';
      this.output = '';
      this.previewHeaders = [];
      this.previewRows = [];
      return;
    }

    // Easter egg: exactly 1 row and 1 column
    if (rows.length === 1 && rows[0].length === 1) {
      this.eggs.trigger('csv-lonely');
    }

    let result: any;

    if (this.firstRowHeaders && rows.length > 1) {
      const headers = rows[0];

      if (this.outputFormat === 'objects') {
        result = rows.slice(1).map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
      } else if (this.outputFormat === 'arrays') {
        result = rows;
      } else {
        // nested: dot-notation keys become nested objects
        result = rows.slice(1).map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            this.setNestedValue(obj, h, row[i] ?? '');
          });
          return obj;
        });
      }

      // Build preview
      this.previewHeaders = headers;
      this.previewRows = rows.slice(1).slice(0, 50).map(row => {
        const obj: PreviewRow = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj;
      });
    } else {
      // No headers — check easter egg for headerless single-cell
      if (!this.firstRowHeaders && rows.length === 1 && rows[0].length === 1) {
        this.eggs.trigger('csv-lonely');
      }

      if (this.outputFormat === 'objects') {
        const headers = rows[0].map((_, i) => `column${i + 1}`);
        result = rows.map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
        this.previewHeaders = headers;
        this.previewRows = rows.slice(0, 50).map(row => {
          const obj: PreviewRow = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
      } else {
        result = rows;
        this.previewHeaders = rows[0].map((_, i) => `Col ${i + 1}`);
        this.previewRows = rows.slice(0, 50).map(row => {
          const obj: PreviewRow = {};
          this.previewHeaders.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });
      }
    }

    this.output = JSON.stringify(result, null, 2);
  }

  private setNestedValue(obj: Record<string, any>, path: string, value: string) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  // ── CSV Parser (handles quoted fields with commas) ────────────────────────

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];
    const q = this.quoteChar;
    const d = this.delimiter;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === q && next === q) {
          // Escaped quote
          current += q;
          i++;
        } else if (ch === q) {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === q) {
          inQuotes = true;
        } else if (ch === d) {
          row.push(current);
          current = '';
        } else if (ch === '\r' && next === '\n') {
          row.push(current);
          current = '';
          if (row.some(cell => cell !== '')) rows.push(row);
          row = [];
          i++;
        } else if (ch === '\n' || ch === '\r') {
          row.push(current);
          current = '';
          if (row.some(cell => cell !== '')) rows.push(row);
          row = [];
        } else {
          current += ch;
        }
      }
    }

    // Last field
    row.push(current);
    if (row.some(cell => cell !== '')) rows.push(row);

    return rows;
  }

  // ── JSON to CSV ──────────────────────────────────────────────────────────

  private jsonToCsv() {
    let data: any;
    try {
      data = JSON.parse(this.input);
    } catch {
      throw new Error('Invalid JSON — please check your input.');
    }

    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array of objects or arrays.');
    }

    if (data.length === 0) {
      this.output = '';
      this.previewHeaders = [];
      this.previewRows = [];
      return;
    }

    const d = this.delimiter;
    const q = this.quoteChar;

    if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
      // Array of objects — flatten nested objects with dot notation
      const flatData = data.map((item: any) => this.flattenObject(item));
      const headers = [...new Set(flatData.flatMap((obj: Record<string, string>) => Object.keys(obj)))];

      const csvRows: string[] = [];
      if (this.firstRowHeaders) {
        csvRows.push(headers.map(h => this.escapeField(h, d, q)).join(d));
      }
      flatData.forEach((obj: Record<string, string>) => {
        csvRows.push(headers.map(h => this.escapeField(String(obj[h] ?? ''), d, q)).join(d));
      });

      this.output = csvRows.join('\n');

      // Preview
      this.previewHeaders = headers;
      this.previewRows = flatData.slice(0, 50).map((obj: Record<string, string>) => {
        const row: PreviewRow = {};
        headers.forEach(h => { row[h] = String(obj[h] ?? ''); });
        return row;
      });
    } else if (Array.isArray(data[0])) {
      // Array of arrays
      const csvRows: string[] = data.map((row: any[]) =>
        row.map(cell => this.escapeField(String(cell ?? ''), d, q)).join(d)
      );
      this.output = csvRows.join('\n');

      // Preview
      const maxCols = Math.max(...data.map((r: any[]) => r.length));
      this.previewHeaders = Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`);
      this.previewRows = data.slice(0, 50).map((row: any[]) => {
        const obj: PreviewRow = {};
        this.previewHeaders.forEach((h, i) => { obj[h] = String(row[i] ?? ''); });
        return obj;
      });
    } else {
      throw new Error('JSON must contain objects or arrays.');
    }
  }

  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        Object.assign(result, this.flattenObject(obj[key], fullKey));
      } else {
        result[fullKey] = String(obj[key] ?? '');
      }
    }
    return result;
  }

  private escapeField(value: string, delimiter: string, quote: string): string {
    if (value.includes(delimiter) || value.includes(quote) || value.includes('\n') || value.includes('\r')) {
      return quote + value.replace(new RegExp(this.escapeRegex(quote), 'g'), quote + quote) + quote;
    }
    return value;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── File upload / drag & drop ─────────────────────────────────────────────

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

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      this.direction = 'csv-to-json';
    } else if (ext === 'json') {
      this.direction = 'json-to-csv';
    }

    this.fileName = file.name;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.input = reader.result as string;
      this.inputCharCount = this.input.length;
      this.process();
    };
    reader.onerror = () => {
      this.errorMessage = 'Failed to read file.';
    };
    reader.readAsText(file);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  clearAll() {
    this.input = '';
    this.output = '';
    this.errorMessage = '';
    this.inputCharCount = 0;
    this.fileName = '';
    this.previewHeaders = [];
    this.previewRows = [];
    this.isProcessing = false;
    this.copied = false;
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy();
    }
  }

  private fallbackCopy() {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = this.output;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  downloadOutput() {
    if (!this.output || !this.isBrowser) return;

    const isJson = this.direction === 'csv-to-json';
    const blob = new Blob([this.output], { type: isJson ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isJson ? 'output.json' : 'output.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadSample() {
    if (this.direction === 'csv-to-json') {
      this.input = `name,email,age,city\nAlice Johnson,"alice@example.com",28,New York\nBob Smith,"bob@example.com",35,"San Francisco"\n"Carol, Jr.",carol@example.com,42,Chicago`;
    } else {
      this.input = JSON.stringify([
        { name: 'Alice Johnson', email: 'alice@example.com', age: 28, city: 'New York' },
        { name: 'Bob Smith', email: 'bob@example.com', age: 35, city: 'San Francisco' },
        { name: 'Carol, Jr.', email: 'carol@example.com', age: 42, city: 'Chicago' }
      ], null, 2);
    }
    this.inputCharCount = this.input.length;
    this.process();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get hasOutput(): boolean {
    return !!this.output;
  }

  get outputLineCount(): number {
    return this.output ? this.output.split('\n').length : 0;
  }

  get directionLabel(): string {
    return this.direction === 'csv-to-json' ? 'CSV to JSON' : 'JSON to CSV';
  }

  get delimiterLabel(): string {
    const opt = this.delimiterOptions.find(o => o.value === this.delimiter);
    return opt ? opt.label : 'Comma';
  }
}
