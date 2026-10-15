import { bestRod, bestTool, heldToolPiece, heldToolPieces, heldToolsKey } from './held-tool';

describe('held-tool: which tool goes in hand', () => {
  it('takes the highest tier the skill level allows', () => {
    const bag = ['starter-pickaxe', 'pickaxe-1', 'pickaxe-2', 'pickaxe-3', 'sword-thing'];
    expect(bestTool('pickaxe', bag, 1)?.definitionId).toBe('pickaxe-1');
    expect(bestTool('pickaxe', bag, 10)?.definitionId).toBe('pickaxe-2');
    expect(bestTool('pickaxe', bag, 25)?.definitionId).toBe('pickaxe-3');
    expect(bestTool('pickaxe', bag, 99)?.definitionId).toBe('pickaxe-3');
  });

  it('prefers a forged tool over the Worn starter of the same tier', () => {
    expect(bestTool('axe', ['starter-axe', 'axe-1'], 1)?.definitionId).toBe('axe-1');
    expect(bestTool('axe', ['axe-1', 'starter-axe'], 1)?.definitionId).toBe('axe-1');
    expect(bestTool('axe', ['starter-axe'], 1)).toEqual({ kind: 'axe', definitionId: 'starter-axe', tier: 1, starter: true });
  });

  it('falls back to the lowest held tool when every one is above the cap (it works as the capped tier)', () => {
    expect(bestTool('sickle', ['sickle-4', 'sickle-2'], 1)?.definitionId).toBe('sickle-2');
  });

  it('answers null when the family is not held, and ignores other families and junk', () => {
    expect(bestTool('pickaxe', ['axe-3', undefined, null, 'staff-2', 'pickaxe-9'], 50)).toBeNull();
  });

  it('picks the best rod the Fishing level allows, else the weakest held', () => {
    const held = (...ids: string[]) => (id: string) => ids.includes(id);
    expect(bestRod(held('worn-rod', 'seam-rod'), 1)?.definitionId).toBe('worn-rod');
    expect(bestRod(held('worn-rod', 'seam-rod'), 10)?.definitionId).toBe('seam-rod');
    expect(bestRod(held('worn-rod', 'root-rod', 'seam-rod', 'glowline-rod'), 30)?.definitionId).toBe('glowline-rod');
    expect(bestRod(held('glowline-rod'), 1)?.definitionId).toBe('glowline-rod');
    expect(bestRod(held(), 50)).toBeNull();
  });

  it('paints a tool as its family in hand, lit by its tier; the starter plain', () => {
    expect(heldToolPiece({ kind: 'pickaxe', definitionId: 'pickaxe-3', tier: 3, starter: false })).toEqual({ slot: 'weapon', kind: 'pickaxe', style: 'infernal', rarity: 'epic' });
    expect(heldToolPiece({ kind: 'pickaxe', definitionId: 'starter-pickaxe', tier: 1, starter: true })).toEqual({ slot: 'weapon', kind: 'pickaxe', style: 'neutral', rarity: 'common' });
    expect(heldToolPiece({ kind: 'rod', definitionId: 'seam-rod', tier: 2, starter: false })).toEqual({ slot: 'weapon', kind: 'rod', style: 'infernal', rarity: 'rare' });
  });

  it('builds the per-activity set, leaving out what is not held, with a stable key', () => {
    const pieces = heldToolPieces({
      definitionIds: ['starter-pickaxe', 'pickaxe-2', 'starter-sickle'],
      levels: { mining: 12, woodcutting: 1, foraging: 1, fishing: 1 },
      hasRod: id => id === 'worn-rod',
    });
    expect(Object.keys(pieces).sort()).toEqual(['pickaxe', 'rod', 'sickle']);
    expect(pieces.pickaxe?.rarity).toBe('rare');
    expect(heldToolsKey(pieces)).toBe('pickaxe:infernal:rare|sickle:neutral:common|rod:neutral:common');
    expect(heldToolsKey({})).toBe('');
  });
});
