import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly analytics = inject(AnalyticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const title = this.buildTitle(routerState);
    let resolved: string;

    if (title !== undefined) {
      // Avoid double-branding for titles that already contain the brand name
      resolved = title.includes('xsantcastx') ? title : `xsantcastx | ${title}`;
    } else {
      resolved = 'xsantcastx | Full-Stack Developer & Free Browser Tools';
    }
    this.title.setTitle(resolved);

    // @angular/fire's ScreenTrackingService used to emit this on every
    // navigation, but it drags the whole auth SDK into the initial bundle.
    // updateTitle() runs once per completed navigation, which is the same
    // moment, so the page_view is logged from here instead. AnalyticsService
    // queues it until the Analytics SDK finishes downloading.
    if (this.isBrowser) {
      this.analytics.trackPageView(routerState.url, resolved);
    }
  }
}

// Route title configuration to be used in app-routing.module.ts
export const RouteTitles = {
  home: 'Home - Portfolio & Services',
  about: 'About Me - Experience & Skills',
  portfolio: 'Portfolio - Projects & Work',
  projects: 'Projects - Recent Work',
  contact: 'Contact - Get In Touch',
  skills: 'Skills - Technical Expertise',
  resume: 'Resume - Professional Experience',
  services: 'Services - What I Offer',
  blog: 'Blog - Insights & Updates',
  donate: 'Support - Donate & Contribute',
  guestbook: 'Guestbook - Leave a Message',
  crypto: 'Crypto - Digital Assets',
  news: 'News - Latest Updates',
  eg: 'Example - Demo Content'
} as const;