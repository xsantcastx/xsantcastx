import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Initialize Stripe with secret key
const getStripeInstance = (): Stripe => {
  // Note: Configure via Firebase Console or environment variables
  const secretKey = process.env.STRIPE_SECRET_KEY || 'demo_key';
  if (!secretKey || secretKey === 'demo_key') {
    throw new Error('Stripe secret key not configured. Please set STRIPE_SECRET_KEY');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2025-09-30.clover'
  });
};

/**
 * Create a Stripe Payment Intent
 */
export const createPaymentIntent = onCall(
  { 
    maxInstances: 10,
    enforceAppCheck: true,
    consumeAppCheckToken: true
  },
  async (request) => {
    try {
      const { amount, currency = 'usd' } = request.data;
      
      if (!amount || amount < 1) {
        throw new HttpsError('invalid-argument', 'Valid amount is required (minimum $1)');
      }

      logger.info('Creating Stripe payment intent:', { amount, currency });

      const stripe = getStripeInstance();
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          donor_uid: request.auth?.uid || 'anonymous',
          donation_type: 'website_donation',
          created_at: new Date().toISOString()
        },
        description: `Donation to xsantcastx Development Enterprise - $${amount}`
      });

      logger.info('Stripe payment intent created:', { 
        paymentIntentId: paymentIntent.id,
        amount,
        currency
      });

      return { 
        success: true, 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };

    } catch (error) {
      logger.error('Failed to create Stripe payment intent:', error);
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new HttpsError('invalid-argument', `Stripe error: ${error.message}`);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpsError('internal', `Failed to create payment intent: ${errorMessage}`);
    }
  }
);

/**
 * Confirm and log successful Stripe payment
 */
export const confirmStripePayment = onCall(
  { 
    maxInstances: 10,
    enforceAppCheck: true,
    consumeAppCheckToken: true
  },
  async (request) => {
    try {
      const { paymentIntentId } = request.data;
      
      if (!paymentIntentId) {
        throw new HttpsError('invalid-argument', 'Payment Intent ID is required');
      }

      logger.info('Confirming Stripe payment:', { paymentIntentId });

      const stripe = getStripeInstance();
      
      // Retrieve the payment intent to verify it was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new HttpsError('failed-precondition', 
          `Payment not completed. Status: ${paymentIntent.status}`);
      }

      // Extract payment details
      const amount = paymentIntent.amount / 100; // Convert from cents
      const currency = paymentIntent.currency.toUpperCase();
      
      // Get payment method details if available
      let paymentMethodDetails = null;
      if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'string') {
        try {
          const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
          paymentMethodDetails = {
            type: paymentMethod.type,
            card: paymentMethod.card ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              exp_month: paymentMethod.card.exp_month,
              exp_year: paymentMethod.card.exp_year
            } : null
          };
        } catch (pmError) {
          logger.warn('Could not retrieve payment method details:', pmError);
        }
      }

      // Log donation to Firestore
      const donationRef = await db.collection('donations').add({
        type: 'stripe',
        amount: amount,
        currency: currency,
        paymentIntentId: paymentIntentId,
        status: 'completed',
        stripePaymentDetails: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          created: new Date(paymentIntent.created * 1000),
          paymentMethod: paymentMethodDetails
        },
        donor: {
          uid: request.auth?.uid || 'anonymous',
          name: 'Anonymous', // Stripe doesn't provide name in payment intent by default
          email: paymentIntent.receipt_email || null
        },
        timestamp: new Date(),
        userAgent: request.rawRequest.get('user-agent') || null,
        ip: request.rawRequest.ip || null
      });

      logger.info('Stripe donation logged successfully:', { 
        donationId: donationRef.id, 
        amount, 
        paymentIntentId 
      });

      return { 
        success: true,
        donationId: donationRef.id,
        transactionId: paymentIntentId,
        amount: amount,
        currency: currency,
        message: 'Payment confirmed and logged successfully'
      };

    } catch (error) {
      logger.error('Stripe payment confirmation failed:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new HttpsError('invalid-argument', `Stripe error: ${error.message}`);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpsError('internal', `Payment confirmation failed: ${errorMessage}`);
    }
  }
);

/**
 * Handle Stripe webhooks (for production use)
 */
export const handleStripeWebhook = onCall(
  { 
    maxInstances: 5, enforceAppCheck: true, consumeAppCheckToken: true
  },
  async (request) => {
    try {
      const sig = request.rawRequest.get('stripe-signature');
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'demo_webhook_secret';
      
      if (!sig || !webhookSecret) {
        throw new HttpsError('invalid-argument', 'Invalid webhook signature');
      }

      const stripe = getStripeInstance();
      const body = JSON.stringify(request.data);
      
      let event: Stripe.Event;
      
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Webhook signature verification failed:', errorMessage);
        throw new HttpsError('invalid-argument', 'Invalid webhook signature');
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          logger.info('Payment succeeded via webhook:', { paymentIntentId: paymentIntent.id });
          
          // Update donation status if needed
          const donationsQuery = await db.collection('donations')
            .where('paymentIntentId', '==', paymentIntent.id)
            .limit(1)
            .get();
            
          if (!donationsQuery.empty) {
            const donationDoc = donationsQuery.docs[0];
            await donationDoc.ref.update({
              webhookConfirmed: true,
              webhookTimestamp: new Date()
            });
            logger.info('Donation updated with webhook confirmation');
          }
          break;
          
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          logger.warn('Payment failed via webhook:', { paymentIntentId: failedPayment.id });
          break;
          
        default:
          logger.info('Unhandled webhook event type:', event.type);
      }

      return { success: true, message: 'Webhook processed successfully' };

    } catch (error) {
      logger.error('Stripe webhook processing failed:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpsError('internal', `Webhook processing failed: ${errorMessage}`);
    }
  }
);

/**
 * Get Stripe donation statistics (optional function for admin dashboard)
 */
export const getStripeDonationStats = onCall(
  { maxInstances: 5, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    try {
      // Only allow authenticated admin users (you can add admin check here)
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const donationsRef = db.collection('donations').where('type', '==', 'stripe');
      const snapshot = await donationsRef.get();
      
      let totalAmount = 0;
      let totalCount = 0;
      const donations: any[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        totalAmount += data.amount;
        totalCount++;
        donations.push({
          id: doc.id,
          amount: data.amount,
          currency: data.currency,
          timestamp: data.timestamp,
          donor: data.donor.name,
          paymentIntentId: data.paymentIntentId
        });
      });

      return {
        success: true,
        stats: {
          totalAmount,
          totalCount,
          averageAmount: totalCount > 0 ? totalAmount / totalCount : 0
        },
        recentDonations: donations.slice(-10) // Last 10 donations
      };

    } catch (error) {
      logger.error('Failed to get Stripe donation stats:', error);
      throw new HttpsError('internal', 'Failed to retrieve donation statistics');
    }
  }
);