/**
 * town-tasks.model.ts — what each town's keepers ask of a Keeper (Tibia / Stardew town tasks; docs/handoff/town-tasks.md).
 *
 * Every town of the top-down world has two or three givers: the Seamworks reuses its stall keepers (world/life.ts
 * TOWN_KEEPERS ids), Pyrehold, Cinderport, Ashgrove and the Verdant Wilds' towns place their own (td maps `givers`). A giver's tasks run in order:
 * the next is offered once the one before it is handed in. Three kinds, all read from real game events:
 *
 *   hunt     fell N of a creature (the top-down kill hook, td-mobs `onKill`), counted from the moment it is taken
 *   deliver  bring N of a material (inventory stacks); handed over at the hand-in
 *   visit    reach a hand-drawn floor (a level id: the Ember Inn's upstairs, a dungeon floor) and come back
 *
 * Rewards: a fixed sum of Gold worth `goldSeconds` of a steady hunt at the task's level (economy-curve huntGold; the
 * forge no longer pays by the second, so "minutes of income" became minutes of the hunt; `economy-sim --check` holds
 * the band), a material, Hunting XP, and in each town one task's guaranteed rolled gear piece at a set rarity
 * and item level (shared/rpg/item-definition.ts mintEquipment).
 *
 * Pure: imports only the import-free economy curve, so the economy sim and check-meaning can load it.
 */
import { huntGold } from '../economy/economy-curve';

export type TownTaskKind = 'hunt' | 'deliver' | 'visit';
export type TaskTown = 'seamworks' | 'pyrehold' | 'cinderport' | 'ashgrove'
  // The Verdant Wilds: Rootglass, and its villages Mossharbor and Thornwick.
  | 'rootglass' | 'mossharbor' | 'thornwick';

export interface TownTaskReward {
  /** What the pay is worth: seconds of a steady hunt at the task's level. */
  goldSeconds: number;
  /** The Gold paid: huntGold(level, goldSeconds), fixed when the table is built. */
  gold: number;
  /** A material stack handed over with the pay. */
  material?: { id: string; qty: number };
  huntingXp: number;
  /** A guaranteed gear piece, rolled at this rarity and item level. */
  gear?: { defId: string; rarity: 'uncommon' | 'rare' | 'epic'; level: number };
  /** A daily's small chance of a potion; rolled from the day's key, so two devices agree (see dailyPotion). */
  potion?: { id: string; chance: number };
}

export interface TownTask {
  /** `<town>-<giver short>-<n>`: also the i18n stem `task.<id>.*` (title, ask, thanks). */
  id: string;
  giver: string;
  kind: TownTaskKind;
  /** hunt: a creature id (td-mobs MOBS); deliver: a material id; visit: a hand-drawn level id. */
  target: string;
  n: number;
  /** The level band it is pitched at (shown, never gated). */
  level: number;
  reward: TownTaskReward;
  /** A daily (DAILY_TASKS): offered once the giver's one-time tasks are done, one per giver per local day. */
  daily?: true;
}

export interface TaskGiver {
  /** A TOWN_KEEPERS id (a stall keeper) or the giver's own id (a td map `givers` entry). */
  id: string;
  name: string;
  town: TaskTown;
  /** i18n: `task.giver.<id>.who` — who they are, one line. */
}

/** `minutes` of a hunt at the task's level; the sum is filled in by `priced` once the level is known. */
const pay = (minutes: number, huntingXp: number, extra: Partial<TownTaskReward> = {}): TownTaskReward =>
  ({ goldSeconds: minutes * 60, gold: 0, huntingXp, ...extra });
/** A task with its Gold fixed: its minutes of a hunt of creatures at its own level. */
const priced = (t: TownTask): TownTask => ({ ...t, reward: { ...t.reward, gold: huntGold(t.level, t.reward.goldSeconds) } });

