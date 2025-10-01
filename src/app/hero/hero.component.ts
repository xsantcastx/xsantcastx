import { Component, AfterViewInit, ElementRef, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { AuthServiceService } from '../auth-service.service';
import { FirebaseService } from '../firebase.service';
import { TranslationService } from '../translation.service';
import { Wallet, Transaction } from '../models/crypto.models';
import { User } from 'firebase/auth';

@Component({
    selector: 'app-hero',
    templateUrl: './hero.component.html',
    styleUrls: ['./hero.component.css'],
    standalone: false
})
export class HeroComponent implements AfterViewInit, OnInit, OnDestroy {
  private elRef: ElementRef = inject(ElementRef);
  private authService = inject(AuthServiceService);
  private firebaseService = inject(FirebaseService);
  private router = inject(Router);

  user$: Observable<User | null> = this.authService.user$;

  email = '';
  password = '';

  wallets: Wallet[] = [];
  transactions: Transaction[] = [];

  private userSubscription: Subscription | undefined;
  private walletSubscription: Subscription | undefined;
  private transactionSubscription: Subscription | undefined;

  constructor(
    private translationService: TranslationService
  ) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      if (user) {
        this.walletSubscription = this.firebaseService.getWallet(user.uid).subscribe(wallets => {
          this.wallets = wallets;
        });
        this.transactionSubscription = this.firebaseService.getTransactions(user.uid).subscribe(transactions => {
          this.transactions = transactions;
        });
      } else {
        this.wallets = [];
        this.transactions = [];
      }
    });
  }

  ngAfterViewInit() {
    const sections = this.elRef.nativeElement.querySelectorAll("section");

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        } else {
          entry.target.classList.remove("visible");
        }
      });
    }, { threshold: 0.5 });

    sections.forEach((section: Element) => observer.observe(section));
  }

  async register() {
    if (!this.email || !this.password) {
      console.error('Email and password are required');
      return;
    }
    try {
      const userCredential = await this.authService.signUp(this.email, this.password);
      await this.firebaseService.createUser(userCredential.user);
      // No navigation needed, the view will update automatically
    } catch (error) {
      console.error('Registration failed', error);
    }
  }

  async login() {
    if (!this.email || !this.password) {
      console.error('Email and password are required');
      return;
    }
    try {
      await this.authService.signIn(this.email, this.password);
      // No navigation needed
    } catch (error) {
      console.error('Login failed', error);
    }
  }

  async logout() {
    try {
      await this.authService.signOut();
      // No navigation needed
    } catch (error) {
      console.error('Logout failed', error);
    }
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    this.walletSubscription?.unsubscribe();
    this.transactionSubscription?.unsubscribe();
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
