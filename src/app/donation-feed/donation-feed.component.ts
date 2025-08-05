import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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

  donations: { message: string, createdAt: any }[] = [];
  private donationsSubscription: Subscription | undefined;

  ngOnInit() {
    this.donationsSubscription = this.firebaseService.getDonations().subscribe(donations => {
      this.donations = donations;
    });
  }

  ngOnDestroy() {
    this.donationsSubscription?.unsubscribe();
  }
}
