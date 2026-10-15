/**
 * world-clock.service.ts — the world clock for Angular (world-clock.model.ts is
 * the clock itself; docs/handoff/world-clock.md).
 *
 * Every reader asks this service, never `new Date()`, so the whole game shares
 * one hour: the sky the engine draws, the herbs and fish that keep the dark,
 * the ambience, the keepers' lines, the Slate's lock screen and the eclipse.
 * It holds no state of its own beyond a test skew: the time is a pure function
 * of the real clock (time-zone and DST proof).
 *
 * The test hook: under automation (navigator.webdriver) or a dev build the page
 * gets `window.__eclipseClock` — `skew(ms)` shifts this tab's world clock,
 * `to(day, minute)` jumps to an in-game moment, `toEclipse(minute?)` to the next
 * eclipse, `reset()`. The skew lives in sessionStorage so a reload in the same
 * tab keeps it. It is never written to the save, never synced, and a player's
 * own browser never has it.
 */
import { Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { setWorldHourSource } from '../world/world-hour';
import { ECLIPSE, msAt, nextEclipse, skyAt, worldTime, type Sky, type WorldTime, type EclipseWindow, eclipseAt } from './world-clock.model';

/** sessionStorage key of the test skew (ms). Not a save blob. */
export const CLOCK_SKEW_KEY = 'eclipse-clock-skew';

interface ClockHook {
  skew(ms: number): void;
  to(day: number, minute: number): void;
  toEclipse(minute?: number): void;
  reset(): void;
  now(): WorldTime;
}

@Injectable({ providedIn: 'root' })
export class WorldClockService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private skewMs = 0;

  constructor() {
    // One World's settlements (keeper routines, lit windows) read the hour through world-hour.ts: point it here,
    // so there is one clock (the caller passes the real time; the test skew is added the same way as now()).
    setWorldHourSource({ hour: now => worldTime(now + this.skewMs).minute / 60 });
    if (!this.browser) return;
    const automated = typeof navigator !== 'undefined' && !!(navigator as Navigator & { webdriver?: boolean }).webdriver;
    if (!automated && !isDevMode()) return;
    try { this.skewMs = Number(sessionStorage.getItem(CLOCK_SKEW_KEY)) || 0; } catch { this.skewMs = 0; }
    const set = (ms: number) => {
      this.skewMs = Math.round(ms) || 0;
      try { sessionStorage.setItem(CLOCK_SKEW_KEY, String(this.skewMs)); } catch { /* this tab only */ }
    };
    const hook: ClockHook = {
      skew: ms => set(ms),
      to: (day, minute) => set(msAt(day, minute) - Date.now()),
      toEclipse: (minute = ECLIPSE.start + 60) => {
        const w = nextEclipse(Date.now() + this.skewMs);
        set(msAt(w.id, minute) - Date.now());
      },
      reset: () => set(0),
      now: () => this.time(),
    };
    (window as unknown as { __eclipseClock?: ClockHook }).__eclipseClock = hook;
  }

  /** The real instant the world reads (epoch ms; the test skew included). */
  now(): number { return Date.now() + this.skewMs; }
  time(ms = this.now()): WorldTime { return worldTime(ms); }
  sky(ms = this.now()): Sky { return skyAt(ms); }
  eclipse(ms = this.now()): EclipseWindow | null { return eclipseAt(ms); }
  nextEclipse(ms = this.now()): EclipseWindow { return nextEclipse(ms); }
  /** Night, or the night at noon an eclipse makes: when the dark-keeping things are out. */
  dark(ms = this.now()): boolean { return skyAt(ms).dark; }
}
