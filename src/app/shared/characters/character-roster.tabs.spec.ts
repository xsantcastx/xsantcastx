/**
 * character-roster.tabs.spec.ts — two tabs, one roster: a stale tab never writes another tab's new Keeper away.
 *
 * Each tab's CharacterRosterService holds the whole list in memory. Before this, any write (a summary refresh on the
 * character list) put that whole copy back, so a Keeper just made in another tab vanished from this device's list —
 * and the play shell then treated the made Keeper as one on no list (keeper-durability.spec.ts).
 */
import { TestBed } from '@angular/core/testing';
import { CharacterRosterService } from './character-roster.service';
import { CharacterRow, coerceRoster } from './character-roster.model';
import { CHARACTER_ROSTER_KEY } from '../save/character-scope';

function row(id: string, name: string, updatedAt: number, extra: Partial<CharacterRow> = {}): CharacterRow {
  return { id, name, vocation: 'warlock', level: 1, area: '', look: null, createdAt: updatedAt, updatedAt, ...extra };
}

describe('the character roster across tabs', () => {
  let a: CharacterRosterService;
  let b: CharacterRosterService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    localStorage.setItem(CHARACTER_ROSTER_KEY, JSON.stringify({ v: 1, chars: { c1: row('c1', 'Morrow', 10) } }));
    // Two tabs on one device: two service instances, one localStorage. Both hydrate now, holding just Morrow.
    a = TestBed.runInInjectionContext(() => new CharacterRosterService());
    b = TestBed.runInInjectionContext(() => new CharacterRosterService());
    expect(a.characters.length).toBe(1);
    expect(b.characters.length).toBe(1);
  });

  afterEach(() => {
    a.ngOnDestroy();
    b.ngOnDestroy();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  const stored = () => coerceRoster(JSON.parse(localStorage.getItem(CHARACTER_ROSTER_KEY)!));

  it('tab A adds a Keeper, tab B puts an unrelated update from its stale copy, and the new Keeper survives', () => {
    a.put(row('kzyn7zit', 'Lilith', 20, { vocation: 'thornstrider' }));
    b.put({ ...row('c1', 'Morrow', 30), area: 'Ember Isle' });

    expect(stored().chars['kzyn7zit']?.vocation).toBe('thornstrider');
    expect(stored().chars['c1'].area).toBe('Ember Isle');
    expect(b.row('kzyn7zit')?.name).toBe('Lilith');
  });

  it('takes another tab\'s write live on the storage event, without writing anything back', () => {
    a.put(row('kzyn7zit', 'Lilith', 20));
    const before = localStorage.getItem(CHARACTER_ROSTER_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: CHARACTER_ROSTER_KEY }));
    expect(b.row('kzyn7zit')?.name).toBe('Lilith');
    expect(localStorage.getItem(CHARACTER_ROSTER_KEY)).toBe(before);
  });

  it('a newer edit in this tab still wins, a tombstone stays, and forget still forgets', () => {
    a.put(row('kzyn7zit', 'Lilith', 20));
    b.put(row('kzyn7zit', 'Lily', 40));
    expect(stored().chars['kzyn7zit'].name).toBe('Lily');

    a.tombstone('kzyn7zit', 50);
    b.put(row('c1', 'Morrow', 60));
    expect(stored().chars['kzyn7zit'].deletedAt).toBe(50);
    expect(b.row('kzyn7zit')).toBeUndefined();

    a.put(row('k2ghost', '', 70));
    a.forget('k2ghost');
    expect(stored().chars['k2ghost']).toBeUndefined();
  });
});
