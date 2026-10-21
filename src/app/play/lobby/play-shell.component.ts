/**
 * play-shell.component.ts — /play: the title screen, the character list, the Glass for a new Keeper, then the world.
 *
 * Owner, 2026-10-21: "we also need a login and select character screen" (Tibia: log in, see your characters, pick one
 * or make a new one, enter the world) — and "if I'm already logged in, it should go to character screen".
 *
 *   signed out, never chose        → title (Sign in with Google · Play offline)
 *   signed in, or chose offline    → character list (a quiet "waking" screen while a signed-in session resumes)
 *   Enter world                    → the world (SideScrollerComponent, mounted only now: nothing runs behind the title)
 *   the world's menu → Character select → saved, then back to the list
 *
 * Each character's save is its own namespace in GameStateGateway (shared/save/character-scope.ts), fixed per page, so
 * entering a character other than the one this page booted with saves and reloads into it. See play-lobby.service.ts
 * for the device-local flags (and the e2e skip).
 */
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription, filter, firstValueFrom, race, timer } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { GameStateGateway } from '../../shared/save/game-state.gateway';
import { MAX_CHARACTERS, PRIMARY_CHARACTER, newCharacterId } from '../../shared/save/character-scope';
import { CloudSaveService, hasBoundAccount } from '../../shared/cloud-save/cloud-save.service';
import { CharacterRosterService } from '../../shared/characters/character-roster.service';
import { CharacterRow, PortraitLook, confirmsDelete, hasFreeSlot, idForNewCharacter } from '../../shared/characters/character-roster.model';
import { KEEPER_LOOK_I18N } from '../../shared/keeper-look/keeper-look.i18n';
import { type KeeperLook, coerceLook } from '../../shared/keeper-look/keeper-look.model';
import { KeeperPainter } from '../../shared/keeper-look/keeper-paint';
import { FRONT_H, FRONT_W, frontSheet } from '../../shared/keeper-look/keeper-front';
import { vocationLook } from '../../shared/keeper-look/vocation-look';
import { KeeperMakerComponent } from '../../shared/keeper-look/keeper-maker.component';
import { SideScrollerComponent } from '../side-scroller.component';
import { StoryService } from '../../shared/story/story.service';
import { LOBBY_I18N } from './lobby.i18n';
import { paintTitleArt, titleArtSize } from './title-art';
import { hasMeaningfulSave, summarise } from './character-summary';
import {
  LOBBY_ENTER_KEY, LOBBY_FROM_KEY, LOBBY_GUEST_KEY, LOBBY_MAKE_KEY, LOBBY_SKIP_KEY, LobbyMode, PlayLobbyService, initialLobbyMode, mayUsePrimarySlot,
} from './play-lobby.service';

/** The title art's frame rate: slow motion needs few frames, and a phone on the title screen should stay cool. */
const ART_FPS = 12;
/** How long a resuming sign-in may hold the quiet "waking" screen before the list shows anyway. */
const AUTH_WAIT_MS = 8000;

