import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface NpmPackage {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  date: string;
  links: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  publisher?: {
    username: string;
  };
  license?: string;
  downloads?: number;
}

interface SearchResult {
  package: NpmPackage;
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

@Component({
    selector: 'app-npm-search',
    templateUrl: './npm-search.component.html',
    styleUrls: ['./npm-search.component.css'],
    imports: [FormsModule, ToolsSharedModule, DecimalPipe]
})
export class NpmSearchComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free NPM Package Info tool — search packages, compare install commands, check bundle sizes.')}&url=${encodeURIComponent(SITE_URL + '/tools/npm-search')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/npm-search')}`;

  // Search state
  query = '';
  results: SearchResult[] = [];
  selectedPackage: SearchResult | null = null;
  loading = false;
  errorMessage = '';
  totalResults = 0;

  // Package manager comparison
  selectedPm: PackageManager = 'npm';
  copiedCommand = '';

  // Recent searches
  recentSearches: string[] = [];

  // Bundle size
  bundleSize: string | null = null;
  bundleSizeLoading = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadRecentSearches();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // -- Search ----------------------------------------------------------------

  onQueryChange() {
    this.errorMessage = '';
    if (!this.query.trim()) {
      this.results = [];
      this.selectedPackage = null;
      this.totalResults = 0;
      return;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.search(), 400);
  }

  async search() {
    const q = this.query.trim();
    if (!q) return;

    this.loading = true;
    this.errorMessage = '';
    this.selectedPackage = null;
    this.bundleSize = null;

    // Easter egg check
    const lower = q.toLowerCase();
    if (lower === 'is-odd' || lower === 'is-even') {
      this.eggs.trigger('npm-trivial');
    }

    try {
      const res = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=20`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.results = data.objects || [];
      this.totalResults = data.total || 0;
      this.saveRecentSearch(q);
    } catch {
      this.errorMessage = 'Failed to fetch from npm registry. Please try again.';
      this.results = [];
      this.totalResults = 0;
    } finally {
      this.loading = false;
    }
  }

  searchFromRecent(term: string) {
    this.query = term;
    this.onQueryChange();
  }

  clearRecents() {
    this.recentSearches = [];
    if (this.isBrowser) {
      sessionStorage.removeItem('npm-search-recents');
    }
  }

  // -- Package selection ------------------------------------------------------

  selectPackage(result: SearchResult) {
    this.selectedPackage = result;
    this.bundleSize = null;
    this.fetchBundleSize(result.package.name);
  }

  clearSelection() {
    this.selectedPackage = null;
    this.bundleSize = null;
  }

  // -- Install commands -------------------------------------------------------

  getInstallCommand(pm: PackageManager, name: string): string {
    switch (pm) {
      case 'npm':  return `npm install ${name}`;
      case 'yarn': return `yarn add ${name}`;
      case 'pnpm': return `pnpm add ${name}`;
      case 'bun':  return `bun add ${name}`;
    }
  }

  getDevInstallCommand(pm: PackageManager, name: string): string {
    switch (pm) {
      case 'npm':  return `npm install -D ${name}`;
      case 'yarn': return `yarn add -D ${name}`;
      case 'pnpm': return `pnpm add -D ${name}`;
      case 'bun':  return `bun add -d ${name}`;
    }
  }

  getGlobalInstallCommand(pm: PackageManager, name: string): string {
    switch (pm) {
      case 'npm':  return `npm install -g ${name}`;
      case 'yarn': return `yarn global add ${name}`;
      case 'pnpm': return `pnpm add -g ${name}`;
      case 'bun':  return `bun add -g ${name}`;
    }
  }

  async copyCommand(cmd: string) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(cmd);
      this.copiedCommand = cmd;
      setTimeout(() => (this.copiedCommand = ''), 2000);
    } catch {
      this.fallbackCopy(cmd);
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
    this.copiedCommand = text;
    setTimeout(() => (this.copiedCommand = ''), 2000);
  }

  // -- Bundle size estimate ---------------------------------------------------

  async fetchBundleSize(name: string) {
    this.bundleSizeLoading = true;
    try {
      const res = await fetch(`https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const sizeKB = (data.size / 1024).toFixed(1);
      const gzipKB = (data.gzip / 1024).toFixed(1);
      this.bundleSize = `${sizeKB} kB (${gzipKB} kB gzipped)`;
    } catch {
      this.bundleSize = 'Unavailable';
    } finally {
      this.bundleSizeLoading = false;
    }
  }

  // -- Recent searches (sessionStorage) ---------------------------------------

  private loadRecentSearches() {
    if (!this.isBrowser) return;
    try {
      const stored = sessionStorage.getItem('npm-search-recents');
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  private saveRecentSearch(term: string) {
    if (!this.isBrowser) return;
    this.recentSearches = [
      term,
      ...this.recentSearches.filter(s => s !== term)
    ].slice(0, 8);
    try {
      sessionStorage.setItem('npm-search-recents', JSON.stringify(this.recentSearches));
    } catch { /* quota */ }
  }

  // -- Helpers ----------------------------------------------------------------

  formatDate(iso: string): string {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatNumber(n: number | undefined): string {
    if (n == null) return 'N/A';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  scorePercent(score: number): number {
    return Math.round(score * 100);
  }
}
