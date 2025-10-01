import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import for ngModel
import { TranslationService } from '../translation.service';
import { ContactService, ContactFormData } from '../contact.service';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.css'],
    standalone: false
})
export class ContactComponent {
  private translationService = inject(TranslationService);
  private contactService = inject(ContactService);
  
  name: string = '';
  email: string = '';
  message: string = '';
  projectType: string = '';
  budget: string = '';
  isSubmitting: boolean = false;
  submitMessage: string = '';

  onSubmit() {
    if (this.isSubmitting) return;
    
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
}