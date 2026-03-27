import { Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

interface PaletteColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  frequency: number;
}

@Component({
  selector: 'app-color-palette',
  templateUrl: './color-palette.component.html',
  styleUrls: ['./color-palette.component.css'],
  standalone: false
})
export class ColorPaletteComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  imageUrl: string | null = null;
  palette: PaletteColor[] = [];
  colorFormat: 'hex' | 'rgb' | 'hsl' = 'hex';
  paletteSize = 8;
  dragOver = false;
  copiedHex: string | null = null;
  extracting = false;
  error = '';
  readonly paletteSizes = [4, 6, 8, 10, 12];
  readonly twitterShareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Color Palette Extractor — upload any image and instantly get HEX, RGB, HSL colors + CSS variables export. Runs in your browser, no sign-up 🎨')}&url=${encodeURIComponent(SITE_URL + '/tools/color-palette')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/color-palette')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
  }

  private processFile(file: File): void {
    if (!this.isBrowser) return;
    if (!file.type.startsWith('image/')) {
      this.error = 'Please upload an image file.';
      return;
    }
    this.extracting = true;
    this.error = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        this.imageUrl = result;
        this.extractPalette(result);
      }
    };
    reader.readAsDataURL(file);
  }

  private extractPalette(dataUrl: string): void {
    if (!this.isBrowser) return;
    const img = new Image();
    img.onload = () => {
      const maxSize = 200;
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.error = 'Could not process image.';
        this.extracting = false;
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      this.palette = this.quantize(imageData.data, width * height);
      this.extracting = false;
    };
    img.onerror = () => {
      this.error = 'Failed to load image. Please try another file.';
      this.extracting = false;
    };
    img.src = dataUrl;
  }

  private quantize(pixels: Uint8ClampedArray, totalPixels: number): PaletteColor[] {
    const counts = new Map<string, number>();

    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      if (a < 128) continue;

      const r = Math.min(255, Math.round(pixels[i] / 24) * 24);
      const g = Math.min(255, Math.round(pixels[i + 1] / 24) * 24);
      const b = Math.min(255, Math.round(pixels[i + 2] / 24) * 24);

      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    const chosen: Array<{ r: number; g: number; b: number; count: number }> = [];

    for (const [key, count] of sorted) {
      if (chosen.length >= this.paletteSize) break;
      const parts = key.split(',');
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);

      const tooClose = chosen.some((c) => {
        const dr = r - c.r;
        const dg = g - c.g;
        const db = b - c.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 60;
      });

      if (!tooClose) {
        chosen.push({ r, g, b, count });
      }
    }

    return chosen.map(({ r, g, b, count }) => ({
      hex: this.rgbToHex(r, g, b),
      rgb: { r, g, b },
      hsl: this.rgbToHsl(r, g, b),
      frequency: count / totalPixels
    }));
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));

      if (max === rn) {
        h = ((gn - bn) / delta) % 6;
      } else if (max === gn) {
        h = (bn - rn) / delta + 2;
      } else {
        h = (rn - gn) / delta + 4;
      }

      h = h * 60;
      if (h < 0) h += 360;
    }

    return {
      h: Math.round(h),
      s: Math.round(s * 1000) / 10,
      l: Math.round(l * 1000) / 10
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' +
      r.toString(16).padStart(2, '0') +
      g.toString(16).padStart(2, '0') +
      b.toString(16).padStart(2, '0');
  }

  getColorValue(color: PaletteColor): string {
    switch (this.colorFormat) {
      case 'rgb':
        return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
      case 'hsl':
        return `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`;
      default:
        return color.hex;
    }
  }

  copyColor(color: PaletteColor): void {
    if (!this.isBrowser) return;
    const value = this.getColorValue(color);
    navigator.clipboard.writeText(value).then(() => {
      this.copiedHex = color.hex;
      setTimeout(() => {
        if (this.copiedHex === color.hex) {
          this.copiedHex = null;
        }
      }, 1500);
    });
  }

  exportAs(format: 'css' | 'tailwind' | 'json'): void {
    if (!this.isBrowser) return;
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'css') {
      const vars = this.palette
        .map((c, i) => `  --color-${i + 1}: ${c.hex};`)
        .join('\n');
      content = `:root {\n${vars}\n}`;
      filename = 'palette.css';
      mimeType = 'text/css';
    } else if (format === 'tailwind') {
      const colors = this.palette
        .map((c, i) => `        'palette-${i + 1}': '${c.hex}',`)
        .join('\n');
      content = `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colors}\n      }\n    }\n  }\n}`;
      filename = 'tailwind-palette.js';
      mimeType = 'text/javascript';
    } else {
      const data = this.palette.map(c => ({
        hex: c.hex,
        rgb: c.rgb,
        hsl: c.hsl
      }));
      content = JSON.stringify(data, null, 2);
      filename = 'palette.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  changePaletteSize(size: number): void {
    this.paletteSize = size;
    if (this.imageUrl) {
      this.extracting = true;
      this.extractPalette(this.imageUrl);
    }
  }

  getTextColor(color: PaletteColor): string {
    const luminance = (0.299 * color.rgb.r + 0.587 * color.rgb.g + 0.114 * color.rgb.b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
  }
}
