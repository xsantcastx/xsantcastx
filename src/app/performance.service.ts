import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Performance, trace } from '@angular/fire/performance';
import { AnalyticsService } from './analytics.service';

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private performance = inject(Performance);
  private analyticsService = inject(AnalyticsService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor() {
    if (this.isBrowser) {
      this.initializePerformanceTracking();
    }
  }

  /**
   * Initialize automatic performance tracking
   */
  private initializePerformanceTracking(): void {
    // Track page load performance when page fully loads
    window.addEventListener('load', () => {
      this.trackPageLoadPerformance();
    });

    // Track Core Web Vitals if available
    if ('web-vital' in window) {
      this.trackCoreWebVitals();
    }
  }

  /**
   * Create a custom trace for performance monitoring
   */
  createTrace(traceName: string): any {
    if (!this.isBrowser) return null;
    
    return trace(this.performance, traceName);
  }

  /**
   * Track component load time
   */
  async trackComponentLoad(componentName: string): Promise<void> {
    if (!this.isBrowser) return;

    const traceInstance = this.createTrace(`component_${componentName}_load`);
    traceInstance?.start();

    // Simulate component load completion
    setTimeout(() => {
      traceInstance?.stop();
    }, 100);
  }

  /**
   * Track API call performance
   */
  async trackApiCall(apiEndpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE'): Promise<any> {
    if (!this.isBrowser) return null;

    const traceName = `api_${method}_${apiEndpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const traceInstance = this.createTrace(traceName);
    
    traceInstance?.start();
    
    return {
      stop: () => traceInstance?.stop(),
      addAttribute: (name: string, value: string) => traceInstance?.putAttribute(name, value)
    };
  }

  /**
   * Track page load performance metrics
   */
  private trackPageLoadPerformance(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        // Calculate key metrics
        const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        const pageLoad = navigation.loadEventEnd - navigation.fetchStart;
        const ttfb = navigation.responseStart - navigation.requestStart;
        const domInteractive = navigation.domInteractive - navigation.fetchStart;

        // Track with Firebase Performance
        const pageLoadTrace = this.createTrace('page_load_complete');
        pageLoadTrace?.start();
        pageLoadTrace?.putMetric('dom_content_loaded_ms', Math.round(domContentLoaded));
        pageLoadTrace?.putMetric('page_load_ms', Math.round(pageLoad));
        pageLoadTrace?.putMetric('ttfb_ms', Math.round(ttfb));
        pageLoadTrace?.putMetric('dom_interactive_ms', Math.round(domInteractive));
        pageLoadTrace?.stop();

        // Also track with Analytics for cross-platform analysis
        this.analyticsService.trackPerformance('page_load_time', Math.round(pageLoad), 'ms');
        this.analyticsService.trackPerformance('dom_content_loaded', Math.round(domContentLoaded), 'ms');
        this.analyticsService.trackPerformance('ttfb', Math.round(ttfb), 'ms');
      }
    }, 1000);
  }

  /**
   * Track Core Web Vitals (if supported)
   */
  private trackCoreWebVitals(): void {
    if (!this.isBrowser) return;

    // Track Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          const lcpTrace = this.createTrace('core_web_vital_lcp');
          lcpTrace?.start();
          lcpTrace?.putMetric('lcp_ms', Math.round(lastEntry.startTime));
          lcpTrace?.stop();
          
          this.analyticsService.trackPerformance('lcp', Math.round(lastEntry.startTime), 'ms');
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Track First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            const fidTrace = this.createTrace('core_web_vital_fid');
            fidTrace?.start();
            fidTrace?.putMetric('fid_ms', Math.round(entry.processingStart - entry.startTime));
            fidTrace?.stop();
            
            this.analyticsService.trackPerformance('fid', Math.round(entry.processingStart - entry.startTime), 'ms');
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Track Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          
          if (clsValue > 0) {
            const clsTrace = this.createTrace('core_web_vital_cls');
            clsTrace?.start();
            clsTrace?.putMetric('cls_score', Math.round(clsValue * 1000)); // multiply by 1000 for better precision
            clsTrace?.stop();
            
            this.analyticsService.trackPerformance('cls', clsValue, 'count');
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }
  }

  /**
   * Track form submission performance
   */
  trackFormSubmission(formName: string): any {
    if (!this.isBrowser) return null;

    const traceInstance = this.createTrace(`form_submit_${formName}`);
    traceInstance?.start();
    
    return {
      success: () => {
        traceInstance?.putAttribute('result', 'success');
        traceInstance?.stop();
      },
      error: (errorMessage: string) => {
        traceInstance?.putAttribute('result', 'error');
        traceInstance?.putAttribute('error_message', errorMessage);
        traceInstance?.stop();
      }
    };
  }

  /**
   * Track image load performance
   */
  trackImageLoad(imageUrl: string, loadTime: number): void {
    if (!this.isBrowser) return;

    const traceInstance = this.createTrace('image_load');
    traceInstance?.start();
    traceInstance?.putAttribute('image_url', imageUrl);
    traceInstance?.putMetric('load_time_ms', Math.round(loadTime));
    traceInstance?.stop();

    this.analyticsService.trackPerformance('image_load', loadTime, 'ms');
  }

  /**
   * Track JavaScript bundle size and load time
   */
  trackBundlePerformance(): void {
    if (!this.isBrowser) return;

    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resourceEntries.filter(entry => 
      entry.name.includes('.js') && 
      (entry.name.includes('main') || entry.name.includes('vendor'))
    );

    jsResources.forEach(resource => {
      const fileName = resource.name.split('/').pop() || 'unknown';
      const loadTime = resource.responseEnd - resource.requestStart;
      const size = resource.transferSize || 0;

      const bundleTrace = this.createTrace(`bundle_${fileName}`);
      bundleTrace?.start();
      bundleTrace?.putMetric('load_time_ms', Math.round(loadTime));
      bundleTrace?.putMetric('size_bytes', size);
      bundleTrace?.stop();

      this.analyticsService.trackPerformance(`bundle_${fileName}_load`, loadTime, 'ms');
      this.analyticsService.trackPerformance(`bundle_${fileName}_size`, size, 'bytes');
    });
  }
}