export const TASK_GIVERS: readonly TaskGiver[] = [
  // ── The Basalt Seamworks (Ember Isle, levels 1–8): its stall keepers, and the sexton of the Hushed Barrow ──
  { id: 'bench-smith', name: 'Mara Voss', town: 'seamworks' },
  { id: 'buyback-clerk', name: 'Edrin Kade', town: 'seamworks' },
  { id: 'sexton-wren', name: 'Sexton Aldous Wren', town: 'seamworks' },
  // ── Pyrehold (the capital of the Infernal Reach) ──
  { id: 'captain-vey', name: 'Captain Brannoc Vey', town: 'pyrehold' },
  { id: 'forgewife-marr', name: 'Forgewife Ysolde Marr', town: 'pyrehold' },
  { id: 'scholar-pryor', name: 'Scholar Odette Pryor', town: 'pyrehold' },
  // ── Cinderport (the harbour) ──
  { id: 'harbourmaster-coyle', name: 'Harbourmaster Tamsin Coyle', town: 'cinderport' },
  { id: 'netter-pell', name: 'Old Netter Pell', town: 'cinderport' },
  // ── Ashgrove (the charcoal-burners' village) ──
  { id: 'woodward-ashby', name: 'Woodward Hesk Ashby', town: 'ashgrove' },
  { id: 'charburner-kiln', name: 'Maud Kiln', town: 'ashgrove' },
  // ── The Verdant Wilds (levels 15–40): Rootglass in the canopy, Mossharbor on the shore, Thornwick in the Fernglades ──
  { id: 'warden-fenn', name: 'Canopy Warden Ilsa Fenn', town: 'rootglass' },
  { id: 'mossreader-tull', name: 'Mossreader Oren Tull', town: 'rootglass' },
  { id: 'netmender-brisk', name: 'Netmender Wenna Brisk', town: 'mossharbor' },
  { id: 'herbalist-sorrel', name: 'Herbalist Agathe Sorrel', town: 'thornwick' },
];

