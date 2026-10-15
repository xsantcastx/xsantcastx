/**
 * companion-host.ts — the play view's side of the pets' roles and Glim being
 * alive (docs/handoff/pets-and-glim-alive.md). A plain class the component
 * owns, so the 3,700-line component only wires it:
 *
 *   - the pet's events from the engine (pet-brain.ts PetEvent): pet XP (booked
 *     a little at a time), the day's finds (PetsService.takeFind), a trinket
 *     into the satchel, a toast, Glim's word;
 *   - Glim's reactions (glim-react.ts): the engine's cues (a dodge, a rare beam,
 *     a drop left lying), a level up (a high five), low health, a new place,
 *     nightfall and dawn, the pet's trick / find / tiredness / level;
 *   - the chat card (tap Glim): what is around, the nearest find (a trail),
 *     tips, margin tales, catch-the-light, the Quiet switch;
 *   - Glim's tap target on the canvas and its powers by the bond.
 *
 * Everything that is saved goes through PetsService / GlimService (the gateway).
 */
import type { SeamworksEngine, EngineState } from './engine/engine';
import type { PetEvent } from './engine/pet-brain';
import type { GlimCue } from './engine/engine.model';
import type { PetsService } from '../shared/pets/pets.service';
import type { GlimService } from '../shared/glim/glim.service';
import type { GlimVoice } from '../shared/glim/glim-voice';
import type { SfxCue } from '../shared/sound/sound-director';
import { dayKey, followingPet, type PetDef } from '../shared/pets/pets.model';
import { PET_ROLES, SECOND_AT, hasSecond, petLevel, type PetXpKind } from '../shared/pets/pet-roles';
import {
  GLIM_REACT_MS, LIGHT_GAME, chatTopics, emptyReactMemory, glimPowers, lightGameKey, lightGameMotes, nextStory, nextTip, react, storyKey,
  type ChatTopic, type GlimMoment, type ReactMemory, type TipContext,
} from '../shared/glim/glim-react';
import type { GlimMood } from '../shared/glim/glim-art';

export interface CompanionDeps {
  engine(): SeamworksEngine | null;
  readonly pets: PetsService;
  readonly glim: GlimService;
  readonly voice: GlimVoice;
  t(key: string, vars?: Record<string, string | number>): string;
  sfx(cue: SfxCue): void;
  toast(text: string): void;
  /** One stack into the satchel, idempotent by grant id. */
  grant(grantId: string, item: string, qty: number): boolean;
  itemName(id: string): string;
  /** A panel, talk, story or map is open: no unasked words. */
  busy(): boolean;
  /** Where the Keeper is, for a tip. */
  tipContext(): TipContext;
  /** The pet changed (level or command): push it to the engine again. */
  repushPet(): void;
}

/** How long a chat answer stays up, and a tale. */
const ANSWER_MS = 7_000;
const STORY_MS = 11_000;
/** Pet XP is written at most this often (a bite every 1.6 s would be a write every 1.6 s). */
const XP_FLUSH_MS = 8_000;

export class CompanionHost {
  /** The chat card. */
  chatOpen = false;
  chatReply = '';
  chatMood: GlimMood = 'calm';
  /** Catch-the-light: the motes (fractions of the stage), caught flags, and when the round ends. */
  game: { motes: { x: number; y: number; caught: boolean }[]; until: number; round: number } | null = null;
  /** Glim's tap target over the canvas (CSS px), or null while it is not shown. */
  tapAt: { x: number; y: number } | null = null;
  private memory: ReactMemory = emptyReactMemory();
  private readonly heardTips: string[] = [];
  private pendingXp: Partial<Record<PetXpKind, number>> = {};
  private xpFlushAt = 0;
  private lastPlace = '';
  private lastNight: boolean | null = null;
  private lowHp = false;
  private gameRounds = 0;
  private powersKey = '';

  constructor(private readonly d: CompanionDeps) {}

  private get petDef(): PetDef | null { return followingPet(this.d.pets.state); }
  private get petName(): string {
    const def = this.petDef;
    return def ? this.d.pets.record(def.id)?.name || this.d.t('play.pet.name.' + def.id) : '';
  }

  // ── The pet's events (engine onPet) ──

