import {
  CharacterRow, coerceRoster, confirmsDelete, emptyRoster, hasFreeSlot, idForNewCharacter, liveCharacters, mergeCharacterRoster,
} from './character-roster.model';
import { MAX_CHARACTERS, PRIMARY_CHARACTER } from '../save/character-scope';

function row(id: string, extra: Partial<CharacterRow> = {}): CharacterRow {
  return { id, name: id.toUpperCase(), vocation: 'warlock', level: 1, area: '', look: null, createdAt: 1, updatedAt: 1, ...extra };
}

describe('character roster', () => {
  it('drops junk rows and ids', () => {
    const r = coerceRoster({ v: 1, chars: { c1: row('c1'), '../x': row('x'), k2abc: 'nope', k3abc: { name: 7, level: -4 } } });
    expect(Object.keys(r.chars).sort()).toEqual(['c1', 'k3abc']);
    expect(r.chars['k3abc'].level).toBe(1);
    expect(coerceRoster(null)).toEqual(emptyRoster());
  });

  it('merges two devices without losing a character, newer row winning', () => {
    const phone = { v: 1, chars: { c1: row('c1', { level: 9, updatedAt: 50 }), k2abc: row('k2abc') } };
    const pc = { v: 1, chars: { c1: row('c1', { level: 4, updatedAt: 20 }), k3abc: row('k3abc') } };
    const merged = coerceRoster(mergeCharacterRoster(phone, pc));
    expect(Object.keys(merged.chars).sort()).toEqual(['c1', 'k2abc', 'k3abc']);
    expect(merged.chars['c1'].level).toBe(9);
    expect(mergeCharacterRoster(null, pc)).toBe(pc);
  });

  it('keeps a deleted character deleted against an older copy, and lists only the living, oldest first', () => {
    const deleted = { v: 1, chars: { k2abc: row('k2abc', { updatedAt: 90, deletedAt: 90 }) } };
    const stale = { v: 1, chars: { k2abc: row('k2abc', { updatedAt: 40, level: 30 }), c1: row('c1', { createdAt: 0 }), k4abc: row('k4abc', { createdAt: 5 }) } };
    const merged = coerceRoster(mergeCharacterRoster(stale, deleted));
    expect(merged.chars['k2abc'].deletedAt).toBe(90);
    expect(liveCharacters(merged).map(r => r.id)).toEqual(['c1', 'k4abc']);
  });

  it('caps the slots at five', () => {
    const chars: Record<string, CharacterRow> = {};
    for (let i = 0; i < MAX_CHARACTERS; i++) chars[`k${i}abc`] = row(`k${i}abc`);
    expect(hasFreeSlot({ v: 1, chars })).toBe(false);
    chars['k0abc'] = { ...chars['k0abc'], deletedAt: 9 };
    expect(hasFreeSlot({ v: 1, chars })).toBe(true);
  });

  it('gives the first Keeper on a fresh account character #1, and never reuses a used #1', () => {
    expect(idForNewCharacter(emptyRoster(), false, 'kfresh')).toBe(PRIMARY_CHARACTER);
    expect(idForNewCharacter(emptyRoster(), true, 'kfresh')).toBe('kfresh');
    expect(idForNewCharacter({ v: 1, chars: { c1: row('c1', { deletedAt: 3 }) } }, false, 'kfresh')).toBe('kfresh');
  });

  it('confirms a delete only with the typed name', () => {
    expect(confirmsDelete({ name: 'Wren Ashby' }, ' wren ashby ', 'Unnamed')).toBe(true);
    expect(confirmsDelete({ name: 'Wren Ashby' }, 'Wren', 'Unnamed')).toBe(false);
    expect(confirmsDelete({ name: '' }, 'unnamed', 'Unnamed')).toBe(true);
    expect(confirmsDelete({ name: '' }, '', '')).toBe(false);
  });
});
