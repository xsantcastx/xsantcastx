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

  /** A dull struck-metal thud. One strike of the Flame. */
  strike(): void {
    this.tone([
      { freq: 220, type: 'triangle', gain: 0.05, start: 0, dur: 0.07 },
      { freq: 660, type: 'sine', gain: 0.03, start: 0, dur: 0.05 },
    ]);
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
  private tone(
    voices: Array<{ freq: number; type: OscillatorType; gain: number; start: number; dur: number }>,
  ): void {
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
