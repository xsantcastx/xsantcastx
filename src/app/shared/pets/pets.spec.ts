/**
 * pets.spec.ts — the pets' rules (docs/handoff/pets.md): the table means
 * something (sources, helpers, real foods, words in both languages), the save
 * merges commutatively and never loses a pet, feeding fills a meter that never
 * decays, the helpers stay small, and the service goes through the gateway.
 */
import { TestBed } from '@angular/core/testing';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { materialDisplay } from '../rpg/material-catalog';
import { PETS_KEY, PET_LOVE_CEILING, cleanPetName, coercePets, emptyPets, mergePets, type PetRecord, type PetsState } from './pets-save.model';
import {
  FEEDS_PER_DAY, HAT_AT, PET_FURNACE_FLAG, PET_HOLLOW_SUN_FLAG, PET_WARDEN_FLAG, LOVE_MAX, PETS, PET_TUNING, TRICK_AT, activeAbility, dayKey, earnedPets, feedResult, followingPet,
  gatherBonus, mealsLeft, petDef, sourceProgress, xpBonus, type PetLedger,
} from './pets.model';
import { PETS_I18N } from './pets.i18n';
import { BANKED_FURNACE_FLAG } from '../../play/world/towns/infernal';
import { GLOAM_WARDEN_FLAG } from '../../play/world/towns/umbral-delve';
import { HOLLOW_SUN_FLAG } from '../../play/world/towns/luminous-delve';
import { PetsService } from './pets.service';
import { PET_FRAMES, PET_H, PET_W, paintPetFrame } from './pet-art';

const NONE: PetLedger = { tally: {}, claimDays: 0, flag: () => false };
const rec = (over: Partial<PetRecord> = {}): PetRecord => ({ got: 100, hatched: 100, name: 'Pip', nameAt: 100, love: 0, feedDay: '', feeds: 0, hat: false, hatAt: 0, xp: 0, findDay: '', scouts: 0, trinkets: 0, ...over });

describe('Pets: the table', () => {
  it('has 8 pets, one per realm at least, three rare ones, each with its own helper', () => {
    expect(PETS.length).toBe(8);
    for (const realm of ['infernal', 'luminous', 'umbral', 'celestial', 'verdant']) expect(PETS.some(p => p.realm === realm)).withContext(realm).toBeTrue();
    expect(PETS.filter(p => p.rare).length).toBe(3);
    expect(new Set(PETS.map(p => p.ability)).size).toBe(PETS.length);
  });
  it('every pet has a real source, real foods the satchel can paint, and lore', () => {
    for (const p of PETS) {
      expect(!!(p.source.tally || p.source.flag || p.source.claimDays)).withContext(p.id).toBeTrue();
      for (const food of [p.favourite, ...p.likes]) expect(materialDisplay(food)).withContext(`${p.id} eats ${food}`).toBeDefined();
      expect(p.lore.length).toBeGreaterThan(20);
    }
  });
  it('every word exists in English and Spanish', () => {
    for (const p of PETS) {
      for (const k of ['name', 'found', 'use', 'lore', 'glim', 'hat']) {
        const row = PETS_I18N[`play.pet.${k}.${p.id}`];
        expect(row?.en).withContext(`${k}.${p.id}`).toBeTruthy();
        expect(row?.es).withContext(`${k}.${p.id} es`).toBeTruthy();
      }
      expect(PETS_I18N[`play.pet.glim.${p.id}`].en.length).toBeLessThanOrEqual(120);
    }
    for (const [key, row] of Object.entries(PETS_I18N)) expect(row.es).withContext(key).toBeTruthy();
  });
  it('no guilt: no copy about hunger, missing you, streaks or a pet leaving', () => {
    const all = Object.values(PETS_I18N).map(r => r.en.toLowerCase()).join(' ');
    for (const word of ['starv', 'missed you', 'streak', 'run away', 'ran away', 'neglect', 'dies', 'died']) expect(all).not.toContain(word);
  });
  it('the guardian flags are the towns\' own', () => {
    expect(PET_FURNACE_FLAG).toBe(BANKED_FURNACE_FLAG);
    expect(PET_WARDEN_FLAG).toBe(GLOAM_WARDEN_FLAG);
    expect(PET_HOLLOW_SUN_FLAG).toBe(HOLLOW_SUN_FLAG);
  });
  it('the save ceiling mirrors the model', () => { expect(PET_LOVE_CEILING).toBe(LOVE_MAX); expect(TRICK_AT).toBeLessThan(HAT_AT); expect(HAT_AT).toBeLessThanOrEqual(LOVE_MAX); });
});

