import { Routes } from '@angular/router';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { AuthServiceService } from '../../auth-service.service';
import { PdfGeneratorComponent } from './pdf-generator.component';

/**
 * pdf-generator offers optional Google sign-in, so it is the only tool that
 * needs Firebase Auth. Scoping provideAuth() to this route — instead of the
 * root injector — keeps @firebase/auth and re2js out of the initial bundle.
 *
 * AuthServiceService is listed here as well: it is declared providedIn:'root',
 * and a root-scoped instance cannot see route-level providers, so it would fail
 * with NG0201. Listing the class here creates it in this route's injector,
 * where Auth actually exists.
 */
export const PDF_GENERATOR_ROUTES: Routes = [
  {
    path: '',
    component: PdfGeneratorComponent,
    providers: [
      provideAuth(() => getAuth()),
      AuthServiceService
    ]
  }
];
