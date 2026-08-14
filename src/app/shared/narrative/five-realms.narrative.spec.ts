import {
  FIVE_REALMS,
  OPENING_REALM_ORDER,
  isNarrativeRealmId,
  narrativeRealmById,
} from './five-realms.narrative';
import { continueFromRealm, continueFromWorld } from './continue-journey';

describe('Five-realm World foundation data', () => {
  it('names all five places with faction, landmark, hazard, resource, threat, and conflict', () => {
    expect(FIVE_REALMS.map(r => r.id)).toEqual([...OPENING_REALM_ORDER]);
    for (const realm of FIVE_REALMS) {
      expect(realm.faction).withContext(realm.id).toBeTruthy();
      expect(realm.landmark).withContext(realm.id).toBeTruthy();
      expect(realm.hazard).withContext(realm.id).toBeTruthy();
      expect(realm.resource).withContext(realm.id).toBeTruthy();
      expect(realm.threat).withContext(realm.id).toBeTruthy();
      expect(realm.conflict).withContext(realm.id).toBeTruthy();
      expect(realm.characters.length).toBe(2);
    }
  });

  it('does not publish developer-tool product copy', () => {
    const blob = JSON.stringify(FIVE_REALMS);
    expect(blob).not.toMatch(/developer tool|free tools|126 tools|CSS Tools|JSON Formatter|box-shadow/i);
  });

  it('keeps Continue Journey deterministic for new and loaded profiles', () => {
    const first = continueFromWorld();
    const again = continueFromWorld();
    expect(first.route).toBe('/world/realms/luminous');
    expect(again.route).toBe(first.route);
    expect(first.route).toBe(continueFromWorld().route);
  });

  it('walks the approved opening order without persistence', () => {
    const hops = [continueFromWorld().route];
    let id: string | 'fivefold-lock' = 'luminous';
    while (id !== 'fivefold-lock') {
      const realm = narrativeRealmById(id)!;
      const next = continueFromRealm(realm);
      hops.push(next.route);
      id = next.realmId;
    }
    expect(hops).toEqual([
      '/world/realms/luminous',
      '/world/realms/celestial',
      '/world/realms/infernal',
      '/world/realms/umbral',
      '/world/realms/verdant',
      '/world/fivefold-lock',
    ]);
  });

  it('rejects unknown realm ids instead of inventing a place', () => {
    expect(isNarrativeRealmId('verge')).toBe(false);
    expect(narrativeRealmById('archivum')).toBeNull();
    expect(narrativeRealmById('nexus')).toBeNull();
  });
});
