import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }
interface HSB { h: number; s: number; b: number; }
interface CMYK { c: number; m: number; y: number; k: number; }

interface ColorFormats {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  hsb: HSB;
  cmyk: CMYK;
}

interface ColorHarmony {
  name: string;
  colors: string[];
}

@Component({
  selector: 'app-color-converter',
  templateUrl: './color-converter.component.html',
  styleUrls: ['./color-converter.component.css'],
  standalone: false
})
export class ColorConverterComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Color Converter — HEX, RGB, HSL, HSB, CMYK with harmonies & tints. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/color-converter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/color-converter')}`;

  // Input
  hexInput = '#00FFCC';
  rgbInput = '';
  hslInput = '';
  hsbInput = '';
  cmykInput = '';
  activeInput: 'hex' | 'rgb' | 'hsl' | 'hsb' | 'cmyk' = 'hex';

  // Parsed color
  formats: ColorFormats = {
    hex: '#00FFCC',
    rgb: { r: 0, g: 255, b: 204 },
    hsl: { h: 168, s: 100, l: 50 },
    hsb: { h: 168, s: 100, b: 100 },
    cmyk: { c: 100, m: 0, y: 20, k: 0 }
  };

  // Harmonies
  harmonies: ColorHarmony[] = [];

  // Tints & shades
  tints: string[] = [];
  shades: string[] = [];

  // UI state
  errorMessage = '';
  copiedField = '';

  constructor(private router: Router) {
    this.updateFromHex('#00FFCC');
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Color picker ────────────────────────────────────────────────────────────

  onPickerChange(value: string) {
    this.hexInput = value.toUpperCase();
    this.activeInput = 'hex';
    this.updateFromHex(value);
  }

  // ── Input handlers (debounced 300ms) ────────────────────────────────────────

  onHexInput() {
    this.activeInput = 'hex';
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseHexInput(), 300);
  }

  onRgbInput() {
    this.activeInput = 'rgb';
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseRgbInput(), 300);
  }

  onHslInput() {
    this.activeInput = 'hsl';
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseHslInput(), 300);
  }

  onHsbInput() {
    this.activeInput = 'hsb';
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseHsbInput(), 300);
  }

  onCmykInput() {
    this.activeInput = 'cmyk';
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.parseCmykInput(), 300);
  }

  // ── Parsers ─────────────────────────────────────────────────────────────────

  private parseHexInput() {
    let hex = this.hexInput.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      this.errorMessage = 'Invalid HEX — use format #RRGGBB or #RGB';
      return;
    }
    this.updateFromHex(hex);
  }

  private parseRgbInput() {
    const match = this.rgbInput.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (!match) {
      this.errorMessage = 'Invalid RGB — use format R, G, B (0-255)';
      return;
    }
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    if (r > 255 || g > 255 || b > 255) {
      this.errorMessage = 'RGB values must be 0-255';
      return;
    }
    this.updateFromRgb({ r, g, b });
  }

  private parseHslInput() {
    const match = this.hslInput.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (!match) {
      this.errorMessage = 'Invalid HSL — use format H, S, L (H: 0-360, S/L: 0-100)';
      return;
    }
    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const l = parseInt(match[3], 10);
    if (h > 360 || s > 100 || l > 100) {
      this.errorMessage = 'HSL: H must be 0-360, S and L must be 0-100';
      return;
    }
    this.updateFromHsl({ h, s, l });
  }

  private parseHsbInput() {
    const match = this.hsbInput.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (!match) {
      this.errorMessage = 'Invalid HSB — use format H, S, B (H: 0-360, S/B: 0-100)';
      return;
    }
    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    if (h > 360 || s > 100 || b > 100) {
      this.errorMessage = 'HSB: H must be 0-360, S and B must be 0-100';
      return;
    }
    this.updateFromHsb({ h, s, b });
  }

  private parseCmykInput() {
    const match = this.cmykInput.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (!match) {
      this.errorMessage = 'Invalid CMYK — use format C, M, Y, K (0-100)';
      return;
    }
    const c = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    const k = parseInt(match[4], 10);
    if (c > 100 || m > 100 || y > 100 || k > 100) {
      this.errorMessage = 'CMYK values must be 0-100';
      return;
    }
    this.updateFromCmyk({ c, m, y, k });
  }

  // ── Update from source ──────────────────────────────────────────────────────

  private updateFromHex(hex: string) {
    const rgb = this.hexToRgb(hex);
    this.rebuildAll(rgb, hex.toUpperCase());
  }

  private updateFromRgb(rgb: RGB) {
    const hex = this.rgbToHex(rgb);
    this.rebuildAll(rgb, hex);
  }

  private updateFromHsl(hsl: HSL) {
    const rgb = this.hslToRgb(hsl);
    const hex = this.rgbToHex(rgb);
    this.rebuildAll(rgb, hex);
  }

  private updateFromHsb(hsb: HSB) {
    const rgb = this.hsbToRgb(hsb);
    const hex = this.rgbToHex(rgb);
    this.rebuildAll(rgb, hex);
  }

  private updateFromCmyk(cmyk: CMYK) {
    const rgb = this.cmykToRgb(cmyk);
    const hex = this.rgbToHex(rgb);
    this.rebuildAll(rgb, hex);
  }

  private rebuildAll(rgb: RGB, hex: string) {
    const hsl = this.rgbToHsl(rgb);
    const hsb = this.rgbToHsb(rgb);
    const cmyk = this.rgbToCmyk(rgb);

    this.formats = { hex, rgb, hsl, hsb, cmyk };
    this.errorMessage = '';

    // Sync input fields (except the active one)
    if (this.activeInput !== 'hex') this.hexInput = hex;
    if (this.activeInput !== 'rgb') this.rgbInput = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    if (this.activeInput !== 'hsl') this.hslInput = `${hsl.h}, ${hsl.s}, ${hsl.l}`;
    if (this.activeInput !== 'hsb') this.hsbInput = `${hsb.h}, ${hsb.s}, ${hsb.b}`;
    if (this.activeInput !== 'cmyk') this.cmykInput = `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`;

    this.buildHarmonies(hsl);
    this.buildTintsAndShades(rgb);

    // Easter egg: pure black
    if (hex === '#000000') {
      this.eggs.trigger('color-void');
    }
  }

  // ── Harmonies ───────────────────────────────────────────────────────────────

  private buildHarmonies(hsl: HSL) {
    this.harmonies = [
      {
        name: 'Complementary',
        colors: [
          this.hslToHexString({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l })
        ]
      },
      {
        name: 'Analogous',
        colors: [
          this.hslToHexString({ h: (hsl.h + 330) % 360, s: hsl.s, l: hsl.l }),
          this.hslToHexString({ h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l })
        ]
      },
      {
        name: 'Triadic',
        colors: [
          this.hslToHexString({ h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }),
          this.hslToHexString({ h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l })
        ]
      }
    ];
  }

  // ── Tints & Shades ──────────────────────────────────────────────────────────

  private buildTintsAndShades(rgb: RGB) {
    this.tints = [];
    this.shades = [];
    for (let i = 1; i <= 5; i++) {
      const factor = i / 6;
      // Tint: mix with white
      const tr = Math.round(rgb.r + (255 - rgb.r) * factor);
      const tg = Math.round(rgb.g + (255 - rgb.g) * factor);
      const tb = Math.round(rgb.b + (255 - rgb.b) * factor);
      this.tints.push(this.rgbToHex({ r: tr, g: tg, b: tb }));
      // Shade: mix with black
      const sr = Math.round(rgb.r * (1 - factor));
      const sg = Math.round(rgb.g * (1 - factor));
      const sb = Math.round(rgb.b * (1 - factor));
      this.shades.push(this.rgbToHex({ r: sr, g: sg, b: sb }));
    }
  }

  // ── CSS variable output ─────────────────────────────────────────────────────

  get cssVariables(): string {
    const f = this.formats;
    return `--color-hex: ${f.hex};\n--color-rgb: ${f.rgb.r}, ${f.rgb.g}, ${f.rgb.b};\n--color-hsl: ${f.hsl.h}, ${f.hsl.s}%, ${f.hsl.l}%;\n--color-rgba: rgba(${f.rgb.r}, ${f.rgb.g}, ${f.rgb.b}, 1);\n--color-hsla: hsla(${f.hsl.h}, ${f.hsl.s}%, ${f.hsl.l}%, 1);`;
  }

  // ── Format strings ──────────────────────────────────────────────────────────

  get hexString(): string { return this.formats.hex; }
  get rgbString(): string { const r = this.formats.rgb; return `rgb(${r.r}, ${r.g}, ${r.b})`; }
  get hslString(): string { const h = this.formats.hsl; return `hsl(${h.h}, ${h.s}%, ${h.l}%)`; }
  get hsbString(): string { const h = this.formats.hsb; return `hsb(${h.h}, ${h.s}%, ${h.b}%)`; }
  get cmykString(): string { const c = this.formats.cmyk; return `cmyk(${c.c}%, ${c.m}%, ${c.y}%, ${c.k}%)`; }

  // ── Copy ─────────────────────────────────────────────────────────────────────

  async copyValue(value: string, field: string) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      setTimeout(() => (this.copiedField = ''), 2000);
    } catch {
      this.fallbackCopy(value, field);
    }
  }

  private fallbackCopy(text: string, field: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedField = field;
    setTimeout(() => (this.copiedField = ''), 2000);
  }

  // ── Load sample ─────────────────────────────────────────────────────────────

  loadSample() {
    this.hexInput = '#7B61FF';
    this.activeInput = 'hex';
    this.updateFromHex('#7B61FF');
  }

  clearAll() {
    this.hexInput = '#000000';
    this.activeInput = 'hex';
    this.updateFromHex('#000000');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Color conversion utilities
  // ══════════════════════════════════════════════════════════════════════════════

  private hexToRgb(hex: string): RGB {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  }

  private rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  private rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
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
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  private hslToRgb(hsl: HSL): RGB {
    const h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    };
  }

  private rgbToHsb(rgb: RGB): HSB {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(v * 100) };
  }

  private hsbToRgb(hsb: HSB): RGB {
    const h = hsb.h / 360, s = hsb.s / 100, v = hsb.b / 100;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  private rgbToCmyk(rgb: RGB): CMYK {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  }

  private cmykToRgb(cmyk: CMYK): RGB {
    const c = cmyk.c / 100, m = cmyk.m / 100, y = cmyk.y / 100, k = cmyk.k / 100;
    return {
      r: Math.round(255 * (1 - c) * (1 - k)),
      g: Math.round(255 * (1 - m) * (1 - k)),
      b: Math.round(255 * (1 - y) * (1 - k))
    };
  }

  private hslToHexString(hsl: HSL): string {
    return this.rgbToHex(this.hslToRgb(hsl));
  }
}
