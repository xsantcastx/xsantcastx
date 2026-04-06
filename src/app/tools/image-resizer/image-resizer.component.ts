import { Component, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface ResizeImage {
  file: File;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  resizedBlob: Blob | null;
  resizedUrl: string;
  resizedWidth: number;
  resizedHeight: number;
  status: 'loaded' | 'resizing' | 'done' | 'error';
  errorMsg: string;
}

interface SizePreset {
  label: string;
  width: number;
  height: number;
  category: string;
}

@Component({
  selector: 'app-image-resizer',
  templateUrl: './image-resizer.component.html',
  styleUrls: ['./image-resizer.component.css'],
  standalone: false
})
export class ImageResizerComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  images: ResizeImage[] = [];
  resizeMode: 'percentage' | 'dimensions' | 'preset' = 'percentage';
  percentage = 50;
  targetWidth = 0;
  targetHeight = 0;
  maintainAspectRatio = true;
  outputFormat: 'same' | 'jpeg' | 'png' | 'webp' = 'same';
  quality = 90;
  isDragOver = false;
  isResizingAll = false;
  error = '';
  selectedPreset: SizePreset | null = null;
  supportsWebP = true;

  readonly ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  readonly MAX_FILES = 20;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free browser-based image resizer — resize, crop & convert images with live preview. No uploads, no sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/image-resizer')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/image-resizer')}`;

  readonly presets: SizePreset[] = [
    // Social Media
    { label: 'Instagram Post', width: 1080, height: 1080, category: 'Social' },
    { label: 'Instagram Story', width: 1080, height: 1920, category: 'Social' },
    { label: 'Facebook Cover', width: 820, height: 312, category: 'Social' },
    { label: 'Twitter Header', width: 1500, height: 500, category: 'Social' },
    { label: 'LinkedIn Banner', width: 1584, height: 396, category: 'Social' },
    { label: 'YouTube Thumbnail', width: 1280, height: 720, category: 'Social' },
    // Common
    { label: 'HD (1280x720)', width: 1280, height: 720, category: 'Standard' },
    { label: 'Full HD (1920x1080)', width: 1920, height: 1080, category: 'Standard' },
    { label: '4K (3840x2160)', width: 3840, height: 2160, category: 'Standard' },
    { label: 'Thumbnail (150x150)', width: 150, height: 150, category: 'Standard' },
    { label: 'Icon (64x64)', width: 64, height: 64, category: 'Standard' },
    // Web
    { label: 'OG Image (1200x630)', width: 1200, height: 630, category: 'Web' },
    { label: 'Favicon (32x32)', width: 32, height: 32, category: 'Web' },
    { label: 'Apple Touch (180x180)', width: 180, height: 180, category: 'Web' },
  ];

  constructor(
    private router: Router,
    private easterEggService: EasterEggService
  ) {
    if (this.isBrowser) this.detectWebPSupport();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    this.images.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      if (img.resizedUrl) URL.revokeObjectURL(img.resizedUrl);
    });
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  /* ── File handling ──────────────────────────────────── */

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files) this.handleFiles(files);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.handleFiles(input.files);
    input.value = '';
  }

  handleFiles(files: FileList): void {
    if (!this.isBrowser) return;
    this.error = '';
    const remaining = this.MAX_FILES - this.images.length;
    const toProcess = Math.min(files.length, remaining);

    if (files.length > remaining) {
      this.error = `Maximum ${this.MAX_FILES} images. Only the first ${toProcess} will be added.`;
    }

    for (let i = 0; i < toProcess; i++) {
      const file = files[i];
      if (!this.ACCEPTED_TYPES.includes(file.type)) {
        this.error = `${file.name}: unsupported format. Use JPEG, PNG, WebP, GIF, or BMP.`;
        continue;
      }
      this.loadImage(file);
    }
  }

  private loadImage(file: File): void {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const entry: ResizeImage = {
        file,
        originalWidth: img.naturalWidth,
        originalHeight: img.naturalHeight,
        previewUrl: url,
        resizedBlob: null,
        resizedUrl: '',
        resizedWidth: 0,
        resizedHeight: 0,
        status: 'loaded',
        errorMsg: ''
      };
      this.images.push(entry);

      // Set initial target dimensions from first image
      if (this.images.length === 1 && this.targetWidth === 0) {
        this.targetWidth = img.naturalWidth;
        this.targetHeight = img.naturalHeight;
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.error = `Failed to load ${file.name}`;
    };
    img.src = url;
  }

  /* ── Dimension helpers ──────────────────────────────── */

  onWidthChange(): void {
    if (this.maintainAspectRatio && this.images.length > 0) {
      const first = this.images[0];
      const ratio = first.originalHeight / first.originalWidth;
      this.targetHeight = Math.round(this.targetWidth * ratio);
    }
  }

  onHeightChange(): void {
    if (this.maintainAspectRatio && this.images.length > 0) {
      const first = this.images[0];
      const ratio = first.originalWidth / first.originalHeight;
      this.targetWidth = Math.round(this.targetHeight * ratio);
    }
  }

  selectPreset(preset: SizePreset): void {
    this.selectedPreset = preset;
    this.targetWidth = preset.width;
    this.targetHeight = preset.height;
    this.resizeMode = 'preset';
    // Easter egg: resize to 1x1
    if (preset.width === 1 && preset.height === 1) {
      this.easterEggService.tryTrigger('resize-pixel');
    }
  }

  getComputedDimensions(img: ResizeImage): { width: number; height: number } {
    if (this.resizeMode === 'percentage') {
      return {
        width: Math.round(img.originalWidth * this.percentage / 100),
        height: Math.round(img.originalHeight * this.percentage / 100)
      };
    }
    return { width: this.targetWidth, height: this.targetHeight };
  }

  /* ── Resize logic ───────────────────────────────────── */

  async resizeAll(): Promise<void> {
    if (!this.isBrowser || this.isResizingAll) return;
    this.isResizingAll = true;

    for (const img of this.images) {
      if (img.status === 'done') continue;
      await this.resizeSingle(img);
    }

    this.isResizingAll = false;

    // Easter egg: resize 10+ images at once
    if (this.images.length >= 10 && this.images.every(i => i.status === 'done')) {
      this.easterEggService.tryTrigger('resize-batch');
    }
  }

  async resizeSingle(entry: ResizeImage): Promise<void> {
    if (!this.isBrowser) return;
    entry.status = 'resizing';
    entry.errorMsg = '';

    try {
      const dims = this.getComputedDimensions(entry);
      if (dims.width < 1 || dims.height < 1) {
        throw new Error('Dimensions must be at least 1x1');
      }

      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Load image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = entry.previewUrl;
      });

      // Apply smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, dims.width, dims.height);

      // Determine output MIME
      let mime: string;
      if (this.outputFormat === 'same') {
        mime = entry.file.type === 'image/gif' || entry.file.type === 'image/bmp'
          ? 'image/png' : entry.file.type;
      } else {
        mime = `image/${this.outputFormat}`;
      }

      const qualityVal = (mime === 'image/png') ? undefined : this.quality / 100;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error('Failed to create image')),
          mime,
          qualityVal
        );
      });

      // Revoke previous resized URL
      if (entry.resizedUrl) URL.revokeObjectURL(entry.resizedUrl);

      entry.resizedBlob = blob;
      entry.resizedUrl = URL.createObjectURL(blob);
      entry.resizedWidth = dims.width;
      entry.resizedHeight = dims.height;
      entry.status = 'done';
    } catch (err: any) {
      entry.status = 'error';
      entry.errorMsg = err.message || 'Resize failed';
    }
  }

  /* ── Download ───────────────────────────────────────── */

  downloadSingle(entry: ResizeImage): void {
    if (!this.isBrowser || !entry.resizedUrl) return;
    const ext = this.getOutputExtension(entry);
    const baseName = entry.file.name.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = entry.resizedUrl;
    a.download = `${baseName}-${entry.resizedWidth}x${entry.resizedHeight}.${ext}`;
    a.click();
  }

  downloadAll(): void {
    if (!this.isBrowser) return;
    this.images.filter(i => i.status === 'done').forEach(i => this.downloadSingle(i));
  }

  /* ── Remove / clear ─────────────────────────────────── */

  removeImage(index: number): void {
    const img = this.images[index];
    if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    if (img.resizedUrl) URL.revokeObjectURL(img.resizedUrl);
    this.images.splice(index, 1);
  }

  clearAll(): void {
    this.images.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      if (img.resizedUrl) URL.revokeObjectURL(img.resizedUrl);
    });
    this.images = [];
    this.targetWidth = 0;
    this.targetHeight = 0;
    this.selectedPreset = null;
  }

  /* ── Helpers ────────────────────────────────────────── */

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getOutputExtension(entry: ResizeImage): string {
    if (this.outputFormat !== 'same') return this.outputFormat;
    const type = entry.file.type;
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    return 'png'; // fallback for gif/bmp
  }

  get doneCount(): number {
    return this.images.filter(i => i.status === 'done').length;
  }

  get totalSaved(): number {
    return this.images.reduce((acc, img) => {
      if (img.status === 'done' && img.resizedBlob) {
        return acc + (img.file.size - img.resizedBlob.size);
      }
      return acc;
    }, 0);
  }

  presetsByCategory(category: string): SizePreset[] {
    return this.presets.filter(p => p.category === category);
  }

  get presetCategories(): string[] {
    return [...new Set(this.presets.map(p => p.category))];
  }

  private detectWebPSupport(): void {
    const c = document.createElement('canvas');
    this.supportsWebP = c.toDataURL('image/webp').startsWith('data:image/webp');
  }

  copyDimensions(img: ResizeImage): void {
    if (!this.isBrowser) return;
    const text = `${img.resizedWidth || img.originalWidth}x${img.resizedHeight || img.originalHeight}`;
    navigator.clipboard?.writeText(text);
  }
}
