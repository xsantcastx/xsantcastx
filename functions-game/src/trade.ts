/**
 * trade.ts — the Cloud Functions half of Phase 6 (docs/design/online.md §3.8 and §4c): `tradeApi` and `groundSweep`.
 *
 * Everything that moves an item or Gold between saves is in trade-core.ts (pure, tested with node --test); this file
 * only connects it to firebase-admin: an ID-token check, the ban check, and a `Db` whose transactions are Firestore's.
 *
 *   POST https://us-central1-xsantcastx-1694b.cloudfunctions.net/tradeApi/{execute|cancel|drop|pickup}
 *        Authorization: Bearer <Firebase ID token>      (the URL is already in firebase.json's connect-src)
 *   groundSweep: every 5 minutes, every ground item past its time goes home to its dropper.
 *
 * Guests (anonymous accounts) and banned accounts are refused. Writes go through the Admin SDK, so firestore.rules'
 * "no client writes" on trades / ground / audit does not apply here — and applies to everybody else.
 */
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { handle, returnExpired, type Db, type Doc, type Tx } from "./trade-core.js";

if (!admin.apps.length) admin.initializeApp();

/** The site's four origins (the same list the Hearth keeps in SOCIAL_ORIGINS). */
const ORIGINS = [
  "https://xsantcastx.com",
  "https://www.xsantcastx.com",
  "https://xsantcastx-1694b.web.app",
  "https://xsantcastx-1694b.firebaseapp.com",
];

/** Firestore through the Admin SDK, as trade-core's `Db`. */
function firestoreDb(): Db {
  const fs = admin.firestore();
  return {
    run: fn => fs.runTransaction(async t => {
      const tx: Tx = {
        async get(path) { const snap = await t.get(fs.doc(path)); return snap.exists ? (snap.data() as Doc) : null; },
        set(path, data) { t.set(fs.doc(path), data); },
        delete(path) { t.delete(fs.doc(path)); },
      };
      return fn(tx);
    }),
    async expiredGround(now, limit) {
      const snap = await fs.collection("ground-items").where("expiresAt", "<=", now).limit(limit).get();
      return snap.docs.map(d => d.id);
    },
  };
}

/** Per-instance, per-account: a burst of requests is refused before it costs a transaction (the store keeps the real limits). */
const recent = new Map<string, number[]>();
function tooFast(uid: string, now: number): boolean {
  const hits = (recent.get(uid) ?? []).filter(t => now - t < 10_000);
  hits.push(now);
  recent.set(uid, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 20;
}

export const tradeApi = onRequest({ cors: ORIGINS, maxInstances: 10, memory: "256MiB", timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
  const verb = String(req.path || "").replace(/^\/+/, "").split("/")[0];
  const token = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1];
  if (!token) { res.status(401).json({ error: "Sign in to trade." }); return; }
  let uid: string;
  try {
    const who = await admin.auth().verifyIdToken(token);
    if (who.firebase?.sign_in_provider === "anonymous") { res.status(403).json({ error: "Guests cannot trade. Sign in first." }); return; }
    uid = who.uid;
  } catch {
    res.status(401).json({ error: "Sign in again." }); return;
  }
  const now = Date.now();
  if (tooFast(uid, now)) { res.status(429).json({ error: "Please slow down." }); return; }
  try {
    const ban = await admin.firestore().doc(`users/${uid}/meta/ban`).get();
    if (ban.exists && ban.data()?.banned === true) { res.status(403).json({ error: "This account cannot trade." }); return; }
    const out = await handle(firestoreDb(), verb, uid, req.body, now);
    res.status(out.status).json(out.body);
  } catch (e) {
    logger.error("tradeApi failed", { verb, uid, error: (e as Error)?.message });
    res.status(503).json({ error: "The trade could not be completed. Nothing moved; try again." });
  }
});

export const groundSweep = onSchedule({ schedule: "every 5 minutes", maxInstances: 1, timeoutSeconds: 120 }, async () => {
  const n = await returnExpired(firestoreDb(), Date.now());
  if (n) logger.info(`groundSweep returned ${n} item(s) to their droppers`);
});
