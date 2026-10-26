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
  /** Protocol 10: an owed credit waits this long for the screen's own number before the room pays its base (ms). */
  askWaitMs: 2500,
  /** At most one credit transaction per Keeper this often (ms); a save not written yet is tried again after retryMs. */
  creditGapMs: 1500,
  retryMs: 5000,
  /** A batch the store never takes is given up after this long (ms). */
  giveUpMs: 600000,
});
/** A Keeper's level, as the room believes it, may rise at most this much a minute (a forged jump is not believed). */
export const LEVEL_RISE_PER_MIN = 3;
/** The room's ground ids: `td:<level>:w.<area>.<boot>.<n>` (the surface, or a floor's own id since protocol 9). */
const DROP_ID = /^td:[a-z0-9-]{1,40}:w\.[a-z0-9_-]{1,40}\.[a-z0-9]{1,12}\.[a-z0-9]{1,12}$/;

/**
 * `sim`: the bundled module (RoomWorld, WORLD_AREAS) or null (the world is off: every area behaves as protocol 6).
 * `send(session, value)`: an event down one stream. `store`: worldLoad/worldSave (social-identity.mjs).
 */
export function createWorldRooms({ sim = null, core = null, store = null, db = null, now = Date.now, send, log = () => {}, areas = null, allAreas = null, timing = {}, seed = () => Math.random().toString(36).slice(2), fx = false } = {}) {
  const T = { ...WORLD_TIMING, ...timing };
  /** Protocol 10: the life, status and credit modules (bundled with the world; absent: the room is protocol 9 for all). */
  const M = sim?.KeeperLife ? sim : core?.KeeperLife ? core : null;
  /** The room's credit transaction (room-credit.ts creditRoom) and the Db it writes through (trade-core's). */
  const credit = typeof M?.creditRoom === 'function' && db ? M.creditRoom : null;
  /** This process's boot, woven into credit batch ids (unique across restarts). */
  const bootId = Math.random().toString(36).slice(2, 10);
  /** Sessions by player id (the world's life accessor), refreshed each step. */
  const byId = new Map();
  /** Kills the room paid lately (a party mate's share is asked for by id): id → {k, area, at}. */
  const recentKills = new Map();
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

  // ── Protocol 10: the Keeper's life on the room (keeper-life.ts) ──
  /** The room keeps this Keeper's life: a protocol-10 client of the world (an older one keeps its own). */
  const lifeOn = s => !!M && enabled && s.world && s.p10;
  /** The most its declared guard may reach: its save's (signed in, read on join), else its level's (a guest). */
  const ceilingOf = s => s.stats?.guard ?? M.guestGuard(s.stats?.level ?? levelOf(s));
  const lifeOf = s => {
    if (!lifeOn(s)) return null;
    if (!s.life) {
      s.life = new M.KeeperLife(M.clampGuard(s.guardSaid ?? null, ceilingOf(s)), Number.isInteger(s.player.hp) && s.player.hp > 0 ? s.player.hp : undefined);
      s.lifeStats = s.stats;
    } else if (s.lifeStats !== s.stats) {
      // The save was read (again): the ceiling may have moved.
      s.lifeStats = s.stats;
      s.life.setGuard(M.clampGuard(s.guardSaid ?? null, ceilingOf(s)));
    }
    return s.life;
  };
  const lifeById = id => { const s = byId.get(id); return s ? lifeOf(s) : null; };

  // ── Protocol 10: XP and Gold paid by the room (room-credit.ts) ──
  /** The room pays this Keeper: protocol 10, signed in, its character named, a store to write to. */
  const creditsOn = s => !!credit && s.p10 && !!s.uid && !!s.character;
  const owedOf = s => (s.owed ??= { items: new Map(), seq: 0, busy: false, lastAt: 0, retryAt: 0, batch: null, done: new Set() });
  const addOwed = (s, item) => {
    const o = owedOf(s);
    if (o.done.has(item.id) || o.items.has(item.id) || o.batch?.items.some(i => i.id === item.id)) return false;
    o.items.set(item.id, { ...item, ask: item.ask ?? null, at: now() });
    return true;
  };
  /** A kill the room just paid out: each fighter that the room credits is owed its XP (the base until it asks). */
  const collectKills = room => {
    const list = room.world?.flushKills?.() ?? [];
    const t = now();
    for (const k of list) {
      recentKills.set(k.id, { k, area: room.area, at: t });
      for (const id of k.by) {
        const s = byId.get(id);
        if (!s || !creditsOn(s)) continue;
        const base = M.fighterXp(k.hp, k.xpK, s.stats?.level ?? levelOf(s), k.level);
        addOwed(s, { id: k.id, kind: 'xp', base, cap: base * M.XP_CAP });
      }
    }
    if (recentKills.size > 2048 || list.length) for (const [id, r] of recentKills) if (t - r.at > 60000) recentKills.delete(id);
  };
  /** Pay what is due (asked for, or waited on long enough), one transaction per Keeper at a time. */
  const payOwed = (s, force = false) => {
    const o = s.owed;
    if (!o || o.busy || !credit) return null;
    const t = now();
    if (!force && t < o.retryAt) return null;
    if (!o.batch) {
      // Owed so long the store never took it (a save never written): given up.
      for (const [id, i] of o.items) if (t - i.at >= T.giveUpMs) { o.items.delete(id); creditStats.failed++; }
      if (!o.items.size || (!force && t - o.lastAt < T.creditGapMs)) return null;
      const due = [...o.items.values()].filter(i => force || i.ask !== null || t - i.at >= T.askWaitMs).slice(0, 64);
      if (!due.length) return null;
      for (const i of due) o.items.delete(i.id);
      o.batch = { id: `b.${bootId}.${s.uid.slice(0, 12)}.${++o.seq}`, at: t, area: s.player.area,
        items: due.map(i => ({ id: i.id, ...(i.kind === 'xp' ? { xp: M.owed(i.base, i.cap, i.ask) } : { gold: M.owed(i.base, i.cap, i.ask) }) })) };
    }
    if (!o.batch.items.length) { o.batch = null; return null; }
    const b = o.batch;
    o.busy = true; o.lastAt = t;
    const t0 = performance.now();
    return credit(db, { uid: s.uid, character: s.character, batch: b.id, area: b.area, items: b.items }, t).then(r => {
      o.batch = null;
      // An id whose document is not written yet (its purse, its activity) waits for the next batch.
      const kept = new Set(r.kept ?? []);
      for (const i of b.items) {
        if (kept.has(i.id)) { o.items.set(i.id, { id: i.id, kind: i.xp ? 'xp' : 'gold', base: i.xp ?? i.gold, cap: i.xp ?? i.gold, ask: i.xp ?? i.gold, at: b.at }); continue; }
        o.done.add(i.id); if (o.done.size > 2000) o.done.delete(o.done.values().next().value);
      }
      if (kept.size) o.retryAt = now() + T.retryMs;
      creditStats.batches++; creditStats.xp += r.xp; creditStats.gold += r.gold; creditStats.dup += r.dup.length; creditStats.ms = Math.round((creditStats.ms * 4 + (performance.now() - t0)) / 5 * 10) / 10;
      send(s, { type: 'world-credit', ok: true, xp: r.xp, gold: r.gold, debt: r.debtPaid, ids: [...r.paid, ...r.dup] });
    }, e => {
      // A save the client has not written yet, or an answer lost on the way (the commit may have landed): kept and tried
      // again — the same batch, so it can never pay twice (room-credit.ts: the ring). A refusal the save gave is final.
      const final = typeof e?.status === 'number' && e.status < 500 && e.code !== 'no-save';
      if (!final && now() - b.at < T.giveUpMs) { o.retryAt = now() + T.retryMs; creditStats.retries++; return; }
      o.batch = null; creditStats.failed++;
      log('room credit failed', e);
      send(s, { type: 'world-credit', ok: false, xp: 0, gold: 0, debt: 0, ids: b.items.map(i => i.id), why: e?.code ?? 'failed' });
    }).finally(() => { o.busy = false; });
  };
  const creditStats = { batches: 0, xp: 0, gold: 0, dup: 0, retries: 0, failed: 0, ms: 0 };
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
      const w = new sim.RoomWorld({ area, seed: `${seed()}|${term}`, now, life: lifeById });
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
    byId.clear();
    for (const s of seen) byId.set(s.player.id, s);
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
      // Protocol 10: a Keeper at zero past its grace is down (everyone near sees it); the kills' credit is owed.
      for (const s of room.members.values()) if (lifeOf(s)?.tick(t)) w.downed(s.player.id);
      collectKills(room);
      room.snapAcc += dt * 1000;
      // The ground goes right after the snapshots, never before: the kill that left it reaches each screen first, so
      // the loot lies beside a corpse that is already there.
      if (room.snapAcc >= T.snapMs) { room.snapAcc = 0; snaps(room); flush(room); }
      if (w.dirty && t - room.savedAt >= T.saveMs) void persist(room);
    }
    for (const s of seen) if (s.owed) void payOwed(s);
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
    /**
     * A Keeper's blows (the `/coop/hits` body's hits, already validated field by field) and, protocol 10, its statuses.
     * The answer names what the room refused and why (the screen's small cue).
     */
    claims(s, hits, st = []) {
      const room = roomOf(s);
      if (!room?.world || !room.members.has(s.player.id)) throw fail(409, 'Not in the world.');
      room.world.keeper(keeperOf(s));
      // (What a kill left is told after the next snapshot carries the kill: step.)
      const r = hits.length ? room.world.claims(s.player.id, hits) : { landed: 0, refused: 0, dmg: 0, no: [] };
      const out = s.p10 ? r : { landed: r.landed, refused: r.refused, dmg: r.dmg };
      if (s.p10 && st.length && room.world.statuses) out.st = room.world.statuses(s.player.id, st);
      collectKills(room);
      return out;
    },
    /** Protocol 10: the room keeps this Keeper's life. */
    lifeOn: s => !!lifeOf(s),
    /** Protocol 10: the room pays this Keeper's XP and Gold. */
    creditsOn,
    /**
     * Protocol 10: a Keeper's life claims (keeper-life.ts) and its declared guard. Answered with its life as the room
     * keeps it now.
     */
    life(s, data) {
      const L = lifeOf(s);
      if (!L) throw fail(409, 'Update the game to have your life kept.');
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => k !== 'g' && k !== 'c')) throw fail(400, 'Invalid life.');
      if (data.g !== undefined) {
        const g = M.parseGuard(data.g);
        if (!g) throw fail(400, 'Invalid guard.');
        s.guardSaid = g;
        L.setGuard(M.clampGuard(g, ceilingOf(s)));
      }
      const list = data.c ?? [];
      if (!Array.isArray(list) || list.length > 24) throw fail(400, 'Invalid life.');
      const claims = list.map(c => M.parseLifeClaim(c));
      if (claims.some(c => !c)) throw fail(400, 'Invalid life claim.');
      const t = now(), r = claims.map(c => L.claim(c, t).n);
      return { ok: true, me: L.view(), n: r };
    },
    /**
     * Protocol 10: the screen's own numbers for what it is owed (a kill's XP with its worn XP and boons, a pile's Gold
     * with its Gold Find and potion) — never past the cap — and a party mate's share of a kill it stood by.
     */
    ask(s, list) {
      if (!creditsOn(s)) return { ok: false, n: 0 };
      if (!Array.isArray(list) || list.length > 32) throw fail(400, 'Invalid credit.');
      let n = 0;
      const o = owedOf(s);
      for (const a of list) {
        if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !/^[A-Za-z0-9:._~-]{1,96}$/.test(a.id) || !Number.isInteger(a.n) || a.n < 0 || a.n > 1e7) throw fail(400, 'Invalid credit.');
        const it = o.items.get(a.id);
        if (it) { it.ask = a.n; n++; continue; }
        if (a.s !== 1) continue;
        // A party mate's share: it stood near a kill one of its party fought, and did not fight it itself.
        const rk = recentKills.get(a.id);
        if (!rk || rk.k.by.includes(s.player.id) || s.player.area !== rk.area || !s.party) continue;
        if (!rk.k.by.some(id => byId.get(id)?.party === s.party)) continue;
        if (Math.hypot(s.player.x - rk.k.x, s.player.y - rk.k.y) > 24 * 16) continue;
        const base = Math.max(1, Math.round(M.fighterXp(rk.k.hp, rk.k.xpK, s.stats?.level ?? levelOf(s), rk.k.level) * M.SHARE));
        if (addOwed(s, { id: a.id, kind: 'xp', base, cap: base * M.XP_CAP, ask: a.n })) n++;
      }
      return { ok: true, n };
    },
    /** The Keeper left: whatever it is owed is paid now (best effort). */
    left(s) { return s.owed ? payOwed(s, true) : null; },
    /** A Keeper reaches for a piece of the ground. */
    take(s, id) {
      const room = roomOf(s);
      if (typeof id !== 'string' || !DROP_ID.test(id)) throw fail(400, 'Invalid take.');
      if (!room?.world || !room.members.has(s.player.id)) return { ok: false, why: 'area' };
      room.world.keeper(keeperOf(s));
      const r = room.world.take(id, s.player.id);
      flush(room);
      // Protocol 10: its Gold is the room's to pay (the base pile until the screen asks for its own number).
      if (r.ok && r.drop.coins > 0 && creditsOn(s)) {
        addOwed(s, { id: r.drop.id, kind: 'gold', base: r.drop.coins, cap: M.goldCap(r.drop.coins) });
        return { ...r, pays: true };
      }
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
      return { ok: true, id, stats: { ...room.world.stats }, mobs: room.world.mobs.mobs.map(m => ({ id: m.nid ?? '', t: m.def.id, hp: Math.round(m.hp), x: Math.round(m.x), y: Math.round(m.y), st: room.world.statusBits?.(m) ?? 0 })), ground: room.world.groundList() };
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
        ...(credit ? { credits: { ...creditStats } } : {}),
      };
    },
    /** Save every awake area (shutdown: Cloud Run's SIGTERM gives ten seconds). */
    async saveAll() { await Promise.all([...rooms.values()].map(persist), ...seen.filter(s => s.owed).map(s => payOwed(s, true))); },
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
