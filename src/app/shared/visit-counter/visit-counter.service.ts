import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, runTransaction } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface MilestoneEvent {
  count: number;
  milestone: number;
  label: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';
}

const MILESTONES = [
  { at: 10,     label: 'First Wave',        tier: 'bronze' as const },
  { at: 50,     label: 'Rising Signal',      tier: 'bronze' as const },
  { at: 100,    label: 'Triple Digits',      tier: 'silver' as const },
  { at: 250,    label: 'Quarter K',          tier: 'silver' as const },
  { at: 500,    label: 'Half K',             tier: 'gold' as const },
  { at: 1000,   label: 'Kilo Visitor',       tier: 'gold' as const },
  { at: 2500,   label: 'Cyber Swarm',        tier: 'gold' as const },
  { at: 5000,   label: 'Neon Legion',        tier: 'diamond' as const },
  { at: 10000,  label: 'Decawave',           tier: 'diamond' as const },
  { at: 25000,  label: 'Quantum Surge',      tier: 'legendary' as const },
  { at: 50000,  label: 'Singularity',        tier: 'legendary' as const },
  { at: 100000, label: 'Transcendence',      tier: 'legendary' as const },
];

@Injectable({ providedIn: 'root' })
export class VisitCounterService {
  private firestore = inject(Firestore);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  milestone$ = new BehaviorSubject<MilestoneEvent | null>(null);
  visitCount$ = new BehaviorSubject<number>(0);

  async recordVisit(): Promise<void> {
    if (!this.isBrowser) return;

    // Only count once per session
    if (sessionStorage.getItem('visit-counted')) {
      return;
    }

    try {
      const ref = doc(this.firestore, 'site-stats', 'visits');
      const newCount = await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? (snap.data()['count'] ?? 0) : 0;
        const next = current + 1;
        tx.set(ref, { count: next, lastVisit: new Date().toISOString() }, { merge: true });
        return next;
      });

      sessionStorage.setItem('visit-counted', '1');
      this.visitCount$.next(newCount);

      // Check for milestone
      const hit = MILESTONES.find(m => m.at === newCount);
      if (hit) {
        this.milestone$.next({
          count: newCount,
          milestone: hit.at,
          label: hit.label,
          tier: hit.tier,
        });
      }
    } catch (err: any) {
      // Permission-denied means firestore.rules haven't been deployed yet
      // (common in dev). That's expected and shouldn't paint the console red.
      // Any other error is genuinely unexpected and worth surfacing as a warn.
      const code = err?.code || err?.message || '';
      if (typeof code === 'string' && code.indexOf('permission-denied') >= 0) {
        // Silent degrade — counter just doesn't increment this session.
        return;
      }
      console.warn('[VisitCounter] degraded:', err);
    }
  }
}
