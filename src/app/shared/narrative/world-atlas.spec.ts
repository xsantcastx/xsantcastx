import { FIVE_REALMS, OPENING_REALM_ORDER, realmHref } from './five-realms.narrative';
import {
  ATLAS_HOTSPOTS,
  ATLAS_SOURCE,
  atlasHotspotsInMobileOrder,
  atlasHref,
} from './world-atlas';

describe('World atlas hotspot data', () => {
  it('covers the five realms with spec anchors and descriptive labels', () => {
    expect(ATLAS_HOTSPOTS.map(spot => spot.id)).toEqual([
      'celestial',
      'luminous',
      'infernal',
      'umbral',
      'verdant',
    ]);
    expect(ATLAS_SOURCE.coordinateSystem).toBe('normalized-percent');
    expect(ATLAS_SOURCE.sourceDimensions).toEqual({ width: 1536, height: 1024 });
    expect(ATLAS_SOURCE.hitTarget).toEqual({
      desktopRadiusPercent: 12,
      minimumPointerTargetPx: 44,
    });

    const byId = Object.fromEntries(ATLAS_HOTSPOTS.map(spot => [spot.id, spot]));
    expect(byId['celestial'].anchor).toEqual({ x: 27, y: 24 });
    expect(byId['luminous'].anchor).toEqual({ x: 75, y: 24 });
    expect(byId['infernal'].anchor).toEqual({ x: 25, y: 66 });
    expect(byId['umbral'].anchor).toEqual({ x: 76, y: 65 });
    expect(byId['verdant'].anchor).toEqual({ x: 50, y: 80 });

    for (const spot of ATLAS_HOTSPOTS) {
      expect(spot.label).withContext(spot.id).toContain(
        FIVE_REALMS.find(realm => realm.id === spot.id)!.name,
      );
      expect(spot.accessibleLabel.length).withContext(spot.id).toBeGreaterThan(spot.label.length);
      expect(spot.anchor.x).toBeGreaterThanOrEqual(0);
      expect(spot.anchor.x).toBeLessThanOrEqual(100);
      expect(spot.anchor.y).toBeGreaterThanOrEqual(0);
      expect(spot.anchor.y).toBeLessThanOrEqual(100);
    }
  });

  it('orders the mobile fallback independently of opening-chapter order', () => {
    expect(atlasHotspotsInMobileOrder().map(spot => spot.label)).toEqual([
      'Celestial Realm',
      'Luminous Realm',
      'Infernal Realm',
      'Umbral Realm',
      'Verdant Realm',
    ]);
    expect(OPENING_REALM_ORDER).toEqual([
      'luminous',
      'celestial',
      'infernal',
      'umbral',
      'verdant',
    ]);
  });

  it('links only to existing dossiers and leaves the Godforge decorative', () => {
    for (const spot of ATLAS_HOTSPOTS) {
      expect(atlasHref(spot.id)).toBe(realmHref(spot.id));
      expect(atlasHref(spot.id)).toBe(`/world/realms/${spot.id}`);
    }
    expect(ATLAS_HOTSPOTS.some(spot => (spot as { id: string }).id === 'fivefold-lock')).toBeFalse();
    expect(ATLAS_SOURCE.godforgeAnchor).toEqual({ x: 50, y: 46 });
  });

  it('does not rewrite lore, routes, or narrative names', () => {
    expect(FIVE_REALMS.map(realm => realm.name)).toEqual([
      'Luminous',
      'Celestial',
      'Infernal',
      'Umbral',
      'Verdant',
    ]);
    expect(FIVE_REALMS.find(realm => realm.id === 'luminous')?.landmark).toBe('Heliograph Court');
    expect(JSON.stringify(ATLAS_HOTSPOTS)).not.toMatch(
      /developer tool|box-shadow|JSON Formatter|Unbound Pattern/i,
    );
  });
});
