import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../seo.service';
import { TranslationService } from '../translation.service';

export interface ToolCard {
  id: string;
  title: string;
  description: string;
  route: string;
  status: 'live' | 'coming-soon';
  tags: string[];
  icon: string; // SVG inner markup
}

@Component({
  selector: 'app-tools',
  templateUrl: './tools.component.html',
  styleUrls: ['./tools.component.css'],
  standalone: false
})
export class ToolsComponent {
  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Just found these free browser tools — PDF Catalog Generator, Color Palette Extractor and more. No sign-up, runs entirely in your browser 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  get tools(): ToolCard[] {
    return [
      {
        id: 'pdf-generator',
        title: this.translate('tools.pdf.title'),
        description: this.translate('tools.pdf.desc'),
        route: '/tools/pdf-generator',
        status: 'live',
        tags: ['PDF', 'Images', 'Export'],
        icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`
      },
      {
        id: 'color-palette',
        title: this.translate('tools.color.title'),
        description: this.translate('tools.color.desc'),
        route: '/tools/color-palette',
        status: 'live',
        tags: ['Colors', 'Design', 'CSS'],
        icon: `<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r="1.5" fill="currentColor" stroke="none"/>`
      },
      {
        id: 'contrast-checker',
        title: this.translate('tools.contrast.title'),
        description: this.translate('tools.contrast.desc'),
        route: '/tools/contrast-checker',
        status: 'live',
        tags: ['Accessibility', 'WCAG', 'Colors'],
        icon: `<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/>`
      },
      {
        id: 'image-compressor',
        title: this.translate('tools.compressor.title'),
        description: this.translate('tools.compressor.desc'),
        route: '/tools/image-compressor',
        status: 'live',
        tags: ['Images', 'Performance', 'WebP'],
        icon: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><polyline points="14 3 14 8 19 8"/>`
      },
      {
        id: 'gradient-generator',
        title: this.translate('tools.gradient.title'),
        description: this.translate('tools.gradient.desc'),
        route: '',
        status: 'coming-soon',
        tags: ['CSS', 'Design', 'Colors'],
        icon: `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.15"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#g)" stroke="currentColor"/>`
      },
      {
        id: 'font-pairer',
        title: this.translate('tools.fontpairer.title'),
        description: this.translate('tools.fontpairer.desc'),
        route: '',
        status: 'coming-soon',
        tags: ['Typography', 'Fonts', 'Design'],
        icon: `<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>`
      }
    ];
  }

  navigate(tool: ToolCard) {
    if (tool.status === 'live') {
      this.router.navigate([tool.route]);
    }
  }
}
