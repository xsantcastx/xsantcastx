import { SoundDirector } from './sound-director';
import { defaultSound, type SoundSettings } from './sound-settings.model';
import { COMBAT_CUES, HIT_CAP, HitCap, isHitCue } from './combat-cues';

/** S3: the fight's cues (skills-100.md §0.6) — each one sounds, the cap holds, mute is silence. Rendered offline. */
const RATE = 22050;
async function render(seconds: number, settings: SoundSettings, drive: (d: SoundDirector) => void): Promise<{ peak: number; dropped: number }> {
  const ctx = new OfflineAudioContext(1, Math.floor(RATE * seconds), RATE);
  const d = new SoundDirector(ctx as unknown as AudioContext, settings);
  (d as unknown as { running: boolean }).running = true;
  drive(d);
  const dropped = d.hitsDropped;
  const buf = await ctx.startRendering();
  d.destroy();
  let peak = 0;
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  return { peak: 20 * Math.log10(Math.max(peak, 1e-9)), dropped };
}

describe('Combat cues (S3)', () => {
  it('the hit cap admits six in any tenth of a second and frees up as the window slides', () => {
    const cap = new HitCap();
    let n = 0;
    for (let i = 0; i < 20; i++) if (cap.admit(1)) n++;
    expect(n).toBe(HIT_CAP);
    expect(cap.admit(1.05)).toBeFalse();
    expect(cap.admit(1.1)).toBeTrue();
    expect(cap.live(1.1)).toBe(1);
  });

  it('hits and bites count toward the cap; casts never do', () => {
    expect(isHitCue('fire-hit')).toBeTrue();
    expect(isHitCue('bite-bone')).toBeTrue();
    expect(isHitCue('fire-cast')).toBeFalse();
    expect(isHitCue('heal')).toBeFalse();
  });

  it('every combat cue is synthesised and heard', async () => {
    for (const cue of COMBAT_CUES) {
      const r = await render(1.2, { ...defaultSound(), effects: 1 }, d => d.sfx(cue));
      expect(r.peak).withContext(cue).toBeGreaterThan(-45);
      expect(r.peak).withContext(cue).toBeLessThan(-1);
    }
  });

  it('a 20-creature Nova does not clip: six hit cues sound, fourteen are dropped', async () => {
    const r = await render(1.5, { ...defaultSound(), effects: 1 }, d => { d.sfx('fire-cast', { pitch: -3 }); for (let i = 0; i < 20; i++) d.sfx('fire-hit', { pitch: -3 }); });
    expect(r.dropped).toBe(14);
    expect(r.peak).toBeLessThan(-1);
  });

  it('mute and a silent effects slider are silence', async () => {
    expect((await render(1, { ...defaultSound(), muted: true }, d => d.sfx('lightning-hit'))).peak).toBeLessThan(-80);
    expect((await render(1, { ...defaultSound(), effects: 0 }, d => d.sfx('bite-orc'))).peak).toBeLessThan(-80);
  });
});
