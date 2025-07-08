import { Component, OnInit, OnDestroy, inject, ApplicationRef } from '@angular/core';
import { RealtimeDBserviceService } from '../realtime-dbservice.service'; 
import { Auth, user } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { runInInjectionContext } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-guestbook',
  templateUrl: './guestbook.component.html',
  styleUrls: ['./guestbook.component.css'],
  standalone: false
})
export class GuestbookComponent implements OnInit, OnDestroy {
  nickname = '';
  message = '';
  entries: any[] = [];
  pageSize = 5;
  lastKey: string | null = null;

  loading = true;
  loadingMore = false;
  error: string | null = null;

  private auth = inject(Auth);
  private appRef = inject(ApplicationRef);
  private userSubscription?: Subscription;

  constructor(
    private titleService: Title,
    private realtimeDb: RealtimeDBserviceService
  ) {
    this.titleService.setTitle('💬 Leave Your Glitchy Mark | xsantcastx');
  }

  ngOnInit(): void {
    this.loadInitialEntries();

    runInInjectionContext(this.appRef.injector, () => {
      this.userSubscription = user(this.auth).subscribe(u => {
        if (u) {
          this.nickname = u.isAnonymous ? 'Anonymous' : (u.displayName?.split(' ')[0] || 'Guest');
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  loadInitialEntries(): void {
    this.loading = true;
    this.realtimeDb.getEntries(this.pageSize).then(data => {
      this.entries = data.entries;
      this.lastKey = data.lastKey;
      this.loading = false;
    }).catch(err => {
      this.error = 'Failed to load guestbook entries.';
      this.loading = false;
      console.error(err);
    });
  }

  loadMoreEntries(): void {
    if (this.loadingMore || !this.lastKey) return;

    this.loadingMore = true;
    this.realtimeDb.getEntries(this.pageSize, this.lastKey).then(data => {
      this.entries = [...this.entries, ...data.entries];
      this.lastKey = data.lastKey;
      this.loadingMore = false;
    }).catch(err => {
      console.error('Error loading more entries:', err);
      this.loadingMore = false;
    });
  }

  onScroll(event: any): void {
    const element = event.target;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 10) {
      this.loadMoreEntries();
    }
  }

  submitMessage(): void {
    if (this.nickname && this.message) {
      this.realtimeDb.addEntry(this.nickname, this.message)
        .then(() => {
          this.message = '';
          this.loadInitialEntries(); // Refresh entries after submission
        })
        .catch(err => {
          this.error = 'Failed to send message.';
          console.error('Error adding message:', err);
        });
    }
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}
