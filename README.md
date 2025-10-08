# xsantcastx PortfolioA. Verify your Firebase config matches the xsantcastx-1694b project



> Modern Angular portfolio with Firebase integration, real-time features, and secure contact form.In your Angular environment.ts/environment.prod.ts, confirm every field:



## 🚀 Tech Stack// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";

- **Frontend**: Angular 20.0.4 with TypeScript 5.8.3import { getAnalytics } from "firebase/analytics";

- **Backend**: Firebase (Firestore, Realtime Database, Auth, Functions)// TODO: Add SDKs for Firebase products that you want to use

- **Analytics**: Firebase Analytics + Performance Monitoring// https://firebase.google.com/docs/web/setup#available-libraries

- **Security**: Firebase App Check with reCAPTCHA v3

- **Email**: Brevo API via Firebase Functions// Your web app's Firebase configuration

- **Hosting**: Firebase Hosting// For Firebase JS SDK v7.20.0 and later, measurementId is optional

- **CI/CD**: GitHub Actionsconst firebaseConfig = {

  apiKey: "AIzaSyAABzajHVAd6NbLjMGk4IIVA9pB1T-P7To",

## 📋 Prerequisites  authDomain: "xsantcastx-1694b.firebaseapp.com",

  databaseURL: "https://xsantcastx-1694b-default-rtdb.firebaseio.com",

- Node.js 20.x  projectId: "xsantcastx-1694b",

- npm or yarn  storageBucket: "xsantcastx-1694b.firebasestorage.app",

- Firebase CLI (`npm install -g firebase-tools`)  messagingSenderId: "773269119730",

- Angular CLI (`npm install -g @angular/cli`)  appId: "1:773269119730:web:35913c4cc6a67af3cba66b",

  measurementId: "G-YRC4F65V60"

## 🔧 Local Development Setup};



### 1. Clone and Install// Initialize Firebase

const app = initializeApp(firebaseConfig);

```bashconst analytics = getAnalytics(app);

git clone https://github.com/xsantcastx/xsantcastx.git

cd xsantcastx

npm installCommon gotcha: copying an apiKey/appId from a different Firebase project. A mismatched key + projectId will produce 400s on the Listen RPC.

```

B. Force Firestore to use long-polling (bypasses WebChannel issues)

### 2. Environment Configuration

On some networks or with certain extensions, the streaming transport gets blocked and you see exactly your error. Switch to long-polling:

The environment files are already configured with safe public values:

- `src/environments/environment.ts` - Development configIf you use the modular SDK:

- `src/environments/environment.prod.ts` - Production config

import { initializeApp } from 'firebase/app';

**Note**: All sensitive API keys are stored in backend Firebase Functions environment variables, NOT in these files.import { initializeFirestore, persistentLocalCache, setLogLevel } from 'firebase/firestore';



### 3. Backend Setup (Firebase Functions)const app = initializeApp(environment.firebase);



```bashsetLogLevel('error'); // or 'debug' temporarily to inspect

cd functionsconst db = initializeFirestore(app, {

npm install  experimentalAutoDetectLongPolling: true, // key fix

```  useFetchStreams: false,                  // helps older browsers/extensions

  localCache: persistentLocalCache()       // optional, stable cache

Create a `.env` file in the `functions` directory:});



```env

# Brevo Email APIIf you’re on AngularFire (v7+ modular under the hood): provide this when you set up Firestore:

BREVO_API_KEY=your_brevo_api_key_here

import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';

# PayPal (optional)import { provideFirebaseApp, initializeApp } from '@angular/fire/app';

PAYPAL_CLIENT_ID=your_paypal_client_id

PAYPAL_CLIENT_SECRET=your_paypal_client_secretproviders: [

PAYPAL_MODE=sandbox  provideFirebaseApp(() => initializeApp(environment.firebase)),

  provideFirestore(() => {

# Stripe (optional)    const app = getApp();

STRIPE_SECRET_KEY=your_stripe_secret_key    return initializeFirestore(app, {

STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret      experimentalAutoDetectLongPolling: true,

      useFetchStreams: false

# Gmail (optional - legacy)    });

GMAIL_USER=your_gmail@gmail.com  }),

GMAIL_APP_PASSWORD=your_app_password]

```

C. Make sure you’re not initializing Firebase twice

**Important**: Never commit the `functions/.env` file! It's in `.gitignore`.

