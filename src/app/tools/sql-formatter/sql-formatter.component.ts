import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type IndentOption = '2' | '4' | 'tab';
type SqlDialect = 'postgresql' | 'mysql' | 'sqlite';

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
  'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'ASC', 'DESC',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE', 'CHECK', 'DEFAULT',
  'IF', 'ELSE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'CASCADE', 'RESTRICT', 'TRUNCATE', 'REPLACE', 'RETURNING',
  'WITH', 'RECURSIVE', 'TEMPORARY', 'TEMP', 'EXPLAIN', 'ANALYZE',
  'GRANT', 'REVOKE', 'TRIGGER', 'PROCEDURE', 'FUNCTION',
  'TRUE', 'FALSE', 'INT', 'INTEGER', 'VARCHAR', 'TEXT', 'BOOLEAN', 'FLOAT', 'DOUBLE',
  'DATE', 'TIMESTAMP', 'SERIAL', 'BIGINT', 'SMALLINT', 'NUMERIC', 'DECIMAL', 'CHAR',
  'ADD', 'COLUMN', 'RENAME', 'TO', 'MODIFY', 'TYPE', 'USING',
  'TOP', 'PERCENT', 'FIRST', 'LAST',
];

/** Major clauses that get their own line */
const MAJOR_CLAUSES = [
  'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING',
  'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
  'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
  'CREATE DATABASE', 'DROP DATABASE',
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'WITH', 'RETURNING', 'FETCH',
  'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'FULL OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN',
  'CROSS JOIN', 'JOIN', 'ON',
];

/** Clauses that increase indent (joins, subquery helpers) */
const INDENT_CLAUSES = [
  'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'FULL OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN',
  'CROSS JOIN', 'JOIN', 'ON',
];

const SAMPLE_SQL = `-- Fetch active users with their recent orders
SELECT
  u.id,
  u.username,
  u.email,
  COUNT(o.id) AS total_orders,
  SUM(o.amount) AS total_spent,
  MAX(o.created_at) AS last_order_date
FROM users u
INNER JOIN orders o ON o.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.is_active = TRUE
  AND o.created_at >= '2025-01-01'
  AND o.status IN ('completed', 'shipped')
GROUP BY u.id, u.username, u.email
HAVING COUNT(o.id) > 3
ORDER BY total_spent DESC
LIMIT 50 OFFSET 0;

-- Insert a new product
INSERT INTO products (name, price, category_id, created_at)
VALUES ('Cyberpunk Widget', 49.99, 7, NOW());

-- Update pricing for a category
UPDATE products
SET price = price * 1.10,
    updated_at = NOW()
WHERE category_id = (
  SELECT id FROM categories WHERE slug = 'electronics'
);

-- Create an index for performance
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);`;

