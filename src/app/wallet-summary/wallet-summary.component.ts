import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthServiceService } from '../auth-service.service';
import { FirebaseService } from '../firebase.service';
import { Wallet } from '../models/crypto.models';

@Component({
  selector: 'app-wallet-summary',
  templateUrl: './wallet-summary.component.html',
  styleUrls: ['./wallet-summary.component.css']
})
export class WalletSummaryComponent implements OnInit, OnDestroy {
  private authService = inject(AuthServiceService);
  private firebaseService = inject(FirebaseService);

  wallets: Wallet[] = [];
  private userSubscription: Subscription | undefined;
  private walletSubscription: Subscription | undefined;

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      if (user) {
        this.walletSubscription = this.firebaseService.getWallet(user.uid).subscribe(wallets => {
          this.wallets = wallets;
        });
      } else {
        this.wallets = [];
      }
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    this.walletSubscription?.unsubscribe();
  }
}
