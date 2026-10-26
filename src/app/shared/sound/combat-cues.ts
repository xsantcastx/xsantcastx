/**
 * combat-cues.ts — the fight's sound families (docs/design/skills-100.md §0.6, campaign.md S3: "an animation and a
 * sound for every attack"). Pure: no AudioContext, so the specs read the rules without a speaker.
 *
 * Every Keeper skill names one cast cue and one hit cue (play/td/td-skill-kit.ts); every creature's blow names a bite
 * family. The director (sound-director.ts) synthesises each one, no files. One cue plays per cast and one per hit, and
 * never more than HIT_CAP hit cues inside HIT_WINDOW seconds, so a 20-creature Nova reads as one roar, not a clip.
 */

/** The casts: one per skill use (never capped, only spaced by CUE_GAP). */
export const CAST_CUES = ['fire-cast', 'frost-cast', 'bone-cast', 'shadow-cast', 'light-cast', 'lightning-cast', 'wind', 'shield', 'heal', 'ward', 'revive', 'ultimate'] as const;
/** The hits: one per blow that lands (capped together). */
export const HIT_CUES = ['fire-hit', 'frost-hit', 'bone-hit', 'light-hit', 'lightning-hit', 'blade', 'arrow', 'beast'] as const;
/** A creature's blow on a Keeper, by family: maw clank, beast snarl, bone rattle, orc grunt, shade hiss. */
export const BITE_CUES = ['bite-maw', 'bite-beast', 'bite-bone', 'bite-orc', 'bite-shade'] as const;

export type CastCue = typeof CAST_CUES[number];
export type HitCue = typeof HIT_CUES[number];
export type BiteCue = typeof BITE_CUES[number];
export type CombatCue = CastCue | HitCue | BiteCue;
export const COMBAT_CUES: readonly CombatCue[] = [...CAST_CUES, ...HIT_CUES, ...BITE_CUES];

/** At most this many hit cues (hits and bites together) … */
export const HIT_CAP = 6;
/** … in any window this long (seconds). */
export const HIT_WINDOW = .1;

const HIT_SET: ReadonlySet<string> = new Set<string>([...HIT_CUES, ...BITE_CUES]);
/** Does this cue count toward the hit cap? */
export function isHitCue(cue: string): boolean { return HIT_SET.has(cue); }

/**
 * The cap as a gate: `admit(now)` says whether one more hit cue may sound at `now` (seconds, any clock that only goes
 * forward), and books it when it may. A sliding window, so a steady rain of hits keeps six a tenth and drops the rest.
 */
export class HitCap {
  private readonly times: number[] = [];
  constructor(readonly cap = HIT_CAP, readonly window = HIT_WINDOW) {}
  admit(now: number): boolean {
    while (this.times.length && now - this.times[0] >= this.window) this.times.shift();
    if (this.times.length >= this.cap) return false;
    this.times.push(now);
    return true;
  }
  /** Hit cues sounding inside the window ending at `now`. */
  live(now: number): number { return this.times.filter(t => now - t < this.window).length; }
}
