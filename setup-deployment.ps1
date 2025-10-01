# Firebase Functions Deployment Setup Script
# This script sets up environment variables and deploys Firebase Functions

Write-Host "🚀 Setting up Firebase Functions for payment processing..." -ForegroundColor Green

# Step 1: Set up Firebase Functions environment variables (legacy config)
Write-Host "📝 Setting up environment variables..." -ForegroundColor Yellow

# PayPal Configuration
Write-Host "Setting PayPal configuration..."
firebase functions:config:set paypal.client_id="YOUR_PAYPAL_CLIENT_ID"
firebase functions:config:set paypal.client_secret="YOUR_PAYPAL_CLIENT_SECRET" 
firebase functions:config:set paypal.mode="sandbox"

# Stripe Configuration  
Write-Host "Setting Stripe configuration..."
firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"

# Step 2: View current configuration
Write-Host "📋 Current configuration:" -ForegroundColor Yellow
firebase functions:config:get

# Step 3: Deploy functions
Write-Host "🚀 Deploying Firebase Functions..." -ForegroundColor Green
firebase deploy --only functions

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Replace 'YOUR_PAYPAL_CLIENT_ID' with your actual PayPal Client ID"
Write-Host "2. Replace 'YOUR_PAYPAL_CLIENT_SECRET' with your actual PayPal Client Secret"
Write-Host "3. Replace 'YOUR_STRIPE_SECRET_KEY' with your actual Stripe Secret Key"  
Write-Host "4. Replace 'YOUR_STRIPE_WEBHOOK_SECRET' with your actual Stripe Webhook Secret"
Write-Host "5. Change paypal.mode from 'sandbox' to 'live' when ready for production"
Write-Host ""
Write-Host "🔧 To update environment variables, run:" -ForegroundColor Yellow
Write-Host "firebase functions:config:set paypal.client_id='your-real-client-id'"
Write-Host "firebase functions:config:set stripe.secret_key='your-real-secret-key'"
Write-Host ""
Write-Host "📊 Available Functions after deployment:" -ForegroundColor Cyan
Write-Host "- paypal-processPayment"
Write-Host "- paypal-getStats" 
Write-Host "- stripe-createPaymentIntent"
Write-Host "- stripe-confirmPayment"
Write-Host "- stripe-handleWebhook"
Write-Host "- stripe-getStats"