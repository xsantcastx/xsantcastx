import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';

interface ContactFormData {
  name: string;
  email: string;
  message: string;
  projectType?: string;
  budget?: string;
}

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

// Ensure Firebase Admin is initialized for App Check verification
if (getApps().length === 0) {
  initializeApp();
}

const appCheck = getAppCheck();
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const allowedOrigins = ['https://xsantcastx.com', 'https://www.xsantcastx.com', 'http://localhost:4200'];

export const sendContactEmail = onRequest({
  cors: true,
  region: 'us-east4'
}, async (req, res) => {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  } else {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isEmulator) {
    const appCheckToken = req.header('X-Firebase-AppCheck');
    if (!appCheckToken) {
      res.status(401).json({ error: 'Missing App Check token' });
      return;
    }

    try {
            await appCheck.verifyToken(appCheckToken);
    } catch (verificationError) {
      logger.warn('Invalid App Check token on contact form submission', verificationError);
      res.status(401).json({ error: 'Invalid App Check token' });
      return;
    }
  }

  try {
    const { name, email, message, projectType, budget }: ContactFormData = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required' });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: 'xsantcastx@gmail.com', // Your email
      replyTo: email,
      subject: `New Project Inquiry from ${name} - xsantcastx Contact Form`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00ffcc;">New Project Inquiry - xsantcastx</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Contact Information</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${projectType ? `<p><strong>Project Type:</strong> ${projectType}</p>` : ''}
            ${budget ? `<p><strong>Budget Range:</strong> ${budget}</p>` : ''}
          </div>

          <div style="background: #fff; padding: 20px; border-left: 4px solid #00ffcc; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Project Details</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>

          <div style="margin-top: 30px; padding: 15px; background: #e8f9f5; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This email was sent from the xsantcastx contact form at ${new Date().toLocaleString()}.
              Reply to this email to respond directly to ${name}.
            </p>
          </div>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    logger.info(`Contact form submitted by ${name} (${email})`);

    res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully' 
    });

  } catch (error) {
    logger.error('Error sending contact email:', error);
    res.status(500).json({ 
      error: 'Failed to send contact form. Please try again later.' 
    });
  }
});


