/**
 * Firebase Cloud Functions for Payment Processing
 * xsantcastx Development Studio - Donation System
 */

import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";

// Import payment functions
import {
  processPayPalPayment,
  getPayPalDonationStats
} from "./paypal";

import {
  createCheckoutSession,
  verifyCheckoutSession,
  createPaymentIntent,
  confirmStripePayment,
  handleStripeWebhook,
  getStripeDonationStats
} from "./stripe";

// Import contact functions
import { sendContactEmail } from "./contact";

// Set global options for cost control
setGlobalOptions({ maxInstances: 10, enforceAppCheck: true });

// Export contact functions
export { sendContactEmail };

// Export PayPal functions
export const paypal = {
  processPayment: processPayPalPayment,
  getStats: getPayPalDonationStats
};

// Export Stripe functions
export const stripe = {
  createCheckoutSession: createCheckoutSession,
  verifyCheckoutSession: verifyCheckoutSession,
  createPaymentIntent: createPaymentIntent,
  confirmPayment: confirmStripePayment,
  handleWebhook: handleStripeWebhook,
  getStats: getStripeDonationStats
};

// Health check function
export const healthCheck = () => {
  logger.info("Payment functions are healthy!");
  return { status: "ok", timestamp: new Date().toISOString() };
};

