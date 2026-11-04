/**
 * td-marches.spec.ts — S11 part 2, the Umbral Marches as an act (docs/world/campaign.md S11; docs/design/world-acts.md
 * §1.4, §2.4, §5.4): the accept-when list, as tests. Each section is its own area; no seam is an invisible wall (the
 * fen's edge is black water, its ways boardwalks across it); every section and connector floor has one thing to read,
 * one sealed thing and one sound; the Pilgrims' Boardwalk breaks off and the Sunken Belfry is the only way past it, with
 * the fifth bell's door sealed; the Bog Galleries are the only way to the Drowned Ruins; Mirewatch to the crypts' door
 * is about 15 minutes; the hot spots spawn their packs in their own clearings; the Bell Under the Water pays once.
 */
import { CONTINENTS, LEVELS, RENAMED_CONTINENTS, landOf } from './td-levels';
import { TdWorld } from './td-world';
import { HandLevel, footFree } from './td-level';
import { TILE } from './td-art';
import { MARCHES_BIBLE, MARCHES_ROUTE, SEAM_CLEAR, SEAM_PAST, seamArrival, seamPast } from './td-sections';
import { zoneOf } from './td-zones';
import { WORLD_AREAS_ALL } from '../world/room-world';
import { hearthsOf } from './td-hearth';
import { buildBoard } from './td-harbour';
import { MARCHES_I18N } from './td-marches.i18n';
import { NIGHT_PLACES, NightEvents, UNDERBELL_AREA } from './td-night-events';
import { NIGHT_REWARDS, UNDERBELL, nightEventsAt, underbellRing } from '../../shared/night-events/night-events.model';
import { ECLIPSE, nextEclipse } from '../../shared/world-clock/world-clock.model';
import { WORLD_BOSSES } from '../world/world-bosses';
import { BOARDWALK_SECTION, BROKEN_END, MERES_SECTION, THREE_POSTS_AT } from './maps/umbral-sections';
import { GATHER_MEANING, KEYHOLE_RUBBING_ID } from '../../shared/gathering/gathering.model';

const MARCHES = Object.keys(CONTINENTS).filter(id => landOf(id) === 'umbral-marches');
const FLOORS = ['sunken-belfry-1', 'bog-galleries-1', 'bog-galleries-2'];
const SPEED = 4.6; // tiles a second (world-acts.md §0: td-engine SPEED, before Move Speed)
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
const segDist = (c: number, r: number, [x0, y0]: readonly [number, number], [x1, y1]: readonly [number, number]) => {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, t = Math.max(0, Math.min(1, ((c - x0) * (x1 - x0) + (r - y0) * (y1 - y0)) / (L * L)));
  return Math.hypot(c - (x0 + (x1 - x0) * t), r - (y0 + (y1 - y0) * t));
};
/** Every tile a Keeper can walk to from a section's Waystone (or its capital's square). */
function reachable(id: string, w: TdWorld): Set<string> {
  const start = id === 'umbral-marches-gloamhaven' ? [24, 21] : [8, 7];
  const seen = new Set([start.join(',')]), q = [start];
  while (q.length) {
    const [c, r] = q.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c + dc},${r + dr}`;
      if (seen.has(k) || Math.abs(c + dc) > 400 || Math.abs(r + dr) > 300 || !w.walkable(c + dc, r + dr)) continue;
      seen.add(k); q.push([c + dc, r + dr]);
    }
  }
  return seen;
}
/** Tiles a stair-to-stair walk on a floor takes (BFS), or Infinity. */
function floorWalk(id: string, from: string, to: string): number {
  const lv = new HandLevel(LEVELS[id]);
  const at = (sid: string) => { const s = lv.stalls.find(x => x.station.id === sid)!; return [Math.floor(s.x / TILE), Math.floor((s.y - 7) / TILE)] as const; };
  const [sc, sr] = at(from), [tc, tr] = at(to);
  const dist = new Map<string, number>([[`${sc},${sr}`, 0]]), q: (readonly [number, number])[] = [[sc, sr]];
  while (q.length) {
    const [c, r] = q.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${c + dc},${r + dr}`;
      if (dist.has(k) || !(lv.walkable(c + dc, r + dr) || (c + dc === tc && r + dr === tr))) continue;
      dist.set(k, dist.get(`${c},${r}`)! + 1); q.push([c + dc, r + dr]);
    }
  }
  return dist.get(`${tc},${tr}`) ?? Infinity;
}

