import { Component, inject } from '@angular/core';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-donation-form',
  templateUrl: './donation-form.component.html',
  styleUrls: ['./donation-form.component.css']
})
export class DonationFormComponent {
  private firebaseService = inject(FirebaseService);

  kaspaWallet = 'kaspa:qzytrwv3m2a3y5z8y2gfw8x0q9q8x0q9q8x0q9q8x0';
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
