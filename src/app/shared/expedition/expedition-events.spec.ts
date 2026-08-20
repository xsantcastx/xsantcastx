/**
 * expedition-events.spec.ts — the story an expedition tells.
 *
 * The determinism assertions are the point. A beat picked with `Math.random`
 * when a milestone is crossed depends on somebody having been watching, which
 * is exactly backwards for a mechanic whose pitch is that it resolves while the
 * tab is shut. See the note at the top of `expedition-events.model.ts`.
 */
import {
  MILESTONES,
  beatText,
  currentBeat,
  expeditionBeats,
} from './expedition-events.model';
import { REALMS } from '../realms/realm.model';

describe('beats', () => {
  it('is the same line for the same mission, every single time', () => {
    const first = beatText('umbral-scout-1700000000000-3', 'umbral', 'outer', 50);
    for (let i = 0; i < 50; i++) {
      expect(beatText('umbral-scout-1700000000000-3', 'umbral', 'outer', 50)).toBe(first);
    }
  });

  it('gives different missions different lines', () => {
    /*
     * The bug a length-based index would have: expedition ids are
     * `realm-mission-timestamp-count` and differ mostly in their tail, so
     * `id.length + milestone` would hand every mission in a realm the same four
     * lines all evening.
     */
    const lines = new Set(
      Array.from({ length: 40 }, (_, i) =>
        beatText(`umbral-scout-17000000000${i.toString().padStart(2, '0')}-${i}`, 'umbral', 'outer', 25)),
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it('speaks every realm in its own voice', () => {
    const first = REALMS.map(r => beatText('same-id', r.id, 'outer', 25));
    expect(new Set(first).size).toBe(REALMS.length);
  });

  it('speaks the deep sites in a darker one', () => {
    const shallow = beatText('same-id', 'umbral', 'outer', 50);
    const deep = beatText('same-id', 'umbral', 'deep', 50);
    expect(deep).not.toBe(shallow);
  });

  it('falls back to a real voice for a realm that is not one', () => {
    expect(beatText('id', 'not-a-realm', 'outer', 25).length).toBeGreaterThan(0);
  });

  it('writes a line at all four milestones', () => {
    for (const realm of REALMS) {
      for (const at of MILESTONES) {
        expect(beatText('id', realm.id, 'outer', at).length)
          .withContext(`${realm.name} @ ${at}`)
          .toBeGreaterThan(10);
      }
    }
  });
});

describe('expeditionBeats', () => {
  it('renders all four from the moment they leave', () => {
    // The shape of the journey has to be visible up front, or crossing 50%
    // reads as a line appearing out of nowhere rather than as an arrival.
    const beats = expeditionBeats('id', 'verge', 'outer', 0);
    expect(beats.length).toBe(4);
    expect(beats.every(b => b.text.length > 0)).toBeTrue();
    expect(beats.every(b => !b.reached)).toBeTrue();
  });

  it('flags exactly the beats the mission has passed', () => {
    expect(expeditionBeats('id', 'verge', 'outer', 0.5).map(b => b.reached))
      .toEqual([true, true, false, false]);
    expect(expeditionBeats('id', 'verge', 'outer', 1).map(b => b.reached))
      .toEqual([true, true, true, true]);
  });

  it('shows every earlier beat on a mission nobody watched', () => {
    /*
     * The whole reason the lines are derived. A tab shut at 20% and reopened at
     * 80% never ran the code that would have picked the 25% and 50% lines — and
     * it does not need to, because they were never events.
     */
    const beats = expeditionBeats('id', 'archivum', 'inner', 0.8);
    expect(beats.filter(b => b.reached).map(b => b.at)).toEqual([25, 50, 75]);
  });

  it('clamps a progress value outside 0-1 rather than going out of range', () => {
    expect(expeditionBeats('id', 'nexus', 'outer', -5).every(b => !b.reached)).toBeTrue();
    expect(expeditionBeats('id', 'nexus', 'outer', 99).every(b => b.reached)).toBeTrue();
  });
});

describe('currentBeat', () => {
  it('is null before the first milestone', () => {
    expect(currentBeat('id', 'luminous', 'outer', 0.1)).toBeNull();
  });

  it('is the most recent one crossed, not the first', () => {
    expect(currentBeat('id', 'luminous', 'outer', 0.8)?.at).toBe(75);
    expect(currentBeat('id', 'luminous', 'outer', 1)?.at).toBe(100);
  });
});