describe('S11 part 2: the Umbral Marches as an act of sections', () => {
  it('has the six sections and Gloamhaven, each its own area the room runs; the old single area lands in Gloamhaven', () => {
    expect(MARCHES.sort()).toEqual(['umbral-marches-boardwalk', 'umbral-marches-deep-fen', 'umbral-marches-fen', 'umbral-marches-gloamhaven',
      'umbral-marches-meres', 'umbral-marches-ruins', 'umbral-marches-shore']);
    for (const id of [...MARCHES, ...FLOORS]) {
      expect(WORLD_AREAS_ALL).withContext(id).toContain(id);
      expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
    }
    expect(CONTINENTS['umbral-marches']).toBeUndefined();
    expect(RENAMED_CONTINENTS['umbral-marches']).toBe('umbral-marches-gloamhaven');
  });

  it('every region of every section has its zone row, inside the act\'s band; the connectors their own', () => {
    for (const id of MARCHES) for (const row of CONTINENTS[id].map) for (const ch of row) {
      const z = zoneOf(`${id}:${ch}`);
      expect(z).withContext(`${id}:${ch}`).not.toBeNull();
      expect(z!.band[0]).toBeGreaterThanOrEqual(26);
      expect(z!.band[1]).toBeLessThanOrEqual(50);
    }
    expect(zoneOf('sunken-belfry-1')!.band).toEqual([30, 32]);
    expect(zoneOf('bog-galleries-1')!.band[0]).toBe(35);
    expect(zoneOf('bog-galleries-2')!.band[1]).toBe(38);
  });

  it('every seam is paired, walked through (a boardwalk across the black water), and sets the Keeper down 6 tiles inside with nothing near', () => {
    for (const id of MARCHES) {
      const w = new TdWorld(CONTINENTS[id]);
      for (const sm of CONTINENTS[id].seams ?? []) {
        const far = CONTINENTS[sm.to], back = far?.seams?.find(x => x.id === sm.arrive);
        expect(back).withContext(`${id} ${sm.id}`).toBeDefined();
        expect(back!.to).toBe(id);
        expect(back!.arrive).toBe(sm.id);
        const [dc, dr] = STEP[sm.dir];
        for (let k = 0; k <= SEAM_PAST + 2; k++) expect(w.walkable(sm.c + dc * k, sm.r + dr * k)).withContext(`${id} ${sm.id} +${k} ${w.ground(sm.c + dc * k, sm.r + dr * k)}`).toBeTrue();
        expect(seamPast(sm, sm.c + dc * SEAM_PAST, sm.r + dr * SEAM_PAST)).toBeTrue();
        expect(seamPast(sm, sm.c, sm.r)).toBeFalse();
        for (const side of [-12, 12]) {
          const c = sm.c + dc * 10 + (dc ? 0 : side), r = sm.r + dr * 10 + (dr ? 0 : side);
          expect(w.walkable(c, r)).withContext(`${id} ${sm.id} beside the boards (${c},${r}) ${w.ground(c, r)}`).toBeFalse();
          expect(w.ground(c, r)).withContext(`${id} ${sm.id}: the fen too deep to wade`).toBe('blackwater');
        }
        const fw = new TdWorld(far), a = seamArrival(back!);
        expect(footFree(fw, a.c * TILE + TILE / 2, a.r * TILE + TILE - 2)).withContext(`${sm.to} arrival`).toBeTrue();
        const near = fw.spawnsIn((a.c - 12) * TILE, (a.r - 12) * TILE, (a.c + 12) * TILE, (a.r + 12) * TILE).filter(s => Math.hypot(s.x / TILE - a.c, s.y / TILE - a.r) <= SEAM_CLEAR);
        expect(near.map(s => s.key)).withContext(`${sm.to} arrival from ${id}`).toEqual([]);
      }
    }
  });

  it('every section and connector floor has one thing to read, one sealed thing and one sound (the zone bible\'s check), EN + ES', () => {
    for (const area of [...MARCHES, ...FLOORS]) {
      const b = MARCHES_BIBLE[area];
      expect(b).withContext(area).toBeDefined();
      const stalls = CONTINENTS[area] ? new TdWorld(CONTINENTS[area]).stalls : new HandLevel(LEVELS[area]).stalls;
      expect(stalls.some(s => s.station.id === b.read)).withContext(`${area} read`).toBeTrue();
      expect(stalls.some(s => s.station.id === b.sealed)).withContext(`${area} sealed`).toBeTrue();
      for (const lang of ['en', 'es'] as const) {
        expect(MARCHES_I18N[`reach.read.${b.read.slice(5)}`]?.[lang]).withContext(`${b.read} ${lang}`).toBeTruthy();
        expect(MARCHES_I18N[`reach.sealed.${b.sealed.slice(7)}`]?.[lang]).withContext(`${b.sealed} ${lang}`).toBeTruthy();
      }
      expect(b.sound.every[0]).toBeGreaterThan(0);
    }
    for (const id of MARCHES) for (const lang of ['en', 'es'] as const) expect(MARCHES_I18N[`atlas.near.${CONTINENTS[id].stone!.id.slice(8)}`]?.[lang]).withContext(`${id} atlas ${lang}`).toBeTruthy();
  });

  it('every mark, stone, way and seam stands where a Keeper walking from the section\'s Waystone can reach it', () => {
    for (const id of MARCHES) {
      const w = new TdWorld(CONTINENTS[id]), seen = reachable(id, w);
      for (const st of w.stalls) {
        if (!/^(tdstone|seam|read|sealed|sunken-belfry|belfry-roof|bog-galleries|cutters-stair|drowned-crypts|ship-)/.test(st.station.id)) continue;
        const c = Math.floor(st.x / TILE), r = Math.floor((st.y - 7) / TILE);
        const ok = [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [0, 2], [1, 1], [-1, 1]].some(([dc, dr]) => seen.has(`${c + dc},${r + dr}`));
        expect(ok).withContext(`${id} ${st.station.id} at ${c},${r}`).toBeTrue();
      }
    }
  });

  it('one Waystone a section, on safe ground; hearths only in the towns (Gloamhaven has the Shrine; Mirewatch and Lanternfen their own)', () => {
    const ids = MARCHES.map(id => CONTINENTS[id].stone?.id);
    expect(ids.every(i => !!i && i.startsWith('marches:'))).toBeTrue();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of MARCHES) {
      const w = new TdWorld(CONTINENTS[id]), st = w.stalls.find(s => s.station.id === `tdstone:${CONTINENTS[id].stone!.id}`)!;
      expect(st).withContext(id).toBeDefined();
      expect(w.safeAt(Math.floor(st.x / TILE), Math.floor(st.y / TILE) - 1)).withContext(id).toBeTrue();
      const villages = (CONTINENTS[id].villages ?? []).length, camp = CONTINENTS[id].townKind === 'camp';
      expect(hearthsOf(w).length).withContext(id).toBe((camp ? 0 : 1) + villages);
      expect(hearthsOf(w).some(h => !!h.shrine)).withContext(id).toBe(id === 'umbral-marches-gloamhaven');
    }
  });

  it('the Pilgrims\' Boardwalk breaks off in the water: no seam past it, its piles stand on, and the Sunken Belfry is the only way on', () => {
    const w = new TdWorld(BOARDWALK_SECTION), broken = BOARDWALK_SECTION.marks!.find(m => m.id === 'sealed:boardwalk-broken')!;
    expect(broken.look).toBe('piles');
    // The road runs up to its last board; past it, nothing walks (piles over black water), wall to wall of the cut.
    expect(w.walkable(BROKEN_END.c, BROKEN_END.r + 1)).toBeTrue();
    for (let k = 0; k < broken.span!.rows; k++) for (let d = -3; d <= 3; d++) expect(w.walkable(BROKEN_END.c + d, BROKEN_END.r - k)).withContext(`${d},${k}`).toBeFalse();
    expect(MARCHES_I18N['reach.sealed.boardwalk-broken'].en).toContain('the way on is down through it');
    // The boardwalk's only seam goes back to the Fen; nothing but the Belfry's far mouth comes up on the Meres.
    expect((BOARDWALK_SECTION.seams ?? []).map(s => s.to)).toEqual(['umbral-marches-fen']);
    for (const id of MARCHES) for (const sm of CONTINENTS[id].seams ?? []) if (sm.to === 'umbral-marches-meres') expect(id).toBe('umbral-marches-deep-fen');
    expect(w.ways.get('sunken-belfry')).toEqual({ to: 'sunken-belfry-1', arrive: 'belfry-up', ship: false });
    expect(new TdWorld(MERES_SECTION).ways.get('belfry-roof')).toEqual({ to: 'sunken-belfry-1', arrive: 'belfry-out', ship: false });
    const exits = [...new HandLevel(LEVELS['sunken-belfry-1']).exits.values()];
    expect(exits).toContain({ to: 'surface', arrive: 'sunken-belfry', continent: 'umbral-marches-boardwalk' });
    expect(exits).toContain({ to: 'surface', arrive: 'belfry-roof', continent: 'umbral-marches-meres' });
    expect(floorWalk('sunken-belfry-1', 'belfry-up', 'belfry-out')).toBeLessThan(Infinity);
  });

  it('the Sunken Belfry\'s fifth bell\'s door is sealed: a door with a bell-shaped keyhole, shut, and the water past it out of reach', () => {
    const lv = new HandLevel(LEVELS['sunken-belfry-1']), door = lv.stalls.find(s => s.station.id === 'sealed:belfry-fifth-door')!;
    const c = Math.floor(door.x / TILE), r = Math.floor((door.y - 7) / TILE);
    expect(lv.walkable(c, r)).withContext('the door is shut').toBeFalse();
    // The chamber behind it is never reached from either stair.
    const seen = new Set<string>(), q = [[12, 4]];
    seen.add('12,4');
    while (q.length) { const [x, y] = q.shift()!; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dc},${y + dr}`; if (!seen.has(k) && lv.walkable(x + dc, y + dr)) { seen.add(k); q.push([x + dc, y + dr]); } } }
    expect(seen.has(`${c},${r + 1}`)).withContext('behind the door').toBeFalse();
    expect(seen.has(`${c},${r - 1}`)).withContext('in front of the door').toBeTrue();
    expect(MARCHES_I18N['reach.sealed.belfry-fifth-door'].en).toContain('the shape of a bell');
    expect(MARCHES_BIBLE['sunken-belfry-1'].sound).toEqual({ cue: 'underbell', every: [40, 40] });
    // The ringer's glove on its hook (the hidden thing).
    expect(lv.stalls.some(s => s.station.id === 'read:belfry-glove')).toBeTrue();
    expect(MARCHES_I18N['reach.read.belfry-glove'].en).toContain('Pull on four. Never on five.');
    expect(MARCHES_I18N['reach.read.belfry-glove'].es).toContain('Tira en el cuatro. Nunca en el cinco.');
  });

  it('the Bog Galleries are the only way to the Drowned Ruins: in by the Deep Fen\'s peat-cut, down, out up the cutters\' stair', () => {
    const exits = (id: string) => [...new HandLevel(LEVELS[id]).exits.values()];
    expect(exits('bog-galleries-1')).toContain({ to: 'surface', arrive: 'bog-galleries', continent: 'umbral-marches-deep-fen' });
    expect(exits('bog-galleries-2')).toContain({ to: 'surface', arrive: 'cutters-stair', continent: 'umbral-marches-ruins' });
    expect(new TdWorld(CONTINENTS['umbral-marches-deep-fen']).ways.get('bog-galleries')).toEqual({ to: 'bog-galleries-1', arrive: 'galleries-out', ship: false });
    expect(new TdWorld(CONTINENTS['umbral-marches-ruins']).ways.get('cutters-stair')).toEqual({ to: 'bog-galleries-2', arrive: 'galleries-far', ship: false });
    expect(CONTINENTS['umbral-marches-ruins'].seams ?? []).toEqual([]);
    for (const id of MARCHES) for (const sm of CONTINENTS[id].seams ?? []) expect(sm.to).not.toBe('umbral-marches-ruins');
    expect(floorWalk('bog-galleries-1', 'galleries-out', 'galleries1-down')).toBeLessThan(Infinity);
    expect(floorWalk('bog-galleries-2', 'galleries2-up', 'galleries-far')).toBeLessThan(Infinity);
  });

  it('the walk from Mirewatch\'s pier to the Drowned Crypts\' door is about 15 minutes (13–16), no fighting', () => {
    let tiles = 0;
    for (const step of MARCHES_ROUTE) {
      const def = CONTINENTS[step.area];
      if (def) { const r = def.roads[0]; for (let i = 1; i < r.length; i++) tiles += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); continue; }
      const t = floorWalk(step.area, step.from!, step.to!);
      expect(t).withContext(`${step.area} crossable`).toBeLessThan(Infinity);
      tiles += t * .9;
    }
    const minutes = tiles / SPEED / 60;
    expect(minutes).toBeGreaterThanOrEqual(13);
    expect(minutes).toBeLessThanOrEqual(16);
  });

  it('the hot spots stand off the road in their own clearings: a camp, a champion ground, a den', () => {
    const want: Readonly<Record<string, { id: string; prefix: string; n: number }>> = {
      'umbral-marches-meres': { id: 'lure-pools', prefix: 'camp', n: 8 },
      'umbral-marches-deep-fen': { id: 'knights-causeway', prefix: 'cg', n: 6 },
      'umbral-marches-ruins': { id: 'witchs-island', prefix: 'den', n: 1 },
    };
    for (const [area, k] of Object.entries(want)) {
      const def = CONTINENTS[area], w = new TdWorld(def), camp = def.camps!.find(c => c.id === k.id)!, seen = reachable(area, w);
      const all = w.spawnsIn((camp.c - 24) * TILE, (camp.r - 24) * TILE, (camp.c + 24) * TILE, (camp.r + 24) * TILE);
      const sp = all.filter(s => s.key.startsWith(`${k.prefix}:${k.id}:`));
      expect(sp.length).withContext(area).toBe(k.n);
      const others = all.filter(s => !s.key.startsWith(`${k.prefix}:${k.id}:`) && Math.hypot(s.x / TILE - camp.c, s.y / TILE - camp.r) < 18);
      expect(others.map(s => s.key)).withContext(`${area} others`).toEqual([]);
      for (const road of def.roads) for (let i = 1; i < road.length; i++) expect(segDist(camp.c, camp.r, road[i - 1], road[i])).withContext(`${area} road ${i}`).toBeGreaterThanOrEqual(8);
      // A Keeper can walk to every one of its pack (the bog holds firm round a hot spot).
      for (const s of sp) expect([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${Math.floor(s.x / TILE) + dc},${Math.floor(s.y / TILE) - 1 + dr}`))).withContext(`${area} ${s.key}`).toBeTrue();
      expect(w.placeName(camp.c * TILE, camp.r * TILE)).toBe(camp.name);
    }
    // The Lantern Ring stands in the Drowned Ruins (the Seam Eater 55's rift).
    expect(CONTINENTS['umbral-marches-ruins'].places.some(p => p.kind === 'standing-stones' && p.name === 'The Lantern Ring')).toBeTrue();
  });

  it('the Black Meres hold the Three Posts (S10b\'s Fogmother): no road but its own boards, camp, stone or seam within 30 tiles; walked to', () => {
    const m = MERES_SECTION;
    expect(m.map[Math.floor(THREE_POSTS_AT.r / 8) + m.oy][Math.floor(THREE_POSTS_AT.c / 8) + m.ox]).toBe('k');
    expect(m.places.some(p => p.kind === 'mere-posts' && p.c === THREE_POSTS_AT.c && p.r === THREE_POSTS_AT.r)).toBeTrue();
    const fog = WORLD_BOSSES.find(b => b.id === 'fogmother')!;
    expect(fog.area).toBe('umbral-marches-meres');
    expect(fog.at).toEqual({ c: THREE_POSTS_AT.c, r: THREE_POSTS_AT.r });
    expect(reachable('umbral-marches-meres', new TdWorld(m)).has(`${THREE_POSTS_AT.c},${THREE_POSTS_AT.r + 4}`)).toBeTrue();
    const own = m.roads[m.roads.length - 1];
    expect(Math.hypot(own[own.length - 1][0] - THREE_POSTS_AT.c, own[own.length - 1][1] - THREE_POSTS_AT.r)).toBeGreaterThanOrEqual(11);
    for (const road of m.roads.slice(0, -1)) for (let i = 1; i < road.length; i++) expect(segDist(THREE_POSTS_AT.c, THREE_POSTS_AT.r, road[i - 1], road[i])).withContext(`road ${i}`).toBeGreaterThan(30);
    for (const k of m.camps ?? []) expect(Math.hypot(k.c - THREE_POSTS_AT.c, k.r - THREE_POSTS_AT.r)).toBeGreaterThan(30);
    for (const sm of m.seams ?? []) expect(Math.hypot(sm.c - THREE_POSTS_AT.c, sm.r - THREE_POSTS_AT.r)).toBeGreaterThan(30);
    expect(Math.hypot(m.stone!.c - THREE_POSTS_AT.c, m.stone!.r - THREE_POSTS_AT.r)).toBeGreaterThan(30);
    expect(new TdWorld(m).walkable(THREE_POSTS_AT.c, THREE_POSTS_AT.r)).toBeTrue();
  });

  it('the old ways still land: Pyrehold\'s and Mossharbor\'s ships at Mirewatch, the Lantern Tower in Gloamhaven, the crypts in the Ruins', () => {
    const shore = new TdWorld(CONTINENTS['umbral-marches-shore']);
    expect(shore.ways.get('ship-mirewatch')).toEqual({ to: 'infernal-reach-pyrehold', arrive: 'ship-umbral', ship: true });
    expect(new TdWorld(CONTINENTS['infernal-reach-pyrehold']).ways.get('ship-umbral')?.to).toBe('umbral-marches-shore');
    expect(new TdWorld(CONTINENTS['verdant-wilds-shore']).ways.get('ship-mossharbor-marches')?.to).toBe('umbral-marches-shore');
    expect(new TdWorld(CONTINENTS['umbral-marches-ruins']).ways.get('drowned-crypts')).toEqual({ to: 'drowned-crypts-1', arrive: 'crypts-out', ship: false });
    expect([...new HandLevel(LEVELS['drowned-crypts-1']).exits.values()].some(e => e.continent === 'umbral-marches-ruins')).toBeTrue();
    expect([...new HandLevel(LEVELS['lantern-tower-0']).exits.values()].some(e => e.continent === 'umbral-marches-gloamhaven')).toBeTrue();
    expect(new TdWorld(CONTINENTS['umbral-marches-gloamhaven']).stalls.some(s => s.station.id === 'lantern-tower-door')).toBeTrue();
    expect(WORLD_BOSSES.find(b => b.id === 'ser-wickless')!.area).toBe('umbral-marches-ruins');
    const board = buildBoard('mirewatch', { continents: CONTINENTS, level: 40, gold: 1e6 });
    expect(board.find(r => r.destPier === 'pyrehold')!.state).toBe('ok');
  });
});

