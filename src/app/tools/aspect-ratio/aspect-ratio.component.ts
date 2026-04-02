import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface Preset {
  label: string;
  w: number;
  h: number;
  category: 'standard' | 'social';
}

interface Resolution {
  label: string;
  w: number;
  h: number;
}

@Component({
  selector: 'app-aspect-ratio',
  templateUrl: './aspect-ratio.component.html',
  styleUrls: ['./aspect-ratio.component.css'],
  standalone: false
})
export class AspectRatioComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Aspect Ratio Calculator — simplify ratios, lock dimensions, common presets, CSS output. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/aspect-ratio')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/aspect-ratio')}`;

  // Dimensions
  width: number | null = 1920;
  height: number | null = 1080;

  // Ratio
  ratioW = 16;
  ratioH = 9;
  ratioDisplay = '16:9';
  decimalRatio = '1.778';

  // Lock mode
  lockRatio = false;
  lockSource: 'width' | 'height' = 'width';

  // UI state
  copied = false;
  copiedField = '';

  // Presets
  readonly standardPresets: Preset[] = [
    { label: '16:9',  w: 16, h: 9,  category: 'standard' },
    { label: '4:3',   w: 4,  h: 3,  category: 'standard' },
    { label: '21:9',  w: 21, h: 9,  category: 'standard' },
    { label: '1:1',   w: 1,  h: 1,  category: 'standard' },
    { label: '9:16',  w: 9,  h: 16, category: 'standard' },
    { label: '3:2',   w: 3,  h: 2,  category: 'standard' },
  ];

  readonly socialPresets: Preset[] = [
    { label: 'Instagram Post',    w: 1080, h: 1080, category: 'social' },
    { label: 'Instagram Story',   w: 1080, h: 1920, category: 'social' },
    { label: 'YouTube Thumbnail', w: 1280, h: 720,  category: 'social' },
    { label: 'Twitter Post',      w: 1200, h: 675,  category: 'social' },
    { label: 'Facebook Cover',    w: 820,  h: 312,  category: 'social' },
    { label: 'Facebook Post',     w: 1200, h: 630,  category: 'social' },
    { label: 'LinkedIn Banner',   w: 1584, h: 396,  category: 'social' },
    { label: 'TikTok Video',      w: 1080, h: 1920, category: 'social' },
  ];

  // Common resolutions
  readonly resolutions: Resolution[] = [
    { label: 'HD (720p)',    w: 1280,  h: 720  },
    { label: 'Full HD',      w: 1920,  h: 1080 },
    { label: '2K (QHD)',     w: 2560,  h: 1440 },
    { label: '4K (UHD)',     w: 3840,  h: 2160 },
    { label: '5K',           w: 5120,  h: 2880 },
    { label: '8K',           w: 7680,  h: 4320 },
  ];

  // Resolution calculator
  customRatioW: number | null = 16;
  customRatioH: number | null = 9;
  targetWidth: number | null = null;
  targetHeight: number | null = null;
  calculatedWidth: number | null = null;
  calculatedHeight: number | null = null;

  constructor(private router: Router) {
    this.calculate();
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Calculation ───────────────────────────────────────────────────

  onInput(source: 'width' | 'height') {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.lockRatio) {
        this.calculateLocked(source);
      } else {
        this.calculate();
      }
    }, 150);
  }

  private calculate() {
    if (!this.width || !this.height || this.width <= 0 || this.height <= 0) {
      this.ratioDisplay = '--';
      this.decimalRatio = '--';
      this.ratioW = 1;
      this.ratioH = 1;
      return;
    }

    const g = this.gcd(this.width, this.height);
    this.ratioW = this.width / g;
    this.ratioH = this.height / g;
    this.ratioDisplay = `${this.ratioW}:${this.ratioH}`;
    this.decimalRatio = (this.width / this.height).toFixed(3);

    // Easter egg: 1:1 square
    if (this.width === this.height && this.width > 0) {
      this.eggs.trigger('ar-square');
    }
  }

  private calculateLocked(source: 'width' | 'height') {
    if (source === 'width' && this.width && this.width > 0) {
      this.height = Math.round(this.width * this.ratioH / this.ratioW);
    } else if (source === 'height' && this.height && this.height > 0) {
      this.width = Math.round(this.height * this.ratioW / this.ratioH);
    }
    this.decimalRatio = this.width && this.height ? (this.width / this.height).toFixed(3) : '--';

    // Easter egg: 1:1 square
    if (this.width && this.height && this.width === this.height && this.width > 0) {
      this.eggs.trigger('ar-square');
    }
  }

  toggleLock() {
    this.lockRatio = !this.lockRatio;
    if (this.lockRatio) {
      this.calculate();
    }
  }

  // ── Presets ────────────────────────────────────────────────────────

  applyPreset(preset: Preset) {
    if (preset.category === 'social') {
      this.width = preset.w;
      this.height = preset.h;
    } else {
      // For standard ratio presets, scale to a common width
      this.width = preset.w * 120;
      this.height = preset.h * 120;
    }
    this.lockRatio = false;
    this.calculate();
  }

  applyResolution(res: Resolution) {
    this.width = res.w;
    this.height = res.h;
    this.lockRatio = false;
    this.calculate();
  }

  // ── Resolution Calculator ──────────────────────────────────────────

  onResCalcInput(source: 'width' | 'height') {
    if (!this.customRatioW || !this.customRatioH || this.customRatioW <= 0 || this.customRatioH <= 0) {
      this.calculatedWidth = null;
      this.calculatedHeight = null;
      return;
    }
    if (source === 'width' && this.targetWidth && this.targetWidth > 0) {
      this.calculatedHeight = Math.round(this.targetWidth * this.customRatioH / this.customRatioW);
      this.calculatedWidth = this.targetWidth;
      this.targetHeight = null;
    } else if (source === 'height' && this.targetHeight && this.targetHeight > 0) {
      this.calculatedWidth = Math.round(this.targetHeight * this.customRatioW / this.customRatioH);
      this.calculatedHeight = this.targetHeight;
      this.targetWidth = null;
    }
  }

  useCurrentRatio() {
    this.customRatioW = this.ratioW;
    this.customRatioH = this.ratioH;
    this.calculatedWidth = null;
    this.calculatedHeight = null;
    this.targetWidth = null;
    this.targetHeight = null;
  }

  // ── CSS Output ─────────────────────────────────────────────────────

  get cssAspectRatio(): string {
    if (!this.width || !this.height || this.ratioDisplay === '--') return '';
    return `aspect-ratio: ${this.ratioW} / ${this.ratioH};`;
  }

  get cssCustomProperty(): string {
    if (!this.width || !this.height || this.ratioDisplay === '--') return '';
    return `--aspect-ratio: ${this.ratioW}/${this.ratioH};`;
  }

  get cssPaddingHack(): string {
    if (!this.width || !this.height || this.ratioDisplay === '--') return '';
    const pct = ((this.ratioH / this.ratioW) * 100).toFixed(4);
    return `padding-top: ${pct}%; /* ${this.ratioW}:${this.ratioH} */`;
  }

  // ── Preview ────────────────────────────────────────────────────────

  get previewStyle(): { [key: string]: string } {
    if (!this.width || !this.height || this.width <= 0 || this.height <= 0) {
      return { width: '200px', height: '200px' };
    }
    const maxSize = 200;
    const ratio = this.width / this.height;
    let w: number, h: number;
    if (ratio >= 1) {
      w = maxSize;
      h = maxSize / ratio;
    } else {
      h = maxSize;
      w = maxSize * ratio;
    }
    return {
      width: `${Math.round(w)}px`,
      height: `${Math.round(h)}px`
    };
  }

  // ── Copy ───────────────────────────────────────────────────────────

  async copyText(text: string, field: string) {
    if (!text || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      this.copiedField = field;
      setTimeout(() => { this.copied = false; this.copiedField = ''; }, 2000);
    } catch {
      this.fallbackCopy(text, field);
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
    this.copied = true;
    this.copiedField = field;
    setTimeout(() => { this.copied = false; this.copiedField = ''; }, 2000);
  }

  copyAll() {
    const lines = [
      `Dimensions: ${this.width} x ${this.height}`,
      `Aspect Ratio: ${this.ratioDisplay}`,
      `Decimal: ${this.decimalRatio}`,
      '',
      `CSS: ${this.cssAspectRatio}`,
      `Custom Property: ${this.cssCustomProperty}`,
      `Padding Hack: ${this.cssPaddingHack}`,
    ].join('\n');
    this.copyText(lines, 'all');
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private gcd(a: number, b: number): number {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  get totalPixels(): string {
    if (!this.width || !this.height) return '--';
    const total = this.width * this.height;
    if (total >= 1_000_000) return (total / 1_000_000).toFixed(2) + ' MP';
    if (total >= 1_000) return (total / 1_000).toFixed(1) + 'K';
    return total.toString();
  }

  swapDimensions() {
    const temp = this.width;
    this.width = this.height;
    this.height = temp;
    this.calculate();
  }
}
