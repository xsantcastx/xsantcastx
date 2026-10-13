/**
 * npc-quest.service.spec.ts — chain gating, claiming, and what survives a reload.
 *
 * The service reads nine other services. Standing all nine up would test the
 * wiring rather than the logic, so every one is a stub and the tests are about
 * the four things that are genuinely this service's own: a step is invisible
 * until its predecessor is claimed; a claim pays once; the receipt is written
 * before the payout; and a receipt for a step that no longer exists does not
 * jam the chain behind it.
 */
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { XpService } from '../gamification/xp.service';
import { QuestService } from '../quests/quest.service';
import { EconomyService } from '../economy/economy.service';
import { ComboService } from '../economy/combo.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { InventoryService } from '../rpg/inventory.service';
import { CollectionService } from '../collection/collection.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { NPC_KEY, NpcQuestService } from './npc-quest.service';
import { NPC_CHAINS } from './npc-quest.model';
import { DelveLoreService } from '../delve/delve-lore.service';

/** The world, as a plain object every stub reads from. */
interface World {
  level: number;
  achievements: Set<string>;
  runeStrikes: number;
  runesUnique: number;
  runewords: number;
  comboBest: number;
  items: number;
  rarities: Set<string>;
  goldEarned: number;
  eggs: number;
  collection: number;
  questsCompleted: number;
  lifetime: number;
}

function world(): World {
  return {
    level: 1, achievements: new Set(), runeStrikes: 0, runesUnique: 0,
    runewords: 0, comboBest: 0, items: 0, rarities: new Set(), goldEarned: 0,
    eggs: 0, collection: 0, questsCompleted: 0, lifetime: 0,
  };
}

