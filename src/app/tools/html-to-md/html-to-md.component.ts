import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type ConvertDirection = 'html-to-md' | 'md-to-html';

@Component({
    selector: 'app-html-to-md',
    templateUrl: './html-to-md.component.html',
    styleUrls: ['./html-to-md.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class HtmlToMdComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free HTML to Markdown Converter — paste HTML, get clean Markdown instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/html-to-md')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/html-to-md')}`;

  // State
  input = '';
  output = '';
  direction: ConvertDirection = 'html-to-md';
  copied = false;

  // Stats
  inputChars = 0;
  outputChars = 0;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  onInput() {
    this.inputChars = this.input.length;

    if (!this.input.trim()) {
      this.output = '';
      this.outputChars = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 250);
  }

  toggleDirection() {
    // Swap direction and content
    const prevOutput = this.output;
    this.direction = this.direction === 'html-to-md' ? 'md-to-html' : 'html-to-md';
    this.input = prevOutput;
    this.onInput();
  }

  convert() {
    if (!this.input.trim()) {
      this.output = '';
      this.outputChars = 0;
      return;
    }

    if (this.direction === 'html-to-md') {
      // Easter egg: detect <marquee> in HTML input
      if (/<marquee[\s>]/i.test(this.input)) {
        this.eggs.trigger('html-marquee');
      }
      this.output = this.htmlToMarkdown(this.input);
    } else {
      this.output = this.markdownToHtml(this.input);
    }

    this.outputChars = this.output.length;
  }

  loadSample() {
    if (this.direction === 'html-to-md') {
      this.input = `<h1>Welcome to My Project</h1>
<p>This is a <strong>bold</strong> and <em>italic</em> text example with a <a href="https://example.com">link</a>.</p>

<h2>Features</h2>
<ul>
  <li>Fast conversion</li>
  <li>No external dependencies</li>
  <li>Supports <code>inline code</code></li>
</ul>

<h3>Ordered Steps</h3>
<ol>
  <li>Paste your HTML</li>
  <li>Get Markdown instantly</li>
  <li>Copy and use</li>
</ol>

<blockquote>
  <p>This is a blockquote with <strong>bold</strong> text inside.</p>
</blockquote>

<pre><code>const greeting = "Hello, World!";
console.log(greeting);</code></pre>

<p>Here is an image:</p>
<img src="https://example.com/photo.jpg" alt="Example Image">

<hr>

<h2>Data Table</h2>
<table>
  <thead>
    <tr><th>Name</th><th>Language</th><th>Stars</th></tr>
  </thead>
  <tbody>
    <tr><td>React</td><td>JavaScript</td><td>200k</td></tr>
    <tr><td>Angular</td><td>TypeScript</td><td>90k</td></tr>
    <tr><td>Vue</td><td>JavaScript</td><td>205k</td></tr>
  </tbody>
</table>`;
    } else {
      this.input = `# Welcome to My Project

This is a **bold** and *italic* text example with a [link](https://example.com).

## Features

- Fast conversion
- No external dependencies
- Supports \`inline code\`

### Ordered Steps

1. Paste your Markdown
2. Get HTML instantly
3. Copy and use

> This is a blockquote with **bold** text inside.

\`\`\`
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

Here is an image:

![Example Image](https://example.com/photo.jpg)

---

## Data Table

| Name | Language | Stars |
| --- | --- | --- |
| React | JavaScript | 200k |
| Angular | TypeScript | 90k |
| Vue | JavaScript | 205k |`;
    }
    this.onInput();
  }

  clearAll() {
    this.input = '';
    this.output = '';
    this.inputChars = 0;
    this.outputChars = 0;
  }

  async copyOutput() {
    if (!this.output || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.output);
    }
  }

  private fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  get inputLabel(): string {
    return this.direction === 'html-to-md' ? 'HTML' : 'Markdown';
  }

  get outputLabel(): string {
    return this.direction === 'html-to-md' ? 'Markdown' : 'HTML';
  }

  get inputPlaceholder(): string {
    return this.direction === 'html-to-md'
      ? 'Paste your HTML here...\n\ne.g. <h1>Title</h1>\n<p>Hello <strong>world</strong></p>'
      : 'Paste your Markdown here...\n\ne.g. # Title\n\nHello **world**';
  }

  // ── HTML to Markdown converter ─────────────────────────────────

  private htmlToMarkdown(html: string): string {
    let md = html;

    // Normalize line endings
    md = md.replace(/\r\n/g, '\n');

    // Handle tables first (before stripping other tags)
    md = this.convertTables(md);

    // Headings h1-h6
    for (let i = 1; i <= 6; i++) {
      const hashes = '#'.repeat(i);
      const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi');
      md = md.replace(re, (_m, content) => `\n${hashes} ${this.stripTags(content).trim()}\n`);
    }

    // Bold: <strong>, <b>
    md = md.replace(/<(strong|b)(?:\s[^>]*)?>([\\s\\S]*?)<\/\1>/gi, '**$2**');

    // Italic: <em>, <i>
    md = md.replace(/<(em|i)(?:\s[^>]*)?>([\\s\\S]*?)<\/\1>/gi, '*$2*');

    // Inline code
    md = md.replace(/<code(?:\s[^>]*)?>([\\s\\S]*?)<\/code>/gi, '`$1`');

    // Code blocks: <pre><code>...</code></pre>
    md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code) => {
      return '\n```\n' + this.decodeHtmlEntities(code).trim() + '\n```\n';
    });

    // Pre blocks without code
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code) => {
      return '\n```\n' + this.decodeHtmlEntities(code).trim() + '\n```\n';
    });

    // Images
    md = md.replace(/<img\s[^>]*?src=["']([^"']+)["'][^>]*?alt=["']([^"']*?)["'][^>]*?\/?>/gi, '![$2]($1)');
    md = md.replace(/<img\s[^>]*?alt=["']([^"']*?)["'][^>]*?src=["']([^"']+)["'][^>]*?\/?>/gi, '![$1]($2)');
    md = md.replace(/<img\s[^>]*?src=["']([^"']+)["'][^>]*?\/?>/gi, '![]($1)');

    // Links
    md = md.replace(/<a\s[^>]*?href=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content) => {
      const inner = this.stripTags(content).trim();
      return '\n' + inner.split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n';
    });

    // Unordered lists
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, content) => {
      const items = this.extractListItems(content);
      return '\n' + items.map((item: string) => `- ${item}`).join('\n') + '\n';
    });

    // Ordered lists
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, content) => {
      const items = this.extractListItems(content);
      return '\n' + items.map((item: string, idx: number) => `${idx + 1}. ${item}`).join('\n') + '\n';
    });

    // Horizontal rules
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Paragraphs
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, content) => `\n${content.trim()}\n`);

    // Line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    md = md.replace(/<\/?[^>]+(>|$)/g, '');

    // Decode HTML entities
    md = this.decodeHtmlEntities(md);

    // Clean up excessive blank lines
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
  }

  private convertTables(html: string): string {
    return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableContent) => {
      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const cells: string[] = [];
        const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(this.stripTags(cellMatch[2]).trim());
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length === 0) return '';

      const colCount = Math.max(...rows.map(r => r.length));

      // Normalize each row to have equal columns
      const normalized = rows.map(r => {
        while (r.length < colCount) r.push('');
        return r;
      });

      // Build markdown table
      const headerRow = `| ${normalized[0].join(' | ')} |`;
      const separator = `| ${normalized[0].map(() => '---').join(' | ')} |`;
      const bodyRows = normalized.slice(1).map(r => `| ${r.join(' | ')} |`);

      return '\n' + [headerRow, separator, ...bodyRows].join('\n') + '\n';
    });
  }

  private extractListItems(html: string): string[] {
    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = liRegex.exec(html)) !== null) {
      items.push(this.stripTags(match[1]).trim());
    }
    return items;
  }

  private stripTags(html: string): string {
    return html.replace(/<\/?[^>]+(>|$)/g, '');
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // ── Markdown to HTML converter ─────────────────────────────────

  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Normalize line endings
    html = html.replace(/\r\n/g, '\n');

    // Code blocks (fenced)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Tables
    html = this.convertMdTables(html);

    // Headings (## heading)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');

    // Blockquotes
    html = html.replace(/^(?:>\s?.+\n?)+/gm, (block) => {
      const inner = block.replace(/^>\s?/gm, '').trim();
      return `<blockquote><p>${inner}</p></blockquote>`;
    });

    // Unordered lists
    html = html.replace(/^(?:[-*+]\s+.+\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const content = line.replace(/^[-*+]\s+/, '');
        return `  <li>${content}</li>`;
      });
      return `<ul>\n${items.join('\n')}\n</ul>`;
    });

    // Ordered lists
    html = html.replace(/^(?:\d+\.\s+.+\n?)+/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const content = line.replace(/^\d+\.\s+/, '');
        return `  <li>${content}</li>`;
      });
      return `<ol>\n${items.join('\n')}\n</ol>`;
    });

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Paragraphs: wrap remaining loose lines
    html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Clean up excessive blank lines
    html = html.replace(/\n{3,}/g, '\n\n');

    return html.trim();
  }

  private convertMdTables(md: string): string {
    // Match markdown tables: header row, separator row, body rows
    const tableRegex = /^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)+)/gm;
    return md.replace(tableRegex, (_m, headerLine, _sep, bodyBlock) => {
      const parseRow = (line: string): string[] =>
        line.split('|').slice(1, -1).map((c: string) => c.trim());

      const headers = parseRow(headerLine);
      const bodyRows = bodyBlock.trim().split('\n').map((line: string) => parseRow(line));

      let table = '<table>\n  <thead>\n    <tr>';
      headers.forEach((h: string) => { table += `<th>${h}</th>`; });
      table += '</tr>\n  </thead>\n  <tbody>\n';
      bodyRows.forEach((row: string[]) => {
        table += '    <tr>';
        row.forEach((cell: string) => { table += `<td>${cell}</td>`; });
        table += '</tr>\n';
      });
      table += '  </tbody>\n</table>';
      return table;
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
