import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthServiceService } from '../auth-service.service';
import { FirebaseService } from '../firebase.service';
import { Transaction } from '../models/crypto.models';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.css'],
  standalone: false
})
export class TransactionListComponent implements OnInit, OnDestroy {
  private authService = inject(AuthServiceService);
  private firebaseService = inject(FirebaseService);

  transactions: Transaction[] = [];
  private userSubscription: Subscription | undefined;
  private transactionSubscription: Subscription | undefined;

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      if (user) {
        this.transactionSubscription = this.firebaseService.getTransactions(user.uid).subscribe(transactions => {
          this.transactions = transactions;
        });
      } else {
        this.transactions = [];
      }
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    this.transactionSubscription?.unsubscribe();
  }
}
