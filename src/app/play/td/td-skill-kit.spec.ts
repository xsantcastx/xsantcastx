import { SKILLS } from './td-skills';
import { KEEPER_ANIMS, SKILL_KIT, biteCueOf, skillKit } from './td-skill-kit';
import { ANIMS, animFrame, animSecs, overlayRects } from './td-keeper-anim';
import { MOBS } from './td-mobs';
import { BITE_CUES, COMBAT_CUES } from '../../shared/sound/combat-cues';

/** S3 (skills-100.md §0.6): every row and basic attack has a frame set, an FX and a cue; every creature a bite. */
describe('The skill kit (S3)', () => {
  it('every skill in the book has its animation, its cues and its element', () => {
    for (const id of Object.keys(SKILLS)) {
      const k = SKILL_KIT[id];
      expect(k).withContext(id).toBeDefined();
      if (!k) continue;
      expect(KEEPER_ANIMS).withContext(id).toContain(k.anim);
      if (k.cast) expect(COMBAT_CUES).withContext(id).toContain(k.cast);
      if (k.hit) expect(COMBAT_CUES).withContext(id).toContain(k.hit);
    }
  });

  it('every active skill sounds on its cast, and every damaging row on its hit', () => {
    for (const [id, s] of Object.entries(SKILLS)) {
      const k = skillKit(id);
      if (s.kind === 'active') expect(k.cast).withContext(id).not.toBeNull();
      if ('min' in s.vars || 'dps' in s.vars) expect(k.hit ?? k.cast).withContext(id).not.toBeNull();
    }
  });

  it('every creature bites with its family\'s sound', () => {
    for (const id of Object.keys(MOBS)) expect(BITE_CUES).withContext(id).toContain(biteCueOf(id));
    expect(biteCueOf('bone-walker')).toBe('bite-bone');
    expect(biteCueOf('cinder-orc')).toBe('bite-orc');
  });

  it('every animation is 2–6 frames at 80–100 ms, and ends', () => {
    for (const a of KEEPER_ANIMS) {
      const s = ANIMS[a];
      expect(s.frames.length).withContext(a).toBeGreaterThanOrEqual(2);
      expect(s.frames.length).withContext(a).toBeLessThanOrEqual(6);
      expect(s.ms).withContext(a).toBeGreaterThanOrEqual(80);
      expect(s.ms).withContext(a).toBeLessThanOrEqual(100);
      if (!s.loop) expect(animFrame(a, animSecs(a) + .01)).withContext(a).toBeNull();
    }
  });

  it('reduced motion: the figure stands still and the tell (the key frame\'s overlay) stays', () => {
    for (const a of KEEPER_ANIMS) {
      const f = animFrame(a, .05, true)!;
      expect(f.dx).withContext(a).toBe(0);
      expect(f.dy).withContext(a).toBe(0);
      expect(f.o).withContext(a).toBe(ANIMS[a].frames[ANIMS[a].key].o);
    }
  });

  it('Low draws only the overlay\'s core', () => {
    expect(overlayRects('slam', true).length).toBeLessThan(overlayRects('slam', false).length);
    expect(overlayRects('slam', true).every(r => r[4] === 0)).toBeTrue();
  });
});

import type { EngineOptions } from '../engine/engine.model';
import { MobSystem, type MobHost } from './td-mobs';

describe('The fight asks for its cues and animations (S3)', () => {
  const sys = (): MobSystem => {
    const keeper = { x: 0, y: 0 };
    const host: MobHost = { options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper, hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined };
    const s = new MobSystem(host);
    s.aura = null;
    return s;
  };

  it('a cast queues its cast cue and the Keeper\'s animation; its hit queues the hit cue and an impact spark', () => {
    const s = sys();
    s.addSpawns([{ key: 'w', type: 'bone-walker', x: 30, y: 0 }]);
    expect(s.useAbility('hellfire-nova')).toBeNull();
    expect(s.keeperAnim).toBe('cast-slam');
    expect(s.cues.map(c => c.cue)).toContain('fire-cast');
    expect(s.cues.map(c => c.cue)).toContain('fire-hit');
    expect(s.effects.some(e => e.kind === 'impact')).toBeTrue();
  });

  it('a creature\'s bite on the Keeper sounds its family and lunges', () => {
    const s = sys();
    s.addSpawns([{ key: 'b', type: 'bone-walker', x: 8, y: 0 }]);
    for (let i = 0; i < 200 && !s.cues.some(c => c.cue.startsWith('bite-')); i++) s.update(.02);
    expect(s.cues.some(c => c.cue === 'bite-bone')).toBeTrue();
    expect(s.mobs[0].lungeAt).toBeDefined();
  });

  it('nobody draining (the room) never piles the cues past 24', () => {
    const s = sys();
    for (let i = 0; i < 100; i++) s.sfxCue('fire-hit');
    expect(s.cues.length).toBe(24);
  });
});
