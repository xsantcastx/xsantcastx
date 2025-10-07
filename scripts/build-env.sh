#!/bin/bash

# Build script for CI/CD - creates environment.ts from template
echo "Creating environment.ts from template..."

# Copy template to actual environment file
cp src/environments/environment.template.ts src/environments/environment.ts

# Replace placeholders with environment variables (if provided)
if [ ! -z "$BREVO_API_KEY" ]; then
    sed -i "s/xkeysib-YOUR_BREVO_API_KEY_HERE/$BREVO_API_KEY/g" src/environments/environment.ts
fi

if [ ! -z "$PAYPAL_CLIENT_ID" ]; then
    sed -i "s/YOUR_PAYPAL_CLIENT_ID_HERE/$PAYPAL_CLIENT_ID/g" src/environments/environment.ts
fi

if [ ! -z "$STRIPE_PUBLISHABLE_KEY" ]; then
    sed -i "s/pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE/$STRIPE_PUBLISHABLE_KEY/g" src/environments/environment.ts
fi

echo "Environment file created successfully!"