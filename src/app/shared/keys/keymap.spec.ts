import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SOUND_KEY, coerceSound } from '../sound/sound-settings.model';
import { KEY_ACTIONS, actionFor, cleanOverrides, codeLabel, defaultBindings, rebind, resolveBindings, toOverrides, unbind } from './keymap.model';
import { KeymapService } from './keymap.service';

describe('keymap model', () => {
  it('has defaults with no key on two actions, and the old keys are kept', () => {
    const b = defaultBindings();
    const seen = new Map<string, string>();
    for (const [id, codes] of Object.entries(b)) for (const c of codes) {
      expect(seen.get(c)).withContext(`${c} on ${id} and ${seen.get(c)}`).toBeUndefined();
      seen.set(c, id);
    }
    expect(b['bag']).toEqual(['KeyI']);
    expect(b['spellbook']).toEqual(['KeyK']);
    expect(b['sheet']).toEqual(['KeyC']);
    expect(b['bestiary']).toEqual(['KeyB']);
    expect(b['map']).toEqual(['KeyM']);
    expect(b['potionHealth']).toEqual(['KeyQ']);
    expect(b['potionMana']).toEqual(['KeyR']);
    expect(b['stone']).toEqual(['KeyF']);
    expect(b['attack']).toEqual(['KeyJ', 'Space']);
    expect(b['interact']).toEqual(['KeyE']);
    expect(b['skill1']).toEqual(['Digit1']);
    expect(b['skill8']).toEqual(['Digit8']);
    expect(b['up']).toEqual(['KeyW', 'ArrowUp']);
  });

  it('never lets Escape be an action or a binding', () => {
    expect(KEY_ACTIONS.some(a => a.codes.includes('Escape'))).toBeFalse();
    expect(rebind(defaultBindings(), 'bag', 0, 'Escape').bindings).toEqual(defaultBindings());
  });

  it('rebinds a key, and the old key no longer does it', () => {
    const { bindings, conflict } = rebind(defaultBindings(), 'spellbook', 0, 'KeyU');
    expect(conflict).toBeNull();
    expect(bindings['spellbook']).toEqual(['KeyU']);
    expect(actionFor(bindings, 'KeyU')).toBe('spellbook');
    expect(actionFor(bindings, 'KeyK')).toBeNull();
  });

  it('reports a clash and changes nothing until it is resolved', () => {
    const base = defaultBindings();
    const res = rebind(base, 'spellbook', 0, 'KeyI');
    expect(res.conflict).toBe('bag');
    expect(res.bindings).toBe(base);
  });

  it('swaps: the other action takes the key this slot held', () => {
    const { bindings } = rebind(defaultBindings(), 'spellbook', 0, 'KeyI', 'swap');
    expect(bindings['spellbook']).toEqual(['KeyI']);
    expect(bindings['bag']).toEqual(['KeyK']);
  });

  it('clears: the other action loses the key', () => {
    const { bindings } = rebind(defaultBindings(), 'spellbook', 0, 'KeyI', 'clear');
    expect(bindings['spellbook']).toEqual(['KeyI']);
    expect(bindings['bag']).toEqual([]);
  });

  it('holds at most two keys per action, and a key can be added and removed', () => {
    let b = rebind(defaultBindings(), 'bag', 1, 'KeyU').bindings;
    expect(b['bag']).toEqual(['KeyI', 'KeyU']);
    b = rebind(b, 'bag', 2, 'KeyN').bindings;
    expect(b['bag'].length).toBe(2);
    b = unbind(b, 'bag', 0);
    expect(b['bag'].length).toBe(1);
  });

  it('saves only what changed, and reads it back', () => {
    expect(toOverrides(defaultBindings())).toEqual({});
    const changed = rebind(defaultBindings(), 'lore', 0, 'KeyN').bindings;
    const sparse = toOverrides(changed);
    expect(Object.keys(sparse)).toEqual(['lore']);
    expect(resolveBindings(sparse)).toEqual(changed);
  });

  it('falls back to the defaults for junk', () => {
    expect(resolveBindings(null)).toEqual(defaultBindings());
    expect(resolveBindings('x')).toEqual(defaultBindings());
    expect(resolveBindings([1, 2])).toEqual(defaultBindings());
    // unknown actions, non-arrays, bad codes, Escape, too many keys: each ignored on its own
    const junk = resolveBindings({ nope: ['KeyU'], bag: 'KeyU', lore: ['Escape'], map: ['<b>'], sheet: ['KeyA', 'KeyB', 'KeyC'], friends: [7] });
    expect(junk).toEqual(defaultBindings());
    // a clash between two actions drops the lot
    expect(resolveBindings({ bag: ['KeyK'] })).toEqual(defaultBindings());
    expect(cleanOverrides({ bag: ['KeyU', 'KeyU'] })).toEqual({ bag: ['KeyU'] });
  });

  it('labels keycaps', () => {
    expect(codeLabel('KeyI')).toBe('I');
    expect(codeLabel('Digit3')).toBe('3');
    expect(codeLabel('ArrowUp')).toBe('↑');
    expect(codeLabel('F2')).toBe('F2');
    expect(codeLabel('Space')).toBe('Space');
  });
});