export const TOWN_TASKS: readonly TownTask[] = ([
  // Seamworks
  { id: 'seam-mara-1', giver: 'bench-smith', kind: 'deliver', target: 'cinder-ore', n: 6, level: 1, reward: pay(3, 40, { material: { id: 'ember-residue', qty: 2 } }) },
  { id: 'seam-mara-2', giver: 'bench-smith', kind: 'deliver', target: 'world-root-bark', n: 4, level: 2, reward: pay(4, 50, { material: { id: 'cinder-ore', qty: 4 } }) },
  { id: 'seam-edrin-1', giver: 'buyback-clerk', kind: 'hunt', target: 'rivet-maw', n: 6, level: 1, reward: pay(3, 60, { material: { id: 'cinder-ore', qty: 3 } }) },
  { id: 'seam-edrin-2', giver: 'buyback-clerk', kind: 'visit', target: 'ember-inn-2', n: 1, level: 1, reward: pay(2, 30, { material: { id: 'ember-residue', qty: 1 } }) },
  { id: 'seam-wren-1', giver: 'sexton-wren', kind: 'hunt', target: 'ash-wolf', n: 5, level: 3, reward: pay(4, 70) },
  { id: 'seam-wren-2', giver: 'sexton-wren', kind: 'hunt', target: 'bone-walker', n: 5, level: 6, reward: pay(6, 110, { gear: { defId: 'keepers-cowl', rarity: 'rare', level: 8 } }) },
  // Pyrehold
  { id: 'pyre-vey-1', giver: 'captain-vey', kind: 'hunt', target: 'cinder-orc', n: 8, level: 10, reward: pay(8, 220, { material: { id: 'ember-residue', qty: 4 } }) },
  { id: 'pyre-vey-2', giver: 'captain-vey', kind: 'hunt', target: 'orc-firecaller', n: 5, level: 13, reward: pay(10, 280) },
  { id: 'pyre-marr-1', giver: 'forgewife-marr', kind: 'deliver', target: 'ember-residue', n: 6, level: 8, reward: pay(6, 150, { material: { id: 'cinder-ore', qty: 8 } }) },
  { id: 'pyre-marr-2', giver: 'forgewife-marr', kind: 'visit', target: 'molten-deep-2', n: 1, level: 12, reward: pay(8, 200, { material: { id: 'ember-residue', qty: 3 } }) },
  { id: 'pyre-pryor-1', giver: 'scholar-pryor', kind: 'visit', target: 'pyre-spire-3', n: 1, level: 8, reward: pay(4, 120) },
  { id: 'pyre-pryor-2', giver: 'scholar-pryor', kind: 'hunt', target: 'magma-tyrant', n: 1, level: 20, reward: pay(15, 450, { gear: { defId: 'infernal-cuirass', rarity: 'epic', level: 20 } }) },
  // Cinderport
  { id: 'port-coyle-1', giver: 'harbourmaster-coyle', kind: 'visit', target: 'salted-ember-0', n: 1, level: 8, reward: pay(4, 120, { material: { id: 'ember-residue', qty: 2 } }) },
  { id: 'port-coyle-2', giver: 'harbourmaster-coyle', kind: 'hunt', target: 'ember-drake', n: 4, level: 18, reward: pay(12, 380, { gear: { defId: 'keeper-staff', rarity: 'rare', level: 18 } }) },
  { id: 'port-pell-1', giver: 'netter-pell', kind: 'deliver', target: 'world-root-bark', n: 6, level: 8, reward: pay(6, 150, { material: { id: 'cinder-ore', qty: 6 } }) },
  { id: 'port-pell-2', giver: 'netter-pell', kind: 'hunt', target: 'lava-hound', n: 6, level: 10, reward: pay(8, 220) },
  // Ashgrove
  { id: 'ash-hesk-1', giver: 'woodward-ashby', kind: 'visit', target: 'ashen-crypt-1', n: 1, level: 9, reward: pay(5, 140, { material: { id: 'world-root-bark', qty: 3 } }) },
  { id: 'ash-hesk-2', giver: 'woodward-ashby', kind: 'hunt', target: 'ash-ghoul', n: 6, level: 9, reward: pay(8, 240) },
  { id: 'ash-maud-1', giver: 'charburner-kiln', kind: 'deliver', target: 'world-root-bark', n: 8, level: 8, reward: pay(6, 160, { material: { id: 'ember-residue', qty: 3 } }) },
  { id: 'ash-maud-2', giver: 'charburner-kiln', kind: 'hunt', target: 'bone-archer', n: 6, level: 8, reward: pay(10, 260, { gear: { defId: 'godforge-gauntlets', rarity: 'rare', level: 12 } }) },
  // The Verdant Wilds (one gear piece among its four givers: the Mossreader's, for the Colossus)
  { id: 'verd-fenn-1', giver: 'warden-fenn', kind: 'hunt', target: 'canopy-bat', n: 8, level: 15, reward: pay(6, 200, { material: { id: 'verdant-sap', qty: 2 } }) },
  { id: 'verd-fenn-2', giver: 'warden-fenn', kind: 'hunt', target: 'rootglass-hart', n: 5, level: 24, reward: pay(9, 300) },
  { id: 'verd-tull-1', giver: 'mossreader-tull', kind: 'visit', target: 'overgrown-temple-2', n: 1, level: 20, reward: pay(7, 220, { material: { id: 'thornroot', qty: 3 } }) },
  { id: 'verd-tull-2', giver: 'mossreader-tull', kind: 'hunt', target: 'mossbound-colossus', n: 1, level: 34, reward: pay(14, 480, { gear: { defId: 'verdant-bracers', rarity: 'rare', level: 30 } }) },
  { id: 'moss-brisk-1', giver: 'netmender-brisk', kind: 'deliver', target: 'thornroot', n: 6, level: 17, reward: pay(6, 180, { material: { id: 'world-root-bark', qty: 3 } }) },
  { id: 'moss-brisk-2', giver: 'netmender-brisk', kind: 'visit', target: 'root-hollows-3', n: 1, level: 24, reward: pay(9, 260, { material: { id: 'verdant-sap', qty: 3 } }) },
  { id: 'thorn-sorrel-1', giver: 'herbalist-sorrel', kind: 'deliver', target: 'verdant-sap', n: 5, level: 15, reward: pay(6, 180, { material: { id: 'thornroot', qty: 2 } }) },
  { id: 'thorn-sorrel-2', giver: 'herbalist-sorrel', kind: 'hunt', target: 'vine-lasher', n: 6, level: 21, reward: pay(8, 260) },
] as TownTask[]).map(priced);