describe('NpcQuestService', () => {
  let w: World;
  let store: Map<string, string>;
  let paid: { gold: number[]; xp: number[]; titles: string[]; cosmetics: string[]; achievements: string[]; items: string[] };
  let xpSnapshot$: BehaviorSubject<unknown>;
  let board$: BehaviorSubject<unknown>;
  let svc: NpcQuestService;
  let stacks$: BehaviorSubject<Record<string, number>>;
  let inscribed$: BehaviorSubject<ReadonlySet<string>>;
  let consumed: Set<string>;
  /** The rehydrate hook cloud save calls after a merge. Captured on register. */
  let rehydrate: () => void;

  beforeEach(() => {
    w = world();
    store = new Map();
    paid = { gold: [], xp: [], titles: [], cosmetics: [], achievements: [], items: [] };
    xpSnapshot$ = new BehaviorSubject<unknown>({ level: { level: 1 } });
    board$ = new BehaviorSubject<unknown>({ totalCompleted: 0 });
    stacks$ = new BehaviorSubject<Record<string, number>>({});
    inscribed$ = new BehaviorSubject<ReadonlySet<string>>(new Set());
    consumed = new Set();

    TestBed.configureTestingModule({
      providers: [
        NpcQuestService,
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (k: string) => store.get(k) ?? null,
            write: (k: string, v: unknown) => store.set(k, JSON.stringify(v)),
            remove: (k: string) => store.delete(k),
          },
        },
        {
          provide: LocalSaveRegistry,
          useValue: {
            register: (_k: string, owner: { rehydrate: () => void }) => { rehydrate = owner.rehydrate; },
          },
        },
        {
          provide: XpService,
          useValue: {
            snapshot$: xpSnapshot$,
            get snapshot() { return { level: { level: w.level } }; },
            hasAchievement: (id: string) => w.achievements.has(id),
            claimAchievement: (id: string) => { paid.achievements.push(id); return true; },
            award: (_t: string, o: { amount: number }) => paid.xp.push(o.amount),
          },
        },
        {
          provide: QuestService,
          useValue: {
            board$,
            get board() { return { totalCompleted: w.questsCompleted }; },
            lifetimeObserved: () => w.lifetime,
          },
        },
        {
          provide: EconomyService,
          useValue: {
            get snapshot() { return { totalGoldEarned: w.goldEarned }; },
            earnGold: (n: number) => { paid.gold.push(n); return n; },
            grantCosmetic: (id: string, variant: string) => {
              if (id === 'title-prefix') paid.titles.push(variant);
              else paid.cosmetics.push(`${id}/${variant}`);
              return true;
            },
          },
        },
        { provide: ComboService, useValue: { get best() { return w.comboBest; } } },
        {
          provide: RuneForgeService,
          useValue: {
            get uniqueFound() { return w.runesUnique; },
            get totalStrikes() { return w.runeStrikes; },
            get craftedCount() { return w.runewords; },
            countOf: () => 0,
          },
        },
        {
          provide: InventoryService,
          useValue: {
            get count() { return w.items; },
            hasRarity: (r: string) => w.rarities.has(r),
            add: (i: { definitionId?: string }) => { paid.items.push(i.definitionId ?? '?'); return i; },
            init: () => undefined,
            snapshot$: stacks$,
            stackOf: (id: string) => stacks$.value[id] ?? 0,
            consumeStacks: (mutationId: string, inputs: { id: string; count: number }[]) => {
              if (consumed.has(mutationId)) return { ok: true, replayed: true };
              if (inputs.some(i => (stacks$.value[i.id] ?? 0) < i.count)) return { ok: false, code: 'missing' };
              consumed.add(mutationId);
              const next = { ...stacks$.value };
              for (const i of inputs) next[i.id] -= i.count;
              stacks$.next(next);
              return { ok: true, replayed: false };
            },
          },
        },
        {
          provide: DelveLoreService,
          useValue: { inscription$: inscribed$, inscriptions: () => inscribed$.value },
        },
        { provide: CollectionService, useValue: { get completion() { return { found: w.collection, total: 100, percent: 0 }; } } },
        { provide: EasterEggService, useValue: { get foundCount() { return w.eggs; } } },
      ],
    });

    svc = TestBed.inject(NpcQuestService);
    svc.init();
  });

  /** Push the world forward, then make the service look at it again. */
  function settle(): void {
    xpSnapshot$.next({ level: { level: w.level } });
  }

  it('offers only the first step of each chain to a new visitor', () => {
    for (const npcId of Object.keys(NPC_CHAINS) as (keyof typeof NPC_CHAINS)[]) {
      const chain = svc.chains[npcId];
      expect(chain.done).withContext(npcId).toBe(0);
      expect(chain.active?.id).withContext(npcId).toBe(NPC_CHAINS[npcId][0].id);
    }
  });

  it('reads progress off the live ledgers rather than a stored copy', () => {
    expect(svc.chains['kael'].active!.observed).toBe(0);
    w.runeStrikes = 1;
    settle();
    expect(svc.chains['kael'].active!.observed).toBe(1);
    expect(svc.chains['kael'].active!.turnInReady).toBe(true);
  });

  it('raises the offer indicator before any progress and the turn-in one after', () => {
    expect(svc.chains['kael'].offerReady).toBe(true);
    expect(svc.chains['kael'].turnInReady).toBe(false);

    w.runeStrikes = 1;
    settle();
    expect(svc.chains['kael'].offerReady).toBe(false);
    expect(svc.chains['kael'].turnInReady).toBe(true);
  });

  it('refuses a claim on an unfinished step', () => {
    expect(svc.claim('kael-1')).toBe(false);
    expect(paid.gold).toEqual([]);
  });

  it('refuses a claim on a step that is not the chain\'s active one', () => {
    w.comboBest = 10_000;
    settle();
    // Step two is complete by the world state, but step one has not been claimed.
    expect(svc.claim('kael-2')).toBe(false);
    expect(paid.gold).toEqual([]);
  });

  it('pays exactly once and then advances the chain', () => {
    w.runeStrikes = 1;
    settle();

    expect(svc.claim('kael-1')).toBe(true);
    // Economy v3: max(authored × ρ, N s of income); the fake has no income.
    expect(paid.gold).toEqual([Math.round(NPC_CHAINS['kael'][0].reward.gold * 0.06)]);
    expect(svc.chains['kael'].done).toBe(1);
    expect(svc.chains['kael'].active!.id).toBe('kael-2');

    // Every one of the three guards, one after another.
    expect(svc.claim('kael-1')).toBe(false);
    expect(paid.gold.length).toBe(1);
  });

  it('pays the whole reward — Gold, XP, item, title, cosmetic, achievement', () => {
    // Walk the Merchant to their capstone, which is the step that carries a
    // title and an achievement, and check the payout from step two as well
    // because that is the one with an item on it.
    w.goldEarned = 6_000_000_000;
    settle();
    expect(svc.claim('merchant-1')).toBe(true);
    expect(svc.claim('merchant-2')).toBe(true);
    expect(paid.items).toEqual(['keeper-signet']);

    w.items = 25;
    settle();
    expect(svc.claim('merchant-3')).toBe(true);
    expect(paid.titles).toEqual(['the-solvent']);

    w.goldEarned = 500_000_000_000;
    settle();
    expect(svc.claim('merchant-4')).toBe(true);
    expect(paid.cosmetics).toEqual(['cursor-trail/eclipse']);

    w.rarities.add('mythic');
    settle();
    expect(svc.claim('merchant-5')).toBe(true);
    expect(paid.titles).toEqual(['the-solvent', 'goldmouth']);
    expect(paid.achievements).toEqual(['npc-merchant-chain']);
    expect(svc.chains['merchant'].active).toBeNull();
    expect(svc.chains['merchant'].done).toBe(5);
  });

  /*
   * "At this rarity or above". A Singular drop has to satisfy a mythic ask, or
   * the rarest object in the game would be worth less than the second-rarest.
   */
  it('accepts a rarity above the one an objective names', () => {
    w.rarities.add('singular');
    settle();
    // merchant-5 is the mythic ask; walk the chain to it.
    w.goldEarned = 500_000_000_000;
    w.items = 25;
    settle();
    for (const id of ['merchant-1', 'merchant-2', 'merchant-3', 'merchant-4']) {
      expect(svc.claim(id)).withContext(id).toBe(true);
    }
    expect(svc.chains['merchant'].active!.turnInReady).toBe(true);
  });

  it('writes the receipt to storage before it pays', () => {
    w.runeStrikes = 1;
    settle();
    svc.claim('kael-1');
    expect(JSON.parse(store.get(NPC_KEY)!).claimed).toContain('kael-1');
  });

  /*
   * The path cloud save actually takes: a merge writes a blob under this
   * service's feet and calls the hook it registered. Without the hook, the next
   * `persist()` would write this device's in-memory copy over the merged one and
   * a step claimed on a phone would be un-claimed by a desktop.
   */
  it('adopts a blob written under it by a cloud merge', () => {
    expect(svc.chains['kael'].done).toBe(0);
    store.set(NPC_KEY, JSON.stringify({ version: 1, claimed: ['kael-1'], seen: [] }));
    rehydrate();
    expect(svc.chains['kael'].done).toBe(1);
    expect(svc.chains['kael'].active!.id).toBe('kael-2');
  });

  /*
   * The one storage rule with teeth. A receipt naming a step that a later build
   * renamed would otherwise sit in the array forever, counted by `done`, and
   * jam the chain one place further along than the visitor has actually reached.
   */
  it('drops receipts for steps that no longer exist', () => {
    store.set(NPC_KEY, JSON.stringify({ version: 1, claimed: ['kael-1', 'retired-step'], seen: [] }));
    rehydrate();
    expect(svc.chains['kael'].done).toBe(1);
    expect(svc.chains['kael'].active!.id).toBe('kael-2');
  });

  it('remembers heard lines and refuses to grow past its cap', () => {
    svc.markSeen('kael:abc');
    svc.markSeen('kael:abc');
    expect([...svc.seenLines]).toEqual(['kael:abc']);
    expect(JSON.parse(store.get(NPC_KEY)!).seen).toEqual(['kael:abc']);
  });

  it('publishes the active step ids for the dialogue triggers', () => {
    expect(svc.activeStepIds.has('kael-1')).toBe(true);
    expect(svc.activeStepIds.has('kael-2')).toBe(false);
  });

  it('wipes every receipt on reset', () => {
    w.runeStrikes = 1;
    settle();
    svc.claim('kael-1');
    svc.reset();
    expect(svc.chains['kael'].done).toBe(0);
    expect(store.has(NPC_KEY)).toBe(false);
  });

  describe('Delve missions', () => {
    const mission = (id: string) => svc.missions.find(m => m.mission.id === id)!;

    it('consumes the delivery, pays once, and unlocks the recipe', () => {
      expect(svc.isRecipeUnlocked('craft-nullthorn-staff')).toBe(false);
      stacks$.next({ 'shadow-root-cutting': 4 });
      expect(mission('delve-verrin-shadow').turnInReady).toBe(true);
      expect(svc.claimMission('delve-verrin-shadow')).toBe(true);
      expect(stacks$.value['shadow-root-cutting']).toBe(1);
      expect(paid.gold).toEqual([1_200]); // economy v3: 20,000 × ρ floor
      expect(svc.isRecipeUnlocked('craft-nullthorn-staff')).toBe(true);
      // Claimed is claimed: no second payout even with cuttings in the bag.
      stacks$.next({ 'shadow-root-cutting': 9 });
      expect(svc.claimMission('delve-verrin-shadow')).toBe(false);
      expect(paid.gold.length).toBe(1);
      expect(JSON.parse(store.get(NPC_KEY)!).claimed).toContain('delve-verrin-shadow');
    });

    it('refuses a short delivery', () => {
      stacks$.next({ 'slag-fragment': 40 });
      expect(svc.claimMission('delve-kael-seam')).toBe(false);
      expect(mission('delve-kael-seam').nextStep).toContain('1 more');
    });

    it('lets the glowcap order repeat, counting each fill', () => {
      stacks$.next({ glowcap: 10 });
      expect(svc.claimMission('delve-merchant-glowcaps')).toBe(true);
      expect(svc.claimMission('delve-merchant-glowcaps')).toBe(true);
      expect(svc.claimMission('delve-merchant-glowcaps')).toBe(false);
      expect(mission('delve-merchant-glowcaps').timesDone).toBe(2);
      expect(JSON.parse(store.get(NPC_KEY)!).repeats).toEqual({ 'delve-merchant-glowcaps': 2 });
    });

    it('keeps the Fracture locked until the other three are done', () => {
      stacks$.next({ 'godforge-fragment': 1 });
      expect(mission('delve-fracture').locked).toBe(true);
      expect(svc.claimMission('delve-fracture')).toBe(false);
    });

    it('reads the Archivist milestones off copied inscriptions', () => {
      inscribed$.next(new Set(['roots-keepers-tally', 'basalt-kaels-mark', 'magma-warden-oath']));
      expect(mission('delve-archivist-words-1').turnInReady).toBe(true);
      expect(mission('delve-archivist-words-2').locked).toBe(true);
      expect(svc.claimMission('delve-archivist-words-1')).toBe(true);
      expect(mission('delve-archivist-words-2').locked).toBe(false);
      expect(mission('delve-archivist-words-2').observed).toBe(3);
    });
  });
});
