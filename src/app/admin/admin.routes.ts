import { Routes } from '@angular/router';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';
import { getApp } from '@angular/fire/app';
import { AdminComponent } from './admin.component';
import { adminGuard } from './admin.guard';
import { AdminDataService } from './admin-data.service';

/**
 * /admin is lazy because provideAuth() drags in
 * @firebase/auth (~428 kB) plus its re2js dependency (~265 kB), and neither
 * belongs in the initial bundle for a route one person will ever open.
 *
 * The guard lives on *this* child route rather than on the loadChildren entry
 * in app-routing.module.ts, because it calls inject(Auth) — and Auth only
 * exists inside the injector created by the providers below. A guard on the
 * parent runs before this injector exists and would throw NG0201.
 *
 * provideFirestore() is here for the same reason it is no longer in AppModule:
 * the dashboard is the one place that needs AngularFire's Firestore bindings
 * (everything else goes through shared/lazy-firestore.service.ts), and scoping
 * them here keeps the SDK in the /admin chunk. AdminDataService is listed
 * alongside because it is declared providedIn:'root' and a root-scoped
 * instance cannot see this route's Firestore — it would throw NG0201.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [adminGuard],
    providers: [
      provideAuth(() => getAuth()),
      provideFirestore(() => {
        // initializeFirestore() throws if Firestore has already been started —
        // LazyFirestoreService may well have started it already. Share that
        // instance rather than creating a second, mismatched one.
        const app = getApp();
        try {
          return initializeFirestore(app, { experimentalForceLongPolling: true });
        } catch {
          return getFirestore(app);
        }
      }),
      AdminDataService
    ]
  }
];