const BY_ID = new Map(TOWN_TASKS.map(t => [t.id, t]));
export function townTask(id: string): TownTask | undefined { return BY_ID.get(id); }
export function giverById(id: string): TaskGiver | undefined { return TASK_GIVERS.find(g => g.id === id); }
/** A giver's tasks, in the order they are offered. */
export function tasksOf(giver: string): readonly TownTask[] { return TOWN_TASKS.filter(t => t.giver === giver); }

// ── Dailies: once a giver's two tasks are handed in, they offer one small errand a day ──
// A pool of three per giver; one is chosen per local day (dailyOf). Smaller pay than the one-time tasks: 1-2 minutes of
// a hunt, a little Hunting XP, now and then a small material, and a chance of a potion; never gear. `economy-sim
// --town-tasks` holds the per-day cap.
const bark = { id: 'world-root-bark', qty: 1 }, ore = { id: 'cinder-ore', qty: 2 }, residue = { id: 'ember-residue', qty: 1 };
const sap = { id: 'verdant-sap', qty: 1 }, thorn = { id: 'thornroot', qty: 1 };
const hp = { id: 'minor-health-potion', chance: 0.15 }, mp = { id: 'minor-mana-potion', chance: 0.15 };
const d = (giver: string, n: number, kind: 'hunt' | 'deliver', target: string, count: number, level: number, reward: TownTaskReward): TownTask =>
  ({ id: `dly-${giver}-${n}`, giver, kind, target, n: count, level, reward, daily: true });

