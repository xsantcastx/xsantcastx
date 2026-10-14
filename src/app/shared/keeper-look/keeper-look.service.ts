/**
 * keeper-look.service.ts — the Keeper's chosen look, through the save gateway.
 *
 * The only writer of `godforge-keeper-look` (keeper-look.model.ts): read once on
 * first use, written through on every change, registered with LocalSaveRegistry
 * so a cloud merge lands in memory in the same tick. Signed in, the gateway
 * makes Firestore the record (progress/keeper-look); signed out, local only.
 * On the server it is a read-only default.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { KEEPER_LOOK_KEY, KeeperLook, cleanName, coerceLook, defaultLook } from './keeper-look.model';

@Injectable({ providedIn: 'root' })
export class KeeperLookService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly subject = new BehaviorSubject<KeeperLook>(defaultLook());
  private hydrated = false;

  get look(): KeeperLook {
    this.hydrate();
    return this.subject.value;
  }
  get look$(): Observable<KeeperLook> {
    this.hydrate();
    return this.subject.asObservable();
  }

  /** Keep a look chosen at the Glass (marks it made). */
  choose(look: KeeperLook, at = Date.now()): void {
    this.hydrate();
    this.save({ ...coerceLook(look), name: cleanName(look.name), made: true, prompted: true, updatedAt: Math.max(at, this.subject.value.updatedAt + 1) });
  }

  /** The one gentle nudge was shown (existing saves); never again. */
  markPrompted(at = Date.now()): void {
    this.hydrate();
    if (this.subject.value.prompted) return;
    this.save({ ...this.subject.value, prompted: true, updatedAt: Math.max(at, this.subject.value.updatedAt + 1) });
  }

  private save(next: KeeperLook): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(KEEPER_LOOK_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceLook(this.store.read(KEEPER_LOOK_KEY)));
    this.saves.register(KEEPER_LOOK_KEY, { rehydrate: () => this.subject.next(coerceLook(this.store.read(KEEPER_LOOK_KEY))) });
  }
}
