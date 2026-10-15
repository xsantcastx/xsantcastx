/**
 * pet-brain.ts — what the pet following the Keeper decides to do, each fixed step
 * (shared/pets/pet-roles.ts; docs/handoff/pets-and-glim-alive.md).
 *
 * The sprite (pet-sprite.ts) is the motion; this is the mind. One small state
 * machine, read in priority order every step:
 *
 *   tired    it took too many blows: it trots behind the Keeper and rests (never dies)
 *   stay     told to stay: it sits where it was told, and only watches
 *   fight    a foe near the Keeper (role + command allow): it closes and uses its move
 *   work     a job beside the Keeper (role + command allow): forage, scout, kindle, guide
 *   dig      now and then it digs up a small trinket (any pet, a daily cap)
 *   play     idle: chases a mote, naps sooner at night, a trick when told to Play
 *   follow   its place a little behind the Keeper
 *
 * The engine hands it a PetWorld (the foes, the nodes, the ore, the bob, and
 * the verbs that change the world: hit, stun, heal, harvest, dig). Every verb
 * goes through the engine's own combat and gathering paths (hurtMonster,
 * onWorldAction, the drop list), never a fork of them. Pure apart from the
 * PetWorld it is handed, so the node test drives it through the real engine.
 */
import { PET_ACT, TRINKET_EVERY, fights, moveDamage, moveRest, nipDamage, scoutCoins, works, type PetCommand, type PetMove, type PetRole, type PetSecond } from '../../shared/pets/pet-roles';

/** A foe as the pet sees it. `ref` is the engine's own object, handed back to its verbs. */
export interface PetFoe { ref: unknown; x: number; floor: number; windup: boolean }
/** A gathering node in reach of the pet. */
export interface PetSite { ref: unknown; x: number }
/** What the pet hands the host (pet XP, finds, Glim's reactions). `find` asks first: false = the day's cap is spent. */
export type PetEvent =
  | { kind: 'hit'; move: PetMove | PetSecond; killed: boolean }
  | { kind: 'heal' }
  | { kind: 'gather' }
  | { kind: 'warm' }
  | { kind: 'guide' }
  | { kind: 'tired' }
  | { kind: 'find'; find: 'scout' | 'trinket' }
  | { kind: 'found'; find: 'scout' | 'trinket'; coins: number };

export interface PetWorld {
  dt: number;
  time: number;
  figure: number;
  reduced: boolean;
  /** Keeper feet (world px), facing, HP. */
  keeperX: number;
  keeperY: number;
  facing: number;
  hp: number;
  maxHp: number;
  /** The area's walkable x range, for a scouted spot. */
  minX: number;
  maxX: number;
  /** Safe ground (no fights there), 0 none. */
  safeX: number;
  night: boolean;
  /** Living foes the pet may touch (the engine filters out guardians it cannot hurt). */
  foes: readonly PetFoe[];
  /** Ready gathering nodes the Keeper could work right now (tool + level), or none. */
  sites: readonly PetSite[];
  /** The fishing bob (world px), or null with no line out. */
  bob: { x: number; y: number } | null;
  /** In the Delve: the nearest ore vein within `cells` of world x/y, or null. */
  vein(x: number, y: number, cells: number, skip: ReadonlySet<number>): { index: number; x: number; y: number } | null;
  /** The verbs. Each returns whether it happened. */
  hit(foe: unknown, damage: number): { landed: boolean; killed: boolean };
  stun(foe: unknown, seconds: number): void;
  crack(foe: unknown, share: number, seconds: number): void;
  /** The foe's next wind-up is meant for the pet. */
  draw(foe: unknown): void;
  heal(amount: number): void;
  harvest(site: unknown): boolean;
  warm(index: number, seconds: number): void;
  /** Spill a find (coins) at world x on the Keeper's floor. */
  spill(x: number, coins: number): void;
  event(e: PetEvent): boolean | void;
}

export type PetPose = 'none' | 'attack' | 'dig' | 'tired' | 'sit' | 'guide' | 'heal' | 'chase' | 'love';

export interface PetSetup { role: PetRole; move: PetMove; second: PetSecond | null; level: number; command: PetCommand }