describe('KeymapService (bindings through the settings blob)', () => {
  let store: Map<string, string>;
  let rehydrate: (() => void) | undefined;
  let keys: KeymapService;

  beforeEach(() => {
    store = new Map();
    rehydrate = undefined;
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GameStateGateway, useValue: {
          read: (key: string) => { const raw = store.get(key); return raw ? JSON.parse(raw) : null; },
          write: (key: string, value: unknown) => store.set(key, JSON.stringify(value)),
        } },
        { provide: LocalSaveRegistry, useValue: { register: (_k: string, owner: { rehydrate: () => void }) => { rehydrate = owner.rehydrate; } } },
      ],
    });
    keys = TestBed.inject(KeymapService);
  });

  it('starts on the defaults and matches a press by its code', () => {
    expect(keys.changed).toBeFalse();
    expect(keys.matches('bag', { code: 'KeyI' })).toBeTrue();
    expect(keys.matches('bag', { code: 'KeyI', ctrlKey: true })).toBeFalse();
    expect(keys.cap('options')).toBe('O');
    expect(keys.caps('options')).toEqual(['O', 'F2']);
  });

  it('rebinds, saves through the gateway, and survives a round trip', () => {
    expect(keys.set('spellbook', 0, 'KeyU')).toBeNull();
    expect(keys.matches('spellbook', { code: 'KeyU' })).toBeTrue();
    expect(keys.matches('spellbook', { code: 'KeyK' })).toBeFalse();
    const saved = JSON.parse(store.get(SOUND_KEY)!);
    expect(saved.keys).toEqual({ spellbook: ['KeyU'] });
    // another device: the same blob, read fresh
    expect(resolveBindings(coerceSound(saved).keys)['spellbook']).toEqual(['KeyU']);
    rehydrate?.();
    expect(keys.changed).toBeTrue();
  });

  it('reports a clash and resolves it on request', () => {
    expect(keys.set('spellbook', 0, 'KeyI')).toBe('bag');
    expect(keys.matches('bag', { code: 'KeyI' })).toBeTrue();
    expect(keys.set('spellbook', 0, 'KeyI', 'swap')).toBeNull();
    expect(keys.matches('spellbook', { code: 'KeyI' })).toBeTrue();
    expect(keys.matches('bag', { code: 'KeyK' })).toBeTrue();
  });

  it('resets to the defaults', () => {
    keys.set('lore', 0, 'KeyN');
    keys.reset();
    expect(keys.changed).toBeFalse();
    expect(keys.matches('lore', { code: 'KeyL' })).toBeTrue();
    expect(JSON.parse(store.get(SOUND_KEY)!).keys).toEqual({});
  });

  it('reads junk in the saved blob as the defaults', () => {
    store.set(SOUND_KEY, JSON.stringify({ version: 1, keys: { bag: ['KeyK'], x: 3 } }));
    const fresh = TestBed.inject(KeymapService);
    expect(fresh.matches('bag', { code: 'KeyI' })).toBeTrue();
  });
});
