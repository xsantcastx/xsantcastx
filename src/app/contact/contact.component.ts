import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import for ngModel
import { TranslationService } from '../translation.service';
import { ContactService, ContactFormData } from '../contact.service';
import { AnalyticsService } from '../analytics.service';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.css'],
    standalone: false
})
export class ContactComponent {
  private translationService = inject(TranslationService);
  private contactService = inject(ContactService);
  private analyticsService = inject(AnalyticsService);
  
  name: string = '';
  email: string = '';
  message: string = '';
  projectType: string = '';
  budget: string = '';
  isSubmitting: boolean = false;
  submitMessage: string = '';

  onSubmit() {
    if (this.isSubmitting) return;
    
    // Check if email service is configured
    if (!this.contactService.canSubmitForm()) {
      this.submitMessage = 'Email service is temporarily unavailable. Please contact us directly at ' + this.contactService.getContactEmail();
      return;
    }
    
    this.isSubmitting = true;
    this.submitMessage = '';

    const formData: ContactFormData = {
      name: this.name,
      email: this.email,
      message: this.message,
      projectType: this.projectType,
      budget: this.budget
    };

    this.contactService.sendContactForm(formData).subscribe({
      next: (response) => {
        this.submitMessage = this.translate('contact.form.success');
        this.clearForm();
        this.isSubmitting = false;
        
        // Track successful contact form submission
        this.analyticsService.trackContactSubmit('form', this.projectType);
      },
      error: (error) => {
        console.error('Contact form error:', error);
        this.submitMessage = this.translate('contact.form.error');
        this.isSubmitting = false;
      }
    });
  }

  private clearForm() {
    this.name = '';
    this.email = '';
    this.message = '';
    this.projectType = '';
    this.budget = '';
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  trackSocialClick(platform: 'github' | 'linkedin' | 'twitter' | 'email'): void {
    this.analyticsService.trackSocialClick(platform);
  }
}