export class PetBrain {
  role: PetRole = 'combat';
  move: PetMove = 'bite';
  second: PetSecond | null = null;
  level = 1;
  command: PetCommand = 'follow';
  /** What the sprite shows now, and where it is going (null = its place). */
  pose: PetPose = 'none';
  goalX: number | null = null;
  /** A height to hover at (the moth over the bob), or null for the Keeper's floor. */
  goalY: number | null = null;
  /** The x of a lunge or a dash (presentation). */
  lunge = 0;
  stamina: number = PET_ACT.stamina;
  /** Seconds left resting while tired. */
  tired = 0;
  /** Where it was told to stay (world x), or NaN. */
  stayX = NaN;
  /** Its scouted spot (world x), waiting for the Keeper, or NaN. */
  spotX = NaN;
  /** Ore cells it has warmed: index → seconds left. */
  readonly warmCells = new Map<number, number>();
  /** The mote it chases while idle (world px), with seconds left, or null. */
  mote: { x: number; y: number; t: number } | null = null;
  /** Counters for the e2e and the node test (data-pet-*). */
  hits = 0;
  gathers = 0;
  finds = 0;
  heals = 0;
  private rest = 0;
  private secondRest = 0;
  private workRest = 2;
  private scoutRest = 6;
  private trinketClock = 0;
  private poseFor = 0;
  private digFor = 0;
  private digKind: 'scout' | 'trinket' | null = null;
  private moteRest = 6;
  private blowsLanded = 0;
  private guardRest = 0;
  private stillFor = 0;
  private lastKeeperX = NaN;

  setup(s: PetSetup): void {
    if (s.command !== this.command && s.command !== 'stay') this.stayX = NaN;
    this.role = s.role; this.move = s.move; this.second = s.second; this.level = s.level; this.command = s.command;
  }
  /** A new pet, or a new place: forget the fight, the spot and the stay point. */
  reset(): void {
    this.pose = 'none'; this.goalX = null; this.goalY = null; this.tired = 0; this.stamina = PET_ACT.stamina;
    this.stayX = NaN; this.spotX = NaN; this.warmCells.clear(); this.mote = null; this.digFor = 0; this.digKind = null;
  }

  get fighting(): boolean { return this.pose === 'attack'; }
  /** What it is doing, in one word (the HUD's data-pet-act). */
  get act(): string {
    if (this.tired > 0) return 'tired';
    if (this.command === 'stay') return 'stay';
    if (this.digFor > 0) return 'dig';
    if (this.pose === 'attack') return 'fight';
    if (this.pose === 'guide') return 'guide';
    if (Number.isFinite(this.spotX)) return 'scout';
    if (this.goalX !== null) return 'work';
    if (this.mote) return 'play';
    return 'follow';
  }

  /**
   * A blow meant for the pet landed (a foe drawn to it, or a blow it guarded).
   * Pets never die: below `tiredAt` it is tired and rests, then comes back full.
   */
  blow(world: Pick<PetWorld, 'event'>): void {
    this.stamina = Math.max(0, this.stamina - PET_ACT.blowCost);
    if (this.stamina < PET_ACT.tiredAt && this.tired <= 0) {
      this.tired = PET_ACT.restFor; this.pose = 'tired'; this.goalX = null;
      world.event({ kind: 'tired' });
    }
  }
  /** guard (the Rivet hatchling's second): it takes the blow instead, if it is near and rested. */
  guard(world: Pick<PetWorld, 'event'>, petX: number, foeX: number, figure: number): boolean {
    if (this.second !== 'guard' || this.tired > 0 || this.guardRest > 0 || this.command === 'stay' || this.command === 'play') return false;
    if (Math.abs(petX - foeX) > 200 * figure) return false;
    this.guardRest = PET_ACT.guardRest;
    this.pose = 'attack'; this.poseFor = .4;
    this.blow(world);
    return true;
  }

