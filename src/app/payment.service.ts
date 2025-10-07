import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../environments/environment';

// PayPal SDK types
declare var paypal: any;

// Stripe SDK types  
declare var Stripe: any;

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface DonationAmount {
  value: number;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private stripe: any;
  private paypalLoaded = new BehaviorSubject<boolean>(false);
  private stripeLoaded = new BehaviorSubject<boolean>(false);
  
  public paypalReady$ = this.paypalLoaded.asObservable();
  public stripeReady$ = this.stripeLoaded.asObservable();

  // Predefined donation amounts
  readonly donationAmounts: DonationAmount[] = [
    { value: 5, label: '$5' },
    { value: 10, label: '$10' },
    { value: 25, label: '$25' },
    { value: 50, label: '$50' }
  ];

  constructor() {
    this.initializePaymentSDKs();
  }

  private initializePaymentSDKs(): void {
    this.loadPayPalSDK();
    this.loadStripeSDK();
  }

  private loadPayPalSDK(): void {
    // Check if PayPal is configured with a real client ID
    const clientId = environment.payments.paypal.clientId;
    if (!clientId || 
        clientId === '' || 
        clientId.includes('YOUR_PAYPAL_CLIENT_ID') || 
        clientId.includes('PLACEHOLDER')) {
      console.log('PayPal not configured - skipping SDK load');
      this.paypalLoaded.next(false);
      return;
    }

    // Check if already loaded
    if (typeof paypal !== 'undefined') {
      this.paypalLoaded.next(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${environment.payments.paypal.clientId}&currency=USD`;
    script.onload = () => {
      this.paypalLoaded.next(true);
    };
    script.onerror = () => {
      console.error('Failed to load PayPal SDK');
      this.paypalLoaded.next(false);
    };
    document.head.appendChild(script);
  }

  private loadStripeSDK(): void {
    // Check if Stripe is configured with a real publishable key
    const publishableKey = environment.payments.stripe.publishableKey;
    if (!publishableKey || 
        publishableKey === '' || 
        publishableKey.includes('YOUR_STRIPE_PUBLISHABLE') || 
        publishableKey.includes('PLACEHOLDER')) {
      console.log('Stripe not configured - skipping SDK load');
      this.stripeLoaded.next(false);
      return;
    }

    // Check if already loaded
    if (typeof Stripe !== 'undefined') {
      this.stripe = Stripe(environment.payments.stripe.publishableKey);
      this.stripeLoaded.next(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => {
      this.stripe = Stripe(environment.payments.stripe.publishableKey);
      this.stripeLoaded.next(true);
    };
    script.onerror = () => {
      console.error('Failed to load Stripe SDK');
      this.stripeLoaded.next(false);
    };
    document.head.appendChild(script);
  }

  // PayPal payment processing
  renderPayPalButton(containerId: string, amount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.paypalLoaded.value) {
        reject('PayPal SDK not loaded');
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        reject(`Container ${containerId} not found`);
        return;
      }

      // Clear existing buttons
      container.innerHTML = '';

      paypal.Buttons({
        createOrder: (data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: amount.toString()
              },
              description: `Support xsantcastx Development Studio - $${amount} donation`
            }]
          });
        },
        onApprove: async (data: any, actions: any) => {
          try {
            const details = await actions.order.capture();
            
            // Log to Firebase (you can add Firebase logging here)
            await this.logDonation({
              type: 'paypal',
              amount: amount,
              transactionId: details.id,
              donorName: details.payer?.name?.given_name || 'Anonymous',
              timestamp: new Date()
            });

            resolve();
          } catch (error) {
            reject(`Payment capture failed: ${error}`);
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err);
          reject(`PayPal error: ${err}`);
        },
        onCancel: () => {
          reject('Payment cancelled by user');
        }
      }).render(`#${containerId}`);
    });
  }

  // Stripe payment processing
  async processStripePayment(amount: number): Promise<PaymentResult> {
    if (!this.stripeLoaded.value) {
      return { success: false, error: 'Stripe not loaded' };
    }

    try {
      // In a real implementation, you would:
      // 1. Call your Firebase function to create a payment intent
      // 2. Use the client secret to confirm the payment
      
      // For now, since you need Firebase Cloud Functions, let's show the structure:
      console.log('Processing Stripe payment for amount:', amount);
      
      // This would be your Firebase function call:
      // const response = await this.createPaymentIntent(amount);
      // const result = await this.stripe.confirmCardPayment(response.client_secret);
      
      // For demonstration, return a placeholder
      return { 
        success: false, 
        error: 'Stripe integration requires Firebase Cloud Functions. Please set up the backend first.' 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Stripe payment failed: ${error}` 
      };
    }
  }

  // Firebase logging (you can enhance this with your Firebase setup)
  private async logDonation(donation: any): Promise<void> {
    try {
      // Here you would use AngularFire to log to Firestore
      console.log('Donation logged:', donation);
      
      // Example structure for when you add AngularFire:
      // const db = getFirestore();
      // await addDoc(collection(db, 'donations'), donation);
    } catch (error) {
      console.error('Failed to log donation:', error);
    }
  }

  // Check if payment methods are ready
  isPayPalReady(): boolean {
    return this.paypalLoaded.value;
  }

  isStripeReady(): boolean {
    return this.stripeLoaded.value;
  }
}
