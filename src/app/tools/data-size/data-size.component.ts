import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

interface ConversionResult {
  label: string;
  unit: string;
  value: string;
  copied: boolean;
}

interface StorageItem {
  label: string;
  icon: string;
  avgSize: number;       // in bytes
  description: string;
}

type UnitSystem = 'binary' | 'decimal';

@Component({
    selector: 'app-data-size',
    templateUrl: './data-size.component.html',
    styleUrls: ['./data-size.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class DataSizeComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Data Size & Storage Calculator — convert bytes, KB, MB, GB, TB, PB with bandwidth & storage planning. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/data-size')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/data-size')}`;

  // ── Unit Converter ──────────────────────────────────────────
  inputValue: number | null = null;
  inputUnit = 'bytes';
  unitSystem: UnitSystem = 'binary';
  conversionResults: ConversionResult[] = [];

  readonly binaryUnits = [
    { value: 'bytes', label: 'Bytes (B)' },
    { value: 'kib',   label: 'Kibibytes (KiB)' },
    { value: 'mib',   label: 'Mebibytes (MiB)' },
    { value: 'gib',   label: 'Gibibytes (GiB)' },
    { value: 'tib',   label: 'Tebibytes (TiB)' },
    { value: 'pib',   label: 'Pebibytes (PiB)' },
  ];

  readonly decimalUnits = [
    { value: 'bytes', label: 'Bytes (B)' },
    { value: 'kb',    label: 'Kilobytes (KB)' },
    { value: 'mb',    label: 'Megabytes (MB)' },
    { value: 'gb',    label: 'Gigabytes (GB)' },
    { value: 'tb',    label: 'Terabytes (TB)' },
    { value: 'pb',    label: 'Petabytes (PB)' },
  ];

  get units() {
    return this.unitSystem === 'binary' ? this.binaryUnits : this.decimalUnits;
  }

  // ── Bandwidth Calculator ────────────────────────────────────
  bandwidthFileSize: number | null = null;
  bandwidthFileSizeUnit = 'mb';
  bandwidthSpeed: number | null = null;
  bandwidthSpeedUnit = 'mbps';
  transferTime = '';

  readonly fileSizeUnits = [
    { value: 'kb', label: 'KB' },
    { value: 'mb', label: 'MB' },
    { value: 'gb', label: 'GB' },
    { value: 'tb', label: 'TB' },
  ];

  readonly speedUnits = [
    { value: 'kbps',  label: 'Kbps' },
    { value: 'mbps',  label: 'Mbps' },
    { value: 'gbps',  label: 'Gbps' },
    { value: 'kBps',  label: 'KB/s' },
    { value: 'mBps',  label: 'MB/s' },
    { value: 'gBps',  label: 'GB/s' },
  ];

  // ── Storage Planner ─────────────────────────────────────────
  storageSizeValue: number | null = null;
  storageSizeUnit = 'gb';
  storagePlanResults: { item: StorageItem; count: number }[] = [];

  readonly storageItems: StorageItem[] = [
    { label: 'Photos (12MP JPEG)',      icon: 'camera',  avgSize: 4.5 * 1024 * 1024,   description: '~4.5 MB each' },
    { label: 'Photos (RAW)',            icon: 'camera',  avgSize: 25 * 1024 * 1024,     description: '~25 MB each' },
    { label: 'Songs (MP3 320kbps)',     icon: 'music',   avgSize: 8 * 1024 * 1024,      description: '~8 MB each (4 min)' },
    { label: 'Songs (FLAC)',            icon: 'music',   avgSize: 35 * 1024 * 1024,     description: '~35 MB each (4 min)' },
    { label: 'Videos (1080p, 1 min)',   icon: 'video',   avgSize: 150 * 1024 * 1024,    description: '~150 MB per minute' },
    { label: 'Videos (4K, 1 min)',      icon: 'video',   avgSize: 375 * 1024 * 1024,    description: '~375 MB per minute' },
    { label: 'PDF Documents',           icon: 'file',    avgSize: 2 * 1024 * 1024,      description: '~2 MB each' },
    { label: 'Word Documents',          icon: 'file',    avgSize: 500 * 1024,            description: '~500 KB each' },
    { label: 'Emails (with attachments)', icon: 'email', avgSize: 75 * 1024,            description: '~75 KB each' },
    { label: 'eBooks (EPUB)',           icon: 'file',    avgSize: 3 * 1024 * 1024,      description: '~3 MB each' },
  ];

  readonly storagePlanUnits = [
    { value: 'mb', label: 'MB' },
    { value: 'gb', label: 'GB' },
    { value: 'tb', label: 'TB' },
  ];

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Unit Conversion ─────────────────────────────────────────

  onInputChange() {
    if (this.inputValue === null || this.inputValue < 0) {
      this.conversionResults = [];
      return;
    }

    // Easter egg: input exactly 1337
    if (this.inputValue === 1337) {
      this.eggs.trigger('data-leet');
    }

    const bytes = this.toBytes(this.inputValue, this.inputUnit);
    this.conversionResults = this.computeAllConversions(bytes);
  }

  onSystemChange() {
    // Reset to bytes when switching systems to avoid confusion
    if (this.inputUnit !== 'bytes') {
      this.inputUnit = 'bytes';
    }
    this.onInputChange();
  }

  private toBytes(value: number, unit: string): number {
    switch (unit) {
      case 'bytes': return value;
      case 'kib':   return value * 1024;
      case 'mib':   return value * Math.pow(1024, 2);
      case 'gib':   return value * Math.pow(1024, 3);
      case 'tib':   return value * Math.pow(1024, 4);
      case 'pib':   return value * Math.pow(1024, 5);
      case 'kb':    return value * 1000;
      case 'mb':    return value * Math.pow(1000, 2);
      case 'gb':    return value * Math.pow(1000, 3);
      case 'tb':    return value * Math.pow(1000, 4);
      case 'pb':    return value * Math.pow(1000, 5);
      default:      return value;
    }
  }

  private computeAllConversions(bytes: number): ConversionResult[] {
    const results: ConversionResult[] = [];

    // Always show bytes
    results.push({ label: 'Bytes', unit: 'B', value: this.formatNumber(bytes), copied: false });
    results.push({ label: 'Bits', unit: 'bit', value: this.formatNumber(bytes * 8), copied: false });

    // Binary units
    results.push({ label: 'Kibibytes', unit: 'KiB', value: this.formatPrecise(bytes / 1024), copied: false });
    results.push({ label: 'Mebibytes', unit: 'MiB', value: this.formatPrecise(bytes / Math.pow(1024, 2)), copied: false });
    results.push({ label: 'Gibibytes', unit: 'GiB', value: this.formatPrecise(bytes / Math.pow(1024, 3)), copied: false });
    results.push({ label: 'Tebibytes', unit: 'TiB', value: this.formatPrecise(bytes / Math.pow(1024, 4)), copied: false });
    results.push({ label: 'Pebibytes', unit: 'PiB', value: this.formatPrecise(bytes / Math.pow(1024, 5)), copied: false });

    // Decimal units
    results.push({ label: 'Kilobytes', unit: 'KB', value: this.formatPrecise(bytes / 1000), copied: false });
    results.push({ label: 'Megabytes', unit: 'MB', value: this.formatPrecise(bytes / Math.pow(1000, 2)), copied: false });
    results.push({ label: 'Gigabytes', unit: 'GB', value: this.formatPrecise(bytes / Math.pow(1000, 3)), copied: false });
    results.push({ label: 'Terabytes', unit: 'TB', value: this.formatPrecise(bytes / Math.pow(1000, 4)), copied: false });
    results.push({ label: 'Petabytes', unit: 'PB', value: this.formatPrecise(bytes / Math.pow(1000, 5)), copied: false });

    return results;
  }

  private formatNumber(n: number): string {
    if (Number.isInteger(n) && n < 1e15) return n.toLocaleString('en-US');
    return n.toExponential(6);
  }

  private formatPrecise(n: number): string {
    if (n === 0) return '0';
    if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
    // Very small numbers
    if (n < 0.000001) return n.toExponential(6);
    return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  }

  // ── Bandwidth Calculator ────────────────────────────────────

  onBandwidthChange() {
    if (!this.bandwidthFileSize || !this.bandwidthSpeed || this.bandwidthSpeed <= 0) {
      this.transferTime = '';
      return;
    }

    const fileSizeBytes = this.toBytes(this.bandwidthFileSize, this.bandwidthFileSizeUnit);
    const fileSizeBits = fileSizeBytes * 8;

    let speedBitsPerSecond: number;
    switch (this.bandwidthSpeedUnit) {
      case 'kbps': speedBitsPerSecond = this.bandwidthSpeed * 1000; break;
      case 'mbps': speedBitsPerSecond = this.bandwidthSpeed * 1000000; break;
      case 'gbps': speedBitsPerSecond = this.bandwidthSpeed * 1000000000; break;
      case 'kBps': speedBitsPerSecond = this.bandwidthSpeed * 1000 * 8; break;
      case 'mBps': speedBitsPerSecond = this.bandwidthSpeed * 1000000 * 8; break;
      case 'gBps': speedBitsPerSecond = this.bandwidthSpeed * 1000000000 * 8; break;
      default:     speedBitsPerSecond = this.bandwidthSpeed * 1000000; break;
    }

    const totalSeconds = fileSizeBits / speedBitsPerSecond;
    this.transferTime = this.formatDuration(totalSeconds);
  }

  private formatDuration(totalSeconds: number): string {
    if (totalSeconds < 0.001) return '< 1 ms';
    if (totalSeconds < 1) return `${(totalSeconds * 1000).toFixed(1)} ms`;
    if (totalSeconds < 60) return `${totalSeconds.toFixed(2)} seconds`;

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  // ── Storage Planner ─────────────────────────────────────────

  onStoragePlanChange() {
    if (!this.storageSizeValue || this.storageSizeValue <= 0) {
      this.storagePlanResults = [];
      return;
    }

    const totalBytes = this.toBytes(this.storageSizeValue, this.storageSizeUnit);
    this.storagePlanResults = this.storageItems.map(item => ({
      item,
      count: Math.floor(totalBytes / item.avgSize)
    }));
  }

  // ── Actions ─────────────────────────────────────────────────

  async copyResult(result: ConversionResult) {
    if (!this.isBrowser) return;
    const text = `${result.value} ${result.unit}`;
    try {
      await navigator.clipboard.writeText(text);
      result.copied = true;
      setTimeout(() => (result.copied = false), 2000);
    } catch {
      this.fallbackCopy(text, result);
    }
  }

  private fallbackCopy(text: string, result: ConversionResult) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    result.copied = true;
    setTimeout(() => (result.copied = false), 2000);
  }

  loadSample() {
    this.inputValue = 1073741824;
    this.inputUnit = 'bytes';
    this.unitSystem = 'binary';
    this.onInputChange();
  }

  clearAll() {
    this.inputValue = null;
    this.inputUnit = 'bytes';
    this.conversionResults = [];
    this.bandwidthFileSize = null;
    this.bandwidthSpeed = null;
    this.transferTime = '';
    this.storageSizeValue = null;
    this.storagePlanResults = [];
  }

  formatCount(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString('en-US');
  }
}
