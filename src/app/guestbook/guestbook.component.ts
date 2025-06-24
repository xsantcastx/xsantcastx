import { Component } from '@angular/core';

@Component({
    selector: 'app-guestbook',
    templateUrl: './guestbook.component.html',
    styleUrls: ['./guestbook.component.css'],
    standalone: false
})
export class GuestbookComponent {
  nickname = '';
  message = '';
  guestbookEntries: { nickname: string; message: string }[] = [];

  submitMessage() {
    if (this.nickname && this.message) {
      this.guestbookEntries.unshift({ nickname: this.nickname, message: this.message });
      this.nickname = '';
      this.message = '';
    }
  }
}
