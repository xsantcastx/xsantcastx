import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, NgZone, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface DeviceResolution {
  name: string;
  width: number;
  height: number;
  dpr: number;
  category: string;
}

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

@Component({
  selector: 'app-screen-info',
  templateUrl: './screen-info.component.html',
  styleUrls: ['./screen-info.component.css'],
  standalone: false
})
export class ScreenInfoComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private resizeListener: (() => void) | null = null;

  // Screen info
  screenWidth = 0;
  screenHeight = 0;
  viewportWidth = 0;
  viewportHeight = 0;
  devicePixelRatio = 1;
  colorDepth = 0;
  orientation = '';
  touchSupport = false;
  userAgent = '';

  // PPI calculator
  diagonalInches = 0;
  calculatedPPI = 0;

  // Breakpoint
  activeBreakpoint: Breakpoint = 'xl';

  // UI state
  copied = false;
  liveTracking = true;

  // Common device resolutions
  readonly deviceResolutions: DeviceResolution[] = [
    { name: 'iPhone SE',           width: 375,  height: 667,  dpr: 2,   category: 'Phone' },
    { name: 'iPhone 14',           width: 390,  height: 844,  dpr: 3,   category: 'Phone' },
    { name: 'iPhone 14 Pro Max',   width: 430,  height: 932,  dpr: 3,   category: 'Phone' },
    { name: 'iPhone 15 Pro',       width: 393,  height: 852,  dpr: 3,   category: 'Phone' },
    { name: 'iPhone 16 Pro Max',   width: 440,  height: 956,  dpr: 3,   category: 'Phone' },
    { name: 'Samsung Galaxy S24',  width: 360,  height: 780,  dpr: 3,   category: 'Phone' },
    { name: 'Pixel 8',            width: 412,  height: 915,  dpr: 2.625, category: 'Phone' },
    { name: 'iPad Mini',           width: 768,  height: 1024, dpr: 2,   category: 'Tablet' },
    { name: 'iPad Air',            width: 820,  height: 1180, dpr: 2,   category: 'Tablet' },
    { name: 'iPad Pro 11"',        width: 834,  height: 1194, dpr: 2,   category: 'Tablet' },
    { name: 'iPad Pro 12.9"',      width: 1024, height: 1366, dpr: 2,   category: 'Tablet' },
    { name: 'MacBook Air 13"',     width: 1440, height: 900,  dpr: 2,   category: 'Laptop' },
    { name: 'MacBook Pro 14"',     width: 1512, height: 982,  dpr: 2,   category: 'Laptop' },
    { name: 'MacBook Pro 16"',     width: 1728, height: 1117, dpr: 2,   category: 'Laptop' },
    { name: 'Full HD (1080p)',     width: 1920, height: 1080, dpr: 1,   category: 'Desktop' },
    { name: '2K (1440p)',          width: 2560, height: 1440, dpr: 1,   category: 'Desktop' },
    { name: '4K (2160p)',          width: 3840, height: 2160, dpr: 1,   category: 'Desktop' },
    { name: 'Ultrawide (3440)',    width: 3440, height: 1440, dpr: 1,   category: 'Desktop' },
  ];

  readonly deviceCategories = ['Phone', 'Tablet', 'Laptop', 'Desktop'];

  constructor(private router: Router, private ngZone: NgZone) {}

  ngOnInit() {
    if (!this.isBrowser) return;
    this.detectAll();

    // Easter egg: non-retina display
    if (this.devicePixelRatio === 1) {
      this.eggs.trigger('screen-classic');
    }
  }

  ngOnDestroy() {
    // Cleanup handled by HostListener decorator — no manual cleanup needed
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (!this.isBrowser || !this.liveTracking) return;
    this.ngZone.run(() => this.detectAll());
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Detection ────────────────────────────────────────────────────

  detectAll() {
    if (!this.isBrowser) return;

    this.screenWidth = window.screen.width;
    this.screenHeight = window.screen.height;
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.colorDepth = window.screen.colorDepth;
    this.orientation = this.getOrientation();
    this.touchSupport = this.detectTouch();
    this.userAgent = navigator.userAgent;
    this.activeBreakpoint = this.computeBreakpoint(this.viewportWidth);

    if (this.diagonalInches > 0) {
      this.calculatePPI();
    }
  }

  private getOrientation(): string {
    if (!this.isBrowser) return 'unknown';
    if (window.screen.orientation?.type) {
      const type = window.screen.orientation.type;
      if (type.includes('landscape')) return 'Landscape';
      if (type.includes('portrait')) return 'Portrait';
    }
    return window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait';
  }

  private detectTouch(): boolean {
    if (!this.isBrowser) return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // ── Breakpoint ───────────────────────────────────────────────────

  computeBreakpoint(width: number): Breakpoint {
    if (width < 480)  return 'xs';
    if (width < 640)  return 'sm';
    if (width < 768)  return 'md';
    if (width < 1024) return 'lg';
    if (width < 1280) return 'xl';
    return '2xl';
  }

  readonly breakpoints: { label: Breakpoint; min: number; max: number | null }[] = [
    { label: 'xs',  min: 0,    max: 479  },
    { label: 'sm',  min: 480,  max: 639  },
    { label: 'md',  min: 640,  max: 767  },
    { label: 'lg',  min: 768,  max: 1023 },
    { label: 'xl',  min: 1024, max: 1279 },
    { label: '2xl', min: 1280, max: null  },
  ];

  // ── PPI Calculator ───────────────────────────────────────────────

  onDiagonalChange() {
    if (this.diagonalInches > 0) {
      this.calculatePPI();
    } else {
      this.calculatedPPI = 0;
    }
  }

  private calculatePPI() {
    if (!this.isBrowser || this.diagonalInches <= 0) return;
    const physW = this.screenWidth * this.devicePixelRatio;
    const physH = this.screenHeight * this.devicePixelRatio;
    const diagonalPixels = Math.sqrt(physW * physW + physH * physH);
    this.calculatedPPI = Math.round(diagonalPixels / this.diagonalInches);
  }

  // ── Copy all info ────────────────────────────────────────────────

  async copyAllInfo() {
    if (!this.isBrowser) return;

    const lines = [
      `Screen Resolution: ${this.screenWidth} x ${this.screenHeight}`,
      `Viewport Size: ${this.viewportWidth} x ${this.viewportHeight}`,
      `Device Pixel Ratio: ${this.devicePixelRatio}`,
      `Physical Pixels: ${this.screenWidth * this.devicePixelRatio} x ${this.screenHeight * this.devicePixelRatio}`,
      `Color Depth: ${this.colorDepth}-bit`,
      `Orientation: ${this.orientation}`,
      `Touch Support: ${this.touchSupport ? 'Yes' : 'No'}`,
      `Active Breakpoint: ${this.activeBreakpoint}`,
      `User Agent: ${this.userAgent}`,
    ];

    if (this.calculatedPPI > 0) {
      lines.push(`Calculated PPI: ${this.calculatedPPI}`);
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(lines.join('\n'));
    }
  }

  private fallbackCopy(text: string) {
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
    setTimeout(() => (this.copied = false), 2000);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  get physicalWidth(): number {
    return Math.round(this.screenWidth * this.devicePixelRatio);
  }

  get physicalHeight(): number {
    return Math.round(this.screenHeight * this.devicePixelRatio);
  }

  getDevicesByCategory(category: string): DeviceResolution[] {
    return this.deviceResolutions.filter(d => d.category === category);
  }

  isCurrentMatch(device: DeviceResolution): boolean {
    return device.width === this.viewportWidth && device.height === this.viewportHeight;
  }
}
