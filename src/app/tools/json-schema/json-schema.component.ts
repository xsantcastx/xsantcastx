import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

interface SchemaOptions {
  markAllRequired: boolean;
  addDescriptions: boolean;
  additionalProperties: boolean;
}

interface ValidationIssue {
  path: string;
  message: string;
  expected: string;
  received: string;
}

@Component({
  selector: 'app-json-schema',
  templateUrl: './json-schema.component.html',
  styleUrls: ['./json-schema.component.css'],
  standalone: false
})
export class JsonSchemaComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON Schema Generator — paste JSON, get draft-07 schema instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-schema')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-schema')}`;

  // Input
  jsonInput = '';

  // Options
  options: SchemaOptions = {
    markAllRequired: true,
    addDescriptions: false,
    additionalProperties: false
  };

  // Output
  schemaOutput = '';
  highlightedHtml: SafeHtml = '';
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';
  copied = false;
  downloaded = false;

  // Validation tab
  validateInput = '';
  validationResults: ValidationIssue[] = [];
  validationPassed: boolean | null = null;

  // Stats
  propertyCount = 0;
  depthCount = 0;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live generation (debounced 300ms) ────────────────────────────────────

  onInput() {
    if (!this.jsonInput.trim()) {
      this.validationStatus = 'idle';
      this.errorMessage = '';
      this.schemaOutput = '';
      this.highlightedHtml = '';
      this.propertyCount = 0;
      this.depthCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.generateSchema(), 300);
  }

  onOptionChange() {
    if (this.validationStatus === 'valid' && this.jsonInput.trim()) {
      this.generateSchema();
    }
  }

  // ── Schema Generation ───────────────────────────────────────────────────

  generateSchema() {
    if (!this.jsonInput.trim()) return;

    try {
      const parsed = JSON.parse(this.jsonInput);

      // Easter egg: 20+ top-level keys
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const topLevelKeys = Object.keys(parsed);
        if (topLevelKeys.length >= 20) {
          this.eggs.trigger('schema-mega');
        }
      }

      const schema = this.buildSchema(parsed, 0);
      schema['$schema'] = 'http://json-schema.org/draft-07/schema#';

      // Move $schema to the top
      const ordered: Record<string, unknown> = { '$schema': schema['$schema'] };
      for (const key of Object.keys(schema)) {
        if (key !== '$schema') ordered[key] = schema[key];
      }

      const output = JSON.stringify(ordered, null, 2);
      this.schemaOutput = output;
      this.validationStatus = 'valid';
      this.errorMessage = '';
      this.propertyCount = this.countProperties(parsed);
      this.depthCount = this.measureDepth(parsed);
      this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(output));
    } catch (e: any) {
      this.validationStatus = 'invalid';
      this.errorMessage = this.friendlyError(e?.message ?? 'Invalid JSON');
      this.schemaOutput = '';
      this.highlightedHtml = '';
      this.propertyCount = 0;
      this.depthCount = 0;
    }
  }

  private buildSchema(value: unknown, depth: number): Record<string, unknown> {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      const schema: Record<string, unknown> = { type: 'array' };
      if (this.options.addDescriptions) {
        schema['description'] = '';
      }

      if (value.length > 0) {
        // Check if all items are the same type
        const itemSchemas = value.map(item => this.buildSchema(item, depth + 1));
        if (this.allSameType(itemSchemas)) {
          // If objects, merge all properties
          if (itemSchemas[0]['type'] === 'object') {
            schema['items'] = this.mergeObjectSchemas(itemSchemas);
          } else {
            schema['items'] = itemSchemas[0];
          }
        } else {
          // Mixed types — use oneOf
          const uniqueSchemas = this.deduplicateSchemas(itemSchemas);
          if (uniqueSchemas.length === 1) {
            schema['items'] = uniqueSchemas[0];
          } else {
            schema['items'] = { oneOf: uniqueSchemas };
          }
        }
      }
      return schema;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      const keys = Object.keys(obj);

      for (const key of keys) {
        properties[key] = this.buildSchema(obj[key], depth + 1);
      }

      const schema: Record<string, unknown> = {
        type: 'object',
        properties
      };

      if (this.options.addDescriptions) {
        schema['description'] = '';
      }

      if (this.options.markAllRequired && keys.length > 0) {
        schema['required'] = keys;
      }

      schema['additionalProperties'] = this.options.additionalProperties;

      return schema;
    }

    // Primitives
    const schema: Record<string, unknown> = {};

    if (typeof value === 'string') {
      schema['type'] = 'string';
      // Detect common formats
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        schema['format'] = 'date-time';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        schema['format'] = 'date';
      } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
        schema['format'] = 'email';
      } else if (/^https?:\/\//.test(value)) {
        schema['format'] = 'uri';
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        schema['format'] = 'uuid';
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
        schema['format'] = 'ipv4';
      }
    } else if (typeof value === 'number') {
      schema['type'] = Number.isInteger(value) ? 'integer' : 'number';
    } else if (typeof value === 'boolean') {
      schema['type'] = 'boolean';
    }

    if (this.options.addDescriptions) {
      schema['description'] = '';
    }

    return schema;
  }

  private allSameType(schemas: Record<string, unknown>[]): boolean {
    if (schemas.length <= 1) return true;
    const firstType = schemas[0]['type'];
    return schemas.every(s => s['type'] === firstType);
  }

  private mergeObjectSchemas(schemas: Record<string, unknown>[]): Record<string, unknown> {
    const merged: Record<string, unknown> = { type: 'object', properties: {} };
    const allKeys = new Set<string>();

    for (const s of schemas) {
      const props = s['properties'] as Record<string, unknown> | undefined;
      if (props) {
        Object.keys(props).forEach(k => allKeys.add(k));
      }
    }

    const mergedProps: Record<string, unknown> = {};
    for (const key of allKeys) {
      // Take the first schema that has this key
      for (const s of schemas) {
        const props = s['properties'] as Record<string, unknown> | undefined;
        if (props && props[key]) {
          mergedProps[key] = props[key];
          break;
        }
      }
    }

    merged['properties'] = mergedProps;

    if (this.options.markAllRequired) {
      // Only mark as required if ALL items have this key
      const required = [...allKeys].filter(key =>
        schemas.every(s => {
          const props = s['properties'] as Record<string, unknown> | undefined;
          return props && props[key] !== undefined;
        })
      );
      if (required.length > 0) {
        merged['required'] = required;
      }
    }

    merged['additionalProperties'] = this.options.additionalProperties;

    return merged;
  }

  private deduplicateSchemas(schemas: Record<string, unknown>[]): Record<string, unknown>[] {
    const seen = new Set<string>();
    const unique: Record<string, unknown>[] = [];
    for (const s of schemas) {
      const key = JSON.stringify(s);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    return unique;
  }

  // ── Validate JSON against generated schema ──────────────────────────────

  validateAgainstSchema() {
    if (!this.validateInput.trim() || !this.schemaOutput) {
      this.validationResults = [];
      this.validationPassed = null;
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(this.validateInput);
    } catch {
      this.validationResults = [{ path: '(root)', message: 'Invalid JSON input', expected: 'Valid JSON', received: 'Parse error' }];
      this.validationPassed = false;
      return;
    }

    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(this.schemaOutput);
    } catch {
      this.validationResults = [{ path: '(root)', message: 'Invalid schema', expected: 'Valid schema', received: 'Parse error' }];
      this.validationPassed = false;
      return;
    }

    const issues: ValidationIssue[] = [];
    this.validateNode(data, schema, '/', issues);
    this.validationResults = issues;
    this.validationPassed = issues.length === 0;
  }

  private validateNode(data: unknown, schema: Record<string, unknown>, path: string, issues: ValidationIssue[]) {
    const expectedType = schema['type'] as string | undefined;

    // Type check
    if (expectedType) {
      const actualType = this.getJsonType(data);
      if (expectedType === 'integer') {
        if (typeof data !== 'number' || !Number.isInteger(data)) {
          issues.push({ path, message: 'Type mismatch', expected: 'integer', received: actualType });
          return;
        }
      } else if (actualType !== expectedType) {
        issues.push({ path, message: 'Type mismatch', expected: expectedType, received: actualType });
        return;
      }
    }

    // Required fields
    if (expectedType === 'object' && schema['required'] && typeof data === 'object' && data !== null) {
      const required = schema['required'] as string[];
      const obj = data as Record<string, unknown>;
      for (const key of required) {
        if (!(key in obj)) {
          issues.push({ path: path + key, message: 'Missing required property', expected: `"${key}" present`, received: 'missing' });
        }
      }
    }

    // Additional properties
    if (expectedType === 'object' && schema['additionalProperties'] === false && typeof data === 'object' && data !== null && schema['properties']) {
      const obj = data as Record<string, unknown>;
      const allowed = new Set(Object.keys(schema['properties'] as Record<string, unknown>));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          issues.push({ path: path + key, message: 'Additional property not allowed', expected: 'not present', received: `"${key}"` });
        }
      }
    }

    // Recurse into object properties
    if (expectedType === 'object' && schema['properties'] && typeof data === 'object' && data !== null) {
      const props = schema['properties'] as Record<string, Record<string, unknown>>;
      const obj = data as Record<string, unknown>;
      for (const key of Object.keys(props)) {
        if (key in obj) {
          this.validateNode(obj[key], props[key], path + key + '/', issues);
        }
      }
    }

    // Recurse into array items
    if (expectedType === 'array' && Array.isArray(data) && schema['items']) {
      const itemSchema = schema['items'] as Record<string, unknown>;
      data.forEach((item, i) => {
        if (itemSchema['oneOf']) {
          const oneOf = itemSchema['oneOf'] as Record<string, unknown>[];
          const subIssues: ValidationIssue[][] = [];
          let matched = false;
          for (const sub of oneOf) {
            const subList: ValidationIssue[] = [];
            this.validateNode(item, sub, `${path}[${i}]/`, subList);
            if (subList.length === 0) { matched = true; break; }
            subIssues.push(subList);
          }
          if (!matched) {
            issues.push({ path: `${path}[${i}]`, message: 'Does not match any schema in oneOf', expected: 'one of allowed types', received: this.getJsonType(item) });
          }
        } else {
          this.validateNode(item, itemSchema, `${path}[${i}]/`, issues);
        }
      });
    }

    // Format validation (basic)
    if (expectedType === 'string' && typeof data === 'string' && schema['format']) {
      const format = schema['format'] as string;
      let valid = true;
      if (format === 'email') valid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data);
      else if (format === 'uri') valid = /^https?:\/\//.test(data);
      else if (format === 'date') valid = /^\d{4}-\d{2}-\d{2}$/.test(data);
      else if (format === 'date-time') valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(data);
      else if (format === 'uuid') valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data);
      else if (format === 'ipv4') valid = /^\d{1,3}(\.\d{1,3}){3}$/.test(data);

      if (!valid) {
        issues.push({ path, message: `Invalid format`, expected: format, received: `"${data.length > 40 ? data.substring(0, 40) + '...' : data}"` });
      }
    }
  }

  private getJsonType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
    return typeof value;
  }

  // ── Sample data ─────────────────────────────────────────────────────────

  loadSample() {
    this.jsonInput = JSON.stringify({
      "id": 1,
      "name": "JSON Schema Generator",
      "version": "1.0.0",
      "description": "Generate JSON Schema from any JSON document",
      "author": {
        "name": "xsantcastx",
        "email": "hello@xsantcastx.com",
        "url": "https://xsantcastx.com"
      },
      "tags": ["json", "schema", "generator", "draft-07"],
      "config": {
        "draft": "draft-07",
        "strict": true,
        "maxDepth": 10
      },
      "createdAt": "2026-03-30T12:00:00Z",
      "active": true
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.jsonInput = '';
    this.schemaOutput = '';
    this.highlightedHtml = '';
    this.validationStatus = 'idle';
    this.errorMessage = '';
    this.propertyCount = 0;
    this.depthCount = 0;
    this.validateInput = '';
    this.validationResults = [];
    this.validationPassed = null;
  }

  // ── Clipboard ───────────────────────────────────────────────────────────

  async copyOutput() {
    if (!this.schemaOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.schemaOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.schemaOutput);
    }
  }

  downloadOutput() {
    if (!this.schemaOutput || !this.isBrowser) return;
    const blob = new Blob([this.schemaOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
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

  // ── Syntax highlighting ─────────────────────────────────────────────────

  private highlight(json: string): string {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g,
      (match) => {
        if (match.endsWith(':')) return `<span class="jsc-key">${match}</span>`;
        if (/^"/.test(match)) return `<span class="jsc-str">${match}</span>`;
        if (/^-?\d/.test(match)) return `<span class="jsc-num">${match}</span>`;
        if (match === 'true' || match === 'false') return `<span class="jsc-bool">${match}</span>`;
        if (match === 'null') return `<span class="jsc-null">${match}</span>`;
        return match;
      }
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private countProperties(value: unknown): number {
    if (value === null || typeof value !== 'object') return 0;
    if (Array.isArray(value)) {
      return value.reduce((acc: number, item) => acc + this.countProperties(item), 0);
    }
    const obj = value as Record<string, unknown>;
    let count = Object.keys(obj).length;
    for (const key of Object.keys(obj)) {
      count += this.countProperties(obj[key]);
    }
    return count;
  }

  private measureDepth(value: unknown, current = 0): number {
    if (value === null || typeof value !== 'object') return current;
    if (Array.isArray(value)) {
      return value.reduce((max: number, item) => Math.max(max, this.measureDepth(item, current + 1)), current);
    }
    const obj = value as Record<string, unknown>;
    let max = current + 1;
    for (const key of Object.keys(obj)) {
      max = Math.max(max, this.measureDepth(obj[key], current + 1));
    }
    return max;
  }

  private friendlyError(msg: string): string {
    if (msg.includes('Unexpected token')) {
      const token = msg.match(/Unexpected token '?(.+?)'?( in JSON)?/)?.[1] ?? '';
      return `Unexpected token${token ? ` "${token}"` : ''}`;
    }
    if (msg.includes('Unexpected end')) {
      return 'Unexpected end of JSON — check for missing closing brackets or quotes';
    }
    return msg.replace(' in JSON', '');
  }
}
