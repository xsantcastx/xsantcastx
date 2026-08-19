/**
 * npc-quest.model.ts — the six chains, and how a step knows it is done.
 *
 * Each NPC offers an ordered chain. Step N is invisible until step N-1 has been
 * claimed, rewards escalate down the chain, and the five steps together tell one
 * story about that character. Nothing here is per-visitor: the chains are
 * constants, and a visitor's standing against them is derived every time by
 * `NpcQuestService`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY OBJECTIVES READ STATE RATHER THAN COUNT EVENTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The quest board next door counts events into buckets — a wiring service
 * reports "a tool was used", the buckets tally it, and quests read the tallies.
 * That is the right shape there, because a daily quest has to know what happened
 * *today* and there is nowhere else that fact lives.
 *
 * Chain steps do not. "Ten unique runes", "a million Gold earned", "a combo of
 * 666" are all already true or already false in a ledger some service owns, and
 * counting them a second time would create a number that can silently disagree
 * with the one on screen. So an objective here names a *reading*, not an event,
 * and `NpcQuestService.observe()` is the single place each reading is taken.
 *
 * The one exception is `quest-progress`, which delegates to the quest board's
 * lifetime buckets. Realm tool use genuinely is an event stream, it is already
 * being counted correctly, and re-counting it here would be the exact
 * disagreement this paragraph is about.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON THE CAPSTONES
 * ─────────────────────────────────────────────────────────────────────────────
 * The fifth step of each chain is deliberately at the edge of reachable —
 * Aureth's asks for the Void rune, which drops about once in two million
 * strikes, and the Nameless asks for a combo most people will never hold. They
 * are meant to be the thing you find out is possible rather than the thing you
 * plan an afternoon around. Steps one through four are all reachable in ordinary
 * play, and each one pays before the next is shown.
 *
 * Pure data and pure functions. No browser APIs.
 */
import { EnergyType } from '../gamification/gamification.model';
import { ItemRarity } from '../rpg/item.model';
import { QuestCondition } from '../quests/quest.model';
import { NpcId } from './npc.model';

/**
 * A reading that decides whether a step is complete.
 *
 * `count` is always a target the reading must reach or pass, so progress is
 * uniformly `min(observed, count) / count` and every step gets a bar for free.
 */
export type NpcObjective =
  /** Account level. */
  | { kind: 'level'; count: number }
  /** A banked achievement/egg id. Binary — `count` is implicitly 1. */
  | { kind: 'achievement'; id: string }
  /** Distinct runes ever found. */
  | { kind: 'runes-unique'; count: number }
  /** Lifetime anvil strikes. */
  | { kind: 'rune-strikes'; count: number }
  /** Runewords crafted. */
  | { kind: 'runewords'; count: number }
  /** The combo high-water mark, not the live run. */
  | { kind: 'combo-best'; count: number }
  /** Instances in the bag right now. */
  | { kind: 'items-owned'; count: number }
  /** Whether the bag holds anything at this rarity or above. */
  | { kind: 'item-rarity'; rarity: ItemRarity }
  /** Lifetime Gold earned, across every Eclipse. */
  | { kind: 'gold-earned'; count: number }
  /** Public Codex discoveries. */
  | { kind: 'eggs-found'; count: number }
  /** Distinct rows in the Collection Log. */
  | { kind: 'collection'; count: number }
  /** Quest board completions, all three ladders. */
  | { kind: 'quests-completed'; count: number }
  /** Delegated to the quest board's lifetime buckets. */
  | { kind: 'quest-progress'; condition: QuestCondition };

