/**
 * glim-voice.ts — the one line Glim has on screen, and the rules that put it there.
 *
 * A plain class (no Angular) the play view owns: it ticks with the HUD
 * (nextLine decides), opens hint-ladder steps when asked, and remembers through
 * the injected memory (GlimService: the save gateway, merge-safe). One line at a
 * time; a hint replaces whatever was showing; everything is dismissible.
 */
import { GLIM_HINT_MS, GLIM_LINES, GLIM_SAY_MS, GlimFacts, GlimHint, GlimLineId, glimHint, ladderTop, nextLine, pastBeats } from './glim';
import type { GlimState } from './glim-save.model';

/** What GlimVoice needs of GlimService. */
export interface GlimMemoryStore {
  readonly state: Readonly<GlimState>;
  meet(at?: Date): void;
  advance(subject: string, top?: number): number;
  said(lineId: string, at?: number): void;
}

export interface GlimSpeech {
  /** i18n key of the line. */
  key: string;
  /** The line id, for an unsolicited line. */
  line?: GlimLineId;
  /** For a hint: the step shown and the ladder's top (0 = refused). */
  hint?: { step: number; top: number };
  /** Bumped per line, so the view re-creates the bubble (and restarts its fade). */
  seq: number;
  until: number;
}

export type GlimTickFacts = Omit<GlimFacts, 'met' | 'memory' | 'lastSpokeAt' | 'speaking' | 'delveSince'>;

export class GlimVoice {
  speech: GlimSpeech | null = null;
  /** Set on the tick Glim is met; the host flies it in, then clears it. */
  justMet = false;
  private lastSpokeAt = 0;
  private delveSince = 0;
  private seq = 0;

  constructor(private readonly memory: GlimMemoryStore) {}

  get met(): boolean { return this.memory.state.met; }

  /** One HUD tick: expire the line on screen, then maybe say the next one. */
  tick(f: GlimTickFacts): GlimLineId | null {
    if (this.speech && f.now >= this.speech.until) this.speech = null;
    if (f.areaId === 'ember-delve') { if (!this.delveSince) this.delveSince = f.now; }
    else this.delveSince = 0;
    const state = this.memory.state;
    const id = nextLine({ ...f, met: state.met, memory: state, lastSpokeAt: this.lastSpokeAt, speaking: !!this.speech, delveSince: this.delveSince });
    if (!id) return null;
    if (id === 'meet') {
      this.memory.meet(new Date(f.now));
      // A veteran is not walked back through beats they are past.
      for (const past of pastBeats(f)) this.memory.said(past, f.now);
      this.justMet = true;
    }
    this.memory.said(id, f.now);
    this.lastSpokeAt = f.now;
    this.speech = { key: GLIM_LINES[id].key, line: id, seq: ++this.seq, until: f.now + GLIM_SAY_MS };
    return id;
  }

  /**
   * The next hint for a subject. `subject` files the ladder's progress (a goal
   * id survives the line changing with the area); `textKey` picks the words (the
   * goal line's key or a mission id). Off the ladder: the refusal, and nothing
   * is stored.
   */
  ask(subject: string, textKey: string, now: number): GlimHint {
    const top = ladderTop(textKey);
    const step = top ? this.memory.advance(subject, top) : 0;
    const hint = glimHint(textKey, step);
    this.speech = { key: hint.key, hint: { step: hint.step, top: hint.top }, seq: ++this.seq, until: now + GLIM_HINT_MS };
    return hint;
  }

  /** The step the next ask opens (1-based), and the ladder's top; 0/0 off the ladder. */
  peek(subject: string, textKey: string): { next: number; top: number } {
    const top = ladderTop(textKey);
    if (!top) return { next: 0, top: 0 };
    return { next: Math.min(top, (this.memory.state.ladder[subject] ?? 0) + 1), top };
  }

  dismiss(): void { this.speech = null; }
}
