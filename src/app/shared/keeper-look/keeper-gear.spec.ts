import {
  ARM_LENGTH, EMPTY_ARM, GripTransform, HoldPose, KeeperGear, WEAPON_SPECS, WeaponKind,
  gearKey, gearKindOf, gearPiece, gripPoint, gripTransform, handAt, holdPose, keeperAction, weaponKindOf,
} from './keeper-gear';
import { KeeperPainter, bodyFrame, frameIndex, RUN_FRAMES } from './keeper-paint';
import { defaultLook } from './keeper-look.model';
import { ITEM_DEFINITIONS } from '../rpg/item-definition';

describe('keeper-gear: what a worn item reads as', () => {
  it('names say what a weapon is', () => {
    const cases: [string, WeaponKind][] = [
      ['Basalt Edge', 'sword'], ['Dawnrender', 'greatsword'], ['Briarvein Kris', 'dagger'], ['Hollow Fang', 'dagger'],
      ['Nullthorn Staff', 'staff'], ['Pyreclast Wand', 'wand'], ['Starfall Maul', 'hammer'], ['Rootbreaker Mace', 'mace'],
      ['Meridian Longbow', 'bow'], ['Spinerift Crossbow', 'crossbow'], ['Radiant Halberd', 'halberd'], ['Astral Glaive', 'halberd'],
      ['Godforge Tongs', 'tongs'], ['Iron Pickaxe tool-pickaxe-2', 'pickaxe'], ['Bronze Axe', 'axe'], ['Ashveil Throwing Knives', 'dagger'],
    ];
    for (const [name, kind] of cases) expect(weaponKindOf(name)).withContext(name).toBe(kind);
  });

  it('armour reads by slot and name', () => {
    expect(gearKindOf('head', 'Cometfall Helm')).toBe('helm');
    expect(gearKindOf('head', 'Voidweave Cowl')).toBe('hood');
    expect(gearKindOf('head', 'Crown of the First Dawn')).toBe('crown');
    expect(gearKindOf('head', 'Lantern Oath')).toBe('circlet');
    expect(gearKindOf('chest', 'Thornmantle Pauldrons')).toBe('plate');
    expect(gearKindOf('chest', "Aureth's Mantle")).toBe('mantle');
    expect(gearKindOf('chest', 'Cinderhide Coat')).toBe('coat');
    expect(gearKindOf('legs', 'Blazebraid Belt')).toBe('belt');
    expect(gearKindOf('legs', 'Solstice Greaves')).toBe('greaves');
    expect(gearKindOf('off-hand', 'Rootwall Shield')).toBe('shield');
    expect(gearKindOf('off-hand', "Mourner's Ledger")).toBe('tome');
    expect(gearKindOf('off-hand', 'Mirror of Small Mercies')).toBe('orb');
    expect(gearKindOf('trinket', "Keeper's Signet")).toBe('pendant');
    expect(gearKindOf('charm2', 'Ember Elixir')).toBe('charm');
  });

  it('every wearable definition gets a layer kind', () => {
    const wearable = ITEM_DEFINITIONS.filter(def => def.slot);
    expect(wearable.length).toBeGreaterThan(30);
    for (const def of wearable) {
      const piece = gearPiece(def.slot!, `${def.name} ${def.id}`, def.style, 'rare');
      expect(piece.kind).withContext(def.id).toBeTruthy();
      if (def.slot === 'weapon') expect(WEAPON_SPECS[piece.kind as WeaponKind]).withContext(def.id).toBeDefined();
    }
  });

  it('unknown style and rarity fall back safely', () => {
    const piece = gearPiece('weapon', 'Mystery', 'plaid', 'ultra');
    expect(piece).toEqual({ slot: 'weapon', kind: 'sword', style: 'neutral', rarity: 'common' });
  });

  it('the gear key changes with any worn layer', () => {
    const a: KeeperGear = { weapon: gearPiece('weapon', 'Basalt Edge', 'infernal', 'rare') };
    const b: KeeperGear = { ...a, head: gearPiece('head', 'Cometfall Helm', 'celestial', 'epic') };
    expect(gearKey(a)).not.toBe(gearKey(b));
    expect(gearKey(b)).toContain('head:helm:celestial:epic');
    expect(gearKey(null)).toBe('');
  });
});

