import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type OutputFormat = 'css' | 'scss' | 'tailwind' | 'json-flat';

interface DesignToken {
  $value?: any;
  $type?: string;
  value?: any;
  type?: string;
  [key: string]: any;
}

interface FlatToken {
  path: string;
  cssVar: string;
  value: any;
  type: string;
}

@Component({
    selector: 'app-design-tokens',
    templateUrl: './design-tokens.component.html',
    styleUrls: ['./design-tokens.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class DesignTokensComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Design Token Converter — paste Figma tokens, get CSS, SCSS, Tailwind & JSON. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/design-tokens')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/design-tokens')}`;

  // Input
  tokenInput = '';

  // Options
  outputFormat: OutputFormat = 'css';
  prefix = 'dt';

  // Output state
  convertedOutput = '';
  validationStatus: 'idle' | 'valid' | 'invalid' = 'idle';
  errorMessage = '';
  copied = false;

  // Stats
  tokenCount = 0;
  groupCount = 0;

  // Flat tokens for preview
  flatTokens: FlatToken[] = [];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live conversion (debounced 300ms) ─────────────────────────────────────

  onInput() {
    if (!this.tokenInput.trim()) {
      this.reset();
      return;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.convert(), 300);
  }

  onFormatChange() {
    if (this.validationStatus === 'valid' && this.tokenInput.trim()) {
      this.convert();
    }
  }

  // ── Core conversion ───────────────────────────────────────────────────────

  convert() {
    if (!this.tokenInput.trim()) {
      this.reset();
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(this.tokenInput);
    } catch (e: any) {
      this.validationStatus = 'invalid';
      this.errorMessage = e?.message ?? 'Invalid JSON';
      this.convertedOutput = '';
      this.flatTokens = [];
      this.tokenCount = 0;
      this.groupCount = 0;
      return;
    }

    // Flatten tokens
    this.flatTokens = [];
    this.groupCount = 0;
    this.flattenTokens(parsed, []);
    this.tokenCount = this.flatTokens.length;

    if (this.tokenCount === 0) {
      this.validationStatus = 'invalid';
      this.errorMessage = 'No valid design tokens found. Tokens must have a $value or value property.';
      this.convertedOutput = '';
      return;
    }

    this.validationStatus = 'valid';
    this.errorMessage = '';

    // Easter egg: check for "brand" key
    if (this.hasBrandKey(parsed)) {
      this.eggs.trigger('token-branded');
    }

    // Generate output
    switch (this.outputFormat) {
      case 'css':
        this.convertedOutput = this.toCssCustomProperties();
        break;
      case 'scss':
        this.convertedOutput = this.toScssVariables();
        break;
      case 'tailwind':
        this.convertedOutput = this.toTailwindConfig();
        break;
      case 'json-flat':
        this.convertedOutput = this.toJsonFlat();
        break;
    }
  }

  // ── Flatten nested tokens ─────────────────────────────────────────────────

  private flattenTokens(obj: any, path: string[]) {
    if (!obj || typeof obj !== 'object') return;

    // Check if this node is a token (has $value or value)
    const val = obj.$value ?? obj.value;
    if (val !== undefined) {
      const tokenType = obj.$type ?? obj.type ?? this.inferType(val);
      const cssVar = `--${this.prefix}-${path.join('-')}`;
      this.flatTokens.push({
        path: path.join('.'),
        cssVar,
        value: this.resolveValue(val),
        type: tokenType
      });
      return;
    }

    // Otherwise it's a group — recurse
    let isGroup = false;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) continue; // skip meta keys like $type, $description
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        isGroup = true;
        this.flattenTokens(obj[key], [...path, this.kebabCase(key)]);
      }
    }
    if (isGroup && path.length > 0) {
      this.groupCount++;
    }
  }

  // ── Output generators ─────────────────────────────────────────────────────

  private toCssCustomProperties(): string {
    const lines = this.flatTokens.map(t => `  ${t.cssVar}: ${t.value};`);
    return `:root {\n${lines.join('\n')}\n}`;
  }

  private toScssVariables(): string {
    return this.flatTokens
      .map(t => {
        const varName = t.cssVar.replace(/^--/, '$');
        return `${varName}: ${t.value};`;
      })
      .join('\n');
  }

  private toTailwindConfig(): string {
    const theme: any = {};

    for (const token of this.flatTokens) {
      const parts = token.path.split('.');
      let current = theme;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = this.camelCase(parts[i]);
        if (!current[key]) current[key] = {};
        current = current[key];
      }
      current[this.camelCase(parts[parts.length - 1])] = token.value;
    }

    const inner = JSON.stringify(theme, null, 4);
    return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: ${this.indentBlock(inner, 6)}\n  }\n}`;
  }

  private toJsonFlat(): string {
    const result: Record<string, any> = {};
    for (const token of this.flatTokens) {
      result[token.cssVar] = token.value;
    }
    return JSON.stringify(result, null, 2);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveValue(val: any): string {
    if (typeof val === 'object' && val !== null) {
      // Handle composite values (e.g., typography, shadow)
      if (val.fontFamily) {
        return `${val.fontWeight ?? 400} ${val.fontSize ?? '16px'}/${val.lineHeight ?? '1.5'} ${val.fontFamily}`;
      }
      if (val.x !== undefined && val.y !== undefined) {
        return `${val.x} ${val.y} ${val.blur ?? '0'} ${val.spread ?? '0'} ${val.color ?? '#000'}`;
      }
      return JSON.stringify(val);
    }
    return String(val);
  }

  private inferType(val: any): string {
    if (typeof val === 'string') {
      if (/^#[0-9a-fA-F]{3,8}$/.test(val) || /^rgba?\(/.test(val) || /^hsla?\(/.test(val)) return 'color';
      if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(val)) return 'dimension';
      if (/^\d+$/.test(val)) return 'number';
    }
    if (typeof val === 'number') return 'number';
    if (typeof val === 'object') return 'composite';
    return 'other';
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  private indentBlock(text: string, spaces: number): string {
    const pad = ' '.repeat(spaces);
    const lines = text.split('\n');
    return lines.map((line, i) => (i === 0 ? line : pad + line)).join('\n');
  }

  private hasBrandKey(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === 'brand') return true;
      if (typeof obj[key] === 'object' && obj[key] !== null && this.hasBrandKey(obj[key])) return true;
    }
    return false;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  loadSample() {
    this.tokenInput = JSON.stringify({
      "colors": {
        "brand": {
          "primary": {
            "$value": "#00ffcc",
            "$type": "color"
          },
          "secondary": {
            "$value": "#7b61ff",
            "$type": "color"
          },
          "dark": {
            "$value": "#0a0e1a",
            "$type": "color"
          }
        },
        "neutral": {
          "100": { "$value": "#f5f5f5", "$type": "color" },
          "500": { "$value": "#6b7280", "$type": "color" },
          "900": { "$value": "#111827", "$type": "color" }
        }
      },
      "spacing": {
        "xs": { "$value": "4px", "$type": "dimension" },
        "sm": { "$value": "8px", "$type": "dimension" },
        "md": { "$value": "16px", "$type": "dimension" },
        "lg": { "$value": "24px", "$type": "dimension" },
        "xl": { "$value": "32px", "$type": "dimension" },
        "2xl": { "$value": "48px", "$type": "dimension" }
      },
      "typography": {
        "heading": {
          "fontFamily": { "$value": "Inter, sans-serif", "$type": "fontFamily" },
          "fontSize": { "$value": "32px", "$type": "dimension" },
          "fontWeight": { "$value": "700", "$type": "fontWeight" },
          "lineHeight": { "$value": "1.2", "$type": "number" }
        },
        "body": {
          "fontFamily": { "$value": "Inter, sans-serif", "$type": "fontFamily" },
          "fontSize": { "$value": "16px", "$type": "dimension" },
          "fontWeight": { "$value": "400", "$type": "fontWeight" },
          "lineHeight": { "$value": "1.6", "$type": "number" }
        }
      },
      "borderRadius": {
        "sm": { "$value": "4px", "$type": "dimension" },
        "md": { "$value": "8px", "$type": "dimension" },
        "lg": { "$value": "16px", "$type": "dimension" },
        "full": { "$value": "9999px", "$type": "dimension" }
      }
    }, null, 2);
    this.onInput();
  }

  clearAll() {
    this.tokenInput = '';
    this.reset();
  }

  private reset() {
    this.convertedOutput = '';
    this.validationStatus = 'idle';
    this.errorMessage = '';
    this.flatTokens = [];
    this.tokenCount = 0;
    this.groupCount = 0;
  }

  async copyOutput() {
    if (!this.convertedOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.convertedOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.convertedOutput);
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

  getTypeIcon(type: string): string {
    switch (type) {
      case 'color': return '#';
      case 'dimension': return '↔';
      case 'fontFamily': return 'Aa';
      case 'fontWeight': return 'B';
      case 'number': return '42';
      default: return '{}';
    }
  }
}
