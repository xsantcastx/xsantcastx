import { NPCS } from '../npc/npc.model';
import { TOWN_KEEPERS } from '../../play/world/life';
import { NPC_LOOKS } from './npc-looks';
import { hasPortrait, npcPortrait } from './npc-portrait';

describe('npc portraits (the pixel Keeper as a face)', () => {
  it('paints every town keeper as a PNG of their own look', () => {
    const ids = Object.values(TOWN_KEEPERS).flat().map(k => k.id);
    expect(ids.length).toBeGreaterThan(15);
    const urls = ids.map(id => npcPortrait(id));
    for (const [i, url] of urls.entries()) expect(url).withContext(ids[i]).toMatch(/^data:image\/png;base64,/);
    // Twenty-odd people, twenty-odd faces.
    expect(new Set(urls).size).toBe(ids.length);
  });

  it('gives every speaking NPC with a look a face, Glim its moth, and the Nameless none', () => {
    for (const npc of NPCS) {
      if (npc.id === 'glim') expect(npcPortrait('glim')).toMatch(/^data:image\/svg\+xml,/);
      else if (NPC_LOOKS[npc.id]) expect(npcPortrait(npc.id)).withContext(npc.id).toMatch(/^data:image\/png/);
      else expect(hasPortrait(npc.id)).withContext(npc.id).toBeFalse();
    }
    expect(npcPortrait('nameless')).toBeNull();
    expect(npcPortrait(undefined)).toBeNull();
  });

  it('paints once and serves the cache after', () => {
    expect(npcPortrait('kael')).toBe(npcPortrait('kael'));
  });
});
