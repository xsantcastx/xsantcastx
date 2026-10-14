/**
 * delve-missions.model.ts — the NPC missions that send a Keeper down the Delve.
 *
 * The Delve is the way down the Godforge's fracture beneath the Seamworks, and
 * each biome is one layer of that story. Each mission is one character asking
 * for one thing, in one sentence, with one obvious next step.
 *
 * These sit beside the six NPC chains rather than inside them. A chain is a
 * strict line — step N waits for step N-1 — and a Delve mission must not wait
 * behind Verrin's combo-of-666 capstone. So a mission names its prerequisites
 * (`requires`) instead of taking a slot in a chain, and NpcQuestService keeps
 * both in the same blob and pays both the same way: receipt first, then pay.
 *
 * Objectives read ledgers, never count events, exactly like the chains:
 *  - `deliver`      reads the bag's stacks; claiming consumes them.
 *  - `inscriptions` reads DelveLoreService's copied set.
 *  - `read`         reads whether one named inscription is in that set.
 *  - `defeat`       reads a once-per-player flag in the Delve save (a felled boss).
 *
 * Pure data and pure functions. No Angular, no browser APIs.
 */
import { ARTIFACTS } from '../economy/economy.model';
import type { ItemRarity } from '../rpg/item.model';
import { DELVE_INSCRIPTIONS, GLOWCAP, GODFORGE_FRAGMENT, SHADOW_ROOT_CUTTING } from '../delve/delve-lore.model';
import type { NpcId } from './npc.model';
import { REWARD_SECONDS, itemScaled, steppedRewardSeconds } from '../economy/economy-curve';
import { xpGrantChunks } from '../activity/activity.model';

/**
 * Kael's lost hammer. A quest material (a stack key), dropped once from a
 * hand-placed cache in the Basalt Caverns — the Delve engine places it.
 */
export const KAELS_HAMMER = 'kaels-hammer';

/** The recipe Kael's mission opens: a Tier III pickaxe from Delve materials only. */
export const KAEL_SEAM_PICK_RECIPE = 'craft-pickaxe-3-seam';
export const NULLTHORN_RECIPE = 'craft-nullthorn-staff';

/**
 * Names for the Delve's materials until they have art in the catalogue
 * (`materialDisplay` only returns rows that have art).
 */
export const DELVE_MATERIAL_NAMES: Readonly<Record<string, string>> = {
  [SHADOW_ROOT_CUTTING]: 'Shadow-Root Cutting',
  [GLOWCAP]: 'Glowcap',
  [GODFORGE_FRAGMENT]: 'Godforge Fragment',
  [KAELS_HAMMER]: "Kael's Hammer",
};

export interface DeliverItem {
  materialId: string;
  count: number;
  /** Where to look, in plain words, for the next-step line. */
  where: string;
}

export type MissionObjective =
  | { kind: 'deliver'; items: readonly DeliverItem[] }
  /** `count: 'all'` resolves to every inscription the Delve has. */
  | { kind: 'inscriptions'; count: number | 'all' }
  /** One named inscription read (and copied). */
  | { kind: 'read'; inscription: string; where: string }
  /** A once-per-player flag set: a felled boss (`MonsterDef.once`). */
  | { kind: 'defeat'; flag: string; name: string; where: string };

/**
 * Economy v3 reward for a mission authored at `v2Gold`: a floor of v2 × ρ and
 * the NPC band's seconds of income (rebalance spec §3, rule I).
 */
function incomeGold(v2Gold: number): Pick<MissionReward, 'gold' | 'goldSeconds'> {
  return { gold: itemScaled(v2Gold), goldSeconds: steppedRewardSeconds(v2Gold, REWARD_SECONDS.npc) };
}

