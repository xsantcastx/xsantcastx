/**
 * pets-save.model.ts — the Keeper's pets, as saved.
 *
 * Saved through the gateway as `godforge-pets` (synced: progress/pets). One
 * record per pet ever found, plus the small tallies that find them (a crate
 * opened, a creature cleared from a corridor, a patch harvested):
 *
 *   got      when it was found (an egg in hand, or a rescued pet); the earlier wins
 *   hatched  when it came out of its egg (a rescue is born hatched); the earlier wins
 *   name     what the Keeper called it, with `nameAt`; the later naming wins whole
 *   love     the affection meter (only grows, never decays: no streaks, no neglect)
 *   feedDay  the local day of its last meal, with `feeds` that day (the daily
 *            appetite: a full pet waits for tomorrow, it is never hungry or hurt)
 *   hat      the hat worn (once love has unlocked it), with `hatAt`; later wins
 *   xp       pet experience, grown by use (pet-roles.ts levels); max wins
 *   findDay  the local day of its last find, with `scouts` and `trinkets` that
 *            day (the daily cap on what it digs up); the later day wins, same
 *            day: the larger counts
 *
 * `active` (with `activeAt`) is the one pet following the Keeper; later wins.
 * `command` (with `commandAt`) is what the Keeper told it from the pet card
 * (pet-roles.ts PetCommand: follow / stay / fight / gather / play); later wins.
 * `tally` counts what finds a pet (max per key: each device counted its own
 * visits, and the larger is the truer).
 *
 * Every rule only grows or takes the later choice, so the merge is commutative
 * and idempotent, and signing in never costs a pet.
 *
 * No imports: cloud-save.model.ts is eager and imports this merge.
 */
export const PETS_KEY = 'godforge-pets';

/** The affection ceiling (pets.model.ts LOVE_MAX mirrors it; the spec pins them equal). */
export const PET_LOVE_CEILING = 12;

const ID = /^[a-z][a-z-]{1,30}$/;
const TALLY = /^[a-z]+:[a-z0-9-]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PETS = 16;
const MAX_TALLY = 32;
const NAME_MAX = 16;

export interface PetRecord {
  got: number;
  hatched: number;
  name: string;
  nameAt: number;
  love: number;
  feedDay: string;
  feeds: number;
  hat: boolean;
  hatAt: number;
  xp: number;
  findDay: string;
  scouts: number;
  trinkets: number;
}

/** What the Keeper told the pet (pet-roles.ts PET_COMMANDS; copied so this file stays import-free). */
const COMMANDS = ['follow', 'stay', 'fight', 'gather', 'play'];
const PET_XP_CEILING = 100_000;

export interface PetsState {
  version: 1;
  pets: Record<string, PetRecord>;
  active: string;
  activeAt: number;
  tally: Record<string, number>;
  command: string;
  commandAt: number;
}

export function emptyPets(): PetsState {
  return { version: 1, pets: {}, active: '', activeAt: 0, tally: {}, command: 'follow', commandAt: 0 };
}

/** A pet just found: nothing grown yet. */
export function newPetRecord(at: number, hatched: number): PetRecord {
  return { got: at, hatched, name: '', nameAt: 0, love: 0, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0 };
}

const stamp = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const count = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);

/** A name as the Keeper may give it: no markup, no control characters, one line, ≤ 16 characters. */
export function cleanPetName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

function record(raw: unknown): PetRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const got = stamp(r['got']);
  if (!got) return null;
  const hatched = stamp(r['hatched']);
  const feedDay = typeof r['feedDay'] === 'string' && DAY.test(r['feedDay']) ? r['feedDay'] : '';
  const findDay = typeof r['findDay'] === 'string' && DAY.test(r['findDay']) ? r['findDay'] : '';
  return {
    got,
    hatched: hatched ? Math.max(hatched, got) : 0,
    name: cleanPetName(r['name']),
    nameAt: stamp(r['nameAt']),
    love: count(r['love'], PET_LOVE_CEILING),
    feedDay,
    feeds: feedDay ? count(r['feeds'], 99) : 0,
    hat: r['hat'] === true,
    hatAt: stamp(r['hatAt']),
    xp: count(r['xp'], PET_XP_CEILING),
    findDay,
    scouts: findDay ? count(r['scouts'], 99) : 0,
    trinkets: findDay ? count(r['trinkets'], 99) : 0,
  };
}