  onPet(e: PetEvent): boolean | void {
    const def = this.petDef;
    if (!def) return e.kind === 'find' ? false : undefined;
    switch (e.kind) {
      case 'find': return this.d.pets.takeFind(def.id, e.find);
      case 'hit': this.xp('hit'); if (e.move === 'bite' || e.move === 'chomp' || e.move === 'dash') this.moment('petHit'); return;
      case 'heal': this.xp('heal'); return;
      case 'gather': this.xp('gather'); return;
      case 'warm': this.xp('warm'); return;
      case 'guide': this.xp('guide'); return;
      case 'tired': this.d.toast(this.d.t('play.pet.tired', { name: this.petName })); this.moment('petTired'); return;
      case 'found': {
        this.xp('find');
        if (e.find === 'scout') this.d.toast(this.d.t('play.pet.dugCoins', { name: this.petName, n: e.coins }));
        else this.trinket(def);
        this.moment('petFind');
        return;
      }
    }
  }
  /** A trinket dug up: one of the foods it likes, into the satchel (the day's count is already taken). */
  private trinket(def: PetDef): void {
    const rec = this.d.pets.record(def.id);
    const day = dayKey(new Date());
    const n = rec?.findDay === day ? rec.trinkets : 1;
    const foods = [def.favourite, ...def.likes];
    let h = 0;
    for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const item = foods[(h + n) % foods.length]!;
    if (this.d.grant(`pet-trinket:${def.id}:${day}:${n}`, item, 1)) {
      this.d.toast(this.d.t('play.pet.dugTrinket', { name: this.petName, item: this.d.itemName(item) }));
    }
  }
  private xp(kind: PetXpKind): void {
    this.pendingXp[kind] = (this.pendingXp[kind] ?? 0) + 1;
  }
  /** Book the pending pet XP; a new level is a toast, Glim's word and (at SECOND_AT) its second move. */
  private flushXp(now: number, force = false): void {
    const def = this.petDef;
    if (!def || (!force && now - this.xpFlushAt < XP_FLUSH_MS)) return;
    this.xpFlushAt = now;
    const pending = this.pendingXp;
    this.pendingXp = {};
    let reached = 0;
    for (const [kind, n] of Object.entries(pending) as [PetXpKind, number][]) reached = Math.max(reached, this.d.pets.train(def.id, kind, n));
    if (!reached) return;
    this.d.toast(this.d.t('play.pet.levelUp', { name: this.petName, n: reached }));
    if (reached === SECOND_AT) {
      const second = PET_ROLES[def.id].second;
      this.d.toast(this.d.t('play.pet.secondLearned', { name: this.petName, what: this.d.t('play.pet.second.' + second) }));
    }
    this.d.sfx('levelup');
    this.d.engine()?.petFeel('love');
    this.moment('petLevel', { n: reached });
    this.d.repushPet();
  }
  /** The pet's level and whether its second move is open (for setPet). */
  petLevel(id: string): { level: number; second: boolean } {
    const xp = this.d.pets.record(id)?.xp ?? 0;
    return { level: petLevel(xp), second: hasSecond(xp) };
  }

  // ── Glim's reactions ──

  /** A moment happened: maybe a line, always a face. */
  moment(m: GlimMoment, vars?: Record<string, string | number>): void {
    if (!this.d.voice.met) return;
    const now = Date.now();
    const busy = this.d.busy() || this.chatOpen || (!!this.d.voice.speech && now < this.d.voice.speech.until);
    const r = react(m, this.memory, { now, quiet: this.d.glim.quiet, busy, roll: Math.random() });
    this.memory = r.memory;
    this.d.engine()?.glimMood(r.mood);
    if (r.key && this.d.voice.react(r.key, now, GLIM_REACT_MS, { name: this.petName, ...(vars ?? {}) })) this.d.sfx('glim');
  }
  onGlimCue(cue: GlimCue): void {
    if (cue.kind === 'dodge') this.moment('dodge');
    else if (cue.kind === 'missed') this.moment('missed');
    else this.moment(cue.rarity === 'epic' ? 'rare' : 'legendary');
  }
  /** A level up anywhere: the high five, and a word. */
  levelUp(): void {
    if (!this.d.voice.met) return;
    this.d.engine()?.glimHighFive();
    this.d.sfx('five');
    this.moment('levelUp');
  }
  /** The pet did its trick (the card's Trick button). */
  petTrick(): void { this.moment('petTrick'); }

