import { Component, OnDestroy, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type ConvertMode = 'toDate' | 'toTimestamp';
type TimestampUnit = 'seconds' | 'milliseconds';

interface TimezoneOption {
  label: string;
  value: string;
}

@Component({
    selector: 'app-timestamp-converter',
    templateUrl: './timestamp-converter.component.html',
    styleUrls: ['./timestamp-converter.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class TimestampConverterComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Unix Timestamp Converter — seconds, milliseconds, timezones, relative time. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/timestamp-converter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/timestamp-converter')}`;

  // Mode & options
  mode: ConvertMode = 'toDate';
  unit: TimestampUnit = 'seconds';
  selectedTimezone = 'UTC';

  // Live clock
  currentTimestamp = 0;
  currentTimestampMs = 0;

  // Timestamp -> Date
  timestampInput = '';
  convertedDate = '';
  convertedISO = '';
  convertedRelative = '';
  convertedLocal = '';
  convertedUTC = '';

  // Date -> Timestamp
  dateInput = '';
  convertedTimestamp = '';
  convertedTimestampMs = '';

  // UI state
  errorMessage = '';
  copiedField = '';

  // Timezones
  readonly timezones: TimezoneOption[] = [
    { label: 'UTC', value: 'UTC' },
    { label: 'Local', value: 'local' },
    { label: 'US/Eastern (EST/EDT)', value: 'America/New_York' },
    { label: 'US/Central (CST/CDT)', value: 'America/Chicago' },
    { label: 'US/Mountain (MST/MDT)', value: 'America/Denver' },
    { label: 'US/Pacific (PST/PDT)', value: 'America/Los_Angeles' },
    { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
    { label: 'Europe/Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Asia/Shanghai (CST)', value: 'Asia/Shanghai' },
    { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
    { label: 'Asia/Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
    { label: 'Pacific/Auckland (NZST/NZDT)', value: 'Pacific/Auckland' },
    { label: 'America/Sao_Paulo (BRT)', value: 'America/Sao_Paulo' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    if (this.isBrowser) {
      this.updateLiveClock();
      this.tickInterval = setInterval(() => this.updateLiveClock(), 1000);
    }
  }

  ngOnDestroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Live clock ──────────────────────────────────────────────────

  private updateLiveClock() {
    const now = Date.now();
    this.currentTimestampMs = now;
    this.currentTimestamp = Math.floor(now / 1000);
  }

  // ── Mode switching ──────────────────────────────────────────────

  setMode(m: ConvertMode) {
    this.mode = m;
    this.clearAll();
  }

  setUnit(u: TimestampUnit) {
    this.unit = u;
    if (this.mode === 'toDate' && this.timestampInput) {
      this.convertTimestampToDate();
    }
  }

  onTimezoneChange() {
    if (this.mode === 'toDate' && this.timestampInput) {
      this.convertTimestampToDate();
    }
  }

  // ── Timestamp -> Date ───────────────────────────────────────────

  onTimestampInput() {
    this.errorMessage = '';
    if (!this.timestampInput.trim()) {
      this.clearResults();
      return;
    }
    this.convertTimestampToDate();
  }

  private convertTimestampToDate() {
    try {
      const raw = this.timestampInput.trim();
      const num = Number(raw);
      if (isNaN(num)) {
        this.errorMessage = 'Invalid timestamp — please enter a numeric value.';
        this.clearResults();
        return;
      }

      // Easter egg: epoch 0
      if (num === 0) {
        this.eggs.trigger('timestamp-epoch');
      }

      const ms = this.unit === 'seconds' ? num * 1000 : num;
      const date = new Date(ms);

      if (isNaN(date.getTime())) {
        this.errorMessage = 'Timestamp out of range.';
        this.clearResults();
        return;
      }

      this.convertedISO = date.toISOString();
      this.convertedUTC = date.toUTCString();
      this.convertedLocal = date.toLocaleString();
      this.convertedDate = this.formatInTimezone(date);
      this.convertedRelative = this.getRelativeTime(date);
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'Failed to convert timestamp.';
      this.clearResults();
    }
  }

  // ── Date -> Timestamp ───────────────────────────────────────────

  onDateInput() {
    this.errorMessage = '';
    if (!this.dateInput.trim()) {
      this.convertedTimestamp = '';
      this.convertedTimestampMs = '';
      return;
    }
    this.convertDateToTimestamp();
  }

  private convertDateToTimestamp() {
    try {
      const date = new Date(this.dateInput.trim());
      if (isNaN(date.getTime())) {
        this.errorMessage = 'Invalid date — try formats like "2024-01-15 14:30:00" or "Jan 15, 2024".';
        this.convertedTimestamp = '';
        this.convertedTimestampMs = '';
        return;
      }

      const ms = date.getTime();
      this.convertedTimestamp = Math.floor(ms / 1000).toString();
      this.convertedTimestampMs = ms.toString();
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'Failed to parse date.';
      this.convertedTimestamp = '';
      this.convertedTimestampMs = '';
    }
  }

  // ── Quick buttons ───────────────────────────────────────────────

  setNow() {
    const now = Date.now();
    if (this.mode === 'toDate') {
      this.timestampInput = this.unit === 'seconds'
        ? Math.floor(now / 1000).toString()
        : now.toString();
      this.convertTimestampToDate();
    } else {
      this.dateInput = new Date(now).toISOString();
      this.convertDateToTimestamp();
    }
  }

  setStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.applyQuickDate(today);
  }

  setStartOfYear() {
    const year = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);
    this.applyQuickDate(year);
  }

  setEpoch() {
    const epoch = new Date(0);
    this.applyQuickDate(epoch);
  }

  private applyQuickDate(date: Date) {
    if (this.mode === 'toDate') {
      const ms = date.getTime();
      this.timestampInput = this.unit === 'seconds'
        ? Math.floor(ms / 1000).toString()
        : ms.toString();
      this.convertTimestampToDate();
    } else {
      this.dateInput = date.toISOString();
      this.convertDateToTimestamp();
    }
  }

  // ── Copy ────────────────────────────────────────────────────────

  async copyValue(value: string, field: string) {
    if (!value || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      setTimeout(() => (this.copiedField = ''), 2000);
    } catch {
      this.fallbackCopy(value, field);
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
    this.copiedField = field;
    setTimeout(() => (this.copiedField = ''), 2000);
  }

  // ── Clear ───────────────────────────────────────────────────────

  clearAll() {
    this.timestampInput = '';
    this.dateInput = '';
    this.errorMessage = '';
    this.clearResults();
    this.convertedTimestamp = '';
    this.convertedTimestampMs = '';
  }

  private clearResults() {
    this.convertedDate = '';
    this.convertedISO = '';
    this.convertedRelative = '';
    this.convertedLocal = '';
    this.convertedUTC = '';
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private formatInTimezone(date: Date): string {
    try {
      if (this.selectedTimezone === 'local') {
        return date.toLocaleString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
      }
      return date.toLocaleString('en-US', {
        timeZone: this.selectedTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
    } catch {
      return date.toLocaleString();
    }
  }

  getRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const absDiff = Math.abs(diffMs);
    const isPast = diffMs > 0;

    if (absDiff < 1000) return 'just now';

    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30.44);
    const years = Math.floor(days / 365.25);

    let label: string;
    if (years > 0) label = `${years} year${years > 1 ? 's' : ''}`;
    else if (months > 0) label = `${months} month${months > 1 ? 's' : ''}`;
    else if (weeks > 0) label = `${weeks} week${weeks > 1 ? 's' : ''}`;
    else if (days > 0) label = `${days} day${days > 1 ? 's' : ''}`;
    else if (hours > 0) label = `${hours} hour${hours > 1 ? 's' : ''}`;
    else if (minutes > 0) label = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    else label = `${seconds} second${seconds > 1 ? 's' : ''}`;

    return isPast ? `${label} ago` : `in ${label}`;
  }

  get hasResults(): boolean {
    return this.mode === 'toDate'
      ? !!this.convertedDate
      : !!(this.convertedTimestamp || this.convertedTimestampMs);
  }
}
