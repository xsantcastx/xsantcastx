import { Component, OnInit, inject, ApplicationRef } from '@angular/core';
import { RealtimeDBserviceService } from '../realtime-dbservice.service'; 
import { Auth, user } from '@angular/fire/auth';
import { Observable, Subscription } from 'rxjs';
import { runInInjectionContext } from '@angular/core';

@Component({
  selector: 'app-guestbook',
  templateUrl: './guestbook.component.html',
  styleUrls: ['./guestbook.component.css'],
  standalone: false
})
export class GuestbookComponent implements OnInit {
  nickname = '';
  message = '';
  guestbookEntries$ = this.realtimeDb.getEntriesObservable();

  loading = true;
  error: string | null = null;

  private auth = inject(Auth);
  private appRef = inject(ApplicationRef);
  private subscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(private realtimeDb: RealtimeDBserviceService) {}

  ngOnInit(): void {
    // Subscribe to guestbook entries normally
    this.subscription = this.guestbookEntries$.subscribe({
      next: () => {
        this.loading = false;
        this.error = null;
      },
      error: err => {
        this.loading = false;
        this.error = 'Failed to load guestbook entries.';
        console.error(err);
      }
    });

    runInInjectionContext(this.appRef.injector, () => {
      this.userSubscription = user(this.auth).subscribe(u => {
        if (u) {
          if (u.isAnonymous) {
            this.nickname = 'Anonymous';
          } else if (u.displayName) {
            this.nickname = u.displayName.split(' ')[0]; // First name only
          }
        }
      });
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }

  submitMessage() {
    if (this.nickname && this.message) {
      this.realtimeDb.addEntry(this.nickname, this.message)
        .then(() => {
          this.message = '';
        })
        .catch(err => {
          this.error = 'Failed to send message.';
          console.error('Error adding message:', err);
        });
    }
  }

  // Helper to format timestamps nicely
   formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}
