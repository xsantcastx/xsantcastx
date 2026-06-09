import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type ExportFormat = 'css' | 'tailwind' | 'scss';
type HarmonyType = 'complementary' | 'split-complementary' | 'triadic' | 'tetradic';

interface ColorSwatch {
  hex: string;
  rgb: string;
  label: string;
}

@Component({
    selector: 'app-color-shades',
    templateUrl: './color-shades.component.html',
    styleUrls: ['./color-shades.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class ColorShadesComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Color Shades & Tones Generator — tints, shades, tones, harmonies. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/color-shades')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/color-shades')}`;

  // Input
  colorInput = '#6c5ce7';

  // Generated palettes
  tints: ColorSwatch[] = [];
  shades: ColorSwatch[] = [];
  tones: ColorSwatch[] = [];
  harmonies: { type: HarmonyType; label: string; colors: ColorSwatch[] }[] = [];

  // Export
  exportFormat: ExportFormat = 'css';
  copiedId = '';

  // State
  generated = false;

  constructor(private router: Router) {
    this.generate();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Generation ──────────────────────────────────────────────────────

  generate() {
    const hex = this.normalizeHex(this.colorInput);
    if (!hex) return;

    this.colorInput = hex;
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;

    // Easter egg: pure white
    if (hex.toLowerCase() === '#ffffff') {
      this.eggs.trigger('shades-blank');
    }

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    // 10 tints (mix with white)
    this.tints = [];
    for (let i = 1; i <= 10; i++) {
      const factor = i / 11;
      const r = Math.round(rgb.r + (255 - rgb.r) * factor);
      const g = Math.round(rgb.g + (255 - rgb.g) * factor);
      const b = Math.round(rgb.b + (255 - rgb.b) * factor);
      this.tints.push(this.makeSwatch(r, g, b, `Tint ${i * 10}%`));
    }

    // 10 shades (mix with black)
    this.shades = [];
    for (let i = 1; i <= 10; i++) {
      const factor = i / 11;
      const r = Math.round(rgb.r * (1 - factor));
      const g = Math.round(rgb.g * (1 - factor));
      const b = Math.round(rgb.b * (1 - factor));
      this.shades.push(this.makeSwatch(r, g, b, `Shade ${i * 10}%`));
    }

    // 10 tones (mix with gray)
    this.tones = [];
    for (let i = 1; i <= 10; i++) {
      const factor = i / 11;
      const r = Math.round(rgb.r + (128 - rgb.r) * factor);
      const g = Math.round(rgb.g + (128 - rgb.g) * factor);
      const b = Math.round(rgb.b + (128 - rgb.b) * factor);
      this.tones.push(this.makeSwatch(r, g, b, `Tone ${i * 10}%`));
    }

    // Harmonies
    this.harmonies = [
      {
        type: 'complementary',
        label: 'Complementary',
        colors: this.harmonyFromAngles(hsl, [180])
      },
      {
        type: 'split-complementary',
        label: 'Split-Complementary',
        colors: this.harmonyFromAngles(hsl, [150, 210])
      },
      {
        type: 'triadic',
        label: 'Triadic',
        colors: this.harmonyFromAngles(hsl, [120, 240])
      },
      {
        type: 'tetradic',
        label: 'Tetradic',
        colors: this.harmonyFromAngles(hsl, [90, 180, 270])
      }
    ];

    this.generated = true;
  }

  onColorInput() {
    const hex = this.normalizeHex(this.colorInput);
    if (hex) this.generate();
  }

  // ── Copy ────────────────────────────────────────────────────────────

  async copySwatch(swatch: ColorSwatch, id: string) {
    if (!this.isBrowser) return;
    await this.copyText(swatch.hex, id);
  }

  async copyPalette(section: string, swatches: ColorSwatch[]) {
    if (!this.isBrowser) return;
    const text = this.formatExport(section, swatches);
    await this.copyText(text, 'palette-' + section);
  }

  async copyAllPalettes() {
    if (!this.isBrowser) return;
    let output = '';
    output += this.formatExport('tints', this.tints) + '\n\n';
    output += this.formatExport('shades', this.shades) + '\n\n';
    output += this.formatExport('tones', this.tones) + '\n\n';
    for (const h of this.harmonies) {
      output += this.formatExport(h.type, h.colors) + '\n\n';
    }
    await this.copyText(output.trim(), 'all');
  }

  private async copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedId = id;
      setTimeout(() => (this.copiedId = ''), 2000);
    } catch {
      this.fallbackCopy(text, id);
    }
  }

  private fallbackCopy(text: string, id: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedId = id;
    setTimeout(() => (this.copiedId = ''), 2000);
  }

  // ── Export formatting ───────────────────────────────────────────────

  formatExport(section: string, swatches: ColorSwatch[]): string {
    const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    switch (this.exportFormat) {
      case 'css': {
        const vars = swatches.map((s, i) =>
          `  --color-${slug}-${(i + 1) * 100}: ${s.hex};`
        ).join('\n');
        return `:root {\n${vars}\n}`;
      }
      case 'tailwind': {
        const entries = swatches.map((s, i) =>
          `  '${(i + 1) * 100}': '${s.hex}',`
        ).join('\n');
        return `'${slug}': {\n${entries}\n},`;
      }
      case 'scss': {
        return swatches.map((s, i) =>
          `$color-${slug}-${(i + 1) * 100}: ${s.hex};`
        ).join('\n');
      }
      default:
        return '';
    }
  }

  // ── Color math helpers ──────────────────────────────────────────────

  private normalizeHex(input: string): string | null {
    let hex = input.trim().replace(/^#/, '');

    // 3-char shorthand
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return '#' + hex.toLowerCase();
    }

    return null;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return null;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('');
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s, l };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  private makeSwatch(r: number, g: number, b: number, label: string): ColorSwatch {
    return {
      hex: this.rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      label
    };
  }

  private harmonyFromAngles(hsl: { h: number; s: number; l: number }, angles: number[]): ColorSwatch[] {
    // Include the base color first
    const base = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    const swatches: ColorSwatch[] = [this.makeSwatch(base.r, base.g, base.b, `Base`)];

    angles.forEach((angle, i) => {
      const newH = (hsl.h + angle) % 360;
      const rgb = this.hslToRgb(newH, hsl.s, hsl.l);
      swatches.push(this.makeSwatch(rgb.r, rgb.g, rgb.b, `+${angle}\u00B0`));
    });

    return swatches;
  }

  // ── Text contrast helper for swatches ───────────────────────────────

  textColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#ffffff';
    // Relative luminance
    const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    return lum > 140 ? '#0a0a0f' : '#ffffff';
  }
}
