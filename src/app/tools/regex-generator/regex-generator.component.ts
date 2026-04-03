import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface RegexPattern {
  name: string;
  pattern: string;
  description: string;
  flags: string;
  category: string;
}

@Component({
  selector: 'app-regex-generator',
  templateUrl: './regex-generator.component.html',
  styleUrls: ['./regex-generator.component.css'],
  standalone: false
})
export class RegexGeneratorComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Regex Pattern Generator — common patterns, live testing, no sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/regex-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/regex-generator')}`;

  // ── Natural language input ────────────────────────────────────────────────
  nlInput = '';
  generatedPattern = '';
  generatedFlags = '';

  // ── Pattern library ───────────────────────────────────────────────────────
  readonly patternLibrary: RegexPattern[] = [
    { name: 'Email',       pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',                                              description: 'Matches standard email addresses',                  flags: 'g',  category: 'Web' },
    { name: 'URL',         pattern: 'https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+(\\/[\\w\\-./?%&=@#]*)?',                                       description: 'Matches HTTP/HTTPS URLs',                           flags: 'gi', category: 'Web' },
    { name: 'Phone (US)',  pattern: '(\\+1[\\s.-]?)?(\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}',                                        description: 'Matches US phone numbers in various formats',       flags: 'g',  category: 'Identity' },
    { name: 'IPv4',        pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',               description: 'Matches valid IPv4 addresses (0.0.0.0-255.255.255.255)', flags: 'g', category: 'Network' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])',                                                description: 'Matches ISO 8601 date format',                     flags: 'g',  category: 'DateTime' },
    { name: 'Time (HH:MM)', pattern: '([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?',                                                             description: 'Matches 24-hour time with optional seconds',        flags: 'g',  category: 'DateTime' },
    { name: 'Hex Color',   pattern: '#([0-9a-fA-F]{3}){1,2}\\b',                                                                          description: 'Matches 3 or 6 digit hex color codes',             flags: 'gi', category: 'Web' },
    { name: 'Credit Card', pattern: '\\b(?:4\\d{3}|5[1-5]\\d{2}|3[47]\\d{2}|6(?:011|5\\d{2}))[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{3,4}\\b', description: 'Matches Visa, MC, Amex, Discover card numbers',  flags: 'g',  category: 'Identity' },
    { name: 'SSN',         pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',                                                                          description: 'Matches US Social Security Numbers (XXX-XX-XXXX)', flags: 'g',  category: 'Identity' },
    { name: 'Zip Code (US)', pattern: '\\b\\d{5}(-\\d{4})?\\b',                                                                            description: 'Matches 5 or 9 digit US zip codes',               flags: 'g',  category: 'Identity' },
  ];

  // ── Flags ─────────────────────────────────────────────────────────────────
  flagG = true;
  flagI = false;
  flagM = false;
  flagS = false;

  // ── Test area ─────────────────────────────────────────────────────────────
  testPattern = '';
  testText = '';
  testMatches: { text: string; index: number }[] = [];
  testError = '';
  matchCount = 0;

  // ── UI state ──────────────────────────────────────────────────────────────
  copiedId = '';
  activeCategory = 'All';

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Natural language generation ───────────────────────────────────────────
  get categories(): string[] {
    const cats = new Set(this.patternLibrary.map(p => p.category));
    return ['All', ...cats];
  }

  get filteredPatterns(): RegexPattern[] {
    if (this.activeCategory === 'All') return this.patternLibrary;
    return this.patternLibrary.filter(p => p.category === this.activeCategory);
  }

  generateFromNL() {
    const input = this.nlInput.toLowerCase().trim();
    if (!input) {
      this.generatedPattern = '';
      this.generatedFlags = '';
      return;
    }

    // Match against known patterns
    const keywords: { keys: string[]; idx: number }[] = [
      { keys: ['email', 'e-mail', 'mail address'],         idx: 0 },
      { keys: ['url', 'link', 'website', 'http'],          idx: 1 },
      { keys: ['phone', 'telephone', 'mobile', 'cell'],    idx: 2 },
      { keys: ['ip', 'ipv4', 'ip address'],                idx: 3 },
      { keys: ['date', 'yyyy', 'iso date'],                idx: 4 },
      { keys: ['time', 'hh:mm', 'hour', 'clock'],          idx: 5 },
      { keys: ['hex', 'color', 'colour', '#'],              idx: 6 },
      { keys: ['credit card', 'visa', 'mastercard', 'card number'], idx: 7 },
      { keys: ['ssn', 'social security'],                   idx: 8 },
      { keys: ['zip', 'zip code', 'postal'],                idx: 9 },
    ];

    for (const kw of keywords) {
      if (kw.keys.some(k => input.includes(k))) {
        const match = this.patternLibrary[kw.idx];
        this.generatedPattern = match.pattern;
        this.generatedFlags = match.flags;
        this.testPattern = match.pattern;
        this.runTest();
        return;
      }
    }

    // Fallback heuristic patterns
    if (input.includes('number') || input.includes('digit')) {
      this.generatedPattern = '\\d+';
      this.generatedFlags = 'g';
    } else if (input.includes('word')) {
      this.generatedPattern = '\\b\\w+\\b';
      this.generatedFlags = 'g';
    } else if (input.includes('whitespace') || input.includes('space')) {
      this.generatedPattern = '\\s+';
      this.generatedFlags = 'g';
    } else if (input.includes('alphanumeric')) {
      this.generatedPattern = '[a-zA-Z0-9]+';
      this.generatedFlags = 'g';
    } else if (input.includes('letter') || input.includes('alpha')) {
      this.generatedPattern = '[a-zA-Z]+';
      this.generatedFlags = 'g';
    } else if (input.includes('line') || input.includes('sentence')) {
      this.generatedPattern = '.+';
      this.generatedFlags = 'gm';
    } else {
      // Escape the user input as a literal match
      this.generatedPattern = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      this.generatedFlags = 'gi';
    }

    this.testPattern = this.generatedPattern;
    this.runTest();
  }

  // ── Pattern library actions ───────────────────────────────────────────────
  usePattern(pattern: RegexPattern) {
    this.testPattern = pattern.pattern;
    this.flagG = pattern.flags.includes('g');
    this.flagI = pattern.flags.includes('i');
    this.flagM = pattern.flags.includes('m');
    this.flagS = pattern.flags.includes('s');
    this.runTest();
  }

  async copyPattern(pattern: RegexPattern) {
    if (!this.isBrowser) return;
    const full = `/${pattern.pattern}/${pattern.flags}`;
    try {
      await navigator.clipboard.writeText(full);
      this.copiedId = pattern.name;
      setTimeout(() => (this.copiedId = ''), 2000);
    } catch {
      this.fallbackCopy(full, pattern.name);
    }
  }

  async copyGenerated() {
    if (!this.isBrowser || !this.generatedPattern) return;
    const full = `/${this.generatedPattern}/${this.generatedFlags}`;
    try {
      await navigator.clipboard.writeText(full);
      this.copiedId = '__generated__';
      setTimeout(() => (this.copiedId = ''), 2000);
    } catch {
      this.fallbackCopy(full, '__generated__');
    }
  }

  private fallbackCopy(text: string, id: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedId = id;
    setTimeout(() => (this.copiedId = ''), 2000);
  }

  // ── Flags ─────────────────────────────────────────────────────────────────
  get activeFlags(): string {
    let f = '';
    if (this.flagG) f += 'g';
    if (this.flagI) f += 'i';
    if (this.flagM) f += 'm';
    if (this.flagS) f += 's';
    return f;
  }

  onFlagChange() {
    // Easter egg: all flags selected simultaneously
    if (this.flagG && this.flagI && this.flagM && this.flagS) {
      this.eggs.trigger('regex-all-flags');
    }
    this.runTest();
  }

  // ── Test area ─────────────────────────────────────────────────────────────
  runTest() {
    this.testMatches = [];
    this.testError = '';
    this.matchCount = 0;

    if (!this.testPattern || !this.testText) return;

    try {
      const regex = new RegExp(this.testPattern, this.activeFlags);
      let match: RegExpExecArray | null;
      const matches: { text: string; index: number }[] = [];
      const limit = 500;

      if (this.activeFlags.includes('g')) {
        while ((match = regex.exec(this.testText)) !== null && matches.length < limit) {
          matches.push({ text: match[0], index: match.index });
          if (match[0].length === 0) regex.lastIndex++;
        }
      } else {
        match = regex.exec(this.testText);
        if (match) {
          matches.push({ text: match[0], index: match.index });
        }
      }

      this.testMatches = matches;
      this.matchCount = matches.length;
    } catch (e: any) {
      this.testError = e.message || 'Invalid regular expression';
    }
  }

  get highlightedText(): string {
    if (!this.testText || !this.testPattern || this.testError) {
      return this.escapeHtml(this.testText);
    }
    if (this.testMatches.length === 0) {
      return this.escapeHtml(this.testText);
    }

    try {
      const regex = new RegExp(this.testPattern, this.activeFlags);
      return this.testText.replace(regex, (match) => {
        return `<mark class="rxg-highlight">${this.escapeHtml(match)}</mark>`;
      });
    } catch {
      return this.escapeHtml(this.testText);
    }
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadSampleText() {
    this.testText = `Contact us at support@example.com or admin@test.org
Visit https://www.example.com/path?q=1 for more info.
Call (555) 123-4567 or +1 800-555-0199
Server IP: 192.168.1.1 or 10.0.0.255
Date: 2025-12-25 Time: 14:30:00
Colors: #FF5733 #0cc #abcdef
Card: 4111-1111-1111-1111
SSN: 123-45-6789
Zip: 90210 or 90210-1234`;
    this.runTest();
  }
}
