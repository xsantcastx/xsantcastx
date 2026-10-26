// The room-run world (Hearth protocol 7; docs/design/online.md "Phase 8: the room simulates").
//
// In a world area (WORLD_AREAS: the Seamworks island's surface first) the room is the host. It runs the game's own
// creature simulation (src/app/play/world/room-world.ts, bundled by world-sim-build.mjs) and streams it to every
// Keeper there as the `coop-snap` a party host sends (protocol 5), from the reserved host id '@room', so a client
// draws the room's creatures exactly as a party member draws its host's. Keepers send intents only:
//   - their blows as `/coop/hits` claims (weighed here: range by the room's record, line of sight, the level budget);
//   - `/world/take` for a piece of the ground (first allowed Keeper wins, answered from memory), `/world/return` when
//     a full satchel cannot hold it.
// The room decides creature life, hits, deaths, loot rolls and the ground. An area with nobody in it sleeps: what must
// survive (the ground, the spawns resting) is written to Firestore `world-rooms/{area}` and read back on the next wake.
//
// A client says `world: true` on /join; an older one never does, so it never hears '@room' and keeps simulating its own
// creatures, exactly as before (protocol 6).

/** The reserved host id (never a player's: player ids are UUIDs). Mirrors play/social/world-protocol.ts. */
export const ROOM_HOST = '@room';
export const WORLD_TIMING = Object.freeze({
  /** The simulation step (ms): 20 a second. */
  tickMs: 50,
  /** Snapshots to each Keeper (ms): 8 a second, as a party host sends. */
  snapMs: 125,
  /**
   * Protocol 9: with nobody in the WORLD this long the room writes every area and sleeps (ms). (M1/M2 slept one area
   * once it was empty; now every area stays simulated while any Keeper is anywhere: life goes on where nobody stands.)
   */
  sleepMs: 30000,
  /** An area nobody stands in is stepped this often (ms): the dormant tick — its fallen rest on, nothing moves. */
  idleMs: 1000,
  /** While awake, what must survive is written at most this often when it changed (ms). */
  saveMs: 60000,
  /** A wake waits at most this long for the store (ms); then the area wakes empty. */
  loadMs: 5000,
});
/** A Keeper's level, as the room believes it, may rise at most this much a minute (a forged jump is not believed). */
export const LEVEL_RISE_PER_MIN = 3;
/** The room's ground ids: `td:<level>:w.<area>.<boot>.<n>` (the surface, or a floor's own id since protocol 9). */
const DROP_ID = /^td:[a-z0-9-]{1,40}:w\.[a-z0-9_-]{1,40}\.[a-z0-9]{1,12}\.[a-z0-9]{1,12}$/;

/**
 * `sim`: the bundled module (RoomWorld, WORLD_AREAS) or null (the world is off: every area behaves as protocol 6).
 * `send(session, value)`: an event down one stream. `store`: worldLoad/worldSave (social-identity.mjs).
 */
