import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-og-image-preview',
    templateUrl: './og-image-preview.component.html',
    styleUrls: ['./og-image-preview.component.css'],
    imports: [FormsModule, ToolsSharedModule, UpperCasePipe]
})
export class OgImagePreviewComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free OG Image Preview — preview Open Graph tags on Facebook, Twitter, LinkedIn, Discord!')}&url=${encodeURIComponent(SITE_URL + '/tools/og-image-preview')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/og-image-preview')}`;

  ogTitle = '';
  ogDescription = '';
  ogImage = '';
  ogUrl = '';
  ogSiteName = '';
  activePreview: 'facebook' | 'twitter' | 'linkedin' | 'discord' = 'facebook';
  copied = false;

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  onTitleChange() {
    if (this.ogTitle.toLowerCase().includes('test')) {
      this.eggs.trigger('og-testing');
    }
  }

  get metaTags(): string {
    const tags: string[] = [];
    if (this.ogTitle) tags.push(`<meta property="og:title" content="${this.escHtml(this.ogTitle)}" />`);
    if (this.ogDescription) tags.push(`<meta property="og:description" content="${this.escHtml(this.ogDescription)}" />`);
    if (this.ogImage) tags.push(`<meta property="og:image" content="${this.escHtml(this.ogImage)}" />`);
    if (this.ogUrl) tags.push(`<meta property="og:url" content="${this.escHtml(this.ogUrl)}" />`);
    if (this.ogSiteName) tags.push(`<meta property="og:site_name" content="${this.escHtml(this.ogSiteName)}" />`);
    tags.push(`<meta property="og:type" content="website" />`);
    // Twitter cards
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    if (this.ogTitle) tags.push(`<meta name="twitter:title" content="${this.escHtml(this.ogTitle)}" />`);
    if (this.ogDescription) tags.push(`<meta name="twitter:description" content="${this.escHtml(this.ogDescription)}" />`);
    if (this.ogImage) tags.push(`<meta name="twitter:image" content="${this.escHtml(this.ogImage)}" />`);
    return tags.join('\n');
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  get displayUrl(): string {
    if (!this.ogUrl) return 'example.com';
    try {
      return new URL(this.ogUrl).hostname;
    } catch {
      return this.ogUrl;
    }
  }

  get truncatedDesc(): string {
    if (!this.ogDescription) return 'Your description will appear here...';
    return this.ogDescription.length > 150 ? this.ogDescription.slice(0, 150) + '...' : this.ogDescription;
  }

  async copyTags() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.metaTags);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  clearAll() {
    this.ogTitle = '';
    this.ogDescription = '';
    this.ogImage = '';
    this.ogUrl = '';
    this.ogSiteName = '';
  }
}
