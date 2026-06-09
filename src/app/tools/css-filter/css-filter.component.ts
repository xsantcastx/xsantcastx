import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface FilterConfig {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

interface FilterPreset {
  name: string;
  icon: string;
  values: { [key: string]: number };
}

interface DropShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

@Component({
    selector: 'app-css-filter',
    templateUrl: './css-filter.component.html',
    styleUrls: ['./css-filter.component.css'],
    imports: [ToolsSharedModule]
})
export class CssFilterComponent {
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Filter Generator — blur, brightness, contrast, grayscale & more with live preview')}&url=${encodeURIComponent(SITE_URL + '/tools/css-filter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/css-filter')}`;

  codeCopied = false;
  showBeforeAfter = false;

  readonly filterConfigs: FilterConfig[] = [
    { key: 'blur',       label: 'Blur',        unit: 'px',   min: 0,   max: 20,   step: 0.1, default: 0   },
    { key: 'brightness', label: 'Brightness',   unit: '%',    min: 0,   max: 300,  step: 1,   default: 100 },
    { key: 'contrast',   label: 'Contrast',     unit: '%',    min: 0,   max: 300,  step: 1,   default: 100 },
    { key: 'grayscale',  label: 'Grayscale',    unit: '%',    min: 0,   max: 100,  step: 1,   default: 0   },
    { key: 'hueRotate',  label: 'Hue Rotate',   unit: 'deg',  min: 0,   max: 360,  step: 1,   default: 0   },
    { key: 'invert',     label: 'Invert',       unit: '%',    min: 0,   max: 100,  step: 1,   default: 0   },
    { key: 'opacity',    label: 'Opacity',      unit: '%',    min: 0,   max: 100,  step: 1,   default: 100 },
    { key: 'saturate',   label: 'Saturate',     unit: '%',    min: 0,   max: 300,  step: 1,   default: 100 },
    { key: 'sepia',      label: 'Sepia',        unit: '%',    min: 0,   max: 100,  step: 1,   default: 0   },
  ];

  filters: { [key: string]: number } = {};

  dropShadow: DropShadow = { x: 0, y: 0, blur: 0, color: '#00ffcc' };
  dropShadowEnabled = false;

  readonly presets: FilterPreset[] = [
    {
      name: 'Vintage',
      icon: '\uD83D\uDCF7',
      values: { blur: 0.3, brightness: 110, contrast: 85, grayscale: 20, hueRotate: 0, invert: 0, opacity: 100, saturate: 70, sepia: 40 }
    },
    {
      name: 'Noir',
      icon: '\uD83C\uDFAC',
      values: { blur: 0, brightness: 110, contrast: 130, grayscale: 100, hueRotate: 0, invert: 0, opacity: 100, saturate: 0, sepia: 0 }
    },
    {
      name: 'Warm',
      icon: '\u2600\uFE0F',
      values: { blur: 0, brightness: 105, contrast: 100, grayscale: 0, hueRotate: 10, invert: 0, opacity: 100, saturate: 130, sepia: 20 }
    },
    {
      name: 'Cool',
      icon: '\u2744\uFE0F',
      values: { blur: 0, brightness: 105, contrast: 100, grayscale: 0, hueRotate: 190, invert: 0, opacity: 100, saturate: 90, sepia: 10 }
    },
    {
      name: 'Dramatic',
      icon: '\uD83C\uDFAD',
      values: { blur: 0, brightness: 80, contrast: 160, grayscale: 0, hueRotate: 0, invert: 0, opacity: 100, saturate: 150, sepia: 0 }
    },
    {
      name: 'Faded',
      icon: '\uD83C\uDF2B\uFE0F',
      values: { blur: 0.5, brightness: 120, contrast: 80, grayscale: 10, hueRotate: 0, invert: 0, opacity: 90, saturate: 60, sepia: 15 }
    },
    {
      name: 'High Contrast',
      icon: '\u26A1',
      values: { blur: 0, brightness: 100, contrast: 200, grayscale: 0, hueRotate: 0, invert: 0, opacity: 100, saturate: 120, sepia: 0 }
    },
    {
      name: 'Negative',
      icon: '\uD83D\uDD04',
      values: { blur: 0, brightness: 100, contrast: 100, grayscale: 0, hueRotate: 180, invert: 100, opacity: 100, saturate: 100, sepia: 0 }
    }
  ];

  constructor(private router: Router, private translationService: TranslationService) {
    this.resetFilters();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  resetFilters(): void {
    for (const config of this.filterConfigs) {
      this.filters[config.key] = config.default;
    }
    this.dropShadow = { x: 0, y: 0, blur: 0, color: '#00ffcc' };
    this.dropShadowEnabled = false;
  }

  onFilterChange(key: string, event: Event): void {
    this.filters[key] = parseFloat((event.target as HTMLInputElement).value);
    this.checkEasterEgg();
  }

  onDropShadowChange(prop: keyof DropShadow, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (prop === 'color') {
      this.dropShadow.color = input.value;
    } else {
      (this.dropShadow as any)[prop] = parseFloat(input.value);
    }
  }

  applyPreset(preset: FilterPreset): void {
    for (const key of Object.keys(preset.values)) {
      this.filters[key] = preset.values[key];
    }
    this.dropShadowEnabled = false;
    this.dropShadow = { x: 0, y: 0, blur: 0, color: '#00ffcc' };
  }

  toggleBeforeAfter(): void {
    this.showBeforeAfter = !this.showBeforeAfter;
  }

  get filterStyle(): string {
    const parts: string[] = [];

    if (this.filters['blur'] !== 0)         parts.push(`blur(${this.filters['blur']}px)`);
    if (this.filters['brightness'] !== 100)  parts.push(`brightness(${this.filters['brightness']}%)`);
    if (this.filters['contrast'] !== 100)    parts.push(`contrast(${this.filters['contrast']}%)`);
    if (this.filters['grayscale'] !== 0)     parts.push(`grayscale(${this.filters['grayscale']}%)`);
    if (this.filters['hueRotate'] !== 0)     parts.push(`hue-rotate(${this.filters['hueRotate']}deg)`);
    if (this.filters['invert'] !== 0)        parts.push(`invert(${this.filters['invert']}%)`);
    if (this.filters['opacity'] !== 100)     parts.push(`opacity(${this.filters['opacity']}%)`);
    if (this.filters['saturate'] !== 100)    parts.push(`saturate(${this.filters['saturate']}%)`);
    if (this.filters['sepia'] !== 0)         parts.push(`sepia(${this.filters['sepia']}%)`);

    if (this.dropShadowEnabled) {
      parts.push(`drop-shadow(${this.dropShadow.x}px ${this.dropShadow.y}px ${this.dropShadow.blur}px ${this.dropShadow.color})`);
    }

    return parts.length > 0 ? parts.join(' ') : 'none';
  }

  get cssCode(): string {
    const filterValue = this.filterStyle;
    if (filterValue === 'none') {
      return 'filter: none;';
    }
    return `filter: ${filterValue};\n-webkit-filter: ${filterValue};`;
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  getFilterDisplayValue(config: FilterConfig): string {
    return `${this.filters[config.key]}${config.unit}`;
  }

  isFilterModified(config: FilterConfig): boolean {
    return this.filters[config.key] !== config.default;
  }

  get hasAnyFilter(): boolean {
    return this.filterStyle !== 'none';
  }

  trackByKey(_index: number, config: FilterConfig): string {
    return config.key;
  }

  trackByPresetName(_index: number, preset: FilterPreset): string {
    return preset.name;
  }

  private checkEasterEgg(): void {
    const allMaxed =
      this.filters['blur'] >= 20 &&
      this.filters['brightness'] >= 300 &&
      this.filters['contrast'] >= 300 &&
      this.filters['grayscale'] >= 100 &&
      this.filters['hueRotate'] >= 360 &&
      this.filters['invert'] >= 100 &&
      this.filters['opacity'] >= 100 &&
      this.filters['saturate'] >= 300 &&
      this.filters['sepia'] >= 100;

    if (allMaxed) {
      this.eggs.trigger('filter-chaos');
    }
  }
}
