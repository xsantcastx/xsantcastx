# Brevo Email Service Setup Instructions

This project now uses **Brevo (formerly Sendinblue)** for sending contact form emails via SMTP. Follow these steps to configure the email service.

## 📧 Brevo Setup Steps

### 1. Create Brevo Account
1. Go to [https://www.brevo.com](https://www.brevo.com)
2. Sign up for a **FREE** account
3. Verify your email address

### 2. Get Your API Key
1. Log into your Brevo dashboard
2. Navigate to **SMTP & API** → **API Keys**
3. Click **Generate a new API key**
4. Name it something like "xsantcastx-portfolio"
5. Make sure it has **email sending permissions**
6. Copy the API key (starts with `xkeysib-`)

### 3. Configure the Service
1. Copy `src/app/brevo.config.template.ts` to `src/app/brevo.config.ts`
2. Open `src/app/brevo.config.ts`
3. Replace `'xkeysib-YOUR_BREVO_API_KEY_HERE'` with your actual API key
4. The file should look like:
```typescript
export const BREVO_CONFIG = {
  API_KEY: 'xkeysib-your-actual-api-key-here',
  // ... rest of config
};
```
5. **IMPORTANT**: Never commit `brevo.config.ts` to git (it's in .gitignore)

### 4. Test the Setup
1. Start the development server: `npm start`
2. Go to the contact form
3. Fill out and submit the form
4. Check the browser console for any errors
5. Check your email inbox (xsantcastx@xsantcastx.com) for the message

## 🔒 Security Features

### Email Restrictions
- **Only sends TO**: `xsantcastx@xsantcastx.com`
- **Cannot be changed** without code modification
- **No FROM restrictions**: Anyone can submit the contact form

### API Key Security
- API key is stored in frontend code (acceptable for Brevo's design)
- API key only allows sending emails (no reading/deleting)
- Rate limiting is handled by Brevo automatically

## 📋 Features

### Contact Form
- ✅ Name, email, message (required)
- ✅ Project type selection (optional)
- ✅ Budget range selection (optional)
- ✅ Beautiful HTML email templates
- ✅ Automatic reply-to configuration
- ✅ Error handling and user feedback

### Email Template
- 🎨 Modern dark theme matching portfolio design
- 📱 Mobile-responsive HTML emails
- 🔗 Includes reply-to functionality
- 📊 Project details and contact info sections
- ⚡ Fast delivery via Brevo SMTP

## 🛠️ File Structure

```
src/app/
├── brevo.config.ts          # Brevo configuration (UPDATE API KEY HERE)
├── email.service.ts         # Core email sending functionality
├── contact.service.ts       # Contact form logic
└── contact/
    ├── contact.component.ts # Contact form component
    ├── contact.component.html
    └── contact.component.css
```

## 🚀 Brevo Free Plan Limits

- **300 emails/day** free
- **Unlimited contacts**
- **Email marketing tools**
- **SMS marketing** (optional)

Perfect for a portfolio contact form!

## 🔧 Troubleshooting

### Common Issues

1. **"Invalid API key" error**
   - Double-check your API key in `brevo.config.ts`
   - Make sure it starts with `xkeysib-`
   - Verify the key has email sending permissions

2. **Form not submitting**
   - Check browser console for errors
   - Verify internet connection
   - Check if Brevo service is down

3. **Emails not arriving**
   - Check spam folder
   - Verify the recipient email is correct
   - Check Brevo dashboard for delivery status

## 📞 Support

If you need help with Brevo setup:
- [Brevo Documentation](https://help.brevo.com/)
- [Brevo API Reference](https://developers.brevo.com/)

---

**Next Steps:**
1. Update your API key in `brevo.config.ts`
2. Test the contact form
3. You're ready to receive project inquiries! 🎉