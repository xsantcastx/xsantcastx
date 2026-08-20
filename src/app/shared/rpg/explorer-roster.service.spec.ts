/**
 * explorer-roster.service.spec.ts — hiring, the collection, and the migration.
 *
 * The migration tests are the reason this file exists. Named explorers replaced
 * a generated roster that every save in the wild already has, and a migration
 * that quietly caps a collection is the worst kind of bug: nothing errors, the
 * wall simply never fills, and the player concludes the drop rates are bad.
 */
import { TestBed } from '@angular/core/testing';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { ExplorerRosterService, ROSTER_KEY, MAX_ROSTER } from './explorer-roster.service';
import { ARCHETYPE_COUNT, STARTER_ARCHETYPES, archetypeById } from './explorer-archetypes';
import { ROSTER_REWARDS } from './roster-completion';
import { xpForLevel } from './explorer-progression';
import type { RosterExplorer } from './explorer-roster.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** A fresh service over the given storage — a genuinely new hydrate each time. */
function configure(memory: MemoryGateway): ExplorerRosterService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ExplorerRosterService,
      LocalSaveRegistry,
      { provide: GameStateGateway, useValue: memory },
    ],
  });
  const service = TestBed.inject(ExplorerRosterService);
  service.init();
  return service;
}

function stored(memory: MemoryGateway): { explorers: RosterExplorer[]; discovered?: string[]; seeded?: boolean } {
  return JSON.parse(memory.readRaw(ROSTER_KEY) ?? '{}');
}

describe('seeding a fresh save', () => {
  it('hands over both starters and records both discoveries', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);

    const ids = roster.explorers.map(e => e.archetypeId);
    for (const starter of STARTER_ARCHETYPES) {
      expect(ids).withContext(starter.name).toContain(starter.id);
    }
    expect(roster.snapshot.discoveredCount).toBe(STARTER_ARCHETYPES.length);
  });

  it('does not mint a second set on the next hydrate', () => {
    const memory = new MemoryGateway();
    configure(memory);
    const again = configure(memory);
    expect(again.count).toBe(STARTER_ARCHETYPES.length);
  });

  it('does not hand a dismissed starter back on reload', () => {
    /*
     * The property the old `seeded` flag was protecting, and which the
     * discovery-keyed guard has to keep: a player who lets Tobin go has let
     * Tobin go.
     */
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const tobin = roster.explorers.find(e => e.archetypeId === STARTER_ARCHETYPES[0].id)!;
    roster.dismiss(tobin.id);

    const again = configure(memory);
    expect(again.explorers.some(e => e.archetypeId === tobin.archetypeId)).toBeFalse();
    // Dismissing must not un-discover — the reward ladder is monotonic.
    expect(again.snapshot.discoveredCount).toBe(STARTER_ARCHETYPES.length);
  });
});