describe('keeper-gear: grip and swing math', () => {
  const out: GripTransform = { x: 0, y: 0, rotation: 0, drawX: 0, drawY: 0 };
  const p = { x: 0, y: 0 };

  it('the grip pixel lands on the hand, whatever the angle', () => {
    for (const kind of Object.keys(WEAPON_SPECS) as WeaponKind[]) {
      const spec = WEAPON_SPECS[kind];
      for (const angle of [-Math.PI / 2, 0, 1.2, -2.6]) {
        gripTransform(10, 20, angle, spec, out);
        gripPoint(out, spec.gx, spec.gy, p);
        expect(p.x).withContext(kind).toBeCloseTo(10, 6);
        expect(p.y).withContext(kind).toBeCloseTo(20, 6);
      }
    }
  });

  it('the tip points along the weapon angle', () => {
    const spec = WEAPON_SPECS.sword;
    for (const angle of [-Math.PI / 2, 0, .8, -2.2]) {
      gripTransform(0, 0, angle, spec, out);
      gripPoint(out, spec.gx, 0, p);
      const len = Math.hypot(p.x, p.y);
      expect(len).toBeCloseTo(spec.gy, 6);
      expect(Math.atan2(p.y, p.x)).toBeCloseTo(angle, 6);
    }
  });

  it('the hand is an arm length from the shoulder', () => {
    handAt(5, 5, 0, p);
    expect(p).toEqual({ x: 5 + ARM_LENGTH, y: 5 });
  });

  it('a slash winds up over the head and strikes down in front', () => {
    const pose: HoldPose = { arm: 0, weapon: 0 };
    holdPose('sword', 'attack', 0, .3, pose);
    expect(pose.weapon).toBeLessThan(-2); // up and back
    holdPose('sword', 'attack', 0, 1, pose);
    expect(pose.weapon).toBeGreaterThan(1); // down and forward
    const mid = holdPose('sword', 'attack', 0, .55, { arm: 0, weapon: 0 });
    expect(mid.weapon).toBeGreaterThan(-2.6);
    expect(mid.weapon).toBeLessThan(1.25);
  });

  it('a bow is drawn level and held upright; a spear thrusts forward', () => {
    const bow = holdPose('bow', 'attack', 0, .9, { arm: 0, weapon: 0 });
    expect(Math.abs(bow.arm)).toBeLessThan(.3);
    expect(bow.weapon).toBeCloseTo(-1.57, 0);
    const spear = holdPose('spear', 'attack', 0, 1, { arm: 0, weapon: 0 });
    expect(Math.abs(spear.weapon)).toBeLessThan(.05);
  });

  it('every kind rests at its own angle and follows the run cycle', () => {
    for (const kind of Object.keys(WEAPON_SPECS) as WeaponKind[]) {
      const idle = holdPose(kind, 'idle', 0, 0, { arm: 0, weapon: 0 });
      expect(idle.weapon).toBe(WEAPON_SPECS[kind].idle);
      const a = holdPose(kind, 'run', Math.PI / 2, 0, { arm: 0, weapon: 0 });
      const b = holdPose(kind, 'run', -Math.PI / 2, 0, { arm: 0, weapon: 0 });
      expect(a.arm).not.toBeCloseTo(b.arm, 2);
    }
    const bare = holdPose(null, 'idle', 0, 0, { arm: 0, weapon: 0 });
    expect(bare.arm).toBe(EMPTY_ARM);
  });

  it('engine states map to painter actions', () => {
    expect(keeperAction('run')).toBe('run');
    expect(keeperAction('walk')).toBe('idle');
    expect(keeperAction(undefined)).toBe('idle');
    expect(keeperAction('idle', true)).toBe('death');
  });

  it('frames: the run cycle walks all eight, the attack splits at the hit', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 1; t += .01) seen.add(frameIndex('run', t, 0, false));
    expect(seen.size).toBe(RUN_FRAMES);
    expect(frameIndex('attack', 0, .2, false)).toBe(0);
    expect(frameIndex('attack', 0, .6, false)).toBe(1);
    expect(frameIndex('run', .37, 0, true)).toBe(0);
    expect(bodyFrame('run', 2).front.dx).toBe(-bodyFrame('run', 2).back.dx);
  });
});

describe('keeper-paint: equipping changes the pixels', () => {
  function pixels(painter: KeeperPainter): string {
    const el = document.createElement('canvas');
    el.width = el.height = 96;
    painter.still(el);
    return el.toDataURL();
  }

  it('a look, a helm and a weapon each change the painted Keeper', () => {
    const look = defaultLook();
    const bare = pixels(new KeeperPainter(look));
    const restyled = pixels(new KeeperPainter({ ...look, hair: 'curls', skin: 6 }));
    const armed = pixels(new KeeperPainter(look, { weapon: gearPiece('weapon', 'Starfall Maul', 'celestial', 'legendary') }));
    const helmed = pixels(new KeeperPainter(look, {
      weapon: gearPiece('weapon', 'Starfall Maul', 'celestial', 'legendary'), head: gearPiece('head', 'Cometfall Helm', 'celestial', 'epic'),
    }));
    expect(new Set([bare, restyled, armed, helmed]).size).toBe(4);
    expect(pixels(new KeeperPainter(look))).toBe(bare); // deterministic
  });

  it('paints every action without throwing', () => {
    const painter = new KeeperPainter(defaultLook(), { weapon: gearPiece('weapon', 'Meridian Longbow', 'celestial', 'rare'), chest: gearPiece('chest', "Aureth's Mantle", 'luminous', 'singular') });
    const el = document.createElement('canvas'); el.width = el.height = 200;
    const c = el.getContext('2d')!;
    for (const action of ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'dodge', 'rest', 'death'] as const) {
      c.save(); c.translate(100, 190);
      expect(() => painter.draw(c, 4, { action, time: .3, attackT: .5, rim: .5 })).not.toThrow();
      c.restore();
    }
  });
});
