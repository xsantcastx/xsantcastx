/**
 * chapter.gateway.ts — sole writer of Infernal chapter resolution.
 *
 * C8 records one inspectable position. It does not grant items, XP,
 * standing, or Witness Runes into Inventory.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import { DEVICE_ID_KEY } from '../economy/economy-ops';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  CHAPTER_KEY,
  emptyChapterLedger,
  type ChapterLedger,
  type InfernalChapterRecord,
  type InfernalSeamChoice,
} from './chapter.model';
import { buildInfernalRecord, coerceChapterLedger } from './chapter-ops';

export type ChapterRejectCode = 'ssr' | 'clock' | 'persist';

export type ChapterResolveResult =
  | { ok: true; record: InfernalChapterRecord; replayed: boolean }
  | { ok: false; code: ChapterRejectCode };

@Injectable({ providedIn: 'root' })
export class ChapterGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private ledger = emptyChapterLedger();
  private deviceId = 'unknown';
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<ChapterLedger>(emptyChapterLedger());
  readonly snapshot$ = this.snapshot$$.asObservable();
  get snapshot(): ChapterLedger { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    this.deviceId = this.readDeviceId();
    this.ledger = this.load();
    this.publish();
    this.saves.register(CHAPTER_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        this.publish();
      },
    });
  }

  infernal(): InfernalChapterRecord | null {
    return this.ledger.infernal;
  }

  resolveInfernal(choiceId: InfernalSeamChoice, now = Date.now()): ChapterResolveResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!Number.isFinite(now)) return { ok: false, code: 'clock' };
    const existing = this.ledger.infernal;
    if (existing) return { ok: true, record: existing, replayed: true };

    const record = buildInfernalRecord({
      choiceId,
      deviceId: this.deviceId,
      previous: null,
      now,
    });
    const previous = this.ledger;
    this.ledger = { ...this.ledger, infernal: record };
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return { ok: true, record, replayed: false };
  }

  private load(): ChapterLedger {
    try {
      const raw = this.store.readRaw(CHAPTER_KEY);
      if (!raw) return emptyChapterLedger();
      return coerceChapterLedger(JSON.parse(raw)) ?? emptyChapterLedger();
    } catch {
      return emptyChapterLedger();
    }
  }

  private save(): boolean {
    const raw = JSON.stringify(this.ledger);
    this.store.write(CHAPTER_KEY, this.ledger);
    return this.store.readRaw(CHAPTER_KEY) === raw;
  }

  private publish(): void {
    this.snapshot$$.next(this.ledger);
  }

  private readDeviceId(): string {
    try {
      return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
