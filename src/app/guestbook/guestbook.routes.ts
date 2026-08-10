import { Routes } from '@angular/router';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { RealtimeDBserviceService } from '../realtime-dbservice.service';
import { GuestbookComponent } from './guestbook.component';

/**
 * Guestbook is the only route that needs Firebase Auth and Realtime Database.
 * Scoping both providers here — rather than in AppModule — keeps
 * @firebase/auth (~428 kB), its re2js dependency (~265 kB) and the RTDB SDK
 * out of the initial bundle; they now load only when /guestbook is visited.
 */
export const GUESTBOOK_ROUTES: Routes = [
  {
    path: '',
    component: GuestbookComponent,
    providers: [
      provideAuth(() => getAuth()),
      provideDatabase(() => getDatabase()),
      // Declared providedIn:'root', but a root-scoped instance cannot see the
      // route-level Database/Auth above and would throw NG0201. Listing it here
      // builds it in this route's injector instead.
      RealtimeDBserviceService
    ]
  }
];
