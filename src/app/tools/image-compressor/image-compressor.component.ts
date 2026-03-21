import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';

interface CompressedImage {
  file: File;
  originalSize: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  savings: number;
  previewUrl: string;
  originalUrl: string;
  status: 'pending' | 'compressing' | 'done' | 'error';
  outputName: string;
  errorMsg: string;
}

@Component({
  selector: 'app-image-compressor',
  templateUrl: './image-compressor.component.html',
  styleUrls: ['./image-compressor.component.css'],
  standalone: false
})
export class ImageCompressorComponent implements OnDestroy {
  images: CompressedImage[] = [];
  quality = 80;
  outputFormat: 'same' | 'jpeg' | 'webp' = 'same';
  isDragOver = false;
  isCompressingAll = false;
  supportsWebP = true;
  error = '';

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free browser-based image compressor — compress JPEG, PNG & WebP with live quality preview. No uploads, no sign-up 🖼️')}&url=${encodeURIComponent(SITE_URL + '/tools/image-compressor')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/image-compressor')}`;

  private readonly ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  readonly MAX_FILES = 20;

  constructor(private router: Router, private translationService: TranslationService) {
    this.detectWebPSupport();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  ngOnDestroy(): void {
    this.images.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      if (img.originalUrl) URL.revokeObjectURL(img.originalUrl);
    });
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

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
    if (input.files) {
      this.handleFiles(input.files);
      input.value = '';
    }
  }

  private handleFiles(files: FileList): void {
    this.error = '';
    const valid = Array.from(files).filter(f => this.ACCEPTED_TYPES.includes(f.type));
    if (!valid.length) {
      this.error = 'Please upload JPEG, PNG, WebP, or GIF images.';
      return;
    }
    const remaining = this.MAX_FILES - this.images.length;
    if (remaining <= 0) {
      this.error = `Maximum ${this.MAX_FILES} images at once.`;
      return;
    }
    const toAdd = valid.slice(0, remaining);
    const entries: CompressedImage[] = toAdd.map(file => ({
      file,
      originalSize: file.size,
      compressedBlob: null,
      compressedSize: 0,
      savings: 0,
      previewUrl: '',
      originalUrl: URL.createObjectURL(file),
      status: 'pending',
      outputName: this.buildOutputName(file),
      errorMsg: ''
    }));
    this.images.push(...entries);
    entries.forEach(entry => this.compressImage(entry));
  }

  private buildOutputName(file: File): string {
    const dotIdx = file.name.lastIndexOf('.');
    const base = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;
    const ext = this.getOutputExt(file.type);
    return `${base}-compressed.${ext}`;
  }

  private getOutputExt(inputMime: string): string {
    if (this.outputFormat === 'jpeg') return 'jpg';
    if (this.outputFormat === 'webp') return 'webp';
    // 'same' — preserve input format
    if (inputMime === 'image/webp') return 'webp';
    if (inputMime === 'image/png') return 'png';
    return 'jpg';
  }

  private getOutputMime(inputMime: string): string {
    if (this.outputFormat === 'jpeg') return 'image/jpeg';
    if (this.outputFormat === 'webp') return this.supportsWebP ? 'image/webp' : 'image/jpeg';
    return inputMime === 'image/png' ? 'image/png' : (inputMime === 'image/webp' && this.supportsWebP ? 'image/webp' : 'image/jpeg');
  }

  async compressImage(entry: CompressedImage): Promise<void> {
    entry.status = 'compressing';
    entry.errorMsg = '';
    try {
      const blob = await this.doCompress(entry.file);
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      entry.compressedBlob = blob;
      entry.compressedSize = blob.size;
      entry.savings = Math.max(0, Math.round((1 - blob.size / entry.originalSize) * 100));
      entry.previewUrl = URL.createObjectURL(blob);
      entry.outputName = this.buildOutputName(entry.file);
      entry.status = 'done';
    } catch {
      entry.status = 'error';
      entry.errorMsg = 'Compression failed.';
    }
  }

  private doCompress(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);
        const mime = this.getOutputMime(file.type);
        const q = mime === 'image/png' ? undefined : this.quality / 100;
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob returned null'));
        }, mime, q);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
      img.src = objectUrl;
    });
  }

  async recompressAll(): Promise<void> {
    this.isCompressingAll = true;
    for (const entry of this.images) {
      await this.compressImage(entry);
    }
    this.isCompressingAll = false;
  }

  downloadSingle(entry: CompressedImage): void {
    if (!entry.compressedBlob) return;
    const url = URL.createObjectURL(entry.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.outputName;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadAll(): void {
    this.images
      .filter(e => e.status === 'done' && e.compressedBlob)
      .forEach(e => this.downloadSingle(e));
  }

  removeImage(index: number): void {
    const entry = this.images[index];
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    if (entry.originalUrl) URL.revokeObjectURL(entry.originalUrl);
    this.images.splice(index, 1);
  }

  clearAll(): void {
    this.images.forEach(entry => {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      if (entry.originalUrl) URL.revokeObjectURL(entry.originalUrl);
    });
    this.images = [];
    this.error = '';
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  get doneCount(): number {
    return this.images.filter(e => e.status === 'done').length;
  }

  get totalSavings(): number {
    const orig = this.images.reduce((s, e) => s + e.originalSize, 0);
    const comp = this.images.filter(e => e.status === 'done').reduce((s, e) => s + e.compressedSize, 0);
    const pending = this.images.filter(e => e.status !== 'done').reduce((s, e) => s + e.originalSize, 0);
    if (!orig) return 0;
    return Math.max(0, Math.round((1 - (comp + pending) / orig) * 100));
  }

  private detectWebPSupport(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    this.supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
}
