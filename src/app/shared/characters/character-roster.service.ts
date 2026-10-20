/**
 * character-roster.service.ts — the account's character list, through the save gateway.
 *
 * The only writer of `eclipse-characters` (character-roster.model.ts). Account-wide and synced: signed in, the gateway
 * makes Firestore the record (`users/{uid}/progress/characters`) and a cloud merge lands here through
 * LocalSaveRegistry in the same tick. What each character's save holds is the gateway's business
 * (shared/save/character-scope.ts); this list only names them and keeps a summary to draw the row.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CHARACTER_ROSTER_KEY } from '../save/character-scope';
import { CharacterRoster, CharacterRow, coerceRoster, emptyRoster, liveCharacters } from './character-roster.model';

@Injectable({ providedIn: 'root' })
export class CharacterRosterService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
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
    const chars = { ...cur.chars };
    delete chars[id];
    this.save({ ...cur, chars });
  }

  private save(next: CharacterRoster): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(CHARACTER_ROSTER_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceRoster(this.store.read(CHARACTER_ROSTER_KEY)));
    this.saves.register(CHARACTER_ROSTER_KEY, { rehydrate: () => this.subject.next(coerceRoster(this.store.read(CHARACTER_ROSTER_KEY))) });
  }
}
