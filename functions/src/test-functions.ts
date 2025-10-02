/**
 * Simplified Firebase Cloud Functions for Testing Deployment
 */

import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * Simple health check function
 */
export const healthCheck = onCall(
  { maxInstances: 10, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    logger.info("Health check called");
    return { status: "ok", timestamp: new Date().toISOString() };
  }
);

/**
 * Simple PayPal test function
 */
export const paypalTest = onCall(
  { maxInstances: 10, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    logger.info("PayPal test function called");
    return { 
      status: "PayPal function ready", 
      timestamp: new Date().toISOString(),
      message: "Replace PayPal credentials in Firebase config to activate"
    };
  }
);

/**
 * Simple Stripe test function
 */
export const stripeTest = onCall(
  { maxInstances: 10, enforceAppCheck: true, consumeAppCheckToken: true },
  async (request) => {
    logger.info("Stripe test function called");
    return { 
      status: "Stripe function ready", 
      timestamp: new Date().toISOString(),
      message: "Replace Stripe credentials in Firebase config to activate"
    };
  }
);