export interface MissionReward {
  /** Floor of the Gold paid. */
  gold: number;
  /**
   * Pay this many seconds of the Keeper's income instead, when that is more
   * than `gold`. Keeps a repeatable order worth doing at every stage.
   */
  goldSeconds?: number;
  /** Delving XP, through the skill pipeline (idempotent per claim). */
  delvingXp?: number;
  /** Fishing XP, the same way (Phase 6 fishing missions). */
  fishingXp?: number;
  /** A crafting recipe id this mission unlocks at the bench. */
  recipe?: string;
  /** A rune id banked into the Rune Forge ledger. */
  rune?: string;
  /** An existing equipment definition minted at this rarity. */
  item?: { defId: string; rarity: ItemRarity };
  /** An Essence-shop artifact id, granted as an `NpcReward.artifact` is. */
  artifact?: string;
  /** The lore reveal, shown on the claim and in the mission card once done. */
  loreFragment?: string;
}

export interface DelveMission {
  id: string;
  npcId: NpcId;
  /** A second giver who also offers it (The Fracture: Kael + the Archivist). */
  alsoFrom?: NpcId;
  title: string;
  /** One plain sentence: what to do. */
  brief: string;
  /** The character's words. */
  loreText: string;
  objective: MissionObjective;
  reward: MissionReward;
  /** Plain words for what claiming opens. Shown under the reward. */
  unlocks?: string;
  /** Mission ids that must be claimed (once, for a repeatable) first. */
  requires?: readonly string[];
  /** A standing order: claimable again every time it is filled. */
  repeatable?: boolean;
}

/** Glowcaps per standing order. */
export const GLOWCAP_ORDER_SIZE = 5;
/** The flag the Drowned Lamp sets when it falls (delve save `claimed`; towns/infernal.ts). */
export const DROWNED_LAMP_FLAG = 'drowned-lamp-defeated';

