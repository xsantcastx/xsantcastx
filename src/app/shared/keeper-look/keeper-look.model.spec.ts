import {
  BODY_TYPES, FACE_MARKS, FORMS, HAIR_STYLES, KEEPER_LOOK_KEY, LOOK_FIELDS, NAME_MAX, SKIN_TONES,
  cleanName, coerceLook, defaultLook, fieldOptions, fieldSwatch, lookFromSeed, lookKey, lookRng, mergeKeeperLook, pointsLeft, randomLook, stepLook,
} from './keeper-look.model';
import { SYNCED_BLOBS } from '../cloud-save/cloud-save.model';

describe('keeper-look.model', () => {
  it('a default look is valid and not yet made', () => {
    const look = defaultLook();
    expect(coerceLook(look)).toEqual(look);
    expect(look.made).toBeFalse();
    expect(look.prompted).toBeFalse();
  });

  it('coerces junk to the default, field by field', () => {
    const look = coerceLook({ body: 'giant', skin: 99, hair: 'mohawk', hairColor: -1, eyes: 3, face: 'beard', name: '<b>Ash</b>', updatedAt: 'x', made: 'yes' });
    const d = defaultLook();
    expect(look.body).toBe(d.body);
    expect(look.skin).toBe(d.skin);
    expect(look.hair).toBe('mohawk');
    expect(look.hairColor).toBe(d.hairColor);
    expect(look.eyes).toBe(d.eyes);
    expect(look.face).toBe('beard');
    expect(look.name).toBe('bAshb');
    expect(look.updatedAt).toBe(0);
    expect(look.made).toBeFalse();
    expect(coerceLook(null)).toEqual(d);
    expect(coerceLook('nope')).toEqual(d);
  });

  it('cleans names: letters of any script, capped, spaces collapsed', () => {
    expect(cleanName('  Iñaki   de  la Forja ')).toBe('Iñaki de la Forja');
    expect(cleanName('x'.repeat(40)).length).toBe(NAME_MAX);
    expect(cleanName('<script>')).toBe('script');
    expect(cleanName(42)).toBe('');
  });

  it('merge: the later edit wins whole; made and prompted only grow', () => {
    const older = { ...defaultLook(), hair: 'long', skin: 5, made: true, updatedAt: 100 };
    const newer = { ...defaultLook(), hair: 'curls', skin: 1, prompted: true, updatedAt: 200 };
    const merged = mergeKeeperLook(older, newer) as ReturnType<typeof defaultLook>;
    expect(merged.hair).toBe('curls');
    expect(merged.skin).toBe(1);
    expect(merged.made).toBeTrue();
    expect(merged.prompted).toBeTrue();
    expect(mergeKeeperLook(newer, older)).toEqual(merged);
    expect(mergeKeeperLook(null, newer)).toBe(newer);
    expect(mergeKeeperLook(older, null)).toBe(older);
  });

  it('is a synced blob with its merge (progress/keeper-look)', () => {
    const blob = SYNCED_BLOBS.find(b => b.key === KEEPER_LOOK_KEY);
    expect(blob?.collection).toBe('progress');
    expect(blob?.doc).toBe('keeper-look');
    expect(blob?.merge).toBe(mergeKeeperLook);
  });

  it('steps every field through its options and wraps', () => {
    for (const field of LOOK_FIELDS) {
      const options = fieldOptions(field);
      let look = defaultLook();
      const seen = new Set<unknown>();
      for (let i = 0; i < options.length; i++) { seen.add(look[field]); look = stepLook(look, field, 1); }
      expect(seen.size).withContext(field).toBe(options.length);
      expect(look[field]).withContext(field).toBe(defaultLook()[field]);
      expect(stepLook(stepLook(defaultLook(), field, -1), field, 1)[field]).toBe(defaultLook()[field]);
    }
  });

  it('colour fields show their swatch', () => {
    expect(fieldSwatch('skin', 0)).toBe(SKIN_TONES[0]);
    expect(fieldSwatch('hair', 'long')).toBeNull();
  });

  it('random looks are valid, deterministic per seed, and varied', () => {
    const a = randomLook(lookRng(7)), b = randomLook(lookRng(7));
    expect(a).toEqual(b);
    expect(coerceLook(a)).toEqual(a);
    const keys = new Set(Array.from({ length: 40 }, (_, i) => lookKey(randomLook(lookRng(i)))));
    expect(keys.size).toBeGreaterThan(35);
    expect(BODY_TYPES).toContain(a.body);
    expect(HAIR_STYLES).toContain(a.hair);
    expect(FACE_MARKS).toContain(a.face);
    expect(a.trim).not.toBe(a.outfit);
  });

  it('other Keepers get a stable look from their id', () => {
    expect(lookFromSeed('peer-1')).toEqual(lookFromSeed('peer-1'));
    expect(lookKey(lookFromSeed('peer-1'))).not.toBe(lookKey(lookFromSeed('peer-2')));
  });

  it('the look key ignores the name and flags', () => {
    const look = defaultLook();
    expect(lookKey({ ...look, name: 'Ash', made: true, updatedAt: 9 })).toBe(lookKey(look));
    expect(lookKey({ ...look, hair: 'braid' })).not.toBe(lookKey(look));
  });
});

