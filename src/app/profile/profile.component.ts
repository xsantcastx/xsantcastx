import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceService } from '../auth-service.service';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent {
  private authService = inject(AuthServiceService);
  private router = inject(Router);

  user$: Observable<User | null> = this.authService.user$;

  async logout() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Logout failed', error);
    }
  }
}
