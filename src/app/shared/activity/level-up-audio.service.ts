/**
 * level-up-audio.service.ts — the ding, and the bigger fanfare every tenth
 * level.
 *
 * Synthesised, not downloaded, the same choice the rarity drops and the forge
 * coin/anvil sounds already made: a few oscillators and an envelope cost a
 * few hundred bytes of code against tens of kilobytes of sample, and nothing
 * here needs to sound like a recording. Kept as its own small service rather
 * than folded into RarityAudioService or ForgeAudioService — both of those
 * are already scoped and documented to one concern each (rarity drops, forge
 * strikes), and a level-up is neither.
 *
 * The AudioContext is created on first use, not at bootstrap: a Keeper who
 * never reaches a level-up never pays for an audio graph, and every call here
 * is already downstream of a click (Mine), so the context is never born
 * suspended.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Voice {
  type: OscillatorType;
  from: number;
  to?: number;
  start: number;
  dur: number;
  peak: number;
  attack?: number;
}

@Injectable({ providedIn: 'root' })
export class LevelUpAudioService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean): void { this.muted = muted; }

  private get suppressed(): boolean {
    if (!this.isBrowser || this.muted) return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** An ordinary level. A short, bright two-note rise — present, not a fanfare. */
  ding(): void {
    if (this.suppressed) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.play(ctx, [
      { type: 'triangle', from: 784,  start: t,        dur: 0.11, peak: 0.09 },
      { type: 'triangle', from: 1174, start: t + 0.08,  dur: 0.16, peak: 0.08 },
    ]);
  }

  /**
   * Every tenth level. The same rising shape as `ding`, widened into a major
   * triad and answered by an octave — a chord instead of a note, the way a
   * milestone should read as more of the same good thing rather than a
   * different thing entirely.
   */
  fanfare(): void {
    if (this.suppressed) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.play(ctx, [
      { type: 'triangle', from: 523.25, start: t,        dur: 0.5, peak: 0.10 }, // C5
      { type: 'triangle', from: 659.25, start: t + 0.05,  dur: 0.5, peak: 0.09 }, // E5
      { type: 'triangle', from: 783.99, start: t + 0.10,  dur: 0.5, peak: 0.09 }, // G5
      { type: 'sine',     from: 1046.5, start: t + 0.22,  dur: 0.6, peak: 0.08, attack: 0.02 }, // C6
    ]);
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

  private play(ctx: AudioContext, voices: readonly Voice[]): void {
    if (ctx.state === 'suspended') void ctx.resume();
    for (const v of voices) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.from, v.start);
      if (v.to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.to), v.start + v.dur);
      }
      const attack = v.attack ?? 0.008;
      gain.gain.setValueAtTime(0.0001, v.start);
      gain.gain.exponentialRampToValueAtTime(v.peak, v.start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, v.start + v.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(v.start);
      osc.stop(v.start + v.dur + 0.05);
    }
  }
}
