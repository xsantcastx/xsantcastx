import { SoundDirector } from './sound-director';
import { defaultSound, type SoundSettings } from './sound-settings.model';
import { soundRng, type SoundScene } from './sound-palette';

/**
 * Loudness guards, rendered for real (OfflineAudioContext in the test browser):
 * the quiet first-visit levels must still be heard, full levels must never clip,
 * and mute must be silence. Numbers are dBFS of the rendered buffer.
 */
const RATE = 22050;

function scene(over: Partial<SoundScene> = {}): SoundScene {
  return { realm: 'infernal', delve: false, boss: false, hour: 12, water: false, lava: false, ink: false, glim: false, ...over };
}

async function render(seconds: number, settings: SoundSettings, drive: (d: SoundDirector) => void): Promise<{ peak: number; rms: number }> {
  const ctx = new OfflineAudioContext(2, Math.floor(RATE * seconds), RATE);
  const d = new SoundDirector(ctx as unknown as AudioContext, settings);
  drive(d);
  const buf = await ctx.startRendering();
  d.destroy();
  let peak = 0, sum = 0, n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; sum += v * v; n++; }
  }
  const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
  return { peak: db(peak), rms: db(Math.sqrt(sum / n)) };
}

/** Private hooks the clocks normally drive, called directly for a deterministic render. */
type Hooks = { running: boolean; playPhrase(): void; refreshBeds(): void };

describe('SoundDirector loudness (rendered offline)', () => {
  // The score is random by design; a seeded generator keeps these renders the same on every run.
  beforeEach(() => { const rand = soundRng(42); spyOn(Math, 'random').and.callFake(rand); });
  const phrase = (d: SoundDirector) => { const h = d as unknown as Hooks; d.setScene(scene()); h.running = true; h.playPhrase(); h.running = false; };

  it('the quiet default score is heard, and full never clips', async () => {
    const quiet = await render(8, defaultSound(), phrase);
    expect(quiet.peak).toBeGreaterThan(-36);
    expect(quiet.peak).toBeLessThan(-12);
    const full = await render(8, { ...defaultSound(), music: 1 }, phrase);
    expect(full.peak).toBeLessThan(-1);
    expect(full.peak).toBeGreaterThan(quiet.peak);
  });

  it('the ambience bed is a floor you can hear, not a wall', async () => {
    const bed = await render(4, defaultSound(), d => { const h = d as unknown as Hooks; d.setScene(scene({ realm: 'celestial' })); h.running = true; h.refreshBeds(); h.running = false; });
    expect(bed.rms).toBeGreaterThan(-52);
    expect(bed.rms).toBeLessThan(-24);
  });

  it('effects are clear at the default, and mute is silence', async () => {
    const fx = await render(2, defaultSound(), d => { const h = d as unknown as Hooks; h.running = true; d.sfx('craft'); d.sfx('break', { material: 'ore' }); });
    expect(fx.peak).toBeGreaterThan(-30);
    expect(fx.peak).toBeLessThan(-6);
    const muted = await render(2, { ...defaultSound(), muted: true }, d => { const h = d as unknown as Hooks; h.running = true; d.sfx('craft'); phrase(d); });
    expect(muted.peak).toBeLessThan(-80);
  });
});
