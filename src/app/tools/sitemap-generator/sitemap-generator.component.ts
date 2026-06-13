import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

@Component({
    selector: 'app-sitemap-generator',
    templateUrl: './sitemap-generator.component.html',
    styleUrls: ['./sitemap-generator.component.css'],
    imports: [FormsModule, ToolsSharedModule, DecimalPipe]
})
export class SitemapGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly changefreqOptions = [
    'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
  ];

  // URL entries
  urls: SitemapUrl[] = [];

  // Bulk input
  bulkInput = '';

  // Output
  output = '';
  xmlValid = false;
  validationMessage = '';
  copied = false;

  // Stats
  get urlCount(): number { return this.urls.length; }

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Add URLs ──────────────────────────────────────────────────────────────

  addBlankUrl() {
    this.urls.push({
      loc: '',
      lastmod: this.todayISO(),
      changefreq: 'weekly',
      priority: 0.5
    });
  }

  addBulkUrls() {
    const lines = this.bulkInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return;

    for (const line of lines) {
      this.urls.push({
        loc: line,
        lastmod: this.todayISO(),
        changefreq: 'weekly',
        priority: 0.5
      });
    }

    // Easter egg: exactly 1 URL added total
    if (this.urls.length === 1) {
      this.eggs.trigger('sitemap-lonely');
    }

    this.bulkInput = '';
    this.generateXml();
  }

  removeUrl(index: number) {
    this.urls.splice(index, 1);
    this.generateXml();
  }

  // ── Per-URL option changes ────────────────────────────────────────────────

  onUrlChange() {
    this.generateXml();
  }

  onPriorityChange(entry: SitemapUrl, value: string) {
    entry.priority = parseFloat(value);
    this.generateXml();
  }

  // ── XML Generation ────────────────────────────────────────────────────────

  generateXml() {
    if (this.urls.length === 0) {
      this.output = '';
      this.xmlValid = false;
      this.validationMessage = '';
      return;
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const entry of this.urls) {
      xml += '  <url>\n';
      xml += `    <loc>${this.escapeXml(entry.loc)}</loc>\n`;
      if (entry.lastmod) {
        xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      }
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';
    this.output = xml;
    this.validateXml();
  }

  // ── XML Validation ────────────────────────────────────────────────────────

  private validateXml() {
    if (!this.output) {
      this.xmlValid = false;
      this.validationMessage = '';
      return;
    }

    // Check for empty <loc> tags
    const emptyLocs = this.urls.filter(u => !u.loc.trim());
    if (emptyLocs.length > 0) {
      this.xmlValid = false;
      this.validationMessage = `${emptyLocs.length} URL(s) have empty <loc> values.`;
      return;
    }

    // Validate URL format
    const invalidUrls = this.urls.filter(u => !this.isValidUrl(u.loc));
    if (invalidUrls.length > 0) {
      this.xmlValid = false;
      this.validationMessage = `${invalidUrls.length} URL(s) are not valid (must start with http:// or https://).`;
      return;
    }

    // Browser-based XML parsing validation
    if (this.isBrowser) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.output, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          this.xmlValid = false;
          this.validationMessage = 'XML parsing error detected.';
          return;
        }
      } catch {
        this.xmlValid = false;
        this.validationMessage = 'XML validation failed.';
        return;
      }
    }

    this.xmlValid = true;
    this.validationMessage = `Valid sitemap with ${this.urls.length} URL(s).`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

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

  downloadXml() {
    if (!this.output || !this.isBrowser) return;
    const blob = new Blob([this.output], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearAll() {
    this.urls = [];
    this.bulkInput = '';
    this.output = '';
    this.xmlValid = false;
    this.validationMessage = '';
    this.copied = false;
  }

  loadSample() {
    this.urls = [
      { loc: 'https://example.com/', lastmod: this.todayISO(), changefreq: 'daily', priority: 1.0 },
      { loc: 'https://example.com/about', lastmod: this.todayISO(), changefreq: 'monthly', priority: 0.8 },
      { loc: 'https://example.com/blog', lastmod: this.todayISO(), changefreq: 'weekly', priority: 0.9 },
      { loc: 'https://example.com/contact', lastmod: this.todayISO(), changefreq: 'yearly', priority: 0.3 },
    ];
    this.generateXml();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private isValidUrl(url: string): boolean {
    return /^https?:\/\/.+/i.test(url.trim());
  }

  trackByIndex(index: number): number {
    return index;
  }
}
