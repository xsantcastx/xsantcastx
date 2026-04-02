import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

interface FaviconSize {
  label: string;
  size: number;
  purpose: string;
}

@Component({
  selector: 'app-favicon-generator',
  templateUrl: './favicon-generator.component.html',
  styleUrls: ['./favicon-generator.component.css'],
  standalone: false
})
export class FaviconGeneratorComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('mainCanvas', { static: false }) mainCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Favicon Generator -- create favicons from text, emoji, or images. No sign-up required.')}&url=${encodeURIComponent(SITE_URL + '/tools/favicon-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/favicon-generator')}`;

  // Input mode
  inputMode: 'text' | 'emoji' | 'image' = 'text';

  // Text/emoji input
  faviconText = 'Xs';
  faviconEmoji = '';

  // Image input
  uploadedImage: HTMLImageElement | null = null;
  uploadedFileName = '';
  isDragOver = false;

  // Customization
  bgColor = '#0a0e17';
  textColor = '#00ffcc';
  fontSize = 64;
  borderRadius = 0;
  fontFamily = 'Inter';

  // Font options
  fontFamilies = [
    'Inter', 'Arial', 'Georgia', 'Courier New', 'Verdana',
    'Times New Roman', 'Impact', 'Comic Sans MS', 'Trebuchet MS',
    'Fira Code', 'Palatino', 'Garamond'
  ];

  // Preview sizes
  readonly sizes: FaviconSize[] = [
    { label: '16x16', size: 16, purpose: 'Browser tab' },
    { label: '32x32', size: 32, purpose: 'Taskbar shortcut' },
    { label: '48x48', size: 48, purpose: 'Desktop shortcut' },
    { label: '180x180', size: 180, purpose: 'Apple touch icon' },
    { label: '192x192', size: 192, purpose: 'Android Chrome' },
  ];

  // Generated outputs
  previewDataUrls: Map<number, string> = new Map();
  htmlSnippet = '';
  manifestSnippet = '';

  // UI state
  copied = false;
  copiedField = '';
  generatedAt = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (this.isBrowser) {
      this.renderAll();
    }
  }

  ngOnDestroy(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // -- Input mode --

  setInputMode(mode: 'text' | 'emoji' | 'image'): void {
    this.inputMode = mode;
    this.scheduleRender();
  }

  onTextChange(): void {
    // Easter egg: text is "X"
    if (this.faviconText.trim() === 'X') {
      this.eggs.trigger('favicon-x');
    }
    this.scheduleRender();
  }

  onEmojiChange(): void {
    this.scheduleRender();
  }

  onSettingChange(): void {
    this.scheduleRender();
  }

  // -- File upload --

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.loadImage(file);
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) this.loadImage(file);
    input.value = '';
  }

  private loadImage(file: File): void {
    if (!this.isBrowser) return;
    if (!file.type.startsWith('image/')) return;
    this.uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.uploadedImage = img;
        this.inputMode = 'image';
        this.scheduleRender();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // -- Rendering --

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderAll(), 100);
  }

  private renderAll(): void {
    if (!this.isBrowser) return;
    this.previewDataUrls.clear();
    for (const s of this.sizes) {
      this.previewDataUrls.set(s.size, this.renderToDataUrl(s.size));
    }
    this.generateSnippets();
    this.generatedAt = new Date().toLocaleTimeString();
  }

  private renderToDataUrl(size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background with border radius
    const r = (this.borderRadius / 100) * (size / 2);
    ctx.beginPath();
    this.roundRect(ctx, 0, 0, size, size, r);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, size, size);

    if (this.inputMode === 'image' && this.uploadedImage) {
      // Draw uploaded image, cover-fit
      const img = this.uploadedImage;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    } else if (this.inputMode === 'emoji' && this.faviconEmoji) {
      // Draw emoji
      const emojiSize = size * 0.7;
      ctx.font = `${emojiSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.faviconEmoji, size / 2, size / 2 + emojiSize * 0.05);
    } else {
      // Draw text
      const text = this.faviconText || 'Xs';
      const adjustedFontSize = (this.fontSize / 100) * size;
      ctx.font = `bold ${adjustedFontSize}px "${this.fontFamily}", sans-serif`;
      ctx.fillStyle = this.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.slice(0, 2), size / 2, size / 2 + adjustedFontSize * 0.04);
    }

    return canvas.toDataURL('image/png');
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  // -- Snippet generation --

  private generateSnippets(): void {
    this.htmlSnippet =
`<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">`;

    this.manifestSnippet =
`{
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/favicon-48x48.png",
      "sizes": "48x48",
      "type": "image/png"
    }
  ]
}`;
  }

  // -- Downloads --

  downloadPng(size: number): void {
    if (!this.isBrowser) return;
    const dataUrl = this.previewDataUrls.get(size);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadAllPng(): void {
    for (const s of this.sizes) {
      setTimeout(() => this.downloadPng(s.size), s.size * 2);
    }
  }

  downloadIco(): void {
    if (!this.isBrowser) return;
    // Build ICO from 16x16 and 32x32 PNGs
    const pngDataUrls = [16, 32].map(s => this.previewDataUrls.get(s)).filter(Boolean) as string[];
    if (pngDataUrls.length === 0) return;

    const pngBuffers: ArrayBuffer[] = [];
    let loaded = 0;

    pngDataUrls.forEach((dataUrl, idx) => {
      const binary = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      pngBuffers[idx] = bytes.buffer;
      loaded++;
      if (loaded === pngDataUrls.length) {
        this.buildAndDownloadIco(pngBuffers);
      }
    });
  }

  private buildAndDownloadIco(pngBuffers: ArrayBuffer[]): void {
    const count = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dataOffset = headerSize + dirEntrySize * count;

    let totalSize = dataOffset;
    for (const buf of pngBuffers) totalSize += buf.byteLength;

    const ico = new ArrayBuffer(totalSize);
    const view = new DataView(ico);

    // ICO header
    view.setUint16(0, 0, true);      // reserved
    view.setUint16(2, 1, true);      // type: ICO
    view.setUint16(4, count, true);  // image count

    let offset = dataOffset;
    const sizes = [16, 32];
    for (let i = 0; i < count; i++) {
      const s = sizes[i];
      const entryPos = headerSize + i * dirEntrySize;
      view.setUint8(entryPos, s === 256 ? 0 : s);      // width
      view.setUint8(entryPos + 1, s === 256 ? 0 : s);  // height
      view.setUint8(entryPos + 2, 0);   // color palette
      view.setUint8(entryPos + 3, 0);   // reserved
      view.setUint16(entryPos + 4, 1, true);  // color planes
      view.setUint16(entryPos + 6, 32, true); // bits per pixel
      view.setUint32(entryPos + 8, pngBuffers[i].byteLength, true);  // image size
      view.setUint32(entryPos + 12, offset, true); // data offset

      // Copy PNG data
      const src = new Uint8Array(pngBuffers[i]);
      const dst = new Uint8Array(ico, offset, src.length);
      dst.set(src);
      offset += src.length;
    }

    const blob = new Blob([ico], { type: 'image/x-icon' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favicon.ico';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // -- Copy --

  async copySnippet(text: string, field: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      this.copiedField = field;
      setTimeout(() => { this.copied = false; this.copiedField = ''; }, 2000);
    } catch {
      this.fallbackCopy(text, field);
    }
  }

  private fallbackCopy(text: string, field: string): void {
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

  // -- Helpers --

  getPreview(size: number): string {
    return this.previewDataUrls.get(size) || '';
  }
}
