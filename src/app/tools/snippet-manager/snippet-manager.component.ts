import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface Snippet {
  id: string;
  title: string;
  language: string;
  code: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

type ViewMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-snippet-manager',
  templateUrl: './snippet-manager.component.html',
  styleUrls: ['./snippet-manager.component.css'],
  standalone: false
})
export class SnippetManagerComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly STORAGE_KEY = 'snippet-manager-snippets';

  readonly languages = [
    'JavaScript', 'TypeScript', 'Python', 'CSS', 'HTML', 'SQL',
    'Bash', 'Go', 'Rust', 'Java', 'C', 'C++', 'C#', 'PHP',
    'Ruby', 'Swift', 'Kotlin', 'Dart', 'YAML', 'JSON', 'Other'
  ];

  // State
  viewMode: ViewMode = 'list';
  snippets: Snippet[] = [];

  // Search & filter
  searchQuery = '';
  filterLanguage = '';

  // Create/Edit form
  formTitle = '';
  formLanguage = 'JavaScript';
  formCode = '';
  formTags = '';
  editingId: string | null = null;

  // UI feedback
  copied = false;
  importedCount = 0;
  showImportSuccess = false;
  showDeleteConfirm: string | null = null;

  // Highlighted preview
  previewHtml: SafeHtml = '';

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadSnippets();
    }
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Persistence ──────────────────────────────────────────────────

  private loadSnippets(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.snippets = raw ? JSON.parse(raw) : [];
    } catch {
      this.snippets = [];
    }
  }

  private saveSnippets(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.snippets));
  }

  // ── Stats ────────────────────────────────────────────────────────

  get snippetCount(): number {
    return this.snippets.length;
  }

  get storageUsed(): string {
    if (!this.isBrowser) return '0 B';
    const raw = localStorage.getItem(this.STORAGE_KEY) || '';
    const bytes = new TextEncoder().encode(raw).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  get uniqueLanguages(): string[] {
    const langs = new Set(this.snippets.map(s => s.language));
    return Array.from(langs).sort();
  }

  // ── Filtering ────────────────────────────────────────────────────

  get filteredSnippets(): Snippet[] {
    let result = this.snippets;

    if (this.filterLanguage) {
      result = result.filter(s => s.language === this.filterLanguage);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  onSearchInput(): void {
    // debounce for smooth UX
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {}, 150);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterLanguage = '';
  }

  // ── Create / Edit ────────────────────────────────────────────────

  openCreate(): void {
    this.viewMode = 'create';
    this.formTitle = '';
    this.formLanguage = 'JavaScript';
    this.formCode = '';
    this.formTags = '';
    this.editingId = null;
    this.previewHtml = '';
  }

  openEdit(snippet: Snippet): void {
    this.viewMode = 'edit';
    this.formTitle = snippet.title;
    this.formLanguage = snippet.language;
    this.formCode = snippet.code;
    this.formTags = snippet.tags.join(', ');
    this.editingId = snippet.id;
    this.updatePreview();
  }

  cancelForm(): void {
    this.viewMode = 'list';
    this.editingId = null;
  }

  saveSnippet(): void {
    if (!this.formTitle.trim() || !this.formCode.trim()) return;

    const tags = this.formTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const now = Date.now();

    if (this.viewMode === 'edit' && this.editingId) {
      const idx = this.snippets.findIndex(s => s.id === this.editingId);
      if (idx !== -1) {
        this.snippets[idx] = {
          ...this.snippets[idx],
          title: this.formTitle.trim(),
          language: this.formLanguage,
          code: this.formCode,
          tags,
          updatedAt: now
        };
      }
    } else {
      const snippet: Snippet = {
        id: this.generateId(),
        title: this.formTitle.trim(),
        language: this.formLanguage,
        code: this.formCode,
        tags,
        createdAt: now,
        updatedAt: now
      };
      this.snippets.push(snippet);

      // Easter egg: 10th snippet saved
      if (this.snippets.length === 10) {
        this.eggs.trigger('snippet-collector');
      }
    }

    this.saveSnippets();
    this.viewMode = 'list';
    this.editingId = null;
  }

  // ── Delete ───────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.showDeleteConfirm = id;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = null;
  }

  deleteSnippet(id: string): void {
    this.snippets = this.snippets.filter(s => s.id !== id);
    this.saveSnippets();
    this.showDeleteConfirm = null;
  }

  // ── Copy ─────────────────────────────────────────────────────────

  async copySnippet(code: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(code);
    }
  }

  private fallbackCopy(text: string): void {
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

  // ── Export / Import ──────────────────────────────────────────────

  exportAll(): void {
    if (!this.isBrowser || this.snippets.length === 0) return;
    const data = JSON.stringify(this.snippets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport(): void {
    if (!this.isBrowser) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported: Snippet[] = JSON.parse(reader.result as string);
          if (!Array.isArray(imported)) return;

          const existingIds = new Set(this.snippets.map(s => s.id));
          let count = 0;
          for (const item of imported) {
            if (item.id && item.title && item.code && !existingIds.has(item.id)) {
              this.snippets.push({
                id: item.id,
                title: item.title,
                language: item.language || 'Other',
                code: item.code,
                tags: Array.isArray(item.tags) ? item.tags : [],
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || Date.now()
              });
              count++;
            }
          }

          this.saveSnippets();
          this.importedCount = count;
          this.showImportSuccess = true;
          setTimeout(() => (this.showImportSuccess = false), 3000);

          // Check easter egg after import
          if (this.snippets.length >= 10) {
            this.eggs.trigger('snippet-collector');
          }
        } catch { /* invalid JSON — silent */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Syntax Highlighting (basic, no external libs) ────────────────

  highlightCode(code: string, language: string): SafeHtml {
    const html = this.applySyntaxHighlighting(code, language);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  updatePreview(): void {
    if (this.formCode) {
      this.previewHtml = this.highlightCode(this.formCode, this.formLanguage);
    } else {
      this.previewHtml = '';
    }
  }

  private applySyntaxHighlighting(code: string, language: string): string {
    // Escape HTML first
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Store comments and strings to avoid double-matching
    const placeholders: string[] = [];
    const ph = (s: string) => {
      const idx = placeholders.length;
      placeholders.push(s);
      return `\x00PH${idx}\x00`;
    };

    // Comments: // line comments
    escaped = escaped.replace(/(\/\/[^\n]*)/g, (_m, c) =>
      ph(`<span class="sm-comment">${c}</span>`)
    );

    // Comments: # line comments (Python, Bash, YAML)
    if (['Python', 'Bash', 'Ruby', 'YAML'].includes(language)) {
      escaped = escaped.replace(/(#[^\n]*)/g, (_m, c) =>
        ph(`<span class="sm-comment">${c}</span>`)
      );
    }

    // Comments: -- line comments (SQL)
    if (language === 'SQL') {
      escaped = escaped.replace(/(--[^\n]*)/g, (_m, c) =>
        ph(`<span class="sm-comment">${c}</span>`)
      );
    }

    // Block comments /* ... */
    escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, (_m, c) =>
      ph(`<span class="sm-comment">${c}</span>`)
    );

    // Strings: double-quoted
    escaped = escaped.replace(/("(?:\\.|[^"\\])*")/g, (_m, s) =>
      ph(`<span class="sm-string">${s}</span>`)
    );

    // Strings: single-quoted
    escaped = escaped.replace(/('(?:\\.|[^'\\])*')/g, (_m, s) =>
      ph(`<span class="sm-string">${s}</span>`)
    );

    // Strings: backtick template literals
    escaped = escaped.replace(/(`(?:\\.|[^`\\])*`)/g, (_m, s) =>
      ph(`<span class="sm-string">${s}</span>`)
    );

    // Numbers
    escaped = escaped.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
      `<span class="sm-number">$1</span>`
    );

    // Keywords by language family
    const kwSets: Record<string, string[]> = {
      'JavaScript':  ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'throw', 'finally', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'yield', 'delete', 'void'],
      'TypeScript':  ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'import', 'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'throw', 'finally', 'typeof', 'instanceof', 'as', 'is', 'in', 'of', 'null', 'undefined', 'true', 'false', 'keyof', 'readonly', 'public', 'private', 'protected', 'abstract', 'static', 'void', 'never', 'any', 'unknown', 'string', 'number', 'boolean'],
      'Python':      ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'pass', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'self', 'global', 'nonlocal', 'del', 'assert', 'async', 'await'],
      'CSS':         ['@media', '@keyframes', '@import', '@font-face', '@supports', 'important', 'inherit', 'initial', 'unset', 'none', 'auto', 'flex', 'grid', 'block', 'inline', 'relative', 'absolute', 'fixed', 'sticky'],
      'HTML':        ['div', 'span', 'input', 'button', 'form', 'table', 'head', 'body', 'html', 'script', 'style', 'link', 'meta', 'title', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside'],
      'SQL':         ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'IS', 'NULL', 'TRUE', 'FALSE', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'UNION', 'VALUES', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT'],
      'Bash':        ['if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'local', 'readonly', 'declare', 'source', 'alias', 'unset', 'shift', 'true', 'false'],
      'Go':          ['func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'go', 'select', 'chan', 'defer', 'fallthrough', 'goto', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'make', 'new', 'append', 'len', 'cap', 'nil', 'true', 'false', 'error', 'string', 'int', 'float64', 'bool', 'byte', 'rune'],
      'Rust':        ['fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'struct', 'enum', 'impl', 'trait', 'pub', 'mod', 'use', 'crate', 'super', 'self', 'Self', 'type', 'where', 'as', 'in', 'ref', 'move', 'async', 'await', 'unsafe', 'extern', 'const', 'static', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Box', 'Vec', 'String', 'Option', 'Result'],
      'Java':        ['class', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'null', 'true', 'false', 'this', 'super', 'instanceof', 'enum', 'synchronized', 'volatile'],
      'C':           ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'const', 'static', 'extern', 'auto', 'register', 'volatile', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'goto', 'sizeof', 'typedef', 'struct', 'union', 'enum', 'NULL', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma'],
      'C++':         ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'const', 'static', 'extern', 'auto', 'register', 'volatile', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'goto', 'sizeof', 'typedef', 'struct', 'union', 'enum', 'class', 'public', 'private', 'protected', 'virtual', 'override', 'final', 'new', 'delete', 'this', 'namespace', 'using', 'template', 'typename', 'try', 'catch', 'throw', 'nullptr', 'true', 'false', 'bool', 'string', 'include', 'define'],
      'C#':          ['class', 'public', 'private', 'protected', 'internal', 'static', 'abstract', 'sealed', 'virtual', 'override', 'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'using', 'namespace', 'void', 'int', 'long', 'double', 'float', 'bool', 'char', 'string', 'var', 'null', 'true', 'false', 'this', 'base', 'async', 'await', 'interface', 'enum', 'struct', 'delegate', 'event', 'readonly', 'const', 'out', 'ref', 'in', 'is', 'as', 'typeof', 'yield', 'get', 'set', 'value'],
      'PHP':         ['function', 'return', 'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'public', 'private', 'protected', 'static', 'abstract', 'interface', 'extends', 'implements', 'new', 'try', 'catch', 'finally', 'throw', 'use', 'namespace', 'echo', 'print', 'require', 'include', 'null', 'true', 'false', 'array', 'isset', 'unset', 'empty', 'var', 'const', 'global', 'self', 'this', 'match', 'fn', 'yield', 'readonly', 'enum'],
      'Ruby':        ['def', 'end', 'class', 'module', 'return', 'if', 'elsif', 'else', 'unless', 'for', 'while', 'until', 'do', 'case', 'when', 'break', 'next', 'begin', 'rescue', 'ensure', 'raise', 'yield', 'block_given', 'require', 'include', 'extend', 'attr_accessor', 'attr_reader', 'attr_writer', 'nil', 'true', 'false', 'self', 'super', 'puts', 'print', 'lambda', 'proc', 'and', 'or', 'not', 'in'],
      'Swift':       ['func', 'var', 'let', 'return', 'if', 'else', 'for', 'while', 'repeat', 'switch', 'case', 'break', 'continue', 'class', 'struct', 'enum', 'protocol', 'extension', 'import', 'guard', 'defer', 'throw', 'throws', 'try', 'catch', 'do', 'as', 'is', 'in', 'nil', 'true', 'false', 'self', 'Self', 'super', 'init', 'deinit', 'public', 'private', 'internal', 'fileprivate', 'open', 'static', 'override', 'final', 'mutating', 'async', 'await', 'typealias', 'associatedtype', 'where', 'optional', 'weak', 'unowned'],
      'Kotlin':      ['fun', 'val', 'var', 'return', 'if', 'else', 'for', 'while', 'do', 'when', 'break', 'continue', 'class', 'object', 'interface', 'abstract', 'open', 'sealed', 'data', 'enum', 'import', 'package', 'try', 'catch', 'finally', 'throw', 'is', 'as', 'in', 'null', 'true', 'false', 'this', 'super', 'override', 'companion', 'init', 'suspend', 'inline', 'crossinline', 'noinline', 'reified', 'typealias', 'lateinit', 'by', 'lazy', 'internal', 'private', 'protected', 'public'],
      'Dart':        ['void', 'var', 'final', 'const', 'late', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'abstract', 'extends', 'implements', 'mixin', 'with', 'import', 'export', 'part', 'library', 'try', 'catch', 'finally', 'throw', 'rethrow', 'is', 'as', 'in', 'null', 'true', 'false', 'this', 'super', 'new', 'async', 'await', 'yield', 'static', 'dynamic', 'typedef', 'enum', 'factory', 'get', 'set', 'operator', 'covariant', 'required', 'int', 'double', 'String', 'bool', 'List', 'Map', 'Set', 'Future', 'Stream'],
    };

    const keywords = kwSets[language] || kwSets['JavaScript'] || [];

    if (keywords.length > 0) {
      const isCaseInsensitive = language === 'SQL';
      const escapedKw = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const flags = isCaseInsensitive ? 'gi' : 'g';
      const kwRegex = new RegExp(`\\b(${escapedKw.join('|')})\\b`, flags);
      escaped = escaped.replace(kwRegex, `<span class="sm-keyword">$1</span>`);
    }

    // Restore placeholders
    escaped = escaped.replace(/\x00PH(\d+)\x00/g, (_m, idx) => placeholders[parseInt(idx, 10)]);

    return escaped;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private generateId(): string {
    return `snp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  truncateCode(code: string, maxLines: number = 6): string {
    const lines = code.split('\n');
    if (lines.length <= maxLines) return code;
    return lines.slice(0, maxLines).join('\n') + '\n...';
  }

  getLanguageColor(lang: string): string {
    const colors: Record<string, string> = {
      'JavaScript': '#f7df1e',
      'TypeScript': '#3178c6',
      'Python': '#3572a5',
      'CSS': '#563d7c',
      'HTML': '#e34c26',
      'SQL': '#e38c00',
      'Bash': '#4eaa25',
      'Go': '#00add8',
      'Rust': '#dea584',
      'Java': '#b07219',
      'C': '#555555',
      'C++': '#f34b7d',
      'C#': '#178600',
      'PHP': '#4f5d95',
      'Ruby': '#701516',
      'Swift': '#f05138',
      'Kotlin': '#a97bff',
      'Dart': '#00b4ab',
      'YAML': '#cb171e',
      'JSON': '#292929',
      'Other': '#888888'
    };
    return colors[lang] || '#888888';
  }
}
