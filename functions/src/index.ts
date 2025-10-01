/**
 * Firebase Cloud Functions for Payment Processing
 * xsantcastx Development Enterprise - Donation System
 */

import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";

// Import payment functions
import {
  processPayPalPayment,
  getPayPalDonationStats
} from "./paypal";

import {
  createPaymentIntent,
  confirmStripePayment,
  handleStripeWebhook,
  getStripeDonationStats
} from "./stripe";

import {
  sendContactEmail
} from "./contact";

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Export PayPal functions
export const paypal = {
  processPayment: processPayPalPayment,
  getStats: getPayPalDonationStats
};

// Export Stripe functions
export const stripe = {
  createPaymentIntent: createPaymentIntent,
  confirmPayment: confirmStripePayment,
  handleWebhook: handleStripeWebhook,
  getStats: getStripeDonationStats
};

// Export Contact functions
export const contact = {
  sendEmail: sendContactEmail
};

// Health check function
export const healthCheck = () => {
  logger.info("Payment functions are healthy!");
  return { status: "ok", timestamp: new Date().toISOString() };
};
