import { Component, ViewChild, ElementRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

/** 3x3 color-vision transformation matrices (Brettel / Vienot models) */
const MATRICES: Record<string, number[][]> = {
  protanopia: [
    [0.56667, 0.43333, 0.00000],
    [0.55833, 0.44167, 0.00000],
    [0.00000, 0.24167, 0.75833],
  ],
  deuteranopia: [
    [0.62500, 0.37500, 0.00000],
    [0.70000, 0.30000, 0.00000],
    [0.00000, 0.30000, 0.70000],
  ],
  tritanopia: [
    [0.95000, 0.05000, 0.00000],
    [0.00000, 0.43333, 0.56667],
    [0.00000, 0.47500, 0.52500],
  ],
  protanomaly: [
    [0.81667, 0.18333, 0.00000],
    [0.33333, 0.66667, 0.00000],
    [0.00000, 0.12500, 0.87500],
  ],
  deuteranomaly: [
    [0.80000, 0.20000, 0.00000],
    [0.25833, 0.74167, 0.00000],
    [0.00000, 0.14167, 0.85833],
  ],
  tritanomaly: [
    [0.96667, 0.03333, 0.00000],
    [0.00000, 0.73333, 0.26667],
    [0.00000, 0.18333, 0.81667],
  ],
  achromatopsia: [
    [0.29900, 0.58700, 0.11400],
    [0.29900, 0.58700, 0.11400],
    [0.29900, 0.58700, 0.11400],
  ],
};

interface SimResult {
  key: string;
  label: string;
  description: string;
  hex: string;
  rgb: [number, number, number];
}

interface ContrastResult {
  type: string;
  label: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
}

@Component({
  selector: 'app-color-blindness',
  templateUrl: './color-blindness.component.html',
  styleUrls: ['./color-blindness.component.css'],
  standalone: false,
})
export class ColorBlindnessComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceCanvas') sourceCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Color Blindness Simulator — see how your colors look under every type of color vision deficiency.')}&url=${encodeURIComponent(SITE_URL + '/tools/color-blindness')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/color-blindness')}`;

  // Color input
  hexInput = '#e74c3c';
  selectedColor = '#e74c3c';

  // Simulation results
  simulations: SimResult[] = [];

  // Contrast check
  textColor = '#ffffff';
  bgColor = '#e74c3c';
  textColorInput = '#ffffff';
  bgColorInput = '#e74c3c';
  sampleText = 'The quick brown fox jumps over the lazy dog';
  contrastResults: ContrastResult[] = [];

  // Image mode
  imageLoaded = false;
  isDragOver = false;
  imageName = '';
  originalImageData: ImageData | null = null;
  imageWidth = 0;
  imageHeight = 0;
  selectedFilter = 'normal';

  readonly filterOptions = [
    { key: 'normal', label: 'Original' },
    { key: 'protanopia', label: 'Protanopia' },
    { key: 'deuteranopia', label: 'Deuteranopia' },
    { key: 'tritanopia', label: 'Tritanopia' },
    { key: 'protanomaly', label: 'Protanomaly' },
    { key: 'deuteranomaly', label: 'Deuteranomaly' },
    { key: 'tritanomaly', label: 'Tritanomaly' },
    { key: 'achromatopsia', label: 'Achromatopsia' },
  ];

  readonly typeDescriptions: Record<string, string> = {
    protanopia: 'Red-blind (no red cones)',
    deuteranopia: 'Green-blind (no green cones)',
    tritanopia: 'Blue-blind (no blue cones)',
    protanomaly: 'Red-weak (anomalous red cones)',
    deuteranomaly: 'Green-weak (anomalous green cones)',
    tritanomaly: 'Blue-weak (anomalous blue cones)',
    achromatopsia: 'Total color blindness (monochromacy)',
  };

  constructor(private router: Router) {
    this.simulate();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Color simulation ──────────────────────────────────────────

  onHexInput() {
    const cleaned = this.hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      this.selectedColor = cleaned;
      this.simulate();
    }
  }

  onPickerChange(value: string) {
    this.selectedColor = value;
    this.hexInput = value;
    this.simulate();
  }

  simulate() {
    const rgb = this.hexToRgb(this.selectedColor);
    if (!rgb) return;

    // Easter egg: pure gray #808080
    if (this.selectedColor.toLowerCase() === '#808080') {
      this.eggs.trigger('cb-gray-world');
    }

    this.simulations = Object.entries(MATRICES).map(([key, matrix]) => {
      const transformed = this.applyMatrix(rgb, matrix);
      return {
        key,
        label: this.formatLabel(key),
        description: this.typeDescriptions[key] || '',
        hex: this.rgbToHex(transformed),
        rgb: transformed,
      };
    });
  }

  // ── Contrast checking ─────────────────────────────────────────

