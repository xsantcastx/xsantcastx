import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

export interface CssVariable {
  id: string;
  name: string;
  value: string;
  category: VariableCategory;
}

export type VariableCategory = 'colors' | 'spacing' | 'typography' | 'borders' | 'shadows';
export type ExportFormat = 'css' | 'scss' | 'json' | 'tailwind';

const CATEGORY_LABELS: Record<VariableCategory, string> = {
  colors: 'Colors',
  spacing: 'Spacing',
  typography: 'Typography',
  borders: 'Borders',
  shadows: 'Shadows',
};

const SAMPLE_VARIABLES: CssVariable[] = [
  { id: 's1', name: 'primary', value: '#00ffcc', category: 'colors' },
  { id: 's2', name: 'secondary', value: '#7b61ff', category: 'colors' },
  { id: 's3', name: 'bg-dark', value: '#0a0e1a', category: 'colors' },
  { id: 's4', name: 'text-main', value: '#d6ddeb', category: 'colors' },
  { id: 's5', name: 'danger', value: '#ff4d6a', category: 'colors' },
  { id: 's6', name: 'spacing-xs', value: '0.25rem', category: 'spacing' },
  { id: 's7', name: 'spacing-sm', value: '0.5rem', category: 'spacing' },
  { id: 's8', name: 'spacing-md', value: '1rem', category: 'spacing' },
  { id: 's9', name: 'spacing-lg', value: '2rem', category: 'spacing' },
  { id: 's10', name: 'spacing-xl', value: '4rem', category: 'spacing' },
  { id: 's11', name: 'font-body', value: "'Inter', sans-serif", category: 'typography' },
  { id: 's12', name: 'font-heading', value: "'Space Grotesk', sans-serif", category: 'typography' },
  { id: 's13', name: 'font-mono', value: "'Fira Code', monospace", category: 'typography' },
  { id: 's14', name: 'font-size-sm', value: '0.875rem', category: 'typography' },
  { id: 's15', name: 'font-size-base', value: '1rem', category: 'typography' },
  { id: 's16', name: 'radius-sm', value: '4px', category: 'borders' },
  { id: 's17', name: 'radius-md', value: '8px', category: 'borders' },
  { id: 's18', name: 'radius-lg', value: '16px', category: 'borders' },
  { id: 's19', name: 'border-default', value: '1px solid rgba(255,255,255,0.08)', category: 'borders' },
  { id: 's20', name: 'shadow-soft', value: '0 2px 12px rgba(0,0,0,0.4)', category: 'shadows' },
  { id: 's21', name: 'shadow-glow', value: '0 0 20px rgba(0,255,204,0.15)', category: 'shadows' },
];

@Component({
  selector: 'app-css-variables',
  templateUrl: './css-variables.component.html',
  styleUrls: ['./css-variables.component.css'],
  standalone: false
})
export class CssVariablesComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private idCounter = 0;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('CSS Custom Properties Generator — build a design system with live preview, export to CSS/SCSS/JSON/Tailwind')}&url=${encodeURIComponent(SITE_URL + '/tools/css-variables')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/css-variables')}`;

  readonly categories: VariableCategory[] = ['colors', 'spacing', 'typography', 'borders', 'shadows'];
  readonly categoryLabels = CATEGORY_LABELS;
  readonly categoryIcons: Record<VariableCategory, string> = {
    colors: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    spacing: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
    typography: 'M4 7V4h16v3M9 20h6M12 4v16',
    borders: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18',
    shadows: 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 16.89 19.32C18.57 17.65 19.15 15.11 18.16 12.93L17.96 12.5C17.88 12.35 17.78 12.19 17.66 11.2z',
  };

  variables: CssVariable[] = [];
  activeCategory: VariableCategory = 'colors';
  exportFormat: ExportFormat = 'css';

  // Add form state
  newName = '';
  newValue = '';
  newCategory: VariableCategory = 'colors';

  // Edit state
  editingId: string | null = null;
  editName = '';
  editValue = '';

  // Import state
  showImport = false;
  importText = '';
  importCount = 0;

  // Output
  generatedOutput = '';
  copied = false;
  previewCopied = false;

  private easterEggTriggered = false;

  constructor(private router: Router) {
    this.generateOutput();
  }

