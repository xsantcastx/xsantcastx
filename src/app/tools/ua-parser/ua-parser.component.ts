import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface ParsedUA {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  engine: string;
}

@Component({
  selector: 'app-ua-parser',
  templateUrl: './ua-parser.component.html',
  styleUrls: ['./ua-parser.component.css'],
  standalone: false
})
export class UaParserComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free User Agent Parser — detect browser, OS, device from any UA string')}&url=${encodeURIComponent(SITE_URL + '/tools/ua-parser')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/ua-parser')}`;

  uaString = '';
  parsed: ParsedUA | null = null;
  copied = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (this.isBrowser && navigator.userAgent) {
      this.uaString = navigator.userAgent;
      this.parseUA();
    }
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  onInput(): void {
    this.parseUA();
  }

  parseUA(): void {
    const ua = this.uaString.trim();
    if (!ua) { this.parsed = null; return; }

    const result: ParsedUA = {
      browser: 'Unknown', browserVersion: '', os: 'Unknown',
      osVersion: '', device: 'Desktop', engine: 'Unknown'
    };

    if (/Edg\//i.test(ua)) { result.browser = 'Microsoft Edge'; result.browserVersion = (ua.match(/Edg\/([\d.]+)/) || [])[1] || ''; }
    else if (/OPR\//i.test(ua)) { result.browser = 'Opera'; result.browserVersion = (ua.match(/OPR\/([\d.]+)/) || [])[1] || ''; }
    else if (/Chrome\//i.test(ua)) { result.browser = 'Chrome'; result.browserVersion = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || ''; }
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) { result.browser = 'Safari'; result.browserVersion = (ua.match(/Version\/([\d.]+)/) || [])[1] || ''; }
    else if (/Firefox\//i.test(ua)) { result.browser = 'Firefox'; result.browserVersion = (ua.match(/Firefox\/([\d.]+)/) || [])[1] || ''; }

    if (/Windows NT/i.test(ua)) { result.os = 'Windows'; result.osVersion = (ua.match(/Windows NT ([\d.]+)/) || [])[1] || ''; }
    else if (/Mac OS X/i.test(ua)) { result.os = 'macOS'; result.osVersion = ((ua.match(/Mac OS X ([\d_.]+)/) || [])[1] || '').replace(/_/g, '.'); }
    else if (/Android/i.test(ua)) { result.os = 'Android'; result.osVersion = (ua.match(/Android ([\d.]+)/) || [])[1] || ''; }
    else if (/iPhone|iPad/i.test(ua)) { result.os = 'iOS'; result.osVersion = ((ua.match(/OS ([\d_]+)/) || [])[1] || '').replace(/_/g, '.'); }
    else if (/Linux/i.test(ua)) { result.os = 'Linux'; }

    if (/Mobile/i.test(ua)) result.device = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) result.device = 'Tablet';

    if (/Gecko\//i.test(ua)) result.engine = 'Gecko';
    if (/AppleWebKit/i.test(ua)) result.engine = 'WebKit';
    if (/Chrome/i.test(ua) && /AppleWebKit/i.test(ua)) result.engine = 'Blink';

    this.parsed = result;

    if (/bot/i.test(ua)) {
      this.eggs.trigger('ua-bot');
    }
  }

  async copyResult(): Promise<void> {
    if (!this.parsed || !this.isBrowser) return;
    const text = `Browser: ${this.parsed.browser} ${this.parsed.browserVersion}\nOS: ${this.parsed.os} ${this.parsed.osVersion}\nDevice: ${this.parsed.device}\nEngine: ${this.parsed.engine}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch { /* fallback */ }
  }

  clearAll(): void {
    this.uaString = '';
    this.parsed = null;
  }

  loadSample(): void {
    this.uaString = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.parseUA();
  }
}
