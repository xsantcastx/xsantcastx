import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  senderName?: string;
  replyTo?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  // Use same-origin endpoint via Firebase Hosting rewrite (no CORS)
  private readonly functionUrl = '/api/send-contact';

  constructor(private http: HttpClient) {}

  /**
   * Send email using Firebase Function (secure, recommended)
   */
  sendEmail(emailData: EmailData): Observable<EmailResponse> {
    // Only allow sending to your approved email
    if (emailData.to !== 'xsantcastx@xsantcastx.com') {
      return throwError(() => new Error('Email can only be sent to xsantcastx@xsantcastx.com'));
    }

    // Build the payload to match your function's expected input
    const payload: any = {
      name: emailData.senderName || 'Contact Form Sender',
      email: emailData.replyTo || 'noreply@xsantcastx.com',
      message: emailData.textContent,
    };
    // Optionally add projectType, budget, etc. if present
    if ((emailData as any).projectType) payload.projectType = (emailData as any).projectType;
    if ((emailData as any).budget) payload.budget = (emailData as any).budget;

    return this.http.post<any>(this.functionUrl, payload).pipe(
      map(response => ({
        success: true,
        messageId: response.messageId
      })),
      catchError(error => {
        console.error('Contact Function Error:', error);
        let errorMessage = 'Failed to send email';
        if (error.error?.error) {
          errorMessage = error.error.error;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Validate if email is allowed to receive messages
   */
  isEmailAllowed(email: string): boolean {
    return email.toLowerCase() === 'xsantcastx@xsantcastx.com';
  }

  /**
   * Get the allowed recipient email
   */
  getAllowedEmail(): string {
    return 'xsantcastx@xsantcastx.com';
  }

  /**
   * Always true, since function is always configured
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Generate a standard contact form email template
   */
  generateContactEmailTemplate(data: {
    name: string;
    email: string;
    message: string;
    projectType?: string;
    budget?: string;
  }): { htmlContent: string; textContent: string; subject: string } {
    const subject = `New Project Inquiry from ${data.name} - xsantcastx Portfolio`;
    
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff;">
        <div style="background: linear-gradient(135deg, #00ffcc 0%, #00cc99 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #000; font-size: 2rem; font-weight: 700;">✨ New Project Inquiry</h1>
          <p style="margin: 0.5rem 0 0 0; color: #000; opacity: 0.8; font-size: 1.1rem;">xsantcastx Portfolio Contact Form</p>
        </div>
        
        <div style="padding: 2rem; background: #1a1a1a;">
          <div style="background: #2a2a2a; border: 2px solid #00ffcc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
            <h2 style="color: #00ffcc; margin-top: 0; font-size: 1.3rem; display: flex; align-items: center;">
              👤 Contact Information
            </h2>
            <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; border-left: 4px solid #00ffcc;">
              <p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Name:</strong> <span style="color: #fff;">${data.name}</span></p>
              <p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Email:</strong> <span style="color: #fff;">${data.email}</span></p>
              ${data.projectType ? `<p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Project Type:</strong> <span style="color: #fff;">${data.projectType}</span></p>` : ''}
              ${data.budget ? `<p style="margin: 0.5rem 0;"><strong style="color: #00ffcc;">Budget Range:</strong> <span style="color: #fff;">${data.budget}</span></p>` : ''}
            </div>
          </div>
          
          <div style="background: #2a2a2a; border: 2px solid #00ffcc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
            <h3 style="color: #00ffcc; margin-top: 0; font-size: 1.3rem; display: flex; align-items: center;">
              📝 Project Details
            </h3>
            <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; border-left: 4px solid #00ffcc;">
              <p style="white-space: pre-wrap; line-height: 1.6; color: #fff; margin: 0;">${data.message}</p>
            </div>
          </div>

          <div style="background: linear-gradient(135deg, #0d2818, #1a3d2e); border: 1px solid #00ffcc; border-radius: 8px; padding: 1rem; text-align: center;">
            <p style="margin: 0; font-size: 0.9rem; color: #00ffcc;">
              📧 <strong>Sent via Brevo SMTP</strong> from xsantcastx.com<br>
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

    return { htmlContent, textContent, subject };
  }
}