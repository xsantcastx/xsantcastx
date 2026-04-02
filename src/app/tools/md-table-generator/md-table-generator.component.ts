import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type Alignment = 'left' | 'center' | 'right';
type OutputFormat = 'markdown' | 'html';

interface TableCell {
  value: string;
}

@Component({
  selector: 'app-md-table-generator',
  templateUrl: './md-table-generator.component.html',
  styleUrls: ['./md-table-generator.component.css'],
  standalone: false
})
export class MdTableGeneratorComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Markdown Table Generator — visual editor, CSV import, HTML export. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/md-table-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/md-table-generator')}`;

  readonly MAX_SIZE = 20;

  // Table data
  rows = 3;
  cols = 3;
  headers: TableCell[] = [];
  body: TableCell[][] = [];
  alignments: Alignment[] = [];

  // Output
  markdownOutput = '';
  htmlOutput = '';
  outputFormat: OutputFormat = 'markdown';
  compactFormat = false;

  // CSV import
  showCsvImport = false;
  csvInput = '';
  csvDelimiter = ',';

  // UI state
  copiedMd = false;
  copiedHtml = false;
  errorMessage = '';

  constructor(private router: Router) {}

  ngOnInit() {
    this.initTable(this.rows, this.cols);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Table initialization ──────────────────────────────────────────────────

  initTable(rows: number, cols: number) {
    this.headers = Array.from({ length: cols }, () => ({ value: '' }));
    this.alignments = Array.from({ length: cols }, () => 'left' as Alignment);
    this.body = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: '' }))
    );
    this.rows = rows;
    this.cols = cols;
    this.generateOutput();
  }

  // ── Row operations ────────────────────────────────────────────────────────

  addRow() {
    if (this.body.length >= this.MAX_SIZE) return;
    this.body.push(Array.from({ length: this.cols }, () => ({ value: '' })));
    this.rows = this.body.length;
    this.generateOutput();
  }

  removeRow(index: number) {
    if (this.body.length <= 1) return;
    this.body.splice(index, 1);
    this.rows = this.body.length;
    this.generateOutput();
  }

  // ── Column operations ─────────────────────────────────────────────────────

  addColumn() {
    if (this.cols >= this.MAX_SIZE) return;
    this.headers.push({ value: '' });
    this.alignments.push('left');
    for (const row of this.body) {
      row.push({ value: '' });
    }
    this.cols = this.headers.length;
    this.generateOutput();
  }

  removeColumn(index: number) {
    if (this.cols <= 1) return;
    this.headers.splice(index, 1);
    this.alignments.splice(index, 1);
    for (const row of this.body) {
      row.splice(index, 1);
    }
    this.cols = this.headers.length;
    this.generateOutput();
  }

  // ── Alignment ─────────────────────────────────────────────────────────────

  cycleAlignment(colIndex: number) {
    const order: Alignment[] = ['left', 'center', 'right'];
    const current = order.indexOf(this.alignments[colIndex]);
    this.alignments[colIndex] = order[(current + 1) % 3];
    this.generateOutput();
  }

  getAlignmentLabel(a: Alignment): string {
    return a === 'left' ? 'L' : a === 'center' ? 'C' : 'R';
  }

  // ── Cell editing ──────────────────────────────────────────────────────────

  onCellChange() {
    this.generateOutput();
  }

  // ── Output generation ─────────────────────────────────────────────────────

  generateOutput() {
    this.markdownOutput = this.buildMarkdown();
    this.htmlOutput = this.buildHtml();
    this.checkEasterEgg();
  }

  private buildMarkdown(): string {
    const sep = this.compactFormat ? '|' : ' | ';
    const edge = this.compactFormat ? '|' : '| ';
    const edgeEnd = this.compactFormat ? '|' : ' |';

    // Header row
    const headerCells = this.headers.map(h => this.escapeMarkdown(h.value || ' '));
    const headerLine = edge + headerCells.join(sep) + edgeEnd;

    // Separator row
    const separatorCells = this.alignments.map(a => {
      if (this.compactFormat) {
        if (a === 'left') return ':---';
        if (a === 'center') return ':---:';
        return '---:';
      }
      if (a === 'left') return ':---';
      if (a === 'center') return ':---:';
      return '---:';
    });
    const separatorLine = edge + separatorCells.join(sep) + edgeEnd;

    // Body rows
    const bodyLines = this.body.map(row => {
      const cells = row.map(c => this.escapeMarkdown(c.value || ' '));
      return edge + cells.join(sep) + edgeEnd;
    });

    return [headerLine, separatorLine, ...bodyLines].join('\n');
  }

  private buildHtml(): string {
    const indent = '  ';
    const lines: string[] = ['<table>'];

    // thead
    lines.push(`${indent}<thead>`);
    lines.push(`${indent}${indent}<tr>`);
    for (let i = 0; i < this.headers.length; i++) {
      const alignAttr = this.alignments[i] !== 'left' ? ` style="text-align: ${this.alignments[i]}"` : '';
      const val = this.escapeHtml(this.headers[i].value || '');
      lines.push(`${indent}${indent}${indent}<th${alignAttr}>${val}</th>`);
    }
    lines.push(`${indent}${indent}</tr>`);
    lines.push(`${indent}</thead>`);

    // tbody
    lines.push(`${indent}<tbody>`);
    for (const row of this.body) {
      lines.push(`${indent}${indent}<tr>`);
      for (let i = 0; i < row.length; i++) {
        const alignAttr = this.alignments[i] !== 'left' ? ` style="text-align: ${this.alignments[i]}"` : '';
        const val = this.escapeHtml(row[i].value || '');
        lines.push(`${indent}${indent}${indent}<td${alignAttr}>${val}</td>`);
      }
      lines.push(`${indent}${indent}</tr>`);
    }
    lines.push(`${indent}</tbody>`);
    lines.push('</table>');

    return lines.join('\n');
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/\|/g, '\\|');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── CSV import ────────────────────────────────────────────────────────────

  toggleCsvImport() {
    this.showCsvImport = !this.showCsvImport;
    this.errorMessage = '';
  }

  importCsv() {
    this.errorMessage = '';
    if (!this.csvInput.trim()) {
      this.errorMessage = 'Please paste CSV data to import.';
      return;
    }

    const lines = this.csvInput.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 1) {
      this.errorMessage = 'CSV must have at least one row.';
      return;
    }

    const delimiter = this.csvDelimiter || ',';
    const parsed = lines.map(line => this.parseCsvLine(line, delimiter));
    const maxCols = Math.min(Math.max(...parsed.map(r => r.length)), this.MAX_SIZE);
    const maxRows = Math.min(parsed.length - 1, this.MAX_SIZE);

    if (maxCols < 1) {
      this.errorMessage = 'Could not parse any columns from CSV.';
      return;
    }

    // First row = headers
    this.headers = Array.from({ length: maxCols }, (_, i) => ({
      value: parsed[0][i] || ''
    }));
    this.alignments = Array.from({ length: maxCols }, () => 'left' as Alignment);

    // Remaining rows = body
    const bodyRows = parsed.slice(1, maxRows + 1);
    if (bodyRows.length === 0) {
      // At least one body row
      this.body = [Array.from({ length: maxCols }, () => ({ value: '' }))];
    } else {
      this.body = bodyRows.map(row =>
        Array.from({ length: maxCols }, (_, i) => ({ value: row[i] || '' }))
      );
    }

    this.rows = this.body.length;
    this.cols = maxCols;
    this.showCsvImport = false;
    this.csvInput = '';
    this.generateOutput();
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  // ── Format toggle ─────────────────────────────────────────────────────────

  toggleCompact() {
    this.compactFormat = !this.compactFormat;
    this.generateOutput();
  }

  setOutputFormat(fmt: OutputFormat) {
    this.outputFormat = fmt;
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  async copyMarkdown() {
    if (!this.markdownOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.markdownOutput);
      this.copiedMd = true;
      setTimeout(() => (this.copiedMd = false), 2000);
    } catch {
      this.fallbackCopy(this.markdownOutput, 'md');
    }
  }

  async copyHtml() {
    if (!this.htmlOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.htmlOutput);
      this.copiedHtml = true;
      setTimeout(() => (this.copiedHtml = false), 2000);
    } catch {
      this.fallbackCopy(this.htmlOutput, 'html');
    }
  }

  private fallbackCopy(text: string, type: 'md' | 'html') {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (type === 'md') {
      this.copiedMd = true;
      setTimeout(() => (this.copiedMd = false), 2000);
    } else {
      this.copiedHtml = true;
      setTimeout(() => (this.copiedHtml = false), 2000);
    }
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clearTable() {
    this.initTable(3, 3);
    this.csvInput = '';
    this.showCsvImport = false;
    this.errorMessage = '';
  }

  // ── Easter egg ────────────────────────────────────────────────────────────

  private checkEasterEgg() {
    if (this.body.length === 1 && this.cols === 1) {
      this.eggs.trigger('md-lonely-cell');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get currentOutput(): string {
    return this.outputFormat === 'markdown' ? this.markdownOutput : this.htmlOutput;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
