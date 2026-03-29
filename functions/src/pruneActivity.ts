/**
 * Firestore onCreate trigger for claude-activity collection.
 * Prunes old entries when the collection exceeds MAX_ENTRIES,
 * using Firebase Admin SDK (bypasses security rules).
 *
 * This replaces the unauthenticated client-side delete that was
 * previously in the PostToolUse hook (live-hook.js).
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const MAX_ENTRIES = 200;

// Ensure admin is initialized (idempotent — safe to call multiple times)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Triggered whenever a new document is created in claude-activity.
 * Checks total doc count and deletes the oldest entries if over limit.
 */
export const pruneActivityFeed = functions.firestore
  .onDocumentCreated("claude-activity/{docId}", async (event) => {
    try {
      // Count total documents
      const snapshot = await db
        .collection("claude-activity")
        .orderBy("timestamp", "asc")
        .get();

      const totalDocs = snapshot.size;

      if (totalDocs <= MAX_ENTRIES) {
        return; // Nothing to prune
      }

      const toDelete = totalDocs - MAX_ENTRIES;
      const batch = db.batch();
      let deleted = 0;

      for (const doc of snapshot.docs) {
        if (deleted >= toDelete) break;
        batch.delete(doc.ref);
        deleted++;
      }

      await batch.commit();
      functions.logger.info(
        `Pruned ${deleted} old claude-activity entries (was ${totalDocs}, now ${totalDocs - deleted})`
      );
    } catch (error) {
      functions.logger.error("Failed to prune claude-activity:", error);
    }
  });
