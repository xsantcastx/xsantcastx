import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { environment } from './environments/environment';
import { AppModule } from './app/app.module';
import { browserLocalPersistence, setPersistence } from 'firebase/auth';



const app = initializeApp(environment.firebase);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LdTBGwrAAAAAIOsN7PjQTn1X6oKP3tQz6qJMXX1'), // Your site key
  isTokenAutoRefreshEnabled: true,
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
