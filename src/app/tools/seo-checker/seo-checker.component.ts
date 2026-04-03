import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface KeywordResult {
  word: string;
  count: number;
  density: number;
}

interface SeoSuggestion {
  type: 'success' | 'warning' | 'error';
  message: string;
}

@Component({
  selector: 'app-seo-checker',
  templateUrl: './seo-checker.component.html',
  styleUrls: ['./seo-checker.component.css'],
  standalone: false
})
export class SeoCheckerComponent {
  private readonly eggs = inject(EasterEggService);

  pageTitle = '';
  metaDescription = '';
  pageUrl = 'https://example.com/my-page';
  focusKeyword = '';

  copied = false;

  readonly twitterShareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free SEO Title & Description Length Checker — live SERP preview, keyword density & Open Graph analysis. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/seo-checker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/seo-checker')}`;

  constructor(private router: Router) {}

  // ─── Title analysis ──────────────────────────────────────────────────────

  get titleLength(): number {
    return this.pageTitle.length;
  }

  get titlePercent(): number {
    return Math.min((this.titleLength / 70) * 100, 100);
  }

  get titleStatus(): 'red' | 'yellow' | 'green' {
    const len = this.titleLength;
    if (len === 0) return 'red';
    if (len >= 50 && len <= 60) return 'green';
    if ((len >= 30 && len < 50) || (len > 60 && len <= 70)) return 'yellow';
    return 'red';
  }

  get titleStatusLabel(): string {
    const len = this.titleLength;
    if (len === 0) return 'Empty';
    if (len >= 50 && len <= 60) return 'Optimal';
    if (len >= 30 && len < 50) return 'Too short';
    if (len > 60 && len <= 70) return 'Slightly long';
    if (len < 30) return 'Way too short';
    return 'Too long';
  }

  // ─── Description analysis ────────────────────────────────────────────────

  get descLength(): number {
    return this.metaDescription.length;
  }

  get descPercent(): number {
    return Math.min((this.descLength / 200) * 100, 100);
  }

  get descStatus(): 'red' | 'yellow' | 'green' {
    const len = this.descLength;
    if (len === 0) return 'red';
    if (len >= 120 && len <= 160) return 'green';
    if ((len >= 70 && len < 120) || (len > 160 && len <= 200)) return 'yellow';
    return 'red';
  }

  get descStatusLabel(): string {
    const len = this.descLength;
    if (len === 0) return 'Empty';
    if (len >= 120 && len <= 160) return 'Optimal';
    if (len >= 70 && len < 120) return 'Too short';
    if (len > 160 && len <= 200) return 'Slightly long';
    if (len < 70) return 'Way too short';
    return 'Too long';
  }

  // ─── SERP Preview ────────────────────────────────────────────────────────

  get serpTitle(): string {
    if (!this.pageTitle) return 'Page Title Goes Here';
    return this.pageTitle.length > 60 ? this.pageTitle.substring(0, 57) + '...' : this.pageTitle;
  }

  get serpDescription(): string {
    if (!this.metaDescription) return 'Your meta description will appear here. It should be a concise summary of the page content that entices users to click through from search results.';
    return this.metaDescription.length > 160 ? this.metaDescription.substring(0, 157) + '...' : this.metaDescription;
  }

  get serpUrl(): string {
    if (!this.pageUrl) return 'https://example.com';
    try {
      const url = new URL(this.pageUrl);
      return url.origin + url.pathname;
    } catch {
      return this.pageUrl;
    }
  }

  get serpBreadcrumbs(): string {
    if (!this.pageUrl) return 'example.com';
    try {
      const url = new URL(this.pageUrl);
      const parts = url.pathname.split('/').filter(p => p);
      if (parts.length === 0) return url.hostname;
      return url.hostname + ' > ' + parts.join(' > ');
    } catch {
      return this.pageUrl;
    }
  }

  // ─── Keyword density ─────────────────────────────────────────────────────

