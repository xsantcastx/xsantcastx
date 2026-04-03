import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  category: 'phone' | 'tablet' | 'laptop' | 'desktop';
  icon: string;
}

export interface PreviewSlot {
  device: DevicePreset | null;
  rotated: boolean;
  url: string;
  loaded: boolean;
}

@Component({
  selector: 'app-responsive-preview',
  templateUrl: './responsive-preview.component.html',
  styleUrls: ['./responsive-preview.component.css'],
  standalone: false
})
export class ResponsivePreviewComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly sanitizer = inject(DomSanitizer);

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  readonly presets: DevicePreset[] = [
    { name: 'iPhone SE',       width: 375,  height: 667,  category: 'phone',   icon: 'phone_iphone' },
    { name: 'iPhone 14',       width: 390,  height: 844,  category: 'phone',   icon: 'phone_iphone' },
    { name: 'iPhone 15 Pro',   width: 393,  height: 852,  category: 'phone',   icon: 'phone_iphone' },
    { name: 'iPad',            width: 810,  height: 1080, category: 'tablet',  icon: 'tablet_mac' },
    { name: 'MacBook',         width: 1440, height: 900,  category: 'laptop',  icon: 'laptop_mac' },
    { name: 'Desktop 1080p',   width: 1920, height: 1080, category: 'desktop', icon: 'desktop_windows' },
    { name: 'Desktop 4K',      width: 3840, height: 2160, category: 'desktop', icon: 'desktop_windows' },
  ];

  url = '';
  activeUrl = '';

  // Custom size
  customWidth: number | null = null;
  customHeight: number | null = null;

  // Single preview
  activeDevice: DevicePreset | null = null;
  rotated = false;
  showFrame = true;
  iframeLoaded = false;

  // Compare mode
  compareMode = false;
  slotA: PreviewSlot = { device: null, rotated: false, url: '', loaded: false };
  slotB: PreviewSlot = { device: null, rotated: false, url: '', loaded: false };

  // Zoom
  zoom = 100;
  readonly zoomLevels = [25, 50, 75, 100, 125, 150];

  constructor(private router: Router) {
    // Default to iPhone 14
    this.activeDevice = this.presets[1];
    this.slotA.device = this.presets[0]; // iPhone SE
    this.slotB.device = this.presets[4]; // MacBook
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  loadUrl(): void {
    if (!this.url.trim()) return;
    let normalized = this.url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    this.activeUrl = normalized;
    this.iframeLoaded = false;
    this.slotA.url = normalized;
    this.slotA.loaded = false;
    this.slotB.url = normalized;
    this.slotB.loaded = false;
  }

  selectDevice(device: DevicePreset): void {
    this.activeDevice = device;
    this.customWidth = null;
    this.customHeight = null;
    this.iframeLoaded = false;
  }

  selectCompareDevice(slot: 'A' | 'B', device: DevicePreset): void {
    if (slot === 'A') {
      this.slotA.device = device;
      this.slotA.loaded = false;
    } else {
      this.slotB.device = device;
      this.slotB.loaded = false;
    }
  }

  applyCustomSize(): void {
    if (this.customWidth && this.customWidth > 0 && this.customHeight && this.customHeight > 0) {
      this.activeDevice = {
        name: 'Custom',
        width: this.customWidth,
        height: this.customHeight,
        category: 'desktop',
        icon: 'aspect_ratio'
      };
      this.iframeLoaded = false;

      // Easter egg: 1px width
      if (this.customWidth === 1) {
        this.eggs.trigger('responsive-pixel');
      }
    }
  }

  toggleRotate(): void {
    this.rotated = !this.rotated;
    this.iframeLoaded = false;
  }

  toggleCompareRotate(slot: 'A' | 'B'): void {
    if (slot === 'A') {
      this.slotA.rotated = !this.slotA.rotated;
      this.slotA.loaded = false;
    } else {
      this.slotB.rotated = !this.slotB.rotated;
      this.slotB.loaded = false;
    }
  }

  toggleCompareMode(): void {
    this.compareMode = !this.compareMode;
    if (this.compareMode && this.activeUrl) {
      this.slotA.url = this.activeUrl;
      this.slotB.url = this.activeUrl;
    }
  }

  toggleFrame(): void {
    this.showFrame = !this.showFrame;
  }

  setZoom(level: number): void {
    this.zoom = level;
  }

  onIframeLoad(): void {
    this.iframeLoaded = true;
  }

  onSlotLoad(slot: 'A' | 'B'): void {
    if (slot === 'A') this.slotA.loaded = true;
    else this.slotB.loaded = true;
  }

  // ── Dimension helpers ──────────────────────────────────────────

  get currentWidth(): number {
    if (!this.activeDevice) return 375;
    return this.rotated ? this.activeDevice.height : this.activeDevice.width;
  }

  get currentHeight(): number {
    if (!this.activeDevice) return 667;
    return this.rotated ? this.activeDevice.width : this.activeDevice.height;
  }

  getSlotWidth(slot: PreviewSlot): number {
    if (!slot.device) return 375;
    return slot.rotated ? slot.device.height : slot.device.width;
  }

  getSlotHeight(slot: PreviewSlot): number {
    if (!slot.device) return 667;
    return slot.rotated ? slot.device.width : slot.device.height;
  }

  get scaleFactor(): number {
    return this.zoom / 100;
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'phone': return 'phone_iphone';
      case 'tablet': return 'tablet_mac';
      case 'laptop': return 'laptop_mac';
      case 'desktop': return 'desktop_windows';
      default: return 'devices';
    }
  }

  get isPhone(): boolean {
    return this.activeDevice?.category === 'phone';
  }

  get isTablet(): boolean {
    return this.activeDevice?.category === 'tablet';
  }

  get frameClass(): string {
    if (!this.showFrame || !this.activeDevice) return '';
    if (this.activeDevice.category === 'phone') return 'rp-frame--phone';
    if (this.activeDevice.category === 'tablet') return 'rp-frame--tablet';
    if (this.activeDevice.category === 'laptop') return 'rp-frame--laptop';
    return '';
  }

  getFrameClass(slot: PreviewSlot): string {
    if (!this.showFrame || !slot.device) return '';
    if (slot.device.category === 'phone') return 'rp-frame--phone';
    if (slot.device.category === 'tablet') return 'rp-frame--tablet';
    if (slot.device.category === 'laptop') return 'rp-frame--laptop';
    return '';
  }
}
