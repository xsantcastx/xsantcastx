import {
  GOVERNOR,
  PALETTES,
  QUALITY_TIERS,
  demote,
  hexToRgb,
  paletteForPath,
  startingTier,
  tierVertexCount,
} from './forge-scene.model';

describe('forge scene model', () => {
  describe('quality tiers', () => {
    it('every tier draws no more than its own budget', () => {
      // The whole point of `budget` is that it is a total, wisp trail segments
      // included. A layer that quietly grows past it is the regression this
      // exists to catch.
      for (const tier of Object.values(QUALITY_TIERS)) {
        expect(tierVertexCount(tier)).toBeLessThanOrEqual(tier.budget);
      }
    });

    it('holds the stated mobile and desktop caps', () => {
      expect(QUALITY_TIERS.high.budget).toBe(500);
      expect(QUALITY_TIERS.medium.budget).toBe(200);
    });

    it('never draws more on a lower tier', () => {
      expect(tierVertexCount(QUALITY_TIERS.high)).toBeGreaterThan(tierVertexCount(QUALITY_TIERS.medium));
      expect(tierVertexCount(QUALITY_TIERS.medium)).toBeGreaterThan(tierVertexCount(QUALITY_TIERS.low));
      expect(QUALITY_TIERS.high.maxPixelRatio).toBeGreaterThan(QUALITY_TIERS.low.maxPixelRatio);
    });
  });

  describe('startingTier', () => {
    it('never starts a phone on the desktop tier', () => {
      expect(startingTier({ coarsePointer: true, viewportWidth: 390 })).toBe('medium');
      expect(startingTier({ coarsePointer: false, viewportWidth: 420 })).toBe('medium');
    });

    it('starts a real desktop high', () => {
      expect(startingTier({
        coarsePointer: false, viewportWidth: 1440,
        deviceMemoryGb: 8, hardwareConcurrency: 8,
      })).toBe('high');
    });

    it('demotes a desktop that is only nominally one', () => {
      expect(startingTier({ coarsePointer: false, viewportWidth: 1440, hardwareConcurrency: 2 })).toBe('medium');
      expect(startingTier({ coarsePointer: false, viewportWidth: 1440, deviceMemoryGb: 2 })).toBe('medium');
    });

    it('assumes the best when the browser will not say', () => {
      // deviceMemory and hardwareConcurrency are absent on Safari. Treating
      // that silence as a weak machine would put every Mac on medium.
      expect(startingTier({ coarsePointer: false, viewportWidth: 1600 })).toBe('high');
    });
  });

  describe('demote', () => {
    it('walks down one rung and then stops', () => {
      expect(demote('high')).toBe('medium');
      expect(demote('medium')).toBe('low');
      expect(demote('low')).toBeNull();
    });
  });

  describe('the governor', () => {
    it('needs more than one bad second to act', () => {
      // A single stuttering second is a route change or a texture upload. Acting
      // on one would cost a quality step on every navigation.
      expect(GOVERNOR.strikes).toBeGreaterThan(1);
      expect(GOVERNOR.minFps).toBe(20);
    });
  });

  describe('paletteForPath', () => {
    it('gives each realm chapter its own colours', () => {
      expect(paletteForPath('/world/realms/umbral')).toBe('umbral');
      expect(paletteForPath('/world/realms/infernal')).toBe('infernal');
      expect(paletteForPath('/world/realms/verdant/rootglass-canopy')).toBe('verdant');
    });

    it('ignores query strings and fragments', () => {
      expect(paletteForPath('/world/realms/celestial?inspect=rune:void')).toBe('celestial');
      expect(paletteForPath('/world/realms/luminous#top')).toBe('luminous');
    });

    it('burns forge orange everywhere else', () => {
      for (const path of ['/world', '/market', '/character', '/forge/runes', '/codex', '/']) {
        expect(paletteForPath(path)).toBe('forge');
      }
    });

    it('does not let an unknown realm segment invent a palette', () => {
      expect(paletteForPath('/world/realms/atlantis')).toBe('forge');
      // 'forge' is the default, not a realm: a URL must not be able to select it
      // by name and imply a sixth realm exists.
      expect(paletteForPath('/world/realms/forge')).toBe('forge');
    });
  });

  describe('palettes', () => {
    it('gives every palette three usable colours', () => {
      for (const [id, colors] of Object.entries(PALETTES)) {
        for (const slot of [colors.hot, colors.cool, colors.fog]) {
          expect(slot).withContext(id).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    });

    it('agrees with the realm accents the badges already use', () => {
      expect(PALETTES.umbral.cool.toLowerCase()).toBe('#a855f7');
      expect(PALETTES.celestial.cool.toLowerCase()).toBe('#00d4ff');
      expect(PALETTES.verdant.cool.toLowerCase()).toBe('#10b981');
      expect(PALETTES.infernal.cool.toLowerCase()).toBe('#ef4444');
      expect(PALETTES.luminous.cool.toLowerCase()).toBe('#e8d44d');
    });
  });

  describe('hexToRgb', () => {
    it('normalises to 0..1', () => {
      expect(hexToRgb('#ffffff')).toEqual([1, 1, 1]);
      expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    });

    it('expands the three-digit form', () => {
      expect(hexToRgb('#f00')).toEqual(hexToRgb('#ff0000'));
    });

    it('does not require the hash', () => {
      expect(hexToRgb('00d4ff')).toEqual(hexToRgb('#00d4ff'));
    });
  });
});
