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
