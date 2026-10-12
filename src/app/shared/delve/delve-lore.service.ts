// CONTRACT — the Delve agent's version wins on merge
/**
 * delve-lore.service.ts — which Delve inscriptions this Keeper has copied.
 *
 * Minimal stand-in for the Delve engine branch: `recordInscription(id)`,
 * `inscriptions()` and `inscription$` are the agreed surface the Archivist's
 * missions and the Codex read. Local only (not registered for cloud sync);
 * the real service owns persistence.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { DELVE_INSCRIPTIONS } from './delve-lore.model';

const KEY = 'eclipse-delve-lore';
const LIVE = new Set(DELVE_INSCRIPTIONS.map(i => i.id));

@Injectable({ providedIn: 'root' })
export class DelveLoreService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private found: ReadonlySet<string> = this.load();
  private readonly found$$ = new BehaviorSubject<ReadonlySet<string>>(this.found);

  /** Emits the whole set whenever it grows. */
  readonly inscription$: Observable<ReadonlySet<string>> = this.found$$.asObservable();

  inscriptions(): ReadonlySet<string> {
    return this.found;
  }

  /** True when this call copied a new inscription. */
  recordInscription(id: string): boolean {
    if (!this.isBrowser || !LIVE.has(id) || this.found.has(id)) return false;
    this.found = new Set([...this.found, id]);
    this.store.write(KEY, { version: 1, found: [...this.found] });
    this.found$$.next(this.found);
    return true;
  }

  private load(): ReadonlySet<string> {
    try {
      const raw = this.store.readRaw(KEY);
      const parsed = raw ? (JSON.parse(raw) as { found?: unknown }) : null;
      const ids = Array.isArray(parsed?.found) ? parsed!.found : [];
      return new Set(ids.filter((id): id is string => typeof id === 'string' && LIVE.has(id)));
    } catch {
      return new Set();
    }
  }
}
