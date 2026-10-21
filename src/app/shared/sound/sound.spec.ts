import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';
import {
  QUIET_LEVELS, SOUND_KEY, channelGain, clampLevel, coerceSound, defaultSound, mergeSound, type SoundSettings,
} from './sound-settings.model';
import {
  REALM_IDS, ambienceFor, composePhrase, degreeToMidi, isNight, materialOf, paletteFor, sceneMode, soundRng, type SoundScene,
} from './sound-palette';
import { SoundService } from './sound.service';

const scene = (over: Partial<SoundScene> = {}): SoundScene => ({
  realm: 'infernal', delve: false, boss: false, hour: 12, water: false, lava: false, ink: false, glim: false, ...over,
});

describe('sound settings (godforge-sound)', () => {
  it('starts quiet on a first visit (the "reduce sound" default), not muted', () => {
    const s = defaultSound();
    expect(s.music).toBe(QUIET_LEVELS.music);
    expect(s.ambience).toBe(QUIET_LEVELS.ambience);
    expect(s.effects).toBe(QUIET_LEVELS.effects);
    for (const v of [s.music, s.ambience, s.effects]) expect(v).toBeLessThanOrEqual(.5);
    expect(s.muted).toBeFalse();
  });

  it('coerces junk to the defaults and snaps levels to the 5% grid', () => {
    expect(coerceSound(null)).toEqual(defaultSound());
    expect(coerceSound([1, 2])).toEqual(defaultSound());
    const s = coerceSound({ music: 1.7, ambience: -2, effects: .333, muted: 'yes', updatedAt: 'x' });
    expect(s).toEqual({ version: 1, music: 1, ambience: 0, effects: .35, muted: false, hush: 'full', updatedAt: 0 });
    expect(clampLevel(NaN, .4)).toBe(.4);
  });

  it('keeps the Hush cap, and an older save without one reads as the full dial', () => {
    expect(defaultSound().hush).toBe('full');
    expect(coerceSound({ music: .5 }).hush).toBe('full');
    expect(coerceSound({ hush: 'quiet' }).hush).toBe('quiet');
    expect(coerceSound({ hush: 'off' }).hush).toBe('off');
    expect(coerceSound({ hush: 'loud' }).hush).toBe('full');
  });

  it('merges two devices by the later choice, whole', () => {
    const older: SoundSettings = { ...defaultSound(), music: .9, updatedAt: 100 };
    const newer: SoundSettings = { ...defaultSound(), music: .1, muted: true, updatedAt: 200 };
    expect(mergeSound(older, newer)).toEqual(newer);
    expect(mergeSound(newer, older)).toEqual(newer);
    expect(mergeSound(null, older)).toBe(older);
    expect(mergeSound(older, null)).toBe(older);
  });

  it('is in the cloud registry with its merge', () => {
    const blob = SYNCED_BLOBS.find(b => b.key === SOUND_KEY);
    expect(blob?.doc).toBe('sound');
    expect(blob?.merge).toBe(mergeSound);
  });

  it('mute silences every channel; a level plays at its square', () => {
    const s: SoundSettings = { ...defaultSound(), music: .5 };
    expect(channelGain(s, 'music')).toBeCloseTo(.25);
    const m = { ...s, muted: true };
    for (const ch of ['music', 'ambience', 'effects'] as const) expect(channelGain(m, ch)).toBe(0);
  });
});

