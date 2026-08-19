import { RARITY_ORDER, type EclipseRarity } from '../rarity/rarity.model';
import { CARD, RARITY_EFFECTS, effectsFor, tierOfRarityId } from './inspect-3d.model';

describe('inspect 3d model', () => {
  describe('the ladder', () => {
    it('never gets quieter as it gets rarer', () => {
      // The rule the drop toast already follows: every rung up earns one more
      // channel, and nothing is ever taken away.
      let orbiters = -1;
      let glow = -1;
      for (const tier of RARITY_ORDER) {
        const fx = RARITY_EFFECTS[tier];
        expect(fx.orbiters).withContext(tier).toBeGreaterThanOrEqual(orbiters);
        expect(fx.glow).withContext(tier).toBeGreaterThan(glow);
        orbiters = fx.orbiters;
        glow = fx.glow;
      }
    });

    it('keeps the loudest channels for the top of the ladder', () => {
      expect(RARITY_EFFECTS.mortal.orbiters).toBe(0);
      expect(RARITY_EFFECTS.mortal.rays).toBeFalse();

      // Tendrils, warp and prismatic are Singular's alone. If a second tier
      // ever earns one, the top of the ladder has stopped being the top.
      const withTendrils = RARITY_ORDER.filter(t => RARITY_EFFECTS[t].tendrils);
      const withWarp = RARITY_ORDER.filter(t => RARITY_EFFECTS[t].warp);
      const prismatic = RARITY_ORDER.filter(t => RARITY_EFFECTS[t].prismatic);
      expect(withTendrils).toEqual(['singular']);
      expect(withWarp).toEqual(['singular']);
      expect(prismatic).toEqual(['singular']);
    });

    it('covers every rarity the game can drop', () => {
      for (const tier of RARITY_ORDER) {
        expect(RARITY_EFFECTS[tier]).withContext(tier).toBeDefined();
      }
    });
  });

  describe('effectsFor', () => {
    it('halves the orbit field on a coarse pointer', () => {
      expect(effectsFor('singular', true).orbiters)
        .toBe(Math.round(RARITY_EFFECTS.singular.orbiters / 2));
    });

    it('leaves everything else alone on a phone', () => {
      const phone = effectsFor('singular', true);
      expect(phone.tendrils).toBeTrue();
      expect(phone.warp).toBeTrue();
      expect(phone.glow).toBe(RARITY_EFFECTS.singular.glow);
    });

    it('does not mutate the table it reads', () => {
      effectsFor('mythic', true);
      expect(RARITY_EFFECTS.mythic.orbiters).toBe(130);
    });
  });

  describe('tierOfRarityId', () => {
    it('passes an Eclipse tier straight through', () => {
      for (const tier of RARITY_ORDER) {
        expect(tierOfRarityId(tier)).toBe(tier);
      }
    });

    it('translates the forge ladder that items and runes actually carry', () => {
      // ItemRarity is RuneTier. Without this, every item in the game inspects
      // as Mortal — including a Legendary.
      expect(tierOfRarityId('common')).toBe('mortal');
      expect(tierOfRarityId('epic')).toBe('sacred');
      expect(tierOfRarityId('legendary')).toBe('anomalous');
    });

    it('keeps the forge ladder monotone through the join', () => {
      const rank = (t: EclipseRarity) => RARITY_ORDER.indexOf(t);
      const forge = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];
      let last = -1;
      for (const step of forge) {
        const r = rank(tierOfRarityId(step));
        expect(r).withContext(step).toBeGreaterThanOrEqual(last);
        last = r;
      }
    });

    it('falls back to Mortal rather than throwing', () => {
      expect(tierOfRarityId(undefined)).toBe('mortal');
      expect(tierOfRarityId('')).toBe('mortal');
      expect(tierOfRarityId('transcendent')).toBe('mortal');
    });
  });

  describe('CARD', () => {
    it('paints its faces at the aspect ratio it renders them at', () => {
      // A texture cut to a different ratio than the mesh stretches the artwork
      // and the type, and it is invisible until someone measures it.
      const mesh = CARD.width / CARD.height;
      const texture = CARD.texWidth / CARD.texHeight;
      expect(Math.abs(mesh - texture)).toBeLessThan(0.005);
    });

    it('is a card, not a slab', () => {
      expect(CARD.depth).toBeLessThan(CARD.width / 20);
    });
  });
});
