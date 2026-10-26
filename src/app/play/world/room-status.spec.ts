import { BASE_STATUS, FLAG_STATUS, ROOM_STATUS_KINDS, markStatuses, parseCoopStatus, statusLegal, statusSources } from './room-status';
import { MARKS, MARK_SLOTS } from '../td/td-marks';
import { SKILLS, type SkillId } from '../td/td-skills';
import { OPS_WINDOW } from './room-credit';
import { ACTIVITY_OPS_MAX } from '../../shared/activity/activity.model';

describe('room-status (protocol 10: statuses on the room\'s creatures)', () => {
  it('names only real skills, and every mark rider that lays a kind the room carries is legal', () => {
    for (const s of Object.keys(BASE_STATUS)) expect(s in SKILLS).withContext(s).toBeTrue();
    for (const [s, row] of Object.entries(MARKS) as [SkillId, NonNullable<typeof MARKS[SkillId]>][]) {
      row.forEach((def, i) => {
        for (const fx of def.fx) {
          if (fx.k === 'rider' && (ROOM_STATUS_KINDS as readonly string[]).includes(fx.st)) expect(statusLegal(s, MARK_SLOTS[i], fx.st as never)).withContext(`${s} ${MARK_SLOTS[i]}`).toBeTrue();
          if (fx.k === 'flag' && FLAG_STATUS[fx.f]) expect(markStatuses(s, MARK_SLOTS[i])).toContain(FLAG_STATUS[fx.f]!);
        }
      });
    }
  });
  it('refuses a status the named skill or mark does not lay', () => {
    expect(statusLegal('shield-bash', null, 'stun')).toBeTrue();
    expect(statusLegal('shield-bash', null, 'fear')).toBeFalse();
    expect(statusLegal('ember-bolt', 'a2', 'burn')).toBeTrue();
    expect(statusLegal('ember-bolt', 'a1', 'burn')).toBeFalse();
    expect(statusLegal('nobody', null, 'stun')).toBeFalse();
    for (const k of ROOM_STATUS_KINDS) for (const x of statusSources(k)) expect(statusLegal(x.s, x.m ?? null, k)).toBeTrue();
  });
  it('reads a claim field by field (unknown keys and bad numbers refused)', () => {
    expect(parseCoopStatus({ i: 'a1', k: 'stun', s: 'shield-bash', t: 15 })).toEqual({ i: 'a1', k: 'stun', s: 'shield-bash', t: 15 });
    expect(parseCoopStatus({ i: 'a1', k: 'petrify', s: 'shield-bash', t: 15 })).toBeNull();
    expect(parseCoopStatus({ i: 'a1', k: 'stun', s: 'shield-bash', t: 15, x: 1 })).toBeNull();
    expect(parseCoopStatus({ i: 'a1', k: 'stun', s: 'shield-bash', t: -1 })).toBeNull();
    expect(parseCoopStatus({ i: 'a1', k: 'stun', s: 'shield-bash', m: 'c4', t: 1 })).toBeNull();
  });
  it('credits the room\'s XP inside the activity ledger\'s own op window', () => {
    expect(OPS_WINDOW).toBe(ACTIVITY_OPS_MAX);
  });
});
