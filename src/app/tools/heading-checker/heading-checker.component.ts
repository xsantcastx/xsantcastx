import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface HeadingEntry {
  level: number;
  text: string;
  line: number;
}

interface HeadingIssue {
  type: 'error' | 'warning';
  message: string;
}

@Component({
  selector: 'app-heading-checker',
  templateUrl: './heading-checker.component.html',
  styleUrls: ['./heading-checker.component.css'],
  standalone: false
})
export class HeadingCheckerComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HTML Heading Checker — extract headings, show hierarchy, flag SEO issues')}&url=${encodeURIComponent(SITE_URL + '/tools/heading-checker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/heading-checker')}`;

  htmlInput = '';
  headings: HeadingEntry[] = [];
  issues: HeadingIssue[] = [];
  copied = false;

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  onInput(): void {
    this.analyze();
  }

  private analyze(): void {
    this.headings = [];
    this.issues = [];
    if (!this.htmlInput.trim()) return;

    const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match: RegExpExecArray | null;
    const lines = this.htmlInput.split('\n');

    while ((match = regex.exec(this.htmlInput)) !== null) {
      const level = parseInt(match[1], 10);
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      const pos = this.htmlInput.substring(0, match.index).split('\n').length;
      this.headings.push({ level, text, line: pos });
    }

    // Check issues
    if (this.headings.length === 0) return;

    const h1Count = this.headings.filter(h => h.level === 1).length;
    if (h1Count === 0) this.issues.push({ type: 'error', message: 'Missing H1 tag — every page should have exactly one H1.' });
    if (h1Count > 1) this.issues.push({ type: 'warning', message: `Multiple H1 tags found (${h1Count}). Best practice is one H1 per page.` });

    if (this.headings[0].level !== 1) this.issues.push({ type: 'warning', message: 'First heading is not H1. The page should start with an H1.' });

    for (let i = 1; i < this.headings.length; i++) {
      const diff = this.headings[i].level - this.headings[i - 1].level;
      if (diff > 1) {
        this.issues.push({
          type: 'error',
          message: `Skipped heading level: H${this.headings[i - 1].level} to H${this.headings[i].level} at line ${this.headings[i].line}.`
        });
      }
    }

    for (const h of this.headings) {
      if (!h.text) this.issues.push({ type: 'warning', message: `Empty heading (H${h.level}) at line ${h.line}.` });
    }

    // Easter egg: all 6 levels used correctly
    const usedLevels = new Set(this.headings.map(h => h.level));
    if (usedLevels.size === 6 && this.issues.filter(i => i.type === 'error').length === 0) {
      this.eggs.trigger('heading-perfect');
    }
  }

  get headingIndent(): (level: number) => string {
    return (level: number) => '  '.repeat(level - 1);
  }

  clearAll(): void { this.htmlInput = ''; this.headings = []; this.issues = []; }

  loadSample(): void {
    this.htmlInput = `<h1>My Website</h1>\n<h2>About Us</h2>\n<h3>Our Mission</h3>\n<h3>Our Team</h3>\n<h4>Leadership</h4>\n<h4>Developers</h4>\n<h5>Frontend</h5>\n<h5>Backend</h5>\n<h6>Database</h6>\n<h2>Services</h2>\n<h3>Web Development</h3>\n<h3>Mobile Apps</h3>\n<h2>Contact</h2>`;
    this.onInput();
  }
}
