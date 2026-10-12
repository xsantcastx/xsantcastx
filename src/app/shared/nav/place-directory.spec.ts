import { PANEL_REGISTRY } from '../../play/world/panel-registry';
import { placeForRoute, worldPlaces } from '../world/place-for-route';
import { NAV_MANIFEST } from './nav.manifest';
import { isPlaceRoute } from './place-banner-outlet.component';
import { PLACE_DIRECTORY, placeLabelKey } from './place-directory';

describe('PLACE_DIRECTORY', () => {
  it('is exactly the registry routes that have a station in a built town', () => {
    const fromWorld = worldPlaces().map(p => p.route).sort();
    const listed = PLACE_DIRECTORY.map(p => p.route).sort();
    expect(listed).toEqual(fromWorld);
  });

  it('ids are the PanelIds whose registry route is the listed route', () => {
    for (const place of PLACE_DIRECTORY) {
      const entry = PANEL_REGISTRY[place.id as keyof typeof PANEL_REGISTRY];
      expect(entry?.route).withContext(place.id).toBe(place.route);
      expect(placeForRoute(place.route)?.panel).withContext(place.id).toBe(place.id as never);
    }
  });

  it('does not repeat a navbar destination', () => {
    const nav = new Set(NAV_MANIFEST.map(d => d.route));
    for (const place of PLACE_DIRECTORY) expect(nav.has(place.route)).withContext(place.route).toBeFalse();
  });

  it('names a place by its PanelId', () => {
    expect(placeLabelKey('market')).toBe('gfnav.market');
    expect(placeLabelKey('character')).toBeNull();
  });

  it('drives which pages reserve the banner strip', () => {
    expect(isPlaceRoute('/market')).toBeTrue();
    expect(isPlaceRoute('/forge/crafting?x=1')).toBeTrue();
    expect(isPlaceRoute('/character')).toBeFalse();
    expect(isPlaceRoute('/play')).toBeFalse();
    expect(isPlaceRoute('/world')).toBeFalse();
  });
});
