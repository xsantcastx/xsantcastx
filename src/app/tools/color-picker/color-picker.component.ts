import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-color-picker',
    templateUrl: './color-picker.component.html',
    styleUrls: ['./color-picker.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class ColorPickerComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Advanced Color Picker — RGB, HSL sliders, hex input, color history')}&url=${encodeURIComponent(SITE_URL + '/tools/color-picker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/color-picker')}`;

  hex = '#00FFCC';
  r = 0; g = 255; b = 204;
  h = 168; s = 100; l = 50;
  copied = false;
  colorHistory: string[] = [];

  constructor(private router: Router) {
    this.syncFromHex();
  }

  goBack(): void { this.router.navigate(['/tools']); }

  onHexInput(): void {
    const clean = this.hex.replace(/[^0-9a-fA-F#]/g, '');
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      this.hex = clean.toUpperCase();
      this.syncFromHex();
      this.checkEasterEgg();
    }
  }

  onRgbChange(): void {
    this.r = Math.max(0, Math.min(255, this.r));
    this.g = Math.max(0, Math.min(255, this.g));
    this.b = Math.max(0, Math.min(255, this.b));
    this.hex = '#' + [this.r, this.g, this.b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    this.syncHslFromRgb();
    this.checkEasterEgg();
  }

  onHslChange(): void {
    this.h = Math.max(0, Math.min(360, this.h));
    this.s = Math.max(0, Math.min(100, this.s));
    this.l = Math.max(0, Math.min(100, this.l));
    this.syncRgbFromHsl();
    this.hex = '#' + [this.r, this.g, this.b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    this.checkEasterEgg();
  }

  private syncFromHex(): void {
    const hex = this.hex.replace('#', '');
    this.r = parseInt(hex.substring(0, 2), 16);
    this.g = parseInt(hex.substring(2, 4), 16);
    this.b = parseInt(hex.substring(4, 6), 16);
    this.syncHslFromRgb();
  }

  private syncHslFromRgb(): void {
    const rn = this.r / 255, gn = this.g / 255, bn = this.b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const diff = max - min;
    this.l = Math.round(((max + min) / 2) * 100);
    if (diff === 0) { this.h = 0; this.s = 0; return; }
    this.s = Math.round((this.l > 50 ? diff / (2 - max - min) : diff / (max + min)) * 100);
    if (max === rn) this.h = Math.round(((gn - bn) / diff + (gn < bn ? 6 : 0)) * 60);
    else if (max === gn) this.h = Math.round(((bn - rn) / diff + 2) * 60);
    else this.h = Math.round(((rn - gn) / diff + 4) * 60);
  }

  private syncRgbFromHsl(): void {
    const hue = this.h / 360, sat = this.s / 100, light = this.l / 100;
    if (sat === 0) { this.r = this.g = this.b = Math.round(light * 255); return; }
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    this.r = Math.round(hue2rgb(p, q, hue + 1 / 3) * 255);
    this.g = Math.round(hue2rgb(p, q, hue) * 255);
    this.b = Math.round(hue2rgb(p, q, hue - 1 / 3) * 255);
  }

  addToHistory(): void {
    if (!this.colorHistory.includes(this.hex)) {
      this.colorHistory.unshift(this.hex);
      if (this.colorHistory.length > 20) this.colorHistory.pop();
    }
  }

  selectFromHistory(color: string): void {
    this.hex = color;
    this.syncFromHex();
  }

  get rgbString(): string { return `rgb(${this.r}, ${this.g}, ${this.b})`; }
  get hslString(): string { return `hsl(${this.h}, ${this.s}%, ${this.l}%)`; }

  async copyColor(format: string): Promise<void> {
    if (!this.isBrowser) return;
    let text = this.hex;
    if (format === 'rgb') text = this.rgbString;
    else if (format === 'hsl') text = this.hslString;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      this.addToHistory();
      setTimeout(() => (this.copied = false), 2000);
    } catch { /* fallback */ }
  }

  private checkEasterEgg(): void {
    if (this.hex.toUpperCase() === '#BADA55') {
      this.eggs.trigger('color-badass');
    }
  }
}
