import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type JsMode = 'minify' | 'beautify';

@Component({
  selector: 'app-js-minifier',
  templateUrl: './js-minifier.component.html',
  styleUrls: ['./js-minifier.component.css'],
  standalone: false
})
export class JsMinifierComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free JavaScript Minifier & Beautifier — minify or format JS code instantly')}&url=${encodeURIComponent(SITE_URL + '/tools/js-minifier')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/js-minifier')}`;

  mode: JsMode = 'minify';
  input = '';
  output = '';
  copied = false;
  errorMessage = '';
  inputSize = 0;
  outputSize = 0;

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  setMode(m: JsMode): void { this.mode = m; if (this.input) this.process(); }

  onInput(): void {
    this.inputSize = new Blob([this.input]).size;
    this.errorMessage = '';
    if (this.input.includes('eval(')) { this.eggs.trigger('js-eval-danger'); }
    if (this.input.trim()) this.process();
    else { this.output = ''; this.outputSize = 0; }
  }

  private process(): void {
    try {
      if (this.mode === 'minify') {
        this.output = this.minifyJS(this.input);
      } else {
        this.output = this.beautifyJS(this.input);
      }
      this.outputSize = new Blob([this.output]).size;
      this.errorMessage = '';
    } catch (e: any) {
      this.errorMessage = e.message || 'Processing failed';
      this.output = '';
      this.outputSize = 0;
    }
  }

  private minifyJS(code: string): string {
    let result = code;
    // Remove single-line comments (not in strings)
    result = result.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove leading/trailing whitespace per line
    result = result.replace(/^\s+/gm, '');
    result = result.replace(/\s+$/gm, '');
    // Collapse multiple spaces
    result = result.replace(/\s{2,}/g, ' ');
    // Remove newlines
    result = result.replace(/\n+/g, '');
    // Remove spaces around operators
    result = result.replace(/\s*([{};,=:+\-*/<>!&|?])\s*/g, '$1');
    return result.trim();
  }

  private beautifyJS(code: string): string {
    let result = '';
    let indent = 0;
    const tab = '  ';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const next = code[i + 1] || '';

      if (inString) {
        result += ch;
        if (ch === stringChar && code[i - 1] !== '\\') inString = false;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
        result += ch;
        continue;
      }

      if (ch === '{') {
        result += ' {\n' + tab.repeat(++indent);
      } else if (ch === '}') {
        result = result.trimEnd();
        result += '\n' + tab.repeat(--indent) + '}';
        if (next !== ';' && next !== ',' && next !== ')' && next !== '\n') result += '\n' + tab.repeat(indent);
      } else if (ch === ';') {
        result += ';\n' + tab.repeat(indent);
      } else if (ch === ',' && !inString) {
        result += ',\n' + tab.repeat(indent);
      } else {
        result += ch;
      }
    }
    return result.trim();
  }

  get savings(): number {
    if (!this.inputSize || !this.outputSize) return 0;
    return Math.round(((this.inputSize - this.outputSize) / this.inputSize) * 100);
  }

  async copyOutput(): Promise<void> {
    if (!this.output || !this.isBrowser) return;
    try { await navigator.clipboard.writeText(this.output); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch {}
  }

  clearAll(): void { this.input = ''; this.output = ''; this.errorMessage = ''; this.inputSize = 0; this.outputSize = 0; }

  loadSample(): void {
    this.input = `// Example JavaScript\nfunction greet(name) {\n  const message = "Hello, " + name + "!";\n  console.log(message);\n  return message;\n}\n\n// Call the function\nconst result = greet("World");\nconsole.log(result);\n`;
    this.onInput();
  }
}
