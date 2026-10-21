import { initialLobbyMode, mayUsePrimarySlot } from './play-lobby.service';
import { areaName, hasMeaningfulSave, huntingLevelOf, summarise } from './character-summary';
import { CharacterRow } from '../../shared/characters/character-roster.model';

const base = { character: 'c1', skip: false, enter: null, make: null, signedIn: false, guest: false };

describe('where /play opens', () => {
  it('shows the title to a signed-out visitor who never chose', () => {
    expect(initialLobbyMode(base)).toBe('title');
  });
  it('opens the character list for a signed-in player or a returning offline player', () => {
    expect(initialLobbyMode({ ...base, signedIn: true })).toBe('select');
    expect(initialLobbyMode({ ...base, guest: true })).toBe('select');
  });
  it('enters the world after a switch, opens the Glass for a new character, and honours the skip flag', () => {
    expect(initialLobbyMode({ ...base, enter: 'c1', guest: true })).toBe('game');
    expect(initialLobbyMode({ ...base, enter: 'k2abc', guest: true })).toBe('select');
    expect(initialLobbyMode({ ...base, make: 'c1', signedIn: true })).toBe('create');
    expect(initialLobbyMode({ ...base, skip: true })).toBe('game');
  });
});

describe('a character row from its save', () => {
  const blobs: Record<string, Record<string, unknown>> = {
    c1: {
      'godforge-keeper-look': { made: true, name: 'Wren', vocation: 'warlock', hair: 'braid', updatedAt: 3 },
      'godforge-activity': { progress: { xpByDiscipline: { hunting: 5_000 } } },
      'eclipse-play-world-v1': { td: { continent: 'ember-isle', level: 'surface', x: 1, y: 2 } },
    },
    k2abc: { 'godforge-economy': { gold: 0 } },
  };
  const store = {
    readFor: (id: string, key: string) => blobs[id]?.[key] ?? null,
    hasLocalSave: (id: string) => !!blobs[id],
  };
  const row: CharacterRow = { id: 'c1', name: '', vocation: 'warlock', level: 1, area: '', look: null, createdAt: 0, updatedAt: 0 };

  it('names the place the Keeper last stood', () => {
    expect(areaName({ continent: 'ember-isle', level: 'surface' })).toBe('Ember Isle');
    expect(areaName({ continent: 'ember-isle', level: 'ashen-crypt-1' })).toBe('The Ashen Crypt · Floor 1');
    expect(areaName({ continent: 'nowhere', level: 'surface' })).toBe('');
    expect(areaName(null)).toBe('');
  });

  it('reads name, level, place and look, and stamps the change', () => {
    const next = summarise(store, row, 100);
    expect(next.name).toBe('Wren');
    expect(next.level).toBe(huntingLevelOf(blobs['c1']['godforge-activity']));
    expect(next.level).toBeGreaterThan(1);
    expect(next.area).toBe('Ember Isle');
    expect(next.look?.hair).toBe('braid');
    expect(next.updatedAt).toBe(100);
    expect(summarise(store, next, 200)).toBe(next);
  });

  it('keeps the cloud summary of a Keeper this device never held', () => {
    const far: CharacterRow = { ...row, id: 'k9abc', name: 'Far', level: 30 };
    expect(summarise(store, far)).toBe(far);
  });

  it('does not count a few empty first-visit ledgers as a save', () => {
    expect(hasMeaningfulSave(store, 'c1')).toBe(true);
    expect(hasMeaningfulSave(store, 'k2abc')).toBe(false);
    expect(hasMeaningfulSave(store, 'k9abc')).toBe(false);
  });
});

describe('New Keeper and character #1\'s slot', () => {
  it('hands it out on a device never bound to an account', () => {
    expect(mayUsePrimarySlot({ bound: false, signedIn: false, state: 'off', lastSyncedAt: null })).toBe(true);
  });

  it('never before the cloud has settled: still syncing, not yet synced once, or the session not back', () => {
    expect(mayUsePrimarySlot({ bound: true, signedIn: true, state: 'syncing', lastSyncedAt: null })).toBe(false);
    expect(mayUsePrimarySlot({ bound: true, signedIn: true, state: 'syncing', lastSyncedAt: 5 })).toBe(false);
    expect(mayUsePrimarySlot({ bound: true, signedIn: true, state: 'synced', lastSyncedAt: null })).toBe(false);
    expect(mayUsePrimarySlot({ bound: true, signedIn: false, state: 'off', lastSyncedAt: null })).toBe(false);
  });

  it('once the account\'s save has landed', () => {
    expect(mayUsePrimarySlot({ bound: true, signedIn: true, state: 'synced', lastSyncedAt: 5 })).toBe(true);
  });
});