/** Anything to a valid state: junk ids, junk records and over-long maps are dropped. */
export function coercePets(raw: unknown): PetsState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyPets();
  const r = raw as Record<string, unknown>;
  const pets: Record<string, PetRecord> = {};
  const src = r['pets'];
  if (src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
      if (Object.keys(pets).length >= MAX_PETS) break;
      const rec = ID.test(id) ? record(v) : null;
      if (rec) pets[id] = rec;
    }
  }
  const tally: Record<string, number> = {};
  const t = r['tally'];
  if (t && typeof t === 'object' && !Array.isArray(t)) {
    for (const [k, v] of Object.entries(t as Record<string, unknown>)) {
      if (Object.keys(tally).length >= MAX_TALLY) break;
      const n = count(v, 1_000_000);
      if (TALLY.test(k) && n) tally[k] = n;
    }
  }
  const active = typeof r['active'] === 'string' && pets[r['active']]?.hatched ? r['active'] : '';
  const command = typeof r['command'] === 'string' && COMMANDS.includes(r['command']) ? r['command'] : 'follow';
  return { version: 1, pets, active, activeAt: active ? stamp(r['activeAt']) : 0, tally, command, commandAt: stamp(r['commandAt']) };
}

const earlier = (a: number, b: number): number => (!a ? b : !b ? a : Math.min(a, b));

/** One pet seen from two devices. */
function mergeRecord(a: PetRecord, b: PetRecord): PetRecord {
  const named = b.nameAt > a.nameAt || (b.nameAt === a.nameAt && b.name > a.name) ? b : a;
  const fed = b.feedDay > a.feedDay ? b : a.feedDay > b.feedDay ? a : null;
  const hat = b.hatAt > a.hatAt || (b.hatAt === a.hatAt && b.hat && !a.hat) ? b : a;
  const found = b.findDay > a.findDay ? b : a.findDay > b.findDay ? a : null;
  const got = earlier(a.got, b.got);
  const hatched = earlier(a.hatched, b.hatched);
  return {
    got,
    hatched: hatched ? Math.max(hatched, got) : 0,
    name: named.name,
    nameAt: named.nameAt,
    love: Math.max(a.love, b.love),
    feedDay: fed ? fed.feedDay : a.feedDay,
    feeds: fed ? fed.feeds : Math.max(a.feeds, b.feeds),
    hat: hat.hat,
    hatAt: hat.hatAt,
    xp: Math.max(a.xp, b.xp),
    findDay: found ? found.findDay : a.findDay,
    scouts: found ? found.scouts : Math.max(a.scouts, b.scouts),
    trinkets: found ? found.trinkets : Math.max(a.trinkets, b.trinkets),
  };
}

/** Two devices' pets into one. Commutative and idempotent; a pet is never lost. */
export function mergePets(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coercePets(remote), l = coercePets(local);
  const pets: Record<string, PetRecord> = {};
  for (const id of [...new Set([...Object.keys(l.pets), ...Object.keys(r.pets)])].sort()) {
    const a = l.pets[id], b = r.pets[id];
    pets[id] = a && b ? mergeRecord(a, b) : (a ?? b)!;
  }
  const tally: Record<string, number> = { ...l.tally };
  for (const [k, v] of Object.entries(r.tally)) tally[k] = Math.max(tally[k] ?? 0, v);
  const pick = r.activeAt > l.activeAt || (r.activeAt === l.activeAt && r.active > l.active) ? r : l;
  const told = r.commandAt > l.commandAt || (r.commandAt === l.commandAt && r.command > l.command) ? r : l;
  return coercePets({ version: 1, pets, active: pick.active, activeAt: pick.activeAt, tally, command: told.command, commandAt: told.commandAt } satisfies PetsState);
}