  ngOnDestroy() {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Category helpers ──────────────────────────────────────────

  get filteredVariables(): CssVariable[] {
    return this.variables.filter(v => v.category === this.activeCategory);
  }

  getCategoryCount(cat: VariableCategory): number {
    return this.variables.filter(v => v.category === cat).length;
  }

  setActiveCategory(cat: VariableCategory) {
    this.activeCategory = cat;
    this.newCategory = cat;
  }

  // ── Add variable ──────────────────────────────────────────────

  addVariable() {
    const name = this.newName.trim();
    const value = this.newValue.trim();
    if (!name || !value) return;

    this.variables.push({
      id: this.nextId(),
      name: this.sanitizeName(name),
      value,
      category: this.newCategory,
    });

    this.newName = '';
    this.newValue = '';
    this.activeCategory = this.newCategory;
    this.generateOutput();
    this.checkEasterEgg();
  }

  removeVariable(id: string) {
    this.variables = this.variables.filter(v => v.id !== id);
    this.generateOutput();
  }

  // ── Edit variable ─────────────────────────────────────────────

  startEdit(v: CssVariable) {
    this.editingId = v.id;
    this.editName = v.name;
    this.editValue = v.value;
  }

  saveEdit(id: string) {
    const v = this.variables.find(x => x.id === id);
    if (v) {
      v.name = this.sanitizeName(this.editName.trim());
      v.value = this.editValue.trim();
    }
    this.editingId = null;
    this.generateOutput();
  }

  cancelEdit() {
    this.editingId = null;
  }

  // ── Load sample ───────────────────────────────────────────────

  loadSample() {
    this.variables = SAMPLE_VARIABLES.map(v => ({ ...v, id: this.nextId() }));
    this.generateOutput();
    this.checkEasterEgg();
  }

  clearAll() {
    this.variables = [];
    this.generatedOutput = '';
    this.easterEggTriggered = false;
  }

  // ── Import from CSS ───────────────────────────────────────────

  toggleImport() {
    this.showImport = !this.showImport;
    this.importText = '';
    this.importCount = 0;
  }

  parseImport() {
    if (!this.importText.trim()) return;
    const regex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = regex.exec(this.importText)) !== null) {
      const name = match[1].trim();
      const value = match[2].trim();
      const category = this.guessCategory(name, value);
      this.variables.push({
        id: this.nextId(),
        name,
        value,
        category,
      });
      count++;
    }

