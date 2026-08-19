/**
 * celebration-audio.service.ts — the fanfare, synthesised.
 *
 * Separate from `ForgeAudioService` and `RarityAudioService` rather than folded
 * into either, for two reasons that both matter:
 *
 *  1. Those two are *feedback* — the coin ping tells you the purchase landed,
 *     the anvil hit tells you the strike resolved. They play by default because
 *     silence there reads as a broken button. This is *celebration*, which is a
 *     thunderclap and a horn section, and a thunderclap nobody asked for is an
 *     unpleasant surprise. So this one is opt-in and it remembers the choice.
 *  2. The cues here are layered — six to nine voices over three seconds — and
 *     folding them into a service whose contract is "one short cue" would have
 *     made both harder to reason about.
 *
 * The preference lives in localStorage under `forge-sound-enabled` and defaults
 * to off. It is read once at construction and written on every change, and the
 * read is wrapped because a locked-down browser throws on `localStorage` access
 * rather than returning null.
 *
 * No audio files. Every sound here is oscillators, a noise buffer and envelopes,
 * which is a few hundred bytes of code instead of a few hundred kilobytes of
 * samples — and it means a Singular's five-second crescendo does not have to be
 * fetched at the moment it is needed.
 *
 * The AudioContext is built on the first *audible* cue. A visitor who never
 * turns the toggle on never constructs one.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

import type { SoundProfile } from './celebration.model';

export const SOUND_PREF_KEY = 'forge-sound-enabled';

/** One enveloped oscillator. Every cue below is stacks of these. */
interface Voice {
  type: OscillatorType;
  /** Hz at `start`. */
  from: number;
  /** Hz at `start + dur`, if it sweeps. */
  to?: number;
  /** Seconds after the cue's t0. */
  start: number;
  dur: number;
  peak: number;
  /** Seconds to reach `peak`. Short is a pluck, long is a swell. */
  attack?: number;
  detune?: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
}