  /**
   * The HUD tick (5 Hz): low health, a new place, night and dawn, Glim's
   * powers by the bond, its tap target, the light game's clock, pet XP.
   */
  tick(state: EngineState, maxHp: number): void {
    const engine = this.d.engine();
    const now = Date.now();
    this.flushXp(now);
    if (!engine || !this.d.voice.met) { this.tapAt = null; return; }
    const stage = this.d.glim.stage;
    const powers = glimPowers(stage);
    const key = `${powers.lamp}:${powers.missed}`;
    if (key !== this.powersKey) { this.powersKey = key; engine.setGlimPowers(powers); }
    const at = engine.glimScreen();
    this.tapAt = at ? { x: Math.round(at.x), y: Math.round(at.y) } : null;
    // Low health: once each time it dips under a third (it must climb back over half to warn again).
    const share = maxHp > 0 ? state.hp / maxHp : 1;
    if (state.hp > 0 && share < .3 && !this.lowHp) { this.lowHp = true; this.moment('lowHp'); }
    else if (share > .5) this.lowHp = false;
    // A new place (an area or a Delve biome): curious.
    const place = `${state.areaId ?? ''}|${state.biome ?? ''}`;
    if (this.lastPlace && place !== this.lastPlace) this.moment('place');
    this.lastPlace = place;
    // Nightfall and dawn (the world's hour, above ground).
    if (!state.delve) {
      const h = engine.hour, night = h >= 20 || h < 6;
      if (this.lastNight !== null && night !== this.lastNight) this.moment(night ? 'night' : 'dawn');
      this.lastNight = night;
    }
    if (this.game && now >= this.game.until) this.endGame();
  }

  // ── The chat card ──

  get topics(): ChatTopic[] { return chatTopics(this.d.glim.stage); }

  openChat(): void {
    if (!this.d.voice.met) return;
    this.chatOpen = true;
    this.chatMood = 'curious';
    this.chatReply = this.d.t(`glim.chat.hello.${1 + Math.floor(Math.random() * 3)}`);
    this.d.engine()?.glimMood('curious', 2);
    this.d.sfx('chirp');
  }
  closeChat(): void { this.chatOpen = false; }

  ask(topic: ChatTopic): void {
    const engine = this.d.engine();
    if (!this.topics.includes(topic)) return;
    const now = Date.now();
    switch (topic) {
      case 'around':
      case 'find': {
        const find = engine?.glimFind(topic === 'find') ?? null;
        if (!find) { this.say('glim.find.none', 'calm'); return; }
        const what = this.d.t('glim.find.' + find.kind);
        const line = this.d.t(find.dir > 0 ? 'glim.find.east' : 'glim.find.west', { what, n: find.cells });
        this.chatReply = topic === 'find' ? `${line} ${this.d.t('glim.find.follow')}` : line;
        this.chatMood = topic === 'find' ? 'happy' : 'curious';
        engine?.glimMood(this.chatMood);
        // Follow the light: the card steps aside so the trail can be seen.
        if (topic === 'find') { this.chatOpen = false; this.d.voice.answer('glim.find.follow', now, ANSWER_MS); }
        return;
      }
      case 'tips': {
        const key = nextTip(this.d.tipContext(), this.heardTips);
        this.heardTips.push(key);
        this.say(key, 'curious');
        return;
      }
      case 'story': {
        const n = nextStory(this.d.glim.state.said);
        this.d.glim.said(`story.${n}`);
        this.say(storyKey(n), 'happy', STORY_MS);
        return;
      }
      case 'play': this.startGame(); return;
    }
  }
  private say(key: string, mood: GlimMood, ms = ANSWER_MS): void {
    this.chatReply = this.d.t(key);
    this.chatMood = mood;
    this.d.engine()?.glimMood(mood, ms / 1000);
  }
  setQuiet(on: boolean): void {
    this.d.glim.setQuiet(on);
    this.say(on ? 'glim.chat.quietSaid' : 'glim.chat.loudSaid', on ? 'sleepy' : 'happy');
  }

  // ── Catch the light ──

  private startGame(): void {
    this.chatOpen = false;
    const round = ++this.gameRounds + Math.floor(Date.now() / 1000);
    this.game = { motes: lightGameMotes(round).map(m => ({ ...m, caught: false })), until: Date.now() + LIGHT_GAME.ms, round };
    this.d.voice.answer('glim.play.start', Date.now(), 3_000);
    this.d.engine()?.glimMood('happy', 3);
    this.d.sfx('chirp');
  }
  catchMote(i: number): void {
    const g = this.game;
    const mote = g?.motes[i];
    if (!g || !mote || mote.caught) return;
    mote.caught = true;
    this.d.sfx('pickup');
    if (g.motes.every(m => m.caught)) this.endGame();
  }
  private endGame(): void {
    const g = this.game;
    if (!g) return;
    this.game = null;
    const caught = g.motes.filter(m => m.caught).length;
    const key = lightGameKey(caught);
    this.d.voice.answer(key, Date.now(), ANSWER_MS, { n: caught });
    this.d.engine()?.glimMood(caught >= 3 ? 'happy' : 'curious', 3);
    if (caught >= 3) this.d.engine()?.glimHighFive();
    // A round played together is a small shared moment (one a day, five ever: MOMENT_RULES.play).
    if (caught > 0) this.d.glim.addMoments([`play:${dayKey(new Date())}`]);
  }

  /** Before the view goes: book any pet XP still pending. */
  flush(): void { this.flushXp(Date.now(), true); }
}
