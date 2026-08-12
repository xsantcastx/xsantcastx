/**
 * ad-config.spec.ts — the two decisions that decide whether an ad paints.
 *
 * Both are pure functions over configuration, and both fail silently in the
 * direction that costs money or trust:
 *
 *   • `activeAdNetwork()` returning 'carbon' for a placeholder serve id ships a
 *     dead <script> to 39 tool pages and an empty box to every visitor. That is
 *     the exact bug this module was written to end, and a comment above a
 *     constant is what failed to prevent it last time.
 *   • `routeAllowsAds()` returning true for /admin or /forge-keeper puts an
 *     advertisement on the owner's own dashboard.
 *
 * Neither shows up in a build, and both are invisible in a screenshot of a page
 * that happens to be configured the other way.
 */
import {
  activeAdNetwork,
  hasLiveAdNetwork,
  carbonScriptSrc,
  routeAllowsAds,
  AD_FREE_ROUTES,
  CARBON,
} from './ad-config';

describe('ad-config', () => {
  describe('activeAdNetwork', () => {
    it('reports house while every network id is still a placeholder', () => {
      // This is the current shipped state. When the owner pastes a real Carbon
      // serve id this expectation flips to 'carbon' — and that is the moment
      // someone should be re-reading this file, so the failure is the point.
      expect(activeAdNetwork()).toBe('house');
      expect(hasLiveAdNetwork()).toBe(false);
    });

    it('still treats the CWYD42JY placeholder as not-live', () => {
      // The specific string that shipped for months looking real.
      expect(CARBON.serve).toBe('CWYD42JY');
      expect(hasLiveAdNetwork()).toBe(false);
    });
  });

  describe('carbonScriptSrc', () => {
    it('assembles both parameters from config', () => {
      const src = carbonScriptSrc();
      expect(src).toContain(`serve=${CARBON.serve}`);
      expect(src).toContain(`placement=${CARBON.placement}`);
    });
  });

  describe('routeAllowsAds', () => {
    it('allows ads on tool and content routes', () => {
      expect(routeAllowsAds('/tools')).toBe(true);
      expect(routeAllowsAds('/tools/base64-encoder')).toBe(true);
      expect(routeAllowsAds('/home')).toBe(true);
      expect(routeAllowsAds('/')).toBe(true);
    });

    it('suppresses ads on every declared ad-free route', () => {
      for (const route of AD_FREE_ROUTES) {
        expect(routeAllowsAds(route))
          .withContext(`expected no ads on ${route}`)
          .toBe(false);
      }
    });

    it('suppresses ads on child routes of an ad-free route', () => {
      expect(routeAllowsAds('/admin/dev-log')).toBe(false);
      expect(routeAllowsAds('/forge-keeper/cosmetics')).toBe(false);
    });

    it('suppresses ads when the URL carries a query or fragment', () => {
      // The LemonSqueezy redirect lands on exactly this shape, and an ad
      // flashing onto the page a buyer just paid on would be the worst possible
      // moment for one.
      expect(routeAllowsAds('/pro?purchase=success')).toBe(false);
      expect(routeAllowsAds('/admin?tab=users')).toBe(false);
      expect(routeAllowsAds('/donate#kaspa')).toBe(false);
    });

    it('does not suppress a route that merely shares a prefix', () => {
      // '/products' starts with '/pro' as a string but is a different route.
      expect(routeAllowsAds('/products')).toBe(true);
      expect(routeAllowsAds('/administrator')).toBe(true);
    });
  });
});
