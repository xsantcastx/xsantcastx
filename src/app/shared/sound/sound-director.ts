/**
 * sound-director.ts — the sound of the world, synthesised. LAZY: imported by
 * SoundService on the first tap in the world, never by the app shell.
 *
 * No audio files. Every note, footstep and bird is oscillators, two noise
 * buffers and envelopes, which costs a few kilobytes of code instead of
 * megabytes of samples and lets each realm's score be tuned as data
 * (sound-palette.ts).
 *
 *   ┌ music ───── voices → lowpass (realm warmth) ─┬─ dry ───────┐
 *   │                                              └─ reverb ────┤→ music bus ┐
 *   ├ ambience ── beds (looped noise, LFOs) + event beds (birds,  → amb bus  ──┤→ master → out
 *   │             crickets, drips with a cave echo, chimes, crackle)           │
 *   └ effects ─── one-shot cues (steps, digs, pickups, the catch…)  → sfx bus ─┘
 *
 * Off the render loop by construction: the score and the event beds run on
 * their own setTimeout clocks (started outside Angular by the service), the
 * continuous beds are looped buffers modulated by oscillators (no JS per
 * frame), and a cue costs a handful of nodes that stop themselves.
 */
import {
  BEDS, ambienceFor, composePhrase, midiToHz, paletteFor, sceneMode,
  type Bed, type Material, type MusicPalette, type SoundScene, type VoiceKind,
} from './sound-palette';
import { channelGain, type SoundSettings } from './sound-settings.model';

export type SfxCue =
  | 'step' | 'land' | 'dig' | 'break' | 'clang'
  | 'pickup' | 'coin' | 'craft' | 'equip' | 'levelup'
  | 'cast' | 'bite' | 'reel' | 'splash' | 'catch'
  | 'portal' | 'tap' | 'open' | 'close';

export interface SfxOptions {
  material?: Material;
  /** Semitones up (a run of pickups climbs). */
  pitch?: number;
}

/** Loudness of each bed at full slider (the beds are a floor, never a wall). */
const BED_VOLUME: Readonly<Record<Bed, number>> = {
  wind: .22, birds: .5, crickets: .18, murmur: .16, chimes: .3, leaves: .1,
  drips: .55, rumble: .5, water: .3, lava: .22, ink: .35,
};
/** The shortest gap between two of a cue (a run of steps never becomes a buzz). */
const CUE_GAP: Partial<Record<SfxCue, number>> = { step: .11, tap: .05, dig: .05, pickup: .045, coin: .05, clang: .12 };

interface ContinuousBed { gain: GainNode; stop: () => void }

export class SoundDirector {
  private readonly master: GainNode;
  private readonly musicBus: GainNode;
  private readonly musicLevel: GainNode;
  private readonly musicIn: GainNode;
  private readonly musicTone: BiquadFilterNode;
  private readonly musicSend: GainNode;
  private readonly ambBus: GainNode;
  private readonly sfxBus: GainNode;
  /** The cave echo (drips, the Delve's footsteps). */
  private readonly echoIn: GainNode;
  private readonly white: AudioBuffer;
  private readonly brown: AudioBuffer;

  private settings: SoundSettings;
  private scene: SoundScene | null = null;
  private palette: MusicPalette = paletteFor('infernal');
  private beds = new Map<Bed, ContinuousBed>();
  private bedTarget: Record<Bed, number> = Object.fromEntries(BEDS.map(b => [b, 0])) as Record<Bed, number>;
  private drone: { stop: () => void; root: number } | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastCue = new Map<SfxCue, number>();
  /** Phrases played since start (the specs and the handoff's tuning notes read it). */
  phrases = 0;