@Component({
    selector: 'app-sql-formatter',
    templateUrl: './sql-formatter.component.html',
    styleUrls: ['./sql-formatter.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class SqlFormatterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free SQL Formatter & Beautifier — format, minify and syntax-highlight SQL instantly. No sign-up needed!')}&url=${encodeURIComponent(SITE_URL + '/tools/sql-formatter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/sql-formatter')}`;

  // Input
  sqlInput = '';

  // Options
  indentSize: IndentOption = '2';
  dialect: SqlDialect = 'postgresql';

  // Output state
  formattedOutput = '';
  highlightedHtml: SafeHtml = '';
  copied = false;

  // Stats
  lineCount = 0;
  charCount = 0;
  inputBytes = 0;
  outputBytes = 0;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live formatting (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.charCount = this.sqlInput.length;
    this.inputBytes = new TextEncoder().encode(this.sqlInput).length;

    if (!this.sqlInput.trim()) {
      this.formattedOutput = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.liveFormat(), 300);
  }

  private liveFormat() {
    const formatted = this.formatSql(this.sqlInput);
    this.formattedOutput = formatted;
    this.lineCount = formatted.split('\n').length;
    this.outputBytes = new TextEncoder().encode(formatted).length;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightSql(formatted));
    this.checkEasterEggs();
  }

  // ── Core actions ───────────────────────────────────────────────────────────

  format() {
    if (!this.sqlInput.trim()) return;
    const formatted = this.formatSql(this.sqlInput);
    this.formattedOutput = formatted;
    this.lineCount = formatted.split('\n').length;
    this.charCount = this.sqlInput.length;
    this.inputBytes = new TextEncoder().encode(this.sqlInput).length;
    this.outputBytes = new TextEncoder().encode(formatted).length;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightSql(formatted));
    this.checkEasterEggs();
  }

  minify() {
    if (!this.sqlInput.trim()) return;
    const minified = this.minifySql(this.sqlInput);
    this.formattedOutput = minified;
    this.lineCount = 1;
    this.charCount = this.sqlInput.length;
    this.inputBytes = new TextEncoder().encode(this.sqlInput).length;
    this.outputBytes = new TextEncoder().encode(minified).length;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightSql(minified));
  }

  loadSample() {
    this.sqlInput = SAMPLE_SQL;
    this.onInput();
  }

  clearAll() {
    this.sqlInput = '';
    this.formattedOutput = '';
    this.highlightedHtml = '';
    this.lineCount = 0;
    this.charCount = 0;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }

  onIndentChange() {
    if (this.formattedOutput) {
      this.format();
    }
  }

  onDialectChange() {
    if (this.formattedOutput) {
      this.format();
    }
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────

  async copyOutput() {
    if (!this.formattedOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.formattedOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.formattedOutput);
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

  // ── Easter eggs ────────────────────────────────────────────────────────────

  private checkEasterEggs() {
    if (/DROP\s+TABLE/i.test(this.sqlInput)) {
      this.eggs.trigger('sql-drop');
    }
  }

  // ── SQL Formatter (no external libs) ───────────────────────────────────────

  private formatSql(input: string): string {
    const indent = this.resolveIndent();
    const lines: string[] = [];

    // Tokenize: preserve strings, comments, and split on boundaries
    const tokens = this.tokenize(input);

    let depth = 0;
    let currentLine = '';

    const pushLine = () => {
      if (currentLine.trim()) {
        lines.push(indent.repeat(depth) + currentLine.trim());
      }
      currentLine = '';
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const upper = token.toUpperCase().trim();

      // Handle comments — keep them on their own line
      if (token.trim().startsWith('--') || token.trim().startsWith('/*')) {
        pushLine();
        lines.push(indent.repeat(depth) + token.trim());
        continue;
      }

      // Handle opening paren — increase depth
      if (token.trim() === '(') {
        currentLine += ' (';
        pushLine();
        depth++;
        continue;
      }

      // Handle closing paren — decrease depth
      if (token.trim() === ')') {
        pushLine();
        depth = Math.max(0, depth - 1);
        currentLine = ')';
        // Check if next token continues on same line (e.g. alias)
        const nextToken = i + 1 < tokens.length ? tokens[i + 1].trim().toUpperCase() : '';
        if (nextToken && !this.isMajorClause(nextToken, tokens, i + 1)) {
          continue; // let next token append to this line
        }
        pushLine();
        continue;
      }

      // Handle semicolons — end statement
      if (token.trim() === ';') {
        currentLine += ';';
        pushLine();
        lines.push(''); // blank line between statements
        continue;
      }

      // Handle commas — keep on same line, then newline
      if (token.trim() === ',') {
        currentLine += ',';
        pushLine();
        continue;
      }

      // Check for multi-word major clauses
      const multiWordClause = this.checkMultiWordClause(tokens, i);
      if (multiWordClause) {
        pushLine();
        const isIndentClause = INDENT_CLAUSES.includes(multiWordClause);
        const clauseFormatted = this.capitalizeKeyword(multiWordClause);
        if (isIndentClause) {
          currentLine = clauseFormatted;
        } else {
          currentLine = clauseFormatted;
        }
        // Skip consumed tokens
        const wordCount = multiWordClause.split(/\s+/).length;
        i += wordCount - 1;
        continue;
      }

      // Check for single-word major clauses
      if (this.isSingleMajorClause(upper)) {
        pushLine();
        currentLine = this.capitalizeKeyword(upper);
        continue;
      }

      // Regular token — capitalize if keyword
      const formatted = this.isKeyword(upper)
        ? this.capitalizeKeyword(upper)
        : token.trim();

      if (currentLine) {
        currentLine += ' ' + formatted;
      } else {
        currentLine = formatted;
      }
    }

    pushLine();

    // Clean up trailing blank lines
    let result = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    const len = input.length;

    while (i < len) {
      // Skip whitespace
      if (/\s/.test(input[i])) {
        i++;
        continue;
      }

      // Single-line comment
      if (input[i] === '-' && input[i + 1] === '-') {
        let end = input.indexOf('\n', i);
        if (end === -1) end = len;
        tokens.push(input.substring(i, end));
        i = end;
        continue;
      }

      // Block comment
      if (input[i] === '/' && input[i + 1] === '*') {
        let end = input.indexOf('*/', i + 2);
        if (end === -1) end = len - 2;
        tokens.push(input.substring(i, end + 2));
        i = end + 2;
        continue;
      }

      // Single-quoted string
      if (input[i] === "'") {
        let j = i + 1;
        while (j < len) {
          if (input[j] === "'" && input[j + 1] === "'") {
            j += 2; // escaped quote
          } else if (input[j] === "'") {
            break;
          } else {
            j++;
          }
        }
        tokens.push(input.substring(i, j + 1));
        i = j + 1;
        continue;
      }

      // Double-quoted identifier
      if (input[i] === '"') {
        let j = i + 1;
        while (j < len && input[j] !== '"') j++;
        tokens.push(input.substring(i, j + 1));
        i = j + 1;
        continue;
      }

      // Backtick-quoted identifier (MySQL)
      if (input[i] === '`') {
        let j = i + 1;
        while (j < len && input[j] !== '`') j++;
        tokens.push(input.substring(i, j + 1));
        i = j + 1;
        continue;
      }

      // Special single characters
      if ('(),;'.includes(input[i])) {
        tokens.push(input[i]);
        i++;
        continue;
      }

      // Operators (>=, <=, <>, !=, ::)
      if (i + 1 < len) {
        const twoChar = input[i] + input[i + 1];
        if (['>=', '<=', '<>', '!=', '::'].includes(twoChar)) {
          tokens.push(twoChar);
          i += 2;
          continue;
        }
      }

      // Single-char operators
      if ('=<>+-*/%'.includes(input[i])) {
        tokens.push(input[i]);
        i++;
        continue;
      }

      // Word or number
      let j = i;
      while (j < len && !/[\s(),;=<>+\-*/%'"`;]/.test(input[j])) {
        // Allow :: operator to break words
        if (input[j] === ':' && input[j + 1] === ':') break;
        j++;
      }
      if (j > i) {
        tokens.push(input.substring(i, j));
        i = j;
      } else {
        tokens.push(input[i]);
        i++;
      }
    }

    return tokens;
  }

  private checkMultiWordClause(tokens: string[], startIdx: number): string | null {
    // Try matching longest multi-word clauses first
    const sortedClauses = MAJOR_CLAUSES
      .filter(c => c.includes(' '))
      .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

    for (const clause of sortedClauses) {
      const words = clause.split(/\s+/);
      if (startIdx + words.length > tokens.length) continue;

      let match = true;
      for (let w = 0; w < words.length; w++) {
        const tok = tokens[startIdx + w].trim().toUpperCase();
        if (tok !== words[w]) {
          match = false;
          break;
        }
      }
      if (match) return clause;
    }
    return null;
  }

  private isSingleMajorClause(upper: string): boolean {
    const singleClauses = MAJOR_CLAUSES.filter(c => !c.includes(' '));
    return singleClauses.includes(upper);
  }

  private isMajorClause(upper: string, tokens: string[], idx: number): boolean {
    if (this.checkMultiWordClause(tokens, idx)) return true;
    return this.isSingleMajorClause(upper);
  }

  private isKeyword(upper: string): boolean {
    return SQL_KEYWORDS.includes(upper);
  }

  private capitalizeKeyword(word: string): string {
    // All dialects use uppercase for keywords in this formatter
    return word.toUpperCase();
  }

  private resolveIndent(): string {
    if (this.indentSize === 'tab') return '\t';
    return ' '.repeat(parseInt(this.indentSize, 10));
  }

  // ── Minify ─────────────────────────────────────────────────────────────────

  private minifySql(input: string): string {
    const tokens = this.tokenize(input);
    const parts: string[] = [];

    for (const token of tokens) {
      const trimmed = token.trim();
      // Skip comments
      if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;

      if (this.isKeyword(trimmed.toUpperCase())) {
        parts.push(this.capitalizeKeyword(trimmed.toUpperCase()));
      } else {
        parts.push(trimmed);
      }
    }

    // Join with spaces but handle special chars that shouldn't have extra spaces
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const prev = i > 0 ? parts[i - 1] : '';

      if (part === ',' || part === ';' || part === ')') {
        result += part;
      } else if (prev === '(' || part === '(') {
        result += part;
      } else if (result.length > 0) {
        result += ' ' + part;
      } else {
        result = part;
      }
    }

    return result;
  }

  // ── Syntax highlighting ────────────────────────────────────────────────────

  private highlightSql(sql: string): string {
    const escaped = sql
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Process line by line to handle line comments
    const lines = escaped.split('\n');
    const highlighted = lines.map(line => {
      // Full-line comment
      if (line.trim().startsWith('--')) {
        return `<span class="sf-comment">${line}</span>`;
      }

      // Tokenized highlighting within a line
      return line.replace(
        /(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|("(?:[^"\\]|\\.)*")|(`[^`]*`)|(\b\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?\b)|(\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DATABASE|SCHEMA|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|FETCH|NEXT|ROWS|ONLY|AS|DISTINCT|ALL|UNION|INTERSECT|EXCEPT|CASE|WHEN|THEN|ELSE|END|IS|NULL|LIKE|ILIKE|BETWEEN|ASC|DESC|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|UNIQUE|CHECK|DEFAULT|IF|BEGIN|COMMIT|ROLLBACK|TRANSACTION|COUNT|SUM|AVG|MIN|MAX|CASCADE|RESTRICT|TRUNCATE|REPLACE|RETURNING|WITH|RECURSIVE|TEMPORARY|TEMP|EXPLAIN|ANALYZE|GRANT|REVOKE|TRIGGER|PROCEDURE|FUNCTION|TRUE|FALSE|INT|INTEGER|VARCHAR|TEXT|BOOLEAN|FLOAT|DOUBLE|DATE|TIMESTAMP|SERIAL|BIGINT|SMALLINT|NUMERIC|DECIMAL|CHAR|ADD|COLUMN|RENAME|TO|MODIFY|TYPE|USING|TOP|PERCENT|FIRST|LAST|NOW)\b)/gi,
        (match, blockComment, singleStr, doubleStr, backtickStr, num, keyword) => {
          if (blockComment) return `<span class="sf-comment">${blockComment}</span>`;
          if (singleStr) return `<span class="sf-string">${singleStr}</span>`;
          if (doubleStr) return `<span class="sf-string">${doubleStr}</span>`;
          if (backtickStr) return `<span class="sf-string">${backtickStr}</span>`;
          if (num) return `<span class="sf-number">${num}</span>`;
          if (keyword) return `<span class="sf-keyword">${keyword}</span>`;
          return match;
        }
      );
    });

    return highlighted.join('\n');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  get savingsPercent(): number {
    if (!this.inputBytes || !this.outputBytes) return 0;
    return Math.round(((this.inputBytes - this.outputBytes) / this.inputBytes) * 100);
  }
}
