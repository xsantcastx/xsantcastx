import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export interface CronField {
  name: string;
  allowed: string;
  specials: string;
}

export interface CronExpression {
  expression: string;
  description: string;
  category: 'common' | 'system' | 'business' | 'devops' | 'database' | 'misc';
  nextRun: string;
}

export interface CronWildcard {
  symbol: string;
  name: string;
  description: string;
  example: string;
  exampleMeaning: string;
}

export type ExpressionCategory = 'all' | 'common' | 'system' | 'business' | 'devops' | 'database' | 'misc';

@Component({
  selector: 'app-crontab-ref',
  templateUrl: './crontab-ref.component.html',
  styleUrls: ['./crontab-ref.component.css'],
  standalone: false
})
export class CrontabRefComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Crontab Quick Reference — visual cron syntax guide with 30+ expressions, search, and copy. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/crontab-ref')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/crontab-ref')}`;

  // Search & filter
  searchQuery = '';
  activeCategory: ExpressionCategory = 'all';

  // Copy state
  copiedIndex: number | null = null;

  // Active section
  activeSection: 'expressions' | 'syntax' | 'wildcards' | 'info' = 'expressions';

  // ── Cron fields ─────────────────────────────────────────────────────────────
  readonly cronFields: CronField[] = [
    { name: 'Minute',      allowed: '0 - 59',    specials: '* , - /' },
    { name: 'Hour',        allowed: '0 - 23',    specials: '* , - /' },
    { name: 'Day (month)', allowed: '1 - 31',    specials: '* , - /' },
    { name: 'Month',       allowed: '1 - 12',    specials: '* , - /' },
    { name: 'Day (week)',  allowed: '0 - 6 (Sun=0)', specials: '* , - /' },
  ];

  // ── Visual syntax fields for the diagram ─────────────────────────────────────
  readonly syntaxFields = [
    { label: 'Minute',  value: '*', color: '#00ffcc' },
    { label: 'Hour',    value: '*', color: '#ff6ec7' },
    { label: 'Day',     value: '*', color: '#fbbf24' },
    { label: 'Month',   value: '*', color: '#60a5fa' },
    { label: 'Weekday', value: '*', color: '#a78bfa' },
  ];

  // ── Wildcards ───────────────────────────────────────────────────────────────
  readonly wildcards: CronWildcard[] = [
    { symbol: '*',  name: 'Asterisk',  description: 'Matches every possible value for the field.',                           example: '* * * * *',    exampleMeaning: 'Every minute of every hour, every day' },
    { symbol: '/',  name: 'Slash',     description: 'Defines step intervals. Divides range into increments.',                example: '*/15 * * * *', exampleMeaning: 'Every 15 minutes' },
    { symbol: '-',  name: 'Hyphen',    description: 'Defines a range of values (inclusive).',                                example: '0 9-17 * * *', exampleMeaning: 'On the hour, 9 AM through 5 PM' },
    { symbol: ',',  name: 'Comma',     description: 'Specifies a list of discrete values.',                                  example: '0 0 1,15 * *', exampleMeaning: 'Midnight on the 1st and 15th of each month' },
  ];

  // ── Category metadata ──────────────────────────────────────────────────────
  readonly categories: { key: ExpressionCategory; label: string; color: string }[] = [
    { key: 'all',      label: 'All',       color: 'var(--text-muted)' },
    { key: 'common',   label: 'Common',    color: '#00ffcc' },
    { key: 'system',   label: 'System',    color: '#60a5fa' },
    { key: 'business', label: 'Business',  color: '#fbbf24' },
    { key: 'devops',   label: 'DevOps',    color: '#a78bfa' },
    { key: 'database', label: 'Database',  color: '#f87171' },
    { key: 'misc',     label: 'Misc',      color: '#34d399' },
  ];

  // ── Cron vs Crontab ────────────────────────────────────────────────────────
  readonly cronVsCrontab = [
    { term: 'cron',    definition: 'The daemon (background service) that runs scheduled commands on Unix-like systems. It reads crontab files and executes jobs at the specified times. The name comes from the Greek word "chronos" (time).' },
    { term: 'crontab', definition: 'Short for "cron table". It is the file (and the command to edit it) where you define your scheduled cron jobs. Each user can have their own crontab, and there is also a system-wide crontab.' },
    { term: 'cron job', definition: 'A single scheduled task defined in a crontab. It consists of a cron expression (the schedule) and a command to execute.' },
  ];

  // ── System crontab locations ───────────────────────────────────────────────
  readonly crontabLocations = [
    { path: '/etc/crontab',           description: 'System-wide crontab (includes user field)' },
    { path: '/etc/cron.d/',           description: 'Directory for package-specific cron files' },
    { path: '/etc/cron.daily/',       description: 'Scripts run once per day' },
    { path: '/etc/cron.hourly/',      description: 'Scripts run once per hour' },
    { path: '/etc/cron.weekly/',      description: 'Scripts run once per week' },
    { path: '/etc/cron.monthly/',     description: 'Scripts run once per month' },
    { path: '/var/spool/cron/crontabs/', description: 'Per-user crontab files (Linux)' },
    { path: '/var/cron/tabs/',        description: 'Per-user crontab files (FreeBSD/macOS)' },
  ];

  // ── 30+ Common cron expressions ────────────────────────────────────────────
  readonly expressions: CronExpression[] = [
    // Common
    { expression: '* * * * *',         description: 'Every minute',                              category: 'common',   nextRun: this.getNextRun('* * * * *') },
    { expression: '*/5 * * * *',       description: 'Every 5 minutes',                           category: 'common',   nextRun: this.getNextRun('*/5 * * * *') },
    { expression: '*/10 * * * *',      description: 'Every 10 minutes',                          category: 'common',   nextRun: this.getNextRun('*/10 * * * *') },
    { expression: '*/15 * * * *',      description: 'Every 15 minutes',                          category: 'common',   nextRun: this.getNextRun('*/15 * * * *') },
    { expression: '*/30 * * * *',      description: 'Every 30 minutes',                          category: 'common',   nextRun: this.getNextRun('*/30 * * * *') },
    { expression: '0 * * * *',         description: 'Every hour (on the hour)',                   category: 'common',   nextRun: this.getNextRun('0 * * * *') },
    { expression: '0 */2 * * *',       description: 'Every 2 hours',                             category: 'common',   nextRun: this.getNextRun('0 */2 * * *') },
    { expression: '0 */6 * * *',       description: 'Every 6 hours',                             category: 'common',   nextRun: this.getNextRun('0 */6 * * *') },
    { expression: '0 0 * * *',         description: 'Every day at midnight',                     category: 'common',   nextRun: this.getNextRun('0 0 * * *') },
    { expression: '0 12 * * *',        description: 'Every day at noon',                         category: 'common',   nextRun: this.getNextRun('0 12 * * *') },

    // System
    { expression: '0 0 * * 0',         description: 'Every Sunday at midnight',                  category: 'system',   nextRun: this.getNextRun('0 0 * * 0') },
    { expression: '0 0 1 * *',         description: 'First day of every month at midnight',      category: 'system',   nextRun: this.getNextRun('0 0 1 * *') },
    { expression: '0 0 1 1 *',         description: 'January 1st at midnight (yearly)',          category: 'system',   nextRun: this.getNextRun('0 0 1 1 *') },
    { expression: '0 4 * * *',         description: 'Daily at 4 AM (maintenance window)',        category: 'system',   nextRun: this.getNextRun('0 4 * * *') },
    { expression: '0 3 * * 0',         description: 'Sunday at 3 AM (weekly maintenance)',       category: 'system',   nextRun: this.getNextRun('0 3 * * 0') },
    { expression: '0 2 * * *',         description: 'Daily at 2 AM (log rotation)',              category: 'system',   nextRun: this.getNextRun('0 2 * * *') },

    // Business
    { expression: '0 9 * * 1-5',       description: 'Weekdays at 9 AM (business open)',          category: 'business', nextRun: this.getNextRun('0 9 * * 1-5') },
    { expression: '0 17 * * 1-5',      description: 'Weekdays at 5 PM (business close)',         category: 'business', nextRun: this.getNextRun('0 17 * * 1-5') },
    { expression: '0 9-17 * * 1-5',    description: 'Every hour during business hours',          category: 'business', nextRun: this.getNextRun('0 9-17 * * 1-5') },
    { expression: '30 8 * * 1-5',      description: 'Weekdays at 8:30 AM (standup reminder)',    category: 'business', nextRun: this.getNextRun('30 8 * * 1-5') },
    { expression: '0 10 * * 1',        description: 'Every Monday at 10 AM (weekly report)',     category: 'business', nextRun: this.getNextRun('0 10 * * 1') },
    { expression: '0 0 1,15 * *',      description: '1st and 15th of month (payroll)',           category: 'business', nextRun: this.getNextRun('0 0 1,15 * *') },

    // DevOps
    { expression: '*/2 * * * *',       description: 'Every 2 minutes (health check)',            category: 'devops',   nextRun: this.getNextRun('*/2 * * * *') },
    { expression: '0 */4 * * *',       description: 'Every 4 hours (SSL cert check)',            category: 'devops',   nextRun: this.getNextRun('0 */4 * * *') },
    { expression: '0 1 * * *',         description: 'Daily at 1 AM (deploy to staging)',         category: 'devops',   nextRun: this.getNextRun('0 1 * * *') },
    { expression: '0 0 * * 5',         description: 'Every Friday at midnight (weekly deploy)',   category: 'devops',   nextRun: this.getNextRun('0 0 * * 5') },
    { expression: '*/30 9-17 * * 1-5', description: 'Every 30 min during work hours (monitoring)', category: 'devops', nextRun: this.getNextRun('*/30 9-17 * * 1-5') },

    // Database
    { expression: '0 3 * * *',         description: 'Daily at 3 AM (database backup)',           category: 'database', nextRun: this.getNextRun('0 3 * * *') },
    { expression: '0 2 * * 0',         description: 'Sunday at 2 AM (full DB dump)',             category: 'database', nextRun: this.getNextRun('0 2 * * 0') },
    { expression: '0 */12 * * *',      description: 'Every 12 hours (incremental backup)',       category: 'database', nextRun: this.getNextRun('0 */12 * * *') },
    { expression: '0 5 1 * *',         description: 'Monthly at 5 AM (DB optimization)',         category: 'database', nextRun: this.getNextRun('0 5 1 * *') },

    // Misc
    { expression: '0 6 * * *',         description: 'Daily at 6 AM (morning digest email)',      category: 'misc',     nextRun: this.getNextRun('0 6 * * *') },
    { expression: '0 20 * * *',        description: 'Daily at 8 PM (evening summary)',           category: 'misc',     nextRun: this.getNextRun('0 20 * * *') },
    { expression: '0 0 25 12 *',       description: 'Christmas Day at midnight',                 category: 'misc',     nextRun: this.getNextRun('0 0 25 12 *') },
    { expression: '0 0 14 2 *',        description: 'Valentine\'s Day at midnight',              category: 'misc',     nextRun: this.getNextRun('0 0 14 2 *') },
    { expression: '0 0 31 10 *',       description: 'Halloween at midnight',                     category: 'misc',     nextRun: this.getNextRun('0 0 31 10 *') },
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Section navigation ─────────────────────────────────────────────────────

  setSection(section: 'expressions' | 'syntax' | 'wildcards' | 'info') {
    this.activeSection = section;
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  get filteredExpressions(): CronExpression[] {
    let results = this.expressions;

    if (this.activeCategory !== 'all') {
      results = results.filter(e => e.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      results = results.filter(e =>
        e.expression.includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredExpressions.length;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  onSearchInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.checkEasterEgg();
    }, 300);
  }

  private checkEasterEgg() {
    const q = this.searchQuery.trim().toLowerCase();
    if (q === 'midnight') {
      this.eggs.trigger('cron-midnight');
    }
  }

  setCategory(cat: ExpressionCategory) {
    this.activeCategory = cat;
  }

  // ── Copy ───────────────────────────────────────────────────────────────────

  async copyExpression(expr: CronExpression, index: number) {
    if (!this.isBrowser) return;
    const text = `${expr.expression}  # ${expr.description}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex = index;
      setTimeout(() => (this.copiedIndex = null), 2000);
    } catch {
      this.fallbackCopy(text, index);
    }
  }

  private fallbackCopy(text: string, index: number) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedIndex = index;
    setTimeout(() => (this.copiedIndex = null), 2000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getCategoryColor(category: string): string {
    const found = this.categories.find(c => c.key === category);
    return found ? found.color : 'var(--text-muted)';
  }

  /**
   * Compute approximate next run time for a cron expression.
   * This is a simplified client-side calculation.
   */
  getNextRun(expr: string): string {
    try {
      const parts = expr.split(/\s+/);
      if (parts.length !== 5) return 'Invalid expression';

      const now = new Date();
      const [minPart, hourPart, dayPart, monthPart, weekdayPart] = parts;

      // For simple expressions, calculate the next occurrence
      const candidate = new Date(now);
      candidate.setSeconds(0);
      candidate.setMilliseconds(0);

      // Try finding the next run within the next 400 days
      for (let i = 0; i < 400 * 24 * 60; i++) {
        candidate.setTime(now.getTime() + i * 60000);
        candidate.setSeconds(0);
        candidate.setMilliseconds(0);

        if (i === 0 && candidate.getTime() <= now.getTime()) continue;

        if (this.fieldMatches(minPart, candidate.getMinutes()) &&
            this.fieldMatches(hourPart, candidate.getHours()) &&
            this.fieldMatches(dayPart, candidate.getDate()) &&
            this.fieldMatches(monthPart, candidate.getMonth() + 1) &&
            this.fieldMatches(weekdayPart, candidate.getDay())) {
          return this.formatNextRun(candidate);
        }

        // Skip ahead if minutes don't match to speed up search
        if (!this.fieldMatches(minPart, candidate.getMinutes())) {
          continue;
        }
      }
      return 'Over 1 year away';
    } catch {
      return 'Could not calculate';
    }
  }

  private fieldMatches(field: string, value: number): boolean {
    if (field === '*') return true;

    // Handle step values: */n or start/step
    if (field.includes('/')) {
      const [rangePart, stepStr] = field.split('/');
      const step = parseInt(stepStr, 10);
      if (rangePart === '*') {
        return value % step === 0;
      }
      // range/step like 9-17/2
      if (rangePart.includes('-')) {
        const [start, end] = rangePart.split('-').map(Number);
        return value >= start && value <= end && (value - start) % step === 0;
      }
      const start = parseInt(rangePart, 10);
      return value >= start && (value - start) % step === 0;
    }

    // Handle comma-separated values
    if (field.includes(',')) {
      return field.split(',').some(v => {
        if (v.includes('-')) {
          const [start, end] = v.split('-').map(Number);
          return value >= start && value <= end;
        }
        return parseInt(v, 10) === value;
      });
    }

    // Handle ranges
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }

    // Exact value
    return parseInt(field, 10) === value;
  }

  private formatNextRun(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (diffMins < 1) return 'In less than a minute';
    if (diffMins < 60) return `In ${diffMins} min — ${timeStr}`;
    if (diffHours < 24) return `In ${diffHours}h — ${timeStr}`;
    if (diffDays < 7) return `In ${diffDays}d — ${dateStr} ${timeStr}`;
    return `${dateStr} ${timeStr}`;
  }
}