  onTextColorInput() {
    const cleaned = this.textColorInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      this.textColor = cleaned;
      this.computeContrast();
    }
  }

  onTextPickerChange(value: string) {
    this.textColor = value;
    this.textColorInput = value;
    this.computeContrast();
  }

  onBgColorInput() {
    const cleaned = this.bgColorInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      this.bgColor = cleaned;
      this.computeContrast();
    }
  }

  onBgPickerChange(value: string) {
    this.bgColor = value;
    this.bgColorInput = value;
    this.computeContrast();
  }

  computeContrast() {
    const fgRgb = this.hexToRgb(this.textColor);
    const bgRgb = this.hexToRgb(this.bgColor);
    if (!fgRgb || !bgRgb) return;

    const results: ContrastResult[] = [];

    // Original
    const origRatio = this.contrastRatio(fgRgb, bgRgb);
    results.push({
      type: 'original',
      label: 'Original',
      fgHex: this.textColor,
      bgHex: this.bgColor,
      ratio: origRatio,
      aa: origRatio >= 4.5,
      aaLarge: origRatio >= 3,
      aaa: origRatio >= 7,
    });

    // Each CVD type
    for (const [key, matrix] of Object.entries(MATRICES)) {
      const fgT = this.applyMatrix(fgRgb, matrix);
      const bgT = this.applyMatrix(bgRgb, matrix);
      const ratio = this.contrastRatio(fgT, bgT);
      results.push({
        type: key,
        label: this.formatLabel(key),
        fgHex: this.rgbToHex(fgT),
        bgHex: this.rgbToHex(bgT),
        ratio,
        aa: ratio >= 4.5,
        aaLarge: ratio >= 3,
        aaa: ratio >= 7,
      });
    }

    this.contrastResults = results;
  }

  private relativeLuminance(rgb: [number, number, number]): number {
    const [rs, gs, bs] = rgb.map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  private contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
    const l1 = this.relativeLuminance(fg);
    const l2 = this.relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  // ── Image mode ────────────────────────────────────────────────

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.loadImage(file);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file && file.type.startsWith('image/')) this.loadImage(file);
    input.value = '';
  }

  private loadImage(file: File) {
    if (!this.isBrowser) return;
    this.imageName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Limit canvas size for performance
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        this.imageWidth = w;
        this.imageHeight = h;

        // Draw to source canvas to capture pixel data
        const srcCanvas = this.sourceCanvasRef.nativeElement;
        srcCanvas.width = w;
        srcCanvas.height = h;
        const srcCtx = srcCanvas.getContext('2d')!;
        srcCtx.drawImage(img, 0, 0, w, h);
        this.originalImageData = srcCtx.getImageData(0, 0, w, h);

        // Set display canvas
        const canvas = this.canvasRef.nativeElement;
        canvas.width = w;
        canvas.height = h;

        this.imageLoaded = true;
        this.selectedFilter = 'normal';
        this.applyImageFilter();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onFilterChange() {
    this.applyImageFilter();
  }

  private applyImageFilter() {
    if (!this.isBrowser || !this.originalImageData) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const src = this.originalImageData;

    if (this.selectedFilter === 'normal') {
      ctx.putImageData(src, 0, 0);
      return;
    }

    const matrix = MATRICES[this.selectedFilter];
    if (!matrix) return;

    const output = ctx.createImageData(src.width, src.height);
    const srcData = src.data;
    const outData = output.data;

    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];

      outData[i] = Math.min(255, Math.max(0, Math.round(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b)));
      outData[i + 1] = Math.min(255, Math.max(0, Math.round(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b)));
      outData[i + 2] = Math.min(255, Math.max(0, Math.round(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b)));
      outData[i + 3] = srcData[i + 3]; // alpha
    }

    ctx.putImageData(output, 0, 0);
  }

  clearImage() {
    this.imageLoaded = false;
    this.imageName = '';
    this.originalImageData = null;
    this.selectedFilter = 'normal';
  }

  // ── Helpers ───────────────────────────────────────────────────

  private applyMatrix(rgb: [number, number, number], matrix: number[][]): [number, number, number] {
    return [
      Math.min(255, Math.max(0, Math.round(matrix[0][0] * rgb[0] + matrix[0][1] * rgb[1] + matrix[0][2] * rgb[2]))),
      Math.min(255, Math.max(0, Math.round(matrix[1][0] * rgb[0] + matrix[1][1] * rgb[1] + matrix[1][2] * rgb[2]))),
      Math.min(255, Math.max(0, Math.round(matrix[2][0] * rgb[0] + matrix[2][1] * rgb[1] + matrix[2][2] * rgb[2]))),
    ];
  }

  hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return null;
    return [
      parseInt(m[1].substring(0, 2), 16),
      parseInt(m[1].substring(2, 4), 16),
      parseInt(m[1].substring(4, 6), 16),
    ];
  }

  private rgbToHex(rgb: [number, number, number]): string {
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
  }

  private formatLabel(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  getTextColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#ffffff';
    const lum = this.relativeLuminance(rgb);
    return lum > 0.179 ? '#000000' : '#ffffff';
  }
}
