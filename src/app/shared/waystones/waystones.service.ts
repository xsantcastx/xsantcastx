/**
 * waystones.service.ts — the only writer of `godforge-waystones`, and the
 * Waystones' travel (One World §3, docs/design/one-world.md).
 *
 * The contract the Mirror Slate's Map app (and the Travel map) codes against:
 *
 *   view$        { world, stones: { id, col, row, lit, seen, kind }[], anchors, here }
 *   travel(id)   channel (1.5 s; Quick Hands 0.8), then step to that lit stone
 *   recall()     channel (3 s), then the town stone of the Keeper's world: free, from anywhere
 *   canTravel()  why not right now (the Slate's busy rule), or null
 *
 * The engine knows where stones are and draws them; the play view attaches
 * itself as the `WaystoneHost` (what the world holds, where the Keeper is, the
 * step itself). This service knows what is lit and seen, and writes it.
 *
 *   light(id)  RECEIPT FIRST: the id goes into `lit` and is written before the
 *              +15 Delving XP is granted through the skill pipeline under the
 *              mutation id `waystone:<id>`, so a reload or a second tab never
 *              pays twice. Nothing else is paid (no Gold): the economy sim is
 *              untouched.
 *
 * Saved through the gateway, registered with LocalSaveRegistry: a cloud merge
 * lands in memory in the same tick. Written only while One World is on (the
 * play view only calls in then).
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { SkillActionService } from '../skills/skill-actions.service';
import {
  channelSeconds, coerceWaystones, emptyWaystones, isLit, LIGHT_XP, RECALL_SECONDS, surveyCount, surveyMarks, WAYSTONES_KEY,
  type WaystonesState,
} from './waystones.model';

/** One stone as the Travel map lists it. */
export interface WaystonePin { id: string; col: number; row: number; lit: boolean; seen: boolean; kind: 'town' | 'region' | 'wild' | 'deep'; world: string }
/** What the Travel map (and the Slate's Map app) shows. */
export interface WaystoneView {
  world: string | null;
  stones: readonly WaystonePin[];
  anchors: readonly { col: number; row: number }[];
  /** The lit stone the Keeper stands at, or null. */
  here: string | null;
}
/** A travel or a recall under way: the bar fills over `seconds`. */
export interface TravelChannel { kind: 'travel' | 'recall'; id: string; seconds: number; startedAt: number }

/** What the play view tells the Waystones about the world (it attaches itself while the world is up). */
export interface WaystoneHost {
  /** The world the Keeper is in ('ember'), or null (a flat town, a legacy area outside any world). */
  world(): string | null;
  /** Every stone the Travel map may list (authored ones, and wild ones by id), with their positions. */
  stones(): readonly Omit<WaystonePin, 'lit' | 'seen'>[];
  /** The stone the Keeper stands at, or null. */
  here(): string | null;
  anchors(): readonly { col: number; row: number }[];
  /** Why travel is refused right now (fighting, a line out, a story card…) as an i18n key, or null. */
  refusal(): string | null;
  /** Generate the target's column during the channel. */
  prefetch(id: string): void;
  /** Step to the stone (the engine). False: nothing moved. */
  travelTo(id: string): boolean;
  /** The town stone of the Keeper's world. */
  recall(): boolean;
}

