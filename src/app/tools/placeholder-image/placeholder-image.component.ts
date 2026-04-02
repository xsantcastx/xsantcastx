import { Component, OnDestroy, inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

type ImageFormat = 'png' | 'jpeg' | 'webp';

interface SizePreset {
  label: string;
  width: number;
  height: number;
  category: string;
}

interface BatchItem {
  preset: SizePreset;
  dataUrl: string;
}

@Component({
  selector: 'app-placeholder-image',
  templateUrl: './placeholder-image.component.html',
  styleUrls: ['./placeholder-image.component.css'],
  standalone: false
})
export class PlaceholderImageComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  @ViewChild('previewCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('downloadLink') downloadLinkRef!: ElementRef<HTMLAnchorElement>;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Placeholder Image Generator — create custom placeholder images with text, colors & presets. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/placeholder-image')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/placeholder-image')}`;

  // Dimensions
  width = 300;
  height = 200;

  // Colors
  bgColor = '#1a1a2e';
  textColor = '#00ffcc';

  // Text
  customText = '';
  fontSize = 0; // 0 = auto

  // Format
  format: ImageFormat = 'png';
  jpegQuality = 0.92;

  // State
  generated = false;
  dataUrl = '';
  copied = false;
  copiedHtml = false;
  errorMessage = '';

  // Presets
  readonly presets: SizePreset[] = [
    { label: 'Thumbnail',       width: 150,  height: 150,  category: 'Common' },
    { label: 'Avatar',          width: 200,  height: 200,  category: 'Common' },
    { label: 'Square MD',       width: 400,  height: 400,  category: 'Common' },
    { label: 'Square LG',       width: 800,  height: 800,  category: 'Common' },
    { label: 'Banner',          width: 728,  height: 90,   category: 'Ads' },
    { label: 'Leaderboard',     width: 970,  height: 250,  category: 'Ads' },
    { label: 'Skyscraper',      width: 160,  height: 600,  category: 'Ads' },
    { label: 'Medium Rectangle',width: 300,  height: 250,  category: 'Ads' },
    { label: 'OG / Social',     width: 1200, height: 630,  category: 'Social' },
    { label: 'Twitter Card',    width: 1200, height: 675,  category: 'Social' },
    { label: 'Instagram Post',  width: 1080, height: 1080, category: 'Social' },
    { label: 'Instagram Story', width: 1080, height: 1920, category: 'Social' },
    { label: 'YouTube Thumb',   width: 1280, height: 720,  category: 'Social' },
    { label: 'HD 720p',         width: 1280, height: 720,  category: 'Screen' },
    { label: 'Full HD 1080p',   width: 1920, height: 1080, category: 'Screen' },
    { label: 'Favicon',         width: 32,   height: 32,   category: 'Icons' },
    { label: 'App Icon',        width: 512,  height: 512,  category: 'Icons' },
  ];

  readonly presetCategories: string[] = ['Common', 'Ads', 'Social', 'Screen', 'Icons'];

  // Batch mode
  batchMode = false;
  batchSelected = new Set<number>();
  batchResults: BatchItem[] = [];
  batchGenerating = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Presets ────────────────────────────────────────────────────

  getPresetsByCategory(category: string): SizePreset[] {
    return this.presets.filter(p => p.category === category);
  }

  applyPreset(preset: SizePreset) {
    this.width = preset.width;
    this.height = preset.height;
    this.onSettingsChange();
  }

  // ── Batch ──────────────────────────────────────────────────────

  toggleBatchPreset(index: number) {
    if (this.batchSelected.has(index)) {
      this.batchSelected.delete(index);
    } else {
      this.batchSelected.add(index);
    }
  }

  isBatchSelected(index: number): boolean {
    return this.batchSelected.has(index);
  }

  generateBatch() {
    if (!this.isBrowser || this.batchSelected.size === 0) return;
    this.batchGenerating = true;
    this.batchResults = [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    this.batchSelected.forEach(index => {
      const preset = this.presets[index];
      const url = this.renderToDataUrl(canvas, ctx, preset.width, preset.height);
      this.batchResults.push({ preset, dataUrl: url });
    });

    this.batchGenerating = false;
  }

  downloadBatchItem(item: BatchItem) {
    if (!this.isBrowser) return;
    const link = document.createElement('a');
    link.href = item.dataUrl;
    link.download = `placeholder-${item.preset.width}x${item.preset.height}.${this.format}`;
    link.click();
  }

  // ── Generation ─────────────────────────────────────────────────

  onSettingsChange() {
    this.errorMessage = '';
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.generate(), 150);
  }

  generate() {
    if (!this.isBrowser) return;

    // Validate
    if (this.width < 1 || this.width > 2000 || this.height < 1 || this.height > 2000) {
      this.errorMessage = 'Dimensions must be between 1 and 2000 pixels.';
      this.generated = false;
      return;
    }

    // Easter egg: 1x1 pixel
    if (this.width === 1 && this.height === 1) {
      this.eggs.trigger('ph-pixel');
    }

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = this.width;
    canvas.height = this.height;

    this.renderOnCanvas(ctx, this.width, this.height);
    this.dataUrl = this.getDataUrl(canvas);
    this.generated = true;
    this.copied = false;
    this.copiedHtml = false;
  }

  private renderToDataUrl(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number): string {
    canvas.width = w;
    canvas.height = h;
    this.renderOnCanvas(ctx, w, h);
    return this.getDataUrl(canvas);
  }

  private renderOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Background
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Cross lines
    ctx.strokeStyle = this.adjustAlpha(this.textColor, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();

    // Border
    ctx.strokeStyle = this.adjustAlpha(this.textColor, 0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Text
    const text = this.customText || `${w}\u00D7${h}`;
    const autoSize = this.fontSize > 0 ? this.fontSize : Math.max(10, Math.min(w, h) / 8);
    ctx.font = `bold ${autoSize}px 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace`;
    ctx.fillStyle = this.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2, w * 0.9);
  }

  private getDataUrl(canvas: HTMLCanvasElement): string {
    const mimeMap: Record<ImageFormat, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp'
    };
    const mime = mimeMap[this.format];
    return this.format === 'jpeg' ? canvas.toDataURL(mime, this.jpegQuality) : canvas.toDataURL(mime);
  }

  private adjustAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Actions ────────────────────────────────────────────────────

  download() {
    if (!this.isBrowser || !this.dataUrl) return;
    const link = this.downloadLinkRef?.nativeElement || document.createElement('a');
    link.href = this.dataUrl;
    link.download = `placeholder-${this.width}x${this.height}.${this.format}`;
    link.click();
  }

  copyDataUri() {
    if (!this.isBrowser || !this.dataUrl) return;
    navigator.clipboard.writeText(this.dataUrl).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  getHtmlTag(): string {
    return `<img src="${this.dataUrl}" alt="Placeholder ${this.width}\u00D7${this.height}" width="${this.width}" height="${this.height}" />`;
  }

  copyHtmlTag() {
    if (!this.isBrowser || !this.dataUrl) return;
    navigator.clipboard.writeText(this.getHtmlTag()).then(() => {
      this.copiedHtml = true;
      setTimeout(() => this.copiedHtml = false, 2000);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  get fileSizeEstimate(): string {
    if (!this.dataUrl) return '';
    const bytes = Math.round((this.dataUrl.length - this.dataUrl.indexOf(',') - 1) * 3 / 4);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  get displayText(): string {
    return this.customText || `${this.width}\u00D7${this.height}`;
  }

  get formatMime(): string {
    const map: Record<ImageFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
    return map[this.format];
  }
}
