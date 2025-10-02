import { Component, inject } from '@angular/core';
import { FirebaseService } from '../firebase.service';
import { TranslationService } from '../translation.service';

@Component({
  selector: 'app-donation-form',
  templateUrl: './donation-form.component.html',
  styleUrls: ['./donation-form.component.css'],
  standalone: false
})
export class DonationFormComponent {
  private firebaseService = inject(FirebaseService);
  private translationService = inject(TranslationService);

  kaspaWallet = 'kaspa:qpg5xnu998y4ycaug0m85gs3wuy7hmpj66a0ygqkcn8797e4paqlxre4jz7xa';
  qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${this.kaspaWallet}`;
  message = '';
  confirmationMessage = '';
  confirmationIsError = false;
  copyFeedback = '';
  copyIsError = false;

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  async submitDonation(): Promise<void> {
    const trimmedMessage = this.message.trim();
    if (!trimmedMessage) {
      this.showConfirmation(this.translate('donation.form.messageRequired'), true);
      return;
    }

    try {
      await this.firebaseService.addDonation({
        message: trimmedMessage,
        createdAt: new Date()
      });
      this.message = '';
      this.showConfirmation(this.translate('donation.form.success'), false);
    } catch (error) {
      console.error('Failed to submit donation message', error);
      this.showConfirmation(this.translate('donation.form.error'), true);
    }
  }

  async copyWallet(): Promise<void> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.kaspaWallet);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = this.kaspaWallet;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }

      this.copyFeedback = this.translate('donation.form.copySuccess');
      this.copyIsError = false;
    } catch (error) {
      console.error('Unable to copy wallet address', error);
      this.copyFeedback = this.translate('donation.form.copyError');
      this.copyIsError = true;
    }

    if (this.copyFeedback) {
      setTimeout(() => {
        this.copyFeedback = '';
        this.copyIsError = false;
      }, 2500);
    }
  }

  private showConfirmation(message: string, isError: boolean): void {
    this.confirmationMessage = message;
    this.confirmationIsError = isError;

    if (message) {
      setTimeout(() => {
        this.confirmationMessage = '';
        this.confirmationIsError = false;
      }, 5000);
    }
  }
}