    this.importCount = count;
    if (count > 0) {
      this.generateOutput();
      this.checkEasterEgg();
    }
  }

  clearImport() {
    this.importText = '';
    this.importCount = 0;
  }

  // ── Export / Generate ─────────────────────────────────────────

  setExportFormat(fmt: ExportFormat) {
    this.exportFormat = fmt;
    this.generateOutput();
  }

  generateOutput() {
    if (this.variables.length === 0) {
      this.generatedOutput = '';
      return;
    }

    switch (this.exportFormat) {
      case 'css':
        this.generatedOutput = this.generateCSS();
        break;
      case 'scss':
        this.generatedOutput = this.generateSCSS();
        break;
      case 'json':
        this.generatedOutput = this.generateJSON();
        break;
      case 'tailwind':
        this.generatedOutput = this.generateTailwind();
        break;
    }
  }

  private generateCSS(): string {
    const lines: string[] = [':root {'];
    for (const cat of this.categories) {
      const vars = this.variables.filter(v => v.category === cat);
      if (vars.length === 0) continue;
      lines.push(`  /* ${CATEGORY_LABELS[cat]} */`);
      for (const v of vars) {
        lines.push(`  --cv-${v.name}: ${v.value};`);
      }
      lines.push('');
    }
    // Remove trailing blank line before closing brace
    if (lines[lines.length - 1] === '') lines.pop();
    lines.push('}');
    return lines.join('\n');
  }

  private generateSCSS(): string {
    const lines: string[] = [];
    for (const cat of this.categories) {
      const vars = this.variables.filter(v => v.category === cat);
      if (vars.length === 0) continue;
      lines.push(`// ${CATEGORY_LABELS[cat]}`);
      for (const v of vars) {
        lines.push(`$cv-${v.name}: ${v.value};`);
      }
      lines.push('');
    }
    if (lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
  }

  private generateJSON(): string {
    const obj: Record<string, Record<string, string>> = {};
    for (const cat of this.categories) {
      const vars = this.variables.filter(v => v.category === cat);
      if (vars.length === 0) continue;
      obj[cat] = {};
      for (const v of vars) {
        obj[cat][`cv-${v.name}`] = v.value;
      }
    }
    return JSON.stringify(obj, null, 2);
  }

  private generateTailwind(): string {
    const lines: string[] = [
      '// tailwind.config.js',
      'module.exports = {',
      '  theme: {',
      '    extend: {',
    ];

    const colorVars = this.variables.filter(v => v.category === 'colors');
    const spacingVars = this.variables.filter(v => v.category === 'spacing');
    const typographyVars = this.variables.filter(v => v.category === 'typography');
    const borderVars = this.variables.filter(v => v.category === 'borders');
    const shadowVars = this.variables.filter(v => v.category === 'shadows');

    if (colorVars.length) {
      lines.push('      colors: {');
      for (const v of colorVars) {
        lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
      }
      lines.push('      },');
    }

    if (spacingVars.length) {
      lines.push('      spacing: {');
      for (const v of spacingVars) {
        lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
      }
      lines.push('      },');
    }

    if (typographyVars.length) {
      lines.push('      fontFamily: {');
      for (const v of typographyVars) {
        if (v.name.includes('font') && !v.name.includes('size')) {
          lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
        }
      }
      lines.push('      },');
      lines.push('      fontSize: {');
      for (const v of typographyVars) {
        if (v.name.includes('size')) {
          lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
        }
      }
      lines.push('      },');
    }

    if (borderVars.length) {
      lines.push('      borderRadius: {');
      for (const v of borderVars) {
        if (v.name.includes('radius')) {
          lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
        }
      }
      lines.push('      },');
    }

    if (shadowVars.length) {
      lines.push('      boxShadow: {');
      for (const v of shadowVars) {
        lines.push(`        '${v.name}': 'var(--cv-${v.name})',`);
      }
      lines.push('      },');
    }

    lines.push('    },');
    lines.push('  },');
    lines.push('};');
    return lines.join('\n');
  }

  // ── Copy ──────────────────────────────────────────────────────

  async copyOutput() {
    if (!this.generatedOutput || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedOutput);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedOutput);
    }
  }

  async copyPreviewCSS() {
    if (!this.isBrowser || this.variables.length === 0) return;
    const css = this.generateCSS();
    try {
      await navigator.clipboard.writeText(css);
      this.previewCopied = true;
      setTimeout(() => (this.previewCopied = false), 2000);
    } catch {
      this.fallbackCopy(css);
      this.previewCopied = true;
      setTimeout(() => (this.previewCopied = false), 2000);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
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

  // ── Download ──────────────────────────────────────────────────

  downloadOutput() {
    if (!this.generatedOutput || !this.isBrowser) return;
    const extMap: Record<ExportFormat, string> = {
      css: 'css',
      scss: 'scss',
      json: 'json',
      tailwind: 'js',
    };
    const ext = extMap[this.exportFormat];
    const blob = new Blob([this.generatedOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-tokens.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Preview helpers ───────────────────────────────────────────

  getPreviewStyles(): Record<string, string> {
    const styles: Record<string, string> = {};
    for (const v of this.variables) {
      styles[`--cv-${v.name}`] = v.value;
    }
    return styles;
  }

  getColorValue(name: string): string {
    const v = this.variables.find(x => x.category === 'colors' && x.name === name);
    return v ? v.value : '';
  }

  get previewBg(): string {
    return this.getColorValue('bg-dark') || this.getColorValue('background') || '#0a0e1a';
  }

  get previewText(): string {
    return this.getColorValue('text-main') || this.getColorValue('text') || '#d6ddeb';
  }

  get previewPrimary(): string {
    return this.getColorValue('primary') || '#00ffcc';
  }

  get previewSecondary(): string {
    return this.getColorValue('secondary') || '#7b61ff';
  }

  get previewRadius(): string {
    const v = this.variables.find(x => x.name.includes('radius-md') || x.name.includes('radius'));
    return v ? v.value : '8px';
  }

  get previewShadow(): string {
    const v = this.variables.find(x => x.category === 'shadows');
    return v ? v.value : '0 2px 12px rgba(0,0,0,0.4)';
  }

  get previewFont(): string {
    const v = this.variables.find(x => x.name.includes('font-body') || x.name.includes('font-family'));
    return v ? v.value : "'Inter', sans-serif";
  }

  get previewSpacing(): string {
    const v = this.variables.find(x => x.name.includes('spacing-md') || x.name.includes('spacing'));
    return v ? v.value : '1rem';
  }

  isColorValue(value: string): boolean {
    return /^(#|rgb|hsl|oklch|lch|lab|color\(|transparent|currentColor)/i.test(value.trim());
  }

  // ── Internal helpers ──────────────────────────────────────────

  private nextId(): string {
    return `cv_${++this.idCounter}_${Date.now()}`;
  }

  private sanitizeName(name: string): string {
    // Strip leading -- or cv- prefix if user typed it
    let clean = name.replace(/^--/, '').replace(/^cv-/, '');
    // Replace spaces/invalid chars with hyphens
    clean = clean.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return clean.toLowerCase();
  }

  private guessCategory(name: string, value: string): VariableCategory {
    const n = name.toLowerCase();
    const v = value.toLowerCase();

    if (this.isColorValue(value) || n.includes('color') || n.includes('bg') || n.includes('text') || n.includes('accent') || n.includes('primary') || n.includes('secondary') || n.includes('danger') || n.includes('warning') || n.includes('success')) {
      return 'colors';
    }
    if (n.includes('shadow') || n.includes('elevation')) return 'shadows';
    if (n.includes('radius') || n.includes('border') || n.includes('outline') || n.includes('stroke')) return 'borders';
    if (n.includes('font') || n.includes('text-size') || n.includes('line-height') || n.includes('letter') || n.includes('weight') || n.includes('type')) return 'typography';
    if (n.includes('space') || n.includes('gap') || n.includes('pad') || n.includes('margin') || n.includes('size') || v.includes('rem') || v.includes('px') || v.includes('em')) return 'spacing';

    return 'colors';
  }

  private checkEasterEgg() {
    if (!this.easterEggTriggered && this.variables.length >= 20) {
      this.easterEggTriggered = true;
      this.eggs.trigger('css-var-system');
    }
  }
}
