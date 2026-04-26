import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslationService } from '../translation.service';
import { PaymentService, DonationAmount, PaymentResult } from '../payment.service';
import { environment } from '../../environments/environment';
import { version } from '../../../package.json';

interface CryptoAddress {
  name: string;
  symbol: string;
  address: string;
}

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.css'],
    standalone: false
})
export class FooterComponent implements OnInit, OnDestroy {
  readonly appVersion: string = version;
  /**
   * Subscription to TranslationService.currentLanguage$. Stored so we can
   * tear it down in ngOnDestroy. Mirrors the leak fix in HeaderComponent
   * (see langSub). FooterComponent is currently app-shell mounted so under
   * normal routing it only instantiates once — but if a future refactor
   * ever lazy-mounts the footer behind an *ngIf, the previous naked
   * `.subscribe(...)` would stack listeners on every remount. This is a
   * defence-in-depth fix so that failure mode can never regress silently.
   */
  private langSub?: Subscription;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /**
   * Toast text for the aria-live="polite" region. Empty string keeps the
   * region collapsed visually while still being announced when populated.
   * Replaces the prior blocking `alert()` calls (a11y task: "footer clipboard
   * copy uses browser alert() — replace with aria-live toast").
   */
  toastMessage: string = '';
  /** Active timer ID so we can clear/replace if a new toast arrives. */
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  currentLang: string = 'en';
  showCryptoModal: boolean = false;
  showPayPalModal: boolean = false;
  showStripeModal: boolean = false;
  
  // Payment states
  paypalProcessing: boolean = false;
  stripeProcessing: boolean = false;
  selectedAmount: number = 10;
  customAmount: number | null = null;
  showCustomInput: boolean = false;
  customAmountError: string = '';
  
  cryptoAddresses: CryptoAddress[] = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      address: environment.payments.crypto.btc
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      address: environment.payments.crypto.eth
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      address: environment.payments.crypto.sol
    }
  ];

  donationAmounts: DonationAmount[] = this.paymentService.donationAmounts;

  constructor(
    private translationService: TranslationService,
    private paymentService: PaymentService
  ) {}

  ngOnInit(): void {
    this.langSub = this.translationService.currentLanguage$.subscribe((lang: string) => {
      this.currentLang = lang;
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.langSub = undefined;
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  /**
   * Show a brief, non-blocking toast in the footer's aria-live region.
   *
   * Replaces blocking `alert()` for clipboard / payment feedback. Polite
   * live region means screen readers queue the message until the current
   * utterance finishes, which is the right behaviour for non-critical
   * confirmations. If a previous toast is still visible we replace it
   * (clear the timer first so we don't double-clear and clobber the new
   * message). On the server this becomes a no-op DOM write — harmless,
   * and keeps the SSR output consistent with the browser's empty initial
   * state.
   */
  showToast(message: string, durationMs: number = 3000): void {
    this.toastMessage = message;
    if (!this.isBrowser) return;
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimer = null;
    }, durationMs);
  }

  openCryptoDonate(): void {
    this.closeModals();
    this.showCryptoModal = true;
  }

  openPayPalDonate(): void {
    this.closeModals();
    this.showPayPalModal = true;
  }

  openStripeDonate(): void {
    this.closeModals();
    this.showStripeModal = true;
  }

  closeModals(): void {
    this.showCryptoModal = false;
    this.showPayPalModal = false;
    this.showStripeModal = false;
    this.paypalProcessing = false;
    this.stripeProcessing = false;
    this.showCustomInput = false;
    this.customAmount = null;
    this.customAmountError = '';
    this.selectedAmount = 10; // Reset to default
  }

  selectAmount(amount: number): void {
    this.selectedAmount = amount;
    this.showCustomInput = false;
    this.customAmount = null;
    this.customAmountError = '';
  }

  toggleCustomAmount(): void {
    this.showCustomInput = !this.showCustomInput;
    if (this.showCustomInput) {
      this.selectedAmount = 0; // Reset selected amount when custom is active
    } else {
      this.customAmount = null;
      this.selectedAmount = 10; // Default back to $10
    }
    this.customAmountError = '';
  }

  onCustomAmountChange(): void {
    this.customAmountError = '';
    if (this.customAmount && this.customAmount >= 1) {
      this.selectedAmount = this.customAmount;
    }
  }

  validateCustomAmount(): boolean {
    if (this.showCustomInput) {
      if (!this.customAmount || this.customAmount < 1) {
        this.customAmountError = this.translate('footer.custom.invalid');
        return false;
      }
      this.selectedAmount = this.customAmount;
    }
    return this.selectedAmount >= 1;
  }

  async processPayPalPayment(): Promise<void> {
    if (!this.validateCustomAmount()) {
      return;
    }
    
    this.paypalProcessing = true;
    
    try {
      await this.paymentService.renderPayPalButton('paypal-button-container', this.selectedAmount);
      this.closeModals();
      // Show toast AFTER closeModals() so focus is back on the trigger when
      // the announcement fires — keeps SR reading order coherent.
      this.showToast(this.translate('footer.success'));
    } catch (error) {
      console.error('PayPal payment failed:', error);
      this.showToast(this.translate('footer.error'));
    } finally {
      this.paypalProcessing = false;
    }
  }

  async processStripePayment(): Promise<void> {
    if (!this.validateCustomAmount()) {
      return;
    }
    
    this.stripeProcessing = true;
    
    try {
      const result: PaymentResult = await this.paymentService.processStripePayment(this.selectedAmount);
      
      if (result.success) {
        this.closeModals();
        this.showToast(this.translate('footer.success'));
      } else {
        this.showToast(result.error || this.translate('footer.error'));
      }
    } catch (error) {
      console.error('Stripe payment failed:', error);
      this.showToast(this.translate('footer.error'));
    } finally {
      this.stripeProcessing = false;
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this.translate('footer.copied') || 'Address copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers / locked-down clipboard contexts.
      // We still announce the result via toast instead of alert().
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        // Take it out of the layout flow so the page doesn't jump.
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showToast(this.translate('footer.copied') || 'Address copied to clipboard');
      } catch (fallbackErr) {
        console.error('Clipboard fallback failed: ', fallbackErr);
        this.showToast(this.translate('footer.copy.error') || 'Could not copy address');
      }
    }
  }

  // Getters for template
  get isPayPalReady(): boolean {
    return this.paymentService.isPayPalReady();
  }

  get isStripeReady(): boolean {
    return this.paymentService.isStripeReady();
  }
}
