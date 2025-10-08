import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
  projectType?: string;
  budget?: string;
}

export const sendContactEmail = onRequest(
  {
    cors: ["https://xsantcastx.com", "https://xsantcastx-1694b.web.app", "https://xsantcastx-1694b.firebaseapp.com"],
    maxInstances: 10,
  },
  async (request, response) => {
    // Only allow POST requests
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const data: ContactFormData = request.body;

      // Validate required fields
      if (!data.name || !data.email || !data.message) {
        response.status(400).json({ 
          error: "Missing required fields: name, email, and message are required" 
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        response.status(400).json({ error: "Invalid email format" });
        return;
      }

      // Brevo API configuration - read from environment variable
      const apiKey = process.env.BREVO_API_KEY;
      if (!apiKey) {
        logger.error("Brevo API key not configured in environment");
        response.status(500).json({ error: "Email service configuration error" });
        return;
      }

      // Generate email content
      const subject = `New Project Inquiry from ${data.name} - xsantcastx Portfolio`;
      
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff;">
          <div style="background: linear-gradient(135deg, #00ffcc 0%, #00cc99 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; color: #000; font-size: 2rem; font-weight: 700;">✨ New Project Inquiry</h1>
            <p style="margin: 0.5rem 0 0 0; color: #000; opacity: 0.8; font-size: 1.1rem;">xsantcastx Portfolio Contact Form</p>
          </div>
          
          <div style="padding: 2rem; background: #1a1a1a;">
            <div style="background: #2a2a2a; border: 2px solid #00ffcc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #00ffcc; margin-top: 0; font-size: 1.3rem;">👤 Contact Information</h2>
              <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; border-left: 4px solid #00ffcc;">
                <p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Name:</strong> <span style="color: #fff;">${data.name}</span></p>
                <p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Email:</strong> <span style="color: #fff;">${data.email}</span></p>
                ${data.projectType ? `<p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Project Type:</strong> <span style="color: #fff;">${data.projectType}</span></p>` : ''}
                ${data.budget ? `<p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Budget Range:</strong> <span style="color: #fff;">${data.budget}</span></p>` : ''}
              </div>
            </div>
            
            <div style="background: #2a2a2a; border: 2px solid #00ffcc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h3 style="color: #00ffcc; margin-top: 0; font-size: 1.3rem;">📝 Project Details</h3>
              <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; border-left: 4px solid #00ffcc;">
                <p style="white-space: pre-wrap; line-height: 1.6; color: #fff; margin: 0;">${data.message}</p>
              </div>
            </div>

            <div style="background: linear-gradient(135deg, #0d2818, #1a3d2e); border: 1px solid #00ffcc; border-radius: 8px; padding: 1rem; text-align: center;">
              <p style="margin: 0; font-size: 0.9rem; color: #00ffcc;">
                📧 <strong>Sent via Firebase Functions</strong> from xsantcastx.com<br>
                🕒 <strong>Timestamp:</strong> ${new Date().toLocaleString()}<br>
                💬 <strong>Reply to this email</strong> to respond directly to ${data.name}
              </p>
            </div>
          </div>
        </div>
      `;

      const textContent = `
NEW PROJECT INQUIRY - xsantcastx Portfolio Contact Form
=====================================================

Contact Information:
- Name: ${data.name}
- Email: ${data.email}
${data.projectType ? `- Project Type: ${data.projectType}` : ''}
${data.budget ? `- Budget Range: ${data.budget}` : ''}

Project Details:
${data.message}

=====================================================
This email was sent from xsantcastx.com contact form
Timestamp: ${new Date().toLocaleString()}
Reply to this email to respond directly to ${data.name}
      `;

      // Brevo API payload
      const brevoPayload = {
        sender: {
          email: 'noreply@xsantcastx.com',
          name: 'xsantcastx Portfolio'
        },
        to: [{
          email: 'xsantcastx@xsantcastx.com',
          name: 'Santiago Castrillon'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent,
        replyTo: {
          email: data.email,
          name: data.name
        }
      };

      // Send email via Brevo API
      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(brevoPayload)
      });

      if (!brevoResponse.ok) {
        const errorData = await brevoResponse.text();
        logger.error('Brevo API error:', errorData);
        response.status(500).json({ error: 'Failed to send email' });
        return;
      }

      const brevoResult = await brevoResponse.json();
      logger.info('Email sent successfully:', brevoResult.messageId);

      response.status(200).json({
        success: true,
        message: 'Thank you! Your project brief has been sent. We will reply within 24 hours.',
        messageId: brevoResult.messageId
      });

    } catch (error) {
      logger.error('Contact form error:', error);
      response.status(500).json({ 
        error: 'Sorry, there was an error sending your message. Please try again or contact us directly.' 
      });
    }
  }
);