  step(w: PetWorld, petX: number): void {
    const dt = w.dt, k = w.figure;
    this.rest = Math.max(0, this.rest - dt);
    this.secondRest = Math.max(0, this.secondRest - dt);
    this.guardRest = Math.max(0, this.guardRest - dt);
    this.workRest = Math.max(0, this.workRest - dt);
    this.scoutRest = Math.max(0, this.scoutRest - dt);
    this.poseFor = Math.max(0, this.poseFor - dt);
    this.lunge *= Math.exp(-10 * dt);
    for (const [i, s] of this.warmCells) { if (s - dt <= 0) this.warmCells.delete(i); else this.warmCells.set(i, s - dt); }
    const moved = Number.isFinite(this.lastKeeperX) && Math.abs(w.keeperX - this.lastKeeperX) > .5;
    this.lastKeeperX = w.keeperX;
    this.stillFor = moved ? 0 : this.stillFor + dt;
    this.goalY = null;

    // Tired: behind the Keeper, resting. Stamina comes back when the rest is over.
    if (this.tired > 0) {
      this.tired = Math.max(0, this.tired - dt);
      this.pose = this.tired > 0 ? 'tired' : 'none';
      this.goalX = w.keeperX - w.facing * 130 * k;
      if (this.tired <= 0) { this.stamina = PET_ACT.stamina; this.goalX = null; }
      return;
    }
    if (this.command === 'stay') {
      if (!Number.isFinite(this.stayX) || Math.abs(this.stayX - w.keeperX) > 2400) this.stayX = Number.isFinite(petX) ? petX : w.keeperX;
      this.goalX = this.stayX; this.pose = 'sit'; this.spotX = NaN; this.mote = null;
      return;
    }
    // A dig under way (a scouted spot or a trinket) finishes before anything else.
    if (this.digFor > 0) {
      this.digFor -= dt; this.pose = 'dig';
      if (this.digFor <= 0) this.finishDig(w, petX);
      return;
    }
    if (this.fight(w, petX)) return;
    if (this.work(w, petX)) return;
    // Now and then any pet digs up a small trinket (the host caps it per day).
    if (this.command !== 'play') {
      this.trinketClock += dt;
      if (this.trinketClock >= TRINKET_EVERY && this.stillFor > 1.5) {
        this.trinketClock = 0;
        if (w.event({ kind: 'find', find: 'trinket' }) !== false) { this.digFor = 1.1; this.digKind = 'trinket'; this.pose = 'dig'; this.goalX = petX; return; }
      }
    }
    this.idle(w, petX);
  }