Search your codebase for initializeApp( and ensure it runs once. Duplicates can cause weird network churn + 400s.

### 4. Run Development Server

D. Clear local caches & try with extensions disabled

```bash

# From project rootDevTools → Application → Clear storage (tick IndexedDB / Cache Storage / Local Storage for your app).

npm start

Temporarily disable ad-block/VPN/privacy extensions and test again (they often break the WebChannel endpoint used by Firestore Listen).

# Or for custom port

ng serve --port 4200Try from an incognito window as a quick isolation test.

```

E. Check API key restrictions

Navigate to `http://localhost:4200/`

If you restricted the Firebase Web API key to specific referrers and your current hostname doesn’t match, Firestore bootstrap requests can fail with 400s. In Google Cloud Console → Credentials → your Web API key, either:

### 5. Deploy Firebase Functions (First Time)

add your dev/preview hostnames (e.g. http://localhost:*, your preview domain), or

```bash

cd functionstemporarily remove restrictions to test.

firebase login

firebase deploy --only functionsF. Confirm Firestore DB exists and matches mode

```

In Firebase Console → Firestore:

## 🏗️ Project Architecture

Ensure a Firestore database (not Datastore-mode) is created and in nam5 (your earlier error shows that’s your region).

### Frontend Structure

```Client SDK is global, so region isn’t set here—your prior extension failure was about Cloud Functions region, not the web client. But if the DB was never fully provisioned, Listen can 400.

src/

├── app/G. Turn on verbose logging briefly

│   ├── components/          # UI components

│   ├── services/            # Angular servicesAdd this once at startup to see more detail in the console:

│   │   ├── email.service.ts         # Contact form email (uses backend)

│   │   ├── firebase.service.ts      # Firebase operationsimport { setLogLevel } from 'firebase/firestore';

│   │   ├── firestore.service.ts     # Firestore CRUDsetLogLevel('debug');

│   │   └── realtime-dbservice.ts    # Realtime DB operations

│   ├── shared/              # Shared utilities

│   └── models/              # TypeScript interfacesIf you then see “No Firebase App ‘[DEFAULT]’ has been created” or auth token errors, we’ll know the exact branch.

├── environments/

│   ├── environment.ts       # Dev config (public values only)Bonus: the Chrome “lazy image” note

│   └── environment.prod.ts  # Prod config (public values only)

└── assets/                  # Static assetsLeave it (it’s informational), or set loading="eager" on above-the-fold images and include explicit width/height to keep CLS low.
```

### Backend Structure (Firebase Functions)
```
functions/
├── src/
│   └── contact.ts           # Secure contact email function
├── .env                     # Secrets (gitignored)
└── package.json
```

## 📧 Contact Form (Secure Email System)

The contact form uses a **secure backend approach**:

1. **Frontend** (`src/app/email.service.ts`):
   - Posts form data to `/api/send-contact`
   - No API keys in frontend code

2. **Firebase Hosting** (`firebase.json`):
   - Rewrites `/api/send-contact` → `sendContactEmail` function
   - Same-origin request (no CORS issues)

3. **Backend** (`functions/src/contact.ts`):
   - Validates input
   - Reads `BREVO_API_KEY` from environment
   - Sends email via Brevo API
   - Returns success/error response

### Test the Contact Form

Production:
```bash
curl -X POST "https://xsantcastx-1694b.web.app/api/send-contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Hello!"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Thank you! Your project brief has been sent...",
  "messageId": "<...@smtp-relay.mailin.fr>"
}
```

## 🔐 Security Architecture

### What's Public (Safe in Git)
✅ Firebase config (apiKey, authDomain, etc.) - Protected by Security Rules  
✅ reCAPTCHA site key - Public by design  
✅ Crypto wallet addresses - Meant to be public  
✅ Empty placeholder strings for optional services  

### What's Private (Backend Only)
🔒 Brevo API key - In `functions/.env`  
🔒 PayPal client secret - In `functions/.env`  
🔒 Stripe secret key - In `functions/.env`  
🔒 Gmail app password - In `functions/.env`  

### Firebase Security Rules
- Firestore: Rules configured per collection
- Realtime DB: Rules configured per path
- App Check: Validates requests with reCAPTCHA v3

## 🚀 Deployment

### Automated (via GitHub Actions)

Push to `main` branch automatically triggers:
1. Build Angular app (production mode)
2. Deploy to Firebase Hosting
3. Functions deployed separately (manual)

### Manual Deployment

**Full deployment:**
```bash
npm run build
firebase deploy
```

**Hosting only:**
```bash
firebase deploy --only hosting
```

**Functions only:**
```bash
cd functions
firebase deploy --only functions
```

**Specific function:**
```bash
firebase deploy --only functions:sendContactEmail
```

## 🧪 Testing

### Run Unit Tests
```bash
npm test
```

### Run End-to-End Tests
```bash
npm run e2e
```

### Test Contact Email Function Locally
```bash
cd functions
npm run serve

# In another terminal
curl -X POST "http://localhost:5001/xsantcastx-1694b/us-central1/sendContactEmail" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Hello!"}'
```

## 📊 Firebase Services Used

- **Firestore**: Document database for structured data
- **Realtime Database**: Real-time data sync
- **Authentication**: User authentication (future)
- **Analytics**: User behavior tracking
- **Performance Monitoring**: Page load metrics
- **App Check**: Bot/abuse prevention
- **Hosting**: Static file hosting + rewrites
- **Functions**: Serverless backend (contact form)

## 🔍 Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Firebase Functions Not Working
```bash
# Check function logs
firebase functions:log --only sendContactEmail

# Verify environment variables
cd functions
cat .env  # Should have BREVO_API_KEY

# Redeploy function
firebase deploy --only functions:sendContactEmail
```

### Contact Form Not Sending Emails
1. Check Firebase Function logs: `firebase functions:log`
2. Verify Brevo API key is set in `functions/.env`
3. Confirm sender email is verified in Brevo dashboard
4. Test function directly (see Testing section)

### App Check Errors
- Verify reCAPTCHA v3 site key is registered in Firebase Console
- Check browser console for App Check token errors
- Ensure `environment.appCheck.siteKey` is correct

## 📝 Environment Variables

### Frontend (Public - Safe in Git)
All in `src/environments/environment.ts`:
- Firebase config
- reCAPTCHA site key
- Crypto addresses
- Empty placeholders for optional services

### Backend (Private - In functions/.env)
```env
BREVO_API_KEY=xkeysib-...
PAYPAL_CLIENT_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GMAIL_APP_PASSWORD=...
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🔗 Links

- **Live Site**: https://xsantcastx.com
- **Firebase Console**: https://console.firebase.google.com/project/xsantcastx-1694b
- **GitHub**: https://github.com/xsantcastx/xsantcastx

---

**Built with ❤️ by xsantcastx**
