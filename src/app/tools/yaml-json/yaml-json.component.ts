import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type Direction = 'yaml-to-json' | 'json-to-yaml';

@Component({
  selector: 'app-yaml-json',
  templateUrl: './yaml-json.component.html',
  styleUrls: ['./yaml-json.component.css'],
  standalone: false
})
export class YamlJsonComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free YAML to JSON Converter — convert between YAML and JSON instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/yaml-json')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/yaml-json')}`;

  // State
  input = '';
  output = '';
  highlightedHtml: SafeHtml = '';
  direction: Direction = 'yaml-to-json';
  errorMessage = '';
  copied = false;

  // Stats
  inputBytes = 0;
  outputBytes = 0;
  lineCount = 0;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Direction toggle ──────────────────────────────────────────────────────

  toggleDirection() {
    this.direction = this.direction === 'yaml-to-json' ? 'json-to-yaml' : 'yaml-to-json';
    this.clearAll();
  }

  // ── Live conversion (debounced 300ms) ─────────────────────────────────────

  onInput() {
    this.inputBytes = new TextEncoder().encode(this.input).length;

    if (!this.input.trim()) {
      this.output = '';
      this.highlightedHtml = '';
      this.errorMessage = '';
      this.lineCount = 0;
      this.outputBytes = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 300);
  }

  convert() {
    if (!this.input.trim()) return;

    try {
      if (this.direction === 'yaml-to-json') {
        const parsed = this.parseYaml(this.input);
        this.checkEasterEgg(parsed);
        const json = JSON.stringify(parsed, null, 2);
        this.output = json;
        this.lineCount = json.split('\n').length;
        this.outputBytes = new TextEncoder().encode(json).length;
        this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightJson(json));
      } else {
        const parsed = JSON.parse(this.input);
        this.checkEasterEgg(parsed);
        const yaml = this.toYaml(parsed, 0);
        this.output = yaml;
        this.lineCount = yaml.split('\n').length;
        this.outputBytes = new TextEncoder().encode(yaml).length;
        this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightYaml(yaml));
      }
      this.errorMessage = '';
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Conversion failed';
      this.output = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      this.outputBytes = 0;
    }
  }

  // ── Easter egg check ──────────────────────────────────────────────────────

  private checkEasterEgg(obj: unknown): void {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if ('easter_egg' in (obj as Record<string, unknown>)) {
        this.eggs.trigger('yaml-hidden');
      }
      // Check nested objects
      for (const val of Object.values(obj as Record<string, unknown>)) {
        this.checkEasterEgg(val);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this.checkEasterEgg(item);
      }
    }
  }

  // ── Sample data ───────────────────────────────────────────────────────────

  loadSampleYaml() {
    this.direction = 'yaml-to-json';
    this.input = `# YAML to JSON Converter
app:
  name: YAML-JSON Converter
  version: "1.0.0"
  description: A free online tool to convert between YAML and JSON

author:
  name: xsantcastx
  url: https://xsantcastx.com

features:
  - YAML to JSON conversion
  - JSON to YAML conversion
  - Syntax highlighting
  - Live preview

settings:
  indent: 2
  liveConversion: true
  maxDepth: 10

stats:
  users: 0
  rating: 5.0
  free: true

