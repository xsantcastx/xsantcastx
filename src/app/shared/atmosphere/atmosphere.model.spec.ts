/**
 * atmosphere.model.spec.ts
 *
 * The wash is invisible by design — 0.03 to 0.08 alpha — so a broken entry in
 * this table does not look broken, it looks like the page has no atmosphere at
 * all. That is the same silent-failure class as the dangling `@keyframes`
 * reference documented in CLAUDE.md, and the reason these are asserted rather
 * than eyeballed.
 */
import { REALMS } from '../realms/realm.model';
import {
  Atmosphere,
  NO_ATMOSPHERE,
  allRealmAtmospheres,
  atmosphereForAetherShare,
  atmosphereForCategory,
  atmosphereForRealm,
  atmosphereForSegment,
  tint,
} from './atmosphere.model';

/** Every slot that is set on an atmosphere, ignoring its id. */
function slots(a: Atmosphere): string[] {
  return (['center', 'top', 'bottom', 'tl', 'tr'] as const)
    .map(k => a[k])
    .filter((v): v is string => !!v);
}

/** The alpha out of an `rgba(r, g, b, a)` string. */
function alphaOf(rgba: string): number {
  const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(rgba);
  if (!m) throw new Error(`not an rgba() string: ${rgba}`);
  return parseFloat(m[1]);
}

describe('tint', () => {
  it('converts a six-digit hex to rgba', () => {
    expect(tint('#8B5CF6', 0.05)).toBe('rgba(139, 92, 246, 0.05)');
  });

  it('expands a three-digit hex', () => {
    expect(tint('#0f8', 0.5)).toBe('rgba(0, 255, 136, 0.5)');
  });

  it('accepts a hex without the leading hash', () => {
    expect(tint('C9A84C', 0.04)).toBe('rgba(201, 168, 76, 0.04)');
  });
});

describe('atmosphereForSegment', () => {
  const places = [
    'tools', 'arena', 'codex', 'market', 'blueprint', 'sponsors',
    'quests', 'live', 'skills', 'projects', 'contact',
    'donate', 'mcp', 'guestbook',
  ];

  it('gives every place-route a wash', () => {
    for (const p of places) {
      const a = atmosphereForSegment(p);
      expect(a).withContext(`/${p} has no atmosphere`).toBeTruthy();
      expect(slots(a!).length).withContext(`/${p} has no lit slots`).toBeGreaterThan(0);
    }
  });

  it('leaves /home alone — its art is the atmosphere', () => {
    expect(atmosphereForSegment('home')).toBeNull();
  });

  it('returns null for a route with no entry', () => {
    expect(atmosphereForSegment('admin')).toBeNull();
    expect(atmosphereForSegment('')).toBeNull();
    expect(atmosphereForSegment('not-a-route')).toBeNull();
  });

  it('has no entry for the routes that only ever redirect', () => {
    // /games 301s to /arena and the service resolves on urlAfterRedirects, so an
    // entry here would be dead code that looks like coverage.
    expect(atmosphereForSegment('games')).toBeNull();
  });

  it('keeps every wash inside the subtle band', () => {
    // Above ~0.1 the wash stops being atmosphere and starts being a panel it
    // would compete with. 0.08 is the ceiling the design brief set.
    for (const p of places) {
      for (const value of slots(atmosphereForSegment(p)!)) {
        expect(alphaOf(value))
          .withContext(`/${p} slot ${value} is too strong`)
          .toBeLessThanOrEqual(0.08);
        expect(alphaOf(value))
          .withContext(`/${p} slot ${value} is too faint to see at all`)
          .toBeGreaterThanOrEqual(0.02);
      }
    }
  });

  it('gives each place a distinguishable identity', () => {
    const ids = places.map(p => atmosphereForSegment(p)!.id);
    expect(new Set(ids).size).toBe(places.length);
  });
});

describe('atmosphereForRealm', () => {
  it('derives the wash from the realm hex rather than a second table', () => {
    const luminous = REALMS.find(r => r.id === 'luminous')!;
    expect(atmosphereForRealm(luminous).center).toBe(tint(luminous.color, 0.06));
  });

  it('produces a lit wash for all five realms', () => {
    const all = allRealmAtmospheres();
    expect(all.length).toBe(REALMS.length);
    for (const a of all) expect(slots(a).length).toBeGreaterThan(0);
  });

  it('gives each realm its own id', () => {
    const ids = allRealmAtmospheres().map(a => a.id);
    expect(new Set(ids).size).toBe(REALMS.length);
  });
});

describe('atmosphereForCategory', () => {
  it('maps a known category onto its realm', () => {
    const verge = REALMS.find(r => r.id === 'verge')!;
    expect(atmosphereForCategory('Code Converters').id).toBe(`realm-${verge.id}`);
  });

  it('falls back to the archive for an unmapped category, never to nothing', () => {
    const a = atmosphereForCategory('Category That Does Not Exist');
    expect(a.id).toBe('realm-archivum');
    expect(slots(a).length).toBeGreaterThan(0);
  });
});

describe('atmosphereForAetherShare', () => {
  it('claims a Luminous-leaning visitor for Solari above 55%', () => {
    expect(atmosphereForAetherShare(0.8).id).toBe('keeper-solari');
  });

  it('claims an Umbral-leaning visitor for Nocturne below 45%', () => {
    expect(atmosphereForAetherShare(0.2).id).toBe('keeper-nocturne');
  });

  it('leaves the 45-55 band Convergent — claimed by neither', () => {
    expect(atmosphereForAetherShare(0.5).id).toBe('keeper-convergent');
    expect(atmosphereForAetherShare(0.45).id).toBe('keeper-convergent');
    expect(atmosphereForAetherShare(0.55).id).toBe('keeper-convergent');
  });

  it('matches the thresholds the identity card on the page already uses', () => {
    // forge-keeper.component.ts switches its realm colour at aetherPercent > 55,
    // so 0.56 must be Solari and 0.55 must not be.
    expect(atmosphereForAetherShare(0.56).id).toBe('keeper-solari');
    expect(atmosphereForAetherShare(0.44).id).toBe('keeper-nocturne');
  });

  it('never leaves the Keeper with an unlit page', () => {
    for (const share of [0, 0.25, 0.5, 0.75, 1]) {
      expect(slots(atmosphereForAetherShare(share)).length).toBeGreaterThan(0);
    }
  });
});

describe('NO_ATMOSPHERE', () => {
  it('lights nothing, so an unlisted route paints what it always painted', () => {
    expect(slots(NO_ATMOSPHERE).length).toBe(0);
  });
});