export const DAILY_TASKS: readonly TownTask[] = ([
  d('bench-smith', 1, 'deliver', 'cinder-ore', 8, 1, pay(1, 15, { material: residue })),
  d('bench-smith', 2, 'deliver', 'world-root-bark', 5, 2, pay(1, 15, { potion: hp })),
  d('bench-smith', 3, 'hunt', 'rivet-maw', 5, 1, pay(1, 20, { material: ore })),
  d('buyback-clerk', 1, 'hunt', 'rivet-maw', 8, 1, pay(1, 25, { material: ore })),
  d('buyback-clerk', 2, 'hunt', 'ash-wolf', 4, 3, pay(1, 25, { potion: hp })),
  d('buyback-clerk', 3, 'deliver', 'cinder-ore', 5, 1, pay(1, 15, { material: residue })),
  d('sexton-wren', 1, 'hunt', 'bone-walker', 4, 6, pay(2, 40, { potion: mp })),
  d('sexton-wren', 2, 'hunt', 'ash-wolf', 6, 3, pay(1, 30)),
  d('sexton-wren', 3, 'deliver', 'world-root-bark', 4, 2, pay(1, 15, { material: bark })),
  d('captain-vey', 1, 'hunt', 'cinder-orc', 6, 10, pay(2, 60, { potion: hp })),
  d('captain-vey', 2, 'hunt', 'orc-firecaller', 4, 13, pay(2, 70)),
  d('captain-vey', 3, 'hunt', 'lava-hound', 5, 10, pay(2, 55, { material: ore })),
  d('forgewife-marr', 1, 'deliver', 'ember-residue', 4, 8, pay(2, 40, { material: ore })),
  d('forgewife-marr', 2, 'deliver', 'cinder-ore', 10, 8, pay(2, 40, { potion: mp })),
  d('forgewife-marr', 3, 'hunt', 'cinder-orc', 5, 10, pay(2, 55)),
  d('scholar-pryor', 1, 'hunt', 'orc-firecaller', 3, 13, pay(2, 60, { potion: mp })),
  d('scholar-pryor', 2, 'hunt', 'lava-hound', 4, 10, pay(2, 50)),
  d('scholar-pryor', 3, 'deliver', 'ember-residue', 3, 8, pay(2, 35, { material: residue })),
  d('harbourmaster-coyle', 1, 'hunt', 'ember-drake', 2, 18, pay(2, 80, { potion: hp })),
  d('harbourmaster-coyle', 2, 'hunt', 'lava-hound', 5, 10, pay(2, 55)),
  d('harbourmaster-coyle', 3, 'deliver', 'world-root-bark', 5, 8, pay(1, 30, { material: ore })),
  d('netter-pell', 1, 'deliver', 'world-root-bark', 4, 8, pay(1, 30, { material: bark })),
  d('netter-pell', 2, 'hunt', 'lava-hound', 4, 10, pay(2, 50, { potion: hp })),
  d('netter-pell', 3, 'hunt', 'ember-drake', 2, 18, pay(2, 80)),
  d('woodward-ashby', 1, 'hunt', 'ash-ghoul', 4, 9, pay(2, 50, { potion: mp })),
  d('woodward-ashby', 2, 'hunt', 'bone-archer', 4, 8, pay(2, 45)),
  d('woodward-ashby', 3, 'deliver', 'world-root-bark', 5, 8, pay(1, 30, { material: residue })),
  d('charburner-kiln', 1, 'deliver', 'world-root-bark', 6, 8, pay(2, 40, { material: residue })),
  d('charburner-kiln', 2, 'hunt', 'bone-archer', 5, 8, pay(2, 50, { potion: hp })),
  d('charburner-kiln', 3, 'hunt', 'ash-ghoul', 5, 9, pay(2, 55)),
  // The Verdant Wilds: a minute of a hunt each (the day's envelope is shared by every giver of every town).
  d('warden-fenn', 1, 'hunt', 'canopy-bat', 6, 15, pay(1, 60, { potion: hp })),
  d('warden-fenn', 2, 'hunt', 'moss-stalker', 5, 17, pay(1, 65, { material: sap })),
  d('warden-fenn', 3, 'deliver', 'verdant-sap', 3, 15, pay(1, 45, { material: bark })),
  d('mossreader-tull', 1, 'hunt', 'thorn-weaver', 3, 28, pay(1, 80, { potion: mp })),
  d('mossreader-tull', 2, 'hunt', 'vine-lasher', 4, 21, pay(1, 70)),
  d('mossreader-tull', 3, 'deliver', 'thornroot', 4, 17, pay(1, 45, { material: sap })),
  d('netmender-brisk', 1, 'deliver', 'thornroot', 4, 17, pay(1, 45, { material: bark })),
  d('netmender-brisk', 2, 'hunt', 'rootgnaw', 4, 19, pay(1, 70, { potion: hp })),
  d('netmender-brisk', 3, 'hunt', 'moss-stalker', 5, 17, pay(1, 65)),
  d('herbalist-sorrel', 1, 'deliver', 'verdant-sap', 4, 15, pay(1, 45, { material: thorn })),
  d('herbalist-sorrel', 2, 'hunt', 'sporecap', 3, 23, pay(1, 75, { potion: mp })),
  d('herbalist-sorrel', 3, 'hunt', 'vine-lasher', 4, 21, pay(1, 70)),
] as TownTask[]).map(priced);

const DAILY_BY_ID = new Map(DAILY_TASKS.map(t => [t.id, t]));
/** A one-time or a daily task by id. */
export function anyTask(id: string): TownTask | undefined { return BY_ID.get(id) ?? DAILY_BY_ID.get(id); }
export function dailyPool(giver: string): readonly TownTask[] { return DAILY_TASKS.filter(t => t.giver === giver); }

/**
 * The day is the LOCAL calendar date (YYYYMMDD): a daily resets at the player's local midnight. Two devices of one
 * player share a time zone, so they agree; the pick below depends on nothing else.
 */
