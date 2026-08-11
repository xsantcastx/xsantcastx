/**
 * rarity-audio.service.ts — drop sounds, synthesised.
 *
 * No audio files: five cues built from oscillators and a noise buffer, so the
 * whole sound design costs zero network bytes and zero decode time. The
 * AudioContext is created on the first cue, not at bootstrap — a visitor who
 * never finds an egg never pays for an audio graph.
 *
 * A browser will not let a context start before a gesture, and every cue here
 * is downstream of one (a click, a keystroke, a tool interaction), so the
 * resume() is a formality that only matters when a discovery lands from a
 * timer.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RarityDefinition } from './rarity.model';

type Cue = RarityDefinition['sound'];

@Injectable({ providedIn: 'root' })
export class RarityAudioService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ctx: AudioContext | null = null;
  private muted = false;

  /** Console/settings hook. Mute survives only the session, by design. */
  setMuted(muted: boolean): void { this.muted = muted; }
  get isMuted(): boolean { return this.muted; }

  play(cue: Cue): void {
    if (!this.isBrowser || this.muted || cue === 'none') return;
    // A drop sound is decoration. Honour the same preference that silences the
    // cosmic engine's animations.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    switch (cue) {
      case 'blip':   return this.blip(ctx, t);
      case 'chime':  return this.chime(ctx, t);
      case 'horn':   return this.horn(ctx, t);
      case 'impact': return this.impact(ctx, t);
      case 'prism':  return this.prism(ctx, t);
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * One oscillator through one gain envelope. Every cue below is built from
   * this, so the shaping lives in exactly one place.
   */
  private tone(
    ctx: AudioContext,
    opts: {
      type: OscillatorType;
      from: number;
      to?: number;
      start: number;
      dur: number;
      peak: number;
      /** Seconds to reach `peak`. Short is a pluck, long is a swell. */
      attack?: number;
      detune?: number;
      filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
    }
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    if (opts.detune) osc.detune.value = opts.detune;

    osc.frequency.setValueAtTime(opts.from, opts.start);
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.to),
        opts.start + opts.dur
      );
    }

    const attack = opts.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, opts.start);
    gain.gain.exponentialRampToValueAtTime(opts.peak, opts.start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.dur);

    let node: AudioNode = osc;
    if (opts.filter) {
      const biq = ctx.createBiquadFilter();
      biq.type = opts.filter.type;
      biq.Q.value = opts.filter.q ?? 1;
      biq.frequency.setValueAtTime(opts.filter.from, opts.start);
      if (opts.filter.to !== undefined) {
        biq.frequency.exponentialRampToValueAtTime(
          Math.max(1, opts.filter.to),
          opts.start + opts.dur
        );
      }
      osc.connect(biq);
      node = biq;
    }

    node.connect(gain);
    gain.connect(ctx.destination);
    osc.start(opts.start);
    osc.stop(opts.start + opts.dur + 0.05);
  }

  /** Mortal / Eclipsed — a short two-note rise. Present, not celebratory. */
  private blip(ctx: AudioContext, t: number): void {
    this.tone(ctx, { type: 'triangle', from: 660, start: t, dur: 0.1, peak: 0.06 });
    this.tone(ctx, { type: 'triangle', from: 990, start: t + 0.07, dur: 0.14, peak: 0.05 });
  }

  /** Sacred — a bell. Fundamental plus the inharmonic partials that read as metal. */
  private chime(ctx: AudioContext, t: number): void {
    const partials: Array<[number, number, number]> = [
      // [ratio, gain, decay]
      [1,    0.09, 1.5],
      [2.76, 0.04, 1.1],
      [5.4,  0.02, 0.8],
    ];
    for (const [ratio, peak, dur] of partials) {
      this.tone(ctx, { type: 'sine', from: 880 * ratio, start: t, dur, peak, attack: 0.004 });
    }
    // A fifth a beat later turns one strike into a phrase.
    this.tone(ctx, { type: 'sine', from: 1320, start: t + 0.16, dur: 1.2, peak: 0.05 });
  }

  /** Anomalous — a horn. Sawtooth swelling under a lowpass that opens as it rises. */
  private horn(ctx: AudioContext, t: number): void {
    this.tone(ctx, {
      type: 'sawtooth', from: 196, to: 294, start: t, dur: 0.9, peak: 0.1, attack: 0.09,
      filter: { type: 'lowpass', from: 500, to: 2600, q: 3 },
    });
    // Detuned unison — two saws a few cents apart is what makes a horn a section.
    this.tone(ctx, {
      type: 'sawtooth', from: 196, to: 294, start: t, dur: 0.9, peak: 0.07, attack: 0.09,
      detune: 9, filter: { type: 'lowpass', from: 500, to: 2200, q: 3 },
    });
    this.tone(ctx, { type: 'sine', from: 98, to: 147, start: t, dur: 1.0, peak: 0.09, attack: 0.06 });
  }

  /** Mythic — a bass impact. Sub sweep plus a filtered noise crack for the transient. */
  private impact(ctx: AudioContext, t: number): void {
    this.tone(ctx, { type: 'sine', from: 150, to: 28, start: t, dur: 1.5, peak: 0.34, attack: 0.004 });
    this.tone(ctx, { type: 'triangle', from: 90, to: 34, start: t, dur: 1.1, peak: 0.16, attack: 0.004 });
    this.noise(ctx, t, 0.32, 0.2, 1800);
    // A dissonant tritone tail — the sound of something being let out.
    this.tone(ctx, { type: 'sawtooth', from: 220, start: t + 0.05, dur: 1.4, peak: 0.05,
      attack: 0.2, filter: { type: 'lowpass', from: 900, to: 200, q: 2 } });
    this.tone(ctx, { type: 'sawtooth', from: 311, start: t + 0.05, dur: 1.4, peak: 0.04,
      attack: 0.2, filter: { type: 'lowpass', from: 900, to: 200, q: 2 } });
  }

  /** Singular — a prismatic arpeggio over the impact, because it is both. */
  private prism(ctx: AudioContext, t: number): void {
    this.impact(ctx, t);
    // A major-ninth arpeggio climbing out of the impact.
    [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((f, i) => {
      this.tone(ctx, { type: 'sine', from: f, start: t + 0.18 + i * 0.09, dur: 0.9, peak: 0.08 });
    });
  }

  /** White noise burst through a lowpass — the click at the front of an impact. */
  private noise(ctx: AudioContext, t: number, peak: number, dur: number, cutoff: number): void {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Fade the noise across the buffer so it reads as a hit, not a hiss.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const biq = ctx.createBiquadFilter();
    biq.type = 'lowpass';
    biq.frequency.value = cutoff;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(biq);
    biq.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }
}
