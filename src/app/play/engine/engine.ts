import { Atmosphere } from './atmosphere';
import { advanceBody, Body, EngineInput, EngineOptions, EngineState, FLOOR, InteractionTarget, KeeperAnimation, meleeHits, PLATFORMS, WORLD_WIDTH } from './engine.model';
export type { EngineInput, EngineOptions, EngineState, InteractionTarget, KeeperAnimation } from './engine.model';

interface Monster { x: number; spawn: number; hp: number; phase: 'idle' | 'windup' | 'strike' | 'recover'; timer: number; facing: number; respawn: number }
interface Drop { id: string; x: number; coins: number; ore: number; age: number }
const KEEPER_ANIMATIONS = new Set<KeeperAnimation>(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
export interface RemoteKeeper { id: string; name: string; x: number; y: number; area: string; facing?: number; animation?: string }
interface PeerView { peer: RemoteKeeper; x: number; y: number; facing: number }
interface Speech { text: string; at: number }
/** Fixed-step farming runtime with reversible camp and hunting-ground portals. */
export class SeamworksEngine {
  private readonly context: CanvasRenderingContext2D;
  private readonly images: Record<string, HTMLImageElement> = {};
  private readonly input = new Set<EngineInput>();
  private readonly peers = new Map<string, PeerView>();
  private speech = new Map<string, Speech>();
  private selfId = '';
  private readonly player: Body = { x: 160, y: FLOOR, vy: 0, grounded: true };
  private frame: number | null = null;
  private observer: ResizeObserver;
  private previous = 0;
  private accumulator = 0;
  private elapsed = 0;
  private readonly atmosphere = new Atmosphere();
  private readonly reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private landing = 0;
  private stepAt = 0;
  private reportAt = 0;
  private width = 1100;
  private height = 650;
  private camera = 0;
  private facing = 1;
  private hp = 100;
  private monsters: Monster[] = this.createMonsters();
  private drops: Drop[] = [];
  private readonly lootSession = crypto.randomUUID();
  private coins = 0;
  private kills = 0;
  private area: 'camp' | 'quarry' = 'camp';
  private guardianDefeated = false;
  private attackTime = 0;
  private attackCooldown = 0;
  private dodgeTime = 0;
  private dodgeCooldown = 0;
  private hurtTime = 0;
  private equipped = false;
  private restored = false;
  private paused = false;
  private complete = false;
  private destroyed = false;
  private message = 'Find the Cinder Ore deposit. Walk close and interact.';
  private readonly campStations: { target: InteractionTarget; x: number; label: string }[] = [
    { target: 'ore', x: 480, label: 'CINDER ORE' }, { target: 'forge', x: 930, label: 'SEAMWORKS FORGE' },
    { target: 'beacon', x: 2320, label: 'ECLIPSE BEACON' }, { target: 'passage', x: 2580, label: 'EAST PASSAGE' },
  ];
  private get stations(): { target: InteractionTarget; x: number; label: string }[] {
    return this.area === 'camp' ? this.campStations : [
      { target: 'passage', x: 110, label: 'RETURN TO SEAMWORKS' },
      { target: 'ore', x: 520, label: 'CINDER ORE' },
    ];
  }
  private createMonsters(): Monster[] {
    return [1350, 1670, 1990].map((x) => ({ x, spawn: x, hp: 60, phase: 'idle', timer: 1, facing: -1, respawn: 0 }));
  }
  private resetPosition(x: number): void {
    this.player.x = x; this.player.y = FLOOR; this.player.vy = 0; this.player.grounded = true;
    this.hp = 100; this.hurtTime = 1.5; this.attackTime = 0; this.attackCooldown = 0;
    this.dodgeTime = 0; this.dodgeCooldown = 0; this.complete = false; this.setPaused(false);
  }
  returnToCamp(): void {
    this.area = 'camp'; this.monsters = this.createMonsters(); this.drops = [];
    this.resetPosition(160); this.message = 'Back at camp. Your equipment and collected loot are safe.'; this.report();
  }
  restartHunt(): void {
    this.monsters = this.createMonsters(); this.drops = []; this.resetPosition(this.area === 'camp' ? 160 : 240);
    this.message = 'A fresh hunt begins. Monsters respawn after defeat; collect their drops.'; this.report();
  }
  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support Canvas 2D.');
    this.context = context;
    for (const [key, url] of Object.entries(options.assets)) {
      const image = new Image(); image.src = url; this.images[key] = image;
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.resize();
  }
  start(): void {
    if (this.frame === null && !this.destroyed) {
      // The component can start during Angular's view pass, before the first
      // ResizeObserver delivery. Read the laid-out canvas here so the first
      // frame is drawn at the viewport size instead of the 300×150 fallback.
      this.resize();
      this.previous = 0;
      this.frame = requestAnimationFrame(this.tick);
      this.report();
      this.render();
    }
  }
  destroy(): void {
    this.destroyed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null; this.observer.disconnect(); this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
  }
  setProgress(progress: { equipped: boolean; restored: boolean }): void {
    this.equipped = progress.equipped; this.restored = progress.restored;
    if (this.restored) this.guardianDefeated = true;
    this.report();
  }
  setPeers(peers: RemoteKeeper[]): void {
    const present = new Set<string>();
    for (const peer of peers) {
      if (!Number.isFinite(peer.x) || !Number.isFinite(peer.y)) continue;
      present.add(peer.id);
      const previous = this.peers.get(peer.id);
      const facing = peer.facing === -1 ? -1 : 1;
      const snapshot = {
        ...peer, facing, animation: KEEPER_ANIMATIONS.has(peer.animation as KeeperAnimation) ? peer.animation : 'idle',
        name: peer.name.slice(0, 24), x: Math.max(30, Math.min(WORLD_WIDTH - 30, peer.x)), y: Math.max(-300, Math.min(FLOOR, peer.y)),
      };
      if (previous && previous.peer.area === peer.area) previous.peer = snapshot;
      else this.peers.set(peer.id, { peer: snapshot, x: snapshot.x, y: snapshot.y, facing });
    }
    for (const id of this.peers.keys()) if (!present.has(id)) this.peers.delete(id);
  }
  setChat(messages: { playerId: string; text: string; at: number }[], selfId = ''): void {
    this.selfId = selfId;
    const next = new Map<string, Speech>();
    for (const message of messages) {
      if (!message?.playerId || typeof message.text !== 'string' || !Number.isFinite(message.at)) continue;
      const text = message.text.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!text) continue;
      const current = next.get(message.playerId);
      if (!current || message.at >= current.at) next.set(message.playerId, { text, at: message.at });
    }
    this.speech = next;
  }
  setPaused(paused: boolean): void { this.paused = paused; this.input.clear(); this.accumulator = 0; this.report(); }
  retry(): void { this.restartHunt(); }
  setInput(action: EngineInput, pressed: boolean): void {
    if (!pressed) { this.input.delete(action); return; }
    if (this.paused || this.hp <= 0 || this.input.has(action)) return;
    this.input.add(action);
    if (action === 'jump' && this.player.grounded) { this.player.vy = -680; this.player.grounded = false; }
    if (action === 'attack' && this.attackCooldown <= 0) {
      {
        this.attackTime = .4; this.attackCooldown = .52;
        for (const monster of this.monsters) {
          if (monster.hp <= 0 || !meleeHits(this.player, monster.x, this.facing)) continue;
          this.atmosphere.burst(monster.x, FLOOR - 85, String(this.equipped ? 20 : 10));
          monster.hp = Math.max(0, monster.hp - (this.equipped ? 20 : 10));
          if (monster.hp === 0) {
            monster.respawn = 8; this.kills++; this.guardianDefeated = true;
            this.drops.push({ id: `${this.lootSession}:${this.kills}:coins`, x: monster.x - 25, coins: 8 + this.kills % 5, ore: 0, age: 0 });
            this.drops.push({ id: `${this.lootSession}:${this.kills}:ore`, x: monster.x + 25, coins: 0, ore: 1, age: 0 });
            this.message = 'Rivet Maw defeated! Walk over the coins and Cinder Ore to collect them.';
          }
        }
      }
    }
    if (action === 'dodge' && this.dodgeCooldown <= 0) { this.dodgeTime = .26; this.dodgeCooldown = 1.05; }
    this.report();
  }
  interact(): void {
    if (this.paused || this.hp <= 0) return;
    const target = this.nearby();
    if (!target) { this.message = 'Move closer to a marked location to interact.'; this.report(); return; }
    if (target === 'beacon' && !this.guardianDefeated) this.message = 'Defeat a Rivet Maw before repairing the beacon.';
    else if (target === 'passage' && this.area === 'camp' && !this.restored) this.message = 'Restore the beacon to open the eastern passage.';
    else if (target === 'passage') {
      this.area = this.area === 'camp' ? 'quarry' : 'camp';
      this.monsters = this.createMonsters(); this.drops = [];
      this.resetPosition(this.area === 'quarry' ? 240 : 2460);
      this.message = this.area === 'quarry' ? 'Ember Quarry. Hunt the Maws for coins and ore. The return portal is behind you.' : 'Returned to Seamworks. Explore freely or head out for another hunt.';
    } else this.options.onInteract(target);
    this.report();
  }
  private nearby(): InteractionTarget | null {
    return this.stations.find(station => Math.abs(station.x - this.player.x) < 110 && this.player.y > 475)?.target ?? null;
  }
  private action(key: string): EngineInput | undefined {
    return ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'attack', KeyK: 'dodge' } as Record<string, EngineInput>)[key];
  }
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
    const action = this.action(event.code);
    if (action) { event.preventDefault(); if (!event.repeat) this.setInput(action, true); }
    if (!event.repeat && event.code === 'KeyE') { event.preventDefault(); this.interact(); }
  };
  private readonly keyUp = (event: KeyboardEvent): void => { const action = this.action(event.code); if (action) this.setInput(action, false); };
  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const parent = this.canvas.parentElement?.getBoundingClientRect();
    const cssWidth = this.canvas.parentElement?.clientWidth || parent?.width || bounds.width;
    const cssHeight = this.canvas.parentElement?.clientHeight || parent?.height || bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, cssWidth || this.canvas.clientWidth || 320); this.height = Math.max(300, cssHeight || this.canvas.clientHeight || 300);
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    const delta = this.previous ? Math.min((now - this.previous) / 1000, .1) : 0;
    this.previous = now;
    // Presence continues to arrive while the local game is paused or unfocused.
    for (const view of this.peers.values()) {
      const dx = view.peer.x - view.x;
      if (Math.abs(dx) > 2) view.facing = Math.sign(dx);
      else if (view.peer.facing === -1 || view.peer.facing === 1) view.facing = view.peer.facing;
      const blend = 1 - Math.exp(-12 * delta);
      view.x += dx * blend; view.y += (view.peer.y - view.y) * blend;
    }
    if (!this.paused && this.hp > 0) {
      this.accumulator += delta;
      while (this.accumulator >= 1 / 60) { this.update(1 / 60); this.accumulator -= 1 / 60; }
    }
    this.render();
    if (now - this.reportAt >= 100) { this.reportAt = now; this.report(); }
    this.frame = requestAnimationFrame(this.tick);
  };
  private update(dt: number): void {
    this.elapsed += dt;
    this.atmosphere.update(dt);
    this.landing = Math.max(0, this.landing - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.attackCooldown -= dt;
    this.dodgeTime = Math.max(0, this.dodgeTime - dt); this.dodgeCooldown -= dt; this.hurtTime -= dt;
    const direction = Number(this.input.has('right')) - Number(this.input.has('left'));
    if (direction) this.facing = direction;
    const wasGrounded = this.player.grounded;
    advanceBody(this.player, this.dodgeTime > 0 ? this.facing * 620 : direction * 265, dt);
    if (!wasGrounded && this.player.grounded) { this.landing = .18; this.atmosphere.burst(this.player.x, this.player.y - 4); }
    if (direction && this.player.grounded && this.elapsed - this.stepAt > .2) {
      this.stepAt = this.elapsed; if (!this.reducedMotion) this.atmosphere.burst(this.player.x - direction * 16, this.player.y - 3);
    }
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age > .3 && Math.abs(drop.x - this.player.x) < 65 && Math.abs(this.player.y - FLOOR) < 80) {
        if (this.options.onLoot?.({ id: drop.id, coins: drop.coins, ore: drop.ore }) === false) continue;
        this.atmosphere.burst(drop.x, FLOOR - 45, drop.coins ? `+${drop.coins} coins` : '+1 ore');
        this.coins += drop.coins; drop.age = -1;
        this.message = drop.coins ? `Collected ${drop.coins} coins.` : 'Collected Cinder Ore.';
      }
    }
    this.drops = this.drops.filter(drop => drop.age >= 0 && drop.age < 120);
    for (const monster of this.monsters) {
      if (monster.hp <= 0) {
        monster.respawn -= dt;
        if (monster.respawn <= 0) { monster.hp = 60; monster.x = monster.spawn; monster.phase = 'idle'; monster.timer = 1; }
        continue;
      }
      monster.timer -= dt;
      if (this.area === 'camp' && this.player.x < 1100) {
        monster.x += Math.sign(monster.spawn - monster.x) * Math.min(Math.abs(monster.spawn - monster.x), 65 * dt);
        monster.phase = 'idle'; monster.timer = .5;
        continue;
      }
      const distance = this.player.x - monster.x;
      if (monster.phase === 'idle') {
        if (Math.abs(distance) < 380 && Math.abs(distance) > 95) monster.x = Math.max(this.area === 'camp' ? 1100 : 30, monster.x + Math.sign(distance) * 65 * dt);
        if (Math.abs(distance) < 170 && monster.timer <= 0) {
          monster.phase = 'windup'; monster.timer = .85; monster.facing = Math.sign(distance) || -1;
        }
      } else if (monster.timer <= 0) {
        if (monster.phase === 'windup') {
          monster.phase = 'strike'; monster.timer = .2;
          if (Math.abs(distance) < 170 && distance * monster.facing > -40 && this.player.y > FLOOR - 105 && this.dodgeTime <= 0 && this.hurtTime <= 0) {
            this.hp = Math.max(0, this.hp - 12); this.hurtTime = .8;
            if (this.hp === 0) this.message = 'The Keeper falls. Restart the hunt or return to camp.';
          }
        } else if (monster.phase === 'strike') { monster.phase = 'recover'; monster.timer = 1.1; }
        else { monster.phase = 'idle'; monster.timer = .35; }
      }
    }
  }

  private report(): void {
    const living = this.monsters.filter(monster => monster.hp > 0);
    const nearest = living.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x))[0];
    this.options.onState({ hp: this.hp, enemyHp: nearest ? Math.round(nearest.hp / 60 * 100) : 0, nearby: this.nearby(), x: Math.round(this.player.x), y: Math.round(this.player.y), paused: this.paused,
      defeated: this.hp <= 0, enemyDefeated: this.guardianDefeated, complete: false, message: this.message,
      coins: this.coins, kills: this.kills, area: this.area === 'camp' ? 'Basalt Seamworks' : 'Ember Quarry',
      facing: this.facing, animation: this.pose() });
  }
  private pose(): KeeperAnimation {
    if (this.hp <= 0 || this.hurtTime > 0) return 'hurt';
    if (this.dodgeTime > 0) return 'dodge';
    if (this.attackTime > 0) return 'attack';
    if (!this.player.grounded) return this.player.vy < 0 ? 'jump' : 'fall';
    if (this.input.has('left') || this.input.has('right')) return 'run';
    return 'idle';
  }
  /** Idle Keepers standing at the fire settle. The room still reports them as idle. */
  private present(animation: string | undefined, x: number, y: number): string | undefined {
    return animation === 'idle' && this.area === 'camp' && x > 70 && x < 430 && y > 560 ? 'rest' : animation;
  }
  private keeperMotion(animation: string | undefined, time: number): { bob: number; tilt: number; sx: number; sy: number; alpha: number; sway: number } {
    if (this.reducedMotion) return { bob: 0, tilt: 0, sx: 1, sy: 1, alpha: animation === 'dodge' ? .5 : 1, sway: 0 };
    switch (animation) {
      case 'run': {
        const phase = time * 9;
        const lift = Math.sin(phase);
        return {
          bob: lift > 0 ? -lift * 10 : lift * 1.6,
          tilt: Math.cos(phase) * .06,
          sx: 1 + Math.max(0, -lift) * .07,
          sy: 1 - Math.max(0, -lift) * .09,
          alpha: 1,
          sway: Math.cos(phase) * 5,
        };
      }
      case 'jump': return { bob: -4, tilt: -.1, sx: .94, sy: 1.08, alpha: 1, sway: 0 };
      case 'fall': return { bob: 2, tilt: .08, sx: 1.06, sy: .92, alpha: 1, sway: 0 };
      case 'attack': return { bob: 0, tilt: 0, sx: 1, sy: 1, alpha: 1, sway: 0 };
      case 'dodge': return { bob: 2, tilt: .28, sx: 1.08, sy: .9, alpha: .5, sway: 6 };
      case 'hurt': return { bob: 1, tilt: -.1, sx: 1.08, sy: .92, alpha: .55, sway: -3 };
      case 'rest': {
        const rock = Math.sin(time * 1.1);
        return { bob: rock * .6, tilt: rock * .015, sx: 1.02, sy: .985, alpha: 1, sway: rock * 1.1 };
      }
      default: {
        const breath = Math.sin(time * 2.2);
        return { bob: 0, tilt: Math.sin(time * 1.3) * .012, sx: 1 + breath * .012, sy: 1 - breath * .018, alpha: 1, sway: 0 };
      }
    }
  }
  /** One illustration. Pose it as a whole figure — a waist cut tears the armor. */
  private posedKeeper(
    c: CanvasRenderingContext2D,
    boxX: number, boxY: number, boxW: number, boxH: number,
    animation: string | undefined, _time: number,
    motion: { bob: number; tilt: number; sx: number; sy: number; sway: number },
    attackT: number, swing: number, armed: boolean,
  ): void {
    c.save();
    c.translate(motion.sway + (attackT > 0 ? swing * 8 : 0), 0);
    if (animation === 'dodge') c.transform(1, 0, .28, 1, 0, 0);
    c.rotate(motion.tilt + (attackT > 0 ? swing * .08 : 0));
    c.scale(motion.sx, motion.sy);
    if (!this.art('keeper', boxX, boxY + motion.bob, boxW, boxH)) { c.fillStyle = '#c9addf'; c.fillRect(-22, -110, 44, 110); }
    if (armed) this.drawBlade(c, swing, attackT);
    c.restore();
  }
  private drawBlade(c: CanvasRenderingContext2D, swing: number, attackT: number): void {
    c.save();
    c.translate(22 + Math.max(0, swing) * 16, -96);
    c.rotate(-.95 + swing * 1.85);
    if (attackT > .3) c.scale(1.06, 1.06);
    this.art('blade', -8, -78, 58, 92);
    c.restore();
  }
  private stepDust(c: CanvasRenderingContext2D, animation: string | undefined, time: number): void {
    if (this.reducedMotion || animation !== 'run') return;
    const step = Math.sin(time * 9);
    c.save();
    c.fillStyle = '#1a1216'; c.globalAlpha = .35;
    c.beginPath(); c.ellipse(step * 9, 3, 16 + Math.abs(step) * 4, 4, 0, 0, Math.PI * 2); c.fill();
    if (Math.abs(step) >= .72) {
      c.globalAlpha = (Math.abs(step) - .72) / .28 * .4; c.fillStyle = '#cbb09a';
      c.beginPath(); c.ellipse(step > 0 ? -14 : 12, -1, 12, 3.5, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  private speechBubble(c: CanvasRenderingContext2D, id: string, anchorY: number): void {
    const speech = this.speech.get(id);
    if (!speech || Date.now() - speech.at > 7000) return;
    c.save();
    c.font = '600 15px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
    const width = Math.min(260, c.measureText(speech.text).width + 22);
    const x = -width / 2;
    c.fillStyle = '#fff6ea'; c.beginPath();
    if (typeof c.roundRect === 'function') c.roundRect(x, anchorY, width, 26, 8);
    else c.rect(x, anchorY, width, 26);
    c.fill();
    c.fillStyle = '#2a1c16'; c.fillText(speech.text, 0, anchorY + 17, width - 16);
    c.restore();
  }

  private art(key: string, x: number, y: number, width: number, height: number): boolean {
    const image = this.images[key];
    if (!image?.complete || !image.naturalWidth) return false;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    this.context.drawImage(image, x + (width - image.naturalWidth * scale) / 2, y + height - image.naturalHeight * scale, image.naturalWidth * scale, image.naturalHeight * scale);
    return true;
  }
  private render(): void {
    const c = this.context; const scale = this.height / 720; const viewport = this.width / scale;
    this.camera = Math.max(0, Math.min(WORLD_WIDTH - viewport, this.player.x - viewport * .38));
    c.clearRect(0, 0, this.width, this.height); c.save(); c.scale(scale, scale);
    c.fillStyle = '#11101a'; c.fillRect(0, 0, viewport, 720);
    const bg = this.images['background'];
    if (bg?.complete && bg.naturalWidth) {
      const bgWidth = Math.max(viewport + 500, 720 * bg.naturalWidth / bg.naturalHeight);
      c.globalAlpha = .94; c.drawImage(bg, -this.camera * .16, 0, bgWidth, 720); c.globalAlpha = 1;
    }
    const shade = c.createLinearGradient(0, 0, 0, 720); shade.addColorStop(0, '#b97a4530'); shade.addColorStop(1, '#30232b99');
    c.fillStyle = shade; c.fillRect(0, 0, viewport, 720);
    c.translate(-this.camera, 0);
    const motionTime = this.reducedMotion ? 0 : this.elapsed;
    this.atmosphere.scenery(c, motionTime, this.camera, viewport);
    for (const platform of PLATFORMS) {
      c.fillStyle = '#3b3034'; c.fillRect(platform.x, platform.y, platform.width, platform.y === FLOOR ? 110 : 24);
      c.fillStyle = '#a67858'; c.fillRect(platform.x, platform.y, platform.width, 4);
      c.fillStyle = '#f6a668'; c.fillRect(platform.x + 8, platform.y, Math.max(0, platform.width - 16), 1);
      for (let x = platform.x + 18; x < platform.x + platform.width; x += 65) { c.fillStyle = '#3c3039'; c.fillRect(x, platform.y + 12, 32, 7); }
    }
    if (this.area === 'camp') this.atmosphere.hub(c, motionTime);
    for (const station of this.stations) {
      const near = station.target === this.nearby();
      if (station.target === 'ore') this.art('ore', station.x - 58, FLOOR - 92, 116, 92);
      else if (station.target === 'forge') {
        c.fillStyle = '#493543'; c.fillRect(station.x - 46, FLOOR - 60, 92, 60);
        c.fillStyle = '#ffaf62'; c.fillRect(station.x - 34, FLOOR - 52, 68, 8);
        this.art('blade', station.x - 35, FLOOR - 160, 70, 95);
      } else if (station.target === 'beacon') {
        c.fillStyle = '#423f51'; c.fillRect(station.x - 20, FLOOR - 160, 40, 160);
        c.shadowColor = this.restored ? '#b8e6ec' : '#f29b68'; c.shadowBlur = 35;
        c.fillStyle = this.restored ? '#d5fffa' : '#b96d55'; c.beginPath(); c.arc(station.x, FLOOR - 173, 20, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      } else {
        c.strokeStyle = this.restored ? '#99e3cb' : '#574658'; c.lineWidth = 12; c.beginPath(); c.arc(station.x, FLOOR - 70, 48, Math.PI, 0); c.lineTo(station.x + 48, FLOOR); c.moveTo(station.x - 48, FLOOR - 70); c.lineTo(station.x - 48, FLOOR); c.stroke();
      }
      c.font = '600 12px system-ui'; c.textAlign = 'center'; c.fillStyle = near ? '#fff1c9' : '#c9bdc8'; c.fillText(station.label, station.x, FLOOR + 35);
      if (near) { c.fillStyle = '#fff0cb'; c.fillText('[ E ] INTERACT', station.x, FLOOR + 58); }
    }
    for (const drop of this.drops) {
      const y = FLOOR - 18 + Math.sin(motionTime * 5 + drop.x) * 4;
      c.shadowBlur = 14; c.shadowColor = drop.coins ? '#ffd36d' : '#ed9069';
      if (drop.coins) {
        c.fillStyle = '#ffd36d'; c.beginPath(); c.ellipse(drop.x, y, 3 + Math.abs(Math.cos(motionTime * 3)) * 7, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9e602c'; c.font = 'bold 14px system-ui'; c.textAlign = 'center'; c.fillText('$', drop.x, y + 5);
      } else if (!this.art('ore', drop.x - 15, y - 15, 30, 30)) { c.fillStyle = '#ed9069'; c.fillRect(drop.x - 8, y - 8, 16, 16); }
      c.shadowBlur = 0;
    }
    for (const monster of this.monsters) {
      if (monster.hp <= 0) continue;
      const warning = monster.phase === 'windup' || monster.phase === 'strike';
      if (warning) {
        c.fillStyle = monster.phase === 'strike' ? '#ff765caa' : '#ff765c40';
        c.fillRect(monster.facing < 0 ? monster.x - 170 : monster.x, FLOOR - 10, 170, 10);
        c.fillStyle = '#ffc589'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.fillText('!', monster.x, FLOOR - 150);
      }
      const squash = this.reducedMotion ? 0 : monster.phase === 'windup' ? .12 : monster.phase === 'strike' ? -.12 : Math.sin(motionTime * 3 + monster.spawn) * .025;
      c.save(); c.translate(monster.x, FLOOR); c.scale(1 + squash, 1 - squash);
      if (!this.art('creature', -70, -110, 140, 110)) { c.fillStyle = '#b26460'; c.fillRect(-35, -75, 70, 75); }
      c.restore();
      c.fillStyle = '#302530'; c.fillRect(monster.x - 45, FLOOR - 130, 90, 6); c.fillStyle = '#dd866f'; c.fillRect(monster.x - 45, FLOOR - 130, monster.hp / 60 * 90, 6);
    }
    for (const view of this.peers.values()) {
      if (view.peer.area !== (this.area === 'camp' ? 'Basalt Seamworks' : 'Ember Quarry') || view.x < this.camera - 160 || view.x > this.camera + viewport + 160) continue;
      // Spawn puts every Keeper on the same tile. Spread guests so names and sprites stay readable.
      const spread = (([...view.peer.id].reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) >>> 0, 0) % 5) - 2) * 46;
      c.save(); c.translate(view.x + spread, view.y);
      c.strokeStyle = '#edc9ff'; c.fillStyle = '#edc9ff25'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 0, 32, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = '600 16px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
      const labelWidth = Math.min(240, c.measureText(view.peer.name).width + 22);
      c.fillStyle = '#1a120fe6'; c.fillRect(-labelWidth / 2, -208, labelWidth, 24);
      c.fillStyle = '#ffe1b0'; c.fillText(view.peer.name, 0, -190, 220);
      this.speechBubble(c, view.peer.id, -214);
      const shown = this.present(view.peer.animation, view.peer.x, view.y);
      const motion = this.keeperMotion(shown, motionTime + view.x);
      const warm = shown === 'rest';
      const attackT = shown === 'attack' ? (motionTime * 3.2) % 1 : 0;
      const swing = attackT === 0 ? 0 : attackT < .3 ? -attackT / .3 : Math.sin((attackT - .3) / .7 * Math.PI);
      c.scale(view.facing, 1); this.stepDust(c, shown, motionTime + view.x);
      c.globalAlpha = motion.alpha;
      c.shadowColor = warm ? '#ffc27a' : '#deb8f3'; c.shadowBlur = warm ? 12 : 6; c.filter = 'none';
      this.posedKeeper(c, -70, -176, 140, 176, shown, motionTime + view.x, motion, attackT, swing, false);
      c.restore();
    }
    // Keep the player readable against the dark realm art at narrow viewport sizes.
    const byFire = this.area === 'camp' && Math.abs(this.player.x - 245) < 220;
    c.save(); c.translate(this.player.x, this.player.y);
    c.strokeStyle = byFire ? '#ffc27a' : '#b8e6ec'; c.fillStyle = byFire ? '#ffc27a30' : '#b8e6ec30'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, 46, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.font = '600 15px "Cormorant Garamond", Georgia, serif';
    const youWidth = Math.min(120, c.measureText('You').width + 20);
    c.fillStyle = '#1a120fe6'; c.textAlign = 'center';
    c.fillRect(-youWidth / 2, -204, youWidth, 22);
    c.beginPath(); c.moveTo(-6, -182); c.lineTo(6, -182); c.lineTo(0, -174); c.closePath(); c.fill();
    c.fillStyle = '#ffe1b0';
    c.fillText('You', 0, -188);
    this.speechBubble(c, this.selfId, -234);
    c.restore();
    c.save(); c.translate(this.player.x, this.player.y); c.scale(this.facing, 1);
    const shown = this.present(this.pose(), this.player.x, this.player.y);
    const motion = this.keeperMotion(shown, this.elapsed);
    if (this.landing > 0 && !this.reducedMotion) {
      const squash = .1 * this.landing / .18;
      motion.sx += squash; motion.sy -= squash; motion.bob += squash * 8;
    }
    const attackT = this.attackTime > 0 ? 1 - this.attackTime / .4 : 0;
    const swing = attackT === 0 ? 0 : attackT < .3 ? -attackT / .3 : Math.sin((attackT - .3) / .7 * Math.PI);
    this.stepDust(c, shown, this.elapsed);
    if (this.hurtTime > 0) c.globalAlpha = .45 + Math.sin(this.elapsed * 35) * .2;
    else if (this.dodgeTime > 0) c.globalAlpha = motion.alpha;
    c.shadowColor = shown === 'rest' ? '#ffc27a' : '#b8e6ec'; c.shadowBlur = shown === 'rest' ? 12 : 6;
    c.filter = 'none';
    this.posedKeeper(c, -78, -196, 156, 196, shown, this.elapsed, motion, attackT, swing, this.equipped);
    c.filter = 'none'; c.shadowBlur = 0; c.globalAlpha = 1;
    if (attackT > .3) {
      const u = (attackT - .3) / .7;
      c.save(); c.shadowColor = '#ffe7c2'; c.shadowBlur = 12; c.lineCap = 'round';
      c.globalAlpha = .35 * (1 - u); c.strokeStyle = '#ffb46a'; c.lineWidth = 14;
      c.beginPath(); c.arc(24, -82, 100, -1.05, -1.05 + Math.max(0, u - .12) * 2.15); c.stroke();
      c.globalAlpha = .92 * (1 - u * .35); c.strokeStyle = '#ffd7a1'; c.lineWidth = 6;
      c.beginPath(); c.arc(24, -82, 94, -1.1, -1.1 + u * 2.2); c.stroke();
      c.strokeStyle = '#fff6ea'; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    c.restore();
    this.atmosphere.feedback(c, this.reducedMotion);
    c.restore();
  }
}