@Injectable({ providedIn: 'root' })
export class WaystoneService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly skills = inject(SkillActionService);
  private current: WaystonesState = emptyWaystones();
  private hydrated = false;
  private host: WaystoneHost | null = null;
  private readonly view$$ = new BehaviorSubject<WaystoneView>({ world: null, stones: [], anchors: [], here: null });
  private readonly channel$$ = new BehaviorSubject<TravelChannel | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Wall clock (tests pass a fake). */
  now: () => number = () => Date.now();

  readonly view$: Observable<WaystoneView> = this.view$$.asObservable();
  /** A travel or recall under way (the bar), or null. */
  readonly channel$: Observable<TravelChannel | null> = this.channel$$.asObservable();
  get view(): WaystoneView { return this.view$$.value; }
  get channel(): TravelChannel | null { return this.channel$$.value; }
  get state(): Readonly<WaystonesState> { this.hydrate(); return this.current; }

  /** The play view attaches while the world is up (and detaches on the way out). */
  attach(host: WaystoneHost | null): void { this.host = host; this.refresh(); }

  litSet(): ReadonlySet<string> { this.hydrate(); return new Set(this.current.lit); }
  seenSet(): ReadonlySet<string> { this.hydrate(); return new Set(this.current.seen); }
  /** The Meridian Survey marks reached (Sera's Chart, Quick Hands, …). */
  marks(): string[] { this.hydrate(); return surveyMarks(surveyCount(this.current)); }

  /** A stone came into view: it shows on the map, grey until lit. True the first time. */
  markSeen(id: string): boolean {
    if (!this.isBrowser) return false;
    this.hydrate();
    if (this.current.seen.includes(id)) return false;
    this.save({ ...this.current, seen: [...this.current.seen, id] });
    return true;
  }

  /**
   * Light a stone (E held 1.2 s). Receipt first, then +15 Delving XP once.
   * Returns the XP paid (0 on a replay), and a survey mark this one reached, or
   * null when it was already lit, is a trunk stone, or on the server.
   */
  light(id: string, locationId: string): { xp: number; mark: string | null } | null {
    if (!this.isBrowser) return null;
    this.hydrate();
    if (this.current.lit.includes(id)) return null;
    const before = this.marks();
    this.save({ ...this.current, lit: [...this.current.lit, id], seen: this.current.seen.includes(id) ? this.current.seen : [...this.current.seen, id] });
    const after = this.marks();
    const mark = after.find(m => !before.includes(m)) ?? null;
    if (mark) this.save({ ...this.current, marks: [...this.current.marks, mark] });
    const result = this.skills.act({ mutationId: `waystone:${id}`, skill: 'delving', xp: LIGHT_XP, locationId });
    return { xp: result.ok && !result.replayed ? LIGHT_XP : 0, mark };
  }

  /** Why travel is refused right now (an i18n key), or null. */
  canTravel(): string | null {
    if (!this.host) return 'travelmap.refuse.away';
    if (this.channel$$.value) return 'travelmap.refuse.busy';
    return this.host.refusal();
  }

  /** Travel to a lit stone: the channel, then the step. Resolves true when the Keeper arrived. */
  travel(id: string): Promise<boolean> {
    const host = this.host;
    const stone = this.view.stones.find(s => s.id === id);
    if (!host || !stone || !stone.lit || this.canTravel() || stone.id === this.view.here) return Promise.resolve(false);
    host.prefetch(id);
    return this.run({ kind: 'travel', id, seconds: channelSeconds(this.marks()), startedAt: this.now() }, () => host.travelTo(id));
  }

  /** Recall to the town stone of this world: free, from anywhere (the busy rule still applies). */
  recall(): Promise<boolean> {
    const host = this.host;
    if (!host || this.canTravel()) return Promise.resolve(false);
    return this.run({ kind: 'recall', id: 'recall', seconds: RECALL_SECONDS, startedAt: this.now() }, () => host.recall());
  }

  /** Stop a channel (a key pressed, the map closed). */
  cancel(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const pending = this.pending;
    this.pending = null;
    this.channel$$.next(null);
    pending?.(false);
  }
  private pending: ((ok: boolean) => void) | null = null;

  private run(channel: TravelChannel, step: () => boolean): Promise<boolean> {
    this.cancel();
    this.channel$$.next(channel);
    return new Promise(resolve => {
      this.pending = resolve;
      this.timer = setTimeout(() => {
        this.timer = null; this.pending = null;
        this.channel$$.next(null);
        // The busy rule again at the end of the channel: a fight that found the Keeper meanwhile wins.
        const ok = !this.host?.refusal() && step();
        this.refresh();
        resolve(ok);
      }, channel.seconds * 1000);
    });
  }

  /** Re-read what the host knows and publish the view (the play view calls this on its HUD tick). */
  refresh(): void {
    const host = this.host;
    if (!host || !this.isBrowser) { this.view$$.next({ world: null, stones: [], anchors: [], here: null }); return; }
    this.hydrate();
    const lit = new Set(this.current.lit), seen = new Set(this.current.seen);
    const stones = host.stones().map(s => ({ ...s, lit: isLit(this.current, { id: s.id, trunk: s.kind === 'town' }) || lit.has(s.id), seen: s.kind === 'town' || seen.has(s.id) }))
      .filter(s => s.seen || s.lit);
    const next: WaystoneView = { world: host.world(), stones, anchors: host.anchors(), here: host.here() };
    const was = this.view$$.value;
    if (JSON.stringify(was) !== JSON.stringify(next)) this.view$$.next(next);
  }

  private save(next: WaystonesState): void {
    this.current = coerceWaystones(next);
    if (this.isBrowser) this.store.write(WAYSTONES_KEY, this.current);
    this.refresh();
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.current = coerceWaystones(this.store.read(WAYSTONES_KEY));
    this.saves.register(WAYSTONES_KEY, { rehydrate: () => { this.current = coerceWaystones(this.store.read(WAYSTONES_KEY)); this.refresh(); } });
  }
}
