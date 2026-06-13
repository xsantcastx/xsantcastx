import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface RegexEntry { pattern: string; description: string; example: string; }
interface RegexCategory { name: string; entries: RegexEntry[]; }

@Component({
    selector: 'app-regex-cheatsheet',
    templateUrl: './regex-cheatsheet.component.html',
    styleUrls: ['./regex-cheatsheet.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class RegexCheatsheetComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Regex Cheatsheet — 80+ patterns categorized!')}&url=${encodeURIComponent(SITE_URL + '/tools/regex-cheatsheet')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/regex-cheatsheet')}`;

  searchTerm = '';
  copied = false;
  copiedPattern = '';

  readonly categories: RegexCategory[] = [
    { name: 'Character Classes', entries: [
      { pattern: '.', description: 'Any character except newline', example: 'a.c matches "abc"' },
      { pattern: '\\d', description: 'Any digit [0-9]', example: '\\d+ matches "123"' },
      { pattern: '\\D', description: 'Any non-digit', example: '\\D+ matches "abc"' },
      { pattern: '\\w', description: 'Word character [a-zA-Z0-9_]', example: '\\w+ matches "hello_1"' },
      { pattern: '\\W', description: 'Non-word character', example: '\\W matches "!"' },
      { pattern: '\\s', description: 'Whitespace character', example: '\\s matches " "' },
      { pattern: '\\S', description: 'Non-whitespace character', example: '\\S+ matches "hello"' },
      { pattern: '[abc]', description: 'Character set', example: '[aeiou] matches vowels' },
      { pattern: '[^abc]', description: 'Negated character set', example: '[^0-9] matches non-digits' },
      { pattern: '[a-z]', description: 'Character range', example: '[a-z]+ matches "hello"' },
    ]},
    { name: 'Anchors', entries: [
      { pattern: '^', description: 'Start of string/line', example: '^Hello matches start' },
      { pattern: '$', description: 'End of string/line', example: 'world$ matches end' },
      { pattern: '\\b', description: 'Word boundary', example: '\\bword\\b exact word' },
      { pattern: '\\B', description: 'Non-word boundary', example: '\\Bword not at boundary' },
    ]},
    { name: 'Quantifiers', entries: [
      { pattern: '*', description: 'Zero or more', example: 'ab*c matches "ac","abc"' },
      { pattern: '+', description: 'One or more', example: 'ab+c matches "abc"' },
      { pattern: '?', description: 'Zero or one', example: 'colou?r matches both' },
      { pattern: '{n}', description: 'Exactly n times', example: '\\d{3} matches "123"' },
      { pattern: '{n,}', description: 'n or more times', example: '\\d{2,} matches "12","123"' },
      { pattern: '{n,m}', description: 'Between n and m times', example: '\\d{2,4} matches "12"-"1234"' },
      { pattern: '*?', description: 'Lazy zero or more', example: '<.*?> non-greedy match' },
      { pattern: '+?', description: 'Lazy one or more', example: '.+? minimal match' },
    ]},
    { name: 'Groups & Alternation', entries: [
      { pattern: '(abc)', description: 'Capturing group', example: '(\\d+) captures digits' },
      { pattern: '(?:abc)', description: 'Non-capturing group', example: '(?:ab)+ matches "abab"' },
      { pattern: '(?<name>)', description: 'Named capturing group', example: '(?<year>\\d{4})' },
      { pattern: 'a|b', description: 'Alternation (or)', example: 'cat|dog matches either' },
      { pattern: '\\1', description: 'Backreference', example: '(\\w)\\1 matches "aa"' },
    ]},
    { name: 'Lookahead & Lookbehind', entries: [
      { pattern: '(?=abc)', description: 'Positive lookahead', example: '\\d(?=px) digit before px' },
      { pattern: '(?!abc)', description: 'Negative lookahead', example: '\\d(?!px) digit not before px' },
      { pattern: '(?<=abc)', description: 'Positive lookbehind', example: '(?<=\\$)\\d+ after $' },
      { pattern: '(?<!abc)', description: 'Negative lookbehind', example: '(?<!\\$)\\d+ not after $' },
    ]},
    { name: 'Flags', entries: [
      { pattern: 'g', description: 'Global search', example: '/pattern/g all matches' },
      { pattern: 'i', description: 'Case insensitive', example: '/hello/i matches "HELLO"' },
      { pattern: 'm', description: 'Multiline mode', example: '/^line/m each line start' },
      { pattern: 's', description: 'Dotall (. matches \\n)', example: '/a.b/s spans lines' },
      { pattern: 'u', description: 'Unicode mode', example: '/\\u{61}/u matches "a"' },
    ]},
    { name: 'Common Patterns', entries: [
      { pattern: '^[\\w.-]+@[\\w.-]+\\.\\w{2,}$', description: 'Email address', example: 'user@example.com' },
      { pattern: '^https?://[\\w.-]+', description: 'URL', example: 'https://example.com' },
      { pattern: '^\\d{1,3}(\\.\\d{1,3}){3}$', description: 'IPv4 address', example: '192.168.1.1' },
      { pattern: '^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$', description: 'Hex color', example: '#ff0000 or #f00' },
      { pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date (YYYY-MM-DD)', example: '2024-01-15' },
      { pattern: '^\\+?\\d{1,3}[-.\\s]?\\d{3,}', description: 'Phone number', example: '+1-555-1234' },
      { pattern: '^\\d{5}(-\\d{4})?$', description: 'US ZIP code', example: '12345 or 12345-6789' },
      { pattern: '<[^>]+>', description: 'HTML tag', example: '<div class="x">' },
      { pattern: '\\b\\d{1,3}(,\\d{3})*(\\.\\d+)?\\b', description: 'Number with commas', example: '1,234,567.89' },
      { pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,}$', description: 'Strong password', example: 'Min 8, upper, lower, digit' },
    ]},
    { name: 'Escaping', entries: [
      { pattern: '\\.', description: 'Escaped dot (literal .)', example: 'file\\.txt matches "file.txt"' },
      { pattern: '\\\\', description: 'Escaped backslash', example: 'path\\\\to matches "path\\to"' },
      { pattern: '\\(', description: 'Escaped parenthesis', example: 'f\\(x\\) matches "f(x)"' },
      { pattern: '\\[', description: 'Escaped bracket', example: '\\[0\\] matches "[0]"' },
      { pattern: '\\{', description: 'Escaped brace', example: '\\{a\\} matches "{a}"' },
      { pattern: '\\*', description: 'Escaped asterisk', example: '2\\*3 matches "2*3"' },
      { pattern: '\\+', description: 'Escaped plus', example: 'C\\+\\+ matches "C++"' },
      { pattern: '\\?', description: 'Escaped question mark', example: 'why\\? matches "why?"' },
      { pattern: '\\|', description: 'Escaped pipe', example: 'a\\|b matches "a|b"' },
      { pattern: '\\^', description: 'Escaped caret', example: '\\^start matches "^start"' },
      { pattern: '\\$', description: 'Escaped dollar', example: '\\$100 matches "$100"' },
    ]},
  ];

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  onSearch() {
    if (this.searchTerm.toLowerCase().includes('catastrophic')) {
      this.eggs.trigger('regex-danger');
    }
  }

  get filteredCategories(): RegexCategory[] {
    if (!this.searchTerm) return this.categories;
    const term = this.searchTerm.toLowerCase();
    return this.categories.map(c => ({
      ...c,
      entries: c.entries.filter(e => e.pattern.toLowerCase().includes(term) || e.description.toLowerCase().includes(term) || e.example.toLowerCase().includes(term))
    })).filter(c => c.entries.length > 0);
  }

  get totalPatterns(): number {
    return this.categories.reduce((sum, c) => sum + c.entries.length, 0);
  }

  async copyPattern(pattern: string) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(pattern);
      this.copiedPattern = pattern;
      setTimeout(() => (this.copiedPattern = ''), 2000);
    } catch {}
  }
}