tags:
  - yaml
  - json
  - converter
  - developer-tools`;
    this.onInput();
  }

  loadSampleJson() {
    this.direction = 'json-to-yaml';
    this.input = JSON.stringify({
      app: {
        name: 'YAML-JSON Converter',
        version: '1.0.0',
        description: 'A free online tool to convert between YAML and JSON'
      },
      author: {
        name: 'xsantcastx',
        url: 'https://xsantcastx.com'
      },
      features: [
        'YAML to JSON conversion',
        'JSON to YAML conversion',
        'Syntax highlighting',
        'Live preview'
      ],
      settings: {
        indent: 2,
        liveConversion: true,
        maxDepth: 10
      },
      stats: {
        users: 0,
        rating: 5.0,
        free: true
      }
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.input = '';
    this.output = '';
    this.highlightedHtml = '';
    this.errorMessage = '';
    this.lineCount = 0;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }

  // ── Clipboard ─────────────────────────────────────────────────────────────

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

  // ── YAML Parser (no external libs) ────────────────────────────────────────

  private parseYaml(input: string): unknown {
    const lines = input.split('\n');
    const result = this.parseYamlLines(lines, 0, 0);
    return result.value;
  }

  private parseYamlLines(
    lines: string[],
    startIdx: number,
    baseIndent: number
  ): { value: unknown; nextIdx: number } {
    // Determine if this block is an array or object
    const firstContentLine = this.findNextContentLine(lines, startIdx, baseIndent);
    if (firstContentLine === -1) {
      return { value: null, nextIdx: lines.length };
    }

    const firstLine = lines[firstContentLine];
    const trimmed = firstLine.trimStart();

    if (trimmed.startsWith('- ') || trimmed === '-') {
      return this.parseYamlArray(lines, firstContentLine, baseIndent);
    } else {
      return this.parseYamlObject(lines, firstContentLine, baseIndent);
    }
  }

  private parseYamlObject(
    lines: string[],
    startIdx: number,
    baseIndent: number
  ): { value: Record<string, unknown>; nextIdx: number } {
    const obj: Record<string, unknown> = {};
    let i = startIdx;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines and comments
      if (this.isEmptyOrComment(line)) {
        i++;
        continue;
      }

      const indent = this.getIndent(line);
      if (indent < baseIndent) break;
      if (indent > baseIndent) break; // unexpected deeper indent

      const trimmed = line.trimStart();
      const colonIdx = this.findKeyColonIndex(trimmed);

      if (colonIdx === -1) {
        i++;
        continue;
      }

      let key = trimmed.substring(0, colonIdx).trim();
      // Remove surrounding quotes from key
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }

      const afterColon = trimmed.substring(colonIdx + 1).trim();

      if (afterColon === '' || afterColon.startsWith('#')) {
        // Value is a nested block (object or array)
        // Find the indent of the next content line
        const nextContent = this.findNextContentLine(lines, i + 1, -1);
        if (nextContent === -1 || this.getIndent(lines[nextContent]) <= baseIndent) {
          obj[key] = null;
          i++;
        } else {
          const childIndent = this.getIndent(lines[nextContent]);
          const child = this.parseYamlLines(lines, i + 1, childIndent);
          obj[key] = child.value;
          i = child.nextIdx;
        }
      } else if (afterColon === '|' || afterColon === '|+' || afterColon === '|-') {
        // Literal block scalar (multiline string)
        const result = this.parseBlockScalar(lines, i + 1, indent, 'literal', afterColon);
        obj[key] = result.value;
        i = result.nextIdx;
      } else if (afterColon === '>' || afterColon === '>+' || afterColon === '>-') {
        // Folded block scalar (multiline string)
        const result = this.parseBlockScalar(lines, i + 1, indent, 'folded', afterColon);
        obj[key] = result.value;
        i = result.nextIdx;
      } else {
        // Inline value
        obj[key] = this.parseYamlValue(afterColon);
        i++;
      }
    }

    return { value: obj, nextIdx: i };
  }

  private parseYamlArray(
    lines: string[],
    startIdx: number,
    baseIndent: number
  ): { value: unknown[]; nextIdx: number } {
    const arr: unknown[] = [];
    let i = startIdx;

    while (i < lines.length) {
      const line = lines[i];

      if (this.isEmptyOrComment(line)) {
        i++;
        continue;
      }

      const indent = this.getIndent(line);
      if (indent < baseIndent) break;
      if (indent > baseIndent) break;

      const trimmed = line.trimStart();

      if (!trimmed.startsWith('-')) break;

      // Remove the leading "- "
      const afterDash = trimmed.length > 1 ? trimmed.substring(1).trim() : '';

      if (afterDash === '' || afterDash.startsWith('#')) {
        // Nested block under array item
        const nextContent = this.findNextContentLine(lines, i + 1, -1);
        if (nextContent === -1 || this.getIndent(lines[nextContent]) <= baseIndent) {
          arr.push(null);
          i++;
        } else {
          const childIndent = this.getIndent(lines[nextContent]);
          const child = this.parseYamlLines(lines, i + 1, childIndent);
          arr.push(child.value);
          i = child.nextIdx;
        }
      } else if (this.findKeyColonIndex(afterDash) !== -1) {
        // Inline object start in array: - key: value
        // Parse as an object starting at this indent + 2
        const itemIndent = indent + 2;
        // Re-construct the line without the dash for parsing
        const reconstructed = ' '.repeat(itemIndent) + afterDash;
        const tempLines = [...lines];
        tempLines[i] = reconstructed;
        const child = this.parseYamlObject(tempLines, i, itemIndent);
        arr.push(child.value);
        i = child.nextIdx;
      } else {
        // Simple inline value
        arr.push(this.parseYamlValue(afterDash));
        i++;
      }
    }

    return { value: arr, nextIdx: i };
  }

  private parseBlockScalar(
    lines: string[],
    startIdx: number,
    parentIndent: number,
    mode: 'literal' | 'folded',
    indicator: string
  ): { value: string; nextIdx: number } {
    const blockLines: string[] = [];
    let i = startIdx;
    let blockIndent = -1;

    while (i < lines.length) {
      const line = lines[i];

      // Empty lines are preserved in block scalars
      if (line.trim() === '') {
        if (blockIndent !== -1) {
          blockLines.push('');
          i++;
          continue;
        }
        i++;
        continue;
      }

      const indent = this.getIndent(line);
      if (indent <= parentIndent) break;

      if (blockIndent === -1) {
        blockIndent = indent;
      }

      if (indent < blockIndent) break;

      blockLines.push(line.substring(blockIndent));
      i++;
    }

    // Remove trailing empty lines for strip (|-), keep one newline for clip (|), keep all for keep (|+)
    let text: string;
    if (mode === 'literal') {
      text = blockLines.join('\n');
    } else {
      // Folded: join lines with spaces, but preserve empty lines as newlines
      const paragraphs: string[] = [];
      let current: string[] = [];
      for (const bl of blockLines) {
        if (bl === '') {
          if (current.length) paragraphs.push(current.join(' '));
          paragraphs.push('');
          current = [];
        } else {
          current.push(bl);
        }
      }
      if (current.length) paragraphs.push(current.join(' '));
      text = paragraphs.join('\n');
    }

    // Handle chomping
    if (indicator.endsWith('-')) {
      text = text.replace(/\n+$/, '');
    } else if (indicator.endsWith('+')) {
      text = text + '\n';
    } else {
      text = text.replace(/\n+$/, '') + '\n';
    }

    return { value: text, nextIdx: i };
  }

  private parseYamlValue(raw: string): unknown {
    // Strip inline comments (but not inside quoted strings)
    let value = raw;
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIdx = value.indexOf(' #');
      if (commentIdx !== -1) {
        value = value.substring(0, commentIdx).trim();
      }
    }

    // Null
    if (value === 'null' || value === '~' || value === '') return null;

    // Boolean
    if (value === 'true' || value === 'True' || value === 'TRUE' || value === 'yes' || value === 'Yes' || value === 'YES' || value === 'on' || value === 'On' || value === 'ON') return true;
    if (value === 'false' || value === 'False' || value === 'FALSE' || value === 'no' || value === 'No' || value === 'NO' || value === 'off' || value === 'Off' || value === 'OFF') return false;

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Inline array [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      return this.parseInlineArray(value);
    }

    // Inline object {a: b, c: d}
    if (value.startsWith('{') && value.endsWith('}')) {
      return this.parseInlineObject(value);
    }

    // Number (integer or float)
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(value)) return parseFloat(value);

    // Infinity and NaN
    if (value === '.inf' || value === '.Inf' || value === '.INF') return Infinity;
    if (value === '-.inf' || value === '-.Inf' || value === '-.INF') return -Infinity;
    if (value === '.nan' || value === '.NaN' || value === '.NAN') return null;

    // Plain string
    return value;
  }

  private parseInlineArray(raw: string): unknown[] {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    const items = this.splitFlowItems(inner);
    return items.map(item => this.parseYamlValue(item.trim()));
  }

  private parseInlineObject(raw: string): Record<string, unknown> {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return {};
    const obj: Record<string, unknown> = {};
    const items = this.splitFlowItems(inner);
    for (const item of items) {
      const colonIdx = item.indexOf(':');
      if (colonIdx === -1) continue;
      let key = item.substring(0, colonIdx).trim();
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }
      const val = item.substring(colonIdx + 1).trim();
      obj[key] = this.parseYamlValue(val);
    }
    return obj;
  }

  private splitFlowItems(input: string): string[] {
    const items: string[] = [];
    let depth = 0;
    let current = '';
    let inQuote = '';

    for (let c = 0; c < input.length; c++) {
      const ch = input[c];

      if (inQuote) {
        current += ch;
        if (ch === inQuote) inQuote = '';
        continue;
      }

      if (ch === '"' || ch === "'") {
        inQuote = ch;
        current += ch;
        continue;
      }

      if (ch === '[' || ch === '{') {
        depth++;
        current += ch;
      } else if (ch === ']' || ch === '}') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        items.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.trim()) items.push(current.trim());
    return items;
  }

  // ── YAML Parser Helpers ───────────────────────────────────────────────────

  private findKeyColonIndex(line: string): number {
    // Find the first colon that's a key separator (not inside quotes)
    let inQuote = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === inQuote) inQuote = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === ':' && (i + 1 >= line.length || line[i + 1] === ' ' || line[i + 1] === '\t')) {
        return i;
      }
    }
    return -1;
  }

  private getIndent(line: string): number {
    let count = 0;
    for (const ch of line) {
      if (ch === ' ') count++;
      else if (ch === '\t') count += 2;
      else break;
    }
    return count;
  }

  private isEmptyOrComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#');
  }

  private findNextContentLine(lines: string[], startIdx: number, minIndent: number): number {
    for (let i = startIdx; i < lines.length; i++) {
      if (!this.isEmptyOrComment(lines[i])) {
        if (minIndent === -1 || this.getIndent(lines[i]) >= minIndent) {
          return i;
        }
      }
    }
    return -1;
  }

  // ── JSON to YAML Serializer ───────────────────────────────────────────────

  private toYaml(value: unknown, indent: number): string {
    if (value === null || value === undefined) return 'null\n';
    if (typeof value === 'boolean') return (value ? 'true' : 'false') + '\n';
    if (typeof value === 'number') return String(value) + '\n';
    if (typeof value === 'string') return this.yamlString(value) + '\n';

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]\n';
      let result = '\n';
      for (const item of value) {
        const prefix = ' '.repeat(indent) + '- ';
        if (item === null || item === undefined) {
          result += prefix + 'null\n';
        } else if (typeof item === 'object' && !Array.isArray(item)) {
          const objYaml = this.toYamlObject(item as Record<string, unknown>, indent + 2);
          // First key on same line as dash
          const firstNewline = objYaml.indexOf('\n');
          const firstLine = objYaml.substring(0, firstNewline);
          const rest = objYaml.substring(firstNewline + 1);
          result += prefix + firstLine.trimStart() + '\n';
          if (rest.trim()) result += rest;
        } else if (Array.isArray(item)) {
          result += prefix + '\n' + this.toYaml(item, indent + 2);
        } else {
          result += prefix + this.toYaml(item, 0).trim() + '\n';
        }
      }
      return result;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return '{}\n';
      return '\n' + this.toYamlObject(value as Record<string, unknown>, indent);
    }

    return String(value) + '\n';
  }

  private toYamlObject(obj: Record<string, unknown>, indent: number): string {
    let result = '';
    for (const [key, val] of Object.entries(obj)) {
      const prefix = ' '.repeat(indent);
      const safeKey = /[:{}\[\],&*#?|\-><!%@`]/.test(key) || key.includes(' ') ? `"${key}"` : key;

      if (val === null || val === undefined) {
        result += prefix + safeKey + ': null\n';
      } else if (typeof val === 'object') {
        const nested = this.toYaml(val, indent + 2);
        if (nested.startsWith('\n')) {
          result += prefix + safeKey + ':' + nested;
        } else {
          result += prefix + safeKey + ': ' + nested;
        }
      } else {
        result += prefix + safeKey + ': ' + this.toYaml(val, 0).trim() + '\n';
      }
    }
    return result;
  }

  private yamlString(s: string): string {
    if (s === '') return "''";
    // If it looks like a YAML value (boolean, null, number), quote it
    if (/^(true|false|null|yes|no|on|off|~|\d+(\.\d+)?)$/i.test(s)) {
      return `"${s}"`;
    }
    // If it contains special chars, quote it
    if (/[:{}\[\],&*#?|\-><!%@`\n"']/.test(s)) {
      if (s.includes('\n')) {
        // Use literal block scalar for multiline
        return '|\n  ' + s.split('\n').join('\n  ');
      }
      return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return s;
  }

  // ── Syntax Highlighting ───────────────────────────────────────────────────

  private highlightJson(json: string): string {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g,
      (match) => {
        if (match.endsWith(':')) return `<span class="yj-key">${match}</span>`;
        if (/^"/.test(match)) return `<span class="yj-str">${match}</span>`;
        if (/^-?\d/.test(match)) return `<span class="yj-num">${match}</span>`;
        if (match === 'true' || match === 'false') return `<span class="yj-bool">${match}</span>`;
        if (match === 'null') return `<span class="yj-null">${match}</span>`;
        return match;
      }
    );
  }

  private highlightYaml(yaml: string): string {
    const escaped = yaml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.split('\n').map(line => {
      // Comment lines
      if (/^\s*#/.test(line)) {
        return `<span class="yj-comment">${line}</span>`;
      }

      // Key-value lines
      const kvMatch = line.match(/^(\s*)([\w"'][^:]*?)(:)(\s*)(.*)?$/);
      if (kvMatch) {
        const [, indent, key, colon, space, value] = kvMatch;
        let highlightedValue = value || '';

        if (value) {
          if (/^(true|false|yes|no|on|off|True|False|Yes|No|TRUE|FALSE|YES|NO|ON|OFF)$/.test(value)) {
            highlightedValue = `<span class="yj-bool">${value}</span>`;
          } else if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) {
            highlightedValue = `<span class="yj-num">${value}</span>`;
          } else if (value === 'null' || value === '~') {
            highlightedValue = `<span class="yj-null">${value}</span>`;
          } else if (/^["']/.test(value)) {
            highlightedValue = `<span class="yj-str">${value}</span>`;
          } else if (value === '|' || value === '>' || value === '|-' || value === '>-' || value === '|+' || value === '>+') {
            highlightedValue = `<span class="yj-scalar">${value}</span>`;
          } else if (value === '[]' || value === '{}') {
            highlightedValue = `<span class="yj-null">${value}</span>`;
          } else {
            highlightedValue = `<span class="yj-str">${value}</span>`;
          }
        }

        return `${indent}<span class="yj-key">${key}</span><span class="yj-colon">${colon}</span>${space}${highlightedValue}`;
      }

      // Array items
      const arrMatch = line.match(/^(\s*)(- )(.*)$/);
      if (arrMatch) {
        const [, indent, dash, value] = arrMatch;
        let highlightedValue = value;

        if (/^(true|false|yes|no|on|off)$/i.test(value)) {
          highlightedValue = `<span class="yj-bool">${value}</span>`;
        } else if (/^-?\d+(\.\d+)?$/.test(value)) {
          highlightedValue = `<span class="yj-num">${value}</span>`;
        } else if (value === 'null' || value === '~') {
          highlightedValue = `<span class="yj-null">${value}</span>`;
        } else {
          highlightedValue = `<span class="yj-str">${value}</span>`;
        }

        return `${indent}<span class="yj-dash">${dash}</span>${highlightedValue}`;
      }

      return line;
    }).join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  get directionLabel(): string {
    return this.direction === 'yaml-to-json' ? 'YAML' : 'JSON';
  }

  get outputLabel(): string {
    return this.direction === 'yaml-to-json' ? 'JSON' : 'YAML';
  }

  get inputPlaceholder(): string {
    if (this.direction === 'yaml-to-json') {
      return 'Paste or type your YAML here...\n\ne.g.\nname: John Doe\nage: 30\nactive: true';
    }
    return 'Paste or type your JSON here...\n\ne.g. {"name": "John Doe", "age": 30}';
  }
}
