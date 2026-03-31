import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

interface MetaTagData {
  // Standard SEO
  title: string;
  description: string;
  canonical: string;
  robots: string;

  // Open Graph
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;

  // Twitter Card
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

@Component({
  selector: 'app-meta-tag-generator',
  templateUrl: './meta-tag-generator.component.html',
  styleUrls: ['./meta-tag-generator.component.css'],
  standalone: false
})
export class MetaTagGeneratorComponent {
  data: MetaTagData = {
    title: '',
    description: '',
    canonical: '',
    robots: 'index, follow',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    ogUrl: '',
    ogType: 'website',
    ogSiteName: '',
    twitterCard: 'summary_large_image',
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: ''
  };

  syncOg = true;
  syncTwitter = true;

  codeCopied = false;
  activePreview: 'facebook' | 'twitter' | 'linkedin' = 'facebook';

  readonly ogTypes = ['website', 'article', 'product', 'profile', 'video.other', 'music.song', 'book'];
  readonly twitterCards = ['summary', 'summary_large_image', 'app', 'player'];
  readonly robotsOptions = ['index, follow', 'index, nofollow', 'noindex, follow', 'noindex, nofollow'];

  readonly titleMaxLength = 60;
  readonly descriptionMaxLength = 160;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Open Graph & Meta Tag Generator — create perfect social sharing previews with live preview')}&url=${encodeURIComponent(SITE_URL + '/tools/meta-tag-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/meta-tag-generator')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  onTitleChange(): void {
    if (this.syncOg) {
      this.data.ogTitle = this.data.title;
    }
    if (this.syncTwitter) {
      this.data.twitterTitle = this.data.title;
    }
  }

  onDescriptionChange(): void {
    if (this.syncOg) {
      this.data.ogDescription = this.data.description;
    }
    if (this.syncTwitter) {
      this.data.twitterDescription = this.data.description;
    }
  }

  onCanonicalChange(): void {
    if (this.syncOg) {
      this.data.ogUrl = this.data.canonical;
    }
  }

  onOgImageChange(): void {
    if (this.syncTwitter) {
      this.data.twitterImage = this.data.ogImage;
    }
  }

  get effectiveOgTitle(): string {
    return this.data.ogTitle || this.data.title || 'Your Page Title';
  }

  get effectiveOgDescription(): string {
    return this.data.ogDescription || this.data.description || 'Your page description will appear here.';
  }

  get effectiveOgImage(): string {
    return this.data.ogImage || '';
  }

  get effectiveOgUrl(): string {
    return this.data.ogUrl || this.data.canonical || 'https://example.com';
  }

  get effectiveTwitterTitle(): string {
    return this.data.twitterTitle || this.data.ogTitle || this.data.title || 'Your Page Title';
  }

  get effectiveTwitterDescription(): string {
    return this.data.twitterDescription || this.data.ogDescription || this.data.description || 'Your page description will appear here.';
  }

  get effectiveTwitterImage(): string {
    return this.data.twitterImage || this.data.ogImage || '';
  }

  get previewDomain(): string {
    try {
      const url = this.effectiveOgUrl;
      if (!url || url === 'https://example.com') return 'example.com';
      return new URL(url).hostname;
    } catch {
      return 'example.com';
    }
  }

  get titleLength(): number {
    return this.data.title.length;
  }

  get descriptionLength(): number {
    return this.data.description.length;
  }

  get titleWarning(): boolean {
    return this.data.title.length > this.titleMaxLength;
  }

  get descriptionWarning(): boolean {
    return this.data.description.length > this.descriptionMaxLength;
  }

  get generatedCode(): string {
    const lines: string[] = [];

    // Standard SEO
    if (this.data.title) {
      lines.push(`<title>${this.escapeHtml(this.data.title)}</title>`);
    }
    if (this.data.description) {
      lines.push(`<meta name="description" content="${this.escapeHtml(this.data.description)}">`);
    }
    if (this.data.canonical) {
      lines.push(`<link rel="canonical" href="${this.escapeHtml(this.data.canonical)}">`);
    }
    if (this.data.robots) {
      lines.push(`<meta name="robots" content="${this.escapeHtml(this.data.robots)}">`);
    }

    // Open Graph
    const ogTags: [string, string][] = [
      ['og:title', this.data.ogTitle || this.data.title],
      ['og:description', this.data.ogDescription || this.data.description],
      ['og:image', this.data.ogImage],
      ['og:url', this.data.ogUrl || this.data.canonical],
      ['og:type', this.data.ogType],
      ['og:site_name', this.data.ogSiteName]
    ];

    const hasOg = ogTags.some(([, v]) => v);
    if (hasOg) {
      lines.push('');
      lines.push('<!-- Open Graph / Facebook -->');
      for (const [prop, value] of ogTags) {
        if (value) {
          lines.push(`<meta property="${prop}" content="${this.escapeHtml(value)}">`);
        }
      }
    }

    // Twitter Card
    const twTags: [string, string][] = [
      ['twitter:card', this.data.twitterCard],
      ['twitter:title', this.data.twitterTitle || this.data.ogTitle || this.data.title],
      ['twitter:description', this.data.twitterDescription || this.data.ogDescription || this.data.description],
      ['twitter:image', this.data.twitterImage || this.data.ogImage]
    ];

    const hasTw = twTags.some(([, v]) => v);
    if (hasTw) {
      lines.push('');
      lines.push('<!-- Twitter Card -->');
      for (const [name, value] of twTags) {
        if (value) {
          lines.push(`<meta name="${name}" content="${this.escapeHtml(value)}">`);
        }
      }
    }

    return lines.join('\n');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.generatedCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  resetAll(): void {
    this.data = {
      title: '',
      description: '',
      canonical: '',
      robots: 'index, follow',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      ogUrl: '',
      ogType: 'website',
      ogSiteName: '',
      twitterCard: 'summary_large_image',
      twitterTitle: '',
      twitterDescription: '',
      twitterImage: ''
    };
    this.syncOg = true;
    this.syncTwitter = true;
  }

  loadFromUrl(): void {
    // Client-side: manual only. This is a placeholder for future URL fetch functionality.
  }

  truncateText(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.substring(0, max) + '...';
  }
}
