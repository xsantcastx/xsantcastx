import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface TzResult { timezone: string; time: string; date: string; offset: string; }

@Component({
    selector: 'app-timezone-converter',
    templateUrl: './timezone-converter.component.html',
    styleUrls: ['./timezone-converter.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class TimezoneConverterComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Timezone Converter — convert times between 30+ timezones!')}&url=${encodeURIComponent(SITE_URL + '/tools/timezone-converter')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/timezone-converter')}`;

  sourceTimezone = 'UTC';
  targetTimezone = 'America/New_York';
  inputTime = '';
  inputDate = '';
  result: TzResult | null = null;
  copied = false;

  readonly timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
    'America/Mexico_City', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
    'Europe/Amsterdam', 'Europe/Moscow', 'Europe/Istanbul',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Hong_Kong',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
  ];

  constructor(private router: Router) {
    const now = new Date();
    this.inputDate = now.toISOString().split('T')[0];
    this.inputTime = now.toTimeString().slice(0, 5);
  }

  goBack() { this.router.navigate(['/tools']); }

  convert() {
    if (!this.inputDate || !this.inputTime) return;

    if (this.sourceTimezone === this.targetTimezone) {
      this.eggs.trigger('tz-same');
    }

    try {
      const dateStr = `${this.inputDate}T${this.inputTime}:00`;
      const sourceDate = new Date(dateStr);

      const targetTime = sourceDate.toLocaleTimeString('en-US', {
        timeZone: this.targetTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const targetDate = sourceDate.toLocaleDateString('en-US', {
        timeZone: this.targetTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const offset = this.getOffset(sourceDate, this.targetTimezone);

      this.result = {
        timezone: this.targetTimezone,
        time: targetTime,
        date: targetDate,
        offset,
      };
    } catch {
      this.result = null;
    }
  }

  private getOffset(date: Date, tz: string): string {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    const diff = (tzDate.getTime() - utcDate.getTime()) / 3600000;
    const sign = diff >= 0 ? '+' : '';
    return `UTC${sign}${diff}`;
  }

  get worldClock(): TzResult[] {
    const now = new Date();
    const popular = ['UTC', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'];
    return popular.map(tz => ({
      timezone: tz,
      time: now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }),
      date: now.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' }),
      offset: this.getOffset(now, tz),
    }));
  }

  async copyResult() {
    if (!this.result || !this.isBrowser) return;
    const text = `${this.result.timezone}: ${this.result.time} - ${this.result.date} (${this.result.offset})`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