@Injectable({ providedIn: 'root' })
export class CelebrationAudioService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ctx: AudioContext | null = null;

  private readonly enabled$$ = new BehaviorSubject<boolean>(this.readPref());
  /** For the toggle's own binding. */
  readonly enabled$: Observable<boolean> = this.enabled$$.asObservable();

  get enabled(): boolean { return this.enabled$$.value; }

  setEnabled(on: boolean): void {
    if (on === this.enabled$$.value) return;
    this.enabled$$.next(on);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(SOUND_PREF_KEY, on ? '1' : '0');
    } catch {
      // A browser with storage denied still gets the sound for this session.
    }
    // Built inside the click that turned it on, so the context is never born
    // suspended and the first celebration after the toggle is audible.
    if (on) this.context();
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private readPref(): boolean {
    // `isBrowser` is declared above this field, so it is already assigned by
    // the time the BehaviorSubject's initialiser runs.
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem(SOUND_PREF_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Fire a profile. Silent unless the visitor asked for sound.
   *
   * Reduced motion silences this too. Someone who has told the platform they
   * want less movement has not asked for a thunderclap either, and the two
   * preferences travel together everywhere else on the site.
   */
  play(profile: SoundProfile): void {
    if (profile === 'none') return;
    if (!this.isBrowser || !this.enabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    switch (profile) {
      case 'ping':         return this.ping(ctx, t);
      case 'chime':        return this.chime(ctx, t);
      case 'chime-bass':   return this.chimeBass(ctx, t);
      case 'thunder-horn': return this.thunderHorn(ctx, t);
      case 'crescendo':    return this.crescendo(ctx, t);
      case 'void':         return this.voidDrop(ctx, t);
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!this.isBrowser) return null;
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

  // ── The cues ───────────────────────────────────────────────────────────────

  /** Uncommon — one clean note. Acknowledgement, not celebration. */
  private ping(ctx: AudioContext, t: number): void {
    this.voices(ctx, t, [
      { type: 'triangle', from: 880, start: 0, dur: 0.16, peak: 0.05 },
      { type: 'sine', from: 1320, start: 0.05, dur: 0.24, peak: 0.035 },
    ]);
  }

  /**
   * Rare — a crystalline chime.
   *
   * A bell is its fundamental plus *inharmonic* partials: 2.76 and 5.40 are the
   * ratios that make a struck metal bar rather than an organ pipe. The fifth
   * that lands 180ms later turns one strike into a phrase, which is what makes
   * it read as good news instead of a notification.
   */
  private chime(ctx: AudioContext, t: number): void {
    this.voices(ctx, t, [
      { type: 'sine', from: 1046.5, start: 0, dur: 1.6, peak: 0.09, attack: 0.004 },
      { type: 'sine', from: 1046.5 * 2.76, start: 0, dur: 1.1, peak: 0.035, attack: 0.004 },
      { type: 'sine', from: 1046.5 * 5.4, start: 0, dur: 0.7, peak: 0.018, attack: 0.004 },
      { type: 'sine', from: 1568, start: 0.18, dur: 1.3, peak: 0.055 },
      { type: 'sine', from: 2093, start: 0.34, dur: 1.0, peak: 0.03 },
    ]);
  }

  /** Epic — the chime, with a resonant low note under it so it has a floor. */
  private chimeBass(ctx: AudioContext, t: number): void {
    this.chime(ctx, t);
    this.voices(ctx, t, [
      { type: 'sine', from: 130.8, to: 65.4, start: 0, dur: 1.8, peak: 0.26, attack: 0.006 },
      { type: 'triangle', from: 98, start: 0.02, dur: 1.4, peak: 0.11, attack: 0.02 },
      // A perfect fifth in the low register — the interval that reads as weight
      // rather than as menace. The tritone is saved for the Void.
      { type: 'sawtooth', from: 196, start: 0.08, dur: 1.5, peak: 0.05, attack: 0.18,
        filter: { type: 'lowpass', from: 900, to: 300, q: 2 } },
    ]);
    this.noise(ctx, t, 0.16, 0.18, 1400);
  }

  /**
   * Legendary — thunder, then a horn swell.
   *
   * The thunder is filtered noise with a long tail rather than a short crack:
   * a crack is a snare, and a snare is a mistake, not an event. The horn comes
   * in 240ms behind it so the two read as cause and consequence.
   */
  private thunderHorn(ctx: AudioContext, t: number): void {
    // The strike.
    this.noise(ctx, t, 0.42, 1.4, 900);
    this.voices(ctx, t, [
      { type: 'sine', from: 90, to: 26, start: 0, dur: 1.8, peak: 0.34, attack: 0.004 },
      { type: 'triangle', from: 62, to: 30, start: 0.01, dur: 1.5, peak: 0.16, attack: 0.004 },
    ]);
    // The horn section: two detuned saws under an opening lowpass, plus an
    // octave below. Detuning is the whole difference between one horn and many.
    const horn = (start: number, from: number, to: number): Voice[] => ([
      { type: 'sawtooth', from, to, start, dur: 1.5, peak: 0.10, attack: 0.16,
        filter: { type: 'lowpass', from: 500, to: 3000, q: 3 } },
      { type: 'sawtooth', from, to, start, dur: 1.5, peak: 0.08, attack: 0.16, detune: 11,
        filter: { type: 'lowpass', from: 500, to: 2400, q: 3 } },
      { type: 'sawtooth', from, to, start, dur: 1.5, peak: 0.07, attack: 0.16, detune: -9,
        filter: { type: 'lowpass', from: 500, to: 2400, q: 3 } },
      { type: 'sine', from: from / 2, to: to / 2, start, dur: 1.6, peak: 0.10, attack: 0.12 },
    ]);
    this.voices(ctx, t, horn(0.24, 196, 261.6));
    this.voices(ctx, t, horn(0.9, 261.6, 392));
  }

  /**
   * Mythic — everything at once, arriving in layers so it reads as a build.
   *
   * Thunder and horns at t0, a chime a beat later, then a shimmer of high
   * sines climbing a major ninth. Four seconds is long for a UI sound and that
   * is the point: at one strike in three hundred thousand, this had better feel
   * like it took time.
   */
  private crescendo(ctx: AudioContext, t: number): void {
    this.thunderHorn(ctx, t);
    this.chime(ctx, t + 0.5);
    // The shimmer — a rising major ninth, each note quieter than the last so
    // the phrase lifts away rather than piling up.
    [523.25, 659.25, 783.99, 987.77, 1174.66, 1568, 2093].forEach((f, i) => {
      this.voices(ctx, t, [
        { type: 'sine', from: f, start: 0.7 + i * 0.11, dur: 1.4 - i * 0.1, peak: 0.075 - i * 0.007 },
      ]);
    });
    // A third horn entry on top, a fifth above the second.
    this.voices(ctx, t, [
      { type: 'sawtooth', from: 392, to: 523.25, start: 1.6, dur: 1.8, peak: 0.08, attack: 0.3,
        filter: { type: 'lowpass', from: 700, to: 3600, q: 2.5 } },
      { type: 'sawtooth', from: 392, to: 523.25, start: 1.6, dur: 1.8, peak: 0.06, attack: 0.3, detune: 13,
        filter: { type: 'lowpass', from: 700, to: 3000, q: 2.5 } },
    ]);
  }

  /**
   * Singular — a rumble, a silence, and then the drop.
   *
   * The silence is the sound. Everything above builds continuously; this one
   * stops dead at 1.1s and leaves 0.5s of nothing before the ethereal chord,
   * which is the only cue on the site that asks you to wait.
   */
  private voidDrop(ctx: AudioContext, t: number): void {
    // The approach — a sub sweeping *down* under filtered noise. Nothing else
    // here descends, so the ear reads it as wrong before it reads it as loud.
    this.voices(ctx, t, [
      { type: 'sine', from: 58, to: 22, start: 0, dur: 1.1, peak: 0.3, attack: 0.4 },
      { type: 'sawtooth', from: 73, start: 0, dur: 1.1, peak: 0.06, attack: 0.5,
        filter: { type: 'lowpass', from: 400, to: 90, q: 4 } },
      // A tritone against the root. The interval the impact cue already uses
      // for Mythic, held long instead of struck.
      { type: 'sawtooth', from: 103.8, start: 0.1, dur: 1.0, peak: 0.05, attack: 0.5,
        filter: { type: 'lowpass', from: 400, to: 90, q: 4 } },
    ]);
    this.noise(ctx, t, 0.12, 1.0, 320);

    // ── 0.5s of silence. Deliberate. Do not fill this. ──

    // The drop, at 1.6s.
    const drop = 1.6;
    this.noise(ctx, t, 0.5, 2.4, 1600);
    this.voices(ctx, t, [
      { type: 'sine', from: 160, to: 20, start: drop, dur: 2.8, peak: 0.4, attack: 0.003 },
      { type: 'triangle', from: 110, to: 27, start: drop, dur: 2.2, peak: 0.2, attack: 0.003 },
    ]);
    // The ethereal chord — a major ninth voiced wide, entering all at once
    // rather than arpeggiated, with a long attack so it blooms out of the drop.
    [261.6, 392, 587.33, 880, 1174.66, 1760].forEach((f, i) => {
      this.voices(ctx, t, [
        { type: 'sine', from: f, start: drop + 0.06, dur: 3.4, peak: 0.085 - i * 0.008, attack: 0.5 },
        { type: 'sine', from: f, start: drop + 0.06, dur: 3.4, peak: 0.04, attack: 0.5, detune: 7 },
      ]);
    });
    // A bell on top so the chord has an edge to it.
    this.voices(ctx, t, [
      { type: 'sine', from: 2093, start: drop + 0.3, dur: 2.6, peak: 0.05, attack: 0.01 },
      { type: 'sine', from: 2093 * 2.76, start: drop + 0.3, dur: 1.6, peak: 0.02, attack: 0.01 },
    ]);
  }

  // ── The graph ──────────────────────────────────────────────────────────────

  /** One oscillator through one envelope, optionally through one filter. */
  private voices(ctx: AudioContext, t0: number, voices: Voice[]): void {
    for (const v of voices) {
      const start = t0 + v.start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      if (v.detune) osc.detune.value = v.detune;

      osc.frequency.setValueAtTime(v.from, start);
      if (v.to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.to), start + v.dur);
      }

      const attack = v.attack ?? 0.008;
      // Exponential ramps cannot touch zero, hence 0.0001 at both ends. Linear
      // ramps to silence click; this does not.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.peak), start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);

      let node: AudioNode = osc;
      if (v.filter) {
        const biq = ctx.createBiquadFilter();
        biq.type = v.filter.type;
        biq.Q.value = v.filter.q ?? 1;
        biq.frequency.setValueAtTime(v.filter.from, start);
        if (v.filter.to !== undefined) {
          biq.frequency.exponentialRampToValueAtTime(Math.max(1, v.filter.to), start + v.dur);
        }
        osc.connect(biq);
        node = biq;
      }

      node.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      // Stopped rather than left running: an oscillator that is never stopped
      // is a node the graph keeps alive for the life of the context, and a
      // player who strikes a thousand times would accumulate a thousand of them.
      osc.stop(start + v.dur + 0.05);
    }
  }

  /** White noise through a lowpass — thunder, and the transient on an impact. */
  private noise(ctx: AudioContext, t: number, peak: number, dur: number, cutoff: number): void {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Squared fade rather than linear: thunder's tail is long and quiet, and
      // a linear fade over 1.4s sounds like someone turning a dial.
      const k = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * k * k;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const biq = ctx.createBiquadFilter();
    biq.type = 'lowpass';
    biq.frequency.setValueAtTime(cutoff, t);
    biq.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.25), t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(biq);
    biq.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }
}