export const DELVE_MISSIONS: readonly DelveMission[] = [
  {
    id: 'delve-verrin-shadow',
    npcId: 'verrin',
    title: 'The Shadow Beneath',
    brief: 'Bring Verrin 3 Shadow-Root Cuttings from the Root Hollows.',
    loreText:
      'Under the Godforge a tree grows downward, toward the crack. Cut me three pieces of its shadow and I will show you what they open.',
    objective: {
      kind: 'deliver',
      items: [{ materialId: SHADOW_ROOT_CUTTING, count: 3, where: 'the Root Hollows of the Ember Delve' }],
    },
    reward: {
      ...incomeGold(20_000),
      delvingXp: 150,
      recipe: NULLTHORN_RECIPE,
      loreFragment:
        'The World-Root has two halves. One holds the realms up. The other holds the Godforge down.',
    },
    unlocks: 'The Nullthorn Staff recipe at the Crafting Bench. Its blast opens cracked walls.',
  },
  {
    id: 'delve-kael-seam',
    npcId: 'kael',
    title: 'The Old Seam',
    brief: "Bring Kael 10 Slag Fragments and his lost hammer from the Basalt Caverns.",
    loreText:
      'I closed those mines when the heat stopped coming from the rock. My hammer is still down there. Bring it back, and enough slag to prove the seam still gives.',
    objective: {
      kind: 'deliver',
      items: [
        { materialId: 'slag-fragment', count: 10, where: 'Slag veins in the Basalt Caverns' },
        { materialId: KAELS_HAMMER, count: 1, where: "an old Keeper's cache in the Basalt Caverns" },
      ],
    },
    reward: {
      ...incomeGold(40_000),
      delvingXp: 200,
      recipe: KAEL_SEAM_PICK_RECIPE,
      loreFragment:
        'Kael did not close the mines because the seam ran dry. He closed them because it started to run toward something.',
    },
    unlocks: "Kael's Seam Pick recipe: a Pickaxe III from Delve ore, no expedition goods needed.",
  },
  {
    id: 'delve-merchant-glowcaps',
    npcId: 'merchant',
    title: 'Glowcap Orders',
    brief: `Bring the Merchant ${GLOWCAP_ORDER_SIZE} Glowcaps from the Glowcap Grotto.`,
    loreText:
      'Light that grows in a cave, friend. People pay for that twice: once to see it, once to stop thinking about where it came from.',
    objective: {
      kind: 'deliver',
      items: [{ materialId: GLOWCAP, count: GLOWCAP_ORDER_SIZE, where: 'the Glowcap Grotto, below the Basalt Caverns (bring a sickle)' }],
    },
    // The Merchant is a floor buyer (economy v3: NPCs are sinks; players set
    // the market): 180 Gold, or 90 s of income when that is more.
    reward: { gold: itemScaled(3_000), goldSeconds: 90 },
    unlocks: 'A standing order. Fill it as often as you like.',
    repeatable: true,
  },
  {
    id: 'delve-archivist-words-1',
    npcId: 'archivist',
    title: 'Words in the Stone',
    brief: 'Copy 3 inscriptions from the walls of the Ember Delve.',
    loreText: 'Somebody wrote on those walls before the stone had finished cooling. Copy what they said. Exactly.',
    objective: { kind: 'inscriptions', count: 3 },
    reward: { ...incomeGold(10_000), delvingXp: 80 },
    unlocks: 'Each inscription you copy is kept in the Codex, under Lore.',
  },
  {
    id: 'delve-archivist-words-2',
    npcId: 'archivist',
    title: 'Words in the Stone II',
    brief: 'Copy 6 inscriptions from the walls of the Ember Delve.',
    loreText: 'Six. The handwriting changes between the layers. Two of the hands are the same person, years apart.',
    objective: { kind: 'inscriptions', count: 6 },
    reward: { ...incomeGold(30_000), delvingXp: 160 },
    requires: ['delve-archivist-words-1'],
  },
  {
    id: 'delve-archivist-words-3',
    npcId: 'archivist',
    title: 'Words in the Stone III',
    brief: `Copy all ${DELVE_INSCRIPTIONS.length} inscriptions in the Ember Delve.`,
    loreText: 'All of them. I have kept a shelf empty for this since before you arrived.',
    objective: { kind: 'inscriptions', count: 'all' },
    reward: {
      ...incomeGold(80_000),
      delvingXp: 300,
      loreFragment:
        'Every inscription in the Delve was cut by a Keeper. The Archivist checked. One of them is still being written.',
    },
    requires: ['delve-archivist-words-2'],
  },
  {
    id: 'delve-fracture',
    npcId: 'kael',
    alsoFrom: 'archivist',
    title: 'The Fracture',
    brief: 'Recover the Godforge Fragment from the Magma Halls and bring it to Kael.',
    loreText:
      'At the bottom of the Delve the Godforge broke, and a piece of it is still lying where it fell. Something guards it. Bring it up, and do not try to use it on the way.',
    objective: {
      kind: 'deliver',
      items: [{ materialId: GODFORGE_FRAGMENT, count: 1, where: 'the Magma Halls, past the Seam Eater' }],
    },
    reward: {
      ...incomeGold(150_000),
      delvingXp: 600,
      rune: 'fracture',
      loreFragment:
        'The fragment is warm on the side that faces the Seamworks. Kael says the Godforge was never broken from outside. It broke along a line someone had already drawn.',
    },
    unlocks: 'The Fracture rune, and the truth about the crack.',
    requires: ['delve-verrin-shadow', 'delve-kael-seam', 'delve-merchant-glowcaps'],
  },
  // ── Fishing (Phase 6; delve-and-beyond.md §5.5, §7.1; lore addendum "The Drowned Lamp") ──
  {
    id: 'fish-drowned-lamp-1',
    npcId: 'archivist',
    title: 'The Drowned Lamp',
    brief: 'Bring the Archivist 3 Glowcap Minnows from the Grotto Mere.',
    loreText: 'Bring me one of everything that swims. I am not cataloguing fish. I am cataloguing what the water remembers. Start with the small bright ones.',
    objective: { kind: 'deliver', items: [{ materialId: 'glowcap-minnow', count: 3, where: 'the Grotto Mere, the lake in the Glowcap Grotto (any rod)' }] },
    reward: { ...incomeGold(10_000), fishingXp: 60, delvingXp: 40 },
    unlocks: 'The next page of the Drowned Lamp.',
  },
  {
    id: 'fish-drowned-lamp-2',
    npcId: 'archivist',
    title: 'What the Water Keeps',
    brief: 'Read the carving under the water at the east end of the Glowcap Grotto.',
    loreText: 'There is a carving down there that someone kept lit for a very long time. The lamp is still burning under the water. Read me what it says. Hold your breath.',
    objective: { kind: 'read', inscription: 'grotto-drowned-lamp', where: 'the drowned alcove east of the Grotto Mere (a Gill Draught helps)' },
    reward: { ...incomeGold(20_000), fishingXp: 80, delvingXp: 80 },
    unlocks: 'Fish the Mere at night with Glowcap bait, and something large answers.',
    requires: ['fish-drowned-lamp-1'],
  },
  {
    id: 'fish-drowned-lamp-3',
    npcId: 'archivist',
    title: 'The Lamp\'s Keeper',
    brief: 'Fish the Grotto Mere at night with Glowcap bait, and face what circles the lamp.',
    loreText: 'On the nights when the crack is darkest, something large circles the lamp and dims every other light in the cavern. Light a torch beside it. In the dark it is a rumour; in the light it is a fight.',
    objective: { kind: 'defeat', flag: DROWNED_LAMP_FLAG, name: 'the Drowned Lamp', where: 'the Grotto Mere, at night (after dark on your clock), with Glowcap bait' },
    reward: {
      ...incomeGold(50_000),
      fishingXp: 300,
      delvingXp: 200,
      loreFragment: 'It was not lost. It was put down carefully by someone who expected to come back. The lamp stays where it is: some records are kept by not being moved.',
    },
    unlocks: 'The Catalogue of Strange Fish, complete with the Archivist\'s notes, in the Codex.',
    requires: ['fish-drowned-lamp-2'],
  },
  {
    id: 'fish-verrin-eels',
    npcId: 'verrin',
    title: 'Toward the Crack',
    brief: 'Bring Verrin 5 Rootling Eels from the Delve\'s seeps.',
    loreText: 'They swim along the roots, toward the crack, like everything else down here. Bring me five. I want to know which way they were facing when you caught them.',
    objective: { kind: 'deliver', items: [{ materialId: 'rootling-eel', count: 5, where: 'the seep in the Root Hollows alcove or Kael\'s flooded seam' }] },
    reward: { ...incomeGold(15_000), fishingXp: 120, loreFragment: 'Every eel faced the crack. Verrin wrote it down and did not say what it meant.' },
  },
  {
    id: 'fish-merchant-order',
    npcId: 'merchant',
    title: 'Fish Orders',
    brief: 'Bring the Merchant 5 Mere Perch and 5 Slagjaw Eels.',
    loreText: 'Ordinary fish, friend, and fish that bite slag. The first sells because nobody believes it came from down there. The second sells because everybody does.',
    objective: {
      kind: 'deliver',
      items: [
        { materialId: 'mere-perch', count: 5, where: 'the Grotto Mere (rare)' },
        { materialId: 'slagjaw-eel', count: 5, where: 'the Magma Halls lava pools (a Seam Rod)' },
      ],
    },
    // A floor buyer like the Glowcap order: 180 Gold, or 90 s of income when that is more.
    // Five and five: the economy sim (--fishing) holds fishing under 10% of the forge's Gold a minute.
    reward: { gold: itemScaled(3_000), goldSeconds: 90, fishingXp: 40 },
    unlocks: 'A standing order. Fill it as often as you like.',
    repeatable: true,
  },
  {
    id: 'fish-merchant-debt',
    npcId: 'merchant',
    title: 'The Unpaid Debt',
    brief: 'Bring the Merchant the fish with the heat seal on its flank.',
    loreText: 'Stamped with a heat seal, you say. Somebody still owes for that fish. Bring it here and I will settle it: I always settle. Eventually.',
    objective: { kind: 'deliver', items: [{ materialId: 'the-unpaid-debt', count: 1, where: 'the Magma Halls lava, very rarely (a legendary)' }] },
    reward: { ...incomeGold(100_000), fishingXp: 250, loreFragment: 'The Merchant paid the debt in full, to nobody, and put the receipt in a drawer that does not open.' },
  },
  {
    id: 'fish-archivist-pages',
    npcId: 'archivist',
    title: 'The Waterlogged Ledger',
    brief: 'Bring the Archivist a Waterlogged Ledger Page from the Delve\'s water.',
    loreText: 'Kael\'s handwriting, mostly. A column of figures that stops at the waterline. Every page you bring me, I dry and file. Every one stops at the same figure.',
    objective: { kind: 'deliver', items: [{ materialId: 'waterlogged-ledger-page', count: 1, where: 'any water in the Delve, now and then (junk on the line)' }] },
    reward: { gold: itemScaled(2_000), goldSeconds: 60, delvingXp: 40 },
    unlocks: 'A standing order: every page is filed.',
    repeatable: true,
  },
];

