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
  /** An area empty this long goes to sleep (ms): a reload or a cave trip and back keeps it awake. */
  sleepMs: 30000,
  /** While awake, what must survive is written at most this often when it changed (ms). */
  saveMs: 60000,
  /** A wake waits at most this long for the store (ms); then the area wakes empty. */
  loadMs: 5000,
});
/** A Keeper's level, as the room believes it, may rise at most this much a minute (a forged jump is not believed). */
export const LEVEL_RISE_PER_MIN = 3;
const DROP_ID = /^td:surface:w\.[a-z0-9_-]{1,40}\.[a-z0-9]{1,12}\.[a-z0-9]{1,12}$/;

/**
 * `sim`: the bundled module (RoomWorld, WORLD_AREAS) or null (the world is off: every area behaves as protocol 6).
 * `send(session, value)`: an event down one stream. `store`: worldLoad/worldSave (social-identity.mjs).
 */
export function createWorldRooms({ sim = null, store = null, now = Date.now, send, log = () => {}, areas = null, timing = {}, seed = () => Math.random().toString(36).slice(2), fx = false } = {}) {
  const T = { ...WORLD_TIMING, ...timing };
  const worldAreas = new Set(areas ?? sim?.WORLD_AREAS ?? []);
  const enabled = !!sim && worldAreas.size > 0;
  /** Per area: the world (null while it wakes), the Keepers streaming there, timers. */
  const rooms = new Map();
  let wakes = 0;
  const isWorldArea = area => enabled && typeof area === 'string' && worldAreas.has(area);
  /** Is this session part of the room-run world where it stands now? */
  const inWorld = s => enabled && s.world && isWorldArea(s.player.area);

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
    const room = { area, term, world: null, members: new Map(), emptySince: 0, snapAcc: 0, savedAt: now(), last: now(), loading: true };
    rooms.set(area, room);
    const ready = saved => {
      if (rooms.get(area) !== room) return;
      const w = new sim.RoomWorld({ area, seed: `${seed()}|${term}`, now });
      w.term = term;
      try { w.load(saved); } catch (e) { log('world load failed', e); }
      room.world = w; room.loading = false; room.last = now();
      for (const s of room.members.values()) { w.keeper({ id: s.player.id, x: s.player.x, y: s.player.y, level: levelOf(s) }); groundTo(s, w); }
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
    for (const s of sessions) if (inWorld(s) && s.stream) { const a = s.player.area; if (!want.has(a)) want.set(a, new Map()); want.get(a).set(s.player.id, s); }
    for (const [area, members] of want) if (!rooms.has(area)) wake(area);
    for (const room of rooms.values()) {
      const next = want.get(room.area) ?? new Map();
      let moved = false;
      for (const [id, s] of room.members) if (!next.has(id)) { room.members.delete(id); room.world?.leave(id); changed.add(s); moved = true; }
      for (const [id, s] of next) if (!room.members.has(id)) {
        room.members.set(id, s); moved = true;
        if (room.world) { room.world.keeper({ id, x: s.player.x, y: s.player.y, level: levelOf(s) }); groundTo(s, room.world); }
      }
      if (moved) for (const s of room.members.values()) changed.add(s);
      room.emptySince = room.members.size ? 0 : (room.emptySince || now());
    }
    return changed;
  };

  /** One step of every awake area: feed the Keepers' positions, simulate, stream snapshots and the ground; sleep the empty. */
  const step = (sessions, ms = null) => {
    const changed = sync(sessions);
    const t = now();
    for (const room of [...rooms.values()]) {
      const w = room.world;
      if (!w) continue;
      if (!room.members.size) {
        if (t - room.emptySince >= T.sleepMs) { rooms.delete(room.area); void persist(room); }
        continue;
      }
      const dt = (ms ?? (t - room.last)) / 1000;
      room.last = t;
      for (const s of room.members.values()) w.keeper({ id: s.player.id, x: s.player.x, y: s.player.y, level: levelOf(s) });
      try { w.tick(dt); } catch (e) { log('world tick failed', e); }
      room.snapAcc += dt * 1000;
      // The ground goes right after the snapshots, never before: the kill that left it reaches each screen first, so
      // the loot lies beside a corpse that is already there.
      if (room.snapAcc >= T.snapMs) { room.snapAcc = 0; snaps(room); flush(room); }
      if (w.dirty && t - room.savedAt >= T.saveMs) void persist(room);
    }
    return changed;
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
    opened(s) { const room = roomOf(s); if (room?.world) { room.world.resync(s.player.id); groundTo(s, room.world); } },
    /** A Keeper's blows (the `/coop/hits` body's hits, already validated field by field). */
    claims(s, hits) {
      const room = roomOf(s);
      if (!room?.world || !room.members.has(s.player.id)) throw fail(409, 'Not in the world.');
      room.world.keeper({ id: s.player.id, x: s.player.x, y: s.player.y, level: levelOf(s) });
      // (What a kill left is told after the next snapshot carries the kill: step.)
      return room.world.claims(s.player.id, hits);
    },
    /** A Keeper reaches for a piece of the ground. */
    take(s, id) {
      const room = roomOf(s);
      if (typeof id !== 'string' || !DROP_ID.test(id)) throw fail(400, 'Invalid take.');
      if (!room?.world || !room.members.has(s.player.id)) return { ok: false, why: 'area' };
      room.world.keeper({ id: s.player.id, x: s.player.x, y: s.player.y, level: levelOf(s) });
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
      let id = null;
      if (data.lay && typeof data.lay === 'object') {
        const { type, dx, dy, calm } = data.lay;
        if (typeof type !== 'string' || !/^[a-z0-9-]{1,40}$/.test(type) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 400 || Math.abs(dy) > 400) throw fail(400, 'Invalid lay.');
        id = room.world.fxLay(type, s.player.x + dx, s.player.y + dy, calm === true);
      }
      return { ok: true, id, stats: { ...room.world.stats }, mobs: room.world.mobs.mobs.map(m => ({ id: m.nid ?? '', t: m.def.id, hp: Math.round(m.hp), x: Math.round(m.x), y: Math.round(m.y) })), ground: room.world.groundList() };
    },
    /** The health line: the areas awake and their Keepers. */
    health() { return { areas: [...worldAreas], awake: [...rooms.values()].map(r => ({ area: r.area, keepers: r.members.size, creatures: r.world?.mobs.mobs.length ?? 0, ground: r.world?.ground.size ?? 0 })) }; },
    /** Save every awake area (shutdown: Cloud Run's SIGTERM gives ten seconds). */
    async saveAll() { await Promise.all([...rooms.values()].map(persist)); },
    /** The specs: an area's world, or null. */
    worldOf(area) { return rooms.get(area)?.world ?? null; },
    rooms,
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
