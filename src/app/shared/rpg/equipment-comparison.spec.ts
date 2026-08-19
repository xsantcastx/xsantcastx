/**
 * equipment-comparison.spec.ts — the picker's "is this better than what I wear".
 *
 * `EquipmentPanelComponent` has no test, and adding one that mounts the whole
 * panel would drag in the paper doll, the URL sync, the translation service and
 * the inventory ledger to assert three pure functions. So the component is
 * constructed inside a TestBed with a stub inventory and the comparison methods
 * are driven directly — which is what they are: pure reads over
 * `snap.equipped` and the candidate.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EquipmentPanelComponent } from './equipment-panel.component';
import { InventoryService, type InventorySnapshot } from './inventory.service';
import { PAPER_DOLL_SLOTS, type PaperDollSlotManifest } from './paper-doll.manifest';
import type { GameItem, ItemStats, SlotId } from './item.model';

const HEAD = PAPER_DOLL_SLOTS.find(s => s.slotId === 'head')!;
/** `feet` accepts nothing and has no `liveSlot`. The locked-slot case. */
const FEET = PAPER_DOLL_SLOTS.find(s => s.slotId === 'feet')!;

function item(id: string, stats: ItemStats, over: Partial<GameItem> = {}): GameItem {
  return {
    id,
    name: id,
    type: 'rune',
    rarity: 'rare',
    stats,
    sellValue: 8_000,
    equipped: false,
    foundAt: '2026-08-18T00:00:00.000Z',
    soulbound: false,
    ...over,
  };
}

/** Only the fields the comparison reads. The rest of the panel is not exercised. */
function snapshotWith(equipped: Partial<Record<SlotId, GameItem>>): InventorySnapshot {
  return {
    items: [], bag: [], stacks: [], equipped,
    totals: { goldPerSec: 0, magicFind: 0, xpBonus: 0, lootBonus: 0, strikePower: 0, ward: 0 },
    goldFromSales: 0, sold: 0, usedRows: 0, full: false,
  };
}

function panelWith(equipped: Partial<Record<SlotId, GameItem>>): EquipmentPanelComponent {
  const snap = snapshotWith(equipped);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: InventoryService,
        useValue: {
          snapshot: snap,
          snapshot$: { subscribe: () => ({ unsubscribe() {}, add() {} }) },
          init: () => {},
          canDrop: () => false,
          canSell: () => false,
          equip: () => true,
          unequip: () => true,
        },
      },
    ],
  });
  const panel = TestBed.createComponent(EquipmentPanelComponent).componentInstance;
  panel.snap = snap;
  return panel;
}

