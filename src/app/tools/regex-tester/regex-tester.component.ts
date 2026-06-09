import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface MatchResult {
  index: number;
  value: string;
  start: number;
  end: number;
  groups: { name: string; value: string | undefined }[];
}

interface ExplainToken {
  token: string;
  description: string;
}

interface CommonPattern {
  label: string;
  icon: string;
  pattern: string;
  flags: { g: boolean; i: boolean; m: boolean; s: boolean; u: boolean };
  hint: string;
}

@Component({
    selector: 'app-regex-tester',
    templateUrl: './regex-tester.component.html',
    styleUrls: ['./regex-tester.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class RegexTesterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Regex Tester — live match highlighting, capture groups & plain-English explanations. No sign-up 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools/regex-tester')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/regex-tester')}`;

  // Inputs
  pattern = '';
  testString = '';

  // Flags
  flagG = true;
  flagI = false;
  flagM = false;
  flagS = false;
  flagU = false;

  // State
  matches: MatchResult[] = [];
  errorMessage = '';
  highlightedHtml: SafeHtml = '';
  explainTokens: ExplainToken[] = [];
  copiedPattern = false;
  hasRun = false;

  readonly commonPatterns: CommonPattern[] = [
    {
      label: 'Email',
      icon: '@',
      pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
      flags: { g: true, i: true, m: false, s: false, u: false },
      hint: 'Matches email addresses'
    },
    {
      label: 'URL',
      icon: '🔗',
      pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*',
      flags: { g: true, i: true, m: false, s: false, u: false },
      hint: 'Matches HTTP/HTTPS URLs'
    },
    {
      label: 'Phone US',
      icon: '☎',
      pattern: '\\(?\\d{3}\\)?[\\s.\\-]?\\d{3}[\\s.\\-]?\\d{4}',
      flags: { g: true, i: false, m: false, s: false, u: false },
      hint: 'US phone number formats'
    },
    {
      label: 'IPv4',
      icon: '◉',
      pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
      flags: { g: true, i: false, m: false, s: false, u: false },
      hint: 'Valid IPv4 address'
    },
    {
      label: 'Date ISO',
      icon: '◈',
      pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])',
      flags: { g: true, i: false, m: false, s: false, u: false },
      hint: 'ISO 8601 date YYYY-MM-DD'
    },
    {
      label: 'Hex Color',
      icon: '#',
      pattern: '#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b',
      flags: { g: true, i: true, m: false, s: false, u: false },
      hint: 'CSS hex color (#fff or #ffffff)'
    },
    {
      label: 'ZIP Code',
      icon: '◻',
      pattern: '\\b\\d{5}(?:-\\d{4})?\\b',
      flags: { g: true, i: false, m: false, s: false, u: false },
      hint: 'US ZIP code (5 or 9 digits)'
    },
    {
      label: 'HTML Tag',
      icon: '</>',
      pattern: '<\\/?(\\w+)(?:\\s[^>]*)?>',
      flags: { g: true, i: true, m: false, s: false, u: false },
      hint: 'HTML opening/closing tags'
    }
  ];

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  get flags(): string {
    let f = '';
    if (this.flagG) f += 'g';
    if (this.flagI) f += 'i';
    if (this.flagM) f += 'm';
    if (this.flagS) f += 's';
    if (this.flagU) f += 'u';
    return f;
  }

  get regexDisplay(): string {
    return `/${this.pattern}/${this.flags}`;
  }

  onInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.runMatch(), 300);
  }

  insertPattern(p: CommonPattern) {
    this.pattern = p.pattern;
    this.flagG = p.flags.g;
    this.flagI = p.flags.i;
    this.flagM = p.flags.m;
    this.flagS = p.flags.s;
    this.flagU = p.flags.u;
    this.runMatch();
  }

  runMatch() {
    this.hasRun = true;
    this.errorMessage = '';
    this.matches = [];
    this.explainTokens = [];

    if (!this.pattern) {
      this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(
        `<span class="rt-test-text">${this.escapeHtml(this.testString)}</span>`
      );
      return;
    }

    let regex: RegExp;
    try {
      regex = new RegExp(this.pattern, this.flags);
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Invalid regular expression';
      this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(
        `<span class="rt-test-text">${this.escapeHtml(this.testString)}</span>`
      );
      return;
    }

    this.matches = this.collectMatches(regex);
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.buildHighlightedHtml());
    this.explainTokens = this.explainRegex(this.pattern);
  }

  private collectMatches(regex: RegExp): MatchResult[] {
    if (!this.testString) return [];
    const results: MatchResult[] = [];

    if (this.flagG) {
      const r = new RegExp(regex.source, regex.flags);
      r.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = r.exec(this.testString)) !== null) {
        results.push({
          index: results.length,
          value: m[0],
          start: m.index,
          end: m.index + m[0].length,
          groups: this.extractGroups(m)
        });
        if (m[0].length === 0) r.lastIndex++;
        if (results.length > 500) break; // safety limit
      }
    } else {
      const m = regex.exec(this.testString);
      if (m) {
        results.push({
          index: 0,
          value: m[0],
          start: m.index,
          end: m.index + m[0].length,
          groups: this.extractGroups(m)
        });
      }
    }

    return results;
  }

  private extractGroups(m: RegExpExecArray): { name: string; value: string | undefined }[] {
    const groups: { name: string; value: string | undefined }[] = [];
    for (let i = 1; i < m.length; i++) {
      groups.push({ name: `$${i}`, value: m[i] });
    }
    if (m.groups) {
      for (const [k, v] of Object.entries(m.groups)) {
        groups.push({ name: k, value: v });
      }
    }
    return groups;
  }

  private buildHighlightedHtml(): string {
    if (!this.testString) return '<span class="rt-test-text"></span>';
    if (!this.matches.length) {
      return `<span class="rt-test-text">${this.escapeHtml(this.testString)}</span>`;
    }

    let html = '';
    let pos = 0;
    for (const match of this.matches) {
      if (pos < match.start) {
        html += this.escapeHtml(this.testString.slice(pos, match.start));
      }
      const matchText = this.escapeHtml(this.testString.slice(match.start, match.end));
      html += `<mark class="rt-match" data-idx="${match.index}">${matchText}</mark>`;
      pos = match.end;
    }
    if (pos < this.testString.length) {
      html += this.escapeHtml(this.testString.slice(pos));
    }
    return `<span class="rt-test-text">${html}</span>`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Regex explainer ─────────────────────────────────────────────────────────

  private explainRegex(pattern: string): ExplainToken[] {
    const tokens: ExplainToken[] = [];
    let i = 0;

    const addQuantifier = (q: string) => {
      if (tokens.length > 0) {
        tokens[tokens.length - 1] = {
          ...tokens[tokens.length - 1],
          description: tokens[tokens.length - 1].description + ' ' + q
        };
      }
    };

    while (i < pattern.length) {
      const ch = pattern[i];

      if (ch === '^') {
        tokens.push({ token: '^', description: 'Start of string (or line with m flag)' });
        i++;
      } else if (ch === '$') {
        tokens.push({ token: '$', description: 'End of string (or line with m flag)' });
        i++;
      } else if (ch === '.') {
        tokens.push({ token: '.', description: 'Any character except newline (use s flag for newline too)' });
        i++;
      } else if (ch === '|') {
        tokens.push({ token: '|', description: 'OR — match either the left or right side' });
        i++;
      } else if (ch === '\\' && i + 1 < pattern.length) {
        i++;
        const next = pattern[i];
        const escMap: Record<string, string> = {
          'd': 'Any digit [0–9]',
          'D': 'Any non-digit character',
          'w': 'Any word character [a–zA–Z0–9_]',
          'W': 'Any non-word character',
          's': 'Any whitespace (space, tab, newline…)',
          'S': 'Any non-whitespace character',
          'b': 'Word boundary — position between word and non-word',
          'B': 'Non-word boundary',
          'n': 'Newline character (\\n)',
          't': 'Tab character (\\t)',
          'r': 'Carriage return (\\r)',
          'f': 'Form-feed character',
          '0': 'Null character',
        };
        tokens.push({ token: `\\${next}`, description: escMap[next] ?? `Escaped literal "${next}"` });
        i++;
      } else if (ch === '[') {
        let j = i + 1;
        let negated = false;
        if (j < pattern.length && pattern[j] === '^') { negated = true; j++; }
        while (j < pattern.length && pattern[j] !== ']') {
          if (pattern[j] === '\\') j++;
          j++;
        }
        const inner = pattern.slice(i + 1, j);
        const displayInner = negated ? inner.slice(1) : inner;
        const desc = negated
          ? `Any character NOT in [${displayInner}]`
          : `Any character from [${displayInner}]`;
        tokens.push({ token: pattern.slice(i, j + 1), description: desc });
        i = j + 1;
      } else if (ch === '(') {
        if (pattern[i + 1] === '?' && pattern[i + 2] === ':') {
          tokens.push({ token: '(?:…)', description: 'Non-capturing group — groups without saving the match' });
          i += 3;
        } else if (pattern[i + 1] === '?' && pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
          let j = i + 3;
          while (j < pattern.length && pattern[j] !== '>') j++;
          const name = pattern.slice(i + 3, j);
          tokens.push({ token: `(?<${name}>…)`, description: `Named capturing group "${name}" — access via match.groups.${name}` });
          i = j + 1;
        } else if (pattern[i + 1] === '?' && pattern[i + 2] === '=') {
          tokens.push({ token: '(?=…)', description: 'Positive lookahead — position must be followed by this pattern' });
          i += 3;
        } else if (pattern[i + 1] === '?' && pattern[i + 2] === '!') {
          tokens.push({ token: '(?!…)', description: 'Negative lookahead — position must NOT be followed by this pattern' });
          i += 3;
        } else if (pattern[i + 1] === '?' && pattern[i + 2] === '<' && pattern[i + 3] === '=') {
          tokens.push({ token: '(?<=…)', description: 'Positive lookbehind — position must be preceded by this pattern' });
          i += 4;
        } else if (pattern[i + 1] === '?' && pattern[i + 2] === '<' && pattern[i + 3] === '!') {
          tokens.push({ token: '(?<!…)', description: 'Negative lookbehind — position must NOT be preceded by this pattern' });
          i += 4;
        } else {
          tokens.push({ token: '(…)', description: 'Capturing group — saves the matched text as a capture group' });
          i++;
        }
      } else if (ch === ')') {
        i++;
      } else if (ch === '*') {
        const lazy = pattern[i + 1] === '?';
        addQuantifier(lazy ? '(zero or more times, lazy — as few as possible)' : '(zero or more times, greedy)');
        i += lazy ? 2 : 1;
      } else if (ch === '+') {
        const lazy = pattern[i + 1] === '?';
        addQuantifier(lazy ? '(one or more times, lazy — as few as possible)' : '(one or more times, greedy)');
        i += lazy ? 2 : 1;
      } else if (ch === '?') {
        addQuantifier('(optional — zero or one time)');
        i++;
      } else if (ch === '{') {
        let j = i + 1;
        while (j < pattern.length && pattern[j] !== '}') j++;
        const q = pattern.slice(i + 1, j);
        const [min, max] = q.split(',');
        let quantDesc = '';
        if (max === undefined) quantDesc = `exactly ${min} time${min === '1' ? '' : 's'}`;
        else if (max.trim() === '') quantDesc = `${min} or more times`;
        else quantDesc = `between ${min.trim()} and ${max.trim()} times`;
        addQuantifier(`(${quantDesc})`);
        i = j + 1;
      } else {
        // Literal character — peek ahead to see if a quantifier follows (affects merging)
        const nextCh = pattern[i + 1];
        const nextIsQuantifier = !!nextCh && /[*+?{]/.test(nextCh);
        if (nextIsQuantifier) {
          tokens.push({ token: `"${ch}"`, description: `Literal "${ch}"` });
          i++;
        } else {
          let literal = ch;
          let j = i + 1;
          while (j < pattern.length) {
            const nc = pattern[j];
            if (/[.^$*+?{}[\]\\()|]/.test(nc)) break;
            const nnc = pattern[j + 1];
            if (nnc && /[*+?{]/.test(nnc)) break; // stop before char that will get a quantifier
            literal += nc;
            j++;
          }
          tokens.push({ token: `"${literal}"`, description: `Literal text "${literal}"` });
          i = j;
        }
      }
    }

    return tokens;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async copyPattern() {
    if (!this.pattern || !this.isBrowser) return;
    const text = `/${this.pattern}/${this.flags}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedPattern = true;
      setTimeout(() => (this.copiedPattern = false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.copiedPattern = true;
      setTimeout(() => (this.copiedPattern = false), 2000);
    }
  }

  clearAll() {
    this.pattern = '';
    this.testString = '';
    this.matches = [];
    this.errorMessage = '';
    this.highlightedHtml = '';
    this.explainTokens = [];
    this.hasRun = false;
  }
}
