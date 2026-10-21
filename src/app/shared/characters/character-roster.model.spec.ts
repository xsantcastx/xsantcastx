import {
  CharacterRow, JUNK_ROWS_BEFORE, coerceRoster, confirmsDelete, emptyRoster, hasFreeSlot, idForNewCharacter, isJunkRow, junkRowIds, liveCharacters,
  mergeCharacterRoster, needsTypedName,
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
    expect(confirmsDelete({ name: 'Wren Ashby' }, ' wren ashby ')).toBe(true);
    expect(confirmsDelete({ name: 'Wren Ashby' }, 'Wren')).toBe(false);
    expect(confirmsDelete({ name: 'Wren Ashby' }, '')).toBe(false);
    expect(needsTypedName({ name: 'Wren Ashby' })).toBe(true);
  });

  it('deletes a nameless Keeper with a plain confirm (nothing to type)', () => {
    expect(needsTypedName({ name: '' })).toBe(false);
    expect(needsTypedName({ name: '   ' })).toBe(false);
    expect(confirmsDelete({ name: '' }, '')).toBe(true);
  });
});

describe('junk rows from the old New Keeper bug', () => {
  const OLD = Date.UTC(2026, 9, 20);
  const junk = (id: string, extra: Partial<CharacterRow> = {}): CharacterRow =>
    row(id, { name: '', level: 1, area: '', createdAt: OLD, updatedAt: OLD, ...extra });
  const ctx = { active: 'c1', hasSave: () => false };

  it('prunes a nameless, level-1, placeless row this device holds nothing for', () => {
    expect(isJunkRow(junk('k2junk00'), ctx)).toBe(true);
  });

  it('never prunes character #1, whatever it holds', () => {
    expect(isJunkRow(junk(PRIMARY_CHARACTER), { ...ctx, active: 'k9other0' })).toBe(false);
  });

  it('never prunes a real Keeper: a name, any level above 1, or a place', () => {
    expect(isJunkRow(junk('k2junk00', { name: 'Bryn' }), ctx)).toBe(false);
    expect(isJunkRow(junk('k2junk00', { level: 2 }), ctx)).toBe(false);
    expect(isJunkRow(junk('k2junk00', { level: 40 }), ctx)).toBe(false);
    expect(isJunkRow(junk('k2junk00', { area: 'Ember Isle' }), ctx)).toBe(false);
  });

  it('never prunes a row this device holds a meaningful save for, nor the Keeper this page plays', () => {
    expect(isJunkRow(junk('k2junk00'), { ...ctx, hasSave: id => id === 'k2junk00' })).toBe(false);
    expect(isJunkRow(junk('k2junk00'), { ...ctx, active: 'k2junk00' })).toBe(false);
  });

  it('never prunes a nameless Keeper made after the bug was fixed (Become with an empty name is real)', () => {
    expect(isJunkRow(junk('k2junk00', { createdAt: JUNK_ROWS_BEFORE }), ctx)).toBe(false);
    expect(isJunkRow(junk('k2junk00', { createdAt: JUNK_ROWS_BEFORE + 86_400_000 }), ctx)).toBe(false);
  });

  it('lists the junk among real Keepers, only once the cloud has settled, and skips tombstones', () => {
    const roster = { v: 1 as const, chars: {
      c1: junk('c1'),
      k2aster0: row('k2aster0', { name: 'Aster', level: 7, area: 'Ember Isle' }),
      k3nameles: junk('k3nameles'),
      k4junk000: junk('k4junk000'),
      k5bryn000: row('k5bryn000', { name: 'Bryn', level: 1, area: '' }),
      k6gone000: junk('k6gone000', { deletedAt: OLD + 1 }),
    } };
    expect(junkRowIds(roster, { ...ctx, settled: false })).toEqual([]);
    expect(junkRowIds(roster, { ...ctx, settled: true }).sort()).toEqual(['k3nameles', 'k4junk000']);
  });
});