describe('Pets: finding them', () => {
  it('finds nothing on a fresh save, and each source finds its own pet', () => {
    expect(earnedPets(emptyPets(), NONE)).toEqual([]);
    const ids = (l: Partial<PetLedger>) => earnedPets(emptyPets(), { ...NONE, ...l }).map(p => p.id);
    expect(ids({ tally: { 'crate:seam-crate': 1 } })).toEqual(['ember-newt']);
    expect(ids({ tally: { 'kill:reflection-channels': 5 } })).toEqual([]);
    expect(ids({ tally: { 'kill:reflection-channels': 6 } })).toEqual(['prism-mothkit']);
    expect(ids({ tally: { 'kill:unrecorded-corridors': 6 } })).toEqual(['ink-pup']);
    expect(ids({ claimDays: 3 })).toEqual(['star-owlet']);
    expect(ids({ tally: { 'gather:rootglass-thicket': 8 } })).toEqual(['moss-hedgehog']);
    expect(ids({ flag: f => f === 'banked-furnace-defeated' })).toEqual(['rivet-hatchling']);
    expect(ids({ flag: f => f === 'gloam-warden-defeated' })).toEqual(['shade-kit']);
    expect(ids({ flag: f => f === 'hollow-sun-defeated' })).toEqual(['sunling']);
  });
  it('a pet already had is never found twice', () => {
    const state: PetsState = { ...emptyPets(), pets: { 'star-owlet': rec({ hatched: 0 }) } };
    expect(earnedPets(state, { ...NONE, claimDays: 9 })).toEqual([]);
  });
  it('progress reads "so far" for the counted sources', () => {
    expect(sourceProgress(petDef('ink-pup')!, { ...NONE, tally: { 'kill:unrecorded-corridors': 4 } })).toEqual({ have: 4, need: 6 });
    expect(sourceProgress(petDef('ink-pup')!, { ...NONE, tally: { 'kill:unrecorded-corridors': 40 } })).toEqual({ have: 6, need: 6 });
  });
});

