// Template for general API configuration
// Copy this file to api.config.ts and replace with your actual keys
// NEVER commit api.config.ts to git!

export const apiConfig = {
  // Base API URLs
  baseUrl: 'https://api.yourdomain.com',
  authUrl: 'https://auth.yourdomain.com',
  
  // Third-party API keys
  apis: {
    // OpenAI API (if using AI features)
    openai: {
      apiKey: 'sk-YOUR_OPENAI_API_KEY_HERE',
      organizationId: 'org-YOUR_ORG_ID_HERE'
    },
    
    // SendGrid (alternative email service)
    sendgrid: {
      apiKey: 'SG.YOUR_SENDGRID_API_KEY_HERE',
      fromEmail: 'noreply@yourdomain.com',
      fromName: 'xsantcastx'
    },
    
    // Cloudinary (image/video management)
    cloudinary: {
      cloudName: 'YOUR_CLOUD_NAME_HERE',
      apiKey: 'YOUR_CLOUDINARY_API_KEY_HERE',
      apiSecret: 'YOUR_CLOUDINARY_API_SECRET_HERE'
    },
    
    // Mapbox (if using maps)
    mapbox: {
      accessToken: 'pk.YOUR_MAPBOX_ACCESS_TOKEN_HERE'
    },
    
    // Cryptocurrency APIs (if relevant for portfolio)
    crypto: {
      coinGeckoApiKey: 'CG-YOUR_COINGECKO_API_KEY_HERE',
      coinMarketCapApiKey: 'YOUR_CMC_API_KEY_HERE'
    }
  },
  
  // Rate limiting configurations
  rateLimit: {
    requestsPerMinute: 60,
    burstLimit: 100
  },
  
  // Timeout configurations
  timeouts: {
    default: 10000, // 10 seconds
    upload: 30000,  // 30 seconds
    longRunning: 60000 // 1 minute
  }
};