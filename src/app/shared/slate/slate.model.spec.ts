import { MIRROR_SLATE } from '../economy/economy-curve';
import { PANEL_REGISTRY } from '../../play/world/panel-registry';
import { MIRROR_SLATE_ID, MIRROR_SLATE_II_ID, SLATE_ITEMS, SLATE_UPGRADE_INPUTS } from './slate-items.model';
import {
  CROUPIER_STATIONS, SLATE_TABLES, SLATE_TABLE_GAMES, slateAwardDue, slateBadge, slateOffer, slateRefusal, slateTabs, slateTier,
  slateUpgradeNeeds, slateUpgradeReady, tablesPlayed, type SlateMoment,
} from './slate.model';
import { REELS_GAME_ID } from '../reels/reels.service';
import { RUNE_DROP_GAME_ID } from '../rune-drop/rune-drop.service';

const bag = (stacks: Record<string, number>) => (id: string) => stacks[id] ?? 0;
const calm: SlateMoment = { tier: 1, defeated: false, enemyHp: 0, fishing: false, reeling: false, storyCard: false };

describe('Mirror Slate rules', () => {
  it('reads the tier off the pane held: none, tier I, and tier II winning over a stray tier I', () => {
    expect(slateTier(bag({}))).toBe(0);
    expect(slateTier(bag({ [MIRROR_SLATE_ID]: 1 }))).toBe(1);
    expect(slateTier(bag({ [MIRROR_SLATE_II_ID]: 1 }))).toBe(2);
    expect(slateTier(bag({ [MIRROR_SLATE_ID]: 1, [MIRROR_SLATE_II_ID]: 1 }))).toBe(2);
  });

  it('counts plays across Lune\'s four tables only, and hands the Slate over at ten', () => {
    expect(SLATE_TABLE_GAMES).toEqual(['reels', 'rune-drop', 'seam-sweeper', 'eclipse-ascent']);
    const plays: Record<string, number> = { reels: 4, 'rune-drop': 3, 'seam-sweeper': 1, 'eclipse-ascent': 1, gambler: 50, coin: 9 };
    expect(tablesPlayed(g => plays[g] ?? 0)).toBe(9);
    expect(slateAwardDue(0, 9)).toBeFalse();
    expect(slateAwardDue(0, MIRROR_SLATE.awardPlays)).toBeTrue();
    expect(MIRROR_SLATE.awardPlays).toBe(10);
    // Already holding one: Lune has nothing more to give.
    expect(slateAwardDue(1, 40)).toBeFalse();
    expect(slateAwardDue(2, 40)).toBeFalse();
  });

  it('offers the shortcut price with what is left to play', () => {
    expect(slateOffer(0, 7, 0)).toEqual({ tier: 0, played: 7, toGo: 3, price: MIRROR_SLATE.price, affordable: false });
    expect(slateOffer(0, 12, MIRROR_SLATE.price).toGo).toBe(0);
    expect(slateOffer(0, 0, MIRROR_SLATE.price).affordable).toBeTrue();
    expect(slateOffer(1, 2, 0).toGo).toBe(0);
  });

  it('opens tier II only on a tier I pane with every Delve material Kael asks for', () => {
    const full: Record<string, number> = Object.fromEntries(SLATE_UPGRADE_INPUTS.map(i => [i.id, i.count]));
    expect(SLATE_UPGRADE_INPUTS[0]).toEqual({ id: MIRROR_SLATE_ID, count: 1 });
    expect(slateUpgradeReady(bag(full))).toBeTrue();
    expect(slateUpgradeReady(bag({ ...full, glowcap: 5 }))).toBeFalse();
    expect(slateUpgradeReady(bag({ ...full, [MIRROR_SLATE_ID]: 0 }))).toBeFalse();
    // Already tier II: nothing to bind.
    expect(slateUpgradeReady(bag({ ...full, [MIRROR_SLATE_II_ID]: 1 }))).toBeFalse();
    expect(slateUpgradeNeeds(bag({ glowcap: 2 })).find(r => r.id === 'glowcap')).toEqual({ id: 'glowcap', need: 6, have: 2 });
  });

  it('adds the map tab at tier II and nothing at all without a pane', () => {
    expect(slateTabs(0)).toEqual([]);
    expect(slateTabs(1)).toEqual(['tables', 'factory', 'scan']);
    expect(slateTabs(2)).toEqual(['tables', 'factory', 'map', 'scan']);
  });

  describe('the busy rule', () => {
    it('opens when nothing holds the Keeper', () => {
      expect(slateRefusal(calm)).toBeNull();
    });
    it('never opens without a pane, on a fallen Keeper, mid-fight or mid-game', () => {
      expect(slateRefusal({ ...calm, tier: 0 })).toBe('unowned');
      expect(slateRefusal({ ...calm, defeated: true, enemyHp: 40 })).toBe('fallen');
      expect(slateRefusal({ ...calm, enemyHp: 1 })).toBe('fight');
      expect(slateRefusal({ ...calm, fishing: true })).toBe('game');
      expect(slateRefusal({ ...calm, reeling: true })).toBe('game');
      expect(slateRefusal({ ...calm, storyCard: true })).toBe('game');
    });
  });

  it('lights the badge for an explorer home, a rune found or ten minutes of income waiting', () => {
    expect(slateBadge({ gold: 0, runes: 0, returns: 0 }, 10)).toBeFalse();
    expect(slateBadge({ gold: 0, runes: 0, returns: 1 }, 10)).toBeTrue();
    expect(slateBadge({ gold: 0, runes: 1, returns: 0 }, 0)).toBeTrue();
    expect(slateBadge({ gold: 5_999, runes: 0, returns: 0 }, 10)).toBeFalse();
    expect(slateBadge({ gold: 6_000, runes: 0, returns: 0 }, 10)).toBeTrue();
    // No income: Gold alone never lights it.
    expect(slateBadge({ gold: 1e9, runes: 0, returns: 0 }, 0)).toBeFalse();
  });

  it('embeds the stalls\' own panels (same loaders), so the Slate plays on the same ledger ids', () => {
    for (const table of SLATE_TABLES) expect(PANEL_REGISTRY[table.panel]).withContext(table.panel).toBeDefined();
    expect(SLATE_TABLES[0].game).toBe(REELS_GAME_ID);
    expect(SLATE_TABLES[1].game).toBe(RUNE_DROP_GAME_ID);
    expect(CROUPIER_STATIONS).toEqual(['gambler', ...SLATE_TABLE_GAMES]);
  });

  it('gives both panes a source, a use and a Found in line (meaning rule)', () => {
    expect(SLATE_ITEMS.map(i => i.id)).toEqual([MIRROR_SLATE_ID, MIRROR_SLATE_II_ID]);
    for (const item of SLATE_ITEMS) {
      expect(item.foundIn.length).withContext(item.id).toBeGreaterThan(0);
      expect(item.sources.length).withContext(item.id).toBeGreaterThan(0);
      expect(item.uses.length).withContext(item.id).toBeGreaterThan(0);
    }
  });
});
