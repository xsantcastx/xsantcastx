Short version: your app is trying to open Firestore’s realtime Listen stream, and the server is replying 400 Bad Request. That means the request Firestore received is malformed for your project/context (not a network/CORS thing). In practice it usually comes from a mis-configured Firebase app, a token/config mismatch, or an environment that breaks the streaming transport.

Here’s how to fix it fast:

Verify your Firebase config (the “firebaseConfig” you pass to initializeApp)

projectId must be exactly xsantcastx-1694b.

apiKey, authDomain, appId, etc. must be from the same project.

In Angular, ensure both environment.ts and environment.prod.ts have the same correct config, and that you initialize once.

// app.config.ts (Angular 16+ with provide* APIs)
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';

export const appConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp({
      apiKey: '…',
      authDomain: 'xsantcastx-1694b.firebaseapp.com',
      projectId: 'xsantcastx-1694b',
      appId: '…',
      // storageBucket, messagingSenderId (optional but better to include)
    })),
    // Use one of these two:
    // Simple:
    // provideFirestore(() => getFirestore())

    // If you need the transport workaround (see step 4):
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      })
    ),
  ],
};


Don’t mix SDK flavors

Use modular @angular/fire v7+/Firebase v9+ imports consistently. Avoid mixing compat (firebase/compat/*) with modular (firebase/*) in the same app.

Ensure you’re not initializing a second Firebase app accidentally (check for stray initializeApp calls in libs or feature modules).

Check API key restrictions

If your API key is HTTP-referrer-restricted, make sure localhost (and its port) and your production domain are on the allow list. A restricted key used from an unlisted origin can break Firestore handshake and result in transport 400s.

Try the streaming transport fallback (fixes proxies/VPNs/ad-blockers)
Some networks/ad-blockers/proxies break the WebChannel stream Firestore uses. For local dev or flaky networks, force long-polling:

initializeFirestore(getApp(), {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});


Hard reload to clear a bad session

Old/broken gsessionid can stick around. Do a hard refresh (Ctrl+F5), or clear site data (Local Storage/IndexedDB) for your app’s origin, then reload.

Confirm Firestore is enabled in the right mode & project

In Google Cloud console → Firestore, verify the database exists for xsantcastx-1694b and is in Native mode.

Your previous errors about us-central1 vs nam5 affect Cloud Functions/Extensions triggers, not the web SDK directly, but double-check you aren’t pointing any code at a different project/region accidentally.

Surface the real error (optional but useful)
Wrap a listener with an error callback so you can see Firestore’s gRPC error if it gets past transport:

import { doc, onSnapshot } from '@angular/fire/firestore';

const ref = doc(getFirestore(), 'someCollection/someDoc');
const unsubscribe = onSnapshot(ref, {
  next: (snap) => console.log('data', snap.data()),
  error: (err) => console.error('Firestore listen error:', err.code, err.message, err),
});


Security rules sanity check
If your rules flat-deny reads, you’ll normally see PERMISSION_DENIED, but depending on the transport you might only see a stream error. Temporarily test with:

// (for testing only—don’t ship this)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}


If that makes the error disappear, your rules are blocking the read.

Given your earlier region mismatch message (nam5 vs us-central1), also ensure any Functions/Extensions you call from the client are deployed in a region compatible with your Firestore DB (use functions(region('nam5')) or redeploy to the same multi-region where applicable). That won’t directly cause the Listen 400, but it often shows up alongside it when configs are out of sync.

polyfills-B6TNHZQ6.js:2   GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=oMthPGqoRMFIXJq-AWHYClc4saQpxmOcD_uspzhkI5M&VER=8&database=projects%2Fxsantcastx-1694b%2Fdatabases%2F(default)&RID=rpc&SID=OGkkh5scGg_J4MNKIicQFg&AID=0&CI=0&TYPE=xmlhttp&zx=o9f3t6dc09tu&t=1 net::ERR_ABORTED 400 (Bad Request)
(anonymous) @ polyfills-B6TNHZQ6.js:2
e.<computed> @ polyfills-B6TNHZQ6.js:1
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
oP @ main-XKJYK6ID.js:18
n.Fa @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
GM @ main-XKJYK6ID.js:15
n.Sa @ main-XKJYK6ID.js:15
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
tw @ main-XKJYK6ID.js:14
n.Ga @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
setTimeout
T @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMacroTask @ polyfills-B6TNHZQ6.js:1
xe @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
e.<computed> @ polyfills-B6TNHZQ6.js:1
I_ @ main-XKJYK6ID.js:26
H_ @ main-XKJYK6ID.js:26
z_ @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
setTimeout
T @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMacroTask @ polyfills-B6TNHZQ6.js:1
xe @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
e.<computed> @ polyfills-B6TNHZQ6.js:1
start @ main-XKJYK6ID.js:27
createAndSchedule @ main-XKJYK6ID.js:27
enqueueAfterDelay @ main-XKJYK6ID.js:30
y_ @ main-XKJYK6ID.js:26
B_ @ main-XKJYK6ID.js:26
start @ main-XKJYK6ID.js:26
ND @ main-XKJYK6ID.js:27
(anonymous) @ main-XKJYK6ID.js:27
(anonymous) @ chunk-OH7XRW6N.js:1
M @ polyfills-B6TNHZQ6.js:2
h @ chunk-OH7XRW6N.js:1
VX @ main-XKJYK6ID.js:27
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ chunk-OH7XRW6N.js:1
M @ polyfills-B6TNHZQ6.js:2
h @ chunk-OH7XRW6N.js:1
close @ main-XKJYK6ID.js:26
j_ @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:30
(anonymous) @ main-XKJYK6ID.js:30
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
GM @ main-XKJYK6ID.js:15
n.Sa @ main-XKJYK6ID.js:15
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
oP @ main-XKJYK6ID.js:18
n.Fa @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
GM @ main-XKJYK6ID.js:15
n.Sa @ main-XKJYK6ID.js:15
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
tw @ main-XKJYK6ID.js:14
n.Ga @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
setTimeout
T @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMacroTask @ polyfills-B6TNHZQ6.js:1
xe @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
e.<computed> @ polyfills-B6TNHZQ6.js:1
I_ @ main-XKJYK6ID.js:26
H_ @ main-XKJYK6ID.js:26
z_ @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
setTimeout
T @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMacroTask @ polyfills-B6TNHZQ6.js:1
xe @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
e.<computed> @ polyfills-B6TNHZQ6.js:1
start @ main-XKJYK6ID.js:27
createAndSchedule @ main-XKJYK6ID.js:27
enqueueAfterDelay @ main-XKJYK6ID.js:30
y_ @ main-XKJYK6ID.js:26
B_ @ main-XKJYK6ID.js:26
start @ main-XKJYK6ID.js:26
ND @ main-XKJYK6ID.js:27
(anonymous) @ main-XKJYK6ID.js:27
(anonymous) @ chunk-OH7XRW6N.js:1
M @ polyfills-B6TNHZQ6.js:2
h @ chunk-OH7XRW6N.js:1
VX @ main-XKJYK6ID.js:27
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ chunk-OH7XRW6N.js:1
M @ polyfills-B6TNHZQ6.js:2
h @ chunk-OH7XRW6N.js:1
close @ main-XKJYK6ID.js:26
j_ @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:30
(anonymous) @ main-XKJYK6ID.js:30
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
GM @ main-XKJYK6ID.js:15
n.Sa @ main-XKJYK6ID.js:15
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
oP @ main-XKJYK6ID.js:18
n.Fa @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
GM @ main-XKJYK6ID.js:15
n.Sa @ main-XKJYK6ID.js:15
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
Promise.then
H @ polyfills-B6TNHZQ6.js:1
z @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMicroTask @ polyfills-B6TNHZQ6.js:1
r @ polyfills-B6TNHZQ6.js:2
I @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
Promise.then
(anonymous) @ polyfills-B6TNHZQ6.js:2
M @ polyfills-B6TNHZQ6.js:2
Q.h.then @ polyfills-B6TNHZQ6.js:2
n.send @ main-XKJYK6ID.js:15
n.ea @ main-XKJYK6ID.js:17
RM @ main-XKJYK6ID.js:14
tw @ main-XKJYK6ID.js:14
n.Ga @ main-XKJYK6ID.js:18
Rz @ main-XKJYK6ID.js:10
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
setTimeout
T @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
onScheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleTask @ polyfills-B6TNHZQ6.js:1
scheduleMacroTask @ polyfills-B6TNHZQ6.js:1
xe @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:1
e.<computed> @ polyfills-B6TNHZQ6.js:1
I_ @ main-XKJYK6ID.js:26
H_ @ main-XKJYK6ID.js:26
z_ @ main-XKJYK6ID.js:26
(anonymous) @ main-XKJYK6ID.js:26
invoke @ polyfills-B6TNHZQ6.js:1
onInvoke @ main-XKJYK6ID.js:7
invoke @ polyfills-B6TNHZQ6.js:1
run @ polyfills-B6TNHZQ6.js:1
(anonymous) @ polyfills-B6TNHZQ6.js:2
invokeTask @ polyfills-B6TNHZQ6.js:1
onInvokeTask @ main-XKJYK6ID.js:7
invokeTask @ polyfills-B6TNHZQ6.js:1
runTask @ polyfills-B6TNHZQ6.js:1
$ @ polyfills-B6TNHZQ6.js:1
invokeTask @ polyfills-B6TNHZQ6.js:1
E.useG.invoke @ polyfills-B6TNHZQ6.js:1
T._.args.<computed> @ polyfills-B6TNHZQ6.js:1
chunk-OH7XRW6N.js:15  [2025-10-08T13:13:24.825Z]  @firebase/firestore: Firestore (11.9.0): WebChannelConnection RPC 'Listen' stream 0x75f0303d transport errored. Name: undefined Message: undefined