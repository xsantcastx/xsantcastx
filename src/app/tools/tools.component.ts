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
        id: 'gmail-deliverability-checker',
        title: 'Gmail Deliverability Checker',
        description: 'Diagnose email delivery issues and auto-generate SPF, DKIM, DMARC fixes',
        route: '/tools/gmail-deliverability-checker',
        status: 'live',
        tags: ['email-marketing', 'devops', 'dns-tools', 'gmail', 'security', 'indie-hackers'],
        icon: `<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="17.5" cy="17.5" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
<polyline points="15.5 17.5 17 19 20 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      },
      {
        id: 'box-shadow-generator',
        title: 'CSS Box Shadow Generator',
        description: 'Visually design layered CSS box shadows with live preview and code export.',
        route: '/tools/box-shadow-generator',
        status: 'live',
        tags: ['CSS', 'Design', 'Generator'],
        icon: `<rect x="4" y="6" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
<rect x="8" y="9" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/>
<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="2" fill="none"/>
<path d="M19 14l2 2-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<line x1="18" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
      },
      {
        id: 'email-deliverability-auditor',
        title: 'Email Deliverability Auditor',
        description: 'Audit SPF, DKIM, DMARC & MX records and get instant fix suggestions for email delivery.',
        route: '/tools/email-deliverability-auditor',
        status: 'live',
        tags: ['Email', 'DNS', 'Security', 'DevTools', 'SPF', 'DMARC'],
        icon: `<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke-width="1.5" fill="none"/>
<path d="M3 5l9 7 9-7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="17" cy="17" r="3.5" stroke`
      },
      {
        id: 'ssl-certificate-inspector',
        title: 'SSL Certificate Inspector',
        description: 'Inspect SSL/TLS certificates, visualize chain of trust, and audit CA reputation instantly.',
        route: '/tools/ssl-certificate-inspector',
        status: 'live',
        tags: ['Security', 'SSL/TLS', 'Networking', 'DevTools', 'HTTPS'],
        icon: `<path d="M12 2L4 5v6c0 4.418 3.358 8.547 8 9.95C16.642 19.547 20 15.418 20 11V5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
<circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
<path d="M10.5 13.5L9 16h6l-1.5-2.5" stroke="`
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
