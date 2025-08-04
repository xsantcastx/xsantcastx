import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {
  private auth: Auth = inject(Auth);
  user$: Observable<User | null> = authState(this.auth);

  constructor() {}

  // Sign in with Email and Password
  signIn(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Sign up new user
  signUp(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  // Sign out
  signOut() {
    return signOut(this.auth);
  }
}