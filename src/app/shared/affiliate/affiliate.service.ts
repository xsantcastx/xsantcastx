/**
 * AffiliateService — maps tool categories to contextually relevant affiliate partners.
 *
 * Each partner entry includes UTM-tagged URLs, short CTA copy, and a
 * rel="sponsored" attribute for SEO compliance. Hidden when the user
 * is on a Pro tier (respects userService.isPro if available later).
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AffiliatePartner {
  /** Unique partner id */
  id: string;
  /** Partner display name */
  name: string;
  /** Short CTA headline (developer-first, no marketing fluff) */
  headline: string;
  /** One-liner benefit description */
  description: string;
  /** Affiliate URL with UTM parameters */
  url: string;
  /** Optional incentive text (e.g. "$200 free credit") */
  incentive?: string;
  /** SVG icon markup (small, inline) */
  iconSvg: string;
  /** Accent color for the CTA border highlight */
  accentColor: string;
}

/** Map of tool category → affiliate partners (ordered by relevance) */
const AFFILIATE_REGISTRY: Record<string, AffiliatePartner[]> = {
  'Email Tools': [
    {
      id: 'sendgrid',
      name: 'SendGrid',
      headline: 'Scale your email delivery',
      description: 'Free tier: 100 emails/day. Reliable API with detailed analytics.',
      url: 'https://sendgrid.com/free/?source=xsantcastx&utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=email_tools',
      incentive: 'Free tier available',
      iconSvg: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M4 9h16M9 4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
      accentColor: '#1A82E2',
    },
    {
      id: 'mailgun',
      name: 'Mailgun',
      headline: 'Transactional email API for devs',
      description: 'Powerful email APIs with real-time logs and validation.',
      url: 'https://www.mailgun.com/?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=email_tools',
      incentive: '5,000 free emails/month',
      iconSvg: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      accentColor: '#D44638',
    },
  ],

  'Security Tools': [
    {
      id: 'cloudflare',
      name: 'Cloudflare',
      headline: 'Free SSL, CDN & DDoS protection',
      description: 'Secure and accelerate your site with a global edge network.',
      url: 'https://www.cloudflare.com/?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=security_tools',
      incentive: 'Free plan available',
      iconSvg: `<path d="M12 2L4 5v6c0 5.5 3.8 10 8 11 4.2-1 8-5.5 8-11V5L12 2z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      accentColor: '#F48120',
    },
    {
      id: 'nordvpn',
      name: 'NordVPN',
      headline: 'Secure your dev environment',
      description: 'Encrypt traffic, access geo-restricted APIs, protect test data.',
      url: 'https://nordvpn.com/?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=security_tools',
      incentive: 'Up to 68% off',
      iconSvg: `<path d="M12 2L3 9l9 13 9-13-9-7z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
      accentColor: '#4687FF',
    },
  ],

  'Code Converters': [
    {
      id: 'jetbrains',
      name: 'JetBrains',
      headline: 'Professional IDEs for every language',
      description: 'IntelliJ, WebStorm, PyCharm — code smarter with AI assistance.',
      url: 'https://www.jetbrains.com/?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=code_tools',
      incentive: '30-day free trial',
      iconSvg: `<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 17h6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M7 7h3.5c1.5 0 2.5 1 2.5 2.5S12 12 10.5 12H7V7z" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
      accentColor: '#FC801D',
    },
  ],

  'CSS Tools': [
    {
      id: 'vercel',
      name: 'Vercel',
      headline: 'Ship your frontend instantly',
      description: 'Zero-config deploys for Next.js, Angular, and static sites.',
      url: 'https://vercel.com/?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=css_tools',
      incentive: 'Free hobby tier',
      iconSvg: `<polygon points="12,2 22,20 2,20" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
      accentColor: '#FFFFFF',
    },
  ],

  'Productivity': [
    {
      id: 'digitalocean',
      name: 'DigitalOcean',
      headline: 'Deploy your project in seconds',
      description: 'Simple cloud infrastructure with predictable pricing.',
      url: 'https://www.digitalocean.com/?refcode=xsantcastx&utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=productivity_tools',
      incentive: '$200 free credit',
      iconSvg: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
      accentColor: '#0080FF',
    },
  ],

  'SEO Tools': [
    {
      id: 'ahrefs',
      name: 'Ahrefs Webmaster Tools',
      headline: 'Monitor your SEO health for free',
      description: 'Site audit, backlink checker, and keyword explorer.',
      url: 'https://ahrefs.com/webmaster-tools?utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=seo_tools',
      incentive: 'Free for site owners',
      iconSvg: `<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
      accentColor: '#FF8C00',
    },
  ],
};

/** Fallback partners shown when no category-specific match exists */
const FALLBACK_PARTNERS: AffiliatePartner[] = [
  {
    id: 'digitalocean-general',
    name: 'DigitalOcean',
    headline: 'Simple cloud for developers',
    description: 'Spin up a droplet, deploy an app, or host a database — predictable pricing.',
    url: 'https://www.digitalocean.com/?refcode=xsantcastx&utm_source=xsantcastx&utm_medium=affiliate&utm_campaign=general',
    incentive: '$200 free credit',
    iconSvg: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    accentColor: '#0080FF',
  },
];

@Injectable({ providedIn: 'root' })
export class AffiliateService {
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Get the best affiliate partner for a tool category.
   * Returns the first (highest-relevance) partner, or a fallback.
   */
  getPartnerForCategory(category: string): AffiliatePartner | null {
    const partners = AFFILIATE_REGISTRY[category];
    if (partners && partners.length > 0) {
      return partners[0];
    }
    return FALLBACK_PARTNERS[0] ?? null;
  }

  /**
   * Get all partners for a category (for rotation or A/B testing later).
   */
  getAllPartnersForCategory(category: string): AffiliatePartner[] {
    return AFFILIATE_REGISTRY[category] ?? FALLBACK_PARTNERS;
  }

  /**
   * Track an affiliate click. Fires an analytics event if available.
   * Uses event tracking compatible with Google Analytics / Firebase Analytics.
   */
  trackClick(partnerId: string, toolSlug: string): void {
    if (!this.isBrowser) return;

    // Fire GA4 custom event if gtag is available
    const w = window as any;
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'affiliate_click', {
        partner_id: partnerId,
        tool_slug: toolSlug,
        event_category: 'monetization',
      });
    }
  }
}
