import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-markdown-editor',
    templateUrl: './markdown-editor.component.html',
    styleUrls: ['./markdown-editor.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class MarkdownEditorComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Markdown Preview & Editor — write markdown with live HTML preview, no sign-up required')}&url=${encodeURIComponent(SITE_URL + '/tools/markdown-editor')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/markdown-editor')}`;

  // Input
  markdownInput = '';

  // Output
  renderedHtml: SafeHtml = '';
  rawHtml = '';

  // Stats
  wordCount = 0;
  charCount = 0;

  // UI state
  copied = false;
  downloaded = false;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live preview (debounced 200ms) ──────────────────────────────────────

  onInput() {
    this.charCount = this.markdownInput.length;
    this.wordCount = this.markdownInput.trim()
      ? this.markdownInput.trim().split(/\s+/).length
      : 0;

    if (!this.markdownInput.trim()) {
      this.renderedHtml = '';
      this.rawHtml = '';
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.renderPreview(), 200);
  }

  private renderPreview() {
    this.rawHtml = this.parseMarkdown(this.markdownInput);
    this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml(this.rawHtml);

    // Easter egg: first line is "# Hello World"
    const firstLine = this.markdownInput.split('\n')[0].trim();
    if (firstLine === '# Hello World') {
      this.eggs.trigger('md-hello-world');
    }
  }

  // ── Toolbar formatting ─────────────────────────────────────────────────

  insertFormat(type: string) {
    const textarea = document.querySelector('.mde-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = this.markdownInput.substring(start, end);
    let before = '';
    let after = '';
    let insertion = '';

    switch (type) {
      case 'bold':
        before = '**';
        after = '**';
        insertion = selected || 'bold text';
        break;
      case 'italic':
        before = '_';
        after = '_';
        insertion = selected || 'italic text';
        break;
      case 'strikethrough':
        before = '~~';
        after = '~~';
        insertion = selected || 'strikethrough text';
        break;
      case 'heading':
        before = '## ';
        after = '';
        insertion = selected || 'Heading';
        break;
      case 'code':
        if (selected.includes('\n')) {
          before = '```\n';
          after = '\n```';
          insertion = selected;
        } else {
          before = '`';
          after = '`';
          insertion = selected || 'code';
        }
        break;
      case 'link':
        before = '[';
        after = '](https://example.com)';
        insertion = selected || 'link text';
        break;
      case 'image':
        before = '![';
        after = '](https://example.com/image.png)';
        insertion = selected || 'alt text';
        break;
      case 'ulist':
        before = '- ';
        after = '';
        insertion = selected || 'List item';
        break;
      case 'olist':
        before = '1. ';
        after = '';
        insertion = selected || 'List item';
        break;
      case 'tasklist':
        before = '- [ ] ';
        after = '';
        insertion = selected || 'Task item';
        break;
      case 'quote':
        before = '> ';
        after = '';
        insertion = selected || 'Blockquote';
        break;
      case 'hr':
        before = '\n---\n';
        after = '';
        insertion = '';
        break;
      case 'table':
        before = '';
        after = '';
        insertion = '| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |';
        break;
    }

    const newText =
      this.markdownInput.substring(0, start) +
      before + insertion + after +
      this.markdownInput.substring(end);

    this.markdownInput = newText;
    this.onInput();

    // Restore cursor position
    setTimeout(() => {
      const cursorPos = start + before.length + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + insertion.length
      );
    });
  }

  // ── Sample markdown ───────────────────────────────────────────────────

  loadSample() {
    this.markdownInput = `# Hello World

Welcome to the **Markdown Preview & Editor** tool.

## Features

- **Bold**, _italic_, and ~~strikethrough~~ text
- [Links](https://xsantcastx.com) and images
- Code blocks with syntax highlighting
- Tables, task lists, and more

### Code Block

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet('World'));
\`\`\`

### Task List

- [x] Write markdown parser
- [x] Add live preview
- [ ] Take over the world

### Table

| Feature       | Status    | Priority |
| ------------- | --------- | -------- |
| Bold/Italic   | Done      | High     |
| Code Blocks   | Done      | High     |
| Tables        | Done      | Medium   |
| Task Lists    | Done      | Medium   |

### Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

---

Inline \`code\` looks like this. **Enjoy writing markdown!**`;
    this.onInput();
  }

  clearAll() {
    this.markdownInput = '';
    this.renderedHtml = '';
    this.rawHtml = '';
    this.wordCount = 0;
    this.charCount = 0;
  }

  // ── Clipboard & Download ───────────────────────────────────────────────

  async copyHtml() {
    if (!this.rawHtml || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.rawHtml);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.rawHtml);
    }
  }

  downloadMarkdown() {
    if (!this.markdownInput || !this.isBrowser) return;
    const blob = new Blob([this.markdownInput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
    this.downloaded = true;
    setTimeout(() => (this.downloaded = false), 2000);
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

  // ── URL sanitizer (blocks javascript:, data:, vbscript: protocols) ────
  private sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    // Allow only safe schemes — block javascript:, data:, vbscript: etc.
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) {
      return trimmed;
    }
    // Relative URLs (no scheme) are safe
    if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/i.test(trimmed)) {
      return trimmed;
    }
    // Dangerous scheme detected — neutralize
    return '#';
  }

  // ── Markdown-to-HTML parser (GFM subset, no external libs) ────────────

  private parseMarkdown(md: string): string {
    let html = md;

    // Normalize line endings
    html = html.replace(/\r\n/g, '\n');

    // Escape HTML entities in source
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;');
    html = html.replace(/>/g, '&gt;');

    // Fenced code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre class="mde-code-block"><code${cls}>${code.trimEnd()}</code></pre>`;
    });

    // Tables
    html = this.parseTables(html);

    // Blockquotes (multi-line)
    html = this.parseBlockquotes(html);

    // Headings (# to ######)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');

    // Task lists (must come before unordered lists)
    html = this.parseTaskLists(html);

    // Unordered lists
    html = this.parseLists(html, /^[-*+]\s+(.+)$/gm, 'ul');

    // Ordered lists
    html = this.parseLists(html, /^\d+\.\s+(.+)$/gm, 'ol');

    // Images (before links to avoid conflict) — sanitize src to block javascript:/data: XSS
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match: string, alt: string, src: string) =>
      `<img src="${this.sanitizeUrl(src)}" alt="${alt}" class="mde-img">`
    );

    // Links — sanitize href to block javascript:/data:/vbscript: XSS
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: string, text: string, href: string) =>
      `<a href="${this.sanitizeUrl(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="mde-inline-code">$1</code>');

    // Bold + italic combined
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Paragraphs: wrap orphan lines not already in a block element
    html = this.wrapParagraphs(html);

    return html;
  }

  private parseTables(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      // Detect table: line with |, followed by separator line with |---
      if (
        i + 1 < lines.length &&
        lines[i].includes('|') &&
        /^\|?\s*[-:]+[-| :]*$/.test(lines[i + 1].trim())
      ) {
        const headerCells = this.parseTableRow(lines[i]);
        const alignLine = lines[i + 1];
        const aligns = this.parseTableAlignments(alignLine);

        let tableHtml = '<table class="mde-table"><thead><tr>';
        headerCells.forEach((cell, idx) => {
          const align = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '';
          tableHtml += `<th${align}>${cell.trim()}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        i += 2; // skip header + separator

        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          const cells = this.parseTableRow(lines[i]);
          tableHtml += '<tr>';
          cells.forEach((cell, idx) => {
            const align = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '';
            tableHtml += `<td${align}>${cell.trim()}</td>`;
          });
          tableHtml += '</tr>';
          i++;
        }

        tableHtml += '</tbody></table>';
        result.push(tableHtml);
      } else {
        result.push(lines[i]);
        i++;
      }
    }

    return result.join('\n');
  }

  private parseTableRow(line: string): string[] {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
    return trimmed.split('|');
  }

  private parseTableAlignments(line: string): (string | null)[] {
    return this.parseTableRow(line).map(cell => {
      const c = cell.trim();
      if (c.startsWith(':') && c.endsWith(':')) return 'center';
      if (c.endsWith(':')) return 'right';
      if (c.startsWith(':')) return 'left';
      return null;
    });
  }

  private parseBlockquotes(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inQuote = false;
    let quoteLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/^&gt;\s?(.*)$/);
      if (match) {
        if (!inQuote) inQuote = true;
        quoteLines.push(match[1]);
      } else {
        if (inQuote) {
          result.push(`<blockquote class="mde-blockquote">${quoteLines.join('<br>')}</blockquote>`);
          quoteLines = [];
          inQuote = false;
        }
        result.push(line);
      }
    }

    if (inQuote) {
      result.push(`<blockquote class="mde-blockquote">${quoteLines.join('<br>')}</blockquote>`);
    }

    return result.join('\n');
  }

  private parseTaskLists(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;

    for (const line of lines) {
      const matchChecked = line.match(/^[-*+]\s+\[x\]\s+(.+)$/i);
      const matchUnchecked = line.match(/^[-*+]\s+\[\s?\]\s+(.+)$/);

      if (matchChecked) {
        if (!inList) { result.push('<ul class="mde-task-list">'); inList = true; }
        result.push(`<li class="mde-task-item mde-task-done"><input type="checkbox" checked disabled> ${matchChecked[1]}</li>`);
      } else if (matchUnchecked) {
        if (!inList) { result.push('<ul class="mde-task-list">'); inList = true; }
        result.push(`<li class="mde-task-item"><input type="checkbox" disabled> ${matchUnchecked[1]}</li>`);
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        result.push(line);
      }
    }

    if (inList) result.push('</ul>');

    return result.join('\n');
  }

  private parseLists(html: string, pattern: RegExp, tag: 'ul' | 'ol'): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;

    for (const line of lines) {
      const match = tag === 'ul'
        ? line.match(/^[-*+]\s+(.+)$/)
        : line.match(/^\d+\.\s+(.+)$/);

      if (match) {
        if (!inList) { result.push(`<${tag}>`); inList = true; }
        result.push(`<li>${match[1]}</li>`);
      } else {
        if (inList) { result.push(`</${tag}>`); inList = false; }
        result.push(line);
      }
    }

    if (inList) result.push(`</${tag}>`);

    return result.join('\n');
  }

  private wrapParagraphs(html: string): string {
    const blockTags = /^<(h[1-6]|p|ul|ol|li|pre|blockquote|table|thead|tbody|tr|th|td|hr|div|img)/;

    return html
      .split('\n\n')
      .map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (blockTags.test(trimmed)) return trimmed;
        // Don't wrap lines that are already block-level
        const lines = trimmed.split('\n');
        const allBlock = lines.every(l => !l.trim() || blockTags.test(l.trim()));
        if (allBlock) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');
  }
}
