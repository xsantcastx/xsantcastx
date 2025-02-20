import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import for ngModel

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  name: string = '';
  email: string = '';
  message: string = '';

  onSubmit() {
    console.log('Form submitted:', { name: this.name, email: this.email, message: this.message });
    alert('Message sent! Thank you for reaching out.');
    this.name = '';
    this.email = '';
    this.message = '';
  }
}