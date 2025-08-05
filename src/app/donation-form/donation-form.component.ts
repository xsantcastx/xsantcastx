import { Component, inject } from '@angular/core';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-donation-form',
  templateUrl: './donation-form.component.html',
  styleUrls: ['./donation-form.component.css'],
  standalone: false
})
export class DonationFormComponent {
  private firebaseService = inject(FirebaseService);

  kaspaWallet = 'kaspa:qpg5xnu998y4ycaug0m85gs3wuy7hmpj66a0ygqkcn8797e4paqlxre4jz7xa';
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${this.kaspaWallet}`;
  message = '';
  confirmationMessage = '';

  async submitDonation() {
    if (!this.message) return;

    try {
      await this.firebaseService.addDonation({
        message: this.message,
        createdAt: new Date()
      });
      this.confirmationMessage = 'Thank you for your support!';
      this.message = '';
      setTimeout(() => this.confirmationMessage = '', 5000);
    } catch (error) {
      console.error('Failed to submit donation message', error);
      this.confirmationMessage = 'Failed to send message. Please try again.';
    }
  }
}
