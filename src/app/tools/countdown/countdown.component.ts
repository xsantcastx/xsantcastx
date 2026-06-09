import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

@Component({
    selector: 'app-countdown',
    templateUrl: './countdown.component.html',
    styleUrls: ['./countdown.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class CountdownComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);
  private interval: ReturnType<typeof setInterval> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Countdown Timer — count down to any date!')}&url=${encodeURIComponent(SITE_URL + '/tools/countdown')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/countdown')}`;

  targetDate = '';
  targetTime = '00:00';
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;
  running = false;
  expired = false;
  copied = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  goBack() { this.router.navigate(['/tools']); }

  start() {
    if (!this.targetDate) return;
    if (this.interval) clearInterval(this.interval);

    const target = new Date(`${this.targetDate}T${this.targetTime || '00:00'}:00`);

    // Easter egg: Y2K
    if (target.getFullYear() === 2000 && target.getMonth() === 0 && target.getDate() === 1) {
      this.eggs.trigger('countdown-y2k');
    }

    this.running = true;
    this.expired = false;
    this.tick(target);
    this.interval = setInterval(() => this.tick(target), 1000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.running = false;
  }

  private tick(target: Date) {
    const now = new Date().getTime();
    const diff = target.getTime() - now;

    if (diff <= 0) {
      this.days = 0;
      this.hours = 0;
      this.minutes = 0;
      this.seconds = 0;
      this.expired = true;
      this.running = false;
      if (this.interval) clearInterval(this.interval);
      return;
    }

    this.days = Math.floor(diff / (1000 * 60 * 60 * 24));
    this.hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    this.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    this.seconds = Math.floor((diff % (1000 * 60)) / 1000);
  }

  get displayText(): string {
    return `${this.days}d ${this.pad(this.hours)}h ${this.pad(this.minutes)}m ${this.pad(this.seconds)}s`;
  }

  pad(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  async copyDisplay() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.displayText);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  clearAll() {
    this.stop();
    this.targetDate = '';
    this.targetTime = '00:00';
    this.days = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.expired = false;
  }
}
