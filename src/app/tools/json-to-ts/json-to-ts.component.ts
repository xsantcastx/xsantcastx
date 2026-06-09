import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface GeneratedInterface {
  name: string;
  body: string;
}

@Component({
    selector: 'app-json-to-ts',
    templateUrl: './json-to-ts.component.html',
    styleUrls: ['./json-to-ts.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class JsonToTsComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JSON to TypeScript Converter — paste JSON, get interfaces instantly. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/json-to-ts')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/json-to-ts')}`;

  // Input
  jsonInput = '';
  rootInterfaceName = 'Root';
  allOptional = false;

  // Output
  tsOutput = '';
  highlightedHtml: SafeHtml = '';
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';
  copied = false;

  // Stats
  interfaceCount = 0;
  propertyCount = 0;

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // -- Live conversion (debounced 300ms) --

  onInput() {
    if (!this.jsonInput.trim()) {
      this.validationStatus = 'idle';
      this.errorMessage = '';
      this.tsOutput = '';
      this.highlightedHtml = '';
      this.interfaceCount = 0;
      this.propertyCount = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 300);
  }

  onOptionsChange() {
    if (this.validationStatus === 'valid' && this.jsonInput.trim()) {
      this.convert();
    }
  }

  // -- Core conversion --

  convert() {
    if (!this.jsonInput.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.jsonInput);
    } catch (e: any) {
      this.validationStatus = 'invalid';
      this.errorMessage = e?.message?.replace(' in JSON at position', ' at position') ?? 'Invalid JSON';
      this.tsOutput = '';
      this.highlightedHtml = '';
      this.interfaceCount = 0;
      this.propertyCount = 0;
      return;
    }

    this.validationStatus = 'valid';
    this.errorMessage = '';

    // Easter egg check
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if ('easter_egg' in (parsed as Record<string, unknown>)) {
        this.eggs.trigger('json-ts-hidden');
      }
    }

    const interfaces: GeneratedInterface[] = [];
    const safeName = this.sanitizeName(this.rootInterfaceName || 'Root');
    this.generateInterface(parsed, safeName, interfaces);

    // Reverse so root interface is at the top
    interfaces.reverse();

    this.tsOutput = interfaces.map(i => i.body).join('\n\n');
    this.interfaceCount = interfaces.length;
    this.propertyCount = (this.tsOutput.match(/^\s+\w/gm) || []).length;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlightTs(this.tsOutput));
  }

  // -- Interface generation --

  private generatedNames = new Map<string, number>();

  private generateInterface(value: unknown, name: string, interfaces: GeneratedInterface[]): string {
    // Reset name tracker on root call
    if (name === this.sanitizeName(this.rootInterfaceName || 'Root') && interfaces.length === 0) {
      this.generatedNames.clear();
    }

    if (value === null || value === undefined) {
      return 'unknown';
    }

    if (Array.isArray(value)) {
      return this.inferArrayType(value, name, interfaces) + '[]';
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      const opt = this.allOptional ? '?' : '';
      const lines = keys.map(key => {
        const childName = this.pascalCase(key);
        const childType = this.resolveType(obj[key], childName, interfaces);
        return `  ${this.safeKey(key)}${opt}: ${childType};`;
      });

      const uniqueName = this.uniqueName(name);
      const body = `export interface ${uniqueName} {\n${lines.join('\n')}\n}`;
      interfaces.push({ name: uniqueName, body });
      return uniqueName;
    }

    return this.primitiveType(value);
  }

  private resolveType(value: unknown, suggestedName: string, interfaces: GeneratedInterface[]): string {
    if (value === null) {
      return 'unknown | null';
    }

    if (value === undefined) {
      return 'unknown';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'unknown[]';
      }
      return this.inferArrayType(value, suggestedName, interfaces) + '[]';
    }

    if (typeof value === 'object') {
      return this.generateInterface(value, suggestedName, interfaces);
    }

    return this.primitiveType(value);
  }

  private inferArrayType(arr: unknown[], suggestedName: string, interfaces: GeneratedInterface[]): string {
    if (arr.length === 0) {
      return 'unknown';
    }

    const types = new Set<string>();
    let objectSample: Record<string, unknown> | null = null;

    for (const item of arr) {
      if (item === null) {
        types.add('null');
      } else if (Array.isArray(item)) {
        const inner = this.inferArrayType(item, suggestedName, interfaces);
        types.add(inner + '[]');
      } else if (typeof item === 'object') {
        // Merge all object items to get a full picture of properties
        if (!objectSample) {
          objectSample = { ...(item as Record<string, unknown>) };
        } else {
          const obj = item as Record<string, unknown>;
          for (const key of Object.keys(obj)) {
            if (!(key in objectSample) || objectSample[key] === null) {
              objectSample[key] = obj[key];
            }
          }
        }
        types.add('__object__');
      } else {
        types.add(this.primitiveType(item));
      }
    }

    // Replace __object__ placeholder with generated interface
    if (types.has('__object__') && objectSample) {
      types.delete('__object__');
      const singularName = this.singularize(suggestedName);
      const ifaceName = this.generateInterface(objectSample, singularName, interfaces);
      types.add(ifaceName);
    }

    const typeArr = [...types];
    if (typeArr.length === 1) {
      return typeArr[0];
    }

    // Union type, wrap in parens for array clarity
    return '(' + typeArr.join(' | ') + ')';
  }

  private primitiveType(value: unknown): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  }

  // -- Name helpers --

  private pascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  private singularize(name: string): string {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
    if (name.endsWith('ses')) return name.slice(0, -2);
    if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
    return name + 'Item';
  }

  private sanitizeName(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, '');
    if (!cleaned || /^\d/.test(cleaned)) return 'Root';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  private uniqueName(name: string): string {
    const count = this.generatedNames.get(name) || 0;
    this.generatedNames.set(name, count + 1);
    return count === 0 ? name : `${name}${count + 1}`;
  }

  private safeKey(key: string): string {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
    return `'${key.replace(/'/g, "\\'")}'`;
  }

  // -- Sample JSON --

  loadSample() {
    this.jsonInput = JSON.stringify({
      "id": 1,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "isActive": true,
      "age": 28,
      "address": {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zipCode": "94102",
        "coordinates": {
          "lat": 37.7749,
          "lng": -122.4194
        }
      },
      "roles": ["admin", "editor"],
      "projects": [
        {
          "id": 101,
          "title": "Website Redesign",
          "status": "in_progress",
          "tags": ["frontend", "design"]
        },
        {
          "id": 102,
          "title": "API Migration",
          "status": "completed",
          "tags": ["backend"]
        }
      ],
      "metadata": null,
      "scores": [98, 85, 92]
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.jsonInput = '';
    this.tsOutput = '';
    this.highlightedHtml = '';
    this.validationStatus = 'idle';
    this.errorMessage = '';
    this.interfaceCount = 0;
    this.propertyCount = 0;
  }

  // -- Clipboard --

  async copyOutput() {
    if (!this.tsOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.tsOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.tsOutput);
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

  // -- TypeScript syntax highlighting --

  private highlightTs(code: string): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped
      // Keywords
      .replace(/\b(export|interface|type|enum|const|let|var|extends|implements)\b/g,
        '<span class="jts-keyword">$1</span>')
      // Types
      .replace(/:\s*(string|number|boolean|unknown|null|undefined)(\[\])?/g,
        (match, type, arr) => `: <span class="jts-type">${type}${arr || ''}</span>`)
      // Union null
      .replace(/\|\s*null/g, '| <span class="jts-null">null</span>')
      // Interface names (after export interface)
      .replace(/(interface\s+)(<span class="jts-keyword">interface<\/span>\s+)?(\w+)/g,
        (match) => {
          // Re-process to handle the already-highlighted keyword
          return match.replace(/(<\/span>\s+)(\w+)/, '$1<span class="jts-iface">$2</span>');
        })
      // Property names
      .replace(/^(\s+)([a-zA-Z_$][\w$]*|'[^']+')(\??:\s)/gm,
        '$1<span class="jts-prop">$2</span>$3')
      // Array brackets
      .replace(/\[\]/g, '<span class="jts-bracket">[]</span>')
      // Braces
      .replace(/\{/g, '<span class="jts-brace">{</span>')
      .replace(/\}/g, '<span class="jts-brace">}</span>');
  }
}
