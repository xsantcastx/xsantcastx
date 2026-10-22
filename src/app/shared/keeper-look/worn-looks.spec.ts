import { UNIQUE_ITEMS } from '../rpg/unique-items';
import { BOSS_UNIQUES } from '../rpg/boss-uniques';
import { SET_PIECES } from '../rpg/set-items';
import { definitionFor } from '../rpg/item-definition';
import type { GameItem, SlotId } from '../rpg/item.model';
import { GEAR_SLOTS, gearKey, type GearSlot, type KeeperGear } from './keeper-gear';
import { frontSheet } from './keeper-front';
import { defaultLook } from './keeper-look.model';
import { KeeperPainter } from './keeper-paint';
import { equippedInLedger, wornGear } from './worn-gear';
import { WORN_LOOK_TABLE } from './worn-looks.data';
import {
  WORN_MAX, WORN_RE, authoredLook, forgetWornLook, lookById, packWorn, pieceOfLook, registerWornLook, shapeFits, unpackWorn, wornLookOf,
} from './worn-looks';

const HEX = /^#[0-9a-f]{6}$/;
const slotOf = (u: { slot?: string; charm?: boolean }): GearSlot => (u.slot ?? (u.charm ? 'charm1' : 'trinket')) as GearSlot;
const item = (definitionId: string, rarity = 'legendary'): GameItem => ({ definitionId, name: definitionFor({ definitionId, name: '', type: 'artifact' })?.name ?? definitionId, rarity, type: 'artifact' } as unknown as GameItem);

