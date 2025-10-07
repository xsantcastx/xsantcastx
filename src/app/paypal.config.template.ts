// Template for PayPal configuration
// Copy this file to paypal.config.ts and replace with your actual keys
// NEVER commit paypal.config.ts to git!

export const paypalConfig = {
  // Get your client ID from PayPal Developer Dashboard
  clientId: 'YOUR_PAYPAL_CLIENT_ID_HERE',
  
  // Environment: 'sandbox' for testing, 'production' for live
  environment: 'sandbox',
  
  // Currency for transactions
  currency: 'EUR', // or 'USD', 'GBP', etc.
  
  // Optional: Webhook configuration
  webhook: {
    id: 'YOUR_WEBHOOK_ID_HERE',
    url: 'https://yourdomain.com/api/paypal/webhook'
  },
  
  // Optional: Product catalog
  products: {
    donation: {
      name: 'Support xsantcastx',
      description: 'Support my work and projects'
    }
  }
};