describe('EquipmentPanelComponent comparison', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('reports nothing to compare when the slot is empty', () => {
    // With nothing worn the mod line beside the candidate already says what it
    // does; a column of "+9 (new)" would be the same information twice.
    const panel = panelWith({});
    expect(panel.comparison(HEAD, item('a', { magicFind: 9 }))).toEqual([]);
    expect(panel.isUpgrade(HEAD, item('a', { magicFind: 9 }))).toBeFalse();
  });

  it('reports a straight improvement', () => {
    const panel = panelWith({ head: item('worn', { magicFind: 5 }) });
    const rows = panel.comparison(HEAD, item('better', { magicFind: 9 }));

    expect(rows.length).toBe(1);
    expect(rows[0].key).toBe('magicFind');
    expect(rows[0].delta).toBe(4);
    expect(rows[0].better).toBeTrue();
    expect(rows[0].text).toBe('Magic Find +4%');
    expect(panel.isUpgrade(HEAD, item('better', { magicFind: 9 }))).toBeTrue();
  });

  it('reports a loss with a minus sign, not just a colour', () => {
    // Colour alone is unreadable to a deuteranope, so the sign is in the text.
    const panel = panelWith({ head: item('worn', { magicFind: 9 }) });
    const rows = panel.comparison(HEAD, item('worse', { magicFind: 3 }));

    expect(rows[0].delta).toBe(-6);
    expect(rows[0].better).toBeFalse();
    expect(rows[0].text).toBe('Magic Find −6%');
    expect(panel.isUpgrade(HEAD, item('worse', { magicFind: 3 }))).toBeFalse();
  });

  it('shows a stat the candidate drops entirely as a negative', () => {
    // Losing Gold/sec +4 to gain Magic Find +2 is a real trade, and a panel that
    // only listed the gain would be hiding half of it.
    const panel = panelWith({ head: item('worn', { goldPerSec: 4, magicFind: 5 }) });
    const rows = panel.comparison(HEAD, item('trade', { magicFind: 7 }));

    const gold = rows.find(r => r.key === 'goldPerSec');
    expect(gold).toBeDefined();
    expect(gold!.delta).toBe(-4);
    expect(gold!.better).toBeFalse();
    expect(rows.find(r => r.key === 'magicFind')!.delta).toBe(2);
  });

  it('omits stats that did not move', () => {
    const panel = panelWith({ head: item('worn', { goldPerSec: 4, magicFind: 5 }) });
    const rows = panel.comparison(HEAD, item('same-gold', { goldPerSec: 4, magicFind: 8 }));

    expect(rows.map(r => r.key)).toEqual(['magicFind']);
  });

  it('does not compare an item against itself', () => {
    const worn = item('worn', { magicFind: 5 });
    const panel = panelWith({ head: worn });
    expect(panel.comparison(HEAD, worn)).toEqual([]);
  });

  it('rounds a fractional Gold/sec delta to something printable', () => {
    // 0.4 - 0.1 is 0.30000000000000004 in IEEE 754, and a delta chip reading
    // that is worse than no chip at all.
    const panel = panelWith({ head: item('worn', { goldPerSec: 0.1 }) });
    const rows = panel.comparison(HEAD, item('next', { goldPerSec: 0.4 }));
    expect(rows[0].delta).toBe(0.3);
    expect(rows[0].text).toBe('Gold/sec +0.3');
  });

  it('reports nothing for a slot the doll cannot fill', () => {
    const panel = panelWith({ head: item('worn', { magicFind: 5 }) });
    expect(panel.comparison(FEET as PaperDollSlotManifest, item('a', { magicFind: 9 }))).toEqual([]);
  });

  it('calls a net-positive trade an upgrade and a net-negative one not', () => {
    const panel = panelWith({ head: item('worn', { goldPerSec: 4, magicFind: 5 }) });
    expect(panel.isUpgrade(HEAD, item('up', { goldPerSec: 3, magicFind: 9 }))).toBeTrue();
    expect(panel.isUpgrade(HEAD, item('down', { goldPerSec: 1, magicFind: 4 }))).toBeFalse();
  });

  it('reports what is worn in a slot, and nothing for a locked one', () => {
    const worn = item('worn', { magicFind: 5 });
    const panel = panelWith({ head: worn });
    expect(panel.wornIn(HEAD)).toBe(worn);
    expect(panel.wornIn(FEET as PaperDollSlotManifest)).toBeUndefined();
  });
});

describe('EquipmentPanelComponent tooltip', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names the item, its rarity, its mods and its price', () => {
    const panel = panelWith({});
    const text = panel.itemTooltip(item('Bright Sigil', { goldPerSec: 4, magicFind: 9 }));

    expect(text).toContain('Bright Sigil');
    expect(text).toContain('Rare');
    expect(text).toContain('Gold/sec +4');
    expect(text).toContain('Magic Find +9%');
    expect(text).toContain('Sells for');
  });

  it('shows the temper level beside the name', () => {
    const panel = panelWith({});
    const text = panel.itemTooltip(item('Edge', { strikePower: 2 }, { upgradeLevel: 3 }));
    expect(text).toContain('Edge +3');
  });

  it('drops the price line for something soulbound', () => {
    const panel = panelWith({});
    const text = panel.itemTooltip(item('Relic', { xpBonus: 5 }, { soulbound: true, sellValue: 0 }));
    expect(text).not.toContain('Sells for');
  });

  it('says something useful for an item with no stats at all', () => {
    // A rune minted off the anvil rolls an empty stat block. The tooltip must
    // still name it rather than collapsing to an empty string.
    const panel = panelWith({});
    const text = panel.itemTooltip(item('Shade Sigil', {}));
    expect(text).toContain('Shade Sigil');
    expect(text).toContain('Rare');
  });
});
