// Template for Social Authentication configuration
// Copy this file to social-auth.config.ts and replace with your actual keys
// NEVER commit social-auth.config.ts to git!

export const socialAuthConfig = {
  // Google OAuth configuration
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET_HERE', // Backend only
    redirectUri: 'https://yourdomain.com/auth/google/callback'
  },
  
  // GitHub OAuth configuration
  github: {
    clientId: 'YOUR_GITHUB_CLIENT_ID_HERE',
    clientSecret: 'YOUR_GITHUB_CLIENT_SECRET_HERE', // Backend only
    redirectUri: 'https://yourdomain.com/auth/github/callback'
  },
  
  // LinkedIn OAuth configuration
  linkedin: {
    clientId: 'YOUR_LINKEDIN_CLIENT_ID_HERE',
    clientSecret: 'YOUR_LINKEDIN_CLIENT_SECRET_HERE', // Backend only
    redirectUri: 'https://yourdomain.com/auth/linkedin/callback'
  },
  
  // Twitter/X OAuth configuration
  twitter: {
    clientId: 'YOUR_TWITTER_CLIENT_ID_HERE',
    clientSecret: 'YOUR_TWITTER_CLIENT_SECRET_HERE', // Backend only
    redirectUri: 'https://yourdomain.com/auth/twitter/callback'
  },
  
  // Common settings
  common: {
    scope: ['profile', 'email'],
    responseType: 'code',
    grantType: 'authorization_code'
  }
};