  get keywords(): KeywordResult[] {
    const text = (this.pageTitle + ' ' + this.metaDescription).toLowerCase();
    const words = text.match(/[a-z\u00C0-\u024F]{3,}/gi) || [];
    if (words.length === 0) return [];

    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
      'than', 'its', 'over', 'into', 'just', 'your', 'also', 'from', 'they',
      'that', 'this', 'with', 'will', 'each', 'make', 'like', 'been', 'more',
      'when', 'what', 'which', 'their', 'about', 'would', 'there', 'could',
    ]);

    const freq: Record<string, number> = {};
    for (const w of words) {
      const lower = w.toLowerCase();
      if (!stopWords.has(lower)) {
        freq[lower] = (freq[lower] || 0) + 1;
      }
    }

    const total = words.length;
    return Object.entries(freq)
      .map(([word, count]) => ({ word, count, density: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  get focusKeywordInTitle(): boolean {
    if (!this.focusKeyword || !this.pageTitle) return false;
    return this.pageTitle.toLowerCase().includes(this.focusKeyword.toLowerCase());
  }

  get focusKeywordInDesc(): boolean {
    if (!this.focusKeyword || !this.metaDescription) return false;
    return this.metaDescription.toLowerCase().includes(this.focusKeyword.toLowerCase());
  }

  // ─── Open Graph preview ──────────────────────────────────────────────────

  get ogTitle(): string {
    return this.pageTitle || 'Page Title';
  }

  get ogDescription(): string {
    return this.metaDescription || 'Page description will appear here...';
  }

  get ogSiteName(): string {
    if (!this.pageUrl) return 'example.com';
    try {
      return new URL(this.pageUrl).hostname;
    } catch {
      return 'example.com';
    }
  }

  // ─── Suggestions ─────────────────────────────────────────────────────────

  get suggestions(): SeoSuggestion[] {
    const items: SeoSuggestion[] = [];
    const tLen = this.titleLength;
    const dLen = this.descLength;

    // Title suggestions
    if (tLen === 0) {
      items.push({ type: 'error', message: 'Add a page title. It is the most important on-page SEO element.' });
    } else if (tLen < 30) {
      items.push({ type: 'error', message: 'Title is too short. Aim for 50-60 characters to maximize SERP real estate.' });
    } else if (tLen < 50) {
      items.push({ type: 'warning', message: 'Title could be longer. You have room for ' + (50 - tLen) + ' more characters before the optimal range.' });
    } else if (tLen > 70) {
      items.push({ type: 'error', message: 'Title is too long and will be truncated in search results. Remove ' + (tLen - 60) + ' characters.' });
    } else if (tLen > 60) {
      items.push({ type: 'warning', message: 'Title may be truncated on some devices. Consider trimming ' + (tLen - 60) + ' characters.' });
    } else {
      items.push({ type: 'success', message: 'Title length is optimal at ' + tLen + ' characters.' });
    }

    // Description suggestions
    if (dLen === 0) {
      items.push({ type: 'error', message: 'Add a meta description. Without one, Google will auto-generate a snippet.' });
    } else if (dLen < 70) {
      items.push({ type: 'error', message: 'Description is too short. Aim for 120-160 characters for best results.' });
    } else if (dLen < 120) {
      items.push({ type: 'warning', message: 'Description could be longer. You have room for ' + (120 - dLen) + ' more characters.' });
    } else if (dLen > 200) {
      items.push({ type: 'error', message: 'Description is too long. Google will truncate it. Remove ' + (dLen - 160) + ' characters.' });
    } else if (dLen > 160) {
      items.push({ type: 'warning', message: 'Description may be truncated. Consider trimming ' + (dLen - 160) + ' characters.' });
    } else {
      items.push({ type: 'success', message: 'Description length is optimal at ' + dLen + ' characters.' });
    }

    // Keyword suggestions
    if (this.focusKeyword) {
      if (!this.focusKeywordInTitle) {
        items.push({ type: 'warning', message: 'Focus keyword "' + this.focusKeyword + '" not found in title. Include it for better rankings.' });
      } else {
        items.push({ type: 'success', message: 'Focus keyword found in title.' });
      }
      if (!this.focusKeywordInDesc) {
        items.push({ type: 'warning', message: 'Focus keyword "' + this.focusKeyword + '" not found in description. Include it to improve click-through rate.' });
      } else {
        items.push({ type: 'success', message: 'Focus keyword found in description.' });
      }
    }

    // URL suggestions
    if (this.pageUrl && this.pageUrl.length > 75) {
      items.push({ type: 'warning', message: 'URL is quite long. Shorter URLs tend to perform better in search results.' });
    }

    if (this.pageTitle && !this.pageTitle.includes('|') && !this.pageTitle.includes('-') && !this.pageTitle.includes(':')) {
      items.push({ type: 'warning', message: 'Consider adding a brand separator (| or -) to your title, e.g. "Page Title | Brand".' });
    }

    return items;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  onTitleInput(value: string): void {
    this.pageTitle = value;
    if (this.titleLength === 60) {
      this.eggs.trigger('seo-perfect-title');
    }
  }

  onDescInput(value: string): void {
    this.metaDescription = value;
  }

  onUrlInput(value: string): void {
    this.pageUrl = value;
  }

  onKeywordInput(value: string): void {
    this.focusKeyword = value;
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }
}
