# Firebase Functions Quick Setup Script (PowerShell)
# Run this script to configure your payment functions

Write-Host "🔧 Firebase Payment Functions Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if we're in the functions directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Please run this script from the functions directory" -ForegroundColor Red
    Write-Host "   cd functions; .\setup.ps1" -ForegroundColor Yellow
    exit 1
}

# Function to prompt for input
function Prompt-ForInput {
    param(
        [string]$Prompt,
        [string]$VarName,
        [bool]$IsSecret = $false
    )
    
    if ($IsSecret) {
        $value = Read-Host "$Prompt" -AsSecureString
        $value = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
    } else {
        $value = Read-Host "$Prompt"
    }
    
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "❌ $VarName cannot be empty" -ForegroundColor Red
        exit 1
    }
    
    return $value
}

Write-Host ""
Write-Host "📝 Please provide your payment configuration:" -ForegroundColor Yellow
Write-Host ""

# PayPal Configuration
Write-Host "PayPal Configuration:" -ForegroundColor Green
Write-Host "--------------------" -ForegroundColor Green
$PAYPAL_CLIENT_ID = Prompt-ForInput "PayPal Client ID" "PayPal Client ID"
$PAYPAL_CLIENT_SECRET = Prompt-ForInput "PayPal Client Secret" "PayPal Client Secret" $true
$PAYPAL_MODE = Prompt-ForInput "PayPal Mode (sandbox/live)" "PayPal Mode"

Write-Host ""
Write-Host "Stripe Configuration:" -ForegroundColor Green
Write-Host "--------------------" -ForegroundColor Green
$STRIPE_SECRET_KEY = Prompt-ForInput "Stripe Secret Key (sk_...)" "Stripe Secret Key" $true
$STRIPE_WEBHOOK_SECRET = Prompt-ForInput "Stripe Webhook Secret (whsec_...)" "Stripe Webhook Secret" $true

Write-Host ""
Write-Host "🔧 Setting Firebase Functions configuration..." -ForegroundColor Yellow

# Set PayPal config
& firebase functions:config:set paypal.client_id="$PAYPAL_CLIENT_ID" paypal.client_secret="$PAYPAL_CLIENT_SECRET" paypal.mode="$PAYPAL_MODE"

# Set Stripe config
& firebase functions:config:set stripe.secret_key="$STRIPE_SECRET_KEY" stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET"

Write-Host ""
Write-Host "✅ Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Ready to deploy! Run:" -ForegroundColor Cyan
Write-Host "   firebase deploy --only functions" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Or test locally first:" -ForegroundColor Cyan
Write-Host "   firebase emulators:start --only functions" -ForegroundColor White
Write-Host ""