export interface NpcReward {
  /** Always paid. The floor of every step. */
  gold: number;
  /** Optional XP, fed to the NPC's own energy unless overridden. */
  xp?: number;
  energy?: EnergyType;
  /**
   * An existing equipment definition, minted at this rarity into the bag.
   *
   * Deliberately an existing definition rather than a new named unique. A new
   * unique is a painting, a drop-pool decision and a balance decision, and the
   * master plan is explicit that a vertical slice does not get to make three
   * unrelated ones at once. Minting a known definition at a chosen rarity gives
   * the step a real object with real rolled stats and adds no art debt.
   */
  item?: { defId: string; rarity: ItemRarity };
  /** A `title-prefix` cosmetic variant id. Granted, never sold. */
  title?: string;
  /** Any other cosmetic slot: catalogue id plus variant id. */
  cosmetic?: { id: string; variant: string };
  /** An egg id banked on claim, so the chain leaves a mark on the Codex wall. */
  achievement?: string;
  /** One line of codex text, shown in the claim card. */
  loreFragment?: string;
}

export interface NpcQuestStep {
  id: string;
  npcId: NpcId;
  title: string;
  /** What to do, plainly. This is the line the objective bar sits under. */
  description: string;
  /** The character's own words about it. This is the reason to read the card. */
  loreText: string;
  objective: NpcObjective;
  reward: NpcReward;
}

/**
 * The chains, in order. Index in the array *is* the step order.
 *
 * The Nameless has three rather than five on purpose: the chain is the encounter,
 * and an encounter that has five acts is a character rather than a warning.
 */
