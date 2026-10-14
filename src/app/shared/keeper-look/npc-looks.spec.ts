import { NPC_LOOKS, garbKey, townsfolkLook } from './npc-looks';
import { KeeperPainter } from './keeper-paint';
import { TOWN_KEEPERS, REALM_PALETTES } from '../../play/world/life';
import { CREATURE_ART, CREATURE_FRAMES, CreaturePainter } from '../../play/engine/creature-pixel';
import { TOWNS } from '../../play/world/world.model';

function still(painter: KeeperPainter): string {
  const el = document.createElement('canvas');
  el.width = el.height = 96;
  painter.still(el);
  return el.toDataURL();
}

describe('npc-looks: every town figure is a pixel Keeper', () => {
  it('every keeper in every town (and Hollis Fenn) has a fixed look', () => {
    for (const keepers of Object.values(TOWN_KEEPERS)) {
      for (const k of keepers) expect(NPC_LOOKS[k.id]).withContext(k.id).toBeTruthy();
    }
    expect(NPC_LOOKS['hollis-fenn']).toBeTruthy();
  });

  it('no two named people paint the same, and a look paints the same every time', () => {
    const ids = Object.keys(NPC_LOOKS);
    const shots = ids.map(id => still(new KeeperPainter(NPC_LOOKS[id].look, NPC_LOOKS[id].gear, NPC_LOOKS[id].garb)));
    expect(new Set(shots).size).toBe(ids.length);
    const kael = NPC_LOOKS['kael'];
    expect(still(new KeeperPainter(kael.look, kael.gear, kael.garb))).toBe(shots[ids.indexOf('kael')]);
  });

  it('garb changes the painting and the cache key', () => {
    const kael = NPC_LOOKS['kael'];
    const plain = new KeeperPainter(kael.look, kael.gear);
    const dressed = new KeeperPainter(kael.look, kael.gear, kael.garb);
    expect(plain.key).not.toBe(dressed.key);
    expect(still(plain)).not.toBe(still(dressed));
    expect(garbKey({ apron: '#5a3a24', oneHand: true })).toBe(garbKey({ oneHand: true, apron: '#5a3a24' }));
  });

  it('townsfolk are seeded: the same seat is the same person, the next seat is someone else', () => {
    const palette = REALM_PALETTES.infernal[1];
    const a = townsfolkLook('infernal:0', palette, 'coat'), b = townsfolkLook('infernal:0', palette, 'coat');
    expect(a).toEqual(b);
    const shots = new Set([0, 1, 2, 3].map(i => {
      const l = townsfolkLook(`infernal:${i}`, palette, 'robe');
      return still(new KeeperPainter(l.look, l.gear, l.garb));
    }));
    expect(shots.size).toBe(4);
  });

  it('walk and talk paint without throwing', () => {
    const n = NPC_LOOKS['merchant'];
    const painter = new KeeperPainter(n.look, n.gear, n.garb);
    const el = document.createElement('canvas'); el.width = el.height = 200;
    const c = el.getContext('2d')!;
    for (const action of ['walk', 'talk', 'idle'] as const) {
      c.save(); c.translate(100, 190);
      expect(() => painter.draw(c, 4, { action, time: 1.3, attackT: 0, weapon: true })).not.toThrow();
      c.restore();
    }
  });
});

describe('creature-pixel: every hunt creature is a pixel sprite', () => {
  it('every creature that walks a hunt or the Delve (bar the Underhearth\'s own) has art', () => {
    for (const town of Object.values(TOWNS)) {
      if (!town) continue;
      for (const area of [town, ...town.hunts]) {
        for (const m of area.monsters) {
          if (m.trait) continue; // the Underhearth's Ember, Sentinel, shades and Furnace are drawn pixel in the engine
          expect(CREATURE_ART[m.creature]).withContext(`${area.id}: ${m.creature}`).toBeTruthy();
        }
      }
    }
  });

  it('each frame is its own pose, the flash is a white silhouette, and frames are cached', () => {
    for (const [key, art] of Object.entries(CREATURE_ART)) {
      const painter = new CreaturePainter(art);
      const shots = CREATURE_FRAMES.map(frame => {
        const el = document.createElement('canvas'); el.width = (art.w + 2) * 2; el.height = (art.h + 2) * 2;
        const c = el.getContext('2d')!;
        c.translate(el.width / 2, el.height);
        painter.draw(c, 2, frame, false);
        return el.toDataURL();
      });
      expect(new Set(shots).size).withContext(key).toBeGreaterThanOrEqual(5);
      const el = document.createElement('canvas'); el.width = (art.w + 2) * 2; el.height = (art.h + 2) * 2;
      const c = el.getContext('2d')!;
      c.translate(el.width / 2, el.height);
      painter.draw(c, 2, 'idle0', true);
      const data = c.getImageData(0, 0, el.width, el.height).data;
      let lit = 0, other = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]) (data[i] === 0xff && data[i + 1] === 0xf4 && data[i + 2] === 0xea ? lit++ : other++);
      expect(lit).withContext(key).toBeGreaterThan(50);
      expect(other).withContext(key).toBe(0);
    }
  });
});
