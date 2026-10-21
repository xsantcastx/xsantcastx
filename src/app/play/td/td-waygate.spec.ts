/**
 * td-waygate.spec.ts — town portals (td-waygate.ts): where they open and where not, the trip there and back to the
 * exact spot, the lifetime, the party's use through presence, the scroll's price, and the spell on the common page.
 */
import { ARRIVE_BELOW, TdWaygates, WAYGATE_ARM, WAYGATE_SECS, bossFighting, decodeGate, encodeGate, nearestHearth, townGateAt, waygateBlock, type WaygateHost, type WaygateSpot } from './td-waygate';
import { CLASS_SKILLS, SKILLS, STARTER_RANKS } from './td-skills';
import { HUD_I18N } from '../world/hud.i18n';
import { SCROLL_MIN_PRICE, WAYGATE_SCROLL_ID, waygateScrollPrice } from '../../shared/waygate/waygate-scroll';
import { huntGold } from '../../shared/economy/economy-curve';
import { materialDisplay } from '../../shared/rpg/material-catalog';
import { cleanPresence } from '../social/social-room';

/** A tiny world: a field on one continent, two hearths, the Keeper movable, travel recorded. */
function rig(o: Partial<{ inTown: boolean; boss: boolean; seam: boolean; party: { id: string; gate: string }[] }> = {}) {
  const me: WaygateSpot = { continent: 'ember', level: 'surface', x: 1000, y: 600 };
  const said: string[] = [], trips: WaygateSpot[] = [];
  const state = { inTown: o.inTown ?? false, boss: o.boss ?? false, seam: o.seam ?? false, party: o.party ?? [] };
  const host: WaygateHost = {
    here: () => ({ ...me }),
    hearths: () => [{ id: 'hearth:ember:far', x: 4000, y: 4000 }, { id: 'hearth:ember:near', x: 1200, y: 500 }],
    inTown: () => state.inTown, bossFight: () => state.boss, seamFight: () => state.seam,
    travel: to => { trips.push({ ...to }); Object.assign(me, to); return true; },
    say: k => { said.push(k); }, partyGates: () => state.party,
  };
  return { me, said, trips, state, gates: new TdWaygates(host) };
}

describe('td-waygate: where a portal opens', () => {
  it('not in a town, not at the Seam Eater, not while a boss fights', () => {
    expect(waygateBlock({ inTown: true, bossFight: false, seamFight: false })).toBe('waytown');
    expect(waygateBlock({ inTown: false, bossFight: false, seamFight: true })).toBe('wayseam');
    expect(waygateBlock({ inTown: false, bossFight: true, seamFight: false })).toBe('wayboss');
    expect(waygateBlock({ inTown: false, bossFight: false, seamFight: false })).toBeNull();
    for (const k of ['waytown', 'wayseam', 'wayboss'] as const) {
      expect(rig({ inTown: k === 'waytown', seam: k === 'wayseam', boss: k === 'wayboss' }).gates.open(0)).toBe(k);
    }
  });

  it('a boss fights near when it stands in its sight, or hurt within twice that; a far, whole one does not', () => {
    const boss = (x: number, hp = 100) => ({ x, y: 0, hp, def: { rank: 'boss', hp: 100, sight: 100 } });
    expect(bossFighting({ x: 0, y: 0 }, [boss(120)])).toBe(true);
    expect(bossFighting({ x: 0, y: 0 }, [boss(400)])).toBe(false);
    expect(bossFighting({ x: 0, y: 0 }, [boss(200, 40)])).toBe(true);
    expect(bossFighting({ x: 0, y: 0 }, [{ x: 10, y: 0, hp: 50, def: { rank: 'normal', hp: 50, sight: 100 } }])).toBe(false);
    expect(bossFighting({ x: 0, y: 0 }, [boss(10, 0)])).toBe(false);
  });

  it('the town end stands beside the nearest hearth of this continent', () => {
    const r = rig();
    expect(r.gates.open(0)).toBeNull();
    expect(r.gates.own?.town.hearth).toBe('hearth:ember:near');
    expect(r.gates.own?.town).toEqual(jasmine.objectContaining({ continent: 'ember', level: 'surface', ...townGateAt({ x: 1200, y: 500 }) }));
    expect(nearestHearth([], null)).toBeNull();
  });
});