  constructor(private readonly ctx: AudioContext, settings: SoundSettings) {
    this.settings = settings;
    const c = ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.musicBus = this.gain(this.master, 0);
    this.musicLevel = this.gain(this.musicBus, 1);
    this.musicTone = c.createBiquadFilter();
    this.musicTone.type = 'lowpass'; this.musicTone.frequency.value = 2600; this.musicTone.Q.value = .4;
    this.musicTone.connect(this.musicLevel);
    this.musicIn = this.gain(this.musicTone, 1);
    // A soft hall: generated once (two seconds of decaying noise), shared by the score.
    const verb = c.createConvolver();
    verb.buffer = this.impulse(2.6, 2.4);
    this.musicSend = c.createGain(); this.musicSend.gain.value = .35;
    this.musicTone.connect(this.musicSend); this.musicSend.connect(verb); verb.connect(this.musicLevel);
    this.ambBus = this.gain(this.master, 0);
    this.sfxBus = this.gain(this.master, 0);
    // The cave echo: a feedback delay, darkened each time round.
    this.echoIn = c.createGain(); this.echoIn.gain.value = 1;
    const delay = c.createDelay(1); delay.delayTime.value = .23;
    const fb = c.createGain(); fb.gain.value = .38;
    const dark = c.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 1800;
    this.echoIn.connect(delay); delay.connect(dark); dark.connect(fb); fb.connect(delay);
    const wet = this.gain(this.ambBus, .5); dark.connect(wet);
    this.white = this.noise(2, false);
    this.brown = this.noise(3, true);
    this.applySettings(settings, true);
  }

