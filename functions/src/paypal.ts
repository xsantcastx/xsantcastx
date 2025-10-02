import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// PayPal API configuration
// Automatically detects sandbox vs live based on PAYPAL_MODE environment variable
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface PayPalOrderDetails {
  id: string;
  status: string;
  purchase_units: Array<{
    amount: {
      value: string;
      currency_code: string;
    };
    description?: string;
  }>;
  payer?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
  };
}

/**
 * Verify PayPal payment with PayPal API
 */
async function verifyPayPalPayment(orderId: string): Promise<PayPalOrderDetails> {
  try {
    // Get PayPal access token
    // Note: Configure these via Firebase Console or environment variables
    const clientId = process.env.PAYPAL_CLIENT_ID || 'demo_client_id';
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'demo_client_secret';
    
    if (!clientId || clientId === 'demo_client_id') {
      throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
    }

    // Get access token from PayPal
    const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`PayPal token error: ${tokenData.error_description || 'Unknown error'}`);
    }

    // Verify the order with PayPal
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      throw new Error(`PayPal verification error: ${orderData.message || 'Unknown error'}`);
    }

    return orderData;
  } catch (error) {
    logger.error('PayPal verification failed:', error);
    throw error;
  }
}

/**
 * Process PayPal payment and log to Firestore
 */
export const processPayPalPayment = onCall(
  { 
    maxInstances: 10,
    enforceAppCheck: true,
    consumeAppCheckToken: true
  },
  async (request) => {
    try {
      const { amount, orderId } = request.data;
      
      if (!amount || !orderId) {
        throw new HttpsError('invalid-argument', 'Amount and orderId are required');
      }

      if (amount < 1) {
        throw new HttpsError('invalid-argument', 'Minimum donation amount is $1');
      }

      logger.info('Processing PayPal payment:', { amount, orderId });

      // Verify payment with PayPal API
      const paypalResponse = await verifyPayPalPayment(orderId);
      
      // Check if payment is completed
      if (paypalResponse.status !== 'COMPLETED') {
        throw new HttpsError('failed-precondition', `Payment not completed. Status: ${paypalResponse.status}`);
      }

      // Verify amount matches
      const paidAmount = parseFloat(paypalResponse.purchase_units[0].amount.value);
      if (Math.abs(paidAmount - amount) > 0.01) {
        throw new HttpsError('failed-precondition', 'Payment amount mismatch');
      }

      // Log donation to Firestore
      const donationRef = await db.collection('donations').add({
        type: 'paypal',
        amount: amount,
        currency: 'USD',
        orderId: orderId,
        status: 'completed',
        paypalOrderDetails: {
          id: paypalResponse.id,
          status: paypalResponse.status,
          paidAmount: paidAmount
        },
        donor: {
          uid: request.auth?.uid || 'anonymous',
          name: paypalResponse.payer?.name ? 
            `${paypalResponse.payer.name.given_name || ''} ${paypalResponse.payer.name.surname || ''}`.trim() : 
            'Anonymous',
          email: paypalResponse.payer?.email_address || null
        },
        timestamp: new Date(),
        userAgent: request.rawRequest.get('user-agent') || null,
        ip: request.rawRequest.ip || null
      });

      logger.info('PayPal donation logged successfully:', { 
        donationId: donationRef.id, 
        amount, 
        orderId 
      });

      return { 
        success: true, 
        transactionId: orderId,
        donationId: donationRef.id,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      logger.error('PayPal payment processing failed:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', `Payment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get donation statistics (optional function for admin dashboard)
 */
export const getPayPalDonationStats = onCall(
  { maxInstances: 5, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    try {
      // Only allow authenticated admin users (you can add admin check here)
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const donationsRef = db.collection('donations').where('type', '==', 'paypal');
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
          timestamp: data.timestamp,
          donor: data.donor.name,
          orderId: data.orderId
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
      logger.error('Failed to get PayPal donation stats:', error);
      throw new HttpsError('internal', 'Failed to retrieve donation statistics');
    }
  }
);