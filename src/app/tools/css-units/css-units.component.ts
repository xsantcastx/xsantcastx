import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface UnitResult {
  unit: string;
  value: number;
  label: string;
  copied: boolean;
}

interface SpacingRow {
  px: number;
  rem: string;
}

@Component({
    selector: 'app-css-units',
    templateUrl: './css-units.component.html',
    styleUrls: ['./css-units.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class CssUnitsComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Units Converter — convert between px, rem, em, %, vw, vh, pt, cm, mm, in. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/css-units')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/css-units')}`;

  // Input
  inputValue: number | null = 16;
  inputUnit = 'px';

  // Settings
  baseFontSize = 16;
  viewportWidth = 1920;
  viewportHeight = 1080;

  // Results
  results: UnitResult[] = [];

  // Spacing scale
  readonly spacingScale: SpacingRow[] = [
    { px: 4,  rem: '0.25' },
    { px: 8,  rem: '0.5' },
    { px: 12, rem: '0.75' },
    { px: 16, rem: '1' },
    { px: 24, rem: '1.5' },
    { px: 32, rem: '2' },
    { px: 48, rem: '3' },
    { px: 64, rem: '4' },
    { px: 96, rem: '6' }
  ];

  // Unit options
  readonly units = [
    { value: 'px',  label: 'Pixels (px)' },
    { value: 'rem', label: 'Root Em (rem)' },
    { value: 'em',  label: 'Em (em)' },
    { value: '%',   label: 'Percent (%)' },
    { value: 'vw',  label: 'Viewport Width (vw)' },
    { value: 'vh',  label: 'Viewport Height (vh)' },
    { value: 'pt',  label: 'Points (pt)' },
    { value: 'cm',  label: 'Centimeters (cm)' },
    { value: 'mm',  label: 'Millimeters (mm)' },
    { value: 'in',  label: 'Inches (in)' }
  ];

  // Reference table
  readonly referenceTable = [
    { unit: '1px',   equiv: '1/96 of 1in' },
    { unit: '1rem',  equiv: 'Equal to font-size of root element (default 16px)' },
    { unit: '1em',   equiv: 'Equal to font-size of parent element' },
    { unit: '1%',    equiv: 'Relative to parent element size' },
    { unit: '1vw',   equiv: '1% of viewport width' },
    { unit: '1vh',   equiv: '1% of viewport height' },
    { unit: '1pt',   equiv: '1/72 of 1in (print)' },
    { unit: '1cm',   equiv: '~37.8px' },
    { unit: '1mm',   equiv: '~3.78px' },
    { unit: '1in',   equiv: '96px (CSS reference pixel)' }
  ];

  constructor(private router: Router) {
    this.convert();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Conversion ──────────────────────────────────────────────────────────────

  onInputChange() {
    if (this.inputValue === 0) {
      this.eggs.trigger('css-zero');
    }
    this.convert();
  }

  onSettingsChange() {
    this.convert();
  }

  convert() {
    if (this.inputValue === null || this.inputValue === undefined) {
      this.results = [];
      return;
    }

    const px = this.toPx(this.inputValue, this.inputUnit);
    this.results = this.units.map(u => ({
      unit: u.value,
      value: this.fromPx(px, u.value),
      label: u.label,
      copied: false
    }));
  }

  /** Convert any unit to px */
  private toPx(value: number, unit: string): number {
    const base = this.baseFontSize || 16;
    const vw = this.viewportWidth || 1920;
    const vh = this.viewportHeight || 1080;

    switch (unit) {
      case 'px':  return value;
      case 'rem': return value * base;
      case 'em':  return value * base;
      case '%':   return (value / 100) * base;
      case 'vw':  return (value / 100) * vw;
      case 'vh':  return (value / 100) * vh;
      case 'pt':  return value * (96 / 72);
      case 'cm':  return value * (96 / 2.54);
      case 'mm':  return value * (96 / 25.4);
      case 'in':  return value * 96;
      default:    return value;
    }
  }

  /** Convert px to any unit */
  private fromPx(px: number, unit: string): number {
    const base = this.baseFontSize || 16;
    const vw = this.viewportWidth || 1920;
    const vh = this.viewportHeight || 1080;

    switch (unit) {
      case 'px':  return px;
      case 'rem': return px / base;
      case 'em':  return px / base;
      case '%':   return (px / base) * 100;
      case 'vw':  return (px / vw) * 100;
      case 'vh':  return (px / vh) * 100;
      case 'pt':  return px * (72 / 96);
      case 'cm':  return px * (2.54 / 96);
      case 'mm':  return px * (25.4 / 96);
      case 'in':  return px / 96;
      default:    return px;
    }
  }

  // ── Formatting ──────────────────────────────────────────────────────────────

  formatValue(value: number): string {
    if (value === 0) return '0';
    if (Number.isInteger(value)) return value.toString();
    // Show up to 6 decimal places, trimming trailing zeros
    return parseFloat(value.toFixed(6)).toString();
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async copyResult(result: UnitResult) {
    if (!this.isBrowser) return;
    const text = `${this.formatValue(result.value)}${result.unit}`;
    try {
      await navigator.clipboard.writeText(text);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    } catch {
      this.fallbackCopy(text);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    }
  }

  async copySpacing(px: number, rem: string) {
    if (!this.isBrowser) return;
    const text = `${px}px / ${rem}rem`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.fallbackCopy(text);
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
  }
}