describe('worn looks (worn-looks.ts)', () => {
  it('every unique, boss unique and set piece has a hand-authored look that fits its slot', () => {
    const ids = new Set([...UNIQUE_ITEMS, ...BOSS_UNIQUES, ...SET_PIECES].map(u => u.id));
    expect(ids.size).toBeGreaterThanOrEqual(70);
    for (const u of [...UNIQUE_ITEMS, ...BOSS_UNIQUES, ...SET_PIECES]) {
      const spec = authoredLook(u.id);
      expect(spec).withContext(`${u.id} has no worn look (add \`look\` to its entry, or to worn-looks.data.ts)`).toBeTruthy();
      expect(shapeFits(slotOf(u), spec!.shape)).withContext(`${u.id}: a ${spec!.shape} is not worn in ${slotOf(u)}`).toBeTrue();
      const look = wornLookOf({ definitionId: u.id, name: u.name, rarity: u.rarity }, slotOf(u))!;
      expect(look.id).toBe(u.id);
      for (const tone of [look.deep, look.base, look.lit, look.accent, look.sub]) expect(tone).withContext(u.id).toMatch(HEX);
      for (const t of [look.trim, look.glow, look.eyes, look.runes, look.horns, look.mantle, look.seam, look.fx?.color]) if (t) expect(t).withContext(u.id).toMatch(HEX);
    }
    // The table names nothing that is not an item.
    for (const id of Object.keys(WORN_LOOK_TABLE)) expect(definitionFor({ definitionId: id, name: '', type: 'artifact' })).withContext(id).toBeTruthy();
  });

  it('the owner\'s examples: the Sexton\'s Cowl is a dark cowl with red eyes in a shadowed face; the Coal crown smoulders', () => {
    const cowl = wornLookOf(item('unique-sextons-lost-cowl'), 'head')!;
    expect(cowl.shape).toBe('cowl');
    expect(cowl.shadow).toBeTrue();
    expect(cowl.eyes).toBe('#ff3b30');
    expect(parseInt(cowl.base.slice(1, 3), 16)).toBeLessThan(0x40);
    expect(wornLookOf(item('unique-crown-banked-coal'), 'head')!.fx?.kind).toBe('embers');
    expect(wornLookOf(item('unique-abbess-censer'), 'off-hand')!.shape).toBe('censer');
    expect(wornLookOf(item('unique-abbess-censer'), 'off-hand')!.fx?.kind).toBe('smoke');
    expect(wornLookOf(item('unique-seamstitch-grips'), 'hands')!.seam).toBe('#b06bff');
  });

  it('ordinary items derive their look from the icon and base: a trim from rare, a glow edge from legendary', () => {
    const common = wornLookOf(item('astral-helm', 'common'), 'head')!;
    const rare = wornLookOf(item('astral-helm', 'rare'), 'head')!;
    const legendary = wornLookOf(item('astral-helm', 'legendary'), 'head')!;
    expect(common.id).toBe('astral-helm.0');
    expect(common.trim).toBeNull();
    expect(rare.trim).toMatch(HEX);
    expect(rare.glow).toBeNull();
    expect(legendary.glow).toMatch(HEX);
    expect(wornLookOf(item('voidweave-cowl', 'epic'), 'head')!.shape).toBe('cowl');
    expect(wornLookOf(item('eclipse-longblade', 'rare'), 'weapon')!.shape).toMatch(/sword/);
    expect(wornLookOf({ name: 'Old Hat' }, 'head')).toBeNull();
  });

  it('look ids round-trip through presence (packWorn / unpackWorn), within the room\'s limit', () => {
    const gear = wornGear({
      head: item('unique-sextons-lost-cowl'), chest: item('set-abbey-robe', 'mythic'), hands: item('unique-seamstitch-grips'),
      feet: item('set-abbey-sandals', 'mythic'), weapon: item('eclipse-longblade', 'epic'), 'off-hand': item('unique-abbess-censer'),
      legs: item('unique-thornroot-greaves', 'rare'), trinket: item('set-abbey-censer-chain', 'mythic'),
      charm1: item('unique-voids-whisper', 'rare'), charm2: item('unique-eclipse-manifest', 'singular'), charm3: item('unique-long-account', 'legendary'),
    } as Partial<Record<SlotId, GameItem>>);
    const packed = packWorn(gear);
    expect(packed.length).toBeLessThanOrEqual(WORN_MAX);
    expect(packed).toMatch(WORN_RE);
    expect(packed).toContain('hu.sextons-lost-cowl');
    const back = unpackWorn(packed)!;
    for (const slot of ['head', 'chest', 'hands', 'feet', 'weapon', 'off-hand'] as GearSlot[]) {
      expect(back[slot]?.look?.id).withContext(slot).toBe(gear[slot]!.look!.id);
      expect(back[slot]?.kind).withContext(slot).toBe(gear[slot]!.kind);
    }
    // The painter sees the same gear on both screens.
    expect(gearKey(unpackWorn(packWorn(back)))).toBe(gearKey(back));
    // Junk and unknown ids are skipped, never painted.
    expect(unpackWorn('<img>')).toBeNull();
    expect(unpackWorn('hno-such-item,zfoo')).toBeNull();
    expect(unpackWorn('')).toBeNull();
    expect(lookById('astral-helm.9', 'head')).toBeNull();
  });

  it('the sprite cache key changes when the gear (or only its look) changes', () => {
    const look = defaultLook();
    const bare = new KeeperPainter(look, null);
    const cowl = new KeeperPainter(look, wornGear({ head: item('unique-sextons-lost-cowl') } as Partial<Record<SlotId, GameItem>>));
    const stillglass = new KeeperPainter(look, wornGear({ head: item('unique-stillglass-cowl', 'rare') } as Partial<Record<SlotId, GameItem>>));
    expect(cowl.key).not.toBe(bare.key);
    expect(cowl.key).not.toBe(stillglass.key);
    const a: KeeperGear = { head: pieceOfLook(wornLookOf(item('astral-helm', 'rare'), 'head')!) };
    const b: KeeperGear = { head: pieceOfLook(wornLookOf(item('astral-helm', 'legendary'), 'head')!) };
    expect(gearKey(a)).not.toBe(gearKey(b));
    // One baked sheet per painter: the same painter gives the same sheet, another gear another.
    expect(frontSheet(cowl)).toBe(frontSheet(cowl));
    expect(frontSheet(cowl)).not.toBe(frontSheet(stillglass));
  });

  it('the cowl paints red eye-pips in a dark face, front and side', () => {
    const painter = new KeeperPainter(defaultLook(), wornGear({ head: item('unique-sextons-lost-cowl') } as Partial<Record<SlotId, GameItem>>));
    const sheet = frontSheet(painter);
    const d = sheet.getContext('2d')!.getImageData(0, 0, 28, 40).data;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    expect(red).toBeGreaterThanOrEqual(2);
    const side = document.createElement('canvas'); side.width = side.height = 96;
    painter.still(side);
    const s = side.getContext('2d')!.getImageData(0, 0, 96, 96).data;
    let sred = 0;
    for (let i = 0; i < s.length; i += 4) if (s[i] > 200 && s[i + 1] < 90 && s[i + 2] < 90) sred++;
    expect(sred).toBeGreaterThan(0);
  });

  it('a new unique can add its look at run time (registerWornLook), and every slot paints without throwing', () => {
    registerWornLook('cometfall-helm', { shape: 'horned', pal: 'basalt', accent: '#ff7a2e', horns: '#e8e1cf', eyes: '#ff7a2e' });
    const look = wornLookOf(item('cometfall-helm', 'epic'), 'head')!;
    expect(look.id).toBe('cometfall-helm');
    expect(look.shape).toBe('horned');
    expect(lookById('cometfall-helm', 'head')?.horns).toBe('#e8e1cf');
    forgetWornLook('cometfall-helm');
    expect(wornLookOf(item('cometfall-helm', 'epic'), 'head')!.id).toBe('cometfall-helm.3');
    // Every authored look on a Keeper: both painters, every frame of the front sheet and the side view.
    for (const u of [...UNIQUE_ITEMS]) {
      const slot = slotOf(u);
      const gear: KeeperGear = { [slot]: pieceOfLook(wornLookOf({ definitionId: u.id, rarity: u.rarity }, slot)!) };
      const painter = new KeeperPainter(defaultLook(), gear);
      expect(() => frontSheet(painter)).not.toThrow();
      const c = document.createElement('canvas'); c.width = c.height = 48;
      expect(() => painter.draw(c.getContext('2d')!, 1, { action: 'run', time: .3, attackT: 0, weapon: true })).withContext(u.id).not.toThrow();
    }
    expect(GEAR_SLOTS.length).toBe(11);
  });

  it('the lobby reads what another Keeper wears from its saved ledger', () => {
    const worn = equippedInLedger({
      records: [
        { id: 'a', definitionId: 'unique-sextons-lost-cowl', name: "Sexton's Lost Cowl", rarity: 'legendary', type: 'artifact', location: { kind: 'equipped', slotId: 'head' } },
        { id: 'b', definitionId: 'astral-helm', name: 'Astral Helm', rarity: 'rare', type: 'artifact', location: { kind: 'bag' } },
        { id: 'c', definitionId: 'set-abbey-robe', name: 'Drowned Robe', rarity: 'mythic', type: 'artifact', location: { kind: 'equipped', slotId: 'chest' } },
      ],
      tombstones: [{ id: 'c' }],
    });
    expect(Object.keys(worn)).toEqual(['head']);
    expect(wornGear(worn).head?.look?.shape).toBe('cowl');
    expect(equippedInLedger(null)).toEqual({});
  });
});
