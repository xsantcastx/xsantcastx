import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-css-minifier',
    templateUrl: './css-minifier.component.html',
    styleUrls: ['./css-minifier.component.css'],
    imports: [ToolsSharedModule, FormsModule, DecimalPipe]
})
export class CssMinifierComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Minifier & Beautifier — minify or beautify CSS instantly. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/css-minifier')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/css-minifier')}`;

  // Input
  cssInput = '';

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

  // ── Live stats (debounced 300ms) ──────────────────────────────────────

  onInput() {
    this.charCount = this.cssInput.length;
    this.inputBytes = new TextEncoder().encode(this.cssInput).length;

    if (!this.cssInput.trim()) {
      this.formattedOutput = '';
      this.highlightedHtml = '';
      this.lineCount = 0;
      this.outputBytes = 0;
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.checkEasterEgg(), 300);
  }

  private checkEasterEgg() {
    const matches = this.cssInput.match(/!important/g);
    if (matches && matches.length > 5) {
      this.eggs.trigger('css-important');
    }
  }

  // ── Core actions ───────────────────────────────────────────────────────

  minify() {
    if (!this.cssInput.trim()) return;

    let result = this.cssInput;

    // Remove block comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove newlines and carriage returns
    result = result.replace(/[\r\n]+/g, '');

    // Remove whitespace around selectors and braces
    result = result.replace(/\s*([{}:;,>~+])\s*/g, '$1');

    // Remove last semicolons before closing braces
    result = result.replace(/;}/g, '}');

    // Collapse remaining whitespace
    result = result.replace(/\s{2,}/g, ' ');

    // Trim
    result = result.trim();

    this.applyOutput(result);
    this.checkEasterEgg();
  }

  beautify() {
    if (!this.cssInput.trim()) return;

    let result = this.cssInput;

    // Remove block comments first, then re-add won't happen — just strip for clean beautify
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    // Normalize whitespace
    result = result.replace(/[\r\n]+/g, ' ');
    result = result.replace(/\s{2,}/g, ' ');
    result = result.trim();

    // Add newline after opening braces
    result = result.replace(/\{/g, ' {\n');

    // Add newline before closing braces
    result = result.replace(/\}/g, '\n}\n');

    // Add newline after semicolons (inside blocks)
    result = result.replace(/;/g, ';\n');

    // Now apply indentation
    const lines = result.split('\n');
    const formatted: string[] = [];
    let indent = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Decrease indent for closing brace
      if (line.startsWith('}')) {
        indent = Math.max(0, indent - 1);
      }

      const indentation = '  '.repeat(indent);

      // Add space after colon in property declarations
      let formattedLine = line.replace(/:\s*/g, ': ').replace(/,\s*/g, ', ');

      formatted.push(indentation + formattedLine);

      // Increase indent after opening brace
      if (line.endsWith('{')) {
        indent++;
      }
    }

    const beautified = formatted.join('\n');
    this.applyOutput(beautified);
    this.checkEasterEgg();
  }

  loadSample() {
    this.cssInput = `/* Reset & Base */
body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: #0a0e17;
  color: #d6ddeb;
  line-height: 1.6;
}

/* Navigation */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: rgba(10, 14, 23, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.navbar__logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #00ffcc;
  text-decoration: none;
}

.navbar__links a {
  color: #8892a6;
  text-decoration: none;
  margin-left: 1.5rem;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.navbar__links a:hover {
  color: #00ffcc;
}

/* Card Component */
.card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 255, 204, 0.08);
}

/* Button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  background: #00ffcc;
  color: #000;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}`;
    this.onInput();
  }

  clearAll() {
    this.cssInput = '';
    this.formattedOutput = '';
    this.highlightedHtml = '';
    this.lineCount = 0;
    this.charCount = 0;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }

  // ── Clipboard ─────────────────────────────────────────────────────────

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

  // ── Syntax highlighting ────────────────────────────────────────────────

  private highlight(css: string): string {
    const escaped = css
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Process line by line
    const lines = escaped.split('\n');
    const highlighted = lines.map(line => {
      // Comment lines (already stripped but just in case)
      if (line.trim().startsWith('/*')) {
        return `<span class="cm-comment">${line}</span>`;
      }

      // Lines with property: value;
      const propMatch = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.+?)(;?)$/);
      if (propMatch) {
        const [, indent, prop, colon, value, semi] = propMatch;
        return `${indent}<span class="cm-property">${prop}</span>${colon}<span class="cm-value">${value}</span>${semi}`;
      }

      // Lines with selector {
      if (line.trim().endsWith('{')) {
        const parts = line.split('{');
        return `<span class="cm-selector">${parts[0]}</span>{`;
      }

      // Closing brace
      if (line.trim() === '}') {
        return line;
      }

      // For minified output — handle inline selectors, properties, and braces
      // Apply highlighting for inline CSS (minified single line)
      let result = line;

      // Highlight selectors (text before {)
      result = result.replace(/([^{}:;]+?)(\{)/g, '<span class="cm-selector">$1</span>$2');

      // Highlight property: value pairs
      result = result.replace(/([\w-]+)(\s*:\s*)([^;{}]+)(;?)/g,
        '<span class="cm-property">$1</span>$2<span class="cm-value">$3</span>$4');

      return result;
    });

    return highlighted.join('\n');
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private applyOutput(output: string) {
    this.formattedOutput = output;
    this.lineCount = output.split('\n').length;
    this.outputBytes = new TextEncoder().encode(output).length;
    this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(this.highlight(output));
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  get savingsPercent(): number {
    if (!this.inputBytes || !this.outputBytes) return 0;
    return Math.round(((this.inputBytes - this.outputBytes) / this.inputBytes) * 100);
  }
}
