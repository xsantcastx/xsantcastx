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

    // Check if Brevo is configured
    if (!this.emailService.isConfigured()) {
      return throwError(() => new Error('Email service is not properly configured. Please contact administrator.'));
    }

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
        console.error('Contact form submission error:', error);
        return throwError(() => new Error('Sorry, there was an error sending your message. Please try again or contact us directly.'));
      })
    );
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