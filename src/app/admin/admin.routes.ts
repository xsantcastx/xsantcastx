import { Routes } from '@angular/router';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { AdminComponent } from './admin.component';
import { adminGuard } from './admin.guard';

/**
 * /admin is lazy for the same reason /guestbook is: provideAuth() drags in
 * @firebase/auth (~428 kB) plus its re2js dependency (~265 kB), and neither
 * belongs in the initial bundle for a route one person will ever open.
 *
 * The guard lives on *this* child route rather than on the loadChildren entry
 * in app-routing.module.ts, because it calls inject(Auth) — and Auth only
 * exists inside the injector created by the providers below. A guard on the
 * parent runs before this injector exists and would throw NG0201.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [adminGuard],
    providers: [
      provideAuth(() => getAuth())
    ]
  }
];
