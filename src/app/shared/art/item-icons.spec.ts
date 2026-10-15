/**
 * item-icons.spec.ts — one art style for items: every item is a pixel icon.
 * Pure data; no DOM.
 */
import { ITEM_DEFINITIONS } from '../rpg/item-definition';
import { ALL_CHARMS, mintCharm } from '../rpg/item.model';
import { itemArt } from '../rpg/material-catalog';
import { RUNES, RUNEWORDS } from '../rune-forge/rune.model';
import * as MANIFEST from './art-manifest.generated';
import { artFor } from './art';
import { SHAPES } from './item-icon-shapes';
import { FILE_STEMS, ITEM_ICONS, ITEM_ICON_IDS, PLAQUE_ICON_IDS, RUNE_ICONS, itemIcon, plaqueIcon, runeGlyph, runeIcon } from './item-icons';

const SVG = /^data:image\/svg\+xml,/;

describe('item icons (pixel)', () => {
  it('gives every authored item definition its pixel icon through artFor', () => {
    const painted = ITEM_DEFINITIONS.filter(def => !SVG.test(artFor(def.id)?.src ?? '')).map(def => def.id);
    expect(painted).toEqual([]);
  });

  it('gives every charm its pixel icon, minted ids included (no initials in the satchel)', () => {
    const missing = ALL_CHARMS.filter(seed => !SVG.test(itemArt(mintCharm(seed, '2026-10-15T00:00:00.000Z', () => .5))?.src ?? '')).map(seed => seed.id);
    expect(missing).toEqual([]);
    for (const seed of ALL_CHARMS) {
      expect(itemArt({ id: seed.id })?.src).withContext(seed.id).toMatch(SVG);
      // As the satchel ledger stores it: a minted id and a `type:name` definition.
      expect(itemArt({ id: `${seed.id}-mf3k2x1a-1z`, definitionId: `charm:${seed.name}`, name: seed.name })?.src).withContext(seed.name).toMatch(SVG);
      expect(itemArt({ id: 'e2e-1', definitionId: `charm:${seed.name}`, name: seed.name })?.src).withContext(seed.name).toMatch(SVG);
    }
    // Every satchel item resolves through itemArt, by definition id or minted id.
    const loose = ITEM_DEFINITIONS.filter(def => !SVG.test(itemArt({ id: `e2e-${def.id}`, name: def.name, definitionId: `artifact:${def.name}` })?.src ?? '')).map(def => def.id);
    expect(loose).toEqual([]);
  });

  it('covers every painted item, currency and forge good in the library', () => {
    const groups = Object.entries(MANIFEST).filter(([name]) =>
      name.startsWith('ART_ITEMS') || ['ART_CURRENCIES', 'ART_CURRENCIES_REALM_TOKENS', 'ART_MARKET_FORGE', 'ART_MARKET_HAMMERS',
        'ART_MARKET_MASTERY', 'ART_MARKET_ENCHANTMENTS'].includes(name));
    expect(groups.length).toBeGreaterThan(15);
    const missing = groups.flatMap(([, group]) => Object.keys(group as object).filter(id => !itemIcon(id) && !runeIcon(id)));
    expect(missing).toEqual([]);
  });

  it('draws the forged tools as what they are, not the hammer and mace stand-ins', () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      expect(ITEM_ICONS[`pickaxe-${tier}`].kind).toBe('pickaxe');
      expect(ITEM_ICONS[`axe-${tier}`].kind).toBe('axe');
    }
    for (const tier of [1, 2, 3, 4]) expect(ITEM_ICONS[`sickle-${tier}`].kind).toBe('sickle');
    expect(itemIcon('pickaxe-1')!.src).not.toBe(itemIcon('iron-hammer')!.src);
  });

  it('keeps every shape inside the 16 px cell with room for its outline', () => {
    for (const [kind, shape] of Object.entries(SHAPES)) {
      let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
      (shape as readonly string[]).forEach((row, y) => [...row].forEach((c, x) => {
        if (c === '.') return;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        expect('Ddblhwvueags'.includes(c) || c === 'A' || c === 'G').withContext(`${kind} uses '${c}'`).toBeTrue();
      }));
      expect(x1 - x0 + 1).withContext(kind).toBeLessThanOrEqual(14);
      expect(y1 - y0 + 1).withContext(kind).toBeLessThanOrEqual(14);
    }
  });

  it('paints a 16 × 16 crisp SVG with one outline and no black', () => {
    const svg = decodeURIComponent(itemIcon('eclipse-longblade')!.src.replace(SVG, ''));
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('#140a1f');
    expect(svg).not.toMatch(/#000000|#000"/);
  });

  it('is distinct per item and cached', () => {
    // The library's file stems are the same things under another name; every model id is its own icon.
    const srcs = ITEM_ICON_IDS.filter(id => !(id in FILE_STEMS)).map(id => itemIcon(id)!.src);
    expect(new Set(srcs).size).toBe(srcs.length);
    for (const [stem, id] of Object.entries(FILE_STEMS)) expect(itemIcon(stem)!.src).withContext(stem).toBe(itemIcon(id)!.src);
    expect(itemIcon('cinder-ore')).toBe(itemIcon('cinder-ore'));
    expect(itemIcon('no-such-item')).toBeNull();
    expect(itemIcon(undefined)).toBeNull();
  });

  it('carves every rune and rune-word its own glyph on a tablet', () => {
    const ids = [...RUNES.map(r => r.id), ...RUNEWORDS.map(w => w.id)];
    for (const id of ids) expect(runeIcon(id)?.src).withContext(id).toMatch(SVG);
    const glyphs = Object.keys(RUNE_ICONS).map(id => [...runeGlyph(id)].sort().join(' '));
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('keeps aether the currency and Aether the rune apart', () => {
    expect(itemIcon('aether')!.src).not.toBe(runeIcon('aether')!.src);
    expect(artFor('aether')!.src).toBe(itemIcon('aether')!.src);
    // The named runes and rune-words are tablets wherever they show; a plaque reads a bare rune word as the rune.
    expect(artFor('rune-of-cinder')!.src).toBe(runeIcon('rune-of-cinder')!.src);
    expect(artFor('first-light')!.src).toBe(runeIcon('first-light')!.src);
    expect(plaqueIcon('eclipse')!.src).toBe(runeIcon('eclipse')!.src);
  });

  it('gives each stall plaque key an icon without touching that key elsewhere', () => {
    for (const key of PLAQUE_ICON_IDS) {
      expect(plaqueIcon(key)?.src).withContext(key).toMatch(SVG);
      expect(itemIcon(key)).withContext(key).toBeNull();
    }
    expect(plaqueIcon('cinder-ore')).toBe(itemIcon('cinder-ore'));
  });
});
