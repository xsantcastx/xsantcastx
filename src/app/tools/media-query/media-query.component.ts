import { Component, inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface MediaFeature {
  feature: string;
  label: string;
  type: 'range' | 'enum';
  options?: string[];
  unit?: string;
  supportsMinMax: boolean;
}

export interface QueryRule {
  id: number;
  feature: string;
  useMin: boolean;
  useMax: boolean;
  value: string;
  minValue: string;
  maxValue: string;
}

export interface BreakpointPreset {
  name: string;
  query: string;
}

export interface PresetGroup {
  name: string;
  presets: BreakpointPreset[];
}

@Component({
  selector: 'app-media-query',
  templateUrl: './media-query.component.html',
  styleUrls: ['./media-query.component.css'],
  standalone: false
})
export class MediaQueryComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private resizeListener: (() => void) | null = null;

  // Media type
  mediaType: 'screen' | 'print' | 'all' = 'all';

  // Combinator
  combinator: 'and' | 'or' = 'and';

  // Rules
  private nextId = 1;
  rules: QueryRule[] = [];

  // Features
  readonly features: MediaFeature[] = [
    { feature: 'width', label: 'Width', type: 'range', unit: 'px', supportsMinMax: true },
    { feature: 'height', label: 'Height', type: 'range', unit: 'px', supportsMinMax: true },
    { feature: 'orientation', label: 'Orientation', type: 'enum', options: ['portrait', 'landscape'], supportsMinMax: false },
    { feature: 'resolution', label: 'Resolution', type: 'range', unit: 'dpi', supportsMinMax: true },
    { feature: 'prefers-color-scheme', label: 'Color Scheme', type: 'enum', options: ['light', 'dark'], supportsMinMax: false },
    { feature: 'prefers-reduced-motion', label: 'Reduced Motion', type: 'enum', options: ['no-preference', 'reduce'], supportsMinMax: false },
    { feature: 'hover', label: 'Hover', type: 'enum', options: ['none', 'hover'], supportsMinMax: false },
    { feature: 'pointer', label: 'Pointer', type: 'enum', options: ['none', 'coarse', 'fine'], supportsMinMax: false }
  ];

  // Presets
  readonly presetGroups: PresetGroup[] = [
    {
      name: 'Bootstrap',
      presets: [
        { name: 'XS (< 576px)', query: '@media (max-width: 575.98px)' },
        { name: 'SM (>= 576px)', query: '@media (min-width: 576px)' },
        { name: 'MD (>= 768px)', query: '@media (min-width: 768px)' },
        { name: 'LG (>= 992px)', query: '@media (min-width: 992px)' },
        { name: 'XL (>= 1200px)', query: '@media (min-width: 1200px)' },
        { name: 'XXL (>= 1400px)', query: '@media (min-width: 1400px)' }
      ]
    },
    {
      name: 'Tailwind',
      presets: [
        { name: 'sm (>= 640px)', query: '@media (min-width: 640px)' },
        { name: 'md (>= 768px)', query: '@media (min-width: 768px)' },
        { name: 'lg (>= 1024px)', query: '@media (min-width: 1024px)' },
        { name: 'xl (>= 1280px)', query: '@media (min-width: 1280px)' },
        { name: '2xl (>= 1536px)', query: '@media (min-width: 1536px)' }
      ]
    },
    {
      name: 'Common',
      presets: [
        { name: 'Mobile', query: '@media (max-width: 480px)' },
        { name: 'Tablet', query: '@media (min-width: 481px) and (max-width: 1024px)' },
        { name: 'Desktop', query: '@media (min-width: 1025px)' },
        { name: 'Retina', query: '@media (min-resolution: 192dpi)' },
        { name: 'Print', query: '@media print' },
        { name: 'Dark Mode', query: '@media (prefers-color-scheme: dark)' },
        { name: 'Reduced Motion', query: '@media (prefers-reduced-motion: reduce)' },
        { name: 'Touch Device', query: '@media (hover: none) and (pointer: coarse)' }
      ]
    }
  ];

  // Active breakpoint detection
  activePresets: Set<string> = new Set();

  // Output
  generatedQuery = '';
  generatedCSS = '';
  copied = false;
  copiedCSS = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.addRule();
    this.generate();
    if (this.isBrowser) {
      this.detectActiveBreakpoints();
      this.resizeListener = () => this.detectActiveBreakpoints();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy() {
    if (this.isBrowser && this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Rules ─────────────────────────────────────────────────────

  addRule() {
    this.rules.push({
      id: this.nextId++,
      feature: 'width',
      useMin: true,
      useMax: false,
      value: '',
      minValue: '',
      maxValue: ''
    });
    this.generate();
  }

  removeRule(id: number) {
    this.rules = this.rules.filter(r => r.id !== id);
    this.generate();
  }

  getFeatureDef(featureName: string): MediaFeature {
    return this.features.find(f => f.feature === featureName) || this.features[0];
  }

  onFeatureChange(rule: QueryRule) {
    const def = this.getFeatureDef(rule.feature);
    if (!def.supportsMinMax) {
      rule.useMin = false;
      rule.useMax = false;
    }
    rule.value = def.options ? def.options[0] : '';
    rule.minValue = '';
    rule.maxValue = '';
    this.generate();
  }

  onRuleChange() {
    this.generate();
  }

  // ── Generation ────────────────────────────────────────────────

  generate() {
    const parts: string[] = [];

    for (const rule of this.rules) {
      const def = this.getFeatureDef(rule.feature);

      if (def.type === 'enum') {
        if (rule.value) {
          parts.push(`(${rule.feature}: ${rule.value})`);
        }
      } else {
        // range type
        const unit = def.unit || '';
        if (rule.useMin && rule.minValue) {
          parts.push(`(min-${rule.feature}: ${rule.minValue}${unit})`);
        }
        if (rule.useMax && rule.maxValue) {
          parts.push(`(max-${rule.feature}: ${rule.maxValue}${unit})`);
        }
        if (!rule.useMin && !rule.useMax && rule.value) {
          parts.push(`(${rule.feature}: ${rule.value}${unit})`);
        }
      }
    }

    const joiner = this.combinator === 'and' ? ' and ' : ', ';

    if (parts.length === 0) {
      if (this.mediaType === 'all') {
        this.generatedQuery = '@media all';
      } else {
        this.generatedQuery = `@media ${this.mediaType}`;
      }
    } else {
      if (this.mediaType === 'all') {
        this.generatedQuery = `@media ${parts.join(joiner)}`;
      } else {
        if (this.combinator === 'or') {
          this.generatedQuery = `@media ${this.mediaType} and ${parts.join(joiner)}`;
        } else {
          this.generatedQuery = `@media ${this.mediaType} and ${parts.join(joiner)}`;
        }
      }
    }

    this.generatedCSS =
`${this.generatedQuery} {
  /* Your styles here */
}`;

    // Easter egg: print media
    if (this.mediaType === 'print') {
      this.eggs.trigger('mq-print');
    }

    if (this.isBrowser) {
      this.detectActiveBreakpoints();
    }
  }

  // ── Presets ───────────────────────────────────────────────────

  applyPreset(preset: BreakpointPreset) {
    this.generatedQuery = preset.query;
    this.generatedCSS =
`${preset.query} {
  /* Your styles here */
}`;

    // Parse preset back to detect print
    if (preset.query.includes('@media print')) {
      this.mediaType = 'print';
      this.eggs.trigger('mq-print');
    }
  }

  // ── Active breakpoint detection ───────────────────────────────

  detectActiveBreakpoints() {
    if (!this.isBrowser) return;
    this.activePresets.clear();

    for (const group of this.presetGroups) {
      for (const preset of group.presets) {
        try {
          // Extract the query portion after @media
          const raw = preset.query.replace(/^@media\s*/, '');
          if (window.matchMedia(raw).matches) {
            this.activePresets.add(preset.name);
          }
        } catch {
          // skip invalid queries for matchMedia
        }
      }
    }
  }

  isPresetActive(name: string): boolean {
    return this.activePresets.has(name);
  }

  // ── Copy ──────────────────────────────────────────────────────

  async copyQuery() {
    if (!this.generatedQuery || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedQuery);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedQuery, 'query');
    }
  }

  async copyCSS() {
    if (!this.generatedCSS || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedCSS);
      this.copiedCSS = true;
      setTimeout(() => (this.copiedCSS = false), 2000);
    } catch {
      this.fallbackCopy(this.generatedCSS, 'css');
    }
  }

  trackRule(index: number, rule: QueryRule): number {
    return rule.id;
  }

  private fallbackCopy(text: string, type: 'query' | 'css') {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (type === 'query') {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } else {
      this.copiedCSS = true;
      setTimeout(() => (this.copiedCSS = false), 2000);
    }
  }
}
