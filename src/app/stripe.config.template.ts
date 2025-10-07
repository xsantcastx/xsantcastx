// Template for Stripe configuration
// Copy this file to stripe.config.ts and replace with your actual keys
// NEVER commit stripe.config.ts to git!

export const stripeConfig = {
  // Get your publishable key from Stripe Dashboard → Developers → API keys
  publishableKey: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE',
  
  // For webhook endpoints (backend only)
  webhookSecret: 'whsec_YOUR_WEBHOOK_SECRET_HERE',
  
  // Optional: Product/Price IDs for subscription management
  products: {
    basic: 'prod_YOUR_BASIC_PRODUCT_ID',
    premium: 'prod_YOUR_PREMIUM_PRODUCT_ID'
  },
  
  prices: {
    basicMonthly: 'price_YOUR_BASIC_MONTHLY_PRICE_ID',
    premiumMonthly: 'price_YOUR_PREMIUM_MONTHLY_PRICE_ID'
  }
};