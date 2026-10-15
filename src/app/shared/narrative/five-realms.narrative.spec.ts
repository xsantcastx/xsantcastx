import {
  FIVE_REALMS,
  OPENING_REALM_ORDER,
  isNarrativeRealmId,
  narrativeRealmById,
} from './five-realms.narrative';

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

  it('rejects unknown realm ids instead of inventing a place', () => {
    expect(isNarrativeRealmId('verge')).toBe(false);
    expect(narrativeRealmById('archivum')).toBeNull();
    expect(narrativeRealmById('nexus')).toBeNull();
  });
});