export const NPC_CHAINS: Readonly<Record<NpcId, readonly NpcQuestStep[]>> = {
  aureth: [
    {
      id: 'aureth-1',
      npcId: 'aureth',
      title: 'The Light Fades',
      description: 'Walk all five realm halls.',
      loreText: 'The light has to reach every realm or it is not light, it is a lamp. Go and see what it is failing to reach.',
      objective: {
        kind: 'quest-progress',
        condition: {
          type: 'page-visit',
          paths: [
            '/world/realms/luminous',
            '/world/realms/celestial',
            '/world/realms/infernal',
            '/world/realms/umbral',
            '/world/realms/verdant',
          ],
          count: 5,
        },
      },
      reward: { gold: 5_000, xp: 120, energy: 'aether' },
    },
    {
      id: 'aureth-2',
      npcId: 'aureth',
      title: 'Crystal Resonance',
      description: 'Strike the rune anvil five times.',
      loreText: 'Every rune is a note. Five of them is the first thing the lattice recognises as a voice.',
      objective: { kind: 'rune-strikes', count: 5 },
      reward: {
        gold: 15_000,
        xp: 300,
        energy: 'aether',
        item: { defId: 'relic-third-dawn', rarity: 'rare' },
      },
    },
    {
      id: 'aureth-3',
      npcId: 'aureth',
      title: "Dawn's Return",
      description: 'Reach level 10.',
      loreText: 'You have been carrying light for someone else. Grow until you are carrying your own.',
      objective: { kind: 'level', count: 10 },
      reward: { gold: 50_000, xp: 600, energy: 'aether', title: 'radiant' },
    },
    {
      id: 'aureth-4',
      npcId: 'aureth',
      title: 'The First Light',
      description: 'Record twenty entries in the Collection Log.',
      loreText: 'Twenty things held and named. That is the difference between finding and keeping, and only one of them is creation.',
      objective: { kind: 'collection', count: 20 },
      reward: {
        gold: 100_000,
        xp: 1_200,
        energy: 'aether',
        cosmetic: { id: 'cursor-trail', variant: 'aether' },
      },
    },
    {
      id: 'aureth-5',
      npcId: 'aureth',
      title: "Eclipse's End",
      description: 'Find the Void rune.',
      loreText:
        'There is one rune the Sun never made, and it is the only one that can end the Eclipse. Bring it to me and I will tell you what the first morning actually cost.',
      objective: { kind: 'achievement', id: 'rune-void-voice' },
      reward: {
        gold: 500_000,
        xp: 5_000,
        energy: 'aether',
        title: 'champion-of-light',
        achievement: 'npc-aureth-chain',
        loreFragment:
          'The Sun did not break. The Sun let go — and every realm since has been an argument about which piece was the real one.',
      },
    },
  ],

  verrin: [
    {
      id: 'verrin-1',
      npcId: 'verrin',
      title: 'What Light Discards',
      description: 'Walk the Umbral hall and the hall of trials.',
      loreText: 'Begin where the others stop looking. It is less crowded and the findings are better.',
      objective: {
        kind: 'quest-progress',
        condition: {
          type: 'page-visit',
          paths: ['/world/realms/umbral', '/world/trials'],
          count: 2,
        },
      },
      reward: { gold: 5_000, xp: 120, energy: 'nox' },
    },
    {
      id: 'verrin-2',
      npcId: 'verrin',
      title: 'The Hollow Ledger',
      description: 'Uncover ten hidden discoveries.',
      loreText: 'Ten secrets is the point at which a person stops finding them by accident.',
      objective: { kind: 'eggs-found', count: 10 },
      reward: {
        gold: 15_000,
        xp: 300,
        energy: 'nox',
        item: { defId: 'obsidian-heart', rarity: 'rare' },
      },
    },
    {
      id: 'verrin-3',
      npcId: 'verrin',
      title: 'Names for the Dark',
      description: 'Hold an item of epic quality.',
      loreText: 'The Nocturne build with what the light discards. Bring me something good enough that somebody threw it away on purpose.',
      objective: { kind: 'item-rarity', rarity: 'epic' },
      reward: { gold: 50_000, xp: 600, energy: 'nox', title: 'hollowed' },
    },
    {
      id: 'verrin-4',
      npcId: 'verrin',
      title: 'Everything Ends',
      description: 'Reach level 15.',
      loreText: 'You have grown. I mention it because growth is the loudest thing an ending listens for.',
      objective: { kind: 'level', count: 15 },
      reward: {
        gold: 100_000,
        xp: 1_200,
        energy: 'nox',
        cosmetic: { id: 'cursor-trail', variant: 'nox' },
      },
    },
    {
      id: 'verrin-5',
      npcId: 'verrin',
      title: 'The Last Silence',
      description: 'Hold a combo of 666.',
      loreText:
        'There is a number the forge does not like being counted to. Count to it. I want to see who else turns around.',
      objective: { kind: 'combo-best', count: 666 },
      reward: {
        gold: 500_000,
        xp: 5_000,
        energy: 'nox',
        title: 'the-hollow',
        achievement: 'npc-verrin-chain',
        loreFragment:
          'Verrin is not what waits at the end. Verrin is what walks beside you the whole way, keeping count, so the end has something accurate to read.',
      },
    },
  ],

  kael: [
    {
      id: 'kael-1',
      npcId: 'kael',
      title: 'Strike the Anvil',
      description: 'Strike the rune anvil once.',
      loreText: 'That is the whole lesson. Everything after this is the same lesson, louder.',
      objective: { kind: 'rune-strikes', count: 1 },
      reward: { gold: 5_000, xp: 120 },
    },
    {
      id: 'kael-2',
      npcId: 'kael',
      title: 'Hold the Rhythm',
      description: 'Reach a combo of 100.',
      loreText: 'A hundred strikes without a stumble. The forge starts listening somewhere around eighty.',
      objective: { kind: 'combo-best', count: 100 },
      reward: {
        gold: 15_000,
        xp: 300,
        item: { defId: 'basalt-edge', rarity: 'uncommon' },
      },
    },
    {
      id: 'kael-3',
      npcId: 'kael',
      title: 'What the Fire Keeps',
      description: 'Find ten different runes.',
      loreText: 'Ten. Not ten of one — ten kinds. The difference is the difference between a hoard and a craft.',
      objective: { kind: 'runes-unique', count: 10 },
      reward: { gold: 50_000, xp: 600, title: 'flamebound' },
    },
    {
      id: 'kael-4',
      npcId: 'kael',
      title: 'Four Times Rebuilt',
      description: 'Craft a Runeword.',
      loreText: 'Runes on their own are trinkets. Set together they are a decision. Make one.',
      objective: { kind: 'runewords', count: 1 },
      reward: {
        gold: 100_000,
        xp: 1_200,
        cosmetic: { id: 'xp-bar-skin', variant: 'molten' },
      },
    },
    {
      id: 'kael-5',
      npcId: 'kael',
      title: 'The Broken Flame',
      description: 'Earn ten million Gold, all told.',
      loreText:
        'Ten million. Not to have it — to have moved it. Then I will tell you what happened to the eye.',
      objective: { kind: 'gold-earned', count: 10_000_000 },
      reward: {
        gold: 500_000,
        xp: 5_000,
        title: 'forgeborn',
        achievement: 'npc-kael-chain',
        loreFragment:
          'Kael was the fifth Keeper and the only one who stayed. The other four are still in the walls, and that is why the forge holds heat the way it does.',
      },
    },
  ],

  archivist: [
    {
      id: 'archivist-1',
      npcId: 'archivist',
      title: 'First Fragment',
      description: 'Record five entries in the Collection Log.',
      loreText: 'Five is enough to prove you can be trusted with a shelf.',
      objective: { kind: 'collection', count: 5 },
      reward: { gold: 5_000, xp: 120, energy: 'aether' },
    },
    {
      id: 'archivist-2',
      npcId: 'archivist',
      title: 'Cross-Reference',
      description: 'Complete ten quests.',
      loreText: 'A single account is a story. Ten accounts of the same world is a record.',
      objective: { kind: 'quests-completed', count: 10 },
      reward: {
        gold: 15_000,
        xp: 300,
        energy: 'aether',
        item: { defId: 'codex-solarii', rarity: 'rare' },
      },
    },
    {
      id: 'archivist-3',
      npcId: 'archivist',
      title: 'The Standing Record',
      description: 'Uncover twenty-five hidden discoveries.',
      loreText: 'Twenty-five. At that point I stop filing you under visitors.',
      objective: { kind: 'eggs-found', count: 25 },
      reward: { gold: 50_000, xp: 600, energy: 'aether', title: 'the-annotated' },
    },
    {
      id: 'archivist-4',
      npcId: 'archivist',
      title: 'Margins and Marginalia',
      description: 'Record forty entries in the Collection Log.',
      loreText: 'The margins are where the honest writing happens. Yours are getting crowded.',
      objective: { kind: 'collection', count: 40 },
      reward: {
        gold: 100_000,
        xp: 1_200,
        energy: 'aether',
        cosmetic: { id: 'achievement-frame', variant: 'runed' },
      },
    },
    {
      id: 'archivist-5',
      npcId: 'archivist',
      title: 'The Unfinished Sentence',
      description: 'Reach level 20.',
      loreText:
        'There is one entry I have never been able to close. It has your handwriting in it and it is dated before you arrived.',
      objective: { kind: 'level', count: 20 },
      reward: {
        gold: 500_000,
        xp: 5_000,
        energy: 'aether',
        title: 'keeper-of-fragments',
        achievement: 'npc-archivist-chain',
        loreFragment:
          'The Archivist has no first name in any record, including the ones the Archivist wrote. This is not an oversight. It is the only entry they ever redacted.',
      },
    },
  ],

  merchant: [
    {
      id: 'merchant-1',
      npcId: 'merchant',
      title: 'First Coin',
      description: 'Earn one hundred thousand Gold, all told.',
      loreText: 'A hundred thousand. Barely a greeting, friend, but I greet everyone.',
      objective: { kind: 'gold-earned', count: 100_000 },
      reward: { gold: 5_000, xp: 120 },
    },
    {
      id: 'merchant-2',
      npcId: 'merchant',
      title: 'Regular Customer',
      description: 'Earn one million Gold, all told.',
      loreText: 'A million. Now we are speaking the same language and I am starting to like the accent.',
      objective: { kind: 'gold-earned', count: 1_000_000 },
      reward: {
        gold: 15_000,
        xp: 300,
        item: { defId: 'keeper-signet', rarity: 'rare' },
      },
    },
    {
      id: 'merchant-3',
      npcId: 'merchant',
      title: 'The Long Till',
      description: 'Hold twenty-five items at once.',
      loreText: 'A full bag is not wealth, friend. A full bag is inventory. I can help with that.',
      objective: { kind: 'items-owned', count: 25 },
      reward: { gold: 50_000, xp: 600, title: 'the-solvent' },
    },
    {
      id: 'merchant-4',
      npcId: 'merchant',
      title: 'Frozen Effort',
      description: 'Earn twenty-five million Gold, all told.',
      loreText: 'Coin is frozen effort. You have a glacier. Let me sell you something to melt it on.',
      objective: { kind: 'gold-earned', count: 25_000_000 },
      reward: {
        gold: 100_000,
        xp: 1_200,
        cosmetic: { id: 'cursor-trail', variant: 'eclipse' },
      },
    },
    {
      id: 'merchant-5',
      npcId: 'merchant',
      title: 'Technically Family',
      description: 'Hold an item of mythic quality.',
      loreText:
        'Bring me something mythic. I will not buy it. I only want to be in the room with it once, and then we will discuss the estate.',
      objective: { kind: 'item-rarity', rarity: 'mythic' },
      reward: {
        gold: 500_000,
        xp: 5_000,
        title: 'goldmouth',
        achievement: 'npc-merchant-chain',
        loreFragment:
          'Nobody has ever seen the Merchant buy anything. Every item on every shelf was, by their own account, already theirs — and no ledger has been able to disprove it.',
      },
    },
  ],

  nameless: [
    {
      id: 'nameless-1',
      npcId: 'nameless',
      title: 'You Counted',
      description: 'Hold a combo of 666.',
      loreText: 'You already did it. That is why I am here. This is only the paperwork.',
      objective: { kind: 'combo-best', count: 666 },
      reward: { gold: 66_600, xp: 666, energy: 'nox' },
    },
    {
      id: 'nameless-2',
      npcId: 'nameless',
      title: 'One More',
      description: 'Hold a combo of 1,000.',
      loreText: 'Higher.',
      objective: { kind: 'combo-best', count: 1_000 },
      reward: { gold: 166_600, xp: 1_666, energy: 'nox', title: 'the-counted' },
    },
    {
      id: 'nameless-3',
      npcId: 'nameless',
      title: 'It Remembers',
      description: 'Hold a combo of 6,660.',
      loreText: 'You will stop before this. Everyone stops before this. I will wait either way.',
      objective: { kind: 'combo-best', count: 6_660 },
      reward: {
        gold: 666_000,
        xp: 6_660,
        energy: 'nox',
        title: 'nameless',
        achievement: 'npc-nameless-chain',
        loreFragment:
          'It was never counting the strikes. It was counting the people who noticed it was counting.',
      },
    },
  ],
};

/** Every step in the game, flattened. Order is chain order within each NPC. */
export const ALL_NPC_STEPS: readonly NpcQuestStep[] =
  (Object.keys(NPC_CHAINS) as NpcId[]).flatMap(id => NPC_CHAINS[id]);

const STEP_BY_ID = new Map(ALL_NPC_STEPS.map(s => [s.id, s]));

export function npcStepById(id: string): NpcQuestStep | undefined {
  return STEP_BY_ID.get(id);
}

/** The target an objective counts toward. Binary objectives target 1. */
export function objectiveTarget(o: NpcObjective): number {
  switch (o.kind) {
    case 'achievement':
    case 'item-rarity':
      return 1;
    case 'quest-progress':
      return Math.max(1, o.condition.count);
    default:
      return Math.max(1, o.count);
  }
}
