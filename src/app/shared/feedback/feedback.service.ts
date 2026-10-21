/**
 * feedback.service.ts — sends a player's note to Firestore (`player-feedback`), as the signed-in player.
 *
 * Signed in only: the rules rate-limit by uid (one a minute), and an unauthenticated create cannot be limited or
 * attributed at all, so a guest is asked to sign in first. The write is one batch of two documents — the player's
 * `player-feedback-limits/{uid}` stamp and the note — because the rules accept the note only beside a stamp that is
 * at least a minute newer than the last, which is what makes the limit the server's and not a courtesy of this client.
 * Nothing is ever read back.
 */
import { Injectable, inject } from '@angular/core';
import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { FEEDBACK_COLLECTION, FEEDBACK_LIMIT_COLLECTION, buildFeedbackDoc, draftProblem, waitSecs, type FeedbackDraft } from './feedback.model';

const LAST_KEY = 'eclipse-feedback-last';

export type FeedbackResult = 'sent' | 'signin' | 'wait' | 'invalid' | 'refused' | 'failed';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly cloud = inject(CloudSaveService);
  private readonly lazy = inject(LazyFirestoreService);

  get signedIn(): boolean { return this.cloud.signedIn; }

  /** Seconds before this browser may send again (its own clock; the rules keep the real one). */
  secsLeft(now = Date.now()): number {
    try { return waitSecs(Number(localStorage.getItem(LAST_KEY)), now); } catch { return 0; }
  }

  async submit(draft: FeedbackDraft): Promise<FeedbackResult> {
    const uid = this.cloud.status.uid;
    if (!uid) return 'signin';
    if (draftProblem(draft)) return 'invalid';
    if (this.secsLeft() > 0) return 'wait';
    const fs = await this.lazy.get();
    if (!fs) return 'failed';
    const { db, api } = fs;
    try {
      const batch = api.writeBatch(db);
      batch.set(api.doc(db, FEEDBACK_LIMIT_COLLECTION, uid), { last: api.serverTimestamp() });
      batch.set(api.doc(api.collection(db, FEEDBACK_COLLECTION)), buildFeedbackDoc(uid, draft, api.serverTimestamp()));
      await batch.commit();
      try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* private mode */ }
      return 'sent';
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      return code === 'permission-denied' ? 'refused' : 'failed';
    }
  }
}
