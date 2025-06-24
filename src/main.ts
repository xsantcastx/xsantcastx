import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { environment } from './environments/environment';
import { AppModule } from './app/app.module';
import { browserLocalPersistence, setPersistence } from 'firebase/auth';

// Enable debug mode for Firebase App Check (only for local development — remove in production!)
(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;

// IMPORTANT: Replace this token with the actual debug token printed in the browser console when you run once with debug enabled.
// You only need to do this once per browser, and you must add this token in Firebase Console > App Check > Debug tokens
localStorage.setItem('firebase-appcheck-debug-token', '5AC011C1-EB9F-42DA-9F9D-671E498E088A');

const app = initializeApp(environment.firebase);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LdTBGwrAAAAAIOsN7PjQTn1X6oKP3tQz6qJMXX1'), // Your site key
  isTokenAutoRefreshEnabled: true,
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