export function createWorldRooms({ sim = null, core = null, store = null, now = Date.now, send, log = () => {}, areas = null, allAreas = null, timing = {}, seed = () => Math.random().toString(36).slice(2), fx = false } = {}) {
  const T = { ...WORLD_TIMING, ...timing };
  /** Protocol 7/8 clients: the island only (M1). Protocol 9: every continent and every floor (M3). */
  const worldAreas = new Set(areas ?? sim?.WORLD_AREAS ?? []);
  const everyArea = new Set([...worldAreas, ...(allAreas ?? sim?.WORLD_AREAS_ALL ?? [])]);
  const enabled = !!sim && worldAreas.size > 0;
  /** Per area: the world (null while it wakes), the Keepers streaming there, timers. */
  const rooms = new Map();
  let wakes = 0;
  /** The world is awake (someone is in it) since; empty since (ms, 0: someone is). */
  let awake = false, emptySince = 0;
  /** The sessions of the last step (the omens go to every protocol-9 Keeper of the world). */
  let seen = [];
  /**
   * Weather v1 (shared/weather): the room owns the sky's roll. Each window (6 real minutes) it sends every protocol-9
   * Keeper in the world the window and each land's roll from its own clock, and sends it again to a stream that opens;
   * so two devices whose clocks disagree still see one sky. The rules and the look are the client's (weather.model).
   */
  let weatherSent = -1;
  const weatherMsg = () => {
    if (typeof sim?.weatherRolls !== 'function') return null;
    const t = now(), window = sim.weatherWindow(t);
    return { type: 'world-weather', window, now: t, lands: sim.weatherRolls(window) };
  };
  const weather = (force = null) => {
    const msg = weatherMsg();
    if (!msg) return;
    if (force) { if (force.world && force.p9 && force.stream) send(force, msg); return; }
    if (msg.window === weatherSent) return;
    weatherSent = msg.window;
    for (const s of seen) if (s.world && s.p9 && s.stream) send(s, msg);
  };
  /** The room's own cost: the last minute's step times (ms) and how many areas it stepped. */
  const cost = { steps: 0, ms: 0, maxMs: 0, at: now() };
  const areasOf = s => (s?.p9 ? everyArea : worldAreas);
  /** Is this area run by the room (for this session: a protocol 7/8 client knows only the island)? */
  const isWorldArea = (area, s = null) => enabled && typeof area === 'string' && (s ? areasOf(s) : everyArea).has(area);
  /** Is this session part of the room-run world where it stands now? */
  const inWorld = s => enabled && s.world && isWorldArea(s.player.area, s);

  /**
   * Protocol 8: the damage a second the room allows a Keeper's blows. Signed in with its character named, its save says
   * (`s.stats`, world/keeper-budget.ts: read on join, again every few minutes). A guest, or a protocol-8 Keeper whose
   * save is still being read: the conservative guest budget. A protocol-7 signed-in Keeper (no character named): the
   * level budget as before, until that client refreshes.
   */
  const dpsOf = s => {
    if (s.stats?.dps > 0) return { dps: s.stats.dps };
    const b = sim ?? core;
    if ((!s.uid || s.character) && typeof b?.guestBudget === 'function') return { dps: b.guestBudget(levelOf(s)) };
    return {};
  };
  const keeperOf = s => ({ id: s.player.id, x: s.player.x, y: s.player.y, level: s.stats?.level ?? levelOf(s), ...dpsOf(s) });
  /** The level the room believes: the one reported, but never more than LEVEL_RISE_PER_MIN above what it believed a minute ago. */
  const levelOf = s => {
    const said = Number.isInteger(s.player.level) ? s.player.level : 1;
    const t = now();
    if (!s.worldLevel) s.worldLevel = { level: said, at: t };
    const w = s.worldLevel;
    if (said <= w.level) { w.level = said; w.at = t; }
    else { const may = w.level + Math.floor((t - w.at) / 60000 * LEVEL_RISE_PER_MIN); if (may > w.level) { w.level = Math.min(said, may); w.at = t; } }
    return Math.max(1, Math.min(999, w.level));
  };

  const wake = area => {
    const term = ++wakes;
    const room = { area, term, world: null, members: new Map(), emptySince: 0, snapAcc: 0, idleAcc: 0, savedAt: now(), last: now(), loading: true };
    rooms.set(area, room);
    const ready = saved => {
      if (rooms.get(area) !== room) return;
      const w = new sim.RoomWorld({ area, seed: `${seed()}|${term}`, now });
      w.term = term;
      try { w.load(saved); } catch (e) { log('world load failed', e); }
      room.world = w; room.loading = false; room.last = now();
      for (const s of room.members.values()) { w.keeper(keeperOf(s)); groundTo(s, w); }
    };
    if (!store?.worldLoad) { ready(null); return room; }
    // A sleep still being written finishes first (a quick return must not read the area from before it); a store that
    // does not answer in T.loadMs wakes the area empty rather than leave its Keepers waiting.
    const read = Promise.resolve(saving.get(area)).then(() => store.worldLoad(area));
    const late = new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('timed out')), T.loadMs); t.unref?.(); });
    Promise.race([read, late]).then(ready, e => { log('world read failed', e); ready(null); });
    return room;
  };
  /** Saves in flight, by area (a wake waits for its area's). */
  const saving = new Map();
  const persist = room => {
    if (!room.world || !store?.worldSave) return Promise.resolve();
    const doc = room.world.save();
    room.savedAt = now();
    const p = store.worldSave(room.area, doc).catch(e => { room.world && (room.world.dirty = true); log('world write failed', e); })
      .finally(() => { if (saving.get(room.area) === p) saving.delete(room.area); });
    saving.set(room.area, p);
    return p;
  };
  const groundTo = (s, w) => { if (s.stream) send(s, { type: 'world-ground', area: w.area, items: w.groundList() }); };
  /** The election as one area's Keepers see it: the room hosts, these are there. */
  const viewOf = room => ({ host: ROOM_HOST, term: room.term, members: [...room.members.keys()] });

  /**
   * Who is where, from the sessions (each step): a world session streaming in a world area is a member of that area.
   * Returns the sessions whose view of the world changed (they hear `coop` again).
   */
  const sync = sessions => {
    const changed = new Set();
    const want = new Map();
    seen = [...sessions];
    let anyone = false;
    for (const s of seen) {
      if (enabled && s.world && s.stream) anyone = true;
      if (inWorld(s) && s.stream) { const a = s.player.area; if (!want.has(a)) want.set(a, new Map()); want.get(a).set(s.player.id, s); }
    }
    // Someone is in the world: every area wakes (each from its own document, fast-forwarded) and stays awake.
    if (anyone) { emptySince = 0; if (!awake) { awake = true; for (const a of everyArea) if (!rooms.has(a)) wake(a); } }
    else if (awake && !emptySince) emptySince = now();
    for (const [area] of want) if (!rooms.has(area)) wake(area);
    for (const room of rooms.values()) {
      const next = want.get(room.area) ?? new Map();
      let moved = false;
      for (const [id, s] of room.members) if (!next.has(id)) { room.members.delete(id); room.world?.leave(id); changed.add(s); moved = true; }
      for (const [id, s] of next) if (!room.members.has(id)) {
        room.members.set(id, s); moved = true;
        if (room.world) { room.world.keeper(keeperOf(s)); groundTo(s, room.world); }
      }
      if (moved) for (const s of room.members.values()) changed.add(s);
      room.emptySince = room.members.size ? 0 : (room.emptySince || now());
    }
    return changed;
  };

  /** One step of every awake area: feed the Keepers' positions, simulate, stream snapshots and the ground; sleep the empty. */
  const step = (sessions, ms = null) => {
    const changed = sync(sessions);
    const t = now(), t0 = performance.now();
    // The sky's window turned: every Keeper in the world hears the new roll; a Keeper who just joined hears it now.
    if (enabled) { weather(); for (const s of changed) weather(s); }
    // Nobody left anywhere in the world for its grace: every area is written (what changed) and the room sleeps.
    if (awake && emptySince && t - emptySince >= T.sleepMs) {
      awake = false; emptySince = 0;
      for (const room of [...rooms.values()]) { rooms.delete(room.area); if (room.world?.dirty) void persist(room); }
      return changed;
    }
    for (const room of [...rooms.values()]) {
      const w = room.world;
      if (!w) continue;
      const dt = (ms ?? (t - room.last)) / 1000;
      room.last = t;
      if (!room.members.size) {
        // The dormant tick: once a second, time passes here (the fallen rest on, the ground crumbles, bosses' clocks).
        room.idleAcc += dt;
        if (room.idleAcc * 1000 >= T.idleMs) { try { w.idle(room.idleAcc); } catch (e) { log('world idle failed', e); } room.idleAcc = 0; }
        omens(room);
        if (w.dirty && t - room.savedAt >= T.saveMs) void persist(room);
        continue;
      }
      if (room.idleAcc > 0) { try { w.idle(room.idleAcc); } catch (e) { log('world idle failed', e); } room.idleAcc = 0; }
      for (const s of room.members.values()) w.keeper(keeperOf(s));
      try { w.tick(dt); } catch (e) { log('world tick failed', e); }
      omens(room);
      room.snapAcc += dt * 1000;
      // The ground goes right after the snapshots, never before: the kill that left it reaches each screen first, so
      // the loot lies beside a corpse that is already there.
      if (room.snapAcc >= T.snapMs) { room.snapAcc = 0; snaps(room); flush(room); }
      if (w.dirty && t - room.savedAt >= T.saveMs) void persist(room);
    }
    const spent = performance.now() - t0;
    cost.steps++; cost.ms += spent; cost.maxMs = Math.max(cost.maxMs, spent);
    if (t - cost.at >= 60000) { cost.last = { steps: cost.steps, avgMs: Math.round(cost.ms / Math.max(1, cost.steps) * 1000) / 1000, maxMs: Math.round(cost.maxMs * 1000) / 1000 }; cost.steps = 0; cost.ms = 0; cost.maxMs = 0; cost.at = t; }
    return changed;
  };
  /** A world boss rose, fell or left: every protocol-9 Keeper in the world hears its omen (the line is the client's). */
  const omens = room => {
    const list = room.world.flushOmens?.() ?? [];
    for (const o of list) for (const s of seen) if (s.world && s.p9 && s.stream) send(s, { type: 'world-omen', ...o });
  };
  const snaps = room => {
    for (const s of room.members.values()) {
      if (!s.stream) { room.world.resync(s.player.id); continue; }
      const body = room.world.snapFor(s.player.id);
      if (body) send(s, { type: 'coop-snap', from: ROOM_HOST, term: room.world.term, ...body });
    }
  };
  const flush = room => {
    const { add, gone } = room.world.flushGround();
    if (!add.length && !gone.length) return;
    for (const s of room.members.values()) send(s, { type: 'world-ground', area: room.area, ...(add.length ? { add } : {}), ...(gone.length ? { gone } : {}) });
  };
  const roomOf = s => (inWorld(s) ? rooms.get(s.player.area) : null) ?? null;
  const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, extra });

  return {
    enabled, isWorldArea, inWorld, ROOM_HOST,
    /** The world's part of this session's `coop` view: its area, hosted by the room (empty when not in the world). */
    viewFor(s) { const room = roomOf(s); return room && room.members.has(s.player.id) ? { [room.area]: viewOf(room) } : {}; },
    sync, step,
    /** A stream (re)opened: the next snapshot is whole, and the ground is sent. */
    opened(s) { const room = roomOf(s); if (room?.world) { room.world.resync(s.player.id); groundTo(s, room.world); } weather(s); },
    /** A Keeper's blows (the `/coop/hits` body's hits, already validated field by field). */
    claims(s, hits) {
      const room = roomOf(s);
      if (!room?.world || !room.members.has(s.player.id)) throw fail(409, 'Not in the world.');
      room.world.keeper(keeperOf(s));
      // (What a kill left is told after the next snapshot carries the kill: step.)
      return room.world.claims(s.player.id, hits);
    },
    /** A Keeper reaches for a piece of the ground. */
    take(s, id) {
      const room = roomOf(s);
      if (typeof id !== 'string' || !DROP_ID.test(id)) throw fail(400, 'Invalid take.');
      if (!room?.world || !room.members.has(s.player.id)) return { ok: false, why: 'area' };
      room.world.keeper(keeperOf(s));
      const r = room.world.take(id, s.player.id);
      flush(room);
      return r;
    },
    /** The taker's satchel could not hold it: it lies again. */
    giveBack(s, id) {
      const room = roomOf(s);
      if (typeof id !== 'string' || !DROP_ID.test(id)) throw fail(400, 'Invalid return.');
      const ok = !!room?.world && room.world.giveBack(id, s.player.id);
      if (room?.world) flush(room);
      return ok;
    },
    /** The local e2e's hooks (SOCIAL_WORLD_FX=1, refused on Cloud Run): lay a creature, quiet the wild spawns. */
    fx(s, data) {
      if (!fx) throw fail(404, 'Not found.');
      const room = roomOf(s);
      if (!room?.world) throw fail(409, 'Not in the world.');
      if (data.quiet === true) room.world.fxQuiet();
      if (typeof data.boss === 'string') room.world.fxBossNow(data.boss);
      let id = null;
      if (data.lay && typeof data.lay === 'object') {
        const { type, dx, dy, calm } = data.lay;
        if (typeof type !== 'string' || !/^[a-z0-9-]{1,40}$/.test(type) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 400 || Math.abs(dy) > 400) throw fail(400, 'Invalid lay.');
        id = room.world.fxLay(type, s.player.x + dx, s.player.y + dy, calm === true);
      }
      return { ok: true, id, stats: { ...room.world.stats }, mobs: room.world.mobs.mobs.map(m => ({ id: m.nid ?? '', t: m.def.id, hp: Math.round(m.hp), x: Math.round(m.x), y: Math.round(m.y) })), ground: room.world.groundList() };
    },
    /** The health line: the areas awake and their Keepers. */
    health() {
      const all = [...rooms.values()], mem = process.memoryUsage();
      return {
        areas: [...worldAreas], every: everyArea.size, loaded: all.filter(r => r.world).length,
        awake: all.filter(r => r.members.size).map(r => ({ area: r.area, keepers: r.members.size, creatures: r.world?.mobs.mobs.length ?? 0, ground: r.world?.ground.size ?? 0 })),
        creatures: all.reduce((n, r) => n + (r.world?.mobs.mobs.length ?? 0), 0), ground: all.reduce((n, r) => n + (r.world?.ground.size ?? 0), 0),
        resting: all.reduce((n, r) => n + (r.world?.restingNow?.().length ?? 0), 0),
        bosses: all.flatMap(r => (r.world?.bossesUp?.() ?? []).map(b => ({ area: r.area, ...b }))),
        step: cost.last ?? { steps: cost.steps, avgMs: Math.round(cost.ms / Math.max(1, cost.steps) * 1000) / 1000, maxMs: Math.round(cost.maxMs * 1000) / 1000 },
        rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576),
      };
    },
    /** Save every awake area (shutdown: Cloud Run's SIGTERM gives ten seconds). */
    async saveAll() { await Promise.all([...rooms.values()].map(persist)); },
    /** The specs: an area's world, or null. */
    worldOf(area) { return rooms.get(area)?.world ?? null; },
    rooms,
    /** The weather the room sends now (the specs and /health). */
    weatherNow: () => weatherMsg(),
    /** The specs: what the room feeds the world for this Keeper (its level and claim budget). */
    keeperOf,
  };
}

/**
 * In a checkout with the sources and TypeScript: compiled in memory. On Cloud Run: the bundled world
 * (world-sim.generated.mjs, written by world-sim-build.mjs at deploy). Null when neither is there: the world stays off and the room is protocol 6.
 */
export async function loadWorldSim(log = () => {}) {
  // In a checkout (not on Cloud Run) the sources win: a bundle left over from an earlier build must never run stale.
  if (!process.env.K_SERVICE) {
    try { const b = await import('./world-sim-build.mjs'); return b.load(); } catch (e) { if (e?.code !== 'ERR_MODULE_NOT_FOUND') log('world sources failed', e); }
  }
  try { return await import('./world-sim.generated.mjs'); } catch (e) { log('world bundle unavailable', e); return null; }
}
