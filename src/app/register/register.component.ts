import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceService } from '../auth-service.service';
import { FirebaseService } from '../firebase.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  email = '';
  password = '';

  private authService = inject(AuthServiceService);
  private firebaseService = inject(FirebaseService);
  private router = inject(Router);

  async register() {
    if (!this.email || !this.password) {
      console.error('Email and password are required');
      return;
    }
    try {
      const userCredential = await this.authService.signUp(this.email, this.password);
      await this.firebaseService.createUser(userCredential.user);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Registration failed', error);
      // Here you could add user-facing error messages
    }
  }
}
