import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-donation-feed',
  templateUrl: './donation-feed.component.html',
  styleUrls: ['./donation-feed.component.css'],
  standalone: false
})
export class DonationFeedComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  donations: { message: string, createdAt: any }[] = [];
  private donationsSubscription: Subscription | undefined;

  ngOnInit() {
    if (!this.isBrowser) return;
    this.donationsSubscription = this.firebaseService.getDonations().subscribe(donations => {
      this.donations = donations;
    });
  }

  ngOnDestroy() {
    this.donationsSubscription?.unsubscribe();
  }
}