describe('sound palette (realm → score)', () => {
  it('gives every realm its own mode, voice and register', () => {
    const palettes = REALM_IDS.map(r => paletteFor(r));
    expect(new Set(palettes.map(p => p.scale.join(','))).size).toBeGreaterThanOrEqual(4);
    expect(new Set(palettes.map(p => p.lead)).size).toBeGreaterThanOrEqual(4);
    // Luminous is bright, Umbral low and hushed, Celestial airy, Verdant woody, Infernal warm.
    expect(paletteFor('luminous').bright).toBeGreaterThan(paletteFor('infernal').bright);
    expect(paletteFor('umbral').root).toBeLessThan(paletteFor('luminous').root);
    expect(paletteFor('umbral').rest[0]).toBeGreaterThan(paletteFor('verdant').rest[0]);
    expect(paletteFor('celestial').space).toBeGreaterThan(paletteFor('verdant').space);
    expect(paletteFor('verdant').lead).toBe('marimba');
    expect(paletteFor('infernal').lead).toBe('piano');
  });

  it('plays the Delve quieter, lower and further apart; a guardian adds a soft drone and a minor third', () => {
    for (const realm of REALM_IDS) {
      const town = paletteFor(realm), delve = paletteFor(realm, 'delve'), boss = paletteFor(realm, 'boss');
      expect(delve.level).toBeLessThan(town.level);
      expect(delve.rest[0]).toBeGreaterThan(town.rest[0]);
      expect(delve.bright).toBeLessThan(town.bright);
      expect(delve.root).toBeLessThanOrEqual(town.root);
      expect(boss.drone).toBeTrue();
      expect(town.drone).toBeFalse();
      expect(boss.scale).not.toContain(4);
      expect(boss.rest[1]).toBeLessThan(delve.rest[1]);
    }
    expect(sceneMode(scene({ delve: true }))).toBe('delve');
    expect(sceneMode(scene({ delve: true, boss: true }))).toBe('boss');
    expect(sceneMode(scene())).toBe('town');
  });

  it('composes sparse phrases inside the realm\'s scale, the same for the same seed', () => {
    for (const realm of REALM_IDS) {
      const p = paletteFor(realm);
      const a = composePhrase(p, soundRng(7)), b = composePhrase(p, soundRng(7));
      expect(a).toEqual(b);
      expect(a.notes.length).toBeGreaterThanOrEqual(p.notes[0]);
      expect(a.notes.length).toBeLessThanOrEqual(p.notes[1]);
      expect(a.rest).toBeGreaterThanOrEqual(p.rest[0]);
      for (const n of a.notes) expect(p.scale).toContain(((n.midi - p.root) % 12 + 12) % 12);
      for (let i = 1; i < a.notes.length; i++) expect(a.notes[i].at).toBeGreaterThan(a.notes[i - 1].at);
    }
    expect(degreeToMidi({ root: 60, scale: [0, 2, 4, 5, 7, 9, 11] }, 7)).toBe(72);
  });

  it('sets the ambience by realm, time and place', () => {
    const day = ambienceFor(scene({ realm: 'verdant', hour: 10 }));
    const night = ambienceFor(scene({ realm: 'verdant', hour: 23 }));
    expect(day.birds).toBeGreaterThan(0); expect(day.crickets).toBe(0);
    expect(night.birds).toBe(0); expect(night.crickets).toBeGreaterThan(0);
    expect(ambienceFor(scene({ realm: 'celestial' })).wind).toBeGreaterThan(ambienceFor(scene({ realm: 'infernal' })).wind);
    const cave = ambienceFor(scene({ delve: true }));
    expect(cave.drips).toBeGreaterThan(0); expect(cave.rumble).toBeGreaterThan(0); expect(cave.birds).toBe(0); expect(cave.murmur).toBe(0);
    const ink = ambienceFor(scene({ delve: true, realm: 'umbral', ink: true, water: true, lava: true }));
    expect(ink.ink).toBeGreaterThan(0); expect(ink.water).toBeGreaterThan(0); expect(ink.lava).toBeGreaterThan(0);
    expect(isNight(5)).toBeTrue(); expect(isNight(6)).toBeFalse();
  });

  it('hears a footstep by what is underfoot', () => {
    expect(materialOf('dirt')).toBe('earth');
    expect(materialOf('root-loam')).toBe('earth');
    expect(materialOf('timber-support')).toBe('wood');
    expect(materialOf('cinder-vein')).toBe('ore');
    expect(materialOf('inkstone-vein')).toBe('ore');
    expect(materialOf('glowcap')).toBe('crystal');
    expect(materialOf('seam-rail')).toBe('metal');
    expect(materialOf('iron-basalt')).toBe('stone');
    expect(materialOf('grotto-stone')).toBe('stone');
    expect(materialOf(undefined)).toBe('stone');
  });
});

describe('SoundService (levels through the gateway)', () => {
  let store: Map<string, string>;
  let rehydrate: (() => void) | undefined;
  let sound: SoundService;

  beforeEach(() => {
    store = new Map();
    rehydrate = undefined;
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: GameStateGateway,
          useValue: {
            read: (key: string) => { const raw = store.get(key); return raw ? JSON.parse(raw) : null; },
            write: (key: string, value: unknown) => store.set(key, JSON.stringify(value)),
          },
        },
        { provide: LocalSaveRegistry, useValue: { register: (_key: string, owner: { rehydrate: () => void }) => { rehydrate = owner.rehydrate; } } },
      ],
    });
    sound = TestBed.inject(SoundService);
  });

  it('reads the quiet defaults when nothing is saved', () => {
    expect(sound.settings).toEqual(defaultSound());
  });

  it('saves a slider and the mute through the gateway, stamped', () => {
    sound.setLevel('music', .8, 1000);
    sound.setMuted(true, 2000);
    const saved = JSON.parse(store.get(SOUND_KEY)!);
    expect(saved.music).toBe(.8);
    expect(saved.muted).toBeTrue();
    expect(saved.updatedAt).toBeGreaterThanOrEqual(2000);
    expect(sound.toggleMuted()).toBeFalse();
    expect(JSON.parse(store.get(SOUND_KEY)!).muted).toBeFalse();
  });

  it('a cloud merge lands in memory (rehydrate)', () => {
    expect(sound.settings.effects).toBe(QUIET_LEVELS.effects);
    store.set(SOUND_KEY, JSON.stringify({ ...defaultSound(), effects: .2, updatedAt: 5 }));
    rehydrate?.();
    expect(sound.settings.effects).toBe(.2);
  });

  it('waits for the first tap once armed, and drops effects before it (no context, no throw)', () => {
    expect(sound.status).toBe('idle');
    const release = sound.arm();
    expect(sound.status).toBe('waiting');
    expect(() => sound.sfx('pickup')).not.toThrow();
    sound.setScene(scene({ realm: 'luminous' }));
    expect(sound.phrases).toBe(0);
    release();
  });
});
