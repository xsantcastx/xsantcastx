/**
 * hidden-cap.ts — a forgotten hidden tab must not keep the Hearth (Cloud Run) billed round the clock (owner's budget,
 * 2026-10-26). The game never pauses (td-engine stepHidden) and the stream stays open while the tab is hidden — but
 * only for {@link HIDDEN_STREAM_CAP_MS}. Past that the stream closes (the world on this screen keeps running exactly as
 * before); the moment the tab is seen again the room is joined afresh, which restores presence, the party (the room
 * keeps an account's party across a relog) and a whole world snapshot (sent when a stream opens).
 *
 * Pure timing over two room verbs, so a spec can drive it with fake timers.
 */
export const HIDDEN_STREAM_CAP_MS = 30 * 60_000;

export interface CappedRoom {
  /** Close the stream and stop updates (keeps wanting the room). */
  pause(): void;
  /** Back: join the room again at once, fresh (the old session has idled out by now). */
  rejoinNow(): void;
}

export class HiddenStreamCap {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  constructor(private readonly room: () => CappedRoom | undefined, private readonly capMs = HIDDEN_STREAM_CAP_MS) {}

  /** True once the cap closed the stream (until the tab is seen again). */
  get capped(): boolean { return this.closed; }

  /** The tab went out of sight: the stream may stay open for the cap, no longer. */
  hidden(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; this.closed = true; this.room()?.pause(); }, this.capMs);
  }
  /** The tab is in sight again: under the cap nothing changed; past it, the room is joined again now. */
  shown(): void {
    clearTimeout(this.timer); this.timer = undefined;
    if (!this.closed) return;
    this.closed = false;
    this.room()?.rejoinNow();
  }
  dispose(): void { clearTimeout(this.timer); this.timer = undefined; }
}