const BY_ID = new Map(DELVE_MISSIONS.map(m => [m.id, m]));

export function delveMissionById(id: string): DelveMission | undefined {
  return BY_ID.get(id);
}

/** One Delving XP grant of a mission claim, with its idempotency key. */
export interface MissionXpGrant {
  mutationId: string;
  xp: number;
}

/**
 * The Delving XP a claim pays, as grants the world-action gateway accepts
 * (each ≤ WORLD_ACTION_MAX_XP). The Fracture's 600 used to go as one action
 * over the 500 ceiling and was refused whole (playtest P-6); now it is two.
 * The first grant keeps the key a single grant always had
 * (`npc-mission:<id>:<times>:xp`), so a claim that already paid is a replay,
 * never paid twice; any further grant appends its index.
 */
export function missionXpGrants(mission: Pick<DelveMission, 'id' | 'reward'>, times: number): MissionXpGrant[] {
  const base = `npc-mission:${mission.id}:${times}:xp`;
  return xpGrantChunks(mission.reward.delvingXp ?? 0).map((xp, i) => ({
    mutationId: i === 0 ? base : `${base}:${i + 1}`,
    xp,
  }));
}

/** The Fishing XP a claim pays, the same way (keys `npc-mission:<id>:<times>:fxp`). */
export function missionFishingXpGrants(mission: Pick<DelveMission, 'id' | 'reward'>, times: number): MissionXpGrant[] {
  const base = `npc-mission:${mission.id}:${times}:fxp`;
  return xpGrantChunks(mission.reward.fishingXp ?? 0).map((xp, i) => ({ mutationId: i === 0 ? base : `${base}:${i + 1}`, xp }));
}