describe('S11 part 2: the Bell Under the Water (the Black Meres, under an eclipse)', () => {
  // The first eclipse after the clock's epoch, and a moment in it.
  const ecl = nextEclipse(Date.UTC(2026, 0, 3)), ring = underbellRing(ecl.id);
  const roof = { x: NIGHT_PLACES.roof[0] * TILE + TILE / 2, y: NIGHT_PLACES.roof[1] * TILE + TILE - 2 };
  const run = (ev: NightEvents, keeper: () => { x: number; y: number }, from: number, secs: number) => {
    const out = [];
    for (let t = 0; t < secs; t += .25) out.push(...ev.update({ ms: ecl.startMs + (from + t) * 1000, area: UNDERBELL_AREA, surface: true, keeper: keeper(), dt: .25 }));
    return out;
  };

  it('rings in the Meres under an eclipse, a seeded minute or two in, and never at night or elsewhere', () => {
    expect(nightEventsAt(UNDERBELL_AREA, ecl.startMs + 5000).some(e => e.id === 'bell-under-water')).toBeTrue();
    expect(nightEventsAt('umbral-marches-deep-fen', ecl.startMs + 5000).some(e => e.id === 'bell-under-water')).toBeFalse();
    expect(nightEventsAt(UNDERBELL_AREA, ecl.endMs + 60_000).some(e => e.id === 'bell-under-water')).toBeFalse();
    expect(ring).toBeGreaterThanOrEqual(UNDERBELL.ring);
    expect(ring).toBeLessThan(UNDERBELL.ring + UNDERBELL.spread);
    expect(ECLIPSE.end - ECLIPSE.start).toBeGreaterThan((ring + UNDERBELL.still) / 60);
    expect(new TdWorld(MERES_SECTION).walkable(NIGHT_PLACES.roof[0], NIGHT_PLACES.roof[1])).toBeTrue();
  });

  it('one note: heard across the Meres, every Lampfish dark; standing still by the roof through it pays the keyhole rubbing once', () => {
    const ev = new NightEvents(), here = { ...roof };
    const before = run(ev, () => here, ring - 5, 4);
    expect(before.some(n => n.kind === 'sfx')).toBeFalse();
    expect(ev.lampsOut()).toBeFalse();
    const note = run(ev, () => here, ring - 1, 2);
    expect(note.filter(n => n.kind === 'sfx' && n.cue === 'underbell').length).toBe(1);
    expect(note.some(n => n.kind === 'line' && n.key === 'nightev.underbell.ring')).toBeTrue();
    expect(ev.lampsOut()).toBeTrue();
    const after = run(ev, () => here, ring + 1, UNDERBELL.still + 1);
    expect(after.filter(n => n.kind === 'reward' && n.id === 'bell-under-water').length).toBe(1);
    expect(after.some(n => n.kind === 'line' && n.key === 'nightev.underbell.keyhole')).toBeTrue();
    expect(ev.underbell()!.keyhole).toBeTrue();
    // Once an eclipse: standing on pays nothing more.
    expect(run(ev, () => here, ring + UNDERBELL.still + 2, 6).some(n => n.kind === 'reward')).toBeFalse();
    expect(NIGHT_REWARDS['bell-under-water'].stacks).toEqual([{ id: KEYHOLE_RUBBING_ID, qty: 1 }]);
    expect(GATHER_MEANING.some(m => m.id === KEYHOLE_RUBBING_ID && m.sources.length && m.uses.length)).toBeTrue();
  });

  it('moving after the note, or standing far off, ends it with nothing (it never hurts or chases)', () => {
    const moved = new NightEvents();
    let k = { ...roof };
    run(moved, () => k, ring - 1, 2);
    k = { x: roof.x + 3 * TILE, y: roof.y };
    const news = run(moved, () => k, ring + 1, UNDERBELL.still + 2);
    expect(news.some(n => n.kind === 'line' && n.key === 'nightev.underbell.moved')).toBeTrue();
    expect(news.some(n => n.kind === 'reward')).toBeFalse();
    const far = new NightEvents(), away = { x: roof.x + 60 * TILE, y: roof.y };
    const heard = run(far, () => away, ring - 1, UNDERBELL.still + 4);
    expect(heard.some(n => n.kind === 'reward')).toBeFalse();
  });
});
