/**
 * forge-view-tone.spec.ts — which rung an expedition's haul is celebrated at.
 *
 * An expedition banks its runes through `RuneForgeService.grant()` exactly the
 * way a strike does, but it banks them in a settlement pass that runs with no
 * card on screen — sometimes with the tab in the background. The reveal card on
 * /sanctum is therefore the only moment there is anything to celebrate against,
 * and `bestTone` is what decides how loud that moment gets.
 *
 * The rule it has to keep: the haul is celebrated at its *best* find, and runes
 * and equippables are ranked against each other on one ladder. A Legendary
 * charm carried home beside an Ash rune is a Legendary return — reading the
 * rune alone would have shown a grey card for the best drop of someone's week.
 */
import { bestTone, type LandingItem } from './forge-view.component';
import { RUNE_TIERS } from '../shared/rune-forge/rune.model';
import type { RuneTier } from '../shared/rune-forge/rune.model';

/** Only the two fields `bestTone` reads. The rest of the card is not its business. */
function item(rarity: RuneTier): LandingItem {
  return { rarity } as LandingItem;
}

describe('bestTone', () => {
  it('is null for a haul of nothing but Gold', () => {
    expect(bestTone(null, [])).toBeNull();
  });

  it('takes the rune when the rune is the best thing in the bag', () => {
    const tone = bestTone(RUNE_TIERS.mythic, [item('common'), item('rare')]);
    expect(tone?.tier).toBe('mythic');
    expect(tone?.color).toBe(RUNE_TIERS.mythic.color);
  });

  it('takes an equippable when it outranks the rune', () => {
    // The case that made a Legendary charm read as a Common return.
    const tone = bestTone(RUNE_TIERS.common, [item('legendary')]);
    expect(tone?.tier).toBe('legendary');
  });

  it('ranks equippables against each other, not just against the rune', () => {
    const tone = bestTone(null, [item('uncommon'), item('epic'), item('rare')]);
    expect(tone?.tier).toBe('epic');
  });

  it('carries a tier the celebration ladder actually knows', () => {
    // `CelebrationService.celebrate()` is keyed on the tier id. A tone carrying
    // anything outside RUNE_TIERS would silently celebrate at Common.
    for (const tier of Object.keys(RUNE_TIERS) as RuneTier[]) {
      const tone = bestTone(RUNE_TIERS[tier], []);
      expect(tone?.tier).toBe(tier);
      expect(RUNE_TIERS[tone!.tier]).toBeDefined();
    }
  });

  it('holds the rune when a find ties it, so the card shows the thing with lore', () => {
    const tone = bestTone(RUNE_TIERS.epic, [item('epic')]);
    expect(tone?.tier).toBe('epic');
    expect(tone?.color).toBe(RUNE_TIERS.epic.color);
  });
});
