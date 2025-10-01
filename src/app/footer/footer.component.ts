import { Component, OnInit } from '@angular/core';
import { TranslationService } from '../translation.service';
import { PaymentService, DonationAmount, PaymentResult } from '../payment.service';
import { environment } from '../../environments/environment';

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
export class FooterComponent implements OnInit {
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
    this.translationService.currentLanguage$.subscribe((lang: string) => {
      this.currentLang = lang;
    });
  }

  translate(key: string): string {
    return this.translationService.translate(key);
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
      alert(this.translate('footer.success'));
      this.closeModals();
    } catch (error) {
      console.error('PayPal payment failed:', error);
      alert(this.translate('footer.error'));
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
        alert(this.translate('footer.success'));
        this.closeModals();
      } else {
        alert(result.error || this.translate('footer.error'));
      }
    } catch (error) {
      console.error('Stripe payment failed:', error);
      alert(this.translate('footer.error'));
    } finally {
      this.stripeProcessing = false;
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      alert('Address copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Address copied to clipboard!');
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
