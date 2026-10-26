/**
 * character-roster.service.ts — the account's character list, through the save gateway.
 *
 * The only writer of `eclipse-characters` (character-roster.model.ts). Account-wide and synced: signed in, the gateway
 * makes Firestore the record (`users/{uid}/progress/characters`) and a cloud merge lands here through
 * LocalSaveRegistry in the same tick. What each character's save holds is the gateway's business
 * (shared/save/character-scope.ts); this list only names them and keeps a summary to draw the row.
 */
import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CHARACTER_ROSTER_KEY, profileKey } from '../save/character-scope';
import { CharacterRoster, CharacterRow, coerceRoster, emptyRoster, liveCharacters, mergeCharacterRoster } from './character-roster.model';

@Injectable({ providedIn: 'root' })
export class CharacterRosterService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly zone = inject(NgZone);
  private readonly subject = new BehaviorSubject<CharacterRoster>(emptyRoster());
  private hydrated = false;

  /** The character this page plays (fixed at boot; see GameStateGateway.character). */
  get active(): string { return this.store.character; }

  get roster(): CharacterRoster {
    this.hydrate();
    return this.subject.value;
  }
  get roster$(): Observable<CharacterRoster> {
    this.hydrate();
    return this.subject.asObservable();
  }
  /** Playable characters, oldest first. */
  get characters(): CharacterRow[] { return liveCharacters(this.roster); }

  row(id: string): CharacterRow | undefined {
    const row = this.roster.chars[id];
    return row && !row.deletedAt ? row : undefined;
  }

  /** Add or update a row (a summary refresh, a new character). Writes only when something changed. */
  put(row: CharacterRow): void {
    this.hydrate();
    const cur = this.subject.value;
    const before = cur.chars[row.id];
    if (before && JSON.stringify(before) === JSON.stringify(row)) return;
    this.save({ ...cur, chars: { ...cur.chars, [row.id]: row } });
  }

  /** Leave a tombstone for `id` (the row stays so no other device's stale copy brings it back). */
  tombstone(id: string, at = Date.now()): void {
    this.hydrate();
    const cur = this.subject.value;
    const row = cur.chars[id];
    if (!row) return;
    const stamp = Math.max(at, row.updatedAt + 1);
    this.save({ ...cur, chars: { ...cur.chars, [id]: { ...row, updatedAt: stamp, deletedAt: stamp } } });
  }

  /** Forget a row outright: only for a character that never left this page (a new one abandoned before it was made). */
  forget(id: string): void {
    this.hydrate();
    const cur = this.subject.value;
    if (!cur.chars[id]) return;
    this.save({ ...cur }, id);
  }

  /**
   * Write `next` merged over what is stored NOW, never over it. Every tab holds the whole roster in memory; writing
   * that whole copy back used to drop a row another tab had added since (a Keeper made in tab A vanished when tab B
   * refreshed a summary), and the play shell then treated the made Keeper as one on no list. The merge is the
   * cloud's own (newest row wins, level never lowers, tombstones stay), so a tab's edits still win when they are
   * newer. `forgotten` is removed after the merge: forget() is the one edit that is an absence.
   */
  private save(next: CharacterRoster, forgotten?: string): void {
    let merged = next;
    if (this.isBrowser) {
      const stored = this.store.read(CHARACTER_ROSTER_KEY);
      if (stored != null) merged = coerceRoster(mergeCharacterRoster(stored, next));
    }
    if (forgotten && merged.chars[forgotten]) {
      const chars = { ...merged.chars };
      delete chars[forgotten];
      merged = { ...merged, chars };
    }
    this.subject.next(merged);
    if (this.isBrowser) this.store.write(CHARACTER_ROSTER_KEY, merged);
  }

  /** Another tab wrote the roster: take its rows live (merged with ours, nothing written back, so no ping-pong). */
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key !== profileKey(CHARACTER_ROSTER_KEY) && event.key !== null) return;
    this.zone.run(() => this.adoptStored());
  };

  /** The stored roster merged into memory. */
  adoptStored(): void {
    if (!this.isBrowser || !this.hydrated) return;
    const stored = this.store.read(CHARACTER_ROSTER_KEY);
    if (stored == null) return;
    const merged = coerceRoster(mergeCharacterRoster(stored, this.subject.value));
    if (JSON.stringify(merged) !== JSON.stringify(this.subject.value)) this.subject.next(merged);
  }

  ngOnDestroy(): void {
    if (this.isBrowser) window.removeEventListener('storage', this.onStorage);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceRoster(this.store.read(CHARACTER_ROSTER_KEY)));
    this.saves.register(CHARACTER_ROSTER_KEY, { rehydrate: () => this.subject.next(coerceRoster(this.store.read(CHARACTER_ROSTER_KEY))) });
    window.addEventListener('storage', this.onStorage);
  }
}
