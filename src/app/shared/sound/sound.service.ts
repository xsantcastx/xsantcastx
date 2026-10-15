/**
 * sound.service.ts — the world's sound: the player's levels (through the save
 * gateway) and the lazy director that makes the noise.
 *
 * The only writer of `godforge-sound` (sound-settings.model.ts): read once on
 * first use, written through on every change, registered with LocalSaveRegistry
 * so a cloud merge lands in memory in the same tick.
 *
 * Autoplay: nothing sounds until the first tap or key in the world (`arm`). The
 * AudioContext is made INSIDE that gesture, synchronously, and a silent buffer
 * is played on it — the iOS unlock — before the director's chunk is fetched, so
 * the context is never born suspended. A hidden tab pauses everything (and the
 * context suspends, so a phone in a pocket burns no battery on a score).
 *
 * All director work runs outside Angular: its clocks are setTimeouts that must
 * never wake change detection, and none of it touches the render loop.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SOUND_KEY, type SoundChannel, type SoundSettings, clampLevel, coerceSound, defaultSound } from './sound-settings.model';
import type { SoundScene } from './sound-palette';
import type { SfxCue, SfxOptions, SoundDirector } from './sound-director';

export type SoundStatus = 'idle' | 'waiting' | 'loading' | 'live' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly zone = inject(NgZone);
  private readonly subject = new BehaviorSubject<SoundSettings>(defaultSound());
  private readonly status$$ = new BehaviorSubject<SoundStatus>('idle');
  private hydrated = false;
  private ctx: AudioContext | null = null;
  private director: SoundDirector | null = null;
  private scene: SoundScene | null = null;
  private sceneKey = '';
  private unbind: (() => void) | null = null;

  get settings(): SoundSettings { this.hydrate(); return this.subject.value; }
  get settings$(): Observable<SoundSettings> { this.hydrate(); return this.subject.asObservable(); }
  get status(): SoundStatus { return this.status$$.value; }
  readonly status$: Observable<SoundStatus> = this.status$$.asObservable();
  /** Phrases of the score played this session (0 before the first tap). */
  get phrases(): number { return this.director?.phrases ?? 0; }
  /** The world as the score last heard it (the Slate's "now playing"), or null before the world. */
  get nowScene(): SoundScene | null { return this.scene; }
  /** The Slate's skip: the next phrase now (nothing before the first tap). */
  skip(): void { if (this.director) this.zone.runOutsideAngular(() => this.director?.skip()); }

  /** Move a slider (0..1). */
  setLevel(channel: SoundChannel, value: number, at = Date.now()): void {
    this.hydrate();
    const cur = this.subject.value;
    this.save({ ...cur, [channel]: clampLevel(value, cur[channel]), updatedAt: Math.max(at, cur.updatedAt + 1) });
  }

  setMuted(muted: boolean, at = Date.now()): void {
    this.hydrate();
    const cur = this.subject.value;
    if (cur.muted === muted) return;
    this.save({ ...cur, muted, updatedAt: Math.max(at, cur.updatedAt + 1) });
  }

  toggleMuted(): boolean {
    this.setMuted(!this.settings.muted);
    return this.subject.value.muted;
  }

  /**
   * The world is open: wait for the first gesture, then start. Returns the
   * release (call it when the world closes: the sound stops with it).
   */
  arm(): () => void {
    if (!this.isBrowser) return () => undefined;
    this.hydrate();
    this.unbind?.();
    const doc = document;
    const gesture = (): void => this.unlock();
    const visibility = (): void => this.zone.runOutsideAngular(() => {
      if (!this.director) return;
      if (doc.hidden) this.director.pause(); else this.director.resume();
    });
    const opts = { capture: true, passive: true } as const;
    doc.addEventListener('pointerdown', gesture, opts);
    doc.addEventListener('keydown', gesture, opts);
    doc.addEventListener('touchend', gesture, opts);
    doc.addEventListener('visibilitychange', visibility);
    this.unbind = () => {
      doc.removeEventListener('pointerdown', gesture, opts);
      doc.removeEventListener('keydown', gesture, opts);
      doc.removeEventListener('touchend', gesture, opts);
      doc.removeEventListener('visibilitychange', visibility);
    };
    if (this.director) {
      // Back in the world after a page elsewhere: the context was unlocked once already.
      this.zone.runOutsideAngular(() => this.director?.resume());
    } else if (this.status$$.value === 'idle') this.status$$.next('waiting');
    return () => this.release();
  }

  /** The world closed: silence, and stop listening. The director is kept for the next visit. */
  release(): void {
    this.unbind?.(); this.unbind = null;
    this.zone.runOutsideAngular(() => this.director?.pause());
  }

  /** What the world around the Keeper is like; a repeat of the same scene is free. */
  setScene(scene: SoundScene): void {
    const key = `${scene.realm}|${+scene.delve}${+scene.boss}${+scene.water}${+scene.lava}${+scene.ink}${+scene.glim}${+!!scene.eclipse}|${scene.hour}`;
    if (key === this.sceneKey) return;
    this.sceneKey = key;
    this.scene = scene;
    if (this.director) this.zone.runOutsideAngular(() => this.director?.setScene(scene));
  }

  /** One effect. Before the first tap (or while loading) it is simply not heard. */
  sfx(cue: SfxCue, opts?: SfxOptions): void {
    if (!this.director) return;
    this.zone.runOutsideAngular(() => this.director?.sfx(cue, opts));
  }

  // ── Inside ────────────────────────────────────────────────────────────────

  /** The first gesture. Later gestures return at once (the listeners stay until release: cheap). */
  private unlock(): void {
    // A touch's pointerdown is not a user activation in every browser (its touchend is):
    // a context made on the first one may be suspended, and the next gesture wakes it.
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.unbind && !document.hidden) this.wake(this.ctx);
      return;
    }
    if (this.status$$.value === 'unsupported') return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) { this.status$$.next('unsupported'); return; }
    let ctx: AudioContext;
    try { ctx = new Ctor(); } catch { this.status$$.next('unsupported'); return; }
    this.ctx = ctx;
    this.wake(ctx);
    this.status$$.next('loading');
    void import('./sound-director').then(({ SoundDirector }) => this.zone.runOutsideAngular(() => {
      const director = new SoundDirector(ctx, this.subject.value);
      this.director = director;
      if (this.scene) director.setScene(this.scene);
      if (this.unbind && !document.hidden) director.start();
      this.zone.run(() => this.status$$.next('live'));
    })).catch(() => this.status$$.next('unsupported'));
  }

  /** iOS: a silent buffer played inside a gesture unlocks the context for good; then resume. */
  private wake(ctx: AudioContext): void {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination); src.start(0);
    } catch { /* nothing to unlock */ }
    void ctx.resume().catch(() => undefined);
  }

  private save(next: SoundSettings): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(SOUND_KEY, next);
    if (this.director) this.zone.runOutsideAngular(() => this.director?.applySettings(next));
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceSound(this.store.read(SOUND_KEY)));
    this.saves.register(SOUND_KEY, {
      rehydrate: () => {
        const next = coerceSound(this.store.read(SOUND_KEY));
        this.subject.next(next);
        if (this.director) this.zone.runOutsideAngular(() => this.director?.applySettings(next));
      },
    });
  }
}