  /** Close on a foe near the Keeper and use its move. True while it is in a fight. */
  private fight(w: PetWorld, petX: number): boolean {
    if (!fights(this.role, this.command) || !w.foes.length) { if (this.pose === 'attack' && this.poseFor <= 0) this.pose = 'none'; return false; }
    const k = w.figure;
    const range = (this.command === 'fight' ? PET_ACT.engageFight : PET_ACT.engage) * k;
    if (w.safeX && w.keeperX < w.safeX) return false;
    // The Sunling: its pulse is for the Keeper, not the foe.
    if (this.move === 'pulse') return this.pulse(w, petX, range);
    let foe: PetFoe | null = null, best = range;
    for (const f of w.foes) {
      const d = Math.abs(f.x - w.keeperX);
      if (d < best && Math.abs(f.floor - w.keeperY) < 140) { foe = f; best = d; }
    }
    if (!foe) return false;
    const side = Math.sign(petX - foe.x) || -w.facing;
    this.goalX = foe.x + side * PET_ACT.reach * .7 * k;
    this.pose = 'attack';
    const close = Math.abs(petX - foe.x) <= (PET_ACT.reach + 30) * k;
    // Second moves first when they are ready (howl, flare): every foe near is stunned.
    if (this.second === 'howl' && this.secondRest <= 0 && close) {
      this.secondRest = PET_ACT.howlRest;
      for (const f of w.foes) if (Math.abs(f.x - petX) < PET_ACT.howlRange * k) w.stun(f.ref, PET_ACT.howlStun);
      w.event({ kind: 'hit', move: 'howl', killed: false });
      this.poseFor = .5;
      return true;
    }
    if (!close || this.rest > 0) return true;
    // A skilling pet told to Fight only nips (a small bite, no stun).
    const nip = this.role !== 'combat';
    this.rest = nip ? PET_ACT.biteRest : moveRest(this.move);
    const damage = nip ? nipDamage(this.level) : moveDamage(this.move, this.level);
    if (this.move === 'dash' && !nip) {
      // Through every foe on its line, out the far side.
      const dir = Math.sign(foe.x - petX) || w.facing;
      const from = petX, to = petX + dir * PET_ACT.dashSpan * k;
      let killed = false, landed = false;
      for (const f of w.foes) {
        if ((f.x - from) * dir < -10 || (f.x - to) * dir > 10) continue;
        const r = w.hit(f.ref, damage);
        landed ||= r.landed; killed ||= r.killed;
        if (r.landed && this.second === 'pounce') w.stun(f.ref, PET_ACT.stun);
      }
      this.lunge = dir * PET_ACT.dashSpan * k;
      this.goalX = to;
      if (landed) this.landed(w, foe, killed);
    } else {
      const r = w.hit(foe.ref, damage);
      this.lunge = Math.sign(foe.x - petX) * 26 * k;
      if (r.landed) {
        if (this.move === 'bite') w.stun(foe.ref, PET_ACT.stun);
        if (this.move === 'chomp') w.crack(foe.ref, PET_ACT.crack, PET_ACT.crackFor);
        this.landed(w, foe, r.killed);
      }
    }
    this.poseFor = .35;
    return true;
  }
  private landed(w: PetWorld, foe: PetFoe, killed: boolean): void {
    this.hits++;
    w.event({ kind: 'hit', move: this.move, killed });
    // Sometimes the foe turns on the pet instead (it takes aggro).
    if (!killed && ++this.blowsLanded % PET_ACT.aggroEvery === 0) w.draw(foe.ref);
  }
  /** The Sunling: a pulse of light that closes the Keeper's wounds, even mid-fight; its flare stuns. */
  private pulse(w: PetWorld, petX: number, range: number): boolean {
    const near = w.foes.filter(f => Math.abs(f.x - w.keeperX) < range);
    if (!near.length && w.hp >= w.maxHp * PET_ACT.pulseBelow) return false;
    this.goalX = null;
    if (this.second === 'flare' && this.secondRest <= 0 && near.length) {
      this.secondRest = PET_ACT.flareRest;
      for (const f of w.foes) if (Math.abs(f.x - petX) < PET_ACT.flareRange * w.figure) w.stun(f.ref, PET_ACT.flareStun);
      w.event({ kind: 'hit', move: 'flare', killed: false });
      this.pose = 'heal'; this.poseFor = .7;
      return true;
    }
    if (this.rest <= 0 && w.hp > 0 && w.hp < w.maxHp * PET_ACT.pulseBelow) {
      this.rest = PET_ACT.pulseRest;
      w.heal(w.maxHp * PET_ACT.pulseShare);
      this.heals++;
      w.event({ kind: 'heal' });
      this.pose = 'heal'; this.poseFor = .8;
      return true;
    }
    if (this.poseFor <= 0) this.pose = 'none';
    return near.length > 0;
  }

