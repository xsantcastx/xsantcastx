/**
 * forge-audio.service.ts — the coin ping and the anvil hit.
 *
 * Synthesised, not downloaded, exactly as the rarity cues are: two oscillators
 * and an envelope is a few hundred bytes of code against a few tens of
 * kilobytes of sample, and nothing here needs to sound like a recording.
 *
 * The AudioContext is created on the first sound and never before. A visitor
 * who never opens the Market never pays for an audio graph — and because the
 * first sound is always downstream of a click, the context is created inside a
 * user gesture and is never born suspended.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type Ctor = typeof AudioContext;

/** One enveloped oscillator inside a cue. */
interface Voice {
  freq: number;
  type: OscillatorType;
  gain: number;
  start: number;
  dur: number;
}

/** Equal-temperament frequency ratio for a semitone offset. */
function ratio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

@Injectable({ providedIn: 'root' })
export class ForgeAudioService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ctx: AudioContext | null = null;
  private muted = false;

  /** Off for anyone who has asked the platform for less motion and noise. */
  private get suppressed(): boolean {
    if (!this.isBrowser || this.muted) return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Exposed on the console object next to the ambient drone toggle. */
  setMuted(muted: boolean): void { this.muted = muted; }

  /** A short high ping. The sound of a purchase landing. */
  coin(): void {
    this.tone([
      { freq: 1_320, type: 'triangle', gain: 0.10, start: 0, dur: 0.05 },
      { freq: 1_980, type: 'sine', gain: 0.06, start: 0.035, dur: 0.06 },
    ]);
  }

  /**
   * A dull struck-metal thud. One strike of the Flame.
   *
   * `semitones` pitches the whole hit up without changing its shape, which is
   * how the combo ladder is heard before it is read: the same anvil, struck
   * harder. Both voices shift together — moving only one would detune the
   * interval between them and turn a thud into a chord.
   */
  strike(semitones = 0): void {
    const k = ratio(semitones);
    this.tone([
      { freq: 220 * k, type: 'triangle', gain: 0.05, start: 0, dur: 0.07 },
      { freq: 660 * k, type: 'sine', gain: 0.03, start: 0, dur: 0.05 },
    ]);
  }

  /**
   * A rune surfacing out of the anvil, layered over the strike that produced it.
   *
   * `semitones` comes off the rune's tier table, so the ladder is heard before
   * the colour is read — the same argument the combo tiers make. The rising
   * pair is deliberately *after* the hit rather than under it: a rune is the
   * consequence of the strike, and a cue that lands simultaneously reads as one
   * louder hammer rather than as something arriving.
   *
   * Above the Epic rung a sub-bass voice is added. That is the only channel a
   * phone speaker cannot reproduce and a desk speaker can, which makes it the
   * right place to put the difference between "good" and "stop what you are
   * doing" — the ones who feel it are the ones sitting somewhere they would
   * notice a screen flash anyway.
   */
  runeReveal(semitones = 0, heavy = false): void {
    const k = ratio(semitones);
    const voices: Voice[] = [
      { freq: 330 * k, type: 'sine', gain: 0.035, start: 0.08, dur: 0.28 },
      { freq: 495 * k, type: 'sine', gain: 0.025, start: 0.14, dur: 0.34 },
    ];
    if (heavy) {
      voices.push({ freq: 55, type: 'sine', gain: 0.09, start: 0.05, dur: 1.1 });
      voices.push({ freq: 990 * k, type: 'triangle', gain: 0.02, start: 0.22, dur: 0.5 });
    }
    this.tone(voices);
  }

  /**
   * A scroll unrolling, layered over whatever the rune already played.
   *
   * Deliberately not another bell. Every cue in this file so far is pitched
   * metal, and a scroll announced with more pitched metal would be heard as a
   * louder rune rather than as a second, different thing. This is the one cue
   * built from noise instead of tone: a short rising breath, no fundamental,
   * which reads as paper next to an anvil without anybody having to be told.
   *
   * Two detuned high triangles beating against each other approximate the
   * texture closely enough at this length, and cost two oscillators against the
   * buffer of white noise the honest version would need.
   */
  scrollUnfurl(): void {
    this.tone([
      { freq: 2100, type: 'triangle', gain: 0.012, start: 0.16, dur: 0.30 },
      { freq: 2183, type: 'triangle', gain: 0.012, start: 0.17, dur: 0.28 },
      { freq: 1480, type: 'sine', gain: 0.014, start: 0.24, dur: 0.34 },
    ]);
  }

  /**
   * The Void. One rune in the table reaches this and most ledgers never will.
   *
   * A descending sub-bass under a held cluster: everything else in this file
   * rises, so the one cue that falls is unmistakable even to someone who has
   * heard the other six a thousand times.
   */
  voidRumble(): void {
    const voices: Voice[] = [
      { freq: 41, type: 'sine', gain: 0.11, start: 0, dur: 3.0 },
      { freq: 62, type: 'sine', gain: 0.07, start: 0.1, dur: 2.6 },
      { freq: 82.4, type: 'triangle', gain: 0.05, start: 0.25, dur: 2.2 },
    ];
    // A slow arpeggio out of the rumble, so the three seconds have a shape
    // rather than being three seconds of held bass.
    [523.25, 392, 329.63, 261.63].forEach((freq, i) => {
      voices.push({ freq, type: 'sine', gain: 0.03, start: 0.6 + i * 0.35, dur: 0.9 });
    });
    this.tone(voices);
  }

  /**
   * The flourish on the strike that crosses a combo tier, layered over the
   * pitched strike rather than replacing it.
   *
   * `semitones` comes off the tier table so the ladder is defined in one place.
   * The upper rungs each add a channel rather than just getting louder — an
   * overtone, then a decay tail, then a bass impact, then an arpeggio — because
   * volume alone stops reading as escalation about two steps in.
   */
  comboTier(semitones: number): void {
    const k = ratio(semitones);
    const base = 440 * k;

    const voices: Voice[] = [
      { freq: base, type: 'triangle', gain: 0.08, start: 0, dur: 0.18 },
      { freq: base * 1.5, type: 'sine', gain: 0.05, start: 0.03, dur: 0.2 },
    ];

    // From +5 up: a ringing overtone two octaves over the fundamental.
    if (semitones >= 5) {
      voices.push({ freq: base * 4, type: 'sine', gain: 0.03, start: 0.05, dur: 0.26 });
    }

    // From +7 up: three decaying repeats. Not a convolution reverb — there is no
    // impulse response here and pretending otherwise would mean shipping one —
    // but a tail of quieter copies reads as space, which is the part that
    // matters at the volume this plays at.
    if (semitones >= 7) {
      for (let i = 1; i <= 3; i++) {
        voices.push({
          freq: base * 1.5,
          type: 'sine',
          gain: 0.045 / (i + 1),
          start: 0.09 * i,
          dur: 0.22,
        });
      }
    }

    this.tone(voices);
  }

  /** The Millennium hit: a bass impact under a high ring. */
  comboImpact(): void {
    this.tone([
      { freq: 80, type: 'sine', gain: 0.13, start: 0, dur: 0.55 },
      { freq: 120, type: 'triangle', gain: 0.07, start: 0, dur: 0.4 },
      { freq: 1_500, type: 'sine', gain: 0.05, start: 0.02, dur: 0.7 },
      { freq: 2_250, type: 'sine', gain: 0.025, start: 0.06, dur: 0.6 },
    ]);
  }

  /**
   * The top of the ladder: an ascending arpeggio that lands on a sustained
   * chord. The only sound on the site that takes more than a second, for the
   * only thing on it that takes 83 minutes.
   */
  comboAscension(): void {
    // A minor arpeggio climbing two octaves, then the triad held under it.
    const climb = [440, 523.25, 659.25, 880, 1_046.5, 1_318.5, 1_760];
    const voices: Voice[] = climb.map((freq, i) => ({
      freq,
      type: 'triangle' as OscillatorType,
      gain: 0.07,
      start: i * 0.085,
      dur: 0.16,
    }));

    const chordAt = climb.length * 0.085;
    for (const freq of [440, 523.25, 659.25, 880]) {
      voices.push({ freq, type: 'sine', gain: 0.05, start: chordAt, dur: 1.9 });
    }
    voices.push({ freq: 110, type: 'sine', gain: 0.09, start: chordAt, dur: 2.1 });

    this.tone(voices);
  }

  /**
   * The Nameless, at 666. Deep, detuned and slow, with the chain over it.
   *
   * The two bass voices are a couple of hertz apart on purpose: the beating
   * between them is what makes it sit wrong, and it is a far better use of two
   * oscillators than making it merely louder.
   */
  comboNameless(): void {
    const voices: Voice[] = [
      { freq: 42, type: 'sine', gain: 0.14, start: 0, dur: 1.5 },
      { freq: 44.5, type: 'sine', gain: 0.12, start: 0, dur: 1.5 },
      { freq: 61, type: 'triangle', gain: 0.06, start: 0.1, dur: 1.2 },
    ];
    // The chain: short, bright, irregularly spaced square blips over the rumble.
    const rattle = [0.16, 0.23, 0.29, 0.38, 0.44, 0.53, 0.61, 0.72];
    for (const start of rattle) {
      voices.push({ freq: 2_600 + (start * 1_900), type: 'square', gain: 0.012, start, dur: 0.035 });
    }
    this.tone(voices);
  }

  /** Louder, with a fifth over it. Every hundredth strike. */
  century(): void {
    this.tone([
      { freq: 440, type: 'triangle', gain: 0.09, start: 0, dur: 0.22 },
      { freq: 660, type: 'sine', gain: 0.07, start: 0.04, dur: 0.24 },
      { freq: 880, type: 'sine', gain: 0.05, start: 0.09, dur: 0.28 },
    ]);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The ambient hum
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * A furnace, heard from the next room. Started only by the Forge View, and
   * only on an explicit click of its speaker button.
   *
   * ── WHY IT IS NEVER STARTED AUTOMATICALLY ─────────────────────────────────
   * Sound that begins because a page loaded is the single most reliable way to
   * make somebody close a tab, and browsers agree — an AudioContext created
   * outside a gesture is born suspended, so an auto-start would be silent on
   * the first visit and audible on the second, which is worse than either.
   * The button is the gesture, and the choice is remembered by the caller.
   *
   * ── THE GRAPH ─────────────────────────────────────────────────────────────
   * Three voices into a lowpass: a 55 Hz sine that is the body of it, a 110 Hz
   * triangle detuned a few cents against a second at 110.4 Hz so the two beat
   * slowly against each other, and nothing above that. The filter sweeps
   * between 180 and 420 Hz over forty seconds, which is what stops it reading
   * as a test tone — a fixed lowpass on a fixed drone is a fridge.
   */
  private drone: {
    oscs: OscillatorNode[];
    gain: GainNode;
    filter: BiquadFilterNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  } | null = null;

  get humming(): boolean { return this.drone !== null; }

  startHum(): boolean {
    if (this.suppressed || this.drone) return false;
    const ctx = this.context();
    if (!ctx) return false;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* ignore */ });

    const now = ctx.currentTime;

    const gain = ctx.createGain();
    // Four seconds to reach full. A drone that arrives at volume is a noise;
    // one that fades up is something the room was already doing.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.Q.setValueAtTime(0.7, now);

    // The sweep. An oscillator into the filter's frequency param, rather than a
    // chain of scheduled ramps: one node that runs forever beats a timer that
    // has to keep re-arming itself and drifts when the tab is throttled.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(1 / 40, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(120, now);
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(now);

    const oscs = ([
      { freq: 55, type: 'sine' as OscillatorType, gain: 1 },
      { freq: 110, type: 'triangle' as OscillatorType, gain: 0.35 },
      { freq: 110.4, type: 'triangle' as OscillatorType, gain: 0.35 },
    ]).map(v => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, now);
      amp.gain.setValueAtTime(v.gain, now);
      osc.connect(amp).connect(filter);
      osc.start(now);
      return osc;
    });

    filter.connect(gain).connect(ctx.destination);

    this.drone = { oscs, gain, filter, lfo, lfoGain };
    return true;
  }

  /**
   * Fade out over a second and a half, then tear the graph down.
   *
   * Stopping the oscillators outright would put a click through the speakers,
   * which is exactly the sound the mute button exists to avoid making.
   */
  stopHum(): void {
    const drone = this.drone;
    const ctx = this.ctx;
    if (!drone || !ctx) { this.drone = null; return; }
    this.drone = null;

    const now = ctx.currentTime;
    try {
      drone.gain.gain.cancelScheduledValues(now);
      drone.gain.gain.setValueAtTime(Math.max(0.0001, drone.gain.gain.value), now);
      drone.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      drone.oscs.forEach(o => o.stop(now + 1.6));
      drone.lfo.stop(now + 1.6);
    } catch {
      // A node already stopped, or a context torn down under us. Nothing left
      // to clean up that the garbage collector will not take.
    }
  }

  private context(): AudioContext | null {
    if (!this.isBrowser) return null;
    if (this.ctx) return this.ctx;
    const Ctor: Ctor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  /**
   * Play a set of enveloped oscillators. Each gets its own gain node with an
   * exponential decay — a linear ramp to zero reads as a click at the tail, and
   * `exponentialRampToValueAtTime` cannot reach zero, hence the 0.0001 floor.
   */
  private tone(voices: Voice[]): void {
    if (this.suppressed) return;
    const ctx = this.context();
    if (!ctx) return;
    // Autoplay policy can leave a context suspended if it was ever created
    // outside a gesture. Resuming is a no-op when it is already running.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* ignore */ });

    const now = ctx.currentTime;
    for (const v of voices) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, now + v.start);
      amp.gain.setValueAtTime(0.0001, now + v.start);
      amp.gain.exponentialRampToValueAtTime(v.gain, now + v.start + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + v.start + v.dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start(now + v.start);
      osc.stop(now + v.start + v.dur + 0.02);
    }
  }
}
