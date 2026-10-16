/**
 * pets.service.ts — the Keeper's pets, through the save gateway.
 *
 * The only writer of `godforge-pets` (pets-save.model.ts): read once on first
 * use, written through on every change, registered with LocalSaveRegistry so a
 * cloud merge lands in memory in the same tick instead of being clobbered by a
 * stale copy. On the server it is a read-only empty state.
 *
 * Feeding spends a real satchel stack: the stack is consumed first (one
 * idempotent inventory op keyed by the meal), and only a meal that was paid
 * for fills the meter.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { PETS_KEY, cleanPetName, coercePets, emptyPets, newPetRecord, type PetRecord, type PetsState } from './pets-save.model';
import { FINDS_PER_DAY, PET_XP, findsLeft, isPetCommand, petLevel, type PetCommand, type PetXpKind } from './pet-roles';
import { HAT_AT, LOVE_MAX, TRICK_AT, dayKey, earnedPets, feedResult, hasHat, isHatched, petDef, type FeedRefusal, type PetDef, type PetLedger } from './pets.model';

export type FeedOutcome = { ok: true; gain: number; favourite: boolean; love: number; trick: boolean; hat: boolean } | { ok: false; code: FeedRefusal | 'none' };

@Injectable({ providedIn: 'root' })
export class PetsService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly inventory = inject(InventoryService);
  private current: PetsState = emptyPets();
  private hydrated = false;
  private readonly changes = new BehaviorSubject<PetsState>(this.current);
  /** Every change (the pet sheet and the play view re-read). */
  readonly state$ = this.changes.asObservable();

  get state(): Readonly<PetsState> {
    this.hydrate();
    return this.current;
  }

  record(id: string): PetRecord | undefined { return this.state.pets[id]; }

  /** Count one step towards a pet's source (a crate opened, a creature cleared, a patch harvested). */
  count(key: string, by = 1): void {
    this.hydrate();
    this.save({ ...this.current, tally: { ...this.current.tally, [key]: (this.current.tally[key] ?? 0) + by } });
  }

  /**
   * File every pet the ledgers have earned (once each, ever). A rescue comes
   * awake; an egg waits in the pet well. Returns what was found.
   */
  find(ledger: PetLedger, at = Date.now()): PetDef[] {
    this.hydrate();
    const found = earnedPets(this.current, ledger);
    if (!found.length) return found;
    const pets = { ...this.current.pets };
    for (const def of found) {
      pets[def.id] = newPetRecord(at, def.arrival === 'rescue' ? at : 0);
    }
    this.save({ ...this.current, pets });
    return found;
  }

  /** Crack an egg. True the first time; a rescue or an egg already hatched is a no-op. */
  hatch(id: string, at = Date.now()): boolean {
    this.hydrate();
    const r = this.current.pets[id];
    if (!r || isHatched(r)) return false;
    // The first pet out of its egg follows at once; a second waits for you to choose.
    const follow = !this.current.active;
    this.save({
      ...this.current,
      pets: { ...this.current.pets, [id]: { ...r, hatched: Math.max(at, r.got) } },
      ...(follow ? { active: id, activeAt: at } : {}),
    });
    return true;
  }

  /** Name (or rename) a pet. Returns the name kept ('' refused). */
  name(id: string, raw: string, at = Date.now()): string {
    this.hydrate();
    const r = this.current.pets[id];
    const name = cleanPetName(raw);
    if (!r || !isHatched(r) || !name) return '';
    this.save({ ...this.current, pets: { ...this.current.pets, [id]: { ...r, name, nameAt: at } } });
    return name;
  }

  /** Who follows: a hatched pet, or '' for none (it rests at home). */
  follow(id: string, at = Date.now()): boolean {
    this.hydrate();
    if (id && !isHatched(this.current.pets[id])) return false;
    if (id === this.current.active) return true;
    this.save({ ...this.current, active: id, activeAt: at });
    return true;
  }

  /** Put the hat on or take it off (only once love has unlocked it). */
  wearHat(id: string, on: boolean, at = Date.now(), hatbox = false): boolean {
    this.hydrate();
    const r = this.current.pets[id];
    if (!r || !hasHat(r, hatbox)) return false;
    this.save({ ...this.current, pets: { ...this.current.pets, [id]: { ...r, hat: on, hatAt: at } } });
    return true;
  }

  /**
   * Feed a pet one of `food` from the satchel. The stack is spent first (keyed
   * by the meal, so a retry never takes two); the meter fills only after.
   */
  feed(id: string, food: string, now = new Date(), extraMeals = 0): FeedOutcome {
    this.hydrate();
    const def = petDef(id);
    const r = this.current.pets[id];
    if (!def) return { ok: false, code: 'unknown' };
    const day = dayKey(now);
    const verdict = feedResult(def, r, food, day, extraMeals);
    if (!verdict.ok) return verdict;
    if (this.inventory.stackOf(food) < 1) return { ok: false, code: 'none' };
    const meals = r!.feedDay === day ? r!.feeds : 0;
    const paid = this.inventory.consumeStacks(`pet-meal:${id}:${day}:${meals + 1}`, [{ id: food, count: 1 }]);
    if (!paid.ok) return { ok: false, code: 'none' };
    const before = r!.love;
    const love = Math.min(LOVE_MAX, before + verdict.gain);
    this.save({ ...this.current, pets: { ...this.current.pets, [id]: { ...r!, love, feedDay: day, feeds: meals + 1 } } });
    return { ok: true, gain: love - before, favourite: verdict.favourite, love, trick: before < TRICK_AT && love >= TRICK_AT, hat: before < HAT_AT && love >= HAT_AT };
  }

  /** What the Keeper told the pets from the card (one command for whoever follows). */
  get command(): PetCommand {
    const c = this.state.command;
    return isPetCommand(c) ? c : 'follow';
  }
  setCommand(command: PetCommand, at = Date.now()): boolean {
    this.hydrate();
    if (!isPetCommand(command)) return false;
    if (command === this.current.command) return true;
    this.save({ ...this.current, command, commandAt: at });
    return true;
  }

  /**
   * Grow a pet by use (pet-roles.ts PET_XP): `n` uses of `kind`. Returns the
   * level it reached when this crossed into a new one, else 0.
   */
  train(id: string, kind: PetXpKind, n = 1): number {
    this.hydrate();
    const r = this.current.pets[id];
    if (!r || !isHatched(r) || n <= 0) return 0;
    const before = petLevel(r.xp);
    const xp = Math.min(100_000, r.xp + PET_XP[kind] * Math.floor(n));
    this.save({ ...this.current, pets: { ...this.current.pets, [id]: { ...r, xp } } });
    const after = petLevel(xp);
    return after > before ? after : 0;
  }

  /** A find dug up today (scout spot or trinket), within the daily cap. True if it may happen (and is counted). */
  takeFind(id: string, kind: keyof typeof FINDS_PER_DAY, now = new Date()): boolean {
    this.hydrate();
    const r = this.current.pets[id];
    if (!r || !isHatched(r)) return false;
    const day = dayKey(now);
    if (findsLeft(kind, day, r) <= 0) return false;
    const same = r.findDay === day;
    const next: PetRecord = { ...r, findDay: day, scouts: (same ? r.scouts : 0) + (kind === 'scout' ? 1 : 0), trinkets: (same ? r.trinkets : 0) + (kind === 'trinket' ? 1 : 0) };
    this.save({ ...this.current, pets: { ...this.current.pets, [id]: next } });
    return true;
  }

  private save(next: PetsState): void {
    this.current = next;
    if (this.isBrowser) this.store.write(PETS_KEY, next);
    this.changes.next(next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coercePets(this.store.read(PETS_KEY));
    this.changes.next(this.current);
    this.saves.register(PETS_KEY, {
      rehydrate: () => { this.current = coercePets(this.store.read(PETS_KEY)); this.changes.next(this.current); },
    });
  }
}