/** The missions a character offers, as giver or co-giver, in list order. */
export function missionsFrom(npcId: NpcId): DelveMission[] {
  return DELVE_MISSIONS.filter(m => m.npcId === npcId || m.alsoFrom === npcId);
}

/** The recipe ids missions gate. A recipe here is locked until its mission is claimed. */
export const MISSION_RECIPES: Readonly<Record<string, string>> = Object.fromEntries(
  DELVE_MISSIONS.filter(m => m.reward.recipe).map(m => [m.reward.recipe!, m.id]),
);

/** The number an objective counts to. */
export function missionTarget(o: MissionObjective, inscriptionTotal = DELVE_INSCRIPTIONS.length): number {
  if (o.kind === 'read' || o.kind === 'defeat') return 1;
  if (o.kind === 'inscriptions') {
    return Math.max(1, o.count === 'all' ? inscriptionTotal : o.count);
  }
  return Math.max(1, o.items.reduce((sum, row) => sum + row.count, 0));
}

/** The readings an objective needs, so the reader stays a plain function. */
export interface MissionReadings {
  stackOf(materialId: string): number;
  inscriptions: number;
  inscriptionTotal: number;
  /** Whether one inscription has been read. Absent: none. */
  read?: (id: string) => boolean;
  /** Whether a once-per-player flag is set. Absent: none. */
  flagged?: (flag: string) => boolean;
}

