/**
 * pet-roles.spec.ts — the pets' roles (docs/handoff/pets-and-glim-alive.md): every
 * pet has a role, a move and a second move with words in both languages; levels
 * grow only by use; commands decide who fights and who works; the brain's states
 * (fight, work, stay, tired, play) through a fake world; the save keeps XP, finds
 * and the command merge-safe; the service books them through the gateway.
 */
import { TestBed } from '@angular/core/testing';
import { PETS_KEY, coercePets, emptyPets, mergePets, newPetRecord, type PetsState } from './pets-save.model';
import { PETS, dayKey } from './pets.model';
import {
  FINDS_PER_DAY, PET_ACT, PET_COMMANDS, PET_LEVELS, PET_LEVEL_MAX, PET_ROLES, SECOND_AT, fights, findsLeft, hasSecond, levelProgress,
  moveDamage, moveDps, nipDamage, petLevel, scoutCoins, works,
} from './pet-roles';
import { PETS_I18N } from './pets.i18n';
import { PetsService } from './pets.service';
import { PetBrain, type PetEvent, type PetWorld } from '../../play/engine/pet-brain';

/** A fake world for the brain: one foe, no nodes, the Keeper at 500 on the floor. */
function world(over: Partial<PetWorld> = {}, log: PetEvent[] = [], foes: { ref: { hp: number; stun: number }; x: number }[] = []): PetWorld {
  return {
    dt: 1 / 60, time: 0, figure: 1, reduced: false, keeperX: 500, keeperY: 610, facing: 1, hp: 100, maxHp: 100,
    minX: 0, maxX: 3000, safeX: 0, night: false,
    foes: foes.map(f => ({ ref: f.ref, x: f.x, floor: 610, windup: false })), sites: [], bob: null,
    vein: () => null,
    hit: (foe, damage) => { const f = foe as { hp: number }; f.hp -= damage; return { landed: true, killed: f.hp <= 0 }; },
    stun: (foe, s) => { (foe as { stun: number }).stun = s; },
    crack: () => undefined, draw: () => undefined, heal: () => undefined, harvest: () => true, warm: () => undefined, spill: () => undefined,
    event: e => { log.push(e); return true; },
    ...over,
  };
}

