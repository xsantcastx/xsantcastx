/**
 * npc.model.spec.ts — the cast, the trigger table, and who stands where.
 *
 * Everything under test is pure, so there is no TestBed here and no DOM. The
 * gates worth having are the ones a hand edit to the dialogue table can break
 * silently: an NPC with no idle pool goes mute on their own page and nothing
 * throws, and a trigger naming a retired NPC is simply never reached.
 */
import {
  DIALOGUE,
  DialogueContext,
  NPCS,
  NpcId,
  lineKey,
  normalisePath,
  npcById,
  npcForPage,
  pathMatches,
  pickLine,
  timeOfDayAt,
  triggerApplies,
  triggersFor,
} from './npc.model';

function ctx(over: Partial<DialogueContext> = {}): DialogueContext {
  return {
    path: '/world',
    level: 1,
    timeOfDay: 'afternoon',
    comboCount: 0,
    achievements: new Set<string>(),
    equipped: new Set<string>(),
    activeQuests: new Set<string>(),
    ...over,
  };
}

describe('the cast', () => {
  it('has six characters with unique ids', () => {
    expect(NPCS.length).toBe(6);
    expect(new Set(NPCS.map(n => n.id)).size).toBe(6);
  });

  it('gives every character a distinct portrait id', () => {
    const ids = NPCS.map(n => n.artId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hides exactly one character behind a gate', () => {
    expect(NPCS.filter(n => n.hidden).map(n => n.id)).toEqual(['nameless']);
  });
});

describe('the dialogue table', () => {
  it('names a real character on every row', () => {
    const live = new Set(NPCS.map(n => n.id));
    expect(DIALOGUE.filter(t => !live.has(t.npcId)).map(t => t.npcId)).toEqual([]);
  });

  /*
   * The one that matters. A priority-0, condition-free row is what plays when
   * nothing more specific is true, and a character without one is silent on
   * their own page with no error to show for it — which is exactly the failure
   * mode a spec has to catch, because it looks like "the feature is off".
   */
  it('gives every character an unconditional idle pool', () => {
    for (const npc of NPCS) {
      const idle = DIALOGUE.filter(t => t.npcId === npc.id && !t.conditions && t.page === '*');
      expect(idle.length).withContext(`${npc.id} has no idle pool`).toBeGreaterThan(0);
    }
  });

  it('authors at least eight idle lines per character', () => {
    for (const npc of NPCS) {
      const lines = DIALOGUE
        .filter(t => t.npcId === npc.id && !t.conditions)
        .flatMap(t => t.lines);
      expect(lines.length).withContext(`${npc.id}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('never repeats a line within one character', () => {
    for (const npc of NPCS) {
      const lines = DIALOGUE.filter(t => t.npcId === npc.id).flatMap(t => t.lines);
      expect(new Set(lines).size).withContext(`${npc.id}`).toBe(lines.length);
    }
  });

  it('writes no empty lines', () => {
    expect(DIALOGUE.flatMap(t => t.lines).filter(l => !l.trim())).toEqual([]);
  });
});

describe('paths', () => {
  it('strips query and fragment and the trailing slash', () => {
    expect(normalisePath('/market?tab=gold#top')).toBe('/market');
    expect(normalisePath('/market/')).toBe('/market');
    expect(normalisePath('/')).toBe('/');
    expect(normalisePath('')).toBe('/');
  });

  /*
   * Segment-aware, which is the difference between /forge claiming /forge/runes
   * (right) and /market claiming /marketplace (wrong). A bare startsWith gets
   * the first one right and the second one wrong, and the second one is silent.
   */
  it('matches on segment boundaries, not on characters', () => {
    expect(pathMatches('/forge/runes', '/forge')).toBe(true);
    expect(pathMatches('/forge', '/forge')).toBe(true);
    expect(pathMatches('/marketplace', '/market')).toBe(false);
    expect(pathMatches('/anything', '/')).toBe(true);
  });
});

describe('who stands where', () => {
  const on = (path: string) => npcForPage(path)?.id ?? null;

  it('puts each quest giver on their own surface', () => {
    expect(on('/codex')).toBe('archivist');
    expect(on('/market')).toBe('merchant');
    expect(on('/gambler')).toBe('merchant');
    expect(on('/exchange')).toBe('merchant');
    expect(on('/forge/runes')).toBe('kael');
    expect(on('/character')).toBe('kael');
    expect(on('/world')).toBe('kael');
  });

  /*
   * The specificity rule, stated as the case it exists for: Kael claims /world
   * and Aureth claims /world/realms/luminous, and without a longest-prefix wins
   * rule the Forge Keeper would speak over the goddess in her own realm.
   */
  it('lets the longer path prefix win', () => {
    expect(on('/world/realms/luminous')).toBe('aureth');
    expect(on('/world/realms/umbral')).toBe('verrin');
  });

  it('staffs the halls each character belongs to', () => {
    expect(on('/world/trials')).toBe('verrin');
    expect(on('/world/quests')).toBe('archivist');
    expect(on('/sanctum')).toBe('kael');
    expect(on('/world/realms/infernal')).toBe('kael');
  });

  /*
   * Retired product trees. Every /tools route redirects to /world, so nothing
   * should ever be *asked* about one — but the selector must answer null rather
   * than fall through to whoever claims the shortest prefix.
   */
  it('leaves unclaimed pages empty', () => {
    expect(on('/tools/box-shadow-generator')).toBeNull();
    expect(on('/arena/realm-rush')).toBeNull();
    expect(on('/nowhere')).toBeNull();
  });

  /*
   * The Nameless is reachable only through the gate in NpcDialogueService.
   * If the ordinary route match could ever return them, the gate would be
   * decoration — so this asserts the route match cannot, on the one path they
   * would otherwise win outright.
   */
  it('never surfaces a hidden character by route alone', () => {
    for (const path of ['/', '/world', '/codex', '/market', '/nowhere']) {
      expect(on(path)).not.toBe('nameless');
    }
  });
});

describe('trigger conditions', () => {
  const trigger = (conditions: Record<string, unknown>) => ({
    npcId: 'kael' as NpcId,
    page: '*',
    priority: 0,
    lines: ['x'],
    conditions,
  });

  it('gates on level', () => {
    expect(triggerApplies(trigger({ minLevel: 10 }), ctx({ level: 9 }))).toBe(false);
    expect(triggerApplies(trigger({ minLevel: 10 }), ctx({ level: 10 }))).toBe(true);
  });

  it('gates on the live combo', () => {
    expect(triggerApplies(trigger({ comboCount: 50 }), ctx({ comboCount: 49 }))).toBe(false);
    expect(triggerApplies(trigger({ comboCount: 50 }), ctx({ comboCount: 50 }))).toBe(true);
  });

  it('gates on time of day', () => {
    expect(triggerApplies(trigger({ timeOfDay: 'night' }), ctx({ timeOfDay: 'morning' }))).toBe(false);
    expect(triggerApplies(trigger({ timeOfDay: 'night' }), ctx({ timeOfDay: 'night' }))).toBe(true);
  });

  it('gates on an achievement, an equipped item and a live quest', () => {
    expect(triggerApplies(trigger({ hasAchievement: 'a' }), ctx())).toBe(false);
    expect(triggerApplies(trigger({ hasAchievement: 'a' }), ctx({ achievements: new Set(['a']) }))).toBe(true);
    expect(triggerApplies(trigger({ hasItem: 'basalt-edge' }), ctx())).toBe(false);
    expect(triggerApplies(trigger({ hasItem: 'basalt-edge' }), ctx({ equipped: new Set(['basalt-edge']) }))).toBe(true);
    expect(triggerApplies(trigger({ questActive: 'kael-1' }), ctx())).toBe(false);
    expect(triggerApplies(trigger({ questActive: 'kael-1' }), ctx({ activeQuests: new Set(['kael-1']) }))).toBe(true);
  });

  it('requires every named condition, not any of them', () => {
    const t = trigger({ minLevel: 10, timeOfDay: 'night' });
    expect(triggerApplies(t, ctx({ level: 20, timeOfDay: 'morning' }))).toBe(false);
    expect(triggerApplies(t, ctx({ level: 20, timeOfDay: 'night' }))).toBe(true);
  });

  it('orders applicable triggers by priority, highest first', () => {
    const found = triggersFor('kael', ctx({ path: '/forge/runes', comboCount: 200, timeOfDay: 'night' }));
    expect(found.length).toBeGreaterThan(1);
    for (let i = 1; i < found.length; i++) {
      expect(found[i - 1].priority).toBeGreaterThanOrEqual(found[i].priority);
    }
    // The combo row is the highest-priority thing Kael has; a 200 combo has to
    // outrank both the forge-page row and the night row.
    expect(found[0].priority).toBe(60);
  });

  it('always leaves every character something to say on their own page', () => {
    for (const npc of NPCS) {
      expect(triggersFor(npc.id, ctx()).length).withContext(`${npc.id}`).toBeGreaterThan(0);
    }
  });
});

describe('picking a line', () => {
  it('is stable for one seed, so a re-render does not swap the line', () => {
    const lines = ['a', 'b', 'c', 'd'];
    const first = pickLine(lines, new Set(), 'kael', '/world');
    for (let i = 0; i < 20; i++) {
      expect(pickLine(lines, new Set(), 'kael', '/world')).toBe(first);
    }
  });

  it('prefers a line this visitor has not heard', () => {
    const lines = ['a', 'b'];
    const seen = new Set([lineKey('kael', 'a')]);
    expect(pickLine(lines, seen, 'kael', '/world')).toBe('b');
  });

  /*
   * The whole reason the fallback exists: an NPC who has said everything must
   * keep talking. Returning null there would make a character go mute as a
   * *reward* for engaging with them.
   */
  it('falls back to the full pool once everything has been heard', () => {
    const lines = ['a', 'b'];
    const seen = new Set(lines.map(l => lineKey('kael', l)));
    expect(lines).toContain(pickLine(lines, seen, 'kael', '/world')!);
  });

  it('returns null only for an empty pool', () => {
    expect(pickLine([], new Set(), 'kael', '/world')).toBeNull();
  });

  it('keys a line to its character, so two NPCs never share a receipt', () => {
    expect(lineKey('kael', 'same words')).not.toBe(lineKey('aureth', 'same words'));
  });
});

describe('time of day', () => {
  const at = (h: number) => timeOfDayAt(new Date(2026, 7, 19, h, 0, 0));

  it('splits the local day at 5, 12, 17 and 22', () => {
    expect(at(0)).toBe('night');
    expect(at(4)).toBe('night');
    expect(at(5)).toBe('morning');
    expect(at(11)).toBe('morning');
    expect(at(12)).toBe('afternoon');
    expect(at(16)).toBe('afternoon');
    expect(at(17)).toBe('evening');
    expect(at(21)).toBe('evening');
    expect(at(22)).toBe('night');
    expect(at(23)).toBe('night');
  });
});

describe('npcById', () => {
  it('resolves every registered id and nothing else', () => {
    for (const npc of NPCS) expect(npcById(npc.id)?.id).toBe(npc.id);
    expect(npcById('nobody')).toBeUndefined();
  });
});
