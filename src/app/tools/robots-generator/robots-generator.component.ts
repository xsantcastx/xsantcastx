import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

interface RobotsDirective {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'text';
  value: boolean | number | string;
  group: 'indexing' | 'content' | 'advanced';
}

interface RobotsTxtRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
}

@Component({
  selector: 'app-robots-generator',
  templateUrl: './robots-generator.component.html',
  styleUrls: ['./robots-generator.component.css'],
  standalone: false
})
export class RobotsGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Robots Meta Tag Generator — build robots meta tags & robots.txt visually. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/robots-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/robots-generator')}`;

  // ── Meta tag directives ──────────────────────────────────────
  directives: RobotsDirective[] = [
    // Indexing group
    { key: 'noindex',           label: 'noindex',           description: 'Prevents the page from being indexed and shown in search results.',                          type: 'boolean', value: false, group: 'indexing' },
    { key: 'nofollow',          label: 'nofollow',          description: 'Prevents search engines from following any links on the page.',                              type: 'boolean', value: false, group: 'indexing' },
    { key: 'noarchive',         label: 'noarchive',         description: 'Prevents search engines from showing a cached copy of the page.',                           type: 'boolean', value: false, group: 'content' },
    { key: 'nosnippet',         label: 'nosnippet',         description: 'Prevents a text snippet or video preview from being shown in search results.',               type: 'boolean', value: false, group: 'content' },
    { key: 'noimageindex',      label: 'noimageindex',      description: 'Prevents images on the page from being indexed by search engines.',                          type: 'boolean', value: false, group: 'content' },
    { key: 'notranslate',       label: 'notranslate',       description: 'Prevents search engines from offering a translation of the page in search results.',         type: 'boolean', value: false, group: 'content' },

    // Advanced group
    { key: 'max-snippet',       label: 'max-snippet',       description: 'Maximum number of characters for the text snippet. Use -1 for no limit, 0 for no snippet.',  type: 'number',  value: -1,    group: 'advanced' },
    { key: 'max-image-preview', label: 'max-image-preview', description: 'Maximum size of image preview: none, standard, or large.',                                   type: 'text',    value: 'large', group: 'advanced' },
    { key: 'max-video-preview', label: 'max-video-preview', description: 'Maximum number of seconds for a video snippet preview. Use -1 for no limit.',                type: 'number',  value: -1,    group: 'advanced' },
    { key: 'unavailable_after', label: 'unavailable_after', description: 'Date/time after which the page should no longer appear in search results (RFC 850 format).',  type: 'text',    value: '',    group: 'advanced' },
  ];

  imagePreviewOptions = ['none', 'standard', 'large'];

  // ── Index/Follow toggle (positive variants) ──────────────────
  useIndex = true;
  useFollow = true;

  // ── robots.txt builder ───────────────────────────────────────
  rules: RobotsTxtRule[] = [
    { userAgent: '*', allow: [''], disallow: [''], crawlDelay: null }
  ];
  sitemapUrls: string[] = [''];

  // ── UI state ─────────────────────────────────────────────────
  activeTab: 'meta' | 'robotstxt' = 'meta';
  copiedMeta = false;
  copiedTxt = false;
  expandedDirective: string | null = null;

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Meta tag generation ──────────────────────────────────────

  get metaTagContent(): string {
    const parts: string[] = [];

    // index/noindex
    if (!this.useIndex) {
      parts.push('noindex');
    } else {
      parts.push('index');
    }

    // follow/nofollow
    if (!this.useFollow) {
      parts.push('nofollow');
    } else {
      parts.push('follow');
    }

    // Boolean directives
    for (const d of this.directives) {
      if (d.type === 'boolean' && d.value === true) {
        parts.push(d.key);
      }
    }

    // Number/text directives with non-default values
    for (const d of this.directives) {
      if (d.type === 'number') {
        const num = d.value as number;
        if (d.key === 'max-snippet' && num !== -1) {
          parts.push(`max-snippet:${num}`);
        }
        if (d.key === 'max-video-preview' && num !== -1) {
          parts.push(`max-video-preview:${num}`);
        }
      }
      if (d.type === 'text') {
        const str = (d.value as string).trim();
        if (d.key === 'max-image-preview' && str !== 'large') {
          parts.push(`max-image-preview:${str}`);
        }
        if (d.key === 'unavailable_after' && str) {
          parts.push(`unavailable_after:${str}`);
        }
      }
    }

    return parts.join(', ');
  }

  get generatedMetaTag(): string {
    return `<meta name="robots" content="${this.metaTagContent}">`;
  }

  get googlebotMetaTag(): string {
    return `<meta name="googlebot" content="${this.metaTagContent}">`;
  }

  // ── robots.txt generation ────────────────────────────────────

  get generatedRobotsTxt(): string {
    const lines: string[] = [];

    for (const rule of this.rules) {
      lines.push(`User-agent: ${rule.userAgent || '*'}`);

      for (const path of rule.allow) {
        const p = path.trim();
        if (p) lines.push(`Allow: ${p}`);
      }

      for (const path of rule.disallow) {
        const p = path.trim();
        if (p) lines.push(`Disallow: ${p}`);
      }

      if (rule.crawlDelay !== null && rule.crawlDelay > 0) {
        lines.push(`Crawl-delay: ${rule.crawlDelay}`);
      }

      lines.push('');
    }

    for (const url of this.sitemapUrls) {
      const u = url.trim();
      if (u) lines.push(`Sitemap: ${u}`);
    }

    return lines.join('\n').trim();
  }

  // ── Toggle helpers ───────────────────────────────────────────

  onIndexToggle() {
    const noindexDir = this.directives.find(d => d.key === 'noindex');
    if (noindexDir) noindexDir.value = !this.useIndex;
    this.checkBlackoutEgg();
  }

  onFollowToggle() {
    const nofollowDir = this.directives.find(d => d.key === 'nofollow');
    if (nofollowDir) nofollowDir.value = !this.useFollow;
    this.checkBlackoutEgg();
  }

  onDirectiveChange() {
    // Sync index/follow toggles with directive state
    const noindex = this.directives.find(d => d.key === 'noindex');
    const nofollow = this.directives.find(d => d.key === 'nofollow');
    if (noindex) this.useIndex = !noindex.value;
    if (nofollow) this.useFollow = !nofollow.value;
    this.checkBlackoutEgg();
  }

  toggleExplanation(key: string) {
    this.expandedDirective = this.expandedDirective === key ? null : key;
  }

  // ── robots.txt rule management ───────────────────────────────

  addRule() {
    this.rules.push({ userAgent: '', allow: [''], disallow: [''], crawlDelay: null });
  }

  removeRule(index: number) {
    if (this.rules.length > 1) {
      this.rules.splice(index, 1);
    }
  }

  addAllowPath(rule: RobotsTxtRule) {
    rule.allow.push('');
  }

  removeAllowPath(rule: RobotsTxtRule, index: number) {
    if (rule.allow.length > 1) {
      rule.allow.splice(index, 1);
    }
  }

  addDisallowPath(rule: RobotsTxtRule) {
    rule.disallow.push('');
  }

  removeDisallowPath(rule: RobotsTxtRule, index: number) {
    if (rule.disallow.length > 1) {
      rule.disallow.splice(index, 1);
    }
  }

  addSitemap() {
    this.sitemapUrls.push('');
  }

  removeSitemap(index: number) {
    if (this.sitemapUrls.length > 1) {
      this.sitemapUrls.splice(index, 1);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ── Presets ──────────────────────────────────────────────────

  applyPreset(preset: string) {
    // Reset all boolean directives
    for (const d of this.directives) {
      if (d.type === 'boolean') d.value = false;
    }

    switch (preset) {
      case 'default':
        this.useIndex = true;
        this.useFollow = true;
        break;
      case 'noindex':
        this.useIndex = false;
        this.useFollow = true;
        break;
      case 'noindex-nofollow':
        this.useIndex = false;
        this.useFollow = false;
        break;
      case 'noarchive':
        this.useIndex = true;
        this.useFollow = true;
        this.directives.find(d => d.key === 'noarchive')!.value = true;
        break;
      case 'restricted':
        this.useIndex = true;
        this.useFollow = true;
        this.directives.find(d => d.key === 'noarchive')!.value = true;
        this.directives.find(d => d.key === 'nosnippet')!.value = true;
        this.directives.find(d => d.key === 'noimageindex')!.value = true;
        break;
    }

    this.onIndexToggle();
    this.onFollowToggle();
  }

  // ── Copy ─────────────────────────────────────────────────────

  async copyMeta() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedMetaTag);
      this.copiedMeta = true;
      setTimeout(() => (this.copiedMeta = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedMetaTag, 'meta');
    }
  }

  async copyRobotsTxt() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedRobotsTxt);
      this.copiedTxt = true;
      setTimeout(() => (this.copiedTxt = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedRobotsTxt, 'txt');
    }
  }

  private fallbackCopy(text: string, type: 'meta' | 'txt') {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (type === 'meta') {
      this.copiedMeta = true;
      setTimeout(() => (this.copiedMeta = false), 2000);
    } else {
      this.copiedTxt = true;
      setTimeout(() => (this.copiedTxt = false), 2000);
    }
  }

  // ── Easter egg ───────────────────────────────────────────────

  private checkBlackoutEgg() {
    const noindex = !this.useIndex;
    const nofollow = !this.useFollow;
    const noarchive = this.directives.find(d => d.key === 'noarchive')?.value === true;
    const nosnippet = this.directives.find(d => d.key === 'nosnippet')?.value === true;

    if (noindex && nofollow && noarchive && nosnippet) {
      this.eggs.trigger('robots-blackout');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  getDirectivesByGroup(group: string): RobotsDirective[] {
    return this.directives.filter(d => d.group === group);
  }
}