  /** Its job beside the Keeper. True while it is busy at it. */
  private work(w: PetWorld, petX: number): boolean {
    if (!works(this.role, this.command)) { this.spotX = NaN; return false; }
    const k = w.figure;
    switch (this.move) {
      case 'forage': {
        if (this.workRest > 0 || !w.sites.length) return false;
        let site: PetSite | null = null, best = PET_ACT.forageReach * k;
        for (const s of w.sites) { const d = Math.abs(s.x - w.keeperX); if (d < best) { site = s; best = d; } }
        if (!site) return false;
        this.goalX = site.x; this.pose = 'dig';
        if (Math.abs(petX - site.x) > 30 * k) return true;
        // At the node: it works it (the engine books it like the Keeper's own harvest, minus the XP).
        if (w.harvest(site.ref)) { this.gathers++; w.event({ kind: 'gather' }); }
        // sniff: a second forage comes sooner.
        this.workRest = this.second === 'sniff' && this.gathers % 2 === 1 ? 4 : PET_ACT.forageRest;
        this.pose = 'none'; this.goalX = null;
        return false;
      }
      case 'scout': {
        if (!Number.isFinite(this.spotX)) {
          if (this.scoutRest > 0 || this.stillFor > 20) return false;
          if (w.event({ kind: 'find', find: 'scout' }) === false) { this.scoutRest = PET_ACT.scoutRest; return false; }
          // A spot a little ahead of the Keeper, inside the area.
          const span = PET_ACT.scoutNear + ((this.finds * 97) % (PET_ACT.scoutFar - PET_ACT.scoutNear));
          let x = w.keeperX + w.facing * span * k;
          if (x < w.minX + 40 || x > w.maxX - 40) x = w.keeperX - w.facing * span * k;
          this.spotX = Math.max(w.minX + 40, Math.min(w.maxX - 40, x));
          this.scoutRest = PET_ACT.scoutRest;
        }
        this.goalX = this.spotX; this.pose = 'none';
        // The Keeper came: it digs the spot up.
        if (Math.abs(w.keeperX - this.spotX) < PET_ACT.scoutDig * k && Math.abs(petX - this.spotX) < 40 * k) {
          this.digFor = .9; this.digKind = 'scout'; this.pose = 'dig';
        }
        return true;
      }
      case 'kindle': {
        if (this.workRest > 0) return false;
        const skip = new Set(this.warmCells.keys());
        const n = this.second === 'forgeheat' ? 2 : 1;
        let warmed = 0;
        for (let i = 0; i < n; i++) {
          const vein = w.vein(w.keeperX, w.keeperY, PET_ACT.kindleCells, skip);
          if (!vein) break;
          skip.add(vein.index);
          w.warm(vein.index, PET_ACT.kindleRest + 6);
          this.warmCells.set(vein.index, PET_ACT.kindleRest + 6);
          if (!warmed) this.goalX = vein.x;
          warmed++;
        }
        this.workRest = PET_ACT.kindleRest;
        if (warmed) { w.event({ kind: 'warm' }); this.pose = 'love'; this.poseFor = .6; }
        return false;
      }
      case 'guide': {
        if (!w.bob) { if (this.pose === 'guide') this.pose = 'none'; return false; }
        if (this.pose !== 'guide') w.event({ kind: 'guide' });
        this.goalX = w.bob.x; this.goalY = w.bob.y - 26 * k; this.pose = 'guide';
        return true;
      }
      default: return false;
    }
  }

  private finishDig(w: PetWorld, petX: number): void {
    const kind = this.digKind;
    this.digKind = null; this.digFor = 0; this.pose = 'love'; this.poseFor = .9;
    if (kind === 'scout') {
      const coins = scoutCoins(this.level, this.second === 'farsight');
      w.spill(Number.isFinite(this.spotX) ? this.spotX : petX, coins);
      this.spotX = NaN; this.finds++;
      w.event({ kind: 'found', find: 'scout', coins });
    } else if (kind === 'trinket') {
      this.finds++;
      w.event({ kind: 'found', find: 'trinket', coins: 0 });
    }
    this.goalX = null;
  }

  /** Nothing to fight or do: it plays. A mote to chase when the Keeper stands about; under Play, always. */
  private idle(w: PetWorld, petX: number): void {
    if (this.poseFor <= 0 && this.pose !== 'love') this.pose = 'none';
    if (this.poseFor <= 0 && this.pose === 'love') this.pose = 'none';
    this.goalX = null;
    if (w.reduced) { this.mote = null; return; }
    const playing = this.command === 'play';
    this.moteRest = Math.max(0, this.moteRest - w.dt);
    if (!this.mote && this.moteRest <= 0 && (playing || (this.stillFor > 4 && this.stillFor < 12 && !w.night))) {
      this.mote = { x: 0, y: 0, t: playing ? 9 : 5 };
    }
    const m = this.mote;
    if (!m) return;
    m.t -= w.dt;
    // The mote loops lazily around the Keeper; the pet trots after it.
    const a = w.time * 1.3;
    m.x = w.keeperX + Math.sin(a) * 120 * w.figure + Math.sin(a * 2.7) * 30 * w.figure;
    m.y = w.keeperY - 40 * w.figure - Math.abs(Math.sin(a * 1.9)) * 34 * w.figure;
    this.goalX = m.x; this.pose = 'chase';
    if (m.t <= 0) { this.mote = null; this.moteRest = playing ? 1.5 : 22; this.pose = 'none'; this.goalX = null; }
    void petX;
  }
}
