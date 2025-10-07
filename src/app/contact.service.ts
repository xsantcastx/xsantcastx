import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { EmailService } from './email.service';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
  projectType?: string;
  budget?: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  constructor(private emailService: EmailService) {}

  sendContactForm(data: ContactFormData): Observable<ContactResponse> {
    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return throwError(() => new Error('Name, email, and message are required'));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return throwError(() => new Error('Invalid email format'));
    }

    // Try Brevo first, fallback to mailto if it fails
    if (this.emailService.isConfigured()) {
      // Generate email content using the EmailService
      const { htmlContent, textContent, subject } = this.emailService.generateContactEmailTemplate(data);

      // Send email to the allowed recipient
      return this.emailService.sendEmail({
        to: this.emailService.getAllowedEmail(),
        subject,
        htmlContent,
        textContent,
        replyTo: data.email,
        senderName: data.name
      }).pipe(
        map(response => ({
          success: response.success,
          message: 'Thank you! Your project brief has been sent. We will reply within 24 hours.'
        })),
        catchError(error => {
          console.error('Brevo failed, falling back to mailto:', error);
          // Fallback to mailto
          this.openMailtoFallback(data);
          return throwError(() => new Error('Email service encountered an issue. We\'ve opened your email client as a backup. Please send the message from there.'));
        })
      );
    } else {
      // If not configured, use mailto directly
      this.openMailtoFallback(data);
      return throwError(() => new Error('We\'ve opened your email client. Please send your message from there, or contact us directly at xsantcastx@xsantcastx.com'));
    }
  }

  private openMailtoFallback(data: ContactFormData): void {
    const subject = `Project Inquiry from ${data.name}`;
    const body = `Hi Santiago,

I'm interested in working with you on a project.

Name: ${data.name}
Email: ${data.email}
${data.projectType ? `Project Type: ${data.projectType}` : ''}
${data.budget ? `Budget Range: ${data.budget}` : ''}

Message:
${data.message}

Looking forward to hearing from you!

Best regards,
${data.name}`;

    const mailtoUrl = `mailto:xsantcastx@xsantcastx.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  /**
   * Validate if the contact form can be submitted
   */
  canSubmitForm(): boolean {
    return this.emailService.isConfigured();
  }

  /**
   * Get the contact email address
   */
  getContactEmail(): string {
    return this.emailService.getAllowedEmail();
  }
}