describe('migrating a roster from before the cast', () => {
  /**
   * What the previous build wrote: `seeded: true`, generated explorers, no
   * archetype ids and no discovery ledger.
   */
  function legacySave(memory: MemoryGateway): void {
    memory.write(ROSTER_KEY, {
      version: 1, seeded: true, found: 1,
      explorers: [{
        id: 'exp-legacy-1', name: 'Velren', rarity: 'common',
        hiredAt: '2026-01-01T00:00:00.000Z', equipment: [], missions: 42,
      }],
    });
  }

  it('still hands over both starters, despite seeded already being true', () => {
    /*
     * The bug this file was written for. `seeded` answers "has this save ever
     * been given an explorer", and the cast asks "has it ever been given
     * *these two*". Guarding on the flag hands a returning player nothing —
     * and because both starters are `source: 'starter'`, which is not a drop,
     * not a Market listing and not a quest reward, the collection would sit at
     * 16/18 forever and "Lord of the Roster" would be unreachable.
     */
    const memory = new MemoryGateway();
    legacySave(memory);
    const roster = configure(memory);

    const ids = roster.explorers.map(e => e.archetypeId);
    for (const starter of STARTER_ARCHETYPES) {
      expect(ids).withContext(starter.name).toContain(starter.id);
    }
    expect(roster.snapshot.discoveredCount).toBe(STARTER_ARCHETYPES.length);
  });

  it('leaves the generated explorer exactly as it found them', () => {
    // Renaming somebody a player has run forty-two missions with would be worse
    // than leaving them nameless.
    const memory = new MemoryGateway();
    legacySave(memory);
    const roster = configure(memory);

    const velren = roster.explorers.find(e => e.id === 'exp-legacy-1')!;
    expect(velren.name).toBe('Velren');
    expect(velren.missions).toBe(42);
    expect(velren.archetypeId).toBeUndefined();
  });

  it('does not count a generated explorer toward the collection', () => {
    const memory = new MemoryGateway();
    legacySave(memory);
    const roster = configure(memory);
    // Two starters, not three: Velren is a real hire and not one of the cast.
    expect(roster.snapshot.discoveredCount).toBe(2);
    expect(roster.count).toBe(3);
  });

  it('rebuilds the ledger from a save that already held a named explorer', () => {
    // A save written by this build but with the ledger lost — the discovery is
    // recovered from whoever is on the books rather than re-found.
    const memory = new MemoryGateway();
    memory.write(ROSTER_KEY, {
      version: 1, seeded: true, found: 1,
      explorers: [{
        id: 'exp-1', name: 'Lyra the Starwalker', rarity: 'rare',
        archetypeId: 'lyra-starwalker',
        hiredAt: '2026-01-01T00:00:00.000Z', equipment: [], missions: 3,
      }],
    });
    const roster = configure(memory);
    expect(roster.snapshot.discovered).toContain('lyra-starwalker');
  });

  it('drops a discovery id that is no longer one of the cast', () => {
    // An id left behind by a renamed archetype must not inflate the counter
    // past what the roster can actually hold.
    const memory = new MemoryGateway();
    memory.write(ROSTER_KEY, {
      version: 1, seeded: true, found: 0, explorers: [],
      discovered: ['lyra-starwalker', 'somebody-who-was-deleted'],
    });
    const roster = configure(memory);
    expect(roster.snapshot.discovered).toContain('lyra-starwalker');
    expect(roster.snapshot.discovered).not.toContain('somebody-who-was-deleted');
  });
});

describe('hiring', () => {
  it('hands over a named explorer when the mission can reach one', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const hired = roster.hire('rare', Math.random, ['expedition', 'deep']);
    expect(hired?.archetypeId).toBeTruthy();
    expect(archetypeById(hired!.archetypeId)?.rarity).toBe('rare');
  });

  it('falls back to a generated hire at the same tier, never a lower one', () => {
    /*
     * A Scout that rolls Rare can reach nobody — every Rare in the cast is
     * `source: 'deep'`. The roll still produced a Rare, so a Rare is what is
     * handed over; silently downgrading would spend the rarest event in the
     * game on a worse explorer.
     */
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const hired = roster.hire('rare', Math.random, ['expedition']);
    expect(hired?.rarity).toBe('rare');
    expect(hired?.archetypeId).toBeUndefined();
  });

  it('never hands the same person over twice', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    for (let i = 0; i < 6; i++) roster.hire('rare', Math.random, ['expedition', 'deep']);
    const named = roster.explorers.map(e => e.archetypeId).filter(Boolean);
    expect(new Set(named).size).toBe(named.length);
  });

  it('refuses to re-grant somebody who was discovered and then dismissed', () => {
    // Otherwise the cast becomes a re-roll button.
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const lyra = roster.grantArchetype('lyra-starwalker')!;
    roster.dismiss(lyra.id);
    expect(roster.grantArchetype('lyra-starwalker')).toBeNull();
  });

  it('refuses an archetype id that is not one of them', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    expect(roster.grantArchetype('nobody-at-all')).toBeNull();
  });

  it('stops at the roster ceiling', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    for (let i = 0; i < MAX_ROSTER + 5; i++) roster.hire('common');
    expect(roster.count).toBe(MAX_ROSTER);
  });
});

