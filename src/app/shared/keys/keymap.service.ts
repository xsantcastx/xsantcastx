/**
 * keymap.service.ts — the one place keys are read.
 *
 * The HUD and the engine ask "is this the Bag key?" through here instead of comparing codes themselves, so a rebound
 * key works everywhere at once. Bindings live in the sound/settings blob (SoundService, saved through the gateway):
 * a change made on one device reaches the others, and anything unreadable falls back to the defaults.
 */
import { Injectable, inject } from '@angular/core';
import { SoundService } from '../sound/sound.service';
import { actionFor, codeLabel, defaultBindings, rebind, resolveBindings, toOverrides, unbind, type Bindings, type Resolution } from './keymap.model';

@Injectable({ providedIn: 'root' })
export class KeymapService {
  private readonly sound = inject(SoundService);
  private cacheFor: unknown = null;
  private cache: Bindings = defaultBindings();

  /** The bindings now in force (resolved and validated; cached per saved value). */
  get bindings(): Bindings {
    const raw = this.sound.settings.keys;
    if (raw !== this.cacheFor) { this.cacheFor = raw; this.cache = resolveBindings(raw); }
    return this.cache;
  }
  /** The keys of an action. */
  codes(action: string): readonly string[] { return this.bindings[action] ?? []; }
  /** The action a code does, or null. */
  actionOf(code: string): string | null { return actionFor(this.bindings, code); }
  /** Does this key press do that action? (A press with Ctrl, Cmd or Alt held is the browser's, never the game's.) */
  matches(action: string, e: { code: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return this.codes(action).includes(e.code);
  }
  /** The keycap text(s) for an action ("I", "O / F2"); empty when unbound. */
  caps(action: string): string[] { return this.codes(action).map(codeLabel); }
  /** The first key's cap, for a menu row ('' when unbound). */
  cap(action: string): string { return this.caps(action)[0] ?? ''; }

  /** Rebind. A clash returns the other action's id and changes nothing, unless `how` says swap or clear. */
  set(action: string, slot: number, code: string, how?: Resolution): string | null {
    const res = rebind(this.bindings, action, slot, code, how);
    if (res.conflict) return res.conflict;
    this.commit(res.bindings);
    return null;
  }
  clear(action: string, slot: number): void { this.commit(unbind(this.bindings, action, slot)); }
  reset(): void { this.commit(defaultBindings()); }
  /** Is anything different from the defaults? */
  get changed(): boolean { return Object.keys(toOverrides(this.bindings)).length > 0; }

  private commit(next: Bindings): void { this.sound.setKeys(toOverrides(next)); }
}