describe('Pet roles: the table', () => {
  it('gives all 8 pets a role, a move and a distinct second move, with words EN + ES', () => {
    expect(Object.keys(PET_ROLES).sort()).toEqual(PETS.map(p => p.id).sort());
    const roles = Object.values(PET_ROLES);
    expect(roles.filter(r => r.role === 'combat').length).toBe(4);
    expect(roles.filter(r => r.role === 'skilling').length).toBe(4);
    expect(new Set(roles.map(r => r.move)).size).toBe(8);
    expect(new Set(roles.map(r => r.second)).size).toBe(8);
    for (const r of roles) {
      for (const key of [`play.pet.move.${r.move}`, `play.pet.second.${r.second}`, `play.pet.role.${r.role}`]) {
        expect(PETS_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(PETS_I18N[key]?.es).withContext(key).toBeTruthy();
      }
    }
    for (const c of PET_COMMANDS) {
      expect(PETS_I18N[`play.pet.command.${c}`]?.es).withContext(c).toBeTruthy();
      expect(PETS_I18N[`play.pet.command.note.${c}`]?.es).withContext(c).toBeTruthy();
    }
  });
  it('levels grow only with XP and the second move opens at SECOND_AT', () => {
    expect(petLevel(0)).toBe(1);
    expect(petLevel(PET_LEVELS[1]! - 1)).toBe(1);
    expect(petLevel(PET_LEVELS[1]!)).toBe(2);
    expect(petLevel(1e9)).toBe(PET_LEVEL_MAX);
    expect(hasSecond(PET_LEVELS[SECOND_AT - 2]!)).toBeFalse();
    expect(hasSecond(PET_LEVELS[SECOND_AT - 1]!)).toBeTrue();
    expect(levelProgress(PET_LEVELS[1]! + 3)).toEqual({ level: 2, into: 3, span: PET_LEVELS[2]! - PET_LEVELS[1]! });
    expect(levelProgress(1e9).span).toBe(0);
  });
  it('keeps combat small next to the Keeper\'s blow, and the moves grow a little per level', () => {
    const keeper = 20 / .52;
    for (const r of Object.values(PET_ROLES)) if (r.role === 'combat') expect(moveDps(r.move, PET_LEVEL_MAX) / keeper).withContext(r.move).toBeLessThanOrEqual(.22);
    expect(moveDamage('bite', 2)).toBe(moveDamage('bite', 1) + PET_ACT.perLevel);
    expect(nipDamage(1)).toBeLessThan(moveDamage('bite', 1));
    expect(scoutCoins(5, true)).toBeGreaterThan(scoutCoins(5, false));
  });
  it('commands: Follow by role, Fight brings all, Gather keeps all working, Stay and Play do neither', () => {
    expect(fights('combat', 'follow')).toBeTrue();
    expect(fights('skilling', 'follow')).toBeFalse();
    expect(works('skilling', 'follow')).toBeTrue();
    expect(fights('skilling', 'fight')).toBeTrue();
    expect(works('combat', 'gather')).toBeTrue();
    expect(fights('combat', 'gather')).toBeFalse();
    for (const c of ['stay', 'play'] as const) { expect(fights('combat', c)).toBeFalse(); expect(works('skilling', c)).toBeFalse(); }
  });
  it('caps finds per day per kind and starts fresh the next day', () => {
    const r = { findDay: '2026-10-15', scouts: FINDS_PER_DAY.scout, trinkets: 0 };
    expect(findsLeft('scout', '2026-10-15', r)).toBe(0);
    expect(findsLeft('trinket', '2026-10-15', r)).toBe(FINDS_PER_DAY.trinket);
    expect(findsLeft('scout', '2026-10-16', r)).toBe(FINDS_PER_DAY.scout);
  });
});

describe('Pet brain: its states', () => {
  it('a combat pet closes on a foe and bites; every third bite stuns', () => {
    const b = new PetBrain();
    b.setup({ role: 'combat', move: 'bite', second: null, level: 1, command: 'follow' });
    const foe = { hp: 100, stun: 0 };
    const log: PetEvent[] = [];
    let x = 440;
    for (let n = 0; n < 60 * 6; n++) {
      b.step(world({}, log, [{ ref: foe, x: 560 }]), x);
      if (b.goalX !== null) x += Math.sign(b.goalX - x) * Math.min(Math.abs(b.goalX - x), 8);
    }
    expect(b.act).toBe('fight');
    expect(foe.hp).toBeLessThan(100);
    expect(log.filter(e => e.kind === 'hit').length).toBe(b.hits);
    expect(b.hits).toBeGreaterThanOrEqual(PET_ACT.stunEvery);
    expect(foe.stun).toBe(PET_ACT.stun);
  });
  it('Stay holds its spot; Play chases a mote; a skilling pet on Follow ignores a fight', () => {
    const b = new PetBrain();
    b.setup({ role: 'skilling', move: 'forage', second: null, level: 1, command: 'follow' });
    const foe = { hp: 50, stun: 0 };
    for (let n = 0; n < 120; n++) b.step(world({}, [], [{ ref: foe, x: 560 }]), 470);
    expect(foe.hp).toBe(50);
    b.setup({ role: 'skilling', move: 'forage', second: null, level: 1, command: 'stay' });
    b.step(world(), 333);
    b.step(world({ keeperX: 900 }), 333);
    expect(b.act).toBe('stay');
    expect(b.goalX).toBe(333);
    b.setup({ role: 'skilling', move: 'forage', second: null, level: 1, command: 'play' });
    for (let n = 0; n < 60 * 8; n++) b.step(world({ time: n / 60 }), 480);
    expect(b.act).toBe('play');
    expect(b.mote).not.toBeNull();
  });
  it('tired after blows (never dead), resting, then back at full stamina', () => {
    const b = new PetBrain();
    b.setup({ role: 'combat', move: 'bite', second: null, level: 1, command: 'follow' });
    const log: PetEvent[] = [];
    while (b.tired <= 0) b.blow({ event: e => { log.push(e); } });
    expect(b.act).toBe('tired');
    expect(log.some(e => e.kind === 'tired')).toBeTrue();
    for (let n = 0; n < 60 * (PET_ACT.restFor + 1); n++) b.step(world(), 400);
    expect(b.act).not.toBe('tired');
    expect(b.stamina).toBe(PET_ACT.stamina);
  });
  it('the Sunling pulses only on a hurt Keeper, and never in reduced motion does the mote fly', () => {
    const b = new PetBrain();
    b.setup({ role: 'combat', move: 'pulse', second: null, level: 1, command: 'follow' });
    let healed = 0;
    b.step(world({ hp: 100, heal: a => { healed += a; } }), 450);
    expect(healed).toBe(0);
    b.step(world({ hp: 40, heal: a => { healed += a; } }), 450);
    expect(healed).toBeCloseTo(100 * PET_ACT.pulseShare, 5);
    const calm = new PetBrain();
    calm.setup({ role: 'combat', move: 'bite', second: null, level: 1, command: 'play' });
    for (let n = 0; n < 60 * 8; n++) calm.step(world({ reduced: true, time: n / 60 }), 480);
    expect(calm.mote).toBeNull();
  });
});

describe('Pet roles: the save and the service', () => {
  it('coerces and merges XP (max), finds (later day; same day the larger) and the command (later wins)', () => {
    const a = { ...emptyPets(), pets: { 'ink-pup': { ...newPetRecord(1, 1), xp: 30, findDay: '2026-10-15', scouts: 1, trinkets: 2 } }, command: 'stay', commandAt: 50 };
    const b = { ...emptyPets(), pets: { 'ink-pup': { ...newPetRecord(1, 1), xp: 12, findDay: '2026-10-15', scouts: 3, trinkets: 0 } }, command: 'fight', commandAt: 80 };
    const ab = mergePets(a, b) as PetsState, ba = mergePets(b, a) as PetsState;
    expect(ab).toEqual(ba);
    expect(mergePets(ab, ab)).toEqual(ab);
    expect(ab.pets['ink-pup']!.xp).toBe(30);
    expect(ab.pets['ink-pup']!.scouts).toBe(3);
    expect(ab.pets['ink-pup']!.trinkets).toBe(2);
    expect(ab.command).toBe('fight');
    const later = mergePets(a, { ...b, pets: { 'ink-pup': { ...newPetRecord(1, 1), findDay: '2026-10-16', scouts: 1, trinkets: 0 } } }) as PetsState;
    expect(later.pets['ink-pup']!.findDay).toBe('2026-10-16');
    expect(later.pets['ink-pup']!.scouts).toBe(1);
    expect(coercePets({ command: 'dance' }).command).toBe('follow');
    expect(coercePets({ pets: { 'ink-pup': { got: 1, xp: -4 } } }).pets['ink-pup']!.xp).toBe(0);
  });

  describe('PetsService', () => {
    let service: PetsService;
    const boot = () => { TestBed.resetTestingModule(); TestBed.configureTestingModule({}); return TestBed.inject(PetsService); };
    beforeEach(() => { localStorage.removeItem(PETS_KEY); service = boot(); });
    afterEach(() => localStorage.removeItem(PETS_KEY));

    it('commands, trains (a new level reported once) and caps finds, through a reload', () => {
      service.count('kill:unrecorded-corridors', 6);
      service.find({ tally: service.state.tally, claimDays: 0, flag: () => false });
      service.follow('ink-pup');
      expect(service.command).toBe('follow');
      expect(service.setCommand('stay')).toBeTrue();
      expect(service.train('ink-pup', 'hit', PET_LEVELS[1]! - 1)).toBe(0);
      expect(service.train('ink-pup', 'hit', 1)).toBe(2);
      expect(service.train('ink-pup', 'hit', 1)).toBe(0);
      const day = new Date(2026, 9, 15, 12);
      for (let n = 0; n < FINDS_PER_DAY.scout; n++) expect(service.takeFind('ink-pup', 'scout', day)).toBeTrue();
      expect(service.takeFind('ink-pup', 'scout', day)).toBeFalse();
      expect(service.takeFind('ink-pup', 'trinket', day)).toBeTrue();
      service = boot();
      expect(service.command).toBe('stay');
      expect(service.record('ink-pup')!.xp).toBe(PET_LEVELS[1]! + 1);
      expect(service.record('ink-pup')!.findDay).toBe(dayKey(day));
      expect(service.takeFind('ink-pup', 'scout', day)).toBeFalse();
      expect(service.takeFind('ink-pup', 'scout', new Date(2026, 9, 16, 9))).toBeTrue();
    });
  });
});