describe('Pets: the bond', () => {
  const owlet = petDef('star-owlet')!;
  it('feeds only a hatched pet, only on its foods, favourite counts double', () => {
    expect(feedResult(owlet, undefined, owlet.favourite, '2026-10-15')).toEqual({ ok: false, code: 'unknown' });
    expect(feedResult(owlet, rec({ hatched: 0 }), owlet.favourite, '2026-10-15')).toEqual({ ok: false, code: 'egg' });
    expect(feedResult(owlet, rec(), 'cinder-ore', '2026-10-15')).toEqual({ ok: false, code: 'food' });
    expect(feedResult(owlet, rec(), owlet.favourite, '2026-10-15')).toEqual({ ok: true, gain: 2, favourite: true });
    expect(feedResult(owlet, rec(), owlet.likes[0], '2026-10-15')).toEqual({ ok: true, gain: 1, favourite: false });
  });
  it('a full pet waits for tomorrow; a new day is a fresh appetite, never a debt', () => {
    const full = rec({ feedDay: '2026-10-15', feeds: FEEDS_PER_DAY });
    expect(feedResult(owlet, full, owlet.favourite, '2026-10-15')).toEqual({ ok: false, code: 'full' });
    expect(mealsLeft(full, '2026-10-15')).toBe(0);
    // Weeks away: nothing was lost, the meter is where it was, the appetite is whole.
    expect(mealsLeft(full, '2026-11-30')).toBe(FEEDS_PER_DAY);
  });
  it('day keys are local calendar days', () => { expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'); });
  it('the follower is a hatched, chosen pet', () => {
    expect(followingPet({ ...emptyPets(), active: 'ink-pup', pets: { 'ink-pup': rec({ hatched: 0 }) } })).toBeNull();
    expect(activeAbility({ ...emptyPets(), active: 'ink-pup', activeAt: 5, pets: { 'ink-pup': rec() } })).toBe('warn');
  });
});

describe('Pets: helpers stay small', () => {
  it('xp adds a tenth, rounded up, at least 1', () => {
    expect(xpBonus(0)).toBe(0); expect(xpBonus(4)).toBe(1); expect(xpBonus(40)).toBe(4); expect(xpBonus(41)).toBe(5);
  });
  it('gather is a stable roll near its chance', () => {
    expect(gatherBonus('harvest:a')).toBe(gatherBonus('harvest:a'));
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (gatherBonus(`verdant/thicket:${i}`)) hits++;
    expect(hits / 4000).toBeGreaterThan(PET_TUNING.gatherChance - .04);
    expect(hits / 4000).toBeLessThan(PET_TUNING.gatherChance + .04);
  });
  it('the knobs are the sim\'s caps', () => {
    expect(PET_TUNING.gatherChance).toBeLessThanOrEqual(.25);
    expect(PET_TUNING.xpShare).toBeLessThanOrEqual(.1);
    expect(PET_TUNING.biteBoost).toBeLessThanOrEqual(1.25);
  });
});

describe('Pets: the save', () => {
  it('coerces junk away and keeps names clean', () => {
    expect(coercePets(null)).toEqual(emptyPets());
    expect(coercePets({ pets: { 'BAD ID': rec(), 'ink-pup': { got: -1 } }, tally: { nope: 3, 'kill:x': 'a' } })).toEqual(emptyPets());
    expect(cleanPetName('  <b>Sir\u0007 Fluff\n</b>  the Third of Many ')).toBe('bSir Fluff /b th');
    const c = coercePets({ pets: { 'ink-pup': rec({ love: 999, name: 'x'.repeat(40) }) }, active: 'ink-pup', activeAt: 3 });
    expect(c.pets['ink-pup']!.love).toBe(LOVE_MAX);
    expect(c.pets['ink-pup']!.name.length).toBe(16);
    expect(c.active).toBe('ink-pup');
    // An egg cannot follow.
    expect(coercePets({ pets: { 'ink-pup': rec({ hatched: 0 }) }, active: 'ink-pup', activeAt: 3 }).active).toBe('');
  });
  it('merges both ways the same, idempotently, and never loses a pet', () => {
    const a = { ...emptyPets(), pets: { 'ink-pup': rec({ name: 'Inky', nameAt: 50, love: 3, feedDay: '2026-10-14', feeds: 3 }) }, active: 'ink-pup', activeAt: 10, tally: { 'kill:unrecorded-corridors': 6, 'crate:seam-crate': 1 } };
    const b = { ...emptyPets(), pets: { 'ink-pup': rec({ got: 40, name: 'Blot', nameAt: 80, love: 5, feedDay: '2026-10-15', feeds: 1, hat: false }), 'star-owlet': rec({ hatched: 0, name: '' }) }, active: 'star-owlet', activeAt: 20, tally: { 'kill:unrecorded-corridors': 2 } };
    const ab = mergePets(a, b) as PetsState, ba = mergePets(b, a) as PetsState;
    expect(ab).toEqual(ba);
    expect(mergePets(ab, ab)).toEqual(ab);
    expect(Object.keys(ab.pets).sort()).toEqual(['ink-pup', 'star-owlet']);
    const pup = ab.pets['ink-pup']!;
    expect(pup.got).toBe(40);
    expect(pup.name).toBe('Blot');
    expect(pup.love).toBe(5);
    expect(pup.feedDay).toBe('2026-10-15');
    expect(pup.feeds).toBe(1);
    expect(ab.tally['kill:unrecorded-corridors']).toBe(6);
    expect(ab.tally['crate:seam-crate']).toBe(1);
    // An egg cannot follow (coerce drops that choice), so the only valid follower is kept.
    expect(ab.active).toBe('ink-pup');
    expect(mergePets(null, a)).toEqual(a);
  });
  it('same day: the larger count of meals is kept', () => {
    const a = { ...emptyPets(), pets: { 'ink-pup': rec({ feedDay: '2026-10-15', feeds: 1 }) } };
    const b = { ...emptyPets(), pets: { 'ink-pup': rec({ feedDay: '2026-10-15', feeds: 2 }) } };
    expect((mergePets(a, b) as PetsState).pets['ink-pup']!.feeds).toBe(2);
  });
});

describe('Pets: the art', () => {
  it('paints every pet and frame inside its cell, and the frames differ', () => {
    for (const p of PETS) {
      const seen = new Set<string>();
      for (const f of PET_FRAMES) {
        const cells: string[] = [];
        paintPetFrame((x, y, w, h, color) => {
          expect(x).withContext(`${p.id} ${f} x`).toBeGreaterThanOrEqual(0);
          expect(x + w).withContext(`${p.id} ${f} right`).toBeLessThanOrEqual(PET_W);
          expect(y + h).withContext(`${p.id} ${f} bottom`).toBeLessThanOrEqual(PET_H);
          cells.push(`${x},${y},${w},${h},${color}`);
        }, () => undefined, p.id, f, true);
        seen.add(cells.join('|'));
      }
      expect(seen.size).withContext(p.id).toBe(PET_FRAMES.length);
    }
  });
});

describe('PetsService (through the gateway)', () => {
  let service: PetsService;
  const boot = () => { TestBed.resetTestingModule(); TestBed.configureTestingModule({}); return TestBed.inject(PetsService); };
  beforeEach(() => { localStorage.removeItem(PETS_KEY); service = boot(); });
  afterEach(() => localStorage.removeItem(PETS_KEY));

  it('finds, hatches, names, follows and survives a reload', () => {
    expect(service.find({ ...NONE, claimDays: 3 }, 1000).map(p => p.id)).toEqual(['star-owlet']);
    expect(service.find({ ...NONE, claimDays: 3 }, 2000)).toEqual([]);
    expect(service.record('star-owlet')!.hatched).toBe(0);
    expect(service.name('star-owlet', 'Hoot')).toBe('');
    expect(service.hatch('star-owlet', 1500)).toBeTrue();
    expect(service.hatch('star-owlet', 1600)).toBeFalse();
    expect(service.state.active).toBe('star-owlet');
    expect(service.name('star-owlet', '  Hoot  ')).toBe('Hoot');
    service = boot();
    expect(service.record('star-owlet')!.name).toBe('Hoot');
    expect(service.state.active).toBe('star-owlet');
    expect(service.follow('')).toBeTrue();
    expect(service.state.active).toBe('');
  });

  it('a rescue comes awake; tallies count up', () => {
    service.count('kill:unrecorded-corridors', 6);
    const found = service.find({ ...NONE, tally: service.state.tally });
    expect(found.map(p => p.id)).toEqual(['ink-pup']);
    expect(service.record('ink-pup')!.hatched).toBeGreaterThan(0);
  });

  it('feeding spends a real stack, fills the meter, unlocks the trick, then rests for the day', () => {
    service.find({ ...NONE, claimDays: 3 });
    service.hatch('star-owlet');
    const inventory = TestBed.inject(InventoryService);
    const food = petDef('star-owlet')!.favourite;
    expect(service.feed('star-owlet', food)).toEqual({ ok: false, code: 'none' });
    expect(inventory.grantStack('spec-food', food, 5)).toBeTrue();
    const day = new Date(2026, 9, 15, 12);
    const first = service.feed('star-owlet', food, day);
    expect(first.ok).toBeTrue();
    expect(inventory.stackOf(food)).toBe(4);
    const second = service.feed('star-owlet', food, day);
    expect(second.ok && second.trick).toBeTrue();
    expect(service.feed('star-owlet', food, day).ok).toBeTrue();
    expect(service.feed('star-owlet', food, day)).toEqual({ ok: false, code: 'full' });
    expect(inventory.stackOf(food)).toBe(2);
    expect(service.record('star-owlet')!.love).toBe(6);
    // The next day it eats again; the meter never went down.
    expect(service.feed('star-owlet', food, new Date(2026, 9, 16, 9)).ok).toBeTrue();
    expect(service.record('star-owlet')!.love).toBe(8);
    expect(service.wearHat('star-owlet', true)).toBeFalse();
  });

  it('a cloud merge lands in memory in the same tick', () => {
    service.find({ ...NONE, claimDays: 3 });
    const merged = mergePets({ ...emptyPets(), pets: { 'ink-pup': rec() } }, JSON.parse(localStorage.getItem(PETS_KEY)!));
    localStorage.setItem(PETS_KEY, JSON.stringify(merged));
    expect(TestBed.inject(LocalSaveRegistry).rehydrate(PETS_KEY)).toBeTrue();
    expect(Object.keys(service.state.pets).sort()).toEqual(['ink-pup', 'star-owlet']);
  });
});
