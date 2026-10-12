/**
 * market-reference.spec.ts — the server's copy of the catalogue is current.
 *
 * The market functions cannot import Angular-side code, so they carry a
 * generated copy of each good's base worth (the sanity band's fallback anchor)
 * and the inventory era (an edit to a stale-era save would be thrown away by
 * the client). This fails when either drifts. Fix by running:
 *
 *   node scripts/generate-market-reference.mjs
 */
import { EXCHANGE_CATALOGUE } from '../exchange/exchange.model';
import { INVENTORY_BAG_CAP, INVENTORY_ERA } from '../rpg/inventory.model';
import * as ref from '../../../../functions/src/market/reference.generated';

describe('market reference (functions/src/market/reference.generated.ts)', () => {
  it('pins the inventory era and bag cap', () => {
    expect(ref.INVENTORY_ERA).toBe(INVENTORY_ERA);
    expect(ref.INVENTORY_BAG_CAP).toBe(INVENTORY_BAG_CAP);
  });

  it('lists exactly the Exchange catalogue, at the same base worth', () => {
    const live = Object.fromEntries(EXCHANGE_CATALOGUE.map(g => [g.id, {
      kind: g.kind, rarity: g.rarity, basePrice: g.basePrice,
      stackKey: g.stackKey, definitionId: g.definitionId,
    }]));
    const copy = Object.fromEntries(Object.entries(ref.REFERENCE_GOODS).map(([id, g]) => [id, {
      kind: g.kind, rarity: g.rarity, basePrice: g.basePrice,
      stackKey: g.stackKey, definitionId: g.definitionId,
    }]));
    expect(Object.keys(copy).sort()).toEqual(Object.keys(live).sort());
    expect(copy).toEqual(live);
  });
});
