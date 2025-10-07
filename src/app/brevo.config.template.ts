// Brevo Email Configuration Template
// Instructions for setup:
// 1. Sign up for a free Brevo account at https://www.brevo.com
// 2. Navigate to SMTP & API → API Keys in your Brevo dashboard
// 3. Create a new API key with email sending permissions
// 4. Copy this file to brevo.config.ts and replace 'YOUR_BREVO_API_KEY_HERE' with your actual API key
// 5. The API key should start with 'xkeysib-'

export const BREVO_CONFIG = {
  // Replace this with your actual Brevo API key
  API_KEY: 'xkeysib-YOUR_BREVO_API_KEY_HERE',
  
  // Brevo SMTP API endpoint (do not change)
  ENDPOINT: 'https://api.brevo.com/v3/smtp/email',
  
  // Email address that is allowed to receive contact form submissions
  // Only emails TO this address will be sent (security measure)
  ALLOWED_RECIPIENT: 'xsantcastx@xsantcastx.com',
  
  // Default sender configuration
  DEFAULT_SENDER: {
    email: 'noreply@xsantcastx.com',
    name: 'xsantcastx Portfolio'
  }
};

// Email validation rules
export const EMAIL_RULES = {
  // Only allow sending TO the specified email address
  ALLOWED_RECIPIENTS: ['xsantcastx@xsantcastx.com'],
  
  // Maximum message length (characters)
  MAX_MESSAGE_LENGTH: 5000,
  
  // Required fields for contact form
  REQUIRED_FIELDS: ['name', 'email', 'message']
};