describe('td-waygate: there and back', () => {
  it('steps through to town, then back to the exact spot, and the pair closes', () => {
    const r = rig(), start = { ...r.me };
    r.gates.open(0);
    // Standing on it as it opens: it waits until the feet have left.
    r.gates.step(1);
    expect(r.trips.length).toBe(0);
    r.me.y += WAYGATE_ARM + 4; r.gates.step(2);
    r.me.y = start.y; r.gates.step(3);
    expect(r.trips.length).toBe(1);
    const town = r.gates.own!.town;
    expect(r.me).toEqual(jasmine.objectContaining({ continent: 'ember', level: 'surface', x: town.x, y: town.y + ARRIVE_BELOW }));
    expect(r.said).toContain('play.waygate.arrived');
    // Back through the town's portal (once the feet are off it): the very spot, and both portals are gone.
    r.gates.step(3.5);
    r.me.x = town.x; r.me.y = town.y; r.gates.step(4);
    expect(r.trips.length).toBe(2);
    expect(r.me).toEqual(start);
    expect(r.gates.own).toBeNull();
    expect(r.said).toContain('play.waygate.returned');
  });

  it('stands WAYGATE_SECS (5 minutes), then fades', () => {
    expect(WAYGATE_SECS).toBe(300);
    const r = rig();
    r.gates.open(0);
    r.me.y += 100;
    r.gates.step(WAYGATE_SECS - 1);
    expect(r.gates.own).not.toBeNull();
    r.gates.step(WAYGATE_SECS);
    expect(r.gates.own).toBeNull();
    expect(r.said).toContain('play.waygate.faded');
  });

  it('a new portal replaces the last', () => {
    const r = rig();
    r.gates.open(0);
    r.me.x += 300;
    r.gates.open(5);
    expect(r.gates.own?.from.x).toBe(1300);
    expect(r.gates.own?.opened).toBe(5);
  });
});

describe('td-waygate: the party, through presence', () => {
  it('encodes the portal in plain presence characters and reads it back', () => {
    const r = rig();
    r.gates.open(0);
    const s = encodeGate(r.gates.own, 12);
    expect(s).toMatch(/^[a-z0-9:-]{1,96}$/);
    expect(cleanPresence({ gate: s }).gate).toBe(s);
    const g = decodeGate(s, 100)!;
    expect(g.from).toEqual(r.gates.own!.from);
    expect(g.town).toEqual(jasmine.objectContaining({ x: r.gates.own!.town.x, y: r.gates.own!.town.y, level: 'surface' }));
    expect(decodeGate('nonsense', 0)).toBeNull();
    expect(decodeGate('a:b:1:2:3:4:999', 0)).toBeNull();
    expect(encodeGate(null, 0)).toBe('');
  });

  it('a party member steps through a friend\'s portal and back; the friend\'s pair stays for its owner', () => {
    const owner = rig();
    owner.gates.open(0);
    const gate = encodeGate(owner.gates.own, 0);
    const member = rig({ party: [{ id: 'friend', gate }] });
    member.me.y += 60; member.gates.step(1);
    member.me.y -= 60; member.gates.step(2);
    expect(member.trips.length).toBe(1);
    expect(member.me.y).toBe(owner.gates.own!.town.y + ARRIVE_BELOW);
    expect(member.gates.ends(3).some(e => e.party && e.side === 'town')).toBe(true);
    member.gates.step(3);
    member.me.x = owner.gates.own!.town.x; member.me.y = owner.gates.own!.town.y; member.gates.step(4);
    expect(member.me).toEqual(jasmine.objectContaining(owner.gates.own!.from));
    // Landing on the friend's field end does not throw him straight back.
    member.gates.step(5);
    expect(member.trips.length).toBe(2);
  });
});

describe('td-waygate: the spell and the scroll', () => {
  it('Waygate is a Common spell every vocation can learn early, spoken in the Seam-Cant', () => {
    const sk = SKILLS['waygate'];
    expect(sk.tree).toBe('common');
    expect(sk.kind).toBe('active');
    expect(sk.level ?? 1).toBeLessThanOrEqual(3);
    expect(sk.words).toBe('ul hesk vesh');
    expect(sk.vars['secs']).toBe(WAYGATE_SECS);
    for (const v of ['warlock', 'ashguard', 'lanternwright', 'thornstrider'] as const) {
      expect(CLASS_SKILLS[v]).toContain('waygate');
      expect(STARTER_RANKS[v]).not.toContain('waygate');
    }
    for (const key of [sk.nameKey, sk.textKey, 'play.td.ability.waytown', 'play.td.ability.wayboss', 'play.td.ability.wayseam', 'play.waygate.opened', 'play.waygate.arrived', 'play.waygate.returned', 'play.waygate.faded', 'play.waygate.read']) {
      expect(HUD_I18N[key]?.en).withContext(key).toBeTruthy();
      expect(HUD_I18N[key]?.es).withContext(key).toBeTruthy();
    }
  });

  it('the scroll is a satchel stack with a name and an icon, priced on the hunt', () => {
    expect(materialDisplay(WAYGATE_SCROLL_ID)?.name).toBe('Waygate Scroll');
    expect(materialDisplay(WAYGATE_SCROLL_ID)?.art).toBeTruthy();
    expect(waygateScrollPrice(1)).toBeGreaterThanOrEqual(SCROLL_MIN_PRICE);
    expect(waygateScrollPrice(40)).toBe(Math.max(SCROLL_MIN_PRICE, huntGold(40, 15)));
    expect(waygateScrollPrice(40)).toBeGreaterThan(waygateScrollPrice(5));
  });
});
