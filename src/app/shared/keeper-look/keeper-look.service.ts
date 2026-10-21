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
import { KEEPER_LOOK_KEY, KeeperLook, cleanName, coerceLook, defaultLook, pointsLeft, type Attribute, type KeeperSkillTree } from './keeper-look.model';

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

  /**
   * What the next Glass opens on, without saving anything: the character list's summary of a Keeper whose look never
   * reached this device or the cloud (play-shell's recovery Glass). Held in memory only — a stored, unmade look would
   * merge over the real one on a device that still has it. {@link takeDraft} hands it to the Glass once.
   */
  private seed: KeeperLook | null = null;
  prefill(look: KeeperLook | null): void { this.seed = look ? coerceLook(look) : null; }
  takeDraft(): KeeperLook | null { const seed = this.seed; this.seed = null; return seed; }

  /** Keep a look chosen at the Glass (marks it made). */
  choose(look: KeeperLook, at = Date.now()): void {
    this.hydrate();
    this.save({ ...coerceLook(look), name: cleanName(look.name), made: true, prompted: true, updatedAt: Math.max(at, this.subject.value.updatedAt + 1) });
  }

  /** The Spellbook's choices: which skills sit on keys 1–4, which aura runs. */
  setLoadout(bar: readonly string[], aura: string, at = Date.now()): void {
    this.hydrate();
    this.save(coerceLook({ ...this.subject.value, bar: [...bar], aura, updatedAt: Math.max(at, this.subject.value.updatedAt + 1) }));
  }

  /** The skill trees after a rank was bought or the trees were reset (the rules live in play/td/td-tree). */
  setTree(tree: KeeperSkillTree, at = Date.now()): void {
    this.hydrate();
    const cur = this.subject.value, stamp = Math.max(at, cur.updatedAt + 1, cur.tree.at + 1);
    this.save(coerceLook({ ...cur, tree: { ...tree, at: stamp }, updatedAt: stamp }));
  }

  /** Spend one of the level's points on an attribute (refused when none is left). */
  spendPoint(attr: Attribute, level: number, at = Date.now(), earned?: number): boolean {
    this.hydrate();
    const cur = this.subject.value;
    if (pointsLeft(level, cur.stats, earned) <= 0) return false;
    this.save(coerceLook({ ...cur, stats: { ...cur.stats, [attr]: cur.stats[attr] + 1 }, updatedAt: Math.max(at, cur.updatedAt + 1) }));
    return true;
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
