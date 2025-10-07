import { Injectable } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const title = this.buildTitle(routerState);
    
    if (title !== undefined) {
      // Set page title with brand prefix for SEO and Analytics
      this.title.setTitle(`xsantcastx | ${title}`);
    } else {
      // Default title when no specific title is set
      this.title.setTitle('xsantcastx | Full Stack Developer & Digital Solutions');
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