/** Progress toward the target, each delivery line capped at its own count. */
export function missionObserved(o: MissionObjective, r: MissionReadings): number {
  if (o.kind === 'read') return r.read?.(o.inscription) ? 1 : 0;
  if (o.kind === 'defeat') return r.flagged?.(o.flag) ? 1 : 0;
  if (o.kind === 'inscriptions') {
    return Math.min(r.inscriptions, missionTarget(o, r.inscriptionTotal));
  }
  return o.items.reduce((sum, row) => sum + Math.min(Math.max(0, r.stackOf(row.materialId)), row.count), 0);
}

/** Display name for a mission material. */
export function missionMaterialName(id: string, lookup?: (id: string) => string | undefined): string {
  return lookup?.(id) ?? DELVE_MATERIAL_NAMES[id] ?? id;
}

/**
 * The one plain line under a mission: what to do right now.
 *
 * Locked → what to finish first. Short → the first missing thing and where it
 * is. Ready → who to hand it to.
 */
export function missionNextStep(
  m: DelveMission,
  state: { locked: boolean; ready: boolean; missingFirst: string[] },
  r: MissionReadings,
  name: (id: string) => string,
  npcName: (id: NpcId) => string,
): string {
  if (state.locked) {
    const first = (m.requires ?? []).find(id => state.missingFirst.includes(id));
    const before = first ? delveMissionById(first)?.title : null;
    return before ? `Finish "${before}" first.` : 'Not yet.';
  }
  if (state.ready) return `Hand it to ${npcName(m.npcId)} and claim your reward.`;
  const o = m.objective;
  if (o.kind === 'read') return `Read the carving in ${o.where}.`;
  if (o.kind === 'defeat') return `Face ${o.name} in ${o.where}.`;
  if (o.kind === 'inscriptions') {
    const left = missionTarget(o, r.inscriptionTotal) - Math.min(r.inscriptions, missionTarget(o, r.inscriptionTotal));
    return `Copy ${left} more ${left === 1 ? 'inscription' : 'inscriptions'} in the Ember Delve.`;
  }
  for (const row of o.items) {
    const left = row.count - Math.min(Math.max(0, r.stackOf(row.materialId)), row.count);
    if (left > 0) return `Find ${left} more ${name(row.materialId)} in ${row.where}.`;
  }
  return `Hand it to ${npcName(m.npcId)} and claim your reward.`;
}

/**
 * Gold for a claim: the floor, or `goldSeconds` of income when that is more.
 * Whole Gold; a broken rate pays the floor.
 */
export function missionGold(reward: MissionReward, perSecond: number): number {
  const floor = Math.max(0, Math.floor(reward.gold));
  if (!reward.goldSeconds || !Number.isFinite(perSecond) || perSecond <= 0) return floor;
  return Math.max(floor, Math.floor(perSecond * reward.goldSeconds));
}

/** Plain reward line: "20,000 Gold · 150 Delving XP · Nullthorn Staff recipe". */
export function missionRewardLine(reward: MissionReward, gold: number, recipeName?: string, runeName?: string): string {
  const parts = [`${gold.toLocaleString('en-US')} Gold`];
  if (reward.delvingXp) parts.push(`${reward.delvingXp} Delving XP`);
  if (reward.fishingXp) parts.push(`${reward.fishingXp} Fishing XP`);
  if (reward.recipe) parts.push(`${recipeName ?? 'a new'} recipe`);
  if (reward.rune) parts.push(`${runeName ?? reward.rune} rune`);
  if (reward.item) parts.push(`a ${reward.item.rarity} keepsake`);
  if (reward.artifact) parts.push(ARTIFACTS.find(a => a.id === reward.artifact)?.name ?? 'an artifact');
  return parts.join(' · ');
}
