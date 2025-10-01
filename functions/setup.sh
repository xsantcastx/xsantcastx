#!/bin/bash
# Firebase Functions Quick Setup Script
# Run this script to configure your payment functions

echo "🔧 Firebase Payment Functions Setup"
echo "===================================="

# Check if we're in the functions directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the functions directory"
    echo "   cd functions && ./setup.sh"
    exit 1
fi

# Function to prompt for input
prompt_for_input() {
    local prompt="$1"
    local var_name="$2"
    local is_secret="$3"
    
    if [ "$is_secret" = "true" ]; then
        echo -n "$prompt: "
        read -s value
        echo
    else
        echo -n "$prompt: "
        read value
    fi
    
    if [ -z "$value" ]; then
        echo "❌ $var_name cannot be empty"
        exit 1
    fi
    
    eval "$var_name=\"$value\""
}

echo
echo "📝 Please provide your payment configuration:"
echo

# PayPal Configuration
echo "PayPal Configuration:"
echo "--------------------"
prompt_for_input "PayPal Client ID" PAYPAL_CLIENT_ID false
prompt_for_input "PayPal Client Secret" PAYPAL_CLIENT_SECRET true
prompt_for_input "PayPal Mode (sandbox/live)" PAYPAL_MODE false

echo
echo "Stripe Configuration:"
echo "--------------------"
prompt_for_input "Stripe Secret Key (sk_...)" STRIPE_SECRET_KEY true
prompt_for_input "Stripe Webhook Secret (whsec_...)" STRIPE_WEBHOOK_SECRET true

echo
echo "🔧 Setting Firebase Functions configuration..."

# Set PayPal config
firebase functions:config:set \
    paypal.client_id="$PAYPAL_CLIENT_ID" \
    paypal.client_secret="$PAYPAL_CLIENT_SECRET" \
    paypal.mode="$PAYPAL_MODE"

# Set Stripe config
firebase functions:config:set \
    stripe.secret_key="$STRIPE_SECRET_KEY" \
    stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET"

echo
echo "✅ Configuration complete!"
echo
echo "🚀 Ready to deploy! Run:"
echo "   firebase deploy --only functions"
echo
echo "🧪 Or test locally first:"
echo "   firebase emulators:start --only functions"
echo