  // ── Control ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    // The first phrase comes after a breath, not on the tap.
    this.queuePhrase(1.5 + Math.random() * 2.5);
    this.tick();
    this.refreshBeds();
  }

  /** The tab hid: everything holds where it is (the context suspends; the clocks stop). */
  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.running) return;
    void this.ctx.resume().catch(() => undefined);
    this.start();
  }

  destroy(): void {
    this.running = false;
    this.clearTimers();
    for (const bed of this.beds.values()) bed.stop();
    this.beds.clear();
    this.drone?.stop(); this.drone = null;
    try { this.master.disconnect(); } catch { /* already gone */ }
  }

  applySettings(s: SoundSettings, instant = false): void {
    this.settings = s;
    const now = this.ctx.currentTime, k = instant ? .01 : .25;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, now, k);
    this.musicBus.gain.setTargetAtTime(channelGain(s, 'music') * .9, now, k);
    this.ambBus.gain.setTargetAtTime(channelGain(s, 'ambience'), now, k);
    this.sfxBus.gain.setTargetAtTime(channelGain(s, 'effects') * .8, now, k);
    if (this.running) this.refreshBeds();
  }

  setScene(scene: SoundScene): void {
    const prev = this.scene;
    this.scene = scene;
    const mode = sceneMode(scene);
    if (!prev || prev.realm !== scene.realm || sceneMode(prev) !== mode) {
      this.palette = paletteFor(scene.realm, mode);
      const now = this.ctx.currentTime;
      this.musicTone.frequency.setTargetAtTime(this.palette.bright, now, 2);
      this.musicSend.gain.setTargetAtTime(this.palette.space, now, 2);
      this.musicLevel.gain.setTargetAtTime(this.palette.level, now, 2);
      // A guardian wakes: the next phrase comes sooner, over a drone.
      if (mode === 'boss' && this.running) this.queuePhrase(1.2);
      this.setDrone(this.palette.drone ? this.palette.root - 12 : null);
    }
    this.bedTarget = ambienceFor(scene);
    if (this.running) this.refreshBeds();
  }

  /** One cue. Dropped while the tab is hidden or the effects are at zero. */
  sfx(cue: SfxCue, opts: SfxOptions = {}): void {
    if (!this.running || this.settings.muted || this.settings.effects <= 0) return;
    const now = this.ctx.currentTime;
    const gap = CUE_GAP[cue];
    if (gap && now - (this.lastCue.get(cue) ?? -1) < gap) return;
    this.lastCue.set(cue, now);
    const t = now + .005;
    const up = Math.pow(2, (opts.pitch ?? 0) / 12);
    switch (cue) {
      case 'step': return this.step(t, opts.material ?? 'stone', .22);
      case 'land': return this.step(t, opts.material ?? 'stone', .45, .7);
      case 'dig': return this.dig(t, opts.material ?? 'stone', false);
      case 'break': return this.dig(t, opts.material ?? 'stone', true);
      case 'clang': return this.clang(t);
      case 'pickup': return this.blip(t, 1318.5 * up, 1975.5 * up, .16);
      case 'coin': return this.coin(t);
      case 'craft': return this.arpeggio(t, [72, 76, 79, 84], 'bell', .09, .3, true);
      case 'equip': return this.equip(t);
      case 'levelup': return this.arpeggio(t, [67, 72, 76, 79, 84], 'bell', .11, .32, true);
      case 'cast': return this.cast(t);
      case 'bite': return this.plop(t, .35);
      case 'reel': return this.reel(t);
      case 'splash': return this.splash(t, .4);
      case 'catch': this.splash(t, .22); return this.arpeggio(t + .12, [79, 86], 'bell', .1, .26, false);
      case 'portal': return this.portal(t);
      case 'tap': return this.tone(t, 'sine', 1250, .045, .05, .002);
      case 'open': return this.whoosh(t, 500, 1600, .16, .12);
      case 'close': return this.whoosh(t, 1400, 500, .14, .1);
    }
  }

  // ── The score ─────────────────────────────────────────────────────────────

  private queuePhrase(seconds: number): void {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = setTimeout(() => this.playPhrase(), Math.max(.2, seconds) * 1000);
  }

  private playPhrase(): void {
    this.musicTimer = null;
    if (!this.running) return;
    const p = this.palette;
    if (this.settings.muted || this.settings.music <= 0) { this.queuePhrase(4); return; }
    const phrase = composePhrase(p, Math.random);
    const t0 = this.ctx.currentTime + .08;
    for (const midi of phrase.chord) this.voice(p.under, midi, t0, phrase.length + 2.5, .14);
    for (const n of phrase.notes) this.voice(p.lead, n.midi, t0 + n.at, n.dur, n.vel);
    let tail = 0;
    // Glim hums it back: the Margin-Light keeps the realm's tune (lore-addendum, "Glim hums").
    if (this.scene?.glim && Math.random() < .3 && phrase.notes.length >= 2) {
      const echo = phrase.notes.slice(-3);
      const start = phrase.length + .9;
      echo.forEach((n, i) => this.hum(n.midi + 12, t0 + start + i * p.beat * 1.2, p.beat * 1.6));
      tail = start + echo.length * p.beat * 1.2;
    }
    this.phrases++;
    this.queuePhrase(Math.max(phrase.length, tail) + phrase.rest);
  }

  private setDrone(root: number | null): void {
    if (root === null) { this.drone?.stop(); this.drone = null; return; }
    if (this.drone?.root === root) return;
    this.drone?.stop();
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain(); g.gain.value = 0; g.connect(this.musicIn);
    g.gain.setTargetAtTime(.05, t, 2);
    const oscs = [0, 7].map((iv, i) => {
      const o = c.createOscillator(); o.type = i ? 'sine' : 'triangle';
      o.frequency.value = midiToHz(root + iv); o.detune.value = i ? 4 : -4;
      o.connect(g); o.start(t); return o;
    });
    // It breathes: a slow swell, never a pulse.
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = .09; depth.gain.value = .025; lfo.connect(depth); depth.connect(g.gain); lfo.start(t);
    this.drone = {
      root,
      stop: () => {
        const now = c.currentTime;
        g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 1.2);
        for (const o of [...oscs, lfo]) o.stop(now + 5);
      },
    };
  }

  /** One note of the score in its voice. `vel` 0..1. */
  private voice(kind: VoiceKind, midi: number, t: number, dur: number, vel: number): void {
    const f = midiToHz(midi), v = vel * .24;
    switch (kind) {
      case 'piano': {
        const decay = Math.min(4.5, dur + 1.8);
        const lp = this.filter('lowpass', 2800, this.musicIn);
        lp.frequency.setValueAtTime(2800, t); lp.frequency.exponentialRampToValueAtTime(700, t + decay);
        this.partial(t, 'triangle', f, v, decay, .006, lp, -3);
        this.partial(t, 'sine', f * 2, v * .25, decay * .6, .006, lp, 3);
        this.partial(t, 'sine', f, v * .5, decay, .004, lp);
        return;
      }
      case 'bell':
        this.partial(t, 'sine', f, v * .9, 3.6, .003, this.musicIn);
        this.partial(t, 'sine', f * 2.76, v * .28, 1.6, .002, this.musicIn);
        this.partial(t, 'sine', f * 5.4, v * .1, .5, .001, this.musicIn);
        return;
      case 'marimba':
        this.partial(t, 'sine', f, v * 1.1, .9, .003, this.musicIn);
        this.partial(t, 'sine', f * 4, v * .25, .14, .001, this.musicIn);
        this.noiseHit(t, 'bandpass', f * 3, 6, v * .2, .02, this.musicIn);
        return;
      case 'pluck': {
        const lp = this.filter('lowpass', 2400, this.musicIn);
        lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + .8);
        this.partial(t, 'triangle', f, v, 1.1, .002, lp);
        this.partial(t, 'square', f, v * .12, .5, .002, lp);
        return;
      }
      case 'flute': {
        const g = this.env(t, v * .9, .22, dur, .7, this.musicIn);
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
        lfo.frequency.value = 5; depth.gain.value = 9; lfo.connect(depth); depth.connect(o.detune);
        o.connect(g); o.start(t); lfo.start(t); o.stop(t + dur + 1); lfo.stop(t + dur + 1);
        this.partial(t, 'sine', f * 2, v * .08, dur, .3, this.musicIn);
        this.noiseHit(t, 'bandpass', f * 2, 3, v * .12, dur * .8, this.musicIn, .2);
        return;
      }
      case 'pad': {
        const g = this.env(t, v * .55, 1.4, dur, 2.2, this.musicIn);
        const lp = this.filter('lowpass', 900, g);
        for (const d of [-7, 7]) {
          const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
          o.connect(lp); o.start(t); o.stop(t + dur + 3);
        }
        return;
      }
    }
  }

  /** Glim's hum: a soft sine with a little vibrato, an octave up. */
  private hum(midi: number, t: number, dur: number): void {
    const g = this.env(t, .045, .18, dur, .5, this.musicIn);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midiToHz(midi);
    const lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
    lfo.frequency.value = 5.5; depth.gain.value = 14; lfo.connect(depth); depth.connect(o.detune);
    o.connect(g); o.start(t); lfo.start(t); o.stop(t + dur + .8); lfo.stop(t + dur + .8);
  }

  // ── Ambience ──────────────────────────────────────────────────────────────

  private refreshBeds(): void {
    const now = this.ctx.currentTime;
    for (const bed of ['wind', 'murmur', 'leaves', 'rumble', 'water', 'lava', 'ink'] as const) {
      const target = this.bedTarget[bed] * BED_VOLUME[bed];
      let live = this.beds.get(bed);
      if (!live && target <= 0) continue;
      if (!live) { live = this.makeBed(bed); this.beds.set(bed, live); }
      live.gain.gain.setTargetAtTime(target, now, 1.6);
    }
  }

  private makeBed(bed: Bed): ContinuousBed {
    const c = this.ctx, t = c.currentTime;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.ambBus);
    // The swells modulate `mod`, never `out`: at a target of 0 the bed is silent, swells and all.
    const mod = c.createGain(); mod.gain.value = 1; mod.connect(out);
    const nodes: (AudioScheduledSourceNode)[] = [];
    const src = (buffer: AudioBuffer): AudioBufferSourceNode => {
      const s = c.createBufferSource(); s.buffer = buffer; s.loop = true;
      s.loopStart = 0; s.start(t, Math.random() * buffer.duration); nodes.push(s); return s;
    };
    const lfo = (hz: number, amount: number, param: AudioParam): void => {
      const o = c.createOscillator(), d = c.createGain();
      o.frequency.value = hz; d.gain.value = amount; o.connect(d); d.connect(param); o.start(t); nodes.push(o);
    };
    const chain = (source: AudioNode, type: BiquadFilterType, hz: number, q: number, level: number): BiquadFilterNode => {
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q;
      const g = c.createGain(); g.gain.value = level;
      source.connect(f); f.connect(g); g.connect(mod);
      return f;
    };
    switch (bed) {
      case 'wind': {
        const f = chain(src(this.white), 'bandpass', 520, .8, 1);
        lfo(.07, 320, f.frequency); lfo(.11, .4, mod.gain);
        break;
      }
      case 'murmur': {
        // A town's far-off talk: low noise that comes and goes in syllable-ish swells.
        const f = chain(src(this.brown), 'bandpass', 380, 1.4, 1.6);
        lfo(.31, 120, f.frequency); lfo(2.7, .25, mod.gain);
        break;
      }
      case 'leaves': {
        const f = chain(src(this.white), 'highpass', 3200, .5, .6);
        lfo(.19, 900, f.frequency);
        break;
      }
      case 'rumble': {
        chain(src(this.brown), 'lowpass', 85, .7, 2.4);
        lfo(.05, .3, mod.gain);
        break;
      }
      case 'water': {
        // Lapping: a mid band that rises and falls on two slow, out-of-step swells.
        const f = chain(src(this.white), 'bandpass', 760, 1.6, 1.2);
        lfo(.43, .45, mod.gain); lfo(.17, 260, f.frequency);
        chain(src(this.brown), 'lowpass', 300, .6, .9);
        break;
      }
      case 'lava': {
        chain(src(this.white), 'highpass', 4200, .6, .35);
        const f = chain(src(this.brown), 'lowpass', 160, 3, 1.6);
        lfo(1.7, 60, f.frequency);
        break;
      }
      case 'ink': {
        // The ink tide: a deep, slow swell with a cold sub tone under it.
        const f = chain(src(this.brown), 'lowpass', 240, 1.2, 1.8);
        lfo(.05, 120, f.frequency); lfo(.08, .5, mod.gain);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 49;
        const g = c.createGain(); g.gain.value = .25; o.connect(g); g.connect(mod); o.start(t); nodes.push(o);
        break;
      }
      default: break;
    }
    return {
      gain: out,
      stop: () => { const now = c.currentTime; for (const n of nodes) { try { n.stop(now + .05); } catch { /* stopped */ } } },
    };
  }

  /** The event beds' clock: birds, crickets, drips, chimes, crackle. ~4 Hz, never per frame. */
  private tick(): void {
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.tickTimer = setTimeout(() => this.tick(), 250);
    if (!this.running || this.settings.muted || this.settings.ambience <= 0) return;
    const b = this.bedTarget, t = this.ctx.currentTime + .02;
    if (b.birds > 0 && Math.random() < .045 * b.birds) this.bird(t, b.birds);
    if (b.crickets > 0 && Math.random() < .09 * b.crickets) this.cricket(t, b.crickets);
    if (b.drips > 0 && Math.random() < .06 * b.drips) this.drip(t, b.drips);
    if (b.chimes > 0 && Math.random() < .025 * b.chimes) this.chime(t, b.chimes);
    if (b.lava > 0 && Math.random() < .12 * b.lava) this.crackle(t, b.lava);
    if (b.water > 0 && Math.random() < .03 * b.water) this.plip(t, b.water);
  }

  private bird(t: number, level: number): void {
    const base = 2600 + Math.random() * 1800, notes = 2 + Math.floor(Math.random() * 4);
    const v = .05 * level * BED_VOLUME.birds;
    for (let i = 0; i < notes; i++) {
      const at = t + i * (.09 + Math.random() * .06), f = base * (1 + (Math.random() - .3) * .25);
      const g = this.env(at, v, .01, .05, .05, this.ambBus);
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < .5 ? 1.35 : .75), at + .08);
      o.connect(g); o.start(at); o.stop(at + .2);
    }
  }

  private cricket(t: number, level: number): void {
    const v = .02 * level, f = 4300 + Math.random() * 500;
    for (let i = 0; i < 3; i++) this.tone(t + i * .06, 'sine', f, v, .035, .004, this.ambBus);
  }

  private drip(t: number, level: number): void {
    const f = 900 + Math.random() * 900, v = .09 * level * BED_VOLUME.drips;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + .05);
    o.connect(g); g.connect(this.ambBus); g.connect(this.echoIn); o.start(t); o.stop(t + .25);
  }

  private chime(t: number, level: number): void {
    const pent = [0, 2, 4, 7, 9], midi = 84 + pent[Math.floor(Math.random() * pent.length)];
    const v = .03 * level, f = midiToHz(midi);
    this.partial(t, 'sine', f, v, 2.4, .002, this.ambBus);
    this.partial(t, 'sine', f * 2.76, v * .3, .9, .002, this.ambBus);
  }

  private crackle(t: number, level: number): void {
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) this.noiseHit(t + i * .03 * Math.random(), 'highpass', 2500, .7, .05 * level, .012, this.ambBus);
  }

  private plip(t: number, level: number): void {
    const f = 500 + Math.random() * 300, v = .05 * level;
    const g = this.env(t, v, .002, .03, .08, this.ambBus);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2, t + .06);
    o.connect(g); o.start(t); o.stop(t + .2);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  private step(t: number, m: Material, level: number, weight = 1): void {
    const jitter = .92 + Math.random() * .16;
    const cave = this.scene?.delve ? this.echoIn : null;
    const hit = (type: BiquadFilterType, hz: number, q: number, v: number, dur: number): void => {
      this.noiseHit(t, type, hz * jitter, q, v * level, dur * weight, this.sfxBus);
      if (cave) this.noiseHit(t, type, hz * jitter, q, v * level * .25, dur * weight, cave);
    };
    switch (m) {
      case 'earth': hit('lowpass', 420, .8, .9, .07); break;
      case 'grass': hit('highpass', 2400, .6, .45, .06); hit('lowpass', 500, .7, .4, .05); break;
      case 'wood': hit('bandpass', 650, 2.2, .8, .05); this.tone(t, 'sine', 170 * jitter, .12 * level, .07, .002); break;
      case 'ore': case 'metal': hit('bandpass', 2600, 3, .5, .04); this.tone(t, 'sine', 1150 * jitter, .05 * level, .12, .001); break;
      case 'crystal': hit('bandpass', 3400, 4, .35, .03); this.tone(t, 'sine', 2300 * jitter, .05 * level, .2, .001); break;
      case 'water': this.splash(t, .12 * level); break;
      default: hit('bandpass', 1500, 1.4, .7, .045); hit('lowpass', 260, .7, .5, .05); break;
    }
  }

  private dig(t: number, m: Material, broke: boolean): void {
    const base = m === 'earth' || m === 'grass' ? 380 : m === 'wood' ? 700 : m === 'crystal' ? 3000 : m === 'ore' || m === 'metal' ? 2200 : 1300;
    this.noiseHit(t, 'bandpass', base * (.9 + Math.random() * .2), 1.6, .55, .06, this.sfxBus);
    this.tone(t, 'sine', m === 'earth' ? 110 : 150, .2, .08, .002);
    if (m === 'ore' || m === 'metal' || m === 'crystal') this.tone(t, 'triangle', base * .55, .06, .16, .001);
    if (!broke) return;
    // It gives: a short crumble of grains, and ore rings as it comes free.
    for (let i = 1; i <= 4; i++) this.noiseHit(t + i * .035, 'lowpass', base * (1.2 - i * .15), .8, .32 / i, .07, this.sfxBus);
    if (m === 'ore') this.blip(t + .08, 1567.98, 2349.3, .07);
    if (m === 'crystal') this.blip(t + .06, 2093, 3136, .06);
  }

  private clang(t: number): void {
    this.partial(t, 'sine', 920, .1, .45, .001, this.sfxBus);
    this.partial(t, 'sine', 1385, .06, .3, .001, this.sfxBus);
    this.noiseHit(t, 'highpass', 3000, .7, .12, .02, this.sfxBus);
  }

  private blip(t: number, a: number, b: number, v: number): void {
    this.tone(t, 'sine', a, v, .07, .003);
    this.tone(t + .06, 'sine', b, v * .9, .12, .003);
  }

  private coin(t: number): void {
    this.tone(t, 'triangle', 1318.5, .1, .08, .002);
    this.tone(t + .07, 'triangle', 1975.5, .1, .28, .002);
  }

  private arpeggio(t: number, notes: number[], kind: VoiceKind, gap: number, v: number, shimmer: boolean): void {
    notes.forEach((midi, i) => {
      const f = midiToHz(midi), at = t + i * gap;
      this.partial(at, 'sine', f, v * .5, kind === 'bell' ? 1.6 : .6, .003, this.sfxBus);
      this.partial(at, 'sine', f * 2.76, v * .12, .6, .002, this.sfxBus);
    });
    if (shimmer) this.noiseHit(t + notes.length * gap * .5, 'highpass', 6000, .5, .05, .5, this.sfxBus, .1);
  }

  private equip(t: number): void {
    this.whoosh(t, 900, 300, .14, .14);
    this.noiseHit(t + .1, 'bandpass', 2400, 4, .2, .03, this.sfxBus);
    this.tone(t + .1, 'triangle', 660, .05, .1, .002);
  }

  private cast(t: number): void {
    this.whoosh(t, 2400, 500, .3, .16);
    this.plop(t + .38, .14);
  }

  private plop(t: number, v: number): void {
    const g = this.env(t, v, .003, .04, .12, this.sfxBus);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(170, t + .12);
    o.connect(g); o.start(t); o.stop(t + .3);
    this.noiseHit(t + .02, 'bandpass', 1400, 1.2, v * .4, .08, this.sfxBus);
  }

  private reel(t: number): void {
    for (let i = 0; i < 9; i++) this.noiseHit(t + i * .028, 'highpass', 3500, 1, .14 - i * .008, .008, this.sfxBus);
  }

  private splash(t: number, v: number): void {
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(380, t + .45);
    const g = this.env(t, v, .01, .1, .35, this.sfxBus);
    s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + .6);
  }

  private portal(t: number): void {
    const g = this.env(t, .12, .3, .6, .9, this.sfxBus);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t + 1.1);
    const lfo = this.ctx.createOscillator(), d = this.ctx.createGain();
    lfo.frequency.value = 7; d.gain.value = 22; lfo.connect(d); d.connect(o.detune);
    o.connect(g); o.start(t); lfo.start(t); o.stop(t + 2); lfo.stop(t + 2);
    this.noiseHit(t, 'bandpass', 5000, 2, .06, 1.1, this.sfxBus, .4);
    this.arpeggio(t + .5, [76, 83, 88], 'bell', .08, .18, false);
  }

  private whoosh(t: number, from: number, to: number, dur: number, v: number): void {
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.env(t, v, dur * .4, 0, dur * .6, this.sfxBus);
    s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + dur + .1);
  }

  // ── Building blocks ───────────────────────────────────────────────────────

  private gain(to: AudioNode, value: number): GainNode {
    const g = this.ctx.createGain(); g.gain.value = value; g.connect(to); return g;
  }

  private filter(type: BiquadFilterType, hz: number, to: AudioNode): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.connect(to); return f;
  }

  /** attack → hold → release envelope into `to`. */
  private env(t: number, peak: number, attack: number, hold: number, release: number, to: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.max(.001, attack));
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + hold + Math.max(.02, release));
    g.connect(to);
    return g;
  }

  /** A struck partial: quick attack, exponential decay. */
  private partial(t: number, type: OscillatorType, hz: number, peak: number, decay: number, attack: number, to: AudioNode, detune = 0): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
    g.connect(to);
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = detune;
    o.connect(g); o.start(t); o.stop(t + attack + decay + .05);
  }

  /** A short tone into the effects bus (or `to`). */
  private tone(t: number, type: OscillatorType, hz: number, peak: number, decay: number, attack: number, to: AudioNode = this.sfxBus): void {
    this.partial(t, type, hz, peak, decay, attack, to);
  }

  /** A filtered noise burst. */
  private noiseHit(t: number, type: BiquadFilterType, hz: number, q: number, peak: number, dur: number, to: AudioNode, attack = .002): void {
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = Math.min(18000, Math.max(20, hz)); f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + Math.max(.01, dur));
    s.connect(f); f.connect(g); g.connect(to);
    s.start(t, Math.random() * (this.white.duration - 1)); s.stop(t + attack + dur + .05);
  }

  private noise(seconds: number, brown: boolean): AudioBuffer {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private clearTimers(): void {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.musicTimer = null; this.tickTimer = null;
  }
}
