import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface CronField {
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface Preset {
  label: string;
  expression: string;
  description: string;
}

@Component({
  selector: 'app-cron-builder',
  templateUrl: './cron-builder.component.html',
  styleUrls: ['./cron-builder.component.css'],
  standalone: false
})
export class CronBuilderComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Cron Expression Builder — build, validate and preview cron schedules visually. No sign-up needed!')}&url=${encodeURIComponent(SITE_URL + '/tools/cron-builder')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/cron-builder')}`;

  // Mode
  manualMode = false;
  manualInput = '';

  // Cron fields
  minute = '*';
  hour = '*';
  dayOfMonth = '*';
  month = '*';
  dayOfWeek = '*';

  // Output
  description = '';
  nextRuns: string[] = [];
  copied = false;

  // Field options
  minuteOptions = this.buildOptions(0, 59, 'minute');
  hourOptions = this.buildOptions(0, 23, 'hour');
  dayOfMonthOptions = this.buildOptions(1, 31, 'day');
  monthOptions = [
    { value: '*', label: 'Every month' },
    { value: '1', label: '1 - January' },
    { value: '2', label: '2 - February' },
    { value: '3', label: '3 - March' },
    { value: '4', label: '4 - April' },
    { value: '5', label: '5 - May' },
    { value: '6', label: '6 - June' },
    { value: '7', label: '7 - July' },
    { value: '8', label: '8 - August' },
    { value: '9', label: '9 - September' },
    { value: '10', label: '10 - October' },
    { value: '11', label: '11 - November' },
    { value: '12', label: '12 - December' },
  ];
  dayOfWeekOptions = [
    { value: '*', label: 'Every day' },
    { value: '0', label: '0 - Sunday' },
    { value: '1', label: '1 - Monday' },
    { value: '2', label: '2 - Tuesday' },
    { value: '3', label: '3 - Wednesday' },
    { value: '4', label: '4 - Thursday' },
    { value: '5', label: '5 - Friday' },
    { value: '6', label: '6 - Saturday' },
    { value: '1-5', label: '1-5 - Weekdays' },
    { value: '0,6', label: '0,6 - Weekends' },
  ];

  // Presets
  presets: Preset[] = [
    { label: 'Every minute', expression: '* * * * *', description: 'Runs every single minute' },
    { label: 'Every 5 minutes', expression: '*/5 * * * *', description: 'Runs every 5 minutes' },
    { label: 'Every 15 minutes', expression: '*/15 * * * *', description: 'Runs every 15 minutes' },
    { label: 'Every 30 minutes', expression: '*/30 * * * *', description: 'Runs every 30 minutes' },
    { label: 'Hourly', expression: '0 * * * *', description: 'At the start of every hour' },
    { label: 'Daily at midnight', expression: '0 0 * * *', description: 'Every day at 12:00 AM' },
    { label: 'Daily at noon', expression: '0 12 * * *', description: 'Every day at 12:00 PM' },
    { label: 'Weekdays at 9 AM', expression: '0 9 * * 1-5', description: 'Monday through Friday at 9:00 AM' },
    { label: 'Weekly (Sunday midnight)', expression: '0 0 * * 0', description: 'Every Sunday at 12:00 AM' },
    { label: 'Monthly (1st at midnight)', expression: '0 0 1 * *', description: '1st of every month at 12:00 AM' },
    { label: 'Yearly (Jan 1st)', expression: '0 0 1 1 *', description: 'January 1st at 12:00 AM' },
  ];

  constructor(private router: Router) {
    this.updateOutput();
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Field building ────────────────────────────────────────────

  private buildOptions(min: number, max: number, unit: string): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '*', label: `Every ${unit}` },
    ];
    // Common intervals
    if (unit === 'minute') {
      opts.push({ value: '*/5', label: 'Every 5 minutes' });
      opts.push({ value: '*/10', label: 'Every 10 minutes' });
      opts.push({ value: '*/15', label: 'Every 15 minutes' });
      opts.push({ value: '*/30', label: 'Every 30 minutes' });
    }
    if (unit === 'hour') {
      opts.push({ value: '*/2', label: 'Every 2 hours' });
      opts.push({ value: '*/4', label: 'Every 4 hours' });
      opts.push({ value: '*/6', label: 'Every 6 hours' });
      opts.push({ value: '*/12', label: 'Every 12 hours' });
    }
    for (let i = min; i <= max; i++) {
      opts.push({ value: String(i), label: String(i) });
    }
    return opts;
  }

  // ── Expression ────────────────────────────────────────────────

  get expression(): string {
    if (this.manualMode) {
      return this.manualInput.trim();
    }
    return `${this.minute} ${this.hour} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`;
  }

  // ── Preset ────────────────────────────────────────────────────

  applyPreset(preset: Preset) {
    const parts = preset.expression.split(' ');
    if (parts.length !== 5) return;
    this.minute = parts[0];
    this.hour = parts[1];
    this.dayOfMonth = parts[2];
    this.month = parts[3];
    this.dayOfWeek = parts[4];
    if (this.manualMode) {
      this.manualInput = preset.expression;
    }
    this.updateOutput();
  }

  // ── Field change ──────────────────────────────────────────────

  onFieldChange() {
    this.updateOutput();
  }

  onManualInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const parts = this.manualInput.trim().split(/\s+/);
      if (parts.length === 5) {
        this.minute = parts[0];
        this.hour = parts[1];
        this.dayOfMonth = parts[2];
        this.month = parts[3];
        this.dayOfWeek = parts[4];
      }
      this.updateOutput();
    }, 300);
  }

  toggleManualMode() {
    this.manualMode = !this.manualMode;
    if (this.manualMode) {
      this.manualInput = this.expression;
    }
  }

  // ── Output ────────────────────────────────────────────────────

  private updateOutput() {
    const expr = this.expression;
    this.description = this.describeExpression(expr);
    this.nextRuns = this.computeNextRuns(expr, 5);

    // Easter egg: every minute
    if (expr === '* * * * *') {
      this.eggs.trigger('cron-chaos');
    }
  }

  // ── Human-readable description ────────────────────────────────

  private describeExpression(expr: string): string {
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) return 'Invalid cron expression (need 5 fields)';

    const [min, hr, dom, mon, dow] = parts;

    // Validate basic format
    const fieldPattern = /^(\*|(\d+(-\d+)?(,\d+(-\d+)?)*))(\/\d+)?$/;
    const starSlash = /^(\*|\d+(-\d+)?(,\d+(-\d+)?)*)(\/\d+)?$/;
    for (const p of parts) {
      if (!starSlash.test(p) && p !== '*') {
        return `Invalid field value: "${p}"`;
      }
    }

    const segments: string[] = [];

    // Minute
    if (min === '*') {
      segments.push('Every minute');
    } else if (min.startsWith('*/')) {
      segments.push(`Every ${min.slice(2)} minutes`);
    } else {
      segments.push(`At minute ${min}`);
    }

    // Hour
    if (hr === '*') {
      // nothing extra if already "every minute"
      if (min !== '*' && !min.startsWith('*/')) {
        segments.push('of every hour');
      }
    } else if (hr.startsWith('*/')) {
      segments.push(`every ${hr.slice(2)} hours`);
    } else {
      const hourNum = parseInt(hr, 10);
      if (!isNaN(hourNum)) {
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const h12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
        const minStr = min === '0' ? '00' : min;
        segments.length = 0; // reset
        segments.push(`At ${h12}:${minStr.padStart(2, '0')} ${ampm}`);
      } else {
        segments.push(`at hour ${hr}`);
      }
    }

    // Day of month
    if (dom !== '*') {
      if (dom.startsWith('*/')) {
        segments.push(`every ${dom.slice(2)} days`);
      } else {
        segments.push(`on day ${dom} of the month`);
      }
    }

    // Month
    if (mon !== '*') {
      const monthNames: Record<string, string> = {
        '1': 'January', '2': 'February', '3': 'March', '4': 'April',
        '5': 'May', '6': 'June', '7': 'July', '8': 'August',
        '9': 'September', '10': 'October', '11': 'November', '12': 'December'
      };
      if (mon.startsWith('*/')) {
        segments.push(`every ${mon.slice(2)} months`);
      } else if (monthNames[mon]) {
        segments.push(`in ${monthNames[mon]}`);
      } else {
        segments.push(`in month ${mon}`);
      }
    }

    // Day of week
    if (dow !== '*') {
      const dayNames: Record<string, string> = {
        '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
        '4': 'Thursday', '5': 'Friday', '6': 'Saturday', '7': 'Sunday'
      };
      if (dow === '1-5') {
        segments.push('on weekdays');
      } else if (dow === '0,6' || dow === '6,0') {
        segments.push('on weekends');
      } else if (dayNames[dow]) {
        segments.push(`on ${dayNames[dow]}`);
      } else {
        segments.push(`on day-of-week ${dow}`);
      }
    }

    return segments.join(' ');
  }

  // ── Next run times ────────────────────────────────────────────

  private computeNextRuns(expr: string, count: number): string[] {
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) return [];

    const [minField, hrField, domField, monField, dowField] = parts;
    const results: string[] = [];

    if (!this.isBrowser) return [];

    const now = new Date();
    const candidate = new Date(now.getTime());
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    const maxIterations = 525600; // 1 year of minutes
    let iterations = 0;

    while (results.length < count && iterations < maxIterations) {
      iterations++;
      if (this.matchesCron(candidate, minField, hrField, domField, monField, dowField)) {
        results.push(this.formatDate(candidate));
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return results;
  }

  private matchesCron(date: Date, min: string, hr: string, dom: string, mon: string, dow: string): boolean {
    return (
      this.matchField(date.getMinutes(), min, 0, 59) &&
      this.matchField(date.getHours(), hr, 0, 23) &&
      this.matchField(date.getDate(), dom, 1, 31) &&
      this.matchField(date.getMonth() + 1, mon, 1, 12) &&
      this.matchField(date.getDay(), dow, 0, 6)
    );
  }

  private matchField(value: number, field: string, min: number, max: number): boolean {
    if (field === '*') return true;

    // Handle comma-separated values
    const parts = field.split(',');
    for (const part of parts) {
      // Handle step values */n or n/n
      if (part.includes('/')) {
        const [rangeStr, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        if (isNaN(step) || step <= 0) continue;

        if (rangeStr === '*') {
          if ((value - min) % step === 0) return true;
        } else {
          const start = parseInt(rangeStr, 10);
          if (!isNaN(start) && value >= start && (value - start) % step === 0) return true;
        }
        continue;
      }

      // Handle ranges n-m
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && value >= start && value <= end) return true;
        continue;
      }

      // Exact value
      const exact = parseInt(part, 10);
      if (!isNaN(exact) && value === exact) return true;
    }

    return false;
  }

  private formatDate(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const d = date.getDate();
    const year = date.getFullYear();
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${day}, ${month} ${d}, ${year} at ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  // ── Clipboard ─────────────────────────────────────────────────

  async copyExpression() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.expression);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(this.expression);
    }
  }

  private fallbackCopy(text: string) {
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
}
