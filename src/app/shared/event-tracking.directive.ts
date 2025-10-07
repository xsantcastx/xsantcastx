import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';
import { AnalyticsService } from '../analytics.service';
import { PerformanceService } from '../performance.service';

@Directive({
  selector: '[trackEvent]',
  standalone: true
})
export class EventTrackingDirective {
  @Input() trackEvent!: string;
  @Input() trackCategory?: string;
  @Input() trackLabel?: string;
  @Input() trackValue?: number;
  @Input() trackData?: { [key: string]: any };

  private analyticsService = inject(AnalyticsService);
  private performanceService = inject(PerformanceService);
  private elementRef = inject(ElementRef);

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    const element = this.elementRef.nativeElement;
    
    // Handle different types of tracking based on element type and attributes
    if (this.isOutboundLink(element)) {
      this.trackOutboundClick(element, event);
    } else if (this.isFileDownload(element)) {
      this.trackFileDownload(element);
    } else if (this.isFormSubmit(element)) {
      this.trackFormSubmit(element);
    } else {
      this.trackGenericEvent();
    }
  }

  private isOutboundLink(element: HTMLElement): boolean {
    if (element.tagName !== 'A') return false;
    
    const href = (element as HTMLAnchorElement).href;
    if (!href) return false;

    try {
      const linkDomain = new URL(href).hostname;
      const currentDomain = window.location.hostname;
      return linkDomain !== currentDomain;
    } catch {
      return false;
    }
  }

  private isFileDownload(element: HTMLElement): boolean {
    if (element.tagName !== 'A') return false;
    
    const href = (element as HTMLAnchorElement).href;
    if (!href) return false;

    const fileExtensions = ['.pdf', '.doc', '.docx', '.zip', '.csv', '.xlsx', '.ppt', '.pptx'];
    return fileExtensions.some(ext => href.toLowerCase().includes(ext));
  }

  private isFormSubmit(element: HTMLElement): boolean {
    return element.tagName === 'BUTTON' && element.getAttribute('type') === 'submit';
  }

  private trackOutboundClick(element: HTMLAnchorElement, event: Event): void {
    const href = element.href;
    const linkText = element.textContent?.trim() || '';
    
    this.analyticsService.trackOutboundLink(href, linkText);
    
    // Optional: Add small delay to ensure tracking completes
    if (this.trackData && 'preventDefault' in this.trackData && this.trackData['preventDefault']) {
      event.preventDefault();
      setTimeout(() => {
        window.open(href, element.target || '_self');
      }, 150);
    }
  }

  private trackFileDownload(element: HTMLAnchorElement): void {
    const href = element.href;
    const fileName = href.split('/').pop() || 'unknown';
    const fileExtension = fileName.split('.').pop() || 'unknown';
    
    this.analyticsService.trackFileDownload(fileName, fileExtension);
  }

  private trackFormSubmit(element: HTMLElement): void {
    const form = element.closest('form');
    const formId = form?.id || form?.getAttribute('name') || 'unknown';
    
    this.analyticsService.trackFormInteraction(formId, 'submit');
  }

  private trackGenericEvent(): void {
    if (!this.trackEvent) return;

    const eventData = {
      event_category: this.trackCategory || 'engagement',
      event_label: this.trackLabel || '',
      value: this.trackValue || 1,
      ...this.trackData
    };

    this.analyticsService.trackCustomEvent(this.trackEvent, eventData);
  }
}

@Directive({
  selector: '[trackFormStart]',
  standalone: true
})
export class FormStartTrackingDirective {
  @Input() formId!: string;
  
  private analyticsService = inject(AnalyticsService);
  private hasTrackedStart = false;

  @HostListener('focusin', ['$event'])
  onFormStart(event: Event): void {
    if (!this.hasTrackedStart) {
      this.analyticsService.trackFormInteraction(this.formId, 'start');
      this.hasTrackedStart = true;
    }
  }
}

@Directive({
  selector: '[trackVideoPlay]',
  standalone: true
})
export class VideoTrackingDirective {
  @Input() videoId!: string;
  @Input() videoTitle?: string;
  
  private analyticsService = inject(AnalyticsService);
  private elementRef = inject(ElementRef);

  @HostListener('play', ['$event'])
  onPlay(): void {
    const video = this.elementRef.nativeElement as HTMLVideoElement;
    this.analyticsService.trackVideoInteraction(this.videoId, 'play', video.currentTime);
  }

  @HostListener('pause', ['$event'])
  onPause(): void {
    const video = this.elementRef.nativeElement as HTMLVideoElement;
    this.analyticsService.trackVideoInteraction(this.videoId, 'pause', video.currentTime);
  }

  @HostListener('ended', ['$event'])
  onEnded(): void {
    const video = this.elementRef.nativeElement as HTMLVideoElement;
    this.analyticsService.trackVideoInteraction(this.videoId, 'complete', video.currentTime);
  }
}

@Directive({
  selector: '[trackImageLoad]',
  standalone: true
})
export class ImageLoadTrackingDirective {
  private performanceService = inject(PerformanceService);
  private elementRef = inject(ElementRef);
  private startTime = Date.now();

  @HostListener('load', ['$event'])
  onImageLoad(): void {
    const loadTime = Date.now() - this.startTime;
    const img = this.elementRef.nativeElement as HTMLImageElement;
    this.performanceService.trackImageLoad(img.src, loadTime);
  }
}

@Directive({
  selector: '[trackErrorBoundary]',
  standalone: true
})
export class ErrorTrackingDirective {
  @Input() errorContext?: string;
  
  private analyticsService = inject(AnalyticsService);

  constructor() {
    // Track global JavaScript errors
    window.addEventListener('error', (event) => {
      this.analyticsService.trackError(
        new Error(event.message), 
        this.errorContext || 'global'
      );
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.analyticsService.trackError(
        new Error(event.reason), 
        this.errorContext || 'promise_rejection'
      );
    });
  }
}