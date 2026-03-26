import { Injectable } from '@angular/core';
import { TranslationService } from '../translation.service';
import { ToolCard } from './tools.component';

@Injectable({ providedIn: 'root' })
export class ToolsDataService {

  constructor(private translationService: TranslationService) {}

  private t(key: string): string {
    return this.translationService.translate(key);
  }

  getTools(): ToolCard[] {
    return [
      {
        id: 'pdf-generator',
        title: this.t('tools.pdf.title'),
        description: this.t('tools.pdf.desc'),
        route: '/tools/pdf-generator',
        status: 'live',
        tags: ['PDF', 'Images', 'Export'],
        icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`
      },
      {
        id: 'color-palette',
        title: this.t('tools.color.title'),
        description: this.t('tools.color.desc'),
        route: '/tools/color-palette',
        status: 'live',
        tags: ['Colors', 'Design', 'CSS'],
        icon: `<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r="1.5" fill="currentColor" stroke="none"/>`
      },
      {
        id: 'contrast-checker',
        title: this.t('tools.contrast.title'),
        description: this.t('tools.contrast.desc'),
        route: '/tools/contrast-checker',
        status: 'live',
        tags: ['Accessibility', 'WCAG', 'Colors'],
        icon: `<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/>`
      },
      {
        id: 'image-compressor',
        title: this.t('tools.compressor.title'),
        description: this.t('tools.compressor.desc'),
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
        tags: ['Email', 'DevOps', 'DNS', 'Security'],
        icon: `<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="17.5" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="15.5 17.5 17 19 20 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      },
      {
        id: 'box-shadow-generator',
        title: 'CSS Box Shadow Generator',
        description: 'Visually design layered CSS box shadows with live preview and code export.',
        route: '/tools/box-shadow-generator',
        status: 'live',
        tags: ['CSS', 'Design', 'Generator'],
        icon: `<rect x="4" y="6" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="8" y="9" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/>`
      },
      {
        id: 'email-deliverability-auditor',
        title: 'Email Deliverability Auditor',
        description: 'Audit SPF, DKIM, DMARC & MX records and get instant fix suggestions for email delivery.',
        route: '/tools/email-deliverability-auditor',
        status: 'live',
        tags: ['Email', 'DNS', 'Security', 'DevTools', 'SPF', 'DMARC'],
        icon: `<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke-width="1.5" fill="none"/><path d="M3 5l9 7 9-7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      },
      {
        id: 'ssl-certificate-inspector',
        title: 'SSL Certificate Inspector',
        description: 'Inspect SSL/TLS certificates, visualize chain of trust, and audit CA reputation instantly.',
        route: '/tools/ssl-certificate-inspector',
        status: 'live',
        tags: ['Security', 'SSL/TLS', 'Networking', 'DevTools', 'HTTPS'],
        icon: `<path d="M12 2L4 5v6c0 4.418 3.358 8.547 8 9.95C16.642 19.547 20 15.418 20 11V5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>`
      },
      {
        id: 'svg-to-code',
        title: 'SVG to Code Converter',
        description: 'Convert SVGs to optimized React, Vue, or Angular components with props and a11y.',
        route: '/tools/svg-to-code',
        status: 'live',
        tags: ['SVG', 'React', 'Vue', 'Angular', 'Components', 'Accessibility', 'Frontend', 'Code Generator'],
        icon: `<path d="M3 6l4 6-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="14" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`
      },
      {
        id: 'json-formatter',
        title: 'JSON Formatter & Validator',
        description: 'Format, validate, minify and repair JSON with live syntax checking and one-click copy.',
        route: '/tools/json-formatter',
        status: 'live',
        tags: ['JSON', 'Formatter', 'Validator', 'Code Tools'],
        icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/><polyline points="10 9 9 9 8 9"/>`
      },
      {
        id: 'ssl-certificate-auditor',
        title: 'SSL Certificate Auditor',
        description: 'Audit SSL certificates, verify CA chain, and surface security flags instantly.',
        route: '/tools/ssl-certificate-auditor',
        status: 'live',
        tags: ['Security', 'SSL/TLS', 'DevTools', 'HTTPS', 'Networking'],
        icon: `<path d="M12 2L4 5v6c0 4.418 3.358 8.538 8 9.95C16.642 19.538 20 15.418 20 11V5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      },
      {
        id: 'base64-encoder',
        title: 'Base64 Encoder & Decoder',
        description: 'Encode text or files to Base64 and decode Base64 back to text with URL-safe mode and live conversion.',
        route: '/tools/base64-encoder',
        status: 'live',
        tags: ['Base64', 'Encoding', 'Code Tools', 'Utilities'],
        icon: `<path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><rect x="14" y="13" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 16l1 1 2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
      },
      {
        id: 'regex-tester',
        title: 'Regex Tester',
        description: 'Test and debug regular expressions live with match highlighting, capture groups, flags and plain-English explanations.',
        route: '/tools/regex-tester',
        status: 'live',
        tags: ['Regex', 'Code Tools', 'Debugger', 'Developer'],
        icon: `<path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M7 5l-4 7 4 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M17 5l4 7-4 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      }
    ];
  }

  getRelatedTools(currentId: string, count: number = 4): ToolCard[] {
    const tools = this.getTools();
    const current = tools.find(t => t.id === currentId);
    if (!current) return [];
    const currentTags = new Set(current.tags.map(t => t.toLowerCase()));
    return tools
      .filter(t => t.id !== currentId && t.status === 'live')
      .map(t => ({
        tool: t,
        score: t.tags.filter(tag => currentTags.has(tag.toLowerCase())).length
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(r => r.tool);
  }
}
