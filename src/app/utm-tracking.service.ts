import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AnalyticsService } from './analytics.service';

export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  gclid?: string; // Google Ads Click ID
  fbclid?: string; // Facebook Click ID
  msclkid?: string; // Microsoft Ads Click ID
  ttclid?: string; // TikTok Click ID
}

export interface CampaignData {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
  id?: string;
  firstVisit: string;
  lastVisit: string;
  sessionCount: number;
  clickId?: string;
  clickIdType?: 'gclid' | 'fbclid' | 'msclkid' | 'ttclid';
}

@Injectable({
  providedIn: 'root'
})
export class UTMTrackingService {
  private analyticsService = inject(AnalyticsService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  
  private readonly STORAGE_KEY = 'xsantcastx_utm_data';
  private readonly SESSION_KEY = 'xsantcastx_session_utm';
  private readonly UTM_EXPIRY_DAYS = 30;

  constructor() {
    if (this.isBrowser) {
      this.initializeUTMTracking();
    }
  }

  /**
   * Initialize UTM tracking on page load and route changes
   */
  private initializeUTMTracking(): void {
    // Capture UTM parameters on initial page load
    this.captureUTMParameters();

    // Track UTM parameters on route changes (SPA navigation)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.captureUTMParameters();
    });
  }

  /**
   * Capture and store UTM parameters from URL
   */
  private captureUTMParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = this.extractUTMFromURL(urlParams);
    
    if (Object.keys(utmParams).length > 0) {
      this.storeUTMData(utmParams);
      this.trackCampaignVisit(utmParams);
    }

    // Update session UTM data regardless
    this.updateSessionData(utmParams);
  }

  /**
   * Extract UTM parameters from URL search params
   */
  private extractUTMFromURL(urlParams: URLSearchParams): UTMParameters {
    const utm: UTMParameters = {};
    
    // Standard UTM parameters
    if (urlParams.has('utm_source')) utm.utm_source = urlParams.get('utm_source')!;
    if (urlParams.has('utm_medium')) utm.utm_medium = urlParams.get('utm_medium')!;
    if (urlParams.has('utm_campaign')) utm.utm_campaign = urlParams.get('utm_campaign')!;
    if (urlParams.has('utm_term')) utm.utm_term = urlParams.get('utm_term')!;
    if (urlParams.has('utm_content')) utm.utm_content = urlParams.get('utm_content')!;
    if (urlParams.has('utm_id')) utm.utm_id = urlParams.get('utm_id')!;
    
    // Platform-specific click IDs
    if (urlParams.has('gclid')) utm.gclid = urlParams.get('gclid')!;
    if (urlParams.has('fbclid')) utm.fbclid = urlParams.get('fbclid')!;
    if (urlParams.has('msclkid')) utm.msclkid = urlParams.get('msclkid')!;
    if (urlParams.has('ttclid')) utm.ttclid = urlParams.get('ttclid')!;

    return utm;
  }

  /**
   * Store UTM data in localStorage with expiration
   */
  private storeUTMData(utmParams: UTMParameters): void {
    const existingData = this.getStoredCampaignData();
    const now = new Date().toISOString();
    
    const campaignData: CampaignData = {
      source: utmParams.utm_source || 'direct',
      medium: utmParams.utm_medium || 'none',
      campaign: utmParams.utm_campaign || 'none',
      term: utmParams.utm_term,
      content: utmParams.utm_content,
      id: utmParams.utm_id,
      firstVisit: existingData?.firstVisit || now,
      lastVisit: now,
      sessionCount: (existingData?.sessionCount || 0) + 1,
      ...this.extractClickIdData(utmParams)
    };

    const dataWithExpiry = {
      data: campaignData,
      expiry: Date.now() + (this.UTM_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataWithExpiry));
  }

  /**
   * Extract click ID data from UTM parameters
   */
  private extractClickIdData(utmParams: UTMParameters): { clickId?: string; clickIdType?: 'gclid' | 'fbclid' | 'msclkid' | 'ttclid' } {
    if (utmParams.gclid) return { clickId: utmParams.gclid, clickIdType: 'gclid' };
    if (utmParams.fbclid) return { clickId: utmParams.fbclid, clickIdType: 'fbclid' };
    if (utmParams.msclkid) return { clickId: utmParams.msclkid, clickIdType: 'msclkid' };
    if (utmParams.ttclid) return { clickId: utmParams.ttclid, clickIdType: 'ttclid' };
    return {};
  }

  /**
   * Update session data for current visit
   */
  private updateSessionData(utmParams: UTMParameters): void {
    const sessionData = {
      ...utmParams,
      sessionStart: new Date().toISOString(),
      referrer: document.referrer
    };

    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
  }

  /**
   * Track campaign visit with analytics
   */
  private trackCampaignVisit(utmParams: UTMParameters): void {
    this.analyticsService.trackCustomEvent('campaign_visit', {
      source: utmParams.utm_source || 'direct',
      medium: utmParams.utm_medium || 'none',
      campaign: utmParams.utm_campaign || 'none',
      term: utmParams.utm_term || '',
      content: utmParams.utm_content || '',
      campaign_id: utmParams.utm_id || '',
      click_id: this.getClickIdValue(utmParams),
      click_id_type: this.getClickIdType(utmParams)
    });
  }

  /**
   * Get click ID value from UTM parameters
   */
  private getClickIdValue(utmParams: UTMParameters): string {
    return utmParams.gclid || utmParams.fbclid || utmParams.msclkid || utmParams.ttclid || '';
  }

  /**
   * Get click ID type from UTM parameters
   */
  private getClickIdType(utmParams: UTMParameters): string {
    if (utmParams.gclid) return 'google';
    if (utmParams.fbclid) return 'facebook';
    if (utmParams.msclkid) return 'microsoft';
    if (utmParams.ttclid) return 'tiktok';
    return '';
  }

  /**
   * Get stored campaign data
   */
  getStoredCampaignData(): CampaignData | null {
    if (!this.isBrowser) return null;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      
      // Check if data has expired
      if (Date.now() > parsed.expiry) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  /**
   * Get current session UTM data
   */
  getSessionUTMData(): UTMParameters | null {
    if (!this.isBrowser) return null;

    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Attach UTM data to lead/conversion events
   */
  attachUTMToEvent(eventData: any): any {
    const campaignData = this.getStoredCampaignData();
    
    if (!campaignData) return eventData;

    return {
      ...eventData,
      source: campaignData.source,
      medium: campaignData.medium,
      campaign: campaignData.campaign,
      term: campaignData.term || '',
      content: campaignData.content || '',
      campaign_id: campaignData.id || '',
      first_visit: campaignData.firstVisit,
      session_count: campaignData.sessionCount,
      click_id: campaignData.clickId || '',
      click_id_type: campaignData.clickIdType || ''
    };
  }

  /**
   * Track lead generation with UTM attribution
   */
  trackLeadWithUTM(leadType: string, additionalData?: any): void {
    const eventData = this.attachUTMToEvent({
      lead_type: leadType,
      ...additionalData
    });

    this.analyticsService.trackCustomEvent('generate_lead', eventData);
  }

  /**
   * Track conversion with UTM attribution
   */
  trackConversionWithUTM(conversionType: string, value?: number, currency?: string): void {
    const eventData = this.attachUTMToEvent({
      conversion_type: conversionType,
      value: value || 0,
      currency: currency || 'USD'
    });

    this.analyticsService.trackCustomEvent('conversion', eventData);
  }

  /**
   * Clear all UTM data (for testing or privacy)
   */
  clearUTMData(): void {
    if (!this.isBrowser) return;

    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Get attribution report for current user
   */
  getAttributionReport(): any {
    const campaignData = this.getStoredCampaignData();
    const sessionData = this.getSessionUTMData();

    return {
      firstTouch: campaignData,
      lastTouch: sessionData,
      sessionCount: campaignData?.sessionCount || 1,
      daysSinceFirstVisit: campaignData ? 
        Math.floor((Date.now() - new Date(campaignData.firstVisit).getTime()) / (1000 * 60 * 60 * 24)) : 0
    };
  }

  /**
   * Generate campaign URL with tracking parameters
   */
  generateCampaignURL(baseUrl: string, campaign: Partial<UTMParameters>): string {
    const url = new URL(baseUrl);
    
    Object.entries(campaign).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }
}