@Component({
  selector: 'app-play-shell',
  standalone: true,
  imports: [SideScrollerComponent, KeeperMakerComponent],
  templateUrl: './play-shell.component.html',
  styleUrls: ['./play-shell.component.css'],
})
export class PlayShellComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly gateway = inject(GameStateGateway);
  private readonly cloud = inject(CloudSaveService);
  private readonly roster = inject(CharacterRosterService);
  private readonly lobby = inject(PlayLobbyService);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  private readonly story = inject(StoryService);

  mode: LobbyMode = 'boot';
  /** The highlighted row on the character list. */
  picked: string | null = null;
  rows: CharacterRow[] = [];
  /** A save + reload is under way (a character switch): every button waits. */
  busy = false;
  signingIn = false;
  error = '';
  notice = '';
  /** The row whose deletion is being confirmed, and what has been typed so far. */
  deleting: CharacterRow | null = null;
  typed = '';
  readonly max = MAX_CHARACTERS;

  private artEl: HTMLCanvasElement | null = null;
  @ViewChild('art') set art(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.artEl = ref?.nativeElement ?? null;
    if (this.artEl) this.startArt();
  }
  @ViewChild('deleteInput') deleteInput?: ElementRef<HTMLInputElement>;

  private raf = 0;
  private lastFrame = 0;
  private artStart = 0;
  private reduced = false;
  private readonly portraits = new Map<string, string>();
  private subs: Subscription[] = [];

  constructor() {
    this.i18n.register(LOBBY_I18N);
    this.i18n.register(KEEPER_LOOK_I18N);
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  get signedIn(): boolean { return this.cloud.signedIn; }
  /** The cloud is pulling this account's save (the roster among it): New Keeper waits, so it cannot land on a slot it has not seen. */
  syncing = false;
  get account(): string { return this.cloud.status.displayName || this.cloud.status.email || ''; }
  get full(): boolean { return !hasFreeSlot(this.roster.roster); }
  get pickedRow(): CharacterRow | null { return this.rows.find(r => r.id === this.picked) ?? null; }
  get deleteName(): string { return this.deleting ? this.nameOf(this.deleting) : ''; }
  get deleteReady(): boolean { return !!this.deleting && confirmsDelete(this.deleting, this.typed, this.t('lobby.select.unnamed')); }

  ngOnInit(): void {
    if (!this.browser) return;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.subs.push(this.lobby.selectRequested$.subscribe(() => void this.leaveWorld()));
    this.subs.push(this.roster.roster$.subscribe(() => this.refreshRows()));
    this.subs.push(this.cloud.status$.subscribe(st => { const now = st.state === 'syncing'; if (now !== this.syncing) this.zone.run(() => { this.syncing = now; }); }));
    void this.decide();
  }

  ngAfterViewInit(): void {
    if (this.artEl) this.startArt();
  }

  ngOnDestroy(): void {
    this.stopArt();
    for (const sub of this.subs) sub.unsubscribe();
  }

  // ── Where /play opens ──────────────────────────────────────────────────────

  private async decide(): Promise<void> {
    const character = this.gateway.character;
    let enter: string | null = null, make: string | null = null, guest = false, skip = false;
    try {
      enter = sessionStorage.getItem(LOBBY_ENTER_KEY);
      make = sessionStorage.getItem(LOBBY_MAKE_KEY);
      sessionStorage.removeItem(LOBBY_ENTER_KEY);
      sessionStorage.removeItem(LOBBY_MAKE_KEY);
    } catch { /* private mode */ }
    try {
      guest = localStorage.getItem(LOBBY_GUEST_KEY) === '1';
      skip = localStorage.getItem(LOBBY_SKIP_KEY) === 'skip';
    } catch { /* private mode */ }
    if (this.route.snapshot.queryParamMap.get('lobby') === 'skip') skip = true;
    // A Keeper this page boots into that is on no list: a Glass left by a refresh, the browser's back, a closed tab
    // (the row is written only by Become), or a Keeper deleted while it was the one in play. Nothing of it may stay.
    if (make !== character && character !== PRIMARY_CHARACTER && !this.roster.row(character) && !skip) {
      await this.discardAndReturn(character);
      return;
    }
    const signedIn = hasBoundAccount();
    let target = initialLobbyMode({ character, skip, enter, make, signedIn, guest });

    // A returning signed-in player: no title flash. Wait (quietly) for the session to resume, so the list and the
    // world hold the cloud's copy; a session that lapsed falls back to the title.
    if (signedIn && target !== 'title' && !skip) {
      this.cloud.init();
      await this.authSettled();
      if (!this.cloud.signedIn && target === 'select' && !guest) target = 'title';
    }
    this.zone.run(() => this.go(target));
  }

  /** Resolves once cloud save is not mid-sign-in (or after {@link AUTH_WAIT_MS}). */
  private authSettled(): Promise<unknown> {
    return firstValueFrom(race(
      this.cloud.status$.pipe(filter(s => s.state !== 'syncing')),
      timer(AUTH_WAIT_MS),
    ));
  }

  private go(mode: Exclude<LobbyMode, 'boot'>): void {
    if (mode === 'select') {
      this.ensureRoster();
      this.refreshRows();
      if (!this.picked || !this.rows.some(r => r.id === this.picked)) {
        this.picked = this.rows.find(r => r.id === this.gateway.character)?.id ?? this.rows[0]?.id ?? null;
      }
    }
    if (mode === 'create' && this.browser && !this.glassEntry) {
      try { history.pushState({ ...(history.state ?? {}), glass: 1 }, ''); this.glassEntry = true; } catch { /* no history */ }
    }
    if (mode === 'game') this.noteActive();
    if (mode === 'game') this.stopArt();
    this.mode = mode;
  }

  // ── The title screen ───────────────────────────────────────────────────────

  async signIn(): Promise<void> {
    if (this.signingIn) return;
    this.signingIn = true;
    this.error = '';
    try {
      await this.cloud.signIn();
    } finally {
      this.zone.run(() => {
        this.signingIn = false;
        if (this.cloud.signedIn) this.go('select');
        else if (this.cloud.status.error) this.error = this.t('lobby.signInFailed', { msg: this.cloud.status.error });
      });
    }
  }

  playOffline(): void {
    try { localStorage.setItem(LOBBY_GUEST_KEY, '1'); } catch { /* private mode: asked again next time */ }
    this.go('select');
  }

  async signOut(): Promise<void> {
    this.busy = true;
    try {
      await this.cloud.signOut();
    } finally {
      this.zone.run(() => {
        this.busy = false;
        try { localStorage.removeItem(LOBBY_GUEST_KEY); } catch { /* private mode */ }
        this.go('title');
      });
    }
  }

  // ── The character list ─────────────────────────────────────────────────────

  /**
   * The migration: a save from before characters existed is character #1 already (it keeps the unprefixed keys); it
   * only needs its row. Then every character this device holds gets a fresh summary.
   */
  private ensureRoster(now = Date.now()): void {
    const roster = this.roster.roster;
    if (!roster.chars[PRIMARY_CHARACTER] && hasMeaningfulSave(this.gateway, PRIMARY_CHARACTER)) {
      this.roster.put(summarise(this.gateway, {
        id: PRIMARY_CHARACTER, name: '', vocation: 'warlock', level: 1, area: '', look: null, createdAt: 0, updatedAt: 0,
      }, now));
    }
    for (const row of this.roster.characters) {
      const next = summarise(this.gateway, row, now);
      if (next !== row) this.roster.put(next);
    }
  }

  /** The playing character's row, refreshed (on entering and leaving the world). */
  private noteActive(): void {
    const row = this.roster.row(this.gateway.character);
    if (row) {
      const next = summarise(this.gateway, row);
      if (next !== row) this.roster.put(next);
    }
  }

  private refreshRows(): void {
    this.rows = this.roster.characters;
  }

  nameOf(row: CharacterRow): string { return row.name || this.t('lobby.select.unnamed'); }
  vocationOf(row: CharacterRow): string {
    const key = 'look.class.' + row.vocation;
    const text = this.t(key);
    return text === key ? row.vocation : text;
  }
  whereOf(row: CharacterRow): string {
    return row.area ? this.t('lobby.select.where', { area: row.area }) : this.t('lobby.select.nowhere');
  }
  /** True for a Keeper this device has never held (played on another device; fetched on entering). */
  remote(row: CharacterRow): boolean { return !this.gateway.hasLocalSave(row.id); }

  /** The row's Keeper, painted with the world's own front sprite (first frame), as a data URL. */
  portrait(row: CharacterRow): string {
    const look = row.look;
    const key = JSON.stringify(look);
    const held = this.portraits.get(key);
    if (held !== undefined) return held;
    let url = '';
    if (this.browser) {
      try {
        const full = coerceLook(look as PortraitLook | null);
        const v = vocationLook(full.vocation, null);
        const sheet = frontSheet(new KeeperPainter(full, v.gear, v.garb), full.vocation === 'warlock');
        const el = document.createElement('canvas');
        el.width = FRONT_W; el.height = FRONT_H;
        const c = el.getContext('2d');
        if (c) {
          c.imageSmoothingEnabled = false;
          c.drawImage(sheet, 0, 0, FRONT_W, FRONT_H, 0, 0, FRONT_W, FRONT_H);
          url = el.toDataURL('image/png');
        }
      } catch { /* no 2D canvas: the frame stays empty */ }
    }
    this.portraits.set(key, url);
    return url;
  }

  pick(id: string): void {
    if (this.busy) return;
    this.picked = id;
    this.notice = '';
  }

  onListKey(event: KeyboardEvent): void {
    if (this.busy || this.deleting || !this.rows.length) return;
    const at = this.rows.findIndex(r => r.id === this.picked);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = this.rows[(Math.max(0, at) + (event.key === 'ArrowDown' ? 1 : this.rows.length - 1)) % this.rows.length];
      this.picked = next.id;
      setTimeout(() => document.querySelector<HTMLElement>(`[data-character="${next.id}"]`)?.focus());
    }
  }

  /** Enter the world as `id`: at once when it is the character this page plays, else save, switch and reload. */
  async enter(id: string | null = this.picked): Promise<void> {
    if (!id || this.busy || !this.roster.row(id)) return;
    if (id === this.gateway.character) {
      this.go('game');
      return;
    }
    await this.switchTo(id, LOBBY_ENTER_KEY);
  }

  async newCharacter(): Promise<void> {
    if (this.busy || this.full || this.syncing) return;
    const roster = this.roster.roster;
    // Character #1's slot is handed out only when this device knows the account's whole list: a device that was
    // never bound to an account, or one whose cloud pull has completed. Before that (a new device, the cloud roster
    // not landed yet) a fresh id, never c1 — a c1 created here would merge its look and name over the account's c1.
    const settled = mayUsePrimarySlot({ bound: hasBoundAccount(), signedIn: this.cloud.signedIn, state: this.cloud.status.state, lastSyncedAt: this.cloud.status.lastSyncedAt });
    const fresh = newCharacterId(Math.random, new Set(Object.keys(roster.chars)));
    const id = settled ? idForNewCharacter(roster, hasMeaningfulSave(this.gateway, PRIMARY_CHARACTER), fresh) : fresh;
    // No row yet: a Keeper exists only once Become is pressed (made()). Leaving the Glass any other way leaves the
    // list as it was. The Keeper we came from is remembered, to go back to.
    try { sessionStorage.setItem(LOBBY_FROM_KEY, this.gateway.character); } catch { /* private mode: the list's first */ }
    if (id === this.gateway.character) {
      this.picked = id;
      this.go('create');
      return;
    }
    await this.switchTo(id, LOBBY_MAKE_KEY);
  }

  /** Save this page's character, choose `id` for the next load, and reload into it (`flag` says what to open). */
  private async switchTo(id: string, flag: string): Promise<void> {
    this.busy = true;
    this.stopArt();
    // Owners flush, the cloud gets its last push; the reload's pagehide then writes this page's memory into this
    // page's character (the gateway's namespace does not change until the next load).
    await this.gateway.settleForReload();
    this.gateway.selectCharacter(id);
    try { sessionStorage.setItem(flag, id); } catch { /* private mode: the list opens instead */ }
    location.reload();
  }

  // ── Deleting ───────────────────────────────────────────────────────────────

  askDelete(): void {
    const row = this.pickedRow;
    if (!row || this.busy) return;
    this.deleting = row;
    this.typed = '';
    setTimeout(() => this.deleteInput?.nativeElement.focus());
  }

  cancelDelete(): void {
    this.deleting = null;
    this.typed = '';
  }

  async confirmDelete(): Promise<void> {
    const row = this.deleting;
    if (!row || !this.deleteReady || this.busy) return;
    this.busy = true;
    const name = this.nameOf(row);
    this.roster.tombstone(row.id);
    // The playing character's services still hold it in memory: retire it so nothing (not even the next reload's
    // pagehide flush) writes it back.
    if (row.id === this.gateway.character) this.gateway.retireCharacter();
    await this.gateway.deleteCharacterSave(row.id);
    this.zone.run(() => {
      this.busy = false;
      this.deleting = null;
      this.typed = '';
      this.refreshRows();
      this.picked = this.rows[0]?.id ?? null;
      this.notice = this.t('lobby.delete.done', { name });
    });
  }

  // ── The Glass (a new character) ────────────────────────────────────────────

  /** "I've played before: skip the tutorial" on the Glass (off by default: a new Keeper is taught the island). */
  skipTutorial = false;

  made(look?: KeeperLook): void {
    // Become was pressed: NOW the Keeper exists, and goes on the list.
    const now = Date.now();
    const made = look ?? coerceLook(this.gateway.read('godforge-keeper-look'));
    const id = this.gateway.character;
    const row = this.roster.row(id);
    this.roster.put({ id, name: made.name, vocation: made.vocation, level: row?.level ?? 1, area: row?.area ?? '', look: null, createdAt: row?.createdAt || now, updatedAt: now });
    // The new Keeper's own story record (this page plays it): the prologue is over before it starts.
    if (this.skipTutorial) this.story.skipTut();
    try { sessionStorage.removeItem(LOBBY_FROM_KEY); } catch { /* private mode */ }
    this.leaveGlassHistory();
    this.go('game');
  }

  /**
   * Leave the Glass without Become (its ×, Back, Escape, the phone's back): the Keeper never existed. No row, and
   * none of the save this page began for it: back to the list as it was.
   */
  async backFromCreate(): Promise<void> {
    if (this.mode !== 'create' || this.busy) return;
    const id = this.gateway.character;
    const look = coerceLook(this.gateway.read('godforge-keeper-look'));
    if (look.made && this.roster.row(id)) { this.leaveGlassHistory(); this.zone.run(() => this.go('select')); return; }
    if (id === PRIMARY_CHARACTER) {
      // Character #1's slot (the first Keeper on a device): this page plays it, nothing was made; drop any old row
      // an earlier build wrote for it, and show the (unchanged) list.
      if (this.roster.row(id)) this.roster.forget(id);
      this.leaveGlassHistory();
      this.zone.run(() => this.go('select'));
      return;
    }
    await this.discardAndReturn(id);
  }

  /** Throw away a Keeper this page plays that was never made (or is on no list), and reload onto the list. */
  private async discardAndReturn(id: string): Promise<void> {
    this.busy = true;
    this.stopArt();
    if (this.roster.roster.chars[id] && !this.roster.row(id)) { /* already a tombstone: leave it */ }
    else if (this.roster.row(id)) this.roster.forget(id);
    this.gateway.retireCharacter();
    await this.gateway.deleteCharacterSave(id);
    let from: string | null = null;
    try { from = sessionStorage.getItem(LOBBY_FROM_KEY); sessionStorage.removeItem(LOBBY_FROM_KEY); sessionStorage.removeItem(LOBBY_MAKE_KEY); } catch { /* private mode */ }
    const back = from && from !== id && (from === PRIMARY_CHARACTER || this.roster.row(from)) ? from : this.roster.characters[0]?.id ?? PRIMARY_CHARACTER;
    this.gateway.selectCharacter(back);
    location.reload();
  }

  /** The Glass took one history entry (so a phone's back closes it); a Keeper made gives it back. */
  private glassEntry = false;
  private leaveGlassHistory(): void {
    if (!this.glassEntry) return;
    this.glassEntry = false;
    this.ignorePop = true;
    try { history.back(); } catch { this.ignorePop = false; }
  }
  private ignorePop = false;

  @HostListener('window:popstate')
  onPop(): void {
    if (this.ignorePop) { this.ignorePop = false; return; }
    if (this.mode === 'create' && this.glassEntry) { this.glassEntry = false; void this.backFromCreate(); }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mode === 'create' && !this.busy) void this.backFromCreate();
  }

  // ── Back from the world ────────────────────────────────────────────────────

  private async leaveWorld(): Promise<void> {
    if (this.mode !== 'game' || this.busy) return;
    this.busy = true;
    await this.gateway.settleForReload();
    this.zone.run(() => {
      this.busy = false;
      this.go('select');
    });
  }

  // ── The title art ──────────────────────────────────────────────────────────

  private startArt(): void {
    if (!this.browser || !this.artEl || this.raf) return;
    const el = this.artEl;
    const size = (): void => {
      const { w, h } = titleArtSize(window.innerWidth, window.innerHeight);
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    };
    const draw = (seconds: number): void => {
      const c = el.getContext('2d');
      if (!c) return;
      size();
      paintTitleArt(c, el.width, el.height, seconds);
    };
    if (this.reduced) {
      this.stopStill?.();
      draw(0);
      const still = (): void => draw(0);
      window.addEventListener('resize', still, { passive: true });
      this.stopStill = () => window.removeEventListener('resize', still);
      return;
    }
    this.artStart = performance.now();
    this.zone.runOutsideAngular(() => {
      const tick = (now: number): void => {
        if (!this.artEl) { this.raf = 0; return; }
        if (now - this.lastFrame >= 1000 / ART_FPS && document.visibilityState !== 'hidden') {
          this.lastFrame = now;
          draw((now - this.artStart) / 1000);
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private stopStill: (() => void) | null = null;

  private stopArt(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopStill?.();
    this.stopStill = null;
  }
}
