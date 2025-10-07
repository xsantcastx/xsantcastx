export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyAABzajHVAd6NbLjMGk4IIVA9pB1T-P7To",
    authDomain: "xsantcastx-1694b.firebaseapp.com",
    databaseURL: "https://xsantcastx-1694b-default-rtdb.firebaseio.com",
    projectId: "xsantcastx-1694b",
    storageBucket: "xsantcastx-1694b.firebasestorage.app",
    messagingSenderId: "773269119730",
    appId: "1:773269119730:web:35913c4cc6a67af3cba66b",
    measurementId: "G-YRC4F65V60"
  },
  
  appCheck: {
    // reCAPTCHA v3 site key registered in Firebase App Check (safe to expose)
    siteKey: '6LdhENwrAAAAAO8AhNPQN3XiMAWZ9WGaqYY4fCof',
    // Optional: supply a debug token string or 'auto' while developing locally
    debugToken: '',
    // Any HTTPS endpoints that must receive the X-Firebase-AppCheck header
    protectedOrigins: []
  },

  // Email Configuration
  email: {
    // Brevo configuration - REPLACE WITH YOUR ACTUAL API KEY
    brevo: {
      apiKey: 'xkeysib-YOUR_BREVO_API_KEY_HERE', // Get from https://app.brevo.com → SMTP & API → API Keys
      endpoint: 'https://api.brevo.com/v3/smtp/email',
      allowedRecipient: 'xsantcastx@xsantcastx.com',
      defaultSender: {
        email: 'noreply@xsantcastx.com',
        name: 'xsantcastx Portfolio'
      }
    },
    contactEmail: 'xsantcastx@xsantcastx.com'
  },

  // Payment Configuration
  payments: {
    // Crypto addresses (safe to be public)
    crypto: {
      btc: 'bc1qey4a55329v5wm2hmk6ew4vwxr6xt4szv2lcuu9',
      eth: '0x4822E31624cE00427635de3537b49A4F1Db13bb7',
      sol: 'gnWWk4as6DJbRxDUdy6UaxGzcMDh2is5hd9Nym7DDGK'
    },
    
    // PayPal (only client ID is safe for frontend)
    paypal: {
      clientId: 'YOUR_PAYPAL_CLIENT_ID_HERE', // Replace with your NEW client ID
      mode: 'sandbox' // Change to 'live' for production
    },
    
    // Stripe (only publishable key is safe for frontend)
    stripe: {
      publishableKey: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE' // Replace with your publishable key
    }
  }
};