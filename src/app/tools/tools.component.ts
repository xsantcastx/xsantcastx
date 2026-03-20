import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../seo.service';

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

  constructor(private router: Router) {}

  readonly tools: ToolCard[] = [
    {
      id: 'pdf-generator',
      title: 'PDF Catalog Generator',
      description: 'Upload images, configure layout and captions, and export a polished catalog-style PDF — entirely in your browser. No uploads, no accounts.',
      route: '/tools/pdf-generator',
      status: 'live',
      tags: ['PDF', 'Images', 'Export'],
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`
    },
    {
      id: 'color-palette',
      title: 'Color Palette Extractor',
      description: 'Upload any image and instantly extract its dominant colors. Copy hex, RGB or HSL values, export as CSS variables, Tailwind config, or JSON.',
      route: '/tools/color-palette',
      status: 'live',
      tags: ['Colors', 'Design', 'CSS'],
      icon: `<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r="1.5" fill="currentColor" stroke="none"/>`
    },
    {
      id: 'contrast-checker',
      title: 'Contrast Checker',
      description: 'Check WCAG AA/AAA contrast ratios between any two colors. Instant pass/fail for text, UI components, and large text thresholds.',
      route: '/tools/contrast-checker',
      status: 'live',
      tags: ['Accessibility', 'WCAG', 'Colors'],
      icon: `<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/>`
    },
    {
      id: 'image-compressor',
      title: 'Image Compressor',
      description: 'Compress JPEG, PNG and WebP images in your browser with live quality preview. No files leave your device.',
      route: '',
      status: 'coming-soon',
      tags: ['Images', 'Performance', 'WebP'],
      icon: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>`
    },
    {
      id: 'gradient-generator',
      title: 'Gradient Generator',
      description: 'Build CSS gradients visually — linear, radial and conic. Add stops, adjust angles, copy ready-to-use CSS with one click.',
      route: '',
      status: 'coming-soon',
      tags: ['CSS', 'Design', 'Colors'],
      icon: `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.15"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#g)" stroke="currentColor"/>`
    },
    {
      id: 'font-pairer',
      title: 'Font Pairer',
      description: 'Preview and pair Google Fonts side by side. Adjust size, weight and line-height, then copy the import snippet.',
      route: '',
      status: 'coming-soon',
      tags: ['Typography', 'Fonts', 'Design'],
      icon: `<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>`
    }
  ];

  navigate(tool: ToolCard) {
    if (tool.status === 'live') {
      this.router.navigate([tool.route]);
    }
  }
}
