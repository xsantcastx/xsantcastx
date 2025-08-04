import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceService } from '../auth-service.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';

  private authService = inject(AuthServiceService);
  private router = inject(Router);

  async login() {
    if (!this.email || !this.password) {
      console.error('Email and password are required');
      return;
    }
    try {
      await this.authService.signIn(this.email, this.password);
      this.router.navigate(['/profile']);
    } catch (error) {
      console.error('Login failed', error);
    }
  }
}