export function dailyDay(now: number | Date = Date.now()): string {
  const t = new Date(now);
  return `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
}
/** The next local midnight after `now` (epoch ms): when today's daily lapses. */
export function dailyResetAt(now: number | Date = Date.now()): number {
  const t = new Date(now);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime();
}
/** Whole days since the epoch for a `YYYYMMDD` day (calendar arithmetic, no zone). */
export function dailyDayNumber(day: string): number {
  return Math.floor(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)) / 86_400_000);
}
/** FNV-1a: a small stable hash, so a pick or a roll never depends on the platform. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** The save key of a daily on a day (`d<YYYYMMDD>-<task id>`): its accepted/progress/claimed entries. */
export function dailyKey(day: string, id: string): string { return `d${day}-${id}`; }

/** The giver's daily for a day: the pool rotates by one each day, offset per giver so towns do not move in step. */
export function dailyOf(giver: string, day: string): TownTask | null {
  const pool = dailyPool(giver);
  if (!pool.length) return null;
  return pool[(dailyDayNumber(day) + hash32(giver)) % pool.length];
}
/** Does this daily's potion drop? Rolled from the day's key alone, so every device reaches the same answer. */
export function dailyPotion(task: TownTask, day: string): string | null {
  const p = task.reward.potion;
  if (!p) return null;
  return hash32(`${dailyKey(day, task.id)}:potion`) / 0x1_0000_0000 < p.chance ? p.id : null;
}

interface TaskSave {
  accepted: Readonly<Record<string, number>>; progress: Readonly<Record<string, number>>; claimed: readonly string[];
  dAccepted?: Readonly<Record<string, number>>; dProgress?: Readonly<Record<string, number>>; dClaimed?: readonly string[];
}
/** A daily's standing today (its giver's one-time tasks are not checked here). */
export function dailyStanding(task: TownTask, day: string, s: TaskSave, held: (materialId: string) => number): { standing: TaskStanding; have: number } {
  const key = dailyKey(day, task.id);
  if (s.dClaimed?.includes(key)) return { standing: 'done', have: task.n };
  if (!(key in (s.dAccepted ?? {}))) return { standing: 'offer', have: 0 };
  const have = Math.min(task.n, task.kind === 'deliver' ? Math.max(0, Math.floor(held(task.target))) : (s.dProgress?.[key] ?? 0));
  return { standing: have >= task.n ? 'ready' : 'active', have };
}
/** Are all of a giver's one-time tasks handed in (the dailies begin)? */
export function dailyUnlocked(giver: string, claimed: readonly string[]): boolean {
  return tasksOf(giver).every(t => claimed.includes(t.id));
}

/** Gold a hand-in pays: the task's fixed sum. Whole Gold. */
export function taskGold(reward: TownTaskReward): number {
  return Math.max(0, Math.floor(reward.gold));
}

export type TaskStanding = 'locked' | 'offer' | 'active' | 'ready' | 'done';

/** What the save and the satchel say about one task (pure; the service feeds it). */
export function taskStanding(
  task: TownTask,
  s: TaskSave,
  held: (materialId: string) => number,
): { standing: TaskStanding; have: number } {
  if (s.claimed.includes(task.id)) return { standing: 'done', have: task.n };
  const chain = tasksOf(task.giver), i = chain.indexOf(task);
  const open = chain.slice(0, i).every(t => s.claimed.includes(t.id));
  if (!(task.id in s.accepted)) return { standing: open ? 'offer' : 'locked', have: 0 };
  const have = Math.min(task.n, task.kind === 'deliver' ? Math.max(0, Math.floor(held(task.target))) : (s.progress[task.id] ?? 0));
  return { standing: have >= task.n ? 'ready' : 'active', have };
}

/** The task a giver speaks of now: a hand-in first, then the one on offer, then the one under way. */
export function giverTask(
  giver: string,
  s: TaskSave,
  held: (materialId: string) => number,
  day: string = dailyDay(),
): { task: TownTask; standing: TaskStanding; have: number } | null {
  const rows = tasksOf(giver).map(task => ({ task, ...taskStanding(task, s, held) }));
  const once = rows.find(r => r.standing === 'ready') ?? rows.find(r => r.standing === 'offer') ?? rows.find(r => r.standing === 'active');
  if (once) return once;
  // Every one-time task is handed in: today's daily (also when it is already done: "come back tomorrow").
  const daily = dailyUnlocked(giver, s.claimed) ? dailyOf(giver, day) : null;
  return daily ? { task: daily, ...dailyStanding(daily, day, s, held) } : null;
}

/** The head mark over a giver: `?` a hand-in, `!` an offer, none otherwise (MapleStory). */
export function giverMark(row: { standing: TaskStanding } | null): '!' | '?' | null {
  return row?.standing === 'ready' ? '?' : row?.standing === 'offer' ? '!' : null;
}