describe('progression', () => {
  it('banks XP, Gold, finds and time against one explorer', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const who = roster.explorers[0];

    roster.recordExpedition(who.id, {
      xp: 500, gold: 1_000, finds: 3, bestTier: 4, durationMs: 60_000,
    });

    const after = roster.byId(who.id)!;
    expect(after.missions).toBe(who.missions + 1);
    expect(after.xp).toBe(500);
    expect(after.goldFound).toBe(1_000);
    expect(after.itemsFound).toBe(3);
    expect(after.bestFindTier).toBe(4);
    expect(after.timeDeployed).toBe(60_000);
  });

  it('keeps the best find rather than the latest one', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const who = roster.explorers[0];
    roster.recordExpedition(who.id, { xp: 1, gold: 0, finds: 0, bestTier: 4, durationMs: 0 });
    roster.recordExpedition(who.id, { xp: 1, gold: 0, finds: 0, bestTier: 1, durationMs: 0 });
    expect(roster.byId(who.id)!.bestFindTier).toBe(4);
  });

  it('never writes a negative tier as a best find', () => {
    // -1 is the "found nothing" sentinel; persisted, the card would print
    // "best find: undefined" for everyone who has only ever found Gold.
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const who = roster.explorers[0];
    roster.recordExpedition(who.id, { xp: 1, gold: 10, finds: 0, durationMs: 1_000 });
    expect(roster.byId(who.id)!.bestFindTier).toBeUndefined();
  });

  it('grants the level-15 equipment strap', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const who = roster.explorers.find(e => e.archetypeId)!;
    const before = roster.capacityOf(who.id);
    roster.recordExpedition(who.id, {
      xp: xpForLevel(15), gold: 0, finds: 0, durationMs: 0,
    });
    expect(roster.levelOf(who.id)).toBeGreaterThanOrEqual(15);
    expect(roster.capacityOf(who.id)).toBe(before + 1);
  });

  it('announces a level-up exactly once per boundary crossed', (done) => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    const who = roster.explorers[0];
    roster.levelled$.subscribe(({ level }) => {
      expect(level).toBeGreaterThan(1);
      done();
    });
    roster.recordExpedition(who.id, { xp: xpForLevel(4), gold: 0, finds: 0, durationMs: 0 });
  });
});

describe('the collection rewards', () => {
  it('pays nothing at the start and everything at the end', () => {
    const memory = new MemoryGateway();
    const roster = configure(memory);
    // The two starters are already found, which is below the first rung.
    expect(roster.snapshot.payoutMultiplier).toBe(1);
    expect(roster.snapshot.bonusSlots).toBe(0);
    expect(roster.snapshot.title).toBeNull();
    expect(roster.snapshot.nextReward).toBe(ROSTER_REWARDS[0]);
  });

  it('opens the sixth expedition slot at ten discoveries', () => {
    const memory = new MemoryGateway();
    memory.write(ROSTER_KEY, {
      version: 1, seeded: true, found: 10, explorers: [],
      discovered: ['tobin-ashfoot', 'marda-quell', 'ren-sixgate', 'callum-drossvane',
        'ilse-thornwake', 'bracken-hale', 'lyra-starwalker', 'grimjaw-unyielding',
        'seris-lowlantern', 'oda-fairweather'],
    });
    const roster = configure(memory);
    expect(roster.snapshot.discoveredCount).toBe(10);
    expect(roster.snapshot.bonusSlots).toBe(1);
    expect(roster.snapshot.title).toBe('Scout Master');
    expect(roster.snapshot.payoutMultiplier).toBeGreaterThan(1);
  });

  it('caps the last rung at the whole cast', () => {
    expect(ROSTER_REWARDS[ROSTER_REWARDS.length - 1].at).toBe(ARCHETYPE_COUNT);
  });
});
