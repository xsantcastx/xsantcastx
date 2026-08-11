import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Functions, httpsCallable } from '@angular/fire/functions';

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
  private functions = inject(Functions);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
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

  /**
   * In-flight/settled loader promises. Both SDKs are fetched on demand — see
   * `ensureStripe()` / `ensurePayPal()` — and these fields make the call
   * idempotent so N modal opens still produce exactly one <script> tag.
   */
  private stripeLoader?: Promise<boolean>;
  private paypalLoader?: Promise<boolean>;

  constructor() {
    // Deliberately empty. The payment SDKs are NOT loaded here.
    //
    // PaymentService is `providedIn: 'root'` and FooterComponent — which is
    // app-shell mounted, i.e. present on every single route — injects it. So
    // anything this constructor kicks off runs on the home page, on all 123
    // tool pages, everywhere. It used to call initializePaymentSDKs(), which
    // meant js.stripe.com/v3 (~818 kB) and the PayPal SDK were downloaded on
    // every page view, competing for bandwidth with the LCP resource on
    // throttled mobile, for a donation flow that only opens behind a click.
    //
    // Both SDKs are now pulled in lazily by ensureStripe()/ensurePayPal(),
    // which the footer calls when the corresponding donate modal opens.
  }

  /**
   * Fetch the PayPal SDK, once. Resolves true when `paypal` is usable.
   *
   * Safe to call repeatedly and from anywhere — the loader promise is cached,
   * so concurrent callers share one network request.
   */
  ensurePayPal(): Promise<boolean> {
    if (!this.isBrowser) return Promise.resolve(false);
    if (this.paypalLoader) return this.paypalLoader;

    this.paypalLoader = new Promise<boolean>(resolve => {
      // Check if PayPal is configured with a real client ID
      const clientId = environment.payments.paypal.clientId;
      if (!clientId ||
          clientId === '' ||
          clientId.includes('YOUR_PAYPAL_CLIENT_ID') ||
          clientId.includes('PLACEHOLDER')) {
        console.log('PayPal not configured - skipping SDK load');
        this.paypalLoaded.next(false);
        resolve(false);
        return;
      }

      // Check if already loaded
      if (typeof paypal !== 'undefined') {
        this.paypalLoaded.next(true);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.async = true;
      script.onload = () => {
        this.paypalLoaded.next(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        this.paypalLoaded.next(false);
        // Drop the cached rejection path so a later retry can re-attempt.
        this.paypalLoader = undefined;
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.paypalLoader;
  }

  /**
   * Fetch the Stripe SDK, once. Resolves true when `this.stripe` is usable.
   *
   * Same contract as ensurePayPal(): idempotent, shared promise, and a failed
   * load clears the cache so the next attempt can retry rather than being
   * permanently stuck on a stale `false`.
   */
  ensureStripe(): Promise<boolean> {
    if (!this.isBrowser) return Promise.resolve(false);
    if (this.stripeLoader) return this.stripeLoader;

    this.stripeLoader = new Promise<boolean>(resolve => {
      // Check if Stripe is configured with a real publishable key
      const publishableKey = environment.payments.stripe.publishableKey;
      if (!publishableKey ||
          publishableKey === '' ||
          publishableKey.includes('YOUR_STRIPE_PUBLISHABLE') ||
          publishableKey.includes('PLACEHOLDER')) {
        console.log('Stripe not configured - skipping SDK load');
        this.stripeLoaded.next(false);
        resolve(false);
        return;
      }

      // Check if already loaded
      if (typeof Stripe !== 'undefined') {
        this.stripe = Stripe(publishableKey);
        this.stripeLoaded.next(true);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        this.stripe = Stripe(publishableKey);
        this.stripeLoaded.next(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error('Failed to load Stripe SDK');
        this.stripeLoaded.next(false);
        this.stripeLoader = undefined;
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.stripeLoader;
  }

  // PayPal payment processing
  async renderPayPalButton(containerId: string, amount: number): Promise<void> {
    // Pull the SDK in on demand. No-op once it has already loaded, so callers
    // that pre-warmed via ensurePayPal() pay nothing extra here.
    await this.ensurePayPal();

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

  // Stripe payment processing using Stripe Checkout
  async processStripePayment(amount: number): Promise<PaymentResult> {
    // Check if Stripe is configured
    const publishableKey = environment.payments.stripe.publishableKey;
    if (!publishableKey || publishableKey === '') {
      return { 
        success: false, 
        error: 'Stripe is not configured. Please add your Stripe publishable key to the environment configuration.' 
      };
    }

    // Pull the SDK in on demand — no-op if the modal already pre-warmed it.
    await this.ensureStripe();

    // Check if Stripe SDK is loaded
    if (!this.stripeLoaded.value || !this.stripe) {
      return {
        success: false,
        error: 'Stripe SDK failed to load. Please check your publishable key and try again.'
      };
    }

    try {
      console.log('Creating Stripe checkout session for amount:', amount);
      
      // Call Firebase Cloud Function to create a Stripe Checkout session
      const createCheckoutSession = httpsCallable(this.functions, 'stripe-createCheckoutSession');
      const response = await createCheckoutSession({ amount, currency: 'usd' });
      
      const data = response.data as any;
      
      if (!data.success || !data.sessionId) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      console.log('Checkout session created, redirecting to Stripe...');

      // Redirect to Stripe Checkout page
      const result = await this.stripe.redirectToCheckout({
        sessionId: data.sessionId
      });

      if (result.error) {
        console.error('Stripe redirect error:', result.error);
        return {
          success: false,
          error: result.error.message || 'Failed to redirect to payment page'
        };
      }

      // If we get here, the redirect happened successfully
      // User will be redirected back to your site after payment
      return {
        success: true,
        transactionId: data.sessionId
      };
      
    } catch (error) {
      console.error('Stripe payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { 
        success: false, 
        error: `Stripe payment failed: ${errorMessage}` 
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