describe('the Keeper record: class, bar and attributes (2026-10-20)', () => {
  it('defaults to the Warlock with no points spent, and keeps junk out', () => {
    const d = coerceLook({});
    expect(d.vocation).toBe('warlock');
    expect(d.stats).toEqual({ vit: 0, ene: 0, spi: 0, agi: 0 });
    const junk = coerceLook({ vocation: 'paladin', bar: ['drain-life', 7, 'X!'], aura: '<b>', stats: { vit: -3, ene: 2.5, spi: 4, agi: 'x' } });
    expect(junk.vocation).toBe('warlock');
    expect(junk.bar).toEqual(['drain-life']);
    expect(junk.aura).toBe('');
    expect(junk.stats).toEqual({ vit: 0, ene: 0, spi: 4, agi: 0 });
  });

  it('gives five points a level above the first, less what is spent', () => {
    expect(pointsLeft(1, { vit: 0, ene: 0, spi: 0, agi: 0 })).toBe(0);
    expect(pointsLeft(3, { vit: 0, ene: 0, spi: 0, agi: 0 })).toBe(10);
    expect(pointsLeft(3, { vit: 4, ene: 3, spi: 2, agi: 1 })).toBe(0);
    expect(pointsLeft(2, { vit: 9, ene: 0, spi: 0, agi: 0 })).toBe(0);
  });

  describe('the figure (feminine / masculine)', () => {
    it('an old save without one stays the figure it always was', () => {
      const old = coerceLook({ version: 1, made: true, name: 'Aster', hair: 'braid', vocation: 'warlock', updatedAt: 5 });
      expect(old.form).toBe('masc');
      expect(old.hair).toBe('braid');
      expect(coerceLook({ form: 'robot' }).form).toBe('masc');
      expect(coerceLook({ form: 'fem' }).form).toBe('fem');
    });

    it('keeps the old hair styles and adds the new ones at the end', () => {
      expect(HAIR_STYLES.slice(0, 8)).toEqual(['cropped', 'swept', 'long', 'braid', 'topknot', 'curls', 'mohawk', 'shaved']);
      for (const h of ['bun', 'ponytail', 'pigtails', 'bob']) expect(coerceLook({ hair: h }).hair).toBe(h as never);
    });

    it('rides the look blob: the later edit carries its figure to the other device', () => {
      const phone = { ...defaultLook(), made: true, form: 'fem', hair: 'ponytail', updatedAt: 20 };
      const pc = { ...defaultLook(), made: true, form: 'masc', updatedAt: 10 };
      expect(coerceLook(mergeKeeperLook(phone, pc)).form).toBe('fem');
      expect(coerceLook(mergeKeeperLook(pc, phone)).form).toBe('fem');
    });

    it('is a field of the Glass, changes the painting key, and a random feminine look has no beard', () => {
      expect(LOOK_FIELDS[0]).toBe('form');
      expect(fieldOptions('form')).toEqual(FORMS);
      expect(stepLook(defaultLook(), 'form', 1).form).toBe('fem');
      expect(lookKey({ ...defaultLook(), form: 'fem' })).not.toBe(lookKey(defaultLook()));
      const rand = lookRng(7);
      const forms = new Set<string>();
      for (let i = 0; i < 60; i++) {
        const l = randomLook(rand);
        forms.add(l.form);
        if (l.form === 'fem') expect(l.face).not.toBe('beard');
      }
      expect(forms.size).toBe(2);
    });
  });
});
