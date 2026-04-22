import { Component, Input, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NewsletterService } from './newsletter.service';

@Component({
  selector: 'app-newsletter-capture',
  standalone: false,
  template: `
    @if (!dismissed && !alreadySubscribed) {
      <aside class="nl-capture" aria-label="Newsletter signup">
        <div class="nl-capture__inner">
          <!-- Icon + text -->
          <div class="nl-capture__content">
            <div class="nl-capture__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <p class="nl-capture__headline">Get weekly dev tips + new tool alerts</p>
              <p class="nl-capture__sub">No spam. Unsubscribe anytime.</p>
            </div>
          </div>
          <!-- Form -->
          @if (status !== 'success') {
            <form class="nl-capture__form" (ngSubmit)="onSubmit()">
              <input
                type="email"
                class="nl-capture__input"
                [(ngModel)]="email"
                name="nlEmail"
                placeholder="you@example.com"
                autocomplete="email"
                required
                [disabled]="status === 'loading'"
                />
              <button type="submit" class="nl-capture__btn" [disabled]="status === 'loading'">
                @if (status !== 'loading') {
                  <span>Subscribe</span>
                }
                @if (status === 'loading') {
                  <span class="nl-capture__spinner"></span>
                }
              </button>
            </form>
          }
          <!-- Success -->
          @if (status === 'success') {
            <p class="nl-capture__success">
              <span class="nl-capture__check">✓</span> You're in! We'll ping you when something new ships.
            </p>
          }
          <!-- Error -->
          @if (status === 'error') {
            <p class="nl-capture__error">
              {{ errorMsg }}
            </p>
          }
          <!-- Dismiss -->
          @if (status !== 'success') {
            <button class="nl-capture__dismiss" (click)="dismiss()" aria-label="Dismiss newsletter signup"
              >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
        </div>
      </aside>
    }
    `,
  styleUrls: ['./newsletter-capture.component.css']
})
export class NewsletterCaptureComponent {
  /** Source label for analytics (e.g. 'tool_page_inline') */
  @Input() source = 'tool_page_inline';
  /** Optional tool slug for tracking which tool drove the signup */
  @Input() toolSlug?: string;

  email = '';
  status: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorMsg = '';
  dismissed = false;
  alreadySubscribed = false;

  constructor(
    private newsletterService: NewsletterService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.alreadySubscribed = this.newsletterService.isAlreadySubscribed();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.email || this.status === 'loading') return;
    this.status = 'loading';
    this.errorMsg = '';

    try {
      await this.newsletterService.subscribe(this.email, this.source, this.toolSlug);
      this.status = 'success';
      this.email = '';
    } catch (err: any) {
      this.status = 'error';
      this.errorMsg = err?.message || 'Something went wrong — try again.';
    }
  }

  dismiss(): void {
    this.dismissed = true;
  }
}
